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
import { formatDayAndDate, formatIndonesianDate } from '../../utils/qrBarcode';
import { extractJenjang } from '../../utils/dnpu';

interface JadwalUjianCetakProps {
  profile: MadrasahProfile;
  examConfig?: ExamConfig;
  schedules: ExamSchedule[];
  subjects: ExamSubject[];
  rooms: ExamRoom[];
  supervisors?: Supervisor[];
  supervisorAssignments?: SupervisorAssignment[];
  paperPreset?: PaperPreset;
}

export const JadwalUjianCetak: React.FC<JadwalUjianCetakProps> = ({
  profile,
  examConfig,
  schedules,
  subjects,
  paperPreset,
}) => {
  const subjectMap = new Map(subjects.map((s) => [s.id, s]));

  const sortedSchedules = [...schedules].sort((a, b) => {
    const d = a.tanggal.localeCompare(b.tanggal);
    if (d !== 0) return d;
    return a.waktuMulai.localeCompare(b.waktuMulai);
  });

  const classes = examConfig?.registeredClasses && examConfig.registeredClasses.length > 0
    ? examConfig.registeredClasses
    : ['X-A', 'X-B', 'XI-A', 'XII-A', 'XII-B', 'XII-C'];

  const jenjangList = Array.from(new Set(classes.map((c) => extractJenjang(c))));

  const isF4 = paperPreset?.size === 'F4';
  const isLandscape = (paperPreset?.orientation || 'landscape') === 'landscape';
  const sheetClass = isLandscape
    ? isF4
      ? 'w-[330mm] min-h-[215mm]'
      : 'w-[297mm] min-h-[210mm]'
    : isF4
    ? 'w-[215mm] min-h-[330mm]'
    : 'w-[210mm] min-h-[297mm]';

  const getUniformMap = (sc: ExamSchedule): Record<string, string> => {
    const fromDay = examConfig?.seragamPerHariJenjang?.[sc.hari] || {};
    return { ...fromDay, ...(sc.seragamPerJenjang || {}) };
  };

  return (
    <div className="w-full flex flex-col items-center">
      <div
        className={`${sheetClass} p-[10mm] bg-white text-slate-900 border border-slate-300 shadow-sm print:border-none print:shadow-none print:p-0 print-page-break mb-8 print:mb-0`}
      >
        {(paperPreset?.showKop ?? true) && <KopSurat profile={profile} isCompact />}

        <div className="text-center my-3">
          <h2 className="text-sm font-extrabold uppercase font-serif tracking-wide underline">
            JADWAL PELAKSANAAN UJIAN MADRASAH & KETENTUAN SERAGAM
          </h2>
          <p className="text-xs font-semibold uppercase mt-0.5">
            {examConfig?.namaUjian || profile.jenisUjian} • TAHUN PELAJARAN {profile.tahunPelajaran}
          </p>
          <p className="text-[10.5px] text-slate-600 mt-0.5">
            Moda: {examConfig?.moda === 'online' ? `Online (${examConfig.jumlahSesi} Sesi)` : 'Kertas (PBT)'} • Jam:{' '}
            {examConfig?.jamPelaksanaan || '07:30 - 12:00 WIB'}
          </p>
        </div>

        {/* Kotak Tabel Jadwal Per Kelas + Kolom Seragam Per Jenjang */}
        <table className="w-full text-[10px] border-collapse border-2 border-slate-900 mb-5">
          <thead>
            <tr className="bg-slate-100">
              <th rowSpan={2} className="border border-slate-900 px-1.5 py-2 w-7 text-center">
                No
              </th>
              <th rowSpan={2} className="border border-slate-900 px-2 py-2 w-32 text-left">
                Hari / Tanggal
              </th>
              <th rowSpan={2} className="border border-slate-900 px-2 py-2 w-24 text-center">
                Waktu / Sesi
              </th>
              <th
                colSpan={classes.length}
                className="border border-slate-900 px-2 py-1 text-center font-extrabold uppercase bg-slate-200/70"
              >
                Mata Pelajaran Per Kelas
              </th>
              <th rowSpan={2} className="border border-slate-900 px-2 py-2 w-44 text-left bg-amber-50/70">
                Seragam Peserta (Pembeda Jenjang di Bangku)
              </th>
            </tr>
            <tr className="bg-slate-100">
              {classes.map((cls) => (
                <th key={cls} className="border border-slate-900 px-1.5 py-1.5 text-center font-extrabold">
                  {cls}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedSchedules.map((sc, idx) => {
              const uniformMap = getUniformMap(sc);
              return (
                <tr key={sc.id}>
                  <td className="border border-slate-900 px-1.5 py-2 text-center tabular-nums font-semibold">
                    {idx + 1}
                  </td>
                  <td className="border border-slate-900 px-2 py-2 font-semibold">
                    {formatDayAndDate(sc.tanggal)}
                  </td>
                  <td className="border border-slate-900 px-2 py-2 text-center font-mono text-[9.5px] tabular-nums">
                    <div className="font-bold">
                      {sc.waktuMulai}–{sc.waktuSelesai}
                    </div>
                    <div>
                      Jam {sc.jamKe || 1} • Sesi {sc.sesi}
                    </div>
                  </td>
                  {classes.map((cls) => {
                    const mappedId = sc.mapelPerKelas ? sc.mapelPerKelas[cls] : sc.mapelId;
                    const sub = mappedId ? subjectMap.get(mappedId) : undefined;
                    return (
                      <td key={cls} className="border border-slate-900 px-1.5 py-2 text-center align-middle">
                        {sub ? (
                          <div>
                            <div className="font-bold uppercase leading-tight">{sub.nama}</div>
                            <div className="text-[8.5px] text-slate-500 font-mono">({sub.kode})</div>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="border border-slate-900 px-2 py-1.5 align-top bg-amber-50/30">
                    <div className="space-y-0.5 text-[9.5px]">
                      {jenjangList.map((jen) => (
                        <div key={jen} className="flex items-start justify-between gap-1.5">
                          <span className="font-extrabold text-slate-900 shrink-0">{jen}:</span>
                          <span className="text-right font-semibold text-slate-800">
                            {uniformMap[jen] || '-'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="border border-slate-800 bg-slate-50 px-3 py-2 text-[9.5px] mb-5">
          <strong>Catatan Seragam Ujian:</strong> Peserta dari jenjang berbeda yang duduk bersebelahan dalam satu ruang ujian (silang jenjang) wajib mengenakan seragam yang berbeda sesuai kolom ketentuan hari ujian di atas.
        </div>

        <div className="flex justify-between items-start text-[11px] font-serif mt-4 px-4">
          <div className="text-center w-56 leading-tight">
            <p className="font-bold">Mengetahui,</p>
            <p className="font-bold">Kepala Madrasah,</p>
            <div className="h-12" />
            <p className="font-bold underline uppercase">{profile.namaKepala}</p>
            <p className="text-[9.5px] font-sans">NIP. {profile.nipKepala || '-'}</p>
          </div>
          <div className="text-center w-56 leading-tight">
            <p>
              {profile.tempatTandaTangan}, {formatIndonesianDate(profile.tanggalSurat)}
            </p>
            <p className="font-bold">Ketua Panitia Ujian,</p>
            <div className="h-12" />
            <p className="font-bold underline uppercase">{profile.namaKetuaPanitia || profile.namaKepala}</p>
            <p className="text-[9.5px] font-sans">NIP. {profile.nipKetuaPanitia || '-'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
