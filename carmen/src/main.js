import { CarmenGameLogic, SUSPECTS } from './core/game-logic.js';
import { createCarmenUI } from './ui/ui.js';
import { RouteRenderer } from '../../js/ui-components/route-renderer.js';
import { loadGeoJSON } from '../../js/geojson-loader.js';
import { attachZoomPan } from '../../js/map-zoom-pan.js';
import { saveGameRecord } from '../../js/game-records.js';
import { initConfetti } from '../../js/confetti.js';
import { startMusic, stopMusic, playNarratorIntro, playNarrator, stopNarrator, playVictoryMusic, playFailMusic, playLineupMusic, playAmbient, stopAmbient, startClockTicking, stopClockTicking } from './audio/audio-engine.js';
import { chooseNarratorScript } from './content/narrator-script.js';
import { buildCountryEntryMonologue } from './content/country-entry-monologue.js';
import { buildCaseBriefingHint, buildInterpolIntel, pickArrivalAmbientHint } from './content/carmen-hints.js';
import { TOTAL_CASES } from './campaign/progression.js';
import {
  getMissionHistory, saveMissionResult, getCurrentCase, advanceCase, setCase,
  markCampaignComplete, resetCampaign, getUnlockedSuspects, unlockSuspect,
  getTheftHistory, recordTheft, getInterpolViewed, saveInterpolViewed,
} from './campaign/persistence.js';

const gameId = 'carmen';

const gameContent = document.getElementById('game-content');
const finalOverlay = document.getElementById('finalOverlay');
const initOverlay = document.getElementById('init-overlay');
const carmenFront = document.getElementById('carmen-front');
const carmenHeader = document.getElementById('carmen-header');

const confetti = initConfetti('confetti');


// Debug: ?case=N URL param jumps directly to that case on load.
const _caseParam = parseInt(new URLSearchParams(location.search).get('case'), 10);
if (_caseParam >= 1 && _caseParam <= TOTAL_CASES) {
  setCase(_caseParam);
}

// Debug: type "carmen" anywhere to open a case-jump prompt.
(() => {
  const secret = 'carmen';
  let buf = '';
  window.addEventListener('keydown', (e) => {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const k = (e.key || '').toLowerCase();
    if (k.length !== 1) { buf = ''; return; }
    buf = (buf + k).slice(-secret.length);
    if (buf === secret) {
      buf = '';
      const answer = window.prompt(`Jump to case (1–${TOTAL_CASES}):`, String(getCurrentCase()));
      const n = parseInt(answer, 10);
      if (n >= 1 && n <= TOTAL_CASES) {
        setCase(n);
        location.reload();
      }
    }
  });
})();

const INTERPOL_COST_HOURS = 3;

let interpolViewedThisGame = new Set();
let interpolMarkedThisCase = new Set();
let activeInterpolSuspectName = null;
let ambientHintStopsShown = new Set();

// Wait for data.js
while (!window.DATA) await new Promise(r => setTimeout(r, 50));

// Load all data in parallel
const [worldData, factsData, heritageData, riversData, mountainsData, empiresData] = await Promise.all([
  loadGeoJSON('data/ne_10m_admin_0_countries_route.geojson.gz'),
  fetch('data/country-facts.json').then(r => r.json()),
  fetch('data/heritage-sites.json').then(r => r.json()),
  fetch('data/rivers.json').then(r => r.json()),
  fetch('data/mountain-ranges.json').then(r => r.json()),
  fetch('data/empires.json').then(r => r.json()),
]);

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

// Create map renderer
let renderer = new RouteRenderer(ui.mapSvg, worldData);
let baseViewBox = { x: 0, y: 0, w: 600, h: 320 };
attachZoomPan(ui.mapSvg, () => baseViewBox);

let logic;
let isFirstGame = true;

function refreshInterpolList() {
  const unlocked = getUnlockedSuspects();
  const allViewed = new Set([...interpolViewedThisGame, ...getInterpolViewed()]);
  // Sort Carmen to the bottom of the list so she doesn't stand out as the obvious boss.
  const sortedSuspects = [...SUSPECTS].sort((a, b) => {
    if (a.name === 'Carmen Sandiego') return 1;
    if (b.name === 'Carmen Sandiego') return -1;
    return 0;
  });
  ui.showInterpolList(sortedSuspects, unlocked, allViewed, interpolMarkedThisCase, (suspect) => {
    activeInterpolSuspectName = suspect.name;
    // All suspects with photos cost time to view — including Carmen.
    const hasPhoto = !!suspect.img;
    const everViewed = getInterpolViewed().has(suspect.name);
    const alreadyViewed = interpolViewedThisGame.has(suspect.name) || everViewed;
    const inCustody = unlocked.has(suspect.name);
    const status = inCustody ? 'IN CUSTODY' : 'AT LARGE';

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

  const suspect = SUSPECTS.find(s => s.name === suspectName);
  if (!suspect) return;

  const unlocked = getUnlockedSuspects();
  const status = unlocked.has(suspect.name) ? 'IN CUSTODY' : 'AT LARGE';
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
  return buildInterpolIntel(
    suspect,
    logic?.campaignPhase,
    thefts,
    getMissionHistory(),
    getTheftHistory(),
  );
}

async function handleEndChoice(choice, wasSuccess) {
  if (choice === 'quit') {
    location.href = 'play.html?game=route';
    return;
  }

  // Continue — show front image with transition narrator + subtitles
  stopMusic();
  gameContent.style.display = 'none';
  if (carmenHeader) carmenHeader.style.display = 'none';
  if (carmenFront) carmenFront.style.display = '';

  startMusic();
  await new Promise(r => setTimeout(r, 1500));

  const missionCount = getMissionHistory().length;
  const { file: narratorFile, cues } = chooseNarratorScript(wasSuccess, missionCount);

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

  logic = new CarmenGameLogic({
    countries: window.DATA,
    facts: factsData,
    heritageSites: heritageData,
    rivers: riversData,
    mountains: mountainsData,
    empires: empiresData,
    caseNumber: getCurrentCase(),
    totalCases: TOTAL_CASES,
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

    if (!skipped) {
      // Play narrator with subtitles
      const subtitle = document.createElement('div');
      subtitle.className = 'carmen-subtitle';
      carmenFront.appendChild(subtitle);

      const cues = [
        [0.0,  "The world's a big place."],
        [1.2,  "Too big, if you ask me.\nToo many corners to hide in."],
        [4.5,  "Too many stories buried\nunder stone, sand, and time."],
        [7.5,  "Most people pass through it\nwithout noticing a thing."],
        [10.5, "Snap a picture.\nBuy a postcard. Move on."],
        [13.0, "Me?"],
        [14.0, "I notice what's missing."],
        [15.5, "That's how it starts.\nIt always does."],
        [18.5, "Something small at first.\nA whisper."],
        [21.0, "A detail that doesn't sit right."],
        [23.0, "Then the call comes in."],
        [24.5, "And suddenly\u2026\na piece of the world is gone."],
      ];

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
        playNarratorIntro(),
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
  const briefingHint = buildCaseBriefingHint(intro.campaignPhase, intro.caseNumber, getMissionHistory());
  await ui.showCaseBriefing(intro.artifact, intro.startCountry, totalHours, intro.caseNumber, intro.totalCases, intro.campaignPhase, briefingHint);

  // Hide the front image, show the header and game
  if (carmenFront) carmenFront.style.display = 'none';
  if (carmenHeader) carmenHeader.style.display = '';
  gameContent.style.display = '';

  // Draw starting country on map, include neighbors in viewBox
  drawMap(intro.progress.route, intro.neighbors);

  // Update UI — thief identity unknown
  ui.showIntro('A mysterious thief', intro.artifact, intro.startCountry);
  ui.updateMissions(getMissionHistory(), true, logic.caseNumber, logic.totalCases);
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
  ui.resetDossier();
  interpolViewedThisGame = new Set();
  interpolMarkedThisCase = new Set();
  activeInterpolSuspectName = null;
  ambientHintStopsShown = new Set();
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
      stopMusic();
      stopNarrator();
      playFailMusic();
      const results = logic.getResults();
      saveGameRecord(gameId, results.score, results.time);
      saveMissionResult('fail');
      const choice = await ui.showCaseFailed(logic.suspect.name, results.score);
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
      const ambientHint = !ambientHintStopsShown.has(logic.currentStop)
        ? pickArrivalAmbientHint({
            phase: logic.campaignPhase,
            caseNumber: logic.caseNumber,
            currentStop: logic.currentStop,
            locationId,
            missionHistory: getMissionHistory(),
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
    } else {
      ui.addClue(
        { text: 'No new leads here.', icon: '❌' },
        informant
      );
    }
  });
}


function handleGoBack(fromCountry) {
  // Player chose to go back to the current correct stop for more investigation
  stopAmbient();
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

function handleGuess(country) {
  stopAmbient();
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
      // Found the thief's location — fly there first
      const progress = logic.getProgress();
      ui.updateScore(progress.score);

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

        // Brief pause, then show lineup
        setTimeout(async () => {
          playLineupMusic();
          const lineup = logic.getSuspectLineup();
          const chosenName = await ui.showSuspectLineup(lineup);
          const correct = logic.identifySuspect(chosenName);

          const results = logic.getResults();
          if (correct) {
            playVictoryMusic();
            confetti?.burst?.({ x: window.innerWidth / 2, y: window.innerHeight / 2, count: 100 });
            const ts = logic.getTimeState();
            saveGameRecord(gameId, results.score, results.time);
            unlockSuspect(logic.suspect.name);
            recordTheft(logic.suspect.name, logic.artifact.siteName, logic.artifact.country);
            saveMissionResult('success');
            const isFinaleWin = logic.caseNumber >= TOTAL_CASES;
            if (isFinaleWin) {
              markCampaignComplete();
            } else {
              advanceCase();
            }
            const choice = await ui.showCaseSolved(logic.suspect.name, ts.hoursRemaining, results.score);
            if (isFinaleWin) {
              await ui.showCampaignComplete(results.score);
              resetCampaign();
            }
            await handleEndChoice(choice, true);
          } else {
            playFailMusic();
            logic.score = Math.max(0, logic.score - 200);
            const failResults = logic.getResults();
            saveGameRecord(gameId, failResults.score, failResults.time);
            saveMissionResult('fail');
            const choice = await ui.showCaseFailed(logic.suspect.name, failResults.score);
            await handleEndChoice(choice, false);
          }
        }, 800);
      }, 600);
      return;
    }

    // Show highlight, then animate travel and show transition overlay
    const progress = result.progress;
    ui.updateScore(progress.score);

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
      ui.showTransition(result.stopScore, result.country, taunt, 'The thief', narratorLine, () => {
        ui.updateProgress(progress.stop, progress.totalStops);
        ui.showStopNarrative(progress.stop, progress.totalStops);
        ui.clearClues();
        showInvestigationLocations();
        showNeighborsOnMap(result.neighbors);
      });
    }, 600);

  } else {
    // Wrong guess — travel to the dead end
    if (activeNeighborChoices) {
      activeNeighborChoices.highlight(country, false);
      activeNeighborChoices.disableAll();
    }
    ui.hideLocations();

    const progress = result.progress;
    ui.updateScore(progress.score);
    const fromCountry = playerPosition || result.fromCountry;

    setTimeout(async () => {
      logic.spendTime(logic.getTravelCost());
      updateClock();
      if (checkTimeExpired()) return;

      playAmbient('airplane');
      await renderer.animateTravel(fromCountry, country);
      stopAmbient();
      playerPosition = country;
      drawMap([...logic.route.slice(0, logic.currentStop + 1)], [country]);

      ui.addDetourEntry(country, capitalOf[country]);

      ui.showDeadEnd(country, () => {
        // Show neighbors of the original stop + the original stop itself
        const neighbors = result.neighbors;
        drawMap(logic.route.slice(0, logic.currentStop + 1), neighbors);
        showNeighborsOnMap(neighbors);
      });
    }, 600);
  }
}

startGame();
