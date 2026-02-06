/**
 * Trivia - Complete Game Factory
 * Creates a fully functional Trivia Quiz game
 * Used by both standalone game and Daily Challenge
 */

import { createTriviaGame } from "./trivia-game.js";
import { initConfetti } from "./confetti.js";

/**
 * Create a complete Trivia Quiz game instance
 * @param {Object} config Configuration
 * @param {HTMLElement} config.container - Container element
 * @param {Object} [config.ui] - UI elements (questionText, choices, explanation, etc.)
 * @param {Object} [config.confetti] - Confetti instance
 * @param {boolean} [config.singleRound=false] - Single round mode for Daily Challenge
 * @param {Function} [config.onComplete] - Callback when game completes
 * @param {Function} [config.onAnswer] - Callback when answer submitted
 * @returns {Promise<Object>} Game instance
 */
export async function createCompleteTriviaGame({ 
  container, 
  ui = {},
  confetti: confettiInstance,
  singleRound = false,
  onComplete,
  onAnswer
}) {
  
  // If no UI provided, create default UI elements from container
  let fullUI = ui;
  if (!ui.questionText) {
    // Create UI structure
    container.innerHTML = `
      <div class="trivia-question" id="questionText"></div>
      <div class="choices" id="choices"></div>
      <div class="status" id="explanation" style="display:none"></div>
    `;
    
    fullUI = {
      questionText: container.querySelector('#questionText'),
      choices: container.querySelector('#choices'),
      explanation: container.querySelector('#explanation'),
      scoreEl: ui.scoreEl || null,
      progressEl: ui.progressEl || null,
      finalOverlay: ui.finalOverlay || null,
      finalScore: ui.finalScore || null,
      finalTotal: ui.finalTotal || null,
      finalCorrect: ui.finalCorrect || null,
      finalAccuracy: ui.finalAccuracy || null,
      finalSubtitle: ui.finalSubtitle || null,
    };
  }
  
  // Create confetti if needed
  const confetti = confettiInstance || (singleRound ? null : initConfetti("confetti"));
  
  // Create game instance
  const game = createTriviaGame({ 
    ui: fullUI, 
    confetti,
    config: {
      singleRound,
      hideScoreUI: singleRound,
      onComplete: onComplete,
      onAnswer: onAnswer
    }
  });
  
  // Load questions
  const loaded = await game.loadQuestions();
  if (!loaded) {
    if (fullUI.questionText) {
      fullUI.questionText.textContent = "Failed to load questions.";
    }
    return null;
  }
  
  return {
    game,
    showQuestion: () => game.showQuestion(),
    reset: () => game.reset(),
    setQuestion: (question) => game.setQuestion(question),
  };
}
