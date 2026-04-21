#!/usr/bin/env node
// One-time script to merge country data from 4 sources into data/countries.json
// Usage: node script/generate-countries-json.js

import { readFileSync, writeFileSync, readdirSync } from 'fs';

// 1. Parse data.js to extract the DATA array (194 UN countries)
const dataJs = readFileSync('js/data.js', 'utf8');
const match = dataJs.match(/window\.DATA\s*=\s*(\[[\s\S]*?\]);/);
if (!match) throw new Error('Could not parse window.DATA from js/data.js');
const dataCountries = JSON.parse(match[1]);

// 2. Load the 3 JSON files
const continents = JSON.parse(readFileSync('data/countries-continents.json', 'utf8'));
const flags = JSON.parse(readFileSync('data/countries-flags.json', 'utf8'));
const neighbors = JSON.parse(readFileSync('data/countries-neighbors.json', 'utf8'));

// 3. Build name mapping for flags file (some use different names)
const flagNameMap = {
  'United Republic of Tanzania': 'Tanzania',
  'Republic of the Congo': 'Congo',
  'Republic of Serbia': 'Serbia',
  'eSwatini': 'Eswatini',
  'Ivory Coast': "Côte d'Ivoire",
  'East Timor': 'Timor-Leste',
  'United States of America': 'United States',
  'The Bahamas': 'Bahamas',
  'Vatican': 'Vatican City',
  'São Tomé and Principe': 'Sao Tome and Principe',
  'Federated States of Micronesia': 'Micronesia',
  'Hong Kong S.A.R.': 'Hong Kong',
  'Macao S.A.R': 'Macao',
};

// Build a canonical flag lookup keyed by data.js names
const flagLookup = {};
for (const [name, code] of Object.entries(flags)) {
  const canonical = flagNameMap[name] || name;
  // Don't overwrite if already set (aliases at bottom of file duplicate some)
  if (!flagLookup[canonical]) {
    flagLookup[canonical] = code;
  }
}

// 4. Get available flag SVGs to determine valid territories
const flagSvgs = new Set(
  readdirSync('img/flags')
    .filter(f => f.endsWith('.svg'))
    .map(f => f.replace('.svg', ''))
);

// 5. Build UN country entries
const unCountryNames = new Set(dataCountries.map(c => c.country));
const result = [];

for (const c of dataCountries) {
  result.push({
    country: c.country,
    capitals: c.capitals,
    continent: continents[c.country] || null,
    flagCode: flagLookup[c.country] || null,
    neighbors: neighbors[c.country] || [],
    un: true,
  });
}

// 6. Add territory entries (un: false) from flags file
// Skip non-place entries and entries already covered by UN countries
const skipEntries = new Set([
  'Baykonur Cosmodrome',
  'Coral Sea Islands',
  'Ashmore and Cartier Islands',
  'Indian Ocean Territories',
  'Brazilian Island',
  'Heard Island and McDonald Islands',
  'United States Minor Outlying Islands',
  'French Southern and Antarctic Lands',
  'Antarctica',
  'South Georgia and the Islands',
  'Clipperton Island',
  'Pitcairn Islands',
]);

// Also skip aliases that are already in the UN set (bottom of flags file)
// These are duplicate entries with data.js canonical names
const processedNames = new Set(unCountryNames);

// Territory capitals (best-effort)
const territoryCapitals = {
  'Kosovo': ['Pristina'],
  'Palestine': ['Ramallah'],
  'Taiwan': ['Taipei'],
  'Hong Kong': ['Hong Kong'],
  'Macao': ['Macao'],
  'Greenland': ['Nuuk'],
  'Puerto Rico': ['San Juan'],
  'Western Sahara': ['Laayoune'],
  'New Caledonia': ['Nouméa'],
  'French Polynesia': ['Papeete'],
  'Guam': ['Hagåtña'],
  'Curaçao': ['Willemstad'],
  'Aruba': ['Oranjestad'],
  'Turks and Caicos Islands': ['Cockburn Town'],
  'Cayman Islands': ['George Town'],
  'Bermuda': ['Hamilton'],
  'Gibraltar': ['Gibraltar'],
  'Faroe Islands': ['Tórshavn'],
  'Isle of Man': ['Douglas'],
  'Jersey': ['Saint Helier'],
  'Guernsey': ['Saint Peter Port'],
  'Aland': ['Mariehamn'],
  'American Samoa': ['Pago Pago'],
  'Northern Mariana Islands': ['Saipan'],
  'United States Virgin Islands': ['Charlotte Amalie'],
  'British Virgin Islands': ['Road Town'],
  'Montserrat': ['Brades'],
  'Anguilla': ['The Valley'],
  'Saint Barthelemy': ['Gustavia'],
  'Saint Martin': ['Marigot'],
  'Sint Maarten': ['Philipsburg'],
  'Saint Pierre and Miquelon': ['Saint-Pierre'],
  'Saint Helena': ['Jamestown'],
  'Norfolk Island': ['Kingston'],
  'Niue': ['Alofi'],
  'Cook Islands': ['Avarua'],
  'Wallis and Futuna': ['Mata-Utu'],
  'British Indian Ocean Territory': ['Diego Garcia'],
  'Falkland Islands': ['Stanley'],
};

// Territory continents (best-effort)
const territoryContinents = {
  'Kosovo': 'Europe',
  'Palestine': 'Asia',
  'Taiwan': 'Asia',
  'Hong Kong': 'Asia',
  'Macao': 'Asia',
  'Greenland': 'Americas',
  'Puerto Rico': 'Americas',
  'Western Sahara': 'Africa',
  'New Caledonia': 'Oceania',
  'French Polynesia': 'Oceania',
  'Guam': 'Oceania',
  'Curaçao': 'Americas',
  'Aruba': 'Americas',
  'Turks and Caicos Islands': 'Americas',
  'Cayman Islands': 'Americas',
  'Bermuda': 'Americas',
  'Gibraltar': 'Europe',
  'Faroe Islands': 'Europe',
  'Isle of Man': 'Europe',
  'Jersey': 'Europe',
  'Guernsey': 'Europe',
  'Aland': 'Europe',
  'American Samoa': 'Oceania',
  'Northern Mariana Islands': 'Oceania',
  'United States Virgin Islands': 'Americas',
  'British Virgin Islands': 'Americas',
  'Montserrat': 'Americas',
  'Anguilla': 'Americas',
  'Saint Barthelemy': 'Americas',
  'Saint Martin': 'Americas',
  'Sint Maarten': 'Americas',
  'Saint Pierre and Miquelon': 'Americas',
  'Saint Helena': 'Africa',
  'Norfolk Island': 'Oceania',
  'Niue': 'Oceania',
  'Cook Islands': 'Oceania',
  'Wallis and Futuna': 'Oceania',
  'British Indian Ocean Territory': 'Africa',
  'Falkland Islands': 'Americas',
};

for (const [rawName, code] of Object.entries(flags)) {
  const canonical = flagNameMap[rawName] || rawName;
  if (processedNames.has(canonical)) continue;
  if (skipEntries.has(rawName)) continue;
  if (!flagSvgs.has(code)) continue; // No SVG available

  processedNames.add(canonical);
  result.push({
    country: canonical,
    capitals: territoryCapitals[canonical] || [],
    continent: territoryContinents[canonical] || null,
    flagCode: code,
    neighbors: neighbors[canonical] || [],
    un: false,
  });
}

// 7. Sort alphabetically
result.sort((a, b) => a.country.localeCompare(b.country));

// 8. Write output
writeFileSync('data/countries.json', JSON.stringify(result, null, 2) + '\n');

const unCount = result.filter(c => c.un).length;
const territoryCount = result.filter(c => !c.un).length;
console.log(`Generated data/countries.json: ${result.length} entries (${unCount} UN + ${territoryCount} territories)`);

// Validation
const missingContinent = result.filter(c => !c.continent);
if (missingContinent.length) {
  console.warn('Missing continent:', missingContinent.map(c => c.country));
}
const missingFlag = result.filter(c => !c.flagCode);
if (missingFlag.length) {
  console.warn('Missing flagCode:', missingFlag.map(c => c.country));
}
