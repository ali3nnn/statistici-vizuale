#!/usr/bin/env node
/**
 * generate-uat-datasets.js — Run parse-uat-population.js and produce preloaded
 * dataset JSON files for the app.
 *
 * Usage:
 *   node scripts/generate-uat-datasets.js
 *
 * Creates:
 *   src/preloadedDatasets/concentrare-centre-populate.json
 *   src/preloadedDatasets/numar-uat-total.json
 *   src/preloadedDatasets/numar-uat-mari.json
 */

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// ── Run the parse script ────────────────────────────────────────────────────

const raw = execSync(
    `node ${resolve(__dirname, 'parse-uat-population.js')} ${resolve(__dirname, 'downloads/Tabel-1.22.xlsx')}`,
    { cwd: root }
).toString();

const parsed = JSON.parse(raw);

// ── Helpers ─────────────────────────────────────────────────────────────────

const DISPLAY = {
    '4x5':  { showCode: true, showValue: true, labelSize: '11' },
    '9x16': { showCode: true, showValue: true, labelSize: '9'  },
};

const LEGEND = { '4x5': 'vertical', '9x16': 'vertical' };

function makeDataset({ name, subtitle, field, palette, highIsBad = false, normMode = 'none' }) {
    const values = {};
    let min = Infinity, max = -Infinity;

    for (const [county, v] of Object.entries(parsed)) {
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
                title:    { innerHTML: name,    textAlign: '', top: '' },
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
    process.stderr.write(`Written → ${dest}\n`);
}

// ── Dataset 1: % of population in UATs with >10,000 residents ───────────────
// Shows how concentrated each county's population is in larger urban centres.
// Conceptually different from grad-urbanizare (official urban/rural boundary).

save('concentrare-centre-populate.json', makeDataset({
    name:     'Concentrarea în centre populate (%)',
    subtitle: 'Locuitorii din UAT-uri cu >10.000 locuitori (% din total județ) — RPL 2021',
    field:    'bigUATPct',
    palette:  { name: 'Orange', hue: 30, id: 'orange' },
    highIsBad: false,
    normMode: 'none',
}));

// ── Dataset 2: Total number of UATs per county ───────────────────────────────
// Reveals the degree of administrative fragmentation county by county.

save('numar-uat-total.json', makeDataset({
    name:     'Numărul de UAT-uri',
    subtitle: 'Comune, orașe și municipii per județ — RPL 2021',
    field:    v => v.bigUATCount + v.restUATCount,
    palette:  { name: 'Purple', hue: 270, id: 'purple' },
    highIsBad: false,
    normMode: 'none',
}));

// ── Dataset 3: Number of large UATs (>10,000 residents) per county ───────────
// Shows which counties have many large towns vs. counties dominated by a
// single city.

save('numar-uat-mari.json', makeDataset({
    name:     'UAT-uri cu peste 10.000 de locuitori',
    subtitle: 'Număr de comune/orașe/municipii cu >10.000 loc. — RPL 2021',
    field:    'bigUATCount',
    palette:  { name: 'Blue', hue: 220, id: 'blue' },
    highIsBad: false,
    normMode: 'none',
}));

// ── Dataset 4: Absolute population in large UATs (>10,000 residents) ─────────
// Total number of residents living in large towns/cities per county.

save('populatie-uat-mari.json', makeDataset({
    name:     'Populația din localitățile mari',
    subtitle: 'Locuitori în UAT-uri cu >10.000 loc. pe județe — RPL 2021',
    field:    'bigUAT',
    palette:  { name: 'Blue', hue: 220, id: 'blue' },
    highIsBad: false,
    normMode: 'logarithmic',
}));

// ── Dataset 5: % of population in small UATs (<10,000 residents) ─────────────
// Inverse of concentrare-centre-populate — shows the rural/dispersed share.

save('pondere-uat-mici.json', makeDataset({
    name:     'Ponderea populației rurale (%)',
    subtitle: 'Locuitorii din UAT-uri cu ≤10.000 loc. (% din total județ) — RPL 2021',
    field:    'restPct',
    palette:  { name: 'Green', hue: 130, id: 'green' },
    highIsBad: false,
    normMode: 'none',
}));

process.stderr.write('Done.\n');
