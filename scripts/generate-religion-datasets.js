#!/usr/bin/env node
/**
 * generate-religion-datasets.js — Read Tabel-2_04.xlsx (Tab 2.4.1) and produce
 * preloaded dataset JSON files for each major religion: absolute count + % of
 * county population.
 *
 * Column map (0-based, Tab 2.4.1):
 *   0  = county name
 *   1  = total population
 *   2  = Ortodoxă
 *   3  = Romano-Catolică
 *   4  = Reformată
 *   5  = Penticostală
 *   6  = Greco-Catolică
 *   7  = Baptistă
 *   8  = Adventistă de Ziua a Șaptea
 *   9  = Musulmană
 *  10  = Unitariană
 *  11  = Martorii lui Iehova
 *  12  = Creștina după Evanghelie
 *  13  = Creștina de Rit Vechi
 *  14  = Evanghelică Lutherană
 *  15  = Ortodoxă Sârbă
 *  16  = Evanghelică (Română)
 *  17  = Evanghelică de Confesiune Augustană
 *  18  = Mozaică
 *  19  = Armeană
 *  20  = Altă religie
 *  21  = Fără religie
 *  22  = Ateu
 *  23  = Agnostic
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';
import { normalizeCountyName } from './utils/counties.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root      = resolve(__dirname, '..');

// ── Read Excel ───────────────────────────────────────────────────────────────

const buf  = readFileSync(resolve(__dirname, 'downloads/Tabel-2_04.xlsx'));
const wb   = XLSX.read(buf, { type: 'buffer' });
const sheet = wb.Sheets['Tab 2.4.1'];
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
    const raw = cellStr(0, r);
    const stripped = raw.replace(/^MUNICIPIUL\s+/i, '').trim();
    const county = normalizeCountyName(raw) ?? normalizeCountyName(stripped);
    if (!county) continue;

    const total = cellNum(1, r);
    if (!total) continue;

    counties[county] = {
        total,
        ortodoxa:        cellNum(2,  r),
        romano_catolica: cellNum(3,  r),
        reformata:       cellNum(4,  r),
        penticostala:    cellNum(5,  r),
        greco_catolica:  cellNum(6,  r),
        baptista:        cellNum(7,  r),
        adventista:      cellNum(8,  r),
        musulmana:       cellNum(9,  r),
        unitariana:      cellNum(10, r),
        martorii_iehova:        cellNum(11, r),
        crestina_evanghelie:    cellNum(12, r),
        crestina_rit_vechi:     cellNum(13, r),
        evanghelica_lutherana:  cellNum(14, r),
        ortodoxa_sarba:         cellNum(15, r),
        evanghelica:            cellNum(16, r),
        evanghelica_augustana:  cellNum(17, r),
        mozaica:                cellNum(18, r),
        armeana:                cellNum(19, r),
        alta_religie:           cellNum(20, r),
        fara_religie:           cellNum(21, r),
        ateu:            cellNum(22, r),
        agnostic:        cellNum(23, r),
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

// ── Religion definitions ─────────────────────────────────────────────────────

const religions = [
    {
        key:    'ortodoxa',
        slug:   'ortodoxa',
        name:   'Populația ortodoxă',
        pctName:'Ortodocși (%)',
        sub:    'Număr de ortodocși pe județe — RPL 2021',
        subPct: 'Procentul populației ortodoxe pe județe — RPL 2021',
        palette: { name: 'Blue',   hue: 220, id: 'blue'   },
        normAbs: 'logarithmic',
        normPct: 'none',
    },
    {
        key:    'romano_catolica',
        slug:   'romano-catolica',
        name:   'Populația romano-catolică',
        pctName:'Romano-Catolici (%)',
        sub:    'Număr de romano-catolici pe județe — RPL 2021',
        subPct: 'Procentul populației romano-catolice pe județe — RPL 2021',
        palette: { name: 'Purple', hue: 270, id: 'purple' },
        normAbs: 'logarithmic',
        normPct: 'logarithmic',
    },
    {
        key:    'reformata',
        slug:   'reformata',
        name:   'Populația reformată',
        pctName:'Reformați (%)',
        sub:    'Număr de reformați pe județe — RPL 2021',
        subPct: 'Procentul populației reformate pe județe — RPL 2021',
        palette: { name: 'Orange', hue: 30,  id: 'orange' },
        normAbs: 'logarithmic',
        normPct: 'logarithmic',
    },
    {
        key:    'penticostala',
        slug:   'penticostala',
        name:   'Populația penticostală',
        pctName:'Penticostali (%)',
        sub:    'Număr de penticostali pe județe — RPL 2021',
        subPct: 'Procentul populației penticostale pe județe — RPL 2021',
        palette: { name: 'Red',    hue: 0,   id: 'red'    },
        normAbs: 'logarithmic',
        normPct: 'logarithmic',
    },
    {
        key:    'greco_catolica',
        slug:   'greco-catolica',
        name:   'Populația greco-catolică',
        pctName:'Greco-Catolici (%)',
        sub:    'Număr de greco-catolici pe județe — RPL 2021',
        subPct: 'Procentul populației greco-catolice pe județe — RPL 2021',
        palette: { name: 'Green',  hue: 130, id: 'green'  },
        normAbs: 'logarithmic',
        normPct: 'logarithmic',
    },
    {
        key:    'baptista',
        slug:   'baptista',
        name:   'Populația baptistă',
        pctName:'Baptiști (%)',
        sub:    'Număr de baptiști pe județe — RPL 2021',
        subPct: 'Procentul populației baptiste pe județe — RPL 2021',
        palette: { name: 'Blue',   hue: 220, id: 'blue'   },
        normAbs: 'logarithmic',
        normPct: 'logarithmic',
    },
    {
        key:    'musulmana',
        slug:   'musulmana',
        name:   'Populația musulmană',
        pctName:'Musulmani (%)',
        sub:    'Număr de musulmani pe județe — RPL 2021',
        subPct: 'Procentul populației musulmane pe județe — RPL 2021',
        palette: { name: 'Orange', hue: 30,  id: 'orange' },
        normAbs: 'logarithmic',
        normPct: 'logarithmic',
    },
    {
        key:    'unitariana',
        slug:   'unitariana',
        name:   'Populația unitariană',
        pctName:'Unitarieni (%)',
        sub:    'Număr de unitarieni pe județe — RPL 2021',
        subPct: 'Procentul populației unitariene pe județe — RPL 2021',
        palette: { name: 'Purple', hue: 270, id: 'purple' },
        normAbs: 'logarithmic',
        normPct: 'logarithmic',
    },
    {
        key:    'adventista',
        slug:   'adventista',
        name:   'Populația adventistă',
        pctName:'Adventiști (%)',
        sub:    'Număr de adventiști de ziua a șaptea pe județe — RPL 2021',
        subPct: 'Procentul populației adventiste pe județe — RPL 2021',
        palette: { name: 'Green',  hue: 160, id: 'green'  },
        normAbs: 'logarithmic',
        normPct: 'logarithmic',
    },
    {
        key:    'martorii_iehova',
        slug:   'martorii-iehova',
        name:   'Martorii lui Iehova',
        pctName:'Martorii lui Iehova (%)',
        sub:    'Număr de Martori ai lui Iehova pe județe — RPL 2021',
        subPct: 'Procentul Martorilor lui Iehova pe județe — RPL 2021',
        palette: { name: 'Purple', hue: 300, id: 'purple' },
        normAbs: 'logarithmic',
        normPct: 'logarithmic',
    },
    {
        key:    'crestina_evanghelie',
        slug:   'crestina-evanghelie',
        name:   'Creștini după Evanghelie',
        pctName:'Creștini după Evanghelie (%)',
        sub:    'Număr de creștini după Evanghelie pe județe — RPL 2021',
        subPct: 'Procentul creștinilor după Evanghelie pe județe — RPL 2021',
        palette: { name: 'Blue',   hue: 200, id: 'blue'   },
        normAbs: 'logarithmic',
        normPct: 'logarithmic',
    },
    {
        key:    'crestina_rit_vechi',
        slug:   'crestina-rit-vechi',
        name:   'Creștini de Rit Vechi',
        pctName:'Creștini de Rit Vechi (%)',
        sub:    'Număr de creștini de rit vechi pe județe — RPL 2021',
        subPct: 'Procentul creștinilor de rit vechi pe județe — RPL 2021',
        palette: { name: 'Orange', hue: 25,  id: 'orange' },
        normAbs: 'logarithmic',
        normPct: 'logarithmic',
    },
    {
        key:    'evanghelica_lutherana',
        slug:   'evanghelica-lutherana',
        name:   'Populația evanghelică lutherană',
        pctName:'Evanghelici Lutherani (%)',
        sub:    'Număr de evanghelici lutherani pe județe — RPL 2021',
        subPct: 'Procentul populației evanghelice lutherane pe județe — RPL 2021',
        palette: { name: 'Blue',   hue: 240, id: 'blue'   },
        normAbs: 'logarithmic',
        normPct: 'logarithmic',
    },
    {
        key:    'ortodoxa_sarba',
        slug:   'ortodoxa-sarba',
        name:   'Populația ortodoxă sârbă',
        pctName:'Ortodocși Sârbi (%)',
        sub:    'Număr de ortodocși sârbi pe județe — RPL 2021',
        subPct: 'Procentul populației ortodoxe sârbe pe județe — RPL 2021',
        palette: { name: 'Blue',   hue: 215, id: 'blue'   },
        normAbs: 'logarithmic',
        normPct: 'logarithmic',
    },
    {
        key:    'evanghelica',
        slug:   'evanghelica',
        name:   'Populația evanghelică română',
        pctName:'Evanghelici Români (%)',
        sub:    'Număr de evanghelici români pe județe — RPL 2021',
        subPct: 'Procentul populației evanghelice române pe județe — RPL 2021',
        palette: { name: 'Green',  hue: 150, id: 'green'  },
        normAbs: 'logarithmic',
        normPct: 'logarithmic',
    },
    {
        key:    'evanghelica_augustana',
        slug:   'evanghelica-augustana',
        name:   'Populația evanghelică de Confesiune Augustană',
        pctName:'Evanghelici de Conf. Augustană (%)',
        sub:    'Număr de evanghelici de Confesiune Augustană pe județe — RPL 2021',
        subPct: 'Procentul populației evanghelice de Confesiune Augustană pe județe — RPL 2021',
        palette: { name: 'Purple', hue: 260, id: 'purple' },
        normAbs: 'logarithmic',
        normPct: 'logarithmic',
    },
    {
        key:    'mozaica',
        slug:   'mozaica',
        name:   'Populația mozaică',
        pctName:'Mozaici (%)',
        sub:    'Număr de persoane de religie mozaică pe județe — RPL 2021',
        subPct: 'Procentul populației mozaice pe județe — RPL 2021',
        palette: { name: 'Orange', hue: 50,  id: 'orange' },
        normAbs: 'logarithmic',
        normPct: 'logarithmic',
    },
    {
        key:    'armeana',
        slug:   'armeana',
        name:   'Populația armeană',
        pctName:'Armeni (%)',
        sub:    'Număr de persoane de religie armeană pe județe — RPL 2021',
        subPct: 'Procentul populației de religie armeană pe județe — RPL 2021',
        palette: { name: 'Red',    hue: 350, id: 'red'    },
        normAbs: 'logarithmic',
        normPct: 'logarithmic',
    },
    {
        key:    'alta_religie',
        slug:   'alta-religie',
        name:   'Alte religii',
        pctName:'Alte religii (%)',
        sub:    'Număr de persoane aparținând altor religii pe județe — RPL 2021',
        subPct: 'Procentul persoanelor aparținând altor religii pe județe — RPL 2021',
        palette: { name: 'Green',  hue: 90,  id: 'green'  },
        normAbs: 'logarithmic',
        normPct: 'logarithmic',
    },
    {
        key:    'fara_religie',
        slug:   'fara-religie',
        name:   'Fără religie declarată',
        pctName:'Fără religie (%)',
        sub:    'Număr de persoane fără religie declarată pe județe — RPL 2021',
        subPct: 'Procentul persoanelor fără religie declarată pe județe — RPL 2021',
        palette: { name: 'Red',    hue: 0,   id: 'red'    },
        normAbs: 'logarithmic',
        normPct: 'logarithmic',
    },
    {
        key:    'ateu',
        slug:   'ateu',
        name:   'Populația atee',
        pctName:'Atei (%)',
        sub:    'Număr de atei pe județe — RPL 2021',
        subPct: 'Procentul populației atee pe județe — RPL 2021',
        palette: { name: 'Red',    hue: 15,  id: 'red'    },
        normAbs: 'logarithmic',
        normPct: 'logarithmic',
    },
    {
        key:    'agnostic',
        slug:   'agnostic',
        name:   'Populația agnostică',
        pctName:'Agnostici (%)',
        sub:    'Număr de agnostici pe județe — RPL 2021',
        subPct: 'Procentul populației agnostice pe județe — RPL 2021',
        palette: { name: 'Purple', hue: 195, id: 'purple' },
        normAbs: 'logarithmic',
        normPct: 'logarithmic',
    },
];

// ── Generate datasets ────────────────────────────────────────────────────────

const imports = [];
const entries = [];

for (const r of religions) {
    const absFile = `religie-${r.slug}.json`;
    const pctFile = `religie-${r.slug}-pct.json`;
    const absVar  = `religie${r.slug.replace(/-/g, '_').replace(/^./, c => c.toUpperCase()).replace(/_(.)/g, (_, c) => c.toUpperCase())}`;
    const pctVar  = absVar + 'Pct';

    save(absFile, makeDataset({
        name:     r.name,
        subtitle: r.sub,
        field:    r.key,
        palette:  r.palette,
        normMode: r.normAbs,
    }));

    save(pctFile, makeDataset({
        name:     r.pctName,
        subtitle: r.subPct,
        field:    v => pct(v[r.key], v.total),
        palette:  r.palette,
        normMode: r.normPct,
    }));

    imports.push(`import ${absVar} from './${absFile}';`);
    imports.push(`import ${pctVar} from './${pctFile}';`);
    entries.push(absVar, pctVar);
}

process.stderr.write('\n── Add to src/preloadedDatasets/index.js ──\n');
process.stderr.write(imports.join('\n') + '\n\n');
process.stderr.write('// in the array:\n');
process.stderr.write(entries.map(e => `    ${e},`).join('\n') + '\n');
process.stderr.write('\nDone.\n');
