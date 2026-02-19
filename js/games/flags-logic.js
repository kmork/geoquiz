/**
 * Flags Game - Pure Logic Module
 *
 * Handles flags quiz game logic without any DOM dependencies.
 * Can be used by both standalone game and Daily Challenge.
 */

import { shuffleArray } from '../game-utils.js';

export class FlagsGameLogic {
  constructor({ onAnswer, onComplete, singleRound = false, data = null,
                flagsData = null, neighborsData = null }) {
    this.rawData = data || window.DATA;
    this.flagsData = flagsData;
    this.neighborsData = neighborsData;
    this.maxRounds = singleRound ? 1 : 10;
    this.singleRound = singleRound;
    this.onAnswer = onAnswer;
    this.onComplete = onComplete;

    this.DATA = []; // filtered to countries with flags
    this.deck = [];
    this.current = null;
    this.score = 0;
    this.correctCount = 0;
    this.roundEnded = false;
    this.startTime = null;
    this.gameStartTime = null;
  }

  async loadData() {
    const [flagsData, neighborsData] = await Promise.all([
      fetch('data/countries-flags.json').then(r => r.json()),
      fetch('data/countries-neighbors.json').then(r => r.json())
    ]);
    this.flagsData = flagsData;
    this.neighborsData = neighborsData;
    this._buildFilteredData();
  }

  _buildFilteredData() {
    if (!this.flagsData) return;
    const src = this.rawData || window.DATA;
    this.DATA = src.filter(c => this.flagsData[c.country]);
  }

  reset() {
    this._buildFilteredData();
    this.deck = shuffleArray([...this.DATA]).slice(0, this.maxRounds);
    this.current = null;
    this.score = 0;
    this.correctCount = 0;
    this.roundEnded = false;
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
          correctCount: this.correctCount,
          accuracy: this.getAccuracy(),
          time: totalTime
        });
      }
      return null;
    }

    this.current = this.deck.pop();
    this.roundEnded = false;
    this.startTime = Date.now();
    if (!this.gameStartTime) {
      this.gameStartTime = Date.now();
    }
    return this.current;
  }

  /**
   * Generate 3 wrong-answer country names using neighbors first, then random.
   * @param {object|null} rng - Optional seeded RNG (must have .shuffle(arr) method)
   * @returns {string[]} Array of 3 country names (not including the correct one)
   */
  generateWrongFlags(rng = null) {
    if (!this.current || !this.flagsData) return [];

    const correctCountry = this.current.country;
    const correctISO = this.flagsData[correctCountry];

    const shuffle = rng ? (arr) => rng.shuffle([...arr]) : shuffleArray;

    // Build pool of all valid countries (excluding correct)
    const allValid = this.DATA.filter(c => c.country !== correctCountry);

    // Try neighbors first (by country name lookup in neighborsData)
    let neighborNames = [];
    if (this.neighborsData) {
      // Neighbors data keys may use different names — try a case-insensitive lookup
      const normKey = (s) => (s || '').toLowerCase().trim();
      const correctKey = normKey(correctCountry);
      let nbrs = this.neighborsData[correctCountry];
      if (!nbrs) {
        const found = Object.keys(this.neighborsData).find(k => normKey(k) === correctKey);
        nbrs = found ? this.neighborsData[found] : [];
      }
      // Keep only neighbors that have valid flags and different ISO (avoid near-identical)
      neighborNames = (nbrs || []).filter(n => {
        const iso = this.flagsData[n];
        return iso && iso !== correctISO;
      });
    }

    const wrongAnswers = [];
    const used = new Set([correctCountry]);

    // Fill from neighbors
    const shuffledNeighbors = shuffle(neighborNames);
    for (const name of shuffledNeighbors) {
      if (wrongAnswers.length >= 3) break;
      if (!used.has(name) && this.flagsData[name]) {
        wrongAnswers.push(name);
        used.add(name);
      }
    }

    // Fill remainder from random pool
    if (wrongAnswers.length < 3) {
      const remaining = shuffle(allValid.map(c => c.country).filter(n => !used.has(n)));
      for (const name of remaining) {
        if (wrongAnswers.length >= 3) break;
        wrongAnswers.push(name);
        used.add(name);
      }
    }

    return wrongAnswers.slice(0, 3);
  }

  /**
   * Check if the selected country is correct
   */
  checkAnswer(selectedCountry) {
    if (this.roundEnded || !this.current) {
      return { action: 'ignore' };
    }

    const correctCountry = this.current.country;
    const isCorrect = selectedCountry === correctCountry;
    const timeTaken = (Date.now() - this.startTime) / 1000;

    this.roundEnded = true;

    if (isCorrect) {
      this.score++;
      this.correctCount++;
    }

    const result = {
      action: isCorrect ? 'correct' : 'wrong',
      isCorrect,
      selectedCountry,
      correctCountry,
      correctISO: this.flagsData ? this.flagsData[correctCountry] : null,
      time: timeTaken,
      score: this.score
    };

    if (this.onAnswer) {
      this.onAnswer(result);
    }

    return result;
  }

  handleTimeout() {
    if (this.roundEnded || !this.current) return null;

    this.roundEnded = true;
    const timeTaken = (Date.now() - this.startTime) / 1000;
    const correctCountry = this.current.country;

    const result = {
      action: 'timeout',
      isCorrect: false,
      correctCountry,
      correctISO: this.flagsData ? this.flagsData[correctCountry] : null,
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
    const played = this.maxRounds - this.deck.length;
    return played > 0 ? Math.round((this.correctCount / played) * 100) : 0;
  }
}
