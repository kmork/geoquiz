import { createCompleteOutlinesGame } from "./outlines-complete.js";

const _params = new URLSearchParams(location.search);
const _roundsParam = _params.get('rounds') || '10';
const _maxRounds = _roundsParam === 'all' ? Infinity : (parseInt(_roundsParam) || 10);
const _gameIdSuffix = _roundsParam === 'all' ? 'long' : (_roundsParam === '25' ? 'medium' : 'short');

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
  gameIdSuffix: _gameIdSuffix
});

if (result) {
  result.reset();  // Initialize the deck
  result.nextQ();

  // Hide init overlay
  if (initOverlay) {
    setTimeout(() => initOverlay.style.display = "none", 100);
  }
}
