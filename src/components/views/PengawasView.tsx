import React, { useEffect, useMemo, useState } from 'react';
import {
  UserCheck,
  AlertTriangle,
  Plus,
  Trash2,
  CheckCircle2,
  Printer,
  Wand2,
} from 'lucide-react';
import {
  ExamRoom,
  ExamSchedule,
  ExamSubject,
  MadrasahProfile,
  Supervisor,
  SupervisorAssignment,
} from '../../types';
import { validateSupervisorConflicts } from '../../utils/seating';
import { formatDayAndDate } from '../../utils/qrBarcode';

interface PengawasViewProps {
  profile: MadrasahProfile;
  supervisors: Supervisor[];
  supervisorAssignments: SupervisorAssignment[];
  schedules: ExamSchedule[];
  subjects: ExamSubject[];
  rooms: ExamRoom[];
  canEdit: boolean;
  onSaveSupervisors: (
    supervisors: Supervisor[],
    assignments: SupervisorAssignment[],
    rooms?: ExamRoom[]
  ) => Promise<void>;
  onNavigateToPrint: (docType: 'daftar_pengawas' | 'surat_tugas') => void;
}

export const PengawasView: React.FC<PengawasViewProps> = ({
  supervisors,
  supervisorAssignments,
  schedules,
  subjects,
  rooms,
  canEdit,
  onSaveSupervisors,
  onNavigateToPrint,
}) => {
  const [activeTab, setActiveTab] = useState<'matriks' | 'master' | 'rekap'>('matriks');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(supervisors[0]?.id || 'all');
  const [newSup, setNewSup] = useState<Partial<Supervisor>>({
    nama: '',
    nip: '',
    asalMadrasah: '',
    noHp: '',
    status: 'Aktif',
  });
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (supervisors.length > 0 && !supervisors.some((s) => s.id === selectedTeacherId)) {
      setSelectedTeacherId(supervisors[0].id);
    } else if (supervisors.length === 0) {
      setSelectedTeacherId('');
    }
  }, [supervisors, selectedTeacherId]);

  const subjectMap = new Map(subjects.map((s) => [s.id, s]));
  const roomMap = new Map(rooms.map((r) => [r.id, r]));
  const supervisorMap = new Map(supervisors.map((sp) => [sp.id, sp]));
  const activeSupervisors = supervisors.filter((s) => s.status === 'Aktif');

  // Build full matrix rows for every (schedule x room in schedule)
  const matrixSlots = useMemo(() => {
    const slots: Array<{
      schedule: ExamSchedule;
      room: ExamRoom;
      assignment?: SupervisorAssignment;
    }> = [];
    const sortedScheds = [...schedules].sort((a, b) =>
      `${a.tanggal}-${a.waktuMulai}`.localeCompare(`${b.tanggal}-${b.waktuMulai}`)
    );
    sortedScheds.forEach((sc) => {
      const targetRoomIds = sc.ruangIds.length > 0 ? sc.ruangIds : rooms.map((r) => r.id);
      targetRoomIds.forEach((rId) => {
        const room = roomMap.get(rId);
        if (!room) return;
        const asg = supervisorAssignments.find(
          (a) => a.scheduleId === sc.id && a.roomId === room.id
        );
        slots.push({ schedule: sc, room, assignment: asg });
      });
    });
    return slots;
  }, [schedules, rooms, supervisorAssignments]);

  const conflicts = useMemo(
    () => validateSupervisorConflicts(supervisorAssignments, schedules),
    [supervisorAssignments, schedules]
  );

  const unassignedCount = useMemo(
    () => matrixSlots.filter((sl) => !sl.assignment?.pengawas1Id).length,
    [matrixSlots]
  );

  const handleAssignCell = async (
    schedule: ExamSchedule,
    room: ExamRoom,
    slotField: 'pengawas1Id' | 'pengawas2Id',
    supervisorId: string
  ) => {
    const existing = supervisorAssignments.find(
      (a) => a.scheduleId === schedule.id && a.roomId === room.id
    );
    let nextAssignments: SupervisorAssignment[];
    if (existing) {
      nextAssignments = supervisorAssignments.map((a) =>
        a.id === existing.id ? { ...a, [slotField]: supervisorId || undefined } : a
      );
    } else {
      nextAssignments = [
        ...supervisorAssignments,
        {
          id: `sa-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          scheduleId: schedule.id,
          roomId: room.id,
          sesi: schedule.sesi,
          [slotField]: supervisorId || undefined,
        },
      ];
    }
    await onSaveSupervisors(supervisors, nextAssignments, rooms);
  };

  const handleAutoDistribute = async () => {
    if (activeSupervisors.length < 2) return;
    const nextAssignments: SupervisorAssignment[] = [];
    let cursor = 0;

    matrixSlots.forEach((sl) => {
      const p1 = activeSupervisors[cursor % activeSupervisors.length];
      cursor++;
      const p2 =
        activeSupervisors.length > 1
          ? activeSupervisors[cursor % activeSupervisors.length]
          : undefined;
      cursor++;

      nextAssignments.push({
        id: sl.assignment?.id || `sa-${sl.schedule.id}-${sl.room.id}`,
        scheduleId: sl.schedule.id,
        roomId: sl.room.id,
        sesi: sl.schedule.sesi,
        pengawas1Id: p1?.id,
        pengawas2Id: p2 && p2.id !== p1?.id ? p2.id : undefined,
      });
    });

    // Also sync default Pengawas on ExamRoom from first schedule slot
    const nextRooms = rooms.map((r) => {
      const firstAsg = nextAssignments.find((a) => a.roomId === r.id);
      return firstAsg
        ? { ...r, pengawas1Id: firstAsg.pengawas1Id, pengawas2Id: firstAsg.pengawas2Id }
        : r;
    });

    await onSaveSupervisors(supervisors, nextAssignments, nextRooms);
    setNotice('Penugasan pengawas otomatis berhasil disebar merata.');
  };

  const handleAddSupervisor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSup.nama) return;
    const created: Supervisor = {
      id: `sp-${Date.now()}`,
      nama: newSup.nama,
      nip: newSup.nip || '',
      asalMadrasah: newSup.asalMadrasah || '-',
      noHp: newSup.noHp || '',
      status: 'Aktif',
    };
    await onSaveSupervisors([...supervisors, created], supervisorAssignments, rooms);
    setNewSup({ nama: '', nip: '', asalMadrasah: '', noHp: '', status: 'Aktif' });
    setNotice(`Pengawas "${created.nama}" ditambahkan.`);
  };

  const handleDeleteSupervisor = async (id: string) => {
    const cleanedAssignments = supervisorAssignments.map((a) => ({
      ...a,
      pengawas1Id: a.pengawas1Id === id ? undefined : a.pengawas1Id,
      pengawas2Id: a.pengawas2Id === id ? undefined : a.pengawas2Id,
    }));
    await onSaveSupervisors(
      supervisors.filter((s) => s.id !== id),
      cleanedAssignments,
      rooms
    );
  };

  const dutyRecap = useMemo(() => {
    return supervisors.map((sp) => {
      const count = supervisorAssignments.filter(
        (a) => a.pengawas1Id === sp.id || a.pengawas2Id === sp.id
      ).length;
      return { supervisor: sp, count };
    });
  }, [supervisors, supervisorAssignments]);

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Manajemen & Penugasan Pengawas Ruang</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Atur Pengawas 1 & 2 per jadwal-ruang dengan validasi benturan waktu otomatis, rekap tugas, dan Surat Tugas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onNavigateToPrint('surat_tugas')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" /> Cetak Surat Tugas
          </button>
          <button
            onClick={() => onNavigateToPrint('daftar_pengawas')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" /> Daftar Hadir Pengawas
          </button>
          {canEdit && activeTab === 'matriks' && (
            <button
              onClick={handleAutoDistribute}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer whitespace-nowrap"
            >
              <Wand2 className="w-3.5 h-3.5" /> Bagi Otomatis
            </button>
          )}
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2 text-xs">
        {[
          { id: 'matriks', label: `Matriks Penugasan (${matrixSlots.length})` },
          { id: 'master', label: `Master Pengawas (${supervisors.length})` },
          { id: 'rekap', label: 'Rekap Tugas & Jadwal Individu' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as typeof activeTab)}
            className={`px-4 py-2 font-bold rounded-lg border cursor-pointer ${
              activeTab === t.id
                ? 'bg-emerald-700 border-emerald-700 text-white'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {notice}
        </div>
      )}

      {(conflicts.length > 0 || unassignedCount > 0) && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-xl text-xs space-y-1">
          {unassignedCount > 0 && (
            <p className="font-semibold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              Masih terdapat {unassignedCount} slot ruang-jadwal yang belum memiliki Pengawas 1.
            </p>
          )}
          {conflicts.map((c, idx) => (
            <p key={idx} className="font-semibold text-red-800 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              {c}
            </p>
          ))}
        </div>
      )}

      {activeTab === 'matriks' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <th className="px-3 py-3">Hari / Tanggal</th>
                <th className="px-3 py-3 text-center">Jam / Sesi</th>
                <th className="px-3 py-3">Mata Pelajaran</th>
                <th className="px-3 py-3">Ruang</th>
                <th className="px-3 py-3">Pengawas 1</th>
                <th className="px-3 py-3">Pengawas 2</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {matrixSlots.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Belum ada slot jadwal dan ruang ujian. Atur Pembagian Ruang dan Jadwal Ujian terlebih dahulu.
                  </td>
                </tr>
              ) : null}
              {matrixSlots.map(({ schedule, room, assignment }) => {
                const sub = subjectMap.get(schedule.mapelId);
                return (
                  <tr key={`${schedule.id}-${room.id}`} className="hover:bg-slate-50/60">
                    <td className="px-3 py-2.5 font-medium text-slate-800">
                      {formatDayAndDate(schedule.tanggal)}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono tabular-nums">
                      {schedule.waktuMulai}–{schedule.waktuSelesai} (S{schedule.sesi})
                    </td>
                    <td className="px-3 py-2.5 font-bold text-slate-900">{sub?.nama || schedule.mapelId}</td>
                    <td className="px-3 py-2.5 font-semibold text-emerald-900">{room.namaRuang}</td>
                    <td className="px-3 py-2">
                      <select
                        disabled={!canEdit}
                        value={assignment?.pengawas1Id || ''}
                        onChange={(e) => handleAssignCell(schedule, room, 'pengawas1Id', e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium"
                      >
                        <option value="">-- Belum Ditentukan --</option>
                        {activeSupervisors.map((sp) => (
                          <option key={sp.id} value={sp.id}>{sp.nama}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        disabled={!canEdit}
                        value={assignment?.pengawas2Id || ''}
                        onChange={(e) => handleAssignCell(schedule, room, 'pengawas2Id', e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-medium"
                      >
                        <option value="">-- Opsional / Kosong --</option>
                        {activeSupervisors.map((sp) => (
                          <option key={sp.id} value={sp.id}>{sp.nama}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'master' && (
        <div className="space-y-5">
          {canEdit && (
            <form onSubmit={handleAddSupervisor} className="bg-white p-5 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-5 gap-3 text-xs items-end">
              <div className="md:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Nama Lengkap & Gelar *</label>
                <input
                  required
                  value={newSup.nama}
                  onChange={(e) => setNewSup({ ...newSup, nama: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">NIP / NUPTK</label>
                <input
                  value={newSup.nip}
                  onChange={(e) => setNewSup({ ...newSup, nip: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Asal Madrasah</label>
                <input
                  value={newSup.asalMadrasah}
                  onChange={(e) => setNewSup({ ...newSup, asalMadrasah: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Pengawas
              </button>
            </form>
          )}

          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <th className="px-3 py-3 w-10 text-center">No</th>
                  <th className="px-3 py-3">Nama Pengawas</th>
                  <th className="px-3 py-3">NIP / NUPTK</th>
                  <th className="px-3 py-3">Asal Madrasah</th>
                  <th className="px-3 py-3">No. HP</th>
                  {canEdit && <th className="px-3 py-3 text-right">Hapus</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {supervisors.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      Belum ada pengawas ujian terdaftar. Tambahkan pengawas melalui formulir di atas.
                    </td>
                  </tr>
                ) : null}
                {supervisors.map((sp, idx) => (
                  <tr key={sp.id}>
                    <td className="px-3 py-2.5 text-center tabular-nums">{idx + 1}</td>
                    <td className="px-3 py-2.5 font-bold text-slate-900">{sp.nama}</td>
                    <td className="px-3 py-2.5 font-mono">{sp.nip || '-'}</td>
                    <td className="px-3 py-2.5">{sp.asalMadrasah}</td>
                    <td className="px-3 py-2.5 font-mono">{sp.noHp || '-'}</td>
                    {canEdit && (
                      <td className="px-3 py-2.5 text-right">
                        <button
                          onClick={() => handleDeleteSupervisor(sp.id)}
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

      {activeTab === 'rekap' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-700" /> Rekap Jumlah Tugas Mengawas
            </h3>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="px-3 py-2 text-left">Nama Pengawas</th>
                  <th className="px-3 py-2 text-center">Total Sesi Tugas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dutyRecap.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-4 py-6 text-center text-slate-400">
                      Belum ada data pengawas untuk direkap.
                    </td>
                  </tr>
                ) : null}
                {dutyRecap.map(({ supervisor, count }) => (
                  <tr key={supervisor.id}>
                    <td className="px-3 py-2 font-semibold text-slate-900">{supervisor.nama}</td>
                    <td className="px-3 py-2 text-center font-bold text-emerald-800 tabular-nums">
                      {count} kali
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900">Jadwal Individu Pengawas</h3>
              <select
                value={selectedTeacherId}
                onChange={(e) => setSelectedTeacherId(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-semibold"
              >
                {supervisors.length === 0 ? (
                  <option value="">-- Belum ada pengawas --</option>
                ) : (
                  supervisors.map((sp) => (
                    <option key={sp.id} value={sp.id}>{sp.nama}</option>
                  ))
                )}
              </select>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {supervisorAssignments
                .filter((a) => a.pengawas1Id === selectedTeacherId || a.pengawas2Id === selectedTeacherId)
                .map((asg) => {
                  const sc = schedules.find((s) => s.id === asg.scheduleId);
                  const sub = sc ? subjectMap.get(sc.mapelId) : undefined;
                  const rm = roomMap.get(asg.roomId);
                  const roleLabel = asg.pengawas1Id === selectedTeacherId ? 'Pengawas 1' : 'Pengawas 2';
                  return (
                    <div key={asg.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex justify-between">
                      <div>
                        <p className="font-bold text-slate-900">{sub?.nama || '-'}</p>
                        <p className="text-slate-600">
                          {sc ? formatDayAndDate(sc.tanggal) : '-'} • {sc?.waktuMulai}–{sc?.waktuSelesai}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-emerald-800">{rm?.namaRuang || asg.roomId}</p>
                        <p className="text-slate-500">{roleLabel}</p>
                      </div>
                    </div>
                  );
                })}
              {supervisorAssignments.filter(
                (a) => a.pengawas1Id === selectedTeacherId || a.pengawas2Id === selectedTeacherId
              ).length === 0 && (
                <p className="py-6 text-center text-slate-400">
                  Belum ada jadwal mengawas yang ditugaskan untuk pengawas ini.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
