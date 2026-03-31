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
    <div class="carmen-narrative" id="carmen-narrative"></div>
    <div class="carmen-status-bar">
      <div class="carmen-lives" id="carmen-lives"></div>
      <div class="pill">Score: <b id="carmen-score">0</b></div>
      <div class="carmen-progress" id="carmen-progress"></div>
    </div>
    <div class="carmen-map-wrap">
      <svg id="carmen-map" viewBox="0 0 600 320" preserveAspectRatio="xMidYMid meet"></svg>
    </div>
    <div class="carmen-clues" id="carmen-clues"></div>
    <div id="carmen-extra-clue-wrap"></div>
    <div class="carmen-neighbors-label" id="carmen-neighbors-label">Where did the thief go?</div>
    <div class="carmen-neighbors" id="carmen-neighbors"></div>
  `;

  const els = {
    narrative: container.querySelector('#carmen-narrative'),
    lives: container.querySelector('#carmen-lives'),
    score: container.querySelector('#carmen-score'),
    progress: container.querySelector('#carmen-progress'),
    map: container.querySelector('#carmen-map'),
    clues: container.querySelector('#carmen-clues'),
    extraClueWrap: container.querySelector('#carmen-extra-clue-wrap'),
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
      els.clues.innerHTML = clues.map(c => `
        <div class="carmen-clue">
          <span class="carmen-clue-icon">${c.icon}</span>
          <span class="carmen-clue-text">${esc(c.text)}</span>
        </div>
      `).join('');
    },

    addClue(clue) {
      const div = document.createElement('div');
      div.className = 'carmen-clue';
      div.innerHTML = `
        <span class="carmen-clue-icon">${clue.icon}</span>
        <span class="carmen-clue-text">${esc(clue.text)}</span>
      `;
      els.clues.appendChild(div);
    },

    showExtraClueButton(enabled, onClick) {
      if (!enabled) {
        els.extraClueWrap.innerHTML = '';
        return;
      }
      els.extraClueWrap.innerHTML = `
        <button class="carmen-extra-clue-btn" id="carmen-extra-btn">
          🔎 Extra Clue <span class="carmen-extra-clue-cost">(-20 pts)</span>
        </button>
      `;
      els.extraClueWrap.querySelector('#carmen-extra-btn').addEventListener('click', onClick);
    },

    disableExtraClueButton() {
      const btn = els.extraClueWrap.querySelector('#carmen-extra-btn');
      if (btn) btn.disabled = true;
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
      els.extraClueWrap.innerHTML = '';
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
