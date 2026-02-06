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

// Make aliases globally available
window.COUNTRY_ALIASES = COUNTRY_ALIASES;

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
  onComplete
}) {
  
  // Load world data only (neighbors are just country names, loaded separately)
  const worldData = await loadGeoJSON('data/ne_10m_admin_0_countries.geojson.gz');
  const WORLD = worldData.features;
  
  // Load neighbors data (JSON mapping of country -> neighbor names)
  const NEIGHBORS = await fetch('data/countries-neighbors.json').then(r => r.json());
  
  // Create renderer
  const renderer = new OutlinesRenderer(svgMap, WORLD, {
    aliases: COUNTRY_ALIASES
  });
  
  let baseViewBox = { x: 0, y: 0, w: 600, h: 320 };
  
  // Draw countries wrapper
  function drawCountries(targetCountry, neighborCountries) {
    if (renderer) {
      renderer.drawCountries(targetCountry, neighborCountries);
      baseViewBox = renderer.getViewBox();
    }
  }
  
  // Attach zoom/pan to SVG
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
    
    const setViewBox = (vb) => {
      svgEl.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
    };
    
    ["gesturestart", "gesturechange", "gestureend"].forEach((t) => {
      svgEl.addEventListener(t, (e) => e.preventDefault(), { passive: false });
    });
    
    const ZOOM_MIN_FACTOR = 0.35;
    const ZOOM_MAX_FACTOR = 15.0;
    
    const getVB = () => {
      const vb = svgEl.viewBox.baseVal;
      return { x: vb.x, y: vb.y, w: vb.width, h: vb.height };
    };
    
    const clampToLimits = (candidate) => {
      const aspect = candidate.h / candidate.w;
      const minW = baseViewBox.w * ZOOM_MIN_FACTOR;
      const maxW = baseViewBox.w * ZOOM_MAX_FACTOR;
      
      let w = candidate.w;
      if (w < minW) w = minW;
      if (w > maxW) w = maxW;
      
      return { x: candidate.x, y: candidate.y, w, h: w * aspect };
    };
    
    const panBy = (dx, dy) => {
      const current = getVB();
      setViewBox({ x: current.x + dx, y: current.y + dy, w: current.w, h: current.h });
    };
    
    const zoomAt = (factor, focusX, focusY) => {
      const current = getVB();
      const svgFocus = clientToSvg(focusX, focusY);
      
      const newW = current.w / factor;
      const newH = current.h / factor;
      const newX = svgFocus.x - (svgFocus.x - current.x) / factor;
      const newY = svgFocus.y - (svgFocus.y - current.y) / factor;
      
      const clamped = clampToLimits({ x: newX, y: newY, w: newW, h: newH });
      setViewBox(clamped);
    };
    
    // Wheel zoom
    svgEl.addEventListener("wheel", (e) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.95 : 1.05;
      zoomAt(factor, e.clientX, e.clientY);
    }, { passive: false });
    
    // Pan with mouse
    let isDragging = false;
    let lastX = 0, lastY = 0;
    
    svgEl.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      svgEl.style.cursor = "grabbing";
    });
    
    svgEl.addEventListener("pointermove", (e) => {
      if (!isDragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      
      const current = getVB();
      const scale = current.w / svgEl.clientWidth;
      panBy(-dx * scale, -dy * scale);
    });
    
    svgEl.addEventListener("pointerup", () => {
      isDragging = false;
      svgEl.style.cursor = "grab";
    });
    
    svgEl.addEventListener("pointerleave", () => {
      isDragging = false;
      svgEl.style.cursor = "grab";
    });
    
    svgEl.style.cursor = "grab";
  }
  
  attachZoomPan();
  
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
    finalScoreEl: ui.finalScoreEl || null,
    finalCountriesEl: ui.finalCountriesEl || null,
    finalCorrectEl: ui.finalCorrectEl || null,
    finalFirstTryEl: ui.finalFirstTryEl || null,
    finalSubtitleEl: ui.finalSubtitleEl || null,
  };
  
  // Create game instance
  const game = createOutlinesGame({ 
    ui: fullUI, 
    neighbors: NEIGHBORS,
    confetti,
    drawCountries,
    config: {
      singleRound,
      hideScoreUI: singleRound,
      onComplete: onComplete
    }
  });
  
  // Setup autocomplete with country names
  if (window.DATA && Array.isArray(window.DATA)) {
    console.log('Setting up autocomplete with', window.DATA.length, 'countries');
    const countryNames = window.DATA.map(c => c.country).filter(Boolean).sort();
    
    // Check if we need to create a datalist or use mobile autocomplete
    if (typeof window.initMobileAutocomplete === 'function') {
      // Mobile autocomplete (if available)
      console.log('Calling initMobileAutocomplete');
      window.initMobileAutocomplete(answerInput, countryNames);
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
  
  // Wire up input
  answerInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation(); // Prevent event from bubbling to button
      game.handleSubmit();
    }
  });
  
  submitBtn.addEventListener("click", () => {
    game.handleSubmit();
  });
  
  return {
    game,
    nextQ: () => game.nextQ(),
    reset: () => game.reset(),
    setCountry: (country) => game.setCountry(country),
  };
}
