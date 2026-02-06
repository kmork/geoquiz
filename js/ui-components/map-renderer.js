/**
 * Find Country Map Renderer - Shared Canvas Component
 * Renders interactive world map with pan/zoom capabilities
 * Used by both standalone Find Country game and Daily Challenge
 */

import { norm } from "../utils.js";

const MAP_W = 600;
const MAP_H = 320;

/**
 * Simple equirectangular projection
 */
const proj = ([lon, lat]) => [
  ((lon + 180) / 360) * MAP_W,
  ((90 - lat) / 180) * MAP_H
];

/**
 * Convert GeoJSON feature to path coordinates
 */
function coordsFromFeature(f) {
  if (!f.geometry) return [];
  const polys = f.geometry.type === "Polygon" ? 
    [f.geometry.coordinates] : 
    f.geometry.coordinates;
  const paths = [];
  
  for (const poly of polys) {
    for (const ring of poly) {
      const coords = ring.map(([lon, lat]) => proj([lon, lat]));
      paths.push(coords);
    }
  }
  return paths;
}

/**
 * Get CSS variable value
 */
function getCSSVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * Find Country Map Renderer Class
 * Manages canvas rendering of world map with optional interactivity
 */
export class FindCountryMapRenderer {
  constructor(canvas, worldData, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.worldData = worldData;
    
    // Options
    this.interactive = options.interactive ?? true;
    this.allowPanZoom = options.allowPanZoom ?? true;
    this.countryAliases = options.aliases || {};
    
    // DPI scaling
    this.dpr = window.devicePixelRatio || 1;
    
    // Canvas dimensions
    this.canvasDisplayWidth = options.width || 600;
    this.canvasDisplayHeight = options.height || 320;
    
    // Viewport state (for pan/zoom)
    this.scrollX = 0;
    this.scrollY = 0;
    this.zoom = 1;
    this.minZoom = 1;
    this.velocityX = 0;
    this.velocityY = 0;
    
    // Highlighted country state
    this.highlightedCountry = null;
    this.highlightType = null; // 'correct', 'wrong', 'selected'
    
    // Process country paths
    this.countryPaths = worldData.features.map(f => ({
      name: f.properties.ADMIN || f.properties.NAME || '',
      paths: coordsFromFeature(f)
    }));
    
    // Initialize canvas
    this.resizeCanvas();
    
    // Setup interaction if enabled
    if (this.interactive && this.allowPanZoom) {
      this.attachInteraction();
    }
  }
  
  /**
   * Resize canvas to match display size with DPI scaling
   */
  resizeCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    this.canvasDisplayWidth = rect.width || this.canvasDisplayWidth;
    this.canvasDisplayHeight = rect.height || this.canvasDisplayHeight;
    
    this.canvas.width = this.canvasDisplayWidth * this.dpr;
    this.canvas.height = this.canvasDisplayHeight * this.dpr;
    this.ctx.scale(this.dpr, this.dpr);
    
    this.draw();
  }
  
  /**
   * Draw the world map with current viewport and highlights
   */
  draw() {
    const ctx = this.ctx;
    const w = this.canvasDisplayWidth;
    const h = this.canvasDisplayHeight;
    
    // Clear
    ctx.clearRect(0, 0, w, h);
    
    // Save state
    ctx.save();
    
    // Apply zoom and pan transformations
    ctx.translate(this.scrollX, this.scrollY);
    ctx.scale(this.zoom, this.zoom);
    
    // Default colors from CSS variables or fallbacks
    const defaultFill = getCSSVar('--map-country-fill') || "rgba(165,180,252,.08)";
    const defaultStroke = getCSSVar('--map-country-stroke') || "rgba(232,236,255,.3)";
    
    // Draw all countries
    for (const country of this.countryPaths) {
      let fillStyle = defaultFill;
      let strokeStyle = defaultStroke;
      let strokeWidth = 0.5;
      
      // Check if this country should be highlighted
      if (this.highlightedCountry && norm(country.name) === norm(this.highlightedCountry)) {
        if (this.highlightType === "correct") {
          fillStyle = "rgba(110, 231, 183, 0.5)";
          strokeStyle = "rgba(110, 231, 183, 0.95)";
          strokeWidth = 1.5;
        } else if (this.highlightType === "wrong") {
          fillStyle = "rgba(252, 165, 161, 0.5)";
          strokeStyle = "rgba(252, 165, 161, 0.95)";
          strokeWidth = 1.5;
        } else if (this.highlightType === "selected") {
          fillStyle = "rgba(251, 191, 36, 0.3)";
          strokeStyle = "rgba(251, 191, 36, 0.8)";
          strokeWidth = 1.5;
        }
      }
      
      // Draw each polygon of the country
      for (const polygon of country.paths) {
        ctx.beginPath();
        polygon.forEach(([x, y], i) => {
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
        
        ctx.fillStyle = fillStyle;
        ctx.fill();
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = strokeWidth;
        ctx.stroke();
      }
    }
    
    // Restore state
    ctx.restore();
  }
  
  /**
   * Highlight a country with a specific type
   * @param {string} countryName - Country name to highlight
   * @param {string} type - Highlight type: 'correct', 'wrong', 'selected', or null
   */
  highlightCountry(countryName, type = 'selected') {
    this.highlightedCountry = countryName;
    this.highlightType = type;
    this.draw();
  }
  
  /**
   * Clear all highlights
   */
  clearHighlight() {
    this.highlightedCountry = null;
    this.highlightType = null;
    this.draw();
  }
  
  /**
   * Get country name at canvas coordinates (click detection)
   * @param {number} canvasX - X coordinate on canvas
   * @param {number} canvasY - Y coordinate on canvas
   * @returns {string|null} Country name or null
   */
  getCountryAt(canvasX, canvasY) {
    // Convert canvas coordinates to map coordinates (accounting for zoom/pan)
    const mapX = (canvasX - this.scrollX) / this.zoom;
    const mapY = (canvasY - this.scrollY) / this.zoom;
    
    // Check each country's paths using point-in-polygon
    for (const country of this.countryPaths) {
      for (const polygon of country.paths) {
        if (this.isPointInPolygon(mapX, mapY, polygon)) {
          return country.name;
        }
      }
    }
    
    return null;
  }
  
  /**
   * Point-in-polygon test (ray casting algorithm)
   */
  isPointInPolygon(x, y, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0], yi = polygon[i][1];
      const xj = polygon[j][0], yj = polygon[j][1];
      
      const intersect = ((yi > y) !== (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }
  
  /**
   * Attach pan/zoom interaction handlers
   */
  attachInteraction() {
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;
    let touchStartDist = 0;
    let touchStartZoom = 1;
    
    // Mouse/touch down
    const handleStart = (e) => {
      const touches = e.touches;
      
      if (touches && touches.length === 2) {
        // Pinch zoom start
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        touchStartDist = Math.sqrt(dx * dx + dy * dy);
        touchStartZoom = this.zoom;
      } else {
        // Pan start
        isDragging = true;
        const clientX = touches ? touches[0].clientX : e.clientX;
        const clientY = touches ? touches[0].clientY : e.clientY;
        lastX = clientX;
        lastY = clientY;
        this.velocityX = 0;
        this.velocityY = 0;
      }
      
      e.preventDefault();
    };
    
    // Mouse/touch move
    const handleMove = (e) => {
      const touches = e.touches;
      
      if (touches && touches.length === 2) {
        // Pinch zoom
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const scale = dist / touchStartDist;
        this.zoom = Math.max(this.minZoom, Math.min(8, touchStartZoom * scale));
        this.draw();
      } else if (isDragging) {
        // Pan
        const clientX = touches ? touches[0].clientX : e.clientX;
        const clientY = touches ? touches[0].clientY : e.clientY;
        const dx = clientX - lastX;
        const dy = clientY - lastY;
        
        this.scrollX += dx;
        this.scrollY += dy;
        this.velocityX = dx;
        this.velocityY = dy;
        
        lastX = clientX;
        lastY = clientY;
        this.draw();
      }
      
      e.preventDefault();
    };
    
    // Mouse/touch up
    const handleEnd = (e) => {
      isDragging = false;
      touchStartDist = 0;
    };
    
    // Mouse wheel zoom
    const handleWheel = (e) => {
      e.preventDefault();
      
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(this.minZoom, Math.min(8, this.zoom * delta));
      
      // Zoom towards mouse position
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      this.scrollX = x - (x - this.scrollX) * (newZoom / this.zoom);
      this.scrollY = y - (y - this.scrollY) * (newZoom / this.zoom);
      this.zoom = newZoom;
      
      this.draw();
    };
    
    // Attach events
    this.canvas.addEventListener('mousedown', handleStart);
    this.canvas.addEventListener('mousemove', handleMove);
    this.canvas.addEventListener('mouseup', handleEnd);
    this.canvas.addEventListener('mouseleave', handleEnd);
    this.canvas.addEventListener('touchstart', handleStart, { passive: false });
    this.canvas.addEventListener('touchmove', handleMove, { passive: false });
    this.canvas.addEventListener('touchend', handleEnd);
    this.canvas.addEventListener('wheel', handleWheel, { passive: false });
  }
  
  /**
   * Zoom to fit a specific country in view
   * @param {string} countryName - Country to zoom to
   */
  zoomToCountry(countryName) {
    const country = this.countryPaths.find(c => 
      norm(c.name) === norm(countryName)
    );
    
    if (!country || country.paths.length === 0) return;
    
    // Calculate bounding box
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    for (const polygon of country.paths) {
      for (const [x, y] of polygon) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    
    const width = maxX - minX;
    const height = maxY - minY;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    // Calculate zoom to fit with padding
    const zoomX = this.canvasDisplayWidth / (width * 1.5);
    const zoomY = this.canvasDisplayHeight / (height * 1.5);
    this.zoom = Math.max(this.minZoom, Math.min(8, Math.min(zoomX, zoomY)));
    
    // Center on country
    this.scrollX = this.canvasDisplayWidth / 2 - centerX * this.zoom;
    this.scrollY = this.canvasDisplayHeight / 2 - centerY * this.zoom;
    
    this.draw();
  }
  
  /**
   * Zoom to show multiple countries
   * @param {...string} countries - Countries to fit in view
   */
  zoomToCountries(...countries) {
    const validCountries = countries.map(name => 
      this.countryPaths.find(c => norm(c.name) === norm(name))
    ).filter(c => c && c.paths.length > 0);
    
    if (validCountries.length === 0) return;
    
    // Calculate combined bounding box
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    for (const country of validCountries) {
      for (const polygon of country.paths) {
        for (const [x, y] of polygon) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }
    
    const width = maxX - minX;
    const height = maxY - minY;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    // Add padding (extra for tiny countries)
    const size = Math.max(width, height);
    const isTiny = size < 20; // Tiny island or microstate
    const padding = isTiny ? 2.0 : 1.5;
    
    // Calculate zoom to fit
    const zoomX = this.canvasDisplayWidth / (width * padding);
    const zoomY = this.canvasDisplayHeight / (height * padding);
    const maxZoom = isTiny ? 20 : 8; // Allow more zoom for tiny countries
    this.zoom = Math.max(this.minZoom, Math.min(maxZoom, Math.min(zoomX, zoomY)));
    
    // Center on combined bbox
    this.scrollX = this.canvasDisplayWidth / 2 - centerX * this.zoom;
    this.scrollY = this.canvasDisplayHeight / 2 - centerY * this.zoom;
    
    this.draw();
  }
  
  /**
   * Reset zoom and pan to default
   */
  resetView() {
    this.scrollX = 0;
    this.scrollY = 0;
    this.zoom = 1;
    this.draw();
  }
  
  /**
   * Cleanup
   */
  destroy() {
    // Could remove event listeners here if needed
  }
}
