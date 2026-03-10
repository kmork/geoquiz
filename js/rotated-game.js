import { RotatedGameLogic } from "./games/rotated-logic.js";
import { isMobileDevice, hapticFeedback, shakeWrong } from "./game-utils.js";
import { renderFinishScreen } from "./game-records.js";

export function createRotatedGame({ ui, confetti, drawCountry, setRotation, animateToCorrect, getRotation, config = {} }) {
  let continueTimer = null;
  let isProcessing = false;
  let continueMode = false;

  const AUTO_MS_CORRECT = config.autoMsCorrect ?? 1200;
  const maxRounds = config.maxRounds ?? 10;
  const gameIdSuffix = config.gameIdSuffix || 'short';
  const rotateOnly = config.rotateOnly ?? false;
  const gamePrefix = config.gamePrefix || 'rotated';
  const customOnComplete = config.onComplete;

  const countryLabel = document.getElementById('country-label');

  // In rotate-only mode, hide the text input and show country name label
  if (rotateOnly) {
    ui.answerInput.style.display = 'none';
    ui.submitBtn.textContent = 'Submit';
    if (countryLabel) countryLabel.style.display = '';
  }

  const gameLogic = new RotatedGameLogic({
    maxRounds,
    rotateOnly,
    onAnswer: () => {},
    onComplete: (finalResult) => {
      if (customOnComplete) {
        customOnComplete(finalResult);
      } else {
        showFinal(finalResult);
      }
    }
  });

  function updateUI() {
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
    if (!rotateOnly) ui.answerInput.value = "";
    continueMode = false;
    if (ui.statusEl) ui.statusEl.style.display = "none";
  }

  function showStatus(msg, isCorrect) {
    if (!ui.statusEl) return;
    ui.statusEl.textContent = msg;
    ui.statusEl.className = "status " + (isCorrect ? "correct" : "wrong");
    ui.statusEl.style.display = "block";
  }

  function enterContinueMode() {
    continueMode = true;
    if (!rotateOnly) ui.answerInput.style.display = "none";
    ui.submitBtn.textContent = "Continue →";
    ui.submitBtn.disabled = false;
    ui.submitBtn.classList.add("continue-btn");
    setTimeout(() => ui.submitBtn.focus(), 50);
  }

  function exitContinueMode() {
    continueMode = false;
    if (!rotateOnly) ui.answerInput.style.display = "";
    ui.submitBtn.textContent = rotateOnly ? "Submit" : "Guess";
    ui.submitBtn.classList.remove("continue-btn");
  }

  function nextQ() {
    if (continueTimer) {
      clearTimeout(continueTimer);
      continueTimer = null;
    }

    exitContinueMode();

    const country = gameLogic.nextRound();
    if (!country) return;

    const angle = gameLogic.getRandomAngle();

    if (!rotateOnly) {
      ui.answerInput.value = "";
      ui.answerInput.disabled = false;
    }
    ui.submitBtn.disabled = false;
    if (ui.statusEl) ui.statusEl.style.display = "none";

    // Show country name in rotate-only mode
    if (rotateOnly && countryLabel) {
      countryLabel.textContent = country.country;
      countryLabel.style.display = '';
    }

    drawCountry(country.country);
    setRotation(angle);
    updateUI();

    if (!rotateOnly && !isMobileDevice()) {
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

    const userAnswer = rotateOnly ? gameLogic.getCurrentCountry().country : ui.answerInput.value.trim();
    const currentAngle = getRotation();
    isProcessing = true;
    const result = gameLogic.checkAnswer(userAnswer, currentAngle);

    if (result.action === 'ignore') {
      isProcessing = false;
      return;
    }

    if (result.isCorrect) {
      if (!rotateOnly) ui.answerInput.disabled = true;
      ui.submitBtn.disabled = true;

      showStatus(result.message, true);
      confetti?.burst?.({ x: innerWidth / 2, y: innerHeight / 2 });
      hapticFeedback('correct');
      updateUI();

      animateToCorrect();

      continueTimer = setTimeout(() => {
        isProcessing = false;
        nextQ();
      }, AUTO_MS_CORRECT);
    } else {
      if (!rotateOnly) shakeWrong(ui.answerInput);
      hapticFeedback('wrong');
      showStatus(result.message, false);
      updateUI();

      animateToCorrect();

      enterContinueMode();
      isProcessing = false;
    }
  }

  function showFinal(finalResult) {
    if (!ui.finalOverlay) return;

    if (countryLabel) countryLabel.style.display = 'none';

    renderFinishScreen(ui.finalOverlay, {
      gameId: `${gamePrefix}-${gameIdSuffix}`,
      score: finalResult.score,
      scoreLabel: 'Points',
      maxScore: finalResult.total * 180,
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
  };
}
