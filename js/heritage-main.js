import { createCompleteHeritageGame } from "./heritage-complete.js";

const initOverlay = document.getElementById("init-overlay");
const gameContainer = document.getElementById("game-container");

if (initOverlay) {
  initOverlay.style.display = "flex";
}

// Create and initialize game
const result = await createCompleteHeritageGame({
  container: gameContainer
});

if (result) {
  result.start();
  
  if (initOverlay) {
    setTimeout(() => initOverlay.style.display = "none", 100);
  }
} else {
  alert("Failed to load heritage sites data. Please refresh the page.");
}
