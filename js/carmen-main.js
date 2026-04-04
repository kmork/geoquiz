import { CarmenGameLogic } from './games/carmen-logic.js';
import { createCarmenUI } from './ui-components/carmen-ui.js';
import { RouteRenderer } from './ui-components/route-renderer.js';
import { loadGeoJSON } from './geojson-loader.js';
import { attachZoomPan } from './map-zoom-pan.js';
import { renderFinishScreen, saveGameRecord } from './game-records.js';
import { initConfetti } from './confetti.js';
import { startMusic, stopMusic } from './carmen-audio.js';

const params = new URLSearchParams(location.search);
const difficulty = params.get('difficulty') || 'detective';
const gameId = `carmen-${difficulty}`;

const gameContent = document.getElementById('game-content');
const finalOverlay = document.getElementById('finalOverlay');
const initOverlay = document.getElementById('init-overlay');
const carmenFront = document.getElementById('carmen-front');
const carmenHeader = document.getElementById('carmen-header');

const confetti = initConfetti('confetti');

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

// Data loaded — hide the loading text, keep the front image visible
if (carmenFront) {
  const loadingText = carmenFront.querySelector('.carmen-init-loading');
  if (loadingText) loadingText.style.display = 'none';
}

// Create UI (hidden until briefing is dismissed)
gameContent.style.display = 'none';
const ui = createCarmenUI(gameContent, flagCodes);

// Create map renderer
let renderer = new RouteRenderer(ui.mapSvg, worldData);
let baseViewBox = { x: 0, y: 0, w: 600, h: 320 };
attachZoomPan(ui.mapSvg, () => baseViewBox);

let logic;

async function startGame() {
  finalOverlay.style.display = 'none';

  logic = new CarmenGameLogic({
    countries: window.DATA,
    facts: factsData,
    heritageSites: heritageData,
    rivers: riversData,
    mountains: mountainsData,
    empires: empiresData,
    difficulty,
  });

  const intro = logic.start();

  // Show case briefing over the front image
  const totalHours = logic.getTimeState().totalHours;
  await ui.showCaseBriefing(intro.artifact, intro.startCountry, totalHours);

  // Hide the front image, show the header and game
  if (carmenFront) carmenFront.style.display = 'none';
  if (carmenHeader) carmenHeader.style.display = '';
  gameContent.style.display = '';

  // Draw starting country on map, include neighbors in viewBox
  drawMap(intro.progress.route, intro.neighbors);

  // Update UI — thief identity unknown
  ui.showIntro('A mysterious thief', intro.artifact, intro.startCountry);
  ui.updateScore(intro.progress.score);
  ui.updateProgress(intro.progress.stop, intro.progress.totalStops);
  updateClock();

  // Reset dossier for new game
  ui.resetDossier();

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
    setTimeout(() => showFinish(), 500);
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

    const clue = logic.investigateLocation(locationId);
    if (clue) {
      const informant = logic.getInformant(locationId);
      ui.addClue(clue, informant);
      const country = logic.route[logic.currentStop];
      ui.addDossierEntry(logic.currentStop, clue.text, informant.prefix, informant.emoji, country, capitalOf[country]);
    } else {
      const informant = logic.getInformant(locationId);
      ui.addClue(
        { text: 'No new leads here.', icon: '❌' },
        informant
      );
    }
  });
}


function handleGoBack(fromCountry) {
  // Player chose to go back to the current correct stop for more investigation
  stopMusic();
  const backTo = logic.route[logic.currentStop];

  logic.spendTime(logic.getTravelCost());
  updateClock();
  if (checkTimeExpired()) return;

  setTimeout(async () => {
    await renderer.animateTravel(fromCountry, backTo);
    playerPosition = backTo;
    const neighbors = logic.getNeighborChoicesForCurrentStop();
    drawMap(logic.route.slice(0, logic.currentStop + 1), neighbors);
    ui.clearClues();
    showInvestigationLocations();
    showNeighborsOnMap(neighbors.filter(n => n !== backTo));
  }, 300);
}

function handleGuess(country) {
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

        await renderer.animateTravel(fromCountry, toCountry);
        playerPosition = toCountry;
        drawMap(logic.route);
        ui.updateProgress(progress.stop, progress.totalStops);

        // Brief pause, then show lineup
        setTimeout(async () => {
          const lineup = logic.getSuspectLineup();
          const chosenName = await ui.showSuspectLineup(lineup);
          const correct = logic.identifySuspect(chosenName);

          const results = logic.getResults();
          if (correct) {
            confetti?.burst?.({ x: window.innerWidth / 2, y: window.innerHeight / 2, count: 100 });
            const ts = logic.getTimeState();
            saveGameRecord(gameId, results.score, results.time);
            await ui.showCaseSolved(logic.suspect.name, ts.hoursRemaining, results.score);
            location.href = 'play.html';
          } else {
            logic.score = Math.max(0, logic.score - 200);
            const failResults = logic.getResults();
            saveGameRecord(gameId, failResults.score, failResults.time);
            await ui.showCaseFailed(logic.suspect.name, failResults.score);
            location.href = 'play.html';
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

    setTimeout(async () => {
      logic.spendTime(logic.getTravelCost());
      updateClock();
      if (checkTimeExpired()) return;

      await renderer.animateTravel(fromCountry, toCountry);
      playerPosition = toCountry;
      drawMap(progress.route, result.neighbors);
      ui.showTransition(result.stopScore, result.country, taunt, 'The thief', () => {
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

    const progress = result.progress;
    ui.updateScore(progress.score);
    const fromCountry = playerPosition || result.fromCountry;

    setTimeout(async () => {
      logic.spendTime(logic.getTravelCost());
      updateClock();
      if (checkTimeExpired()) return;

      await renderer.animateTravel(fromCountry, country);
      playerPosition = country;
      drawMap([...logic.route.slice(0, logic.currentStop + 1)], [country]);

      ui.showDeadEnd(country, () => {
        // Show neighbors of the original stop + the original stop itself
        const neighbors = result.neighbors;
        drawMap(logic.route.slice(0, logic.currentStop + 1), neighbors);
        showNeighborsOnMap(neighbors);
      });
    }, 600);
  }
}

function showFinish(identifiedCorrectly, chosenSuspect) {
  stopMusic();
  const results = logic.getResults();

  finalOverlay.style.display = 'flex';

  const stats = [
    { label: 'Stops', value: `${results.stopsCompleted}/${results.totalStops}` },
    { label: 'Wrong guesses', value: results.totalWrongGuesses },
  ];
  if (chosenSuspect !== undefined) {
    stats.push({
      label: 'Suspect ID',
      value: identifiedCorrectly ? '✓ Correct' : `✗ Wrong (was ${logic.suspect.name})`,
    });
  }

  renderFinishScreen(finalOverlay, {
    gameId,
    score: results.score,
    scoreLabel: 'Score',
    maxScore: results.maxScore,
    time: results.time,
    accuracy: results.accuracy,
    stats,
    shareUrl: `geoquiz.info${location.pathname}${location.search}`,
    onPlayAgain: () => {
      startGame();
    },
  });
}

startGame();
