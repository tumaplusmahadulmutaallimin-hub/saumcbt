import React from 'react';
import {
  CommitteeMember,
  ExamRoom,
  ExamSchedule,
  ExamSubject,
  MadrasahProfile,
  Student,
  Supervisor,
} from '../../types';
import { KopSurat } from './KopSurat';
import { formatDayAndDate, formatIndonesianDate } from '../../utils/qrBarcode';

interface RekapitulasiLaporanProps {
  profile: MadrasahProfile;
  students: Student[];
  rooms: ExamRoom[];
  schedules: ExamSchedule[];
  subjects: ExamSubject[];
  committee: CommitteeMember[];
  supervisors: Supervisor[];
}

export const RekapitulasiLaporan: React.FC<RekapitulasiLaporanProps> = ({
  profile,
  students,
  rooms,
  schedules,
  subjects,
  committee,
  supervisors,
}) => {
  const activeStudents = students.filter((s) => s.status === 'Aktif');
  const subjectMap = new Map(subjects.map((s) => [s.id, s]));

  // Breakdown by class
  const classBreakdown: { [cls: string]: { l: number; p: number; total: number } } = {};
  for (const s of activeStudents) {
    if (!classBreakdown[s.kelas]) {
      classBreakdown[s.kelas] = { l: 0, p: 0, total: 0 };
    }
    if (s.jenisKelamin === 'L') classBreakdown[s.kelas].l++;
    else classBreakdown[s.kelas].p++;
    classBreakdown[s.kelas].total++;
  }

  const classes = Object.keys(classBreakdown).sort();
  const totalL = activeStudents.filter((s) => s.jenisKelamin === 'L').length;
  const totalP = activeStudents.filter((s) => s.jenisKelamin === 'P').length;

  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-[210mm] min-h-[297mm] p-[10mm] bg-white text-slate-900 border border-slate-300 shadow-sm print:border-none print:shadow-none print:p-0 print-page-break mb-8 print:mb-0 text-[11px] leading-relaxed">
        <KopSurat profile={profile} />

        <div className="text-center my-3">
          <h2 className="text-sm font-bold uppercase font-serif tracking-wide underline">
            REKAPITULASI DAN LAPORAN ADMINISTRASI UJIAN
          </h2>
          <p className="text-xs font-semibold uppercase mt-0.5">
            {profile.jenisUjian.toUpperCase()} - TAHUN PELAJARAN {profile.tahunPelajaran}
          </p>
        </div>

        {/* Section 1: Data Peserta per Kelas */}
        <div className="mt-4">
          <h3 className="font-bold text-xs uppercase text-slate-900 mb-1 border-b border-slate-300 pb-0.5">
            I. REKAPITULASI PESERTA UJIAN BERDASARKAN KELAS & GENDER
          </h3>
          <table className="w-full text-xs border-collapse border border-slate-900 mb-3">
            <thead>
              <tr className="bg-slate-100 font-bold">
                <th className="border border-slate-900 px-2 py-1 w-10 text-center">No</th>
                <th className="border border-slate-900 px-4 py-1 text-left">Tingkat / Rombel</th>
                <th className="border border-slate-900 px-4 py-1 w-28 text-center">Laki-laki (L)</th>
                <th className="border border-slate-900 px-4 py-1 w-28 text-center">Perempuan (P)</th>
                <th className="border border-slate-900 px-4 py-1 w-28 text-center">Jumlah Siswa</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((cls, idx) => (
                <tr key={cls}>
                  <td className="border border-slate-900 px-2 py-1 text-center font-medium">{idx + 1}</td>
                  <td className="border border-slate-900 px-4 py-1 font-bold">{cls}</td>
                  <td className="border border-slate-900 px-4 py-1 text-center">{classBreakdown[cls].l}</td>
                  <td className="border border-slate-900 px-4 py-1 text-center">{classBreakdown[cls].p}</td>
                  <td className="border border-slate-900 px-4 py-1 text-center font-bold text-emerald-900">
                    {classBreakdown[cls].total}
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-100 font-extrabold text-slate-950">
                <td colSpan={2} className="border border-slate-900 px-4 py-1.5 text-center">
                  TOTAL KESELURUHAN
                </td>
                <td className="border border-slate-900 px-4 py-1.5 text-center">{totalL}</td>
                <td className="border border-slate-900 px-4 py-1.5 text-center">{totalP}</td>
                <td className="border border-slate-900 px-4 py-1.5 text-center text-emerald-950 font-black">
                  {activeStudents.length} Peserta
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section 2: Rekapitulasi per Ruang Ujian */}
        <div className="mt-4">
          <h3 className="font-bold text-xs uppercase text-slate-900 mb-1 border-b border-slate-300 pb-0.5">
            II. DISTRIBUSI PESERTA PER RUANG UJIAN
          </h3>
          <table className="w-full text-xs border-collapse border border-slate-900 mb-3">
            <thead>
              <tr className="bg-slate-100 font-bold">
                <th className="border border-slate-900 px-2 py-1 w-10 text-center">No</th>
                <th className="border border-slate-900 px-3 py-1 text-left">Nama Ruang</th>
                <th className="border border-slate-900 px-3 py-1 w-28 text-center">Kapasitas</th>
                <th className="border border-slate-900 px-3 py-1 w-28 text-center">Terisi</th>
                <th className="border border-slate-900 px-3 py-1 text-center">Rentang No. Peserta</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((r, idx) => {
                const roomSts = activeStudents
                  .filter((s) => s.ruangId === r.id)
                  .sort((a, b) => (a.nomorMeja || 0) - (b.nomorMeja || 0));
                const first = roomSts[0]?.nomorPeserta || '-';
                const last = roomSts[roomSts.length - 1]?.nomorPeserta || '-';

                return (
                  <tr key={r.id}>
                    <td className="border border-slate-900 px-2 py-1 text-center font-medium">{idx + 1}</td>
                    <td className="border border-slate-900 px-3 py-1 font-bold">{r.namaRuang}</td>
                    <td className="border border-slate-900 px-3 py-1 text-center">{r.kapasitas} Kursi</td>
                    <td className="border border-slate-900 px-3 py-1 text-center font-bold text-emerald-900">
                      {roomSts.length} Siswa
                    </td>
                    <td className="border border-slate-900 px-3 py-1 text-center font-mono font-semibold">
                      {first} s.d. {last}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Section 3: Status Kelengkapan Dokumen Administrasi */}
        <div className="mt-4">
          <h3 className="font-bold text-xs uppercase text-slate-900 mb-1 border-b border-slate-300 pb-0.5">
            III. STATUS KELENGKAPAN PERANGKAT ADMINISTRASI UJIAN
          </h3>
          <div className="grid grid-cols-2 gap-2 text-[10.5px]">
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-700 font-bold">✓</span>
              <span>1. SK Panitia & Susunan Panitia Pelaksana</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-700 font-bold">✓</span>
              <span>2. Surat Tugas & Jadwal Pengawas Ruang</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-700 font-bold">✓</span>
              <span>3. Nomor Peserta Ujian Lengkap & Unik</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-700 font-bold">✓</span>
              <span>4. Kartu Peserta Ujian Siap Cetak</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-700 font-bold">✓</span>
              <span>5. Denah Tempat Duduk Setiap Ruang Ujian</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-700 font-bold">✓</span>
              <span>6. Daftar Hadir Peserta per Mata Pelajaran</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-700 font-bold">✓</span>
              <span>7. Berita Acara Pelaksanaan Ujian</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-700 font-bold">✓</span>
              <span>8. Label Meja, Label Pintu, & Amplop Soal</span>
            </div>
          </div>
        </div>

        {/* Signatures */}
        <div className="mt-8 flex justify-between items-start text-xs font-serif">
          <div className="text-center w-52 leading-tight">
            <p className="font-bold">Ketua Panitia Ujian,</p>
            <div className="h-16 flex items-center justify-center">
              <span className="text-[10px] text-slate-300 italic font-sans">( Tanda Tangan )</span>
            </div>
            <p className="font-bold underline uppercase text-slate-950">
              {profile.namaKetuaPanitia || 'Ketua Panitia Ujian'}
            </p>
            <p className="text-[10px] font-sans">NIP. {profile.nipKetuaPanitia || '-'}</p>
          </div>

          <div className="text-center w-52 leading-tight">
            <p className="text-[11px]">
              {profile.tempatTandaTangan}, {formatIndonesianDate(profile.tanggalSurat || '2026-03-23')}
            </p>
            <p className="font-bold">Kepala Madrasah,</p>
            <div className="h-16 flex items-center justify-center">
              <span className="text-[10px] text-slate-300 italic font-sans">( Tanda Tangan & Cap )</span>
            </div>
            <p className="font-bold underline uppercase text-slate-950">{profile.namaKepala}</p>
            <p className="text-[10px] font-sans">NIP. {profile.nipKepala || '-'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
