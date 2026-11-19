import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeEquipmentTotals,
  computeRoomDuplicationBreakdown,
  computeRoomEquipmentRows,
  generateModaAlignedSupplies,
} from './rekap';
import {
  ExamConfig,
  ExamRoom,
  ExamSchedule,
  ExamSubject,
  RekapConfig,
  SantriPhoneRecord,
  Student,
} from '../types';

const TEST_EXAM_CONFIG: ExamConfig = {
  id: 'exam-test',
  namaUjian: 'Ujian Test',
  tahunPelajaran: '2025/2026',
  jenjangLabel: 'X, XI, XII',
  registeredClasses: ['X-A', 'XI-A', 'XII-A'],
  tanggalMulai: '2026-05-18',
  tanggalSelesai: '2026-05-20',
  jumlahHari: 3,
  jumlahMapel: 2,
  moda: 'online',
  jumlahRuang: 2,
  jumlahSesi: 2,
  jamPelaksanaan: '07:30 - 12:00 WIB',
  isDnpuFinalized: true,
  isNomorFinalized: true,
  isDenahLokasiFinalized: true,
};

const TEST_REKAP_CONFIG: RekapConfig = {
  cadanganPerRuang: 2,
  kursiPerMeja: 2,
  basisHitungKursi: 'peserta_aktif',
  customSupplies: [],
  duplicationStatuses: {},
};

const TEST_ROOMS: ExamRoom[] = [
  {
    id: 'room-1',
    nomorRuang: '01',
    namaRuang: 'Ruang 01',
    kapasitas: 22,
    jumlahBaris: 4,
    jumlahKolom: 6,
    polaTempatDuduk: 'straight',
    posisiPintu: 'kiri_depan',
    posisiPengawas: 'depan_tengah',
  },
  {
    id: 'room-2',
    nomorRuang: '02',
    namaRuang: 'Ruang 02',
    kapasitas: 22,
    jumlahBaris: 4,
    jumlahKolom: 6,
    polaTempatDuduk: 'straight',
    posisiPintu: 'kiri_depan',
    posisiPengawas: 'depan_tengah',
  },
];

const TEST_SUBJECTS: ExamSubject[] = [
  { id: 'sb-1', kode: 'QH', nama: "Al-Qur'an Hadis", kategori: 'Agama', durasiMenit: 90 },
  { id: 'sb-2', kode: 'MTK', nama: 'Matematika', kategori: 'Umum', durasiMenit: 120 },
];

const TEST_SCHEDULES: ExamSchedule[] = [
  {
    id: 'sc-1',
    mapelId: 'sb-1',
    tanggal: '2026-05-18',
    hari: 'Senin',
    sesi: 1,
    waktuMulai: '07:30',
    waktuSelesai: '09:00',
    ruangIds: ['room-1', 'room-2'],
  },
];

const TEST_STUDENTS: Student[] = Array.from({ length: 44 }, (_, idx) => ({
  id: `st-${idx + 1}`,
  nis: `2500${idx + 1}`,
  nisn: `01000000${String(idx + 1).padStart(2, '0')}`,
  nama: `Peserta ${idx + 1}`,
  tempatLahir: 'Indonesia',
  tanggalLahir: '2010-01-01',
  jenisKelamin: idx % 2 === 0 ? 'L' : 'P',
  kelas: idx < 22 ? 'X-A' : 'XII-A',
  jenjang: idx < 22 ? 'X' : 'XII',
  nomorPeserta: `26-01-${String(idx + 1).padStart(3, '0')}`,
  ruangId: idx < 22 ? 'room-1' : 'room-2',
  sesi: 1,
  nomorMeja: (idx % 22) + 1,
  status: 'Aktif',
}));

const TEST_PHONES: SantriPhoneRecord[] = [
  {
    id: 'hp-1',
    kodeHp: 'HP-001',
    namaSantri: 'Peserta 1',
    kelas: 'X-A',
    kategori: 'Titipan',
    isSedangDiambil: false,
    statusCas: 'Belum dicas',
    statusPengembalian: 'Belum dikembalikan',
  },
];

test('Rekap: 1 Meja = 2 Kursi ensures total kursi is always greater than total meja', () => {
  const rows = computeRoomEquipmentRows({
    rooms: TEST_ROOMS,
    students: TEST_STUDENTS,
    examConfig: TEST_EXAM_CONFIG,
    rekapConfig: { ...TEST_REKAP_CONFIG, kursiPerMeja: 2, basisHitungKursi: 'peserta_aktif' },
  });
  const totals = computeEquipmentTotals(rows);

  assert.equal(totals.kursiPeserta, 44);
  assert.equal(totals.mejaPeserta, 22);
  assert.equal(totals.kursiPengawas, 4);
  assert.equal(totals.mejaPengawas, 2);
  assert.equal(totals.totalKursi, 48);
  assert.equal(totals.totalMeja, 24);
  assert.equal(totals.totalKursi > totals.totalMeja, true);
});

test('Rekap: adapts furniture and supplies cleanly to Moda Online vs Moda Kertas and concurrent session counts', () => {
  const evenStudents = TEST_STUDENTS.map((st, idx) => ({
    ...st,
    ruangId: idx % 2 === 0 ? 'room-1' : 'room-2',
    sesi: idx < 22 ? 1 : 2,
  }));

  const onlineRows = computeRoomEquipmentRows({
    rooms: TEST_ROOMS,
    students: evenStudents,
    examConfig: { ...TEST_EXAM_CONFIG, moda: 'online', jumlahSesi: 2 },
    rekapConfig: { ...TEST_REKAP_CONFIG, kursiPerMeja: 2, basisHitungKursi: 'peserta_aktif' },
  });
  const onlineTotals = computeEquipmentTotals(onlineRows);
  assert.equal(onlineTotals.kursiPeserta, 22);
  assert.equal(onlineTotals.mejaPeserta, 12);
  assert.equal(onlineTotals.kursiPeserta > onlineTotals.mejaPeserta, true);
  assert.equal(onlineTotals.boxHp > 0, true);

  const kertasRows = computeRoomEquipmentRows({
    rooms: TEST_ROOMS,
    students: evenStudents,
    examConfig: { ...TEST_EXAM_CONFIG, moda: 'kertas', jumlahSesi: 1 },
    rekapConfig: { ...TEST_REKAP_CONFIG, kursiPerMeja: 2, basisHitungKursi: 'peserta_aktif' },
  });
  const kertasTotals = computeEquipmentTotals(kertasRows);
  assert.equal(kertasTotals.kursiPeserta, 44);
  assert.equal(kertasTotals.mejaPeserta, 22);
  assert.equal(kertasTotals.boxHp, 0);

  const onlineSupplies = generateModaAlignedSupplies({
    examConfig: { ...TEST_EXAM_CONFIG, moda: 'online', jumlahSesi: 2 },
    students: evenStudents,
    rooms: TEST_ROOMS,
    schedules: TEST_SCHEDULES,
    phoneRecords: TEST_PHONES,
    totals: onlineTotals,
    existingCustomSupplies: [],
  });
  assert.equal(onlineSupplies.some((s) => s.kategori === 'Perangkat Online / HP'), true);

  const kertasSupplies = generateModaAlignedSupplies({
    examConfig: { ...TEST_EXAM_CONFIG, moda: 'kertas', jumlahSesi: 1 },
    students: evenStudents,
    rooms: TEST_ROOMS,
    schedules: TEST_SCHEDULES,
    phoneRecords: TEST_PHONES,
    totals: kertasTotals,
    existingCustomSupplies: [],
  });
  assert.equal(kertasSupplies.some((s) => s.kategori === 'Perangkat Online / HP'), false);
  assert.equal(kertasSupplies.some((s) => s.id === 'auto-amplop-soal'), true);

  const subjectMap = new Map(TEST_SUBJECTS.map((s) => [s.id, s]));
  const onlineDup = computeRoomDuplicationBreakdown(
    TEST_SCHEDULES[0],
    TEST_ROOMS[0],
    evenStudents,
    subjectMap,
    2,
    'online'
  );
  assert.equal(onlineDup.totalSoal, 0);
  assert.equal(onlineDup.blangkoHp, 1);

  const kertasDup = computeRoomDuplicationBreakdown(
    TEST_SCHEDULES[0],
    TEST_ROOMS[0],
    evenStudents,
    subjectMap,
    2,
    'kertas'
  );
  assert.equal(kertasDup.totalPeserta, 22);
  assert.equal(kertasDup.totalSoal > 22, true);
});

test('Rekap: counts 12 physical desks when a cross-jenjang room of 22 uses solo desks (#21 and #23)', () => {
  // 10 paired desks (10 X + 10 XI -> #1..#20) + 2 solo X desks (#21, #23) = 22 students, 12 desks
  const soloRoomStudents: Student[] = [
    ...Array.from({ length: 10 }, (_, idx) => ({
      id: `sx-${idx + 1}`,
      nis: `10${idx + 1}`,
      nisn: `00900001${String(idx + 1).padStart(2, '0')}`,
      nama: `X ${idx + 1}`,
      tempatLahir: 'Kota',
      tanggalLahir: '2010-01-01',
      jenisKelamin: 'L' as const,
      kelas: 'X-A',
      jenjang: 'X',
      nomorPeserta: `26-01-${String(idx * 2 + 1).padStart(3, '0')}`,
      ruangId: 'room-1',
      nomorMeja: idx * 2 + 1,
      status: 'Aktif' as const,
    })),
    ...Array.from({ length: 10 }, (_, idx) => ({
      id: `sxi-${idx + 1}`,
      nis: `20${idx + 1}`,
      nisn: `00900002${String(idx + 1).padStart(2, '0')}`,
      nama: `XI ${idx + 1}`,
      tempatLahir: 'Kota',
      tanggalLahir: '2009-01-01',
      jenisKelamin: 'P' as const,
      kelas: 'XI-A',
      jenjang: 'XI',
      nomorPeserta: `26-01-${String(idx * 2 + 2).padStart(3, '0')}`,
      ruangId: 'room-1',
      nomorMeja: idx * 2 + 2,
      status: 'Aktif' as const,
    })),
    {
      id: 'sx-11',
      nis: '111',
      nisn: '0090000111',
      nama: 'X 11',
      tempatLahir: 'Kota',
      tanggalLahir: '2010-01-01',
      jenisKelamin: 'L' as const,
      kelas: 'X-A',
      jenjang: 'X',
      nomorPeserta: '26-01-021',
      ruangId: 'room-1',
      nomorMeja: 21,
      status: 'Aktif' as const,
    },
    {
      id: 'sx-12',
      nis: '112',
      nisn: '0090000112',
      nama: 'X 12',
      tempatLahir: 'Kota',
      tanggalLahir: '2010-01-01',
      jenisKelamin: 'L' as const,
      kelas: 'X-A',
      jenjang: 'X',
      nomorPeserta: '26-01-023',
      ruangId: 'room-1',
      nomorMeja: 23,
      status: 'Aktif' as const,
    },
  ];

  const rows = computeRoomEquipmentRows({
    rooms: [TEST_ROOMS[0]],
    students: soloRoomStudents,
    examConfig: { ...TEST_EXAM_CONFIG, moda: 'kertas', jumlahSesi: 1 },
    rekapConfig: { ...TEST_REKAP_CONFIG, kursiPerMeja: 2, basisHitungKursi: 'peserta_aktif' },
  });

  assert.equal(rows[0].kursiPeserta, 22);
  assert.equal(rows[0].mejaPeserta, 12);
  assert.equal(rows[0].totalKursi > rows[0].totalMeja, true);
});

