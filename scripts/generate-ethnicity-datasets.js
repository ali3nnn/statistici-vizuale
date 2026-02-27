#!/usr/bin/env node
/**
 * generate-ethnicity-datasets.js — Read Tabel-2_02.xlsx (Tab.2.2.1) and produce
 * preloaded dataset JSON files for each major ethnicity: absolute count + % of
 * county population.
 *
 * Column map (0-based, Tab.2.2.1):
 *   0  = county name
 *   1  = total population
 *   2  = Români
 *   3  = Maghiari
 *   4  = Romi
 *   5  = Ucraineni
 *   6  = Germani
 *   7  = Turci
 *   8  = Ruși-Lipoveni
 *   9  = Tătari
 *  10  = Sârbi
 *  11  = Slovaci
 *  12  = Bulgari
 *  13  = Croați
 *  14  = Greci
 *  15  = Italieni
 *  16  = Evrei
 *  17  = Cehi
 *  18  = Polonezi
 *  19  = Ruteni
 *  20  = Armeni
 *  21  = Albanezi
 *  22  = Macedoneni
 *  23  = Altă etnie
 *  24  = Informație nedisponibilă
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';
import { normalizeCountyName } from './utils/counties.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root      = resolve(__dirname, '..');

// ── Read Excel ───────────────────────────────────────────────────────────────

const buf   = readFileSync(resolve(__dirname, 'downloads/Tabel-2_02.xlsx'));
const wb    = XLSX.read(buf, { type: 'buffer' });
const sheet = wb.Sheets['Tab.2.2.1'];
const range = XLSX.utils.decode_range(sheet['!ref']);

function cellNum(col, row) {
    const cell = sheet[XLSX.utils.encode_cell({ c: col, r: row })];
    if (!cell) return 0;
    if (typeof cell.v === 'number') return Math.round(cell.v);
    const n = parseInt(String(cell.v).replace(/[\s,]/g, ''), 10);
    return isNaN(n) ? 0 : n;
}

function cellStr(col, row) {
    const cell = sheet[XLSX.utils.encode_cell({ c: col, r: row })];
    return cell ? String(cell.v ?? '').trim() : '';
}

// ── Extract county rows ──────────────────────────────────────────────────────

const counties = {};

for (let r = range.s.r; r <= range.e.r; r++) {
    const raw      = cellStr(0, r);
    const stripped = raw.replace(/^MUNICIPIUL\s+/i, '').trim();
    const county   = normalizeCountyName(raw) ?? normalizeCountyName(stripped);
    if (!county) continue;

    const total = cellNum(1, r);
    if (!total) continue;

    counties[county] = {
        total,
        romani:              cellNum(2,  r),
        maghiari:            cellNum(3,  r),
        romi:                cellNum(4,  r),
        ucraineni:           cellNum(5,  r),
        germani:             cellNum(6,  r),
        turci:               cellNum(7,  r),
        rusi_lipoveni:       cellNum(8,  r),
        tatari:              cellNum(9,  r),
        sarbi:               cellNum(10, r),
        slovaci:             cellNum(11, r),
        bulgari:             cellNum(12, r),
        croati:              cellNum(13, r),
        greci:               cellNum(14, r),
        italieni:            cellNum(15, r),
        evrei:               cellNum(16, r),
        cehi:                cellNum(17, r),
        polonezi:            cellNum(18, r),
        ruteni:              cellNum(19, r),
        armeni:              cellNum(20, r),
        albanezi:            cellNum(21, r),
        macedoneni:          cellNum(22, r),
        alta_etnie:          cellNum(23, r),
        info_nedisponibila:  cellNum(24, r),
    };
}

const countyCount = Object.keys(counties).length;
process.stderr.write(`Extracted ${countyCount} counties\n`);
if (countyCount !== 42) process.stderr.write('[warn] Expected 42 counties\n');

// ── Dataset helpers ──────────────────────────────────────────────────────────

const DISPLAY = {
    '4x5':  { showCode: true, showValue: true, labelSize: '11' },
    '9x16': { showCode: true, showValue: true, labelSize: '9'  },
};
const LEGEND = { '4x5': 'vertical', '9x16': 'vertical' };

function makeDataset({ name, subtitle, field, palette, highIsBad = false, normMode }) {
    const values = {};
    let min = Infinity, max = -Infinity;

    for (const [county, v] of Object.entries(counties)) {
        const val = typeof field === 'function' ? field(v) : v[field];
        values[county] = val;
        if (val < min) min = val;
        if (val > max) max = val;
    }

    return {
        name,
        config: {
            data: values,
            minValue: min,
            maxValue: max,
            highIsBad,
            activePalette: palette,
            paletteReversed: false,
            normalizationMode: normMode,
            text: {
                title:    { innerHTML: name,     textAlign: '', top: '' },
                subtitle: { innerHTML: subtitle, textAlign: '', top: '' },
                footer:   { innerHTML: 'Sursa: RPL 2021 — INS', textAlign: '', top: '' },
            },
            display: DISPLAY,
            legendOrientation: LEGEND,
        },
    };
}

function pct(v, total) {
    return total > 0 ? Math.round(v / total * 1000) / 10 : 0;
}

function save(filename, dataset) {
    const dest = resolve(root, 'src/preloadedDatasets', filename);
    writeFileSync(dest, JSON.stringify(dataset, null, 2) + '\n');
    process.stderr.write(`Written → ${filename}\n`);
}

// ── Ethnicity definitions ─────────────────────────────────────────────────────

const ethnicities = [
    {
        key:    'romani',
        slug:   'etnie-romani',
        name:   'Populația română',
        pctName:'Români (%)',
        sub:    'Număr de români pe județe — RPL 2021',
        subPct: 'Procentul populației române pe județe — RPL 2021',
        palette: { name: 'Blue',   hue: 220, id: 'blue'   },
        normAbs: 'logarithmic',
        normPct: 'none',
    },
    {
        key:    'maghiari',
        slug:   'etnie-maghiari',
        name:   'Populația maghiară',
        pctName:'Maghiari (%)',
        sub:    'Număr de maghiari pe județe — RPL 2021',
        subPct: 'Procentul populației maghiare pe județe — RPL 2021',
        palette: { name: 'Orange', hue: 30,  id: 'orange' },
        normAbs: 'logarithmic',
        normPct: 'logarithmic',
    },
    {
        key:    'romi',
        slug:   'etnie-romi',
        name:   'Populația romă',
        pctName:'Romi (%)',
        sub:    'Număr de romi pe județe — RPL 2021',
        subPct: 'Procentul populației rome pe județe — RPL 2021',
        palette: { name: 'Red',    hue: 0,   id: 'red'    },
        normAbs: 'logarithmic',
        normPct: 'logarithmic',
    },
    {
        key:    'ucraineni',
        slug:   'etnie-ucraineni',
        name:   'Populația ucraineană',
        pctName:'Ucraineni (%)',
        sub:    'Număr de ucraineni pe județe — RPL 2021',
        subPct: 'Procentul populației ucrainene pe județe — RPL 2021',
        palette: { name: 'Blue',   hue: 200, id: 'blue'   },
        normAbs: 'logarithmic',
        normPct: 'logarithmic',
    },
    {
        key:    'germani',
        slug:   'etnie-germani',
        name:   'Populația germană',
        pctName:'Germani (%)',
        sub:    'Număr de germani pe județe — RPL 2021',
        subPct: 'Procentul populației germane pe județe — RPL 2021',
        palette: { name: 'Purple', hue: 260, id: 'purple' },
        normAbs: 'logarithmic',
        normPct: 'logarithmic',
    },
    {
        key:    'turci',
        slug:   'etnie-turci',
        name:   'Populația turcă',
        pctName:'Turci (%)',
        sub:    'Număr de turci pe județe — RPL 2021',
        subPct: 'Procentul populației turce pe județe — RPL 2021',
        palette: { name: 'Red',    hue: 350, id: 'red'    },
        normAbs: 'logarithmic',
        normPct: 'logarithmic',
    },
    {
        key:    'rusi_lipoveni',
        slug:   'etnie-rusi-lipoveni',
        name:   'Populația rusă-lipoveană',
        pctName:'Ruși-Lipoveni (%)',
        sub:    'Număr de ruși-lipoveni pe județe — RPL 2021',
        subPct: 'Procentul populației ruse-lipovene pe județe — RPL 2021',
        palette: { name: 'Blue',   hue: 240, id: 'blue'   },
        normAbs: 'logarithmic',
        normPct: 'logarithmic',
    },
    {
        key:    'tatari',
        slug:   'etnie-tatari',
        name:   'Populația tătară',
        pctName:'Tătari (%)',
        sub:    'Număr de tătari pe județe — RPL 2021',
        subPct: 'Procentul populației tătare pe județe — RPL 2021',
        palette: { name: 'Orange', hue: 20,  id: 'orange' },
        normAbs: 'logarithmic',
        normPct: 'logarithmic',
    },
    {
        key:    'sarbi',
        slug:   'etnie-sarbi',
        name:   'Populația sârbă',
        pctName:'Sârbi (%)',
        sub:    'Număr de sârbi pe județe — RPL 2021',
        subPct: 'Procentul populației sârbe pe județe — RPL 2021',
        palette: { name: 'Blue',   hue: 215, id: 'blue'   },
        normAbs: 'logarithmic',
        normPct: 'logarithmic',
    },
    {
        key:    'slovaci',
        slug:   'etnie-slovaci',
        name:   'Populația slovacă',
        pctName:'Slovaci (%)',
        sub:    'Număr de slovaci pe județe — RPL 2021',
        subPct: 'Procentul populației slovace pe județe — RPL 2021',
        palette: { name: 'Blue',   hue: 190, id: 'blue'   },
        normAbs: 'logarithmic',
        normPct: 'logarithmic',
    },
    {
        key:    'bulgari',
        slug:   'etnie-bulgari',
        name:   'Populația bulgară',
        pctName:'Bulgari (%)',
        sub:    'Număr de bulgari pe județe — RPL 2021',
        subPct: 'Procentul populației bulgare pe județe — RPL 2021',
        palette: { name: 'Green',  hue: 130, id: 'green'  },
        normAbs: 'logarithmic',
        normPct: 'logarithmic',
    },
    {
        key:    'croati',
        slug:   'etnie-croati',
        name:   'Populația croată',
        pctName:'Croați (%)',
        sub:    'Număr de croați pe județe — RPL 2021',
        subPct: 'Procentul populației croate pe județe — RPL 2021',
        palette: { name: 'Red',    hue: 15,  id: 'red'    },
        normAbs: 'logarithmic',
        normPct: 'logarithmic',
    },
    {
        key:    'greci',
        slug:   'etnie-greci',
        name:   'Populația greacă',
        pctName:'Greci (%)',
        sub:    'Număr de greci pe județe — RPL 2021',
        subPct: 'Procentul populației grecești pe județe — RPL 2021',
        palette: { name: 'Blue',   hue: 205, id: 'blue'   },
        normAbs: 'logarithmic',
        normPct: 'logarithmic',
    },
    {
        key:    'italieni',
        slug:   'etnie-italieni',
        name:   'Populația italiană',
        pctName:'Italieni (%)',
        sub:    'Număr de italieni pe județe — RPL 2021',
        subPct: 'Procentul populației italiene pe județe — RPL 2021',
        palette: { name: 'Green',  hue: 150, id: 'green'  },
        normAbs: 'logarithmic',
        normPct: 'logarithmic',
    },
    {
        key:    'evrei',
        slug:   'etnie-evrei',
        name:   'Populația evreiască',
        pctName:'Evrei (%)',
        sub:    'Număr de evrei pe județe — RPL 2021',
        subPct: 'Procentul populației evreiești pe județe — RPL 2021',
        palette: { name: 'Blue',   hue: 220, id: 'blue'   },
        normAbs: 'logarithmic',
        normPct: 'logarithmic',
    },
    {
        key:    'cehi',
        slug:   'etnie-cehi',
        name:   'Populația cehă',
        pctName:'Cehi (%)',
        sub:    'Număr de cehi pe județe — RPL 2021',
        subPct: 'Procentul populației cehe pe județe — RPL 2021',
        palette: { name: 'Blue',   hue: 230, id: 'blue'   },
        normAbs: 'logarithmic',
        normPct: 'logarithmic',
    },
    {
        key:    'polonezi',
        slug:   'etnie-polonezi',
        name:   'Populația poloneză',
        pctName:'Polonezi (%)',
        sub:    'Număr de polonezi pe județe — RPL 2021',
        subPct: 'Procentul populației poloneze pe județe — RPL 2021',
        palette: { name: 'Red',    hue: 5,   id: 'red'    },
        normAbs: 'logarithmic',
        normPct: 'logarithmic',
    },
    {
        key:    'ruteni',
        slug:   'etnie-ruteni',
        name:   'Populația ruteană',
        pctName:'Ruteni (%)',
        sub:    'Număr de ruteni pe județe — RPL 2021',
        subPct: 'Procentul populației rutene pe județe — RPL 2021',
        palette: { name: 'Blue',   hue: 210, id: 'blue'   },
        normAbs: 'logarithmic',
        normPct: 'logarithmic',
    },
    {
        key:    'armeni',
        slug:   'etnie-armeni',
        name:   'Populația armeană',
        pctName:'Armeni (%)',
        sub:    'Număr de armeni pe județe — RPL 2021',
        subPct: 'Procentul populației armene pe județe — RPL 2021',
        palette: { name: 'Red',    hue: 340, id: 'red'    },
        normAbs: 'logarithmic',
        normPct: 'logarithmic',
    },
    {
        key:    'albanezi',
        slug:   'etnie-albanezi',
        name:   'Populația albaneză',
        pctName:'Albanezi (%)',
        sub:    'Număr de albanezi pe județe — RPL 2021',
        subPct: 'Procentul populației albaneze pe județe — RPL 2021',
        palette: { name: 'Red',    hue: 355, id: 'red'    },
        normAbs: 'logarithmic',
        normPct: 'logarithmic',
    },
    {
        key:    'macedoneni',
        slug:   'etnie-macedoneni',
        name:   'Populația macedoneană',
        pctName:'Macedoneni (%)',
        sub:    'Număr de macedoneni pe județe — RPL 2021',
        subPct: 'Procentul populației macedonene pe județe — RPL 2021',
        palette: { name: 'Orange', hue: 40,  id: 'orange' },
        normAbs: 'logarithmic',
        normPct: 'logarithmic',
    },
    {
        key:    'alta_etnie',
        slug:   'etnie-alta',
        name:   'Altă etnie',
        pctName:'Altă etnie (%)',
        sub:    'Număr de persoane aparținând altor etnii pe județe — RPL 2021',
        subPct: 'Procentul persoanelor aparținând altor etnii pe județe — RPL 2021',
        palette: { name: 'Green',  hue: 90,  id: 'green'  },
        normAbs: 'logarithmic',
        normPct: 'logarithmic',
    },
    {
        key:    'info_nedisponibila',
        slug:   'etnie-nedisponibila',
        name:   'Etnie nedeclarată',
        pctName:'Etnie nedeclarată (%)',
        sub:    'Număr de persoane cu etnie nedeclarată pe județe — RPL 2021',
        subPct: 'Procentul persoanelor cu etnie nedeclarată pe județe — RPL 2021',
        palette: { name: 'Purple', hue: 270, id: 'purple' },
        normAbs: 'logarithmic',
        normPct: 'logarithmic',
    },
];

// ── Generate datasets ────────────────────────────────────────────────────────

const imports = [];
const entries = [];

for (const e of ethnicities) {
    const absFile = `${e.slug}.json`;
    const pctFile = `${e.slug}-pct.json`;
    const absVar  = e.slug.replace(/-(.)/g, (_, c) => c.toUpperCase()).replace(/^./, c => c.toUpperCase());
    const absVarLower = absVar.charAt(0).toLowerCase() + absVar.slice(1);
    const pctVar  = absVarLower + 'Pct';
    const absVarFull = absVarLower;

    save(absFile, makeDataset({
        name:     e.name,
        subtitle: e.sub,
        field:    e.key,
        palette:  e.palette,
        normMode: e.normAbs,
    }));

    save(pctFile, makeDataset({
        name:     e.pctName,
        subtitle: e.subPct,
        field:    v => pct(v[e.key], v.total),
        palette:  e.palette,
        normMode: e.normPct,
    }));

    imports.push(`import ${absVarFull} from './${absFile}';`);
    imports.push(`import ${pctVar} from './${pctFile}';`);
    entries.push(absVarFull, pctVar);
}

process.stderr.write('\n── Add to src/preloadedDatasets/index.js ──\n');
process.stderr.write(imports.join('\n') + '\n\n');
process.stderr.write('// in the array:\n');
process.stderr.write(entries.map(e => `    ${e},`).join('\n') + '\n');
process.stderr.write('\nDone.\n');
