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

function startGame() {
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

  // Draw starting country on map
  drawMap(intro.progress.route);

  // Update UI
  ui.showIntro(intro.thiefName, intro.artifact, intro.startCountry);
  ui.updateScore(intro.progress.score);
  ui.updateLives(intro.progress.lives, intro.progress.maxLives);
  ui.updateProgress(intro.progress.stop, intro.progress.totalStops);
  ui.showClues(intro.clues);
  showExtraClueButton();
  ui.showNeighbors(intro.neighbors, handleGuess);
}

function drawMap(visitedCountries) {
  const list = visitedCountries.map((country, i) => ({
    country,
    color: i === 0 ? 'start' : i === visitedCountries.length - 1 ? 'end' : 'path',
  }));
  // Current position always shown as 'end' color (orange)
  if (list.length > 0) list[list.length - 1].color = 'end';
  if (list.length > 1) list[0].color = 'start';

  renderer.drawRoute(list);

  // Update base viewBox for zoom/pan
  const vb = ui.mapSvg.viewBox.baseVal;
  baseViewBox = { x: vb.x, y: vb.y, w: vb.width, h: vb.height };
}

function showExtraClueButton() {
  const extra = logic.requestExtraClue.bind(logic);
  // Check if extra clues are available by peeking at diff settings
  const canExtra = logic.extraCluesUsed < logic.diff.extraClues;
  ui.showExtraClueButton(canExtra, () => {
    const clue = logic.requestExtraClue();
    if (clue) {
      ui.addClue(clue);
      ui.updateScore(logic.getProgress().score);
    }
    // Disable if no more extras allowed or no clues left to show
    if (!clue || logic.extraCluesUsed >= logic.diff.extraClues) {
      ui.disableExtraClueButton();
    }
  });
}

function handleGuess(country) {
  const result = logic.guess(country);

  if (result.correct) {
    ui.highlightNeighbor(country, true);
    ui.disableAllNeighbors();

    if (result.gameOver && result.won) {
      // Caught the thief!
      const progress = logic.getProgress();
      drawMap(logic.route);
      ui.updateScore(progress.score);
      ui.updateProgress(progress.stop, progress.totalStops);

      setTimeout(() => showFinish(), 1500);
      confetti?.burst?.({ x: window.innerWidth / 2, y: window.innerHeight / 2, count: 100 });
      return;
    }

    // Show transition, then next stop
    ui.showTransition(result.stopScore, result.country);
    const progress = result.progress;
    drawMap(progress.route);
    ui.updateScore(progress.score);

    setTimeout(() => {
      ui.updateProgress(progress.stop, progress.totalStops);
      ui.showStopNarrative(progress.stop, progress.totalStops);
      ui.showClues(result.clues);
      showExtraClueButton();
      ui.showNeighbors(result.neighbors, handleGuess);
    }, 1500);

  } else {
    // Wrong guess
    ui.highlightNeighbor(country, false);
    const progress = result.progress;
    ui.updateScore(progress.score);
    ui.updateLives(progress.lives, progress.maxLives);

    if (result.gameOver) {
      ui.disableAllNeighbors();
      // Show the correct answer
      ui.highlightNeighbor(result.correctCountry, true);
      drawMap([...logic.route.slice(0, logic.currentStop + 1), result.correctCountry]);
      setTimeout(() => showFinish(), 2000);
    }
  }
}

function showFinish() {
  const results = logic.getResults();

  finalOverlay.style.display = 'flex';

  renderFinishScreen(finalOverlay, {
    gameId,
    score: results.score,
    scoreLabel: 'Score',
    maxScore: results.maxScore,
    time: results.time,
    accuracy: results.accuracy,
    stats: [
      { label: 'Stops', value: `${results.stopsCompleted}/${results.totalStops}` },
      { label: 'Wrong guesses', value: results.totalWrongGuesses },
    ],
    shareUrl: `geoquiz.info${location.pathname}${location.search}`,
    onPlayAgain: () => {
      startGame();
    },
  });
}

startGame();
