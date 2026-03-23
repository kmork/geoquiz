import { createCompleteOutlinesGame } from "./outlines-complete.js";

const _params = new URLSearchParams(location.search);
const _streakMode = _params.get('mode') === 'streak';
const _roundsParam = _params.get('rounds') || '10';
const _maxRounds = _streakMode ? Infinity : (_roundsParam === 'all' ? Infinity : (parseInt(_roundsParam) || 10));
const _diffSuffix = _streakMode ? 'streak' : (_roundsParam === 'all' ? 'long' : 'short');
const _continentParam = _params.get('continent');
const _continentSlug = _continentParam ? _continentParam.toLowerCase().replace(/\s+/g, '-') : null;
const _gameIdSuffix = _continentSlug ? `${_continentSlug}-${_diffSuffix}` : _diffSuffix;

while (!window.DATA) {
  await new Promise(r => setTimeout(r, 50));
}

if (_continentParam) {
  const filtered = window.DATA.filter(c => c.continent === _continentParam);
  if (filtered.length > 0) window.DATA = filtered;
}

const ui = {
  scoreEl: document.getElementById("score"),
  progressEl: document.getElementById("progress"),
  statusEl: document.getElementById("status"),
  finalOverlay: document.getElementById("finalOverlay"),
};

const initOverlay = document.getElementById("init-overlay");
if (initOverlay) {
  initOverlay.style.display = "flex";
}

// Create game
const result = await createCompleteOutlinesGame({
  container: document.querySelector('.wrap'),
  svgMap: document.getElementById("map"),
  answerInput: document.getElementById("answer"),
  submitBtn: document.getElementById("submit"),
  ui,
  maxRounds: _maxRounds,
  gameIdSuffix: _gameIdSuffix,
  streakMode: _streakMode,
});

if (result) {
  result.reset();  // Initialize the deck
  result.nextQ();

  // Hide init overlay
  if (initOverlay) {
    setTimeout(() => initOverlay.style.display = "none", 100);
  }
}
