import { createFindCountryGame } from "./find-country-game.js";
import { initConfetti } from "./confetti.js";
import { norm } from "./utils.js";
import { COUNTRY_ALIASES } from "./aliases.js";
import { attachWikipediaPopup } from "./wiki.js";
import { loadGeoJSON } from "./geojson-loader.js";

// Helper to get CSS variable values
function getCSSVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// UI references
const ui = {
  map: document.getElementById("map"),
  countryNameEl: document.getElementById("countryName"),
  scoreEl: document.getElementById("score"),
  progressEl: document.getElementById("progress"),
  finalOverlay: document.getElementById("finalOverlay"),
  finalScoreEl: document.getElementById("finalScore"),
  finalCountriesEl: document.getElementById("finalCountries"),
  finalCorrectEl: document.getElementById("finalCorrect"),
  finalAccuracyEl: document.getElementById("finalAccuracy"),
  finalSubtitleEl: document.getElementById("finalSubtitle"),
  playAgainBtn: document.getElementById("playAgain"),
  closeFinalBtn: document.getElementById("closeFinal"),
};

const confetti = initConfetti("confetti");
const initOverlay = document.getElementById("init-overlay");

if (initOverlay) {
  initOverlay.classList.remove("hidden");
  initOverlay.style.display = "flex";
}

// Canvas setup
const canvas = ui.map;
const ctx = canvas.getContext("2d");
const dpr = window.devicePixelRatio || 1;

// Canvas dimensions will be set by resizeCanvas()
let canvasDisplayWidth = 600;
let canvasDisplayHeight = 320;

// Load data
let WORLD = null;
let countryPaths = []; // Store pre-processed country paths

const MAP_W = 600;
const MAP_H = 320;

const proj = ([lon, lat]) => [((lon + 180) / 360) * MAP_W, ((90 - lat) / 180) * MAP_H];

// Convert GeoJSON feature to path coordinates
function coordsFromFeature(f) {
  if (!f.geometry) return [];
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  const paths = [];
  
  for (const poly of polys) {
    for (const ring of poly) {
      const coords = ring.map(([lon, lat]) => proj([lon, lat]));
      paths.push(coords);
    }
  }
  return paths;
}

// Viewport state
let scrollX = 0;
let scrollY = 0;
let zoom = 1;
let minZoom = 1; // Dynamically calculated minimum zoom
let velocityX = 0;
let velocityY = 0;

// Highlighted country state
let highlightedCountry = null;
let highlightType = null;
let hoverCountry = null;

// Animation loop
let animationFrameId = null;

// Point-in-polygon test (ray casting algorithm)
function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Draw a country on canvas
function drawCountry(paths, offsetX, fillStyle, strokeStyle, strokeWidth) {
  ctx.save();
  
  for (const coords of paths) {
    ctx.beginPath();
    coords.forEach(([x, y], i) => {
      const px = (x + offsetX - scrollX) * zoom;
      const py = (y - scrollY) * zoom;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
    
    ctx.fillStyle = fillStyle;
    ctx.fill();
    ctx.strokeStyle = strokeStyle;
    // Keep stroke width constant regardless of zoom level
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
  }
  
  ctx.restore();
}

// Draw entire world map
function drawWorldMap() {
  if (!countryPaths.length) return;
  
  ctx.clearRect(0, 0, canvasDisplayWidth, canvasDisplayHeight);
  
  // Calculate how many map copies we need to draw to fill the canvas
  // Based on current scroll position and zoom level
  const viewWidthInMapUnits = canvasDisplayWidth / zoom;
  const startMapX = scrollX - viewWidthInMapUnits / 2;
  const endMapX = scrollX + viewWidthInMapUnits / 2;
  
  // Determine which map copies to draw (normalize to MAP_W intervals)
  const firstCopy = Math.floor(startMapX / MAP_W);
  const lastCopy = Math.ceil(endMapX / MAP_W);
  
  // Generate offsets for all needed copies
  const offsets = [];
  for (let i = firstCopy; i <= lastCopy; i++) {
    offsets.push(i * MAP_W);
  }
  
  // Default colors
  const defaultFill = getCSSVar('--map-country-fill') || "rgba(165,180,252,.08)";
  const defaultStroke = getCSSVar('--map-country-stroke') || "rgba(232,236,255,.3)";
  const hoverFill = getCSSVar('--map-country-fill-highlight') || "rgba(165,180,252,.25)";
  
  // Draw all countries
  for (const offset of offsets) {
    for (const country of countryPaths) {
      let fillStyle = defaultFill;
      let strokeStyle = defaultStroke;
      let strokeWidth = 0.5;
      
      // Check if this country should be highlighted
      if (highlightedCountry && norm(country.name) === norm(highlightedCountry)) {
        if (highlightType === "selected") {
          fillStyle = getCSSVar('--map-selected-fill') || "rgba(165, 180, 252, 0.35)";
          strokeStyle = getCSSVar('--map-selected-stroke') || "rgba(165, 180, 252, 0.95)";
          strokeWidth = 1.5;
        } else if (highlightType === "correct") {
          fillStyle = getCSSVar('--map-correct-fill') || "rgba(110, 231, 183, 0.5)";
          strokeStyle = getCSSVar('--map-correct-stroke') || "rgba(110, 231, 183, 0.95)";
          strokeWidth = 1.2;
        } else if (highlightType === "wrong") {
          fillStyle = getCSSVar('--map-wrong-fill') || "rgba(252, 165, 161, 0.5)";
          strokeStyle = getCSSVar('--map-wrong-stroke') || "rgba(252, 165, 161, 0.95)";
          strokeWidth = 1.2;
        }
      } else if (hoverCountry && norm(country.name) === norm(hoverCountry)) {
        fillStyle = hoverFill;
      }
      
      drawCountry(country.paths, offset, fillStyle, strokeStyle, strokeWidth);
    }
  }
}

// Check which country was clicked (canvas coordinates)
function checkClickedCountry(canvasX, canvasY) {
  // Transform canvas pixel to map coords
  // Canvas coordinates are in display pixels, need to account for zoom and scroll
  const mapX = (canvasX / zoom) + scrollX;
  const mapY = (canvasY / zoom) + scrollY;
  
  // Check all country paths (need to check with wrapping)
  const normalizedMapX = ((mapX % MAP_W) + MAP_W) % MAP_W;
  
  // Try exact point-in-polygon detection
  for (const country of countryPaths) {
    for (const polygon of country.paths) {
      if (pointInPolygon(normalizedMapX, mapY, polygon)) {
        // Find matching country in DATA using aliases
        const dataCountries = window.DATA.map(d => d.country);
        for (const dc of dataCountries) {
          const alias = COUNTRY_ALIASES[dc] || dc;
          if (norm(alias) === norm(country.name)) {
            return dc;
          }
        }
        return country.name;
      }
    }
  }
  
  // If no exact hit, check for nearby small countries
  const PROXIMITY_THRESHOLD = 30;
  let nearestSmallCountry = null;
  let nearestDistance = Infinity;
  
  for (const country of countryPaths) {
    // Calculate bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const polygon of country.paths) {
      for (const [x, y] of polygon) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
    
    const size = Math.max(maxX - minX, maxY - minY);
    if (size > 50) continue;
    
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const distance = Math.sqrt(Math.pow(normalizedMapX - centerX, 2) + Math.pow(mapY - centerY, 2));
    
    if (distance < nearestDistance && distance < PROXIMITY_THRESHOLD) {
      nearestDistance = distance;
      
      // Find matching country in DATA using aliases
      const dataCountries = window.DATA.map(d => d.country);
      for (const dc of dataCountries) {
        const alias = COUNTRY_ALIASES[dc] || dc;
        if (norm(alias) === norm(country.name)) {
          nearestSmallCountry = dc;
          break;
        }
      }
      
      if (!nearestSmallCountry) {
        nearestSmallCountry = country.name;
      }
    }
  }
  
  return nearestSmallCountry;
}

// Highlight a country (selected/correct/wrong)
function highlightCountry(countryName, type) {
  const mapName = COUNTRY_ALIASES[countryName] || countryName;
  highlightedCountry = mapName;
  highlightType = type;
  drawWorldMap();
}

// Get bounding box for a country
function getCountryBBox(countryName) {
  const mapName = COUNTRY_ALIASES[countryName] || countryName;
  const features = WORLD.filter((f) => norm(f.properties.ADMIN || "") === norm(mapName));
  
  if (features.length === 0) return null;
  
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  
  for (const f of features) {
    const rings = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
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
  }
  
  return { minLon, minLat, maxLon, maxLat };
}

// Zoom map to show both countries
function zoomToCountries(country1, country2) {
  const bbox1 = getCountryBBox(country1);
  const bbox2 = getCountryBBox(country2);
  
  if (!bbox1 || !bbox2) return;
  
  // Combine bounding boxes
  const combinedBBox = {
    minLon: Math.min(bbox1.minLon, bbox2.minLon),
    minLat: Math.min(bbox1.minLat, bbox2.minLat),
    maxLon: Math.max(bbox1.maxLon, bbox2.maxLon),
    maxLat: Math.max(bbox1.maxLat, bbox2.maxLat),
  };
  
  // Add padding (20%)
  const dLon = combinedBBox.maxLon - combinedBBox.minLon;
  const dLat = combinedBBox.maxLat - combinedBBox.minLat;
  const padRatio = 0.2;
  
  combinedBBox.minLon -= dLon * padRatio;
  combinedBBox.maxLon += dLon * padRatio;
  combinedBBox.minLat -= dLat * padRatio;
  combinedBBox.maxLat += dLat * padRatio;
  
  // Convert to map coordinates
  const [x1, y1] = proj([combinedBBox.minLon, combinedBBox.maxLat]);
  const [x2, y2] = proj([combinedBBox.maxLon, combinedBBox.minLat]);
  
  // Calculate zoom and center
  const width = x2 - x1;
  const height = y2 - y1;
  
  const zoomX = canvasDisplayWidth / width;
  const zoomY = canvasDisplayHeight / height;
  zoom = Math.min(zoomX, zoomY, 100); // Cap zoom at 100x
  
  scrollX = x1 + width / 2 - canvasDisplayWidth / 2 / zoom;
  scrollY = y1 + height / 2 - canvasDisplayHeight / 2 / zoom;
  
  drawWorldMap();
}

// Clear highlights but keep current zoom/pan
function resetMapView() {
  // Only reset highlights and velocity, preserve zoom AND pan position
  highlightedCountry = null;
  highlightType = null;
  hoverCountry = null;
  // Don't reset pan position - preserve location between rounds
  // scrollX = 0;
  // scrollY = 0;
  // Don't reset zoom - preserve zoom level between rounds
  // zoom = minZoom;
  velocityX = 0;
  velocityY = 0;
  drawWorldMap();
}

// Load all data
async function loadData() {
  const worldData = await loadGeoJSON("data/ne_10m_admin_0_countries.geojson.gz");
  WORLD = worldData.features;
  
  // Pre-process country paths for canvas rendering
  countryPaths = WORLD.map(f => ({
    name: f.properties.ADMIN || "",
    paths: coordsFromFeature(f)
  })).filter(c => c.paths.length > 0);
}

// Initialize data and game
let game = null;

try {
  await loadData();
} catch (err) {
  console.error("Data load failed:", err);
}

// Draw the world map
drawWorldMap();

// Create game instance
game = createFindCountryGame({ 
  ui, 
  confetti,
  checkClickedCountry,
  highlightCountry,
  zoomToCountries,
  resetMapView,
});

// Attach Wikipedia popup to country name
attachWikipediaPopup(ui.countryNameEl, () => game.getCurrent());

// Momentum scrolling and zoom functionality
function attachCanvasInteraction() {
  const canvasEl = ui.map;
  
  // Momentum animation
  const FRICTION = 0.92;
  const MIN_VELOCITY = 0.1;
  
  function animate() {
    if (Math.abs(velocityX) > MIN_VELOCITY || Math.abs(velocityY) > MIN_VELOCITY) {
      scrollX += velocityX;
      scrollY += velocityY;
      
      // Clamp vertical scroll
      const minScrollY = 0;
      const maxScrollY = Math.max(0, MAP_H - canvasDisplayHeight / zoom);
      if (scrollY < minScrollY) {
        scrollY = minScrollY;
        velocityY = 0;
      }
      if (scrollY > maxScrollY) {
        scrollY = maxScrollY;
        velocityY = 0;
      }
      
      velocityX *= FRICTION;
      velocityY *= FRICTION;
      
      drawWorldMap();
      animationFrameId = requestAnimationFrame(animate);
    } else {
      velocityX = 0;
      velocityY = 0;
      animationFrameId = null;
    }
  }
  
  function startAnimation() {
    if (!animationFrameId) {
      animationFrameId = requestAnimationFrame(animate);
    }
  }
  
  // Mouse wheel zoom
  canvasEl.addEventListener('wheel', (e) => {
    e.preventDefault();
    
    const rect = canvasEl.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(minZoom, Math.min(100, zoom * factor));
    
    // Zoom toward mouse position
    const mapXBefore = mouseX / zoom + scrollX;
    const mapYBefore = mouseY / zoom + scrollY;
    
    zoom = newZoom;
    
    scrollX = mapXBefore - mouseX / zoom;
    scrollY = mapYBefore - mouseY / zoom;
    
    // Clamp vertical scroll
    scrollY = Math.max(0, Math.min(Math.max(0, MAP_H - canvasDisplayHeight / zoom), scrollY));
    
    drawWorldMap();
  }, { passive: false });
  
  // Touch and mouse interaction
  let isPointerDown = false;
  let startX = 0, startY = 0;
  let lastX = 0, lastY = 0;
  let lastTime = 0;
  let isDragging = false;
  
  // Pinch zoom
  let touches = [];
  let initialPinchDistance = 0;
  let initialZoom = 1;
  
  function getDistance(t1, t2) {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  canvasEl.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    
    if (e.pointerType === 'touch') {
      touches.push(e);
      
      if (touches.length === 2) {
        initialPinchDistance = getDistance(touches[0], touches[1]);
        initialZoom = zoom;
        isDragging = false;
      } else if (touches.length === 1) {
        isPointerDown = true;
        const rect = canvasEl.getBoundingClientRect();
        startX = lastX = e.clientX - rect.left;
        startY = lastY = e.clientY - rect.top;
        lastTime = Date.now();
        velocityX = 0;
        velocityY = 0;
        isDragging = false;
      }
    } else {
      isPointerDown = true;
      const rect = canvasEl.getBoundingClientRect();
      startX = lastX = e.clientX - rect.left;
      startY = lastY = e.clientY - rect.top;
      lastTime = Date.now();
      velocityX = 0;
      velocityY = 0;
      isDragging = false;
    }
  });
  
  canvasEl.addEventListener('pointermove', (e) => {
    e.preventDefault();
    
    const rect = canvasEl.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    
    // Update hover
    if (game && game.getCurrent() !== "" && !isPointerDown) {
      const clickedCountry = checkClickedCountry(currentX, currentY);
      if (clickedCountry !== hoverCountry) {
        hoverCountry = clickedCountry;
        drawWorldMap();
      }
    }
    
    if (e.pointerType === 'touch') {
      const touchIndex = touches.findIndex(t => t.pointerId === e.pointerId);
      if (touchIndex >= 0) {
        touches[touchIndex] = e;
      }
      
      if (touches.length === 2) {
        const newDistance = getDistance(touches[0], touches[1]);
        const scale = newDistance / initialPinchDistance;
        zoom = Math.max(minZoom, Math.min(100, initialZoom * scale));
        drawWorldMap();
        return;
      }
    }
    
    if (isPointerDown) {
      const dx = currentX - lastX;
      const dy = currentY - lastY;
      const dt = Date.now() - lastTime;
      
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        isDragging = true;
      }
      
      scrollX -= dx / zoom;
      scrollY -= dy / zoom;
      
      // Clamp vertical scroll
      scrollY = Math.max(0, Math.min(Math.max(0, MAP_H - canvasDisplayHeight / zoom), scrollY));
      
      if (dt > 0) {
        velocityX = -dx / zoom * 0.5;
        velocityY = -dy / zoom * 0.5;
      }
      
      lastX = currentX;
      lastY = currentY;
      lastTime = Date.now();
      
      drawWorldMap();
    }
  });
  
  canvasEl.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'touch') {
      touches = touches.filter(t => t.pointerId !== e.pointerId);
      
      if (touches.length === 0) {
        isPointerDown = false;
        
        if (!isDragging) {
          // Handle click
          const rect = canvasEl.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const clickY = e.clientY - rect.top;
          const clickedCountry = checkClickedCountry(clickX, clickY);
          
          if (clickedCountry && game) {
            game.handleMapClick(clickedCountry);
          }
        } else {
          startAnimation();
        }
      }
    } else {
      if (!isDragging) {
        // Handle click
        const rect = canvasEl.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        const clickedCountry = checkClickedCountry(clickX, clickY);
        
        if (clickedCountry && game) {
          game.handleMapClick(clickedCountry);
        }
      } else {
        startAnimation();
      }
      
      isPointerDown = false;
    }
  });
  
  canvasEl.addEventListener('pointercancel', () => {
    isPointerDown = false;
    touches = [];
  });
  
  canvasEl.addEventListener('pointerleave', () => {
    hoverCountry = null;
    drawWorldMap();
  });
  
  canvasEl.style.touchAction = 'none';
  canvasEl.style.cursor = 'pointer';
}

// Resize canvas to fit container while maintaining aspect ratio
function resizeCanvas() {
  const container = ui.map.parentElement;
  const rect = container.getBoundingClientRect();
  
  // Use full container dimensions
  const containerWidth = rect.width;
  const containerHeight = rect.height;
  
  // Store display dimensions
  canvasDisplayWidth = containerWidth;
  canvasDisplayHeight = containerHeight;
  
  // Calculate minimum zoom to fill container (no letterboxing)
  // minZoom ensures map always fills the available space
  minZoom = Math.max(containerHeight / MAP_H, containerWidth / MAP_W);
  
  // Set initial zoom to minimum if not already set higher
  if (zoom < minZoom) {
    zoom = minZoom;
  }
  
  // Set canvas display size to fill container
  canvas.style.width = `${containerWidth}px`;
  canvas.style.height = `${containerHeight}px`;
  
  // Set canvas internal resolution (accounting for DPI)
  canvas.width = containerWidth * dpr;
  canvas.height = containerHeight * dpr;
  
  // Scale context for DPI
  ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
  ctx.scale(dpr, dpr);
  
  // Redraw the map
  drawWorldMap();
}

ui.playAgainBtn?.addEventListener("click", () => {
  ui.finalOverlay.style.display = "none";
  resetMapView();
  game.reset();
  game.nextQ();
});

ui.closeFinalBtn?.addEventListener("click", () => {
  ui.finalOverlay.style.display = "none";
});

// Attach canvas interactions
attachCanvasInteraction();

// Setup resize handler
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Start the game
game.reset();
game.nextQ();

// Hide init overlay
if (initOverlay) {
  setTimeout(() => {
    initOverlay.style.display = "none";
  }, 100);
}
