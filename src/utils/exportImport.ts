import { Student } from '../types';

/**
 * Generate CSV string from list of students
 */
export function exportStudentsToCSV(students: Student[]): string {
  const headers = [
    'No',
    'NIS',
    'NISN',
    'Nama Lengkap',
    'Tempat Lahir',
    'Tanggal Lahir',
    'Jenis Kelamin',
    'Kelas',
    'Nomor Peserta',
    'User Ujian',
    'Password Ujian',
    'Ruang',
    'No Meja',
    'Status',
  ];

  const rows = students.map((s, idx) => [
    idx + 1,
    `"${s.nis || ''}"`,
    `"${s.nisn || ''}"`,
    `"${(s.nama || '').replace(/"/g, '""')}"`,
    `"${(s.tempatLahir || '').replace(/"/g, '""')}"`,
    `"${s.tanggalLahir || ''}"`,
    s.jenisKelamin,
    `"${s.kelas || ''}"`,
    `"${s.nomorPeserta || ''}"`,
    `"${s.usernameUjian || ''}"`,
    `"${s.passwordUjian || ''}"`,
    `"${s.ruangId || ''}"`,
    s.nomorMeja || '',
    s.status,
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
}

/**
 * Parse uploaded CSV content into Student array
 */
export function parseStudentsCSV(csvContent: string): Partial<Student>[] {
  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length <= 1) return [];

  // Parse header
  const students: Partial<Student>[] = [];

  // Simple CSV line parser respecting quotes
  const parseLine = (text: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        if (inQuotes && text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    result.push(cur.trim());
    return result;
  };

  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    if (cols.length < 4) continue;

    // Detect column positions
    // If standard export (12 columns) or import template (7 columns)
    const nis = cols[1] || cols[0];
    const nisn = cols[2] || cols[1];
    const nama = cols[3] || cols[2];
    const tempatLahir = cols[4] || '';
    const tanggalLahir = cols[5] || '';
    const jkRaw = (cols[6] || 'L').toUpperCase();
    const jenisKelamin = jkRaw.startsWith('P') ? 'P' : 'L';
    const kelas = cols[7] || 'IX-A';

    if (nama) {
      students.push({
        id: `st-${Date.now()}-${i}`,
        nis: nis.replace(/"/g, ''),
        nisn: nisn.replace(/"/g, ''),
        nama: nama.replace(/"/g, ''),
        tempatLahir: tempatLahir.replace(/"/g, ''),
        tanggalLahir: tanggalLahir.replace(/"/g, ''),
        jenisKelamin,
        kelas: kelas.replace(/"/g, ''),
        nomorPeserta: '',
        status: 'Aktif',
      });
    }
  }

  return students;
}

/**
 * Download sample template CSV for importing examinees
 */
export function downloadCSVTemplate(): void {
  const templateContent = [
    'No,NIS,NISN,Nama Lengkap,Tempat Lahir,Tanggal Lahir,Jenis Kelamin (L/P),Kelas',
    '1,23241001,0081203001,"Ahmad Fikri","Bandung","2010-05-12",L,"IX-A"',
    '2,23241002,0081203002,"Siti Maryam","Jakarta","2010-09-24",P,"IX-A"',
    '3,23241003,0081203003,"Muhammad Rizki","Cimahi","2010-03-15",L,"IX-B"',
  ].join('\r\n');

  downloadFile('template_import_peserta_ujian.csv', templateContent, 'text/csv;charset=utf-8;');
}

/**
 * Helper to trigger browser download
 */
export function downloadFile(filename: string, content: string, mimeType = 'text/plain;charset=utf-8;'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
