import { GeoFeaturesGameLogic } from './games/geo-features-logic.js';
import { createGeoFeaturesGame } from './geo-features-complete.js';

// Mountains always plays all 16 ranges
const gameId = 'mountains-all';

const initOverlay   = document.getElementById('init-overlay');
const canvas        = document.getElementById('map');
const featureNameEl = document.getElementById('featureName');
const scoreEl       = document.getElementById('score');
const progressEl    = document.getElementById('progress');
const finalOverlay  = document.getElementById('finalOverlay');

if (initOverlay) {
  initOverlay.style.display = 'flex';
}

(async () => {
  try {
    const features = await fetch('data/mountains.json').then(r => r.json());

    const logic = new GeoFeaturesGameLogic({ features, maxRounds: Infinity });

    await createGeoFeaturesGame({
      container:    canvas.parentElement,
      canvas,
      featureNameEl,
      scoreEl,
      progressEl,
      finalOverlay,
      logic,
      featureType:  'mountain',
      gameId,
      initOverlay,
    });
  } catch (err) {
    console.error('Failed to initialize Mountains game:', err);
    if (initOverlay) {
      initOverlay.innerHTML = `<div style="color:red">Failed to load game: ${err.message}</div>`;
    }
  }
})();
