/**
 * Game Utilities Module
 * 
 * Shared helper functions used across multiple games.
 * Prevents code duplication and ensures consistent behavior.
 */

/**
 * Detects if the current device is a mobile device
 * @returns {boolean} True if mobile device detected
 */
export function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
    || (window.innerWidth <= 640);
}

/**
 * Provides haptic feedback on mobile devices
 * @param {string} pattern - Type of feedback: 'correct', 'wrong', or 'hint'
 */
export function hapticFeedback(pattern) {
  if (!navigator.vibrate) return;
  if (!isMobileDevice()) return;
  
  const patterns = {
    correct: 50,              // Short pulse for correct answer
    wrong: [100, 50, 100],   // Double buzz for wrong answer
    hint: 25                  // Very short pulse for hints
  };
  
  navigator.vibrate(patterns[pattern] || 50);
}

/**
 * Adds a visual flash effect to indicate correct answer
 * @param {HTMLElement} element - Element to flash
 */
export function flashCorrect(element) {
  if (!element) return;
  element.classList.add('flash-correct');
  setTimeout(() => element.classList.remove('flash-correct'), 800);
}

/**
 * Adds a shake animation to indicate wrong answer
 * @param {HTMLElement} element - Element to shake
 */
export function shakeWrong(element) {
  if (!element) return;
  element.classList.add('shake-wrong');
  setTimeout(() => element.classList.remove('shake-wrong'), 500);
}

/**
 * Shuffles an array in place using Fisher-Yates algorithm
 * @param {Array} arr - Array to shuffle (will be modified)
 * @returns {Array} The shuffled array (same reference)
 */
export function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Creates a shuffled copy of an array
 * @param {Array} arr - Original array (not modified)
 * @returns {Array} New shuffled array
 */
export function shuffleArray(arr) {
  const copy = [...arr];
  return shuffleInPlace(copy);
}
