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
  const baseW = 210; // Both A4 (210x297) and Indonesian F4 (210x330) have 210mm base width
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
 * Normalizes preset defaults for F4 card & F4 landscape schedule views so legacy 6mm/8mm
 * unmodified DB defaults smoothly upgrade to exact 15mm (1.5 cm) standard margins without mutating DB.
 */
export function normalizeTargetPaperPreset(
  target: 'kartu_peserta' | 'nomor_meja' | 'jadwal_ujian' | 'other',
  preset?: Partial<PaperPreset>
): PaperPreset | undefined {
  if (target === 'kartu_peserta' || target === 'nomor_meja') {
    const isLegacy6mm =
      !preset ||
      (preset.size === 'F4' &&
        preset.orientation === 'portrait' &&
        preset.marginTopMm === 6 &&
        preset.marginRightMm === 6 &&
        preset.marginBottomMm === 6 &&
        preset.marginLeftMm === 6);
    if (isLegacy6mm) {
      return {
        ...FALLBACK_PAPER_PRESET,
        ...(preset || {}),
        id: target,
        size: 'F4',
        orientation: 'portrait',
        marginTopMm: 15,
        marginRightMm: 15,
        marginBottomMm: 15,
        marginLeftMm: 15,
        cardsPerPage: preset?.cardsPerPage || 6,
      };
    }
    return preset as PaperPreset;
  }

  if (target === 'jadwal_ujian') {
    return {
      ...FALLBACK_PAPER_PRESET,
      ...(preset || {}),
      id: 'default',
      label: 'Jadwal Ujian (F4 Landscape)',
      size: 'F4',
      orientation: 'landscape',
      marginTopMm: 15,
      marginRightMm: 15,
      marginBottomMm: 15,
      marginLeftMm: 15,
      scalePercent: 100,
      showKop: preset?.showKop ?? true,
    };
  }

  return preset as PaperPreset | undefined;
}

/**
 * Generates CSS variables and preview sizing for `.saum-sheet`, `.print-page`, and `.schedule-print`.
 * On screen: shows exact paper size (`210 × 330 mm` F4 Portrait or `330 × 210 mm` F4 Landscape) with exact 4-side padding.
 * On `@media print`: `@page` provides physical printer margins (`15mm` default) and inner container fills exact printable area.
 */
export function getSheetScreenStyle(
  preset?: Partial<PaperPreset>,
  fallback?: { size?: PaperSize; orientation?: PaperOrientation; marginMm?: number }
): React.CSSProperties {
  const resolved = resolvePaperPreset(preset, fallback);
  const { widthMm, heightMm } = getPaperDimensionsMm(resolved.size, resolved.orientation);
  const printableWidthMm = Math.max(80, widthMm - resolved.marginLeftMm - resolved.marginRightMm);
  const printableHeightMm = Math.max(80, heightMm - resolved.marginTopMm - resolved.marginBottomMm);
  const scale = (resolved.scalePercent ?? 100) / 100;

  return {
    ['--saum-sheet-w' as string]: `${widthMm}mm`,
    ['--saum-sheet-h' as string]: `${heightMm}mm`,
    ['--saum-printable-w' as string]: `${printableWidthMm}mm`,
    ['--saum-printable-h' as string]: `${printableHeightMm}mm`,
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
 * Computes exact printable card height for 2-column grids (6 cards on F4 210x330mm with 15mm margins = 180x300mm).
 */
export function getCardGridMetrics(
  preset?: Partial<PaperPreset>,
  options?: { defaultSize?: PaperSize; defaultCardsPerPage?: 4 | 6; gapMm?: number; defaultMarginMm?: number }
): {
  resolved: PaperPreset;
  cardsPerPage: 4 | 6;
  rows: 2 | 3;
  gapMm: number;
  cardHeightMm: number;
  printableWidthMm: number;
  printableHeightMm: number;
} {
  const resolved = resolvePaperPreset(preset, {
    size: options?.defaultSize || 'F4',
    orientation: 'portrait',
    marginMm: options?.defaultMarginMm ?? 15,
  });
  const { widthMm, heightMm } = getPaperDimensionsMm(resolved.size, resolved.orientation);
  const printableWidthMm = Math.max(120, widthMm - resolved.marginLeftMm - resolved.marginRightMm);
  const printableHeightMm = Math.max(180, heightMm - resolved.marginTopMm - resolved.marginBottomMm);

  const cardsPerPage: 4 | 6 =
    resolved.cardsPerPage ||
    options?.defaultCardsPerPage ||
    (resolved.size === 'F4' ? 6 : 4);
  const rows: 2 | 3 = cardsPerPage === 6 ? 3 : 2;
  const gapMm = options?.gapMm ?? 3;
  const cardHeightMm = Math.floor(((printableHeightMm - gapMm * (rows - 1)) / rows) * 10) / 10;

  return {
    resolved,
    cardsPerPage,
    rows,
    gapMm,
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
    initialPreset?.showKop,
    fallback?.size,
    fallback?.orientation,
    fallback?.marginMm,
  ].join('|');

  useEffect(() => {
    setLayout(resolvePaperPreset(initialPreset, fallback));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncKey]);

  return { layout, setLayout };
}
