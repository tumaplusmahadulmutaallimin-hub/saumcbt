import React, { useMemo, useRef, useState } from 'react';
import {
  Upload,
  Download,
  FileSpreadsheet,
  Search,
  Plus,
  Edit2,
  Trash2,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  X,
} from 'lucide-react';
import { ExamConfig, ExamRoom, JenisKelamin, StatusPeserta, Student } from '../../types';
import {
  DnpuHeaderMapping,
  DnpuValidationRow,
  detectHeaderMapping,
  downloadDnpuExcelTemplate,
  exportStudentsToExcel,
  extractJenjang,
  parseSpreadsheetBuffer,
  revalidateEditedDnpuRows,
  validateDnpuRows,
} from '../../utils/dnpu';

interface DnpuViewProps {
  students: Student[];
  rooms: ExamRoom[];
  examConfig: ExamConfig;
  canEdit: boolean;
  onSaveStudents: (students: Student[], backupReason?: string) => Promise<void>;
  onToggleFinalize: (finalized: boolean) => Promise<void>;
}

export const DnpuView: React.FC<DnpuViewProps> = ({
  students,
  rooms,
  examConfig,
  canEdit,
  onSaveStudents,
  onToggleFinalize,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [filterKelas, setFilterKelas] = useState('all');
  const [filterJenjang, setFilterJenjang] = useState('all');
  const [filterRuang, setFilterRuang] = useState('all');
  const [filterSesi, setFilterSesi] = useState('all');

  // Import Wizard State
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importRawRows, setImportRawRows] = useState<Record<string, string>[]>([]);
  const [headerMapping, setHeaderMapping] = useState<DnpuHeaderMapping | null>(null);
  const [replaceMode, setReplaceMode] = useState(false);
  const [previewRows, setPreviewRows] = useState<DnpuValidationRow[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);

  // Add/Edit Student Modal
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isAddMode, setIsAddMode] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [errorBanner, setErrorBanner] = useState('');

  const roomMap = new Map(rooms.map((r) => [r.id, r]));

  const distinctClasses = useMemo(
    () => Array.from(new Set(students.map((s) => s.kelas).filter(Boolean))).sort(),
    [students]
  );
  const distinctJenjang = useMemo(
    () => Array.from(new Set(students.map((s) => s.jenjang || extractJenjang(s.kelas)))).sort(),
    [students]
  );

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      if (q && !s.nama.toLowerCase().includes(q) && !s.nisn.includes(q) && !s.nis.includes(q) && !(s.nomorPeserta || '').toLowerCase().includes(q)) {
        return false;
      }
      if (filterKelas !== 'all' && s.kelas !== filterKelas) return false;
      const jen = s.jenjang || extractJenjang(s.kelas);
      if (filterJenjang !== 'all' && jen !== filterJenjang) return false;
      if (filterRuang !== 'all' && (s.ruangId || 'unassigned') !== filterRuang) return false;
      if (filterSesi !== 'all' && String(s.sesi || '') !== filterSesi) return false;
      return true;
    });
  }, [students, search, filterKelas, filterJenjang, filterRuang, filterSesi]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorBanner('');
    try {
      const buffer = await file.arrayBuffer();
      const { headers, rows } = parseSpreadsheetBuffer(buffer);
      if (headers.length === 0 || rows.length === 0) {
        setErrorBanner('File kosong atau tidak memiliki baris data yang valid.');
        return;
      }
      const detected = detectHeaderMapping(headers);
      setImportHeaders(headers);
      setImportRawRows(rows);
      setHeaderMapping(detected);
      const validated = validateDnpuRows(
        rows,
        detected,
        examConfig.registeredClasses,
        students,
        replaceMode
      );
      setPreviewRows(validated);
      setShowImportModal(true);
    } catch (err) {
      setErrorBanner(`Gagal membaca file: ${err instanceof Error ? err.message : 'Format tidak valid'}`);
    } finally {
      e.target.value = '';
    }
  };

  const handleMappingChange = (field: keyof DnpuHeaderMapping, value: string) => {
    if (!headerMapping) return;
    const nextMap = { ...headerMapping, [field]: value };
    setHeaderMapping(nextMap);
    setPreviewRows(
      validateDnpuRows(importRawRows, nextMap, examConfig.registeredClasses, students, replaceMode)
    );
  };

  const handleReplaceModeToggle = (nextReplace: boolean) => {
    setReplaceMode(nextReplace);
    if (headerMapping) {
      setPreviewRows(
        validateDnpuRows(importRawRows, headerMapping, examConfig.registeredClasses, students, nextReplace)
      );
    }
  };

  const handleInlinePreviewEdit = (idx: number, field: keyof DnpuValidationRow, value: string) => {
    const updated = [...previewRows];
    updated[idx] = { ...updated[idx], [field]: value };
    setPreviewRows(
      revalidateEditedDnpuRows(updated, examConfig.registeredClasses, students, replaceMode)
    );
  };

  const handleCommitImport = async () => {
    const invalidCount = previewRows.filter((r) => !r.isValid).length;
    if (invalidCount > 0) {
      setErrorBanner(`Masih ada ${invalidCount} baris bermasalah. Perbaiki inline atau hapus baris error sebelum menyimpan.`);
      return;
    }

    const newStudents: Student[] = previewRows.map((r, i) => ({
      id: `st-imp-${Date.now()}-${i}`,
      nisn: r.nisn,
      nis: r.nis,
      nama: r.nama,
      jenisKelamin: r.jenisKelamin,
      kelas: r.kelas,
      jenjang: extractJenjang(r.kelas),
      tempatLahir: r.tempatLahir || '-',
      tanggalLahir: r.tanggalLahir || '',
      nomorPeserta: '',
      status: 'Aktif',
    }));

    const finalList = replaceMode ? newStudents : [...students, ...newStudents];
    try {
      await onSaveStudents(finalList, replaceMode ? 'replace-dnpu-import' : 'append-dnpu-import');
      setShowImportModal(false);
      setPreviewRows([]);
      setErrorBanner('');
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Gagal menyimpan impor DNPU');
    }
  };

  const handleSaveManualStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    const normalized: Student = {
      ...editingStudent,
      jenjang: extractJenjang(editingStudent.kelas),
    };
    const nextList = isAddMode
      ? [...students, normalized]
      : students.map((s) => (s.id === normalized.id ? normalized : s));
    try {
      await onSaveStudents(nextList);
      setEditingStudent(null);
      setErrorBanner('');
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Gagal menyimpan peserta');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    await onSaveStudents(students.filter((s) => s.id !== deleteTarget.id), 'delete-student');
    setDeleteTarget(null);
  };

  const invalidPreviewCount = previewRows.filter((r) => !r.isValid).length;

  return (
    <div className="space-y-5">
      {/* Header Controls */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold text-slate-900">Data Nominasi Peserta Ujian (DNPU)</h2>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded border ${
                examConfig.isDnpuFinalized
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}
            >
              {examConfig.isDnpuFinalized ? 'Terfinalisasi' : 'Draft'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Total {students.length} peserta • Impor Excel (.xlsx/.xls) / CSV dengan pengecekan NISN/NIS ganda & leading zero otomatis.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => downloadDnpuExcelTemplate()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" /> Template Excel
          </button>

          <button
            onClick={() => exportStudentsToExcel(filteredStudents, examConfig.moda === 'online')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer whitespace-nowrap"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" /> Export Excel
          </button>

          {canEdit && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-lg cursor-pointer whitespace-nowrap"
              >
                <Upload className="w-3.5 h-3.5" /> Import Excel / CSV
              </button>

              <button
                onClick={() => {
                  setIsAddMode(true);
                  setEditingStudent({
                    id: `st-${Date.now()}`,
                    nisn: '',
                    nis: '',
                    nama: '',
                    tempatLahir: 'Bandung',
                    tanggalLahir: '2010-01-01',
                    jenisKelamin: 'L',
                    kelas: examConfig.registeredClasses[0] || 'X-A',
                    nomorPeserta: '',
                    status: 'Aktif',
                  });
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Peserta
              </button>

              <button
                onClick={() => onToggleFinalize(!examConfig.isDnpuFinalized)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border cursor-pointer whitespace-nowrap ${
                  examConfig.isDnpuFinalized
                    ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    : 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                }`}
              >
                {examConfig.isDnpuFinalized ? (
                  <>
                    <Unlock className="w-3.5 h-3.5" /> Buka Finalisasi
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" /> Finalisasi DNPU
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {errorBanner && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl text-xs font-semibold flex items-center justify-between">
          <span>{errorBanner}</span>
          <button onClick={() => setErrorBanner('')} className="text-red-600 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap items-center gap-3 text-xs">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cari Nama, NISN, NIS, atau Nomor Peserta..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:border-emerald-700"
          />
        </div>

        <select
          value={filterJenjang}
          onChange={(e) => setFilterJenjang(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg bg-white font-semibold"
        >
          <option value="all">Semua Jenjang</option>
          {distinctJenjang.map((j) => (
            <option key={j} value={j}>Jenjang {j}</option>
          ))}
        </select>

        <select
          value={filterKelas}
          onChange={(e) => setFilterKelas(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg bg-white font-semibold"
        >
          <option value="all">Semua Kelas</option>
          {distinctClasses.map((k) => (
            <option key={k} value={k}>Kelas {k}</option>
          ))}
        </select>

        <select
          value={filterRuang}
          onChange={(e) => setFilterRuang(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg bg-white font-semibold"
        >
          <option value="all">Semua Ruang</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>{r.namaRuang}</option>
          ))}
          <option value="unassigned">Belum Ada Ruang</option>
        </select>

        {examConfig.moda === 'online' && (
          <select
            value={filterSesi}
            onChange={(e) => setFilterSesi(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg bg-white font-semibold"
          >
            <option value="all">Semua Sesi</option>
            {Array.from({ length: examConfig.jumlahSesi }, (_, i) => i + 1).map((s) => (
              <option key={s} value={String(s)}>Sesi {s}</option>
            ))}
          </select>
        )}
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <th className="px-3 py-3 w-10 text-center">No</th>
                <th className="px-3 py-3">NISN</th>
                <th className="px-3 py-3">NIS</th>
                <th className="px-3 py-3">Nama Lengkap</th>
                <th className="px-3 py-3 text-center">JK</th>
                <th className="px-3 py-3">Kelas</th>
                <th className="px-3 py-3">No. Peserta</th>
                {examConfig.moda === 'online' && <th className="px-3 py-3 text-center">Sesi</th>}
                <th className="px-3 py-3">Ruang / Meja</th>
                <th className="px-3 py-3 text-center">Status</th>
                {canEdit && <th className="px-3 py-3 text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-slate-400">
                    Tidak ada peserta yang sesuai filter pencarian.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((st, idx) => {
                  const room = st.ruangId ? roomMap.get(st.ruangId) : undefined;
                  return (
                    <tr key={st.id} className="hover:bg-slate-50/70">
                      <td className="px-3 py-2.5 text-center text-slate-500 tabular-nums">{idx + 1}</td>
                      <td className="px-3 py-2.5 font-mono tabular-nums text-slate-800">{st.nisn}</td>
                      <td className="px-3 py-2.5 font-mono tabular-nums text-slate-600">{st.nis}</td>
                      <td className="px-3 py-2.5 font-semibold text-slate-900">{st.nama}</td>
                      <td className="px-3 py-2.5 text-center font-semibold">{st.jenisKelamin}</td>
                      <td className="px-3 py-2.5 font-semibold text-slate-800">{st.kelas}</td>
                      <td className="px-3 py-2.5 font-mono font-bold text-emerald-800 tabular-nums">
                        {st.nomorPeserta || '-'}
                      </td>
                      {examConfig.moda === 'online' && (
                        <td className="px-3 py-2.5 text-center font-semibold tabular-nums">
                          {st.sesi ? `Sesi ${st.sesi}` : '-'}
                        </td>
                      )}
                      <td className="px-3 py-2.5 text-slate-700 tabular-nums">
                        {room ? `${room.namaRuang} • #${String(st.nomorMeja || '-').padStart(2, '0')}` : '-'}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span
                          className={`text-[11px] font-semibold ${
                            st.status === 'Aktif' ? 'text-emerald-700' : 'text-slate-400'
                          }`}
                        >
                          {st.status}
                        </span>
                      </td>
                      {canEdit && (
                        <td className="px-3 py-2.5 text-right whitespace-nowrap space-x-1">
                          <button
                            onClick={() => {
                              setIsAddMode(false);
                              setEditingStudent({ ...st });
                            }}
                            className="p-1.5 text-slate-500 hover:text-emerald-700 cursor-pointer"
                            title="Edit Peserta"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(st)}
                            className="p-1.5 text-slate-500 hover:text-red-600 cursor-pointer"
                            title="Hapus Peserta"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Excel / CSV Import Validation Modal with Inline Fix */}
      {showImportModal && headerMapping && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-5xl w-full max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Pratinjau & Validasi Impor DNPU</h3>
                <p className="text-xs text-slate-500">
                  {previewRows.length} baris dibaca •{' '}
                  <span className={invalidPreviewCount > 0 ? 'text-red-600 font-bold' : 'text-emerald-700 font-bold'}>
                    {invalidPreviewCount > 0 ? `${invalidPreviewCount} baris error (perbaiki langsung di tabel)` : 'Semua baris valid'}
                  </span>
                </p>
              </div>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-slate-200 bg-slate-50 space-y-3 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {(['nisn', 'nis', 'nama', 'jk', 'kelas'] as const).map((field) => (
                  <div key={field}>
                    <label className="block font-bold uppercase text-[10px] text-slate-600 mb-1">
                      Kolom {field}
                    </label>
                    <select
                      value={headerMapping[field]}
                      onChange={(e) => handleMappingChange(field, e.target.value)}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white"
                    >
                      <option value="">-- Pilih Kolom --</option>
                      {importHeaders.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <label className="inline-flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={replaceMode}
                  onChange={(e) => handleReplaceModeToggle(e.target.checked)}
                />
                Ganti seluruh data DNPU saat ini dengan file impor ini (Reset & Import Ulang)
              </label>
            </div>

            <div className="flex-1 overflow-auto p-4">
              <table className="w-full text-xs border-collapse border border-slate-200">
                <thead>
                  <tr className="bg-slate-100 font-bold text-slate-700">
                    <th className="border border-slate-200 px-2 py-1.5 w-14 text-center">Baris</th>
                    <th className="border border-slate-200 px-2 py-1.5">NISN</th>
                    <th className="border border-slate-200 px-2 py-1.5">NIS</th>
                    <th className="border border-slate-200 px-2 py-1.5">Nama</th>
                    <th className="border border-slate-200 px-2 py-1.5 w-14">JK</th>
                    <th className="border border-slate-200 px-2 py-1.5 w-20">Kelas</th>
                    <th className="border border-slate-200 px-2 py-1.5">Status Validasi</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, idx) => (
                    <tr key={idx} className={row.isValid ? 'bg-white' : 'bg-red-50/70'}>
                      <td className="border border-slate-200 px-2 py-1 text-center font-mono">{row.rowNumber}</td>
                      <td className="border border-slate-200 px-1 py-1">
                        <input
                          value={row.nisn}
                          onChange={(e) => handleInlinePreviewEdit(idx, 'nisn', e.target.value)}
                          className="w-full px-1.5 py-0.5 font-mono border border-slate-200 rounded bg-white"
                        />
                      </td>
                      <td className="border border-slate-200 px-1 py-1">
                        <input
                          value={row.nis}
                          onChange={(e) => handleInlinePreviewEdit(idx, 'nis', e.target.value)}
                          className="w-full px-1.5 py-0.5 font-mono border border-slate-200 rounded bg-white"
                        />
                      </td>
                      <td className="border border-slate-200 px-1 py-1">
                        <input
                          value={row.nama}
                          onChange={(e) => handleInlinePreviewEdit(idx, 'nama', e.target.value)}
                          className="w-full px-1.5 py-0.5 border border-slate-200 rounded bg-white"
                        />
                      </td>
                      <td className="border border-slate-200 px-1 py-1">
                        <select
                          value={row.jenisKelamin}
                          onChange={(e) => handleInlinePreviewEdit(idx, 'jenisKelamin', e.target.value)}
                          className="w-full px-1 py-0.5 border border-slate-200 rounded bg-white"
                        >
                          <option value="L">L</option>
                          <option value="P">P</option>
                        </select>
                      </td>
                      <td className="border border-slate-200 px-1 py-1">
                        <input
                          value={row.kelas}
                          onChange={(e) => handleInlinePreviewEdit(idx, 'kelas', e.target.value.toUpperCase())}
                          className="w-full px-1.5 py-0.5 border border-slate-200 rounded bg-white"
                        />
                      </td>
                      <td className="border border-slate-200 px-2 py-1">
                        {row.errors.length > 0 ? (
                          <div className="text-red-700 font-semibold flex items-start gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span>{row.errors.join('; ')}</span>
                          </div>
                        ) : row.warnings.length > 0 ? (
                          <span className="text-amber-700">{row.warnings.join('; ')}</span>
                        ) : (
                          <span className="text-emerald-700 font-semibold inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Valid
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleCommitImport}
                disabled={invalidPreviewCount > 0}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer disabled:opacity-50"
              >
                Simpan {previewRows.length} Peserta ke DNPU
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Single Student Modal */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveManualStudent}
            className="bg-white rounded-xl border border-slate-200 max-w-lg w-full p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {isAddMode ? 'Tambah Peserta Ujian Manual' : 'Edit Data Peserta'}
              </h3>
              <button type="button" onClick={() => setEditingStudent(null)} className="text-slate-400 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">NISN *</label>
                <input
                  required
                  value={editingStudent.nisn}
                  onChange={(e) => setEditingStudent({ ...editingStudent, nisn: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">NIS *</label>
                <input
                  required
                  value={editingStudent.nis}
                  onChange={(e) => setEditingStudent({ ...editingStudent, nis: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div className="col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Nama Lengkap *</label>
                <input
                  required
                  value={editingStudent.nama}
                  onChange={(e) => setEditingStudent({ ...editingStudent, nama: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Jenis Kelamin</label>
                <select
                  value={editingStudent.jenisKelamin}
                  onChange={(e) =>
                    setEditingStudent({ ...editingStudent, jenisKelamin: e.target.value as JenisKelamin })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="L">Laki-laki (L)</option>
                  <option value="P">Perempuan (P)</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kelas *</label>
                <input
                  required
                  value={editingStudent.kelas}
                  onChange={(e) => setEditingStudent({ ...editingStudent, kelas: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Status</label>
                <select
                  value={editingStudent.status}
                  onChange={(e) =>
                    setEditingStudent({ ...editingStudent, status: e.target.value as StatusPeserta })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="Aktif">Aktif</option>
                  <option value="Cadangan">Cadangan</option>
                  <option value="Nonaktif">Nonaktif</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">No. Peserta</label>
                <input
                  value={editingStudent.nomorPeserta}
                  onChange={(e) => setEditingStudent({ ...editingStudent, nomorPeserta: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
              >
                Simpan Peserta
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-sm w-full p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Hapus Data Peserta?</h3>
            <p className="text-xs text-slate-600">
              Peserta <strong>{deleteTarget.nama}</strong> ({deleteTarget.kelas}) akan dihapus dari DNPU.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-100 rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-3 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
