/**
 * Rotated Outlines - Complete Game Factory
 * Creates a rotated outlines game with SVG rendering and drag-to-rotate.
 * Supports two modes:
 *   - rotateOnly=false (default): player must rotate AND guess the country name
 *   - rotateOnly=true: country name is shown, player only rotates
 */

import { createRotatedGame } from "./rotated-game.js";
import { initConfetti } from "./confetti.js";
import { OutlinesRenderer } from "./ui-components/outlines-renderer.js";
import { COUNTRY_ALIASES } from "./aliases.js";
import { loadGeoJSON } from "./geojson-loader.js";

export async function createCompleteRotatedGame({
  container,
  svgMap,
  answerInput,
  submitBtn,
  ui = {},
  maxRounds = 10,
  gameIdSuffix = 'short',
  rotateOnly = false,
  gamePrefix = 'rotated',
}) {
  // Load world data
  const worldData = await loadGeoJSON('data/ne_10m_admin_0_countries_route.geojson.gz');
  const WORLD = worldData.features;

  // Create renderer
  const renderer = new OutlinesRenderer(svgMap, WORLD, {
    aliases: COUNTRY_ALIASES
  });

  // Rotation state
  let currentRotation = 0;
  let rotationGroup = null;

  function drawCountry(targetCountry) {
    renderer.drawCountries(targetCountry, []);

    // Wrap all paths in a <g> for rotation
    const paths = Array.from(svgMap.querySelectorAll('path'));
    rotationGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    rotationGroup.style.transition = 'none';

    paths.forEach(p => rotationGroup.appendChild(p));
    svgMap.appendChild(rotationGroup);
  }

  function getViewBoxCenter() {
    const vb = svgMap.viewBox.baseVal;
    return { cx: vb.x + vb.width / 2, cy: vb.y + vb.height / 2 };
  }

  function setRotation(deg) {
    currentRotation = deg;
    if (!rotationGroup) return;
    rotationGroup.style.transition = 'none';
    const { cx, cy } = getViewBoxCenter();
    rotationGroup.setAttribute('transform', `rotate(${deg}, ${cx}, ${cy})`);
  }

  function getRotation() {
    return currentRotation;
  }

  function animateToCorrect() {
    if (!rotationGroup) return;
    const { cx, cy } = getViewBoxCenter();
    // Normalize to [0, 360) and pick shortest path to 0°
    let norm = ((currentRotation % 360) + 360) % 360;
    const target = norm <= 180 ? 0 : 360;
    // Set current position explicitly so the transition starts from here
    rotationGroup.style.transition = 'none';
    rotationGroup.setAttribute('transform', `rotate(${norm}, ${cx}, ${cy})`);
    // Force reflow, then animate to target
    rotationGroup.getBoundingClientRect();
    rotationGroup.style.transition = 'transform 0.5s ease-out';
    rotationGroup.setAttribute('transform', `rotate(${target}, ${cx}, ${cy})`);
    currentRotation = 0;
  }

  // Drag-to-rotate
  function attachDragRotate() {
    const svgEl = svgMap;
    svgEl.style.touchAction = 'none';
    svgEl.style.cursor = 'grab';

    let isDragging = false;
    let startPointerAngle = 0;
    let baseRotation = 0;

    function getSvgCenter() {
      const rect = svgEl.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }

    function pointerAngle(clientX, clientY) {
      const center = getSvgCenter();
      return Math.atan2(clientY - center.y, clientX - center.x) * (180 / Math.PI);
    }

    svgEl.addEventListener('pointerdown', (e) => {
      if (!rotationGroup) return;
      isDragging = true;
      svgEl.setPointerCapture(e.pointerId);
      startPointerAngle = pointerAngle(e.clientX, e.clientY);
      baseRotation = currentRotation;
      svgEl.style.cursor = 'grabbing';
      rotationGroup.style.transition = 'none';
    });

    svgEl.addEventListener('pointermove', (e) => {
      if (!isDragging || !rotationGroup) return;
      const current = pointerAngle(e.clientX, e.clientY);
      const delta = current - startPointerAngle;
      currentRotation = baseRotation + delta;
      const { cx, cy } = getViewBoxCenter();
      rotationGroup.setAttribute('transform', `rotate(${currentRotation}, ${cx}, ${cy})`);
    });

    const endDrag = () => {
      if (!isDragging) return;
      isDragging = false;
      svgEl.style.cursor = 'grab';
    };

    svgEl.addEventListener('pointerup', endDrag);
    svgEl.addEventListener('pointercancel', endDrag);

    // Prevent default gestures
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(t => {
      svgEl.addEventListener(t, e => e.preventDefault(), { passive: false });
    });
    svgEl.addEventListener('wheel', e => e.preventDefault(), { passive: false });
  }

  attachDragRotate();

  // Create confetti
  const confetti = initConfetti("confetti");

  // Full UI
  const fullUI = {
    map: svgMap,
    answerInput,
    submitBtn,
    scoreEl: ui.scoreEl || null,
    progressEl: ui.progressEl || null,
    statusEl: ui.statusEl || null,
    finalOverlay: ui.finalOverlay || null,
  };

  // Create game instance
  let game = createRotatedGame({
    ui: fullUI,
    confetti,
    drawCountry,
    setRotation,
    getRotation,
    animateToCorrect,
    config: {
      maxRounds,
      gameIdSuffix,
      rotateOnly,
      gamePrefix,
    }
  });

  // Setup autocomplete (only for rotate & guess mode)
  if (!rotateOnly && window.DATA && Array.isArray(window.DATA)) {
    const countryNames = window.DATA.map(c => c.country).filter(Boolean);
    const countrySet = new Set(countryNames);
    Object.entries(COUNTRY_ALIASES).forEach(([alias, target]) => {
      if (countrySet.has(target) && !countrySet.has(alias)) countryNames.push(alias);
    });
    countryNames.sort();

    if (typeof window.initMobileAutocomplete === 'function') {
      window.initMobileAutocomplete(answerInput, countryNames, { onSelect: () => submitBtn.click() });
    } else {
      let datalist = answerInput.list;
      if (!datalist) {
        datalist = document.createElement('datalist');
        datalist.id = 'rotated-countries-' + Math.random().toString(36).substr(2, 9);
        answerInput.setAttribute('list', datalist.id);
        document.body.appendChild(datalist);
      }
      datalist.innerHTML = countryNames.map(name => `<option value="${name}">`).join('');
    }
  }

  return {
    game,
    nextQ: () => game.nextQ(),
    reset: () => game.reset(),
  };
}
