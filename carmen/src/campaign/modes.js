import { CrimsonTrailFinaleRouteProvider } from '../campaigns/crimson-trail/finale-route-provider.js';
import { SKYLINE_SYNDICATE_MODE, SKYLINE_SYNDICATE } from '../campaigns/skyline-syndicate/flight-campaign-config.js';
import { CapitalFlightRouteProvider } from '../campaigns/skyline-syndicate/flight-route-provider.js';
import { TOTAL_CASES } from './progression.js';

export const CAMPAIGN_MODE = 'campaign';
export const OPEN_CASES_MODE = 'open_cases';
export const OPEN_CASES_PHASE = 'open_cases';
export const OPEN_CASES_CONFIG_PHASE = 'pursuit';

const CRIMSON_FINALE_CASE = 10;
const crimsonFinaleRouteProvider = new CrimsonTrailFinaleRouteProvider();

export function isKnownGameMode(mode) {
  return mode === CAMPAIGN_MODE || mode === OPEN_CASES_MODE || mode === SKYLINE_SYNDICATE_MODE;
}

export function normalizeGameMode(mode) {
  return isKnownGameMode(mode) ? mode : CAMPAIGN_MODE;
}

export function isOpenCasesMode(mode) {
  return mode === OPEN_CASES_MODE;
}

export function isSkylineSyndicateMode(mode) {
  return mode === SKYLINE_SYNDICATE_MODE;
}

export async function loadCampaignModeData() {
  const skylineRouteData = await fetch(SKYLINE_SYNDICATE.dataUrl).then(r => r.json());
  return {
    skylineRouteData,
    skylineRouteProvider: new CapitalFlightRouteProvider(skylineRouteData),
  };
}

export function getPlayableGameMode(mode, modeData) {
  if (isSkylineSyndicateMode(mode) && !modeData?.skylineRouteData?.routes?.length) {
    console.warn(`${SKYLINE_SYNDICATE.title} has no imported flight routes yet; falling back to The Crimson Trail.`);
    return CAMPAIGN_MODE;
  }
  return normalizeGameMode(mode);
}

export function getMissionLabelForMode(mode, openCaseNumber) {
  if (isSkylineSyndicateMode(mode)) return SKYLINE_SYNDICATE.title;
  if (isOpenCasesMode(mode)) return `Open Case ${openCaseNumber}`;
  return null;
}

function getSkylinePhase(caseNumber) {
  if (caseNumber >= 7) return 'pursuit';
  if (caseNumber >= 4) return 'whispers';
  return 'prelude';
}

export function getRunConfigForMode({
  mode,
  currentCase,
  skylineCase,
  openCaseNumber,
  totalCases,
  unlockedSuspects,
  modeData,
}) {
  const openCases = isOpenCasesMode(mode);
  const skylineSyndicate = isSkylineSyndicateMode(mode);
  const crimsonFinale = mode === CAMPAIGN_MODE && currentCase === CRIMSON_FINALE_CASE;
  const runCase = skylineSyndicate ? skylineCase : openCases ? openCaseNumber : currentCase;
  const runTotalCases = openCases ? null : totalCases;
  const skylinePhase = skylineSyndicate ? getSkylinePhase(runCase) : null;
  return {
    mode,
    isOpenCases: openCases,
    isSkylineSyndicate: skylineSyndicate,
    caseNumber: runCase || 1,
    totalCases: runTotalCases || TOTAL_CASES,
    excludedSuspects: (openCases || skylineSyndicate) ? [] : [...unlockedSuspects],
    phaseOverride: openCases ? OPEN_CASES_PHASE : skylinePhase,
    configPhase: openCases ? OPEN_CASES_CONFIG_PHASE : skylinePhase,
    routeProvider: skylineSyndicate
      ? modeData?.skylineRouteProvider
      : crimsonFinale
        ? crimsonFinaleRouteProvider
        : null,
    briefingCopy: skylineSyndicate ? SKYLINE_SYNDICATE.briefing : null,
  };
}
