import { getUI } from "./ui.js";
import { initConfetti } from "./confetti.js";
import { createMap } from "./map.js";
import { createGame } from "./game.js";
import { attachWikipediaPopup } from "./wiki.js";

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
  worldUrl: "data/ne_10m_admin_0_countries.geojson",
  placesUrl: "data/places.geojson",
});

try {
  await mapApi.load();
} catch (err) {
  console.error("Map load failed:", err);
  // Start game anyway (map will just show “Loading/No outline…”)
}

mapApi.attachInteractions();

const game = createGame({ ui, mapApi, confetti });
attachWikipediaPopup(ui.elCountry, () => game.getCurrent());

ui.playAgainBtn?.addEventListener("click", () => {
  ui.finalOverlay.style.display = "none";
  game.reset();
  game.nextQ();
});

ui.closeFinalBtn?.addEventListener("click", () => {
  ui.finalOverlay.style.display = "none";
});

// Start the first round
game.reset();
game.nextQ();

// Hide and remove the init overlay once we're ready
if (initOverlay) {
  initOverlay.classList.add("hidden");
  // remove after CSS transition (keep in sync with your CSS duration)
  setTimeout(() => initOverlay.remove(), 400);
}
