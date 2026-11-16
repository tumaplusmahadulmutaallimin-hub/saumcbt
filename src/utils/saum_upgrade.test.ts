import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {
  detectHeaderMapping,
  extractJenjang,
  parseSpreadsheetBuffer,
  validateDnpuRows,
} from './dnpu';
import { formatParticipantNumber, generateStudentNumbers } from './numbering';
import {
  computeClassRangesInRoom,
  distributeRoomsCrossJenjang,
  distributeSessions,
  validateScheduleConflicts,
  validateSupervisorConflicts,
} from './seating';
import { ExamRoom, ExamSchedule, NumberingConfig, Student, SupervisorAssignment } from '../types';

test('parseSpreadsheetBuffer preserves leading zeros on NISN and NIS', () => {
  const aoa = [
    ['NISN', 'NIS', 'NAMA', 'JK', 'KELAS'],
    ['0110000001', '002601', 'Ahmad', 'L', 'X-A'],
    ['0098765432', '002602', 'Fatimah', 'P', 'XII-A'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'DNPU');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

  const parsed = parseSpreadsheetBuffer(buf);
  assert.equal(parsed.headers.length, 5);
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[0].NISN, '0110000001');
  assert.equal(parsed.rows[0].NIS, '002601');

  const mapping = detectHeaderMapping(parsed.headers);
  const validated = validateDnpuRows(parsed.rows, mapping, ['X-A', 'XII-A']);
  assert.equal(validated.every((v) => v.isValid), true);
});

test('validateDnpuRows detects duplicate NISN, empty NIS, and unregistered classes with row numbers', () => {
  const rows = [
    { NISN: '0110000001', NIS: '2601', NAMA: 'Ahmad', JK: 'L', KELAS: 'X-A' },
    { NISN: '0110000001', NIS: '', NAMA: 'Budi', JK: 'L', KELAS: 'XIII-Z' },
  ];
  const validated = validateDnpuRows(
    rows,
    { nisn: 'NISN', nis: 'NIS', nama: 'NAMA', jk: 'JK', kelas: 'KELAS' },
    ['X-A']
  );

  assert.equal(validated[0].isValid, false); // duplicate NISN also flagged on first occurrence or second
  assert.equal(validated[1].isValid, false);
  assert.equal(validated[1].rowNumber, 3);
  assert.equal(validated[1].errors.some((e) => e.includes('NISN ganda')), true);
  assert.equal(validated[1].errors.some((e) => e.includes('NIS kosong')), true);
  assert.equal(validated[1].warnings.some((w) => w.includes('XIII-Z')), true);
});

test('configurable numbering supports class codes and starting number', () => {
  const config: NumberingConfig = {
    kodeTahun: '26',
    kodeMadrasah: '01',
    digitUrut: 3,
    nomorAwal: 1,
    pemisah: '-',
    polaFormat: '{tahun}{sep}{kodeKelas}{sep}{urut}',
    kodeKelasMap: { X: '10', XI: '11', XII: '12' },
    urutBerdasarkan: 'kelas_lalu_nama',
  };

  assert.equal(formatParticipantNumber(config, 1, 'X-A'), '26-10-001');
  assert.equal(formatParticipantNumber(config, 12, 'XII-B'), '26-12-012');

  const students: Student[] = [
    { id: '1', nis: '1', nisn: '01', nama: 'Zaid', tempatLahir: '', tanggalLahir: '', jenisKelamin: 'L', kelas: 'XII-A', nomorPeserta: '', status: 'Aktif' },
    { id: '2', nis: '2', nisn: '02', nama: 'Ali', tempatLahir: '', tanggalLahir: '', jenisKelamin: 'L', kelas: 'X-A', nomorPeserta: '', status: 'Aktif' },
  ];

  const numbered = generateStudentNumbers(students, config);
  // X-A comes before XII-A
  assert.equal(numbered.find((s) => s.id === '2')?.nomorPeserta, '26-10-001');
  assert.equal(numbered.find((s) => s.id === '1')?.nomorPeserta, '26-12-002');
});

test('distributeSessions and distributeRoomsCrossJenjang achieve 11:11 mix max 22 per room', () => {
  const students: Student[] = [];
  for (let i = 1; i <= 22; i++) {
    students.push({
      id: `x-${i}`, nis: `10${i}`, nisn: `0010${i}`, nama: `Siswa X ${i}`,
      tempatLahir: '', tanggalLahir: '', jenisKelamin: 'L', kelas: 'X-A',
      jenjang: 'X', nomorPeserta: `26-10-${String(i).padStart(3, '0')}`, status: 'Aktif',
    });
  }
  for (let i = 1; i <= 22; i++) {
    students.push({
      id: `xii-${i}`, nis: `20${i}`, nisn: `0020${i}`, nama: `Siswa XII ${i}`,
      tempatLahir: '', tanggalLahir: '', jenisKelamin: 'P', kelas: 'XII-A',
      jenjang: 'XII', nomorPeserta: `26-12-${String(i).padStart(3, '0')}`, status: 'Aktif',
    });
  }

  // Deterministic rng
  let seed = 1;
  const rng = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // Online mode: 2 sessions -> 22 per session
  const sessioned = distributeSessions(students, 2, rng);
  const s1 = sessioned.filter((s) => s.sesi === 1);
  const s2 = sessioned.filter((s) => s.sesi === 2);
  assert.equal(s1.length, 22);
  assert.equal(s2.length, 22);

  // Kertas mode: 44 students -> 2 rooms of 22 each (11 X + 11 XII)
  const rooms: ExamRoom[] = [
    { id: 'r1', nomorRuang: '01', namaRuang: 'Ruang 01', kapasitas: 22, jumlahBaris: 4, jumlahKolom: 6, polaTempatDuduk: 'straight', posisiPintu: 'kiri_depan', posisiPengawas: 'depan_tengah' },
    { id: 'r2', nomorRuang: '02', namaRuang: 'Ruang 02', kapasitas: 22, jumlahBaris: 4, jumlahKolom: 6, polaTempatDuduk: 'straight', posisiPintu: 'kiri_depan', posisiPengawas: 'depan_tengah' },
  ];

  const dist = distributeRoomsCrossJenjang(students, rooms, { kapasitasPerRuang: 22, metode: 'silang_jenjang_11_11' }, 'kertas', rng);
  assert.equal(dist.summary.length, 2);
  assert.equal(dist.summary[0].total, 22);
  assert.equal(dist.summary[1].total, 22);
  assert.equal(dist.summary[0].jenjangCounts['X'], 11);
  assert.equal(dist.summary[0].jenjangCounts['XII'], 11);
  assert.equal(extractJenjang('XII-C'), 'XII');
});

test('computeClassRangesInRoom splits non-contiguous ranges cleanly', () => {
  const allStudents: Student[] = [1, 2, 3, 4, 5].map((n) => ({
    id: `s${n}`, nis: `${n}`, nisn: `${n}`, nama: `N${n}`,
    tempatLahir: '', tanggalLahir: '', jenisKelamin: 'L', kelas: 'X-A',
    nomorPeserta: `00${n}`, status: 'Aktif',
  }));
  // Room only has 001, 002, and 004, 005 (003 is in another room)
  const inRoom = [allStudents[0], allStudents[1], allStudents[3], allStudents[4]];
  const ranges = computeClassRangesInRoom(inRoom, allStudents);
  assert.equal(ranges.length, 1);
  assert.deepEqual(ranges[0].ranges, ['001–002', '004–005']);
});

test('schedule and supervisor conflict validators detect overlaps', () => {
  const schedules: ExamSchedule[] = [
    { id: 'sc1', mapelId: 'm1', tanggal: '2026-04-06', hari: 'Senin', sesi: 1, waktuMulai: '07:30', waktuSelesai: '09:00', ruangIds: ['room-1'] },
    { id: 'sc2', mapelId: 'm2', tanggal: '2026-04-06', hari: 'Senin', sesi: 1, waktuMulai: '08:00', waktuSelesai: '09:30', ruangIds: ['room-1', 'room-2'] },
  ];
  const schedConflicts = validateScheduleConflicts(schedules);
  assert.equal(schedConflicts.length > 0, true);

  const assignments: SupervisorAssignment[] = [
    { id: 'a1', scheduleId: 'sc1', roomId: 'room-1', sesi: 1, pengawas1Id: 'guru-1', pengawas2Id: 'guru-2' },
    { id: 'a2', scheduleId: 'sc2', roomId: 'room-2', sesi: 1, pengawas1Id: 'guru-1', pengawas2Id: 'guru-3' },
  ];
  const supConflicts = validateSupervisorConflicts(assignments, schedules);
  assert.equal(supConflicts.length > 0, true);
});
