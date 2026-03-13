/**
 * Place the Cities — Entry point
 * Reads URL params, waits for data, starts the game.
 */

import { createPlaceCitiesGame } from './place-cities-complete.js';

const params = new URLSearchParams(location.search);
const roundsParam = params.get('rounds') || '10';
const maxRounds = roundsParam === 'all' ? Infinity : (parseInt(roundsParam) || 10);
const diffSuffix = roundsParam === 'all' ? 'long' : (roundsParam === '10' ? 'medium' : 'short');
const continentParam = params.get('continent');
const continentSlug = continentParam ? continentParam.toLowerCase().replace(/\s+/g, '-') : null;
const gameIdSuffix = continentSlug ? `${continentSlug}-${diffSuffix}` : diffSuffix;

// Wait for data.js
while (!window.DATA) await new Promise(r => setTimeout(r, 10));

if (continentParam) {
  const filtered = window.DATA.filter(c => c.continent === continentParam);
  if (filtered.length > 0) window.DATA = filtered;
}

const initOverlay = document.getElementById('init-overlay');

const game = await createPlaceCitiesGame({
  svgEl: document.getElementById('map'),
  labelsEl: document.getElementById('city-labels'),
  submitBtn: document.getElementById('submit'),
  statusEl: document.getElementById('status'),
  countryNameEl: document.getElementById('countryName'),
  scoreEl: document.getElementById('score'),
  progressEl: document.getElementById('progress'),
  overlayEl: document.getElementById('finalOverlay'),
  maxRounds,
  gameIdSuffix,
});

game.start();

if (initOverlay) {
  initOverlay.classList.add('hidden');
  setTimeout(() => initOverlay.remove(), 400);
}
