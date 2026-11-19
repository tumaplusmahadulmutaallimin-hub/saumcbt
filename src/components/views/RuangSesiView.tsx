import React, { useEffect, useMemo, useState } from 'react';
import {
  Shuffle,
  DoorClosed,
  AlertTriangle,
  Lock,
  Unlock,
  CheckCircle2,
  Grid,
  ArrowRightLeft,
  Armchair,
  RefreshCw,
  Save,
  XCircle,
  Undo2,
  Sliders,
  ShieldAlert,
} from 'lucide-react';
import {
  ExamConfig,
  ExamRoom,
  RoomDistributionConfig,
  Student,
} from '../../types';
import {
  GenerateFeasibilityResult,
  RoomDistributionResult,
  RoomDistributionValidationResult,
  distributeSessions,
  generateValidatedRoomPlan,
  getRoomFacilityTotals,
  moveOrSwapStudentSeat,
  validateGenerateFeasibility,
  validateRoomDistribution,
} from '../../utils/seating';
import { extractJenjang } from '../../utils/dnpu';
import { ManajemenMejaKursiPanel } from '../rooms/ManajemenMejaKursiPanel';
import { EditDenahPanel } from '../rooms/EditDenahPanel';

export type RuangSesiSubTab = 'generate' | 'fasilitas' | 'edit_denah';

interface RuangSesiViewProps {
  students: Student[];
  rooms: ExamRoom[];
  roomConfig: RoomDistributionConfig;
  examConfig: ExamConfig;
  canEdit: boolean;
  initialSubTab?: RuangSesiSubTab;
  initialRoomId?: string;
  onSaveRooms: (payload: {
    students: Student[];
    rooms: ExamRoom[];
    roomConfig: RoomDistributionConfig;
    jumlahSesi?: number;
  }) => Promise<void>;
  onNavigateToDenah: (roomId?: string, sesi?: number) => void;
}

export const RuangSesiView: React.FC<RuangSesiViewProps> = ({
  students,
  rooms,
  roomConfig,
  examConfig,
  canEdit,
  initialSubTab = 'generate',
  initialRoomId,
  onSaveRooms,
  onNavigateToDenah,
}) => {
  const [subTab, setSubTab] = useState<RuangSesiSubTab>(initialSubTab);
  const [focusedRoomId, setFocusedRoomId] = useState<string | undefined>(initialRoomId);

  useEffect(() => {
    if (initialSubTab) setSubTab(initialSubTab);
  }, [initialSubTab]);

  useEffect(() => {
    if (initialRoomId) setFocusedRoomId(initialRoomId);
  }, [initialRoomId]);

  const [localConfig, setLocalConfig] = useState<RoomDistributionConfig>(() => ({
    ...roomConfig,
    kapasitasPerRuang: Math.min(24, Math.max(1, roomConfig.kapasitasPerRuang || 22)),
    jumlahRuangManual: roomConfig.jumlahRuangManual || examConfig.jumlahRuang || rooms.length || 1,
    allowIncidental23: roomConfig.allowIncidental23 ?? true,
  }));

  const [plannedSesi, setPlannedSesi] = useState<number>(() =>
    Math.max(1, examConfig.jumlahSesi || 1)
  );

  // Filter tab sesi: 0 = SEMUA SESI, 1..N = SESI tertentu
  const [sessionFilter, setSessionFilter] = useState<number>(0);

  const [pendingPreview, setPendingPreview] = useState<{
    distribution: RoomDistributionResult;
    validation: RoomDistributionValidationResult;
    feasibility: GenerateFeasibilityResult;
    config: RoomDistributionConfig;
    jumlahSesi: number;
  } | null>(null);

  const [previousSnapshot, setPreviousSnapshot] = useState<{
    students: Student[];
    rooms: ExamRoom[];
    roomConfig: RoomDistributionConfig;
    jumlahSesi: number;
  } | null>(null);

  const [warnings, setWarnings] = useState<string[]>([]);
  const [rejectionInfo, setRejectionInfo] = useState<GenerateFeasibilityResult | null>(null);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  // Move single student dialog (enforces cross-jenjang desk validation)
  const [movingStudent, setMovingStudent] = useState<Student | null>(null);
  const [targetRoomId, setTargetRoomId] = useState('');
  const [targetSeatNo, setTargetSeatNo] = useState<number>(1);
  const [targetSesi, setTargetSesi] = useState<number>(1);

  useEffect(() => {
    setLocalConfig({
      ...roomConfig,
      kapasitasPerRuang: Math.min(24, Math.max(1, roomConfig.kapasitasPerRuang || 22)),
      jumlahRuangManual: roomConfig.jumlahRuangManual || examConfig.jumlahRuang || rooms.length || 1,
      allowIncidental23: roomConfig.allowIncidental23 ?? true,
    });
  }, [roomConfig, examConfig.jumlahRuang, rooms.length]);

  useEffect(() => {
    setPlannedSesi(Math.max(1, examConfig.jumlahSesi || 1));
  }, [examConfig.jumlahSesi]);

  const isOnline = examConfig.moda === 'online';
  const activeStudents = useMemo(
    () => students.filter((s) => s.status === 'Aktif'),
    [students]
  );
  const anyRoomLocked = rooms.some((r) => r.isLocked);

  const plannedRuang = Math.max(
    1,
    localConfig.jumlahRuangManual || examConfig.jumlahRuang || rooms.filter((r) => !r.id.startsWith('room-cadangan')).length || 1
  );

  // Live Pre-Generate Feasibility Check
  const feasibility = useMemo(
    () => validateGenerateFeasibility(students, rooms, plannedRuang, plannedSesi),
    [students, rooms, plannedRuang, plannedSesi]
  );

  // Live validation of currently saved distribution
  const savedSesiCount = useMemo(() => {
    const maxStuSesi = Math.max(1, ...activeStudents.map((s) => s.sesi || 1));
    return Math.max(1, examConfig.jumlahSesi || 1, maxStuSesi);
  }, [activeStudents, examConfig.jumlahSesi]);

  const liveValidation = useMemo(
    () => validateRoomDistribution(students, rooms, examConfig.moda, savedSesiCount),
    [students, rooms, examConfig.moda, savedSesiCount]
  );

  // Re-validate pending preview automatically if rooms facilities change
  const activePreviewValidation = useMemo(() => {
    if (!pendingPreview) return null;
    const roomMap = new Map(rooms.map((r) => [r.id, r]));
    const syncedRooms = pendingPreview.distribution.updatedRooms.map((pr) => {
      const live = roomMap.get(pr.id);
      if (!live) return pr;
      const liveFac = getRoomFacilityTotals(live);
      return {
        ...pr,
        mejaAwal: liveFac.mejaAwal,
        kursiAwal: liveFac.kursiAwal,
        mejaTambahan: liveFac.mejaTambahan,
        kursiTambahan: liveFac.kursiTambahan,
        statusFasilitas: liveFac.statusFasilitas,
        keteranganFasilitas: live.keteranganFasilitas,
        kapasitas: Math.max(pr.kapasitas, liveFac.totalKursi),
      };
    });
    return {
      rooms: syncedRooms,
      validation: validateRoomDistribution(
        pendingPreview.distribution.updatedStudents,
        syncedRooms,
        examConfig.moda,
        pendingPreview.jumlahSesi
      ),
    };
  }, [pendingPreview, rooms, examConfig.moda]);

  // Display state (either Pending Preview or Saved DB)
  const displayRooms = activePreviewValidation
    ? activePreviewValidation.rooms
    : rooms.filter((r) => !r.id.startsWith('room-cadangan'));
  const displayStudents = pendingPreview
    ? pendingPreview.distribution.updatedStudents.filter((s) => s.status === 'Aktif')
    : activeStudents;

  const effectiveSesiCount = pendingPreview
    ? pendingPreview.jumlahSesi
    : savedSesiCount;
  const hasMultipleSessions =
    isOnline ||
    effectiveSesiCount > 1 ||
    displayStudents.some((s) => (s.sesi || 1) > 1);

  const sessionNumbersList = useMemo(() => {
    if (!hasMultipleSessions) return [1];
    const fromStudents = Array.from(
      new Set(displayStudents.map((s) => s.sesi || 1))
    );
    const maxSesi = Math.max(effectiveSesiCount, ...fromStudents, 1);
    return Array.from({ length: maxSesi }, (_, i) => i + 1);
  }, [hasMultipleSessions, displayStudents, effectiveSesiCount]);

  // Ensure active sessionFilter stays within range
  useEffect(() => {
    if (sessionFilter > 0 && !sessionNumbersList.includes(sessionFilter)) {
      setSessionFilter(0);
    }
  }, [sessionFilter, sessionNumbersList]);

  const sessionStats = useMemo(() => {
    const showStats = isOnline || plannedSesi > 1 || activeStudents.some((s) => (s.sesi || 1) > 1);
    if (!showStats) return [];
    const map = new Map<number, { count: number; jenjang: Record<string, number> }>();
    const total = Math.max(1, plannedSesi);
    for (let i = 1; i <= total; i++) {
      map.set(i, { count: 0, jenjang: {} });
    }
    displayStudents.forEach((s) => {
      const sesi = s.sesi || 1;
      if (!map.has(sesi)) map.set(sesi, { count: 0, jenjang: {} });
      const bucket = map.get(sesi)!;
      bucket.count++;
      const jen = s.jenjang || extractJenjang(s.kelas);
      bucket.jenjang[jen] = (bucket.jenjang[jen] || 0) + 1;
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [displayStudents, isOnline, plannedSesi, activeStudents]);

  const handleGenerateSessions = async () => {
    if (activeStudents.length === 0) {
      setWarnings(['Belum ada peserta aktif di DNPU. Tambahkan peserta terlebih dahulu sebelum membagi sesi.']);
      return;
    }
    setWarnings([]);
    setRejectionInfo(null);
    const updatedStudents = distributeSessions(students, plannedSesi);
    await onSaveRooms({
      students: updatedStudents,
      rooms,
      roomConfig: localConfig,
      jumlahSesi: plannedSesi,
    });
    setNotice(`Peserta aktif telah dibagi secara acak dan merata ke ${plannedSesi} sesi.`);
  };

  /**
   * VALIDATION-FIRST Generate / Re-Generate:
   * 1. Runs validateGenerateFeasibility BEFORE producing any allocation.
   * 2. If infeasible -> TOLAK GENERATE immediately with detailed explanation & no temporary allocation.
   * 3. If feasible -> produces non-destructive Pratinjau grouped per session + 9-rule validation.
   */
  const handleRunGeneratePreview = () => {
    setWarnings([]);
    setNotice('');
    setRejectionInfo(null);

    if (anyRoomLocked) {
      setWarnings(['Sebagian ruang dikunci. Buka kunci ruang terlebih dahulu sebelum Generate Ulang otomatis.']);
      return;
    }

    const cleanCfg: RoomDistributionConfig = {
      ...localConfig,
      kapasitasPerRuang: Math.min(24, Math.max(1, localConfig.kapasitasPerRuang || 22)),
      jumlahRuangManual: plannedRuang,
      allowIncidental23: true,
    };

    const plan = generateValidatedRoomPlan(
      students,
      rooms,
      cleanCfg,
      examConfig.moda,
      plannedRuang,
      plannedSesi,
      Math.random
    );

    if (!plan.accepted) {
      setPendingPreview(null);
      setRejectionInfo(plan.feasibility);
      setWarnings(plan.feasibility.reasons);
      return;
    }

    const nextCfg = {
      ...cleanCfg,
      jumlahRuangManual: plan.distribution.updatedRooms.length,
    };
    setLocalConfig(nextCfg);
    setPendingPreview({
      distribution: plan.distribution,
      validation: plan.validation,
      feasibility: plan.feasibility,
      config: nextCfg,
      jumlahSesi: plan.feasibility.jumlahSesi,
    });
    setSessionFilter(0);
    setWarnings(plan.distribution.warnings);
  };

  const handleCommitPreview = async () => {
    if (!pendingPreview || !activePreviewValidation) return;
    if (!activePreviewValidation.validation.isValid) {
      setWarnings(activePreviewValidation.validation.errors);
      return;
    }

    setSaving(true);
    try {
      setPreviousSnapshot({
        students: students.map((s) => ({ ...s })),
        rooms: rooms.map((r) => ({ ...r })),
        roomConfig: { ...roomConfig },
        jumlahSesi: examConfig.jumlahSesi,
      });

      await onSaveRooms({
        students: pendingPreview.distribution.updatedStudents,
        rooms: activePreviewValidation.rooms,
        roomConfig: pendingPreview.config,
        jumlahSesi: pendingPreview.jumlahSesi,
      });

      setPendingPreview(null);
      setRejectionInfo(null);
      setWarnings(activePreviewValidation.validation.warnings);
      setNotice(
        `Hasil pembagian ${activePreviewValidation.rooms.length} ruang (${pendingPreview.jumlahSesi} sesi) lolos seluruh validasi dan berhasil disimpan ke database.`
      );
    } finally {
      setSaving(false);
    }
  };

  const handleRestorePrevious = async () => {
    if (!previousSnapshot) return;
    setSaving(true);
    try {
      await onSaveRooms(previousSnapshot);
      setPreviousSnapshot(null);
      setPendingPreview(null);
      setRejectionInfo(null);
      setWarnings([]);
      setNotice('Pembagian ruang & sesi sebelumnya berhasil dipulihkan ke database.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleLock = async (roomId: string) => {
    const nextRooms = rooms.map((r) => (r.id === roomId ? { ...r, isLocked: !r.isLocked } : r));
    await onSaveRooms({ students, rooms: nextRooms, roomConfig: localConfig, jumlahSesi: examConfig.jumlahSesi });
  };

  const handleMoveStudent = async () => {
    if (!movingStudent || !targetRoomId) return;
    setWarnings([]);
    const useSesiScope = hasMultipleSessions;
    const res = moveOrSwapStudentSeat(
      students,
      rooms,
      movingStudent.id,
      targetRoomId,
      targetSeatNo,
      useSesiScope,
      useSesiScope ? targetSesi : undefined
    );
    if (!res.ok) {
      setWarnings([res.error || 'Pemindahan peserta melanggar aturan pasangan meja lintas jenjang.']);
      return;
    }
    await onSaveRooms({
      students: res.updatedStudents,
      rooms,
      roomConfig: localConfig,
      jumlahSesi: examConfig.jumlahSesi,
    });
    const targetRoom = rooms.find((r) => r.id === targetRoomId);
    setMovingStudent(null);
    setNotice(
      `Peserta ${movingStudent.nama} dipindahkan ke ${targetRoom?.namaRuang || targetRoomId}${
        useSesiScope ? ` (Sesi ${targetSesi})` : ''
      } Kursi #${String(targetSeatNo).padStart(2, '0')}.`
    );
  };

  const facilityShortageCheck = activePreviewValidation?.validation.checks.find(
    (c) => c.code === 'facility_sufficiency' && !c.passed
  );

  // Filtered session list to render (either single selected session or all sessions grouped cleanly)
  const visibleSessionGroups = useMemo(() => {
    if (!hasMultipleSessions) return [0]; // 0 indicates non-session single view
    if (sessionFilter > 0) return [sessionFilter];
    return sessionNumbersList;
  }, [hasMultipleSessions, sessionFilter, sessionNumbersList]);

  const previewAllocatedCount = pendingPreview
    ? pendingPreview.distribution.updatedStudents.filter(
        (s) => s.status === 'Aktif' && Boolean(s.ruangId) && Boolean(s.nomorMeja)
      ).length
    : 0;

  return (
    <div className="space-y-5">
      {/* 3 Sub-Menu Navigation Bar */}
      <div className="bg-white p-2 rounded-xl border border-slate-200 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setSubTab('generate')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            subTab === 'generate'
              ? 'bg-emerald-800 text-white'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          <DoorClosed className="w-4 h-4" /> Generate &amp; Pembagian Ruang
        </button>

        <button
          type="button"
          onClick={() => setSubTab('fasilitas')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            subTab === 'fasilitas'
              ? 'bg-emerald-800 text-white'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          <Armchair className="w-4 h-4" /> Manajemen Meja dan Kursi
          {rooms.some((r) => getRoomFacilityTotals(r).statusFasilitas === 'INSIDENTAL') && (
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900">
              Insidental
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setSubTab('edit_denah')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            subTab === 'edit_denah'
              ? 'bg-emerald-800 text-white'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          <Sliders className="w-4 h-4" /> Edit Denah Ruang
        </button>
      </div>

      {/* Sub-Tab 2: MANAJEMEN MEJA DAN KURSI */}
      {subTab === 'fasilitas' && (
        <ManajemenMejaKursiPanel
          rooms={rooms}
          students={students}
          roomConfig={localConfig}
          examConfig={examConfig}
          canEdit={canEdit}
          initialRoomId={focusedRoomId}
          onSaveRooms={onSaveRooms}
          onJumpToEditDenah={(roomId) => {
            setFocusedRoomId(roomId);
            setSubTab('edit_denah');
          }}
        />
      )}

      {/* Sub-Tab 3: EDIT DENAH RUANG */}
      {subTab === 'edit_denah' && (
        <EditDenahPanel
          rooms={rooms}
          students={students}
          roomConfig={localConfig}
          examConfig={examConfig}
          canEdit={canEdit}
          initialRoomId={focusedRoomId}
          onSaveRooms={onSaveRooms}
        />
      )}

      {/* Sub-Tab 1: GENERATE & RE-GENERATE RUANG */}
      {subTab === 'generate' && (
        <div className="space-y-6">
          {/* Room & Session Config Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Pembagian Ruang &amp; Sesi Ujian (Ideal 22 Siswa • Maks 24 Siswa / 12 Meja)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Jumlah ruang tetap sesuai penetapan madrasah (tanpa ruang cadangan). Setiap meja berpasangan wajib diisi 2 siswa dari <strong>jenjang berbeda</strong>.
                </p>
              </div>
              {canEdit && (
                <div className="flex flex-wrap items-center gap-2">
                  {previousSnapshot && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleRestorePrevious}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer"
                    >
                      <Undo2 className="w-3.5 h-3.5" /> Pulihkan Sebelumnya
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={!feasibility.isFeasible}
                    onClick={handleRunGeneratePreview}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer whitespace-nowrap disabled:opacity-45 disabled:cursor-not-allowed"
                    title={
                      feasibility.isFeasible
                        ? 'Jalankan generate dan lihat pratinjau pembagian per sesi'
                        : 'Generate ditolak karena kapasitas ruang/sesi atau komposisi jenjang belum mencukupi'
                    }
                  >
                    {rooms.length > 0 ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5" /> GENERATE ULANG (Pratinjau)
                      </>
                    ) : (
                      <>
                        <DoorClosed className="w-3.5 h-3.5" /> Generate Pembagian Ruang
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {notice && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700" /> {notice}
              </div>
            )}

            {/* 4 Control Fields: Metode, Target Kapasitas, Jumlah Ruang, Jumlah Sesi */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Metode Alokasi Ruang</label>
                <select
                  disabled={!canEdit}
                  value={localConfig.metode}
                  onChange={(e) =>
                    setLocalConfig({
                      ...localConfig,
                      metode: e.target.value as RoomDistributionConfig['metode'],
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-semibold"
                >
                  <option value="silang_jenjang_11_11">Silang Jenjang Ideal 11:11 (Wajib)</option>
                  <option value="silang_kelas">Silang Antar Kelas</option>
                  <option value="seimbang_gender">Seimbang Gender L/P</option>
                  <option value="nomor_peserta">Urut Nomor Peserta</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Target Kapasitas / Ruang (Ideal 22, Maks 24)
                </label>
                <input
                  type="number"
                  min={1}
                  max={24}
                  disabled={!canEdit}
                  value={localConfig.kapasitasPerRuang}
                  onChange={(e) =>
                    setLocalConfig({
                      ...localConfig,
                      kapasitasPerRuang: Math.min(24, Math.max(1, Number(e.target.value) || 22)),
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Jumlah Ruang Ditetapkan
                </label>
                <input
                  type="number"
                  min={1}
                  disabled={!canEdit}
                  value={plannedRuang}
                  onChange={(e) => {
                    const nextRuang = Math.max(1, Number(e.target.value) || 1);
                    setLocalConfig({
                      ...localConfig,
                      jumlahRuangManual: nextRuang,
                    });
                    setRejectionInfo(null);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Jumlah Sesi Ujian
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  disabled={!canEdit}
                  value={plannedSesi}
                  onChange={(e) => {
                    setPlannedSesi(Math.max(1, Math.min(10, Number(e.target.value) || 1)));
                    setRejectionInfo(null);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono tabular-nums"
                />
              </div>
            </div>

            {/* PRE-GENERATE FEASIBILITY PANEL (Section 3 Validation-First) */}
            <div
              className={`rounded-xl border p-4 space-y-3 ${
                feasibility.isFeasible
                  ? 'bg-slate-50 border-slate-200'
                  : 'bg-red-50 border-red-300'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {feasibility.isFeasible ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-red-700 shrink-0" />
                  )}
                  <h3
                    className={`text-xs font-extrabold uppercase tracking-wide ${
                      feasibility.isFeasible ? 'text-slate-900' : 'text-red-900'
                    }`}
                  >
                    {feasibility.isFeasible
                      ? 'VALIDASI KELAYAKAN: LAYAK GENERATE'
                      : 'TOLAK GENERATE — KAPASITAS ATAU KOMPOSISI BELUM MEMENUHI KETENTUAN'}
                  </h3>
                </div>
                <span className="font-mono text-[11px] font-bold text-slate-700 tabular-nums">
                  Rumus: {feasibility.jumlahRuang} Ruang &times; {feasibility.jumlahSesi} Sesi &times; 24 ={' '}
                  {feasibility.totalKapasitasMaks} Kursi Maksimal
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
                <div className="bg-white border border-slate-200 rounded-lg p-2.5">
                  <p className="text-[10.5px] text-slate-500">Peserta Aktif</p>
                  <p className="text-base font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                    {feasibility.totalActiveStudents}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-2.5">
                  <p className="text-[10.5px] text-slate-500">Ruang &times; Sesi</p>
                  <p className="text-base font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                    {feasibility.jumlahRuang} &times; {feasibility.jumlahSesi}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-2.5">
                  <p className="text-[10.5px] text-slate-500">Kapasitas Ideal (22)</p>
                  <p className="text-base font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                    {feasibility.totalKapasitasIdeal}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-2.5">
                  <p className="text-[10.5px] text-slate-500">Kapasitas Maks (24)</p>
                  <p
                    className={`text-base font-bold font-mono tabular-nums mt-0.5 ${
                      feasibility.totalActiveStudents > feasibility.totalKapasitasMaks
                        ? 'text-red-700'
                        : 'text-emerald-800'
                    }`}
                  >
                    {feasibility.totalKapasitasMaks}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-2.5">
                  <p className="text-[10.5px] text-slate-500">Meja Tersedia (12/R)</p>
                  <p className="text-base font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                    {feasibility.totalMejaTersedia}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-2.5">
                  <p className="text-[10.5px] text-slate-500">Belum Tertampung</p>
                  <p
                    className={`text-base font-bold font-mono tabular-nums mt-0.5 ${
                      feasibility.unaccommodatedCount > 0 ? 'text-red-700' : 'text-emerald-800'
                    }`}
                  >
                    {feasibility.unaccommodatedCount}
                  </p>
                </div>
              </div>

              <div className="text-[11px] text-slate-700 font-semibold tabular-nums">
                Komposisi Jenjang Aktif:{' '}
                {Object.entries(feasibility.jenjangCounts)
                  .map(([k, v]) => `Kelas ${k} (${v})`)
                  .join(' · ') || '-'}
              </div>

              {!feasibility.isFeasible && (
                <div className="bg-white border border-red-200 rounded-lg p-3.5 space-y-2.5 text-xs">
                  <div className="space-y-1 text-red-900">
                    {feasibility.reasons.map((reason, idx) => (
                      <p key={idx} className="font-semibold flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                        <span>{reason}</span>
                      </p>
                    ))}
                    {feasibility.recommendations.map((rec, idx) => (
                      <p key={`rec-${idx}`} className="text-slate-700 pl-6">
                        &bull; Rekomendasi: <strong>{rec}</strong>
                      </p>
                    ))}
                  </div>

                  {canEdit && feasibility.totalActiveStudents > 0 && (
                    <div className="flex flex-wrap items-center gap-2 pt-1 pl-6">
                      {feasibility.recommendedMinSesi > plannedSesi && (
                        <button
                          type="button"
                          onClick={() => setPlannedSesi(feasibility.recommendedMinSesi)}
                          className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
                        >
                          Terapkan Rekomendasi ({feasibility.recommendedMinSesi} Sesi)
                        </button>
                      )}
                      {feasibility.recommendedMinRuang > plannedRuang && (
                        <button
                          type="button"
                          onClick={() =>
                            setLocalConfig({
                              ...localConfig,
                              jumlahRuangManual: feasibility.recommendedMinRuang,
                            })
                          }
                          className="px-3 py-1.5 text-xs font-bold text-slate-800 bg-slate-100 border border-slate-300 hover:bg-slate-200 rounded-lg cursor-pointer"
                        >
                          Terapkan ({feasibility.recommendedMinRuang} Ruang)
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {rejectionInfo && !rejectionInfo.isFeasible && (
              <div className="bg-red-50 border border-red-300 text-red-950 px-4 py-3 rounded-lg text-xs font-semibold">
                Generate dibatalkan sistem karena syarat kelayakan belum terpenuhi. Sesuaikan jumlah sesi atau ruang di atas lalu coba kembali.
              </div>
            )}

            {warnings.length > 0 && feasibility.isFeasible && (
              <div className="bg-amber-50 border border-amber-200 text-amber-950 px-4 py-3 rounded-lg text-xs space-y-1">
                {warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 font-semibold">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Session Summary Cards (whenever Moda Online OR Jumlah Sesi > 1) */}
          {sessionStats.length > 0 && (
            <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5 border-b border-slate-200">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Distribusi Peserta Per Sesi ({sessionStats.length} Sesi)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Ruang yang sama digunakan bergantian antar sesi tanpa mencampur peserta lintas sesi.
                  </p>
                </div>
                {canEdit && !pendingPreview && (
                  <button
                    type="button"
                    onClick={handleGenerateSessions}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-lg cursor-pointer whitespace-nowrap"
                  >
                    <Shuffle className="w-3.5 h-3.5" /> Acak &amp; Bagi Sesi Merata
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {sessionStats.map(([sesiNum, stat]) => (
                  <div key={sesiNum} className="p-3.5 rounded-lg border border-slate-200 bg-slate-50">
                    <p className="text-xs font-bold text-slate-800">Sesi {sesiNum}</p>
                    <p className="text-xl font-bold text-emerald-800 font-mono tabular-nums mt-1">
                      {stat.count} Peserta
                    </p>
                    <p className="text-[11px] text-slate-600 mt-1 tabular-nums">
                      {Object.entries(stat.jenjang)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(' · ') || 'Belum ada peserta'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Non-Destructive Structured Preview Header & 9-Rule Automatic Validation Panel */}
          {pendingPreview && activePreviewValidation && (
            <div className="bg-white p-5 rounded-xl border-2 border-emerald-700 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    PRATINJAU HASIL GENERATE (Belum Disimpan ke Database)
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Periksa ringkasan sesi dan validasi aturan wajib sebelum menekan tombol Simpan Hasil Generate.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingPreview(null)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Batalkan Pratinjau
                  </button>
                  <button
                    type="button"
                    disabled={saving || !activePreviewValidation.validation.isValid}
                    onClick={handleCommitPreview}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {saving ? 'Menyimpan...' : 'Simpan Hasil Generate'}
                  </button>
                </div>
              </div>

              {/* Section 5 Required Main Preview Summary Header */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <p className="text-[11px] text-slate-500">Total Peserta Aktif</p>
                  <p className="text-base font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                    {activeStudents.length} Siswa
                  </p>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <p className="text-[11px] text-slate-500">Jumlah Ruang</p>
                  <p className="text-base font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                    {activePreviewValidation.rooms.length} Ruang
                  </p>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <p className="text-[11px] text-slate-500">Jumlah Sesi</p>
                  <p className="text-base font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                    {pendingPreview.jumlahSesi} Sesi
                  </p>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <p className="text-[11px] text-slate-500">Total Alokasi Peserta</p>
                  <p className="text-base font-bold font-mono tabular-nums text-emerald-800 mt-0.5">
                    {previewAllocatedCount} / {activeStudents.length}
                  </p>
                </div>
                <div
                  className={`p-3 rounded-lg border ${
                    activePreviewValidation.validation.isValid
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                      : 'border-red-300 bg-red-50 text-red-950'
                  }`}
                >
                  <p className="text-[11px] opacity-80">Status Validasi</p>
                  <p className="text-sm font-extrabold mt-1">
                    {activePreviewValidation.validation.isValid ? 'LOLOS SEMUA ATURAN' : 'PERLU PERBAIKAN'}
                  </p>
                </div>
              </div>

              {/* 9 Automatic Validation Checklist */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
                {activePreviewValidation.validation.checks.map((chk) => (
                  <div
                    key={chk.code}
                    className={`p-3 rounded-lg border space-y-1 ${
                      chk.passed
                        ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                        : chk.severity === 'error'
                          ? 'bg-red-50 border-red-300 text-red-950'
                          : 'bg-amber-50 border-amber-300 text-amber-950'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold">
                      {chk.passed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      ) : (
                        <AlertTriangle
                          className={`w-3.5 h-3.5 shrink-0 ${
                            chk.severity === 'error' ? 'text-red-700' : 'text-amber-700'
                          }`}
                        />
                      )}
                      <span>{chk.label}</span>
                    </div>
                    <p className="text-[11px] leading-snug opacity-90">{chk.detail}</p>
                  </div>
                ))}
              </div>

              {/* Quick Link to Manajemen Meja & Kursi when Facility Shortage Occurs */}
              {facilityShortageCheck && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="text-amber-950 font-semibold">
                    Penambahan meja/kursi diperlukan untuk menampung kapasitas ruang sebelum hasil generate dapat disimpan.
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFocusedRoomId(facilityShortageCheck.affectedRoomIds?.[0]);
                      setSubTab('fasilitas');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-700 text-white font-bold rounded-lg hover:bg-amber-800 cursor-pointer whitespace-nowrap"
                  >
                    <Armchair className="w-3.5 h-3.5" /> Tambah di Manajemen Meja &amp; Kursi &rarr;
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Live Validation Summary Bar (when not in preview) */}
          {!pendingPreview && rooms.length > 0 && (
            <div
              className={`px-4 py-3 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-3 ${
                liveValidation.isValid
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50 border-amber-300 text-amber-950'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {liveValidation.isValid ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-bold">
                    {liveValidation.isValid
                      ? 'Validasi Pembagian Ruang Aktif Terpenuhi (0 Bentrok Meja Satu Jenjang • 0 Ruang Cadangan)'
                      : `Perlu Penyesuaian: ${liveValidation.errors[0]}`}
                  </p>
                  {liveValidation.warnings.length > 0 && (
                    <p className="text-[11px] mt-0.5">{liveValidation.warnings[0]}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSubTab('fasilitas')}
                  className="px-3 py-1.5 font-semibold bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Kelola Meja &amp; Kursi
                </button>
                <button
                  type="button"
                  onClick={() => setSubTab('edit_denah')}
                  className="px-3 py-1.5 font-semibold bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Edit Denah
                </button>
              </div>
            </div>
          )}

          {/* Mandatory Session Filter Tabs (Section 6) */}
          {displayRooms.length > 0 && hasMultipleSessions && (
            <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-bold text-slate-600 px-2">Filter Tampilan Sesi:</span>
                <button
                  type="button"
                  onClick={() => setSessionFilter(0)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    sessionFilter === 0
                      ? 'bg-emerald-800 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  SEMUA SESI ({displayStudents.length})
                </button>
                {sessionNumbersList.map((sNum) => {
                  const sCount = displayStudents.filter((s) => (s.sesi || 1) === sNum).length;
                  return (
                    <button
                      key={`filter-sesi-${sNum}`}
                      type="button"
                      onClick={() => setSessionFilter(sNum)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                        sessionFilter === sNum
                          ? 'bg-emerald-800 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      SESI {sNum} ({sCount})
                    </button>
                  );
                })}
              </div>
              <span className="text-[11px] font-mono text-slate-500">
                {displayRooms.length} Ruang &bull; Tidak Mencampur Antar Sesi
              </span>
            </div>
          )}

          {/* Empty State */}
          {displayRooms.length === 0 ? (
            <div className="bg-white p-8 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-500">
              Belum ada ruang ujian yang terbentuk. Masukkan peserta di <strong>Data DNPU</strong> lalu klik{' '}
              <strong>Generate Pembagian Ruang</strong> untuk membuat daftar ruang otomatis.
            </div>
          ) : (
            /* Separated Session Groups (NEVER combining sessions in the same room card) */
            <div className="space-y-6">
              {visibleSessionGroups.map((sesiGroup) => {
                const sesiStudents =
                  sesiGroup === 0
                    ? displayStudents
                    : displayStudents.filter((s) => (s.sesi || 1) === sesiGroup);

                const sesiJenjangCounts: Record<string, number> = {};
                sesiStudents.forEach((s) => {
                  const j = s.jenjang || extractJenjang(s.kelas);
                  sesiJenjangCounts[j] = (sesiJenjangCounts[j] || 0) + 1;
                });

                return (
                  <div key={`session-group-${sesiGroup}`} className="space-y-3">
                    {sesiGroup > 0 && (
                      <div className="bg-slate-100 border border-slate-200 px-4 py-2.5 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2.5">
                          <span className="font-extrabold text-emerald-900 uppercase tracking-wide">
                            SESI {sesiGroup}
                          </span>
                          <span className="font-mono font-bold text-slate-800 tabular-nums">
                            {sesiStudents.length} Peserta
                          </span>
                        </div>
                        <span className="text-slate-600 font-semibold tabular-nums">
                          {Object.entries(sesiJenjangCounts)
                            .map(([k, v]) => `Kelas ${k}: ${v}`)
                            .join(' · ') || 'Kosong'}
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {displayRooms.map((room) => {
                        const roomStudents = sesiStudents
                          .filter((s) => s.ruangId === room.id)
                          .sort((a, b) => (a.nomorMeja || 999) - (b.nomorMeja || 999));
                        const jenjangMix: Record<string, number> = {};
                        roomStudents.forEach((s) => {
                          const j = s.jenjang || extractJenjang(s.kelas);
                          jenjangMix[j] = (jenjangMix[j] || 0) + 1;
                        });
                        const totals = getRoomFacilityTotals(room);
                        const desksUsed = Math.max(
                          Math.ceil(roomStudents.length / 2),
                          ...roomStudents.map((s) => (s.nomorMeja ? Math.ceil(s.nomorMeja / 2) : 0)),
                          0
                        );

                        const capacityStatusLabel =
                          roomStudents.length === 22
                            ? 'IDEAL 22'
                            : roomStudents.length === 23
                              ? 'INSIDENTAL 23'
                              : roomStudents.length === 24
                                ? 'MAKS 24'
                                : roomStudents.length > 24
                                  ? 'MELEBIHI BATAS'
                                  : totals.statusFasilitas;

                        return (
                          <div
                            key={`${room.id}-s${sesiGroup}`}
                            className="bg-white p-5 rounded-xl border border-slate-200 space-y-3"
                          >
                            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="text-sm font-bold text-slate-900">
                                    {room.namaRuang} (Ruang {room.nomorRuang})
                                    {sesiGroup > 0 ? ` • Sesi ${sesiGroup}` : ''}
                                  </h3>
                                  <span
                                    className={`text-[10.5px] font-bold px-2 py-0.5 rounded border ${
                                      roomStudents.length > 24
                                        ? 'bg-red-50 border-red-300 text-red-900'
                                        : roomStudents.length === 23
                                          ? 'bg-amber-50 border-amber-300 text-amber-900'
                                          : 'bg-slate-50 border-slate-200 text-slate-700'
                                    }`}
                                  >
                                    {capacityStatusLabel}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                                  Siswa: <strong className="text-slate-900">{roomStudents.length}</strong> /{' '}
                                  {Math.max(totals.totalKursi, roomStudents.length)} kursi
                                  {' · '}
                                  Meja: <strong className="text-slate-900">{desksUsed}</strong> /{' '}
                                  {Math.max(totals.totalMeja, desksUsed)} meja
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5">
                                {canEdit && !pendingPreview && (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleLock(room.id)}
                                    className={`p-1.5 rounded-lg border text-xs cursor-pointer ${
                                      room.isLocked
                                        ? 'bg-amber-50 border-amber-300 text-amber-800'
                                        : 'bg-slate-50 border-slate-200 text-slate-600'
                                    }`}
                                    title={room.isLocked ? 'Buka Kunci Ruang' : 'Kunci Ruang'}
                                  >
                                    {room.isLocked ? (
                                      <Lock className="w-3.5 h-3.5" />
                                    ) : (
                                      <Unlock className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFocusedRoomId(room.id);
                                    setSubTab('edit_denah');
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 cursor-pointer whitespace-nowrap"
                                >
                                  <Sliders className="w-3.5 h-3.5" /> Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onNavigateToDenah(room.id, sesiGroup > 0 ? sesiGroup : undefined)
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 cursor-pointer whitespace-nowrap"
                                >
                                  <Grid className="w-3.5 h-3.5" /> Denah
                                </button>
                              </div>
                            </div>

                            {/* Cross-Jenjang Composition */}
                            <div className="text-xs text-slate-700 font-semibold tabular-nums">
                              Jenjang:{' '}
                              {Object.entries(jenjangMix)
                                .map(([jen, count]) => `${jen} (${count})`)
                                .join(' · ') || '-'}
                              {roomStudents.length === 23 && (
                                <span className="ml-2 text-amber-900 font-bold">
                                  · Kursi #23: TEMPAT DUDUK TAMBAHAN
                                </span>
                              )}
                            </div>

                            <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-lg">
                              <table className="w-full text-xs border-collapse">
                                <thead>
                                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                                    <th className="px-2 py-1.5 text-center w-10">Kursi</th>
                                    <th className="px-2 py-1.5 text-left">Nama &amp; No. Peserta</th>
                                    <th className="px-2 py-1.5 text-left">User &amp; Pass Ujian</th>
                                    <th className="px-2 py-1.5 text-center">Kelas</th>
                                    {canEdit && !pendingPreview && (
                                      <th className="px-2 py-1.5 text-right">Pindah</th>
                                    )}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {roomStudents.length === 0 ? (
                                    <tr>
                                      <td
                                        colSpan={canEdit && !pendingPreview ? 5 : 4}
                                        className="px-3 py-4 text-center text-slate-400"
                                      >
                                        Tidak ada peserta pada {room.namaRuang}
                                        {sesiGroup > 0 ? ` Sesi ${sesiGroup}` : ''}.
                                      </td>
                                    </tr>
                                  ) : (
                                    roomStudents.map((st) => (
                                      <tr key={st.id}>
                                        <td className="px-2 py-1.5 text-center font-mono font-bold tabular-nums">
                                          {String(st.nomorMeja || '-').padStart(2, '0')}
                                        </td>
                                        <td className="px-2 py-1.5">
                                          <div className="font-semibold text-slate-900">{st.nama}</div>
                                          <div className="text-[11px] font-mono text-slate-500">
                                            {st.nomorPeserta || '-'}
                                          </div>
                                        </td>
                                        <td className="px-2 py-1.5 font-mono">
                                          {st.usernameUjian ? (
                                            <div className="leading-tight">
                                              <div className="font-bold text-slate-900">
                                                {st.usernameUjian}
                                              </div>
                                              <div className="text-[10.5px] text-slate-500">
                                                P: {st.passwordUjian || '-'}
                                              </div>
                                            </div>
                                          ) : (
                                            <span className="text-slate-400">-</span>
                                          )}
                                        </td>
                                        <td className="px-2 py-1.5 text-center font-semibold">
                                          {st.kelas}
                                        </td>
                                        {canEdit && !pendingPreview && (
                                          <td className="px-2 py-1.5 text-right">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setMovingStudent(st);
                                                setTargetRoomId(st.ruangId || displayRooms[0]?.id || '');
                                                setTargetSeatNo(st.nomorMeja || 1);
                                                setTargetSesi(st.sesi || sesiGroup || 1);
                                              }}
                                              className="p-1 text-slate-500 hover:text-emerald-700 cursor-pointer"
                                              title="Pindah Ruang / Kursi"
                                            >
                                              <ArrowRightLeft className="w-3.5 h-3.5" />
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
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Move Student Modal (with Cross-Jenjang Guard) */}
      {movingStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-sm w-full p-5 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-slate-900">Pindahkan Peserta</h3>
            <p className="text-slate-600">
              Peserta: <strong>{movingStudent.nama}</strong> ({movingStudent.kelas})
            </p>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Ruang Tujuan</label>
              <select
                value={targetRoomId}
                onChange={(e) => setTargetRoomId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
              >
                {rooms
                  .filter((r) => !r.id.startsWith('room-cadangan'))
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.namaRuang}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nomor Kursi Tujuan (1–24)</label>
              <input
                type="number"
                min={1}
                max={24}
                value={targetSeatNo}
                onChange={(e) =>
                  setTargetSeatNo(Math.max(1, Math.min(24, Number(e.target.value) || 1)))
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono tabular-nums"
              />
            </div>
            {hasMultipleSessions && (
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Sesi Ujian</label>
                <select
                  value={targetSesi}
                  onChange={(e) => setTargetSesi(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  {sessionNumbersList.map((s) => (
                    <option key={s} value={s}>
                      Sesi {s}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMovingStudent(null)}
                className="px-3 py-1.5 font-semibold bg-slate-100 rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleMoveStudent}
                className="px-4 py-1.5 font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
              >
                Pindahkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
