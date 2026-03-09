/**
 * Heritage Locate — Complete Game Factory
 *
 * Creates a GeoGuessr-style heritage game with canvas map.
 * Player sees a heritage site photo, clicks map to place a pin,
 * confirms guess, sees distance + score, then moves to next round.
 */

import { loadGeoJSON } from './geojson-loader.js';
import { renderFinishScreen } from './game-records.js';
import { HeritageLocateLogic } from './games/heritage-locate-logic.js';
import {
  MAP_W, MAP_H, proj, getCSSVar,
  buildCountryPaths,
  drawCountriesBatch, visibleOffsets,
  setupCanvas, createPanZoom,
} from './canvas-map-engine.js';

/**
 * @param {Object} config
 * @param {HTMLElement}       config.container     - Page container
 * @param {HTMLCanvasElement} config.canvas        - Canvas element
 * @param {HTMLElement}       config.scoreEl       - Score display element
 * @param {HTMLElement}       config.progressEl    - Progress display element
 * @param {HTMLElement}       config.finalOverlay  - Finish screen overlay
 * @param {number}            config.maxRounds     - Number of rounds
 * @param {string}            config.gameIdSuffix  - 'short'|'medium'|'long'
 * @returns {Promise<{ start: Function }>}
 */
export async function createHeritageLocateGame({
  container,
  canvas,
  scoreEl,
  progressEl,
  finalOverlay,
  maxRounds = 10,
  gameIdSuffix = 'short',
}) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const mapwrap = canvas.parentElement;

  let canvasW = 600, canvasH = 320;
  const viewport = { scrollX: 0, scrollY: 0, zoom: 1, minZoom: 1, velocityX: 0, velocityY: 0 };

  // ── Load GeoJSON + build paths ──────────────────────────────────────────
  const worldData = await loadGeoJSON('data/ne_10m_admin_0_countries.geojson.gz');
  const { countryPaths } = buildCountryPaths(worldData.features);

  // ── Game logic ──────────────────────────────────────────────────────────
  const logic = new HeritageLocateLogic({ maxRounds });
  await logic.loadSites();

  // ── Round state ─────────────────────────────────────────────────────────
  let currentPin = null;   // { lat, lon }
  let roundResult = null;  // from logic.confirmGuess
  let confirmed = false;

  // ── UI elements (created dynamically inside mapwrap) ────────────────────

  // Image toggle button
  const imageBtn = document.createElement('button');
  imageBtn.className = 'heritage-locate-image-btn';
  imageBtn.textContent = '🖼️';
  imageBtn.title = 'Toggle site image';
  mapwrap.appendChild(imageBtn);

  // Image overlay panel
  const imagePanel = document.createElement('div');
  imagePanel.className = 'heritage-locate-image-panel';
  imagePanel.innerHTML = '<img alt=""><div class="heritage-locate-image-name"></div>';
  mapwrap.appendChild(imagePanel);

  // Guess button
  const guessBtn = document.createElement('button');
  guessBtn.className = 'heritage-locate-confirm';
  guessBtn.textContent = 'Guess';
  guessBtn.style.display = 'none';
  mapwrap.appendChild(guessBtn);

  // Result banner
  const resultBanner = document.createElement('div');
  resultBanner.className = 'heritage-locate-result';
  resultBanner.style.display = 'none';
  mapwrap.appendChild(resultBanner);

  // Next button
  const nextBtn = document.createElement('button');
  nextBtn.className = 'heritage-locate-confirm heritage-locate-next';
  nextBtn.textContent = 'Next';
  nextBtn.style.display = 'none';
  mapwrap.appendChild(nextBtn);

  let imagePanelVisible = true;

  imageBtn.addEventListener('click', () => {
    imagePanelVisible = !imagePanelVisible;
    imagePanel.style.display = imagePanelVisible ? '' : 'none';
  });

  // ── Canvas resize ───────────────────────────────────────────────────────

  function resizeCanvas() {
    const { w, h, minZoom } = setupCanvas(canvas, ctx, dpr, mapwrap);
    canvasW = w;
    canvasH = h;
    viewport.minZoom = minZoom;
    if (viewport.zoom < minZoom) viewport.zoom = minZoom;
    drawWorldMap();
  }

  resizeCanvas();
  // Center on Europe
  viewport.scrollX = MAP_W / 2 - canvasW / (2 * viewport.zoom);
  window.addEventListener('resize', resizeCanvas);

  // ── Drawing ─────────────────────────────────────────────────────────────

  function drawWorldMap() {
    if (!countryPaths.length) return;
    ctx.clearRect(0, 0, canvasW, canvasH);

    const defaultFill = getCSSVar('--map-country-fill') || 'rgba(165,180,252,.08)';
    const defaultStroke = getCSSVar('--map-country-stroke') || 'rgba(232,236,255,.3)';
    const offsets = visibleOffsets(viewport, canvasW);

    // Build items for batch draw
    const items = countryPaths.map(c => ({
      path2d: c.path2d,
      fill: defaultFill,
      stroke: defaultStroke,
      strokeWidth: 0.5,
      bboxMinX: c.bboxMinX, bboxMaxX: c.bboxMaxX,
      bboxMinY: c.bboxMinY, bboxMaxY: c.bboxMaxY,
    }));

    drawCountriesBatch(ctx, viewport, items, offsets, canvasW, canvasH);

    // Draw pins and connecting line
    if (currentPin) {
      const [gx, gy] = proj([currentPin.lon, currentPin.lat]);
      for (const off of offsets) {
        drawPin(ctx, gx + off, gy, confirmed && roundResult ? '#f97316' : '#ef4444');
      }
    }

    if (roundResult) {
      const [ax, ay] = proj([roundResult.actualLon, roundResult.actualLat]);
      const [gx, gy] = proj([currentPin.lon, currentPin.lat]);

      for (const off of offsets) {
        // Dotted line from guess to actual
        drawDottedLine(ctx, gx + off, gy, ax + off, ay);
        // Actual pin (green)
        drawPin(ctx, ax + off, ay, '#22c55e');
      }
    }
  }

  function drawPin(ctx, mapX, mapY, color) {
    const sx = (mapX - viewport.scrollX) * viewport.zoom;
    const sy = (mapY - viewport.scrollY) * viewport.zoom;
    const r = 7;

    ctx.save();
    // Stem
    ctx.beginPath();
    ctx.moveTo(sx, sy + r * 2);
    ctx.lineTo(sx - 2, sy + r);
    ctx.lineTo(sx + 2, sy + r);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    // Circle head
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner dot
    ctx.beginPath();
    ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.restore();
  }

  function drawDottedLine(ctx, x1, y1, x2, y2) {
    const sx1 = (x1 - viewport.scrollX) * viewport.zoom;
    const sy1 = (y1 - viewport.scrollY) * viewport.zoom;
    const sx2 = (x2 - viewport.scrollX) * viewport.zoom;
    const sy2 = (y2 - viewport.scrollY) * viewport.zoom;

    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(sx1, sy1);
    ctx.lineTo(sx2, sy2);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.7;
    ctx.stroke();
    ctx.restore();

    // Distance label at midpoint
    if (roundResult) {
      const mx = (sx1 + sx2) / 2;
      const my = (sy1 + sy2) / 2;
      const label = formatDistance(roundResult.distKm);

      ctx.save();
      ctx.font = 'bold 12px "DM Sans", system-ui, sans-serif';
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.beginPath();
      ctx.roundRect(mx - tw / 2 - 6, my - 8, tw + 12, 18, 4);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, mx, my + 1);
      ctx.restore();
    }
  }

  function formatDistance(km) {
    if (km < 1) return '< 1 km';
    return km.toLocaleString() + ' km';
  }

  // ── Pan/zoom + tap handler ──────────────────────────────────────────────

  createPanZoom(canvas, viewport, drawWorldMap, {
    onTap(clickX, clickY) {
      if (confirmed) return;
      // Convert canvas coords → lon/lat
      const mapX = clickX / viewport.zoom + viewport.scrollX;
      const mapY = clickY / viewport.zoom + viewport.scrollY;
      const normalizedMapX = ((mapX % MAP_W) + MAP_W) % MAP_W;
      const lon = (normalizedMapX / MAP_W) * 360 - 180;
      const lat = 90 - (mapY / MAP_H) * 180;

      // Clamp lat
      if (lat < -90 || lat > 90) return;

      currentPin = { lat, lon };
      guessBtn.style.display = '';
      drawWorldMap();
    },
  });

  // ── Guess button ────────────────────────────────────────────────────────

  guessBtn.addEventListener('click', () => {
    if (!currentPin || confirmed) return;
    confirmed = true;

    const result = logic.confirmGuess(currentPin.lat, currentPin.lon);
    roundResult = result;

    guessBtn.style.display = 'none';
    nextBtn.style.display = '';

    // Result banner
    const color = result.distKm <= 150 ? '#22c55e'
      : result.distKm <= 1500 ? '#f59e0b'
      : '#ef4444';
    resultBanner.style.display = '';
    resultBanner.style.borderLeftColor = color;
    resultBanner.innerHTML = `<span style="color:${color}">📍 ${formatDistance(result.distKm)}</span> — <b>${result.score.toLocaleString()} pts</b>`;

    // Update score/progress
    const prog = logic.getProgress();
    if (scoreEl) scoreEl.textContent = prog.totalScore.toLocaleString();

    // Zoom to fit both pins
    zoomToFitPins(currentPin, { lat: result.actualLat, lon: result.actualLon });

    drawWorldMap();
  });

  // ── Next button ─────────────────────────────────────────────────────────

  nextBtn.addEventListener('click', () => {
    if (logic.isComplete()) {
      showFinish();
      return;
    }
    startRound();
  });

  // ── Round lifecycle ─────────────────────────────────────────────────────

  function startRound() {
    const site = logic.nextRound();
    if (!site) { showFinish(); return; }

    currentPin = null;
    roundResult = null;
    confirmed = false;

    guessBtn.style.display = 'none';
    nextBtn.style.display = 'none';
    resultBanner.style.display = 'none';

    // Update image panel
    const img = imagePanel.querySelector('img');
    img.src = site.imageUrl;
    img.alt = site.siteName;
    imagePanel.querySelector('.heritage-locate-image-name').textContent = site.siteName;
    imagePanelVisible = true;
    imagePanel.style.display = '';

    // Update progress
    const prog = logic.getProgress();
    if (progressEl) progressEl.textContent = `${prog.current} / ${prog.total}`;

    drawWorldMap();
  }

  // ── Zoom to fit two pins ────────────────────────────────────────────────

  function zoomToFitPins(pin1, pin2) {
    const [x1, y1] = proj([pin1.lon, pin1.lat]);
    const [x2, y2] = proj([pin2.lon, pin2.lat]);

    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);

    const PAD = 0.3;
    const w = (maxX - minX) || 20;
    const h = (maxY - minY) || 20;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    const paddedW = w * (1 + PAD * 2);
    const paddedH = h * (1 + PAD * 2);

    const zoomX = canvasW / paddedW;
    const zoomY = canvasH / paddedH;
    const newZoom = Math.max(viewport.minZoom, Math.min(zoomX, zoomY, 500));

    viewport.zoom = newZoom;
    viewport.scrollX = cx - canvasW / (2 * newZoom);
    viewport.scrollY = Math.max(0, Math.min(cy - canvasH / (2 * newZoom), MAP_H - canvasH / newZoom));
  }

  // ── Finish screen ──────────────────────────────────────────────────────

  function showFinish() {
    const prog = logic.getProgress();
    const time = logic.getTotalTime();
    const avgKm = prog.total > 0
      ? Math.round(logic.results.reduce((s, r) => s + r.distKm, 0) / prog.total)
      : 0;
    const accuracy = Math.round((prog.totalScore / prog.maxPossible) * 100);

    finalOverlay.style.display = 'flex';
    renderFinishScreen(finalOverlay, {
      gameId: 'heritage-locate-' + gameIdSuffix,
      score: prog.totalScore,
      scoreLabel: 'Score',
      maxScore: prog.maxPossible,
      time,
      accuracy,
      stats: [{ label: 'avg. distance', value: avgKm.toLocaleString() + ' km' }],
      onPlayAgain: async () => {
        await logic.reset();
        if (scoreEl) scoreEl.textContent = '0';
        // Reset viewport
        viewport.zoom = viewport.minZoom;
        viewport.scrollX = MAP_W / 2 - canvasW / (2 * viewport.zoom);
        viewport.scrollY = 0;
        startRound();
      },
    });
  }

  // ── Public API ──────────────────────────────────────────────────────────

  drawWorldMap();

  return {
    start() {
      startRound();
    },
  };
}
