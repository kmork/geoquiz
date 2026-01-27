/* ---------------- DATA ---------------- */
const DATA = [
  {"country":"Afghanistan","capitals":["Kabul"]},{"country":"Albania","capitals":["Tirana"]},{"country":"Algeria","capitals":["Algiers"]},{"country":"Andorra","capitals":["Andorra la Vella"]},{"country":"Angola","capitals":["Luanda"]},{"country":"Antigua and Barbuda","capitals":["Saint John's"]},{"country":"Argentina","capitals":["Buenos Aires"]},{"country":"Armenia","capitals":["Yerevan"]},{"country":"Australia","capitals":["Canberra"]},{"country":"Austria","capitals":["Vienna"]},{"country":"Azerbaijan","capitals":["Baku"]},{"country":"Bahamas","capitals":["Nassau"]},{"country":"Bahrain","capitals":["Manama"]},{"country":"Bangladesh","capitals":["Dhaka"]},{"country":"Barbados","capitals":["Bridgetown"]},{"country":"Belarus","capitals":["Minsk"]},{"country":"Belgium","capitals":["Brussels"]},{"country":"Belize","capitals":["Belmopan"]},{"country":"Benin","capitals":["Porto-Novo"]},{"country":"Bhutan","capitals":["Thimphu"]},{"country":"Bolivia","capitals":["Sucre"]},{"country":"Bosnia and Herzegovina","capitals":["Sarajevo"]},{"country":"Botswana","capitals":["Gaborone"]},{"country":"Brazil","capitals":["Brasília"]},{"country":"Brunei","capitals":["Bandar Seri Begawan"]},{"country":"Bulgaria","capitals":["Sofia"]},{"country":"Burkina Faso","capitals":["Ouagadougou"]},{"country":"Burundi","capitals":["Gitega"]},{"country":"Cambodia","capitals":["Phnom Penh"]},{"country":"Cameroon","capitals":["Yaoundé"]},{"country":"Canada","capitals":["Ottawa"]},{"country":"Central African Republic","capitals":["Bangui"]},{"country":"Chad","capitals":["N'Djamena"]},{"country":"Chile","capitals":["Santiago"]},{"country":"China","capitals":["Beijing"]},{"country":"Colombia","capitals":["Bogotá"]},{"country":"Comoros","capitals":["Moroni"]},{"country":"Congo","capitals":["Brazzaville"]},{"country":"Costa Rica","capitals":["San José"]},{"country":"Croatia","capitals":["Zagreb"]},{"country":"Cuba","capitals":["Havana"]},{"country":"Cyprus","capitals":["Nicosia"]},{"country":"Czechia","capitals":["Prague"]},{"country":"Denmark","capitals":["Copenhagen"]},{"country":"Dominican Republic","capitals":["Santo Domingo"]},{"country":"Egypt","capitals":["Cairo"]},{"country":"Estonia","capitals":["Tallinn"]},{"country":"Finland","capitals":["Helsinki"]},{"country":"France","capitals":["Paris"]},{"country":"Germany","capitals":["Berlin"]},{"country":"Greece","capitals":["Athens"]},{"country":"Hungary","capitals":["Budapest"]},{"country":"Iceland","capitals":["Reykjavík"]},{"country":"India","capitals":["New Delhi"]},{"country":"Indonesia","capitals":["Jakarta"]},{"country":"Iran","capitals":["Tehran"]},{"country":"Iraq","capitals":["Baghdad"]},{"country":"Ireland","capitals":["Dublin"]},{"country":"Israel","capitals":["Jerusalem"]},{"country":"Italy","capitals":["Rome"]},{"country":"Japan","capitals":["Tokyo"]},{"country":"Kenya","capitals":["Nairobi"]},{"country":"Luxembourg","capitals":["Luxembourg"]},{"country":"Mexico","capitals":["Mexico City"]},{"country":"Netherlands","capitals":["Amsterdam"]},{"country":"New Zealand","capitals":["Wellington"]},{"country":"Nigeria","capitals":["Abuja"]},{"country":"Norway","capitals":["Oslo"]},{"country":"Pakistan","capitals":["Islamabad"]},{"country":"Peru","capitals":["Lima"]},{"country":"Philippines","capitals":["Manila"]},{"country":"Poland","capitals":["Warsaw"]},{"country":"Portugal","capitals":["Lisbon"]},{"country":"Qatar","capitals":["Doha"]},{"country":"Romania","capitals":["Bucharest"]},{"country":"Russia","capitals":["Moscow"]},{"country":"Saudi Arabia","capitals":["Riyadh"]},{"country":"South Africa","capitals":["Pretoria"]},{"country":"South Korea","capitals":["Seoul"]},{"country":"Spain","capitals":["Madrid"]},{"country":"Sweden","capitals":["Stockholm"]},{"country":"Switzerland","capitals":["Bern"]},{"country":"Thailand","capitals":["Bangkok"]},{"country":"Turkey","capitals":["Ankara"]},{"country":"Ukraine","capitals":["Kyiv"]},{"country":"United Kingdom","capitals":["London"]},{"country":"United States","capitals":["Washington, D.C."]},{"country":"Vietnam","capitals":["Hanoi"]},{"country":"Zimbabwe","capitals":["Harare"]}
];

/* ---------------- NORMALIZATION ---------------- */
const strip = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const norm = s => strip(String(s).toLowerCase()).replace(/[^a-z ]/g," ").replace(/\s+/g," ").trim();

/* ---------------- ELEMENTS ---------------- */
const elCountry = document.getElementById("countryName");
const elStatus  = document.getElementById("status");
const elChoices = document.getElementById("choices");

const answer  = document.getElementById("answer");
const submit  = document.getElementById("submit");
const skip    = document.getElementById("skip");
const next    = document.getElementById("next");

const scoreEl  = document.getElementById("score");
const roundsEl = document.getElementById("rounds");

const map = document.getElementById("map");

// ---- Disable iOS Safari rotate/pinch "gesture" events ----
["gesturestart","gesturechange","gestureend"].forEach(type => {
  map.addEventListener(type, (e) => e.preventDefault(), { passive:false });
});

/* ---------------- MAP DATA ---------------- */
const MAP_W=600, MAP_H=320;
let WORLD=null, CAPITALS=null, WORLD_PATHS=null;

// viewBox state for zoom/pan (mouse + touch)
let currentViewBox = {x:0, y:0, w:600, h:320};
function setViewBox(x,y,w,h){
  currentViewBox = {x,y,w,h};
  map.setAttribute("viewBox", `${x} ${y} ${w} ${h}`);
}

// ---- Zoom limits (relative to the country auto-zoom viewBox) ----
const ZOOM_MIN_FACTOR = 0.35; // max zoom-in: 35% of base width
const ZOOM_MAX_FACTOR = 7.00; // max zoom-out: 500% of base width
let baseViewBox = null; // set in drawMap() each new country


function clampCandidateToZoomLimits(candidate){
  if (!baseViewBox) return candidate;


  const aspect = candidate.h / candidate.w; // keep current aspect


  const minW = baseViewBox.w * ZOOM_MIN_FACTOR;
  const maxW = baseViewBox.w * ZOOM_MAX_FACTOR;


  let w = candidate.w;
  if (w < minW) w = minW;
  if (w > maxW) w = maxW;


  const h = w * aspect;


  const cx = candidate.x + candidate.w/2;
  const cy = candidate.y + candidate.h/2;


  return { x: cx - w/2, y: cy - h/2, w, h };
}

function proj([lon,lat]) {
  return [((lon+180)/360)*MAP_W, ((90-lat)/180)*MAP_H];
}

async function loadMap(){
  const w = await (await fetch("countries.geojson")).json();
  WORLD = w.features;

  const p = await (await fetch("places.geojson")).json();
  CAPITALS = new Map();
  for(const f of p.features){
    if(!(f.properties.FEATURECLA||"").includes("capital")) continue;
    const c = norm(f.properties.ADM0NAME||"");
    if(!CAPITALS.has(c)) CAPITALS.set(c,[]);
    CAPITALS.get(c).push({name:f.properties.NAME,lon:+f.properties.LONGITUDE,lat:+f.properties.LATITUDE});
  }

  WORLD_PATHS = WORLD.map(f => pathFromFeature(f)).filter(Boolean);
}

function bboxOfFeature(f){
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  const rings = f.geometry.type==="Polygon"
    ? [f.geometry.coordinates]
    : f.geometry.coordinates;

  for(const poly of rings){
    for(const ring of poly){
      for(const [lon,lat] of ring){
        if(lon<minX) minX=lon;
        if(lat<minY) minY=lat;
        if(lon>maxX) maxX=lon;
        if(lat>maxY) maxY=lat;
      }
    }
  }
  return {minX,minY,maxX,maxY};
}

function padBBox(bb, padRatio=0.18){
  const dx = bb.maxX - bb.minX;
  const dy = bb.maxY - bb.minY;
  return {
    minX: bb.minX - dx*padRatio,
    maxX: bb.maxX + dx*padRatio,
    minY: bb.minY - dy*padRatio,
    maxY: bb.maxY + dy*padRatio
  };
}

function pathFromFeature(f){
  if(!f.geometry) return "";
  const rings = f.geometry.type==="Polygon"? [f.geometry.coordinates] : f.geometry.coordinates;
  let d="";
  for(const poly of rings){
    for(const ring of poly){
      ring.forEach((pt,i)=>{
        const [x,y]=proj(pt);
        d += (i?"L":"M")+x.toFixed(2)+" "+y.toFixed(2)+" ";
      });
      d+="Z ";
    }
  }
  return d.trim();
}

function svgUnitsPerPx(svg){
  const vb = svg.viewBox.baseVal;
  const pxW = svg.clientWidth || 600;
  return vb.width / pxW;
}

function drawMap(country, showDot){
  map.innerHTML="";

  if(!WORLD || !WORLD_PATHS){
    map.innerHTML = `<text x="20" y="30" fill="rgba(232,236,255,.7)">Loading map…</text>`;
    setViewBox(0,0,600,320);
    return;
  }

  const hits = WORLD.filter(f => norm(f.properties.ADMIN||"") === norm(country));
  if(!hits.length){
    map.innerHTML = `<text x="20" y="30" fill="rgba(232,236,255,.7)">No outline found</text>`;
    setViewBox(0,0,600,320);
    return;
  }

  // country bbox -> projected viewBox
  let bb = bboxOfFeature(hits[0]);
  for(let i=1;i<hits.length;i++){
    const b = bboxOfFeature(hits[i]);
    bb = {
      minX: Math.min(bb.minX,b.minX),
      minY: Math.min(bb.minY,b.minY),
      maxX: Math.max(bb.maxX,b.maxX),
      maxY: Math.max(bb.maxY,b.maxY),
    };
  }
  bb = padBBox(bb);

  const [x1,y1] = proj([bb.minX, bb.maxY]);
  const [x2,y2] = proj([bb.maxX, bb.minY]);

  const w = (x2 - x1);
  const h = (y2 - y1);

  // base viewbox for zoom limits (per country)
  baseViewBox = { x: x1, y: y1, w, h };

  setViewBox(x1, y1, w, h);

  // world backdrop
  for(const d of WORLD_PATHS){
    const p=document.createElementNS("http://www.w3.org/2000/svg","path");
    p.setAttribute("d",d);
    p.setAttribute("stroke","rgba(232,236,255,.12)");
    p.setAttribute("stroke-width","0.4");
    p.setAttribute("fill","none");
    p.setAttribute("vector-effect","non-scaling-stroke");
    map.appendChild(p);
  }

  // highlighted country
  for(const f of hits){
    const p=document.createElementNS("http://www.w3.org/2000/svg","path");
    p.setAttribute("d",pathFromFeature(f));
    p.setAttribute("stroke","rgba(232,236,255,.95)");
    p.setAttribute("stroke-width","0.8");
    p.setAttribute("fill","rgba(165,180,252,.18)");
    p.setAttribute("vector-effect","non-scaling-stroke");
    map.appendChild(p);
  }

  // capital dot (px-sized)
  if(showDot && CAPITALS){
    const list = CAPITALS.get(norm(country));
    if(list && list[0]){
      const [x,y] = proj([list[0].lon,list[0].lat]);
      const upp = svgUnitsPerPx(map);
      const r = 4.5 * upp; // ~4.5px radius on screen

      const c = document.createElementNS("http://www.w3.org/2000/svg","circle");
      c.setAttribute("cx", x);
      c.setAttribute("cy", y);
      c.setAttribute("r", r);
      c.setAttribute("fill", "#6ee7b7");
      c.setAttribute("stroke", "rgba(232,236,255,.9)");
      c.setAttribute("stroke-width", "0.9");
      c.setAttribute("vector-effect","non-scaling-stroke");
      map.appendChild(c);
    }
  }
}

/* ---------------- ZOOM (wheel + touch pinch/pan) ---------------- */

// wheel zoom (desktop/trackpad)
map.addEventListener("wheel", (e) => {
  e.preventDefault();
  const factor = e.deltaY > 0 ? 1.15 : 0.87;
  zoomAtClientPoint(factor, e.clientX, e.clientY);
}, { passive:false });

function zoomAtClientPointFrom(vb, factor, clientX, clientY){
  const rect = map.getBoundingClientRect();

  const mx = vb.x + (clientX - rect.left) * (vb.w / rect.width);
  const my = vb.y + (clientY - rect.top) * (vb.h / rect.height);

  const rx = (mx - vb.x) / vb.w;
  const ry = (my - vb.y) / vb.h;

  const nw = vb.w * factor;
  const nh = vb.h * factor;

  const candidate = {
    x: mx - rx * nw,
    y: my - ry * nh,
    w: nw,
    h: nh
  };

  const clamped = clampCandidateToZoomLimits(candidate);
  setViewBox(clamped.x, clamped.y, clamped.w, clamped.h);
}

function zoomAtClientPoint(factor, clientX, clientY){
  zoomAtClientPointFrom(currentViewBox, factor, clientX, clientY);
}

// Pointer Events pinch zoom + pan (mobile)
const pointers = new Map();
let startView = null;
let startDist = 0;
let startMidClient = null;
let panStartClient = null;

function dist(a,b){ return Math.hypot(a.x-b.x, a.y-b.y); }
function mid(a,b){ return {x:(a.x+b.x)/2, y:(a.y+b.y)/2}; }

map.addEventListener("pointerdown", (e) => {
  map.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, {x:e.clientX, y:e.clientY});

  if (pointers.size === 1){
    startView = {...currentViewBox};
    panStartClient = {x:e.clientX, y:e.clientY};
    startDist = 0;
    startMidClient = null;
  } else if (pointers.size === 2){
    const pts = [...pointers.values()];
    startDist = dist(pts[0], pts[1]);
    startMidClient = mid(pts[0], pts[1]);
    startView = {...currentViewBox};
    panStartClient = null;
  }
}, {passive:false});

map.addEventListener("pointermove", (e) => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, {x:e.clientX, y:e.clientY});
  if (!startView) return;

  // one-finger pan
  if (pointers.size === 1 && panStartClient){
    const p = [...pointers.values()][0];
    const dxClient = p.x - panStartClient.x;
    const dyClient = p.y - panStartClient.y;

    const rect = map.getBoundingClientRect();
    const dx = -dxClient * (startView.w / rect.width);
    const dy = -dyClient * (startView.h / rect.height);

    setViewBox(startView.x + dx, startView.y + dy, startView.w, startView.h);
    return;
  }

  // two-finger pinch zoom (+ pan)
  if (pointers.size === 2){
    const pts = [...pointers.values()];
    const distNow = dist(pts[0], pts[1]);
    if (!startDist) return;

    const scale = distNow / startDist; // >1 fingers apart => zoom in
    const factor = 1 / scale; // viewbox factor

    const midNow = mid(pts[0], pts[1]);

    // IMPORTANT: always zoom relative to the viewBox at pinch start
    zoomAtClientPointFrom(startView, factor, midNow.x, midNow.y);
  }
}, {passive:false});

map.addEventListener("pointerup", (e) => {
  pointers.delete(e.pointerId);

  if (pointers.size === 1){
    const p = [...pointers.values()][0];
    startView = {...currentViewBox};
    panStartClient = {x:p.x, y:p.y};
    startDist = 0;
    startMidClient = null;
  } else if (pointers.size === 0){
    startView = null;
    panStartClient = null;
    startDist = 0;
    startMidClient = null;
  }
});

map.addEventListener("pointercancel", () => {
  pointers.clear();
  startView = null;
  panStartClient = null;
  startDist = 0;
  startMidClient = null;
});

/* ---------------- GAME ---------------- */

let current=null, score=0, rounds=0;
let enterLock = false;

function doPrimaryAction(){
  if (next.style.display !== "none") next.click();
  else submit.click();
}

// Enter handling (single action per press)
answer.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  e.stopPropagation();
  if (enterLock || e.repeat) return;
  enterLock = true;
  doPrimaryAction();
});
answer.addEventListener("keyup", (e) => {
  if (e.key === "Enter") enterLock = false;
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  if (document.activeElement === answer) return;
  e.preventDefault();
  e.stopPropagation();
  if (enterLock || e.repeat) return;
  enterLock = true;
  doPrimaryAction();
});
document.addEventListener("keyup", (e) => {
  if (e.key === "Enter") enterLock = false;
});

function nextQ(){
  current = DATA[Math.floor(Math.random()*DATA.length)];
  elCountry.textContent = current.country;

  answer.value = "";
  answer.disabled = false;

  submit.disabled = false;
  skip.disabled = false;

  next.style.display = "none";

  elChoices.style.display = "none";
  elChoices.innerHTML = "";

  elStatus.className = "status";
  elStatus.textContent = "";

  drawMap(current.country,false);
  answer.focus();
}

// pointsAwarded: 2 = first try correct, 1 = multiple-choice correct, 0 otherwise
function reveal(ok, pointsAwarded){
  rounds++;
  roundsEl.textContent = rounds;

  // lock input after round ends
  answer.disabled = true;

  // disable any remaining alternative buttons
  if (elChoices) {
    const btns = elChoices.querySelectorAll("button");
    btns.forEach(b => b.disabled = true);
  }

  if(ok){
    score += pointsAwarded;
    scoreEl.textContent = score;
  }

  elStatus.className = "status " + (ok ? "good" : "bad");
  elStatus.innerHTML =
    (ok ? `✅ Correct! (+${pointsAwarded}) ` : "❌ Wrong. ") +
    "Capital: <b>" + current.capitals.join(", ") + "</b>";

  submit.disabled = true;
  skip.disabled = true;

  next.style.display = "inline-block";
  next.focus();

  drawMap(current.country,true);
}

submit.onclick = () => {
  const ok = norm(answer.value) === norm(current.capitals[0]);
  if(ok) reveal(true, 2); // first try = 2 points
  else showMC();          // second chance = multiple-choice only
};

skip.onclick = () => {
  rounds++;
  roundsEl.textContent = rounds;

  answer.disabled = true;

  elStatus.className = "status";
  elStatus.innerHTML = "⏭️ Skipped. Capital: <b>" + current.capitals.join(", ") + "</b>";

  submit.disabled = true;
  skip.disabled = true;

  next.style.display = "inline-block";
  next.focus();

  drawMap(current.country,true);
};

function showMC(){
  // lock typing + submit while choices are visible
  answer.disabled = true;
  submit.disabled = true;

  elStatus.className = "status bad";
  elStatus.textContent = "❌ Not quite. Second chance: choose the correct capital.";

  elChoices.style.display = "grid";
  elChoices.innerHTML = "";

  let opts = [current.capitals[0]];
  while(opts.length < 4){
    let c = DATA[Math.floor(Math.random()*DATA.length)].capitals[0];
    if(!opts.includes(c)) opts.push(c);
  }
  opts.sort(()=>Math.random()-.5);

  opts.forEach(o=>{
    const b = document.createElement("button");
    b.textContent = o;
    b.onclick = () => reveal(o === current.capitals[0], o === current.capitals[0] ? 1 : 0);
    elChoices.appendChild(b);
  });
}

next.onclick = nextQ;

// init
loadMap().then(nextQ).catch(err => {
  console.error(err);
  elStatus.className = "status bad";
  elStatus.textContent = "❌ Couldn’t load map files (countries.geojson / places.geojson). Quiz still works, but map may be blank.";
  nextQ();
});
