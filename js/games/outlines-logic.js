/**
 * Outlines Game - Pure Logic Module
 * 
 * Handles outlines game logic without any DOM/SVG dependencies.
 * Can be used by both standalone game and Daily Challenge.
 */

import { norm } from "../utils.js";
import { shuffleInPlace } from "../game-utils.js";

export class OutlinesGameLogic {
  constructor({ onAnswer, onComplete, onHintUsed, singleRound = false }) {
    this.DATA = window.DATA;
    this.maxRounds = singleRound ? 1 : 10;
    this.singleRound = singleRound;
    this.onAnswer = onAnswer;
    this.onComplete = onComplete;
    this.onHintUsed = onHintUsed; // Called when hint (neighbors) is shown
    
    this.deck = [];
    this.current = null;
    this.score = 0;
    this.correctFirstTry = 0;
    this.correctAny = 0;
    this.attempt = 0; // 0 = not started, 1 = first attempt, 2 = second attempt
    this.roundEnded = false;
    this.usedHint = false;
    this.startTime = null;
  }

  reset() {
    this.deck = shuffleInPlace([...this.DATA]).slice(0, this.maxRounds);
    this.current = null;
    this.score = 0;
    this.correctFirstTry = 0;
    this.correctAny = 0;
    this.attempt = 0;
    this.roundEnded = false;
    this.usedHint = false;
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
        this.onComplete({
          score: this.score,
          total: this.maxRounds,
          correctFirstTry: this.correctFirstTry,
          correctAny: this.correctAny,
          accuracy: this.getAccuracy()
        });
      }
      return null;
    }

    this.current = this.deck.pop();
    this.attempt = 0;
    this.roundEnded = false;
    this.startTime = Date.now();
    return this.current;
  }

  getCurrentCountry() {
    return this.current;
  }

  /**
   * Check if an answer is correct
   * Returns object with:
   * - isCorrect: boolean
   * - action: 'correct_first' | 'correct_second' | 'wrong_first' | 'wrong_second' | 'empty'
   * - points: number (2 for first try, 1 for second try)
   * - showNeighbors: boolean (true if should show neighbors after this attempt)
   * - message: string
   * - time: number (seconds elapsed)
   */
  checkAnswer(userAnswer) {
    if (this.roundEnded || this.attempt >= 2) {
      return { action: 'ignore' };
    }

    const trimmed = userAnswer.trim();
    this.attempt++;
    const timeTaken = (Date.now() - this.startTime) / 1000;

    // Empty answer is treated as skip/wrong
    if (!trimmed) {
      if (this.attempt === 1) {
        // First attempt - show neighbors as hint
        if (!this.usedHint && this.onHintUsed) {
          this.usedHint = true;
          this.onHintUsed();
        }
        return {
          action: 'empty',
          isCorrect: false,
          showNeighbors: true,
          message: "❌ Try again with neighbor hints!",
          time: timeTaken
        };
      } else {
        // Second attempt - end round
        this.roundEnded = true;
        const result = {
          action: 'wrong_second',
          isCorrect: false,
          showNeighbors: true,
          correctAnswer: this.current.country,
          message: `❌ Skipped. The answer was: ${this.current.country}`,
          time: timeTaken,
          usedHint: this.usedHint
        };
        
        if (this.onAnswer) {
          this.onAnswer(result);
        }
        
        return result;
      }
    }

    // Check answer (handle aliases)
    const normAnswer = norm(trimmed);
    const normCountry = norm(this.current.country);
    
    let searchName = trimmed;
    for (const [alias, official] of Object.entries(window.COUNTRY_ALIASES || {})) {
      if (norm(alias) === normAnswer) {
        searchName = official;
        break;
      }
    }

    const isCorrect = norm(searchName) === normCountry;

    if (isCorrect) {
      this.roundEnded = true;
      
      let points = 0;
      let action = '';
      let message = '';
      
      if (this.attempt === 1) {
        points = 2;
        action = 'correct_first';
        message = this.singleRound ? '✅ Correct!' : '✅ Correct! +2 points';
        this.score += 2;
        this.correctFirstTry++;
        this.correctAny++;
      } else {
        points = 1;
        action = 'correct_second';
        message = this.singleRound ? '✅ Correct!' : '✅ Correct! +1 point';
        this.score += 1;
        this.correctAny++;
      }
      
      const result = {
        action,
        isCorrect: true,
        points,
        message,
        correctAnswer: this.current.country,
        time: timeTaken,
        usedHint: this.usedHint,
        score: this.score
      };
      
      if (this.onAnswer) {
        this.onAnswer(result);
      }
      
      return result;
    } else {
      // Wrong answer
      if (this.attempt === 1) {
        // First wrong attempt - show neighbors
        if (!this.usedHint && this.onHintUsed) {
          this.usedHint = true;
          this.onHintUsed();
        }
        return {
          action: 'wrong_first',
          isCorrect: false,
          showNeighbors: true,
          message: "❌ Not quite. Try again with neighbor hints!",
          time: timeTaken
        };
      } else {
        // Second wrong attempt - end round
        this.roundEnded = true;
        const result = {
          action: 'wrong_second',
          isCorrect: false,
          showNeighbors: true,
          correctAnswer: this.current.country,
          message: `❌ Wrong. The answer was: ${this.current.country}`,
          time: timeTaken,
          usedHint: this.usedHint
        };
        
        if (this.onAnswer) {
          this.onAnswer(result);
        }
        
        return result;
      }
    }
  }

  handleTimeout() {
    if (this.roundEnded) {
      return null;
    }

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
      ? Math.round((this.correctAny / this.maxRounds) * 100) 
      : 0;
  }
}
