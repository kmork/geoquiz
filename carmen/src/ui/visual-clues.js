/**
 * Visual clue renderers for Carmen investigations.
 *
 * - Scramble: interactive letter tiles on a boarding-pass evidence card.
 * - Outline: country silhouette on a torn atlas-page evidence card.
 *
 * Both render inside the right panel, replacing the current view.
 * Pure UI — no game state, no DOM outside the provided container.
 */

import { OutlinesRenderer } from '../../../js/ui-components/outlines-renderer.js';

// ── Flag tear patterns ──────────────────────────────────────────
// Each pattern is a clip-path polygon showing roughly 50% of the flag
// with jagged edges to simulate a torn fragment.

const FLAG_TEAR_PATTERNS = [
  // Top-left fragment (diagonal tear from top-right to bottom-left)
  'polygon(0% 0%, 65% 0%, 58% 12%, 62% 24%, 55% 38%, 60% 52%, 48% 65%, 52% 78%, 45% 100%, 0% 100%)',
  // Bottom-right fragment (diagonal tear from top-left to bottom-right)
  'polygon(100% 100%, 35% 100%, 42% 88%, 38% 76%, 45% 62%, 40% 48%, 52% 35%, 48% 22%, 55% 0%, 100% 0%)',
  // Left half with jagged right edge
  'polygon(0% 0%, 55% 0%, 50% 10%, 58% 22%, 52% 35%, 56% 48%, 48% 60%, 54% 74%, 50% 88%, 55% 100%, 0% 100%)',
  // Top half with jagged bottom edge
  'polygon(0% 0%, 100% 0%, 100% 55%, 88% 50%, 76% 58%, 62% 52%, 48% 56%, 35% 48%, 22% 54%, 10% 50%, 0% 55%)',
];

const FLAG_TEAR_HOVER = [
  'polygon(0% 0%, 82% 0%, 78% 12%, 82% 24%, 76% 38%, 80% 52%, 72% 65%, 76% 78%, 70% 100%, 0% 100%)',
  'polygon(100% 100%, 18% 100%, 22% 88%, 18% 76%, 24% 62%, 20% 48%, 28% 35%, 24% 22%, 30% 0%, 100% 0%)',
  'polygon(0% 0%, 75% 0%, 70% 10%, 78% 22%, 72% 35%, 76% 48%, 68% 60%, 74% 74%, 70% 88%, 75% 100%, 0% 100%)',
  'polygon(0% 0%, 100% 0%, 100% 75%, 88% 70%, 76% 78%, 62% 72%, 48% 76%, 35% 68%, 22% 74%, 10% 70%, 0% 75%)',
];

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ── Scramble monologues ──────────────────────────────────────────

const SCRAMBLE_MONOLOGUES = [
  'The letters clicked into place. A capital. That narrows it down — if I trust a note left behind on purpose.',
  'Scrambled letters, one clean answer. Somebody wanted me to work for this. Fine. Now I know where the trail points.',
  'The name assembled itself in my head before my fingers finished. A capital city. A lead. Maybe the only honest one today.',
  'That wasn\'t hard. Which means it was meant to be found. Still — a city name is a city name, and I\'ll take it.',
  'Letters rearranged, destination revealed. The kind of clue that feels like a gift. I don\'t trust gifts. But I\'ll use this one.',
  'One clean word out of the mess. A capital. The sort of thing that makes you feel clever right before you realize you were supposed to.',
];

function pickScrambleMonologue() {
  return SCRAMBLE_MONOLOGUES[Math.floor(Math.random() * SCRAMBLE_MONOLOGUES.length)];
}

// ── Scramble renderer ────────────────────────────────────────────

/**
 * Render interactive scramble tiles into a container element.
 *
 * @param {HTMLElement} container — the element to render into
 * @param {Object}      data     — { letters: string[], fixed: boolean[], answer: string }
 * @param {Function}    onSolved — called with the monologue string when solved
 */
export function renderScramble(container, data, onSolved) {
  const card = document.createElement('div');
  card.className = 'carmen-evidence-card carmen-evidence-scramble';
  container.appendChild(card);

  const slotChars = data.letters.slice();
  const fixedFlags = data.fixed;
  const answer = data.answer;
  let solved = false;

  const tilesEl = document.createElement('div');
  tilesEl.className = 'carmen-visual-scramble';
  tilesEl.innerHTML = slotChars.map((ch, i) =>
    `<span class="carmen-scramble-tile${fixedFlags[i] ? ' fixed' : ''}" data-index="${i}"${fixedFlags[i] ? '' : ' style="touch-action:none;cursor:grab"'}>${esc(ch)}</span>`
  ).join('');
  card.appendChild(tilesEl);

  function checkSolved() {
    if (solved) return;
    if (slotChars.join('') === answer) {
      solved = true;
      tilesEl.querySelectorAll('.carmen-scramble-tile:not(.fixed)').forEach(t => {
        t.classList.add('solved');
        t.style.cursor = '';
      });
      if (onSolved) onSolved(pickScrambleMonologue());
    }
  }

  function swapSlots(a, b) {
    const tmp = slotChars[a];
    slotChars[a] = slotChars[b];
    slotChars[b] = tmp;
    const elA = tilesEl.querySelector(`[data-index="${a}"]`);
    const elB = tilesEl.querySelector(`[data-index="${b}"]`);
    if (elA) elA.textContent = slotChars[a];
    if (elB) elB.textContent = slotChars[b];
    checkSolved();
  }

  // ── Drag-and-drop via pointer events ──

  let dragIndex = null, ghost = null, dragStarted = false, startX = 0, startY = 0;
  const DRAG_THRESHOLD = 5;
  const movableSlots = tilesEl.querySelectorAll('.carmen-scramble-tile:not(.fixed)');

  function getSlotAtPoint(x, y) {
    for (const slot of movableSlots) {
      const r = slot.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        return parseInt(slot.dataset.index);
      }
    }
    return null;
  }

  function onPointerDown(e) {
    if (solved) return;
    const slot = e.target.closest('.carmen-scramble-tile:not(.fixed)');
    if (!slot) return;
    e.preventDefault();
    dragIndex = parseInt(slot.dataset.index);
    dragStarted = false;
    startX = e.clientX;
    startY = e.clientY;
    slot.setPointerCapture(e.pointerId);
    slot.addEventListener('pointermove', onPointerMove);
    slot.addEventListener('pointerup', onPointerUp);
    slot.addEventListener('pointercancel', onPointerUp);
  }

  function onPointerMove(e) {
    if (dragIndex === null) return;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    if (!dragStarted) {
      if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
      dragStarted = true;
      const slot = tilesEl.querySelector(`[data-index="${dragIndex}"]`);
      if (slot) {
        slot.classList.add('dragging');
        ghost = document.createElement('div');
        ghost.className = 'carmen-scramble-tile carmen-scramble-ghost';
        ghost.textContent = slot.textContent;
        ghost.style.left = e.clientX + 'px';
        ghost.style.top = e.clientY + 'px';
        document.body.appendChild(ghost);
      }
    }
    if (ghost) { ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px'; }
    movableSlots.forEach(s => s.classList.remove('drop-target'));
    const targetIdx = getSlotAtPoint(e.clientX, e.clientY);
    if (targetIdx !== null && targetIdx !== dragIndex) {
      const t = tilesEl.querySelector(`[data-index="${targetIdx}"]`);
      if (t) t.classList.add('drop-target');
    }
  }

  function onPointerUp(e) {
    if (dragIndex === null) return;
    const slot = tilesEl.querySelector(`[data-index="${dragIndex}"]`);
    if (slot) {
      slot.releasePointerCapture(e.pointerId);
      slot.removeEventListener('pointermove', onPointerMove);
      slot.removeEventListener('pointerup', onPointerUp);
      slot.removeEventListener('pointercancel', onPointerUp);
      slot.classList.remove('dragging');
    }
    if (ghost) { ghost.remove(); ghost = null; }
    movableSlots.forEach(s => s.classList.remove('drop-target'));
    if (dragStarted) {
      const targetIdx = getSlotAtPoint(e.clientX, e.clientY);
      if (targetIdx !== null && targetIdx !== dragIndex) swapSlots(dragIndex, targetIdx);
    }
    dragIndex = null;
    dragStarted = false;
  }

  tilesEl.addEventListener('pointerdown', onPointerDown);
}

// ── Outline renderer ─────────────────────────────────────────────

/**
 * Render a country outline silhouette into a container element.
 *
 * @param {HTMLElement} container — the element to render into
 * @param {string}      country   — target country name
 * @param {Object}      worldData — GeoJSON FeatureCollection or features array
 */
export function renderOutline(container, country, worldData) {
  if (!worldData) return;

  const card = document.createElement('div');
  card.className = 'carmen-evidence-card carmen-evidence-outline';
  container.appendChild(card);

  const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svgEl.classList.add('carmen-visual-outline');
  svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  card.appendChild(svgEl);

  const features = worldData.features || worldData;
  const renderer = new OutlinesRenderer(svgEl, features);
  renderer.drawCountries(country);
}

// ── Flag renderer ───────────────────────────────────────────────

/**
 * Render a torn flag fragment into a container element.
 *
 * @param {HTMLElement} container — the element to render into
 * @param {string}      country   — target country name
 * @param {Object}      flagCodes — map of country name → flag code
 */
export function renderFlag(container, country, flagCodes) {
  const code = flagCodes?.[country];
  if (!code) return;

  const card = document.createElement('div');
  card.className = 'carmen-evidence-card carmen-evidence-flag';
  container.appendChild(card);

  const patternIdx = Math.floor(Math.random() * FLAG_TEAR_PATTERNS.length);

  const wrapper = document.createElement('div');
  wrapper.className = 'carmen-visual-flag';
  wrapper.style.setProperty('--tear-clip', FLAG_TEAR_PATTERNS[patternIdx]);
  wrapper.style.setProperty('--tear-clip-hover', FLAG_TEAR_HOVER[patternIdx]);
  card.appendChild(wrapper);

  const img = document.createElement('img');
  img.src = `img/flags/${code}.svg`;
  img.alt = '';
  img.draggable = false;
  wrapper.appendChild(img);
}
