/**
 * Map Jigsaw — Entry point
 * Reads URL params, waits for data, starts the game.
 */

import { createJigsawGame } from './jigsaw-complete.js';

const params = new URLSearchParams(location.search);
const continentParam = params.get('continent');
const mode = params.get('mode'); // 'major' or null
const majorOnly = mode === 'major';
const showNames = majorOnly; // Short mode shows names, Long mode hides them

const diffSuffix = majorOnly ? 'short' : 'long';
const continentSlug = continentParam ? continentParam.toLowerCase().replace(/\s+/g, '-') : null;
const gameIdSuffix = continentSlug ? `${continentSlug}-${diffSuffix}` : diffSuffix;

// Wait for data.js
while (!window.DATA) await new Promise(r => setTimeout(r, 10));

if (continentParam) {
  const filtered = window.DATA.filter(c => c.continent === continentParam);
  if (filtered.length > 0) window.DATA = filtered;
}

const initOverlay = document.getElementById('init-overlay');

const game = await createJigsawGame({
  svgEl: document.getElementById('map'),
  trayEl: document.getElementById('piece-tray'),
  scoreEl: document.getElementById('score'),
  progressEl: document.getElementById('progress'),
  overlayEl: document.getElementById('finalOverlay'),
  continentName: continentParam,
  majorOnly,
  showNames,
  gameIdSuffix,
});

game.start();

if (initOverlay) {
  initOverlay.classList.add('hidden');
  setTimeout(() => initOverlay.remove(), 400);
}
