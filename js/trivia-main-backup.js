import { getUI } from "./trivia-ui.js";
import { initConfetti } from "./confetti.js";
import { createTriviaGame } from "./trivia-game.js";

const ui = getUI();
const confetti = initConfetti("confetti");

const game = createTriviaGame({ ui, confetti });

// Load questions and start
const loaded = await game.loadQuestions();
if (!loaded) {
  ui.questionText.textContent = "Failed to load questions. Please refresh.";
} else {
  game.showQuestion();
}

// Wire up buttons
ui.playAgainBtn?.addEventListener("click", () => {
  ui.finalOverlay.style.display = "none";
  game.reset();
  game.showQuestion();
});

ui.closeFinalBtn?.addEventListener("click", () => {
  ui.finalOverlay.style.display = "none";
});
