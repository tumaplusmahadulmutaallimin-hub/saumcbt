import React, { useState } from 'react';
import {
  MapPin,
  Lock,
  Unlock,
  Printer,
  CheckCircle2,
  AlertTriangle,
  X,
  Compass,
  Plus,
} from 'lucide-react';
import {
  ExamConfig,
  ExamRoom,
  MadrasahProfile,
  PaperPreset,
  PhysicalClassroom,
  Student,
  Supervisor,
} from '../../types';
import { computeClassRangesInRoom } from '../../utils/seating';
import { DenahLokasiCetak } from '../documents/DenahLokasiCetak';
import { PrintToolbar } from '../documents/PrintToolbar';
import { usePrintLayout } from '../../utils/printLayout';

interface DenahLokasiViewProps {
  profile: MadrasahProfile;
  examConfig: ExamConfig;
  physicalClassrooms: PhysicalClassroom[];
  rooms: ExamRoom[];
  students: Student[];
  supervisors: Supervisor[];
  paperPreset?: PaperPreset;
  canEdit: boolean;
  onSaveDenahLokasi: (next: PhysicalClassroom[], finalized?: boolean) => Promise<void>;
  onSavePreset?: (next: PaperPreset) => Promise<void>;
}

export const DenahLokasiView: React.FC<DenahLokasiViewProps> = ({
  profile,
  examConfig,
  physicalClassrooms,
  rooms,
  students,
  supervisors,
  paperPreset,
  canEdit,
  onSaveDenahLokasi,
  onSavePreset,
}) => {
  const [selectedClassroom, setSelectedClassroom] = useState<PhysicalClassroom | null>(null);
  const [draftNamaKelas, setDraftNamaKelas] = useState<string>('');
  const [draftRoomIds, setDraftRoomIds] = useState<string[]>([]);
  const [draftSessionMap, setDraftSessionMap] = useState<Record<number, string>>({});
  const [confirmEditAfterFinal, setConfirmEditAfterFinal] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [notice, setNotice] = useState('');

  const { layout, setLayout } = usePrintLayout(paperPreset, {
    size: 'A4',
    orientation: 'landscape',
    marginMm: 8,
  });

  const roomMap = new Map(rooms.map((r) => [r.id, r]));
  const supervisorMap = new Map(supervisors.map((s) => [s.id, s]));

  const openModal = (pc: PhysicalClassroom) => {
    setSelectedClassroom(pc);
    setDraftNamaKelas(pc.namaKelas);
    setDraftRoomIds([...pc.assignedRoomIds]);
    setDraftSessionMap({ ...(pc.sessionRoomMap || {}) });
    setConfirmEditAfterFinal(false);
  };

  const handleCreateDefaultGrid = async () => {
    const classNames = examConfig.registeredClasses || [];
    const coords: Array<{ row: 0 | 1; col: 0 | 1 | 2 }> = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 1, col: 0 },
      { row: 1, col: 1 },
      { row: 1, col: 2 },
    ];
    const generated: PhysicalClassroom[] = coords.map((c, idx) => ({
      id: `cls-${Date.now()}-${idx}`,
      namaKelas: classNames[idx] ? `Kelas ${classNames[idx]}` : `Ruang Kelas ${idx + 1}`,
      row: c.row,
      col: c.col,
      assignedRoomIds: rooms[idx] ? [rooms[idx].id] : [],
    }));
    await onSaveDenahLokasi(generated, false);
    setNotice('Tata letak 6 ruang kelas (2×3) berhasil dibuat. Klik kotak kelas untuk menyesuaikan ruang ujian.');
  };

  const toggleDraftRoom = (roomId: string) => {
    setDraftRoomIds((prev) =>
      prev.includes(roomId) ? prev.filter((id) => id !== roomId) : [...prev, roomId]
    );
  };

  const saveModalSelection = async () => {
    if (!selectedClassroom) return;
    if (examConfig.isDenahLokasiFinalized && !confirmEditAfterFinal) {
      setConfirmEditAfterFinal(true);
      return;
    }

    const next = physicalClassrooms.map((pc) =>
      pc.id === selectedClassroom.id
        ? {
            ...pc,
            namaKelas: draftNamaKelas.trim() || pc.namaKelas,
            assignedRoomIds: draftRoomIds,
            sessionRoomMap: examConfig.moda === 'online' ? draftSessionMap : undefined,
          }
        : pc
    );
    await onSaveDenahLokasi(next, examConfig.isDenahLokasiFinalized);
    setSelectedClassroom(null);
    setNotice(`Penetapan ruang untuk ${draftNamaKelas.trim() || selectedClassroom.namaKelas} berhasil disimpan.`);
  };

  const handleToggleFinalize = async () => {
    const nextFinal = !examConfig.isDenahLokasiFinalized;
    await onSaveDenahLokasi(physicalClassrooms, nextFinal);
    setNotice(nextFinal ? 'Denah Lokasi telah difinalisasi.' : 'Status finalisasi Denah Lokasi dibuka kembali.');
  };

  const getCell = (row: 0 | 1, col: 0 | 1 | 2) =>
    physicalClassrooms.find((pc) => pc.row === row && pc.col === col);

  const topRow = [getCell(0, 0), getCell(0, 1), getCell(0, 2)];
  const bottomRow = [getCell(1, 0), getCell(1, 1), getCell(1, 2)];

  if (showPrintPreview) {
    return (
      <div className="space-y-4">
        <PrintToolbar
          title="Pratinjau Cetak Denah Lokasi Ruang Ujian"
          onBack={() => setShowPrintPreview(false)}
          layout={layout}
          onLayoutChange={setLayout}
          onSaveLayout={onSavePreset}
        />
        <div className="overflow-x-auto pb-8 print:overflow-visible print:pb-0">
          <DenahLokasiCetak
            profile={profile}
            examConfig={examConfig}
            physicalClassrooms={physicalClassrooms}
            rooms={rooms}
            students={students}
            supervisors={supervisors}
            paperPreset={layout}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold text-slate-900">Denah Lokasi Fisik & Penetapan Ruang Ujian</h2>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded border ${
                examConfig.isDenahLokasiFinalized
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}
            >
              {examConfig.isDenahLokasiFinalized ? 'Final' : 'Draft'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Klik kotak kelas di bawah untuk menetapkan atau mengubah alokasi Ruang Ujian (hijau = digunakan, abu-abu = tidak digunakan).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <button
              onClick={handleToggleFinalize}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border cursor-pointer whitespace-nowrap ${
                examConfig.isDenahLokasiFinalized
                  ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  : 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
              }`}
            >
              {examConfig.isDenahLokasiFinalized ? (
                <>
                  <Unlock className="w-3.5 h-3.5" /> Buka Finalisasi
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" /> Finalisasi Denah
                </>
              )}
            </button>
          )}
          <button
            onClick={() => setShowPrintPreview(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-4 h-4" /> Pratinjau & Cetak Landscape
          </button>
        </div>
      </div>

      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {notice}
        </div>
      )}

      {/* Interactive Physical Map Matching Section F.2 */}
      {physicalClassrooms.length === 0 ? (
        <div className="bg-white p-8 rounded-xl border border-dashed border-slate-300 text-center space-y-3">
          <MapPin className="w-8 h-8 text-emerald-700 mx-auto" />
          <h3 className="text-sm font-bold text-slate-900">Belum Ada Tata Letak Ruang Kelas Fisik</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Buat tata letak denah lokasi 6 ruang kelas (2 baris × 3 kolom) lalu klik masing-masing kelas untuk menetapkan ruang ujian.
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={handleCreateDefaultGrid}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Buat Tata Letak 6 Ruang Kelas (2×3)
            </button>
          )}
        </div>
      ) : (
      <div className="bg-white p-5 rounded-xl border border-slate-200 overflow-x-auto">
        <div className="min-w-[680px] space-y-3">
          {/* Compass + Top Right RUANG GURU */}
          <div className="grid grid-cols-[44px_1fr_1fr_1fr] gap-3 items-end">
            <div className="flex flex-col items-center justify-center border border-slate-300 rounded-lg py-1.5 bg-slate-50">
              <Compass className="w-4 h-4 text-slate-800" />
              <span className="text-[10px] font-bold">U</span>
            </div>
            <div />
            <div />
            <div className="border-2 border-slate-900 bg-white rounded-lg py-3 px-4 text-center font-bold text-xs tracking-wider uppercase text-slate-900">
              RUANG GURU
            </div>
          </div>

          {/* Left Vertical JALAN + 2 Rows x 3 Columns */}
          <div className="grid grid-cols-[44px_1fr] gap-3">
            <div className="border-2 border-slate-900 bg-slate-100 rounded-lg flex items-center justify-center">
              <span
                className="font-extrabold text-xs tracking-[0.4em] text-slate-700 uppercase"
                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
              >
                JALAN
              </span>
            </div>

            <div className="space-y-3">
              {[topRow, bottomRow].map((rowCells, rIdx) => (
                <div key={rIdx} className="grid grid-cols-3 gap-3">
                  {rowCells.map((pc) => {
                    if (!pc) return <div key={`empty-${rIdx}`} />;
                    const assignedRooms = pc.assignedRoomIds
                      .map((id) => roomMap.get(id))
                      .filter((r): r is ExamRoom => Boolean(r));
                    const isUsed = assignedRooms.length > 0;

                    return (
                      <button
                        key={pc.id}
                        type="button"
                        onClick={() => canEdit && openModal(pc)}
                        className={`text-left border-2 rounded-xl p-4 min-h-[140px] flex flex-col justify-between transition-all ${
                          canEdit ? 'cursor-pointer hover:ring-2 hover:ring-emerald-600/30' : 'cursor-default'
                        } ${
                          isUsed
                            ? 'border-emerald-700 bg-emerald-50 text-emerald-950'
                            : 'border-slate-400 bg-slate-200/70 text-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 w-full border-b border-current/15 pb-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 shrink-0" />
                              <span className="text-xs font-extrabold uppercase">{pc.namaKelas}</span>
                            </div>
                          </div>
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded uppercase ${
                              isUsed ? 'bg-emerald-800 text-white' : 'bg-slate-600 text-white'
                            }`}
                          >
                            {isUsed
                              ? assignedRooms.map((r) => `RUANG ${r.nomorRuang}`).join(', ')
                              : 'Tidak digunakan'}
                          </span>
                        </div>

                        {isUsed ? (
                          <div className="mt-2 space-y-1.5 text-xs">
                            {assignedRooms.map((r) => {
                              const roomStudents = students.filter(
                                (s) => s.ruangId === r.id && s.status === 'Aktif'
                              );
                              const ranges = computeClassRangesInRoom(roomStudents, students);
                              const p1 = r.pengawas1Id ? supervisorMap.get(r.pengawas1Id)?.nama : undefined;
                              const p2 = r.pengawas2Id ? supervisorMap.get(r.pengawas2Id)?.nama : undefined;
                              return (
                                <div key={r.id} className="space-y-0.5">
                                  <p className="font-bold text-emerald-900 tabular-nums">
                                    {r.namaRuang}: {roomStudents.length} Peserta
                                  </p>
                                  <p className="text-[11px] text-emerald-800">
                                    {ranges.map((rg) => `${rg.kelas} (${rg.count})`).join(' • ') || 'Belum ada peserta'}
                                  </p>
                                  {(p1 || p2) && (
                                    <p className="text-[11px] text-slate-700 truncate">
                                      Pengawas: {[p1, p2].filter(Boolean).join(' & ')}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="my-auto text-center text-xs text-slate-500 py-3">
                            {canEdit ? 'Klik untuk tetapkan sebagai Ruang Ujian' : 'Tidak digunakan untuk ujian'}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Color Legend */}
          <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center gap-5 text-xs text-slate-700">
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded border-2 border-emerald-700 bg-emerald-50 inline-block" />
              <span className="font-semibold">Ruang Kelas Digunakan sebagai Ruang Ujian</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded border-2 border-slate-400 bg-slate-200/70 inline-block" />
              <span className="font-semibold">Ruang Kelas Tidak Digunakan</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded border-2 border-slate-900 bg-white inline-block" />
              <span className="font-semibold">Ruang Guru / Jalan Sekolah</span>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Modal PENETAPAN RUANG UJIAN */}
      {selectedClassroom && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">PENETAPAN RUANG UJIAN</h3>
                <p className="text-xs text-slate-500">Lokasi Fisik: {selectedClassroom.namaKelas}</p>
              </div>
              <button
                aria-label="Tutup"
                onClick={() => setSelectedClassroom(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {confirmEditAfterFinal && (
              <div className="bg-amber-50 border border-amber-300 text-amber-900 p-3 rounded-lg text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <span>
                  Denah Lokasi berstatus <strong>Final</strong>. Klik "Konfirmasi & Simpan Perubahan" untuk memperbarui pemetaan ruang ujian.
                </span>
              </div>
            )}

            <div className="text-xs">
              <label className="block font-semibold text-slate-700 mb-1">Nama Ruang Kelas Fisik</label>
              <input
                value={draftNamaKelas}
                onChange={(e) => setDraftNamaKelas(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-900"
              />
            </div>

            <div className="space-y-2 text-xs">
              <p className="font-semibold text-slate-700">
                Pilih Ruang Ujian yang ditempatkan di {selectedClassroom.namaKelas} (kosongkan semua untuk "Tidak digunakan"):
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {rooms.map((r) => {
                  const checked = draftRoomIds.includes(r.id);
                  const count = students.filter((s) => s.ruangId === r.id && s.status === 'Aktif').length;
                  return (
                    <label
                      key={r.id}
                      className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer ${
                        checked ? 'border-emerald-700 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleDraftRoom(r.id)}
                        />
                        <span className="font-bold text-slate-900">{r.namaRuang}</span>
                      </div>
                      <span className="text-slate-600 tabular-nums">{count} peserta</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {examConfig.moda === 'online' && draftRoomIds.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-200 text-xs">
                <p className="font-semibold text-slate-700">Pemetaan Sesi (Opsional — Moda Online):</p>
                <div className="grid grid-cols-2 gap-2">
                  {Array.from({ length: examConfig.jumlahSesi }, (_, i) => i + 1).map((sesi) => (
                    <div key={sesi}>
                      <label className="block text-[11px] text-slate-600 mb-0.5">Sesi {sesi}</label>
                      <select
                        value={draftSessionMap[sesi] || draftRoomIds[0] || ''}
                        onChange={(e) =>
                          setDraftSessionMap((prev) => ({ ...prev, [sesi]: e.target.value }))
                        }
                        className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white"
                      >
                        {draftRoomIds.map((rId) => {
                          const rm = roomMap.get(rId);
                          return (
                            <option key={rId} value={rId}>
                              {rm?.namaRuang || rId}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                onClick={() => setDraftRoomIds([])}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg cursor-pointer"
              >
                Set Tidak Digunakan
              </button>
              <button
                onClick={saveModalSelection}
                className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
              >
                {confirmEditAfterFinal ? 'Konfirmasi & Simpan Perubahan' : 'Simpan Penetapan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
