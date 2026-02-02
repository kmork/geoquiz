import { getUI } from "./ui.js";
import { initConfetti } from "./confetti.js";
import { createMap } from "./map.js";
import { createGame } from "./game.js";
import { attachWikipediaPopup } from "./wiki.js";

const ui = getUI();
const confetti = initConfetti("confetti");

const initOverlay = document.getElementById("init-overlay");

// Share score function
async function shareScore(score, total, gameName) {
  const text = `I scored ${score}/${total} in ${gameName}! 🌍 Can you beat my score?`;
  const url = window.location.href;
  
  if (navigator.share) {
    try {
      await navigator.share({ text, url });
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.log('Share failed:', err);
      }
    }
  } else {
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      alert('Score copied to clipboard! 📋');
    } catch (err) {
      prompt('Copy this to share:', `${text}\n${url}`);
    }
  }
}

// Make sure the overlay is shown while we initialize
if (initOverlay) {
  initOverlay.classList.remove("hidden");
  initOverlay.style.display = "flex";
}

const mapApi = createMap({
  svgEl: ui.map,
  worldUrl: "data/ne_10m_admin_0_countries.geojson.gz",
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

ui.shareScoreBtn?.addEventListener("click", () => {
  const score = parseInt(ui.finalScore.textContent) || 0;
  const total = parseInt(ui.finalCountries.textContent) || 0;
  shareScore(score, total, "Capitals of the World (GeoQuiz)");
});

// Keyboard navigation: Escape to close modals
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (ui.finalOverlay && ui.finalOverlay.style.display !== "none") {
      ui.finalOverlay.style.display = "none";
    }
  }
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
