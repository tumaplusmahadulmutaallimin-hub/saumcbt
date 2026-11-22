import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  getCardGridMetrics,
  getPaperDimensionsMm,
  getSheetScreenStyle,
  normalizeTargetPaperPreset,
} from './printLayout';
import { buildSchedulePrintModel } from './schedulePrint';
import { KartuPeserta } from '../components/documents/KartuPeserta';
import { NomorMejaCetak } from '../components/documents/NomorMejaCetak';
import { JadwalUjianCetak } from '../components/documents/JadwalUjianCetak';
import {
  ExamConfig,
  ExamRoom,
  ExamSchedule,
  ExamSubject,
  MadrasahProfile,
  NumberingConfig,
  PaperPreset,
  Student,
  Supervisor,
  SupervisorAssignment,
} from '../types';

const mockProfile: MadrasahProfile = {
  namaMadrasah: 'MA Al-Hikmah',
  jenjang: 'MA',
  nsm: '131235000001',
  npsn: '20500001',
  alamat: 'Jl. Pendidikan No. 1',
  desaKelurahan: 'Sukamaju',
  kecamatan: 'Tengah',
  kabupatenKota: 'Kab. Contoh',
  provinsi: 'Jawa Timur',
  kodePos: '61234',
  telepon: '031-123456',
  email: 'info@madrasah.sch.id',
  website: 'madrasah.sch.id',
  namaKepala: 'Drs. Ahmad Fauzi, M.Pd.',
  nipKepala: '197001011999031001',
  namaKetuaPanitia: 'Siti Aminah, S.Pd.',
  nipKetuaPanitia: '198002022005012002',
  tahunPelajaran: '2025/2026',
  semester: 'Genap',
  jenisUjian: 'Asesmen Madrasah',
  tempatTandaTangan: 'Contoh',
  tanggalSurat: '2026-05-01',
};

const mockExamConfig: ExamConfig = {
  id: 'exam-1',
  namaUjian: 'Asesmen Sumatif Akhir Tahun',
  tahunPelajaran: '2025/2026',
  jenjangLabel: 'X, XI',
  registeredClasses: ['X-A', 'XI-A'],
  tanggalMulai: '2026-05-11',
  tanggalSelesai: '2026-05-15',
  jumlahHari: 2,
  jumlahMapel: 4,
  moda: 'online',
  jumlahRuang: 2,
  jumlahSesi: 1,
  jamPelaksanaan: '07:30 - 11:00 WIB',
  seragamPerHariJenjang: {
    Senin: { X: 'Putih Abu', XI: 'Batik' },
    Selasa: { X: 'Pramuka', XI: 'Putih Abu' },
  },
  isDnpuFinalized: true,
  isNomorFinalized: true,
  isDenahLokasiFinalized: true,
};

const mockRooms: ExamRoom[] = [
  {
    id: 'r-1',
    nomorRuang: '01',
    namaRuang: 'Ruang 01',
    kapasitas: 22,
    jumlahBaris: 4,
    jumlahKolom: 3,
    polaTempatDuduk: 'snake',
    posisiPintu: 'kiri_depan',
    posisiPengawas: 'depan_tengah',
  },
  {
    id: 'r-2',
    nomorRuang: '02',
    namaRuang: 'Ruang 02',
    kapasitas: 22,
    jumlahBaris: 4,
    jumlahKolom: 3,
    polaTempatDuduk: 'snake',
    posisiPintu: 'kiri_depan',
    posisiPengawas: 'depan_tengah',
  },
];

const mockNumbering: NumberingConfig = {
  kodeTahun: '26',
  kodeMadrasah: '01',
  digitUrut: 3,
  pemisah: '-',
  urutBerdasarkan: 'kelas_lalu_nama',
  barcodeMode: 'auto',
  showDeskNumber: true,
};

function makeStudents(count: number): Student[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `st-${i + 1}`,
    nis: `100${i + 1}`,
    nisn: `00800000${String(i + 1).padStart(2, '0')}`,
    nama: `Peserta Uji ${i + 1}`,
    tempatLahir: 'Surabaya',
    tanggalLahir: '2009-03-10',
    jenisKelamin: i % 2 === 0 ? 'L' : 'P',
    kelas: i % 2 === 0 ? 'X-A' : 'XI-A',
    jenjang: i % 2 === 0 ? 'X' : 'XI',
    nomorPeserta: `26-01-${String(i + 1).padStart(3, '0')}`,
    sesi: 1,
    ruangId: i < 6 ? 'r-1' : 'r-2',
    nomorMeja: (i % 6) + 1,
    usernameUjian: `U${String(i + 1).padStart(3, '0')}`,
    passwordUjian: `P${String(i + 1).padStart(5, '0')}`,
    status: 'Aktif',
  }));
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

test('F4 Portrait (210x330mm) & F4 Landscape (330x210mm) with 15mm margins yield 180x300mm and 300x180mm printable areas', () => {
  const f4Portrait = getPaperDimensionsMm('F4', 'portrait');
  assert.deepEqual(f4Portrait, { widthMm: 210, heightMm: 330 });

  const f4Landscape = getPaperDimensionsMm('F4', 'landscape');
  assert.deepEqual(f4Landscape, { widthMm: 330, heightMm: 210 });

  const legacy6mm: PaperPreset = {
    id: 'kartu_peserta',
    label: 'Kartu Peserta',
    size: 'F4',
    orientation: 'portrait',
    marginTopMm: 6,
    marginBottomMm: 6,
    marginLeftMm: 6,
    marginRightMm: 6,
    cardsPerPage: 6,
    fontSizePt: 9.5,
    lineHeight: 1.25,
    showKop: false,
    headerText: '',
    footerText: '',
  };

  const normalizedKartu = normalizeTargetPaperPreset('kartu_peserta', legacy6mm);
  assert.equal(normalizedKartu?.marginTopMm, 15);
  assert.equal(normalizedKartu?.marginRightMm, 15);
  assert.equal(normalizedKartu?.marginBottomMm, 15);
  assert.equal(normalizedKartu?.marginLeftMm, 15);

  const metrics = getCardGridMetrics(normalizedKartu, { defaultSize: 'F4', gapMm: 3 });
  assert.equal(metrics.cardsPerPage, 6);
  assert.equal(metrics.printableWidthMm, 180);
  assert.equal(metrics.printableHeightMm, 300);

  const schedPreset = normalizeTargetPaperPreset('jadwal_ujian');
  const schedStyle = getSheetScreenStyle(schedPreset);
  assert.equal((schedStyle as Record<string, string>)['--saum-sheet-w'], '330mm');
  assert.equal((schedStyle as Record<string, string>)['--saum-sheet-h'], '210mm');
  assert.equal((schedStyle as Record<string, string>)['--saum-printable-w'], '300mm');
  assert.equal((schedStyle as Record<string, string>)['--saum-printable-h'], '180mm');
});

test('KartuPeserta renders exact 6/7/12 pagination (1/2/2 F4 pages) with 2x3 grid and 180x300mm printable area', () => {
  const html6 = renderToStaticMarkup(
    React.createElement(KartuPeserta, {
      profile: mockProfile,
      examConfig: mockExamConfig,
      students: makeStudents(6),
      rooms: mockRooms,
      numberingConfig: mockNumbering,
    })
  );
  assert.equal(countOccurrences(html6, 'data-testid="kartu-peserta-page"'), 1);
  assert.equal(countOccurrences(html6, 'data-testid="kartu-peserta-card"'), 6);
  assert.ok(html6.includes('print-grid-2x3'));
  assert.ok(html6.includes('--saum-sheet-w:210mm'));
  assert.ok(html6.includes('--saum-sheet-h:330mm'));
  assert.ok(html6.includes('--saum-printable-w:180mm'));
  assert.ok(html6.includes('--saum-printable-h:300mm'));

  const html7 = renderToStaticMarkup(
    React.createElement(KartuPeserta, {
      profile: mockProfile,
      examConfig: mockExamConfig,
      students: makeStudents(7),
      rooms: mockRooms,
      numberingConfig: mockNumbering,
    })
  );
  assert.equal(countOccurrences(html7, 'data-testid="kartu-peserta-page"'), 2);
  assert.equal(countOccurrences(html7, 'data-testid="kartu-peserta-card"'), 7);
  assert.equal(countOccurrences(html7, 'print-grid-2x3'), 2);

  const html12 = renderToStaticMarkup(
    React.createElement(KartuPeserta, {
      profile: mockProfile,
      examConfig: mockExamConfig,
      students: makeStudents(12),
      rooms: mockRooms,
      numberingConfig: mockNumbering,
    })
  );
  assert.equal(countOccurrences(html12, 'data-testid="kartu-peserta-page"'), 2);
  assert.equal(countOccurrences(html12, 'data-testid="kartu-peserta-card"'), 12);
});

test('NomorMejaCetak renders exact 6/7/12 pagination (1/2/2 F4 pages) in 2x3 grid matching KartuPeserta geometry', () => {
  for (const printStyle of ['label_lengkap', 'kartu_angka_besar'] as const) {
    const html6 = renderToStaticMarkup(
      React.createElement(NomorMejaCetak, {
        profile: mockProfile,
        examConfig: mockExamConfig,
        students: makeStudents(6),
        rooms: mockRooms,
        numberingConfig: mockNumbering,
        printStyle,
      })
    );
    assert.equal(countOccurrences(html6, 'data-testid="nomor-meja-page"'), 1);
    assert.equal(countOccurrences(html6, 'data-testid="nomor-meja-card"'), 6);
    assert.ok(html6.includes('print-grid-2x3'));
    assert.ok(html6.includes('--saum-printable-w:180mm'));
    assert.ok(html6.includes('--saum-printable-h:300mm'));

    const html7 = renderToStaticMarkup(
      React.createElement(NomorMejaCetak, {
        profile: mockProfile,
        examConfig: mockExamConfig,
        students: makeStudents(7),
        rooms: mockRooms,
        numberingConfig: mockNumbering,
        printStyle,
      })
    );
    assert.equal(countOccurrences(html7, 'data-testid="nomor-meja-page"'), 2);
    assert.equal(countOccurrences(html7, 'data-testid="nomor-meja-card"'), 7);

    const html12 = renderToStaticMarkup(
      React.createElement(NomorMejaCetak, {
        profile: mockProfile,
        examConfig: mockExamConfig,
        students: makeStudents(12),
        rooms: mockRooms,
        numberingConfig: mockNumbering,
        printStyle,
      })
    );
    assert.equal(countOccurrences(html12, 'data-testid="nomor-meja-page"'), 2);
    assert.equal(countOccurrences(html12, 'data-testid="nomor-meja-card"'), 12);
  }
});

test('JadwalUjian: rowSpan merging preserves order & relations, Versi 1 shows supervisors, Versi 2 (Siswa) omits all supervisor columns & data', () => {
  const subjects: ExamSubject[] = [
    { id: 'sb-1', kode: 'MTK', nama: 'Matematika', kategori: 'Umum', durasiMenit: 90 },
    { id: 'sb-2', kode: 'BIN', nama: 'Bahasa Indonesia', kategori: 'Umum', durasiMenit: 90 },
    { id: 'sb-3', kode: 'BIG', nama: 'Bahasa Inggris', kategori: 'Umum', durasiMenit: 90 },
  ];

  const schedules: ExamSchedule[] = [
    {
      id: 'sc-1',
      mapelId: 'sb-1',
      mapelPerKelas: { 'X-A': 'sb-1', 'XI-A': 'sb-2' },
      tanggal: '2026-05-11',
      hari: 'Senin',
      jamKe: 1,
      sesi: 1,
      waktuMulai: '07:30',
      waktuSelesai: '09:00',
      ruangIds: ['r-1', 'r-2'],
    },
    {
      id: 'sc-2',
      mapelId: 'sb-3',
      mapelPerKelas: { 'X-A': 'sb-3', 'XI-A': 'sb-1' },
      tanggal: '2026-05-11',
      hari: 'Senin',
      jamKe: 2,
      sesi: 1,
      waktuMulai: '09:30',
      waktuSelesai: '11:00',
      ruangIds: ['r-1', 'r-2'],
    },
    {
      id: 'sc-3',
      mapelId: 'sb-2',
      mapelPerKelas: { 'X-A': 'sb-2', 'XI-A': 'sb-3' },
      tanggal: '2026-05-12',
      hari: 'Selasa',
      jamKe: 1,
      sesi: 1,
      waktuMulai: '07:30',
      waktuSelesai: '09:00',
      ruangIds: ['r-1', 'r-2'],
    },
  ];

  const supervisors: Supervisor[] = [
    { id: 'sup-1', nama: 'Budi Santoso, S.Pd.', nip: '1981', asalMadrasah: 'MA A', noHp: '081', status: 'Aktif' },
    { id: 'sup-2', nama: 'Dewi Lestari, M.Pd.', nip: '1982', asalMadrasah: 'MA A', noHp: '082', status: 'Aktif' },
  ];

  const assignments: SupervisorAssignment[] = [
    { id: 'sa-1', scheduleId: 'sc-1', roomId: 'r-1', sesi: 1, pengawas1Id: 'sup-1' },
    { id: 'sa-2', scheduleId: 'sc-1', roomId: 'r-2', sesi: 1, pengawas1Id: 'sup-2' },
    { id: 'sa-3', scheduleId: 'sc-2', roomId: 'r-1', sesi: 1, pengawas1Id: 'sup-2' },
    { id: 'sa-4', scheduleId: 'sc-3', roomId: 'r-1', sesi: 1, pengawas1Id: 'sup-1' },
  ];

  const model = buildSchedulePrintModel({
    schedules,
    subjects,
    rooms: mockRooms,
    supervisors,
    supervisorAssignments: assignments,
    examConfig: mockExamConfig,
  });

  // Verify contiguous rowSpan invariants without altering schedule order
  assert.equal(model.rows.length, 3);
  assert.equal(model.rows[0].dayRowSpan, 2);
  assert.equal(model.rows[1].dayRowSpan, 0);
  assert.equal(model.rows[2].dayRowSpan, 1);

  assert.equal(model.rows[0].sesiRowSpan, 2);
  assert.equal(model.rows[1].sesiRowSpan, 0);
  assert.equal(model.rows[2].sesiRowSpan, 1);

  assert.equal(model.rows[0].seragamRowSpan, 2);
  assert.equal(model.rows[1].seragamRowSpan, 0);
  assert.equal(model.rows[2].seragamRowSpan, 1);

  // Time differs between row 0 (07:30-09:00) and row 1 (09:30-11:00)
  assert.equal(model.rows[0].timeRowSpan, 1);
  assert.equal(model.rows[1].timeRowSpan, 1);
  assert.equal(model.rows[2].timeRowSpan, 1);

  // Render Versi 1 (Lengkap Admin / Pengawas)
  const htmlLengkap = renderToStaticMarkup(
    React.createElement(JadwalUjianCetak, {
      profile: mockProfile,
      examConfig: mockExamConfig,
      schedules,
      subjects,
      rooms: mockRooms,
      supervisors,
      supervisorAssignments: assignments,
      version: 'lengkap',
    })
  );
  assert.ok(htmlLengkap.includes('data-testid="jadwal-table-lengkap"'));
  assert.ok(htmlLengkap.includes('schedule-print'));
  assert.ok(htmlLengkap.includes('--saum-sheet-w:330mm'));
  assert.ok(htmlLengkap.includes('--saum-sheet-h:210mm'));
  assert.ok(htmlLengkap.includes('--saum-printable-w:300mm'));
  assert.ok(htmlLengkap.includes('--saum-printable-h:180mm'));
  assert.ok(htmlLengkap.includes('KODE PENGAWAS'));
  assert.ok(htmlLengkap.includes('DAFTAR PENGAWAS'));
  assert.ok(htmlLengkap.includes('Budi Santoso, S.Pd.'));
  assert.ok(htmlLengkap.includes('Dewi Lestari, M.Pd.'));
  assert.ok(htmlLengkap.includes('rowSpan="2"') || htmlLengkap.includes('rowspan="2"'));

  // Render Versi 2 (Jadwal Siswa)
  const htmlSiswa = renderToStaticMarkup(
    React.createElement(JadwalUjianCetak, {
      profile: mockProfile,
      examConfig: mockExamConfig,
      schedules,
      subjects,
      rooms: mockRooms,
      supervisors,
      supervisorAssignments: assignments,
      version: 'siswa',
    })
  );
  assert.ok(htmlSiswa.includes('data-testid="jadwal-table-siswa"'));
  assert.ok(htmlSiswa.includes('schedule-print'));
  assert.ok(htmlSiswa.includes('--saum-printable-w:300mm'));
  assert.ok(htmlSiswa.includes('--saum-printable-h:180mm'));
  assert.ok(htmlSiswa.includes('HARI / TANGGAL'));
  assert.ok(htmlSiswa.includes('WAKTU'));
  assert.ok(htmlSiswa.includes('SESI'));
  assert.ok(htmlSiswa.includes('SERAGAM'));
  // CRITICAL: Supervisor columns and names MUST NOT exist anywhere in student version!
  assert.equal(htmlSiswa.includes('KODE PENGAWAS'), false);
  assert.equal(htmlSiswa.includes('DAFTAR PENGAWAS'), false);
  assert.equal(htmlSiswa.includes('Budi Santoso'), false);
  assert.equal(htmlSiswa.includes('Dewi Lestari'), false);
});
