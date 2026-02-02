import { createRouteGame } from "./route-game.js";
import { initConfetti } from "./confetti.js";
import { norm } from "./utils.js";
import { COUNTRY_ALIASES } from "./aliases.js";
import { loadGeoJSON } from "./geojson-loader.js";

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

// Helper to get CSS variable values
function getCSSVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

if (initOverlay) {
  initOverlay.classList.remove("hidden");
  initOverlay.style.display = "flex";
}

// Load data
let WORLD = null;
let NEIGHBORS = null;

const MAP_W = 600;
const MAP_H = 320;

// Normalize longitude to -180 to +180 range
const normalizeLon = (lon) => {
  while (lon > 180) lon -= 360;
  while (lon < -180) lon += 360;
  return lon;
};

const proj = ([lon, lat]) => {
  const normalizedLon = normalizeLon(lon);
  return [((normalizedLon + 180) / 360) * MAP_W, ((90 - lat) / 180) * MAP_H];
};

function pathFromFeature(f) {
  if (!f.geometry) return "";
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  let d = "";
  for (const poly of polys) {
    for (const ring of poly) {
      // Check if ring crosses antimeridian (large lon jumps)
      let prevLon = null;
      let currentPath = [];
      
      for (let i = 0; i < ring.length; i++) {
        const [lon, lat] = ring[i];
        const normalizedLon = normalizeLon(lon);
        
        // Detect wraparound (jump > 180 degrees)
        if (prevLon !== null && Math.abs(normalizedLon - prevLon) > 180) {
          // Finish current path
          if (currentPath.length > 0) {
            currentPath.forEach(([x, y], j) => {
              d += (j ? "L" : "M") + x + " " + y + " ";
            });
            currentPath = [];
          }
        }
        
        const [x, y] = proj([lon, lat]);
        currentPath.push([x, y]);
        prevLon = normalizedLon;
      }
      
      // Finish remaining path
      if (currentPath.length > 0) {
        currentPath.forEach(([x, y], i) => {
          d += (i ? "L" : "M") + x + " " + y + " ";
        });
        d += "Z ";
      }
    }
  }
  return d;
}

function bboxOfFeatureLonLat(f) {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;

  const rings = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  
  // First pass: collect all coordinates
  const coords = [];
  for (const poly of rings) {
    for (const ring of poly) {
      for (const [lon, lat] of ring) {
        coords.push([lon, lat]);
      }
    }
  }
  
  // Check if this feature crosses the antimeridian by looking for large longitude jumps
  let crossesAntimeridian = false;
  for (let i = 1; i < coords.length; i++) {
    if (Math.abs(coords[i][0] - coords[i-1][0]) > 180) {
      crossesAntimeridian = true;
      break;
    }
  }
  
  // Calculate bbox based on whether feature crosses antimeridian
  if (crossesAntimeridian) {
    // For antimeridian-crossing features, shift all negative longitudes by 360
    // This makes them all positive (e.g., -170 becomes 190)
    for (const [lon, lat] of coords) {
      const adjustedLon = lon < 0 ? lon + 360 : lon;
      if (adjustedLon < minLon) minLon = adjustedLon;
      if (lat < minLat) minLat = lat;
      if (adjustedLon > maxLon) maxLon = adjustedLon;
      if (lat > maxLat) maxLat = lat;
    }
    // Convert back to -180 to 180 range
    if (minLon > 180) minLon -= 360;
    if (maxLon > 180) maxLon -= 360;
  } else {
    // Normal case: just use normalized coordinates
    for (const [lon, lat] of coords) {
      const normalizedLon = normalizeLon(lon);
      if (normalizedLon < minLon) minLon = normalizedLon;
      if (lat < minLat) minLat = lat;
      if (normalizedLon > maxLon) maxLon = normalizedLon;
      if (lat > maxLat) maxLat = lat;
    }
  }
  
  return { minLon, minLat, maxLon, maxLat };
}

function padBBox(bb, padRatio = 0.18) {
  const dLon = bb.maxLon - bb.minLon;
  const dLat = bb.maxLat - bb.minLat;
  return {
    minLon: bb.minLon - dLon * padRatio,
    maxLon: bb.maxLon + dLon * padRatio,
    minLat: bb.minLat - dLat * padRatio,
    maxLat: bb.maxLat + dLat * padRatio,
  };
}

// Draw countries with different colors for start/end/path
function drawCountries(countryList) {
  ui.map.innerHTML = "";

  if (!WORLD) return;

  const colorMap = {
    start: {
      fill: getCSSVar('--color-green') || 'rgba(34, 197, 94, 0.3)',
      stroke: getCSSVar('--color-green') || 'rgba(34, 197, 94, 0.8)',
    },
    end: {
      fill: getCSSVar('--color-orange') || 'rgba(249, 115, 22, 0.3)',
      stroke: getCSSVar('--color-orange') || 'rgba(249, 115, 22, 0.8)',
    },
    path: {
      fill: getCSSVar('--color-blue') || 'rgba(59, 130, 246, 0.3)',
      stroke: getCSSVar('--color-blue') || 'rgba(59, 130, 246, 0.8)',
    },
    hint: {
      fill: 'rgba(251, 191, 36, 0.2)',
      stroke: 'rgba(251, 191, 36, 0.6)',
      strokeDasharray: '5,5',
    },
    optimal: {
      fill: 'rgba(250, 204, 21, 0.25)',
      stroke: 'rgba(250, 204, 21, 0.9)',
      strokeWidth: '2',
    },
  };

  // Collect all highlighted country features and calculate bounding box
  const highlightedFeatures = [];
  let bbox = null;

  for (const item of countryList) {
    const mapName = COUNTRY_ALIASES[item.country] || item.country;
    const features = WORLD.filter((f) => norm(f.properties.ADMIN || "") === norm(mapName));
    
    for (const feature of features) {
      highlightedFeatures.push({ feature, color: item.color });
      
      // Calculate combined bounding box
      const bb = bboxOfFeatureLonLat(feature);
      if (!bbox) {
        bbox = bb;
      } else {
        bbox = {
          minLon: Math.min(bbox.minLon, bb.minLon),
          minLat: Math.min(bbox.minLat, bb.minLat),
          maxLon: Math.max(bbox.maxLon, bb.maxLon),
          maxLat: Math.max(bbox.maxLat, bb.maxLat),
        };
      }
    }
  }

  // Set viewBox to fit highlighted countries
  if (bbox) {
    bbox = padBBox(bbox, 0.18);
    const [x1, y1] = proj([bbox.minLon, bbox.maxLat]);
    const [x2, y2] = proj([bbox.maxLon, bbox.minLat]);
    
    // Ensure width and height are always positive (handle edge cases)
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    
    ui.map.setAttribute("viewBox", `${x} ${y} ${width} ${height}`);
  } else {
    ui.map.setAttribute("viewBox", `0 0 ${MAP_W} ${MAP_H}`);
  }

  // Only draw highlighted countries (no background map)
  for (const item of highlightedFeatures) {
    const colors = colorMap[item.color] || colorMap.path;
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", pathFromFeature(item.feature));
    p.setAttribute("stroke", colors.stroke);
    p.setAttribute("stroke-width", colors.strokeWidth || "1.2");
    p.setAttribute("fill", colors.fill);
    p.setAttribute("vector-effect", "non-scaling-stroke");
    if (colors.strokeDasharray) {
      p.setAttribute("stroke-dasharray", colors.strokeDasharray);
    }
    ui.map.appendChild(p);
  }
}

// Initialize data and game
async function loadData() {
  const [worldData, neighborsData] = await Promise.all([
    loadGeoJSON("data/ne_10m_admin_0_countries_route.geojson.gz"),
    fetch("data/countries-neighbors.json").then(r => r.json()),
  ]);
  
  WORLD = worldData.features;
  NEIGHBORS = neighborsData;
  
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

// Initialize mobile autocomplete (custom dropdown)
function initMobileAutocompleteForRoute() {
  const input = document.getElementById("answer");
  if (!input || typeof initMobileAutocomplete !== 'function') return;
  
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
  
  // Initialize mobile autocomplete
  initMobileAutocomplete(input, uniqueSuggestions, {
    maxSuggestions: 8,
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
