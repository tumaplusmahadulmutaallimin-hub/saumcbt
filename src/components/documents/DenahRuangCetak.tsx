import React from 'react';
import { ExamConfig, ExamRoom, MadrasahProfile, PaperPreset, Student, Supervisor } from '../../types';
import { KopSurat } from './KopSurat';
import { computeClassRangesInRoom } from '../../utils/seating';
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
    (r) => !selectedRoomId || selectedRoomId === 'all' || r.id === selectedRoomId
  );

  // Determine sessions to print: if online and selectedSesi not specified, print per session if students exist in multiple sessions
  const isOnline = examConfig?.moda === 'online';
  const sessionList: Array<number | undefined> = (() => {
    if (!isOnline) return [undefined];
    if (selectedSesi && selectedSesi > 0) return [selectedSesi];
    const distinct = Array.from(
      new Set(students.filter((s) => s.status === 'Aktif' && s.sesi).map((s) => s.sesi as number))
    ).sort((a, b) => a - b);
    return distinct.length > 0 ? distinct : [1];
  })();

  const sheetStyle = getSheetScreenStyle(paperPreset);

  if (activeRooms.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
        <p className="text-slate-500 font-medium">
          Belum ada ruang ujian yang dibentuk. Atur pembagian ruang terlebih dahulu di menu Pembagian Ruang & Sesi.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center">
      {activeRooms.flatMap((room) =>
        sessionList.map((sesi) => {
          const roomStudents = students
            .filter(
              (s) =>
                s.ruangId === room.id &&
                s.status === 'Aktif' &&
                (sesi === undefined || s.sesi === sesi)
            )
            .sort((a, b) => (a.nomorMeja || 999) - (b.nomorMeja || 999))
            .slice(0, 22); // Max 22 seats per room

          // Skip rendering empty session-room pairs when a room has 0 students in that session (unless only 1 session)
          if (roomStudents.length === 0 && sessionList.length > 1) return null;

          const classRanges = computeClassRangesInRoom(roomStudents, students);
          const maleCount = roomStudents.filter((s) => s.jenisKelamin === 'L').length;
          const femaleCount = roomStudents.filter((s) => s.jenisKelamin === 'P').length;
          const p1 = room.pengawas1Id ? formatPersonNameAndTitle(supervisorMap.get(room.pengawas1Id)?.nama) : undefined;
          const p2 = room.pengawas2Id ? formatPersonNameAndTitle(supervisorMap.get(room.pengawas2Id)?.nama) : undefined;

          // Build rows of 6 seats: [col 0, col 1] [GAP] [col 2, col 3] [GAP] [col 4, col 5]
          // ONLY occupied seats are rendered (no empty boxes!). Any missing trailing slot renders blank space.
          const totalSeats = roomStudents.length;
          const numRows = Math.ceil(totalSeats / 6);
          const seatRows: Array<Array<Student | null>> = [];
          for (let r = 0; r < numRows; r++) {
            const rowSeats: Array<Student | null> = [];
            for (let c = 0; c < 6; c++) {
              const targetSeatNo = r * 6 + c + 1;
              // Match student by nomorMeja if sequential within 1..22, else positional fallback
              const st = roomStudents[r * 6 + c] || roomStudents.find((x) => x.nomorMeja === targetSeatNo) || null;
              rowSeats.push(st);
            }
            seatRows.push(rowSeats);
          }

          return (
            <div
              key={`denah-duduk-${room.id}-${sesi ?? 'all'}`}
              style={sheetStyle}
              className="saum-sheet border border-slate-300 shadow-sm print-page-break mb-8 print:mb-0 flex flex-col justify-between"
            >
              <div>
                {(paperPreset?.showKop ?? true) && <KopSurat profile={profile} isCompact />}

                {/* Header */}
                <div className="text-center mb-2.5">
                  <h2 className="text-sm font-extrabold uppercase font-serif tracking-wide underline">
                    DENAH TEMPAT DUDUK PESERTA UJIAN
                  </h2>
                  <p className="text-xs font-bold uppercase mt-0.5">
                    RUANG {room.nomorRuang} ({(room.namaRuang || '').toUpperCase()})
                    {sesi ? ` • SESI ${sesi}` : ''} — {(profile.jenisUjian || 'UJIAN MADRASAH').toUpperCase()}
                  </p>
                  <p className="text-[10.5px] text-slate-700">
                    Tahun Pelajaran {profile.tahunPelajaran} • Jumlah Peserta: {roomStudents.length} Orang
                  </p>

                  {/* Actual non-contiguous participant number ranges grouped by class */}
                  {classRanges.length > 0 && (
                    <div className="mt-1.5 border border-slate-800 bg-slate-50 px-2.5 py-1 rounded-xs inline-block text-left text-[10px]">
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
                <div className="border-2 border-slate-900 rounded-sm p-3 bg-white">
                  <div className="w-1/2 mx-auto py-1 bg-slate-800 text-white text-center font-bold text-[10px] uppercase tracking-widest mb-2.5">
                    PAPAN TULIS / DEPAN RUANG
                  </div>

                  <div className="flex justify-between items-center mb-3.5 px-1">
                    <div className="border border-slate-800 px-3 py-1 text-[10px] font-bold uppercase">
                      PINTU MASUK
                    </div>
                    <div className="border-2 border-slate-900 bg-slate-100 px-6 py-1.5 text-center">
                      <p className="text-[10px] font-extrabold uppercase">MEJA PENGAWAS</p>
                      {(p1 || p2) && (
                        <p className="text-[8.5px] text-slate-700">
                          {[p1, p2].filter(Boolean).join(' / ')}
                        </p>
                      )}
                    </div>
                    <div className="text-[9.5px] font-mono text-slate-600 text-right">
                      6 Kursi / Baris • Maks 22
                    </div>
                  </div>

                  {/* EXACT 6-column seating grid with 2 clean blank aisle gaps (NO "GANG" text, NO icons, NO empty boxes) */}
                  <div className="space-y-2.5">
                    {seatRows.map((rowSeats, rIdx) => {
                      // 8 CSS columns: [S1] [S2] [blank gap 10px] [S3] [S4] [blank gap 10px] [S5] [S6]
                      const renderSeatBox = (st: Student | null, slotIdx: number) => {
                        if (!st) {
                          return <div key={`blank-${rIdx}-${slotIdx}`} aria-hidden="true" />;
                        }
                        const deskNumber = rIdx * 6 + slotIdx + 1;
                        return (
                          <div
                            key={`seat-${st.id}`}
                            className="border-[1.5px] border-slate-900 bg-white p-1.5 flex flex-col justify-between min-h-[68px]"
                          >
                            {/* Top: Nomor Peserta */}
                            <div className="flex items-center justify-between gap-1 border-b border-slate-300 pb-0.5">
                              <span className="font-mono text-[9.5px] font-extrabold text-slate-950 tracking-tight tabular-nums">
                                {st.nomorPeserta || `M-${String(deskNumber).padStart(2, '0')}`}
                              </span>
                              <span className="font-mono text-[8px] font-bold text-slate-600">
                                #{String(st.nomorMeja || deskNumber).padStart(2, '0')}
                              </span>
                            </div>

                            {/* Middle: Kelas */}
                            <div className="text-[9px] font-bold text-emerald-900 text-center py-0.5">
                              {st.kelas}
                            </div>

                            {/* Bottom: Nama Lengkap wrapping cleanly */}
                            <div className="text-[9px] font-bold text-slate-900 text-center leading-tight break-words">
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
                              'minmax(0,1fr) minmax(0,1fr) 12px minmax(0,1fr) minmax(0,1fr) 12px minmax(0,1fr) minmax(0,1fr)',
                            columnGap: '4px',
                          }}
                        >
                          {renderSeatBox(rowSeats[0], 0)}
                          {renderSeatBox(rowSeats[1], 1)}
                          {/* Aisle Gap 1: intentionally blank without text or icons */}
                          <div aria-hidden="true" />
                          {renderSeatBox(rowSeats[2], 2)}
                          {renderSeatBox(rowSeats[3], 3)}
                          {/* Aisle Gap 2: intentionally blank without text or icons */}
                          <div aria-hidden="true" />
                          {renderSeatBox(rowSeats[4], 4)}
                          {renderSeatBox(rowSeats[5], 5)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Footer Recap & Signature */}
              <div className="grid grid-cols-2 gap-4 text-[10.5px] mt-3 pt-2 border-t border-slate-300">
                <div className="border border-slate-800 p-2 bg-slate-50 leading-snug">
                  <p className="font-bold underline mb-1">REKAPITULASI RUANG {room.nomorRuang}:</p>
                  <p>
                    Laki-laki: <strong>{maleCount}</strong> | Perempuan: <strong>{femaleCount}</strong> | Total:{' '}
                    <strong>{roomStudents.length}</strong> Peserta
                  </p>
                  <p className="mt-0.5 text-[9.5px] text-slate-700">
                    {classRanges.map((rg) => `${rg.kelas}: ${rg.count}`).join(' • ')}
                  </p>
                </div>

                <div className="text-center font-serif leading-tight">
                  <p className="text-[10px]">
                    {profile.tempatTandaTangan ? `${profile.tempatTandaTangan}, ` : ''}
                    {formatIndonesianDate(profile.tanggalSurat)}
                  </p>
                  <p className="font-bold">Kepala Madrasah,</p>
                  <div className="h-10 flex items-center justify-center">
                    {profile.ttdKepalaUrl && (
                      <img
                        src={profile.ttdKepalaUrl}
                        alt="TTD Kepala Madrasah"
                        className="max-h-10 max-w-[120px] object-contain mx-auto"
                      />
                    )}
                  </div>
                  <p className="font-bold underline">
                    {formatPersonNameAndTitle(profile.namaKepala) || '.........................'}
                  </p>
                  <p className="text-[9.5px] font-sans">NIP. {profile.nipKepala || '-'}</p>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};
