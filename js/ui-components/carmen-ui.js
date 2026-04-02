/**
 * Carmen UI — DOM rendering for "Where in the World?" game.
 */

import { playStamp, playTypeKey } from '../carmen-audio.js';

/**
 * Typewriter effect — reveals text letter-by-letter with key sounds.
 * Returns a promise that resolves when done. Click skips to full text.
 */
function typewriter(element, text, speed = 25) {
  return new Promise(resolve => {
    element.textContent = '';
    element.classList.add('typewriter-active');
    let i = 0;
    let skip = false;
    let keyCount = 0;

    function onClick() {
      skip = true;
    }
    element.addEventListener('click', onClick);

    function tick() {
      if (skip || i >= text.length) {
        element.textContent = text;
        element.classList.remove('typewriter-active');
        element.removeEventListener('click', onClick);
        resolve();
        return;
      }
      element.textContent += text[i];
      // Play key sound every 2-3 characters to avoid audio overload
      if (text[i] !== ' ' && keyCount++ % 2 === 0) {
        playTypeKey();
      }
      i++;
      setTimeout(tick, speed);
    }
    tick();
  });
}

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
    <div class="carmen-briefing-overlay" id="carmen-briefing" style="display:none">
      <div class="carmen-briefing-content">
        <div class="carmen-briefing-stamp">CLASSIFIED</div>
        <div class="carmen-briefing-label">CASE BRIEFING</div>
        <div class="carmen-briefing-artifact" id="carmen-briefing-artifact"></div>
        <div class="carmen-briefing-suspect">
          <div class="carmen-suspect-badge">🔍 SUSPECT: UNKNOWN</div>
          <div class="carmen-suspect-hint">Gather clues to identify the thief</div>
        </div>
        <div class="carmen-briefing-mission" id="carmen-briefing-mission"></div>
        <button class="carmen-briefing-start" id="carmen-briefing-start">Accept Mission →</button>
      </div>
    </div>
    <div class="carmen-status-bar">
      <div class="carmen-lives" id="carmen-lives"></div>
      <div class="pill">Score: <b id="carmen-score">0</b></div>
      <div class="carmen-progress" id="carmen-progress"></div>
      <div class="carmen-clock" id="carmen-clock"></div>
      <button class="carmen-dossier-btn" id="carmen-dossier-btn" title="Case Dossier">📋</button>
    </div>
    <div class="carmen-dossier" id="carmen-dossier" style="display:none">
      <div class="carmen-dossier-header">
        <span>📋 Case Dossier</span>
        <button class="carmen-dossier-close" id="carmen-dossier-close">✕</button>
      </div>
      <div class="carmen-dossier-body" id="carmen-dossier-body"></div>
    </div>
    <div class="carmen-intro-row" id="carmen-intro-row">
      <div class="carmen-narrative" id="carmen-narrative"></div>
      <div class="carmen-map-wrap">
        <div class="carmen-map-header" id="carmen-map-header" style="display:none">Where did the thief go?</div>
        <svg id="carmen-map" viewBox="0 0 600 320" preserveAspectRatio="xMidYMid meet"></svg>
        <div class="carmen-map-sidebar" id="carmen-map-sidebar"></div>
      </div>
    </div>
    <div class="carmen-locations-label" id="carmen-locations-label" style="display:none">Investigate a location:</div>
    <div class="carmen-locations" id="carmen-locations"></div>
    <div class="carmen-clue-reveal" id="carmen-clue-reveal"></div>
  `;

  const els = {
    briefing: container.querySelector('#carmen-briefing'),
    briefingArtifact: container.querySelector('#carmen-briefing-artifact'),
    briefingMission: container.querySelector('#carmen-briefing-mission'),
    briefingStart: container.querySelector('#carmen-briefing-start'),
    introRow: container.querySelector('#carmen-intro-row'),
    narrative: container.querySelector('#carmen-narrative'),
    lives: container.querySelector('#carmen-lives'),
    score: container.querySelector('#carmen-score'),
    progress: container.querySelector('#carmen-progress'),
    clock: container.querySelector('#carmen-clock'),
    dossierBtn: container.querySelector('#carmen-dossier-btn'),
    dossier: container.querySelector('#carmen-dossier'),
    dossierBody: container.querySelector('#carmen-dossier-body'),
    dossierClose: container.querySelector('#carmen-dossier-close'),
    locationsLabel: container.querySelector('#carmen-locations-label'),
    locations: container.querySelector('#carmen-locations'),
    // Neighbor buttons removed — neighbors are now on the map
    map: container.querySelector('#carmen-map'),
    mapHeader: container.querySelector('#carmen-map-header'),
    mapWrap: container.querySelector('.carmen-map-wrap'),
    sidebar: container.querySelector('#carmen-map-sidebar'),
    reveal: container.querySelector('#carmen-clue-reveal'),
    neighbors: container.querySelector('#carmen-neighbors'),
  };

  function flagImg(country) {
    const code = flagCodes[country];
    if (!code) return '';
    return `<img src="img/flags/${code}.svg" alt="" loading="lazy">`;
  }

  // Dossier state
  const dossierEntries = []; // [{stop, clueText, informantPrefix}]

  // Toggle dossier panel
  els.dossierBtn.addEventListener('click', () => {
    const showing = els.dossier.style.display !== 'none';
    els.dossier.style.display = showing ? 'none' : '';
  });
  els.dossierClose.addEventListener('click', () => {
    els.dossier.style.display = 'none';
  });

  function renderDossier() {
    if (dossierEntries.length === 0) {
      els.dossierBody.innerHTML = '<div class="carmen-dossier-empty">No clues gathered yet. Investigate locations to find leads.</div>';
      return;
    }
    // Group by stop
    const byStop = {};
    for (const entry of dossierEntries) {
      if (!byStop[entry.stop]) byStop[entry.stop] = [];
      byStop[entry.stop].push(entry);
    }
    let html = '';
    for (const [stop, entries] of Object.entries(byStop)) {
      html += `<div class="carmen-dossier-stop">Stop ${Number(stop) + 1}</div>`;
      for (const e of entries) {
        html += `<div class="carmen-dossier-entry">
          <span class="carmen-dossier-prefix">${esc(e.informantPrefix || 'Clue')}:</span>
          <span>${esc(e.clueText)}</span>
        </div>`;
      }
    }
    els.dossierBody.innerHTML = html;
    // Auto-scroll to bottom
    els.dossierBody.scrollTop = els.dossierBody.scrollHeight;
  }

  return {
    get mapSvg() { return els.map; },

    showMapHeader() { els.mapHeader.style.display = ''; },
    hideMapHeader() { els.mapHeader.style.display = 'none'; },

    /** Add a clue to the dossier. */
    addDossierEntry(stop, clueText, informantPrefix) {
      dossierEntries.push({ stop, clueText, informantPrefix });
      renderDossier();
    },

    /** Reset the dossier for a new game. */
    resetDossier() {
      dossierEntries.length = 0;
      renderDossier();
    },

    /** Show dramatic case briefing overlay. Returns a promise that resolves when player clicks start. */
    showCaseBriefing(artifact, startCountry) {
      return new Promise(resolve => {
        const siteName = artifact.siteName || 'a priceless artifact';
        els.briefingArtifact.innerHTML = `
          <div class="carmen-artifact-label">STOLEN ARTIFACT</div>
          <div class="carmen-artifact-name">${esc(siteName)}</div>
          <div class="carmen-artifact-origin">Last seen in ${esc(startCountry)}</div>
        `;
        els.briefingMission.textContent = '';
        els.briefing.style.display = 'flex';

        // Hide stamp and start button until user interacts
        const stamp = els.briefing.querySelector('.carmen-briefing-stamp');
        stamp.classList.remove('animate');
        els.briefingStart.style.display = 'none';

        // Show "tap to open" prompt
        const tapHint = document.createElement('div');
        tapHint.className = 'carmen-tap-hint';
        tapHint.textContent = 'Tap to open dossier';
        els.briefing.querySelector('.carmen-briefing-content').appendChild(tapHint);

        // First click unlocks audio and triggers the reveal
        function onFirstClick() {
          els.briefing.removeEventListener('click', onFirstClick);
          tapHint.remove();

          // Stamp animation + sound (user has interacted, audio is unlocked)
          stamp.classList.add('animate');
          setTimeout(() => playStamp(), 300);

          // Typewriter with sounds
          typewriter(els.briefingMission, 'Track the thief through neighboring countries. Investigate locations, gather clues, and identify the suspect to make your arrest.', 20)
            .then(() => {
              els.briefingStart.style.display = '';
            });
        }
        els.briefing.addEventListener('click', onFirstClick);

        els.briefingStart.onclick = () => {
          els.briefing.style.display = 'none';
          resolve();
        };
      });
    },

    showIntro(thiefName, artifact, startCountry) {
      const siteName = artifact.siteName || 'a priceless artifact';
      // Side-by-side layout for intro: artifact card + map
      els.introRow.classList.add('side-by-side');
      els.narrative.innerHTML = `
        <div class="carmen-intro-card">
          <div class="carmen-intro-badge">ACTIVE CASE</div>
          <div class="carmen-intro-artifact">${esc(siteName)}</div>
          <div class="carmen-intro-origin">Stolen from <strong>${esc(startCountry)}</strong></div>
          <div class="carmen-intro-suspect">🔍 Suspect: <span class="thief-name">Unknown</span></div>
          <div class="carmen-intro-mission">Investigate locations, gather clues, and follow the trail.</div>
        </div>
      `;
    },

    showStopNarrative(stopIndex, totalStops) {
      // Collapse back to stacked layout for subsequent stops
      els.introRow.classList.remove('side-by-side');
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

    updateClock(hoursRemaining, totalHours) {
      const days = Math.floor(hoursRemaining / 24);
      const hours = hoursRemaining % 24;
      els.clock.textContent = `⏰ ${days}d ${hours}h`;
      // Pulse when low
      const pct = hoursRemaining / totalHours;
      els.clock.classList.toggle('low', pct < 0.25);
      els.clock.classList.toggle('critical', pct < 0.12);
    },

    showClues(clues, informants) {
      this._clueData = [...clues];
      this._informants = informants || [];
      els.sidebar.innerHTML = clues.map((c, i) => {
        const inf = this._informants[i];
        const icon = inf ? inf.emoji : c.icon;
        return `<button class="carmen-clue-icon" data-index="${i}">${icon}</button>`;
      }).join('');
      els.reveal.style.display = 'none';
      els.reveal.innerHTML = '';
      this._bindClueIcons();
      this._updateMapMinHeight();
    },

    _bindClueIcons() {
      const icons = els.sidebar.querySelectorAll('.carmen-clue-icon');
      const clues = this._clueData;
      const informants = this._informants;

      icons.forEach((icon, i) => {
        icon.addEventListener('click', () => {
          icons.forEach(ic => ic.classList.remove('active'));
          icon.classList.add('active');
          const inf = informants[i];
          if (inf) {
            els.reveal.innerHTML = `
              <div class="carmen-informant">
                <div class="carmen-informant-header">
                  <span class="carmen-informant-emoji">${inf.emoji}</span>
                  <span class="carmen-informant-prefix">${esc(inf.prefix)}:</span>
                </div>
                <div class="carmen-informant-bubble">
                  <span class="carmen-clue-text">"${esc(clues[i].text)}"</span>
                </div>
              </div>
            `;
          } else {
            els.reveal.innerHTML = `<span class="carmen-clue-text">${esc(clues[i].text)}</span>`;
          }
          els.reveal.style.display = '';
        });
      });
    },

    _updateMapMinHeight() {
      // Ensure map is tall enough for sidebar icons + hint button
      const iconCount = els.sidebar.querySelectorAll('.carmen-clue-icon').length;
      // Each icon ~44px + 6px gap, plus hint button ~40px + 12px spacing
      const needed = iconCount * 50 + 12 + 40 + 16;
      els.mapWrap.style.minHeight = needed + 'px';
    },

    addClue(clue, informant) {
      this._clueData.push(clue);
      if (informant) this._informants.push(informant);
      else this._informants.push(null);
      const index = this._clueData.length - 1;
      const btn = document.createElement('button');
      btn.className = 'carmen-clue-icon';
      btn.dataset.index = index;
      btn.textContent = informant ? informant.emoji : clue.icon;
      els.sidebar.appendChild(btn);

      const inf = informant;
      btn.addEventListener('click', () => {
        els.sidebar.querySelectorAll('.carmen-clue-icon').forEach(ic => ic.classList.remove('active'));
        btn.classList.add('active');
        if (inf) {
          els.reveal.innerHTML = `
            <div class="carmen-informant">
              <div class="carmen-informant-header">
                <span class="carmen-informant-emoji">${inf.emoji}</span>
                <span class="carmen-informant-prefix">${esc(inf.prefix)}:</span>
              </div>
              <div class="carmen-informant-bubble">
                <span class="carmen-clue-text">"${esc(clue.text)}"</span>
              </div>
            </div>
          `;
        } else {
          els.reveal.innerHTML = `<span class="carmen-clue-text">${esc(clue.text)}</span>`;
        }
        els.reveal.style.display = '';
      });

      this._updateMapMinHeight();
      // Auto-reveal the new clue
      btn.click();
    },

    /**
     * Show investigation location cards.
     * @param {Array} locations — [{id, emoji, name}]
     * @param {number} maxInvestigations — how many the player can pick
     * @param {Function} onInvestigate — called with (locationId) when player picks a location
     */
    showLocations(locations, maxInvestigations, onInvestigate) {
      this._investigationsLeft = maxInvestigations;
      this._investigatedIds = new Set();
      els.locationsLabel.style.display = '';
      els.locationsLabel.textContent = `Investigate a location (${this._investigationsLeft} remaining):`;
      els.locations.innerHTML = locations.map(loc => `
        <button class="carmen-location-btn" data-location="${loc.id}">
          <span class="carmen-location-emoji">${loc.emoji}</span>
          <span class="carmen-location-name">${loc.name}</span>
        </button>
      `).join('');

      els.locations.querySelectorAll('.carmen-location-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const locId = btn.dataset.location;
          if (this._investigatedIds.has(locId) || this._investigationsLeft <= 0) return;

          this._investigatedIds.add(locId);
          this._investigationsLeft--;
          btn.classList.add('investigated');
          btn.disabled = true;
          els.locationsLabel.textContent = this._investigationsLeft > 0
            ? `Investigate a location (${this._investigationsLeft} remaining):`
            : 'No investigations left — make your guess!';

          onInvestigate(locId);

          // Disable all if no investigations left
          if (this._investigationsLeft <= 0) {
            els.locations.querySelectorAll('.carmen-location-btn:not(.investigated)').forEach(b => {
              b.disabled = true;
              b.classList.add('exhausted');
            });
          }
        });
      });
    },

    hideLocations() {
      els.locationsLabel.style.display = 'none';
      els.locations.innerHTML = '';
    },

    /** Flash the screen red on wrong guess */
    flashWrong() {
      const flash = document.createElement('div');
      flash.className = 'carmen-wrong-flash';
      container.appendChild(flash);
      flash.addEventListener('animationend', () => flash.remove());
    },

    /**
     * Show suspect lineup for final identification.
     * Returns a promise that resolves with the chosen suspect name.
     */
    showSuspectLineup(lineup, revealedAttrs) {
      return new Promise(resolve => {
        els.locationsLabel.style.display = 'none';
        els.locations.innerHTML = '';
        els.reveal.style.display = 'none';
        els.sidebar.innerHTML = '';


        const overlay = document.createElement('div');
        overlay.className = 'carmen-lineup-overlay';

        let attrsHtml = '';
        if (revealedAttrs.length > 0) {
          attrsHtml = `<div class="carmen-lineup-attrs">
            <div class="carmen-lineup-attrs-label">What you know about the suspect:</div>
            ${revealedAttrs.map(a => `<div class="carmen-lineup-attr">🔍 <strong>${a.attr}:</strong> ${esc(a.value)}</div>`).join('')}
          </div>`;
        }

        overlay.innerHTML = `
          <div class="carmen-lineup-content">
            <div class="carmen-lineup-title">SUSPECT LINEUP</div>
            <div class="carmen-lineup-subtitle">Issue a warrant — identify the thief!</div>
            ${attrsHtml}
            <div class="carmen-lineup-grid">
              ${lineup.map(s => `
                <button class="carmen-suspect-card" data-name="${esc(s.name)}">
                  <div class="carmen-suspect-silhouette">🕵️</div>
                  <div class="carmen-suspect-name">${esc(s.name)}</div>
                  <div class="carmen-suspect-details">
                    <span>Hair: ${esc(s.hair)}</span>
                    <span>${esc(s.accessory)}</span>
                    <span>${esc(s.hobby)}</span>
                    <span>${esc(s.vehicle)}</span>
                  </div>
                </button>
              `).join('')}
            </div>
          </div>
        `;

        container.appendChild(overlay);

        overlay.querySelectorAll('.carmen-suspect-card').forEach(card => {
          card.addEventListener('click', () => {
            const name = card.dataset.name;
            overlay.remove();
            resolve(name);
          });
        });
      });
    },

    showTransition(stopScore, country, taunt, thiefName, onContinue) {
      els.sidebar.innerHTML = '';
      els.reveal.style.display = 'none';
      els.mapWrap.style.minHeight = '';
      els.mapHeader.style.display = 'none';
      els.locationsLabel.style.display = 'none';
      els.locations.innerHTML = '';

      // Overlay on the map
      const overlay = document.createElement('div');
      overlay.className = 'carmen-map-overlay';
      const tauntHtml = taunt ? `
        <div class="carmen-taunt">
          <div class="carmen-taunt-silhouette">🕵️</div>
          <div class="carmen-taunt-bubble">
            <span class="carmen-taunt-name">${esc(thiefName)}:</span>
            "${esc(taunt)}"
          </div>
        </div>
      ` : '';
      overlay.innerHTML = `
        <div class="carmen-transition">
          <div class="score-gained">+${stopScore} points</div>
          <div>The thief was spotted in <strong>${esc(country)}</strong>!</div>
          ${tauntHtml}
          <button class="carmen-continue-btn">Continue the chase →</button>
        </div>
      `;
      els.mapWrap.appendChild(overlay);

      overlay.querySelector('.carmen-continue-btn').addEventListener('click', () => {
        overlay.remove();
        onContinue();
      });
    },
  };
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
