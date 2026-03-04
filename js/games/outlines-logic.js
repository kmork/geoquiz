/**
 * Outlines Game - Pure Logic Module
 *
 * Handles outlines game logic without any DOM/SVG dependencies.
 * Can be used by both standalone game and Daily Challenge.
 *
 * One attempt per round. The player can optionally use the hint button
 * (which shows neighbors) before guessing — using the hint halves the
 * points awarded for a correct answer.
 */

import { norm } from "../utils.js";
import { shuffleInPlace } from "../game-utils.js";
import { resolveAlias } from "../aliases.js";

export class OutlinesGameLogic {
  constructor({ onAnswer, onComplete, singleRound = false, maxRounds = 10 }) {
    this.DATA = window.DATA;
    this._configMaxRounds = singleRound ? 1 : maxRounds;
    this.maxRounds = this._configMaxRounds;
    this.singleRound = singleRound;
    this.onAnswer = onAnswer;
    this.onComplete = onComplete;

    this.deck = [];
    this.current = null;
    this.score = 0;
    this.correct = 0;
    this.roundEnded = false;
    this.usedHint = false;
    this.startTime = null;
    this.gameStartTime = null;
  }

  reset() {
    this.deck = shuffleInPlace([...this.DATA]).slice(0, this._configMaxRounds);
    this.maxRounds = this.deck.length;
    this.current = null;
    this.score = 0;
    this.correct = 0;
    this.roundEnded = false;
    this.usedHint = false;
    this.gameStartTime = null;
  }

  setCountry(country) {
    this.deck = [country];
    this.usedHint = false;
  }

  hasMoreRounds() {
    return this.deck.length > 0;
  }

  nextRound() {
    if (this.deck.length === 0) {
      if (this.onComplete) {
        const totalTime = this.gameStartTime ? (Date.now() - this.gameStartTime) / 1000 : 0;
        this.onComplete({
          score: this.score,
          total: this.maxRounds,
          correct: this.correct,
          accuracy: this.getAccuracy(),
          time: totalTime,
          usedHint: this.usedHint
        });
      }
      return null;
    }

    this.current = this.deck.pop();
    this.roundEnded = false;
    this.usedHint = false;
    this.startTime = Date.now();

    if (!this.gameStartTime) {
      this.gameStartTime = Date.now();
    }

    return this.current;
  }

  getCurrentCountry() {
    return this.current;
  }

  /** Called by the UI when the player activates the hint button. */
  markHintUsed() {
    this.usedHint = true;
  }

  /**
   * Check if an answer is correct (single attempt).
   * Returns object with:
   * - action: 'correct' | 'wrong' | 'skip' | 'ignore'
   * - isCorrect: boolean
   * - points: number (2 without hint, 1 with hint)
   * - message: string
   * - correctAnswer: string
   * - time: number (seconds elapsed)
   */
  checkAnswer(userAnswer) {
    if (this.roundEnded) {
      return { action: 'ignore' };
    }

    const trimmed = userAnswer.trim();
    const timeTaken = (Date.now() - this.startTime) / 1000;
    this.roundEnded = true;

    // Empty answer = skip
    if (!trimmed) {
      const result = {
        action: 'skip',
        isCorrect: false,
        correctAnswer: this.current.country,
        message: `❌ Skipped. The answer was: ${this.current.country}`,
        time: timeTaken,
        usedHint: this.usedHint
      };
      if (this.onAnswer) this.onAnswer(result);
      return result;
    }

    // Check answer (handle aliases)
    const isCorrect = norm(resolveAlias(trimmed)) === norm(this.current.country);

    if (isCorrect) {
      const points = this.usedHint ? 1 : 2;
      this.score += points;
      this.correct++;

      const message = this.singleRound
        ? '✅ Correct!'
        : `✅ Correct! +${points} point${points > 1 ? 's' : ''}`;

      const result = {
        action: 'correct',
        isCorrect: true,
        points,
        message,
        correctAnswer: this.current.country,
        time: timeTaken,
        usedHint: this.usedHint,
        score: this.score
      };
      if (this.onAnswer) this.onAnswer(result);
      return result;
    }

    // Wrong answer
    const result = {
      action: 'wrong',
      isCorrect: false,
      correctAnswer: this.current.country,
      message: `❌ Wrong. The answer was: ${this.current.country}`,
      time: timeTaken,
      usedHint: this.usedHint
    };
    if (this.onAnswer) this.onAnswer(result);
    return result;
  }

  handleTimeout() {
    if (this.roundEnded) return null;
    this.roundEnded = true;
    const timeTaken = (Date.now() - this.startTime) / 1000;

    const result = {
      action: 'timeout',
      isCorrect: false,
      correctAnswer: this.current.country,
      message: `⏱️ Time's up! The answer was: ${this.current.country}`,
      time: timeTaken,
      usedHint: this.usedHint
    };
    if (this.onAnswer) this.onAnswer(result);
    return result;
  }

  getProgress() {
    return {
      current: this.maxRounds - this.deck.length,
      total: this.maxRounds,
      score: this.score
    };
  }

  getAccuracy() {
    return this.maxRounds > 0
      ? Math.round((this.correct / this.maxRounds) * 100)
      : 0;
  }
}
