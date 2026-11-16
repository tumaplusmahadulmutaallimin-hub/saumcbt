import React from 'react';
import { Printer, ArrowLeft, FileSpreadsheet } from 'lucide-react';
import { PaperOrientation, PaperSize } from '../../types';

interface PrintToolbarProps {
  title: string;
  onBack?: () => void;
  onExportExcel?: () => void;
  paperSize?: PaperSize;
  orientation?: PaperOrientation;
  extraControls?: React.ReactNode;
}

export const PrintToolbar: React.FC<PrintToolbarProps> = ({
  title,
  onBack,
  onExportExcel,
  paperSize = 'A4',
  orientation = 'portrait',
  extraControls,
}) => {
  const handlePrint = () => {
    window.print();
  };

  const pageCssSize =
    paperSize === 'F4'
      ? `215mm 330mm ${orientation}`
      : `A4 ${orientation}`;

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: ${pageCssSize};
            margin: 8mm 10mm;
          }
        }
      `}</style>
      <div className="no-print sticky top-0 z-30 bg-white border border-slate-200 px-4 py-3 mb-5 rounded-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Kembali
              </button>
            )}
            <div>
              <h2 className="text-sm font-bold text-slate-900">{title}</h2>
              <p className="text-xs text-slate-500">
                Format: {paperSize} {orientation === 'landscape' ? 'Landscape' : 'Portrait'} • Pratinjau 1:1 siap cetak
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {extraControls}

            {onExportExcel && (
              <button
                onClick={onExportExcel}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                Unduh Excel
              </button>
            )}

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Cetak / Simpan PDF
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
