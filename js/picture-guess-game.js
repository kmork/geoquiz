import { shuffleArray } from "./game-utils.js";
import { renderPictureUI, setupPictureAutocomplete } from "./ui-components/picture-ui.js";

export function createPictureGuessGame({ container, confetti, config = {} }) {
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
  const allowMultipleChoice = config.allowMultipleChoice ?? true;
  const showHint = config.showHint ?? true;
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
    if (currentUI) {
      currentUI.updateProgress(score, currentIndex, sites.length);
    }
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
      if (customOnComplete) {
        customOnComplete({
          score,
          total: sites.length,
          correctCount: totalCorrect,
          perfectCount: perfectGuesses,
          accuracy: sites.length > 0 ? Math.round((totalCorrect / sites.length) * 100) : 0
        });
      } else {
        showFinalScreen();
      }
      return;
    }

    answeredThisRound = false;
    currentAttempt = 1;
    clearTimeout(autoAdvanceTimer);

    const site = sites[currentIndex];
    console.log(`[${currentIndex + 1}/${sites.length}] Showing: ${site.siteName} (${site.country})`);

    // Render UI using shared component
    currentUI = renderPictureUI(container, site, {
      showProgress: false, // Using external progress display
      allowMultipleChoice,
      showHint,
      onAnswer: handleTextGuess,
      onHintUsed: () => console.log('Hint used')
    });
    
    // Setup autocomplete with all country names
    const countryList = [];
    sites.forEach(s => {
      if (s.country && !countryList.includes(s.country)) {
        countryList.push(s.country);
      }
    });
    
    // Add countries from global DATA if available
    if (window.DATA && Array.isArray(window.DATA)) {
      window.DATA.forEach(item => {
        if (item.country && !countryList.includes(item.country)) {
          countryList.push(item.country);
        }
      });
    }
    
    // Add aliases if available
    if (window.COUNTRY_ALIASES) {
      Object.keys(window.COUNTRY_ALIASES).forEach(alias => {
        if (!countryList.includes(alias)) {
          countryList.push(alias);
        }
      });
    }
    
    setupPictureAutocomplete(currentUI.elements.input, countryList.sort());

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
    
    // Generate 3 wrong alternatives
    const alternatives = generateAlternatives(site);
    
    // Shuffle options
    const options = shuffleArray([...alternatives, site.country]);
    
    // Show multiple choice UI
    currentUI.showMultipleChoice(options, handleMultipleChoiceGuess);
  }

  function handleMultipleChoiceGuess(selectedCountry) {
    if (answeredThisRound) return;
    answeredThisRound = true;

    const site = sites[currentIndex];
    const isCorrect = selectedCountry === site.country;

    // Highlight correct/wrong
    currentUI.highlightChoices(site.country, selectedCountry);

    if (isCorrect) {
      score += 1;
      totalCorrect++;
      currentUI.showFeedback(`✅ Correct! This is ${site.siteName} in ${site.country}. +1 point`, true);
      
      // Call custom callback if provided
      if (customOnAnswer) customOnAnswer({ isCorrect: true, points: 1 });
      
      if (singleRound) {
        // For single round mode, immediately resolve with result
        if (customOnComplete) {
          customOnComplete({
            correct: true,
            score: 1,
            time: 0 // TODO: track time if needed
          });
        }
      } else {
        updateUI();
        autoAdvanceTimer = setTimeout(() => {
          currentIndex++;
          showSite();
        }, AUTO_MS_CORRECT);
      }
    } else {
      currentUI.showFeedback(`❌ Wrong. This is ${site.siteName} in ${site.country}.`, false);
      
      // Call custom callback if provided
      if (customOnAnswer) customOnAnswer({ isCorrect: false, points: 0 });
      
      if (singleRound) {
        // For single round mode, immediately resolve with result
        if (customOnComplete) {
          customOnComplete({
            correct: false,
            score: 0,
            time: 0 // TODO: track time if needed
          });
        }
      } else {
        autoAdvanceTimer = setTimeout(() => {
          currentIndex++;
          showSite();
        }, AUTO_MS_WRONG);
      }
    }
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
    if (hideScoreUI || !finalOverlay) return;
    
    const accuracy = sites.length > 0 ? Math.round((totalCorrect / sites.length) * 100) : 0;
    const perfectRate = sites.length > 0 ? Math.round((perfectGuesses / sites.length) * 100) : 0;

    if (finalScoreEl) finalScoreEl.textContent = score;
    if (finalSitesEl) finalSitesEl.textContent = sites.length;
    if (finalPerfectEl) finalPerfectEl.textContent = perfectGuesses;
    if (finalAccuracyEl) finalAccuracyEl.textContent = `${accuracy}%`;

    let subtitle = 'Good effort!';
    if (perfectRate >= 80) subtitle = 'Amazing! You know your world heritage! 🌟';
    else if (perfectRate >= 60) subtitle = 'Excellent work! 🎯';
    else if (perfectRate >= 40) subtitle = 'Well done! 👏';
    else if (accuracy >= 60) subtitle = 'Not bad! Keep exploring! 🗺️';

    if (finalSubtitleEl) finalSubtitleEl.textContent = subtitle;
    if (finalOverlay) finalOverlay.style.display = 'flex';

    if (perfectRate >= 60) {
      confetti?.burst?.({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    }
  }
  
  function setSites(sitesList) {
    // In single round mode, we need to keep all loaded sites for generating alternatives
    // but only show the specified site(s)
    if (Array.isArray(sitesList) && sitesList.length === 1 && sites.length > 1) {
      // Single site specified, but we have all sites loaded - find the index
      const targetSite = sitesList[0];
      const index = sites.findIndex(s => s.country === targetSite.country && s.siteName === targetSite.siteName);
      if (index >= 0) {
        currentIndex = index;
      } else {
        // Site not found in loaded sites, add it at the beginning
        sites.unshift(targetSite);
        currentIndex = 0;
      }
    } else {
      // Normal mode - replace all sites
      sites = Array.isArray(sitesList) ? sitesList : [sitesList];
      currentIndex = 0;
    }
  }

  return {
    loadSites,
    reset,
    showQuestion: () => showSite(),
    setSite: (site) => setSites([site]),
    setSites
  };
}
