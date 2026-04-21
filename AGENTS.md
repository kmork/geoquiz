# Repository Guidelines

## Project Structure & Module Organization
GeoQuiz is a static browser app with root-level HTML entry points such as `index.html`, `play.html`, `daily.html`, and game-specific pages like `flags.html` or `route.html`. Shared JavaScript lives in `js/`, with game rules in `js/games/`, renderers/UI in `js/ui-components/`, and page entry modules like `js/flags-main.js`. Styles live in `css/`. Data files are stored in `data/`, while visual/audio assets live under `img/` and `carmen/`.

## Build, Test, and Development Commands
Run locally through a simple web server because ES modules do not work over `file://`:

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`. Use Node scripts at the repo root for data maintenance, for example:

```bash
node script/process-countries.js
gzip -9 -k data/ne_10m_admin_0_countries.geojson
gzip -9 -k data/ne_10m_admin_0_countries_route.geojson
```

## Coding Style & Naming Conventions
Follow `.editorconfig`: UTF-8, LF endings, 2-space indentation, and trimmed trailing whitespace. Use vanilla ES modules and keep filenames in kebab-case, e.g. `heritage-locate-main.js`. New games should follow the existing three-layer pattern: pure logic in `js/games/`, DOM or canvas UI in `js/ui-components/`, and a small page entry module in `js/`. Keep styles in `css/` files, not inline HTML.

## Testing Guidelines
There is no automated test suite in this repository. Verify changes manually in the browser against the affected pages and flows. Check desktop and mobile layouts, dark theme only, keyboard/touch interactions, and any related daily challenge or continent-filter behavior before opening a PR.

## Carmen Mechanics Documentation
When changing Carmen game mechanics, scoring, campaign progression, Open Cases behavior, suspect deduction, Interpol behavior, clue generation, or other player-facing Carmen rules, keep `carmen/game-mechanic.md` up to date in the same change. To save tokens and avoid re-deriving the game model, consult and cite that file first when Carmen mechanics context is needed.

## Data & Asset Notes
Large generated assets and reference data already live in-repo. When changing map data, keep the compressed `data/*.geojson.gz` files in sync. When adding media, use repository conventions and place files alongside similar assets in `img/`, `img/heritage/`, or `carmen/`.
