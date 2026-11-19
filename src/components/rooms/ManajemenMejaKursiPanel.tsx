import React, { useEffect, useMemo, useState } from 'react';
import {
  Armchair,
  Plus,
  Minus,
  Trash2,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react';
import {
  ExamConfig,
  ExamRoom,
  RoomDistributionConfig,
  Student,
} from '../../types';
import {
  getRoomFacilityTotals,
  normalizeRoomFacilities,
} from '../../utils/seating';

interface ManajemenMejaKursiPanelProps {
  rooms: ExamRoom[];
  students: Student[];
  roomConfig: RoomDistributionConfig;
  examConfig: ExamConfig;
  canEdit: boolean;
  initialRoomId?: string;
  onSaveRooms: (payload: {
    students: Student[];
    rooms: ExamRoom[];
    roomConfig: RoomDistributionConfig;
  }) => Promise<void>;
  onJumpToEditDenah?: (roomId: string) => void;
}

export const ManajemenMejaKursiPanel: React.FC<ManajemenMejaKursiPanelProps> = ({
  rooms,
  students,
  roomConfig,
  examConfig,
  canEdit,
  initialRoomId,
  onSaveRooms,
  onJumpToEditDenah,
}) => {
  const regularRooms = useMemo(
    () => rooms.filter((r) => !r.id.startsWith('room-cadangan')),
    [rooms]
  );

  const [draftRooms, setDraftRooms] = useState<ExamRoom[]>(() =>
    regularRooms.map((r) => normalizeRoomFacilities(r, {}))
  );
  const [selectedRoomId, setSelectedRoomId] = useState<string>(
    initialRoomId && regularRooms.some((r) => r.id === initialRoomId)
      ? initialRoomId
      : regularRooms[0]?.id || ''
  );
  const [confirmClearExtras, setConfirmClearExtras] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    const normalized = regularRooms.map((r) => normalizeRoomFacilities(r, {}));
    setDraftRooms(normalized);
    if (!normalized.some((r) => r.id === selectedRoomId)) {
      setSelectedRoomId(normalized[0]?.id || '');
    }
    setConfirmClearExtras(false);
  }, [regularRooms]);

  useEffect(() => {
    if (initialRoomId && regularRooms.some((r) => r.id === initialRoomId)) {
      setSelectedRoomId(initialRoomId);
    }
  }, [initialRoomId, regularRooms]);

  const activeStudents = useMemo(
    () => students.filter((s) => s.status === 'Aktif'),
    [students]
  );

  const hasSessions =
    examConfig.moda === 'online' ||
    (examConfig.jumlahSesi || 1) > 1 ||
    activeStudents.some((s) => (s.sesi || 1) > 1);

  const getRoomUsage = (roomId: string) => {
    const occupants = activeStudents.filter((s) => s.ruangId === roomId);
    if (hasSessions) {
      // Peak session occupancy determines minimum chairs/desks needed physically
      const bySesi = new Map<number, Student[]>();
      occupants.forEach((s) => {
        const sesi = s.sesi || 1;
        if (!bySesi.has(sesi)) bySesi.set(sesi, []);
        bySesi.get(sesi)!.push(s);
      });
      let peakStudents = 0;
      let peakDesks = 0;
      bySesi.forEach((list) => {
        peakStudents = Math.max(peakStudents, list.length);
        const maxDesk = Math.max(
          Math.ceil(list.length / 2),
          ...list.map((s) => (s.nomorMeja ? Math.ceil(s.nomorMeja / 2) : 0)),
          0
        );
        peakDesks = Math.max(peakDesks, maxDesk);
      });
      return {
        studentCount: peakStudents,
        desksUsed: peakDesks,
      };
    }

    const desksUsed = Math.max(
      Math.ceil(occupants.length / 2),
      ...occupants.map((s) => (s.nomorMeja ? Math.ceil(s.nomorMeja / 2) : 0)),
      0
    );
    return {
      studentCount: occupants.length,
      desksUsed,
    };
  };

  const hasUnsavedChanges = useMemo(() => {
    if (draftRooms.length !== regularRooms.length) return true;
    return draftRooms.some((dr, idx) => {
      const orig = normalizeRoomFacilities(regularRooms[idx], {});
      return (
        dr.mejaAwal !== orig.mejaAwal ||
        dr.kursiAwal !== orig.kursiAwal ||
        dr.mejaTambahan !== orig.mejaTambahan ||
        dr.kursiTambahan !== orig.kursiTambahan ||
        dr.statusFasilitas !== orig.statusFasilitas ||
        (dr.keteranganFasilitas || '') !== (orig.keteranganFasilitas || '')
      );
    });
  }, [draftRooms, regularRooms]);

  const selectedRoom = draftRooms.find((r) => r.id === selectedRoomId) || draftRooms[0];
  const selectedTotals = selectedRoom ? getRoomFacilityTotals(selectedRoom) : null;
  const selectedUsage = selectedRoom ? getRoomUsage(selectedRoom.id) : { studentCount: 0, desksUsed: 0 };

  const patchRoom = (
    roomId: string,
    overrides: Parameters<typeof normalizeRoomFacilities>[1]
  ) => {
    setFeedback(null);
    setConfirmClearExtras(false);
    setDraftRooms((prev) =>
      prev.map((r) => (r.id === roomId ? normalizeRoomFacilities(r, overrides) : r))
    );
  };

  const handleApplyIncidental23Preset = () => {
    if (!selectedRoom || !selectedTotals) return;
    const neededExtraDesks = Math.max(1, 12 - selectedTotals.mejaAwal, selectedTotals.mejaTambahan);
    const neededExtraChairs = Math.max(1, 23 - selectedTotals.kursiAwal, selectedTotals.kursiTambahan);
    patchRoom(selectedRoom.id, {
      mejaTambahan: neededExtraDesks,
      kursiTambahan: neededExtraChairs,
      statusFasilitas: 'INSIDENTAL',
      keteranganFasilitas:
        selectedRoom.keteranganFasilitas?.trim() ||
        'Penambahan 1 meja & 1 kursi khusus untuk kondisi insidental siswa ke-23 (duduk sendiri).',
    });
  };

  const handleRemoveExtrasConfirmed = () => {
    if (!selectedRoom || !selectedTotals) return;
    if (
      selectedUsage.studentCount > selectedTotals.kursiAwal ||
      selectedUsage.desksUsed > selectedTotals.mejaAwal
    ) {
      setFeedback({
        type: 'err',
        text: `Tidak dapat menghapus fasilitas tambahan karena ${selectedRoom.namaRuang} sedang ditempati ${selectedUsage.studentCount} siswa (${selectedUsage.desksUsed} meja). Pindahkan peserta terlebih dahulu melalui Edit Denah atau Re-Generate.`,
      });
      setConfirmClearExtras(false);
      return;
    }
    patchRoom(selectedRoom.id, {
      mejaTambahan: 0,
      kursiTambahan: 0,
      statusFasilitas: 'NORMAL',
      keteranganFasilitas: '',
    });
    setConfirmClearExtras(false);
    setFeedback({
      type: 'ok',
      text: `Fasilitas tambahan pada ${selectedRoom.namaRuang} dikembalikan ke kondisi NORMAL (klik Simpan untuk menerapkan ke database).`,
    });
  };

  const handleSaveAll = async () => {
    if (!canEdit) return;
    setSaving(true);
    setFeedback(null);
    try {
      await onSaveRooms({
        students,
        rooms: draftRooms,
        roomConfig,
      });
      setFeedback({
        type: 'ok',
        text: 'Perubahan meja dan kursi berhasil disimpan ke database tanpa mengubah jumlah ruang.',
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gagal menyimpan fasilitas ruang.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleResetChanges = () => {
    setDraftRooms(regularRooms.map((r) => normalizeRoomFacilities(r, {})));
    setConfirmClearExtras(false);
    setFeedback(null);
  };

  if (draftRooms.length === 0) {
    return (
      <div className="bg-white p-8 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-600 space-y-2">
        <Armchair className="w-8 h-8 text-slate-400 mx-auto" />
        <p className="font-bold text-slate-800">Belum Ada Ruang Ujian yang Terbentuk</p>
        <p>
          Jalankan terlebih dahulu <strong>Generate Pembagian Ruang</strong> pada tab pertama agar daftar ruang ujian tersedia untuk dikelola meja dan kursinya.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top Action Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">MANAJEMEN MEJA DAN KURSI</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola fasilitas meja dan kursi awal, penambahan insidental (maksimal 23 siswa / 12 meja), serta status NORMAL/INSIDENTAL tanpa menambah atau mengurangi jumlah ruang.
          </p>
        </div>

        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            {hasUnsavedChanges && (
              <button
                type="button"
                onClick={handleResetChanges}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Batalkan Perubahan
              </button>
            )}
            <button
              type="button"
              disabled={saving || !hasUnsavedChanges}
              onClick={handleSaveAll}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Menyimpan...' : 'Simpan Perubahan ke Database'}
            </button>
          </div>
        )}
      </div>

      {feedback && (
        <div
          className={`px-4 py-3 rounded-xl border text-xs font-semibold flex items-start gap-2 ${
            feedback.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          {feedback.type === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-700" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-700" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Room Selection & Summary Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Room Selector List */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800">Pilih Ruang Ujian ({draftRooms.length} Ruang)</span>
            <span className="text-[11px] text-slate-500 font-mono tabular-nums">
              {draftRooms.filter((r) => getRoomFacilityTotals(r).statusFasilitas === 'INSIDENTAL').length} Insidental
            </span>
          </div>
          <div className="divide-y divide-slate-100 max-h-[460px] overflow-y-auto">
            {draftRooms.map((room) => {
              const totals = getRoomFacilityTotals(room);
              const usage = getRoomUsage(room.id);
              const isSelected = selectedRoom?.id === room.id;
              const isShortage =
                usage.studentCount > totals.totalKursi || usage.desksUsed > totals.totalMeja;

              return (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => {
                    setSelectedRoomId(room.id);
                    setConfirmClearExtras(false);
                  }}
                  className={`w-full text-left px-4 py-3 transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-emerald-50/70 border-l-4 border-l-emerald-700'
                      : 'hover:bg-slate-50 border-l-4 border-l-transparent'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {room.namaRuang}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                          totals.statusFasilitas === 'INSIDENTAL'
                            ? 'bg-amber-50 border-amber-300 text-amber-900'
                            : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}
                      >
                        {totals.statusFasilitas}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 font-mono tabular-nums mt-1">
                      Meja: {totals.mejaAwal}+{totals.mejaTambahan}={totals.totalMeja} · Kursi: {totals.kursiAwal}+{totals.kursiTambahan}={totals.totalKursi}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className={`text-xs font-mono font-bold tabular-nums ${
                        isShortage ? 'text-red-700' : 'text-slate-800'
                      }`}
                    >
                      {usage.studentCount} / {totals.totalKursi}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {isShortage ? 'Kurang Fasilitas' : `${usage.desksUsed} meja terpakai`}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Room Facility Editor */}
        {selectedRoom && selectedTotals && (
          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    Pengelolaan Fasilitas — {selectedRoom.namaRuang} (Ruang {selectedRoom.nomorRuang})
                  </h3>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                      selectedTotals.statusFasilitas === 'INSIDENTAL'
                        ? 'bg-amber-50 border-amber-300 text-amber-900'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    }`}
                  >
                    {selectedTotals.statusFasilitas}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                  Terisi saat ini: <strong>{selectedUsage.studentCount} siswa</strong> · Membutuhkan{' '}
                  <strong>{selectedUsage.desksUsed} meja</strong>
                </p>
              </div>

              {onJumpToEditDenah && (
                <button
                  type="button"
                  onClick={() => onJumpToEditDenah(selectedRoom.id)}
                  className="text-xs font-semibold text-emerald-800 hover:underline cursor-pointer"
                >
                  Buka di Edit Denah Ruang &rarr;
                </button>
              )}
            </div>

            {/* Facility Comparison Table (Initial vs Addition vs After Addition) */}
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50">
                <p className="text-[11px] font-semibold text-slate-500">Fasilitas Awal</p>
                <p className="text-base font-bold font-mono tabular-nums text-slate-900 mt-1">
                  {selectedTotals.mejaAwal} Meja
                </p>
                <p className="text-xs font-mono tabular-nums text-slate-600">
                  {selectedTotals.kursiAwal} Kursi
                </p>
              </div>

              <div className="p-3.5 rounded-lg border border-amber-200 bg-amber-50/50">
                <p className="text-[11px] font-semibold text-amber-800">Penambahan</p>
                <p className="text-base font-bold font-mono tabular-nums text-amber-950 mt-1">
                  +{selectedTotals.mejaTambahan} Meja
                </p>
                <p className="text-xs font-mono tabular-nums text-amber-900">
                  +{selectedTotals.kursiTambahan} Kursi
                </p>
              </div>

              <div className="p-3.5 rounded-lg border border-emerald-200 bg-emerald-50/60">
                <p className="text-[11px] font-semibold text-emerald-800">Setelah Penambahan</p>
                <p className="text-base font-bold font-mono tabular-nums text-emerald-950 mt-1">
                  {selectedTotals.totalMeja} Meja
                </p>
                <p className="text-xs font-mono tabular-nums text-emerald-900">
                  {selectedTotals.totalKursi} Kursi
                </p>
              </div>
            </div>

            {/* Quick Action Presets & Controls */}
            {canEdit && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                    <span className="text-slate-700">
                      Jika ruang menampung <strong>23 siswa (insidental)</strong>, gunakan preset ini untuk menambah 1 meja dan 1 kursi khusus (12 meja, 23 kursi).
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyIncidental23Preset}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 font-bold text-amber-950 bg-amber-100 border border-amber-300 hover:bg-amber-200 rounded-lg cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" /> Set Insidental 23 Siswa (+1 Meja &amp; +1 Kursi)
                  </button>
                </div>

                {/* Steppers for Meja Tambahan, Kursi Tambahan, and Base Calibration */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 rounded-lg border border-slate-200 space-y-2">
                    <label className="block font-bold text-slate-800">Jumlah Meja Tambahan</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const nextExtra = Math.max(0, selectedTotals.mejaTambahan - 1);
                          if (selectedTotals.mejaAwal + nextExtra < selectedUsage.desksUsed) {
                            setFeedback({
                              type: 'err',
                              text: `Meja tidak bisa dikurangi di bawah kebutuhan aktif (${selectedUsage.desksUsed} meja terpakai).`,
                            });
                            return;
                          }
                          patchRoom(selectedRoom.id, {
                            mejaTambahan: nextExtra,
                            statusFasilitas:
                              nextExtra > 0 || selectedTotals.kursiTambahan > 0 ? 'INSIDENTAL' : 'NORMAL',
                          });
                        }}
                        className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                        aria-label="Kurangi meja tambahan"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        value={selectedTotals.mejaTambahan}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(10, Number(e.target.value) || 0));
                          patchRoom(selectedRoom.id, {
                            mejaTambahan: val,
                            statusFasilitas:
                              val > 0 || selectedTotals.kursiTambahan > 0 ? 'INSIDENTAL' : 'NORMAL',
                          });
                        }}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono text-center font-bold tabular-nums"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          patchRoom(selectedRoom.id, {
                            mejaTambahan: selectedTotals.mejaTambahan + 1,
                            statusFasilitas: 'INSIDENTAL',
                          })
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-2 bg-emerald-700 text-white font-semibold rounded-lg hover:bg-emerald-800 cursor-pointer whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5" /> +1 Meja
                      </button>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-lg border border-slate-200 space-y-2">
                    <label className="block font-bold text-slate-800">Jumlah Kursi Tambahan</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const nextExtra = Math.max(0, selectedTotals.kursiTambahan - 1);
                          if (selectedTotals.kursiAwal + nextExtra < selectedUsage.studentCount) {
                            setFeedback({
                              type: 'err',
                              text: `Kursi tidak bisa dikurangi di bawah jumlah peserta terisi (${selectedUsage.studentCount} siswa).`,
                            });
                            return;
                          }
                          patchRoom(selectedRoom.id, {
                            kursiTambahan: nextExtra,
                            statusFasilitas:
                              selectedTotals.mejaTambahan > 0 || nextExtra > 0 ? 'INSIDENTAL' : 'NORMAL',
                          });
                        }}
                        className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                        aria-label="Kurangi kursi tambahan"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="number"
                        min={0}
                        max={20}
                        value={selectedTotals.kursiTambahan}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(20, Number(e.target.value) || 0));
                          patchRoom(selectedRoom.id, {
                            kursiTambahan: val,
                            statusFasilitas:
                              selectedTotals.mejaTambahan > 0 || val > 0 ? 'INSIDENTAL' : 'NORMAL',
                          });
                        }}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono text-center font-bold tabular-nums"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          patchRoom(selectedRoom.id, {
                            kursiTambahan: selectedTotals.kursiTambahan + 1,
                            statusFasilitas: 'INSIDENTAL',
                          })
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-2 bg-emerald-700 text-white font-semibold rounded-lg hover:bg-emerald-800 cursor-pointer whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5" /> +1 Kursi
                      </button>
                    </div>
                  </div>
                </div>

                {/* Base Facility & Status Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Meja Awal Ruang</label>
                    <input
                      type="number"
                      min={1}
                      max={15}
                      value={selectedTotals.mejaAwal}
                      onChange={(e) =>
                        patchRoom(selectedRoom.id, {
                          mejaAwal: Math.max(1, Number(e.target.value) || 11),
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Kursi Awal Ruang</label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={selectedTotals.kursiAwal}
                      onChange={(e) =>
                        patchRoom(selectedRoom.id, {
                          kursiAwal: Math.max(1, Number(e.target.value) || 22),
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Status Fasilitas</label>
                    <select
                      value={selectedTotals.statusFasilitas}
                      onChange={(e) =>
                        patchRoom(selectedRoom.id, {
                          statusFasilitas: e.target.value as 'NORMAL' | 'INSIDENTAL',
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-bold"
                    >
                      <option value="NORMAL">NORMAL</option>
                      <option value="INSIDENTAL">INSIDENTAL</option>
                    </select>
                  </div>
                </div>

                {/* Reason / Keterangan */}
                <div className="text-xs">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Keterangan / Alasan Penambahan Fasilitas
                  </label>
                  <input
                    type="text"
                    value={selectedRoom.keteranganFasilitas || ''}
                    onChange={(e) =>
                      patchRoom(selectedRoom.id, {
                        keteranganFasilitas: e.target.value,
                      })
                    }
                    placeholder="Contoh: Penambahan 1 meja dan 1 kursi untuk menampung siswa ke-23 agar tidak satu jenjang duduk bersebelahan"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>

                {/* Delete Extra Facilities with Confirmation */}
                {(selectedTotals.mejaTambahan > 0 || selectedTotals.kursiTambahan > 0) && (
                  <div className="pt-2 border-t border-slate-100">
                    {!confirmClearExtras ? (
                      <button
                        type="button"
                        onClick={() => setConfirmClearExtras(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Hapus Meja &amp; Kursi Tambahan yang Tidak Digunakan
                      </button>
                    ) : (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-red-900">
                          Konfirmasi: Hapus seluruh penambahan (+{selectedTotals.mejaTambahan} meja, +{selectedTotals.kursiTambahan} kursi) pada {selectedRoom.namaRuang}?
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setConfirmClearExtras(false)}
                            className="px-3 py-1 bg-white border border-slate-300 rounded font-semibold cursor-pointer"
                          >
                            Batal
                          </button>
                          <button
                            type="button"
                            onClick={handleRemoveExtrasConfirmed}
                            className="px-3 py-1 bg-red-700 text-white rounded font-bold hover:bg-red-800 cursor-pointer"
                          >
                            Ya, Hapus Tambahan
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
