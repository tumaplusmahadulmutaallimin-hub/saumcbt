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
import { SimpleBarcode, SimpleQRCode, formatIndonesianDate } from '../../utils/qrBarcode';
import { getCardGridMetrics, getSheetScreenStyle, normalizeTargetPaperPreset } from '../../utils/printLayout';
import { formatPersonNameAndTitle } from '../../utils/formatName';

interface KartuPesertaProps {
  profile: MadrasahProfile;
  examConfig?: ExamConfig;
  students: Student[];
  rooms: ExamRoom[];
  numberingConfig?: NumberingConfig;
  selectedRoomId?: string;
  selectedStudentId?: string;
  paperPreset?: PaperPreset;
  cardsPerPage?: 4 | 6;
  onRequestUploadTtdKepala?: () => void;
}

export const KartuPeserta: React.FC<KartuPesertaProps> = ({
  profile,
  examConfig,
  students,
  rooms,
  numberingConfig,
  selectedRoomId,
  selectedStudentId,
  paperPreset,
  cardsPerPage,
  onRequestUploadTtdKepala,
}) => {
  let filtered = students.filter((s) => s.status === 'Aktif');
  if (selectedRoomId && selectedRoomId !== 'all') {
    filtered = filtered.filter((s) => s.ruangId === selectedRoomId);
  }
  if (selectedStudentId && selectedStudentId !== 'all') {
    filtered = filtered.filter((s) => s.id === selectedStudentId);
  }

  const effectivePreset = normalizeTargetPaperPreset('kartu_peserta', paperPreset);
  const metrics = getCardGridMetrics(effectivePreset, {
    defaultSize: 'F4',
    defaultCardsPerPage: cardsPerPage || effectivePreset?.cardsPerPage || 6,
    gapMm: 3,
    defaultMarginMm: 15,
  });

  const chunkSize = metrics.cardsPerPage;
  const isDense6 = chunkSize === 6;
  const pages: Student[][] = [];
  for (let i = 0; i < filtered.length; i += chunkSize) {
    pages.push(filtered.slice(i, i + chunkSize));
  }

  const roomMap = new Map(rooms.map((r) => [r.id, r]));
  const barcodeMode = numberingConfig?.barcodeMode || 'auto';
  const showDeskNumber = numberingConfig?.showDeskNumber ?? true;
  const formattedKepala = formatPersonNameAndTitle(profile.namaKepala) || '.........................';

  if (filtered.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
        <p className="text-slate-500 font-medium">
          Tidak ada peserta aktif yang siap dicetak kartunya. Tambahkan peserta di menu Data DNPU terlebih dahulu.
        </p>
      </div>
    );
  }

  const sheetStyle = getSheetScreenStyle(metrics.resolved);

  return (
    <div className="print-container w-full block print:m-0 print:p-0">
      {pages.map((pageStudents, pageIdx) => (
        <div
          key={pageIdx}
          data-testid="kartu-peserta-page"
          style={sheetStyle}
          className="saum-sheet print-page border border-slate-300 shadow-sm mb-8 print:mb-0"
        >
          <div className={isDense6 ? 'print-grid-2x3' : 'print-grid-2x2'}>
            {pageStudents.map((st) => {
              const room = st.ruangId ? roomMap.get(st.ruangId) : undefined;
              const uploadedBarcode = st.barcodeUrl || numberingConfig?.uploadedBarcodeUrl;
              const effectiveLink = (st.customLink || numberingConfig?.manualLinkUrl || '').trim();
              const deskFormatted = st.nomorMeja ? String(st.nomorMeja).padStart(2, '0') : '-';
              const isOnline = examConfig?.moda === 'online';

              return (
                <div
                  key={st.id}
                  data-testid="kartu-peserta-card"
                  className={`h-full w-full min-h-0 border-2 border-emerald-800 rounded-lg ${
                    isDense6 ? 'p-2' : 'p-3'
                  } flex flex-col justify-between bg-white relative print-avoid-break overflow-hidden`}
                >
                  <div className="absolute top-1 left-1 w-1.5 h-1.5 border-t-2 border-l-2 border-emerald-800" />
                  <div className="absolute top-1 right-1 w-1.5 h-1.5 border-t-2 border-r-2 border-emerald-800" />
                  <div className="absolute bottom-1 left-1 w-1.5 h-1.5 border-b-2 border-l-2 border-emerald-800" />
                  <div className="absolute bottom-1 right-1 w-1.5 h-1.5 border-b-2 border-r-2 border-emerald-800" />

                  <div>
                    <KopSurat profile={profile} isCompact={true} />
                    <div className="flex items-center justify-between border-y border-emerald-800 px-2 py-0.5 bg-emerald-50 my-1">
                      <div className="text-left min-w-0">
                        <h2
                          className={`${
                            isDense6 ? 'text-[10.5px]' : 'text-[11.5px]'
                          } font-extrabold uppercase tracking-wider text-emerald-950 font-serif leading-tight`}
                        >
                          KARTU PESERTA UJIAN
                        </h2>
                        <p className="text-[8px] font-bold text-slate-800 truncate">
                          {(examConfig?.namaUjian || profile.jenisUjian || 'UJIAN MADRASAH').toUpperCase()} &bull; TP{' '}
                          {profile.tahunPelajaran || '-'}
                        </p>
                      </div>
                      {showDeskNumber && (
                        <div className="bg-emerald-900 text-white px-2 py-0.5 rounded text-center font-mono shrink-0">
                          <span className="text-[6.5px] block leading-none uppercase opacity-80">No. Meja</span>
                          <span className="text-[11px] font-black leading-tight">{deskFormatted}</span>
                        </div>
                      )}
                    </div>

                    <div className={`flex ${isDense6 ? 'gap-2 mt-1' : 'gap-2.5 mt-1.5'} items-start`}>
                      {/* Compact Photo Frame */}
                      <div className="flex-shrink-0 flex flex-col items-center">
                        <div
                          className={`${
                            isDense6 ? 'w-[20mm] h-[25.5mm]' : 'w-[23mm] h-[30mm]'
                          } border border-slate-400 bg-slate-50 flex flex-col items-center justify-center p-1 relative rounded-xs`}
                        >
                          {st.fotoUrl ? (
                            <img
                              src={st.fotoUrl}
                              alt={st.nama}
                              className="w-full h-full object-cover rounded-xs"
                            />
                          ) : (
                            <div className="text-center">
                              <span className="text-[7.5px] font-bold text-slate-400 uppercase block">
                                Pas Foto
                              </span>
                              <span className="text-[6.5px] text-slate-400 block">3 x 4 cm</span>
                              <div className="mt-0.5 text-[7px] font-semibold text-emerald-700 bg-emerald-100 px-1 py-0.5 rounded">
                                {st.jenisKelamin === 'L' ? 'LAKI-LAKI' : 'PEREMPUAN'}
                              </div>
                            </div>
                          )}
                          <div className="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-full border border-purple-600/40 text-purple-700/50 flex items-center justify-center text-[5px] font-bold rotate-[-20deg] select-none pointer-events-none uppercase">
                            Cap Madrasah
                          </div>
                        </div>
                      </div>

                      {/* Biodata List */}
                      <div
                        className={`flex-1 ${
                          isDense6 ? 'text-[8.5px] space-y-0.5' : 'text-[9.5px] space-y-1'
                        } leading-tight min-w-0`}
                      >
                        <div className="flex">
                          <span className="w-[74px] font-bold text-slate-700 shrink-0">No. Peserta</span>
                          <span className="mr-1">:</span>
                          <span className="font-extrabold text-emerald-900 font-mono text-[10px]">
                            {st.nomorPeserta || '-'}
                          </span>
                        </div>
                        <div className="flex">
                          <span className="w-[74px] font-bold text-slate-700 shrink-0">NIS / NISN</span>
                          <span className="mr-1">:</span>
                          <span className="font-semibold text-slate-900 font-mono truncate">
                            {st.nis || '-'} / {st.nisn || '-'}
                          </span>
                        </div>
                        <div className="flex">
                          <span className="w-[74px] font-bold text-slate-700 shrink-0">Nama</span>
                          <span className="mr-1">:</span>
                          <span className="font-bold text-slate-950 truncate">{st.nama}</span>
                        </div>
                        <div className="flex">
                          <span className="w-[74px] font-bold text-slate-700 shrink-0">TTL</span>
                          <span className="mr-1">:</span>
                          <span className="text-slate-800 truncate">
                            {st.tempatLahir || '-'}, {formatIndonesianDate(st.tanggalLahir)}
                          </span>
                        </div>
                        <div className="flex">
                          <span className="w-[74px] font-bold text-slate-700 shrink-0">Kelas / JK</span>
                          <span className="mr-1">:</span>
                          <span className="font-bold text-slate-900 truncate">
                            {st.kelas} ({st.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan'})
                          </span>
                        </div>
                        <div className="flex">
                          <span className="w-[74px] font-bold text-slate-700 shrink-0">
                            {showDeskNumber ? 'Ruang / Meja' : 'Ruang'}
                          </span>
                          <span className="mr-1">:</span>
                          <span className="font-extrabold text-blue-900 truncate">
                            {room ? `${room.namaRuang}` : '-'}
                            {showDeskNumber ? ` / Meja ${deskFormatted}` : ''}
                            {isOnline || st.sesi ? ` (Sesi ${st.sesi || 1})` : ''}
                          </span>
                        </div>
                        <div className="flex items-center bg-emerald-50/90 border border-emerald-200 rounded px-1.5 py-0.5 mt-0.5">
                          <span className="font-bold text-emerald-950 shrink-0 mr-1">Login:</span>
                          <span className="font-mono font-bold text-slate-900 truncate text-[8px]">
                            User: {st.usernameUjian || '-'} &bull; Pass: {st.passwordUjian || '-'}
                          </span>
                        </div>
                        {effectiveLink && (
                          <div className="flex">
                            <span className="w-[74px] font-bold text-slate-700 shrink-0">Link Ujian</span>
                            <span className="mr-1">:</span>
                            <span className="font-mono text-[7.5px] text-slate-900 truncate">
                              {effectiveLink}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Footer: Enlarged Barcode on Left + Kepala Madrasah TTD on Right */}
                  <div className="mt-1 pt-1 border-t border-slate-200 flex justify-between items-end gap-2 text-[8px]">
                    <div
                      data-testid="kartu-barcode-container"
                      className="flex flex-col items-start justify-end min-w-0 max-w-[52%]"
                    >
                      {st.barcodeUrl || (barcodeMode === 'uploaded' && uploadedBarcode) ? (
                        <div className="flex flex-col items-center">
                          <img
                            src={uploadedBarcode}
                            alt={`Barcode ${st.nomorPeserta || st.nama}`}
                            className="h-[34px] max-w-[144px] object-contain"
                          />
                          <span className="font-mono text-[8px] tracking-wider text-slate-800 font-bold leading-none mt-0.5">
                            {st.nomorPeserta || '-'}
                          </span>
                        </div>
                      ) : barcodeMode === 'link_qr' ? (
                        <div className="flex items-center gap-1.5">
                          <SimpleQRCode
                            value={effectiveLink || st.nomorPeserta || st.nisn}
                            size={isDense6 ? 40 : 48}
                          />
                          <div className="text-[7px] leading-tight text-slate-600 min-w-0">
                            <span className="font-mono font-bold text-slate-900 block">
                              {st.nomorPeserta || '-'}
                            </span>
                            <span>Scan Kartu</span>
                          </div>
                        </div>
                      ) : (
                        <SimpleBarcode
                          value={st.nomorPeserta || '26-01-000'}
                          height={isDense6 ? 30 : 34}
                          width={isDense6 ? 146 : 162}
                        />
                      )}
                    </div>

                    <div className="text-center font-serif leading-tight shrink-0 min-w-[115px]">
                      <p className="text-[7.5px]">
                        {profile.tempatTandaTangan ? `${profile.tempatTandaTangan}, ` : ''}
                        {formatIndonesianDate(profile.tanggalSurat)}
                      </p>
                      <p className="font-bold text-[8px]">Kepala Madrasah,</p>
                      <div
                        className={`${
                          isDense6 ? 'h-[26px]' : 'h-[32px]'
                        } flex items-center justify-center my-0.5`}
                      >
                        {profile.ttdKepalaUrl ? (
                          <img
                            src={profile.ttdKepalaUrl}
                            alt="TTD Kepala Madrasah"
                            data-testid="ttd-kepala-img"
                            className="max-h-full max-w-[92px] object-contain"
                          />
                        ) : onRequestUploadTtdKepala ? (
                          <button
                            type="button"
                            onClick={onRequestUploadTtdKepala}
                            data-testid="ttd-kepala-placeholder"
                            className="no-print text-[7px] text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-dashed border-emerald-400 px-1.5 py-0.5 rounded font-sans font-semibold cursor-pointer"
                            title="Klik untuk mengunggah file TTD Kepala Madrasah (JPG/PNG)"
                          >
                            + Upload TTD (JPG)
                          </button>
                        ) : (
                          <span className="text-[7px] text-purple-700/50 italic font-sans font-bold">
                            [ Ttd &amp; Cap ]
                          </span>
                        )}
                      </div>
                      <p className="font-bold underline text-slate-950 text-[8.5px]">
                        {formattedKepala}
                      </p>
                      <p className="text-[7px] font-sans">NIP. {profile.nipKepala || '-'}</p>
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
