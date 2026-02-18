import { createCompleteHeritageGame } from "./heritage-complete.js";

const _params = new URLSearchParams(location.search);
const _roundsParam = _params.get('rounds') || '10';
const _maxSites = _roundsParam === 'all' ? Infinity : (parseInt(_roundsParam) || 10);
const _gameIdSuffix = _roundsParam === 'all' ? 'long' : (_roundsParam === '25' ? 'medium' : 'short');

const initOverlay = document.getElementById("init-overlay");
const gameContainer = document.getElementById("game-container");

if (initOverlay) {
  initOverlay.style.display = "flex";
}

// Create and initialize game
const result = await createCompleteHeritageGame({
  container: gameContainer,
  maxSites: _maxSites,
  gameIdSuffix: _gameIdSuffix
});

if (result) {
  result.start();
  
  if (initOverlay) {
    setTimeout(() => initOverlay.style.display = "none", 100);
  }
} else {
  alert("Failed to load heritage sites data. Please refresh the page.");
}
