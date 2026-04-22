#!/usr/bin/env node

/**
 * Validate the generated Carmen World Case Files cultural data.
 *
 * This checks the browser-facing JSON shape and cross-file links. It is not a
 * gameplay balance check; authored case routes still live in the curated case
 * files.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

const FILES = {
  objects: path.join(ROOT, 'data', 'carmen-world-cultural-objects.json'),
  places: path.join(ROOT, 'data', 'carmen-world-cultural-places.json'),
  vocab: path.join(ROOT, 'data', 'carmen-world-cultural-vocab.json'),
  candidateIndex: path.join(ROOT, 'data', 'carmen-world-candidate-index.json'),
  attributions: path.join(ROOT, 'data', 'carmen-world-source-attributions.json'),
};

const QID_RE = /^Q\d+$/;

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateObject(object, errors) {
  const prefix = `object ${object?.id || '(missing id)'}`;
  if (!hasText(object?.id)) errors.push(`${prefix}: missing id`);
  if (!hasText(object?.title)) errors.push(`${prefix}: missing title`);
  if (!QID_RE.test(object?.wikidataId || '')) errors.push(`${prefix}: invalid wikidataId`);
  if (!hasText(object?.caseTitle)) errors.push(`${prefix}: missing caseTitle`);
  if (!hasText(object?.pattern)) errors.push(`${prefix}: missing pattern`);
  if (!hasText(object?.sourceUrls?.wikidata)) errors.push(`${prefix}: missing Wikidata source URL`);
  if (!object?.image) {
    errors.push(`${prefix}: missing image metadata`);
    return;
  }
  if (!hasText(object.image.commonsFile)) errors.push(`${prefix}: missing Commons file`);
  if (!hasText(object.image.url)) errors.push(`${prefix}: missing image URL`);
  if (!hasText(object.image.licenseShortName)) errors.push(`${prefix}: missing image license`);
}

function validatePlace(place, errors) {
  const prefix = `place ${place?.id || '(missing id)'}`;
  if (!hasText(place?.id)) errors.push(`${prefix}: missing id`);
  if (!hasText(place?.name)) errors.push(`${prefix}: missing name`);
  if (!QID_RE.test(place?.wikidataId || '')) errors.push(`${prefix}: invalid wikidataId`);
  if (!hasText(place?.caseId)) errors.push(`${prefix}: missing caseId`);
  if (!hasText(place?.role)) errors.push(`${prefix}: missing role`);
  if (!hasText(place?.city)) errors.push(`${prefix}: missing city`);
  if (!hasText(place?.country)) errors.push(`${prefix}: missing country`);
  if (!isFiniteNumber(place?.lat) || !isFiniteNumber(place?.lon)) {
    errors.push(`${prefix}: missing coordinates`);
  }
  if (!hasText(place?.sourceUrls?.wikidata)) errors.push(`${prefix}: missing Wikidata source URL`);
}

function validateAttribution(image, objectIds, errors) {
  const prefix = `image attribution ${image?.objectId || '(missing objectId)'}`;
  if (!objectIds.has(image?.objectId)) errors.push(`${prefix}: objectId does not match generated object`);
  if (!hasText(image?.title)) errors.push(`${prefix}: missing title`);
  if (!hasText(image?.commonsFile)) errors.push(`${prefix}: missing Commons file`);
  if (!hasText(image?.licenseShortName)) errors.push(`${prefix}: missing license`);
  if (!hasText(image?.sourceUrl)) errors.push(`${prefix}: missing source URL`);
}

function placeKey(place) {
  return `${place.country}|${place.wikidataId}|${place.role}`;
}

function validateCandidateIndex(index, objectIds, places, errors) {
  const countries = Object.values(index?.countries || {});
  if (countries.length === 0) errors.push('candidate index: no countries');

  const indexedCaseIds = new Set();
  const indexedPlaceKeys = new Set();
  const placeKeys = new Set(places.map(placeKey));

  for (const country of countries) {
    const prefix = `candidate country ${country?.country || '(missing country)'}`;
    if (!hasText(country?.country)) errors.push(`${prefix}: missing country`);
    if (!Array.isArray(country?.caseIds)) errors.push(`${prefix}: caseIds must be an array`);
    if (!Array.isArray(country?.culturalPlaces)) errors.push(`${prefix}: culturalPlaces must be an array`);
    for (const caseId of country?.caseIds || []) indexedCaseIds.add(caseId);
    for (const place of country?.culturalPlaces || []) {
      const key = `${country.country}|${place?.wikidataId}|${place?.role}`;
      if (!hasText(place?.name)) errors.push(`${prefix}: cultural place missing name`);
      if (!QID_RE.test(place?.wikidataId || '')) errors.push(`${prefix}: cultural place has invalid wikidataId`);
      if (!hasText(place?.role)) errors.push(`${prefix}: cultural place missing role`);
      if (!isFiniteNumber(place?.lat) || !isFiniteNumber(place?.lon)) {
        errors.push(`${prefix}: cultural place missing coordinates`);
      }
      if (!placeKeys.has(key)) errors.push(`${prefix}: unknown cultural place ${place?.wikidataId || '(missing wikidataId)'}`);
      indexedPlaceKeys.add(key);
    }
  }

  for (const objectId of objectIds) {
    if (!indexedCaseIds.has(objectId)) errors.push(`candidate index: missing case id ${objectId}`);
  }
  for (const place of places) {
    const key = placeKey(place);
    if (!indexedPlaceKeys.has(key)) errors.push(`candidate index: missing place ${place.name} (${place.wikidataId})`);
  }
}

async function main() {
  const [objectsData, placesData, vocabData, indexData, attributionData] = await Promise.all([
    readJson(FILES.objects),
    readJson(FILES.places),
    readJson(FILES.vocab),
    readJson(FILES.candidateIndex),
    readJson(FILES.attributions),
  ]);

  const errors = [];
  const objects = objectsData.objects || [];
  const places = placesData.places || [];
  const images = attributionData.images || [];

  if (objects.length < 3) errors.push(`objects: expected at least 3, found ${objects.length}`);
  if (places.length < 8) errors.push(`places: expected at least 8, found ${places.length}`);
  if (!Array.isArray(vocabData.terms)) errors.push('vocab: terms must be an array');

  for (const object of objects) validateObject(object, errors);
  for (const place of places) validatePlace(place, errors);

  const objectIds = new Set(objects.map(object => object.id));
  for (const image of images) validateAttribution(image, objectIds, errors);
  validateCandidateIndex(indexData, objectIds, places, errors);

  if (errors.length) {
    console.error(`World cultural data validation failed with ${errors.length} error(s):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log(`World cultural data valid: ${objects.length} objects, ${places.length} places, ${images.length} image attributions.`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
