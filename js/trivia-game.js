import { TriviaGameLogic } from "./games/trivia-logic.js";

export function createTriviaGame({ ui, confetti, config = {} }) {
  let autoAdvanceTimer = null;
  let currentShuffledOptions = [];

  const AUTO_MS = config.autoMs ?? 4000; // Time to show explanation before next question
  const hideScoreUI = config.hideScoreUI ?? false;
  const singleRound = config.singleRound ?? false;
  const customOnAnswer = config.onAnswer;
  const customOnComplete = config.onComplete;

  // Create game logic instance
  const gameLogic = new TriviaGameLogic({
    singleRound,
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
      } else if (btn.textContent !== result.correctAnswer && result.correct === false) {
        // Highlight wrong answer if user was incorrect
        const selectedWasThis = !result.correct && currentShuffledOptions.includes(btn.textContent);
        if (selectedWasThis) {
          btn.classList.add("wrong");
        }
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
    
    if (ui.finalScore) ui.finalScore.textContent = finalResult.score;
    if (ui.finalTotal) ui.finalTotal.textContent = finalResult.total;
    if (ui.finalCorrect) ui.finalCorrect.textContent = finalResult.correctCount;
    if (ui.finalAccuracy) ui.finalAccuracy.textContent = `${finalResult.accuracy}%`;
    
    if (ui.finalSubtitle) {
      if (finalResult.accuracy === 100) {
        ui.finalSubtitle.textContent = "Perfect score! Amazing! 🎊";
      } else if (finalResult.accuracy >= 80) {
        ui.finalSubtitle.textContent = "Excellent work! 🌟";
      } else if (finalResult.accuracy >= 60) {
        ui.finalSubtitle.textContent = "Good job! 👍";
      } else {
        ui.finalSubtitle.textContent = "Keep practicing! 💪";
      }
    }

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
