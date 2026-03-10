/**
 * Rotated Outlines Game - Pure Logic Module
 *
 * Country outlines are shown rotated by a random angle. The player must
 * drag-rotate the outline back to the correct orientation AND guess the
 * country name.
 *
 * Scoring: max(0, 180 - angularError) points per round, only if name correct.
 */

import { norm } from "../utils.js";
import { shuffleInPlace } from "../game-utils.js";
import { resolveAlias } from "../aliases.js";

export class RotatedGameLogic {
  constructor({ onAnswer, onComplete, maxRounds = 10, rotateOnly = false }) {
    this.DATA = window.DATA;
    this._configMaxRounds = maxRounds;
    this.maxRounds = this._configMaxRounds;
    this.rotateOnly = rotateOnly;
    this.onAnswer = onAnswer;
    this.onComplete = onComplete;

    this.deck = [];
    this.current = null;
    this.score = 0;
    this.correct = 0;
    this.roundEnded = false;
    this.randomAngle = 0;
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
    this.randomAngle = 0;
    this.gameStartTime = null;
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
        });
      }
      return null;
    }

    this.current = this.deck.pop();
    this.roundEnded = false;
    // Random angle between 30° and 330° (avoids near-0° so it's clearly rotated)
    this.randomAngle = 30 + Math.random() * 300;
    this.startTime = Date.now();

    if (!this.gameStartTime) {
      this.gameStartTime = Date.now();
    }

    return this.current;
  }

  getCurrentCountry() {
    return this.current;
  }

  getRandomAngle() {
    return this.randomAngle;
  }

  /**
   * Check answer — both the typed name AND the current rotation angle.
   * angularError = shortest distance to 0° (or 360°), range [0, 180].
   * Points = nameCorrect ? max(0, round(180 - angularError)) : 0.
   */
  checkAnswer(userAnswer, currentAngle) {
    if (this.roundEnded) {
      return { action: 'ignore' };
    }

    const trimmed = userAnswer.trim();
    const timeTaken = (Date.now() - this.startTime) / 1000;
    this.roundEnded = true;

    // Normalize angle to [0, 360)
    let normalized = ((currentAngle % 360) + 360) % 360;
    const angularError = Math.min(normalized, 360 - normalized); // [0, 180]

    // Empty answer = skip
    if (!trimmed) {
      const result = {
        action: 'skip',
        isCorrect: false,
        points: 0,
        angularError,
        correctAnswer: this.current.country,
        message: `Skipped. The answer was: ${this.current.country}`,
        time: timeTaken,
      };
      if (this.onAnswer) this.onAnswer(result);
      return result;
    }

    const isCorrect = norm(resolveAlias(trimmed)) === norm(this.current.country);

    if (isCorrect) {
      const points = Math.max(0, Math.round(180 - angularError));
      this.score += points;
      this.correct++;

      const errorDeg = Math.round(angularError);
      const result = {
        action: 'correct',
        isCorrect: true,
        points,
        angularError,
        correctAnswer: this.current.country,
        message: `✅ ${points} points! (${errorDeg}° off)`,
        time: timeTaken,
        score: this.score,
      };
      if (this.onAnswer) this.onAnswer(result);
      return result;
    }

    // Wrong answer
    const result = {
      action: 'wrong',
      isCorrect: false,
      points: 0,
      angularError,
      correctAnswer: this.current.country,
      message: `❌ Wrong. The answer was: ${this.current.country}`,
      time: timeTaken,
    };
    if (this.onAnswer) this.onAnswer(result);
    return result;
  }

  getProgress() {
    return {
      current: this.maxRounds - this.deck.length,
      total: this.maxRounds,
      score: this.score,
    };
  }

  getAccuracy() {
    return this.maxRounds > 0
      ? Math.round((this.correct / this.maxRounds) * 100)
      : 0;
  }
}
