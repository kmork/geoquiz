import { createCompleteOutlinesGame } from "./outlines-complete.js";

const ui = {
  scoreEl: document.getElementById("score"),
  progressEl: document.getElementById("progress"),
  statusEl: document.getElementById("status"),
  finalOverlay: document.getElementById("finalOverlay"),
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
}
