import React from 'react';
import {
  ExamConfig,
  ExamRoom,
  ExamSchedule,
  ExamSubject,
  MadrasahProfile,
  PaperPreset,
  RekapConfig,
  Student,
} from '../../types';
import { KopSurat } from './KopSurat';
import { formatDayAndDate, formatIndonesianDate } from '../../utils/qrBarcode';
import {
  computeEquipmentTotals,
  computeRoomDuplicationBreakdown,
  computeRoomEquipmentRows,
} from '../../utils/rekap';
import { getSheetScreenStyle } from '../../utils/printLayout';
import { formatPersonNameAndTitle } from '../../utils/formatName';

export { computeRoomDuplicationBreakdown };

interface RekapKebutuhanCetakProps {
  profile: MadrasahProfile;
  examConfig: ExamConfig;
  students: Student[];
  rooms: ExamRoom[];
  schedules: ExamSchedule[];
  subjects: ExamSubject[];
  rekapConfig: RekapConfig;
  paperPreset?: PaperPreset;
}

export const RekapKebutuhanCetak: React.FC<RekapKebutuhanCetakProps> = ({
  profile,
  examConfig,
  students,
  rooms,
  schedules,
  subjects,
  rekapConfig,
  paperPreset,
}) => {
  const activeStudents = students.filter((s) => s.status === 'Aktif');
  const subjectMap = new Map(subjects.map((s) => [s.id, s]));
  const isOnline = examConfig.moda === 'online';
  const cadangan = rekapConfig.cadanganPerRuang ?? 2;
  const kursiPerMeja = rekapConfig.kursiPerMeja === 1 ? 1 : 2;

  const roomRows = computeRoomEquipmentRows({
    rooms,
    students,
    examConfig,
    rekapConfig,
  });
  const totals = computeEquipmentTotals(roomRows);

  const duplicationRows = schedules.flatMap((sc) => {
    const targetRooms =
      sc.ruangIds && sc.ruangIds.length > 0
        ? rooms.filter((r) => sc.ruangIds!.includes(r.id))
        : rooms;
    return targetRooms
      .map((rm) => {
        const key = `${sc.id}_${rm.id}`;
        const calc = computeRoomDuplicationBreakdown(
          sc,
          rm,
          activeStudents,
          subjectMap,
          cadangan,
          examConfig.moda
        );
        const statusEntry = rekapConfig.duplicationStatuses[key];
        return {
          key,
          schedule: sc,
          room: rm,
          ...calc,
          status: statusEntry?.statusGanda || 'Belum Digandakan',
        };
      })
      .filter((r) => !isOnline || r.totalPeserta > 0);
  });

  const grandTotalSoal = duplicationRows.reduce((s, d) => s + d.totalSoal, 0);
  const grandTotalLjk = duplicationRows.reduce((s, d) => s + d.totalLjk, 0);
  const sheetStyle = getSheetScreenStyle(paperPreset);

  return (
    <div className="w-full flex flex-col items-center">
      {/* Halaman 1: Rekap Perlengkapan Ruang & Kebutuhan Sarpras */}
      <div
        style={sheetStyle}
        className="saum-sheet border border-slate-300 shadow-sm print-page-break mb-8 print:mb-0 text-[10.5px] leading-relaxed"
      >
        {(paperPreset?.showKop ?? true) && <KopSurat profile={profile} />}

        <div className="text-center my-3">
          <h2 className="text-sm font-bold uppercase font-serif tracking-wide underline">
            REKAPITULASI KEBUTUHAN PERLENGKAPAN & SARPRAS UJIAN
          </h2>
          <p className="text-xs font-semibold uppercase mt-0.5">
            {(profile.jenisUjian || 'UJIAN MADRASAH').toUpperCase()} • MODA {isOnline ? `ONLINE (${examConfig.jumlahSesi} SESI)` : 'KERTAS (PBT)'} • 1 MEJA = {kursiPerMeja} KURSI • TP {profile.tahunPelajaran || '-'}
          </p>
        </div>

        <h3 className="font-bold text-xs uppercase text-slate-900 mb-1 border-b border-slate-300 pb-0.5">
          I. REKAPITULASI MEJA, KURSI & PERLENGKAPAN PER RUANG UJIAN (1 MEJA = {kursiPerMeja} KURSI)
        </h3>
        <table className="w-full text-[9.5px] border-collapse border border-slate-900 mb-4">
          <thead>
            <tr className="bg-slate-100 font-bold text-center">
              <th className="border border-slate-900 px-1.5 py-1.5 w-8">No</th>
              <th className="border border-slate-900 px-2 py-1.5 text-left">Ruang Ujian</th>
              <th className="border border-slate-900 px-1.5 py-1.5">
                {isOnline ? 'Peserta (Total/Sesi)' : 'Peserta Terisi'}
              </th>
              <th className="border border-slate-900 px-1.5 py-1.5">Kursi Peserta</th>
              <th className="border border-slate-900 px-1.5 py-1.5">Meja Peserta</th>
              <th className="border border-slate-900 px-1.5 py-1.5">Kursi Pengawas</th>
              <th className="border border-slate-900 px-1.5 py-1.5">Meja Pengawas</th>
              <th className="border border-slate-900 px-1.5 py-1.5">Label Meja</th>
              <th className="border border-slate-900 px-1.5 py-1.5">Denah</th>
              {isOnline && <th className="border border-slate-900 px-1.5 py-1.5">Box HP</th>}
            </tr>
          </thead>
          <tbody>
            {roomRows.map((r, idx) => (
              <tr key={r.room.id} className="text-center tabular-nums">
                <td className="border border-slate-900 px-1.5 py-1">{idx + 1}</td>
                <td className="border border-slate-900 px-2 py-1 text-left font-bold">{r.room.namaRuang}</td>
                <td className="border border-slate-900 px-1.5 py-1">
                  {isOnline ? `${r.totalPesertaTerdaftar} / ${r.pesertaSerentak}` : r.totalPesertaTerdaftar}
                </td>
                <td className="border border-slate-900 px-1.5 py-1 font-bold">{r.kursiPeserta}</td>
                <td className="border border-slate-900 px-1.5 py-1 font-semibold">{r.mejaPeserta}</td>
                <td className="border border-slate-900 px-1.5 py-1 font-semibold">{r.kursiPengawas}</td>
                <td className="border border-slate-900 px-1.5 py-1">{r.mejaPengawas}</td>
                <td className="border border-slate-900 px-1.5 py-1">{r.labelMejaFisik}</td>
                <td className="border border-slate-900 px-1.5 py-1">{r.denahDuduk}</td>
                {isOnline && <td className="border border-slate-900 px-1.5 py-1">{r.boxHp}</td>}
              </tr>
            ))}
            <tr className="bg-slate-100 font-extrabold text-center tabular-nums">
              <td colSpan={2} className="border border-slate-900 px-2 py-1.5">TOTAL KEBUTUHAN RUANG</td>
              <td className="border border-slate-900 px-1.5 py-1.5">{totals.totalPesertaTerdaftar}</td>
              <td className="border border-slate-900 px-1.5 py-1.5">{totals.kursiPeserta}</td>
              <td className="border border-slate-900 px-1.5 py-1.5">{totals.mejaPeserta}</td>
              <td className="border border-slate-900 px-1.5 py-1.5">{totals.kursiPengawas}</td>
              <td className="border border-slate-900 px-1.5 py-1.5">{totals.mejaPengawas}</td>
              <td className="border border-slate-900 px-1.5 py-1.5">{totals.labelMejaFisik}</td>
              <td className="border border-slate-900 px-1.5 py-1.5">{totals.denahDuduk}</td>
              {isOnline && <td className="border border-slate-900 px-1.5 py-1.5">{totals.boxHp}</td>}
            </tr>
          </tbody>
        </table>
        <p className="text-[9.5px] font-semibold text-slate-700 mb-3">
          Ringkasan Bangku Seluruh Madrasah: Total <strong>{totals.totalKursi} Kursi</strong> ({totals.kursiPeserta} Peserta + {totals.kursiPengawas} Pengawas) menempati <strong>{totals.totalMeja} Meja</strong> (Rasio 1 Meja = {kursiPerMeja} Kursi).
        </p>

        <h3 className="font-bold text-xs uppercase text-slate-900 mb-1 border-b border-slate-300 pb-0.5 mt-4">
          II. DAFTAR KEBUTUHAN PERLENGKAPAN LAINNYA (PANITIA & SARPRAS)
        </h3>
        <table className="w-full text-[10px] border-collapse border border-slate-900 mb-4">
          <thead>
            <tr className="bg-slate-100 font-bold">
              <th className="border border-slate-900 px-2 py-1.5 w-8 text-center">No</th>
              <th className="border border-slate-900 px-2 py-1.5 text-left">Nama Perlengkapan</th>
              <th className="border border-slate-900 px-2 py-1.5 text-left">Kategori</th>
              <th className="border border-slate-900 px-2 py-1.5 text-center">Kebutuhan</th>
              <th className="border border-slate-900 px-2 py-1.5 text-center">Tersedia</th>
              <th className="border border-slate-900 px-2 py-1.5 text-center">Kekurangan</th>
              <th className="border border-slate-900 px-2 py-1.5 text-left">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            {rekapConfig.customSupplies.map((item, idx) => {
              const kurang = Math.max(0, item.kebutuhan - item.tersedia);
              return (
                <tr key={item.id}>
                  <td className="border border-slate-900 px-2 py-1 text-center tabular-nums">{idx + 1}</td>
                  <td className="border border-slate-900 px-2 py-1 font-bold">{item.namaBarang}</td>
                  <td className="border border-slate-900 px-2 py-1">{item.kategori}</td>
                  <td className="border border-slate-900 px-2 py-1 text-center tabular-nums">
                    {item.kebutuhan} {item.satuan}
                  </td>
                  <td className="border border-slate-900 px-2 py-1 text-center tabular-nums">
                    {item.tersedia} {item.satuan}
                  </td>
                  <td className="border border-slate-900 px-2 py-1 text-center font-bold tabular-nums">
                    {kurang > 0 ? `${kurang} ${item.satuan}` : 'Cukup'}
                  </td>
                  <td className="border border-slate-900 px-2 py-1">{item.keterangan || '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-8 flex justify-between items-start text-xs font-serif">
          <div className="text-center w-52 leading-tight">
            <p className="font-bold">Ketua Panitia Ujian,</p>
            <div className="h-14 flex items-center justify-center">
              <span className="text-[9px] text-slate-300 italic font-sans">( Tanda Tangan )</span>
            </div>
            <p className="font-bold underline text-slate-950">
              {formatPersonNameAndTitle(profile.namaKetuaPanitia) || 'Ketua Panitia Ujian'}
            </p>
            <p className="text-[9.5px] font-sans">NIP. {profile.nipKetuaPanitia || '-'}</p>
          </div>
          <div className="text-center w-52 leading-tight">
            <p className="text-[11px]">
              {profile.tempatTandaTangan ? `${profile.tempatTandaTangan}, ` : ''}
              {formatIndonesianDate(profile.tanggalSurat)}
            </p>
            <p className="font-bold">Kepala Madrasah,</p>
            <div className="h-14 flex items-center justify-center">
              {profile.ttdKepalaUrl ? (
                <img
                  src={profile.ttdKepalaUrl}
                  alt="TTD Kepala Madrasah"
                  className="max-h-14 max-w-[140px] object-contain mx-auto"
                />
              ) : (
                <span className="text-[9px] text-slate-300 italic font-sans">( Tanda Tangan & Cap )</span>
              )}
            </div>
            <p className="font-bold underline text-slate-950">
              {formatPersonNameAndTitle(profile.namaKepala) || '.........................'}
            </p>
            <p className="text-[9.5px] font-sans">NIP. {profile.nipKepala || '-'}</p>
          </div>
        </div>
      </div>

      {/* Halaman 2: Pemantauan Kebutuhan Penggandaan Soal & Dokumen per Ruang & Jadwal */}
      <div
        style={sheetStyle}
        className="saum-sheet border border-slate-300 shadow-sm text-[10px] leading-relaxed"
      >
        {(paperPreset?.showKop ?? true) && <KopSurat profile={profile} />}
        <div className="text-center my-3">
          <h2 className="text-sm font-bold uppercase font-serif tracking-wide underline">
            REKAPITULASI KEBUTUHAN PENGGANDAAN BERKAS & ADMINISTRASI RUANG
          </h2>
          <p className="text-xs font-semibold uppercase mt-0.5">
            {(profile.jenisUjian || 'UJIAN MADRASAH').toUpperCase()} •{' '}
            {isOnline
              ? 'MODA ONLINE (SOAL CBT DIGITAL — CETAK DH, BA & BLANGKO HP)'
              : `MODA KERTAS • CADANGAN ${cadangan} EKSEMPLAR / MAPEL / RUANG`}
          </p>
        </div>

        <table className="w-full text-[9.5px] border-collapse border border-slate-900 mb-4">
          <thead>
            <tr className="bg-slate-100 font-bold text-center">
              <th className="border border-slate-900 px-1.5 py-1.5 w-7">No</th>
              <th className="border border-slate-900 px-2 py-1.5 text-left">Hari / Tanggal & Sesi</th>
              <th className="border border-slate-900 px-2 py-1.5 text-left">Ruang</th>
              <th className="border border-slate-900 px-2 py-1.5 text-left">Rincian Mapel & Peserta</th>
              <th className="border border-slate-900 px-1.5 py-1.5">Peserta</th>
              {!isOnline && <th className="border border-slate-900 px-1.5 py-1.5">Total Soal</th>}
              {!isOnline && <th className="border border-slate-900 px-1.5 py-1.5">Total LJK</th>}
              <th className="border border-slate-900 px-1.5 py-1.5">Berkas Ruang</th>
              <th className="border border-slate-900 px-2 py-1.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {duplicationRows.map((row, idx) => (
              <tr key={row.key} className="tabular-nums">
                <td className="border border-slate-900 px-1.5 py-1 text-center">{idx + 1}</td>
                <td className="border border-slate-900 px-2 py-1">
                  <div className="font-bold">{formatDayAndDate(row.schedule.tanggal)}</div>
                  <div className="text-[8.5px] text-slate-600">
                    Sesi {row.schedule.sesi} ({row.schedule.waktuMulai}–{row.schedule.waktuSelesai})
                  </div>
                </td>
                <td className="border border-slate-900 px-2 py-1 font-bold">{row.room.namaRuang}</td>
                <td className="border border-slate-900 px-2 py-1">
                  {row.entries.map((e) => (
                    <div key={e.mapelId} className="leading-tight">
                      • <b>{e.subjectName}</b>:{' '}
                      {isOnline ? `${e.peserta} peserta (CBT)` : `${e.peserta} + ${e.cadangan} cad = ${e.totalSoal}`}
                    </div>
                  ))}
                </td>
                <td className="border border-slate-900 px-1.5 py-1 text-center">{row.totalPeserta}</td>
                {!isOnline && (
                  <td className="border border-slate-900 px-1.5 py-1 text-center font-bold">{row.totalSoal}</td>
                )}
                {!isOnline && (
                  <td className="border border-slate-900 px-1.5 py-1 text-center font-bold">{row.totalLjk}</td>
                )}
                <td className="border border-slate-900 px-1.5 py-1 text-center">
                  {row.daftarHadirRangkap} DH / {row.beritaAcaraRangkap} BA
                  {isOnline ? ` / ${row.blangkoHp} HP` : ` / ${row.amplopSoal} Amplop`}
                </td>
                <td className="border border-slate-900 px-2 py-1 text-center font-semibold">{row.status}</td>
              </tr>
            ))}
            <tr className="bg-slate-100 font-extrabold text-center tabular-nums">
              <td colSpan={5} className="border border-slate-900 px-2 py-1.5">TOTAL KESELURUHAN PENGGANDAAN</td>
              {!isOnline && <td className="border border-slate-900 px-1.5 py-1.5">{grandTotalSoal} Eks</td>}
              {!isOnline && <td className="border border-slate-900 px-1.5 py-1.5">{grandTotalLjk} Lbr</td>}
              <td className="border border-slate-900 px-1.5 py-1.5">{duplicationRows.length * 2} Set DH/BA</td>
              <td className="border border-slate-900 px-2 py-1.5">-</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
