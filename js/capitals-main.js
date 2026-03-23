import { getUI } from "./capitals-ui.js";
import { initConfetti } from "./confetti.js";
import { createMap } from "./map.js";
import { createGame } from "./capitals-game.js";
import { attachWikipediaPopup } from "./wiki.js";

const _params = new URLSearchParams(location.search);
const _streakMode = _params.get('mode') === 'streak';
const _roundsParam = _params.get('rounds') || '10';
const _maxRounds = _streakMode ? Infinity : (_roundsParam === 'all' ? Infinity : (parseInt(_roundsParam) || 10));
const _diffSuffix = _streakMode ? 'streak' : (_roundsParam === 'all' ? 'long' : 'short');
const _continentParam = _params.get('continent');
const _continentSlug = _continentParam ? _continentParam.toLowerCase().replace(/\s+/g, '-') : null;
const _gameIdSuffix = _continentSlug ? `${_continentSlug}-${_diffSuffix}` : _diffSuffix;

// Wait for data.js to finish loading (top-level await in separate module doesn't block us)
while (!window.DATA) await new Promise(r => setTimeout(r, 10));

if (_continentParam) {
  const filtered = window.DATA.filter(c => c.continent === _continentParam);
  if (filtered.length > 0) window.DATA = filtered;
}

const ui = getUI();
const confetti = initConfetti("confetti");

const initOverlay = document.getElementById("init-overlay");

// Make sure the overlay is shown while we initialize
if (initOverlay) {
  initOverlay.classList.remove("hidden");
  initOverlay.style.display = "flex";
}

const mapApi = createMap({
  svgEl: ui.map,
  worldUrl: "data/ne_10m_admin_0_countries_route.geojson.gz",
  placesUrl: "data/places.geojson",
});

try {
  await mapApi.load();
} catch (err) {
  console.error("Map load failed:", err);
  // Start game anyway (map will just show “Loading/No outline…”)
}

mapApi.attachInteractions();

const game = createGame({ ui, mapApi, confetti, config: { maxRounds: _maxRounds, gameIdSuffix: _gameIdSuffix, streakMode: _streakMode } });
attachWikipediaPopup(ui.elCountry, () => game.getCurrent());

// Buttons are now wired dynamically by renderFinishScreen

// Start the first round
game.reset();
game.nextQ();

// Hide and remove the init overlay once we're ready
if (initOverlay) {
  initOverlay.classList.add("hidden");
  // remove after CSS transition (keep in sync with your CSS duration)
  setTimeout(() => initOverlay.remove(), 400);
}
