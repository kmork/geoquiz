/**
 * Find Country - Complete Game Factory
 * Creates a fully functional Find Country game with canvas, pan/zoom, and event handling
 * Used by both standalone game and Daily Challenge
 */

import { createFindCountryGame } from "./find-country-game.js";
import { initConfetti } from "./confetti.js";
import { norm } from "./utils.js";
import { loadGeoJSON } from "./geojson-loader.js";
import {
  MAP_W, MAP_H, proj, getCSSVar,
  buildCountryPaths, buildNameLookups,
  checkClickedCountry as engineCheckClicked,
  drawCountry, visibleOffsets,
  setupCanvas, createPanZoom,
} from "./canvas-map-engine.js";

/**
 * Create a complete Find Country game instance
 * @param {Object} config Configuration
 * @param {HTMLElement} config.container - Container element
 * @param {HTMLCanvasElement} config.canvas - Canvas element
 * @param {HTMLElement} config.countryNameEl - Element to show country name
 * @param {Object} [config.ui] - Additional UI elements (scoreEl, progressEl, etc.)
 * @param {Object} [config.confetti] - Confetti instance
 * @param {boolean} [config.singleRound=false] - Single round mode for Daily Challenge
 * @param {Function} [config.onComplete] - Callback when game completes
 * @param {number} [config.timeLimit] - Time limit in seconds (for Daily Challenge)
 * @returns {Promise<Object>} Game instance
 */
export async function createCompleteMap({
  container,
  canvas,
  countryNameEl,
  ui = {},
  confetti: confettiInstance,
  singleRound = false,
  onComplete,
  timeLimit,
  maxRounds = 10,
  gameIdSuffix = 'short',
  continent = null,
}) {

  // Canvas setup
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;

  let canvasDisplayWidth = 600;
  let canvasDisplayHeight = 320;

  // Viewport state — shared with pan/zoom engine
  const viewport = { scrollX: 0, scrollY: 0, zoom: 1, minZoom: 1, velocityX: 0, velocityY: 0 };

  // Highlighted country state
  let highlightedCountry = null;
  let highlightType = null;
  let hoverCountry = null;

  // Load data
  const worldData = await loadGeoJSON("data/ne_10m_admin_0_countries.geojson.gz");
  const WORLD = worldData.features;

  // Build lookup: norm(GeoJSON ADMIN) → feature.properties (used for hints)
  const geoPropsMap = new Map();
  for (const feature of WORLD) {
    const admin = feature.properties.ADMIN || "";
    if (admin) geoPropsMap.set(norm(admin), feature.properties);
  }

  // Build preprocessed country paths
  const { countryPaths, hitTestPaths, microCountries } = buildCountryPaths(WORLD);

  // Build name lookups
  const { dataToGeo, resolveToDataName } = buildNameLookups(countryPaths);

  // Build neighbors lookup from unified window.DATA
  const neighborsData = Object.fromEntries((window.ALL_COUNTRIES || window.DATA).map(c => [c.country, c.neighbors]));

  // Hint UI state
  let hintPanel = null;
  let hintBtn = null;
  let hintPanelVisible = false;
  let hintUsed = false;

  // Set of normalised GeoJSON names for the active continent.
  // Empty when no continent filter is active (show all countries normally).
  const continentGeoNames = new Set();
  if (continent) {
    for (const d of window.DATA) {
      const geoName = dataToGeo[d.country] || d.country;
      continentGeoNames.add(norm(geoName));
    }
  }

  // Draw entire world map
  function drawWorldMap() {
    if (!countryPaths.length) return;

    ctx.clearRect(0, 0, canvasDisplayWidth, canvasDisplayHeight);

    const defaultFill = getCSSVar('--map-country-fill') || "rgba(165,180,252,.08)";
    const defaultStroke = getCSSVar('--map-country-stroke') || "rgba(232,236,255,.3)";
    const hoverFill = getCSSVar('--map-country-fill-highlight') || "rgba(165,180,252,.25)";
    const dimFill = getCSSVar('--map-country-fill-dim') || 'rgba(165,180,252,.03)';
    const dimStroke = getCSSVar('--map-country-stroke-dim') || 'rgba(232,236,255,.10)';

    const offsets = visibleOffsets(viewport, canvasDisplayWidth);

    for (const country of countryPaths) {
      let fillStyle = defaultFill;
      let strokeStyle = defaultStroke;
      let strokeWidth = 0.5;

      const isDimmed = continentGeoNames.size > 0 && !continentGeoNames.has(norm(country.name));

      if (isDimmed) {
        fillStyle = dimFill;
        strokeStyle = dimStroke;
        strokeWidth = 0.3;
      } else if (highlightedCountry && norm(country.name) === norm(highlightedCountry)) {
        if (highlightType === "selected") {
          fillStyle = getCSSVar('--map-selected-fill') || "rgba(165, 180, 252, 0.35)";
          strokeStyle = getCSSVar('--map-selected-stroke') || "rgba(165, 180, 252, 0.95)";
          strokeWidth = 1.5;
        } else if (highlightType === "correct" || highlightType === "correct_self") {
          fillStyle = getCSSVar('--map-correct-fill') || "rgba(110, 231, 183, 0.5)";
          strokeStyle = getCSSVar('--map-correct-stroke') || "rgba(110, 231, 183, 0.95)";
          strokeWidth = 1.2;
        } else if (highlightType === "wrong") {
          fillStyle = getCSSVar('--map-wrong-fill') || "rgba(252, 165, 161, 0.5)";
          strokeStyle = getCSSVar('--map-wrong-stroke') || "rgba(252, 165, 161, 0.95)";
          strokeWidth = 1.2;
        }
      } else if (hoverCountry && norm(country.name) === norm(hoverCountry)) {
        fillStyle = hoverFill;
      }

      for (const offset of offsets) {
        drawCountry(ctx, viewport, country.paths, offset, fillStyle, strokeStyle, strokeWidth);
      }
    }

    // After a wrong answer, draw a small green ring around the correct country's centroid
    // if it's too small to be clearly visible at the current zoom level.
    if (highlightType === 'correct' && highlightedCountry) {
      const hn = norm(highlightedCountry);
      const hc = countryPaths.find(c => norm(c.name) === hn);
      if (hc && hc.bboxSize * viewport.zoom < 30) {
        const normalizedScrollX = ((viewport.scrollX % MAP_W) + MAP_W) % MAP_W;
        const baseOffset2 = viewport.scrollX - normalizedScrollX;
        for (let i = -1; i <= 1; i++) {
          const cx = hc.labelCx ?? hc.bboxCx;
          const cy = hc.labelCy ?? hc.bboxCy;
          const sx = (cx + baseOffset2 + i * MAP_W - viewport.scrollX) * viewport.zoom;
          const sy = (cy - viewport.scrollY) * viewport.zoom;
          ctx.save();
          ctx.beginPath();
          ctx.arc(sx, sy, 10, 0, Math.PI * 2);
          ctx.strokeStyle = getCSSVar('--map-correct-stroke') || 'rgba(110,231,183,0.95)';
          ctx.lineWidth = 2.5;
          ctx.stroke();
          ctx.restore();
        }
      }
    }
  }

  function checkClick(canvasX, canvasY, targetCountry = null) {
    return engineCheckClicked(canvasX, canvasY, {
      scrollX: viewport.scrollX,
      scrollY: viewport.scrollY,
      zoom: viewport.zoom,
      hitTestPaths,
      microCountries,
      resolveToDataName,
      targetCountry,
      dataToGeo,
      filteredNames: continentGeoNames.size > 0 ? continentGeoNames : null,
    });
  }

  // Highlight country
  function highlightCountry(countryName, type) {
    const mapName = dataToGeo[countryName] || countryName;
    highlightedCountry = mapName;
    highlightType = type;
    drawWorldMap();
  }

  // Get country bounding box
  function getCountryBBox(countryName) {
    const mapName = dataToGeo[countryName] || countryName;
    const n = norm(mapName);
    const features = WORLD.filter((f) => norm(f.properties.ADMIN || "") === n || norm(f.properties.NAME || "") === n);

    if (features.length === 0) return null;

    let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;

    const allRings = [];
    for (const f of features) {
      const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
      for (const poly of polys) {
        for (const ring of poly) {
          allRings.push(ring);
          for (const [lon, lat] of ring) {
            if (lon < minLon) minLon = lon;
            if (lat < minLat) minLat = lat;
            if (lon > maxLon) maxLon = lon;
            if (lat > maxLat) maxLat = lat;
          }
        }
      }
    }

    // If bbox spans > 180° longitude, country crosses the antimeridian.
    // Use only the largest ring (main landmass) for the bbox.
    if (maxLon - minLon > 180) {
      let bestRing = null, bestCount = 0;
      for (const ring of allRings) {
        if (ring.length > bestCount) { bestCount = ring.length; bestRing = ring; }
      }
      if (bestRing) {
        minLon = Infinity; minLat = Infinity; maxLon = -Infinity; maxLat = -Infinity;
        for (const [lon, lat] of bestRing) {
          if (lon < minLon) minLon = lon;
          if (lat < minLat) minLat = lat;
          if (lon > maxLon) maxLon = lon;
          if (lat > maxLat) maxLat = lat;
        }
      }
    }

    return { minLon, minLat, maxLon, maxLat };
  }

  // Zoom to countries
  function zoomToCountries(country1, country2) {
    const bbox1 = getCountryBBox(country1);
    const bbox2 = getCountryBBox(country2);

    if (!bbox1 || !bbox2) return;

    const size1 = Math.max(bbox1.maxLon - bbox1.minLon, bbox1.maxLat - bbox1.minLat);
    const size2 = Math.max(bbox2.maxLon - bbox2.minLon, bbox2.maxLat - bbox2.minLat);
    const isTiny1 = size1 < 2;
    const isTiny2 = size2 < 2;

    const combinedBBox = {
      minLon: Math.min(bbox1.minLon, bbox2.minLon),
      minLat: Math.min(bbox1.minLat, bbox2.minLat),
      maxLon: Math.max(bbox1.maxLon, bbox2.maxLon),
      maxLat: Math.max(bbox1.maxLat, bbox2.maxLat),
    };

    const dLon = combinedBBox.maxLon - combinedBBox.minLon;
    const dLat = combinedBBox.maxLat - combinedBBox.minLat;
    const padRatio = (isTiny1 || isTiny2) ? 0.4 : 0.2;

    combinedBBox.minLon -= dLon * padRatio;
    combinedBBox.maxLon += dLon * padRatio;
    combinedBBox.minLat -= dLat * padRatio;
    combinedBBox.maxLat += dLat * padRatio;

    if (isTiny1 || isTiny2) {
      const MIN_AREA_DEGREES = 10;
      const currentLonSpan = combinedBBox.maxLon - combinedBBox.minLon;
      const currentLatSpan = combinedBBox.maxLat - combinedBBox.minLat;

      if (currentLonSpan < MIN_AREA_DEGREES) {
        const centerLon = (combinedBBox.minLon + combinedBBox.maxLon) / 2;
        combinedBBox.minLon = centerLon - MIN_AREA_DEGREES / 2;
        combinedBBox.maxLon = centerLon + MIN_AREA_DEGREES / 2;
      }

      if (currentLatSpan < MIN_AREA_DEGREES) {
        const centerLat = (combinedBBox.minLat + combinedBBox.maxLat) / 2;
        combinedBBox.minLat = centerLat - MIN_AREA_DEGREES / 2;
        combinedBBox.maxLat = centerLat + MIN_AREA_DEGREES / 2;
      }
    }

    const [x1, y1] = proj([combinedBBox.minLon, combinedBBox.maxLat]);
    const [x2, y2] = proj([combinedBBox.maxLon, combinedBBox.minLat]);

    const width = x2 - x1;
    const height = y2 - y1;

    const zoomX = canvasDisplayWidth / width;
    const zoomY = canvasDisplayHeight / height;
    viewport.zoom = Math.max(viewport.minZoom, Math.min(zoomX, zoomY, 500));

    viewport.scrollX = x1 + width / 2 - canvasDisplayWidth / 2 / viewport.zoom;
    viewport.scrollY = y1 + height / 2 - canvasDisplayHeight / 2 / viewport.zoom;

    drawWorldMap();
  }

  // Zoom to fit the active continent in the viewport (no animation)
  function zoomToContinent() {
    if (!continentGeoNames.size) return;

    const bestRings = [];
    for (const d of window.DATA) {
      const mapName = dataToGeo[d.country] || d.country;
      const n = norm(mapName);
      const features = WORLD.filter(f =>
        norm(f.properties.ADMIN || '') === n || norm(f.properties.NAME || '') === n
      );
      let bestRing = null;
      let bestCount = 0;
      for (const feature of features) {
        const polys = feature.geometry.type === 'Polygon'
          ? [feature.geometry.coordinates]
          : feature.geometry.coordinates;
        for (const poly of polys) {
          const ring = poly[0];
          if (ring.length > bestCount) { bestCount = ring.length; bestRing = ring; }
        }
      }
      if (!bestRing) continue;
      let sumLon = 0;
      for (const [lon] of bestRing) sumLon += lon;
      bestRings.push({ ring: bestRing, centroidLon: sumLon / bestRing.length });
    }
    if (!bestRings.length) return;

    const toRad = d => d * Math.PI / 180;
    const sinSum = bestRings.reduce((s, r) => s + Math.sin(toRad(r.centroidLon)), 0);
    const cosSum = bestRings.reduce((s, r) => s + Math.cos(toRad(r.centroidLon)), 0);
    const meanLon = Math.atan2(sinSum, cosSum) * 180 / Math.PI;

    function normLon(lon) {
      let d = lon - meanLon;
      while (d > 180) d -= 360;
      while (d < -180) d += 360;
      return meanLon + d;
    }

    const normCentroids = bestRings
      .map(r => normLon(r.centroidLon))
      .sort((a, b) => a - b);
    const q1 = normCentroids[Math.floor(normCentroids.length * 0.25)];
    const q3 = normCentroids[Math.floor(normCentroids.length * 0.75)];
    const iqr = q3 - q1;
    const fenceLo = q1 - 3 * iqr;
    const fenceHi = q3 + 3 * iqr;

    let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
    for (const { ring } of bestRings) {
      for (const [lon, lat] of ring) {
        const nlon = Math.max(fenceLo, Math.min(fenceHi, normLon(lon)));
        if (nlon < minLon) minLon = nlon;
        if (nlon > maxLon) maxLon = nlon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
    }

    const PAD = 0.12;
    const dLon = maxLon - minLon;
    const dLat = maxLat - minLat;
    minLon -= dLon * PAD;
    maxLon += dLon * PAD;
    minLat = Math.max(-90, minLat - dLat * PAD);
    maxLat = Math.min(90, maxLat + dLat * PAD);

    const x1 = ((minLon + 180) / 360) * MAP_W;
    const x2 = ((maxLon + 180) / 360) * MAP_W;
    const y1 = ((90 - maxLat) / 180) * MAP_H;
    const y2 = ((90 - minLat) / 180) * MAP_H;
    const width = x2 - x1;
    const height = y2 - y1;
    const zoomX = canvasDisplayWidth / width;
    const zoomY = canvasDisplayHeight / height;
    viewport.zoom = Math.max(viewport.minZoom, Math.min(zoomX, zoomY, 500));
    viewport.scrollX = x1 + width / 2 - canvasDisplayWidth / (2 * viewport.zoom);
    viewport.scrollY = y1 + height / 2 - canvasDisplayHeight / (2 * viewport.zoom);
    viewport.scrollY = Math.max(0, Math.min(viewport.scrollY, MAP_H - canvasDisplayHeight / viewport.zoom));
  }

  function generateHints(countryDataName) {
    const hints = [];
    const geoName = dataToGeo[countryDataName] || countryDataName;
    const props = geoPropsMap.get(norm(geoName));

    if (props?.SUBREGION) {
      hints.push(`Located in ${props.SUBREGION}`);
    } else if (props?.CONTINENT) {
      hints.push(`In ${props.CONTINENT}`);
    }

    const entry = (window.DATA || []).find(d => d.country === countryDataName);
    if (entry?.capitals?.[0]) {
      hints.push(`Capital: ${entry.capitals[0]}`);
    }

    if (props?.POP_EST) {
      const pop = props.POP_EST;
      const popStr = pop >= 1e9 ? `${(pop / 1e9).toFixed(1)} billion`
                   : pop >= 1e6 ? `${Math.round(pop / 1e6)} million`
                   : pop >= 1000 ? `${Math.round(pop / 1000)}K`
                   : `${pop}`;
      hints.push(`Population: ~${popStr}`);
    }

    const nbrs = neighborsData?.[countryDataName];
    if (nbrs != null) {
      if (nbrs.length === 0) {
        hints.push('Island nation — no land borders');
      } else if (nbrs.length <= 4) {
        hints.push(`Bordered by: ${nbrs.join(', ')}`);
      } else {
        hints.push(`Bordered by ${nbrs.length} countries, incl. ${nbrs.slice(0, 2).join(', ')}`);
      }
    }

    return hints;
  }

  function hideHintPanel() {
    if (!hintPanel) return;
    hintPanel.classList.remove('visible');
    hintPanelVisible = false;
  }

  function showHintPanel(countryDataName) {
    if (!hintPanel) return;
    const hints = generateHints(countryDataName);
    const list = hintPanel.querySelector('.find-hint-list');
    list.innerHTML = hints.map(h => `<li>${h}</li>`).join('');
    hintPanel.classList.add('visible');
    hintPanelVisible = true;
  }

  function createHintUI() {
    const mapwrap = canvas.parentElement;

    hintBtn = document.createElement('button');
    hintBtn.className = 'picture-hint-btn';
    hintBtn.textContent = '💡';
    hintBtn.title = 'Show hints';
    mapwrap.appendChild(hintBtn);

    hintPanel = document.createElement('div');
    hintPanel.className = 'find-hint-panel';
    hintPanel.innerHTML =
      '<div class="find-hint-panel-header">' +
        '<span>💡 Hints</span>' +
        '<button class="find-hint-close" title="Close">✕</button>' +
      '</div>' +
      '<ul class="find-hint-list"></ul>';
    mapwrap.appendChild(hintPanel);

    hintBtn.addEventListener('click', () => {
      if (hintPanelVisible) {
        hideHintPanel();
      } else {
        const current = game?.getCurrent?.();
        if (current) {
          showHintPanel(current.country);
          hintUsed = true;
        }
      }
    });

    hintPanel.addEventListener('click', () => {
      hideHintPanel();
    });
  }

  // Reset map view — clears highlight/hover and stops inertia, but preserves zoom/pan.
  function resetMapView() {
    highlightedCountry = null;
    highlightType = null;
    hoverCountry = null;
    viewport.velocityX = 0;
    viewport.velocityY = 0;
    hintUsed = false;
    hideHintPanel();
    drawWorldMap();
  }

  // Resize canvas
  function resizeCanvas() {
    const { w, h, minZoom } = setupCanvas(canvas, ctx, dpr, canvas.parentElement);
    canvasDisplayWidth = w;
    canvasDisplayHeight = h;
    viewport.minZoom = minZoom;
    if (viewport.zoom < minZoom) viewport.zoom = minZoom;
    drawWorldMap();
  }

  // Initialize canvas
  resizeCanvas();
  if (continent) {
    zoomToContinent();
  } else {
    // Center on Europe/Africa (longitude 0°) rather than the date line
    viewport.scrollX = MAP_W / 2 - canvasDisplayWidth / (2 * viewport.zoom);
  }
  window.addEventListener('resize', resizeCanvas);
  drawWorldMap();

  // Create confetti if needed
  const confetti = confettiInstance || (typeof initConfetti === 'function' ? initConfetti('confetti') : null);

  // Merge UI elements
  const fullUI = {
    countryNameEl,
    scoreEl: ui.scoreEl || null,
    progressEl: ui.progressEl || null,
    finalOverlay: ui.finalOverlay || null,
  };

  // Create game instance (forward reference — assigned after createPanZoom)
  let game = null;

  // Attach pan/zoom and interaction
  createPanZoom(canvas, viewport, drawWorldMap, {
    onTap(clickX, clickY) {
      const target = game ? game.getCurrent()?.country : null;
      const clickedCountry = checkClick(clickX, clickY, target);
      if (clickedCountry && game) {
        game.handleMapClick(clickedCountry, hintUsed);
      }
    },
    onHover(currentX, currentY) {
      if (game && game.getCurrent() !== "") {
        const clickedCountry = checkClick(currentX, currentY, game.getCurrent().country);
        if (clickedCountry !== hoverCountry) {
          hoverCountry = clickedCountry;
          drawWorldMap();
        }
      }
    },
    onLeave() {
      hoverCountry = null;
      drawWorldMap();
    },
  });

  // Create game instance
  game = createFindCountryGame({
    ui: fullUI,
    confetti,
    checkClickedCountry: checkClick,
    highlightCountry,
    zoomToCountries,
    resetMapView,
    config: {
      singleRound,
      hideScoreUI: singleRound,
      onComplete: onComplete,
      maxRounds,
      gameIdSuffix
    }
  });

  // Create hint UI (only for standalone game — canvas.parentElement is .mapwrap)
  if (!singleRound) {
    createHintUI();
  }

  return {
    game,
    reset: () => game.reset(),
    nextQ: () => game.nextQ(),
    getCurrent: () => game.getCurrent(),
    setCountry: (country) => game.setCountry(country),
  };
}
