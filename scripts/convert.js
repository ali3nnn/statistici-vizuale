#!/usr/bin/env node
/**
 * convert.js — Convert an Excel table to a preloaded dataset JSON file
 *
 * Usage:
 *   node scripts/convert.js <file.xlsx> [options]
 *
 * Options:
 *   --sheet      <name>     Sheet to read (default: first sheet)
 *   --county-col <index>    Column index (0-based) containing county names
 *   --value-col  <index>    Column index (0-based) containing the numeric values
 *   --header-row <index>    Row index (0-based) of header (skipped). Default: auto-detect
 *   --name       <text>     Dataset display name (shown as map title)
 *   --subtitle   <text>     Subtitle line (default: empty)
 *   --footer     <text>     Footer/source line (default: "Sursa: RPL 2021 — INS")
 *   --palette    <id>       Color palette: blue|green|red|orange|purple (default: blue)
 *   --high-is-bad           Flag: higher values = worse (reversed semantics)
 *   --out        <path>     Output JSON file (default: stdout)
 *   --percent               Treat values as percentages (round to 2 decimal places)
 *
 * Examples:
 *   # After running inspect.js you know the county column and value column:
 *   node scripts/convert.js scripts/downloads/Tabel-1_02.xlsx \
 *     --sheet "Tabel 1.02" --county-col 0 --value-col 3 \
 *     --name "Populația stabilă" \
 *     --subtitle "Număr de locuitori pe județe — RPL 2021" \
 *     --out src/preloadedDatasets/populatie-stabila.json
 */

import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { normalizeCountyName, COUNTY_NAMES } from './utils/counties.js';

// ── Palettes ─────────────────────────────────────────────────────────────────

const PALETTES = {
  blue:   { name: 'Blue',   hue: 220, id: 'blue' },
  green:  { name: 'Green',  hue: 130, id: 'green' },
  red:    { name: 'Red',    hue: 0,   id: 'red' },
  orange: { name: 'Orange', hue: 30,  id: 'orange' },
  purple: { name: 'Purple', hue: 270, id: 'purple' },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function cellValue(sheet, col, row) {
  const addr = XLSX.utils.encode_cell({ c: col, r: row });
  const cell = sheet[addr];
  return cell ? cell.v : undefined;
}

function sheetDimensions(sheet) {
  const ref = sheet['!ref'];
  if (!ref) return null;
  const range = XLSX.utils.decode_range(ref);
  return { minRow: range.s.r, maxRow: range.e.r, minCol: range.s.c, maxCol: range.e.c };
}

/**
 * Auto-detect the first row that contains at least one recognizable county name.
 * Returns the 0-based row index, or null.
 */
function autoDetectCountyColumn(sheet, dims) {
  const { minRow, maxRow, minCol, maxCol } = dims;
  for (let c = minCol; c <= maxCol; c++) {
    let hits = 0;
    for (let r = minRow; r <= Math.min(maxRow, minRow + 80); r++) {
      const v = cellValue(sheet, c, r);
      if (v && normalizeCountyName(String(v))) hits++;
    }
    if (hits >= 10) return c;
  }
  return null;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = {
    file: null, sheet: null, countyCol: null, valueCol: null,
    headerRow: null, name: null, subtitle: '', footer: 'Sursa: RPL 2021 — INS',
    palette: 'blue', highIsBad: false, out: null, percent: false,
  };
  let i = 0;
  while (i < args.length) {
    const a = args[i];
    switch (a) {
      case '--sheet':      opts.sheet = args[++i]; break;
      case '--county-col': opts.countyCol = parseInt(args[++i], 10); break;
      case '--value-col':  opts.valueCol = parseInt(args[++i], 10); break;
      case '--header-row': opts.headerRow = parseInt(args[++i], 10); break;
      case '--name':       opts.name = args[++i]; break;
      case '--subtitle':   opts.subtitle = args[++i]; break;
      case '--footer':     opts.footer = args[++i]; break;
      case '--palette':    opts.palette = args[++i]; break;
      case '--high-is-bad': opts.highIsBad = true; break;
      case '--out':        opts.out = args[++i]; break;
      case '--percent':    opts.percent = true; break;
      default:
        if (!a.startsWith('--')) opts.file = a;
    }
    i++;
  }
  return opts;
}

function buildDataset(opts, data) {
  const values = Object.values(data).filter(v => typeof v === 'number');
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const palette = PALETTES[opts.palette] ?? PALETTES.blue;

  return {
    name: opts.name ?? 'Dataset',
    config: {
      data,
      minValue,
      maxValue,
      highIsBad: opts.highIsBad,
      activePalette: palette,
      paletteReversed: false,
      normalizationMode: 'linear',
      text: {
        title:    { innerHTML: opts.name ?? '',     textAlign: '', top: '' },
        subtitle: { innerHTML: opts.subtitle,        textAlign: '', top: '' },
        footer:   { innerHTML: opts.footer,          textAlign: '', top: '' },
      },
      display: {
        '4x5': { showCode: true, showValue: true, labelSize: '11' },
        '9x16': { showCode: true, showValue: true, labelSize: '9' },
      },
      legendOrientation: { '4x5': 'vertical', '9x16': 'vertical' },
    },
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const opts = parseArgs(process.argv);

  if (!opts.file) {
    console.error([
      'Usage: node scripts/convert.js <file.xlsx> [options]',
      '',
      'Run node scripts/inspect.js <file.xlsx> first to discover column indices.',
      '',
      'Options:',
      '  --sheet <name>       Sheet name (default: first sheet)',
      '  --county-col <n>     Column index (0-based) with county names',
      '  --value-col  <n>     Column index (0-based) with values',
      '  --header-row <n>     Row index (0-based) of header row (will be skipped)',
      '  --name <text>        Dataset display name',
      '  --subtitle <text>    Subtitle line',
      '  --footer <text>      Footer/source line',
      '  --palette <id>       blue|green|red|orange|purple',
      '  --high-is-bad        Invert palette semantics',
      '  --out <path>         Output JSON file (default: stdout)',
      '  --percent            Round values to 2 decimal places',
    ].join('\n'));
    process.exit(1);
  }

  const absPath = path.resolve(opts.file);
  const buf = readFileSync(absPath);
  const wb = XLSX.read(buf, { type: 'buffer' });

  const sheetName = opts.sheet ?? wb.SheetNames[0];
  if (!wb.Sheets[sheetName]) {
    console.error(`Sheet "${sheetName}" not found. Available: ${wb.SheetNames.join(', ')}`);
    process.exit(1);
  }

  const sheet = wb.Sheets[sheetName];
  const dims = sheetDimensions(sheet);
  if (!dims) { console.error('Sheet appears to be empty.'); process.exit(1); }

  // Resolve county column
  const countyCol = opts.countyCol ?? autoDetectCountyColumn(sheet, dims);
  if (countyCol === null) {
    console.error('Could not auto-detect a county column. Use --county-col <index>.');
    process.exit(1);
  }

  // Value column is required
  if (opts.valueCol === null) {
    console.error('--value-col is required. Run inspect.js first to find the right column index.');
    process.exit(1);
  }

  // Scan rows for county → value pairs
  const data = {};
  let headerSkipped = false;

  for (let r = dims.minRow; r <= dims.maxRow; r++) {
    const rawCounty = cellValue(sheet, countyCol, r);
    const rawValue  = cellValue(sheet, opts.valueCol, r);

    if (!rawCounty) continue;

    const canonical = normalizeCountyName(String(rawCounty));
    if (!canonical) continue; // not a county row

    // Skip the first matched row if it looks like a header (string in value col)
    if (!headerSkipped && typeof rawValue === 'string' && isNaN(parseFloat(rawValue))) {
      headerSkipped = true;
      continue;
    }

    let value = typeof rawValue === 'number'
      ? rawValue
      : parseFloat(String(rawValue ?? '').replace(/\s/g, '').replace(',', '.'));

    if (isNaN(value)) {
      process.stderr.write(`[convert] Skipping "${canonical}": value "${rawValue}" is not a number\n`);
      continue;
    }

    if (opts.percent) value = Math.round(value * 100) / 100;

    data[canonical] = value;
  }

  // Warn about missing counties
  const found = new Set(Object.keys(data));
  const missing = COUNTY_NAMES.filter(c => !found.has(c));
  if (missing.length > 0) {
    process.stderr.write(`[convert] Warning: ${missing.length} counties missing from output: ${missing.join(', ')}\n`);
  }

  if (Object.keys(data).length === 0) {
    console.error('No county data extracted. Double-check --county-col and --value-col.');
    process.exit(1);
  }

  const dataset = buildDataset(opts, data);
  const json = JSON.stringify(dataset, null, 2);

  if (opts.out) {
    const outPath = path.resolve(opts.out);
    writeFileSync(outPath, json);
    console.log(`Written ${Object.keys(data).length} counties → ${outPath}`);
  } else {
    console.log(json);
  }
}

main();
