/**
 * Picture Guess - Complete Game Factory
 * Used by both standalone and Daily Challenge
 */

import { createPictureGuessGame } from "./picture-guess-game.js";
import { initConfetti } from "./confetti.js";
import { norm } from "./utils.js";
import { COUNTRY_ALIASES } from "./aliases.js";

// Set up normalization
window.normalizeCountryName = function(name) {
  const normalized = norm(name);
  for (const [canonical, alias] of Object.entries(COUNTRY_ALIASES)) {
    if (norm(alias) === normalized) {
      return norm(canonical);
    }
  }
  return normalized;
};

/**
 * Create complete Picture Guess game
 * @param {Object} config
 * @param {HTMLElement} config.container - Game container
 * @param {Object} [config.confetti] - Confetti instance
 * @param {boolean} [config.singleRound=false] - Single round mode
 * @param {Function} [config.onComplete] - Callback when complete
 * @param {boolean} [config.allowMultipleChoice=true] - Allow multiple choice after wrong answer
 * @param {boolean} [config.showHint=true] - Show hint button
 * @returns {Promise<Object>} Game instance
 */
export async function createCompletePictureGame({
  container,
  confetti: confettiInstance,
  singleRound = false,
  onComplete,
  allowMultipleChoice = true,
  showHint = true
}) {
  
  const confetti = confettiInstance || (singleRound ? null : initConfetti("confetti"));
  
  // Create game instance
  const game = createPictureGuessGame({ 
    container, 
    confetti,
    config: {
      singleRound,
      onComplete,
      allowMultipleChoice,
      showHint
    }
  });
  
  // Load sites
  const sites = await game.loadSites();
  if (!sites) {
    return null;
  }
  
  return {
    game,
    start: () => game.showQuestion(),
    reset: () => game.reset(),
    setSite: (site) => game.setSite(site),
  };
}
