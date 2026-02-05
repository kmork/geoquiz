import { norm } from "./utils.js";
import { isMobileDevice, hapticFeedback, flashCorrect, shakeWrong, shuffleInPlace } from "./game-utils.js";

export function createRouteGame({ ui, neighbors, confetti, drawCountries, getCountryFeature }) {
  const DATA = window.DATA;

  let deck = [];
  let currentRound = null; // { start, end, optimalPath, currentPath, wrongGuesses, hintsUsed, pathHistory }

  let score = 0;
  let correctFirstTry = 0;
  let correctAny = 0;
  let totalRounds = 0;

  let roundEnded = false;
  let continueTimer = null;
  let roundStartTime = 0;

  const AUTO_MS_CORRECT = 1200;
  const AUTO_MS_WRONG = 1700;
  const MAX_ROUNDS = 1; // Single round game
  const SPEED_BONUS_MS = 30000; // 30 seconds for speed bonus

  // BFS Algorithm to find shortest path between two countries
  function findShortestPath(startCountry, endCountry, neighborsData) {
    if (startCountry === endCountry) {
      return { path: [startCountry], length: 0 };
    }

    const queue = [[startCountry]];
    const visited = new Set([startCountry]);

    while (queue.length > 0) {
      const path = queue.shift();
      const current = path[path.length - 1];

      // Get neighbors of current country
      const currentNeighbors = neighborsData[current] || [];

      for (const neighbor of currentNeighbors) {
        if (visited.has(neighbor)) continue;

        const newPath = [...path, neighbor];

        if (neighbor === endCountry) {
          // Found the shortest path
          return {
            path: newPath,
            length: newPath.length - 2 // Countries in between (exclude start and end)
          };
        }

        visited.add(neighbor);
        queue.push(newPath);
      }
    }

    // No path found (e.g., islands not connected)
    return null;
  }

  // Check if a guess is valid (neighbor of last country in current path)
  function isValidNextStep(guess, currentPath, neighborsData) {
    // Allow guessing any country that neighbors ANY country in the current path
    // This enables branching - you can explore different routes from any point
    for (const pathCountry of currentPath) {
      const pathNeighbors = neighborsData[pathCountry] || [];
      if (pathNeighbors.includes(guess)) {
        return true;
      }
    }
    return false;
  }

  // Generate a helpful hint
  function generateHint(currentPath, optimalPath, neighborsData) {
    const lastCountry = currentPath[currentPath.length - 1];
    const lastNeighbors = neighborsData[lastCountry] || [];

    // Find neighbors that are on the optimal path
    const optimalNeighbors = lastNeighbors.filter(n => optimalPath.includes(n));

    if (optimalNeighbors.length > 0) {
      // Suggest one of the optimal neighbors
      const suggestion = optimalNeighbors[0];
      return `💡 Hint: Try ${suggestion}`;
    } else {
      // Suggest any valid neighbor
      if (lastNeighbors.length > 0) {
        const randomNeighbor = lastNeighbors[Math.floor(Math.random() * lastNeighbors.length)];
        return `💡 Hint: ${lastCountry} borders ${randomNeighbor}`;
      }
    }

    return "💡 Hint: Think about neighboring countries";
  }

  function updateUI() {
    ui.scoreEl.textContent = score;
    
    // Enable/disable undo button based on path history
    const canUndo = currentRound && currentRound.pathHistory.length > 0 && !roundEnded;
    ui.undoBtn.disabled = !canUndo;
  }

  function createDeck() {
    const validPairs = [];
    const countryNames = Object.keys(neighbors);

    // Generate pairs with random difficulty (1-8 countries in between)
    for (let i = 0; i < countryNames.length; i++) {
      for (let j = i + 1; j < countryNames.length; j++) {
        const start = countryNames[i];
        const end = countryNames[j];
        
        const pathInfo = findShortestPath(start, end, neighbors);
        
        // Only include pairs with 1-8 countries in between
        if (pathInfo && pathInfo.length >= 1 && pathInfo.length <= 8) {
          validPairs.push({
            start,
            end,
            path: pathInfo.path,
            difficulty: pathInfo.length
          });
        }
      }
    }

    // Sort by difficulty and take a mix
    validPairs.sort((a, b) => a.difficulty - b.difficulty);

    // For single round, pick one random route from all valid pairs
    return shuffleInPlace(validPairs).slice(0, MAX_ROUNDS);
  }

  function reset() {
    if (continueTimer) {
      clearTimeout(continueTimer);
      continueTimer = null;
    }

    deck = createDeck();
    currentRound = null;
    score = 0;
    correctFirstTry = 0;
    correctAny = 0;
    totalRounds = 0;
    roundEnded = false;

    updateUI();
    ui.answerInput.value = "";
    ui.statusEl.style.display = "none";
    ui.hintEl.style.display = "none";

    nextRound();
  }

  function nextRound() {
    if (continueTimer) clearTimeout(continueTimer);
    
    roundEnded = false;
    ui.answerInput.value = "";
    ui.answerInput.disabled = false;
    ui.submitBtn.disabled = false;
    ui.showHintBtn.disabled = false;
    ui.statusEl.style.display = "none";
    ui.hintEl.style.display = "none";

    if (deck.length === 0) {
      deck = createDeck();
    }

    const routeInfo = deck.pop();
    totalRounds++;
    roundStartTime = Date.now();

    currentRound = {
      start: routeInfo.start,
      end: routeInfo.end,
      optimalPath: routeInfo.path,
      currentPath: [routeInfo.start],
      wrongGuesses: 0,
      hintsUsed: 0,
      pathHistory: [] // Track history for undo: [{path: [...], wrongGuesses: N}]
    };

    // Show optimal path length in header from the start
    const optimalLength = currentRound.optimalPath.length - 2;
    ui.optimalHintEl.textContent = optimalLength;

    updateRouteDisplay();
    updateUI();

    // Draw start and end countries
    drawCountries([
      { country: currentRound.start, color: "start" },
      { country: currentRound.end, color: "end" }
    ]);

    // Only auto-focus on desktop (not mobile to avoid unwanted keyboard)
    if (!isMobileDevice()) {
      ui.answerInput.focus();
    }
  }

  function processGuess(guess) {
    if (roundEnded) return;

    const normalizedGuess = norm(guess);

    // Check if the guess is an alias first
    let searchName = guess;
    for (const [alias, official] of Object.entries(window.COUNTRY_ALIASES || {})) {
      if (norm(alias) === normalizedGuess) {
        searchName = official;
        break;
      }
    }

    // Find matching country
    const match = DATA.find(c => norm(c.country) === norm(searchName));

    if (!match) {
      showStatus("❌ Country not found. Check spelling.", "wrong");
      shakeWrong(ui.answerInput);
      hapticFeedback('wrong');
      return;
    }

    const guessedCountry = match.country;

    // Check if already in path
    if (currentRound.currentPath.includes(guessedCountry)) {
      showStatus("⚠️ Already used this country", "wrong");
      shakeWrong(ui.answerInput);
      hapticFeedback('wrong');
      return;
    }

    // Don't allow guessing the end country directly
    if (guessedCountry === currentRound.end) {
      showStatus(`⚠️ Don't type the destination! Type a country that borders ${currentRound.end}`, "wrong");
      shakeWrong(ui.answerInput);
      hapticFeedback('wrong');
      return;
    }

    // Check if valid next step
    if (isValidNextStep(guessedCountry, currentRound.currentPath, neighbors)) {
      // Save state to history before making changes
      currentRound.pathHistory.push({
        path: [...currentRound.currentPath],
        wrongGuesses: currentRound.wrongGuesses
      });
      
      currentRound.currentPath.push(guessedCountry);
      ui.answerInput.value = "";

      // Check if this country borders the destination
      const guessedNeighbors = neighbors[guessedCountry] || [];
      if (guessedNeighbors.includes(currentRound.end)) {
        // Auto-complete the route!
        currentRound.currentPath.push(currentRound.end);
        
        // Update route display to show complete path (including destination)
        updateRouteDisplay();
        
        // Update map with complete route including the last guessed country
        const pathCountries = currentRound.currentPath.slice(1, -1).map(c => ({ country: c, color: "path" }));
        drawCountries([
          { country: currentRound.start, color: "start" },
          { country: currentRound.end, color: "end" },
          ...pathCountries
        ]);
        
        showStatus(`✅ Perfect! ${guessedCountry} borders ${currentRound.end}!`, "correct");
        flashCorrect(ui.card || document.querySelector('.card'));
        hapticFeedback('correct');
        
        // Mobile UX: Dismiss keyboard to show victory
        if (isMobileDevice()) {
          ui.answerInput.blur();
        }
        
        // Auto-complete after a brief delay
        setTimeout(() => {
          endRound(true);
        }, 800);
      } else {
        // Update route display
        updateRouteDisplay();

        // Update map - show all countries in the path (excluding start and end)
        const pathCountries = currentRound.currentPath.slice(1).map(c => ({ country: c, color: "path" }));
        drawCountries([
          { country: currentRound.start, color: "start" },
          { country: currentRound.end, color: "end" },
          ...pathCountries
        ]);

        showStatus(`✅ Correct! ${guessedCountry} added to route`, "correct");
        flashCorrect(ui.card || document.querySelector('.card'));
        hapticFeedback('correct');
        
        // Mobile UX: Dismiss keyboard to show map (do NOT refocus)
        if (isMobileDevice()) {
          ui.answerInput.blur();
        }
      }
      
      updateUI(); // Update undo button state
    } else {
      currentRound.wrongGuesses++;
      showStatus(`❌ ${guessedCountry} doesn't border any country in your path`, "wrong");
      shakeWrong(ui.answerInput);
      hapticFeedback('wrong');
    }
  }

  function updateRouteDisplay() {
    const parts = [currentRound.start];
    
    for (let i = 1; i < currentRound.currentPath.length; i++) {
      parts.push(currentRound.currentPath[i]);
    }
    
    // Only add placeholder and destination if route is not complete
    const isComplete = currentRound.currentPath[currentRound.currentPath.length - 1] === currentRound.end;
    if (!isComplete) {
      parts.push("?");
      parts.push(currentRound.end);
    }

    ui.routeEl.innerHTML = parts.map((p, idx) => {
      if (p === "?") {
        return `<span class="route-placeholder">?</span>`;
      } else if (p === currentRound.start) {
        return `<span class="route-country start">${p}</span>`;
      } else if (p === currentRound.end) {
        return `<span class="route-country end">${p}</span>`;
      } else {
        return `<span class="route-country path">${p}</span>`;
      }
    }).join('<span class="route-arrow">→</span>');
  }

  function showVisualHint() {
    if (roundEnded) return;
    
    currentRound.hintsUsed++;
    
    // Find the next country in the optimal path that hasn't been added yet
    const nextOptimalCountry = currentRound.optimalPath.find(
      country => !currentRound.currentPath.includes(country) && country !== currentRound.end
    );
    
    if (nextOptimalCountry) {
      // Draw the hint country in a dashed/faded style
      const feature = getCountryFeature(nextOptimalCountry);
      if (feature) {
        drawCountries([
          { country: currentRound.start, color: "start" },
          { country: currentRound.end, color: "end" },
          ...currentRound.currentPath.slice(1).map(c => ({ country: c, color: "path" })),
          { country: nextOptimalCountry, color: "hint" }
        ]);
        
        showStatus(`💡 Hint shown! (-1 point)`, "hint");
      }
    } else {
      showStatus(`💡 No more hints available`, "hint");
    }
  }

  function endRound(success) {
    roundEnded = true;
    ui.answerInput.disabled = true;
    ui.submitBtn.disabled = true;
    ui.showHintBtn.disabled = true;

    const pathLength = currentRound.currentPath.length - 2; // Countries in between
    const optimalLength = currentRound.optimalPath.length - 2;
    const isOptimal = pathLength === optimalLength;
    const isFirstTry = currentRound.wrongGuesses === 0;
    const timeElapsed = Date.now() - roundStartTime;
    const isFast = timeElapsed < SPEED_BONUS_MS;

    let points = 0;
    let message = "";

    if (success) {
      // New scoring system: More points for optimal
      if (isOptimal) {
        points = 5; // Base points for optimal
        message = "🎯 Perfect! Optimal route!";
        if (isFirstTry) {
          points += 2; // Bigger bonus for first try
          message += " +2 First try bonus!";
        }
        if (isFast) {
          points += 1;
          message += " +1 Speed bonus!";
        }
        
        // Show confetti AFTER everything is displayed
        setTimeout(() => {
          confetti.burst();
        }, 100);
      } else {
        // Points decrease with each extra country
        const extraCountries = pathLength - optimalLength;
        points = Math.max(1, 5 - extraCountries); // 4pts for +1, 3pts for +2, etc., min 1pt
        message = `✅ Route complete! (Optimal: ${optimalLength}, Yours: ${pathLength}) +${points}pts`;
      }

      // Deduct points for using visual hints
      if (currentRound.hintsUsed > 0) {
        const hintPenalty = currentRound.hintsUsed;
        points = Math.max(0, points - hintPenalty);
        message += ` | -${hintPenalty}pt${hintPenalty > 1 ? 's' : ''} for hint${hintPenalty > 1 ? 's' : ''}`;
      }

      score += points;
      correctAny++;
      if (isFirstTry) correctFirstTry++;

      showStatus(message, "correct");
      
      // Show optimal path if user's path wasn't optimal
      if (!isOptimal) {
        showOptimalPath();
      }
    } else {
      // Give up - show optimal path in route display AND on map
      showOptimalPathInRouteDisplay();
      showOptimalPath();
      // No status message - the route display shows everything
    }

    updateUI();
  }

  function showOptimalPathInRouteDisplay() {
    // Show the complete optimal path in the route display above the map
    const optimalPath = currentRound.optimalPath;
    
    ui.routeEl.innerHTML = optimalPath.map((country, idx) => {
      if (idx === 0) {
        return `<span class="route-country start">${country}</span>`;
      } else if (idx === optimalPath.length - 1) {
        return `<span class="route-country end">${country}</span>`;
      } else {
        return `<span class="route-country optimal-display">${country}</span>`;
      }
    }).join('<span class="route-arrow">→</span>');
  }

  function showOptimalPath() {
    // Highlight optimal path in gold/yellow on map
    const optimalCountries = currentRound.optimalPath.slice(1, -1).map(c => ({ country: c, color: "optimal" }));
    const userPath = currentRound.currentPath.slice(1);
    
    // Draw user's path in blue, optimal path in gold (if different)
    const pathCountries = userPath
      .filter(c => c !== currentRound.end) // Exclude end
      .map(c => ({ country: c, color: "path" }));
    
    drawCountries([
      { country: currentRound.start, color: "start" },
      { country: currentRound.end, color: "end" },
      ...pathCountries,
      ...optimalCountries
    ]);
  }

  function showStatus(msg, type) {
    ui.statusEl.textContent = msg;
    ui.statusEl.className = `status ${type}`;
    ui.statusEl.style.display = "block";
    
    // Add input animation based on type
    if (type === "correct") {
      ui.answerInput.classList.add("correct-flash");
      setTimeout(() => ui.answerInput.classList.remove("correct-flash"), 600);
    } else if (type === "wrong") {
      ui.answerInput.classList.add("shake");
      setTimeout(() => ui.answerInput.classList.remove("shake"), 500);
    }
  }

  function giveUp() {
    if (roundEnded) return;
    endRound(false);
  }

  function undo() {
    if (roundEnded || !currentRound || currentRound.pathHistory.length === 0) return;
    
    // Restore previous state
    const previousState = currentRound.pathHistory.pop();
    currentRound.currentPath = previousState.path;
    currentRound.wrongGuesses = previousState.wrongGuesses;
    
    // Update display
    updateRouteDisplay();
    updateUI();
    
    // Update map - show countries in the restored path
    const pathCountries = currentRound.currentPath.slice(1).map(c => ({ country: c, color: "path" }));
    drawCountries([
      { country: currentRound.start, color: "start" },
      { country: currentRound.end, color: "end" },
      ...pathCountries
    ]);
    
    showStatus(`↩️ Undone! Last country removed`, "hint");
    // Only auto-focus on desktop (not mobile to avoid unwanted keyboard)
    if (!isMobileDevice()) {
      ui.answerInput.focus();
    }
  }

  return {
    start: nextRound,
    processGuess,
    giveUp,
    showHint: showVisualHint,
    undo
  };
}
