import { createRouteGame } from "./route-game.js";
import { initConfetti } from "./confetti.js";
import { COUNTRY_ALIASES, findGeoFeature } from "./aliases.js";
import { loadGeoJSON } from "./geojson-loader.js";
import { RouteRenderer } from "./ui-components/route-renderer.js";
import { attachZoomPan } from "./map-zoom-pan.js";
import { norm } from "./utils.js";

function hideInitOverlay() {
  const overlay = document.getElementById("init-overlay");
  if (overlay) overlay.style.display = "none";
}

// UI
const ui = {
  map: document.getElementById("map"),
  answerInput: document.getElementById("answer"),
  submitBtn: document.getElementById("submit"),
  undoBtn: document.getElementById("undo"),
  showHintBtn: document.getElementById("showHint"),
  giveUpBtn: document.getElementById("giveUp"),
  scoreEl: document.getElementById("score"),
  optimalHintEl: document.getElementById("optimalHint"),
  routeEl: document.getElementById("route"),
  statusEl: document.getElementById("status"),
  hintEl: document.getElementById("hint"),
  answerRow: document.querySelector(".answerRow"),
  endActions: document.getElementById("end-actions"),
};

const MAP_W = 600;
const MAP_H = 320;

const confetti = initConfetti("confetti");

const params = new URLSearchParams(location.search);
const continentParam = params.get('continent');
const difficultyParam = params.get('difficulty'); // 'easy' | 'normal' | 'hard' | null

// Wait for data.js to finish loading
while (!window.DATA) await new Promise(r => setTimeout(r, 50));

// Load GeoJSON + build neighbors from window.DATA
const worldData = await loadGeoJSON("data/ne_10m_admin_0_countries_route.geojson.gz");
const NEIGHBORS = Object.fromEntries(window.DATA.map(c => [c.country, c.neighbors]));

// ✅ Hide loading overlay once assets are ready
hideInitOverlay();

// Apply continent filter if requested
let filteredNeighbors = NEIGHBORS;
if (continentParam) {
  const filtered = window.DATA.filter(c => c.continent === continentParam);
  if (filtered.length > 0) {
    window.DATA = filtered;
    const continentSet = new Set(filtered.map(c => c.country));
    filteredNeighbors = Object.fromEntries(
      Object.entries(NEIGHBORS)
        .filter(([country]) => continentSet.has(country))
        .map(([country, nbrs]) => [country, nbrs.filter(n => continentSet.has(n))])
    );
  }
}

const WORLD = worldData.features || [];
const renderer = new RouteRenderer(ui.map, worldData, { aliases: COUNTRY_ALIASES });

function drawCountries(countryList) {
  renderer.drawRoute(countryList);
}

// Mobile autocomplete
if (ui.answerInput) {
  ui.answerInput.removeAttribute("list");
  if (typeof window.initMobileAutocomplete === "function" && window.DATA) {
    const suggestions = [];
    window.DATA.forEach((item) => item.country && suggestions.push(item.country));
    Object.entries(COUNTRY_ALIASES).forEach(([alias, officialName]) => {
      const isValid = window.DATA.some((item) => norm(item.country) === norm(officialName));
      if (isValid) suggestions.push(alias);
    });
    const uniqueSuggestions = Array.from(new Set(suggestions)).sort();
    window.initMobileAutocomplete(ui.answerInput, uniqueSuggestions, {
      maxSuggestions: null,
      minChars: 1,
      onSelect: () => ui.submitBtn.click(),
    });
  }
}

// Zoom/pan
let baseViewBox = { x: 0, y: 0, w: MAP_W, h: MAP_H };
const originalDrawCountries = drawCountries;

function drawCountriesWithZoom(countryList) {
  originalDrawCountries(countryList);
  const vb = ui.map.viewBox.baseVal;
  baseViewBox = { x: vb.x, y: vb.y, w: vb.width, h: vb.height };
}

const game = createRouteGame({
  ui,
  neighbors: filteredNeighbors,
  difficulty: difficultyParam,
  confetti,
  drawCountries: drawCountriesWithZoom,
  getCountryFeature: (countryName) => findGeoFeature(WORLD, countryName),
});

ui.submitBtn?.addEventListener("click", () => {
  const guess = ui.answerInput.value.trim();
  if (guess) game.processGuess(guess);
});

ui.answerInput?.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    const guess = ui.answerInput.value.trim();
    if (guess) game.processGuess(guess);
  }
});

ui.undoBtn?.addEventListener("click", () => game.undo());
ui.showHintBtn?.addEventListener("click", () => game.showHint());
ui.giveUpBtn?.addEventListener("click", () => game.giveUp());

document.getElementById("play-again")?.addEventListener("click", () => {
  ui.answerRow.style.display = "";
  ui.endActions.style.display = "none";
  game.start();
});
document.getElementById("go-home")?.addEventListener("click", () => {
  location.href = "index.html";
});

attachZoomPan(ui.map, () => baseViewBox);

game.start();
