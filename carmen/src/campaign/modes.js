import { CrimsonTrailFinaleRouteProvider } from '../campaigns/crimson-trail/finale-route-provider.js';
import { SKYLINE_SYNDICATE_MODE, SKYLINE_SYNDICATE, getSkylineCaseNarrative } from '../campaigns/skyline-syndicate/flight-campaign-config.js';
import { CapitalFlightRouteProvider } from '../campaigns/skyline-syndicate/flight-route-provider.js';
import { TOTAL_CASES } from './progression.js';

export const CAMPAIGN_MODE = 'campaign';
export const OPEN_CASES_MODE = 'open_cases';
export const CITY_OPEN_CASE_MODE = 'city_open_case';
export const WORLD_CASE_FILES_MODE = 'world_case_files';
export const OPEN_CASES_PHASE = 'open_cases';
export const OPEN_CASES_CONFIG_PHASE = 'pursuit';

const CRIMSON_FINALE_CASE = 10;
const crimsonFinaleRouteProvider = new CrimsonTrailFinaleRouteProvider();

const CITY_OPEN_CASE_NARRATIVE = {
  title: 'The Street-Level File',
  briefing: 'ACME is testing a street-level city desk. Follow leads, then work the local map when you arrive.',
  note: 'Experiment note: the city map marks ACME field stops. Location uses real location near capital center of the specified type, airport pin uses known gateway airport coordinates.',
  solved: 'The street-level file is closed. ACME has enough field notes to keep testing city-map investigations.',
  failed: 'The street-level file stays open. ACME marks the experiment for another run through the same desk.',
};

export function isKnownGameMode(mode) {
  return mode === CAMPAIGN_MODE || mode === OPEN_CASES_MODE || mode === CITY_OPEN_CASE_MODE || mode === WORLD_CASE_FILES_MODE || mode === SKYLINE_SYNDICATE_MODE;
}

export function normalizeGameMode(mode) {
  return isKnownGameMode(mode) ? mode : CAMPAIGN_MODE;
}

export function isOpenCasesMode(mode) {
  return mode === OPEN_CASES_MODE;
}

export function isCityOpenCaseMode(mode) {
  return mode === CITY_OPEN_CASE_MODE;
}

export function isWorldCaseFilesMode(mode) {
  return mode === WORLD_CASE_FILES_MODE;
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
  if ((isSkylineSyndicateMode(mode) || isCityOpenCaseMode(mode)) && !modeData?.skylineRouteData?.routes?.length) {
    console.warn(`${mode === CITY_OPEN_CASE_MODE ? 'City Map Open Case' : SKYLINE_SYNDICATE.title} has no imported flight routes yet; falling back to The Crimson Trail.`);
    return CAMPAIGN_MODE;
  }
  return normalizeGameMode(mode);
}

export function getMissionLabelForMode(mode, openCaseNumber) {
  if (isSkylineSyndicateMode(mode)) return SKYLINE_SYNDICATE.title;
  if (isCityOpenCaseMode(mode)) return 'City Map Open Case';
  if (isWorldCaseFilesMode(mode)) return 'World Case Files';
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
  const cityOpenCase = isCityOpenCaseMode(mode);
  const worldCaseFiles = isWorldCaseFilesMode(mode);
  const skylineSyndicate = isSkylineSyndicateMode(mode);
  const crimsonFinale = mode === CAMPAIGN_MODE && currentCase === CRIMSON_FINALE_CASE;
  const runCase = skylineSyndicate ? skylineCase : openCases ? openCaseNumber : (cityOpenCase || worldCaseFiles) ? 1 : currentCase;
  const runTotalCases = (openCases || cityOpenCase || worldCaseFiles) ? null : totalCases;
  const skylinePhase = skylineSyndicate ? getSkylinePhase(runCase) : null;
  const skylineNarrative = skylineSyndicate ? getSkylineCaseNarrative(runCase) : null;
  return {
    mode,
    isOpenCases: openCases,
    isCityOpenCase: cityOpenCase,
    isWorldCaseFiles: worldCaseFiles,
    isSkylineSyndicate: skylineSyndicate,
    caseNumber: runCase || 1,
    totalCases: runTotalCases || TOTAL_CASES,
    excludedSuspects: (openCases || cityOpenCase || worldCaseFiles || skylineSyndicate) ? [] : [...unlockedSuspects],
    phaseOverride: (openCases || cityOpenCase || worldCaseFiles) ? OPEN_CASES_PHASE : skylinePhase,
    configPhase: (openCases || cityOpenCase || worldCaseFiles) ? OPEN_CASES_CONFIG_PHASE : skylinePhase,
    routeProvider: (skylineSyndicate || cityOpenCase)
      ? modeData?.skylineRouteProvider
      : crimsonFinale
        ? crimsonFinaleRouteProvider
        : null,
    caseTitle: cityOpenCase ? CITY_OPEN_CASE_NARRATIVE.title : worldCaseFiles ? 'The Louvre Vanishing' : skylineNarrative?.title || null,
    briefingCopy: worldCaseFiles
      ? 'ACME is opening the whole world desk. Investigate the cultural theft, gather enough evidence to narrow the atlas, travel when ready, and prove each destination before advancing.'
      : cityOpenCase
      ? CITY_OPEN_CASE_NARRATIVE.briefing
      : skylineSyndicate
        ? skylineNarrative?.briefing || SKYLINE_SYNDICATE.briefing
        : null,
    briefingNote: worldCaseFiles
      ? 'Experiment note: there is no hard case clock. Candidate colors show how strongly countries match the collected evidence.'
      : cityOpenCase ? CITY_OPEN_CASE_NARRATIVE.note : skylineNarrative?.note || null,
    closingCopy: worldCaseFiles
      ? { solved: 'The world case file is ready for ACME review.', failed: 'The world case file remains open.' }
      : cityOpenCase
      ? { solved: CITY_OPEN_CASE_NARRATIVE.solved, failed: CITY_OPEN_CASE_NARRATIVE.failed }
      : skylineNarrative
        ? { solved: skylineNarrative.solved, failed: skylineNarrative.failed }
        : null,
  };
}
