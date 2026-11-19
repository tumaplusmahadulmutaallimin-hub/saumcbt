import * as XLSX from 'xlsx';
import { JenisKelamin, Student } from '../types';

export interface DnpuHeaderMapping {
  nisn: string;
  nis: string;
  nama: string;
  jk: string;
  kelas: string;
  tempatLahir?: string;
  tanggalLahir?: string;
  usernameUjian?: string;
  passwordUjian?: string;
}

export interface DnpuValidationRow {
  rowNumber: number; // 1-indexed spreadsheet row (header = row 1, data starts row 2)
  raw: Record<string, string>;
  nisn: string;
  nis: string;
  nama: string;
  jenisKelamin: JenisKelamin;
  kelas: string;
  tempatLahir: string;
  tanggalLahir: string;
  usernameUjian?: string;
  passwordUjian?: string;
  errors: string[];
  warnings: string[];
  isValid: boolean;
}

/**
 * Extract normalized Jenjang from class string, e.g.:
 * "X-A" -> "X", "XII-B" -> "XII", "IX-A" -> "IX", "10 IPA 1" -> "10"
 */
export function extractJenjang(kelas: string): string {
  const clean = (kelas || '').trim().toUpperCase();
  if (!clean) return 'LAINNYA';
  const match = clean.match(/^(XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I|\d+)/);
  return match ? match[1] : clean.split(/[\s\-_/]/)[0];
}

/**
 * Parse uploaded Excel (.xlsx, .xls) or CSV ArrayBuffer into raw string rows
 * Preserves leading zeros on NISN & NIS by forcing string formatting.
 */
export function parseSpreadsheetBuffer(buffer: ArrayBuffer): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const workbook = XLSX.read(buffer, {
    type: 'array',
    raw: false,
    cellText: true,
    cellNF: false,
  });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return { headers: [], rows: [] };

  const worksheet = workbook.Sheets[firstSheetName];
  // Convert to 2D array of formatted strings so leading zeroes stay intact
  const matrix = XLSX.utils.sheet_to_json<string[]>(worksheet, {
    header: 1,
    raw: false,
    defval: '',
  });

  if (matrix.length === 0) return { headers: [], rows: [] };

  const headers = matrix[0].map((h) => String(h || '').trim()).filter((h) => h.length > 0);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < matrix.length; i++) {
    const rowArr = matrix[i];
    // Skip completely empty rows
    const hasContent = rowArr.some((cell) => String(cell || '').trim() !== '');
    if (!hasContent) continue;

    const record: Record<string, string> = {};
    headers.forEach((header, colIdx) => {
      record[header] = String(rowArr[colIdx] ?? '').trim();
    });
    rows.push(record);
  }

  return { headers, rows };
}

/**
 * Auto-detect header mapping from spreadsheet headers
 */
export function detectHeaderMapping(headers: string[]): DnpuHeaderMapping {
  const findMatch = (candidates: string[]) => {
    for (const cand of candidates) {
      const found = headers.find((h) => h.toUpperCase() === cand);
      if (found) return found;
    }
    for (const cand of candidates) {
      const found = headers.find((h) => h.toUpperCase().includes(cand));
      if (found) return found;
    }
    return '';
  };

  return {
    nisn: findMatch(['NISN', 'NO NISN', 'NOMOR NISN']) || headers[0] || '',
    nis: findMatch(['NIS', 'NO INDUK', 'NOMOR INDUK']) || headers[1] || '',
    nama: findMatch(['NAMA', 'NAMA LENGKAP', 'NAMA PESERTA', 'NAMA SISWA']) || headers[2] || '',
    jk: findMatch(['JK', 'L/P', 'JENIS KELAMIN', 'GENDER']) || headers[3] || '',
    kelas: findMatch(['KELAS', 'ROMBEL', 'TINGKAT']) || headers[4] || '',
    tempatLahir: findMatch(['TEMPAT LAHIR', 'TMP LAHIR']),
    tanggalLahir: findMatch(['TANGGAL LAHIR', 'TGL LAHIR']),
    usernameUjian: findMatch(['USER UJIAN', 'USERNAME UJIAN', 'USERNAME', 'USER']),
    passwordUjian: findMatch(['PASSWORD UJIAN', 'PASSWORD', 'PASS UJIAN', 'PASS']),
  };
}

/**
 * Validate parsed DNPU rows against format rules, duplicates, and registered classes
 */
export function validateDnpuRows(
  rawRows: Record<string, string>[],
  mapping: DnpuHeaderMapping,
  registeredClasses: string[],
  existingStudents: Student[] = [],
  replaceExisting = false
): DnpuValidationRow[] {
  const seenNisnInFile = new Map<string, number>();
  const seenNisInFile = new Map<string, number>();

  const existingNisnSet = new Set(
    replaceExisting ? [] : existingStudents.map((s) => s.nisn.trim()).filter(Boolean)
  );
  const existingNisSet = new Set(
    replaceExisting ? [] : existingStudents.map((s) => s.nis.trim()).filter(Boolean)
  );

  const normalizedRegClasses = new Set(registeredClasses.map((c) => c.trim().toUpperCase()));

  // First pass: collect occurrences to mark all duplicates cleanly
  const nisnCounts = new Map<string, number>();
  const nisCounts = new Map<string, number>();

  rawRows.forEach((row) => {
    const nisn = (row[mapping.nisn] || '').trim();
    const nis = (row[mapping.nis] || '').trim();
    if (nisn) nisnCounts.set(nisn, (nisnCounts.get(nisn) || 0) + 1);
    if (nis) nisCounts.set(nis, (nisCounts.get(nis) || 0) + 1);
  });

  return rawRows.map((row, idx) => {
    const rowNumber = idx + 2; // Row 1 is header
    const nisn = (row[mapping.nisn] || '').trim();
    const nis = (row[mapping.nis] || '').trim();
    const nama = (row[mapping.nama] || '').trim();
    const jkRaw = (row[mapping.jk] || 'L').trim().toUpperCase();
    const jenisKelamin: JenisKelamin = jkRaw.startsWith('P') || jkRaw === 'PEREMPUAN' ? 'P' : 'L';
    const kelas = (row[mapping.kelas] || '').trim().toUpperCase();
    const tempatLahir = mapping.tempatLahir ? (row[mapping.tempatLahir] || '').trim() : '';
    const tanggalLahir = mapping.tanggalLahir ? (row[mapping.tanggalLahir] || '').trim() : '';
    const usernameUjian = mapping.usernameUjian ? (row[mapping.usernameUjian] || '').trim() : '';
    const passwordUjian = mapping.passwordUjian ? (row[mapping.passwordUjian] || '').trim() : '';

    const errors: string[] = [];
    const warnings: string[] = [];

    if (!nisn) {
      errors.push('NISN kosong');
    } else {
      if ((nisnCounts.get(nisn) || 0) > 1) {
        const firstRow = seenNisnInFile.get(nisn);
        if (firstRow) {
          errors.push(`NISN ganda (sama dengan baris ${firstRow})`);
        } else {
          errors.push('NISN ganda di dalam file');
        }
      }
      if (existingNisnSet.has(nisn)) {
        errors.push('NISN sudah terdaftar di database');
      }
      if (!seenNisnInFile.has(nisn)) seenNisnInFile.set(nisn, rowNumber);
    }

    if (!nis) {
      errors.push('NIS kosong');
    } else {
      if ((nisCounts.get(nis) || 0) > 1) {
        const firstRow = seenNisInFile.get(nis);
        if (firstRow) {
          errors.push(`NIS ganda (sama dengan baris ${firstRow})`);
        } else {
          errors.push('NIS ganda di dalam file');
        }
      }
      if (existingNisSet.has(nis)) {
        errors.push('NIS sudah terdaftar di database');
      }
      if (!seenNisInFile.has(nis)) seenNisInFile.set(nis, rowNumber);
    }

    if (!nama) {
      errors.push('Nama peserta kosong');
    }

    if (!kelas) {
      errors.push('Kelas kosong');
    } else if (normalizedRegClasses.size > 0 && !normalizedRegClasses.has(kelas)) {
      warnings.push(`Kelas "${kelas}" belum terdaftar di Pengaturan Ujian`);
    }

    if (jkRaw && !['L', 'P', 'LAKI-LAKI', 'PEREMPUAN'].includes(jkRaw)) {
      warnings.push(`Format JK "${jkRaw}" dinormalisasi menjadi ${jenisKelamin}`);
    }

    return {
      rowNumber,
      raw: row,
      nisn,
      nis,
      nama,
      jenisKelamin,
      kelas,
      tempatLahir,
      tanggalLahir,
      usernameUjian,
      passwordUjian,
      errors,
      warnings,
      isValid: errors.length === 0,
    };
  });
}

/**
 * Re-validate an edited list of DnpuValidationRow objects in-place (for inline fixes)
 */
export function revalidateEditedDnpuRows(
  rows: DnpuValidationRow[],
  registeredClasses: string[],
  existingStudents: Student[] = [],
  replaceExisting = false
): DnpuValidationRow[] {
  const fakeRaw = rows.map((r) => ({
    NISN: r.nisn,
    NIS: r.nis,
    NAMA: r.nama,
    JK: r.jenisKelamin,
    KELAS: r.kelas,
    TEMPAT_LAHIR: r.tempatLahir,
    TANGGAL_LAHIR: r.tanggalLahir,
    USER_UJIAN: r.usernameUjian || '',
    PASSWORD_UJIAN: r.passwordUjian || '',
  }));

  const validated = validateDnpuRows(
    fakeRaw,
    {
      nisn: 'NISN',
      nis: 'NIS',
      nama: 'NAMA',
      jk: 'JK',
      kelas: 'KELAS',
      tempatLahir: 'TEMPAT_LAHIR',
      tanggalLahir: 'TANGGAL_LAHIR',
      usernameUjian: 'USER_UJIAN',
      passwordUjian: 'PASSWORD_UJIAN',
    },
    registeredClasses,
    existingStudents,
    replaceExisting
  );

  return validated.map((v, i) => ({ ...v, rowNumber: rows[i].rowNumber }));
}

/**
 * Generate an Excel (.xlsx) DNPU Template with text-formatted NISN & NIS columns
 * so leading zeros are preserved in Microsoft Excel.
 */
export function downloadDnpuExcelTemplate(): void {
  const aoa = [
    ['NISN', 'NIS', 'NAMA', 'JK', 'KELAS'],
    ['0110000001', '2601001', 'Ahmad Fauzan', 'L', 'X-A'],
    ['0110000002', '2601002', 'Fatimah Az-Zahra', 'P', 'X-A'],
    ['0100000003', '2501003', 'Muhammad Rizki', 'L', 'XI-A'],
    ['0090000004', '2401004', 'Siti Aminah', 'P', 'XII-A'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // Force text format '@' on NISN (col A) and NIS (col B)
  for (let r = 1; r < aoa.length; r++) {
    const cellA = ws[XLSX.utils.encode_cell({ r, c: 0 })];
    const cellB = ws[XLSX.utils.encode_cell({ r, c: 1 })];
    if (cellA) {
      cellA.t = 's';
      cellA.z = '@';
    }
    if (cellB) {
      cellB.t = 's';
      cellB.z = '@';
    }
  }
  ws['!cols'] = [{ wch: 15 }, { wch: 12 }, { wch: 28 }, { wch: 6 }, { wch: 10 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'DNPU');
  XLSX.writeFile(wb, 'Template_DNPU_SAUM.xlsx');
}

/**
 * Export students list to Excel (.xlsx) preserving leading zeros on NISN, NIS, Nomor Peserta
 */
export function exportStudentsToExcel(students: Student[], includeSesi: boolean, filename = 'Data_DNPU_SAUM.xlsx'): void {
  const headers = includeSesi
    ? [
        'No',
        'NISN',
        'NIS',
        'Nama Lengkap',
        'JK',
        'Kelas',
        'Nomor Peserta',
        'User Ujian',
        'Password Ujian',
        'Sesi',
        'Ruang',
        'Meja',
        'Status',
      ]
    : [
        'No',
        'NISN',
        'NIS',
        'Nama Lengkap',
        'JK',
        'Kelas',
        'Nomor Peserta',
        'User Ujian',
        'Password Ujian',
        'Ruang',
        'Meja',
        'Status',
      ];

  const aoa: (string | number)[][] = [headers];

  students.forEach((s, idx) => {
    if (includeSesi) {
      aoa.push([
        idx + 1,
        s.nisn || '',
        s.nis || '',
        s.nama || '',
        s.jenisKelamin,
        s.kelas || '',
        s.nomorPeserta || '',
        s.usernameUjian || '',
        s.passwordUjian || '',
        s.sesi || '',
        s.ruangId || '',
        s.nomorMeja || '',
        s.status,
      ]);
    } else {
      aoa.push([
        idx + 1,
        s.nisn || '',
        s.nis || '',
        s.nama || '',
        s.jenisKelamin,
        s.kelas || '',
        s.nomorPeserta || '',
        s.usernameUjian || '',
        s.passwordUjian || '',
        s.ruangId || '',
        s.nomorMeja || '',
        s.status,
      ]);
    }
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  for (let r = 1; r < aoa.length; r++) {
    [1, 2, 6, 7, 8].forEach((c) => {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell) {
        cell.t = 's';
        cell.z = '@';
      }
    });
  }
  ws['!cols'] = [
    { wch: 5 },
    { wch: 15 },
    { wch: 12 },
    { wch: 28 },
    { wch: 5 },
    { wch: 10 },
    { wch: 16 },
    { wch: 18 },
    { wch: 14 },
    { wch: 10 },
    { wch: 10 },
    { wch: 8 },
    { wch: 10 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data Peserta');
  XLSX.writeFile(wb, filename);
}
