/**
 * Carmen UI — DOM rendering for "Where in the World?" game.
 */

import { playStamp, startClockTicking, stopClockTicking, toggleMusicMute, isMusicMuted } from '../audio/audio-engine.js';
import { IMG } from '../assets.js';
import { typewriter } from './typewriter.js';

const INTERPOL_PHOTO_ADJUSTMENTS = {
  'Count Obsidian': { scaleX: 1.58, scaleY: 1.22, x: '0%', y: '0%' },
  'Echo': { scaleX: 1.62, scaleY: 1.24, x: '0%', y: '0%' },
  'The Locksmith': { scaleX: 1.28, scaleY: 1.18, x: '0%', y: '-1%' },
  'Nova Vex': { scaleX: 1.56, scaleY: 1.24, x: '0%', y: '-4%' },
  'Shadow Lynx': { scaleX: 1.62, scaleY: 1.24, x: '0%', y: '-2%' },
  'Copper Sparrow': { scaleX: 1.54, scaleY: 1.22, x: '0%', y: '-2%' },
  'Ghost Mariner': { scaleX: 1.28, scaleY: 1.16, x: '0%', y: '-3%' },
  'Velvet Cipher': { scaleX: 1.54, scaleY: 1.22, x: '0%', y: '0%' },
  'Phantom Fox': { scaleX: 1.6, scaleY: 1.24, x: '0%', y: '-2%' },
  'Raven Noir': { scaleX: 1.54, scaleY: 1.22, x: '0%', y: '-2%' },
  'Scarlet Cipher': { scaleX: 1.56, scaleY: 1.22, x: '0%', y: '-1%' },
  'Ivy Virelli': { scaleX: 1.54, scaleY: 1.2, x: '0%', y: '-1%' },
  'Saffron Silk': { scaleX: 1.54, scaleY: 1.22, x: '0%', y: '-2%' },
  'Crimson Dagger': { scaleX: 1.56, scaleY: 1.24, x: '0%', y: '-1%' },
  'Golden Lynx': { scaleX: 1.54, scaleY: 1.22, x: '0%', y: '-2%' },
  'Ivory Whisper': { scaleX: 1.54, scaleY: 1.22, x: '0%', y: '-2%' },
  'Neon Specter': { scaleX: 1.54, scaleY: 1.24, x: '0%', y: '-3%' },
  'Scarlet Swan': { scaleX: 1.54, scaleY: 1.22, x: '0%', y: '-2%' },
  'Midnight Owl': { scaleX: 1.54, scaleY: 1.22, x: '0%', y: '-1%' },
  'Silver Comet': { scaleX: 1.54, scaleY: 1.24, x: '0%', y: '-3%' },
  'Velvet Raven': { scaleX: 1.54, scaleY: 1.22, x: '0%', y: '-2%' },
  'Amber Fox': { scaleX: 1.54, scaleY: 1.22, x: '0%', y: '-2%' },
  'Storm Herald': { scaleX: 1.54, scaleY: 1.22, x: '0%', y: '-2%' },
  'Crimson Mirage': { scaleX: 1.54, scaleY: 1.22, x: '0%', y: '-2%' },
  'Onyx Panther': { scaleX: 1.6, scaleY: 1.24, x: '0%', y: '-1%' },
  'Ivory Phantom': { scaleX: 1.54, scaleY: 1.22, x: '0%', y: '-2%' },
  'Emerald Kite': { scaleX: 1.54, scaleY: 1.22, x: '0%', y: '-2%' },
};

/**
 * Build the full game UI inside the given container.
 * Returns an API object with methods to update each section.
 *
 * @param {HTMLElement} container  — the element to render into
 * @param {Object}      flagCodes — { countryName: isoCode }
 */
export function createCarmenUI(container, flagCodes) {
  const ARTIFACT_HINT_KEY = 'carmen-artifact-hint-seen';

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
      <div class="carmen-missions" id="carmen-missions"></div>
      <div class="pill">Score: <b id="carmen-score">0</b></div>
      <div class="carmen-progress" id="carmen-progress"></div>
      <div class="carmen-clock" id="carmen-clock"></div>
      <div class="carmen-music-toggle" id="carmen-music-toggle" title="Toggle music" style="display:none"><img src="${IMG.musicOn}" alt="Music"></div>
    </div>
    <div class="carmen-intro-row side-by-side" id="carmen-intro-row">
      <div class="carmen-left-panel">
        <div class="carmen-notebook-shell">
          <div class="carmen-notebook-tabs" id="carmen-notebook-tabs" style="display:none">
            <button class="carmen-notebook-tab active" data-tab="case">Case</button>
            <button class="carmen-notebook-tab" data-tab="investigate">Investigate</button>
            <button class="carmen-notebook-tab" data-tab="travel">Travel</button>
            <button class="carmen-notebook-tab" data-tab="dossier">Dossier</button>
            <button class="carmen-notebook-tab" data-tab="interpol">Interpol</button>
          </div>
          <div class="carmen-notebook-body">
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
                  <div class="carmen-panel-cost">⏱️ Travel cost: <strong>5 hours</strong> per trip</div>
                </div>
              </div>
              <div class="carmen-panel-view" id="carmen-panel-dossier" style="display:none">
                <div class="carmen-panel-card">
                  <div class="carmen-panel-badge">📋 DOSSIER</div>
                  <div class="carmen-panel-title">Case Dossier</div>
                  <div class="carmen-panel-desc">All gathered evidence and witness statements are compiled on the right.</div>
                </div>
              </div>
              <div class="carmen-panel-view" id="carmen-panel-interpol" style="display:none">
                <div class="carmen-panel-card carmen-interpol-panel-card">
                  <div class="carmen-interpol-panel-clip" aria-hidden="true"></div>
                  <div class="carmen-panel-badge">INTERPOL ARCHIVE</div>
                  <div class="carmen-panel-title">Known Criminals</div>
                  <div class="carmen-panel-desc">Browse active case files and compare suspect profiles by hand.</div>
                  <div class="carmen-panel-cost">Consult archive: <strong>3 hours</strong> per new file</div>
                </div>
                <div class="carmen-interpol-list" id="carmen-interpol-list"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="carmen-right-panel">
        <div class="carmen-right-view" id="carmen-rv-artifact">
          <div class="carmen-artifact-display" id="carmen-artifact-display">
            <div class="carmen-artifact-inner">
              <div class="carmen-artifact-front">
                <img class="carmen-artifact-img" id="carmen-artifact-img" src="" alt="">
                <div class="carmen-artifact-stamp">STOLEN</div>
                <div class="carmen-artifact-flip-hint">↩</div>
                <div class="carmen-artifact-flip-label" id="carmen-artifact-flip-label">Flip for archive note</div>
              </div>
              <div class="carmen-artifact-back">
                <div class="carmen-artifact-summary" id="carmen-artifact-summary"></div>
              </div>
            </div>
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
        <div class="carmen-right-view" id="carmen-rv-interpol" style="display:none">
          <div class="carmen-interpol-profile" id="carmen-interpol-profile">
            <div class="carmen-interpol-empty">
              <div class="carmen-interpol-empty-title">INTERPOL</div>
              <div class="carmen-interpol-empty-full">International Criminal Police Organization</div>
              <div class="carmen-interpol-empty-text">Founded in 1923 in Vienna, INTERPOL is the world's largest international police organization with 196 member countries. Its General Secretariat is headquartered in Lyon, France. INTERPOL facilitates cross-border police cooperation and supports law enforcement worldwide in combating transnational crime.</div>
              <img src="${IMG.typewriter}" alt="" class="carmen-interpol-empty-img">
              <div class="carmen-interpol-empty-hint">Select a suspect from the list to access their file.</div>
            </div>
          </div>
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
    notebookTabs: container.querySelector('#carmen-notebook-tabs'),
    panelCase: container.querySelector('#carmen-panel-case'),
    panelInvestigate: container.querySelector('#carmen-panel-investigate'),
    missions: container.querySelector('#carmen-missions'),
    score: container.querySelector('#carmen-score'),
    progress: container.querySelector('#carmen-progress'),
    clock: container.querySelector('#carmen-clock'),
    musicToggle: container.querySelector('#carmen-music-toggle'),
    locationsLabel: container.querySelector('#carmen-locations-label'),
    locations: container.querySelector('#carmen-locations'),
    witnessReport: container.querySelector('#carmen-witness-report'),
    panelTravel: container.querySelector('#carmen-panel-travel'),
    panelDossier: container.querySelector('#carmen-panel-dossier'),
    panelInterpol: container.querySelector('#carmen-panel-interpol'),
    interpolList: container.querySelector('#carmen-interpol-list'),
    // Right panel views
    rvArtifact: container.querySelector('#carmen-rv-artifact'),
    rvClues: container.querySelector('#carmen-rv-clues'),
    rvMap: container.querySelector('#carmen-rv-map'),
    rvDossier: container.querySelector('#carmen-rv-dossier'),
    rvInterpol: container.querySelector('#carmen-rv-interpol'),
    interpolProfile: container.querySelector('#carmen-interpol-profile'),
    artifactImg: container.querySelector('#carmen-artifact-img'),
    artifactDisplay: container.querySelector('#carmen-artifact-display'),
    artifactFlipLabel: container.querySelector('#carmen-artifact-flip-label'),
    artifactSummary: container.querySelector('#carmen-artifact-summary'),
    map: container.querySelector('#carmen-map'),
    mapWrap: container.querySelector('#carmen-map-wrap'),
    sidebar: container.querySelector('#carmen-map-sidebar'),
    reveal: container.querySelector('#carmen-clue-reveal'),
    dossierBody: container.querySelector('#carmen-dossier-body-inline'),
    interpolCard: container.querySelector('#carmen-panel-interpol .carmen-panel-card'),
  };

  // Save original Interpol intro HTML so we can restore it
  const interpolIntroHtml = els.interpolProfile.innerHTML;

  // Click the Interpol header card to return to intro view
  if (els.interpolCard) {
    els.interpolCard.style.cursor = 'pointer';
    els.interpolCard.addEventListener('click', () => {
      els.interpolProfile.innerHTML = interpolIntroHtml;
    });
  }

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
    interpol: els.panelInterpol,
  };
  // Which right view each tab shows
  const rightViewForTab = {
    case: els.rvArtifact,
    investigate: els.rvClues,   // shows clues (or zoomed country before any clue)
    travel: els.rvMap,
    dossier: els.rvDossier,
    interpol: els.rvInterpol,
  };
  const allRightViews = [els.rvArtifact, els.rvClues, els.rvMap, els.rvDossier, els.rvInterpol];
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
    els.notebookTabs.querySelectorAll('.carmen-notebook-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
  }

  els.notebookTabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.carmen-notebook-tab');
    if (tab) switchTab(tab.dataset.tab);
  });

  els.artifactDisplay.addEventListener('click', () => {
    els.artifactDisplay.classList.toggle('flipped');
    if (els.artifactFlipLabel) {
      els.artifactFlipLabel.classList.add('hidden');
    }
    try {
      localStorage.setItem(ARTIFACT_HINT_KEY, 'true');
    } catch {}
  });

  els.musicToggle.addEventListener('click', () => {
    const muted = toggleMusicMute();
    els.musicToggle.innerHTML = `<img src="${muted ? IMG.musicOff : IMG.musicOn}" alt="Music">`;
  });

  function renderDossier() {
    if (dossierEntries.length === 0) {
      els.dossierBody.innerHTML = '<div class="carmen-dossier-empty">No clues gathered yet. Investigate locations to find leads.</div>';
      return;
    }
    // Render entries in order, grouping consecutive entries with the same stopKey
    let html = '';
    let currentKey = null;
    for (const e of dossierEntries) {
      const key = e.stopKey;
      if (key !== currentKey) {
        currentKey = key;
        const location = e.capital && e.country
          ? ` — ${esc(e.capital)}, ${esc(e.country)}`
          : e.country ? ` — ${esc(e.country)}` : '';
        const detourClass = e.type === 'detour' ? ' carmen-dossier-detour' : '';
        const label = e.type === 'detour' ? 'Dead end' : `Stop ${Number(e.stop) + 1}`;
        html += `<div class="carmen-dossier-stop${detourClass}">${label}${location}</div>`;
      }
      const icon = e.emoji || '';
      const entryClass = e.type === 'detour' ? ' carmen-dossier-detour' : '';
      html += `<div class="carmen-dossier-entry${entryClass}">
        ${icon ? `<span class="carmen-dossier-emoji">${icon}</span>` : ''}
        <span class="carmen-dossier-prefix">${esc(e.informantPrefix || 'Clue')}:</span>
        <span>${esc(e.clueText)}</span>
      </div>`;
    }
    els.dossierBody.innerHTML = html;
    // Auto-scroll to bottom
    els.dossierBody.scrollTop = els.dossierBody.scrollHeight;
  }

  let detourCounter = 0;

  return {
    get mapSvg() { return els.map; },

    switchTab(tab) { switchTab(tab); },

    /** Add a clue to the dossier. */
    addDossierEntry(stop, clueText, informantPrefix, emoji, country, capital) {
      dossierEntries.push({ stop, stopKey: `stop-${stop}`, clueText, informantPrefix, emoji, country, capital });
      renderDossier();
    },

    /** Add a dead-end detour entry to the dossier. */
    addDetourEntry(country, capital) {
      const key = `detour-${detourCounter++}`;
      dossierEntries.push({
        stop: -1, stopKey: key, type: 'detour',
        clueText: 'No witnesses, no clues. A dead end.',
        informantPrefix: 'Dead end', emoji: '❌',
        country, capital,
      });
      renderDossier();
    },

    /** Reset the dossier for a new game. */
    resetDossier() {
      dossierEntries.length = 0;
      detourCounter = 0;
      renderDossier();
    },

    /**
     * Show the Interpol suspect list in the left panel.
     * @param {Array} suspects — full suspect array
     * @param {Set} unlockedNames — names of unlocked suspects
     * @param {Set} viewedNames — names already viewed this game (free re-view)
     * @param {Function} onView — called with (suspect) when player clicks to view
     */
    showInterpolList(suspects, unlockedNames, viewedNames, onView) {
      let html = '';
      for (const s of suspects) {
        const isCarmen = s.name === 'Carmen Sandiego';
        const hasPhoto = !!s.img;
        const available = isCarmen || hasPhoto;
        const viewed = viewedNames.has(s.name);
        const initials = s.name.split(/\s+/).map(part => part[0]).slice(0, 2).join('.').toUpperCase();
        if (available) {
          const costLabel = viewed ? 'free' : '3h';
          html += `<button class="carmen-interpol-entry${viewed ? ' viewed' : ''}" data-name="${esc(s.name)}">
            <span class="carmen-interpol-entry-tab"></span>
            <span class="carmen-interpol-entry-icon">${hasPhoto ? '📷' : '🕵️'}</span>
            <span class="carmen-interpol-entry-meta">
              <span class="carmen-interpol-entry-name">${esc(s.name)}</span>
              <span class="carmen-interpol-entry-code">FILE ${esc(initials || '??')}</span>
            </span>
            <span class="carmen-interpol-entry-cost">${costLabel}</span>
          </button>`;
        } else {
          html += `<div class="carmen-interpol-entry locked">
            <span class="carmen-interpol-entry-tab"></span>
            <span class="carmen-interpol-entry-icon">🔒</span>
            <span class="carmen-interpol-entry-meta">
              <span class="carmen-interpol-entry-name">CLASSIFIED</span>
              <span class="carmen-interpol-entry-code">SEALED FILE</span>
            </span>
          </div>`;
        }
      }
      els.interpolList.innerHTML = html;

      els.interpolList.querySelectorAll('.carmen-interpol-entry:not(.locked)').forEach(btn => {
        btn.addEventListener('click', () => {
          const name = btn.dataset.name;
          const suspect = suspects.find(s => s.name === name);
          if (suspect) onView(suspect);
        });
      });
    },

    /**
     * Show a suspect's full Interpol profile in the right panel.
     * @param {Object} suspect — suspect object with geographic fields
     */
    showInterpolProfile(suspect, theftRecords, status, campaignPhase) {
      // Redact Carmen's profile based on campaign progression.
      let hair = suspect.hair, accessory = suspect.accessory, hobby = suspect.hobby, vehicle = suspect.vehicle;
      let quirkOverride = null;
      if (suspect.name === 'Carmen Sandiego') {
        const R = '[REDACTED]';
        if (campaignPhase === 'prelude' || !campaignPhase) {
          hair = accessory = hobby = vehicle = R;
          quirkOverride = 'Subject exists only in rumor. ACME has no confirmed file.';
        } else if (campaignPhase === 'whispers') {
          hobby = vehicle = R;
          quirkOverride = 'Fragmented reports reference a figure matching this profile behind multiple thefts.';
        } else if (campaignPhase === 'pursuit') {
          vehicle = R;
          quirkOverride = 'Confirmed mastermind. Currently operating through a network of known associates.';
        } else if (campaignPhase === 'finale') {
          quirkOverride = 'Primary target. All cases lead here.';
        }
      }
      const photoAdjust = INTERPOL_PHOTO_ADJUSTMENTS[suspect.name] || {};
      const photoStyle = [
        `--photo-scale-x:${photoAdjust.scaleX || 1.28}`,
        `--photo-scale-y:${photoAdjust.scaleY || 1.18}`,
        `--photo-offset-x:${photoAdjust.x || '0%'}`,
        `--photo-offset-y:${photoAdjust.y || '0%'}`,
      ].join(';');
      const photoHtml = suspect.img
        ? `<img src="${esc(suspect.img)}" alt="${esc(suspect.name)}" class="carmen-interpol-photo-img" style="${photoStyle}">`
        : `<div class="carmen-interpol-photo-silhouette">🕵️</div>`;

      const thefts = theftRecords || [];
      const theftHtml = thefts.length > 0
        ? thefts.map(t =>
            `<div class="carmen-interpol-detail">📦 ${esc(t.artifact)} — stolen from ${esc(t.country)} (${esc(t.date)})</div>`
          ).join('')
        : '<div class="carmen-interpol-detail">No recorded thefts on file.</div>';

      const statusClass = status === 'IN CUSTODY' ? 'in-custody' : 'at-large';

      els.interpolProfile.innerHTML = `
        <div class="carmen-interpol-card">
          <div class="carmen-interpol-sheet carmen-interpol-sheet-back-1" aria-hidden="true"></div>
          <div class="carmen-interpol-sheet carmen-interpol-sheet-back-2" aria-hidden="true"></div>
          <div class="carmen-interpol-file">
            <div class="carmen-interpol-paperclip" aria-hidden="true"></div>
            <div class="carmen-interpol-header-label">INTERPOL FILE — CLASSIFIED</div>
            <div class="carmen-interpol-top">
              <div class="carmen-interpol-photo">
                ${photoHtml}
              </div>
              <div class="carmen-interpol-info">
                <div class="carmen-interpol-name">${esc(suspect.name)}</div>
                <span class="carmen-interpol-entry-status ${statusClass}">${esc(status)}</span>
                <div class="carmen-interpol-origin">${esc(suspect.origin || 'Unknown')}</div>
                <div class="carmen-interpol-regions">${(suspect.knownRegions || []).join(', ')}</div>
              </div>
            </div>
            <div class="carmen-interpol-section">
              <div class="carmen-interpol-section-label">PROFILE</div>
              <div class="carmen-interpol-trait-row"><span class="carmen-interpol-trait-label">Hair</span><span class="carmen-interpol-detail">${esc(hair)}</span></div>
              <div class="carmen-interpol-trait-row"><span class="carmen-interpol-trait-label">Accessory</span><span class="carmen-interpol-detail">${esc(accessory)}</span></div>
              <div class="carmen-interpol-trait-row"><span class="carmen-interpol-trait-label">Hobby</span><span class="carmen-interpol-detail">${esc(hobby)}</span></div>
              <div class="carmen-interpol-trait-row"><span class="carmen-interpol-trait-label">Vehicle</span><span class="carmen-interpol-detail">${esc(vehicle)}</span></div>
            </div>
            <div class="carmen-interpol-section">
              <div class="carmen-interpol-section-label">CRIMINAL RECORD</div>
              ${theftHtml}
            </div>
            <div class="carmen-interpol-section">
              <div class="carmen-interpol-section-label">GEO INTEL</div>
              <div class="carmen-interpol-geo">"${esc(suspect.geoFact || 'No geographic intelligence on file.')}"</div>
            </div>
            <div class="carmen-interpol-section">
              <div class="carmen-interpol-section-label">NOTES</div>
              <div class="carmen-interpol-notes">${esc(quirkOverride || suspect.quirk || 'No behavioral notes on file.')}</div>
            </div>
          </div>
        </div>
      `;
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
    showCaseBriefing(artifact, startCountry, totalHours, caseNumber, totalCases, campaignPhase) {
      return new Promise(resolve => {
        const siteName = artifact.siteName || 'a priceless artifact';
        const caseLabel = caseNumber
          ? (campaignPhase === 'finale' ? `FINAL CASE — ${caseNumber} / ${totalCases}` : `CASE ${caseNumber} / ${totalCases}`)
          : 'STOLEN ARTIFACT';
        els.briefingArtifact.innerHTML = `
          <div class="carmen-artifact-label">${esc(caseLabel)}</div>
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
        const missionCopy =
          campaignPhase === 'whispers' ? "Track the thief through neighboring countries. Witnesses keep mentioning a shadow behind the shadow — someone bigger is pulling strings." :
          campaignPhase === 'pursuit'  ? "ACME has traced this theft to Carmen Sandiego's network. The thief is one of her lieutenants — every arrest brings you closer to her." :
          campaignPhase === 'finale'   ? "This is it. Carmen Sandiego herself has surfaced. No more proxies. Track her across the globe and bring her in — or she vanishes forever." :
          "Track the thief through neighboring countries. Investigate locations, gather clues, and identify the suspect to make your arrest.";
        typewriter(els.briefingMission, `${missionCopy}${timeText}`, 20)
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
      els.artifactSummary.innerHTML = formatArtifactBack(artifact);
      els.artifactDisplay.classList.remove('flipped');
      const showArtifactHint = (() => {
        try { return localStorage.getItem(ARTIFACT_HINT_KEY) !== 'true'; }
        catch { return true; }
      })();
      if (els.artifactFlipLabel) {
        els.artifactFlipLabel.classList.toggle('hidden', !showArtifactHint);
      }
      els.notebookTabs.style.display = '';
      els.musicToggle.style.display = '';
      els.musicToggle.innerHTML = `<img src="${isMusicMuted() ? IMG.musicOff : IMG.musicOn}" alt="Music">`;
      this._prevHours = null;
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

    /**
     * Render mission tally marks.
     * @param {Array} history — array of 'success'|'fail' strings (past missions)
     * @param {boolean} showCurrent — whether to show the current mission marker
     */
    updateMissions(history, showCurrent = true, caseNumber, totalCases) {
      // Limit to fit: keep last N entries
      const maxMarks = 12;
      const totalNeeded = history.length + (showCurrent ? 1 : 0);
      const start = Math.max(0, totalNeeded - maxMarks);
      const visible = history.slice(start);

      let html = '';
      if (caseNumber && totalCases) {
        html += `<span class="carmen-missions-label">Case ${caseNumber} / ${totalCases}</span>`;
      } else {
        html += '<span class="carmen-missions-label">Cases solved:</span>';
      }
      for (const result of visible) {
        const cls = result === 'success' ? 'carmen-mark-success' : 'carmen-mark-fail';
        html += `<span class="carmen-mark ${cls}">I</span>`;
      }
      if (showCurrent) {
        html += '<span class="carmen-mark carmen-mark-current">I</span>';
      }
      els.missions.innerHTML = html;
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
        const pctNow = hoursRemaining / totalHours;
        const urgency = pctNow < 0.12 ? 'critical' : pctNow < 0.25 ? 'low' : 'normal';
        startClockTicking(urgency);
        this._clockTimer = setInterval(() => {
          current--;
          const d = Math.floor(current / 24);
          const h = current % 24;
          els.clock.textContent = `⏰ ${d}d ${h}h`;
          if (current <= hoursRemaining) {
            clearInterval(this._clockTimer);
            this._clockTimer = null;
            stopClockTicking();
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
            ${clue.action ? `<div class="carmen-speech-action">${esc(clue.action)}</div>` : ''}
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
                  <div class="carmen-suspect-silhouette"><img src="${IMG.suspect(s.name)}" alt="${esc(s.name)}" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'🕵️'}))"></div>
                  <div class="carmen-suspect-name">${esc(s.name)}</div>
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
      els.musicToggle.style.display = 'none';
      return new Promise(resolve => {
        const isCarmen = suspectName === 'Carmen Sandiego';
        const arrestImg = isCarmen ? IMG.carmenArrested : IMG.detectiveArresting;
        const overlay = document.createElement('div');
        overlay.className = 'carmen-closing-overlay';
        overlay.innerHTML = `
          <div class="carmen-closing-content carmen-closing-solved">
            <div class="carmen-closing-stamp">SOLVED</div>
            <div class="carmen-briefing-label">CASE CLOSED</div>
            <img src="${arrestImg}" alt="" class="carmen-closing-detective">
            <div class="carmen-closing-name">${esc(suspectName)}</div>
            <div class="carmen-closing-text"></div>
            <div class="carmen-closing-score">${score} points</div>
            <div class="carmen-closing-detail">Case completed with ${hoursLeft}h remaining</div>
            <div class="carmen-closing-buttons" style="display:none">
              <button class="carmen-closing-btn carmen-btn-continue">Next case →</button>
              <button class="carmen-closing-btn carmen-btn-quit">Quit</button>
            </div>
          </div>
        `;
        document.body.appendChild(overlay);

        const stamp = overlay.querySelector('.carmen-closing-stamp');
        const textEl = overlay.querySelector('.carmen-closing-text');
        const buttons = overlay.querySelector('.carmen-closing-buttons');

        setTimeout(() => { stamp.classList.add('animate'); playStamp(); }, 300);
        setTimeout(() => {
          typewriter(textEl, 'has been arrested!', 30).then(() => {
            buttons.style.display = '';
          });
        }, 800);

        overlay.querySelector('.carmen-btn-continue').addEventListener('click', () => { overlay.remove(); resolve('continue'); });
        overlay.querySelector('.carmen-btn-quit').addEventListener('click', () => { overlay.remove(); resolve('quit'); });
      });
    },

    showCaseFailed(suspectName, score) {
      els.musicToggle.style.display = 'none';
      return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'carmen-closing-overlay';
        overlay.innerHTML = `
          <div class="carmen-closing-content carmen-closing-failed">
            <div class="carmen-closing-stamp">FAILED</div>
            <div class="carmen-briefing-label">CASE CLOSED</div>
            <img src="${IMG.detectiveFull}" alt="" class="carmen-closing-detective">
            <div class="carmen-closing-name">${esc(suspectName)}</div>
            <div class="carmen-closing-text"></div>
            <div class="carmen-closing-score">${score} points</div>
            <div class="carmen-closing-detail">The real thief vanished into the shadows...</div>
            <div class="carmen-closing-buttons" style="display:none">
              <button class="carmen-closing-btn carmen-btn-continue">Next case →</button>
              <button class="carmen-closing-btn carmen-btn-quit">Quit</button>
            </div>
          </div>
        `;
        document.body.appendChild(overlay);

        const stamp = overlay.querySelector('.carmen-closing-stamp');
        const textEl = overlay.querySelector('.carmen-closing-text');
        const buttons = overlay.querySelector('.carmen-closing-buttons');

        setTimeout(() => { stamp.classList.add('animate'); playStamp(); }, 300);
        setTimeout(() => {
          typewriter(textEl, 'has escaped!', 30).then(() => {
            buttons.style.display = '';
          });
        }, 800);

        overlay.querySelector('.carmen-btn-continue').addEventListener('click', () => { overlay.remove(); resolve('continue'); });
        overlay.querySelector('.carmen-btn-quit').addEventListener('click', () => { overlay.remove(); resolve('quit'); });
      });
    },

    showCampaignComplete(score) {
      return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'carmen-closing-overlay';
        overlay.innerHTML = `
          <div class="carmen-closing-content carmen-closing-solved carmen-campaign-complete">
            <div class="carmen-closing-stamp">CAMPAIGN COMPLETE</div>
            <div class="carmen-briefing-label">CARMEN SANDIEGO — IN CUSTODY</div>
            <div class="carmen-closing-name">The world is safe. For now.</div>
            <div class="carmen-closing-score">${score} points</div>
            <div class="carmen-closing-detail">Ten cases. Ten artifacts. One detective.</div>
            <div class="carmen-closing-buttons">
              <button class="carmen-closing-btn carmen-btn-continue">Restart campaign</button>
            </div>
          </div>
        `;
        document.body.appendChild(overlay);
        const stamp = overlay.querySelector('.carmen-closing-stamp');
        setTimeout(() => { stamp.classList.add('animate'); playStamp(); }, 300);
        overlay.querySelector('.carmen-btn-continue').addEventListener('click', () => { overlay.remove(); resolve(); });
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

function formatArtifactBack(artifact) {
  const siteName = artifact.siteName || 'Unknown Site';
  const country = artifact.country || '';
  const hint = artifact.hint || '';
  const summary = (artifact.summary || '').trim();
  const sentences = summary ? summary.split(/(?<=[.!?])\s+/).filter(Boolean) : [];
  const lead = sentences.slice(0, 2).join(' ') || 'Reference note unavailable.';
  const extra = sentences.slice(2).join(' ');

  return `
    <div class="carmen-artifact-backdrop">
      <div class="carmen-artifact-back-type">ARCHIVE NOTE</div>
      <div class="carmen-artifact-back-site">${esc(siteName)}</div>
      ${country ? `<div class="carmen-artifact-back-origin">${esc(country)}</div>` : ''}
      <div class="carmen-artifact-note">
        <div class="carmen-artifact-note-clip"></div>
        <div class="carmen-artifact-note-label">FIELD NOTE</div>
        <div class="carmen-artifact-summary">${esc(lead)}</div>
        ${extra ? `<div class="carmen-artifact-summary carmen-artifact-summary-secondary">${esc(extra)}</div>` : ''}
        ${hint ? `<div class="carmen-artifact-geo-note"><span>Geo note:</span> ${esc(hint)}</div>` : ''}
      </div>
      <div class="carmen-artifact-back-return">↩ back to photo</div>
    </div>
  `;
}
