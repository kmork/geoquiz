/**
 * Outlines Renderer - Shared SVG Rendering Component
 * Renders country outlines with optional neighbors
 * Used by both standalone Outlines game and Daily Challenge
 */

import { norm } from "../utils.js";
import { MAP_W, MAP_H, proj, pathFromFeature, bboxOfFeatureLonLat, padBBox, getCSSVar } from "../map-utils.js";

/**
 * Outlines Renderer Class
 * Manages SVG rendering of country outlines
 */
export class OutlinesRenderer {
  constructor(svgElement, worldData, options = {}) {
    this.svg = svgElement;
    this.worldData = worldData;
    this.countryAliases = options.aliases || {};
    this.baseViewBox = { x: 0, y: 0, w: MAP_W, h: MAP_H };
  }
  
  /**
   * Draw target country and optionally its neighbors
   * @param {string} targetCountry - Country name
   * @param {string[]} neighborCountries - Array of neighbor country names
   */
  drawCountries(targetCountry, neighborCountries = []) {
    this.svg.innerHTML = "";
    
    if (!this.worldData) return;
    
    // Find target country features
    const mapName = this.countryAliases[targetCountry] || targetCountry;
    const targetFeatures = this.worldData.filter(f => 
      norm(f.properties.ADMIN || f.properties.NAME || '') === norm(mapName)
    );
    
    if (targetFeatures.length === 0) {
      this.svg.setAttribute("viewBox", `0 0 ${MAP_W} ${MAP_H}`);
      return;
    }
    
    // Calculate combined bounding box for target + neighbors
    let bb = bboxOfFeatureLonLat(targetFeatures[0]);
    for (let i = 1; i < targetFeatures.length; i++) {
      const b = bboxOfFeatureLonLat(targetFeatures[i]);
      bb = {
        minLon: Math.min(bb.minLon, b.minLon),
        minLat: Math.min(bb.minLat, b.minLat),
        maxLon: Math.max(bb.maxLon, b.maxLon),
        maxLat: Math.max(bb.maxLat, b.maxLat),
      };
    }
    
    // Include neighbor countries in bounding box
    const neighborFeatures = [];
    for (const neighborCountry of neighborCountries) {
      const neighborMapName = this.countryAliases[neighborCountry] || neighborCountry;
      const features = this.worldData.filter(f => 
        norm(f.properties.ADMIN || f.properties.NAME || '') === norm(neighborMapName)
      );
      neighborFeatures.push(...features);
      
      for (const f of features) {
        const b = bboxOfFeatureLonLat(f);
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
    this.svg.setAttribute("viewBox", `${x1} ${y1} ${x2 - x1} ${y2 - y1}`);
    this.baseViewBox = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
    
    // Draw neighbor countries (lighter highlight)
    for (const f of neighborFeatures) {
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", pathFromFeature(f));
      p.setAttribute("stroke", getCSSVar('--map-country-stroke-neighbor') || "rgba(232,236,255,.5)");
      p.setAttribute("stroke-width", "0.6");
      p.setAttribute("fill", getCSSVar('--map-country-fill') || "rgba(165,180,252,.08)");
      p.setAttribute("vector-effect", "non-scaling-stroke");
      this.svg.appendChild(p);
    }
    
    // Draw target country (main highlight)
    for (const f of targetFeatures) {
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", pathFromFeature(f));
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
