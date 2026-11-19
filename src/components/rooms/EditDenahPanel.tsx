import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  Undo2,
  Move,
} from 'lucide-react';
import {
  ExamConfig,
  ExamRoom,
  RoomDistributionConfig,
  Student,
} from '../../types';
import {
  getRoomFacilityTotals,
  moveOrSwapStudentSeat,
  normalizeRoomFacilities,
  swapPhysicalDesksInRoom,
  validateRoomDistribution,
} from '../../utils/seating';
import { extractJenjang } from '../../utils/dnpu';

interface EditDenahPanelProps {
  rooms: ExamRoom[];
  students: Student[];
  roomConfig: RoomDistributionConfig;
  examConfig: ExamConfig;
  canEdit: boolean;
  initialRoomId?: string;
  initialSesi?: number;
  onSaveRooms: (payload: {
    students: Student[];
    rooms: ExamRoom[];
    roomConfig: RoomDistributionConfig;
    jumlahSesi?: number;
  }) => Promise<void>;
}

const JENJANG_STYLES: Record<string, { border: string; bg: string; text: string }> = {
  X: { border: 'border-l-4 border-l-emerald-700 border-slate-800', bg: 'bg-emerald-50/50', text: 'text-emerald-900' },
  XI: { border: 'border-l-4 border-l-sky-700 border-slate-800', bg: 'bg-sky-50/60', text: 'text-sky-900' },
  XII: { border: 'border-l-4 border-l-amber-600 border-slate-800', bg: 'bg-amber-50/60', text: 'text-amber-900' },
};

function getJenjangStyle(jenjang: string) {
  return (
    JENJANG_STYLES[jenjang] || {
      border: 'border-l-4 border-l-indigo-700 border-slate-800',
      bg: 'bg-slate-50',
      text: 'text-slate-900',
    }
  );
}

export const EditDenahPanel: React.FC<EditDenahPanelProps> = ({
  rooms,
  students,
  roomConfig,
  examConfig,
  canEdit,
  initialRoomId,
  initialSesi,
  onSaveRooms,
}) => {
  const isOnline = examConfig.moda === 'online';
  const hasSessions =
    isOnline ||
    (examConfig.jumlahSesi || 1) > 1 ||
    students.some((s) => s.status === 'Aktif' && (s.sesi || 1) > 1);
  const totalSesiCount = Math.max(
    1,
    examConfig.jumlahSesi || 1,
    ...students.filter((s) => s.status === 'Aktif').map((s) => s.sesi || 1)
  );
  const regularRooms = useMemo(
    () => rooms.filter((r) => !r.id.startsWith('room-cadangan')),
    [rooms]
  );

  const [draftRooms, setDraftRooms] = useState<ExamRoom[]>(() =>
    regularRooms.map((r) => normalizeRoomFacilities(r, {}))
  );
  const [draftStudents, setDraftStudents] = useState<Student[]>(() =>
    students.map((s) => ({ ...s }))
  );
  const [undoStack, setUndoStack] = useState<Array<{ rooms: ExamRoom[]; students: Student[] }>>([]);

  const [selectedRoomId, setSelectedRoomId] = useState<string>(
    initialRoomId && regularRooms.some((r) => r.id === initialRoomId)
      ? initialRoomId
      : regularRooms[0]?.id || ''
  );
  const [selectedSesi, setSelectedSesi] = useState<number>(
    initialSesi && initialSesi > 0 ? initialSesi : 1
  );
  const [selectedSeatNo, setSelectedSeatNo] = useState<number | null>(null);

  // Swap desks state
  const [deskA, setDeskA] = useState<number>(1);
  const [deskB, setDeskB] = useState<number>(2);

  // Delete extra confirmation
  const [confirmRemoveExtra, setConfirmRemoveExtra] = useState(false);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  useEffect(() => {
    const normalized = regularRooms.map((r) => normalizeRoomFacilities(r, {}));
    setDraftRooms(normalized);
    setDraftStudents(students.map((s) => ({ ...s })));
    setUndoStack([]);
    setSelectedSeatNo(null);
    if (!normalized.some((r) => r.id === selectedRoomId)) {
      setSelectedRoomId(normalized[0]?.id || '');
    }
  }, [regularRooms, students]);

  useEffect(() => {
    if (initialRoomId && regularRooms.some((r) => r.id === initialRoomId)) {
      setSelectedRoomId(initialRoomId);
    }
  }, [initialRoomId, regularRooms]);

  useEffect(() => {
    if (initialSesi && initialSesi > 0) {
      setSelectedSesi(initialSesi);
    }
  }, [initialSesi]);

  const currentRoom = draftRooms.find((r) => r.id === selectedRoomId) || draftRooms[0];
  const facilities = currentRoom ? getRoomFacilityTotals(currentRoom) : null;

  const roomOccupants = useMemo(() => {
    if (!currentRoom) return [];
    return draftStudents
      .filter(
        (s) =>
          s.status === 'Aktif' &&
          s.ruangId === currentRoom.id &&
          (!hasSessions || (s.sesi || 1) === selectedSesi)
      )
      .sort((a, b) => (a.nomorMeja || 999) - (b.nomorMeja || 999));
  }, [draftStudents, currentRoom, hasSessions, selectedSesi]);

  const seatMap = useMemo(() => {
    const map = new Map<number, Student>();
    roomOccupants.forEach((st) => {
      if (st.nomorMeja) map.set(st.nomorMeja, st);
    });
    return map;
  }, [roomOccupants]);

  const jenjangSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    roomOccupants.forEach((s) => {
      const j = s.jenjang || extractJenjang(s.kelas);
      counts[j] = (counts[j] || 0) + 1;
    });
    return counts;
  }, [roomOccupants]);

  const validation = useMemo(
    () => validateRoomDistribution(draftStudents, draftRooms, examConfig.moda, examConfig.jumlahSesi),
    [draftStudents, draftRooms, examConfig.moda, examConfig.jumlahSesi]
  );

  const hasUnsavedChanges = useMemo(() => {
    if (undoStack.length > 0) return true;
    return draftRooms.some((dr, idx) => {
      const orig = regularRooms[idx];
      if (!orig) return true;
      return (
        (dr.jarakAntarMeja || 'standar') !== (orig.jarakAntarMeja || 'standar') ||
        (dr.mejaTambahan || 0) !== (orig.mejaTambahan || 0) ||
        (dr.kursiTambahan || 0) !== (orig.kursiTambahan || 0)
      );
    });
  }, [undoStack.length, draftRooms, regularRooms]);

  const pushUndoSnapshot = () => {
    setUndoStack((prev) => [
      ...prev.slice(-14),
      {
        rooms: draftRooms.map((r) => ({ ...r })),
        students: draftStudents.map((s) => ({ ...s })),
      },
    ]);
  };

  const handleSeatClick = (seatNo: number) => {
    if (!canEdit || !currentRoom) return;
    setErrorMsg('');
    setInfoMsg('');

    const clickedStudent = seatMap.get(seatNo);

    if (selectedSeatNo === null) {
      if (!clickedStudent) {
        setInfoMsg(`Kursi #${String(seatNo).padStart(2, '0')} masih kosong. Klik siswa yang ingin dipindahkan terlebih dahulu.`);
        return;
      }
      setSelectedSeatNo(seatNo);
      setInfoMsg(
        `Terpilih: ${clickedStudent.nama} (${clickedStudent.kelas}) di Kursi #${String(seatNo).padStart(2, '0')}. Klik kursi tujuan atau kursi siswa lain untuk memindahkan/menukar.`
      );
      return;
    }

    if (selectedSeatNo === seatNo) {
      setSelectedSeatNo(null);
      setInfoMsg('');
      return;
    }

    const movingStudent = seatMap.get(selectedSeatNo);
    if (!movingStudent) {
      setSelectedSeatNo(null);
      return;
    }

    const res = moveOrSwapStudentSeat(
      draftStudents,
      draftRooms,
      movingStudent.id,
      currentRoom.id,
      seatNo,
      hasSessions,
      hasSessions ? selectedSesi : undefined
    );

    if (!res.ok) {
      setErrorMsg(res.error || 'Pemindahan kursi melanggar aturan pasangan meja lintas jenjang.');
      setSelectedSeatNo(null);
      return;
    }

    pushUndoSnapshot();
    setDraftStudents(res.updatedStudents);
    setSelectedSeatNo(null);
    setInfoMsg(
      clickedStudent
        ? `Posisi ${movingStudent.nama} (#${selectedSeatNo}) ditukar dengan ${clickedStudent.nama} (#${seatNo}).`
        : `${movingStudent.nama} dipindahkan ke Kursi #${String(seatNo).padStart(2, '0')}.`
    );
  };

  const handleSwapDesks = () => {
    if (!canEdit || !currentRoom || deskA === deskB) return;
    setErrorMsg('');
    pushUndoSnapshot();
    const updated = swapPhysicalDesksInRoom(
      draftStudents,
      currentRoom.id,
      deskA,
      deskB,
      hasSessions,
      hasSessions ? selectedSesi : undefined
    );
    setDraftStudents(updated);
    setSelectedSeatNo(null);
    setInfoMsg(`Posisi Meja ${String(deskA).padStart(2, '0')} dan Meja ${String(deskB).padStart(2, '0')} berhasil ditukar.`);
  };

  const handleAddExtraDeskChair = () => {
    if (!canEdit || !currentRoom || !facilities) return;
    pushUndoSnapshot();
    setErrorMsg('');
    setDraftRooms((prev) =>
      prev.map((r) =>
        r.id === currentRoom.id
          ? normalizeRoomFacilities(r, {
              mejaTambahan: facilities.mejaTambahan + 1,
              kursiTambahan: facilities.kursiTambahan + 1,
              statusFasilitas: 'INSIDENTAL',
              keteranganFasilitas:
                r.keteranganFasilitas || 'Penambahan meja & kursi melalui Edit Denah Ruang',
            })
          : r
      )
    );
    setInfoMsg(`Ditambahkan +1 meja & +1 kursi tambahan pada ${currentRoom.namaRuang}.`);
  };

  const handleRemoveExtraFacility = () => {
    if (!canEdit || !currentRoom || !facilities) return;
    const maxUsedSeat = roomOccupants.reduce((mx, s) => Math.max(mx, s.nomorMeja || 0), 0);
    const maxUsedDesk = Math.ceil(maxUsedSeat / 2);

    if (maxUsedDesk > facilities.mejaAwal || roomOccupants.length > facilities.kursiAwal) {
      setErrorMsg(
        `Meja/kursi tambahan masih digunakan oleh peserta (Meja #${maxUsedDesk}). Pindahkan peserta ke kursi lain sebelum menghapus fasilitas tambahan.`
      );
      setConfirmRemoveExtra(false);
      return;
    }

    pushUndoSnapshot();
    setDraftRooms((prev) =>
      prev.map((r) =>
        r.id === currentRoom.id
          ? normalizeRoomFacilities(r, {
              mejaTambahan: 0,
              kursiTambahan: 0,
              statusFasilitas: 'NORMAL',
              keteranganFasilitas: '',
            })
          : r
      )
    );
    setConfirmRemoveExtra(false);
    setInfoMsg(`Fasilitas tambahan pada ${currentRoom.namaRuang} berhasil dihapus.`);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setDraftRooms(prev.rooms);
    setDraftStudents(prev.students);
    setSelectedSeatNo(null);
    setErrorMsg('');
    setInfoMsg('Perubahan terakhir dibatalkan (Undo).');
  };

  const handleDiscardAll = () => {
    setDraftRooms(regularRooms.map((r) => normalizeRoomFacilities(r, {})));
    setDraftStudents(students.map((s) => ({ ...s })));
    setUndoStack([]);
    setSelectedSeatNo(null);
    setErrorMsg('');
    setInfoMsg('Semua perubahan denah yang belum disimpan dikembalikan ke kondisi awal.');
  };

  const handleSaveChanges = async () => {
    if (!canEdit) return;
    if (!validation.isValid) {
      setErrorMsg(validation.errors[0] || 'Masih terdapat pelanggaran validasi denah.');
      return;
    }
    setSaving(true);
    setErrorMsg('');
    try {
      // Sync incidentalSeatNo when a room has 23 occupants sitting on a solo desk
      const syncedRooms = draftRooms.map((room) => {
        const occ = draftStudents.filter((s) => s.status === 'Aktif' && s.ruangId === room.id);
        if (occ.length === 23) {
          const solo = occ.find((s) => (s.nomorMeja || 0) >= 23) || occ[occ.length - 1];
          return { ...room, incidentalSeatNo: solo?.nomorMeja };
        }
        return { ...room, incidentalSeatNo: undefined };
      });
      await onSaveRooms({
        students: draftStudents,
        rooms: syncedRooms,
        roomConfig,
        jumlahSesi: examConfig.jumlahSesi,
      });
      setUndoStack([]);
      setInfoMsg('Perubahan denah ruang berhasil disimpan ke database.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyimpan perubahan denah.');
    } finally {
      setSaving(false);
    }
  };

  if (!currentRoom || !facilities) {
    return (
      <div className="bg-white p-8 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-600">
        Belum ada ruang ujian yang dapat diedit. Jalankan <strong>Generate Ruang</strong> terlebih dahulu.
      </div>
    );
  }

  // Compute physical desk count shown (12 paired desks when 24 seats occupied, else 11 paired + extra desk 12 for solo #23)
  const highestOccupiedDesk = Math.max(
    ...roomOccupants.map((s) => (s.nomorMeja ? Math.ceil(s.nomorMeja / 2) : 0)),
    0
  );
  const totalDesksToRender = Math.max(11, facilities.totalMeja, highestOccupiedDesk);
  const regularDeskCount = roomOccupants.length === 24 || seatMap.has(24) ? 12 : 11;
  const regularDeskSlots = Array.from({ length: Math.min(regularDeskCount, totalDesksToRender) }, (_, i) => i + 1);
  const extraDeskSlots =
    totalDesksToRender > regularDeskCount
      ? Array.from({ length: totalDesksToRender - regularDeskCount }, (_, i) => i + regularDeskCount + 1)
      : [];

  const spacingGapClass =
    currentRoom.jarakAntarMeja === 'rapat'
      ? 'gap-2'
      : currentRoom.jarakAntarMeja === 'renggang'
        ? 'gap-5'
        : 'gap-3';

  const deskOptions = Array.from({ length: totalDesksToRender }, (_, i) => i + 1);

  const renderSeatTile = (seatNo: number, isIncidentalExtra: boolean) => {
    const st = seatMap.get(seatNo);
    const isSelected = selectedSeatNo === seatNo;
    const jen = st ? st.jenjang || extractJenjang(st.kelas) : '';
    const style = getJenjangStyle(jen);

    return (
      <button
        key={`edit-seat-${seatNo}`}
        type="button"
        disabled={!canEdit}
        onClick={() => handleSeatClick(seatNo)}
        className={`w-full text-left p-2 rounded-lg border transition-all cursor-pointer min-h-[64px] flex flex-col justify-between ${
          isSelected
            ? 'ring-2 ring-emerald-600 border-emerald-700 bg-emerald-50'
            : st
              ? `${style.border} ${style.bg} hover:brightness-95`
              : isIncidentalExtra
                ? 'border-dashed border-amber-400 bg-amber-50/40 hover:bg-amber-50'
                : 'border-dashed border-slate-300 bg-slate-50/60 hover:bg-slate-100'
        }`}
      >
        <div className="flex items-center justify-between gap-1 text-[10px] font-mono">
          <span className="font-bold text-slate-600">#{String(seatNo).padStart(2, '0')}</span>
          {st && <span className={`font-bold ${style.text}`}>{st.kelas}</span>}
        </div>
        {st ? (
          <div className="mt-1">
            <p className="text-[11px] font-bold text-slate-900 leading-tight line-clamp-2">{st.nama}</p>
            <p className="text-[9.5px] font-mono text-slate-500 truncate mt-0.5">
              {st.nomorPeserta || st.nisn}
            </p>
          </div>
        ) : (
          <span className="text-[10px] text-slate-400 font-medium mt-1">
            {isIncidentalExtra ? 'Kursi Tambahan Kosong' : 'Kursi Kosong'}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="space-y-5">
      {/* Top Toolbar */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-900">EDIT DENAH RUANG UJIAN</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Klik dua kursi untuk memindahkan/menukar siswa, tukar posisi meja fisik, atur jarak antarmeja, atau tambah fasilitas tambahan. Aturan wajib pasangan meja lintas jenjang tetap dikunci.
            </p>
          </div>

          {canEdit && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={undoStack.length === 0}
                onClick={handleUndo}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer disabled:opacity-40"
              >
                <Undo2 className="w-3.5 h-3.5" /> Undo
              </button>
              {hasUnsavedChanges && (
                <button
                  type="button"
                  onClick={handleDiscardAll}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Batalkan Edit
                </button>
              )}
              <button
                type="button"
                disabled={saving || !validation.isValid}
                onClick={handleSaveChanges}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Menyimpan...' : 'Simpan Perubahan Denah'}
              </button>
            </div>
          )}
        </div>

        {/* Room, Session, Desk Spacing & Desk Swap Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Pilih Ruang</label>
            <select
              value={currentRoom.id}
              onChange={(e) => {
                setSelectedRoomId(e.target.value);
                setSelectedSeatNo(null);
                setErrorMsg('');
                setConfirmRemoveExtra(false);
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-semibold"
            >
              {draftRooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.namaRuang} ({getRoomFacilityTotals(r).totalMeja} Meja / {getRoomFacilityTotals(r).totalKursi} Kursi)
                </option>
              ))}
            </select>
          </div>

          {hasSessions && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Pilih Sesi</label>
              <select
                value={selectedSesi}
                onChange={(e) => {
                  setSelectedSesi(Number(e.target.value));
                  setSelectedSeatNo(null);
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-semibold"
              >
                {Array.from({ length: totalSesiCount }, (_, i) => i + 1).map((s) => (
                  <option key={s} value={s}>
                    Sesi {s}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Jarak Antar Meja</label>
            <select
              disabled={!canEdit}
              value={currentRoom.jarakAntarMeja || 'standar'}
              onChange={(e) => {
                pushUndoSnapshot();
                const val = e.target.value as 'rapat' | 'standar' | 'renggang';
                setDraftRooms((prev) =>
                  prev.map((r) => (r.id === currentRoom.id ? { ...r, jarakAntarMeja: val } : r))
                );
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-semibold"
            >
              <option value="rapat">Rapat (Kompak)</option>
              <option value="standar">Standar (Proporsional)</option>
              <option value="renggang">Renggang (Lega)</option>
            </select>
          </div>

          {canEdit && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Pindah / Tukar Posisi Meja</label>
              <div className="flex items-center gap-1.5">
                <select
                  value={deskA}
                  onChange={(e) => setDeskA(Number(e.target.value))}
                  className="w-full px-2 py-2 border border-slate-300 rounded-lg bg-white font-mono"
                >
                  {deskOptions.map((d) => (
                    <option key={d} value={d}>M{String(d).padStart(2, '0')}</option>
                  ))}
                </select>
                <span className="text-slate-400">&harr;</span>
                <select
                  value={deskB}
                  onChange={(e) => setDeskB(Number(e.target.value))}
                  className="w-full px-2 py-2 border border-slate-300 rounded-lg bg-white font-mono"
                >
                  {deskOptions.map((d) => (
                    <option key={d} value={d}>M{String(d).padStart(2, '0')}</option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={deskA === deskB}
                  onClick={handleSwapDesks}
                  className="px-2.5 py-2 bg-slate-800 text-white rounded-lg font-semibold hover:bg-slate-900 cursor-pointer disabled:opacity-40 whitespace-nowrap"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Inline Facility Quick Add/Remove */}
        {canEdit && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
            <div className="flex flex-wrap items-center gap-3 text-slate-600 tabular-nums">
              <span>
                Komposisi: <strong>{roomOccupants.length} Siswa</strong> (
                {Object.entries(jenjangSummary)
                  .map(([j, c]) => `${j}: ${c}`)
                  .join(' · ') || 'Kosong'}
                )
              </span>
              <span>
                Fasilitas: <strong className="font-mono">{facilities.totalMeja} Meja</strong> &amp;{' '}
                <strong className="font-mono">{facilities.totalKursi} Kursi</strong> ({facilities.statusFasilitas})
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleAddExtraDeskChair}
                className="inline-flex items-center gap-1 px-3 py-1.5 font-semibold text-emerald-900 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah 1 Meja &amp; Kursi
              </button>

              {(facilities.mejaTambahan > 0 || facilities.kursiTambahan > 0) && (
                !confirmRemoveExtra ? (
                  <button
                    type="button"
                    onClick={() => setConfirmRemoveExtra(true)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 font-semibold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Hapus Tambahan
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 px-2.5 py-1 rounded-lg">
                    <span className="text-red-900 font-semibold">Hapus tambahan?</span>
                    <button
                      type="button"
                      onClick={() => setConfirmRemoveExtra(false)}
                      className="px-2 py-0.5 bg-white border border-slate-300 rounded cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveExtraFacility}
                      className="px-2 py-0.5 bg-red-700 text-white rounded font-bold cursor-pointer"
                    >
                      Ya
                    </button>
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>

      {/* Feedback & Rule Violation Alerts */}
      {errorMsg && (
        <div className="bg-red-50 border border-red-300 text-red-900 px-4 py-3 rounded-xl text-xs font-semibold flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-700" />
          <span>{errorMsg}</span>
        </div>
      )}

      {infoMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2">
          <Move className="w-4 h-4 shrink-0 text-emerald-700" />
          <span>{infoMsg}</span>
        </div>
      )}

      {!validation.isValid && (
        <div className="bg-red-50 border border-red-200 text-red-900 px-4 py-3 rounded-xl text-xs space-y-1">
          <p className="font-bold flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-red-700" /> Validasi Denah Belum Memenuhi Syarat Simpan:
          </p>
          {validation.errors.map((err, i) => (
            <p key={i} className="pl-5">&bull; {err}</p>
          ))}
        </div>
      )}

      {validation.isValid && hasUnsavedChanges && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-700" />
          <span>Seluruh aturan pasangan meja lintas jenjang dan fasilitas valid. Klik &ldquo;Simpan Perubahan Denah&rdquo; untuk menyimpan ke database.</span>
        </div>
      )}

      {/* Interactive Architectural Room Canvas */}
      <div className="bg-white p-5 rounded-xl border-2 border-slate-900 space-y-4">
        {/* Legend */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 text-[11px]">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-bold text-slate-700">Penanda Jenjang:</span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-900">
              <span className="w-3 h-3 rounded-xs bg-emerald-700 inline-block" /> Kelas X
            </span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-sky-900">
              <span className="w-3 h-3 rounded-xs bg-sky-700 inline-block" /> Kelas XI
            </span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-amber-900">
              <span className="w-3 h-3 rounded-xs bg-amber-600 inline-block" /> Kelas XII
            </span>
          </div>
          <span className="font-mono text-slate-500">
            Jarak Meja: {(currentRoom.jarakAntarMeja || 'standar').toUpperCase()}
          </span>
        </div>

        {/* Front Fixtures: Papan Tulis, Pintu Masuk, Meja Pengawas */}
        <div className="space-y-2.5">
          <div className="w-1/2 mx-auto py-1.5 bg-slate-800 text-white text-center font-bold text-[11px] uppercase tracking-widest rounded-xs">
            PAPAN TULIS / DEPAN RUANG
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="border border-slate-800 px-3 py-1 text-[10px] font-bold uppercase bg-slate-50">
              PINTU MASUK
            </div>
            <div className="border-2 border-slate-900 bg-slate-100 px-6 py-1.5 text-center">
              <p className="text-[10px] font-extrabold uppercase text-slate-900">MEJA PENGAWAS</p>
            </div>
            <div className="text-[11px] font-mono text-slate-600 tabular-nums">
              {currentRoom.namaRuang} · {roomOccupants.length}/{facilities.totalKursi} Kursi
            </div>
          </div>
        </div>

        {/* Main 3-Column Desk Grid (11 Regular Desks) with Explicit Circulation Aisles */}
        <div className="overflow-x-auto pb-1">
          <div className={`min-w-[680px] grid grid-cols-[1fr_26px_1fr_26px_1fr] items-start ${spacingGapClass}`}>
            {[0, 1, 2].map((colIdx) => {
              const colDesks = regularDeskSlots.filter((_, idx) => idx % 3 === colIdx);
              return (
                <React.Fragment key={`col-${colIdx}`}>
                  <div className={`flex flex-col ${spacingGapClass}`}>
                    {colDesks.map((deskNo) => {
                      const leftSeat = deskNo * 2 - 1;
                      const rightSeat = deskNo * 2;
                      return (
                        <div
                          key={`desk-${deskNo}`}
                          className="border border-slate-300 rounded-lg p-2 bg-slate-50/40 space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-600 px-0.5">
                            <span>MEJA {String(deskNo).padStart(2, '0')}</span>
                            <span className="text-slate-400">2 Kursi</span>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            {renderSeatTile(leftSeat, false)}
                            {renderSeatTile(rightSeat, false)}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {colIdx < 2 && (
                    <div
                      className="h-full min-h-[260px] flex items-center justify-center border-x border-dashed border-slate-200 bg-slate-50/60 rounded"
                      aria-label="Jalur Sirkulasi"
                    >
                      <span className="text-[9px] font-bold tracking-widest uppercase text-slate-400 [writing-mode:vertical-rl] rotate-180 select-none">
                        Jalur Sirkulasi
                      </span>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Dedicated Zone: TEMPAT DUDUK TAMBAHAN (Desk 12+ / Incidental 23rd student) */}
        {extraDeskSlots.length > 0 && (
          <div className="pt-3 border-t-2 border-dashed border-amber-300 bg-amber-50/40 p-3.5 rounded-lg space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-extrabold uppercase text-amber-950 tracking-wide">
                  TEMPAT DUDUK TAMBAHAN (AREA INSIDENTAL • AMAN JALUR SIRKULASI)
                </p>
                <p className="text-[11px] text-amber-900">
                  Ditempatkan di zona belakang/samping tanpa menghalangi pintu masuk maupun jalur sirkulasi pengawas.
                </p>
              </div>
              <span className="text-[11px] font-mono font-bold text-amber-900">
                +{extraDeskSlots.length} Meja Tambahan
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {extraDeskSlots.map((deskNo) => {
                const leftSeat = deskNo * 2 - 1;
                const rightSeat = deskNo * 2;
                return (
                  <div
                    key={`extra-desk-${deskNo}`}
                    className="border-2 border-amber-400 bg-white rounded-lg p-2.5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono font-bold text-amber-900">
                      <span>MEJA {String(deskNo).padStart(2, '0')} · TAMBAHAN</span>
                      <span>Insidental</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {renderSeatTile(leftSeat, true)}
                      {seatMap.has(rightSeat) ? (
                        renderSeatTile(rightSeat, true)
                      ) : (
                        <button
                          type="button"
                          disabled={!canEdit}
                          onClick={() => handleSeatClick(rightSeat)}
                          className="w-full p-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/50 text-center flex flex-col items-center justify-center min-h-[64px] text-[9.5px] text-slate-400 cursor-pointer"
                        >
                          <span>#{String(rightSeat).padStart(2, '0')}</span>
                          <span>Duduk Sendiri</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
