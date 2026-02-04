import { norm } from "./utils.js";

// Helper to detect mobile devices
function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
    || (window.innerWidth <= 640);
}

// Haptic feedback helper
function hapticFeedback(pattern) {
  if (!navigator.vibrate) return;
  if (!isMobileDevice()) return;
  
  if (pattern === 'correct') {
    navigator.vibrate(50);
  } else if (pattern === 'wrong') {
    navigator.vibrate([100, 50, 100]);
  }
}

// Visual feedback helpers
function flashCorrect(element) {
  if (!element) return;
  element.classList.remove('flash-correct');
  void element.offsetWidth;
  element.classList.add('flash-correct');
  setTimeout(() => element.classList.remove('flash-correct'), 600);
}

function shakeWrong(element) {
  if (!element) return;
  element.classList.remove('shake-wrong');
  void element.offsetWidth;
  element.classList.add('shake-wrong');
  setTimeout(() => element.classList.remove('shake-wrong'), 500);
}

export function createOutlinesGame({ ui, neighbors, confetti, drawCountries }) {
  const DATA = window.DATA;
  const MAX_ROUNDS = 10;

  let deck = [];
  let current = null;

  let score = 0;
  let correctFirstTry = 0;
  let correctAny = 0;

  let attempt = 0; // 0 = not started, 1 = first attempt, 2 = second attempt
  let roundEnded = false;
  let continueTimer = null;

  const AUTO_MS_CORRECT_FIRST = 900;
  const AUTO_MS_CORRECT_SECOND = 1100;
  const AUTO_MS_WRONG_SECOND = 1700;

  function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function updateUI() {
    ui.scoreEl.textContent = score;
    ui.progressEl.textContent = `${MAX_ROUNDS - deck.length} / ${MAX_ROUNDS}`;
  }

  function reset() {
    // Clear any pending timer
    if (continueTimer) {
      clearTimeout(continueTimer);
      continueTimer = null;
    }

    // Shuffle all countries and take only first 10
    deck = shuffleInPlace([...DATA]).slice(0, MAX_ROUNDS);
    current = null;
    score = 0;
    correctFirstTry = 0;
    correctAny = 0;
    attempt = 0;
    roundEnded = false;
    updateUI();
    ui.answerInput.value = "";
    ui.statusEl.style.display = "none";
  }

  function getCurrent() {
    return current?.country || "";
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
    console.log("nextQ() called, roundEnded:", roundEnded, "attempt:", attempt);
    
    if (deck.length === 0) {
      showFinal();
      return;
    }

    // Clear any pending auto-continue timer
    if (continueTimer) {
      clearTimeout(continueTimer);
      continueTimer = null;
    }

    current = deck.pop();
    attempt = 0;
    roundEnded = false;
    ui.answerInput.value = "";
    ui.answerInput.disabled = false;
    ui.submitBtn.disabled = false;
    hideStatus();

    console.log("Starting new question:", current.country, "input disabled:", ui.answerInput.disabled, "button disabled:", ui.submitBtn.disabled);

    // Draw only the target country (no neighbors yet)
    const countryNeighbors = neighbors[current.country] || [];
    drawCountries(current.country, []);

    updateUI();
    // Only auto-focus on desktop (not mobile to avoid unwanted keyboard)
    if (!isMobileDevice()) {
      ui.answerInput.focus();
    }
  }

  function checkAnswer() {
    if (roundEnded) {
      console.log("Round already ended, ignoring input");
      return;
    }
    if (attempt >= 2) {
      console.log("Already made 2 attempts, ignoring input");
      return;
    }

    const userAnswer = ui.answerInput.value.trim();

    console.log(`Attempt ${attempt + 1}: "${userAnswer}" vs "${current.country}"`);
    attempt++;

    // Empty answer is treated as wrong (allows skipping to see neighbors)
    if (!userAnswer) {
      // Wrong answer (empty = skip)
      shakeWrong(ui.answerInput);
      hapticFeedback('wrong');
      if (attempt === 1) {
        // First attempt - show neighbors
        showStatus(`❌ Try again with neighbor hints!`, false);
        ui.answerInput.value = "";
        if (!isMobileDevice()) {
          ui.answerInput.focus();
        }
        
        // Draw country WITH neighbors
        const countryNeighbors = neighbors[current.country] || [];
        drawCountries(current.country, countryNeighbors);
      } else {
        // Second attempt - move on
        showStatus(`❌ Skipped. The answer was: ${current.country}`, false);
        roundEnded = true;
        ui.answerInput.disabled = true;
        ui.submitBtn.disabled = true;
        continueTimer = setTimeout(() => nextQ(), AUTO_MS_WRONG_SECOND);
      }
      return;
    }

    const normAnswer = norm(userAnswer);
    const normCountry = norm(current.country);

    // Check if the answer is an alias first
    let searchName = userAnswer;
    for (const [alias, official] of Object.entries(window.COUNTRY_ALIASES || {})) {
      if (norm(alias) === normAnswer) {
        searchName = official;
        break;
      }
    }

    const isCorrect = norm(searchName) === normCountry;

    if (isCorrect) {
      // Correct answer
      flashCorrect(document.querySelector('.card'));
      hapticFeedback('correct');
      confetti?.burst?.({ x: innerWidth / 2, y: innerHeight / 2 });
      if (attempt === 1) {
        score += 2;
        correctFirstTry++;
        showStatus(`✅ Correct! +2 points`, true);
        correctAny++;
        roundEnded = true;
        ui.answerInput.disabled = true;
        ui.submitBtn.disabled = true;
        continueTimer = setTimeout(() => nextQ(), AUTO_MS_CORRECT_FIRST);
      } else {
        score += 1;
        showStatus(`✅ Correct! +1 point`, true);
        correctAny++;
        roundEnded = true;
        ui.answerInput.disabled = true;
        ui.submitBtn.disabled = true;
        continueTimer = setTimeout(() => nextQ(), AUTO_MS_CORRECT_SECOND);
      }
      updateUI();
    } else {
      // Wrong answer
      shakeWrong(ui.answerInput);
      hapticFeedback('wrong');
      if (attempt === 1) {
        // First wrong attempt - show neighbors
        showStatus(`❌ Not quite. Try again with neighbor hints!`, false);
        ui.answerInput.value = "";
        if (!isMobileDevice()) {
          ui.answerInput.focus();
        }
        
        // Draw country WITH neighbors
        const countryNeighbors = neighbors[current.country] || [];
        drawCountries(current.country, countryNeighbors);
      } else {
        // Second wrong attempt - move on
        showStatus(`❌ Wrong. The answer was: ${current.country}`, false);
        roundEnded = true;
        ui.answerInput.disabled = true;
        ui.submitBtn.disabled = true;
        continueTimer = setTimeout(() => nextQ(), AUTO_MS_WRONG_SECOND);
      }
    }
  }

  function showFinal() {
    const accuracy = MAX_ROUNDS > 0 ? Math.round((correctAny / MAX_ROUNDS) * 100) : 0;
    
    ui.finalScoreEl.textContent = score;
    ui.finalCountriesEl.textContent = MAX_ROUNDS;
    ui.finalCorrectEl.textContent = correctAny;
    ui.finalFirstTryEl.textContent = correctFirstTry;

    let subtitle = "Great job!";
    if (accuracy === 100) subtitle = "Perfect score! 🌟";
    else if (accuracy >= 80) subtitle = "Excellent work! 🎯";
    else if (accuracy >= 60) subtitle = "Well done! 👏";
    
    ui.finalSubtitleEl.textContent = subtitle;
    ui.finalOverlay.style.display = "flex";

    if (accuracy >= 80) {
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
  };
}
