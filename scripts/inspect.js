#!/usr/bin/env node
/**
 * inspect.js — Inspect a downloaded Excel file to understand its structure
 *
 * Usage:
 *   node scripts/inspect.js scripts/downloads/Tabel-1_02.xlsx
 *   node scripts/inspect.js scripts/downloads/Tabel-1_02.xlsx --sheet "Tabel 1.02"
 *   node scripts/inspect.js scripts/downloads/Tabel-1_02.xlsx --rows 20
 *
 * Output:
 *   - List of all sheets
 *   - First N rows of the selected sheet as a table
 *   - Detection of which rows/columns likely contain county names
 */

import { readFileSync } from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { normalizeCountyName } from './utils/counties.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function cellValue(sheet, col, row) {
  const addr = XLSX.utils.encode_cell({ c: col, r: row });
  const cell = sheet[addr];
  return cell ? cell.v : undefined;
}

function sheetDimensions(sheet) {
  const ref = sheet['!ref'];
  if (!ref) return { minRow: 0, maxRow: 0, minCol: 0, maxCol: 0 };
  const range = XLSX.utils.decode_range(ref);
  return {
    minRow: range.s.r,
    maxRow: range.e.r,
    minCol: range.s.c,
    maxCol: range.e.c,
  };
}

/**
 * Scan a sheet to find the first column that contains recognizable county names.
 * Returns { colIndex, matchedRows } or null.
 */
function detectCountyColumn(sheet, dims, maxRows = 80) {
  const { minRow, maxRow, minCol, maxCol } = dims;
  const scanRows = Math.min(maxRow, minRow + maxRows);

  let bestCol = null;
  let bestCount = 0;
  let bestRows = [];

  for (let c = minCol; c <= maxCol; c++) {
    let count = 0;
    const rows = [];
    for (let r = minRow; r <= scanRows; r++) {
      const val = cellValue(sheet, c, r);
      if (val && typeof val === 'string') {
        const norm = normalizeCountyName(val);
        if (norm) { count++; rows.push({ row: r, raw: val, canonical: norm }); }
      }
    }
    if (count > bestCount) { bestCount = count; bestCol = c; bestRows = rows; }
  }

  return bestCount > 0 ? { colIndex: bestCol, matchedRows: bestRows, matchCount: bestCount } : null;
}

function printTable(rows, truncate = 60) {
  if (!rows.length) return;
  const cols = rows[0].length;
  const widths = Array.from({ length: cols }, (_, c) =>
    Math.min(truncate, Math.max(...rows.map(r => String(r[c] ?? '').length)))
  );
  const separator = widths.map(w => '─'.repeat(w + 2)).join('┼');
  const fmt = row => row.map((v, c) => String(v ?? '').substring(0, widths[c]).padEnd(widths[c])).join(' │ ');

  console.log('┌' + separator.replace(/┼/g, '┬') + '┐');
  console.log('│ ' + fmt(rows[0]) + ' │');
  console.log('├' + separator + '┤');
  for (const row of rows.slice(1)) console.log('│ ' + fmt(row) + ' │');
  console.log('└' + separator.replace(/┼/g, '┴') + '┘');
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = { file: null, sheet: null, rows: 15, cols: 8 };
  let i = 0;
  while (i < args.length) {
    const a = args[i];
    if (a === '--sheet') { opts.sheet = args[++i]; }
    else if (a === '--rows') { opts.rows = parseInt(args[++i], 10); }
    else if (a === '--cols') { opts.cols = parseInt(args[++i], 10); }
    else if (!a.startsWith('--')) { opts.file = a; }
    i++;
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv);
  if (!opts.file) {
    console.error('Usage: node scripts/inspect.js <file.xlsx> [--sheet NAME] [--rows N] [--cols N]');
    process.exit(1);
  }

  const absPath = path.resolve(opts.file);
  console.log(`\nFile: ${absPath}\n`);

  const buf = readFileSync(absPath);
  const wb = XLSX.read(buf, { type: 'buffer' });

  // ── List sheets ──────────────────────────────────────────────────────────
  console.log(`Sheets (${wb.SheetNames.length}):`);
  wb.SheetNames.forEach((name, i) => console.log(`  [${i}] ${name}`));
  console.log();

  // ── Select sheet ────────────────────────────────────────────────────────
  const sheetName = opts.sheet ?? wb.SheetNames[0];
  if (!wb.Sheets[sheetName]) {
    console.error(`Sheet "${sheetName}" not found. Available: ${wb.SheetNames.join(', ')}`);
    process.exit(1);
  }
  const sheet = wb.Sheets[sheetName];
  const dims = sheetDimensions(sheet);
  console.log(`Sheet: "${sheetName}"  (rows ${dims.minRow}–${dims.maxRow}, cols ${dims.minCol}–${dims.maxCol})\n`);

  // ── County column detection ──────────────────────────────────────────────
  const detection = detectCountyColumn(sheet, dims);
  if (detection) {
    console.log(`County column detected: column index ${detection.colIndex} (${XLSX.utils.encode_col(detection.colIndex)}) — ${detection.matchCount} matches`);
    console.log('  Sample matches:');
    detection.matchedRows.slice(0, 5).forEach(m =>
      console.log(`    row ${m.row}: "${m.raw}" → "${m.canonical}"`)
    );
    console.log();
  } else {
    console.log('No county column automatically detected. You may need to specify --sheet or inspect manually.\n');
  }

  // ── Preview table ────────────────────────────────────────────────────────
  const maxRow = Math.min(dims.maxRow, dims.minRow + opts.rows - 1);
  const maxCol = Math.min(dims.maxCol, dims.minCol + opts.cols - 1);

  console.log(`Preview: first ${maxRow - dims.minRow + 1} rows × ${maxCol - dims.minCol + 1} cols\n`);

  const header = [];
  for (let c = dims.minCol; c <= maxCol; c++) {
    header.push(`${XLSX.utils.encode_col(c)} (${c})`);
  }

  const tableRows = [header];
  for (let r = dims.minRow; r <= maxRow; r++) {
    const row = [];
    for (let c = dims.minCol; c <= maxCol; c++) {
      row.push(cellValue(sheet, c, r) ?? '');
    }
    tableRows.push(row);
  }
  printTable(tableRows);

  // ── Hint for convert.js ──────────────────────────────────────────────────
  if (detection) {
    console.log(`\nConvert hint:`);
    console.log(`  node scripts/convert.js ${opts.file} \\`);
    console.log(`    --sheet "${sheetName}" \\`);
    console.log(`    --county-col ${detection.colIndex} \\`);
    console.log(`    --value-col <column index with the values you want> \\`);
    console.log(`    --name "Dataset name" \\`);
    console.log(`    --out src/preloadedDatasets/my-dataset.json`);
  }
}

main();
