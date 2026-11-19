import React from 'react';
import {
  ExamRoom,
  ExamSchedule,
  ExamSubject,
  MadrasahProfile,
  PaperPreset,
  SealDocConfig,
  Student,
  Supervisor,
  SupervisorAssignment,
} from '../../types';
import { KopSurat } from './KopSurat';
import { formatDayAndDate } from '../../utils/qrBarcode';
import { computeClassRangesInRoom } from '../../utils/seating';
import { getSheetScreenStyle } from '../../utils/printLayout';
import { formatPersonNameAndTitle } from '../../utils/formatName';

interface SegelSoalCetakProps {
  profile: MadrasahProfile;
  rooms: ExamRoom[];
  schedules: ExamSchedule[];
  subjects: ExamSubject[];
  students: Student[];
  supervisors: Supervisor[];
  supervisorAssignments?: SupervisorAssignment[];
  sealConfigs: SealDocConfig[];
  selectedRoomId?: string;
  selectedScheduleId?: string;
  paperPreset?: PaperPreset;
}

export const SegelSoalCetak: React.FC<SegelSoalCetakProps> = ({
  profile,
  rooms,
  schedules,
  subjects,
  students,
  supervisors,
  supervisorAssignments = [],
  sealConfigs,
  selectedRoomId,
  selectedScheduleId,
  paperPreset,
}) => {
  const subjectMap = new Map(subjects.map((s) => [s.id, s]));
  const supervisorMap = new Map(supervisors.map((sp) => [sp.id, sp]));
  const sealMap = new Map(sealConfigs.map((sc) => [sc.id, sc]));

  const activeRooms = rooms.filter(
    (r) => !selectedRoomId || selectedRoomId === 'all' || r.id === selectedRoomId
  );
  const activeSchedules = schedules.filter(
    (sc) => !selectedScheduleId || selectedScheduleId === 'all' || sc.id === selectedScheduleId
  );

  const sheetStyle = getSheetScreenStyle(paperPreset);

  if (activeRooms.length === 0 || activeSchedules.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
        <p className="text-slate-500 font-medium">
          Data Ruang Ujian atau Jadwal Ujian belum tersedia untuk membuat Segel Berkas Soal.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center">
      {activeRooms.flatMap((room) =>
        activeSchedules.map((schedule) => {
          const subject = subjectMap.get(schedule.mapelId);
          const roomStudents = students.filter((s) => s.ruangId === room.id && s.status === 'Aktif');
          const ranges = computeClassRangesInRoom(roomStudents, students);
          const sealKey = `${schedule.id}_${room.id}`;
          const cfg = sealMap.get(sealKey);

          // Uses manual input counts from Dokumen Ujian settings (never silently wrong)
          const jumlahSoal = cfg?.jumlahSoal ?? roomStudents.length;
          const jumlahLjk = cfg?.jumlahLjk ?? roomStudents.length;
          const jumlahBeritaAcara = cfg?.jumlahBeritaAcara ?? 2;
          const jumlahDaftarHadir = cfg?.jumlahDaftarHadir ?? 2;

          const sa = supervisorAssignments.find(
            (a) => a.scheduleId === schedule.id && a.roomId === room.id
          );
          const p1 = (sa?.pengawas1Id ? supervisorMap.get(sa.pengawas1Id) : undefined) ||
            (room.pengawas1Id ? supervisorMap.get(room.pengawas1Id) : undefined);
          const p2 = (sa?.pengawas2Id ? supervisorMap.get(sa.pengawas2Id) : undefined) ||
            (room.pengawas2Id ? supervisorMap.get(room.pengawas2Id) : undefined);

          return (
            <div
              key={`segel-${room.id}-${schedule.id}`}
              style={sheetStyle}
              className="saum-sheet border border-slate-300 shadow-sm print-page-break mb-8 print:mb-0 flex flex-col justify-between"
            >
              <div>
                {(paperPreset?.showKop ?? true) && <KopSurat profile={profile} />}

                <div className="border-4 border-double border-slate-950 p-6 mt-2">
                  <div className="text-center border-b-2 border-slate-900 pb-3 mb-4">
                    <p className="text-xs font-extrabold uppercase tracking-widest text-slate-700">
                      DOKUMEN RAHASIA • AMPLOP NASKAH SOAL & LJK
                    </p>
                    <h2 className="text-lg font-black uppercase font-serif mt-1">
                      SEGEL BERKAS UJIAN MADRASAH
                    </h2>
                    <p className="text-xs font-semibold uppercase mt-0.5">
                      {profile.jenisUjian} • Tahun Pelajaran {profile.tahunPelajaran}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs mb-4">
                    <div className="space-y-1.5">
                      <div className="flex">
                        <span className="w-32 font-semibold text-slate-700">Mata Pelajaran</span>
                        <span className="mr-1.5">:</span>
                        <span className="font-extrabold uppercase text-slate-950">{subject?.nama || '-'}</span>
                      </div>
                      <div className="flex">
                        <span className="w-32 font-semibold text-slate-700">Hari / Tanggal</span>
                        <span className="mr-1.5">:</span>
                        <span className="font-semibold">{formatDayAndDate(schedule.tanggal)}</span>
                      </div>
                      <div className="flex">
                        <span className="w-32 font-semibold text-slate-700">Waktu / Jam</span>
                        <span className="mr-1.5">:</span>
                        <span className="font-semibold tabular-nums">
                          {schedule.waktuMulai} – {schedule.waktuSelesai} WIB
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex">
                        <span className="w-32 font-semibold text-slate-700">Ruang Ujian</span>
                        <span className="mr-1.5">:</span>
                        <span className="font-extrabold text-base text-slate-950">RUANG {room.nomorRuang}</span>
                      </div>
                      <div className="flex">
                        <span className="w-32 font-semibold text-slate-700">Peserta Terdaftar</span>
                        <span className="mr-1.5">:</span>
                        <span className="font-bold tabular-nums">{roomStudents.length} Peserta</span>
                      </div>
                      <div className="flex">
                        <span className="w-32 font-semibold text-slate-700">Kelas</span>
                        <span className="mr-1.5">:</span>
                        <span className="font-semibold">{ranges.map((r) => `${r.kelas} (${r.count})`).join(', ') || '-'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Manual Counts Table */}
                  <table className="w-full text-xs border-collapse border-2 border-slate-900 mb-4">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="border border-slate-900 px-3 py-2 text-left">Isi Berkas Amplop Ujian</th>
                        <th className="border border-slate-900 px-3 py-2 text-center w-32">Jumlah (Input Manual)</th>
                        <th className="border border-slate-900 px-3 py-2 text-center w-28">Cek Pengawas</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-slate-900 px-3 py-2 font-semibold">1. Naskah Soal Ujian</td>
                        <td className="border border-slate-900 px-3 py-2 text-center font-extrabold tabular-nums">
                          {jumlahSoal} Eksemplar
                        </td>
                        <td className="border border-slate-900 px-3 py-2 text-center">[ &nbsp;&nbsp; ] Lengkap</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-900 px-3 py-2 font-semibold">2. Lembar Jawaban Ujian (LJK)</td>
                        <td className="border border-slate-900 px-3 py-2 text-center font-extrabold tabular-nums">
                          {jumlahLjk} Lembar
                        </td>
                        <td className="border border-slate-900 px-3 py-2 text-center">[ &nbsp;&nbsp; ] Lengkap</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-900 px-3 py-2 font-semibold">3. Daftar Hadir Peserta</td>
                        <td className="border border-slate-900 px-3 py-2 text-center font-bold tabular-nums">
                          {jumlahDaftarHadir} Lembar
                        </td>
                        <td className="border border-slate-900 px-3 py-2 text-center">[ &nbsp;&nbsp; ] Lengkap</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-900 px-3 py-2 font-semibold">4. Berita Acara Pelaksanaan</td>
                        <td className="border border-slate-900 px-3 py-2 text-center font-bold tabular-nums">
                          {jumlahBeritaAcara} Lembar
                        </td>
                        <td className="border border-slate-900 px-3 py-2 text-center">[ &nbsp;&nbsp; ] Lengkap</td>
                      </tr>
                    </tbody>
                  </table>

                  {cfg?.catatan && (
                    <p className="text-xs italic text-slate-700 mb-3">
                      Catatan Panitia: {cfg.catatan}
                    </p>
                  )}

                  {/* Official Notice */}
                  <div className="border border-slate-800 bg-slate-50 p-3 text-[11px] font-serif text-center font-semibold">
                    PERHATIAN: Sampul ini hanya boleh dibuka oleh Pengawas Ruang di hadapan peserta ujian
                    sesaat sebelum ujian dimulai sesuai jadwal resmi.
                  </div>

                  {/* Supervisor & Committee Signatures */}
                  <div className="grid grid-cols-3 gap-4 text-[11px] font-serif mt-6 text-center">
                    <div>
                      <p className="font-bold">Pengawas Ruang I,</p>
                      <div className="h-14" />
                      <p className="font-bold underline">{formatPersonNameAndTitle(p1?.nama) || '....................'}</p>
                    </div>
                    <div>
                      <p className="font-bold">Pengawas Ruang II,</p>
                      <div className="h-14" />
                      <p className="font-bold underline">{formatPersonNameAndTitle(p2?.nama) || '....................'}</p>
                    </div>
                    <div>
                      <p className="font-bold">Ketua Panitia / Seksi Naskah,</p>
                      <div className="h-14" />
                      <p className="font-bold underline">
                        {formatPersonNameAndTitle(profile.namaKetuaPanitia) || '....................'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-slate-500 font-mono flex justify-between pt-3 border-t border-slate-300">
                <span>KODE SEGEL: {profile.nsm}/{room.nomorRuang}/{subject?.kode || 'MAPEL'}</span>
                <span>SAUM • {profile.namaMadrasah}</span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};
