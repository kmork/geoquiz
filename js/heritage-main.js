import { createCompleteHeritageGame } from "./heritage-complete.js";

const _params = new URLSearchParams(location.search);
const _streakMode = _params.get('mode') === 'streak';
const _roundsParam = _params.get('rounds') || '10';
const _maxSites = _streakMode ? Infinity : (_roundsParam === 'all' ? Infinity : (parseInt(_roundsParam) || 10));
const _gameIdSuffix = _streakMode ? 'streak' : (_roundsParam === 'all' ? 'long' : 'short');

const initOverlay = document.getElementById("init-overlay");
const gameContainer = document.getElementById("game-container");

if (initOverlay) {
  initOverlay.style.display = "flex";
}

// Create and initialize game
const result = await createCompleteHeritageGame({
  container: gameContainer,
  maxSites: _maxSites,
  gameIdSuffix: _gameIdSuffix,
  streakMode: _streakMode,
});

if (result) {
  result.start();
  
  if (initOverlay) {
    setTimeout(() => initOverlay.style.display = "none", 100);
  }
} else {
  alert("Failed to load heritage sites data. Please refresh the page.");
}
