import { createCompleteTriviaGame } from "./trivia-complete.js";

const _params = new URLSearchParams(location.search);
const _streakMode = _params.get('mode') === 'streak';
const _roundsParam = _params.get('rounds') || '10';
const _maxCount = _streakMode ? Infinity : (_roundsParam === 'all' ? Infinity : (parseInt(_roundsParam) || 10));
const _gameIdSuffix = _streakMode ? 'streak' : (_roundsParam === 'all' ? 'long' : 'short');

const initOverlay = document.getElementById("init-overlay");

const ui = {
  questionText: document.getElementById("questionText"),
  choices: document.getElementById("choices"),
  explanation: document.getElementById("explanation"),
  scoreEl: document.getElementById("score"),
  progressEl: document.getElementById("progress"),
  finalOverlay: document.getElementById("finalOverlay"),
};

(async () => {
  if (initOverlay) initOverlay.style.display = 'flex';

  const result = await createCompleteTriviaGame({
    container: document.querySelector(".card"),
    ui,
    maxCount: _maxCount,
    gameIdSuffix: _gameIdSuffix,
    streakMode: _streakMode,
  });

  if (initOverlay) initOverlay.style.display = 'none';

  if (!result) return;
  result.showQuestion();
})();
