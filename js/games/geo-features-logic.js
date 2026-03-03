/**
 * GeoFeaturesGameLogic — shared pure logic for Rivers and Mountains games.
 *
 * Features are geographic items (rivers, mountain ranges) that cross multiple
 * countries. Players toggle-select countries on the map then submit.
 *
 * Usage:
 *   const logic = new GeoFeaturesGameLogic({ features, maxRounds });
 *   logic.reset();
 *   const feature = logic.nextRound(); // { name, countries, hint, path }
 *   logic.toggleCountry('France');     // → 'added' | 'removed'
 *   const hint = logic.useHint();
 *   const result = logic.submitAnswer(); // { correct, wrong, missed, pointsThisRound, time }
 */
export class GeoFeaturesGameLogic {
  /**
   * @param {Object} config
   * @param {Array}  config.features   - Array of feature objects from JSON
   * @param {number} [config.maxRounds=Infinity] - How many rounds to play
   */
  constructor({ features, maxRounds = Infinity, pickOne = false }) {
    this.allFeatures = features;
    this.maxRounds = maxRounds;
    this.pickOne = pickOne;

    this.deck = [];
    this.current = null;
    this.selectedCountries = new Set();
    this.hintUsed = false;
    this.score = 0;
    this.totalPossible = 0;
    this.roundIndex = -1;
    this.roundCount = 0;
    this.startTime = null;
    this.gameStartTime = null;
  }

  /** Shuffle and slice the deck to maxRounds, reset all state. */
  reset() {
    const shuffled = [...this.allFeatures].sort(() => Math.random() - 0.5);
    const count = this.maxRounds === Infinity
      ? shuffled.length
      : Math.min(this.maxRounds, shuffled.length);
    this.deck = shuffled.slice(0, count);
    this.roundCount = this.deck.length;
    this.roundIndex = -1;
    this.score = 0;
    this.totalPossible = 0;
    this.current = null;
    this.selectedCountries = new Set();
    this.hintUsed = false;
    this.gameStartTime = Date.now();
  }

  /**
   * Advance to the next feature.
   * @returns {Object|null} feature object, or null if deck is exhausted
   */
  nextRound() {
    this.roundIndex++;
    if (this.roundIndex >= this.deck.length) return null;
    this.current = this.deck[this.roundIndex];
    this.selectedCountries = new Set();
    this.hintUsed = false;
    this.startTime = Date.now();
    return this.current;
  }

  /**
   * Toggle a country's selection state.
   * @param {string} name - DATA country name
   * @returns {'added'|'removed'}
   */
  toggleCountry(name) {
    if (this.selectedCountries.has(name)) {
      this.selectedCountries.delete(name);
      return 'removed';
    }
    if (this.pickOne) {
      this.selectedCountries.clear();
    }
    this.selectedCountries.add(name);
    return 'added';
  }

  /**
   * Reveal the hint (costs 1 point if not already revealed).
   * @returns {string} hint text
   */
  useHint() {
    this.hintUsed = true;
    return this.current ? this.current.hint : '';
  }

  /**
   * Score the current round.
   * pointsThisRound = max(0, correct.size - wrong.size - hintPenalty)
   * @returns {{ correct: Set, wrong: Set, missed: Set, pointsThisRound: number, time: number }}
   */
  submitAnswer() {
    if (!this.current) return null;

    const correctSet = new Set(this.current.countries);
    const selected = this.selectedCountries;

    const correct = new Set([...selected].filter(c => correctSet.has(c)));
    const wrong   = new Set([...selected].filter(c => !correctSet.has(c)));
    const missed  = new Set([...correctSet].filter(c => !selected.has(c)));

    const hintPenalty = this.hintUsed ? 1 : 0;
    const pointsThisRound = this.pickOne
      ? Math.max(0, (correct.size > 0 && wrong.size === 0 ? 2 : 0) - hintPenalty)
      : Math.max(0, correct.size - wrong.size - hintPenalty);

    this.score += pointsThisRound;
    this.totalPossible += this.pickOne ? 2 : correctSet.size;

    const time = this.startTime ? (Date.now() - this.startTime) / 1000 : 0;
    return { correct, wrong, missed, pointsThisRound, time };
  }

  /** True when we are on the last round (so the next button should say "Finish"). */
  isComplete() {
    return this.roundIndex >= this.deck.length - 1;
  }

  /** Total elapsed seconds since the game started. */
  getTotalTime() {
    return this.gameStartTime ? (Date.now() - this.gameStartTime) / 1000 : 0;
  }

  /** @returns {{ current: number, total: number, score: number, totalPossible: number }} */
  getProgress() {
    return {
      current: this.roundIndex + 1,
      total: this.roundCount,
      score: this.score,
      totalPossible: this.totalPossible,
    };
  }
}
