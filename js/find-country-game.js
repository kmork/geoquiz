import { FindCountryGameLogic } from "./games/find-logic.js";
import { hapticFeedback } from "./game-utils.js";
import { renderFinishScreen } from "./game-records.js";

export function createFindCountryGame({ ui, confetti, checkClickedCountry, highlightCountry, zoomToCountries, resetMapView, config = {} }) {
  let continueTimer = null;

  const AUTO_MS_CORRECT = config.autoMsCorrect ?? 1500;
  const AUTO_MS_WRONG = config.autoMsWrong ?? 2000;
  const hideScoreUI = config.hideScoreUI ?? false;
  const singleRound = config.singleRound ?? false;
  const customOnAnswer = config.onAnswer;
  const customOnComplete = config.onComplete;

  const maxRounds = config.maxRounds ?? 10;
  const gameIdSuffix = config.gameIdSuffix || 'short';
  const streakMode = config.streakMode ?? false;

  // Create game logic instance
  const gameLogic = new FindCountryGameLogic({
    singleRound,
    maxRounds,
    easyMode: config.easyMode ?? false,
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
    if (ui.progressEl) ui.progressEl.textContent = streakMode ? `Streak: ${progress.score}` : `${progress.current} / ${progress.total}`;
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
    if (ui.countryNameEl) ui.countryNameEl.textContent = country.country;
    updateUI();
  }

  function handleMapClick(clickedCountryName, hintUsed = false) {
    const result = gameLogic.handleClick(clickedCountryName, hintUsed);
    
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
      showStatus(`✅ Correct! +${result.hintUsed ? 1 : 2} points`, true);
      highlightCountry(result.correctCountry, "correct_self");
      confetti?.burst?.({ x: innerWidth / 2, y: innerHeight / 2 });
      updateUI();
      continueTimer = setTimeout(() => nextQ(), AUTO_MS_CORRECT);
    } else {
      hapticFeedback('wrong');
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

      if (streakMode) {
        continueTimer = setTimeout(() => {
          const progress = gameLogic.getProgress();
          showFinal({
            score: progress.score,
            total: progress.total,
            correctCount: gameLogic.correctCount,
            accuracy: gameLogic.getAccuracy(),
            time: gameLogic.gameStartTime ? (Date.now() - gameLogic.gameStartTime) / 1000 : 0,
          });
        }, AUTO_MS_WRONG);
      } else {
        continueTimer = setTimeout(() => nextQ(), AUTO_MS_WRONG);
      }
    }
  }

  function showFinal(finalResult) {
    if (hideScoreUI || !ui.finalOverlay) return;

    renderFinishScreen(ui.finalOverlay, {
      gameId: `find-${gameIdSuffix}`,
      score: streakMode ? finalResult.correctCount : finalResult.score,
      scoreLabel: streakMode ? 'Streak' : 'Score',
      maxScore: streakMode ? null : finalResult.total * 2,
      time: finalResult.time,
      accuracy: streakMode ? 0 : finalResult.accuracy,
      stats: streakMode ? [] : [
        { label: 'Correct', value: finalResult.correctCount },
        { label: 'Accuracy', value: `${finalResult.accuracy}%` },
      ],
      shareUrl: `geoquiz.info${location.pathname}${location.search}`,
      onPlayAgain: () => {
        reset();
        nextQ();
      },
    });

    ui.finalOverlay.style.display = "flex";

    if (!streakMode && finalResult.accuracy >= 80) {
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
