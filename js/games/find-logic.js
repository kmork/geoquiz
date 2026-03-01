/**
 * Find Country Game - Pure Logic Module
 * 
 * Handles find-country game logic without any DOM/map dependencies.
 * Can be used by both standalone game and Daily Challenge.
 */

import { shuffleInPlace } from "../game-utils.js";

// Countries with no visible outline on the map even when fully zoomed in
const FIND_EXCLUDE = new Set([]);

export class FindCountryGameLogic {
  constructor({ onAnswer, onComplete, singleRound = false, maxRounds = 10 }) {
    this.DATA = window.DATA.filter(c => !FIND_EXCLUDE.has(c.country));
    this._configMaxRounds = singleRound ? 1 : maxRounds;
    this.maxRounds = this._configMaxRounds;
    this.singleRound = singleRound;
    this.onAnswer = onAnswer;
    this.onComplete = onComplete;
    
    this.deck = [];
    this.current = null;
    this.score = 0;
    this.correctCount = 0;
    this.selectedCountry = null; // Track first click selection
    this.roundEnded = false;
    this.startTime = null;
    this.gameStartTime = null;
    this.lastAnswerTime = 0; // Track time from last answer
  }

  reset() {
    this.deck = shuffleInPlace([...this.DATA]).slice(0, this._configMaxRounds);
    this.maxRounds = this.deck.length;
    this.current = null;
    this.score = 0;
    this.correctCount = 0;
    this.selectedCountry = null;
    this.roundEnded = false;
    this.gameStartTime = null;
  }

  setCountry(country) {
    this.deck = [country];
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
          correctCount: this.correctCount,
          accuracy: this.getAccuracy(),
          time: totalTime
        });
      }
      return null;
    }

    this.current = this.deck.pop();
    this.roundEnded = false;
    this.selectedCountry = null;
    this.startTime = Date.now();
    if (!this.gameStartTime) {
      this.gameStartTime = Date.now();
    }
    return this.current;
  }

  getCurrentCountry() {
    return this.current;
  }

  /**
   * Handle a map click. Returns object with:
   * - action: 'select' | 'correct' | 'wrong'
   * - clickedCountry: string
   * - correctCountry: string
   * - needsConfirm: boolean
   * - isCorrect: boolean (for 'correct'/'wrong')
   * - time: number (for 'correct'/'wrong')
   */
  handleClick(clickedCountryName, hintUsed = false) {
    if (this.roundEnded || !this.current) {
      return { action: 'ignore' };
    }

    // First click or different country: Just select
    if (this.selectedCountry !== clickedCountryName) {
      this.selectedCountry = clickedCountryName;
      return {
        action: 'select',
        clickedCountry: clickedCountryName,
        needsConfirm: true
      };
    }

    // Second click on same country: Submit answer
    const isCorrect = clickedCountryName === this.current.country;
    const timeTaken = (Date.now() - this.startTime) / 1000;
    this.roundEnded = true;
    this.lastAnswerTime = timeTaken; // Save time for final result

    if (isCorrect) {
      this.score += hintUsed ? 1 : 2;
      this.correctCount++;
    }

    const result = {
      action: isCorrect ? 'correct' : 'wrong',
      clickedCountry: clickedCountryName,
      correctCountry: this.current.country,
      isCorrect,
      hintUsed,
      time: timeTaken,
      score: this.score
    };

    if (this.onAnswer) {
      this.onAnswer(result);
    }

    return result;
  }

  handleTimeout() {
    if (this.roundEnded || !this.current) {
      return null;
    }

    this.roundEnded = true;
    const timeTaken = (Date.now() - this.startTime) / 1000;
    this.lastAnswerTime = timeTaken; // Save time for final result

    const result = {
      action: 'timeout',
      correctCountry: this.current.country,
      isCorrect: false,
      time: timeTaken,
      score: this.score
    };

    if (this.onAnswer) {
      this.onAnswer(result);
    }

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
      ? Math.round((this.correctCount / this.maxRounds) * 100) 
      : 0;
  }
}
