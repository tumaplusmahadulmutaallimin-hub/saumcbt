import React, { useEffect, useState } from 'react';
import { Save, Plus, X, MonitorSmartphone, FileText, CheckCircle2, Image as ImageIcon } from 'lucide-react';
import { ExamConfig, MadrasahProfile, ModaUjian } from '../../types';

interface PengaturanUjianViewProps {
  examConfig: ExamConfig;
  profile: MadrasahProfile;
  canEdit: boolean;
  onSaveConfig: (next: ExamConfig, nextProfile?: MadrasahProfile) => Promise<void>;
  onOpenKopSettings?: () => void;
}

export const PengaturanUjianView: React.FC<PengaturanUjianViewProps> = ({
  examConfig,
  profile,
  canEdit,
  onSaveConfig,
  onOpenKopSettings,
}) => {
  const [form, setForm] = useState<ExamConfig>(examConfig);
  const [ketuaNama, setKetuaNama] = useState(profile.namaKetuaPanitia || '');
  const [ketuaNip, setKetuaNip] = useState(profile.nipKetuaPanitia || '');
  const [kepalaNama, setKepalaNama] = useState(profile.namaKepala || '');
  const [kepalaNip, setKepalaNip] = useState(profile.nipKepala || '');
  const [newClassInput, setNewClassInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState('');

  useEffect(() => {
    setForm(examConfig);
  }, [examConfig]);

  useEffect(() => {
    setKetuaNama(profile.namaKetuaPanitia || '');
    setKetuaNip(profile.nipKetuaPanitia || '');
    setKepalaNama(profile.namaKepala || '');
    setKepalaNip(profile.nipKepala || '');
  }, [profile]);

  const handleAddClass = () => {
    const clean = newClassInput.trim().toUpperCase();
    if (!clean) return;
    if (!form.registeredClasses.includes(clean)) {
      setForm((prev) => ({
        ...prev,
        registeredClasses: [...prev.registeredClasses, clean],
      }));
    }
    setNewClassInput('');
  };

  const handleRemoveClass = (cls: string) => {
    setForm((prev) => ({
      ...prev,
      registeredClasses: prev.registeredClasses.filter((c) => c !== cls),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    setSavedNotice('');
    try {
      const updatedProfile: MadrasahProfile = {
        ...profile,
        jenisUjian: form.namaUjian,
        tahunPelajaran: form.tahunPelajaran,
        namaKetuaPanitia: ketuaNama,
        nipKetuaPanitia: ketuaNip,
        namaKepala: kepalaNama,
        nipKepala: kepalaNip,
      };
      await onSaveConfig(form, updatedProfile);
      setSavedNotice('Pengaturan ujian berhasil disimpan dan tersinkron ke seluruh modul.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-900">Pengaturan Pelaksanaan Ujian</h2>
            <p className="text-xs text-slate-500">
              Pusat konfigurasi nama ujian, moda pelaksanaan (Online / Kertas), jumlah ruang, sesi, dan daftar kelas terdaftar.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onOpenKopSettings && (
              <button
                type="button"
                onClick={onOpenKopSettings}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-900 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 rounded-lg cursor-pointer whitespace-nowrap"
              >
                <ImageIcon className="w-3.5 h-3.5 text-emerald-700" />
                Atur Logo &amp; KOP Surat
              </button>
            )}
            {savedNotice && (
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                <CheckCircle2 className="w-4 h-4" />
                {savedNotice}
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-6">
          {/* Moda Ujian Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Moda Pelaksanaan Ujian
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(
                [
                  {
                    id: 'online',
                    title: 'Moda Ujian Online (CBT / HP Santri)',
                    desc: 'Mengaktifkan pembagian Sesi Ujian acak merata dan menu khusus Administrasi HP Santri.',
                    icon: MonitorSmartphone,
                  },
                  {
                    id: 'kertas',
                    title: 'Moda Ujian Kertas (PBT / LJK)',
                    desc: 'Mengaktifkan dokumen Segel Naskah Soal & LJK serta menonaktifkan sesi/administrasi HP.',
                    icon: FileText,
                  },
                ] as Array<{ id: ModaUjian; title: string; desc: string; icon: typeof FileText }>
              ).map((opt) => {
                const Icon = opt.icon;
                const active = form.moda === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={!canEdit}
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        moda: opt.id,
                        jumlahSesi: opt.id === 'online' ? Math.max(2, prev.jumlahSesi || 2) : 1,
                      }))
                    }
                    className={`p-4 rounded-xl border text-left transition-colors flex items-start gap-3 cursor-pointer ${
                      active
                        ? 'border-emerald-700 bg-emerald-50/70'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${active ? 'text-emerald-700' : 'text-slate-400'}`} />
                    <div>
                      <p className="text-xs font-bold text-slate-900">{opt.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Kegiatan Ujian</label>
              <input
                type="text"
                disabled={!canEdit}
                value={form.namaUjian}
                onChange={(e) => setForm({ ...form, namaUjian: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:border-emerald-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tahun Pelajaran</label>
              <input
                type="text"
                disabled={!canEdit}
                value={form.tahunPelajaran}
                onChange={(e) => setForm({ ...form, tahunPelajaran: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:border-emerald-700"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal Mulai</label>
              <input
                type="date"
                disabled={!canEdit}
                value={form.tanggalMulai}
                onChange={(e) => setForm({ ...form, tanggalMulai: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal Selesai</label>
              <input
                type="date"
                disabled={!canEdit}
                value={form.tanggalSelesai}
                onChange={(e) => setForm({ ...form, tanggalSelesai: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Jam Pelaksanaan</label>
              <input
                type="text"
                disabled={!canEdit}
                value={form.jamPelaksanaan}
                onChange={(e) => setForm({ ...form, jamPelaksanaan: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Jumlah Hari Ujian</label>
              <input
                type="number"
                min={0}
                disabled={!canEdit}
                value={form.jumlahHari}
                onChange={(e) => setForm({ ...form, jumlahHari: Math.max(0, Number(e.target.value) || 0) })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Jumlah Ruang Ujian</label>
              <input
                type="number"
                min={0}
                disabled={!canEdit}
                value={form.jumlahRuang}
                onChange={(e) => setForm({ ...form, jumlahRuang: Math.max(0, Number(e.target.value) || 0) })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg tabular-nums"
              />
            </div>

            {form.moda === 'online' ? (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Jumlah Sesi (Moda Online)</label>
                <input
                  type="number"
                  min={1}
                  max={6}
                  disabled={!canEdit}
                  value={form.jumlahSesi}
                  onChange={(e) => setForm({ ...form, jumlahSesi: Math.max(1, Number(e.target.value) || 1) })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg tabular-nums"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Label Jenjang</label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={form.jenjangLabel}
                  onChange={(e) => setForm({ ...form, jenjangLabel: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
            )}
          </div>

          {/* Registered Classes List (used for DNPU validation) */}
          <div className="pt-4 border-t border-slate-200">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Daftar Kelas Terdaftar (Validasi Impor DNPU & Urutan Daftar Hadir)
            </label>
            <p className="text-xs text-slate-500 mb-2">
              Kelas di luar daftar ini akan ditandai peringatan saat impor Excel DNPU.
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              {form.registeredClasses.map((cls) => (
                <span
                  key={cls}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-300 bg-slate-50 text-xs font-semibold text-slate-800"
                >
                  {cls}
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => handleRemoveClass(cls)}
                      className="text-slate-400 hover:text-red-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </span>
              ))}
            </div>
            {canEdit && (
              <div className="flex gap-2 max-w-xs">
                <input
                  type="text"
                  placeholder="Tambah kelas, misal XI-B"
                  value={newClassInput}
                  onChange={(e) => setNewClassInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddClass())}
                  className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                />
                <button
                  type="button"
                  onClick={handleAddClass}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-slate-800 text-white rounded-lg hover:bg-slate-900 cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah
                </button>
              </div>
            )}
          </div>

          {/* Penandatangan Resmi */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Kepala Madrasah</label>
              <input
                type="text"
                disabled={!canEdit}
                value={kepalaNama}
                onChange={(e) => setKepalaNama(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">NIP Kepala Madrasah</label>
              <input
                type="text"
                disabled={!canEdit}
                value={kepalaNip}
                onChange={(e) => setKepalaNip(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Ketua Panitia</label>
              <input
                type="text"
                disabled={!canEdit}
                value={ketuaNama}
                onChange={(e) => setKetuaNama(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">NIP Ketua Panitia</label>
              <input
                type="text"
                disabled={!canEdit}
                value={ketuaNip}
                onChange={(e) => setKetuaNip(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
              />
            </div>
          </div>

          {canEdit && (
            <div className="flex justify-end pt-3 border-t border-slate-200">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Menyimpan...' : 'Simpan Pengaturan Ujian'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
