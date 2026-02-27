#!/usr/bin/env node
/**
 * generate-education-datasets.js — Read Tabel-3_01.xlsx and produce
 * preloaded dataset JSON files for education levels per county.
 *
 * Each sheet = one county (ROMANIA is national; skipped).
 * All 42 county sheets share the same fixed row layout.
 *
 * Fixed row map (0-based):
 *   r7  : county total row
 *           col1 = population 2+ WITH completed education (TOTAL)
 *           col2 = Masculin,  col3 = Feminin
 *           col4 = Urban,     col5 = Rural
 *           col6 = population 2+ WITHOUT any completed education (TOTAL)
 *           col7 = age < 2, not applicable
 *   r11 : I.A Postdoctorat
 *   r13 : I.B Doctorat
 *   r21 : I.C Studii universitare de masterat
 *   r29 : I.D Invatamant universitar de licenta — Ciclul I
 *   r37 : I.E Universitar de lunga durata (legacy)
 *   r45 : I.F Universitar de scurta durata — colegii (legacy)
 *   r47 : II. Tertiar non-universitar (postliceal / maistri)
 *   r49 : III. Invatamant secundar (TOTAL)
 *   r51 : — liceal
 *   r62 : — profesional si de ucenici
 *   r63 : Secundar inferior (8 clase)
 *   r65 : IV. Invatamant primar
 *   r67 : V. Educatie timpurie (prescolar / anteprescolar)
 *
 * Denominator for all %: col1[r7] + col6[r7] + col7[r7] = full county population
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';
import { normalizeCountyName } from './utils/counties.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root      = resolve(__dirname, '..');

// ── Read Excel ───────────────────────────────────────────────────────────────

const buf = readFileSync(resolve(__dirname, 'downloads/Tabel-3_01.xlsx'));
const wb  = XLSX.read(buf, { type: 'buffer' });

// ── Extract per-county data ──────────────────────────────────────────────────

function getNum(sheet, col, row) {
    const cell = sheet[XLSX.utils.encode_cell({ c: col, r: row })];
    if (!cell || cell.v === '-') return 0;
    if (typeof cell.v === 'number') return Math.round(cell.v);
    const n = parseInt(String(cell.v).replace(/[\s,]/g, ''), 10);
    return isNaN(n) ? 0 : n;
}

const counties = {};

for (const sheetName of wb.SheetNames) {
    if (sheetName === 'ROMANIA') continue;

    const county = normalizeCountyName(sheetName)
                ?? normalizeCountyName(sheetName.replace(/^MUNICIPIUL\s+/i, '').trim());
    if (!county) {
        process.stderr.write(`[warn] Could not normalize sheet "${sheetName}"\n`);
        continue;
    }

    const s = wb.Sheets[sheetName];
    const g = (c, r) => getNum(s, c, r);

    const withEdu = g(1, 7);   // population with completed education
    const noEdu   = g(6, 7);   // population without any completed education
    const under2  = g(7, 7);   // age < 2
    const total   = withEdu + noEdu + under2;

    const withEduM = g(2, 7);
    const withEduF = g(3, 7);

    // University sub-levels (sum = total university educated)
    const uni_postdoc  = g(1, 11);
    const uni_doctorat = g(1, 13);
    const uni_masterat = g(1, 21);
    const uni_licenta  = g(1, 29);
    const uni_lunga    = g(1, 37);
    const uni_scurta   = g(1, 45);
    const universitar  = uni_postdoc + uni_doctorat + uni_masterat + uni_licenta + uni_lunga + uni_scurta;
    const postuniv     = uni_postdoc + uni_doctorat + uni_masterat;

    // University by sex
    const uniM = g(2, 11) + g(2, 13) + g(2, 21) + g(2, 29) + g(2, 37) + g(2, 45);
    const uniF = g(3, 11) + g(3, 13) + g(3, 21) + g(3, 29) + g(3, 37) + g(3, 45);

    counties[county] = {
        total,
        withEdu, withEduM, withEduF,
        noEdu, under2,

        universitar,
        postuniv,
        doctorat:   uni_doctorat + uni_postdoc,
        masterat:   uni_masterat,
        licenta:    uni_licenta + uni_lunga + uni_scurta,

        uniM, uniF,
        withEduM, withEduF,

        tertiar:     g(1, 47),
        secundar:    g(1, 49),
        liceal:      g(1, 51),
        profesional: g(1, 62),
        sec_inferior: g(1, 63),
        primar:      g(1, 65),
        prescolar:   g(1, 67),
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

function makeDataset({ name, subtitle, field, palette, highIsBad = false }) {
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
            normalizationMode: 'none',
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

function pct(num, denom) {
    return denom > 0 ? Math.round(num / denom * 1000) / 10 : 0;
}

function save(filename, dataset) {
    const dest = resolve(root, 'src/preloadedDatasets', filename);
    writeFileSync(dest, JSON.stringify(dataset, null, 2) + '\n');
    process.stderr.write(`Written → ${filename}\n`);
}

// ── Education level definitions ──────────────────────────────────────────────

const datasets = [
    {
        slug:    'edu-universitar',
        name:    'Absolvenți de învățământ universitar (%)',
        sub:     'Ponderea populației cu orice grad de studii universitare — RPL 2021',
        field:   v => pct(v.universitar, v.total),
        palette: { name: 'Blue',   hue: 220, id: 'blue'   },
    },
    {
        slug:    'edu-postuniversitar',
        name:    'Absolvenți postuniversitari — masterat și doctorat (%)',
        sub:     'Ponderea populației cu masterat, doctorat sau postdoctorat — RPL 2021',
        field:   v => pct(v.postuniv, v.total),
        palette: { name: 'Blue',   hue: 240, id: 'blue'   },
    },
    {
        slug:    'edu-doctorat',
        name:    'Doctori și postdoctori (%)',
        sub:     'Ponderea populației cu titlu de doctor sau postdoctorat — RPL 2021',
        field:   v => pct(v.doctorat, v.total),
        palette: { name: 'Purple', hue: 260, id: 'purple' },
    },
    {
        slug:    'edu-licenta',
        name:    'Absolvenți de licență (%)',
        sub:     'Ponderea populației cu licență, studii universitare lungi sau scurte — RPL 2021',
        field:   v => pct(v.licenta, v.total),
        palette: { name: 'Blue',   hue: 210, id: 'blue'   },
    },
    {
        slug:    'edu-universitar-masculin',
        name:    'Bărbați cu studii universitare (% din bărbații cu educație)',
        sub:     'Ponderea bărbaților cu studii universitare din totalul bărbaților cu educație finalizată — RPL 2021',
        field:   v => pct(v.uniM, v.withEduM),
        palette: { name: 'Blue',   hue: 215, id: 'blue'   },
    },
    {
        slug:    'edu-universitar-feminin',
        name:    'Femei cu studii universitare (% din femeile cu educație)',
        sub:     'Ponderea femeilor cu studii universitare din totalul femeilor cu educație finalizată — RPL 2021',
        field:   v => pct(v.uniF, v.withEduF),
        palette: { name: 'Purple', hue: 290, id: 'purple' },
    },
    {
        slug:    'edu-tertiar-nonuniversitar',
        name:    'Absolvenți de postliceal sau școală de maiștri (%)',
        sub:     'Ponderea populației cu studii terțiare non-universitare — RPL 2021',
        field:   v => pct(v.tertiar, v.total),
        palette: { name: 'Green',  hue: 160, id: 'green'  },
    },
    {
        slug:    'edu-liceal',
        name:    'Absolvenți de liceu (%)',
        sub:     'Ponderea populației cu studii liceale finalizate — RPL 2021',
        field:   v => pct(v.liceal, v.total),
        palette: { name: 'Green',  hue: 140, id: 'green'  },
    },
    {
        slug:    'edu-profesional',
        name:    'Absolvenți de școală profesională sau de ucenici (%)',
        sub:     'Ponderea populației cu educație profesională sau ucenicie — RPL 2021',
        field:   v => pct(v.profesional, v.total),
        palette: { name: 'Orange', hue: 30,  id: 'orange' },
    },
    {
        slug:    'edu-secundar-inferior',
        name:    'Absolvenți de gimnaziu — maximum 8 clase (%)',
        sub:     'Ponderea populației cu cel mult 8 clase finalizate — RPL 2021',
        field:   v => pct(v.sec_inferior, v.total),
        palette: { name: 'Orange', hue: 20,  id: 'orange' },
        highIsBad: true,
    },
    {
        slug:    'edu-primar',
        name:    'Absolvenți de school primară — maximum 4 clase (%)',
        sub:     'Ponderea populației cu cel mult 4 clase finalizate — RPL 2021',
        field:   v => pct(v.primar, v.total),
        palette: { name: 'Red',    hue: 10,  id: 'red'    },
        highIsBad: true,
    },
    {
        slug:    'edu-prescolar',
        name:    'Fără nicio clasă finalizată — doar educație timpurie (%)',
        sub:     'Ponderea populației cu educație timpurie (preșcolar/antepreșcolar) — RPL 2021',
        field:   v => pct(v.prescolar, v.total),
        palette: { name: 'Red',    hue: 5,   id: 'red'    },
        highIsBad: true,
    },
    {
        slug:    'edu-fara-educatie',
        name:    'Fără nicio educație finalizată (%)',
        sub:     'Ponderea populației fără niciun nivel de educație finalizat (inclusiv persoane fără școală) — RPL 2021',
        field:   v => pct(v.noEdu, v.total),
        palette: { name: 'Red',    hue: 0,   id: 'red'    },
        highIsBad: true,
    },
];

// ── Generate datasets ────────────────────────────────────────────────────────

const imports = [];
const entries = [];

function slugToVar(slug) {
    return slug.replace(/-(.)/g, (_, c) => c.toUpperCase());
}

for (const d of datasets) {
    const filename = `${d.slug}.json`;
    const varName  = slugToVar(d.slug);

    save(filename, makeDataset({
        name:      d.name,
        subtitle:  d.sub,
        field:     d.field,
        palette:   d.palette,
        highIsBad: d.highIsBad ?? false,
    }));

    imports.push(`import ${varName} from './${filename}';`);
    entries.push(varName);
}

process.stderr.write('\n── Add to src/preloadedDatasets/index.js ──\n');
process.stderr.write(imports.join('\n') + '\n\n');
process.stderr.write('// in the array:\n');
process.stderr.write(entries.map(e => `    ${e},`).join('\n') + '\n');
process.stderr.write('\nDone.\n');
