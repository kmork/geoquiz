/**
 * Study Mode — interactive world map with country info panel.
 *
 * Desktop: hover over a country to see its info panel in real-time.
 * Mobile: tap a country to show its info panel; tap again (or ocean) to hide.
 */

import { norm } from './utils.js';
import { loadGeoJSON } from './geojson-loader.js';
import {
  MAP_W, MAP_H, proj, getCSSVar,
  buildCountryPaths, buildNameLookups,
  checkClickedCountry, drawCountry, visibleOffsets,
  setupCanvas, createPanZoom,
} from './canvas-map-engine.js';

// ── DOM references ────────────────────────────────────────────────────────────

const canvas = document.getElementById('map');
const ctx = canvas.getContext('2d');
const dpr = window.devicePixelRatio || 1;
const infoPanel = document.getElementById('study-info');
const studyPage = document.querySelector('.study-page');
const heritagePopup     = document.getElementById('heritage-popup');
const heritagePopupImg  = document.getElementById('heritage-popup-img');
const heritagePopupName = document.getElementById('heritage-popup-name');
const heritagePopupMeta = document.getElementById('heritage-popup-meta');

let canvasDisplayWidth = 600;
let canvasDisplayHeight = 320;

// Viewport — shared with pan/zoom engine
const viewport = { scrollX: 0, scrollY: 0, zoom: 1, minZoom: 1, velocityX: 0, velocityY: 0 };

// Hovered/selected country (DATA name)
let hoveredCountry = null;
// Currently hovered overlay object (river/mountain/heritage site data object)
let hoveredOverlay = null;

// Label toggle state
let showCountryNames = false;
let capitalMode = 0; // 0 = off, 1 = dots, 2 = dots + names

// Overlay toggle state
let showRivers    = false;
let showMountains = false;
let showHeritage  = false;

// ── Load data (parallel) ──────────────────────────────────────────────────────

const [worldData, placesData, countriesFlags, neighborsData, riversData, mountainsData, heritageSitesData] = await Promise.all([
  loadGeoJSON('data/ne_10m_admin_0_countries.geojson.gz'),
  fetch('data/places.geojson').then(r => r.json()),
  fetch('data/countries-flags.json').then(r => r.json()),
  fetch('data/countries-neighbors.json').then(r => r.json()),
  fetch('data/rivers.json').then(r => r.json()),
  fetch('data/mountains.json').then(r => r.json()),
  fetch('data/heritage-sites.json').then(r => r.json()),
]);

const WORLD = worldData.features;

// ── Build map data ────────────────────────────────────────────────────────────

const { countryPaths, hitTestPaths, microCountries } = buildCountryPaths(WORLD);
const { dataToGeo, geoToData, resolveToDataName } = buildNameLookups(countryPaths);

// GeoJSON properties map: norm(geoAdminName) → feature.properties
const geoPropsMap = new Map();
for (const feature of WORLD) {
  const admin = feature.properties.ADMIN || '';
  if (admin) geoPropsMap.set(norm(admin), feature.properties);
}

// Capital cities from places.geojson (Admin-0 capitals only)
// Key: DATA country name → { name, lon, lat }
const capitalDots = new Map();
for (const feature of placesData.features) {
  const p = feature.properties;
  if (p.FEATURECLA !== 'Admin-0 capital') continue;
  const [lon, lat] = feature.geometry.coordinates;
  const geoCountry = p.ADM0NAME;
  const dataName = geoToData[geoCountry] || resolveToDataName(geoCountry);
  if (dataName) {
    capitalDots.set(dataName, { name: p.NAME, lon, lat });
  }
}

// ── Drawing ───────────────────────────────────────────────────────────────────

function drawLabel(text, x, y, fontSize, opts = {}) {
  const { color, shadowColor, shadowWidth = opts.lightMode ? 4 : 3 } = opts;
  ctx.font = `${opts.bold ? '700' : '500'} ${fontSize}px "DM Sans", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = shadowColor;
  ctx.lineWidth = shadowWidth;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function drawWorldMap() {
  ctx.clearRect(0, 0, canvasDisplayWidth, canvasDisplayHeight);

  const isLight = document.documentElement.classList.contains('light-mode');

  const defaultFill   = getCSSVar('--map-country-fill')   || 'rgba(165,180,252,.08)';
  const defaultStroke = getCSSVar('--map-country-stroke') || 'rgba(232,236,255,.3)';
  const hoverFill     = getCSSVar('--map-country-fill-highlight') || 'rgba(165,180,252,.25)';

  // Theme-aware label and dot colors
  const labelColor  = isLight ? 'rgba(15,20,40,0.88)'    : 'rgba(255,255,255,0.92)';
  const labelHalo   = isLight ? 'rgba(255,255,255,0.88)' : 'rgba(0,0,0,0.7)';
  const dotFill     = isLight ? 'rgba(220,38,38,1)'      : 'rgba(255,255,255,0.85)';
  const dotStroke   = isLight ? null                     : 'rgba(0,0,0,0.4)';
  const capColor    = isLight ? 'rgba(15,20,40,0.88)'    : 'rgba(255,255,255,0.9)';
  const capHalo     = isLight ? 'rgba(255,255,255,0.88)' : 'rgba(0,0,0,0.65)';

  // Theme-aware overlay colors
  const riverColor            = isLight ? 'rgba(37,99,235,0.8)'   : 'rgba(96,165,250,0.75)';
  const mountainColor         = isLight ? 'rgba(146,64,14,0.85)'  : 'rgba(180,120,60,0.85)';
  const heritageColorCultural = isLight ? 'rgba(161,98,7,0.9)'    : 'rgba(251,191,36,0.9)';
  const heritageColorNatural  = isLight ? 'rgba(21,128,61,0.9)'   : 'rgba(52,211,153,0.9)';

  const offsets = visibleOffsets(viewport, canvasDisplayWidth);

  // ── Countries ──────────────────────────────────────────────────────────────

  for (const country of countryPaths) {
    const dataName = geoToData[country.name] || resolveToDataName(country.name);
    const isHovered = dataName && dataName === hoveredCountry;

    const fill   = isHovered ? hoverFill : defaultFill;
    const stroke = isHovered ? (getCSSVar('--map-selected-stroke') || 'rgba(165,180,252,0.95)') : defaultStroke;
    const sw     = isHovered ? 1.2 : 0.5;

    for (const offset of offsets) {
      drawCountry(ctx, viewport, country.paths, offset, fill, stroke, sw);
    }
  }

  // ── Rivers ─────────────────────────────────────────────────────────────────

  if (showRivers) {
    ctx.save();
    ctx.strokeStyle = riverColor;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const river of riversData) {
      const pts = river.path.map(([lon, lat]) => proj([lon, lat]));
      for (const offset of offsets) {
        ctx.beginPath();
        let first = true;
        for (const [x, y] of pts) {
          const px = (x + offset - viewport.scrollX) * viewport.zoom;
          const py = (y - viewport.scrollY) * viewport.zoom;
          if (first) { ctx.moveTo(px, py); first = false; }
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // ── Mountain ranges ────────────────────────────────────────────────────────

  if (showMountains) {
    ctx.save();

    // Lines connecting path points (drawn first, under the dots)
    ctx.strokeStyle = mountainColor;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const range of mountainsData) {
      const pts = range.path.map(([lon, lat]) => proj([lon, lat]));
      for (const offset of offsets) {
        ctx.beginPath();
        let first = true;
        for (const [x, y] of pts) {
          const px = (x + offset - viewport.scrollX) * viewport.zoom;
          const py = (y - viewport.scrollY) * viewport.zoom;
          if (first) { ctx.moveTo(px, py); first = false; }
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    }

    // Dots on top
    const r = Math.max(1.5, 2.5 / viewport.zoom);
    ctx.fillStyle = mountainColor;
    for (const range of mountainsData) {
      const pts = range.path.map(([lon, lat]) => proj([lon, lat]));
      for (const offset of offsets) {
        for (const [x, y] of pts) {
          const px = (x + offset - viewport.scrollX) * viewport.zoom;
          const py = (y - viewport.scrollY) * viewport.zoom;
          if (px < -10 || px > canvasDisplayWidth + 10 || py < -10 || py > canvasDisplayHeight + 10) continue;
          ctx.beginPath();
          ctx.arc(px, py, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }

  // ── Heritage sites ─────────────────────────────────────────────────────────

  if (showHeritage) {
    ctx.save();
    const s = 5;
    for (const site of heritageSitesData) {
      if (site.lat == null || site.lon == null) continue;
      const [mx, my] = proj([site.lon, site.lat]);
      for (const offset of offsets) {
        const px = (mx + offset - viewport.scrollX) * viewport.zoom;
        const py = (my - viewport.scrollY) * viewport.zoom;
        if (px < -10 || px > canvasDisplayWidth + 10 || py < -10 || py > canvasDisplayHeight + 10) continue;
        ctx.beginPath();
        ctx.moveTo(px,     py - s);
        ctx.lineTo(px + s, py);
        ctx.lineTo(px,     py + s);
        ctx.lineTo(px - s, py);
        ctx.closePath();
        ctx.fillStyle = site.type === 'natural' ? heritageColorNatural : heritageColorCultural;
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // ── Country name labels ────────────────────────────────────────────────────

  if (showCountryNames && viewport.zoom > 1.5) {
    ctx.save();
    // Only label countries whose rendered width is large enough to be readable
    const MIN_PX = 10; // minimum rendered size in CSS px
    for (const country of countryPaths) {
      // For the visibility threshold, use the smaller of:
      //   - the overall bbox (good for compact island groups like Cabo Verde)
      //   - labelRingSize × 8 (caps wildly scattered nations like US Minor Outlying Islands)
      // Font sizing still uses labelRingSize alone to avoid inflated text.
      const thresholdSize = Math.min(country.bboxSize, country.labelRingSize * 8);
      if (thresholdSize * viewport.zoom < MIN_PX) continue;
      const renderedSize = country.labelRingSize * viewport.zoom;

      const dataName = geoToData[country.name] || resolveToDataName(country.name);
      const label = dataName || country.name;

      // Font size: scales with rendered size of the main territory, capped for readability
      const fontSize = Math.max(9, Math.min(14, renderedSize * 0.11));

      for (const offset of offsets) {
        const cx = (country.labelCx + offset - viewport.scrollX) * viewport.zoom;
        const cy = (country.labelCy - viewport.scrollY) * viewport.zoom;

        // Skip if centroid is off-screen (with generous margin for labels)
        if (cx < -80 || cx > canvasDisplayWidth + 80 || cy < -20 || cy > canvasDisplayHeight + 20) continue;

        drawLabel(label, cx, cy, fontSize, { bold: renderedSize > 60, color: labelColor, shadowColor: labelHalo, lightMode: isLight });
      }
    }
    ctx.restore();
  }

  // ── Capital dots + names ───────────────────────────────────────────────────

  if (capitalMode > 0) {
    const dotR = Math.max(1.5, 2.5 / viewport.zoom);
    ctx.save();

    for (const [, cap] of capitalDots) {
      const [mx, my] = proj([cap.lon, cap.lat]);

      for (const offset of offsets) {
        const px = (mx + offset - viewport.scrollX) * viewport.zoom;
        const py = (my - viewport.scrollY) * viewport.zoom;

        if (px < -10 || px > canvasDisplayWidth + 10 || py < -10 || py > canvasDisplayHeight + 10) continue;

        if (isLight) {
          ctx.beginPath();
          ctx.arc(px, py, dotR + 1.5, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(px, py, dotR, 0, Math.PI * 2);
        ctx.fillStyle = dotFill;
        ctx.fill();
        if (dotStroke) {
          ctx.strokeStyle = dotStroke;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }

    if (capitalMode === 2 && viewport.zoom > 1.5) {
      const fontSize = Math.max(9, Math.min(12, viewport.zoom * 2.5));
      for (const [, cap] of capitalDots) {
        const [mx, my] = proj([cap.lon, cap.lat]);

        for (const offset of offsets) {
          const px = (mx + offset - viewport.scrollX) * viewport.zoom;
          const py = (my - viewport.scrollY) * viewport.zoom;

          if (px < -80 || px > canvasDisplayWidth + 80 || py < -20 || py > canvasDisplayHeight + 20) continue;

          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.font = `500 ${fontSize}px "DM Sans", sans-serif`;
          ctx.lineJoin = 'round';
          ctx.strokeStyle = capHalo;
          ctx.lineWidth = 3;
          ctx.strokeText(cap.name, px + dotR + 3, py);
          ctx.fillStyle = capColor;
          ctx.fillText(cap.name, px + dotR + 3, py);
        }
      }
    }

    ctx.restore();
  }
}

// ── Info panel ────────────────────────────────────────────────────────────────

function formatPop(pop) {
  if (pop >= 1e9) return `${(pop / 1e9).toFixed(1)} billion`;
  if (pop >= 1e6) return `~${Math.round(pop / 1e6)} million`;
  if (pop >= 1000) return `~${Math.round(pop / 1000)}K`;
  return `${pop}`;
}

function updateInfoPanel(dataName) {
  if (!dataName) {
    hideInfoPanel();
    return;
  }

  const geoName = dataToGeo[dataName] || dataName;
  const props = geoPropsMap.get(norm(geoName));

  const iso2 = countriesFlags[dataName] || (props?.ISO_A2 !== '-99' ? props?.ISO_A2?.toLowerCase() : props?.ISO_A2_EH?.toLowerCase());
  const flagSrc = (iso2 && iso2 !== '-99') ? `img/flags/${iso2}.svg` : '';
  const subregion = props?.SUBREGION || props?.CONTINENT || '';
  const entry = (window.DATA || []).find(d => d.country === dataName);
  const capital = entry?.capitals?.[0] || '—';
  const popStr = props?.POP_EST ? formatPop(props.POP_EST) : '—';

  const nbrs = neighborsData?.[dataName];
  const bordersStr = nbrs == null ? '—' : nbrs.length === 0 ? 'Island nation' : nbrs.join(', ');

  infoPanel.innerHTML = `
    <div class="study-info-header">
      ${flagSrc ? `<img class="study-info-flag" src="${flagSrc}" alt="${dataName} flag">` : '<div class="study-info-flag-placeholder"></div>'}
      <div>
        <div class="study-info-name">${dataName}</div>
        ${subregion ? `<div class="study-info-region">${subregion}</div>` : ''}
      </div>
    </div>
    <div class="study-info-divider"></div>
    <div class="study-info-rows">
      <div class="study-info-row"><span>Capital</span><span>${capital}</span></div>
      <div class="study-info-row"><span>Population</span><span>${popStr}</span></div>
      <div class="study-info-row study-info-borders"><span>Borders</span><span>${bordersStr}</span></div>
    </div>
  `;
  infoPanel.style.display = 'block';
}

function hideInfoPanel() {
  infoPanel.style.display = 'none';
}

// ── Overlay hit-testing ───────────────────────────────────────────────────────

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function findRiverAtPoint(cx, cy) {
  if (!showRivers) return null;
  const offsets = visibleOffsets(viewport, canvasDisplayWidth);
  const HIT = 6;
  for (const river of riversData) {
    const pts = river.path.map(([lon, lat]) => proj([lon, lat]));
    for (const offset of offsets) {
      const sp = pts.map(([x, y]) => [
        (x + offset - viewport.scrollX) * viewport.zoom,
        (y - viewport.scrollY) * viewport.zoom,
      ]);
      for (let i = 0; i < sp.length - 1; i++) {
        if (distToSegment(cx, cy, sp[i][0], sp[i][1], sp[i+1][0], sp[i+1][1]) <= HIT) return river;
      }
    }
  }
  return null;
}

function findMountainAtPoint(cx, cy) {
  if (!showMountains) return null;
  const offsets = visibleOffsets(viewport, canvasDisplayWidth);
  const HIT = 8;
  for (const range of mountainsData) {
    const pts = range.path.map(([lon, lat]) => proj([lon, lat]));
    for (const offset of offsets) {
      const sp = pts.map(([x, y]) => [
        (x + offset - viewport.scrollX) * viewport.zoom,
        (y - viewport.scrollY) * viewport.zoom,
      ]);
      for (let i = 0; i < sp.length; i++) {
        if (Math.abs(cx - sp[i][0]) + Math.abs(cy - sp[i][1]) <= HIT) return range;
        if (i < sp.length - 1 && distToSegment(cx, cy, sp[i][0], sp[i][1], sp[i+1][0], sp[i+1][1]) <= HIT) return range;
      }
    }
  }
  return null;
}

// ── Overlay info-panel renderers ──────────────────────────────────────────────

function updateInfoPanelForHeritage(site) {
  const typeLabel = site.type === 'natural' ? 'Natural' : 'Cultural';
  const bg = site.type === 'natural' ? 'rgba(21,128,61,0.2)' : 'rgba(161,98,7,0.2)';
  infoPanel.innerHTML = `
    <div class="study-info-header">
      <div class="study-info-overlay-icon" style="background:${bg}">🏛️</div>
      <div>
        <div class="study-info-name">${site.siteName}</div>
        <div class="study-info-region">${site.country} · ${typeLabel}</div>
      </div>
    </div>
    <div class="study-info-divider"></div>
    <div class="study-info-rows">
      <div class="study-info-row"><span>Inscribed</span><span>${site.year}</span></div>
    </div>
  `;
  infoPanel.style.display = 'block';
}

function updateInfoPanelForRiver(river) {
  infoPanel.innerHTML = `
    <div class="study-info-header">
      <div class="study-info-overlay-icon" style="background:rgba(37,99,235,0.15)">〰️</div>
      <div>
        <div class="study-info-name">${river.name}</div>
        <div class="study-info-region">River</div>
      </div>
    </div>
    <div class="study-info-divider"></div>
    <div class="study-info-rows">
      <div class="study-info-row study-info-borders"><span>Countries</span><span>${river.countries.join(', ')}</span></div>
    </div>
  `;
  infoPanel.style.display = 'block';
}

function updateInfoPanelForMountain(range) {
  const highest = range.peaks?.[0];
  const highestStr = highest ? `${highest.name} (${highest.elev.toLocaleString()} m)` : '—';
  infoPanel.innerHTML = `
    <div class="study-info-header">
      <div class="study-info-overlay-icon" style="background:rgba(146,64,14,0.15)">⛰️</div>
      <div>
        <div class="study-info-name">${range.name}</div>
        <div class="study-info-region">Mountain range</div>
      </div>
    </div>
    <div class="study-info-divider"></div>
    <div class="study-info-rows">
      <div class="study-info-row study-info-borders"><span>Countries</span><span>${range.countries.join(', ')}</span></div>
      <div class="study-info-row"><span>Highest</span><span>${highestStr}</span></div>
    </div>
  `;
  infoPanel.style.display = 'block';
}

// ── Heritage site popup ───────────────────────────────────────────────────────

let heritagePopupVisible = false;

function findHeritageAtPoint(cx, cy) {
  if (!showHeritage) return null;
  const offsets = visibleOffsets(viewport, canvasDisplayWidth);
  const HIT = 10; // px hit radius (Manhattan distance matches diamond shape)
  for (const site of heritageSitesData) {
    if (site.lat == null || site.lon == null) continue;
    const [mx, my] = proj([site.lon, site.lat]);
    for (const offset of offsets) {
      const px = (mx + offset - viewport.scrollX) * viewport.zoom;
      const py = (my - viewport.scrollY) * viewport.zoom;
      if (Math.abs(cx - px) + Math.abs(cy - py) <= HIT) return site;
    }
  }
  return null;
}

function showHeritagePopup(site) {
  heritagePopupImg.src = site.imageUrl;
  heritagePopupImg.alt = site.siteName;
  heritagePopupImg.style.height = Math.min(420, Math.max(200, canvasDisplayHeight * 0.55)) + 'px';
  heritagePopup.style.width = Math.min(500, Math.max(320, canvasDisplayWidth * 0.36)) + 'px';
  heritagePopupName.textContent = site.siteName;
  const typeLabel = site.type === 'natural' ? 'Natural' : 'Cultural';
  heritagePopupMeta.textContent = `${site.country} · ${typeLabel} · ${site.year}`;
  heritagePopup.style.display = 'block';
  heritagePopupVisible = true;
}

function hideHeritagePopup() {
  heritagePopup.style.display = 'none';
  heritagePopupVisible = false;
}

document.getElementById('heritage-popup-close').addEventListener('click', hideHeritagePopup);


// ── Toggle buttons ────────────────────────────────────────────────────────────

function createMapToggles() {
  const mapwrap = canvas.parentElement;

  const bar = document.createElement('div');
  bar.className = 'study-map-toggles';

  const btnCountry = document.createElement('button');
  btnCountry.className = 'study-toggle-btn';
  btnCountry.title = 'Toggle country names';
  btnCountry.textContent = '🏷️';

  const btnCapital = document.createElement('button');
  btnCapital.className = 'study-toggle-btn';
  btnCapital.title = 'Show capital dots';
  btnCapital.textContent = '★';

  btnCapital.dataset.mode = '0';

  const btnRivers = document.createElement('button');
  btnRivers.className = 'study-toggle-btn';
  btnRivers.title = 'Toggle rivers';
  btnRivers.textContent = '〰️';

  const btnMountains = document.createElement('button');
  btnMountains.className = 'study-toggle-btn';
  btnMountains.title = 'Toggle mountain ranges';
  btnMountains.textContent = '⛰️';

  const btnHeritage = document.createElement('button');
  btnHeritage.className = 'study-toggle-btn';
  btnHeritage.title = 'Toggle UNESCO heritage sites';
  btnHeritage.textContent = '🏛️';

  // Stack: 🏷️ ★ 〰️ ⛰️ 🏛️
  bar.appendChild(btnCountry);
  bar.appendChild(btnCapital);
  bar.appendChild(btnRivers);
  bar.appendChild(btnMountains);
  bar.appendChild(btnHeritage);
  mapwrap.appendChild(bar);

  btnCountry.addEventListener('click', () => {
    showCountryNames = !showCountryNames;
    btnCountry.classList.toggle('active', showCountryNames);
    drawWorldMap();
  });

  btnCapital.addEventListener('click', () => {
    capitalMode = (capitalMode + 1) % 3;
    btnCapital.dataset.mode = capitalMode;
    btnCapital.classList.toggle('active', capitalMode > 0);
    const titles = ['Show capital dots', 'Show capital names', 'Hide capitals'];
    btnCapital.title = titles[capitalMode];
    drawWorldMap();
  });

  btnRivers.addEventListener('click', () => {
    showRivers = !showRivers;
    btnRivers.classList.toggle('active', showRivers);
    drawWorldMap();
  });

  btnMountains.addEventListener('click', () => {
    showMountains = !showMountains;
    btnMountains.classList.toggle('active', showMountains);
    drawWorldMap();
  });

  btnHeritage.addEventListener('click', () => {
    showHeritage = !showHeritage;
    if (!showHeritage && heritagePopupVisible) hideHeritagePopup();
    btnHeritage.classList.toggle('active', showHeritage);
    drawWorldMap();
  });
}

// ── Canvas resize & height sync ───────────────────────────────────────────────

function resizeCanvas() {
  const { w, h, minZoom } = setupCanvas(canvas, ctx, dpr, canvas.parentElement);
  canvasDisplayWidth = w;
  canvasDisplayHeight = h;
  viewport.minZoom = minZoom;
  if (viewport.zoom < minZoom) viewport.zoom = minZoom;
  drawWorldMap();
}

// Sync the page height to the actual visible viewport height.
// This fixes the extra-space-at-bottom bug on Android Chrome where
// 100dvh is computed before the browser chrome (URL bar / nav bar) adjusts.
function syncPageHeight() {
  const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  studyPage.style.height = h + 'px';
}

function syncAndResize() {
  syncPageHeight();
  resizeCanvas();
}

// ── Init ──────────────────────────────────────────────────────────────────────

syncAndResize();
// Center on Greenwich meridian (Europe/Africa)
viewport.scrollX = MAP_W / 2 - canvasDisplayWidth / (2 * viewport.zoom);
window.addEventListener('resize', syncAndResize);
if (window.visualViewport) {
  // Fires when URL bar shows/hides on mobile — more reliable than 'resize' alone
  window.visualViewport.addEventListener('resize', syncAndResize);
}
drawWorldMap();

createMapToggles();

createPanZoom(canvas, viewport, drawWorldMap, {
  onHover(cx, cy) {
    // Overlay layers take priority: heritage > rivers > mountains > countries
    const site     = findHeritageAtPoint(cx, cy);
    const river    = !site     && findRiverAtPoint(cx, cy);
    const mountain = !site && !river && findMountainAtPoint(cx, cy);
    const overlay  = site || river || mountain;

    if (overlay) {
      if (overlay !== hoveredOverlay) {
        hoveredOverlay = overlay;
        if (site)     updateInfoPanelForHeritage(site);
        else if (river)  updateInfoPanelForRiver(river);
        else             updateInfoPanelForMountain(mountain);
      }
      if (hoveredCountry !== null) { hoveredCountry = null; drawWorldMap(); }
      return;
    }

    const prevOverlay = hoveredOverlay;
    hoveredOverlay = null;

    const name = checkClickedCountry(cx, cy, {
      scrollX: viewport.scrollX,
      scrollY: viewport.scrollY,
      zoom: viewport.zoom,
      hitTestPaths,
      microCountries,
      resolveToDataName,
      dataToGeo,
    });
    if (heritagePopupVisible && name) hideHeritagePopup();
    if (name !== hoveredCountry || prevOverlay !== null) {
      hoveredCountry = name;
      updateInfoPanel(name);
      drawWorldMap();
    }
  },
  onLeave() {
    hoveredCountry = null;
    hoveredOverlay = null;
    hideInfoPanel();
    drawWorldMap();
  },
  onTap(cx, cy) {
    // Heritage site image popup
    const site = findHeritageAtPoint(cx, cy);
    if (site) {
      hideInfoPanel();
      showHeritagePopup(site);
      return;
    }
    if (heritagePopupVisible) hideHeritagePopup();

    // River / mountain tap — show info panel
    const river = findRiverAtPoint(cx, cy);
    if (river) {
      hoveredCountry = null;
      updateInfoPanelForRiver(river);
      drawWorldMap();
      return;
    }
    const mountain = findMountainAtPoint(cx, cy);
    if (mountain) {
      hoveredCountry = null;
      updateInfoPanelForMountain(mountain);
      drawWorldMap();
      return;
    }

    // Country tap (existing logic)
    const name = checkClickedCountry(cx, cy, {
      scrollX: viewport.scrollX,
      scrollY: viewport.scrollY,
      zoom: viewport.zoom,
      hitTestPaths,
      microCountries,
      resolveToDataName,
      dataToGeo,
    });
    if (name && name !== hoveredCountry) {
      hoveredCountry = name;
      updateInfoPanel(name);
      drawWorldMap();
    } else {
      hoveredCountry = null;
      hideInfoPanel();
      drawWorldMap();
    }
  },
});
