/**
 * OSM Tile Layer — loads, caches, and draws OpenStreetMap-compatible tiles
 * on a canvas using Web Mercator projection.
 *
 * Tile providers:
 *   Dark:  CartoDB Dark Matter
 *   Light: CartoDB Positron
 */

const TILE_SIZE = 256;
const MAX_CACHE = 200;

// Tile URL templates (CartoDB)
const TILE_URLS = {
  dark:  (z, x, y) => `https://${'abc'[Math.abs(x + y) % 3]}.basemaps.cartocdn.com/dark_all/${z}/${x}/${y}@2x.png`,
  light: (z, x, y) => `https://${'abc'[Math.abs(x + y) % 3]}.basemaps.cartocdn.com/light_all/${z}/${x}/${y}@2x.png`,
};

// LRU tile cache: key "z/x/y/theme" → { img, status: 'loading'|'loaded'|'error', lastUsed }
const cache = new Map();

function evictOldest() {
  if (cache.size <= MAX_CACHE) return;
  let oldestKey = null, oldestTime = Infinity;
  for (const [key, entry] of cache) {
    if (entry.lastUsed < oldestTime) {
      oldestTime = entry.lastUsed;
      oldestKey = key;
    }
  }
  if (oldestKey) cache.delete(oldestKey);
}

function getTile(z, x, y, theme) {
  // Wrap x for world tiling
  const n = 1 << z;
  x = ((x % n) + n) % n;

  const key = `${z}/${x}/${y}/${theme}`;
  const existing = cache.get(key);
  if (existing) {
    existing.lastUsed = performance.now();
    return existing;
  }

  const entry = { img: null, status: 'loading', lastUsed: performance.now() };
  cache.set(key, entry);
  evictOldest();

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => { entry.img = img; entry.status = 'loaded'; };
  img.onerror = () => { entry.status = 'error'; };
  img.src = (TILE_URLS[theme] || TILE_URLS.dark)(z, x, y);

  return entry;
}

/**
 * Find a lower-zoom cached tile to use as placeholder while the target loads.
 */
function findFallbackTile(z, x, y, theme) {
  for (let dz = 1; dz <= 3 && z - dz >= 0; dz++) {
    const fz = z - dz;
    const fx = x >> dz;
    const fy = y >> dz;
    const n = 1 << fz;
    const key = `${fz}/${((fx % n) + n) % n}/${fy}/${theme}`;
    const entry = cache.get(key);
    if (entry && entry.status === 'loaded') {
      return { entry, dz, fx, fy, fz };
    }
  }
  return null;
}

/**
 * Draw OSM tiles onto the canvas.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} viewport - { scrollX, scrollY, zoom }
 * @param {number} mapW - Map-space width (MAP_W)
 * @param {number} mapH - Map-space height (MAP_H_MERC)
 * @param {number} canvasW - Canvas display width (CSS px)
 * @param {number} canvasH - Canvas display height (CSS px)
 * @param {string} theme - 'dark' or 'light'
 * @param {Function} requestRedraw - called when a tile finishes loading
 */
export function drawOSMTiles(ctx, viewport, mapW, mapH, canvasW, canvasH, theme, requestRedraw) {
  const { scrollX, scrollY, zoom } = viewport;

  // Map the viewport zoom to an OSM tile zoom level.
  // At zoom=1, the whole world (mapW px) fits → that's ~2.3 tiles across at z=0.
  // osmZ = log2(zoom * mapW / TILE_SIZE) but we want a reasonable mapping.
  const rawZ = Math.log2(zoom * mapW / TILE_SIZE);
  const osmZ = Math.max(2, Math.min(18, Math.round(rawZ)));
  const n = 1 << osmZ; // number of tiles at this zoom level

  // In map-space, the full world is [0, mapW] × [0, mapH].
  // One tile in map-space:
  const tileMapW = mapW / n;
  const tileMapH = mapH / n;

  // Visible map-space bounds
  const viewLeft = scrollX;
  const viewRight = scrollX + canvasW / zoom;
  const viewTop = scrollY;
  const viewBottom = scrollY + canvasH / zoom;

  // Tile range in Y (clamped to valid range)
  const tyMin = Math.max(0, Math.floor(viewTop / tileMapH));
  const tyMax = Math.min(n - 1, Math.floor(viewBottom / tileMapH));

  // Tile range in X (can extend beyond [0, n) for world wrapping)
  const txMin = Math.floor(viewLeft / tileMapW);
  const txMax = Math.floor(viewRight / tileMapW);

  let anyLoading = false;

  for (let ty = tyMin; ty <= tyMax; ty++) {
    for (let tx = txMin; tx <= txMax; tx++) {
      // Map-space position of this tile
      const tileX = tx * tileMapW;
      const tileY = ty * tileMapH;

      // Canvas position
      const cx = (tileX - scrollX) * zoom;
      const cy = (tileY - scrollY) * zoom;
      const cw = tileMapW * zoom;
      const ch = tileMapH * zoom;

      // Wrap tx for tile fetch
      const wrappedTx = ((tx % n) + n) % n;
      const tile = getTile(osmZ, wrappedTx, ty, theme);

      if (tile.status === 'loaded' && tile.img) {
        ctx.drawImage(tile.img, cx, cy, cw, ch);
      } else {
        // Try fallback from lower zoom
        const fb = findFallbackTile(osmZ, wrappedTx, ty, theme);
        if (fb) {
          const { entry: fbEntry, dz } = fb;
          const scale = 1 << dz;
          // Which sub-tile within the fallback
          const subX = wrappedTx % scale;
          const subY = ty % scale;
          const srcSize = fbEntry.img.naturalWidth / scale;
          ctx.drawImage(
            fbEntry.img,
            subX * srcSize, subY * srcSize, srcSize, srcSize,
            cx, cy, cw, ch
          );
        }
        if (tile.status === 'loading') anyLoading = true;
      }
    }
  }

  // Schedule a redraw when tiles finish loading
  if (anyLoading) {
    setTimeout(requestRedraw, 100);
  }
}
