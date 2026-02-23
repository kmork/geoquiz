import { createRouteGame } from "./route-game.js";
import { initConfetti } from "./confetti.js";
import { COUNTRY_ALIASES } from "./aliases.js";
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
};

const MAP_W = 600;
const MAP_H = 320;

const confetti = initConfetti("confetti");

const params = new URLSearchParams(location.search);
const continentParam = params.get('continent');
const difficultyParam = params.get('difficulty'); // 'easy' | 'normal' | 'hard' | null

// Load neighbors + GeoJSON
const [NEIGHBORS, worldData] = await Promise.all([
  fetch("data/countries-neighbors.json").then((r) => r.json()),
  loadGeoJSON("data/ne_10m_admin_0_countries_route.geojson.gz"),
]);

// ✅ Hide loading overlay once assets are ready
hideInitOverlay();

// Apply continent filter if requested
let filteredNeighbors = NEIGHBORS;
if (continentParam) {
  try {
    const continentsData = await fetch('data/countries-continents.json').then(r => r.json());
    const filtered = window.DATA.filter(c => continentsData[c.country] === continentParam);
    if (filtered.length > 0) {
      window.DATA = filtered;
      const continentSet = new Set(filtered.map(c => c.country));
      filteredNeighbors = Object.fromEntries(
        Object.entries(NEIGHBORS).filter(([country]) => continentSet.has(country))
      );
    }
  } catch (e) {
    console.warn('Could not load continent filter:', e);
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
  getCountryFeature: (countryName) => {
    const n = norm(countryName);
    return WORLD.find((f) => {
      const admin = f.properties.ADMIN || "";
      if (norm(admin) === n || norm(f.properties.NAME || "") === n) return true;
      // COUNTRY_ALIASES maps GeoJSON names like "United States of America" → "United States"
      const resolved = COUNTRY_ALIASES[admin];
      return resolved ? norm(resolved) === n : false;
    });
  },
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

attachZoomPan(ui.map, () => baseViewBox);

game.start();
