import React from 'react';
import {
  ExamConfig,
  ExamRoom,
  MadrasahProfile,
  PaperPreset,
  PhysicalClassroom,
  Student,
  Supervisor,
} from '../../types';
import { KopSurat } from './KopSurat';
import { formatIndonesianDate } from '../../utils/qrBarcode';
import { computeClassRangesInRoom } from '../../utils/seating';
import { getSheetScreenStyle } from '../../utils/printLayout';
import { formatPersonNameAndTitle } from '../../utils/formatName';

interface DenahLokasiCetakProps {
  profile: MadrasahProfile;
  examConfig?: ExamConfig;
  physicalClassrooms: PhysicalClassroom[];
  rooms: ExamRoom[];
  students: Student[];
  supervisors?: Supervisor[];
  paperPreset?: PaperPreset;
}

export const DenahLokasiCetak: React.FC<DenahLokasiCetakProps> = ({
  profile,
  examConfig,
  physicalClassrooms,
  rooms,
  students,
  supervisors = [],
  paperPreset,
}) => {
  const roomMap = new Map(rooms.map((r) => [r.id, r]));
  const supervisorMap = new Map(supervisors.map((s) => [s.id, s]));

  const sheetStyle = getSheetScreenStyle(paperPreset, { orientation: 'landscape' });

  // Fixed 2 rows x 3 cols grid matching exact layout
  const getCell = (row: 0 | 1, col: 0 | 1 | 2) =>
    physicalClassrooms.find((pc) => pc.row === row && pc.col === col);

  const topRow = [getCell(0, 0), getCell(0, 1), getCell(0, 2)];
  const bottomRow = [getCell(1, 0), getCell(1, 1), getCell(1, 2)];

  const renderClassroomBox = (pc?: PhysicalClassroom) => {
    if (!pc) {
      return <div className="border border-dashed border-slate-300 bg-slate-50 rounded p-3 min-h-[115px]" />;
    }

    const assignedRooms = pc.assignedRoomIds
      .map((id) => roomMap.get(id))
      .filter((r): r is ExamRoom => Boolean(r));
    const isActive = assignedRooms.length > 0;

    return (
      <div
        key={pc.id}
        className={`border-2 rounded p-2.5 min-h-[120px] flex flex-col justify-between ${
          isActive
            ? 'border-emerald-800 bg-emerald-50 text-emerald-950'
            : 'border-slate-500 bg-slate-200/80 text-slate-700'
        }`}
      >
        <div className="flex items-start justify-between gap-2 border-b border-current/20 pb-1">
          <span className="text-[11px] font-extrabold tracking-wide uppercase">{pc.namaKelas}</span>
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
              isActive ? 'bg-emerald-800 text-white' : 'bg-slate-600 text-white'
            }`}
          >
            {isActive
              ? assignedRooms.map((r) => `RUANG ${r.nomorRuang}`).join(' / ')
              : 'Tidak Digunakan'}
          </span>
        </div>

        {isActive ? (
          <div className="mt-1.5 space-y-1 text-[9.5px] leading-snug">
            {assignedRooms.map((r) => {
              const roomStudents = students.filter((s) => s.ruangId === r.id && s.status === 'Aktif');
              const ranges = computeClassRangesInRoom(roomStudents, students);
              const p1 = r.pengawas1Id ? formatPersonNameAndTitle(supervisorMap.get(r.pengawas1Id)?.nama) : undefined;
              const p2 = r.pengawas2Id ? formatPersonNameAndTitle(supervisorMap.get(r.pengawas2Id)?.nama) : undefined;
              const sesiEntries = pc.sessionRoomMap
                ? Object.entries(pc.sessionRoomMap).filter(([, rId]) => rId === r.id)
                : [];

              return (
                <div key={r.id} className="space-y-0.5">
                  <div className="flex items-center justify-between font-bold">
                    <span>{r.namaRuang} ({roomStudents.length} peserta)</span>
                    {examConfig?.moda === 'online' && sesiEntries.length > 0 && (
                      <span className="font-mono text-[9px]">
                        Sesi {sesiEntries.map(([s]) => s).join(', ')}
                      </span>
                    )}
                  </div>
                  <div className="text-[8.5px] text-emerald-900">
                    {ranges.map((rg) => `${rg.kelas}: ${rg.count}`).join(' • ')}
                  </div>
                  {(p1 || p2) && (
                    <div className="text-[8.5px] text-slate-700 truncate">
                      Pengawas: {[p1, p2].filter(Boolean).join('; ')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="my-auto text-center text-[10px] italic text-slate-500 py-3">
            Ruang kelas reguler (tidak dipakai ujian)
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col items-center overflow-x-auto">
      <div
        style={sheetStyle}
        className="saum-sheet border border-slate-300 shadow-sm print-page-break"
      >
        {(paperPreset?.showKop ?? true) && <KopSurat profile={profile} isCompact />}

        <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2 mb-3">
          <div>
            <h2 className="text-sm font-extrabold uppercase font-serif tracking-wide">
              DENAH LOKASI RUANG UJIAN
            </h2>
            <p className="text-[11px] font-semibold text-slate-700">
              {examConfig?.namaUjian || profile.jenisUjian} • Tahun Pelajaran {profile.tahunPelajaran}
              {examConfig?.moda === 'online' ? ` • Moda Online (${examConfig.jumlahSesi} Sesi)` : ' • Moda Kertas'}
            </p>
          </div>
          {/* Compass North */}
          <div className="flex items-center gap-1.5 border border-slate-800 px-2.5 py-1 rounded bg-slate-50">
            <svg width="20" height="22" viewBox="0 0 24 26" className="text-slate-900">
              <polygon points="12,1 18,16 12,12 6,16" fill="currentColor" />
              <line x1="12" y1="12" x2="12" y2="25" stroke="currentColor" strokeWidth="1.8" />
            </svg>
            <div className="leading-none">
              <span className="text-xs font-black">U</span>
              <p className="text-[8px] text-slate-600 uppercase">Utara</p>
            </div>
          </div>
        </div>

        {/* Exact Schematic Layout per Section F.2 */}
        <div className="border-2 border-slate-900 p-3 rounded-sm bg-white">
          {/* Top-right: RUANG GURU above rightmost column */}
          <div className="grid grid-cols-[36px_1fr_1fr_1fr] gap-3 mb-2">
            <div />
            <div />
            <div />
            <div className="border-2 border-slate-900 bg-white px-3 py-2 text-center font-extrabold text-xs uppercase tracking-wider">
              RUANG GURU
            </div>
          </div>

          {/* Main Grid: Vertical JALAN strip on the left + 2x3 Classroom Grid */}
          <div className="grid grid-cols-[36px_1fr] gap-3">
            {/* Vertical JALAN Bar alongside Left Column */}
            <div className="border-2 border-slate-900 bg-slate-100 flex items-center justify-center rounded-xs">
              <span
                className="font-extrabold text-[11px] tracking-[0.35em] text-slate-800 uppercase"
                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
              >
                JALAN
              </span>
            </div>

            {/* 2 Rows x 3 Columns Physical Classrooms */}
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                {topRow.map((pc) => renderClassroomBox(pc))}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {bottomRow.map((pc) => renderClassroomBox(pc))}
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-3 pt-2 border-t border-slate-300 flex flex-wrap items-center justify-between gap-3 text-[10px]">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 inline-block border-2 border-emerald-800 bg-emerald-100" />
                <span className="font-semibold">Digunakan sebagai Ruang Ujian</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 inline-block border-2 border-slate-500 bg-slate-200" />
                <span className="font-semibold">Tidak Digunakan</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 inline-block border-2 border-slate-900 bg-white" />
                <span className="font-semibold">Ruang Guru / Akses Jalan</span>
              </div>
            </div>
            <span className="text-slate-600 font-medium">
              Total Ruang Aktif: {rooms.length} Ruang • Total Peserta: {students.filter((s) => s.status === 'Aktif').length} Siswa
            </span>
          </div>
        </div>

        {/* Signatures */}
        <div className="mt-4 flex justify-between items-start text-[11px] font-serif px-4">
          <div className="text-center w-60 leading-tight">
            <p className="font-bold">Mengetahui,</p>
            <p className="font-bold">Kepala Madrasah,</p>
            <div className="h-12 flex items-center justify-center">
              {profile.ttdKepalaUrl && (
                <img
                  src={profile.ttdKepalaUrl}
                  alt="TTD Kepala Madrasah"
                  className="max-h-12 max-w-[130px] object-contain mx-auto"
                />
              )}
            </div>
            <p className="font-bold underline">{formatPersonNameAndTitle(profile.namaKepala) || '.........................'}</p>
            <p className="text-[10px] font-sans">NIP. {profile.nipKepala || '-'}</p>
          </div>

          <div className="text-center w-60 leading-tight">
            <p>
              {profile.tempatTandaTangan ? `${profile.tempatTandaTangan}, ` : ''}
              {formatIndonesianDate(profile.tanggalSurat)}
            </p>
            <p className="font-bold">Ketua Panitia Ujian,</p>
            <div className="h-12" />
            <p className="font-bold underline">
              {formatPersonNameAndTitle(profile.namaKetuaPanitia || profile.namaKepala) || '.........................'}
            </p>
            <p className="text-[10px] font-sans">NIP. {profile.nipKetuaPanitia || '-'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
