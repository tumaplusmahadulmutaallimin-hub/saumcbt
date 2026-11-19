import React, { useEffect, useState } from 'react';
import {
  Printer,
  ArrowLeft,
  FileSpreadsheet,
  SlidersHorizontal,
  Save,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { PaperOrientation, PaperPreset, PaperSize } from '../../types';
import { resolvePaperPreset } from '../../utils/printLayout';

interface PrintToolbarProps {
  title: string;
  onBack?: () => void;
  onExportExcel?: () => void;
  paperSize?: PaperSize;
  orientation?: PaperOrientation;
  layout?: PaperPreset;
  onLayoutChange?: (next: PaperPreset) => void;
  onSaveLayout?: (next: PaperPreset) => Promise<void> | void;
  extraControls?: React.ReactNode;
  defaultOpenLayout?: boolean;
  showCardDensity?: boolean;
  showKopToggle?: boolean;
  isSticky?: boolean;
}

export const PrintToolbar: React.FC<PrintToolbarProps> = ({
  title,
  onBack,
  onExportExcel,
  paperSize,
  orientation,
  layout,
  onLayoutChange,
  onSaveLayout,
  extraControls,
  defaultOpenLayout = false,
  showCardDensity = false,
  showKopToggle = false,
  isSticky = true,
}) => {
  const [localLayout, setLocalLayout] = useState<PaperPreset>(() =>
    resolvePaperPreset(layout, {
      size: paperSize || 'A4',
      orientation: orientation || 'portrait',
    })
  );
  const [showLayoutPanel, setShowLayoutPanel] = useState(defaultOpenLayout);
  const [savingLayout, setSavingLayout] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    setLocalLayout(
      resolvePaperPreset(layout, {
        size: layout?.size || paperSize || 'A4',
        orientation: layout?.orientation || orientation || 'portrait',
      })
    );
  }, [layout, paperSize, orientation]);

  const effective = layout
    ? resolvePaperPreset(layout, { size: paperSize, orientation })
    : localLayout;

  const updateField = (patch: Partial<PaperPreset>) => {
    const next = resolvePaperPreset({ ...effective, ...patch });
    setLocalLayout(next);
    if (onLayoutChange) onLayoutChange(next);
  };

  const applyQuickMargins = (top: number, right: number, bottom: number, left: number) => {
    updateField({
      marginTopMm: top,
      marginRightMm: right,
      marginBottomMm: bottom,
      marginLeftMm: left,
      scalePercent: 100,
    });
  };

  const handleSave = async () => {
    if (!onSaveLayout) return;
    setSavingLayout(true);
    try {
      await onSaveLayout(effective);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2000);
    } finally {
      setSavingLayout(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const pageCssSize =
    effective.size === 'F4'
      ? `215mm 330mm ${effective.orientation}`
      : `A4 ${effective.orientation}`;

  const scaleInfo =
    (effective.scalePercent ?? 100) !== 100 ? ` • Skala ${effective.scalePercent}%` : '';

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: ${pageCssSize};
            margin: ${effective.marginTopMm}mm ${effective.marginRightMm}mm ${effective.marginBottomMm}mm ${effective.marginLeftMm}mm;
          }
        }
      `}</style>
      <div
        className={`no-print ${
          isSticky ? 'sticky top-0 z-30' : ''
        } bg-white border border-slate-200 px-4 py-3 mb-5 rounded-xl shadow-xs`}
      >
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
              <p className="text-xs text-slate-500 tabular-nums">
                Kertas: <strong>{effective.size}</strong> (
                {effective.orientation === 'landscape' ? 'Landscape' : 'Portrait'}) • Margin A/Ka/B/Ki:{' '}
                {effective.marginTopMm}/{effective.marginRightMm}/{effective.marginBottomMm}/
                {effective.marginLeftMm} mm{scaleInfo}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {extraControls}

            <button
              type="button"
              onClick={() => setShowLayoutPanel((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                showLayoutPanel
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Atur Kertas & Margin
              {showLayoutPanel ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

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

        {/* Interactive Paper & 4-Side Margin Layout Panel */}
        {showLayoutPanel && (
          <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 items-end">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Jenis Kertas
              </label>
              <select
                value={effective.size}
                onChange={(e) => updateField({ size: e.target.value as PaperSize })}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
              >
                <option value="A4">A4 (210 × 297 mm)</option>
                <option value="F4">F4 / Folio (215 × 330 mm)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Orientasi
              </label>
              <select
                value={effective.orientation}
                onChange={(e) =>
                  updateField({ orientation: e.target.value as PaperOrientation })
                }
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
              >
                <option value="portrait">Portrait (Tegak)</option>
                <option value="landscape">Landscape (Mendatar)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Margin Atas (mm)
              </label>
              <input
                type="number"
                min={0}
                max={40}
                value={effective.marginTopMm}
                onChange={(e) => updateField({ marginTopMm: Number(e.target.value || 0) })}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg tabular-nums"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Margin Kanan (mm)
              </label>
              <input
                type="number"
                min={0}
                max={40}
                value={effective.marginRightMm}
                onChange={(e) => updateField({ marginRightMm: Number(e.target.value || 0) })}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg tabular-nums"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Margin Bawah (mm)
              </label>
              <input
                type="number"
                min={0}
                max={40}
                value={effective.marginBottomMm}
                onChange={(e) => updateField({ marginBottomMm: Number(e.target.value || 0) })}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg tabular-nums"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Margin Kiri (mm)
              </label>
              <input
                type="number"
                min={0}
                max={40}
                value={effective.marginLeftMm}
                onChange={(e) => updateField({ marginLeftMm: Number(e.target.value || 0) })}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg tabular-nums"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Skala Cetak (%)
              </label>
              <input
                type="number"
                min={60}
                max={120}
                step={5}
                value={effective.scalePercent ?? 100}
                onChange={(e) => updateField({ scalePercent: Number(e.target.value || 100) })}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg tabular-nums"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => applyQuickMargins(5, 5, 5, 5)}
                  className="flex-1 px-2 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded cursor-pointer"
                  title="Maksimalkan area isi kertas (margin 5mm)"
                >
                  Penuh 5mm
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickMargins(10, 10, 10, 10)}
                  className="flex-1 px-2 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded cursor-pointer"
                  title="Margin standar 10mm"
                >
                  10mm
                </button>
              </div>
              {onSaveLayout && (
                <button
                  type="button"
                  disabled={savingLayout}
                  onClick={handleSave}
                  className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-[11px] font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded cursor-pointer disabled:opacity-60"
                >
                  <Save className="w-3 h-3" />
                  {savedNotice ? 'Tersimpan!' : savingLayout ? 'Menyimpan...' : 'Simpan Default'}
                </button>
              )}
            </div>

            {(showCardDensity || showKopToggle) && (
              <div className="col-span-2 sm:col-span-4 lg:col-span-8 pt-2 border-t border-slate-100 flex flex-wrap items-center gap-4 text-xs">
                {showCardDensity && (
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-semibold text-slate-600">Jumlah Kartu / Lembar:</label>
                    <select
                      value={effective.cardsPerPage || 6}
                      onChange={(e) =>
                        updateField({ cardsPerPage: Number(e.target.value) === 4 ? 4 : 6 })
                      }
                      className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white font-semibold"
                    >
                      <option value={6}>6 Kartu / Lembar (Optimal F4)</option>
                      <option value={4}>4 Kartu / Lembar (Standar A4)</option>
                    </select>
                  </div>
                )}
                {showKopToggle && (
                  <label className="inline-flex items-center gap-2 text-[11px] font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={effective.showKop ?? true}
                      onChange={(e) => updateField({ showKop: e.target.checked })}
                    />
                    Tampilkan KOP Surat Resmi di Dokumen
                  </label>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};
