import { CarmenGameLogic, SUSPECTS } from './core/game-logic.js';
import { WorldCaseFilesLogic } from './experiments/world-case-files/world-case-logic.js';
import { createCarmenUI } from './ui/ui.js';
import { CarmenRouteRenderer } from './ui/carmen-route-renderer.js';
import { loadGeoJSON } from '../../js/geojson-loader.js';
import { attachZoomPan } from '../../js/map-zoom-pan.js';
import { saveGameRecord } from '../../js/game-records.js';
import { initConfetti } from '../../js/confetti.js';
import { startMusic, stopMusic, playNarrator, stopNarrator, playVictoryMusic, playFailMusic, playLineupMusic, playAmbient, stopAmbient, playAtmosphere, stopAtmosphere, startClockTicking, stopClockTicking } from './audio/audio-engine.js';
import { chooseNarratorScript } from './content/narrator-script.js';
import { buildCountryEntryMonologue } from './content/country-entry-monologue.js';
import { buildCaseBriefingHint, buildInterpolIntel, pickArrivalAmbientHint, pickFinaleAliasHint } from './content/carmen-hints.js';
import { IMG } from './assets.js';
import {
  getAirportTrafficLabel,
  getFlightDistanceBand,
  getFlightDistanceLabel,
} from './campaigns/skyline-syndicate/flight-clues.js';
import {
  buildSkylineFinalManifestProof,
  getSkylineFinalManifestRedactedSegmentIndex,
} from './campaigns/skyline-syndicate/final-manifest-proof.js';
import { TOTAL_CASES } from './campaign/progression.js';
import {
  CITY_OPEN_CASE_MODE,
  OPEN_CASES_MODE,
  WORLD_CASE_FILES_MODE,
  getMissionLabelForMode,
  getPlayableGameMode,
  getRunConfigForMode,
  isCityOpenCaseMode as isCityOpenCaseGameMode,
  isOpenCasesMode as isOpenCasesGameMode,
  isWorldCaseFilesMode as isWorldCaseFilesGameMode,
  isSkylineSyndicateMode,
  loadCampaignModeData,
} from './campaign/modes.js';
import {
  getMissionHistory, saveMissionResult, getCurrentCase, advanceCase, setCase,
  markCampaignComplete, getUnlockedSuspects, unlockSuspect,
  getTheftHistory, recordTheft, getInterpolViewed, saveInterpolViewed,
  getGameMode, setGameMode, getOpenCaseCount, advanceOpenCaseCount,
  getSkylineCase, advanceSkylineCase, setSkylineCase, getSkylineMissionHistory, saveSkylineMissionResult,
  hasCompletedCampaignOnce,
} from './campaign/persistence.js';

const gameId = 'carmen';

const gameContent = document.getElementById('game-content');
const finalOverlay = document.getElementById('finalOverlay');
const initOverlay = document.getElementById('init-overlay');
const carmenFront = document.getElementById('carmen-front');
const carmenFrontImg = document.getElementById('carmen-front-img');
const carmenHeader = document.getElementById('carmen-header');

const confetti = initConfetti('confetti');
let cityPoiDataRef = null;

function normalizeCityName(value) {
  return String(value || '').trim().toLowerCase();
}

function getCityPoiEntry(country, city = '') {
  if (!cityPoiDataRef) return null;
  const normalizedCity = normalizeCityName(city);
  if (normalizedCity) {
    const cityEntries = cityPoiDataRef.cities?.[country] || null;
    if (cityEntries) {
      for (const [name, entry] of Object.entries(cityEntries)) {
        if (normalizeCityName(name) === normalizedCity) return entry;
        if (normalizeCityName(entry?.city) === normalizedCity) return entry;
      }
    }
  }
  return cityPoiDataRef.capitals?.[country] || null;
}

function isTypingTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(target.tagName);
}


const pageParams = new URLSearchParams(location.search);
const modeParam = pageParams.get('mode');
if (modeParam) setGameMode(modeParam);

function updateFrontImageForMode(mode = getGameMode()) {
  if (!carmenFrontImg) return;
  const skyline = isSkylineSyndicateMode(mode);
  const renaissance = isWorldCaseFilesGameMode(mode);
  if (renaissance) {
    carmenFrontImg.src = IMG.renaissanceFront;
    carmenFrontImg.alt = 'The Renaissance Wave';
  } else if (skyline) {
    carmenFrontImg.src = IMG.skylineFront;
    carmenFrontImg.alt = 'Skyline Syndicate';
  } else {
    carmenFrontImg.src = IMG.carmenFront;
    carmenFrontImg.alt = 'Where in the World?';
  }
}

// Debug: ?case=N URL param jumps directly to that case on load.
const _caseParam = parseInt(pageParams.get('case'), 10);
if (_caseParam >= 1 && _caseParam <= TOTAL_CASES) {
  if (isCityOpenCaseGameMode(getGameMode())) {
    setGameMode(CITY_OPEN_CASE_MODE);
  } else if (isSkylineSyndicateMode(getGameMode())) {
    setSkylineCase(_caseParam);
    setGameMode('skyline_syndicate');
  } else {
    setCase(_caseParam);
    setGameMode('campaign');
  }
} else if (_caseParam === TOTAL_CASES + 1) {
  setGameMode(OPEN_CASES_MODE);
}

updateFrontImageForMode();

// Debug: type "carmen" anywhere to open a case-jump prompt.
(() => {
  const secret = 'carmen';
  let buf = '';
  window.addEventListener('keydown', (e) => {
    if (isTypingTarget(e.target)) return;
    const k = (e.key || '').toLowerCase();
    if (k.length !== 1) { buf = ''; return; }
    buf = (buf + k).slice(-secret.length);
    if (buf === secret) {
      buf = '';
      const activeMode = getGameMode();
      const skyline = isSkylineSyndicateMode(activeMode);
      const cityOpenCase = isCityOpenCaseGameMode(activeMode);
      const defaultJump = isOpenCasesMode()
        ? String(TOTAL_CASES + 1)
        : cityOpenCase
          ? '1'
          : skyline
          ? String(getSkylineCase())
          : String(getCurrentCase());
      const modeLabel = cityOpenCase ? 'City Map Open Case' : skyline ? 'Skyline case' : 'case';
      const answer = window.prompt(`Jump to ${modeLabel} (1–${TOTAL_CASES + 1}, where ${TOTAL_CASES + 1} = Open Cases):`, defaultJump);
      const n = parseInt(answer, 10);
      const nextParams = new URLSearchParams(location.search);
      if (n >= 1 && n <= TOTAL_CASES) {
        if (cityOpenCase) {
          setGameMode(CITY_OPEN_CASE_MODE);
          nextParams.set('mode', CITY_OPEN_CASE_MODE);
          nextParams.delete('case');
        } else if (skyline) {
          setSkylineCase(n);
          setGameMode('skyline_syndicate');
          nextParams.set('mode', 'skyline_syndicate');
          nextParams.set('case', String(n));
        } else {
          setCase(n);
          setGameMode('campaign');
          nextParams.set('mode', 'campaign');
          nextParams.set('case', String(n));
        }
        location.search = nextParams.toString();
      } else if (n === TOTAL_CASES + 1) {
        setGameMode(OPEN_CASES_MODE);
        nextParams.set('mode', OPEN_CASES_MODE);
        nextParams.set('case', String(TOTAL_CASES + 1));
        location.search = nextParams.toString();
      }
    }
  });
})();

// Debug: type "clues" anywhere to toggle forced visual clues.
(() => {
  const secret = 'clues';
  let buf = '';
  window.addEventListener('keydown', (e) => {
    if (isTypingTarget(e.target)) return;
    const k = (e.key || '').toLowerCase();
    if (k.length !== 1) { buf = ''; return; }
    buf = (buf + k).slice(-secret.length);
    if (buf === secret) {
      buf = '';
      window._forceVisualClues = !window._forceVisualClues;
      console.log(`[Carmen] Visual clues ${window._forceVisualClues ? 'ON' : 'OFF'} — airport → scramble, library → outline, market → flag`);
    }
  });
})();

const INTERPOL_COST_HOURS = 3;
const SKYLINE_FINAL_PROOF_PENALTY_HOURS = 4;

let interpolViewedThisGame = new Set();
let interpolMarkedThisCase = new Set();
let activeInterpolSuspectName = null;
let ambientHintStopsShown = new Set();
let finaleEvidenceStopsShown = new Set();
let lastArrivalAtmosphereKind = null;

const ARRIVAL_ATMOSPHERE_RULES = [
  { limit: 16, key: 'rain1', kind: 'rain' },
  { limit: 30, key: 'rain2', kind: 'rain' },
  { limit: 36, key: 'siren1', kind: 'siren' },
  { limit: 40, key: 'siren2', kind: 'siren' },
];

function hashSeed(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function chooseArrivalAtmosphere(country, stop) {
  const roll = hashSeed(`${logic?.mode}:${logic?.caseNumber}:${stop}:${country}`) % 100;
  const match = ARRIVAL_ATMOSPHERE_RULES.find(rule => roll < rule.limit);
  if (!match) {
    lastArrivalAtmosphereKind = null;
    return null;
  }
  if (match.kind === 'siren' && lastArrivalAtmosphereKind === 'siren') {
    lastArrivalAtmosphereKind = null;
    return null;
  }
  lastArrivalAtmosphereKind = match.kind;
  return match;
}

// Wait for data.js
while (!window.DATA) await new Promise(r => setTimeout(r, 50));

// Load all data in parallel
const [worldData, factsData, heritageData, riversData, mountainsData, empiresData, portraitProfileData, campaignModeData, cityMapPoiData, worldCaseFilesData, worldCulturalPlacesData, worldCulturalObjectsData, worldCandidateIndexData] = await Promise.all([
  loadGeoJSON('data/ne_10m_admin_0_countries_route.geojson.gz'),
  fetch('data/country-facts.json').then(r => r.json()),
  fetch('data/heritage-sites.json').then(r => r.json()),
  fetch('data/rivers.json').then(r => r.json()),
  fetch('data/mountain-ranges.json').then(r => r.json()),
  fetch('data/empires.json').then(r => r.json()),
  fetch('carmen/villains_with_face_profiles.json').then(r => r.json()),
  loadCampaignModeData(),
  fetch('data/carmen-city-map-pois.json').then(r => r.ok ? r.json() : null).catch(() => null),
  fetch('data/carmen-world-case-files.json').then(r => r.ok ? r.json() : null).catch(() => null),
  fetch('data/carmen-world-cultural-places.json').then(r => r.ok ? r.json() : null).catch(() => null),
  fetch('data/carmen-world-cultural-objects.json').then(r => r.ok ? r.json() : null).catch(() => null),
  fetch('data/carmen-world-candidate-index.json').then(r => r.ok ? r.json() : null).catch(() => null),
]);
cityPoiDataRef = cityMapPoiData;

const playableMode = getPlayableGameMode(getGameMode(), campaignModeData);
if (playableMode !== getGameMode()) setGameMode(playableMode);
updateFrontImageForMode(playableMode);

const portraitProfileByName = new Map(
  portraitProfileData.map((entry) => [entry.name, entry])
);

SUSPECTS.forEach((suspect) => {
  const portraitData = portraitProfileByName.get(suspect.name);
  if (!portraitData) return;
  if (portraitData.faceProfile) suspect.faceProfile = portraitData.faceProfile;
  if (!suspect.img && portraitData.img) suspect.img = portraitData.img;
});

// Build flag code lookup
const flagCodes = Object.fromEntries(
  window.ALL_COUNTRIES.map(c => [c.country, c.flagCode])
);

// Build capital lookup
const capitalOf = Object.fromEntries(
  window.DATA.map(c => [c.country, c.capitals?.[0] || ''])
);

const capitalAirportByCountry = Object.fromEntries(
  (campaignModeData.skylineRouteData?.gateways || [])
    .filter(gateway => gateway?.country && Number.isFinite(gateway?.airport?.lat) && Number.isFinite(gateway?.airport?.lon))
    .map(gateway => [gateway.country, {
      name: gateway.airport.name,
      iata: gateway.airport.iata || gateway.airport.ident || '',
      lat: gateway.airport.lat,
      lon: gateway.airport.lon,
    }])
);

// Data loaded — hide the loading text, show tap hint
if (carmenFront) {
  const loadingText = carmenFront.querySelector('.carmen-init-loading');
  if (loadingText) loadingText.style.display = 'none';
  const tapHint = document.createElement('div');
  tapHint.className = 'carmen-tap-hint carmen-front-tap';
  tapHint.textContent = 'Tap to start';
  carmenFront.appendChild(tapHint);
}

/** Wait for a click on an element. Resolves on first click. */
function waitForClick(el) {
  return new Promise(resolve => {
    el.addEventListener('click', () => {
      const hint = el.querySelector('.carmen-front-tap');
      if (hint) hint.remove();
      resolve();
    }, { once: true });
  });
}

// Create UI (hidden until briefing is dismissed)
gameContent.style.display = 'none';
const ui = createCarmenUI(gameContent, flagCodes);

// Share world data with UI for visual clues (outlines)
ui.setWorldData(worldData);

// Create map renderer
let renderer = new CarmenRouteRenderer(ui.mapSvg, worldData, {
  airportByCountry: capitalAirportByCountry,
});
let baseViewBox = { x: 0, y: 0, w: 600, h: 320 };
attachZoomPan(ui.mapSvg, () => baseViewBox);

let logic;
let worldCase = null;
let isFirstGame = true;

function isOpenCasesMode(mode = logic?.mode || getGameMode()) {
  return isOpenCasesGameMode(mode);
}

function isSkylineMode(mode = logic?.mode || getGameMode()) {
  return isSkylineSyndicateMode(mode);
}

function isCityOpenCaseMode(mode = logic?.mode || getGameMode()) {
  return isCityOpenCaseGameMode(mode);
}

function isWorldCaseFilesMode(mode = logic?.mode || worldCase?.mode || getGameMode()) {
  return isWorldCaseFilesGameMode(mode);
}

function isCrimsonCampaignMode(mode = logic?.mode || getGameMode()) {
  return !isOpenCasesMode(mode) && !isSkylineMode(mode) && !isCityOpenCaseMode(mode) && !isWorldCaseFilesMode(mode);
}

function getActiveMissionHistory(mode = logic?.mode || getGameMode()) {
  if (isCityOpenCaseMode(mode) || isWorldCaseFilesMode(mode)) return [];
  return isSkylineMode(mode) ? getSkylineMissionHistory() : getMissionHistory();
}

function saveActiveMissionResult(result, mode = logic?.mode || getGameMode()) {
  if (isCityOpenCaseMode(mode) || isWorldCaseFilesMode(mode)) return;
  if (isSkylineMode(mode)) saveSkylineMissionResult(result);
  else saveMissionResult(result);
}

function getDisplayedOpenCaseNumber() {
  return getOpenCaseCount() + 1;
}

function getEffectiveInterpolViewed() {
  const viewed = new Set([...interpolViewedThisGame, ...getInterpolViewed()]);
  if (isSkylineMode() && hasCompletedCampaignOnce()) {
    for (const suspect of SUSPECTS) viewed.add(suspect.name);
  }
  return viewed;
}

function getCurrentRunConfig() {
  const mode = getGameMode();
  return getRunConfigForMode({
    mode,
    currentCase: getCurrentCase(),
    skylineCase: getSkylineCase(),
    openCaseNumber: getDisplayedOpenCaseNumber(),
    totalCases: TOTAL_CASES,
    unlockedSuspects: getUnlockedSuspects(),
    modeData: campaignModeData,
  });
}

function getMissionLabel() {
  const mode = logic?.mode || worldCase?.mode || getGameMode();
  if (isWorldCaseFilesMode(mode)) {
    return getMissionLabelForMode(mode, 1);
  }
  if (isSkylineMode(mode)) {
    const caseNumber = logic?.caseNumber || getSkylineCase();
    const totalCases = logic?.totalCases || TOTAL_CASES;
    return `Skyline Case ${caseNumber} / ${totalCases}`;
  }
  if (isCityOpenCaseMode(mode)) {
    return getMissionLabelForMode(mode, 1);
  }
  if (!isOpenCasesMode(mode)) {
    const caseNumber = logic?.caseNumber || getCurrentCase();
    const totalCases = logic?.totalCases || TOTAL_CASES;
    return `The Crimson Trail ${caseNumber} / ${totalCases}`;
  }
  return getMissionLabelForMode(mode, getDisplayedOpenCaseNumber());
}

function getVisibleInterpolSuspects() {
  const unlocked = getUnlockedSuspects();
  const allViewed = getEffectiveInterpolViewed();
  const activeArchive = logic?.getInterpolCandidates?.() || [];
  const finaleAlias = logic?.getFinaleAlias?.();
  const source = finaleAlias
    ? [...SUSPECTS, finaleAlias]
    : SUSPECTS.filter(s => (isOpenCasesMode() || isCityOpenCaseMode() || isWorldCaseFilesMode()) ? s.name !== 'Carmen Sandiego' : true);

  if (isCrimsonCampaignMode() && logic?.campaignPhase === 'finale') {
    return source
      .slice()
      .sort((a, b) => {
        if (a.name === 'Carmen Sandiego') return 1;
        if (b.name === 'Carmen Sandiego') return -1;
        return a.name.localeCompare(b.name);
      });
  }

  const visibleNames = new Set([
    ...activeArchive.map(s => s.name),
    ...allViewed,
    ...unlocked,
  ]);
  if (!isOpenCasesMode()) {
    visibleNames.add('Carmen Sandiego');
  }

  return source
    .filter(s => visibleNames.has(s.name))
    .sort((a, b) => {
      if (a.name === 'Carmen Sandiego') return 1;
      if (b.name === 'Carmen Sandiego') return -1;
      return a.name.localeCompare(b.name);
    });
}

function getInterpolStatus(suspectName) {
  if (suspectName === 'Carmen Sandiego' && isSkylineMode() && hasCompletedCampaignOnce()) {
    return 'ARCHIVE CLEARED';
  }
  if (!getUnlockedSuspects().has(suspectName)) return 'ACTIVE';
  return isOpenCasesMode() ? 'PREVIOUSLY ARRESTED' : 'IN CUSTODY';
}

function getInterpolProfilePhase(suspectName) {
  if (suspectName === 'Carmen Sandiego' && isSkylineMode() && hasCompletedCampaignOnce()) {
    return 'archive_cleared';
  }
  return logic?.campaignPhase;
}

function refreshInterpolList() {
  const unlocked = getUnlockedSuspects();
  const allViewed = getEffectiveInterpolViewed();
  const sortedSuspects = getVisibleInterpolSuspects();
  ui.showInterpolList(sortedSuspects, unlocked, allViewed, interpolMarkedThisCase, (suspect) => {
    activeInterpolSuspectName = suspect.name;
    // All suspects with photos cost time to view — including Carmen.
    const hasPhoto = !!suspect.img;
    const everViewed = getInterpolViewed().has(suspect.name);
    const inCustody = unlocked.has(suspect.name);
    const alreadyViewed = interpolViewedThisGame.has(suspect.name) || everViewed || inCustody;
    const status = getInterpolStatus(suspect.name);

    if (hasPhoto && !alreadyViewed) {
      logic.spendTime(INTERPOL_COST_HOURS);
      updateClock();
      if (checkTimeExpired()) return;
      // Wait for clock animation to finish before revealing profile
      const animDuration = INTERPOL_COST_HOURS * 120 + 100;
      interpolViewedThisGame.add(suspect.name);
      saveInterpolViewed(suspect.name);
      setTimeout(() => {
        refreshInterpolList();
        const thefts = getTheftHistory()[suspect.name] || [];
        const intel = buildInterpolProfileIntel(suspect, thefts);
        ui.showInterpolProfile(
          suspect,
          thefts,
          status,
          getInterpolProfilePhase(suspect.name),
          interpolMarkedThisCase.has(suspect.name),
          toggleInterpolMark,
          intel,
        );
      }, animDuration);
      return;
    }
    interpolViewedThisGame.add(suspect.name);
    refreshInterpolList(); // update cost labels

    const thefts = getTheftHistory()[suspect.name] || [];
    const intel = buildInterpolProfileIntel(suspect, thefts);
    ui.showInterpolProfile(
      suspect,
      thefts,
      status,
      getInterpolProfilePhase(suspect.name),
      interpolMarkedThisCase.has(suspect.name),
      toggleInterpolMark,
      intel,
    );
  });
}

function toggleInterpolMark(suspectName) {
  if (interpolMarkedThisCase.has(suspectName)) interpolMarkedThisCase.delete(suspectName);
  else interpolMarkedThisCase.add(suspectName);

  refreshInterpolList();

  if (!activeInterpolSuspectName || activeInterpolSuspectName !== suspectName) return;

  const suspect = getVisibleInterpolSuspects().find(s => s.name === suspectName);
  if (!suspect) return;

  const status = getInterpolStatus(suspect.name);
  const thefts = getTheftHistory()[suspect.name] || [];
  const intel = buildInterpolProfileIntel(suspect, thefts);
  ui.showInterpolProfile(
    suspect,
    thefts,
    status,
    getInterpolProfilePhase(suspect.name),
    interpolMarkedThisCase.has(suspect.name),
    toggleInterpolMark,
    intel,
  );
}

function getCountryEntryMonologue(country) {
  const countryData = logic?.countryMap?.[country] || {};
  return buildCountryEntryMonologue(country, countryData);
}

function buildInterpolProfileIntel(suspect, thefts = []) {
  if (suspect?.isFinaleAlias) {
    return {
      anomaly: 'This file appeared intact and professionally indexed far too late in the campaign. ACME does not trust paperwork this tidy.',
      irregularity: 'Origin, border stamps, and prior sightings all agree a little too neatly. The identity reads like paperwork written to satisfy paperwork.',
      network: 'Border records, witness cadence, and operational style place this identity uncomfortably close to Carmen\'s known pattern.',
      pattern: 'The subject matches Carmen\'s preference for theatrical exits, precise geography, and a profile that feels assembled rather than lived in.',
    };
  }
  return buildInterpolIntel(
    suspect,
    getInterpolProfilePhase(suspect.name),
    thefts,
    getActiveMissionHistory(),
    getTheftHistory(),
  );
}

async function handleEndChoice(choice, wasSuccess) {
  if (choice === 'quit' || choice === 'play') {
    stopAtmosphere();
    location.href = 'play.html?game=route';
    return;
  }

  if (choice === OPEN_CASES_MODE) {
    stopAmbient();
    stopAtmosphere();
    stopNarrator();
    stopMusic();
    setGameMode(OPEN_CASES_MODE);
    isFirstGame = false;
    await startGame();
    return;
  }

  if (isSkylineMode()) {
    stopAmbient();
    stopAtmosphere();
    stopNarrator();
    stopMusic();
    isFirstGame = false;
    await startGame();
    return;
  }

  if (isOpenCasesMode() || isCityOpenCaseMode() || isWorldCaseFilesMode()) {
    stopAmbient();
    stopAtmosphere();
    stopNarrator();
    stopMusic();
    isFirstGame = false;
    await startGame();
    return;
  }

  // Continue — show front image with transition narrator + subtitles
  stopAtmosphere();
  stopMusic();
  gameContent.style.display = 'none';
  if (carmenHeader) carmenHeader.style.display = 'none';
  if (carmenFront) carmenFront.style.display = '';

  startMusic();
  await new Promise(r => setTimeout(r, 1500));

  const caseJustPlayed = logic?.caseNumber || getCurrentCase();
  const nextCase = wasSuccess ? caseJustPlayed + 1 : caseJustPlayed;
  const { file: narratorFile, cues } = chooseNarratorScript(wasSuccess, nextCase);

  // Create subtitle element
  const subtitle = document.createElement('div');
  subtitle.className = 'carmen-subtitle';
  carmenFront.appendChild(subtitle);

  const cueTimeouts = [];
  for (const [time, text] of cues) {
    cueTimeouts.push(setTimeout(() => {
      subtitle.style.opacity = '0';
      setTimeout(() => {
        subtitle.textContent = text;
        subtitle.style.opacity = '1';
      }, 300);
    }, time * 1000));
  }

  // Play narrator (skippable)
  await Promise.race([
    playNarrator(narratorFile),
    waitForClick(carmenFront),
  ]);
  stopNarrator();

  // Clean up subtitles
  cueTimeouts.forEach(t => clearTimeout(t));
  subtitle.remove();

  isFirstGame = false;
  startGame();
}

async function startGame() {
  finalOverlay.style.display = 'none';
  const runConfig = getCurrentRunConfig();

  if (runConfig.isWorldCaseFiles) {
    await startWorldCaseFiles(runConfig);
    return;
  }

  logic = new CarmenGameLogic({
    countries: window.DATA,
    facts: factsData,
    heritageSites: heritageData,
    rivers: riversData,
    mountains: mountainsData,
    empires: empiresData,
    caseNumber: runConfig.caseNumber,
    totalCases: runConfig.totalCases || TOTAL_CASES,
    excludedSuspects: runConfig.excludedSuspects,
    mode: runConfig.mode,
    phaseOverride: runConfig.phaseOverride,
    configPhase: runConfig.configPhase,
    routeProvider: runConfig.routeProvider,
  });

  const intro = logic.start();

  if (isFirstGame) {
    // Wait for user click on front image to unlock audio
    await waitForClick(carmenFront);

    // Start background music, then narrator with subtitles (all skippable by tap)
    startMusic();

    // Brief music-only intro (skippable)
    let skipped = false;
    await Promise.race([
      new Promise(r => setTimeout(r, 2500)),
      waitForClick(carmenFront).then(() => { skipped = true; }),
    ]);

    if (!skipped && !runConfig.isOpenCases && !runConfig.isSkylineSyndicate) {
      // Play narrator for current case with subtitles
      const { file: introFile, cues } = chooseNarratorScript(true, getCurrentCase());
      const subtitle = document.createElement('div');
      subtitle.className = 'carmen-subtitle';
      carmenFront.appendChild(subtitle);

      const cueTimeouts = [];
      for (const [time, text] of cues) {
        cueTimeouts.push(setTimeout(() => {
          subtitle.style.opacity = '0';
          setTimeout(() => {
            subtitle.textContent = text;
            subtitle.style.opacity = '1';
          }, 300);
        }, time * 1000));
      }

      // Wait for narrator to finish OR user tap to skip
      await Promise.race([
        playNarrator(introFile),
        waitForClick(carmenFront),
      ]);
      stopNarrator();

      // Clean up subtitles
      cueTimeouts.forEach(t => clearTimeout(t));
      subtitle.remove();
    }
  }

  // Now show the case briefing overlay
  const totalHours = logic.getTimeState().totalHours;
  let briefingHint = '';
  if (!runConfig.isOpenCases && !runConfig.isCityOpenCase && !runConfig.isSkylineSyndicate) {
    briefingHint = buildCaseBriefingHint(intro.campaignPhase, intro.caseNumber, getActiveMissionHistory(logic.mode));
  }
  if (!runConfig.isCityOpenCase && logic.routeProvider?.getBriefingHint) {
    briefingHint = [briefingHint, logic.routeProvider.getBriefingHint(logic)].filter(Boolean).join(' ');
  }
  if (runConfig.briefingNote) {
    briefingHint = [briefingHint, runConfig.briefingNote].filter(Boolean).join(' ');
  }
  if (isCrimsonCampaignMode(logic.mode) && intro.campaignPhase === 'finale') {
    briefingHint = `${briefingHint} ACME believes Carmen is moving under a fresh alias hidden somewhere in the active files.`;
  }
  await ui.showCaseBriefing(
    intro.artifact,
    intro.startCountry,
    totalHours,
    intro.caseNumber,
    intro.totalCases,
    intro.campaignPhase,
    briefingHint,
    {
      mode: logic.mode,
      openCaseNumber: intro.caseNumber,
      missionCopy: runConfig.briefingCopy,
      caseTitle: runConfig.caseTitle,
    }
  );

  // Hide the front image, show the header and game
  if (carmenFront) carmenFront.style.display = 'none';
  if (carmenHeader) carmenHeader.style.display = '';
  gameContent.style.display = '';

  // Draw starting country on map, include neighbors in viewBox
  drawMap(intro.progress.route, intro.neighbors);

  // Update UI — thief identity unknown
  ui.showIntro('A mysterious thief', intro.artifact, intro.startCountry, { mode: logic.mode });
  ui.updateMissions(getActiveMissionHistory(logic.mode), true, logic.caseNumber, logic.totalCases, getMissionLabel());
  ui.updateScore(intro.progress.score);
  ui.updateProgress(intro.progress.stop, intro.progress.totalStops);
  updateClock();

  const introNarratorLine = getCountryEntryMonologue(intro.startCountry);
  if (introNarratorLine) {
    setTimeout(() => {
      ui.showNarratorCaption(introNarratorLine);
    }, 220);
  }

  // Reset dossier and interpol for new game
  ui.setManifestMode(isSkylineMode(logic.mode), {
    caseNumber: logic.caseNumber,
    totalCases: logic.totalCases,
  });
  ui.resetManifestBoard();
  if (logic.routePatterns?.length) {
    ui.setManifestPatterns(logic.routePatterns);
  }
  ui.resetDossier();
  interpolViewedThisGame = new Set();
  interpolMarkedThisCase = new Set();
  activeInterpolSuspectName = null;
  ambientHintStopsShown = new Set();
  finaleEvidenceStopsShown = new Set();
  lastArrivalAtmosphereKind = null;
  refreshInterpolList();

  // Clear old clues and witness reports, then show investigation locations
  ui.clearClues();
  ui.clearWitnessReports();
  playerPosition = intro.startCountry;
  showInvestigationLocations();
  showNeighborsOnMap(intro.neighbors);
}

let activeNeighborChoices = null;
let playerPosition = null; // tracks where the player physically is

function drawMap(visitedCountries, neighbors = []) {
  const list = visitedCountries.map((country, i) => ({
    country,
    color: i === 0 ? 'start' : i === visitedCountries.length - 1 ? 'end' : 'path',
  }));
  // Current position always shown as 'end' color (orange)
  if (list.length > 0) list[list.length - 1].color = 'end';
  if (list.length > 1) list[0].color = 'start';

  renderer.drawRoute(list, neighbors);

  // Update base viewBox for zoom/pan
  const vb = ui.mapSvg.viewBox.baseVal;
  baseViewBox = { x: vb.x, y: vb.y, w: vb.width, h: vb.height };
}

function showNeighborsOnMap(neighbors) {
  if (activeNeighborChoices) {
    activeNeighborChoices.remove();
    activeNeighborChoices = null;
  }
  activeNeighborChoices = renderer.drawNeighborChoices(neighbors, handleGuess);
}

function updateClock() {
  const ts = logic.getTimeState();
  ui.updateClock(ts.hoursRemaining, ts.totalHours);
}

function checkTimeExpired() {
  if (logic.timeExpired) {
    if (activeNeighborChoices) activeNeighborChoices.disableAll();
    ui.hideLocations();
    setTimeout(async () => {
      stopAmbient();
      stopAtmosphere();
      stopMusic();
      stopNarrator();
      playFailMusic();
      const results = logic.getResults();
      saveGameRecord(gameId, results.score, results.time);
      saveActiveMissionResult('fail');
      if (isOpenCasesMode()) advanceOpenCaseCount();
      const choice = await ui.showCaseFailed(
        logic.suspect.name,
        results.score,
        isCityOpenCaseMode()
          ? {
              continueLabel: 'Replay Experiment →',
              failedDetail: getCurrentRunConfig().closingCopy?.failed,
            }
          : isOpenCasesMode()
          ? { continueLabel: 'Next Open Case →' }
          : isSkylineMode()
            ? {
                continueLabel: 'Retry Skyline Case →',
                failedDetail: getCurrentRunConfig().closingCopy?.failed,
              }
            : null,
      );
      await handleEndChoice(choice, false);
    }, 500);
    return true;
  }
  return false;
}

let activeWorldCandidateLayer = null;
let activeWorldCityLayer = null;
let worldCaseHintMode = 'off';
let worldCaseHintIndex = 0;
let worldCaseHintDetailsOpen = false;
let worldCaseInspectCountry = '';
let worldCaseHoveredCity = '';
let worldCaseSelectedContext = { type: 'scene' };
let worldCaseTravelSelection = { mode: 'country', country: '', cities: [], selectedCity: '' };
const worldCaseLocationClueMemory = new Map();

function getWorldCaseData() {
  const cases = worldCaseFilesData?.cases || [];
  if (!cases.length) return null;
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('case') || params.get('worldCase');
  if (requested) {
    return cases.find(item => item.id === requested) || cases[0];
  }
  const caseIndex = Number(params.get('caseIndex') || params.get('worldCaseIndex'));
  if (Number.isInteger(caseIndex) && caseIndex >= 1 && caseIndex <= cases.length) {
    return cases[caseIndex - 1];
  }
  return cases[0];
}

function getWorldCaseTravelCities(country) {
  if (!country || !cityPoiDataRef) return [];
  const seen = new Set();
  const cities = [];
  const addCity = (entry, source = 'poi') => {
    const city = String(entry?.city || '').trim();
    const lat = Number(entry?.lat);
    const lon = Number(entry?.lon);
    if (!city || !Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const key = normalizeCityName(city);
    if (seen.has(key)) return;
    seen.add(key);
    cities.push({ country, city, lat, lon, source });
  };
  addCity(cityPoiDataRef.capitals?.[country], 'capital');
  for (const entry of Object.values(cityPoiDataRef.cities?.[country] || {})) {
    addCity(entry, 'poi');
  }
  for (const stop of worldCase?.caseData?.route || []) {
    if (normalizeCityName(stop.country) === normalizeCityName(country)) {
      addCity(stop, 'case');
    }
  }
  return cities.sort((a, b) => a.city.localeCompare(b.city));
}

function setWorldCaseTravelSelection(country = '', options = {}) {
  if (!country) {
    worldCaseTravelSelection = { mode: 'country', country: '', cities: [], selectedCity: '' };
    worldCaseInspectCountry = '';
    worldCaseHoveredCity = '';
    return;
  }
  worldCaseTravelSelection = {
    mode: 'city',
    country,
    cities: getWorldCaseTravelCities(country),
    selectedCity: options.selectedCity || '',
  };
  worldCaseInspectCountry = country;
  worldCaseHoveredCity = '';
}

function drawWorldCaseMap() {
  if (!worldCase) return;
  const candidates = worldCase.analyzeCandidates();
  const boardState = worldCase.getBoardState();
  const fieldCountry = worldCase.getCurrentFieldLocation?.()?.country || worldCase.currentCountry;
  const highlightedVisited = worldCase.visited.map((country, index) => ({
    country,
    color: index === 0 ? 'start' : country === fieldCountry ? 'end' : 'path',
  }));
  renderer.drawRoute(highlightedVisited, []);
  ui.mapSvg.setAttribute('viewBox', '0 0 600 320');
  baseViewBox = { x: 0, y: 0, w: 600, h: 320 };
  if (activeWorldCandidateLayer) {
    activeWorldCandidateLayer.remove();
    activeWorldCandidateLayer = null;
  }
  if (activeWorldCityLayer) {
    activeWorldCityLayer.remove();
    activeWorldCityLayer = null;
  }
  activeWorldCandidateLayer = renderer.drawWorldCandidates(candidates, (country, candidate) => {
    setWorldCaseTravelSelection(country);
    activeWorldCandidateLayer?.setSelected?.(country);
    drawWorldCaseMap();
  }, {
    hintsEnabled: worldCaseHintMode !== 'off',
    selectedCountry: worldCaseInspectCountry,
  });
  if (worldCaseTravelSelection.mode === 'city' && worldCaseTravelSelection.country) {
    const focusedView = renderer.fitCountryView(worldCaseTravelSelection.country);
    baseViewBox = focusedView;
    const currentFieldCity = worldCase.getCurrentFieldLocation?.()?.country === worldCaseTravelSelection.country
      ? worldCase.getCurrentFieldLocation?.()?.city || ''
      : '';
    activeWorldCityLayer = renderer.drawWorldCityChoices(
      worldCaseTravelSelection.country,
      worldCaseTravelSelection.cities,
      (city) => handleWorldTravel({ country: worldCaseTravelSelection.country, city }),
      {
        selectedCity: worldCaseTravelSelection.selectedCity,
        currentCity: currentFieldCity,
        onHoverChange: (cityName = '') => {
          if (worldCaseHoveredCity === cityName) return;
          worldCaseHoveredCity = cityName;
          ui.showWorldTravelDesk(candidates, handleWorldTravel, null, {
            switchToTravel: false,
            summary: boardState.summary,
            atlasHints: boardState.atlasHints,
            localTrail: boardState.localTrail,
            targetStop: worldCase.targetRouteStop,
            targetTravelLabel: worldCase.targetRouteStop ? worldCase.getTravelLabel(worldCase.targetRouteStop.country) : null,
            hintMode: worldCaseHintMode,
            hintIndex: worldCaseHintIndex,
            revealHintDetails: worldCaseHintDetailsOpen,
            inspectCountry: worldCaseInspectCountry,
            currentCountry: fieldCountry,
            citySelection: worldCaseTravelSelection.mode === 'city' ? worldCaseTravelSelection : null,
            hoveredCity: worldCaseHoveredCity,
            onToggleHints: () => {
              worldCaseHintMode = worldCaseHintMode === 'off' ? 'subtle' : 'off';
              drawWorldCaseMap();
            },
            onCycleHint: () => {
              const hintCount = boardState.atlasHints?.length || 0;
              if (!hintCount) return;
              worldCaseHintIndex = (worldCaseHintIndex + 1) % hintCount;
              drawWorldCaseMap();
            },
            onToggleHintDetails: () => {
              worldCaseHintDetailsOpen = !worldCaseHintDetailsOpen;
              drawWorldCaseMap();
            },
            onCloseInspect: () => {
              setWorldCaseTravelSelection('');
              drawWorldCaseMap();
            },
          });
        },
      }
    );
  } else {
    ui.mapSvg.setAttribute('viewBox', '0 0 600 320');
    baseViewBox = { x: 0, y: 0, w: 600, h: 320 };
    worldCaseHoveredCity = '';
  }
  ui.showWorldTravelDesk(candidates, handleWorldTravel, null, {
    switchToTravel: false,
    summary: boardState.summary,
    atlasHints: boardState.atlasHints,
    localTrail: boardState.localTrail,
    targetStop: worldCase.targetRouteStop,
    targetTravelLabel: worldCase.targetRouteStop ? worldCase.getTravelLabel(worldCase.targetRouteStop.country) : null,
    hintMode: worldCaseHintMode,
    hintIndex: worldCaseHintIndex,
    revealHintDetails: worldCaseHintDetailsOpen,
    inspectCountry: worldCaseInspectCountry,
    currentCountry: fieldCountry,
    citySelection: worldCaseTravelSelection.mode === 'city' ? worldCaseTravelSelection : null,
    hoveredCity: worldCaseHoveredCity,
    onToggleHints: () => {
      worldCaseHintMode = worldCaseHintMode === 'off' ? 'subtle' : 'off';
      drawWorldCaseMap();
    },
    onCycleHint: () => {
      const hintCount = boardState.atlasHints?.length || 0;
      if (!hintCount) return;
      worldCaseHintIndex = (worldCaseHintIndex + 1) % hintCount;
      drawWorldCaseMap();
    },
    onToggleHintDetails: () => {
      worldCaseHintDetailsOpen = !worldCaseHintDetailsOpen;
      drawWorldCaseMap();
    },
    onCloseInspect: () => {
      setWorldCaseTravelSelection('');
      drawWorldCaseMap();
    },
  });
}

function refreshWorldCaseUi(focusTravel = false) {
  if (!worldCase) return;
  const state = worldCase.getBoardState();
  const fieldCountry = worldCase.getCurrentFieldLocation?.()?.country || worldCase.currentCountry;
  ui.updateMissions([], true, 1, 1, getMissionLabel());
  ui.updateScore(Math.max(0, 5000 - (worldCase.evidence.length * 75) - (worldCase.deadEnds.length * 250)));
  ui.setWorldCaseStatus(state.statusBar);
  ui.updateWorldCaseArtifact(state);
  ui.updateWorldCaseBoard(state);
  ui.showWorldCaseLocations(state.sceneActions || [], handleWorldInvestigation, state, buildWorldCaseCityMapOptions());
  drawWorldCaseMap();
  if (focusTravel) {
    const candidates = worldCase.analyzeCandidates();
    ui.showWorldTravelDesk(candidates, handleWorldTravel, null, {
      switchToTravel: true,
      summary: state.summary,
      atlasHints: state.atlasHints,
      localTrail: state.localTrail,
      targetStop: worldCase.targetRouteStop,
      targetTravelLabel: worldCase.targetRouteStop ? worldCase.getTravelLabel(worldCase.targetRouteStop.country) : null,
      hintMode: worldCaseHintMode,
      hintIndex: worldCaseHintIndex,
      revealHintDetails: worldCaseHintDetailsOpen,
      inspectCountry: worldCaseInspectCountry,
      currentCountry: fieldCountry,
      citySelection: worldCaseTravelSelection.mode === 'city' ? worldCaseTravelSelection : null,
      hoveredCity: worldCaseHoveredCity,
      onToggleHints: () => {
        worldCaseHintMode = worldCaseHintMode === 'off' ? 'subtle' : 'off';
        drawWorldCaseMap();
      },
      onCycleHint: () => {
        const hintCount = state.atlasHints?.length || 0;
        if (!hintCount) return;
        worldCaseHintIndex = (worldCaseHintIndex + 1) % hintCount;
        drawWorldCaseMap();
      },
      onToggleHintDetails: () => {
        worldCaseHintDetailsOpen = !worldCaseHintDetailsOpen;
        drawWorldCaseMap();
      },
      onCloseInspect: () => {
        setWorldCaseTravelSelection('');
        drawWorldCaseMap();
      },
    });
  }
}

function buildWorldCaseCityMapOptions() {
  if (!worldCase) return null;
  const fieldLocation = worldCase.getCurrentFieldLocation?.() || null;
  const country = fieldLocation?.country || worldCase.currentCountry;
  const displayScene = worldCase.getDisplaySceneContext?.()?.scene || null;
  const genericFieldStop = !!(fieldLocation?.kind && fieldLocation.kind !== 'scene' && !displayScene);
  const scene = genericFieldStop ? null : (displayScene || worldCase.getSceneForCountry(country));
  const cityPoiEntry = getCityPoiEntry(country, scene?.city);
  const gateway = campaignModeData.skylineRouteProvider?.gatewayByCountry?.[country] || null;
  const sceneLat = Number(genericFieldStop ? fieldLocation?.lat : scene?.lat);
  const sceneLon = Number(genericFieldStop ? fieldLocation?.lon : scene?.lon);
  const capitalLat = Number(gateway?.capitalLat ?? cityPoiEntry?.lat);
  const capitalLon = Number(gateway?.capitalLon ?? cityPoiEntry?.lon);
  const centerLat = Number.isFinite(sceneLat) ? sceneLat : capitalLat;
  const centerLon = Number.isFinite(sceneLon) ? sceneLon : capitalLon;
  if (!Number.isFinite(centerLat) || !Number.isFinite(centerLon)) return null;
  const airportLat = Number(gateway?.airport?.lat);
  const airportLon = Number(gateway?.airport?.lon);
  const usingNonCapitalScene = Number.isFinite(sceneLat) &&
    Number.isFinite(sceneLon) &&
    scene?.city &&
    cityPoiEntry?.capital &&
    normalizeCityName(scene.city) !== normalizeCityName(cityPoiEntry.capital);
  const sceneFallbackPois = usingNonCapitalScene
    ? {
        hotel: {
          name: `${scene.city} field hotel`,
          lat: sceneLat + 0.006,
          lon: sceneLon - 0.01,
          confidence: 'scene-fallback',
        },
        market: {
          name: `${scene.city} market quarter`,
          lat: sceneLat + 0.004,
          lon: sceneLon + 0.012,
          confidence: 'scene-fallback',
        },
        library: {
          name: `${scene.city} research archive`,
          lat: sceneLat - 0.008,
          lon: sceneLon - 0.006,
          confidence: 'scene-fallback',
        },
        embassy: {
          name: `${scene.city} consular desk`,
          lat: sceneLat - 0.006,
          lon: sceneLon + 0.01,
          confidence: 'scene-fallback',
        },
      }
    : null;
  const scenePois = scene?.pois || null;
  return {
    cityMap: true,
    showHeader: false,
    contextKey: `world-case::${country}::${scene?.scene || ''}::${scene?.city || ''}::${centerLat.toFixed(4)},${centerLon.toFixed(4)}`,
    targetOsmZoom: 15,
    fitMaxDistanceDegrees: 0.05,
    country,
    capital: (genericFieldStop ? fieldLocation?.city : scene?.city) || gateway?.capital || cityPoiEntry?.capital || capitalOf[country] || country,
    center: { lat: centerLat, lon: centerLon },
    scene: !genericFieldStop && Number.isFinite(sceneLat) && Number.isFinite(sceneLon)
      ? {
          name: scene.scene ? `${scene.scene}, ${scene.city || country}` : scene.city || country,
          emoji: '◆',
          lat: sceneLat,
          lon: sceneLon,
        }
      : null,
      airport: Number.isFinite(airportLat) && Number.isFinite(airportLon)
      ? {
          name: gateway.airport.name,
          iata: gateway.airport.iata || gateway.airport.ident || '',
          lat: airportLat,
          lon: airportLon,
        }
      : null,
    pois: {
      ...(cityPoiEntry?.pois || {}),
      ...(sceneFallbackPois || {}),
      ...(scenePois || {}),
    },
    mapLocations: worldCase.getMapLocations(),
    investigatedIds: worldCase.getInvestigatedLocationIds(),
    selectedContext: worldCaseSelectedContext,
    onSceneFocus: () => {
      worldCaseSelectedContext = { type: 'scene' };
      ui.clearClues();
      refreshWorldCaseUi(false);
    },
    onLocationSelect: handleWorldLocationSelection,
    onHotspotClick: handleWorldHotspotClick,
    onPuzzleSolved: handleWorldPuzzleSolved,
  };
}

function handleWorldHotspotClick(image, hotspot) {
  if (!worldCase || !image || !hotspot) return null;
  const result = worldCase.observeImageHotspot(image.id, hotspot.id);
  if (result.result === 'wrong') {
    const wrongText = hotspot?.wrongText || 'Not the right detail. The page logs the misstep.';
    ui.showNarratorCaption(wrongText, 4500);
    refreshWorldCaseUi(false);
    return 'wrong';
  }
  if (result.result === 'correct') {
    const successText = hotspot?.successText || 'A new lead opens up.';
    ui.showNarratorCaption(successText, 6000);
    if (result.unlockedLocationIds?.length || result.revealedLocationIds?.length || result.discoveredImageIds?.length) {
      ui.clearClues();
    }
    if (result.staledClueIds?.length) {
      ui.showNarratorCaption('A standing lead just became answerable. Re-question it.', 5200);
    }
    ui.updateWorldCaseBoard(worldCase.getBoardState());
    refreshWorldCaseUi(false);
    if (allCorrectHotspotsHit(image)) {
      setTimeout(() => triggerWorldInnerMonologue('breach-photo-solved'), 700);
    }
    return 'correct';
  }
  if (result.result === 'already') return 'already';
  return null;
}

function handleWorldPuzzleSolved(image, attempt = null) {
  if (!worldCase || !image) return null;
  const puzzleAttempt = attempt !== null ? attempt : (image.puzzle?.solution || '');
  const result = worldCase.solveImagePuzzle(image.id, puzzleAttempt);
  if (result.result === 'inactive_seal') {
    ui.showNarratorCaption(result.evidencePendingText || 'This seal is awaiting field evidence.', 4800);
    return result;
  }
  if (result.result === 'wrong') {
    ui.showNarratorCaption('That seal does not match that corridor. Read the legend again.', 4200);
    refreshWorldCaseUi(false);
    return result;
  }
  if (result.result === 'partial') {
    ui.showNarratorCaption('Seal placed. The other rows are still unreadable.', 4800);
    ui.updateWorldCaseBoard(worldCase.getBoardState());
    refreshWorldCaseUi(false);
    return result;
  }
  if (result.result === 'solved') {
    ui.showNarratorCaption('Cipher cracked. The dispatch ledger gives up its destination.', 6800);
    if (result.staledClueIds?.length) {
      ui.showNarratorCaption('A standing lead just became answerable. Re-question it.', 5200);
    }
    ui.updateWorldCaseBoard(worldCase.getBoardState());
    refreshWorldCaseUi(false);
    setTimeout(() => triggerWorldInnerMonologue('ledger-solved'), 700);
    return result;
  }
  return result;
}

function handleWorldInvestigation(locationId) {
  if (!worldCase) return;
  const clueMemoryKey = `${worldCase.getCurrentSceneKey()}:${locationId}`;
  const informant = worldCase.getInformant(locationId);
  const boardEvidence = worldCase.getBoardState().evidence || [];
  const staleAvailable = boardEvidence.some(e => e.locationId === locationId && e.staleAvailable);
  if (worldCase.getInvestigatedLocationIds().has(locationId) && worldCaseLocationClueMemory.has(clueMemoryKey) && !staleAvailable) {
    const stored = worldCaseLocationClueMemory.get(clueMemoryKey);
    ui.addClue(stored.clue, stored.informant);
    return;
  }
  const result = worldCase.investigate(locationId);
  if (!result) {
    ui.addClue({ text: 'No new evidence from this scene yet.', icon: '❌' }, informant);
    return;
  }
  if (result.blocked) {
    const lockedName = result.customLocation?.name || 'This lead';
    const requiredTitle = result.requiredImageTitle || 'the relevant evidence image';
    ui.addClue({
      text: `${lockedName} won't talk yet. Examine ${requiredTitle} for something concrete to bring back.`,
      icon: '🔒',
    }, { emoji: '🔒', prefix: 'Lead locked' });
    return;
  }
  if (result.interaction === 'witness-questions') {
    ui.showWitnessQuestions({
      locationId,
      informant,
      intro: result.intro,
      questions: result.questions,
      onAsk: (qid) => handleAskWitnessQuestion(locationId, qid),
    });
    return;
  }
  const { evidence, progress } = result;
  registerWorldEvidence(evidence, progress, informant, clueMemoryKey);
}

function registerWorldEvidence(evidence, progress, informant, clueMemoryKey) {
  if (!evidence) return;
  const displayText = evidence.corroborated === false && evidence.vagueText ? evidence.vagueText : evidence.text;
  const renderedClue = { text: displayText, icon: '🧾' };
  const renderedInformant = {
    emoji: informant.emoji,
    prefix: `${informant.prefix} — ${evidence.title}${evidence.corroborated === false ? ' (uncorroborated)' : ''}`,
  };
  if (clueMemoryKey) {
    worldCaseLocationClueMemory.set(clueMemoryKey, {
      clue: renderedClue,
      informant: renderedInformant,
    });
  }
  ui.addClue(renderedClue, renderedInformant);
  ui.addDossierEntry(
    `${evidence.stopIndex}-${evidence.sceneId || evidence.stopId}`,
    displayText,
    evidence.category,
    evidence.category === 'Cultural Evidence' ? '🎭' : evidence.category === 'Confirmation' ? '✅' : evidence.category === 'Puzzle Evidence' ? '🧩' : '🧭',
    evidence.foundInCountry,
    evidence.foundInCity,
    { stopLabel: evidence.sceneTitle || evidence.foundInCity || 'Scene file' }
  );
  if (evidence.id === 'rw-paris-human-lead' && evidence.corroborated) {
    setTimeout(() => triggerWorldInnerMonologue('porter-questioned'), 700);
  }
  if (progress?.type === 'stop_ready') {
    const stopLabel = worldCase.currentRouteStop?.title || worldCase.currentRouteStop?.scene || worldCase.currentRouteStop?.city || 'this stop';
    ui.showNarratorCaption(`${stopLabel} is proven. The atlas is ready for the next country.`, 7200);
  }
  ui.updateWorldCaseBoard(worldCase.getBoardState());
  refreshWorldCaseUi();
  maybeFireLibraryCorroboratedMonologue();
}

function handleAskWitnessQuestion(locationId, questionId) {
  if (!worldCase) return;
  const result = worldCase.askWitnessQuestion(locationId, questionId);
  if (!result) return;
  const informant = worldCase.getInformant(locationId);
  ui.renderWitnessAnswer({
    locationId,
    informant,
    answer: result.answer,
    questions: result.questions,
    onAsk: (qid) => handleAskWitnessQuestion(locationId, qid),
  });
  if (result.evidence) {
    const clueMemoryKey = `${worldCase.getCurrentSceneKey()}:${locationId}`;
    registerWorldEvidence(result.evidence, result.progress, informant, clueMemoryKey);
  } else {
    ui.updateWorldCaseBoard(worldCase.getBoardState());
  }
}

function maybeFireLibraryCorroboratedMonologue() {
  if (!worldCase) return;
  const scene = worldCase.getCurrentScene();
  const stales = scene?.culturalCorroborationStales || [];
  if (!stales.length) return;
  const evidence = worldCase.getBoardState().evidence || [];
  const anyStaleHere = evidence.some(e => stales.includes(e.id) && e.staleAvailable);
  if (anyStaleHere) {
    setTimeout(() => triggerWorldInnerMonologue('library-corroborated'), 900);
  }
}

function handleWorldLocationSelection(locationId) {
  if (!worldCase || !locationId) return;
  worldCaseSelectedContext = { type: 'location', id: locationId };
  refreshWorldCaseUi(false);
  handleWorldInvestigation(locationId);
}

function getWorldCaseTravelOriginPoint() {
  if (!worldCase) return null;
  const fieldLocation = worldCase.getCurrentFieldLocation?.() || null;
  const fieldLat = Number(fieldLocation?.lat);
  const fieldLon = Number(fieldLocation?.lon);
  if (Number.isFinite(fieldLat) && Number.isFinite(fieldLon)) {
    return renderer.projectLatLon(fieldLat, fieldLon);
  }
  return renderer.getTravelPoint?.(fieldLocation?.country || worldCase.currentCountry) || renderer.getCentroid(fieldLocation?.country || worldCase.currentCountry);
}

async function handleWorldTravel(selection) {
  if (!worldCase || !selection) return;
  const travelSelection = typeof selection === 'string'
    ? { country: selection, city: { city: '', lat: NaN, lon: NaN } }
    : { country: selection.country, city: selection.city || { city: '', lat: NaN, lon: NaN } };
  const country = travelSelection.country;
  const city = travelSelection.city;
  if (!country) return;
  stopAmbient();
  const from = worldCase.currentCountry;
  playAmbient('airplane');
  const fromPoint = getWorldCaseTravelOriginPoint();
  const toPoint = renderer.projectLatLon(Number(city?.lat), Number(city?.lon));
  if (fromPoint && toPoint) await renderer.animateTravelPoints(fromPoint, toPoint);
  else await renderer.animateTravel(from, country);
  stopAmbient();
  worldCaseTravelSelection.selectedCity = city?.city || '';
  const result = worldCase.travelToSelection({
    country,
    city: city?.city || '',
    lat: Number(city?.lat),
    lon: Number(city?.lon),
  });
  worldCaseSelectedContext = { type: 'scene' };
  worldCaseInspectCountry = country;

  if (result.type === 'wrong_city') {
    ui.addClue({ text: result.explanation, icon: '❌' }, { emoji: '❌', prefix: 'City mismatch' });
    setWorldCaseTravelSelection(country, { selectedCity: city?.city || '' });
    refreshWorldCaseUi(false);
    ui.switchTab('investigate');
    return;
  }

  if (result.type === 'dead_end' || result.type === 'arrived_unproven') {
    ui.addDetourEntry(country, capitalOf[country], { mode: WORLD_CASE_FILES_MODE });
    ui.addClue({ text: result.explanation, icon: '❌' }, { emoji: '❌', prefix: result.type === 'dead_end' ? 'Dead-end report' : 'Proof required' });
    setWorldCaseTravelSelection('');
    refreshWorldCaseUi();
    ui.switchTab('investigate');
    return;
  }

  if (result.type === 'revisited') {
    ui.showNarratorCaption(result.explanation, 7200);
    ui.clearClues();
    setWorldCaseTravelSelection('');
    refreshWorldCaseUi();
    ui.switchTab('investigate');
    return;
  }

  if (result.type === 'advanced') {
    ui.showNarratorCaption(`Lead proven. ACME opens the next chapter in ${result.currentScene.city}, ${result.currentScene.country}.`, 7200);
    ui.clearClues();
    worldCaseHintIndex = 0;
    worldCaseHintDetailsOpen = false;
    setWorldCaseTravelSelection('');
    ui.showWorldCaseIntro(worldCase.getBoardState());
    refreshWorldCaseUi();
    return;
  }

  if (result.type === 'case_ready') {
    setWorldCaseTravelSelection('');
    playVictoryMusic();
    const score = Math.max(1000, 5000 - (worldCase.evidence.length * 75) - (worldCase.deadEnds.length * 250));
    saveGameRecord(gameId, score, 0);
    const choice = await ui.showCaseSolved(
      worldCase.caseData.suspect || 'Unknown suspect',
      'no clock',
      score,
      {
        continueLabel: 'Replay Experiment →',
        solvedText: worldCase.caseData.solvedText || `${worldCase.caseData.pattern.label} proven. ACME has enough evidence to recover the ${worldCase.artifact?.siteName || 'stolen object'} file and issue the warrant.`,
      },
    );
    await handleEndChoice(choice, true);
  }
}

async function startWorldCaseFiles(runConfig) {
  logic = null;
  const caseData = getWorldCaseData();
  if (!caseData) {
    throw new Error('World Case Files data is missing.');
  }
  worldCase = new WorldCaseFilesLogic({
    caseData,
    countries: window.DATA,
    culturalPlaces: worldCulturalPlacesData?.places || [],
    culturalObjects: worldCulturalObjectsData?.objects || [],
    candidateIndex: worldCandidateIndexData,
  });
  worldCaseHintMode = 'off';
  worldCaseHintIndex = 0;
  worldCaseHintDetailsOpen = false;
  worldCaseInspectCountry = '';
  worldCaseSelectedContext = { type: 'scene' };
  worldCaseTravelSelection = { mode: 'country', country: '', cities: [], selectedCity: '' };
  worldCaseLocationClueMemory.clear();
  const intro = worldCase.start();

  if (isFirstGame) {
    await waitForClick(carmenFront);
    startMusic();
  }

  const briefingIntro = caseData.briefing?.intro || '';
  const briefingNamingTell = caseData.briefing?.namingTell || '';
  const caseFileBriefing = [briefingIntro, briefingNamingTell].filter(Boolean).join('\n\n');
  if (caseFileBriefing) {
    intro.artifact = { ...(intro.artifact || {}), briefingIntro: caseFileBriefing };
  }
  const briefingHint = runConfig.briefingNote || '';
  await ui.showCaseBriefing(
    intro.artifact,
    `${caseData.start.scene}, ${caseData.start.city}, ${caseData.start.country}`,
    null,
    1,
    1,
    'world_case_files',
    briefingHint,
    {
      mode: WORLD_CASE_FILES_MODE,
      missionCopy: runConfig.briefingCopy,
      caseTitle: caseData.title,
    }
  );

  if (carmenFront) carmenFront.style.display = 'none';
  if (carmenHeader) carmenHeader.style.display = '';
  gameContent.style.display = '';

  ui.showIntro('Unknown cultural thief', intro.artifact, `${caseData.start.scene}, ${caseData.start.city}`, {
    mode: WORLD_CASE_FILES_MODE,
  });
  ui.resetDossier();
  ui.setManifestMode(false);
  ui.clearClues();
  ui.clearWitnessReports();
  ui.showWorldCaseIntro(worldCase.getBoardState());
  refreshWorldCaseUi();
  worldCaseInnerMonologueFired = new Set();
  setTimeout(() => triggerWorldInnerMonologue('enter'), 600);
}

let worldCaseInnerMonologueFired = new Set();

function triggerWorldInnerMonologue(triggerName) {
  if (!worldCase) return;
  const sceneKey = worldCase.getCurrentSceneKey();
  const firedKey = `${sceneKey}::${triggerName}`;
  if (worldCaseInnerMonologueFired.has(firedKey)) return;
  const scene = worldCase.getCurrentScene();
  const entry = (scene?.innerMonologue || []).find(m => m.trigger === triggerName);
  if (!entry?.text) return;
  worldCaseInnerMonologueFired.add(firedKey);
  ui.showInnerMonologue(entry.text);
}

function allCorrectHotspotsHit(image) {
  if (!worldCase || !image) return false;
  const correct = (image.hotspots || []).filter(h => h.correct);
  if (!correct.length) return false;
  const obs = worldCase.getImageObservation(image.id);
  return correct.every(h => obs.hotspotsHit.has(h.id));
}

function showInvestigationLocations() {
  startMusic();
  const locations = logic.getLocations();
  const maxInvestigations = logic.getMaxInvestigations();

  // Show a vague suspect identity clue as witness report on Case tab
  const suspectClue = logic.getSuspectClue();
  if (suspectClue) {
    const country = logic.route[logic.currentStop];

    const onInvestigateFurther = () => {
      const cost = logic.getSuspectInvestigateCost();
      logic.spendTime(cost);
      updateClock();
      if (checkTimeExpired()) return;

      const specificClue = logic.investigateSuspectClue();
      if (specificClue) {
        ui.upgradeWitnessReport(suspectClue.clueId, specificClue);
        ui.addDossierEntry(logic.currentStop, specificClue.text, 'Confirmed report', '🔎', country, capitalOf[country]);
      }
    };

    ui.addWitnessReport(suspectClue, {
      emoji: '🔍',
      prefix: 'Witness report',
      canInvestigate: true,
      investigateCost: logic.getSuspectInvestigateCost(),
      onInvestigateFurther,
      clueId: suspectClue.clueId,
    });
    ui.addDossierEntry(logic.currentStop, suspectClue.text, 'Witness report', '🔍', country, capitalOf[country]);
  }

  const cityMapOptions = buildCityMapOptions();

  ui.showLocations(locations, maxInvestigations, (locationId) => {
    // Each investigation costs time
    logic.spendTime(logic.getInvestigationCost());
    updateClock();
    if (checkTimeExpired()) return;

    const informant = logic.getInformant(locationId);

    // Play ambient sound matching the informant/location
    const ambientKey = informant.emoji === '🚕' ? 'taxi'
      : locationId === 'hotel' ? 'hotel'
      : locationId === 'airport' ? 'airport'
      : locationId === 'market' ? 'market'
      : 'footsteps';
    playAmbient(ambientKey);

    const rawClue = logic.investigateLocation(locationId);
    if (rawClue) {
      const clue = logic.narrateClue(rawClue, informant, locationId);
      const country = logic.route[logic.currentStop];
      const stop = logic.currentStop;
      const visualDossierIds = new Set();
      ui.addClue(clue, informant, {
        onVisualSolved: (solvedAnswer) => {
          ui.addDossierEntry(stop, `Decoded capital: ${solvedAnswer}`, 'Evidence', '🧩', country, capitalOf[country], { scope: 'capital' });
        },
        onVisualExamined: (evidence) => {
          if (!evidence?.type || !evidence?.targetCountry) return;
          const entryId = `${stop}-${evidence.type}-${evidence.targetCountry}`;
          if (visualDossierIds.has(entryId)) return;
          visualDossierIds.add(entryId);
          const label = evidence.type === 'flag'
            ? 'Torn flag fragment examined.'
            : 'Country outline evidence examined.';
          ui.addDossierEntry(stop, label, 'Evidence', '🧩', country, capitalOf[country], {
            scope: 'country',
            visualEvidence: {
              id: entryId,
              type: evidence.type,
              targetCountry: evidence.targetCountry,
            },
          });
        },
      });
      ui.addDossierEntry(stop, clue.text, informant.prefix, informant.emoji, country, capitalOf[country], { scope: clue.scope });
      const ambientHint = isCrimsonCampaignMode() && !ambientHintStopsShown.has(logic.currentStop)
        ? pickArrivalAmbientHint({
            phase: logic.campaignPhase,
            caseNumber: logic.caseNumber,
            currentStop: logic.currentStop,
            locationId,
            missionHistory: getActiveMissionHistory(logic.mode),
          })
        : null;
      if (ambientHint) {
        ambientHintStopsShown.add(logic.currentStop);
        ui.addWitnessReport({ text: ambientHint.text }, {
          emoji: ambientHint.emoji,
          prefix: ambientHint.prefix,
        });
        ui.addDossierEntry(
          logic.currentStop,
          ambientHint.text,
          ambientHint.prefix,
          ambientHint.emoji,
          country,
          capitalOf[country],
        );
      }
      const finaleHint = isCrimsonCampaignMode() && logic.campaignPhase === 'finale' && !finaleEvidenceStopsShown.has(logic.currentStop)
        ? pickFinaleAliasHint(logic.currentStop)
        : null;
      if (finaleHint) {
        finaleEvidenceStopsShown.add(logic.currentStop);
        ui.addWitnessReport({ text: finaleHint.text }, {
          emoji: finaleHint.emoji,
          prefix: finaleHint.prefix,
        });
        ui.addDossierEntry(
          logic.currentStop,
          finaleHint.text,
          finaleHint.prefix,
          finaleHint.emoji,
          country,
          capitalOf[country],
        );
      }
    } else {
      ui.addClue(
        { text: 'No new leads here.', icon: '❌' },
        informant
      );
    }
  }, cityMapOptions);
}

function buildCityMapOptions() {
  if (!isCityOpenCaseMode() || !logic?.routeProvider?.gatewayByCountry) return null;
  const country = logic.route[logic.currentStop];
  const gateway = logic.routeProvider.gatewayByCountry[country] || null;
  const capital = gateway?.capital || capitalOf[country] || country;
  const capitalLat = Number(gateway?.capitalLat);
  const capitalLon = Number(gateway?.capitalLon);
  const airportLat = Number(gateway?.airport?.lat);
  const airportLon = Number(gateway?.airport?.lon);
  const cityPoiEntry = getCityPoiEntry(country, capital);
  if (!Number.isFinite(capitalLat) || !Number.isFinite(capitalLon)) return null;
  return {
    cityMap: true,
    country,
    capital,
    center: { lat: capitalLat, lon: capitalLon },
    airport: Number.isFinite(airportLat) && Number.isFinite(airportLon)
      ? {
          name: gateway.airport.name,
          iata: gateway.airport.iata || gateway.airport.ident || '',
          lat: airportLat,
          lon: airportLon,
        }
      : null,
    pois: cityPoiEntry?.pois || null,
  };
}


function handleGoBack(fromCountry) {
  // Player chose to return to the current confirmed lead for more investigation
  stopAmbient();
  stopAtmosphere();
  stopMusic();
  const backTo = logic.route[logic.currentStop];

  logic.spendTime(logic.getTravelCost());
  updateClock();
  if (checkTimeExpired()) return;

  setTimeout(async () => {
    playAmbient('airplane');
    await renderer.animateTravel(fromCountry, backTo);
    stopAmbient();
    playerPosition = backTo;
    const neighbors = logic.getNeighborChoicesForCurrentStop();
    drawMap(logic.route.slice(0, logic.currentStop + 1), neighbors);
    ui.clearClues();
    showInvestigationLocations();
    showNeighborsOnMap(neighbors.filter(n => n !== backTo));
  }, 300);
}

function formatManifestClockDelta(deltaMinutes) {
  if (!Number.isFinite(deltaMinutes)) return '';
  if (deltaMinutes === 0) return 'same time';
  const abs = Math.abs(deltaMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  const parts = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  return `${parts.join(' ')} ${deltaMinutes > 0 ? 'ahead' : 'behind'}`;
}

function getManifestFragmentText(caseNumber, stopIndex) {
  if (caseNumber >= 10) return `GATE ZERO TRACE ${stopIndex}`;
  if (caseNumber >= 8) return `MANIFEST CHAIN VERIFIED ${stopIndex}`;
  if (caseNumber >= 5) return `FALSE HUB FLAGGED ${stopIndex}`;
  if (caseNumber >= 4) return `ARRIVAL BOARD OFFSET VERIFIED ${stopIndex}`;
  return `SKYLINE TRANSFER AUTHORIZED ${stopIndex}`;
}

function addSkylineManifestSegmentForConfirmedStop() {
  if (!isSkylineMode() || !logic?.routeProvider) return;
  const confirmedStop = logic.currentStop;
  if (confirmedStop <= 0) return;
  const fromCountry = logic.route[confirmedStop - 1];
  const toCountry = logic.route[confirmedStop];
  if (!fromCountry || !toCountry) return;

  const routeMeta = logic.routeProvider.getRouteMeta?.(fromCountry, toCountry) || null;
  const gatewayMeta = logic.routeProvider.getGatewayConnectivityMeta?.(toCountry) || null;
  const clockMeta = logic.routeProvider.getClockMeta?.(fromCountry, toCountry, logic) || null;
  const distanceBand = getFlightDistanceBand(routeMeta?.distanceKm);
  const routeLength = getFlightDistanceLabel(distanceBand);
  const airportTraffic = getAirportTrafficLabel(gatewayMeta?.band || '');
  const redactedSegmentIndex = logic.caseNumber >= TOTAL_CASES
    ? getSkylineFinalManifestRedactedSegmentIndex(logic.route)
    : null;
  const redacted = confirmedStop === redactedSegmentIndex;

  ui.addManifestSegment({
    stopIndex: confirmedStop,
    fromCountry,
    toCountry,
    fromCapital: capitalOf[fromCountry] || '',
    toCapital: capitalOf[toCountry] || '',
    gatewayBand: airportTraffic,
    connectionCount: gatewayMeta?.connectionCount || null,
    distanceBand: routeLength,
    distanceKm: routeMeta?.distanceKm ? Math.round(routeMeta.distanceKm) : null,
    clockDeltaMinutes: clockMeta?.clockDeltaMinutes ?? null,
    clockLabel: formatManifestClockDelta(clockMeta?.clockDeltaMinutes),
    fragmentText: getManifestFragmentText(logic.caseNumber, confirmedStop),
    redacted,
    checksumToken: redacted ? 'GATE ZERO / CHECKSUM ROW ERASED' : '',
    redactionText: redacted ? 'CHECKSUM ROW ERASED BY GATE ZERO' : '',
  });
}

async function runSkylineFinalManifestProofIfNeeded() {
  if (!isSkylineMode() || logic.caseNumber < TOTAL_CASES) return true;

  const proof = buildSkylineFinalManifestProof(logic);
  const result = await ui.showSkylineFinalManifestProof(proof, {
    wrongPenaltyHours: SKYLINE_FINAL_PROOF_PENALTY_HOURS,
    onWrongSelection: async () => {
      logic.spendTime(SKYLINE_FINAL_PROOF_PENALTY_HOURS);
      updateClock();
      return !checkTimeExpired();
    },
  });

  if (!result?.correct) return false;
  ui.recoverManifestRedaction(proof.redactedSegmentIndex);
  return true;
}

function handleGuess(country) {
  stopAmbient();
  stopAtmosphere();
  stopMusic();

  // If the player picks the country they're currently at (going back)
  if (country === logic.route[logic.currentStop] && playerPosition !== country) {
    handleGoBack(playerPosition);
    return;
  }

  const result = logic.guess(country);

  if (result.correct) {
    if (activeNeighborChoices) {
      activeNeighborChoices.highlight(country, true);
      activeNeighborChoices.disableAll();
    }

    if (result.gameOver && result.won) {
      // Found the thief's location — redeploy there before the lineup
      const progress = result.progress;
      ui.updateScore(logic.score);

      const fromCountry = playerPosition || progress.route[progress.route.length - 2];
      const toCountry = result.country;

      setTimeout(async () => {
        logic.spendTime(logic.getTravelCost());
        updateClock();

        playAmbient('airplane');
        await renderer.animateTravel(fromCountry, toCountry);
        stopAmbient();
        playerPosition = toCountry;
        drawMap(logic.route);
        ui.updateProgress(progress.stop, progress.totalStops);
        addSkylineManifestSegmentForConfirmedStop();

        // Brief pause, then show lineup
        setTimeout(async () => {
          const manifestLocked = await runSkylineFinalManifestProofIfNeeded();
          if (!manifestLocked) return;

          playLineupMusic();
          const lineupPool = logic.getInterpolCandidates();
          const lineup = logic.getSuspectLineup(lineupPool);
          const chosenName = await ui.showSuspectLineup(
            lineup,
            isCrimsonCampaignMode() && logic.campaignPhase === 'finale'
              ? {
                  title: 'ALIAS LINEUP',
                  subtitle: 'Carmen is in the room, but not under her own name. Find the alias and issue the warrant.',
                  badge: 'FINAL ACCUSATION',
                  intel: 'ACME believes Carmen is using one of these identities as cover. Review the files, then choose the alias.',
                  targetBadge: 'ALIAS TARGET',
                  emptyName: 'Choose Carmen\'s alias',
                  emptyText: 'One of these identities is a mask. Lock the alias here before issuing the warrant.',
                  selectedText: 'Alias selected. If the file smells like Carmen, issue the warrant now.',
                  gridLabel: 'Alias candidates',
                  confirmLabel: 'Accuse alias',
                  cardTargetLabel: 'ALIAS',
                  cardDefaultLabel: 'FILE',
                  cardTargetNote: 'Current alias target',
                  cardDefaultNote: 'Review identity',
                }
              : undefined,
          );
          const correct = logic.identifySuspect(chosenName);

          if (correct) {
            playVictoryMusic();
            confetti?.burst?.({ x: window.innerWidth / 2, y: window.innerHeight / 2, count: 100 });
            const timeBonus = logic.awardTimeBonus();
            const results = logic.getResults();
            const ts = logic.getTimeState();
            saveGameRecord(gameId, results.score, results.time);
            unlockSuspect(logic.suspect.name);
            recordTheft(logic.suspect.name, logic.artifact.siteName, logic.artifact.country);
            saveActiveMissionResult('success');
            const isFinaleWin = isCrimsonCampaignMode() && logic.caseNumber >= TOTAL_CASES;
            const isSkylineFinaleWin = isSkylineMode() && logic.caseNumber >= TOTAL_CASES;
            if (isFinaleWin) {
              markCampaignComplete();
              setGameMode(OPEN_CASES_MODE);
            } else if (isSkylineFinaleWin) {
              // Keep Skyline progress at case 10; the completion overlay ends the campaign.
            } else {
              if (isOpenCasesMode()) advanceOpenCaseCount();
              else if (isCityOpenCaseMode()) {
                // The experimental city case is standalone and does not advance a campaign counter.
              }
              else if (isSkylineMode()) advanceSkylineCase();
              else advanceCase();
            }
            const choice = await ui.showCaseSolved(
              logic.suspect.name,
              ts.hoursRemaining,
              results.score,
              {
                ...(isCityOpenCaseMode() ? { continueLabel: 'Replay Experiment →' } : {}),
                ...(isOpenCasesMode() ? { continueLabel: 'Next Open Case →' } : {}),
                ...(isSkylineMode() ? { continueLabel: isSkylineFinaleWin ? 'Complete Skyline File →' : 'Next Skyline Case →' } : {}),
                ...(getCurrentRunConfig().closingCopy?.solved ? { solvedText: getCurrentRunConfig().closingCopy.solved } : {}),
                timeBonus,
              },
            );
            if (isFinaleWin) {
              const finalChoice = await ui.showCampaignComplete(results.score);
              await handleEndChoice(finalChoice, true);
              return;
            }
            if (isSkylineFinaleWin) {
              const finalChoice = await ui.showSkylineCampaignComplete(results.score, logic.suspect.name);
              await handleEndChoice(finalChoice, true);
              return;
            }
            await handleEndChoice(choice, true);
          } else {
            playFailMusic();
            logic.score = Math.max(0, logic.score - 200);
            const failResults = logic.getResults();
            saveGameRecord(gameId, failResults.score, failResults.time);
            saveActiveMissionResult('fail');
            if (isOpenCasesMode()) advanceOpenCaseCount();
            const choice = await ui.showCaseFailed(
              logic.suspect.name,
              failResults.score,
              isCityOpenCaseMode()
                ? {
                    continueLabel: 'Replay Experiment →',
                    failedDetail: getCurrentRunConfig().closingCopy?.failed,
                  }
                : isOpenCasesMode()
                ? { continueLabel: 'Next Open Case →' }
                : isSkylineMode()
                  ? {
                      continueLabel: 'Retry Skyline Case →',
                      failedDetail: getCurrentRunConfig().closingCopy?.failed,
                    }
                  : null,
            );
            await handleEndChoice(choice, false);
          }
        }, 800);
      }, 600);
      return;
    }

    // Show highlight, then animate redeployment and show transition overlay
    const progress = result.progress;
    ui.updateScore(logic.score);

    const taunt = logic.getTaunt();
    const fromCountry = playerPosition || progress.route[progress.route.length - 2] || progress.route[0];
    const toCountry = result.country;
    const narratorLine = getCountryEntryMonologue(result.country);

    setTimeout(async () => {
      logic.spendTime(logic.getTravelCost());
      updateClock();
      if (checkTimeExpired()) return;

      playAmbient('airplane');
      await renderer.animateTravel(fromCountry, toCountry);
      stopAmbient();
      playerPosition = toCountry;
      drawMap(progress.route, result.neighbors);
      addSkylineManifestSegmentForConfirmedStop();
      const atmosphere = chooseArrivalAtmosphere(result.country, progress.stop);
      if (atmosphere) {
        playAtmosphere(atmosphere.key);
      }
      ui.showTransition(result.stopScore, result.country, taunt, 'The thief', narratorLine, () => {
        stopAtmosphere();
        ui.updateProgress(progress.stop, progress.totalStops);
        ui.showStopNarrative(progress.stop, progress.totalStops, { mode: logic.mode });
        ui.clearClues();
        showInvestigationLocations();
        showNeighborsOnMap(result.neighbors);
      }, { mode: logic.mode });
    }, 600);

  } else {
    // Wrong guess — redeploy to the dead end
    if (activeNeighborChoices) {
      activeNeighborChoices.highlight(country, false);
      activeNeighborChoices.disableAll();
    }
    ui.hideLocations();

    const progress = result.progress;
    ui.updateScore(logic.score);
    const fromCountry = playerPosition || result.fromCountry;

    setTimeout(async () => {
      logic.spendTime(logic.getTravelCost());
      updateClock();
      if (checkTimeExpired()) return;

      playAmbient('airplane');
      await renderer.animateTravel(fromCountry, country);
      stopAmbient();
      stopAtmosphere();
      playerPosition = country;
      drawMap([...logic.route.slice(0, logic.currentStop + 1)], [country]);

      ui.addDetourEntry(country, capitalOf[country], { mode: logic.mode });

      ui.showDeadEnd(country, logic.totalWrongGuesses >= 2, { mode: logic.mode }, () => {
        // Show neighbors of the original stop + the original stop itself
        const neighbors = result.neighbors;
        drawMap(logic.route.slice(0, logic.currentStop + 1), neighbors);
        showNeighborsOnMap(neighbors);
      });
    }, 600);
  }
}

startGame();
