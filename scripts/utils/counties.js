/**
 * Romanian county (județ) name normalization utilities.
 *
 * The census Excel files use diacritics (e.g. "Bistrița-Năsăud") while the
 * app's JSON datasets use simplified ASCII names (e.g. "Bistrita-Nasaud").
 * This module maps both forms and handles common variations found in Excel
 * header rows.
 */

/** Canonical county names as used in the app's preloaded datasets */
export const COUNTY_NAMES = [
  'Alba', 'Arad', 'Arges', 'Bacau', 'Bihor', 'Bistrita-Nasaud',
  'Botosani', 'Brasov', 'Braila', 'Bucuresti', 'Buzau', 'Calarasi',
  'Caras-Severin', 'Cluj', 'Constanta', 'Covasna', 'Dambovita', 'Dolj',
  'Galati', 'Giurgiu', 'Gorj', 'Harghita', 'Hunedoara', 'Ialomita',
  'Iasi', 'Ilfov', 'Maramures', 'Mehedinti', 'Mures', 'Neamt',
  'Olt', 'Prahova', 'Salaj', 'Satu Mare', 'Sibiu', 'Suceava',
  'Teleorman', 'Timis', 'Tulcea', 'Valcea', 'Vaslui', 'Vrancea',
];

/**
 * Maps every known spelling (with/without diacritics, abbreviations, all-caps,
 * prefecture form "Județul X", etc.) to the canonical app name.
 */
export const COUNTY_ALIAS_MAP = {
  // ── With diacritics ────────────────────────────────────────────────────
  'Alba': 'Alba',
  'Arad': 'Arad',
  'Argeș': 'Arges',
  'Bacău': 'Bacau',
  'Bihor': 'Bihor',
  'Bistrița-Năsăud': 'Bistrita-Nasaud',
  'Botoșani': 'Botosani',
  'Brașov': 'Brasov',
  'Brăila': 'Braila',
  'București': 'Bucuresti',
  'Buzău': 'Buzau',
  'Călărași': 'Calarasi',
  'Caraș-Severin': 'Caras-Severin',
  'Cluj': 'Cluj',
  'Constanța': 'Constanta',
  'Covasna': 'Covasna',
  'Dâmbovița': 'Dambovita',
  'Dolj': 'Dolj',
  'Galați': 'Galati',
  'Giurgiu': 'Giurgiu',
  'Gorj': 'Gorj',
  'Harghita': 'Harghita',
  'Hunedoara': 'Hunedoara',
  'Ialomița': 'Ialomita',
  'Iași': 'Iasi',
  'Ilfov': 'Ilfov',
  'Maramureș': 'Maramures',
  'Mehedinți': 'Mehedinti',
  'Mureș': 'Mures',
  'Neamț': 'Neamt',
  'Olt': 'Olt',
  'Prahova': 'Prahova',
  'Sălaj': 'Salaj',
  'Satu Mare': 'Satu Mare',
  'Sibiu': 'Sibiu',
  'Suceava': 'Suceava',
  'Teleorman': 'Teleorman',
  'Timiș': 'Timis',
  'Tulcea': 'Tulcea',
  'Vâlcea': 'Valcea',
  'Vaslui': 'Vaslui',
  'Vrancea': 'Vrancea',

  // ── Without diacritics (already canonical) ────────────────────────────
  'Arges': 'Arges',
  'Bacau': 'Bacau',
  'Bistrita-Nasaud': 'Bistrita-Nasaud',
  'Botosani': 'Botosani',
  'Brasov': 'Brasov',
  'Braila': 'Braila',
  'Bucuresti': 'Bucuresti',
  'Buzau': 'Buzau',
  'Calarasi': 'Calarasi',
  'Caras-Severin': 'Caras-Severin',
  'Constanta': 'Constanta',
  'Dambovita': 'Dambovita',
  'Galati': 'Galati',
  'Ialomita': 'Ialomita',
  'Iasi': 'Iasi',
  'Maramures': 'Maramures',
  'Mehedinti': 'Mehedinti',
  'Mures': 'Mures',
  'Neamt': 'Neamt',
  'Salaj': 'Salaj',
  'Timis': 'Timis',
  'Valcea': 'Valcea',

  // ── Alternate spellings / common OCR mistakes ─────────────────────────
  'Bistrița Năsăud': 'Bistrita-Nasaud',
  'Bistrita Nasaud': 'Bistrita-Nasaud',
  'Caraș Severin': 'Caras-Severin',
  'Caras Severin': 'Caras-Severin',
  'Dîmbovița': 'Dambovita',
  'Dimbovita': 'Dambovita',
  'Vîlcea': 'Valcea',
  'Vilcea': 'Valcea',
  'Municipiul București': 'Bucuresti',
  'Mun. București': 'Bucuresti',
  'Mun. Bucuresti': 'Bucuresti',

  // ── "Județul X" prefix form ───────────────────────────────────────────
  'Județul Alba': 'Alba',
  'Județul Arad': 'Arad',
  'Județul Argeș': 'Arges',
  'Județul Bacău': 'Bacau',
  'Județul Bihor': 'Bihor',
  'Județul Bistrița-Năsăud': 'Bistrita-Nasaud',
  'Județul Botoșani': 'Botosani',
  'Județul Brașov': 'Brasov',
  'Județul Brăila': 'Braila',
  'Județul Buzău': 'Buzau',
  'Județul Călărași': 'Calarasi',
  'Județul Caraș-Severin': 'Caras-Severin',
  'Județul Cluj': 'Cluj',
  'Județul Constanța': 'Constanta',
  'Județul Covasna': 'Covasna',
  'Județul Dâmbovița': 'Dambovita',
  'Județul Dolj': 'Dolj',
  'Județul Galați': 'Galati',
  'Județul Giurgiu': 'Giurgiu',
  'Județul Gorj': 'Gorj',
  'Județul Harghita': 'Harghita',
  'Județul Hunedoara': 'Hunedoara',
  'Județul Ialomița': 'Ialomita',
  'Județul Iași': 'Iasi',
  'Județul Ilfov': 'Ilfov',
  'Județul Maramureș': 'Maramures',
  'Județul Mehedinți': 'Mehedinti',
  'Județul Mureș': 'Mures',
  'Județul Neamț': 'Neamt',
  'Județul Olt': 'Olt',
  'Județul Prahova': 'Prahova',
  'Județul Sălaj': 'Salaj',
  'Județul Satu Mare': 'Satu Mare',
  'Județul Sibiu': 'Sibiu',
  'Județul Suceava': 'Suceava',
  'Județul Teleorman': 'Teleorman',
  'Județul Timiș': 'Timis',
  'Județul Tulcea': 'Tulcea',
  'Județul Vâlcea': 'Valcea',
  'Județul Vaslui': 'Vaslui',
  'Județul Vrancea': 'Vrancea',
};

/**
 * Strip Romanian diacritics from a string.
 * Handles both the "comma below" (ș/ț) and "cedilla" (ş/ţ) variants.
 */
export function stripDiacritics(str) {
  return str
    .replace(/[ăÃ]/g, 'a')
    .replace(/[âÂ]/g, 'a')
    .replace(/[îÎ]/g, 'i')
    .replace(/[șşŞȘ]/g, 's')
    .replace(/[țţŢȚ]/g, 't')
    // Generic Unicode normalisation fallback
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Normalize a cell value from an Excel file to a canonical county name.
 * Returns null if the value cannot be matched.
 *
 * @param {string} raw - Raw string from the Excel cell
 * @returns {string|null}
 */
export function normalizeCountyName(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();

  // Direct lookup (handles diacritics + "Județul X" prefix)
  if (COUNTY_ALIAS_MAP[trimmed]) return COUNTY_ALIAS_MAP[trimmed];

  // Strip diacritics and try again
  const stripped = stripDiacritics(trimmed);
  if (COUNTY_ALIAS_MAP[stripped]) return COUNTY_ALIAS_MAP[stripped];

  // Try stripping "Judetul " prefix after diacritic removal
  const withoutPrefix = stripped.replace(/^Judetul\s+/i, '').trim();
  if (COUNTY_ALIAS_MAP[withoutPrefix]) return COUNTY_ALIAS_MAP[withoutPrefix];

  // Case-insensitive fuzzy match against canonical names
  const lower = withoutPrefix.toLowerCase();
  const match = COUNTY_NAMES.find(c => c.toLowerCase() === lower);
  if (match) return match;

  return null;
}

/**
 * Given a record object with raw county names as keys, re-key it using
 * canonical names. Rows that cannot be matched are skipped (logged to stderr).
 *
 * @param {Record<string, unknown>} record
 * @returns {Record<string, unknown>}
 */
export function remapCountyKeys(record) {
  const out = {};
  for (const [raw, value] of Object.entries(record)) {
    const canonical = normalizeCountyName(raw);
    if (canonical) {
      out[canonical] = value;
    } else {
      process.stderr.write(`[counties] Could not map county name: "${raw}"\n`);
    }
  }
  return out;
}
