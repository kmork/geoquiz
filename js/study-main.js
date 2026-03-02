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

let canvasDisplayWidth = 600;
let canvasDisplayHeight = 320;

// Viewport — shared with pan/zoom engine
const viewport = { scrollX: 0, scrollY: 0, zoom: 1, minZoom: 1, velocityX: 0, velocityY: 0 };

// Hovered/selected country (DATA name)
let hoveredCountry = null;

// Label toggle state
let showCountryNames = false;
let showCapitalNames = false;

// ── Load data (parallel) ──────────────────────────────────────────────────────

const [worldData, placesData, countriesFlags, neighborsData] = await Promise.all([
  loadGeoJSON('data/ne_10m_admin_0_countries.geojson.gz'),
  fetch('data/places.geojson').then(r => r.json()),
  fetch('data/countries-flags.json').then(r => r.json()),
  fetch('data/countries-neighbors.json').then(r => r.json()),
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
  const { color = 'rgba(255,255,255,0.92)', shadowColor = 'rgba(0,0,0,0.7)', shadowWidth = 3 } = opts;
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

  const defaultFill   = getCSSVar('--map-country-fill')   || 'rgba(165,180,252,.08)';
  const defaultStroke = getCSSVar('--map-country-stroke') || 'rgba(232,236,255,.3)';
  const hoverFill     = getCSSVar('--map-country-fill-highlight') || 'rgba(165,180,252,.25)';

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

  // ── Country name labels ────────────────────────────────────────────────────

  if (showCountryNames && viewport.zoom > 1.5) {
    ctx.save();
    // Only label countries whose rendered width is large enough to be readable
    const MIN_PX = 18; // minimum rendered size of the main territory in CSS px
    for (const country of countryPaths) {
      // Use the largest-ring size (not overall bbox) so that countries whose
      // bbox spans the globe due to scattered islands (France with overseas
      // departments, US Minor Outlying Islands, etc.) get an appropriate size.
      const renderedSize = country.labelRingSize * viewport.zoom;
      if (renderedSize < MIN_PX) continue;

      const dataName = geoToData[country.name] || resolveToDataName(country.name);
      const label = dataName || country.name;

      // Font size: scales with rendered size of the main territory, capped for readability
      const fontSize = Math.max(9, Math.min(14, renderedSize * 0.11));

      for (const offset of offsets) {
        const cx = (country.labelCx + offset - viewport.scrollX) * viewport.zoom;
        const cy = (country.labelCy - viewport.scrollY) * viewport.zoom;

        // Skip if centroid is off-screen (with generous margin for labels)
        if (cx < -80 || cx > canvasDisplayWidth + 80 || cy < -20 || cy > canvasDisplayHeight + 20) continue;

        drawLabel(label, cx, cy, fontSize, { bold: renderedSize > 60 });
      }
    }
    ctx.restore();
  }

  // ── Capital dots ───────────────────────────────────────────────────────────

  const dotR = Math.max(1.5, 2.5 / viewport.zoom);
  ctx.save();
  for (const [, cap] of capitalDots) {
    const [mx, my] = proj([cap.lon, cap.lat]);

    for (const offset of offsets) {
      const px = (mx + offset - viewport.scrollX) * viewport.zoom;
      const py = (my - viewport.scrollY) * viewport.zoom;

      if (px < -10 || px > canvasDisplayWidth + 10 || py < -10 || py > canvasDisplayHeight + 10) continue;

      ctx.beginPath();
      ctx.arc(px, py, dotR, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
  }

  // ── Capital name labels ────────────────────────────────────────────────────

  if (showCapitalNames && viewport.zoom > 1.5) {
    const fontSize = Math.max(9, Math.min(12, viewport.zoom * 2.5));
    for (const [, cap] of capitalDots) {
      const [mx, my] = proj([cap.lon, cap.lat]);

      for (const offset of offsets) {
        const px = (mx + offset - viewport.scrollX) * viewport.zoom;
        const py = (my - viewport.scrollY) * viewport.zoom;

        if (px < -80 || px > canvasDisplayWidth + 80 || py < -20 || py > canvasDisplayHeight + 20) continue;

        // Label to the right of the dot
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = `500 ${fontSize}px "DM Sans", sans-serif`;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(0,0,0,0.65)';
        ctx.lineWidth = 3;
        ctx.strokeText(cap.name, px + dotR + 3, py);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillText(cap.name, px + dotR + 3, py);
      }
    }
  }

  ctx.restore();
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
  const flagSrc = iso2 ? `img/flags/${iso2}.svg` : '';
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

// ── Toggle buttons ────────────────────────────────────────────────────────────

function createMapToggles() {
  const mapwrap = canvas.parentElement;

  const bar = document.createElement('div');
  bar.className = 'study-map-toggles';

  const btnCountry = document.createElement('button');
  btnCountry.className = 'study-toggle-btn';
  btnCountry.title = 'Toggle country names';
  btnCountry.textContent = 'Aa';

  const btnCapital = document.createElement('button');
  btnCapital.className = 'study-toggle-btn';
  btnCapital.title = 'Toggle capital names';
  btnCapital.textContent = '★';

  // Stack: capital on top, country on bottom
  bar.appendChild(btnCapital);
  bar.appendChild(btnCountry);
  mapwrap.appendChild(bar);

  btnCountry.addEventListener('click', () => {
    showCountryNames = !showCountryNames;
    btnCountry.classList.toggle('active', showCountryNames);
    drawWorldMap();
  });

  btnCapital.addEventListener('click', () => {
    showCapitalNames = !showCapitalNames;
    btnCapital.classList.toggle('active', showCapitalNames);
    drawWorldMap();
  });
}

// ── Canvas resize ─────────────────────────────────────────────────────────────

function resizeCanvas() {
  const { w, h, minZoom } = setupCanvas(canvas, ctx, dpr, canvas.parentElement);
  canvasDisplayWidth = w;
  canvasDisplayHeight = h;
  viewport.minZoom = minZoom;
  if (viewport.zoom < minZoom) viewport.zoom = minZoom;
  drawWorldMap();
}

// ── Init ──────────────────────────────────────────────────────────────────────

resizeCanvas();
// Center on Greenwich meridian (Europe/Africa)
viewport.scrollX = MAP_W / 2 - canvasDisplayWidth / (2 * viewport.zoom);
window.addEventListener('resize', resizeCanvas);
drawWorldMap();

createMapToggles();

createPanZoom(canvas, viewport, drawWorldMap, {
  onHover(cx, cy) {
    const name = checkClickedCountry(cx, cy, {
      scrollX: viewport.scrollX,
      scrollY: viewport.scrollY,
      zoom: viewport.zoom,
      hitTestPaths,
      microCountries,
      resolveToDataName,
      dataToGeo,
    });
    if (name !== hoveredCountry) {
      hoveredCountry = name;
      updateInfoPanel(name);
      drawWorldMap();
    }
  },
  onLeave() {
    hoveredCountry = null;
    hideInfoPanel();
    drawWorldMap();
  },
  onTap(cx, cy) {
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
