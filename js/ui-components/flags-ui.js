/**
 * Flags Quiz UI Component
 * Shared UI rendering for both standalone and Daily Challenge modes.
 */

/**
 * Renders the Flags Quiz UI
 * @param {HTMLElement} container - Container to render into
 * @param {object} roundData - { country: string, options: [{country, iso}, ...] }
 * @returns {object} UI controls and methods
 */
export function renderFlagsUI(container, roundData) {
  const { country, options: flagOptions } = roundData;

  const html = `
    <div style="max-width:600px;margin:0 auto;">
      <div class="country" id="flags-country-name" style="font-size:1.6rem;font-weight:bold;margin-bottom:1.5rem;">${country}</div>
      <div id="flags-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;position:relative;">
        ${flagOptions.map(opt => `
          <button class="flag-option" data-country="${escapeAttr(opt.country)}"
            style="background:var(--card-bg,rgba(255,255,255,0.05));border:1px solid var(--border-color,rgba(255,255,255,0.1));border-radius:12px;padding:10px;cursor:pointer;transition:transform 0.15s,outline 0.15s;outline:none;">
            <img src="img/flags/${opt.iso}.svg" alt="${escapeAttr(opt.country)} flag"
                 style="width:100%;aspect-ratio:3/2;object-fit:cover;border-radius:4px;display:block;pointer-events:none;border:1px solid rgba(128,128,128,0.25);">
            <div style="font-size:0.8rem;margin-top:6px;color:var(--text-color,#fff);text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${opt.country}</div>
          </button>
        `).join('')}
      </div>
      <div id="flags-feedback" class="status" style="display:none;margin-top:1rem;text-align:center;font-weight:600;"></div>
    </div>
  `;

  container.innerHTML = html;

  const elements = {
    countryName: document.getElementById('flags-country-name'),
    grid: document.getElementById('flags-grid'),
    feedback: document.getElementById('flags-feedback')
  };

  function getButtons() {
    return elements.grid ? Array.from(elements.grid.querySelectorAll('.flag-option')) : [];
  }

  function disableAll() {
    getButtons().forEach(btn => {
      btn.disabled = true;
      btn.style.cursor = 'default';
    });
  }

  function highlightAnswer(correctCountry, selectedCountry) {
    getButtons().forEach(btn => {
      const btnCountry = btn.dataset.country;
      if (btnCountry === correctCountry) {
        btn.style.outline = '3px solid var(--good-color, #22c55e)';
      } else if (btnCountry === selectedCountry && selectedCountry !== correctCountry) {
        btn.style.outline = '3px solid var(--bad-color, #ef4444)';
      }
    });
  }

  /**
   * Animate the correct flag to expand and fill the 2×2 grid area.
   * Call this after a wrong answer to help the player memorise the correct flag.
   */
  function animateCorrectFlag(correctCountry) {
    const grid = elements.grid;
    if (!grid) return;

    const correctBtn = getButtons().find(btn => btn.dataset.country === correctCountry);
    if (!correctBtn) return;

    const correctOpt = flagOptions.find(o => o.country === correctCountry);
    if (!correctOpt) return;

    // Measure start position (button) and target (entire grid) relative to grid container
    const gridRect = grid.getBoundingClientRect();
    const btnRect  = correctBtn.getBoundingClientRect();
    const startLeft = btnRect.left - gridRect.left;
    const startTop  = btnRect.top  - gridRect.top;

    // Fade out all buttons (the expanding overlay will cover them)
    getButtons().forEach(btn => {
      btn.style.transition = 'opacity 0.25s ease';
      btn.style.opacity = '0';
    });

    // Create expanding overlay, starting exactly over the correct button
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: absolute;
      left: ${startLeft}px;
      top: ${startTop}px;
      width: ${btnRect.width}px;
      height: ${btnRect.height}px;
      border-radius: 12px;
      overflow: hidden;
      border: 3px solid var(--good-color, #22c55e);
      box-shadow: 0 4px 24px rgba(34,197,94,0.35);
      z-index: 10;
      background: var(--card-bg, #1e293b);
      transition: left 0.45s ease, top 0.45s ease, width 0.45s ease, height 0.45s ease;
      pointer-events: none;
    `;

    const img = document.createElement('img');
    img.src = `img/flags/${correctOpt.iso}.svg`;
    img.alt = `${correctOpt.country} flag`;
    // object-fit:contain so the full flag is always visible, centred on the bg
    img.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block;padding:12px;box-sizing:border-box;';
    overlay.appendChild(img);

    grid.appendChild(overlay);

    // On the next two frames, animate to fill the full grid
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        overlay.style.left   = '0px';
        overlay.style.top    = '0px';
        overlay.style.width  = `${grid.offsetWidth}px`;
        overlay.style.height = `${grid.offsetHeight}px`;
      });
    });
  }

  function showFeedback(message, isCorrect) {
    if (!elements.feedback) return;
    elements.feedback.textContent = message;
    elements.feedback.style.display = 'block';
    elements.feedback.style.color = isCorrect
      ? 'var(--good-color, #22c55e)'
      : 'var(--bad-color, #ef4444)';
  }

  function setupEvents({ onClick }) {
    if (!elements.grid) return;
    elements.grid.addEventListener('click', (e) => {
      const btn = e.target.closest('.flag-option');
      if (!btn || btn.disabled) return;
      onClick(btn.dataset.country);
    });

    // Hover lift effect
    getButtons().forEach(btn => {
      btn.addEventListener('mouseenter', () => {
        if (!btn.disabled) btn.style.transform = 'scale(1.03)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = '';
      });
    });
  }

  return {
    elements,
    setupEvents,
    highlightAnswer,
    animateCorrectFlag,
    disableAll,
    showFeedback
  };
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
