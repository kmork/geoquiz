/**
 * Picture Guess Game - Pure Logic Module
 * 
 * Handles picture guess game logic without any DOM dependencies.
 * Can be used by both standalone game and Daily Challenge.
 */

import { norm } from "../utils.js";
import { shuffleArray } from "../game-utils.js";

export class PictureGuessGameLogic {
  constructor({ onAnswer, onComplete, singleRound = false }) {
    this.maxRounds = singleRound ? 1 : 10;
    this.singleRound = singleRound;
    this.onAnswer = onAnswer;
    this.onComplete = onComplete;
    
    this.sites = [];
    this.currentIndex = 0;
    this.currentSite = null;
    this.score = 0;
    this.perfectGuesses = 0;
    this.totalCorrect = 0;
    this.usedHint = false;
    this.roundEnded = false;
    this.startTime = null;
    this.gameStartTime = null; // Track overall game start time
  }

  async loadSites() {
    try {
      const response = await fetch("data/heritage-sites.json");
      const data = await response.json();
      const shuffled = shuffleArray(data);
      this.sites = shuffled.slice(0, this.maxRounds);
      return true;
    } catch (err) {
      console.error("Failed to load heritage sites:", err);
      return false;
    }
  }

  setSite(site) {
    this.sites = [site];
    this.usedHint = false;
  }

  hasMoreRounds() {
    return this.currentIndex < this.sites.length;
  }

  nextRound() {
    if (this.currentIndex >= this.sites.length) {
      if (this.onComplete) {
        const totalTime = this.gameStartTime ? (Date.now() - this.gameStartTime) / 1000 : 0;
        this.onComplete({
          score: this.score,
          total: this.sites.length,
          perfectGuesses: this.perfectGuesses,
          totalCorrect: this.totalCorrect,
          accuracy: this.getAccuracy(),
          time: totalTime
        });
      }
      return null;
    }

    this.currentSite = this.sites[this.currentIndex];
    this.currentIndex++;
    this.roundEnded = false;
    this.startTime = Date.now();
    
    // Track game start time on first round
    if (!this.gameStartTime) {
      this.gameStartTime = Date.now();
    }
    
    return this.currentSite;
  }

  getCurrentSite() {
    return this.currentSite;
  }

  useHint() {
    this.usedHint = true;
  }

  /**
   * Check if an answer is correct
   * Returns object with:
   * - isCorrect: boolean
   * - correctAnswer: string
   * - message: string
   * - time: number
   * - usedHint: boolean
   */
  checkAnswer(userAnswer) {
    if (this.roundEnded || !this.currentSite) {
      return { action: 'ignore' };
    }

    const trimmed = userAnswer.trim();
    const timeTaken = (Date.now() - this.startTime) / 1000;
    
    if (!trimmed) {
      return {
        action: 'empty',
        isCorrect: false,
        message: "Please enter an answer"
      };
    }

    // Normalize answer and check against country (with alias support)
    const normAnswer = window.normalizeCountryName ? window.normalizeCountryName(trimmed) : norm(trimmed);
    const normCountry = window.normalizeCountryName ? window.normalizeCountryName(this.currentSite.country) : norm(this.currentSite.country);
    const isCorrect = normAnswer === normCountry;

    this.roundEnded = true;

    if (isCorrect) {
      this.score++;
      this.totalCorrect++;
      if (!this.usedHint) {
        this.perfectGuesses++;
      }

      const result = {
        action: 'correct',
        isCorrect: true,
        correctAnswer: this.currentSite.country,
        siteName: this.currentSite.siteName,
        message: `✅ Correct! This is ${this.currentSite.siteName} in ${this.currentSite.country}`,
        time: timeTaken,
        usedHint: this.usedHint,
        score: this.score
      };

      if (this.onAnswer) {
        this.onAnswer(result);
      }

      return result;
    } else {
      const result = {
        action: 'wrong',
        isCorrect: false,
        correctAnswer: this.currentSite.country,
        siteName: this.currentSite.siteName,
        message: `❌ Wrong. This is ${this.currentSite.siteName} in ${this.currentSite.country}`,
        time: timeTaken,
        usedHint: this.usedHint,
        score: this.score
      };

      if (this.onAnswer) {
        this.onAnswer(result);
      }

      return result;
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
      correctAnswer: this.currentSite.country,
      siteName: this.currentSite.siteName,
      message: `⏱️ Time's up! This is ${this.currentSite.siteName} in ${this.currentSite.country}`,
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
      current: this.currentIndex,
      total: this.sites.length,
      score: this.score
    };
  }

  getAccuracy() {
    return this.sites.length > 0 
      ? Math.round((this.totalCorrect / this.sites.length) * 100) 
      : 0;
  }

  reset() {
    this.sites = shuffleArray(this.sites);
    this.currentIndex = 0;
    this.currentSite = null;
    this.score = 0;
    this.perfectGuesses = 0;
    this.totalCorrect = 0;
    this.usedHint = false;
    this.roundEnded = false;
  }
}
