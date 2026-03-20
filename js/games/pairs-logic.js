/**
 * Pairs Game — Pure Logic Module
 *
 * Staggered-queue mechanic: two queues drawn from the same shuffled deck,
 * offset by 1. At any time exactly 2 of the 3 visible left-right pairs
 * are matchable; the third is a decoy on each side.
 *
 * Accepts a pre-built array of {left, right} pairs — the caller decides
 * what data to pair (capitals, peaks, flags, etc.).
 */

import { shuffleArray } from '../game-utils.js';

export class PairsLogic {
  constructor({ pairs, maxPairs }) {
    this.rawPairs = pairs;
    this.maxPairs = maxPairs;

    this.deck = [];          // [{left, right}] — the shuffled, sliced pool
    this.rightQueue = [];    // deck rotated left by 1
    this.leftPtr = 0;        // next index into deck to deal on the left
    this.rightPtr = 0;       // next index into rightQueue to deal on the right

    this.visibleLeft  = [];  // [{value, pairIdx}]
    this.visibleRight = [];  // [{value, pairIdx}]

    this.score        = 0;
    this.wrongGuesses = 0;
    this.totalPairs   = 0;
    this.startTime    = null;
  }

  reset() {
    const shuffled = shuffleArray([...this.rawPairs]);
    const limit = this.maxPairs === Infinity
      ? shuffled.length
      : Math.min(this.maxPairs, shuffled.length);

    this.deck        = shuffled.slice(0, limit);
    this.totalPairs  = this.deck.length;

    // Right queue: rotate deck left by 1 so deck[0]'s right goes last
    this.rightQueue = [...this.deck.slice(1), this.deck[0]];

    this.leftPtr        = 0;
    this.rightPtr       = 0;
    this.visibleLeft    = [];
    this.visibleRight   = [];
    this.score          = 0;
    this.wrongGuesses   = 0;
    this.startTime      = Date.now();

    this._fillSlots();
  }

  _fillSlots() {
    const N = this.deck.length;

    while (this.visibleLeft.length < 3 && this.leftPtr < N) {
      this.visibleLeft.push({
        value:    this.deck[this.leftPtr].left,
        pairIdx:  this.leftPtr,
      });
      this.leftPtr++;
    }

    while (this.visibleRight.length < 3 && this.rightPtr < N) {
      this.visibleRight.push({
        value:   this.rightQueue[this.rightPtr].right,
        pairIdx: (this.rightPtr + 1) % N,
      });
      this.rightPtr++;
    }
  }

  /**
   * Check whether `left` and `right` form a valid pair.
   * Correct → removes both from visible arrays, fills slots, returns result.
   * Wrong   → increments wrongGuesses, returns result (caller ends game).
   */
  checkPair(left, right) {
    const leftItem  = this.visibleLeft.find(c => c.value === left);
    const rightItem = this.visibleRight.find(c => c.value === right);

    if (!leftItem || !rightItem) {
      return { correct: false };
    }

    if (leftItem.pairIdx === rightItem.pairIdx) {
      this.visibleLeft  = this.visibleLeft.filter(c => c.value !== left);
      this.visibleRight = this.visibleRight.filter(c => c.value !== right);
      this.score++;
      this._fillSlots();
      const isDone = this.visibleLeft.length === 0 && this.visibleRight.length === 0;
      return { correct: true, isDone };
    } else {
      this.wrongGuesses++;
      return { correct: false };
    }
  }

  getVisibleLeft() {
    return this.visibleLeft.map(c => c.value);
  }

  getVisibleRight() {
    return this.visibleRight.map(c => c.value);
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
