/**
 * Country Duel Game - Pure Logic Module
 *
 * Survival mechanic: two countries shown, pick the correct one.
 * Play until you get one wrong; score = streak length.
 */

import { shuffleArray } from '../game-utils.js';

const QUESTION_TYPES = [
  'area', 'population', 'landlocked', 'neighbors_count',
  'borders', 'continent', 'capital'
];

export class DuelGameLogic {
  constructor({ data, onAnswer, onGameOver, continentFiltered = false }) {
    this.countries = data || window.DATA;
    this.continentFiltered = continentFiltered;
    this.onAnswer = onAnswer;
    this.onGameOver = onGameOver;

    this.usedPairs = new Set();
    this.streak = 0;
    this.currentQuestion = null;
    this.gameStartTime = null;
  }

  reset() {
    this.usedPairs.clear();
    this.streak = 0;
    this.currentQuestion = null;
    this.gameStartTime = Date.now();
  }

  getElapsedTime() {
    return this.gameStartTime ? (Date.now() - this.gameStartTime) / 1000 : 0;
  }

  _pairKey(a, b) {
    return [a, b].sort().join('|');
  }

  _pickPair() {
    const pool = this.countries;
    if (pool.length < 2) return null;

    const maxPairs = (pool.length * (pool.length - 1)) / 2;
    if (this.usedPairs.size >= maxPairs) this.usedPairs.clear();

    for (let attempts = 0; attempts < 100; attempts++) {
      const shuffled = shuffleArray([...pool]);
      const a = shuffled[0];
      const b = shuffled[1];
      const key = this._pairKey(a.country, b.country);
      if (!this.usedPairs.has(key)) {
        this.usedPairs.add(key);
        return [a, b];
      }
    }

    // Fallback
    this.usedPairs.clear();
    const shuffled = shuffleArray([...pool]);
    return [shuffled[0], shuffled[1]];
  }

  _getEligibleTypes(a, b) {
    const types = [];

    if (a.area != null && b.area != null && a.area !== b.area) {
      types.push('area');
    }
    if (a.population != null && b.population != null && a.population !== b.population) {
      types.push('population');
    }
    if ((a.landlocked === true) !== (b.landlocked === true) &&
        (a.landlocked === true || b.landlocked === true)) {
      types.push('landlocked');
    }
    const aNeighbors = (a.neighbors || []).length;
    const bNeighbors = (b.neighbors || []).length;
    if (aNeighbors !== bNeighbors) {
      types.push('neighbors_count');
    }

    // borders: one has a neighbor the other doesn't share
    const aSet = new Set(a.neighbors || []);
    const bSet = new Set(b.neighbors || []);
    const aOnly = [...aSet].filter(n => !bSet.has(n) && n !== b.country);
    const bOnly = [...bSet].filter(n => !aSet.has(n) && n !== a.country);
    if (aOnly.length > 0 || bOnly.length > 0) {
      types.push('borders');
    }

    if (!this.continentFiltered && a.continent !== b.continent) {
      types.push('continent');
    }

    // capital is always eligible
    types.push('capital');

    return types;
  }

  _generateQuestion(a, b) {
    const eligible = this._getEligibleTypes(a, b);
    if (eligible.length === 0) return null;

    // Weight: early streak favors area/population; later favors borders/capital/landlocked
    const early = ['area', 'population'];
    const late = ['borders', 'capital', 'landlocked', 'neighbors_count', 'continent'];

    let weighted = [...eligible];
    if (this.streak < 5) {
      // Add extra copies of early types
      weighted.push(...eligible.filter(t => early.includes(t)));
    } else {
      // Add extra copies of late types
      weighted.push(...eligible.filter(t => late.includes(t)));
    }

    const type = weighted[Math.floor(Math.random() * weighted.length)];
    return this._buildQuestion(type, a, b);
  }

  _buildQuestion(type, a, b) {
    let questionText, correctAnswer;

    switch (type) {
      case 'area': {
        const bigger = Math.random() < 0.5;
        if (bigger) {
          questionText = 'Which country is larger by area?';
          correctAnswer = a.area > b.area ? 'A' : 'B';
        } else {
          questionText = 'Which country is smaller by area?';
          correctAnswer = a.area < b.area ? 'A' : 'B';
        }
        break;
      }
      case 'population': {
        const more = Math.random() < 0.5;
        if (more) {
          questionText = 'Which country has more people?';
          correctAnswer = a.population > b.population ? 'A' : 'B';
        } else {
          questionText = 'Which country has fewer people?';
          correctAnswer = a.population < b.population ? 'A' : 'B';
        }
        break;
      }
      case 'landlocked': {
        questionText = 'Which country is landlocked?';
        correctAnswer = a.landlocked ? 'A' : 'B';
        break;
      }
      case 'neighbors_count': {
        const more = Math.random() < 0.5;
        const aN = (a.neighbors || []).length;
        const bN = (b.neighbors || []).length;
        if (more) {
          questionText = 'Which country borders more countries?';
          correctAnswer = aN > bN ? 'A' : 'B';
        } else {
          questionText = 'Which country borders fewer countries?';
          correctAnswer = aN < bN ? 'A' : 'B';
        }
        break;
      }
      case 'borders': {
        const aSet = new Set(a.neighbors || []);
        const bSet = new Set(b.neighbors || []);
        const aOnly = [...aSet].filter(n => !bSet.has(n) && n !== b.country);
        const bOnly = [...bSet].filter(n => !aSet.has(n) && n !== a.country);

        if (aOnly.length > 0 && (bOnly.length === 0 || Math.random() < 0.5)) {
          const neighbor = aOnly[Math.floor(Math.random() * aOnly.length)];
          questionText = `Which country borders ${neighbor}?`;
          correctAnswer = 'A';
        } else {
          const neighbor = bOnly[Math.floor(Math.random() * bOnly.length)];
          questionText = `Which country borders ${neighbor}?`;
          correctAnswer = 'B';
        }
        break;
      }
      case 'continent': {
        const pickA = Math.random() < 0.5;
        if (pickA) {
          questionText = `Which country is in ${a.continent}?`;
          correctAnswer = 'A';
        } else {
          questionText = `Which country is in ${b.continent}?`;
          correctAnswer = 'B';
        }
        break;
      }
      case 'capital': {
        const pickA = Math.random() < 0.5;
        if (pickA) {
          const cap = a.capitals[Math.floor(Math.random() * a.capitals.length)];
          questionText = `Which country's capital is ${cap}?`;
          correctAnswer = 'A';
        } else {
          const cap = b.capitals[Math.floor(Math.random() * b.capitals.length)];
          questionText = `Which country's capital is ${cap}?`;
          correctAnswer = 'B';
        }
        break;
      }
    }

    return { countryA: a, countryB: b, questionText, correctAnswer, questionType: type };
  }

  nextRound() {
    const pair = this._pickPair();
    if (!pair) return null;

    const [a, b] = pair;
    this.currentQuestion = this._generateQuestion(a, b);
    return this.currentQuestion;
  }

  checkAnswer(choice) {
    if (!this.currentQuestion) return null;

    const isCorrect = choice === this.currentQuestion.correctAnswer;

    if (isCorrect) {
      this.streak++;
      if (this.onAnswer) this.onAnswer({ isCorrect, streak: this.streak, question: this.currentQuestion });
      return { isCorrect, streak: this.streak };
    } else {
      if (this.onGameOver) this.onGameOver({ streak: this.streak, question: this.currentQuestion });
      return { isCorrect, streak: this.streak };
    }
  }
}
