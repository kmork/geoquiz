/**
 * Visual clue renderers for Carmen investigations.
 *
 * - Scramble: interactive letter tiles on a boarding-pass evidence card.
 * - Outline: country silhouette on a torn atlas-page evidence card.
 * - Flag: worn evidence fragments laid out on a desk.
 * - Cargo label: Skyline freight-room image with a dynamic export label.
 *
 * Both render inside the right panel, replacing the current view.
 * Pure UI — no game state, no DOM outside the provided container.
 */

import { OutlinesRenderer } from '../../../js/ui-components/outlines-renderer.js';

// ── Flag tear patterns ──────────────────────────────────────────
// Each clue shows several fragments from the same flag image. The polygons
// partition the flag into distinct regions so the pieces read as one torn flag,
// not multiple copies of the same fragment.

const FLAG_TEAR_PATTERNS = [
  // Left third, ragged right edge
  'polygon(4% 7%, 15% 3%, 28% 6%, 33% 4%, 35% 16%, 30% 28%, 36% 43%, 31% 58%, 35% 73%, 29% 92%, 18% 96%, 6% 91%, 3% 76%, 6% 60%, 2% 44%, 5% 27%)',
  // Middle third, ragged on both sides
  'polygon(39% 5%, 52% 2%, 62% 5%, 65% 18%, 60% 33%, 66% 49%, 61% 65%, 65% 82%, 61% 96%, 47% 93%, 39% 96%, 43% 76%, 38% 59%, 44% 43%, 38% 27%, 42% 14%)',
  // Right third, ragged left edge
  'polygon(70% 6%, 82% 3%, 95% 8%, 98% 24%, 94% 42%, 98% 59%, 94% 78%, 97% 93%, 83% 96%, 70% 92%, 74% 81%, 69% 65%, 75% 50%, 69% 34%, 73% 19%)',
];

const FLAG_FRAGMENT_LAYOUTS = [
  [
    { pattern: 1, x: '-34%', y: '2%', rotate: '3deg', scale: '0.97', z: 2 },
    { pattern: 2, x: '-27%', y: '-7%', rotate: '-5deg', scale: '0.98', z: 1 },
    { pattern: 0, x: '43%', y: '8%', rotate: '5deg', scale: '0.96', z: 3 },
  ],
  [
    { pattern: 2, x: '-62%', y: '7%', rotate: '5deg', scale: '0.96', z: 2 },
    { pattern: 0, x: '31%', y: '-8%', rotate: '-3deg', scale: '0.98', z: 3 },
    { pattern: 1, x: '24%', y: '5%', rotate: '4deg', scale: '0.96', z: 1 },
  ],
  [
    { pattern: 1, x: '-34%', y: '-8%', rotate: '-2deg', scale: '0.96', z: 2 },
    { pattern: 0, x: '30%', y: '8%', rotate: '4deg', scale: '0.98', z: 3 },
    { pattern: 2, x: '-6%', y: '-4%', rotate: '-5deg', scale: '0.96', z: 1 },
  ],
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

  const layout = FLAG_FRAGMENT_LAYOUTS[Math.floor(Math.random() * FLAG_FRAGMENT_LAYOUTS.length)];

  const wrapper = document.createElement('div');
  wrapper.className = 'carmen-visual-flag';
  card.appendChild(wrapper);

  const tapeA = document.createElement('span');
  tapeA.className = 'carmen-flag-tape carmen-flag-tape-a';
  wrapper.appendChild(tapeA);

  const tapeB = document.createElement('span');
  tapeB.className = 'carmen-flag-tape carmen-flag-tape-b';
  wrapper.appendChild(tapeB);

  for (const fragment of layout) {
    const piece = document.createElement('div');
    piece.className = 'carmen-flag-piece';
    piece.style.setProperty('--tear-clip', FLAG_TEAR_PATTERNS[fragment.pattern]);
    piece.style.setProperty('--piece-x', fragment.x);
    piece.style.setProperty('--piece-y', fragment.y);
    piece.style.setProperty('--piece-rotate', fragment.rotate);
    piece.style.setProperty('--piece-scale', fragment.scale);
    piece.style.setProperty('--piece-z', fragment.z);
    wrapper.appendChild(piece);

    const img = document.createElement('img');
    img.src = `img/flags/${code}.svg`;
    img.alt = '';
    img.draggable = false;
    piece.appendChild(img);
  }

  const label = document.createElement('div');
  label.className = 'carmen-flag-evidence-label';
  label.textContent = 'Recovered flag fragments';
  card.appendChild(label);
}

// ── Cargo label renderer ────────────────────────────────────────

/**
 * Render a cargo evidence image with the export article stamped on the label.
 *
 * @param {HTMLElement} container — the element to render into
 * @param {Object}      data      — { exportItem: string, cargoImage: string }
 */
export function renderCargoLabel(container, data) {
  const exportItem = String(data?.exportItem || '').trim();
  const cargoImage = data?.cargoImage || 'carmen/img/cargo-crate-label.png';
  if (!exportItem) return;

  const card = document.createElement('div');
  card.className = 'carmen-evidence-card carmen-evidence-cargo';
  container.appendChild(card);

  const img = document.createElement('img');
  img.className = 'carmen-cargo-label-image';
  img.src = cargoImage;
  img.alt = '';
  img.draggable = false;
  card.appendChild(img);

  const label = document.createElement('div');
  label.className = 'carmen-cargo-label-text';
  label.textContent = exportItem.toUpperCase();
  const size = exportItem.length > 24 ? 'clamp(0.78rem, 2.4vw, 1.2rem)'
    : exportItem.length > 14 ? 'clamp(0.9rem, 3vw, 1.45rem)'
      : 'clamp(1.05rem, 3.8vw, 2rem)';
  label.style.setProperty('--cargo-label-size', size);
  card.appendChild(label);
}
