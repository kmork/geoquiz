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
};

const playAgainBtn = document.getElementById("playAgain");
const closeFinalBtn = document.getElementById("closeFinal");

let gameInstance = null;

(async () => {
  const result = await createCompleteTriviaGame({
    container: document.querySelector(".card"),
    ui,
  });

  if (!result) return;

  gameInstance = result;
  gameInstance.showQuestion();

  playAgainBtn?.addEventListener("click", () => {
    ui.finalOverlay.style.display = "none";
    gameInstance.reset();
    gameInstance.showQuestion();
  });

  closeFinalBtn?.addEventListener("click", () => {
    ui.finalOverlay.style.display = "none";
  });
})();
