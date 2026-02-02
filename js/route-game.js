import { norm } from "./utils.js";

export function createRouteGame({ ui, neighbors, confetti, drawCountries }) {
  const DATA = window.DATA;

  let deck = [];
  let currentRound = null; // { start, end, optimalPath, currentPath, wrongGuesses }

  let score = 0;
  let correctFirstTry = 0;
  let correctAny = 0;
  let totalRounds = 0;

  let roundEnded = false;
  let continueTimer = null;
  let hintShown = false;
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
    const lastCountry = currentPath[currentPath.length - 1];
    const lastNeighbors = neighborsData[lastCountry] || [];
    return lastNeighbors.includes(guess);
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

  function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function updateUI() {
    ui.scoreEl.textContent = score;
  }

  function createDeck() {
    const validPairs = [];
    const countryNames = Object.keys(neighbors);

    // Generate pairs with varying difficulty
    for (let i = 0; i < countryNames.length; i++) {
      for (let j = i + 1; j < countryNames.length; j++) {
        const start = countryNames[i];
        const end = countryNames[j];
        
        const pathInfo = findShortestPath(start, end, neighbors);
        
        // Only include pairs with at least 1 country in between (no direct neighbors)
        // Length is 1-8 countries in between
        if (pathInfo && pathInfo.length >= 1 && pathInfo.length <= 8) {
          validPairs.push({
            start,
            end,
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
    hintShown = false;

    updateUI();
    ui.answerInput.value = "";
    ui.statusEl.style.display = "none";
    ui.hintEl.style.display = "none";
    ui.finalOverlay.style.display = "none";

    nextRound();
  }

  function nextRound() {
    if (deck.length === 0) {
      endGame();
      return;
    }

    const pair = deck.shift();
    totalRounds++;

    const pathInfo = findShortestPath(pair.start, pair.end, neighbors);

    currentRound = {
      start: pair.start,
      end: pair.end,
      optimalPath: pathInfo.path,
      currentPath: [pair.start],
      wrongGuesses: 0
    };

    roundEnded = false;
    hintShown = false;
    roundStartTime = Date.now();

    updateUI();
    ui.answerInput.value = "";
    ui.answerInput.disabled = false;
    ui.statusEl.style.display = "none";
    ui.hintEl.style.display = "none";

    // Update route display
    ui.routeEl.innerHTML = `
      <span class="route-country start">${currentRound.start}</span>
      <span class="route-arrow">→</span>
      <span class="route-placeholder">?</span>
      <span class="route-arrow">→</span>
      <span class="route-country end">${currentRound.end}</span>
    `;

    // Highlight start and end countries on map
    drawCountries([
      { country: currentRound.start, color: "start" },
      { country: currentRound.end, color: "end" }
    ]);

    ui.answerInput.focus();
  }

  function processGuess(guess) {
    if (roundEnded) return;

    const normalizedGuess = norm(guess);

    // Find matching country
    const match = DATA.find(c => norm(c.country) === normalizedGuess);

    if (!match) {
      showStatus("❌ Country not found. Check spelling.", "wrong");
      return;
    }

    const guessedCountry = match.country;

    // Check if already in path
    if (currentRound.currentPath.includes(guessedCountry)) {
      showStatus("⚠️ Already used this country", "wrong");
      return;
    }

    // Don't allow guessing the end country directly
    if (guessedCountry === currentRound.end) {
      showStatus(`⚠️ Don't type the destination! Type a country that borders ${currentRound.end}`, "wrong");
      return;
    }

    // Check if valid next step
    if (isValidNextStep(guessedCountry, currentRound.currentPath, neighbors)) {
      currentRound.currentPath.push(guessedCountry);
      ui.answerInput.value = "";

      // Check if this country borders the destination
      const guessedNeighbors = neighbors[guessedCountry] || [];
      if (guessedNeighbors.includes(currentRound.end)) {
        // Update route display to show the last country
        updateRouteDisplay();
        
        // Auto-complete the route!
        currentRound.currentPath.push(currentRound.end);
        
        // Update map with complete route including the last guessed country
        const pathCountries = currentRound.currentPath.slice(1, -1).map(c => ({ country: c, color: "path" }));
        drawCountries([
          { country: currentRound.start, color: "start" },
          { country: currentRound.end, color: "end" },
          ...pathCountries
        ]);
        
        showStatus(`✅ Perfect! ${guessedCountry} borders ${currentRound.end}!`, "correct");
        
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
      }
    } else {
      currentRound.wrongGuesses++;
      showStatus(`❌ ${guessedCountry} doesn't border ${currentRound.currentPath[currentRound.currentPath.length - 1]}`, "wrong");
      showHintIfNeeded();
    }
  }

  function updateRouteDisplay() {
    const parts = [currentRound.start];
    
    for (let i = 1; i < currentRound.currentPath.length; i++) {
      parts.push(currentRound.currentPath[i]);
    }
    
    parts.push("?");
    parts.push(currentRound.end);

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

  function showHintIfNeeded() {
    if (!hintShown && currentRound.wrongGuesses >= 1) {
      hintShown = true;
      const optimalLength = currentRound.optimalPath.length - 2;
      ui.hintEl.innerHTML = `💡 The optimal route needs <b>${optimalLength}</b> ${optimalLength === 1 ? 'country' : 'countries'} in between`;
      ui.hintEl.style.display = "block";
    }
  }

  function endRound(success) {
    roundEnded = true;
    ui.answerInput.disabled = true;

    const pathLength = currentRound.currentPath.length - 2; // Countries in between
    const optimalLength = currentRound.optimalPath.length - 2;
    const isOptimal = pathLength === optimalLength;
    const isFirstTry = currentRound.wrongGuesses === 0;
    const timeElapsed = Date.now() - roundStartTime;
    const isFast = timeElapsed < SPEED_BONUS_MS;

    let points = 0;
    let message = "";

    if (success) {
      if (isOptimal) {
        points = 3;
        message = "🎯 Perfect! Optimal route!";
        if (isFirstTry) {
          points += 1;
          message += " +1 First try bonus!";
        }
        if (isFast) {
          points += 1;
          message += " +1 Speed bonus!";
        }
        confetti.burst();
      } else {
        points = 1;
        message = `✅ Correct route! (Optimal: ${optimalLength}, Yours: ${pathLength})`;
      }

      score += points;
      correctAny++;
      if (isFirstTry) correctFirstTry++;

      showStatus(message, "correct");
    } else {
      showStatus(`Path: ${currentRound.optimalPath.join(" → ")}`, "wrong");
    }

    updateUI();

    continueTimer = setTimeout(() => {
      nextRound();
    }, success ? AUTO_MS_CORRECT : AUTO_MS_WRONG);
  }

  function showStatus(msg, type) {
    ui.statusEl.textContent = msg;
    ui.statusEl.className = `status ${type}`;
    ui.statusEl.style.display = "block";
  }

  function giveUp() {
    if (roundEnded) return;
    endRound(false);
  }

  function endGame() {
    ui.finalOverlay.style.display = "flex";

    const firstTryPct = totalRounds > 0 && correctFirstTry > 0 ? 100 : 0;

    ui.finalScoreEl.textContent = score;
    ui.finalCorrectEl.textContent = correctAny > 0 ? "Yes" : "No";
    ui.finalFirstTryEl.textContent = firstTryPct > 0 ? "Yes" : "No";

    confetti.burst();
  }

  return {
    start: reset,
    processGuess,
    giveUp
  };
}
