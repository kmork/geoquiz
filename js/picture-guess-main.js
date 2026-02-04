import { createPictureGuessGame } from "./picture-guess-game.js";
import { initConfetti } from "./confetti.js";
import { norm } from "./utils.js";
import { COUNTRY_ALIASES } from "./aliases.js";

// UI references
const ui = {
  scoreEl: document.getElementById("score"),
  progressEl: document.getElementById("progress"),
  heritageImage: document.getElementById("heritageImage"),
  imageLoading: document.getElementById("imageLoading"),
  textInputSection: document.getElementById("textInputSection"),
  countryInput: document.getElementById("countryInput"),
  submitGuess: document.getElementById("submitGuess"),
  multipleChoiceSection: document.getElementById("multipleChoiceSection"),
  hintText: document.getElementById("hintText"),
  choices: document.getElementById("choices"),
  status: document.getElementById("status"),
  finalOverlay: document.getElementById("finalOverlay"),
  finalScoreEl: document.getElementById("finalScore"),
  finalSitesEl: document.getElementById("finalSites"),
  finalPerfectEl: document.getElementById("finalPerfect"),
  finalAccuracyEl: document.getElementById("finalAccuracy"),
  finalSubtitleEl: document.getElementById("finalSubtitle"),
  playAgainBtn: document.getElementById("playAgain"),
  closeFinalBtn: document.getElementById("closeFinal"),
};

const confetti = initConfetti("confetti");
const initOverlay = document.getElementById("init-overlay");

if (initOverlay) {
  initOverlay.classList.remove("hidden");
  initOverlay.style.display = "flex";
}

// Note: Browser autocomplete is handled natively (no datalist needed)

// Initialize mobile autocomplete for country input
function initAutocompleteForPictureGuess() {
  const input = document.getElementById("countryInput");
  if (!input) return;
  
  // Check if we have the global DATA available
  if (!window.DATA || !Array.isArray(window.DATA)) {
    console.warn('window.DATA not available for autocomplete');
    return;
  }
  
  // Always remove datalist if it exists - use custom autocomplete for all devices
  input.removeAttribute('list');
  
  if (typeof initMobileAutocomplete !== 'function') {
    console.warn('initMobileAutocomplete not available');
    return;
  }
  
  // Build suggestions array from ALL countries in DATA (not just heritage sites)
  const suggestions = [];
  
  // Add all country names from global DATA
  window.DATA.forEach(item => {
    if (item.country) {
      suggestions.push(item.country);
    }
  });
  
  // Add aliases if available
  if (window.COUNTRY_ALIASES) {
    Object.keys(window.COUNTRY_ALIASES).forEach(alias => {
      suggestions.push(alias);
    });
  }
  
  // Remove duplicates and sort
  const uniqueSuggestions = [...new Set(suggestions)].sort();
  
  console.log(`Initializing autocomplete with ${uniqueSuggestions.length} countries`);
  
  // Initialize autocomplete (show ALL matching suggestions, scrollable)
  initMobileAutocomplete(input, uniqueSuggestions, {
    maxSuggestions: null, // Show all matches (scrollable)
    minChars: 1
  });
}

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
const game = createPictureGuessGame({ ui, confetti });

// Initialize game
async function init() {
  const sites = await game.loadSites();
  
  if (!sites) {
    alert("Failed to load heritage sites data. Please refresh the page.");
    return;
  }
  
  console.log(`Loaded ${sites.length} heritage sites`);
  
  // Initialize autocomplete with ALL countries (not just heritage sites)
  initAutocompleteForPictureGuess();
  
  game.reset();
  game.showSite();
  
  // Hide init overlay
  if (initOverlay) {
    setTimeout(() => {
      initOverlay.style.display = "none";
    }, 100);
  }
}

// Event listeners
ui.submitGuess.addEventListener("click", () => {
  const guess = ui.countryInput.value.trim();
  if (guess) {
    game.handleTextGuess(guess);
  }
});

ui.countryInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    const guess = ui.countryInput.value.trim();
    if (guess) {
      game.handleTextGuess(guess);
    }
  }
});

ui.playAgainBtn.addEventListener("click", () => {
  ui.finalOverlay.style.display = "none";
  game.reset();
  game.showSite();
});

ui.closeFinalBtn.addEventListener("click", () => {
  ui.finalOverlay.style.display = "none";
});

// Start the game
init();
