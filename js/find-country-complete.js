/**
 * Find Country - Complete Game Factory
 * Creates a fully functional Find Country game with canvas, pan/zoom, and event handling
 * Used by both standalone game and Daily Challenge
 */

import { createFindCountryGame } from "./find-country-game.js";
import { initConfetti } from "./confetti.js";
import { norm } from "./utils.js";
import { COUNTRY_ALIASES } from "./aliases.js";
import { loadGeoJSON } from "./geojson-loader.js";

/**
 * Create a complete Find Country game instance
 * @param {Object} config Configuration
 * @param {HTMLElement} config.container - Container element
 * @param {HTMLCanvasElement} config.canvas - Canvas element
 * @param {HTMLElement} config.countryNameEl - Element to show country name
 * @param {Object} [config.ui] - Additional UI elements (scoreEl, progressEl, etc.)
 * @param {Object} [config.confetti] - Confetti instance
 * @param {boolean} [config.singleRound=false] - Single round mode for Daily Challenge
 * @param {Function} [config.onComplete] - Callback when game completes
 * @param {number} [config.timeLimit] - Time limit in seconds (for Daily Challenge)
 * @returns {Promise<Object>} Game instance
 */
export async function createCompleteMap({ 
  container, 
  canvas, 
  countryNameEl,
  ui = {},
  confetti: confettiInstance,
  singleRound = false,
  onComplete,
  timeLimit
}) {
  
  const MAP_W = 600;
  const MAP_H = 320;
  
  // Canvas setup
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  
  let canvasDisplayWidth = 600;
  let canvasDisplayHeight = 320;
  
  // Projection
  const proj = ([lon, lat]) => [
    ((lon + 180) / 360) * MAP_W, 
    ((90 - lat) / 180) * MAP_H
  ];
  
  // Convert GeoJSON feature to path coordinates
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
  
  // Get CSS variable
  function getCSSVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  
  // Viewport state
  let scrollX = 0;
  let scrollY = 0;
  let zoom = 1;
  let minZoom = 1;
  let velocityX = 0;
  let velocityY = 0;
  
  // Highlighted country state
  let highlightedCountry = null;
  let highlightType = null;
  let hoverCountry = null;
  
  // Animation loop
  let animationFrameId = null;
  
  // Load data
  let WORLD = null;
  let countryPaths = [];
  
  const worldData = await loadGeoJSON("data/ne_10m_admin_0_countries.geojson.gz");
  WORLD = worldData.features;
  
  // Pre-process country paths
  const countryMap = new Map();
  for (const feature of WORLD) {
    const name = feature.properties.ADMIN || "";
    if (!name) continue;
    
    const paths = coordsFromFeature(feature);
    if (paths.length === 0) continue;
    
    if (countryMap.has(name)) {
      countryMap.get(name).paths.push(...paths);
    } else {
      countryMap.set(name, { name, paths });
    }
  }
  countryPaths = Array.from(countryMap.values());
  
  // Point-in-polygon test
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
  
  // Draw a country
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
      ctx.lineWidth = strokeWidth;
      ctx.stroke();
    }
    
    ctx.restore();
  }
  
  // Draw entire world map
  function drawWorldMap() {
    if (!countryPaths.length) return;
    
    ctx.clearRect(0, 0, canvasDisplayWidth, canvasDisplayHeight);
    
    const viewWidthInMapUnits = canvasDisplayWidth / zoom;
    const viewHeightInMapUnits = canvasDisplayHeight / zoom;
    const viewLeft = scrollX - viewWidthInMapUnits / 2;
    const viewRight = scrollX + viewWidthInMapUnits / 2;
    const viewTop = scrollY - viewHeightInMapUnits / 2;
    const viewBottom = scrollY + viewHeightInMapUnits / 2;
    
    const defaultFill = getCSSVar('--map-country-fill') || "rgba(165,180,252,.08)";
    const defaultStroke = getCSSVar('--map-country-stroke') || "rgba(232,236,255,.3)";
    const hoverFill = getCSSVar('--map-country-fill-highlight') || "rgba(165,180,252,.25)";
    
    for (const country of countryPaths) {
      let fillStyle = defaultFill;
      let strokeStyle = defaultStroke;
      let strokeWidth = 0.5;
      
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
      
      const normalizedScrollX = ((scrollX % MAP_W) + MAP_W) % MAP_W;
      const baseOffset = scrollX - normalizedScrollX;
      
      for (let i = -1; i <= 1; i++) {
        const offset = baseOffset + (i * MAP_W);
        const mapLeft = offset;
        const mapRight = offset + MAP_W;
        if (mapRight >= viewLeft && mapLeft <= viewRight) {
          drawCountry(country.paths, offset, fillStyle, strokeStyle, strokeWidth);
        }
      }
    }
  }
  
  // Check clicked country
  function checkClickedCountry(canvasX, canvasY) {
    const mapX = (canvasX / zoom) + scrollX;
    const mapY = (canvasY / zoom) + scrollY;
    const normalizedMapX = ((mapX % MAP_W) + MAP_W) % MAP_W;
    
    for (const country of countryPaths) {
      for (const polygon of country.paths) {
        if (pointInPolygon(normalizedMapX, mapY, polygon)) {
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
    
    // Check nearby small countries
    const PROXIMITY_THRESHOLD = 30;
    let nearestSmallCountry = null;
    let nearestDistance = Infinity;
    
    for (const country of countryPaths) {
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
  
  // Highlight country
  function highlightCountry(countryName, type) {
    const mapName = COUNTRY_ALIASES[countryName] || countryName;
    highlightedCountry = mapName;
    highlightType = type;
    drawWorldMap();
  }
  
  // Get country bounding box
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
  
  // Zoom to countries
  function zoomToCountries(country1, country2) {
    const bbox1 = getCountryBBox(country1);
    const bbox2 = getCountryBBox(country2);
    
    if (!bbox1 || !bbox2) return;
    
    const size1 = Math.max(bbox1.maxLon - bbox1.minLon, bbox1.maxLat - bbox1.minLat);
    const size2 = Math.max(bbox2.maxLon - bbox2.minLon, bbox2.maxLat - bbox2.minLat);
    const isTiny1 = size1 < 2;
    const isTiny2 = size2 < 2;
    
    const combinedBBox = {
      minLon: Math.min(bbox1.minLon, bbox2.minLon),
      minLat: Math.min(bbox1.minLat, bbox2.minLat),
      maxLon: Math.max(bbox1.maxLon, bbox2.maxLon),
      maxLat: Math.max(bbox1.maxLat, bbox2.maxLat),
    };
    
    const dLon = combinedBBox.maxLon - combinedBBox.minLon;
    const dLat = combinedBBox.maxLat - combinedBBox.minLat;
    const padRatio = (isTiny1 || isTiny2) ? 0.4 : 0.2;
    
    combinedBBox.minLon -= dLon * padRatio;
    combinedBBox.maxLon += dLon * padRatio;
    combinedBBox.minLat -= dLat * padRatio;
    combinedBBox.maxLat += dLat * padRatio;
    
    if (isTiny1 || isTiny2) {
      const MIN_AREA_DEGREES = 10;
      const currentLonSpan = combinedBBox.maxLon - combinedBBox.minLon;
      const currentLatSpan = combinedBBox.maxLat - combinedBBox.minLat;
      
      if (currentLonSpan < MIN_AREA_DEGREES) {
        const centerLon = (combinedBBox.minLon + combinedBBox.maxLon) / 2;
        combinedBBox.minLon = centerLon - MIN_AREA_DEGREES / 2;
        combinedBBox.maxLon = centerLon + MIN_AREA_DEGREES / 2;
      }
      
      if (currentLatSpan < MIN_AREA_DEGREES) {
        const centerLat = (combinedBBox.minLat + combinedBBox.maxLat) / 2;
        combinedBBox.minLat = centerLat - MIN_AREA_DEGREES / 2;
        combinedBBox.maxLat = centerLat + MIN_AREA_DEGREES / 2;
      }
    }
    
    const [x1, y1] = proj([combinedBBox.minLon, combinedBBox.maxLat]);
    const [x2, y2] = proj([combinedBBox.maxLon, combinedBBox.minLat]);
    
    const width = x2 - x1;
    const height = y2 - y1;
    
    const zoomX = canvasDisplayWidth / width;
    const zoomY = canvasDisplayHeight / height;
    zoom = Math.max(minZoom, Math.min(zoomX, zoomY, 100));
    
    scrollX = x1 + width / 2 - canvasDisplayWidth / 2 / zoom;
    scrollY = y1 + height / 2 - canvasDisplayHeight / 2 / zoom;
    
    drawWorldMap();
  }
  
  // Reset map view
  function resetMapView() {
    highlightedCountry = null;
    highlightType = null;
    hoverCountry = null;
    velocityX = 0;
    velocityY = 0;
    drawWorldMap();
  }
  
  // Resize canvas
  function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    
    canvasDisplayWidth = rect.width;
    canvasDisplayHeight = rect.height;
    
    minZoom = Math.max(canvasDisplayHeight / MAP_H, canvasDisplayWidth / MAP_W);
    
    if (zoom < minZoom) {
      zoom = minZoom;
    }
    
    canvas.style.width = `${canvasDisplayWidth}px`;
    canvas.style.height = `${canvasDisplayHeight}px`;
    
    canvas.width = canvasDisplayWidth * dpr;
    canvas.height = canvasDisplayHeight * dpr;
    
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    
    drawWorldMap();
  }
  
  // Attach canvas interaction (pan/zoom/click)
  function attachCanvasInteraction(game) {
    const FRICTION = 0.95;
    const MIN_VELOCITY = 0.1;
    
    function animate() {
      if (Math.abs(velocityX) > MIN_VELOCITY || Math.abs(velocityY) > MIN_VELOCITY) {
        scrollX += velocityX;
        scrollY += velocityY;
        
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
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(minZoom, Math.min(100, zoom * factor));
      
      const mapXBefore = mouseX / zoom + scrollX;
      const mapYBefore = mouseY / zoom + scrollY;
      
      zoom = newZoom;
      
      scrollX = mapXBefore - mouseX / zoom;
      scrollY = mapYBefore - mouseY / zoom;
      
      scrollY = Math.max(0, Math.min(Math.max(0, MAP_H - canvasDisplayHeight / zoom), scrollY));
      
      drawWorldMap();
    }, { passive: false });
    
    // Touch and mouse interaction
    let isPointerDown = false;
    let startX = 0, startY = 0;
    let lastX = 0, lastY = 0;
    let lastTime = 0;
    let isDragging = false;
    
    let touches = [];
    let initialPinchDistance = 0;
    let initialZoom = 1;
    let wasRecentlyPinching = false;
    let pinchCooldownTimer = null;
    let previousTouchCount = 0;
    
    function getDistance(t1, t2) {
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }
    
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      
      if (e.pointerType === 'touch') {
        touches.push(e);
        
        if (touches.length === 2) {
          initialPinchDistance = getDistance(touches[0], touches[1]);
          initialZoom = zoom;
          isDragging = false;
        } else if (touches.length === 1) {
          isPointerDown = true;
          const rect = canvas.getBoundingClientRect();
          startX = lastX = e.clientX - rect.left;
          startY = lastY = e.clientY - rect.top;
          lastTime = Date.now();
          velocityX = 0;
          velocityY = 0;
          isDragging = false;
        }
      } else {
        isPointerDown = true;
        const rect = canvas.getBoundingClientRect();
        startX = lastX = e.clientX - rect.left;
        startY = lastY = e.clientY - rect.top;
        lastTime = Date.now();
        velocityX = 0;
        velocityY = 0;
        isDragging = false;
      }
    });
    
    canvas.addEventListener('pointermove', (e) => {
      e.preventDefault();
      
      const rect = canvas.getBoundingClientRect();
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
          isDragging = false;
          isPointerDown = false;
          
          const midX = (touches[0].clientX + touches[1].clientX) / 2;
          const midY = (touches[0].clientY + touches[1].clientY) / 2;
          const rect = canvas.getBoundingClientRect();
          const canvasMidX = midX - rect.left;
          const canvasMidY = midY - rect.top;
          
          const mapXBefore = canvasMidX / zoom + scrollX;
          const mapYBefore = canvasMidY / zoom + scrollY;
          
          const newDistance = getDistance(touches[0], touches[1]);
          const scale = newDistance / initialPinchDistance;
          const newZoom = Math.max(minZoom, Math.min(100, initialZoom * scale));
          
          scrollX = mapXBefore - canvasMidX / newZoom;
          scrollY = mapYBefore - canvasMidY / newZoom;
          
          scrollY = Math.max(0, Math.min(Math.max(0, MAP_H - canvasDisplayHeight / newZoom), scrollY));
          
          zoom = newZoom;
          drawWorldMap();
          return;
        } else if (previousTouchCount === 2 && touches.length === 1) {
          wasRecentlyPinching = true;
          if (pinchCooldownTimer) clearTimeout(pinchCooldownTimer);
          pinchCooldownTimer = setTimeout(() => {
            wasRecentlyPinching = false;
          }, 300);
        }
        
        previousTouchCount = touches.length;
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
        
        scrollY = Math.max(0, Math.min(Math.max(0, MAP_H - canvasDisplayHeight / zoom), scrollY));
        
        if (dt > 0) {
          velocityX = -dx / zoom * 1.0;
          velocityY = -dy / zoom * 1.0;
        }
        
        lastX = currentX;
        lastY = currentY;
        lastTime = Date.now();
        
        drawWorldMap();
      }
    });
    
    canvas.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'touch') {
        touches = touches.filter(t => t.pointerId !== e.pointerId);
        
        if (previousTouchCount === 2 && touches.length === 0) {
          wasRecentlyPinching = true;
          if (pinchCooldownTimer) clearTimeout(pinchCooldownTimer);
          pinchCooldownTimer = setTimeout(() => {
            wasRecentlyPinching = false;
          }, 300);
        }
        
        previousTouchCount = touches.length;
        
        if (touches.length === 0) {
          isPointerDown = false;
          
          if (!isDragging && !wasRecentlyPinching) {
            const rect = canvas.getBoundingClientRect();
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
          const rect = canvas.getBoundingClientRect();
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
    
    canvas.addEventListener('pointercancel', () => {
      isPointerDown = false;
      touches = [];
    });
    
    canvas.addEventListener('pointerleave', () => {
      hoverCountry = null;
      drawWorldMap();
    });
    
    canvas.style.touchAction = 'none';
    canvas.style.cursor = 'pointer';
  }
  
  // Initialize canvas
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  drawWorldMap();
  
  // Create confetti if needed
  const confetti = confettiInstance || (typeof initConfetti === 'function' ? initConfetti('confetti') : null);
  
  // Merge UI elements
  const fullUI = {
    countryNameEl,
    scoreEl: ui.scoreEl || null,
    progressEl: ui.progressEl || null,
    finalOverlay: ui.finalOverlay || null,
    finalScoreEl: ui.finalScoreEl || null,
    finalCountriesEl: ui.finalCountriesEl || null,
    finalCorrectEl: ui.finalCorrectEl || null,
    finalAccuracyEl: ui.finalAccuracyEl || null,
    finalSubtitleEl: ui.finalSubtitleEl || null,
  };
  
  // Create game instance
  const game = createFindCountryGame({ 
    ui: fullUI, 
    confetti,
    checkClickedCountry,
    highlightCountry,
    zoomToCountries,
    resetMapView,
    config: {
      singleRound,
      hideScoreUI: singleRound,
      onComplete: onComplete
    }
  });
  
  // Attach canvas interactions
  attachCanvasInteraction(game);
  
  return {
    game,
    reset: () => game.reset(),
    nextQ: () => game.nextQ(),
    getCurrent: () => game.getCurrent(),
    setCountry: (country) => game.setCountry(country),
  };
}
