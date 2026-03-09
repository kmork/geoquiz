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
import { initConfetti } from './confetti.js';

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
  duel:            'Country Duel',
  'heritage-locate': 'Heritage Locate',
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

function resolveGameName(gameId) {
  // Try full id first, then strip last segment
  if (GAME_NAMES[gameId]) return { gameName: GAME_NAMES[gameId], diff: null };
  const dash = gameId.lastIndexOf('-');
  if (dash < 0) return { gameName: GAME_NAMES[gameId] || gameId, diff: null };
  const gameKey = gameId.slice(0, dash);
  const suffix = gameId.slice(dash + 1);
  // Check if suffix is a difficulty label
  if (DIFFICULTY_LABELS[suffix]) {
    return { gameName: GAME_NAMES[gameKey] || gameKey, diff: DIFFICULTY_LABELS[suffix] };
  }
  // Otherwise it's a continent slug — try the base key
  return { gameName: GAME_NAMES[gameKey] || gameKey, diff: null };
}

function buildShareText({ gameId, score, maxScore, time, accuracy, shareUrl = 'geoquiz.info' }) {
  const { gameName, diff } = resolveGameName(gameId);
  const isSurvival = maxScore == null;

  let text = `🌍 GeoQuiz – ${gameName}`;
  if (diff) text += ` (${diff})`;
  if (isSurvival) {
    text += `\nStreak: ${score} · ${formatGameTime(time)} ⏱️`;
  } else {
    text += `\nScore: ${score}/${maxScore} · ${formatGameTime(time)} ⏱️`;
  }
  if (isSurvival) {
    text += `\n${streakEmoji(score)} ${streakSubtitle(score)}`;
  } else {
    text += `\n${ratingEmoji(accuracy)} ${ratingSubtitle(accuracy)}`;
  }
  text += `\n\n${shareUrl}`;
  return text;
}

/* ── Emoji / subtitle helpers ───────────────────────────────── */

function streakEmoji(streak) {
  if (streak >= 20) return '🏆';
  if (streak >= 15) return '🔥';
  if (streak >= 10) return '🌟';
  if (streak >= 5)  return '🎯';
  return '💪';
}

function streakSubtitle(streak) {
  if (streak >= 20) return 'Legendary streak!';
  if (streak >= 15) return 'On fire!';
  if (streak >= 10) return 'Impressive run!';
  if (streak >= 5)  return 'Good streak!';
  return 'Keep trying!';
}

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
    explanation,
    onPlayAgain,
  } = data;

  const isSurvival = maxScore == null;

  // Check for existing record before saving
  const hadPrevious = !!getGameRecord(gameId);
  const { isNewScore, isNewTime } = saveGameRecord(gameId, score, time);
  const prev = getGameRecord(gameId);

  const emoji    = isSurvival ? streakEmoji(score) : ratingEmoji(accuracy);
  const subtitle = isSurvival ? streakSubtitle(score) : ratingSubtitle(accuracy);

  // Build HTML
  let html = `<div class="panel finish-panel">`;

  // Header
  html += `
    <div class="finish-header">
      <div class="finish-emoji">${emoji}</div>
      <h2 class="finish-title">${isSurvival ? 'Game Over!' : 'Game Complete!'}</h2>
      <p class="finish-subtitle">${subtitle}</p>
    </div>`;

  // Two-column stats: Score | Time
  html += `<div class="finish-stats">`;

  // Score column
  const scoreDisplay = isSurvival ? `${score}` : `${score}/${maxScore}`;
  const ringColor = accuracy >= 80 ? 'ring-green' : accuracy >= 60 ? 'ring-gold' : 'ring-muted';
  const circumference = Math.round(2 * Math.PI * 38); // ~239
  const ringOffset = Math.round(circumference * (1 - accuracy / 100));

  html += `<div class="finish-stat">`;
  if (!isSurvival) {
    html += `
      <div class="finish-ring-wrap">
        <svg class="finish-ring" viewBox="0 0 90 90">
          <circle class="finish-ring-bg" cx="45" cy="45" r="38"/>
          <circle class="finish-ring-fill ${ringColor}" cx="45" cy="45" r="38"
            stroke-dasharray="${circumference}" stroke-dashoffset="${circumference}"/>
        </svg>
        <div class="finish-ring-text">${scoreDisplay}</div>
      </div>`;
  } else {
    html += `<div class="finish-stat-value">${scoreDisplay}</div>`;
  }
  html += `<div class="finish-stat-label">${scoreLabel}</div>`;
  if (hadPrevious && isNewScore) {
    html += `<div class="finish-record">New record!</div>`;
  } else if (hadPrevious) {
    const bestDisplay = isSurvival ? `Best: ${prev.bestScore}` : `Best: ${prev.bestScore}/${maxScore}`;
    html += `<div class="finish-best">${bestDisplay}</div>`;
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

  // Explanation card (optional)
  if (explanation) {
    html += `
    <div class="finish-explanation">
      <div class="finish-explanation-label">Did you know?</div>
      <div class="finish-explanation-text">${explanation}</div>
    </div>`;
  }

  // Action buttons
  html += `
    <div class="finish-actions">
      <button class="finish-btn finish-btn-primary" data-action="again">🔄 Play Again</button>
      <button class="finish-btn finish-btn-share" data-action="share">📋 Share</button>
      <button class="finish-btn finish-btn-secondary" data-action="home"><img class="btn-icon" src="img/icon-logo-small.svg" alt=""> Home</button>
    </div>`;

  html += `</div>`; // .panel

  overlayEl.innerHTML = html;

  // Animate score ring
  if (!isSurvival) {
    const ringFill = overlayEl.querySelector('.finish-ring-fill');
    if (ringFill) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          ringFill.style.strokeDashoffset = ringOffset;
        });
      });
    }
  }

  // Confetti for good performance
  const worthy = isSurvival ? score >= 5 : accuracy >= 60;
  if (worthy) {
    const confetti = initConfetti('confetti');
    const emojiEl = overlayEl.querySelector('.finish-emoji');
    if (emojiEl) {
      const rect = emojiEl.getBoundingClientRect();
      const count = isSurvival
        ? Math.min(60 + score * 5, 120)
        : Math.round(60 + (accuracy - 60) * 1.5);
      confetti.burst({ x: rect.left + rect.width / 2, y: rect.top, count });
    }
  }

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
