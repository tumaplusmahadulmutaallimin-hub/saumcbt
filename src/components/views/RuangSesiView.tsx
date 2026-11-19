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
} from 'lucide-react';
import {
  ExamConfig,
  ExamRoom,
  RoomDistributionConfig,
  Student,
} from '../../types';
import {
  analyzeRoomParity,
  balanceOddRooms,
  distributeRoomsCrossJenjang,
  distributeSessions,
  moveOddStudentsToReserveRoom,
} from '../../utils/seating';
import { extractJenjang } from '../../utils/dnpu';

interface RuangSesiViewProps {
  students: Student[];
  rooms: ExamRoom[];
  roomConfig: RoomDistributionConfig;
  examConfig: ExamConfig;
  canEdit: boolean;
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
  onSaveRooms,
  onNavigateToDenah,
}) => {
  const [localConfig, setLocalConfig] = useState<RoomDistributionConfig>(() => ({
    ...roomConfig,
    jumlahRuangManual: roomConfig.jumlahRuangManual || examConfig.jumlahRuang || rooms.length || 1,
  }));
  const [warnings, setWarnings] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [movingStudent, setMovingStudent] = useState<Student | null>(null);
  const [targetRoomId, setTargetRoomId] = useState('');
  const [targetSesi, setTargetSesi] = useState<number>(1);

  useEffect(() => {
    setLocalConfig({
      ...roomConfig,
      jumlahRuangManual: roomConfig.jumlahRuangManual || examConfig.jumlahRuang || rooms.length || 1,
    });
  }, [roomConfig, examConfig.jumlahRuang, rooms.length]);

  const isOnline = examConfig.moda === 'online';
  const activeStudents = students.filter((s) => s.status === 'Aktif');
  const anyRoomLocked = rooms.some((r) => r.isLocked);

  const parityAnalysis = useMemo(
    () => analyzeRoomParity(students, rooms, examConfig.moda, examConfig.jumlahSesi),
    [students, rooms, examConfig.moda, examConfig.jumlahSesi]
  );

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

  const handleGenerateRooms = async () => {
    if (anyRoomLocked) {
      setWarnings(['Sebagian ruang dikunci. Buka kunci ruang terlebih dahulu sebelum membagi ulang otomatis.']);
      return;
    }
    if (activeStudents.length === 0) {
      setWarnings(['Belum ada peserta aktif di DNPU. Tambahkan peserta di Data DNPU terlebih dahulu.']);
      return;
    }
    const cleanCfg: RoomDistributionConfig = {
      ...localConfig,
      kapasitasPerRuang: Math.min(24, Math.max(1, localConfig.kapasitasPerRuang || 22)),
    };
    const res = distributeRoomsCrossJenjang(
      students,
      rooms,
      cleanCfg,
      examConfig.moda,
      Math.random,
      { examJumlahRuang: examConfig.jumlahRuang }
    );
    setWarnings(res.warnings);
    const savedCfg = { ...cleanCfg, jumlahRuangManual: res.updatedRooms.length };
    setLocalConfig(savedCfg);
    await onSaveRooms({
      students: res.updatedStudents,
      rooms: res.updatedRooms,
      roomConfig: savedCfg,
    });
    setNotice(
      `Pembagian ${res.updatedRooms.length} ruang berhasil dijalankan (maks ${cleanCfg.kapasitasPerRuang} kursi/ruang, ruang bawah prioritas 2 jenjang & campuran 3 jenjang di ruang akhir).`
    );
  };

  const handleAutoBalanceOddRooms = async () => {
    const res = balanceOddRooms(students, rooms, examConfig.moda, examConfig.jumlahSesi);
    if (res.movedCount === 0) {
      setWarnings(['Tidak ada pasangan ruang ganjil yang dapat diseimbangkan langsung tanpa menambah Ruang Cadangan.']);
      return;
    }
    setWarnings([]);
    await onSaveRooms({
      students: res.updatedStudents,
      rooms,
      roomConfig: localConfig,
    });
    setNotice(`${res.movedCount} peserta dipindahkan antar-ruang ganjil agar pasangan meja (1 meja = 2 kursi) seimbang dan genap.`);
  };

  const handleMoveOddToReserveRoom = async () => {
    const res = moveOddStudentsToReserveRoom(students, rooms, examConfig.moda, examConfig.jumlahSesi);
    if (res.movedCount === 0) return;
    setWarnings([]);
    const savedCfg = { ...localConfig, jumlahRuangManual: res.updatedRooms.length };
    setLocalConfig(savedCfg);
    await onSaveRooms({
      students: res.updatedStudents,
      rooms: res.updatedRooms,
      roomConfig: savedCfg,
    });
    setNotice(
      `${res.movedCount} siswa kursi ganjil ditempatkan ke Ruang Cadangan agar ruang reguler terisi genap (1 meja = 2 kursi berbeda jenjang).`
    );
  };

  const handleToggleLock = async (roomId: string) => {
    const nextRooms = rooms.map((r) => (r.id === roomId ? { ...r, isLocked: !r.isLocked } : r));
    await onSaveRooms({ students, rooms: nextRooms, roomConfig: localConfig });
  };

  const handleMoveStudent = async () => {
    if (!movingStudent || !targetRoomId) return;
    const roomOccupants = students.filter(
      (s) => s.ruangId === targetRoomId && s.status === 'Aktif' && s.id !== movingStudent.id && (!isOnline || s.sesi === targetSesi)
    );
    const targetRoom = rooms.find((r) => r.id === targetRoomId);
    const maxExistingSeat = roomOccupants.reduce(
      (mx, s) => Math.max(mx, s.nomorMeja || 0),
      0
    );
    const nextSeat = Math.max(roomOccupants.length + 1, maxExistingSeat + 1);

    const updated = students.map((s) =>
      s.id === movingStudent.id
        ? {
            ...s,
            ruangId: targetRoomId,
            nomorMeja: nextSeat,
            sesi: isOnline ? targetSesi : s.sesi,
          }
        : s
    );

    if (targetRoom && roomOccupants.length + 1 > targetRoom.kapasitas) {
      setWarnings([`${targetRoom.namaRuang} melebihi kapasitas (${roomOccupants.length + 1} / ${targetRoom.kapasitas}).`]);
    }
    await onSaveRooms({ students: updated, rooms, roomConfig: localConfig });
    setMovingStudent(null);
    setNotice(`Peserta ${movingStudent.nama} dipindahkan ke ${targetRoom?.namaRuang || targetRoomId}.`);
  };

  return (
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
                onClick={handleGenerateSessions}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-lg cursor-pointer whitespace-nowrap"
              >
                <Shuffle className="w-3.5 h-3.5" /> Acak & Bagi Sesi Merata
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {sessionStats.map(([sesiNum, stat]) => (
              <div key={sesiNum} className="p-3.5 rounded-lg border border-slate-200 bg-slate-50">
                <p className="text-xs font-bold text-slate-800">Sesi {sesiNum}</p>
                <p className="text-xl font-bold text-emerald-800 tabular-nums mt-1">{stat.count} Peserta</p>
                <p className="text-[11px] text-slate-600 mt-1">
                  {Object.entries(stat.jenjang)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(' • ') || 'Belum ada peserta'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Room Distribution Config & Generator */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-900">Pembagian Ruang Ujian (Silang Jenjang • Hingga 12 Meja / 24 Kursi)</h2>
            <p className="text-xs text-slate-500">
              Setiap ruang diprioritaskan berisi 2 jenjang berbeda (campuran 3 jenjang diletakkan di ruang akhir). Meja 2 kursi selalu diisi jenjang berbeda; jika satu jenjang lebih banyak, siswa sisa duduk sendiri di meja tambahan hingga 12 meja.
            </p>
          </div>
          {canEdit && (
            <button
              onClick={handleGenerateRooms}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer whitespace-nowrap"
            >
              <DoorClosed className="w-3.5 h-3.5" /> Generate Pembagian Ruang
            </button>
          )}
        </div>

        {notice && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> {notice}
          </div>
        )}

        {warnings.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-lg text-xs space-y-1">
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
            <label className="block font-semibold text-slate-700 mb-1">Kapasitas Maksimal Per Ruang (Maks 24 / 12 Meja)</label>
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
            <label className="block font-semibold text-slate-700 mb-1">Jumlah Ruang</label>
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

      {/* Automatic Validation & Reserve Room Recommendation for Odd Rooms */}
      {(parityAnalysis.nonReserveOddEntries.length > 0 ||
        parityAnalysis.sameJenjangDeskConflicts.length > 0) && (
        <div
          data-testid="odd-room-validation-banner"
          className="bg-amber-50 border border-amber-300 text-amber-950 p-4 rounded-xl space-y-2.5 text-xs"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 max-w-3xl">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                {parityAnalysis.nonReserveOddEntries.length > 0 && (
                  <>
                    <p className="font-bold text-amber-950">{parityAnalysis.headline}</p>
                    <p className="text-amber-900">{parityAnalysis.suggestionText}</p>
                  </>
                )}
                {parityAnalysis.sameJenjangDeskConflicts.length > 0 && (
                  <p className="font-semibold text-red-800">
                    Catatan meja: Terdapat {parityAnalysis.sameJenjangDeskConflicts.length} meja fisik dengan 2 siswa berjenjang sama (akibat dominasi satu jenjang di ruangan tersebut).
                  </p>
                )}
              </div>
            </div>

            {canEdit && parityAnalysis.nonReserveOddEntries.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {parityAnalysis.canAutoBalancePairs.length > 0 && (
                  <button
                    type="button"
                    onClick={handleAutoBalanceOddRooms}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-950 bg-white border border-amber-400 hover:bg-amber-100 rounded-lg cursor-pointer whitespace-nowrap"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" /> Seimbangkan Ruang Ganjil
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleMoveOddToReserveRoom}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-amber-700 hover:bg-amber-800 rounded-lg cursor-pointer whitespace-nowrap"
                >
                  <DoorClosed className="w-3.5 h-3.5" /> Pindahkan ke Ruang Cadangan
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {parityAnalysis.soloDeskEntries.length > 0 &&
        parityAnalysis.sameJenjangDeskConflicts.length === 0 && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-3 rounded-xl text-xs flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">
                Semua Meja Terjaga Silang Jenjang (0 Meja Satu Jenjang)
              </p>
              <p className="text-emerald-800 mt-0.5">
                Terdapat <strong>{parityAnalysis.soloDeskEntries.length} meja</strong> yang diset duduk sendiri (1 peserta/meja) untuk menampung selisih jenjang agar tidak ada 2 siswa berjenjang sama duduk bersebelahan.
              </p>
            </div>
          </div>
        )}

      {/* Room Cards Summary */}
      {rooms.length === 0 ? (
        <div className="bg-white p-8 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-500">
          Belum ada ruang ujian yang terbentuk. Masukkan peserta di <strong>Data DNPU</strong> lalu klik{' '}
          <strong>Generate Pembagian Ruang</strong> untuk membuat daftar ruang otomatis.
        </div>
      ) : null}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rooms.map((room) => {
          const roomStudents = activeStudents.filter((s) => s.ruangId === room.id);
          const jenjangMix: Record<string, number> = {};
          roomStudents.forEach((s) => {
            const j = s.jenjang || extractJenjang(s.kelas);
            jenjangMix[j] = (jenjangMix[j] || 0) + 1;
          });

          return (
            <div key={room.id} className="bg-white p-5 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-slate-900">
                      {room.namaRuang} (Ruang {room.nomorRuang})
                    </h3>
                    {roomStudents.length % 2 === 1 && !/cadangan/i.test(room.namaRuang) && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                        Ganjil • 1 Kursi Terpisah
                      </span>
                    )}
                    {/cadangan/i.test(room.namaRuang) && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-300">
                        Cadangan
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 tabular-nums">
                    Terisi: <strong>{roomStudents.length}</strong> / {room.kapasitas} kursi
                    {' • '}
                    <strong>
                      {Math.max(
                        Math.ceil(roomStudents.length / 2),
                        ...roomStudents.map((s) => (s.nomorMeja ? Math.ceil(s.nomorMeja / 2) : 0)),
                        0
                      )}{' '}
                      Meja
                    </strong>
                    {isOnline ? ` (tersebar di ${examConfig.jumlahSesi} sesi)` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {canEdit && (
                    <button
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
                    onClick={() => onNavigateToDenah(room.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 cursor-pointer whitespace-nowrap"
                  >
                    <Grid className="w-3.5 h-3.5" /> Lihat Denah
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                {Object.entries(jenjangMix).map(([jen, count]) => (
                  <span key={jen} className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded font-semibold text-slate-800 tabular-nums">
                    Jenjang {jen}: {count}
                  </span>
                ))}
              </div>

              <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <th className="px-2 py-1.5 text-center w-10">Meja</th>
                      <th className="px-2 py-1.5 text-left">Nama &amp; No. Peserta</th>
                      <th className="px-2 py-1.5 text-left">User &amp; Pass Ujian</th>
                      <th className="px-2 py-1.5 text-center">Kelas</th>
                      {isOnline && <th className="px-2 py-1.5 text-center">Sesi</th>}
                      {canEdit && <th className="px-2 py-1.5 text-right">Pindah</th>}
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
                          {canEdit && (
                            <td className="px-2 py-1.5 text-right">
                              <button
                                onClick={() => {
                                  setMovingStudent(st);
                                  setTargetRoomId(st.ruangId || rooms[0]?.id || '');
                                  setTargetSesi(st.sesi || 1);
                                }}
                                className="p-1 text-slate-500 hover:text-emerald-700 cursor-pointer"
                                title="Pindah Ruang / Sesi"
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

      {/* Move Student Modal */}
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
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>{r.namaRuang}</option>
                ))}
              </select>
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
                onClick={() => setMovingStudent(null)}
                className="px-3 py-1.5 font-semibold bg-slate-100 rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
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
