/**
 * Place the Cities — Factory that wires logic + rendering together
 *
 * Loads data, draws country outlines with city dots, handles drag-and-drop
 * of city name labels to dots, and manages round flow.
 */

import { loadGeoJSON } from './geojson-loader.js';
import { OutlinesRenderer } from './ui-components/outlines-renderer.js';
import { PlaceCitiesLogic } from './games/place-cities-logic.js';
import { proj, getCSSVar } from './map-utils.js';
import { renderFinishScreen } from './game-records.js';
import { attachZoomPan } from './map-zoom-pan.js';
import { initConfetti } from './confetti.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export async function createPlaceCitiesGame({ svgEl, labelsEl, submitBtn, countryNameEl, scoreEl, progressEl, overlayEl, maxRounds, gameIdSuffix }) {
  // Load world GeoJSON + places
  const [worldData, placesData] = await Promise.all([
    loadGeoJSON('data/ne_10m_admin_0_countries.geojson.gz'),
    fetch('data/places.geojson').then(r => r.json()),
  ]);

  const renderer = new OutlinesRenderer(svgEl, worldData.features);
  const confetti = initConfetti('confetti');
  const countries = window.DATA;
  const logic = new PlaceCitiesLogic({ countries, maxRounds });
  logic.loadCapitalCoords(placesData.features);

  // State
  let currentPlaces = [];
  let dotElements = [];       // SVG circle elements
  let dotPositions = [];      // {x, y} in SVG coords
  let assignments = new Map(); // dotIndex -> placeName
  let submitted = false;

  function start() {
    logic.reset();
    nextRound();
  }

  function nextRound() {
    const round = logic.nextRound();
    if (!round) {
      finishGame();
      return;
    }

    submitted = false;
    assignments.clear();
    submitBtn.style.display = 'none';
    // Update UI
    countryNameEl.textContent = round.countryName;
    const prog = logic.getProgress();
    progressEl.textContent = `${prog.current} / ${prog.total}`;
    scoreEl.textContent = logic.totalScore;

    currentPlaces = round.places;

    // Draw country outline (resets viewBox to fit the country)
    zoomObserver.disconnect();
    renderer.drawCountries(round.countryName);

    // Add city dots
    dotElements = [];
    dotPositions = [];

    for (let i = 0; i < currentPlaces.length; i++) {
      const place = currentPlaces[i];
      const [x, y] = proj([place.lon, place.lat]);
      dotPositions.push({ x, y });

      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('cx', x);
      circle.setAttribute('cy', y);
      circle.classList.add('city-dot');
      if (place.isCapital) circle.classList.add('city-dot-capital');
      circle.dataset.dotIndex = i;
      svgEl.appendChild(circle);
      dotElements.push(circle);
    }

    // Set initial dot sizes and attach zoom/pan
    updateDotSizes();
    attachZoomPan(svgEl, () => renderer.getViewBox());
    // Re-scale dots whenever viewBox changes (zoom/pan)
    zoomObserver.observe(svgEl, { attributes: true, attributeFilter: ['viewBox'] });

    // Render draggable labels (shuffled)
    const shuffled = currentPlaces.map((p, i) => ({ name: p.name, index: i }))
      .sort(() => Math.random() - 0.5);

    labelsEl.innerHTML = '';
    for (const item of shuffled) {
      const chip = document.createElement('div');
      chip.className = 'city-label';
      chip.textContent = item.name;
      chip.dataset.placeName = item.name;
      chip.setAttribute('touch-action', 'none');
      labelsEl.appendChild(chip);
    }

    // Attach drag handlers
    setupDragHandlers();
  }

  function setupDragHandlers() {
    const labels = labelsEl.querySelectorAll('.city-label');

    for (const chip of labels) {
      chip.addEventListener('pointerdown', onPointerDown);
    }
  }

  // Keep dot radii at a fixed screen size regardless of zoom/viewBox aspect ratio.
  // getScreenCTM() gives the true SVG-units-per-pixel scale, accounting for
  // preserveAspectRatio (meet/slice) which viewBox.width/svgRect.width ignores.
  function updateDotSizes() {
    const ctm = svgEl.getScreenCTM();
    if (!ctm) return;
    const svgUnitsPerPx = 1 / ctm.a;  // ctm.a == ctm.d when aspect ratio preserved
    const r = svgUnitsPerPx * 7;
    const strokeW = svgUnitsPerPx * 1.5;
    for (const dot of dotElements) {
      dot.setAttribute('r', r);
      dot.setAttribute('stroke-width', strokeW);
    }
  }

  const zoomObserver = new MutationObserver(() => updateDotSizes());

  let ghostEl = null;
  let dragChip = null;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  /** Get the client-space center of the ghost element */
  function ghostCenter() {
    if (!ghostEl) return null;
    const r = ghostEl.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function onPointerDown(e) {
    if (submitted) return;
    e.preventDefault();

    const chip = e.currentTarget;
    const placeName = chip.dataset.placeName;

    // If this label is already placed, un-assign it
    if (chip.classList.contains('placed')) {
      for (const [dotIdx, name] of assignments) {
        if (name === placeName) {
          assignments.delete(dotIdx);
          dotElements[dotIdx].classList.remove('assigned');
          break;
        }
      }
      chip.classList.remove('placed');
      updateSubmitButton();
    }

    dragChip = chip;
    chip.classList.add('dragging');
    chip.setPointerCapture(e.pointerId);

    // Create ghost
    ghostEl = document.createElement('div');
    ghostEl.className = 'city-label-ghost';
    ghostEl.textContent = placeName;

    const rect = chip.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;

    ghostEl.style.left = (e.clientX - dragOffsetX) + 'px';
    ghostEl.style.top = (e.clientY - dragOffsetY) + 'px';
    ghostEl.style.width = rect.width + 'px';
    document.body.appendChild(ghostEl);

    chip.addEventListener('pointermove', onPointerMove);
    chip.addEventListener('pointerup', onPointerUp);
    chip.addEventListener('pointercancel', onPointerUp);
  }

  let highlightedDotIdx = -1;

  function findNearestDot(clientX, clientY) {
    const svgRect = svgEl.getBoundingClientRect();
    const vbBase = svgEl.viewBox.baseVal;
    const vb = { x: vbBase.x, y: vbBase.y, w: vbBase.width, h: vbBase.height };
    const svgX = vb.x + ((clientX - svgRect.left) / svgRect.width) * vb.w;
    const svgY = vb.y + ((clientY - svgRect.top) / svgRect.height) * vb.h;
    let bestDist = Infinity;
    let bestIdx = -1;
    for (let i = 0; i < dotPositions.length; i++) {
      const dx = dotPositions[i].x - svgX;
      const dy = dotPositions[i].y - svgY;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  function updateDotHighlight(clientX, clientY) {
    const nearest = findNearestDot(clientX, clientY);
    if (nearest !== highlightedDotIdx) {
      if (highlightedDotIdx >= 0) dotElements[highlightedDotIdx].classList.remove('nearest');
      highlightedDotIdx = nearest;
      if (highlightedDotIdx >= 0) dotElements[highlightedDotIdx].classList.add('nearest');
    }
  }

  function clearDotHighlight() {
    if (highlightedDotIdx >= 0) {
      dotElements[highlightedDotIdx].classList.remove('nearest');
      highlightedDotIdx = -1;
    }
  }

  function onPointerMove(e) {
    if (!ghostEl) return;
    ghostEl.style.left = (e.clientX - dragOffsetX) + 'px';
    ghostEl.style.top = (e.clientY - dragOffsetY) + 'px';
    const c = ghostCenter();
    if (c) updateDotHighlight(c.x, c.y);
  }

  function onPointerUp(e) {
    if (!ghostEl || !dragChip) return;

    const chip = dragChip;
    const placeName = chip.dataset.placeName;

    chip.removeEventListener('pointermove', onPointerMove);
    chip.removeEventListener('pointerup', onPointerUp);
    chip.removeEventListener('pointercancel', onPointerUp);
    chip.classList.remove('dragging');

    // Use ghost center for drop target, then clean up highlight
    const c = ghostCenter();
    const bestIdx = c ? findNearestDot(c.x, c.y) : -1;
    clearDotHighlight();

    if (bestIdx >= 0) {
      // If another label was on this dot, un-assign it
      if (assignments.has(bestIdx)) {
        const prevName = assignments.get(bestIdx);
        const prevChip = labelsEl.querySelector(`[data-place-name="${CSS.escape(prevName)}"]`);
        if (prevChip) {
          prevChip.classList.remove('placed');
        }
      }

      // If this label was previously assigned elsewhere, clear that
      for (const [dotIdx, name] of assignments) {
        if (name === placeName && dotIdx !== bestIdx) {
          assignments.delete(dotIdx);
          dotElements[dotIdx].classList.remove('assigned');
          break;
        }
      }

      assignments.set(bestIdx, placeName);
      dotElements[bestIdx].classList.add('assigned');
      chip.classList.add('placed');

    }

    // Clean up ghost
    ghostEl.remove();
    ghostEl = null;
    dragChip = null;

    updateSubmitButton();
  }

  function updateSubmitButton() {
    if (!submitted && assignments.size >= currentPlaces.length) {
      handleSubmit();
    }
  }

  function handleSubmit() {
    if (submitted) {
      // "Continue" after reviewing mistakes
      nextRound();
      return;
    }
    submitted = true;

    const assignmentArray = Array.from(assignments.entries()).map(([dotIndex, placeName]) => ({
      dotIndex,
      placeName,
    }));

    const result = logic.checkPlacements(assignmentArray, currentPlaces);
    scoreEl.textContent = logic.totalScore;

    // Show feedback on dots
    for (let i = 0; i < currentPlaces.length; i++) {
      const dot = dotElements[i];
      const res = result.results[i];
      dot.classList.add(res.correct ? 'correct' : 'wrong');

      // Show correct name next to wrong dots
      if (!res.correct) {
        const ctm = svgEl.getScreenCTM();
        const svgPx = ctm ? 1 / ctm.a : 1;
        const corrFontSize = svgPx * 11;
        const corrOffset = svgPx * 14;
        const text = document.createElementNS(SVG_NS, 'text');
        text.setAttribute('x', dotPositions[i].x);
        text.setAttribute('y', dotPositions[i].y - corrOffset);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', corrFontSize);
        text.setAttribute('fill', getCSSVar('--bad-color') || '#fda4af');
        text.setAttribute('pointer-events', 'none');
        text.classList.add('city-correction-label');
        text.textContent = currentPlaces[i].name;
        svgEl.appendChild(text);
      }
    }

    // Update label chips feedback
    for (const chip of labelsEl.querySelectorAll('.city-label')) {
      chip.removeEventListener('pointerdown', onPointerDown);
      const name = chip.dataset.placeName;
      // Find if this name was assigned to the right dot
      for (const [dotIdx, assignedName] of assignments) {
        if (assignedName === name) {
          chip.classList.add(result.results[dotIdx].correct ? 'label-correct' : 'label-wrong');
          break;
        }
      }
    }

    if (result.correct === result.total) {
      // All correct — confetti + auto-advance
      confetti?.burst?.({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      setTimeout(() => {
        if (submitted) nextRound();
      }, 1200);
    } else {
      // Show score and Continue button so user can review mistakes
      submitBtn.textContent = 'Continue';
      submitBtn.style.display = '';
      submitBtn.disabled = false;
    }
  }

  function finishGame() {
    const time = logic.getElapsedSeconds();
    const accuracy = logic.getAccuracy();
    const gameId = `place-cities-${gameIdSuffix}`;

    renderFinishScreen(overlayEl, {
      gameId,
      score: logic.totalScore,
      scoreLabel: 'Cities',
      maxScore: logic.totalPlaces,
      time,
      accuracy,
      onPlayAgain: () => start(),
    });

    overlayEl.style.display = 'flex';
  }

  // Wire submit button
  submitBtn.addEventListener('click', handleSubmit);

  return { start };
}
