import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Armchair,
  CheckCircle2,
  FileSpreadsheet,
  Hash,
  Printer,
  Save,
  Search,
} from 'lucide-react';
import {
  ExamConfig,
  ExamRoom,
  MadrasahProfile,
  NumberingConfig,
  PaperPreset,
  Student,
} from '../../types';
import { compareClasses } from '../../utils/numbering';
import { NomorMejaCetak, NomorMejaPrintStyle } from '../documents/NomorMejaCetak';
import { PrintToolbar } from '../documents/PrintToolbar';

interface NomorMejaViewProps {
  profile: MadrasahProfile;
  examConfig: ExamConfig;
  students: Student[];
  rooms: ExamRoom[];
  numberingConfig: NumberingConfig;
  kursiPerMeja?: number;
  paperPreset?: PaperPreset;
  canEdit: boolean;
  onSaveDeskNumbers: (students: Student[]) => Promise<void>;
}

export const NomorMejaView: React.FC<NomorMejaViewProps> = ({
  profile,
  examConfig,
  students,
  rooms,
  numberingConfig,
  kursiPerMeja = 2,
  paperPreset,
  canEdit,
  onSaveDeskNumbers,
}) => {
  const [localStudents, setLocalStudents] = useState<Student[]>(students);
  const [filterRuang, setFilterRuang] = useState<string>('all');
  const [filterSesi, setFilterSesi] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [printStyle, setPrintStyle] = useState<NomorMejaPrintStyle>('label_lengkap');
  const [deskRatio, setDeskRatio] = useState<number>(kursiPerMeja === 1 ? 1 : 2);
  const [showPrintMode, setShowPrintMode] = useState<boolean>(false);
  const [hasUnsaved, setHasUnsaved] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [notice, setNotice] = useState<string>('');

  useEffect(() => {
    setLocalStudents(students);
    setHasUnsaved(false);
  }, [students]);

  const isOnline = examConfig.moda === 'online';
  const roomMap = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);

  const filteredStudents = useMemo(() => {
    return localStudents
      .filter((s) => s.status === 'Aktif')
      .filter((s) => filterRuang === 'all' || s.ruangId === filterRuang)
      .filter((s) => !isOnline || filterSesi === 0 || (s.sesi || 1) === filterSesi)
      .filter((s) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          s.nama.toLowerCase().includes(q) ||
          (s.nomorPeserta || '').toLowerCase().includes(q) ||
          s.kelas.toLowerCase().includes(q) ||
          String(s.nomorMeja || '').includes(q)
        );
      })
      .sort((a, b) => {
        const rA = a.ruangId || 'ZZZ';
        const rB = b.ruangId || 'ZZZ';
        if (rA !== rB) return rA.localeCompare(rB);
        if (isOnline && (a.sesi || 1) !== (b.sesi || 1)) return (a.sesi || 1) - (b.sesi || 1);
        const npA = a.nomorPeserta || '';
        const npB = b.nomorPeserta || '';
        if (npA !== npB) return npA.localeCompare(npB, 'id');
        const c = compareClasses(a.kelas, b.kelas, numberingConfig.urutanKelas);
        if (c !== 0) return c;
        return a.nama.localeCompare(b.nama, 'id');
      });
  }, [localStudents, filterRuang, filterSesi, searchQuery, isOnline, numberingConfig.urutanKelas]);

  const sortedByDesk = useMemo(() => {
    return [...filteredStudents].sort((a, b) => {
      const rA = a.ruangId || 'ZZZ';
      const rB = b.ruangId || 'ZZZ';
      if (rA !== rB) return rA.localeCompare(rB);
      if (isOnline && (a.sesi || 1) !== (b.sesi || 1)) return (a.sesi || 1) - (b.sesi || 1);
      const mA = a.nomorMeja || 9999;
      const mB = b.nomorMeja || 9999;
      if (mA !== mB) return mA - mB;
      return a.nama.localeCompare(b.nama, 'id');
    });
  }, [filteredStudents, isOnline]);

  const missingDeskCount = useMemo(
    () => localStudents.filter((s) => s.status === 'Aktif' && !s.nomorMeja).length,
    [localStudents]
  );

  const handleAutoAssignDeskNumbers = () => {
    const active = localStudents
      .filter((s) => s.status === 'Aktif')
      .sort((a, b) => {
        const roomA = a.ruangId || 'ZZZ';
        const roomB = b.ruangId || 'ZZZ';
        if (roomA !== roomB) return roomA.localeCompare(roomB);
        if (isOnline && (a.sesi || 1) !== (b.sesi || 1)) return (a.sesi || 1) - (b.sesi || 1);
        return (a.nomorPeserta || a.nama).localeCompare(b.nomorPeserta || b.nama, 'id');
      });

    const counters = new Map<string, number>();
    const seatMap = new Map<string, number>();
    for (const st of active) {
      const key = isOnline ? `${st.ruangId || 'GLOBAL'}_S${st.sesi || 1}` : st.ruangId || 'GLOBAL';
      const next = (counters.get(key) || 0) + 1;
      counters.set(key, next);
      seatMap.set(st.id, next);
    }

    setLocalStudents((prev) =>
      prev.map((st) => ({
        ...st,
        nomorMeja: seatMap.get(st.id) ?? st.nomorMeja,
      }))
    );
    setHasUnsaved(true);
    setNotice('Nomor kursi & meja berhasil diisi otomatis per ruang/sesi. Klik "Simpan Nomor Meja" untuk menyimpan.');
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveDeskNumbers(localStudents);
      setHasUnsaved(false);
      setNotice('Penomoran meja & kursi peserta berhasil disimpan ke database.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportExcel = () => {
    const rows = sortedByDesk.map((st, idx) => {
      const room = st.ruangId ? roomMap.get(st.ruangId) : undefined;
      const seatNo = st.nomorMeja || idx + 1;
      const mejaFisik = deskRatio === 2 ? Math.ceil(seatNo / 2) : seatNo;
      return {
        No: idx + 1,
        'No. Kursi': `KURSI ${String(seatNo).padStart(2, '0')}`,
        'Meja Fisik': `MEJA ${String(mejaFisik).padStart(2, '0')}`,
        Ruang: room ? room.namaRuang : '-',
        Sesi: isOnline ? `Sesi ${st.sesi || 1}` : '-',
        'Nomor Peserta': st.nomorPeserta || '-',
        'Nama Lengkap': st.nama,
        Kelas: st.kelas,
      };
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Daftar_Nomor_Meja');
    XLSX.writeFile(wb, 'Daftar_Nomor_Meja_Kursi_SAUM.xlsx');
  };

  if (showPrintMode) {
    return (
      <div className="space-y-4">
        <PrintToolbar
          title={`Cetak Nomor Meja (${
            printStyle === 'berpasangan_2kursi'
              ? '1 Meja = 2 Kursi'
              : printStyle === 'kartu_angka_besar'
              ? 'Angka Besar'
              : printStyle === 'daftar_meja'
              ? 'Daftar Meja'
              : 'Label Lengkap'
          })`}
          onBack={() => setShowPrintMode(false)}
          onExportExcel={handleExportExcel}
          paperSize={paperPreset?.size || 'A4'}
          orientation="portrait"
        />
        <div className="overflow-x-auto pb-10">
          <NomorMejaCetak
            profile={profile}
            examConfig={examConfig}
            students={localStudents}
            rooms={rooms}
            numberingConfig={numberingConfig}
            selectedRoomId={filterRuang}
            selectedSesi={filterSesi}
            printStyle={printStyle}
            kursiPerMeja={deskRatio}
            paperPreset={paperPreset}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Print Controls */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Armchair className="w-5 h-5 text-emerald-700" />
              Pengaturan & Cetak Nomor Meja Ujian
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Menu khusus penomoran dan cetak stiker/label Nomor Meja per ruang (terpisah dari cetak Nomor Peserta), mendukung pola 1 Meja = 2 Kursi maupun 1 Meja = 1 Kursi.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer whitespace-nowrap"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" /> Export Excel Meja
            </button>
            {canEdit && (
              <>
                <button
                  type="button"
                  onClick={handleAutoAssignDeskNumbers}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg cursor-pointer whitespace-nowrap"
                >
                  <Hash className="w-3.5 h-3.5" /> Isi Nomor Meja Otomatis
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleSave}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg cursor-pointer whitespace-nowrap ${
                    hasUnsaved
                      ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                      : 'bg-slate-800 hover:bg-slate-900 text-white'
                  }`}
                >
                  <Save className="w-3.5 h-3.5" /> {isSaving ? 'Menyimpan...' : hasUnsaved ? 'Simpan Nomor Meja*' : 'Simpan Nomor Meja'}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setShowPrintMode(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" /> Cetak Nomor Meja
            </button>
          </div>
        </div>

        {notice && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> {notice}
          </div>
        )}

        {/* Style & Filter Controls */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Format Cetak Nomor Meja</label>
            <select
              value={printStyle}
              onChange={(e) => setPrintStyle(e.target.value as NomorMejaPrintStyle)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-semibold"
            >
              <option value="label_lengkap">Label Nomor Meja & Data Peserta (8/hal)</option>
              <option value="berpasangan_2kursi">Label Meja Berpasangan (1 Meja = 2 Kursi)</option>
              <option value="kartu_angka_besar">Kartu Angka Nomor Meja Besar (6/hal)</option>
              <option value="daftar_meja">Daftar Rekap Nomor Meja Per Ruang</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Konfigurasi Meja & Kursi</label>
            <select
              value={deskRatio}
              onChange={(e) => setDeskRatio(Number(e.target.value))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-semibold"
            >
              <option value={2}>1 Meja = 2 Kursi (Standar Madrasah)</option>
              <option value={1}>1 Meja = 1 Kursi (Meja Tunggal)</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Filter Ruang</label>
            <select
              value={filterRuang}
              onChange={(e) => setFilterRuang(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-semibold"
            >
              <option value="all">Semua Ruang ({rooms.length})</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>{r.namaRuang}</option>
              ))}
            </select>
          </div>

          {isOnline ? (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Filter Sesi (Moda Online)</label>
              <select
                value={filterSesi}
                onChange={(e) => setFilterSesi(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-semibold"
              >
                <option value={0}>Semua Sesi ({examConfig.jumlahSesi})</option>
                {Array.from({ length: examConfig.jumlahSesi }, (_, i) => i + 1).map((s) => (
                  <option key={s} value={s}>Sesi {s}</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Status Penomoran Meja</label>
              <div className="px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 font-semibold text-slate-700">
                {missingDeskCount === 0
                  ? `Lengkap (${filteredStudents.length} kursi)`
                  : `${missingDeskCount} peserta belum bernomor`}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Table Editor */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Daftar Nomor Kursi & Meja Per Ruang ({filteredStudents.length} Peserta)
            </h3>
            <p className="text-xs text-slate-500">
              {deskRatio === 2
                ? `Dengan rasio 1 Meja = 2 Kursi, ${filteredStudents.length} kursi menempati ${Math.ceil(filteredStudents.length / 2)} meja fisik.`
                : `Dengan rasio 1 Meja = 1 Kursi, ${filteredStudents.length} kursi menempati ${filteredStudents.length} meja fisik.`}
            </p>
          </div>
          <div className="relative text-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama, kelas, atau no meja..."
              className="pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg bg-white"
            />
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                <th className="px-3 py-2.5 w-10 text-center">No</th>
                <th className="px-3 py-2.5 w-28 text-center">No. Kursi</th>
                {deskRatio === 2 && <th className="px-3 py-2.5 w-24 text-center">Meja Fisik</th>}
                <th className="px-3 py-2.5">Ruang & Sesi</th>
                <th className="px-3 py-2.5">No. Peserta</th>
                <th className="px-3 py-2.5">Nama Peserta</th>
                <th className="px-3 py-2.5 text-center">Kelas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {filteredStudents.map((st, idx) => {
                const room = st.ruangId ? roomMap.get(st.ruangId) : undefined;
                const seatNo = st.nomorMeja || idx + 1;
                const mejaFisik = deskRatio === 2 ? Math.ceil(seatNo / 2) : seatNo;
                return (
                  <tr key={st.id} className="hover:bg-slate-50/70">
                    <td className="px-3 py-2 text-center text-slate-500">{idx + 1}</td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="number"
                        min={1}
                        disabled={!canEdit}
                        value={st.nomorMeja ?? ''}
                        onChange={(e) => {
                          const val = e.target.value ? Math.max(1, Number(e.target.value)) : undefined;
                          setLocalStudents((prev) =>
                            prev.map((x) => (x.id === st.id ? { ...x, nomorMeja: val } : x))
                          );
                          setHasUnsaved(true);
                        }}
                        className="w-16 px-2 py-1 border border-slate-300 rounded text-center font-mono font-bold text-emerald-900 bg-white"
                      />
                    </td>
                    {deskRatio === 2 && (
                      <td className="px-3 py-2 text-center font-mono font-bold text-slate-800">
                        MEJA {String(mejaFisik).padStart(2, '0')}
                      </td>
                    )}
                    <td className="px-3 py-2">
                      <span className="font-semibold text-slate-900">{room ? room.namaRuang : '-'}</span>
                      {isOnline && (
                        <span className="ml-1.5 text-[11px] font-mono text-emerald-800">
                          (Sesi {st.sesi || 1})
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-700">{st.nomorPeserta || '-'}</td>
                    <td className="px-3 py-2 font-bold text-slate-900">{st.nama}</td>
                    <td className="px-3 py-2 text-center font-semibold">{st.kelas}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Preview of Selected Print Style */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
          <h3 className="text-sm font-bold text-slate-900">
            Pratinjau Cetak Nomor Meja (Halaman Pertama)
          </h3>
          <button
            type="button"
            onClick={() => setShowPrintMode(true)}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" /> Buka Mode Cetak Penuh
          </button>
        </div>
        <div className="overflow-x-auto bg-slate-50 p-4 rounded-lg border border-slate-200">
          <NomorMejaCetak
            profile={profile}
            examConfig={examConfig}
            students={sortedByDesk.slice(0, 8)}
            rooms={rooms}
            numberingConfig={numberingConfig}
            selectedRoomId={filterRuang}
            selectedSesi={filterSesi}
            printStyle={printStyle}
            kursiPerMeja={deskRatio}
            paperPreset={paperPreset}
          />
        </div>
      </div>
    </div>
  );
};
