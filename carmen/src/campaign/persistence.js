/**
 * Campaign persistence — all localStorage I/O for the Carmen game mode.
 *
 * Only module that touches localStorage. Everything else calls these functions.
 */

import { TOTAL_CASES } from './progression.js';

// ─── Keys ──────────────────────────────────────────
const MISSION_KEY          = 'carmen-missions';
const CAMPAIGN_KEY         = 'carmen-campaign-case';
const CAMPAIGN_COMPLETE_KEY = 'carmen-campaign-complete';
const CAMPAIGN_COMPLETE_ONCE_KEY = 'carmen-campaign-complete-once';
const GAME_MODE_KEY        = 'carmen-game-mode';
const OPEN_CASE_COUNT_KEY  = 'carmen-open-case-count';
const INTERPOL_KEY         = 'carmen-interpol-unlocked';
const THEFT_HISTORY_KEY    = 'carmen-theft-history';
const INTERPOL_VIEWED_KEY  = 'carmen-interpol-viewed';

// ─── Mission history ───────────────────────────────
export function getMissionHistory() {
  try { return JSON.parse(localStorage.getItem(MISSION_KEY)) || []; }
  catch { return []; }
}

export function saveMissionResult(result) {
  const history = getMissionHistory();
  history.push(result);
  localStorage.setItem(MISSION_KEY, JSON.stringify(history));
}

// ─── Campaign case progression ─────────────────────
export function getCurrentCase() {
  const n = parseInt(localStorage.getItem(CAMPAIGN_KEY), 10);
  if (!n || n < 1) return 1;
  return Math.min(n, TOTAL_CASES);
}

export function advanceCase() {
  const next = Math.min(getCurrentCase() + 1, TOTAL_CASES);
  localStorage.setItem(CAMPAIGN_KEY, String(next));
}

export function setCase(n) {
  const clamped = Math.max(1, Math.min(TOTAL_CASES, n | 0));
  localStorage.setItem(CAMPAIGN_KEY, String(clamped));
  localStorage.removeItem(CAMPAIGN_COMPLETE_KEY);
  return clamped;
}

export function markCampaignComplete() {
  localStorage.setItem(CAMPAIGN_COMPLETE_KEY, 'true');
  localStorage.setItem(CAMPAIGN_COMPLETE_ONCE_KEY, 'true');
}

export function resetCampaign() {
  localStorage.removeItem(CAMPAIGN_KEY);
  localStorage.removeItem(CAMPAIGN_COMPLETE_KEY);
  localStorage.setItem(GAME_MODE_KEY, 'campaign');
}

export function hasCompletedCampaignOnce() {
  return localStorage.getItem(CAMPAIGN_COMPLETE_ONCE_KEY) === 'true';
}

export function getGameMode() {
  const mode = localStorage.getItem(GAME_MODE_KEY);
  if (mode === 'campaign' || mode === 'open_cases') return mode;
  return hasCompletedCampaignOnce() ? 'open_cases' : 'campaign';
}

export function setGameMode(mode) {
  const normalized = mode === 'open_cases' ? 'open_cases' : 'campaign';
  localStorage.setItem(GAME_MODE_KEY, normalized);
  return normalized;
}

export function getOpenCaseCount() {
  const n = parseInt(localStorage.getItem(OPEN_CASE_COUNT_KEY), 10);
  if (!n || n < 0) return 0;
  return n;
}

export function advanceOpenCaseCount() {
  const next = getOpenCaseCount() + 1;
  localStorage.setItem(OPEN_CASE_COUNT_KEY, String(next));
  return next;
}

// ─── Interpol database ─────────────────────────────
export function getUnlockedSuspects() {
  try { return new Set(JSON.parse(localStorage.getItem(INTERPOL_KEY)) || []); }
  catch { return new Set(); }
}

export function unlockSuspect(name) {
  const unlocked = getUnlockedSuspects();
  unlocked.add(name);
  localStorage.setItem(INTERPOL_KEY, JSON.stringify([...unlocked]));
}

// ─── Theft history ─────────────────────────────────
export function getTheftHistory() {
  try { return JSON.parse(localStorage.getItem(THEFT_HISTORY_KEY)) || {}; }
  catch { return {}; }
}

export function recordTheft(suspectName, artifactName, country) {
  const history = getTheftHistory();
  if (!history[suspectName]) history[suspectName] = [];
  history[suspectName].push({ artifact: artifactName, country, date: new Date().toISOString().slice(0, 10) });
  localStorage.setItem(THEFT_HISTORY_KEY, JSON.stringify(history));
}

// ─── Interpol viewed ───────────────────────────────
export function getInterpolViewed() {
  try { return new Set(JSON.parse(localStorage.getItem(INTERPOL_VIEWED_KEY)) || []); }
  catch { return new Set(); }
}

export function saveInterpolViewed(name) {
  const viewed = getInterpolViewed();
  viewed.add(name);
  localStorage.setItem(INTERPOL_VIEWED_KEY, JSON.stringify([...viewed]));
}
