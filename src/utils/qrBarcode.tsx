import React from 'react';

/**
 * Clean Indonesian date and time formatters
 */
export function formatIndonesianDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
    ];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

export function formatDayAndDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    return `${days[date.getDay()]}, ${formatIndonesianDate(dateStr)}`;
  } catch {
    return dateStr;
  }
}

/**
 * Generate a standalone crisp SVG Barcode (Code 128 style visual)
 */
export function SimpleBarcode({ value, height = 36, width = 140 }: { value: string; height?: number; width?: number }) {
  // Generate pseudo-deterministic bar pattern from string characters
  const bars: boolean[] = [true, false, true]; // start guard
  for (let i = 0; i < value.length; i++) {
    const charCode = value.charCodeAt(i);
    const pattern = (charCode * 7 + i * 13) % 256;
    for (let b = 0; b < 6; b++) {
      bars.push((pattern & (1 << b)) !== 0);
    }
    bars.push(false); // spacer
  }
  bars.push(true, false, true, true); // stop guard

  const barWidth = width / bars.length;

  return (
    <div className="flex flex-col items-center">
      <svg width={width} height={height} className="overflow-visible">
        {bars.map((isBlack, idx) =>
          isBlack ? (
            <rect
              key={idx}
              x={idx * barWidth}
              y={0}
              width={barWidth * 0.9}
              height={height}
              fill="#000"
            />
          ) : null
        )}
      </svg>
      <span className="font-mono text-[9px] tracking-widest text-slate-800 font-bold mt-0.5">
        {value}
      </span>
    </div>
  );
}

/**
 * Generate a standalone crisp SVG QR Code pattern
 */
export function SimpleQRCode({ value, size = 64 }: { value: string; size?: number }) {
  // 17x17 grid minimal QR visual
  const gridSize = 17;
  const cellSize = size / gridSize;

  // Generate deterministic pattern based on hash of value
  const grid: boolean[][] = Array.from({ length: gridSize }, () => Array(gridSize).fill(false));

  // Finder patterns at (0,0), (0, 10), (10, 0) for 7x7
  const addFinder = (startRow: number, startCol: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (
          r === 0 || r === 6 || c === 0 || c === 6 ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4)
        ) {
          if (startRow + r < gridSize && startCol + c < gridSize) {
            grid[startRow + r][startCol + c] = true;
          }
        }
      }
    }
  };

  addFinder(0, 0);
  addFinder(0, 10);
  addFinder(10, 0);

  // Fill in timing patterns
  for (let i = 0; i < gridSize; i++) {
    grid[6][i] = i % 2 === 0;
    grid[i][6] = i % 2 === 0;
  }

  // Hash value into other cells
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      // Don't overwrite finders
      if (
        (r < 7 && c < 7) ||
        (r < 7 && c >= 10) ||
        (r >= 10 && c < 7) ||
        r === 6 || c === 6
      ) {
        continue;
      }
      const cellBit = Math.abs(hash * (r + 1) * 31 + c * 17) % 3 === 0;
      grid[r][c] = cellBit;
    }
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rounded bg-white p-0.5 border border-slate-200">
      {grid.map((row, r) =>
        row.map((cell, c) =>
          cell ? (
            <rect
              key={`${r}-${c}`}
              x={c * cellSize}
              y={r * cellSize}
              width={cellSize}
              height={cellSize}
              fill="#000"
            />
          ) : null
        )
      )}
    </svg>
  );
}
