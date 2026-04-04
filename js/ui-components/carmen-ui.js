/**
 * Carmen UI — DOM rendering for "Where in the World?" game.
 */

import { playStamp, playTypeKey, playTick } from '../carmen-audio.js';

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
  // Briefing overlay — appended to body so it's not blocked by hidden gameContent
  const briefingEl = document.createElement('div');
  briefingEl.className = 'carmen-briefing-overlay';
  briefingEl.id = 'carmen-briefing';
  briefingEl.style.display = 'none';
  briefingEl.innerHTML = `
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
  `;
  document.body.appendChild(briefingEl);

  // Build skeleton
  container.innerHTML = `
    <div class="carmen-status-bar">
      <div class="pill">Score: <b id="carmen-score">0</b></div>
      <div class="carmen-progress" id="carmen-progress"></div>
      <div class="carmen-clock" id="carmen-clock"></div>
    </div>
    <div class="carmen-intro-row side-by-side" id="carmen-intro-row">
      <div class="carmen-left-panel">
        <div class="carmen-panel-tabs" id="carmen-panel-tabs" style="display:none">
          <button class="carmen-panel-tab active" data-tab="case">📁 Case</button>
          <button class="carmen-panel-tab" data-tab="investigate">🔍 Investigate</button>
        </div>
        <div class="carmen-panel-content">
          <div class="carmen-panel-view" id="carmen-panel-case">
            <div class="carmen-narrative" id="carmen-narrative"></div>
            <div class="carmen-witness-report" id="carmen-witness-report"></div>
          </div>
          <div class="carmen-panel-view" id="carmen-panel-investigate" style="display:none">
            <div class="carmen-panel-card">
              <div class="carmen-panel-badge">🔍 INVESTIGATE</div>
              <div class="carmen-panel-desc" id="carmen-locations-label"></div>
              <div class="carmen-locations" id="carmen-locations"></div>
            </div>
          </div>
          <div class="carmen-panel-view" id="carmen-panel-travel" style="display:none">
            <div class="carmen-panel-card">
              <div class="carmen-panel-badge">✈️ TRAVEL</div>
              <div class="carmen-panel-title">Where did the thief go?</div>
              <div class="carmen-panel-desc">Select a neighboring country on the map to follow the trail.</div>
            </div>
          </div>
          <div class="carmen-panel-view" id="carmen-panel-dossier" style="display:none">
            <div class="carmen-panel-card">
              <div class="carmen-panel-badge">📋 DOSSIER</div>
              <div class="carmen-panel-title">Case Dossier</div>
              <div class="carmen-panel-desc">All gathered evidence and witness statements are compiled on the right.</div>
            </div>
          </div>
        </div>
        <div class="carmen-bottom-tabs" id="carmen-bottom-tabs" style="display:none">
          <button class="carmen-bottom-tab" data-tab="travel">✈️ Travel</button>
          <button class="carmen-bottom-tab" data-tab="dossier">📋 Dossier</button>
        </div>
      </div>
      <div class="carmen-right-panel">
        <div class="carmen-right-view" id="carmen-rv-artifact">
          <div class="carmen-artifact-display">
            <img class="carmen-artifact-img" id="carmen-artifact-img" src="" alt="">
            <div class="carmen-artifact-stamp">STOLEN</div>
          </div>
        </div>
        <div class="carmen-right-view" id="carmen-rv-clues" style="display:none">
          <div class="carmen-clue-reveal" id="carmen-clue-reveal"></div>
        </div>
        <div class="carmen-right-view" id="carmen-rv-map" style="display:none">
          <div class="carmen-map-wrap" id="carmen-map-wrap">
            <svg id="carmen-map" viewBox="0 0 600 320" preserveAspectRatio="xMidYMid meet"></svg>
            <div class="carmen-map-sidebar" id="carmen-map-sidebar"></div>
          </div>
        </div>
        <div class="carmen-right-view" id="carmen-rv-dossier" style="display:none">
          <div class="carmen-dossier-inline" id="carmen-dossier-body-inline"></div>
        </div>
      </div>
    </div>
  `;

  const els = {
    briefing: briefingEl,
    briefingArtifact: briefingEl.querySelector('#carmen-briefing-artifact'),
    briefingMission: briefingEl.querySelector('#carmen-briefing-mission'),
    briefingStart: briefingEl.querySelector('#carmen-briefing-start'),
    introRow: container.querySelector('#carmen-intro-row'),
    narrative: container.querySelector('#carmen-narrative'),
    panelTabs: container.querySelector('#carmen-panel-tabs'),
    panelCase: container.querySelector('#carmen-panel-case'),
    panelInvestigate: container.querySelector('#carmen-panel-investigate'),
    score: container.querySelector('#carmen-score'),
    progress: container.querySelector('#carmen-progress'),
    clock: container.querySelector('#carmen-clock'),
    locationsLabel: container.querySelector('#carmen-locations-label'),
    locations: container.querySelector('#carmen-locations'),
    witnessReport: container.querySelector('#carmen-witness-report'),
    panelTravel: container.querySelector('#carmen-panel-travel'),
    panelDossier: container.querySelector('#carmen-panel-dossier'),
    bottomTabs: container.querySelector('#carmen-bottom-tabs'),
    // Right panel views
    rvArtifact: container.querySelector('#carmen-rv-artifact'),
    rvClues: container.querySelector('#carmen-rv-clues'),
    rvMap: container.querySelector('#carmen-rv-map'),
    rvDossier: container.querySelector('#carmen-rv-dossier'),
    artifactImg: container.querySelector('#carmen-artifact-img'),
    map: container.querySelector('#carmen-map'),
    mapWrap: container.querySelector('#carmen-map-wrap'),
    sidebar: container.querySelector('#carmen-map-sidebar'),
    reveal: container.querySelector('#carmen-clue-reveal'),
    dossierBody: container.querySelector('#carmen-dossier-body-inline'),
  };

  function flagImg(country) {
    const code = flagCodes[country];
    if (!code) return '';
    return `<img src="img/flags/${code}.svg" alt="" loading="lazy">`;
  }

  // Dossier state
  const dossierEntries = []; // [{stop, clueText, informantPrefix}]

  // ── Tab switching ──
  // Left panels + right views mapping
  const leftPanels = {
    case: els.panelCase,
    investigate: els.panelInvestigate,
    travel: els.panelTravel,
    dossier: els.panelDossier,
  };
  // Which right view each tab shows
  const rightViewForTab = {
    case: els.rvArtifact,
    investigate: els.rvClues,   // shows clues (or zoomed country before any clue)
    travel: els.rvMap,
    dossier: els.rvDossier,
  };
  const allRightViews = [els.rvArtifact, els.rvClues, els.rvMap, els.rvDossier];
  let activeTab = 'case';

  function switchTab(tab) {
    activeTab = tab;
    // Left panel
    for (const [key, el] of Object.entries(leftPanels)) {
      el.style.display = key === tab ? '' : 'none';
    }
    // Right panel
    const targetRight = rightViewForTab[tab];
    for (const rv of allRightViews) {
      rv.style.display = rv === targetRight ? '' : 'none';
    }
    // Update all tab active states
    els.panelTabs.querySelectorAll('.carmen-panel-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    els.bottomTabs.querySelectorAll('.carmen-bottom-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
  }

  els.panelTabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.carmen-panel-tab');
    if (tab) switchTab(tab.dataset.tab);
  });
  els.bottomTabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.carmen-bottom-tab');
    if (tab) switchTab(tab.dataset.tab);
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
      const first = entries[0];
      const location = first.capital && first.country
        ? ` — ${esc(first.capital)}, ${esc(first.country)}`
        : first.country ? ` — ${esc(first.country)}` : '';
      html += `<div class="carmen-dossier-stop">Stop ${Number(stop) + 1}${location}</div>`;
      for (const e of entries) {
        const icon = e.emoji || '';
        html += `<div class="carmen-dossier-entry">
          ${icon ? `<span class="carmen-dossier-emoji">${icon}</span>` : ''}
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

    switchTab(tab) { switchTab(tab); },

    /** Add a clue to the dossier. */
    addDossierEntry(stop, clueText, informantPrefix, emoji, country, capital) {
      dossierEntries.push({ stop, clueText, informantPrefix, emoji, country, capital });
      renderDossier();
    },

    /** Reset the dossier for a new game. */
    resetDossier() {
      dossierEntries.length = 0;
      renderDossier();
    },

    /** Clear witness reports on Case tab. */
    clearWitnessReports() {
      els.witnessReport.innerHTML = '';
    },

    /** Show a witness report on the Case tab. Optionally with an "investigate further" button. */
    addWitnessReport(clue, informant) {
      const emoji = informant?.emoji || '🔍';
      const prefix = informant?.prefix || 'Witness report';
      const text = clue.text;
      const clueId = informant?.clueId || '';

      const entry = document.createElement('div');
      entry.className = 'carmen-witness-entry';
      if (clueId) entry.dataset.clueId = clueId;

      let investigateHtml = '';
      if (informant?.canInvestigate && informant?.onInvestigateFurther) {
        const cost = informant.investigateCost || 2;
        investigateHtml = `
          <button class="carmen-investigate-further-btn">
            🔎 Investigate further (${cost}h)
          </button>
        `;
      }

      entry.innerHTML = `
        <div class="carmen-witness-header">
          <span class="carmen-witness-emoji">${emoji}</span>
          <span class="carmen-witness-prefix">${esc(prefix)}:</span>
        </div>
        <div class="carmen-witness-text">"${esc(text)}"</div>
        ${investigateHtml}
      `;

      if (informant?.onInvestigateFurther) {
        const btn = entry.querySelector('.carmen-investigate-further-btn');
        if (btn) {
          btn.addEventListener('click', () => {
            btn.remove();
            informant.onInvestigateFurther();
          });
        }
      }

      els.witnessReport.appendChild(entry);
    },

    /** Upgrade a vague witness report to a specific one in-place. */
    upgradeWitnessReport(clueId, specificClue) {
      const entry = els.witnessReport.querySelector(`[data-clue-id="${clueId}"]`);
      if (entry) {
        entry.classList.add('carmen-witness-confirmed');
        const btn = entry.querySelector('.carmen-investigate-further-btn');
        if (btn) btn.remove();
        // Add the confirmed specific clue underneath the vague one
        const confirmed = document.createElement('div');
        confirmed.className = 'carmen-witness-text carmen-witness-specific';
        confirmed.textContent = `"${specificClue.text}"`;
        entry.appendChild(confirmed);
      }
    },

    /** Show dramatic case briefing overlay. Returns a promise that resolves when player clicks start. */
    showCaseBriefing(artifact, startCountry, totalHours) {
      return new Promise(resolve => {
        const siteName = artifact.siteName || 'a priceless artifact';
        els.briefingArtifact.innerHTML = `
          <div class="carmen-artifact-label">STOLEN ARTIFACT</div>
          <div class="carmen-artifact-name">${esc(siteName)}</div>
          <div class="carmen-artifact-origin">Last seen in ${esc(startCountry)}</div>
        `;
        els.briefingMission.textContent = '';
        els.briefing.style.display = 'flex';

        // Stamp animation + sound
        const stamp = els.briefing.querySelector('.carmen-briefing-stamp');
        stamp.classList.remove('animate');
        setTimeout(() => {
          stamp.classList.add('animate');
          setTimeout(() => playStamp(), 300);
        }, 100);

        // Hide start button until typewriter finishes
        els.briefingStart.style.display = 'none';

        // Typewriter with sounds
        const timeText = totalHours ? ` You have only ${totalHours} hours to hunt down the criminal!` : '';
        typewriter(els.briefingMission, `Track the thief through neighboring countries. Investigate locations, gather clues, and identify the suspect to make your arrest.${timeText}`, 20)
          .then(() => {
            els.briefingStart.style.display = '';
          });

        els.briefingStart.onclick = () => {
          els.briefing.style.display = 'none';
          resolve();
        };
      });
    },

    showIntro(thiefName, artifact, startCountry) {
      const siteName = artifact.siteName || 'a priceless artifact';
      const imgUrl = artifact.imageUrl || '';
      // Set artifact image for the right-side display
      if (imgUrl) {
        els.artifactImg.src = imgUrl;
        els.artifactImg.alt = siteName;
      }
      els.panelTabs.style.display = '';
      els.bottomTabs.style.display = '';
      switchTab('case');
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
      const remaining = totalStops - stopIndex;
      let intel;
      if (remaining <= 1) {
        intel = `The thief is cornered — this is the <strong>final stop</strong>!`;
      } else {
        intel = `Intel says the thief is <strong>${remaining} ${remaining === 1 ? 'stop' : 'stops'}</strong> ahead. Follow the clues.`;
      }
      els.narrative.innerHTML = `
        <div class="carmen-intro-card">
          <div class="carmen-intro-badge">ACTIVE CASE</div>
          <div class="carmen-intro-intel">${intel}</div>
        </div>
      `;
      switchTab('case');
    },

    updateScore(score) {
      els.score.textContent = score;
    },

    updateProgress(stop, total) {
      els.progress.textContent = `Stop ${stop + 1} of ${total}`;
    },

    updateClock(hoursRemaining, totalHours) {
      const prev = this._prevHours ?? hoursRemaining;
      this._prevHours = hoursRemaining;

      if (prev === hoursRemaining) {
        // No change — just set it
        const days = Math.floor(hoursRemaining / 24);
        const hours = hoursRemaining % 24;
        els.clock.textContent = `⏰ ${days}d ${hours}h`;
      } else {
        // Animate countdown from prev to target
        if (this._clockTimer) clearInterval(this._clockTimer);
        let current = prev;
        this._clockTimer = setInterval(() => {
          current--;
          playTick();
          const d = Math.floor(current / 24);
          const h = current % 24;
          els.clock.textContent = `⏰ ${d}d ${h}h`;
          if (current <= hoursRemaining) {
            clearInterval(this._clockTimer);
            this._clockTimer = null;
          }
        }, 120);
      }
      // Pulse when low
      const pct = hoursRemaining / totalHours;
      els.clock.classList.toggle('low', pct < 0.25);
      els.clock.classList.toggle('critical', pct < 0.12);
    },

    /** Clear the clue display on the right panel. */
    clearClues() {
      els.sidebar.innerHTML = '';
      els.reveal.style.display = 'none';
      els.reveal.innerHTML = '';
    },

    addClue(clue, informant) {
      const emoji = informant ? informant.emoji : (clue.icon || '💬');
      const prefix = informant ? informant.prefix : 'Intel';
      els.reveal.innerHTML = `
        <div class="carmen-speech-bubble">
          <div class="carmen-speech-avatar">${emoji}</div>
          <div class="carmen-speech-body">
            <div class="carmen-speech-name">${esc(prefix)}</div>
            <div class="carmen-speech-text"></div>
          </div>
        </div>
      `;
      els.reveal.style.display = '';
      // Switch right panel to clues view
      for (const rv of allRightViews) rv.style.display = 'none';
      els.rvClues.style.display = '';
      // Typewriter the clue text
      const textEl = els.reveal.querySelector('.carmen-speech-text');
      typewriter(textEl, `"${clue.text}"`, 20);
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
      els.locations.innerHTML = '';
      els.locationsLabel.textContent = '';
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
    showSuspectLineup(lineup) {
      return new Promise(resolve => {
        els.locationsLabel.style.display = 'none';
        els.locations.innerHTML = '';
        els.reveal.style.display = 'none';
        els.sidebar.innerHTML = '';

        const overlay = document.createElement('div');
        overlay.className = 'carmen-lineup-overlay';

        overlay.innerHTML = `
          <div class="carmen-lineup-content">
            <div class="carmen-lineup-title">SUSPECT LINEUP</div>
            <div class="carmen-lineup-subtitle">Issue a warrant — identify the thief!</div>
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

    showCaseSolved(suspectName, hoursLeft, score) {
      return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'carmen-closing-overlay';
        overlay.innerHTML = `
          <div class="carmen-closing-content carmen-closing-solved">
            <div class="carmen-closing-stamp">SOLVED</div>
            <div class="carmen-briefing-label">CASE CLOSED</div>
            <img src="carmen/img/detective-full.png" alt="" class="carmen-closing-detective">
            <div class="carmen-closing-name">${esc(suspectName)}</div>
            <div class="carmen-closing-text"></div>
            <div class="carmen-closing-score">${score} points</div>
            <div class="carmen-closing-detail">Case completed with ${hoursLeft}h remaining</div>
          </div>
        `;
        document.body.appendChild(overlay);

        const stamp = overlay.querySelector('.carmen-closing-stamp');
        const textEl = overlay.querySelector('.carmen-closing-text');

        setTimeout(() => { stamp.classList.add('animate'); playStamp(); }, 300);
        setTimeout(() => {
          typewriter(textEl, 'has been arrested!', 30);
        }, 800);

        overlay.addEventListener('click', () => {
          overlay.remove();
          resolve();
        });
      });
    },

    showCaseFailed(suspectName, score) {
      return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'carmen-closing-overlay';
        overlay.innerHTML = `
          <div class="carmen-closing-content carmen-closing-failed">
            <div class="carmen-closing-stamp">FAILED</div>
            <div class="carmen-briefing-label">CASE CLOSED</div>
            <div class="carmen-closing-icon">💨</div>
            <div class="carmen-closing-name">${esc(suspectName)}</div>
            <div class="carmen-closing-text"></div>
            <div class="carmen-closing-score">${score} points</div>
            <div class="carmen-closing-detail">The real thief vanished into the shadows...</div>
          </div>
        `;
        document.body.appendChild(overlay);

        const stamp = overlay.querySelector('.carmen-closing-stamp');
        const textEl = overlay.querySelector('.carmen-closing-text');

        setTimeout(() => { stamp.classList.add('animate'); playStamp(); }, 300);
        setTimeout(() => {
          typewriter(textEl, 'has escaped!', 30);
        }, 800);

        overlay.addEventListener('click', () => {
          overlay.remove();
          resolve();
        });
      });
    },

    showDeadEnd(country, onContinue) {
      // Force map visible
      for (const rv of allRightViews) rv.style.display = 'none';
      els.rvMap.style.display = '';

      const overlay = document.createElement('div');
      overlay.className = 'carmen-map-overlay carmen-dead-end';
      overlay.innerHTML = `
        <div class="carmen-transition">
          <div class="carmen-dead-end-icon">❌</div>
          <div class="score-lost">-25 points</div>
          <div>No trace of the thief in <strong>${esc(country)}</strong>!</div>
          <div class="carmen-dead-end-hint">This is a dead end. You've lost precious time.</div>
          <button class="carmen-continue-btn carmen-dead-end-btn">Continue searching →</button>
        </div>
      `;
      els.mapWrap.appendChild(overlay);

      overlay.querySelector('.carmen-continue-btn').addEventListener('click', () => {
        overlay.remove();
        onContinue();
      });
    },

    showTransition(stopScore, country, taunt, thiefName, onContinue) {
      els.sidebar.innerHTML = '';
      els.reveal.style.display = 'none';
      els.reveal.innerHTML = '';
      els.mapWrap.style.minHeight = '';
      els.locations.innerHTML = '';
      els.locationsLabel.textContent = '';
      els.witnessReport.innerHTML = '';
      // Force map visible on right for transition animation
      switchTab('case');
      for (const rv of allRightViews) rv.style.display = 'none';
      els.rvMap.style.display = '';

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
