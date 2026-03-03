import { GeoFeaturesGameLogic } from './games/geo-features-logic.js';
import { createGeoFeaturesGame } from './geo-features-complete.js';

const params      = new URLSearchParams(location.search);
const roundsParam = params.get('rounds') || '10';
const maxRounds   = roundsParam === 'all' ? Infinity : (parseInt(roundsParam) || 10);
const modeParam   = params.get('mode');
const pickOne     = modeParam === 'easy';
const gameIdSuffix = roundsParam === 'all' ? 'long' : 'short';
const gameId      = pickOne ? `rivers-easy-${gameIdSuffix}` : `rivers-${gameIdSuffix}`;

const initOverlay  = document.getElementById('init-overlay');
const canvas       = document.getElementById('map');
const featureNameEl = document.getElementById('featureName');
const scoreEl      = document.getElementById('score');
const progressEl   = document.getElementById('progress');
const finalOverlay = document.getElementById('finalOverlay');

if (initOverlay) {
  initOverlay.style.display = 'flex';
}
if (pickOne) {
  const desc = document.getElementById('game-desc');
  if (desc) desc.textContent = 'Click one country the river flows through, then submit your answer.';
}

(async () => {
  try {
    const features = await fetch('data/rivers.json').then(r => r.json());

    const logic = new GeoFeaturesGameLogic({ features, maxRounds, pickOne });

    await createGeoFeaturesGame({
      container:    canvas.parentElement,
      canvas,
      featureNameEl,
      scoreEl,
      progressEl,
      finalOverlay,
      logic,
      featureType:  'river',
      gameId,
      pickOne,
      initOverlay,
    });
  } catch (err) {
    console.error('Failed to initialize Rivers game:', err);
    if (initOverlay) {
      initOverlay.innerHTML = `<div style="color:red">Failed to load game: ${err.message}</div>`;
    }
  }
})();
