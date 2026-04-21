import { MAP_W, MAP_H_MERC, projMercator } from '../../../js/canvas-map-engine.js';
import { drawOSMTiles } from '../../../js/osm-tiles.js';

const TARGET_OSM_ZOOM = 13;
const MIN_OSM_ZOOM = 11;
const MAX_OSM_ZOOM = 16;
const LOCATION_OFFSETS = {
  hotel: { x: -78, y: -40 },
  market: { x: 74, y: -22 },
  library: { x: -54, y: 58 },
  embassy: { x: 70, y: 62 },
  airport: { x: 4, y: -78 },
};

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[c]));
}

function getTheme() {
  return 'standard';
}

function zoomForOsmLevel(level) {
  return (2 ** level) * 256 / MAP_W;
}

function getGeoPoints(options) {
  const points = [options.center];
  if (options.airport) points.push({ lat: options.airport.lat, lon: options.airport.lon });
  for (const poi of Object.values(options.pois || {})) {
    if (Number.isFinite(poi?.lat) && Number.isFinite(poi?.lon)) {
      points.push({ lat: poi.lat, lon: poi.lon });
    }
  }
  return points;
}

function getViewport(options, width, height) {
  const projected = getGeoPoints(options).map(point => {
    const [x, y] = projMercator([point.lon, point.lat]);
    return { x, y };
  });
  const centerProjected = projected.reduce((acc, point) => ({
    x: acc.x + point.x / projected.length,
    y: acc.y + point.y / projected.length,
  }), { x: 0, y: 0 });
  const xs = projected.map(point => point.x);
  const ys = projected.map(point => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const padding = Math.min(130, Math.max(70, Math.min(width, height) * 0.16));
  const fitZoomX = (width - padding * 2) / Math.max(0.0001, maxX - minX);
  const fitZoomY = (height - padding * 2) / Math.max(0.0001, maxY - minY);
  const zoom = Math.max(
    zoomForOsmLevel(MIN_OSM_ZOOM),
    Math.min(zoomForOsmLevel(TARGET_OSM_ZOOM), fitZoomX, fitZoomY)
  );
  return {
    scrollX: centerProjected.x - width / (2 * zoom),
    scrollY: centerProjected.y - height / (2 * zoom),
    zoom,
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clampViewport(viewport, width, height) {
  const minZoom = zoomForOsmLevel(MIN_OSM_ZOOM);
  const maxZoom = zoomForOsmLevel(MAX_OSM_ZOOM);
  viewport.zoom = clamp(viewport.zoom, minZoom, maxZoom);
  const maxScrollY = Math.max(0, MAP_H_MERC - height / viewport.zoom);
  viewport.scrollY = clamp(viewport.scrollY, 0, maxScrollY);
  const maxScrollX = Math.max(0, MAP_W - width / viewport.zoom);
  viewport.scrollX = clamp(viewport.scrollX, -MAP_W * 0.05, maxScrollX + MAP_W * 0.05);
  return viewport;
}

function projectToScreen(lat, lon, viewport) {
  const [x, y] = projMercator([lon, lat]);
  return {
    x: (x - viewport.scrollX) * viewport.zoom,
    y: (y - viewport.scrollY) * viewport.zoom,
  };
}

export function createCityInvestigationMap(container, locations, options, onPick) {
  container.innerHTML = `
    <div class="carmen-city-map">
      <div class="carmen-city-map-head">
        <div>
          <div class="carmen-city-map-title">${esc(options.capital)}</div>
          <div class="carmen-city-map-subtitle">ACME field stops near the capital</div>
        </div>
        <div class="carmen-city-map-country">${esc(options.country)}</div>
      </div>
      <div class="carmen-city-map-wrap">
        <canvas class="carmen-city-map-canvas" aria-hidden="true"></canvas>
        <div class="carmen-city-map-pins" aria-label="City investigation map"></div>
        <div class="carmen-city-map-controls" aria-label="Map controls">
          <button type="button" class="carmen-city-map-control" data-map-control="zoom-in" title="Zoom in" aria-label="Zoom in">+</button>
          <button type="button" class="carmen-city-map-control" data-map-control="zoom-out" title="Zoom out" aria-label="Zoom out">−</button>
          <button type="button" class="carmen-city-map-control" data-map-control="reset" title="Reset map view" aria-label="Reset map view">⌂</button>
        </div>
        <div class="carmen-city-map-attribution">Map tiles © OpenStreetMap contributors</div>
      </div>
    </div>
  `;

  const canvas = container.querySelector('.carmen-city-map-canvas');
  const mapWrap = container.querySelector('.carmen-city-map-wrap');
  const pinsLayer = container.querySelector('.carmen-city-map-pins');
  const ctx = canvas.getContext('2d');
  const pinButtons = new Map();
  let viewport = null;
  let initialViewport = null;
  let resizeObserver = null;
  let destroyed = false;
  let redrawQueued = false;
  let hasUserNavigated = false;
  let lastSize = { width: 0, height: 0 };
  let dragState = null;
  const activePointers = new Map();
  let pinchState = null;

  const getSize = () => {
    const rect = mapWrap.getBoundingClientRect();
    const fallbackRect = container.getBoundingClientRect();
    const width = rect.width || fallbackRect.width;
    const height = rect.height || fallbackRect.height;
    return {
      width: Math.max(240, Math.round(width || 320)),
      height: Math.max(180, Math.round(height || 240)),
    };
  };

  const requestRedraw = () => {
    if (destroyed || redrawQueued) return;
    redrawQueued = true;
    requestAnimationFrame(() => {
      redrawQueued = false;
      draw();
    });
  };

  function draw() {
    if (destroyed || !ctx) return;
    const { width, height } = getSize();
    const resized = width !== lastSize.width || height !== lastSize.height;
    lastSize = { width, height };
    const ratio = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#d7d2c4';
    ctx.fillRect(0, 0, width, height);

    if (!viewport || !hasUserNavigated || resized) {
      initialViewport = getViewport(options, width, height);
      if (!hasUserNavigated || !viewport) {
        viewport = { ...initialViewport };
      } else {
        clampViewport(viewport, width, height);
      }
    }
    drawOSMTiles(ctx, viewport, MAP_W, MAP_H_MERC, width, height, getTheme(), requestRedraw);
    positionPins(width, height);
  }

  function zoomAt(screenX, screenY, nextZoom) {
    if (!viewport) return;
    const { width, height } = getSize();
    const zoom = clamp(nextZoom, zoomForOsmLevel(MIN_OSM_ZOOM), zoomForOsmLevel(MAX_OSM_ZOOM));
    const mapX = viewport.scrollX + screenX / viewport.zoom;
    const mapY = viewport.scrollY + screenY / viewport.zoom;
    viewport.scrollX = mapX - screenX / zoom;
    viewport.scrollY = mapY - screenY / zoom;
    viewport.zoom = zoom;
    clampViewport(viewport, width, height);
    hasUserNavigated = true;
    requestRedraw();
  }

  function zoomBy(factor, anchor = null) {
    const { width, height } = getSize();
    zoomAt(anchor?.x ?? width / 2, anchor?.y ?? height / 2, (viewport?.zoom || zoomForOsmLevel(TARGET_OSM_ZOOM)) * factor);
  }

  function resetView() {
    const { width, height } = getSize();
    initialViewport = getViewport(options, width, height);
    viewport = { ...initialViewport };
    hasUserNavigated = false;
    requestRedraw();
  }

  function positionPins(width, height) {
    if (!viewport) return;
    const centerPoint = projectToScreen(options.center.lat, options.center.lon, viewport);

    for (const loc of locations) {
      const button = pinButtons.get(loc.id);
      if (!button) continue;
      let point = null;
      if (loc.id === 'airport' && options.airport) {
        point = projectToScreen(options.airport.lat, options.airport.lon, viewport);
      } else if (options.pois?.[loc.id]) {
        point = projectToScreen(options.pois[loc.id].lat, options.pois[loc.id].lon, viewport);
      } else {
        const offset = LOCATION_OFFSETS[loc.id] || { x: 0, y: 0 };
        point = { x: centerPoint.x + offset.x, y: centerPoint.y + offset.y };
      }
      const margin = 18;
      const onScreen = point.x >= -margin && point.x <= width + margin && point.y >= -margin && point.y <= height + margin;
      button.style.display = onScreen ? '' : 'none';
      button.style.left = `${point.x}px`;
      button.style.top = `${point.y}px`;
    }
  }

  function eventPoint(e) {
    const rect = mapWrap.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function pointerDistance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function pointerMidpoint(a, b) {
    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
    };
  }

  function onWheel(e) {
    e.preventDefault();
    if (!viewport) return;
    const point = eventPoint(e);
    const factor = Math.exp(-e.deltaY * 0.0015);
    zoomBy(factor, point);
  }

  function onPointerDown(e) {
    if (e.target.closest('.carmen-city-map-pin, .carmen-city-map-controls')) return;
    if (!viewport) return;
    e.preventDefault();
    mapWrap.setPointerCapture?.(e.pointerId);
    const point = eventPoint(e);
    activePointers.set(e.pointerId, point);
    if (activePointers.size === 2) {
      const [a, b] = [...activePointers.values()];
      pinchState = {
        distance: pointerDistance(a, b),
        zoom: viewport.zoom,
        midpoint: pointerMidpoint(a, b),
      };
      dragState = null;
    } else if (activePointers.size === 1) {
      dragState = { x: point.x, y: point.y };
      pinchState = null;
      mapWrap.classList.add('is-dragging');
    }
  }

  function onPointerMove(e) {
    if (!activePointers.has(e.pointerId) || !viewport) return;
    e.preventDefault();
    const point = eventPoint(e);
    activePointers.set(e.pointerId, point);
    const { width, height } = getSize();
    if (activePointers.size >= 2 && pinchState) {
      const [a, b] = [...activePointers.values()];
      const distance = pointerDistance(a, b);
      if (pinchState.distance > 0) {
        zoomAt(pinchState.midpoint.x, pinchState.midpoint.y, pinchState.zoom * (distance / pinchState.distance));
      }
      return;
    }
    if (!dragState) return;
    const dx = point.x - dragState.x;
    const dy = point.y - dragState.y;
    viewport.scrollX -= dx / viewport.zoom;
    viewport.scrollY -= dy / viewport.zoom;
    clampViewport(viewport, width, height);
    dragState = point;
    hasUserNavigated = true;
    requestRedraw();
  }

  function onPointerEnd(e) {
    activePointers.delete(e.pointerId);
    if (activePointers.size < 2) pinchState = null;
    if (activePointers.size === 1) {
      const [point] = activePointers.values();
      dragState = point;
    } else {
      dragState = null;
      mapWrap.classList.remove('is-dragging');
    }
  }

  for (const loc of locations) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'carmen-city-map-pin';
    button.dataset.location = loc.id;
    const poi = options.pois?.[loc.id] || null;
    if (poi) {
      button.classList.add('real-place');
      button.dataset.confidence = poi.confidence || 'medium';
    }
    const airportSuffix = loc.id === 'airport' && options.airport?.iata ? ` (${options.airport.iata})` : '';
    const title = loc.id === 'airport' && options.airport?.name
      ? `${loc.name}: ${options.airport.name}${airportSuffix}`
      : poi?.name
        ? `${loc.name}: ${poi.name}`
      : `${loc.name}: ACME field stop`;
    button.title = title;
    button.setAttribute('aria-label', title);
    button.innerHTML = `
      <span class="carmen-city-map-pin-icon">${esc(loc.emoji)}</span>
      <span class="carmen-city-map-pin-label">${esc(loc.name)}</span>
    `;
    button.addEventListener('pointerdown', (e) => e.stopPropagation());
    button.addEventListener('click', () => onPick(loc.id));
    pinsLayer.appendChild(button);
    pinButtons.set(loc.id, button);
  }

  mapWrap.addEventListener('wheel', onWheel, { passive: false });
  mapWrap.addEventListener('pointerdown', onPointerDown);
  mapWrap.addEventListener('pointermove', onPointerMove);
  mapWrap.addEventListener('pointerup', onPointerEnd);
  mapWrap.addEventListener('pointercancel', onPointerEnd);
  mapWrap.querySelectorAll('[data-map-control]').forEach((button) => {
    button.addEventListener('pointerdown', (e) => e.stopPropagation());
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = button.dataset.mapControl;
      if (action === 'zoom-in') zoomBy(1.45);
      else if (action === 'zoom-out') zoomBy(1 / 1.45);
      else resetView();
    });
  });

  resizeObserver = new ResizeObserver(requestRedraw);
  resizeObserver.observe(mapWrap);
  resizeObserver.observe(container);
  requestAnimationFrame(draw);

  return {
    setLocationState(locationId, state) {
      const button = pinButtons.get(locationId);
      if (!button) return;
      button.classList.toggle('investigated', state === 'investigated');
      button.classList.toggle('exhausted', state === 'exhausted');
      button.disabled = state === 'investigated' || state === 'exhausted';
    },
    exhaustUnvisited(visitedIds) {
      for (const [locationId, button] of pinButtons) {
        if (visitedIds.has(locationId)) continue;
        button.classList.add('exhausted');
        button.disabled = true;
      }
    },
    destroy() {
      destroyed = true;
      resizeObserver?.disconnect();
      mapWrap.removeEventListener('wheel', onWheel);
      mapWrap.removeEventListener('pointerdown', onPointerDown);
      mapWrap.removeEventListener('pointermove', onPointerMove);
      mapWrap.removeEventListener('pointerup', onPointerEnd);
      mapWrap.removeEventListener('pointercancel', onPointerEnd);
      container.innerHTML = '';
    },
  };
}
