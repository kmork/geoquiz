/**
 * Capitals Game - Pure Logic Module
 * 
 * Handles capitals quiz game logic without any DOM dependencies.
 * Can be used by both standalone game and Daily Challenge.
 */

import { shuffleArray } from "../game-utils.js";

export class CapitalsGameLogic {
  constructor({ onAnswer, onComplete, singleRound = false, data = null }) {
    this.DATA = data || window.DATA;
    this.maxRounds = singleRound ? 1 : 10;
    this.singleRound = singleRound;
    this.onAnswer = onAnswer;
    this.onComplete = onComplete;
    
    this.deck = [];
    this.current = null;
    this.score = 0;
    this.correctCount = 0;
    this.roundEnded = false;
    this.startTime = null;
  }

  reset() {
    // Filter countries that have capitals
    const countriesWithCapitals = this.DATA.filter(c => {
      const capital = c.capitals ? c.capitals[0] : c.capital;
      return capital && capital.length > 0;
    });
    
    this.deck = shuffleArray(countriesWithCapitals).slice(0, this.maxRounds);
    this.current = null;
    this.score = 0;
    this.correctCount = 0;
    this.roundEnded = false;
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
        this.onComplete({
          score: this.score,
          total: this.maxRounds,
          correctCount: this.correctCount,
          accuracy: this.getAccuracy()
        });
      }
      return null;
    }

    this.current = this.deck.pop();
    this.roundEnded = false;
    this.startTime = Date.now();
    return this.current;
  }

  getCurrentCountry() {
    return this.current;
  }

  getCorrectCapital() {
    if (!this.current) return null;
    return this.current.capitals ? this.current.capitals[0] : this.current.capital;
  }

  /**
   * Generate wrong answer options (geographically close capitals)
   * Returns array of 3 wrong capitals
   */
  generateWrongAnswers(rng = null) {
    const correctCapital = this.getCorrectCapital();
    
    // Get capitals from same region
    const sameRegion = this.DATA.filter(c => {
      const capital = c.capitals ? c.capitals[0] : c.capital;
      return c.region === this.current.region && 
        capital && 
        capital !== correctCapital;
    });
    
    const wrongAnswers = [];
    
    // Use provided RNG or default shuffle
    const shuffle = rng ? (arr) => rng.shuffle(arr) : shuffleArray;
    const shuffled = shuffle([...sameRegion]);
    
    // Take up to 3 from same region
    for (let i = 0; i < Math.min(3, shuffled.length); i++) {
      const capital = shuffled[i].capitals ? shuffled[i].capitals[0] : shuffled[i].capital;
      wrongAnswers.push(capital);
    }
    
    // Fill remaining with random capitals if needed
    while (wrongAnswers.length < 3) {
      const allOthers = this.DATA.filter(c => {
        const capital = c.capitals ? c.capitals[0] : c.capital;
        return capital && capital !== correctCapital && !wrongAnswers.includes(capital);
      });
      
      if (allOthers.length === 0) break;
      
      const random = shuffle([...allOthers])[0];
      const capital = random.capitals ? random.capitals[0] : random.capital;
      wrongAnswers.push(capital);
    }
    
    return wrongAnswers.slice(0, 3);
  }

  /**
   * Check if selected capital is correct
   * Returns result object
   */
  checkAnswer(selectedCapital) {
    if (this.roundEnded || !this.current) {
      return { action: 'ignore' };
    }

    const correctCapital = this.getCorrectCapital();
    const isCorrect = selectedCapital === correctCapital;
    const timeTaken = (Date.now() - this.startTime) / 1000;
    
    this.roundEnded = true;

    if (isCorrect) {
      this.score++;
      this.correctCount++;
    }

    const result = {
      action: isCorrect ? 'correct' : 'wrong',
      isCorrect,
      selectedCapital,
      correctCapital,
      country: this.current.country,
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
    const correctCapital = this.getCorrectCapital();

    const result = {
      action: 'timeout',
      isCorrect: false,
      correctCapital,
      country: this.current.country,
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
