import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canRoleEdit,
  canRoleRestoreBackup,
  canRoleUnlockArchive,
  canRoleView,
} from './rbac';

test('RBAC: Super Admin has full access including archive unlock and backup restore', () => {
  assert.equal(canRoleView('Super Admin', 'dnpu'), true);
  assert.equal(canRoleEdit('Super Admin', 'dnpu'), true);
  assert.equal(canRoleEdit('Super Admin', 'users_roles'), true);
  assert.equal(canRoleUnlockArchive('Super Admin'), true);
  assert.equal(canRoleRestoreBackup('Super Admin'), true);
});

test('RBAC: Petugas HP can only edit admin_hp and cannot edit DNPU or settings', () => {
  assert.equal(canRoleView('Petugas HP', 'admin_hp'), true);
  assert.equal(canRoleEdit('Petugas HP', 'admin_hp'), true);
  assert.equal(canRoleEdit('Petugas HP', 'dnpu'), false);
  assert.equal(canRoleEdit('Petugas HP', 'pengaturan'), false);
  assert.equal(canRoleEdit('Petugas HP', 'penomoran'), false);
  assert.equal(canRoleUnlockArchive('Petugas HP'), false);
});

test('RBAC: Pengawas is strictly read-only on schedules, rooms, and docs', () => {
  assert.equal(canRoleView('Pengawas', 'jadwal'), true);
  assert.equal(canRoleView('Pengawas', 'pengawas'), true);
  assert.equal(canRoleEdit('Pengawas', 'jadwal'), false);
  assert.equal(canRoleEdit('Pengawas', 'admin_hp'), false);
  assert.equal(canRoleEdit('Pengawas', 'dnpu'), false);
});

test('RBAC: Menu Rekap is editable by Super Admin/Admin Ujian/Panitia and view-only for Petugas HP/Pengawas', () => {
  assert.equal(canRoleView('Super Admin', 'rekap'), true);
  assert.equal(canRoleEdit('Super Admin', 'rekap'), true);
  assert.equal(canRoleEdit('Panitia', 'rekap'), true);
  assert.equal(canRoleView('Petugas HP', 'rekap'), true);
  assert.equal(canRoleEdit('Petugas HP', 'rekap'), false);
  assert.equal(canRoleView('Pengawas', 'rekap'), true);
  assert.equal(canRoleEdit('Pengawas', 'rekap'), false);
});

test('RBAC: Menu Nomor Meja is separated from Nomor Peserta (Penomoran)', () => {
  assert.equal(canRoleEdit('Super Admin', 'nomor_meja'), true);
  assert.equal(canRoleEdit('Admin Ujian', 'nomor_meja'), true);
  assert.equal(canRoleEdit('Panitia', 'nomor_meja'), true);
  assert.equal(canRoleEdit('Panitia', 'penomoran'), false);
  assert.equal(canRoleView('Pengawas', 'nomor_meja'), true);
  assert.equal(canRoleEdit('Pengawas', 'nomor_meja'), false);
});


