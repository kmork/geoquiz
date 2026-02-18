import { TriviaGameLogic } from "./games/trivia-logic.js";
import { hapticFeedback } from "./game-utils.js";
import { renderFinishScreen } from "./game-records.js";

export function createTriviaGame({ ui, confetti, config = {} }) {
  let autoAdvanceTimer = null;
  let currentShuffledOptions = [];

  const AUTO_MS = config.autoMs ?? 4000; // Time to show explanation before next question
  const hideScoreUI = config.hideScoreUI ?? false;
  const singleRound = config.singleRound ?? false;
  const maxCount = config.maxCount ?? 10;
  const gameIdSuffix = config.gameIdSuffix || 'short';
  const customOnAnswer = config.onAnswer;
  const customOnComplete = config.onComplete;

  // Create game logic instance
  const gameLogic = new TriviaGameLogic({
    singleRound,
    maxCount,
    onAnswer: (result) => {
      // Update UI with answer feedback
      showAnswerFeedback(result);
      // Call custom callback if provided
      if (customOnAnswer) customOnAnswer(result);
    },
    onComplete: (finalResult) => {
      if (customOnComplete) {
        customOnComplete(finalResult);
      } else {
        showFinalScreen(finalResult);
      }
    }
  });

  async function loadQuestions() {
    return await gameLogic.loadQuestions();
  }

  function updateUI() {
    if (hideScoreUI) return;
    const progress = gameLogic.getProgress();
    if (ui.scoreEl) ui.scoreEl.textContent = progress.score;
    if (ui.progressEl) ui.progressEl.textContent = `${progress.current} / ${progress.total}`;
  }

  function showQuestion() {
    if (!gameLogic.hasMoreQuestions()) {
      return;
    }

    clearTimeout(autoAdvanceTimer);

    const q = gameLogic.getCurrentQuestion();
    currentShuffledOptions = gameLogic.getShuffledOptions();
    
    ui.questionText.textContent = q.question;
    ui.explanation.style.display = "none";
    ui.choices.innerHTML = "";

    // Create choice buttons
    currentShuffledOptions.forEach((option, idx) => {
      const btn = document.createElement("button");
      btn.textContent = option;
      btn.addEventListener("click", () => handleAnswer(option));
      ui.choices.appendChild(btn);
    });

    gameLogic.startQuestion();
    updateUI();
  }

  function handleAnswer(selectedOption) {
    const result = gameLogic.submitAnswer(selectedOption);
    
    if (result.correct) {
      confetti?.burst?.({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    } else {
      hapticFeedback('wrong');
    }

    showAnswerFeedback(result);

    // Auto-advance to next question
    if (!result.isLastQuestion) {
      autoAdvanceTimer = setTimeout(() => {
        gameLogic.advance();
        showQuestion();
      }, AUTO_MS);
    }
  }

  function showAnswerFeedback(result) {
    // Show correct/wrong on buttons
    const buttons = ui.choices.querySelectorAll("button");
    buttons.forEach((btn) => {
      btn.disabled = true;
      if (btn.textContent === result.correctAnswer) {
        btn.classList.add("correct");
      } else if (btn.textContent === result.selectedOption && !result.correct) {
        btn.classList.add("wrong");
      }
    });

    // Show explanation
    ui.explanation.textContent = result.explanation;
    ui.explanation.style.display = "block";
    ui.explanation.className = result.correct ? "status good" : "status bad";

    updateUI();
  }

  function showFinalScreen(finalResult) {
    if (hideScoreUI || !ui.finalOverlay) return;

    renderFinishScreen(ui.finalOverlay, {
      gameId: `trivia-${gameIdSuffix}`,
      score: finalResult.score,
      scoreLabel: 'Score',
      maxScore: finalResult.total,
      time: finalResult.time,
      accuracy: finalResult.accuracy,
      stats: [
        { label: 'Correct', value: finalResult.correctCount },
        { label: 'Accuracy', value: `${finalResult.accuracy}%` },
      ],
      onPlayAgain: () => {
        reset();
        showQuestion();
      },
    });

    ui.finalOverlay.style.display = "flex";
    confetti?.burst?.({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  }

  function reset() {
    clearTimeout(autoAdvanceTimer);
    gameLogic.reset();
  }

  function cleanup() {
    clearTimeout(autoAdvanceTimer);
  }

  return {
    loadQuestions,
    showQuestion,
    reset,
    cleanup,
    setQuestion: (question) => gameLogic.setQuestions([question]),
  };
}
