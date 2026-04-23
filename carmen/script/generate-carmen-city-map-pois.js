/**
 * Generate static OSM placement points for City Map Open Case investigation pins.
 *
 * The output is used for map placement only. It should not be used as gameplay
 * clue truth without human curation.
 *
 * Usage:
 *   node carmen/script/generate-carmen-city-map-pois.js
 *   node carmen/script/generate-carmen-city-map-pois.js --limit 10
 *   node carmen/script/generate-carmen-city-map-pois.js --refresh --delay 1200
 *   node carmen/script/generate-carmen-city-map-pois.js --offline
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..', '..');
const FLIGHT_ROUTES_PATH = path.join(ROOT, 'data', 'capital-flight-routes.json');
const COUNTRIES_PATH = path.join(ROOT, 'data', 'countries.json');
const OUTPUT_PATH = path.join(ROOT, 'data', 'carmen-city-map-pois.json');
const CACHE_DIR = path.join(ROOT, 'data', 'generated-cache', 'carmen-city-map-pois');

const USER_AGENT = 'GeoQuiz/1.0 (Carmen city map POI generator; https://geoquiz.info)';
const DEFAULT_DELAY_MS = 1100;
const DEFAULT_RADIUS_METERS = 8000;

const LOCATION_QUERIES = {
  hotel: [
    'node["tourism"="hotel"]',
    'node["tourism"="hostel"]',
    'node["tourism"="guest_house"]',
  ],
  market: [
    'nw["amenity"="marketplace"]',
    'nw["shop"="marketplace"]',
  ],
  library: [
    'nw["amenity"="library"]',
  ],
  embassy: [
    'nw["amenity"="embassy"]',
    'nw["office"="diplomatic"]',
    'nw["diplomatic"]',
  ],
};

function parseArgs(argv) {
  const args = {
    limit: 0,
    refresh: false,
    offline: false,
    delayMs: DEFAULT_DELAY_MS,
    radiusMeters: DEFAULT_RADIUS_METERS,
    batchSize: 20,
    countries: null,
    allCities: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--refresh') args.refresh = true;
    else if (arg === '--offline') args.offline = true;
    else if (arg === '--limit') args.limit = Number.parseInt(argv[++i] || '0', 10) || 0;
    else if (arg.startsWith('--limit=')) args.limit = Number.parseInt(arg.slice('--limit='.length), 10) || 0;
    else if (arg === '--delay') args.delayMs = parseNonNegativeInt(argv[++i], DEFAULT_DELAY_MS);
    else if (arg.startsWith('--delay=')) args.delayMs = parseNonNegativeInt(arg.slice('--delay='.length), DEFAULT_DELAY_MS);
    else if (arg === '--radius') args.radiusMeters = parseNonNegativeInt(argv[++i], DEFAULT_RADIUS_METERS);
    else if (arg.startsWith('--radius=')) args.radiusMeters = parseNonNegativeInt(arg.slice('--radius='.length), 10) || DEFAULT_RADIUS_METERS;
    else if (arg === '--batch-size') args.batchSize = parseNonNegativeInt(argv[++i], 20) || 20;
    else if (arg.startsWith('--batch-size=')) args.batchSize = parseNonNegativeInt(arg.slice('--batch-size='.length), 10) || 20;
    else if (arg === '--countries') args.countries = String(argv[++i] || '').split(',').map(s => s.trim()).filter(Boolean);
    else if (arg.startsWith('--countries=')) args.countries = arg.slice('--countries='.length).split(',').map(s => s.trim()).filter(Boolean);
    else if (arg === '--all-cities') args.allCities = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function parseNonNegativeInt(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function slugify(text) {
  return String(text || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'unknown';
}

function cachePath(cacheKey) {
  return path.join(CACHE_DIR, `${slugify(cacheKey)}.json`);
}

function readCache(cacheKey) {
  const filePath = cachePath(cacheKey);
  if (!fs.existsSync(filePath)) return null;
  return readJson(filePath);
}

function writeCache(cacheKey, data) {
  writeJson(cachePath(cacheKey), data);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function requestText(url, options = {}) {
  const method = options.method || 'GET';
  const body = options.body || null;
  const headers = {
    'User-Agent': USER_AGENT,
    'Accept': 'application/json',
    ...options.headers,
  };
  if (body) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=utf-8';
    headers['Content-Length'] = Buffer.byteLength(body);
  }
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method, headers }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 240)}`));
          return;
        }
        resolve(data);
      });
    });
    req.on('error', reject);
    req.setTimeout(45000, () => req.destroy(new Error(`Request timed out: ${url}`)));
    if (body) req.write(body);
    req.end();
  });
}

async function requestJson(url, options = {}, attempts = 3) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return JSON.parse(await requestText(url, options));
    } catch (err) {
      lastError = err;
      const retryable = /HTTP (429|5\d\d)|timed out|ECONNRESET|ETIMEDOUT/i.test(err.message);
      if (!retryable || attempt === attempts) break;
      await sleep(2500 * attempt);
    }
  }
  throw lastError;
}

function buildCapitalRows(flightRoutes) {
  return (flightRoutes.gateways || [])
    .filter(gateway => gateway?.country && Number.isFinite(gateway.capitalLat) && Number.isFinite(gateway.capitalLon))
    .map(gateway => ({
      cacheKey: `${gateway.country}::${gateway.capital}`,
      kind: 'capital',
      country: gateway.country,
      city: gateway.capital,
      capital: gateway.capital,
      lat: gateway.capitalLat,
      lon: gateway.capitalLon,
    }))
    .sort((a, b) => a.country.localeCompare(b.country));
}

function buildCityRows(countries) {
  const rows = [];
  for (const countryData of countries || []) {
    const country = countryData?.country;
    if (!country) continue;
    const capital = countryData?.capitals?.[0] || '';
    for (const city of countryData?.cities || []) {
      if (!city?.name || !Number.isFinite(city.lat) || !Number.isFinite(city.lon)) continue;
      if (city.name === capital) continue;
      rows.push({
        cacheKey: `${country}::${city.name}`,
        kind: 'city',
        country,
        city: city.name,
        capital,
        lat: Number(city.lat),
        lon: Number(city.lon),
      });
    }
  }
  return rows.sort((a, b) => a.country.localeCompare(b.country) || a.city.localeCompare(b.city));
}

function buildOverpassQuery(row, radiusMeters) {
  const around = `${radiusMeters},${row.lat},${row.lon}`;
  const selectors = Object.values(LOCATION_QUERIES)
    .flat()
    .map(selector => `${selector}(around:${around});`)
    .join('\n');
  return `[out:json][timeout:35];(${selectors});out center tags;`;
}

async function fetchOsm(row, options) {
  if (!options.refresh) {
    const cached = readCache(row.cacheKey);
    if (cached) return cached;
  }
  if (options.offline) throw new Error('no cached OSM response');
  const body = new URLSearchParams({ data: buildOverpassQuery(row, options.radiusMeters) }).toString();
  const data = await requestJson('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body,
  });
  const result = { elements: data.elements || [] };
  writeCache(row.cacheKey, result);
  return result;
}

async function fetchOsmBatch(rows, options) {
  if (!options.refresh) {
    const cachedByKey = {};
    const missing = [];
    for (const row of rows) {
      const cached = readCache(row.cacheKey);
      if (cached) cachedByKey[row.cacheKey] = cached;
      else missing.push(row);
    }
    if (!missing.length) return cachedByKey;
    if (options.offline) {
      for (const row of missing) cachedByKey[row.cacheKey] = { elements: [] };
      return cachedByKey;
    }
  }
  if (options.offline) {
    return Object.fromEntries(rows.map(row => [row.cacheKey, { elements: [] }]));
  }

  const selectors = rows.flatMap(row => {
    const around = `${options.radiusMeters},${row.lat},${row.lon}`;
    return Object.values(LOCATION_QUERIES)
      .flat()
      .map(selector => `${selector}(around:${around});`);
  }).join('\n');
  const query = `[out:json][timeout:90];(${selectors});out center tags;`;
  const body = new URLSearchParams({ data: query }).toString();
  const data = await requestJson('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body,
  });
  const grouped = Object.fromEntries(rows.map(row => [row.cacheKey, { elements: [] }]));
  const seenByKey = Object.fromEntries(rows.map(row => [row.cacheKey, new Set()]));
  for (const element of data.elements || []) {
    const lat = Number(element.lat ?? element.center?.lat);
    const lon = Number(element.lon ?? element.center?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    let nearest = null;
    let nearestKm = Infinity;
    for (const row of rows) {
      const distanceKm = haversineKm(row, { lat, lon });
      if (distanceKm < nearestKm) {
        nearest = row;
        nearestKm = distanceKm;
      }
    }
    if (!nearest || nearestKm > options.radiusMeters / 1000) continue;
    const key = `${element.type}/${element.id}`;
    if (seenByKey[nearest.cacheKey].has(key)) continue;
    seenByKey[nearest.cacheKey].add(key);
    grouped[nearest.cacheKey].elements.push(element);
  }
  for (const row of rows) writeCache(row.cacheKey, grouped[row.cacheKey]);
  return grouped;
}

function toRad(deg) {
  return deg * Math.PI / 180;
}

function haversineKm(a, b) {
  const radius = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}

function classifyElement(element) {
  const tags = element.tags || {};
  if (tags.amenity === 'library') return 'library';
  if (tags.amenity === 'marketplace' || tags.shop === 'marketplace') return 'market';
  if (tags.amenity === 'embassy' || tags.office === 'diplomatic' || tags.diplomatic) return 'embassy';
  if (['hotel', 'hostel', 'guest_house'].includes(tags.tourism)) return 'hotel';
  const name = String(tags.name || '');
  if (tags.building === 'retail' && /market|bazaar|mercado|souk/i.test(name)) return 'market';
  return null;
}

function confidenceFor(locationId, tags) {
  if (locationId === 'library' && tags.amenity === 'library') return 'high';
  if (locationId === 'market' && (tags.amenity === 'marketplace' || tags.shop === 'marketplace')) return 'high';
  if (locationId === 'embassy' && (tags.amenity === 'embassy' || tags.office === 'diplomatic')) return 'high';
  if (locationId === 'hotel' && tags.tourism === 'hotel') return 'high';
  return 'medium';
}

function scoreCandidate(candidate) {
  const namedBonus = candidate.name ? 120 : 0;
  const confidenceBonus = candidate.confidence === 'high' ? 90 : 35;
  return namedBonus + confidenceBonus - candidate.distanceKm * 8;
}

function pickPois(row, osm) {
  const candidatesByLocation = {
    hotel: [],
    market: [],
    library: [],
    embassy: [],
  };
  for (const element of osm.elements || []) {
    const locationId = classifyElement(element);
    if (!locationId) continue;
    const lat = Number(element.lat ?? element.center?.lat);
    const lon = Number(element.lon ?? element.center?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const tags = element.tags || {};
    const candidate = {
      locationId,
      name: tags.name || '',
      lat,
      lon,
      source: 'osm',
      osmId: `${element.type}/${element.id}`,
      confidence: confidenceFor(locationId, tags),
      distanceKm: Math.round(haversineKm(row, { lat, lon }) * 10) / 10,
      tags: compactTags(tags),
    };
    candidatesByLocation[locationId].push(candidate);
  }

  return Object.fromEntries(
    Object.entries(candidatesByLocation).map(([locationId, candidates]) => {
      candidates.sort((a, b) => scoreCandidate(b) - scoreCandidate(a));
      const best = candidates[0] || null;
      return [locationId, best];
    })
  );
}

function compactTags(tags) {
  const keys = ['name', 'amenity', 'tourism', 'shop', 'office', 'diplomatic', 'building'];
  return Object.fromEntries(keys.filter(key => tags[key]).map(key => [key, tags[key]]));
}

function countPois(entries) {
  let realPins = 0;
  let missingPins = 0;
  for (const entry of entries) {
    for (const poi of Object.values(entry?.pois || {})) {
      if (poi) realPins++;
      else missingPins++;
    }
  }
  return { realPins, missingPins };
}

function buildStats(capitals, cities) {
  const capitalEntries = Object.values(capitals || {});
  const cityEntries = Object.values(cities || {}).flatMap(countryEntries => Object.values(countryEntries || {}));
  const counts = countPois(capitalEntries.concat(cityEntries));
  return {
    rows: capitalEntries.length + cityEntries.length,
    capitals: capitalEntries.length,
    cities: cityEntries.length,
    realPins: counts.realPins,
    missingPins: counts.missingPins,
  };
}

async function main() {
  const options = parseArgs(process.argv);
  const flightRoutes = readJson(FLIGHT_ROUTES_PATH);
  const countries = readJson(COUNTRIES_PATH);
  let rows = buildCapitalRows(flightRoutes);
  if (options.allCities) rows = rows.concat(buildCityRows(countries));
  if (options.countries?.length) {
    const wanted = new Set(options.countries.map(country => country.toLowerCase()));
    rows = rows.filter(row =>
      wanted.has(row.country.toLowerCase()) ||
      wanted.has(String(row.city || '').toLowerCase()) ||
      wanted.has(String(row.capital || '').toLowerCase())
    );
  }
  if (options.limit) rows = rows.slice(0, options.limit);

  const mergeExisting = !!(options.countries?.length || options.limit);
  const existing = mergeExisting && fs.existsSync(OUTPUT_PATH) ? readJson(OUTPUT_PATH) : null;
  const capitals = existing?.capitals ? { ...existing.capitals } : {};
  const cities = existing?.cities ? { ...existing.cities } : {};
  for (let start = 0; start < rows.length; start += options.batchSize) {
    const batch = rows.slice(start, start + options.batchSize);
    const end = start + batch.length;
    process.stdout.write(`[${start + 1}-${end}/${rows.length}] ${batch[0].country} → ${batch[batch.length - 1].country}... `);
    let batchData = null;
    try {
      batchData = await fetchOsmBatch(batch, options);
      process.stdout.write('ok\n');
    } catch (err) {
      process.stdout.write(`batch failed: ${err.message}\n`);
      batchData = {};
      for (const row of batch) {
        try {
          batchData[row.country] = await fetchOsm(row, options);
          process.stdout.write(`  ${row.country}: ok\n`);
        } catch (rowErr) {
          batchData[row.country] = { elements: [] };
          process.stdout.write(`  ${row.country}: failed: ${rowErr.message}\n`);
        }
        if (options.delayMs) await sleep(options.delayMs);
      }
    }

    for (const row of batch) {
      const osm = batchData[row.cacheKey] || { elements: [] };
      const pois = pickPois(row, osm);
      const entry = {
        country: row.country,
        city: row.city,
        capital: row.capital,
        lat: row.lat,
        lon: row.lon,
        pois,
      };
      if (row.kind === 'capital') {
        capitals[row.country] = entry;
      } else {
        cities[row.country] ||= {};
        cities[row.country][row.city] = entry;
      }
    }
    if (options.delayMs && end < rows.length) await sleep(options.delayMs);
  }

  const stats = buildStats(capitals, cities);
  writeJson(OUTPUT_PATH, {
    schemaVersion: 2,
    source: {
      generatedAt: new Date().toISOString(),
      capitalFlightRoutes: 'data/capital-flight-routes.json',
      countries: 'data/countries.json',
      osm: 'https://overpass-api.de',
      radiusMeters: options.radiusMeters,
      usage: 'Map placement only; not gameplay clue truth.',
    },
    stats,
    capitals,
    cities,
  });
  console.log(`Wrote ${OUTPUT_PATH}`);
  console.log(stats);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
