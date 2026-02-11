# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GeoQuiz is a browser-based geography quiz app with 7 interactive games (6 standalone + Daily Challenge). Live at geoquiz.info.

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

1. **Logic** (`js/games/<game>-logic.js`) - Pure game logic, no DOM access. Exported as classes.
2. **UI/Renderer** (`js/ui-components/<game>-ui.js` or `<game>-renderer.js`) - DOM/SVG/Canvas rendering.
3. **Main** (`js/<game>-main.js`) - Entry point that wires logic + UI together. Loaded by HTML pages via `<script type="module">`.

This separation allows games to be reused inside the Daily Challenge without UI duplication.

### Daily Challenge System

- `js/daily-challenge-main.js` orchestrates 6 mini-games in sequence
- `js/seeded-random.js` provides deterministic RNG so all players get the same daily game
- `js/daily-challenge-scoring.js` implements a 23-star scoring system
- Games have both standalone HTML pages and embedded daily-challenge modes

### Shared Modules

- `js/mobile-autocomplete.js` - Custom autocomplete dropdown (replaces poor native `<datalist>` on mobile)
- `js/aliases.js` - 76 country name aliases (e.g., "US" -> "United States of America")
- `js/geojson-loader.js` - Loads gzipped GeoJSON using pako.js for client-side decompression
- `js/theme.js` - Dark/light mode toggle via CSS variables and `localStorage`
- `js/confetti.js` - Victory animations
- `js/game-utils.js` / `js/utils.js` - Shared helpers

### Data Files

- `data/ne_10m_admin_0_countries*.geojson.gz` - Compressed Natural Earth country geometries
- `data/countries-neighbors.json` - Pre-computed adjacency graph for Connect the Countries
- `data/heritage-sites.json` - 47 UNESCO sites with metadata
- `data/qa.json` - 120+ trivia questions
- `data/places.geojson` - Capitals and major cities

### CSS Theming

Colors are defined as CSS custom properties on `:root` with overrides on `html.light-mode`. All color references should use these variables.

## Key Conventions

- All `<script>` tags use `type="module"`
- Some shared state lives on `window` (e.g., `window.DATA`, `window.COUNTRY_ALIASES`)
- Country name matching uses normalization: lowercase, strip whitespace/hyphens/apostrophes
- Map rendering uses SVG for most games, Canvas for Find the Country (performance)
- EditorConfig: 2-space indent, UTF-8, LF line endings
- No test framework; testing is manual via browser
- Only external library is pako.js (gzip decompression, vendored at `js/pako.min.js`)
