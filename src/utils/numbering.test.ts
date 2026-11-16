import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatParticipantNumber,
  sortStudentsForNumbering,
  generateStudentNumbers,
  validateParticipantNumbers,
} from './numbering';
import { NumberingConfig, Student } from '../types';

const mockStudents: Student[] = [
  {
    id: 's1',
    nis: '1001',
    nisn: '0081234567',
    nama: 'Budi Santoso',
    tempatLahir: 'Bandung',
    tanggalLahir: '2010-05-12',
    jenisKelamin: 'L',
    kelas: 'IX-B',
    nomorPeserta: '',
    status: 'Aktif',
  },
  {
    id: 's2',
    nis: '1002',
    nisn: '0089876543',
    nama: 'Aisyah Putri',
    tempatLahir: 'Jakarta',
    tanggalLahir: '2010-08-20',
    jenisKelamin: 'P',
    kelas: 'IX-A',
    nomorPeserta: '',
    status: 'Aktif',
  },
  {
    id: 's3',
    nis: '1003',
    nisn: '0085556677',
    nama: 'Zainal Abidin',
    tempatLahir: 'Semarang',
    tanggalLahir: '2010-01-15',
    jenisKelamin: 'L',
    kelas: 'IX-A',
    nomorPeserta: '',
    status: 'Aktif',
  },
  {
    id: 's4',
    nis: '1004',
    nisn: '0089999999',
    nama: 'Dewi Lestari (Cadangan)',
    tempatLahir: 'Surabaya',
    tanggalLahir: '2010-03-01',
    jenisKelamin: 'P',
    kelas: 'IX-B',
    nomorPeserta: '',
    status: 'Cadangan',
  },
];

const mockConfig: NumberingConfig = {
  kodeTahun: '26',
  kodeMadrasah: '01',
  digitUrut: 3,
  pemisah: '-',
  urutBerdasarkan: 'kelas_lalu_nama',
};

test('formatParticipantNumber correctly generates configured string', () => {
  assert.equal(formatParticipantNumber(mockConfig, 1), '26-01-001');
  assert.equal(formatParticipantNumber(mockConfig, 45), '26-01-045');
  assert.equal(
    formatParticipantNumber({ ...mockConfig, digitUrut: 4, pemisah: '.' }, 7),
    '26.01.0007'
  );
});

test('sortStudentsForNumbering sorts by class then name', () => {
  const sorted = sortStudentsForNumbering(mockStudents, 'kelas_lalu_nama');
  // IX-A should come before IX-B
  assert.equal(sorted[0].nama, 'Aisyah Putri'); // IX-A
  assert.equal(sorted[1].nama, 'Zainal Abidin'); // IX-A
  assert.equal(sorted[2].nama, 'Budi Santoso'); // IX-B
});

test('generateStudentNumbers assigns unique sequential numbers to active students', () => {
  const numbered = generateStudentNumbers(mockStudents, mockConfig);
  const s2 = numbered.find((s) => s.id === 's2'); // IX-A Aisyah
  const s3 = numbered.find((s) => s.id === 's3'); // IX-A Zainal
  const s1 = numbered.find((s) => s.id === 's1'); // IX-B Budi
  const s4 = numbered.find((s) => s.id === 's4'); // Cadangan

  assert.equal(s2?.nomorPeserta, '26-01-001');
  assert.equal(s3?.nomorPeserta, '26-01-002');
  assert.equal(s1?.nomorPeserta, '26-01-003');
  assert.equal(s4?.nomorPeserta, ''); // Not assigned
});

test('validateParticipantNumbers detects duplicates and missing numbers', () => {
  const validCheck = validateParticipantNumbers(generateStudentNumbers(mockStudents, mockConfig));
  assert.equal(validCheck.isValid, true);
  assert.equal(validCheck.duplicates.length, 0);

  // Intentional duplicate
  const duplicated = [
    { ...mockStudents[0], nomorPeserta: '26-01-001' },
    { ...mockStudents[1], nomorPeserta: '26-01-001' },
    { ...mockStudents[2], nomorPeserta: '' },
  ];
  const invalidCheck = validateParticipantNumbers(duplicated);
  assert.equal(invalidCheck.isValid, false);
  assert.equal(invalidCheck.duplicates.includes('26-01-001'), true);
  assert.equal(invalidCheck.missingCount, 1);
});
