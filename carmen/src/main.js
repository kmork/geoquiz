import { CarmenGameLogic, SUSPECTS } from './core/game-logic.js';
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
import { getFlightDistanceBand } from './campaigns/skyline-syndicate/flight-clues.js';
import { TOTAL_CASES } from './campaign/progression.js';
import {
  OPEN_CASES_MODE,
  getMissionLabelForMode,
  getPlayableGameMode,
  getRunConfigForMode,
  isOpenCasesMode as isOpenCasesGameMode,
  isSkylineSyndicateMode,
  loadCampaignModeData,
} from './campaign/modes.js';
import {
  getMissionHistory, saveMissionResult, getCurrentCase, advanceCase, setCase,
  markCampaignComplete, getUnlockedSuspects, unlockSuspect,
  getTheftHistory, recordTheft, getInterpolViewed, saveInterpolViewed,
  getGameMode, setGameMode, getOpenCaseCount, advanceOpenCaseCount,
  getSkylineCase, advanceSkylineCase, setSkylineCase, getSkylineMissionHistory, saveSkylineMissionResult,
} from './campaign/persistence.js';

const gameId = 'carmen';

const gameContent = document.getElementById('game-content');
const finalOverlay = document.getElementById('finalOverlay');
const initOverlay = document.getElementById('init-overlay');
const carmenFront = document.getElementById('carmen-front');
const carmenFrontImg = document.getElementById('carmen-front-img');
const carmenHeader = document.getElementById('carmen-header');

const confetti = initConfetti('confetti');

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
  carmenFrontImg.src = skyline ? IMG.skylineFront : IMG.carmenFront;
  carmenFrontImg.alt = skyline ? 'Skyline Syndicate' : 'Where in the World?';
}

// Debug: ?case=N URL param jumps directly to that case on load.
const _caseParam = parseInt(pageParams.get('case'), 10);
if (_caseParam >= 1 && _caseParam <= TOTAL_CASES) {
  if (isSkylineSyndicateMode(getGameMode())) {
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
      const defaultJump = isOpenCasesMode() ? String(TOTAL_CASES + 1) : String(getCurrentCase());
      const answer = window.prompt(`Jump to case (1–${TOTAL_CASES + 1}, where ${TOTAL_CASES + 1} = Open Cases):`, defaultJump);
      const n = parseInt(answer, 10);
      if (n >= 1 && n <= TOTAL_CASES) {
        setCase(n);
        setGameMode('campaign');
        location.reload();
      } else if (n === TOTAL_CASES + 1) {
        setGameMode(OPEN_CASES_MODE);
        location.reload();
      }
    }
  });
})();

// Debug: type "clues" anywhere to toggle forced visual clues (scramble + outline).
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
      console.log(`[Carmen] Visual clues ${window._forceVisualClues ? 'ON' : 'OFF'} — airport → scramble, library → outline`);
    }
  });
})();

const INTERPOL_COST_HOURS = 3;

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
const [worldData, factsData, heritageData, riversData, mountainsData, empiresData, portraitProfileData, campaignModeData] = await Promise.all([
  loadGeoJSON('data/ne_10m_admin_0_countries_route.geojson.gz'),
  fetch('data/country-facts.json').then(r => r.json()),
  fetch('data/heritage-sites.json').then(r => r.json()),
  fetch('data/rivers.json').then(r => r.json()),
  fetch('data/mountain-ranges.json').then(r => r.json()),
  fetch('data/empires.json').then(r => r.json()),
  fetch('carmen/villains_with_face_profiles.json').then(r => r.json()),
  loadCampaignModeData(),
]);

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
let renderer = new CarmenRouteRenderer(ui.mapSvg, worldData);
let baseViewBox = { x: 0, y: 0, w: 600, h: 320 };
attachZoomPan(ui.mapSvg, () => baseViewBox);

let logic;
let isFirstGame = true;

function isOpenCasesMode(mode = logic?.mode || getGameMode()) {
  return isOpenCasesGameMode(mode);
}

function isSkylineMode(mode = logic?.mode || getGameMode()) {
  return isSkylineSyndicateMode(mode);
}

function isCrimsonCampaignMode(mode = logic?.mode || getGameMode()) {
  return !isOpenCasesMode(mode) && !isSkylineMode(mode);
}

function getActiveMissionHistory(mode = logic?.mode || getGameMode()) {
  return isSkylineMode(mode) ? getSkylineMissionHistory() : getMissionHistory();
}

function saveActiveMissionResult(result, mode = logic?.mode || getGameMode()) {
  if (isSkylineMode(mode)) saveSkylineMissionResult(result);
  else saveMissionResult(result);
}

function getDisplayedOpenCaseNumber() {
  return getOpenCaseCount() + 1;
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
  const mode = logic?.mode || getGameMode();
  if (isSkylineMode(mode)) {
    const caseNumber = logic?.caseNumber || getSkylineCase();
    const totalCases = logic?.totalCases || TOTAL_CASES;
    return `Skyline Case ${caseNumber} / ${totalCases}`;
  }
  return getMissionLabelForMode(mode, getDisplayedOpenCaseNumber());
}

function getVisibleInterpolSuspects() {
  const unlocked = getUnlockedSuspects();
  const allViewed = new Set([...interpolViewedThisGame, ...getInterpolViewed()]);
  const activeArchive = logic?.getInterpolCandidates?.() || [];
  const finaleAlias = logic?.getFinaleAlias?.();
  const source = finaleAlias
    ? [...SUSPECTS, finaleAlias]
    : SUSPECTS.filter(s => isOpenCasesMode() ? s.name !== 'Carmen Sandiego' : true);

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
  if (!getUnlockedSuspects().has(suspectName)) return 'ACTIVE';
  return isOpenCasesMode() ? 'PREVIOUSLY ARRESTED' : 'IN CUSTODY';
}

function refreshInterpolList() {
  const unlocked = getUnlockedSuspects();
  const allViewed = new Set([...interpolViewedThisGame, ...getInterpolViewed()]);
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
          logic?.campaignPhase,
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
      logic?.campaignPhase,
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
    logic?.campaignPhase,
    interpolMarkedThisCase.has(suspect.name),
    toggleInterpolMark,
    intel,
  );
}

function getCountryEntryMonologue(country) {
  const historyText = logic?.countryMap?.[country]?.history || '';
  return buildCountryEntryMonologue(country, historyText);
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
    logic?.campaignPhase,
    thefts,
    getActiveMissionHistory(),
    getTheftHistory(),
  );
}

async function handleEndChoice(choice, wasSuccess) {
  if (choice === 'quit') {
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

  if (isOpenCasesMode()) {
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
  if (!runConfig.isOpenCases && !runConfig.isSkylineSyndicate) {
    briefingHint = buildCaseBriefingHint(intro.campaignPhase, intro.caseNumber, getActiveMissionHistory(logic.mode));
  }
  if (logic.routeProvider?.getBriefingHint) {
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
    { mode: logic.mode, openCaseNumber: intro.caseNumber, missionCopy: runConfig.briefingCopy }
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
        isOpenCasesMode()
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
      ui.addClue(clue, informant);
      const country = logic.route[logic.currentStop];
      ui.addDossierEntry(logic.currentStop, clue.text, informant.prefix, informant.emoji, country, capitalOf[country]);
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
  });
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
  if (deltaMinutes === 0) return 'same legal clock';
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

  ui.addManifestSegment({
    stopIndex: confirmedStop,
    fromCountry,
    toCountry,
    fromCapital: capitalOf[fromCountry] || '',
    toCapital: capitalOf[toCountry] || '',
    gatewayBand: gatewayMeta?.band || '',
    connectionCount: gatewayMeta?.connectionCount || null,
    distanceBand,
    distanceKm: routeMeta?.distanceKm ? Math.round(routeMeta.distanceKm) : null,
    clockDeltaMinutes: clockMeta?.clockDeltaMinutes ?? null,
    clockLabel: formatManifestClockDelta(clockMeta?.clockDeltaMinutes),
    fragmentText: getManifestFragmentText(logic.caseNumber, confirmedStop),
  });
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
            if (isFinaleWin) {
              markCampaignComplete();
              setGameMode(OPEN_CASES_MODE);
            } else {
              if (isOpenCasesMode()) advanceOpenCaseCount();
              else if (isSkylineMode()) advanceSkylineCase();
              else advanceCase();
            }
            const choice = await ui.showCaseSolved(
              logic.suspect.name,
              ts.hoursRemaining,
              results.score,
              {
                ...(isOpenCasesMode() ? { continueLabel: 'Next Open Case →' } : {}),
                ...(isSkylineMode() ? { continueLabel: 'Next Skyline Case →' } : {}),
                ...(getCurrentRunConfig().closingCopy?.solved ? { solvedText: getCurrentRunConfig().closingCopy.solved } : {}),
                timeBonus,
              },
            );
            if (isFinaleWin) {
              const finalChoice = await ui.showCampaignComplete(results.score);
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
              isOpenCasesMode()
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
