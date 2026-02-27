#!/usr/bin/env node
/**
 * parse-uat-population.js — Parse INS table 1.22 and output per-county
 * population split between UATs with more than N residents and the rest.
 *
 * Usage:
 *   node scripts/parse-uat-population.js <file.xls[x]> [options]
 *
 * Options:
 *   --sheet <name>     Sheet name to read (default: first sheet)
 *   --threshold <n>    Population threshold (default: 10000)
 *   --out <path>       Output JSON file (default: stdout)
 *
 * Output JSON shape:
 *   {
 *     "Alba": {
 *       "total": 325941,
 *       "bigUAT": 120163,   // population in UATs with > threshold residents
 *       "rest": 205778,     // population in UATs with <= threshold residents
 *       "bigUATCount": 3,
 *       "restUATCount": 65
 *     },
 *     ...
 *   }
 *
 * Actual row structure in the INS file (verified):
 * ─────────────────────────────────────────────────────────────────────────────
 *  col A     │ col B  │ col C
 *  ──────────┼────────┼──────────────────────────────────────────────────────
 *  (empty)   │ (empty)│ ALBA                    ← county total row
 *  ALBA      │ 1017   │ MUNICIPIUL ALBA IULIA   ← UAT row (no leading space)
 *  ALBA      │ 1026   │   ALBA IULIA            ← locality row (leading space)
 *  ALBA      │ 1035   │   BĂRĂBANȚ              ← locality row (leading space)
 *  ...
 *  ALBA      │ 1213   │ MUNICIPIUL AIUD         ← next UAT row
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Rules:
 *   county row  — col A is empty/blank AND col C matches a county name
 *   UAT row     — col A has county name, col C starts with UAT type prefix,
 *                 no leading whitespace
 *   locality    — col A has county name, col C has leading whitespace → skip
 */

import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { normalizeCountyName } from './utils/counties.js';

// ── UAT type prefixes (Romanian administrative unit types) ────────────────────

const UAT_PREFIXES = [
  'MUNICIPIUL ',
  'ORASUL ',
  'ORAȘUL ',
  'ORAS ',
  'ORAȘ ',
  'COMUNA ',
  'COMUNĂ ',
  'SECTORUL ',
  'SECTOR ',
];

function isUATName(name) {
  const upper = name.toUpperCase();
  return UAT_PREFIXES.some(p => upper.startsWith(p.toUpperCase()));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function cellStr(sheet, col, row) {
  const cell = sheet[XLSX.utils.encode_cell({ c: col, r: row })];
  if (!cell) return '';
  return String(cell.v ?? '');
}

function cellNum(sheet, col, row) {
  const cell = sheet[XLSX.utils.encode_cell({ c: col, r: row })];
  if (!cell) return 0;
  if (typeof cell.v === 'number') return Math.round(cell.v);
  const n = parseInt(String(cell.v).replace(/[\s,]/g, ''), 10);
  return isNaN(n) ? 0 : n;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = { file: null, sheet: null, threshold: 10000, out: null, debug: false };
  let i = 0;
  while (i < args.length) {
    switch (args[i]) {
      case '--sheet':     opts.sheet     = args[++i]; break;
      case '--threshold': opts.threshold = parseInt(args[++i], 10); break;
      case '--out':       opts.out       = args[++i]; break;
      case '--debug':     opts.debug     = true; break;
      default:
        if (!args[i].startsWith('--')) opts.file = args[i];
    }
    i++;
  }
  return opts;
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const opts = parseArgs(process.argv);

  if (!opts.file) {
    console.error([
      'Usage: node scripts/parse-uat-population.js <file.xls[x]> [options]',
      '',
      'Options:',
      '  --sheet <name>     Sheet name (default: first sheet)',
      '  --threshold <n>    UAT population threshold (default: 10000)',
      '  --out <path>       Output JSON file (default: stdout)',
    ].join('\n'));
    process.exit(1);
  }

  const buf = readFileSync(path.resolve(opts.file));
  const wb = XLSX.read(buf, { type: 'buffer' });

  const sheetName = opts.sheet ?? wb.SheetNames[0];
  if (!wb.Sheets[sheetName]) {
    console.error(`Sheet "${sheetName}" not found. Available: ${wb.SheetNames.join(', ')}`);
    process.exit(1);
  }

  const sheet = wb.Sheets[sheetName];
  const range = XLSX.utils.decode_range(sheet['!ref']);
  const minRow = range.s.r;
  const maxRow = range.e.r;

  // Column indices (0-based, fixed layout for table 1.22):
  //   A=0  B=1  C=2  D=3(total)  E=4(male)  F=5(female)
  const COL_A   = 0;  // county name (present on UAT/locality rows)
  const COL_C   = 2;  // county name on county-total rows; UAT/locality name otherwise
  const COL_POP = 3;  // total population

  const result = {};  // canonical county name → aggregates + UAT lists

  let currentCounty = null;  // canonical name of the county we're inside

  for (let r = minRow; r <= maxRow; r++) {
    const colA = cellStr(sheet, COL_A, r).trim();
    const colC = cellStr(sheet, COL_C, r);   // keep raw to detect leading spaces
    const colCTrimmed = colC.trim();

    // ── County total row: col A is empty, col C is the county name ────────
    // București is a special case: col C reads "MUNICIPIUL BUCUREȘTI" instead
    // of just "BUCUREȘTI", so try stripping the "MUNICIPIUL " prefix as well.
    if (!colA && colCTrimmed) {
      const stripped = colCTrimmed.replace(/^MUNICIPIUL\s+/i, '').trim();
      const county = normalizeCountyName(colCTrimmed) ?? normalizeCountyName(stripped);
      if (county) {
        const pop = cellNum(sheet, COL_POP, r);
        currentCounty = county;
        result[county] = {
          total:        pop,
          bigUAT:       0,
          rest:         0,
          bigUATCount:  0,
          restUATCount: 0,
        };
      }
      continue;
    }

    // ── Locality row: col C has leading whitespace → skip ─────────────────
    if (colC && colC !== colCTrimmed) continue;

    // ── UAT row: col A has county name, col C has no leading whitespace ───
    // Municipalities/cities have a type prefix ("MUNICIPIUL X", "ORAS X"),
    // but communes appear with just their plain name and no prefix.
    // Both are UAT-level rows; locality rows are already skipped above.
    if (colA && colCTrimmed && currentCounty) {
      const pop = cellNum(sheet, COL_POP, r);
      if (pop <= 0) continue;

      if (opts.debug) {
        process.stderr.write(`[debug] r${r} ${currentCounty} | "${colCTrimmed}" | pop=${pop} | raw="${cellStr(sheet, COL_POP, r)}"\n`);
      }

      if (pop > opts.threshold) {
        result[currentCounty].bigUAT += pop;
        result[currentCounty].bigUATCount++;
      } else {
        result[currentCounty].restUATCount++;
      }
    }
  }

  // Compute rest and percentages
  for (const v of Object.values(result)) {
    v.rest = v.total - v.bigUAT;
    v.bigUATPct = v.total > 0 ? Math.round(v.bigUAT / v.total * 1000) / 10 : 0;
    v.restPct   = v.total > 0 ? Math.round(v.rest  / v.total * 1000) / 10 : 0;
  }

  // Warn about counties with no UAT rows detected
  for (const [county, v] of Object.entries(result)) {
    if (v.bigUATCount + v.restUATCount === 0) {
      process.stderr.write(`[warn] ${county}: no UAT rows detected\n`);
    }
  }

  if (Object.keys(result).length === 0) {
    console.error('No data extracted. Run inspect.js to verify column layout.');
    process.exit(1);
  }

  // Sort alphabetically
  const sorted = Object.fromEntries(
    Object.entries(result).sort(([a], [b]) => a.localeCompare(b))
  );

  const json = JSON.stringify(sorted, null, 2);

  if (opts.out) {
    writeFileSync(path.resolve(opts.out), json);
    process.stderr.write(`Written ${Object.keys(sorted).length} counties → ${opts.out}\n`);
  } else {
    console.log(json);
  }
}

main();
