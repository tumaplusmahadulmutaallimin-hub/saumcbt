import React from 'react';
import {
  ExamConfig,
  ExamRoom,
  ExamSchedule,
  ExamSubject,
  MadrasahProfile,
  PaperPreset,
  Student,
  Supervisor,
  SupervisorAssignment,
} from '../../types';
import { KopSurat } from './KopSurat';
import { formatDayAndDate, formatIndonesianDate } from '../../utils/qrBarcode';
import { computeClassRangesInRoom } from '../../utils/seating';

interface BeritaAcaraProps {
  profile: MadrasahProfile;
  examConfig?: ExamConfig;
  students: Student[];
  rooms: ExamRoom[];
  schedules: ExamSchedule[];
  subjects: ExamSubject[];
  supervisors: Supervisor[];
  supervisorAssignments?: SupervisorAssignment[];
  selectedRoomId?: string;
  selectedScheduleId?: string;
  paperPreset?: PaperPreset;
}

export const BeritaAcara: React.FC<BeritaAcaraProps> = ({
  profile,
  examConfig,
  students,
  rooms,
  schedules,
  subjects,
  supervisors,
  supervisorAssignments = [],
  selectedRoomId,
  selectedScheduleId,
  paperPreset,
}) => {
  const subjectMap = new Map(subjects.map((s) => [s.id, s]));
  const supervisorMap = new Map(supervisors.map((sp) => [sp.id, sp]));

  const activeRooms = rooms.filter(
    (r) => !selectedRoomId || selectedRoomId === 'all' || r.id === selectedRoomId
  );
  const activeSchedules = schedules.filter(
    (sc) => !selectedScheduleId || selectedScheduleId === 'all' || sc.id === selectedScheduleId
  );

  const isOnline = examConfig?.moda === 'online';
  const isF4 = paperPreset?.size === 'F4';
  const sheetClass = isF4 ? 'w-[215mm] min-h-[330mm]' : 'w-[210mm] min-h-[297mm]';

  return (
    <div className="w-full flex flex-col items-center">
      {activeRooms.flatMap((room) =>
        activeSchedules.map((schedule) => {
          const subject = subjectMap.get(schedule.mapelId);
          const roomStudents = students.filter(
            (s) =>
              s.ruangId === room.id &&
              s.status === 'Aktif' &&
              (!isOnline || !s.sesi || s.sesi === schedule.sesi)
          );
          const classBreakdown = computeClassRangesInRoom(roomStudents, students);

          const sa = supervisorAssignments.find(
            (a) => a.scheduleId === schedule.id && a.roomId === room.id && a.sesi === schedule.sesi
          );
          const pengawas1 =
            (sa?.pengawas1Id ? supervisorMap.get(sa.pengawas1Id) : undefined) ||
            (room.pengawas1Id ? supervisorMap.get(room.pengawas1Id) : undefined);
          const pengawas2 =
            (sa?.pengawas2Id ? supervisorMap.get(sa.pengawas2Id) : undefined) ||
            (room.pengawas2Id ? supervisorMap.get(room.pengawas2Id) : undefined);

          return (
            <div
              key={`ba-${room.id}-${schedule.id}`}
              className={`${sheetClass} p-[10mm] bg-white text-slate-900 border border-slate-300 shadow-sm print:border-none print:shadow-none print:p-0 print-page-break mb-8 print:mb-0 text-[11px] leading-relaxed`}
            >
              {(paperPreset?.showKop ?? true) && <KopSurat profile={profile} isCompact />}

              <div className="text-center my-3">
                <h2 className="text-sm font-extrabold uppercase font-serif tracking-wide underline">
                  BERITA ACARA PELAKSANAAN UJIAN
                </h2>
                <p className="text-xs font-semibold uppercase mt-0.5">
                  {examConfig?.namaUjian || profile.jenisUjian} • TAHUN PELAJARAN {profile.tahunPelajaran}
                </p>
              </div>

              <div className="space-y-2.5 font-serif text-justify">
                <p>
                  Pada hari ini <span className="font-bold underline">{formatDayAndDate(schedule.tanggal)}</span>,
                  bertempat di <span className="font-bold">{profile.namaMadrasah}</span>, telah dilaksanakan{' '}
                  <span className="font-bold">{examConfig?.namaUjian || profile.jenisUjian}</span> ({isOnline ? 'Moda Online / CBT' : 'Moda Kertas / PBT'}) untuk:
                </p>

                <div className="pl-4 space-y-1 font-sans text-xs">
                  <div className="flex">
                    <span className="w-44 font-semibold text-slate-700">1. Mata Pelajaran</span>
                    <span className="mr-2">:</span>
                    <span className="font-bold text-slate-950 uppercase">{subject?.nama || '-'}</span>
                  </div>
                  <div className="flex">
                    <span className="w-44 font-semibold text-slate-700">2. Waktu Pelaksanaan</span>
                    <span className="mr-2">:</span>
                    <span className="font-medium text-slate-900 tabular-nums">
                      Pukul {schedule.waktuMulai} – {schedule.waktuSelesai} WIB
                      {isOnline ? ` (Sesi ${schedule.sesi})` : ''}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-44 font-semibold text-slate-700">3. Ruang Ujian</span>
                    <span className="mr-2">:</span>
                    <span className="font-bold text-slate-950">
                      {room.namaRuang} (Ruang {room.nomorRuang})
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-44 font-semibold text-slate-700">4. Jumlah Peserta Total</span>
                    <span className="mr-2">:</span>
                    <span className="font-bold text-slate-950 tabular-nums">
                      {roomStudents.length} orang (Hadir: ...... orang | Tidak Hadir: ...... orang)
                    </span>
                  </div>
                </div>

                {/* Dynamic Class Breakdown Table per Room */}
                <div className="mt-2 font-sans">
                  <p className="text-xs font-bold mb-1 text-slate-800">
                    Rincian Kehadiran Peserta Per Kelas (Dinamis Sesuai Ruang):
                  </p>
                  <table className="w-full text-[10.5px] border-collapse border border-slate-900">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="border border-slate-900 px-2 py-1 w-24 text-left">Kelas</th>
                        <th className="border border-slate-900 px-2 py-1 text-left">Rentang Nomor Peserta</th>
                        <th className="border border-slate-900 px-2 py-1 w-20 text-center">Terdaftar</th>
                        <th className="border border-slate-900 px-2 py-1 w-16 text-center">Hadir</th>
                        <th className="border border-slate-900 px-2 py-1 w-20 text-center">Tidak Hadir</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classBreakdown.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="border border-slate-900 px-2 py-2 text-center italic text-slate-500">
                            Belum ada peserta di ruang ini.
                          </td>
                        </tr>
                      ) : (
                        classBreakdown.map((cls) => (
                          <tr key={cls.kelas}>
                            <td className="border border-slate-900 px-2 py-1 font-bold">{cls.kelas}</td>
                            <td className="border border-slate-900 px-2 py-1 font-mono text-[10px]">
                              {cls.ranges.join(', ')}
                            </td>
                            <td className="border border-slate-900 px-2 py-1 text-center font-bold tabular-nums">
                              {cls.count}
                            </td>
                            <td className="border border-slate-900 px-2 py-1 text-center" />
                            <td className="border border-slate-900 px-2 py-1 text-center" />
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Absentees Detail Table */}
                <div className="mt-2 font-sans">
                  <p className="text-xs font-semibold mb-1 text-slate-700">
                    Daftar Peserta yang Tidak Hadir:
                  </p>
                  <table className="w-full text-[10.5px] border-collapse border border-slate-900">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="border border-slate-900 px-2 py-1 w-8 text-center">No</th>
                        <th className="border border-slate-900 px-2 py-1 w-28 text-center">No. Peserta</th>
                        <th className="border border-slate-900 px-2 py-1 text-left">Nama Peserta</th>
                        <th className="border border-slate-900 px-2 py-1 w-16 text-center">Kelas</th>
                        <th className="border border-slate-900 px-2 py-1 w-36 text-left">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[1, 2, 3].map((r) => (
                        <tr key={r} className="h-5">
                          <td className="border border-slate-900 px-2 py-0.5 text-center">{r}</td>
                          <td className="border border-slate-900 px-2 py-0.5" />
                          <td className="border border-slate-900 px-2 py-0.5" />
                          <td className="border border-slate-900 px-2 py-0.5" />
                          <td className="border border-slate-900 px-2 py-0.5" />
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Notes during Exam */}
                <div className="mt-2 font-sans">
                  <p className="text-xs font-semibold mb-1 text-slate-700">Catatan Kejadian Selama Ujian:</p>
                  <div className="border border-slate-900 p-2 min-h-[56px] text-[10.5px] leading-snug text-slate-800">
                    <p>
                      1. {isOnline
                        ? `Sistem ujian online dibuka pukul ${schedule.waktuMulai} WIB dan seluruh perangkat peserta berjalan normal.`
                        : `Sampul naskah soal dibuka pukul ${schedule.waktuMulai} WIB di hadapan peserta dalam keadaan tersegel baik.`}
                    </p>
                    <p className="mt-1">
                      2. Catatan khusus pengawas: ........................................................................................
                    </p>
                  </div>
                </div>

                <p className="mt-2">
                  Demikian Berita Acara ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.
                </p>
              </div>

              <div className="mt-5 font-serif">
                <div className="flex justify-between items-start text-xs">
                  <div className="text-center w-52 leading-tight">
                    <p className="font-bold">Pengawas Ruang I,</p>
                    <div className="h-14" />
                    <p className="font-bold underline uppercase">
                      {pengawas1?.nama || '...........................................'}
                    </p>
                    <p className="text-[9.5px] font-sans">NIP. {pengawas1?.nip || '...........................'}</p>
                  </div>

                  <div className="text-center w-52 leading-tight">
                    <p className="text-[10.5px]">
                      {profile.tempatTandaTangan}, {formatIndonesianDate(schedule.tanggal)}
                    </p>
                    <p className="font-bold">Pengawas Ruang II,</p>
                    <div className="h-14" />
                    <p className="font-bold underline uppercase">
                      {pengawas2?.nama || '...........................................'}
                    </p>
                    <p className="text-[9.5px] font-sans">NIP. {pengawas2?.nip || '...........................'}</p>
                  </div>
                </div>

                <div className="mt-3 text-center text-xs flex flex-col items-center">
                  <p className="font-bold">Mengetahui, Kepala Madrasah,</p>
                  <div className="h-12" />
                  <p className="font-bold underline uppercase">{profile.namaKepala}</p>
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
