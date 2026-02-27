#!/usr/bin/env node
/**
 * download.js — Download Excel tables from recensamantromania.ro
 *
 * Usage:
 *   node scripts/download.js                  # download ALL tables
 *   node scripts/download.js 1.01 1.02        # download specific tables by ID
 *   node scripts/download.js --category demografie  # download a whole category
 *   node scripts/download.js --list           # list available tables
 *
 * Files are saved to scripts/downloads/<tableId>.<ext>
 */

import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { pipeline } from 'stream/promises';
import path from 'path';
import { TABLES, CATEGORIES, getByCategory, printCatalogue } from './catalogue.js';

const DOWNLOADS_DIR = new URL('./downloads/', import.meta.url).pathname;

// ── Helpers ──────────────────────────────────────────────────────────────────

function ensureDownloadsDir() {
  if (!existsSync(DOWNLOADS_DIR)) mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

function extFromUrl(url) {
  const match = url.match(/\.(xlsx?)(\?|$)/i);
  return match ? `.${match[1].toLowerCase()}` : '.xls';
}

function localPath(tableId, url) {
  const safeId = tableId.replace(/\./g, '_');
  return path.join(DOWNLOADS_DIR, `Tabel-${safeId}${extFromUrl(url)}`);
}

async function downloadTable(tableId, table, { overwrite = false } = {}) {
  const dest = localPath(tableId, table.url);
  if (!overwrite && existsSync(dest)) {
    console.log(`  [${tableId}] Already downloaded — ${path.basename(dest)}`);
    return { tableId, dest, status: 'skipped' };
  }

  console.log(`  [${tableId}] Downloading ${table.title}…`);
  const response = await fetch(table.url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (stats-map-generator data fetcher)' },
    redirect: 'follow',
  });

  if (!response.ok) {
    console.error(`  [${tableId}] HTTP ${response.status} — ${table.url}`);
    return { tableId, dest, status: 'error', code: response.status };
  }

  const fileStream = createWriteStream(dest);
  await pipeline(response.body, fileStream);
  console.log(`  [${tableId}] Saved → ${path.basename(dest)}`);
  return { tableId, dest, status: 'ok' };
}

// ── CLI ───────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  // --list
  if (args.includes('--list')) {
    printCatalogue();
    process.exit(0);
  }

  ensureDownloadsDir();

  let tablesToDownload = {};

  // --category <name>
  const catIdx = args.indexOf('--category');
  if (catIdx !== -1) {
    const cat = args[catIdx + 1];
    if (!CATEGORIES.includes(cat)) {
      console.error(`Unknown category "${cat}". Available: ${CATEGORIES.join(', ')}`);
      process.exit(1);
    }
    tablesToDownload = getByCategory(cat);
  } else if (args.length === 0) {
    // No args → download everything
    tablesToDownload = TABLES;
  } else {
    // Specific table IDs
    const overwriteIdx = args.indexOf('--overwrite');
    const ids = args.filter(a => !a.startsWith('--'));
    for (const id of ids) {
      if (!TABLES[id]) {
        console.error(`Unknown table ID "${id}". Run with --list to see all IDs.`);
        process.exit(1);
      }
      tablesToDownload[id] = TABLES[id];
    }
  }

  const overwrite = args.includes('--overwrite');
  const entries = Object.entries(tablesToDownload);
  console.log(`\nDownloading ${entries.length} table(s) to ${DOWNLOADS_DIR}\n`);

  const results = [];
  for (const [id, table] of entries) {
    results.push(await downloadTable(id, table, { overwrite }));
  }

  const ok = results.filter(r => r.status === 'ok').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  const errors = results.filter(r => r.status === 'error').length;

  console.log(`\nDone. ${ok} downloaded, ${skipped} skipped, ${errors} errors.`);
  if (errors > 0) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
