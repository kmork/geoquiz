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
import { initConfetti } from './confetti.js';
import { JigsawLogic } from './games/jigsaw-logic.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

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

  // Snap threshold: ~2.5% of the continent view width
  const snapThreshold = vbW * 0.025;

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

  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function computePoolCapacity() {
    const total = piecesData.length;
    const mobile = window.innerWidth <= 600;
    const piece = mobile ? 60 : 80;
    const gap = 8;
    const availW = trayEl.clientWidth;
    const cols = Math.max(3, Math.floor((availW + gap) / (piece + gap)));

    // Mobile: always 1 row to maximize map space
    if (mobile) return cols;

    // Desktop: use 2 rows only if enough pieces to fill both rows
    if (total > cols * 2) return cols * 2;
    if (total > cols) return cols;
    return total;
  }

  // ─── Render target map ───────────────────────────────────────

  function renderMap() {
    svgEl.innerHTML = '';
    svgEl.setAttribute('viewBox', `${vbX1} ${vbY1} ${vbW} ${vbH}`);

    // Draw all countries as a single landmass — coastlines only, no internal borders
    const allPaths = piecesData.map(p => p.pathD).join(' ');
    const land = createPath(allPaths, 'jigsaw-land');
    land.setAttribute('vector-effect', 'non-scaling-stroke');
    svgEl.appendChild(land);
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

    const piece = document.createElement('div');
    piece.className = 'jigsaw-piece';
    piece.dataset.pieceIndex = idx;
    piece.setAttribute('touch-action', 'none');

    const thumbSvg = document.createElementNS(SVG_NS, 'svg');
    thumbSvg.setAttribute('viewBox', `${tx1} ${ty1} ${tw} ${th}`);
    thumbSvg.setAttribute('width', '100%');
    thumbSvg.setAttribute('height', '100%');
    thumbSvg.style.pointerEvents = 'none';

    const thumbPath = createPath(p.pathD, 'jigsaw-thumb-path');
    thumbPath.setAttribute('vector-effect', 'non-scaling-stroke');
    thumbSvg.appendChild(thumbPath);
    piece.appendChild(thumbSvg);

    if (showNames) {
      const label = document.createElement('div');
      label.className = 'jigsaw-piece-label';
      label.textContent = p.country;
      piece.appendChild(label);
    }

    piece.addEventListener('pointerdown', onPointerDown);
    trayEl.appendChild(piece);
    return piece;
  }

  // ─── Render piece tray ───────────────────────────────────────

  function renderTray() {
    trayEl.innerHTML = '';

    const allIndices = shuffleArray(piecesData.map((_, i) => i));
    const capacity = computePoolCapacity();

    // Set max-height to enforce row limit (prevents overflow on resize)
    const mobile = window.innerWidth <= 600;
    const piece = mobile ? 60 : 80;
    const gap = 8;
    const cols = Math.max(3, Math.floor((trayEl.clientWidth + gap) / (piece + gap)));
    const rows = Math.ceil(Math.min(capacity, allIndices.length) / cols);
    trayEl.style.maxHeight = (rows * piece + (rows - 1) * gap + 24) + 'px'; // +24 for padding

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

  let ghostEl = null;
  let dragPiece = null;

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

  function onPointerDown(e) {
    const piece = e.currentTarget;
    if (piece.classList.contains('placed')) return;
    e.preventDefault();

    dragPiece = piece;
    piece.classList.add('dragging');
    piece.setPointerCapture(e.pointerId);

    const idx = parseInt(piece.dataset.pieceIndex);
    const p = piecesData[idx];

    // Create ghost: a floating SVG of the country shape, sized to match the map
    ghostEl = document.createElement('div');
    ghostEl.className = 'jigsaw-ghost';

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

    const ghostPath = createPath(p.pathD, 'jigsaw-ghost-path');
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

  function onPointerMove(e) {
    if (!ghostEl) return;
    ghostEl.style.left = (e.clientX - ghostEl.offsetWidth / 2) + 'px';
    ghostEl.style.top = (e.clientY - ghostEl.offsetHeight / 2) + 'px';
  }

  function onPointerUp(e) {
    if (!ghostEl || !dragPiece) return;

    const piece = dragPiece;
    const idx = parseInt(piece.dataset.pieceIndex);

    piece.removeEventListener('pointermove', onPointerMove);
    piece.removeEventListener('pointerup', onPointerUp);
    piece.removeEventListener('pointercancel', onPointerUp);
    piece.classList.remove('dragging');

    // Determine drop position in SVG coords
    const c = ghostCenter();
    let svgPt = null;
    if (c) svgPt = clientToSvg(c.x, c.y);

    // Clean up ghost
    ghostEl.remove();
    ghostEl = null;
    dragPiece = null;

    if (!svgPt) return;

    // Check placement
    const result = logic.checkPlacement(idx, svgPt.x, svgPt.y, snapThreshold);

    if (result.correct) {
      // Snap: add the piece to the map SVG
      logic.markPlaced(idx);
      const p = piecesData[idx];
      const snapped = createPath(p.pathD, 'jigsaw-snapped');
      snapped.setAttribute('vector-effect', 'non-scaling-stroke');
      svgEl.appendChild(snapped);

      // Remove placed piece from tray and pull next from queue
      piece.removeEventListener('pointerdown', onPointerDown);
      piece.remove();
      visibleIndices = visibleIndices.filter(i => i !== idx);
      if (queueIndices.length > 0) {
        const nextIdx = queueIndices.shift();
        visibleIndices.push(nextIdx);
        createPieceElement(nextIdx);
      }
      updateArrows();

      // Update progress
      const prog = logic.getProgress();
      scoreEl.textContent = prog.score;
      progressEl.textContent = `${prog.placed} / ${prog.total}`;

      // Check completion
      if (logic.isComplete()) {
        confetti?.burst?.({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
        setTimeout(() => finishGame(), 800);
      }
    } else {
      // Reject: shake the tray piece
      piece.classList.add('jigsaw-reject');
      setTimeout(() => piece.classList.remove('jigsaw-reject'), 400);
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
      scoreLabel: 'Correct',
      maxScore: prog.total,
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
    attachZoomPan(svgEl, () => ({ x: vbX1, y: vbY1, w: vbW, h: vbH }));

    const prog = logic.getProgress();
    scoreEl.textContent = prog.score;
    progressEl.textContent = `${prog.placed} / ${prog.total}`;
  }

  return { start };
}
