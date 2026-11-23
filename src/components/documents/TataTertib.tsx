import React from 'react';
import { MadrasahProfile, PaperPreset, TataTertibDoc } from '../../types';
import { KopSurat } from './KopSurat';
import { formatIndonesianDate } from '../../utils/qrBarcode';
import { getSheetScreenStyle } from '../../utils/printLayout';
import { formatPersonNameAndTitle } from '../../utils/formatName';

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

  if (docsToRender.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
        <p className="text-slate-500 font-medium">Belum ada dokumen Tata Tertib yang tersedia.</p>
      </div>
    );
  }

  return (
    <div className="print-container w-full block print:m-0 print:p-0">
      {docsToRender.map((doc) => {
        const effectivePreset: Partial<PaperPreset> = {
          ...paperPreset,
          size: paperPreset?.size || doc.paperSize || 'A4',
          marginTopMm: paperPreset?.marginTopMm ?? doc.marginMm ?? 10,
          marginRightMm: paperPreset?.marginRightMm ?? doc.marginMm ?? 10,
          marginBottomMm: paperPreset?.marginBottomMm ?? doc.marginMm ?? 10,
          marginLeftMm: paperPreset?.marginLeftMm ?? doc.marginMm ?? 10,
        };
        const sheetStyle = getSheetScreenStyle(effectivePreset);

        return (
          <div
            key={doc.id}
            style={sheetStyle}
            className="saum-sheet border border-slate-300 shadow-sm print-page-break mb-8 print:mb-0 text-[11px] leading-relaxed"
          >
            {(paperPreset?.showKop ?? true) && <KopSurat profile={profile} />}

            <div className="text-center my-3">
              <h2 className="text-sm font-extrabold uppercase font-serif tracking-wide underline">
                {doc.title}
              </h2>
              <p className="text-xs font-semibold uppercase mt-0.5">
                {(profile.jenisUjian || 'UJIAN MADRASAH').toUpperCase()} • TAHUN PELAJARAN{' '}
                {profile.tahunPelajaran || '-'}
              </p>
              {doc.sourceFileName && (
                <p className="text-[9.5px] text-slate-400 no-print mt-0.5">
                  Sumber dokumen: {doc.sourceFileName}
                </p>
              )}
            </div>

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
                <p className="font-bold underline">
                  {formatPersonNameAndTitle(profile.namaKepala) || '.........................'}
                </p>
                <p className="text-[10px] font-sans">NIP. {profile.nipKepala || '-'}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
