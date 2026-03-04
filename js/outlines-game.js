import { OutlinesGameLogic } from "./games/outlines-logic.js";
import { isMobileDevice, hapticFeedback, shakeWrong } from "./game-utils.js";
import { renderFinishScreen } from "./game-records.js";

export function createOutlinesGame({ ui, neighbors, confetti, drawCountries, revealAnswer, config = {} }) {
  let continueTimer = null;
  let isProcessing = false;
  let continueMode = false; // true when showing "Continue →" button

  const AUTO_MS_CORRECT_FIRST = config.autoMsCorrectFirst ?? 900;
  const AUTO_MS_CORRECT_SECOND = config.autoMsCorrectSecond ?? 1100;
  const hideScoreUI = config.hideScoreUI ?? false;
  const singleRound = config.singleRound ?? false;
  const maxRounds = config.maxRounds ?? 10;
  const gameIdSuffix = config.gameIdSuffix || 'short';
  const customOnAnswer = config.onAnswer;
  const customOnComplete = config.onComplete;
  const customOnHintUsed = config.onHintUsed;

  // Create game logic instance
  const gameLogic = new OutlinesGameLogic({
    singleRound,
    maxRounds,
    neighbors,
    onAnswer: (result) => {
      handleAnswerFeedback(result);
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
    continueMode = false;
    if (ui.statusEl) ui.statusEl.style.display = "none";
  }

  function getCurrent() {
    return gameLogic.getCurrentCountry()?.country || "";
  }

  function showStatus(msg, isCorrect) {
    if (!ui.statusEl) return;
    ui.statusEl.textContent = msg;
    ui.statusEl.className = "status " + (isCorrect ? "correct" : "wrong");
    ui.statusEl.style.display = "block";
  }

  function hideStatus() {
    if (ui.statusEl) ui.statusEl.style.display = "none";
  }

  function enterContinueMode() {
    continueMode = true;
    ui.answerInput.style.display = "none";
    ui.submitBtn.textContent = "Continue →";
    ui.submitBtn.disabled = false;
    ui.submitBtn.classList.add("continue-btn");
  }

  function exitContinueMode() {
    continueMode = false;
    ui.answerInput.style.display = "";
    ui.submitBtn.textContent = "Guess";
    ui.submitBtn.classList.remove("continue-btn");
  }

  function nextQ() {
    if (continueTimer) {
      clearTimeout(continueTimer);
      continueTimer = null;
    }

    exitContinueMode();

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
    // In continue mode, advance to next question
    if (continueMode) {
      continueMode = false; // prevent re-entry from duplicate handlers
      nextQ();
      return;
    }

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

    if (result.isCorrect) {
      // Correct answer — auto-advance
      ui.answerInput.disabled = true;
      ui.submitBtn.disabled = true;

      const card = document.querySelector('.card');
      if (card) {
        card.style.animation = 'flashCorrect 0.5s';
        setTimeout(() => card.style.animation = '', 500);
      }
      confetti?.burst?.({ x: innerWidth / 2, y: innerHeight / 2 });
      hapticFeedback('correct');
      updateUI();
      const delay = result.action === 'correct_first' ? AUTO_MS_CORRECT_FIRST : AUTO_MS_CORRECT_SECOND;
      continueTimer = setTimeout(() => {
        isProcessing = false;
        nextQ();
      }, delay);
    } else if (result.action === 'wrong_first' || result.action === 'empty') {
      // First wrong attempt — show neighbors, re-enable input for second try
      shakeWrong(ui.answerInput);
      hapticFeedback('wrong');
      showStatus(result.message, false);
      updateUI();
      // Re-enable input for second attempt
      ui.answerInput.value = "";
      ui.answerInput.disabled = false;
      ui.submitBtn.disabled = false;
      isProcessing = false;
      if (!isMobileDevice()) {
        ui.answerInput.focus();
      }
    } else {
      // Second wrong attempt or skip — show correct answer, enter Continue mode
      shakeWrong(ui.answerInput);
      hapticFeedback('wrong');
      showStatus(result.message, false);
      updateUI();

      // Reveal the answer on the map with zoomed-out context
      if (revealAnswer) {
        const current = gameLogic.getCurrentCountry();
        const countryNeighbors = neighbors[current.country] || [];
        revealAnswer(current.country, countryNeighbors);
      }

      // Show Continue button instead of auto-advancing
      enterContinueMode();
      isProcessing = false;
    }
  }

  function handleAnswerFeedback(result) {
    // Feedback is handled in checkAnswer()
  }

  function showFinal(finalResult) {
    if (hideScoreUI || !ui.finalOverlay) return;

    renderFinishScreen(ui.finalOverlay, {
      gameId: `outlines-${gameIdSuffix}`,
      score: finalResult.score,
      scoreLabel: 'Points',
      maxScore: finalResult.total * 2,
      time: finalResult.time,
      accuracy: finalResult.accuracy,
      stats: [
        { label: 'Correct', value: finalResult.correctAny },
        { label: 'First try', value: finalResult.correctFirstTry },
      ],
      shareUrl: `geoquiz.info${location.pathname}${location.search}`,
      onPlayAgain: () => {
        reset();
        nextQ();
      },
    });

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
