/**
 * Pairs UI Component
 *
 * Renders two columns of buttons (left | right) and manages
 * selection state. Pure renderer — no game logic.
 */

function escapeAttr(str) {
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function injectStyles() {
  if (document.getElementById('pairs-styles')) return;
  const style = document.createElement('style');
  style.id = 'pairs-styles';
  style.textContent = `
    .pairs-grid { display: flex; flex-direction: column; gap: 8px; }
    .pairs-col-header {
      display: flex; justify-content: space-around;
      padding: 0 4px; font-size: .85rem;
    }
    .pairs-columns { display: flex; gap: 12px; }
    .pairs-column { flex: 1; display: flex; flex-direction: column; gap: 10px; }
    .pair-card {
      padding: 14px 8px;
      border-radius: 12px;
      border: 2px solid var(--card-border);
      background: var(--card-bg);
      cursor: pointer;
      font-size: .95rem;
      text-align: center;
      transition: border-color .15s, background .15s, transform .1s;
      min-height: 52px;
      width: 100%;
      color: inherit;
      line-height: 1.3;
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .pair-card:hover:not(:disabled) {
      transform: translateY(-2px);
      border-color: rgba(129,140,248,0.5);
    }
    .pair-card.selected {
      border-color: #818cf8;
      background: rgba(129,140,248,.12);
    }
    .pair-card.correct {
      border-color: var(--correct-border);
      background: var(--correct-bg);
    }
    .pair-card.wrong {
      border-color: var(--wrong-border);
      background: var(--wrong-bg);
    }
    .pair-card:disabled { cursor: default; }
    .pair-flag { width: 56px; height: auto; border-radius: 3px; pointer-events: none; }
    .pair-outline { width: 56px; max-height: 56px; pointer-events: none; }
  `;
  document.head.appendChild(style);
}

/**
 * @param {HTMLElement} container
 * @param {{ leftItems: string[], rightItems: string[], leftLabel?: string, rightLabel?: string }} opts
 * @returns {{ setupEvents, markCorrect, markWrong }}
 */
export function renderPairsUI(container, { leftItems, rightItems, leftLabel = 'Countries', rightLabel = 'Capitals', renderRight, outlineData }) {
  injectStyles();

  container.innerHTML = `
    <div class="pairs-grid">
      <div class="pairs-col-header">
        <span class="muted">${escapeHtml(leftLabel)}</span>
        <span class="muted">${escapeHtml(rightLabel)}</span>
      </div>
      <div class="pairs-columns">
        <div class="pairs-column" id="pairs-left">
          ${leftItems.map(c => `<button class="pair-card" data-type="left" data-value="${escapeAttr(c)}">${escapeHtml(c)}</button>`).join('')}
        </div>
        <div class="pairs-column" id="pairs-right">
          ${rightItems.map(c => {
            let inner;
            if (renderRight === 'flag') {
              inner = `<img src="img/flags/${escapeAttr(c)}.svg" alt="Flag" class="pair-flag">`;
            } else if (renderRight === 'outline' && outlineData) {
              const od = outlineData.get(c);
              inner = od
                ? `<svg class="pair-outline" viewBox="${escapeAttr(od.viewBox)}" xmlns="http://www.w3.org/2000/svg"><path d="${escapeAttr(od.pathData)}" fill="var(--map-country-fill-highlight)" stroke="var(--map-country-stroke-highlight)" stroke-width="0.8" vector-effect="non-scaling-stroke"/></svg>`
                : escapeHtml(c);
            } else {
              inner = escapeHtml(c);
            }
            return `<button class="pair-card" data-type="right" data-value="${escapeAttr(c)}">${inner}</button>`;
          }).join('')}
        </div>
      </div>
    </div>
  `;

  let selected = null; // { type, value }

  function getCard(type, value) {
    const colId = type === 'left' ? 'pairs-left' : 'pairs-right';
    const col = document.getElementById(colId);
    if (!col) return null;
    return Array.from(col.querySelectorAll('.pair-card')).find(b => b.dataset.value === value) || null;
  }

  function clearSelection() {
    if (selected) {
      const card = getCard(selected.type, selected.value);
      if (card) card.classList.remove('selected');
      selected = null;
    }
  }

  function disableAll() {
    container.querySelectorAll('.pair-card').forEach(btn => { btn.disabled = true; });
  }

  function setupEvents({ onAttempt }) {
    const columnsEl = container.querySelector('.pairs-columns');
    if (!columnsEl) return;

    columnsEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.pair-card');
      if (!btn || btn.disabled) return;

      const type  = btn.dataset.type;
      const value = btn.dataset.value;

      if (!selected) {
        // Nothing selected → select this card
        selected = { type, value };
        btn.classList.add('selected');
      } else if (selected.type === type && selected.value === value) {
        // Same card → deselect
        btn.classList.remove('selected');
        selected = null;
      } else if (selected.type === type) {
        // Same column, different card → switch selection
        clearSelection();
        selected = { type, value };
        btn.classList.add('selected');
      } else {
        // Opposite column → submit attempt
        const leftVal  = type === 'left' ? value : selected.value;
        const rightVal = type === 'right' ? value : selected.value;
        clearSelection();
        onAttempt(leftVal, rightVal);
      }
    });
  }

  function markCorrect(left, right, cb) {
    const lc = getCard('left', left);
    const rc = getCard('right', right);
    if (lc) lc.classList.add('correct');
    if (rc) rc.classList.add('correct');
    disableAll();
    setTimeout(cb, 450);
  }

  function markWrong(left, right, cb) {
    const lc = getCard('left', left);
    const rc = getCard('right', right);
    if (lc) { lc.classList.add('wrong', 'shake-wrong'); }
    if (rc) { rc.classList.add('wrong', 'shake-wrong'); }
    disableAll();
    setTimeout(cb, 700);
  }

  return { setupEvents, markCorrect, markWrong };
}
