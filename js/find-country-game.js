export function createFindCountryGame({ ui, confetti, checkClickedCountry, highlightCountry, zoomToCountries, resetMapView }) {
  const DATA = window.DATA;
  const MAX_ROUNDS = 10;

  let deck = [];
  let current = null;

  let score = 0;
  let correctCount = 0;

  let roundEnded = false;
  let continueTimer = null;
  let selectedCountry = null; // Track first click selection

  const AUTO_MS_CORRECT = 1500;
  const AUTO_MS_WRONG = 2000;

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
    correctCount = 0;
    roundEnded = false;
    updateUI();
  }

  function getCurrent() {
    return current || { country: "" };
  }

  function showStatus(msg, isCorrect) {
    // Status removed from UI - no-op
  }

  function hideStatus() {
    // Status removed from UI - no-op
  }

  function nextQ() {
    console.log("nextQ() called, roundEnded:", roundEnded);
    
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
    roundEnded = false;
    selectedCountry = null; // Clear selection for new question
    hideStatus();

    // Reset map to full world view and clear highlights
    resetMapView();

    // Update country name display
    ui.countryNameEl.textContent = current.country;

    updateUI();
  }

  function handleMapClick(clickedCountryName) {
    if (roundEnded) {
      console.log("Round already ended, ignoring click");
      return;
    }
    if (!current) return;

    console.log(`Clicked: "${clickedCountryName}"`);

    // First click or different country: Just select/highlight
    if (selectedCountry !== clickedCountryName) {
      selectedCountry = clickedCountryName;
      highlightCountry(clickedCountryName, "selected");
      console.log(`Selected: "${clickedCountryName}" - click again to confirm`);
      return;
    }

    // Second click on same country: Submit answer
    console.log(`Confirming guess: "${clickedCountryName}" vs target: "${current.country}"`);
    const isCorrect = clickedCountryName === current.country;

    if (isCorrect) {
      // Correct!
      score += 1;
      correctCount++;
      showStatus(`✅ Correct! +1 point`, true);
      roundEnded = true;
      
      // Highlight correct country in green
      highlightCountry(current.country, "correct");
      confetti?.burst?.({ x: innerWidth / 2, y: innerHeight / 2 });
      
      updateUI();
      continueTimer = setTimeout(() => nextQ(), AUTO_MS_CORRECT);
    } else {
      // Wrong - show both wrong (red) and correct (green)
      showStatus(`❌ Wrong. The answer was: ${current.country}`, false);
      roundEnded = true;
      
      // Zoom to show both countries
      zoomToCountries(clickedCountryName, current.country);
      
      // Highlight wrong country in red, then correct in green
      highlightCountry(clickedCountryName, "wrong");
      setTimeout(() => {
        highlightCountry(current.country, "correct");
      }, 300);
      
      continueTimer = setTimeout(() => nextQ(), AUTO_MS_WRONG);
    }
  }

  function showFinal() {
    const accuracy = MAX_ROUNDS > 0 ? Math.round((correctCount / MAX_ROUNDS) * 100) : 0;
    
    ui.finalScoreEl.textContent = score;
    ui.finalCountriesEl.textContent = MAX_ROUNDS;
    ui.finalCorrectEl.textContent = correctCount;
    ui.finalAccuracyEl.textContent = `${accuracy}%`;

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

  return {
    reset,
    nextQ,
    getCurrent,
    handleMapClick,
  };
}
