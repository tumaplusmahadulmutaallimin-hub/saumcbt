import React, { useEffect, useMemo, useState } from 'react';
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
import { extractJenjang } from '../../utils/dnpu';

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
    jumlahSesi?: number;
  }) => Promise<void>;
  initialRoomId?: string;
  initialSesi?: number;
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
  initialSesi,
  onSavePreset,
  onOpenFacilityManager,
}) => {
  const regularRooms = useMemo(
    () => rooms.filter((r) => !r.id.startsWith('room-cadangan')),
    [rooms]
  );
  const activeStudents = useMemo(
    () => students.filter((s) => s.status === 'Aktif'),
    [students]
  );

  const distinctSessions = useMemo(() => {
    const fromStudents = activeStudents.map((s) => s.sesi || 1);
    const maxSesi = Math.max(1, examConfig.jumlahSesi || 1, ...fromStudents);
    return Array.from({ length: maxSesi }, (_, i) => i + 1);
  }, [activeStudents, examConfig.jumlahSesi]);

  const hasSessions =
    examConfig.moda === 'online' ||
    (examConfig.jumlahSesi || 1) > 1 ||
    activeStudents.some((s) => (s.sesi || 1) > 1);

  const [viewMode, setViewMode] = useState<'preview' | 'edit'>('preview');
  const [selectedRoomId, setSelectedRoomId] = useState<string>(
    initialRoomId && initialRoomId !== 'all' ? initialRoomId : regularRooms[0]?.id || 'all'
  );
  const [selectedSesi, setSelectedSesi] = useState<number>(() => {
    if (initialSesi && initialSesi > 0) return initialSesi;
    return hasSessions ? 1 : 0;
  });

  useEffect(() => {
    if (initialRoomId && initialRoomId !== 'all') {
      setSelectedRoomId(initialRoomId);
    }
  }, [initialRoomId]);

  useEffect(() => {
    if (initialSesi && initialSesi > 0) {
      setSelectedSesi(initialSesi);
    } else if (hasSessions && selectedSesi === 0) {
      setSelectedSesi(1);
    } else if (!hasSessions && selectedSesi > 0) {
      setSelectedSesi(0);
    }
  }, [initialSesi, hasSessions]);

  const [swapStudentA, setSwapStudentA] = useState<string>('');
  const [swapStudentB, setSwapStudentB] = useState<string>('');
  const [swapError, setSwapError] = useState<string>('');
  const [showPrintMode, setShowPrintMode] = useState(false);
  const { layout, setLayout } = usePrintLayout(paperPreset, {
    size: 'A4',
    orientation: 'portrait',
    marginMm: 8,
  });

  const currentRoomStudents = useMemo(() => {
    return activeStudents
      .filter(
        (s) =>
          (selectedRoomId === 'all' || s.ruangId === selectedRoomId) &&
          (!hasSessions || selectedSesi === 0 || (s.sesi || 1) === selectedSesi)
      )
      .sort((a, b) => {
        const sA = a.sesi || 1;
        const sB = b.sesi || 1;
        if (sA !== sB) return sA - sB;
        const rA = a.ruangId || '';
        const rB = b.ruangId || '';
        if (rA !== rB) return rA.localeCompare(rB, undefined, { numeric: true });
        return (a.nomorMeja || 999) - (b.nomorMeja || 999);
      });
  }, [activeStudents, selectedRoomId, hasSessions, selectedSesi]);

  const swappableStudents = useMemo(() => {
    if (hasSessions && selectedSesi === 0) return [];
    if (selectedRoomId === 'all') return [];
    return currentRoomStudents;
  }, [hasSessions, selectedSesi, selectedRoomId, currentRoomStudents]);

  const roomNameMap = useMemo(
    () => new Map(regularRooms.map((r) => [r.id, r.namaRuang])),
    [regularRooms]
  );

  const groupedListBySession = useMemo(() => {
    if (!hasSessions || selectedSesi > 0) {
      return [
        {
          sesi: selectedSesi > 0 ? selectedSesi : 0,
          students: currentRoomStudents,
        },
      ];
    }
    return distinctSessions.map((sNum) => ({
      sesi: sNum,
      students: currentRoomStudents.filter((st) => (st.sesi || 1) === sNum),
    }));
  }, [hasSessions, selectedSesi, currentRoomStudents, distinctSessions]);

  const handleSwapSeats = async () => {
    setSwapError('');
    if (!swapStudentA || !swapStudentB || swapStudentA === swapStudentB) return;
    const stA = students.find((s) => s.id === swapStudentA);
    const stB = students.find((s) => s.id === swapStudentB);
    if (!stA || !stB || !stB.ruangId || !stB.nomorMeja) return;

    const res = moveOrSwapStudentSeat(
      students,
      rooms,
      stA.id,
      stB.ruangId,
      stB.nomorMeja,
      hasSessions,
      hasSessions ? stB.sesi || 1 : undefined
    );

    if (!res.ok) {
      setSwapError(res.error || 'Pertukaran kursi ditolak karena melanggar aturan pasangan meja lintas jenjang.');
      return;
    }

    await onSaveRooms({
      students: res.updatedStudents,
      rooms,
      roomConfig,
      jumlahSesi: examConfig.jumlahSesi,
    });
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
              Denah Tempat Duduk Peserta (Per Sesi &bull; Silang Jenjang)
            </h2>
            <p className="text-xs text-slate-500">
              Visualisasi denah 1 ruang per sesi lengkap dengan identitas jenjang berbeda, jalur sirkulasi, serta tempat duduk tambahan (#23) maupun 12 meja berpasangan (#24).
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
            {/* Mandatory Session Filter Tabs (Section 6 & 7) */}
            {hasSessions && (
              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-600 mr-1">Filter Sesi:</span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSesi(0);
                    setSwapStudentA('');
                    setSwapStudentB('');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    selectedSesi === 0
                      ? 'bg-emerald-800 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  SEMUA SESI ({activeStudents.length})
                </button>
                {distinctSessions.map((sNum) => {
                  const sCount = activeStudents.filter((st) => (st.sesi || 1) === sNum).length;
                  return (
                    <button
                      key={`denah-sesi-tab-${sNum}`}
                      type="button"
                      onClick={() => {
                        setSelectedSesi(sNum);
                        setSwapStudentA('');
                        setSwapStudentB('');
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                        selectedSesi === sNum
                          ? 'bg-emerald-800 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      SESI {sNum} ({sCount})
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 text-xs pt-2 border-t border-slate-100">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-700">Ruang:</span>
                <select
                  value={selectedRoomId}
                  onChange={(e) => {
                    setSelectedRoomId(e.target.value);
                    setSwapStudentA('');
                    setSwapStudentB('');
                    setSwapError('');
                  }}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-semibold"
                >
                  <option value="all">Semua Ruang ({regularRooms.length})</option>
                  {regularRooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.namaRuang}
                    </option>
                  ))}
                </select>
              </div>

              {canEdit && swappableStudents.length >= 2 && (
                <div className="flex flex-wrap items-center gap-2 ml-auto">
                  <select
                    value={swapStudentA}
                    onChange={(e) => {
                      setSwapStudentA(e.target.value);
                      setSwapError('');
                    }}
                    className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white max-w-[170px]"
                  >
                    <option value="">Tukar Kursi Peserta 1...</option>
                    {swappableStudents.map((s) => (
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
                    className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white max-w-[170px]"
                  >
                    <option value="">Dengan Peserta 2...</option>
                    {swappableStudents.map((s) => (
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
          initialSesi={selectedSesi > 0 ? selectedSesi : undefined}
          onSaveRooms={onSaveRooms}
        />
      ) : (
        <div className="space-y-6">
          <div className="overflow-x-auto pb-4 print:overflow-visible print:pb-0">
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

          {/* Filtered Participant List synced strictly with selected Room & Session */}
          <div className="no-print bg-white p-5 rounded-xl border border-slate-200 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Daftar Peserta Sesuai Filter Denah
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedRoomId === 'all' ? 'Semua Ruang' : roomNameMap.get(selectedRoomId) || selectedRoomId}
                  {hasSessions
                    ? selectedSesi > 0
                      ? ` • Sesi ${selectedSesi}`
                      : ' • Semua Sesi (Dipisahkan Per Sesi)'
                    : ''}
                  {' · '}
                  <strong className="font-mono">{currentRoomStudents.length} Peserta</strong>
                </p>
              </div>
            </div>

            {groupedListBySession.map((grp) => (
              <div key={`denah-list-s${grp.sesi}`} className="space-y-2">
                {grp.sesi > 0 && (
                  <div className="text-xs font-extrabold text-emerald-900 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center justify-between">
                    <span>SESI {grp.sesi}</span>
                    <span className="font-mono tabular-nums">{grp.students.length} Peserta</span>
                  </div>
                )}
                <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                        <th className="px-3 py-2 text-center w-14">Kursi</th>
                        <th className="px-3 py-2 text-center w-14">Meja</th>
                        <th className="px-3 py-2 text-left">Ruang</th>
                        <th className="px-3 py-2 text-left">No. Peserta</th>
                        <th className="px-3 py-2 text-left">Nama Peserta</th>
                        <th className="px-3 py-2 text-center">Kelas</th>
                        <th className="px-3 py-2 text-center">Jenjang</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {grp.students.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-5 text-center text-slate-400">
                            Tidak ada peserta pada filter ini.
                          </td>
                        </tr>
                      ) : (
                        grp.students.map((st) => (
                          <tr key={st.id}>
                            <td className="px-3 py-1.5 text-center font-mono font-bold tabular-nums">
                              #{String(st.nomorMeja || '-').padStart(2, '0')}
                            </td>
                            <td className="px-3 py-1.5 text-center font-mono text-slate-600 tabular-nums">
                              M{String(st.nomorMeja ? Math.ceil(st.nomorMeja / 2) : '-').padStart(2, '0')}
                            </td>
                            <td className="px-3 py-1.5 font-semibold text-slate-700">
                              {st.ruangId ? roomNameMap.get(st.ruangId) || st.ruangId : '-'}
                            </td>
                            <td className="px-3 py-1.5 font-mono text-slate-700">
                              {st.nomorPeserta || '-'}
                            </td>
                            <td className="px-3 py-1.5 font-semibold text-slate-900">{st.nama}</td>
                            <td className="px-3 py-1.5 text-center font-semibold">{st.kelas}</td>
                            <td className="px-3 py-1.5 text-center font-bold">
                              {st.jenjang || extractJenjang(st.kelas)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
