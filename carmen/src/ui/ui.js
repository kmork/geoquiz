/**
 * Carmen UI — DOM rendering for "Where in the World?" game.
 */

import { playStamp, startClockTicking, stopClockTicking, toggleMusicMute, isMusicMuted } from '../audio/audio-engine.js';
import { IMG } from '../assets.js';
import { getInterpolBackgroundStory } from '../content/interpol-backgrounds.js';
import { getPortraitStyleVars } from '../content/portrait-specs.js';
import { typewriter } from './typewriter.js';
import { renderScramble, renderSealCipher, renderOutline, renderFlag, renderCargoLabel } from './visual-clues.js';
import { createCityInvestigationMap } from './city-investigation-map.js';

function renderPortraitImg(suspect, extraClass = '') {
  const src = suspect.img || IMG.suspect(suspect.name);
  const className = extraClass ? `carmen-portrait-img ${extraClass}` : 'carmen-portrait-img';
  return `<img src="${esc(src)}" alt="${esc(suspect.name)}" class="${className}" style="${getPortraitStyleVars(suspect.name)}" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'🕵️'}))">`;
}

function normalizeForUi(value) {
  return String(value || '').trim().toLowerCase();
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
                <div class="carmen-dossier-selectors" id="carmen-dossier-selectors"></div>
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
              <div class="carmen-city-map-stage" id="carmen-city-map-stage"></div>
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
          <div class="carmen-inner-monologue" id="carmen-inner-monologue" aria-live="polite"></div>
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
    dossierSelectors: container.querySelector('#carmen-dossier-selectors'),
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
    innerMonologue: container.querySelector('#carmen-inner-monologue'),
    cityMapStage: container.querySelector('#carmen-city-map-stage'),
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
  let innerMonologueTimer = null;
  let innerMonologueCleanupTimer = null;

  container.addEventListener('click', () => {
    if (els.innerMonologue?.classList.contains('is-visible')) {
      hideInnerMonologue(true);
    }
  }, true);
  const caseCardState = {
    siteName: 'a priceless artifact',
    startCountry: '',
    thiefName: 'Unknown',
    mode: 'campaign',
    artifact: null,
  };
  const inspectState = {
    pinnedPhoto: null,
    overlayOpen: false,
  };
  const witnessReports = [];
  let worldCaseBoardState = null;
  let cityInvestigationMap = null;
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

  function clearCityInvestigationMap() {
    cityInvestigationMap?.destroy?.();
    cityInvestigationMap = null;
    els.rvClues.classList.remove('has-city-map');
    if (els.cityMapStage) {
      els.cityMapStage.innerHTML = '';
      els.cityMapStage.style.display = 'none';
    }
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
  let dossierSubview = 'case';

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
    const previousTab = activeTab;
    if (activeTab === 'interpol' && tab !== 'interpol') {
      resetInterpolPhotoInspect();
    }
    if (tab === 'dossier' && previousTab !== 'dossier') {
      dossierSubview = 'case';
      if (!worldCaseBoardState) renderDossier();
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

  els.dossierSelectors.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-dossier-view]');
    if (!btn) return;
    const view = btn.dataset.dossierView;
    if (view !== 'case' && view !== 'manifest') return;
    if (view === 'manifest' && !manifestState.enabled) return;
    dossierSubview = view;
    renderDossier();
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

  els.artifactDisplay.addEventListener('click', (event) => {
    if (event.target.closest('.carmen-artifact-evidence-btn')) return;
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
          const redacted = segment.redacted && !segment.recoveredAfterFinale;
          const chips = redacted ? [] : [
            segment.gatewayBand ? `Airport traffic: ${segment.gatewayBand}` : '',
            segment.distanceBand ? `Route length: ${segment.distanceBand}` : '',
            segment.clockLabel ? `Time difference: ${segment.clockLabel}` : '',
          ].filter(Boolean);
          const fromLabel = [segment.fromCapital, segment.fromCountry].filter(Boolean).join(', ');
          const toLabel = [segment.toCapital, segment.toCountry].filter(Boolean).join(', ');
          const fragmentLabel = redacted ? 'Gate Zero redaction' : 'Recovered fragment';
          const fragmentText = redacted
            ? (segment.redactionText || 'CHECKSUM ROW ERASED')
            : (segment.fragmentText || 'MANIFEST ENTRY RECOVERED');
          return `
            <div class="carmen-manifest-segment${redacted ? ' carmen-manifest-segment-redacted' : ''}">
              <div class="carmen-manifest-segment-top">
                <span class="carmen-manifest-step">SEGMENT ${index + 1}</span>
                <span class="carmen-manifest-route">${esc(fromLabel || segment.fromCountry || 'Unknown')} -> ${esc(toLabel || segment.toCountry || 'Unknown')}</span>
              </div>
              ${redacted
                ? `<div class="carmen-manifest-redaction-note">${esc(segment.checksumToken || 'Gate Zero checksum unavailable')}</div>`
                : `<div class="carmen-manifest-chips">
                    ${chips.map(chip => `<span class="carmen-manifest-chip">${esc(chip)}</span>`).join('')}
                  </div>`}
              <div class="carmen-manifest-fragment">
                <span class="carmen-manifest-fragment-label">${esc(fragmentLabel)}</span>
                <span class="carmen-manifest-fragment-text">${esc(fragmentText)}</span>
              </div>
            </div>
          `;
        }).join('')
      : '<div class="carmen-manifest-empty">No confirmed flight routes yet.</div>';
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

  function renderDossierSelectors() {
    const activeView = manifestState.enabled ? dossierSubview : 'case';
    const recovered = manifestState.segments.length;
    const manifestStatus = recovered === 1 ? '1 recovered' : `${recovered} recovered`;
    els.dossierSelectors.innerHTML = `
      <button type="button" class="carmen-panel-card carmen-dossier-selector${activeView === 'case' ? ' active' : ''}" data-dossier-view="case">
        <div class="carmen-panel-badge">📋 DOSSIER</div>
        <div class="carmen-panel-title">Case Dossier</div>
        <div class="carmen-panel-desc">Gathered evidence, witness statements, detours, and visual clues are compiled on the right.</div>
      </button>
      ${manifestState.enabled ? `
        <button type="button" class="carmen-panel-card carmen-dossier-selector carmen-dossier-selector-manifest${activeView === 'manifest' ? ' active' : ''}" data-dossier-view="manifest">
          <div class="carmen-panel-badge">ACME MANIFEST</div>
          <div class="carmen-panel-title">Manifest Board</div>
          <div class="carmen-panel-desc">Recovered flight routes, route length, airport traffic, time differences, and Dispatcher Signature.</div>
          <div class="carmen-panel-cost"><strong>${esc(manifestStatus)}</strong></div>
        </button>
      ` : ''}
    `;
  }

  function hydrateDossierVisualEvidence() {
    els.dossierBody.querySelectorAll('[data-dossier-visual-id]').forEach((slot) => {
      const id = slot.dataset.dossierVisualId;
      const entry = dossierEntries.find(item => item.visualEvidence?.id === id);
      if (!entry) return;
      slot.innerHTML = '';
      if (entry.visualEvidence.type === 'flag') {
        renderFlag(slot, entry.visualEvidence.targetCountry, flagCodes);
      } else if (entry.visualEvidence.type === 'outline' && worldDataRef) {
        renderOutline(slot, entry.visualEvidence.targetCountry, worldDataRef);
      }
    });
  }

  function renderDossier() {
    if (!manifestState.enabled && dossierSubview === 'manifest') {
      dossierSubview = 'case';
    }
    renderDossierSelectors();

    if (manifestState.enabled && dossierSubview === 'manifest') {
      els.dossierBody.innerHTML = `<div class="carmen-dossier-page">${renderManifestBoard()}</div>`;
      els.dossierBody.scrollTop = 0;
      return;
    }

    if (dossierEntries.length === 0) {
      els.dossierBody.innerHTML = '<div class="carmen-dossier-empty">No clues gathered yet. Investigate locations to find leads.</div>';
      return;
    }
    // Render entries in order, grouping consecutive entries with the same stopKey
    let html = '<div class="carmen-dossier-page">';
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
        const label = e.type === 'detour'
          ? 'Dead end'
          : (e.stopLabel || (Number.isFinite(Number(e.stop)) ? `Stop ${Number(e.stop) + 1}` : 'Case file'));
        html += `<div class="carmen-dossier-section${detourClass}"><div class="carmen-dossier-stop${detourClass}">${label}${location}</div>`;
        sectionOpen = true;
      }
      const icon = e.emoji || '';
      const entryClass = e.type === 'detour' ? ' carmen-dossier-detour' : '';
      const scopeTag = e.scope ? `<span class="carmen-dossier-scope">${e.scope === 'capital' ? 'CAPITAL' : 'COUNTRY'}</span> ` : '';
      html += `<div class="carmen-dossier-entry${entryClass}">
        ${icon ? `<span class="carmen-dossier-emoji">${icon}</span>` : ''}
        <span class="carmen-dossier-prefix">${esc(e.informantPrefix || 'Clue')}:</span>
        ${scopeTag}<span class="carmen-dossier-text">${esc(e.clueText)}</span>
      </div>`;
      if (e.visualEvidence) {
        html += `<div class="carmen-dossier-visual" data-dossier-visual-id="${esc(e.visualEvidence.id)}"></div>`;
      }
    }
    if (sectionOpen) html += '</div>';
    html += '</div>';
    els.dossierBody.innerHTML = html;
    hydrateDossierVisualEvidence();
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

  function dismissImageViewer() {
    document.querySelector('.carmen-image-viewer-overlay')?.remove();
    document.querySelector('.carmen-image-viewer-docked')?.remove();
  }

  let dockedImageViewerState = null;

  function showImageViewerModal(item, options = null) {
    if (!item?.imagePath) return;
    document.querySelector('.carmen-image-viewer-overlay')?.remove();
    const hasHotspots = Array.isArray(item.hotspots) && item.hotspots.length > 0;
    const hasPuzzle = !!item.puzzle && item.puzzle.type;
    const observation = options?.observation || { hotspotsHit: new Set(), puzzleSolved: false };
    const onHotspotClick = options?.onHotspotClick || null;
    const onPuzzleSolved = options?.onPuzzleSolved || null;

    const overlay = document.createElement('div');
    overlay.className = 'carmen-image-viewer-overlay';
    const frameClass = hasHotspots ? 'carmen-image-viewer-frame carmen-image-viewer-hotspot-stage' : 'carmen-image-viewer-frame';
    overlay.innerHTML = `
      <div class="carmen-image-viewer-card carmen-image-viewer-toggle-card">
        <button class="carmen-image-viewer-close" type="button" aria-label="Close evidence viewer">✕</button>
        <div class="carmen-image-viewer-kicker">${esc(item.imagePurpose || item.kind || 'evidence image')}</div>
        <div class="carmen-image-viewer-title">${esc(item.title || item.label || 'Evidence image')}</div>
        ${item.subtitle ? `<div class="carmen-image-viewer-subtitle">${esc(item.subtitle)}</div>` : ''}
        <div class="${frameClass}">
          <img class="carmen-image-viewer-toggle-img" src="${esc(item.imagePath)}" alt="${esc(item.title || item.label || 'Evidence image')}">
          <div class="carmen-image-viewer-caption" aria-live="polite"></div>
        </div>
      </div>
    `;
    if (hasHotspots) {
      const frame = overlay.querySelector('.carmen-image-viewer-frame');
      for (const hotspot of item.hotspots) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'carmen-image-hotspot';
        btn.dataset.hotspotId = hotspot.id;
        btn.style.left = `${hotspot.x}%`;
        btn.style.top = `${hotspot.y}%`;
        btn.style.width = `${hotspot.w}%`;
        btn.style.height = `${hotspot.h}%`;
        btn.setAttribute('aria-label', hotspot.label || `Inspect region ${hotspot.id}`);
        const alreadyHit = hotspot.correct && observation.hotspotsHit?.has(hotspot.id);
        if (alreadyHit) {
          btn.classList.add('is-correct');
          btn.disabled = true;
          const pip = document.createElement('span');
          pip.className = 'carmen-image-hotspot-pip';
          pip.textContent = '✓';
          btn.appendChild(pip);
        }
        btn.addEventListener('click', (event) => {
          event.stopPropagation();
          if (btn.disabled) return;
          if (onHotspotClick) {
            const outcome = onHotspotClick(item, hotspot);
            if (outcome === 'correct') {
              btn.classList.add('is-correct');
              btn.disabled = true;
              const pip = document.createElement('span');
              pip.className = 'carmen-image-hotspot-pip';
              pip.textContent = '✓';
              btn.appendChild(pip);
            } else if (outcome === 'wrong') {
              btn.classList.add('is-wrong');
              setTimeout(() => btn.classList.remove('is-wrong'), 700);
            }
          }
        });
        frame.appendChild(btn);
      }
    }
    if (hasPuzzle && item.puzzle.type === 'scramble') {
      const card = overlay.querySelector('.carmen-image-viewer-card');
      const mount = document.createElement('div');
      mount.className = 'carmen-image-puzzle-mount';
      const prompt = document.createElement('div');
      prompt.className = 'carmen-image-puzzle-prompt';
      prompt.textContent = item.puzzle.prompt || 'Re-order the cipher tiles to read a single word.';
      mount.appendChild(prompt);
      const stage = document.createElement('div');
      mount.appendChild(stage);
      const status = document.createElement('div');
      status.className = 'carmen-image-puzzle-status';
      status.textContent = observation.puzzleSolved ? 'Cipher solved.' : '';
      if (observation.puzzleSolved) status.classList.add('is-solved');
      mount.appendChild(status);
      card.appendChild(mount);
      const answer = String(item.puzzle.solution || '').toUpperCase();
      const initialLetters = (item.puzzle.scrambled || answer.split('').slice().reverse().join('')).toUpperCase().split('');
      const fixed = (item.puzzle.fixed || initialLetters.map(() => false));
      if (observation.puzzleSolved) {
        renderScramble(stage, { letters: answer.split(''), fixed: answer.split('').map(() => true), answer }, () => {});
      } else {
        renderScramble(stage, { letters: initialLetters, fixed, answer }, (monologue) => {
          status.textContent = 'Cipher solved.';
          status.classList.add('is-solved');
          if (onPuzzleSolved) onPuzzleSolved(item, answer, monologue);
        });
      }
    }
    if (hasPuzzle && item.puzzle.type === 'seal-cipher') {
      const card = overlay.querySelector('.carmen-image-viewer-card');
      const mount = document.createElement('div');
      mount.className = 'carmen-image-puzzle-mount carmen-image-puzzle-mount-seal';
      const prompt = document.createElement('div');
      prompt.className = 'carmen-image-puzzle-prompt';
      prompt.textContent = item.puzzle.prompt || 'Match the legible seal to its rail corridor.';
      mount.appendChild(prompt);
      const stage = document.createElement('div');
      mount.appendChild(stage);
      card.appendChild(mount);
      const placedSealIds = observation.sealsPlaced ? Array.from(observation.sealsPlaced) : [];
      renderSealCipher(stage, {
        seals: item.puzzle.seals || [],
        destinations: item.puzzle.destinations || [],
        placedSealIds,
        solved: !!observation.puzzleSolved,
      }, (attempt) => {
        if (!onPuzzleSolved) return null;
        const outcome = onPuzzleSolved(item, attempt);
        return outcome && typeof outcome === 'object' ? outcome.result : outcome;
      });
    }
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) document.querySelector('.carmen-image-viewer-overlay')?.remove();
    });
    overlay.querySelector('.carmen-image-viewer-close')?.addEventListener('click', () => {
      document.querySelector('.carmen-image-viewer-overlay')?.remove();
    });
    overlay.querySelector('.carmen-image-viewer-toggle-card')?.addEventListener('click', (event) => {
      if (event.target.closest('.carmen-image-viewer-close')) return;
      if (event.target.closest('.carmen-image-hotspot')) return;
      if (event.target.closest('.carmen-image-puzzle-mount')) return;
      if (hasHotspots || hasPuzzle) return;
      document.querySelector('.carmen-image-viewer-overlay')?.remove();
      if (dockedImageViewerState?.item?.imagePath) {
        showDockedImageViewer(dockedImageViewerState.item, dockedImageViewerState.targetEl);
      }
    });
    document.body.appendChild(overlay);
  }

  function showDockedImageViewer(item, targetEl = null) {
    if (!item?.imagePath) return;
    const dockTarget = targetEl || els.cityMapStage?.querySelector('.carmen-city-map-wrap');
    if (!dockTarget) {
      showImageViewerModal(item);
      return;
    }
    dockedImageViewerState = { item, targetEl: dockTarget };
    dockTarget.querySelector('.carmen-image-viewer-docked')?.remove();
    const docked = document.createElement('div');
    docked.className = 'carmen-image-viewer-docked';
    docked.innerHTML = `
      <div class="carmen-image-viewer-docked-card carmen-image-viewer-toggle-card">
        <div class="carmen-image-viewer-docked-head">
          <div>
            <div class="carmen-image-viewer-kicker">${esc(item.imagePurpose || item.kind || 'evidence')}</div>
            <div class="carmen-image-viewer-docked-title">${esc(item.title || item.label || 'Evidence image')}</div>
          </div>
          <div class="carmen-image-viewer-docked-actions">
            <button class="carmen-image-viewer-docked-btn" type="button" data-close aria-label="Close evidence viewer">✕</button>
          </div>
        </div>
        <div class="carmen-image-viewer-docked-frame">
          <img class="carmen-image-viewer-toggle-img" src="${esc(item.imagePath)}" alt="${esc(item.title || item.label || 'Evidence image')}">
        </div>
      </div>
    `;
    docked.querySelector('[data-close]')?.addEventListener('click', () => {
      docked.remove();
      dockedImageViewerState = null;
    });
    docked.querySelector('.carmen-image-viewer-toggle-card')?.addEventListener('click', (event) => {
      if (event.target.closest('[data-close]')) return;
      showImageViewerModal(item);
    });
    dockTarget.appendChild(docked);
  }

  function showImageViewer(item, options = null) {
    if (options?.dockToMap) {
      showDockedImageViewer(item, options?.targetEl || null);
      return;
    }
    showImageViewerModal(item, options);
  }

  function bindWorldCaseArtifactEvidence(panel = null) {
    if (!els.artifactSummary) return;
    els.artifactSummary.querySelectorAll('[data-evidence-image-path]').forEach(btn => {
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        showImageViewer({
          imagePath: btn.dataset.evidenceImagePath || '',
          imagePurpose: btn.dataset.evidenceImagePurpose || '',
          title: btn.dataset.evidenceImageTitle || 'Evidence image',
          subtitle: btn.dataset.evidenceImageSubtitle || '',
          imageNotes: btn.dataset.evidenceImageNotes || '',
        });
      });
    });
    if (els.artifactImg) {
      els.artifactImg.classList.remove('is-clickable');
      els.artifactImg.title = '';
      els.artifactImg.onclick = null;
    }
  }

  function showNarratorCaption(text, duration = null) {
    if (!text) return;

    const resolvedDuration = duration == null
      ? Math.min(10500, Math.max(5600, 3800 + (text.length * 24)))
      : duration;

    const overlayCaption = document.querySelector('.carmen-image-viewer-overlay .carmen-image-viewer-caption');
    if (overlayCaption) {
      showImageViewerCaption(overlayCaption, text, resolvedDuration);
      return;
    }

    if (!els.narratorCaption) return;
    clearNarratorCaptionTimers();
    els.narratorCaption.textContent = text;
    els.narratorCaption.classList.remove('is-fading');
    // Restart animation when a new caption arrives quickly after the last one.
    void els.narratorCaption.offsetWidth;
    els.narratorCaption.classList.add('is-visible');

    if (resolvedDuration !== Infinity) {
      narratorCaptionTimer = setTimeout(() => {
        hideNarratorCaption();
      }, resolvedDuration);
    }
  }

  let imageViewerCaptionTimer = null;
  function showImageViewerCaption(captionEl, text, duration) {
    if (imageViewerCaptionTimer) {
      clearTimeout(imageViewerCaptionTimer);
      imageViewerCaptionTimer = null;
    }
    captionEl.textContent = text;
    captionEl.classList.remove('is-fading');
    void captionEl.offsetWidth;
    captionEl.classList.add('is-visible');
    if (duration !== Infinity) {
      imageViewerCaptionTimer = setTimeout(() => {
        captionEl.classList.add('is-fading');
        captionEl.classList.remove('is-visible');
        setTimeout(() => {
          captionEl.classList.remove('is-fading');
          captionEl.textContent = '';
        }, 350);
      }, duration);
    }
  }

  function clearInnerMonologueTimers() {
    if (innerMonologueTimer) {
      clearTimeout(innerMonologueTimer);
      innerMonologueTimer = null;
    }
    if (innerMonologueCleanupTimer) {
      clearTimeout(innerMonologueCleanupTimer);
      innerMonologueCleanupTimer = null;
    }
  }

  function hideInnerMonologue(immediate = false) {
    if (!els.innerMonologue) return;
    if (immediate || !els.innerMonologue.classList.contains('is-visible')) {
      els.innerMonologue.classList.remove('is-visible', 'is-fading');
      els.innerMonologue.textContent = '';
      return;
    }
    els.innerMonologue.classList.add('is-fading');
    els.innerMonologue.classList.remove('is-visible');
    innerMonologueCleanupTimer = setTimeout(() => {
      els.innerMonologue.classList.remove('is-fading');
      els.innerMonologue.textContent = '';
      innerMonologueCleanupTimer = null;
    }, 420);
  }

  function showInnerMonologue(text, duration = null) {
    if (!text || !els.innerMonologue) return;
    clearInnerMonologueTimers();
    els.innerMonologue.textContent = text;
    els.innerMonologue.classList.remove('is-fading');
    void els.innerMonologue.offsetWidth;
    els.innerMonologue.classList.add('is-visible');
    const resolvedDuration = duration == null
      ? Math.min(13000, Math.max(7200, 4800 + (text.length * 28)))
      : duration;
    if (resolvedDuration !== Infinity) {
      innerMonologueTimer = setTimeout(() => {
        hideInnerMonologue();
      }, resolvedDuration);
    }
  }

  let detourCounter = 0;

  function isSkylineMode(mode) {
    return mode === 'skyline_syndicate';
  }

  function isCapitalFlightMode(mode) {
    return mode === 'skyline_syndicate' || mode === 'city_open_case';
  }

  function getRouteCopy(mode = caseCardState.mode) {
    if (mode === 'world_case_files') {
      return {
        travelTitle: 'Where does the world case lead?',
        travelDesc: 'Search the whole atlas, compare evidence, and travel when the lead is strong enough.',
        introMission: 'Investigate scenes, gather cultural evidence, narrow the world map, and prove each destination.',
        confirmedLead: 'World lead confirmed',
        deadEndLead: 'Evidence contradiction',
        deadEndNarrator: 'Wrong lead. The map can take me anywhere, but the evidence still has to carry the case.',
      };
    }
    if (isCapitalFlightMode(mode)) {
      return {
        travelTitle: 'Where does the air trail lead?',
        travelDesc: 'Select a capital flight lead on the map to confirm the next flight route.',
        introMission: 'Investigate locations, gather clues, and confirm the air trail.',
        confirmedLead: 'Flight route confirmed',
        deadEndLead: 'No confirmed flight lead',
        deadEndNarrator: 'Another dead end. Took the wrong flight route. Maybe I ought to study the map at <a href="https://geoquiz.info/study.html" target="_blank" rel="noopener noreferrer">geoquiz.info/study.html</a> before this case eats me alive.',
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

  function renderProofFactList(facts) {
    return `
      <div class="carmen-final-proof-facts">
        <span>Route length: ${esc(facts.distanceBand || 'unknown route length')}</span>
        <span>Airport traffic: ${esc(facts.gatewayBand || 'unknown airport traffic')}</span>
        <span>Time difference: ${esc(facts.clockLabel || 'time difference unavailable')}</span>
        <span>${esc(facts.hemisphere || 'unknown hemisphere')}</span>
      </div>
    `;
  }

  function showSkylineFinalManifestProof(proof, options = null) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'carmen-closing-overlay carmen-final-proof-overlay';
      let selectedId = '';
      let busy = false;
      let attempts = 0;

      const render = (message = '') => {
        const selected = proof.candidates.find(candidate => candidate.id === selectedId);
        overlay.innerHTML = `
          <div class="carmen-final-proof-content">
            <div class="carmen-briefing-label">FINAL MANIFEST PROOF</div>
            <div class="carmen-final-proof-title">${esc(proof.title || 'Gate Zero Redaction')}</div>
            <div class="carmen-final-proof-subtitle">${esc(proof.subtitle || '')}</div>
            <div class="carmen-final-proof-route">
              <span>Redacted segment ${esc(String(proof.redactedSegmentIndex))}</span>
              <strong>${esc([proof.fromCapital, proof.fromCountry].filter(Boolean).join(', ') || proof.fromCountry || 'Unknown')}</strong>
              <span>to</span>
              <strong>${esc([proof.toCapital, proof.toCountry].filter(Boolean).join(', ') || proof.toCountry || 'Unknown')}</strong>
            </div>
            <div class="carmen-final-proof-strip">
              ${proof.segments.map(segment => `
                <div class="carmen-final-proof-strip-row${segment.redacted ? ' is-redacted' : ''}">
                  <span>SEG ${segment.index}</span>
                  <b>${esc(segment.redacted ? 'GATE ZERO' : segment.checksumToken)}</b>
                </div>
              `).join('')}
            </div>
            <div class="carmen-final-proof-grid-label">Choose the checksum row The Dispatcher erased</div>
            <div class="carmen-final-proof-grid">
              ${proof.candidates.map(candidate => `
                <button class="carmen-final-proof-card${candidate.id === selectedId ? ' selected' : ''}" data-id="${esc(candidate.id)}">
                  <span>${esc(candidate.label)}</span>
                  <b>${esc(candidate.checksumToken)}</b>
                  ${renderProofFactList(candidate.facts)}
                </button>
              `).join('')}
            </div>
            <div class="carmen-final-proof-feedback${message ? ' is-visible' : ''}">
              ${esc(message)}
            </div>
            <div class="carmen-final-proof-actions">
              <button class="carmen-final-proof-confirm" ${selected ? '' : 'disabled'}>Lock manifest row</button>
            </div>
          </div>
        `;

        overlay.querySelectorAll('.carmen-final-proof-card').forEach(card => {
          card.addEventListener('click', () => {
            if (busy) return;
            selectedId = card.dataset.id;
            render(message);
          });
        });

        const confirm = overlay.querySelector('.carmen-final-proof-confirm');
        if (confirm) {
          confirm.addEventListener('click', async () => {
            if (busy || !selectedId) return;
            const candidate = proof.candidates.find(item => item.id === selectedId);
            if (!candidate) return;
            if (candidate.correct) {
              overlay.remove();
              resolve({ correct: true, candidateId: candidate.id, attempts });
              return;
            }
            attempts++;
            busy = true;
            const penalty = options?.wrongPenaltyHours || proof.wrongPenaltyHours || 4;
            const canRetry = await options?.onWrongSelection?.(candidate, attempts);
            busy = false;
            if (canRetry === false) {
              overlay.remove();
              resolve({ correct: false, candidateId: candidate.id, attempts, aborted: true });
              return;
            }
            selectedId = '';
            render(`Manifest mismatch. ACME loses ${penalty}h rebuilding the checksum; choose again.`);
          });
        }
      };

      render();
      document.body.appendChild(overlay);
    });
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

    showInnerMonologue(text, duration) {
      showInnerMonologue(text, duration);
    },

    hideInnerMonologue(immediate = false) {
      hideInnerMonologue(immediate);
    },

    setManifestMode(enabled, options = null) {
      manifestState.enabled = !!enabled;
      manifestState.caseNumber = options?.caseNumber || null;
      manifestState.totalCases = options?.totalCases || null;
      if (!manifestState.enabled) dossierSubview = 'case';
      renderDossier();
    },

    resetManifestBoard() {
      manifestState.segments.length = 0;
      manifestState.routePatterns = [];
      renderDossier();
    },

    setManifestPatterns(patterns) {
      manifestState.routePatterns = patterns || [];
      renderDossier();
    },

    setFreeInvestigationClock(label = 'No case clock') {
      const clockText = els.clock.querySelector('.carmen-clock-text');
      const clockIcon = els.clock.querySelector('.carmen-clock-icon');
      els.clock.classList.remove('world-case-status', 'world-case-ready');
      if (clockIcon) clockIcon.style.display = '';
      if (clockText) clockText.textContent = label;
      else els.clock.textContent = label;
      els.clock.classList.remove('low', 'critical');
    },

    setWorldCaseStatus(status = null) {
      const locationLabel = status?.locationLabel || 'Current scene';
      const gauge = Array.isArray(status?.evidenceGauge) ? status.evidenceGauge : [];
      const clockText = els.clock.querySelector('.carmen-clock-text');
      const clockIcon = els.clock.querySelector('.carmen-clock-icon');

      els.progress.classList.add('world-case-status');
      els.progress.innerHTML = `
        <span class="carmen-progress-kicker">Location</span>
        <span class="carmen-progress-location">${esc(locationLabel)}</span>
      `;

      els.clock.classList.remove('low', 'critical');
      els.clock.classList.add('world-case-status');
      els.clock.classList.toggle('world-case-ready', !!status?.ready);
      if (clockIcon) clockIcon.style.display = 'none';
      if (clockText) {
        clockText.innerHTML = `
          <span class="carmen-world-gauge-label">Evidence</span>
          <span class="carmen-world-gauge" aria-label="Evidence status">
            ${gauge.map(item => `
              <span class="carmen-world-gauge-segment ${esc(item.state || 'incomplete')}" title="${esc(item.label || 'Evidence')}">
                ${esc(item.label || 'Evidence')}
              </span>
            `).join('')}
          </span>
        `;
      } else {
        els.clock.textContent = '';
      }
    },

    showWorldCaseIntro(state) {
      applyRouteCopy('world_case_files');
      const current = state?.current || {};
      this.updateWorldCaseArtifact(state);
      const place = [current.city, current.country].filter(Boolean).join(', ');
      const sceneLine = [current.sceneTitle, place].filter(Boolean).join(' — ');
      const briefing = current.chapterSummary || 'Gather evidence, narrow the world atlas, and travel when the case is strong enough.';
      els.narrative.innerHTML = `
        <div class="carmen-intro-card carmen-world-case-card">
          <div class="carmen-intro-badge">WORLD CASE FILES</div>
          <div class="carmen-intro-artifact">${esc(state?.caseTitle || 'Open cultural theft')}</div>
          ${sceneLine ? `<div class="carmen-intro-origin">${esc(sceneLine)}</div>` : ''}
          <div class="carmen-intro-mission">${esc(briefing)}</div>
        </div>
      `;
      els.notebookTabs.style.display = '';
      els.musicToggle.style.display = '';
      switchTab('case');
    },

    updateWorldCaseBoard(state) {
      worldCaseBoardState = state || null;
      const current = state?.current || {};
      const route = state?.route || [];
      const evidence = state?.evidence || [];
      const deadEnds = state?.deadEnds || [];

      const trailStops = route
        .map((stop, index) => ({ stop, index }))
        .slice(0, (current.stopIndex ?? 0) + 1)
        .reverse();

      const evidenceByStop = new Map();
      for (const e of evidence) {
        const key = e.stopId || e.sceneId;
        if (!key) continue;
        if (!evidenceByStop.has(key)) evidenceByStop.set(key, []);
        evidenceByStop.get(key).push(e);
      }
      for (const arr of evidenceByStop.values()) arr.reverse();

      const knownStopIds = new Set(route.map(s => s.id));
      const orphans = evidence
        .filter(e => !knownStopIds.has(e.stopId || e.sceneId))
        .slice()
        .reverse();

      const iconForCategory = (cat) =>
        cat === 'Cultural Evidence' ? '🎭'
        : cat === 'Confirmation' ? '✅'
        : cat === 'Puzzle Evidence' ? '🧩'
        : '🧭';

      const entryHtml = (e) => {
        const text = e.corroborated === false && e.vagueText ? e.vagueText : e.text || '';
        const prefix = e.title || e.category || 'Clue';
        return `
          <div class="carmen-dossier-entry">
            <span class="carmen-dossier-emoji">${iconForCategory(e.category)}</span>
            <span class="carmen-dossier-prefix">${esc(prefix)}:</span>
            <span class="carmen-dossier-text">${esc(text)}</span>
          </div>
        `;
      };

      const stopSectionHtml = ({ stop, index }) => {
        const active = index === current.stopIndex;
        const entries = evidenceByStop.get(stop.id) || [];
        const placeLabel = [stop.city, stop.country].filter(Boolean).join(', ') || stop.scene || `Stop ${index + 1}`;
        const body = entries.length
          ? entries.map(entryHtml).join('')
          : `<div class="carmen-dossier-empty-stop">${active ? `No clues from ${esc(stop.city || 'this stop')} yet — work the scene.` : 'No clues recorded here.'}</div>`;
        return `
          <div class="carmen-dossier-section${active ? ' active' : ' past'}">
            <div class="carmen-dossier-stop">${esc(placeLabel)}</div>
            ${body}
          </div>
        `;
      };

      const sectionsHtml = trailStops.map(stopSectionHtml).join('');
      const orphansHtml = orphans.length
        ? `
          <div class="carmen-dossier-section">
            <div class="carmen-dossier-stop">Unfiled</div>
            ${orphans.map(entryHtml).join('')}
          </div>
        `
        : '';

      const deadEndHtml = deadEnds.length
        ? deadEnds.slice().reverse().map(item => `
          <div class="carmen-world-dead-end">❌ ${esc(item.country)} — ${esc(item.explanation)}</div>
        `).join('')
        : '';

      els.dossierBody.innerHTML = `
        <div class="carmen-world-board">
          <div class="carmen-world-board-head">
            <div class="carmen-panel-badge">EVIDENCE BOARD</div>
            <div class="carmen-panel-title">${esc(state?.caseTitle || 'World Case Files')}</div>
          </div>
          <div class="carmen-dossier-page">
            ${sectionsHtml}
            ${orphansHtml}
          </div>
          ${deadEndHtml ? `<div class="carmen-world-board-section"><div class="carmen-world-section-title">Contradictions</div>${deadEndHtml}</div>` : ''}
        </div>
      `;
    },

    showWorldCaseLocations(sceneActions, onInvestigate, state, options = null) {
      // Capture the existing city map's pan/zoom so we can restore it after
      // the rebuild, but only if the underlying scene/location is unchanged.
      const prevContextKey = cityInvestigationMap?.getContextKey?.() || null;
      const prevViewport = cityInvestigationMap?.getViewport?.() || null;
      clearCityInvestigationMap();
      this._worldInvestigatedIds = new Set(options?.investigatedIds || []);
      const current = state?.current || {};
      const mapLocations = options?.mapLocations || [];
      const sceneEvidenceImages = state?.sceneEvidenceImages || [];
      const genericFieldStop = !!(state?.currentFieldLocation?.kind && state.currentFieldLocation.kind !== 'scene' && !state?.displayScene);
      const sceneTitle = state?.displayScene?.title || state?.displayScene?.scene || state?.current?.sceneTitle || state?.currentScene?.title || state?.currentScene?.scene || current.city || 'Current scene';
      const visibleSceneActions = sceneActions || [];
      const evidenceList = state?.evidence || [];
      const staleLocationIds = new Set(
        evidenceList.filter(e => e.staleAvailable).map(e => e.locationId).filter(Boolean)
      );
      const selectedContext = options?.selectedContext || { type: 'scene' };
      const selectedMapLocation = selectedContext?.type === 'location'
        ? mapLocations.find(loc => loc.id === selectedContext.id) || null
        : null;
      els.locationsLabel.style.display = '';
      els.locationsLabel.textContent = selectedContext?.type === 'scene'
        ? (genericFieldStop ? 'Field stop:' : `${sceneTitle}:`)
        : `${selectedMapLocation?.name || 'Location'}:`;
      els.locations.innerHTML = `
        <div class="carmen-location-list carmen-world-location-list">
          ${selectedContext?.type === 'scene' ? `
            <div class="carmen-world-scene-panel">
              <div class="carmen-world-scene-panel-head">
                <div class="carmen-world-scene-panel-kicker">${genericFieldStop ? 'FIELD STOP' : 'SCENE FILE'}</div>
                <div class="carmen-world-scene-panel-title">${esc(genericFieldStop ? (state?.currentFieldLocation?.city || state?.currentFieldLocation?.country || 'Field stop') : sceneTitle)}</div>
              </div>
              ${genericFieldStop ? `
                <div class="carmen-artifact-summary carmen-artifact-summary-secondary">
                  ${esc(state?.currentFieldLocation?.explanation || 'ACME logged this stop on the trail, but it does not open the next scene. Review the note on the map and choose the next lead when ready.')}
                </div>
              ` : ''}
              ${visibleSceneActions.length ? `
                <div class="carmen-world-scene-section">
                  <div class="carmen-world-scene-section-title">Scene Actions</div>
                  ${visibleSceneActions.map(loc => {
                    const isAnonymous = loc.discoveryState === 'anonymous';
                    const isStale = staleLocationIds.has(loc.id);
                    const cls = ['carmen-location-btn', 'carmen-world-scene-btn'];
                    if (loc.locked) cls.push('is-locked');
                    if (isAnonymous) cls.push('is-anonymous');
                    if (isStale) cls.push('is-stale');
                    const titleAttr = loc.locked && loc.requiredImageTitle
                      ? ` title="Locked. Examine ${esc(loc.requiredImageTitle)} to open this lead."`
                      : (isAnonymous ? ' title="An unidentified detail. Examine the breach photo for context."' : '');
                    const emojiGlyph = loc.locked ? '🔒' : loc.emoji;
                    return `
                      <button class="${cls.join(' ')}" data-location="${loc.id}"${loc.locked && loc.requiredImageId ? ` data-locked-by-image="${esc(loc.requiredImageId)}"` : ''}${titleAttr}>
                        <span class="carmen-location-emoji">${emojiGlyph}</span>
                        <span class="carmen-location-name">${esc(loc.name)}</span>
                        ${isStale ? '<span class="carmen-location-stale-badge">New info — re-question</span>' : ''}
                      </button>
                    `;
                  }).join('')}
                </div>
              ` : ''}
              ${sceneEvidenceImages.length ? `
                <div class="carmen-world-scene-section">
                  <div class="carmen-world-scene-section-title">Evidence</div>
                  ${sceneEvidenceImages.map(item => `
                    <button
                      class="carmen-location-btn carmen-world-scene-btn carmen-world-scene-evidence-btn"
                      type="button"
                      data-evidence-id="${esc(item.id || '')}"
                    >
                      <span class="carmen-location-emoji">🖼️</span>
                      <span class="carmen-location-name">${esc(item.title || 'Evidence image')}</span>
                    </button>
                  `).join('')}
                </div>
              ` : ''}
              ${!genericFieldStop && !visibleSceneActions.length && !sceneEvidenceImages.length ? `
                <div class="carmen-dossier-empty">No authored scene actions are available here yet.</div>
              ` : ''}
            </div>
          ` : `
            <div class="carmen-world-scene-panel">
              <div class="carmen-world-scene-panel-head">
                <div class="carmen-world-scene-panel-kicker">MAP LOCATION</div>
                <div class="carmen-world-scene-panel-title">${esc(selectedMapLocation?.name || 'Location')}</div>
              </div>
              <div class="carmen-artifact-summary carmen-artifact-summary-secondary">
                ${esc(selectedMapLocation?.description || 'This location is handled on the map. Select the scene marker to reopen scene actions and evidence.')}
              </div>
            </div>
          `}
        </div>
      `;
      const evidenceItemMap = new Map();
      for (const item of sceneEvidenceImages) {
        if (item.id) evidenceItemMap.set(item.id, item);
      }
      const flashEvidenceButton = (imageId) => {
        const targetBtn = els.locations.querySelector(`.carmen-world-scene-evidence-btn[data-evidence-id="${imageId}"]`);
        if (!targetBtn) return;
        targetBtn.classList.add('is-pulsing');
        targetBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        setTimeout(() => targetBtn.classList.remove('is-pulsing'), 1400);
      };
      const pickSceneAction = (locId) => {
        const sceneAction = visibleSceneActions.find(action => action.id === locId);
        if (sceneAction?.locked) {
          if (sceneAction.requiredImageId) flashEvidenceButton(sceneAction.requiredImageId);
          return;
        }
        this._worldInvestigatedIds.add(locId);
        const btn = Array.from(els.locations.querySelectorAll('.carmen-location-btn'))
          .find(candidate => candidate.dataset.location === locId);
        if (btn) btn.classList.add('investigated');
        cityInvestigationMap?.setLocationState?.(locId, 'investigated');
        onInvestigate(locId);
      };
      const selectMapLocation = (locId) => {
        const sceneAction = visibleSceneActions.find(action => action.id === locId);
        if (sceneAction?.locked) {
          if (sceneAction.requiredImageId) flashEvidenceButton(sceneAction.requiredImageId);
          return;
        }
        if (typeof options?.onLocationSelect === 'function') {
          options.onLocationSelect(locId);
          return;
        }
        onInvestigate(locId);
      };

      for (const locId of this._worldInvestigatedIds) {
        const btn = Array.from(els.locations.querySelectorAll('.carmen-location-btn'))
          .find(candidate => candidate.dataset.location === locId);
        if (btn) btn.classList.add('investigated');
      }

      const openEvidenceImage = (item, dock = true) => {
        const observation = state?.imageObservations?.[item.id] || { hotspotsHit: new Set(), puzzleSolved: false };
        showImageViewer(item, {
          dockToMap: dock,
          targetEl: els.cityMapStage?.querySelector('.carmen-city-map-wrap') || null,
          observation,
          onHotspotClick: (img, hotspot) => {
            if (typeof options?.onHotspotClick !== 'function') return null;
            return options.onHotspotClick(img, hotspot);
          },
          onPuzzleSolved: (img, attempt, monologue) => {
            if (typeof options?.onPuzzleSolved === 'function') {
              return options.onPuzzleSolved(img, attempt, monologue);
            }
            return null;
          },
        });
      };

      els.locations.querySelectorAll('.carmen-world-scene-evidence-btn').forEach(btn => {
        btn.addEventListener('click', (event) => {
          event.preventDefault();
          const imageId = btn.dataset.evidenceId || '';
          const item = evidenceItemMap.get(imageId);
          if (!item) return;
          const interactive = (Array.isArray(item.hotspots) && item.hotspots.length) || !!item.puzzle;
          openEvidenceImage(item, !interactive);
        });
      });

      if (options?.cityMap && els.cityMapStage) {
        els.rvClues.classList.add('has-city-map');
        els.cityMapStage.style.display = '';
        const restoredViewport = options.contextKey && options.contextKey === prevContextKey
          ? prevViewport
          : null;
        cityInvestigationMap = createCityInvestigationMap(
          els.cityMapStage,
          mapLocations,
          { ...options, initialUserViewport: restoredViewport },
          selectMapLocation
        );
        for (const locId of this._worldInvestigatedIds) {
          cityInvestigationMap?.setLocationState?.(locId, 'investigated');
        }
        for (const locId of staleLocationIds) {
          cityInvestigationMap?.setLocationState?.(locId, 'stale');
        }
        cityInvestigationMap?.setSelectedLocation?.(selectedContext?.type === 'scene' ? '__scene__' : selectedContext?.id || '');
      }

      els.locations.querySelectorAll('.carmen-world-scene-btn[data-location]').forEach(btn => {
        btn.addEventListener('click', () => pickSceneAction(btn.dataset.location));
      });
    },

    showWorldTravelDesk(candidates, onTravel, onInspect, options = null) {
      const summary = options?.summary || {};
      const atlasHints = options?.atlasHints || [];
      const hintMode = options?.hintMode || 'subtle';
      const hintIndex = atlasHints.length ? Math.max(0, Math.min(options?.hintIndex || 0, atlasHints.length - 1)) : 0;
      const activeHint = atlasHints[hintIndex] || null;
      const revealHintDetails = !!options?.revealHintDetails;
      const inspectCountry = options?.inspectCountry || '';
      const inspectCandidate = inspectCountry
        ? candidates.find(item => item.country === inspectCountry) || null
        : null;
      const citySelection = options?.citySelection || null;
      const hoveredCity = options?.hoveredCity || '';
      const targetStop = options?.targetStop || null;
      const targetTravelLabel = options?.targetTravelLabel || null;
      const localTrail = options?.localTrail || null;
      els.travelTitle.textContent = 'Where does the world case lead?';
      els.travelDesc.textContent = citySelection
        ? 'Choose a city on the map to commit the next flight.'
        : 'Compare the evidence, inspect countries on the map, and move when the lead is strong enough.';
      const cost = els.panelTravel.querySelector('.carmen-panel-cost');
      if (cost) cost.innerHTML = '';
      els.sidebar.innerHTML = `
        <div class="carmen-world-atlas-stack">
          ${localTrail ? renderWorldLocalTrail(localTrail) : ''}
          <div class="carmen-world-travel-desk">
            ${targetStop ? `
              <div class="carmen-world-active-lead">
                <span class="carmen-world-atlas-hint-label">Active lead</span>
                <strong>${esc(targetTravelLabel?.primary || [targetStop.city, targetStop.country].filter(Boolean).join(', ') || targetStop.country || 'Unknown destination')}</strong>
                ${targetTravelLabel?.secondary ? `<span>${esc(targetTravelLabel.secondary)}</span>` : ''}
              </div>
            ` : ''}
            <div class="carmen-world-atlas-meta">
              <div class="carmen-world-atlas-count"><b>${esc(String(summary.strong || 0))}</b> strong</div>
              <div class="carmen-world-atlas-count">${esc(String(summary.partial || 0))} partial</div>
            </div>
            <div class="carmen-world-atlas-chip-row">
              <button type="button" class="carmen-world-atlas-toggle" data-hints>
                Hints: ${esc(hintMode === 'off' ? 'off' : 'subtle')}
              </button>
              ${atlasHints.length > 1 ? '<button type="button" class="carmen-world-atlas-toggle" data-next-hint>Next hint</button>' : ''}
              ${citySelection ? '<button type="button" class="carmen-world-atlas-close" data-close-detail aria-label="Back to world atlas">×</button>' : ''}
            </div>
            <button type="button" class="carmen-world-atlas-hint${revealHintDetails ? ' is-open' : ''}" data-hint-detail>
              <span class="carmen-world-atlas-hint-label">Atlas hint</span>
              <span class="carmen-world-atlas-hint-text">${esc(activeHint?.text || 'Gather evidence to let the map start teaching back.')}</span>
            </button>
            ${revealHintDetails ? `
              <div class="carmen-world-atlas-hint-list">
                ${(atlasHints.slice(0, 4)).map(item => `<div class="carmen-world-atlas-mini">${esc(item.text)}</div>`).join('')}
              </div>
            ` : ''}
            ${citySelection ? `
              <div class="carmen-world-atlas-mini">
                ${hoveredCity ? `Travel to: <strong>${esc([hoveredCity, citySelection.country].filter(Boolean).join(', '))}</strong>` : 'Hover a city on the map to inspect it before you fly.'}
              </div>
            ` : ''}
          </div>
          ${!citySelection && inspectCandidate ? `
            <div class="carmen-world-candidate-detail compact">
              <div class="carmen-world-candidate-topline">
                <div>
                  <div class="carmen-panel-badge">ATLAS COMPARISON</div>
                  <div class="carmen-panel-title">${esc(inspectCandidate.travelLabel?.primary || inspectCandidate.country)}</div>
                  <div class="carmen-panel-desc">${esc(inspectCandidate.travelLabel?.secondary || inspectCandidate.capital || '')}</div>
                </div>
                <button type="button" class="carmen-world-atlas-close" data-close-detail aria-label="Close country details">×</button>
              </div>
              <div class="carmen-world-candidate-state ${esc(inspectCandidate.state || 'unknown')}">${esc(inspectCandidate.state || 'unknown')}</div>
              <div class="carmen-world-atlas-mini">${esc(inspectCandidate.hintSummary || 'No evidence summary yet.')}</div>
              <button type="button" class="carmen-world-travel-now" data-travel-country="${esc(inspectCandidate.country)}"${inspectCandidate.country === options?.currentCountry ? ' disabled' : ''}>
                ${inspectCandidate.country === options?.currentCountry ? 'Current scene' : `Travel to ${esc(inspectCandidate.country)}`}
              </button>
            </div>
          ` : ''}
        </div>
      `;
      const hintsButton = els.sidebar.querySelector('[data-hints]');
      if (hintsButton && typeof options?.onToggleHints === 'function') {
        hintsButton.addEventListener('click', () => options.onToggleHints());
      }
      const hintDetailButton = els.sidebar.querySelector('[data-hint-detail]');
      if (hintDetailButton && typeof options?.onToggleHintDetails === 'function') {
        hintDetailButton.addEventListener('click', () => options.onToggleHintDetails());
      }
      const nextHintButton = els.sidebar.querySelector('[data-next-hint]');
      if (nextHintButton && typeof options?.onCycleHint === 'function') {
        nextHintButton.addEventListener('click', () => options.onCycleHint());
      }
      const closeDetail = els.sidebar.querySelector('[data-close-detail]');
      if (closeDetail && typeof options?.onCloseInspect === 'function') {
        closeDetail.addEventListener('click', () => options.onCloseInspect());
      }
      const travelBtn = els.sidebar.querySelector('[data-travel-country]');
      if (travelBtn) {
        travelBtn.addEventListener('click', () => onTravel(travelBtn.dataset.travelCountry));
      }
      if (options?.switchToTravel !== false) switchTab('travel');
    },

    showWorldCandidateDetails(candidate, onTravel, options = null) {
      const matched = candidate?.matchedEvidence || [];
      const contradicted = candidate?.contradictedEvidence || [];
      const currentCountry = options?.currentCountry || '';
      els.sidebar.innerHTML = `
        <div class="carmen-world-atlas-stack">
          <div class="carmen-world-candidate-detail">
            <div class="carmen-world-candidate-topline">
              <div>
                <div class="carmen-panel-badge">ATLAS COMPARISON</div>
                <div class="carmen-panel-title">${esc(candidate?.travelLabel?.primary || candidate?.country || 'Unknown')}</div>
                <div class="carmen-panel-desc">${esc(candidate?.travelLabel?.secondary || candidate?.capital || '')}</div>
              </div>
              ${typeof options?.onClose === 'function' ? '<button type="button" class="carmen-world-atlas-close" data-close-detail aria-label="Close country details">×</button>' : ''}
            </div>
            <div class="carmen-world-candidate-state ${esc(candidate?.state || 'unknown')}">${esc(candidate?.state || 'unknown')}</div>
            <div class="carmen-world-atlas-mini">${esc(candidate?.hintSummary || 'No collected evidence points here yet.')}</div>
            <button type="button" class="carmen-world-travel-now"${candidate?.country && candidate.country !== currentCountry ? '' : ' disabled'}>
              ${candidate?.country && candidate.country !== currentCountry ? `Travel to ${esc(candidate.country)}` : 'Current scene'}
            </button>
            <div class="carmen-world-section-title">Matches</div>
            ${matched.length ? matched.map(item => `<div class="carmen-world-mini-card">✓ ${esc(item.title || item.text)}</div>`).join('') : '<div class="carmen-dossier-empty">No collected clue points here yet.</div>'}
            <div class="carmen-world-section-title">Contradictions</div>
            ${contradicted.length ? contradicted.map(item => `<div class="carmen-world-mini-card contradicted">× ${esc(item.title || item.text)}</div>`).join('') : '<div class="carmen-dossier-empty">No direct contradiction found.</div>'}
          </div>
        </div>
      `;
      const btn = els.sidebar.querySelector('.carmen-world-travel-now');
      if (btn && candidate?.country && candidate.country !== currentCountry) {
        btn.addEventListener('click', () => onTravel(candidate.country));
      }
      const close = els.sidebar.querySelector('[data-close-detail]');
      if (close && typeof options?.onClose === 'function') close.addEventListener('click', () => options.onClose());
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

    recoverManifestRedaction(stopIndex) {
      const segment = manifestState.segments.find(item => item.stopIndex === stopIndex);
      if (!segment) return;
      segment.recoveredAfterFinale = true;
      renderDossier();
    },

    showSkylineFinalManifestProof(proof, options = null) {
      return showSkylineFinalManifestProof(proof, options);
    },

    /** Add a clue to the dossier. */
    addDossierEntry(stop, clueText, informantPrefix, emoji, country, capital, options = null) {
      dossierEntries.push({
        stop,
        stopKey: `stop-${stop}`,
        clueText,
        informantPrefix,
        emoji,
        country,
        capital,
        scope: options?.scope || null,
        visualEvidence: options?.visualEvidence || null,
        stopLabel: options?.stopLabel || '',
      });
      renderDossier();
    },

    /** Add a dead-end detour entry to the dossier. */
    addDetourEntry(country, capital, options = null) {
      const key = `detour-${detourCounter++}`;
      dossierEntries.push({
        stop: -1, stopKey: key, type: 'detour',
        clueText: isSkylineMode(options?.mode) ? 'No manifest match, no flight route confirmed. A dead end.' : 'No witnesses, no clues. A dead end.',
        informantPrefix: 'Dead end', emoji: '❌',
        country, capital,
      });
      renderDossier();
    },

    /** Reset the dossier for a new game. */
    resetDossier() {
      worldCaseBoardState = null;
      dossierEntries.length = 0;
      detourCounter = 0;
      dossierSubview = 'case';
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
        } else if (campaignPhase === 'archive_cleared') {
          quirkOverride = 'Crimson archive clearance granted. Full historical file available for cross-case review.';
        }
      }
      const hasCarmenClearance = campaignPhase === 'finale' || campaignPhase === 'archive_cleared';
      const isCarmenPreFinale = suspect.name === 'Carmen Sandiego' && !hasCarmenClearance;
      const profileImage = suspect.name === 'Carmen Sandiego' && hasCarmenClearance
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

      const statusClass = status === 'ACTIVE'
        ? 'at-large'
        : status === 'ARCHIVE CLEARED'
          ? 'archive-cleared'
          : 'in-custody';
      const markLabel = isMarked ? 'Remove Mark' : 'Mark as Person of Interest';
      const canReadBackground = status === 'IN CUSTODY' || status === 'ARCHIVE CLEARED';
      const backgroundStory = canReadBackground ? getInterpolBackgroundStory(suspect) : null;
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
        const caseTitle = options?.caseTitle || '';
        const caseLabel = mode === 'skyline_syndicate'
          ? `SKYLINE CASE — ${caseNumber} / ${totalCases}`
          : mode === 'city_open_case'
          ? 'CITY MAP OPEN CASE'
          : mode === 'world_case_files'
          ? 'WORLD CASE FILES'
          : mode === 'open_cases'
          ? `OPEN CASE — ${openCaseNumber}`
          : caseNumber
          ? (campaignPhase === 'finale' ? `THE CRIMSON TRAIL — FINAL CASE ${caseNumber} / ${totalCases}` : `THE CRIMSON TRAIL — CASE ${caseNumber} / ${totalCases}`)
          : 'STOLEN ARTIFACT';
        els.briefingArtifact.innerHTML = `
          <div class="carmen-artifact-label">${esc(caseLabel)}</div>
          ${caseTitle ? `<div class="carmen-case-title">${esc(caseTitle)}</div>` : ''}
          ${mode === 'world_case_files' ? '' : `<div class="carmen-artifact-name">${esc(siteName)}</div>`}
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
        caseCardState.artifact = artifact || null;
        applyRouteCopy(mode);
      // Set artifact image for the right-side display
      if (imgUrl) {
        els.artifactImg.src = imgUrl;
        els.artifactImg.alt = siteName;
      }
      if (els.artifactImg) {
        els.artifactImg.classList.remove('is-clickable');
        els.artifactImg.title = '';
        els.artifactImg.onclick = null;
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

    updateWorldCaseArtifact(state) {
      const panel = state?.artifactPanel || null;
      const artifact = caseCardState.artifact || {};
      const imagePath = artifact.imageUrl || '';
      if (imagePath) {
        els.artifactImg.src = imagePath;
        els.artifactImg.alt = artifact.siteName || 'Case evidence';
      }
      els.artifactSummary.innerHTML = formatArtifactBack(artifact, panel);
      bindWorldCaseArtifactEvidence(panel);
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
      els.progress.classList.remove('world-case-status');
      const displayStop = Math.min(total, stop + 1);
      els.progress.textContent = `Stop ${displayStop} of ${total}`;
    },

    updateClock(hoursRemaining, totalHours) {
      const clockText = els.clock.querySelector('.carmen-clock-text');
      const clockIcon = els.clock.querySelector('.carmen-clock-icon');
      els.clock.classList.remove('world-case-status', 'world-case-ready');
      if (clockIcon) clockIcon.style.display = '';
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

    addClue(clue, informant, visualCallbacks = null) {
      // Dismiss any open evidence panel first
      dismissEvidence();
      const onVisualSolved = typeof visualCallbacks === 'function'
        ? visualCallbacks
        : visualCallbacks?.onVisualSolved;
      const onVisualExamined = typeof visualCallbacks === 'object'
        ? visualCallbacks?.onVisualExamined
        : null;

      const emoji = informant ? informant.emoji : (clue.icon || '💬');
      const prefix = informant ? informant.prefix : 'Intel';
      els.reveal.innerHTML = `
        <div class="carmen-speech-bubble">
          <button class="carmen-clue-close-btn" type="button" aria-label="Dismiss clue" style="display:none">✕</button>
          <div class="carmen-speech-avatar">${emoji}</div>
          <div class="carmen-speech-body">
            <div class="carmen-speech-name">${esc(prefix)}</div>
            ${clue.scope === 'capital' ? `<div class="carmen-clue-scope">📍 capital lead</div>` : ''}
            ${clue.action ? `<div class="carmen-speech-action">${esc(clue.action)}</div>` : ''}
            <div class="carmen-speech-text"></div>
          </div>
        </div>
      `;
      els.reveal.style.display = '';
      els.reveal.querySelector('.carmen-clue-close-btn')?.addEventListener('click', () => {
        els.reveal.style.display = 'none';
        els.reveal.innerHTML = '';
      });
      // Switch right panel to clues view
      for (const rv of allRightViews) rv.style.display = 'none';
      els.rvClues.style.display = '';
      // Typewriter the clue text
      const textEl = els.reveal.querySelector('.carmen-speech-text');
      typewriter(textEl, `"${clue.text}"`, 20).then(() => {
        // Show dismiss button after typewriter completes
        const closeBtn = els.reveal.querySelector('.carmen-clue-close-btn');
        if (closeBtn) closeBtn.style.display = '';
        // Visual clue: show "Examine Evidence" button after text completes
        const speechBody = els.reveal.querySelector('.carmen-speech-body');
        if (!speechBody || !clue.data?.visualType) return;

        const isScramble = clue.data.visualType === 'scramble';
        const isOutline = clue.data.visualType === 'outline' && worldDataRef;
        const isFlag = clue.data.visualType === 'flag';
        const isCargoLabel = clue.data.visualType === 'cargo-label';
        if (!isScramble && !isOutline && !isFlag && !isCargoLabel) return;

        const btn = document.createElement('button');
        btn.className = 'carmen-evidence-btn';
        btn.innerHTML = isCargoLabel ? '🔍 Examine Cargo Label' : '🔍 Examine Evidence';
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
            if (onVisualExamined) onVisualExamined({ type: 'flag', targetCountry: clue.data.targetCountry });
          } else if (isCargoLabel) {
            renderCargoLabel(evidenceWrap, clue.data);
          } else {
            renderOutline(evidenceWrap, clue.data.targetCountry, worldDataRef);
            if (onVisualExamined) onVisualExamined({ type: 'outline', targetCountry: clue.data.targetCountry });
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

    showWitnessQuestions({ locationId, informant, intro, questions, onAsk }) {
      dismissEvidence();
      const emoji = informant?.emoji || '🗣️';
      const prefix = informant?.prefix || 'Witness';
      els.reveal.innerHTML = `
        <div class="carmen-speech-bubble carmen-witness-bubble" data-location="${esc(locationId)}">
          <button class="carmen-clue-close-btn" type="button" aria-label="Dismiss" style="display:none">✕</button>
          <div class="carmen-speech-avatar">${emoji}</div>
          <div class="carmen-speech-body">
            <div class="carmen-speech-name">${esc(prefix)}</div>
            <div class="carmen-speech-text carmen-witness-intro"></div>
            <div class="carmen-speech-text carmen-witness-answer" style="display:none"></div>
            <div class="carmen-witness-questions"></div>
          </div>
        </div>
      `;
      els.reveal.style.display = '';
      els.reveal.querySelector('.carmen-clue-close-btn')?.addEventListener('click', () => {
        els.reveal.style.display = 'none';
        els.reveal.innerHTML = '';
      });
      for (const rv of allRightViews) rv.style.display = 'none';
      els.rvClues.style.display = '';

      const introEl = els.reveal.querySelector('.carmen-witness-intro');
      const introText = intro || 'They are listening. Pick your question.';
      typewriter(introEl, `"${introText}"`, 18).then(() => {
        const closeBtn = els.reveal.querySelector('.carmen-clue-close-btn');
        if (closeBtn) closeBtn.style.display = '';
      });
      this._renderWitnessQuestionList(questions, onAsk);
    },

    _renderWitnessQuestionList(questions, onAsk) {
      const wrap = els.reveal.querySelector('.carmen-witness-questions');
      if (!wrap) return;
      wrap.innerHTML = (questions || []).map((q) => `
        <button
          class="carmen-witness-question-btn${q.asked ? ' asked' : ''}${q.providesClue ? ' has-clue' : ''}"
          data-question="${esc(q.id)}"
          ${q.asked ? 'disabled' : ''}
        >
          <span class="carmen-witness-question-text">${esc(q.text)}</span>
          ${q.asked && q.answer ? `<span class="carmen-witness-question-answer">${esc(q.answer)}</span>` : ''}
        </button>
      `).join('') || `<div class="carmen-witness-empty">No questions available yet. Find more evidence in the field.</div>`;
      wrap.querySelectorAll('.carmen-witness-question-btn:not(.asked)').forEach((btn) => {
        btn.addEventListener('click', () => {
          const qid = btn.getAttribute('data-question');
          if (qid && typeof onAsk === 'function') onAsk(qid);
        });
      });
    },

    renderWitnessAnswer({ locationId, informant, answer, questions, onAsk }) {
      const bubble = els.reveal.querySelector(`.carmen-witness-bubble[data-location="${CSS.escape(locationId)}"]`);
      if (!bubble) {
        this.showWitnessQuestions({ locationId, informant, intro: '', questions, onAsk });
        return;
      }
      const answerEl = bubble.querySelector('.carmen-witness-answer');
      if (answerEl) {
        answerEl.style.display = '';
        typewriter(answerEl, `"${answer || ''}"`, 18);
      }
      this._renderWitnessQuestionList(questions, onAsk);
    },

    /**
     * Show investigation location cards.
     * @param {Array} locations — [{id, emoji, name}]
     * @param {number} maxInvestigations — how many the player can pick
     * @param {Function} onInvestigate — called with (locationId) when player picks a location
     * @param {Object|null} options — optional city map configuration
     */
    showLocations(locations, maxInvestigations, onInvestigate, options = null) {
      clearCityInvestigationMap();
      this._investigationsLeft = maxInvestigations;
      this._investigatedIds = new Set();
      els.locationsLabel.style.display = '';
      els.locationsLabel.textContent = `Investigate a location (${this._investigationsLeft} remaining):`;
      els.locations.innerHTML = `
        <div class="carmen-location-list">
          ${locations.map(loc => `
            <button class="carmen-location-btn" data-location="${loc.id}">
              <span class="carmen-location-emoji">${loc.emoji}</span>
              <span class="carmen-location-name">${loc.name}</span>
            </button>
          `).join('')}
        </div>
      `;

      const markExhausted = () => {
        els.locations.querySelectorAll('.carmen-location-btn:not(.investigated)').forEach(b => {
          b.disabled = true;
          b.classList.add('exhausted');
        });
        cityInvestigationMap?.exhaustUnvisited?.(this._investigatedIds);
      };

      const pickLocation = (locId) => {
        if (this._investigatedIds.has(locId) || this._investigationsLeft <= 0) return;
        const btn = Array.from(els.locations.querySelectorAll('.carmen-location-btn'))
          .find(candidate => candidate.dataset.location === locId);
        this._investigatedIds.add(locId);
        this._investigationsLeft--;
        if (btn) {
          btn.classList.add('investigated');
          btn.disabled = true;
        }
        cityInvestigationMap?.setLocationState?.(locId, 'investigated');
        els.locationsLabel.textContent = this._investigationsLeft > 0
          ? `Investigate a location (${this._investigationsLeft} remaining):`
          : 'No investigations left — make your guess!';

        onInvestigate(locId);

        if (this._investigationsLeft <= 0) {
          markExhausted();
        }
      };

      if (options?.cityMap) {
        if (els.cityMapStage) {
          els.rvClues.classList.add('has-city-map');
          els.cityMapStage.style.display = '';
          cityInvestigationMap = createCityInvestigationMap(els.cityMapStage, locations, options, pickLocation);
        }
      }

      els.locations.querySelectorAll('.carmen-location-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          pickLocation(btn.dataset.location);
        });
      });
    },

    hideLocations() {
      clearCityInvestigationMap();
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

    showSkylineCampaignComplete(score, suspectName) {
      return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'carmen-closing-overlay';
        overlay.innerHTML = `
          <div class="carmen-closing-content carmen-closing-solved carmen-campaign-complete">
            <div class="carmen-closing-stamp">MANIFEST LOCKED</div>
            <div class="carmen-briefing-label">SKYLINE SYNDICATE — MANIFEST LOCKED</div>
            <div class="carmen-closing-name">Gate Zero is exposed.</div>
            <div class="carmen-closing-text">The thief is in custody. Gate Zero can no longer hide The Dispatcher's hand.</div>
            <div class="carmen-closing-score">${score} points</div>
            <div class="carmen-closing-detail">ACME did not catch The Dispatcher in person; it proved the command pattern, locked the final manifest, and exposed the network's signature. Final operative: ${esc(suspectName)}.</div>
            <div class="carmen-closing-buttons">
              <button class="carmen-closing-btn carmen-btn-continue">Back to Play</button>
              <button class="carmen-closing-btn carmen-btn-quit">Quit</button>
            </div>
          </div>
        `;
        document.body.appendChild(overlay);
        const stamp = overlay.querySelector('.carmen-closing-stamp');
        setTimeout(() => { stamp.classList.add('animate'); playStamp(); }, 300);
        overlay.querySelector('.carmen-btn-continue').addEventListener('click', () => { overlay.remove(); resolve('play'); });
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

function renderWorldLocalTrail(localTrail) {
  const nodes = localTrail?.nodes || [];
  if (!nodes.length) return '';
  return `
    <div class="carmen-world-local-trail ${esc(localTrail.style || 'rail')}">
      <div class="carmen-world-local-kicker">LOCAL LINE</div>
      <div class="carmen-world-local-title">${esc(localTrail.label || 'Museum line')}</div>
      <div class="carmen-world-local-track">
        ${nodes.map(node => `
          <div class="carmen-world-local-node ${esc(node.status || 'upcoming')}">
            <span class="carmen-world-local-dot">${node.status === 'current' ? '🚆' : node.status === 'visited' ? '●' : '○'}</span>
            <span class="carmen-world-local-city">${esc(node.city || '')}</span>
            <span class="carmen-world-local-stop">${esc(node.title || '')}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function formatArtifactBack(artifact, panel = null) {
  const siteName = artifact.siteName || 'Unknown Site';
  const country = artifact.country || '';
  const hint = artifact.hint || '';
  const summary = (panel?.summary || artifact.summary || '').trim();
  const briefingIntro = (artifact.briefingIntro || '').trim();
  const sentences = summary ? summary.split(/(?<=[.!?])\s+/).filter(Boolean) : [];
  const lead = panel?.currentObjective || sentences[0] || 'Reference note unavailable.';
  const work = panel?.primaryWork || null;
  const workLines = work ? [
    work.artist ? `${work.artist}` : '',
    work.institution ? `${work.institution}` : '',
    [work.city, work.country].filter(Boolean).join(', '),
  ].filter(Boolean) : [];

  const briefingHtml = briefingIntro
    ? briefingIntro.split(/\n\n+/).map(p => `<p class="carmen-artifact-summary carmen-artifact-briefing-paragraph">${esc(p)}</p>`).join('')
    : '';

  return `
    <div class="carmen-artifact-backdrop">
      <div class="carmen-artifact-back-type">${panel ? 'CASE EVIDENCE' : 'ARCHIVE NOTE'}</div>
      <div class="carmen-artifact-back-site">${esc(work?.title || siteName)}</div>
      ${(work?.artist || country) ? `<div class="carmen-artifact-back-origin">${esc(work?.artist || country)}</div>` : ''}
      <div class="carmen-artifact-note">
        <div class="carmen-artifact-note-clip"></div>
        <div class="carmen-artifact-note-label">${panel ? 'CURRENT READ' : (briefingIntro ? 'CASE BRIEFING' : 'FIELD NOTE')}</div>
        ${briefingHtml || `<div class="carmen-artifact-summary">${esc(lead)}</div>`}
        ${workLines.length ? `<div class="carmen-artifact-summary carmen-artifact-summary-secondary">${esc(workLines.join(' • '))}</div>` : ''}
        ${work?.description ? `<div class="carmen-artifact-summary carmen-artifact-summary-secondary">${esc(work.description)}</div>` : ''}
        ${hint ? `<div class="carmen-artifact-geo-note"><span>Geo note:</span> ${esc(hint)}</div>` : ''}
      </div>
      <div class="carmen-artifact-back-return">↩ back to photo</div>
    </div>
  `;
}
