import { CapitalPairsLogic } from './games/capital-pairs-logic.js';
import { renderCapitalPairsUI } from './ui-components/capital-pairs-ui.js';
import { shuffleArray, hapticFeedback } from './game-utils.js';
import { initConfetti } from './confetti.js';
import { renderFinishScreen } from './game-records.js';

const params         = new URLSearchParams(location.search);
const roundsParam    = params.get('rounds') || '10';
const maxPairs       = roundsParam === 'all' ? Infinity : (parseInt(roundsParam) || 10);
const gameIdSuffix   = roundsParam === 'all' ? 'long' : (roundsParam === '25' ? 'medium' : 'short');
const continentParam = params.get('continent');
const continentSlug  = continentParam ? continentParam.toLowerCase().replace(/\s+/g, '-') : null;
const gameId         = continentSlug
  ? `capital-pairs-${continentSlug}-${gameIdSuffix}`
  : `capital-pairs-${gameIdSuffix}`;

const initOverlay  = document.getElementById('init-overlay');
const gameContent  = document.getElementById('game-content');
const scoreEl      = document.getElementById('score');
const remainingEl  = document.getElementById('remaining');
const finalOverlay = document.getElementById('finalOverlay');

const confetti = initConfetti('confetti');

let logic;
let ui;

async function init() {
  if (initOverlay) initOverlay.style.display = 'flex';

  if (continentParam) {
    try {
      const continentsData = await fetch('data/countries-continents.json').then(r => r.json());
      const filtered = window.DATA.filter(c => continentsData[c.country] === continentParam);
      if (filtered.length > 0) window.DATA = filtered;
    } catch (e) {
      console.warn('Could not load continent filter:', e);
    }
  }

  logic = new CapitalPairsLogic({ data: window.DATA, maxPairs });
  logic.reset();

  if (initOverlay) initOverlay.style.display = 'none';

  render();
}

function render() {
  // Shuffle the display order independently of the internal pairIdx ordering
  const countries = shuffleArray(logic.getVisibleCountries());
  const capitals  = shuffleArray(logic.getVisibleCapitals());

  ui = renderCapitalPairsUI(gameContent, { countries, capitals });
  ui.setupEvents({ onAttempt: handleAttempt });
  updateUI();
}

function handleAttempt(country, capital) {
  // Snapshot visible lists BEFORE checkPair modifies internal state
  const oldCountries = logic.getVisibleCountries();
  const oldCapitals  = logic.getVisibleCapitals();

  const result = logic.checkPair(country, capital);

  if (result.correct) {
    hapticFeedback('correct');
    confetti?.burst?.({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

    ui.markCorrect(country, capital, () => {
      if (result.isDone) {
        showFinal();
        return;
      }

      const newCountries = logic.getVisibleCountries();
      const newCapitals  = logic.getVisibleCapitals();

      // Determine what was added (if anything) to fill the freed slot
      const addedCountry = newCountries.find(c => !oldCountries.includes(c));
      const addedCapital = newCapitals.find(c => !oldCapitals.includes(c));

      if (addedCountry) {
        ui.replaceCard('country', country, addedCountry);
      } else {
        ui.removeCard('country', country);
      }

      if (addedCapital) {
        ui.replaceCard('capital', capital, addedCapital);
      } else {
        ui.removeCard('capital', capital);
      }

      updateUI();
      // Re-enable after replaceCard's 200ms fade animation, so the reused DOM
      // element has shed its tap state before the user can interact again.
      setTimeout(() => ui.enableAll(), 250);
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
