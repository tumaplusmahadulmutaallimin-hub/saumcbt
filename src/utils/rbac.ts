import { UserRole } from '../types';

export type SaumModuleKey =
  | 'dashboard'
  | 'pengaturan_ujian'
  | 'dnpu'
  | 'penomoran'
  | 'nomor_meja'
  | 'ruang_sesi'
  | 'denah_lokasi'
  | 'denah_ruang'
  | 'daftar_hadir'
  | 'label_ruang'
  | 'jadwal'
  | 'pengawas'
  | 'dokumen_ujian'
  | 'admin_hp'
  | 'rekap'
  | 'cetak'
  | 'arsip'
  | 'pengaturan'
  | 'users_roles';

export interface RolePermission {
  canView: SaumModuleKey[];
  canEdit: SaumModuleKey[];
  canUnlockArchive: boolean;
  canRestoreBackup: boolean;
}

export const ALL_MODULES: SaumModuleKey[] = [
  'dashboard',
  'pengaturan_ujian',
  'dnpu',
  'penomoran',
  'nomor_meja',
  'ruang_sesi',
  'denah_lokasi',
  'denah_ruang',
  'daftar_hadir',
  'label_ruang',
  'jadwal',
  'pengawas',
  'dokumen_ujian',
  'admin_hp',
  'rekap',
  'cetak',
  'arsip',
  'pengaturan',
];

export const ROLE_PERMISSIONS: Record<UserRole, RolePermission> = {
  'Super Admin': {
    canView: [...ALL_MODULES, 'users_roles'],
    canEdit: [...ALL_MODULES, 'users_roles'],
    canUnlockArchive: true,
    canRestoreBackup: true,
  },
  'Admin Ujian': {
    canView: ALL_MODULES,
    canEdit: [
      'pengaturan_ujian',
      'dnpu',
      'penomoran',
      'nomor_meja',
      'ruang_sesi',
      'denah_lokasi',
      'denah_ruang',
      'daftar_hadir',
      'label_ruang',
      'jadwal',
      'pengawas',
      'dokumen_ujian',
      'admin_hp',
      'rekap',
      'cetak',
      'arsip',
      'pengaturan',
    ],
    canUnlockArchive: false,
    canRestoreBackup: false,
  },
  Panitia: {
    canView: ALL_MODULES,
    canEdit: [
      'dnpu',
      'nomor_meja',
      'denah_ruang',
      'daftar_hadir',
      'label_ruang',
      'pengawas',
      'dokumen_ujian',
      'admin_hp',
      'rekap',
      'cetak',
    ],
    canUnlockArchive: false,
    canRestoreBackup: false,
  },
  'Petugas HP': {
    canView: ['dashboard', 'admin_hp', 'rekap', 'jadwal', 'denah_lokasi', 'cetak'],
    canEdit: ['admin_hp'],
    canUnlockArchive: false,
    canRestoreBackup: false,
  },
  Pengawas: {
    canView: [
      'dashboard',
      'nomor_meja',
      'denah_lokasi',
      'denah_ruang',
      'daftar_hadir',
      'jadwal',
      'pengawas',
      'dokumen_ujian',
      'rekap',
      'cetak',
    ],
    canEdit: [],
    canUnlockArchive: false,
    canRestoreBackup: false,
  },
};

export function canRoleView(role: UserRole, module: SaumModuleKey): boolean {
  const perm = ROLE_PERMISSIONS[role];
  if (!perm) return false;
  return perm.canView.includes(module);
}

export function canRoleEdit(role: UserRole, module: SaumModuleKey): boolean {
  const perm = ROLE_PERMISSIONS[role];
  if (!perm) return false;
  return perm.canEdit.includes(module);
}

export function canRoleUnlockArchive(role: UserRole): boolean {
  return Boolean(ROLE_PERMISSIONS[role]?.canUnlockArchive);
}

export function canRoleRestoreBackup(role: UserRole): boolean {
  return Boolean(ROLE_PERMISSIONS[role]?.canRestoreBackup);
}
