/**
 * Spelling Game UI Component
 *
 * Letters start in scrambled order inside the slots.
 * Drag a letter to another slot to swap them.
 */

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * @param {HTMLElement} container
 * @param {object} roundData - { name, scrambled, hint, hintType }
 * @returns {{ onCheck: function }}
 */
export function renderSpellingUI(container, roundData) {
  const { name, scrambled, hint, hintType } = roundData;

  // Hint HTML
  let hintHtml;
  if (hintType === 'flag') {
    hintHtml = `<div class="spelling-hint"><img src="img/flags/${escapeHtml(hint)}.svg" alt="Flag hint" class="spelling-hint-flag"></div>`;
  } else {
    hintHtml = `<div class="spelling-hint"><span class="spelling-hint-country">${escapeHtml(hint)}</span></div>`;
  }

  // Slots HTML — letters pre-filled in scrambled order
  const slotsHtml = scrambled.map((s, i) => {
    if (s.isFixed) {
      return `<div class="spelling-slot fixed" data-index="${i}">${escapeHtml(s.char)}</div>`;
    }
    return `<div class="spelling-slot filled" data-index="${i}" style="touch-action:none">${escapeHtml(s.char)}</div>`;
  }).join('');

  container.innerHTML = `
    <div class="spelling-game" style="max-width:600px;margin:0 auto;">
      ${hintHtml}
      <div class="spelling-slots" id="spelling-slots">${slotsHtml}</div>
      <div style="text-align:center;margin-top:1rem;">
        <button class="spelling-submit" id="spelling-submit">Check</button>
      </div>
    </div>
  `;

  const slotChars = scrambled.map(s => s.char);
  let checkCallback = null;
  let locked = false;

  const slotsContainer = container.querySelector('#spelling-slots');
  const allSlots = container.querySelectorAll('.spelling-slot:not(.fixed)');
  const submitBtn = container.querySelector('#spelling-submit');

  function getArrangedString() {
    return slotChars.join('');
  }

  function swapSlots(a, b) {
    const tmp = slotChars[a];
    slotChars[a] = slotChars[b];
    slotChars[b] = tmp;

    const elA = container.querySelector(`.spelling-slot[data-index="${a}"]`);
    const elB = container.querySelector(`.spelling-slot[data-index="${b}"]`);
    if (elA) elA.textContent = slotChars[a];
    if (elB) elB.textContent = slotChars[b];
  }

  // ── Drag-and-drop via pointer events ──

  let dragIndex = null;
  let ghost = null;
  let dragStarted = false;
  let startX = 0, startY = 0;
  const DRAG_THRESHOLD = 5;

  function getSlotAtPoint(x, y) {
    for (const slot of allSlots) {
      const r = slot.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        return parseInt(slot.dataset.index);
      }
    }
    return null;
  }

  function createGhost(slot, x, y) {
    ghost = document.createElement('div');
    ghost.className = 'spelling-slot filled spelling-ghost';
    ghost.textContent = slot.textContent;
    ghost.style.left = x + 'px';
    ghost.style.top = y + 'px';
    document.body.appendChild(ghost);
  }

  function onPointerDown(e) {
    if (locked) return;
    const slot = e.target.closest('.spelling-slot:not(.fixed)');
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
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (!dragStarted) {
      if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
      dragStarted = true;
      const slot = container.querySelector(`.spelling-slot[data-index="${dragIndex}"]`);
      if (slot) {
        slot.classList.add('dragging');
        createGhost(slot, e.clientX, e.clientY);
      }
    }

    if (ghost) {
      ghost.style.left = e.clientX + 'px';
      ghost.style.top = e.clientY + 'px';
    }

    // Highlight drop target
    allSlots.forEach(s => s.classList.remove('drop-target'));
    const targetIdx = getSlotAtPoint(e.clientX, e.clientY);
    if (targetIdx !== null && targetIdx !== dragIndex) {
      const targetEl = container.querySelector(`.spelling-slot[data-index="${targetIdx}"]`);
      if (targetEl) targetEl.classList.add('drop-target');
    }
  }

  function onPointerUp(e) {
    if (dragIndex === null) return;

    const slot = container.querySelector(`.spelling-slot[data-index="${dragIndex}"]`);

    // Clean up listeners
    if (slot) {
      slot.releasePointerCapture(e.pointerId);
      slot.removeEventListener('pointermove', onPointerMove);
      slot.removeEventListener('pointerup', onPointerUp);
      slot.removeEventListener('pointercancel', onPointerUp);
      slot.classList.remove('dragging');
    }

    // Remove ghost
    if (ghost) {
      ghost.remove();
      ghost = null;
    }

    // Clear drop targets
    allSlots.forEach(s => s.classList.remove('drop-target'));

    if (dragStarted) {
      // Drag completed — check drop target
      const targetIdx = getSlotAtPoint(e.clientX, e.clientY);
      if (targetIdx !== null && targetIdx !== dragIndex) {
        swapSlots(dragIndex, targetIdx);
      }
    }

    dragIndex = null;
    dragStarted = false;
  }

  slotsContainer.addEventListener('pointerdown', onPointerDown);

  // Submit button
  submitBtn.addEventListener('click', () => {
    if (locked) return;
    if (checkCallback) checkCallback(getArrangedString());
  });

  function showCorrect() {
    locked = true;
    container.querySelectorAll('.spelling-slot:not(.fixed)').forEach(s => {
      s.classList.add('correct');
    });
  }

  function showWrong() {
    for (let i = 0; i < scrambled.length; i++) {
      if (scrambled[i].isFixed) continue;
      const slotEl = container.querySelector(`.spelling-slot[data-index="${i}"]`);
      if (slotChars[i].toLowerCase() !== name[i].toLowerCase()) {
        if (slotEl) slotEl.classList.add('wrong');
      }
    }
  }

  function clearWrong() {
    container.querySelectorAll('.spelling-slot.wrong').forEach(s => {
      s.classList.remove('wrong');
    });
  }

  return {
    onCheck(cb) { checkCallback = cb; },
    showCorrect,
    showWrong,
    clearWrong,
    lock() { locked = true; },
    unlock() { locked = false; }
  };
}
