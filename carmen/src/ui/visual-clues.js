/**
 * Visual clue renderers for Carmen investigations.
 *
 * - Scramble: interactive letter tiles with drag-and-drop.
 * - Outline: country silhouette via OutlinesRenderer.
 *
 * Pure UI — no game state, no DOM outside the provided container.
 */

import { OutlinesRenderer } from '../../../js/ui-components/outlines-renderer.js';

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
 * Render interactive scramble tiles into a container.
 *
 * @param {HTMLElement} container — element to append the tile grid into
 * @param {Object}      data     — { letters: string[], fixed: boolean[], answer: string }
 * @param {Function}    onSolved — called with the monologue string when the player solves it
 */
export function renderScramble(container, data, onSolved) {
  const slotChars = data.letters.slice();
  const fixedFlags = data.fixed;
  const answer = data.answer;
  let solved = false;

  const el = document.createElement('div');
  el.className = 'carmen-visual-scramble';
  el.innerHTML = slotChars.map((ch, i) =>
    `<span class="carmen-scramble-tile${fixedFlags[i] ? ' fixed' : ''}" data-index="${i}"${fixedFlags[i] ? '' : ' style="touch-action:none;cursor:grab"'}>${esc(ch)}</span>`
  ).join('');
  container.appendChild(el);

  function checkSolved() {
    if (solved) return;
    if (slotChars.join('') === answer) {
      solved = true;
      el.querySelectorAll('.carmen-scramble-tile:not(.fixed)').forEach(t => {
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
    const elA = el.querySelector(`[data-index="${a}"]`);
    const elB = el.querySelector(`[data-index="${b}"]`);
    if (elA) elA.textContent = slotChars[a];
    if (elB) elB.textContent = slotChars[b];
    checkSolved();
  }

  // ── Drag-and-drop via pointer events ──

  let dragIndex = null, ghost = null, dragStarted = false, startX = 0, startY = 0;
  const DRAG_THRESHOLD = 5;
  const movableSlots = el.querySelectorAll('.carmen-scramble-tile:not(.fixed)');

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
      const slot = el.querySelector(`[data-index="${dragIndex}"]`);
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
      const t = el.querySelector(`[data-index="${targetIdx}"]`);
      if (t) t.classList.add('drop-target');
    }
  }

  function onPointerUp(e) {
    if (dragIndex === null) return;
    const slot = el.querySelector(`[data-index="${dragIndex}"]`);
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

  el.addEventListener('pointerdown', onPointerDown);
}

// ── Outline renderer ─────────────────────────────────────────────

/**
 * Render a country outline silhouette into a container.
 *
 * @param {HTMLElement} container   — element to append the SVG into
 * @param {string}      country    — target country name
 * @param {Object}      worldData  — GeoJSON FeatureCollection or features array
 */
export function renderOutline(container, country, worldData) {
  if (!worldData) return;
  const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svgEl.classList.add('carmen-visual-outline');
  svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  container.appendChild(svgEl);
  const features = worldData.features || worldData;
  const renderer = new OutlinesRenderer(svgEl, features);
  renderer.drawCountries(country);
}
