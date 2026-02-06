import { createOutlinesGame } from "./outlines-game.js";
import { initConfetti } from "./confetti.js";
import { norm } from "./utils.js";
import { COUNTRY_ALIASES } from "./aliases.js";
import { loadGeoJSON } from "./geojson-loader.js";
import { OutlinesRenderer } from "./ui-components/outlines-renderer.js";

// Make aliases globally available for outlines-game.js
window.COUNTRY_ALIASES = COUNTRY_ALIASES;

// UI references
const ui = {
  map: document.getElementById("map"),
  answerInput: document.getElementById("answer"),
  submitBtn: document.getElementById("submit"),
  scoreEl: document.getElementById("score"),
  progressEl: document.getElementById("progress"),
  statusEl: document.getElementById("status"),
  finalOverlay: document.getElementById("finalOverlay"),
  finalScoreEl: document.getElementById("finalScore"),
  finalCountriesEl: document.getElementById("finalCountries"),
  finalCorrectEl: document.getElementById("finalCorrect"),
  finalFirstTryEl: document.getElementById("finalFirstTry"),
  finalSubtitleEl: document.getElementById("finalSubtitle"),
  playAgainBtn: document.getElementById("playAgain"),
  closeFinalBtn: document.getElementById("closeFinal"),
  shareScoreBtn: document.getElementById("shareScore"),
};

const confetti = initConfetti("confetti");
const initOverlay = document.getElementById("init-overlay");

// Share score function
async function shareScore(score, total, gameName) {
  const text = `I scored ${score}/${total} in ${gameName}! 🌍 Can you beat my score?`;
  const url = window.location.href;
  
  if (navigator.share) {
    // Use native share API on mobile
    try {
      await navigator.share({ text, url });
    } catch (err) {
      // User cancelled or error - do nothing
      if (err.name !== 'AbortError') {
        console.log('Share failed:', err);
      }
    }
  } else {
    // Fallback to clipboard on desktop
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      alert('Score copied to clipboard! 📋');
    } catch (err) {
      // Show share text in prompt as last resort
      prompt('Copy this to share:', `${text}\n${url}`);
    }
  }
}

if (initOverlay) {
  initOverlay.classList.remove("hidden");
  initOverlay.style.display = "flex";
}

// Load data
let WORLD = null;
let NEIGHBORS = null;
let renderer = null;

// Add zoom and pan interactions
let baseViewBox = { x: 0, y: 0, w: 600, h: 320 };

// Draw countries wrapper using shared renderer
function drawCountries(targetCountry, neighborCountries) {
  if (renderer) {
    renderer.drawCountries(targetCountry, neighborCountries);
    // Update baseViewBox for pan/zoom
    baseViewBox = renderer.getViewBox();
  }
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

    const h = w * aspect;
    const cx = candidate.x + candidate.w / 2;
    const cy = candidate.y + candidate.h / 2;

    return { x: cx - w / 2, y: cy - h / 2, w, h };
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

        setViewBox({ x: startVB.x + dx, y: startVB.y + dy, w: startVB.w, h: startVB.h });
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

// Initialize data and game
async function loadData() {
  const [worldData, neighborsData] = await Promise.all([
    loadGeoJSON("data/ne_10m_admin_0_countries.geojson.gz"),
    fetch("data/countries-neighbors.json").then(r => r.json()),
  ]);
  
  WORLD = worldData.features;
  NEIGHBORS = neighborsData;
  
  // Create renderer with loaded data
  renderer = new OutlinesRenderer(ui.map, WORLD, {
    aliases: COUNTRY_ALIASES
  });
}

// Initialize game
try {
  await loadData();
} catch (err) {
  console.error("Data load failed:", err);
}

const game = createOutlinesGame({ 
  ui, 
  neighbors: NEIGHBORS,
  confetti,
  drawCountries,
});

ui.playAgainBtn?.addEventListener("click", () => {
  ui.finalOverlay.style.display = "none";
  game.reset();
  game.nextQ();
});

ui.closeFinalBtn?.addEventListener("click", () => {
  ui.finalOverlay.style.display = "none";
});

ui.shareScoreBtn?.addEventListener("click", () => {
  const score = parseInt(ui.finalScoreEl.textContent) || 0;
  const total = parseInt(ui.finalCountriesEl.textContent) || 0;
  shareScore(score, total, "Guess the Country (GeoQuiz)");
});

// Keyboard navigation: Escape to close modals
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (ui.finalOverlay && ui.finalOverlay.style.display !== "none") {
      ui.finalOverlay.style.display = "none";
    }
  }
});

// Attach zoom/pan interactions
attachZoomPan();

// Start the game
game.reset();
game.nextQ();

// Populate autocomplete datalist for desktop
populateCountryAutocomplete();

// Initialize mobile autocomplete
initMobileAutocompleteForOutlines();

// Hide init overlay
if (initOverlay) {
  setTimeout(() => {
    initOverlay.style.display = "none";
  }, 100);
}

// Populate datalist for autocomplete (desktop browsers)
function populateCountryAutocomplete() {
  const datalist = document.getElementById("country-suggestions");
  if (!datalist) return;
  
  // Get unique country names from WORLD data
  const countryNames = new Set();
  WORLD.forEach(feature => {
    const name = feature.properties.ADMIN;
    if (name) {
      countryNames.add(name);
    }
  });
  
  // Add aliases to autocomplete as well
  Object.keys(COUNTRY_ALIASES).forEach(alias => {
    countryNames.add(alias);
  });
  
  // Sort alphabetically and add to datalist
  const sortedNames = Array.from(countryNames).sort();
  sortedNames.forEach(name => {
    const option = document.createElement("option");
    option.value = name;
    datalist.appendChild(option);
  });
}

// Function to initialize mobile autocomplete
function initMobileAutocompleteForOutlines() {
  const input = document.getElementById("answer");
  if (!input) {
    console.warn('Autocomplete: input element "answer" not found');
    return;
  }
  
  // Always remove datalist - use custom autocomplete for all devices
  input.removeAttribute('list');
  
  if (typeof initMobileAutocomplete !== 'function') {
    console.warn('Autocomplete: initMobileAutocomplete function not available');
    return;
  }
  
  if (!WORLD || WORLD.length === 0) {
    console.warn('Autocomplete: WORLD data not loaded');
    return;
  }
  
  // Build suggestions array (countries + aliases)
  const suggestions = [];
  
  // Add all country names
  WORLD.forEach(feature => {
    const name = feature.properties.ADMIN;
    if (name) {
      suggestions.push(name);
    }
  });
  
  // Add all aliases
  Object.keys(COUNTRY_ALIASES).forEach(alias => {
    suggestions.push(alias);
  });
  
  // Remove duplicates and sort
  const uniqueSuggestions = Array.from(new Set(suggestions)).sort();
  
  console.log(`Initializing autocomplete with ${uniqueSuggestions.length} suggestions`);
  
  // Initialize mobile autocomplete
  initMobileAutocomplete(input, uniqueSuggestions, {
    maxSuggestions: null, // Show all matches (scrollable)
    minChars: 1
  });
}
