import { createRouteGame } from "./route-game.js";
import { initConfetti } from "./confetti.js";
import { COUNTRY_ALIASES } from "./aliases.js";
import { loadGeoJSON } from "./geojson-loader.js";
import { RouteRenderer } from "./ui-components/route-renderer.js";
import { attachZoomPan } from "./map-zoom-pan.js";
import { norm } from "./utils.js";

// Make aliases globally available for route-game.js
window.COUNTRY_ALIASES = COUNTRY_ALIASES;

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

// Confetti
const confetti = initConfetti("confetti");

// Load neighbors + GeoJSON
const [NEIGHBORS, worldData] = await Promise.all([
  fetch("data/countries-neighbors.json").then((r) => r.json()),
  loadGeoJSON("data/ne_10m_admin_0_countries_route.geojson.gz"),
]);

const WORLD = worldData.features || [];
const renderer = new RouteRenderer(ui.map, worldData, { aliases: COUNTRY_ALIASES });

function drawCountries(countryList) {
  renderer.drawRoute(countryList);
}

// Add mobile autocomplete if present
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
    });
  }
}

// Add zoom and pan interactions
let baseViewBox = { x: 0, y: 0, w: MAP_W, h: MAP_H };

// Wrapper to track baseViewBox when drawing
const originalDrawCountries = drawCountries;
function drawCountriesWithZoom(countryList) {
  originalDrawCountries(countryList);
  // Capture the viewBox after drawing as the new base
  const vb = ui.map.viewBox.baseVal;
  baseViewBox = { x: vb.x, y: vb.y, w: vb.width, h: vb.height };
}

const game = createRouteGame({
  ui,
  neighbors: NEIGHBORS,
  confetti,
  drawCountries: drawCountriesWithZoom,
  getCountryFeature: (countryName) => {
    return WORLD.find((f) => norm(f.properties.ADMIN) === norm(countryName));
  },
});

// Event listeners
ui.submitBtn?.addEventListener("click", () => {
  const guess = ui.answerInput.value.trim();
  if (guess) {
    game.processGuess(guess);
  }
});

ui.answerInput?.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    const guess = ui.answerInput.value.trim();
    if (guess) {
      game.processGuess(guess);
    }
  }
});

ui.undoBtn?.addEventListener("click", () => game.undo());
ui.showHintBtn?.addEventListener("click", () => game.showHint());
ui.giveUpBtn?.addEventListener("click", () => game.giveUp());

// Attach zoom/pan interactions (shared module)
attachZoomPan(ui.map, () => baseViewBox);

// Start the game
game.start();
