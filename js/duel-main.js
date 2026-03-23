import { DuelGameLogic } from './games/duel-logic.js';
import { renderDuelUI } from './ui-components/duel-ui.js';
import { hapticFeedback } from './game-utils.js';
import { initConfetti } from './confetti.js';
import { renderFinishScreen } from './game-records.js';
import { SeededRandom, dateToSeed, getTodayDate } from './seeded-random.js';

const params = new URLSearchParams(location.search);
const continentParam = params.get('continent');
const continentSlug = continentParam ? continentParam.toLowerCase().replace(/\s+/g, '-') : null;
const dailyMode = params.get('mode') === 'daily';
const baseGameId = dailyMode ? 'duel-daily' : 'duel';
const gameId = continentSlug ? `${baseGameId}-${continentSlug}` : baseGameId;

const gameContent = document.getElementById('game-content');
const streakEl = document.getElementById('streak');
const finalOverlay = document.getElementById('finalOverlay');
const confetti = initConfetti('confetti');

let logic;
let flagsData;

async function waitForData() {
  while (!window.DATA) {
    await new Promise(r => setTimeout(r, 50));
  }
}

async function init() {
  await waitForData();

  let data = window.DATA;
  if (continentParam) {
    const filtered = data.filter(c => c.continent === continentParam);
    if (filtered.length > 1) data = filtered;
  }

  flagsData = Object.fromEntries(
    (window.ALL_COUNTRIES || window.DATA).map(c => [c.country, c.flagCode])
  );

  const rng = dailyMode ? new SeededRandom(dateToSeed(getTodayDate())) : undefined;

  logic = new DuelGameLogic({
    data,
    continentFiltered: !!continentParam,
    rng,
    onAnswer: ({ streak }) => {
      updateStreak(streak);
    },
    onGameOver: ({ streak, question }) => {
      // Show result then finish screen
      updateStreak(streak);
    }
  });

  startGame();
}

function startGame() {
  logic.reset();
  updateStreak(0);
  nextRound();
}

function nextRound() {
  const question = logic.nextRound();
  if (!question) return;

  const ui = renderDuelUI(gameContent, question, flagsData);

  ui.setupEvents({
    onClick: (choice) => {
      ui.disableAll();
      const result = logic.checkAnswer(choice);
      ui.highlightResult(question.correctAnswer, choice);

      if (result.isCorrect) {
        hapticFeedback('correct');
        confetti?.burst?.({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
        setTimeout(() => nextRound(), 900);
      } else {
        hapticFeedback('wrong');
        setTimeout(() => showFinal(), 1200);
      }
    }
  });
}

function updateStreak(streak) {
  if (streakEl) streakEl.textContent = streak;
}

function showFinal() {
  if (!finalOverlay) return;
  finalOverlay.style.display = 'flex';

  const elapsed = logic.getElapsedTime();

  const explanation = logic.getExplanation(logic.currentQuestion);

  renderFinishScreen(finalOverlay, {
    gameId,
    score: logic.streak,
    scoreLabel: 'Streak',
    maxScore: null,
    time: elapsed,
    accuracy: 0,
    explanation,
    shareUrl: `geoquiz.info${location.pathname}${location.search}`,
    onPlayAgain: () => {
      if (dailyMode) {
        logic.rng = new SeededRandom(dateToSeed(getTodayDate()));
      }
      startGame();
    }
  });
}

init();
