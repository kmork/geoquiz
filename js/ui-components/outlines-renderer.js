/**
 * Outlines Renderer - Shared SVG Rendering Component
 * Renders country outlines with optional neighbors
 * Used by both standalone Outlines game and Daily Challenge
 */

import { MAP_W, MAP_H, proj, pathFromFeature, pathFromMainland, bboxOfFeatureLonLat, bboxOfMainlandLonLat, padBBox, getCSSVar } from "../map-utils.js";
import { findGeoFeatures } from "../aliases.js";

/**
 * Outlines Renderer Class
 * Manages SVG rendering of country outlines
 */
export class OutlinesRenderer {
  constructor(svgElement, worldData, options = {}) {
    this.svg = svgElement;
    this.worldData = worldData;
    this.baseViewBox = { x: 0, y: 0, w: MAP_W, h: MAP_H };
  }
  
  /**
   * Draw target country and optionally its neighbors
   * @param {string} targetCountry - Country name
   * @param {string[]} neighborCountries - Array of neighbor country names
   */
  drawCountries(targetCountry, neighborCountries = [], { useMainland = true } = {}) {
    this.svg.innerHTML = "";

    if (!this.worldData) return;

    // Find target country features
    const targetFeatures = findGeoFeatures(this.worldData, targetCountry);

    if (targetFeatures.length === 0) {
      this.svg.setAttribute("viewBox", `0 0 ${MAP_W} ${MAP_H}`);
      return;
    }

    // Choose bbox function based on mainland filtering
    const bboxFn = useMainland ? bboxOfMainlandLonLat : bboxOfFeatureLonLat;
    const pathFn = useMainland ? pathFromMainland : pathFromFeature;

    // Calculate combined bounding box for target + neighbors
    let bb = bboxFn(targetFeatures[0]);
    for (let i = 1; i < targetFeatures.length; i++) {
      const b = bboxFn(targetFeatures[i]);
      bb = {
        minLon: Math.min(bb.minLon, b.minLon),
        minLat: Math.min(bb.minLat, b.minLat),
        maxLon: Math.max(bb.maxLon, b.maxLon),
        maxLat: Math.max(bb.maxLat, b.maxLat),
      };
    }

    // Include neighbor countries in bounding box (always use full feature for neighbors)
    const neighborFeatures = [];
    for (const neighborCountry of neighborCountries) {
      const features = findGeoFeatures(this.worldData, neighborCountry);
      neighborFeatures.push(...features);

      for (const f of features) {
        const b = bboxOfMainlandLonLat(f);
        bb = {
          minLon: Math.min(bb.minLon, b.minLon),
          minLat: Math.min(bb.minLat, b.minLat),
          maxLon: Math.max(bb.maxLon, b.maxLon),
          maxLat: Math.max(bb.maxLat, b.maxLat),
        };
      }
    }

    bb = padBBox(bb, 0.18);

    // Set viewBox
    const [x1, y1] = proj([bb.minLon, bb.maxLat]);
    const [x2, y2] = proj([bb.maxLon, bb.minLat]);
    let w = x2 - x1;
    let h = y2 - y1;
    let vx = x1;
    let vy = y1;

    // Enforce minimum viewBox for micro-countries (Vatican City, Monaco, etc.)
    const MIN_VIEW_SIZE = 5;
    if (w < MIN_VIEW_SIZE || h < MIN_VIEW_SIZE) {
      const cx = vx + w / 2;
      const cy = vy + h / 2;
      w = Math.max(w, MIN_VIEW_SIZE);
      h = Math.max(h, MIN_VIEW_SIZE);
      vx = cx - w / 2;
      vy = cy - h / 2;
    }

    this.svg.setAttribute("viewBox", `${vx} ${vy} ${w} ${h}`);
    this.baseViewBox = { x: vx, y: vy, w, h };

    // Draw neighbor countries (lighter highlight, use mainland paths)
    for (const f of neighborFeatures) {
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", pathFromMainland(f));
      p.setAttribute("stroke", getCSSVar('--map-country-stroke-neighbor') || "rgba(232,236,255,.5)");
      p.setAttribute("stroke-width", "0.6");
      p.setAttribute("fill", getCSSVar('--map-country-fill') || "rgba(165,180,252,.08)");
      p.setAttribute("vector-effect", "non-scaling-stroke");
      this.svg.appendChild(p);
    }

    // Draw target country (main highlight, use chosen path function)
    for (const f of targetFeatures) {
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", pathFn(f));
      p.setAttribute("stroke", getCSSVar('--map-country-stroke-highlight') || "rgba(232,236,255,.95)");
      p.setAttribute("stroke-width", "0.8");
      p.setAttribute("fill", getCSSVar('--map-country-fill-highlight') || "rgba(165,180,252,.25)");
      p.setAttribute("vector-effect", "non-scaling-stroke");
      this.svg.appendChild(p);
    }
  }
  
  /**
   * Get current viewBox for pan/zoom features
   */
  getViewBox() {
    return this.baseViewBox;
  }
  
  /**
   * Set viewBox for pan/zoom features
   */
  setViewBox(x, y, w, h) {
    this.baseViewBox = { x, y, w, h };
    this.svg.setAttribute("viewBox", `${x} ${y} ${w} ${h}`);
  }
  
  /**
   * Clear the SVG
   */
  clear() {
    this.svg.innerHTML = "";
  }
}

/**
 * Simplified version for Daily Challenge (fixed size)
 * @param {SVGElement} svg - SVG element
 * @param {Object} worldData - GeoJSON FeatureCollection
 * @param {string} targetCountry - Country name
 * @param {string[]} neighbors - Neighbor country names
 */
export function drawCountriesSimple(svg, worldData, targetCountry, neighbors = []) {
  const renderer = new OutlinesRenderer(svg, worldData.features, {});
  renderer.drawCountries(targetCountry, neighbors);
}
