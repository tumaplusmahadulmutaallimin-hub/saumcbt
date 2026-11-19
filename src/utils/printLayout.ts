import React, { useEffect, useState } from 'react';
import { PaperOrientation, PaperPreset, PaperSize } from '../types';

export const FALLBACK_PAPER_PRESET: PaperPreset = {
  id: 'default',
  label: 'Umum / Lainnya',
  size: 'A4',
  orientation: 'portrait',
  marginTopMm: 10,
  marginBottomMm: 10,
  marginLeftMm: 10,
  marginRightMm: 10,
  scalePercent: 100,
  fontSizePt: 10.5,
  lineHeight: 1.4,
  showKop: true,
  headerText: '',
  footerText: '',
};

export function getPaperDimensionsMm(
  size: PaperSize = 'A4',
  orientation: PaperOrientation = 'portrait'
): { widthMm: number; heightMm: number } {
  const baseW = size === 'F4' ? 215 : 210;
  const baseH = size === 'F4' ? 330 : 297;
  return orientation === 'landscape'
    ? { widthMm: baseH, heightMm: baseW }
    : { widthMm: baseW, heightMm: baseH };
}

export function resolvePaperPreset(
  preset?: Partial<PaperPreset>,
  fallback?: { size?: PaperSize; orientation?: PaperOrientation; marginMm?: number }
): PaperPreset {
  const defaultMargin = fallback?.marginMm ?? 10;
  return {
    ...FALLBACK_PAPER_PRESET,
    size: fallback?.size || FALLBACK_PAPER_PRESET.size,
    orientation: fallback?.orientation || FALLBACK_PAPER_PRESET.orientation,
    ...preset,
    scalePercent: Math.min(130, Math.max(60, preset?.scalePercent ?? 100)),
    marginTopMm: Math.max(0, Math.min(40, preset?.marginTopMm ?? defaultMargin)),
    marginRightMm: Math.max(0, Math.min(40, preset?.marginRightMm ?? defaultMargin)),
    marginBottomMm: Math.max(0, Math.min(40, preset?.marginBottomMm ?? defaultMargin)),
    marginLeftMm: Math.max(0, Math.min(40, preset?.marginLeftMm ?? defaultMargin)),
  };
}

/**
 * Generates CSS variables and preview sizing for `.saum-sheet`.
 * On screen: shows exact paper size (`210mm`, `215mm`, `297mm`, `330mm`) with exact 4-side padding.
 * On `@media print`: CSS sets `width: 100% !important; min-height: 0 !important; padding: 0 !important;`
 * while `@page { size: ...; margin: <top> <right> <bottom> <left>; }` applies physical printer margins.
 */
export function getSheetScreenStyle(
  preset?: Partial<PaperPreset>,
  fallback?: { size?: PaperSize; orientation?: PaperOrientation; marginMm?: number }
): React.CSSProperties {
  const resolved = resolvePaperPreset(preset, fallback);
  const { widthMm, heightMm } = getPaperDimensionsMm(resolved.size, resolved.orientation);
  const scale = (resolved.scalePercent ?? 100) / 100;

  return {
    ['--saum-sheet-w' as string]: `${widthMm}mm`,
    ['--saum-sheet-h' as string]: `${heightMm}mm`,
    ['--saum-pt' as string]: `${resolved.marginTopMm}mm`,
    ['--saum-pr' as string]: `${resolved.marginRightMm}mm`,
    ['--saum-pb' as string]: `${resolved.marginBottomMm}mm`,
    ['--saum-pl' as string]: `${resolved.marginLeftMm}mm`,
    ['--saum-scale' as string]: `${scale}`,
    fontSize: resolved.fontSizePt ? `${resolved.fontSizePt}pt` : undefined,
    lineHeight: resolved.lineHeight || undefined,
  };
}

/**
 * Computes exact printable card height for 2-column grids (e.g. 6 cards on F4 = 2 cols x 3 rows)
 * so 6 cards neatly fill the full sheet between top and bottom margins without spilling to page 2.
 */
export function getCardGridMetrics(
  preset?: Partial<PaperPreset>,
  options?: { defaultSize?: PaperSize; defaultCardsPerPage?: 4 | 6; gapMm?: number }
): {
  resolved: PaperPreset;
  cardsPerPage: 4 | 6;
  rows: 2 | 3;
  cardHeightMm: number;
  printableWidthMm: number;
  printableHeightMm: number;
} {
  const resolved = resolvePaperPreset(preset, {
    size: options?.defaultSize || 'F4',
    orientation: 'portrait',
    marginMm: 6,
  });
  const { widthMm, heightMm } = getPaperDimensionsMm(resolved.size, resolved.orientation);
  const printableWidthMm = Math.max(120, widthMm - resolved.marginLeftMm - resolved.marginRightMm);
  const printableHeightMm = Math.max(180, heightMm - resolved.marginTopMm - resolved.marginBottomMm);

  const cardsPerPage: 4 | 6 =
    resolved.cardsPerPage ||
    options?.defaultCardsPerPage ||
    (resolved.size === 'F4' ? 6 : 4);
  const rows: 2 | 3 = cardsPerPage === 6 ? 3 : 2;
  const gapMm = options?.gapMm ?? 4;
  // Reserve ~1.5mm safety buffer so browser rounding never spills the 3rd row to the next page
  const cardHeightMm = Math.floor(((printableHeightMm - gapMm * (rows - 1) - 2) / rows) * 10) / 10;

  return {
    resolved,
    cardsPerPage,
    rows,
    cardHeightMm,
    printableWidthMm,
    printableHeightMm,
  };
}

export function usePrintLayout(
  initialPreset?: Partial<PaperPreset>,
  fallback?: { size?: PaperSize; orientation?: PaperOrientation; marginMm?: number }
) {
  const resolvedInitial = resolvePaperPreset(initialPreset, fallback);
  const [layout, setLayout] = useState<PaperPreset>(resolvedInitial);

  const syncKey = [
    initialPreset?.id,
    initialPreset?.size,
    initialPreset?.orientation,
    initialPreset?.marginTopMm,
    initialPreset?.marginRightMm,
    initialPreset?.marginBottomMm,
    initialPreset?.marginLeftMm,
    initialPreset?.scalePercent,
    initialPreset?.cardsPerPage,
    fallback?.size,
    fallback?.orientation,
  ].join('|');

  useEffect(() => {
    setLayout(resolvePaperPreset(initialPreset, fallback));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncKey]);

  return { layout, setLayout };
}
