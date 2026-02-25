/**
 * Game Records — shared finish screen for standalone games.
 *
 * Exports:
 *   saveGameRecord(gameId, score, time) → {isNewScore, isNewTime}
 *   getGameRecord(gameId)               → {bestScore, bestTime} | null
 *   formatGameTime(seconds)             → "M:SS"
 *   renderFinishScreen(overlayEl, data)  — builds the entire overlay innerHTML
 */

import { copyToClipboard, showNotification, showCopyModal } from './daily-challenge-share.js';

const STORAGE_PREFIX = 'geoquiz-record-';

const GAME_NAMES = {
  find:            'Find the Country',
  outlines:        'Guess the Country',
  trivia:          'Geography Trivia',
  heritage:        'UNESCO Heritage',
  capitals:        'Capitals Quiz',
  flags:           'Flags of the World',
  rivers:          'Rivers of the World',
  mountains:       'Mountain Ranges',
  'capital-pairs': 'Capital Pairs',
};

const DIFFICULTY_LABELS = {
  short:  'Short',
  medium: 'Medium',
  long:   'Long',
  all:    'All',
};

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

/* ── Share text ─────────────────────────────────────────────── */

function buildShareText({ gameId, score, maxScore, time, accuracy, shareUrl = 'geoquiz.info' }) {
  const dash     = gameId.lastIndexOf('-');
  const gameKey  = dash >= 0 ? gameId.slice(0, dash) : gameId;
  const suffix   = dash >= 0 ? gameId.slice(dash + 1) : '';
  const gameName = GAME_NAMES[gameKey] || gameId;
  const diff     = DIFFICULTY_LABELS[suffix];

  let text = `🌍 GeoQuiz – ${gameName}`;
  if (diff) text += ` (${diff})`;
  text += `\nScore: ${score}/${maxScore} · ${formatGameTime(time)} ⏱️`;
  text += `\n${ratingEmoji(accuracy)} ${ratingSubtitle(accuracy)}`;
  text += `\n\n${shareUrl}`;
  return text;
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
    shareUrl,
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
      <button class="finish-btn finish-btn-primary" data-action="again">🔄 Play Again</button>
      <button class="finish-btn finish-btn-share" data-action="share">📋 Share</button>
      <button class="finish-btn finish-btn-secondary" data-action="home">🏠 Home</button>
    </div>`;

  html += `</div>`; // .panel

  overlayEl.innerHTML = html;

  // Wire buttons
  overlayEl.querySelector('[data-action="again"]').addEventListener('click', () => {
    overlayEl.style.display = 'none';
    if (onPlayAgain) onPlayAgain();
  });

  overlayEl.querySelector('[data-action="share"]').addEventListener('click', async () => {
    const text = buildShareText({ gameId, score, maxScore, time, accuracy, shareUrl });
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch (e) {
        if (e.name === 'AbortError') return; // user cancelled
      }
    }
    const ok = await copyToClipboard(text);
    if (ok) {
      showNotification('✅ Copied to clipboard!');
    } else {
      showCopyModal(text);
    }
  });

  overlayEl.querySelector('[data-action="home"]').addEventListener('click', () => {
    window.location.href = 'index.html';
  });
}
