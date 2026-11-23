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
} from '../../types';
import { KopSurat } from './KopSurat';
import { SimpleQRCode, formatDayAndDate, formatIndonesianDate } from '../../utils/qrBarcode';
import { getCardGridMetrics, getSheetScreenStyle } from '../../utils/printLayout';

interface LabelAdministrasiProps {
  profile: MadrasahProfile;
  examConfig?: ExamConfig;
  students: Student[];
  rooms: ExamRoom[];
  schedules: ExamSchedule[];
  subjects: ExamSubject[];
  numberingConfig?: NumberingConfig;
  selectedSubtype: 'label_meja' | 'label_pintu' | 'label_amplop';
  selectedRoomId?: string;
  paperPreset?: PaperPreset;
}

export const LabelAdministrasi: React.FC<LabelAdministrasiProps> = ({
  profile,
  examConfig,
  students,
  rooms,
  schedules,
  subjects,
  numberingConfig,
  selectedSubtype,
  selectedRoomId,
  paperPreset,
}) => {
  const activeRooms = rooms.filter((r) => !selectedRoomId || selectedRoomId === 'all' || r.id === selectedRoomId);
  const roomMap = new Map(rooms.map((r) => [r.id, r]));
  const subjectMap = new Map(subjects.map((s) => [s.id, s]));
  const barcodeMode = numberingConfig?.barcodeMode || 'auto';
  const isOnline = examConfig?.moda === 'online';
  const sheetStyle = getSheetScreenStyle(paperPreset);

  // 1. LABEL MEJA (6 kartu per halaman F4 = 2 kolom x 3 baris, atau mengikuti preset)
  if (selectedSubtype === 'label_meja') {
    let filteredStudents = students.filter((s) => s.status === 'Aktif');
    if (selectedRoomId && selectedRoomId !== 'all') {
      filteredStudents = filteredStudents.filter((s) => s.ruangId === selectedRoomId);
    }

    if (filteredStudents.length === 0) {
      return (
        <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
          <p className="text-slate-500 font-medium">
            Belum ada peserta aktif untuk mencetak label nomor meja.
          </p>
        </div>
      );
    }

    const metrics = getCardGridMetrics(paperPreset, {
      defaultSize: 'F4',
      defaultCardsPerPage: 6,
      gapMm: 4,
    });
    const mejaSheetStyle = getSheetScreenStyle(metrics.resolved);
    const chunkSize = metrics.cardsPerPage;
    const pages: Student[][] = [];
    for (let i = 0; i < filteredStudents.length; i += chunkSize) {
      pages.push(filteredStudents.slice(i, i + chunkSize));
    }

    return (
      <div className="print-container w-full block print:m-0 print:p-0">
        {pages.map((pageStudents, pageIdx) => (
          <div
            key={pageIdx}
            style={mejaSheetStyle}
            className={`saum-sheet border border-slate-300 shadow-sm ${
              pageIdx < pages.length - 1 ? 'print-page-break mb-8 print:mb-0' : ''
            }`}
          >
            <div className="grid grid-cols-2 gap-[4mm]">
              {pageStudents.map((st) => {
                const room = st.ruangId ? roomMap.get(st.ruangId) : undefined;
                const uploadedBarcode = st.barcodeUrl || numberingConfig?.uploadedBarcodeUrl;
                const effectiveLink = (st.customLink || numberingConfig?.manualLinkUrl || '').trim();
                const deskText = st.nomorMeja ? String(st.nomorMeja).padStart(2, '0') : '-';
                return (
                  <div
                    key={st.id}
                    className="border-2 border-dashed border-slate-800 rounded-lg p-3 bg-white flex flex-col justify-between print-avoid-break overflow-hidden"
                    style={{ height: `${metrics.cardHeightMm}mm` }}
                  >
                    <div className="border-b-2 border-emerald-800 pb-1 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[7.5px] font-bold text-slate-500 uppercase truncate">{profile.namaMadrasah}</p>
                        <h4 className="text-[9.5px] font-extrabold text-emerald-900 uppercase leading-tight">
                          LABEL NOMOR MEJA & PESERTA UJIAN
                        </h4>
                      </div>
                      <div className="bg-emerald-800 text-white font-mono font-extrabold text-[11px] px-2 py-0.5 rounded shrink-0">
                        MEJA {deskText}
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5 my-1.5">
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="text-[12.5px] font-black font-mono tracking-wider text-slate-950 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                          {st.nomorPeserta || '-'}
                        </div>
                        <p className="text-[10.5px] font-extrabold uppercase text-slate-950 truncate pt-0.5">
                          {st.nama}
                        </p>
                        <p className="text-[8.5px] text-slate-700 font-mono">
                          NIS/NISN: <b className="text-slate-950">{st.nis} / {st.nisn}</b>
                        </p>
                        <p className="text-[8.5px] text-slate-700 truncate">
                          TTL: {st.tempatLahir}, {formatIndonesianDate(st.tanggalLahir)}
                        </p>
                        <p className="text-[8.5px] text-slate-700 font-semibold">
                          Kelas: <b className="text-slate-950">{st.kelas}</b> ({st.jenisKelamin}) •{' '}
                          <span className="text-emerald-900 font-extrabold">
                            {room ? room.namaRuang : '-'}
                            {isOnline || st.sesi ? ` / Sesi ${st.sesi || 1}` : ''}
                          </span>
                        </p>
                        <p className="text-[8px] font-mono text-slate-900 truncate">
                          User: <b>{st.usernameUjian || '-'}</b> &bull; Pass: <b>{st.passwordUjian || '-'}</b>
                        </p>
                        {effectiveLink && (
                          <p className="text-[7.5px] font-mono text-blue-900 truncate">
                            Link: {effectiveLink}
                          </p>
                        )}
                      </div>

                      <div className="flex-shrink-0 flex flex-col items-center">
                        {st.barcodeUrl || (barcodeMode === 'uploaded' && uploadedBarcode) ? (
                          <img
                            src={uploadedBarcode}
                            alt={`Barcode ${st.nomorPeserta || st.nama}`}
                            className="h-[52px] max-w-[82px] object-contain border border-slate-200 rounded p-0.5 bg-white"
                          />
                        ) : (
                          <SimpleQRCode
                            value={effectiveLink || `${st.nomorPeserta}|${st.nama}|${st.kelas}|Meja-${deskText}`}
                            size={54}
                          />
                        )}
                        <span className="text-[7px] font-mono text-slate-500 mt-0.5">
                          {room ? `R.${room.nomorRuang}` : ''} / M.{deskText}
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-slate-200 pt-1 flex justify-between items-center text-[7px] text-slate-500">
                      <span className="font-semibold">{profile.jenisUjian} • TP {profile.tahunPelajaran}</span>
                      <span className="italic">* Ditempel di sudut kanan atas meja</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // 2. LABEL PINTU RUANG
  if (selectedSubtype === 'label_pintu') {
    if (activeRooms.length === 0) {
      return (
        <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
          <p className="text-slate-500 font-medium">Belum ada ruang ujian yang dapat dicetak label pintunya.</p>
        </div>
      );
    }
    return (
      <div className="print-container w-full block print:m-0 print:p-0">
        {activeRooms.map((room) => {
          const roomStudents = students
            .filter((s) => s.ruangId === room.id && s.status === 'Aktif')
            .sort((a, b) => (a.nomorMeja || 0) - (b.nomorMeja || 0));

          const firstNum = roomStudents[0]?.nomorPeserta || '...';
          const lastNum = roomStudents[roomStudents.length - 1]?.nomorPeserta || '...';

          return (
            <div
              key={`pintu-${room.id}`}
              style={sheetStyle}
              className="saum-sheet border border-slate-300 shadow-sm print-page-break mb-8 print:mb-0 flex flex-col justify-between"
            >
              {(paperPreset?.showKop ?? true) && <KopSurat profile={profile} />}

              <div className="my-auto text-center space-y-6">
                <div className="inline-block border-4 border-emerald-900 bg-emerald-50 px-12 py-5 rounded-2xl shadow-xs">
                  <p className="text-xl font-bold uppercase tracking-widest text-emerald-950 font-serif">
                    TEMPAT PELAKSANAAN UJIAN
                  </p>
                  <h1 className="text-6xl font-black text-emerald-900 tracking-wider my-2 font-mono">
                    {room.namaRuang.toUpperCase()}
                  </h1>
                  <p className="text-base font-bold text-slate-700 uppercase">
                    {profile.jenisUjian} - TAHUN PELAJARAN {profile.tahunPelajaran}
                  </p>
                </div>

                <div className="border-2 border-slate-800 bg-white p-6 rounded-xl max-w-xl mx-auto shadow-sm">
                  <p className="text-sm font-bold uppercase text-slate-600 tracking-wider">
                    RENTANG NOMOR PESERTA:
                  </p>
                  <div className="my-3 py-3 px-6 bg-slate-100 rounded-lg border border-slate-300 font-mono text-3xl font-extrabold text-slate-900">
                    {firstNum} <span className="text-slate-400 font-normal">s.d.</span> {lastNum}
                  </div>
                  <div className="flex justify-around items-center text-sm font-semibold text-slate-700 mt-2">
                    <span>Kapasitas: <b className="text-slate-900">{room.kapasitas} Kursi</b></span>
                    <span>•</span>
                    <span>Terisi: <b className="text-emerald-900">{roomStudents.length} Peserta</b></span>
                  </div>
                </div>

                <div className="border-2 border-rose-600 bg-rose-50 text-rose-900 p-4 rounded-xl max-w-lg mx-auto font-bold uppercase text-sm tracking-wide">
                  HARAP TENANG! SEDANG BERLANGSUNG UJIAN.<br />
                  SELAIN PESERTA DAN PENGAWAS DILARANG MASUK.
                </div>
              </div>

              <div className="text-center text-xs text-slate-500 font-serif border-t border-slate-300 pt-3">
                Panitia {profile.jenisUjian} • {profile.namaMadrasah}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // 3. LABEL AMPLOP SOAL & LJK
  if (activeRooms.length === 0 || schedules.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
        <p className="text-slate-500 font-medium">
          Data Ruang Ujian atau Jadwal Ujian belum tersedia untuk mencetak label amplop.
        </p>
      </div>
    );
  }

  return (
    <div className="print-container w-full block print:m-0 print:p-0">
      {activeRooms.flatMap((room) =>
        schedules.map((schedule) => {
          const subject = subjectMap.get(schedule.mapelId);
          const roomStudents = students.filter((s) => s.ruangId === room.id && s.status === 'Aktif');

          return (
            <div
              key={`amplop-${room.id}-${schedule.id}`}
              style={sheetStyle}
              className="saum-sheet border border-slate-300 shadow-sm print-page-break mb-8 print:mb-0"
            >
              {(paperPreset?.showKop ?? true) && <KopSurat profile={profile} />}

              <div className="border-4 border-slate-900 p-6 rounded-xl mt-4">
                <div className="text-center border-b-2 border-slate-900 pb-3 mb-4">
                  <h2 className="text-lg font-black uppercase font-serif tracking-wider">
                    LABEL SAMPUL NASKAH SOAL & LJK
                  </h2>
                  <p className="text-xs font-bold uppercase text-slate-700">
                    {profile.jenisUjian} - TAHUN PELAJARAN {profile.tahunPelajaran}
                  </p>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex border-b border-slate-200 pb-1.5">
                    <span className="w-48 font-bold text-slate-700">Mata Pelajaran</span>
                    <span className="mr-2">:</span>
                    <span className="font-extrabold text-base text-slate-950 uppercase">{subject?.nama || '-'}</span>
                  </div>

                  <div className="flex border-b border-slate-200 pb-1.5">
                    <span className="w-48 font-bold text-slate-700">Hari / Tanggal</span>
                    <span className="mr-2">:</span>
                    <span className="font-semibold text-slate-900">{formatDayAndDate(schedule.tanggal)}</span>
                  </div>

                  <div className="flex border-b border-slate-200 pb-1.5">
                    <span className="w-48 font-bold text-slate-700">Waktu / Sesi</span>
                    <span className="mr-2">:</span>
                    <span className="font-semibold text-slate-900">
                      {schedule.waktuMulai} - {schedule.waktuSelesai} WIB (Sesi {schedule.sesi})
                    </span>
                  </div>

                  <div className="flex border-b border-slate-200 pb-1.5">
                    <span className="w-48 font-bold text-slate-700">Ruang Ujian</span>
                    <span className="mr-2">:</span>
                    <span className="font-extrabold text-slate-950">{room.namaRuang}</span>
                  </div>

                  <div className="flex border-b border-slate-200 pb-1.5">
                    <span className="w-48 font-bold text-slate-700">Jumlah Peserta</span>
                    <span className="mr-2">:</span>
                    <span className="font-bold text-slate-950">{roomStudents.length} Peserta</span>
                  </div>

                  <div className="flex border-b border-slate-200 pb-1.5">
                    <span className="w-48 font-bold text-slate-700">Isi Sampul</span>
                    <span className="mr-2">:</span>
                    <div className="space-y-1">
                      <p>• Naskah Soal : <span className="font-bold">{roomStudents.length + 2}</span> eksemplar (termasuk cadangan)</p>
                      <p>• Lembar Jawaban (LJK) : <span className="font-bold">{roomStudents.length + 2}</span> lembar</p>
                      <p>• Berita Acara & Daftar Hadir : 2 rangkap</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-8 pt-4 border-t-2 border-slate-900 text-xs">
                  <div className="text-center font-serif leading-tight">
                    <p className="font-bold">Yang Menyerahkan (Panitia),</p>
                    <div className="h-16 flex items-center justify-center">
                      <span className="text-[9px] text-slate-300 italic font-sans">( Tanda Tangan )</span>
                    </div>
                    <p className="font-bold underline uppercase">...........................................</p>
                  </div>

                  <div className="text-center font-serif leading-tight">
                    <p className="font-bold">Yang Menerima (Pengawas),</p>
                    <div className="h-16 flex items-center justify-center">
                      <span className="text-[9px] text-slate-300 italic font-sans">( Tanda Tangan )</span>
                    </div>
                    <p className="font-bold underline uppercase">...........................................</p>
                  </div>
                </div>
              </div>

              <p className="mt-4 text-center text-xs text-slate-500 italic">
                * Lembar ini ditempel pada bagian depan amplop / map naskah ujian setiap ruang dan sesi.
              </p>
            </div>
          );
        })
      )}
    </div>
  );
};
