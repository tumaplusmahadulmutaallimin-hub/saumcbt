import React, { useEffect, useRef, useState } from 'react';
import {
  Building2,
  Image as ImageIcon,
  FileSpreadsheet,
  Users,
  Shield,
  Save,
  Plus,
  Trash2,
  CheckCircle2,
  Printer,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';
import {
  AuditLogEntry,
  CommitteeMember,
  MadrasahProfile,
  PaperOrientation,
  PaperPreset,
  PaperSize,
  UserAccount,
  UserRole,
} from '../../types';
import { KopSurat } from '../documents/KopSurat';
import { canRoleEdit } from '../../utils/rbac';

interface PengaturanViewProps {
  profile: MadrasahProfile;
  paperPresets: PaperPreset[];
  committee: CommitteeMember[];
  users: UserAccount[];
  auditLogs: AuditLogEntry[];
  currentUser: UserAccount;
  canEdit: boolean;
  initialTab?: 'madrasah_kop' | 'kertas' | 'panitia' | 'akses';
  onSaveSettings: (payload: {
    profile?: MadrasahProfile;
    paperPresets?: PaperPreset[];
    committee?: CommitteeMember[];
    users?: UserAccount[];
  }) => Promise<void>;
  onSwitchUser: (username: string) => Promise<void>;
  onNavigateToPrintSk: () => void;
  onResetClean?: () => Promise<void>;
}

export const PengaturanView: React.FC<PengaturanViewProps> = ({
  profile,
  paperPresets,
  committee,
  users,
  auditLogs,
  currentUser,
  canEdit,
  initialTab = 'madrasah_kop',
  onSaveSettings,
  onSwitchUser,
  onNavigateToPrintSk,
  onResetClean,
}) => {
  const [activeTab, setActiveTab] = useState<'madrasah_kop' | 'kertas' | 'panitia' | 'akses'>(initialTab);
  const [localProfile, setLocalProfile] = useState<MadrasahProfile>(profile);
  const [localPresets, setLocalPresets] = useState<PaperPreset[]>(paperPresets);
  const [localUsers, setLocalUsers] = useState<UserAccount[]>(users);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [newMember, setNewMember] = useState<Partial<CommitteeMember>>({
    nama: '',
    nip: '',
    jabatan: '',
    tugas: '',
    noHp: '',
    status: 'Aktif',
  });
  const [notice, setNotice] = useState('');
  const kopFileRef = useRef<HTMLInputElement>(null);
  const logoMadrasahRef = useRef<HTMLInputElement>(null);
  const logoKemenagRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setLocalProfile(profile);
  }, [profile]);

  useEffect(() => {
    setLocalPresets(paperPresets);
  }, [paperPresets]);

  useEffect(() => {
    setLocalUsers(users);
  }, [users]);

  const canManageUsers = canRoleEdit(currentUser.role, 'users_roles');

  const handleUploadImage = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'kopImageUrl' | 'logoMadrasahUrl' | 'logoKemenagUrl'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setLocalProfile((prev) => ({
          ...prev,
          [field]: reader.result as string,
          useOriginalKopImage: field === 'kopImageUrl' ? true : prev.useOriginalKopImage,
          showLogoKemenag: field === 'logoKemenagUrl' ? true : prev.showLogoKemenag,
          showLogoMadrasah: field === 'logoMadrasahUrl' ? true : prev.showLogoMadrasah,
        }));
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSaveMadrasahKop = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveSettings({ profile: localProfile });
    setNotice('Identitas madrasah, logo Kemenag/Madrasah, dan KOP surat berhasil disimpan.');
  };

  const handleSavePresets = async () => {
    await onSaveSettings({ paperPresets: localPresets });
    setNotice('Pengaturan ukuran kertas dan margin setiap dokumen berhasil disimpan.');
  };

  const handleAddCommittee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMember.nama || !newMember.jabatan) return;
    const member: CommitteeMember = {
      id: `com-${Date.now()}`,
      nama: newMember.nama,
      nip: newMember.nip || '',
      jabatan: newMember.jabatan,
      tugas: newMember.tugas || '-',
      noHp: newMember.noHp || '-',
      status: 'Aktif',
    };
    await onSaveSettings({ committee: [...committee, member] });
    setNewMember({ nama: '', nip: '', jabatan: '', tugas: '', noHp: '', status: 'Aktif' });
    setNotice(`Anggota panitia "${member.nama}" ditambahkan.`);
  };

  const handleDeleteCommittee = async (id: string) => {
    await onSaveSettings({ committee: committee.filter((c) => c.id !== id) });
  };

  const handleUpdateUserRole = async (userId: string, role: UserRole) => {
    const updated = localUsers.map((u) => (u.id === userId ? { ...u, role } : u));
    setLocalUsers(updated);
    await onSaveSettings({ users: updated });
    setNotice('Hak akses pengguna diperbarui.');
  };

  const handleSaveUsers = async () => {
    await onSaveSettings({ users: localUsers });
    setNotice('Profil nama & jabatan akun pengguna berhasil disimpan.');
  };

  const handleConfirmResetClean = async () => {
    if (!onResetClean) return;
    setIsResetting(true);
    try {
      await onResetClean();
      setConfirmResetOpen(false);
      setNotice('Seluruh data ujian telah dibersihkan. Aplikasi siap diisi data madrasah resmi.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Pengaturan Sistem, KOP Asli, Kertas & Hak Akses</h2>
          <p className="text-xs text-slate-500">
            Kelola identitas madrasah, upload KOP resmi (JPG/PNG), ukuran kertas A4/F4, SK Panitia, serta Role Pengguna.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {[
          { id: 'madrasah_kop', label: 'Logo, KOP Surat & Identitas', icon: Building2 },
          { id: 'kertas', label: 'Kertas & Margin (A4/F4)', icon: FileSpreadsheet },
          { id: 'panitia', label: `Panitia Ujian (${committee.length})`, icon: Users },
          { id: 'akses', label: 'Pengguna, Peran & Audit Log', icon: Shield },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 font-bold rounded-lg border cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-emerald-700 border-emerald-700 text-white'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {tab.label}
            </button>
          );
        })}
      </div>

      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {notice}
        </div>
      )}

      {/* Tab 1: Logo Kemenag/Madrasah, Isian KOP & Identitas */}
      {activeTab === 'madrasah_kop' && (
        <form onSubmit={handleSaveMadrasahKop} className="space-y-6">
          {/* Card 1: Pengaturan KOP Surat, Logo Kemenag & Logo Madrasah */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-emerald-700" /> Pengaturan Logo Kemenag, Logo Madrasah &amp; Isian KOP
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Atur tampilan logo kiri (Kemenag), logo kanan (Madrasah), teks isian KOP surat, atau unggah gambar KOP utuh.
                </p>
              </div>
              {canEdit && (
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer whitespace-nowrap"
                >
                  <Save className="w-3.5 h-3.5" /> Simpan KOP &amp; Identitas
                </button>
              )}
            </div>

            {/* Mode KOP Switch */}
            <div className="flex flex-wrap items-center gap-4 p-3 rounded-lg bg-slate-50 border border-slate-200">
              <label className="inline-flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
                <input
                  type="radio"
                  name="kopMode"
                  disabled={!canEdit}
                  checked={!localProfile.useOriginalKopImage}
                  onChange={() => setLocalProfile({ ...localProfile, useOriginalKopImage: false })}
                />
                KOP Standar SAUM (Logo Kemenag + Isian Teks KOP + Logo Madrasah)
              </label>

              <label className="inline-flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
                <input
                  type="radio"
                  name="kopMode"
                  disabled={!canEdit}
                  checked={Boolean(localProfile.useOriginalKopImage)}
                  onChange={() => setLocalProfile({ ...localProfile, useOriginalKopImage: true })}
                />
                Gunakan Gambar KOP Utuh (JPG/PNG Scan Resmi)
              </label>
            </div>

            {/* Panel KOP Standar: Logo Kemenag, Logo Madrasah & Isian Baris KOP */}
            {!localProfile.useOriginalKopImage ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Logo Kemenag */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">Logo Kemenag (Kiri)</span>
                      <label className="inline-flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          disabled={!canEdit}
                          checked={localProfile.showLogoKemenag ?? true}
                          onChange={(e) =>
                            setLocalProfile({ ...localProfile, showLogoKemenag: e.target.checked })
                          }
                        />
                        Tampilkan
                      </label>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-lg border border-slate-200 bg-white flex items-center justify-center overflow-hidden shrink-0">
                        {localProfile.logoKemenagUrl ? (
                          <img
                            src={localProfile.logoKemenagUrl}
                            alt="Logo Kemenag"
                            className="w-12 h-12 object-contain"
                          />
                        ) : (
                          <span className="text-[10px] font-semibold text-emerald-800 text-center px-1">
                            Default Kemenag
                          </span>
                        )}
                      </div>
                      {canEdit && (
                        <div className="flex flex-col gap-1.5">
                          <input
                            ref={logoKemenagRef}
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleUploadImage(e, 'logoKemenagUrl')}
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => logoKemenagRef.current?.click()}
                            className="px-3 py-1.5 font-semibold bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 rounded-lg cursor-pointer"
                          >
                            Upload Logo Kemenag
                          </button>
                          {localProfile.logoKemenagUrl && (
                            <button
                              type="button"
                              onClick={() => setLocalProfile({ ...localProfile, logoKemenagUrl: undefined })}
                              className="px-3 py-1 font-semibold bg-red-50 text-red-700 border border-red-200 rounded-lg cursor-pointer"
                            >
                              Hapus / Pakai Default
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Logo Madrasah */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">Logo Madrasah (Kanan)</span>
                      <label className="inline-flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          disabled={!canEdit}
                          checked={localProfile.showLogoMadrasah ?? true}
                          onChange={(e) =>
                            setLocalProfile({ ...localProfile, showLogoMadrasah: e.target.checked })
                          }
                        />
                        Tampilkan
                      </label>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-lg border border-slate-200 bg-white flex items-center justify-center overflow-hidden shrink-0">
                        {localProfile.logoMadrasahUrl ? (
                          <img
                            src={localProfile.logoMadrasahUrl}
                            alt="Logo Madrasah"
                            className="w-12 h-12 object-contain"
                          />
                        ) : (
                          <span className="text-[10px] font-semibold text-emerald-800 text-center px-1">
                            Badge {localProfile.jenjang || 'MA'}
                          </span>
                        )}
                      </div>
                      {canEdit && (
                        <div className="flex flex-col gap-1.5">
                          <input
                            ref={logoMadrasahRef}
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleUploadImage(e, 'logoMadrasahUrl')}
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => logoMadrasahRef.current?.click()}
                            className="px-3 py-1.5 font-semibold bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 rounded-lg cursor-pointer"
                          >
                            Upload Logo Madrasah
                          </button>
                          {localProfile.logoMadrasahUrl && (
                            <button
                              type="button"
                              onClick={() => setLocalProfile({ ...localProfile, logoMadrasahUrl: undefined })}
                              className="px-3 py-1 font-semibold bg-red-50 text-red-700 border border-red-200 rounded-lg cursor-pointer"
                            >
                              Hapus / Pakai Default
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Ukuran Logo */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                    <label className="block font-bold text-slate-900">
                      Ukuran Logo KOP ({localProfile.kopLogoSizePx ?? 64} px)
                    </label>
                    <input
                      type="range"
                      min={36}
                      max={96}
                      step={2}
                      disabled={!canEdit}
                      value={localProfile.kopLogoSizePx ?? 64}
                      onChange={(e) =>
                        setLocalProfile({ ...localProfile, kopLogoSizePx: Number(e.target.value) })
                      }
                      className="w-full accent-emerald-700"
                    />
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Kecil (36px)</span>
                      <span>Standar (64px)</span>
                      <span>Besar (96px)</span>
                    </div>
                  </div>
                </div>

                {/* Editable KOP Text Lines */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Isian KOP Baris 1 (Instansi Atas)
                    </label>
                    <input
                      disabled={!canEdit}
                      value={
                        localProfile.kopBaris1 !== undefined
                          ? localProfile.kopBaris1
                          : 'KEMENTERIAN AGAMA REPUBLIK INDONESIA'
                      }
                      onChange={(e) => setLocalProfile({ ...localProfile, kopBaris1: e.target.value })}
                      placeholder="KEMENTERIAN AGAMA REPUBLIK INDONESIA"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Isian KOP Baris 2 (Kankemenag / Yayasan)
                    </label>
                    <input
                      disabled={!canEdit}
                      value={localProfile.kopBaris2 ?? ''}
                      onChange={(e) => setLocalProfile({ ...localProfile, kopBaris2: e.target.value })}
                      placeholder={
                        localProfile.kabupatenKota
                          ? `KANTOR KEMENTERIAN AGAMA ${localProfile.kabupatenKota.toUpperCase()}`
                          : 'KANTOR KEMENTERIAN AGAMA KABUPATEN ...'
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Isian KOP Baris 3 (Sub-Instansi / Opsional)
                    </label>
                    <input
                      disabled={!canEdit}
                      value={localProfile.kopBaris3 ?? ''}
                      onChange={(e) => setLocalProfile({ ...localProfile, kopBaris3: e.target.value })}
                      placeholder="Contoh: PANITIA PELAKSANA ASESMEN MADRASAH"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* Original Uploaded KOP Image Panel */
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  {canEdit && (
                    <>
                      <input
                        ref={kopFileRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) => handleUploadImage(e, 'kopImageUrl')}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => kopFileRef.current?.click()}
                        className="px-3.5 py-2 font-semibold bg-slate-800 text-white rounded-lg cursor-pointer"
                      >
                        Upload Gambar KOP (JPG/PNG)
                      </button>
                      {localProfile.kopImageUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            setLocalProfile({
                              ...localProfile,
                              kopImageUrl: undefined,
                              useOriginalKopImage: false,
                            })
                          }
                          className="px-3 py-2 font-semibold bg-red-50 text-red-700 border border-red-200 rounded-lg cursor-pointer"
                        >
                          Hapus Gambar KOP
                        </button>
                      )}
                    </>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Lebar Gambar KOP (%)</label>
                    <input
                      type="number"
                      min={40}
                      max={100}
                      disabled={!canEdit}
                      value={localProfile.kopWidthPercent ?? 100}
                      onChange={(e) =>
                        setLocalProfile({ ...localProfile, kopWidthPercent: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Posisi</label>
                    <select
                      disabled={!canEdit}
                      value={localProfile.kopPosition || 'center'}
                      onChange={(e) =>
                        setLocalProfile({
                          ...localProfile,
                          kopPosition: e.target.value as MadrasahProfile['kopPosition'],
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="left">Rata Kiri</option>
                      <option value="center">Tengah</option>
                      <option value="right">Rata Kanan</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Jarak Atas (mm)</label>
                    <input
                      type="number"
                      min={0}
                      max={25}
                      disabled={!canEdit}
                      value={localProfile.kopMarginTopMm ?? 0}
                      onChange={(e) =>
                        setLocalProfile({ ...localProfile, kopMarginTopMm: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Jarak Bawah (mm)</label>
                    <input
                      type="number"
                      min={0}
                      max={25}
                      disabled={!canEdit}
                      value={localProfile.kopMarginBottomMm ?? 4}
                      onChange={(e) =>
                        setLocalProfile({ ...localProfile, kopMarginBottomMm: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg tabular-nums"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="p-4 border border-dashed border-slate-300 rounded-lg bg-slate-50">
              <p className="text-[11px] text-slate-500 mb-2 font-semibold">
                Pratinjau KOP Aktif pada Seluruh Dokumen Cetak SAUM:
              </p>
              <div className="bg-white p-4 border border-slate-200">
                <KopSurat profile={localProfile} />
              </div>
            </div>
          </div>

          {/* Card 2: Identitas Madrasah & Kontak KOP */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="md:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Nama Madrasah (Tampil Tebal di KOP)</label>
              <input
                disabled={!canEdit}
                value={localProfile.namaMadrasah}
                onChange={(e) => setLocalProfile({ ...localProfile, namaMadrasah: e.target.value })}
                placeholder="Contoh: MADRASAH ALIYAH UNGGULAN ..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Jenjang</label>
              <select
                disabled={!canEdit}
                value={localProfile.jenjang}
                onChange={(e) =>
                  setLocalProfile({ ...localProfile, jenjang: e.target.value as MadrasahProfile['jenjang'] })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
              >
                <option value="MI">MI</option>
                <option value="MTs">MTs</option>
                <option value="MA">MA</option>
                <option value="MAK">MAK</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">NSM</label>
              <input
                disabled={!canEdit}
                value={localProfile.nsm}
                onChange={(e) => setLocalProfile({ ...localProfile, nsm: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">NPSN</label>
              <input
                disabled={!canEdit}
                value={localProfile.npsn}
                onChange={(e) => setLocalProfile({ ...localProfile, npsn: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Kabupaten / Kota</label>
              <input
                disabled={!canEdit}
                value={localProfile.kabupatenKota}
                onChange={(e) => setLocalProfile({ ...localProfile, kabupatenKota: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Alamat Lengkap</label>
              <input
                disabled={!canEdit}
                value={localProfile.alamat}
                onChange={(e) => setLocalProfile({ ...localProfile, alamat: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Kode Pos</label>
              <input
                disabled={!canEdit}
                value={localProfile.kodePos}
                onChange={(e) => setLocalProfile({ ...localProfile, kodePos: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Desa / Kelurahan</label>
              <input
                disabled={!canEdit}
                value={localProfile.desaKelurahan}
                onChange={(e) => setLocalProfile({ ...localProfile, desaKelurahan: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Kecamatan</label>
              <input
                disabled={!canEdit}
                value={localProfile.kecamatan}
                onChange={(e) => setLocalProfile({ ...localProfile, kecamatan: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Provinsi</label>
              <input
                disabled={!canEdit}
                value={localProfile.provinsi}
                onChange={(e) => setLocalProfile({ ...localProfile, provinsi: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Telepon (KOP)</label>
              <input
                disabled={!canEdit}
                value={localProfile.telepon}
                onChange={(e) => setLocalProfile({ ...localProfile, telepon: e.target.value })}
                placeholder="(022) 1234567"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Email (KOP)</label>
              <input
                disabled={!canEdit}
                value={localProfile.email}
                onChange={(e) => setLocalProfile({ ...localProfile, email: e.target.value })}
                placeholder="info@madrasah.sch.id"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Website (KOP)</label>
              <input
                disabled={!canEdit}
                value={localProfile.website}
                onChange={(e) => setLocalProfile({ ...localProfile, website: e.target.value })}
                placeholder="https://madrasah.sch.id"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nama Kepala Madrasah</label>
              <input
                disabled={!canEdit}
                value={localProfile.namaKepala}
                onChange={(e) => setLocalProfile({ ...localProfile, namaKepala: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">NIP Kepala Madrasah</label>
              <input
                disabled={!canEdit}
                value={localProfile.nipKepala}
                onChange={(e) => setLocalProfile({ ...localProfile, nipKepala: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tempat Tanda Tangan</label>
              <input
                disabled={!canEdit}
                value={localProfile.tempatTandaTangan}
                onChange={(e) => setLocalProfile({ ...localProfile, tempatTandaTangan: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nama Ketua Panitia</label>
              <input
                disabled={!canEdit}
                value={localProfile.namaKetuaPanitia || ''}
                onChange={(e) => setLocalProfile({ ...localProfile, namaKetuaPanitia: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">NIP Ketua Panitia</label>
              <input
                disabled={!canEdit}
                value={localProfile.nipKetuaPanitia || ''}
                onChange={(e) => setLocalProfile({ ...localProfile, nipKetuaPanitia: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tanggal Surat / Dokumen</label>
              <input
                type="date"
                disabled={!canEdit}
                value={localProfile.tanggalSurat || ''}
                onChange={(e) => setLocalProfile({ ...localProfile, tanggalSurat: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
              />
            </div>
            {canEdit && (
              <div className="md:col-span-3 flex justify-end pt-2 border-t border-slate-100">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
                >
                  <Save className="w-4 h-4" /> Simpan Identitas, Logo &amp; KOP
                </button>
              </div>
            )}
          </div>
        </form>
      )}

      {/* Tab 2: Paper Presets */}
      {activeTab === 'kertas' && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Pengaturan Kertas, Orientasi, Margin 4 Sisi &amp; Skala Cetak</h3>
              <p className="text-xs text-slate-500">
                Standar ukuran A4 (210×297 mm) dan F4 (215×330 mm). Margin Atas, Kanan, Bawah, dan Kiri dapat disesuaikan per dokumen agar penuh kertas tanpa terpotong.
              </p>
            </div>
            {canEdit && (
              <button
                onClick={handleSavePresets}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" /> Simpan Preset Kertas
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <th className="px-3 py-2.5">Jenis Dokumen</th>
                  <th className="px-2.5 py-2.5">Ukuran Kertas</th>
                  <th className="px-2.5 py-2.5">Orientasi</th>
                  <th className="px-2 py-2.5 text-center">Atas</th>
                  <th className="px-2 py-2.5 text-center">Kanan</th>
                  <th className="px-2 py-2.5 text-center">Bawah</th>
                  <th className="px-2 py-2.5 text-center">Kiri</th>
                  <th className="px-2 py-2.5 text-center">Skala (%)</th>
                  <th className="px-2.5 py-2.5 text-center">Kartu/Hal</th>
                  <th className="px-2.5 py-2.5 text-center">KOP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {localPresets.map((pr, idx) => {
                  const isCardPreset = pr.id === 'kartu_peserta' || pr.id === 'nomor_meja';
                  return (
                    <tr key={pr.id}>
                      <td className="px-3 py-2.5 font-bold text-slate-900">{pr.label}</td>
                      <td className="px-2.5 py-2">
                        <select
                          disabled={!canEdit}
                          value={pr.size}
                          onChange={(e) => {
                            const next = [...localPresets];
                            next[idx] = { ...pr, size: e.target.value as PaperSize };
                            setLocalPresets(next);
                          }}
                          className="px-2 py-1.5 border border-slate-300 rounded bg-white"
                        >
                          <option value="A4">A4 (210×297)</option>
                          <option value="F4">F4 (215×330)</option>
                        </select>
                      </td>
                      <td className="px-2.5 py-2">
                        <select
                          disabled={!canEdit}
                          value={pr.orientation}
                          onChange={(e) => {
                            const next = [...localPresets];
                            next[idx] = { ...pr, orientation: e.target.value as PaperOrientation };
                            setLocalPresets(next);
                          }}
                          className="px-2 py-1.5 border border-slate-300 rounded bg-white"
                        >
                          <option value="portrait">Portrait</option>
                          <option value="landscape">Landscape</option>
                        </select>
                      </td>
                      {(
                        [
                          'marginTopMm',
                          'marginRightMm',
                          'marginBottomMm',
                          'marginLeftMm',
                        ] as const
                      ).map((field) => (
                        <td key={field} className="px-1.5 py-2 text-center">
                          <input
                            type="number"
                            min={0}
                            max={40}
                            disabled={!canEdit}
                            value={pr[field]}
                            onChange={(e) => {
                              const next = [...localPresets];
                              next[idx] = {
                                ...pr,
                                [field]: Math.max(0, Math.min(40, Number(e.target.value || 0))),
                              };
                              setLocalPresets(next);
                            }}
                            className="w-14 px-1.5 py-1.5 border border-slate-300 rounded font-mono text-center tabular-nums"
                          />
                        </td>
                      ))}
                      <td className="px-1.5 py-2 text-center">
                        <input
                          type="number"
                          min={60}
                          max={120}
                          step={5}
                          disabled={!canEdit}
                          value={pr.scalePercent ?? 100}
                          onChange={(e) => {
                            const next = [...localPresets];
                            next[idx] = {
                              ...pr,
                              scalePercent: Math.max(60, Math.min(120, Number(e.target.value || 100))),
                            };
                            setLocalPresets(next);
                          }}
                          className="w-16 px-1.5 py-1.5 border border-slate-300 rounded font-mono text-center tabular-nums"
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        {isCardPreset ? (
                          <select
                            disabled={!canEdit}
                            value={pr.cardsPerPage || 6}
                            onChange={(e) => {
                              const next = [...localPresets];
                              next[idx] = {
                                ...pr,
                                cardsPerPage: Number(e.target.value) === 4 ? 4 : 6,
                              };
                              setLocalPresets(next);
                            }}
                            className="px-2 py-1.5 border border-slate-300 rounded bg-white font-semibold"
                          >
                            <option value={6}>6 / F4</option>
                            <option value={4}>4 / Hal</option>
                          </select>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-2.5 py-2 text-center">
                        <input
                          type="checkbox"
                          disabled={!canEdit}
                          checked={pr.showKop}
                          onChange={(e) => {
                            const next = [...localPresets];
                            next[idx] = { ...pr, showKop: e.target.checked };
                            setLocalPresets(next);
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Panitia Ujian */}
      {activeTab === 'panitia' && (
        <div className="space-y-5">
          <div className="bg-white p-5 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Susunan Panitia Pelaksana Ujian</h3>
              <p className="text-xs text-slate-500">Terhubung otomatis ke dokumen SK Panitia.</p>
            </div>
            <button
              onClick={onNavigateToPrintSk}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" /> Cetak SK Panitia
            </button>
          </div>

          {canEdit && (
            <form onSubmit={handleAddCommittee} className="bg-white p-5 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-5 gap-3 text-xs items-end">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Anggota *</label>
                <input
                  required
                  value={newMember.nama}
                  onChange={(e) => setNewMember({ ...newMember, nama: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">NIP</label>
                <input
                  value={newMember.nip}
                  onChange={(e) => setNewMember({ ...newMember, nip: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Jabatan Kepanitiaan *</label>
                <input
                  required
                  value={newMember.jabatan}
                  onChange={(e) => setNewMember({ ...newMember, jabatan: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tugas</label>
                <input
                  value={newMember.tugas}
                  onChange={(e) => setNewMember({ ...newMember, tugas: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Panitia
              </button>
            </form>
          )}

          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <th className="px-3 py-3 w-10 text-center">No</th>
                  <th className="px-3 py-3">Nama / NIP</th>
                  <th className="px-3 py-3">Jabatan</th>
                  <th className="px-3 py-3">Tugas</th>
                  {canEdit && <th className="px-3 py-3 text-right">Hapus</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {committee.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      Belum ada anggota panitia ujian tercatat. Tambahkan susunan panitia melalui formulir di atas.
                    </td>
                  </tr>
                ) : (
                  committee.map((c, idx) => (
                    <tr key={c.id}>
                      <td className="px-3 py-2.5 text-center tabular-nums">{idx + 1}</td>
                      <td className="px-3 py-2.5">
                        <div className="font-bold text-slate-900">{c.nama}</div>
                        <div className="text-[11px] font-mono text-slate-500">{c.nip || '-'}</div>
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-emerald-800">{c.jabatan}</td>
                      <td className="px-3 py-2.5 text-slate-600">{c.tugas}</td>
                      {canEdit && (
                        <td className="px-3 py-2.5 text-right">
                          <button
                            onClick={() => handleDeleteCommittee(c.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Users, Role Switcher, Reset & Audit Logs */}
      {activeTab === 'akses' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Akun Pengguna &amp; Pengujian Hak Akses (RBAC Backend)</h3>
                <p className="text-xs text-slate-500">
                  Kelola nama/jabatan pejabat akun dan uji pembatasan menu serta otorisasi API di server secara nyata.
                </p>
              </div>
              {canManageUsers && (
                <button
                  type="button"
                  onClick={handleSaveUsers}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" /> Simpan Profil Akun
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <th className="px-3 py-2.5">Username</th>
                    <th className="px-3 py-2.5">Nama Lengkap</th>
                    <th className="px-3 py-2.5">Jabatan</th>
                    <th className="px-3 py-2.5">Peran (Role)</th>
                    <th className="px-3 py-2.5 text-right">Ganti Sesi Aktif</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {localUsers.map((u, idx) => {
                    const isCurrent = u.id === currentUser.id;
                    return (
                      <tr key={u.id} className={isCurrent ? 'bg-emerald-50/50' : ''}>
                        <td className="px-3 py-2.5 font-mono font-bold">{u.username}</td>
                        <td className="px-3 py-2 font-semibold text-slate-900">
                          {canManageUsers ? (
                            <input
                              value={u.nama}
                              onChange={(e) => {
                                const next = [...localUsers];
                                next[idx] = { ...u, nama: e.target.value };
                                setLocalUsers(next);
                              }}
                              className="w-full min-w-[180px] px-2.5 py-1.5 border border-slate-300 rounded bg-white font-semibold"
                            />
                          ) : (
                            u.nama
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {canManageUsers ? (
                            <input
                              value={u.jabatan}
                              onChange={(e) => {
                                const next = [...localUsers];
                                next[idx] = { ...u, jabatan: e.target.value };
                                setLocalUsers(next);
                              }}
                              className="w-full min-w-[160px] px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                            />
                          ) : (
                            u.jabatan
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <select
                            disabled={!canManageUsers}
                            value={u.role}
                            onChange={(e) => handleUpdateUserRole(u.id, e.target.value as UserRole)}
                            className="px-2.5 py-1.5 border border-slate-300 rounded bg-white font-semibold"
                          >
                            <option value="Super Admin">Super Admin</option>
                            <option value="Admin Ujian">Admin Ujian</option>
                            <option value="Panitia">Panitia</option>
                            <option value="Petugas HP">Petugas HP</option>
                            <option value="Pengawas">Pengawas</option>
                          </select>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {isCurrent ? (
                            <span className="text-emerald-700 font-bold">Sedang Aktif</span>
                          ) : (
                            <button
                              onClick={() => onSwitchUser(u.username)}
                              className="px-3 py-1.5 text-xs font-semibold bg-slate-800 text-white rounded-lg hover:bg-slate-900 cursor-pointer whitespace-nowrap"
                            >
                              Masuk sebagai {u.role}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {canManageUsers && onResetClean && (
            <div className="bg-white p-5 rounded-xl border border-red-200 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-red-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  Reset Data Ujian Bersih (Mulai Ujian Baru)
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Menghapus seluruh peserta, ruang, jadwal, pengawas, segel, catatan HP, dan arsip sementara sambil mempertahankan pengaturan Super Admin.
                </p>
              </div>
              {!confirmResetOpen ? (
                <button
                  type="button"
                  onClick={() => setConfirmResetOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-red-700 bg-red-50 border border-red-300 hover:bg-red-100 rounded-lg cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reset Data Bersih
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isResetting}
                    onClick={() => setConfirmResetOpen(false)}
                    className="px-3 py-2 text-xs font-semibold bg-slate-100 text-slate-700 rounded-lg cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={isResetting}
                    onClick={handleConfirmResetClean}
                    className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer disabled:opacity-50"
                  >
                    {isResetting ? 'Membersihkan...' : 'Ya, Bersihkan Semua Data'}
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Audit Log Perubahan Data Sistem</h3>
            <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-lg">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <th className="px-3 py-2">Waktu</th>
                    <th className="px-3 py-2">Pelaku</th>
                    <th className="px-3 py-2">Peran</th>
                    <th className="px-3 py-2">Aksi</th>
                    <th className="px-3 py-2">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                        Belum ada aktivitas perubahan data yang tercatat.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="px-3 py-2 font-mono text-slate-500">
                          {new Date(log.timestamp).toLocaleString('id-ID')}
                        </td>
                        <td className="px-3 py-2 font-semibold">{log.actor}</td>
                        <td className="px-3 py-2 font-mono text-slate-600">{log.role}</td>
                        <td className="px-3 py-2 font-mono font-bold text-emerald-800">{log.action}</td>
                        <td className="px-3 py-2 text-slate-700">{log.detail}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
