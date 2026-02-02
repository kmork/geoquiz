import { createFindCountryGame } from "./find-country-game.js";
import { initConfetti } from "./confetti.js";
import { norm } from "./utils.js";
import { COUNTRY_ALIASES } from "./aliases.js";
import { attachWikipediaPopup } from "./wiki.js";

// Helper to get CSS variable values
function getCSSVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// UI references
const ui = {
  map: document.getElementById("map"),
  countryNameEl: document.getElementById("countryName"),
  scoreEl: document.getElementById("score"),
  progressEl: document.getElementById("progress"),
  finalOverlay: document.getElementById("finalOverlay"),
  finalScoreEl: document.getElementById("finalScore"),
  finalCountriesEl: document.getElementById("finalCountries"),
  finalCorrectEl: document.getElementById("finalCorrect"),
  finalAccuracyEl: document.getElementById("finalAccuracy"),
  finalSubtitleEl: document.getElementById("finalSubtitle"),
  playAgainBtn: document.getElementById("playAgain"),
  closeFinalBtn: document.getElementById("closeFinal"),
};

const confetti = initConfetti("confetti");
const initOverlay = document.getElementById("init-overlay");

if (initOverlay) {
  initOverlay.classList.remove("hidden");
  initOverlay.style.display = "flex";
}

// Load data
let WORLD = null;

const MAP_W = 600;
const MAP_H = 320;

const proj = ([lon, lat]) => [((lon + 180) / 360) * MAP_W, ((90 - lat) / 180) * MAP_H];

function pathFromFeature(f) {
  if (!f.geometry) return "";
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  let d = "";
  for (const poly of polys) {
    for (const ring of poly) {
      ring.forEach(([lon, lat], i) => {
        const [x, y] = proj([lon, lat]);
        d += (i ? "L" : "M") + x + " " + y + " ";
      });
      d += "Z ";
    }
  }
  return d;
}

// Draw entire world map
function drawWorldMap() {
  ui.map.innerHTML = "";

  if (!WORLD) return;

  // Set viewBox to full world
  ui.map.setAttribute("viewBox", `0 0 ${MAP_W} ${MAP_H}`);

  // Draw all countries
  for (const f of WORLD) {
    const d = pathFromFeature(f);
    if (!d) continue;
    
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", d);
    p.setAttribute("stroke", getCSSVar('--map-country-stroke') || "rgba(232,236,255,.3)");
    p.setAttribute("stroke-width", "0.5");
    p.setAttribute("fill", getCSSVar('--map-country-fill') || "rgba(165,180,252,.08)");
    p.setAttribute("vector-effect", "non-scaling-stroke");
    p.setAttribute("class", "country-path");
    p.style.cursor = "pointer";
    
    // Store country name for click detection
    const countryName = f.properties.ADMIN || "";
    p.setAttribute("data-country", countryName);
    
    // Hover effect
    p.addEventListener("mouseenter", () => {
      if (!game || game.getCurrent() === "") return;
      p.setAttribute("fill", "rgba(165,180,252,.18)");
    });
    p.addEventListener("mouseleave", () => {
      if (!game || game.getCurrent() === "") return;
      // Only reset if not highlighted
      if (!p.hasAttribute("data-highlighted")) {
        p.setAttribute("fill", "rgba(165,180,252,.08)");
      }
    });
    
    ui.map.appendChild(p);
  }
}

// Check which country was clicked
function checkClickedCountry(svgX, svgY) {
  // Find which country polygon contains this point
  const paths = ui.map.querySelectorAll(".country-path");
  
  // First try exact point-in-polygon detection
  for (const path of paths) {
    const bbox = path.getBBox();
    // Quick bounding box check first
    if (svgX < bbox.x || svgX > bbox.x + bbox.width ||
        svgY < bbox.y || svgY > bbox.y + bbox.height) {
      continue;
    }
    
    // More precise point-in-polygon check using SVG isPointInFill
    const pt = ui.map.createSVGPoint();
    pt.x = svgX;
    pt.y = svgY;
    
    if (path.isPointInFill(pt)) {
      const countryName = path.getAttribute("data-country");
      
      // Find matching country in DATA using aliases
      const dataCountries = window.DATA.map(d => d.country);
      for (const dc of dataCountries) {
        const alias = COUNTRY_ALIASES[dc] || dc;
        if (norm(alias) === norm(countryName)) {
          return dc;
        }
      }
      
      return countryName;
    }
  }
  
  // If no exact hit, check for nearby small countries
  // This helps with microstates and small islands
  const SMALL_COUNTRY_THRESHOLD = 50; // SVG units - countries with bbox < this are "small"
  const PROXIMITY_THRESHOLD = 30; // SVG units - how close the click needs to be
  
  let nearestSmallCountry = null;
  let nearestDistance = Infinity;
  
  for (const path of paths) {
    const bbox = path.getBBox();
    const size = Math.max(bbox.width, bbox.height);
    
    // Only check small countries
    if (size > SMALL_COUNTRY_THRESHOLD) continue;
    
    // Calculate distance from click to center of country bbox
    const centerX = bbox.x + bbox.width / 2;
    const centerY = bbox.y + bbox.height / 2;
    const distance = Math.sqrt(Math.pow(svgX - centerX, 2) + Math.pow(svgY - centerY, 2));
    
    if (distance < nearestDistance && distance < PROXIMITY_THRESHOLD) {
      nearestDistance = distance;
      
      const countryName = path.getAttribute("data-country");
      
      // Find matching country in DATA using aliases
      const dataCountries = window.DATA.map(d => d.country);
      for (const dc of dataCountries) {
        const alias = COUNTRY_ALIASES[dc] || dc;
        if (norm(alias) === norm(countryName)) {
          nearestSmallCountry = dc;
          break;
        }
      }
      
      if (!nearestSmallCountry) {
        nearestSmallCountry = countryName;
      }
    }
  }
  
  return nearestSmallCountry;
}

// Highlight a country (selected/correct/wrong)
function highlightCountry(countryName, type) {
  const paths = ui.map.querySelectorAll(".country-path");
  
  // Clear previous highlights
  paths.forEach(p => {
    p.removeAttribute("data-highlighted");
    p.setAttribute("fill", getCSSVar('--map-country-fill') || "rgba(165,180,252,.08)");
    p.setAttribute("stroke", getCSSVar('--map-country-stroke') || "rgba(232,236,255,.3)");
  });
  
  const mapName = COUNTRY_ALIASES[countryName] || countryName;
  
  // Find and highlight the target country
  for (const path of paths) {
    const pathCountry = path.getAttribute("data-country");
    if (norm(pathCountry) === norm(mapName)) {
      path.setAttribute("data-highlighted", "true");
      
      if (type === "selected") {
        // Blue highlight for first click (selection)
        path.setAttribute("fill", getCSSVar('--map-selected-fill') || "rgba(165, 180, 252, 0.35)");
        path.setAttribute("stroke", getCSSVar('--map-selected-stroke') || "rgba(165, 180, 252, 0.95)");
        path.setAttribute("stroke-width", "1.5");
      } else if (type === "correct") {
        path.setAttribute("fill", getCSSVar('--map-correct-fill') || "rgba(110, 231, 183, 0.5)");
        path.setAttribute("stroke", getCSSVar('--map-correct-stroke') || "rgba(110, 231, 183, 0.95)");
        path.setAttribute("stroke-width", "1.2");
      } else if (type === "wrong") {
        path.setAttribute("fill", getCSSVar('--map-wrong-fill') || "rgba(252, 165, 161, 0.5)");
        path.setAttribute("stroke", getCSSVar('--map-wrong-stroke') || "rgba(252, 165, 161, 0.95)");
        path.setAttribute("stroke-width", "1.2");
      }
    }
  }
}

// Get bounding box for a country
function getCountryBBox(countryName) {
  const mapName = COUNTRY_ALIASES[countryName] || countryName;
  const features = WORLD.filter((f) => norm(f.properties.ADMIN || "") === norm(mapName));
  
  if (features.length === 0) return null;
  
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  
  for (const f of features) {
    const rings = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const poly of rings) {
      for (const ring of poly) {
        for (const [lon, lat] of ring) {
          if (lon < minLon) minLon = lon;
          if (lat < minLat) minLat = lat;
          if (lon > maxLon) maxLon = lon;
          if (lat > maxLat) maxLat = lat;
        }
      }
    }
  }
  
  return { minLon, minLat, maxLon, maxLat };
}

// Zoom map to show both countries
function zoomToCountries(country1, country2) {
  const bbox1 = getCountryBBox(country1);
  const bbox2 = getCountryBBox(country2);
  
  if (!bbox1 || !bbox2) return;
  
  // Combine bounding boxes
  const combinedBBox = {
    minLon: Math.min(bbox1.minLon, bbox2.minLon),
    minLat: Math.min(bbox1.minLat, bbox2.minLat),
    maxLon: Math.max(bbox1.maxLon, bbox2.maxLon),
    maxLat: Math.max(bbox1.maxLat, bbox2.maxLat),
  };
  
  // Add padding (20%)
  const dLon = combinedBBox.maxLon - combinedBBox.minLon;
  const dLat = combinedBBox.maxLat - combinedBBox.minLat;
  const padRatio = 0.2;
  
  combinedBBox.minLon -= dLon * padRatio;
  combinedBBox.maxLon += dLon * padRatio;
  combinedBBox.minLat -= dLat * padRatio;
  combinedBBox.maxLat += dLat * padRatio;
  
  // Convert to SVG coordinates
  const [x1, y1] = proj([combinedBBox.minLon, combinedBBox.maxLat]);
  const [x2, y2] = proj([combinedBBox.maxLon, combinedBBox.minLat]);
  
  // Set viewBox
  ui.map.setAttribute("viewBox", `${x1} ${y1} ${x2 - x1} ${y2 - y1}`);
}

// Clear highlights but keep current zoom/pan
function resetMapView() {
  // Clear all highlights (but keep current zoom level)
  const paths = ui.map.querySelectorAll(".country-path");
  paths.forEach(p => {
    p.removeAttribute("data-highlighted");
    p.setAttribute("fill", getCSSVar('--map-country-fill') || "rgba(165,180,252,.08)");
    p.setAttribute("stroke", getCSSVar('--map-country-stroke') || "rgba(232,236,255,.3)");
    p.setAttribute("stroke-width", "0.5");
  });
}

// Load all data
async function loadData() {
  const worldData = await fetch("data/ne_10m_admin_0_countries.geojson").then(r => r.json());
  WORLD = worldData.features;
}

// Initialize data and game
let game = null;

try {
  await loadData();
} catch (err) {
  console.error("Data load failed:", err);
}

// Draw the world map
drawWorldMap();

// Create game instance
game = createFindCountryGame({ 
  ui, 
  confetti,
  checkClickedCountry,
  highlightCountry,
  zoomToCountries,
  resetMapView,
});

// Attach Wikipedia popup to country name
attachWikipediaPopup(ui.countryNameEl, () => game.getCurrent());

// Handle map clicks
ui.map.addEventListener("click", (e) => {
  const pt = ui.map.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  
  const ctm = ui.map.getScreenCTM();
  if (!ctm) return;
  
  const svgPt = pt.matrixTransform(ctm.inverse());
  const clickedCountry = checkClickedCountry(svgPt.x, svgPt.y);
  
  if (clickedCountry) {
    game.handleMapClick(clickedCountry);
  }
});

// Add zoom and pan functionality
function attachZoomPan() {
  const svgEl = ui.map;
  const baseViewBox = { x: 0, y: 0, w: MAP_W, h: MAP_H };

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

  // Zoom limits (lower ZOOM_MIN_FACTOR = more zoom in possible)
  const ZOOM_MIN_FACTOR = 0.01;  // Allow zooming in 100x for tiny countries
  const ZOOM_MAX_FACTOR = 1.0;   // Don't zoom out beyond full world view

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
    
    // When at full world view (maxW), lock the center - no panning allowed
    if (w >= maxW) {
      // Lock to center of world
      const cx = baseViewBox.x + baseViewBox.w / 2;
      const cy = baseViewBox.y + baseViewBox.h / 2;
      return { x: cx - w / 2, y: cy - h / 2, w, h };
    }
    
    // When zoomed in, allow panning but keep world partially visible
    let cx = candidate.x + candidate.w / 2;
    let cy = candidate.y + candidate.h / 2;
    
    const minCX = baseViewBox.x + w / 2;
    const maxCX = baseViewBox.x + baseViewBox.w - w / 2;
    const minCY = baseViewBox.y + h / 2;
    const maxCY = baseViewBox.y + baseViewBox.h - h / 2;
    
    if (cx < minCX) cx = minCX;
    if (cx > maxCX) cx = maxCX;
    if (cy < minCY) cy = minCY;
    if (cy > maxCY) cy = maxCY;

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

ui.playAgainBtn?.addEventListener("click", () => {
  ui.finalOverlay.style.display = "none";
  drawWorldMap();
  game.reset();
  game.nextQ();
});

ui.closeFinalBtn?.addEventListener("click", () => {
  ui.finalOverlay.style.display = "none";
});

// Attach zoom/pan interactions
attachZoomPan();

// Start the game
game.reset();
game.nextQ();

// Hide init overlay
if (initOverlay) {
  setTimeout(() => {
    initOverlay.style.display = "none";
  }, 100);
}
