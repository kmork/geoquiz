import { CarmenGameLogic } from './games/carmen-logic.js';
import { createCarmenUI } from './ui-components/carmen-ui.js';
import { RouteRenderer } from './ui-components/route-renderer.js';
import { loadGeoJSON } from './geojson-loader.js';
import { attachZoomPan } from './map-zoom-pan.js';
import { renderFinishScreen } from './game-records.js';
import { initConfetti } from './confetti.js';

const params = new URLSearchParams(location.search);
const difficulty = params.get('difficulty') || 'detective';
const gameId = `carmen-${difficulty}`;

const gameContent = document.getElementById('game-content');
const finalOverlay = document.getElementById('finalOverlay');
const initOverlay = document.getElementById('init-overlay');

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

if (initOverlay) initOverlay.style.display = 'none';

// Create UI
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

  // Show case briefing first
  await ui.showCaseBriefing(intro.artifact, intro.startCountry);

  // Draw starting country on map, include neighbors in viewBox
  drawMap(intro.progress.route, intro.neighbors);

  // Update UI — thief identity unknown
  ui.showIntro('A mysterious thief', intro.artifact, intro.startCountry);
  ui.updateScore(intro.progress.score);
  ui.updateLives(intro.progress.lives, intro.progress.maxLives);
  ui.updateProgress(intro.progress.stop, intro.progress.totalStops);
  updateClock();

  // Reset dossier for new game
  ui.resetDossier();

  // Clear old clues, then show investigation locations
  ui.showClues([], []);
  showInvestigationLocations();
  showNeighborsOnMap(intro.neighbors);
}

let activeNeighborChoices = null;

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
  ui.showMapHeader();
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
  const locations = logic.getLocations();
  const maxInvestigations = logic.getMaxInvestigations();

  // Show a suspect identity clue at the start of each stop
  const suspectClue = logic.getSuspectClue();
  if (suspectClue) {
    ui.addClue(suspectClue, { emoji: '🔍', prefix: 'Witness report' });
    ui.addDossierEntry(logic.currentStop, suspectClue.text, 'Witness report');
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
      ui.addDossierEntry(logic.currentStop, clue.text, informant.prefix);
    } else {
      const informant = logic.getInformant(locationId);
      ui.addClue(
        { text: 'No new leads here.', icon: '❌' },
        informant
      );
    }
  });
}


function handleGuess(country) {
  const result = logic.guess(country);

  if (result.correct) {
    if (activeNeighborChoices) {
      activeNeighborChoices.highlight(country, true);
      activeNeighborChoices.disableAll();
    }

    if (result.gameOver && result.won) {
      // Found the thief's location — now identify them!
      const progress = logic.getProgress();
      drawMap(logic.route);
      ui.updateScore(progress.score);
      ui.updateProgress(progress.stop, progress.totalStops);

      // Show suspect lineup before declaring victory
      setTimeout(async () => {
        const lineup = logic.getSuspectLineup();
        const revealedAttrs = logic.getRevealedSuspectAttrs();
        const chosenName = await ui.showSuspectLineup(lineup, revealedAttrs);
        const correct = logic.identifySuspect(chosenName);

        if (correct) {
          confetti?.burst?.({ x: window.innerWidth / 2, y: window.innerHeight / 2, count: 100 });
          showFinish(true, chosenName);
        } else {
          logic.score = Math.max(0, logic.score - 200);
          showFinish(false, chosenName);
        }
      }, 1200);
      return;
    }

    // Show highlight, then animate travel and show transition overlay
    const progress = result.progress;
    ui.updateScore(progress.score);

    const taunt = logic.getTaunt();
    const fromCountry = progress.route[progress.route.length - 2] || progress.route[0];
    const toCountry = result.country;

    setTimeout(async () => {
      logic.spendTime(logic.getTravelCost());
      updateClock();
      if (checkTimeExpired()) return;

      await renderer.animateTravel(fromCountry, toCountry);
      drawMap(progress.route, result.neighbors);
      ui.showTransition(result.stopScore, result.country, taunt, 'The thief', () => {
        ui.updateProgress(progress.stop, progress.totalStops);
        ui.showStopNarrative(progress.stop, progress.totalStops);
        ui.showClues([], []);
        showInvestigationLocations();
        showNeighborsOnMap(result.neighbors);
      });
    }, 600);

  } else {
    // Wrong guess
    if (activeNeighborChoices) {
      activeNeighborChoices.highlight(country, false);
    }
    ui.flashWrong();
    const progress = result.progress;
    ui.updateScore(progress.score);
    ui.updateLives(progress.lives, progress.maxLives);

    if (result.gameOver) {
      if (activeNeighborChoices) activeNeighborChoices.disableAll();
      // Show the correct answer on the map
      if (activeNeighborChoices) activeNeighborChoices.highlight(result.correctCountry, true);
      drawMap([...logic.route.slice(0, logic.currentStop + 1), result.correctCountry]);
      setTimeout(() => showFinish(), 2000);
    }
  }
}

function showFinish(identifiedCorrectly, chosenSuspect) {
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
