# scripts/ — Data preparation for recensamantromania.ro

Scripts for downloading, inspecting, and converting RPL 2021 census tables into
the JSON format used by the app's preloaded datasets.

## Prerequisites

These scripts use Node.js ESM (`.js` with `import`/`export`). Run them directly
with Node ≥ 18 — no extra install needed since `xlsx` is already a project dependency.

```
node scripts/<script>.js [options]
```

---

## Workflow

```
1. Browse the catalogue  →  catalogue.js --list
2. Download tables       →  download.js [tableIds…]
3. Inspect an Excel file →  inspect.js <file.xlsx>
4. Convert to JSON       →  convert.js <file.xlsx> --county-col N --value-col N ...
```

---

## Scripts

### `catalogue.js` — Browse available tables

Lists all known tables from recensamantromania.ro with their IDs, titles, and categories.

```bash
node scripts/catalogue.js            # print full catalogue
```

Output groups tables into categories:
- **demografie** — Population by sex, age, geography
- **etno-cultural** — Ethnicity, religion, mother tongue
- **educatie** — Education level, school attendance
- **mobilitate** — Residence changes, absences abroad
- **economic** — Active/inactive population, occupations
- **gospodarii** — Households by type and composition
- **locuinte** — Buildings, dwellings, heating, etc.

---

### `download.js` — Download Excel files

```bash
# Download everything
node scripts/download.js

# Download specific tables by ID
node scripts/download.js 1.01 1.02 2.01

# Download a whole category
node scripts/download.js --category demografie

# List available table IDs
node scripts/download.js --list

# Re-download even if file already exists
node scripts/download.js --overwrite 7.1
```

Files are saved to `scripts/downloads/Tabel-<id>.<ext>`.

---

### `inspect.js` — Understand an Excel file's structure

Before converting, use this to find which column holds county names and which
holds the values you want.

```bash
# Inspect the first sheet
node scripts/inspect.js scripts/downloads/Tabel-1_02.xlsx

# Inspect a specific sheet
node scripts/inspect.js scripts/downloads/Tabel-1_02.xlsx --sheet "Tabel 1.02"

# Show more rows / columns
node scripts/inspect.js scripts/downloads/Tabel-1_02.xlsx --rows 30 --cols 12
```

Output includes:
- All sheet names
- Sheet dimensions
- Auto-detected county column (with sample matches)
- A preview table of the first N rows × M cols
- A ready-to-copy `convert.js` command with the detected column indices

---

### `convert.js` — Convert an Excel table to a dataset JSON

```bash
node scripts/convert.js scripts/downloads/Tabel-1_02.xlsx \
  --sheet "Tabel 1.02" \
  --county-col 0 \
  --value-col 3 \
  --name "Populația stabilă" \
  --subtitle "Număr de locuitori pe județe — RPL 2021" \
  --out src/preloadedDatasets/populatie-stabila.json
```

| Option | Description |
|---|---|
| `--sheet <name>` | Sheet name (default: first sheet) |
| `--county-col <n>` | Column index (0-based) containing county names |
| `--value-col <n>` | Column index (0-based) containing numeric values |
| `--header-row <n>` | Row index of the header row (auto-skipped) |
| `--name <text>` | Dataset display name shown as map title |
| `--subtitle <text>` | Subtitle line |
| `--footer <text>` | Footer/source credit (default: `Sursa: RPL 2021 — INS`) |
| `--palette <id>` | `blue` \| `green` \| `red` \| `orange` \| `purple` |
| `--high-is-bad` | Invert palette semantics (higher = worse) |
| `--out <path>` | Output file path (default: print to stdout) |
| `--percent` | Round values to 2 decimal places |

After generating the JSON, register it in [src/preloadedDatasets/index.js](../src/preloadedDatasets/index.js).

---

### `utils/counties.js` — County name normalization

Utility used internally by `inspect.js` and `convert.js`. Handles:
- Diacritics (`Bistrița-Năsăud` → `Bistrita-Nasaud`)
- Cedilla vs. comma-below variants (`ş`/`ţ` vs. `ș`/`ț`)
- `Județul X` prefix form
- Common typos and OCR artifacts

---

## Example end-to-end

```bash
# 1. Download the education table
node scripts/download.js 3.01

# 2. See what's in it
node scripts/inspect.js scripts/downloads/Tabel-3_01.xlsx

# 3. Convert (assuming county = col 0, "higher education" = col 5)
node scripts/convert.js scripts/downloads/Tabel-3_01.xlsx \
  --county-col 0 --value-col 5 \
  --name "Studii superioare (%)" \
  --subtitle "Populația cu studii superioare pe județe — RPL 2021" \
  --palette blue \
  --percent \
  --out src/preloadedDatasets/studii-superioare.json

# 4. Register in index.js
# Add: import studiiSuperioare from './studii-superioare.json';
# Add to array: studiiSuperioare,
```
