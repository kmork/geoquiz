import { createCompleteMap } from "./find-country-complete.js";
import { attachWikipediaPopup } from "./wiki.js";

const _params = new URLSearchParams(location.search);
const _streakMode = _params.get('mode') === 'streak';
const _roundsParam = _params.get('rounds') || '10';
const _maxRounds = _streakMode ? Infinity : (_roundsParam === 'all' ? Infinity : (parseInt(_roundsParam) || 10));
const _easyMode = _params.get('difficulty') === 'easy';
const _diffSuffix = _streakMode ? 'streak' : (_easyMode ? 'easy' : (_roundsParam === 'all' ? 'long' : 'short'));
const _continentParam = _params.get('continent');
const _continentSlug = _continentParam ? _continentParam.toLowerCase().replace(/\s+/g, '-') : null;
const _gameIdSuffix = _continentSlug ? `${_continentSlug}-${_diffSuffix}` : _diffSuffix;

// UI references
const ui = {
  countryNameEl: document.getElementById("countryName"),
  scoreEl: document.getElementById("score"),
  progressEl: document.getElementById("progress"),
  finalOverlay: document.getElementById("finalOverlay"),
};

const canvas = document.getElementById("map");
const initOverlay = document.getElementById("init-overlay");

if (initOverlay) {
  initOverlay.classList.remove("hidden");
  initOverlay.style.display = "flex";
}

// Create the complete game
let gameInstance = null;

(async () => {
  try {
    while (!window.DATA) await new Promise(r => setTimeout(r, 50));

    if (_continentParam) {
      const filtered = window.DATA.filter(c => c.continent === _continentParam);
      if (filtered.length > 0) window.DATA = filtered;
    }

    const result = await createCompleteMap({
      container: document.querySelector('.find-country-page'),
      canvas,
      countryNameEl: ui.countryNameEl,
      ui,
      maxRounds: _maxRounds,
      gameIdSuffix: _gameIdSuffix,
      continent: _continentParam,
      easyMode: _easyMode,
      streakMode: _streakMode,
    });
    
    gameInstance = result;
    
    // Attach Wikipedia popup
    attachWikipediaPopup(ui.countryNameEl, () => gameInstance.getCurrent());

    // Start the game
    gameInstance.reset();
    gameInstance.nextQ();
    
    // Hide init overlay
    if (initOverlay) {
      setTimeout(() => {
        initOverlay.style.display = "none";
      }, 100);
    }
  } catch (err) {
    console.error("Failed to initialize game:", err);
    if (initOverlay) {
      initOverlay.innerHTML = `<div style="color: red;">Failed to load game: ${err.message}</div>`;
    }
  }
})();
