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

// Safe-dial click sound via Web Audio API
function createClickSound() {
  let audioCtx = null;
  let clickBuffer = null;

  function init() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    // Pre-generate a short noise-burst click buffer
    const sampleRate = audioCtx.sampleRate;
    const length = Math.floor(sampleRate * 0.008); // 8ms
    clickBuffer = audioCtx.createBuffer(1, length, sampleRate);
    const data = clickBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      // Sharp attack, fast decay — mimics a mechanical detent
      const envelope = Math.exp(-i / (length * 0.15));
      data[i] = (Math.random() * 2 - 1) * envelope;
    }
  }

  function play() {
    if (!audioCtx || !clickBuffer) init();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const source = audioCtx.createBufferSource();
    const gain = audioCtx.createGain();
    source.buffer = clickBuffer;
    source.connect(gain);
    gain.connect(audioCtx.destination);
    gain.gain.value = 0.1;
    source.start();
  }

  return { play, init };
}

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

  // Build neighbors lookup from unified window.DATA
  const NEIGHBORS = Object.fromEntries((window.ALL_COUNTRIES || window.DATA).map(c => [c.country, c.neighbors]));

  // Rotation state
  let currentRotation = 0;
  let rotationGroup = null;

  function drawCountry(targetCountry) {
    renderer.drawCountries(targetCountry, []);
    wrapPathsInRotationGroup();
    // Reset hint state for new round
    hideHintPanel();
    hintUsed = false;
    if (hintBtn) hintBtn.style.opacity = '1';
  }

  function wrapPathsInRotationGroup() {
    const paths = Array.from(svgMap.querySelectorAll('path'));
    rotationGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    rotationGroup.style.transition = 'none';
    paths.forEach(p => rotationGroup.appendChild(p));
    svgMap.appendChild(rotationGroup);
  }

  // Reveal correct answer with neighbors (rotate & guess mode)
  function revealAnswer(targetCountry, neighborCountries) {
    hideHintPanel();
    // Save current viewBox so neighbors don't shift the map
    const savedVB = svgMap.getAttribute('viewBox');
    renderer.drawCountries(targetCountry, neighborCountries);
    if (savedVB) svgMap.setAttribute('viewBox', savedVB);
    wrapPathsInRotationGroup();
    // Set rotation to 0 (correct orientation) with no transition
    const { cx, cy } = getViewBoxCenter();
    rotationGroup.setAttribute('transform', `rotate(0, ${cx}, ${cy})`);
  }

  // Hint UI state
  let hintBtn = null;
  let hintPanel = null;
  let hintUsed = false;

  function hideHintPanel() {
    if (hintPanel) hintPanel.classList.remove('visible');
  }

  function showHintPanel(currentCountryName) {
    if (!hintPanel) return;
    const nbrs = NEIGHBORS[currentCountryName] || [];
    const text = nbrs.length === 0
      ? 'Island nation — no land borders'
      : 'Neighboring countries are now shown on the map';
    hintPanel.querySelector('.find-hint-list').innerHTML = `<li>${text}</li>`;
    hintPanel.classList.add('visible');
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

  // Drag-to-rotate with safe-dial click sound
  const clickSound = createClickSound();

  function attachDragRotate() {
    const svgEl = svgMap;
    svgEl.style.touchAction = 'none';
    svgEl.style.cursor = 'grab';

    let isDragging = false;
    let startPointerAngle = 0;
    let baseRotation = 0;
    let lastClickDeg = null;

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
      clickSound.init(); // ensure AudioContext is created on user gesture
      isDragging = true;
      svgEl.setPointerCapture(e.pointerId);
      startPointerAngle = pointerAngle(e.clientX, e.clientY);
      baseRotation = currentRotation;
      lastClickDeg = Math.round(currentRotation);
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

      // Play click for each degree crossed
      const deg = Math.round(currentRotation);
      if (lastClickDeg !== null && deg !== lastClickDeg) {
        clickSound.play();
        lastClickDeg = deg;
      }
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
    revealAnswer: rotateOnly ? null : revealAnswer,
    neighbors: NEIGHBORS,
    config: {
      maxRounds,
      gameIdSuffix,
      rotateOnly,
      gamePrefix,
    }
  });

  // Hint UI (only for rotate & guess mode)
  if (!rotateOnly) {
    const mapwrap = svgMap.parentElement;

    hintBtn = document.createElement('button');
    hintBtn.className = 'picture-hint-btn';
    hintBtn.textContent = '💡';
    hintBtn.title = 'Show hint';
    mapwrap.appendChild(hintBtn);

    hintPanel = document.createElement('div');
    hintPanel.className = 'find-hint-panel';
    hintPanel.innerHTML =
      '<div class="find-hint-panel-header"><span>💡 Hint</span></div>' +
      '<ul class="find-hint-list"></ul>';
    mapwrap.appendChild(hintPanel);

    hintPanel.addEventListener('click', () => hideHintPanel());

    hintBtn.addEventListener('click', () => {
      if (hintPanel.classList.contains('visible')) {
        hideHintPanel();
        return;
      }
      const currentCountry = game?.getCurrent?.();
      if (!currentCountry) return;
      if (!hintUsed) {
        const nbrs = NEIGHBORS[currentCountry] || [];
        if (nbrs.length > 0) {
          const savedVB = svgMap.getAttribute('viewBox');
          renderer.drawCountries(currentCountry, nbrs);
          if (savedVB) svgMap.setAttribute('viewBox', savedVB);
          wrapPathsInRotationGroup();
          // Re-apply current rotation
          const { cx, cy } = getViewBoxCenter();
          rotationGroup.setAttribute('transform', `rotate(${currentRotation}, ${cx}, ${cy})`);
        }
        hintUsed = true;
        game?.markHintUsed?.();
        hintBtn.style.opacity = '0.5';
      }
      showHintPanel(currentCountry);
    });
  }

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
