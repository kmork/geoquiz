# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GeoQuiz is a browser-based geography quiz app with 15 standalone games, a Daily Challenge, and a Study Mode. Live at geoquiz.info.

**Stack:** Vanilla JavaScript (ES6 modules), HTML5, CSS3. No frameworks, no build system, no package manager.

## Running Locally

A web server is required (ES6 modules don't work over `file://`):

```bash
python3 -m http.server 8080
# or: npx http-server -p 8080
```

Then open `http://localhost:8080`.

## Data Processing Commands

```bash
# Regenerate cleaned route map data (removes overseas territories)
node process-countries.js

# Compress GeoJSON after modifications
cd data/ && gzip -9 -k ne_10m_admin_0_countries.geojson
cd data/ && gzip -9 -k ne_10m_admin_0_countries_route.geojson

# Optimize heritage images
cd img/heritage/ && sips --resampleWidth 1920 --setProperty formatOptions 85 *.jpg
```

## Architecture

### Game Module Pattern

Each game follows a three-layer separation:

1. **Logic** (`js/games/<game>-logic.js`) — Pure game logic, no DOM access. Exported as classes.
2. **UI/Renderer** (`js/ui-components/<game>-ui.js` or `<game>-renderer.js`) — DOM/SVG/Canvas rendering.
3. **Main** (`js/<game>-main.js`) — Entry point that wires logic + UI together. Loaded by HTML pages via `<script type="module">`.

Some games also have a **Complete** file (`js/<game>-complete.js`) that serves as the factory wiring logic + rendering, with the main file handling URL params and data loading.

This separation allows games to be reused inside the Daily Challenge without UI duplication.

### Country Data

- `data/countries.json` — 233 entries: 194 UN members (`un: true`) + 39 territories (`un: false`)
- Fields per entry: `country`, `capitals`, `continent`, `flagCode`, `neighbors`, `un`, optionally `cities`
- `js/data.js` fetches countries.json and exposes:
  - `window.ALL_COUNTRIES` — full array (233 entries, including territories)
  - `window.DATA` — UN members only (194 entries)
- All game HTML pages load `<script type="module" src="js/data.js">`
- `play.html` fetches `data/countries.json` directly (does not load data.js)
- Games build lookups from DATA, e.g.: `Object.fromEntries(window.DATA.map(c => [c.country, c.flagCode]))`
- Continent filtering: `window.DATA.filter(c => c.continent === param)`

### Country Name Mismatches

`window.DATA` country names differ from GeoJSON ADMIN field for ~11 countries. Key mismatches: "United States" vs "United States of America", "Congo" vs "Republic of the Congo", "Bahamas" vs "The Bahamas", "Vatican City" vs "Vatican", "Eswatini" vs "eSwatini", etc. The `js/aliases.js` module and `buildNameLookups()` in `js/canvas-map-engine.js` handle bidirectional resolution. France and Norway have `ISO_A2 = -99` in GeoJSON; use `ISO_A2_EH` instead.

### Daily Challenge System

- `js/daily-challenge-main.js` orchestrates 7 mini-games in sequence: find, trivia, outlines, heritage, flags, capitals, route
- `js/seeded-random.js` provides deterministic RNG so all players get the same daily game
- `js/daily-challenge-scoring.js` implements a 24-star scoring system (3+2+4+3+3+4+5)
- Games have both standalone HTML pages and embedded daily-challenge modes

### Shared Modules

- `js/data.js` — Loads `countries.json`, sets `window.DATA` and `window.ALL_COUNTRIES`
- `js/canvas-map-engine.js` — Shared canvas world-map engine (used by Find the Country, Rivers & Mountains, Study Mode)
- `js/mobile-autocomplete.js` — Custom autocomplete dropdown (replaces poor native `<datalist>` on mobile)
- `js/aliases.js` — Country name aliases (e.g., "US" → "United States")
- `js/geojson-loader.js` — Loads gzipped GeoJSON using pako.js for client-side decompression
- `js/theme.js` — Dark/light mode toggle via CSS variables and `localStorage`
- `js/confetti.js` — Victory animations
- `js/game-records.js` — Finish screen rendering + localStorage best scores (add game name to `GAME_NAMES` map for new games)
- `js/game-utils.js` / `js/utils.js` — Shared helpers
- `js/map-utils.js` — SVG map projection and bounding box helpers
- `js/map-zoom-pan.js` — Pan/zoom interaction for SVG maps

### Data Files

- `data/countries.json` — Unified country data (233 entries with capitals, continents, flags, neighbors)
- `data/ne_10m_admin_0_countries*.geojson.gz` — Compressed Natural Earth country geometries
- `data/places.geojson` — Capitals and major cities with coordinates
- `data/heritage-sites.json` — UNESCO World Heritage sites with metadata
- `data/rivers.json` — 22 rivers with country lists
- `data/mountain-ranges.json` — 16 mountain ranges with country lists
- `data/trivia.json` — Trivia questions
- `data/country-facts.json` — Country facts for Duel game
- `data/empires.json` — Historical empires (Study mode)

### CSS

- All styles go in CSS files under `css/`: `styles.css` (main/shared), `index.css`, `play.css`, `cards.css`, `daily-challenge.css`, `duel.css`, `study.css`, `menu.css`
- Colors are defined as CSS custom properties on `:root` with overrides on `html.light-mode`. All color references should use these variables.

## Key Conventions

- All `<script>` tags use `type="module"`
- Country name matching uses normalization: lowercase, strip whitespace/hyphens/apostrophes
- Map rendering uses SVG for most games, Canvas for Find the Country and geo-features games (Rivers & Mountains) for performance
- EditorConfig: 2-space indent, UTF-8, LF line endings
- No test framework; testing is manual via browser
- Only external library is pako.js (gzip decompression, vendored at `js/pako.min.js`)

## Rules

- **Styles in CSS files, not HTML.** Do not add `<style>` blocks or inline `style` attributes in HTML files. All styling goes in the appropriate CSS file under `css/`.
- **Use CSS variables for colors.** Never hardcode color values; use the existing custom properties (e.g., `var(--bg-color)`, `var(--text-color)`, `var(--good-color)`, `var(--bad-color)`). This ensures dark/light mode works correctly.

## Creating New Games — Checklist

Follow these steps to avoid recurring mistakes:

1. **Three-layer pattern.** Create `js/games/<game>-logic.js` (pure logic, no DOM), `js/ui-components/<game>-ui.js` or a complete file, and `js/<game>-main.js` (entry point). Never put game logic in the main file.

2. **Register in `GAME_NAMES`.** Add the game to the `GAME_NAMES` map in `js/game-records.js` so the finish screen shows the correct name.

3. **Use `renderFinishScreen()`.** Import from `js/game-records.js` and use the shared finish screen. Pass `gameId`, `score`, `maxScore`, `time`, `accuracy`, and `onPlayAgain`.

4. **Add confetti canvas.** Include `<canvas id="confetti"></canvas>` in the HTML. Import and call `initConfetti('confetti')` for victory animations.

5. **Data loading pattern.** Wait for `window.DATA` in the main file: `while (!window.DATA) await new Promise(r => setTimeout(r, 10));`. The main file is a `type="module"` script with top-level await.

6. **Country name resolution.** When matching `window.DATA` country names against GeoJSON features, use `js/aliases.js` or `buildNameLookups()` from `js/canvas-map-engine.js`. Never assume names match directly.

7. **Continent filtering.** If the game supports it, read `?continent=` from URL params, filter `window.DATA`, and append the continent slug to the `gameIdSuffix` for separate game records.

8. **Add to index.html and play.html.** Add a game card to `index.html` and a game entry to the `GAMES` object in `play.html` (with title, desc, url, icon, difficulties, etc.).

9. **Styles in CSS files.** Add all game-specific styles to `css/styles.css` (or a dedicated CSS file if large). Do not put styles in the HTML.

10. **Test both themes.** Verify the game looks correct in both dark and light mode using CSS variables.
