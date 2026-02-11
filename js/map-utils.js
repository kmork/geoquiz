/**
 * Shared Map Utilities
 * Common projection, path generation, and bbox helpers used across map renderers.
 */

export const MAP_W = 600;
export const MAP_H = 320;

/**
 * Simple equirectangular projection
 * @param {[number, number]} lonLat - [longitude, latitude]
 * @returns {[number, number]} [x, y] in map coordinates
 */
export const proj = ([lon, lat]) => [
  ((lon + 180) / 360) * MAP_W,
  ((90 - lat) / 180) * MAP_H
];

/**
 * Convert GeoJSON feature to SVG path data
 * @param {Object} f - GeoJSON feature
 * @returns {string} SVG path d attribute
 */
export function pathFromFeature(f) {
  if (!f.geometry) return "";
  const polys = f.geometry.type === "Polygon"
    ? [f.geometry.coordinates]
    : f.geometry.coordinates;

  let d = "";
  for (const poly of polys) {
    for (const ring of poly) {
      ring.forEach(([lon, lat], i) => {
        const [x, y] = proj([lon, lat]);
        d += (i ? "L" : "M") + x + " " + y + " ";
      });
      d += "Z ";
    }
  }
  return d;
}

/**
 * Calculate bounding box of a GeoJSON feature in lon/lat
 * @param {Object} f - GeoJSON feature
 * @returns {{minLon: number, minLat: number, maxLon: number, maxLat: number}}
 */
export function bboxOfFeatureLonLat(f) {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;

  const rings = f.geometry.type === "Polygon"
    ? [f.geometry.coordinates]
    : f.geometry.coordinates;

  for (const poly of rings) {
    for (const ring of poly) {
      for (const [lon, lat] of ring) {
        if (lon < minLon) minLon = lon;
        if (lat < minLat) minLat = lat;
        if (lon > maxLon) maxLon = lon;
        if (lat > maxLat) maxLat = lat;
      }
    }
  }
  return { minLon, minLat, maxLon, maxLat };
}

/**
 * Pad a bounding box by a ratio
 * @param {{minLon: number, minLat: number, maxLon: number, maxLat: number}} bb
 * @param {number} padRatio - Padding ratio (default 0.18)
 * @returns {{minLon: number, minLat: number, maxLon: number, maxLat: number}}
 */
export function padBBox(bb, padRatio = 0.18) {
  const dLon = bb.maxLon - bb.minLon;
  const dLat = bb.maxLat - bb.minLat;
  return {
    minLon: bb.minLon - dLon * padRatio,
    maxLon: bb.maxLon + dLon * padRatio,
    minLat: bb.minLat - dLat * padRatio,
    maxLat: bb.maxLat + dLat * padRatio,
  };
}

/**
 * Read a CSS custom property value
 * @param {string} name - CSS variable name (e.g., '--map-bg')
 * @returns {string} The computed value
 */
export function getCSSVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
