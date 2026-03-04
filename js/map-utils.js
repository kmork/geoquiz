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
 * Extract "mainland" polygons from a GeoJSON feature.
 * Finds the largest polygon (by coordinate count), then keeps only polygons
 * whose centroid is within 30° lon/lat of the largest polygon's centroid.
 * This drops overseas territories (e.g., French Guiana for France) while
 * keeping nearby islands (e.g., Sicily for Italy).
 * @param {Object} f - GeoJSON feature
 * @returns {Array} Array of polygon coordinate arrays (same structure as geometry.coordinates entries)
 */
export function mainlandPolygons(f) {
  if (!f.geometry) return [];
  const polys = f.geometry.type === "Polygon"
    ? [f.geometry.coordinates]
    : f.geometry.coordinates;

  if (polys.length <= 1) return polys;

  // Find largest polygon by outer ring point count
  let largest = polys[0], largestLen = polys[0][0].length;
  for (let i = 1; i < polys.length; i++) {
    if (polys[i][0].length > largestLen) {
      largest = polys[i];
      largestLen = polys[i][0].length;
    }
  }

  // Centroid of largest polygon's outer ring (simple average)
  const ring = largest[0];
  let cLon = 0, cLat = 0;
  for (const [lon, lat] of ring) { cLon += lon; cLat += lat; }
  cLon /= ring.length;
  cLat /= ring.length;

  // Keep polygons within 30° of the largest polygon's centroid
  const THRESHOLD = 30;
  return polys.filter(poly => {
    const r = poly[0];
    let pLon = 0, pLat = 0;
    for (const [lon, lat] of r) { pLon += lon; pLat += lat; }
    pLon /= r.length;
    pLat /= r.length;
    return Math.abs(pLon - cLon) <= THRESHOLD && Math.abs(pLat - cLat) <= THRESHOLD;
  });
}

/**
 * Calculate bounding box of only the mainland polygons of a feature
 * @param {Object} f - GeoJSON feature
 * @returns {{minLon: number, minLat: number, maxLon: number, maxLat: number}}
 */
export function bboxOfMainlandLonLat(f) {
  const polys = mainlandPolygons(f);
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;

  for (const poly of polys) {
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
 * Generate SVG path data for only mainland polygons of a feature
 * @param {Object} f - GeoJSON feature
 * @returns {string} SVG path d attribute
 */
export function pathFromMainland(f) {
  const polys = mainlandPolygons(f);
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
 * Read a CSS custom property value
 * @param {string} name - CSS variable name (e.g., '--map-bg')
 * @returns {string} The computed value
 */
export function getCSSVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
