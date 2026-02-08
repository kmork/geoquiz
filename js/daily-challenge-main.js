/**
 * Daily Challenge - Main Orchestrator
 *
 * Runs 6 mini-games in sequence, tracks progress, calculates stars, and saves results.
 */

import { SeededRandom, dateToSeed, getTodayDate, getChallengeNumber } from './seeded-random.js';
import { calculateStars, saveResult, hasCompletedToday, getResultForDate, getStats, getRating, getRatingEmoji, formatTime, getMaxStars } from './daily-challenge-scoring.js';
import { handleShare } from './daily-challenge-share.js';
import { initConfetti } from './confetti.js';
import { norm } from './utils.js';
import { runEmbeddedRouteGame } from "./route-daily-embed.js";

// Import game logic modules
import { TriviaGameLogic } from './games/trivia-logic.js';
import { FindCountryGameLogic } from './games/find-logic.js';
import { OutlinesGameLogic } from './games/outlines-logic.js';
import { PictureGuessGameLogic } from './games/picture-logic.js';
import { CapitalsGameLogic } from './games/capitals-logic.js';
import { RouteGameLogic } from './games/route-logic.js';

// Import UI components
import { renderPictureUI, setupPictureAutocomplete } from './ui-components/picture-ui.js';
import { renderOutlinesUI } from './ui-components/outlines-ui.js';
import { renderCapitalsUI, setupCapitalsAutocomplete } from './ui-components/capitals-ui.js';
import { OutlinesRenderer } from './ui-components/outlines-renderer.js';
import { FindCountryMapRenderer } from './ui-components/map-renderer.js';
import { RouteRenderer } from './ui-components/route-renderer.js';

// Import utility functions
import {
  createButton,
  showFeedback,
  hideFeedback,
  createFeedbackDiv,
  highlightButton,
  setupAutocomplete,
  createHintElements,
  onEnterKey,
  getElapsedSeconds
} from './daily-game-utils.js';

// Import map creation for Capitals game
import { createMap } from './map.js';

/**
 * Normalize user input to match official country name
 * Handles aliases and case-insensitive matching
 */
function normalizeCountryInput(userInput, countries) {
  const normalized = norm(userInput);

  // Check aliases first
  if (window.COUNTRY_ALIASES) {
    for (const [alias, official] of Object.entries(window.COUNTRY_ALIASES)) {
      if (norm(alias) === normalized) {
        return official;
      }
    }
  }

  // Find matching country
  const match = countries.find(c => norm(c.country) === normalized);
  return match ? match.country : null;
}

// Game configuration
const GAMES = [
  {
    id: 'find',
    name: 'Find the Country',
    emoji: '🗺️',
    timeLimit: 30
  },
  {
    id: 'trivia',
    name: 'Geography Trivia',
    emoji: '📚',
    timeLimit: 30
  },
  {
    id: 'outlines',
    name: 'Guess the Country',
    emoji: '🌍',
    timeLimit: 30
  },
  {
    id: 'picture',
    name: 'UNESCO Heritage',
    emoji: '🖼️',
    timeLimit: 30
  },
  {
    id: 'capitals',
    name: 'Capitals Quiz',
    emoji: '🏛️',
    timeLimit: 30
  },
  {
    id: 'connect',
    name: 'Connect the Countries',
    emoji: '🔗',
    timeLimit: null // No time limit
  }
];

class DailyChallenge {
  constructor() {
    this.today = getTodayDate();
    this.challengeNum = getChallengeNumber(this.today);
    this.seed = dateToSeed(this.today);
    this.rng = new SeededRandom(this.seed);

    this.currentGameIndex = 0;
    this.results = [];
    this.challenges = [];
    this.startTime = Date.now();

    this.timerInterval = null;
    this.timeRemaining = 0;
    this.gameStartTime = 0;

    // Initialize confetti
    this.confetti = initConfetti('confetti');
  }

  /**
   * Initialize and start the daily challenge
   */
  async init() {
    // Check for review mode
    const urlParams = new URLSearchParams(window.location.search);
    const reviewDate = urlParams.get('review');

    if (reviewDate) {
      // Review mode - show past results
      this.showReviewResults(reviewDate);
      return;
    }

    // Check if already completed today
    if (hasCompletedToday(this.today)) {
      // Redirect to results page or show completed message
      window.location.href = `daily.html`;
      return;
    }

    // Update challenge number in UI
    document.getElementById('challenge-num').textContent = this.challengeNum;

    // Generate today's challenges
    await this.generateChallenges();

    // Start first game
    await this.startNextGame();
  }

  /**
   * Generate challenge data for all 6 games using seeded RNG
   */
  async generateChallenges() {
    // Load required data
    // Note: window.DATA is set by data.js (loaded in HTML)
    const [triviaData, heritageData, neighborsData, geoData] = await Promise.all([
      fetch('data/qa.json').then(r => r.json()),
      fetch('data/heritage-sites.json').then(r => r.json()),
      fetch('data/countries-neighbors.json').then(r => r.json()),
      (async () => {
        const { loadGeoJSON } = await import('./geojson-loader.js');
        return await loadGeoJSON('data/ne_10m_admin_0_countries.geojson.gz');
      })()
    ]);

    // ✅ RESTORE: Build country data with regions from GeoJSON (used by games 1,3,5)
    const data = window.DATA.map(countryData => {
      const feature = geoData.features.find(f =>
        (f.properties.ADMIN || f.properties.NAME || '') === countryData.country
      );
      return {
        ...countryData,
        region: feature ? (feature.properties.REGION_UN || feature.properties.CONTINENT) : 'Unknown',
        subregion: feature ? feature.properties.SUBREGION : 'Unknown'
      };
    });

    this.challenges = [
      // 1. Find the Country
      {
        ...GAMES[0],
        data: this.rng.choice(data)
      },

      // 2. Geography Trivia
      {
        ...GAMES[1],
        data: this.rng.choice(triviaData)
      },

      // 3. Outlines
      {
        ...GAMES[2],
        data: this.rng.choice(data)
      },

      // 4. Picture Guess
      {
        ...GAMES[3],
        data: this.rng.choice(heritageData)
      },

      // 5. Capitals Quiz
      {
        ...GAMES[4],
        data: this.rng.choice(data),
        allData: data // Need for wrong answers
      },

      // 6. Connect the Countries
      {
        ...GAMES[5],
        data: (() => {
          // Pick start/end from neighbors keys (best for map/graph naming),
          // but restrict to countries also present in DATA (guessable).
          const key = (s) => (s || "").toLowerCase().trim();
          const validSet = new Set((window.DATA || []).map(x => key(x.country)));

          const neighborKeys = Object.keys(neighborsData || {});
          const pickFrom = neighborKeys.filter(n => validSet.has(key(n)));

          // If the intersection is empty for some reason, fall back to all neighbor keys
          const pool = pickFrom.length > 0 ? pickFrom : neighborKeys;

          let attempts = 0;
          const maxAttempts = 400;

          while (attempts < maxAttempts) {
            const start = this.rng.choice(pool);
            const end = this.rng.choice(pool);

            if (!start || !end || start === end) {
              attempts++;
              continue;
            }

            // BFS shortest path
            const queue = [[start]];
            const visited = new Set([start]);

            while (queue.length > 0) {
              const path = queue.shift();
              const current = path[path.length - 1];

              if (current === end) {
                const between = path.length - 2; // countries in between
                if (between >= 1 && between <= 8) {
                  return { start, end, path };
                }
                break;
              }

              // depth cap: between<=8 => path length<=10
              if (path.length >= 11) continue;

              const nbrs = neighborsData[current] || [];
              for (const nb of nbrs) {
                // If we have a filtered pool, keep traversal guessable too
                if (pickFrom.length > 0 && !validSet.has(key(nb))) continue;

                if (!visited.has(nb)) {
                  visited.add(nb);
                  queue.push([...path, nb]);
                }
              }
            }

            attempts++;
          }

          // Safe fallback
          return {
            start: "Portugal",
            end: "Poland",
            path: ["Portugal", "Spain", "France", "Germany", "Poland"]
          };
        })(),
        neighbors: neighborsData
      }
    ];
  }

  /**
   * Start the next game in sequence
   */
  async startNextGame() {
    if (this.currentGameIndex >= GAMES.length) {
      // All games complete - show results
      this.showFinalResults();
      return;
    }

    const challenge = this.challenges[this.currentGameIndex];

    // Update progress UI
    this.updateProgress();

    // Update game title
    document.getElementById('game-title').textContent = `${challenge.emoji} ${challenge.name}`;

    // Start timer if game has time limit
    if (challenge.timeLimit) {
      this.startTimer(challenge.timeLimit);
    } else {
      document.getElementById('timer').textContent = '∞';
    }

    // Load and run the game
    this.gameStartTime = Date.now();
    const result = await this.runGame(challenge);

    // Stop timer
    this.stopTimer();

    // Calculate stars
    const stars = calculateStars(result, challenge.id);

    // Store result
    this.results.push({
      gameId: challenge.id,
      stars,
      time: result.time,
      correct: result.correct,
      usedHint: result.usedHint || false,
      parDiff: result.parDiff
    });

    // Show transition screen
    await this.showTransition(challenge, result, stars);

    // Move to next game
    this.currentGameIndex++;
    await this.startNextGame();
  }

  /**
   * Run a specific game and return result
   */
  async runGame(challenge) {
    const gameContent = document.getElementById('game-content');
    gameContent.innerHTML = ''; // Clear previous game

    // Import and run the appropriate game module
    switch (challenge.id) {
      case 'find':
        return await this.runFindGame(challenge, gameContent);
      case 'trivia':
        return await this.runTriviaGame(challenge, gameContent);
      case 'outlines':
        return await this.runOutlinesGame(challenge, gameContent);
      case 'picture':
        return await this.runPictureGame(challenge, gameContent);
      case 'capitals':
        return await this.runCapitalsGame(challenge, gameContent);
      case 'connect':
        return await this.runConnectGame(challenge, gameContent);
      default:
        throw new Error(`Unknown game: ${challenge.id}`);
    }
  }

  /**
   * Start countdown timer
   */
  startTimer(seconds) {
    this.timeRemaining = seconds;
    const timerEl = document.getElementById('timer');
    timerEl.textContent = seconds;

    this.timerInterval = setInterval(() => {
      this.timeRemaining--;
      timerEl.textContent = this.timeRemaining;

      // Visual warning at 10 seconds
      if (this.timeRemaining <= 10) {
        timerEl.classList.add('timer-warning');
      }

      // Time's up
      if (this.timeRemaining <= 0) {
        this.stopTimer();
        // Trigger timeout in current game
        window.dispatchEvent(new CustomEvent('daily-timeout'));
      }
    }, 1000);
  }

  /**
   * Stop countdown timer
   */
  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    const timerEl = document.getElementById('timer');
    timerEl.classList.remove('timer-warning');
  }

  /**
   * Update progress dots
   */
  updateProgress() {
    const dots = document.querySelectorAll('.progress-dot');
    dots.forEach((dot, index) => {
      dot.classList.remove('current', 'completed', 'wrong');
      if (index < this.currentGameIndex) {
        dot.classList.add('completed');
        // Add 'wrong' class if game was not solved correctly
        if (this.results[index] && !this.results[index].correct) {
          dot.classList.add('wrong');
        }
      } else if (index === this.currentGameIndex) {
        dot.classList.add('current');
      }
    });

    document.getElementById('game-progress').textContent =
      `Game ${this.currentGameIndex + 1}/6`;
  }

  /**
   * Show transition screen between games
   */
  async showTransition(challenge, result, stars) {
    return new Promise(resolve => {
      const transitionScreen = document.getElementById('transition-screen');
      const gameArea = document.getElementById('game-area');

      // Hide game area, show transition
      gameArea.classList.add('hidden');
      transitionScreen.classList.remove('hidden');

      // Populate transition content
      const resultText = result.correct ? '✓ Correct!' : '✗ Wrong';
      const resultClass = result.correct ? 'correct' : 'wrong';

      document.getElementById('transition-result').innerHTML =
        `<span class="${resultClass}">${resultText}</span>`;

      const maxStars = getMaxStars(challenge.id);
      const starStr = '⭐'.repeat(stars) + '☆'.repeat(maxStars - stars);
      document.getElementById('transition-stars').textContent =
        `${starStr} ${stars}/${maxStars} star${stars !== 1 ? 's' : ''}`;

      const nextGameIndex = this.currentGameIndex + 1;
      if (nextGameIndex < GAMES.length) {
        const nextGame = this.challenges[nextGameIndex];
        document.getElementById('transition-next').textContent =
          `Next: ${nextGame.emoji} ${nextGame.name}`;
      } else {
        document.getElementById('transition-next').textContent =
          'Calculating final score...';
      }

      // Auto-advance after 2 seconds
      setTimeout(() => {
        transitionScreen.classList.add('hidden');
        gameArea.classList.remove('hidden');
        resolve();
      }, 2000);
    });
  }

  /**
   * Show final results screen
   */
  showFinalResults() {
    const totalTime = Math.floor((Date.now() - this.startTime) / 1000);
    const totalStars = this.results.reduce((sum, r) => sum + r.stars, 0);

    // Save to localStorage
    saveResult(this.today, totalStars, totalTime, this.results);

    // Get updated stats
    const stats = getStats();
    const rating = getRating(totalStars);
    const ratingEmoji = getRatingEmoji(totalStars);

    // Hide game area
    document.getElementById('game-area').classList.add('hidden');
    document.querySelector('.daily-header').classList.add('hidden');

    // Show results container
    const resultsContainer = document.getElementById('results-container');
    resultsContainer.classList.remove('hidden');

    // Populate results
    resultsContainer.innerHTML = `
      <div class="results-header">
        <div class="results-icon">${ratingEmoji}</div>
        <h1 class="results-title">Challenge Complete!</h1>
        <p class="results-rating">${rating}</p>
      </div>

      <div class="results-summary">
        <div class="summary-stars">${'⭐'.repeat(totalStars)}</div>
        <div class="summary-score">${totalStars}/23 stars</div>
        <div class="summary-time">⏱️ ${formatTime(totalTime)}</div>
      </div>

      <div class="results-breakdown">
        ${this.results.map((result, index) => {
          const game = this.challenges[index];
          const maxStars = getMaxStars(game.id);
          const starStr = '⭐'.repeat(result.stars) + '☆'.repeat(maxStars - result.stars);

          // Show time for all games (including 0s for very fast answers)
          const timeStr = result.timeLimit !== null && result.time !== undefined ? `${result.time.toFixed(1)}s` : '';
          const extras = result.usedHint ? ' 💡' : '';
          const parInfo = result.parDiff !== undefined ?
            (result.parDiff === 999 ? ' gave up' : ` par${result.parDiff > 0 ? '+' : ''}${result.parDiff}`) : '';

          return `
            <div class="breakdown-game">
              <div class="game-info">
                <div class="game-emoji">${game.emoji}</div>
                <div class="game-name">${game.name}</div>
              </div>
              <div class="game-result">
                <div class="game-stars">${starStr}</div>
                <div class="game-time">${timeStr}${extras}${parInfo}</div>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <div class="results-streak">
        <div>🔥 Current Streak</div>
        <div class="streak-value">${stats.currentStreak} day${stats.currentStreak !== 1 ? 's' : ''}</div>
        ${stats.currentStreak > stats.maxStreak - stats.currentStreak ?
          `<div class="streak-new">New record! 🎉</div>` : ''}
      </div>

      <div class="results-actions">
        <button class="btn btn-primary btn-large" id="share-btn">
          📋 Share Results
        </button>
        <a href="daily.html" class="btn btn-secondary">
          🏠 Back to Daily Challenge
        </a>
      </div>
    `;

    // Add share button handler
    document.getElementById('share-btn').addEventListener('click', () => {
      handleShare(this.today, totalStars, totalTime, this.results, stats);
    });

    // Trigger confetti for high scores
    if (totalStars >= 27 && typeof window.triggerConfetti === 'function') {
      setTimeout(() => window.triggerConfetti(), 500);
    }
  }

  /**
   * Show review results for a past date
   */
  showReviewResults(date) {
    const result = getResultForDate(date);

    if (!result) {
      // No results for this date
      window.location.href = 'daily.html';
      return;
    }

    const challengeNum = getChallengeNumber(date);
    const rating = getRating(result.stars);
    const ratingEmoji = getRatingEmoji(result.stars);

    // Hide game area
    document.getElementById('game-area').classList.add('hidden');
    document.querySelector('.daily-header').classList.add('hidden');

    // Show results container
    const resultsContainer = document.getElementById('results-container');
    resultsContainer.classList.remove('hidden');

    // Populate results
    resultsContainer.innerHTML = `
      <div class="results-header">
        <div class="results-icon">${ratingEmoji}</div>
        <h1 class="results-title">Challenge #${challengeNum}</h1>
        <p class="results-subtitle">${new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        })}</p>
        <p class="results-rating">${rating}</p>
      </div>

      <div class="results-summary">
        <div class="summary-stars">${'⭐'.repeat(result.stars)}</div>
        <div class="summary-score">${result.stars}/23 stars</div>
        <div class="summary-time">⏱️ ${formatTime(result.totalTime)}</div>
      </div>

      <div class="results-breakdown">
        ${result.breakdown.map((gameResult, index) => {
          const game = GAMES[index];
          const maxStars = getMaxStars(game.id);
          const starStr = '⭐'.repeat(gameResult.stars) + '☆'.repeat(maxStars - gameResult.stars);

          // Show time for all games with time limits (not Connect)
          const timeStr = gameResult.timeLimit !== null && gameResult.time !== undefined ? `${gameResult.time.toFixed(1)}s` : '';
          const extras = gameResult.usedHint ? ' 💡' : '';
          const parInfo = gameResult.parDiff !== undefined ?
            (gameResult.parDiff === 999 ? ' gave up' : ` par${gameResult.parDiff > 0 ? '+' : ''}${gameResult.parDiff}`) : '';

          return `
            <div class="breakdown-game">
              <div class="game-info">
                <div class="game-emoji">${game.emoji}</div>
                <div class="game-name">${game.name}</div>
              </div>
              <div class="game-result">
                <div class="game-stars">${starStr}</div>
                <div class="game-time">${timeStr}${extras}${parInfo}</div>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <div class="results-actions">
        <a href="daily.html" class="btn btn-primary btn-large">
          🏠 Back to Daily Challenge
        </a>
      </div>
    `;
  }

  // Game implementations (placeholders - will be implemented next)

  async runFindGame(challenge, container) {
    const targetCountry = challenge.data;

    // Setup UI container matching standalone structure
    container.innerHTML = `
      <div class="card">
        <div class="country" id="dc-country">${targetCountry.country}</div>
        <div class="mapwrap">
          <canvas id="dc-map" width="600" height="320"></canvas>
        </div>
      </div>
    `;

    const canvas = container.querySelector('#dc-map');
    const countryNameEl = container.querySelector('#dc-country');

    // Import the complete map factory
    const { createCompleteMap } = await import('./find-country-complete.js');

    return new Promise(async (resolve) => {
      // Create game using the same factory as standalone
      const result = await createCompleteMap({
        container,
        canvas,
        countryNameEl,
        confetti: this.confetti,
        singleRound: true,
        onComplete: (finalResult) => {
          resolve({
            correct: finalResult.correctCount > 0,
            time: finalResult.time || 0,
            timeLimit: challenge.timeLimit
          });
        }
      });

      // Set the specific country BEFORE starting
      result.setCountry(targetCountry);
      result.nextQ();

      // Setup timeout handler
      window.addEventListener('daily-timeout', () => {
        resolve({
          correct: false,
          time: challenge.timeLimit,
          timeLimit: challenge.timeLimit
        });
      }, { once: true });
    });
  }

  async runTriviaGame(challenge, container) {
    const question = challenge.data;

    // Import the complete trivia factory
    const { createCompleteTriviaGame } = await import('./trivia-complete.js');

    return new Promise(async (resolve) => {
      let hasResolved = false;

      // Create game using the same factory as standalone
      const result = await createCompleteTriviaGame({
        container,
        confetti: this.confetti,
        singleRound: true,
        onAnswer: (answerResult) => {
          if (hasResolved) return;
          hasResolved = true;
          // Wait a bit to show feedback, then resolve
          setTimeout(() => {
            resolve({
              correct: answerResult.correct,
              time: answerResult.time || 0,
              timeLimit: challenge.timeLimit
            });
          }, 2000);
        }
      });

      if (!result) {
        resolve({ correct: false, time: challenge.timeLimit, timeLimit: challenge.timeLimit });
        return;
      }

      // Set the specific question and show it
      result.setQuestion(question);
      result.showQuestion();

      // Setup timeout handler
      window.addEventListener('daily-timeout', () => {
        if (hasResolved) return;
        hasResolved = true;
        resolve({
          correct: false,
          time: challenge.timeLimit,
          timeLimit: challenge.timeLimit
        });
      }, { once: true });
    });
  }

  async runOutlinesGame(challenge, container) {
    const targetCountry = challenge.data;

    // Setup container with SVG
    container.innerHTML = `
      <div class="card">
        <svg id="dc-outlines-map" class="outlines-svg" viewBox="0 0 600 320"></svg>
        <div class="input-row">
          <input type="text" id="dc-outlines-input" placeholder="Enter country name..." autocomplete="off">
          <button id="dc-outlines-submit" class="btn btn-primary">Submit</button>
        </div>
        <div id="dc-outlines-status" class="status" style="display:none;"></div>
      </div>
    `;

    // Import the complete outlines factory
    const { createCompleteOutlinesGame } = await import('./outlines-complete.js');

    return new Promise(async (resolve) => {
      let hasResolved = false;

      // Create game using same factory as standalone
      const result = await createCompleteOutlinesGame({
        container,
        svgMap: container.querySelector('#dc-outlines-map'),
        answerInput: container.querySelector('#dc-outlines-input'),
        submitBtn: container.querySelector('#dc-outlines-submit'),
        ui: {
          statusEl: container.querySelector('#dc-outlines-status')
        },
        confetti: this.confetti,
        singleRound: true,
        onComplete: (finalResult) => {
          if (hasResolved) return;
          hasResolved = true;
          resolve({
            correct: finalResult.correctFirstTry > 0 || finalResult.correctAny > 0,
            time: finalResult.time || 0,
            timeLimit: challenge.timeLimit,
            usedHint: finalResult.usedHint || false
          });
        }
      });

      if (!result) {
        resolve({ correct: false, time: challenge.timeLimit, timeLimit: challenge.timeLimit });
        return;
      }

      // Set specific country and start
      result.setCountry(targetCountry);
      result.nextQ();

      // Setup timeout handler
      window.addEventListener('daily-timeout', () => {
        if (hasResolved) return;
        hasResolved = true;
        resolve({
          correct: false,
          time: challenge.timeLimit,
          timeLimit: challenge.timeLimit
        });
      }, { once: true });
    });
  }

  async runPictureGame(challenge, container) {
    const site = challenge.data;

    // Import the complete picture game factory
    const { createCompletePictureGame } = await import('./picture-complete.js');

    return new Promise(async (resolve) => {
      let hasResolved = false;

      // Create game using same factory as standalone
      const result = await createCompletePictureGame({
        container,
        confetti: this.confetti,
        singleRound: true,
        allowMultipleChoice: true,
        showHint: true,
        onComplete: (finalResult) => {
          if (hasResolved) return;
          hasResolved = true;
          resolve({
            correct: finalResult.correct || finalResult.correctCount > 0,
            time: finalResult.time || 0,
            timeLimit: challenge.timeLimit,
            usedHint: finalResult.usedHint || false
          });
        }
      });

      if (!result) {
        resolve({ correct: false, time: challenge.timeLimit, timeLimit: challenge.timeLimit });
        return;
      }

      // Set specific site and start
      result.setSite(site);
      result.start();

      // Setup timeout handler
      window.addEventListener('daily-timeout', () => {
        if (hasResolved) return;
        hasResolved = true;
        resolve({
          correct: false,
          time: challenge.timeLimit,
          timeLimit: challenge.timeLimit
        });
      }, { once: true });
    });
  }

  async runCapitalsGame(challenge, container) {
    const targetCountry = challenge.data;

    // Create game logic instance with enriched data
    const gameLogic = new CapitalsGameLogic({
      singleRound: true,
      data: challenge.allData
    });
    gameLogic.setCountry(targetCountry);
    gameLogic.nextRound();

    // Generate wrong answers and shuffle
    const wrongAnswers = gameLogic.generateWrongAnswers(this.rng);
    const correctAnswer = gameLogic.getCorrectCapital();
    const allOptions = [correctAnswer, ...wrongAnswers.slice(0, 3)];
    const shuffled = this.rng.shuffle(allOptions);

    // Render UI - matches standalone exactly
    const ui = renderCapitalsUI(container, targetCountry, {
      showMap: true,
      choices: shuffled
    });

    // Create SVG map (like standalone)
    if (ui.elements.map) {
      const { createMap } = await import('./map.js');
      const mapApi = createMap({
        svgEl: ui.elements.map,
        worldUrl: 'data/ne_10m_admin_0_countries.geojson.gz',
        placesUrl: 'data/places.geojson'
      });

      try {
        await mapApi.load();
        mapApi.draw(targetCountry.country, false);
      } catch (err) {
        console.error('Map load failed:', err);
        // Continue without map
      }
    }

    // Setup autocomplete with capital names
    const capitals = challenge.allData.map(c => c.capital).filter(Boolean).sort();
    setupCapitalsAutocomplete(ui.elements.datalist, capitals);

    return new Promise(resolve => {
      let answered = false;
      let mcShown = false;

      const handleTextSubmit = () => {
        if (answered || mcShown) return;

        const userInput = ui.elements.input.value.trim();

        // Empty or wrong - show multiple choice
        if (!userInput || norm(userInput) !== norm(correctAnswer)) {
          mcShown = true;
          ui.showMultipleChoice();

          // Populate the choices dynamically
          ui.populateChoices(shuffled, correctAnswer, handleChoiceClick);
          return;
        }

        // Correct!
        answered = true;
        ui.disableInputs();

        const result = gameLogic.checkAnswer(correctAnswer);

        // Trigger confetti
        this.confetti?.burst?.({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

        setTimeout(() => {
          resolve({
            correct: true,
            time: result.time,
            timeLimit: challenge.timeLimit
          });
        }, 1200);
      };

      const handleChoiceClick = (selected, button, correct) => {
        if (answered) return;
        answered = true;

        const isCorrect = selected === correct;

        // Check answer using game logic
        const result = gameLogic.checkAnswer(selected);

        // Disable all buttons
        const buttons = ui.elements.choices.querySelectorAll('button');
        buttons.forEach(btn => btn.disabled = true);

        // Highlight correct answer
        buttons.forEach(btn => {
          if (btn.textContent === correct) {
            btn.classList.add('correct');
          }
        });

        // Highlight wrong if incorrect
        if (!isCorrect) {
          button.classList.add('wrong');
        } else {
          // Trigger confetti for correct answer
          this.confetti?.burst?.({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
        }

        setTimeout(() => {
          resolve({
            correct: isCorrect,
            time: result.time,
            timeLimit: challenge.timeLimit
          });
        }, 1200);
      };

      const handleTimeout = () => {
        if (answered) return;
        answered = true;

        // Show multiple choice if not already shown
        if (!mcShown) {
          ui.showMultipleChoice();
          ui.populateChoices(shuffled, correctAnswer, () => {});
        }

        // Highlight correct answer
        const buttons = ui.elements.choices.querySelectorAll('button');
        buttons.forEach(btn => {
          if (btn.textContent === correctAnswer) {
            btn.classList.add('correct');
          }
          btn.disabled = true;
        });

        setTimeout(() => {
          resolve({
            correct: false,
            time: challenge.timeLimit,
            timeLimit: challenge.timeLimit
          });
        }, 1200);
      };

      // Setup events
      ui.setupEvents({
        onTextSubmit: handleTextSubmit,
        onEnter: handleTextSubmit
      });
      window.addEventListener('daily-timeout', handleTimeout, { once: true });
    });
  }

  async runConnectGame(challenge, container) {
    // challenge.data must be: { start, end, path }
    return await runEmbeddedRouteGame(container, {
      fixedRound: challenge.data,
      neighbors: challenge.neighbors,
      confetti: this.confetti
    });
  }
}

// Initialize when page loads
const challenge = new DailyChallenge();
challenge.init();
