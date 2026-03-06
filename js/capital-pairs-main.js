import { CapitalPairsLogic } from './games/capital-pairs-logic.js';
import { renderCapitalPairsUI } from './ui-components/capital-pairs-ui.js';
import { shuffleArray, hapticFeedback } from './game-utils.js';
import { initConfetti } from './confetti.js';
import { renderFinishScreen } from './game-records.js';

const params         = new URLSearchParams(location.search);
const roundsParam    = params.get('rounds') || 'all';
const maxPairs       = roundsParam === 'all' ? Infinity : (parseInt(roundsParam) || 10);
const continentParam = params.get('continent');
const continentSlug  = continentParam ? continentParam.toLowerCase().replace(/\s+/g, '-') : null;
const gameId         = continentSlug
  ? `capital-pairs-${continentSlug}`
  : 'capital-pairs';

const initOverlay  = document.getElementById('init-overlay');
const gameContent  = document.getElementById('game-content');
const scoreEl      = document.getElementById('score');
const remainingEl  = document.getElementById('remaining');
const finalOverlay = document.getElementById('finalOverlay');

const confetti = initConfetti('confetti');

let logic;
let ui;
let displayCountries = []; // current visual order — persisted across re-renders
let displayCapitals  = [];

async function waitForData() {
  while (!window.DATA) {
    await new Promise(r => setTimeout(r, 50));
  }
}

async function init() {
  if (initOverlay) initOverlay.style.display = 'flex';

  await waitForData();

  let data = window.DATA;
  if (continentParam) {
    const filtered = data.filter(c => c.continent === continentParam);
    if (filtered.length > 0) data = filtered;
  }

  logic = new CapitalPairsLogic({ data, maxPairs });
  logic.reset();

  if (initOverlay) initOverlay.style.display = 'none';

  render();
}

function render(countries = null, capitals = null) {
  // Accept an explicit order (after a match) or shuffle fresh (initial / play-again)
  displayCountries = countries ?? shuffleArray(logic.getVisibleCountries());
  displayCapitals  = capitals  ?? shuffleArray(logic.getVisibleCapitals());

  ui = renderCapitalPairsUI(gameContent, { countries: displayCountries, capitals: displayCapitals });
  ui.setupEvents({ onAttempt: handleAttempt });
  updateUI();
}

function handleAttempt(country, capital) {
  const result = logic.checkPair(country, capital);

  if (result.correct) {
    hapticFeedback('correct');
    confetti?.burst?.({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

    ui.markCorrect(country, capital, () => {
      if (result.isDone) { showFinal(); return; }

      const newCountries = logic.getVisibleCountries();
      const newCapitals  = logic.getVisibleCapitals();

      // Find the one card added to each column (undefined if deck is exhausted)
      const addedCountry = newCountries.find(c => !displayCountries.includes(c));
      const addedCapital = newCapitals.find(c => !displayCapitals.includes(c));

      // Replace the matched slot with the new card, preserving all other positions
      const nextCountries = displayCountries
        .map(c => c === country  ? addedCountry : c)
        .filter(c => c !== undefined);
      const nextCapitals = displayCapitals
        .map(c => c === capital ? addedCapital : c)
        .filter(c => c !== undefined);

      render(nextCountries, nextCapitals);
    });
  } else {
    hapticFeedback('wrong');
    ui.markWrong(country, capital, () => showFinal());
  }
}

function updateUI() {
  const progress = logic.getProgress();
  if (scoreEl)     scoreEl.textContent     = progress.score;
  if (remainingEl) remainingEl.textContent = progress.remaining;
}

function showFinal() {
  if (!finalOverlay) return;
  finalOverlay.style.display = 'flex';

  const progress = logic.getProgress();

  renderFinishScreen(finalOverlay, {
    gameId,
    score:      progress.score,
    scoreLabel: 'Pairs matched',
    maxScore:   progress.total,
    time:       logic.getElapsedTime(),
    accuracy:   logic.getAccuracy(),
    stats:      [{ label: 'Wrong guesses', value: logic.wrongGuesses }],
    shareUrl:   `geoquiz.info${location.pathname}${location.search}`,
    onPlayAgain: () => {
      logic.reset();
      render();
      updateUI();
    },
  });
}

init();
