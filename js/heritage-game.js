import { shuffleArray } from "./game-utils.js";
import { renderHeritageUI, setupHeritageAutocomplete } from "./ui-components/heritage-ui.js";

export function createHeritageGame({ container, confetti, config = {} }) {
  let sites = [];
  let currentIndex = 0;
  let score = 0;
  let perfectGuesses = 0; // Correct on first try
  let totalCorrect = 0;    // Correct on either attempt
  
  let currentAttempt = 1; // 1 = text input, 2 = multiple choice
  let answeredThisRound = false;
  let autoAdvanceTimer = null;
  let currentUI = null;

  const AUTO_MS_CORRECT = config.autoMsCorrect ?? 2500;
  const AUTO_MS_WRONG = config.autoMsWrong ?? 3500;
  const hideScoreUI = config.hideScoreUI ?? false;
  const singleRound = config.singleRound ?? false;
  const customOnAnswer = config.onAnswer;
  const customOnComplete = config.onComplete;
  
  // UI element refs (for progress/final screen)
  const scoreEl = hideScoreUI ? null : document.getElementById("score");
  const progressEl = hideScoreUI ? null : document.getElementById("progress");
  const finalOverlay = hideScoreUI ? null : document.getElementById("finalOverlay");
  const finalScoreEl = hideScoreUI ? null : document.getElementById("finalScore");
  const finalSitesEl = hideScoreUI ? null : document.getElementById("finalSites");
  const finalPerfectEl = hideScoreUI ? null : document.getElementById("finalPerfect");
  const finalAccuracyEl = hideScoreUI ? null : document.getElementById("finalAccuracy");
  const finalSubtitleEl = hideScoreUI ? null : document.getElementById("finalSubtitle");

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
    if (scoreEl) scoreEl.textContent = score;
    if (progressEl) progressEl.textContent = `${currentIndex} / ${sites.length}`;
  }

  function showSite() {
    if (currentIndex >= sites.length) {
      if (singleRound && customOnComplete) {
        customOnComplete({
          score,
          correctCount: totalCorrect,
          perfectCount: perfectGuesses,
          total: sites.length
        });
      } else {
        showFinal();
      }
      return;
    }

    const site = sites[currentIndex];
    currentAttempt = 1;
    answeredThisRound = false;
    clearTimeout(autoAdvanceTimer);

    // Render UI using shared component
    currentUI = renderHeritageUI(container, site, {
      showProgress: false, // Using external progress display
      allowMultipleChoice: true,
      showHint: true,
      onAnswer: handleTextGuess,
      onHintUsed: () => console.log('Hint used')
    });
    
    // Setup autocomplete with all country names
    const countryList = window.DATA.map(c => c.country);
    
    // Add country aliases to autocomplete
    if (window.COUNTRY_ALIASES) {
      Object.values(window.COUNTRY_ALIASES).forEach(alias => {
        if (!countryList.includes(alias)) {
          countryList.push(alias);
        }
      });
    }
    
    setupHeritageAutocomplete(currentUI.elements.input, countryList.sort());

    updateUI();
  }

  function handleTextGuess({ answer, hintUsed }) {
    if (answeredThisRound || currentAttempt !== 1) return;

    const site = sites[currentIndex];
    const normalizedGuess = window.normalizeCountryName(answer);
    const normalizedAnswer = window.normalizeCountryName(site.country);

    const isCorrect = normalizedGuess === normalizedAnswer;

    if (isCorrect) {
      // Correct on first try! 2 points
      score += 2;
      perfectGuesses++;
      totalCorrect++;
      answeredThisRound = true;

      currentUI.showFeedback(`✅ Correct! This is ${site.siteName} in ${site.country}. +2 points!`, true);

      confetti?.burst?.({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

      updateUI();
      
      // Call custom callback if provided
      if (customOnAnswer) customOnAnswer({ isCorrect: true, points: 2 });

      if (singleRound) {
        // For single round mode, immediately resolve with result
        if (customOnComplete) {
          customOnComplete({
            correct: true,
            score: 2,
            time: 0 // TODO: track time if needed
          });
        }
      } else {
        autoAdvanceTimer = setTimeout(() => {
          currentIndex++;
          showSite();
        }, AUTO_MS_CORRECT);
      }
    } else {
      // Wrong - show multiple choice
      currentAttempt = 2;
      showMultipleChoice();
    }
  }

  function showMultipleChoice() {
    const site = sites[currentIndex];
    
    // Generate 3 wrong answers from same region
    const wrongAnswers = generateAlternatives(site, 3);
    const allOptions = [site.country, ...wrongAnswers];
    const shuffled = shuffleArray(allOptions);
    
    currentUI.showMultipleChoice(shuffled, handleChoiceClick);
  }

  function handleChoiceClick(selected) {
    if (answeredThisRound) return;
    
    const site = sites[currentIndex];
    const normalizedSelected = window.normalizeCountryName(selected);
    const normalizedAnswer = window.normalizeCountryName(site.country);
    const isCorrect = normalizedSelected === normalizedAnswer;

    answeredThisRound = true;
    currentUI.highlightChoices(site.country, selected);

    if (isCorrect) {
      // Correct on second try! 1 point
      score += 1;
      totalCorrect++;
      currentUI.showFeedback(`✅ Correct! This is ${site.siteName} in ${site.country}. +1 point!`, true);
      confetti?.burst?.({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      
      if (customOnAnswer) customOnAnswer({ isCorrect: true, points: 1 });
    } else {
      // Wrong on second try - no points
      currentUI.showFeedback(`❌ Wrong. This is ${site.siteName} in ${site.country}.`, false);
      
      if (customOnAnswer) customOnAnswer({ isCorrect: false, points: 0 });
    }

    updateUI();

    if (singleRound) {
      if (customOnComplete) {
        customOnComplete({
          correct: isCorrect,
          score: isCorrect ? 1 : 0,
          time: 0
        });
      }
    } else {
      autoAdvanceTimer = setTimeout(() => {
        currentIndex++;
        showSite();
      }, isCorrect ? AUTO_MS_CORRECT : AUTO_MS_WRONG);
    }
  }

  function generateAlternatives(site, count) {
    // Filter sites from same region, excluding the current one
    const sameRegion = sites.filter(s => 
      s.region === site.region && s.country !== site.country
    );
    
    // If not enough from same region, use any other sites
    const alternatives = sameRegion.length >= count
      ? sameRegion
      : [...sameRegion, ...sites.filter(s => s.country !== site.country)];
    
    // Shuffle and take `count` countries
    const shuffled = shuffleArray(alternatives);
    return shuffled.slice(0, count).map(s => s.country);
  }

  function showFinal() {
    if (hideScoreUI || !finalOverlay) return;
    
    if (finalScoreEl) finalScoreEl.textContent = score;
    if (finalSitesEl) finalSitesEl.textContent = sites.length;
    if (finalPerfectEl) finalPerfectEl.textContent = perfectGuesses;
    if (finalAccuracyEl) finalAccuracyEl.textContent = `${Math.round((totalCorrect / sites.length) * 100)}%`;

    let subtitle = "Great job!";
    const accuracy = Math.round((totalCorrect / sites.length) * 100);
    if (accuracy === 100 && perfectGuesses === sites.length) subtitle = "Perfect score! 🌟";
    else if (accuracy === 100) subtitle = "All correct! 🎯";
    else if (accuracy >= 80) subtitle = "Excellent work! 🎉";
    else if (accuracy >= 60) subtitle = "Well done! 👍";
    
    if (finalSubtitleEl) finalSubtitleEl.textContent = subtitle;
    
    finalOverlay.style.display = "flex";
    
    const playAgainBtn = document.getElementById("playAgain");
    const closeFinalBtn = document.getElementById("closeFinal");
    
    if (playAgainBtn) {
      playAgainBtn.onclick = () => {
        finalOverlay.style.display = "none";
        reset();
        showSite();
      };
    }
    
    if (closeFinalBtn) {
      closeFinalBtn.onclick = () => {
        finalOverlay.style.display = "none";
      };
    }
  }

  function reset() {
    currentIndex = 0;
    score = 0;
    perfectGuesses = 0;
    totalCorrect = 0;
    currentAttempt = 1;
    answeredThisRound = false;
    clearTimeout(autoAdvanceTimer);
    
    // Re-shuffle sites
    sites = shuffleArray(sites);
    
    updateUI();
  }

  function setSites(newSites) {
    if (singleRound && newSites.length === 1) {
      // For single round, keep all loaded sites but set currentIndex to the target
      const targetSite = newSites[0];
      const siteIndex = sites.findIndex(s => 
        s.siteName === targetSite.siteName && s.country === targetSite.country
      );
      
      if (siteIndex !== -1) {
        currentIndex = siteIndex;
      } else {
        // If site not in current list, add it at index 0
        sites.unshift(targetSite);
        currentIndex = 0;
      }
    } else {
      sites = newSites;
      currentIndex = 0;
    }
  }

  function setSite(site) {
    setSites([site]);
  }

  return {
    loadSites,
    showQuestion: showSite,
    reset,
    setSites,
    setSite
  };
}

// Export with old name for backward compatibility
export { createHeritageGame as createPictureGuessGame };
