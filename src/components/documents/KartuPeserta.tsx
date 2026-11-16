import React from 'react';
import { ExamConfig, MadrasahProfile, Student, ExamRoom, NumberingConfig } from '../../types';
import { KopSurat } from './KopSurat';
import { SimpleBarcode, SimpleQRCode, formatIndonesianDate } from '../../utils/qrBarcode';

interface KartuPesertaProps {
  profile: MadrasahProfile;
  examConfig?: ExamConfig;
  students: Student[];
  rooms: ExamRoom[];
  numberingConfig?: NumberingConfig;
  selectedRoomId?: string;
  selectedStudentId?: string;
}

export const KartuPeserta: React.FC<KartuPesertaProps> = ({
  profile,
  examConfig,
  students,
  rooms,
  numberingConfig,
  selectedRoomId,
  selectedStudentId,
}) => {
  let filtered = students.filter((s) => s.status === 'Aktif');
  if (selectedRoomId && selectedRoomId !== 'all') {
    filtered = filtered.filter((s) => s.ruangId === selectedRoomId);
  }
  if (selectedStudentId && selectedStudentId !== 'all') {
    filtered = filtered.filter((s) => s.id === selectedStudentId);
  }

  const chunkSize = 4;
  const pages: Student[][] = [];
  for (let i = 0; i < filtered.length; i += chunkSize) {
    pages.push(filtered.slice(i, i + chunkSize));
  }

  const roomMap = new Map(rooms.map((r) => [r.id, r]));
  const barcodeMode = numberingConfig?.barcodeMode || 'auto';
  const showDeskNumber = numberingConfig?.showDeskNumber ?? true;

  if (filtered.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
        <p className="text-slate-500 font-medium">Tidak ada peserta yang cocok dengan filter yang dipilih.</p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center">
      {pages.map((pageStudents, pageIdx) => (
        <div
          key={pageIdx}
          className={`w-[210mm] min-h-[297mm] p-[10mm] bg-white text-slate-900 border border-slate-300 shadow-sm print:border-none print:shadow-none print:p-0 ${
            pageIdx < pages.length - 1 ? 'print-page-break mb-8 print:mb-0' : ''
          }`}
        >
          <div className="grid grid-cols-2 gap-[6mm] h-full">
            {pageStudents.map((st) => {
              const room = st.ruangId ? roomMap.get(st.ruangId) : undefined;
              const uploadedBarcode = st.barcodeUrl || numberingConfig?.uploadedBarcodeUrl;
              const effectiveLink = (st.customLink || numberingConfig?.manualLinkUrl || '').trim();
              const deskFormatted = st.nomorMeja ? String(st.nomorMeja).padStart(2, '0') : '-';
              const isOnline = examConfig?.moda === 'online';

              return (
                <div
                  key={st.id}
                  className="border-2 border-emerald-800 rounded-lg p-3.5 flex flex-col justify-between bg-white relative print:border-emerald-900"
                  style={{ minHeight: '128mm' }}
                >
                  <div className="absolute top-1 left-1 w-2 h-2 border-t-2 border-l-2 border-emerald-800" />
                  <div className="absolute top-1 right-1 w-2 h-2 border-t-2 border-r-2 border-emerald-800" />
                  <div className="absolute bottom-1 left-1 w-2 h-2 border-b-2 border-l-2 border-emerald-800" />
                  <div className="absolute bottom-1 right-1 w-2 h-2 border-b-2 border-r-2 border-emerald-800" />

                  <div>
                    <KopSurat profile={profile} isCompact={true} />
                    <div className="flex items-center justify-between border-y border-emerald-800 px-2 py-1 bg-emerald-50 print:bg-slate-100 my-1">
                      <div className="text-left">
                        <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-950 font-serif">
                          KARTU PESERTA UJIAN
                        </h2>
                        <p className="text-[8.5px] font-bold text-slate-800">
                          {profile.jenisUjian.toUpperCase()} • TP {profile.tahunPelajaran}
                        </p>
                      </div>
                      {showDeskNumber && (
                        <div className="bg-emerald-900 text-white px-2 py-0.5 rounded text-center font-mono">
                          <span className="text-[7px] block leading-none uppercase opacity-80">No. Meja</span>
                          <span className="text-[12px] font-black leading-tight">{deskFormatted}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2.5 mt-2">
                      {/* Photo & Barcode Box */}
                      <div className="flex-shrink-0 flex flex-col items-center">
                        <div className="w-[24mm] h-[32mm] border border-slate-400 bg-slate-50 flex flex-col items-center justify-center p-1 relative rounded-xs">
                          {st.fotoUrl ? (
                            <img
                              src={st.fotoUrl}
                              alt={st.nama}
                              className="w-full h-full object-cover rounded-xs"
                            />
                          ) : (
                            <div className="text-center">
                              <span className="text-[8px] font-bold text-slate-400 uppercase block">
                                Pas Foto
                              </span>
                              <span className="text-[7px] text-slate-400 block">3 x 4 cm</span>
                              <div className="mt-1 text-[8px] font-semibold text-emerald-700 bg-emerald-100 px-1 py-0.5 rounded">
                                {st.jenisKelamin === 'L' ? 'LAKI-LAKI' : 'PEREMPUAN'}
                              </div>
                            </div>
                          )}
                          <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full border border-purple-600/40 text-purple-700/50 flex items-center justify-center text-[5.5px] font-bold rotate-[-20deg] select-none pointer-events-none uppercase">
                            Cap Madrasah
                          </div>
                        </div>

                        {/* Barcode / Uploaded Image / QR under photo */}
                        <div className="mt-2 text-center">
                          {st.barcodeUrl || (barcodeMode === 'uploaded' && uploadedBarcode) ? (
                            <div className="flex flex-col items-center">
                              <img
                                src={uploadedBarcode}
                                alt={`Barcode ${st.nomorPeserta || st.nama}`}
                                className="h-[26px] max-w-[92px] object-contain"
                              />
                              <span className="font-mono text-[8.5px] tracking-wider text-slate-800 font-bold mt-0.5">
                                {st.nomorPeserta || '-'}
                              </span>
                            </div>
                          ) : barcodeMode === 'link_qr' ? (
                            <div className="flex flex-col items-center">
                              <SimpleQRCode
                                value={effectiveLink || st.nomorPeserta || st.nisn}
                                size={42}
                              />
                              <span className="font-mono text-[8px] text-slate-800 font-bold mt-0.5">
                                {st.nomorPeserta || '-'}
                              </span>
                            </div>
                          ) : (
                            <SimpleBarcode value={st.nomorPeserta || '26-01-000'} height={24} width={92} />
                          )}
                        </div>
                      </div>

                      {/* Biodata List */}
                      <div className="flex-1 text-[9.5px] leading-tight space-y-1 min-w-0">
                        <div className="flex">
                          <span className="w-24 font-bold text-slate-700 shrink-0">Nomor Peserta</span>
                          <span className="mr-1">:</span>
                          <span className="font-extrabold text-emerald-900 font-mono text-[10.5px]">
                            {st.nomorPeserta || '-'}
                          </span>
                        </div>
                        <div className="flex">
                          <span className="w-24 font-bold text-slate-700 shrink-0">NIS / NISN</span>
                          <span className="mr-1">:</span>
                          <span className="font-semibold text-slate-900 font-mono">
                            {st.nis} / {st.nisn}
                          </span>
                        </div>
                        <div className="flex">
                          <span className="w-24 font-bold text-slate-700 shrink-0">Nama Lengkap</span>
                          <span className="mr-1">:</span>
                          <span className="font-bold text-slate-900 uppercase">
                            {st.nama}
                          </span>
                        </div>
                        <div className="flex">
                          <span className="w-24 font-bold text-slate-700 shrink-0">Tempat, Tgl Lahir</span>
                          <span className="mr-1">:</span>
                          <span className="text-slate-800">
                            {st.tempatLahir}, {formatIndonesianDate(st.tanggalLahir)}
                          </span>
                        </div>
                        <div className="flex">
                          <span className="w-24 font-bold text-slate-700 shrink-0">Kelas / Gender</span>
                          <span className="mr-1">:</span>
                          <span className="font-bold text-slate-900">
                            {st.kelas} ({st.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan'})
                          </span>
                        </div>
                        <div className="flex">
                          <span className="w-24 font-bold text-slate-700 shrink-0">
                            {showDeskNumber ? 'Ruang / Meja' : 'Ruang'}
                          </span>
                          <span className="mr-1">:</span>
                          <span className="font-extrabold text-blue-900">
                            {room ? `${room.namaRuang}` : '-'}
                            {showDeskNumber ? ` / Meja ${deskFormatted}` : ''}
                            {isOnline || st.sesi ? ` (Sesi ${st.sesi || 1})` : ''}
                          </span>
                        </div>
                        {effectiveLink && (
                          <div className="flex pt-0.5">
                            <span className="w-24 font-bold text-slate-700 shrink-0">Alamat Link</span>
                            <span className="mr-1">:</span>
                            <span className="font-mono text-[8px] text-slate-900 break-all">
                              {effectiveLink}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="mt-2 pt-1.5 border-t border-slate-200 flex justify-between items-end text-[8.5px]">
                    <div className="text-[7.5px] text-slate-500 max-w-[50%] leading-tight italic">
                      * Harap kartu ini selalu dibawa selama pelaksanaan ujian dan diletakkan di sudut meja.
                    </div>
                    <div className="text-center font-serif leading-tight">
                      <p>
                        {profile.tempatTandaTangan},{' '}
                        {formatIndonesianDate(profile.tanggalSurat || '2026-03-23')}
                      </p>
                      <p className="font-bold">Kepala Madrasah,</p>
                      <div className="h-8 flex items-center justify-center">
                        <span className="text-[8px] text-purple-700/50 italic font-sans font-bold">
                          [ Ttd & Cap ]
                        </span>
                      </div>
                      <p className="font-bold underline text-slate-950 uppercase">{profile.namaKepala}</p>
                      <p className="text-[7.5px] font-sans">NIP. {profile.nipKepala || '-'}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
