export function createTriviaGame({ ui, confetti }) {
  let questions = [];
  let currentIndex = 0;
  let score = 0;
  let correctCount = 0;
  let answeredThisRound = false;
  let autoAdvanceTimer = null;

  const AUTO_MS = 4000; // Time to show explanation before next question

  function shuffleArray(arr) {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  async function loadQuestions() {
    try {
      const response = await fetch("data/qa.json");
      const data = await response.json();
      questions = shuffleArray(data);
      return true;
    } catch (err) {
      console.error("Failed to load questions:", err);
      return false;
    }
  }

  function updateUI() {
    ui.scoreEl.textContent = score;
    ui.progressEl.textContent = `${currentIndex} / ${questions.length}`;
  }

  function showQuestion() {
    if (currentIndex >= questions.length) {
      showFinalScreen();
      return;
    }

    answeredThisRound = false;
    clearTimeout(autoAdvanceTimer);

    const q = questions[currentIndex];
    ui.questionText.textContent = q.question;
    ui.explanation.style.display = "none";
    ui.choices.innerHTML = "";

    // Create choice buttons
    q.options.forEach((option, idx) => {
      const btn = document.createElement("button");
      btn.textContent = option;
      btn.addEventListener("click", () => handleAnswer(idx));
      ui.choices.appendChild(btn);
    });

    updateUI();
  }

  function handleAnswer(selectedIdx) {
    if (answeredThisRound) return;
    answeredThisRound = true;

    const q = questions[currentIndex];
    const isCorrect = selectedIdx === q.answer;

    // Update score
    if (isCorrect) {
      score++;
      correctCount++;
      confetti?.burst?.({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    }

    // Show correct/wrong on buttons
    const buttons = ui.choices.querySelectorAll("button");
    buttons.forEach((btn, idx) => {
      btn.disabled = true;
      if (idx === q.answer) {
        btn.classList.add("correct");
      } else if (idx === selectedIdx && !isCorrect) {
        btn.classList.add("wrong");
      }
    });

    // Show explanation
    ui.explanation.textContent = q.explanation;
    ui.explanation.style.display = "block";
    ui.explanation.className = isCorrect ? "status good" : "status bad";

    updateUI();

    // Auto-advance to next question
    autoAdvanceTimer = setTimeout(() => {
      currentIndex++;
      showQuestion();
    }, AUTO_MS);
  }

  function showFinalScreen() {
    const accuracy = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
    
    ui.finalScore.textContent = score;
    ui.finalTotal.textContent = questions.length;
    ui.finalCorrect.textContent = correctCount;
    ui.finalAccuracy.textContent = `${accuracy}%`;
    
    if (accuracy === 100) {
      ui.finalSubtitle.textContent = "Perfect score! Amazing! 🎊";
    } else if (accuracy >= 80) {
      ui.finalSubtitle.textContent = "Excellent work! 🌟";
    } else if (accuracy >= 60) {
      ui.finalSubtitle.textContent = "Good job! 👍";
    } else {
      ui.finalSubtitle.textContent = "Keep practicing! 💪";
    }

    ui.finalOverlay.style.display = "flex";
    confetti?.burst?.({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  }

  function reset() {
    currentIndex = 0;
    score = 0;
    correctCount = 0;
    answeredThisRound = false;
    clearTimeout(autoAdvanceTimer);
    questions = shuffleArray(questions);
  }

  return {
    loadQuestions,
    showQuestion,
    reset,
  };
}
