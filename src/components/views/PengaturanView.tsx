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
  onSaveSettings: (payload: {
    profile?: MadrasahProfile;
    paperPresets?: PaperPreset[];
    committee?: CommitteeMember[];
    users?: UserAccount[];
  }) => Promise<void>;
  onSwitchUser: (username: string) => Promise<void>;
  onNavigateToPrintSk: () => void;
}

export const PengaturanView: React.FC<PengaturanViewProps> = ({
  profile,
  paperPresets,
  committee,
  users,
  auditLogs,
  currentUser,
  canEdit,
  onSaveSettings,
  onSwitchUser,
  onNavigateToPrintSk,
}) => {
  const [activeTab, setActiveTab] = useState<'madrasah_kop' | 'kertas' | 'panitia' | 'akses'>('madrasah_kop');
  const [localProfile, setLocalProfile] = useState<MadrasahProfile>(profile);
  const [localPresets, setLocalPresets] = useState<PaperPreset[]>(paperPresets);
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

  useEffect(() => {
    setLocalProfile(profile);
  }, [profile]);

  useEffect(() => {
    setLocalPresets(paperPresets);
  }, [paperPresets]);

  const canManageUsers = canRoleEdit(currentUser.role, 'users_roles');

  const handleUploadImage = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'kopImageUrl' | 'logoMadrasahUrl'
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
        }));
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSaveMadrasahKop = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveSettings({ profile: localProfile });
    setNotice('Identitas madrasah dan KOP surat berhasil disimpan.');
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
    const updated = users.map((u) => (u.id === userId ? { ...u, role } : u));
    await onSaveSettings({ users: updated });
    setNotice('Hak akses pengguna diperbarui.');
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
          { id: 'madrasah_kop', label: 'Identitas & KOP Asli', icon: Building2 },
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

      {/* Tab 1: Madrasah & Original KOP Upload */}
      {activeTab === 'madrasah_kop' && (
        <form onSubmit={handleSaveMadrasahKop} className="space-y-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-emerald-700" /> Upload & Pengaturan KOP Surat Asli (JPG/PNG)
            </h3>
            <div className="flex flex-wrap items-center gap-4">
              <label className="inline-flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!canEdit}
                  checked={Boolean(localProfile.useOriginalKopImage)}
                  onChange={(e) =>
                    setLocalProfile({ ...localProfile, useOriginalKopImage: e.target.checked })
                  }
                />
                Gunakan Gambar KOP Asli Madrasah (tanpa crop / overlay teks)
              </label>

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
                    className="px-3 py-1.5 font-semibold bg-slate-800 text-white rounded-lg cursor-pointer"
                  >
                    Upload Gambar KOP (JPG/PNG)
                  </button>
                  {localProfile.kopImageUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        setLocalProfile({ ...localProfile, kopImageUrl: undefined, useOriginalKopImage: false })
                      }
                      className="px-3 py-1.5 font-semibold bg-red-50 text-red-700 border border-red-200 rounded-lg cursor-pointer"
                    >
                      Hapus Gambar KOP
                    </button>
                  )}
                </>
              )}
            </div>

            {localProfile.useOriginalKopImage && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
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
            )}

            <div className="p-4 border border-dashed border-slate-300 rounded-lg bg-slate-50">
              <p className="text-[11px] text-slate-500 mb-2 font-semibold">Pratinjau KOP Aktif pada Dokumen Cetak:</p>
              <div className="bg-white p-3 border border-slate-200">
                <KopSurat profile={localProfile} />
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="md:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Nama Madrasah</label>
              <input
                disabled={!canEdit}
                value={localProfile.namaMadrasah}
                onChange={(e) => setLocalProfile({ ...localProfile, namaMadrasah: e.target.value })}
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
              <label className="block font-semibold text-slate-700 mb-1">Logo Madrasah (Kartu & KOP Standar)</label>
              {canEdit && (
                <>
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
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 font-semibold cursor-pointer"
                  >
                    Upload Logo Madrasah
                  </button>
                </>
              )}
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
                  <Save className="w-4 h-4" /> Simpan Identitas & KOP
                </button>
              </div>
            )}
          </div>
        </form>
      )}

      {/* Tab 2: Paper Presets */}
      {activeTab === 'kertas' && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Pengaturan Kertas & Margin per Jenis Dokumen</h3>
              <p className="text-xs text-slate-500">Standar ukuran A4 (210x297 mm) dan F4 (215x330 mm).</p>
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
                  <th className="px-3 py-2.5">Ukuran Kertas</th>
                  <th className="px-3 py-2.5">Orientasi</th>
                  <th className="px-3 py-2.5">Margin (mm)</th>
                  <th className="px-3 py-2.5 text-center">Tampilkan KOP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {localPresets.map((pr, idx) => (
                  <tr key={pr.id}>
                    <td className="px-3 py-2.5 font-bold text-slate-900">{pr.label}</td>
                    <td className="px-3 py-2">
                      <select
                        disabled={!canEdit}
                        value={pr.size}
                        onChange={(e) => {
                          const next = [...localPresets];
                          next[idx] = { ...pr, size: e.target.value as PaperSize };
                          setLocalPresets(next);
                        }}
                        className="px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                      >
                        <option value="A4">A4 (210×297 mm)</option>
                        <option value="F4">F4 (215×330 mm)</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        disabled={!canEdit}
                        value={pr.orientation}
                        onChange={(e) => {
                          const next = [...localPresets];
                          next[idx] = { ...pr, orientation: e.target.value as PaperOrientation };
                          setLocalPresets(next);
                        }}
                        className="px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                      >
                        <option value="portrait">Portrait</option>
                        <option value="landscape">Landscape</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={5}
                        max={25}
                        disabled={!canEdit}
                        value={pr.marginTopMm}
                        onChange={(e) => {
                          const m = Number(e.target.value) || 10;
                          const next = [...localPresets];
                          next[idx] = {
                            ...pr,
                            marginTopMm: m,
                            marginBottomMm: m,
                            marginLeftMm: m,
                            marginRightMm: m,
                          };
                          setLocalPresets(next);
                        }}
                        className="w-20 px-2 py-1.5 border border-slate-300 rounded font-mono text-center"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
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
                ))}
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
                {committee.map((c, idx) => (
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
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Users, Role Switcher & Audit Logs */}
      {activeTab === 'akses' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Akun Pengguna & Pengujian Hak Akses (RBAC Backend)</h3>
              <p className="text-xs text-slate-500">
                Klik "Masuk sebagai Akun" untuk menguji pembatasan menu dan otorisasi API di server secara nyata.
              </p>
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
                  {users.map((u) => {
                    const isCurrent = u.id === currentUser.id;
                    return (
                      <tr key={u.id} className={isCurrent ? 'bg-emerald-50/50' : ''}>
                        <td className="px-3 py-2.5 font-mono font-bold">{u.username}</td>
                        <td className="px-3 py-2.5 font-semibold text-slate-900">{u.nama}</td>
                        <td className="px-3 py-2.5 text-slate-600">{u.jabatan}</td>
                        <td className="px-3 py-2.5">
                          <select
                            disabled={!canManageUsers}
                            value={u.role}
                            onChange={(e) => handleUpdateUserRole(u.id, e.target.value as UserRole)}
                            className="px-2.5 py-1 border border-slate-300 rounded bg-white font-semibold"
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
                              className="px-3 py-1.5 text-xs font-semibold bg-slate-800 text-white rounded-lg hover:bg-slate-900 cursor-pointer"
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
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="px-3 py-2 font-mono text-slate-500">
                        {new Date(log.timestamp).toLocaleString('id-ID')}
                      </td>
                      <td className="px-3 py-2 font-semibold">{log.actor}</td>
                      <td className="px-3 py-2 font-mono text-slate-600">{log.role}</td>
                      <td className="px-3 py-2 font-mono font-bold text-emerald-800">{log.action}</td>
                      <td className="px-3 py-2 text-slate-700">{log.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
