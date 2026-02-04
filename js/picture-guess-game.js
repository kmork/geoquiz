export function createPictureGuessGame({ ui, confetti }) {
  let sites = [];
  let currentIndex = 0;
  let score = 0;
  let perfectGuesses = 0; // Correct on first try
  let totalCorrect = 0;    // Correct on either attempt
  
  let currentAttempt = 1; // 1 = text input, 2 = multiple choice
  let answeredThisRound = false;
  let autoAdvanceTimer = null;

  const AUTO_MS_CORRECT = 2500;
  const AUTO_MS_WRONG = 3500;

  function shuffleArray(arr) {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  async function loadSites() {
    try {
      const response = await fetch("data/heritage-sites.json");
      const data = await response.json();
      // Shuffle all sites and take only first 10
      const shuffled = shuffleArray(data);
      sites = shuffled.slice(0, 10);
      console.log(`Loaded ${sites.length} heritage sites from JSON (limited to 10)`);
      return sites; // Return the loaded sites array
    } catch (err) {
      console.error("Failed to load heritage sites:", err);
      return null;
    }
  }

  function updateUI() {
    ui.scoreEl.textContent = score;
    ui.progressEl.textContent = `${currentIndex} / ${sites.length}`;
  }

  function reset() {
    clearTimeout(autoAdvanceTimer);
    sites = shuffleArray(sites);
    currentIndex = 0;
    score = 0;
    perfectGuesses = 0;
    totalCorrect = 0;
    currentAttempt = 1;
    answeredThisRound = false;
    updateUI();
  }

  function showSite() {
    if (currentIndex >= sites.length) {
      showFinalScreen();
      return;
    }

    answeredThisRound = false;
    currentAttempt = 1;
    clearTimeout(autoAdvanceTimer);

    const site = sites[currentIndex];
    console.log(`[${currentIndex + 1}/${sites.length}] Showing: ${site.siteName} (${site.country})`);
    console.log(`Image path: ${site.imageUrl}`);

    // Show image with loading state
    ui.imageLoading.style.display = 'flex';
    ui.heritageImage.style.opacity = '0';
    
    const img = new Image();
    img.onload = () => {
      console.log(`✓ Image loaded: ${site.imageUrl}`);
      ui.heritageImage.src = site.imageUrl;
      ui.heritageImage.alt = site.siteName;
      ui.imageLoading.style.display = 'none';
      ui.heritageImage.style.opacity = '1';
    };
    img.onerror = () => {
      console.error(`✗ Failed to load: ${site.imageUrl}`);
      ui.imageLoading.style.display = 'none';
      ui.heritageImage.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect fill="%23333" width="400" height="300"/><text x="50%" y="50%" fill="%23fff" text-anchor="middle">Image not available</text></svg>';
      ui.heritageImage.style.opacity = '1';
    };
    img.src = site.imageUrl;

    // Show text input section, hide others
    ui.textInputSection.style.display = 'block';
    ui.multipleChoiceSection.style.display = 'none';
    ui.status.style.display = 'none';
    ui.countryInput.value = '';
    ui.countryInput.disabled = false;
    ui.submitGuess.disabled = false;
    
    // Only auto-focus on desktop (not mobile to avoid unwanted keyboard)
    const isMobile = window.innerWidth <= 640 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile) {
      ui.countryInput.focus();
    }

    updateUI();
  }

  function handleTextGuess(guess) {
    if (answeredThisRound || currentAttempt !== 1) return;

    const site = sites[currentIndex];
    const normalizedGuess = window.normalizeCountryName(guess);
    const normalizedAnswer = window.normalizeCountryName(site.country);

    const isCorrect = normalizedGuess === normalizedAnswer;

    if (isCorrect) {
      // Correct on first try! 2 points
      score += 2;
      perfectGuesses++;
      totalCorrect++;
      answeredThisRound = true;

      ui.status.textContent = `✅ Correct! This is ${site.siteName} in ${site.country}. +2 points!`;
      ui.status.className = 'status good';
      ui.status.style.display = 'block';

      ui.countryInput.disabled = true;
      ui.submitGuess.disabled = true;

      confetti?.burst?.({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

      updateUI();

      autoAdvanceTimer = setTimeout(() => {
        currentIndex++;
        showSite();
      }, AUTO_MS_CORRECT);
    } else {
      // Wrong - show multiple choice
      currentAttempt = 2;
      ui.textInputSection.style.display = 'none';
      showMultipleChoice();
    }
  }

  function showMultipleChoice() {
    const site = sites[currentIndex];
    
    // Show hint
    ui.hintText.textContent = `Hint: ${site.hint}`;
    
    // Generate 3 wrong alternatives
    const alternatives = generateAlternatives(site);
    
    // Shuffle options
    const options = shuffleArray([...alternatives, site.country]);
    
    // Create buttons
    ui.choices.innerHTML = '';
    options.forEach((country, idx) => {
      const btn = document.createElement('button');
      btn.textContent = country;
      btn.addEventListener('click', () => handleMultipleChoiceGuess(country));
      ui.choices.appendChild(btn);
    });

    ui.multipleChoiceSection.style.display = 'block';
  }

  function handleMultipleChoiceGuess(selectedCountry) {
    if (answeredThisRound) return;
    answeredThisRound = true;

    const site = sites[currentIndex];
    const isCorrect = selectedCountry === site.country;

    // Disable all buttons and mark correct/wrong
    const buttons = ui.choices.querySelectorAll('button');
    buttons.forEach(btn => {
      btn.disabled = true;
      if (btn.textContent === site.country) {
        btn.classList.add('correct');
      } else if (btn.textContent === selectedCountry && !isCorrect) {
        btn.classList.add('wrong');
      }
    });

    if (isCorrect) {
      score += 1;
      totalCorrect++;
      ui.status.textContent = `✅ Correct! This is ${site.siteName} in ${site.country}. +1 point`;
      ui.status.className = 'status good';
      confetti?.burst?.({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

      autoAdvanceTimer = setTimeout(() => {
        currentIndex++;
        showSite();
      }, AUTO_MS_CORRECT);
    } else {
      ui.status.textContent = `❌ Wrong. This is ${site.siteName} in ${site.country}.`;
      ui.status.className = 'status bad';

      autoAdvanceTimer = setTimeout(() => {
        currentIndex++;
        showSite();
      }, AUTO_MS_WRONG);
    }

    ui.status.style.display = 'block';
    updateUI();
  }

  function generateAlternatives(correctSite) {
    // Get countries from same region first, then others
    const sameRegion = sites
      .filter(s => s.region === correctSite.region && s.country !== correctSite.country)
      .map(s => s.country);
    
    const otherCountries = sites
      .filter(s => s.region !== correctSite.region && s.country !== correctSite.country)
      .map(s => s.country);
    
    // Remove duplicates
    const uniqueSameRegion = [...new Set(sameRegion)];
    const uniqueOthers = [...new Set(otherCountries)];
    
    // Pick 2 from same region if possible, otherwise fill from others
    const alternatives = [];
    const shuffledSameRegion = shuffleArray(uniqueSameRegion);
    const shuffledOthers = shuffleArray(uniqueOthers);
    
    // Try to get 2-3 from same region
    for (let i = 0; i < Math.min(2, shuffledSameRegion.length); i++) {
      alternatives.push(shuffledSameRegion[i]);
    }
    
    // Fill remaining from others
    for (let i = 0; i < shuffledOthers.length && alternatives.length < 3; i++) {
      if (!alternatives.includes(shuffledOthers[i])) {
        alternatives.push(shuffledOthers[i]);
      }
    }
    
    return alternatives.slice(0, 3);
  }

  function showFinalScreen() {
    const accuracy = sites.length > 0 ? Math.round((totalCorrect / sites.length) * 100) : 0;
    const perfectRate = sites.length > 0 ? Math.round((perfectGuesses / sites.length) * 100) : 0;

    ui.finalScoreEl.textContent = score;
    ui.finalSitesEl.textContent = sites.length;
    ui.finalPerfectEl.textContent = perfectGuesses;
    ui.finalAccuracyEl.textContent = `${accuracy}%`;

    let subtitle = 'Good effort!';
    if (perfectRate >= 80) subtitle = 'Amazing! You know your world heritage! 🌟';
    else if (perfectRate >= 60) subtitle = 'Excellent work! 🎯';
    else if (perfectRate >= 40) subtitle = 'Well done! 👏';
    else if (accuracy >= 60) subtitle = 'Not bad! Keep exploring! 🗺️';

    ui.finalSubtitleEl.textContent = subtitle;
    ui.finalOverlay.style.display = 'flex';

    if (perfectRate >= 60) {
      confetti?.burst?.({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    }
  }

  return {
    loadSites,
    reset,
    showSite,
    handleTextGuess,
  };
}
