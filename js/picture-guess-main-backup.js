import { createPictureGuessGame } from "./picture-guess-game.js";
import { initConfetti } from "./confetti.js";
import { norm } from "./utils.js";
import { COUNTRY_ALIASES } from "./aliases.js";

const confetti = initConfetti("confetti");
const initOverlay = document.getElementById("init-overlay");
const gameContainer = document.getElementById("game-container");

if (initOverlay) {
  initOverlay.classList.remove("hidden");
  initOverlay.style.display = "flex";
}

// Country name normalization function
window.normalizeCountryName = function(name) {
  // Normalize the input
  const normalized = norm(name);
  
  // Check if it matches any alias
  for (const [canonical, alias] of Object.entries(COUNTRY_ALIASES)) {
    if (norm(alias) === normalized) {
      return norm(canonical);
    }
  }
  
  // Return normalized input if no alias match
  return normalized;
};

// Create game instance
const game = createPictureGuessGame({ container: gameContainer, confetti });

// Initialize game
async function init() {
  const sites = await game.loadSites();
  
  if (!sites) {
    alert("Failed to load heritage sites data. Please refresh the page.");
    return;
  }
  
  console.log(`Loaded ${sites.length} heritage sites`);
  
  game.reset();
  game.showSite();
  
  // Hide init overlay
  if (initOverlay) {
    setTimeout(() => {
      initOverlay.style.display = "none";
    }, 100);
  }
}

// Event listeners for final overlay
const playAgainBtn = document.getElementById("playAgain");
const closeFinalBtn = document.getElementById("closeFinal");

if (playAgainBtn) {
  playAgainBtn.addEventListener("click", () => {
    const finalOverlay = document.getElementById("finalOverlay");
    if (finalOverlay) finalOverlay.style.display = "none";
    game.reset();
    game.showSite();
  });
}

if (closeFinalBtn) {
  closeFinalBtn.addEventListener("click", () => {
    const finalOverlay = document.getElementById("finalOverlay");
    if (finalOverlay) finalOverlay.style.display = "none";
  });
}

// Start the game
init();
