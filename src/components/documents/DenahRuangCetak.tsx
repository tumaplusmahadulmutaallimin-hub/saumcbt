import React from 'react';
import { ExamConfig, ExamRoom, MadrasahProfile, PaperPreset, Student, Supervisor } from '../../types';
import { KopSurat } from './KopSurat';
import { computeClassRangesInRoom, getRoomFacilityTotals } from '../../utils/seating';
import { extractJenjang } from '../../utils/dnpu';
import { formatIndonesianDate } from '../../utils/qrBarcode';
import { getSheetScreenStyle } from '../../utils/printLayout';
import { formatPersonNameAndTitle } from '../../utils/formatName';

interface DenahRuangCetakProps {
  profile: MadrasahProfile;
  examConfig?: ExamConfig;
  rooms: ExamRoom[];
  students: Student[];
  supervisors?: Supervisor[];
  selectedRoomId?: string;
  selectedSesi?: number;
  paperPreset?: PaperPreset;
}

function getJenjangSeatClasses(jenjang: string): {
  card: string;
  label: string;
} {
  if (jenjang === 'X') {
    return {
      card: 'border-[1.5px] border-slate-900 border-l-4 border-l-emerald-700 bg-emerald-50/35',
      label: 'text-emerald-900',
    };
  }
  if (jenjang === 'XI') {
    return {
      card: 'border-[1.5px] border-slate-900 border-l-4 border-l-sky-700 bg-sky-50/40',
      label: 'text-sky-900',
    };
  }
  if (jenjang === 'XII') {
    return {
      card: 'border-[1.5px] border-slate-900 border-l-4 border-l-amber-600 bg-amber-50/40',
      label: 'text-amber-900',
    };
  }
  return {
    card: 'border-[1.5px] border-slate-900 bg-white',
    label: 'text-slate-800',
  };
}

export const DenahRuangCetak: React.FC<DenahRuangCetakProps> = ({
  profile,
  examConfig,
  rooms,
  students,
  supervisors = [],
  selectedRoomId,
  selectedSesi,
  paperPreset,
}) => {
  const supervisorMap = new Map(supervisors.map((s) => [s.id, s]));
  const activeRooms = rooms.filter(
    (r) =>
      !r.id.startsWith('room-cadangan') &&
      (!selectedRoomId || selectedRoomId === 'all' || r.id === selectedRoomId)
  );

  // Determine sessions to print: separate per session whenever moda === 'online', jumlahSesi > 1, or multiple sessions exist
  const isOnline = examConfig?.moda === 'online';
  const distinctStudentSessions = Array.from(
    new Set(students.filter((s) => s.status === 'Aktif' && s.sesi).map((s) => s.sesi as number))
  ).sort((a, b) => a - b);
  const useSessions =
    isOnline || (examConfig?.jumlahSesi || 1) > 1 || distinctStudentSessions.length > 1;
  const sessionList: Array<number | undefined> = (() => {
    if (!useSessions) return [undefined];
    if (selectedSesi && selectedSesi > 0) return [selectedSesi];
    if (distinctStudentSessions.length > 0) return distinctStudentSessions;
    return Array.from({ length: Math.max(1, examConfig?.jumlahSesi || 1) }, (_, i) => i + 1);
  })();

  const sheetStyle = getSheetScreenStyle(paperPreset);

  if (activeRooms.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
        <p className="text-slate-500 font-medium">
          Belum ada ruang ujian yang dibentuk. Atur pembagian ruang terlebih dahulu di menu Pembagian Ruang &amp; Sesi.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center">
      {sessionList.flatMap((sesi) =>
        activeRooms.map((room) => {
          const roomStudents = students
            .filter(
              (s) =>
                s.ruangId === room.id &&
                s.status === 'Aktif' &&
                (sesi === undefined || (s.sesi || 1) === sesi)
            )
            .sort((a, b) => (a.nomorMeja || 999) - (b.nomorMeja || 999));

          // Skip rendering empty session-room pairs when printing multiple sessions
          if (roomStudents.length === 0 && sessionList.length > 1) return null;

          const classRanges = computeClassRangesInRoom(roomStudents, students);
          const maleCount = roomStudents.filter((s) => s.jenisKelamin === 'L').length;
          const femaleCount = roomStudents.filter((s) => s.jenisKelamin === 'P').length;
          const p1 = room.pengawas1Id ? formatPersonNameAndTitle(supervisorMap.get(room.pengawas1Id)?.nama) : undefined;
          const p2 = room.pengawas2Id ? formatPersonNameAndTitle(supervisorMap.get(room.pengawas2Id)?.nama) : undefined;
          const facilities = getRoomFacilityTotals(room);

          // Jenjang identity in this room
          const jenjangTotals: Record<string, number> = {};
          roomStudents.forEach((s) => {
            const j = s.jenjang || extractJenjang(s.kelas);
            jenjangTotals[j] = (jenjangTotals[j] || 0) + 1;
          });
          const jenjangIdentityLabel =
            Object.entries(jenjangTotals)
              .map(([j, c]) => `Kelas ${j} (${c})`)
              .join(' & ') || '-';

          // Map students strictly by explicit nomorMeja so solo desks (e.g. #21, #23) keep their physical desk slots
          const hasExplicitSeats = roomStudents.some((s) => Boolean(s.nomorMeja));
          const studentBySeat = new Map<number, Student>();
          roomStudents.forEach((st, idx) => {
            let seat = hasExplicitSeats && st.nomorMeja ? st.nomorMeja : idx + 1;
            while (studentBySeat.has(seat)) seat++;
            studentBySeat.set(seat, st);
          });

          const desksUsed = Math.max(
            Math.ceil(roomStudents.length / 2),
            ...Array.from(studentBySeat.keys()).map((seat) => Math.ceil(seat / 2)),
            0
          );

          // 24 seats (12 paired desks) render in the 6-column paired grid; 23 students keep #23 in TEMPAT DUDUK TAMBAHAN
          const is24PairedMode = roomStudents.length === 24 || studentBySeat.has(24);
          const regularMaxAllowed = is24PairedMode ? 24 : 22;
          const regularMaxSeat = Math.min(
            regularMaxAllowed,
            Math.max(0, ...Array.from(studentBySeat.keys()).filter((k) => k <= regularMaxAllowed))
          );
          const numRows = Math.max(1, Math.ceil(regularMaxSeat / 6));
          const seatRows: Array<Array<{ seatNo: number; student: Student | null; isSoloPartnerEmpty: boolean }>> = [];
          for (let r = 0; r < numRows; r++) {
            const rowSeats: Array<{ seatNo: number; student: Student | null; isSoloPartnerEmpty: boolean }> = [];
            for (let c = 0; c < 6; c++) {
              const targetSeatNo = r * 6 + c + 1;
              if (targetSeatNo > regularMaxAllowed) {
                rowSeats.push({ seatNo: targetSeatNo, student: null, isSoloPartnerEmpty: false });
                continue;
              }
              const st = studentBySeat.get(targetSeatNo) || null;
              const isSoloPartnerEmpty =
                !st && targetSeatNo % 2 === 0 && studentBySeat.has(targetSeatNo - 1);
              rowSeats.push({ seatNo: targetSeatNo, student: st, isSoloPartnerEmpty });
            }
            seatRows.push(rowSeats);
          }

          // Check extra seats (#23 in 23-student mode, or #25+) for TEMPAT DUDUK TAMBAHAN section
          const extraSeats = Array.from(studentBySeat.entries())
            .filter(([seatNo]) => seatNo > regularMaxAllowed)
            .sort((a, b) => a[0] - b[0]);

          const rowGapClass =
            room.jarakAntarMeja === 'rapat'
              ? 'space-y-1.5'
              : room.jarakAntarMeja === 'renggang'
                ? 'space-y-3'
                : 'space-y-2';

          return (
            <div
              key={`denah-duduk-${room.id}-${sesi ?? 'all'}`}
              style={sheetStyle}
              className="saum-sheet border border-slate-300 shadow-sm print-page-break mb-8 print:mb-0 flex flex-col justify-between"
            >
              <div>
                {(paperPreset?.showKop ?? true) && <KopSurat profile={profile} isCompact />}

                {/* Header */}
                <div className="text-center mb-2">
                  <h2 className="text-sm font-extrabold uppercase font-serif tracking-wide underline">
                    DENAH TEMPAT DUDUK PESERTA UJIAN
                  </h2>
                  <p className="text-xs font-bold uppercase mt-0.5">
                    RUANG {room.nomorRuang} ({(room.namaRuang || '').toUpperCase()})
                    {sesi ? ` • SESI ${sesi}` : ''} — {(profile.jenisUjian || 'UJIAN MADRASAH').toUpperCase()}
                  </p>
                  <p className="text-[10px] text-slate-800 font-semibold mt-0.5 tabular-nums">
                    Jenjang: {jenjangIdentityLabel} • Total Siswa: {roomStudents.length} Orang • Meja: {desksUsed}/{facilities.totalMeja} • Kursi: {roomStudents.length}/{facilities.totalKursi}
                    {extraSeats.length > 0 ? ' • Status: INSIDENTAL (TEMPAT DUDUK TAMBAHAN)' : ''}
                  </p>

                  {/* Actual non-contiguous participant number ranges grouped by class */}
                  {classRanges.length > 0 && (
                    <div className="mt-1 border border-slate-800 bg-slate-50 px-2.5 py-1 rounded-xs inline-block text-left text-[9.5px]">
                      <span className="font-bold">Rentang Nomor Peserta: </span>
                      {classRanges.map((rg, idx) => (
                        <span key={rg.kelas} className="mr-3">
                          <span className="font-bold">Kelas {rg.kelas}</span> ({rg.count}):{' '}
                          <span className="font-mono font-semibold">{rg.ranges.join(', ')}</span>
                          {idx < classRanges.length - 1 ? ';' : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Front Area: Papan Tulis, Pintu & Meja Pengawas */}
                <div className="border-2 border-slate-900 rounded-sm p-2.5 bg-white">
                  <div className="w-1/2 mx-auto py-1 bg-slate-800 text-white text-center font-bold text-[10px] uppercase tracking-widest mb-2">
                    PAPAN TULIS / DEPAN RUANG
                  </div>

                  <div className="flex justify-between items-center mb-2.5 px-1">
                    <div className="border border-slate-800 px-2.5 py-0.5 text-[9.5px] font-bold uppercase">
                      PINTU MASUK
                    </div>
                    <div className="border-2 border-slate-900 bg-slate-100 px-5 py-1 text-center">
                      <p className="text-[9.5px] font-extrabold uppercase">MEJA PENGAWAS</p>
                      {(p1 || p2) && (
                        <p className="text-[8px] text-slate-700">
                          {[p1, p2].filter(Boolean).join(' / ')}
                        </p>
                      )}
                    </div>
                    <div className="text-[8.5px] text-slate-700 text-right space-x-2 font-semibold">
                      <span className="inline-flex items-center gap-1">
                        <span className="inline-block w-2 h-2 bg-emerald-700" /> X
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="inline-block w-2 h-2 bg-sky-700" /> XI
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="inline-block w-2 h-2 bg-amber-600" /> XII
                      </span>
                    </div>
                  </div>

                  {/* EXACT 6-column seating grid with 2 clean Jalur Sirkulasi aisles */}
                  <div className={rowGapClass}>
                    {seatRows.map((rowSeats, rIdx) => {
                      const renderSeatBox = (
                        cell: { seatNo: number; student: Student | null; isSoloPartnerEmpty: boolean },
                        slotIdx: number
                      ) => {
                        const { seatNo, student: st, isSoloPartnerEmpty } = cell;
                        if (!st) {
                          if (isSoloPartnerEmpty) {
                            return (
                              <div
                                key={`solo-empty-${rIdx}-${slotIdx}`}
                                className="border border-dashed border-slate-400 bg-slate-50/70 p-1 flex flex-col items-center justify-center min-h-[60px] text-center"
                              >
                                <span className="font-mono text-[8px] font-bold text-slate-400">
                                  #{String(seatNo).padStart(2, '0')}
                                </span>
                                <span className="text-[7.5px] font-semibold text-slate-500 mt-0.5 leading-tight">
                                  Kursi Kosong
                                </span>
                              </div>
                            );
                          }
                          return <div key={`blank-${rIdx}-${slotIdx}`} aria-hidden="true" />;
                        }

                        const deskNo = Math.ceil((st.nomorMeja || seatNo) / 2);
                        const jen = st.jenjang || extractJenjang(st.kelas);
                        const jenStyle = getJenjangSeatClasses(jen);

                        return (
                          <div
                            key={`seat-${st.id}`}
                            className={`${jenStyle.card} p-1.5 flex flex-col justify-between min-h-[60px]`}
                          >
                            {/* Top: Nomor Meja & Nomor Kursi */}
                            <div className="flex items-center justify-between gap-1 border-b border-slate-300 pb-0.5">
                              <span className="font-mono text-[8px] font-extrabold text-slate-700">
                                M{String(deskNo).padStart(2, '0')}
                              </span>
                              <span className="font-mono text-[8.5px] font-extrabold text-slate-950 tracking-tight tabular-nums">
                                {st.nomorPeserta || `#${String(seatNo).padStart(2, '0')}`}
                              </span>
                            </div>

                            {/* Middle: Kelas */}
                            <div className={`text-[8.5px] font-bold text-center py-0.5 ${jenStyle.label}`}>
                              {st.kelas} (#{String(st.nomorMeja || seatNo).padStart(2, '0')})
                            </div>

                            {/* Bottom: Nama Lengkap */}
                            <div className="text-[8.5px] font-bold text-slate-900 text-center leading-tight break-words">
                              {formatPersonNameAndTitle(st.nama)}
                            </div>
                          </div>
                        );
                      };

                      return (
                        <div
                          key={`row-${rIdx}`}
                          className="grid items-stretch"
                          style={{
                            gridTemplateColumns:
                              'minmax(0,1fr) minmax(0,1fr) 18px minmax(0,1fr) minmax(0,1fr) 18px minmax(0,1fr) minmax(0,1fr)',
                            columnGap: '3px',
                          }}
                        >
                          {renderSeatBox(rowSeats[0], 0)}
                          {renderSeatBox(rowSeats[1], 1)}
                          {/* Jalur Sirkulasi 1 */}
                          <div className="flex items-center justify-center border-x border-dashed border-slate-200 bg-slate-50/40">
                            {rIdx === 1 && (
                              <span className="text-[6.5px] font-bold tracking-widest uppercase text-slate-400 [writing-mode:vertical-rl] rotate-180">
                                Sirkulasi
                              </span>
                            )}
                          </div>
                          {renderSeatBox(rowSeats[2], 2)}
                          {renderSeatBox(rowSeats[3], 3)}
                          {/* Jalur Sirkulasi 2 */}
                          <div className="flex items-center justify-center border-x border-dashed border-slate-200 bg-slate-50/40">
                            {rIdx === 1 && (
                              <span className="text-[6.5px] font-bold tracking-widest uppercase text-slate-400 [writing-mode:vertical-rl] rotate-180">
                                Sirkulasi
                              </span>
                            )}
                          </div>
                          {renderSeatBox(rowSeats[4], 4)}
                          {renderSeatBox(rowSeats[5], 5)}
                        </div>
                      );
                    })}
                  </div>

                  {/* Dedicated Non-Blocking Incidental Zone: TEMPAT DUDUK TAMBAHAN (Seat #23+) */}
                  {extraSeats.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t-2 border-dashed border-amber-500 bg-amber-50/50 p-2 rounded-xs">
                      <div className="flex items-center justify-between text-[8.5px] font-extrabold uppercase text-amber-950 mb-1.5">
                        <span>TEMPAT DUDUK TAMBAHAN (INSIDENTAL • AMAN JALUR SIRKULASI)</span>
                        <span className="font-mono">Meja 12 • Kursi Tunggal</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {extraSeats.map(([seatNo, st]) => {
                          const jen = st.jenjang || extractJenjang(st.kelas);
                          const jenStyle = getJenjangSeatClasses(jen);
                          return (
                            <div
                              key={`extra-print-${st.id}`}
                              className={`${jenStyle.card} border-2 border-amber-700 p-1.5 flex flex-col justify-between min-h-[54px]`}
                            >
                              <div className="flex items-center justify-between gap-1 border-b border-amber-300 pb-0.5 text-[8px] font-mono">
                                <span className="font-extrabold text-amber-950">
                                  M{String(Math.ceil(seatNo / 2)).padStart(2, '0')} · #{String(seatNo).padStart(2, '0')}
                                </span>
                                <span className="font-bold text-slate-900">{st.nomorPeserta || ''}</span>
                              </div>
                              <div className={`text-[8.5px] font-bold text-center ${jenStyle.label}`}>
                                {st.kelas} (Duduk Sendiri)
                              </div>
                              <div className="text-[8.5px] font-bold text-slate-900 text-center leading-tight">
                                {formatPersonNameAndTitle(st.nama)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Recap & Signature */}
              <div className="grid grid-cols-2 gap-4 text-[10px] mt-2.5 pt-2 border-t border-slate-300">
                <div className="border border-slate-800 p-2 bg-slate-50 leading-snug">
                  <p className="font-bold underline mb-0.5">REKAPITULASI RUANG {room.nomorRuang}:</p>
                  <p>
                    Laki-laki: <strong>{maleCount}</strong> | Perempuan: <strong>{femaleCount}</strong> | Total:{' '}
                    <strong>{roomStudents.length}</strong> Peserta ({desksUsed}/{facilities.totalMeja} Meja)
                  </p>
                  <p className="mt-0.5 text-[9px] text-slate-700">
                    {classRanges.map((rg) => `${rg.kelas}: ${rg.count}`).join(' • ')}
                    {facilities.statusFasilitas === 'INSIDENTAL' ? ' | Status: INSIDENTAL' : ''}
                  </p>
                </div>

                <div className="text-center font-serif leading-tight">
                  <p className="text-[9.5px]">
                    {profile.tempatTandaTangan ? `${profile.tempatTandaTangan}, ` : ''}
                    {formatIndonesianDate(profile.tanggalSurat)}
                  </p>
                  <p className="font-bold">Kepala Madrasah,</p>
                  <div className="h-9 flex items-center justify-center">
                    {profile.ttdKepalaUrl && (
                      <img
                        src={profile.ttdKepalaUrl}
                        alt="TTD Kepala Madrasah"
                        className="max-h-9 max-w-[120px] object-contain mx-auto"
                      />
                    )}
                  </div>
                  <p className="font-bold underline">
                    {formatPersonNameAndTitle(profile.namaKepala) || '.........................'}
                  </p>
                  <p className="text-[9px] font-sans">NIP. {profile.nipKepala || '-'}</p>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};
