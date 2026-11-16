import {
  CustomSupplyItem,
  ExamConfig,
  ExamRoom,
  ExamSchedule,
  ExamSubject,
  RekapConfig,
  SantriPhoneRecord,
  Student,
} from '../types';

export interface RoomEquipmentRow {
  room: ExamRoom;
  totalPesertaTerdaftar: number;
  pesertaSerentak: number; // Peak concurrent students per session (same as totalPesertaTerdaftar in kertas mode)
  activeSessionsInRoom: number;
  kursiPeserta: number;
  mejaPeserta: number;
  kursiPengawas: number;
  mejaPengawas: number;
  totalKursi: number;
  totalMeja: number;
  labelMejaFisik: number;
  labelPesertaDuduk: number;
  labelPintu: number;
  denahDuduk: number;
  tataTertib: number;
  boxHp: number;
  stopKontak: number;
  kartuLogin: number;
}

export interface EquipmentTotals {
  totalPesertaTerdaftar: number;
  pesertaSerentak: number;
  kursiPeserta: number;
  mejaPeserta: number;
  kursiPengawas: number;
  mejaPengawas: number;
  totalKursi: number;
  totalMeja: number;
  labelMejaFisik: number;
  labelPesertaDuduk: number;
  denahDuduk: number;
  boxHp: number;
  stopKontak: number;
  kartuLogin: number;
}

export interface RoomDuplicationSubjectEntry {
  mapelId: string;
  subjectName: string;
  peserta: number;
  cadangan: number;
  totalSoal: number;
  totalLjk: number;
}

export interface RoomDuplicationBreakdown {
  entries: RoomDuplicationSubjectEntry[];
  totalPeserta: number;
  totalCadangan: number;
  totalSoal: number;
  totalLjk: number;
  daftarHadirRangkap: number;
  beritaAcaraRangkap: number;
  amplopSoal: number;
  blangkoHp: number;
}

/**
 * Menghitung kebutuhan meja & kursi per ruang sesuai:
 * 1. Jumlah peserta aktual (dan puncak serentak per sesi jika moda online) atau kapasitas ruang
 * 2. Moda ujian (online vs kertas)
 * 3. Rasio 1 Meja = 2 Kursi (sehingga kursi selalu lebih banyak daripada meja)
 */
export function computeRoomEquipmentRows(params: {
  rooms: ExamRoom[];
  students: Student[];
  examConfig: ExamConfig;
  rekapConfig: RekapConfig;
}): RoomEquipmentRow[] {
  const { rooms, students, examConfig, rekapConfig } = params;
  const activeStudents = students.filter((s) => s.status === 'Aktif');
  const isOnline = examConfig.moda === 'online';
  const kursiPerMeja = rekapConfig.kursiPerMeja === 1 ? 1 : 2;
  const basis = rekapConfig.basisHitungKursi || 'peserta_aktif';

  return rooms.map((r) => {
    const inRoom = activeStudents.filter((s) => s.ruangId === r.id);
    const totalPesertaTerdaftar = inRoom.length;

    let pesertaSerentak = totalPesertaTerdaftar;
    let activeSessionsInRoom = totalPesertaTerdaftar > 0 ? 1 : 0;

    if (isOnline) {
      const sessionCounts = new Map<number, number>();
      for (const st of inRoom) {
        const s = st.sesi || 1;
        sessionCounts.set(s, (sessionCounts.get(s) || 0) + 1);
      }
      const counts = Array.from(sessionCounts.values());
      pesertaSerentak = counts.length > 0 ? Math.max(...counts) : 0;
      activeSessionsInRoom = counts.length;
    }

    const kursiPeserta = basis === 'kapasitas_ruang' ? r.kapasitas : pesertaSerentak;
    const mejaPeserta = kursiPeserta > 0 ? Math.ceil(kursiPeserta / kursiPerMeja) : 0;

    // Standar madrasah: 2 pengawas per ruang (atau sesuai yang ditugaskan); 1 meja pengawas untuk 2 kursi pengawas
    const assignedSupCount = (r.pengawas1Id ? 1 : 0) + (r.pengawas2Id ? 1 : 0);
    const hasExamActivity = kursiPeserta > 0 || basis === 'kapasitas_ruang';
    const kursiPengawas = hasExamActivity ? Math.max(2, assignedSupCount) : assignedSupCount;
    const mejaPengawas = kursiPengawas > 0 ? Math.ceil(kursiPengawas / kursiPerMeja) : 0;

    const totalKursi = kursiPeserta + kursiPengawas;
    const totalMeja = mejaPeserta + mejaPengawas;

    const labelMejaFisik = mejaPeserta;
    const labelPesertaDuduk = totalPesertaTerdaftar;
    const denahDuduk = hasExamActivity ? Math.max(1, activeSessionsInRoom) * 2 : 0;
    const boxHp = isOnline && hasExamActivity ? Math.max(1, Math.ceil(kursiPeserta / 22)) : 0;
    const stopKontak = isOnline && hasExamActivity ? Math.max(2, Math.ceil(kursiPeserta / 10)) : 0;
    const kartuLogin = isOnline ? totalPesertaTerdaftar : 0;

    return {
      room: r,
      totalPesertaTerdaftar,
      pesertaSerentak,
      activeSessionsInRoom,
      kursiPeserta,
      mejaPeserta,
      kursiPengawas,
      mejaPengawas,
      totalKursi,
      totalMeja,
      labelMejaFisik,
      labelPesertaDuduk,
      labelPintu: 1,
      denahDuduk,
      tataTertib: 1,
      boxHp,
      stopKontak,
      kartuLogin,
    };
  });
}

export function computeEquipmentTotals(rows: RoomEquipmentRow[]): EquipmentTotals {
  return rows.reduce<EquipmentTotals>(
    (acc, r) => ({
      totalPesertaTerdaftar: acc.totalPesertaTerdaftar + r.totalPesertaTerdaftar,
      pesertaSerentak: acc.pesertaSerentak + r.pesertaSerentak,
      kursiPeserta: acc.kursiPeserta + r.kursiPeserta,
      mejaPeserta: acc.mejaPeserta + r.mejaPeserta,
      kursiPengawas: acc.kursiPengawas + r.kursiPengawas,
      mejaPengawas: acc.mejaPengawas + r.mejaPengawas,
      totalKursi: acc.totalKursi + r.totalKursi,
      totalMeja: acc.totalMeja + r.totalMeja,
      labelMejaFisik: acc.labelMejaFisik + r.labelMejaFisik,
      labelPesertaDuduk: acc.labelPesertaDuduk + r.labelPesertaDuduk,
      denahDuduk: acc.denahDuduk + r.denahDuduk,
      boxHp: acc.boxHp + r.boxHp,
      stopKontak: acc.stopKontak + r.stopKontak,
      kartuLogin: acc.kartuLogin + r.kartuLogin,
    }),
    {
      totalPesertaTerdaftar: 0,
      pesertaSerentak: 0,
      kursiPeserta: 0,
      mejaPeserta: 0,
      kursiPengawas: 0,
      mejaPengawas: 0,
      totalKursi: 0,
      totalMeja: 0,
      labelMejaFisik: 0,
      labelPesertaDuduk: 0,
      denahDuduk: 0,
      boxHp: 0,
      stopKontak: 0,
      kartuLogin: 0,
    }
  );
}

/**
 * Menghitung kebutuhan penggandaan per jadwal & ruang sesuai:
 * - Pemetaan mapel per kelas (`schedule.mapelPerKelas`)
 * - Moda Ujian (`kertas`: cetak Naskah Soal + LJK + cadangan; `online`: CBT/0 soal cetak, fokus DH/BA/Kartu Login & Blangko HP)
 * - Jumlah peserta aktual per sesi di ruang tersebut (saat moda online)
 */
export function computeRoomDuplicationBreakdown(
  schedule: ExamSchedule,
  room: ExamRoom,
  activeStudents: Student[],
  subjectMap: Map<string, ExamSubject>,
  cadanganPerRuang: number,
  moda: ExamConfig['moda'] = 'kertas'
): RoomDuplicationBreakdown {
  const isOnline = moda === 'online';
  const roomStudents = activeStudents.filter((s) => {
    if (s.ruangId !== room.id) return false;
    if (isOnline && schedule.sesi && s.sesi !== undefined) {
      return s.sesi === schedule.sesi;
    }
    return true;
  });

  const bySubject: Record<string, { subjectName: string; count: number }> = {};

  for (const st of roomStudents) {
    const mapelId = schedule.mapelPerKelas?.[st.kelas] || schedule.mapelId;
    if (!mapelId) continue;
    if (!bySubject[mapelId]) {
      bySubject[mapelId] = {
        subjectName: subjectMap.get(mapelId)?.nama || mapelId,
        count: 0,
      };
    }
    bySubject[mapelId].count++;
  }

  const entries: RoomDuplicationSubjectEntry[] = Object.entries(bySubject).map(([mapelId, val]) => {
    const effectiveCadangan = isOnline ? 0 : cadanganPerRuang;
    const totalSoal = isOnline ? 0 : val.count + effectiveCadangan;
    const totalLjk = isOnline ? 0 : val.count + effectiveCadangan;
    return {
      mapelId,
      subjectName: val.subjectName,
      peserta: val.count,
      cadangan: effectiveCadangan,
      totalSoal,
      totalLjk,
    };
  });

  const totalPeserta = entries.reduce((sum, e) => sum + e.peserta, 0);
  const totalCadangan = entries.reduce((sum, e) => sum + e.cadangan, 0);
  const totalSoal = entries.reduce((sum, e) => sum + e.totalSoal, 0);
  const totalLjk = entries.reduce((sum, e) => sum + e.totalLjk, 0);

  return {
    entries,
    totalPeserta,
    totalCadangan,
    totalSoal,
    totalLjk,
    daftarHadirRangkap: totalPeserta > 0 ? 2 : 0,
    beritaAcaraRangkap: totalPeserta > 0 ? 2 : 0,
    amplopSoal: !isOnline && totalPeserta > 0 ? entries.length : 0,
    blangkoHp: isOnline && totalPeserta > 0 ? 1 : 0,
  };
}

/**
 * Menghasilkan daftar perlengkapan standar yang disinkronkan secara otomatis
 * dengan jumlah peserta, jumlah ruang, jumlah jadwal/hari, dan moda ujian aktif.
 */
export function generateModaAlignedSupplies(params: {
  examConfig: ExamConfig;
  students: Student[];
  rooms: ExamRoom[];
  schedules: ExamSchedule[];
  phoneRecords: SantriPhoneRecord[];
  totals: EquipmentTotals;
  existingCustomSupplies: CustomSupplyItem[];
}): CustomSupplyItem[] {
  const { examConfig, rooms, schedules, phoneRecords, totals, existingCustomSupplies } = params;
  const isOnline = examConfig.moda === 'online';
  const activeRoomsCount = rooms.length;
  const slotCount = Math.max(1, schedules.length * Math.max(1, activeRoomsCount));

  // Preserve previous "tersedia" values by matched name/id where possible
  const findPrevTersedia = (id: string, fallback = 0) => {
    const match = existingCustomSupplies.find((item) => item.id === id);
    return match ? match.tersedia : fallback;
  };

  const generated: CustomSupplyItem[] = [
    {
      id: 'auto-meja-kursi',
      namaBarang: `Set Bangku Ujian (1 Meja 2 Kursi = ${totals.totalMeja} Meja & ${totals.totalKursi} Kursi)`,
      kategori: 'Meja & Kursi',
      kebutuhan: totals.totalKursi,
      tersedia: findPrevTersedia('auto-meja-kursi', totals.totalKursi),
      satuan: 'kursi',
      keterangan: `Rincian: ${totals.kursiPeserta} kursi peserta + ${totals.kursiPengawas} kursi pengawas (${totals.totalMeja} meja fisik)`,
    },
    {
      id: 'auto-clipboard',
      namaBarang: 'Papan Jalan / Clipboard Pengawas',
      kategori: 'ATK & Ruang',
      kebutuhan: totals.kursiPengawas,
      tersedia: findPrevTersedia('auto-clipboard', totals.kursiPengawas),
      satuan: 'buah',
      keterangan: `${totals.kursiPengawas} unit sesuai jumlah pengawas di ${activeRoomsCount} ruang`,
    },
    {
      id: 'auto-atk-harian',
      namaBarang: 'Spidol Whiteboard, Pulpen Pengawas & Penghapus',
      kategori: 'ATK & Ruang',
      kebutuhan: Math.max(1, activeRoomsCount),
      tersedia: findPrevTersedia('auto-atk-harian', Math.max(1, activeRoomsCount)),
      satuan: 'paket',
      keterangan: `1 paket ATK per ruang ujian (${activeRoomsCount} ruang)`,
    },
  ];

  if (isOnline) {
    generated.push(
      {
        id: 'auto-box-hp',
        namaBarang: 'Box Kontainer Penyimpanan HP & Sekat Nomor',
        kategori: 'Perangkat Online / HP',
        kebutuhan: Math.max(totals.boxHp, Math.ceil(Math.max(phoneRecords.length, totals.totalPesertaTerdaftar) / 22)),
        tersedia: findPrevTersedia('auto-box-hp', totals.boxHp),
        satuan: 'box',
        keterangan: `Moda Online (${examConfig.jumlahSesi} sesi) • untuk ${totals.totalPesertaTerdaftar} peserta / ${phoneRecords.length} HP tercatat`,
      },
      {
        id: 'auto-stopkontak',
        namaBarang: 'Kabel Roll / Terminal Stopkontak Pengecasan HP',
        kategori: 'Perangkat Online / HP',
        kebutuhan: Math.max(2, totals.stopKontak),
        tersedia: findPrevTersedia('auto-stopkontak', totals.stopKontak),
        satuan: 'unit',
        keterangan: `Pos Pengecasan HP & meja pengawas untuk ${activeRoomsCount} ruang CBT/HP`,
      },
      {
        id: 'auto-blangko-hp',
        namaBarang: 'Blangko Ceklis Serah-Terima HP & Kartu Link/QR',
        kategori: 'Perangkat Online / HP',
        kebutuhan: Math.max(1, activeRoomsCount * examConfig.jumlahHari),
        tersedia: findPrevTersedia('auto-blangko-hp', Math.max(1, activeRoomsCount * examConfig.jumlahHari)),
        satuan: 'set',
        keterangan: `${activeRoomsCount} ruang × ${examConfig.jumlahHari} hari pelaksanaan`,
      }
    );
  } else {
    generated.push(
      {
        id: 'auto-amplop-soal',
        namaBarang: 'Map / Amplop Coklat Naskah Soal & LJK',
        kategori: 'ATK & Ruang',
        kebutuhan: slotCount,
        tersedia: findPrevTersedia('auto-amplop-soal', slotCount),
        satuan: 'buah',
        keterangan: `Moda Kertas: ${schedules.length} jadwal × ${activeRoomsCount} ruang`,
      },
      {
        id: 'auto-lem-segel',
        namaBarang: 'Lem Kertas & Lakban Segel Sampul Naskah',
        kategori: 'ATK & Ruang',
        kebutuhan: Math.max(1, activeRoomsCount * 2),
        tersedia: findPrevTersedia('auto-lem-segel', Math.max(1, activeRoomsCount * 2)),
        satuan: 'buah',
        keterangan: `Moda Kertas untuk penyegelan amplop soal & LJK di ${activeRoomsCount} ruang`,
      }
    );
  }

  // Keep any user-added custom items (id not starting with 'auto-' and not legacy defaults 'sup-1'..'sup-5')
  const userCustomItems = existingCustomSupplies.filter(
    (item) => !item.id.startsWith('auto-') && !['sup-1', 'sup-2', 'sup-3', 'sup-4', 'sup-5'].includes(item.id)
  );

  return [...generated, ...userCustomItems];
}
