import { SpellingGameLogic } from './games/spelling-logic.js';
import { renderSpellingUI } from './ui-components/spelling-ui.js';
import { hapticFeedback } from './game-utils.js';
import { initConfetti } from './confetti.js';
import { renderFinishScreen } from './game-records.js';

const params = new URLSearchParams(location.search);
const mode = params.get('mode') || 'countries';
const roundsParam = params.get('rounds') || '10';
const maxRounds = roundsParam === 'all' ? Infinity : (parseInt(roundsParam) || 10);
const continentParam = params.get('continent');
const continentSlug = continentParam ? continentParam.toLowerCase().replace(/\s+/g, '-') : null;

const diffKey = roundsParam === 'all' ? 'long' : (roundsParam === '25' ? 'medium' : 'short');
const baseId = `spelling-${mode === 'cities' ? 'cities' : 'countries'}`;
const gameId = continentSlug ? `${baseId}-${diffKey}-${continentSlug}` : `${baseId}-${diffKey}`;

const initOverlay = document.getElementById('init-overlay');
const gameContent = document.getElementById('game-content');
const scoreEl = document.getElementById('score');
const progressEl = document.getElementById('progress');
const finalOverlay = document.getElementById('finalOverlay');
const titleEl = document.getElementById('game-title');
const subtitleEl = document.getElementById('game-subtitle');

const confetti = initConfetti('confetti');

// Set title based on mode
const titleText = mode === 'cities' ? 'Spell the City' : 'Spell the Country';
if (titleEl) titleEl.textContent = titleText;
document.title = `${titleText} - GeoQuiz`;

let logic;

async function init() {
  if (initOverlay) initOverlay.style.display = 'flex';

  let data = window.DATA;
  if (continentParam) {
    const filtered = data.filter(c => c.continent === continentParam);
    if (filtered.length > 0) data = filtered;
  }

  logic = new SpellingGameLogic({ data, mode, maxRounds });
  logic.loadData();

  // Resolve actual max after loadData filters words
  const actualMax = maxRounds === Infinity ? logic.words.length : Math.min(maxRounds, logic.words.length);
  logic.maxRounds = actualMax;

  logic.reset();

  if (initOverlay) initOverlay.style.display = 'none';

  nextRound();
}

function nextRound() {
  const round = logic.nextRound();
  if (!round) {
    showFinal();
    return;
  }

  updateUI();

  const ui = renderSpellingUI(gameContent, round);

  ui.onCheck(arranged => {
    const result = logic.checkAnswer(arranged);
    if (result.isCorrect) {
      hapticFeedback('correct');
      ui.showCorrect();
      updateUI();
      confetti?.burst?.({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      setTimeout(() => nextRound(), 800);
    } else {
      hapticFeedback('wrong');
      ui.lock();
      ui.showWrong();
      // Allow retry after shake
      setTimeout(() => {
        ui.clearWrong();
        ui.unlock();
      }, 600);
    }
  });
}

function updateUI() {
  const progress = logic.getProgress();
  if (scoreEl) scoreEl.textContent = progress.score;
  if (progressEl) progressEl.textContent = `${progress.current} / ${progress.total}`;
}

function showFinal() {
  if (!finalOverlay) return;

  const elapsed = logic.getElapsedTime();
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
      updateUI();
      nextRound();
    }
  });
}

init();
