import { OutlinesGameLogic } from "./games/outlines-logic.js";
import { isMobileDevice, hapticFeedback, shakeWrong } from "./game-utils.js";
import { renderFinishScreen } from "./game-records.js";

export function createOutlinesGame({ ui, confetti, drawCountries, revealAnswer, neighbors, config = {} }) {
  let continueTimer = null;
  let isProcessing = false;
  let continueMode = false; // true when showing "Continue →" button

  const AUTO_MS_CORRECT = config.autoMsCorrect ?? 900;
  const hideScoreUI = config.hideScoreUI ?? false;
  const singleRound = config.singleRound ?? false;
  const maxRounds = config.maxRounds ?? 10;
  const gameIdSuffix = config.gameIdSuffix || 'short';
  const customOnAnswer = config.onAnswer;
  const customOnComplete = config.onComplete;

  const gameLogic = new OutlinesGameLogic({
    singleRound,
    maxRounds,
    onAnswer: (result) => {
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
    ui.answerInput.value = "";
    continueMode = false;
    if (ui.statusEl) ui.statusEl.style.display = "none";
  }

  function getCurrent() {
    return gameLogic.getCurrentCountry()?.country || "";
  }

  function showStatus(msg, isCorrect) {
    if (!ui.statusEl) return;
    if (ui.answerInput) ui.answerInput.style.display = "none";
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
    setTimeout(() => ui.submitBtn.focus(), 50);
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
    if (!country) return; // Game complete — onComplete handles it

    ui.answerInput.value = "";
    ui.answerInput.disabled = false;
    ui.submitBtn.disabled = false;
    hideStatus();

    drawCountries(country.country, []);
    updateUI();

    if (!isMobileDevice()) {
      ui.answerInput.focus();
    }
  }

  function checkAnswer() {
    if (continueMode) {
      if (isProcessing) return;
      isProcessing = true;
      continueMode = false;
      nextQ();
      isProcessing = false;
      return;
    }

    if (isProcessing) return;

    const userAnswer = ui.answerInput.value.trim();
    isProcessing = true;
    const result = gameLogic.checkAnswer(userAnswer);

    if (result.action === 'ignore') {
      isProcessing = false;
      return;
    }

    if (result.isCorrect) {
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
      continueTimer = setTimeout(() => {
        isProcessing = false;
        nextQ();
      }, AUTO_MS_CORRECT);
    } else {
      // Wrong or skip — show correct answer, enter Continue mode
      shakeWrong(ui.answerInput);
      hapticFeedback('wrong');
      showStatus(result.message, false);
      updateUI();

      if (revealAnswer) {
        const current = gameLogic.getCurrentCountry();
        const countryNeighbors = neighbors[current.country] || [];
        revealAnswer(current.country, countryNeighbors);
      }

      enterContinueMode();
      isProcessing = false;
    }
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
        { label: 'Correct', value: finalResult.correct },
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
    markHintUsed: () => gameLogic.markHintUsed(),
  };
}
