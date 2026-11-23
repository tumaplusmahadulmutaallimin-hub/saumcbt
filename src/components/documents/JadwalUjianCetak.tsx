import React from 'react';
import {
  ExamConfig,
  ExamRoom,
  ExamSchedule,
  ExamSubject,
  MadrasahProfile,
  PaperPreset,
  Supervisor,
  SupervisorAssignment,
} from '../../types';
import { KopSurat } from './KopSurat';
import { formatIndonesianDate } from '../../utils/qrBarcode';
import { getSheetScreenStyle } from '../../utils/printLayout';
import { formatPersonNameAndTitle } from '../../utils/formatName';
import { buildSchedulePrintModel, SchedulePrintVersion } from '../../utils/schedulePrint';

interface JadwalUjianCetakProps {
  profile: MadrasahProfile;
  examConfig?: ExamConfig;
  schedules: ExamSchedule[];
  subjects: ExamSubject[];
  rooms: ExamRoom[];
  supervisors?: Supervisor[];
  supervisorAssignments?: SupervisorAssignment[];
  paperPreset?: PaperPreset;
  version?: SchedulePrintVersion;
}

export const JadwalUjianCetak: React.FC<JadwalUjianCetakProps> = ({
  profile,
  examConfig,
  schedules,
  subjects,
  rooms,
  supervisors = [],
  supervisorAssignments = [],
  paperPreset,
  version = 'lengkap',
}) => {
  const isLengkap = version !== 'siswa';

  const { classes, rows, supervisorDirectory } = buildSchedulePrintModel({
    schedules,
    subjects,
    rooms,
    supervisors,
    supervisorAssignments,
    examConfig,
  });

  const effectivePreset: PaperPreset | undefined = paperPreset
    ? {
        ...paperPreset,
        size: paperPreset.size || 'F4',
        orientation: paperPreset.orientation || 'landscape',
      }
    : undefined;

  const sheetStyle = getSheetScreenStyle(effectivePreset, {
    size: 'F4',
    orientation: 'landscape',
    marginMm: 15,
  });

  if (rows.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
        <p className="text-slate-500 font-medium">
          Belum ada jadwal ujian yang tersimpan. Tambahkan jadwal ujian di menu Jadwal Ujian terlebih dahulu.
        </p>
      </div>
    );
  }

  // Auto-fit typography & cell padding so the entire schedule fits on 1 F4 Landscape page (300 x 180 mm)
  const isUltraDense = rows.length > 12;
  const isDense = rows.length > 8 && rows.length <= 12;
  const tableTextClass = isUltraDense
    ? 'text-[7.5px] leading-tight'
    : isDense
    ? 'text-[8.5px] leading-tight'
    : 'text-[9.5px] leading-snug';
  const cellPadClass = isUltraDense ? 'px-1 py-0.5' : isDense ? 'px-1.5 py-1' : 'px-1.5 py-1.5';
  const hasRoomSupervisorData = rows.some((r) => r.roomSupervisors.length > 0);

  return (
    <div className="print-container w-full block print:m-0 print:p-0">
      <div
        style={sheetStyle}
        data-testid="jadwal-ujian-page"
        data-version={version}
        className="saum-sheet schedule-print border border-slate-300 shadow-sm mb-8 print:mb-0"
      >
        <div>
          {(effectivePreset?.showKop ?? true) && <KopSurat profile={profile} isCompact />}

          <div className={`text-center ${isUltraDense ? 'my-1' : 'my-2'}`}>
            <h2
              className={`${
                isUltraDense ? 'text-xs' : 'text-sm'
              } font-extrabold uppercase font-serif tracking-wide underline`}
            >
              {isLengkap
                ? 'JADWAL PELAKSANAAN UJIAN & PENUGASAN PENGAWAS (ADMIN / PENGAWAS)'
                : 'JADWAL PELAKSANAAN UJIAN MADRASAH & KETENTUAN SERAGAM (VERSI SISWA)'}
            </h2>
            <p className="text-[10.5px] font-semibold uppercase mt-0.5">
              {(examConfig?.namaUjian || profile.jenisUjian || 'UJIAN MADRASAH').toUpperCase()} &bull; TAHUN PELAJARAN{' '}
              {profile.tahunPelajaran || '-'}
            </p>
            <p className="text-[9px] text-slate-700 mt-0.5">
              Moda: {examConfig?.moda === 'online' ? `Online (${examConfig.jumlahSesi} Sesi)` : 'Kertas (PBT)'} &bull;{' '}
              Jam Pelaksanaan: {examConfig?.jamPelaksanaan || '07:30 - 12:00 WIB'}
            </p>
          </div>

          <table
            data-testid={isLengkap ? 'jadwal-table-lengkap' : 'jadwal-table-siswa'}
            className={`schedule-table w-full ${tableTextClass} border-2 border-black mb-2`}
          >
            <thead>
              <tr className="bg-slate-100 font-extrabold text-slate-950">
                <th rowSpan={2} className={`${cellPadClass} w-7 text-center uppercase`}>
                  NO
                </th>
                <th
                  rowSpan={2}
                  className={`${cellPadClass} ${isLengkap ? 'w-[12%]' : 'w-[15%]'} text-left uppercase`}
                >
                  HARI / TANGGAL
                </th>
                <th
                  rowSpan={2}
                  className={`${cellPadClass} ${isLengkap ? 'w-[8%]' : 'w-[10%]'} text-center uppercase`}
                >
                  WAKTU
                </th>
                <th
                  rowSpan={2}
                  className={`${cellPadClass} ${isLengkap ? 'w-[5.5%]' : 'w-[7%]'} text-center uppercase`}
                >
                  SESI
                </th>
                <th
                  colSpan={Math.max(1, classes.length)}
                  className={`${cellPadClass} text-center uppercase bg-slate-200/70`}
                >
                  {classes.length > 0 ? 'MATA PELAJARAN PER KELAS' : 'MATA PELAJARAN'}
                </th>
                {isLengkap && (
                  <th rowSpan={2} className={`${cellPadClass} w-[13%] text-left uppercase bg-emerald-50/70`}>
                    KODE PENGAWAS
                  </th>
                )}
                <th
                  rowSpan={2}
                  className={`${cellPadClass} ${isLengkap ? 'w-[14%]' : 'w-[22%]'} text-left uppercase bg-amber-50/70`}
                >
                  SERAGAM
                </th>
                {isLengkap && (
                  <th rowSpan={2} className={`${cellPadClass} w-[18%] text-left uppercase bg-emerald-50/70`}>
                    DAFTAR PENGAWAS
                  </th>
                )}
              </tr>
              <tr className="bg-slate-100 font-extrabold text-slate-900">
                {classes.length > 0 ? (
                  classes.map((cls) => (
                    <th key={cls} className={`${cellPadClass} text-center`}>
                      {cls}
                    </th>
                  ))
                ) : (
                  <th className={`${cellPadClass} text-center`}>Mapel</th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.schedule.id}>
                  <td className={`${cellPadClass} text-center tabular-nums font-bold`}>
                    {row.no}
                  </td>

                  {row.dayRowSpan > 0 && (
                    <td
                      rowSpan={row.dayRowSpan}
                      className={`${cellPadClass} font-bold text-slate-950 align-middle`}
                    >
                      {row.dayDisplay}
                    </td>
                  )}

                  {row.timeRowSpan > 0 && (
                    <td
                      rowSpan={row.timeRowSpan}
                      className={`${cellPadClass} text-center font-mono font-bold tabular-nums align-middle whitespace-nowrap`}
                    >
                      {row.timeDisplay}
                    </td>
                  )}

                  {row.sesiRowSpan > 0 && (
                    <td
                      rowSpan={row.sesiRowSpan}
                      className={`${cellPadClass} text-center font-bold tabular-nums align-middle whitespace-nowrap`}
                    >
                      {row.sesiDisplay}
                    </td>
                  )}

                  {classes.length > 0 ? (
                    row.classSubjects.map(({ kelas, subject }) => (
                      <td key={kelas} className={`${cellPadClass} text-center align-middle`}>
                        {subject ? (
                          <div>
                            <div className="font-bold uppercase leading-tight">{subject.nama}</div>
                            <div className="text-[7.5px] text-slate-600 font-mono">({subject.kode})</div>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    ))
                  ) : (
                    <td className={`${cellPadClass} text-center align-middle`}>
                      {row.singleSubject ? (
                        <div>
                          <div className="font-bold uppercase leading-tight">{row.singleSubject.nama}</div>
                          <div className="text-[7.5px] text-slate-600 font-mono">({row.singleSubject.kode})</div>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  )}

                  {isLengkap && (
                    <td className={`${cellPadClass} font-mono align-middle bg-emerald-50/20 break-words`}>
                      {row.roomSupervisors.length > 0 ? (
                        <div className="space-y-0.5">
                          {row.roomSupervisors.map((rs, idx) => (
                            <div key={idx} className="leading-tight">
                              <span className="font-bold text-slate-900">{rs.roomLabel}:</span>{' '}
                              <span className="font-extrabold text-emerald-900">{rs.codes.join(', ')}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  )}

                  {row.seragamRowSpan > 0 && (
                    <td
                      rowSpan={row.seragamRowSpan}
                      className={`${cellPadClass} align-middle bg-amber-50/20`}
                    >
                      {row.uniformEntries.length > 0 ? (
                        <div className="space-y-0.5">
                          {row.uniformEntries.map((entry) => (
                            <div key={entry.jenjang} className="flex items-start justify-between gap-1">
                              <span className="font-extrabold text-slate-950 shrink-0">{entry.jenjang}:</span>
                              <span className="text-right font-semibold text-slate-800">{entry.seragam}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  )}

                  {isLengkap && (
                    <td className={`${cellPadClass} align-middle bg-emerald-50/20 break-words`}>
                      {row.roomSupervisors.length > 0 ? (
                        <div className="space-y-0.5">
                          {row.roomSupervisors.map((rs, idx) => (
                            <div key={idx} className="leading-tight">
                              <span className="font-bold text-slate-800">{rs.roomLabel}:</span>{' '}
                              <span className="font-semibold text-slate-950">{rs.names.join(' / ')}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Belum dipetakan</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {isLengkap && !hasRoomSupervisorData && supervisorDirectory.length > 0 && (
            <div className="border border-slate-700 bg-slate-50 px-2.5 py-1 text-[8px] mb-1.5">
              <strong>Daftar Kode Pengawas:</strong>{' '}
              {supervisorDirectory.map((d) => `${d.kode}. ${d.formattedName}`).join('  |  ')}
            </div>
          )}

          <div className="border border-slate-800 bg-slate-50 px-2.5 py-1 text-[8.5px]">
            <strong>Catatan Seragam Ujian:</strong> Peserta dari jenjang berbeda yang duduk bersebelahan dalam satu ruang ujian (silang jenjang) wajib mengenakan seragam yang berbeda sesuai kolom ketentuan seragam di atas.
          </div>
        </div>

        <div className={`flex justify-between items-start text-[10px] font-serif ${isUltraDense ? 'mt-1.5' : 'mt-2.5'} px-4`}>
          <div className="text-center w-56 leading-tight">
            <p className="font-bold">Mengetahui,</p>
            <p className="font-bold">Kepala Madrasah,</p>
            <div className={`${isUltraDense ? 'h-8' : 'h-10'} flex items-center justify-center`}>
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
            <p className="text-[8.5px] font-sans">NIP. {profile.nipKepala || '-'}</p>
          </div>
          <div className="text-center w-56 leading-tight">
            <p>
              {profile.tempatTandaTangan ? `${profile.tempatTandaTangan}, ` : ''}
              {formatIndonesianDate(profile.tanggalSurat)}
            </p>
            <p className="font-bold">Ketua Panitia Ujian,</p>
            <div className={isUltraDense ? 'h-8' : 'h-10'} />
            <p className="font-bold underline">
              {formatPersonNameAndTitle(profile.namaKetuaPanitia || profile.namaKepala) || '.........................'}
            </p>
            <p className="text-[8.5px] font-sans">NIP. {profile.nipKetuaPanitia || '-'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
