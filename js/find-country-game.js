import { FindCountryGameLogic } from "./games/find-logic.js";

export function createFindCountryGame({ ui, confetti, checkClickedCountry, highlightCountry, zoomToCountries, resetMapView, config = {} }) {
  let continueTimer = null;

  const AUTO_MS_CORRECT = config.autoMsCorrect ?? 1500;
  const AUTO_MS_WRONG = config.autoMsWrong ?? 2000;
  const hideScoreUI = config.hideScoreUI ?? false;
  const singleRound = config.singleRound ?? false;
  const customOnAnswer = config.onAnswer;
  const customOnComplete = config.onComplete;

  // Create game logic instance
  const gameLogic = new FindCountryGameLogic({
    singleRound,
    onAnswer: (result) => {
      // Logic has processed the answer, handle UI feedback
      handleAnswerFeedback(result);
      // Call custom callback if provided
      if (customOnAnswer) customOnAnswer(result);
    },
    onComplete: (finalResult) => {
      if (customOnComplete) {
        customOnComplete(finalResult);
      } else {
        showFinal(finalResult);
      }
    }
  });

  function updateUI() {
    if (hideScoreUI) return;
    const progress = gameLogic.getProgress();
    if (ui.scoreEl) ui.scoreEl.textContent = progress.score;
    if (ui.progressEl) ui.progressEl.textContent = `${progress.current} / ${progress.total}`;
  }

  function reset() {
    if (continueTimer) {
      clearTimeout(continueTimer);
      continueTimer = null;
    }

    gameLogic.reset();
    updateUI();
  }

  function getCurrent() {
    return gameLogic.getCurrentCountry() || { country: "" };
  }

  function showStatus(msg, isCorrect) {
    // Status removed from UI - no-op
  }

  function hideStatus() {
    // Status removed from UI - no-op
  }

  function nextQ() {
    if (continueTimer) {
      clearTimeout(continueTimer);
      continueTimer = null;
    }

    const country = gameLogic.nextRound();
    if (!country) {
      return; // Game complete, onComplete callback will handle it
    }

    hideStatus();
    resetMapView();
    ui.countryNameEl.textContent = country.country;
    updateUI();
  }

  function handleMapClick(clickedCountryName) {
    const result = gameLogic.handleClick(clickedCountryName);
    
    if (result.action === 'ignore') {
      return;
    }

    if (result.action === 'select') {
      highlightCountry(clickedCountryName, "selected");
      console.log(`Selected: "${clickedCountryName}" - click again to confirm`);
      return;
    }

    // Handle correct or wrong answer
    handleAnswerFeedback(result);
  }

  function handleAnswerFeedback(result) {
    if (result.isCorrect) {
      showStatus(`✅ Correct! +1 point`, true);
      highlightCountry(result.correctCountry, "correct");
      confetti?.burst?.({ x: innerWidth / 2, y: innerHeight / 2 });
      updateUI();
      continueTimer = setTimeout(() => nextQ(), AUTO_MS_CORRECT);
    } else {
      showStatus(`❌ Wrong. The answer was: ${result.correctCountry}`, false);
      
      // Zoom to show both countries if wrong guess was made
      if (result.clickedCountry) {
        zoomToCountries(result.clickedCountry, result.correctCountry);
        highlightCountry(result.clickedCountry, "wrong");
        setTimeout(() => {
          highlightCountry(result.correctCountry, "correct");
        }, 300);
      } else {
        // Timeout - just show correct country
        highlightCountry(result.correctCountry, "correct");
      }
      
      continueTimer = setTimeout(() => nextQ(), AUTO_MS_WRONG);
    }
  }

  function showFinal(finalResult) {
    if (hideScoreUI || !ui.finalOverlay) return;
    
    if (ui.finalScoreEl) ui.finalScoreEl.textContent = finalResult.score;
    if (ui.finalCountriesEl) ui.finalCountriesEl.textContent = finalResult.total;
    if (ui.finalCorrectEl) ui.finalCorrectEl.textContent = finalResult.correctCount;
    if (ui.finalAccuracyEl) ui.finalAccuracyEl.textContent = `${finalResult.accuracy}%`;

    let subtitle = "Great job!";
    if (finalResult.accuracy === 100) subtitle = "Perfect score! 🌟";
    else if (finalResult.accuracy >= 80) subtitle = "Excellent work! 🎯";
    else if (finalResult.accuracy >= 60) subtitle = "Well done! 👏";
    
    if (ui.finalSubtitleEl) ui.finalSubtitleEl.textContent = subtitle;
    ui.finalOverlay.style.display = "flex";

    if (finalResult.accuracy >= 80) {
      confetti?.burst?.({ x: innerWidth / 2, y: innerHeight / 2 });
    }
  }

  return {
    reset,
    nextQ,
    getCurrent,
    handleMapClick,
    setCountry: (country) => gameLogic.setCountry(country),
    _gameLogic: gameLogic, // For Daily Challenge direct access
  };
}
