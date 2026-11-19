import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeRoomParity,
  calculateRequiredRooms,
  distributeRoomsCrossJenjang,
  distributeStudents,
  generateValidatedRoomPlan,
  getOrderedSeats,
  getRoomFacilityTotals,
  moveOddStudentsToReserveRoom,
  moveOrSwapStudentSeat,
  normalizeRoomFacilities,
  previewRoomDistribution,
  swapPhysicalDesksInRoom,
  validateGenerateFeasibility,
  validateRoomDistribution,
} from './seating';
import { ExamRoom, Student } from '../types';

test('calculateRequiredRooms calculates ceiling correctly', () => {
  assert.equal(calculateRequiredRooms(35, 20), 2);
  assert.equal(calculateRequiredRooms(20, 20), 1);
  assert.equal(calculateRequiredRooms(41, 20), 3);
  assert.equal(calculateRequiredRooms(0, 20), 1);
});

test('getOrderedSeats generates zigzag and snake patterns properly', () => {
  const straight = getOrderedSeats(2, 2, 'straight');
  assert.equal(straight.length, 4);
  assert.deepEqual(straight[0], { row: 0, col: 0, seatNumber: 1 });
  assert.deepEqual(straight[1], { row: 0, col: 1, seatNumber: 2 });
  assert.deepEqual(straight[2], { row: 1, col: 0, seatNumber: 3 });

  const snake = getOrderedSeats(2, 2, 'snake');
  assert.deepEqual(snake[0], { row: 0, col: 0, seatNumber: 1 });
  assert.deepEqual(snake[1], { row: 0, col: 1, seatNumber: 2 });
  assert.deepEqual(snake[2], { row: 1, col: 1, seatNumber: 3 }); // snake turns back!
  assert.deepEqual(snake[3], { row: 1, col: 0, seatNumber: 4 });
});

test('distributeStudents allocates students without exceeding room capacity', () => {
  const students: Student[] = Array.from({ length: 25 }, (_, i) => ({
    id: `s-${i + 1}`,
    nis: `10${i + 1}`,
    nisn: `00800000${i + 1}`,
    nama: `Siswa ${i + 1}`,
    tempatLahir: 'Kota',
    tanggalLahir: '2010-01-01',
    jenisKelamin: i % 2 === 0 ? 'L' : 'P',
    kelas: i < 12 ? 'IX-A' : 'IX-B',
    nomorPeserta: `26-01-${String(i + 1).padStart(3, '0')}`,
    status: 'Aktif',
  }));

  const initialRooms: ExamRoom[] = [
    {
      id: 'r-1',
      nomorRuang: '01',
      namaRuang: 'Ruang 01',
      kapasitas: 15,
      jumlahBaris: 5,
      jumlahKolom: 3,
      polaTempatDuduk: 'zigzag',
      posisiPintu: 'kiri_depan',
      posisiPengawas: 'depan_tengah',
    },
    {
      id: 'r-2',
      nomorRuang: '02',
      namaRuang: 'Ruang 02',
      kapasitas: 15,
      jumlahBaris: 5,
      jumlahKolom: 3,
      polaTempatDuduk: 'zigzag',
      posisiPintu: 'kiri_depan',
      posisiPengawas: 'depan_tengah',
    },
  ];

  const result = distributeStudents(students, initialRooms, {
    kapasitasPerRuang: 15,
    metode: 'nomor_peserta',
  });

  const room1Students = result.updatedStudents.filter((s) => s.ruangId === 'r-1');
  const room2Students = result.updatedStudents.filter((s) => s.ruangId === 'r-2');

  assert.equal(room1Students.length, 15);
  assert.equal(room2Students.length, 10);
  assert.equal(room1Students.every((s) => (s.nomorMeja || 0) >= 1 && (s.nomorMeja || 0) <= 15), true);
  assert.equal(room2Students.every((s) => (s.nomorMeja || 0) >= 1 && (s.nomorMeja || 0) <= 10), true);

  const assignedIds = new Set(result.updatedStudents.map((s) => s.id));
  assert.equal(assignedIds.size, 25);
});

test('distributeRoomsCrossJenjang honors explicit jumlahRuang=4 even when jumlahRuangManual is 0 (via examJumlahRuang)', () => {
  const mkStudents = (count: number, kelas: string, jenjang: string, offset: number): Student[] =>
    Array.from({ length: count }, (_, i) => ({
      id: `${jenjang}-${i + 1}`,
      nis: `${offset + i}`,
      nisn: `009000${String(offset + i).padStart(4, '0')}`,
      nama: `Peserta ${jenjang} ${i + 1}`,
      tempatLahir: 'Kota',
      tanggalLahir: '2009-01-01',
      jenisKelamin: i % 2 === 0 ? 'L' : 'P',
      kelas,
      jenjang,
      nomorPeserta: `26-01-${String(offset + i).padStart(3, '0')}`,
      status: 'Aktif',
    }));

  const students = [
    ...mkStudents(30, 'X-A', 'X', 1),
    ...mkStudents(30, 'XI-A', 'XI', 101),
    ...mkStudents(20, 'XII-A', 'XII', 201),
  ];

  const res = distributeRoomsCrossJenjang(
    students,
    [],
    { kapasitasPerRuang: 22, metode: 'silang_jenjang_11_11', jumlahRuangManual: 0 },
    'kertas',
    () => 0.42,
    { examJumlahRuang: 4 }
  );

  assert.equal(res.updatedRooms.length, 4);
  assert.equal(res.updatedStudents.length, 80);
  // Zero same-jenjang desk mate conflicts
  const parity = analyzeRoomParity(res.updatedStudents, res.updatedRooms, 'kertas', 1);
  assert.equal(parity.sameJenjangDeskConflicts.length, 0);
});

test('distributeRoomsCrossJenjang puts 2-jenjang rooms first and 3-jenjang room at the end with zero desk conflicts', () => {
  const mkStudents = (count: number, kelas: string, jenjang: string, offset: number): Student[] =>
    Array.from({ length: count }, (_, i) => ({
      id: `${jenjang}-${i + 1}`,
      nis: `${offset + i}`,
      nisn: `007000${String(offset + i).padStart(4, '0')}`,
      nama: `Peserta ${jenjang} ${i + 1}`,
      tempatLahir: 'Kota',
      tanggalLahir: '2009-01-01',
      jenisKelamin: i % 2 === 0 ? 'L' : 'P',
      kelas,
      jenjang,
      nomorPeserta: `26-01-${String(offset + i).padStart(3, '0')}`,
      status: 'Aktif',
    }));

  // Total 60 across 3 rooms (cap 20): X=27, XI=19, XII=14 -> forces 1 three-jenjang room
  const students = [
    ...mkStudents(27, 'X-A', 'X', 1),
    ...mkStudents(19, 'XI-A', 'XI', 101),
    ...mkStudents(14, 'XII-A', 'XII', 201),
  ];

  const res = distributeRoomsCrossJenjang(
    students,
    [],
    { kapasitasPerRuang: 20, metode: 'silang_jenjang_11_11', jumlahRuangManual: 3 },
    'kertas',
    () => 0.35
  );

  assert.equal(res.updatedRooms.length, 3);
  const distinctPerRoom = res.summary.map((s) => Object.keys(s.jenjangCounts).length);
  assert.equal(distinctPerRoom[0], 2);
  assert.equal(distinctPerRoom[1], 2);
  assert.equal(distinctPerRoom[2], 3);

  const parity = analyzeRoomParity(res.updatedStudents, res.updatedRooms, 'kertas', 1);
  assert.equal(parity.sameJenjangDeskConflicts.length, 0);
});

test('analyzeRoomParity detects odd rooms and moveOddStudentsToReserveRoom places odd student into Ruang Cadangan', () => {
  const mkStudents = (count: number, jenjang: string): Student[] =>
    Array.from({ length: count }, (_, i) => ({
      id: `${jenjang}-${i + 1}`,
      nis: `${jenjang}-${i + 1}`,
      nisn: `006000${jenjang}${String(i + 1).padStart(2, '0')}`,
      nama: `Siswa ${jenjang} ${i + 1}`,
      tempatLahir: 'Kota',
      tanggalLahir: '2009-01-01',
      jenisKelamin: 'L',
      kelas: `${jenjang}-A`,
      jenjang,
      nomorPeserta: `26-${jenjang}-${String(i + 1).padStart(3, '0')}`,
      status: 'Aktif',
    }));

  // 41 students in 2 rooms -> 21 + 20 -> 1 odd room
  const students = [...mkStudents(21, 'X'), ...mkStudents(20, 'XI')];
  const res = distributeRoomsCrossJenjang(
    students,
    [],
    { kapasitasPerRuang: 22, metode: 'silang_jenjang_11_11', jumlahRuangManual: 2 },
    'kertas',
    () => 0.2
  );

  const parityBefore = analyzeRoomParity(res.updatedStudents, res.updatedRooms, 'kertas', 1);
  assert.equal(parityBefore.nonReserveOddEntries.length, 1);
  assert.equal(parityBefore.recommendReserveRoom, true);

  const moved = moveOddStudentsToReserveRoom(res.updatedStudents, res.updatedRooms, 'kertas', 1);
  assert.equal(moved.movedCount, 1);
  assert.equal(moved.updatedRooms.some((r) => r.namaRuang === 'Ruang Cadangan'), true);
  const parityAfter = analyzeRoomParity(moved.updatedStudents, moved.updatedRooms, 'kertas', 1);
  assert.equal(parityAfter.nonReserveOddEntries.length, 0);
});

test('distributeRoomsCrossJenjang puts solo students on 12th desk rather than pairing same jenjang (X=24, XI=20 in 2 rooms)', () => {
  const mkStudents = (count: number, jenjang: string, offset: number): Student[] =>
    Array.from({ length: count }, (_, i) => ({
      id: `${jenjang}-s-${i + 1}`,
      nis: `${offset + i}`,
      nisn: `005000${String(offset + i).padStart(4, '0')}`,
      nama: `Siswa ${jenjang} ${i + 1}`,
      tempatLahir: 'Kota',
      tanggalLahir: '2009-01-01',
      jenisKelamin: i % 2 === 0 ? 'L' : 'P',
      kelas: `${jenjang}-A`,
      jenjang,
      nomorPeserta: `26-${jenjang}-${String(i + 1).padStart(3, '0')}`,
      status: 'Aktif',
    }));

  // 44 total in 2 rooms -> 22 per room, X=24, XI=20 -> each room gets 12 X + 10 XI = 12 desks (10 paired + 2 solo)
  const students = [...mkStudents(24, 'X', 1), ...mkStudents(20, 'XI', 101)];
  const res = distributeRoomsCrossJenjang(
    students,
    [],
    { kapasitasPerRuang: 22, metode: 'silang_jenjang_11_11', jumlahRuangManual: 2 },
    'kertas',
    () => 0.3
  );

  assert.equal(res.updatedRooms.length, 2);
  res.summary.forEach((s) => {
    assert.equal(Object.keys(s.jenjangCounts).length, 2);
  });

  const parity = analyzeRoomParity(res.updatedStudents, res.updatedRooms, 'kertas', 1);
  assert.equal(parity.sameJenjangDeskConflicts.length, 0);
  // Each room has 2 solo desks (#21 and #23 -> desks 11 and 12), total 4 solo desks across 2 rooms
  assert.equal(parity.soloDeskEntries.length, 4);
  assert.equal(Math.max(...res.updatedStudents.map((s) => s.nomorMeja || 0)), 23);
});

test('distributeRoomsCrossJenjang supports 24 students per room (12 full paired desks)', () => {
  const mkStudents = (count: number, jenjang: string, offset: number): Student[] =>
    Array.from({ length: count }, (_, i) => ({
      id: `${jenjang}-full-${i + 1}`,
      nis: `${offset + i}`,
      nisn: `004000${String(offset + i).padStart(4, '0')}`,
      nama: `Siswa ${jenjang} ${i + 1}`,
      tempatLahir: 'Kota',
      tanggalLahir: '2009-01-01',
      jenisKelamin: 'L',
      kelas: `${jenjang}-A`,
      jenjang,
      nomorPeserta: `26-${jenjang}-${String(i + 1).padStart(3, '0')}`,
      status: 'Aktif',
    }));

  const students = [...mkStudents(24, 'X', 1), ...mkStudents(24, 'XI', 101)];
  const res = distributeRoomsCrossJenjang(
    students,
    [],
    { kapasitasPerRuang: 24, metode: 'silang_jenjang_11_11', jumlahRuangManual: 2 },
    'kertas',
    () => 0.5
  );

  assert.equal(res.updatedRooms.length, 2);
  assert.equal(res.warnings.length, 0);
  const parity = analyzeRoomParity(res.updatedStudents, res.updatedRooms, 'kertas', 1);
  assert.equal(parity.sameJenjangDeskConflicts.length, 0);
  assert.equal(parity.soloDeskEntries.length, 0);
  assert.equal(Math.max(...res.updatedStudents.map((s) => s.nomorMeja || 0)), 24);
});

test('distributeRoomsCrossJenjang spreads minority jenjang across rooms so every room has 2 jenjangs and zero same-jenjang desks (X=32, XI=8)', () => {
  const mkStudents = (count: number, jenjang: string, offset: number): Student[] =>
    Array.from({ length: count }, (_, i) => ({
      id: `${jenjang}-skew-${i + 1}`,
      nis: `${offset + i}`,
      nisn: `003000${String(offset + i).padStart(4, '0')}`,
      nama: `Siswa ${jenjang} ${i + 1}`,
      tempatLahir: 'Kota',
      tanggalLahir: '2009-01-01',
      jenisKelamin: 'P',
      kelas: `${jenjang}-A`,
      jenjang,
      nomorPeserta: `26-${jenjang}-${String(i + 1).padStart(3, '0')}`,
      status: 'Aktif',
    }));

  const students = [...mkStudents(32, 'X', 1), ...mkStudents(8, 'XI', 101)];
  const res = distributeRoomsCrossJenjang(
    students,
    [],
    { kapasitasPerRuang: 20, metode: 'silang_jenjang_11_11', jumlahRuangManual: 2 },
    'kertas',
    () => 0.25
  );

  assert.equal(res.updatedRooms.length, 2);
  res.summary.forEach((s) => {
    assert.equal(Object.keys(s.jenjangCounts).length, 2);
  });
  const parity = analyzeRoomParity(res.updatedStudents, res.updatedRooms, 'kertas', 1);
  assert.equal(parity.sameJenjangDeskConflicts.length, 0);
});

test('22 students (11 X + 11 XI) yield 11 cross-jenjang paired desks and pass all 9 validation rules', () => {
  const mk = (count: number, jenjang: string): Student[] =>
    Array.from({ length: count }, (_, i) => ({
      id: `${jenjang}-id22-${i + 1}`,
      nis: `${jenjang}${i + 1}`,
      nisn: `0022${jenjang}${String(i + 1).padStart(3, '0')}`,
      nama: `Siswa ${jenjang} ${i + 1}`,
      tempatLahir: 'Kota',
      tanggalLahir: '2009-01-01',
      jenisKelamin: i % 2 === 0 ? 'L' : 'P',
      kelas: `${jenjang}-A`,
      jenjang,
      nomorPeserta: `26-${jenjang}-${String(i + 1).padStart(3, '0')}`,
      status: 'Aktif',
    }));

  const students = [...mk(11, 'X'), ...mk(11, 'XI')];
  const { distribution, validation } = previewRoomDistribution(
    students,
    [],
    { kapasitasPerRuang: 22, metode: 'silang_jenjang_11_11', jumlahRuangManual: 1, allowIncidental23: true },
    'kertas',
    1,
    () => 0.3
  );

  assert.equal(distribution.updatedRooms.length, 1);
  assert.equal(validation.isValid, true);
  assert.equal(validation.errors.length, 0);
  assert.equal(validation.roomMetrics[0].pairedDesks, 11);
  assert.equal(validation.roomMetrics[0].soloDesks, 0);
  assert.equal(validation.roomMetrics[0].sameJenjangConflicts, 0);
});

test('23 students (12 X + 11 XI) uses solo 23rd seat without reserve room and validates facility addition INSIDENTAL', () => {
  const mk = (count: number, jenjang: string): Student[] =>
    Array.from({ length: count }, (_, i) => ({
      id: `${jenjang}-inc23-${i + 1}`,
      nis: `${jenjang}${i + 1}`,
      nisn: `0023${jenjang}${String(i + 1).padStart(3, '0')}`,
      nama: `Siswa ${jenjang} ${i + 1}`,
      tempatLahir: 'Kota',
      tanggalLahir: '2009-01-01',
      jenisKelamin: 'L',
      kelas: `${jenjang}-A`,
      jenjang,
      nomorPeserta: `26-${jenjang}-${String(i + 1).padStart(3, '0')}`,
      status: 'Aktif',
    }));

  const students = [...mk(12, 'X'), ...mk(11, 'XI')];
  const initialRoom: ExamRoom = {
    id: 'room-1',
    nomorRuang: '01',
    namaRuang: 'Ruang 01',
    kapasitas: 22,
    jumlahBaris: 4,
    jumlahKolom: 6,
    polaTempatDuduk: 'straight',
    posisiPintu: 'kiri_depan',
    posisiPengawas: 'depan_tengah',
    mejaAwal: 11,
    kursiAwal: 22,
    mejaTambahan: 0,
    kursiTambahan: 0,
    statusFasilitas: 'NORMAL',
  };

  // Without extra desk/chair, facility check fails cleanly
  const firstRun = previewRoomDistribution(
    students,
    [initialRoom],
    { kapasitasPerRuang: 23, metode: 'silang_jenjang_11_11', jumlahRuangManual: 1, allowIncidental23: true },
    'kertas',
    1,
    () => 0.4
  );
  assert.equal(firstRun.distribution.updatedRooms.length, 1);
  assert.equal(firstRun.distribution.updatedRooms.some((r) => /cadangan/i.test(r.namaRuang)), false);
  assert.equal(firstRun.validation.isValid, false);
  assert.equal(
    firstRun.validation.checks.find((c) => c.code === 'facility_sufficiency')?.passed,
    false
  );
  assert.equal(firstRun.validation.roomMetrics[0].pairedDesks, 11);
  assert.equal(firstRun.validation.roomMetrics[0].soloDesks, 1);
  assert.equal(firstRun.validation.roomMetrics[0].sameJenjangConflicts, 0);

  // Add +1 meja and +1 kursi via Manajemen Meja & Kursi -> becomes INSIDENTAL and passes 100%
  const upgradedRoom = normalizeRoomFacilities(initialRoom, {
    mejaTambahan: 1,
    kursiTambahan: 1,
    statusFasilitas: 'INSIDENTAL',
    keteranganFasilitas: 'Insidental siswa ke-23 duduk sendiri',
  });
  assert.equal(getRoomFacilityTotals(upgradedRoom).totalMeja, 12);
  assert.equal(getRoomFacilityTotals(upgradedRoom).totalKursi, 23);

  const secondRun = previewRoomDistribution(
    students,
    [upgradedRoom],
    { kapasitasPerRuang: 23, metode: 'silang_jenjang_11_11', jumlahRuangManual: 1, allowIncidental23: true },
    'kertas',
    1,
    () => 0.4
  );
  assert.equal(secondRun.validation.isValid, true);
  assert.equal(secondRun.validation.errors.length, 0);
  // Preserves facility additions across Re-Generate!
  assert.equal(secondRun.distribution.updatedRooms[0].mejaTambahan, 1);
  assert.equal(secondRun.distribution.updatedRooms[0].statusFasilitas, 'INSIDENTAL');
});

test('Imbalanced counts (16 X + 6 XI) never create same-jenjang desk pairs and report facility requirement', () => {
  const mk = (count: number, jenjang: string): Student[] =>
    Array.from({ length: count }, (_, i) => ({
      id: `${jenjang}-imb-${i + 1}`,
      nis: `${jenjang}${i + 1}`,
      nisn: `0016${jenjang}${String(i + 1).padStart(3, '0')}`,
      nama: `Siswa ${jenjang} ${i + 1}`,
      tempatLahir: 'Kota',
      tanggalLahir: '2009-01-01',
      jenisKelamin: 'P',
      kelas: `${jenjang}-A`,
      jenjang,
      nomorPeserta: `26-${jenjang}-${String(i + 1).padStart(3, '0')}`,
      status: 'Aktif',
    }));

  const students = [...mk(16, 'X'), ...mk(6, 'XI')];
  const { distribution, validation } = previewRoomDistribution(
    students,
    [],
    { kapasitasPerRuang: 22, metode: 'silang_jenjang_11_11', jumlahRuangManual: 1 },
    'kertas',
    1,
    () => 0.1
  );

  // Absolute rule: 0 same-jenjang pairs even under heavy imbalance
  assert.equal(validation.roomMetrics[0].sameJenjangConflicts, 0);
  assert.equal(validation.roomMetrics[0].pairedDesks, 6);
  assert.equal(validation.roomMetrics[0].soloDesks, 10);
  assert.equal(distribution.updatedRooms.length, 1);
  // Reports facility shortage cleanly (needs 16 desks, base room has 11 desks)
  assert.equal(
    validation.checks.find((c) => c.code === 'facility_sufficiency')?.passed,
    false
  );
});

test('Edit Denah moveOrSwapStudentSeat blocks same-jenjang desk pairing and allows valid swaps', () => {
  const room: ExamRoom = {
    id: 'room-1',
    nomorRuang: '01',
    namaRuang: 'Ruang 01',
    kapasitas: 22,
    jumlahBaris: 4,
    jumlahKolom: 6,
    polaTempatDuduk: 'straight',
    posisiPintu: 'kiri_depan',
    posisiPengawas: 'depan_tengah',
    mejaAwal: 11,
    kursiAwal: 22,
  };

  const students: Student[] = [
    { id: 's1', nis: '1', nisn: '1', nama: 'A', tempatLahir: 'K', tanggalLahir: '2009-01-01', jenisKelamin: 'L', kelas: 'X-A', jenjang: 'X', nomorPeserta: '01', status: 'Aktif', ruangId: 'room-1', nomorMeja: 1 },
    { id: 's2', nis: '2', nisn: '2', nama: 'B', tempatLahir: 'K', tanggalLahir: '2009-01-01', jenisKelamin: 'P', kelas: 'XI-A', jenjang: 'XI', nomorPeserta: '02', status: 'Aktif', ruangId: 'room-1', nomorMeja: 2 },
    { id: 's3', nis: '3', nisn: '3', nama: 'C', tempatLahir: 'K', tanggalLahir: '2009-01-01', jenisKelamin: 'L', kelas: 'X-B', jenjang: 'X', nomorPeserta: '03', status: 'Aktif', ruangId: 'room-1', nomorMeja: 3 },
    { id: 's4', nis: '4', nisn: '4', nama: 'D', tempatLahir: 'K', tanggalLahir: '2009-01-01', jenisKelamin: 'P', kelas: 'XI-B', jenjang: 'XI', nomorPeserta: '04', status: 'Aktif', ruangId: 'room-1', nomorMeja: 4 },
  ];

  // Attempt to swap s1 (X) with s4 (XI) -> puts s1 (X) next to s3 (X) at Meja 2 -> MUST BE BLOCKED!
  const invalidSwap = moveOrSwapStudentSeat(students, [room], 's1', 'room-1', 4, false);
  assert.equal(invalidSwap.ok, false);
  assert.match(invalidSwap.error || '', /jenjang yang sama/i);

  // Swap s1 (X) with s3 (X) -> preserves X+XI on both Meja 1 and Meja 2 -> MUST SUCCEED!
  const validSwap = moveOrSwapStudentSeat(students, [room], 's1', 'room-1', 3, false);
  assert.equal(validSwap.ok, true);
  const valAfter = validateRoomDistribution(validSwap.updatedStudents, [room], 'kertas', 1);
  assert.equal(valAfter.isValid, true);

  // Swap entire physical Desk 1 <-> Desk 2
  const deskSwapped = swapPhysicalDesksInRoom(validSwap.updatedStudents, 'room-1', 1, 2, false);
  assert.equal(deskSwapped.find((s) => s.id === 's2')?.nomorMeja, 4);
  assert.equal(deskSwapped.find((s) => s.id === 's4')?.nomorMeja, 2);
});

test('Section 9A: 173 peserta, 4 ruang, 1 sesi MUST REJECT generate before any allocation', () => {
  const mk = (count: number, jenjang: string, offset: number): Student[] =>
    Array.from({ length: count }, (_, i) => ({
      id: `${jenjang}-173-${i + 1}`,
      nis: `${offset + i}`,
      nisn: `0173${jenjang}${String(i + 1).padStart(3, '0')}`,
      nama: `Siswa ${jenjang} ${i + 1}`,
      tempatLahir: 'Kota',
      tanggalLahir: '2009-01-01',
      jenisKelamin: i % 2 === 0 ? 'L' : 'P',
      kelas: `${jenjang}-A`,
      jenjang,
      nomorPeserta: `26-${jenjang}-${String(i + 1).padStart(3, '0')}`,
      status: 'Aktif',
    }));

  const students = [
    ...mk(60, 'X', 1),
    ...mk(58, 'XI', 101),
    ...mk(55, 'XII', 201),
  ];
  assert.equal(students.length, 173);

  const feasibility = validateGenerateFeasibility(students, [], 4, 1);
  assert.equal(feasibility.isFeasible, false);
  assert.equal(feasibility.totalActiveStudents, 173);
  assert.equal(feasibility.jumlahRuang, 4);
  assert.equal(feasibility.jumlahSesi, 1);
  assert.equal(feasibility.totalKapasitasMaks, 96);
  assert.equal(feasibility.unaccommodatedCount, 77);
  assert.equal(feasibility.recommendedMinSesi, 2);
  assert.equal(feasibility.recommendedMinRuang, 8);
  assert.equal(feasibility.reasons.length > 0, true);

  const plan = generateValidatedRoomPlan(
    students,
    [],
    { kapasitasPerRuang: 22, metode: 'silang_jenjang_11_11', jumlahRuangManual: 4 },
    'kertas',
    4,
    1,
    () => 0.4
  );
  assert.equal(plan.accepted, false);
  assert.equal(plan.distribution, null);
  assert.equal(plan.validation, null);
});

test('Section 9B: 173 peserta, 4 ruang, 2 sesi MUST ACCEPT and partition cleanly across Ruang 01..04 with 0 conflicts', () => {
  const mk = (count: number, jenjang: string, offset: number): Student[] =>
    Array.from({ length: count }, (_, i) => ({
      id: `${jenjang}-s2-${i + 1}`,
      nis: `${offset + i}`,
      nisn: `0273${jenjang}${String(i + 1).padStart(3, '0')}`,
      nama: `Siswa ${jenjang} ${i + 1}`,
      tempatLahir: 'Kota',
      tanggalLahir: '2009-01-01',
      jenisKelamin: i % 2 === 0 ? 'L' : 'P',
      kelas: `${jenjang}-A`,
      jenjang,
      nomorPeserta: `26-${jenjang}-${String(i + 1).padStart(3, '0')}`,
      status: 'Aktif',
    }));

  const students = [
    ...mk(60, 'X', 1),
    ...mk(58, 'XI', 101),
    ...mk(55, 'XII', 201),
  ];

  const plan = generateValidatedRoomPlan(
    students,
    [],
    { kapasitasPerRuang: 22, metode: 'silang_jenjang_11_11', jumlahRuangManual: 4 },
    'kertas',
    4,
    2,
    () => 0.35
  );

  assert.equal(plan.accepted, true);
  if (!plan.accepted) return;

  assert.equal(plan.feasibility.totalKapasitasMaks, 192);
  assert.equal(plan.distribution.updatedRooms.length, 4);
  assert.equal(plan.validation.isValid, true);
  assert.equal(plan.validation.errors.length, 0);

  const allocated = plan.distribution.updatedStudents;
  assert.equal(allocated.length, 173);

  const sesi1 = allocated.filter((s) => s.sesi === 1);
  const sesi2 = allocated.filter((s) => s.sesi === 2);
  assert.equal(sesi1.length + sesi2.length, 173);
  assert.equal(Math.abs(sesi1.length - sesi2.length) <= 1, true);

  // Zero duplicate IDs & every student placed in Ruang 01..04
  const ids = new Set(allocated.map((s) => s.id));
  assert.equal(ids.size, 173);
  const validRoomIds = new Set(plan.distribution.updatedRooms.map((r) => r.id));
  assert.equal(allocated.every((s) => s.ruangId && validRoomIds.has(s.ruangId) && (s.nomorMeja || 0) >= 1), true);

  // Zero same-jenjang desk conflicts across both sessions
  assert.equal(
    plan.validation.roomMetrics.every((m) => m.sameJenjangConflicts === 0 && m.seatCollisions === 0 && m.studentCount <= 24),
    true
  );
});

test('Section 9C: 185 peserta across 4 ruang × 2 sesi validates 23 solo & 24 paired desk capacities without errors', () => {
  const mk = (count: number, jenjang: string, offset: number): Student[] =>
    Array.from({ length: count }, (_, i) => ({
      id: `${jenjang}-185-${i + 1}`,
      nis: `${offset + i}`,
      nisn: `0185${jenjang}${String(i + 1).padStart(3, '0')}`,
      nama: `Siswa ${jenjang} ${i + 1}`,
      tempatLahir: 'Kota',
      tanggalLahir: '2009-01-01',
      jenisKelamin: 'L',
      kelas: `${jenjang}-A`,
      jenjang,
      nomorPeserta: `26-${jenjang}-${String(i + 1).padStart(3, '0')}`,
      status: 'Aktif',
    }));

  // 185 = 4 rooms * 23 (Sesi 1 = 93 -> 24,23,23,23) + 4 rooms * 23 (Sesi 2 = 92 -> 23,23,23,23)
  const students = [
    ...mk(63, 'X', 1),
    ...mk(62, 'XI', 101),
    ...mk(60, 'XII', 201),
  ];

  const plan = generateValidatedRoomPlan(
    students,
    [],
    { kapasitasPerRuang: 22, metode: 'silang_jenjang_11_11', jumlahRuangManual: 4 },
    'kertas',
    4,
    2,
    () => 0.45
  );

  assert.equal(plan.accepted, true);
  if (!plan.accepted) return;

  assert.equal(plan.validation.isValid, true);
  assert.equal(plan.validation.errors.length, 0);
  assert.equal(plan.validation.roomMetrics.some((m) => m.studentCount === 24), true);
  assert.equal(plan.validation.roomMetrics.some((m) => m.studentCount === 23 && m.soloDesks === 1), true);
});



