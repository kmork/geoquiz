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
// Every edge is jagged — no straight sides. Each polygon traces an
// irregular torn shape showing roughly 45-55% of the flag.
// Paired hover variants expand the visible area to ~65-70%.

const FLAG_TEAR_PATTERNS = [
  // Diagonal fragment, top-left heavy
  'polygon(4% 6%, 12% 3%, 28% 7%, 42% 2%, 58% 5%, 68% 3%, 62% 14%, 66% 26%, 58% 38%, 63% 50%, 55% 62%, 60% 74%, 52% 85%, 48% 95%, 38% 92%, 24% 96%, 12% 90%, 5% 94%, 3% 78%, 6% 62%, 2% 48%, 5% 32%, 3% 18%)',
  // Diagonal fragment, bottom-right heavy
  'polygon(96% 94%, 88% 97%, 72% 93%, 58% 98%, 42% 95%, 32% 97%, 38% 86%, 34% 74%, 42% 62%, 37% 50%, 45% 38%, 40% 26%, 48% 15%, 52% 5%, 62% 8%, 76% 4%, 88% 10%, 95% 6%, 97% 22%, 94% 38%, 98% 52%, 95% 68%, 97% 82%)',
  // Center-left irregular chunk
  'polygon(6% 8%, 14% 4%, 30% 8%, 48% 3%, 55% 6%, 58% 18%, 54% 30%, 60% 42%, 56% 55%, 62% 68%, 55% 78%, 58% 88%, 52% 96%, 40% 93%, 26% 97%, 14% 92%, 5% 96%, 3% 82%, 7% 66%, 2% 52%, 6% 38%, 3% 22%)',
  // Upper-center torn piece
  'polygon(8% 5%, 18% 3%, 32% 7%, 48% 2%, 65% 6%, 78% 3%, 92% 7%, 96% 18%, 93% 32%, 97% 46%, 92% 58%, 95% 68%, 88% 72%, 74% 68%, 60% 73%, 48% 66%, 34% 72%, 22% 67%, 10% 70%, 4% 62%, 7% 48%, 3% 34%, 6% 20%)',
];

const FLAG_TEAR_HOVER = [
  'polygon(3% 4%, 10% 2%, 24% 5%, 40% 1%, 56% 4%, 72% 2%, 78% 5%, 76% 16%, 80% 30%, 74% 44%, 78% 58%, 72% 70%, 76% 82%, 68% 92%, 56% 96%, 40% 93%, 26% 97%, 14% 92%, 5% 96%, 2% 82%, 5% 66%, 1% 50%, 4% 34%, 2% 18%)',
  'polygon(97% 96%, 90% 98%, 76% 95%, 60% 99%, 44% 96%, 28% 98%, 22% 95%, 24% 84%, 20% 70%, 26% 56%, 22% 42%, 28% 30%, 24% 18%, 32% 8%, 44% 4%, 60% 7%, 74% 3%, 86% 8%, 95% 4%, 98% 18%, 95% 34%, 99% 50%, 96% 66%, 98% 82%)',
  'polygon(4% 5%, 12% 2%, 28% 6%, 46% 1%, 60% 5%, 68% 3%, 72% 14%, 68% 28%, 74% 42%, 70% 56%, 76% 68%, 70% 80%, 72% 90%, 64% 97%, 48% 94%, 32% 98%, 18% 93%, 6% 97%, 2% 84%, 6% 68%, 1% 54%, 5% 40%, 2% 24%)',
  'polygon(6% 3%, 16% 1%, 30% 5%, 46% 1%, 62% 4%, 76% 2%, 90% 5%, 97% 16%, 94% 30%, 98% 46%, 93% 60%, 96% 74%, 90% 82%, 76% 78%, 62% 83%, 48% 76%, 34% 82%, 22% 78%, 10% 82%, 3% 74%, 6% 58%, 2% 42%, 5% 26%, 2% 12%)',
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
  const rotation = (Math.random() * 8 - 4).toFixed(1); // -4 to +4 degrees

  const wrapper = document.createElement('div');
  wrapper.className = 'carmen-visual-flag';
  wrapper.style.setProperty('--tear-clip', FLAG_TEAR_PATTERNS[patternIdx]);
  wrapper.style.setProperty('--tear-clip-hover', FLAG_TEAR_HOVER[patternIdx]);
  wrapper.style.setProperty('--flag-rotate', `${rotation}deg`);
  card.appendChild(wrapper);

  const img = document.createElement('img');
  img.src = `img/flags/${code}.svg`;
  img.alt = '';
  img.draggable = false;
  wrapper.appendChild(img);
}
