import React, { useEffect, useMemo, useState } from 'react';
import {
  PackageCheck,
  Printer,
  Save,
  Plus,
  Trash2,
  CheckCircle2,
  CopyCheck,
  FileSpreadsheet,
  Armchair,
  RefreshCw,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  CustomSupplyItem,
  DuplicationStatusEntry,
  ExamConfig,
  ExamRoom,
  ExamSchedule,
  ExamSubject,
  MadrasahProfile,
  PaperPreset,
  RekapConfig,
  SantriPhoneRecord,
  Student,
  UserAccount,
} from '../../types';
import { RekapKebutuhanCetak } from '../documents/RekapKebutuhanCetak';
import { PrintToolbar } from '../documents/PrintToolbar';
import { usePrintLayout } from '../../utils/printLayout';
import { formatDayAndDate } from '../../utils/qrBarcode';
import {
  computeEquipmentTotals,
  computeRoomDuplicationBreakdown,
  computeRoomEquipmentRows,
  generateModaAlignedSupplies,
} from '../../utils/rekap';

interface RekapViewProps {
  profile: MadrasahProfile;
  examConfig: ExamConfig;
  students: Student[];
  rooms: ExamRoom[];
  schedules: ExamSchedule[];
  subjects: ExamSubject[];
  phoneRecords?: SantriPhoneRecord[];
  rekapConfig: RekapConfig;
  currentUser: UserAccount;
  paperPreset?: PaperPreset;
  canEdit: boolean;
  onSaveRekap: (rekapConfig: RekapConfig, auditDetail?: string) => Promise<void>;
  onSavePreset?: (preset: PaperPreset) => Promise<void>;
}

export const RekapView: React.FC<RekapViewProps> = ({
  profile,
  examConfig,
  students,
  rooms,
  schedules,
  subjects,
  phoneRecords = [],
  rekapConfig,
  currentUser,
  paperPreset,
  canEdit,
  onSaveRekap,
  onSavePreset,
}) => {
  const { layout, setLayout } = usePrintLayout(paperPreset, {
    size: 'A4',
    orientation: 'portrait',
    marginMm: 10,
  });
  const [activeTab, setActiveTab] = useState<'perlengkapan' | 'penggandaan' | 'cetak'>('perlengkapan');
  const [localRekap, setLocalRekap] = useState<RekapConfig>({
    ...rekapConfig,
    kursiPerMeja: rekapConfig.kursiPerMeja === 1 ? 1 : 2,
    basisHitungKursi: rekapConfig.basisHitungKursi || 'peserta_aktif',
  });
  const [filterHari, setFilterHari] = useState<string>('all');
  const [filterRuangId, setFilterRuangId] = useState<string>('all');
  const [notice, setNotice] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const [newSupply, setNewSupply] = useState<Omit<CustomSupplyItem, 'id'>>({
    namaBarang: '',
    kategori: 'ATK & Ruang',
    kebutuhan: 1,
    tersedia: 0,
    satuan: 'pcs',
    keterangan: '',
  });

  useEffect(() => {
    setLocalRekap({
      ...rekapConfig,
      kursiPerMeja: rekapConfig.kursiPerMeja === 1 ? 1 : 2,
      basisHitungKursi: rekapConfig.basisHitungKursi || 'peserta_aktif',
    });
  }, [rekapConfig]);

  const activeStudents = useMemo(() => students.filter((s) => s.status === 'Aktif'), [students]);
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const isOnline = examConfig.moda === 'online';
  const cadangan = localRekap.cadanganPerRuang ?? 2;
  const kursiPerMeja = localRekap.kursiPerMeja === 1 ? 1 : 2;
  const basisHitungKursi = localRekap.basisHitungKursi || 'peserta_aktif';

  const roomEquipmentRows = useMemo(
    () =>
      computeRoomEquipmentRows({
        rooms,
        students,
        examConfig,
        rekapConfig: localRekap,
      }),
    [rooms, students, examConfig, localRekap]
  );

  const equipmentTotals = useMemo(
    () => computeEquipmentTotals(roomEquipmentRows),
    [roomEquipmentRows]
  );

  const distinctHari = useMemo(
    () => Array.from(new Set(schedules.map((s) => s.hari))),
    [schedules]
  );

  const duplicationRows = useMemo(() => {
    return schedules
      .filter((sc) => filterHari === 'all' || sc.hari === filterHari)
      .flatMap((sc) => {
        const targetRooms =
          sc.ruangIds && sc.ruangIds.length > 0
            ? rooms.filter((r) => sc.ruangIds!.includes(r.id))
            : rooms;
        return targetRooms
          .filter((rm) => filterRuangId === 'all' || rm.id === filterRuangId)
          .map((rm) => {
            const key = `${sc.id}_${rm.id}`;
            const calc = computeRoomDuplicationBreakdown(
              sc,
              rm,
              activeStudents,
              subjectMap,
              cadangan,
              examConfig.moda
            );
            const entry = localRekap.duplicationStatuses[key] || {
              id: key,
              statusGanda: 'Belum Digandakan' as const,
            };
            return {
              key,
              schedule: sc,
              room: rm,
              ...calc,
              statusEntry: entry,
            };
          })
          .filter((row) => !isOnline || row.totalPeserta > 0);
      });
  }, [
    schedules,
    rooms,
    activeStudents,
    subjectMap,
    cadangan,
    examConfig.moda,
    isOnline,
    localRekap.duplicationStatuses,
    filterHari,
    filterRuangId,
  ]);

  const duplicationSummary = useMemo(() => {
    const totalSoal = duplicationRows.reduce((s, r) => s + r.totalSoal, 0);
    const totalLjk = duplicationRows.reduce((s, r) => s + r.totalLjk, 0);
    const totalDaftarHadir = duplicationRows.reduce((s, r) => s + r.daftarHadirRangkap, 0);
    const totalBeritaAcara = duplicationRows.reduce((s, r) => s + r.beritaAcaraRangkap, 0);
    const totalBlangkoHp = duplicationRows.reduce((s, r) => s + r.blangkoHp, 0);
    const selesaiCount = duplicationRows.filter((r) => r.statusEntry.statusGanda === 'Selesai').length;
    const totalSlots = duplicationRows.length;
    return { totalSoal, totalLjk, totalDaftarHadir, totalBeritaAcara, totalBlangkoHp, selesaiCount, totalSlots };
  }, [duplicationRows]);

  const supplyShortages = useMemo(
    () => localRekap.customSupplies.filter((s) => s.tersedia < s.kebutuhan).length,
    [localRekap.customSupplies]
  );

  const handleSave = async (nextConfig: RekapConfig = localRekap, msg?: string) => {
    setIsSaving(true);
    try {
      await onSaveRekap(nextConfig, msg || 'Menyimpan rekap perlengkapan & status penggandaan ujian');
      setNotice(msg || 'Data rekap perlengkapan dan pemantauan penggandaan berhasil disimpan.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSyncModaSupplies = async () => {
    const syncedSupplies = generateModaAlignedSupplies({
      examConfig,
      students,
      rooms,
      schedules,
      phoneRecords,
      totals: equipmentTotals,
      existingCustomSupplies: localRekap.customSupplies,
    });
    const nextConfig: RekapConfig = {
      ...localRekap,
      customSupplies: syncedSupplies,
    };
    setLocalRekap(nextConfig);
    if (canEdit) {
      await handleSave(
        nextConfig,
        `Menyesuaikan daftar perlengkapan dengan ${equipmentTotals.totalPesertaTerdaftar} peserta & Moda ${
          isOnline ? 'Online' : 'Kertas'
        }`
      );
    }
  };

  const handleAddSupply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupply.namaBarang.trim()) return;
    const item: CustomSupplyItem = {
      id: `sup-${Date.now()}`,
      namaBarang: newSupply.namaBarang.trim(),
      kategori: newSupply.kategori,
      kebutuhan: Math.max(0, Number(newSupply.kebutuhan) || 0),
      tersedia: Math.max(0, Number(newSupply.tersedia) || 0),
      satuan: newSupply.satuan.trim() || 'pcs',
      keterangan: newSupply.keterangan?.trim() || undefined,
    };
    const nextConfig: RekapConfig = {
      ...localRekap,
      customSupplies: [...localRekap.customSupplies, item],
    };
    setLocalRekap(nextConfig);
    setNewSupply({
      namaBarang: '',
      kategori: 'ATK & Ruang',
      kebutuhan: 1,
      tersedia: 0,
      satuan: 'pcs',
      keterangan: '',
    });
    if (canEdit) {
      await handleSave(nextConfig, `Menambah kebutuhan perlengkapan "${item.namaBarang}"`);
    }
  };

  const handleDeleteSupply = async (id: string) => {
    const nextConfig: RekapConfig = {
      ...localRekap,
      customSupplies: localRekap.customSupplies.filter((s) => s.id !== id),
    };
    setLocalRekap(nextConfig);
    if (canEdit) {
      await handleSave(nextConfig, 'Menghapus item perlengkapan ujian');
    }
  };

  const handleUpdateDuplicationStatus = async (
    key: string,
    statusGanda: DuplicationStatusEntry['statusGanda'],
    catatan?: string
  ) => {
    const existing = localRekap.duplicationStatuses[key] || { id: key, statusGanda: 'Belum Digandakan' };
    const nextEntry: DuplicationStatusEntry = {
      ...existing,
      id: key,
      statusGanda,
      petugas: currentUser.nama,
      catatan: catatan !== undefined ? catatan : existing.catatan,
    };
    const nextConfig: RekapConfig = {
      ...localRekap,
      duplicationStatuses: {
        ...localRekap.duplicationStatuses,
        [key]: nextEntry,
      },
    };
    setLocalRekap(nextConfig);
  };

  const handleExportExcel = () => {
    const sheetSupplies = roomEquipmentRows.map((r) => ({
      Ruang: r.room.namaRuang,
      Moda: isOnline ? `Online (${examConfig.jumlahSesi} Sesi)` : 'Kertas (PBT)',
      Peserta_Terdaftar: r.totalPesertaTerdaftar,
      Peserta_Serentak_Per_Sesi: r.pesertaSerentak,
      Kursi_Peserta: r.kursiPeserta,
      Meja_Peserta: r.mejaPeserta,
      Kursi_Pengawas: r.kursiPengawas,
      Meja_Pengawas: r.mejaPengawas,
      Total_Kursi: r.totalKursi,
      Total_Meja: r.totalMeja,
      Rasio: `1 Meja = ${kursiPerMeja} Kursi`,
      Label_Meja_Fisik: r.labelMejaFisik,
      Denah_Duduk: r.denahDuduk,
      Box_HP: r.boxHp,
      Stopkontak: r.stopKontak,
    }));
    const sheetOtherSupplies = localRekap.customSupplies.map((s, idx) => ({
      No: idx + 1,
      Nama_Barang: s.namaBarang,
      Kategori: s.kategori,
      Kebutuhan: s.kebutuhan,
      Tersedia: s.tersedia,
      Kekurangan: Math.max(0, s.kebutuhan - s.tersedia),
      Satuan: s.satuan,
      Keterangan: s.keterangan || '-',
    }));
    const sheetDuplication = duplicationRows.map((row, idx) => ({
      No: idx + 1,
      Moda: isOnline ? 'Online (CBT/HP)' : 'Kertas (PBT)',
      Hari_Tanggal: `${row.schedule.hari}, ${row.schedule.tanggal}`,
      Sesi: `Sesi ${row.schedule.sesi} (${row.schedule.waktuMulai}-${row.schedule.waktuSelesai})`,
      Ruang: row.room.namaRuang,
      Rincian_Mapel: row.entries
        .map((e) => (isOnline ? `${e.subjectName} (${e.peserta} CBT)` : `${e.subjectName} (${e.peserta}+${e.cadangan})`))
        .join('; '),
      Peserta_Sesi: row.totalPeserta,
      Total_Soal_Cetak: row.totalSoal,
      Total_LJK: row.totalLjk,
      Daftar_Hadir_Rangkap: row.daftarHadirRangkap,
      Berita_Acara_Rangkap: row.beritaAcaraRangkap,
      Blangko_HP: row.blangkoHp,
      Status_Penggandaan: row.statusEntry.statusGanda,
      Catatan: row.statusEntry.catatan || '',
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetSupplies), 'Meja_Kursi_Ruang');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetOtherSupplies), 'Perlengkapan_Lain');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetDuplication), 'Kebutuhan_Penggandaan');
    XLSX.writeFile(wb, `Rekap_Perlengkapan_Penggandaan_SAUM.xlsx`);
  };

  return (
    <div className="space-y-6 print:space-y-0">
      {/* Header Bar */}
      <div className="no-print bg-white p-5 rounded-xl border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-emerald-700" />
            Rekapitulasi Perlengkapan, Meja/Kursi & Pemantauan Penggandaan
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Otomatis menyesuaikan <strong>jumlah peserta/sesi aktual</strong> dan <strong>Moda {isOnline ? `Online (${examConfig.jumlahSesi} Sesi)` : 'Kertas (PBT)'}</strong>, dengan rasio <strong>1 Meja = {kursiPerMeja} Kursi</strong> sehingga jumlah kursi lebih banyak daripada meja.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer whitespace-nowrap"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" /> Export Excel Rekap
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cetak')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" /> Pratinjau Cetak Rekap
          </button>
          {canEdit && (
            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSave()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 rounded-lg cursor-pointer whitespace-nowrap"
            >
              <Save className="w-3.5 h-3.5" /> {isSaving ? 'Menyimpan...' : 'Simpan Rekap'}
            </button>
          )}
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="no-print grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <p className="text-xs font-semibold text-slate-500">Total Kursi Dibutuhkan</p>
          <p className="text-2xl font-bold text-emerald-800 mt-1 tabular-nums">
            {equipmentTotals.totalKursi} Kursi
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
            {equipmentTotals.kursiPeserta} kursi peserta + {equipmentTotals.kursiPengawas} kursi pengawas
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <p className="text-xs font-semibold text-slate-500">
            Total Meja (1 Meja = {kursiPerMeja} Kursi)
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {equipmentTotals.totalMeja} Meja
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
            {equipmentTotals.mejaPeserta} meja peserta + {equipmentTotals.mejaPengawas} meja pengawas
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <p className="text-xs font-semibold text-slate-500">
            {isOnline ? 'Moda Online & Perangkat HP' : 'Kebutuhan Naskah Soal & LJK'}
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {isOnline ? `${equipmentTotals.boxHp} Box HP` : `${duplicationSummary.totalSoal} Eks`}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
            {isOnline
              ? `${examConfig.jumlahSesi} sesi • ${equipmentTotals.stopKontak} stopkontak • 0 soal cetak`
              : `Termasuk ${cadangan} cadangan/mapel • ${duplicationSummary.totalLjk} LJK`}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <p className="text-xs font-semibold text-slate-500">Progres Penggandaan & Sarpras</p>
          <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {duplicationSummary.selesaiCount} / {duplicationSummary.totalSlots}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
            Slot ruang selesai digandakan • {supplyShortages} item kurang
          </p>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="no-print flex flex-wrap gap-2 text-xs max-w-full">
        {[
          { id: 'perlengkapan', label: '1. Rekap Meja, Kursi & Perlengkapan', icon: Armchair },
          { id: 'penggandaan', label: '2. Pemantauan Penggandaan (Ruang & Jadwal)', icon: CopyCheck },
          { id: 'cetak', label: '3. Cetak Laporan Rekap Kebutuhan', icon: Printer },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as typeof activeTab)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 font-bold rounded-lg border cursor-pointer text-left max-w-full sm:whitespace-nowrap ${
                activeTab === t.id
                  ? 'bg-emerald-700 border-emerald-700 text-white'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" /> <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {notice && (
        <div className="no-print bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {notice}
        </div>
      )}

      {/* TAB 1: PERLENGKAPAN RUANG & LAINNYA */}
      {activeTab === 'perlengkapan' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  A. Rekapitulasi Otomatis Meja, Kursi & Perlengkapan Per Ruang
                </h3>
                <p className="text-[11px] text-slate-500">
                  Moda Aktif: <strong>{isOnline ? `Online (${examConfig.jumlahSesi} Sesi)` : 'Kertas (PBT)'}</strong> •{' '}
                  {equipmentTotals.totalPesertaTerdaftar} peserta aktif ({equipmentTotals.pesertaSerentak} peserta puncak serentak per sesi) •{' '}
                  Rasio <strong>1 Meja = {kursiPerMeja} Kursi</strong>.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <select
                  aria-label="Rasio Kursi per Meja"
                  disabled={!canEdit}
                  value={kursiPerMeja}
                  onChange={(e) =>
                    setLocalRekap({
                      ...localRekap,
                      kursiPerMeja: Number(e.target.value),
                    })
                  }
                  className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-semibold"
                >
                  <option value={2}>1 Meja = 2 Kursi (Kursi &gt; Meja)</option>
                  <option value={1}>1 Meja = 1 Kursi</option>
                </select>
                <select
                  aria-label="Basis Hitung Jumlah"
                  disabled={!canEdit}
                  value={basisHitungKursi}
                  onChange={(e) =>
                    setLocalRekap({
                      ...localRekap,
                      basisHitungKursi: e.target.value as RekapConfig['basisHitungKursi'],
                    })
                  }
                  className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-semibold"
                >
                  <option value="peserta_aktif">Hitung Sesuai Jumlah Peserta Aktual</option>
                  <option value="kapasitas_ruang">Hitung Sesuai Kapasitas Penuh Ruang</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <th className="px-3 py-3">Ruang Ujian</th>
                    <th className="px-3 py-3 text-center">
                      {isOnline ? 'Peserta (Total / Serentak)' : 'Kapasitas / Terisi'}
                    </th>
                    <th className="px-3 py-3 text-center">Kursi Peserta</th>
                    <th className="px-3 py-3 text-center">Meja Peserta</th>
                    <th className="px-3 py-3 text-center">Kursi Pengawas</th>
                    <th className="px-3 py-3 text-center">Meja Pengawas</th>
                    <th className="px-3 py-3 text-center">Label Meja</th>
                    <th className="px-3 py-3 text-center">Denah & Pintu</th>
                    {isOnline && <th className="px-3 py-3 text-center">Box HP & Stopkontak</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {roomEquipmentRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                        Belum ada ruang ujian. Atur ruang di menu Pembagian Ruang &amp; Sesi untuk menghitung kebutuhan meja dan kursi.
                      </td>
                    </tr>
                  ) : (
                    roomEquipmentRows.map((row) => (
                      <tr key={row.room.id} className="hover:bg-slate-50/70">
                        <td className="px-3 py-2.5 font-bold text-slate-900">{row.room.namaRuang}</td>
                        <td className="px-3 py-2.5 text-center">
                          {isOnline ? (
                            <span>
                              <span className="font-semibold">{row.totalPesertaTerdaftar}</span> /{' '}
                              <span className="font-bold text-emerald-700">{row.pesertaSerentak} per sesi</span>
                            </span>
                          ) : (
                            <span>
                              <span className="font-semibold">{row.room.kapasitas}</span> /{' '}
                              <span className="font-bold text-emerald-700">{row.totalPesertaTerdaftar}</span>
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center font-extrabold text-emerald-800">
                          {row.kursiPeserta}
                        </td>
                        <td className="px-3 py-2.5 text-center font-bold text-slate-900">
                          {row.mejaPeserta}
                        </td>
                        <td className="px-3 py-2.5 text-center font-semibold text-emerald-800">
                          {row.kursiPengawas}
                        </td>
                        <td className="px-3 py-2.5 text-center">{row.mejaPengawas}</td>
                        <td className="px-3 py-2.5 text-center font-semibold text-blue-800">
                          {kursiPerMeja === 2
                            ? `${row.labelMejaFisik} Meja (${row.labelPesertaDuduk} Peserta)`
                            : row.labelPesertaDuduk}
                        </td>
                        <td className="px-3 py-2.5 text-center text-slate-600">
                          {row.denahDuduk} Denah / {row.labelPintu} Pintu
                        </td>
                        {isOnline && (
                          <td className="px-3 py-2.5 text-center font-semibold text-emerald-800">
                            {row.boxHp} Box / {row.stopKontak} Terminal
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                  <tr className="bg-emerald-50/60 font-extrabold text-slate-950 border-t-2 border-slate-300">
                    <td className="px-3 py-3">TOTAL KEBUTUHAN RUANG</td>
                    <td className="px-3 py-3 text-center">
                      {equipmentTotals.totalPesertaTerdaftar} Terdaftar
                    </td>
                    <td className="px-3 py-3 text-center text-emerald-900">
                      {equipmentTotals.kursiPeserta} Kursi
                    </td>
                    <td className="px-3 py-3 text-center">{equipmentTotals.mejaPeserta} Meja</td>
                    <td className="px-3 py-3 text-center text-emerald-900">
                      {equipmentTotals.kursiPengawas} Kursi
                    </td>
                    <td className="px-3 py-3 text-center">{equipmentTotals.mejaPengawas} Meja</td>
                    <td className="px-3 py-3 text-center">{equipmentTotals.labelMejaFisik} Label Meja</td>
                    <td className="px-3 py-3 text-center">{equipmentTotals.denahDuduk} Denah</td>
                    {isOnline && (
                      <td className="px-3 py-3 text-center">{equipmentTotals.boxHp} Box HP</td>
                    )}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Kebutuhan Perlengkapan Lainnya */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  B. Daftar Kebutuhan Perlengkapan Lainnya (Sesuai Jumlah & Moda {isOnline ? 'Online' : 'Kertas'})
                </h3>
                <p className="text-[11px] text-slate-500">
                  Sesuaikan item perlengkapan otomatis dengan jumlah peserta/ruang/jadwal serta moda aktif, atau tambah perlengkapan panitia lainnya.
                </p>
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={handleSyncModaSupplies}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Sesuaikan Perlengkapan dengan Jumlah & Moda
                </button>
              )}
            </div>

            {canEdit && (
              <form
                onSubmit={handleAddSupply}
                className="p-4 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 md:grid-cols-7 gap-2.5 text-xs items-end"
              >
                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Nama Perlengkapan *</label>
                  <input
                    required
                    value={newSupply.namaBarang}
                    onChange={(e) => setNewSupply({ ...newSupply, namaBarang: e.target.value })}
                    placeholder="Misal: Kertas HVS F4 / Bel Ujian"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kategori</label>
                  <select
                    value={newSupply.kategori}
                    onChange={(e) =>
                      setNewSupply({ ...newSupply, kategori: e.target.value as CustomSupplyItem['kategori'] })
                    }
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Meja & Kursi">Meja & Kursi</option>
                    <option value="ATK & Ruang">ATK & Ruang</option>
                    <option value="Perangkat Online / HP">Perangkat Online / HP</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kebutuhan</label>
                  <input
                    type="number"
                    min={0}
                    value={newSupply.kebutuhan}
                    onChange={(e) => setNewSupply({ ...newSupply, kebutuhan: Number(e.target.value) })}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white font-mono text-center"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tersedia</label>
                  <input
                    type="number"
                    min={0}
                    value={newSupply.tersedia}
                    onChange={(e) => setNewSupply({ ...newSupply, tersedia: Number(e.target.value) })}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white font-mono text-center"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Satuan</label>
                  <input
                    value={newSupply.satuan}
                    onChange={(e) => setNewSupply({ ...newSupply, satuan: e.target.value })}
                    placeholder="rim/pcs/set"
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah Item
                </button>
                <div className="col-span-2 md:col-span-7">
                  <input
                    value={newSupply.keterangan || ''}
                    onChange={(e) => setNewSupply({ ...newSupply, keterangan: e.target.value })}
                    placeholder="Keterangan tambahan / lokasi penyimpanan (opsional)"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                  />
                </div>
              </form>
            )}

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <th className="px-3 py-2.5">Nama Perlengkapan</th>
                    <th className="px-3 py-2.5">Kategori</th>
                    <th className="px-3 py-2.5 text-center w-28">Kebutuhan</th>
                    <th className="px-3 py-2.5 text-center w-28">Tersedia</th>
                    <th className="px-3 py-2.5 text-center">Status Stok</th>
                    <th className="px-3 py-2.5">Keterangan</th>
                    {canEdit && <th className="px-3 py-2.5 text-right">Hapus</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {localRekap.customSupplies.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                        Belum ada daftar perlengkapan tambahan. Klik "Sesuaikan Perlengkapan dengan Jumlah &amp; Moda" atau tambah manual di atas.
                      </td>
                    </tr>
                  ) : null}
                  {localRekap.customSupplies.map((item, idx) => {
                    const kurang = Math.max(0, item.kebutuhan - item.tersedia);
                    return (
                      <tr key={item.id}>
                        <td className="px-3 py-2.5 font-bold text-slate-900">
                          {item.namaBarang}{' '}
                          <span className="text-[11px] font-normal text-slate-500">({item.satuan})</span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">{item.kategori}</td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            min={0}
                            disabled={!canEdit}
                            value={item.kebutuhan}
                            onChange={(e) => {
                              const next = [...localRekap.customSupplies];
                              next[idx] = { ...item, kebutuhan: Math.max(0, Number(e.target.value)) };
                              setLocalRekap({ ...localRekap, customSupplies: next });
                            }}
                            className="w-20 px-2 py-1 border border-slate-300 rounded text-center font-mono"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            min={0}
                            disabled={!canEdit}
                            value={item.tersedia}
                            onChange={(e) => {
                              const next = [...localRekap.customSupplies];
                              next[idx] = { ...item, tersedia: Math.max(0, Number(e.target.value)) };
                              setLocalRekap({ ...localRekap, customSupplies: next });
                            }}
                            className="w-20 px-2 py-1 border border-slate-300 rounded text-center font-mono font-bold"
                          />
                        </td>
                        <td className="px-3 py-2.5 text-center font-bold">
                          {kurang > 0 ? (
                            <span className="text-amber-700">
                              Kurang {kurang} {item.satuan}
                            </span>
                          ) : (
                            <span className="text-emerald-700">Terpenuhi</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            disabled={!canEdit}
                            value={item.keterangan || ''}
                            placeholder="-"
                            onChange={(e) => {
                              const next = [...localRekap.customSupplies];
                              next[idx] = { ...item, keterangan: e.target.value };
                              setLocalRekap({ ...localRekap, customSupplies: next });
                            }}
                            className="w-full px-2 py-1 border border-slate-200 rounded bg-white text-xs"
                          />
                        </td>
                        {canEdit && (
                          <td className="px-3 py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteSupply(item.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PEMANTAUAN KEBUTUHAN PENGGANDAAN SESUAI RUANG DAN JADWAL */}
      {activeTab === 'penggandaan' && (
        <div className="space-y-5">
          <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Filter Hari</label>
                <select
                  value={filterHari}
                  onChange={(e) => setFilterHari(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-semibold"
                >
                  <option value="all">Semua Hari ({distinctHari.length})</option>
                  {distinctHari.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Filter Ruang</label>
                <select
                  value={filterRuangId}
                  onChange={(e) => setFilterRuangId(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-semibold"
                >
                  <option value="all">Semua Ruang ({rooms.length})</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>{r.namaRuang}</option>
                  ))}
                </select>
              </div>
              {!isOnline && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Cadangan Soal per Mapel/Ruang
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    disabled={!canEdit}
                    value={cadangan}
                    onChange={(e) =>
                      setLocalRekap({
                        ...localRekap,
                        cadanganPerRuang: Math.max(0, Number(e.target.value)),
                      })
                    }
                    className="w-24 px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-center"
                  />
                </div>
              )}
              <div className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 font-semibold">
                {isOnline
                  ? 'Moda Online: Soal CBT/Digital (0 Soal Kertas) — Fokus Daftar Hadir, Berita Acara & Blangko HP'
                  : `Moda Kertas: Naskah Soal + LJK + ${cadangan} Cadangan/Mapel`}
              </div>
            </div>

            {canEdit && (
              <button
                type="button"
                disabled={isSaving}
                onClick={() => handleSave(localRekap, 'Menyimpan pemantauan status penggandaan naskah ujian')}
                className="inline-flex items-center gap-1.5 px-4 py-2 font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" /> Simpan Status Penggandaan
              </button>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <th className="px-3 py-3">Jadwal (Hari, Tanggal & Sesi)</th>
                  <th className="px-3 py-3">Ruang</th>
                  <th className="px-3 py-3">Rincian Mapel & Peserta</th>
                  <th className="px-3 py-3 text-center">Peserta</th>
                  {!isOnline && <th className="px-3 py-3 text-center">Total Soal</th>}
                  {!isOnline && <th className="px-3 py-3 text-center">Total LJK</th>}
                  <th className="px-3 py-3 text-center">Berkas Administrasi Ruang</th>
                  <th className="px-3 py-3">Status Penggandaan</th>
                  <th className="px-3 py-3">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {duplicationRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                      Belum ada kombinasi jadwal dan ruang ujian yang tersedia untuk dipantau penggandaannya.
                    </td>
                  </tr>
                ) : null}
                {duplicationRows.map((row) => (
                  <tr key={row.key} className="hover:bg-slate-50/70">
                    <td className="px-3 py-2.5">
                      <div className="font-bold text-slate-900">{formatDayAndDate(row.schedule.tanggal)}</div>
                      <div className="text-[11px] font-mono text-slate-500">
                        Jam ke-{row.schedule.jamKe} • Sesi {row.schedule.sesi} ({row.schedule.waktuMulai}–{row.schedule.waktuSelesai})
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-bold text-emerald-900">{row.room.namaRuang}</td>
                    <td className="px-3 py-2.5 space-y-0.5">
                      {row.entries.map((e) => (
                        <div key={e.mapelId} className="text-[11px]">
                          <span className="font-bold text-slate-900">{e.subjectName}:</span>{' '}
                          {isOnline ? (
                            <span className="text-emerald-800 font-semibold">{e.peserta} peserta (CBT Online)</span>
                          ) : (
                            <>
                              <span className="text-slate-600">
                                {e.peserta} + {e.cadangan} cad ={' '}
                              </span>
                              <span className="font-mono font-bold text-emerald-800">{e.totalSoal}</span>
                            </>
                          )}
                        </div>
                      ))}
                    </td>
                    <td className="px-3 py-2.5 text-center font-semibold">{row.totalPeserta}</td>
                    {!isOnline && (
                      <td className="px-3 py-2.5 text-center font-extrabold text-slate-950">{row.totalSoal}</td>
                    )}
                    {!isOnline && (
                      <td className="px-3 py-2.5 text-center font-bold text-slate-800">{row.totalLjk}</td>
                    )}
                    <td className="px-3 py-2.5 text-center text-[11px] text-slate-600">
                      {row.daftarHadirRangkap} DH • {row.beritaAcaraRangkap} BA •{' '}
                      {isOnline ? `${row.blangkoHp} Blangko HP` : `${row.amplopSoal} Amplop`}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        disabled={!canEdit}
                        value={row.statusEntry.statusGanda}
                        onChange={(e) =>
                          handleUpdateDuplicationStatus(
                            row.key,
                            e.target.value as DuplicationStatusEntry['statusGanda']
                          )
                        }
                        className={`px-2.5 py-1.5 border rounded-lg font-bold text-xs ${
                          row.statusEntry.statusGanda === 'Selesai'
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                            : row.statusEntry.statusGanda === 'Proses'
                            ? 'bg-amber-50 border-amber-300 text-amber-900'
                            : 'bg-white border-slate-300 text-slate-700'
                        }`}
                      >
                        <option value="Belum Digandakan">Belum Digandakan</option>
                        <option value="Proses">Proses</option>
                        <option value="Selesai">Selesai</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        disabled={!canEdit}
                        value={row.statusEntry.catatan || ''}
                        placeholder="Catatan panitia..."
                        onChange={(e) =>
                          handleUpdateDuplicationStatus(
                            row.key,
                            row.statusEntry.statusGanda,
                            e.target.value
                          )
                        }
                        className="w-36 px-2 py-1 border border-slate-200 rounded bg-white text-xs"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: CETAK LAPORAN REKAP */}
      {activeTab === 'cetak' && (
        <div className="space-y-4 print:space-y-0">
          <PrintToolbar
            title="Cetak Rekap Perlengkapan & Kebutuhan Penggandaan"
            onBack={() => setActiveTab('perlengkapan')}
            onExportExcel={handleExportExcel}
            layout={layout}
            onLayoutChange={setLayout}
            onSaveLayout={onSavePreset}
          />
          <div className="overflow-x-auto pb-8 print:overflow-visible print:pb-0">
            <RekapKebutuhanCetak
              profile={profile}
              examConfig={examConfig}
              students={students}
              rooms={rooms}
              schedules={schedules}
              subjects={subjects}
              rekapConfig={localRekap}
              paperPreset={layout}
            />
          </div>
        </div>
      )}
    </div>
  );
};
