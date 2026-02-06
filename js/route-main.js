import { createRouteGame } from "./route-game.js";
import { initConfetti } from "./confetti.js";
import { COUNTRY_ALIASES } from "./aliases.js";
import { loadGeoJSON } from "./geojson-loader.js";
import { RouteRenderer } from "./ui-components/route-renderer.js";
import { norm } from "./utils.js";

// Make aliases globally available for route-game.js
window.COUNTRY_ALIASES = COUNTRY_ALIASES;

// UI references
const ui = {
  map: document.getElementById("map"),
  answerInput: document.getElementById("answer"),
  submitBtn: document.getElementById("submit"),
  undoBtn: document.getElementById("undo"),
  showHintBtn: document.getElementById("showHint"),
  giveUpBtn: document.getElementById("giveUp"),
  scoreEl: document.getElementById("score"),
  optimalHintEl: document.getElementById("optimalHint"),
  routeEl: document.getElementById("route"),
  statusEl: document.getElementById("status"),
  hintEl: document.getElementById("hint"),
};

const confetti = initConfetti("confetti");
const initOverlay = document.getElementById("init-overlay");

if (initOverlay) {
  initOverlay.classList.remove("hidden");
  initOverlay.style.display = "flex";
}

// Load data
let WORLD = null;
let NEIGHBORS = null;
let routeRenderer = null;

const MAP_W = 600;
const MAP_H = 320;

// Draw countries with different colors for start/end/path
function drawCountries(countryList) {
  if (!routeRenderer) return;
  routeRenderer.drawRoute(countryList);
}

// Initialize data and game
async function loadData() {
  const [worldData, neighborsData] = await Promise.all([
    loadGeoJSON("data/ne_10m_admin_0_countries_route.geojson.gz"),
    fetch("data/countries-neighbors.json").then(r => r.json()),
  ]);
  
  WORLD = worldData.features;
  NEIGHBORS = neighborsData;
  
  // Create route renderer
  routeRenderer = new RouteRenderer(ui.map, worldData, {
    aliases: COUNTRY_ALIASES
  });
  
  // Populate autocomplete datalist with country names
  populateCountryAutocomplete();
  
  // Initialize mobile autocomplete (custom dropdown for mobile devices)
  initMobileAutocompleteForRoute();
  
  document.getElementById("init-overlay").style.display = "none";
}

// Populate datalist for autocomplete (desktop)
function populateCountryAutocomplete() {
  const datalist = document.getElementById("country-suggestions");
  if (!datalist) return;
  
  // Use window.DATA which contains only valid playable countries
  const countryNames = new Set();
  
  // Add all valid country names from DATA
  window.DATA.forEach(item => {
    if (item.country) {
      countryNames.add(item.country);
    }
  });
  
  // Add aliases to autocomplete as well (but only for valid countries)
  Object.entries(COUNTRY_ALIASES).forEach(([alias, officialName]) => {
    // Only add alias if it points to a country in our DATA
    const isValid = window.DATA.some(item => norm(item.country) === norm(officialName));
    if (isValid) {
      countryNames.add(alias);
    }
  });
  
  // Sort alphabetically and add to datalist
  const sortedNames = Array.from(countryNames).sort();
  sortedNames.forEach(name => {
    const option = document.createElement("option");
    option.value = name;
    datalist.appendChild(option);
  });
}

// Initialize mobile autocomplete (custom dropdown)
function initMobileAutocompleteForRoute() {
  const input = document.getElementById("answer");
  if (!input) return;
  
  // Always remove datalist - use custom autocomplete for all devices
  input.removeAttribute('list');
  
  if (typeof initMobileAutocomplete !== 'function') return;
  
  // Build suggestions array using window.DATA (only valid countries)
  const suggestions = [];
  
  // Add all valid country names from DATA
  window.DATA.forEach(item => {
    if (item.country) {
      suggestions.push(item.country);
    }
  });
  
  // Add all aliases (but only for valid countries)
  Object.entries(COUNTRY_ALIASES).forEach(([alias, officialName]) => {
    // Only add alias if it points to a country in our DATA
    const isValid = window.DATA.some(item => norm(item.country) === norm(officialName));
    if (isValid) {
      suggestions.push(alias);
    }
  });
  
  // Remove duplicates and sort
  const uniqueSuggestions = Array.from(new Set(suggestions)).sort();
  
  // Initialize mobile autocomplete
  initMobileAutocomplete(input, uniqueSuggestions, {
    maxSuggestions: null, // Show all matches (scrollable)
    minChars: 1
  });
}

// Add zoom and pan interactions
let baseViewBox = { x: 0, y: 0, w: MAP_W, h: MAP_H };

// Wrapper to track baseViewBox when drawing
const originalDrawCountries = drawCountries;
function drawCountriesWithZoom(countryList) {
  originalDrawCountries(countryList);
  // Capture the viewBox after drawing as the new base
  const vb = ui.map.viewBox.baseVal;
  baseViewBox = { x: vb.x, y: vb.y, w: vb.width, h: vb.height };
}

function attachZoomPan() {
  const svgEl = ui.map;

  // Helper to convert client coordinates to SVG coordinates
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

  // Prevent iOS Safari gesture zoom/rotate
  ["gesturestart", "gesturechange", "gestureend"].forEach((t) => {
    svgEl.addEventListener(t, (e) => e.preventDefault(), { passive: false });
  });

  // Zoom limits
  const ZOOM_MIN_FACTOR = 0.35;
  const ZOOM_MAX_FACTOR = 7.0;

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

    const h = w * aspect;
    let x = candidate.x + (candidate.w - w) / 2;
    let y = candidate.y + (candidate.h - h) / 2;
    
    // Constrain position to keep content visible
    const minVisibleMargin = Math.min(w, h) * 0.2;
    
    // Left boundary
    const maxPanRight = baseViewBox.x + baseViewBox.w - minVisibleMargin;
    if (x > maxPanRight) x = maxPanRight;
    
    // Right boundary
    const minPanLeft = baseViewBox.x - w + minVisibleMargin;
    if (x < minPanLeft) x = minPanLeft;
    
    // Top boundary
    const maxPanDown = baseViewBox.y + baseViewBox.h - minVisibleMargin;
    if (y > maxPanDown) y = maxPanDown;
    
    // Bottom boundary
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
    setViewBox(clampToLimits(cand));
  };

  // Wheel zoom (desktop)
  svgEl.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1.15 : 0.87;
      zoomAt(factor, e.clientX, e.clientY);
    },
    { passive: false }
  );

  // Pointer pan + pinch zoom (mobile + desktop)
  const pointers = new Map();
  let startVB = null;
  let panStart = null;
  let startDist = 0;

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  svgEl.style.touchAction = "none";

  svgEl.addEventListener(
    "pointerdown",
    (e) => {
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
    },
    { passive: false }
  );

  svgEl.addEventListener(
    "pointermove",
    (e) => {
      if (!pointers.has(e.pointerId) || !startVB) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      // One pointer => pan
      if (pointers.size === 1 && panStart) {
        const p = [...pointers.values()][0];

        const a = clientToSvg(panStart.x, panStart.y);
        const b = clientToSvg(p.x, p.y);

        const dx = a.x - b.x;
        const dy = a.y - b.y;
        
        let newX = startVB.x + dx;
        let newY = startVB.y + dy;
        
        // Constrain panning so route countries remain visible
        // Ensure the viewBox always overlaps with the content area (baseViewBox)
        const minVisibleMargin = Math.min(startVB.w, startVB.h) * 0.2;
        
        // Left boundary: can't pan so far right that content disappears off left edge
        const maxPanRight = baseViewBox.x + baseViewBox.w - minVisibleMargin;
        if (newX > maxPanRight) newX = maxPanRight;
        
        // Right boundary: can't pan so far left that content disappears off right edge
        const minPanLeft = baseViewBox.x - startVB.w + minVisibleMargin;
        if (newX < minPanLeft) newX = minPanLeft;
        
        // Top boundary: can't pan so far down that content disappears off top edge
        const maxPanDown = baseViewBox.y + baseViewBox.h - minVisibleMargin;
        if (newY > maxPanDown) newY = maxPanDown;
        
        // Bottom boundary: can't pan so far up that content disappears off bottom edge
        const minPanUp = baseViewBox.y - startVB.h + minVisibleMargin;
        if (newY < minPanUp) newY = minPanUp;

        setViewBox({ x: newX, y: newY, w: startVB.w, h: startVB.h });
        return;
      }

      // Two pointers => pinch zoom
      if (pointers.size === 2) {
        const pts = [...pointers.values()];
        const dNow = dist(pts[0], pts[1]);
        if (!startDist) return;

        const scale = dNow / startDist;
        const factor = 1 / scale;

        const m = mid(pts[0], pts[1]);
        const pMid = clientToSvg(m.x, m.y);
        const rx = (pMid.x - startVB.x) / startVB.w;
        const ry = (pMid.y - startVB.y) / startVB.h;

        const nw = startVB.w * factor;
        const nh = startVB.h * factor;

        const cand = { x: pMid.x - rx * nw, y: pMid.y - ry * nh, w: nw, h: nh };
        setViewBox(clampToLimits(cand));
      }
    },
    { passive: false }
  );

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
    }
  };

  svgEl.addEventListener("pointerup", endPointer);
  svgEl.addEventListener("pointercancel", () => {
    pointers.clear();
    startVB = null;
    panStart = null;
    startDist = 0;
  });
}

// Initialize game
try {
  await loadData();
} catch (err) {
  console.error("Data load failed:", err);
}

const game = createRouteGame({ 
  ui, 
  neighbors: NEIGHBORS,
  confetti,
  drawCountries: drawCountriesWithZoom,
  getCountryFeature: (countryName) => {
    return WORLD.find(f => norm(f.properties.ADMIN) === norm(countryName));
  }
});

// Event listeners
ui.submitBtn?.addEventListener("click", () => {
  const guess = ui.answerInput.value.trim();
  if (guess) {
    game.processGuess(guess);
  }
});

ui.answerInput?.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    const guess = ui.answerInput.value.trim();
    if (guess) {
      game.processGuess(guess);
    }
  }
});

ui.giveUpBtn?.addEventListener("click", () => {
  game.giveUp();
});

ui.undoBtn?.addEventListener("click", () => {
  game.undo();
});

ui.showHintBtn?.addEventListener("click", () => {
  game.showHint();
});

// Keyboard navigation: Escape to close modals
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const finalOverlay = document.getElementById("finalOverlay");
    if (finalOverlay && finalOverlay.style.display !== "none") {
      finalOverlay.style.display = "none";
    }
  }
});

// Attach zoom/pan interactions
attachZoomPan();

// Start the game
game.start();

// Hide init overlay
if (initOverlay) {
  setTimeout(() => {
    initOverlay.style.display = "none";
  }, 100);
}
