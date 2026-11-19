import React from 'react';
import {
  Users,
  DoorClosed,
  UserCheck,
  BookOpen,
  Calendar,
  Printer,
  Hash,
  Grid,
  MapPin,
  Smartphone,
  ArrowRight,
  Clock,
  PackageCheck,
  Armchair,
} from 'lucide-react';
import {
  AuditLogEntry,
  CommitteeMember,
  ExamConfig,
  ExamRoom,
  ExamSchedule,
  ExamSubject,
  MadrasahProfile,
  SantriPhoneRecord,
  Student,
  Supervisor,
} from '../../types';
import { formatDayAndDate } from '../../utils/qrBarcode';
import {
  PreparationCheckItem,
  StatistikPersiapanCard,
} from '../dashboard/StatistikPersiapanCard';

interface DashboardViewProps {
  profile: MadrasahProfile;
  examConfig: ExamConfig;
  students: Student[];
  rooms: ExamRoom[];
  schedules: ExamSchedule[];
  subjects: ExamSubject[];
  committee: CommitteeMember[];
  supervisors: Supervisor[];
  phoneRecords: SantriPhoneRecord[];
  auditLogs: AuditLogEntry[];
  onNavigate: (tab: string, docSubtype?: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  profile,
  examConfig,
  students,
  rooms,
  schedules,
  subjects,
  committee,
  supervisors,
  phoneRecords,
  auditLogs,
  onNavigate,
}) => {
  const activeStudents = students.filter((s) => s.status === 'Aktif');
  const maleCount = activeStudents.filter((s) => s.jenisKelamin === 'L').length;
  const femaleCount = activeStudents.filter((s) => s.jenisKelamin === 'P').length;
  const numberedCount = activeStudents.filter((s) => Boolean(s.nomorPeserta?.trim())).length;
  const credentialedCount = activeStudents.filter(
    (s) => Boolean(s.usernameUjian?.trim()) && Boolean(s.passwordUjian?.trim())
  ).length;
  const seatedCount = activeStudents.filter((s) => Boolean(s.ruangId) && Boolean(s.nomorMeja)).length;

  const jenjangCounts = activeStudents.reduce<Record<string, number>>((acc, s) => {
    const jen = s.jenjang || (s.kelas ? s.kelas.split(/[- ]/)[0] : 'Lainnya');
    acc[jen] = (acc[jen] || 0) + 1;
    return acc;
  }, {});

  const sortedSchedules = [...schedules].sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  const upcomingSchedule = sortedSchedules[0];
  const upcomingSubject = subjects.find((s) => s.id === upcomingSchedule?.mapelId);

  const checks: PreparationCheckItem[] = [
    {
      id: 'identitas',
      title: 'Identitas Madrasah & Pengaturan Ujian',
      detail: profile.namaMadrasah
        ? `${profile.namaMadrasah} — ${examConfig.namaUjian || 'Ujian Belum Dinamai'}`
        : 'Nama madrasah atau nama kegiatan ujian belum dilengkapi',
      isReady: Boolean(profile.namaMadrasah?.trim()) && Boolean(examConfig.namaUjian?.trim()),
      targetTab: 'pengaturan_ujian',
    },
    {
      id: 'dnpu',
      title: 'Data DNPU Peserta Lengkap',
      detail:
        activeStudents.length > 0
          ? `${activeStudents.length} peserta aktif terdaftar (${maleCount} L, ${femaleCount} P)`
          : 'Belum ada peserta aktif terdaftar di Data DNPU',
      isReady: activeStudents.length > 0,
      targetTab: 'dnpu',
    },
    {
      id: 'nomor_peserta',
      title: 'Penomoran Peserta Valid',
      detail:
        activeStudents.length > 0
          ? `${numberedCount} dari ${activeStudents.length} peserta memiliki nomor peserta`
          : 'Tambahkan peserta terlebih dahulu untuk membuat nomor peserta',
      isReady: numberedCount === activeStudents.length && activeStudents.length > 0,
      targetTab: 'penomoran',
    },
    {
      id: 'akun_ujian',
      title: 'User & Password Login Ruang Ujian',
      detail:
        activeStudents.length > 0
          ? `${credentialedCount} dari ${activeStudents.length} peserta memiliki akun login ujian`
          : 'Generate User & Password peserta melalui Data DNPU atau Nomor Peserta',
      isReady: credentialedCount === activeStudents.length && activeStudents.length > 0,
      targetTab: 'dnpu',
    },
    {
      id: 'ruang_meja',
      title: 'Pembagian Ruang & Tempat Duduk (Maks 22)',
      detail:
        rooms.length > 0
          ? `${rooms.length} ruang terbentuk — ${seatedCount}/${activeStudents.length} peserta ternomor meja`
          : 'Belum ada ruang ujian yang dibentuk',
      isReady: seatedCount === activeStudents.length && activeStudents.length > 0 && rooms.length > 0,
      targetTab: 'ruang_sesi',
    },
    {
      id: 'jadwal',
      title: 'Jadwal & Mata Pelajaran Tersusun',
      detail:
        subjects.length > 0 || schedules.length > 0
          ? `${subjects.length} mata pelajaran, ${schedules.length} slot jadwal ujian`
          : 'Belum ada mata pelajaran maupun jadwal ujian',
      isReady: schedules.length > 0 && subjects.length > 0,
      targetTab: 'jadwal',
    },
    {
      id: 'pengawas',
      title: 'Panitia & Pengawas Ditetapkan',
      detail: `${committee.length} panitia, ${supervisors.length} pengawas ruang`,
      isReady: committee.length > 0 && supervisors.length > 0,
      targetTab: 'pengawas',
    },
  ];
  const readyCount = checks.filter((c) => c.isReady).length;
  const readinessPercent = Math.round((readyCount / checks.length) * 100);

  return (
    <div className="space-y-6">
      {/* Header Summary Card */}
      <div className="bg-emerald-950 text-white rounded-xl p-6 border border-emerald-900">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-emerald-200 uppercase tracking-wider">
              <span>{profile.namaMadrasah || 'Identitas Madrasah Belum Diatur'}</span>
              <span>&bull;</span>
              <span>TP {examConfig.tahunPelajaran || '-'}</span>
              <span>&bull;</span>
              <span className="text-amber-300">
                {examConfig.moda === 'online'
                  ? `Moda Online (${examConfig.jumlahSesi} Sesi)`
                  : 'Moda Kertas (PBT)'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              {examConfig.namaUjian || profile.jenisUjian || 'Nama Kegiatan Ujian Belum Diatur'}
            </h1>
            <p className="text-xs text-emerald-100/80">
              {examConfig.jenjangLabel ? `Jenjang ${examConfig.jenjangLabel} \u2022 ` : ''}
              {examConfig.jumlahHari || 0} Hari Pelaksanaan
              {examConfig.jamPelaksanaan ? ` \u2022 Jam ${examConfig.jamPelaksanaan}` : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 bg-emerald-900/60 border border-emerald-800 rounded-lg px-4 py-3">
            <div>
              <p className="text-[11px] text-emerald-200">Kesiapan Administrasi</p>
              <p className="text-xl font-bold text-amber-300 tabular-nums font-mono">{readinessPercent}%</p>
            </div>
            <button
              onClick={() => onNavigate('cetak')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-amber-950 font-bold text-xs rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Pusat Cetak
            </button>
          </div>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Peserta Ujian (DNPU)</span>
            <Users className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="mt-2.5 text-2xl font-bold text-slate-900 tabular-nums font-mono">{activeStudents.length}</div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            {maleCount} L &bull; {femaleCount} P
            {Object.keys(jenjangCounts).length > 0
              ? ` — ${Object.entries(jenjangCounts)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(' | ')}`
              : ' — Belum ada peserta terdaftar'}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Ruang &amp; Sesi</span>
            <DoorClosed className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="mt-2.5 text-2xl font-bold text-slate-900 tabular-nums font-mono">
            {rooms.length} Ruang
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            {examConfig.moda === 'online'
              ? `${examConfig.jumlahSesi} Sesi Online \u2022 Kapasitas maks 22/ruang`
              : `Total ${rooms.reduce((a, r) => a + r.kapasitas, 0)} kursi`}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Mapel &amp; Hari Ujian</span>
            <BookOpen className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="mt-2.5 text-2xl font-bold text-slate-900 tabular-nums font-mono">
            {subjects.length} Mapel
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            {examConfig.jumlahHari} Hari &bull; {schedules.length} Jadwal Terdaftar
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>{examConfig.moda === 'online' ? 'Pengawas & HP Santri' : 'Panitia & Pengawas'}</span>
            {examConfig.moda === 'online' ? (
              <Smartphone className="w-4 h-4 text-emerald-700" />
            ) : (
              <UserCheck className="w-4 h-4 text-emerald-700" />
            )}
          </div>
          <div className="mt-2.5 text-2xl font-bold text-slate-900 tabular-nums font-mono">
            {supervisors.length} Pengawas
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            {examConfig.moda === 'online'
              ? `${phoneRecords.length} Unit HP Tercatat \u2022 ${committee.length} Panitia`
              : `${committee.length} Panitia Ujian Aktif`}
          </div>
        </div>
      </div>

      {/* Ringkasan Statistik & Status Kelengkapan Persiapan Ujian */}
      <StatistikPersiapanCard
        students={students}
        rooms={rooms}
        examConfig={examConfig}
        checks={checks}
        onNavigate={(tab) => onNavigate(tab)}
      />

      {/* Quick Shortcuts */}
      <div className="bg-white p-5 rounded-xl border border-slate-200">
        <h2 className="text-sm font-bold text-slate-900 mb-3">Akses Cepat Modul SAUM</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {[
            { tab: 'dnpu', label: 'Import / Data DNPU', icon: Users },
            { tab: 'penomoran', label: 'Nomor & Akun Ujian', icon: Hash },
            { tab: 'nomor_meja', label: 'Cetak Nomor Meja', icon: Armchair },
            { tab: 'ruang_sesi', label: 'Bagi Ruang & Sesi', icon: DoorClosed },
            { tab: 'denah_lokasi', label: 'Denah Lokasi', icon: MapPin },
            { tab: 'denah_ruang', label: 'Denah Tempat Duduk', icon: Grid },
            { tab: 'jadwal', label: 'Jadwal & Seragam', icon: Calendar },
            { tab: 'rekap', label: 'Rekap & Perlengkapan', icon: PackageCheck },
            {
              tab: examConfig.moda === 'online' ? 'admin_hp' : 'dokumen_ujian',
              label: examConfig.moda === 'online' ? 'Administrasi & Scan HP' : 'Segel & Berita Acara',
              icon: examConfig.moda === 'online' ? Smartphone : Printer,
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.tab}
                onClick={() => onNavigate(item.tab)}
                className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 hover:border-emerald-600 hover:bg-emerald-50/40 text-left transition-colors cursor-pointer"
              >
                <Icon className="w-4 h-4 text-emerald-700 shrink-0" />
                <span className="text-xs font-semibold text-slate-800">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Two Columns: Upcoming Schedule & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-700" />
                <h3 className="text-sm font-bold text-slate-900">Jadwal Ujian Terdekat</h3>
              </div>
              <button
                onClick={() => onNavigate('jadwal')}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1 cursor-pointer"
              >
                Kelola Jadwal <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {upcomingSchedule && upcomingSubject ? (
              <div className="mt-4 p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-600 tabular-nums">
                  <span className="font-semibold text-emerald-800">
                    Sesi {upcomingSchedule.sesi} ({upcomingSchedule.waktuMulai} &ndash; {upcomingSchedule.waktuSelesai} WIB)
                  </span>
                  <span>{upcomingSubject.durasiMenit} Menit</span>
                </div>
                <h4 className="text-base font-bold text-slate-900 uppercase">{upcomingSubject.nama}</h4>
                <p className="text-xs text-slate-600 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {formatDayAndDate(upcomingSchedule.tanggal)}
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-8 text-center">Belum ada jadwal ujian terjadwal.</p>
            )}
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <h3 className="text-sm font-bold text-slate-900">Aktivitas Sistem Terbaru</h3>
            <span className="text-xs font-semibold text-slate-500 font-mono tabular-nums">
              {auditLogs.length} Catatan
            </span>
          </div>
          <div className="space-y-1.5 max-h-44 overflow-y-auto text-xs text-slate-600">
            {auditLogs.length === 0 ? (
              <p className="text-slate-400 py-6 text-center">Belum ada aktivitas sistem.</p>
            ) : (
              auditLogs.slice(0, 6).map((log) => (
                <div key={log.id} className="flex items-start justify-between gap-2 border-b border-slate-100 pb-1.5">
                  <span className="truncate">{log.detail}</span>
                  <span className="text-[11px] text-slate-400 shrink-0 font-mono">{log.role}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
