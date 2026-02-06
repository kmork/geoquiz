/**
 * Daily Challenge Scoring & Statistics
 * 
 * Manages localStorage for daily challenge results, streaks, and statistics.
 * Enforces once-per-day limitation.
 */

const STORAGE_KEY_HISTORY = 'geoquiz-daily-history';
const STORAGE_KEY_STATS = 'geoquiz-daily-stats';

/**
 * Calculate stars earned for a single mini-game
 * Difficulty-based scoring:
 * - Trivia: 2★ max (easy - multiple choice)
 * - Heritage: 3★ max (medium - visual + autocomplete)
 * - Outlines: 4★ max (hard - shape recognition)
 * - Capitals: 4★ max (hard - knowledge test)
 * - Find: 5★ max (very hard - speed + precision)
 * - Connect: 5★ max (very hard - path optimization)
 * Total: 23★
 * 
 * @param {object} result - Game result
 * @param {boolean} result.correct - Whether answer was correct
 * @param {number} result.time - Time taken in seconds
 * @param {number} result.timeLimit - Time limit in seconds
 * @param {boolean} result.usedHint - Whether hint was used
 * @param {number} result.parDiff - For Connect game: difference from par (optional)
 * @param {string} gameId - Game identifier
 * @returns {number} Stars earned (0-5)
 */
export function calculateStars(result, gameId) {
  // Wrong answer = 0 stars
  if (!result.correct) return 0;

  // Trivia (2★ max): 1★ base + 1★ speed bonus if < 5 seconds
  if (gameId === 'trivia') {
    let stars = 1; // Base for correct
    if (result.time && result.time < 5) {
      stars += 1; // Speed bonus
    }
    return stars;
  }

  // Connect the Countries (5★ max): Par-based scoring
  if (result.parDiff !== undefined) {
    if (result.parDiff === 0) return 5; // Optimal route
    if (result.parDiff === 1) return 4;
    if (result.parDiff === 2) return 3;
    if (result.parDiff === 3) return 2;
    return 1; // Par + 4 or worse
  }

  // Base stars by difficulty
  let stars;
  if (gameId === 'picture') {
    stars = 2; // Heritage: 3★ max (2 base + 1 time)
  } else if (gameId === 'outlines' || gameId === 'capitals') {
    stars = 3; // Outlines/Capitals: 4★ max (3 base + 1 time)
  } else if (gameId === 'find') {
    stars = 3; // Find: 5★ max (3 base + 2 time)
  } else {
    stars = 3; // Default
  }

  // Time bonus
  if (result.timeLimit && result.time !== undefined && result.time !== null) {
    if (gameId === 'find') {
      // Find the Country: +2 or +1 stars
      if (result.time < 5) {
        stars += 2; // Very fast (< 5 seconds)
      } else if (result.time < 10) {
        stars += 1; // Fast (< 10 seconds)
      }
    } else {
      // Other games: +1 star only
      const timeRatio = result.time / result.timeLimit;
      if (timeRatio < 0.5) {
        stars += 1; // Fast (< 50% of time)
      }
    }
  }

  // Hint penalty
  if (result.usedHint) {
    stars -= 1;
  }

  return Math.max(0, stars);
}

/**
 * Save today's challenge result to localStorage
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {number} totalStars - Total stars earned (0-23)
 * @param {number} totalTime - Total time in seconds
 * @param {Array} breakdown - Array of per-game results
 */
export function saveResult(date, totalStars, totalTime, breakdown) {
  // Save to history
  const history = getHistory();
  history[date] = {
    completed: true,
    stars: totalStars,
    totalTime,
    breakdown,
    timestamp: Date.now()
  };
  localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));

  // Update stats
  updateStats(date, totalStars);
}

/**
 * Get challenge history from localStorage
 * @returns {object} History object (date → result)
 */
export function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY) || '{}');
  } catch (err) {
    console.error('Failed to parse history:', err);
    return {};
  }
}

/**
 * Get result for specific date
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {object|null} Result object or null if not played
 */
export function getResultForDate(date) {
  const history = getHistory();
  return history[date] || null;
}

/**
 * Check if today's challenge has been completed
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {boolean} True if already completed
 */
export function hasCompletedToday(date) {
  const history = getHistory();
  return history[date]?.completed === true;
}

/**
 * Update statistics after completing a challenge
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {number} stars - Stars earned today
 */
function updateStats(date, stars) {
  const stats = getStats();
  const history = getHistory();

  // Calculate streak
  stats.currentStreak = calculateStreak(history, date);
  stats.maxStreak = Math.max(stats.maxStreak || 0, stats.currentStreak);

  // Total completed
  stats.totalCompleted = Object.keys(history).length;

  // Average stars
  const totalStars = Object.values(history).reduce((sum, r) => sum + r.stars, 0);
  stats.averageStars = stats.totalCompleted > 0 
    ? (totalStars / stats.totalCompleted).toFixed(1)
    : '0.0';

  // Personal best
  stats.bestStars = Math.max(stats.bestStars || 0, stars);

  // Last played
  stats.lastPlayed = date;

  localStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(stats));
}

/**
 * Get statistics from localStorage
 * @returns {object} Stats object
 */
export function getStats() {
  try {
    const defaultStats = {
      currentStreak: 0,
      maxStreak: 0,
      totalCompleted: 0,
      averageStars: '0.0',
      bestStars: 0,
      lastPlayed: null
    };
    const stored = localStorage.getItem(STORAGE_KEY_STATS);
    return stored ? { ...defaultStats, ...JSON.parse(stored) } : defaultStats;
  } catch (err) {
    console.error('Failed to parse stats:', err);
    return {
      currentStreak: 0,
      maxStreak: 0,
      totalCompleted: 0,
      averageStars: '0.0',
      bestStars: 0,
      lastPlayed: null
    };
  }
}

/**
 * Calculate current streak (consecutive days completed)
 * @param {object} history - Challenge history
 * @param {string} currentDate - Current date (YYYY-MM-DD)
 * @returns {number} Current streak in days
 */
function calculateStreak(history, currentDate) {
  let streak = 0;
  let date = new Date(currentDate + 'T00:00:00');

  while (true) {
    const dateStr = date.toISOString().split('T')[0];
    if (history[dateStr]?.completed) {
      streak++;
      date.setDate(date.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Get rating based on total stars
 * @param {number} stars - Total stars (0-23)
 * @returns {string} Rating text
 */
export function getRating(stars) {
  if (stars >= 21) return 'Geography Master';
  if (stars >= 18) return 'World Expert';
  if (stars >= 14) return 'Globe Trotter';
  if (stars >= 10) return 'Explorer';
  if (stars >= 6) return 'Traveler';
  return 'Tourist';
}

/**
 * Get rating emoji based on total stars
 * @param {number} stars - Total stars (0-23)
 * @returns {string} Rating emoji
 */
export function getRatingEmoji(stars) {
  if (stars >= 21) return '🏆';
  if (stars >= 18) return '⭐';
  if (stars >= 14) return '🌟';
  if (stars >= 10) return '✨';
  if (stars >= 6) return '🎯';
  return '🗺️';
}

/**
 * Get maximum possible stars for a game
 * @param {string} gameId - Game identifier
 * @returns {number} Maximum stars (1-5)
 */
export function getMaxStars(gameId) {
  const maxStars = {
    'trivia': 2,      // Easy: multiple choice
    'picture': 3,     // Medium: visual + autocomplete
    'outlines': 4,    // Hard: shape recognition
    'capitals': 4,    // Hard: knowledge test
    'find': 5,        // Very hard: speed + precision
    'connect': 5      // Very hard: path optimization
  };
  return maxStars[gameId] || 5;
}

/**
 * Format time as MM:SS
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time (e.g., "3:07")
 */
export function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Calculate time until next challenge (midnight local time)
 * @returns {object} Object with hours and minutes until midnight
 */
export function getTimeUntilNext() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  const diffMs = tomorrow - now;
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  return { hours, minutes };
}

/**
 * Clear all daily challenge data (for debugging/testing)
 * WARNING: This deletes all history and stats!
 */
export function clearAllData() {
  localStorage.removeItem(STORAGE_KEY_HISTORY);
  localStorage.removeItem(STORAGE_KEY_STATS);
}
