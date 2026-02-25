/**
 * Capital Pairs Game — Pure Logic Module
 *
 * Staggered-queue mechanic: two queues drawn from the same shuffled deck,
 * offset by 1. At any time exactly 2 of the 3 visible country-capital pairs
 * are matchable; the third is a decoy on each side.
 */

import { shuffleArray } from '../game-utils.js';

export class CapitalPairsLogic {
  constructor({ data, maxPairs }) {
    this.rawData = data || window.DATA;
    this.maxPairs = maxPairs;

    this.deck = [];          // [{country, capital}] — the shuffled, sliced pool
    this.capitalQueue = [];  // deck rotated left by 1
    this.countryPtr = 0;     // next index into deck to deal as a country
    this.capitalPtr = 0;     // next index into capitalQueue to deal as a capital

    this.visibleCountries = []; // [{country, pairIdx}]
    this.visibleCapitals  = []; // [{capital, pairIdx}]

    this.score        = 0;
    this.wrongGuesses = 0;
    this.totalPairs   = 0;
    this.startTime    = null;
  }

  reset() {
    const src = this.rawData || window.DATA;
    const allPairs = src
      .filter(c => c.capitals && c.capitals.length > 0)
      .map(c => ({ country: c.country, capital: c.capitals[0] }));

    const shuffled = shuffleArray(allPairs);
    const limit = this.maxPairs === Infinity
      ? shuffled.length
      : Math.min(this.maxPairs, shuffled.length);

    this.deck        = shuffled.slice(0, limit);
    this.totalPairs  = this.deck.length;

    // Capital queue: rotate deck left by 1 so deck[0]'s capital goes last
    this.capitalQueue = [...this.deck.slice(1), this.deck[0]];

    this.countryPtr       = 0;
    this.capitalPtr       = 0;
    this.visibleCountries = [];
    this.visibleCapitals  = [];
    this.score            = 0;
    this.wrongGuesses     = 0;
    this.startTime        = Date.now();

    this._fillSlots();
  }

  _fillSlots() {
    const N = this.deck.length;

    while (this.visibleCountries.length < 3 && this.countryPtr < N) {
      this.visibleCountries.push({
        country:  this.deck[this.countryPtr].country,
        pairIdx:  this.countryPtr,
      });
      this.countryPtr++;
    }

    while (this.visibleCapitals.length < 3 && this.capitalPtr < N) {
      this.visibleCapitals.push({
        capital: this.capitalQueue[this.capitalPtr].capital,
        pairIdx: (this.capitalPtr + 1) % N,
      });
      this.capitalPtr++;
    }
  }

  /**
   * Check whether `country` and `capital` form a valid pair.
   * Correct → removes both from visible arrays, fills slots, returns result.
   * Wrong   → increments wrongGuesses, returns result (caller ends game).
   */
  checkPair(country, capital) {
    const countryItem = this.visibleCountries.find(c => c.country === country);
    const capitalItem = this.visibleCapitals.find(c => c.capital === capital);

    if (!countryItem || !capitalItem) {
      return { correct: false };
    }

    if (countryItem.pairIdx === capitalItem.pairIdx) {
      this.visibleCountries = this.visibleCountries.filter(c => c.country !== country);
      this.visibleCapitals  = this.visibleCapitals.filter(c => c.capital !== capital);
      this.score++;
      this._fillSlots();
      const isDone = this.visibleCountries.length === 0 && this.visibleCapitals.length === 0;
      return { correct: true, isDone };
    } else {
      this.wrongGuesses++;
      return { correct: false };
    }
  }

  getVisibleCountries() {
    return this.visibleCountries.map(c => c.country);
  }

  getVisibleCapitals() {
    return this.visibleCapitals.map(c => c.capital);
  }

  getProgress() {
    return {
      score:     this.score,
      total:     this.totalPairs,
      remaining: this.totalPairs - this.score,
    };
  }

  /** Returns 0–100 (100 when no attempts yet). */
  getAccuracy() {
    const attempts = this.score + this.wrongGuesses;
    return attempts > 0 ? Math.round(this.score / attempts * 100) : 100;
  }

  getElapsedTime() {
    return this.startTime ? (Date.now() - this.startTime) / 1000 : 0;
  }
}
