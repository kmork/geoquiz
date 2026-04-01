/**
 * Map Jigsaw — Factory that wires logic + SVG rendering + drag-and-drop
 *
 * Loads GeoJSON, builds country pieces, handles drag-and-drop with
 * auto-snap feedback, and manages game flow.
 */

import { loadGeoJSON } from './geojson-loader.js';
import { proj, pathFromMainland, bboxOfMainlandLonLat, padBBox } from './map-utils.js';
import { findGeoFeature } from './aliases.js';
import { renderFinishScreen } from './game-records.js';
import { attachZoomPan } from './map-zoom-pan.js';
import { initConfetti, playPing } from './confetti.js';
import { JigsawLogic } from './games/jigsaw-logic.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Map continent name → short CSS class suffix */
function continentSlug(continent) {
  const map = {
    'Africa': 'af',
    'Asia': 'as',
    'Europe': 'eu',
    'Americas': 'am',
    'North America': 'na',
    'South America': 'sa',
    'Oceania': 'oc',
  };
  return map[continent] || 'oc';
}

/**
 * Compute the centroid (center of bounding box) in projected SVG coords
 * for a GeoJSON feature's mainland polygons.
 */
function featureCentroid(feature) {
  const bb = bboxOfMainlandLonLat(feature);
  const midLon = (bb.minLon + bb.maxLon) / 2;
  const midLat = (bb.minLat + bb.maxLat) / 2;
  return proj([midLon, midLat]);
}

/**
 * Build an SVG <path> element in the given namespace.
 */
function createPath(d, className) {
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', d);
  if (className) path.setAttribute('class', className);
  return path;
}

export async function createJigsawGame({
  svgEl, trayEl, scoreEl, progressEl, overlayEl,
  continentName, majorOnly, showNames, gameIdSuffix,
}) {
  const worldData = await loadGeoJSON('data/ne_10m_admin_0_countries.geojson.gz');
  const worldFeatures = worldData.features;
  const confetti = initConfetti('confetti');

  // Filter countries for this continent
  let countries = window.DATA.slice();
  if (continentName) {
    countries = countries.filter(c => c.continent === continentName);
  }

  // Major mode: take largest by area
  if (majorOnly) {
    countries.sort((a, b) => (b.area || 0) - (a.area || 0));
    countries = countries.slice(0, Math.min(15, countries.length));
  }

  // Match each country to its GeoJSON feature and build piece data
  const MIN_AREA = 500; // skip micro-states smaller than 500 km²
  const piecesData = [];
  for (const c of countries) {
    if ((c.area || 0) < MIN_AREA && !majorOnly) continue;
    const feature = findGeoFeature(worldFeatures, c.country);
    if (!feature) continue;
    const d = pathFromMainland(feature);
    if (!d) continue;
    const [cx, cy] = featureCentroid(feature);
    piecesData.push({
      country: c.country,
      continent: c.continent,
      feature,
      pathD: d,
      centroidX: cx,
      centroidY: cy,
    });
  }

  // Compute continent bounding box in projected SVG coords
  let unionBB = null;
  for (const p of piecesData) {
    const bb = bboxOfMainlandLonLat(p.feature);
    if (!unionBB) {
      unionBB = { ...bb };
    } else {
      unionBB.minLon = Math.min(unionBB.minLon, bb.minLon);
      unionBB.minLat = Math.min(unionBB.minLat, bb.minLat);
      unionBB.maxLon = Math.max(unionBB.maxLon, bb.maxLon);
      unionBB.maxLat = Math.max(unionBB.maxLat, bb.maxLat);
    }
  }

  const padded = padBBox(unionBB, 0.08);
  const [vbX1, vbY1] = proj([padded.minLon, padded.maxLat]); // top-left
  const [vbX2, vbY2] = proj([padded.maxLon, padded.minLat]); // bottom-right
  const vbW = vbX2 - vbX1;
  const vbH = vbY2 - vbY1;

  // Snap threshold: ~1.5% of the continent view width
  const snapThreshold = vbW * 0.015;

  // Initialize logic
  const logic = new JigsawLogic(piecesData.map(p => ({
    country: p.country,
    centroidX: p.centroidX,
    centroidY: p.centroidY,
  })));

  // ─── Pool / queue state ─────────────────────────────────────

  let queueIndices = [];
  let visibleIndices = [];

  // Wrap tray in a container with nav arrows
  const trayWrap = document.createElement('div');
  trayWrap.className = 'jigsaw-tray-wrap';
  trayEl.parentNode.insertBefore(trayWrap, trayEl);

  const prevArrow = document.createElement('button');
  prevArrow.className = 'jigsaw-tray-arrow jigsaw-tray-arrow-prev';
  prevArrow.textContent = '‹';
  prevArrow.setAttribute('aria-label', 'Previous pieces');

  const nextArrow = document.createElement('button');
  nextArrow.className = 'jigsaw-tray-arrow jigsaw-tray-arrow-next';
  nextArrow.textContent = '›';
  nextArrow.setAttribute('aria-label', 'Next pieces');

  trayWrap.appendChild(prevArrow);
  trayWrap.appendChild(trayEl);
  trayWrap.appendChild(nextArrow);

  function updateArrows() {
    const hasQueue = queueIndices.length > 0;
    prevArrow.style.display = hasQueue ? '' : 'none';
    nextArrow.style.display = hasQueue ? '' : 'none';
  }

  function rotatePieces(direction) {
    if (queueIndices.length === 0) return;
    const capacity = visibleIndices.length;

    if (direction > 0) {
      // Next: move visible to front of queue, take from end of queue
      queueIndices.unshift(...visibleIndices);
      visibleIndices = queueIndices.splice(-capacity);
    } else {
      // Prev: move visible to end of queue, take from front of queue
      queueIndices.push(...visibleIndices);
      visibleIndices = queueIndices.splice(0, capacity);
    }

    // Re-render just the pieces
    trayEl.innerHTML = '';
    for (const idx of visibleIndices) createPieceElement(idx);
    updateArrows();
  }

  prevArrow.addEventListener('click', () => rotatePieces(-1));
  nextArrow.addEventListener('click', () => rotatePieces(1));

  // Hint toggle: cycle through 3 levels
  // 0 = off (3 pts), 1 = country names (2 pts), 2 = names + continent colors (1 pt)
  const hintBtn = document.createElement('button');
  hintBtn.className = 'jigsaw-hint-btn';
  hintBtn.textContent = '💡';
  hintBtn.title = 'Toggle hints';
  const mapwrap = svgEl.parentElement;
  mapwrap.style.position = 'relative';
  mapwrap.appendChild(hintBtn);

  let hintLevel = showNames ? 1 : 0;

  function applyHintLevel() {
    trayEl.classList.toggle('show-labels', hintLevel >= 1);
    trayEl.classList.toggle('show-continent-colors', hintLevel >= 2);
    svgEl.classList.toggle('show-continent-colors', hintLevel >= 2);
    hintBtn.classList.toggle('active', hintLevel > 0);
  }
  applyHintLevel();

  hintBtn.addEventListener('click', () => {
    hintLevel = (hintLevel + 1) % 3;
    applyHintLevel();
  });

  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  const isMobile = window.innerWidth <= 600;

  function computePoolCapacity() {
    const total = piecesData.length;
    const piece = isMobile ? 60 : 80;
    const gap = 8;
    const availW = trayEl.clientWidth;
    const cols = Math.max(3, Math.floor((availW + gap) / (piece + gap)));

    // Mobile: show all pieces in scrollable row
    if (isMobile) return total;

    // Desktop: use 2 rows only if enough pieces to fill both rows
    if (total > cols * 2) return cols * 2;
    if (total > cols) return cols;
    return total;
  }

  // ─── Render target map ───────────────────────────────────────

  function renderMap() {
    svgEl.innerHTML = '';
    svgEl.setAttribute('viewBox', `${vbX1} ${vbY1} ${vbW} ${vbH}`);

    // Draw each country as an individual land shape (for continent coloring)
    for (const p of piecesData) {
      const slug = continentSlug(p.continent);
      const land = createPath(p.pathD, `jigsaw-land cont-${slug}`);
      land.setAttribute('vector-effect', 'non-scaling-stroke');
      svgEl.appendChild(land);
    }
  }

  // ─── Piece element creation ────────────────────────────────

  function createPieceElement(idx) {
    const p = piecesData[idx];

    const bb = bboxOfMainlandLonLat(p.feature);
    const pbb = padBBox(bb, 0.15);
    const [tx1, ty1] = proj([pbb.minLon, pbb.maxLat]);
    const [tx2, ty2] = proj([pbb.maxLon, pbb.minLat]);
    const tw = tx2 - tx1;
    const th = ty2 - ty1;

    const slug = continentSlug(p.continent);
    const piece = document.createElement('div');
    piece.className = 'jigsaw-piece';
    piece.dataset.pieceIndex = idx;
    piece.dataset.continent = slug;

    const thumbSvg = document.createElementNS(SVG_NS, 'svg');
    thumbSvg.setAttribute('viewBox', `${tx1} ${ty1} ${tw} ${th}`);
    thumbSvg.setAttribute('width', '100%');
    thumbSvg.setAttribute('height', '100%');
    thumbSvg.style.pointerEvents = 'none';

    const thumbPath = createPath(p.pathD, `jigsaw-thumb-path cont-${slug}`);
    thumbPath.setAttribute('vector-effect', 'non-scaling-stroke');
    thumbSvg.appendChild(thumbPath);
    piece.appendChild(thumbSvg);

    const label = document.createElement('div');
    label.className = 'jigsaw-piece-label';
    label.textContent = p.country;
    piece.appendChild(label);

    piece.addEventListener('pointerdown', onPointerDown);
    trayEl.appendChild(piece);
    return piece;
  }

  // ─── Render piece tray ───────────────────────────────────────

  function renderTray() {
    trayEl.innerHTML = '';

    const allIndices = shuffleArray(piecesData.map((_, i) => i));
    const capacity = computePoolCapacity();

    if (!isMobile) {
      // Desktop: set max-height to enforce row limit
      const piece = 80;
      const gap = 8;
      const cols = Math.max(3, Math.floor((trayEl.clientWidth + gap) / (piece + gap)));
      const rows = Math.ceil(Math.min(capacity, allIndices.length) / cols);
      trayEl.style.maxHeight = (rows * piece + (rows - 1) * gap + 24) + 'px';
    }

    if (allIndices.length <= capacity) {
      visibleIndices = allIndices;
      queueIndices = [];
    } else {
      visibleIndices = allIndices.slice(0, capacity);
      queueIndices = allIndices.slice(capacity);
    }

    for (const idx of visibleIndices) createPieceElement(idx);
    updateArrows();
  }

  // ─── Drag-and-drop ───────────────────────────────────────────

  let zoomPan = null;
  let ghostEl = null;
  let dragPiece = null;
  let edgePanRAF = null;

  function ghostCenter() {
    if (!ghostEl) return null;
    const r = ghostEl.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function clientToSvg(clientX, clientY) {
    const pt = svgEl.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svgEl.getScreenCTM();
    if (!ctm) return null;
    return pt.matrixTransform(ctm.inverse());
  }

  function startDrag(piece, e) {
    e.preventDefault();
    dragPiece = piece;
    piece.classList.add('dragging');
    piece.setPointerCapture(e.pointerId);

    const idx = parseInt(piece.dataset.pieceIndex);
    const p = piecesData[idx];

    // Create ghost: a floating SVG of the country shape, sized to match the map
    ghostEl = document.createElement('div');
    ghostEl.className = hintLevel >= 2 ? 'jigsaw-ghost show-continent-colors' : 'jigsaw-ghost';

    // Use getScreenCTM to compute exact pixel size matching the map
    const ctm = svgEl.getScreenCTM();
    const pxPerSvgUnit = ctm ? ctm.a : 1; // pixels per SVG unit

    const bb = bboxOfMainlandLonLat(p.feature);
    const pbb = padBBox(bb, 0.1);
    const [tx1, ty1] = proj([pbb.minLon, pbb.maxLat]);
    const [tx2, ty2] = proj([pbb.maxLon, pbb.minLat]);
    const tw = tx2 - tx1;
    const th = ty2 - ty1;

    // Ghost matches the country's on-screen size on the map
    const ghostW = tw * pxPerSvgUnit;
    const ghostH = th * pxPerSvgUnit;

    ghostEl.style.width = ghostW + 'px';
    ghostEl.style.height = ghostH + 'px';

    const ghostSvg = document.createElementNS(SVG_NS, 'svg');
    ghostSvg.setAttribute('viewBox', `${tx1} ${ty1} ${tw} ${th}`);
    ghostSvg.setAttribute('width', '100%');
    ghostSvg.setAttribute('height', '100%');
    ghostSvg.style.pointerEvents = 'none';

    const ghostPath = createPath(p.pathD, `jigsaw-ghost-path cont-${continentSlug(p.continent)}`);
    ghostPath.setAttribute('vector-effect', 'non-scaling-stroke');
    ghostSvg.appendChild(ghostPath);
    ghostEl.appendChild(ghostSvg);

    // Center ghost under cursor
    ghostEl.style.left = (e.clientX - ghostW / 2) + 'px';
    ghostEl.style.top = (e.clientY - ghostH / 2) + 'px';
    document.body.appendChild(ghostEl);

    piece.addEventListener('pointermove', onPointerMove);
    piece.addEventListener('pointerup', onPointerUp);
    piece.addEventListener('pointercancel', onPointerUp);
  }

  function onPointerDown(e) {
    const piece = e.currentTarget;
    if (piece.classList.contains('placed')) return;

    if (!isMobile) {
      startDrag(piece, e);
      return;
    }

    // Mobile: defer drag until we know the user intends to drag (vertical)
    // rather than scroll the tray (horizontal)
    const startX = e.clientX;
    const startY = e.clientY;
    let resolved = false;

    const onFirstMove = (me) => {
      if (resolved) return;
      const dx = Math.abs(me.clientX - startX);
      const dy = Math.abs(me.clientY - startY);
      if (dx < 8 && dy < 8) return; // not enough movement to decide
      resolved = true;
      piece.removeEventListener('pointermove', onFirstMove);
      piece.removeEventListener('pointerup', onCancel);
      piece.removeEventListener('pointercancel', onCancel);
      if (dy > dx) {
        // Vertical movement: start drag
        startDrag(piece, me);
      }
      // Horizontal movement: do nothing, let native scroll handle it
    };

    const onCancel = () => {
      resolved = true;
      piece.removeEventListener('pointermove', onFirstMove);
      piece.removeEventListener('pointerup', onCancel);
      piece.removeEventListener('pointercancel', onCancel);
    };

    piece.addEventListener('pointermove', onFirstMove);
    piece.addEventListener('pointerup', onCancel);
    piece.addEventListener('pointercancel', onCancel);
  }

  function snapPiece(idx, piece, ghost) {
    logic.markPlaced(idx, hintLevel);
    const p = piecesData[idx];

    let finalized = false;
    function finalize() {
      if (finalized) return;
      finalized = true;
      if (ghost) { ghost.remove(); }
      playPing();
      const slug = continentSlug(p.continent);
      const snapped = createPath(p.pathD, `jigsaw-snapped cont-${slug}`);
      snapped.setAttribute('vector-effect', 'non-scaling-stroke');
      svgEl.appendChild(snapped);

      piece.removeEventListener('pointerdown', onPointerDown);
      piece.remove();
      visibleIndices = visibleIndices.filter(i => i !== idx);
      if (queueIndices.length > 0) {
        const nextIdx = queueIndices.shift();
        visibleIndices.push(nextIdx);
        createPieceElement(nextIdx);
      }
      updateArrows();

      const prog = logic.getProgress();
      scoreEl.textContent = `${prog.score} / ${prog.maxScore}`;
      progressEl.textContent = `${prog.placed} / ${prog.total}`;

      if (logic.isComplete()) {
        confetti?.burst?.({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
        setTimeout(() => finishGame(), 800);
      }
    }

    if (!ghost) { finalize(); return; }

    // Compute where the centroid falls inside the ghost's local coordinate system.
    // The ghost's inner SVG viewBox starts at the padded bounding box origin,
    // so the centroid offset (as a fraction of the ghost size) determines its
    // pixel position within the ghost.
    const ctm = svgEl.getScreenCTM();
    if (!ctm) { finalize(); return; }
    const bb = bboxOfMainlandLonLat(p.feature);
    const pbb = padBBox(bb, 0.1);
    const [vx1, vy1] = proj([pbb.minLon, pbb.maxLat]);
    const [vx2, vy2] = proj([pbb.maxLon, pbb.minLat]);
    const vw = vx2 - vx1;
    const vh = vy2 - vy1;

    // Fraction of the ghost where the centroid sits
    const fracX = (p.centroidX - vx1) / vw;
    const fracY = (p.centroidY - vy1) / vh;

    // Screen position the centroid should land on
    const pt = svgEl.createSVGPoint();
    pt.x = p.centroidX;
    pt.y = p.centroidY;
    const screenPt = pt.matrixTransform(ctm);

    const gw = ghost.offsetWidth;
    const gh = ghost.offsetHeight;

    ghost.style.transition = 'left 0.15s ease-out, top 0.15s ease-out';
    ghost.style.left = (screenPt.x - gw * fracX) + 'px';
    ghost.style.top = (screenPt.y - gh * fracY) + 'px';
    ghost.addEventListener('transitionend', finalize, { once: true });
    // Fallback in case transitionend doesn't fire
    setTimeout(finalize, 200);
  }

  function cleanUpDrag(piece, keepGhost) {
    piece.removeEventListener('pointermove', onPointerMove);
    piece.removeEventListener('pointerup', onPointerUp);
    piece.removeEventListener('pointercancel', onPointerUp);
    piece.classList.remove('dragging');
    if (!keepGhost && ghostEl) { ghostEl.remove(); ghostEl = null; }
    dragPiece = null;
    stopEdgePan();
  }

  // Edge-pan: pan the map when dragging near the SVG border
  const EDGE_ZONE = isMobile ? 50 : 40; // px from edge to start panning
  const PAN_SPEED = isMobile ? 0.008 : 0.004; // fraction of viewBox per frame

  let lastPointer = null;

  function stopEdgePan() {
    if (edgePanRAF) { cancelAnimationFrame(edgePanRAF); edgePanRAF = null; }
    lastPointer = null;
  }

  function edgePanLoop() {
    edgePanRAF = null;
    if (!ghostEl || !dragPiece || !zoomPan || !lastPointer) return;

    const rect = svgEl.getBoundingClientRect();
    const cx = lastPointer.x;
    const cy = lastPointer.y;

    // Only edge-pan when cursor is inside the SVG bounds
    const inside = cx >= rect.left && cx <= rect.right && cy >= rect.top && cy <= rect.bottom;
    let dx = 0, dy = 0;
    if (inside) {
      if (cx < rect.left + EDGE_ZONE) dx = -(1 - (cx - rect.left) / EDGE_ZONE);
      else if (cx > rect.right - EDGE_ZONE) dx = 1 - (rect.right - cx) / EDGE_ZONE;
      if (cy < rect.top + EDGE_ZONE) dy = -(1 - (cy - rect.top) / EDGE_ZONE);
      else if (cy > rect.bottom - EDGE_ZONE) dy = 1 - (rect.bottom - cy) / EDGE_ZONE;
    }

    if (dx !== 0 || dy !== 0) {
      const vb = svgEl.viewBox.baseVal;
      zoomPan.panBy(dx * vb.width * PAN_SPEED, dy * vb.height * PAN_SPEED);
    }

    edgePanRAF = requestAnimationFrame(edgePanLoop);
  }

  function onPointerMove(e) {
    if (!ghostEl) return;
    ghostEl.style.left = (e.clientX - ghostEl.offsetWidth / 2) + 'px';
    ghostEl.style.top = (e.clientY - ghostEl.offsetHeight / 2) + 'px';
    lastPointer = { x: e.clientX, y: e.clientY };

    // Start edge-pan loop if not running
    if (!edgePanRAF) edgePanRAF = requestAnimationFrame(edgePanLoop);

    // Auto-snap when close enough
    const c = ghostCenter();
    if (!c) return;
    const svgPt = clientToSvg(c.x, c.y);
    if (!svgPt) return;
    const piece = dragPiece;
    const idx = parseInt(piece.dataset.pieceIndex);
    if (logic.isWithinThreshold(idx, svgPt.x, svgPt.y, snapThreshold)) {
      const ghost = ghostEl;
      ghostEl = null;
      cleanUpDrag(piece, true);
      snapPiece(idx, piece, ghost);
    }
  }

  function onPointerUp(e) {
    if (!ghostEl || !dragPiece) return;

    const piece = dragPiece;
    const idx = parseInt(piece.dataset.pieceIndex);

    // Determine drop position in SVG coords
    const c = ghostCenter();
    let svgPt = null;
    if (c) svgPt = clientToSvg(c.x, c.y);

    // Check placement
    const result = svgPt ? logic.checkPlacement(idx, svgPt.x, svgPt.y, snapThreshold) : null;

    if (result?.correct) {
      const ghost = ghostEl;
      ghostEl = null;
      cleanUpDrag(piece, true);
      snapPiece(idx, piece, ghost);
    } else {
      cleanUpDrag(piece);
      if (svgPt) {
        // Reject: shake the tray piece
        piece.classList.add('jigsaw-reject');
        setTimeout(() => piece.classList.remove('jigsaw-reject'), 400);
      }
    }
  }


  // ─── Finish game ─────────────────────────────────────────────

  function finishGame() {
    const time = logic.getElapsedSeconds();
    const accuracy = logic.getAccuracy();
    const prog = logic.getProgress();
    const gameId = `jigsaw-${gameIdSuffix}`;

    renderFinishScreen(overlayEl, {
      gameId,
      score: prog.score,
      scoreLabel: 'Score',
      maxScore: prog.maxScore,
      time,
      accuracy,
      onPlayAgain: () => start(),
    });

    overlayEl.style.display = 'flex';
  }

  // ─── Start / restart ────────────────────────────────────────

  function start() {
    overlayEl.style.display = 'none';
    logic.reset();
    renderMap();
    renderTray();
    // Reset zoom-pan flag so it can re-attach after Play Again
    delete svgEl.dataset.zoomPanAttached;
    zoomPan = attachZoomPan(svgEl, () => ({ x: vbX1, y: vbY1, w: vbW, h: vbH }));

    const prog = logic.getProgress();
    scoreEl.textContent = `${prog.score} / ${prog.maxScore}`;
    progressEl.textContent = `${prog.placed} / ${prog.total}`;
  }

  return { start };
}
