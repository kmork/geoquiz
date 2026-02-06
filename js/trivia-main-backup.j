import { createCompleteTriviaGame } from "./trivia-complete.js";

const ui = {
  questionText: document.getElementById("questionText"),
  choices: document.getElementById("choices"),
  explanation: document.getElementById("explanation"),
  scoreEl: document.getElementById("score"),
  progressEl: document.getElementById("progress"),
  
  finalOverlay: document.getElementById("finalOverlay"),
  finalScore: document.getElementById("finalScore"),
  finalTotal: document.getElementById("finalTotal"),
  finalCorrect: document.getElementById("finalCorrect"),
  finalAccuracy: document.getElementById("finalAccuracy"),
  finalSubtitle: document.getElementById("finalSubtitle"),
  
  playAgainBtn: document.getElementById("playAgain"),
  closeFinalBtn: document.getElementById("closeFinal"),
};

// Create the complete game
const result = await createCompleteTriviaGame({
  container: document.querySelector('.card'),
  ui
});

if (result) {
  result.showQuestion();
  
  // Wire up buttons
  ui.playAgainBtn?.addEventListener("click", () => {
    ui.finalOverlay.style.display = "none";
    result.reset();
    result.showQuestion();
  });
  
  ui.closeFinalBtn?.addEventListener("click", () => {
    ui.finalOverlay.style.display = "none";
  });
}
