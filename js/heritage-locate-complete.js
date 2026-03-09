/**
 * Heritage Locate — Complete Game Factory
 *
 * Creates a GeoGuessr-style heritage game with canvas map.
 * Player sees a heritage site photo, clicks map to place a pin,
 * confirms guess, sees distance + score, then moves to next round.
 */

import { loadGeoJSON } from './geojson-loader.js';
import { renderFinishScreen } from './game-records.js';
import { initConfetti } from './confetti.js';
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
  const confetti = initConfetti('confetti');

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
  let revealProgress = 0;  // 0 = hidden, 0→1 = animating line/pin, 1 = fully revealed
  let animFrameId = null;

  // ── UI elements (created dynamically inside mapwrap) ────────────────────

  // Image overlay panel — clickable: expanded ↔ collapsed thumbnail
  const imagePanel = document.createElement('div');
  imagePanel.className = 'heritage-locate-image-panel';
  imagePanel.innerHTML = '<img alt=""><div class="heritage-locate-image-name"></div>';
  mapwrap.appendChild(imagePanel);

  // Three states: 'normal' → 'expanded' → 'collapsed' → 'normal' → …
  let imageState = 'normal';

  imagePanel.addEventListener('click', () => {
    if (imageState === 'normal') {
      imageState = 'expanded';
    } else if (imageState === 'expanded') {
      imageState = 'collapsed';
    } else {
      imageState = 'normal';
    }
    imagePanel.classList.toggle('expanded', imageState === 'expanded');
    imagePanel.classList.toggle('collapsed', imageState === 'collapsed');
  });

  // Button bar (same pattern as geo-features-complete.js)
  const btnBar = document.createElement('div');
  btnBar.style.cssText = `
    position: absolute;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 10px;
    z-index: 10;
    pointer-events: none;
  `;
  mapwrap.appendChild(btnBar);

  const btnBase = `
    pointer-events: auto;
    padding: 8px 20px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid;
    transition: all 0.2s;
    white-space: nowrap;
  `;

  const guessBtn = document.createElement('button');
  guessBtn.textContent = 'Guess';
  guessBtn.className = 'geo-submit-btn';
  guessBtn.style.cssText = btnBase + 'display: none;';
  btnBar.appendChild(guessBtn);

  const nextBtn = document.createElement('button');
  nextBtn.className = 'geo-next-btn';
  nextBtn.style.cssText = btnBase + 'display: none;';
  btnBar.appendChild(nextBtn);

  // Result banner
  const resultBanner = document.createElement('div');
  resultBanner.className = 'heritage-locate-result';
  resultBanner.style.display = 'none';
  mapwrap.appendChild(resultBanner);

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

    if (roundResult && revealProgress > 0) {
      const [ax, ay] = proj([roundResult.actualLon, roundResult.actualLat]);
      const [gx, gy] = proj([currentPin.lon, currentPin.lat]);
      // Line grows from guess toward actual based on revealProgress
      const t = Math.min(revealProgress * 1.5, 1); // line completes at ~67% of animation
      const lx = gx + (ax - gx) * t;
      const ly = gy + (ay - gy) * t;

      for (const off of offsets) {
        drawDottedLine(ctx, gx + off, gy, lx + off, ly);
        // Show actual pin only after line reaches it
        if (t >= 1) {
          drawPin(ctx, ax + off, ay, '#22c55e');
        }
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

    // Distance label at midpoint — only when fully revealed
    if (roundResult && revealProgress >= 1) {
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
    revealProgress = 0;

    guessBtn.style.display = 'none';

    // Update score/progress
    const prog = logic.getProgress();
    if (scoreEl) scoreEl.textContent = prog.totalScore.toLocaleString();

    // Animated reveal: zoom to fit both pins, then animate line + pin
    animateZoomToFit(
      currentPin,
      { lat: result.actualLat, lon: result.actualLon },
      () => {
        // After zoom completes, animate the line/pin reveal
        animateReveal(() => {
          // After reveal, show result banner + next button
          const color = result.distKm <= 150 ? '#22c55e'
            : result.distKm <= 1500 ? '#f59e0b'
            : '#ef4444';
          resultBanner.style.display = '';
          resultBanner.style.borderLeftColor = color;
          resultBanner.innerHTML = `<span style="color:${color}">📍 ${formatDistance(result.distKm)}</span> — <b>${result.score.toLocaleString()} pts</b>`;
          nextBtn.textContent = logic.isComplete() ? 'Finish' : 'Next \u2192';
          nextBtn.style.display = '';

          // Perfect guess — celebrate!
          if (result.score === 5000) {
            const rect = canvas.getBoundingClientRect();
            confetti.burst({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, count: 80 });
          }
        });
      }
    );
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
    revealProgress = 0;
    if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }

    guessBtn.style.display = 'none';
    nextBtn.style.display = 'none';
    resultBanner.style.display = 'none';

    // Update image panel — expanded by default each round
    const img = imagePanel.querySelector('img');
    img.src = site.imageUrl;
    img.alt = site.siteName;
    imagePanel.querySelector('.heritage-locate-image-name').textContent = site.siteName;
    imageState = 'normal';
    imagePanel.classList.remove('expanded', 'collapsed');
    imagePanel.style.display = '';

    // Update progress
    const prog = logic.getProgress();
    if (progressEl) progressEl.textContent = `${prog.current} / ${prog.total}`;

    drawWorldMap();
  }

  // ── Animated zoom to fit two pins ───────────────────────────────────────

  function computeFitView(pin1, pin2) {
    const [x1, y1] = proj([pin1.lon, pin1.lat]);
    const [x2, y2] = proj([pin2.lon, pin2.lat]);

    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);

    const PAD = 0.6; // generous padding so it's not too tight
    const w = (maxX - minX) || 30;
    const h = (maxY - minY) || 30;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    const paddedW = w * (1 + PAD * 2);
    const paddedH = h * (1 + PAD * 2);

    const zoomX = canvasW / paddedW;
    const zoomY = canvasH / paddedH;
    const zoom = Math.max(viewport.minZoom, Math.min(zoomX, zoomY, 500));

    const scrollX = cx - canvasW / (2 * zoom);
    const scrollY = Math.max(0, Math.min(cy - canvasH / (2 * zoom), MAP_H - canvasH / zoom));
    return { zoom, scrollX, scrollY };
  }

  /** Ease-in-out cubic */
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2; }

  /**
   * Animate from the current viewport to one that fits both pins.
   *
   * Interpolates the view CENTER and zoom independently so the camera
   * smoothly zooms out while panning — no wild jumps even when the
   * user was zoomed in close to their guess.
   */
  function animateZoomToFit(pin1, pin2, onDone) {
    if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }

    const target = computeFitView(pin1, pin2);

    // Convert from/to into center-point + zoom so we can interpolate stably
    const fromZoom = viewport.zoom;
    const fromCx = viewport.scrollX + canvasW / (2 * fromZoom);
    const fromCy = viewport.scrollY + canvasH / (2 * fromZoom);

    const toZoom = target.zoom;
    const toCx = target.scrollX + canvasW / (2 * toZoom);
    const toCy = target.scrollY + canvasH / (2 * toZoom);

    // Interpolate zoom in log-space for perceptually even speed
    const fromLogZ = Math.log(fromZoom);
    const toLogZ = Math.log(toZoom);

    // Longer duration when the camera has more ground to cover
    const dist = Math.hypot(
      (toCx - fromCx) * fromZoom,
      (toCy - fromCy) * fromZoom,
      (toLogZ - fromLogZ) * 200,
    );
    const duration = Math.max(500, Math.min(1000, dist * 1.2));
    const start = performance.now();

    function step(now) {
      const t = easeInOut(Math.min((now - start) / duration, 1));

      const z = Math.exp(fromLogZ + (toLogZ - fromLogZ) * t);
      const cx = fromCx + (toCx - fromCx) * t;
      const cy = fromCy + (toCy - fromCy) * t;

      viewport.zoom = z;
      viewport.scrollX = cx - canvasW / (2 * z);
      viewport.scrollY = Math.max(0, Math.min(cy - canvasH / (2 * z), MAP_H - canvasH / z));
      drawWorldMap();

      if (t < 1) {
        animFrameId = requestAnimationFrame(step);
      } else {
        animFrameId = null;
        if (onDone) onDone();
      }
    }
    animFrameId = requestAnimationFrame(step);
  }

  function animateReveal(onDone) {
    if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }

    const duration = 500; // ms
    const start = performance.now();

    function step(now) {
      revealProgress = Math.min((now - start) / duration, 1);
      drawWorldMap();

      if (revealProgress < 1) {
        animFrameId = requestAnimationFrame(step);
      } else {
        animFrameId = null;
        if (onDone) onDone();
      }
    }
    animFrameId = requestAnimationFrame(step);
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
