import { OutlinesGameLogic } from "./games/outlines-logic.js";
import { isMobileDevice, hapticFeedback, shakeWrong } from "./game-utils.js";

export function createOutlinesGame({ ui, neighbors, confetti, drawCountries, config = {} }) {
  let continueTimer = null;
  let isProcessing = false; // Flag to prevent duplicate submissions

  const AUTO_MS_CORRECT_FIRST = config.autoMsCorrectFirst ?? 900;
  const AUTO_MS_CORRECT_SECOND = config.autoMsCorrectSecond ?? 1100;
  const AUTO_MS_WRONG_SECOND = config.autoMsWrongSecond ?? 1700;
  const hideScoreUI = config.hideScoreUI ?? false;
  const singleRound = config.singleRound ?? false;
  const customOnAnswer = config.onAnswer;
  const customOnComplete = config.onComplete;
  const customOnHintUsed = config.onHintUsed;

  // Create game logic instance
  const gameLogic = new OutlinesGameLogic({
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
    },
    onHintUsed: () => {
      // Hint was used - neighbors will be shown
      const current = gameLogic.getCurrentCountry();
      const countryNeighbors = neighbors[current.country] || [];
      drawCountries(current.country, countryNeighbors);
      // Call custom callback if provided
      if (customOnHintUsed) customOnHintUsed();
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
    ui.answerInput.value = "";
    ui.statusEl.style.display = "none";
  }

  function getCurrent() {
    return gameLogic.getCurrentCountry()?.country || "";
  }

  function showStatus(msg, isCorrect) {
    ui.statusEl.textContent = msg;
    ui.statusEl.className = "status " + (isCorrect ? "correct" : "wrong");
    ui.statusEl.style.display = "block";
  }

  function hideStatus() {
    ui.statusEl.style.display = "none";
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

    ui.answerInput.value = "";
    ui.answerInput.disabled = false;
    ui.submitBtn.disabled = false;
    hideStatus();

    // Draw only the target country (no neighbors yet)
    drawCountries(country.country, []);

    updateUI();
    
    // Only auto-focus on desktop
    if (!isMobileDevice()) {
      ui.answerInput.focus();
    }
  }

  function checkAnswer() {
    if (isProcessing) {
      return;
    }
    
    const userAnswer = ui.answerInput.value.trim();
    isProcessing = true;
    const result = gameLogic.checkAnswer(userAnswer);

    if (result.action === 'ignore') {
      isProcessing = false;
      return;
    }

    // Handle UI feedback based on result
    if (result.action === 'empty' || result.action === 'wrong_first') {
      // First attempt wrong or empty - show neighbors and allow retry
      shakeWrong(ui.answerInput);
      hapticFeedback('wrong');
      showStatus(result.message, false);
      ui.answerInput.value = "";
      updateUI(); // Update UI to show current progress
      
      // Reset processing flag after a brief delay to prevent immediate re-submission
      setTimeout(() => {
        isProcessing = false;
      }, 100);
      
      if (!isMobileDevice()) {
        ui.answerInput.focus();
      }
      
      // Neighbors are drawn by onHintUsed callback
      return;
    }

    if (result.isCorrect) {
      // Correct answer
      const card = document.querySelector('.card');
      if (card) {
        card.style.animation = 'flashCorrect 0.5s';
        setTimeout(() => card.style.animation = '', 500);
      }
      hapticFeedback('correct');
      confetti?.burst?.({ x: innerWidth / 2, y: innerHeight / 2 });
      showStatus(result.message, true);
      ui.answerInput.disabled = true;
      ui.submitBtn.disabled = true;
      updateUI();
      
      const delay = result.action === 'correct_first' ? AUTO_MS_CORRECT_FIRST : AUTO_MS_CORRECT_SECOND;
      continueTimer = setTimeout(() => {
        isProcessing = false;
        nextQ();
      }, delay);
    } else {
      // Wrong second attempt
      shakeWrong(ui.answerInput);
      hapticFeedback('wrong');
      showStatus(result.message, false);
      ui.answerInput.disabled = true;
      ui.submitBtn.disabled = true;
      continueTimer = setTimeout(() => {
        isProcessing = false;
        nextQ();
      }, AUTO_MS_WRONG_SECOND);
    }
  }

  function handleAnswerFeedback(result) {
    // This is called by the logic module's onAnswer callback
    // Most feedback is already handled in checkAnswer()
    // This is here for consistency with other game modules
  }

  function showFinal(finalResult) {
    if (hideScoreUI || !ui.finalOverlay) return;
    
    if (ui.finalScoreEl) ui.finalScoreEl.textContent = finalResult.score;
    if (ui.finalCountriesEl) ui.finalCountriesEl.textContent = finalResult.total;
    if (ui.finalCorrectEl) ui.finalCorrectEl.textContent = finalResult.correctAny;
    if (ui.finalFirstTryEl) ui.finalFirstTryEl.textContent = finalResult.correctFirstTry;

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

  // Event handlers
  ui.submitBtn?.addEventListener("click", checkAnswer);
  ui.answerInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      checkAnswer();
    }
  });

  return {
    reset,
    nextQ,
    getCurrent,
    handleSubmit: () => checkAnswer(),
    setCountry: (country) => gameLogic.setCountry(country),
  };
}
