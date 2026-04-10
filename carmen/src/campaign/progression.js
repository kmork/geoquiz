/**
 * Campaign progression — phase mapping and difficulty modifiers per phase.
 *
 * Pure functions + data. No localStorage, no DOM.
 */

const BASE_CONFIG = { stops: 4, cluesPerStop: 3, extraClues: 99, investigations: 4, totalHours: 72 };

const CAMPAIGN_MODIFIERS = {
  prelude:  { hours:   0, stops: 0, investigations:  0, extraClues:   0, cluesPerStop:  0 },
  whispers: { hours:   0, stops: 1, investigations: -1, extraClues: -97, cluesPerStop: -1 },
  pursuit:  { hours:  -8, stops: 1, investigations: -1, extraClues: -98, cluesPerStop: -1 },
  finale:   { hours: -16, stops: 1, investigations: -1, extraClues: -98, cluesPerStop: -2 },
};

export const TOTAL_CASES = 10;

/** Map a 1-based case number to a campaign phase. */
export function caseToPhase(caseNumber) {
  if (caseNumber >= 10) return 'finale';
  if (caseNumber >= 7)  return 'pursuit';
  if (caseNumber >= 4)  return 'whispers';
  return 'prelude';
}

/** Build the difficulty config for a given campaign phase. */
export function buildCampaignConfig(phase) {
  const mod = CAMPAIGN_MODIFIERS[phase] || CAMPAIGN_MODIFIERS.prelude;
  return {
    stops:          Math.max(4, BASE_CONFIG.stops          + mod.stops),
    cluesPerStop:   Math.max(1, BASE_CONFIG.cluesPerStop   + mod.cluesPerStop),
    extraClues:     Math.max(0, BASE_CONFIG.extraClues     + mod.extraClues),
    investigations: Math.max(1, BASE_CONFIG.investigations + mod.investigations),
    totalHours:     Math.max(40, BASE_CONFIG.totalHours    + mod.hours),
  };
}
