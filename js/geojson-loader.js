/**
 * GeoJSON Loader with Gzip Support and IndexedDB Caching
 *
 * Loads and decompresses gzipped GeoJSON files using pako.js.
 * Caches decompressed results in IndexedDB so subsequent page loads
 * skip both the network fetch and CPU-heavy pako decompression.
 */

const DB_NAME = 'geoquiz-cache';
const STORE_NAME = 'geojson';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db, key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Load and decompress a gzipped GeoJSON file
 * @param {string} url - URL to .geojson.gz file
 * @returns {Promise<Object>} - Parsed GeoJSON object
 */
async function loadGzippedGeoJSON(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Get compressed data as ArrayBuffer
    const buffer = await response.arrayBuffer();

    // Decompress using pako
    const decompressed = pako.inflate(new Uint8Array(buffer), { to: 'string' });

    // Parse JSON
    return JSON.parse(decompressed);
  } catch (error) {
    console.error('Failed to load gzipped GeoJSON:', url, error);
    throw error;
  }
}

/**
 * Fetch GeoJSON without caching
 */
async function fetchGeoJSON(url) {
  if (url.endsWith('.gz')) {
    return loadGzippedGeoJSON(url);
  }
  const response = await fetch(url);
  return response.json();
}

/**
 * Load regular or gzipped GeoJSON (auto-detect based on extension)
 * Results are cached in IndexedDB to avoid re-downloading and
 * re-decompressing on subsequent page loads.
 * @param {string} url - URL to .geojson or .geojson.gz file
 * @returns {Promise<Object>} - Parsed GeoJSON object
 */
export async function loadGeoJSON(url) {
  try {
    const db = await openDB();
    const cached = await idbGet(db, url);
    if (cached) return cached;

    const data = await fetchGeoJSON(url);

    // Store in background (don't block return)
    idbPut(db, url, data).catch(() => {});
    return data;
  } catch {
    // IndexedDB unavailable (private browsing, etc.) — fall back to direct load
    return fetchGeoJSON(url);
  }
}
