/**
 * Daily Game Runner - Base class for running Daily Challenge games
 * Provides unified promise wrapper, timeout handling, and cleanup
 */

export class DailyGameRunner {
  constructor(confetti) {
    this.confetti = confetti;
  }

  /**
   * Run a game with unified flow
   * @param {Object} config - Game configuration
   * @param {HTMLElement} config.container - Container element
   * @param {Object} config.challenge - Challenge data
   * @param {Function} config.onAnswer - Handle answer callback
   * @param {Function} config.onTimeout - Handle timeout callback
   * @param {number} config.successDelay - Delay before resolving (ms)
   * @returns {Promise} Resolves with game result
   */
  async run(config) {
    const {
      container,
      challenge,
      onAnswer,
      onTimeout,
      successDelay = 1500
    } = config;

    return new Promise(resolve => {
      let answered = false;
      const listeners = [];

      // Helper: add listener with cleanup tracking
      const addListener = (elem, event, handler, options) => {
        elem.addEventListener(event, handler, options);
        listeners.push({ elem, event, handler });
      };

      // Helper: cleanup all listeners
      const cleanup = () => {
        listeners.forEach(({ elem, event, handler }) => {
          elem.removeEventListener(event, handler);
        });
      };

      // Unified answer handler
      const handleAnswer = (result) => {
        if (answered) return;
        answered = true;

        // Call game-specific logic
        onAnswer(result);

        // Resolve after delay
        setTimeout(() => {
          cleanup();
          resolve({
            correct: result.correct || result.isCorrect,
            time: result.time,
            timeLimit: challenge.timeLimit,
            usedHint: result.usedHint || result.hintsUsed > 0
          });
        }, successDelay);
      };

      // Unified timeout handler
      const handleTimeout = () => {
        if (answered) return;
        answered = true;

        // Call game-specific timeout logic
        const result = onTimeout();

        // Resolve after delay
        setTimeout(() => {
          cleanup();
          resolve({
            correct: false,
            time: challenge.timeLimit,
            timeLimit: challenge.timeLimit
          });
        }, successDelay);
      };

      // Register timeout listener
      addListener(window, 'daily-timeout', handleTimeout, { once: true });

      // Expose handleAnswer for game-specific code
      config.handleAnswer = handleAnswer;
      config.addListener = addListener;
      config.cleanup = cleanup;
    });
  }
}
