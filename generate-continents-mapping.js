#!/usr/bin/env node
// One-time script to generate data/countries-continents.json
// Reads the GeoJSON (uncompressed) and matches countries from js/data.js
// Run: node generate-continents-mapping.js

import { readFileSync, writeFileSync } from 'fs';

// Extract country names from js/data.js
const dataJs = readFileSync('js/data.js', 'utf8');
const dataMatch = dataJs.match(/window\.DATA\s*=\s*(\[[\s\S]+?\]);/);
if (!dataMatch) throw new Error('Could not parse window.DATA from js/data.js');
const DATA = JSON.parse(dataMatch[1]);
const DATA_COUNTRIES = DATA.map(d => d.country);
console.log(`Countries in window.DATA: ${DATA_COUNTRIES.length}`);

// Read GeoJSON
const geojson = JSON.parse(readFileSync('data/ne_10m_admin_0_countries.geojson', 'utf8'));

// Build lookup maps from GeoJSON
const byAdmin = new Map();
const byName = new Map();

for (const f of geojson.features) {
  const p = f.properties;
  const continent = p.CONTINENT;
  if (p.ADMIN) byAdmin.set(p.ADMIN, continent);
  if (p.NAME) byName.set(p.NAME, continent);
}

// Known manual overrides (DATA name → GeoJSON ADMIN)
const OVERRIDES = {
  'United States': 'United States of America',
  'Congo': 'Republic of the Congo',
  'Tanzania': 'United Republic of Tanzania',
  'Vatican City': 'Vatican',
  'Bahamas': 'The Bahamas',
  'Serbia': 'Republic of Serbia',
  'Eswatini': 'eSwatini',
  'Democratic Republic of the Congo': 'Democratic Republic of the Congo', // exact match
  'Sao Tome and Principe': 'São Tomé and Principe',
};

// Map GeoJSON continent names to our standardized names
// "North America" and "South America" → "Americas"
function mapContinent(raw) {
  if (!raw) return null;
  if (raw === 'North America' || raw === 'South America') return 'Americas';
  if (raw === 'Seven seas (open ocean)') return null; // handled via MANUAL_CONTINENTS
  return raw; // Africa, Asia, Europe, Oceania, Antarctica
}

// Manual continent assignments for countries missing from or misclassified in GeoJSON
const MANUAL_CONTINENTS = {
  'Kosovo': 'Europe',
  'Palestine': 'Asia',
  'Taiwan': 'Asia',
  // GeoJSON puts these island nations under "Seven seas (open ocean)"
  'Seychelles': 'Africa',
  'Mauritius': 'Africa',
  'Maldives': 'Asia',
};

const result = {};
const missing = [];

for (const country of DATA_COUNTRIES) {
  if (MANUAL_CONTINENTS[country]) {
    result[country] = MANUAL_CONTINENTS[country];
    continue;
  }

  const lookupName = OVERRIDES[country] || country;
  let raw = byAdmin.get(lookupName) || byName.get(lookupName);

  if (!raw) {
    // Try partial match
    for (const [admin, cont] of byAdmin) {
      if (admin.includes(country) || country.includes(admin)) {
        raw = cont;
        break;
      }
    }
  }

  const continent = mapContinent(raw);
  if (continent) {
    result[country] = continent;
  } else {
    missing.push(country);
  }
}

console.log(`Mapped: ${Object.keys(result).length} / ${DATA_COUNTRIES.length}`);
if (missing.length > 0) {
  console.warn('Missing continent for:', missing);
}

// Sort alphabetically
const sorted = Object.fromEntries(
  Object.entries(result).sort(([a], [b]) => a.localeCompare(b))
);

writeFileSync('data/countries-continents.json', JSON.stringify(sorted, null, 2) + '\n');
console.log('Written: data/countries-continents.json');

// Summary
const counts = {};
for (const c of Object.values(sorted)) {
  counts[c] = (counts[c] || 0) + 1;
}
console.log('Continent counts:', counts);
