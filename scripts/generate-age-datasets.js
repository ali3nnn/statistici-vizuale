#!/usr/bin/env node
/**
 * generate-age-datasets.js — Read Tabel-1_02.xlsx (TAB. 1.2_RPL2021) and produce
 * preloaded dataset JSON files for age-group distributions by sex.
 *
 * Values in the Excel are proportions (0–1); col 1 ≈ 1 (sum of proportions).
 * All generated datasets express values as percentages (×100, 1 decimal).
 *
 * Column map (0-based):
 *   0  = county / section name
 *   1  = total (≈1)
 *   2  = 0–4 ani
 *   3  = 5–9 ani
 *   4  = 10–14 ani
 *   5  = 15–19 ani
 *   6  = 20–24 ani
 *   7  = 25–29 ani
 *   8  = 30–34 ani
 *   9  = 35–39 ani
 *  10  = 40–44 ani
 *  11  = 45–49 ani
 *  12  = 50–54 ani
 *  13  = 55–59 ani
 *  14  = 60–64 ani
 *  15  = 65–69 ani
 *  16  = 70–74 ani
 *  17  = 75–79 ani
 *  18  = 80–84 ani
 *  19  = 85+ ani
 *
 * Sections (determined by label in col 0):
 *   TOTAL    — full population (default)
 *   MASCULIN — male population
 *   FEMININ  — female population
 *   URBAN    — urban population
 *   RURAL    — rural population
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';
import { normalizeCountyName } from './utils/counties.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root      = resolve(__dirname, '..');

// ── Read Excel ───────────────────────────────────────────────────────────────

const buf   = readFileSync(resolve(__dirname, 'downloads/Tabel-1_02.xlsx'));
const wb    = XLSX.read(buf, { type: 'buffer' });
const sheet = wb.Sheets['TAB. 1.2_RPL2021'];
const range = XLSX.utils.decode_range(sheet['!ref']);

function cellPct(col, row) {
    const cell = sheet[XLSX.utils.encode_cell({ c: col, r: row })];
    if (!cell) return 0;
    const v = typeof cell.v === 'number' ? cell.v
            : parseFloat(String(cell.v).replace(/[\s,]/g, ''));
    return isNaN(v) ? 0 : Math.round(v * 1000) / 10;
}

function cellStr(col, row) {
    const cell = sheet[XLSX.utils.encode_cell({ c: col, r: row })];
    return cell ? String(cell.v ?? '').trim() : '';
}

// ── Extract county rows by section ──────────────────────────────────────────

const SECTION_LABELS = new Set(['MASCULIN', 'FEMININ', 'URBAN', 'RURAL']);

const sections = {
    TOTAL:    {},
    MASCULIN: {},
    FEMININ:  {},
    URBAN:    {},
    RURAL:    {},
};

let currentSection = 'TOTAL';

for (let r = range.s.r; r <= range.e.r; r++) {
    const raw      = cellStr(0, r);
    const stripped = raw.replace(/^MUNICIPIUL\s+/i, '').trim();

    if (SECTION_LABELS.has(raw)) { currentSection = raw; continue; }

    const county = normalizeCountyName(raw) ?? normalizeCountyName(stripped);
    if (!county) continue;

    sections[currentSection][county] = {
        g0_4:    cellPct(2,  r),
        g5_9:    cellPct(3,  r),
        g10_14:  cellPct(4,  r),
        g15_19:  cellPct(5,  r),
        g20_24:  cellPct(6,  r),
        g25_29:  cellPct(7,  r),
        g30_34:  cellPct(8,  r),
        g35_39:  cellPct(9,  r),
        g40_44:  cellPct(10, r),
        g45_49:  cellPct(11, r),
        g50_54:  cellPct(12, r),
        g55_59:  cellPct(13, r),
        g60_64:  cellPct(14, r),
        g65_69:  cellPct(15, r),
        g70_74:  cellPct(16, r),
        g75_79:  cellPct(17, r),
        g80_84:  cellPct(18, r),
        g85plus: cellPct(19, r),
    };
}

for (const [sec, data] of Object.entries(sections)) {
    const n = Object.keys(data).length;
    process.stderr.write(`Section ${sec}: ${n} counties\n`);
    if (n !== 42) process.stderr.write(`  [warn] Expected 42\n`);
}

// ── Dataset helpers ──────────────────────────────────────────────────────────

const DISPLAY = {
    '4x5':  { showCode: true, showValue: true, labelSize: '11' },
    '9x16': { showCode: true, showValue: true, labelSize: '9'  },
};
const LEGEND = { '4x5': 'vertical', '9x16': 'vertical' };

function makeDataset({ name, subtitle, sectionData, field, palette, highIsBad = false, normMode = 'none' }) {
    const values = {};
    let min = Infinity, max = -Infinity;

    for (const [county, v] of Object.entries(sectionData)) {
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

function save(filename, dataset) {
    const dest = resolve(root, 'src/preloadedDatasets', filename);
    writeFileSync(dest, JSON.stringify(dataset, null, 2) + '\n');
    process.stderr.write(`Written → ${filename}\n`);
}

// ── Definitions ──────────────────────────────────────────────────────────────

// 18 individual age groups (% of total population)
const AGE_GROUPS = [
    { key: 'g0_4',    slug: 'varsta-0-4',    label: '0–4 ani',          palette: { name: 'Blue',   hue: 210, id: 'blue'   } },
    { key: 'g5_9',    slug: 'varsta-5-9',    label: '5–9 ani',          palette: { name: 'Blue',   hue: 215, id: 'blue'   } },
    { key: 'g10_14',  slug: 'varsta-10-14',  label: '10–14 ani',        palette: { name: 'Blue',   hue: 220, id: 'blue'   } },
    { key: 'g15_19',  slug: 'varsta-15-19',  label: '15–19 ani',        palette: { name: 'Blue',   hue: 225, id: 'blue'   } },
    { key: 'g20_24',  slug: 'varsta-20-24',  label: '20–24 ani',        palette: { name: 'Green',  hue: 140, id: 'green'  } },
    { key: 'g25_29',  slug: 'varsta-25-29',  label: '25–29 ani',        palette: { name: 'Green',  hue: 145, id: 'green'  } },
    { key: 'g30_34',  slug: 'varsta-30-34',  label: '30–34 ani',        palette: { name: 'Green',  hue: 150, id: 'green'  } },
    { key: 'g35_39',  slug: 'varsta-35-39',  label: '35–39 ani',        palette: { name: 'Green',  hue: 155, id: 'green'  } },
    { key: 'g40_44',  slug: 'varsta-40-44',  label: '40–44 ani',        palette: { name: 'Green',  hue: 160, id: 'green'  } },
    { key: 'g45_49',  slug: 'varsta-45-49',  label: '45–49 ani',        palette: { name: 'Green',  hue: 165, id: 'green'  } },
    { key: 'g50_54',  slug: 'varsta-50-54',  label: '50–54 ani',        palette: { name: 'Orange', hue: 35,  id: 'orange' } },
    { key: 'g55_59',  slug: 'varsta-55-59',  label: '55–59 ani',        palette: { name: 'Orange', hue: 28,  id: 'orange' } },
    { key: 'g60_64',  slug: 'varsta-60-64',  label: '60–64 ani',        palette: { name: 'Orange', hue: 20,  id: 'orange' } },
    { key: 'g65_69',  slug: 'varsta-65-69',  label: '65–69 ani',        palette: { name: 'Red',    hue: 10,  id: 'red'    } },
    { key: 'g70_74',  slug: 'varsta-70-74',  label: '70–74 ani',        palette: { name: 'Red',    hue: 5,   id: 'red'    } },
    { key: 'g75_79',  slug: 'varsta-75-79',  label: '75–79 ani',        palette: { name: 'Red',    hue: 0,   id: 'red'    } },
    { key: 'g80_84',  slug: 'varsta-80-84',  label: '80–84 ani',        palette: { name: 'Red',    hue: 355, id: 'red'    } },
    { key: 'g85plus', slug: 'varsta-85-plus', label: '85 ani și peste', palette: { name: 'Red',    hue: 350, id: 'red'    } },
];

// Derived composite indicators
const DERIVED = [
    {
        slug:   'varsta-copii',
        name:   'Copii 0–14 ani (%)',
        sub:    'Ponderea copiilor (0–14 ani) în populația județului — RPL 2021',
        field:  v => Math.round((v.g0_4 + v.g5_9 + v.g10_14) * 10) / 10,
        palette: { name: 'Blue',   hue: 215, id: 'blue'   },
    },
    {
        slug:   'varsta-tineri',
        name:   'Tineri 15–34 ani (%)',
        sub:    'Ponderea tinerilor (15–34 ani) în populația județului — RPL 2021',
        field:  v => Math.round((v.g15_19 + v.g20_24 + v.g25_29 + v.g30_34) * 10) / 10,
        palette: { name: 'Green',  hue: 145, id: 'green'  },
    },
    {
        slug:   'varsta-activi',
        name:   'Populație activă 20–64 ani (%)',
        sub:    'Ponderea populației de vârstă activă (20–64 ani) — RPL 2021',
        field:  v => Math.round((v.g20_24 + v.g25_29 + v.g30_34 + v.g35_39 +
                                 v.g40_44 + v.g45_49 + v.g50_54 + v.g55_59 + v.g60_64) * 10) / 10,
        palette: { name: 'Green',  hue: 150, id: 'green'  },
    },
    {
        slug:   'varsta-varstnici',
        name:   'Vârstnici 65+ ani (%)',
        sub:    'Ponderea vârstnicilor (65 ani și peste) în populația județului — RPL 2021',
        field:  v => Math.round((v.g65_69 + v.g70_74 + v.g75_79 + v.g80_84 + v.g85plus) * 10) / 10,
        palette: { name: 'Red',    hue: 0,   id: 'red'    },
        highIsBad: true,
    },
    {
        slug:   'indice-imbatranire',
        name:   'Indice de îmbătrânire demografică',
        sub:    'Raport 65+/0–19 ani × 100 — cu cât mai mare, cu atât mai îmbătrânită populația — RPL 2021',
        field:  v => {
            const young   = v.g0_4 + v.g5_9 + v.g10_14 + v.g15_19;
            const elderly = v.g65_69 + v.g70_74 + v.g75_79 + v.g80_84 + v.g85plus;
            return young > 0 ? Math.round(elderly / young * 1000) / 10 : 0;
        },
        palette: { name: 'Red',    hue: 10,  id: 'red'    },
        highIsBad: true,
    },
    {
        slug:   'rata-dependenta',
        name:   'Rată de dependență demografică (%)',
        sub:    'Raport (0–19 + 65+) / (20–64) × 100 — RPL 2021',
        field:  v => {
            const dep    = v.g0_4 + v.g5_9 + v.g10_14 + v.g15_19 +
                           v.g65_69 + v.g70_74 + v.g75_79 + v.g80_84 + v.g85plus;
            const active = v.g20_24 + v.g25_29 + v.g30_34 + v.g35_39 +
                           v.g40_44 + v.g45_49 + v.g50_54 + v.g55_59 + v.g60_64;
            return active > 0 ? Math.round(dep / active * 1000) / 10 : 0;
        },
        palette: { name: 'Orange', hue: 20,  id: 'orange' },
        highIsBad: true,
    },
];

// Key age groups repeated for MASCULIN / FEMININ sections
const SEX_GROUPS = [
    { key: 'g0_4',    slug: 'g0-4',    label: '0–4 ani'          },
    { key: 'g15_19',  slug: 'g15-19',  label: '15–19 ani'        },
    { key: 'g20_24',  slug: 'g20-24',  label: '20–24 ani'        },
    { key: 'g65_69',  slug: 'g65-69',  label: '65–69 ani'        },
    { key: 'g70_74',  slug: 'g70-74',  label: '70–74 ani'        },
    { key: 'g75_79',  slug: 'g75-79',  label: '75–79 ani'        },
    { key: 'g80_84',  slug: 'g80-84',  label: '80–84 ani'        },
    { key: 'g85plus', slug: 'g85-plus', label: '85 ani și peste' },
];

// ── Generate datasets ────────────────────────────────────────────────────────

const imports = [];
const entries = [];

function register(filename, varName, dataset) {
    save(filename, dataset);
    imports.push(`import ${varName} from './${filename}';`);
    entries.push(varName);
}

function slugToVar(slug) {
    return slug.replace(/-(.)/g, (_, c) => c.toUpperCase());
}

// 1. Individual age groups — TOTAL
for (const ag of AGE_GROUPS) {
    const filename = `${ag.slug}.json`;
    const varName  = slugToVar(ag.slug);
    register(filename, varName, makeDataset({
        name:        `${ag.label} (%)`,
        subtitle:    `Ponderea populației cu vârsta ${ag.label} — RPL 2021`,
        sectionData: sections.TOTAL,
        field:       ag.key,
        palette:     ag.palette,
    }));
}

// 2. Derived composite indicators — TOTAL
for (const d of DERIVED) {
    const filename = `${d.slug}.json`;
    const varName  = slugToVar(d.slug);
    register(filename, varName, makeDataset({
        name:        d.name,
        subtitle:    d.sub,
        sectionData: sections.TOTAL,
        field:       d.field,
        palette:     d.palette,
        highIsBad:   d.highIsBad ?? false,
    }));
}

// 3. Key age groups — MASCULIN
for (const sg of SEX_GROUPS) {
    const filename = `varsta-m-${sg.slug}.json`;
    const varName  = slugToVar(`varsta-m-${sg.slug}`);
    register(filename, varName, makeDataset({
        name:        `Masculin ${sg.label} (%)`,
        subtitle:    `Ponderea bărbaților cu vârsta ${sg.label} în totalul bărbaților — RPL 2021`,
        sectionData: sections.MASCULIN,
        field:       sg.key,
        palette:     { name: 'Blue',   hue: 220, id: 'blue'   },
    }));
}

// 4. Key age groups — FEMININ
for (const sg of SEX_GROUPS) {
    const filename = `varsta-f-${sg.slug}.json`;
    const varName  = slugToVar(`varsta-f-${sg.slug}`);
    register(filename, varName, makeDataset({
        name:        `Feminin ${sg.label} (%)`,
        subtitle:    `Ponderea femeilor cu vârsta ${sg.label} în totalul femeilor — RPL 2021`,
        sectionData: sections.FEMININ,
        field:       sg.key,
        palette:     { name: 'Purple', hue: 300, id: 'purple' },
    }));
}

// 5. Derived indicators — URBAN / RURAL (varstnici + indice imbatranire)
for (const [secKey, secLabel, palette] of [
    ['URBAN', 'urban',  { name: 'Orange', hue: 30, id: 'orange' }],
    ['RURAL', 'rural',  { name: 'Green',  hue: 130, id: 'green' }],
]) {
    for (const d of DERIVED.filter(x => ['varsta-varstnici', 'indice-imbatranire', 'rata-dependenta'].includes(x.slug))) {
        const filename = `${d.slug}-${secLabel}.json`;
        const varName  = slugToVar(`${d.slug}-${secLabel}`);
        register(filename, varName, makeDataset({
            name:        `${d.name} (${secLabel})`,
            subtitle:    `${d.sub.replace('— RPL 2021', '')}mediu ${secLabel} — RPL 2021`,
            sectionData: sections[secKey],
            field:       d.field,
            palette,
            highIsBad:   d.highIsBad ?? false,
        }));
    }
}

process.stderr.write('\n── Add to src/preloadedDatasets/index.js ──\n');
process.stderr.write(imports.join('\n') + '\n\n');
process.stderr.write('// in the array:\n');
process.stderr.write(entries.map(e => `    ${e},`).join('\n') + '\n');
process.stderr.write('\nDone.\n');
