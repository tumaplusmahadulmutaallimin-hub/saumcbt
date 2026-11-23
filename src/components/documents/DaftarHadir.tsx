import React from 'react';
import {
  ExamConfig,
  ExamRoom,
  ExamSchedule,
  ExamSubject,
  MadrasahProfile,
  NumberingConfig,
  PaperPreset,
  Student,
  Supervisor,
  SupervisorAssignment,
} from '../../types';
import { KopSurat } from './KopSurat';
import { formatDayAndDate } from '../../utils/qrBarcode';
import { compareClasses } from '../../utils/numbering';
import { getSheetScreenStyle } from '../../utils/printLayout';
import { formatPersonNameAndTitle } from '../../utils/formatName';

interface DaftarHadirProps {
  profile: MadrasahProfile;
  examConfig?: ExamConfig;
  students: Student[];
  rooms: ExamRoom[];
  schedules: ExamSchedule[];
  subjects: ExamSubject[];
  supervisors: Supervisor[];
  supervisorAssignments?: SupervisorAssignment[];
  numberingConfig?: NumberingConfig;
  selectedRoomId?: string;
  selectedScheduleId?: string;
  selectedSesi?: number;
  paperPreset?: PaperPreset;
}

export const DaftarHadir: React.FC<DaftarHadirProps> = ({
  profile,
  examConfig,
  students,
  rooms,
  schedules,
  subjects,
  supervisors,
  supervisorAssignments = [],
  numberingConfig,
  selectedRoomId,
  selectedScheduleId,
  selectedSesi,
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
  const sheetStyle = getSheetScreenStyle(paperPreset);

  if (activeRooms.length === 0 || activeSchedules.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
        <p className="text-slate-500 font-medium">
          Data Ruang Ujian atau Jadwal Ujian belum tersedia. Lengkapi Pembagian Ruang & Jadwal Ujian terlebih dahulu.
        </p>
      </div>
    );
  }

  return (
    <div className="print-container w-full block print:m-0 print:p-0">
      {activeRooms.flatMap((room) =>
        activeSchedules.map((schedule) => {
          const subject = subjectMap.get(schedule.mapelId);
          const effectiveSesi = selectedSesi && selectedSesi > 0 ? selectedSesi : schedule.sesi;

          // Filter students in this room (and matching session if online)
          const roomStudents = students
            .filter(
              (s) =>
                s.ruangId === room.id &&
                s.status === 'Aktif' &&
                (!isOnline || !s.sesi || s.sesi === effectiveSesi)
            )
            // Exact sort rule: lowest class/jenjang first, then alphabetical A-Z by Nama
            .sort((a, b) => {
              const clsCmp = compareClasses(a.kelas, b.kelas, numberingConfig?.urutanKelas);
              if (clsCmp !== 0) return clsCmp;
              return a.nama.localeCompare(b.nama, 'id');
            });

          // Resolve assigned supervisors from SupervisorAssignment first, fallback to room
          const sa = supervisorAssignments.find(
            (a) => a.scheduleId === schedule.id && a.roomId === room.id && a.sesi === schedule.sesi
          );
          const pengawas1 = (sa?.pengawas1Id ? supervisorMap.get(sa.pengawas1Id) : undefined) ||
            (room.pengawas1Id ? supervisorMap.get(room.pengawas1Id) : undefined);
          const pengawas2 = (sa?.pengawas2Id ? supervisorMap.get(sa.pengawas2Id) : undefined) ||
            (room.pengawas2Id ? supervisorMap.get(room.pengawas2Id) : undefined);

          return (
            <div
              key={`dh-${room.id}-${schedule.id}`}
              style={sheetStyle}
              className="saum-sheet border border-slate-300 shadow-sm print-page-break mb-8 print:mb-0"
            >
              {(paperPreset?.showKop ?? true) && <KopSurat profile={profile} isCompact />}

              <div className="text-center my-2.5">
                <h2 className="text-sm font-extrabold uppercase font-serif tracking-wide underline">
                  DAFTAR HADIR PESERTA UJIAN
                </h2>
                <p className="text-xs font-semibold uppercase mt-0.5">
                  {examConfig?.namaUjian || profile.jenisUjian} • TAHUN PELAJARAN {profile.tahunPelajaran}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-x-6 text-[11px] mb-3 border border-slate-800 p-2 bg-slate-50/70">
                <div className="space-y-0.5">
                  <div className="flex">
                    <span className="w-28 font-semibold text-slate-700">Mata Pelajaran</span>
                    <span className="mr-1">:</span>
                    <span className="font-bold text-slate-950 uppercase">{subject?.nama || '-'}</span>
                  </div>
                  <div className="flex">
                    <span className="w-28 font-semibold text-slate-700">Hari / Tanggal</span>
                    <span className="mr-1">:</span>
                    <span className="font-medium text-slate-900">{formatDayAndDate(schedule.tanggal)}</span>
                  </div>
                  <div className="flex">
                    <span className="w-28 font-semibold text-slate-700">Waktu</span>
                    <span className="mr-1">:</span>
                    <span className="font-medium text-slate-900 tabular-nums">
                      {schedule.waktuMulai} – {schedule.waktuSelesai} WIB
                      {isOnline ? ` (Sesi ${effectiveSesi})` : ''}
                    </span>
                  </div>
                </div>

                <div className="space-y-0.5">
                  <div className="flex">
                    <span className="w-28 font-semibold text-slate-700">Ruang Ujian</span>
                    <span className="mr-1">:</span>
                    <span className="font-bold text-slate-950">
                      {room.namaRuang} (Ruang {room.nomorRuang})
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-28 font-semibold text-slate-700">Jumlah Peserta</span>
                    <span className="mr-1">:</span>
                    <span className="font-bold text-slate-900 tabular-nums">{roomStudents.length} Orang</span>
                  </div>
                  <div className="flex">
                    <span className="w-28 font-semibold text-slate-700">Moda Ujian</span>
                    <span className="mr-1">:</span>
                    <span className="font-medium text-slate-900 uppercase">
                      {isOnline ? `Online (Sesi ${effectiveSesi})` : 'Kertas (LJK / Lembar Jawab)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Exact Columns: No | Nomor Peserta | NISN | Nama | JK | Kelas | Tanda Tangan | Keterangan */}
              <table className="w-full text-[10.5px] border-collapse border border-slate-900 mb-3">
                <thead>
                  <tr className="bg-slate-100 text-slate-950 font-bold">
                    <th className="border border-slate-900 px-1.5 py-1.5 w-8 text-center">No</th>
                    <th className="border border-slate-900 px-2 py-1.5 w-28 text-center">Nomor Peserta</th>
                    <th className="border border-slate-900 px-2 py-1.5 w-24 text-center">NISN</th>
                    <th className="border border-slate-900 px-2.5 py-1.5 text-left">Nama</th>
                    <th className="border border-slate-900 px-1.5 py-1.5 w-9 text-center">JK</th>
                    <th className="border border-slate-900 px-2 py-1.5 w-16 text-center">Kelas</th>
                    <th className="border border-slate-900 px-2 py-1.5 w-40 text-center">Tanda Tangan</th>
                    <th className="border border-slate-900 px-2 py-1.5 w-20 text-center">Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {roomStudents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="border border-slate-900 px-3 py-6 text-center text-slate-500 italic">
                        Tidak ada peserta terdaftar di {room.namaRuang}{isOnline ? ` pada Sesi ${effectiveSesi}` : ''}.
                      </td>
                    </tr>
                  ) : (
                    roomStudents.map((st, idx) => {
                      const rowNum = idx + 1;
                      const isOdd = rowNum % 2 !== 0;
                      return (
                        <tr key={st.id}>
                          <td className="border border-slate-900 px-1.5 py-1 text-center tabular-nums font-medium">
                            {rowNum}
                          </td>
                          <td className="border border-slate-900 px-2 py-1 text-center font-mono font-bold tabular-nums">
                            {st.nomorPeserta || '-'}
                          </td>
                          <td className="border border-slate-900 px-2 py-1 text-center font-mono tabular-nums">
                            {st.nisn}
                          </td>
                          <td className="border border-slate-900 px-2.5 py-1 font-semibold">
                            {formatPersonNameAndTitle(st.nama)}
                          </td>
                          <td className="border border-slate-900 px-1.5 py-1 text-center font-medium">
                            {st.jenisKelamin}
                          </td>
                          <td className="border border-slate-900 px-2 py-1 text-center font-semibold">
                            {st.kelas}
                          </td>
                          <td className="border border-slate-900 px-2 py-1 h-7">
                            <div className={`flex items-center text-[9.5px] font-serif ${isOdd ? 'justify-start' : 'justify-end'}`}>
                              <span>{rowNum}. ..............</span>
                            </div>
                          </td>
                          <td className="border border-slate-900 px-2 py-1" />
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>

              <div className="grid grid-cols-2 gap-4 text-[10.5px] mb-3">
                <div className="border border-slate-800 p-2 leading-relaxed">
                  <p className="font-bold underline mb-0.5">REKAPITULASI KEHADIRAN:</p>
                  <p>1. Jumlah Peserta Seharusnya : <strong>{roomStudents.length}</strong> orang</p>
                  <p>2. Jumlah Peserta Hadir : .......... orang</p>
                  <p>3. Jumlah Peserta Tidak Hadir : .......... orang</p>
                </div>
                <div className="border border-dashed border-slate-400 p-2 text-[9.5px] text-slate-600 flex items-center justify-center text-center">
                  Daftar hadir diurutkan berdasarkan tingkat/kelas terendah lalu alfabetis (A–Z) untuk memudahkan pengecekan presensi ruang.
                </div>
              </div>

              <div className="flex justify-between items-start text-[11px] font-serif mt-4 px-4">
                <div className="text-center w-56 leading-tight">
                  <p className="font-bold">Pengawas Ruang I,</p>
                  <div className="h-14" />
                  <p className="font-bold underline">
                    {formatPersonNameAndTitle(pengawas1?.nama) || '...........................................'}
                  </p>
                  <p className="text-[9.5px] font-sans">NIP. {pengawas1?.nip || '...........................'}</p>
                </div>

                <div className="text-center w-56 leading-tight">
                  <p className="text-[10px]">
                    {profile.tempatTandaTangan ? `${profile.tempatTandaTangan}, ` : ''}
                    {formatDayAndDate(schedule.tanggal)}
                  </p>
                  <p className="font-bold">Pengawas Ruang II,</p>
                  <div className="h-14" />
                  <p className="font-bold underline">
                    {formatPersonNameAndTitle(pengawas2?.nama) || '...........................................'}
                  </p>
                  <p className="text-[9.5px] font-sans">NIP. {pengawas2?.nip || '...........................'}</p>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};
