# Plan: Study Mode — Interactive World Map

## Context

GeoQuiz currently only has quiz games. Users want a free-exploration "Study" mode: a full world map where you hover over any country to instantly see its flag, name, capital, region, population, and borders — no quiz pressure, no rounds, no scoring. Capital cities are shown as persistent dots on the map. The entry point is a new card on `index.html`.

## Files to create

| File | Purpose |
|------|---------|
| `study.html` | Standalone page — map + info panel, same shell as find-country.html |
| `js/study-main.js` | Self-contained ES module: map rendering, hover detection, capital dots, info panel |

## Files to modify

| File | Change |
|------|--------|
| `index.html` | Add "Study" glass-card (same markup pattern as existing cards) |

---

## study.html

Structure mirrors `find-country.html`:
- `<link>` to `css/styles.css` + DM Sans font
- FOUC-prevention inline script
- `.wrap` → `.card` wrapper
- `<div class="row row-space-between">` header with back-link `<h1>` and subtitle
- `<div class="mapwrap">` containing `<canvas id="map">`
- `<div id="study-info">` info panel (positioned via CSS, initially hidden)
- Script tags: `pako.min.js`, `theme.js`, `data.js`, `<script type="module" src="js/study-main.js">`

No score pill, no round counter, no country-name overlay.

---

## js/study-main.js

Self-contained module (does NOT import find-country-complete.js — that file is tightly coupled to quiz state). Reuses only:
- `import { loadGeoJSON } from './geojson-loader.js'`

### Data loading (all parallel via Promise.all)

```
loadGeoJSON('data/ne_10m_admin_0_countries.geojson.gz')  // country polygons
fetch('data/places.geojson').then(r=>r.json())           // capital coordinates (uncompressed)
fetch('data/countries-flags.json').then(r=>r.json())     // country → ISO2 code
fetch('data/countries-neighbors.json').then(r=>r.json()) // adjacency list
```

### Core functions (adapted from find-country-complete.js)

Copy/adapt these — they have no quiz dependency:
- `proj([lon, lat])` — equirectangular projection (same constants MAP_W=600, MAP_H=320)
- `coordsFromFeature(f)` — GeoJSON → projected path arrays
- `getCSSVar(name)` — reads CSS custom properties
- `pointInPolygon(x, y, polygon)` — ray-casting hit test
- `drawCountry(paths, offsetX, fill, stroke, strokeWidth)` — canvas draw
- `drawWorldMap()` — full redraw loop with hover highlight
- Pan/zoom state + event handlers (wheel, pointerdown/move/up, touch pinch)
- `checkClickedCountry(canvasX, canvasY)` — simplified (no targetCountry, no quiz micro-country logic)

### Capital dots

Build a lookup: `isoA2 → {x, y}` (projected canvas coordinates) from `places.geojson`.

Matching capitals to countries: use `ISO_A2` field from both GeoJSON features and `places.geojson`. France/Norway: use `ISO_A2_EH` from the GeoJSON feature properties.

Render in `drawWorldMap()` after all country polygons:
```js
for each capital dot:
  ctx.beginPath()
  ctx.arc(px, py, 2.5 / zoom * dpr, 0, 2*Math.PI)  // size stays ~2.5px screen regardless of zoom
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'
  ctx.lineWidth = 0.8
  ctx.fill(); ctx.stroke()
```

When `zoom >= 3`: also draw the capital name as small text next to the dot.

### Hover → info panel

On `pointermove`, run `checkClickedCountry()`. When hovered country changes, call `updateInfoPanel(dataName)`.

`updateInfoPanel(dataName)`:
1. Resolve GeoJSON props via `geoPropsMap` (SUBREGION, CONTINENT, POP_EST, ISO_A2/ISO_A2_EH)
2. Resolve flag ISO2 from `countriesFlags[dataName]`
3. Resolve capitals from `window.DATA`
4. Resolve neighbors from `neighborsData[dataName]`
5. Build and inject HTML into `#study-info`, make it visible

Panel HTML structure:
```html
<div class="study-info-header">
  <img class="study-info-flag" src="img/flags/{iso2}.svg" alt="">
  <div>
    <div class="study-info-name">{Country Name}</div>
    <div class="study-info-region">{SUBREGION or CONTINENT}</div>
  </div>
</div>
<div class="study-info-divider"></div>
<div class="study-info-rows">
  <div class="study-info-row"><span>Capital</span><span>{capital}</span></div>
  <div class="study-info-row"><span>Population</span><span>~{N} million</span></div>
  <div class="study-info-row"><span>Borders</span><span>{neighbor list or "Island nation"}</span></div>
</div>
```

Panel is hidden (`display:none`) until first hover. When pointer leaves the canvas, panel is hidden again.

### CSS for info panel

Add inline `<style>` in `study.html` (or could go in styles.css — inline is simpler for a new standalone page):

- `#study-info`: `position: absolute; bottom: 12px; left: 12px; z-index: 10; background: var(--panel-bg); border: 1px solid var(--panel-border); border-radius: 12px; padding: 14px 16px; min-width: 220px; max-width: 280px; display: none;`
- `.study-info-header`: `display: flex; gap: 10px; align-items: center; margin-bottom: 10px;`
- `.study-info-flag`: `height: 32px; border-radius: 3px; box-shadow: 0 1px 4px rgba(0,0,0,0.3);`
- `.study-info-name`: `font-size: 16px; font-weight: 700;`
- `.study-info-region`: `font-size: 12px; color: var(--text-muted);`
- `.study-info-divider`: `height: 1px; background: var(--hr-color); margin: 8px 0;`
- `.study-info-row`: `display: flex; justify-content: space-between; gap: 8px; font-size: 13px; padding: 3px 0; color: var(--text-muted);`
- `.study-info-row span:last-child`: `color: var(--text-primary); text-align: right; max-width: 160px;`

The `.mapwrap` needs `position: relative` (already set in styles.css).

---

## index.html card

Add after the existing Capital Pairs card, using the same `.glass-card` pattern:

```html
<a href="study.html" class="glass-card">
  <div class="card-content">
    <div class="game-icon">📖</div>
    <div class="card-title">Study Mode</div>
    <div class="card-description">Explore the world map. Hover over any country to see its flag, capital, and geography.</div>
    <div class="play-button">Explore →</div>
  </div>
</a>
```

---

## Verification

1. `python3 -m http.server 8080`
2. Open `http://localhost:8080` — confirm "Study Mode" card is visible in the grid
3. Click "Explore →" → `study.html` loads with the world map
4. Hover over several countries — info panel appears showing flag, capital, region, population, borders
5. Hover over France/Norway — confirm flag loads (these use `ISO_A2_EH` fallback)
6. Verify capital dots are visible as small white dots on the map
7. Zoom in (scroll wheel) → capital dots stay consistent size; at high zoom, capital name labels appear
8. Pan the map by dragging — map scrolls smoothly
9. Test on mobile (touch pan + pinch zoom)
10. Toggle dark/light mode — info panel respects CSS variables
