import React from 'react';
import {
  ExamConfig,
  HpHandoverLog,
  MadrasahProfile,
  PaperPreset,
  SantriPhoneRecord,
} from '../../types';
import { KopSurat } from './KopSurat';
import { formatIndonesianDate } from '../../utils/qrBarcode';
import { getSheetScreenStyle } from '../../utils/printLayout';
import { formatPersonNameAndTitle } from '../../utils/formatName';

interface HpDocumentsCetakProps {
  profile: MadrasahProfile;
  examConfig?: ExamConfig;
  phoneRecords: SantriPhoneRecord[];
  hpLogs: HpHandoverLog[];
  docSubtype: 'hp_penerimaan' | 'hp_pengambilan' | 'hp_pengembalian' | 'hp_pengecasan' | 'hp_rekap';
  paperPreset?: PaperPreset;
  manualBlankPrint?: boolean;
}

export const HpDocumentsCetak: React.FC<HpDocumentsCetakProps> = ({
  profile,
  examConfig,
  phoneRecords,
  hpLogs,
  docSubtype,
  paperPreset,
  manualBlankPrint = true,
}) => {
  const sheetStyle = getSheetScreenStyle(paperPreset);

  const titles: Record<HpDocumentsCetakProps['docSubtype'], string> = {
    hp_penerimaan: 'FORMULIR PENERIMAAN HP SANTRI (ISIAN MANUAL)',
    hp_pengambilan: 'DAFTAR PENGAMBILAN HP SAAT UJIAN (ISIAN MANUAL)',
    hp_pengembalian: 'FORMULIR PENGEMBALIAN AKHIR HP SANTRI',
    hp_pengecasan: 'LEMBAR MONITORING PENGECASAN HP (ISIAN MANUAL)',
    hp_rekap: 'REKAPITULASI ADMINISTRASI HP SANTRI (MODA ONLINE)',
  };

  const titipanCount = phoneRecords.filter((p) => p.kategori === 'Titipan').length;
  const pinjamanCount = phoneRecords.filter((p) => p.kategori !== 'Titipan').length;
  const sedangDiambilCount = phoneRecords.filter((p) => p.isSedangDiambil).length;
  const sudahKembaliCount = phoneRecords.filter((p) => p.statusPengembalian === 'Sudah dikembalikan').length;
  const belumKembaliCount = phoneRecords.filter((p) => p.statusPengembalian !== 'Sudah dikembalikan').length;
  const penuhCasCount = phoneRecords.filter(
    (p) => p.statusCas === 'Baterai penuh' || p.statusCas === 'Selesai dicas'
  ).length;
  const belumCasCount = phoneRecords.filter(
    (p) => p.statusCas === 'Belum dicas' || p.statusCas === 'Baterai lemah'
  ).length;

  const isBlankSheet = manualBlankPrint && docSubtype !== 'hp_rekap';

  return (
    <div className="w-full flex flex-col items-center">
      <div
        style={sheetStyle}
        className="saum-sheet border border-slate-300 shadow-sm print-page-break mb-8 print:mb-0"
      >
        {(paperPreset?.showKop ?? true) && <KopSurat profile={profile} isCompact />}

        <div className="text-center my-3">
          <h2 className="text-sm font-extrabold uppercase font-serif tracking-wide underline">
            {titles[docSubtype]}
          </h2>
          <p className="text-xs font-semibold uppercase mt-0.5">
            {examConfig?.namaUjian || profile.jenisUjian} • TAHUN PELAJARAN {profile.tahunPelajaran}
          </p>
        </div>

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-5 gap-2 text-[10px] mb-3 border border-slate-900 p-2 bg-slate-50">
          <div>
            <p className="text-slate-600">Total Daftar</p>
            <p className="font-extrabold text-sm tabular-nums">{phoneRecords.length}</p>
          </div>
          <div>
            <p className="text-slate-600">HP Titipan</p>
            <p className="font-extrabold text-sm tabular-nums">{titipanCount}</p>
          </div>
          <div>
            <p className="text-slate-600">HP Pinjaman</p>
            <p className="font-extrabold text-sm tabular-nums">{pinjamanCount}</p>
          </div>
          <div>
            <p className="text-slate-600">Sedang Diambil</p>
            <p className="font-extrabold text-sm tabular-nums">{isBlankSheet ? '______' : sedangDiambilCount}</p>
          </div>
          <div>
            <p className="text-slate-600">Sudah / Belum Kembali</p>
            <p className="font-extrabold text-sm tabular-nums">
              {isBlankSheet ? '____ / ____' : `${sudahKembaliCount} / ${belumKembaliCount}`}
            </p>
          </div>
        </div>

        {docSubtype === 'hp_pengecasan' ? (
          <table className="w-full text-[10px] border-collapse border border-slate-900 mb-4">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-900 px-1.5 py-1.5 w-8 text-center">No</th>
                <th className="border border-slate-900 px-2 py-1.5 w-20 text-center">Kode HP</th>
                <th className="border border-slate-900 px-2 py-1.5 text-left">Nama Santri & Kelas</th>
                <th className="border border-slate-900 px-2 py-1.5 w-24 text-center">Box / Slot</th>
                <th className="border border-slate-900 px-2 py-1.5 w-28 text-center">Status Cas</th>
                <th className="border border-slate-900 px-2 py-1.5 w-16 text-center">Baterai (%)</th>
                <th className="border border-slate-900 px-2 py-1.5 w-28 text-center">Jam Mulai–Selesai</th>
                <th className="border border-slate-900 px-2 py-1.5 w-24 text-center">Paraf Petugas</th>
              </tr>
            </thead>
            <tbody>
              {phoneRecords.map((hp, idx) => (
                <tr key={hp.id}>
                  <td className="border border-slate-900 px-1.5 py-2 text-center tabular-nums">{idx + 1}</td>
                  <td className="border border-slate-900 px-2 py-2 text-center font-mono font-bold">
                    {hp.kodeHp}
                    {hp.kategori !== 'Titipan' && (
                      <div className="text-[8px] font-extrabold text-amber-900 uppercase">PINJAMAN</div>
                    )}
                  </td>
                  <td className="border border-slate-900 px-2 py-2">
                    <span className="font-bold">{formatPersonNameAndTitle(hp.namaSantri)}</span> ({hp.kelas})
                  </td>
                  <td className="border border-slate-900 px-2 py-2 text-center font-mono">
                    {isBlankSheet ? '' : hp.nomorBox || hp.nomorSlot ? `${hp.nomorBox || ''} / ${hp.nomorSlot || ''}` : ''}
                  </td>
                  <td className="border border-slate-900 px-2 py-2 text-center">
                    {isBlankSheet ? '' : hp.statusCas || ''}
                  </td>
                  <td className="border border-slate-900 px-2 py-2 text-center font-bold tabular-nums">
                    {isBlankSheet ? '' : hp.persentaseBaterai !== undefined ? `${hp.persentaseBaterai}%` : ''}
                  </td>
                  <td className="border border-slate-900 px-2 py-2 text-center font-mono text-[9.5px]">
                    {isBlankSheet ? '' : hp.casJamMulai || hp.casJamSelesai ? `${hp.casJamMulai || '--:--'} - ${hp.casJamSelesai || '--:--'}` : ''}
                  </td>
                  <td className="border border-slate-900 px-2 py-2 text-center h-9">
                    {isBlankSheet ? '' : hp.casPetugas || ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : docSubtype === 'hp_pengambilan' && !isBlankSheet && hpLogs.length > 0 ? (
          <table className="w-full text-[10px] border-collapse border border-slate-900 mb-4">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-900 px-1.5 py-1.5 w-8 text-center">No</th>
                <th className="border border-slate-900 px-2 py-1.5 w-20 text-center">Kode HP</th>
                <th className="border border-slate-900 px-2 py-1.5 text-left">Santri (Kelas)</th>
                <th className="border border-slate-900 px-2 py-1.5 w-24 text-center">Transaksi</th>
                <th className="border border-slate-900 px-2 py-1.5 w-28 text-center">Tanggal / Jam</th>
                <th className="border border-slate-900 px-2 py-1.5 w-20 text-center">Ruang</th>
                <th className="border border-slate-900 px-2 py-1.5 text-left">Petugas</th>
                <th className="border border-slate-900 px-2 py-1.5 w-16 text-center">Fisik</th>
              </tr>
            </thead>
            <tbody>
              {hpLogs.map((lg, idx) => (
                <tr key={lg.id}>
                  <td className="border border-slate-900 px-1.5 py-1.5 text-center tabular-nums">{idx + 1}</td>
                  <td className="border border-slate-900 px-2 py-1.5 text-center font-mono font-bold">
                    {lg.kodeHp}
                    {lg.kategori !== 'Titipan' && (
                      <div className="text-[8px] font-extrabold uppercase">PINJAMAN</div>
                    )}
                  </td>
                  <td className="border border-slate-900 px-2 py-1.5 font-semibold">
                    {lg.namaSantri} ({lg.kelas})
                  </td>
                  <td className="border border-slate-900 px-2 py-1.5 text-center">{lg.jenisTransaksi}</td>
                  <td className="border border-slate-900 px-2 py-1.5 text-center font-mono text-[9.5px]">
                    {lg.tanggal} • {lg.jam}
                  </td>
                  <td className="border border-slate-900 px-2 py-1.5 text-center">{lg.ruang || ''}</td>
                  <td className="border border-slate-900 px-2 py-1.5">{lg.petugas}</td>
                  <td className="border border-slate-900 px-2 py-1.5 text-center font-bold tabular-nums">
                    {lg.jumlahFisik} unit
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-[10px] border-collapse border border-slate-900 mb-4">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-900 px-1.5 py-1.5 w-8 text-center">No</th>
                <th className="border border-slate-900 px-2 py-1.5 w-22 text-center">Kode HP</th>
                <th className="border border-slate-900 px-2 py-1.5 text-left">Nama Santri & Kelas</th>
                <th className="border border-slate-900 px-2 py-1.5 w-36 text-left">Merek / Tipe & Kondisi</th>
                <th className="border border-slate-900 px-2 py-1.5 w-20 text-center">Box / Slot</th>
                <th className="border border-slate-900 px-2 py-1.5 w-24 text-center">Jam & Petugas</th>
                <th className="border border-slate-900 px-2 py-1.5 w-28 text-center">Paraf Serah/Terima</th>
              </tr>
            </thead>
            <tbody>
              {phoneRecords.map((hp, idx) => (
                <tr key={hp.id}>
                  <td className="border border-slate-900 px-1.5 py-2 text-center tabular-nums">{idx + 1}</td>
                  <td className="border border-slate-900 px-2 py-2 text-center font-mono font-bold">
                    {hp.kodeHp}
                    {hp.kategori !== 'Titipan' && (
                      <div className="mt-0.5 inline-block border border-slate-900 px-1 text-[8px] font-black uppercase">
                        PINJAMAN
                      </div>
                    )}
                  </td>
                  <td className="border border-slate-900 px-2 py-2">
                    <div className="font-bold">{formatPersonNameAndTitle(hp.namaSantri)}</div>
                    <div className="text-[9px] text-slate-600">Kelas {hp.kelas}</div>
                  </td>
                  <td className="border border-slate-900 px-2 py-2">
                    {isBlankSheet ? '' : (
                      <>
                        <div className="font-semibold">{hp.merekModel || ''}</div>
                        <div className="text-[9px] text-slate-600">
                          {[hp.warna, hp.kondisiAwal].filter(Boolean).join(' • ')}
                        </div>
                      </>
                    )}
                  </td>
                  <td className="border border-slate-900 px-2 py-2 text-center font-mono">
                    {isBlankSheet ? '' : hp.nomorBox || hp.nomorSlot ? `${hp.nomorBox || ''} / ${hp.nomorSlot || ''}` : ''}
                  </td>
                  <td className="border border-slate-900 px-2 py-2 text-center text-[9px]">
                    {isBlankSheet ? '' : (
                      <>
                        <div className="font-semibold">{hp.statusPengembalian}</div>
                        <div className="text-slate-600">{hp.namaPenyetor || ''}</div>
                      </>
                    )}
                  </td>
                  <td className="border border-slate-900 px-2 py-2 h-9" />
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {docSubtype === 'hp_rekap' && (
          <div className="border border-slate-900 p-3 text-[10.5px] mb-4 bg-slate-50">
            <p className="font-bold underline mb-1">RINGKASAN STATUS PENGECASAN & REKONSILIASI:</p>
            <p>
              • HP Siap Ujian (Penuh / Selesai Dicas): <strong>{penuhCasCount}</strong> unit | Belum / Lemah: <strong>{belumCasCount}</strong> unit
            </p>
            <p>
              • HP Sedang Digunakan di Ruang Ujian: <strong>{sedangDiambilCount}</strong> unit | HP Sudah Dikembalikan Akhir: <strong>{sudahKembaliCount}</strong> unit
            </p>
          </div>
        )}

        <div className="flex justify-between items-start text-[11px] font-serif mt-6 px-4">
          <div className="text-center w-56 leading-tight">
            <p className="font-bold">Mengetahui,</p>
            <p className="font-bold">Ketua Panitia Ujian,</p>
            <div className="h-14" />
            <p className="font-bold underline">
              {formatPersonNameAndTitle(profile.namaKetuaPanitia || profile.namaKepala) || '.........................'}
            </p>
            <p className="text-[9.5px] font-sans">NIP. {profile.nipKetuaPanitia || '-'}</p>
          </div>

          <div className="text-center w-56 leading-tight">
            <p>
              {profile.tempatTandaTangan ? `${profile.tempatTandaTangan}, ` : ''}
              {formatIndonesianDate(profile.tanggalSurat)}
            </p>
            <p className="font-bold">Petugas Administrasi HP,</p>
            <div className="h-14" />
            <p className="font-bold underline uppercase">__________________________</p>
            <p className="text-[9.5px] font-sans">Koordinator Pengelola HP</p>
          </div>
        </div>
      </div>
    </div>
  );
};
