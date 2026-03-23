/**
 * Heritage Game - Complete Game Factory
 * Used by both standalone and Daily Challenge
 */

import { createHeritageGame } from "./heritage-game.js";
import { initConfetti } from "./confetti.js";

/**
 * Create complete Heritage game
 * @param {Object} config
 * @param {HTMLElement} config.container - Game container
 * @param {Object} [config.confetti] - Confetti instance
 * @param {boolean} [config.singleRound=false] - Single round mode
 * @param {Function} [config.onComplete] - Callback when complete
 * @param {boolean} [config.allowMultipleChoice=true] - Allow multiple choice after wrong answer
 * @param {boolean} [config.showHint=true] - Show hint button
 * @returns {Promise<Object>} Game instance
 */
export async function createCompleteHeritageGame({
  container,
  confetti: confettiInstance,
  singleRound = false,
  onComplete,
  allowMultipleChoice = true,
  showHint = true,
  maxSites = 10,
  gameIdSuffix = 'short',
  streakMode = false,
}) {

  const confetti = confettiInstance || (singleRound ? null : initConfetti("confetti"));

  // Create game instance
  const game = createHeritageGame({
    container,
    confetti,
    config: {
      singleRound,
      onComplete,
      allowMultipleChoice,
      showHint,
      maxSites,
      gameIdSuffix,
      streakMode,
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
