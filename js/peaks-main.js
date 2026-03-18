/**
 * Mountain Peaks Quiz — Click the correct peak dot on the world map.
 *
 * All peak dots are rendered as triangle markers. Each round shows a peak name
 * and elevation; the player must click the correct dot.
 */

import { loadGeoJSON } from './geojson-loader.js';
import { renderFinishScreen } from './game-records.js';
import { initConfetti } from './confetti.js';
import { shuffleArray } from './game-utils.js';
import { norm } from './utils.js';
import {
  MAP_W, MAP_H, proj, getCSSVar,
  buildCountryPaths, buildNameLookups,
  drawCountriesBatch, visibleOffsets,
  setupCanvas, createPanZoom,
} from './canvas-map-engine.js';

// ── Wait for DATA ─────────────────────────────────────────────────────────────

function waitForData() {
  return new Promise(resolve => {
    if (window.DATA) return resolve();
    const id = setInterval(() => { if (window.DATA) { clearInterval(id); resolve(); } }, 50);
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────

(async function init() {
  await waitForData();

  const canvas       = document.getElementById('map');
  const ctx          = canvas.getContext('2d');
  const dpr          = window.devicePixelRatio || 1;
  const container    = canvas.parentElement;
  const featureNameEl = document.getElementById('featureName');
  const scoreEl      = document.getElementById('score');
  const progressEl   = document.getElementById('progress');
  const finalOverlay = document.getElementById('finalOverlay');
  const initOverlay  = document.getElementById('init-overlay');

  const confetti = initConfetti('confetti');

  // ── Parse URL params ────────────────────────────────────────────────────

  const params = new URLSearchParams(location.search);
  const roundsParam = params.get('rounds') || '10';
  const continentParam = params.get('continent') || null;

  // ── Build peaks array ───────────────────────────────────────────────────

  let dataEntries = window.DATA;
  if (continentParam) {
    dataEntries = dataEntries.filter(c => c.continent === continentParam);
  }

  // Build raw peaks with country info
  const rawPeaks = dataEntries
    .filter(c => c.highestPeak)
    .map(c => ({ country: c.country, ...c.highestPeak }));

  // Deduplicate by peak name + coordinates (e.g. Everest appears for Nepal and China)
  const seen = new Set();
  const allPeaksPool = [];
  for (const p of rawPeaks) {
    const key = `${p.name}|${p.lat}|${p.lon}`;
    if (!seen.has(key)) {
      seen.add(key);
      allPeaksPool.push(p);
    }
  }

  // ── Viewport state ──────────────────────────────────────────────────────

  let canvasDisplayWidth = 600;
  let canvasDisplayHeight = 320;
  const viewport = { scrollX: 0, scrollY: 0, zoom: 1, minZoom: 1, velocityX: 0, velocityY: 0 };

  // ── Game state ──────────────────────────────────────────────────────────

  let gamePeaks = [];       // shuffled subset for current game
  let currentIdx = 0;
  let score = 0;
  let totalRounds = 0;
  let roundActive = false;
  let answered = false;
  let highlightCorrect = null;  // peak object highlighted green
  let highlightWrong = null;    // peak object highlighted red
  let gameStartTime = 0;

  // ── Load GeoJSON ────────────────────────────────────────────────────────

  const worldData = await loadGeoJSON('data/ne_10m_admin_0_countries.geojson.gz');
  const WORLD = worldData.features;

  const { countryPaths } = buildCountryPaths(WORLD);
  const { dataToGeo, geoToData, resolveToDataName } = buildNameLookups(countryPaths);

  // ── Continent filtering — dim countries outside the selected continent ──

  const continentGeoNames = new Set();
  if (continentParam) {
    for (const d of window.DATA.filter(c => c.continent === continentParam)) {
      const geoName = dataToGeo[d.country] || d.country;
      continentGeoNames.add(norm(geoName));
    }
  }

  // Zoom to fit the active continent in the viewport
  function zoomToContinent() {
    if (!continentGeoNames.size) return;

    const bestRings = [];
    for (const d of window.DATA.filter(c => c.continent === continentParam)) {
      const mapName = dataToGeo[d.country] || d.country;
      const n = norm(mapName);
      const features = WORLD.filter(f =>
        norm(f.properties.ADMIN || '') === n || norm(f.properties.NAME || '') === n
      );
      let bestRing = null, bestCount = 0;
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

    const normCentroids = bestRings.map(r => normLon(r.centroidLon)).sort((a, b) => a - b);
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
  }

  // ── Drawing ─────────────────────────────────────────────────────────────

  function drawWorldMap() {
    if (!countryPaths.length) return;
    ctx.clearRect(0, 0, canvasDisplayWidth, canvasDisplayHeight);

    const defaultFill   = getCSSVar('--map-country-fill')   || 'rgba(165,180,252,.08)';
    const defaultStroke = getCSSVar('--map-country-stroke') || 'rgba(232,236,255,.3)';
    const dimFill       = getCSSVar('--map-country-fill-dim')   || 'rgba(165,180,252,.03)';
    const dimStroke     = getCSSVar('--map-country-stroke-dim') || 'rgba(232,236,255,.10)';

    const offsets = visibleOffsets(viewport, canvasDisplayWidth);

    // Draw country polygons — dim countries outside selected continent
    const items = [];
    for (const country of countryPaths) {
      const isDimmed = continentGeoNames.size > 0 && !continentGeoNames.has(country.normName);
      items.push({
        path2d: country.path2d,
        fill: isDimmed ? dimFill : defaultFill,
        stroke: isDimmed ? dimStroke : defaultStroke,
        strokeWidth: isDimmed ? 0.3 : 0.5,
        bboxMinX: country.bboxMinX, bboxMaxX: country.bboxMaxX,
        bboxMinY: country.bboxMinY, bboxMaxY: country.bboxMaxY,
      });
    }

    drawCountriesBatch(ctx, viewport, items, offsets, canvasDisplayWidth, canvasDisplayHeight);

    // Draw all peak dots
    const isLight = document.documentElement.classList.contains('light-mode');
    const defaultPeakColor = isLight ? 'rgba(146,64,14,0.85)' : 'rgba(210,140,60,0.85)';
    const r = Math.max(4, 6 / viewport.zoom);

    ctx.save();
    for (const peak of allPeaksPool) {
      const [mx, my] = proj([peak.lon, peak.lat]);
      for (const offset of offsets) {
        const px = (mx + offset - viewport.scrollX) * viewport.zoom;
        const py = (my - viewport.scrollY) * viewport.zoom;
        if (px < -10 || px > canvasDisplayWidth + 10 || py < -10 || py > canvasDisplayHeight + 10) continue;

        const isCorrect = highlightCorrect && peak.name === highlightCorrect.name && peak.lat === highlightCorrect.lat;
        const isWrong   = highlightWrong   && peak.name === highlightWrong.name   && peak.lat === highlightWrong.lat;

        let fillColor = defaultPeakColor;
        if (isCorrect) fillColor = '#6ee7b7';
        else if (isWrong) fillColor = '#fda4af';

        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fillStyle = fillColor;
        ctx.fill();
        if (isCorrect || isWrong) {
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Draw labels for highlighted peaks after answer
        if ((isCorrect || isWrong) && answered) {
          const fontSize = Math.max(9, Math.min(13, viewport.zoom * 1.5));
          const labelY = py - r - 4;
          const labelText = `${peak.name} · ${peak.country}`;
          ctx.font = `bold ${fontSize}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.strokeStyle = isLight ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.7)';
          ctx.lineWidth = 3;
          ctx.lineJoin = 'round';
          ctx.strokeText(labelText, px, labelY);
          ctx.fillStyle = isCorrect ? '#6ee7b7' : '#fda4af';
          ctx.fillText(labelText, px, labelY);
        }
      }
    }
    ctx.restore();
  }

  // ── Canvas resize ───────────────────────────────────────────────────────

  function resizeCanvas() {
    const { w, h, minZoom } = setupCanvas(canvas, ctx, dpr, container);
    canvasDisplayWidth  = w;
    canvasDisplayHeight = h;
    viewport.minZoom = minZoom;
    if (viewport.zoom < minZoom) viewport.zoom = minZoom;
    drawWorldMap();
  }

  // ── Hit detection — find nearest peak ───────────────────────────────────

  function findPeakAtPoint(canvasX, canvasY) {
    const mapX = canvasX / viewport.zoom + viewport.scrollX;
    const mapY = canvasY / viewport.zoom + viewport.scrollY;
    const normalizedMapX = ((mapX % MAP_W) + MAP_W) % MAP_W;
    const HIT_RADIUS = 14;
    let hit = null, bestDist = Infinity;
    for (const peak of allPeaksPool) {
      const [px, py] = proj([peak.lon, peak.lat]);
      const dist = Math.sqrt((normalizedMapX - px) ** 2 + (mapY - py) ** 2) * viewport.zoom;
      if (dist < HIT_RADIUS && dist < bestDist) {
        bestDist = dist;
        hit = peak;
      }
    }
    return hit;
  }

  // ── Zoom to show two peaks ───────────────────────────────────────────

  function zoomToShowPeaks(peak1, peak2) {
    const PAD = 0.3;
    const MIN_SPAN = 10; // minimum degrees visible

    let minLon = Math.min(peak1.lon, peak2.lon);
    let maxLon = Math.max(peak1.lon, peak2.lon);
    let minLat = Math.min(peak1.lat, peak2.lat);
    let maxLat = Math.max(peak1.lat, peak2.lat);

    const dLon = maxLon - minLon;
    const dLat = maxLat - minLat;
    minLon -= dLon * PAD; maxLon += dLon * PAD;
    minLat -= dLat * PAD; maxLat += dLat * PAD;

    // Enforce minimum span so nearby peaks don't over-zoom
    const lonSpan = maxLon - minLon;
    const latSpan = maxLat - minLat;
    if (lonSpan < MIN_SPAN) {
      const center = (minLon + maxLon) / 2;
      minLon = center - MIN_SPAN / 2;
      maxLon = center + MIN_SPAN / 2;
    }
    if (latSpan < MIN_SPAN) {
      const center = (minLat + maxLat) / 2;
      minLat = center - MIN_SPAN / 2;
      maxLat = center + MIN_SPAN / 2;
    }

    const [x1, y1] = proj([minLon, maxLat]);
    const [x2, y2] = proj([maxLon, minLat]);
    const width = x2 - x1;
    const height = y2 - y1;

    const zoomX = canvasDisplayWidth / width;
    const zoomY = canvasDisplayHeight / height;
    viewport.zoom = Math.max(viewport.minZoom, Math.min(zoomX, zoomY, 500));
    viewport.scrollX = x1 + width / 2 - canvasDisplayWidth / (2 * viewport.zoom);
    viewport.scrollY = y1 + height / 2 - canvasDisplayHeight / (2 * viewport.zoom);
  }

  // ── Map click handler ──────────────────────────────────────────────────

  function handleMapClick(canvasX, canvasY) {
    if (!roundActive || answered) return;
    const hit = findPeakAtPoint(canvasX, canvasY);
    if (!hit) return;

    answered = true;
    const correct = gamePeaks[currentIdx];
    const isCorrect = hit.name === correct.name && hit.lat === correct.lat;

    if (isCorrect) {
      score++;
      scoreEl.textContent = score;
      highlightCorrect = correct;
      highlightWrong = null;
      confetti.burst({ x: window.innerWidth / 2, y: window.innerHeight / 3, count: 40 });
    } else {
      highlightCorrect = correct;
      highlightWrong = hit;
      // Zoom out to show both the wrong click and the correct peak
      zoomToShowPeaks(hit, correct);
    }

    drawWorldMap();

    // Auto-advance after delay
    setTimeout(() => {
      currentIdx++;
      if (currentIdx < totalRounds) {
        nextRound();
      } else {
        showFinish();
      }
    }, 1500);
  }

  // ── Game flow ──────────────────────────────────────────────────────────

  function startGame() {
    finalOverlay.style.display = 'none';
    score = 0;
    currentIdx = 0;
    highlightCorrect = null;
    highlightWrong = null;
    answered = false;
    roundActive = false;
    scoreEl.textContent = '0';

    gamePeaks = shuffleArray([...allPeaksPool]);
    if (roundsParam !== 'all') {
      gamePeaks = gamePeaks.slice(0, parseInt(roundsParam, 10));
    }
    totalRounds = gamePeaks.length;
    progressEl.textContent = `0 / ${totalRounds}`;

    // Reset viewport — zoom to continent if selected, otherwise full world
    viewport.zoom    = viewport.minZoom;
    viewport.scrollX = MAP_W / 2 - canvasDisplayWidth / (2 * viewport.minZoom);
    viewport.scrollY = 0;
    if (continentParam) zoomToContinent();

    gameStartTime = Date.now();
    nextRound();
  }

  function nextRound() {
    roundActive = true;
    answered = false;
    highlightCorrect = null;
    highlightWrong = null;

    const peak = gamePeaks[currentIdx];
    featureNameEl.textContent = `${peak.name} (${peak.elev.toLocaleString()} m)`;
    progressEl.textContent = `${currentIdx + 1} / ${totalRounds}`;

    drawWorldMap();
  }

  function showFinish() {
    roundActive = false;
    const elapsed = (Date.now() - gameStartTime) / 1000;
    const accuracy = totalRounds > 0 ? Math.round((score / totalRounds) * 100) : 0;

    // Build gameId for records
    let gameIdSuffix = '';
    if (continentParam) {
      gameIdSuffix += `-${continentParam.toLowerCase().replace(/\s+/g, '-')}`;
    }
    if (roundsParam === 'all') gameIdSuffix += '-long';
    else if (roundsParam === '25') gameIdSuffix += '-medium';
    else gameIdSuffix += '-short';

    const gameId = `peaks${gameIdSuffix}`;

    renderFinishScreen(finalOverlay, {
      gameId,
      score,
      maxScore: totalRounds,
      time: elapsed,
      accuracy,
      onPlayAgain: startGame,
    });

    finalOverlay.style.display = 'flex';
  }

  // ── Pan/zoom ───────────────────────────────────────────────────────────

  createPanZoom(canvas, viewport, drawWorldMap, {
    onTap: handleMapClick,
  });

  // ── Resize handling ──────────────────────────────────────────────────

  window.addEventListener('resize', resizeCanvas);

  // ── Initial draw + start ───────────────────────────────────────────────

  resizeCanvas();
  startGame();

  if (initOverlay) initOverlay.style.display = 'none';
})();
