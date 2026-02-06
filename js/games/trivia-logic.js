/**
 * Trivia Game - Pure Logic Module
 * 
 * Handles trivia game logic without any DOM dependencies.
 * Can be used by both standalone game and Daily Challenge.
 */

import { shuffleArray } from "../game-utils.js";

export class TriviaGameLogic {
  constructor({ onAnswer, onComplete, singleRound = false }) {
    this.questions = [];
    this.currentIndex = 0;
    this.score = 0;
    this.correctCount = 0;
    this.singleRound = singleRound;
    this.onAnswer = onAnswer; // Callback when user answers
    this.onComplete = onComplete; // Callback when game completes
    this.startTime = null;
  }

  async loadQuestions(dataUrl = 'data/qa.json') {
    try {
      const response = await fetch(dataUrl);
      const data = await response.json();
      const shuffled = shuffleArray(data);
      this.questions = this.singleRound ? shuffled.slice(0, 1) : shuffled.slice(0, 10);
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
      this.onComplete({
        score: this.score,
        total: this.questions.length,
        correctCount: this.correctCount,
        accuracy: this.getAccuracy()
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
    this.questions = shuffleArray(this.questions);
  }
}
