/**
 * Indonesian Person Name & Academic Title Formatter (EYD / PUEBI compliant)
 * Ensures academic degrees (S.Pd., S.Pd.I., S.H., M.Pd., Dr., H., Hj., Prof., etc.)
 * are NEVER rendered in ALL CAPS and follow standard Indonesian degree casing.
 */

const EXACT_PREFIX_MAP: Record<string, string> = {
  prof: 'Prof.',
  dr: 'Dr.',
  drs: 'Drs.',
  dra: 'Dra.',
  ir: 'Ir.',
  h: 'H.',
  hj: 'Hj.',
  kh: 'K.H.',
  'k.h': 'K.H.',
  ust: 'Ust.',
  ustadz: 'Ustadz',
  ustadzah: 'Ustadzah',
  tgk: 'Tgk.',
  ns: 'Ns.',
  apt: 'Apt.',
};

const KNOWN_DEGREE_MAP: Record<string, string> = {
  's.h': 'S.H.',
  's.h.i': 'S.H.I.',
  'm.h': 'M.H.',
  'm.h.i': 'M.H.I.',
  's.pd': 'S.Pd.',
  's.pd.i': 'S.Pd.I.',
  's.pd.sd': 'S.Pd.SD.',
  's.pd.aud': 'S.Pd.AUD.',
  's.pd.bio': 'S.Pd.Bio.',
  's.pd.kim': 'S.Pd.Kim.',
  's.pd.fis': 'S.Pd.Fis.',
  's.pd.mat': 'S.Pd.Mat.',
  'm.pd': 'M.Pd.',
  'm.pd.i': 'M.Pd.I.',
  's.ag': 'S.Ag.',
  'm.ag': 'M.Ag.',
  's.kom': 'S.Kom.',
  'm.kom': 'M.Kom.',
  's.e': 'S.E.',
  'm.e': 'M.E.',
  's.e.i': 'S.E.I.',
  's.e.sy': 'S.E.Sy.',
  'm.e.sy': 'M.E.Sy.',
  's.si': 'S.Si.',
  'm.si': 'M.Si.',
  's.sos': 'S.Sos.',
  'm.sos': 'M.Sos.',
  's.sos.i': 'S.Sos.I.',
  's.i.p': 'S.I.P.',
  's.ip': 'S.IP.',
  'm.ip': 'M.IP.',
  's.i.kom': 'S.I.Kom.',
  'm.i.kom': 'M.I.Kom.',
  's.th.i': 'S.Th.I.',
  'm.th.i': 'M.Th.I.',
  's.fil.i': 'S.Fil.I.',
  's.hum': 'S.Hum.',
  'm.hum': 'M.Hum.',
  's.s': 'S.S.',
  's.psi': 'S.Psi.',
  'm.psi': 'M.Psi.',
  's.t': 'S.T.',
  'm.t': 'M.T.',
  's.tr.t': 'S.Tr.T.',
  'm.tr.t': 'M.Tr.T.',
  's.tr.kom': 'S.Tr.Kom.',
  's.ak': 'S.Ak.',
  'm.ak': 'M.Ak.',
  's.k.m': 'S.K.M.',
  'm.k.m': 'M.K.M.',
  's.kep': 'S.Kep.',
  's.ked': 'S.Ked.',
  's.farm': 'S.Farm.',
  's.pt': 'S.Pt.',
  's.p': 'S.P.',
  'm.p': 'M.P.',
  's.hut': 'S.Hut.',
  'm.m': 'M.M.',
  'm.ba': 'M.B.A.',
  'm.b.a': 'M.B.A.',
  'm.a': 'M.A.',
  'm.sc': 'M.Sc.',
  'b.a': 'B.A.',
  'b.sc': 'B.Sc.',
  'a.md': 'A.Md.',
  'a.ma': 'A.Ma.',
  'a.ma.pd': 'A.Ma.Pd.',
  'ph.d': 'Ph.D.',
  'lc': 'Lc.',
  'gr': 'Gr.',
  'dr': 'dr.',
  'drs': 'Drs.',
  'dra': 'Dra.',
  'st': 'S.T.',
  'sh': 'S.H.',
  'se': 'S.E.',
  'mm': 'M.M.',
  'mh': 'M.H.',
  'sp': 'S.P.',
  'ss': 'S.S.',
  'mp': 'M.P.',
  'mt': 'M.T.',
};

const LOWERCASE_PARTICLES = new Set(['bin', 'binti', 'al', 'el', 'van', 'von', 'de', 'da', 'di']);

function toTitleWord(word: string): string {
  if (!word) return '';
  // Preserve apostrophe/hyphenated names like Ma'ruf or Al-Faruq
  if (word.includes('-')) {
    return word
      .split('-')
      .map((part) => toTitleWord(part))
      .join('-');
  }
  const lower = word.toLowerCase();
  if (LOWERCASE_PARTICLES.has(lower)) return lower;
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function formatDottedDegreeToken(rawToken: string): string {
  const cleaned = rawToken.trim().replace(/,+$/, '');
  const withoutTrailingDot = cleaned.replace(/\.+$/, '');
  const key = withoutTrailingDot.toLowerCase();

  if (KNOWN_DEGREE_MAP[key]) {
    return KNOWN_DEGREE_MAP[key];
  }

  // Generic parser for dotted Indonesian degrees such as S.Pd.I or M.Pd.B.Ing
  if (withoutTrailingDot.includes('.')) {
    const parts = withoutTrailingDot.split('.').filter(Boolean);
    const formattedParts = parts.map((p) => {
      const lp = p.toLowerCase();
      if (lp === 'i' || lp === 'ii' || lp === 'iii' || lp === 'sd' || lp === 'tk' || lp === 'aud' || lp === 'paud') {
        return lp.toUpperCase();
      }
      if (lp.length === 1) {
        return lp.toUpperCase();
      }
      return lp.charAt(0).toUpperCase() + lp.slice(1);
    });
    return `${formattedParts.join('.')}.`;
  }

  return toTitleWord(cleaned);
}

/**
 * Formats a person's full name along with front/back academic & religious titles
 * according to Indonesian EYD/PUEBI rules. Never returns ALL CAPS titles.
 */
export function formatPersonNameAndTitle(rawName?: string): string {
  if (!rawName) return '';
  const trimmed = rawName.trim();
  if (!trimmed || /^[.\-_]+$/.test(trimmed)) return trimmed;

  // Split around commas first: everything before first comma is [front titles + core name],
  // everything after commas are suffix degrees.
  const commaParts = trimmed.split(',').map((s) => s.trim()).filter(Boolean);
  if (commaParts.length === 0) return trimmed;

  const mainSegment = commaParts[0];
  const suffixSegments = commaParts.slice(1);

  const mainTokens = mainSegment.split(/\s+/).filter(Boolean);
  const formattedMainTokens = mainTokens.map((tok, idx) => {
    const bare = tok.replace(/\.+$/, '').toLowerCase();
    // Prefix title detection at start (or consecutive prefixes like Prof. Dr. H.)
    if (idx < mainTokens.length - 1 && (tok.includes('.') || bare in EXACT_PREFIX_MAP)) {
      if (EXACT_PREFIX_MAP[bare]) {
        return EXACT_PREFIX_MAP[bare];
      }
      if (KNOWN_DEGREE_MAP[bare]) {
        return KNOWN_DEGREE_MAP[bare];
      }
    }
    // Check if trailing token in main segment without comma is actually a dotted degree (e.g. "Arif Syaifudin S.H.")
    if (idx > 0 && tok.includes('.')) {
      return formatDottedDegreeToken(tok);
    }
    return toTitleWord(tok);
  });

  if (suffixSegments.length === 0) {
    return formattedMainTokens.join(' ');
  }

  const formattedSuffixes = suffixSegments.map((seg) => {
    // Handle multiple degrees separated by spaces in one comma section e.g. "S.Pd. M.Pd."
    return seg
      .split(/\s+/)
      .filter(Boolean)
      .map((tok) => formatDottedDegreeToken(tok))
      .join(' ');
  });

  return `${formattedMainTokens.join(' ')}, ${formattedSuffixes.join(', ')}`;
}
