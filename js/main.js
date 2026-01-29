import { getUI } from "./ui.js";
import { initConfetti } from "./confetti.js";
import { createMap } from "./map.js";
import { createGame } from "./game.js";
import { attachWikipediaPopup } from "./wiki.js";

const ui = getUI();
const confetti = initConfetti("confetti");

const mapApi = createMap({
  svgEl: ui.map,
  worldUrl: "data/ne_10m_admin_0_countries.geojson",
  placesUrl: "data/places.geojson",
});

await mapApi.load();
mapApi.attachInteractions();

const game = createGame({ ui, mapApi, confetti });
attachWikipediaPopup(ui.elCountry, ()=>game.getCurrent());

game.reset();
game.nextQ();
