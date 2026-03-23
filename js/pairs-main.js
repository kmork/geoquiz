import { PairsLogic } from './games/pairs-logic.js';
import { renderPairsUI } from './ui-components/pairs-ui.js';
import { shuffleArray, hapticFeedback } from './game-utils.js';
import { initConfetti } from './confetti.js';
import { renderFinishScreen } from './game-records.js';
import { loadGeoJSON } from './geojson-loader.js';
import { findGeoFeatures } from './aliases.js';
import { pathFromMainland, bboxOfMainlandLonLat, padBBox, proj } from './map-utils.js';

const params         = new URLSearchParams(location.search);
const roundsParam    = params.get('rounds') || 'all';
const maxPairs       = roundsParam === 'all' ? Infinity : (parseInt(roundsParam) || 10);
const continentParam = params.get('continent');
const continentSlug  = continentParam ? continentParam.toLowerCase().replace(/\s+/g, '-') : null;
const mode           = params.get('mode') || 'capitals';

const MODES = {
  capitals: {
    leftLabel: 'Countries',
    rightLabel: 'Capitals',
    subtitle: 'Match each country with its capital. One wrong guess ends the game.',
    buildPairs(data) {
      return data
        .filter(c => c.capitals && c.capitals.length > 0)
        .map(c => ({ left: c.country, right: c.capitals[0] }));
    },
  },
  peaks: {
    leftLabel: 'Countries',
    rightLabel: 'Peaks',
    subtitle: 'Match each country with its highest peak. One wrong guess ends the game.',
    buildPairs(data) {
      return data
        .filter(c => c.highestPeak && c.highestPeak.name)
        .map(c => ({ left: c.country, right: c.highestPeak.name }));
    },
  },
  cities: {
    leftLabel: 'Countries',
    rightLabel: 'Cities',
    subtitle: 'Match each country with one of its cities. One wrong guess ends the game.',
    buildPairs(data) {
      return data
        .filter(c => c.cities && c.cities.length > 0)
        .map(c => {
          const city = c.cities[Math.floor(Math.random() * c.cities.length)];
          return { left: c.country, right: city.name };
        });
    },
  },
  flags: {
    leftLabel: 'Countries',
    rightLabel: 'Flags',
    subtitle: 'Match each country with its flag. One wrong guess ends the game.',
    renderRight: 'flag',
    buildPairs(data) {
      return data
        .filter(c => c.flagCode)
        .map(c => ({ left: c.country, right: c.flagCode }));
    },
  },
  outlines: {
    leftLabel: 'Countries',
    rightLabel: 'Outlines',
    subtitle: 'Match each country with its outline. One wrong guess ends the game.',
    renderRight: 'outline',
    needsGeoJSON: true,
    buildPairs(data) {
      return data.map(c => ({ left: c.country, right: c.country }));
    },
  },
};

const modeConfig = MODES[mode] || MODES.capitals;

const baseGameId = mode === 'capitals' ? 'pairs' : `pairs-${mode}`;
const gameId     = continentSlug ? `${baseGameId}-${continentSlug}` : baseGameId;

const initOverlay  = document.getElementById('init-overlay');
const gameContent  = document.getElementById('game-content');
const scoreEl      = document.getElementById('score');
const remainingEl  = document.getElementById('remaining');
const finalOverlay = document.getElementById('finalOverlay');

const confetti = initConfetti('confetti');

let logic;
let ui;
let displayLeft  = [];
let displayRight = [];
let outlineData  = null; // Map<countryName, {pathData, viewBox}>

async function waitForData() {
  while (!window.DATA) {
    await new Promise(r => setTimeout(r, 50));
  }
}

async function init() {
  if (initOverlay) initOverlay.style.display = 'flex';

  const subtitleEl = document.getElementById('game-subtitle');
  if (subtitleEl) subtitleEl.textContent = modeConfig.subtitle;

  await waitForData();

  let data = window.DATA;
  if (continentParam) {
    const filtered = data.filter(c => c.continent === continentParam);
    if (filtered.length > 0) data = filtered;
  }

  if (modeConfig.needsGeoJSON) {
    const geo = await loadGeoJSON('data/ne_10m_admin_0_countries_route.geojson.gz');
    outlineData = new Map();
    for (const c of data) {
      const features = findGeoFeatures(geo.features, c.country);
      if (features.length === 0) continue;
      const pathData = features.map(f => pathFromMainland(f)).join(' ');
      let bb = bboxOfMainlandLonLat(features[0]);
      for (let i = 1; i < features.length; i++) {
        const b = bboxOfMainlandLonLat(features[i]);
        bb = {
          minLon: Math.min(bb.minLon, b.minLon),
          minLat: Math.min(bb.minLat, b.minLat),
          maxLon: Math.max(bb.maxLon, b.maxLon),
          maxLat: Math.max(bb.maxLat, b.maxLat),
        };
      }
      bb = padBBox(bb, 0.18);
      const [x1, y1] = proj([bb.minLon, bb.maxLat]);
      const [x2, y2] = proj([bb.maxLon, bb.minLat]);
      outlineData.set(c.country, {
        pathData,
        viewBox: `${x1} ${y1} ${x2 - x1} ${y2 - y1}`,
      });
    }
  }

  const pairs = modeConfig.buildPairs(data);
  logic = new PairsLogic({ pairs, maxPairs });
  logic.reset();

  if (initOverlay) initOverlay.style.display = 'none';

  render();
}

function render(left = null, right = null) {
  displayLeft  = left  ?? shuffleArray(logic.getVisibleLeft());
  displayRight = right ?? shuffleArray(logic.getVisibleRight());

  ui = renderPairsUI(gameContent, {
    leftItems:  displayLeft,
    rightItems: displayRight,
    leftLabel:  modeConfig.leftLabel,
    rightLabel: modeConfig.rightLabel,
    renderRight: modeConfig.renderRight,
    outlineData,
  });
  ui.setupEvents({ onAttempt: handleAttempt });
  updateUI();
}

function handleAttempt(left, right) {
  const result = logic.checkPair(left, right);

  if (result.correct) {
    hapticFeedback('correct');
    confetti?.burst?.({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

    ui.markCorrect(left, right, () => {
      if (result.isDone) { showFinal(); return; }

      const newLeft  = logic.getVisibleLeft();
      const newRight = logic.getVisibleRight();

      const addedLeft  = newLeft.find(c => !displayLeft.includes(c));
      const addedRight = newRight.find(c => !displayRight.includes(c));

      const nextLeft = displayLeft
        .map(c => c === left  ? addedLeft  : c)
        .filter(c => c !== undefined);
      const nextRight = displayRight
        .map(c => c === right ? addedRight : c)
        .filter(c => c !== undefined);

      render(nextLeft, nextRight);
    });
  } else {
    hapticFeedback('wrong');
    ui.markWrong(left, right, () => showFinal());
  }
}

function updateUI() {
  const progress = logic.getProgress();
  if (scoreEl)     scoreEl.textContent     = progress.score;
  if (remainingEl) remainingEl.textContent = progress.remaining;
}

function showFinal() {
  if (!finalOverlay) return;
  finalOverlay.style.display = 'flex';

  const progress = logic.getProgress();

  renderFinishScreen(finalOverlay, {
    gameId,
    score:      progress.score,
    scoreLabel: 'Streak',
    maxScore:   null,
    time:       logic.getElapsedTime(),
    accuracy:   0,
    shareUrl:   `geoquiz.info${location.pathname}${location.search}`,
    onPlayAgain: () => {
      logic.reset();
      render();
      updateUI();
    },
  });
}

init();
