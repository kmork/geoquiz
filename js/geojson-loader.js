/**
 * GeoJSON Loader with Gzip Support
 * 
 * Loads and decompresses gzipped GeoJSON files using pako.js
 * Falls back to regular JSON loading for non-gzipped files
 */

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
 * Load regular or gzipped GeoJSON (auto-detect based on extension)
 * @param {string} url - URL to .geojson or .geojson.gz file
 * @returns {Promise<Object>} - Parsed GeoJSON object
 */
export async function loadGeoJSON(url) {
  if (url.endsWith('.gz')) {
    return loadGzippedGeoJSON(url);
  } else {
    const response = await fetch(url);
    return response.json();
  }
}
