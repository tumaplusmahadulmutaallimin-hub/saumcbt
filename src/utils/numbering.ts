import { NumberingConfig, Student } from '../types';
import { extractJenjang } from './dnpu';

/**
 * Format single sequential participant number using configurable admin pattern.
 * Supports tokens: {prefix}, {tahun}, {madrasah}, {kodeKelas}, {urut}, {sep}
 * Backward-compatible with legacy format when polaFormat is omitted.
 */
export function formatParticipantNumber(
  config: NumberingConfig,
  seq: number,
  kelas?: string
): string {
  const paddedSeq = String(seq).padStart(config.digitUrut || 3, '0');
  const sep = config.pemisah ?? '-';

  const jenjang = kelas ? extractJenjang(kelas) : '';
  const kodeKelas =
    (kelas && config.kodeKelasMap?.[kelas]) ||
    (jenjang && config.kodeKelasMap?.[jenjang]) ||
    '';

  if (config.polaFormat && config.polaFormat.trim() !== '') {
    let result = config.polaFormat
      .replace(/\{prefix\}/g, config.prefixTambahan?.trim() || '')
      .replace(/\{tahun\}/g, config.kodeTahun || '')
      .replace(/\{madrasah\}/g, config.kodeMadrasah || '')
      .replace(/\{kodeKelas\}/g, kodeKelas)
      .replace(/\{urut\}/g, paddedSeq)
      .replace(/\{sep\}/g, sep);

    // Clean up accidental double separators if an optional token was empty
    const escapedSep = sep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (escapedSep) {
      result = result.replace(new RegExp(`${escapedSep}{2,}`, 'g'), sep);
      result = result.replace(new RegExp(`^${escapedSep}|${escapedSep}$`, 'g'), '');
    }
    return result;
  }

  const parts: string[] = [];
  if (config.prefixTambahan && config.prefixTambahan.trim() !== '') {
    parts.push(config.prefixTambahan.trim());
  }
  if (config.kodeTahun) {
    parts.push(config.kodeTahun);
  }
  if (config.kodeMadrasah) {
    parts.push(config.kodeMadrasah);
  }
  if (kodeKelas) {
    parts.push(kodeKelas);
  }
  parts.push(paddedSeq);

  return parts.join(sep || '-');
}

/**
 * Compare two class names respecting Roman/numeric class hierarchy (e.g. VII < VIII < IX < X < XI < XII)
 * or explicit admin urutanKelas list.
 */
export function compareClasses(aClass: string, bClass: string, urutanKelas?: string[]): number {
  const aUpper = (aClass || '').trim().toUpperCase();
  const bUpper = (bClass || '').trim().toUpperCase();

  if (urutanKelas && urutanKelas.length > 0) {
    const normalizedOrder = urutanKelas.map((c) => c.trim().toUpperCase());
    const idxA = normalizedOrder.indexOf(aUpper);
    const idxB = normalizedOrder.indexOf(bUpper);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
  }

  const romanWeight: Record<string, number> = {
    I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6,
    VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12,
  };
  const jenA = extractJenjang(aUpper);
  const jenB = extractJenjang(bUpper);
  const wA = romanWeight[jenA] ?? (Number(jenA) || 999);
  const wB = romanWeight[jenB] ?? (Number(jenB) || 999);
  if (wA !== wB) return wA - wB;

  return aUpper.localeCompare(bUpper, 'id', { numeric: true });
}

/**
 * Sort students based on selected numbering strategy (never random)
 */
export function sortStudentsForNumbering(
  students: Student[],
  sortBy: NumberingConfig['urutBerdasarkan'],
  urutanKelas?: string[]
): Student[] {
  const cloned = [...students];

  switch (sortBy) {
    case 'kelas_lalu_nama':
      return cloned.sort((a, b) => {
        const classComp = compareClasses(a.kelas, b.kelas, urutanKelas);
        if (classComp !== 0) return classComp;
        return a.nama.localeCompare(b.nama, 'id');
      });

    case 'nama_alfabetis':
      return cloned.sort((a, b) => a.nama.localeCompare(b.nama, 'id'));

    case 'nisn':
      return cloned.sort((a, b) => a.nisn.localeCompare(b.nisn));

    case 'nis':
      return cloned.sort((a, b) => a.nis.localeCompare(b.nis));

    default:
      return cloned;
  }
}

/**
 * Generate automatic deterministic participant numbers for all active students
 */
export function generateStudentNumbers(
  students: Student[],
  config: NumberingConfig
): Student[] {
  const sorted = sortStudentsForNumbering(students, config.urutBerdasarkan, config.urutanKelas);
  let activeSeq = config.nomorAwal && config.nomorAwal > 0 ? config.nomorAwal : 1;

  const idToNumberMap = new Map<string, string>();
  for (const st of sorted) {
    if (st.status === 'Aktif') {
      const generatedNum = formatParticipantNumber(config, activeSeq, st.kelas);
      idToNumberMap.set(st.id, generatedNum);
      activeSeq++;
    } else {
      idToNumberMap.set(st.id, '');
    }
  }

  return students.map((st) => ({
    ...st,
    nomorPeserta: idToNumberMap.get(st.id) ?? st.nomorPeserta,
  }));
}

/**
 * Validate participant numbers for duplicates and missing
 */
export function validateParticipantNumbers(students: Student[]): {
  isValid: boolean;
  duplicates: string[];
  missingCount: number;
  totalActive: number;
} {
  const activeStudents = students.filter((s) => s.status === 'Aktif');
  const numbersSeen = new Set<string>();
  const duplicateSet = new Set<string>();
  let missingCount = 0;

  for (const s of activeStudents) {
    const num = s.nomorPeserta?.trim();
    if (!num) {
      missingCount++;
      continue;
    }
    if (numbersSeen.has(num)) {
      duplicateSet.add(num);
    } else {
      numbersSeen.add(num);
    }
  }

  return {
    isValid: duplicateSet.size === 0 && missingCount === 0,
    duplicates: Array.from(duplicateSet),
    missingCount,
    totalActive: activeStudents.length,
  };
}

const READABLE_PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function createReadablePassword(length = 6): string {
  const safeLen = Math.max(4, Math.min(12, length));
  let result = '';
  const cryptoObj = typeof globalThis !== 'undefined' ? (globalThis as { crypto?: Crypto }).crypto : undefined;

  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    const arr = new Uint32Array(safeLen);
    cryptoObj.getRandomValues(arr);
    for (let i = 0; i < safeLen; i++) {
      result += READABLE_PASSWORD_CHARS[arr[i] % READABLE_PASSWORD_CHARS.length];
    }
    return result;
  }

  for (let i = 0; i < safeLen; i++) {
    const idx = Math.floor(Math.random() * READABLE_PASSWORD_CHARS.length);
    result += READABLE_PASSWORD_CHARS[idx];
  }
  return result;
}

export interface GenerateCredentialOptions {
  basis?: 'nomor_peserta' | 'nisn' | 'nis' | 'kode_urut';
  prefix?: string;
  passwordLength?: number;
  overwriteExisting?: boolean;
  sortBy?: NumberingConfig['urutBerdasarkan'];
  urutanKelas?: string[];
}

/**
 * Generate unique Username Ujian & Password Ujian for all active students
 * used to log into CBT / Online exam rooms.
 */
export function generateExamCredentials(
  students: Student[],
  options: GenerateCredentialOptions = {}
): Student[] {
  const basis = options.basis || 'nomor_peserta';
  const prefix = (options.prefix || '').trim().replace(/\s+/g, '');
  const passwordLength = options.passwordLength ?? 6;
  const overwriteExisting = options.overwriteExisting ?? true;
  const sortBy = options.sortBy || 'kelas_lalu_nama';

  const sorted = sortStudentsForNumbering(students, sortBy, options.urutanKelas);
  const usedUsernames = new Set<string>();

  // Reserve existing usernames that won't be overwritten
  if (!overwriteExisting) {
    for (const st of sorted) {
      if (st.status === 'Aktif' && st.usernameUjian?.trim()) {
        usedUsernames.add(st.usernameUjian.trim().toUpperCase());
      }
    }
  }

  const credMap = new Map<string, { usernameUjian: string; passwordUjian: string }>();
  let seq = 1;

  for (const st of sorted) {
    if (st.status !== 'Aktif') {
      credMap.set(st.id, { usernameUjian: '', passwordUjian: '' });
      continue;
    }

    const existingUser = (st.usernameUjian || '').trim();
    const existingPass = (st.passwordUjian || '').trim();

    if (!overwriteExisting && existingUser && existingPass) {
      credMap.set(st.id, { usernameUjian: existingUser, passwordUjian: existingPass });
      seq++;
      continue;
    }

    let candidateUser = existingUser;
    if (overwriteExisting || !candidateUser) {
      let base = '';
      if (basis === 'nisn' && st.nisn?.trim()) {
        base = st.nisn.trim();
      } else if (basis === 'nis' && st.nis?.trim()) {
        base = st.nis.trim();
      } else if (basis === 'nomor_peserta' && st.nomorPeserta?.trim()) {
        base = st.nomorPeserta.trim().replace(/[^A-Za-z0-9]/g, '');
      }

      if (!base) {
        base = `P${String(seq).padStart(3, '0')}`;
      }

      const rawCandidate = `${prefix}${base}`.toUpperCase();
      let uniqueCandidate = rawCandidate;
      let suffix = 2;
      while (usedUsernames.has(uniqueCandidate)) {
        uniqueCandidate = `${rawCandidate}-${suffix}`;
        suffix++;
      }
      candidateUser = uniqueCandidate;
    }

    usedUsernames.add(candidateUser.toUpperCase());

    const finalPass =
      !overwriteExisting && existingPass ? existingPass : createReadablePassword(passwordLength);

    credMap.set(st.id, {
      usernameUjian: candidateUser,
      passwordUjian: finalPass,
    });
    seq++;
  }

  return students.map((st) => {
    const cred = credMap.get(st.id);
    if (!cred) return st;
    return {
      ...st,
      usernameUjian: cred.usernameUjian,
      passwordUjian: cred.passwordUjian,
    };
  });
}

/**
 * Validate exam credentials completeness & uniqueness across active students.
 */
export function validateExamCredentials(students: Student[]): {
  isValid: boolean;
  duplicates: string[];
  missingCount: number;
  totalActive: number;
} {
  const activeStudents = students.filter((s) => s.status === 'Aktif');
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  let missingCount = 0;

  for (const s of activeStudents) {
    const u = (s.usernameUjian || '').trim().toUpperCase();
    const p = (s.passwordUjian || '').trim();
    if (!u || !p) {
      missingCount++;
      continue;
    }
    if (seen.has(u)) {
      duplicates.add(u);
    } else {
      seen.add(u);
    }
  }

  return {
    isValid: duplicates.size === 0 && missingCount === 0,
    duplicates: Array.from(duplicates),
    missingCount,
    totalActive: activeStudents.length,
  };
}

