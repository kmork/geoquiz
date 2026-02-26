import { createCompleteTriviaGame } from "./trivia-complete.js";

const _params = new URLSearchParams(location.search);
const _roundsParam = _params.get('rounds') || '10';
const _maxCount = _roundsParam === 'all' ? Infinity : (parseInt(_roundsParam) || 10);
const _gameIdSuffix = _roundsParam === 'all' ? 'long' : (_roundsParam === '25' ? 'medium' : 'short');

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
    gameIdSuffix: _gameIdSuffix
  });

  if (initOverlay) initOverlay.style.display = 'none';

  if (!result) return;
  result.showQuestion();
})();
