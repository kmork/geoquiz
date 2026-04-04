/**
 * Route Renderer - Shared SVG route map visualization
 * Renders countries along a route with highlighting and auto-zoom
 */

import { padBBox } from '../map-utils.js';
import { findGeoFeatures } from '../aliases.js';

export class RouteRenderer {
  constructor(svgElement, worldData, options = {}) {
    this.svg = svgElement;
    this.worldFeatures = worldData.features || worldData;
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
  // For antimeridian-crossing polygons, excludes points on the minority side.
  bboxOfFeature(feature) {
    if (!feature.geometry) return null;

    const polys = feature.geometry.type === "Polygon"
      ? [feature.geometry.coordinates]
      : feature.geometry.coordinates;

    const mainPoly = polys.reduce((best, poly) =>
      poly[0].length > best[0].length ? poly : best
    );

    // Collect all normalized points from the outer ring
    const points = [];
    for (const ring of mainPoly) {
      for (const [lon, lat] of ring) {
        points.push([this.normalizeLon(lon), lat]);
      }
    }

    // Detect antimeridian crossing: if points span > 180° in longitude,
    // exclude the minority side to avoid a globe-spanning bbox
    const posCount = points.filter(([lon]) => lon > 0).length;
    const negCount = points.length - posCount;
    let filtered = points;
    if (posCount > 0 && negCount > 0) {
      const lonSpan = Math.max(...points.map(p => p[0])) - Math.min(...points.map(p => p[0]));
      if (lonSpan > 180) {
        filtered = posCount > negCount
          ? points.filter(([lon]) => lon > -90)
          : points.filter(([lon]) => lon < 90);
        if (filtered.length === 0) filtered = points;
      }
    }

    let minLon = Infinity, minLat = Infinity;
    let maxLon = -Infinity, maxLat = -Infinity;
    for (const [lon, lat] of filtered) {
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }

    // Cap very wide countries (e.g. Russia 27°–180°) to a reasonable viewport span
    const MAX_LON_SPAN = 80;
    if (maxLon - minLon > MAX_LON_SPAN) {
      maxLon = minLon + MAX_LON_SPAN;
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
  /**
   * @param {Array} countryList - Array of {country, color} objects
   * @param {Array} [extraCountries] - Additional country names to include in the viewBox (e.g. neighbors)
   */
  drawRoute(countryList, extraCountries = []) {
    this.svg.innerHTML = "";

    if (!this.worldFeatures) return;

    // Collect all highlighted country features and calculate bounding box
    const highlightedFeatures = [];
    const featureBboxes = [];
    for (const item of countryList) {
      const features = findGeoFeatures(this.worldFeatures, item.country);

      for (const feature of features) {
        highlightedFeatures.push({ feature, color: item.color });
        const bb = this.bboxOfFeature(feature);
        if (bb) featureBboxes.push(bb);
      }
    }

    // Include extra countries in the bounding box (not drawn as route)
    for (const name of extraCountries) {
      const features = findGeoFeatures(this.worldFeatures, name);
      for (const feature of features) {
        const bb = this.bboxOfFeature(feature);
        if (bb) featureBboxes.push(bb);
      }
    }

    let bbox = this.computeViewBbox(featureBboxes);

    // Set viewBox to fit highlighted countries + extras
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
   * Draw clickable neighbor countries on the map.
   * @param {Array} neighbors — country name strings
   * @param {Function} onClick — called with country name when clicked
   * @returns {Object} API with highlight(country, correct) and disableAll()
   */
  drawNeighborChoices(neighbors, onClick) {
    const ns = "http://www.w3.org/2000/svg";
    const group = document.createElementNS(ns, "g");
    group.setAttribute("class", "carmen-neighbor-choices");
    this.svg.appendChild(group);

    const btnMap = {}; // countryName → {paths, label, disabled}

    for (const name of neighbors) {
      const features = findGeoFeatures(this.worldFeatures, name);
      if (features.length === 0) continue;

      const entry = { paths: [], label: null, disabled: false };

      // Draw country shape(s) as clickable
      for (const feature of features) {
        const path = document.createElementNS(ns, "path");
        path.setAttribute("d", this.pathFromFeature(feature));
        path.setAttribute("fill", "rgba(148, 163, 184, 0.2)");
        path.setAttribute("stroke", "rgba(148, 163, 184, 0.6)");
        path.setAttribute("stroke-width", "1.2");
        path.setAttribute("vector-effect", "non-scaling-stroke");
        path.setAttribute("cursor", "pointer");
        path.setAttribute("class", "carmen-map-choice");
        path.setAttribute("data-country", name);
        group.appendChild(path);
        entry.paths.push(path);

        // Stop propagation so zoom-pan doesn't steal the pointer
        path.addEventListener('pointerdown', (e) => {
          if (!entry.disabled) e.stopPropagation();
        });
        path.addEventListener('click', () => {
          if (!entry.disabled) onClick(name);
        });
        path.addEventListener('mouseenter', () => {
          if (entry.disabled) return;
          for (const p of entry.paths) {
            p.setAttribute("fill", "rgba(148, 163, 184, 0.4)");
            p.setAttribute("stroke", "rgba(148, 163, 184, 0.9)");
          }
        });
        path.addEventListener('mouseleave', () => {
          if (entry.disabled) return;
          for (const p of entry.paths) {
            p.setAttribute("fill", "rgba(148, 163, 184, 0.2)");
            p.setAttribute("stroke", "rgba(148, 163, 184, 0.6)");
          }
        });
      }

      // Add country name label at centroid — sized to fit within country
      const centroid = this.getCentroid(name);
      if (centroid) {
        const bb = this.bboxOfFeature(features[0]);
        if (bb) {
          const [x1] = this.proj([bb.minLon, 0]);
          const [x2] = this.proj([bb.maxLon, 0]);
          const countryW = Math.abs(x2 - x1);
          // Estimate: ~0.6 SVG units per character at font-size 1
          const maxByWidth = countryW / (name.length * 0.6);
          const [, y1] = this.proj([0, bb.maxLat]);
          const [, y2] = this.proj([0, bb.minLat]);
          const countryH = Math.abs(y2 - y1);
          const fontSize = Math.min(maxByWidth, countryH * 0.35, 4);

          // Micro-country: too small to see/click — draw a marker circle
          if (fontSize < 1) {
            const r = 3;
            const circle = document.createElementNS(ns, "circle");
            circle.setAttribute("cx", centroid[0]);
            circle.setAttribute("cy", centroid[1]);
            circle.setAttribute("r", r);
            circle.setAttribute("fill", "rgba(148, 163, 184, 0.5)");
            circle.setAttribute("stroke", "rgba(148, 163, 184, 0.9)");
            circle.setAttribute("stroke-width", "1");
            circle.setAttribute("vector-effect", "non-scaling-stroke");
            circle.setAttribute("cursor", "pointer");
            circle.setAttribute("class", "carmen-map-choice");
            circle.setAttribute("data-country", name);
            group.appendChild(circle);
            entry.paths.push(circle);

            circle.addEventListener('pointerdown', (e) => {
              if (!entry.disabled) e.stopPropagation();
            });
            circle.addEventListener('click', () => {
              if (!entry.disabled) onClick(name);
            });
            circle.addEventListener('mouseenter', () => {
              if (entry.disabled) return;
              circle.setAttribute("fill", "rgba(148, 163, 184, 0.7)");
            });
            circle.addEventListener('mouseleave', () => {
              if (entry.disabled) return;
              circle.setAttribute("fill", "rgba(148, 163, 184, 0.5)");
            });

            // Label next to the marker
            const text = document.createElementNS(ns, "text");
            text.setAttribute("x", centroid[0] + r + 1);
            text.setAttribute("y", centroid[1]);
            text.setAttribute("text-anchor", "start");
            text.setAttribute("dominant-baseline", "central");
            text.setAttribute("font-size", 2.5);
            text.setAttribute("class", "carmen-map-label");
            text.setAttribute("pointer-events", "none");
            text.textContent = name;
            group.appendChild(text);
            entry.label = text;
          } else {
            const text = document.createElementNS(ns, "text");
            text.setAttribute("x", centroid[0]);
            text.setAttribute("y", centroid[1]);
            text.setAttribute("text-anchor", "middle");
            text.setAttribute("dominant-baseline", "central");
            text.setAttribute("font-size", fontSize);
            text.setAttribute("class", "carmen-map-label");
            text.setAttribute("pointer-events", "none");
            text.textContent = name;
            group.appendChild(text);
            entry.label = text;
          }
        }
      }

      btnMap[name] = entry;
    }

    return {
      highlight(country, correct) {
        const entry = btnMap[country];
        if (!entry) return;
        const fill = correct ? "rgba(34, 197, 94, 0.35)" : "rgba(239, 68, 68, 0.35)";
        const stroke = correct ? "rgba(34, 197, 94, 0.9)" : "rgba(239, 68, 68, 0.9)";
        for (const p of entry.paths) {
          p.setAttribute("fill", fill);
          p.setAttribute("stroke", stroke);
          p.setAttribute("cursor", "default");
        }
        entry.disabled = true;
      },
      disableAll() {
        for (const entry of Object.values(btnMap)) {
          entry.disabled = true;
          for (const p of entry.paths) {
            p.setAttribute("cursor", "default");
          }
        }
      },
      remove() {
        group.remove();
      }
    };
  }

  /**
   * Get the centroid of a country in SVG coordinates.
   * Uses the average of the largest polygon's points, excluding outliers
   * beyond the antimeridian (e.g. Russia's far-east Chukotka wrapping to
   * negative longitudes).
   */
  getCentroid(countryName) {
    const features = findGeoFeatures(this.worldFeatures, countryName);
    if (features.length === 0) return null;

    const geom = features[0].geometry;
    if (!geom) return null;

    const polys = geom.type === "Polygon"
      ? [geom.coordinates]
      : geom.coordinates;

    // Use the largest polygon (mainland)
    const mainPoly = polys.reduce((best, poly) =>
      poly[0].length > best[0].length ? poly : best
    );

    // Collect all normalized lon/lat from outer ring
    const ring = mainPoly[0];
    const points = ring.map(([lon, lat]) => [this.normalizeLon(lon), lat]);

    // Count how many points are positive vs negative longitude
    const posCount = points.filter(([lon]) => lon > 0).length;
    const negCount = points.length - posCount;

    // If most points are positive, exclude far-negative ones (antimeridian wrap)
    // and vice versa — threshold of 90° difference from the majority side
    let filtered = points;
    if (posCount > negCount * 2) {
      filtered = points.filter(([lon]) => lon > -90);
    } else if (negCount > posCount * 2) {
      filtered = points.filter(([lon]) => lon < 90);
    }
    if (filtered.length === 0) filtered = points;

    let sumLon = 0, sumLat = 0;
    for (const [lon, lat] of filtered) {
      sumLon += lon;
      sumLat += lat;
    }
    return this.proj([sumLon / filtered.length, sumLat / filtered.length]);
  }

  /**
   * Animate a travel icon along a path between two countries.
   * Returns a promise that resolves when the animation completes.
   * @param {string} fromCountry
   * @param {string} toCountry
   * @param {number} duration — ms (default 1200)
   */
  animateTravel(fromCountry, toCountry, duration = 1200) {
    return new Promise(resolve => {
      const from = this.getCentroid(fromCountry);
      const to = this.getCentroid(toCountry);
      if (!from || !to) { resolve(); return; }

      const ns = "http://www.w3.org/2000/svg";

      // Dashed travel path
      const line = document.createElementNS(ns, "line");
      line.setAttribute("x1", from[0]);
      line.setAttribute("y1", from[1]);
      line.setAttribute("x2", to[0]);
      line.setAttribute("y2", to[1]);
      line.setAttribute("stroke", "rgba(251, 191, 36, 0.7)");
      line.setAttribute("stroke-width", "2");
      line.setAttribute("stroke-dasharray", "6,4");
      line.setAttribute("vector-effect", "non-scaling-stroke");
      line.style.opacity = "0";
      this.svg.appendChild(line);

      // Travel icon — scale to viewBox, rotate to match flight direction
      const vb = this.svg.viewBox.baseVal;
      const planeSize = Math.max(vb.width * 0.04, 3);
      const angle = Math.atan2(to[1] - from[1], to[0] - from[0]) * (180 / Math.PI);
      const icon = document.createElementNS(ns, "text");
      icon.setAttribute("font-size", planeSize);
      icon.setAttribute("text-anchor", "middle");
      icon.setAttribute("dominant-baseline", "central");
      icon.setAttribute("transform", `translate(${from[0]},${from[1]}) rotate(${angle})`);
      icon.textContent = "✈";
      this.svg.appendChild(icon);

      // Animate
      const startTime = performance.now();
      let cancelled = false;

      // Allow click to skip
      const skipHandler = () => { cancelled = true; };
      this.svg.addEventListener('click', skipHandler, { once: true });

      const animate = (now) => {
        const elapsed = now - startTime;
        const t = Math.min(elapsed / duration, 1);
        const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // easeInOutQuad

        if (cancelled || t >= 1) {
          line.remove();
          icon.remove();
          this.svg.removeEventListener('click', skipHandler);
          resolve();
          return;
        }

        // Show dashed line with growing opacity
        line.style.opacity = String(Math.min(t * 3, 0.7));

        // Move icon along path, keeping rotation
        const x = from[0] + (to[0] - from[0]) * eased;
        const y = from[1] + (to[1] - from[1]) * eased;
        icon.setAttribute("transform", `translate(${x},${y}) rotate(${angle})`);

        requestAnimationFrame(animate);
      };

      requestAnimationFrame(animate);
    });
  }

  /**
   * Clear the map
   */
  clear() {
    this.svg.innerHTML = "";
    this.svg.setAttribute("viewBox", `0 0 ${this.MAP_W} ${this.MAP_H}`);
  }
}
