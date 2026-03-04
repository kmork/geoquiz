/**
 * Outlines - Complete Game Factory
 * Creates a fully functional Outlines game with SVG rendering and pan/zoom
 * Used by both standalone game and Daily Challenge
 */

import { createOutlinesGame } from "./outlines-game.js";
import { initConfetti } from "./confetti.js";
import { OutlinesRenderer } from "./ui-components/outlines-renderer.js";
import { COUNTRY_ALIASES } from "./aliases.js";
import { loadGeoJSON } from "./geojson-loader.js";

/**
 * Create a complete Outlines game instance
 * @param {Object} config Configuration
 * @param {HTMLElement} config.container - Container element
 * @param {SVGElement} config.svgMap - SVG map element
 * @param {HTMLInputElement} config.answerInput - Answer input field
 * @param {HTMLButtonElement} config.submitBtn - Submit button
 * @param {Object} [config.ui] - Additional UI elements
 * @param {Object} [config.confetti] - Confetti instance
 * @param {boolean} [config.singleRound=false] - Single round mode
 * @param {Function} [config.onComplete] - Callback when game completes
 * @returns {Promise<Object>} Game instance
 */
export async function createCompleteOutlinesGame({
  container,
  svgMap,
  answerInput,
  submitBtn,
  ui = {},
  confetti: confettiInstance,
  singleRound = false,
  onComplete,
  maxRounds = 10,
  gameIdSuffix = 'short'
}) {
  
  // Load world data (route variant — overseas territories pre-removed)
  const worldData = await loadGeoJSON('data/ne_10m_admin_0_countries_route.geojson.gz');
  const WORLD = worldData.features;

  // Build neighbors lookup from unified window.DATA
  const NEIGHBORS = Object.fromEntries((window.ALL_COUNTRIES || window.DATA).map(c => [c.country, c.neighbors]));
  
  // Create renderer
  const renderer = new OutlinesRenderer(svgMap, WORLD, {
    aliases: COUNTRY_ALIASES
  });

  let baseViewBox = { x: 0, y: 0, w: 600, h: 320 };
  let zoomMaxFactor = 15.0;

  // Raw draw — renders countries; when keepViewBox is true (default), keeps the
  // current viewBox so the map stays focused on the target country (neighbors
  // appear at the edges as context without giving away the answer by zooming out).
  // When keepViewBox is false, the viewBox expands to fit neighbors and zoom
  // limits are relaxed so the player can freely explore the map.
  function rawDrawCountries(targetCountry, neighborCountries, keepViewBox = true) {
    if (neighborCountries && neighborCountries.length > 0) {
      if (keepViewBox) {
        const savedVB = svgMap.getAttribute('viewBox');
        renderer.drawCountries(targetCountry, neighborCountries);
        if (savedVB) svgMap.setAttribute('viewBox', savedVB);
        // baseViewBox unchanged — pan/zoom stays bounded to target-only view
      } else {
        // Reveal mode: expand viewBox to fit target + neighbors, allow free zoom
        renderer.drawCountries(targetCountry, neighborCountries);
        baseViewBox = renderer.getViewBox();
        zoomMaxFactor = 50;
      }
    } else {
      renderer.drawCountries(targetCountry, neighborCountries);
      baseViewBox = renderer.getViewBox();
      zoomMaxFactor = 15.0;
    }
  }

  // Reveal the correct answer on the map — zoom out to show country in context
  function revealAnswer(targetCountry, neighborCountries) {
    hideHintPanel();
    rawDrawCountries(targetCountry, neighborCountries, false);
  }

  // Hint UI state
  let hintBtn = null;
  let hintPanel = null;
  let hintUsed = false;

  function hideHintPanel() {
    if (hintPanel) hintPanel.classList.remove('visible');
  }

  function showHintPanel(currentCountryName) {
    if (!hintPanel) return;
    const nbrs = NEIGHBORS[currentCountryName] || [];
    const text = nbrs.length === 0
      ? 'Island nation — no land borders'
      : 'Neighboring countries are now shown on the map';
    hintPanel.querySelector('.find-hint-list').innerHTML = `<li>${text}</li>`;
    hintPanel.classList.add('visible');
  }

  // drawCountries — wrapped version passed to the game; detects new rounds (empty neighbors)
  function drawCountries(targetCountry, neighborCountries) {
    rawDrawCountries(targetCountry, neighborCountries);
    if (!neighborCountries || neighborCountries.length === 0) {
      hideHintPanel();
      hintUsed = false;
      if (hintBtn) hintBtn.style.opacity = '1';
    }
  }
  
  // Attach zoom/pan to SVG (start-relative model, same as Capitals map)
  function attachZoomPan() {
    const svgEl = svgMap;

    const clientToSvg = (clientX, clientY) => {
      const pt = svgEl.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const ctm = svgEl.getScreenCTM();
      if (!ctm) return { x: 0, y: 0 };
      const p = pt.matrixTransform(ctm.inverse());
      return { x: p.x, y: p.y };
    };

    const setVB = (vb) => {
      svgEl.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
    };

    ["gesturestart", "gesturechange", "gestureend"].forEach((t) => {
      svgEl.addEventListener(t, (e) => e.preventDefault(), { passive: false });
    });

    const ZOOM_MIN_FACTOR = 0.35;

    const getVB = () => {
      const vb = svgEl.viewBox.baseVal;
      return { x: vb.x, y: vb.y, w: vb.width, h: vb.height };
    };

    const clampToLimits = (candidate) => {
      const aspect = candidate.h / candidate.w;
      const minW = baseViewBox.w * ZOOM_MIN_FACTOR;
      const maxW = baseViewBox.w * zoomMaxFactor;

      let w = candidate.w;
      if (w < minW) w = minW;
      if (w > maxW) w = maxW;

      const h = w * aspect;
      let x = candidate.x + (candidate.w - w) / 2;
      let y = candidate.y + (candidate.h - h) / 2;

      const minVisibleMargin = Math.min(w, h) * 0.2;
      const maxPanRight = baseViewBox.x + baseViewBox.w - minVisibleMargin;
      if (x > maxPanRight) x = maxPanRight;
      const minPanLeft = baseViewBox.x - w + minVisibleMargin;
      if (x < minPanLeft) x = minPanLeft;
      const maxPanDown = baseViewBox.y + baseViewBox.h - minVisibleMargin;
      if (y > maxPanDown) y = maxPanDown;
      const minPanUp = baseViewBox.y - h + minVisibleMargin;
      if (y < minPanUp) y = minPanUp;

      return { x, y, w, h };
    };

    const zoomAt = (factor, clientX, clientY) => {
      const vb = getVB();
      const p = clientToSvg(clientX, clientY);
      const rx = (p.x - vb.x) / vb.w;
      const ry = (p.y - vb.y) / vb.h;
      const nw = vb.w * factor;
      const nh = vb.h * factor;
      const cand = { x: p.x - rx * nw, y: p.y - ry * nh, w: nw, h: nh };
      setVB(clampToLimits(cand));
    };

    // Wheel zoom
    svgEl.addEventListener("wheel", (e) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1.15 : 0.87;
      zoomAt(factor, e.clientX, e.clientY);
    }, { passive: false });

    // Pointer pan + pinch zoom (start-relative)
    svgEl.style.touchAction = "none";
    const pointers = new Map();
    let startVB = null;
    let panStart = null;
    let startDist = 0;

    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

    svgEl.addEventListener("pointerdown", (e) => {
      svgEl.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      startVB = getVB();

      if (pointers.size === 1) {
        panStart = { x: e.clientX, y: e.clientY };
        startDist = 0;
      } else if (pointers.size === 2) {
        const pts = [...pointers.values()];
        startDist = dist(pts[0], pts[1]);
        panStart = null;
      }
      svgEl.style.cursor = "grabbing";
    }, { passive: false });

    svgEl.addEventListener("pointermove", (e) => {
      if (!pointers.has(e.pointerId) || !startVB) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      // One pointer: pan from start position
      if (pointers.size === 1 && panStart) {
        const p = [...pointers.values()][0];
        const a = clientToSvg(panStart.x, panStart.y);
        const b = clientToSvg(p.x, p.y);
        let newX = startVB.x + (a.x - b.x);
        let newY = startVB.y + (a.y - b.y);

        const minVisibleMargin = Math.min(startVB.w, startVB.h) * 0.2;
        const maxPanRight = baseViewBox.x + baseViewBox.w - minVisibleMargin;
        if (newX > maxPanRight) newX = maxPanRight;
        const minPanLeft = baseViewBox.x - startVB.w + minVisibleMargin;
        if (newX < minPanLeft) newX = minPanLeft;
        const maxPanDown = baseViewBox.y + baseViewBox.h - minVisibleMargin;
        if (newY > maxPanDown) newY = maxPanDown;
        const minPanUp = baseViewBox.y - startVB.h + minVisibleMargin;
        if (newY < minPanUp) newY = minPanUp;

        setVB({ x: newX, y: newY, w: startVB.w, h: startVB.h });
        return;
      }

      // Two pointers: pinch zoom from start snapshot
      if (pointers.size === 2 && startDist) {
        const pts = [...pointers.values()];
        const dNow = dist(pts[0], pts[1]);
        const scale = dNow / startDist;
        const factor = 1 / scale;
        const m = mid(pts[0], pts[1]);
        const pMid = clientToSvg(m.x, m.y);
        const rx = (pMid.x - startVB.x) / startVB.w;
        const ry = (pMid.y - startVB.y) / startVB.h;
        const nw = startVB.w * factor;
        const nh = startVB.h * factor;
        const cand = { x: pMid.x - rx * nw, y: pMid.y - ry * nh, w: nw, h: nh };
        setVB(clampToLimits(cand));
      }
    }, { passive: false });

    const endPointer = (e) => {
      pointers.delete(e.pointerId);
      if (pointers.size === 1) {
        const p = [...pointers.values()][0];
        startVB = getVB();
        panStart = { x: p.x, y: p.y };
        startDist = 0;
      } else if (pointers.size === 0) {
        startVB = null;
        panStart = null;
        startDist = 0;
        svgEl.style.cursor = "grab";
      }
    };

    svgEl.addEventListener("pointerup", endPointer);
    svgEl.addEventListener("pointercancel", () => {
      pointers.clear();
      startVB = null;
      panStart = null;
      startDist = 0;
      svgEl.style.cursor = "grab";
    });

    svgEl.style.cursor = "grab";
  }
  
  attachZoomPan();

  function createHintUI() {
    const mapwrap = svgMap.parentElement;

    hintBtn = document.createElement('button');
    hintBtn.className = 'picture-hint-btn';
    hintBtn.textContent = '💡';
    hintBtn.title = 'Show hint';
    mapwrap.appendChild(hintBtn);

    hintPanel = document.createElement('div');
    hintPanel.className = 'find-hint-panel';
    hintPanel.innerHTML =
      '<div class="find-hint-panel-header"><span>💡 Hint</span></div>' +
      '<ul class="find-hint-list"></ul>';
    mapwrap.appendChild(hintPanel);

    hintPanel.addEventListener('click', () => hideHintPanel());

    hintBtn.addEventListener('click', () => {
      if (hintPanel.classList.contains('visible')) {
        hideHintPanel();
        return;
      }
      const currentCountry = game?.getCurrent?.();
      if (!currentCountry) return;
      if (!hintUsed) {
        const nbrs = NEIGHBORS[currentCountry] || [];
        if (nbrs.length > 0) rawDrawCountries(currentCountry, nbrs);
        hintUsed = true;
        game?.markHintUsed?.();
        hintBtn.style.opacity = '0.5';
      }
      showHintPanel(currentCountry);
    });
  }

  // Create confetti if needed
  const confetti = confettiInstance || (singleRound ? null : initConfetti("confetti"));
  
  // Full UI
  const fullUI = {
    map: svgMap,
    answerInput: answerInput,
    submitBtn: submitBtn,
    scoreEl: ui.scoreEl || null,
    progressEl: ui.progressEl || null,
    statusEl: ui.statusEl || null,
    finalOverlay: ui.finalOverlay || null,
  };
  
  // Create game instance
  let game = createOutlinesGame({
    ui: fullUI,
    neighbors: NEIGHBORS,
    confetti,
    drawCountries,
    revealAnswer,
    config: {
      singleRound,
      hideScoreUI: singleRound,
      onComplete: onComplete,
      maxRounds,
      gameIdSuffix,
    }
  });

  if (!singleRound) createHintUI();
  
  // Setup autocomplete with country names and aliases
  if (window.DATA && Array.isArray(window.DATA)) {
    console.log('Setting up autocomplete with', window.DATA.length, 'countries');
    const countryNames = window.DATA.map(c => c.country).filter(Boolean);
    const countrySet = new Set(countryNames);
    Object.entries(COUNTRY_ALIASES).forEach(([alias, target]) => {
      if (countrySet.has(target) && !countrySet.has(alias)) countryNames.push(alias);
    });
    countryNames.sort();
    
    // Check if we need to create a datalist or use mobile autocomplete
    if (typeof window.initMobileAutocomplete === 'function') {
      // Mobile autocomplete (if available)
      console.log('Calling initMobileAutocomplete');
      window.initMobileAutocomplete(answerInput, countryNames, { onSelect: () => submitBtn.click() });
    } else {
      // Fallback to HTML5 datalist
      console.log('Using HTML5 datalist');
      let datalist = answerInput.list;
      if (!datalist) {
        datalist = document.createElement('datalist');
        datalist.id = 'outlines-countries-' + Math.random().toString(36).substr(2, 9);
        answerInput.setAttribute('list', datalist.id);
        document.body.appendChild(datalist);
      }
      datalist.innerHTML = countryNames.map(name => `<option value="${name}">`).join('');
    }
  } else {
    console.warn('window.DATA not available for autocomplete');
  }
  
  return {
    game,
    nextQ: () => game.nextQ(),
    reset: () => game.reset(),
    setCountry: (country) => game.setCountry(country),
  };
}
