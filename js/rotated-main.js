import { createCompleteRotatedGame } from "./rotated-complete.js";

const _params = new URLSearchParams(location.search);
const _roundsParam = _params.get('rounds') || '10';
const _maxRounds = _roundsParam === 'all' ? Infinity : (parseInt(_roundsParam) || 10);
const _diffSuffix = _roundsParam === 'all' ? 'long' : (_roundsParam === '25' ? 'medium' : 'short');
const _continentParam = _params.get('continent');
const _continentSlug = _continentParam ? _continentParam.toLowerCase().replace(/\s+/g, '-') : null;
const _mode = _params.get('mode'); // 'rotated' or 'rotate-only'
const _rotateOnly = _mode === 'rotate-only';
const _gamePrefix = _rotateOnly ? 'rotate-only' : 'rotated';
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

const result = await createCompleteRotatedGame({
  container: document.querySelector('.wrap'),
  svgMap: document.getElementById("map"),
  answerInput: document.getElementById("answer"),
  submitBtn: document.getElementById("submit"),
  ui,
  maxRounds: _maxRounds,
  gameIdSuffix: _gameIdSuffix,
  rotateOnly: _rotateOnly,
  gamePrefix: _gamePrefix,
});

if (result) {
  result.reset();
  result.nextQ();

  if (initOverlay) {
    setTimeout(() => initOverlay.style.display = "none", 100);
  }
}
