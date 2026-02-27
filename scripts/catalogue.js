/**
 * Catalogue of known data tables from recensamantromania.ro (RPL 2021)
 * Each entry maps a table ID to its download URL and metadata.
 *
 * Base URL: https://www.recensamantromania.ro/
 */

const BASE_URL = 'https://www.recensamantromania.ro';

export const TABLES = {

  // ─── Volume 1: Demographic Characteristics ───────────────────────────────

  '1.01': {
    url: `${BASE_URL}/wp-content/uploads/2023/05/Tabel-1.01.xls`,
    title: 'Populația la recensămintele din 1948–2021',
    category: 'demografie',
    description: 'Population counted at each census (1948–2021)',
  },
  '1.02': {
    url: `${BASE_URL}/wp-content/uploads/2023/05/Tabel-1.02.xlsx`,
    title: 'Populația stabilă după sex și grupe de vârstă',
    category: 'demografie',
    description: 'Resident population by sex and age groups',
  },
  '1.22': {
    url: `${BASE_URL}/wp-content/uploads/2023/05/Tabel-1.22.xlsx`,
    title: 'Populația rezidentă pe unități administrative',
    category: 'demografie',
    description: 'Resident population by administrative divisions',
  },

  // ─── Volume 2: Ethno-Cultural Characteristics ────────────────────────────

  '2.01': {
    url: `${BASE_URL}/wp-content/uploads/2023/06/Tabel-2.01.xls`,
    title: 'Populația după etnie (1930–2021)',
    category: 'etno-cultural',
    description: 'Population by ethnicity across censuses (1930–2021)',
  },
  '2.02': {
    url: `${BASE_URL}/wp-content/uploads/2023/06/Tabel-2.02.1-si-Tabel-2.02.2.xlsx`,
    title: 'Populația rezidentă după etnie',
    category: 'etno-cultural',
    description: 'Resident population by ethnicity with regional breakdowns',
  },
  '2.04': {
    url: `${BASE_URL}/wp-content/uploads/2023/06/Tabel-2.04.1-si-Tabel-2.04.2.xlsx`,
    title: 'Populația după religie',
    category: 'etno-cultural',
    description: 'Population by religion',
  },

  // ─── Volume 3: Educational Characteristics ───────────────────────────────

  '3.01': {
    url: `${BASE_URL}/wp-content/uploads/2023/07/Tabel-3.01.xlsx`,
    title: 'Populația după nivelul de instruire',
    category: 'educatie',
    description: 'Population by education level',
  },
  '3.08': {
    url: `${BASE_URL}/wp-content/uploads/2023/06/Tabel-3.08.xlsx`,
    title: 'Populația de 2 ani și peste care frecventează o unitate de învățământ',
    category: 'educatie',
    description: 'Population aged 2+ attending educational institutions',
  },

  // ─── Volume 4: Population Mobility ──────────────────────────────────────

  '4.1': {
    url: `${BASE_URL}/wp-content/uploads/2023/09/Tabel-4.1.xlsx`,
    title: 'Persoane care și-au schimbat reședința pe județe',
    category: 'mobilitate',
    description: 'Persons who changed residence by county',
  },
  '4.9': {
    url: `${BASE_URL}/wp-content/uploads/2023/09/Tabel-4.9.xlsx`,
    title: 'Absențe temporare în străinătate pe țări de destinație',
    category: 'mobilitate',
    description: 'Temporary absences abroad by destination country',
  },

  // ─── Volume 5: Economic Characteristics ─────────────────────────────────

  '5.01': {
    url: `${BASE_URL}/wp-content/uploads/2023/10/Tabel_5.01.xlsx`,
    title: 'Populația activă și inactivă',
    category: 'economic',
    description: 'Active and inactive population',
  },
  '5.27': {
    url: `${BASE_URL}/wp-content/uploads/2023/10/Tabel-5.27.xlsx`,
    title: 'Populația ocupată pe activități economice',
    category: 'economic',
    description: 'Employed population by economic activities',
  },
  '5.29': {
    url: `${BASE_URL}/wp-content/uploads/2024/08/Tabel_5.29.xlsx`,
    title: 'Populația activă/inactivă pe localități',
    category: 'economic',
    description: 'Active/inactive population by localities',
  },

  // ─── Volume 6: Households ────────────────────────────────────────────────

  '6.1': {
    url: `${BASE_URL}/wp-content/uploads/2025/05/Tabel-6.1.xlsx`,
    title: 'Gospodăriile după tip și componență',
    category: 'gospodarii',
    description: 'Households by type and composition',
  },
  '6.13': {
    url: `${BASE_URL}/wp-content/uploads/2025/05/Tabel-6.13.xlsx`,
    title: 'Locuințe convenționale după caracteristici gospodărești',
    category: 'gospodarii',
    description: 'Conventional dwellings by household characteristics',
  },

  // ─── Volume 7: Buildings ─────────────────────────────────────────────────

  '7.1': {
    url: `${BASE_URL}/wp-content/uploads/2026/02/RPL2021_Tabel-7.1.xlsx`,
    title: 'Clădiri, locuințe, camere și suprafețe',
    category: 'locuinte',
    description: 'Buildings, dwellings, rooms, and surfaces (REVISED)',
  },

  // ─── Volume 8: Housing Conditions ───────────────────────────────────────

  '8.1': {
    url: `${BASE_URL}/wp-content/uploads/2025/04/Tabel-8.1.xlsx`,
    title: 'Locuințe convenționale după tipul clădirii',
    category: 'locuinte',
    description: 'Conventional dwellings by building type (REVISED)',
  },
  '8.9': {
    url: `${BASE_URL}/wp-content/uploads/2026/02/RPL2021_Tabel-8.9.xlsx`,
    title: 'Locuințe după sursa de încălzire',
    category: 'locuinte',
    description: 'Dwellings by heating method (REVISED)',
  },
};

/** All available category names */
export const CATEGORIES = [...new Set(Object.values(TABLES).map(t => t.category))];

/** Get all tables for a given category */
export function getByCategory(category) {
  return Object.fromEntries(
    Object.entries(TABLES).filter(([, t]) => t.category === category)
  );
}

/** Print a summary of all tables to stdout */
export function printCatalogue() {
  for (const category of CATEGORIES) {
    console.log(`\n── ${category.toUpperCase()} ──`);
    for (const [id, table] of Object.entries(getByCategory(category))) {
      console.log(`  [${id}] ${table.title}`);
      console.log(`        ${table.description}`);
    }
  }
}

// Run directly: node scripts/catalogue.js
if (process.argv[1].endsWith('catalogue.js')) {
  printCatalogue();
}
