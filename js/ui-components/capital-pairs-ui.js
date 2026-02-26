/**
 * Capital Pairs UI Component
 *
 * Renders two columns of buttons (countries | capitals) and manages
 * selection state. Pure renderer — no game logic.
 */

function escapeAttr(str) {
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function injectStyles() {
  if (document.getElementById('capital-pairs-styles')) return;
  const style = document.createElement('style');
  style.id = 'capital-pairs-styles';
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
  `;
  document.head.appendChild(style);
}

/**
 * @param {HTMLElement} container
 * @param {{ countries: string[], capitals: string[] }} param1
 * @returns {{ setupEvents, markCorrect, markWrong }}
 */
export function renderCapitalPairsUI(container, { countries, capitals }) {
  injectStyles();

  container.innerHTML = `
    <div class="pairs-grid">
      <div class="pairs-col-header">
        <span class="muted">Countries</span>
        <span class="muted">Capitals</span>
      </div>
      <div class="pairs-columns">
        <div class="pairs-column" id="pairs-countries">
          ${countries.map(c => `<button class="pair-card" data-type="country" data-value="${escapeAttr(c)}">${escapeHtml(c)}</button>`).join('')}
        </div>
        <div class="pairs-column" id="pairs-capitals">
          ${capitals.map(c => `<button class="pair-card" data-type="capital" data-value="${escapeAttr(c)}">${escapeHtml(c)}</button>`).join('')}
        </div>
      </div>
    </div>
  `;

  let selected = null; // { type, value }

  function getCard(type, value) {
    const colId = type === 'country' ? 'pairs-countries' : 'pairs-capitals';
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
        const countryVal = type === 'country' ? value : selected.value;
        const capitalVal = type === 'capital' ? value : selected.value;
        clearSelection();
        onAttempt(countryVal, capitalVal);
      }
    });
  }

  function markCorrect(country, capital, cb) {
    const cc = getCard('country', country);
    const cp = getCard('capital', capital);
    if (cc) cc.classList.add('correct');
    if (cp) cp.classList.add('correct');
    disableAll();
    setTimeout(cb, 450);
  }

  function markWrong(country, capital, cb) {
    const cc = getCard('country', country);
    const cp = getCard('capital', capital);
    if (cc) { cc.classList.add('wrong', 'shake-wrong'); }
    if (cp) { cp.classList.add('wrong', 'shake-wrong'); }
    disableAll();
    setTimeout(cb, 700);
  }

  return { setupEvents, markCorrect, markWrong };
}
