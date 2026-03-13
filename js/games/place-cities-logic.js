/**
 * Place the Cities — Pure game logic (no DOM access)
 *
 * Each round: given a country, the player sees dots for the capital + cities
 * and must drag city name labels to the correct dots.
 */

import { norm } from '../utils.js';

export class PlaceCitiesLogic {
  constructor({ countries, maxRounds = 10 }) {
    // Only countries that have a cities array with at least 1 city
    this.pool = countries.filter(c => c.cities && c.cities.length > 0);
    this.maxRounds = maxRounds === Infinity ? this.pool.length : Math.min(maxRounds, this.pool.length);
    this.capitalCoords = {};  // country name -> {lat, lon}
    this.reset();
  }

  /**
   * Build capital coordinate lookup from places.geojson features.
   * Must be called before nextRound().
   */
  loadCapitalCoords(placesFeatures) {
    // Build lookup from ADM0NAME -> first ADM0CAP=1 feature coords
    const byAdm0 = {};
    for (const f of placesFeatures) {
      const p = f.properties;
      if (p.ADM0CAP === 1 && !byAdm0[p.ADM0NAME]) {
        const [lon, lat] = f.geometry.coordinates;
        byAdm0[p.ADM0NAME] = { lat, lon };
      }
    }

    // Match to our pool countries by normalized name
    for (const c of this.pool) {
      const capital = c.capitals[0];
      // Try direct match on country name
      const coords = byAdm0[c.country]
        || Object.entries(byAdm0).find(([k]) => norm(k) === norm(c.country))?.[1];
      if (coords) {
        this.capitalCoords[c.country] = { name: capital, ...coords };
      }
    }
  }

  reset() {
    this.remaining = [...this.pool].sort(() => Math.random() - 0.5);
    this.roundIndex = 0;
    this.totalScore = 0;
    this.totalPlaces = 0;
    this.startTime = Date.now();
  }

  /** Returns null when game is over */
  nextRound() {
    if (this.roundIndex >= this.maxRounds || this.remaining.length === 0) return null;

    const country = this.remaining[this.roundIndex];
    this.roundIndex++;

    // Build places array: capital + cities
    const places = [];
    const capCoords = this.capitalCoords[country.country];
    if (capCoords) {
      places.push({ name: capCoords.name, lat: capCoords.lat, lon: capCoords.lon, isCapital: true });
    }
    for (const city of country.cities) {
      places.push({ name: city.name, lat: city.lat, lon: city.lon, isCapital: false });
    }

    return {
      countryName: country.country,
      places,
    };
  }

  /**
   * Check player's placements.
   * @param {Array<{dotIndex: number, placeName: string}>} assignments
   *   dotIndex corresponds to the places array index
   * @param {Array} places - the places array from nextRound()
   * @returns {{correct: number, total: number, results: Array<{name: string, correct: boolean}>}}
   */
  checkPlacements(assignments, places) {
    let correct = 0;
    const results = places.map((place, i) => {
      const assignment = assignments.find(a => a.dotIndex === i);
      const isCorrect = assignment && assignment.placeName === place.name;
      if (isCorrect) correct++;
      return { name: place.name, correct: isCorrect, assignedName: assignment?.placeName || null };
    });

    this.totalScore += correct;
    this.totalPlaces += places.length;

    return { correct, total: places.length, results };
  }

  getProgress() {
    return { current: this.roundIndex, total: this.maxRounds };
  }

  getAccuracy() {
    return this.totalPlaces > 0 ? Math.round((this.totalScore / this.totalPlaces) * 100) : 0;
  }

  getElapsedSeconds() {
    return (Date.now() - this.startTime) / 1000;
  }
}
