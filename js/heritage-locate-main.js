import { createHeritageLocateGame } from './heritage-locate-complete.js';

const _params = new URLSearchParams(location.search);
const _roundsParam = _params.get('rounds') || '10';
const _maxRounds = _roundsParam === 'all' ? Infinity : (parseInt(_roundsParam) || 10);
const _gameIdSuffix = _roundsParam === 'all' ? 'long' : (_roundsParam === '25' ? 'medium' : 'short');

const initOverlay = document.getElementById('init-overlay');
if (initOverlay) initOverlay.style.display = 'flex';

const result = await createHeritageLocateGame({
  container: document.querySelector('.heritage-locate-page'),
  canvas: document.getElementById('map'),
  scoreEl: document.getElementById('score'),
  progressEl: document.getElementById('progress'),
  finalOverlay: document.getElementById('finalOverlay'),
  maxRounds: _maxRounds,
  gameIdSuffix: _gameIdSuffix,
});

if (result) {
  result.start();
  if (initOverlay) setTimeout(() => initOverlay.style.display = 'none', 100);
} else {
  alert('Failed to load heritage sites data. Please refresh the page.');
}
