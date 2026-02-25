import { FlagsGameLogic } from './games/flags-logic.js';
import { renderFlagsUI } from './ui-components/flags-ui.js';
import { shuffleArray, hapticFeedback } from './game-utils.js';
import { initConfetti } from './confetti.js';
import { renderFinishScreen } from './game-records.js';

const params = new URLSearchParams(location.search);
const roundsParam = params.get('rounds') || '10';
const maxRounds = roundsParam === 'all' ? Infinity : (parseInt(roundsParam) || 10);
const gameIdSuffix = roundsParam === 'all' ? 'long' : (roundsParam === '25' ? 'medium' : 'short');
const continentParam = params.get('continent');
const continentSlug = continentParam ? continentParam.toLowerCase().replace(/\s+/g, '-') : null;
const gameId = continentSlug ? `flags-${continentSlug}-${gameIdSuffix}` : `flags-${gameIdSuffix}`;

const initOverlay = document.getElementById('init-overlay');
const gameContent = document.getElementById('game-content');
const scoreEl = document.getElementById('score');
const progressEl = document.getElementById('progress');
const finalOverlay = document.getElementById('finalOverlay');

const confetti = initConfetti('confetti');

let logic;
let gameStartTime;

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

  logic = new FlagsGameLogic({
    onAnswer: null,
    onComplete: null,
    singleRound: false,
    data: window.DATA
  });

  await logic.loadData();

  // Replace Infinity with actual count
  const actualMax = maxRounds === Infinity ? logic.DATA.length : Math.min(maxRounds, logic.DATA.length);
  logic.maxRounds = actualMax;

  logic.reset();
  gameStartTime = Date.now();

  if (initOverlay) initOverlay.style.display = 'none';

  nextRound();
}

function nextRound() {
  const country = logic.nextRound();

  if (!country) {
    // Game over
    showFinal();
    return;
  }

  const progress = logic.getProgress();
  updateUI(progress);

  // Generate wrong answers and build options list
  const wrongs = logic.generateWrongFlags();
  const correctISO = logic.flagsData[country.country];
  const options = shuffleArray([
    { country: country.country, iso: correctISO },
    ...wrongs.map(name => ({ country: name, iso: logic.flagsData[name] }))
  ]);

  const ui = renderFlagsUI(gameContent, { country: country.country, options });

  ui.setupEvents({
    onClick: (selectedCountry) => {
      const result = logic.checkAnswer(selectedCountry);
      ui.highlightAnswer(country.country, selectedCountry);
      ui.disableAll();
      updateUI(logic.getProgress());

      if (result.isCorrect) {
        hapticFeedback('correct');
        confetti?.burst?.({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
        setTimeout(() => nextRound(), 1200);
      } else {
        hapticFeedback('wrong');
        // Expand the correct flag after a short pause so the player can study it
        setTimeout(() => ui.animateCorrectFlag(country.country), 500);
        setTimeout(() => nextRound(), 2500);
      }
    }
  });
}

function updateUI(progress) {
  if (scoreEl) scoreEl.textContent = progress.score;
  if (progressEl) progressEl.textContent = `${progress.current} / ${progress.total}`;
}

function showFinal() {
  if (!finalOverlay) return;

  const elapsed = (Date.now() - gameStartTime) / 1000;
  const progress = logic.getProgress();
  const accuracy = logic.getAccuracy();

  finalOverlay.style.display = 'flex';

  renderFinishScreen(finalOverlay, {
    gameId,
    score: progress.score,
    scoreLabel: 'Correct',
    maxScore: progress.total,
    time: elapsed,
    accuracy,
    shareUrl: `geoquiz.info${location.pathname}${location.search}`,
    onPlayAgain: () => {
      logic.reset();
      gameStartTime = Date.now();
      updateUI(logic.getProgress());
      nextRound();
    }
  });
}

init();
