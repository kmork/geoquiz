/**
 * Game Records — shared finish screen for standalone games.
 *
 * Exports:
 *   saveGameRecord(gameId, score, time) → {isNewScore, isNewTime}
 *   getGameRecord(gameId)               → {bestScore, bestTime} | null
 *   formatGameTime(seconds)             → "M:SS"
 *   renderFinishScreen(overlayEl, data)  — builds the entire overlay innerHTML
 */

const STORAGE_PREFIX = 'geoquiz-record-';

/* ── localStorage helpers ───────────────────────────────────── */

export function getGameRecord(gameId) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + gameId);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function saveGameRecord(gameId, score, time) {
  const prev = getGameRecord(gameId);
  const isNewScore = !prev || score > prev.bestScore;
  const isNewTime  = !prev || (score >= prev.bestScore && time < prev.bestTime);

  const best = {
    bestScore: isNewScore ? score : prev.bestScore,
    bestTime:  (isNewTime || isNewScore) ? time : prev.bestTime,
  };
  try { localStorage.setItem(STORAGE_PREFIX + gameId, JSON.stringify(best)); } catch {}

  return { isNewScore, isNewTime };
}

/* ── Formatting ─────────────────────────────────────────────── */

export function formatGameTime(seconds) {
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, '0');
  return `${m}:${ss}`;
}

/* ── Emoji / subtitle helpers ───────────────────────────────── */

function ratingEmoji(accuracy) {
  if (accuracy === 100) return '🏆';
  if (accuracy >= 80)  return '🌟';
  if (accuracy >= 60)  return '🎯';
  if (accuracy >= 40)  return '👏';
  return '💪';
}

function ratingSubtitle(accuracy) {
  if (accuracy === 100) return 'Perfect score!';
  if (accuracy >= 80)  return 'Excellent work!';
  if (accuracy >= 60)  return 'Well done!';
  if (accuracy >= 40)  return 'Good effort!';
  return 'Keep practicing!';
}

/* ── Render ──────────────────────────────────────────────────── */

/**
 * @param {HTMLElement} overlayEl  – the .overlay container
 * @param {Object}      data
 *   gameId       string
 *   score        number
 *   scoreLabel   string  (e.g. "Score")
 *   maxScore     number
 *   time         number  (seconds, total game)
 *   accuracy     number  (0-100)
 *   stats        [{label, value}]  optional extra stats
 *   onPlayAgain  () => void
 */
export function renderFinishScreen(overlayEl, data) {
  const {
    gameId, score, scoreLabel = 'Score', maxScore,
    time, accuracy = 0,
    stats = [],
    onPlayAgain,
  } = data;

  // Check for existing record before saving
  const hadPrevious = !!getGameRecord(gameId);
  const { isNewScore, isNewTime } = saveGameRecord(gameId, score, time);
  const prev = getGameRecord(gameId);

  const emoji    = ratingEmoji(accuracy);
  const subtitle = ratingSubtitle(accuracy);

  // Build HTML
  let html = `<div class="panel finish-panel">`;

  // Header
  html += `
    <div class="finish-header">
      <div class="finish-emoji">${emoji}</div>
      <h2 class="finish-title">Game Complete!</h2>
      <p class="finish-subtitle">${subtitle}</p>
    </div>`;

  // Two-column stats: Score | Time
  html += `<div class="finish-stats">`;

  // Score column
  html += `<div class="finish-stat">
      <div class="finish-stat-value">${score}/${maxScore}</div>
      <div class="finish-stat-label">${scoreLabel}</div>`;
  if (hadPrevious && isNewScore) {
    html += `<div class="finish-record">New record!</div>`;
  } else if (hadPrevious) {
    html += `<div class="finish-best">Best: ${prev.bestScore}/${maxScore}</div>`;
  }
  html += `</div>`;

  // Time column
  html += `<div class="finish-stat">
      <div class="finish-stat-value">${formatGameTime(time)}</div>
      <div class="finish-stat-label">Time</div>`;
  if (hadPrevious && isNewTime) {
    html += `<div class="finish-record">New record!</div>`;
  } else if (hadPrevious) {
    html += `<div class="finish-best">Best: ${formatGameTime(prev.bestTime)}</div>`;
  }
  html += `</div>`;

  html += `</div>`; // .finish-stats

  // Extra stats row
  if (stats.length) {
    html += `<div class="finish-extra-stats">`;
    for (const s of stats) {
      html += `<div class="finish-extra"><span class="finish-extra-value">${s.value}</span> <span class="finish-extra-label">${s.label}</span></div>`;
    }
    html += `</div>`;
  }

  // Action buttons
  html += `
    <div class="finish-actions">
      <button class="finish-btn finish-btn-primary" data-action="again">Play Again</button>
      <button class="finish-btn finish-btn-secondary" data-action="home">Home</button>
    </div>`;

  html += `</div>`; // .panel

  overlayEl.innerHTML = html;

  // Wire buttons
  overlayEl.querySelector('[data-action="again"]').addEventListener('click', () => {
    overlayEl.style.display = 'none';
    if (onPlayAgain) onPlayAgain();
  });

  overlayEl.querySelector('[data-action="home"]').addEventListener('click', () => {
    window.location.href = 'index.html';
  });
}
