#!/usr/bin/env node

/**
 * Fetch and normalize source data for Carmen World Case Files.
 *
 * This importer intentionally keeps raw source responses separate from the
 * smaller browser-facing JSON files. Wikidata/Commons source data supports
 * curation and candidate matching; curated case files remain gameplay truth.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const SEEDS_PATH = path.join(ROOT, 'data', 'carmen-world-cultural-seeds.json');
const COUNTRIES_PATH = path.join(ROOT, 'data', 'countries.json');
const CACHE_DIR = path.join(ROOT, 'data', 'generated-cache', 'carmen-world-case-files');
const OUTPUT_OBJECTS = path.join(ROOT, 'data', 'carmen-world-cultural-objects.json');
const OUTPUT_PLACES = path.join(ROOT, 'data', 'carmen-world-cultural-places.json');
const OUTPUT_VOCAB = path.join(ROOT, 'data', 'carmen-world-cultural-vocab.json');
const OUTPUT_INDEX = path.join(ROOT, 'data', 'carmen-world-candidate-index.json');
const OUTPUT_ATTRIBUTIONS = path.join(ROOT, 'data', 'carmen-world-source-attributions.json');

const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const USER_AGENT = 'GeoQuiz/1.0 World Case Files importer (https://geoquiz.info)';

const CLAIMS = {
  image: 'P18',
  creator: 'P170',
  collection: 'P195',
  location: 'P276',
  country: 'P17',
  countryOfOrigin: 'P495',
  inception: 'P571',
  pointInTime: 'P585',
  material: 'P186',
  genre: 'P136',
  movement: 'P135',
  instanceOf: 'P31',
  depicts: 'P180',
  locationOfCreation: 'P1071',
  inventoryNumber: 'P217',
  coordinate: 'P625',
  officialWebsite: 'P856',
};

function cachePath(name) {
  return path.join(CACHE_DIR, name);
}

function cacheName(prefix, value) {
  const hash = crypto.createHash('sha1').update(value).digest('hex').slice(0, 16);
  return `${prefix}-${hash}.json`;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

async function fetchJson(url, cacheName) {
  const filePath = cachePath(cacheName);
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    // continue
  }
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': USER_AGENT,
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const data = await res.json();
  await writeJson(filePath, data);
  return data;
}

function entityLabel(entity, fallback = '') {
  return entity?.labels?.en?.value || fallback || entity?.id || '';
}

function getClaims(entity, prop) {
  return entity?.claims?.[prop] || [];
}

function dataValue(claim) {
  return claim?.mainsnak?.datavalue?.value;
}

function entityIdsFromClaims(entity, props) {
  const ids = new Set();
  for (const prop of props) {
    for (const claim of getClaims(entity, prop)) {
      const value = dataValue(claim);
      if (value?.['entity-type'] === 'item' && Number.isFinite(value['numeric-id'])) {
        ids.add(`Q${value['numeric-id']}`);
      }
    }
  }
  return [...ids];
}

function stringClaims(entity, prop) {
  return getClaims(entity, prop)
    .map(claim => dataValue(claim))
    .filter(value => typeof value === 'string');
}

function firstStringClaim(entity, prop) {
  return stringClaims(entity, prop)[0] || '';
}

function firstImage(entity) {
  return firstStringClaim(entity, CLAIMS.image);
}

function firstCoordinate(entity) {
  for (const claim of getClaims(entity, CLAIMS.coordinate)) {
    const value = dataValue(claim);
    if (Number.isFinite(value?.latitude) && Number.isFinite(value?.longitude)) {
      return { lat: value.latitude, lon: value.longitude };
    }
  }
  return null;
}

function firstTime(entity, prop) {
  for (const claim of getClaims(entity, prop)) {
    const value = dataValue(claim);
    if (typeof value?.time === 'string') return value.time.replace(/^\+/, '');
  }
  return '';
}

function compact(values) {
  return [...new Set(values.filter(Boolean))];
}

function commonsTitle(fileName) {
  if (!fileName) return '';
  return fileName.startsWith('File:') ? fileName : `File:${fileName}`;
}

async function fetchWikidataEntities(ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  const entities = {};
  for (let i = 0; i < unique.length; i += 50) {
    const batch = unique.slice(i, i + 50);
    const params = new URLSearchParams({
      action: 'wbgetentities',
      ids: batch.join('|'),
      props: 'labels|descriptions|claims|sitelinks',
      languages: 'en',
      format: 'json',
      origin: '*',
    });
    const data = await fetchJson(`${WIKIDATA_API}?${params}`, cacheName('wikidata-entities', batch.join('|')));
    Object.assign(entities, data.entities || {});
  }
  return entities;
}

async function fetchCommonsMetadata(fileNames) {
  const result = {};
  const titles = [...new Set(fileNames.filter(Boolean).map(commonsTitle))];
  for (let i = 0; i < titles.length; i += 20) {
    const batch = titles.slice(i, i + 20);
    const params = new URLSearchParams({
      action: 'query',
      titles: batch.join('|'),
      prop: 'imageinfo',
      iiprop: 'url|extmetadata',
      format: 'json',
      origin: '*',
    });
    const data = await fetchJson(`${COMMONS_API}?${params}`, cacheName('commons', batch.join('|')));
    for (const page of Object.values(data.query?.pages || {})) {
      const info = page.imageinfo?.[0];
      if (!info) continue;
      result[page.title.replace(/^File:/, '')] = {
        title: page.title,
        url: info.url || '',
        descriptionUrl: info.descriptionurl || '',
        licenseShortName: info.extmetadata?.LicenseShortName?.value || '',
        licenseUrl: info.extmetadata?.LicenseUrl?.value || '',
        artist: info.extmetadata?.Artist?.value || '',
        credit: info.extmetadata?.Credit?.value || '',
        usageTerms: info.extmetadata?.UsageTerms?.value || '',
      };
    }
  }
  return result;
}

function labelsFor(ids, entities) {
  return compact(ids.map(id => entityLabel(entities[id], id)));
}

function buildObject(seedCase, entity, entities, commons) {
  const relatedIds = {
    creators: entityIdsFromClaims(entity, [CLAIMS.creator]),
    collections: entityIdsFromClaims(entity, [CLAIMS.collection]),
    locations: entityIdsFromClaims(entity, [CLAIMS.location]),
    countries: entityIdsFromClaims(entity, [CLAIMS.country, CLAIMS.countryOfOrigin]),
    materials: entityIdsFromClaims(entity, [CLAIMS.material]),
    genres: entityIdsFromClaims(entity, [CLAIMS.genre]),
    movements: entityIdsFromClaims(entity, [CLAIMS.movement]),
    types: entityIdsFromClaims(entity, [CLAIMS.instanceOf]),
    depicts: entityIdsFromClaims(entity, [CLAIMS.depicts]),
    creationPlaces: entityIdsFromClaims(entity, [CLAIMS.locationOfCreation]),
  };
  const imageName = firstImage(entity);
  const imageMeta = commons[imageName] || null;
  return {
    id: seedCase.id,
    title: entityLabel(entity, seedCase.object.label),
    wikidataId: entity.id,
    description: entity.descriptions?.en?.value || '',
    caseTitle: seedCase.title,
    pattern: seedCase.pattern,
    creator: labelsFor(relatedIds.creators, entities),
    movement: labelsFor(relatedIds.movements, entities),
    objectType: labelsFor(relatedIds.types, entities),
    materials: labelsFor(relatedIds.materials, entities),
    genre: labelsFor(relatedIds.genres, entities),
    depicts: labelsFor(relatedIds.depicts, entities),
    creationPlace: labelsFor(relatedIds.creationPlaces, entities),
    countries: labelsFor(relatedIds.countries, entities),
    currentInstitution: labelsFor(relatedIds.collections, entities),
    currentLocation: labelsFor(relatedIds.locations, entities),
    inventoryId: firstStringClaim(entity, CLAIMS.inventoryNumber),
    dateCreated: firstTime(entity, CLAIMS.inception) || firstTime(entity, CLAIMS.pointInTime),
    sourceUrls: {
      wikidata: `https://www.wikidata.org/wiki/${entity.id}`,
      commons: imageMeta?.descriptionUrl || '',
    },
    image: imageName ? {
      commonsFile: imageName,
      url: imageMeta?.url || '',
      licenseShortName: imageMeta?.licenseShortName || '',
      licenseUrl: imageMeta?.licenseUrl || '',
      credit: imageMeta?.credit || imageMeta?.artist || '',
    } : null,
  };
}

function buildPlace(seedCase, placeSeed, entity) {
  const coord = firstCoordinate(entity);
  return {
    id: `${seedCase.id}-${placeSeed.role}-${entity.id}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name: entityLabel(entity, placeSeed.label),
    wikidataId: entity.id,
    description: entity.descriptions?.en?.value || '',
    role: placeSeed.role,
    caseId: seedCase.id,
    caseTitle: seedCase.title,
    city: placeSeed.city || '',
    country: placeSeed.country || '',
    lat: coord?.lat ?? null,
    lon: coord?.lon ?? null,
    sourceUrls: {
      wikidata: `https://www.wikidata.org/wiki/${entity.id}`,
    },
  };
}

function buildVocab(objects, places) {
  const terms = new Map();
  const add = (term, kind, sourceId) => {
    if (!term) return;
    const key = `${kind}:${term}`;
    const entry = terms.get(key) || { term, kind, sourceIds: [] };
    entry.sourceIds = compact([...entry.sourceIds, sourceId]);
    terms.set(key, entry);
  };
  for (const object of objects) {
    for (const term of object.movement || []) add(term, 'movement', object.wikidataId);
    for (const term of object.materials || []) add(term, 'material', object.wikidataId);
    for (const term of object.objectType || []) add(term, 'object_type', object.wikidataId);
    for (const term of object.genre || []) add(term, 'genre', object.wikidataId);
    for (const term of object.creator || []) add(term, 'creator', object.wikidataId);
    add(object.pattern, 'case_pattern', object.id);
  }
  for (const place of places) {
    add(place.name, 'cultural_place', place.wikidataId);
    add(place.role, 'case_place_role', place.id);
  }
  return {
    schemaVersion: 1,
    source: { generatedBy: 'carmen/script/import-world-cultural-data.mjs' },
    terms: [...terms.values()].sort((a, b) => a.kind.localeCompare(b.kind) || a.term.localeCompare(b.term)),
  };
}

function buildCandidateIndex(countries, objects, places) {
  const byCountry = Object.fromEntries(countries.map(country => [country.country, {
    country: country.country,
    capital: country.capitals?.[0] || '',
    majorCities: (country.cities || []).map(city => city.name),
    continent: country.continent || '',
    exports: country.exports || [],
    climate: country.climate || '',
    famousFor: country.famousFor || [],
    culturalTags: [],
    culturalObjects: [],
    culturalPlaces: [],
    caseIds: [],
  }]));

  for (const place of places) {
    const entry = byCountry[place.country];
    if (!entry) continue;
    entry.culturalPlaces.push({
      name: place.name,
      city: place.city,
      role: place.role,
      wikidataId: place.wikidataId,
      lat: place.lat,
      lon: place.lon,
    });
    entry.culturalTags.push(place.name, place.role);
    entry.caseIds.push(place.caseId);
  }

  for (const object of objects) {
    const relatedCountries = new Set();
    for (const place of places.filter(place => place.caseId === object.id)) relatedCountries.add(place.country);
    for (const countryName of object.countries || []) relatedCountries.add(countryName);
    for (const countryName of relatedCountries) {
      const entry = byCountry[countryName];
      if (!entry) continue;
      entry.culturalObjects.push({
        title: object.title,
        wikidataId: object.wikidataId,
        pattern: object.pattern,
      });
      entry.culturalTags.push(
        object.title,
        object.pattern,
        ...object.creator,
        ...object.movement,
        ...object.objectType,
        ...object.materials,
        ...object.genre,
      );
      entry.caseIds.push(object.id);
    }
  }

  for (const entry of Object.values(byCountry)) {
    entry.culturalTags = compact(entry.culturalTags).sort();
    entry.caseIds = compact(entry.caseIds).sort();
  }

  return {
    schemaVersion: 1,
    source: { generatedBy: 'carmen/script/import-world-cultural-data.mjs' },
    countries: byCountry,
  };
}

function buildAttributions(objects) {
  return {
    schemaVersion: 1,
    sources: [
      {
        id: 'wikidata',
        name: 'Wikidata',
        license: 'CC0',
        url: 'https://www.wikidata.org',
        usedFor: ['object metadata', 'place metadata', 'creator and vocabulary links'],
      },
      {
        id: 'wikimedia-commons',
        name: 'Wikimedia Commons',
        license: 'per-file; see image entries',
        url: 'https://commons.wikimedia.org',
        usedFor: ['image URLs', 'image license metadata', 'image attribution'],
      },
      {
        id: 'openstreetmap',
        name: 'OpenStreetMap',
        license: 'ODbL',
        url: 'https://www.openstreetmap.org',
        usedFor: ['map tiles', 'city POI placement'],
      },
    ],
    images: objects
      .filter(object => object.image)
      .map(object => ({
        objectId: object.id,
        title: object.title,
        commonsFile: object.image.commonsFile,
        licenseShortName: object.image.licenseShortName,
        licenseUrl: object.image.licenseUrl,
        credit: object.image.credit,
        sourceUrl: object.sourceUrls.commons,
      })),
  };
}

async function main() {
  const seeds = await readJson(SEEDS_PATH);
  const countries = await readJson(COUNTRIES_PATH);
  await fs.mkdir(CACHE_DIR, { recursive: true });

  const seedEntityIds = new Set();
  for (const seedCase of seeds.cases || []) {
    seedEntityIds.add(seedCase.object.wikidataId);
    for (const place of seedCase.places || []) seedEntityIds.add(place.wikidataId);
  }

  const seedEntities = await fetchWikidataEntities([...seedEntityIds]);
  const referencedIds = new Set();
  for (const entity of Object.values(seedEntities)) {
    for (const id of entityIdsFromClaims(entity, [
      CLAIMS.creator,
      CLAIMS.collection,
      CLAIMS.location,
      CLAIMS.country,
      CLAIMS.countryOfOrigin,
      CLAIMS.material,
      CLAIMS.genre,
      CLAIMS.movement,
      CLAIMS.instanceOf,
      CLAIMS.depicts,
      CLAIMS.locationOfCreation,
    ])) {
      referencedIds.add(id);
    }
  }
  const referencedEntities = await fetchWikidataEntities([...referencedIds]);
  const entities = { ...seedEntities, ...referencedEntities };

  const imageNames = Object.values(seedEntities).map(firstImage).filter(Boolean);
  const commons = await fetchCommonsMetadata(imageNames);

  const objects = [];
  const places = [];
  for (const seedCase of seeds.cases || []) {
    const objectEntity = entities[seedCase.object.wikidataId];
    if (!objectEntity) throw new Error(`Missing object entity ${seedCase.object.wikidataId}`);
    objects.push(buildObject(seedCase, objectEntity, entities, commons));
    for (const placeSeed of seedCase.places || []) {
      const placeEntity = entities[placeSeed.wikidataId];
      if (!placeEntity) throw new Error(`Missing place entity ${placeSeed.wikidataId}`);
      places.push(buildPlace(seedCase, placeSeed, placeEntity));
    }
  }

  await writeJson(OUTPUT_OBJECTS, {
    schemaVersion: 1,
    source: { generatedBy: 'carmen/script/import-world-cultural-data.mjs' },
    objects,
  });
  await writeJson(OUTPUT_PLACES, {
    schemaVersion: 1,
    source: { generatedBy: 'carmen/script/import-world-cultural-data.mjs' },
    places,
  });
  await writeJson(OUTPUT_VOCAB, buildVocab(objects, places));
  await writeJson(OUTPUT_INDEX, buildCandidateIndex(countries, objects, places));
  await writeJson(OUTPUT_ATTRIBUTIONS, buildAttributions(objects));

  console.log(`World cultural data imported: ${objects.length} objects, ${places.length} places.`);
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
