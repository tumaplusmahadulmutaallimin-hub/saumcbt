import JSZip from 'jszip';

/**
 * Extract paragraphs verbatim from an uploaded DOCX, TXT, or PDF file
 * preserving original rules without altering wording.
 */
export async function extractTataTertibFromFile(file: File): Promise<{
  lines: string[];
  needsOcrReview: boolean;
  notice?: string;
}> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  if (ext === 'txt') {
    const text = await file.text();
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trimEnd())
      .filter((l) => l.trim().length > 0);
    return { lines, needsOcrReview: false };
  }

  if (ext === 'docx') {
    const buffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);
    const docXml = await zip.file('word/document.xml')?.async('string');
    if (!docXml) {
      throw new Error('File DOCX tidak memiliki konten word/document.xml yang valid.');
    }

    // Parse paragraphs <w:p> preserving exact text runs <w:t>
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(docXml, 'application/xml');
    const paragraphs = Array.from(xmlDoc.getElementsByTagName('w:p'));
    const lines: string[] = [];

    for (const p of paragraphs) {
      const texts = Array.from(p.getElementsByTagName('w:t')).map((t) => t.textContent || '');
      const joined = texts.join('').trim();
      if (joined.length > 0) {
        lines.push(joined);
      }
    }

    return {
      lines,
      needsOcrReview: lines.length === 0,
      notice:
        lines.length === 0
          ? 'Dokumen DOCX tidak mengandung teks (kemungkinan berisi gambar scan). Silakan periksa dan lengkapi teks secara manual.'
          : `Berhasil mengekstrak ${lines.length} baris aturan asli dari file DOCX tanpa mengubah substansi.`,
    };
  }

  if (ext === 'pdf') {
    // Extract readable text streams from PDF bytes without modifying original content
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const decoder = new TextDecoder('latin1');
    const raw = decoder.decode(bytes);

    // Extract text literals inside (...) in BT ... ET blocks
    const extractedSegments: string[] = [];
    const btMatches = raw.match(/BT[\s\S]*?ET/g) || [];
    for (const block of btMatches) {
      const parenMatches = block.match(/\(([^()\\]*(?:\\.[^()\\]*)*)\)/g) || [];
      for (const m of parenMatches) {
        const clean = m
          .slice(1, -1)
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '')
          .replace(/\\\(/g, '(')
          .replace(/\\\)/g, ')')
          .replace(/\\\\/g, '\\')
          .trim();
        if (clean.length > 1 && /[a-zA-Z0-9]/.test(clean)) {
          extractedSegments.push(clean);
        }
      }
    }

    const lines = extractedSegments
      .join(' ')
      .split(/\n|(?=\d+\.\s)/)
      .map((l) => l.trim())
      .filter((l) => l.length > 2);

    if (lines.length === 0) {
      return {
        lines: [],
        needsOcrReview: true,
        notice:
          'PDF terdeteksi sebagai hasil scan gambar atau font terenkripsi. Silakan periksa / ketik hasil OCR pada editor di bawah sebelum finalisasi agar tidak ada aturan yang hilang.',
      };
    }

    return {
      lines,
      needsOcrReview: true,
      notice: `Berhasil mengekstrak ${lines.length} segmen teks dari PDF. Mohon periksa kembali kecocokan teks asli sebelum finalisasi.`,
    };
  }

  throw new Error('Format file tidak didukung. Gunakan file PDF, DOCX, atau TXT.');
}
