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
import { SimpleQRCode, formatIndonesianDate } from '../../utils/qrBarcode';

export type NomorMejaPrintStyle =
  | 'label_lengkap'
  | 'berpasangan_2kursi'
  | 'kartu_angka_besar'
  | 'daftar_meja';

interface NomorMejaCetakProps {
  profile: MadrasahProfile;
  examConfig?: ExamConfig;
  students: Student[];
  rooms: ExamRoom[];
  numberingConfig?: NumberingConfig;
  selectedRoomId?: string;
  selectedSesi?: number;
  printStyle?: NomorMejaPrintStyle;
  kursiPerMeja?: number;
  paperPreset?: PaperPreset;
}

export const NomorMejaCetak: React.FC<NomorMejaCetakProps> = ({
  profile,
  examConfig,
  students,
  rooms,
  numberingConfig,
  selectedRoomId,
  selectedSesi,
  printStyle = 'label_lengkap',
  kursiPerMeja = 2,
  paperPreset,
}) => {
  const roomMap = new Map(rooms.map((r) => [r.id, r]));
  const isOnline = examConfig?.moda === 'online';
  const barcodeMode = numberingConfig?.barcodeMode || 'auto';
  const ratio = kursiPerMeja === 1 ? 1 : 2;

  const isF4 = paperPreset?.size === 'F4';
  const sheetClass = isF4 ? 'w-[215mm] min-h-[330mm]' : 'w-[210mm] min-h-[297mm]';

  let filteredStudents = students
    .filter((s) => s.status === 'Aktif')
    .filter((s) => !selectedRoomId || selectedRoomId === 'all' || s.ruangId === selectedRoomId)
    .filter((s) => !isOnline || !selectedSesi || selectedSesi === 0 || (s.sesi || 1) === selectedSesi)
    .sort((a, b) => {
      const rA = a.ruangId || 'ZZZ';
      const rB = b.ruangId || 'ZZZ';
      if (rA !== rB) return rA.localeCompare(rB);
      if (isOnline && (a.sesi || 1) !== (b.sesi || 1)) return (a.sesi || 1) - (b.sesi || 1);
      const seatA = a.nomorMeja || 9999;
      const seatB = b.nomorMeja || 9999;
      if (seatA !== seatB) return seatA - seatB;
      return (a.nomorPeserta || a.nama).localeCompare(b.nomorPeserta || b.nama, 'id');
    });

  if (filteredStudents.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
        <p className="text-slate-500 font-medium">Tidak ada peserta aktif untuk dicetak nomor mejanya.</p>
      </div>
    );
  }

  // 1. FORMAT BERPASANGAN: 1 MEJA = 2 KURSI
  if (printStyle === 'berpasangan_2kursi') {
    interface DeskPair {
      key: string;
      room?: ExamRoom;
      sesi?: number;
      mejaFisikNo: number;
      left?: Student;
      right?: Student;
    }

    const pairs: DeskPair[] = [];
    // Group by (ruangId, sesi) so desk 01 always starts fresh per room/session
    const groupMap = new Map<string, Student[]>();
    for (const st of filteredStudents) {
      const gKey = `${st.ruangId || 'unassigned'}__${isOnline ? st.sesi || 1 : 0}`;
      if (!groupMap.has(gKey)) groupMap.set(gKey, []);
      groupMap.get(gKey)!.push(st);
    }

    groupMap.forEach((groupStudents, gKey) => {
      const [roomId, sesiStr] = gKey.split('__');
      const room = roomId !== 'unassigned' ? roomMap.get(roomId) : undefined;
      const sesiNum = Number(sesiStr) || undefined;
      for (let i = 0; i < groupStudents.length; i += 2) {
        pairs.push({
          key: `${gKey}-${i}`,
          room,
          sesi: sesiNum,
          mejaFisikNo: Math.floor(i / 2) + 1,
          left: groupStudents[i],
          right: groupStudents[i + 1],
        });
      }
    });

    const chunkSize = 6;
    const pages: DeskPair[][] = [];
    for (let i = 0; i < pairs.length; i += chunkSize) {
      pages.push(pairs.slice(i, i + chunkSize));
    }

    return (
      <div className="w-full flex flex-col items-center">
        {pages.map((pagePairs, pageIdx) => (
          <div
            key={pageIdx}
            className={`${sheetClass} p-[10mm] bg-white text-slate-900 border border-slate-300 shadow-sm print:border-none print:shadow-none print:p-0 ${
              pageIdx < pages.length - 1 ? 'print-page-break mb-8 print:mb-0' : ''
            }`}
          >
            <div className="grid grid-cols-1 gap-[4.5mm]">
              {pagePairs.map((pair) => {
                const mejaLabel = String(pair.mejaFisikNo).padStart(2, '0');
                return (
                  <div
                    key={pair.key}
                    className="border-2 border-dashed border-slate-800 rounded-lg p-2.5 bg-white flex flex-col justify-between"
                    style={{ minHeight: '42mm' }}
                  >
                    <div className="border-b-2 border-emerald-800 pb-1 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="bg-emerald-800 text-white font-mono font-black text-sm px-2.5 py-0.5 rounded shrink-0">
                          MEJA {mejaLabel}
                        </span>
                        <div className="min-w-0">
                          <p className="text-[9.5px] font-extrabold text-emerald-950 uppercase truncate">
                            {pair.room ? pair.room.namaRuang : 'Belum Ada Ruang'}
                            {isOnline && pair.sesi ? ` • SESI ${pair.sesi}` : ''} • 1 MEJA (2 KURSI)
                          </p>
                          <p className="text-[7.5px] font-semibold text-slate-500 truncate">
                            {profile.namaMadrasah} — {profile.jenisUjian}
                          </p>
                        </div>
                      </div>
                      <span className="text-[8px] font-mono font-bold text-slate-600 shrink-0">
                        TP {profile.tahunPelajaran}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1.5">
                      {[
                        { label: 'KURSI KIRI', st: pair.left, fallbackSeat: (pair.mejaFisikNo - 1) * 2 + 1 },
                        { label: 'KURSI KANAN', st: pair.right, fallbackSeat: (pair.mejaFisikNo - 1) * 2 + 2 },
                      ].map((slot, sIdx) => {
                        const seatNo = slot.st?.nomorMeja || slot.fallbackSeat;
                        const uploadedBarcode = slot.st?.barcodeUrl || numberingConfig?.uploadedBarcodeUrl;
                        const link = (slot.st?.customLink || numberingConfig?.manualLinkUrl || '').trim();
                        return (
                          <div
                            key={sIdx}
                            className="border border-slate-300 rounded p-2 bg-slate-50/70 flex items-center justify-between gap-2 min-w-0"
                          >
                            {slot.st ? (
                              <>
                                <div className="min-w-0 flex-1 space-y-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[8px] font-bold bg-slate-800 text-white px-1.5 py-0.5 rounded font-mono">
                                      KURSI {String(seatNo).padStart(2, '0')}
                                    </span>
                                    <span className="text-[9.5px] font-black font-mono text-emerald-900">
                                      {slot.st.nomorPeserta || '-'}
                                    </span>
                                  </div>
                                  <p className="text-[9.5px] font-extrabold uppercase text-slate-950 truncate">
                                    {slot.st.nama}
                                  </p>
                                  <p className="text-[8px] text-slate-700 font-semibold">
                                    Kelas {slot.st.kelas} ({slot.st.jenisKelamin}) • NIS {slot.st.nis}
                                  </p>
                                </div>
                                <div className="shrink-0">
                                  {slot.st.barcodeUrl || (barcodeMode === 'uploaded' && uploadedBarcode) ? (
                                    <img
                                      src={uploadedBarcode}
                                      alt="Barcode"
                                      className="h-9 max-w-[54px] object-contain bg-white border border-slate-200 rounded p-0.5"
                                    />
                                  ) : (
                                    <SimpleQRCode
                                      value={link || `${slot.st.nomorPeserta}|${slot.st.nama}|Kursi-${seatNo}`}
                                      size={38}
                                    />
                                  )}
                                </div>
                              </>
                            ) : (
                              <div className="text-[8.5px] text-slate-400 italic w-full text-center py-2">
                                {slot.label} — Kosong
                              </div>
                            )}
                          </div>
                        );
                      })}
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

  // 2. FORMAT KARTU ANGKA MEJA BESAR (6 per halaman A4)
  if (printStyle === 'kartu_angka_besar') {
    const chunkSize = 6;
    const pages: Student[][] = [];
    for (let i = 0; i < filteredStudents.length; i += chunkSize) {
      pages.push(filteredStudents.slice(i, i + chunkSize));
    }

    return (
      <div className="w-full flex flex-col items-center">
        {pages.map((pageStudents, pageIdx) => (
          <div
            key={pageIdx}
            className={`${sheetClass} p-[10mm] bg-white text-slate-900 border border-slate-300 shadow-sm print:border-none print:shadow-none print:p-0 ${
              pageIdx < pages.length - 1 ? 'print-page-break mb-8 print:mb-0' : ''
            }`}
          >
            <div className="grid grid-cols-2 gap-[6mm]">
              {pageStudents.map((st, idx) => {
                const room = st.ruangId ? roomMap.get(st.ruangId) : undefined;
                const seatNum = st.nomorMeja || idx + 1;
                const mejaFisik = ratio === 2 ? Math.ceil(seatNum / 2) : seatNum;
                const deskText = String(seatNum).padStart(2, '0');
                return (
                  <div
                    key={st.id}
                    className="border-2 border-slate-900 rounded-xl p-3 bg-white flex flex-col justify-between text-center"
                    style={{ minHeight: '86mm' }}
                  >
                    <div className="border-b-2 border-emerald-800 pb-1.5">
                      <p className="text-[8px] font-bold uppercase text-slate-500 truncate">{profile.namaMadrasah}</p>
                      <p className="text-[10px] font-extrabold uppercase text-emerald-900">
                        {profile.jenisUjian} • TP {profile.tahunPelajaran}
                      </p>
                    </div>

                    <div className="my-auto py-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        NOMOR KURSI / DUDUK
                      </p>
                      <div className="text-6xl font-black font-mono text-emerald-900 leading-none my-1.5">
                        {deskText}
                      </div>
                      {ratio === 2 && (
                        <span className="inline-block text-[9px] font-mono font-bold bg-slate-100 border border-slate-300 px-2 py-0.5 rounded">
                          Meja Fisik No. {String(mejaFisik).padStart(2, '0')} (1 Meja 2 Kursi)
                        </span>
                      )}
                    </div>

                    <div className="border-t border-slate-300 pt-2 text-[9px] space-y-0.5">
                      <p className="font-extrabold text-slate-950 uppercase truncate text-[10px]">{st.nama}</p>
                      <p className="font-mono font-bold text-emerald-900">
                        No. Peserta: {st.nomorPeserta || '-'} • Kelas {st.kelas}
                      </p>
                      <p className="font-bold text-slate-700">
                        {room ? room.namaRuang : '-'}
                        {isOnline || st.sesi ? ` • Sesi ${st.sesi || 1}` : ''}
                      </p>
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

  // 3. FORMAT DAFTAR NOMOR MEJA PER RUANG
  if (printStyle === 'daftar_meja') {
    return (
      <div className="w-full flex flex-col items-center">
        <div className={`${sheetClass} p-[10mm] bg-white text-slate-900 border border-slate-300 shadow-sm print:border-none print:shadow-none print:p-0`}>
          {(paperPreset?.showKop ?? true) && <KopSurat profile={profile} isCompact />}
          <div className="text-center my-3">
            <h2 className="text-sm font-extrabold uppercase font-serif tracking-wide underline">
              DAFTAR PENOMORAN MEJA & KURSI PESERTA UJIAN
            </h2>
            <p className="text-xs font-semibold uppercase mt-0.5">
              {examConfig?.namaUjian || profile.jenisUjian} • TAHUN PELAJARAN {profile.tahunPelajaran}
              {ratio === 2 ? ' • KONFIGURASI 1 MEJA = 2 KURSI' : ''}
            </p>
          </div>

          <table className="w-full text-[9.5px] border-collapse border border-slate-900 mb-4">
            <thead>
              <tr className="bg-slate-100 font-bold text-center">
                <th className="border border-slate-900 px-1.5 py-1.5 w-8">No</th>
                <th className="border border-slate-900 px-2 py-1.5 w-20">No. Kursi</th>
                {ratio === 2 && <th className="border border-slate-900 px-2 py-1.5 w-20">Meja Fisik</th>}
                <th className="border border-slate-900 px-2 py-1.5 w-28">No. Peserta</th>
                <th className="border border-slate-900 px-2 py-1.5 text-left">Nama Lengkap Peserta</th>
                <th className="border border-slate-900 px-1.5 py-1.5 w-16">Kelas</th>
                <th className="border border-slate-900 px-2 py-1.5 w-24">Ruang</th>
                {isOnline && <th className="border border-slate-900 px-1.5 py-1.5 w-14">Sesi</th>}
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((st, idx) => {
                const room = st.ruangId ? roomMap.get(st.ruangId) : undefined;
                const seatNum = st.nomorMeja || idx + 1;
                const mejaFisik = ratio === 2 ? Math.ceil(seatNum / 2) : seatNum;
                return (
                  <tr key={st.id} className="tabular-nums">
                    <td className="border border-slate-900 px-1.5 py-1 text-center">{idx + 1}</td>
                    <td className="border border-slate-900 px-2 py-1 text-center font-mono font-extrabold text-emerald-900">
                      KURSI {String(seatNum).padStart(2, '0')}
                    </td>
                    {ratio === 2 && (
                      <td className="border border-slate-900 px-2 py-1 text-center font-mono font-bold">
                        MEJA {String(mejaFisik).padStart(2, '0')}
                      </td>
                    )}
                    <td className="border border-slate-900 px-2 py-1 text-center font-mono">{st.nomorPeserta || '-'}</td>
                    <td className="border border-slate-900 px-2 py-1 font-semibold uppercase">{st.nama}</td>
                    <td className="border border-slate-900 px-1.5 py-1 text-center">{st.kelas}</td>
                    <td className="border border-slate-900 px-2 py-1 text-center">{room ? room.namaRuang : '-'}</td>
                    {isOnline && (
                      <td className="border border-slate-900 px-1.5 py-1 text-center font-bold">
                        Sesi {st.sesi || 1}
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
              <p className="font-bold">Ketua Panitia Ujian,</p>
              <div className="h-14" />
              <p className="font-bold underline uppercase">{profile.namaKetuaPanitia || profile.namaKepala}</p>
              <p className="text-[9.5px] font-sans">NIP. {profile.nipKetuaPanitia || profile.nipKepala || '-'}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 4. DEFAULT: LABEL NOMOR MEJA & DATA PESERTA LENGKAP (8 per halaman A4)
  const chunkSize = 8;
  const pages: Student[][] = [];
  for (let i = 0; i < filteredStudents.length; i += chunkSize) {
    pages.push(filteredStudents.slice(i, i + chunkSize));
  }

  return (
    <div className="w-full flex flex-col items-center">
      {pages.map((pageStudents, pageIdx) => (
        <div
          key={pageIdx}
          className={`${sheetClass} p-[10mm] bg-white text-slate-900 border border-slate-300 shadow-sm print:border-none print:shadow-none print:p-0 ${
            pageIdx < pages.length - 1 ? 'print-page-break mb-8 print:mb-0' : ''
          }`}
        >
          <div className="grid grid-cols-2 gap-[4.5mm]">
            {pageStudents.map((st) => {
              const room = st.ruangId ? roomMap.get(st.ruangId) : undefined;
              const uploadedBarcode = st.barcodeUrl || numberingConfig?.uploadedBarcodeUrl;
              const effectiveLink = (st.customLink || numberingConfig?.manualLinkUrl || '').trim();
              const seatNo = st.nomorMeja || 0;
              const deskText = seatNo ? String(seatNo).padStart(2, '0') : '-';
              const mejaFisik = seatNo && ratio === 2 ? String(Math.ceil(seatNo / 2)).padStart(2, '0') : deskText;

              return (
                <div
                  key={st.id}
                  className="border-2 border-dashed border-slate-800 rounded-lg p-2.5 bg-white flex flex-col justify-between"
                  style={{ minHeight: '64mm' }}
                >
                  <div className="border-b-2 border-emerald-800 pb-1 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[7.5px] font-bold text-slate-500 uppercase truncate">{profile.namaMadrasah}</p>
                      <h4 className="text-[9.5px] font-extrabold text-emerald-900 uppercase leading-tight">
                        LABEL NOMOR MEJA & KURSI UJIAN
                      </h4>
                    </div>
                    <div className="bg-emerald-800 text-white font-mono font-extrabold text-[11px] px-2 py-0.5 rounded shrink-0 text-center">
                      <span>{ratio === 2 ? `MEJA ${mejaFisik} / K.${deskText}` : `MEJA ${deskText}`}</span>
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
                        {room ? `R.${room.nomorRuang}` : ''} / K.{deskText}
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-1 flex justify-between items-center text-[7px] text-slate-500">
                    <span className="font-semibold">{profile.jenisUjian} • TP {profile.tahunPelajaran}</span>
                    <span className="italic">* Ditempel di meja ujian peserta</span>
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
