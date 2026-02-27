import { GeoFeaturesGameLogic } from './games/geo-features-logic.js';
import { createGeoFeaturesGame } from './geo-features-complete.js';

const params      = new URLSearchParams(location.search);
const roundsParam = params.get('rounds') || '10';
const maxRounds   = roundsParam === 'all' ? Infinity : (parseInt(roundsParam) || 10);
const gameIdSuffix = roundsParam === 'all' ? 'long' : 'short';
const gameId      = `rivers-${gameIdSuffix}`;

const initOverlay  = document.getElementById('init-overlay');
const canvas       = document.getElementById('map');
const featureNameEl = document.getElementById('featureName');
const scoreEl      = document.getElementById('score');
const progressEl   = document.getElementById('progress');
const finalOverlay = document.getElementById('finalOverlay');

if (initOverlay) {
  initOverlay.style.display = 'flex';
}

(async () => {
  try {
    const features = await fetch('data/rivers.json').then(r => r.json());

    const logic = new GeoFeaturesGameLogic({ features, maxRounds });

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
      initOverlay,
    });
  } catch (err) {
    console.error('Failed to initialize Rivers game:', err);
    if (initOverlay) {
      initOverlay.innerHTML = `<div style="color:red">Failed to load game: ${err.message}</div>`;
    }
  }
})();
