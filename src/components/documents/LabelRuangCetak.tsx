import React from 'react';
import {
  ExamConfig,
  ExamRoom,
  MadrasahProfile,
  PaperPreset,
  PhysicalClassroom,
  Student,
} from '../../types';
import { KopSurat } from './KopSurat';
import { computeClassRangesInRoom } from '../../utils/seating';

interface LabelRuangCetakProps {
  profile: MadrasahProfile;
  examConfig?: ExamConfig;
  rooms: ExamRoom[];
  students: Student[];
  physicalClassrooms?: PhysicalClassroom[];
  selectedRoomId?: string;
  paperPreset?: PaperPreset;
}

export const LabelRuangCetak: React.FC<LabelRuangCetakProps> = ({
  profile,
  examConfig,
  rooms,
  students,
  physicalClassrooms = [],
  selectedRoomId,
  paperPreset,
}) => {
  const activeRooms = rooms.filter(
    (r) => !selectedRoomId || selectedRoomId === 'all' || r.id === selectedRoomId
  );

  const isF4 = paperPreset?.size === 'F4';
  const sheetClass = isF4 ? 'w-[215mm] min-h-[330mm]' : 'w-[210mm] min-h-[297mm]';

  return (
    <div className="w-full flex flex-col items-center">
      {activeRooms.map((room) => {
        const roomStudents = students.filter((s) => s.ruangId === room.id && s.status === 'Aktif');
        const classRanges = computeClassRangesInRoom(roomStudents, students);
        const mappedLocations = physicalClassrooms
          .filter((pc) => pc.assignedRoomIds.includes(room.id))
          .map((pc) => pc.namaKelas);

        // If online, also group ranges per session cleanly
        const isOnline = examConfig?.moda === 'online';
        const distinctSessions = isOnline
          ? Array.from(new Set(roomStudents.map((s) => s.sesi || 1))).sort((a, b) => a - b)
          : [];

        return (
          <div
            key={`label-ruang-${room.id}`}
            className={`${sheetClass} p-[12mm] bg-white text-slate-900 border border-slate-300 shadow-sm print:border-none print:shadow-none print:p-0 print-page-break mb-8 print:mb-0 flex flex-col justify-between`}
          >
            <div>
              {(paperPreset?.showKop ?? true) && <KopSurat profile={profile} />}

              <div className="border-4 border-slate-900 rounded-sm p-8 mt-4 text-center bg-white">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600 mb-2">
                  IDENTITAS PINTU RUANG UJIAN
                </p>
                <h1 className="text-6xl font-black tracking-tight text-slate-950 font-serif uppercase">
                  RUANG {room.nomorRuang}
                </h1>
                {mappedLocations.length > 0 && (
                  <p className="mt-2 text-sm font-bold text-emerald-900 uppercase tracking-wider">
                    Lokasi Fisik: {mappedLocations.join(' / ')}
                  </p>
                )}

                <div className="my-5 border-y-2 border-slate-900 py-3">
                  <p className="text-sm font-extrabold uppercase text-slate-900">
                    {examConfig?.namaUjian || profile.jenisUjian}
                  </p>
                  <p className="text-xs font-semibold text-slate-700 mt-0.5">
                    Tahun Pelajaran {profile.tahunPelajaran} • Semester {profile.semester}
                  </p>
                </div>

                {/* Exact Class & Participant Number Ranges */}
                <div className="text-left space-y-3 mt-4">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1">
                    Daftar Rentang Nomor Peserta Per Kelas:
                  </h3>

                  {classRanges.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-4 text-center">
                      Belum ada peserta dialokasikan ke {room.namaRuang}.
                    </p>
                  ) : (
                    <table className="w-full text-xs border-collapse border border-slate-900">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="border border-slate-900 px-3 py-2 text-left w-28">Kelas</th>
                          <th className="border border-slate-900 px-3 py-2 text-center w-20">Jumlah</th>
                          <th className="border border-slate-900 px-3 py-2 text-left">Rentang Nomor Peserta</th>
                        </tr>
                      </thead>
                      <tbody>
                        {classRanges.map((rg) => (
                          <tr key={rg.kelas}>
                            <td className="border border-slate-900 px-3 py-2 font-bold text-slate-950">
                              KELAS {rg.kelas}
                            </td>
                            <td className="border border-slate-900 px-3 py-2 text-center font-bold tabular-nums">
                              {rg.count}
                            </td>
                            <td className="border border-slate-900 px-3 py-2 font-mono font-bold text-emerald-950">
                              {rg.ranges.join(', ')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {isOnline && distinctSessions.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-300 space-y-1.5">
                      <p className="text-xs font-bold uppercase text-slate-700">
                        Rincian Per Sesi (Moda Online):
                      </p>
                      {distinctSessions.map((sesi) => {
                        const sesiStudents = roomStudents.filter((s) => (s.sesi || 1) === sesi);
                        const sesiRanges = computeClassRangesInRoom(sesiStudents, students);
                        return (
                          <div key={sesi} className="text-xs border border-slate-300 bg-slate-50 px-3 py-1.5 rounded-xs">
                            <span className="font-bold mr-2">SESI {sesi} ({sesiStudents.length} peserta):</span>
                            {sesiRanges.map((r) => `${r.kelas}: ${r.ranges.join(', ')}`).join(' | ')}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-slate-300 flex justify-between items-center text-xs font-bold">
                  <span>TOTAL PESERTA RUANG {room.nomorRuang}: {roomStudents.length} ORANG</span>
                  <span>KAPASITAS: {room.kapasitas} KURSI</span>
                </div>
              </div>
            </div>

            <div className="text-center text-xs font-serif mt-6">
              <p className="font-bold uppercase">{profile.namaMadrasah}</p>
              <p className="text-[11px] text-slate-600">Panitia Penyelenggara Ujian • Harap Menjaga Ketenangan Area Ujian</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
