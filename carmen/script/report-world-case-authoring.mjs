#!/usr/bin/env node

/**
 * Report curation gaps for Carmen World Case Files.
 *
 * This is deliberately stricter than the raw cultural-data validator. It checks
 * that generated source data is usable for authored gameplay and that playable
 * case scripts reference real cultural places.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

const FILES = {
  cases: path.join(ROOT, 'data', 'carmen-world-case-files.json'),
  seeds: path.join(ROOT, 'data', 'carmen-world-cultural-seeds.json'),
  objects: path.join(ROOT, 'data', 'carmen-world-cultural-objects.json'),
  places: path.join(ROOT, 'data', 'carmen-world-cultural-places.json'),
  vocab: path.join(ROOT, 'data', 'carmen-world-cultural-vocab.json'),
  attributions: path.join(ROOT, 'data', 'carmen-world-source-attributions.json'),
};

const BASE_LOCATION_IDS = new Set(['airport', 'hotel', 'market', 'library', 'embassy']);
const REQUIRED_CATEGORIES = ['route', 'culture', 'confirmation'];
const NON_ENGLISH_HINT_RE = /[^\x00-\x7F]|Überrest/i;
const MIN_SOLID_ROUTE_STOPS = 5;
const ROUTE_STAGE_FIELDS = ['biographyStage', 'learningGoal', 'thiefClaim', 'truthComplication'];

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function classifyTags(tags = []) {
  return {
    route: tags.some(tag => tag.startsWith('continent:') || tag.startsWith('capital:') || tag.startsWith('city:') || tag.startsWith('export:') || tag.startsWith('climate:')),
    culture: tags.some(tag => tag.startsWith('culture:') || tag.startsWith('famous:') || tag.startsWith('history:') || tag.startsWith('cultural_')),
    confirmation: tags.some(tag => tag.startsWith('country:') || tag === 'confirmation'),
  };
}

function culturalPlaceId(locationId) {
  return String(locationId || '').startsWith('cultural:')
    ? String(locationId).replace(/^cultural:/, '')
    : null;
}

function inspectCase(caseFile, source, warnings, errors) {
  const prefix = `case ${caseFile?.id || '(missing id)'}`;
  if (!hasText(caseFile?.id)) errors.push(`${prefix}: missing id`);
  if (!hasText(caseFile?.title)) errors.push(`${prefix}: missing title`);
  if (!hasText(caseFile?.artifact?.siteName)) errors.push(`${prefix}: missing artifact siteName`);
  if (!hasText(caseFile?.artifact?.imageUrl)) warnings.push(`${prefix}: missing artifact image`);
  if (!Array.isArray(caseFile?.route) || caseFile.route.length < 2) errors.push(`${prefix}: route needs at least two stops`);
  if ((caseFile?.route || []).length > 0 && caseFile.route.length < MIN_SOLID_ROUTE_STOPS) {
    warnings.push(`${prefix}: route has ${caseFile.route.length} stops; solid World Case artifacts should target at least ${MIN_SOLID_ROUTE_STOPS}`);
  }
  if (!Array.isArray(caseFile?.legs) || caseFile.legs.length !== Math.max(0, (caseFile.route || []).length - 1)) {
    errors.push(`${prefix}: legs must be route length minus one`);
  }

  const stageCounts = new Map();
  for (const [stopIndex, stop] of (caseFile.route || []).entries()) {
    const stopPrefix = `${prefix} route stop ${stopIndex + 1}`;
    for (const field of ROUTE_STAGE_FIELDS) {
      if (!hasText(stop?.[field])) warnings.push(`${stopPrefix}: missing ${field}`);
    }
    if (hasText(stop?.biographyStage)) {
      stageCounts.set(stop.biographyStage, (stageCounts.get(stop.biographyStage) || 0) + 1);
    }
  }
  for (const [stage, count] of stageCounts) {
    if (count > 1) warnings.push(`${prefix}: biography stage "${stage}" appears ${count} times; make repeated stages intentional in the case notes`);
  }

  const sourceObject = source.objectsById.get(caseFile.id);
  if (!sourceObject) warnings.push(`${prefix}: no generated cultural object with same id`);
  const sourcePlaces = source.placesByCase.get(caseFile.id) || [];
  if (sourcePlaces.length === 0) warnings.push(`${prefix}: no generated cultural places with same id`);

  for (const [legIndex, leg] of (caseFile.legs || []).entries()) {
    const legPrefix = `${prefix} leg ${legIndex + 1}`;
    if (leg.from !== caseFile.route?.[legIndex]?.country) errors.push(`${legPrefix}: from does not match route stop`);
    if (leg.to !== caseFile.route?.[legIndex + 1]?.country) errors.push(`${legPrefix}: to does not match next route stop`);
    if (!Array.isArray(leg.clues) || leg.clues.length < 3) errors.push(`${legPrefix}: expected at least three clues`);

    const coverage = { route: false, culture: false, confirmation: false };
    for (const clue of leg.clues || []) {
      const cluePrefix = `${legPrefix} clue ${clue?.id || '(missing id)'}`;
      if (!hasText(clue?.id)) errors.push(`${cluePrefix}: missing id`);
      if (!hasText(clue?.title)) warnings.push(`${cluePrefix}: missing title`);
      if (!hasText(clue?.text)) errors.push(`${cluePrefix}: missing text`);
      if (!Array.isArray(clue?.tags) || clue.tags.length === 0) errors.push(`${cluePrefix}: missing tags`);
      const placeId = culturalPlaceId(clue?.locationId);
      if (placeId && !source.placeIds.has(placeId)) errors.push(`${cluePrefix}: unknown cultural place ${placeId}`);
      if (placeId) {
        const place = source.placesById.get(placeId);
        const routeStop = caseFile.route?.[legIndex];
        if (place && routeStop && place.country !== routeStop.country) {
          warnings.push(`${cluePrefix}: cultural place country ${place.country} does not match current route stop ${routeStop.country}`);
        }
      }
      if (!placeId && !BASE_LOCATION_IDS.has(clue?.locationId)) errors.push(`${cluePrefix}: unknown base location ${clue?.locationId || '(missing locationId)'}`);
      const types = classifyTags(clue.tags || []);
      for (const category of REQUIRED_CATEGORIES) {
        coverage[category] ||= types[category];
      }
    }

    for (const category of REQUIRED_CATEGORIES) {
      if (!coverage[category]) warnings.push(`${legPrefix}: no ${category} evidence tag coverage`);
    }
  }
}

function inspectSourceData(source, warnings) {
  for (const object of source.objects) {
    for (const field of ['title', 'description', 'pattern']) {
      if (NON_ENGLISH_HINT_RE.test(object[field] || '')) {
        warnings.push(`object ${object.id}: ${field} may need English curation`);
      }
    }
    for (const field of ['objectType', 'materials', 'genre', 'movement']) {
      for (const term of object[field] || []) {
        if (NON_ENGLISH_HINT_RE.test(term)) warnings.push(`object ${object.id}: ${field} term "${term}" may need English curation`);
      }
    }
  }
  for (const image of source.attributions.images || []) {
    if (!hasText(image.licenseShortName)) warnings.push(`image ${image.objectId}: missing license short name`);
    if (!hasText(image.credit)) warnings.push(`image ${image.objectId}: missing image credit`);
  }
}

async function main() {
  const [casesData, seedsData, objectsData, placesData, vocabData, attributionsData] = await Promise.all([
    readJson(FILES.cases),
    readJson(FILES.seeds),
    readJson(FILES.objects),
    readJson(FILES.places),
    readJson(FILES.vocab),
    readJson(FILES.attributions),
  ]);

  const source = {
    seeds: seedsData.cases || [],
    objects: objectsData.objects || [],
    places: placesData.places || [],
    vocab: vocabData.terms || [],
    attributions: attributionsData,
    objectsById: new Map((objectsData.objects || []).map(object => [object.id, object])),
    placeIds: new Set((placesData.places || []).map(place => place.id)),
    placesById: new Map((placesData.places || []).map(place => [place.id, place])),
    placesByCase: new Map(),
  };
  for (const place of source.places) {
    const list = source.placesByCase.get(place.caseId) || [];
    list.push(place);
    source.placesByCase.set(place.caseId, list);
  }

  const warnings = [];
  const errors = [];
  const cases = casesData.cases || [];
  const caseIds = new Set(cases.map(item => item.id));
  for (const seed of source.seeds) {
    if (!caseIds.has(seed.id)) warnings.push(`seed ${seed.id}: not promoted to a playable case`);
  }
  for (const caseFile of cases) inspectCase(caseFile, source, warnings, errors);
  inspectSourceData(source, warnings);

  console.log(`World Case authoring report: ${cases.length} playable cases, ${source.objects.length} source objects, ${source.places.length} source places.`);
  if (warnings.length) {
    console.log(`Warnings (${warnings.length}):`);
    for (const warning of warnings) console.log(`- ${warning}`);
  }
  if (errors.length) {
    console.error(`Errors (${errors.length}):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
