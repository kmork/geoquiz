/**
 * Suspect engine — hidden suspect selection, vague→specific attribute reveal,
 * lineup decoy scoring, and identification.
 *
 * Owns all suspect-related state so game-logic can delegate cleanly.
 */

import {
  SUSPECTS, SUSPECT_ATTRIBUTES, getAttributeGroup,
  SUSPECT_CLUE_TEMPLATES_VAGUE, SUSPECT_CLUE_TEMPLATES_SPECIFIC,
} from '../content/suspects.js';
import { FINALE_ALIAS } from '../content/finale-alias.js';

export { SUSPECTS };

const MIN_ARCHIVE_POOL_SIZE = 16;

function hashString(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function normalizeArchiveRegion(region) {
  if (!region) return null;
  if (region === 'North America' || region === 'South America' || region === 'Americas') {
    return 'Americas';
  }
  return region;
}

function getRouteRegions(route, countryMap) {
  return [...new Set(
    route
      .map(country => normalizeArchiveRegion(countryMap[country]?.continent))
      .filter(Boolean)
  )];
}

function getSuspectRegions(suspect) {
  return [...new Set((suspect.knownRegions || []).map(normalizeArchiveRegion).filter(Boolean))];
}

function getEligibleSuspects(excludedNames = new Set()) {
  return SUSPECTS.filter(s => s.name !== 'Carmen Sandiego' && !excludedNames.has(s.name));
}

function filterByRouteRegions(pool, routeRegions) {
  const regionMatch = pool.filter(suspect =>
    getSuspectRegions(suspect).some(region => routeRegions.includes(region))
  );
  return regionMatch.length > 0 ? regionMatch : pool;
}

function padArchivePool(basePool, eligiblePool, route, minSize = MIN_ARCHIVE_POOL_SIZE) {
  if (basePool.length >= minSize) return basePool;

  const seen = new Set(basePool.map(s => s.name));
  const seed = route.join('|');
  const extras = eligiblePool
    .filter(s => !seen.has(s.name))
    .sort((a, b) => {
      const aHash = hashString(`${seed}:${a.name}`);
      const bHash = hashString(`${seed}:${b.name}`);
      return aHash - bHash || a.name.localeCompare(b.name);
    });

  return [...basePool, ...extras.slice(0, Math.max(0, minSize - basePool.length))];
}

export function getSuspectSelectionPool(route, countryMap, excludedNames = new Set()) {
  const eligiblePool = getEligibleSuspects(excludedNames);
  const routeRegions = getRouteRegions(route, countryMap);
  return filterByRouteRegions(eligiblePool, routeRegions);
}

export function getCaseArchivePool(route, countryMap, excludedNames = new Set(), minSize = MIN_ARCHIVE_POOL_SIZE) {
  const eligiblePool = getEligibleSuspects(excludedNames);
  const routeRegions = getRouteRegions(route, countryMap);
  const regionPool = filterByRouteRegions(eligiblePool, routeRegions);
  return padArchivePool(regionPool, eligiblePool, route, minSize);
}

export class SuspectEngine {
  constructor() {
    this.suspect = null;
    this.finaleAlias = null;
    this._suspectClueAttrs = [];
    this._suspectClueIndex = 0;
    this._suspectClueStop = -1;
    this._revealedAttrs = [];
    this._pendingSpecificClue = null;
  }

  reset() {
    this.suspect = null;
    this.finaleAlias = null;
    this._suspectClueAttrs = [...SUSPECT_ATTRIBUTES].sort(() => Math.random() - 0.5);
    this._suspectClueIndex = 0;
    this._suspectClueStop = -1;
    this._revealedAttrs = [];
    this._pendingSpecificClue = null;
  }

  /**
   * Pick the hidden suspect for this case.
   * @param {string}   campaignPhase — 'prelude' | 'whispers' | 'pursuit' | 'finale'
   * @param {string[]} route         — the country route for this case
   * @param {Object}   countryMap    — country name → country data
   * @param {Set}      excludedNames — suspects already in custody
   */
  pickSuspect(campaignPhase, route, countryMap, excludedNames = new Set()) {
    if (campaignPhase === 'finale') {
      const carmen = SUSPECTS.find(s => s.name === 'Carmen Sandiego');
      if (carmen) {
        this.suspect = carmen;
        this.finaleAlias = { ...FINALE_ALIAS };
        return;
      }
    }
    const candidates = getSuspectSelectionPool(route, countryMap, excludedNames);
    if (candidates.length === 0) {
      throw new Error('No eligible suspects remain for case selection.');
    }
    this.suspect = candidates[Math.floor(Math.random() * candidates.length)];
  }

  /** Get the next suspect identity clue for this stop (vague). */
  getSuspectClue(currentStop) {
    if (this._suspectClueIndex >= this._suspectClueAttrs.length) return null;
    if (this._suspectClueStop === currentStop) return null;
    this._suspectClueStop = currentStop;
    const attr = this._suspectClueAttrs[this._suspectClueIndex];
    this._suspectClueIndex++;
    const value = this.suspect[attr];
    const group = getAttributeGroup(attr, value);

    const clueId = `suspect-${currentStop}-${attr}`;
    this._pendingSpecificClue = { clueId, attr, value, group };
    this._revealedAttrs.push({ attr, value: group, vague: true });

    return {
      text: SUSPECT_CLUE_TEMPLATES_VAGUE[attr](group),
      icon: '🔍',
      attr,
      group,
      clueId,
      canInvestigate: true,
    };
  }

  /** Spend time to refine the latest vague suspect clue into a specific one. */
  investigateSuspectClue() {
    if (!this._pendingSpecificClue) return null;
    const { clueId, attr, value } = this._pendingSpecificClue;
    this._pendingSpecificClue = null;

    const entry = this._revealedAttrs.find(e => e.attr === attr && e.vague);
    if (entry) {
      entry.value = value;
      entry.vague = false;
    }

    return {
      text: SUSPECT_CLUE_TEMPLATES_SPECIFIC[attr](value),
      icon: '🔎',
      attr,
      value,
      clueId,
    };
  }

  /** Get a lineup of 4 suspects (includes the real one). Decoys match vague clues. */
  getSuspectLineup(candidates = null) {
    if (this.finaleAlias) {
      return this.getFinaleLineup(candidates);
    }
    const real = this.suspect;
    const pool = (candidates && candidates.length > 0 ? candidates : SUSPECTS).filter(s => s.name !== real.name);
    const others = pool.length >= 3 ? pool : SUSPECTS.filter(s => s.name !== real.name);

    const specificAttrs = new Set(
      this._revealedAttrs.filter(e => !e.vague).map(e => e.attr)
    );
    const vagueEntries = this._revealedAttrs.filter(e => e.vague);

    const scored = others.map(s => {
      let score = 0;
      for (const { attr, value: groupName } of vagueEntries) {
        const candidateGroup = getAttributeGroup(attr, s[attr]);
        if (candidateGroup === groupName) score += 10;
      }
      for (const attr of specificAttrs) {
        if (s[attr] === real[attr]) score += 15;
      }
      score += Math.random() * 2;
      return { suspect: s, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const decoys = scored.slice(0, 3).map(s => s.suspect);
    return [...decoys, real].sort(() => Math.random() - 0.5);
  }

  getFinaleLineup(candidates = null) {
    const alias = this.finaleAlias;
    const real = this.suspect;
    const pool = (candidates && candidates.length > 0 ? candidates : SUSPECTS)
      .filter(s => s.name !== real.name && s.name !== alias.name);
    const others = pool.length >= 3
      ? pool
      : SUSPECTS.filter(s => s.name !== real.name && s.name !== alias.name);

    const specificAttrs = new Set(
      this._revealedAttrs.filter(e => !e.vague).map(e => e.attr)
    );
    const vagueEntries = this._revealedAttrs.filter(e => e.vague);

    const scored = others.map(s => {
      let score = 0;
      for (const { attr, value: groupName } of vagueEntries) {
        const candidateGroup = getAttributeGroup(attr, s[attr]);
        if (candidateGroup === groupName) score += 10;
      }
      for (const attr of specificAttrs) {
        if (s[attr] === real[attr]) score += 15;
      }
      score += Math.random() * 2;
      return { suspect: s, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const decoys = scored.slice(0, 3).map(s => s.suspect);
    return [...decoys, alias].sort(() => Math.random() - 0.5);
  }

  /** Check if the player identified the correct suspect. */
  identifySuspect(name) {
    if (this.finaleAlias) {
      return name === this.finaleAlias.name;
    }
    return name === this.suspect.name;
  }

  getFinaleAlias() {
    return this.finaleAlias;
  }

  /** Get revealed suspect attributes for the dossier. */
  getRevealedSuspectAttrs() {
    return this._revealedAttrs;
  }
}
