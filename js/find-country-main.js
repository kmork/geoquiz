import { createCompleteMap } from "./find-country-complete.js";
import { attachWikipediaPopup } from "./wiki.js";

// UI references
const ui = {
  countryNameEl: document.getElementById("countryName"),
  scoreEl: document.getElementById("score"),
  progressEl: document.getElementById("progress"),
  finalOverlay: document.getElementById("finalOverlay"),
};

const canvas = document.getElementById("map");
const initOverlay = document.getElementById("init-overlay");

if (initOverlay) {
  initOverlay.classList.remove("hidden");
  initOverlay.style.display = "flex";
}

// Create the complete game
let gameInstance = null;

(async () => {
  try {
    const result = await createCompleteMap({
      container: document.querySelector('.find-country-page'),
      canvas,
      countryNameEl: ui.countryNameEl,
      ui
    });
    
    gameInstance = result;
    
    // Attach Wikipedia popup
    attachWikipediaPopup(ui.countryNameEl, () => gameInstance.getCurrent());

    // Start the game
    gameInstance.reset();
    gameInstance.nextQ();
    
    // Hide init overlay
    if (initOverlay) {
      setTimeout(() => {
        initOverlay.style.display = "none";
      }, 100);
    }
  } catch (err) {
    console.error("Failed to initialize game:", err);
    if (initOverlay) {
      initOverlay.innerHTML = `<div style="color: red;">Failed to load game: ${err.message}</div>`;
    }
  }
})();
