/**
 * Study Mode — interactive world map with country info panel.
 *
 * Desktop: hover over a country to see its info panel in real-time.
 * Mobile: tap a country to show its info panel; tap again (or ocean) to hide.
 */

import { norm } from './utils.js';
import { loadGeoJSON } from './geojson-loader.js';
import {
  MAP_W, MAP_H, MAP_H_MERC, proj, getMapH, setProjection, getCSSVar,
  buildCountryPaths, buildNameLookups,
  checkClickedCountry, drawCountriesBatch, visibleOffsets,
  setupCanvas, createPanZoom,
} from './canvas-map-engine.js';
import { drawOSMTiles } from './osm-tiles.js';
import { pathFromMainland, bboxOfMainlandLonLat, padBBox, proj as projEquirect, mainlandPolygons } from './map-utils.js';
import { findGeoFeature } from './aliases.js';

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
let capitalMode = 0; // 0 = off, 1 = dots, 2 = dots + names, 3 = dots + names + cities

// Overlay toggle state
let showRivers    = false;
let mountainMode  = 0; // 0 = off, 1 = mountain ranges, 2 = highest peaks
let showHeritage  = false;
let showGrid      = false;

// OSM tile layer state
let showOSMTiles = false;
let osmRedrawTimer = null;

// Empire timeline state
let empiresData = [];
let activeEmpire = null;
let showTimeline = false;

// ── Load data (parallel) ──────────────────────────────────────────────────────

// Wait for data.js to finish loading
while (!window.DATA) {
  await new Promise(r => setTimeout(r, 50));
}

// Build lookups from unified window.DATA
const countriesFlags = Object.fromEntries((window.ALL_COUNTRIES || window.DATA).map(c => [c.country, c.flagCode]));
const neighborsData = Object.fromEntries((window.ALL_COUNTRIES || window.DATA).map(c => [c.country, c.neighbors]));

const [worldData, placesData, riversData, mountainsData, heritageSitesData, empiresRaw, countryFactsData] = await Promise.all([
  loadGeoJSON('data/ne_10m_admin_0_countries.geojson.gz'),
  fetch('data/places.geojson').then(r => r.json()),
  fetch('data/rivers.json').then(r => r.json()),
  fetch('data/mountain-ranges.json').then(r => r.json()),
  fetch('data/heritage-sites.json').then(r => r.json()),
  fetch('data/empires.json').then(r => r.json()),
  fetch('data/country-facts.json').then(r => r.json()),
]);

const WORLD = worldData.features;

// ── Build map data ────────────────────────────────────────────────────────────

let { countryPaths, hitTestPaths, microCountries } = buildCountryPaths(WORLD);
let { dataToGeo, geoToData, resolveToDataName } = buildNameLookups(countryPaths);

// Pre-compute geo names for empires (for renderer matching)
empiresData = empiresRaw.sort((a, b) => a.year - b.year);
for (const empire of empiresData) {
  empire._geoNames = new Set(empire.countries.map(c => dataToGeo[c] || c));
}

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

// City data from countries.json (major cities per country)
// Key: DATA country name → [{name, lon, lat}, ...]
const cityDots = new Map();
for (const entry of window.DATA) {
  if (entry.cities && entry.cities.length > 0) {
    cityDots.set(entry.country, entry.cities);
  }
}

// Highest-peak data from countries.json (for mountainMode 2)
const peaksData = [];
for (const entry of (window.ALL_COUNTRIES || window.DATA)) {
  if (entry.highestPeak) {
    peaksData.push({ country: entry.country, ...entry.highestPeak });
  }
}

// ── Projection switching ─────────────────────────────────────────────────────

function rebuildMapData() {
  ({ countryPaths, hitTestPaths, microCountries } = buildCountryPaths(WORLD));
  ({ dataToGeo, geoToData, resolveToDataName } = buildNameLookups(countryPaths));
  // Re-map empire geo names
  for (const empire of empiresData) {
    empire._geoNames = new Set(empire.countries.map(c => dataToGeo[c] || c));
  }
  // Rebuild capitalDots projection (lon/lat stay the same, proj() will re-project)
  // — dots are projected at draw time via proj(), so no rebuild needed.
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

  // ── OSM tile background ─────────────────────────────────────────────────
  if (showOSMTiles) {
    drawOSMTiles(ctx, viewport, MAP_W, MAP_H_MERC, canvasDisplayWidth, canvasDisplayHeight,
      isLight ? 'light' : 'dark', () => {
        // Debounce redraws from tile loads
        if (osmRedrawTimer) return;
        osmRedrawTimer = setTimeout(() => { osmRedrawTimer = null; drawWorldMap(); }, 50);
      });
  }

  const osmActive = showOSMTiles;
  const defaultFill   = osmActive ? 'transparent' : (getCSSVar('--map-country-fill') || 'rgba(165,180,252,.08)');
  const defaultStroke = getCSSVar('--map-country-stroke') || 'rgba(232,236,255,.3)';
  const hoverFill     = osmActive ? 'rgba(165,180,252,.15)' : (getCSSVar('--map-country-fill-highlight') || 'rgba(165,180,252,.25)');

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

  const hoverStroke = getCSSVar('--map-selected-stroke') || 'rgba(165,180,252,0.95)';
  const items = [];
  for (const country of countryPaths) {
    const dataName = geoToData[country.name] || resolveToDataName(country.name);
    const isHovered = dataName && dataName === hoveredCountry;

    items.push({
      path2d: country.path2d,
      fill:   isHovered ? hoverFill : defaultFill,
      stroke: isHovered ? hoverStroke : defaultStroke,
      strokeWidth: isHovered ? 1.2 : (osmActive ? 0.8 : 0.5),
      bboxMinX: country.bboxMinX, bboxMaxX: country.bboxMaxX,
      bboxMinY: country.bboxMinY, bboxMaxY: country.bboxMaxY,
    });
  }

  drawCountriesBatch(ctx, viewport, items, offsets, canvasDisplayWidth, canvasDisplayHeight);

  // ── Empire overlay ──────────────────────────────────────────────────────────

  if (activeEmpire) {
    const empireItems = [];
    for (const country of countryPaths) {
      if (!activeEmpire._geoNames.has(country.name)) continue;
      empireItems.push({
        path2d: country.path2d,
        fill: activeEmpire.color + '40',
        stroke: activeEmpire.color + '90',
        strokeWidth: 1.0,
        bboxMinX: country.bboxMinX, bboxMaxX: country.bboxMaxX,
        bboxMinY: country.bboxMinY, bboxMaxY: country.bboxMaxY,
      });
    }
    drawCountriesBatch(ctx, viewport, empireItems, offsets, canvasDisplayWidth, canvasDisplayHeight);
  }

  // ── Grid lines (graticule) ─────────────────────────────────────────────────

  if (showGrid) {
    ctx.save();
    const gridColor = isLight ? 'rgba(120,150,180,0.3)' : 'rgba(200,210,230,0.15)';
    const gridColorFine = isLight ? 'rgba(120,150,180,0.15)' : 'rgba(200,210,230,0.08)';
    const gridRefColor = isLight ? 'rgba(220,60,60,0.35)' : 'rgba(255,120,120,0.25)';
    const gridLabelColor = isLight ? 'rgba(80,100,120,0.7)' : 'rgba(200,210,230,0.5)';
    const gridRefLabelColor = isLight ? 'rgba(200,50,50,0.7)' : 'rgba(255,140,140,0.55)';
    const tropicColor = isLight ? 'rgba(200,150,30,0.3)' : 'rgba(230,190,80,0.2)';

    const drawFine = viewport.zoom > 3;
    const intervals = drawFine ? [10, 30] : [30];

    // Named reference latitudes
    const refLatitudes = new Set([0]); // equator
    const tropicLatitudes = new Set([23.4364, -23.4364, 66.5636, -66.5636]); // tropics & arctic/antarctic circles

    for (const interval of intervals) {
      const isMajor = interval === 30;

      // Longitude lines (vertical)
      for (let lon = -180; lon <= 180; lon += interval) {
        const isRef = lon === 0; // prime meridian
        ctx.strokeStyle = isRef ? gridRefColor : (isMajor ? gridColor : gridColorFine);
        ctx.lineWidth = isRef ? 1.2 : (isMajor ? 0.8 : 0.4);
        const [x0] = proj([lon, 0]);
        const [, y0] = proj([0, -90]);
        const [, y1] = proj([0, 90]);
        for (const offset of offsets) {
          const px = (x0 + offset - viewport.scrollX) * viewport.zoom;
          ctx.beginPath();
          ctx.moveTo(px, (y1 - viewport.scrollY) * viewport.zoom);
          ctx.lineTo(px, (y0 - viewport.scrollY) * viewport.zoom);
          ctx.stroke();
        }
      }

      // Latitude lines (horizontal)
      for (let lat = -90; lat <= 90; lat += interval) {
        const isRef = lat === 0; // equator
        ctx.strokeStyle = isRef ? gridRefColor : (isMajor ? gridColor : gridColorFine);
        ctx.lineWidth = isRef ? 1.2 : (isMajor ? 0.8 : 0.4);
        const [x0] = proj([-180, 0]);
        const [x1] = proj([180, 0]);
        const [, py] = proj([0, lat]);
        for (const offset of offsets) {
          ctx.beginPath();
          ctx.moveTo((x0 + offset - viewport.scrollX) * viewport.zoom, (py - viewport.scrollY) * viewport.zoom);
          ctx.lineTo((x1 + offset - viewport.scrollX) * viewport.zoom, (py - viewport.scrollY) * viewport.zoom);
          ctx.stroke();
        }
      }
    }

    // Tropics & circles (always drawn as dashed lines)
    ctx.strokeStyle = tropicColor;
    ctx.lineWidth = 0.8;
    ctx.setLineDash([6, 4]);
    for (const lat of tropicLatitudes) {
      const [x0] = proj([-180, 0]);
      const [x1] = proj([180, 0]);
      const [, py] = proj([0, lat]);
      for (const offset of offsets) {
        ctx.beginPath();
        ctx.moveTo((x0 + offset - viewport.scrollX) * viewport.zoom, (py - viewport.scrollY) * viewport.zoom);
        ctx.lineTo((x1 + offset - viewport.scrollX) * viewport.zoom, (py - viewport.scrollY) * viewport.zoom);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);

    // Labels
    if (viewport.zoom > 2) {
      const fontSize = Math.max(8, Math.min(11, viewport.zoom * 2));

      // Latitude labels (along left visible edge)
      const latLabels = [
        { lat: 0, text: 'Equator', ref: true },
        { lat: 30, text: '30°N', ref: false },
        { lat: 60, text: '60°N', ref: false },
        { lat: -30, text: '30°S', ref: false },
        { lat: -60, text: '60°S', ref: false },
        { lat: 23.4364, text: 'Tropic of Cancer', ref: true },
        { lat: -23.4364, text: 'Tropic of Capricorn', ref: true },
        { lat: 66.5636, text: 'Arctic Circle', ref: true },
        { lat: -66.5636, text: 'Antarctic Circle', ref: true },
      ];
      for (const { lat, text, ref } of latLabels) {
        const [, my] = proj([0, lat]);
        const py = (my - viewport.scrollY) * viewport.zoom;
        if (py < 0 || py > canvasDisplayHeight) continue;
        ctx.font = `${ref ? '500' : '400'} ${fontSize}px "DM Sans", sans-serif`;
        ctx.fillStyle = ref ? gridRefLabelColor : gridLabelColor;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(text, 4, py - 2);
      }

      // Longitude labels (along top visible edge)
      const lonLabels = [];
      for (let lon = -180; lon <= 180; lon += 30) {
        lonLabels.push({
          lon,
          text: lon === 0 ? 'Prime Meridian' : `${Math.abs(lon)}°${lon > 0 ? 'E' : 'W'}`,
          ref: lon === 0,
        });
      }
      for (const { lon, text, ref } of lonLabels) {
        const [mx] = proj([lon, 0]);
        ctx.font = `${ref ? '500' : '400'} ${fontSize}px "DM Sans", sans-serif`;
        ctx.fillStyle = ref ? gridRefLabelColor : gridLabelColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (const offset of offsets) {
          const px = (mx + offset - viewport.scrollX) * viewport.zoom;
          if (px < 0 || px > canvasDisplayWidth) continue;
          ctx.fillText(text, px, 4);
        }
      }
    }

    ctx.restore();
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

  // ── Mountain ranges (mode 1) ───────────────────────────────────────────────

  if (mountainMode === 1) {
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

  // ── Highest peaks (mode 2) ───────────────────────────────────────────────

  if (mountainMode === 2) {
    ctx.save();
    const peakColor = isLight ? 'rgba(146,64,14,0.9)' : 'rgba(210,140,60,0.9)';
    const peakLabelColor = isLight ? 'rgba(100,50,10,0.95)' : 'rgba(220,160,80,0.95)';
    const peakLabelHalo  = isLight ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.7)';

    // Draw triangle markers
    const s = Math.max(3, 4.5 / viewport.zoom);
    ctx.fillStyle = peakColor;
    for (const peak of peaksData) {
      const [mx, my] = proj([peak.lon, peak.lat]);
      for (const offset of offsets) {
        const px = (mx + offset - viewport.scrollX) * viewport.zoom;
        const py = (my - viewport.scrollY) * viewport.zoom;
        if (px < -10 || px > canvasDisplayWidth + 10 || py < -10 || py > canvasDisplayHeight + 10) continue;
        ctx.beginPath();
        ctx.moveTo(px, py - s);
        ctx.lineTo(px + s * 0.87, py + s * 0.5);
        ctx.lineTo(px - s * 0.87, py + s * 0.5);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Labels at higher zoom
    if (viewport.zoom > 3) {
      const fontSize = Math.max(8, Math.min(11, viewport.zoom * 1.8));
      for (const peak of peaksData) {
        const [mx, my] = proj([peak.lon, peak.lat]);
        for (const offset of offsets) {
          const px = (mx + offset - viewport.scrollX) * viewport.zoom;
          const py = (my - viewport.scrollY) * viewport.zoom;
          if (px < -80 || px > canvasDisplayWidth + 80 || py < -20 || py > canvasDisplayHeight + 20) continue;
          const label = `${peak.name} (${peak.elev.toLocaleString()} m)`;
          drawLabel(label, px, py - s - fontSize * 0.7, fontSize, {
            color: peakLabelColor, shadowColor: peakLabelHalo, lightMode: isLight
          });
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

    if (capitalMode >= 2 && viewport.zoom > 1.5) {
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

    // ── City dots + names (mode 3, zoom > 10) ──────────────────────────────
    if (capitalMode === 3 && viewport.zoom > 11) {
      const cityDotFill   = isLight ? 'rgba(37,99,235,0.8)'  : 'rgba(180,180,255,0.7)';
      const cityLabelCol  = isLight ? 'rgba(37,99,235,0.85)' : 'rgba(180,180,255,0.8)';
      const cityLabelHalo = isLight ? 'rgba(255,255,255,0.88)' : 'rgba(0,0,0,0.65)';
      const cityR = Math.max(1.2, 2.0 / viewport.zoom);
      const cityFontSize = Math.max(8, Math.min(11, viewport.zoom * 2.5 - 1));

      for (const [, cities] of cityDots) {
        for (const city of cities) {
          const [mx, my] = proj([city.lon, city.lat]);

          for (const offset of offsets) {
            const px = (mx + offset - viewport.scrollX) * viewport.zoom;
            const py = (my - viewport.scrollY) * viewport.zoom;

            if (px < -10 || px > canvasDisplayWidth + 10 || py < -10 || py > canvasDisplayHeight + 10) continue;

            // Dot
            if (isLight) {
              ctx.beginPath();
              ctx.arc(px, py, cityR + 1.2, 0, Math.PI * 2);
              ctx.fillStyle = 'rgba(255,255,255,0.85)';
              ctx.fill();
            }
            ctx.beginPath();
            ctx.arc(px, py, cityR, 0, Math.PI * 2);
            ctx.fillStyle = cityDotFill;
            ctx.fill();

            // Label
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.font = `400 ${cityFontSize}px "DM Sans", sans-serif`;
            ctx.lineJoin = 'round';
            ctx.strokeStyle = cityLabelHalo;
            ctx.lineWidth = 2.5;
            ctx.strokeText(city.name, px + cityR + 3, py);
            ctx.fillStyle = cityLabelCol;
            ctx.fillText(city.name, px + cityR + 3, py);
          }
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
  const allData = window.ALL_COUNTRIES || window.DATA || [];
  const entry = allData.find(d => d.country === dataName);
  const capital = entry?.capitals?.[0] || '—';
  const popStr = props?.POP_EST ? formatPop(props.POP_EST) : '—';

  // Territory: show sovereign from GeoJSON SOVEREIGNT field
  const isTerritory = entry && !entry.un;
  const sovereign = isTerritory && props?.SOVEREIGNT && props.SOVEREIGNT !== dataName
    ? props.SOVEREIGNT : null;

  const nbrs = neighborsData?.[dataName];
  const bordersStr = nbrs == null ? '—' : nbrs.length === 0 ? 'Island nation' : nbrs.join(', ');

  infoPanel.innerHTML = `
    <div class="study-info-header">
      ${flagSrc ? `<img class="study-info-flag" src="${flagSrc}" alt="${dataName} flag">` : '<div class="study-info-flag-placeholder"></div>'}
      <div>
        <div class="study-info-name">${dataName}</div>
        ${sovereign ? `<div class="study-info-region">Territory of ${sovereign}</div>` : subregion ? `<div class="study-info-region">${subregion}</div>` : ''}
      </div>
      <button class="study-info-close" aria-label="Close">✕</button>
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
  hoveredCountry = null;
  hoveredOverlay = null;
  drawWorldMap();
}

// Delegated close button handler for the info panel
infoPanel.addEventListener('click', (e) => {
  if (e.target.closest('.study-info-close')) {
    hideInfoPanel();
  }
});

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
  if (mountainMode !== 1) return null;
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

function findPeakAtPoint(cx, cy) {
  if (mountainMode !== 2) return null;
  const offsets = visibleOffsets(viewport, canvasDisplayWidth);
  const HIT = 10;
  for (const peak of peaksData) {
    const [mx, my] = proj([peak.lon, peak.lat]);
    for (const offset of offsets) {
      const px = (mx + offset - viewport.scrollX) * viewport.zoom;
      const py = (my - viewport.scrollY) * viewport.zoom;
      if (Math.abs(cx - px) + Math.abs(cy - py) <= HIT) return peak;
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
      <button class="study-info-close" aria-label="Close">✕</button>
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
      <button class="study-info-close" aria-label="Close">✕</button>
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
      <button class="study-info-close" aria-label="Close">✕</button>
    </div>
    <div class="study-info-divider"></div>
    <div class="study-info-rows">
      <div class="study-info-row study-info-borders"><span>Countries</span><span>${range.countries.join(', ')}</span></div>
      <div class="study-info-row"><span>Highest</span><span>${highestStr}</span></div>
    </div>
  `;
  infoPanel.style.display = 'block';
}

function updateInfoPanelForPeak(peak) {
  const iso2 = countriesFlags[peak.country];
  const flagSrc = iso2 ? `img/flags/${iso2}.svg` : '';
  infoPanel.innerHTML = `
    <div class="study-info-header">
      <div class="study-info-overlay-icon" style="background:rgba(146,64,14,0.15)">▲</div>
      <div>
        <div class="study-info-name">${peak.name}</div>
        <div class="study-info-region">Highest point · ${peak.country}</div>
      </div>
      <button class="study-info-close" aria-label="Close">✕</button>
    </div>
    <div class="study-info-divider"></div>
    <div class="study-info-rows">
      <div class="study-info-row"><span>Elevation</span><span>${peak.elev.toLocaleString()} m</span></div>
      <div class="study-info-row"><span>Coordinates</span><span>${Math.abs(peak.lat).toFixed(2)}°${peak.lat >= 0 ? 'N' : 'S'}, ${Math.abs(peak.lon).toFixed(2)}°${peak.lon >= 0 ? 'E' : 'W'}</span></div>
      ${flagSrc ? `<div class="study-info-row"><span>Flag</span><span><img src="${flagSrc}" alt="${peak.country}" style="height:16px;vertical-align:middle;border-radius:2px"></span></div>` : ''}
    </div>
  `;
  infoPanel.style.display = 'block';
}

function updateInfoPanelForEmpire(empire) {
  infoPanel.innerHTML = `
    <div class="study-info-header">
      <div class="study-info-overlay-icon" style="background:${empire.color}25">⏳</div>
      <div>
        <div class="study-info-name">${empire.name}</div>
        <div class="study-info-region">${empire.yearLabel}</div>
      </div>
      <button class="study-info-close" aria-label="Close">✕</button>
    </div>
    <div class="study-info-divider"></div>
    <div class="study-info-rows">
      <div class="study-info-row study-info-borders"><span>Description</span><span>${empire.description}</span></div>
      <div class="study-info-row"><span>Countries</span><span>${empire.countries.length} modern nations</span></div>
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
  heritagePopupImg.style.height = Math.max(200, canvasDisplayHeight * 0.7) + 'px';
  heritagePopup.style.width = Math.max(320, canvasDisplayWidth * 0.75) + 'px';
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
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && heritagePopupVisible) hideHeritagePopup();
});

// ── Fact overlay (desktop only) ──────────────────────────────────────────────

const factOverlay = document.getElementById('fact-overlay');
const factOverlayText = document.getElementById('fact-overlay-text');
const factOverlayCategory = document.getElementById('fact-overlay-category');
const factOverlayNav = document.getElementById('fact-overlay-nav');

let currentFactCountry = null;
let currentFactIndex = 0;
let currentFacts = [];

function updateFactDisplay() {
  const f = currentFacts[currentFactIndex];
  factOverlayText.textContent = f.fact;
  factOverlayCategory.textContent = f.category;
  if (currentFacts.length > 1) {
    factOverlayNav.innerHTML = '';
    const prev = document.createElement('button');
    prev.textContent = '\u25C0';
    prev.setAttribute('aria-label', 'Previous fact');
    prev.addEventListener('click', () => {
      currentFactIndex = (currentFactIndex - 1 + currentFacts.length) % currentFacts.length;
      updateFactDisplay();
    });
    const next = document.createElement('button');
    next.textContent = '\u25B6';
    next.setAttribute('aria-label', 'Next fact');
    next.addEventListener('click', () => {
      currentFactIndex = (currentFactIndex + 1) % currentFacts.length;
      updateFactDisplay();
    });
    const counter = document.createElement('span');
    counter.textContent = `${currentFactIndex + 1} / ${currentFacts.length}`;
    factOverlayNav.appendChild(prev);
    factOverlayNav.appendChild(counter);
    factOverlayNav.appendChild(next);
  } else {
    factOverlayNav.innerHTML = '';
  }
}

function showFactOverlay(dataName) {
  if (window.innerWidth <= 600) return;
  const facts = countryFactsData[dataName];
  if (!facts || facts.length === 0) {
    hideFactOverlay();
    return;
  }
  currentFactCountry = dataName;
  currentFacts = facts;
  currentFactIndex = Math.floor(Math.random() * facts.length);
  updateFactDisplay();
  factOverlay.style.display = '';
}

function hideFactOverlay() {
  factOverlay.style.display = 'none';
  currentFactCountry = null;
}

document.getElementById('fact-overlay-close').addEventListener('click', hideFactOverlay);

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

  const btnGrid = document.createElement('button');
  btnGrid.className = 'study-toggle-btn';
  btnGrid.title = 'Toggle grid lines';
  btnGrid.textContent = '#';

  const btnHistory = document.createElement('button');
  btnHistory.className = 'study-toggle-btn';
  btnHistory.title = 'Toggle historical empires';
  btnHistory.textContent = '⏳';

  const btnOSM = document.createElement('button');
  btnOSM.className = 'study-toggle-btn';
  btnOSM.title = 'Toggle street map tiles';
  btnOSM.textContent = '🗺️';

  // Stack: 🏷️ ★ 〰️ ⛰️ 🏛️ # ⏳ 🗺️
  bar.appendChild(btnCountry);
  bar.appendChild(btnCapital);
  bar.appendChild(btnRivers);
  bar.appendChild(btnMountains);
  bar.appendChild(btnHeritage);
  bar.appendChild(btnGrid);
  bar.appendChild(btnHistory);
  bar.appendChild(btnOSM);
  mapwrap.appendChild(bar);

  // OSM attribution overlay
  const attrib = document.createElement('div');
  attrib.className = 'osm-attribution';
  attrib.innerHTML = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors, © <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>';
  attrib.style.display = 'none';
  mapwrap.appendChild(attrib);

  btnCountry.addEventListener('click', () => {
    showCountryNames = !showCountryNames;
    btnCountry.classList.toggle('active', showCountryNames);
    drawWorldMap();
  });

  btnCapital.addEventListener('click', () => {
    capitalMode = (capitalMode + 1) % 4;
    btnCapital.dataset.mode = capitalMode;
    btnCapital.classList.toggle('active', capitalMode > 0);
    const titles = ['Show capital dots', 'Show capital names', 'Show cities', 'Hide capitals'];
    btnCapital.title = titles[capitalMode];
    drawWorldMap();
  });

  btnRivers.addEventListener('click', () => {
    showRivers = !showRivers;
    btnRivers.classList.toggle('active', showRivers);
    drawWorldMap();
  });

  btnMountains.addEventListener('click', () => {
    mountainMode = (mountainMode + 1) % 3;
    btnMountains.classList.toggle('active', mountainMode > 0);
    btnMountains.dataset.mode = mountainMode;
    const titles = ['Toggle mountain ranges', 'Show highest peaks', 'Hide mountains'];
    btnMountains.title = titles[mountainMode];
    drawWorldMap();
  });

  btnGrid.addEventListener('click', () => {
    showGrid = !showGrid;
    btnGrid.classList.toggle('active', showGrid);
    drawWorldMap();
  });

  btnHeritage.addEventListener('click', () => {
    showHeritage = !showHeritage;
    if (!showHeritage && heritagePopupVisible) hideHeritagePopup();
    btnHeritage.classList.toggle('active', showHeritage);
    drawWorldMap();
  });

  btnHistory.addEventListener('click', () => {
    showTimeline = !showTimeline;
    btnHistory.classList.toggle('active', showTimeline);
    const bar = document.querySelector('.study-timeline-bar');
    if (bar) bar.classList.toggle('visible', showTimeline);
    if (!showTimeline) {
      activeEmpire = null;
      const chips = document.querySelectorAll('.study-timeline-chip');
      chips.forEach(c => c.classList.remove('active'));
      hideInfoPanel();
    }
    resizeCanvas();
  });

  btnOSM.addEventListener('click', () => {
    showOSMTiles = !showOSMTiles;
    btnOSM.classList.toggle('active', showOSMTiles);
    attrib.style.display = showOSMTiles ? '' : 'none';

    // Compute current geographic center (inverse-project before switching)
    const oldCx = viewport.scrollX + canvasDisplayWidth / (2 * viewport.zoom);
    const oldCy = viewport.scrollY + canvasDisplayHeight / (2 * viewport.zoom);
    const oldMapH = getMapH();
    // Approximate inverse: map-space → lon/lat
    const lon = (oldCx / MAP_W) * 360 - 180;
    let lat;
    if (!showOSMTiles) {
      // Was mercator, switching to equirect
      const mercNorm = 1 - (2 * oldCy / MAP_H_MERC);
      lat = (2 * Math.atan(Math.exp(mercNorm * Math.PI)) - Math.PI / 2) * 180 / Math.PI;
    } else {
      // Was equirect, switching to mercator
      lat = 90 - (oldCy / MAP_H) * 180;
    }

    // Switch projection
    setProjection(showOSMTiles ? 'mercator' : 'equirect');

    // Rebuild all country paths + lookups with new projection
    rebuildMapData();

    // Re-project center to new map space
    const [newCx, newCy] = proj([lon, lat]);
    const newMapH = getMapH();

    // Update viewport for new map dimensions
    viewport.minZoom = Math.max(canvasDisplayHeight / newMapH, canvasDisplayWidth / MAP_W);
    if (viewport.zoom < viewport.minZoom) viewport.zoom = viewport.minZoom;

    viewport.scrollX = newCx - canvasDisplayWidth / (2 * viewport.zoom);
    viewport.scrollY = Math.max(0, Math.min(
      newCy - canvasDisplayHeight / (2 * viewport.zoom),
      newMapH - canvasDisplayHeight / viewport.zoom
    ));

    drawWorldMap();
  });
}

function createTimelineBar() {
  const mapwrap = canvas.parentElement;
  const bar = document.createElement('div');
  bar.className = 'study-timeline-bar';

  const track = document.createElement('div');
  track.className = 'study-timeline-track';

  for (const empire of empiresData) {
    const chip = document.createElement('button');
    chip.className = 'study-timeline-chip';
    chip.style.setProperty('--empire-color', empire.color);
    chip.textContent = `${empire.name} (${empire.yearLabel})`;
    chip.addEventListener('click', () => {
      const wasActive = activeEmpire === empire;
      activeEmpire = wasActive ? null : empire;

      track.querySelectorAll('.study-timeline-chip').forEach(c => c.classList.remove('active'));
      if (!wasActive) chip.classList.add('active');

      if (activeEmpire) {
        updateInfoPanelForEmpire(activeEmpire);
      } else {
        hideInfoPanel();
      }
      drawWorldMap();
    });
    track.appendChild(chip);
  }

  const closeBtn = document.createElement('button');
  closeBtn.className = 'study-timeline-close';
  closeBtn.textContent = '✕';
  closeBtn.title = 'Close timeline';
  closeBtn.addEventListener('click', () => {
    showTimeline = false;
    activeEmpire = null;
    bar.classList.remove('visible');
    const toggleBtn = document.querySelector('.study-toggle-btn.active[title="Toggle historical empires"]');
    if (toggleBtn) toggleBtn.classList.remove('active');
    // Also deactivate by finding the ⏳ button
    document.querySelectorAll('.study-toggle-btn').forEach(b => {
      if (b.textContent.trim() === '⏳') b.classList.remove('active');
    });
    hideInfoPanel();
    resizeCanvas();
  });

  bar.appendChild(track);
  bar.appendChild(closeBtn);
  // Insert before canvas so it appears above the map
  mapwrap.insertBefore(bar, canvas);
}

// ── Shape similarity: rasterize-and-compare ──────────────────────────────────

const SHAPE_GRID = 32;
const SHAPE_CELLS = SHAPE_GRID * SHAPE_GRID;

/** Ray-casting point-in-polygon test for a set of projected rings (outer + holes). */
function pointInRings(px, py, rings) {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1];
      const xj = ring[j][0], yj = ring[j][1];
      if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
  }
  return inside;
}

/**
 * Rasterize a country's mainland polygons to a binary grid.
 * Stretches to fill the full 32×32 grid (aspect ratio is tracked separately).
 * Returns { grid, aspect, fill, polyCount } or null.
 */
function rasterizeShape(feature) {
  const polys = mainlandPolygons(feature);
  if (polys.length === 0) return null;

  // Project all polygon rings
  const projectedPolys = polys.map(poly =>
    poly.map(ring => ring.map(([lon, lat]) => projEquirect([lon, lat])))
  );

  // Bounding box of all projected points
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const poly of projectedPolys) {
    for (const ring of poly) {
      for (const [x, y] of ring) {
        if (x < minX) minX = x; if (y < minY) minY = y;
        if (x > maxX) maxX = x; if (y > maxY) maxY = y;
      }
    }
  }

  const w = maxX - minX || 1;
  const h = maxY - minY || 1;
  const aspect = w / h; // >1 = wide, <1 = tall

  // Stretch to fill entire grid (shape comparison independent of aspect ratio)
  const scaleX = SHAPE_GRID / w;
  const scaleY = SHAPE_GRID / h;

  const grid = new Uint8Array(SHAPE_CELLS);
  let filled = 0;
  for (let gy = 0; gy < SHAPE_GRID; gy++) {
    for (let gx = 0; gx < SHAPE_GRID; gx++) {
      // Map grid cell center back to projected coords
      const px = minX + (gx + 0.5) / scaleX;
      const py = minY + (gy + 0.5) / scaleY;
      for (const rings of projectedPolys) {
        if (pointInRings(px, py, rings)) {
          grid[gy * SHAPE_GRID + gx] = 1;
          filled++;
          break;
        }
      }
    }
  }

  const fill = filled / SHAPE_CELLS; // 0–1: how much of the bbox is filled (low = archipelago/irregular)
  return { grid, aspect, fill, polyCount: polys.length };
}

/** BFS distance transform: for each cell, distance to nearest foreground pixel. */
function distanceTransform(grid) {
  const dt = new Float32Array(SHAPE_CELLS);
  const queue = [];
  for (let i = 0; i < SHAPE_CELLS; i++) {
    if (grid[i]) { dt[i] = 0; queue.push(i); }
    else dt[i] = 1e9;
  }
  // BFS with 4-connectivity
  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++];
    const x = idx % SHAPE_GRID, y = (idx - x) / SHAPE_GRID;
    const d = dt[idx] + 1;
    const neighbors = [];
    if (x > 0) neighbors.push(idx - 1);
    if (x < SHAPE_GRID - 1) neighbors.push(idx + 1);
    if (y > 0) neighbors.push(idx - SHAPE_GRID);
    if (y < SHAPE_GRID - 1) neighbors.push(idx + SHAPE_GRID);
    for (const ni of neighbors) {
      if (d < dt[ni]) { dt[ni] = d; queue.push(ni); }
    }
  }
  return dt;
}

/**
 * Combined distance: aspect ratio + fill density + raster (IoU + Chamfer).
 * - Aspect ratio (50%): primary separator — keeps tall-thin with tall-thin, wide with wide
 * - Fill density (15%): separates archipelagos from solid landmasses
 * - Raster IoU + Chamfer (35%): actual outline shape similarity (on stretched grid)
 */
function shapeDistance(itemA, itemB, dtA, dtB) {
  // Aspect ratio distance (log scale, amplified so even moderate differences matter)
  // /1.5 means a 4.5:1 aspect ratio difference saturates to 1.0
  // Malawi (~0.15) vs Israel (~0.4): |ln(.15)-ln(.4)|/1.5 ≈ 0.65 → strong separation
  const logAspectDiff = Math.abs(Math.log(itemA.raster.aspect) - Math.log(itemB.raster.aspect));
  const aspectDist = Math.min(logAspectDiff / 1.5, 1);

  // Fill density distance
  const fillDist = Math.abs(itemA.raster.fill - itemB.raster.fill);

  // Raster IoU + Chamfer
  const gridA = itemA.raster.grid, gridB = itemB.raster.grid;
  let intersection = 0, union = 0;
  let chamferAB = 0, countA = 0, chamferBA = 0, countB = 0;
  for (let i = 0; i < SHAPE_CELLS; i++) {
    const a = gridA[i], b = gridB[i];
    if (a || b) union++;
    if (a && b) intersection++;
    if (a) { chamferAB += dtB[i]; countA++; }
    if (b) { chamferBA += dtA[i]; countB++; }
  }
  const iou = union > 0 ? intersection / union : 0;
  const maxDist = SHAPE_GRID * 1.42;
  const chamfer = (
    (countA > 0 ? chamferAB / countA : 0) +
    (countB > 0 ? chamferBA / countB : 0)
  ) / (2 * maxDist);
  const rasterDist = 0.7 * (1 - iou) + 0.3 * chamfer;

  return 0.50 * aspectDist + 0.15 * fillDist + 0.35 * rasterDist;
}

/** Build full NxN distance matrix. */
function buildDistanceMatrix(items) {
  const n = items.length;
  // Precompute distance transforms for each raster grid
  const dts = items.map(it => distanceTransform(it.raster.grid));
  // Symmetric matrix stored as flat array
  const dist = new Float32Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = shapeDistance(items[i], items[j], dts[i], dts[j]);
      dist[i * n + j] = d;
      dist[j * n + i] = d;
    }
  }
  return dist;
}

/** Agglomerative clustering with average linkage. Returns array of groups. */
function agglomerativeCluster(distMatrix, items, targetGroups) {
  const n = items.length;
  // Each cluster: set of original indices
  const clusters = items.map((_, i) => [i]);
  // Track active cluster ids
  const active = new Set(Array.from({ length: n }, (_, i) => i));
  // Average-linkage distance between clusters (start = pairwise distances)
  const clusterDist = new Float32Array(n * n);
  clusterDist.set(distMatrix);

  while (active.size > targetGroups) {
    // Find closest pair of active clusters
    let bestI = -1, bestJ = -1, bestD = Infinity;
    const activeArr = [...active];
    for (let ai = 0; ai < activeArr.length; ai++) {
      for (let aj = ai + 1; aj < activeArr.length; aj++) {
        const i = activeArr[ai], j = activeArr[aj];
        if (clusterDist[i * n + j] < bestD) {
          bestD = clusterDist[i * n + j];
          bestI = i; bestJ = j;
        }
      }
    }
    if (bestI < 0) break;

    // Merge j into i
    const sizeI = clusters[bestI].length;
    const sizeJ = clusters[bestJ].length;
    clusters[bestI] = clusters[bestI].concat(clusters[bestJ]);
    active.delete(bestJ);

    // Update distances from merged cluster to all others (average linkage)
    for (const k of active) {
      if (k === bestI) continue;
      const newDist = (clusterDist[bestI * n + k] * sizeI + clusterDist[bestJ * n + k] * sizeJ) / (sizeI + sizeJ);
      clusterDist[bestI * n + k] = newDist;
      clusterDist[k * n + bestI] = newDist;
    }
  }

  return [...active].map(ci => clusters[ci]);
}

/** Order items within a group by MST walk so similar shapes are adjacent. */
function mstOrderGroup(indices, distMatrix, n) {
  if (indices.length <= 2) return indices;

  // Build MST using Prim's algorithm
  const m = indices.length;
  const inMST = new Uint8Array(m);
  const key = new Float32Array(m).fill(Infinity);
  const parent = new Int32Array(m).fill(-1);
  const adj = Array.from({ length: m }, () => []);

  key[0] = 0;
  for (let step = 0; step < m; step++) {
    // Pick minimum key vertex not in MST
    let u = -1, minK = Infinity;
    for (let i = 0; i < m; i++) {
      if (!inMST[i] && key[i] < minK) { minK = key[i]; u = i; }
    }
    if (u < 0) break;
    inMST[u] = 1;
    if (parent[u] >= 0) {
      adj[u].push(parent[u]);
      adj[parent[u]].push(u);
    }
    // Update keys for neighbors
    for (let v = 0; v < m; v++) {
      if (inMST[v]) continue;
      const d = distMatrix[indices[u] * n + indices[v]];
      if (d < key[v]) { key[v] = d; parent[v] = u; }
    }
  }

  // Find most central node (minimum sum of distances to all others)
  let bestRoot = 0, bestSum = Infinity;
  for (let i = 0; i < m; i++) {
    let sum = 0;
    for (let j = 0; j < m; j++) sum += distMatrix[indices[i] * n + indices[j]];
    if (sum < bestSum) { bestSum = sum; bestRoot = i; }
  }

  // DFS from root
  const order = [];
  const visited = new Uint8Array(m);
  const stack = [bestRoot];
  while (stack.length > 0) {
    const u = stack.pop();
    if (visited[u]) continue;
    visited[u] = 1;
    order.push(indices[u]);
    // Sort children by distance (closest first) for better visual flow
    const children = adj[u].filter(v => !visited[v]);
    children.sort((a, b) => distMatrix[indices[b] * n + indices[u]] - distMatrix[indices[a] * n + indices[u]]);
    stack.push(...children);
  }
  return order;
}

/** Orchestrate: rasterize → distance matrix → cluster → order → label. */
/** Derive a shape-descriptive label from a group's average properties. */
function labelGroup(items) {
  let avgAspect = 0, avgFill = 0;
  for (const it of items) {
    avgAspect += it.raster.aspect;
    avgFill += it.raster.fill;
  }
  avgAspect /= items.length;
  avgFill /= items.length;

  // Aspect: <0.45 tall, 0.45–0.7 squarish, 0.7–1.5 squarish, 1.5–2.2 wide, >2.2 very wide
  // Fill: <0.35 sparse (archipelago/fragmented), 0.35–0.55 moderate, >0.55 solid
  const logA = Math.log(avgAspect);

  let shape;
  if (logA < -0.8) shape = 'Tall & narrow';        // aspect < ~0.45
  else if (logA < -0.35) shape = 'Upright';         // aspect ~0.45–0.7
  else if (logA < 0.35) shape = 'Compact';          // aspect ~0.7–1.4
  else if (logA < 0.8) shape = 'Wide';              // aspect ~1.4–2.2
  else shape = 'Wide & flat';                        // aspect > ~2.2

  let density;
  if (avgFill < 0.30) density = 'scattered';
  else if (avgFill < 0.50) density = 'irregular';
  else density = null; // solid shapes don't need a density qualifier

  // Archetype: most central member name in parentheses
  const archetype = items[0].country; // items are MST-ordered, first is near center

  if (density) return `${shape}, ${density} · e.g. ${archetype}`;
  return `${shape} · e.g. ${archetype}`;
}

function buildShapeGroups(shapeItems) {
  if (shapeItems.length === 0) return [];
  const n = shapeItems.length;
  const distMatrix = buildDistanceMatrix(shapeItems);

  // More groups → tighter similarity within each; ~6 countries per group on average
  const targetGroups = Math.max(12, Math.min(30, Math.round(n / 6)));
  const clusterIndices = agglomerativeCluster(distMatrix, shapeItems, targetGroups);

  // Build groups: order within each, label by shape description
  const regular = [];
  const loners = [];
  for (const indices of clusterIndices) {
    if (indices.length === 1) {
      loners.push(indices[0]);
      continue;
    }
    const ordered = mstOrderGroup(indices, distMatrix, n);
    const items = ordered.map(i => shapeItems[i]);

    regular.push({ label: labelGroup(items), items });
  }

  // Sort by size: most countries first
  regular.sort((a, b) => b.items.length - a.items.length);

  // Merge all single-country loners into "Unique shapes" at the end
  if (loners.length > 0) {
    regular.push({
      label: 'Unique shapes',
      items: loners.map(i => shapeItems[i]),
    });
  }

  return regular;
}

// ── Jigsaw overlay ───────────────────────────────────────────────────────────

let showJigsaw = false;

function createJigsawOverlay() {
  const mapwrap = canvas.parentElement;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  // Toggle button — positioned at top-right, separate from the other toggles
  const btn = document.createElement('button');
  btn.className = 'study-toggle-btn study-jigsaw-btn';
  btn.title = 'Show country outlines';
  btn.textContent = '🧩';
  mapwrap.appendChild(btn);

  // Overlay container
  const overlay = document.createElement('div');
  overlay.className = 'study-jigsaw-overlay';
  overlay.style.display = 'none';
  mapwrap.appendChild(overlay);

  // Build pieces from all DATA countries
  const MIN_AREA = 500;
  const pieces = [];
  const countryDataMap = Object.fromEntries(window.DATA.map(c => [c.country, c]));
  for (const c of window.DATA) {
    if ((c.area || 0) < MIN_AREA) continue;
    const feature = findGeoFeature(WORLD, c.country);
    if (!feature) continue;
    const d = pathFromMainland(feature);
    if (!d) continue;

    const bb = bboxOfMainlandLonLat(feature);
    const pbb = padBBox(bb, 0.15);
    const [tx1, ty1] = projEquirect([pbb.minLon, pbb.maxLat]);
    const [tx2, ty2] = projEquirect([pbb.maxLon, pbb.minLat]);
    const tw = tx2 - tx1;
    const th = ty2 - ty1;
    // Aspect ratio for shape similarity grouping
    const aspect = tw / (th || 1);

    pieces.push({ country: c.country, continent: c.continent, area: c.area || 0, aspect, feature, pathD: d, tx1, ty1, tw, th });
  }

  // Create DOM element for each piece
  for (const p of pieces) {
    const piece = document.createElement('div');
    piece.className = 'jigsaw-piece';

    const thumbSvg = document.createElementNS(SVG_NS, 'svg');
    thumbSvg.setAttribute('viewBox', `${p.tx1} ${p.ty1} ${p.tw} ${p.th}`);
    thumbSvg.setAttribute('width', '100%');
    thumbSvg.setAttribute('height', '100%');
    thumbSvg.style.pointerEvents = 'none';

    const thumbPath = document.createElementNS(SVG_NS, 'path');
    thumbPath.setAttribute('d', p.pathD);
    thumbPath.setAttribute('class', 'jigsaw-thumb-path');
    thumbPath.setAttribute('vector-effect', 'non-scaling-stroke');
    thumbSvg.appendChild(thumbPath);
    piece.appendChild(thumbSvg);

    const label = document.createElement('div');
    label.className = 'jigsaw-piece-label';
    label.textContent = p.country;
    piece.appendChild(label);

    piece.addEventListener('click', () => showZoomedPiece(p));
    p.el = piece;
  }

  // ── Shape similarity: rasterize each country, compare images ──
  const shapeItems = [];
  for (const p of pieces) {
    const raster = rasterizeShape(p.feature);
    if (raster) {
      p.raster = raster;
      shapeItems.push(p);
    }
  }
  const shapeGroups = buildShapeGroups(shapeItems);

  let groupByContinent = false;
  let groupBySimilarity = false;

  function renderPieces() {
    overlay.innerHTML = '';
    const sorted = [...pieces];

    if (groupBySimilarity) {
      // Render all pieces in similarity order (no separators)
      for (const group of shapeGroups) {
        for (const p of group.items) overlay.appendChild(p.el);
      }
      const withFeatures = new Set(shapeGroups.flatMap(g => g.items));
      const without = sorted.filter(p => !withFeatures.has(p));
      without.sort((a, b) => a.country.localeCompare(b.country));
      for (const p of without) overlay.appendChild(p.el);
    } else if (groupByContinent) {
      // Group by continent, then by aspect ratio within each continent
      const continentOrder = ['Africa', 'Americas', 'Asia', 'Europe', 'Oceania'];
      sorted.sort((a, b) => {
        const ci = continentOrder.indexOf(a.continent) - continentOrder.indexOf(b.continent);
        if (ci !== 0) return ci;
        return a.aspect - b.aspect;
      });
      let lastContinent = null;
      for (const p of sorted) {
        if (p.continent !== lastContinent) {
          lastContinent = p.continent;
          const header = document.createElement('div');
          header.className = 'jigsaw-group-header';
          header.textContent = p.continent;
          overlay.appendChild(header);
        }
        overlay.appendChild(p.el);
      }
    } else {
      sorted.sort((a, b) => a.country.localeCompare(b.country));
      for (const p of sorted) overlay.appendChild(p.el);
    }
  }

  renderPieces();

  // Sub-toggle 1: group by continent
  const btnGroup = document.createElement('button');
  btnGroup.className = 'study-toggle-btn study-jigsaw-sub-btn';
  btnGroup.title = 'Group by continent';
  btnGroup.textContent = '🌍';
  mapwrap.appendChild(btnGroup);
  btnGroup.style.display = 'none';

  // Sub-toggle 2: group by shape similarity
  const btnShape = document.createElement('button');
  btnShape.className = 'study-toggle-btn study-jigsaw-sub-btn-2';
  btnShape.title = 'Group by shape similarity';
  btnShape.textContent = '🔬';
  mapwrap.appendChild(btnShape);
  btnShape.style.display = 'none';

  btnGroup.addEventListener('click', () => {
    groupByContinent = !groupByContinent;
    if (groupByContinent) groupBySimilarity = false;
    btnGroup.classList.toggle('active', groupByContinent);
    btnShape.classList.toggle('active', groupBySimilarity);
    renderPieces();
  });

  btnShape.addEventListener('click', () => {
    groupBySimilarity = !groupBySimilarity;
    if (groupBySimilarity) groupByContinent = false;
    btnShape.classList.toggle('active', groupBySimilarity);
    btnGroup.classList.toggle('active', groupByContinent);
    renderPieces();
  });

  // Enlarged view popup
  const zoomPopup = document.createElement('div');
  zoomPopup.className = 'study-jigsaw-zoom';
  zoomPopup.style.display = 'none';
  mapwrap.appendChild(zoomPopup);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'study-jigsaw-zoom-close';
  closeBtn.textContent = '✕';
  closeBtn.setAttribute('aria-label', 'Close');

  const prevBtn = document.createElement('button');
  prevBtn.className = 'study-jigsaw-zoom-nav study-jigsaw-zoom-prev';
  prevBtn.textContent = '‹';
  prevBtn.setAttribute('aria-label', 'Previous');

  const nextBtn = document.createElement('button');
  nextBtn.className = 'study-jigsaw-zoom-nav study-jigsaw-zoom-next';
  nextBtn.textContent = '›';
  nextBtn.setAttribute('aria-label', 'Next');

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    zoomPopup.style.display = 'none';
  });

  zoomPopup.addEventListener('click', (e) => {
    if (e.target === zoomPopup) zoomPopup.style.display = 'none';
  });

  // Append buttons once — they stay in DOM permanently
  zoomPopup.appendChild(closeBtn);
  zoomPopup.appendChild(prevBtn);
  zoomPopup.appendChild(nextBtn);

  function getVisiblePieceOrder() {
    return pieces.filter(p => overlay.contains(p.el));
  }

  let currentZoomedPiece = null;

  prevBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const order = getVisiblePieceOrder();
    const idx = order.indexOf(currentZoomedPiece);
    if (idx > 0) showZoomedPiece(order[idx - 1]);
  });

  nextBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const order = getVisiblePieceOrder();
    const idx = order.indexOf(currentZoomedPiece);
    if (idx < order.length - 1) showZoomedPiece(order[idx + 1]);
  });

  function showZoomedPiece(p) {
    currentZoomedPiece = p;
    const bb = bboxOfMainlandLonLat(p.feature);
    const pbb = padBBox(bb, 0.15);
    const [tx1, ty1] = projEquirect([pbb.minLon, pbb.maxLat]);
    const [tx2, ty2] = projEquirect([pbb.maxLon, pbb.minLat]);
    const tw = tx2 - tx1;
    const th = ty2 - ty1;

    // Remove only content (SVG + name), keep buttons
    zoomPopup.querySelectorAll('svg, .study-jigsaw-zoom-name').forEach(el => el.remove());

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `${tx1} ${ty1} ${tw} ${th}`);

    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', p.pathD);
    path.setAttribute('class', 'jigsaw-thumb-path');
    path.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.appendChild(path);
    zoomPopup.appendChild(svg);

    const name = document.createElement('div');
    name.className = 'study-jigsaw-zoom-name';
    name.textContent = p.country;
    zoomPopup.appendChild(name);

    // Update nav button visibility
    const order = getVisiblePieceOrder();
    const idx = order.indexOf(p);
    prevBtn.style.display = idx > 0 ? '' : 'none';
    nextBtn.style.display = idx < order.length - 1 ? '' : 'none';

    zoomPopup.style.display = '';
  }

  const toggleBar = mapwrap.querySelector('.study-map-toggles');
  const searchInput = document.getElementById('study-search');
  const timelineBar = mapwrap.querySelector('.study-timeline-bar');

  btn.addEventListener('click', () => {
    showJigsaw = !showJigsaw;
    btn.classList.toggle('active', showJigsaw);
    overlay.style.display = showJigsaw ? '' : 'none';
    if (!showJigsaw) zoomPopup.style.display = 'none';

    // Show/hide sub-toggles and other controls
    btnGroup.style.display = showJigsaw ? '' : 'none';
    btnShape.style.display = showJigsaw ? '' : 'none';
    if (toggleBar) toggleBar.style.display = showJigsaw ? 'none' : '';
    if (searchInput) searchInput.style.display = showJigsaw ? 'none' : '';
    if (timelineBar) timelineBar.style.display = showJigsaw ? 'none' : '';
    if (showJigsaw) hideInfoPanel();
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

const initOverlay = document.getElementById('init-overlay');
if (initOverlay) initOverlay.style.display = 'none';

// Redraw when light/dark mode changes (theme toggle in menu)
new MutationObserver(() => drawWorldMap()).observe(
  document.documentElement, { attributes: true, attributeFilter: ['class'] }
);

createMapToggles();
createTimelineBar();
createJigsawOverlay();

// ── Zoom to country (desktop click) ──────────────────────────────────────────

let zoomAnimId = null;

function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2; }

function zoomToCountry(dataName) {
  const geoName = dataToGeo[dataName] || dataName;
  const country = countryPaths.find(c => c.name === geoName);
  if (!country) return;
  if (zoomAnimId) { cancelAnimationFrame(zoomAnimId); zoomAnimId = null; }

  const bboxW = country.bboxMaxX - country.bboxMinX;
  const bboxH = country.bboxMaxY - country.bboxMinY;

  // Target: fit country with padding
  const pad = 0.3;
  const toZoom = Math.max(viewport.minZoom, Math.min(
    canvasDisplayWidth / (bboxW * (1 + pad)),
    canvasDisplayHeight / (bboxH * (1 + pad)),
    500
  ));
  const toCx = (country.bboxMinX + country.bboxMaxX) / 2;
  const toCy = (country.bboxMinY + country.bboxMaxY) / 2;

  // Current center
  const fromZoom = viewport.zoom;
  const fromCx = viewport.scrollX + canvasDisplayWidth / (2 * fromZoom);
  const fromCy = viewport.scrollY + canvasDisplayHeight / (2 * fromZoom);

  // Log-space zoom interpolation (perceptually even)
  const fromLogZ = Math.log(fromZoom);
  const toLogZ = Math.log(toZoom);

  // Dynamic duration based on distance
  const dist = Math.hypot(
    (toCx - fromCx) * fromZoom,
    (toCy - fromCy) * fromZoom,
    (toLogZ - fromLogZ) * 200,
  );
  const duration = Math.max(500, Math.min(1000, dist * 1.2));
  const start = performance.now();

  function step(now) {
    const t = easeInOut(Math.min((now - start) / duration, 1));

    const z = Math.exp(fromLogZ + (toLogZ - fromLogZ) * t);
    const cx = fromCx + (toCx - fromCx) * t;
    const cy = fromCy + (toCy - fromCy) * t;

    viewport.zoom = z;
    viewport.scrollX = cx - canvasDisplayWidth / (2 * z);
    viewport.scrollY = Math.max(0, Math.min(cy - canvasDisplayHeight / (2 * z), getMapH() - canvasDisplayHeight / z));
    drawWorldMap();

    if (t < 1) {
      zoomAnimId = requestAnimationFrame(step);
    } else {
      zoomAnimId = null;
    }
  }
  zoomAnimId = requestAnimationFrame(step);
}

function zoomToPoint(lon, lat, targetZoom = 8) {
  if (zoomAnimId) { cancelAnimationFrame(zoomAnimId); zoomAnimId = null; }
  const [toCx, toCy] = proj([lon, lat]);
  const toZoom = Math.max(viewport.minZoom, targetZoom);

  const fromZoom = viewport.zoom;
  const fromCx = viewport.scrollX + canvasDisplayWidth / (2 * fromZoom);
  const fromCy = viewport.scrollY + canvasDisplayHeight / (2 * fromZoom);

  const fromLogZ = Math.log(fromZoom);
  const toLogZ = Math.log(toZoom);

  const dist = Math.hypot(
    (toCx - fromCx) * fromZoom,
    (toCy - fromCy) * fromZoom,
    (toLogZ - fromLogZ) * 200,
  );
  const duration = Math.max(500, Math.min(1000, dist * 1.2));
  const start = performance.now();

  function step(now) {
    const t = easeInOut(Math.min((now - start) / duration, 1));
    const z = Math.exp(fromLogZ + (toLogZ - fromLogZ) * t);
    const cx = fromCx + (toCx - fromCx) * t;
    const cy = fromCy + (toCy - fromCy) * t;
    viewport.zoom = z;
    viewport.scrollX = cx - canvasDisplayWidth / (2 * z);
    viewport.scrollY = Math.max(0, Math.min(cy - canvasDisplayHeight / (2 * z), getMapH() - canvasDisplayHeight / z));
    drawWorldMap();
    if (t < 1) {
      zoomAnimId = requestAnimationFrame(step);
    } else {
      zoomAnimId = null;
    }
  }
  zoomAnimId = requestAnimationFrame(step);
}

createPanZoom(canvas, viewport, drawWorldMap, {
  onHover(cx, cy) {
    // Overlay layers take priority: heritage > rivers > mountains/peaks > countries
    const site     = findHeritageAtPoint(cx, cy);
    const river    = !site     && findRiverAtPoint(cx, cy);
    const mountain = !site && !river && findMountainAtPoint(cx, cy);
    const peak     = !site && !river && !mountain && findPeakAtPoint(cx, cy);
    const overlay  = site || river || mountain || peak;

    if (overlay) {
      if (overlay !== hoveredOverlay) {
        hoveredOverlay = overlay;
        if (site)          updateInfoPanelForHeritage(site);
        else if (river)    updateInfoPanelForRiver(river);
        else if (mountain) updateInfoPanelForMountain(mountain);
        else               updateInfoPanelForPeak(peak);
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
    if (activeEmpire) {
      updateInfoPanelForEmpire(activeEmpire);
    } else {
      hideInfoPanel();
    }
    drawWorldMap();
  },
  onTap(cx, cy, e) {
    // Heritage site image popup
    const site = findHeritageAtPoint(cx, cy);
    if (site) {
      hideInfoPanel();
      hideFactOverlay();
      showHeritagePopup(site);
      return;
    }
    if (heritagePopupVisible) hideHeritagePopup();

    // River / mountain tap — show info panel
    const river = findRiverAtPoint(cx, cy);
    if (river) {
      hoveredCountry = null;
      hideFactOverlay();
      updateInfoPanelForRiver(river);
      drawWorldMap();
      return;
    }
    const mountain = findMountainAtPoint(cx, cy);
    if (mountain) {
      hoveredCountry = null;
      hideFactOverlay();
      updateInfoPanelForMountain(mountain);
      drawWorldMap();
      return;
    }
    const peak = findPeakAtPoint(cx, cy);
    if (peak) {
      hoveredCountry = null;
      hideFactOverlay();
      updateInfoPanelForPeak(peak);
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
    if (name) {
      // Desktop click: zoom into the country
      if (e.pointerType !== 'touch') {
        hoveredCountry = name;
        updateInfoPanel(name);
        showFactOverlay(name);
        drawWorldMap();
        zoomToCountry(name);
      } else if (name !== hoveredCountry) {
        hoveredCountry = name;
        updateInfoPanel(name);
        drawWorldMap();
      } else {
        hoveredCountry = null;
        hideInfoPanel();
        hideFactOverlay();
        drawWorldMap();
      }
    } else {
      hoveredCountry = null;
      hideInfoPanel();
      hideFactOverlay();
      drawWorldMap();
    }
  },
});

// ── Search ────────────────────────────────────────────────────────────────────

const searchInput = document.getElementById('study-search');
if (searchInput && window.initMobileAutocomplete) {
  const searchActions = new Map();

  // Countries & territories
  for (const c of (window.ALL_COUNTRIES || window.DATA)) {
    searchActions.set(c.country, () => {
      hoveredCountry = c.country;
      updateInfoPanel(c.country);
      showFactOverlay(c.country);
      drawWorldMap();
      zoomToCountry(c.country);
    });
  }

  // Capitals
  for (const [country, cap] of capitalDots) {
    const label = `${cap.name} (capital of ${country})`;
    searchActions.set(label, () => {
      hoveredCountry = country;
      updateInfoPanel(country);
      drawWorldMap();
      zoomToPoint(cap.lon, cap.lat, 10);
    });
  }

  // Cities
  for (const [country, cities] of cityDots) {
    for (const city of cities) {
      const label = `${city.name} (city in ${country})`;
      if (!searchActions.has(label)) {
        searchActions.set(label, () => {
          hoveredCountry = country;
          updateInfoPanel(country);
          drawWorldMap();
          zoomToPoint(city.lon, city.lat, 12);
        });
      }
    }
  }

  // Rivers
  for (const river of riversData) {
    const mid = river.path[Math.floor(river.path.length / 2)];
    const label = `${river.name} (river)`;
    searchActions.set(label, () => {
      hoveredCountry = null;
      hoveredOverlay = river;
      updateInfoPanelForRiver(river);
      drawWorldMap();
      zoomToPoint(mid[0], mid[1], 3);
    });
  }

  // Mountain ranges
  for (const range of mountainsData) {
    const mid = range.path[Math.floor(range.path.length / 2)];
    const label = `${range.name} (mountain range)`;
    searchActions.set(label, () => {
      hoveredCountry = null;
      hoveredOverlay = range;
      updateInfoPanelForMountain(range);
      drawWorldMap();
      zoomToPoint(mid[0], mid[1], 3);
    });
  }

  // Peaks
  for (const peak of peaksData) {
    const label = `${peak.name} (peak, ${peak.elev}m)`;
    searchActions.set(label, () => {
      hoveredCountry = null;
      hoveredOverlay = peak;
      updateInfoPanelForPeak(peak);
      drawWorldMap();
      zoomToPoint(peak.lon, peak.lat, 8);
    });
  }

  // Heritage sites
  for (const site of heritageSitesData) {
    const label = `${site.siteName} (heritage site)`;
    if (!searchActions.has(label)) {
      searchActions.set(label, () => {
        hoveredCountry = null;
        hoveredOverlay = site;
        updateInfoPanelForHeritage(site);
        drawWorldMap();
        zoomToPoint(site.lon, site.lat, 6);
      });
    }
  }

  const suggestions = [...searchActions.keys()].sort();

  searchInput.focus();

  window.initMobileAutocomplete(searchInput, suggestions, {
    maxSuggestions: 8,
    minChars: 1,
    onSelect(value) {
      const action = searchActions.get(value);
      if (action) action();
      searchInput.value = '';
      setTimeout(() => searchInput.focus(), 0);
    },
  });

  // Also handle Enter without autocomplete selection (typed full name)
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = searchInput.value.trim();
      if (!val) return;
      // Try exact match first
      const action = searchActions.get(val);
      if (action) {
        action();
        searchInput.value = '';
        return;
      }
      // Try case-insensitive prefix match
      const lower = val.toLowerCase();
      const match = suggestions.find(s => s.toLowerCase().startsWith(lower));
      if (match) {
        const matchAction = searchActions.get(match);
        if (matchAction) matchAction();
        searchInput.value = '';
      }
    }
  });
}
