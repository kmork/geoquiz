/**
 * Country Duel Game - Pure Logic Module
 *
 * Survival mechanic: two countries shown, pick the correct one.
 * Play until you get one wrong; score = streak length.
 */

import { shuffleArray } from '../game-utils.js';

function formatPopulation(n) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} billion`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} million`;
  return n.toLocaleString('en-US');
}

function formatArea(n) {
  return n.toLocaleString('en-US');
}

const QUESTION_TYPES = [
  'area', 'population', 'landlocked', 'neighbors_count',
  'borders', 'continent', 'capital', 'highest_peak', 'equator'
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

    if (a.highestPeak && b.highestPeak && a.highestPeak.elev !== b.highestPeak.elev) {
      types.push('highest_peak');
    }

    // equator: both must have closestLat, different distances, and not both on equator
    if (a.closestLat != null && b.closestLat != null
        && Math.abs(a.closestLat) !== Math.abs(b.closestLat)
        && !(Math.abs(a.closestLat) < 1 && Math.abs(b.closestLat) < 1)) {
      types.push('equator');
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
    const late = ['borders', 'capital', 'landlocked', 'neighbors_count', 'continent', 'highest_peak', 'equator'];

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
      case 'highest_peak': {
        const higher = Math.random() < 0.5;
        if (higher) {
          questionText = 'Which country has a higher peak?';
          correctAnswer = a.highestPeak.elev > b.highestPeak.elev ? 'A' : 'B';
        } else {
          questionText = 'Which country has a lower highest point?';
          correctAnswer = a.highestPeak.elev < b.highestPeak.elev ? 'A' : 'B';
        }
        break;
      }
      case 'equator': {
        const closer = Math.random() < 0.5;
        if (closer) {
          questionText = 'Which country is closer to the equator?';
          correctAnswer = Math.abs(a.closestLat) < Math.abs(b.closestLat) ? 'A' : 'B';
        } else {
          questionText = 'Which country is farther from the equator?';
          correctAnswer = Math.abs(a.closestLat) > Math.abs(b.closestLat) ? 'A' : 'B';
        }
        break;
      }
    }

    return { countryA: a, countryB: b, questionText, correctAnswer, questionType: type };
  }

  getExplanation(q) {
    if (!q) return '';
    const a = q.countryA, b = q.countryB;
    const correct = q.correctAnswer === 'A' ? a : b;
    const other = q.correctAnswer === 'A' ? b : a;

    switch (q.questionType) {
      case 'area':
        return `${correct.country} covers ${formatArea(correct.area)} km², while ${other.country} covers ${formatArea(other.area)} km².`;
      case 'population':
        return `${correct.country} has ${formatPopulation(correct.population)} people, while ${other.country} has ${formatPopulation(other.population)}.`;
      case 'landlocked': {
        const ll = a.landlocked ? a : b;
        const coast = a.landlocked ? b : a;
        return `${ll.country} is landlocked — ${coast.country} has a coastline!`;
      }
      case 'neighbors_count': {
        const aN = (a.neighbors || []).length;
        const bN = (b.neighbors || []).length;
        return `${a.country} borders ${aN} countries, while ${b.country} borders ${bN}.`;
      }
      case 'borders': {
        const neighbor = q.questionText.match(/borders (.+)\?/)?.[1] || '';
        return `${correct.country}'s neighbors include ${neighbor}!`;
      }
      case 'continent':
        return `${correct.country} is in ${correct.continent}, while ${other.country} is in ${other.continent}.`;
      case 'capital': {
        const cap = q.questionText.match(/capital is (.+)\?/)?.[1] || correct.capitals[0];
        return `${cap} is the capital of ${correct.country}!`;
      }
      case 'highest_peak':
        return `${a.country}'s highest point is ${a.highestPeak.name} (${a.highestPeak.elev.toLocaleString()} m), while ${b.country}'s is ${b.highestPeak.name} (${b.highestPeak.elev.toLocaleString()} m).`;
      case 'equator': {
        const fmtLat = (lat) => Math.abs(lat) < 1 ? 'on the equator' : `${Math.abs(lat).toFixed(1)}° from the equator`;
        return `${a.country} reaches ${fmtLat(a.closestLat)}, while ${b.country} reaches ${fmtLat(b.closestLat)}.`;
      }
      default:
        return '';
    }
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
