import React, { useState } from 'react';
import { Printer, ArrowRightLeft, Sliders, Armchair, Eye, AlertTriangle } from 'lucide-react';
import {
  ExamConfig,
  ExamRoom,
  MadrasahProfile,
  PaperPreset,
  RoomDistributionConfig,
  Student,
  Supervisor,
} from '../../types';
import { DenahRuangCetak } from '../documents/DenahRuangCetak';
import { PrintToolbar } from '../documents/PrintToolbar';
import { EditDenahPanel } from '../rooms/EditDenahPanel';
import { usePrintLayout } from '../../utils/printLayout';
import { moveOrSwapStudentSeat } from '../../utils/seating';

interface DenahRuangViewProps {
  profile: MadrasahProfile;
  examConfig: ExamConfig;
  rooms: ExamRoom[];
  students: Student[];
  supervisors: Supervisor[];
  roomConfig: RoomDistributionConfig;
  paperPreset?: PaperPreset;
  canEdit: boolean;
  onSaveRooms: (payload: {
    students: Student[];
    rooms: ExamRoom[];
    roomConfig: RoomDistributionConfig;
  }) => Promise<void>;
  initialRoomId?: string;
  onSavePreset?: (next: PaperPreset) => Promise<void>;
  onOpenFacilityManager?: (roomId?: string) => void;
}

export const DenahRuangView: React.FC<DenahRuangViewProps> = ({
  profile,
  examConfig,
  rooms,
  students,
  supervisors,
  roomConfig,
  paperPreset,
  canEdit,
  onSaveRooms,
  initialRoomId,
  onSavePreset,
  onOpenFacilityManager,
}) => {
  const regularRooms = rooms.filter((r) => !r.id.startsWith('room-cadangan'));
  const [viewMode, setViewMode] = useState<'preview' | 'edit'>('preview');
  const [selectedRoomId, setSelectedRoomId] = useState<string>(
    initialRoomId && initialRoomId !== 'all' ? initialRoomId : regularRooms[0]?.id || 'all'
  );
  const [selectedSesi, setSelectedSesi] = useState<number>(examConfig.moda === 'online' ? 1 : 0);
  const [swapStudentA, setSwapStudentA] = useState<string>('');
  const [swapStudentB, setSwapStudentB] = useState<string>('');
  const [swapError, setSwapError] = useState<string>('');
  const [showPrintMode, setShowPrintMode] = useState(false);
  const { layout, setLayout } = usePrintLayout(paperPreset, {
    size: 'A4',
    orientation: 'portrait',
    marginMm: 8,
  });

  const currentRoomStudents = students
    .filter(
      (s) =>
        s.status === 'Aktif' &&
        (selectedRoomId === 'all' || s.ruangId === selectedRoomId) &&
        (examConfig.moda !== 'online' || selectedSesi === 0 || s.sesi === selectedSesi)
    )
    .sort((a, b) => (a.nomorMeja || 999) - (b.nomorMeja || 999));

  const handleSwapSeats = async () => {
    setSwapError('');
    if (!swapStudentA || !swapStudentB || swapStudentA === swapStudentB) return;
    const stA = students.find((s) => s.id === swapStudentA);
    const stB = students.find((s) => s.id === swapStudentB);
    if (!stA || !stB || !stB.ruangId || !stB.nomorMeja) return;

    const isOnline = examConfig.moda === 'online';
    const res = moveOrSwapStudentSeat(
      students,
      rooms,
      stA.id,
      stB.ruangId,
      stB.nomorMeja,
      isOnline,
      isOnline ? stB.sesi || 1 : undefined
    );

    if (!res.ok) {
      setSwapError(res.error || 'Pertukaran kursi ditolak karena melanggar aturan pasangan meja lintas jenjang.');
      return;
    }

    await onSaveRooms({ students: res.updatedStudents, rooms, roomConfig });
    setSwapStudentA('');
    setSwapStudentB('');
  };

  if (showPrintMode) {
    return (
      <div>
        <PrintToolbar
          title="Cetak Denah Tempat Duduk (Portrait 6 Kolom)"
          onBack={() => setShowPrintMode(false)}
          layout={layout}
          onLayoutChange={setLayout}
          onSaveLayout={onSavePreset}
        />
        <div className="overflow-x-auto pb-8 print:overflow-visible print:pb-0">
          <DenahRuangCetak
            profile={profile}
            examConfig={examConfig}
            rooms={rooms}
            students={students}
            supervisors={supervisors}
            selectedRoomId={selectedRoomId}
            selectedSesi={selectedSesi > 0 ? selectedSesi : undefined}
            paperPreset={layout}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="no-print bg-white p-5 rounded-xl border border-slate-200 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Denah Tempat Duduk Peserta (Silang Jenjang • Jalur Sirkulasi &amp; Edit Denah)
            </h2>
            <p className="text-xs text-slate-500">
              Visualisasi denah 1 ruang per halaman lengkap dengan identitas jenjang berbeda, jalur sirkulasi, serta tempat duduk tambahan insidental (#23).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
              <button
                type="button"
                onClick={() => setViewMode('preview')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md cursor-pointer ${
                  viewMode === 'preview' ? 'bg-white text-emerald-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                <Eye className="w-3.5 h-3.5" /> Pratinjau Denah
              </button>
              <button
                type="button"
                onClick={() => setViewMode('edit')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md cursor-pointer ${
                  viewMode === 'edit' ? 'bg-white text-emerald-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" /> Edit Denah Ruang
              </button>
            </div>

            {onOpenFacilityManager && (
              <button
                type="button"
                onClick={() =>
                  onOpenFacilityManager(selectedRoomId !== 'all' ? selectedRoomId : regularRooms[0]?.id)
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer whitespace-nowrap"
              >
                <Armchair className="w-3.5 h-3.5 text-amber-700" /> Manajemen Meja &amp; Kursi
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowPrintMode(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-4 h-4" /> Mode Cetak / Simpan PDF
            </button>
          </div>
        </div>

        {viewMode === 'preview' && (
          <>
            <div className="flex flex-wrap items-center gap-3 text-xs pt-2 border-t border-slate-100">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-700">Ruang:</span>
                <select
                  value={selectedRoomId}
                  onChange={(e) => {
                    setSelectedRoomId(e.target.value);
                    setSwapError('');
                  }}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-semibold"
                >
                  <option value="all">Semua Ruang ({regularRooms.length})</option>
                  {regularRooms.map((r) => (
                    <option key={r.id} value={r.id}>{r.namaRuang}</option>
                  ))}
                </select>
              </div>

              {examConfig.moda === 'online' && (
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-700">Sesi:</span>
                  <select
                    value={selectedSesi}
                    onChange={(e) => setSelectedSesi(Number(e.target.value))}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-semibold"
                  >
                    <option value={0}>Semua Sesi</option>
                    {Array.from({ length: examConfig.jumlahSesi }, (_, i) => i + 1).map((s) => (
                      <option key={s} value={s}>Sesi {s}</option>
                    ))}
                  </select>
                </div>
              )}

              {canEdit && currentRoomStudents.length >= 2 && (
                <div className="flex flex-wrap items-center gap-2 ml-auto">
                  <select
                    value={swapStudentA}
                    onChange={(e) => {
                      setSwapStudentA(e.target.value);
                      setSwapError('');
                    }}
                    className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white max-w-[160px]"
                  >
                    <option value="">Tukar Kursi Peserta 1...</option>
                    {currentRoomStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        #{s.nomorMeja} {s.nama} ({s.kelas})
                      </option>
                    ))}
                  </select>
                  <select
                    value={swapStudentB}
                    onChange={(e) => {
                      setSwapStudentB(e.target.value);
                      setSwapError('');
                    }}
                    className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white max-w-[160px]"
                  >
                    <option value="">Dengan Peserta 2...</option>
                    {currentRoomStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        #{s.nomorMeja} {s.nama} ({s.kelas})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleSwapSeats}
                    disabled={!swapStudentA || !swapStudentB || swapStudentA === swapStudentB}
                    className="inline-flex items-center gap-1 px-3 py-1.5 font-semibold bg-slate-800 text-white rounded-lg cursor-pointer disabled:opacity-40 whitespace-nowrap"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" /> Tukar Posisi
                  </button>
                </div>
              )}
            </div>

            {swapError && (
              <div className="bg-red-50 border border-red-200 text-red-900 px-3.5 py-2.5 rounded-lg text-xs font-semibold flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-700" />
                <span>{swapError}</span>
              </div>
            )}
          </>
        )}
      </div>

      {viewMode === 'edit' ? (
        <EditDenahPanel
          rooms={rooms}
          students={students}
          roomConfig={roomConfig}
          examConfig={examConfig}
          canEdit={canEdit}
          initialRoomId={selectedRoomId !== 'all' ? selectedRoomId : regularRooms[0]?.id}
          onSaveRooms={onSaveRooms}
        />
      ) : (
        <div className="overflow-x-auto pb-8 print:overflow-visible print:pb-0">
          <DenahRuangCetak
            profile={profile}
            examConfig={examConfig}
            rooms={rooms}
            students={students}
            supervisors={supervisors}
            selectedRoomId={selectedRoomId}
            selectedSesi={selectedSesi > 0 ? selectedSesi : undefined}
            paperPreset={layout}
          />
        </div>
      )}
    </div>
  );
};
