import { createOutlinesGame } from "./outlines-game.js";
import { initConfetti } from "./confetti.js";
import { norm } from "./utils.js";
import { COUNTRY_ALIASES } from "./aliases.js";

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

function bboxOfFeatureLonLat(f) {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;

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

function drawCountries(targetCountry, neighborCountries) {
  ui.map.innerHTML = "";

  if (!WORLD) return;

  // Find target country features
  const mapName = COUNTRY_ALIASES[targetCountry] || targetCountry;
  const targetFeatures = WORLD.filter((f) => norm(f.properties.ADMIN || "") === norm(mapName));

  if (targetFeatures.length === 0) {
    ui.map.setAttribute("viewBox", `0 0 ${MAP_W} ${MAP_H}`);
    return;
  }

  // Calculate combined bounding box for target + neighbors
  let bb = bboxOfFeatureLonLat(targetFeatures[0]);
  for (let i = 1; i < targetFeatures.length; i++) {
    const b = bboxOfFeatureLonLat(targetFeatures[i]);
    bb = {
      minLon: Math.min(bb.minLon, b.minLon),
      minLat: Math.min(bb.minLat, b.minLat),
      maxLon: Math.max(bb.maxLon, b.maxLon),
      maxLat: Math.max(bb.maxLat, b.maxLat),
    };
  }

  // Include neighbor countries in bounding box
  const neighborFeatures = [];
  for (const neighborCountry of neighborCountries) {
    const neighborMapName = COUNTRY_ALIASES[neighborCountry] || neighborCountry;
    const features = WORLD.filter((f) => norm(f.properties.ADMIN || "") === norm(neighborMapName));
    neighborFeatures.push(...features);
    
    for (const f of features) {
      const b = bboxOfFeatureLonLat(f);
      bb = {
        minLon: Math.min(bb.minLon, b.minLon),
        minLat: Math.min(bb.minLat, b.minLat),
        maxLon: Math.max(bb.maxLon, b.maxLon),
        maxLat: Math.max(bb.maxLat, b.maxLat),
      };
    }
  }

  bb = padBBox(bb, 0.18);

  // Set viewBox
  const [x1, y1] = proj([bb.minLon, bb.maxLat]);
  const [x2, y2] = proj([bb.maxLon, bb.minLat]);
  ui.map.setAttribute("viewBox", `${x1} ${y1} ${x2 - x1} ${y2 - y1}`);

  // Draw neighbor countries (lighter highlight)
  for (const f of neighborFeatures) {
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", pathFromFeature(f));
    p.setAttribute("stroke", getCSSVar('--map-country-stroke-neighbor') || "rgba(232,236,255,.5)");
    p.setAttribute("stroke-width", "0.6");
    p.setAttribute("fill", getCSSVar('--map-country-fill') || "rgba(165,180,252,.08)");
    p.setAttribute("vector-effect", "non-scaling-stroke");
    ui.map.appendChild(p);
  }

  // Draw target country (main highlight)
  for (const f of targetFeatures) {
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", pathFromFeature(f));
    p.setAttribute("stroke", getCSSVar('--map-country-stroke-highlight') || "rgba(232,236,255,.95)");
    p.setAttribute("stroke-width", "0.8");
    p.setAttribute("fill", getCSSVar('--map-country-fill-highlight') || "rgba(165,180,252,.25)");
    p.setAttribute("vector-effect", "non-scaling-stroke");
    ui.map.appendChild(p);
  }
}

// Add zoom and pan interactions
let baseViewBox = { x: 0, y: 0, w: MAP_W, h: MAP_H };

// Wrapper to track baseViewBox when drawing
const originalDrawCountries = drawCountries;
function drawCountriesWithZoom(country, neighbors) {
  originalDrawCountries(country, neighbors);
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

// Initialize data and game
async function loadData() {
  const [worldData, neighborsData] = await Promise.all([
    fetch("data/ne_10m_admin_0_countries.geojson").then(r => r.json()),
    fetch("data/countries-neighbors.json").then(r => r.json()),
  ]);
  
  WORLD = worldData.features;
  NEIGHBORS = neighborsData;
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
  drawCountries: drawCountriesWithZoom,
});

ui.playAgainBtn?.addEventListener("click", () => {
  ui.finalOverlay.style.display = "none";
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
