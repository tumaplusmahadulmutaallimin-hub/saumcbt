import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Hash,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Lock,
  History,
  Printer,
  Upload,
  Link2,
  Save,
  Trash2,
  QrCode,
  Search,
  Tag,
  FileSpreadsheet,
} from 'lucide-react';
import {
  ExamConfig,
  ExamRoom,
  NumberingConfig,
  NumberingHistoryEntry,
  Student,
  UserAccount,
} from '../../types';
import {
  compareClasses,
  formatParticipantNumber,
  generateStudentNumbers,
  validateParticipantNumbers,
} from '../../utils/numbering';
import { SimpleBarcode, SimpleQRCode, formatIndonesianDate } from '../../utils/qrBarcode';

interface PenomoranViewProps {
  students: Student[];
  rooms: ExamRoom[];
  config: NumberingConfig;
  examConfig: ExamConfig;
  history: NumberingHistoryEntry[];
  currentUser: UserAccount;
  canEdit: boolean;
  onSaveNumbering: (payload: {
    students: Student[];
    numberingConfig: NumberingConfig;
    historyEntry?: NumberingHistoryEntry;
    finalize?: boolean;
  }) => Promise<void>;
  onNavigateToPrint: (doc?: 'nomor_peserta' | 'kartu_peserta') => void;
  onNavigateToDeskNumbers?: () => void;
}

export const PenomoranView: React.FC<PenomoranViewProps> = ({
  students,
  rooms,
  config,
  examConfig,
  history,
  currentUser,
  canEdit,
  onSaveNumbering,
  onNavigateToPrint,
  onNavigateToDeskNumbers,
}) => {
  const [localConfig, setLocalConfig] = useState<NumberingConfig>(config);
  const [localStudents, setLocalStudents] = useState<Student[]>(students);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [statusNotice, setStatusNotice] = useState('');
  const [errorNotice, setErrorNotice] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterKelas, setFilterKelas] = useState('all');
  const [filterRuang, setFilterRuang] = useState('all');
  const [hasUnsavedEdits, setHasUnsavedEdits] = useState(false);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  useEffect(() => {
    setLocalStudents(students);
    setHasUnsavedEdits(false);
  }, [students]);

  const roomMap = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);
  const validation = useMemo(() => validateParticipantNumbers(localStudents), [localStudents]);
  const deskMissingCount = useMemo(
    () => localStudents.filter((s) => s.status === 'Aktif' && !s.nomorMeja).length,
    [localStudents]
  );

  const distinctJenjangOrClass = useMemo(() => {
    const keys = new Set<string>(['X', 'XI', 'XII']);
    localStudents.forEach((s) => {
      if (s.jenjang) keys.add(s.jenjang);
    });
    return Array.from(keys);
  }, [localStudents]);

  const distinctClasses = useMemo(
    () =>
      Array.from(new Set(localStudents.map((s) => s.kelas).filter(Boolean))).sort((a, b) =>
        compareClasses(a, b, localConfig.urutanKelas)
      ),
    [localStudents, localConfig.urutanKelas]
  );

  const previewSample = formatParticipantNumber(
    localConfig,
    localConfig.nomorAwal || 1,
    localStudents[0]?.kelas || 'X-A'
  );

  const activeOrderedStudents = useMemo(() => {
    return localStudents
      .filter((s) => s.status === 'Aktif')
      .filter((s) => filterKelas === 'all' || s.kelas === filterKelas)
      .filter((s) => filterRuang === 'all' || s.ruangId === filterRuang)
      .filter((s) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          s.nama.toLowerCase().includes(q) ||
          (s.nomorPeserta || '').toLowerCase().includes(q) ||
          s.nisn.toLowerCase().includes(q) ||
          s.nis.toLowerCase().includes(q) ||
          s.kelas.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const c = compareClasses(a.kelas, b.kelas, localConfig.urutanKelas);
        if (c !== 0) return c;
        return a.nama.localeCompare(b.nama, 'id');
      });
  }, [localStudents, filterKelas, filterRuang, searchQuery, localConfig.urutanKelas]);

  const sampleStudent = activeOrderedStudents[0] || localStudents.find((s) => s.status === 'Aktif') || localStudents[0];
  const sampleRoom = sampleStudent?.ruangId ? roomMap.get(sampleStudent.ruangId) : undefined;

  const readImageAsDataUrl = (file: File, onLoaded: (url: string) => void) => {
    if (!file.type.startsWith('image/')) {
      setErrorNotice('File harus berupa gambar (PNG, JPG, SVG, atau WEBP).');
      return;
    }
    if (file.size > 1024 * 1024) {
      setErrorNotice('Ukuran gambar barcode maksimal 1 MB agar cetak tetap cepat.');
      return;
    }
    setErrorNotice('');
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onLoaded(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGlobalBarcodeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    readImageAsDataUrl(file, (dataUrl) => {
      setLocalConfig((prev) => ({
        ...prev,
        barcodeMode: 'uploaded',
        uploadedBarcodeUrl: dataUrl,
      }));
      setHasUnsavedEdits(true);
      setStatusNotice('Gambar barcode global berhasil diunggah. Klik "Simpan Perubahan" untuk menerapkan ke kartu cetak.');
    });
    e.target.value = '';
  };

  const handleStudentBarcodeUpload = (studentId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    readImageAsDataUrl(file, (dataUrl) => {
      setLocalStudents((prev) =>
        prev.map((s) => (s.id === studentId ? { ...s, barcodeUrl: dataUrl } : s))
      );
      setHasUnsavedEdits(true);
    });
    e.target.value = '';
  };

  const updateStudentField = (
    studentId: string,
    patch: Partial<Pick<Student, 'nomorPeserta' | 'nomorMeja' | 'customLink' | 'barcodeUrl'>>
  ) => {
    setLocalStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, ...patch } : s))
    );
    setHasUnsavedEdits(true);
  };

  const handleAutoFillDeskNumbers = () => {
    const active = localStudents
      .filter((s) => s.status === 'Aktif')
      .sort((a, b) => {
        const roomA = a.ruangId || 'ZZZ';
        const roomB = b.ruangId || 'ZZZ';
        if (roomA !== roomB) return roomA.localeCompare(roomB);
        if (examConfig.moda === 'online' && (a.sesi || 1) !== (b.sesi || 1)) {
          return (a.sesi || 1) - (b.sesi || 1);
        }
        return (a.nomorPeserta || a.nama).localeCompare(b.nomorPeserta || b.nama, 'id');
      });

    const roomCounters = new Map<string, number>();
    const mejaMap = new Map<string, number>();

    active.forEach((st) => {
      const key =
        examConfig.moda === 'online'
          ? `${st.ruangId || 'GLOBAL'}_S${st.sesi || 1}`
          : st.ruangId || 'GLOBAL';
      const next = (roomCounters.get(key) || 0) + 1;
      roomCounters.set(key, next);
      mejaMap.set(st.id, next);
    });

    setLocalStudents((prev) =>
      prev.map((st) => ({
        ...st,
        nomorMeja: mejaMap.get(st.id) ?? st.nomorMeja,
      }))
    );
    setHasUnsavedEdits(true);
    setStatusNotice('Nomor meja berhasil diisi otomatis (01, 02, dst. per ruang/sesi). Jangan lupa klik Simpan Perubahan.');
  };

  const handleExportExcelComplete = () => {
    const rows = activeOrderedStudents.map((st, idx) => {
      const room = st.ruangId ? roomMap.get(st.ruangId) : undefined;
      return {
        No: idx + 1,
        'Nomor Peserta': st.nomorPeserta || '-',
        'Nomor Meja': st.nomorMeja ? `MEJA ${String(st.nomorMeja).padStart(2, '0')}` : '-',
        Ruang: room ? room.namaRuang : '-',
        Sesi: examConfig.moda === 'online' ? `Sesi ${st.sesi || 1}` : '-',
        NIS: st.nis,
        NISN: st.nisn,
        'Nama Lengkap': st.nama,
        'L/P': st.jenisKelamin,
        'Tempat Lahir': st.tempatLahir,
        'Tanggal Lahir': st.tanggalLahir,
        Kelas: st.kelas,
        'Alamat Link Ujian': st.customLink || localConfig.manualLinkUrl || '-',
        Status: st.status,
      };
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 5 },
      { wch: 16 },
      { wch: 12 },
      { wch: 14 },
      { wch: 10 },
      { wch: 12 },
      { wch: 14 },
      { wch: 28 },
      { wch: 5 },
      { wch: 16 },
      { wch: 14 },
      { wch: 10 },
      { wch: 30 },
      { wch: 10 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Nomor_Peserta_Meja');
    XLSX.writeFile(wb, 'Daftar_Nomor_Peserta_Meja_Lengkap_SAUM.xlsx');
  };

  const executeGenerate = async (finalize = true) => {
    const updatedStudents = generateStudentNumbers(localStudents, localConfig);
    const entry: NumberingHistoryEntry = {
      id: `nh-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actor: currentUser.nama,
      totalGenerated: updatedStudents.filter((s) => s.status === 'Aktif' && s.nomorPeserta).length,
      formatPreview: previewSample,
      note: examConfig.isNomorFinalized
        ? 'Pembuatan ulang nomor peserta terfinalisasi'
        : 'Generate nomor peserta berurutan otomatis',
    };
    await onSaveNumbering({
      students: updatedStudents,
      numberingConfig: localConfig,
      historyEntry: entry,
      finalize,
    });
    setLocalStudents(updatedStudents);
    setHasUnsavedEdits(false);
    setConfirmModalOpen(false);
    setStatusNotice('Nomor peserta berhasil dibuat ulang dan disimpan ke database.');
  };

  const handleSaveManualEdits = async () => {
    setErrorNotice('');
    if (validation.duplicates.length > 0) {
      setErrorNotice(`Terdapat nomor peserta ganda: ${validation.duplicates.join(', ')}. Harap perbaiki sebelum menyimpan.`);
      return;
    }
    const entry: NumberingHistoryEntry = {
      id: `nh-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actor: currentUser.nama,
      totalGenerated: localStudents.filter((s) => s.status === 'Aktif' && s.nomorPeserta).length,
      formatPreview: localConfig.manualLinkUrl
        ? `Link: ${localConfig.manualLinkUrl}`
        : previewSample,
      note: 'Pembaruan konfigurasi barcode, link manual, nomor peserta & nomor meja',
    };
    await onSaveNumbering({
      students: localStudents,
      numberingConfig: localConfig,
      historyEntry: entry,
      finalize: examConfig.isNomorFinalized,
    });
    setHasUnsavedEdits(false);
    setStatusNotice('Pengaturan nomor peserta, barcode, alamat link manual, dan nomor meja berhasil disimpan.');
  };

  const handleGenerateClick = () => {
    if (examConfig.isNomorFinalized || validation.totalActive > 0) {
      setConfirmModalOpen(true);
    } else {
      executeGenerate(true);
    }
  };

  const renderSampleVisualCode = (st?: Student) => {
    if (!st) return null;
    const effectiveBarcode = st.barcodeUrl || localConfig.uploadedBarcodeUrl;
    const effectiveLink = (st.customLink || localConfig.manualLinkUrl || '').trim();
    const mode = localConfig.barcodeMode || 'auto';

    if (st.barcodeUrl || (mode === 'uploaded' && effectiveBarcode)) {
      return (
        <div className="flex flex-col items-center">
          <img
            src={effectiveBarcode}
            alt="Barcode Peserta"
            className="h-10 max-w-[120px] object-contain border border-slate-200 bg-white rounded p-0.5"
          />
          <span className="font-mono text-[9px] text-slate-700 font-bold mt-0.5">
            {st.nomorPeserta || '-'}
          </span>
        </div>
      );
    }

    if (mode === 'link_qr') {
      return (
        <div className="flex flex-col items-center">
          <SimpleQRCode value={effectiveLink || st.nomorPeserta || 'SAUM'} size={52} />
          <span className="font-mono text-[8px] text-slate-600 mt-0.5 truncate max-w-[130px]">
            {effectiveLink || st.nomorPeserta}
          </span>
        </div>
      );
    }

    return <SimpleBarcode value={st.nomorPeserta || '26-01-000'} height={28} width={116} />;
  };

  return (
    <div className="space-y-6">
      {/* Main Configuration Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                Nomor Peserta Ujian, Barcode & Kelengkapan Identitas
              </h2>
              {examConfig.isNomorFinalized && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                  <Lock className="w-3 h-3" /> Final
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Kelola penomoran peserta unik berurutan, barcode/QR, dan alamat link ujian. (Cetak Nomor Meja dikelola terpisah di Menu Nomor Meja.)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportExcelComplete}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer whitespace-nowrap"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" /> Export Excel Peserta
            </button>
            <button
              onClick={() => onNavigateToPrint('nomor_peserta')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" /> Cetak Daftar Nomor Peserta
            </button>
            <button
              onClick={() => onNavigateToPrint('kartu_peserta')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer whitespace-nowrap"
            >
              <QrCode className="w-3.5 h-3.5" /> Cetak Kartu Peserta
            </button>
            {onNavigateToDeskNumbers && (
              <button
                type="button"
                onClick={onNavigateToDeskNumbers}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg cursor-pointer whitespace-nowrap"
              >
                <Tag className="w-3.5 h-3.5" /> Buka Menu Nomor Meja
              </button>
            )}
            {canEdit && (
              <button
                onClick={handleGenerateClick}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer whitespace-nowrap"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Generate Nomor Peserta
              </button>
            )}
          </div>
        </div>

        {statusNotice && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {statusNotice}
          </div>
        )}

        {errorNotice && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {errorNotice}
          </div>
        )}

        {/* Validation Summary Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50">
            <p className="text-slate-500 font-semibold">Contoh Format Nomor</p>
            <p className="text-lg font-mono font-bold text-emerald-900 mt-1">{previewSample}</p>
          </div>
          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50">
            <p className="text-slate-500 font-semibold">Validasi Nomor Ujian</p>
            <p className={`text-sm font-bold mt-1 ${validation.isValid ? 'text-emerald-700' : 'text-red-600'}`}>
              {validation.isValid
                ? `Valid • ${validation.totalActive} peserta unik`
                : `Ganda: ${validation.duplicates.length} | Kosong: ${validation.missingCount}`}
            </p>
          </div>
          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50">
            <p className="text-slate-500 font-semibold">Status Nomor Meja</p>
            <p className={`text-sm font-bold mt-1 ${deskMissingCount === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
              {deskMissingCount === 0
                ? `Lengkap • ${validation.totalActive} meja terisi`
                : `${deskMissingCount} peserta belum bernomor meja`}
            </p>
          </div>
          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50">
            <p className="text-slate-500 font-semibold">Pola Token Format</p>
            <p className="text-xs font-mono text-slate-800 mt-1 truncate">
              {localConfig.polaFormat || '{tahun}{sep}{madrasah}{sep}{kodeKelas}{sep}{urut}'}
            </p>
          </div>
        </div>

        {/* Numbering Config Inputs */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Kode Tahun</label>
            <input
              disabled={!canEdit}
              value={localConfig.kodeTahun}
              onChange={(e) => {
                setLocalConfig({ ...localConfig, kodeTahun: e.target.value });
                setHasUnsavedEdits(true);
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Kode Madrasah</label>
            <input
              disabled={!canEdit}
              value={localConfig.kodeMadrasah}
              onChange={(e) => {
                setLocalConfig({ ...localConfig, kodeMadrasah: e.target.value });
                setHasUnsavedEdits(true);
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Nomor Awal</label>
            <input
              type="number"
              min={1}
              disabled={!canEdit}
              value={localConfig.nomorAwal ?? 1}
              onChange={(e) => {
                setLocalConfig({ ...localConfig, nomorAwal: Math.max(1, Number(e.target.value) || 1) });
                setHasUnsavedEdits(true);
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Digit Urut</label>
            <input
              type="number"
              min={2}
              max={6}
              disabled={!canEdit}
              value={localConfig.digitUrut}
              onChange={(e) => {
                setLocalConfig({ ...localConfig, digitUrut: Math.max(2, Number(e.target.value) || 3) });
                setHasUnsavedEdits(true);
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Pemisah</label>
            <input
              disabled={!canEdit}
              value={localConfig.pemisah}
              onChange={(e) => {
                setLocalConfig({ ...localConfig, pemisah: e.target.value });
                setHasUnsavedEdits(true);
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Urutan Peserta</label>
            <select
              disabled={!canEdit}
              value={localConfig.urutBerdasarkan}
              onChange={(e) => {
                setLocalConfig({
                  ...localConfig,
                  urutBerdasarkan: e.target.value as NumberingConfig['urutBerdasarkan'],
                });
                setHasUnsavedEdits(true);
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-semibold"
            >
              <option value="kelas_lalu_nama">Kelas Terendah → Alfabet</option>
              <option value="nama_alfabetis">Alfabetis A–Z Global</option>
              <option value="nisn">Berdasarkan NISN</option>
              <option value="nis">Berdasarkan NIS</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2 border-t border-slate-100">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Template Pola (Token: {'{tahun}, {madrasah}, {kodeKelas}, {urut}, {sep}'})
            </label>
            <input
              disabled={!canEdit}
              value={localConfig.polaFormat || '{tahun}{sep}{madrasah}{sep}{kodeKelas}{sep}{urut}'}
              onChange={(e) => {
                setLocalConfig({ ...localConfig, polaFormat: e.target.value });
                setHasUnsavedEdits(true);
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Kode Per Jenjang</label>
            <div className="flex flex-wrap gap-2">
              {distinctJenjangOrClass.map((jen) => (
                <div key={jen} className="flex items-center gap-1 border border-slate-300 rounded-lg px-2 py-1 bg-slate-50">
                  <span className="font-bold text-slate-700">{jen}:</span>
                  <input
                    disabled={!canEdit}
                    value={localConfig.kodeKelasMap?.[jen] || ''}
                    onChange={(e) => {
                      setLocalConfig({
                        ...localConfig,
                        kodeKelasMap: { ...(localConfig.kodeKelasMap || {}), [jen]: e.target.value },
                      });
                      setHasUnsavedEdits(true);
                    }}
                    className="w-12 px-1.5 py-0.5 border border-slate-300 rounded bg-white font-mono text-center"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Barcode, Link Manual & Nomor Meja Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Pengaturan Barcode, Alamat Link Manual & Nomor Meja
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Unggah gambar barcode sendiri atau tulis alamat link ujian secara manual, lalu pratinjau langsung tampilan kartu lengkapnya.
            </p>
          </div>
          {canEdit && (
            <button
              onClick={handleSaveManualEdits}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg cursor-pointer whitespace-nowrap ${
                hasUnsavedEdits
                  ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                  : 'bg-slate-800 hover:bg-slate-900 text-white'
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              {hasUnsavedEdits ? 'Simpan Perubahan*' : 'Simpan Pengaturan & Data'}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 text-xs">
          {/* Column 1: Mode & Upload Barcode Global */}
          <div className="space-y-3 p-4 rounded-xl border border-slate-200 bg-slate-50/70">
            <div>
              <label className="block font-bold text-slate-800 mb-1.5">Mode Tampilan Kode pada Nomor</label>
              <select
                aria-label="Mode Tampilan Barcode"
                disabled={!canEdit}
                value={localConfig.barcodeMode || 'auto'}
                onChange={(e) => {
                  setLocalConfig({
                    ...localConfig,
                    barcodeMode: e.target.value as NumberingConfig['barcodeMode'],
                  });
                  setHasUnsavedEdits(true);
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-semibold"
              >
                <option value="auto">Barcode Otomatis dari Nomor Peserta</option>
                <option value="uploaded">Gunakan Gambar Barcode yang Diupload</option>
                <option value="link_qr">QR Code Otomatis dari Alamat Link</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Upload Gambar Barcode (Bawaan Semua Kartu)
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-300 bg-white hover:bg-slate-100 rounded-lg font-semibold text-slate-700 cursor-pointer">
                  <Upload className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Pilih Gambar Barcode</span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={!canEdit}
                    onChange={handleGlobalBarcodeUpload}
                    className="hidden"
                  />
                </label>
                {localConfig.uploadedBarcodeUrl && canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      setLocalConfig({
                        ...localConfig,
                        uploadedBarcodeUrl: undefined,
                        barcodeMode: localConfig.barcodeMode === 'uploaded' ? 'auto' : localConfig.barcodeMode,
                      });
                      setHasUnsavedEdits(true);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-2 text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg font-semibold cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Hapus
                  </button>
                )}
              </div>
              {localConfig.uploadedBarcodeUrl && (
                <div className="mt-2 p-2 bg-white border border-slate-200 rounded-lg inline-block">
                  <img
                    src={localConfig.uploadedBarcodeUrl}
                    alt="Preview Barcode Upload"
                    className="h-12 max-w-[180px] object-contain"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Column 2: Manual Link & Desk Number Options */}
          <div className="space-y-3 p-4 rounded-xl border border-slate-200 bg-slate-50/70">
            <div>
              <label className="block font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-emerald-700" />
                Alamat Link Manual (Opsional)
              </label>
              <input
                disabled={!canEdit}
                value={localConfig.manualLinkUrl || ''}
                onChange={(e) => {
                  setLocalConfig({ ...localConfig, manualLinkUrl: e.target.value });
                  setHasUnsavedEdits(true);
                }}
                placeholder="Contoh: https://cbt.madrasah.sch.id/ujian"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-mono text-xs"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Alamat link ini tampil di kartu nomor peserta, label meja, dan daftar nomor ujian.
              </p>
            </div>

            <div className="pt-1 flex flex-col gap-2">
              <label className="inline-flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!canEdit}
                  checked={localConfig.showDeskNumber ?? true}
                  onChange={(e) => {
                    setLocalConfig({ ...localConfig, showDeskNumber: e.target.checked });
                    setHasUnsavedEdits(true);
                  }}
                  className="rounded border-slate-300 text-emerald-700"
                />
                Tampilkan Nomor Meja di Kartu & Daftar
              </label>

              {canEdit && (
                <button
                  type="button"
                  onClick={handleAutoFillDeskNumbers}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg cursor-pointer"
                >
                  <Hash className="w-3.5 h-3.5" /> Isi Nomor Meja Otomatis (01, 02, ...)
                </button>
              )}
            </div>
          </div>

          {/* Column 3: Live Mini Preview on Number Card */}
          <div className="p-4 rounded-xl border-2 border-emerald-800 bg-white flex flex-col justify-between">
            <div className="border-b border-slate-200 pb-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase text-slate-500">
                  Pratinjau Kartu Nomor & Meja Lengkap
                </p>
                <p className="text-xs font-bold text-slate-900 mt-0.5 truncate">
                  {sampleStudent?.nama || 'Nama Peserta'}
                </p>
              </div>
              {(localConfig.showDeskNumber ?? true) && (
                <div className="bg-emerald-800 text-white px-2.5 py-1 rounded font-mono font-extrabold text-xs shrink-0">
                  MEJA {String(sampleStudent?.nomorMeja || 1).padStart(2, '0')}
                </div>
              )}
            </div>

            <div className="my-2.5 flex items-center justify-between gap-3">
              <div className="space-y-0.5 min-w-0 flex-1 text-[11px]">
                <p className="font-mono font-extrabold text-sm text-emerald-900">
                  {sampleStudent?.nomorPeserta || previewSample}
                </p>
                <p className="text-slate-700 font-semibold">
                  NIS/NISN: <span className="font-mono">{sampleStudent?.nis || '-'} / {sampleStudent?.nisn || '-'}</span>
                </p>
                <p className="text-slate-700">
                  TTL: {sampleStudent?.tempatLahir || '-'}, {sampleStudent ? formatIndonesianDate(sampleStudent.tanggalLahir) : '-'}
                </p>
                <p className="text-slate-800 font-semibold">
                  Kelas {sampleStudent?.kelas || '-'} • {sampleRoom?.namaRuang || 'Belum Diatur'}
                  {examConfig.moda === 'online' && sampleStudent?.sesi ? ` (Sesi ${sampleStudent.sesi})` : ''}
                </p>
                {(sampleStudent?.customLink || localConfig.manualLinkUrl) && (
                  <p className="text-[10px] font-mono text-blue-800 break-all bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded mt-1">
                    {sampleStudent?.customLink || localConfig.manualLinkUrl}
                  </p>
                )}
              </div>
              <div className="shrink-0">{renderSampleVisualCode(sampleStudent)}</div>
            </div>

            <p className="text-[10px] text-slate-400 border-t border-slate-100 pt-1.5">
              Seluruh data identitas ini tampil di Kartu Peserta, Label Nomor Meja, dan Daftar Nomor Ujian.
            </p>
          </div>
        </div>
      </div>

      {/* Full Interactive Complete Exam Data Table */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Hash className="w-4 h-4 text-emerald-700" />
              Data Lengkap Nomor Ujian, Meja, Ruang, Barcode & Link ({activeOrderedStudents.length})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Menampilkan data lengkap peserta ujian (Nomor Peserta, Meja, Ruang/Sesi, NIS/NISN, Nama, TTL, Kelas, Barcode, dan Alamat Link).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama / nomor / NISN..."
                className="pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg bg-white"
              />
            </div>
            <select
              value={filterKelas}
              onChange={(e) => setFilterKelas(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-semibold"
            >
              <option value="all">Semua Kelas</option>
              {distinctClasses.map((k) => (
                <option key={k} value={k}>Kelas {k}</option>
              ))}
            </select>
            <select
              value={filterRuang}
              onChange={(e) => setFilterRuang(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-semibold"
            >
              <option value="all">Semua Ruang</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>{r.namaRuang}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                <th className="px-2.5 py-2.5 text-center w-10">No</th>
                <th className="px-3 py-2.5 text-left w-36">Nomor Peserta</th>
                <th className="px-2.5 py-2.5 text-center w-24">No. Meja</th>
                <th className="px-2.5 py-2.5 text-left w-28">Ruang & Sesi</th>
                <th className="px-2.5 py-2.5 text-left w-20">Kelas</th>
                <th className="px-3 py-2.5 text-left min-w-[210px]">Nama Lengkap, NIS/NISN & TTL</th>
                <th className="px-3 py-2.5 text-left min-w-[175px]">Barcode Gambar</th>
                <th className="px-3 py-2.5 text-left min-w-[190px]">Alamat Link Manual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeOrderedStudents.map((st, idx) => {
                const effectiveBarcode = st.barcodeUrl || localConfig.uploadedBarcodeUrl;
                const room = st.ruangId ? roomMap.get(st.ruangId) : undefined;
                return (
                  <tr key={st.id} className="hover:bg-slate-50/70">
                    <td className="px-2.5 py-2 text-center text-slate-500 tabular-nums">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <input
                        disabled={!canEdit}
                        value={st.nomorPeserta || ''}
                        onChange={(e) => updateStudentField(st.id, { nomorPeserta: e.target.value })}
                        placeholder="26-01-001"
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono font-bold text-emerald-900 bg-white"
                      />
                    </td>
                    <td className="px-2.5 py-2 text-center">
                      <input
                        type="number"
                        min={1}
                        disabled={!canEdit}
                        value={st.nomorMeja ?? ''}
                        onChange={(e) =>
                          updateStudentField(st.id, {
                            nomorMeja: e.target.value ? Math.max(1, Number(e.target.value)) : undefined,
                          })
                        }
                        placeholder="01"
                        className="w-16 px-2 py-1.5 border border-slate-300 rounded font-mono font-bold text-center tabular-nums bg-white"
                      />
                    </td>
                    <td className="px-2.5 py-2">
                      <div className="font-semibold text-slate-900">{room ? room.namaRuang : '-'}</div>
                      {examConfig.moda === 'online' && (
                        <div className="text-[11px] font-mono text-emerald-800">
                          {st.sesi ? `Sesi ${st.sesi}` : 'Belum ada sesi'}
                        </div>
                      )}
                    </td>
                    <td className="px-2.5 py-2 font-semibold text-slate-800">
                      <div>{st.kelas}</div>
                      <div className="text-[11px] text-slate-500">{st.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan'}</div>
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-bold text-slate-900">{st.nama}</p>
                      <p className="text-[11px] font-mono text-slate-500">
                        NIS: {st.nis} | NISN: {st.nisn}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {st.tempatLahir}, {formatIndonesianDate(st.tanggalLahir)}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {st.barcodeUrl ? (
                          <img
                            src={st.barcodeUrl}
                            alt={`Barcode ${st.nama}`}
                            className="h-8 max-w-[80px] object-contain border border-emerald-300 bg-white rounded px-1"
                          />
                        ) : effectiveBarcode && localConfig.barcodeMode === 'uploaded' ? (
                          <span className="text-[11px] text-emerald-700 font-semibold">Barcode Global</span>
                        ) : (
                          <span className="text-[11px] text-slate-400">Otomatis</span>
                        )}
                        {canEdit && (
                          <label className="px-2 py-1 border border-slate-300 bg-white hover:bg-slate-100 rounded text-[11px] font-semibold cursor-pointer whitespace-nowrap">
                            Upload
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleStudentBarcodeUpload(st.id, e)}
                              className="hidden"
                            />
                          </label>
                        )}
                        {st.barcodeUrl && canEdit && (
                          <button
                            type="button"
                            onClick={() => updateStudentField(st.id, { barcodeUrl: undefined })}
                            className="p-1 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                            title="Hapus barcode khusus peserta"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        disabled={!canEdit}
                        value={st.customLink || ''}
                        onChange={(e) => updateStudentField(st.id, { customLink: e.target.value })}
                        placeholder={localConfig.manualLinkUrl || 'https://... (opsional)'}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono text-[11px] bg-white"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* History Log */}
      <div className="bg-white p-5 rounded-xl border border-slate-200">
        <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
          <History className="w-4 h-4 text-slate-600" /> Riwayat Perubahan Penomoran
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <th className="px-3 py-2 text-left">Waktu</th>
                <th className="px-3 py-2 text-left">Pelaksana</th>
                <th className="px-3 py-2 text-left">Contoh Format</th>
                <th className="px-3 py-2 text-center">Jumlah</th>
                <th className="px-3 py-2 text-left">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.map((h) => (
                <tr key={h.id}>
                  <td className="px-3 py-2 font-mono text-slate-500">
                    {new Date(h.timestamp).toLocaleString('id-ID')}
                  </td>
                  <td className="px-3 py-2 font-semibold text-slate-800">{h.actor}</td>
                  <td className="px-3 py-2 font-mono text-emerald-800">{h.formatPreview}</td>
                  <td className="px-3 py-2 text-center font-bold tabular-nums">{h.totalGenerated}</td>
                  <td className="px-3 py-2 text-slate-600">{h.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-5 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Konfirmasi Penomoran Ulang Peserta</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Tindakan ini akan memperbarui nomor peserta aktif sesuai konfigurasi baru sambil mempertahankan nomor meja, barcode upload, dan alamat link manual peserta.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmModalOpen(false)}
                className="px-3 py-2 text-xs font-semibold bg-slate-100 rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => executeGenerate(true)}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
              >
                Ya, Generate & Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
