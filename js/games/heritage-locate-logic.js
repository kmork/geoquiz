/**
 * Heritage Locate — Pure game logic (no DOM).
 *
 * Player sees a heritage site photo, clicks on a world map to guess
 * the location. Closer guess = more points (max 5000 per round).
 */

/**
 * Haversine distance in kilometres between two lat/lon points.
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number}
 */
export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Score from distance using exponential decay, max 5000.
 * ≤50 km → 5000, ≥5000 km → 0.
 * @param {number} distKm
 * @returns {number}
 */
export function scoreFromDistance(distKm) {
  if (distKm <= 50) return 5000;
  if (distKm >= 5000) return 0;
  return Math.round(5000 * Math.exp(-distKm / 1500));
}

export class HeritageLocateLogic {
  /**
   * @param {Object} opts
   * @param {number} opts.maxRounds
   */
  constructor({ maxRounds = 10 }) {
    this.maxRounds = maxRounds;
    this.sites = [];
    this.index = -1;
    this.results = [];
    this.totalScore = 0;
    this.startTime = null;
  }

  /**
   * Load and shuffle heritage sites, slice to maxRounds.
   */
  async loadSites() {
    const resp = await fetch('data/heritage-sites.json');
    let all = await resp.json();
    // Fisher-Yates shuffle
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    this.sites = this.maxRounds === Infinity ? all : all.slice(0, this.maxRounds);
    this.index = -1;
    this.results = [];
    this.totalScore = 0;
    this.startTime = Date.now();
  }

  /** Advance to the next round. Returns the site or null if complete. */
  nextRound() {
    this.index++;
    return this.index < this.sites.length ? this.sites[this.index] : null;
  }

  /** Return the current site object. */
  getCurrentSite() {
    return this.index >= 0 && this.index < this.sites.length
      ? this.sites[this.index]
      : null;
  }

  /**
   * Confirm a guess for the current round.
   * @param {number} guessLat
   * @param {number} guessLon
   * @returns {{ distKm: number, score: number, actualLat: number, actualLon: number, siteName: string }}
   */
  confirmGuess(guessLat, guessLon) {
    const site = this.getCurrentSite();
    if (!site) return null;
    const distKm = haversineKm(guessLat, guessLon, site.lat, site.lon);
    const score = scoreFromDistance(distKm);
    this.totalScore += score;
    const result = {
      distKm: Math.round(distKm),
      score,
      actualLat: site.lat,
      actualLon: site.lon,
      siteName: site.siteName,
    };
    this.results.push(result);
    return result;
  }

  /** Progress info. */
  getProgress() {
    return {
      current: this.index + 1,
      total: this.sites.length,
      totalScore: this.totalScore,
      maxPossible: this.sites.length * 5000,
    };
  }

  /** Total elapsed seconds since game start. */
  getTotalTime() {
    return this.startTime ? (Date.now() - this.startTime) / 1000 : 0;
  }

  /** Whether all rounds are done. */
  isComplete() {
    return this.index >= this.sites.length - 1 && this.results.length >= this.sites.length;
  }

  /** Reset for replay with new shuffle. */
  async reset() {
    await this.loadSites();
  }
}
