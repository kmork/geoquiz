/**
 * Spelling Game - Pure Logic Module
 *
 * Handles word unscrambling game logic without any DOM dependencies.
 */

import { shuffleArray } from '../game-utils.js';

export class SpellingGameLogic {
  constructor({ data, mode = 'countries', maxRounds = 10 }) {
    this.rawData = data;
    this.mode = mode;
    this.maxRounds = maxRounds;

    this.words = [];
    this.deck = [];
    this.current = null;
    this.score = 0;
    this.correctCount = 0;
    this.roundNum = 0;
    this.firstTry = true;
    this.gameStartTime = null;
  }

  loadData() {
    const data = this.rawData || window.DATA;

    if (this.mode === 'countries') {
      this.words = data
        .filter(c => this._letterCount(c.country) >= 5)
        .map(c => ({ name: c.country, hint: c.flagCode, hintType: 'flag' }));
    } else {
      // Cities mode: capitals + cities
      const cities = [];
      for (const c of data) {
        if (c.capitals) {
          for (const cap of c.capitals) {
            if (this._letterCount(cap) >= 5) {
              cities.push({ name: cap, hint: c.country, hintType: 'country' });
            }
          }
        }
        if (c.cities) {
          for (const city of c.cities) {
            if (this._letterCount(city.name) >= 5) {
              cities.push({ name: city.name, hint: c.country, hintType: 'country' });
            }
          }
        }
      }
      // Deduplicate by name
      const seen = new Set();
      this.words = cities.filter(c => {
        if (seen.has(c.name)) return false;
        seen.add(c.name);
        return true;
      });
    }
  }

  _letterCount(name) {
    return name.replace(/[\s\-'\.]/g, '').length;
  }

  reset() {
    const actualMax = this.maxRounds === Infinity ? this.words.length : Math.min(this.maxRounds, this.words.length);
    this.maxRounds = actualMax;
    this.deck = shuffleArray([...this.words]).slice(0, actualMax);
    this.current = null;
    this.score = 0;
    this.correctCount = 0;
    this.roundNum = 0;
    this.firstTry = true;
    this.gameStartTime = Date.now();
  }

  scrambleName(name) {
    const chars = [];
    const letterIndices = [];

    for (let i = 0; i < name.length; i++) {
      const ch = name[i];
      if (ch === ' ' || ch === '-' || ch === "'" || ch === '.') {
        chars.push({ char: ch, isFixed: true });
      } else {
        chars.push({ char: ch, isFixed: false });
        letterIndices.push(i);
      }
    }

    // Shuffle letter positions until different from original
    const letters = letterIndices.map(i => chars[i].char);
    let shuffled;
    let attempts = 0;
    do {
      shuffled = shuffleArray([...letters]);
      attempts++;
    } while (shuffled.join('') === letters.join('') && attempts < 50 && letters.length > 1);

    // Place shuffled letters back
    const result = [...chars];
    letterIndices.forEach((idx, i) => {
      result[idx] = { char: shuffled[i], isFixed: false };
    });

    return result;
  }

  nextRound() {
    if (this.deck.length === 0) return null;

    this.current = this.deck.pop();
    this.roundNum++;
    this.firstTry = true;

    const scrambled = this.scrambleName(this.current.name);

    return {
      name: this.current.name,
      scrambled,
      hint: this.current.hint,
      hintType: this.current.hintType,
      roundNum: this.roundNum,
      total: this.maxRounds
    };
  }

  checkAnswer(arranged) {
    if (!this.current) return { isCorrect: false };

    const normalize = s => s.toLowerCase().replace(/[\s\-'\.]/g, '');
    const isCorrect = normalize(arranged) === normalize(this.current.name);

    if (isCorrect) {
      this.correctCount++;
      if (this.firstTry) {
        this.score++;
      }
    } else {
      this.firstTry = false;
    }

    return { isCorrect };
  }

  getProgress() {
    return {
      current: this.roundNum,
      total: this.maxRounds,
      score: this.score
    };
  }

  getAccuracy() {
    return this.roundNum > 0 ? Math.round((this.correctCount / this.roundNum) * 100) : 0;
  }

  getElapsedTime() {
    return this.gameStartTime ? (Date.now() - this.gameStartTime) / 1000 : 0;
  }
}
