/**
 * Carmen UI — DOM rendering for "Where in the World?" game.
 */

import { playStamp, startClockTicking, stopClockTicking, toggleMusicMute, isMusicMuted } from '../audio/audio-engine.js';
import { IMG } from '../assets.js';
import { getInterpolBackgroundStory } from '../content/interpol-backgrounds.js';
import { getPortraitStyleVars } from '../content/portrait-specs.js';
import { typewriter } from './typewriter.js';
import { renderScramble, renderOutline, renderFlag } from './visual-clues.js';

function renderPortraitImg(suspect, extraClass = '') {
  const src = suspect.img || IMG.suspect(suspect.name);
  const className = extraClass ? `carmen-portrait-img ${extraClass}` : 'carmen-portrait-img';
  return `<img src="${esc(src)}" alt="${esc(suspect.name)}" class="${className}" style="${getPortraitStyleVars(suspect.name)}" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'🕵️'}))">`;
}

/**
 * Build the full game UI inside the given container.
 * Returns an API object with methods to update each section.
 *
 * @param {HTMLElement} container  — the element to render into
 * @param {Object}      flagCodes — { countryName: isoCode }
 */
export function createCarmenUI(container, flagCodes) {
  let worldDataRef = null;

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
      <div class="carmen-briefing-note" id="carmen-briefing-note"></div>
      <button class="carmen-briefing-start" id="carmen-briefing-start">Accept Mission →</button>
    </div>
  `;
  document.body.appendChild(briefingEl);

  const portraitInspectOverlay = document.createElement('div');
  portraitInspectOverlay.className = 'carmen-portrait-inspect-overlay';
  portraitInspectOverlay.innerHTML = `
    <div class="carmen-portrait-inspect-shell">
      <button class="carmen-portrait-inspect-close" type="button" aria-label="Close portrait inspection">×</button>
      <div class="carmen-portrait-inspect-frame">
        <img src="" alt="" class="carmen-portrait-inspect-img">
      </div>
    </div>
  `;
  document.body.appendChild(portraitInspectOverlay);

  // Build skeleton
  container.innerHTML = `
    <div class="carmen-status-bar">
      <div class="carmen-missions" id="carmen-missions"></div>
      <div class="carmen-score-status">Score: <b id="carmen-score">0</b></div>
      <div class="carmen-progress" id="carmen-progress"></div>
      <div class="carmen-clock" id="carmen-clock"><span class="carmen-clock-icon" aria-hidden="true">🕰</span><span class="carmen-clock-text"></span></div>
      <div class="carmen-music-toggle" id="carmen-music-toggle" title="Toggle music" style="display:none"><img src="${IMG.musicOn}" alt="Music"></div>
    </div>
    <div class="carmen-intro-row side-by-side" id="carmen-intro-row">
      <div class="carmen-left-panel">
        <div class="carmen-notebook-shell">
          <div class="carmen-notebook-tabs" id="carmen-notebook-tabs" style="display:none">
            <button class="carmen-notebook-tab active" data-tab="case">Case</button>
            <button class="carmen-notebook-tab" data-tab="investigate">Investigate</button>
            <button class="carmen-notebook-tab" data-tab="travel">Trail</button>
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
                <div class="carmen-witness-report carmen-witness-report-investigate" id="carmen-witness-report-investigate"></div>
              </div>
              <div class="carmen-panel-view" id="carmen-panel-travel" style="display:none">
                <div class="carmen-panel-card">
                  <div class="carmen-panel-badge">✈️ TRAIL</div>
                  <div class="carmen-panel-title" id="carmen-travel-title">Where does the border trail lead?</div>
                  <div class="carmen-panel-desc" id="carmen-travel-desc">Select a neighboring country on the map to confirm the next border lead.</div>
                  <div class="carmen-panel-cost">⏱️ Travel cost: <strong>5 hours</strong> per lead</div>
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
                  <div class="carmen-panel-desc">Browse current case files and compare suspect profiles by hand.</div>
                  <div class="carmen-panel-cost">Consult archive: <strong>3 hours</strong> per new file</div>
                </div>
                <div class="carmen-interpol-list" id="carmen-interpol-list"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="carmen-right-panel">
        <div class="carmen-right-shell">
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
            <div class="carmen-investigate-stage">
              <div class="carmen-clue-reveal" id="carmen-clue-reveal"></div>
            </div>
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
          <div class="carmen-right-view" id="carmen-rv-lineup" style="display:none">
            <div class="carmen-lineup-stage" id="carmen-lineup-stage"></div>
          </div>
          <div class="carmen-narrator-caption" id="carmen-narrator-caption" aria-live="polite"></div>
        </div>
      </div>
    </div>
  `;

  const els = {
    briefing: briefingEl,
    briefingArtifact: briefingEl.querySelector('#carmen-briefing-artifact'),
    briefingMission: briefingEl.querySelector('#carmen-briefing-mission'),
    briefingNote: briefingEl.querySelector('#carmen-briefing-note'),
    briefingStart: briefingEl.querySelector('#carmen-briefing-start'),
    introRow: container.querySelector('#carmen-intro-row'),
    narrative: container.querySelector('#carmen-narrative'),
    notebookTabs: container.querySelector('#carmen-notebook-tabs'),
    panelCase: container.querySelector('#carmen-panel-case'),
    panelInvestigate: container.querySelector('#carmen-panel-investigate'),
    travelTitle: container.querySelector('#carmen-travel-title'),
    travelDesc: container.querySelector('#carmen-travel-desc'),
    missions: container.querySelector('#carmen-missions'),
    score: container.querySelector('#carmen-score'),
    progress: container.querySelector('#carmen-progress'),
    clock: container.querySelector('#carmen-clock'),
    musicToggle: container.querySelector('#carmen-music-toggle'),
    locationsLabel: container.querySelector('#carmen-locations-label'),
    locations: container.querySelector('#carmen-locations'),
    witnessReport: container.querySelector('#carmen-witness-report'),
    witnessReportInvestigate: container.querySelector('#carmen-witness-report-investigate'),
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
    rvLineup: container.querySelector('#carmen-rv-lineup'),
    narratorCaption: container.querySelector('#carmen-narrator-caption'),
    interpolProfile: container.querySelector('#carmen-interpol-profile'),
    lineupStage: container.querySelector('#carmen-lineup-stage'),
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
  let narratorCaptionTimer = null;
  let narratorCaptionCleanupTimer = null;
  const caseCardState = {
    siteName: 'a priceless artifact',
    startCountry: '',
    thiefName: 'Unknown',
    mode: 'campaign',
  };
  const inspectState = {
    pinnedPhoto: null,
    overlayOpen: false,
  };
  const witnessReports = [];
  const lineupState = {
    active: false,
    suspects: [],
    selectedName: '',
    resolve: null,
    options: null,
  };

  function getLineupText() {
    const options = lineupState.options || {};
    return {
      title: options.title || 'SUSPECT LINEUP',
      subtitle: options.subtitle || 'Cross-check dossier and Interpol before issuing the warrant.',
      badge: options.badge || 'FINAL ACCUSATION',
      intel: options.intel || 'Review the files, then return here to issue the warrant.',
      targetBadge: options.targetBadge || 'PRIMARY TARGET',
      emptyTargetBadge: options.emptyTargetBadge || 'NO TARGET SELECTED',
      emptyName: options.emptyName || 'Choose a suspect',
      emptyText: options.emptyText || 'Study the four files below, then lock your warrant target here.',
      selectedText: options.selectedText || 'Warrant target selected. Issue the accusation when the file trail holds together.',
      gridLabel: options.gridLabel || 'Candidate mugshots',
      confirmLabel: options.confirmLabel || 'Accuse suspect',
      cardTargetLabel: options.cardTargetLabel || 'TARGET',
      cardDefaultLabel: options.cardDefaultLabel || 'FILE',
      cardTargetNote: options.cardTargetNote || 'Current warrant target',
      cardDefaultNote: options.cardDefaultNote || 'Review file',
    };
  }

  function supportsHoverInspect() {
    return typeof window.matchMedia === 'function'
      && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  }

  function clearPhotoInspectStyles(photoEl) {
    if (!photoEl) return;
    photoEl.classList.remove('is-inspecting', 'is-pinned');
    photoEl.style.removeProperty('--inspect-pan-x');
    photoEl.style.removeProperty('--inspect-pan-y');
    if (inspectState.pinnedPhoto === photoEl) {
      inspectState.pinnedPhoto = null;
    }
  }

  function closePortraitInspectOverlay() {
    if (!inspectState.overlayOpen) return;
    inspectState.overlayOpen = false;
    portraitInspectOverlay.classList.remove('is-open');
    document.body.classList.remove('carmen-inspect-open');
  }

  function animatePortraitInspectOpen(sourceEl) {
    if (!sourceEl || !sourceEl.animate) return;
    const img = portraitInspectOverlay.querySelector('.carmen-portrait-inspect-img');
    const sourceRect = sourceEl.getBoundingClientRect();
    const targetRect = img.getBoundingClientRect();
    if (!sourceRect.width || !sourceRect.height || !targetRect.width || !targetRect.height) return;

    const deltaX = (sourceRect.left + sourceRect.width / 2) - (targetRect.left + targetRect.width / 2);
    const deltaY = (sourceRect.top + sourceRect.height / 2) - (targetRect.top + targetRect.height / 2);
    const scaleX = sourceRect.width / targetRect.width;
    const scaleY = sourceRect.height / targetRect.height;

    img.animate([
      {
        transform: `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`,
        borderRadius: '3px',
      },
      {
        transform: 'translate(0, 0) scale(1, 1)',
        borderRadius: '8px',
      },
    ], {
      duration: 240,
      easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      fill: 'both',
    });
  }

  function openPortraitInspectOverlay(src, alt, style = '', sourceEl = null) {
    const img = portraitInspectOverlay.querySelector('.carmen-portrait-inspect-img');
    img.src = src;
    img.alt = alt;
    img.style.cssText = style;
    inspectState.overlayOpen = true;
    portraitInspectOverlay.classList.add('is-open');
    document.body.classList.add('carmen-inspect-open');
    requestAnimationFrame(() => animatePortraitInspectOpen(sourceEl));
  }

  function resetInterpolPhotoInspect() {
    clearPhotoInspectStyles(inspectState.pinnedPhoto);
    closePortraitInspectOverlay();
  }

  function updateInspectPan(photoEl, clientX, clientY) {
    const rect = photoEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const normalizedX = ((clientX - rect.left) / rect.width) - 0.5;
    const normalizedY = ((clientY - rect.top) / rect.height) - 0.5;
    const panX = Math.max(-18, Math.min(18, normalizedX * -22));
    const panY = Math.max(-16, Math.min(16, normalizedY * -18));
    photoEl.style.setProperty('--inspect-pan-x', `${panX}%`);
    photoEl.style.setProperty('--inspect-pan-y', `${panY}%`);
  }

  function bindInterpolPhotoInspect(photoEl, suspect, profileImage) {
    if (!photoEl || !profileImage) return;

    photoEl.addEventListener('pointerenter', (event) => {
      if (!supportsHoverInspect()) return;
      photoEl.classList.add('is-inspecting');
      updateInspectPan(photoEl, event.clientX, event.clientY);
    });

    photoEl.addEventListener('pointermove', (event) => {
      if (!supportsHoverInspect()) return;
      photoEl.classList.add('is-inspecting');
      updateInspectPan(photoEl, event.clientX, event.clientY);
    });

    photoEl.addEventListener('pointerleave', () => {
      if (!photoEl.classList.contains('is-pinned')) {
        clearPhotoInspectStyles(photoEl);
      }
    });

    photoEl.addEventListener('click', (event) => {
      event.preventDefault();
      clearPhotoInspectStyles(photoEl);
      openPortraitInspectOverlay(profileImage, suspect.name, getPortraitStyleVars(suspect.name), photoEl);
    });

    photoEl.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        clearPhotoInspectStyles(photoEl);
        openPortraitInspectOverlay(profileImage, suspect.name, getPortraitStyleVars(suspect.name), photoEl);
      } else if (event.key === 'Escape') {
        clearPhotoInspectStyles(photoEl);
      }
    });

    photoEl.addEventListener('blur', () => {
      if (!photoEl.classList.contains('is-pinned')) {
        clearPhotoInspectStyles(photoEl);
      }
    });
  }

  portraitInspectOverlay.addEventListener('click', (event) => {
    if (event.target === portraitInspectOverlay || event.target.closest('.carmen-portrait-inspect-close')) {
      closePortraitInspectOverlay();
    }
  });

  document.addEventListener('pointerdown', (event) => {
    if (inspectState.overlayOpen) return;
    if (inspectState.pinnedPhoto && !inspectState.pinnedPhoto.contains(event.target)) {
      clearPhotoInspectStyles(inspectState.pinnedPhoto);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (inspectState.overlayOpen) {
      closePortraitInspectOverlay();
      return;
    }
    clearPhotoInspectStyles(inspectState.pinnedPhoto);
  });

  // Click the Interpol header card to return to intro view
  if (els.interpolCard) {
    els.interpolCard.style.cursor = 'pointer';
    els.interpolCard.addEventListener('click', () => {
      resetInterpolPhotoInspect();
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
  const manifestState = {
    enabled: false,
    caseNumber: null,
    totalCases: null,
    segments: [],
    routePatterns: [],
  };

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
  const allRightViews = [els.rvArtifact, els.rvClues, els.rvMap, els.rvDossier, els.rvInterpol, els.rvLineup];
  let activeTab = 'case';
  const notebookTabOrder = ['case', 'investigate', 'travel', 'dossier', 'interpol'];

  function getAllowedTabs() {
    return lineupState.active ? new Set(['case', 'dossier', 'interpol']) : new Set(notebookTabOrder);
  }

  function getRightViewForTab(tab) {
    if (lineupState.active && tab === 'case') return els.rvLineup;
    return rightViewForTab[tab];
  }

  function renderNotebookTabs() {
    const allowedTabs = getAllowedTabs();
    els.notebookTabs.querySelectorAll('.carmen-notebook-tab').forEach((tabEl) => {
      const enabled = allowedTabs.has(tabEl.dataset.tab);
      tabEl.classList.toggle('is-disabled', !enabled);
      tabEl.setAttribute('aria-disabled', enabled ? 'false' : 'true');
      tabEl.tabIndex = enabled ? 0 : -1;
    });
  }

  function switchTab(tab) {
    if (!getAllowedTabs().has(tab)) return;
    if (activeTab === 'interpol' && tab !== 'interpol') {
      resetInterpolPhotoInspect();
    }
    activeTab = tab;
    // Left panel
    for (const [key, el] of Object.entries(leftPanels)) {
      el.style.display = key === tab ? '' : 'none';
    }
    // Right panel
    const targetRight = getRightViewForTab(tab);
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

  function renderLineupCaseSummary() {
    const text = getLineupText();
    els.narrative.innerHTML = `
      <div class="carmen-intro-card">
        <div class="carmen-intro-badge">${esc(text.badge)}</div>
        <div class="carmen-intro-artifact">${esc(caseCardState.siteName)}</div>
        <div class="carmen-intro-origin">Stolen from <strong>${esc(caseCardState.startCountry)}</strong></div>
        <div class="carmen-intro-suspect">🔍 Suspect: <span class="thief-name">${lineupState.selectedName ? esc(lineupState.selectedName) : 'Unknown'}</span></div>
        <div class="carmen-intro-intel">${esc(text.intel)}</div>
      </div>
    `;
  }

  function renderLineupStage() {
    if (!els.lineupStage) return;
    const text = getLineupText();
    const selectedName = lineupState.selectedName;
    const selectedSuspect = lineupState.suspects.find((suspect) => suspect.name === selectedName) || null;
    els.lineupStage.innerHTML = `
      <div class="carmen-lineup-content carmen-lineup-content-panel">
        <div class="carmen-lineup-title">${esc(text.title)}</div>
        <div class="carmen-lineup-subtitle">${esc(text.subtitle)}</div>
        <div class="carmen-lineup-target${selectedSuspect ? ' is-locked' : ''}">
          <div class="carmen-lineup-target-badge">${esc(selectedSuspect ? text.targetBadge : text.emptyTargetBadge)}</div>
          <div class="carmen-lineup-target-body">
            <div class="carmen-lineup-target-portrait">
              ${selectedSuspect
                ? renderPortraitImg(selectedSuspect)
                : '<span aria-hidden="true">🕵️</span>'}
            </div>
            <div class="carmen-lineup-target-copy">
              <div class="carmen-lineup-target-name">${esc(selectedSuspect ? selectedSuspect.name : text.emptyName)}</div>
              <div class="carmen-lineup-target-text">${esc(selectedSuspect ? text.selectedText : text.emptyText)}</div>
            </div>
            <div class="carmen-lineup-actions">
              <button class="carmen-lineup-confirm-btn" ${selectedName ? '' : 'disabled'}>${esc(text.confirmLabel)}</button>
            </div>
          </div>
        </div>
        <div class="carmen-lineup-grid-label">${esc(text.gridLabel)}</div>
        <div class="carmen-lineup-grid">
          ${lineupState.suspects.map(s => `
            <button class="carmen-suspect-card${selectedName === s.name ? ' selected' : ''}" data-name="${esc(s.name)}">
              <div class="carmen-suspect-card-badge">${esc(selectedName === s.name ? text.cardTargetLabel : text.cardDefaultLabel)}</div>
              <div class="carmen-suspect-card-body">
                <div class="carmen-suspect-silhouette">${renderPortraitImg(s)}</div>
                <div class="carmen-suspect-card-copy">
                  <div class="carmen-suspect-name">${esc(s.name)}</div>
                  <div class="carmen-suspect-card-note">${esc(selectedName === s.name ? text.cardTargetNote : text.cardDefaultNote)}</div>
                </div>
              </div>
            </button>
          `).join('')}
        </div>
      </div>
    `;

    els.lineupStage.querySelectorAll('.carmen-suspect-card').forEach(card => {
      card.addEventListener('click', () => {
        lineupState.selectedName = card.dataset.name;
        renderLineupCaseSummary();
        renderLineupStage();
      });
    });

    const confirmBtn = els.lineupStage.querySelector('.carmen-lineup-confirm-btn');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        if (!lineupState.selectedName || !lineupState.resolve) return;
        const chosenName = lineupState.selectedName;
        const resolve = lineupState.resolve;
        lineupState.active = false;
        lineupState.suspects = [];
        lineupState.selectedName = '';
        lineupState.resolve = null;
        if (els.lineupStage) {
          els.lineupStage.innerHTML = '';
        }
        renderNotebookTabs();
        switchTab('case');
        resolve(chosenName);
      });
    }
  }

  function enterLineupPhase(lineup, resolve) {
    lineupState.active = true;
    lineupState.suspects = lineup.slice();
    lineupState.selectedName = '';
    lineupState.resolve = resolve;
    els.locationsLabel.style.display = 'none';
    els.locations.innerHTML = '';
    els.reveal.style.display = 'none';
    els.reveal.innerHTML = '';
    els.sidebar.innerHTML = '';
    renderNotebookTabs();
    renderLineupCaseSummary();
    renderLineupStage();
    switchTab('case');
  }

  els.artifactDisplay.addEventListener('click', () => {
    els.artifactDisplay.classList.toggle('flipped');
    if (els.artifactFlipLabel) {
      els.artifactFlipLabel.classList.add('hidden');
    }
  });

  els.musicToggle.addEventListener('click', () => {
    const muted = toggleMusicMute();
    els.musicToggle.innerHTML = `<img src="${muted ? IMG.musicOff : IMG.musicOn}" alt="Music">`;
  });

  function getRevealedPatterns() {
    const confirmed = manifestState.segments.length;
    const patterns = manifestState.routePatterns;
    if (!patterns.length || confirmed < 3) return [];
    const maxRevealed = confirmed <= 3 ? 1 : patterns.length;
    return patterns.slice(0, maxRevealed).map(p => confirmed >= 4 ? p.detail : p.text);
  }

  function renderManifestBoard() {
    if (!manifestState.enabled) return '';
    const caseLabel = manifestState.caseNumber && manifestState.totalCases
      ? `Skyline Case ${manifestState.caseNumber} / ${manifestState.totalCases}`
      : 'Skyline Case';
    const segmentHtml = manifestState.segments.length
      ? manifestState.segments.map((segment, index) => {
          const chips = [
            segment.gatewayBand ? `Gateway: ${segment.gatewayBand}` : '',
            segment.distanceBand ? `Range: ${segment.distanceBand}` : '',
            segment.clockLabel ? `Clock: ${segment.clockLabel}` : '',
          ].filter(Boolean);
          const fromLabel = [segment.fromCapital, segment.fromCountry].filter(Boolean).join(', ');
          const toLabel = [segment.toCapital, segment.toCountry].filter(Boolean).join(', ');
          return `
            <div class="carmen-manifest-segment">
              <div class="carmen-manifest-segment-top">
                <span class="carmen-manifest-step">SEGMENT ${index + 1}</span>
                <span class="carmen-manifest-route">${esc(fromLabel || segment.fromCountry || 'Unknown')} -> ${esc(toLabel || segment.toCountry || 'Unknown')}</span>
              </div>
              <div class="carmen-manifest-chips">
                ${chips.map(chip => `<span class="carmen-manifest-chip">${esc(chip)}</span>`).join('')}
              </div>
              <div class="carmen-manifest-fragment">
                <span class="carmen-manifest-fragment-label">Recovered fragment</span>
                <span class="carmen-manifest-fragment-text">${esc(segment.fragmentText || 'MANIFEST ENTRY RECOVERED')}</span>
              </div>
            </div>
          `;
        }).join('')
      : '<div class="carmen-manifest-empty">No confirmed corridors yet.</div>';
    const patterns = getRevealedPatterns();
    const patternHtml = patterns.length
      ? `<div class="carmen-manifest-patterns">
          <div class="carmen-manifest-patterns-label">DISPATCHER SIGNATURE</div>
          ${patterns.map(p => `<div class="carmen-manifest-pattern">${esc(p)}</div>`).join('')}
        </div>`
      : '';
    return `
      <div class="carmen-manifest-board">
        <div class="carmen-manifest-header">
          <div>
            <div class="carmen-manifest-kicker">ACME MANIFEST BOARD</div>
            <div class="carmen-manifest-title">${esc(caseLabel)}</div>
          </div>
          <div class="carmen-manifest-count">${manifestState.segments.length} recovered</div>
        </div>
        ${segmentHtml}
        ${patternHtml}
      </div>
    `;
  }

  function renderDossier() {
    if (dossierEntries.length === 0 && !manifestState.enabled) {
      els.dossierBody.innerHTML = '<div class="carmen-dossier-empty">No clues gathered yet. Investigate locations to find leads.</div>';
      return;
    }
    // Render entries in order, grouping consecutive entries with the same stopKey
    let html = `<div class="carmen-dossier-page">${renderManifestBoard()}`;
    if (dossierEntries.length === 0) {
      html += '<div class="carmen-dossier-empty">No clues gathered yet. Investigate locations to find leads.</div>';
      html += '</div>';
      els.dossierBody.innerHTML = html;
      return;
    }
    let currentKey = null;
    let sectionOpen = false;
    for (const e of dossierEntries) {
      const key = e.stopKey;
      if (key !== currentKey) {
        if (sectionOpen) html += '</div>';
        currentKey = key;
        const location = e.capital && e.country
          ? ` — ${esc(e.capital)}, ${esc(e.country)}`
          : e.country ? ` — ${esc(e.country)}` : '';
        const detourClass = e.type === 'detour' ? ' carmen-dossier-detour' : '';
        const label = e.type === 'detour' ? 'Dead end' : `Stop ${Number(e.stop) + 1}`;
        html += `<div class="carmen-dossier-section${detourClass}"><div class="carmen-dossier-stop${detourClass}">${label}${location}</div>`;
        sectionOpen = true;
      }
      const icon = e.emoji || '';
      const entryClass = e.type === 'detour' ? ' carmen-dossier-detour' : '';
      html += `<div class="carmen-dossier-entry${entryClass}">
        ${icon ? `<span class="carmen-dossier-emoji">${icon}</span>` : ''}
        <span class="carmen-dossier-prefix">${esc(e.informantPrefix || 'Clue')}:</span>
        <span class="carmen-dossier-text">${esc(e.clueText)}</span>
      </div>`;
    }
    if (sectionOpen) html += '</div>';
    html += '</div>';
    els.dossierBody.innerHTML = html;
    // Auto-scroll to bottom
    els.dossierBody.scrollTop = els.dossierBody.scrollHeight;
  }

  function createWitnessEntry(report, includeActions = false) {
    const entry = document.createElement('div');
    entry.className = `carmen-witness-entry${report.confirmed ? ' carmen-witness-confirmed' : ''}`;
    if (report.clueId) entry.dataset.clueId = report.clueId;

    let investigateHtml = '';
    if (includeActions && report.canInvestigate && report.onInvestigateFurther && !report.confirmed) {
      const cost = report.investigateCost || 2;
      investigateHtml = `
        <button class="carmen-investigate-further-btn">
          🔎 Investigate further (${cost}h)
        </button>
      `;
    }

    entry.innerHTML = `
      <div class="carmen-witness-header">
        <span class="carmen-witness-emoji">${esc(report.emoji)}</span>
        <span class="carmen-witness-prefix">${esc(report.prefix)}:</span>
      </div>
      <div class="carmen-witness-text">"${esc(report.text)}"</div>
      ${investigateHtml}
    `;

    if (includeActions && report.confirmedText) {
      const confirmed = document.createElement('div');
      confirmed.className = 'carmen-witness-text carmen-witness-specific';
      confirmed.textContent = `"${report.confirmedText}"`;
      entry.appendChild(confirmed);
    }

    if (includeActions && report.onInvestigateFurther && !report.confirmed) {
      const btn = entry.querySelector('.carmen-investigate-further-btn');
      if (btn) {
        btn.addEventListener('click', () => {
          btn.remove();
          report.onInvestigateFurther();
        });
      }
    }

    return entry;
  }

  function renderWitnessReports() {
    const latest = witnessReports[witnessReports.length - 1];

    if (els.witnessReport) {
      els.witnessReport.innerHTML = '';
      if (latest) {
        els.witnessReport.appendChild(createWitnessEntry(latest, false));
      }
    }

    if (els.witnessReportInvestigate) {
      els.witnessReportInvestigate.innerHTML = '';
      if (latest) {
        els.witnessReportInvestigate.appendChild(createWitnessEntry(latest, true));
      }
    }
  }

  function clearNarratorCaptionTimers() {
    if (narratorCaptionTimer) {
      clearTimeout(narratorCaptionTimer);
      narratorCaptionTimer = null;
    }
    if (narratorCaptionCleanupTimer) {
      clearTimeout(narratorCaptionCleanupTimer);
      narratorCaptionCleanupTimer = null;
    }
  }

  function hideNarratorCaption(immediate = false) {
    clearNarratorCaptionTimers();
    if (!els.narratorCaption) return;

    if (immediate || !els.narratorCaption.classList.contains('is-visible')) {
      els.narratorCaption.classList.remove('is-visible', 'is-fading');
      els.narratorCaption.textContent = '';
      return;
    }

    els.narratorCaption.classList.add('is-fading');
    els.narratorCaption.classList.remove('is-visible');
    narratorCaptionCleanupTimer = setTimeout(() => {
      els.narratorCaption.classList.remove('is-fading');
      els.narratorCaption.textContent = '';
      narratorCaptionCleanupTimer = null;
    }, 500);
  }

  /** Remove any active evidence panel and restore the clue view. */
  function dismissEvidence() {
    const panel = els.rvClues.querySelector('.carmen-evidence-panel');
    if (panel) panel.remove();
    const stage = els.rvClues.querySelector('.carmen-investigate-stage');
    if (stage) stage.style.display = '';
  }

  function showNarratorCaption(text, duration = null) {
    if (!text || !els.narratorCaption) return;

    clearNarratorCaptionTimers();
    els.narratorCaption.textContent = text;
    els.narratorCaption.classList.remove('is-fading');
    // Restart animation when a new caption arrives quickly after the last one.
    void els.narratorCaption.offsetWidth;
    els.narratorCaption.classList.add('is-visible');

    const resolvedDuration = duration == null
      ? Math.min(12000, Math.max(6200, 4200 + (text.length * 28)))
      : duration;

    if (resolvedDuration !== Infinity) {
      narratorCaptionTimer = setTimeout(() => {
        hideNarratorCaption();
      }, resolvedDuration);
    }
  }

  let detourCounter = 0;

  function isSkylineMode(mode) {
    return mode === 'skyline_syndicate';
  }

  function getRouteCopy(mode = caseCardState.mode) {
    if (isSkylineMode(mode)) {
      return {
        travelTitle: 'Where does the air trail lead?',
        travelDesc: 'Select a capital flight lead on the map to confirm the next corridor.',
        introMission: 'Investigate locations, gather clues, and confirm the air trail.',
        confirmedLead: 'Air corridor confirmed',
        deadEndLead: 'No confirmed flight lead',
        deadEndNarrator: 'Another dead end. Took the wrong flight corridor. Maybe I ought to study the map at <a href="https://geoquiz.info/study.html" target="_blank" rel="noopener noreferrer">geoquiz.info/study.html</a> before this case eats me alive.',
      };
    }
    return {
      travelTitle: 'Where does the border trail lead?',
      travelDesc: 'Select a neighboring country on the map to confirm the next border lead.',
      introMission: 'Investigate locations, gather clues, and confirm the border trail.',
      confirmedLead: 'Border lead confirmed',
      deadEndLead: 'No confirmed border lead',
      deadEndNarrator: 'Another dead end. Took the wrong border. Maybe I ought to study the map at <a href="https://geoquiz.info/study.html" target="_blank" rel="noopener noreferrer">geoquiz.info/study.html</a> before this case eats me alive.',
    };
  }

  function applyRouteCopy(mode) {
    const copy = getRouteCopy(mode);
    if (els.travelTitle) els.travelTitle.textContent = copy.travelTitle;
    if (els.travelDesc) els.travelDesc.textContent = copy.travelDesc;
  }

  return {
    get mapSvg() { return els.map; },

    setWorldData(data) { worldDataRef = data; },

    switchTab(tab) { switchTab(tab); },

    showNarratorCaption(text, duration) {
      showNarratorCaption(text, duration);
    },

    hideNarratorCaption(immediate = false) {
      hideNarratorCaption(immediate);
    },

    setManifestMode(enabled, options = null) {
      manifestState.enabled = !!enabled;
      manifestState.caseNumber = options?.caseNumber || null;
      manifestState.totalCases = options?.totalCases || null;
      renderDossier();
    },

    resetManifestBoard() {
      manifestState.segments.length = 0;
      manifestState.routePatterns = [];
      renderDossier();
    },

    setManifestPatterns(patterns) {
      manifestState.routePatterns = patterns || [];
    },

    addManifestSegment(segment) {
      if (!manifestState.enabled || !segment) return;
      const duplicate = manifestState.segments.some(existing =>
        existing.fromCountry === segment.fromCountry &&
        existing.toCountry === segment.toCountry &&
        existing.stopIndex === segment.stopIndex
      );
      if (duplicate) return;
      manifestState.segments.push(segment);
      renderDossier();
    },

    /** Add a clue to the dossier. */
    addDossierEntry(stop, clueText, informantPrefix, emoji, country, capital) {
      dossierEntries.push({ stop, stopKey: `stop-${stop}`, clueText, informantPrefix, emoji, country, capital });
      renderDossier();
    },

    /** Add a dead-end detour entry to the dossier. */
    addDetourEntry(country, capital, options = null) {
      const key = `detour-${detourCounter++}`;
      dossierEntries.push({
        stop: -1, stopKey: key, type: 'detour',
        clueText: isSkylineMode(options?.mode) ? 'No manifest match, no corridor confirmation. A dead end.' : 'No witnesses, no clues. A dead end.',
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
    showInterpolList(suspects, unlockedNames, viewedNames, markedNames, onView) {
      let html = '';
      const markedSuspects = suspects.filter(s => markedNames.has(s.name));
      if (markedSuspects.length > 0) {
        html += `<div class="carmen-interpol-interest-strip">
          <div class="carmen-interpol-interest-label">Suspects of Interest</div>
          <div class="carmen-interpol-interest-list">
            ${markedSuspects.map(s => `<button class="carmen-interpol-interest-chip" data-name="${esc(s.name)}">${esc(s.name)}</button>`).join('')}
          </div>
        </div>`;
      }
      for (const s of suspects) {
        const isCarmen = s.name === 'Carmen Sandiego';
        const hasPhoto = !!s.img;
        const available = isCarmen || hasPhoto;
        const viewed = viewedNames.has(s.name);
        const marked = markedNames.has(s.name);
        const inCustody = unlockedNames.has(s.name);
        const initials = s.name.split(/\s+/).map(part => part[0]).slice(0, 2).join('.').toUpperCase();
        if (available) {
          const freeAccess = viewed || inCustody;
          const costLabel = freeAccess ? 'free' : '3h';
          html += `<button class="carmen-interpol-entry${freeAccess ? ' viewed' : ''}${marked ? ' marked' : ''}${inCustody ? ' in-custody' : ''}" data-name="${esc(s.name)}">
            <span class="carmen-interpol-entry-tab"></span>
            <span class="carmen-interpol-entry-icon">${hasPhoto ? '📷' : '🕵️'}</span>
            <span class="carmen-interpol-entry-meta">
              <span class="carmen-interpol-entry-name">${esc(s.name)}${marked ? '<span class="carmen-interpol-entry-poi">POI</span>' : ''}</span>
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

      els.interpolList.querySelectorAll('.carmen-interpol-interest-chip').forEach(btn => {
        btn.addEventListener('click', () => {
          const suspect = suspects.find(s => s.name === btn.dataset.name);
          if (suspect) onView(suspect);
        });
      });

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
    showInterpolProfile(suspect, theftRecords, status, campaignPhase, isMarked = false, onToggleMark = null, intel = null, page = 'main') {
      resetInterpolPhotoInspect();
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
      const isCarmenPreFinale = suspect.name === 'Carmen Sandiego' && campaignPhase !== 'finale';
      const profileImage = suspect.name === 'Carmen Sandiego' && campaignPhase === 'finale'
        ? 'carmen/img/Carmen Sandiego.png'
        : suspect.img;
      const inspectablePhoto = !!profileImage && !isCarmenPreFinale;
      const photoClasses = `carmen-interpol-photo${inspectablePhoto ? ' is-inspectable' : ''}`;
      const photoHtml = isCarmenPreFinale
        ? `<div class="carmen-interpol-photo-redacted">
            <div class="carmen-interpol-photo-redacted-label">NO PHOTO</div>
          </div>`
        : profileImage
          ? `<img src="${esc(profileImage)}" alt="${esc(suspect.name)}" class="carmen-interpol-photo-img carmen-portrait-img" style="${getPortraitStyleVars(suspect.name)}">`
          : `<div class="carmen-interpol-photo-silhouette">🕵️</div>`;

      const thefts = theftRecords || [];
      const theftHtml = thefts.length > 0
        ? thefts.map(t =>
            `<div class="carmen-interpol-detail">📦 ${esc(t.artifact)} — stolen from ${esc(t.country)} (${esc(t.date)})</div>`
          ).join('')
        : '<div class="carmen-interpol-detail">No recorded thefts on file.</div>';

      const statusClass = status === 'ACTIVE' ? 'at-large' : 'in-custody';
      const markLabel = isMarked ? 'Remove Mark' : 'Mark as Person of Interest';
      const backgroundStory = status === 'IN CUSTODY' ? getInterpolBackgroundStory(suspect) : null;
      const hasBackgroundPage = !!backgroundStory;
      const anomalySection = intel?.anomaly ? `
            <div class="carmen-interpol-section">
              <div class="carmen-interpol-section-label">FILE ANOMALIES</div>
              <div class="carmen-interpol-notes">${esc(intel.anomaly)}</div>
            </div>
          ` : '';
      const irregularitySection = intel?.irregularity ? `
            <div class="carmen-interpol-section">
              <div class="carmen-interpol-section-label">RECORD IRREGULARITIES</div>
              <div class="carmen-interpol-notes">${esc(intel.irregularity)}</div>
            </div>
          ` : '';
      const networkSection = intel?.network ? `
            <div class="carmen-interpol-section">
              <div class="carmen-interpol-section-label">NETWORK FLAGS</div>
              <div class="carmen-interpol-notes">${esc(intel.network)}</div>
            </div>
          ` : '';
      const patternSection = intel?.pattern ? `
            <div class="carmen-interpol-section">
              <div class="carmen-interpol-section-label">PATTERN NOTE</div>
              <div class="carmen-interpol-notes">${esc(intel.pattern)}</div>
            </div>
          ` : '';
      const pageNavButton = hasBackgroundPage && page === 'main'
        ? '<button class="carmen-interpol-page-btn" data-page="background">Read Background File →</button>'
        : page === 'background'
          ? '<button class="carmen-interpol-page-btn" data-page="main">← Return To Main File</button>'
          : '';

      if (page === 'background' && hasBackgroundPage) {
        const storyHtml = backgroundStory
          .split('\n\n')
          .map(paragraph => `<p>${esc(paragraph)}</p>`)
          .join('');

        els.interpolProfile.innerHTML = `
          <div class="carmen-interpol-card">
            <div class="carmen-interpol-sheet carmen-interpol-sheet-back-1" aria-hidden="true"></div>
            <div class="carmen-interpol-sheet carmen-interpol-sheet-back-2" aria-hidden="true"></div>
            <div class="carmen-interpol-file">
              <div class="carmen-interpol-paperclip" aria-hidden="true"></div>
              <div class="carmen-interpol-header-label">INTERPOL FILE — SUPPLEMENTAL NARRATIVE</div>
              ${pageNavButton}
              <div class="carmen-interpol-story-head">
                <div class="carmen-interpol-name">${esc(suspect.name)}</div>
                <div class="carmen-interpol-story-subtitle">Background history and entry into professional criminal absurdity</div>
              </div>
              <div class="carmen-interpol-section">
                <div class="carmen-interpol-section-label">BACKGROUND HISTORY</div>
                <div class="carmen-interpol-story">${storyHtml}</div>
              </div>
            </div>
          </div>
        `;

        const pageBtn = els.interpolProfile.querySelector('.carmen-interpol-page-btn');
        if (pageBtn) {
          pageBtn.addEventListener('click', (event) => {
            event.preventDefault();
            this.showInterpolProfile(suspect, thefts, status, campaignPhase, isMarked, onToggleMark, intel, 'main');
          });
        }
        return;
      }

      els.interpolProfile.innerHTML = `
        <div class="carmen-interpol-card">
          <div class="carmen-interpol-sheet carmen-interpol-sheet-back-1" aria-hidden="true"></div>
          <div class="carmen-interpol-sheet carmen-interpol-sheet-back-2" aria-hidden="true"></div>
          <div class="carmen-interpol-file">
            <div class="carmen-interpol-paperclip" aria-hidden="true"></div>
            <div class="carmen-interpol-header-label">INTERPOL FILE — CLASSIFIED</div>
            <button class="carmen-interpol-mark-btn${isMarked ? ' marked' : ''}" data-name="${esc(suspect.name)}">${markLabel}</button>
            ${pageNavButton}
            <div class="carmen-interpol-top">
              <div class="${photoClasses}" ${inspectablePhoto ? `tabindex="0" role="button" aria-label="Inspect ${esc(suspect.name)} portrait"` : ''}>
                ${photoHtml}
                ${inspectablePhoto ? '<div class="carmen-interpol-photo-hint">Inspect</div>' : ''}
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
            ${anomalySection}
            ${irregularitySection}
            ${networkSection}
            ${patternSection}
            <div class="carmen-interpol-section">
              <div class="carmen-interpol-section-label">NOTES</div>
              <div class="carmen-interpol-notes">${esc(quirkOverride || suspect.quirk || 'No behavioral notes on file.')}</div>
            </div>
          </div>
        </div>
      `;

      const markBtn = els.interpolProfile.querySelector('.carmen-interpol-mark-btn');
      if (markBtn && onToggleMark) {
        markBtn.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          onToggleMark(suspect.name);
        });
      }
      const pageBtn = els.interpolProfile.querySelector('.carmen-interpol-page-btn');
      if (pageBtn) {
        pageBtn.addEventListener('click', (event) => {
          event.preventDefault();
          this.showInterpolProfile(suspect, thefts, status, campaignPhase, isMarked, onToggleMark, intel, 'background');
        });
      }
      const inspectPhoto = els.interpolProfile.querySelector('.carmen-interpol-photo.is-inspectable');
      if (inspectPhoto) {
        bindInterpolPhotoInspect(inspectPhoto, suspect, profileImage);
      }
    },

    /** Clear witness reports on Case tab. */
    clearWitnessReports() {
      witnessReports.length = 0;
      renderWitnessReports();
    },

    /** Show a witness report on Case preview and Investigate workspace. */
    addWitnessReport(clue, informant) {
      witnessReports.push({
        emoji: informant?.emoji || '🔍',
        prefix: informant?.prefix || 'Witness report',
        text: clue.text,
        clueId: informant?.clueId || '',
        canInvestigate: !!informant?.canInvestigate,
        investigateCost: informant?.investigateCost || 2,
        onInvestigateFurther: informant?.onInvestigateFurther || null,
        confirmed: false,
        confirmedText: '',
      });
      renderWitnessReports();
    },

    /** Upgrade a vague witness report to a specific one in-place. */
    upgradeWitnessReport(clueId, specificClue) {
      const report = witnessReports.find(r => r.clueId === clueId);
      if (report) {
        report.confirmed = true;
        report.confirmedText = specificClue.text;
      }
      renderWitnessReports();
    },

    /** Show dramatic case briefing overlay. Returns a promise that resolves when player clicks start. */
    showCaseBriefing(artifact, startCountry, totalHours, caseNumber, totalCases, campaignPhase, briefingNote = '', options = null) {
      return new Promise(resolve => {
        const siteName = artifact.siteName || 'a priceless artifact';
        const mode = options?.mode || 'campaign';
        const openCaseNumber = options?.openCaseNumber || caseNumber;
        const caseLabel = mode === 'skyline_syndicate'
          ? `SKYLINE CASE — ${caseNumber} / ${totalCases}`
          : mode === 'open_cases'
          ? `OPEN CASE — ${openCaseNumber}`
          : caseNumber
          ? (campaignPhase === 'finale' ? `FINAL CASE — ${caseNumber} / ${totalCases}` : `CASE ${caseNumber} / ${totalCases}`)
          : 'STOLEN ARTIFACT';
        els.briefingArtifact.innerHTML = `
          <div class="carmen-artifact-label">${esc(caseLabel)}</div>
          <div class="carmen-artifact-name">${esc(siteName)}</div>
          <div class="carmen-artifact-origin">Last seen in ${esc(startCountry)}</div>
        `;
        els.briefingMission.textContent = '';
        els.briefingNote.textContent = briefingNote || '';
        els.briefingNote.style.display = briefingNote ? '' : 'none';
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
        const timeText = totalHours ? ` You have only ${totalHours} hours before the case goes cold.` : '';
        const missionCopy = options?.missionCopy || (
          mode === 'open_cases'       ? "ACME has narrowed this active theft to a chain of border crossings. Reconstruct the trail from country to country, gather witness reports, and close the file before the trail breaks." :
          campaignPhase === 'whispers' ? "ACME has narrowed the escape to a chain of border crossings. Witnesses keep mentioning a shadow behind the shadow — someone bigger is pulling strings." :
          campaignPhase === 'pursuit'  ? "ACME has traced this border trail to Carmen Sandiego's network. The thief is one of her lieutenants — every arrest brings you closer to her." :
          campaignPhase === 'finale'   ? "This is it. ACME believes Carmen Sandiego is moving under an alias. Reconstruct the border trail, expose the false identity, and bring her in before the file goes cold." :
          "ACME has narrowed the escape to a chain of border crossings. Investigate locations, gather clues, and identify the suspect to make your arrest."
        );
        typewriter(els.briefingMission, `${missionCopy}${timeText}`, 20, {
          skipTargets: [els.briefing],
        })
          .then(() => {
            els.briefingStart.style.display = '';
          });

        els.briefingStart.onclick = () => {
          els.briefing.style.display = 'none';
          resolve();
        };
      });
    },

    showIntro(thiefName, artifact, startCountry, options = null) {
      const mode = options?.mode || 'campaign';
      const copy = getRouteCopy(mode);
      resetInterpolPhotoInspect();
      const siteName = artifact.siteName || 'a priceless artifact';
      const imgUrl = artifact.imageUrl || '';
      caseCardState.siteName = siteName;
      caseCardState.startCountry = startCountry || '';
      caseCardState.thiefName = thiefName || 'Unknown';
      caseCardState.mode = mode;
      applyRouteCopy(mode);
      // Set artifact image for the right-side display
      if (imgUrl) {
        els.artifactImg.src = imgUrl;
        els.artifactImg.alt = siteName;
      }
      lineupState.active = false;
      lineupState.suspects = [];
      lineupState.selectedName = '';
      lineupState.resolve = null;
      lineupState.options = null;
      if (els.lineupStage) {
        els.lineupStage.innerHTML = '';
      }
      renderNotebookTabs();
      els.artifactSummary.innerHTML = formatArtifactBack(artifact);
      els.artifactDisplay.classList.remove('flipped');
      if (els.artifactFlipLabel) {
        els.artifactFlipLabel.classList.remove('hidden');
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
          <div class="carmen-intro-mission">${esc(copy.introMission)}</div>
        </div>
      `;
    },

    showStopNarrative(stopIndex, totalStops, options = null) {
      if (options?.mode) {
        caseCardState.mode = options.mode;
        applyRouteCopy(options.mode);
      }
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
          <div class="carmen-intro-artifact">${esc(caseCardState.siteName)}</div>
          <div class="carmen-intro-origin">Stolen from <strong>${esc(caseCardState.startCountry)}</strong></div>
          <div class="carmen-intro-suspect">🔍 Suspect: <span class="thief-name">${esc(caseCardState.thiefName)}</span></div>
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
    updateMissions(history, showCurrent = true, caseNumber, totalCases, labelOverride = '') {
      // Limit to fit: keep last N entries
      const maxMarks = 12;
      const totalNeeded = history.length + (showCurrent ? 1 : 0);
      const start = Math.max(0, totalNeeded - maxMarks);
      const visible = history.slice(start);

      let html = '';
      if (labelOverride) {
        html += `<span class="carmen-missions-label">${esc(labelOverride)}</span>`;
      } else if (caseNumber && totalCases) {
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
      const displayStop = Math.min(total, stop + 1);
      els.progress.textContent = `Stop ${displayStop} of ${total}`;
    },

    updateClock(hoursRemaining, totalHours) {
      const clockText = els.clock.querySelector('.carmen-clock-text');
      const setClockText = (text) => {
        if (clockText) clockText.textContent = text;
        else els.clock.textContent = text;
      };
      const prev = this._prevHours ?? hoursRemaining;
      this._prevHours = hoursRemaining;

      if (prev === hoursRemaining) {
        // No change — just set it
        const days = Math.floor(hoursRemaining / 24);
        const hours = hoursRemaining % 24;
        setClockText(`${days}d ${hours}h`);
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
          setClockText(`${d}d ${h}h`);
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
      dismissEvidence();
    },

    addClue(clue, informant, onVisualSolved) {
      // Dismiss any open evidence panel first
      dismissEvidence();

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
      typewriter(textEl, `"${clue.text}"`, 20).then(() => {
        // Visual clue: show "Examine Evidence" button after text completes
        const speechBody = els.reveal.querySelector('.carmen-speech-body');
        if (!speechBody || !clue.data?.visualType) return;

        const isScramble = clue.data.visualType === 'scramble';
        const isOutline = clue.data.visualType === 'outline' && worldDataRef;
        const isFlag = clue.data.visualType === 'flag';
        if (!isScramble && !isOutline && !isFlag) return;

        const btn = document.createElement('button');
        btn.className = 'carmen-evidence-btn';
        btn.innerHTML = '🔍 Examine Evidence';
        btn.addEventListener('click', () => {
          // Hide the clue stage, show evidence panel as sibling
          const stage = els.rvClues.querySelector('.carmen-investigate-stage');
          if (stage) stage.style.display = 'none';

          const evidenceWrap = document.createElement('div');
          evidenceWrap.className = 'carmen-evidence-panel';
          els.rvClues.appendChild(evidenceWrap);

          if (isScramble) {
            renderScramble(evidenceWrap, clue.data, (monologue) => {
              showNarratorCaption(monologue);
              if (onVisualSolved) onVisualSolved(clue.data.answer);
            });
          } else if (isFlag) {
            renderFlag(evidenceWrap, clue.data.targetCountry, flagCodes);
          } else {
            renderOutline(evidenceWrap, clue.data.targetCountry, worldDataRef);
          }

          // Place back button inside the evidence panel (top-right corner, above card)
          const backBtn = document.createElement('button');
          backBtn.className = 'carmen-evidence-back-btn';
          backBtn.textContent = '✕';
          backBtn.addEventListener('click', () => dismissEvidence());
          evidenceWrap.appendChild(backBtn);
        });
        speechBody.appendChild(btn);
      });
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
    showSuspectLineup(lineup, options = null) {
      return new Promise(resolve => {
        lineupState.options = options || null;
        enterLineupPhase(lineup, resolve);
      });
    },

    showCaseSolved(suspectName, hoursLeft, score, options = null) {
      els.musicToggle.style.display = 'none';
      return new Promise(resolve => {
        const continueLabel = options?.continueLabel || 'Next case →';
        const timeBonus = options?.timeBonus || 0;
        const timeDetail = timeBonus > 0
          ? `Case completed with ${hoursLeft}h remaining · +${timeBonus} speed bonus`
          : `Case completed with ${hoursLeft}h remaining`;
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
            <div class="carmen-closing-detail">${esc(timeDetail)}</div>
            <div class="carmen-closing-buttons" style="display:none">
              <button class="carmen-closing-btn carmen-btn-continue">${esc(continueLabel)}</button>
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
          typewriter(textEl, options?.solvedText || 'has been arrested!', 30).then(() => {
            buttons.style.display = '';
          });
        }, 800);

        overlay.querySelector('.carmen-btn-continue').addEventListener('click', () => { overlay.remove(); resolve('continue'); });
        overlay.querySelector('.carmen-btn-quit').addEventListener('click', () => { overlay.remove(); resolve('quit'); });
      });
    },

    showCaseFailed(suspectName, score, options = null) {
      els.musicToggle.style.display = 'none';
      return new Promise(resolve => {
        const continueLabel = options?.continueLabel || 'Next case →';
        const failedDetail = options?.failedDetail || 'The real thief vanished into the shadows...';
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
            <div class="carmen-closing-detail">${esc(failedDetail)}</div>
            <div class="carmen-closing-buttons" style="display:none">
              <button class="carmen-closing-btn carmen-btn-continue">${esc(continueLabel)}</button>
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
            <div class="carmen-closing-detail">Ten cases. Ten artifacts. One detective. ACME still has thieves to catch.</div>
            <div class="carmen-closing-buttons">
              <button class="carmen-closing-btn carmen-btn-continue">Open Cases →</button>
              <button class="carmen-closing-btn carmen-btn-quit">Quit</button>
            </div>
          </div>
        `;
        document.body.appendChild(overlay);
        const stamp = overlay.querySelector('.carmen-closing-stamp');
        setTimeout(() => { stamp.classList.add('animate'); playStamp(); }, 300);
        overlay.querySelector('.carmen-btn-continue').addEventListener('click', () => { overlay.remove(); resolve('open_cases'); });
        overlay.querySelector('.carmen-btn-quit').addEventListener('click', () => { overlay.remove(); resolve('quit'); });
      });
    },

    showDeadEnd(country, repeatedDeadEnd = false, options = null, onContinue) {
      if (typeof repeatedDeadEnd === 'function') {
        onContinue = repeatedDeadEnd;
        repeatedDeadEnd = false;
      }
      if (typeof options === 'function') {
        onContinue = options;
        options = null;
      }
      const copy = getRouteCopy(options?.mode || caseCardState.mode);
      hideNarratorCaption(true);
      dismissEvidence();
      // Force map visible
      for (const rv of allRightViews) rv.style.display = 'none';
      els.rvMap.style.display = '';

      const narratorHint = repeatedDeadEnd ? `<div class="carmen-dead-end-narrator">${copy.deadEndNarrator}</div>` : '';
      const overlay = document.createElement('div');
      overlay.className = 'carmen-map-overlay carmen-dead-end';
      overlay.innerHTML = `
        <div class="carmen-transition">
          <div class="carmen-dead-end-icon">❌</div>
          <div class="score-lost">-25 points</div>
          <div>${esc(copy.deadEndLead)} in <strong>${esc(country)}</strong>!</div>
          <div class="carmen-dead-end-hint">This lead went cold. You've lost precious time.</div>
          <button class="carmen-continue-btn carmen-dead-end-btn">Return to the trail →</button>
          ${narratorHint}
        </div>
      `;
      els.mapWrap.appendChild(overlay);

      overlay.querySelector('.carmen-continue-btn').addEventListener('click', () => {
        overlay.remove();
        onContinue();
      });
    },

    showTransition(stopScore, country, taunt, thiefName, narratorLine, onContinue, options = null) {
      if (typeof narratorLine === 'function') {
        onContinue = narratorLine;
        narratorLine = '';
      }
      if (typeof onContinue !== 'function' && typeof options === 'function') {
        onContinue = options;
        options = null;
      }
      const copy = getRouteCopy(options?.mode || caseCardState.mode);
      hideNarratorCaption(true);
      dismissEvidence();
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
      overlay.className = `carmen-map-overlay ${Math.random() < 0.5 ? 'carmen-country-arrival' : 'carmen-country-arrival-alt'}`;
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
          <div>${esc(copy.confirmedLead)} in <strong>${esc(country)}</strong>!</div>
          ${tauntHtml}
          <button class="carmen-continue-btn">Continue the trail →</button>
        </div>
      `;
      els.mapWrap.appendChild(overlay);

      if (narratorLine) {
        const captionDuration = narratorLine.length > 150 ? Infinity : null;
        setTimeout(() => showNarratorCaption(narratorLine, captionDuration), 180);
      }

      overlay.querySelector('.carmen-continue-btn').addEventListener('click', () => {
        hideNarratorCaption(true);
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
  const lead = sentences[0] || 'Reference note unavailable.';
  const extra = '';

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
