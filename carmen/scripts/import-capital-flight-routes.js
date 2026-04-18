#!/usr/bin/env node

/**
 * Offline import for Skyline Syndicate.
 *
 * The browser game reads only the generated JSON. This script transforms free
 * aviation datasets into a static, source-labeled route graph so API keys and
 * large raw datasets never ship to players.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const COUNTRIES_FILE = path.join(ROOT, 'data/countries.json');
const PLACES_FILE = path.join(ROOT, 'data/places.geojson');
const OUT_FILE = path.join(
  ROOT,
  'carmen/src/campaigns/skyline-syndicate/data/capital-flight-routes.json',
);
const REVIEW_FILE = path.join(
  ROOT,
  'carmen/src/campaigns/skyline-syndicate/data/airport-mapping-review.json',
);

const MIN_CHOICES = 3;
const MAX_CHOICES = 8;

function usage() {
  console.log([
    'Usage:',
    '  node carmen/scripts/import-capital-flight-routes.js --provider openflights \\',
    '    --ourairports-airports airports.csv --openflights-airports airports.dat --openflights-routes routes.dat',
    '  node carmen/scripts/import-capital-flight-routes.js --provider aviationstack --input routes.json',
    '  AVIATION_API_KEY=... node carmen/scripts/import-capital-flight-routes.js --provider aviationstack --fetch --max-pages 5',
    '',
    'Options:',
    '  --provider aviationstack|openflights',
    '  --input FILE                  Read a saved Aviationstack JSON response/export.',
    '  --fetch                       Fetch Aviationstack route pages.',
    '  --ourairports-airports FILE   OurAirports airports.csv for gateway matching.',
    '  --openflights-airports FILE   OpenFlights airports.dat.',
    '  --openflights-routes FILE     OpenFlights routes.dat.',
    '  --max-pages N                 Limit fetched pages. Default: 1.',
    '  --limit N                     Provider page size. Default: 100.',
    '  --dry-run                     Validate and print summary without writing files.',
    '',
    'Output:',
    `  ${path.relative(ROOT, OUT_FILE)}`,
    `  ${path.relative(ROOT, REVIEW_FILE)}`,
  ].join('\n'));
}

function parseArgs(argv) {
  const args = new Map();
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    args.set(argv[i].slice(2), argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true);
  }
  return args;
}

function normalizeName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function parseDelimitedLine(line) {
  const fields = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      fields.push(field === '\\N' ? '' : field);
      field = '';
    } else {
      field += ch;
    }
  }
  fields.push(field === '\\N' ? '' : field);
  return fields;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const headers = parseDelimitedLine(lines.shift());
  return lines.map(line => {
    const fields = parseDelimitedLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, fields[index] || '']));
  });
}

function parseOpenFlightsAirports(text) {
  return text.split(/\r?\n/).filter(Boolean).map(line => {
    const f = parseDelimitedLine(line);
    return {
      id: f[0],
      name: f[1],
      city: f[2],
      country: f[3],
      iata: f[4],
      icao: f[5],
      lat: Number(f[6]),
      lon: Number(f[7]),
    };
  });
}

function parseOpenFlightsRoutes(text) {
  return text.split(/\r?\n/).filter(Boolean).map(line => {
    const f = parseDelimitedLine(line);
    return {
      airline: f[0],
      source: f[2],
      sourceId: f[3],
      destination: f[4],
      destinationId: f[5],
      stops: Number(f[7] || 0),
    };
  });
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

async function readText(file) {
  return fs.readFile(path.resolve(ROOT, file), 'utf8');
}

function getFirst(record, paths) {
  for (const pathSpec of paths) {
    const parts = pathSpec.split('.');
    let value = record;
    for (const part of parts) value = value?.[part];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return '';
}

function distanceKm(a, b) {
  if (![a.lat, a.lon, b.lat, b.lon].every(Number.isFinite)) return Infinity;
  const r = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

function buildCapitalLookup(countries, places) {
  const admin0 = places.features
    .map(feature => feature.properties)
    .filter(props => props.FEATURECLA === 'Admin-0 capital');
  const byCountry = new Map(admin0.map(props => [normalizeName(props.ADM0NAME), props]));
  const byCapital = new Map(admin0.map(props => [normalizeName(props.NAMEASCII || props.NAME), props]));

  return countries
    .filter(country => country.un && country.capitals?.[0])
    .map(country => {
      const capital = country.capitals[0];
      const place = byCountry.get(normalizeName(country.country)) || byCapital.get(normalizeName(capital));
      return {
        country: country.country,
        capital,
        continent: country.continent,
        iso2: (country.flagCode || '').toUpperCase(),
        lat: place?.LATITUDE ?? null,
        lon: place?.LONGITUDE ?? null,
        timezone: place?.TIMEZONE ?? null,
      };
    });
}

function routeRecordsFromProviderPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.routes)) return payload.routes;
  throw new Error('Could not find route records. Expected an array, data[], or routes[].');
}

function normalizeAviationstackRecord(record) {
  return {
    fromCountryText: getFirst(record, ['departure.country', 'departure_country', 'dep_country', 'departure.country_name']),
    fromCityText: getFirst(record, ['departure.city', 'departure_city', 'dep_city', 'departure.airport', 'departure_airport']),
    fromAirport: getFirst(record, ['departure.airport', 'departure_airport', 'dep_airport']),
    fromIata: getFirst(record, ['departure.iata', 'departure.iataCode', 'departure_iata', 'dep_iata']),
    toCountryText: getFirst(record, ['arrival.country', 'arrival_country', 'arr_country', 'arrival.country_name']),
    toCityText: getFirst(record, ['arrival.city', 'arrival_city', 'arr_city', 'arrival.airport', 'arrival_airport']),
    toAirport: getFirst(record, ['arrival.airport', 'arrival_airport', 'arr_airport']),
    toIata: getFirst(record, ['arrival.iata', 'arrival.iataCode', 'arrival_iata', 'arr_iata']),
    airline: getFirst(record, ['airline.name', 'airline_name', 'airline']),
  };
}

function buildCountryIndexes(capitals) {
  return {
    byCountry: new Map(capitals.map(item => [normalizeName(item.country), item])),
    byCapital: new Map(capitals.map(item => [normalizeName(item.capital), item])),
  };
}

function findCapitalEndpoint(endpoint, indexes) {
  const country = indexes.byCountry.get(normalizeName(endpoint.countryText));
  if (!country) return null;

  const cityText = normalizeName(endpoint.cityText);
  const airportText = normalizeName(endpoint.airportText);
  const capitalText = normalizeName(country.capital);
  const isCapitalArea = cityText === capitalText || cityText.includes(capitalText) || airportText.includes(capitalText);
  return isCapitalArea ? country : null;
}

function normalizeAviationstackRoutes(records, capitals) {
  const indexes = buildCountryIndexes(capitals);
  const routes = new Map();
  const review = [];

  for (const raw of records) {
    const record = normalizeAviationstackRecord(raw);
    const from = findCapitalEndpoint({
      countryText: record.fromCountryText,
      cityText: record.fromCityText,
      airportText: record.fromAirport,
    }, indexes);
    const to = findCapitalEndpoint({
      countryText: record.toCountryText,
      cityText: record.toCityText,
      airportText: record.toAirport,
    }, indexes);

    if (!from || !to || from.country === to.country) {
      review.push({
        reason: !from && !to ? 'both-endpoints-not-capital-area' : !from ? 'origin-not-capital-area' : !to ? 'destination-not-capital-area' : 'domestic-route',
        fromCountryText: record.fromCountryText,
        fromCityText: record.fromCityText,
        fromAirport: record.fromAirport,
        fromIata: record.fromIata,
        toCountryText: record.toCountryText,
        toCityText: record.toCityText,
        toAirport: record.toAirport,
        toIata: record.toIata,
      });
      continue;
    }

    addRoute(routes, {
      from: from.country,
      to: to.country,
      source: 'aviationstack',
      confidence: 'current_provider',
      originCapital: from.capital,
      destinationCapital: to.capital,
      originAirports: [record.fromIata || record.fromAirport],
      destinationAirports: [record.toIata || record.toAirport],
      airlines: [record.airline],
    });
  }

  return { routes: sortedRoutes(routes), review, gateways: [] };
}

function airportTypeRank(type) {
  if (type === 'large_airport') return 0;
  if (type === 'medium_airport') return 1;
  if (type === 'small_airport') return 4;
  return 8;
}

function buildOurAirportsGateways(capitals, ourAirportsRows) {
  const airports = ourAirportsRows
    .filter(row => row.scheduled_service === 'yes')
    .filter(row => ['large_airport', 'medium_airport', 'small_airport'].includes(row.type))
    .map(row => ({
      ident: row.ident,
      type: row.type,
      name: row.name,
      municipality: row.municipality,
      isoCountry: row.iso_country,
      iata: row.iata_code,
      icao: row.icao_code || row.gps_code,
      lat: Number(row.latitude_deg),
      lon: Number(row.longitude_deg),
    }))
    .filter(airport => Number.isFinite(airport.lat) && Number.isFinite(airport.lon));

  const review = [];
  const gateways = capitals.map(capital => {
    const sameCountry = airports.filter(airport => airport.isoCountry === capital.iso2);
    const capitalPoint = { lat: capital.lat, lon: capital.lon };
    const score = airport => {
      const municipality = normalizeName(airport.municipality);
      const capitalName = normalizeName(capital.capital);
      const municipalityBonus = municipality === capitalName ? -80 : municipality.includes(capitalName) ? -45 : 0;
      return distanceKm(capitalPoint, airport) + airportTypeRank(airport.type) * 40 + municipalityBonus;
    };

    const chosen = sameCountry.sort((a, b) => score(a) - score(b))[0];
    const fallback = chosen || airports.slice().sort((a, b) => distanceKm(capitalPoint, a) - distanceKm(capitalPoint, b))[0];
    const kind = chosen ? 'ourairports_gateway' : 'external_gateway';
    const distance = Math.round(distanceKm(capitalPoint, fallback));

    if (!chosen) {
      review.push({
        reason: 'external-gateway-used',
        country: capital.country,
        capital: capital.capital,
        airport: fallback?.name || null,
        airportCountry: fallback?.isoCountry || null,
        distanceKm: distance,
      });
    }

    return {
      country: capital.country,
      capital: capital.capital,
      capitalLat: capital.lat,
      capitalLon: capital.lon,
      gatewayKind: kind,
      gatewayDistanceKm: distance,
      airport: fallback ? {
        ident: fallback.ident,
        name: fallback.name,
        municipality: fallback.municipality,
        type: fallback.type,
        isoCountry: fallback.isoCountry,
        iata: fallback.iata,
        icao: fallback.icao,
        lat: fallback.lat,
        lon: fallback.lon,
      } : null,
    };
  });

  return { gateways, review, airports };
}

function buildOpenFlightsIndexes(openFlightsAirports) {
  const byId = new Map();
  const byCode = new Map();
  for (const airport of openFlightsAirports) {
    byId.set(airport.id, airport);
    if (airport.iata) byCode.set(airport.iata, airport);
    if (airport.icao) byCode.set(airport.icao, airport);
  }
  return { byId, byCode };
}

function addRoute(routes, route) {
  if (!route.from || !route.to || route.from === route.to) return;
  const key = [route.from, route.to].sort().join('::');
  const existing = routes.get(key) || {
    from: route.from,
    to: route.to,
    bidirectional: true,
    source: route.source,
    confidence: route.confidence,
    originCapital: route.originCapital,
    destinationCapital: route.destinationCapital,
    originAirports: [],
    destinationAirports: [],
    airlines: [],
    routeCount: 0,
  };
  existing.originAirports = unique([...existing.originAirports, ...(route.originAirports || [])]);
  existing.destinationAirports = unique([...existing.destinationAirports, ...(route.destinationAirports || [])]);
  existing.airlines = unique([...existing.airlines, ...(route.airlines || [])]);
  existing.routeCount += route.routeCount || 1;
  if (existing.confidence !== 'historical_openflights') existing.confidence = route.confidence || existing.confidence;
  routes.set(key, existing);
}

function sortedRoutes(routes) {
  return [...routes.values()].sort((a, b) => `${a.from}${a.to}`.localeCompare(`${b.from}${b.to}`));
}

function normalizeOpenFlightsRoutes({ openFlightsAirports, openFlightsRoutes, gateways, capitals }) {
  const indexes = buildOpenFlightsIndexes(openFlightsAirports);
  const gatewaysByCountry = new Map(gateways.map(gateway => [gateway.country, gateway]));
  const gatewayByCode = new Map();
  for (const gateway of gateways) {
    for (const code of [gateway.airport?.iata, gateway.airport?.icao, gateway.airport?.ident].filter(Boolean)) {
      gatewayByCode.set(code, gateway);
    }
  }

  const routes = new Map();
  const review = [];
  for (const record of openFlightsRoutes) {
    if (record.stops !== 0) continue;
    const sourceAirport = indexes.byId.get(record.sourceId) || indexes.byCode.get(record.source);
    const destinationAirport = indexes.byId.get(record.destinationId) || indexes.byCode.get(record.destination);
    const fromGateway = gatewayByCode.get(sourceAirport?.iata) || gatewayByCode.get(sourceAirport?.icao);
    const toGateway = gatewayByCode.get(destinationAirport?.iata) || gatewayByCode.get(destinationAirport?.icao);

    if (!fromGateway || !toGateway || fromGateway.country === toGateway.country) {
      if (review.length < 1000) {
        review.push({
          reason: !fromGateway && !toGateway ? 'route-not-between-capital-gateways' : !fromGateway ? 'origin-not-capital-gateway' : !toGateway ? 'destination-not-capital-gateway' : 'domestic-route',
          source: record.source,
          destination: record.destination,
        });
      }
      continue;
    }

    addRoute(routes, {
      from: fromGateway.country,
      to: toGateway.country,
      source: 'openflights+ourairports',
      confidence: 'historical_openflights',
      originCapital: fromGateway.capital,
      destinationCapital: toGateway.capital,
      originAirports: [fromGateway.airport?.iata || fromGateway.airport?.icao || fromGateway.airport?.ident],
      destinationAirports: [toGateway.airport?.iata || toGateway.airport?.icao || toGateway.airport?.ident],
      airlines: [record.airline],
    });
  }

  addFallbackRoutes(routes, gateways, capitals);
  return { routes: sortedRoutes(routes), review, gateways };
}

function buildDegreeSummary(routes) {
  const degree = new Map();
  for (const route of routes) {
    degree.set(route.from, (degree.get(route.from) || 0) + 1);
    if (route.bidirectional !== false) degree.set(route.to, (degree.get(route.to) || 0) + 1);
  }
  return degree;
}

function addFallbackRoutes(routes, gateways, capitals) {
  const gatewayByCountry = new Map(gateways.map(gateway => [gateway.country, gateway]));
  const capitalByCountry = new Map(capitals.map(capital => [capital.country, capital]));

  for (const gateway of gateways) {
    let degree = buildDegreeSummary(sortedRoutes(routes)).get(gateway.country) || 0;
    if (degree >= MIN_CHOICES) continue;

    const candidates = gateways
      .filter(other => other.country !== gateway.country)
      .map(other => ({
        gateway: other,
        distance: distanceKm(
          { lat: gateway.airport?.lat ?? gateway.capitalLat, lon: gateway.airport?.lon ?? gateway.capitalLon },
          { lat: other.airport?.lat ?? other.capitalLat, lon: other.airport?.lon ?? other.capitalLon },
        ),
        sameContinent: capitalByCountry.get(other.country)?.continent === capitalByCountry.get(gateway.country)?.continent,
      }))
      .sort((a, b) => {
        if (a.sameContinent !== b.sameContinent) return a.sameContinent ? -1 : 1;
        return a.distance - b.distance;
      });

    for (const candidate of candidates) {
      if (degree >= MIN_CHOICES) break;
      const currentChoices = buildDegreeSummary(sortedRoutes(routes)).get(candidate.gateway.country) || 0;
      if (currentChoices >= MAX_CHOICES) continue;
      const fromCapital = capitalByCountry.get(gateway.country);
      const toCapital = capitalByCountry.get(candidate.gateway.country);
      addRoute(routes, {
        from: gateway.country,
        to: candidate.gateway.country,
        source: 'ourairports',
        confidence: 'inferred_fallback',
        originCapital: gateway.capital,
        destinationCapital: candidate.gateway.capital,
        originAirports: [gateway.airport?.iata || gateway.airport?.icao || gateway.airport?.ident],
        destinationAirports: [candidate.gateway.airport?.iata || candidate.gateway.airport?.icao || candidate.gateway.airport?.ident],
        airlines: [],
        distanceKm: Math.round(candidate.distance),
      });
      degree = buildDegreeSummary(sortedRoutes(routes)).get(gateway.country) || 0;
    }
  }
}

async function fetchAviationstackRoutes({ apiKey, limit, maxPages }) {
  const records = [];
  for (let page = 0; page < maxPages; page++) {
    const url = new URL('https://api.aviationstack.com/v1/routes');
    url.searchParams.set('access_key', apiKey);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('offset', String(page * limit));

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Aviationstack request failed: ${response.status} ${response.statusText}`);

    const payload = await response.json();
    const pageRecords = routeRecordsFromProviderPayload(payload);
    records.push(...pageRecords);
    if (pageRecords.length < limit) break;
  }
  return records;
}

async function loadAviationstackInput(args) {
  if (args.get('input')) {
    return routeRecordsFromProviderPayload(await readJson(path.resolve(ROOT, args.get('input'))));
  }
  if (args.has('fetch')) {
    if (!process.env.AVIATION_API_KEY) throw new Error('AVIATION_API_KEY is required when using --fetch.');
    return fetchAviationstackRoutes({
      apiKey: process.env.AVIATION_API_KEY,
      limit: Number(args.get('limit') || 100),
      maxPages: Number(args.get('max-pages') || 1),
    });
  }
  usage();
  throw new Error('Provide --input FILE or --fetch for aviationstack.');
}

async function normalizeOpenFlightsInput(args, capitals) {
  const ourAirportsFile = args.get('ourairports-airports');
  const openFlightsAirportsFile = args.get('openflights-airports');
  const openFlightsRoutesFile = args.get('openflights-routes');
  if (!ourAirportsFile || !openFlightsAirportsFile || !openFlightsRoutesFile) {
    usage();
    throw new Error('OpenFlights import requires --ourairports-airports, --openflights-airports, and --openflights-routes.');
  }

  const [ourAirportsRows, openFlightsAirports, openFlightsRoutes] = await Promise.all([
    readText(ourAirportsFile).then(parseCsv),
    readText(openFlightsAirportsFile).then(parseOpenFlightsAirports),
    readText(openFlightsRoutesFile).then(parseOpenFlightsRoutes),
  ]);

  const gatewayResult = buildOurAirportsGateways(capitals, ourAirportsRows);
  const routeResult = normalizeOpenFlightsRoutes({
    openFlightsAirports,
    openFlightsRoutes,
    gateways: gatewayResult.gateways,
    capitals,
  });
  return {
    ...routeResult,
    review: [...gatewayResult.review, ...routeResult.review],
    inputRecords: openFlightsRoutes.length,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.has('help')) {
    usage();
    return;
  }

  const provider = args.get('provider') || 'aviationstack';
  const dryRun = args.has('dry-run');
  const countries = await readJson(COUNTRIES_FILE);
  const places = await readJson(PLACES_FILE);
  const capitals = buildCapitalLookup(countries, places);

  let result;
  if (provider === 'aviationstack') {
    const records = await loadAviationstackInput(args);
    result = { ...normalizeAviationstackRoutes(records, capitals), inputRecords: records.length };
  } else if (provider === 'openflights') {
    result = await normalizeOpenFlightsInput(args, capitals);
  } else {
    throw new Error(`Unsupported provider "${provider}".`);
  }

  const degree = buildDegreeSummary(result.routes);
  const weakCountries = capitals
    .filter(country => (degree.get(country.country) || 0) < MIN_CHOICES)
    .map(country => ({
      country: country.country,
      capital: country.capital,
      degree: degree.get(country.country) || 0,
    }));

  const output = {
    schemaVersion: 1,
    campaign: 'skyline_syndicate',
    source: provider,
    importedAt: new Date().toISOString(),
    routeCount: result.routes.length,
    gateways: result.gateways || [],
    routes: result.routes,
  };
  const reviewOutput = {
    schemaVersion: 1,
    campaign: 'skyline_syndicate',
    importedAt: output.importedAt,
    summary: {
      provider,
      inputRecords: result.inputRecords,
      acceptedRoutes: result.routes.length,
      reviewRecords: result.review.length,
      countriesWithFewerThanThreeRoutes: weakCountries.length,
    },
    weakCountries,
    review: result.review.slice(0, 1000),
  };

  console.log(JSON.stringify(reviewOutput.summary, null, 2));

  if (!dryRun) {
    await fs.writeFile(OUT_FILE, `${JSON.stringify(output, null, 2)}\n`);
    await fs.writeFile(REVIEW_FILE, `${JSON.stringify(reviewOutput, null, 2)}\n`);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});

