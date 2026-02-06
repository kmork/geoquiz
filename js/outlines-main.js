import { createCompleteOutlinesGame } from "./outlines-complete.js";

const ui = {
  scoreEl: document.getElementById("score"),
  progressEl: document.getElementById("progress"),
  statusEl: document.getElementById("status"),
  finalOverlay: document.getElementById("finalOverlay"),
  finalScoreEl: document.getElementById("finalScore"),
  finalCountriesEl: document.getElementById("finalCountries"),
  finalCorrectEl: document.getElementById("finalCorrect"),
  finalFirstTryEl: document.getElementById("finalFirstTry"),
  finalSubtitleEl: document.getElementById("finalSubtitle"),
  playAgainBtn: document.getElementById("playAgain"),
  closeFinalBtn: document.getElementById("closeFinal"),
};

const initOverlay = document.getElementById("init-overlay");
if (initOverlay) {
  initOverlay.style.display = "flex";
}

// Create game
const result = await createCompleteOutlinesGame({
  container: document.querySelector('.wrap'),
  svgMap: document.getElementById("map"),
  answerInput: document.getElementById("answer"),
  submitBtn: document.getElementById("submit"),
  ui
});

if (result) {
  result.reset();  // Initialize the deck
  result.nextQ();
  
  // Hide init overlay
  if (initOverlay) {
    setTimeout(() => initOverlay.style.display = "none", 100);
  }
  
  // Wire up buttons
  ui.playAgainBtn?.addEventListener("click", () => {
    ui.finalOverlay.style.display = "none";
    result.reset();
    result.nextQ();
  });
  
  ui.closeFinalBtn?.addEventListener("click", () => {
    ui.finalOverlay.style.display = "none";
  });
}
