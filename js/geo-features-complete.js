/**
 * Geo Features — Complete Game Factory
 *
 * Shared canvas map game for Rivers and Mountains.
 * Players toggle-click countries then submit; after each round the feature
 * path is drawn on the map (blue line for rivers, brown dots for mountains).
 *
 * Adapted from find-country-complete.js — same pan/zoom/world-wrap engine,
 * new multi-highlight map and feature-overlay rendering.
 */

import { norm } from './utils.js';
import { COUNTRY_ALIASES } from './aliases.js';
import { loadGeoJSON } from './geojson-loader.js';
import { renderFinishScreen } from './game-records.js';

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
}) {
  const MAP_W = 600;
  const MAP_H = 320;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  let canvasDisplayWidth = 600;
  let canvasDisplayHeight = 320;

  // ── Projection ────────────────────────────────────────────────────────────

  const proj = ([lon, lat]) => [
    ((lon + 180) / 360) * MAP_W,
    ((90 - lat) / 180) * MAP_H,
  ];

  function coordsFromFeature(f) {
    if (!f.geometry) return [];
    const polys = f.geometry.type === 'Polygon'
      ? [f.geometry.coordinates]
      : f.geometry.coordinates;
    const paths = [];
    for (const poly of polys) {
      for (const ring of poly) {
        paths.push(ring.map(([lon, lat]) => proj([lon, lat])));
      }
    }
    return paths;
  }

  function getCSSVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  // ── Viewport state ────────────────────────────────────────────────────────

  let scrollX = 0;
  let scrollY = 0;
  let zoom = 1;
  let minZoom = 1;
  let velocityX = 0;
  let velocityY = 0;
  let animationFrameId = null;

  // ── Game render state ─────────────────────────────────────────────────────

  // Map<dataName, 'selected'|'correct'|'wrong'|'missed'>
  let highlights = new Map();
  let currentFeatureOverlay = null; // feature object shown after submit
  let roundActive = false;
  let submitted = false;

  // ── Button references (created in createButtons()) ────────────────────────

  let submitBtn = null;
  let hintBtn   = null;
  let nextBtn   = null;

  // ── Load GeoJSON ──────────────────────────────────────────────────────────

  const worldData = await loadGeoJSON('data/ne_10m_admin_0_countries.geojson.gz');
  const WORLD = worldData.features;

  const countryMap = new Map();
  for (const feature of WORLD) {
    const name = feature.properties.ADMIN || '';
    if (!name) continue;
    const paths = coordsFromFeature(feature);
    if (!paths.length) continue;
    if (countryMap.has(name)) {
      countryMap.get(name).paths.push(...paths);
    } else {
      countryMap.set(name, { name, paths });
    }
  }
  const countryPaths = Array.from(countryMap.values());

  // Scale Vatican so it's clickable
  const vaticanEntry = countryPaths.find(c => norm(c.name) === 'vatican');
  if (vaticanEntry?.paths.length > 0) {
    const S = 90;
    vaticanEntry.paths = vaticanEntry.paths.map(ring => {
      const cx = ring.reduce((s, [x]) => s + x, 0) / ring.length;
      const cy = ring.reduce((s, [, y]) => s + y, 0) / ring.length;
      return ring.map(([x, y]) => [cx + (x - cx) * S, cy + (y - cy) * S]);
    });
  }

  // Pre-compute bounding boxes for hit-test ordering
  for (const country of countryPaths) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const polygon of country.paths) {
      for (const [x, y] of polygon) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    country.bboxSize = Math.max(maxX - minX, maxY - minY);
    country.bboxCx   = (minX + maxX) / 2;
    country.bboxCy   = (minY + maxY) / 2;
  }

  // Smallest first → small enclosed countries get priority in hit-testing
  const hitTestPaths = [...countryPaths].sort((a, b) => a.bboxSize - b.bboxSize);

  // ── Name-mapping lookups ──────────────────────────────────────────────────

  // GeoJSON ADMIN name → window.DATA country name
  const dataToGeo = {}; // dataName → geoName
  const geoToData = {}; // geoName  → dataName

  for (const geoName of countryMap.keys()) {
    const directMatch = (window.DATA || []).find(d => norm(d.country) === norm(geoName));
    if (directMatch) {
      dataToGeo[directMatch.country] = geoName;
      geoToData[geoName] = directMatch.country;
      continue;
    }
    const target = COUNTRY_ALIASES[geoName];
    if (target) {
      dataToGeo[target] = geoName;
      geoToData[geoName] = target;
    }
  }

  // ── Point-in-polygon ──────────────────────────────────────────────────────

  function pointInPolygon(x, y, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0], yi = polygon[i][1];
      const xj = polygon[j][0], yj = polygon[j][1];
      const intersect = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function resolveToDataName(geoName) {
    const gn = norm(geoName);
    const aliasTarget = COUNTRY_ALIASES[geoName];
    for (const d of (window.DATA || [])) {
      if (norm(d.country) === gn) return d.country;
      if (aliasTarget && norm(aliasTarget) === norm(d.country)) return d.country;
    }
    return null;
  }

  function checkClickedCountry(canvasX, canvasY) {
    const mapX = canvasX / zoom + scrollX;
    const mapY = canvasY / zoom + scrollY;
    const normalizedMapX = ((mapX % MAP_W) + MAP_W) % MAP_W;

    // Point-in-polygon, smallest first
    for (const country of hitTestPaths) {
      for (const polygon of country.paths) {
        if (pointInPolygon(normalizedMapX, mapY, polygon)) {
          return resolveToDataName(country.name) || country.name;
        }
      }
    }

    // Proximity fallback for tiny countries
    let nearestName = null;
    let nearestDist = Infinity;
    for (const country of hitTestPaths) {
      if (country.bboxSize > 50) continue;
      const dx = normalizedMapX - country.bboxCx;
      const dy = mapY - country.bboxCy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < nearestDist && dist < 30) {
        nearestDist = dist;
        nearestName = resolveToDataName(country.name) || country.name;
      }
    }
    return nearestName;
  }

  // ── Drawing ───────────────────────────────────────────────────────────────

  function drawCountry(paths, offsetX, fillStyle, strokeStyle, strokeWidth) {
    ctx.save();
    for (const coords of paths) {
      ctx.beginPath();
      coords.forEach(([x, y], i) => {
        const px = (x + offsetX - scrollX) * zoom;
        const py = (y - scrollY) * zoom;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.fillStyle = fillStyle;
      ctx.fill();
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = strokeWidth;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawFeatureOverlay(feature) {
    if (!feature?.path?.length) return;
    const pts = feature.path.map(([lon, lat]) => proj([lon, lat]));

    const normalizedScrollX = ((scrollX % MAP_W) + MAP_W) % MAP_W;
    const baseOffset = scrollX - normalizedScrollX;
    const viewWidthInMapUnits = canvasDisplayWidth / zoom;
    const viewLeft  = scrollX - viewWidthInMapUnits / 2;
    const viewRight = scrollX + viewWidthInMapUnits / 2;

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
          const px = (x + offset - scrollX) * zoom;
          const py = (y - scrollY) * zoom;
          if (j === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
      } else {
        // mountain dots
        ctx.fillStyle = 'rgba(180, 120, 60, 0.9)';
        for (const [x, y] of pts) {
          const px = (x + offset - scrollX) * zoom;
          const py = (y - scrollY) * zoom;
          ctx.beginPath();
          ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  function drawWorldMap() {
    if (!countryPaths.length) return;
    ctx.clearRect(0, 0, canvasDisplayWidth, canvasDisplayHeight);

    const viewWidthInMapUnits = canvasDisplayWidth / zoom;
    const viewLeft  = scrollX - viewWidthInMapUnits / 2;
    const viewRight = scrollX + viewWidthInMapUnits / 2;

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

    const normalizedScrollX = ((scrollX % MAP_W) + MAP_W) % MAP_W;
    const baseOffset = scrollX - normalizedScrollX;

    for (const country of countryPaths) {
      // Resolve GeoJSON ADMIN name to window.DATA name for highlight lookup
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

      for (let i = -1; i <= 1; i++) {
        const offset = baseOffset + i * MAP_W;
        if (offset + MAP_W >= viewLeft && offset <= viewRight) {
          drawCountry(country.paths, offset, fillStyle, strokeStyle, strokeWidth);
        }
      }
    }

    if (currentFeatureOverlay) {
      drawFeatureOverlay(currentFeatureOverlay);
    }
  }

  // ── Canvas resize ─────────────────────────────────────────────────────────

  function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvasDisplayWidth  = rect.width;
    canvasDisplayHeight = rect.height;

    minZoom = Math.max(canvasDisplayHeight / MAP_H, canvasDisplayWidth / MAP_W);
    if (zoom < minZoom) zoom = minZoom;

    canvas.style.width  = `${canvasDisplayWidth}px`;
    canvas.style.height = `${canvasDisplayHeight}px`;
    canvas.width  = canvasDisplayWidth * dpr;
    canvas.height = canvasDisplayHeight * dpr;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    drawWorldMap();
  }

  // ── Pan / zoom interaction ────────────────────────────────────────────────

  function attachCanvasInteraction() {
    const FRICTION    = 0.95;
    const MIN_VELOCITY = 0.1;

    function animate() {
      if (Math.abs(velocityX) > MIN_VELOCITY || Math.abs(velocityY) > MIN_VELOCITY) {
        scrollX += velocityX;
        scrollY += velocityY;
        const maxScrollY = Math.max(0, MAP_H - canvasDisplayHeight / zoom);
        if (scrollY < 0)          { scrollY = 0;          velocityY = 0; }
        if (scrollY > maxScrollY) { scrollY = maxScrollY; velocityY = 0; }
        velocityX *= FRICTION;
        velocityY *= FRICTION;
        drawWorldMap();
        animationFrameId = requestAnimationFrame(animate);
      } else {
        velocityX = velocityY = 0;
        animationFrameId = null;
      }
    }

    function startAnimation() {
      if (!animationFrameId) animationFrameId = requestAnimationFrame(animate);
    }

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const factor  = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(minZoom, Math.min(500, zoom * factor));
      const mapXBefore = mouseX / zoom + scrollX;
      const mapYBefore = mouseY / zoom + scrollY;
      zoom    = newZoom;
      scrollX = mapXBefore - mouseX / zoom;
      scrollY = Math.max(0, Math.min(Math.max(0, MAP_H - canvasDisplayHeight / zoom),
                mapYBefore - mouseY / zoom));
      drawWorldMap();
    }, { passive: false });

    let isPointerDown = false;
    let startX = 0, startY = 0, lastX = 0, lastY = 0, lastTime = 0;
    let isDragging = false;
    let touches = [];
    let initialPinchDist = 0, initialZoom = 1;
    let wasRecentlyPinching = false, pinchTimer = null, hadPinch = false;

    function getDistance(t1, t2) {
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }

    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (e.pointerType === 'touch') {
        touches.push(e);
        if (touches.length === 2) {
          initialPinchDist = getDistance(touches[0], touches[1]);
          initialZoom = zoom;
          isDragging = false;
          hadPinch = true;
        } else if (touches.length === 1) {
          hadPinch = false;
          isPointerDown = true;
          const rect = canvas.getBoundingClientRect();
          startX = lastX = e.clientX - rect.left;
          startY = lastY = e.clientY - rect.top;
          lastTime = Date.now();
          velocityX = velocityY = 0;
          isDragging = false;
        }
      } else {
        isPointerDown = true;
        const rect = canvas.getBoundingClientRect();
        startX = lastX = e.clientX - rect.left;
        startY = lastY = e.clientY - rect.top;
        lastTime = Date.now();
        velocityX = velocityY = 0;
        isDragging = false;
      }
    });

    canvas.addEventListener('pointermove', (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;

      if (e.pointerType === 'touch') {
        const idx = touches.findIndex(t => t.pointerId === e.pointerId);
        if (idx >= 0) touches[idx] = e;

        if (touches.length === 2) {
          isDragging = isPointerDown = false;
          const midX = (touches[0].clientX + touches[1].clientX) / 2 - rect.left;
          const midY = (touches[0].clientY + touches[1].clientY) / 2 - rect.top;
          const mapXB = midX / zoom + scrollX;
          const mapYB = midY / zoom + scrollY;
          const scale  = getDistance(touches[0], touches[1]) / initialPinchDist;
          const newZoom = Math.max(minZoom, Math.min(500, initialZoom * scale));
          scrollX = mapXB - midX / newZoom;
          scrollY = Math.max(0, Math.min(Math.max(0, MAP_H - canvasDisplayHeight / newZoom),
                    mapYB - midY / newZoom));
          zoom = newZoom;
          drawWorldMap();
          return;
        } else if (hadPinch && touches.length === 1) {
          wasRecentlyPinching = true;
          if (pinchTimer) clearTimeout(pinchTimer);
          pinchTimer = setTimeout(() => { wasRecentlyPinching = false; }, 400);
        }
      }

      if (isPointerDown) {
        const dx = currentX - lastX;
        const dy = currentY - lastY;
        const dt = Date.now() - lastTime;
        if (Math.abs(currentX - startX) > 5 || Math.abs(currentY - startY) > 5) {
          isDragging = true;
        }
        scrollX -= dx / zoom;
        scrollY  = Math.max(0, Math.min(Math.max(0, MAP_H - canvasDisplayHeight / zoom),
                   scrollY - dy / zoom));
        if (dt > 0) { velocityX = -dx / zoom; velocityY = -dy / zoom; }
        lastX = currentX; lastY = currentY; lastTime = Date.now();
        drawWorldMap();
      }
    });

    canvas.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'touch') {
        touches = touches.filter(t => t.pointerId !== e.pointerId);
        if (hadPinch && touches.length === 0) {
          wasRecentlyPinching = true;
          hadPinch = false;
          if (pinchTimer) clearTimeout(pinchTimer);
          pinchTimer = setTimeout(() => { wasRecentlyPinching = false; }, 400);
        }
        if (touches.length === 0) {
          isPointerDown = false;
          if (!isDragging && !wasRecentlyPinching && roundActive && !submitted) {
            const rect = canvas.getBoundingClientRect();
            handleMapClick(e.clientX - rect.left, e.clientY - rect.top);
          } else {
            startAnimation();
          }
        }
      } else {
        if (!isDragging && roundActive && !submitted) {
          const rect = canvas.getBoundingClientRect();
          handleMapClick(e.clientX - rect.left, e.clientY - rect.top);
        } else {
          startAnimation();
        }
        isPointerDown = false;
      }
    });

    canvas.addEventListener('pointercancel', () => {
      isPointerDown = false;
      touches = [];
    });

    canvas.style.touchAction = 'none';
    canvas.style.cursor = 'pointer';
  }

  // ── Map click handler ─────────────────────────────────────────────────────

  function handleMapClick(canvasX, canvasY) {
    if (!roundActive || submitted) return;
    const name = checkClickedCountry(canvasX, canvasY);
    if (!name) return;
    const action = logic.toggleCountry(name);
    if (action === 'added') {
      highlights.set(name, 'selected');
    } else {
      highlights.delete(name);
    }
    drawWorldMap();
  }

  // ── Button bar (absolute overlay inside mapwrap) ──────────────────────────

  function createButtons() {
    // 💡 Hint button — bottom-right corner, styled like Heritage game
    hintBtn = document.createElement('button');
    hintBtn.className = 'picture-hint-btn';
    hintBtn.title = 'Show hint (−1 point)';
    hintBtn.textContent = '💡';
    container.appendChild(hintBtn);

    // Submit / Next bar — centered at bottom
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
    submitBtn.style.cssText = btnBase + `
      background: rgba(59,130,246,0.25);
      border-color: rgba(59,130,246,0.6);
      color: #93c5fd;
    `;

    nextBtn = document.createElement('button');
    nextBtn.style.cssText = btnBase + `
      display: none;
      background: rgba(110,231,183,0.2);
      border-color: rgba(110,231,183,0.6);
      color: #6ee7b7;
    `;

    bar.appendChild(submitBtn);
    bar.appendChild(nextBtn);

    hintBtn.addEventListener('click', () => {
      if (hintBtn.disabled) return;
      const hint = logic.useHint();
      if (hintEl) {
        hintEl.textContent = hint;
        hintEl.style.display = '';
      }
      hintBtn.disabled = true;
      hintBtn.style.opacity = '0.4';
    });

    submitBtn.addEventListener('click', () => {
      if (!roundActive || submitted) return;
      doSubmit();
    });

    nextBtn.addEventListener('click', () => {
      doNextRound();
    });
  }

  // ── Round flow ────────────────────────────────────────────────────────────

  function doSubmit() {
    submitted = true;
    roundActive = false;

    submitBtn.style.display  = 'none';
    hintBtn.style.visibility = 'hidden'; // keep layout stable, just hide it

    const result = logic.submitAnswer();
    if (!result) return;

    // Update map highlights
    highlights = new Map();
    for (const c of result.correct) highlights.set(c, 'correct');
    for (const c of result.wrong)   highlights.set(c, 'wrong');
    for (const c of result.missed)  highlights.set(c, 'missed');

    // Draw the feature path
    currentFeatureOverlay = logic.current;
    drawWorldMap();

    updateUI();

    nextBtn.textContent     = logic.isComplete() ? 'Finish' : 'Next →';
    nextBtn.style.display   = '';
  }

  function doNextRound() {
    nextBtn.style.display = 'none';

    if (logic.isComplete()) {
      showFinish();
      return;
    }

    const feature = logic.nextRound();
    if (!feature) { showFinish(); return; }

    highlights = new Map();
    currentFeatureOverlay = null;
    submitted   = false;
    roundActive = true;

    if (featureNameEl) featureNameEl.textContent = feature.name;
    if (hintEl) { hintEl.textContent = ''; hintEl.style.display = 'none'; }
    hintBtn.disabled         = false;
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
    const accuracy = p.totalPossible > 0
      ? Math.round((p.score / p.totalPossible) * 100)
      : 0;

    renderFinishScreen(finalOverlay, {
      gameId,
      score:       p.score,
      scoreLabel:  'Points',
      maxScore:    p.totalPossible,
      time:        totalTime,
      accuracy,
      stats: [
        { label: 'countries in play', value: p.totalPossible },
      ],
      onPlayAgain: () => {
        finalOverlay.style.display = 'none';
        startGame();
      },
    });
  }

  // ── Start ─────────────────────────────────────────────────────────────────

  function startGame() {
    logic.reset();
    const feature = logic.nextRound();
    if (!feature) return;

    highlights = new Map();
    currentFeatureOverlay = null;
    submitted   = false;
    roundActive = true;

    if (featureNameEl) featureNameEl.textContent = feature.name;
    if (hintEl) { hintEl.textContent = ''; hintEl.style.display = 'none'; }
    if (hintBtn) {
      hintBtn.disabled      = false;
      hintBtn.style.opacity    = '1';
      hintBtn.style.visibility = '';
    }
    if (submitBtn) submitBtn.style.display = '';
    if (nextBtn)   nextBtn.style.display   = 'none';

    updateUI();
    drawWorldMap();
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  resizeCanvas();
  // Center on Greenwich meridian
  scrollX = MAP_W / 2 - canvasDisplayWidth / (2 * zoom);
  window.addEventListener('resize', resizeCanvas);

  createButtons();
  attachCanvasInteraction();

  if (initOverlay) initOverlay.style.display = 'none';

  startGame();
}
