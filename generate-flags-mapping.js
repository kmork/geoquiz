/**
 * generate-flags-mapping.js
 * One-time script to extract country name → ISO_A2 mapping from GeoJSON.
 * Run with: node generate-flags-mapping.js
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Load pako equivalent using Node's built-in zlib
const dataPath = path.join(__dirname, 'data', 'ne_10m_admin_0_countries.geojson.gz');
const compressed = fs.readFileSync(dataPath);
const decompressed = zlib.gunzipSync(compressed);
const geojson = JSON.parse(decompressed.toString('utf8'));

// Hardcoded overrides for countries with missing/invalid ISO codes or name mismatches
const OVERRIDES = {
  'Kosovo': 'xk',
  'Western Sahara': 'eh',
  'Taiwan': 'tw',
  // Name mismatches between window.DATA and GeoJSON ADMIN field
  'Bahamas': 'bs',
  'Congo': 'cg',
  "Côte d'Ivoire": 'ci',
  'Eswatini': 'sz',
  'Micronesia': 'fm',
  'Sao Tome and Principe': 'st',
  'Serbia': 'rs',
  'Tanzania': 'tz',
  'Timor-Leste': 'tl',
  'United States': 'us',
  'Vatican City': 'va',
};

const mapping = {};

for (const feature of geojson.features) {
  const props = feature.properties;
  const name = props.ADMIN || props.NAME;
  if (!name) continue;

  // Check override first
  if (OVERRIDES[name]) {
    mapping[name] = OVERRIDES[name];
    continue;
  }

  // Use ISO_A2, fall back to ISO_A2_EH if -99
  let iso = props.ISO_A2;
  if (!iso || iso === '-99' || iso.trim() === '') {
    iso = props.ISO_A2_EH;
  }
  if (!iso || iso === '-99' || iso.trim() === '') continue;

  mapping[name] = iso.toLowerCase();
}

// Always apply all overrides to the mapping (handles name mismatches with window.DATA)
for (const [name, iso] of Object.entries(OVERRIDES)) {
  mapping[name] = iso;
}

const outputPath = path.join(__dirname, 'data', 'countries-flags.json');
fs.writeFileSync(outputPath, JSON.stringify(mapping, null, 2));
console.log(`Written ${Object.keys(mapping).length} entries to ${outputPath}`);
