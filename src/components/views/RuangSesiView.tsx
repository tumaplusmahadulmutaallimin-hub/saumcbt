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
} from 'lucide-react';
import {
  ExamConfig,
  ExamRoom,
  RoomDistributionConfig,
  Student,
} from '../../types';
import {
  RoomDistributionResult,
  RoomDistributionValidationResult,
  distributeSessions,
  getRoomFacilityTotals,
  moveOrSwapStudentSeat,
  previewRoomDistribution,
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
  }) => Promise<void>;
  onNavigateToDenah: (roomId?: string) => void;
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
    kapasitasPerRuang: Math.min(23, Math.max(1, roomConfig.kapasitasPerRuang || 22)),
    jumlahRuangManual: roomConfig.jumlahRuangManual || examConfig.jumlahRuang || rooms.length || 1,
    allowIncidental23: roomConfig.allowIncidental23 ?? true,
  }));

  const [pendingPreview, setPendingPreview] = useState<{
    distribution: RoomDistributionResult;
    validation: RoomDistributionValidationResult;
    config: RoomDistributionConfig;
  } | null>(null);

  const [previousSnapshot, setPreviousSnapshot] = useState<{
    students: Student[];
    rooms: ExamRoom[];
    roomConfig: RoomDistributionConfig;
  } | null>(null);

  const [warnings, setWarnings] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  // Move single student dialog (also enforces cross-jenjang desk validation)
  const [movingStudent, setMovingStudent] = useState<Student | null>(null);
  const [targetRoomId, setTargetRoomId] = useState('');
  const [targetSeatNo, setTargetSeatNo] = useState<number>(1);
  const [targetSesi, setTargetSesi] = useState<number>(1);

  useEffect(() => {
    setLocalConfig({
      ...roomConfig,
      kapasitasPerRuang: Math.min(23, Math.max(1, roomConfig.kapasitasPerRuang || 22)),
      jumlahRuangManual: roomConfig.jumlahRuangManual || examConfig.jumlahRuang || rooms.length || 1,
      allowIncidental23: roomConfig.allowIncidental23 ?? true,
    });
  }, [roomConfig, examConfig.jumlahRuang, rooms.length]);

  const isOnline = examConfig.moda === 'online';
  const activeStudents = useMemo(
    () => students.filter((s) => s.status === 'Aktif'),
    [students]
  );
  const anyRoomLocked = rooms.some((r) => r.isLocked);

  // Live validation of currently saved distribution
  const liveValidation = useMemo(
    () => validateRoomDistribution(students, rooms, examConfig.moda, examConfig.jumlahSesi),
    [students, rooms, examConfig.moda, examConfig.jumlahSesi]
  );

  // Re-validate pending preview automatically if rooms facilities change
  const activePreviewValidation = useMemo(() => {
    if (!pendingPreview) return null;
    // Sync latest facility additions into preview rooms so returning from Manajemen Meja Kursi updates pass state immediately
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
        kapasitas: liveFac.totalKursi,
      };
    });
    return {
      rooms: syncedRooms,
      validation: validateRoomDistribution(
        pendingPreview.distribution.updatedStudents,
        syncedRooms,
        examConfig.moda,
        examConfig.jumlahSesi
      ),
    };
  }, [pendingPreview, rooms, examConfig.moda, examConfig.jumlahSesi]);

  const sessionStats = useMemo(() => {
    if (!isOnline) return [];
    const map = new Map<number, { count: number; jenjang: Record<string, number> }>();
    for (let i = 1; i <= examConfig.jumlahSesi; i++) {
      map.set(i, { count: 0, jenjang: {} });
    }
    activeStudents.forEach((s) => {
      const sesi = s.sesi || 1;
      if (!map.has(sesi)) map.set(sesi, { count: 0, jenjang: {} });
      const bucket = map.get(sesi)!;
      bucket.count++;
      const jen = s.jenjang || extractJenjang(s.kelas);
      bucket.jenjang[jen] = (bucket.jenjang[jen] || 0) + 1;
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [activeStudents, isOnline, examConfig.jumlahSesi]);

  const handleGenerateSessions = async () => {
    if (activeStudents.length === 0) {
      setWarnings(['Belum ada peserta aktif di DNPU. Tambahkan peserta terlebih dahulu sebelum membagi sesi.']);
      return;
    }
    setWarnings([]);
    const updatedStudents = distributeSessions(students, examConfig.jumlahSesi);
    await onSaveRooms({
      students: updatedStudents,
      rooms,
      roomConfig: localConfig,
    });
    setNotice(`Peserta aktif telah dibagi secara acak dan merata ke ${examConfig.jumlahSesi} sesi.`);
  };

  /**
   * Generate / Re-Generate always creates a non-destructive PREVIEW + 9-rule validation first!
   * Previous valid data is NEVER overwritten until operator confirms Save & validation passes.
   */
  const handleRunGeneratePreview = () => {
    setWarnings([]);
    setNotice('');
    if (anyRoomLocked) {
      setWarnings(['Sebagian ruang dikunci. Buka kunci ruang terlebih dahulu sebelum Generate Ulang otomatis.']);
      return;
    }
    if (activeStudents.length === 0) {
      setWarnings(['Belum ada peserta aktif di DNPU. Tambahkan peserta di Data DNPU terlebih dahulu.']);
      return;
    }

    const cleanCfg: RoomDistributionConfig = {
      ...localConfig,
      kapasitasPerRuang: Math.min(23, Math.max(1, localConfig.kapasitasPerRuang || 22)),
      allowIncidental23: true,
    };

    const { distribution, validation } = previewRoomDistribution(
      students,
      rooms,
      cleanCfg,
      examConfig.moda,
      examConfig.jumlahSesi,
      Math.random,
      { examJumlahRuang: examConfig.jumlahRuang }
    );

    const nextCfg = { ...cleanCfg, jumlahRuangManual: distribution.updatedRooms.length };
    setLocalConfig(nextCfg);
    setPendingPreview({ distribution, validation, config: nextCfg });
    setWarnings(distribution.warnings);
  };

  const handleCommitPreview = async () => {
    if (!pendingPreview || !activePreviewValidation) return;
    if (!activePreviewValidation.validation.isValid) {
      setWarnings(activePreviewValidation.validation.errors);
      return;
    }

    setSaving(true);
    try {
      // Save snapshot for quick Undo
      setPreviousSnapshot({
        students: students.map((s) => ({ ...s })),
        rooms: rooms.map((r) => ({ ...r })),
        roomConfig: { ...roomConfig },
      });

      await onSaveRooms({
        students: pendingPreview.distribution.updatedStudents,
        rooms: activePreviewValidation.rooms,
        roomConfig: pendingPreview.config,
      });

      setPendingPreview(null);
      setWarnings(activePreviewValidation.validation.warnings);
      setNotice(
        `Hasil pembagian ${activePreviewValidation.rooms.length} ruang lolos seluruh validasi dan berhasil disimpan ke database.`
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
      setWarnings([]);
      setNotice('Pembagian ruang sebelumnya berhasil dipulihkan ke database.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleLock = async (roomId: string) => {
    const nextRooms = rooms.map((r) => (r.id === roomId ? { ...r, isLocked: !r.isLocked } : r));
    await onSaveRooms({ students, rooms: nextRooms, roomConfig: localConfig });
  };

  const handleMoveStudent = async () => {
    if (!movingStudent || !targetRoomId) return;
    setWarnings([]);
    const res = moveOrSwapStudentSeat(
      students,
      rooms,
      movingStudent.id,
      targetRoomId,
      targetSeatNo,
      isOnline,
      isOnline ? targetSesi : undefined
    );
    if (!res.ok) {
      setWarnings([res.error || 'Pemindahan peserta melanggar aturan pasangan meja lintas jenjang.']);
      return;
    }
    await onSaveRooms({ students: res.updatedStudents, rooms, roomConfig: localConfig });
    const targetRoom = rooms.find((r) => r.id === targetRoomId);
    setMovingStudent(null);
    setNotice(
      `Peserta ${movingStudent.nama} dipindahkan ke ${targetRoom?.namaRuang || targetRoomId} Kursi #${String(targetSeatNo).padStart(2, '0')}.`
    );
  };

  const displayRooms = activePreviewValidation
    ? activePreviewValidation.rooms
    : rooms.filter((r) => !r.id.startsWith('room-cadangan'));
  const displayStudents = pendingPreview
    ? pendingPreview.distribution.updatedStudents.filter((s) => s.status === 'Aktif')
    : activeStudents;

  const facilityShortageCheck = activePreviewValidation?.validation.checks.find(
    (c) => c.code === 'facility_sufficiency' && !c.passed
  );

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
          {/* Moda Online Session Panel */}
          {isOnline && (
            <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Pembagian Sesi Ujian (Moda Online — {examConfig.jumlahSesi} Sesi)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Sistem membagi peserta aktif secara acak dan seimbang lintas jenjang ke {examConfig.jumlahSesi} sesi.
                  </p>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={handleGenerateSessions}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-lg cursor-pointer whitespace-nowrap"
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
                    <p className="text-[11px] text-slate-600 mt-1">
                      {Object.entries(stat.jenjang)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(' · ') || 'Belum ada peserta'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Room Distribution Config & Non-Destructive Re-Generate */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Pembagian Ruang Ujian Otomatis (Ideal 22 Siswa / Insidental Maks 23 Siswa)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Aturan wajib: 1 meja selalu berisi 2 siswa dari <strong>jenjang berbeda</strong> (tanpa ruang cadangan). Kondisi 23 siswa menempatkan siswa ke-23 di meja tambahan secara mandiri.
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
                    onClick={handleRunGeneratePreview}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer whitespace-nowrap"
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

            {warnings.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 text-amber-950 px-4 py-3 rounded-lg text-xs space-y-1">
                {warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 font-semibold">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
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
                  <option value="silang_jenjang_11_11">Silang Jenjang Ideal 11:11 (Direkomendasikan)</option>
                  <option value="silang_kelas">Silang Antar Kelas</option>
                  <option value="seimbang_gender">Seimbang Gender L/P</option>
                  <option value="nomor_peserta">Urut Nomor Peserta</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Target Kapasitas Per Ruang (Ideal 22, Maks 23 Insidental)
                </label>
                <input
                  type="number"
                  min={1}
                  max={23}
                  disabled={!canEdit}
                  value={localConfig.kapasitasPerRuang}
                  onChange={(e) =>
                    setLocalConfig({
                      ...localConfig,
                      kapasitasPerRuang: Math.min(23, Math.max(1, Number(e.target.value) || 22)),
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Jumlah Ruang Tersedia</label>
                <input
                  type="number"
                  min={1}
                  disabled={!canEdit}
                  value={localConfig.jumlahRuangManual || examConfig.jumlahRuang || Math.max(1, rooms.length)}
                  onChange={(e) =>
                    setLocalConfig({
                      ...localConfig,
                      jumlahRuangManual: Math.max(1, Number(e.target.value) || 1),
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono tabular-nums"
                />
              </div>
            </div>
          </div>

          {/* Non-Destructive Preview & 9-Rule Automatic Validation Panel */}
          {pendingPreview && activePreviewValidation && (
            <div className="bg-white p-5 rounded-xl border-2 border-emerald-700 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Pratinjau Hasil Generate Ulang (Belum Disimpan ke Database)
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Hasil sebelumnya tetap aman. Sistem hanya mengizinkan simpan apabila seluruh aturan validasi wajib terpenuhi.
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
                    Penambahan meja/kursi diperlukan untuk menampung kondisi insidental (mis. 23 siswa) sebelum hasil generate dapat disimpan.
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

          {/* Room Cards Summary */}
          {displayRooms.length === 0 ? (
            <div className="bg-white p-8 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-500">
              Belum ada ruang ujian yang terbentuk. Masukkan peserta di <strong>Data DNPU</strong> lalu klik{' '}
              <strong>Generate Pembagian Ruang</strong> untuk membuat daftar ruang otomatis.
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayRooms.map((room) => {
              const roomStudents = displayStudents.filter((s) => s.ruangId === room.id);
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

              return (
                <div key={room.id} className="bg-white p-5 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-slate-900">
                          {room.namaRuang} (Ruang {room.nomorRuang})
                        </h3>
                        <span
                          className={`text-[10.5px] font-bold px-2 py-0.5 rounded border ${
                            totals.statusFasilitas === 'INSIDENTAL' || roomStudents.length === 23
                              ? 'bg-amber-50 border-amber-300 text-amber-900'
                              : 'bg-slate-50 border-slate-200 text-slate-700'
                          }`}
                        >
                          {roomStudents.length === 23 ? 'INSIDENTAL 23 SISWA' : totals.statusFasilitas}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                        Siswa: <strong className="text-slate-900">{roomStudents.length}</strong> / {totals.totalKursi} kursi
                        {' · '}
                        Meja: <strong className="text-slate-900">{desksUsed}</strong> / {totals.totalMeja} meja
                        {isOnline ? ` · ${examConfig.jumlahSesi} sesi` : ''}
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
                          {room.isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
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
                        onClick={() => onNavigateToDenah(room.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 cursor-pointer whitespace-nowrap"
                      >
                        <Grid className="w-3.5 h-3.5" /> Denah
                      </button>
                    </div>
                  </div>

                  {/* Cross-Jenjang Composition (Unboxed text with middots) */}
                  <div className="text-xs text-slate-700 font-semibold tabular-nums">
                    Jenjang:{' '}
                    {Object.entries(jenjangMix)
                      .map(([jen, count]) => `${jen} (${count})`)
                      .join(' · ') || '-'}
                    {room.incidentalSeatNo && (
                      <span className="ml-2 text-amber-900 font-bold">
                        · Kursi #{room.incidentalSeatNo}: TEMPAT DUDUK TAMBAHAN
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
                          {isOnline && <th className="px-2 py-1.5 text-center">Sesi</th>}
                          {canEdit && !pendingPreview && <th className="px-2 py-1.5 text-right">Pindah</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {roomStudents
                          .sort((a, b) => (a.nomorMeja || 99) - (b.nomorMeja || 99))
                          .map((st) => (
                            <tr key={st.id}>
                              <td className="px-2 py-1.5 text-center font-mono font-bold tabular-nums">
                                {String(st.nomorMeja || '-').padStart(2, '0')}
                              </td>
                              <td className="px-2 py-1.5">
                                <div className="font-semibold text-slate-900">{st.nama}</div>
                                <div className="text-[11px] font-mono text-slate-500">{st.nomorPeserta || '-'}</div>
                              </td>
                              <td className="px-2 py-1.5 font-mono">
                                {st.usernameUjian ? (
                                  <div className="leading-tight">
                                    <div className="font-bold text-slate-900">{st.usernameUjian}</div>
                                    <div className="text-[10.5px] text-slate-500">P: {st.passwordUjian || '-'}</div>
                                  </div>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </td>
                              <td className="px-2 py-1.5 text-center font-semibold">{st.kelas}</td>
                              {isOnline && <td className="px-2 py-1.5 text-center font-semibold">S{st.sesi || 1}</td>}
                              {canEdit && !pendingPreview && (
                                <td className="px-2 py-1.5 text-right">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMovingStudent(st);
                                      setTargetRoomId(st.ruangId || displayRooms[0]?.id || '');
                                      setTargetSeatNo(st.nomorMeja || 1);
                                      setTargetSesi(st.sesi || 1);
                                    }}
                                    className="p-1 text-slate-500 hover:text-emerald-700 cursor-pointer"
                                    title="Pindah Ruang / Kursi"
                                  >
                                    <ArrowRightLeft className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
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
                    <option key={r.id} value={r.id}>{r.namaRuang}</option>
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
                onChange={(e) => setTargetSeatNo(Math.max(1, Math.min(24, Number(e.target.value) || 1)))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono tabular-nums"
              />
            </div>
            {isOnline && (
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Sesi Ujian</label>
                <select
                  value={targetSesi}
                  onChange={(e) => setTargetSesi(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  {Array.from({ length: examConfig.jumlahSesi }, (_, i) => i + 1).map((s) => (
                    <option key={s} value={s}>Sesi {s}</option>
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
