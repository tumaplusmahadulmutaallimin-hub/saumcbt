import * as XLSX from 'xlsx';
import {
  AuditLogEntry,
  ExamArchiveRecord,
  ExamConfig,
  ExamRoom,
  ExamSchedule,
  ExamSubject,
  HpHandoverLog,
  NumberingConfig,
  NumberingHistoryEntry,
  PhysicalClassroom,
  RekapConfig,
  RoomDistributionConfig,
  SantriPhoneRecord,
  SealDocConfig,
  Student,
  Supervisor,
  SupervisorAssignment,
  TataTertibDoc,
  UploadedExamDocument,
  UserAccount,
} from '../types';
import {
  INITIAL_ARCHIVES,
  INITIAL_COMMITTEE,
  INITIAL_EXAM_CONFIG,
  INITIAL_MADRASAH_PROFILE,
  INITIAL_NUMBERING_CONFIG,
  INITIAL_PAPER_PRESETS,
  INITIAL_PHONE_RECORDS,
  INITIAL_PHYSICAL_CLASSROOMS,
  INITIAL_REKAP_CONFIG,
  INITIAL_ROOMS,
  INITIAL_ROOM_CONFIG,
  INITIAL_SCHEDULES,
  INITIAL_SEAL_CONFIGS,
  INITIAL_STUDENTS,
  INITIAL_SUBJECTS,
  INITIAL_SUPERVISORS,
  INITIAL_SUPERVISOR_ASSIGNMENTS,
  INITIAL_TATA_TERTIB,
  INITIAL_UPLOADED_DOCUMENTS,
  INITIAL_USERS,
} from '../data/initialData';
import {
  SaumModuleKey,
  canRoleEdit,
  canRoleRestoreBackup,
  canRoleUnlockArchive,
} from './rbac';
import {
  validateScheduleConflicts,
  validateSupervisorConflicts,
} from './seating';
import type { SaumClientState } from './api';

const LOCAL_DB_KEY = 'saum_local_db_v2';
const LOCAL_USER_KEY = 'saum_local_active_user_v2';

let memoryDbCache: SaumClientState | null = null;
let memoryUserIdCache: string | null = null;

export function createDefaultSaumClientState(): SaumClientState {
  return {
    profile: INITIAL_MADRASAH_PROFILE,
    examConfig: INITIAL_EXAM_CONFIG,
    students: INITIAL_STUDENTS,
    rooms: INITIAL_ROOMS,
    physicalClassrooms: INITIAL_PHYSICAL_CLASSROOMS,
    schedules: INITIAL_SCHEDULES,
    subjects: INITIAL_SUBJECTS,
    committee: INITIAL_COMMITTEE,
    supervisors: INITIAL_SUPERVISORS,
    supervisorAssignments: INITIAL_SUPERVISOR_ASSIGNMENTS,
    numberingConfig: INITIAL_NUMBERING_CONFIG,
    numberingHistory: [],
    roomConfig: INITIAL_ROOM_CONFIG,
    paperPresets: INITIAL_PAPER_PRESETS,
    sealConfigs: INITIAL_SEAL_CONFIGS,
    tataTertibDocs: INITIAL_TATA_TERTIB,
    phoneRecords: INITIAL_PHONE_RECORDS,
    hpLogs: [],
    uploadedDocuments: INITIAL_UPLOADED_DOCUMENTS,
    rekapConfig: INITIAL_REKAP_CONFIG,
    archives: INITIAL_ARCHIVES,
    users: INITIAL_USERS,
    auditLogs: [
      {
        id: 'log-init',
        timestamp: new Date().toISOString(),
        actor: 'Arif Syaifudin, S.H',
        role: 'Super Admin',
        module: 'system',
        action: 'INIT_DATABASE',
        detail: 'Inisialisasi basis data lokal SAUM bersih siap input data madrasah.',
      },
    ],
  };
}

function mergePaperPresets(
  defaults: typeof INITIAL_PAPER_PRESETS,
  existing?: typeof INITIAL_PAPER_PRESETS
) {
  if (!Array.isArray(existing) || existing.length === 0) return defaults;
  const byId = new Map(existing.map((p) => [p.id, p]));
  return defaults.map((d) => {
    const saved = byId.get(d.id);
    return saved ? { ...d, ...saved } : d;
  });
}

function loadLocalDb(): SaumClientState {
  if (typeof window === 'undefined' || !window.localStorage) {
    if (!memoryDbCache) memoryDbCache = createDefaultSaumClientState();
    return memoryDbCache;
  }
  const defaults = createDefaultSaumClientState();
  try {
    const raw = window.localStorage.getItem(LOCAL_DB_KEY);
    if (!raw) {
      saveLocalDb(defaults);
      return defaults;
    }
    const parsed = JSON.parse(raw) as Partial<SaumClientState>;
    return {
      ...defaults,
      ...parsed,
      paperPresets: mergePaperPresets(defaults.paperPresets, parsed.paperPresets),
      rekapConfig: {
        ...defaults.rekapConfig,
        ...(parsed.rekapConfig || {}),
        kursiPerMeja: parsed.rekapConfig?.kursiPerMeja === 1 ? 1 : 2,
        basisHitungKursi: parsed.rekapConfig?.basisHitungKursi || 'peserta_aktif',
      },
    };
  } catch {
    saveLocalDb(defaults);
    return defaults;
  }
}

function saveLocalDb(state: SaumClientState) {
  memoryDbCache = state;
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(state));
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      throw new Error('Kapasitas penyimpanan browser penuh. Hapus sebagian file scan/arsip besar atau ekspor backup JSON.');
    }
  }
}

function getActiveUser(db: SaumClientState): UserAccount {
  let activeId = memoryUserIdCache;
  if (!activeId && typeof window !== 'undefined' && window.localStorage) {
    activeId = window.localStorage.getItem(LOCAL_USER_KEY);
  }
  const found = db.users.find((u) => u.id === activeId && u.aktif);
  return found || db.users.find((u) => u.aktif) || db.users[0];
}

function setActiveUser(userId: string) {
  memoryUserIdCache = userId;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(LOCAL_USER_KEY, userId);
    } catch {
      // ignore storage write error
    }
  }
}

function requireLocalEdit(db: SaumClientState, moduleKey: SaumModuleKey): UserAccount {
  const user = getActiveUser(db);
  if (!canRoleEdit(user.role, moduleKey)) {
    throw new Error(`Akses ditolak. Peran "${user.role}" tidak memiliki izin mengubah modul "${moduleKey}".`);
  }
  return user;
}

function appendAudit(
  db: SaumClientState,
  user: UserAccount,
  module: string,
  action: string,
  detail: string
) {
  const entry: AuditLogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    actor: user.nama,
    role: user.role,
    module,
    action,
    detail,
  };
  db.auditLogs = [entry, ...(db.auditLogs || [])].slice(0, 250);
}

function validateStudentsIntegrity(students: Student[]): string | null {
  const seenNisn = new Set<string>();
  const seenNis = new Set<string>();
  const seenNomor = new Set<string>();
  const seenExamUsers = new Set<string>();

  for (const s of students) {
    const nisn = (s.nisn || '').trim();
    const nis = (s.nis || '').trim();
    const nomor = (s.nomorPeserta || '').trim();
    const examUser = (s.usernameUjian || '').trim().toUpperCase();

    if (nisn) {
      if (seenNisn.has(nisn)) return `NISN ganda terdeteksi: ${nisn}`;
      seenNisn.add(nisn);
    }
    if (nis) {
      if (seenNis.has(nis)) return `NIS ganda terdeteksi: ${nis}`;
      seenNis.add(nis);
    }
    if (s.status === 'Aktif' && nomor) {
      if (seenNomor.has(nomor)) return `Nomor peserta ganda terdeteksi: ${nomor}`;
      seenNomor.add(nomor);
    }
    if (s.status === 'Aktif' && examUser) {
      if (seenExamUsers.has(examUser)) return `Username ujian ganda terdeteksi: ${s.usernameUjian}`;
      seenExamUsers.add(examUser);
    }
  }
  return null;
}

export const localFallbackApi = {
  getUsers: async () => {
    const db = loadLocalDb();
    return { users: db.users };
  },

  login: async (username: string) => {
    const db = loadLocalDb();
    const user = db.users.find(
      (u) => u.aktif && u.username.toLowerCase() === (username || '').toLowerCase()
    );
    if (!user) {
      throw new Error('Akun pengguna tidak ditemukan atau nonaktif.');
    }
    setActiveUser(user.id);
    appendAudit(db, user, 'auth', 'LOGIN', `Login sebagai ${user.nama} (${user.role})`);
    saveLocalDb(db);
    return { token: `local-${user.id}`, user };
  },

  me: async () => {
    const db = loadLocalDb();
    return { user: getActiveUser(db) };
  },

  getState: async () => {
    return loadLocalDb();
  },

  saveExamConfig: async (examConfig: ExamConfig) => {
    const db = loadLocalDb();
    const user = requireLocalEdit(db, 'pengaturan_ujian');
    db.examConfig = examConfig;
    db.roomConfig = {
      ...db.roomConfig,
      jumlahRuangManual:
        typeof examConfig.jumlahRuang === 'number' && examConfig.jumlahRuang >= 0
          ? examConfig.jumlahRuang
          : db.roomConfig.jumlahRuangManual,
    };
    db.profile = {
      ...db.profile,
      jenisUjian: examConfig.namaUjian || db.profile.jenisUjian,
      tahunPelajaran: examConfig.tahunPelajaran || db.profile.tahunPelajaran,
    };
    appendAudit(
      db,
      user,
      'pengaturan_ujian',
      'UPDATE_CONFIG',
      `Moda: ${examConfig.moda}, Ruang: ${examConfig.jumlahRuang}, Sesi: ${examConfig.jumlahSesi}`
    );
    saveLocalDb(db);
    return { examConfig: db.examConfig, profile: db.profile, roomConfig: db.roomConfig, auditLogs: db.auditLogs };
  },

  saveStudents: async (students: Student[], _backupReason?: string) => {
    const db = loadLocalDb();
    const user = requireLocalEdit(db, 'dnpu');
    const err = validateStudentsIntegrity(students);
    if (err) throw new Error(err);
    db.students = students;
    appendAudit(db, user, 'dnpu', 'UPDATE_STUDENTS', `Memperbarui ${students.length} data peserta.`);
    saveLocalDb(db);
    return { students: db.students, auditLogs: db.auditLogs };
  },

  finalizeDnpu: async (finalized: boolean) => {
    const db = loadLocalDb();
    const user = requireLocalEdit(db, 'penomoran');
    db.examConfig.isDnpuFinalized = Boolean(finalized);
    appendAudit(
      db,
      user,
      'dnpu',
      finalized ? 'FINALIZE_DNPU' : 'REOPEN_DNPU',
      finalized ? 'DNPU difinalisasi.' : 'Finalisasi DNPU dibuka kembali.'
    );
    saveLocalDb(db);
    return { examConfig: db.examConfig, auditLogs: db.auditLogs };
  },

  saveNumbering: async (payload: {
    students: Student[];
    numberingConfig: NumberingConfig;
    historyEntry?: NumberingHistoryEntry;
    finalize?: boolean;
  }) => {
    const db = loadLocalDb();
    const user = requireLocalEdit(db, 'penomoran');
    const err = validateStudentsIntegrity(payload.students);
    if (err) throw new Error(err);
    db.students = payload.students;
    db.numberingConfig = payload.numberingConfig;
    if (typeof payload.finalize === 'boolean') {
      db.examConfig.isNomorFinalized = payload.finalize;
    }
    if (payload.historyEntry) {
      db.numberingHistory = [payload.historyEntry, ...(db.numberingHistory || [])].slice(0, 50);
    }
    appendAudit(
      db,
      user,
      'penomoran',
      'GENERATE_NUMBERS',
      `Menyimpan penomoran peserta (${payload.students.filter((s) => s.nomorPeserta).length} bernomor).`
    );
    saveLocalDb(db);
    return {
      students: db.students,
      numberingConfig: db.numberingConfig,
      numberingHistory: db.numberingHistory,
      examConfig: db.examConfig,
      auditLogs: db.auditLogs,
    };
  },

  saveDeskNumbers: async (students: Student[]) => {
    const db = loadLocalDb();
    const user = requireLocalEdit(db, 'nomor_meja');
    const err = validateStudentsIntegrity(students);
    if (err) throw new Error(err);
    db.students = students;
    appendAudit(
      db,
      user,
      'nomor_meja',
      'UPDATE_DESK_NUMBERS',
      `Memperbarui penomoran kursi & meja untuk ${students.filter((s) => s.nomorMeja).length} peserta.`
    );
    saveLocalDb(db);
    return { students: db.students, auditLogs: db.auditLogs };
  },

  saveRooms: async (payload: {
    students: Student[];
    rooms: ExamRoom[];
    roomConfig: RoomDistributionConfig;
    jumlahSesi?: number;
  }) => {
    const db = loadLocalDb();
    const user = requireLocalEdit(db, 'ruang_sesi');
    db.students = payload.students;
    db.rooms = payload.rooms;
    db.roomConfig = {
      ...payload.roomConfig,
      jumlahRuangManual:
        payload.roomConfig?.jumlahRuangManual && payload.roomConfig.jumlahRuangManual > 0
          ? payload.roomConfig.jumlahRuangManual
          : payload.rooms.length,
    };
    db.examConfig.jumlahRuang = payload.rooms.length;
    if (
      typeof payload.jumlahSesi === 'number' &&
      Number.isFinite(payload.jumlahSesi) &&
      payload.jumlahSesi >= 1
    ) {
      db.examConfig.jumlahSesi = Math.max(1, Math.floor(payload.jumlahSesi));
    }
    appendAudit(
      db,
      user,
      'ruang_sesi',
      'SAVE_ROOMS_SESSIONS',
      `Menyimpan pembagian ${payload.rooms.length} ruang ujian (${db.examConfig.jumlahSesi} sesi).`
    );
    saveLocalDb(db);
    return {
      students: db.students,
      rooms: db.rooms,
      roomConfig: db.roomConfig,
      examConfig: db.examConfig,
      auditLogs: db.auditLogs,
    };
  },

  saveDenahLokasi: async (physicalClassrooms: PhysicalClassroom[], finalized?: boolean) => {
    const db = loadLocalDb();
    const user = requireLocalEdit(db, 'denah_lokasi');
    db.physicalClassrooms = physicalClassrooms;
    if (typeof finalized === 'boolean') {
      db.examConfig.isDenahLokasiFinalized = finalized;
    }
    appendAudit(
      db,
      user,
      'denah_lokasi',
      'UPDATE_DENAH_LOKASI',
      `Memperbarui pemetaan ${physicalClassrooms.length} kelas fisik (Final: ${db.examConfig.isDenahLokasiFinalized}).`
    );
    saveLocalDb(db);
    return {
      physicalClassrooms: db.physicalClassrooms,
      examConfig: db.examConfig,
      auditLogs: db.auditLogs,
    };
  },

  saveSchedules: async (
    subjects: ExamSubject[],
    schedules: ExamSchedule[],
    seragamPerHariJenjang?: Record<string, Record<string, string>>
  ) => {
    const db = loadLocalDb();
    const user = requireLocalEdit(db, 'jadwal');
    const conflicts = validateScheduleConflicts(schedules, db.physicalClassrooms);
    db.subjects = subjects;
    db.schedules = schedules;
    db.examConfig.jumlahMapel = subjects.length;
    if (seragamPerHariJenjang) {
      db.examConfig.seragamPerHariJenjang = seragamPerHariJenjang;
    }
    appendAudit(
      db,
      user,
      'jadwal',
      'UPDATE_SCHEDULES',
      `Memperbarui ${subjects.length} mapel, ${schedules.length} jadwal, dan aturan seragam (${conflicts.length} konflik).`
    );
    saveLocalDb(db);
    return {
      subjects: db.subjects,
      schedules: db.schedules,
      examConfig: db.examConfig,
      conflicts,
      auditLogs: db.auditLogs,
    };
  },

  saveSupervisors: async (
    supervisors: Supervisor[],
    supervisorAssignments: SupervisorAssignment[],
    rooms?: ExamRoom[]
  ) => {
    const db = loadLocalDb();
    const user = requireLocalEdit(db, 'pengawas');
    const conflicts = validateSupervisorConflicts(supervisorAssignments, db.schedules);
    db.supervisors = supervisors;
    db.supervisorAssignments = supervisorAssignments;
    if (rooms) db.rooms = rooms;
    appendAudit(
      db,
      user,
      'pengawas',
      'UPDATE_SUPERVISORS',
      `Memperbarui ${supervisors.length} pengawas dan ${supervisorAssignments.length} penugasan (${conflicts.length} konflik).`
    );
    saveLocalDb(db);
    return {
      supervisors: db.supervisors,
      supervisorAssignments: db.supervisorAssignments,
      rooms: db.rooms,
      conflicts,
      auditLogs: db.auditLogs,
    };
  },

  saveDokumenUjian: async (payload: { sealConfigs?: SealDocConfig[]; tataTertibDocs?: TataTertibDoc[] }) => {
    const db = loadLocalDb();
    const user = requireLocalEdit(db, 'dokumen_ujian');
    if (payload.sealConfigs) db.sealConfigs = payload.sealConfigs;
    if (payload.tataTertibDocs) db.tataTertibDocs = payload.tataTertibDocs;
    appendAudit(db, user, 'dokumen_ujian', 'UPDATE_DOKUMEN_UJIAN', 'Memperbarui konfigurasi segel soal / tata tertib.');
    saveLocalDb(db);
    return { sealConfigs: db.sealConfigs, tataTertibDocs: db.tataTertibDocs, auditLogs: db.auditLogs };
  },

  savePhones: async (phoneRecords: SantriPhoneRecord[], hpLogs?: HpHandoverLog[], auditDetail?: string) => {
    const db = loadLocalDb();
    const user = requireLocalEdit(db, 'admin_hp');
    const seenCodes = new Set<string>();
    for (const p of phoneRecords) {
      const code = (p.kodeHp || '').trim().toUpperCase();
      if (!code) throw new Error('Kode unik HP wajib diisi.');
      if (seenCodes.has(code)) throw new Error(`Kode HP ganda terdeteksi: ${p.kodeHp}`);
      seenCodes.add(code);
    }
    db.phoneRecords = phoneRecords;
    if (hpLogs) db.hpLogs = hpLogs;
    appendAudit(
      db,
      user,
      'admin_hp',
      'UPDATE_PHONES',
      auditDetail || `Memperbarui data HP santri (${phoneRecords.length} unit tercatat).`
    );
    saveLocalDb(db);
    return { phoneRecords: db.phoneRecords, hpLogs: db.hpLogs, auditLogs: db.auditLogs };
  },

  parseHpScan: async (payload: {
    fileName: string;
    mimeType: string;
    base64Data: string;
    docSubtype?: string;
  }) => {
    const db = loadLocalDb();
    requireLocalEdit(db, 'admin_hp');
    const lowerName = (payload.fileName || '').toLowerCase();
    const isSpreadsheet =
      payload.mimeType.includes('spreadsheet') ||
      payload.mimeType.includes('excel') ||
      payload.mimeType === 'text/csv' ||
      lowerName.endsWith('.xlsx') ||
      lowerName.endsWith('.xls') ||
      lowerName.endsWith('.csv');

    if (!isSpreadsheet) {
      throw new Error(
        'Pembacaan scan gambar/PDF otomatis memerlukan server Node/Gemini aktif. Pada mode statis, silakan unggah file Excel/CSV atau simpan sebagai lampiran arsip.'
      );
    }

    const binary = atob(payload.base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const wb = XLSX.read(bytes, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
    const parsedRows = rawRows
      .map((r) => {
        const getVal = (...keys: string[]) => {
          for (const k of Object.keys(r)) {
            const nk = k.trim().toLowerCase();
            if (keys.some((target) => nk.includes(target))) {
              const v = String(r[k] ?? '').trim();
              if (v) return v;
            }
          }
          return '';
        };
        const namaSantri = getVal('nama', 'santri', 'peserta');
        if (!namaSantri) return null;
        const batRaw = getVal('baterai', 'bat', '%');
        const batNum = batRaw ? Number(batRaw.replace(/[^0-9]/g, '')) : undefined;
        const statusReturnRaw = getVal('pengembalian', 'status');
        const statusPengembalian =
          statusReturnRaw.toLowerCase().includes('sudah')
            ? ('Sudah dikembalikan' as const)
            : statusReturnRaw.toLowerCase().includes('periksa')
            ? ('Perlu pemeriksaan' as const)
            : statusReturnRaw.toLowerCase().includes('belum')
            ? ('Belum dikembalikan' as const)
            : undefined;
        const diambilRaw = getVal('diambil', 'keluar');
        const isSedangDiambil = diambilRaw
          ? ['ya', 'true', '1', 'diambil'].includes(diambilRaw.toLowerCase())
          : undefined;
        return {
          kodeHp: getVal('kode', 'id hp').toUpperCase() || undefined,
          namaSantri,
          kelas: getVal('kelas', 'rombel') || undefined,
          merekModel: getVal('merek', 'tipe', 'model', 'hp') || undefined,
          nomorBox: getVal('box') || undefined,
          nomorSlot: getVal('slot') || undefined,
          persentaseBaterai: Number.isFinite(batNum) ? batNum : undefined,
          kondisi: getVal('kondisi', 'keadaan') || undefined,
          jamTransaksi: getVal('jam', 'waktu') || undefined,
          petugas: getVal('petugas', 'paraf', 'penyetor') || undefined,
          isSedangDiambil,
          statusPengembalian,
          catatan: getVal('catatan', 'keterangan') || undefined,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return {
      summary: `Berhasil membaca ${parsedRows.length} baris dari spreadsheet "${payload.fileName}".`,
      rows: parsedRows,
    };
  },

  uploadArchivedDoc: async (doc: UploadedExamDocument) => {
    const db = loadLocalDb();
    const user = getActiveUser(db);
    const allowed =
      canRoleEdit(user.role, 'arsip') ||
      (doc.category === 'admin_hp' && canRoleEdit(user.role, 'admin_hp'));
    if (!allowed) {
      throw new Error('Anda tidak memiliki izin mengarsipkan dokumen ini.');
    }
    db.uploadedDocuments = [doc, ...(db.uploadedDocuments || [])];
    appendAudit(
      db,
      user,
      doc.category === 'admin_hp' ? 'admin_hp' : 'arsip',
      'UPLOAD_ARCHIVED_DOC',
      `Mengarsipkan dokumen scan "${doc.title}" (${doc.fileName})`
    );
    saveLocalDb(db);
    return { uploadedDocuments: db.uploadedDocuments, auditLogs: db.auditLogs };
  },

  deleteArchivedDoc: async (id: string) => {
    const db = loadLocalDb();
    const user = getActiveUser(db);
    const target = (db.uploadedDocuments || []).find((d) => d.id === id);
    if (!target) {
      throw new Error('Dokumen arsip tidak ditemukan.');
    }
    const allowed =
      canRoleEdit(user.role, 'arsip') ||
      (target.category === 'admin_hp' && canRoleEdit(user.role, 'admin_hp'));
    if (!allowed) {
      throw new Error('Anda tidak memiliki izin menghapus dokumen ini.');
    }
    db.uploadedDocuments = (db.uploadedDocuments || []).filter((d) => d.id !== id);
    appendAudit(db, user, 'arsip', 'DELETE_ARCHIVED_DOC', `Menghapus dokumen arsip "${target.title}"`);
    saveLocalDb(db);
    return { uploadedDocuments: db.uploadedDocuments, auditLogs: db.auditLogs };
  },

  saveRekap: async (rekapConfig: RekapConfig, auditDetail?: string) => {
    const db = loadLocalDb();
    const user = requireLocalEdit(db, 'rekap');
    db.rekapConfig = rekapConfig;
    appendAudit(
      db,
      user,
      'rekap',
      'UPDATE_REKAP',
      auditDetail || `Memperbarui rekap perlengkapan (${rekapConfig.customSupplies.length} item) dan status penggandaan.`
    );
    saveLocalDb(db);
    return { rekapConfig: db.rekapConfig, auditLogs: db.auditLogs };
  },

  createArchive: async (record: ExamArchiveRecord) => {
    const db = loadLocalDb();
    const user = requireLocalEdit(db, 'arsip');
    db.archives = [record, ...db.archives];
    appendAudit(db, user, 'arsip', 'CREATE_ARCHIVE', `Mengarsipkan ujian: ${record.namaUjian} (${record.tahunPelajaran})`);
    saveLocalDb(db);
    return { archives: db.archives, auditLogs: db.auditLogs };
  },

  unlockArchive: async (id: string, reason: string) => {
    const db = loadLocalDb();
    const user = getActiveUser(db);
    if (!canRoleUnlockArchive(user.role)) {
      throw new Error('Hanya Super Admin yang dapat membuka kunci arsip terkunci.');
    }
    if (!reason || reason.trim().length < 5) {
      throw new Error('Alasan pembukaan kunci arsip wajib diisi (minimal 5 karakter).');
    }
    const target = db.archives.find((a) => a.id === id);
    if (!target) throw new Error('Arsip tidak ditemukan.');
    target.isLocked = false;
    target.unlockReason = reason.trim();
    appendAudit(
      db,
      user,
      'arsip',
      'UNLOCK_ARCHIVE',
      `Membuka kunci arsip "${target.namaUjian}" dengan alasan: ${reason.trim()}`
    );
    saveLocalDb(db);
    return { archives: db.archives, auditLogs: db.auditLogs };
  },

  restoreArchive: async (id: string) => {
    const db = loadLocalDb();
    const user = getActiveUser(db);
    if (!canRoleRestoreBackup(user.role)) {
      throw new Error('Hanya Super Admin yang dapat memulihkan arsip.');
    }
    const target = db.archives.find((a) => a.id === id);
    if (!target) throw new Error('Arsip tidak ditemukan.');
    if (target.isLocked) {
      throw new Error('Arsip terkunci. Buka kunci dengan alasan resmi terlebih dahulu.');
    }
    const snap = target.snapshot;
    db.profile = snap.profile;
    db.examConfig = snap.examConfig;
    db.students = snap.students;
    db.rooms = snap.rooms;
    db.physicalClassrooms = snap.physicalClassrooms;
    db.schedules = snap.schedules;
    db.subjects = snap.subjects;
    db.committee = snap.committee;
    db.supervisors = snap.supervisors;
    db.supervisorAssignments = snap.supervisorAssignments;
    db.numberingConfig = snap.numberingConfig;
    db.roomConfig = snap.roomConfig;
    db.sealConfigs = snap.sealConfigs;
    db.tataTertibDocs = snap.tataTertibDocs;
    db.phoneRecords = snap.phoneRecords;
    if (snap.uploadedDocuments) db.uploadedDocuments = snap.uploadedDocuments;
    if (snap.rekapConfig) db.rekapConfig = snap.rekapConfig;
    appendAudit(db, user, 'arsip', 'RESTORE_ARCHIVE', `Memulihkan data dari arsip "${target.namaUjian}"`);
    saveLocalDb(db);
    return db;
  },

  saveSettings: async (
    payload: Partial<Pick<SaumClientState, 'profile' | 'paperPresets' | 'committee' | 'users'>>
  ) => {
    const db = loadLocalDb();
    const user = requireLocalEdit(db, 'pengaturan');
    if (payload.users) {
      if (!canRoleEdit(user.role, 'users_roles')) {
        throw new Error('Hanya Super Admin yang dapat mengelola pengguna dan hak akses.');
      }
      db.users = payload.users;
    }
    if (payload.profile) db.profile = payload.profile;
    if (payload.paperPresets) db.paperPresets = payload.paperPresets;
    if (payload.committee) db.committee = payload.committee;
    appendAudit(db, user, 'pengaturan', 'UPDATE_SETTINGS', 'Memperbarui pengaturan madrasah / kertas / panitia.');
    saveLocalDb(db);
    return {
      profile: db.profile,
      paperPresets: db.paperPresets,
      committee: db.committee,
      users: db.users,
      auditLogs: db.auditLogs,
    };
  },

  downloadBackup: async () => {
    const db = loadLocalDb();
    return {
      app: 'SAUM',
      version: '2.0',
      exportedAt: new Date().toISOString(),
      data: db,
    };
  },

  restoreBackup: async (payload: unknown) => {
    const db = loadLocalDb();
    const user = getActiveUser(db);
    if (!canRoleRestoreBackup(user.role)) {
      throw new Error('Hanya Super Admin yang dapat melakukan restore backup penuh.');
    }
    const rawObj = payload as { data?: Partial<SaumClientState> } & Partial<SaumClientState>;
    const candidate = rawObj?.data || rawObj;
    if (!candidate || !Array.isArray(candidate.students) || !candidate.profile) {
      throw new Error('Format file backup SAUM tidak valid.');
    }
    const defaults = createDefaultSaumClientState();
    const restored: SaumClientState = {
      ...defaults,
      ...candidate,
    };
    appendAudit(restored, user, 'arsip', 'RESTORE_JSON_BACKUP', 'Melakukan pemulihan penuh dari file cadangan JSON.');
    saveLocalDb(restored);
    return restored;
  },

  resetClean: async () => {
    const db = loadLocalDb();
    const user = getActiveUser(db);
    if (!canRoleRestoreBackup(user.role)) {
      throw new Error('Hanya Super Admin yang dapat melakukan reset data bersih.');
    }
    const fresh = createDefaultSaumClientState();
    appendAudit(fresh, user, 'pengaturan', 'RESET_CLEAN_DATA', 'Mereset seluruh data ujian ke kondisi bersih tanpa data dummy.');
    saveLocalDb(fresh);
    return fresh;
  },
};
