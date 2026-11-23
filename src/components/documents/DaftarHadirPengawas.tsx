import React from 'react';
import {
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

interface DaftarHadirPengawasProps {
  profile: MadrasahProfile;
  schedules: ExamSchedule[];
  subjects: ExamSubject[];
  supervisors: Supervisor[];
  rooms?: ExamRoom[];
  supervisorAssignments?: SupervisorAssignment[];
  paperPreset?: PaperPreset;
}

export const DaftarHadirPengawas: React.FC<DaftarHadirPengawasProps> = ({
  profile,
  supervisors,
  rooms = [],
  supervisorAssignments = [],
  paperPreset,
}) => {
  const roomMap = new Map(rooms.map((r) => [r.id, r]));

  const resolveAssignedRooms = (supId: string): string => {
    const roomNames = new Set<string>();
    rooms.forEach((r) => {
      if (r.pengawas1Id === supId || r.pengawas2Id === supId) {
        roomNames.add(r.namaRuang);
      }
    });
    supervisorAssignments.forEach((a) => {
      if (a.pengawas1Id === supId || a.pengawas2Id === supId) {
        const r = roomMap.get(a.roomId);
        if (r) roomNames.add(r.namaRuang);
      }
    });
    return roomNames.size > 0 ? Array.from(roomNames).join(', ') : 'Cadangan';
  };

  const sheetStyle = getSheetScreenStyle(paperPreset);

  if (supervisors.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
        <p className="text-slate-500 font-medium">
          Belum ada data pengawas ujian. Tambahkan pengawas di menu Pengawas terlebih dahulu.
        </p>
      </div>
    );
  }

  return (
    <div className="print-container w-full block print:m-0 print:p-0">
      <div
        style={sheetStyle}
        className="saum-sheet border border-slate-300 shadow-sm print-page-break mb-8 print:mb-0 text-[11px] leading-relaxed"
      >
        {(paperPreset?.showKop ?? true) && <KopSurat profile={profile} isCompact />}

        <div className="text-center my-3">
          <h2 className="text-sm font-extrabold uppercase font-serif tracking-wide underline">
            DAFTAR HADIR PENGAWAS UJIAN
          </h2>
          <p className="text-xs font-semibold uppercase mt-0.5">
            {(profile.jenisUjian || 'UJIAN MADRASAH').toUpperCase()} • TAHUN PELAJARAN {profile.tahunPelajaran || '-'}
          </p>
        </div>

        <table className="w-full text-[10.5px] border-collapse border border-slate-900 mt-4">
          <thead>
            <tr className="bg-slate-100 font-bold">
              <th className="border border-slate-900 px-2 py-1.5 w-8 text-center">No</th>
              <th className="border border-slate-900 px-3 py-1.5 text-left">Nama Pengawas</th>
              <th className="border border-slate-900 px-3 py-1.5 w-28 text-left">NIP / NUPTK</th>
              <th className="border border-slate-900 px-3 py-1.5 w-36 text-left">Asal Madrasah</th>
              <th className="border border-slate-900 px-3 py-1.5 w-28 text-center">Ruang Tugas</th>
              <th className="border border-slate-900 px-3 py-1.5 w-32 text-center">Tanda Tangan</th>
              <th className="border border-slate-900 px-2 py-1.5 w-16 text-center">Ket.</th>
            </tr>
          </thead>
          <tbody>
            {supervisors.map((sp, idx) => (
              <tr key={sp.id} className="h-9">
                <td className="border border-slate-900 px-2 py-1 text-center font-medium tabular-nums">
                  {idx + 1}
                </td>
                <td className="border border-slate-900 px-3 py-1 font-bold">{formatPersonNameAndTitle(sp.nama)}</td>
                <td className="border border-slate-900 px-3 py-1 font-mono">{sp.nip || '-'}</td>
                <td className="border border-slate-900 px-3 py-1">{sp.asalMadrasah}</td>
                <td className="border border-slate-900 px-3 py-1 text-center font-medium">
                  {resolveAssignedRooms(sp.id)}
                </td>
                <td className="border border-slate-900 px-2 py-1">
                  <span className="text-[10px] font-serif pl-1">{idx + 1}. ................</span>
                </td>
                <td className="border border-slate-900 px-2 py-1 text-center font-medium">
                  {sp.status === 'Aktif' ? 'Aktif' : 'Nonaktif'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 p-2.5 border border-slate-800 text-xs bg-slate-50 flex justify-between items-center">
          <div>
            <p className="font-bold">Total Pengawas Terdaftar: {supervisors.length} orang</p>
            <p className="text-slate-600">
              Jumlah Tugas Terpetakan: {supervisorAssignments.length} slot ruang-jadwal
            </p>
          </div>
          <div className="text-right text-slate-600 italic">
            Wajib hadir 30 menit sebelum ujian dimulai
          </div>
        </div>

        <div className="mt-8 flex justify-between items-start text-xs font-serif">
          <div className="text-center w-56 leading-tight">
            <p className="font-bold">Ketua Panitia Ujian,</p>
            <div className="h-14" />
            <p className="font-bold underline text-slate-950">
              {formatPersonNameAndTitle(profile.namaKetuaPanitia || profile.namaKepala) || '.........................'}
            </p>
            <p className="text-[10px] font-sans">NIP. {profile.nipKetuaPanitia || '-'}</p>
          </div>

          <div className="text-center w-56 leading-tight">
            <p className="text-[11px]">
              {profile.tempatTandaTangan ? `${profile.tempatTandaTangan}, ` : ''}
              {formatIndonesianDate(profile.tanggalSurat)}
            </p>
            <p className="font-bold">Kepala Madrasah,</p>
            <div className="h-14 flex items-center justify-center">
              {profile.ttdKepalaUrl && (
                <img
                  src={profile.ttdKepalaUrl}
                  alt="TTD Kepala Madrasah"
                  className="max-h-14 max-w-[140px] object-contain mx-auto"
                />
              )}
            </div>
            <p className="font-bold underline text-slate-950">
              {formatPersonNameAndTitle(profile.namaKepala) || '.........................'}
            </p>
            <p className="text-[10px] font-sans">NIP. {profile.nipKepala || '-'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
