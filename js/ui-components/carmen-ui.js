/**
 * Carmen UI — DOM rendering for "Where in the World?" game.
 */

/**
 * Build the full game UI inside the given container.
 * Returns an API object with methods to update each section.
 *
 * @param {HTMLElement} container  — the element to render into
 * @param {Object}      flagCodes — { countryName: isoCode }
 */
export function createCarmenUI(container, flagCodes) {
  // Build skeleton
  container.innerHTML = `
    <div class="carmen-status-bar">
      <div class="carmen-lives" id="carmen-lives"></div>
      <div class="pill">Score: <b id="carmen-score">0</b></div>
      <div class="carmen-progress" id="carmen-progress"></div>
    </div>
    <div class="carmen-narrative" id="carmen-narrative"></div>
    <div class="carmen-map-wrap">
      <svg id="carmen-map" viewBox="0 0 600 320" preserveAspectRatio="xMidYMid meet"></svg>
      <button class="carmen-map-hint" id="carmen-map-hint" title="Extra Clue (-20 pts)"></button>
    </div>
    <div class="carmen-clues" id="carmen-clues"></div>
    <div class="carmen-neighbors-label" id="carmen-neighbors-label">Where did the thief go?</div>
    <div class="carmen-neighbors" id="carmen-neighbors"></div>
  `;

  const els = {
    narrative: container.querySelector('#carmen-narrative'),
    lives: container.querySelector('#carmen-lives'),
    score: container.querySelector('#carmen-score'),
    progress: container.querySelector('#carmen-progress'),
    map: container.querySelector('#carmen-map'),
    hintBtn: container.querySelector('#carmen-map-hint'),
    clues: container.querySelector('#carmen-clues'),
    neighborsLabel: container.querySelector('#carmen-neighbors-label'),
    neighbors: container.querySelector('#carmen-neighbors'),
  };

  function flagImg(country) {
    const code = flagCodes[country];
    if (!code) return '';
    return `<img src="img/flags/${code}.svg" alt="" loading="lazy">`;
  }

  return {
    get mapSvg() { return els.map; },

    showIntro(thiefName, artifact, startCountry) {
      const siteName = artifact.siteName || 'a priceless artifact';
      els.narrative.innerHTML = `
        <span class="thief-name">${esc(thiefName)}</span> has stolen
        <strong>${esc(siteName)}</strong> from ${esc(startCountry)}!<br>
        Track the thief through neighboring countries.
      `;
    },

    showStopNarrative(stopIndex, totalStops) {
      const remaining = totalStops - stopIndex;
      if (remaining <= 1) {
        els.narrative.innerHTML = `The thief is cornered — this is the <strong>final stop</strong>!`;
      } else {
        els.narrative.innerHTML = `Intel says the thief is <strong>${remaining} ${remaining === 1 ? 'stop' : 'stops'}</strong> ahead. Follow the clues.`;
      }
    },

    updateScore(score) {
      els.score.textContent = score;
    },

    updateLives(current, max) {
      let html = '';
      for (let i = 0; i < max; i++) {
        html += `<span class="heart ${i < current ? '' : 'lost'}">&#x2764;&#xFE0F;</span>`;
      }
      els.lives.innerHTML = html;
    },

    updateProgress(stop, total) {
      els.progress.textContent = `Stop ${stop + 1} of ${total}`;
    },

    showClues(clues) {
      const iconsHtml = clues.map((c, i) => `
        <button class="carmen-clue-tab" data-index="${i}">
          ${c.icon}<span class="carmen-clue-tab-label">Clue ${i + 1}</span>
        </button>
      `).join('');
      els.clues.innerHTML = `
        <div class="carmen-clue-tabs">${iconsHtml}</div>
        <div class="carmen-clue-reveal" id="carmen-clue-reveal"></div>
      `;
      this._clueData = [...clues];
      this._bindClueTabs();
    },

    _bindClueTabs() {
      const reveal = els.clues.querySelector('#carmen-clue-reveal');
      const tabs = els.clues.querySelectorAll('.carmen-clue-tab');
      const clues = this._clueData;

      tabs.forEach((tab, i) => {
        tab.addEventListener('click', () => {
          tabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          reveal.innerHTML = `<span class="carmen-clue-text">${esc(clues[i].text)}</span>`;
          reveal.style.display = '';
        });
      });

      // Don't auto-reveal — let the player tap
      reveal.style.display = 'none';
    },

    addClue(clue) {
      this._clueData.push(clue);
      const tabsRow = els.clues.querySelector('.carmen-clue-tabs');
      if (!tabsRow) return;

      const index = this._clueData.length - 1;
      const btn = document.createElement('button');
      btn.className = 'carmen-clue-tab';
      btn.dataset.index = index;
      btn.innerHTML = `${clue.icon}<span class="carmen-clue-tab-label">Clue ${index + 1}</span>`;
      tabsRow.appendChild(btn);

      const reveal = els.clues.querySelector('#carmen-clue-reveal');
      btn.addEventListener('click', () => {
        tabsRow.querySelectorAll('.carmen-clue-tab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        reveal.innerHTML = `<span class="carmen-clue-text">${esc(clue.text)}</span>`;
        reveal.style.display = '';
      });

      // Auto-reveal the new clue
      btn.click();
    },

    showExtraClueButton(enabled, onClick) {
      els.hintBtn.style.display = '';
      els.hintBtn.disabled = !enabled;
      // Remove old listener by cloning
      const fresh = els.hintBtn.cloneNode(true);
      els.hintBtn.replaceWith(fresh);
      els.hintBtn = fresh;
      if (enabled) {
        fresh.addEventListener('click', onClick);
      }
    },

    disableExtraClueButton() {
      els.hintBtn.disabled = true;
    },

    showNeighbors(neighbors, onPick) {
      els.neighborsLabel.style.display = '';
      els.neighbors.innerHTML = neighbors.map(name => `
        <button class="carmen-neighbor-btn" data-country="${esc(name)}">
          ${flagImg(name)}
          <span>${esc(name)}</span>
        </button>
      `).join('');

      els.neighbors.querySelectorAll('.carmen-neighbor-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const country = btn.dataset.country;
          onPick(country);
        });
      });
    },

    highlightNeighbor(country, correct) {
      const btn = els.neighbors.querySelector(`[data-country="${CSS.escape(country)}"]`);
      if (btn) {
        btn.classList.add(correct ? 'correct' : 'wrong');
        if (!correct) btn.disabled = true;
      }
    },

    disableAllNeighbors() {
      els.neighbors.querySelectorAll('.carmen-neighbor-btn').forEach(b => b.disabled = true);
    },

    clearNeighbors() {
      els.neighbors.innerHTML = '';
      els.neighborsLabel.style.display = 'none';
    },

    showTransition(stopScore, country) {
      els.clues.innerHTML = '';
      els.hintBtn.style.display = 'none';
      els.neighbors.innerHTML = `
        <div class="carmen-transition">
          <div class="score-gained">+${stopScore} points</div>
          <div>The thief was spotted in <strong>${esc(country)}</strong>! The chase continues...</div>
        </div>
      `;
      els.neighborsLabel.style.display = 'none';
    },
  };
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
