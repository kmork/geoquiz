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

export { SUSPECTS };

export class SuspectEngine {
  constructor() {
    this.suspect = null;
    this._suspectClueAttrs = [];
    this._suspectClueIndex = 0;
    this._suspectClueStop = -1;
    this._revealedAttrs = [];
    this._pendingSpecificClue = null;
  }

  reset() {
    this.suspect = null;
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
      if (carmen) { this.suspect = carmen; return; }
    }
    const pool = SUSPECTS.filter(s =>
      s.name !== 'Carmen Sandiego' && !excludedNames.has(s.name)
    );
    const routeContinents = new Set(
      route.map(c => countryMap[c]?.continent).filter(Boolean)
    );
    const regionMatch = pool.filter(s =>
      s.knownRegions?.some(r => routeContinents.has(r))
    );
    const candidates = regionMatch.length > 0 ? regionMatch : pool;
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
  getSuspectLineup() {
    const real = this.suspect;
    const others = SUSPECTS.filter(s => s.name !== real.name);

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

  /** Check if the player identified the correct suspect. */
  identifySuspect(name) {
    return name === this.suspect.name;
  }

  /** Get revealed suspect attributes for the dossier. */
  getRevealedSuspectAttrs() {
    return this._revealedAttrs;
  }
}
