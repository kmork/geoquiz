import { createCompleteTriviaGame } from "./trivia-complete.js";

const ui = {
  questionText: document.getElementById("questionText"),
  choices: document.getElementById("choices"),
  explanation: document.getElementById("explanation"),
  scoreEl: document.getElementById("score"),
  progressEl: document.getElementById("progress"),
  finalOverlay: document.getElementById("finalOverlay"),
};

(async () => {
  const result = await createCompleteTriviaGame({
    container: document.querySelector(".card"),
    ui,
  });

  if (!result) return;
  result.showQuestion();
})();
