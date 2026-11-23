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
import { getSheetScreenStyle } from '../../utils/printLayout';
import { formatPersonNameAndTitle } from '../../utils/formatName';

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

  const sheetStyle = getSheetScreenStyle(paperPreset);

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

  if (filtered.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
        <p className="text-slate-500 font-medium">
          Belum ada peserta aktif yang sesuai filter untuk dokumen {titles[mode]}.
        </p>
      </div>
    );
  }

  return (
    <div className="print-container w-full block print:m-0 print:p-0">
      <div
        style={sheetStyle}
        className="saum-sheet border border-slate-300 shadow-sm print-page-break mb-8 print:mb-0"
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

        <table className="w-full text-[9px] border-collapse border border-slate-900 mb-4">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-900 px-1 py-1.5 w-6 text-center">No</th>
              <th className="border border-slate-900 px-1.5 py-1.5 w-22 text-center">No. Peserta</th>
              <th className="border border-slate-900 px-1.5 py-1.5 w-20 text-center">User Ujian</th>
              <th className="border border-slate-900 px-1.5 py-1.5 w-16 text-center">Password</th>
              <th className="border border-slate-900 px-1 py-1.5 w-10 text-center">Meja</th>
              <th className="border border-slate-900 px-1.5 py-1.5 w-18 text-center">NISN</th>
              <th className="border border-slate-900 px-1.5 py-1.5 w-14 text-center">NIS</th>
              <th className="border border-slate-900 px-1.5 py-1.5 text-left">Nama Peserta</th>
              <th className="border border-slate-900 px-1 py-1.5 w-6 text-center">JK</th>
              {showFullIdentity && (
                <th className="border border-slate-900 px-1.5 py-1.5 text-left w-32">Tempat, Tgl Lahir</th>
              )}
              <th className="border border-slate-900 px-1 py-1.5 w-12 text-center">Kelas</th>
              {isOnline && (
                <th className="border border-slate-900 px-1 py-1.5 w-11 text-center">Sesi</th>
              )}
              <th className="border border-slate-900 px-1 py-1.5 w-16 text-center">Ruang</th>
              {hasAnyLink && (
                <th className="border border-slate-900 px-1.5 py-1.5 text-left">Alamat Link</th>
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.map((st, idx) => {
              const room = st.ruangId ? roomMap.get(st.ruangId) : undefined;
              const link = st.customLink || numberingConfig?.manualLinkUrl || '-';
              return (
                <tr key={st.id}>
                  <td className="border border-slate-900 px-1 py-1 text-center tabular-nums">{idx + 1}</td>
                  <td className="border border-slate-900 px-1.5 py-1 text-center font-mono font-bold">
                    {st.nomorPeserta || '-'}
                  </td>
                  <td className="border border-slate-900 px-1.5 py-1 text-center font-mono font-bold">
                    {st.usernameUjian || '-'}
                  </td>
                  <td className="border border-slate-900 px-1.5 py-1 text-center font-mono">
                    {st.passwordUjian || '-'}
                  </td>
                  <td className="border border-slate-900 px-1 py-1 text-center font-mono font-bold tabular-nums">
                    {st.nomorMeja ? String(st.nomorMeja).padStart(2, '0') : '-'}
                  </td>
                  <td className="border border-slate-900 px-1.5 py-1 text-center font-mono tabular-nums">{st.nisn}</td>
                  <td className="border border-slate-900 px-1.5 py-1 text-center font-mono tabular-nums">{st.nis}</td>
                  <td className="border border-slate-900 px-1.5 py-1 font-semibold">{formatPersonNameAndTitle(st.nama)}</td>
                  <td className="border border-slate-900 px-1 py-1 text-center">{st.jenisKelamin}</td>
                  {showFullIdentity && (
                    <td className="border border-slate-900 px-1.5 py-1 text-[8.5px]">
                      {st.tempatLahir}, {formatIndonesianDate(st.tanggalLahir)}
                    </td>
                  )}
                  <td className="border border-slate-900 px-1 py-1 text-center font-semibold">{st.kelas}</td>
                  {isOnline && (
                    <td className="border border-slate-900 px-1 py-1 text-center font-bold tabular-nums">
                      {st.sesi ? `Sesi ${st.sesi}` : '-'}
                    </td>
                  )}
                  <td className="border border-slate-900 px-1 py-1 text-center">
                    {room ? room.namaRuang : '-'}
                  </td>
                  {hasAnyLink && (
                    <td className="border border-slate-900 px-1.5 py-1 font-mono text-[8px] break-all">
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
            <p className="font-bold underline">{formatPersonNameAndTitle(profile.namaKepala) || '.........................'}</p>
            <p className="text-[9.5px] font-sans">NIP. {profile.nipKepala || '-'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
