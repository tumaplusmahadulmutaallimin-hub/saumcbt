import React, { useMemo, useState } from 'react';
import {
  Calendar,
  BookOpen,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Shirt,
  Printer,
  Save,
  X,
} from 'lucide-react';
import {
  ExamConfig,
  ExamRoom,
  ExamSchedule,
  ExamSubject,
  MadrasahProfile,
  PaperPreset,
  PhysicalClassroom,
  Supervisor,
  SupervisorAssignment,
} from '../../types';
import { validateScheduleConflicts } from '../../utils/seating';
import { extractJenjang } from '../../utils/dnpu';
import { JadwalUjianCetak } from '../documents/JadwalUjianCetak';
import { PrintToolbar } from '../documents/PrintToolbar';
import { normalizeTargetPaperPreset, usePrintLayout } from '../../utils/printLayout';
import { SchedulePrintVersion } from '../../utils/schedulePrint';

interface JadwalMapelViewProps {
  profile: MadrasahProfile;
  subjects: ExamSubject[];
  schedules: ExamSchedule[];
  rooms: ExamRoom[];
  physicalClassrooms: PhysicalClassroom[];
  supervisors: Supervisor[];
  supervisorAssignments: SupervisorAssignment[];
  examConfig: ExamConfig;
  paperPreset?: PaperPreset;
  canEdit: boolean;
  onSaveSchedules: (
    subjects: ExamSubject[],
    schedules: ExamSchedule[],
    seragamPerHariJenjang?: Record<string, Record<string, string>>
  ) => Promise<void>;
  onSavePreset?: (next: PaperPreset) => Promise<void>;
}

export const JadwalMapelView: React.FC<JadwalMapelViewProps> = ({
  profile,
  subjects,
  schedules,
  rooms,
  physicalClassrooms,
  supervisors,
  supervisorAssignments,
  examConfig,
  paperPreset,
  canEdit,
  onSaveSchedules,
  onSavePreset,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'jadwal' | 'mapel'>('jadwal');
  const [showPrint, setShowPrint] = useState(false);
  const [showUniformModal, setShowUniformModal] = useState(false);
  const [showAddScheduleForm, setShowAddScheduleForm] = useState(false);
  const [jadwalPrintVersion, setJadwalPrintVersion] = useState<SchedulePrintVersion>('lengkap');
  const normalizedSchedulePreset = useMemo(
    () => normalizeTargetPaperPreset('jadwal_ujian', paperPreset),
    [paperPreset]
  );
  const { layout, setLayout } = usePrintLayout(normalizedSchedulePreset, {
    size: 'F4',
    orientation: 'landscape',
    marginMm: 15,
  });

  const classes = useMemo(() => {
    const reg = examConfig.registeredClasses || [];
    if (reg.length > 0) return reg;
    const fromSched = new Set<string>();
    schedules.forEach((sc) => {
      if (sc.mapelPerKelas) {
        Object.keys(sc.mapelPerKelas).forEach((k) => fromSched.add(k));
      }
    });
    return Array.from(fromSched);
  }, [examConfig.registeredClasses, schedules]);

  const jenjangList = useMemo(
    () => Array.from(new Set(classes.map((c) => extractJenjang(c)))),
    [classes]
  );

  // Uniform rules draft by Day -> Jenjang -> Uniform text
  const defaultDays = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const activeDays = useMemo(() => {
    const fromSchedules = schedules.map((s) => s.hari).filter(Boolean);
    return Array.from(new Set([...fromSchedules, ...defaultDays]));
  }, [schedules]);

  const [uniformDraft, setUniformDraft] = useState<Record<string, Record<string, string>>>(() => {
    return examConfig.seragamPerHariJenjang || {};
  });

  const [newSubject, setNewSubject] = useState<Partial<ExamSubject>>({
    kode: '',
    nama: '',
    kategori: 'Umum',
    durasiMenit: 90,
  });

  const [perClassSubjectMode, setPerClassSubjectMode] = useState<'sama' | 'per_kelas'>('per_kelas');
  const [newSched, setNewSched] = useState<Partial<ExamSchedule>>({
    mapelId: subjects[0]?.id || '',
    mapelPerKelas: Object.fromEntries(classes.map((c) => [c, subjects[0]?.id || ''])),
    tanggal: examConfig.tanggalMulai,
    hari: 'Senin',
    jamKe: 1,
    sesi: 1,
    waktuMulai: '07:30',
    waktuSelesai: '09:00',
    jenjang: 'Semua',
    ruangIds: rooms.map((r) => r.id),
  });
  const [savedNotice, setSavedNotice] = useState('');

  const conflicts = useMemo(
    () => validateScheduleConflicts(schedules, physicalClassrooms),
    [schedules, physicalClassrooms]
  );

  // Detect uniform collisions on the same exam day across distinct jenjangs
  const uniformWarnings = useMemo(() => {
    const warns: string[] = [];
    const seenDay = new Set<string>();
    schedules.forEach((sc) => {
      if (seenDay.has(sc.hari)) return;
      seenDay.add(sc.hari);
      const dayMap = {
        ...(examConfig.seragamPerHariJenjang?.[sc.hari] || {}),
        ...(sc.seragamPerJenjang || {}),
      };
      const usedByLabel = new Map<string, string[]>();
      jenjangList.forEach((jen) => {
        const val = (dayMap[jen] || '').trim().toLowerCase();
        if (!val) return;
        if (!usedByLabel.has(val)) usedByLabel.set(val, []);
        usedByLabel.get(val)!.push(jen);
      });
      usedByLabel.forEach((jens, label) => {
        if (jens.length > 1) {
          warns.push(
            `Hari ${sc.hari}: Jenjang ${jens.join(' & ')} memakai seragam yang sama ("${label}"). Ubah agar pembeda di bangku jelas.`
          );
        }
      });
    });
    return warns;
  }, [schedules, examConfig.seragamPerHariJenjang, jenjangList]);

  const subjectMap = new Map(subjects.map((s) => [s.id, s]));

  const sortedSchedules = useMemo(
    () =>
      [...schedules].sort((a, b) => {
        const d = a.tanggal.localeCompare(b.tanggal);
        if (d !== 0) return d;
        return a.waktuMulai.localeCompare(b.waktuMulai);
      }),
    [schedules]
  );

  const detectDayName = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      return isNaN(d.getTime()) ? 'Senin' : days[d.getDay()];
    } catch {
      return 'Senin';
    }
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.kode || !newSubject.nama) return;
    const item: ExamSubject = {
      id: `sb-${Date.now()}`,
      kode: newSubject.kode.toUpperCase(),
      nama: newSubject.nama,
      kategori: (newSubject.kategori as ExamSubject['kategori']) || 'Umum',
      durasiMenit: Number(newSubject.durasiMenit) || 90,
    };
    await onSaveSchedules([...subjects, item], schedules);
    setNewSubject({ kode: '', nama: '', kategori: 'Umum', durasiMenit: 90 });
    setSavedNotice(`Mata pelajaran "${item.nama}" ditambahkan.`);
  };

  const handleDeleteSubject = async (id: string) => {
    await onSaveSchedules(
      subjects.filter((s) => s.id !== id),
      schedules.filter((sc) => sc.mapelId !== id)
    );
  };

  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSched.tanggal) return;
    const hari = newSched.hari || detectDayName(newSched.tanggal);
    const defaultUniformForDay =
      (examConfig.seragamPerHariJenjang || uniformDraft)[hari] || {};

    const classMap: Record<string, string> =
      perClassSubjectMode === 'sama'
        ? Object.fromEntries(classes.map((c) => [c, newSched.mapelId || subjects[0]?.id || '']))
        : { ...(newSched.mapelPerKelas || {}) };

    const primaryMapel =
      perClassSubjectMode === 'sama'
        ? newSched.mapelId || subjects[0]?.id || ''
        : Object.values(classMap).find(Boolean) || subjects[0]?.id || '';

    const item: ExamSchedule = {
      id: `sc-${Date.now()}`,
      mapelId: primaryMapel,
      mapelPerKelas: classMap,
      tanggal: newSched.tanggal,
      hari,
      jamKe: Number(newSched.jamKe) || 1,
      sesi: Number(newSched.sesi) || 1,
      waktuMulai: newSched.waktuMulai || '07:30',
      waktuSelesai: newSched.waktuSelesai || '09:00',
      jenjang: 'Semua',
      seragamPerJenjang: { ...defaultUniformForDay },
      ruangIds: rooms.map((r) => r.id),
    };
    await onSaveSchedules(subjects, [...schedules, item]);
    setShowAddScheduleForm(false);
    setSavedNotice('Jadwal per kelas berhasil ditambahkan ke kotak tabel.');
  };

  const handleInlineCellSubjectChange = async (
    scheduleId: string,
    kelas: string,
    nextMapelId: string
  ) => {
    if (!canEdit) return;
    const nextSchedules = schedules.map((sc) => {
      if (sc.id !== scheduleId) return sc;
      const baseMap = sc.mapelPerKelas
        ? { ...sc.mapelPerKelas }
        : Object.fromEntries(classes.map((c) => [c, sc.mapelId]));
      baseMap[kelas] = nextMapelId;
      return {
        ...sc,
        mapelPerKelas: baseMap,
        mapelId: Object.values(baseMap).find(Boolean) || sc.mapelId,
      };
    });
    await onSaveSchedules(subjects, nextSchedules);
  };

  const handleSaveUniformRules = async () => {
    const syncedSchedules = schedules.map((sc) => ({
      ...sc,
      seragamPerJenjang: {
        ...(uniformDraft[sc.hari] || {}),
      },
    }));
    await onSaveSchedules(subjects, syncedSchedules, uniformDraft);
    setShowUniformModal(false);
    setSavedNotice('Pengaturan seragam per jenjang berhasil disimpan dan disinkronkan ke jadwal.');
  };

  const handleDeleteSchedule = async (id: string) => {
    await onSaveSchedules(
      subjects,
      schedules.filter((s) => s.id !== id)
    );
  };

  if (showPrint) {
    return (
      <div className="space-y-4">
        <PrintToolbar
          title={
            jadwalPrintVersion === 'lengkap'
              ? 'Cetak Jadwal Lengkap (Admin / Pengawas)'
              : 'Cetak Jadwal Ujian (Versi Siswa)'
          }
          onBack={() => setShowPrint(false)}
          layout={layout}
          onLayoutChange={setLayout}
          onSaveLayout={onSavePreset}
          namedPage="schedule"
          extraControls={
            <div className="inline-flex rounded-lg border border-slate-300 bg-slate-50 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setJadwalPrintVersion('lengkap')}
                className={`px-2.5 py-1.5 rounded-md font-bold cursor-pointer whitespace-nowrap ${
                  jadwalPrintVersion === 'lengkap'
                    ? 'bg-emerald-700 text-white'
                    : 'text-slate-700 hover:bg-white'
                }`}
              >
                Versi 1: Lengkap (Pengawas)
              </button>
              <button
                type="button"
                onClick={() => setJadwalPrintVersion('siswa')}
                className={`px-2.5 py-1.5 rounded-md font-bold cursor-pointer whitespace-nowrap ${
                  jadwalPrintVersion === 'siswa'
                    ? 'bg-emerald-700 text-white'
                    : 'text-slate-700 hover:bg-white'
                }`}
              >
                Versi 2: Jadwal Siswa
              </button>
            </div>
          }
        />
        <div className="overflow-x-auto pb-8 print:overflow-visible print:pb-0">
          <JadwalUjianCetak
            profile={profile}
            examConfig={examConfig}
            schedules={schedules}
            subjects={subjects}
            rooms={rooms}
            supervisors={supervisors}
            supervisorAssignments={supervisorAssignments}
            paperPreset={layout}
            version={jadwalPrintVersion}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header Toolbar */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Jadwal Ujian Per Kelas & Pengaturan Seragam
          </h2>
          <p className="text-xs text-slate-500">
            Format kotak tabel per kelas dengan kolom seragam berbeda tiap jenjang agar mudah dibedakan di ruang ujian.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveSubTab('jadwal')}
            className={`px-3 py-2 text-xs font-bold rounded-lg border cursor-pointer whitespace-nowrap ${
              activeSubTab === 'jadwal'
                ? 'bg-emerald-700 border-emerald-700 text-white'
                : 'bg-white border-slate-300 text-slate-700'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 inline mr-1.5" />
            Kotak Jadwal ({schedules.length})
          </button>
          <button
            onClick={() => setActiveSubTab('mapel')}
            className={`px-3 py-2 text-xs font-bold rounded-lg border cursor-pointer whitespace-nowrap ${
              activeSubTab === 'mapel'
                ? 'bg-emerald-700 border-emerald-700 text-white'
                : 'bg-white border-slate-300 text-slate-700'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 inline mr-1.5" />
            Master Mapel ({subjects.length})
          </button>
          {canEdit && activeSubTab === 'jadwal' && (
            <>
              <button
                onClick={() => setShowUniformModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-amber-950 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg cursor-pointer whitespace-nowrap"
              >
                <Shirt className="w-3.5 h-3.5" /> Atur Seragam
              </button>
              <button
                onClick={() => setShowAddScheduleForm((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Slot Jadwal
              </button>
            </>
          )}
          <button
            onClick={() => setShowPrint(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" /> Cetak Jadwal
          </button>
        </div>
      </div>

      {savedNotice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {savedNotice}
        </div>
      )}

      {(conflicts.length > 0 || uniformWarnings.length > 0) && (
        <div className="bg-amber-50 border border-amber-200 text-amber-950 px-4 py-3 rounded-xl text-xs space-y-1">
          <p className="font-bold flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-600" /> Peringatan Jadwal & Pembeda Seragam:
          </p>
          {uniformWarnings.map((w, i) => (
            <p key={`uw-${i}`} className="pl-5">• {w}</p>
          ))}
          {conflicts.map((c, idx) => (
            <p key={`cf-${idx}`} className="pl-5 text-red-800">• {c}</p>
          ))}
        </div>
      )}

      {activeSubTab === 'jadwal' ? (
        <div className="space-y-4">
          {canEdit && showAddScheduleForm && (
            <form onSubmit={handleAddSchedule} className="bg-white p-5 rounded-xl border border-slate-200 space-y-4 text-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h3 className="text-sm font-bold text-slate-900">Tambah Baris Jadwal Ujian Per Kelas</h3>
                <button
                  type="button"
                  onClick={() => setShowAddScheduleForm(false)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal</label>
                  <input
                    type="date"
                    required
                    value={newSched.tanggal}
                    onChange={(e) =>
                      setNewSched({
                        ...newSched,
                        tanggal: e.target.value,
                        hari: detectDayName(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Hari</label>
                  <input
                    value={newSched.hari || 'Senin'}
                    onChange={(e) => setNewSched({ ...newSched, hari: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Jam Mulai–Selesai</label>
                  <div className="flex gap-1">
                    <input
                      type="time"
                      value={newSched.waktuMulai}
                      onChange={(e) => setNewSched({ ...newSched, waktuMulai: e.target.value })}
                      className="w-1/2 px-1.5 py-2 border border-slate-300 rounded-lg font-mono"
                    />
                    <input
                      type="time"
                      value={newSched.waktuSelesai}
                      onChange={(e) => setNewSched({ ...newSched, waktuSelesai: e.target.value })}
                      className="w-1/2 px-1.5 py-2 border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Sesi / Jam Ke</label>
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      min={1}
                      value={newSched.sesi}
                      onChange={(e) => setNewSched({ ...newSched, sesi: Number(e.target.value) })}
                      className="w-1/2 px-2 py-2 border border-slate-300 rounded-lg tabular-nums"
                    />
                    <input
                      type="number"
                      min={1}
                      value={newSched.jamKe}
                      onChange={(e) => setNewSched({ ...newSched, jamKe: Number(e.target.value) })}
                      className="w-1/2 px-2 py-2 border border-slate-300 rounded-lg tabular-nums"
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mode Pengisian Kelas</label>
                  <select
                    value={perClassSubjectMode}
                    onChange={(e) => setPerClassSubjectMode(e.target.value as 'sama' | 'per_kelas')}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white font-semibold"
                  >
                    <option value="per_kelas">Beda Per Kelas</option>
                    <option value="sama">Sama Semua Kelas</option>
                  </select>
                </div>
              </div>

              {perClassSubjectMode === 'sama' ? (
                <div className="max-w-md">
                  <label className="block font-semibold text-slate-700 mb-1">Mata Pelajaran Semua Kelas</label>
                  <select
                    value={newSched.mapelId}
                    onChange={(e) => setNewSched({ ...newSched, mapelId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-semibold"
                  >
                    {subjects.map((sb) => (
                      <option key={sb.id} value={sb.id}>{sb.kode} — {sb.nama}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block font-semibold text-slate-700 mb-2">
                    Pilih Mata Pelajaran Masing-Masing Kelas:
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                    {classes.map((cls) => (
                      <div key={cls} className="p-2 border border-slate-200 rounded-lg bg-slate-50">
                        <span className="block text-[11px] font-bold text-slate-800 mb-1">{cls}</span>
                        <select
                          value={newSched.mapelPerKelas?.[cls] ?? ''}
                          onChange={(e) =>
                            setNewSched({
                              ...newSched,
                              mapelPerKelas: {
                                ...(newSched.mapelPerKelas || {}),
                                [cls]: e.target.value,
                              },
                            })
                          }
                          className="w-full px-2 py-1 border border-slate-300 rounded bg-white text-[11px]"
                        >
                          <option value="">-- Tidak Ujian --</option>
                          {subjects.map((sb) => (
                            <option key={sb.id} value={sb.id}>{sb.nama}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Simpan ke Kotak Tabel Jadwal
                </button>
              </div>
            </form>
          )}

          {/* KOTAK TABEL JADWAL PER KELAS + KOLOM SERAGAM */}
          <div className="bg-white rounded-xl border border-slate-300 overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-bold">
                  <th rowSpan={2} className="border border-slate-300 px-2.5 py-2.5 text-center w-10">
                    No
                  </th>
                  <th rowSpan={2} className="border border-slate-300 px-3 py-2.5 text-left min-w-[130px]">
                    Hari & Tanggal
                  </th>
                  <th rowSpan={2} className="border border-slate-300 px-2.5 py-2.5 text-center min-w-[105px]">
                    Waktu & Sesi
                  </th>
                  <th
                    colSpan={Math.max(1, classes.length)}
                    className="border border-slate-300 px-3 py-1.5 text-center bg-emerald-50 text-emerald-950 uppercase tracking-wide"
                  >
                    Jadwal Mata Pelajaran Per Kelas
                  </th>
                  <th
                    rowSpan={2}
                    className="border border-slate-300 px-3 py-2.5 text-left bg-amber-50 text-amber-950 min-w-[200px]"
                  >
                    Seragam Per Jenjang
                  </th>
                  {canEdit && (
                    <th rowSpan={2} className="border border-slate-300 px-2 py-2.5 text-center w-12">
                      Aksi
                    </th>
                  )}
                </tr>
                <tr className="bg-slate-50 text-slate-900 font-extrabold">
                  {classes.length > 0 ? (
                    classes.map((cls) => (
                      <th key={cls} className="border border-slate-300 px-2 py-2 text-center min-w-[115px]">
                        {cls}
                      </th>
                    ))
                  ) : (
                    <th className="border border-slate-300 px-2 py-2 text-center text-slate-500 font-semibold">
                      Kelas Belum Terdaftar
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {sortedSchedules.length === 0 ? (
                  <tr>
                    <td colSpan={classes.length + (canEdit ? 5 : 4)} className="border border-slate-300 px-4 py-8 text-center text-slate-400">
                      Belum ada jadwal ujian. Tambahkan Master Mapel dan klik "Tambah Slot Jadwal".
                    </td>
                  </tr>
                ) : null}
                {sortedSchedules.map((sc, idx) => {
                  const dayUniforms = {
                    ...(examConfig.seragamPerHariJenjang?.[sc.hari] || {}),
                    ...(sc.seragamPerJenjang || {}),
                  };

                  return (
                    <tr key={sc.id} className="hover:bg-slate-50/60">
                      <td className="border border-slate-300 px-2.5 py-2.5 text-center font-semibold tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="border border-slate-300 px-3 py-2.5">
                        <div className="font-bold text-slate-900">{sc.hari}</div>
                        <div className="font-mono text-[11px] text-slate-500">{sc.tanggal}</div>
                      </td>
                      <td className="border border-slate-300 px-2.5 py-2.5 text-center font-mono tabular-nums">
                        <div className="font-bold text-slate-900">
                          {sc.waktuMulai}–{sc.waktuSelesai}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Jam {sc.jamKe || 1} • Sesi {sc.sesi}
                        </div>
                      </td>

                      {classes.map((cls) => {
                        const currentMapelId = sc.mapelPerKelas ? sc.mapelPerKelas[cls] || '' : sc.mapelId;
                        const sub = currentMapelId ? subjectMap.get(currentMapelId) : undefined;
                        return (
                          <td key={cls} className="border border-slate-300 px-2 py-2 text-center align-middle">
                            {canEdit ? (
                              <select
                                aria-label={`Mapel ${cls} ${sc.hari}`}
                                value={currentMapelId}
                                onChange={(e) => handleInlineCellSubjectChange(sc.id, cls, e.target.value)}
                                className="w-full px-1.5 py-1 text-[11px] font-semibold border border-slate-200 rounded bg-white text-slate-900 focus:border-emerald-700 focus:outline-hidden"
                              >
                                <option value="">- Kosong -</option>
                                {subjects.map((sb) => (
                                  <option key={sb.id} value={sb.id}>
                                    {sb.nama}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="font-bold text-slate-900">{sub?.nama || '-'}</span>
                            )}
                          </td>
                        );
                      })}

                      <td className="border border-slate-300 px-2.5 py-2 bg-amber-50/30">
                        <div className="space-y-1">
                          {jenjangList.map((jen) => (
                            <div
                              key={jen}
                              className="flex items-center justify-between gap-2 text-[11px] border-b border-amber-200/60 last:border-none pb-0.5 last:pb-0"
                            >
                              <span className="font-extrabold text-amber-950">{jen}</span>
                              <span className="font-semibold text-slate-800 text-right">
                                {dayUniforms[jen] || 'Belum diatur'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>

                      {canEdit && (
                        <td className="border border-slate-300 px-2 py-2 text-center">
                          <button
                            onClick={() => handleDeleteSchedule(sc.id)}
                            title="Hapus baris jadwal"
                            className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {canEdit && (
            <form
              onSubmit={handleAddSubject}
              className="bg-white p-5 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-5 gap-3 text-xs items-end"
            >
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kode Mapel</label>
                <input
                  required
                  value={newSubject.kode}
                  onChange={(e) => setNewSubject({ ...newSubject, kode: e.target.value.toUpperCase() })}
                  placeholder="Misal: FIQ"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Nama Mata Pelajaran</label>
                <input
                  required
                  value={newSubject.nama}
                  onChange={(e) => setNewSubject({ ...newSubject, nama: e.target.value })}
                  placeholder="Contoh: Bahasa Indonesia"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Durasi (Menit)</label>
                <input
                  type="number"
                  value={newSubject.durasiMenit}
                  onChange={(e) => setNewSubject({ ...newSubject, durasiMenit: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg tabular-nums"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer whitespace-nowrap"
              >
                + Tambah Mapel
              </button>
            </form>
          )}

          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <th className="px-3 py-3 w-20">Kode</th>
                  <th className="px-3 py-3">Nama Mata Pelajaran</th>
                  <th className="px-3 py-3">Kategori</th>
                  <th className="px-3 py-3 text-center">Durasi</th>
                  {canEdit && <th className="px-3 py-3 text-right">Hapus</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subjects.map((sb) => (
                  <tr key={sb.id} className="hover:bg-slate-50/70">
                    <td className="px-3 py-2.5 font-mono font-bold text-emerald-800">{sb.kode}</td>
                    <td className="px-3 py-2.5 font-semibold text-slate-900">{sb.nama}</td>
                    <td className="px-3 py-2.5 text-slate-600">{sb.kategori}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{sb.durasiMenit} Menit</td>
                    {canEdit && (
                      <td className="px-3 py-2.5 text-right">
                        <button
                          onClick={() => handleDeleteSubject(sb.id)}
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

      {/* Modal Fitur Atur Seragam Per Jenjang */}
      {showUniformModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-3xl w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Shirt className="w-4 h-4 text-amber-700" />
                  Atur Seragam Per Hari & Jenjang (Pembeda di Bangku Ujian)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pastikan setiap jenjang memakai seragam berbeda di hari yang sama agar pengawas mudah membedakan peserta di ruang silang jenjang.
                </p>
              </div>
              <button
                aria-label="Tutup"
                onClick={() => setShowUniformModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 font-bold">
                    <th className="border border-slate-300 px-3 py-2 text-left w-28">Hari</th>
                    {jenjangList.map((jen) => (
                      <th key={jen} className="border border-slate-300 px-3 py-2 text-left">
                        Seragam Jenjang {jen}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeDays.map((day) => {
                    const rowMap = uniformDraft[day] || {};
                    const values = jenjangList.map((j) => (rowMap[j] || '').trim().toLowerCase()).filter(Boolean);
                    const hasDuplicate = new Set(values).size < values.length;
                    return (
                      <tr key={day} className={hasDuplicate ? 'bg-amber-50/70' : ''}>
                        <td className="border border-slate-300 px-3 py-2 font-bold text-slate-900">
                          {day}
                          {hasDuplicate && (
                            <span className="block text-[10px] font-semibold text-red-700">
                              Ada seragam sama!
                            </span>
                          )}
                        </td>
                        {jenjangList.map((jen) => (
                          <td key={jen} className="border border-slate-300 px-2 py-2">
                            <input
                              value={rowMap[jen] || ''}
                              onChange={(e) =>
                                setUniformDraft((prev) => ({
                                  ...prev,
                                  [day]: { ...(prev[day] || {}), [jen]: e.target.value },
                                }))
                              }
                              placeholder={`Seragam ${jen}...`}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-xs font-semibold"
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowUniformModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveUniformRules}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" /> Simpan Pengaturan Seragam
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
