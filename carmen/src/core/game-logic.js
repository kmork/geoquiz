/**
 * Carmen Logic — "Where in the World?" game engine.
 *
 * Pure game logic: route generation, clue selection, scoring, state machine.
 * No DOM access.
 */

import { composeClue } from '../content/clue-voice.js';
import { LOCATIONS } from '../content/locations.js';
import { pickTaunt } from '../content/taunts.js';
import { redactCountryName, containsCountryName } from './redaction.js';
import {
  clueFromFact, clueFromGeography, clueFromHeritage, clueFromRiverOrMountain,
  clueFromEmpire, clueFromFamousFor, clueFromExports, allGeographyClues, iconForCategory,
} from './clue-generators.js';
import { getCaseArchivePool, SuspectEngine, SUSPECTS } from './suspect-engine.js';
import { buildCampaignConfig } from '../campaign/progression.js';

// Re-export so existing main.js import surface is preserved.
export { SUSPECTS };

const INVESTIGATION_COST_HOURS = 3; // hours per investigation
const TRAVEL_COST_HOURS = 5;        // hours per ACME redeployment between confirmed leads
const EXTRA_CLUE_COST_HOURS = 2;    // hours per extra clue
const TIME_BONUS_HOURS_PER_POINT = 2;
const MAX_TIME_BONUS = 50;


export class CarmenGameLogic {
  /**
   * @param {Object} config
   * @param {Array}  config.countries    — window.DATA entries (with neighbors)
   * @param {Object} config.facts        — { countryName: [{fact, category}] }
   * @param {Array}  config.heritageSites — [{siteName, country, hint, ...}]
   * @param {Array}  config.rivers       — [{name, countries, hint}]
   * @param {Array}  config.mountains    — [{name, countries, hint}]
   * @param {Array}  config.empires      — [{name, countries, description}]
   * @param {string} config.difficulty   — 'rookie' | 'detective' | 'ace'
   */
  constructor(config) {
    this.countries = config.countries;
    this.facts = config.facts || {};
    this.heritageSites = config.heritageSites || [];
    this.rivers = config.rivers || [];
    this.mountains = config.mountains || [];
    this.empires = config.empires || [];
    this.caseNumber = config.caseNumber || 1;
    this.totalCases = config.totalCases || 10;
    this.mode = config.mode || 'campaign';
    this.excludedSuspects = new Set(config.excludedSuspects || []);
    const derivedPhase =
      this.caseNumber >= 10 ? 'finale' :
      this.caseNumber >= 7 ? 'pursuit' :
      this.caseNumber >= 4 ? 'whispers' : 'prelude';
    this.campaignPhase = config.phaseOverride || derivedPhase;
    this.config = buildCampaignConfig(config.configPhase || this.campaignPhase);
    // Back-compat alias for any internal reads that still say `this.diff`.
    this.diff = this.config;

    // Build lookups
    this.countrySet = new Set(this.countries.map(c => c.country));
    this.countryMap = Object.fromEntries(this.countries.map(c => [c.country, c]));
    this.neighborsMap = Object.fromEntries(
      this.countries.map(c => [c.country, (c.neighbors || []).filter(n => this.countrySet.has(n))])
    );
    this.routeProvider = config.routeProvider || null;
    if (this.routeProvider?.choiceMap) {
      this.neighborsMap = Object.fromEntries(
        Object.entries(this.routeProvider.choiceMap)
          .map(([country, choices]) => [country, choices.filter(n => this.countrySet.has(n))])
      );
    }

    // Heritage sites indexed by country
    this.heritagByCountry = {};
    for (const site of this.heritageSites) {
      if (!this.heritagByCountry[site.country]) this.heritagByCountry[site.country] = [];
      this.heritagByCountry[site.country].push(site);
    }

    // Rivers/mountains indexed by country
    this.riversByCountry = {};
    for (const r of this.rivers) {
      for (const c of r.countries) {
        if (!this.riversByCountry[c]) this.riversByCountry[c] = [];
        this.riversByCountry[c].push(r);
      }
    }
    this.mountainsByCountry = {};
    for (const m of this.mountains) {
      for (const c of m.countries) {
        if (!this.mountainsByCountry[c]) this.mountainsByCountry[c] = [];
        this.mountainsByCountry[c].push(m);
      }
    }
    this.empiresByCountry = {};
    for (const e of this.empires) {
      for (const c of e.countries) {
        if (!this.empiresByCountry[c]) this.empiresByCountry[c] = [];
        this.empiresByCountry[c].push(e);
      }
    }

    // Suspect engine
    this.suspectEngine = new SuspectEngine();

    // State
    this.reset();
  }

  reset() {
    this.route = [];
    this.artifact = null;
    this.thiefName = '???'; // Unknown until identified
    this.currentStop = 0;
    this.score = 0;
    this.extraCluesUsed = 0;
    this.wrongGuessesThisStop = 0;
    this.totalWrongGuesses = 0;
    this.firstTryStops = 0;
    this.usedClueIds = new Set();
    this.gameStartTime = Date.now();
    this.stopStartTime = null;
    this.gameOver = false;
    this.won = false;
    this.timeBonusAwarded = false;

    this.suspectEngine.reset();

    // Time tracking (in-game hours)
    this.hoursRemaining = this.diff.totalHours;
    this.timeExpired = false;
  }

  /** Convenience accessor — the hidden suspect. */
  get suspect() { return this.suspectEngine.suspect; }

  getInterpolCandidates() {
    const pool = getCaseArchivePool(this.route, this.countryMap, this.excludedSuspects);
    const finaleAlias = this.suspectEngine.getFinaleAlias?.();
    if (!finaleAlias) return pool;
    return [...pool, finaleAlias];
  }

  /** Generate route and return the intro data. */
  start() {
    this.reset();
    this.route = this._generateRoute(this.diff.stops);
    this.artifact = this._pickArtifact(this.route[0]);

    this.suspectEngine.pickSuspect(
      this.campaignPhase,
      this.route,
      this.countryMap,
      this.excludedSuspects,
    );

    this.stopStartTime = Date.now();

    const clues = this._generateClues(this.route[1], this.diff.cluesPerStop);
    const neighbors = this._getNeighborChoices(this.route[0]);

    return {
      thiefName: this.thiefName,
      artifact: this.artifact,
      startCountry: this.route[0],
      targetCountry: this.route[1],
      clues,
      neighbors,
      progress: this.getProgress(),
      caseNumber: this.caseNumber,
      totalCases: this.totalCases,
      campaignPhase: this.campaignPhase,
      mode: this.mode,
    };
  }

  /** Player guesses which neighboring country confirms the next border lead. */
  guess(country) {
    if (this.gameOver) return { correct: false, gameOver: true };

    const target = this.route[this.currentStop + 1];
    const correct = country === target;

    if (correct) {
      const timeTaken = (Date.now() - this.stopStartTime) / 1000;
      if (this.wrongGuessesThisStop === 0) this.firstTryStops++;
      const stopScore = this._calculateStopScore(
        this.wrongGuessesThisStop === 0, timeTaken, this.extraCluesUsed
      );
      this.score += stopScore;
      this.currentStop++;
      this.wrongGuessesThisStop = 0;
      this.extraCluesUsed = 0;
      this.stopStartTime = Date.now();

      // Check if thief caught
      if (this.currentStop >= this.route.length - 1) {
        this.gameOver = true;
        this.won = true;
        // Perfect game bonus
        if (this.firstTryStops === this.route.length - 1) {
          this.score += 200;
        }
        return {
          correct: true,
          gameOver: true,
          won: true,
          stopScore,
          country: target,
          progress: this.getProgress(),
        };
      }

      // Next stop
      const nextTarget = this.route[this.currentStop + 1];
      const clues = this._generateClues(nextTarget, this.diff.cluesPerStop);
      const neighbors = this._getNeighborChoices(this.route[this.currentStop]);

      return {
        correct: true,
        gameOver: false,
        stopScore,
        country: target,
        nextCountry: this.route[this.currentStop],
        clues,
        neighbors,
        progress: this.getProgress(),
      };
    }

    // Wrong guess — ACME redeploys there and discovers a dead end
    this.wrongGuessesThisStop++;
    this.totalWrongGuesses++;
    this.score = Math.max(0, this.score - 25);

    // Return neighbors of the correct stop + the correct stop itself (to go back)
    const currentCountry = this.route[this.currentStop];
    const neighbors = this._getNeighborChoices(currentCountry);
    if (!neighbors.includes(currentCountry)) neighbors.push(currentCountry);

    return {
      correct: false,
      gameOver: false,
      country,
      fromCountry: currentCountry,
      neighbors,
      progress: this.getProgress(),
    };
  }

  /** Request an extra clue for the current stop. */
  requestExtraClue() {
    if (this.gameOver) return null;

    const totalExtra = this.extraCluesUsed;
    if (totalExtra >= this.diff.extraClues) return null;

    const target = this.route[this.currentStop + 1];
    const clues = this._generateClues(target, 1);
    if (clues.length === 0) return null;

    this.extraCluesUsed++;
    this.score = Math.max(0, this.score - 20);
    return clues[0];
  }

  getProgress() {
    return {
      stop: this.currentStop,
      totalStops: this.route.length - 1,
      score: this.score,
      route: this.route.slice(0, this.currentStop + 1),
    };
  }

  getResults() {
    const elapsed = (Date.now() - this.gameStartTime) / 1000;
    const maxTimeBonus = this._calculateTimeBonus(
      Math.max(0, this.diff.totalHours - ((this.route.length - 1) * TRAVEL_COST_HOURS))
    );
    const maxScore = (this.route.length - 1) * 150 + 200 + maxTimeBonus;
    return {
      won: this.won,
      score: this.score,
      maxScore,
      time: elapsed,
      accuracy: Math.round((this.firstTryStops / (this.route.length - 1)) * 100),
      stopsCompleted: this.currentStop,
      totalStops: this.route.length - 1,
      totalWrongGuesses: this.totalWrongGuesses,
      route: this.route,
    };
  }

  awardTimeBonus() {
    if (!this.won || this.timeBonusAwarded) return 0;
    const bonus = this._calculateTimeBonus(this.hoursRemaining);
    this.score += bonus;
    this.timeBonusAwarded = true;
    return bonus;
  }

  // ─── Route Generation ────────────────────────────────────────

  _generateRoute(numStops) {
    if (this.routeProvider?.generateRoute) {
      return this.routeProvider.generateRoute(numStops, this);
    }

    // Pick start country: must have heritage site + neighbors
    const heritageCountries = [...new Set(this.heritageSites.map(s => s.country))]
      .filter(c => this.countrySet.has(c) && (this.neighborsMap[c] || []).length >= 2);

    let bestRoute = [];

    // Try multiple times to get a full-length route
    for (let attempt = 0; attempt < 20; attempt++) {
      const start = heritageCountries[Math.floor(Math.random() * heritageCountries.length)];
      const route = [start];
      const visited = new Set([start]);

      for (let i = 0; i < numStops; i++) {
        const current = route[route.length - 1];
        const candidates = (this.neighborsMap[current] || [])
          .filter(n => !visited.has(n) && (this.neighborsMap[n] || []).length >= 1);

        if (candidates.length === 0) break;

        // Prefer countries with more facts and more neighbors (for future steps)
        const scored = candidates.map(c => ({
          country: c,
          weight: ((this.facts[c] || []).length + 1)
            * ((this.neighborsMap[c] || []).length)
        }));
        scored.sort((a, b) => b.weight - a.weight);

        // Weighted random from top candidates
        const top = scored.slice(0, Math.min(5, scored.length));
        const totalW = top.reduce((s, x) => s + x.weight, 0);
        let r = Math.random() * totalW;
        let pick = top[0].country;
        for (const item of top) {
          r -= item.weight;
          if (r <= 0) { pick = item.country; break; }
        }

        route.push(pick);
        visited.add(pick);
      }

      if (route.length > bestRoute.length) bestRoute = route;
      if (bestRoute.length >= numStops + 1) break;
    }

    return bestRoute;
  }

  _pickArtifact(country) {
    const sites = this.heritagByCountry[country];
    if (sites && sites.length > 0) {
      return sites[Math.floor(Math.random() * sites.length)];
    }
    return { siteName: 'a priceless artifact', country, hint: '' };
  }

  // ─── Neighbor Choices ────────────────────────────────────────

  _getNeighborChoices(country) {
    if (this.routeProvider?.getChoices) {
      return this.routeProvider.getChoices(country, this);
    }

    const neighbors = (this.neighborsMap[country] || []).slice();
    // Shuffle
    for (let i = neighbors.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [neighbors[i], neighbors[j]] = [neighbors[j], neighbors[i]];
    }
    return neighbors;
  }

  /** Get neighbor choices for the current stop (plus the stop itself for going back). */
  getNeighborChoicesForCurrentStop() {
    const current = this.route[this.currentStop];
    const neighbors = this._getNeighborChoices(current);
    if (!neighbors.includes(current)) neighbors.push(current);
    return neighbors;
  }

  // ─── Clue Generation ────────────────────────────────────────

  _generateClues(country, count) {
    // Gather the neighbor choices for this stop so we can filter unhelpful clues
    const currentCountry = this.route[this.currentStop];
    const neighborChoices = this.neighborsMap[currentCountry] || [];

    const clues = [];
    const generators = [
      () => clueFromFact(country, this),
      () => clueFromGeography(country, this, neighborChoices),
      () => clueFromHeritage(country, this),
      () => clueFromRiverOrMountain(country, this, neighborChoices),
      () => clueFromEmpire(country, this),
      () => clueFromFamousFor(country, this, neighborChoices),
      () => clueFromExports(country, this, neighborChoices),
    ];

    // Shuffle generators for variety
    for (let i = generators.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [generators[i], generators[j]] = [generators[j], generators[i]];
    }

    for (const gen of generators) {
      if (clues.length >= count) break;
      const clue = gen();
      if (clue && !this.usedClueIds.has(clue.id)) {
        this.usedClueIds.add(clue.id);
        clues.push(clue);
      }
    }

    // If we still need more, try facts again (multiple facts per country)
    if (clues.length < count) {
      const facts = this.facts[country] || [];
      for (const f of facts) {
        if (clues.length >= count) break;
        const id = `fact-${country}-${f.fact.slice(0, 30)}`;
        if (this.usedClueIds.has(id)) continue;
        const redacted = redactCountryName(f.fact, country);
        if (redacted === f.fact || !redacted.includes(country)) {
          this.usedClueIds.add(id);
          clues.push({ id, text: redacted, icon: iconForCategory(f.category), category: f.category });
        }
      }
    }

    // Last resort: geography clues are always available
    if (clues.length < count) {
      const geoClues = allGeographyClues(country, this);
      for (const c of geoClues) {
        if (clues.length >= count) break;
        if (!this.usedClueIds.has(c.id)) {
          this.usedClueIds.add(c.id);
          clues.push(c);
        }
      }
    }

    return clues;
  }

  // ─── Time Management ─────────────────────────────────────────

  /** Spend in-game hours. Returns false if time ran out. */
  spendTime(hours) {
    this.hoursRemaining = Math.max(0, this.hoursRemaining - hours);
    if (this.hoursRemaining <= 0) {
      this.timeExpired = true;
      this.gameOver = true;
      this.won = false;
    }
    return !this.timeExpired;
  }

  /** Cost for investigating a location. */
  getInvestigationCost() { return INVESTIGATION_COST_HOURS; }

  /** Cost for redeploying to the next lead. */
  getTravelCost() { return TRAVEL_COST_HOURS; }

  /** Cost for requesting an extra clue. */
  getExtraClueCost() { return EXTRA_CLUE_COST_HOURS; }

  /** Get current time state. */
  getTimeState() {
    return {
      hoursRemaining: this.hoursRemaining,
      totalHours: this.diff.totalHours,
      expired: this.timeExpired,
    };
  }

  // ─── Suspect / Warrant System ────────────────────────────────

  getSuspectClue() { return this.suspectEngine.getSuspectClue(this.currentStop); }
  investigateSuspectClue() { return this.suspectEngine.investigateSuspectClue(); }
  getSuspectInvestigateCost() { return EXTRA_CLUE_COST_HOURS; }
  getSuspectLineup(candidates = null) { return this.suspectEngine.getSuspectLineup(candidates); }
  getFinaleAlias() { return this.suspectEngine.getFinaleAlias?.() || null; }
  identifySuspect(name) { return this.suspectEngine.identifySuspect(name); }
  getRevealedSuspectAttrs() { return this.suspectEngine.getRevealedSuspectAttrs(); }

  /**
   * Wrap a raw clue in noir narrative dialogue (phrasing + location voice + micro-action).
   * Country-name redaction runs on the final composed line.
   */
  narrateClue(clue, informant, locationId) {
    if (!clue) return clue;
    const country = this.route[this.currentStop + 1];
    const redact = (text) => redactCountryName(text, country);
    const { dialogue, action } = composeClue(clue, informant, locationId, redact);
    if (dialogue && !containsCountryName(dialogue, country) &&
        (!action || !containsCountryName(action, country))) {
      return { ...clue, text: dialogue, action };
    }
    return clue;
  }

  // ─── Investigation Locations ─────────────────────────────────

  /** Get available locations for the current stop. */
  getLocations() {
    return LOCATIONS;
  }

  /** Get the max investigations allowed per stop. */
  getMaxInvestigations() {
    return this.diff.investigations;
  }

  /** Investigate a location — returns a clue for that location type, or null. */
  investigateLocation(locationId) {
    if (this.gameOver) return null;

    const location = LOCATIONS.find(l => l.id === locationId);
    if (!location) return null;

    const target = this.route[this.currentStop + 1];
    const currentCountry = this.route[this.currentStop];
    const neighborChoices = this.neighborsMap[currentCountry] || [];

    // Try each clue type the location provides (thematically matched)
    // Shuffle so repeated visits to the same location type vary
    const shuffledTypes = [...location.clueTypes].sort(() => Math.random() - 0.5);
    for (const clueType of shuffledTypes) {
      let clue = null;
      switch (clueType) {
        case 'geography':
          clue = clueFromGeography(target, this, neighborChoices);
          break;
        case 'fact':
          clue = clueFromFact(target, this);
          break;
        case 'heritage':
          clue = clueFromHeritage(target, this);
          break;
        case 'river_mountain':
          clue = clueFromRiverOrMountain(target, this, neighborChoices);
          break;
        case 'empire':
          clue = clueFromEmpire(target, this);
          break;
        case 'famous_for':
          clue = clueFromFamousFor(target, this, neighborChoices);
          break;
        case 'exports':
          clue = clueFromExports(target, this, neighborChoices);
          break;
      }
      if (clue && !this.usedClueIds.has(clue.id)) {
        this.usedClueIds.add(clue.id);
        return clue;
      }
    }

    // No leads at this location for this destination
    return null;
  }

  // ─── Informants ──────────────────────────────────────────────

  /** Pick a random informant matching the given location. */
  getInformant(locationId) {
    const location = LOCATIONS.find(l => l.id === locationId);
    if (location && location.informants.length > 0) {
      return location.informants[Math.floor(Math.random() * location.informants.length)];
    }
    // Fallback for non-location clues (e.g. suspect clues)
    return { emoji: '🔍', prefix: 'A witness reported' };
  }

  // ─── Thief Taunts ──────────────────────────────────────────

  /** Get a taunt appropriate for the current game state. */
  getTaunt(wrongGuess = false) {
    return pickTaunt(this.campaignPhase, this.currentStop, this.route.length, wrongGuess);
  }

  _pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ─── Scoring ────────────────────────────────────────────────

  _calculateStopScore(firstTry, timeSeconds) {
    let score = 100;
    if (firstTry) score += 50;
    return score;
  }

  _calculateTimeBonus(hoursRemaining) {
    return Math.min(MAX_TIME_BONUS, Math.floor(hoursRemaining / TIME_BONUS_HOURS_PER_POINT));
  }
}
