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
} from '../types';
import { localFallbackApi } from './localFallbackApi';

export interface SaumClientState {
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

const TOKEN_STORAGE_KEY = 'saum_auth_token';

class BackendUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackendUnavailableError';
  }
}

let useLocalBackend = false;

export function resetBackendDetection() {
  useLocalBackend = false;
}

export function isUsingLocalBackend(): boolean {
  return useLocalBackend;
}

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string) {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // ignore storage write error
  }
}

async function isSaumBackendAvailable(): Promise<boolean> {
  try {
    const res = await fetch('/api/health', { method: 'GET' });
    if (!res.ok) return false;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return false;
    const body = (await res.json()) as { service?: string };
    return body?.service === 'saum-backend';
  } catch {
    return false;
  }
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(url, { ...options, headers });
  } catch {
    throw new BackendUnavailableError('Server backend tidak dapat dijangkau.');
  }

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  // Static hosts (e.g., Vercel without Express) either return 404 or serve index.html for /api/*
  if (res.status === 404 && !isJson) {
    throw new BackendUnavailableError('HTTP 404 (Static Host)');
  }
  if (res.ok && !isJson) {
    throw new BackendUnavailableError('Respons API bukan JSON (Static Host)');
  }

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    if (isJson) {
      try {
        const errBody = await res.json();
        if (errBody?.error) message = errBody.error;
      } catch {
        // ignore parse error
      }
    }
    if (res.status === 404) {
      const alive = await isSaumBackendAvailable();
      if (!alive) {
        throw new BackendUnavailableError(message);
      }
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

async function withFallback<T>(serverFn: () => Promise<T>, localFn: () => Promise<T>): Promise<T> {
  if (useLocalBackend) {
    return localFn();
  }
  try {
    return await serverFn();
  } catch (err) {
    if (err instanceof BackendUnavailableError) {
      useLocalBackend = true;
      return localFn();
    }
    throw err;
  }
}

export const saumApi = {
  getUsers: () =>
    withFallback(
      () => request<{ users: UserAccount[] }>('/api/auth/users'),
      () => localFallbackApi.getUsers()
    ),

  login: async (username: string) =>
    withFallback(
      async () => {
        const data = await request<{ token: string; user: UserAccount }>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ username }),
        });
        setStoredToken(data.token);
        return data;
      },
      async () => {
        const data = await localFallbackApi.login(username);
        setStoredToken(data.token);
        return data;
      }
    ),

  me: () =>
    withFallback(
      () => request<{ user: UserAccount }>('/api/auth/me'),
      () => localFallbackApi.me()
    ),

  getState: () =>
    withFallback(
      () => request<SaumClientState>('/api/state'),
      () => localFallbackApi.getState()
    ),

  saveExamConfig: (examConfig: ExamConfig) =>
    withFallback(
      () =>
        request<{
          examConfig: ExamConfig;
          profile: MadrasahProfile;
          roomConfig: RoomDistributionConfig;
          auditLogs: AuditLogEntry[];
        }>('/api/exam-config', { method: 'PUT', body: JSON.stringify(examConfig) }),
      () => localFallbackApi.saveExamConfig(examConfig)
    ),

  saveStudents: (students: Student[], backupReason?: string) =>
    withFallback(
      () =>
        request<{ students: Student[]; auditLogs: AuditLogEntry[] }>('/api/students', {
          method: 'PUT',
          body: JSON.stringify({ students, backupReason }),
        }),
      () => localFallbackApi.saveStudents(students, backupReason)
    ),

  finalizeDnpu: (finalized: boolean) =>
    withFallback(
      () =>
        request<{ examConfig: ExamConfig; auditLogs: AuditLogEntry[] }>('/api/dnpu/finalize', {
          method: 'POST',
          body: JSON.stringify({ finalized }),
        }),
      () => localFallbackApi.finalizeDnpu(finalized)
    ),

  saveNumbering: (payload: {
    students: Student[];
    numberingConfig: NumberingConfig;
    historyEntry?: NumberingHistoryEntry;
    finalize?: boolean;
  }) =>
    withFallback(
      () =>
        request<{
          students: Student[];
          numberingConfig: NumberingConfig;
          numberingHistory: NumberingHistoryEntry[];
          examConfig: ExamConfig;
          auditLogs: AuditLogEntry[];
        }>('/api/numbering/save', {
          method: 'POST',
          body: JSON.stringify(payload),
        }),
      () => localFallbackApi.saveNumbering(payload)
    ),

  saveDeskNumbers: (students: Student[]) =>
    withFallback(
      () =>
        request<{
          students: Student[];
          auditLogs: AuditLogEntry[];
        }>('/api/desk-numbers', {
          method: 'PUT',
          body: JSON.stringify({ students }),
        }),
      () => localFallbackApi.saveDeskNumbers(students)
    ),

  saveRooms: (payload: {
    students: Student[];
    rooms: ExamRoom[];
    roomConfig: RoomDistributionConfig;
    jumlahSesi?: number;
  }) =>
    withFallback(
      () =>
        request<{
          students: Student[];
          rooms: ExamRoom[];
          roomConfig: RoomDistributionConfig;
          examConfig: ExamConfig;
          auditLogs: AuditLogEntry[];
        }>('/api/rooms/save', {
          method: 'POST',
          body: JSON.stringify(payload),
        }),
      () => localFallbackApi.saveRooms(payload)
    ),

  saveDenahLokasi: (physicalClassrooms: PhysicalClassroom[], finalized?: boolean) =>
    withFallback(
      () =>
        request<{
          physicalClassrooms: PhysicalClassroom[];
          examConfig: ExamConfig;
          auditLogs: AuditLogEntry[];
        }>('/api/denah-lokasi', {
          method: 'PUT',
          body: JSON.stringify({ physicalClassrooms, finalized }),
        }),
      () => localFallbackApi.saveDenahLokasi(physicalClassrooms, finalized)
    ),

  saveSchedules: (
    subjects: ExamSubject[],
    schedules: ExamSchedule[],
    seragamPerHariJenjang?: Record<string, Record<string, string>>
  ) =>
    withFallback(
      () =>
        request<{
          subjects: ExamSubject[];
          schedules: ExamSchedule[];
          examConfig: ExamConfig;
          conflicts: string[];
          auditLogs: AuditLogEntry[];
        }>('/api/schedules', {
          method: 'PUT',
          body: JSON.stringify({ subjects, schedules, seragamPerHariJenjang }),
        }),
      () => localFallbackApi.saveSchedules(subjects, schedules, seragamPerHariJenjang)
    ),

  saveSupervisors: (
    supervisors: Supervisor[],
    supervisorAssignments: SupervisorAssignment[],
    rooms?: ExamRoom[]
  ) =>
    withFallback(
      () =>
        request<{
          supervisors: Supervisor[];
          supervisorAssignments: SupervisorAssignment[];
          rooms: ExamRoom[];
          conflicts: string[];
          auditLogs: AuditLogEntry[];
        }>('/api/supervisors', {
          method: 'PUT',
          body: JSON.stringify({ supervisors, supervisorAssignments, rooms }),
        }),
      () => localFallbackApi.saveSupervisors(supervisors, supervisorAssignments, rooms)
    ),

  saveDokumenUjian: (payload: { sealConfigs?: SealDocConfig[]; tataTertibDocs?: TataTertibDoc[] }) =>
    withFallback(
      () =>
        request<{
          sealConfigs: SealDocConfig[];
          tataTertibDocs: TataTertibDoc[];
          auditLogs: AuditLogEntry[];
        }>('/api/dokumen-ujian', {
          method: 'PUT',
          body: JSON.stringify(payload),
        }),
      () => localFallbackApi.saveDokumenUjian(payload)
    ),

  savePhones: (phoneRecords: SantriPhoneRecord[], hpLogs?: HpHandoverLog[], auditDetail?: string) =>
    withFallback(
      () =>
        request<{
          phoneRecords: SantriPhoneRecord[];
          hpLogs: HpHandoverLog[];
          auditLogs: AuditLogEntry[];
        }>('/api/phones', {
          method: 'PUT',
          body: JSON.stringify({ phoneRecords, hpLogs, auditDetail }),
        }),
      () => localFallbackApi.savePhones(phoneRecords, hpLogs, auditDetail)
    ),

  parseHpScan: (payload: {
    fileName: string;
    mimeType: string;
    base64Data: string;
    docSubtype?: string;
  }) =>
    withFallback(
      () =>
        request<{
          summary: string;
          rows: Array<{
            kodeHp?: string;
            namaSantri: string;
            kelas?: string;
            merekModel?: string;
            nomorBox?: string;
            nomorSlot?: string;
            persentaseBaterai?: number;
            kondisi?: string;
            jamTransaksi?: string;
            petugas?: string;
            isSedangDiambil?: boolean;
            statusPengembalian?: 'Belum dikembalikan' | 'Sudah dikembalikan' | 'Perlu pemeriksaan';
            catatan?: string;
          }>;
        }>('/api/phones/parse-scan', {
          method: 'POST',
          body: JSON.stringify(payload),
        }),
      () => localFallbackApi.parseHpScan(payload)
    ),

  uploadArchivedDoc: (doc: UploadedExamDocument) =>
    withFallback(
      () =>
        request<{
          uploadedDocuments: UploadedExamDocument[];
          auditLogs: AuditLogEntry[];
        }>('/api/uploaded-docs', {
          method: 'POST',
          body: JSON.stringify({ doc }),
        }),
      () => localFallbackApi.uploadArchivedDoc(doc)
    ),

  deleteArchivedDoc: (id: string) =>
    withFallback(
      () =>
        request<{
          uploadedDocuments: UploadedExamDocument[];
          auditLogs: AuditLogEntry[];
        }>(`/api/uploaded-docs/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        }),
      () => localFallbackApi.deleteArchivedDoc(id)
    ),

  saveRekap: (rekapConfig: RekapConfig, auditDetail?: string) =>
    withFallback(
      () =>
        request<{
          rekapConfig: RekapConfig;
          auditLogs: AuditLogEntry[];
        }>('/api/rekap', {
          method: 'PUT',
          body: JSON.stringify({ rekapConfig, auditDetail }),
        }),
      () => localFallbackApi.saveRekap(rekapConfig, auditDetail)
    ),

  createArchive: (record: ExamArchiveRecord) =>
    withFallback(
      () =>
        request<{ archives: ExamArchiveRecord[]; auditLogs: AuditLogEntry[] }>('/api/archives', {
          method: 'POST',
          body: JSON.stringify({ record }),
        }),
      () => localFallbackApi.createArchive(record)
    ),

  unlockArchive: (id: string, reason: string) =>
    withFallback(
      () =>
        request<{ archives: ExamArchiveRecord[]; auditLogs: AuditLogEntry[] }>(
          `/api/archives/${encodeURIComponent(id)}/unlock`,
          {
            method: 'POST',
            body: JSON.stringify({ reason }),
          }
        ),
      () => localFallbackApi.unlockArchive(id, reason)
    ),

  restoreArchive: (id: string) =>
    withFallback(
      () =>
        request<SaumClientState>(`/api/archives/${encodeURIComponent(id)}/restore`, {
          method: 'POST',
        }),
      () => localFallbackApi.restoreArchive(id)
    ),

  saveSettings: (payload: Partial<Pick<SaumClientState, 'profile' | 'paperPresets' | 'committee' | 'users'>>) =>
    withFallback(
      () =>
        request<{
          profile: MadrasahProfile;
          paperPresets: PaperPreset[];
          committee: CommitteeMember[];
          users: UserAccount[];
          auditLogs: AuditLogEntry[];
        }>('/api/settings', {
          method: 'PUT',
          body: JSON.stringify(payload),
        }),
      () => localFallbackApi.saveSettings(payload)
    ),

  downloadBackup: () =>
    withFallback(
      () =>
        request<{ app: string; version: string; exportedAt: string; data: SaumClientState }>('/api/backup'),
      () => localFallbackApi.downloadBackup()
    ),

  restoreBackup: (payload: unknown) =>
    withFallback(
      () =>
        request<SaumClientState>('/api/restore', {
          method: 'POST',
          body: JSON.stringify(payload),
        }),
      () => localFallbackApi.restoreBackup(payload)
    ),

  resetClean: () =>
    withFallback(
      () =>
        request<SaumClientState>('/api/reset-clean', {
          method: 'POST',
        }),
      () => localFallbackApi.resetClean()
    ),
};
