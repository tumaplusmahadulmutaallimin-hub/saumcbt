import React from 'react';
import { CommitteeMember, ExamRoom, MadrasahProfile, Supervisor } from '../../types';
import { KopSurat } from './KopSurat';
import { formatIndonesianDate } from '../../utils/qrBarcode';

interface SKPanitiaProps {
  profile: MadrasahProfile;
  committee: CommitteeMember[];
  supervisors: Supervisor[];
  rooms: ExamRoom[];
  selectedType: 'sk_panitia' | 'surat_tugas';
}

export const SKPanitia: React.FC<SKPanitiaProps> = ({
  profile,
  committee,
  supervisors,
  rooms,
  selectedType,
}) => {
  const roomMap = new Map(rooms.map((r) => [r.id, r]));

  // 1. SURAT KEPUTUSAN (SK) PANITIA
  if (selectedType === 'sk_panitia') {
    return (
      <div className="w-full flex flex-col items-center">
        <div className="w-[210mm] min-h-[297mm] p-[12mm] bg-white text-slate-900 border border-slate-300 shadow-sm print:border-none print:shadow-none print:p-0 print-page-break mb-8 print:mb-0 text-[11px] leading-relaxed">
          <KopSurat profile={profile} />

          <div className="text-center my-3">
            <h2 className="text-xs font-bold uppercase font-serif tracking-wider">
              KEPUTUSAN KEPALA {profile.namaMadrasah.toUpperCase()}
            </h2>
            <p className="text-[10px] font-mono mt-0.5">
              NOMOR: {profile.nsm} / SK-PANITIA / {new Date().getFullYear()}
            </p>
            <p className="text-xs font-bold uppercase mt-1">TENTANG</p>
            <p className="text-xs font-extrabold uppercase text-slate-950 max-w-lg mx-auto">
              SUSUNAN PANITIA PELAKSANA {profile.jenisUjian.toUpperCase()}
              <br />TAHUN PELAJARAN {profile.tahunPelajaran}
            </p>
          </div>

          <div className="space-y-2 mt-4 text-justify font-serif">
            <div className="flex">
              <span className="w-24 font-bold">Menimbang</span>
              <span className="mr-2">:</span>
              <p className="flex-1">
                Bahwa demi kelancaran, ketertiban, dan tercapainya tujuan pelaksanaan {profile.jenisUjian} Tahun Pelajaran {profile.tahunPelajaran}, dipandang perlu menetapkan Panitia Pelaksana.
              </p>
            </div>
            <div className="flex">
              <span className="w-24 font-bold">Mengingat</span>
              <span className="mr-2">:</span>
              <div className="flex-1 space-y-0.5 text-[10.5px]">
                <p>1. Undang-Undang Nomor 20 Tahun 2003 tentang Sistem Pendidikan Nasional.</p>
                <p>2. Peraturan Pemerintah Nomor 17 Tahun 2010 tentang Pengelolaan dan Penyelenggaraan Pendidikan.</p>
                <p>3. Keputusan Direktur Jenderal Pendidikan Islam Kementerian Agama RI tentang Petunjuk Teknis Penyelenggaraan Asesmen Madrasah.</p>
              </div>
            </div>
            <div className="flex">
              <span className="w-24 font-bold">MEMUTUSKAN</span>
              <span className="mr-2">:</span>
              <p className="flex-1 font-sans text-slate-400 text-xs italic">Menetapkan Susunan Panitia</p>
            </div>
            <div className="flex">
              <span className="w-24 font-bold">Pertama</span>
              <span className="mr-2">:</span>
              <p className="flex-1">
                Mengangkat dan menetapkan nama-nama sebagaimana tercantum dalam lampiran keputusan ini sebagai Panitia Pelaksana {profile.jenisUjian}.
              </p>
            </div>
            <div className="flex">
              <span className="w-24 font-bold">Kedua</span>
              <span className="mr-2">:</span>
              <p className="flex-1">
                Panitia bertanggung jawab langsung kepada Kepala Madrasah dan melaporkan hasil pelaksanaan ujian setelah seluruh kegiatan selesai.
              </p>
            </div>
            <div className="flex">
              <span className="w-24 font-bold">Ketiga</span>
              <span className="mr-2">:</span>
              <p className="flex-1">
                Keputusan ini berlaku sejak tanggal ditetapkan dengan ketentuan apabila terdapat kekeliruan akan diadakan perbaikan sebagaimana mestinya.
              </p>
            </div>
          </div>

          {/* Table of Committee */}
          <div className="mt-4 font-sans">
            <p className="text-[10px] font-bold uppercase text-slate-700 mb-1">
              Lampiran: Susunan Panitia Pelaksana Ujian
            </p>
            <table className="w-full text-[10.5px] border-collapse border border-slate-900">
              <thead>
                <tr className="bg-slate-100 font-bold">
                  <th className="border border-slate-900 px-2 py-1 w-8 text-center">No</th>
                  <th className="border border-slate-900 px-3 py-1 text-left">Nama / NIP</th>
                  <th className="border border-slate-900 px-3 py-1 w-36 text-left">Jabatan Kepanitiaan</th>
                  <th className="border border-slate-900 px-3 py-1 text-left">Tugas Utama</th>
                </tr>
              </thead>
              <tbody>
                {committee.map((c, idx) => (
                  <tr key={c.id}>
                    <td className="border border-slate-900 px-2 py-1 text-center font-medium">{idx + 1}</td>
                    <td className="border border-slate-900 px-3 py-1">
                      <p className="font-bold text-slate-900 uppercase">{c.nama}</p>
                      <p className="text-[9px] text-slate-500 font-mono">NIP: {c.nip || '-'}</p>
                    </td>
                    <td className="border border-slate-900 px-3 py-1 font-semibold text-emerald-900">{c.jabatan}</td>
                    <td className="border border-slate-900 px-3 py-1 text-[10px]">{c.tugas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex justify-end text-xs font-serif">
            <div className="text-center w-56 leading-tight">
              <p>
                Ditetapkan di: {profile.tempatTandaTangan}
                <br />Pada tanggal: {formatIndonesianDate(profile.tanggalSurat || '2026-03-23')}
              </p>
              <p className="font-bold mt-1">Kepala Madrasah,</p>
              <div className="h-14 flex items-center justify-center">
                <span className="text-[9px] text-slate-300 italic font-sans">( Tanda Tangan & Cap )</span>
              </div>
              <p className="font-bold underline uppercase text-slate-950">{profile.namaKepala}</p>
              <p className="text-[10px] font-sans">NIP. {profile.nipKepala || '-'}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. SURAT TUGAS PENGAWAS RUANG
  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-[210mm] min-h-[297mm] p-[12mm] bg-white text-slate-900 border border-slate-300 shadow-sm print:border-none print:shadow-none print:p-0 print-page-break mb-8 print:mb-0 text-[11px] leading-relaxed">
        <KopSurat profile={profile} />

        <div className="text-center my-4">
          <h2 className="text-sm font-bold uppercase font-serif tracking-wide underline">
            SURAT TUGAS PENGAWAS UJIAN
          </h2>
          <p className="text-xs font-mono text-slate-600 mt-0.5">
            NOMOR: {profile.nsm} / ST-PENGAWAS / {new Date().getFullYear()}
          </p>
        </div>

        <div className="space-y-3 text-justify font-serif">
          <p>
            Yang bertanda tangan di bawah ini Kepala <span className="font-bold">{profile.namaMadrasah}</span>, dengan
            ini memberikan tugas pengawasan {profile.jenisUjian} Tahun Pelajaran {profile.tahunPelajaran} kepada:
          </p>

          <table className="w-full text-xs font-sans border-collapse border border-slate-900 my-2">
            <thead>
              <tr className="bg-slate-100 font-bold">
                <th className="border border-slate-900 px-2 py-1 w-8 text-center">No</th>
                <th className="border border-slate-900 px-3 py-1 text-left">Nama Guru / Pegawai</th>
                <th className="border border-slate-900 px-3 py-1 w-36 text-left">NIP / NUPTK</th>
                <th className="border border-slate-900 px-3 py-1 w-44 text-left">Asal Satuan Pendidikan</th>
                <th className="border border-slate-900 px-3 py-1 w-28 text-center">Tugas Ruang</th>
              </tr>
            </thead>
            <tbody>
              {supervisors.map((sp, idx) => {
                // Find assigned room
                const assignedRoom = rooms.find((r) => r.pengawas1Id === sp.id || r.pengawas2Id === sp.id);
                return (
                  <tr key={sp.id}>
                    <td className="border border-slate-900 px-2 py-1 text-center font-medium">{idx + 1}</td>
                    <td className="border border-slate-900 px-3 py-1 font-bold uppercase">{sp.nama}</td>
                    <td className="border border-slate-900 px-3 py-1 font-mono">{sp.nip || '-'}</td>
                    <td className="border border-slate-900 px-3 py-1">{sp.asalMadrasah}</td>
                    <td className="border border-slate-900 px-3 py-1 text-center font-bold text-emerald-900">
                      {assignedRoom ? assignedRoom.namaRuang : 'Pengawas Cadangan'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <p>
            Untuk melaksanakan tugas sebagai Pengawas Ruang pada pelaksanaan {profile.jenisUjian} sesuai jadwal yang
            telah ditetapkan dengan penuh tanggung jawab, dedikasi, serta mematuhi tata tertib pengawas yang berlaku.
          </p>

          <p>Demikian surat tugas ini dibuat agar dapat dilaksanakan dengan sebaik-baiknya.</p>
        </div>

        <div className="mt-8 flex justify-end text-xs font-serif">
          <div className="text-center w-56 leading-tight">
            <p>
              {profile.tempatTandaTangan}, {formatIndonesianDate(profile.tanggalSurat || '2026-03-23')}
            </p>
            <p className="font-bold mt-1">Kepala Madrasah,</p>
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
