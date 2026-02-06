/**
 * Seeded Random Number Generator
 * 
 * Provides deterministic randomization based on a seed value.
 * Used to ensure all players get the same daily challenge on the same date.
 * 
 * @example
 * const rng = new SeededRandom(20260206);
 * console.log(rng.next()); // Always same value for seed 20260206
 * console.log(rng.nextInt(0, 10)); // Random int between 0-9
 */

export class SeededRandom {
  /**
   * Create a new seeded random number generator
   * @param {number} seed - The seed value (e.g., date as number: 20260206)
   */
  constructor(seed) {
    this.seed = seed % 2147483647; // Keep seed in reasonable range
    if (this.seed <= 0) this.seed += 2147483646;
  }

  /**
   * Generate next random number (0 to 1, exclusive)
   * Uses Linear Congruential Generator (LCG) algorithm
   * @returns {number} Random number between 0 and 1
   */
  next() {
    // LCG using GCC constants (widely tested, good randomness)
    this.seed = (this.seed * 1103515245 + 12345) % 2147483647;
    return this.seed / 2147483647;
  }

  /**
   * Generate random integer in range [min, max)
   * @param {number} min - Minimum value (inclusive)
   * @param {number} max - Maximum value (exclusive)
   * @returns {number} Random integer
   */
  nextInt(min, max) {
    return Math.floor(this.next() * (max - min)) + min;
  }

  /**
   * Shuffle array using Fisher-Yates algorithm with seeded randomness
   * Returns a new shuffled array (does not modify original)
   * @param {Array} array - Array to shuffle
   * @returns {Array} New shuffled array
   */
  shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * Select random element from array
   * @param {Array} array - Array to select from
   * @returns {*} Random element
   */
  choice(array) {
    return array[this.nextInt(0, array.length)];
  }

  /**
   * Select N random elements from array (without replacement)
   * @param {Array} array - Array to select from
   * @param {number} count - Number of elements to select
   * @returns {Array} Array of randomly selected elements
   */
  sample(array, count) {
    const shuffled = this.shuffle(array);
    return shuffled.slice(0, Math.min(count, array.length));
  }
}

/**
 * Convert date string to numeric seed
 * @param {string} dateString - Date in ISO format (YYYY-MM-DD)
 * @returns {number} Numeric seed
 * @example
 * dateToSeed("2026-02-06") // Returns 20260206
 */
export function dateToSeed(dateString) {
  // Remove hyphens and convert to number: "2026-02-06" → 20260206
  return parseInt(dateString.replace(/-/g, ''), 10);
}

/**
 * Get today's date as YYYY-MM-DD string (local timezone)
 * @returns {string} Today's date
 */
export function getTodayDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculate challenge number (days since launch date)
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @param {string} launchDate - Launch date in YYYY-MM-DD format (default: 2026-01-01)
 * @returns {number} Challenge number (1-based)
 */
export function getChallengeNumber(dateString, launchDate = '2026-01-01') {
  const launch = new Date(launchDate + 'T00:00:00');
  const current = new Date(dateString + 'T00:00:00');
  const diffMs = current - launch;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays + 1);
}
