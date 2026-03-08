/**
 * Canvas Map Engine — Shared canvas world-map primitives.
 *
 * Provides the equirectangular projection, country path preprocessing,
 * point-in-polygon hit testing, draw helpers, canvas resize, and
 * pan/zoom/pinch interaction engine.
 *
 * Used by: find-country-complete.js, geo-features-complete.js, study-main.js
 */

import { norm } from './utils.js';
import { COUNTRY_ALIASES } from './aliases.js';

export const MAP_W = 600;
export const MAP_H = 320;

/** Equirectangular projection: [lon, lat] → [mapX, mapY] */
export const proj = ([lon, lat]) => [
  ((lon + 180) / 360) * MAP_W,
  ((90 - lat) / 180) * MAP_H,
];

// ── CSS color cache (auto-clears on theme toggle) ────────────────────────────

let _colorCache = null;

/** Read a CSS custom property from :root (cached per theme) */
export function getCSSVar(name) {
  if (!_colorCache) _colorCache = {};
  if (!(name in _colorCache)) {
    _colorCache[name] = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  return _colorCache[name];
}

/** Force-clear the CSS color cache */
export function clearColorCache() { _colorCache = null; }

// Auto-clear when theme class changes on <html>
new MutationObserver(() => { _colorCache = null; })
  .observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

/**
 * Convert a GeoJSON feature to canvas path arrays.
 * @param {Object} f - GeoJSON Feature
 * @returns {Array<Array<[number,number]>>} Array of rings, each ring is [[x,y],…]
 */
export function coordsFromFeature(f) {
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

/**
 * Build preprocessed country path data from GeoJSON world features.
 *
 * - Merges multi-feature countries
 * - Scales Vatican ×90 so it's visible and clickable
 * - Computes bounding boxes
 * - Returns paths sorted smallest-first for hit-test priority
 * - Identifies micro-countries (sub-pixel at normal zoom) for proximity detection
 *
 * @param {Array} worldFeatures - GeoJSON feature array
 * @returns {{ countryPaths, hitTestPaths, microCountries }}
 */
export function buildCountryPaths(worldFeatures) {
  const countryMap = new Map();
  for (const feature of worldFeatures) {
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

  // Scale Vatican up so its polygon is visible and clickable
  const vaticanEntry = countryPaths.find(c => norm(c.name) === 'vatican');
  if (vaticanEntry?.paths.length > 0) {
    const S = 90;
    vaticanEntry.paths = vaticanEntry.paths.map(ring => {
      const cx = ring.reduce((s, [x]) => s + x, 0) / ring.length;
      const cy = ring.reduce((s, [, y]) => s + y, 0) / ring.length;
      return ring.map(([x, y]) => [cx + (x - cx) * S, cy + (y - cy) * S]);
    });
  }

  // Pre-compute bounding boxes for hit-test ordering and proximity fallback
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
    country.bboxCx = (minX + maxX) / 2;
    country.bboxCy = (minY + maxY) / 2;
    country.bboxMinX = minX;
    country.bboxMinY = minY;
    country.bboxMaxX = maxX;
    country.bboxMaxY = maxY;

    // Label centroid: average of the largest polygon ring by vertex count.
    // The bbox center is wrong for countries with scattered islands or those
    // crossing the antimeridian (Russia, US, Kiribati, New Zealand) — the min/max
    // spans the entire map and the midpoint lands in the wrong ocean.
    // Using the centroid of the largest ring naturally picks the main landmass.
    let bestRing = null, bestCount = 0;
    for (const ring of country.paths) {
      if (ring.length > bestCount) { bestCount = ring.length; bestRing = ring; }
    }
    if (bestRing) {
      let sumX = 0, sumY = 0;
      let minRX = Infinity, minRY = Infinity, maxRX = -Infinity, maxRY = -Infinity;
      for (const [x, y] of bestRing) {
        sumX += x; sumY += y;
        if (x < minRX) minRX = x; if (x > maxRX) maxRX = x;
        if (y < minRY) minRY = y; if (y > maxRY) maxRY = y;
      }
      country.labelCx = sumX / bestRing.length;
      country.labelCy = sumY / bestRing.length;
      // Size of just the label ring — used for font sizing in study mode.
      // Prevents scattered island nations (France with overseas departments,
      // US Minor Outlying Islands, etc.) from getting huge font sizes from
      // their overall bbox which spans the globe.
      country.labelRingSize = Math.max(maxRX - minRX, maxRY - minRY);
    } else {
      country.labelCx = country.bboxCx;
      country.labelCy = country.bboxCy;
      country.labelRingSize = country.bboxSize;
    }

    // Pre-build Path2D for GPU-accelerated rendering
    const path = new Path2D();
    for (const ring of country.paths) {
      if (ring.length === 0) continue;
      path.moveTo(ring[0][0], ring[0][1]);
      for (let k = 1; k < ring.length; k++) {
        path.lineTo(ring[k][0], ring[k][1]);
      }
      path.closePath();
    }
    country.path2d = path;

    // Pre-normalize name for fast lookups
    country.normName = norm(country.name);
  }

  // Smallest-first → small enclosed countries (Monaco, San Marino) get priority
  const hitTestPaths = [...countryPaths].sort((a, b) => a.bboxSize - b.bboxSize);

  // Micro-countries: polygon too small for reliable point-in-polygon (e.g. Monaco)
  // Vatican is excluded here because its polygon was scaled up above
  const MICRO_SIZE = 0.1; // map units
  const microCountries = hitTestPaths.filter(c => c.bboxSize < MICRO_SIZE);

  return { countryPaths, hitTestPaths, microCountries };
}

/**
 * Build DATA↔GeoJSON name lookup tables.
 *
 * @param {Array} countryPaths - From buildCountryPaths
 * @returns {{ dataToGeo, geoToData, resolveToDataName }}
 */
export function buildNameLookups(countryPaths) {
  const dataToGeo = {}; // DATA country name → GeoJSON ADMIN name
  const geoToData = {}; // GeoJSON ADMIN name → DATA country name

  for (const { name: geoName } of countryPaths) {
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

  /**
   * Resolve a GeoJSON ADMIN name to the matching window.DATA country name.
   * Checks direct match and alias lookup.
   */
  function resolveToDataName(geoName) {
    const gn = norm(geoName);
    const aliasTarget = COUNTRY_ALIASES[geoName];
    for (const d of (window.DATA || [])) {
      if (norm(d.country) === gn) return d.country;
      if (aliasTarget && norm(aliasTarget) === norm(d.country)) return d.country;
    }
    return null;
  }

  return { dataToGeo, geoToData, resolveToDataName };
}

/**
 * Ray-casting point-in-polygon test.
 * @param {number} x
 * @param {number} y
 * @param {Array<[number,number]>} polygon
 * @returns {boolean}
 */
export function pointInPolygon(x, y, polygon) {
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

/**
 * Full country hit detection with world-wrap support.
 *
 * @param {number} canvasX - Canvas X coordinate
 * @param {number} canvasY - Canvas Y coordinate
 * @param {Object} opts
 * @param {number} opts.scrollX
 * @param {number} opts.scrollY
 * @param {number} opts.zoom
 * @param {Array}  opts.hitTestPaths - From buildCountryPaths
 * @param {Array}  [opts.microCountries] - From buildCountryPaths
 * @param {Function} opts.resolveToDataName - From buildNameLookups
 * @param {string} [opts.targetCountry] - DATA name of country being sought (for micro pre-pass)
 * @param {Object} [opts.dataToGeo] - From buildNameLookups (needed for micro pre-pass)
 * @param {Set}    [opts.filteredNames] - Set of norm'd GeoJSON names to include (continent filter)
 * @returns {string|null} DATA country name, or null
 */
export function checkClickedCountry(canvasX, canvasY, opts) {
  const {
    scrollX, scrollY, zoom,
    hitTestPaths,
    microCountries = [],
    resolveToDataName,
    targetCountry = null,
    dataToGeo = {},
    filteredNames = null,
  } = opts;

  const mapX = canvasX / zoom + scrollX;
  const mapY = canvasY / zoom + scrollY;
  const normalizedMapX = ((mapX % MAP_W) + MAP_W) % MAP_W;

  // Pre-pass: proximity hit for micro-countries when specifically sought.
  // Only activates when the player is seeking a micro-country, to avoid
  // false positives when clicking on the surrounding larger country.
  if (targetCountry && microCountries.length > 0) {
    const targetGeoName = dataToGeo[targetCountry] || targetCountry;
    const targetMicro = microCountries.find(c => norm(c.name) === norm(targetGeoName));
    if (targetMicro) {
      const MICRO_PROXIMITY = 3; // map units (~110 km)
      const dx = normalizedMapX - targetMicro.bboxCx;
      const dy = mapY - targetMicro.bboxCy;
      if (Math.sqrt(dx * dx + dy * dy) < MICRO_PROXIMITY) {
        return targetCountry;
      }
      // Click missed the micro-country; fall through so the player can still
      // select the wrong country they actually clicked on.
    }
  }

  // Main pass: point-in-polygon, smallest countries checked first
  for (const country of hitTestPaths) {
    if (filteredNames && !filteredNames.has(norm(country.name))) continue;
    for (const polygon of country.paths) {
      if (pointInPolygon(normalizedMapX, mapY, polygon)) {
        return resolveToDataName(country.name) || country.name;
      }
    }
  }

  // Proximity fallback for small but non-micro countries
  let nearestName = null, nearestDist = Infinity;
  for (const country of hitTestPaths) {
    if (country.bboxSize > 50) continue;
    if (filteredNames && !filteredNames.has(norm(country.name))) continue;
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

/**
 * Draw a single country polygon with world-coordinate math.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} viewport - { scrollX, scrollY, zoom }
 * @param {Array<Array<[number,number]>>} paths
 * @param {number} offsetX - World-copy offset (0 = primary, ±MAP_W = adjacent copies)
 * @param {string} fill
 * @param {string} stroke
 * @param {number} strokeWidth
 */
export function drawCountry(ctx, viewport, paths, offsetX, fill, stroke, strokeWidth) {
  const { scrollX, scrollY, zoom } = viewport;
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
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Draw countries in batched mode using cached Path2D objects and canvas transforms.
 *
 * Uses canvas transform + Path2D for GPU-accelerated rendering, viewport culling
 * to skip off-screen countries, and groups countries by fill/stroke style
 * to minimize draw calls (~5 instead of ~200).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} viewport - { scrollX, scrollY, zoom }
 * @param {Array} items - [{ path2d, fill, stroke, strokeWidth, bboxMinX, bboxMaxX, bboxMinY, bboxMaxY }]
 * @param {number[]} offsets - World-copy offsets from visibleOffsets()
 * @param {number} canvasW - Canvas display width in CSS pixels
 * @param {number} canvasH - Canvas display height in CSS pixels
 */
export function drawCountriesBatch(ctx, viewport, items, offsets, canvasW, canvasH) {
  const { scrollX, scrollY, zoom } = viewport;
  const viewTop = scrollY;
  const viewBottom = scrollY + canvasH / zoom;

  for (const offset of offsets) {
    const localViewLeft = scrollX - offset;
    const localViewRight = localViewLeft + canvasW / zoom;

    ctx.save();
    ctx.translate((offset - scrollX) * zoom, -scrollY * zoom);
    ctx.scale(zoom, zoom);

    // Group visible countries by style for batched draw calls
    const groups = new Map();
    for (const item of items) {
      // Viewport culling — skip countries entirely off-screen
      if (item.bboxMaxX < localViewLeft || item.bboxMinX > localViewRight ||
          item.bboxMaxY < viewTop || item.bboxMinY > viewBottom) continue;

      const key = item.fill + '|' + item.stroke + '|' + item.strokeWidth;
      let group = groups.get(key);
      if (!group) {
        group = { fill: item.fill, stroke: item.stroke, strokeWidth: item.strokeWidth, combined: new Path2D() };
        groups.set(key, group);
      }
      group.combined.addPath(item.path2d);
    }

    // Draw each group in a single fill + stroke call
    for (const group of groups.values()) {
      ctx.fillStyle = group.fill;
      ctx.fill(group.combined);
      ctx.strokeStyle = group.stroke;
      ctx.lineWidth = group.strokeWidth / zoom;
      ctx.stroke(group.combined);
    }

    ctx.restore();
  }
}

/**
 * Compute world-copy X offsets visible in the current viewport.
 * Returns offsets for the primary and up to two adjacent world copies.
 *
 * @param {Object} viewport - { scrollX, zoom }
 * @param {number} canvasW - Canvas display width in CSS pixels
 * @returns {number[]} Array of offsetX values
 */
export function visibleOffsets(viewport, canvasW) {
  const { scrollX, zoom } = viewport;
  const viewWidthInMapUnits = canvasW / zoom;
  // Intentionally wider culling window (same as original code)
  const viewLeft = scrollX - viewWidthInMapUnits / 2;
  const viewRight = scrollX + viewWidthInMapUnits / 2;

  const normalizedScrollX = ((scrollX % MAP_W) + MAP_W) % MAP_W;
  const baseOffset = scrollX - normalizedScrollX;

  const offsets = [];
  for (let i = -1; i <= 1; i++) {
    const offset = baseOffset + i * MAP_W;
    if (offset + MAP_W >= viewLeft && offset <= viewRight) {
      offsets.push(offset);
    }
  }
  return offsets;
}

/**
 * Resize canvas to fill its parent element and apply DPR scaling.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} dpr - window.devicePixelRatio
 * @param {HTMLElement} parentEl
 * @returns {{ w: number, h: number, minZoom: number }}
 */
export function setupCanvas(canvas, ctx, dpr, parentEl) {
  const rect = parentEl.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  const minZoom = Math.max(h / MAP_H, w / MAP_W);

  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  canvas.width = w * dpr;
  canvas.height = h * dpr;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);

  return { w, h, minZoom };
}

/**
 * Attach pan/zoom/pinch-to-zoom interaction to a canvas.
 *
 * The engine reads and writes the shared `viewport` object:
 * `{ scrollX, scrollY, zoom, minZoom, velocityX, velocityY }`
 *
 * Scroll-Y is clamped so the map never scrolls off-screen vertically.
 * Scroll-X wraps freely (horizontal world tiling).
 *
 * @param {HTMLCanvasElement} canvas
 * @param {Object} viewport - Shared mutable viewport state
 * @param {Function} redrawFn - Called to redraw the canvas
 * @param {Object} [opts]
 * @param {Function} [opts.onTap] - Called on click/tap (no drag, not after pinch)
 * @param {Function} [opts.onHover] - Called on pointermove for non-touch pointers only
 * @param {Function} [opts.onLeave] - Called when non-touch pointer leaves canvas
 * @param {number}   [opts.maxZoom=500]
 * @returns {{ startAnimation: Function, destroy: Function }}
 */
export function createPanZoom(canvas, viewport, redrawFn, opts = {}) {
  const {
    onTap = null,
    onHover = null,
    onLeave = null,
    maxZoom = 500,
  } = opts;

  const FRICTION = 0.95;
  const MIN_VELOCITY = 0.1;
  let animationFrameId = null;

  function clampScrollY(sy, canvasH) {
    return Math.max(0, Math.min(Math.max(0, MAP_H - canvasH / viewport.zoom), sy));
  }

  function animate() {
    if (Math.abs(viewport.velocityX) > MIN_VELOCITY || Math.abs(viewport.velocityY) > MIN_VELOCITY) {
      viewport.scrollX += viewport.velocityX;
      viewport.scrollY += viewport.velocityY;

      const canvasH = canvas.getBoundingClientRect().height;
      const maxSY = Math.max(0, MAP_H - canvasH / viewport.zoom);
      if (viewport.scrollY < 0) { viewport.scrollY = 0; viewport.velocityY = 0; }
      if (viewport.scrollY > maxSY) { viewport.scrollY = maxSY; viewport.velocityY = 0; }

      viewport.velocityX *= FRICTION;
      viewport.velocityY *= FRICTION;

      redrawFn();
      animationFrameId = requestAnimationFrame(animate);
    } else {
      viewport.velocityX = 0;
      viewport.velocityY = 0;
      animationFrameId = null;
    }
  }

  function startAnimation() {
    if (!animationFrameId) {
      animationFrameId = requestAnimationFrame(animate);
    }
  }

  // ── Wheel zoom ────────────────────────────────────────────────────────────

  function onWheel(e) {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(viewport.minZoom, Math.min(maxZoom, viewport.zoom * factor));
    const mapXBefore = mouseX / viewport.zoom + viewport.scrollX;
    const mapYBefore = mouseY / viewport.zoom + viewport.scrollY;
    viewport.zoom = newZoom;
    viewport.scrollX = mapXBefore - mouseX / viewport.zoom;
    viewport.scrollY = clampScrollY(mapYBefore - mouseY / viewport.zoom, rect.height);
    redrawFn();
  }

  // ── Pointer (mouse + touch) ───────────────────────────────────────────────

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

  function onPointerDown(e) {
    e.preventDefault();
    if (e.pointerType === 'touch') {
      touches.push(e);
      if (touches.length === 2) {
        initialPinchDist = getDistance(touches[0], touches[1]);
        initialZoom = viewport.zoom;
        isDragging = false;
        hadPinch = true;
      } else if (touches.length === 1) {
        hadPinch = false;
        isPointerDown = true;
        const rect = canvas.getBoundingClientRect();
        startX = lastX = e.clientX - rect.left;
        startY = lastY = e.clientY - rect.top;
        lastTime = Date.now();
        viewport.velocityX = 0;
        viewport.velocityY = 0;
        isDragging = false;
      }
    } else {
      isPointerDown = true;
      const rect = canvas.getBoundingClientRect();
      startX = lastX = e.clientX - rect.left;
      startY = lastY = e.clientY - rect.top;
      lastTime = Date.now();
      viewport.velocityX = 0;
      viewport.velocityY = 0;
      isDragging = false;
    }
  }

  function onPointerMove(e) {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    // Hover — desktop/mouse/pen only, never touch
    if (onHover && e.pointerType !== 'touch' && !isPointerDown) {
      onHover(currentX, currentY, e);
    }

    if (e.pointerType === 'touch') {
      const idx = touches.findIndex(t => t.pointerId === e.pointerId);
      if (idx >= 0) touches[idx] = e;

      if (touches.length === 2) {
        isDragging = false;
        isPointerDown = false;
        const midX = (touches[0].clientX + touches[1].clientX) / 2 - rect.left;
        const midY = (touches[0].clientY + touches[1].clientY) / 2 - rect.top;
        const mapXB = midX / viewport.zoom + viewport.scrollX;
        const mapYB = midY / viewport.zoom + viewport.scrollY;
        const scale = getDistance(touches[0], touches[1]) / initialPinchDist;
        const newZoom = Math.max(viewport.minZoom, Math.min(maxZoom, initialZoom * scale));
        viewport.scrollX = mapXB - midX / newZoom;
        viewport.scrollY = clampScrollY(mapYB - midY / newZoom, rect.height);
        viewport.zoom = newZoom;
        redrawFn();
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

      viewport.scrollX -= dx / viewport.zoom;
      viewport.scrollY = clampScrollY(viewport.scrollY - dy / viewport.zoom, rect.height);

      if (dt > 0) {
        viewport.velocityX = -dx / viewport.zoom;
        viewport.velocityY = -dy / viewport.zoom;
      }

      lastX = currentX;
      lastY = currentY;
      lastTime = Date.now();
      redrawFn();
    }
  }

  function onPointerUp(e) {
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
        if (!isDragging && !wasRecentlyPinching) {
          const rect = canvas.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const clickY = e.clientY - rect.top;
          if (onTap) onTap(clickX, clickY, e);
        } else {
          startAnimation();
        }
      }
    } else {
      if (!isDragging) {
        const rect = canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        if (onTap) onTap(clickX, clickY, e);
      } else {
        startAnimation();
      }
      isPointerDown = false;
    }
  }

  function onPointerCancel() {
    isPointerDown = false;
    touches = [];
  }

  function onPointerLeave(e) {
    // Only fire onLeave for non-touch (desktop hover cleanup)
    if (e.pointerType !== 'touch' && onLeave) {
      onLeave();
    }
  }

  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);
  canvas.addEventListener('pointerleave', onPointerLeave);

  canvas.style.touchAction = 'none';
  canvas.style.cursor = 'pointer';

  function destroy() {
    canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerCancel);
    canvas.removeEventListener('pointerleave', onPointerLeave);
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  return { startAnimation, destroy };
}
