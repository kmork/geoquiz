/**
 * Route Renderer - Shared SVG route map visualization
 * Renders countries along a route with highlighting and auto-zoom
 */

import { norm } from '../utils.js';
import { padBBox } from '../map-utils.js';

export class RouteRenderer {
  constructor(svgElement, worldData, options = {}) {
    this.svg = svgElement;
    this.worldFeatures = worldData.features || worldData;
    this.aliases = options.aliases || {};
    
    this.MAP_W = 600;
    this.MAP_H = 320;
    
    // Color scheme
    this.colors = {
      start: {
        fill: 'rgba(34, 197, 94, 0.3)',
        stroke: 'rgba(34, 197, 94, 0.8)',
        strokeWidth: '1.2'
      },
      end: {
        fill: 'rgba(249, 115, 22, 0.3)',
        stroke: 'rgba(249, 115, 22, 0.8)',
        strokeWidth: '1.2'
      },
      path: {
        fill: 'rgba(59, 130, 246, 0.3)',
        stroke: 'rgba(59, 130, 246, 0.8)',
        strokeWidth: '1.2'
      },
      hint: {
        fill: 'rgba(251, 191, 36, 0.2)',
        stroke: 'rgba(251, 191, 36, 0.6)',
        strokeWidth: '1.2',
        strokeDasharray: '5,5'
      },
      optimal: {
        fill: 'rgba(250, 204, 21, 0.25)',
        stroke: 'rgba(250, 204, 21, 0.9)',
        strokeWidth: '2'
      }
    };
  }
  
  // Projection: lon/lat to map coordinates
  proj([lon, lat]) {
    const normalizedLon = this.normalizeLon(lon);
    return [
      ((normalizedLon + 180) / 360) * this.MAP_W,
      ((90 - lat) / 180) * this.MAP_H
    ];
  }
  
  // Normalize longitude to -180 to +180
  normalizeLon(lon) {
    while (lon > 180) lon -= 360;
    while (lon < -180) lon += 360;
    return lon;
  }
  
  // Convert GeoJSON feature to SVG path
  pathFromFeature(feature) {
    if (!feature.geometry) return "";
    
    const polys = feature.geometry.type === "Polygon" 
      ? [feature.geometry.coordinates] 
      : feature.geometry.coordinates;
    
    let d = "";
    
    for (const poly of polys) {
      for (const ring of poly) {
        let prevLon = null;
        let currentPath = [];
        
        for (let i = 0; i < ring.length; i++) {
          const [lon, lat] = ring[i];
          const normalizedLon = this.normalizeLon(lon);
          
          // Detect antimeridian crossing
          if (prevLon !== null && Math.abs(normalizedLon - prevLon) > 180) {
            // Finish current path segment
            if (currentPath.length > 0) {
              currentPath.forEach(([x, y], j) => {
                d += (j ? "L" : "M") + x + " " + y + " ";
              });
              currentPath = [];
            }
          }
          
          const [x, y] = this.proj([lon, lat]);
          currentPath.push([x, y]);
          prevLon = normalizedLon;
        }
        
        // Finish remaining path
        if (currentPath.length > 0) {
          currentPath.forEach(([x, y], i) => {
            d += (i ? "L" : "M") + x + " " + y + " ";
          });
          d += "Z ";
        }
      }
    }
    
    return d;
  }
  
  // Calculate bounding box of feature in lon/lat.
  // Uses only the largest polygon (by outer ring point count) to avoid small
  // outlier territories (Aleutian Islands, remote islands, etc.) pulling the
  // viewport far off-center for countries like the USA or Russia.
  bboxOfFeature(feature) {
    if (!feature.geometry) return null;

    const polys = feature.geometry.type === "Polygon"
      ? [feature.geometry.coordinates]
      : feature.geometry.coordinates;

    const mainPoly = polys.reduce((best, poly) =>
      poly[0].length > best[0].length ? poly : best
    );

    let minLon = Infinity, minLat = Infinity;
    let maxLon = -Infinity, maxLat = -Infinity;

    for (const ring of mainPoly) {
      for (const [lon, lat] of ring) {
        const normalizedLon = this.normalizeLon(lon);
        minLon = Math.min(minLon, normalizedLon);
        maxLon = Math.max(maxLon, normalizedLon);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      }
    }

    return { minLon, minLat, maxLon, maxLat };
  }

  computeViewBbox(bboxes) {
    if (bboxes.length === 0) return null;

    const BIG_LON_SPAN  = 80;  // lon-span threshold for "large" country (Russia ~153°, Canada ~89°)
    const OVERREACH_LON = 30;  // max degrees past anchor bbox allowed in longitude
    const OVERREACH_LAT = 20;  // max degrees past anchor bbox allowed in latitude

    const merge = (a, b) => ({
      minLon: Math.min(a.minLon, b.minLon), maxLon: Math.max(a.maxLon, b.maxLon),
      minLat: Math.min(a.minLat, b.minLat), maxLat: Math.max(a.maxLat, b.maxLat),
    });
    const merged = bboxes.reduce(merge);

    // Total span is fine — return as-is
    if (merged.maxLon - merged.minLon <= BIG_LON_SPAN) return merged;

    // Classify: small/normal countries are anchors; oversized ones need clipping
    let anchor = null;
    const large = [];
    for (const b of bboxes) {
      if (b.maxLon - b.minLon > BIG_LON_SPAN) {
        large.push(b);
      } else {
        anchor = anchor ? merge(anchor, b) : { ...b };
      }
    }

    // No anchor (e.g. only Russia shown alone) — fall back to full merged bbox
    if (!anchor) return merged;

    // Extend anchor bbox by at most OVERREACH toward each large country
    const result = { ...anchor };
    for (const lb of large) {
      result.minLon = Math.min(result.minLon, Math.max(anchor.minLon - OVERREACH_LON, lb.minLon));
      result.maxLon = Math.max(result.maxLon, Math.min(anchor.maxLon + OVERREACH_LON, lb.maxLon));
      result.minLat = Math.min(result.minLat, Math.max(anchor.minLat - OVERREACH_LAT, lb.minLat));
      result.maxLat = Math.max(result.maxLat, Math.min(anchor.maxLat + OVERREACH_LAT, lb.maxLat));
    }
    return result;
  }


  /**
   * Draw route visualization
   * @param {Array} countryList - Array of {country, color} objects
   *   color can be: 'start', 'end', 'path', 'hint', 'optimal'
   */
  drawRoute(countryList) {
    this.svg.innerHTML = "";
    
    if (!this.worldFeatures) return;
    
    // Collect all highlighted country features and calculate bounding box
    const highlightedFeatures = [];
    const featureBboxes = [];
    for (const item of countryList) {
      const n = norm(item.country);
      const features = this.worldFeatures.filter(f => {
        const admin = f.properties.ADMIN || "";
        if (norm(admin) === n || norm(f.properties.NAME || "") === n) return true;
        // aliases maps GeoJSON name → DATA name (e.g. "United States of America" → "United States")
        return norm(this.aliases[admin] || "") === n;
      });

      for (const feature of features) {
        highlightedFeatures.push({ feature, color: item.color });
        const bb = this.bboxOfFeature(feature);
        if (bb) featureBboxes.push(bb);
      }
    }
    let bbox = this.computeViewBbox(featureBboxes);
    
    // Set viewBox to fit highlighted countries
    if (bbox) {
      bbox = padBBox(bbox, 0.18);
      const [x1, y1] = this.proj([bbox.minLon, bbox.maxLat]);
      const [x2, y2] = this.proj([bbox.maxLon, bbox.minLat]);
      
      const width = Math.abs(x2 - x1);
      const height = Math.abs(y2 - y1);
      const x = Math.min(x1, x2);
      const y = Math.min(y1, y2);
      
      this.svg.setAttribute("viewBox", `${x} ${y} ${width} ${height}`);
    } else {
      this.svg.setAttribute("viewBox", `0 0 ${this.MAP_W} ${this.MAP_H}`);
    }
    
    // Draw highlighted countries
    for (const item of highlightedFeatures) {
      const colors = this.colors[item.color] || this.colors.path;
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      
      path.setAttribute("d", this.pathFromFeature(item.feature));
      path.setAttribute("stroke", colors.stroke);
      path.setAttribute("stroke-width", colors.strokeWidth);
      path.setAttribute("fill", colors.fill);
      path.setAttribute("vector-effect", "non-scaling-stroke");
      
      if (colors.strokeDasharray) {
        path.setAttribute("stroke-dasharray", colors.strokeDasharray);
      }
      
      this.svg.appendChild(path);
    }
  }
  
  /**
   * Clear the map
   */
  clear() {
    this.svg.innerHTML = "";
    this.svg.setAttribute("viewBox", `0 0 ${this.MAP_W} ${this.MAP_H}`);
  }
}
