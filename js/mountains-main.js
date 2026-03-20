import { GeoFeaturesGameLogic } from './games/geo-features-logic.js';
import { createGeoFeaturesGame } from './geo-features-complete.js';

const params      = new URLSearchParams(location.search);
const modeParam   = params.get('mode');
const roundsParam = params.get('rounds') || 'all';
const maxRounds   = roundsParam === 'all' ? Infinity : (parseInt(roundsParam) || 10);
const pickOne     = modeParam === 'easy';
const gameIdSuffix = roundsParam === 'all' ? 'all' : 'short';
const gameId      = pickOne ? `mountains-easy-${gameIdSuffix}` : `mountains-${gameIdSuffix}`;

const initOverlay   = document.getElementById('init-overlay');
const canvas        = document.getElementById('map');
const featureNameEl = document.getElementById('featureName');
const scoreEl       = document.getElementById('score');
const progressEl    = document.getElementById('progress');
const finalOverlay  = document.getElementById('finalOverlay');

if (initOverlay) {
  initOverlay.style.display = 'flex';
}
if (pickOne) {
  const desc = document.getElementById('game-desc');
  if (desc) desc.textContent = 'Click one country the mountain range spans, then submit your answer.';
}

let bonusScore = 0;

// Bonus overlay element — injected into the map container after load
const bonusOverlay = document.createElement('div');
bonusOverlay.className = 'geo-bonus-overlay';
bonusOverlay.style.display = 'none';

async function onBonusRound(feature, api) {
  return new Promise((resolve) => {
    const highest = feature.bonusPeaks.reduce((a, b) => b.elev > a.elev ? b : a);

    bonusOverlay.className = 'geo-bonus-overlay';
    bonusOverlay.textContent = '🏔 Click the highest peak!';
    bonusOverlay.style.display = 'block';

    // Hide the overlay when bonus mode ends (user clicked Next)
    api.onEnd = () => { bonusOverlay.style.display = 'none'; };

    api.onPeakClick = (clicked) => {
      api.onPeakClick = null; // one click only

      const correct = clicked.name === highest.name;
      if (correct) bonusScore++;

      // Reveal correct peak in green; wrong click in red; show all peak names
      api.highlightPeak(highest.name);
      if (!correct) api.markWrong(clicked.name);
      api.revealLabels();

      bonusOverlay.className = 'geo-bonus-overlay ' + (correct ? 'correct' : 'wrong');
      bonusOverlay.textContent = correct
        ? `✓ ${highest.name} — ${highest.elev} m`
        : `✗ ${highest.name} was the highest — ${highest.elev} m`;

      // Resolve immediately — startBonusRound will show Next and wait for user to click it
      resolve();
    };

    api.startPeakMode(feature.bonusPeaks);
  });
}

(async () => {
  try {
    const features = await fetch('data/mountain-ranges.json').then(r => r.json());

    const logic = new GeoFeaturesGameLogic({ features, maxRounds, pickOne });

    canvas.parentElement.appendChild(bonusOverlay);

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
      pickOne,
      initOverlay,
      onBonusRound:     pickOne ? null : onBonusRound,
      getExtraScore:    pickOne ? null : () => bonusScore,
      getExtraMaxScore: pickOne ? null : () => logic.getProgress().total,
      onPlayAgainHook:  () => { bonusScore = 0; },
    });
  } catch (err) {
    console.error('Failed to initialize Mountains game:', err);
    if (initOverlay) {
      initOverlay.innerHTML = `<div style="color:red">Failed to load game: ${err.message}</div>`;
    }
  }
})();
