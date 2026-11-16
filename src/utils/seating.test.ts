import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateRequiredRooms,
  distributeStudents,
  getOrderedSeats,
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

  // Check no overlaps
  const assignedIds = new Set(result.updatedStudents.map((s) => s.id));
  assert.equal(assignedIds.size, 25);
});
