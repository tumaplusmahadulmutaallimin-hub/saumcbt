import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeEquipmentTotals,
  computeRoomDuplicationBreakdown,
  computeRoomEquipmentRows,
  generateModaAlignedSupplies,
} from './rekap';
import {
  INITIAL_EXAM_CONFIG,
  INITIAL_PHONE_RECORDS,
  INITIAL_REKAP_CONFIG,
  INITIAL_ROOMS,
  INITIAL_SCHEDULES,
  INITIAL_STUDENTS,
  INITIAL_SUBJECTS,
} from '../data/initialData';

test('Rekap: 1 Meja = 2 Kursi ensures total kursi is always greater than total meja', () => {
  const rows = computeRoomEquipmentRows({
    rooms: INITIAL_ROOMS,
    students: INITIAL_STUDENTS,
    examConfig: INITIAL_EXAM_CONFIG,
    rekapConfig: { ...INITIAL_REKAP_CONFIG, kursiPerMeja: 2, basisHitungKursi: 'peserta_aktif' },
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
  // Split 44 students evenly across 2 rooms & 2 sessions -> 11 concurrent per room per session
  const evenStudents = INITIAL_STUDENTS.map((st, idx) => ({
    ...st,
    ruangId: idx % 2 === 0 ? 'room-1' : 'room-2',
    sesi: idx < 22 ? 1 : 2,
  }));

  const onlineRows = computeRoomEquipmentRows({
    rooms: INITIAL_ROOMS,
    students: evenStudents,
    examConfig: { ...INITIAL_EXAM_CONFIG, moda: 'online', jumlahSesi: 2 },
    rekapConfig: { ...INITIAL_REKAP_CONFIG, kursiPerMeja: 2, basisHitungKursi: 'peserta_aktif' },
  });
  const onlineTotals = computeEquipmentTotals(onlineRows);
  // Concurrent seats: 11 per room * 2 rooms = 22 seats -> ceil(11/2)*2 = 12 desks
  assert.equal(onlineTotals.kursiPeserta, 22);
  assert.equal(onlineTotals.mejaPeserta, 12);
  assert.equal(onlineTotals.kursiPeserta > onlineTotals.mejaPeserta, true);
  assert.equal(onlineTotals.boxHp > 0, true);

  // Kertas mode: all 44 sit simultaneously -> 44 seats, 22 desks, 0 Box HP
  const kertasRows = computeRoomEquipmentRows({
    rooms: INITIAL_ROOMS,
    students: evenStudents,
    examConfig: { ...INITIAL_EXAM_CONFIG, moda: 'kertas', jumlahSesi: 1 },
    rekapConfig: { ...INITIAL_REKAP_CONFIG, kursiPerMeja: 2, basisHitungKursi: 'peserta_aktif' },
  });
  const kertasTotals = computeEquipmentTotals(kertasRows);
  assert.equal(kertasTotals.kursiPeserta, 44);
  assert.equal(kertasTotals.mejaPeserta, 22);
  assert.equal(kertasTotals.boxHp, 0);

  // Supplies sync: online includes HP items, kertas includes amplop soal & excludes Box HP
  const onlineSupplies = generateModaAlignedSupplies({
    examConfig: { ...INITIAL_EXAM_CONFIG, moda: 'online', jumlahSesi: 2 },
    students: evenStudents,
    rooms: INITIAL_ROOMS,
    schedules: INITIAL_SCHEDULES,
    phoneRecords: INITIAL_PHONE_RECORDS,
    totals: onlineTotals,
    existingCustomSupplies: [],
  });
  assert.equal(onlineSupplies.some((s) => s.kategori === 'Perangkat Online / HP'), true);

  const kertasSupplies = generateModaAlignedSupplies({
    examConfig: { ...INITIAL_EXAM_CONFIG, moda: 'kertas', jumlahSesi: 1 },
    students: evenStudents,
    rooms: INITIAL_ROOMS,
    schedules: INITIAL_SCHEDULES,
    phoneRecords: INITIAL_PHONE_RECORDS,
    totals: kertasTotals,
    existingCustomSupplies: [],
  });
  assert.equal(kertasSupplies.some((s) => s.kategori === 'Perangkat Online / HP'), false);
  assert.equal(kertasSupplies.some((s) => s.id === 'auto-amplop-soal'), true);

  // Duplication breakdown: Online = 0 printed exam sheets, Kertas = students + cadangan
  const subjectMap = new Map(INITIAL_SUBJECTS.map((s) => [s.id, s]));
  const onlineDup = computeRoomDuplicationBreakdown(
    INITIAL_SCHEDULES[0],
    INITIAL_ROOMS[0],
    evenStudents,
    subjectMap,
    2,
    'online'
  );
  assert.equal(onlineDup.totalSoal, 0);
  assert.equal(onlineDup.blangkoHp, 1);

  const kertasDup = computeRoomDuplicationBreakdown(
    INITIAL_SCHEDULES[0],
    INITIAL_ROOMS[0],
    evenStudents,
    subjectMap,
    2,
    'kertas'
  );
  assert.equal(kertasDup.totalPeserta, 22);
  assert.equal(kertasDup.totalSoal > 22, true);
});
