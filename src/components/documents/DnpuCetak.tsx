import React from 'react';
import {
  ExamConfig,
  ExamRoom,
  MadrasahProfile,
  NumberingConfig,
  PaperPreset,
  Student,
} from '../../types';
import { KopSurat } from './KopSurat';
import { compareClasses } from '../../utils/numbering';
import { formatIndonesianDate } from '../../utils/qrBarcode';

interface DnpuCetakProps {
  profile: MadrasahProfile;
  examConfig?: ExamConfig;
  students: Student[];
  rooms: ExamRoom[];
  numberingConfig?: NumberingConfig;
  mode: 'dnpu' | 'nomor_peserta' | 'pembagian_ruang';
  selectedRoomId?: string;
  paperPreset?: PaperPreset;
}

export const DnpuCetak: React.FC<DnpuCetakProps> = ({
  profile,
  examConfig,
  students,
  rooms,
  numberingConfig,
  mode,
  selectedRoomId,
  paperPreset,
}) => {
  const roomMap = new Map(rooms.map((r) => [r.id, r]));
  const filtered = students
    .filter((s) => s.status === 'Aktif' && (!selectedRoomId || selectedRoomId === 'all' || s.ruangId === selectedRoomId))
    .sort((a, b) => {
      const c = compareClasses(a.kelas, b.kelas, numberingConfig?.urutanKelas);
      if (c !== 0) return c;
      return a.nama.localeCompare(b.nama, 'id');
    });

  const isF4 = paperPreset?.size === 'F4';
  const isLandscape = paperPreset?.orientation === 'landscape';
  const sheetClass = isLandscape
    ? isF4
      ? 'w-[330mm] min-h-[215mm]'
      : 'w-[297mm] min-h-[210mm]'
    : isF4
    ? 'w-[215mm] min-h-[330mm]'
    : 'w-[210mm] min-h-[297mm]';

  const isOnline = examConfig?.moda === 'online';
  const hasAnyLink =
    mode === 'nomor_peserta' &&
    Boolean(numberingConfig?.manualLinkUrl || filtered.some((s) => Boolean(s.customLink)));
  const showFullIdentity = mode === 'nomor_peserta' || mode === 'dnpu';

  const titles = {
    dnpu: 'DAFTAR NOMINASI PESERTA UJIAN (DNPU)',
    nomor_peserta: 'DAFTAR NOMOR PESERTA & IDENTITAS LENGKAP UJIAN',
    pembagian_ruang: 'DAFTAR PEMBAGIAN RUANG & SESI PESERTA UJIAN',
  };

  return (
    <div className="w-full flex flex-col items-center">
      <div
        className={`${sheetClass} p-[10mm] bg-white text-slate-900 border border-slate-300 shadow-sm print:border-none print:shadow-none print:p-0 print-page-break mb-8 print:mb-0`}
      >
        {(paperPreset?.showKop ?? true) && <KopSurat profile={profile} isCompact />}

        <div className="text-center my-3">
          <h2 className="text-sm font-extrabold uppercase font-serif tracking-wide underline">
            {titles[mode]}
          </h2>
          <p className="text-xs font-semibold uppercase mt-0.5">
            {examConfig?.namaUjian || profile.jenisUjian} • TAHUN PELAJARAN {profile.tahunPelajaran}
          </p>
        </div>

        {mode === 'nomor_peserta' && (
          <div className="mb-3 p-2.5 border border-slate-800 bg-slate-50 flex flex-wrap items-center justify-between gap-4 text-[10px]">
            <div className="space-y-0.5">
              <p>
                <span className="font-bold">Total Peserta Aktif:</span> {filtered.length} Peserta •{' '}
                <span className="font-bold">Moda:</span> {isOnline ? `Online (${examConfig?.jumlahSesi || 1} Sesi)` : 'Kertas'}
              </p>
              {numberingConfig?.manualLinkUrl && (
                <p>
                  <span className="font-bold">Alamat Link Ujian:</span>{' '}
                  <span className="font-mono">{numberingConfig.manualLinkUrl}</span>
                </p>
              )}
              <p className="text-slate-600">
                Mode Kode: <span className="font-bold uppercase">{numberingConfig?.barcodeMode || 'auto'}</span>
              </p>
            </div>
            {numberingConfig?.uploadedBarcodeUrl && (
              <img
                src={numberingConfig.uploadedBarcodeUrl}
                alt="Barcode Ujian"
                className="h-9 max-w-[120px] object-contain bg-white border border-slate-300 px-1"
              />
            )}
          </div>
        )}

        <table className="w-full text-[9.5px] border-collapse border border-slate-900 mb-4">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-900 px-1.5 py-1.5 w-7 text-center">No</th>
              <th className="border border-slate-900 px-2 py-1.5 w-24 text-center">No. Peserta</th>
              <th className="border border-slate-900 px-1.5 py-1.5 w-12 text-center">Meja</th>
              <th className="border border-slate-900 px-1.5 py-1.5 w-20 text-center">NISN</th>
              <th className="border border-slate-900 px-1.5 py-1.5 w-16 text-center">NIS</th>
              <th className="border border-slate-900 px-2 py-1.5 text-left">Nama Peserta</th>
              <th className="border border-slate-900 px-1 py-1.5 w-7 text-center">JK</th>
              {showFullIdentity && (
                <th className="border border-slate-900 px-2 py-1.5 text-left w-36">Tempat, Tgl Lahir</th>
              )}
              <th className="border border-slate-900 px-1.5 py-1.5 w-14 text-center">Kelas</th>
              {isOnline && (
                <th className="border border-slate-900 px-1.5 py-1.5 w-12 text-center">Sesi</th>
              )}
              <th className="border border-slate-900 px-1.5 py-1.5 w-20 text-center">Ruang</th>
              {hasAnyLink && (
                <th className="border border-slate-900 px-2 py-1.5 text-left">Alamat Link</th>
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.map((st, idx) => {
              const room = st.ruangId ? roomMap.get(st.ruangId) : undefined;
              const link = st.customLink || numberingConfig?.manualLinkUrl || '-';
              return (
                <tr key={st.id}>
                  <td className="border border-slate-900 px-1.5 py-1 text-center tabular-nums">{idx + 1}</td>
                  <td className="border border-slate-900 px-2 py-1 text-center font-mono font-bold">
                    {st.nomorPeserta || '-'}
                  </td>
                  <td className="border border-slate-900 px-1.5 py-1 text-center font-mono font-bold tabular-nums">
                    {st.nomorMeja ? String(st.nomorMeja).padStart(2, '0') : '-'}
                  </td>
                  <td className="border border-slate-900 px-1.5 py-1 text-center font-mono tabular-nums">{st.nisn}</td>
                  <td className="border border-slate-900 px-1.5 py-1 text-center font-mono tabular-nums">{st.nis}</td>
                  <td className="border border-slate-900 px-2 py-1 font-semibold uppercase">{st.nama}</td>
                  <td className="border border-slate-900 px-1 py-1 text-center">{st.jenisKelamin}</td>
                  {showFullIdentity && (
                    <td className="border border-slate-900 px-2 py-1 text-[9px]">
                      {st.tempatLahir}, {formatIndonesianDate(st.tanggalLahir)}
                    </td>
                  )}
                  <td className="border border-slate-900 px-1.5 py-1 text-center font-semibold">{st.kelas}</td>
                  {isOnline && (
                    <td className="border border-slate-900 px-1.5 py-1 text-center font-bold tabular-nums">
                      {st.sesi ? `Sesi ${st.sesi}` : '-'}
                    </td>
                  )}
                  <td className="border border-slate-900 px-1.5 py-1 text-center">
                    {room ? room.namaRuang : '-'}
                  </td>
                  {hasAnyLink && (
                    <td className="border border-slate-900 px-2 py-1 font-mono text-[8.5px] break-all">
                      {link}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="flex justify-end text-[11px] font-serif mt-4 px-4">
          <div className="text-center w-56 leading-tight">
            <p>
              {profile.tempatTandaTangan}, {formatIndonesianDate(profile.tanggalSurat)}
            </p>
            <p className="font-bold">Kepala Madrasah,</p>
            <div className="h-14" />
            <p className="font-bold underline uppercase">{profile.namaKepala}</p>
            <p className="text-[9.5px] font-sans">NIP. {profile.nipKepala || '-'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
