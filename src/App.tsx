import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Sliders,
  Users,
  Hash,
  DoorClosed,
  MapPin,
  Grid,
  ClipboardCheck,
  Tag,
  Calendar,
  UserCheck,
  FileText,
  Smartphone,
  Printer,
  Archive,
  Settings,
  Menu,
  X,
  FileCheck2,
  AlertCircle,
  PackageCheck,
  Armchair,
} from 'lucide-react';
import { DocumentType, PaperPreset, UserAccount } from './types';
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
} from './data/initialData';
import { SaumClientState, getStoredToken, saumApi } from './utils/api';
import { SaumModuleKey, canRoleEdit, canRoleView } from './utils/rbac';
import { DashboardView } from './components/views/DashboardView';
import { PengaturanUjianView } from './components/views/PengaturanUjianView';
import { DnpuView } from './components/views/DnpuView';
import { PenomoranView } from './components/views/PenomoranView';
import { NomorMejaView } from './components/views/NomorMejaView';
import { RuangSesiSubTab, RuangSesiView } from './components/views/RuangSesiView';
import { DenahLokasiView } from './components/views/DenahLokasiView';
import { DenahRuangView } from './components/views/DenahRuangView';
import { DaftarHadirView } from './components/views/DaftarHadirView';
import { LabelRuangView } from './components/views/LabelRuangView';
import { JadwalMapelView } from './components/views/JadwalMapelView';
import { PengawasView } from './components/views/PengawasView';
import { DokumenUjianView } from './components/views/DokumenUjianView';
import { AdminHpView } from './components/views/AdminHpView';
import { RekapView } from './components/views/RekapView';
import { CetakDokumenView } from './components/views/CetakDokumenView';
import { ArsipBackupView } from './components/views/ArsipBackupView';
import { PengaturanView } from './components/views/PengaturanView';

const DEFAULT_STATE: SaumClientState = {
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
  auditLogs: [],
};

export default function App() {
  const [state, setState] = useState<SaumClientState>(DEFAULT_STATE);
  const [currentUser, setCurrentUser] = useState<UserAccount>(INITIAL_USERS[0]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [globalError, setGlobalError] = useState<string>('');

  const [activeTab, setActiveTab] = useState<SaumModuleKey>('dashboard');
  const [activeDocSubtype, setActiveDocSubtype] = useState<DocumentType>('denah_ruang');
  const [activeRoomContextId, setActiveRoomContextId] = useState<string>('all');
  const [activeSesiContext, setActiveSesiContext] = useState<number | undefined>(undefined);
  const [ruangSesiTab, setRuangSesiTab] = useState<RuangSesiSubTab>('generate');
  const [pengaturanTab, setPengaturanTab] = useState<'madrasah_kop' | 'kertas' | 'panitia' | 'akses'>('madrasah_kop');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Hydrate authenticated session & persistent server DB on boot
  useEffect(() => {
    let mounted = true;
    async function bootstrap() {
      try {
        let user: UserAccount | undefined;
        if (getStoredToken()) {
          try {
            const me = await saumApi.me();
            user = me.user;
          } catch {
            // Token expired or server restarted -> re-auth default superadmin
          }
        }
        if (!user) {
          const auth = await saumApi.login('superadmin');
          user = auth.user;
        }
        const serverState = await saumApi.getState();
        if (mounted) {
          setCurrentUser(user);
          setState(serverState);
        }
      } catch (err) {
        if (mounted) {
          setGlobalError(
            err instanceof Error
              ? `Koneksi server bermasalah: ${err.message}`
              : 'Gagal memuat data dari server.'
          );
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    bootstrap();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSwitchUser = async (username: string) => {
    try {
      const res = await saumApi.login(username);
      setCurrentUser(res.user);
      const refreshed = await saumApi.getState();
      setState(refreshed);
      if (!canRoleView(res.user.role, activeTab)) {
        setActiveTab('dashboard');
      }
      setGlobalError('');
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Gagal berpindah akun');
    }
  };

  const navigateTo = (tab: string, docSubtype?: string, roomId?: string, sesi?: number) => {
    const key = tab as SaumModuleKey;
    if (!canRoleView(currentUser.role, key)) {
      setGlobalError(`Peran "${currentUser.role}" tidak memiliki akses ke modul ini.`);
      return;
    }
    setActiveTab(key);
    if (docSubtype) setActiveDocSubtype(docSubtype as DocumentType);
    if (roomId) setActiveRoomContextId(roomId);
    setActiveSesiContext(sesi);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Sidebar Navigation Menus
  const navItems: Array<{ id: SaumModuleKey; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'pengaturan_ujian', label: 'Pengaturan Ujian', icon: Sliders },
    { id: 'dnpu', label: 'Data DNPU', icon: Users },
    { id: 'penomoran', label: 'Nomor Peserta', icon: Hash },
    { id: 'nomor_meja', label: 'Nomor Meja', icon: Armchair },
    { id: 'ruang_sesi', label: 'Pembagian Ruang & Sesi', icon: DoorClosed },
    { id: 'denah_lokasi', label: 'Denah Lokasi', icon: MapPin },
    { id: 'denah_ruang', label: 'Denah Tempat Duduk', icon: Grid },
    { id: 'daftar_hadir', label: 'Daftar Hadir', icon: ClipboardCheck },
    { id: 'label_ruang', label: 'Label Ruang', icon: Tag },
    { id: 'jadwal', label: 'Jadwal Ujian', icon: Calendar },
    { id: 'pengawas', label: 'Pengawas', icon: UserCheck },
    { id: 'dokumen_ujian', label: 'Dokumen Ujian', icon: FileText },
    { id: 'admin_hp', label: 'Administrasi HP', icon: Smartphone },
    { id: 'rekap', label: 'Rekap & Perlengkapan', icon: PackageCheck },
    { id: 'cetak', label: 'Pusat Cetak', icon: Printer },
    { id: 'arsip', label: 'Arsip Ujian', icon: Archive },
    { id: 'pengaturan', label: 'Pengaturan', icon: Settings },
  ];

  const visibleNavItems = navItems.filter((item) => canRoleView(currentUser.role, item.id));
  const currentMenuMeta = navItems.find((item) => item.id === activeTab) || navItems[0];

  const withErrorCatch = async <T,>(fn: () => Promise<T>): Promise<T> => {
    setGlobalError('');
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Operasi gagal diproses server.';
      setGlobalError(msg);
      throw err;
    }
  };

  const handleSavePaperPreset = canRoleEdit(currentUser.role, 'pengaturan')
    ? async (nextPreset: PaperPreset) => {
        await withErrorCatch(async () => {
          const exists = state.paperPresets.some((p) => p.id === nextPreset.id);
          const nextPresets = exists
            ? state.paperPresets.map((p) => (p.id === nextPreset.id ? nextPreset : p))
            : [...state.paperPresets, nextPreset];
          const res = await saumApi.saveSettings({ paperPresets: nextPresets });
          setState((prev) => ({
            ...prev,
            paperPresets: res.paperPresets,
            auditLogs: res.auditLogs,
          }));
        });
      }
    : undefined;

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-emerald-950 text-white">
      {/* Brand Block */}
      <div className="px-4 py-4 border-b border-emerald-900 flex items-center justify-between">
        <button
          onClick={() => navigateTo('dashboard')}
          className="flex items-center gap-2.5 text-left cursor-pointer"
        >
          <div className="w-8 h-8 rounded-lg bg-emerald-700 flex items-center justify-center shrink-0">
            <FileCheck2 className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-extrabold tracking-wide leading-none">SAUM</p>
            <p className="text-[11px] text-emerald-300 truncate mt-0.5">
              {state.profile.namaMadrasah || 'Sistem Administrasi Ujian'}
            </p>
          </div>
        </button>
        <button
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden p-1 text-emerald-200 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => navigateTo(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer text-left ${
                active
                  ? 'bg-emerald-800 text-white'
                  : 'text-emerald-100/80 hover:bg-emerald-900/70 hover:text-white'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-amber-300' : 'text-emerald-300'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Active Role Summary at Bottom */}
      <div className="p-3 border-t border-emerald-900 text-xs">
        <p className="text-[11px] text-emerald-300">Akun Aktif ({currentUser.role})</p>
        <p className="font-semibold text-white truncate">{currentUser.nama}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Desktop Left Sidebar */}
      <aside className="no-print hidden lg:flex lg:w-[248px] lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 z-40">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileMenuOpen && (
        <div className="no-print fixed inset-0 z-50 lg:hidden flex">
          <div className="w-64 h-full">{renderSidebarContent()}</div>
          <div className="flex-1 bg-slate-900/50" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 lg:pl-[248px] print:pl-0 flex flex-col min-w-0">
        {/* Top Sticky Header */}
        <header className="no-print sticky top-0 z-30 h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label="Buka menu navigasi"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-500 truncate">
              <span className="font-bold text-slate-800">SAUM</span>
              <span>/</span>
              <span className="font-semibold text-emerald-800 truncate">{currentMenuMeta.label}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <span className="hidden md:inline-block text-xs font-semibold text-slate-600 border border-slate-200 bg-slate-50 px-2.5 py-1 rounded-md whitespace-nowrap">
              {state.examConfig.moda === 'online'
                ? `Online • ${state.examConfig.jumlahSesi} Sesi`
                : state.examConfig.jumlahSesi > 1
                  ? `Kertas • ${state.examConfig.jumlahSesi} Sesi`
                  : 'Moda Kertas'}
            </span>

            <select
              aria-label="Pilih Peran Pengguna"
              value={currentUser.username}
              onChange={(e) => handleSwitchUser(e.target.value)}
              className="px-2 sm:px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white text-slate-800 max-w-[145px] sm:max-w-none truncate"
            >
              {state.users
                .filter((u) => u.aktif)
                .map((u) => (
                  <option key={u.id} value={u.username}>
                    {u.role} ({u.username})
                  </option>
                ))}
            </select>

            {canRoleView(currentUser.role, 'cetak') && (
              <button
                onClick={() => navigateTo('cetak')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer whitespace-nowrap"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Pusat Cetak</span>
              </button>
            )}
          </div>
        </header>

        {/* Global Error Banner */}
        {globalError && (
          <div className="no-print mx-4 sm:mx-6 mt-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl text-xs font-semibold flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{globalError}</span>
            </div>
            <button onClick={() => setGlobalError('')} className="text-red-600 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Viewport */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 max-w-7xl w-full mx-auto print:p-0 print:m-0 print:max-w-none print:w-full print:block">
          {isLoading ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-xs text-slate-500">
              Memuat basis data SAUM...
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <DashboardView
                  profile={state.profile}
                  examConfig={state.examConfig}
                  students={state.students}
                  rooms={state.rooms}
                  schedules={state.schedules}
                  subjects={state.subjects}
                  committee={state.committee}
                  supervisors={state.supervisors}
                  phoneRecords={state.phoneRecords}
                  auditLogs={state.auditLogs}
                  onNavigate={(tab, docSub) => navigateTo(tab, docSub)}
                />
              )}

              {activeTab === 'pengaturan_ujian' && (
                <PengaturanUjianView
                  examConfig={state.examConfig}
                  profile={state.profile}
                  canEdit={canRoleEdit(currentUser.role, 'pengaturan_ujian')}
                  onSaveConfig={async (nextCfg, nextProfile) => {
                    await withErrorCatch(async () => {
                      const res = await saumApi.saveExamConfig(nextCfg);
                      let updatedProfile = res.profile;
                      if (nextProfile) {
                        const sRes = await saumApi.saveSettings({ profile: nextProfile });
                        updatedProfile = sRes.profile;
                      }
                      setState((prev) => ({
                        ...prev,
                        examConfig: res.examConfig,
                        roomConfig: res.roomConfig || prev.roomConfig,
                        profile: updatedProfile,
                        auditLogs: res.auditLogs,
                      }));
                    });
                  }}
                  onOpenKopSettings={() => {
                    setPengaturanTab('madrasah_kop');
                    navigateTo('pengaturan');
                  }}
                />
              )}

              {activeTab === 'dnpu' && (
                <DnpuView
                  students={state.students}
                  rooms={state.rooms}
                  examConfig={state.examConfig}
                  numberingConfig={state.numberingConfig}
                  roomConfig={state.roomConfig}
                  currentUser={currentUser}
                  canEdit={canRoleEdit(currentUser.role, 'dnpu')}
                  onSaveStudents={async (students, backupReason) => {
                    await withErrorCatch(async () => {
                      const res = await saumApi.saveStudents(students, backupReason);
                      setState((prev) => ({
                        ...prev,
                        students: res.students,
                        auditLogs: res.auditLogs,
                      }));
                    });
                  }}
                  onSaveNumbering={async (payload) => {
                    await withErrorCatch(async () => {
                      const res = await saumApi.saveNumbering(payload);
                      setState((prev) => ({
                        ...prev,
                        students: res.students,
                        numberingConfig: res.numberingConfig,
                        numberingHistory: res.numberingHistory,
                        examConfig: res.examConfig,
                        auditLogs: res.auditLogs,
                      }));
                    });
                  }}
                  onSaveRooms={async (payload) => {
                    await withErrorCatch(async () => {
                      const res = await saumApi.saveRooms(payload);
                      setState((prev) => ({
                        ...prev,
                        students: res.students,
                        rooms: res.rooms,
                        roomConfig: res.roomConfig,
                        examConfig: res.examConfig,
                        auditLogs: res.auditLogs,
                      }));
                    });
                  }}
                  onToggleFinalize={async (finalized) => {
                    await withErrorCatch(async () => {
                      const res = await saumApi.finalizeDnpu(finalized);
                      setState((prev) => ({
                        ...prev,
                        examConfig: res.examConfig,
                        auditLogs: res.auditLogs,
                      }));
                    });
                  }}
                  onNavigate={(tab) => navigateTo(tab)}
                />
              )}

              {activeTab === 'penomoran' && (
                <PenomoranView
                  profile={state.profile}
                  students={state.students}
                  rooms={state.rooms}
                  config={state.numberingConfig}
                  examConfig={state.examConfig}
                  history={state.numberingHistory}
                  paperPresets={state.paperPresets}
                  currentUser={currentUser}
                  canEdit={canRoleEdit(currentUser.role, 'penomoran')}
                  onSaveNumbering={async (payload) => {
                    await withErrorCatch(async () => {
                      const res = await saumApi.saveNumbering(payload);
                      setState((prev) => ({
                        ...prev,
                        students: res.students,
                        numberingConfig: res.numberingConfig,
                        numberingHistory: res.numberingHistory,
                        examConfig: res.examConfig,
                        auditLogs: res.auditLogs,
                      }));
                    });
                  }}
                  onSavePreset={handleSavePaperPreset}
                  onNavigateToPrint={(doc) => navigateTo('cetak', doc || 'nomor_peserta')}
                  onNavigateToDeskNumbers={() => navigateTo('nomor_meja')}
                  onNavigateToDnpu={() => navigateTo('dnpu')}
                />
              )}

              {activeTab === 'nomor_meja' && (
                <NomorMejaView
                  profile={state.profile}
                  examConfig={state.examConfig}
                  students={state.students}
                  rooms={state.rooms}
                  numberingConfig={state.numberingConfig}
                  kursiPerMeja={state.rekapConfig.kursiPerMeja}
                  paperPreset={
                    state.paperPresets.find((p) => p.id === 'nomor_meja') ||
                    state.paperPresets.find((p) => p.id === 'default')
                  }
                  canEdit={canRoleEdit(currentUser.role, 'nomor_meja')}
                  onSaveDeskNumbers={async (students) => {
                    await withErrorCatch(async () => {
                      const res = await saumApi.saveDeskNumbers(students);
                      setState((prev) => ({
                        ...prev,
                        students: res.students,
                        auditLogs: res.auditLogs,
                      }));
                    });
                  }}
                  onSavePreset={handleSavePaperPreset}
                />
              )}

              {activeTab === 'ruang_sesi' && (
                <RuangSesiView
                  students={state.students}
                  rooms={state.rooms}
                  roomConfig={state.roomConfig}
                  examConfig={state.examConfig}
                  canEdit={canRoleEdit(currentUser.role, 'ruang_sesi')}
                  initialSubTab={ruangSesiTab}
                  initialRoomId={activeRoomContextId !== 'all' ? activeRoomContextId : undefined}
                  onSaveRooms={async (payload) => {
                    await withErrorCatch(async () => {
                      const res = await saumApi.saveRooms(payload);
                      setState((prev) => ({
                        ...prev,
                        students: res.students,
                        rooms: res.rooms,
                        roomConfig: res.roomConfig,
                        examConfig: res.examConfig,
                        auditLogs: res.auditLogs,
                      }));
                    });
                  }}
                  onNavigateToDenah={(roomId, sesi) => navigateTo('denah_ruang', undefined, roomId, sesi)}
                />
              )}

              {activeTab === 'denah_lokasi' && (
                <DenahLokasiView
                  profile={state.profile}
                  examConfig={state.examConfig}
                  physicalClassrooms={state.physicalClassrooms}
                  rooms={state.rooms}
                  students={state.students}
                  supervisors={state.supervisors}
                  paperPreset={state.paperPresets.find((p) => p.id === 'denah_lokasi')}
                  canEdit={canRoleEdit(currentUser.role, 'denah_lokasi')}
                  onSaveDenahLokasi={async (nextClassrooms, finalized) => {
                    await withErrorCatch(async () => {
                      const res = await saumApi.saveDenahLokasi(nextClassrooms, finalized);
                      setState((prev) => ({
                        ...prev,
                        physicalClassrooms: res.physicalClassrooms,
                        examConfig: res.examConfig,
                        auditLogs: res.auditLogs,
                      }));
                    });
                  }}
                  onSavePreset={handleSavePaperPreset}
                />
              )}

              {activeTab === 'denah_ruang' && (
                <DenahRuangView
                  profile={state.profile}
                  examConfig={state.examConfig}
                  rooms={state.rooms}
                  students={state.students}
                  supervisors={state.supervisors}
                  roomConfig={state.roomConfig}
                  paperPreset={state.paperPresets.find((p) => p.id === 'denah_duduk')}
                  canEdit={canRoleEdit(currentUser.role, 'denah_ruang')}
                  initialRoomId={activeRoomContextId !== 'all' ? activeRoomContextId : undefined}
                  initialSesi={activeSesiContext}
                  onSaveRooms={async (payload) => {
                    await withErrorCatch(async () => {
                      const res = await saumApi.saveRooms(payload);
                      setState((prev) => ({
                        ...prev,
                        students: res.students,
                        rooms: res.rooms,
                        roomConfig: res.roomConfig,
                        examConfig: res.examConfig,
                        auditLogs: res.auditLogs,
                      }));
                    });
                  }}
                  onSavePreset={handleSavePaperPreset}
                  onOpenFacilityManager={(roomId) => {
                    setRuangSesiTab('fasilitas');
                    navigateTo('ruang_sesi', undefined, roomId);
                  }}
                />
              )}

              {activeTab === 'daftar_hadir' && (
                <DaftarHadirView
                  profile={state.profile}
                  examConfig={state.examConfig}
                  students={state.students}
                  rooms={state.rooms}
                  schedules={state.schedules}
                  subjects={state.subjects}
                  supervisors={state.supervisors}
                  supervisorAssignments={state.supervisorAssignments}
                  numberingConfig={state.numberingConfig}
                  paperPreset={state.paperPresets.find((p) => p.id === 'daftar_hadir')}
                  onSavePreset={handleSavePaperPreset}
                />
              )}

              {activeTab === 'label_ruang' && (
                <LabelRuangView
                  profile={state.profile}
                  examConfig={state.examConfig}
                  rooms={state.rooms}
                  students={state.students}
                  physicalClassrooms={state.physicalClassrooms}
                  paperPreset={state.paperPresets.find((p) => p.id === 'label_ruang')}
                  onSavePreset={handleSavePaperPreset}
                />
              )}

              {activeTab === 'jadwal' && (
                <JadwalMapelView
                  profile={state.profile}
                  subjects={state.subjects}
                  schedules={state.schedules}
                  rooms={state.rooms}
                  physicalClassrooms={state.physicalClassrooms}
                  supervisors={state.supervisors}
                  supervisorAssignments={state.supervisorAssignments}
                  examConfig={state.examConfig}
                  paperPreset={state.paperPresets.find((p) => p.id === 'default')}
                  canEdit={canRoleEdit(currentUser.role, 'jadwal')}
                  onSaveSchedules={async (subjects, schedules, seragamPerHariJenjang) => {
                    await withErrorCatch(async () => {
                      const res = await saumApi.saveSchedules(subjects, schedules, seragamPerHariJenjang);
                      setState((prev) => ({
                        ...prev,
                        subjects: res.subjects,
                        schedules: res.schedules,
                        examConfig: res.examConfig,
                        auditLogs: res.auditLogs,
                      }));
                    });
                  }}
                  onSavePreset={handleSavePaperPreset}
                />
              )}

              {activeTab === 'pengawas' && (
                <PengawasView
                  profile={state.profile}
                  supervisors={state.supervisors}
                  supervisorAssignments={state.supervisorAssignments}
                  schedules={state.schedules}
                  subjects={state.subjects}
                  rooms={state.rooms}
                  canEdit={canRoleEdit(currentUser.role, 'pengawas')}
                  onSaveSupervisors={async (supervisors, assignments, rooms) => {
                    await withErrorCatch(async () => {
                      const res = await saumApi.saveSupervisors(supervisors, assignments, rooms);
                      setState((prev) => ({
                        ...prev,
                        supervisors: res.supervisors,
                        supervisorAssignments: res.supervisorAssignments,
                        rooms: res.rooms,
                        auditLogs: res.auditLogs,
                      }));
                    });
                  }}
                  onNavigateToPrint={(doc) => navigateTo('cetak', doc)}
                />
              )}

              {activeTab === 'dokumen_ujian' && (
                <DokumenUjianView
                  profile={state.profile}
                  examConfig={state.examConfig}
                  rooms={state.rooms}
                  schedules={state.schedules}
                  subjects={state.subjects}
                  students={state.students}
                  supervisors={state.supervisors}
                  supervisorAssignments={state.supervisorAssignments}
                  sealConfigs={state.sealConfigs}
                  tataTertibDocs={state.tataTertibDocs}
                  paperPresets={state.paperPresets}
                  canEdit={canRoleEdit(currentUser.role, 'dokumen_ujian')}
                  onSaveDokumenUjian={async (payload) => {
                    await withErrorCatch(async () => {
                      const res = await saumApi.saveDokumenUjian(payload);
                      setState((prev) => ({
                        ...prev,
                        sealConfigs: res.sealConfigs,
                        tataTertibDocs: res.tataTertibDocs,
                        auditLogs: res.auditLogs,
                      }));
                    });
                  }}
                  onSavePreset={handleSavePaperPreset}
                />
              )}

              {activeTab === 'admin_hp' && (
                <AdminHpView
                  profile={state.profile}
                  examConfig={state.examConfig}
                  students={state.students}
                  rooms={state.rooms}
                  phoneRecords={state.phoneRecords}
                  hpLogs={state.hpLogs}
                  uploadedDocuments={state.uploadedDocuments}
                  currentUser={currentUser}
                  paperPreset={state.paperPresets.find((p) => p.id === 'dokumen_hp')}
                  canEdit={canRoleEdit(currentUser.role, 'admin_hp')}
                  onSavePhones={async (phoneRecords, hpLogs, auditDetail) => {
                    await withErrorCatch(async () => {
                      const res = await saumApi.savePhones(phoneRecords, hpLogs, auditDetail);
                      setState((prev) => ({
                        ...prev,
                        phoneRecords: res.phoneRecords,
                        hpLogs: res.hpLogs,
                        auditLogs: res.auditLogs,
                      }));
                    });
                  }}
                  onUploadDocument={async (doc) => {
                    await withErrorCatch(async () => {
                      const res = await saumApi.uploadArchivedDoc(doc);
                      setState((prev) => ({
                        ...prev,
                        uploadedDocuments: res.uploadedDocuments,
                        auditLogs: res.auditLogs,
                      }));
                    });
                  }}
                  onDeleteUploadedDoc={async (id) => {
                    await withErrorCatch(async () => {
                      const res = await saumApi.deleteArchivedDoc(id);
                      setState((prev) => ({
                        ...prev,
                        uploadedDocuments: res.uploadedDocuments,
                        auditLogs: res.auditLogs,
                      }));
                    });
                  }}
                  onSavePreset={handleSavePaperPreset}
                />
              )}

              {activeTab === 'rekap' && (
                <RekapView
                  profile={state.profile}
                  examConfig={state.examConfig}
                  students={state.students}
                  rooms={state.rooms}
                  schedules={state.schedules}
                  subjects={state.subjects}
                  phoneRecords={state.phoneRecords}
                  rekapConfig={state.rekapConfig}
                  currentUser={currentUser}
                  paperPreset={state.paperPresets.find((p) => p.id === 'default')}
                  canEdit={canRoleEdit(currentUser.role, 'rekap')}
                  onSaveRekap={async (rekapConfig, auditDetail) => {
                    await withErrorCatch(async () => {
                      const res = await saumApi.saveRekap(rekapConfig, auditDetail);
                      setState((prev) => ({
                        ...prev,
                        rekapConfig: res.rekapConfig,
                        auditLogs: res.auditLogs,
                      }));
                    });
                  }}
                  onSavePreset={handleSavePaperPreset}
                />
              )}

              {activeTab === 'cetak' && (
                <CetakDokumenView
                  profile={state.profile}
                  examConfig={state.examConfig}
                  students={state.students}
                  rooms={state.rooms}
                  physicalClassrooms={state.physicalClassrooms}
                  schedules={state.schedules}
                  subjects={state.subjects}
                  committee={state.committee}
                  supervisors={state.supervisors}
                  supervisorAssignments={state.supervisorAssignments}
                  numberingConfig={state.numberingConfig}
                  sealConfigs={state.sealConfigs}
                  tataTertibDocs={state.tataTertibDocs}
                  phoneRecords={state.phoneRecords}
                  hpLogs={state.hpLogs}
                  rekapConfig={state.rekapConfig}
                  paperPresets={state.paperPresets}
                  initialDocType={activeDocSubtype}
                  initialRoomId={activeRoomContextId}
                  onSavePreset={handleSavePaperPreset}
                  onUpdateProfile={async (nextProfile) => {
                    await withErrorCatch(async () => {
                      const res = await saumApi.saveSettings({ profile: nextProfile });
                      setState((prev) => ({
                        ...prev,
                        profile: res.profile,
                        auditLogs: res.auditLogs,
                      }));
                    });
                  }}
                />
              )}

              {activeTab === 'arsip' && (
                <ArsipBackupView
                  profile={state.profile}
                  examConfig={state.examConfig}
                  students={state.students}
                  rooms={state.rooms}
                  physicalClassrooms={state.physicalClassrooms}
                  schedules={state.schedules}
                  subjects={state.subjects}
                  committee={state.committee}
                  supervisors={state.supervisors}
                  supervisorAssignments={state.supervisorAssignments}
                  numberingConfig={state.numberingConfig}
                  roomConfig={state.roomConfig}
                  sealConfigs={state.sealConfigs}
                  tataTertibDocs={state.tataTertibDocs}
                  phoneRecords={state.phoneRecords}
                  uploadedDocuments={state.uploadedDocuments}
                  rekapConfig={state.rekapConfig}
                  archives={state.archives}
                  currentUser={currentUser}
                  canEdit={canRoleEdit(currentUser.role, 'arsip')}
                  onCreateArchive={async (record) => {
                    await withErrorCatch(async () => {
                      const res = await saumApi.createArchive(record);
                      setState((prev) => ({
                        ...prev,
                        archives: res.archives,
                        auditLogs: res.auditLogs,
                      }));
                    });
                  }}
                  onUnlockArchive={async (id, reason) => {
                    await withErrorCatch(async () => {
                      const res = await saumApi.unlockArchive(id, reason);
                      setState((prev) => ({
                        ...prev,
                        archives: res.archives,
                        auditLogs: res.auditLogs,
                      }));
                    });
                  }}
                  onRestoreArchive={async (id) => {
                    await withErrorCatch(async () => {
                      const res = await saumApi.restoreArchive(id);
                      setState(res);
                    });
                  }}
                  onDownloadBackup={async () => {
                    const backup = await withErrorCatch(() => saumApi.downloadBackup());
                    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `SAUM_Backup_${new Date().toISOString().slice(0, 10)}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  onRestoreBackup={async (payload) => {
                    await withErrorCatch(async () => {
                      const restored = await saumApi.restoreBackup(payload);
                      setState(restored);
                    });
                  }}
                  onUploadDocument={async (doc) => {
                    await withErrorCatch(async () => {
                      const res = await saumApi.uploadArchivedDoc(doc);
                      setState((prev) => ({
                        ...prev,
                        uploadedDocuments: res.uploadedDocuments,
                        auditLogs: res.auditLogs,
                      }));
                    });
                  }}
                  onDeleteUploadedDoc={async (id) => {
                    await withErrorCatch(async () => {
                      const res = await saumApi.deleteArchivedDoc(id);
                      setState((prev) => ({
                        ...prev,
                        uploadedDocuments: res.uploadedDocuments,
                        auditLogs: res.auditLogs,
                      }));
                    });
                  }}
                />
              )}

              {activeTab === 'pengaturan' && (
                <PengaturanView
                  profile={state.profile}
                  paperPresets={state.paperPresets}
                  committee={state.committee}
                  users={state.users}
                  auditLogs={state.auditLogs}
                  currentUser={currentUser}
                  canEdit={canRoleEdit(currentUser.role, 'pengaturan')}
                  initialTab={pengaturanTab}
                  onSaveSettings={async (payload) => {
                    await withErrorCatch(async () => {
                      const res = await saumApi.saveSettings(payload);
                      setState((prev) => ({
                        ...prev,
                        profile: res.profile,
                        paperPresets: res.paperPresets,
                        committee: res.committee,
                        users: res.users,
                        auditLogs: res.auditLogs,
                      }));
                    });
                  }}
                  onSwitchUser={handleSwitchUser}
                  onNavigateToPrintSk={() => navigateTo('cetak', 'sk_panitia')}
                  onResetClean={async () => {
                    await withErrorCatch(async () => {
                      const res = await saumApi.resetClean();
                      setState(res);
                    });
                  }}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
