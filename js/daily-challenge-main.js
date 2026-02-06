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
    
    // Build country data with regions from GeoJSON
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
          // Pick two countries with a valid path (like route-game does)
          const countryNames = Object.keys(neighborsData);
          let attempts = 0;
          const maxAttempts = 100;
          
          while (attempts < maxAttempts) {
            const start = this.rng.choice(data);
            const end = this.rng.choice(data);
            
            if (start.country === end.country) {
              attempts++;
              continue;
            }
            
            // Quick BFS check to see if there's a path
            const queue = [[start.country]];
            const visited = new Set([start.country]);
            let foundPath = false;
            
            while (queue.length > 0 && !foundPath) {
              const path = queue.shift();
              const current = path[path.length - 1];
              
              if (current === end.country) {
                // Found a path! Check if reasonable length (1-8 steps)
                const pathLength = path.length - 1;
                if (pathLength >= 1 && pathLength <= 8) {
                  foundPath = true;
                  break;
                }
              }
              
              const currentNeighbors = neighborsData[current] || [];
              for (const neighbor of currentNeighbors) {
                if (!visited.has(neighbor) && path.length < 10) { // Limit search depth
                  visited.add(neighbor);
                  queue.push([...path, neighbor]);
                }
              }
            }
            
            if (foundPath) {
              return { start, end };
            }
            
            attempts++;
          }
          
          // Fallback: use a known good pair
          return {
            start: data.find(c => c.country === 'France') || data[0],
            end: data.find(c => c.country === 'Germany') || data[1]
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
    const startCountry = challenge.data.start;
    const endCountry = challenge.data.end;
    const neighbors = challenge.neighbors;
    
    // Create game logic instance
    const gameLogic = new RouteGameLogic({ 
      neighbors,
      singleRound: true 
    });
    
    const routeInfo = gameLogic.setRoute(startCountry.country, endCountry.country);
    let answered = false;
    
    container.innerHTML = `
      <div style="max-width: 700px; margin: 0 auto;">
        <p style="font-size: 1.2rem; margin-bottom: 0.5rem;">
          Connect <strong>${startCountry.country}</strong> to <strong>${endCountry.country}</strong>
        </p>
        <p style="color: var(--text-secondary); margin-bottom: 1rem; font-size: 0.95rem;">
          Par: ${routeInfo.par} step${routeInfo.par !== 1 ? 's' : ''} countries
        </p>
        
        <!-- Route Display (like standalone) -->
        <div id="route-display" class="route-display" style="padding: 1rem; background: var(--card-bg); border-radius: 8px; margin-bottom: 1rem; text-align: center; font-size: 1.1rem;">
          <span class="route-country start">${startCountry.country}</span>
          <span class="route-arrow"> → </span>
          <span class="route-placeholder">?</span>
          <span class="route-arrow"> → </span>
          <span class="route-country end">${endCountry.country}</span>
        </div>
        
        <!-- SVG Map -->
        <div style="margin-bottom: 1rem;">
          <svg id="daily-route-map" viewBox="0 0 600 320" style="width: 100%; height: auto; max-height: 320px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--map-bg);"></svg>
        </div>
        
        <div id="connect-hint" class="hint-message" style="display: none; margin-bottom: 1rem;"></div>
        
        <div class="answerRow" style="margin-bottom: 1rem;">
          <input type="text" id="connect-input" placeholder="Type the next country…" autocomplete="off">
          <button id="submit" class="btn btn-primary">Add to Route</button>
          <div class="secondary-buttons">
            <button id="undo" class="btn-secondary" disabled>↶</button>
            <button id="showHint" class="btn-secondary">💡</button>
            <button id="giveUp" class="btn-secondary">✖</button>
          </div>
        </div>
        <div id="connect-feedback"></div>
      </div>
    `;
    
    const input = document.getElementById('connect-input');
    const addBtn = document.getElementById('submit');
    const hintBtn = document.getElementById('showHint');
    const undoBtn = document.getElementById('undo');
    const giveUpBtn = document.getElementById('giveUp');
    const hintDiv = document.getElementById('connect-hint');
    const feedbackDiv = document.getElementById('connect-feedback');
    const mapSvg = document.getElementById('daily-route-map');
    const routeDisplayDiv = document.getElementById('route-display');
    
    feedbackDiv.style.cssText = 'display: none; padding: 1rem; border-radius: 8px; margin-top: 1rem;';
    
    // Load GeoJSON and create route renderer
    const { loadGeoJSON } = await import('./geojson-loader.js');
    const worldData = await loadGeoJSON('data/ne_10m_admin_0_countries.geojson.gz');
    
    const routeRenderer = new RouteRenderer(mapSvg, worldData, {
      aliases: window.COUNTRY_ALIASES || {}
    });
    
    // Draw initial route (just start and end countries)
    routeRenderer.drawRoute([
      { country: startCountry.country, color: 'start' },
      { country: endCountry.country, color: 'end' }
    ]);
    
    // Setup autocomplete with ALL countries (not just neighbors - player must know geography!)
    const allCountries = Object.keys(neighbors).sort();
    setupAutocomplete(input, allCountries);
    
    input.focus();
    
    function updateRouteDisplay(route) {
      // Build HTML similar to standalone: colored spans with arrows
      const spans = [];
      
      route.forEach((country, i) => {
        const className = i === 0 ? 'start' : 
                         i === route.length - 1 ? 'end' : 
                         'path';
        spans.push(`<span class="route-country ${className}">${country}</span>`);
        
        // Add arrow if not last
        if (i < route.length - 1) {
          spans.push('<span class="route-arrow"> → </span>');
        }
      });
      
      // If route isn't complete, add placeholder
      if (route[route.length - 1] !== endCountry.country) {
        spans.push('<span class="route-arrow"> → </span>');
        spans.push('<span class="route-placeholder">?</span>');
        spans.push('<span class="route-arrow"> → </span>');
        spans.push(`<span class="route-country end">${endCountry.country}</span>`);
      }
      
      routeDisplayDiv.innerHTML = spans.join('');
    }
    
    function updateDisplay() {
      const progress = gameLogic.getProgress();
      undoBtn.disabled = progress.route.length <= 1;
      
      // Update route display with colored spans
      updateRouteDisplay(progress.route);
      
      // Update map visualization - convert route to {country, color} format
      const countryList = progress.route.map((country, i) => {
        let color;
        if (i === 0) color = 'start';
        else if (i === progress.route.length - 1 && country === endCountry.country) color = 'end';
        else color = 'path';
        
        return { country, color };
      });
      
      // Always show the end country if not yet reached
      if (progress.route[progress.route.length - 1] !== endCountry.country) {
        countryList.push({ country: endCountry.country, color: 'end' });
      }
      
      routeRenderer.drawRoute(countryList);
    }
    
    function showHintFunc() {
      const result = gameLogic.getHint();
      
      if (result.action === 'no_hints_left') {
        showFeedback(feedbackDiv, '💡 No more hints available', false, 2000);
        return;
      }
      
      if (result.action === 'no_hint_available') {
        showFeedback(feedbackDiv, '💡 No hint available', false, 2000);
        return;
      }
      
      if (result.action === 'hint' && result.country) {
        // Visual hint: highlight the next optimal country on the map
        const progress = gameLogic.getProgress();
        const countryList = progress.route.map((country, i) => {
          let color;
          if (i === 0) color = 'start';
          else if (i === progress.route.length - 1 && country === endCountry.country) color = 'end';
          else color = 'path';
          return { country, color };
        });
        
        // Add end country if not reached
        if (progress.route[progress.route.length - 1] !== endCountry.country) {
          countryList.push({ country: endCountry.country, color: 'end' });
        }
        
        // Add hint country with special 'hint' color (yellow, dashed)
        countryList.push({ country: result.country, color: 'hint' });
        
        routeRenderer.drawRoute(countryList);
        
        showFeedback(feedbackDiv, '💡 Hint shown! (-1 point)', true, 3000);
        hintBtn.textContent = `💡 Hint (${result.hintsRemaining} left)`;
        if (result.hintsRemaining === 0) {
          hintBtn.disabled = true;
          hintBtn.style.opacity = '0.5';
        }
      }
    }
    
    // Initialize display
    updateDisplay();
    
    return new Promise(resolve => {
      function finishGame(result) {
        const userSteps = result.steps;
        const parDiff = result.parDiff;
        
        let message = `✓ Route complete! ${userSteps} step${userSteps !== 1 ? 's' : ''}`;
        if (parDiff === 0) message += ' (Optimal! ⭐⭐⭐⭐⭐)';
        else if (parDiff > 0) message += ` (Par +${parDiff})`;
        else message += ` (Under par! ${parDiff})`;
        
        showFeedback(feedbackDiv, message, true);
        
        setTimeout(() => {
          resolve({
            correct: true,
            time: result.time,
            timeLimit: null,
            parDiff: result.parDiff
          });
        }, 2000);
      }
      
      function addCountry() {
        const userInput = input.value.trim();
        if (!userInput) return;
        
        // Normalize and resolve country name (with alias support)
        const country = normalizeCountryInput(userInput, window.DATA || []);
        if (!country) {
          showFeedback(feedbackDiv, '❌ Country not found. Check spelling.', false, 2000);
          return;
        }
        
        const result = gameLogic.addCountry(country);
        
        if (result.action === 'invalid') {
          showFeedback(feedbackDiv, result.message, false, 2000);
          return;
        }
        
        if (result.action === 'added') {
          input.value = '';
          updateDisplay();
          showFeedback(feedbackDiv, `✓ Added ${country}`, true, 1000);
        }
        
        if (result.action === 'complete') {
          answered = true;
          finishGame(result);
        }
      }
      
      function undo() {
        const result = gameLogic.undo();
        if (result.action === 'undone') {
          updateDisplay();
          showFeedback(feedbackDiv, '↶ Undid last step', true, 1000);
        }
      }
      
      onEnterKey(input, addCountry);
      addBtn.addEventListener('click', addCountry);
      hintBtn.addEventListener('click', showHintFunc);
      undoBtn.addEventListener('click', undo);
      giveUpBtn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        
        // Show the optimal solution
        const solution = gameLogic.optimalPath;
        if (solution && solution.length > 0) {
          // Update route display to show solution
          updateRouteDisplay(solution);
          
          // Draw solution on map
          const routeColors = solution.map((country, i) => ({
            country,
            color: i === 0 ? 'start' : i === solution.length - 1 ? 'end' : 'path'
          }));
          routeRenderer.drawRoute(routeColors);
        }
        
        setTimeout(() => {
          resolve({
            correct: false,
            time: 0,
            timeLimit: null,
            parDiff: 999 // Large number to indicate gave up
          });
        }, 3000);
      });
    });
  }
}

// Initialize when page loads
const challenge = new DailyChallenge();
challenge.init();
