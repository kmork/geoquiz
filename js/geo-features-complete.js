/**
 * Geo Features — Complete Game Factory
 *
 * Shared canvas map game for Rivers and Mountains.
 * Players toggle-click countries then submit; after each round the feature
 * path is drawn on the map (blue line for rivers, brown dots for mountains).
 *
 * Mountains additionally supports a bonus round: after submit the map zooms
 * into the range and the player clicks the highest named peak.
 */

import { norm } from './utils.js';
import { loadGeoJSON } from './geojson-loader.js';
import { renderFinishScreen } from './game-records.js';
import { initConfetti } from './confetti.js';
import {
  MAP_W, MAP_H, proj, getCSSVar,
  buildCountryPaths, buildNameLookups,
  checkClickedCountry as engineCheckClicked,
  drawCountriesBatch, visibleOffsets,
  setupCanvas, createPanZoom,
} from './canvas-map-engine.js';

/**
 * @param {Object}  config
 * @param {HTMLElement}         config.container      - The mapwrap element (position:relative)
 * @param {HTMLCanvasElement}   config.canvas         - The canvas element inside container
 * @param {HTMLElement}         config.featureNameEl  - Shows the current feature name
 * @param {HTMLElement}         config.hintEl         - Shows the hint text (hidden by default)
 * @param {HTMLElement}         config.scoreEl        - Running score display
 * @param {HTMLElement}         config.progressEl     - "X / Y" progress display
 * @param {HTMLElement}         config.finalOverlay   - Finish screen overlay
 * @param {GeoFeaturesGameLogic} config.logic         - Game logic instance (already reset)
 * @param {'river'|'mountain'} config.featureType     - Determines overlay style
 * @param {string}             config.gameId          - Record key (e.g. 'rivers-short')
 * @param {HTMLElement}        [config.initOverlay]   - Loading overlay to hide after load
 * @param {Function}           [config.onBonusRound]  - async (feature, api) => void (mountains only)
 * @param {Function}           [config.getExtraScore]    - () => number
 * @param {Function}           [config.getExtraMaxScore] - () => number
 * @param {Function}           [config.onPlayAgainHook]  - Called at start of startGame()
 * @param {boolean}            [config.pickOne=false]    - Easy mode: pick one country per feature
 * @returns {Promise<void>}
 */
export async function createGeoFeaturesGame({
  container,
  canvas,
  featureNameEl,
  hintEl,
  scoreEl,
  progressEl,
  finalOverlay,
  logic,
  featureType,
  gameId,
  initOverlay,
  onBonusRound = null,
  getExtraScore = null,
  getExtraMaxScore = null,
  onPlayAgainHook = null,
  pickOne = false,
}) {
  const confetti = initConfetti('confetti');

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  let canvasDisplayWidth = 600;
  let canvasDisplayHeight = 320;

  // Viewport state — shared with pan/zoom engine
  const viewport = { scrollX: 0, scrollY: 0, zoom: 1, minZoom: 1, velocityX: 0, velocityY: 0 };

  // ── Game render state ─────────────────────────────────────────────────────

  // Map<dataName, 'selected'|'correct'|'wrong'|'missed'>
  let highlights = new Map();
  let currentFeatureOverlay = null; // feature object shown after submit
  let roundActive = false;
  let submitted = false;

  // ── Bonus round state ─────────────────────────────────────────────────────

  let bonusPhase = false;
  let bonusHighlight = null;       // name of correct peak (shown green after answer)
  let bonusWrongPeak = null;       // name of the wrong-clicked peak (shown red)
  let currentPeaks = null;         // peaks array of current feature
  let peakLabelsVisible = false;   // revealed by hint button
  let pendingBonusFeature = null;  // set after submit; bonus starts when user clicks Next
  let bonusNextResolve = null;     // resolves when user clicks Next during bonus result view

  // ── Button references (created in createButtons()) ────────────────────────

  let submitBtn  = null;
  let hintBtn    = null;
  let nextBtn    = null;
  let bonusBtn   = null;
  let hintPanel  = null;
  let hintUsed   = false;

  // ── Load GeoJSON ──────────────────────────────────────────────────────────

  const worldData = await loadGeoJSON('data/ne_10m_admin_0_countries.geojson.gz');
  const WORLD = worldData.features;

  const { countryPaths, hitTestPaths } = buildCountryPaths(WORLD);
  const { geoToData, resolveToDataName } = buildNameLookups(countryPaths);

  // ── Hit detection ─────────────────────────────────────────────────────────

  function checkClickedCountry(canvasX, canvasY) {
    return engineCheckClicked(canvasX, canvasY, {
      scrollX: viewport.scrollX,
      scrollY: viewport.scrollY,
      zoom: viewport.zoom,
      hitTestPaths,
      resolveToDataName,
    });
  }

  // ── Drawing ───────────────────────────────────────────────────────────────

  function drawFeatureOverlay(feature) {
    if (!feature?.path?.length) return;
    const pts = feature.path.map(([lon, lat]) => proj([lon, lat]));

    const normalizedScrollX = ((viewport.scrollX % MAP_W) + MAP_W) % MAP_W;
    const baseOffset = viewport.scrollX - normalizedScrollX;
    const viewWidthInMapUnits = canvasDisplayWidth / viewport.zoom;
    const viewLeft  = viewport.scrollX - viewWidthInMapUnits / 2;
    const viewRight = viewport.scrollX + viewWidthInMapUnits / 2;

    ctx.save();
    for (let i = -1; i <= 1; i++) {
      const offset = baseOffset + i * MAP_W;
      if (offset + MAP_W < viewLeft || offset > viewRight) continue;

      if (featureType === 'river') {
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.85)';
        ctx.lineWidth   = 2.5;
        ctx.lineJoin    = 'round';
        ctx.lineCap     = 'round';
        ctx.beginPath();
        pts.forEach(([x, y], j) => {
          const px = (x + offset - viewport.scrollX) * viewport.zoom;
          const py = (y - viewport.scrollY) * viewport.zoom;
          if (j === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
      } else {
        // mountain dots
        ctx.fillStyle = 'rgba(180, 120, 60, 0.9)';
        for (const [x, y] of pts) {
          const px = (x + offset - viewport.scrollX) * viewport.zoom;
          const py = (y - viewport.scrollY) * viewport.zoom;
          ctx.beginPath();
          ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  function drawPeakMarkers(peaks, mode) {
    if (!peaks?.length) return;

    const normalizedScrollX = ((viewport.scrollX % MAP_W) + MAP_W) % MAP_W;
    const baseOffset = viewport.scrollX - normalizedScrollX;
    const viewWidthInMapUnits = canvasDisplayWidth / viewport.zoom;
    const viewLeft  = viewport.scrollX - viewWidthInMapUnits / 2;
    const viewRight = viewport.scrollX + viewWidthInMapUnits / 2;

    ctx.save();

    for (let i = -1; i <= 1; i++) {
      const offset = baseOffset + i * MAP_W;
      if (offset + MAP_W < viewLeft || offset > viewRight) continue;

      for (const peak of peaks) {
        const [mx, my] = proj([peak.lon, peak.lat]);
        const px = (mx + offset - viewport.scrollX) * viewport.zoom;
        const py = (my - viewport.scrollY) * viewport.zoom;

        if (px < -20 || px > canvasDisplayWidth + 20 || py < -20 || py > canvasDisplayHeight + 20) continue;

        const isCorrect = bonusHighlight  === peak.name;
        const isWrong   = bonusWrongPeak  === peak.name;

        if (mode === 'subtle') {
          const s = 4;
          ctx.fillStyle = 'rgba(180, 120, 60, 0.85)';
          ctx.beginPath();
          ctx.moveTo(px, py - s);
          ctx.lineTo(px + s * 0.87, py + s * 0.5);
          ctx.lineTo(px - s * 0.87, py + s * 0.5);
          ctx.closePath();
          ctx.fill();

          if (peakLabelsVisible) {
            const labelY = py - s - 3;
            ctx.font = `bold ${Math.max(9, Math.min(11, viewport.zoom * 1.2))}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.strokeStyle = 'rgba(0,0,0,0.7)';
            ctx.lineWidth = 3;
            ctx.lineJoin = 'round';
            ctx.strokeText(peak.name, px, labelY);
            ctx.fillStyle = '#f5deb3';
            ctx.fillText(peak.name, px, labelY);
          }
        } else {
          const radius = 10;
          const glowColor = isCorrect ? 'rgba(110,231,183,0.45)' : isWrong ? 'rgba(252,165,161,0.45)' : 'rgba(180,120,60,0.35)';
          ctx.beginPath();
          ctx.arc(px, py, radius + 5, 0, Math.PI * 2);
          ctx.strokeStyle = glowColor;
          ctx.lineWidth = 3;
          ctx.stroke();
          const fillColor = isCorrect ? '#6ee7b7' : isWrong ? '#fda4af' : 'rgba(180, 120, 60, 0.92)';
          ctx.beginPath();
          ctx.arc(px, py, radius, 0, Math.PI * 2);
          ctx.fillStyle = fillColor;
          ctx.fill();
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 2;
          ctx.stroke();

          if (peakLabelsVisible) {
            const labelY = py - radius - 3;
            const labelText = bonusHighlight !== null
              ? `${peak.name}  ${peak.elev} m`
              : peak.name;
            ctx.font = `bold ${Math.max(9, Math.min(13, viewport.zoom * 1.5))}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.strokeStyle = 'rgba(0,0,0,0.7)';
            ctx.lineWidth = 3;
            ctx.lineJoin = 'round';
            ctx.strokeText(labelText, px, labelY);
            ctx.fillStyle = isCorrect ? '#6ee7b7' : isWrong ? '#fda4af' : '#f5deb3';
            ctx.fillText(labelText, px, labelY);
          }
        }
      }
    }

    ctx.restore();
  }

  function zoomToBounds(lons, lats, padding = 0.3, maxZoom = 500) {
    if (!lons.length || !lats.length) return;

    const minLon = Math.min(...lons) - padding * (Math.max(...lons) - Math.min(...lons) + 1);
    const maxLon = Math.max(...lons) + padding * (Math.max(...lons) - Math.min(...lons) + 1);
    const minLat = Math.min(...lats) - padding * (Math.max(...lats) - Math.min(...lats) + 1);
    const maxLat = Math.max(...lats) + padding * (Math.max(...lats) - Math.min(...lats) + 1);

    const [x0, y1] = proj([minLon, minLat]);
    const [x1, y0] = proj([maxLon, maxLat]);

    const featureW = x1 - x0;
    const featureH = y1 - y0;

    if (featureW <= 0 || featureH <= 0) return;

    const zoomX = canvasDisplayWidth  / featureW;
    const zoomY = canvasDisplayHeight / featureH;
    const newZoom = Math.min(maxZoom, Math.max(viewport.minZoom, Math.min(zoomX, zoomY)));

    const centerX = (x0 + x1) / 2;
    const centerY = (y0 + y1) / 2;

    viewport.zoom    = newZoom;
    viewport.scrollX = centerX - canvasDisplayWidth  / (2 * viewport.zoom);
    viewport.scrollY = Math.max(0, Math.min(MAP_H - canvasDisplayHeight / viewport.zoom,
                      centerY - canvasDisplayHeight / (2 * viewport.zoom)));

    drawWorldMap();
  }

  // ── Bonus round API ───────────────────────────────────────────────────────

  const bonusApi = {
    startPeakMode(peaks) {
      currentPeaks = peaks;
      bonusHighlight = null;
      bonusWrongPeak = null;
      peakLabelsVisible = false;
      if (hintBtn) {
        hintBtn.style.visibility = '';
        hintBtn.style.opacity = '1';
      }
      zoomToBounds(peaks.map(p => p.lon), peaks.map(p => p.lat), 0.5, 60);
    },
    onPeakClick: null,
    onEnd: null,
    highlightPeak(name) {
      bonusHighlight = name;
      drawWorldMap();
    },
    markWrong(name) {
      bonusWrongPeak = name;
      drawWorldMap();
    },
    revealLabels() {
      peakLabelsVisible = true;
      if (hintBtn) hintBtn.style.opacity = '0.5';
      drawWorldMap();
    },
    endBonusMode() {
      currentPeaks = null;
      bonusHighlight = null;
      bonusWrongPeak = null;
      peakLabelsVisible = false;
      if (hintBtn) hintBtn.style.visibility = 'hidden';
      // Reset viewport to initial full-world view
      viewport.zoom    = viewport.minZoom;
      viewport.scrollX = MAP_W / 2 - canvasDisplayWidth / (2 * viewport.minZoom);
      viewport.scrollY = 0;
      drawWorldMap();
      if (bonusApi.onEnd) { bonusApi.onEnd(); bonusApi.onEnd = null; }
    },
  };

  // ── Bonus click handler ───────────────────────────────────────────────────

  function handleBonusClick(canvasX, canvasY) {
    if (!currentPeaks) return;
    const mapX = canvasX / viewport.zoom + viewport.scrollX;
    const mapY = canvasY / viewport.zoom + viewport.scrollY;
    const normalizedMapX = ((mapX % MAP_W) + MAP_W) % MAP_W;
    const HIT_RADIUS = 14;
    let hit = null, bestDist = Infinity;
    for (const peak of currentPeaks) {
      const [px, py] = proj([peak.lon, peak.lat]);
      const dist = Math.sqrt((normalizedMapX - px) ** 2 + (mapY - py) ** 2) * viewport.zoom;
      if (dist < HIT_RADIUS && dist < bestDist) { bestDist = dist; hit = peak; }
    }
    if (hit && bonusApi.onPeakClick) bonusApi.onPeakClick(hit);
  }

  function drawWorldMap() {
    if (!countryPaths.length) return;
    ctx.clearRect(0, 0, canvasDisplayWidth, canvasDisplayHeight);

    const defaultFill   = getCSSVar('--map-country-fill')   || 'rgba(165,180,252,.08)';
    const defaultStroke = getCSSVar('--map-country-stroke') || 'rgba(232,236,255,.3)';
    const selectedFill  = getCSSVar('--map-selected-fill')  || 'rgba(165,180,252,0.35)';
    const selectedStroke= getCSSVar('--map-selected-stroke')|| 'rgba(165,180,252,0.95)';
    const correctFill   = getCSSVar('--map-correct-fill')   || 'rgba(110,231,183,0.5)';
    const correctStroke = getCSSVar('--map-correct-stroke') || 'rgba(110,231,183,0.95)';
    const wrongFill     = getCSSVar('--map-wrong-fill')     || 'rgba(252,165,161,0.5)';
    const wrongStroke   = getCSSVar('--map-wrong-stroke')   || 'rgba(252,165,161,0.95)';
    const missedFill    = getCSSVar('--map-missed-fill')    || 'rgba(251,191,36,0.4)';
    const missedStroke  = getCSSVar('--map-missed-stroke')  || 'rgba(251,191,36,0.9)';

    const offsets = visibleOffsets(viewport, canvasDisplayWidth);

    const items = [];
    for (const country of countryPaths) {
      const dataName = geoToData[country.name] || resolveToDataName(country.name);
      const ht = dataName ? highlights.get(dataName) : null;

      let fillStyle   = defaultFill;
      let strokeStyle = defaultStroke;
      let strokeWidth = 0.5;

      if (ht === 'selected') {
        fillStyle = selectedFill; strokeStyle = selectedStroke; strokeWidth = 1.5;
      } else if (ht === 'correct') {
        fillStyle = correctFill;  strokeStyle = correctStroke;  strokeWidth = 1.2;
      } else if (ht === 'wrong') {
        fillStyle = wrongFill;    strokeStyle = wrongStroke;    strokeWidth = 1.2;
      } else if (ht === 'missed') {
        fillStyle = missedFill;   strokeStyle = missedStroke;   strokeWidth = 1.2;
      }

      items.push({
        path2d: country.path2d, fill: fillStyle, stroke: strokeStyle, strokeWidth,
        bboxMinX: country.bboxMinX, bboxMaxX: country.bboxMaxX,
        bboxMinY: country.bboxMinY, bboxMaxY: country.bboxMaxY,
      });
    }

    drawCountriesBatch(ctx, viewport, items, offsets, canvasDisplayWidth, canvasDisplayHeight);

    // For mountains with peaks, skip the generic path dots — only peak markers are drawn
    if (currentFeatureOverlay && !(featureType === 'mountain' && currentPeaks)) {
      drawFeatureOverlay(currentFeatureOverlay);
    }

    if (currentPeaks && featureType === 'mountain') {
      drawPeakMarkers(currentPeaks, bonusPhase ? 'interactive' : 'subtle');
    }
  }

  // ── Canvas resize ─────────────────────────────────────────────────────────

  function resizeCanvas() {
    const { w, h, minZoom } = setupCanvas(canvas, ctx, dpr, canvas.parentElement);
    canvasDisplayWidth  = w;
    canvasDisplayHeight = h;
    viewport.minZoom = minZoom;
    if (viewport.zoom < minZoom) viewport.zoom = minZoom;
    drawWorldMap();
  }

  // ── Map click handler ─────────────────────────────────────────────────────

  function handleMapClick(canvasX, canvasY) {
    if (bonusPhase) { handleBonusClick(canvasX, canvasY); return; }
    if (!roundActive || submitted) return;
    const name = checkClickedCountry(canvasX, canvasY);
    if (!name) return;
    const action = logic.toggleCountry(name);
    if (action === 'added') {
      if (pickOne) {
        for (const [k, v] of highlights) {
          if (v === 'selected') highlights.delete(k);
        }
      }
      highlights.set(name, 'selected');
    } else {
      highlights.delete(name);
    }
    drawWorldMap();
  }

  // ── Button bar (absolute overlay inside mapwrap) ──────────────────────────

  function createButtons() {
    hintBtn = document.createElement('button');
    hintBtn.className = 'picture-hint-btn';
    hintBtn.title = 'Show hint (−1 point)';
    hintBtn.textContent = '💡';
    container.appendChild(hintBtn);

    const bar = document.createElement('div');
    bar.style.cssText = `
      position: absolute;
      bottom: 12px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 10px;
      z-index: 10;
      pointer-events: none;
    `;
    container.appendChild(bar);

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

    submitBtn = document.createElement('button');
    submitBtn.textContent = 'Submit';
    submitBtn.className = 'geo-submit-btn';
    submitBtn.style.cssText = btnBase;

    nextBtn = document.createElement('button');
    nextBtn.className = 'geo-next-btn';
    nextBtn.style.cssText = btnBase + `display: none;`;

    bonusBtn = document.createElement('button');
    bonusBtn.className = 'geo-bonus-btn';
    bonusBtn.textContent = '🏔 Find the Peak!';
    bonusBtn.style.cssText = btnBase + `display: none;`;

    bar.appendChild(submitBtn);
    bar.appendChild(nextBtn);
    bar.appendChild(bonusBtn);

    hintPanel = document.createElement('div');
    hintPanel.className = 'find-hint-panel';
    hintPanel.innerHTML =
      '<div class="find-hint-panel-header"><span>💡 Hint</span></div>' +
      '<ul class="find-hint-list"></ul>';
    container.appendChild(hintPanel);

    hintPanel.addEventListener('click', () => {
      hintPanel.classList.remove('visible');
    });

    hintBtn.addEventListener('click', () => {
      if (bonusPhase) {
        if (!peakLabelsVisible) {
          peakLabelsVisible = true;
          hintBtn.style.opacity = '0.5';
          drawWorldMap();
        }
        return;
      }
      if (hintPanel.classList.contains('visible')) {
        hintPanel.classList.remove('visible');
        return;
      }
      if (!hintUsed) {
        const hint = logic.useHint();
        hintPanel.querySelector('.find-hint-list').innerHTML = `<li>${hint}</li>`;
        hintUsed = true;
        hintBtn.style.opacity = '0.5';
      }
      hintPanel.classList.add('visible');
    });

    submitBtn.addEventListener('click', () => {
      if (!roundActive || submitted) return;
      doSubmit();
    });

    nextBtn.addEventListener('click', () => {
      if (bonusNextResolve) {
        bonusNextResolve();
      } else {
        doNextRound();
      }
    });

    bonusBtn.addEventListener('click', () => {
      if (!pendingBonusFeature) return;
      const feature = pendingBonusFeature;
      pendingBonusFeature = null;
      bonusBtn.style.display = 'none';
      nextBtn.style.display  = 'none';
      startBonusRound(feature);
    });
  }

  // ── Round flow ────────────────────────────────────────────────────────────

  async function doSubmit() {
    submitted = true;
    roundActive = false;

    submitBtn.style.display  = 'none';
    hintBtn.style.visibility = 'hidden';
    if (hintPanel) hintPanel.classList.remove('visible');

    const result = logic.submitAnswer();
    if (!result) return;

    highlights = new Map();
    for (const c of result.correct) highlights.set(c, 'correct');
    for (const c of result.wrong)   highlights.set(c, 'wrong');
    for (const c of result.missed)  highlights.set(c, 'missed');

    if (result.wrong.size === 0 && result.correct.size > 0 && (pickOne || result.missed.size === 0)) {
      confetti?.burst?.({ x: innerWidth / 2, y: innerHeight / 2 });
    }

    currentFeatureOverlay = logic.current;
    currentPeaks = (featureType === 'mountain') ? (logic.current?.peaks || null) : null;
    drawWorldMap();

    updateUI();

    nextBtn.textContent   = logic.isComplete() ? 'Finish' : 'Next →';
    nextBtn.style.display = '';

    if (onBonusRound && logic.current?.peaks?.length) {
      pendingBonusFeature = logic.current;
      bonusBtn.style.display = '';
    }
  }

  async function startBonusRound(feature) {
    nextBtn.style.display = 'none';
    bonusPhase = true;
    await onBonusRound(feature, bonusApi);

    nextBtn.textContent = logic.isComplete() ? 'Finish' : 'Next →';
    nextBtn.style.display = '';

    await new Promise(resolve => { bonusNextResolve = resolve; });
    bonusNextResolve = null;

    bonusPhase = false;
    bonusApi.endBonusMode();
    doNextRound();
  }

  function doNextRound() {
    nextBtn.style.display  = 'none';
    bonusBtn.style.display = 'none';
    pendingBonusFeature    = null;

    if (logic.isComplete()) {
      showFinish();
      return;
    }

    const feature = logic.nextRound();
    if (!feature) { showFinish(); return; }

    highlights = new Map();
    currentFeatureOverlay = null;
    currentPeaks = null;
    peakLabelsVisible = false;
    submitted   = false;
    roundActive = true;

    if (featureNameEl) featureNameEl.textContent = feature.name;
    if (hintPanel) hintPanel.classList.remove('visible');
    hintUsed                 = false;
    hintBtn.style.opacity    = '1';
    hintBtn.style.visibility = '';
    submitBtn.style.display  = '';

    updateUI();
    drawWorldMap();
  }

  function updateUI() {
    const p = logic.getProgress();
    if (scoreEl)    scoreEl.textContent    = p.score;
    if (progressEl) progressEl.textContent = `${p.current} / ${p.total}`;
  }

  function showFinish() {
    if (!finalOverlay) return;
    finalOverlay.style.display = 'flex';

    const p        = logic.getProgress();
    const totalTime = logic.getTotalTime();
    const extra    = getExtraScore    ? getExtraScore()    : 0;
    const extraMax = getExtraMaxScore ? getExtraMaxScore() : 0;
    const accuracy = (p.totalPossible + extraMax) > 0
      ? Math.round(((p.score + extra) / (p.totalPossible + extraMax)) * 100)
      : 0;

    const stats = [
      { label: pickOne ? 'correct answers' : 'countries identified', value: p.score },
    ];
    if (extraMax > 0) {
      stats.push({ label: 'bonus peaks found', value: extra });
    }

    renderFinishScreen(finalOverlay, {
      gameId,
      score:       p.score + extra,
      scoreLabel:  'Points',
      maxScore:    p.totalPossible + extraMax,
      time:        totalTime,
      accuracy,
      stats,
      shareUrl: `geoquiz.info${location.pathname}${location.search}`,
      onPlayAgain: () => {
        finalOverlay.style.display = 'none';
        startGame();
      },
    });
  }

  // ── Start ─────────────────────────────────────────────────────────────────

  function startGame() {
    onPlayAgainHook?.();
    logic.reset();
    bonusPhase     = false;
    bonusHighlight = null;
    bonusWrongPeak = null;
    currentPeaks   = null;
    peakLabelsVisible = false;
    pendingBonusFeature = null;
    bonusNextResolve = null;

    const feature = logic.nextRound();
    if (!feature) return;

    highlights = new Map();
    currentFeatureOverlay = null;
    currentPeaks = null;
    submitted   = false;
    roundActive = true;

    if (featureNameEl) featureNameEl.textContent = feature.name;
    if (hintPanel) hintPanel.classList.remove('visible');
    hintUsed = false;
    if (hintBtn) {
      hintBtn.style.opacity    = '1';
      hintBtn.style.visibility = '';
    }
    if (submitBtn)  submitBtn.style.display  = '';
    if (nextBtn)    nextBtn.style.display    = 'none';
    if (bonusBtn)   bonusBtn.style.display   = 'none';

    updateUI();
    drawWorldMap();
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  resizeCanvas();
  // Center on Greenwich meridian
  viewport.scrollX = MAP_W / 2 - canvasDisplayWidth / (2 * viewport.zoom);
  window.addEventListener('resize', resizeCanvas);

  createButtons();

  createPanZoom(canvas, viewport, drawWorldMap, {
    onTap(canvasX, canvasY) {
      handleMapClick(canvasX, canvasY);
    },
  });

  // Wikipedia link on the feature name
  if (featureNameEl) {
    featureNameEl.title = 'Open Wikipedia';
    featureNameEl.addEventListener('click', () => {
      const name = logic.current?.name;
      if (!name) return;
      open('https://en.wikipedia.org/wiki/' + encodeURIComponent(name), '_blank', 'noopener,noreferrer,width=900,height=700');
    });
  }

  if (initOverlay) initOverlay.style.display = 'none';

  startGame();
}
