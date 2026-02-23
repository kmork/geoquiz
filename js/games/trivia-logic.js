/**
 * Trivia Game - Pure Logic Module
 *
 * Handles trivia game logic without any DOM dependencies.
 * Can be used by both standalone game and Daily Challenge.
 */

import { shuffleArray } from "../game-utils.js";

export class TriviaGameLogic {
  constructor({ onAnswer, onComplete, singleRound = false, maxCount = 10 }) {
    this.questions = [];
    this.currentIndex = 0;
    this.score = 0;
    this.correctCount = 0;
    this.singleRound = singleRound;
    this._configMaxCount = singleRound ? 1 : maxCount;
    this.onAnswer = onAnswer; // Callback when user answers
    this.onComplete = onComplete; // Callback when game completes
    this.startTime = null;
    this.gameStartTime = null;
  }

  async loadQuestions(dataUrl = 'data/trivia.json') {
    try {
      const response = await fetch(dataUrl);
      const data = await response.json();
      const shuffled = shuffleArray(data);
      this.questions = shuffled.slice(0, this._configMaxCount);
      return true;
    } catch (err) {
      console.error("Failed to load questions:", err);
      return false;
    }
  }

  setQuestions(questions) {
    this.questions = questions;
  }

  getCurrentQuestion() {
    return this.questions[this.currentIndex];
  }

  getShuffledOptions() {
    const q = this.getCurrentQuestion();
    return shuffleArray([...q.options]);
  }

  getCorrectAnswer() {
    const q = this.getCurrentQuestion();
    return q.options[q.answer];
  }

  startQuestion() {
    this.startTime = Date.now();
    if (!this.gameStartTime) {
      this.gameStartTime = Date.now();
    }
  }

  submitAnswer(selectedOption) {
    const q = this.getCurrentQuestion();
    const correctAnswer = this.getCorrectAnswer();
    const isCorrect = selectedOption ? (selectedOption === correctAnswer) : false;
    const timeTaken = (Date.now() - this.startTime) / 1000;

    if (isCorrect) {
      this.score++;
      this.correctCount++;
    }

    const result = {
      correct: isCorrect,
      correctAnswer,
      selectedOption,
      explanation: q.explanation,
      time: timeTaken,
      question: q
    };

    // Notify answer callback
    if (this.onAnswer) {
      this.onAnswer(result);
    }

    // Check if game is complete
    const isLastQuestion = this.currentIndex >= this.questions.length - 1;

    if (isLastQuestion && this.onComplete) {
      const totalTime = this.gameStartTime ? (Date.now() - this.gameStartTime) / 1000 : 0;
      this.onComplete({
        score: this.score,
        total: this.questions.length,
        correctCount: this.correctCount,
        accuracy: this.getAccuracy(),
        time: totalTime
      });
    }

    return {
      ...result,
      isLastQuestion
    };
  }

  handleTimeout() {
    return this.submitAnswer(null); // null = no answer selected
  }

  advance() {
    this.currentIndex++;
    return this.hasMoreQuestions();
  }

  hasMoreQuestions() {
    return this.currentIndex < this.questions.length;
  }

  getAccuracy() {
    return this.questions.length > 0
      ? Math.round((this.correctCount / this.questions.length) * 100)
      : 0;
  }

  getProgress() {
    return {
      current: this.currentIndex + 1,
      total: this.questions.length,
      score: this.score
    };
  }

  reset() {
    this.currentIndex = 0;
    this.score = 0;
    this.correctCount = 0;
    this.gameStartTime = null;
    this.questions = shuffleArray(this.questions);
  }
}
