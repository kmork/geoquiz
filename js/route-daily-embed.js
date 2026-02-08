import { createRouteGame } from "./route-game.js";
import { COUNTRY_ALIASES } from "./aliases.js";
import { loadGeoJSON } from "./geojson-loader.js";
import { RouteRenderer } from "./ui-components/route-renderer.js";
import { attachZoomPan } from "./map-zoom-pan.js";
import { norm } from "./utils.js";

// Match route-main behavior: make aliases global for route-game.js
window.COUNTRY_ALIASES = COUNTRY_ALIASES;

export async function runEmbeddedRouteGame(container, { fixedRound, neighbors, confetti }) {
  const optimalBetween = Math.max(0, (fixedRound?.path?.length || 2) - 2);
  const optimalCountriesText = `${optimalBetween} countr${optimalBetween === 1 ? "y" : "ies"}`;

  container.innerHTML = `
    <div class="daily-embed">
      <div class="card daily-embed-card">
        <div class="muted">
          Find the shortest land route between two countries. Optimal route: <b>${optimalCountriesText}</b>
        </div>

        <div class="hr"></div>

        <div id="route" class="route-display"></div>

        <div class="mapwrap">
          <svg id="map" viewBox="0 0 600 320" width="100%" height="320"></svg>
        </div>

        <div id="hint" class="hint-message" style="display:none"></div>

        <div class="answerRow">
          <input id="answer" list="country-suggestions" placeholder="Type the next country…" autocomplete="off"/>
          <datalist id="country-suggestions"></datalist>
          <button id="submit">Add to Route</button>
          <div class="secondary-buttons">
            <button id="undo" class="btn-secondary" disabled>Undo</button>
            <button id="showHint" class="btn-secondary">Show Hint</button>
            <button id="giveUp" class="btn-secondary">Give Up</button>
          </div>
        </div>

        <div id="status" class="status" style="display:none"></div>
      </div>
    </div>
  `;

  const ui = {
    map: container.querySelector("#map"),
    answerInput: container.querySelector("#answer"),
    submitBtn: container.querySelector("#submit"),
    undoBtn: container.querySelector("#undo"),
    showHintBtn: container.querySelector("#showHint"),
    giveUpBtn: container.querySelector("#giveUp"),
    routeEl: container.querySelector("#route"),
    statusEl: container.querySelector("#status"),
    hintEl: container.querySelector("#hint"),

    // ✅ Not shown in daily UI:
    scoreEl: null,
    optimalHintEl: null,
  };

  const worldData = await loadGeoJSON("data/ne_10m_admin_0_countries_route.geojson.gz");
  const renderer = new RouteRenderer(ui.map, worldData, { aliases: COUNTRY_ALIASES });

  // Track the "content" viewBox that the renderer sets, so zoom limits match the standalone game
  let baseViewBox = { x: 0, y: 0, w: 600, h: 320 };

  function drawCountries(countryList) {
    renderer.drawRoute(countryList);
    // Capture the viewBox after drawing as the new base (same as route-main.js)
    const vb = ui.map.viewBox.baseVal;
    baseViewBox = { x: vb.x, y: vb.y, w: vb.width, h: vb.height };
  }

  const WORLD = worldData.features || [];
  function getCountryFeature(countryName) {
    return WORLD.find((f) => norm(f.properties.ADMIN || "") === norm(countryName));
  }

  // Populate desktop datalist (optional; mobile autocomplete usually replaces it)
  const datalist = container.querySelector("#country-suggestions");
  if (datalist && window.DATA) {
    const countryNames = new Set();
    window.DATA.forEach((item) => item.country && countryNames.add(item.country));
    Object.entries(COUNTRY_ALIASES).forEach(([alias, officialName]) => {
      const isValid = window.DATA.some((item) => norm(item.country) === norm(officialName));
      if (isValid) countryNames.add(alias);
    });

    Array.from(countryNames).sort().forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      datalist.appendChild(opt);
    });
  }

  // Match route-main: remove datalist and use custom autocomplete (if present)
  if (ui.answerInput) {
    ui.answerInput.removeAttribute("list");
    if (typeof window.initMobileAutocomplete === "function" && window.DATA) {
      const suggestions = [];

      window.DATA.forEach((item) => item.country && suggestions.push(item.country));
      Object.entries(COUNTRY_ALIASES).forEach(([alias, officialName]) => {
        const isValid = window.DATA.some((item) => norm(item.country) === norm(officialName));
        if (isValid) suggestions.push(alias);
      });

      const uniqueSuggestions = Array.from(new Set(suggestions)).sort();
      window.initMobileAutocomplete(ui.answerInput, uniqueSuggestions, {
        maxSuggestions: null,
        minChars: 1,
      });
    }
  }

  return await new Promise((resolve) => {
    const game = createRouteGame({
      ui,
      neighbors,
      confetti,
      drawCountries,
      getCountryFeature,
      fixedRound,
      onFinish: (final) => {
        const payload = {
          correct: !!final.correct,
          time: final.time ?? 0,
          timeLimit: null,
          parDiff: typeof final.parDiff === "number" ? final.parDiff : 999,
          usedHint: !!final.usedHint,
        };

        // Give time to see optimal path on give up (daily auto-navigates)
        const delayMs = payload.correct ? 900 : 2800;
        setTimeout(() => resolve(payload), delayMs);
      },
    });

    ui.submitBtn.addEventListener("click", () => {
      const guess = ui.answerInput.value.trim();
      if (guess) game.processGuess(guess);
    });

    ui.answerInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        const guess = ui.answerInput.value.trim();
        if (guess) game.processGuess(guess);
      }
    });

    ui.giveUpBtn.addEventListener("click", () => game.giveUp());
    ui.undoBtn.addEventListener("click", () => game.undo());
    ui.showHintBtn.addEventListener("click", () => game.showHint());

    game.start();

    // Attach shared zoom/pan interactions
    attachZoomPan(ui.map, () => baseViewBox);

    if (!/Mobi|Android/i.test(navigator.userAgent)) ui.answerInput.focus();
  });
}
