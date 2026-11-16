import React from 'react';
import { MadrasahProfile, PaperPreset, TataTertibDoc } from '../../types';
import { KopSurat } from './KopSurat';
import { formatIndonesianDate } from '../../utils/qrBarcode';

interface TataTertibProps {
  profile: MadrasahProfile;
  type?: 'peserta' | 'pengawas' | 'semua';
  tataTertibDocs?: TataTertibDoc[];
  paperPreset?: PaperPreset;
}

export const TataTertib: React.FC<TataTertibProps> = ({
  profile,
  type = 'semua',
  tataTertibDocs,
  paperPreset,
}) => {
  const docsToRender: TataTertibDoc[] = (() => {
    if (tataTertibDocs && tataTertibDocs.length > 0) {
      if (type === 'semua') return tataTertibDocs;
      return tataTertibDocs.filter((d) => d.target === type);
    }
    return [];
  })();

  const isF4 = (doc?: TataTertibDoc) => (doc?.paperSize || paperPreset?.size) === 'F4';

  return (
    <div className="w-full flex flex-col items-center">
      {docsToRender.map((doc) => {
        const sheetClass = isF4(doc) ? 'w-[215mm] min-h-[330mm]' : 'w-[210mm] min-h-[297mm]';
        const margin = doc.marginMm || paperPreset?.marginTopMm || 12;

        return (
          <div
            key={doc.id}
            style={{ padding: `${margin}mm` }}
            className={`${sheetClass} bg-white text-slate-900 border border-slate-300 shadow-sm print:border-none print:shadow-none print:p-0 print-page-break mb-8 print:mb-0 text-[11px] leading-relaxed`}
          >
            {(paperPreset?.showKop ?? true) && <KopSurat profile={profile} />}

            <div className="text-center my-3">
              <h2 className="text-sm font-extrabold uppercase font-serif tracking-wide underline">
                {doc.title}
              </h2>
              <p className="text-xs font-semibold uppercase mt-0.5">
                {profile.jenisUjian.toUpperCase()} • TAHUN PELAJARAN {profile.tahunPelajaran}
              </p>
              {doc.sourceFileName && (
                <p className="text-[9.5px] text-slate-400 no-print mt-0.5">
                  Sumber dokumen: {doc.sourceFileName}
                </p>
              )}
            </div>

            {/* Render lines verbatim without altering wording */}
            <div className="space-y-2 text-justify mt-4 font-serif whitespace-pre-wrap">
              {doc.contentLines.map((line, i) => (
                <p key={i} className="leading-relaxed text-slate-900">
                  {line}
                </p>
              ))}
            </div>

            <div className="mt-8 flex justify-end text-xs font-serif">
              <div className="text-center w-56 leading-tight">
                <p>
                  {profile.tempatTandaTangan}, {formatIndonesianDate(profile.tanggalSurat)}
                </p>
                <p className="font-bold">Kepala Madrasah,</p>
                <div className="h-14" />
                <p className="font-bold underline uppercase">{profile.namaKepala}</p>
                <p className="text-[10px] font-sans">NIP. {profile.nipKepala || '-'}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
