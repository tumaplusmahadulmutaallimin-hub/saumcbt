import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';
import * as XLSX from 'xlsx';
import {
  AuditLogEntry,
  CommitteeMember,
  ExamArchiveRecord,
  ExamConfig,
  ExamRoom,
  ExamSchedule,
  ExamSubject,
  HpHandoverLog,
  MadrasahProfile,
  NumberingConfig,
  NumberingHistoryEntry,
  PaperPreset,
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
} from './src/types';
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
} from './src/data/initialData';
import {
  SaumModuleKey,
  canRoleEdit,
  canRoleRestoreBackup,
  canRoleUnlockArchive,
} from './src/utils/rbac';
import {
  validateScheduleConflicts,
  validateSupervisorConflicts,
} from './src/utils/seating';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const DB_FILE = path.join(DATA_DIR, 'saum-db.json');
const SESSION_FILE = path.join(DATA_DIR, 'saum-sessions.json');

export interface SaumDatabaseState {
  profile: MadrasahProfile;
  examConfig: ExamConfig;
  students: Student[];
  rooms: ExamRoom[];
  physicalClassrooms: PhysicalClassroom[];
  schedules: ExamSchedule[];
  subjects: ExamSubject[];
  committee: CommitteeMember[];
  supervisors: Supervisor[];
  supervisorAssignments: SupervisorAssignment[];
  numberingConfig: NumberingConfig;
  numberingHistory: NumberingHistoryEntry[];
  roomConfig: RoomDistributionConfig;
  paperPresets: PaperPreset[];
  sealConfigs: SealDocConfig[];
  tataTertibDocs: TataTertibDoc[];
  phoneRecords: SantriPhoneRecord[];
  hpLogs: HpHandoverLog[];
  uploadedDocuments: UploadedExamDocument[];
  rekapConfig: RekapConfig;
  archives: ExamArchiveRecord[];
  users: UserAccount[];
  auditLogs: AuditLogEntry[];
}

function ensureDirectories() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function createInitialDbState(): SaumDatabaseState {
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
        detail: 'Inisialisasi basis data SAUM bersih siap input data madrasah.',
      },
    ],
  };
}

function mergePaperPresets(defaults: PaperPreset[], existing?: PaperPreset[]): PaperPreset[] {
  if (!Array.isArray(existing) || existing.length === 0) return defaults;
  const byId = new Map(existing.map((p) => [p.id, p]));
  return defaults.map((d) => {
    const saved = byId.get(d.id);
    return saved ? { ...d, ...saved } : d;
  });
}

function loadDb(): SaumDatabaseState {
  ensureDirectories();
  if (!fs.existsSync(DB_FILE)) {
    const initial = createInitialDbState();
    saveDb(initial);
    return initial;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<SaumDatabaseState>;
    const defaults = createInitialDbState();
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
  } catch (err) {
    console.error('Failed to read DB file, recreating defaults:', err);
    const initial = createInitialDbState();
    saveDb(initial);
    return initial;
  }
}

function saveDb(state: SaumDatabaseState) {
  ensureDirectories();
  const tmpPath = `${DB_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf-8');
  fs.renameSync(tmpPath, DB_FILE);
}

function createBackup(state: SaumDatabaseState, reason: string) {
  ensureDirectories();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeReason = reason.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  const filePath = path.join(BACKUP_DIR, `backup-${stamp}-${safeReason}.json`);
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf-8');

  // Keep latest 30 backups
  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .reverse();
  for (const oldFile of files.slice(30)) {
    try {
      fs.unlinkSync(path.join(BACKUP_DIR, oldFile));
    } catch {
      // ignore cleanup error
    }
  }
}

function appendAudit(
  state: SaumDatabaseState,
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
  state.auditLogs = [entry, ...(state.auditLogs || [])].slice(0, 250);
}

type SessionStore = Record<string, string>; // token -> userId

function loadSessions(): SessionStore {
  ensureDirectories();
  if (!fs.existsSync(SESSION_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8')) as SessionStore;
  } catch {
    return {};
  }
}

function saveSessions(sessions: SessionStore) {
  ensureDirectories();
  const tmpPath = `${SESSION_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(sessions, null, 2), 'utf-8');
  fs.renameSync(tmpPath, SESSION_FILE);
}

interface AuthedRequest extends Request {
  currentUser?: UserAccount;
}

function getRequestToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const altHeader = req.headers['x-saum-token'];
  if (typeof altHeader === 'string' && altHeader.trim()) {
    return altHeader.trim();
  }
  return undefined;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const db = loadDb();
  const sessions = loadSessions();
  const token = getRequestToken(req);
  if (!token || !sessions[token]) {
    res.status(401).json({ error: 'Sesi otentikasi tidak valid atau belum login.' });
    return;
  }
  const user = db.users.find((u) => u.id === sessions[token] && u.aktif);
  if (!user) {
    res.status(401).json({ error: 'Pengguna tidak ditemukan atau tidak aktif.' });
    return;
  }
  req.currentUser = user;
  next();
}

function requireModuleEdit(moduleKey: SaumModuleKey) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const user = req.currentUser;
    if (!user) {
      res.status(401).json({ error: 'Unauthenticated' });
      return;
    }
    if (!canRoleEdit(user.role, moduleKey)) {
      res.status(403).json({
        error: `Akses ditolak. Peran "${user.role}" tidak memiliki izin mengubah modul "${moduleKey}".`,
      });
      return;
    }
    next();
  };
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

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  // Public health & user directory for role switcher / login
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'saum-backend' });
  });

  app.get('/api/auth/users', (_req, res) => {
    const db = loadDb();
    res.json({ users: db.users });
  });

  app.post('/api/auth/login', (req, res) => {
    const { username, userId } = req.body as { username?: string; userId?: string };
    const db = loadDb();
    const user = db.users.find(
      (u) => u.aktif && (u.id === userId || u.username.toLowerCase() === (username || '').toLowerCase())
    );
    if (!user) {
      res.status(404).json({ error: 'Akun pengguna tidak ditemukan atau nonaktif.' });
      return;
    }
    const token = crypto.randomBytes(24).toString('hex');
    const sessions = loadSessions();
    sessions[token] = user.id;
    saveSessions(sessions);

    appendAudit(db, user, 'auth', 'LOGIN', `Login sebagai ${user.nama} (${user.role})`);
    saveDb(db);

    res.json({ token, user });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
    res.json({ user: req.currentUser });
  });

  app.post('/api/auth/logout', (req, res) => {
    const token = getRequestToken(req);
    if (token) {
      const sessions = loadSessions();
      delete sessions[token];
      saveSessions(sessions);
    }
    res.json({ ok: true });
  });

  // Read full SAUM state (authenticated)
  app.get('/api/state', requireAuth, (_req, res) => {
    const db = loadDb();
    res.json(db);
  });

  // Modular Update Endpoints with strict RBAC & Validation
  app.put('/api/exam-config', requireAuth, requireModuleEdit('pengaturan_ujian'), (req: AuthedRequest, res) => {
    const db = loadDb();
    const nextConfig = req.body as ExamConfig;
    db.examConfig = nextConfig;
    db.roomConfig = {
      ...db.roomConfig,
      jumlahRuangManual:
        typeof nextConfig.jumlahRuang === 'number' && nextConfig.jumlahRuang >= 0
          ? nextConfig.jumlahRuang
          : db.roomConfig.jumlahRuangManual,
    };
    // Sync exam name & tahun pelajaran into profile for 1-source consistency
    db.profile = {
      ...db.profile,
      jenisUjian: nextConfig.namaUjian || db.profile.jenisUjian,
      tahunPelajaran: nextConfig.tahunPelajaran || db.profile.tahunPelajaran,
    };
    appendAudit(db, req.currentUser!, 'pengaturan_ujian', 'UPDATE_CONFIG', `Moda: ${nextConfig.moda}, Ruang: ${nextConfig.jumlahRuang}, Sesi: ${nextConfig.jumlahSesi}`);
    saveDb(db);
    res.json({ examConfig: db.examConfig, profile: db.profile, roomConfig: db.roomConfig, auditLogs: db.auditLogs });
  });

  app.put('/api/students', requireAuth, requireModuleEdit('dnpu'), (req: AuthedRequest, res) => {
    const { students, backupReason } = req.body as { students: Student[]; backupReason?: string };
    if (!Array.isArray(students)) {
      res.status(400).json({ error: 'Payload students harus berupa array.' });
      return;
    }
    const err = validateStudentsIntegrity(students);
    if (err) {
      res.status(400).json({ error: err });
      return;
    }
    const db = loadDb();
    if (backupReason) createBackup(db, backupReason);
    db.students = students;
    appendAudit(db, req.currentUser!, 'dnpu', 'UPDATE_STUDENTS', `Memperbarui ${students.length} data peserta.`);
    saveDb(db);
    res.json({ students: db.students, auditLogs: db.auditLogs });
  });

  app.post('/api/dnpu/finalize', requireAuth, requireModuleEdit('penomoran'), (req: AuthedRequest, res) => {
    const { finalized } = req.body as { finalized: boolean };
    const db = loadDb();
    createBackup(db, finalized ? 'finalize-dnpu' : 'unfinalize-dnpu');
    db.examConfig.isDnpuFinalized = Boolean(finalized);
    appendAudit(
      db,
      req.currentUser!,
      'dnpu',
      finalized ? 'FINALIZE_DNPU' : 'REOPEN_DNPU',
      finalized ? 'DNPU difinalisasi.' : 'Finalisasi DNPU dibuka kembali.'
    );
    saveDb(db);
    res.json({ examConfig: db.examConfig, auditLogs: db.auditLogs });
  });

  app.post('/api/numbering/save', requireAuth, requireModuleEdit('penomoran'), (req: AuthedRequest, res) => {
    const {
      students,
      numberingConfig,
      historyEntry,
      finalize,
    } = req.body as {
      students: Student[];
      numberingConfig: NumberingConfig;
      historyEntry?: NumberingHistoryEntry;
      finalize?: boolean;
    };
    if (!Array.isArray(students)) {
      res.status(400).json({ error: 'Payload students harus berupa array.' });
      return;
    }
    const err = validateStudentsIntegrity(students);
    if (err) {
      res.status(400).json({ error: err });
      return;
    }
    const db = loadDb();
    createBackup(db, 'numbering-generate');
    db.students = students;
    db.numberingConfig = numberingConfig;
    if (typeof finalize === 'boolean') {
      db.examConfig.isNomorFinalized = finalize;
    }
    if (historyEntry) {
      db.numberingHistory = [historyEntry, ...(db.numberingHistory || [])].slice(0, 50);
    }
    appendAudit(
      db,
      req.currentUser!,
      'penomoran',
      'GENERATE_NUMBERS',
      `Menyimpan penomoran peserta (${students.filter((s) => s.nomorPeserta).length} bernomor).`
    );
    saveDb(db);
    res.json({
      students: db.students,
      numberingConfig: db.numberingConfig,
      numberingHistory: db.numberingHistory,
      examConfig: db.examConfig,
      auditLogs: db.auditLogs,
    });
  });

  app.put('/api/desk-numbers', requireAuth, requireModuleEdit('nomor_meja'), (req: AuthedRequest, res) => {
    const { students } = req.body as { students: Student[] };
    if (!Array.isArray(students)) {
      res.status(400).json({ error: 'Payload students harus berupa array.' });
      return;
    }
    const err = validateStudentsIntegrity(students);
    if (err) {
      res.status(400).json({ error: err });
      return;
    }
    const db = loadDb();
    db.students = students;
    appendAudit(
      db,
      req.currentUser!,
      'nomor_meja',
      'UPDATE_DESK_NUMBERS',
      `Memperbarui penomoran kursi & meja untuk ${students.filter((s) => s.nomorMeja).length} peserta.`
    );
    saveDb(db);
    res.json({
      students: db.students,
      auditLogs: db.auditLogs,
    });
  });

  app.post('/api/rooms/save', requireAuth, requireModuleEdit('ruang_sesi'), (req: AuthedRequest, res) => {
    const { students, rooms, roomConfig } = req.body as {
      students: Student[];
      rooms: ExamRoom[];
      roomConfig: RoomDistributionConfig;
    };
    if (!Array.isArray(students) || !Array.isArray(rooms)) {
      res.status(400).json({ error: 'Payload students dan rooms harus berupa array.' });
      return;
    }
    const db = loadDb();
    createBackup(db, 'room-distribution');
    db.students = students;
    db.rooms = rooms;
    db.roomConfig = {
      ...roomConfig,
      jumlahRuangManual:
        roomConfig?.jumlahRuangManual && roomConfig.jumlahRuangManual > 0
          ? roomConfig.jumlahRuangManual
          : rooms.length,
    };
    db.examConfig.jumlahRuang = rooms.length;
    appendAudit(
      db,
      req.currentUser!,
      'ruang_sesi',
      'SAVE_ROOMS_SESSIONS',
      `Menyimpan pembagian ${rooms.length} ruang ujian.`
    );
    saveDb(db);
    res.json({
      students: db.students,
      rooms: db.rooms,
      roomConfig: db.roomConfig,
      examConfig: db.examConfig,
      auditLogs: db.auditLogs,
    });
  });

  app.put('/api/denah-lokasi', requireAuth, requireModuleEdit('denah_lokasi'), (req: AuthedRequest, res) => {
    const { physicalClassrooms, finalized } = req.body as {
      physicalClassrooms: PhysicalClassroom[];
      finalized?: boolean;
    };
    if (!Array.isArray(physicalClassrooms)) {
      res.status(400).json({ error: 'Payload physicalClassrooms harus berupa array.' });
      return;
    }
    const db = loadDb();
    if (db.examConfig.isDenahLokasiFinalized) {
      createBackup(db, 'update-finalized-denah-lokasi');
    }
    db.physicalClassrooms = physicalClassrooms;
    if (typeof finalized === 'boolean') {
      db.examConfig.isDenahLokasiFinalized = finalized;
    }
    appendAudit(
      db,
      req.currentUser!,
      'denah_lokasi',
      'UPDATE_DENAH_LOKASI',
      `Memperbarui pemetaan ${physicalClassrooms.length} kelas fisik (Final: ${db.examConfig.isDenahLokasiFinalized}).`
    );
    saveDb(db);
    res.json({
      physicalClassrooms: db.physicalClassrooms,
      examConfig: db.examConfig,
      auditLogs: db.auditLogs,
    });
  });

  app.put('/api/schedules', requireAuth, requireModuleEdit('jadwal'), (req: AuthedRequest, res) => {
    const { subjects, schedules, seragamPerHariJenjang } = req.body as {
      subjects: ExamSubject[];
      schedules: ExamSchedule[];
      seragamPerHariJenjang?: Record<string, Record<string, string>>;
    };
    if (!Array.isArray(subjects) || !Array.isArray(schedules)) {
      res.status(400).json({ error: 'Payload subjects dan schedules harus berupa array.' });
      return;
    }
    const db = loadDb();
    const conflicts = validateScheduleConflicts(schedules, db.physicalClassrooms);
    db.subjects = subjects;
    db.schedules = schedules;
    db.examConfig.jumlahMapel = subjects.length;
    if (seragamPerHariJenjang) {
      db.examConfig.seragamPerHariJenjang = seragamPerHariJenjang;
    }
    appendAudit(
      db,
      req.currentUser!,
      'jadwal',
      'UPDATE_SCHEDULES',
      `Memperbarui ${subjects.length} mapel, ${schedules.length} jadwal, dan aturan seragam (${conflicts.length} konflik).`
    );
    saveDb(db);
    res.json({
      subjects: db.subjects,
      schedules: db.schedules,
      examConfig: db.examConfig,
      conflicts,
      auditLogs: db.auditLogs,
    });
  });

  app.put('/api/supervisors', requireAuth, requireModuleEdit('pengawas'), (req: AuthedRequest, res) => {
    const { supervisors, supervisorAssignments, rooms } = req.body as {
      supervisors: Supervisor[];
      supervisorAssignments: SupervisorAssignment[];
      rooms?: ExamRoom[];
    };
    if (!Array.isArray(supervisors) || !Array.isArray(supervisorAssignments)) {
      res.status(400).json({ error: 'Payload supervisors dan supervisorAssignments harus berupa array.' });
      return;
    }
    const db = loadDb();
    const conflicts = validateSupervisorConflicts(supervisorAssignments, db.schedules);
    db.supervisors = supervisors;
    db.supervisorAssignments = supervisorAssignments;
    if (rooms) db.rooms = rooms;
    appendAudit(
      db,
      req.currentUser!,
      'pengawas',
      'UPDATE_SUPERVISORS',
      `Memperbarui ${supervisors.length} pengawas dan ${supervisorAssignments.length} penugasan (${conflicts.length} konflik).`
    );
    saveDb(db);
    res.json({
      supervisors: db.supervisors,
      supervisorAssignments: db.supervisorAssignments,
      rooms: db.rooms,
      conflicts,
      auditLogs: db.auditLogs,
    });
  });

  app.put('/api/dokumen-ujian', requireAuth, requireModuleEdit('dokumen_ujian'), (req: AuthedRequest, res) => {
    const { sealConfigs, tataTertibDocs } = req.body as {
      sealConfigs?: SealDocConfig[];
      tataTertibDocs?: TataTertibDoc[];
    };
    const db = loadDb();
    if (sealConfigs) db.sealConfigs = sealConfigs;
    if (tataTertibDocs) db.tataTertibDocs = tataTertibDocs;
    appendAudit(db, req.currentUser!, 'dokumen_ujian', 'UPDATE_DOKUMEN_UJIAN', 'Memperbarui konfigurasi segel soal / tata tertib.');
    saveDb(db);
    res.json({ sealConfigs: db.sealConfigs, tataTertibDocs: db.tataTertibDocs, auditLogs: db.auditLogs });
  });

  // Administrasi HP Routes (Moda Online)
  app.put('/api/phones', requireAuth, requireModuleEdit('admin_hp'), (req: AuthedRequest, res) => {
    const { phoneRecords, hpLogs, auditDetail } = req.body as {
      phoneRecords: SantriPhoneRecord[];
      hpLogs?: HpHandoverLog[];
      auditDetail?: string;
    };
    if (!Array.isArray(phoneRecords)) {
      res.status(400).json({ error: 'Payload phoneRecords harus berupa array.' });
      return;
    }
    // Validate unique kodeHp
    const seenCodes = new Set<string>();
    for (const p of phoneRecords) {
      const code = (p.kodeHp || '').trim().toUpperCase();
      if (!code) {
        res.status(400).json({ error: 'Kode unik HP wajib diisi.' });
        return;
      }
      if (seenCodes.has(code)) {
        res.status(400).json({ error: `Kode HP ganda terdeteksi: ${p.kodeHp}` });
        return;
      }
      seenCodes.add(code);
    }

    const db = loadDb();
    db.phoneRecords = phoneRecords;
    if (hpLogs) db.hpLogs = hpLogs;
    appendAudit(
      db,
      req.currentUser!,
      'admin_hp',
      'UPDATE_PHONES',
      auditDetail || `Memperbarui data HP santri (${phoneRecords.length} unit tercatat).`
    );
    saveDb(db);
    res.json({ phoneRecords: db.phoneRecords, hpLogs: db.hpLogs, auditLogs: db.auditLogs });
  });

  // Parse Uploaded Scanned HP Form (Image/PDF via Gemini Vision, or Excel/CSV via XLSX)
  app.post('/api/phones/parse-scan', requireAuth, requireModuleEdit('admin_hp'), async (req: AuthedRequest, res) => {
    const { fileName, mimeType, base64Data, docSubtype } = req.body as {
      fileName?: string;
      mimeType?: string;
      base64Data?: string;
      docSubtype?: string;
    };

    if (!base64Data || !mimeType) {
      res.status(400).json({ error: 'Data file scan wajib disertakan.' });
      return;
    }

    try {
      // Handle spreadsheet / CSV directly without external AI call
      const lowerName = (fileName || '').toLowerCase();
      if (
        mimeType.includes('spreadsheet') ||
        mimeType.includes('excel') ||
        mimeType === 'text/csv' ||
        lowerName.endsWith('.xlsx') ||
        lowerName.endsWith('.xls') ||
        lowerName.endsWith('.csv')
      ) {
        const buffer = Buffer.from(base64Data, 'base64');
        const wb = XLSX.read(buffer, { type: 'buffer' });
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
            const isSedangDiambil =
              diambilRaw
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

        res.json({
          summary: `Berhasil membaca ${parsedRows.length} baris dari dokumen spreadsheet "${fileName || 'HP'}".`,
          rows: parsedRows,
        });
        return;
      }

      // Handle Image / PDF via Gemini Vision (@google/genai)
      if (!process.env.GEMINI_API_KEY) {
        res.status(400).json({
          error: 'GEMINI_API_KEY belum tersedia di server untuk membaca gambar/PDF tulisan tangan. Unggah CSV/Excel atau pastikan GEMINI_API_KEY aktif.',
        });
        return;
      }

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const promptText = `Anda adalah asisten administrasi ujian madrasah (SAUM). Bacalah formulir administrasi HP (${docSubtype || 'umum'}) pada gambar/dokumen terlampir, termasuk tulisan tangan pada kolom-kolom tabel. Ekstrak setiap baris santri beserta Kode HP, Nama Santri, Kelas, Merek/Tipe HP, Nomor Box, Nomor Slot, Persentase Baterai (angka 0-100 jika tertulis), Kondisi, Jam, Nama Petugas/Penyetor, Status Diambil/Pengembalian jika ada, dan Catatan. Jika kolom tertentu kosong di kertas, biarkan string kosong atau jangan diisi.`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
            { text: promptText },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: {
                type: Type.STRING,
                description: 'Ringkasan singkat isi formulir yang terbaca.',
              },
              rows: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    kodeHp: { type: Type.STRING },
                    namaSantri: { type: Type.STRING },
                    kelas: { type: Type.STRING },
                    merekModel: { type: Type.STRING },
                    nomorBox: { type: Type.STRING },
                    nomorSlot: { type: Type.STRING },
                    persentaseBaterai: { type: Type.NUMBER },
                    kondisi: { type: Type.STRING },
                    jamTransaksi: { type: Type.STRING },
                    petugas: { type: Type.STRING },
                    isSedangDiambil: { type: Type.BOOLEAN },
                    statusPengembalian: { type: Type.STRING },
                    catatan: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
      });

      const rawText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawText) as {
        summary?: string;
        rows?: Array<Record<string, unknown>>;
      };

      const rows = (parsed.rows || []).filter((r) => String(r.namaSantri || r.kodeHp || '').trim() !== '');
      res.json({
        summary: parsed.summary || `Sistem berhasil membaca ${rows.length} baris dari scan "${fileName || 'dokumen'}".`,
        rows,
      });
    } catch (err) {
      console.error('Failed to parse HP scan:', err);
      res.status(500).json({
        error: err instanceof Error ? `Gagal membaca dokumen scan: ${err.message}` : 'Gagal membaca dokumen scan.',
      });
    }
  });

  // Uploaded Exam Documents Archive (HP Scans + Other Exam Scans)
  app.post('/api/uploaded-docs', requireAuth, (req: AuthedRequest, res) => {
    const { doc } = req.body as { doc?: UploadedExamDocument };
    if (!doc || !doc.fileName || !doc.fileDataUrl) {
      res.status(400).json({ error: 'Dokumen unggahan tidak lengkap.' });
      return;
    }
    const allowed =
      canRoleEdit(req.currentUser!.role, 'arsip') ||
      (doc.category === 'admin_hp' && canRoleEdit(req.currentUser!.role, 'admin_hp'));
    if (!allowed) {
      res.status(403).json({ error: 'Anda tidak memiliki izin mengarsipkan dokumen ini.' });
      return;
    }
    const db = loadDb();
    db.uploadedDocuments = [doc, ...(db.uploadedDocuments || [])];
    appendAudit(
      db,
      req.currentUser!,
      doc.category === 'admin_hp' ? 'admin_hp' : 'arsip',
      'UPLOAD_ARCHIVED_DOC',
      `Mengarsipkan dokumen scan "${doc.title}" (${doc.fileName})`
    );
    saveDb(db);
    res.json({ uploadedDocuments: db.uploadedDocuments, auditLogs: db.auditLogs });
  });

  app.delete('/api/uploaded-docs/:id', requireAuth, (req: AuthedRequest, res) => {
    const db = loadDb();
    const target = (db.uploadedDocuments || []).find((d) => d.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'Dokumen arsip tidak ditemukan.' });
      return;
    }
    const allowed =
      canRoleEdit(req.currentUser!.role, 'arsip') ||
      (target.category === 'admin_hp' && canRoleEdit(req.currentUser!.role, 'admin_hp'));
    if (!allowed) {
      res.status(403).json({ error: 'Anda tidak memiliki izin menghapus dokumen ini.' });
      return;
    }
    db.uploadedDocuments = (db.uploadedDocuments || []).filter((d) => d.id !== req.params.id);
    appendAudit(db, req.currentUser!, 'arsip', 'DELETE_ARCHIVED_DOC', `Menghapus dokumen arsip "${target.title}"`);
    saveDb(db);
    res.json({ uploadedDocuments: db.uploadedDocuments, auditLogs: db.auditLogs });
  });

  // Rekap Perlengkapan & Penggandaan
  app.put('/api/rekap', requireAuth, requireModuleEdit('rekap'), (req: AuthedRequest, res) => {
    const { rekapConfig, auditDetail } = req.body as { rekapConfig: RekapConfig; auditDetail?: string };
    if (!rekapConfig || !Array.isArray(rekapConfig.customSupplies)) {
      res.status(400).json({ error: 'Format data rekap perlengkapan tidak valid.' });
      return;
    }
    const db = loadDb();
    db.rekapConfig = rekapConfig;
    appendAudit(
      db,
      req.currentUser!,
      'rekap',
      'UPDATE_REKAP',
      auditDetail || `Memperbarui rekap perlengkapan (${rekapConfig.customSupplies.length} item) dan status penggandaan.`
    );
    saveDb(db);
    res.json({ rekapConfig: db.rekapConfig, auditLogs: db.auditLogs });
  });

  // Archive Routes
  app.post('/api/archives', requireAuth, requireModuleEdit('arsip'), (req: AuthedRequest, res) => {
    const { record } = req.body as { record: ExamArchiveRecord };
    const db = loadDb();
    createBackup(db, 'create-archive');
    db.archives = [record, ...db.archives];
    appendAudit(db, req.currentUser!, 'arsip', 'CREATE_ARCHIVE', `Mengarsipkan ujian: ${record.namaUjian} (${record.tahunPelajaran})`);
    saveDb(db);
    res.json({ archives: db.archives, auditLogs: db.auditLogs });
  });

  app.post('/api/archives/:id/unlock', requireAuth, (req: AuthedRequest, res) => {
    if (!canRoleUnlockArchive(req.currentUser!.role)) {
      res.status(403).json({ error: 'Hanya Super Admin yang dapat membuka kunci arsip terkunci.' });
      return;
    }
    const { reason } = req.body as { reason?: string };
    if (!reason || reason.trim().length < 5) {
      res.status(400).json({ error: 'Alasan pembukaan kunci arsip wajib diisi (minimal 5 karakter).' });
      return;
    }
    const db = loadDb();
    const target = db.archives.find((a) => a.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'Arsip tidak ditemukan.' });
      return;
    }
    createBackup(db, `unlock-archive-${target.id}`);
    target.isLocked = false;
    target.unlockReason = reason.trim();
    appendAudit(
      db,
      req.currentUser!,
      'arsip',
      'UNLOCK_ARCHIVE',
      `Membuka kunci arsip "${target.namaUjian}" dengan alasan: ${reason.trim()}`
    );
    saveDb(db);
    res.json({ archives: db.archives, auditLogs: db.auditLogs });
  });

  app.post('/api/archives/:id/restore', requireAuth, (req: AuthedRequest, res) => {
    if (!canRoleRestoreBackup(req.currentUser!.role)) {
      res.status(403).json({ error: 'Hanya Super Admin yang dapat memulihkan arsip.' });
      return;
    }
    const db = loadDb();
    const target = db.archives.find((a) => a.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'Arsip tidak ditemukan.' });
      return;
    }
    if (target.isLocked) {
      res.status(403).json({ error: 'Arsip terkunci. Buka kunci dengan alasan resmi terlebih dahulu.' });
      return;
    }
    createBackup(db, `before-restore-archive-${target.id}`);
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
    appendAudit(db, req.currentUser!, 'arsip', 'RESTORE_ARCHIVE', `Memulihkan data dari arsip "${target.namaUjian}"`);
    saveDb(db);
    res.json(db);
  });

  // Settings (Madrasah profile, Paper Presets, Committee, Users)
  app.put('/api/settings', requireAuth, requireModuleEdit('pengaturan'), (req: AuthedRequest, res) => {
    const { profile, paperPresets, committee, users } = req.body as Partial<SaumDatabaseState>;
    const db = loadDb();
    if (users) {
      if (!canRoleEdit(req.currentUser!.role, 'users_roles')) {
        res.status(403).json({ error: 'Hanya Super Admin yang dapat mengelola pengguna dan hak akses.' });
        return;
      }
      db.users = users;
    }
    if (profile) db.profile = profile;
    if (paperPresets) db.paperPresets = paperPresets;
    if (committee) db.committee = committee;
    appendAudit(db, req.currentUser!, 'pengaturan', 'UPDATE_SETTINGS', 'Memperbarui pengaturan madrasah / kertas / panitia.');
    saveDb(db);
    res.json({
      profile: db.profile,
      paperPresets: db.paperPresets,
      committee: db.committee,
      users: db.users,
      auditLogs: db.auditLogs,
    });
  });

  // Full JSON Backup & Restore
  app.get('/api/backup', requireAuth, (_req, res) => {
    const db = loadDb();
    res.json({
      app: 'SAUM',
      version: '2.0',
      exportedAt: new Date().toISOString(),
      data: db,
    });
  });

  app.post('/api/restore', requireAuth, (req: AuthedRequest, res) => {
    if (!canRoleRestoreBackup(req.currentUser!.role)) {
      res.status(403).json({ error: 'Hanya Super Admin yang dapat melakukan restore backup penuh.' });
      return;
    }
    const payload = req.body?.data || req.body;
    if (!payload || !Array.isArray(payload.students) || !payload.profile) {
      res.status(400).json({ error: 'Format file backup SAUM tidak valid.' });
      return;
    }
    const current = loadDb();
    createBackup(current, 'before-manual-restore');
    const defaults = createInitialDbState();
    const restored: SaumDatabaseState = {
      ...defaults,
      ...payload,
    };
    appendAudit(restored, req.currentUser!, 'arsip', 'RESTORE_JSON_BACKUP', 'Melakukan pemulihan penuh dari file cadangan JSON.');
    saveDb(restored);
    res.json(restored);
  });

  // Reset Data Bersih (Hanya Super Admin)
  app.post('/api/reset-clean', requireAuth, (req: AuthedRequest, res) => {
    if (!canRoleRestoreBackup(req.currentUser!.role)) {
      res.status(403).json({ error: 'Hanya Super Admin yang dapat melakukan reset data bersih.' });
      return;
    }
    const current = loadDb();
    createBackup(current, 'before-reset-clean');
    const fresh = createInitialDbState();
    appendAudit(fresh, req.currentUser!, 'pengaturan', 'RESET_CLEAN_DATA', 'Mereset seluruh data ujian ke kondisi bersih tanpa data dummy.');
    saveDb(fresh);
    res.json(fresh);
  });

  // Vite dev middleware or static serving in production
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SAUM Server running at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start SAUM server:', err);
  process.exit(1);
});
