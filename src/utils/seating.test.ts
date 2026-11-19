import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeRoomParity,
  calculateRequiredRooms,
  distributeRoomsCrossJenjang,
  distributeStudents,
  getOrderedSeats,
  moveOddStudentsToReserveRoom,
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

