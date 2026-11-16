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

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string) {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
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

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const errBody = await res.json();
      if (errBody?.error) message = errBody.error;
    } catch {
      // ignore parse error
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export const saumApi = {
  getUsers: () => request<{ users: UserAccount[] }>('/api/auth/users'),

  login: async (username: string) => {
    const data = await request<{ token: string; user: UserAccount }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username }),
    });
    setStoredToken(data.token);
    return data;
  },

  me: () => request<{ user: UserAccount }>('/api/auth/me'),

  getState: () => request<SaumClientState>('/api/state'),

  saveExamConfig: (examConfig: ExamConfig) =>
    request<{ examConfig: ExamConfig; profile: MadrasahProfile; auditLogs: AuditLogEntry[] }>(
      '/api/exam-config',
      { method: 'PUT', body: JSON.stringify(examConfig) }
    ),

  saveStudents: (students: Student[], backupReason?: string) =>
    request<{ students: Student[]; auditLogs: AuditLogEntry[] }>('/api/students', {
      method: 'PUT',
      body: JSON.stringify({ students, backupReason }),
    }),

  finalizeDnpu: (finalized: boolean) =>
    request<{ examConfig: ExamConfig; auditLogs: AuditLogEntry[] }>('/api/dnpu/finalize', {
      method: 'POST',
      body: JSON.stringify({ finalized }),
    }),

  saveNumbering: (payload: {
    students: Student[];
    numberingConfig: NumberingConfig;
    historyEntry?: NumberingHistoryEntry;
    finalize?: boolean;
  }) =>
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

  saveDeskNumbers: (students: Student[]) =>
    request<{
      students: Student[];
      auditLogs: AuditLogEntry[];
    }>('/api/desk-numbers', {
      method: 'PUT',
      body: JSON.stringify({ students }),
    }),

  saveRooms: (payload: {
    students: Student[];
    rooms: ExamRoom[];
    roomConfig: RoomDistributionConfig;
  }) =>
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

  saveDenahLokasi: (physicalClassrooms: PhysicalClassroom[], finalized?: boolean) =>
    request<{
      physicalClassrooms: PhysicalClassroom[];
      examConfig: ExamConfig;
      auditLogs: AuditLogEntry[];
    }>('/api/denah-lokasi', {
      method: 'PUT',
      body: JSON.stringify({ physicalClassrooms, finalized }),
    }),

  saveSchedules: (
    subjects: ExamSubject[],
    schedules: ExamSchedule[],
    seragamPerHariJenjang?: Record<string, Record<string, string>>
  ) =>
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

  saveSupervisors: (
    supervisors: Supervisor[],
    supervisorAssignments: SupervisorAssignment[],
    rooms?: ExamRoom[]
  ) =>
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

  saveDokumenUjian: (payload: { sealConfigs?: SealDocConfig[]; tataTertibDocs?: TataTertibDoc[] }) =>
    request<{
      sealConfigs: SealDocConfig[];
      tataTertibDocs: TataTertibDoc[];
      auditLogs: AuditLogEntry[];
    }>('/api/dokumen-ujian', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  savePhones: (phoneRecords: SantriPhoneRecord[], hpLogs?: HpHandoverLog[], auditDetail?: string) =>
    request<{
      phoneRecords: SantriPhoneRecord[];
      hpLogs: HpHandoverLog[];
      auditLogs: AuditLogEntry[];
    }>('/api/phones', {
      method: 'PUT',
      body: JSON.stringify({ phoneRecords, hpLogs, auditDetail }),
    }),

  parseHpScan: (payload: {
    fileName: string;
    mimeType: string;
    base64Data: string;
    docSubtype?: string;
  }) =>
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

  uploadArchivedDoc: (doc: UploadedExamDocument) =>
    request<{
      uploadedDocuments: UploadedExamDocument[];
      auditLogs: AuditLogEntry[];
    }>('/api/uploaded-docs', {
      method: 'POST',
      body: JSON.stringify({ doc }),
    }),

  deleteArchivedDoc: (id: string) =>
    request<{
      uploadedDocuments: UploadedExamDocument[];
      auditLogs: AuditLogEntry[];
    }>(`/api/uploaded-docs/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  saveRekap: (rekapConfig: RekapConfig, auditDetail?: string) =>
    request<{
      rekapConfig: RekapConfig;
      auditLogs: AuditLogEntry[];
    }>('/api/rekap', {
      method: 'PUT',
      body: JSON.stringify({ rekapConfig, auditDetail }),
    }),

  createArchive: (record: ExamArchiveRecord) =>
    request<{ archives: ExamArchiveRecord[]; auditLogs: AuditLogEntry[] }>('/api/archives', {
      method: 'POST',
      body: JSON.stringify({ record }),
    }),

  unlockArchive: (id: string, reason: string) =>
    request<{ archives: ExamArchiveRecord[]; auditLogs: AuditLogEntry[] }>(
      `/api/archives/${encodeURIComponent(id)}/unlock`,
      {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }
    ),

  restoreArchive: (id: string) =>
    request<SaumClientState>(`/api/archives/${encodeURIComponent(id)}/restore`, {
      method: 'POST',
    }),

  saveSettings: (payload: Partial<Pick<SaumClientState, 'profile' | 'paperPresets' | 'committee' | 'users'>>) =>
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

  downloadBackup: () => request<{ app: string; version: string; exportedAt: string; data: SaumClientState }>('/api/backup'),

  restoreBackup: (payload: unknown) =>
    request<SaumClientState>('/api/restore', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
