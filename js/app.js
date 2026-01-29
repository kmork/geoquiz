/* ---------------- DATA ---------------- */
const DATA = window.DATA;
if (!Array.isArray(DATA) || DATA.length < 150) {
  console.warn("DATA looks incomplete. DATA.length =", DATA?.length);
}

/* ---------------- NORMALIZATION ---------------- */
const strip = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const norm = s =>
  strip(String(s).toLowerCase())
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/* ---------------- ELEMENTS ---------------- */
const elCountry = document.getElementById("countryName");
const elChoices = document.getElementById("choices");

const answer = document.getElementById("answer");
const submit = document.getElementById("submit");
const next   = document.getElementById("next");

const scoreEl    = document.getElementById("score");
const progressEl = document.getElementById("progress");

const map = document.getElementById("map");

// Final overlay (optional, but supported)
const finalOverlay   = document.getElementById("finalOverlay");
const finalSubtitle  = document.getElementById("finalSubtitle");
const finalScore     = document.getElementById("finalScore");
const finalCountries = document.getElementById("finalCountries");
const finalCorrect   = document.getElementById("finalCorrect");
const finalFirstTry  = document.getElementById("finalFirstTry");
const playAgainBtn   = document.getElementById("playAgain");
const closeFinalBtn  = document.getElementById("closeFinal");

/* ---------------- CONFETTI ---------------- */
const confettiCanvas = document.getElementById("confetti");
const cctx = confettiCanvas.getContext("2d");
let confettiPieces = [];
let confettiRAF = null;


function resizeConfetti(){
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  confettiCanvas.width = Math.floor(window.innerWidth * dpr);
  confettiCanvas.height = Math.floor(window.innerHeight * dpr);
  confettiCanvas.style.width = window.innerWidth + "px";
  confettiCanvas.style.height = window.innerHeight + "px";
  cctx.setTransform(dpr,0,0,dpr,0,0);
}
window.addEventListener("resize", resizeConfetti, {passive:true});
resizeConfetti();


function confettiBurst({
                         x = window.innerWidth * 0.5,
                         y = window.innerHeight * 0.5,
                         count = 120,
                         spread = Math.PI * 0.9,
                         startAngle = -Math.PI / 2,
                         gravity = 1200,
                         duration = 1100
                       } = {}){
  const now = performance.now();
  const end = now + duration;


// colors similar vibe to your UI
  const colors = ["#6ee7b7","#a5b4fc","#e8ecff","#fda4af","#fde68a"];


  for(let i=0;i<count;i++){
    const a = startAngle + (Math.random() - 0.5) * spread;
    const v = 550 + Math.random()*650;
    const size = 4 + Math.random()*5;


    confettiPieces.push({
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      g: gravity * (0.75 + Math.random()*0.6),
      size,
      rot: Math.random()*Math.PI,
      vr: (Math.random()-0.5)*14,
      lifeEnd: end,
      color: colors[(Math.random()*colors.length)|0],
      shape: Math.random() < 0.15 ? "circle" : "rect"
    });
  }


  if(!confettiRAF) confettiRAF = requestAnimationFrame(tickConfetti);
}


function tickConfetti(t){
  cctx.clearRect(0,0,confettiCanvas.width, confettiCanvas.height);

  const dt = 1/60;

  // update + draw
  const alive = [];
  for(const p of confettiPieces){
    if(t > p.lifeEnd) continue;

    p.vy += p.g * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;

  // simple fade near end
    const fade = Math.max(0, Math.min(1, (p.lifeEnd - t) / 250));
    cctx.globalAlpha = fade;

    cctx.save();
    cctx.translate(p.x, p.y);
    cctx.rotate(p.rot);
    cctx.fillStyle = p.color;

    if(p.shape === "circle"){
      cctx.beginPath();
      cctx.arc(0,0,p.size*0.55,0,Math.PI*2);
      cctx.fill();
    }else{
      cctx.fillRect(-p.size/2, -p.size/2, p.size, p.size*0.6);
    }
    cctx.restore();

    alive.push(p);
  }
  cctx.globalAlpha = 1;

  confettiPieces = alive;

  if(confettiPieces.length){
    confettiRAF = requestAnimationFrame(tickConfetti);
  }else{
    confettiRAF = null;
    cctx.clearRect(0,0,confettiCanvas.width, confettiCanvas.height);
  }
}

elCountry.addEventListener("click", () => {
  if (!current) return;

  // Build Wikipedia URL (encode safely)
  const name = current.country;
  const url = "https://en.wikipedia.org/wiki/" + encodeURIComponent(name.replace(/ /g, "_"));

  // Open centered popup window
  const w = Math.min(900, window.innerWidth * 0.9);
  const h = Math.min(700, window.innerHeight * 0.9);
  const left = window.screenX + (window.outerWidth - w) / 2;
  const top = window.screenY + (window.outerHeight - h) / 2;

  window.open(
    url,
    "_blank",
    `noopener,noreferrer,width=${w},height=${h},left=${left},top=${top}`
  );
});

/* ---------------- MAP DATA ---------------- */
const MAP_W = 600, MAP_H = 320;
let WORLD = null, CAPITALS = null, WORLD_PATHS = null;

// Disable iOS Safari rotate/pinch "gesture" events (prevents rotate)
["gesturestart", "gesturechange", "gestureend"].forEach(type => {
  map?.addEventListener(type, (e) => e.preventDefault(), { passive: false });
});

// viewBox state for zoom/pan
let currentViewBox = { x: 0, y: 0, w: 600, h: 320 };
function setViewBox(x, y, w, h) {
  currentViewBox = { x, y, w, h };
  map.setAttribute("viewBox", `${x} ${y} ${w} ${h}`);
}

// Zoom limits relative to the per-country base viewBox
const ZOOM_MIN_FACTOR = 0.35; // max zoom-in
const ZOOM_MAX_FACTOR = 7.00; // max zoom-out
let baseViewBox = null;

function clampCandidateToZoomLimits(candidate) {
  if (!baseViewBox) return candidate;

  const aspect = candidate.h / candidate.w;
  const minW = baseViewBox.w * ZOOM_MIN_FACTOR;
  const maxW = baseViewBox.w * ZOOM_MAX_FACTOR;

  let w = candidate.w;
  if (w < minW) w = minW;
  if (w > maxW) w = maxW;

  const h = w * aspect;

  const cx = candidate.x + candidate.w / 2;
  const cy = candidate.y + candidate.h / 2;

  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

function proj([lon, lat]) {
  return [((lon + 180) / 360) * MAP_W, ((90 - lat) / 180) * MAP_H];
}

async function loadMap() {
  const w = await (await fetch("countries.geojson")).json();
  WORLD = w.features;

  const p = await (await fetch("places.geojson")).json();
  CAPITALS = new Map();
  for (const f of p.features) {
    if (!(f.properties.FEATURECLA || "").includes("capital")) continue;
    const c = norm(f.properties.ADM0NAME || "");
    if (!CAPITALS.has(c)) CAPITALS.set(c, []);
    CAPITALS.get(c).push({
      name: f.properties.NAME,
      lon: +f.properties.LONGITUDE,
      lat: +f.properties.LATITUDE,
    });
  }

  WORLD_PATHS = WORLD.map(f => pathFromFeature(f)).filter(Boolean);
}

function bboxOfFeature(f) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const rings = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;

  for (const poly of rings) {
    for (const ring of poly) {
      for (const [lon, lat] of ring) {
        if (lon < minX) minX = lon;
        if (lat < minY) minY = lat;
        if (lon > maxX) maxX = lon;
        if (lat > maxY) maxY = lat;
      }
    }
  }
  return { minX, minY, maxX, maxY };
}

function padBBox(bb, padRatio = 0.18) {
  const dx = bb.maxX - bb.minX;
  const dy = bb.maxY - bb.minY;
  return {
    minX: bb.minX - dx * padRatio,
    maxX: bb.maxX + dx * padRatio,
    minY: bb.minY - dy * padRatio,
    maxY: bb.maxY + dy * padRatio,
  };
}

function pathFromFeature(f) {
  if (!f.geometry) return "";
  const rings = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  let d = "";
  for (const poly of rings) {
    for (const ring of poly) {
      ring.forEach((pt, i) => {
        const [x, y] = proj(pt);
        d += (i ? "L" : "M") + x.toFixed(2) + " " + y.toFixed(2) + " ";
      });
      d += "Z ";
    }
  }
  return d.trim();
}

function svgUnitsPerPx(svg) {
  const vb = svg.viewBox.baseVal;
  const pxW = svg.clientWidth || 600;
  return vb.width / pxW;
}

function drawMap(country, showDot) {
  map.innerHTML = "";

  if (!WORLD || !WORLD_PATHS) {
    map.innerHTML = `<text x="20" y="30" fill="rgba(232,236,255,.7)">Loading map…</text>`;
    setViewBox(0, 0, 600, 320);
    return;
  }

  const hits = WORLD.filter(f => norm(f.properties.ADMIN || "") === norm(country));
  if (!hits.length) {
    map.innerHTML = `<text x="20" y="30" fill="rgba(232,236,255,.7)">No outline found</text>`;
    setViewBox(0, 0, 600, 320);
    return;
  }

  // combined bbox -> projected viewBox
  let bb = bboxOfFeature(hits[0]);
  for (let i = 1; i < hits.length; i++) {
    const b = bboxOfFeature(hits[i]);
    bb = {
      minX: Math.min(bb.minX, b.minX),
      minY: Math.min(bb.minY, b.minY),
      maxX: Math.max(bb.maxX, b.maxX),
      maxY: Math.max(bb.maxY, b.maxY),
    };
  }
  bb = padBBox(bb);

  const [x1, y1] = proj([bb.minX, bb.maxY]);
  const [x2, y2] = proj([bb.maxX, bb.minY]);

  const w = (x2 - x1);
  const h = (y2 - y1);

  baseViewBox = { x: x1, y: y1, w, h };
  setViewBox(x1, y1, w, h);

  // world backdrop
  for (const d of WORLD_PATHS) {
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", d);
    p.setAttribute("stroke", "rgba(232,236,255,.12)");
    p.setAttribute("stroke-width", "0.4");
    p.setAttribute("fill", "none");
    p.setAttribute("vector-effect", "non-scaling-stroke");
    map.appendChild(p);
  }

  // highlighted country
  for (const f of hits) {
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", pathFromFeature(f));
    p.setAttribute("stroke", "rgba(232,236,255,.95)");
    p.setAttribute("stroke-width", "0.8");
    p.setAttribute("fill", "rgba(165,180,252,.18)");
    p.setAttribute("vector-effect", "non-scaling-stroke");
    map.appendChild(p);
  }

  // capital dot (px-sized)
  if (showDot && CAPITALS) {
    const list = CAPITALS.get(norm(country));
    if (list && list[0]) {
      const [x, y] = proj([list[0].lon, list[0].lat]);
      const upp = svgUnitsPerPx(map);
      const r = 4.5 * upp; // ~4.5px radius on screen (tweak if you want bigger)

      const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      c.setAttribute("cx", x);
      c.setAttribute("cy", y);
      c.setAttribute("r", r);
      c.setAttribute("fill", "#6ee7b7");
      c.setAttribute("stroke", "rgba(232,236,255,.9)");
      c.setAttribute("stroke-width", "0.9");
      c.setAttribute("vector-effect", "non-scaling-stroke");
      map.appendChild(c);
    }
  }
}

/* ---------------- ZOOM (wheel + touch pinch/pan) ---------------- */
map.addEventListener("wheel", (e) => {
  e.preventDefault();
  const factor = e.deltaY > 0 ? 1.15 : 0.87;
  zoomAtClientPoint(factor, e.clientX, e.clientY);
}, { passive: false });

function zoomAtClientPointFrom(vb, factor, clientX, clientY) {
  const rect = map.getBoundingClientRect();

  const mx = vb.x + (clientX - rect.left) * (vb.w / rect.width);
  const my = vb.y + (clientY - rect.top)  * (vb.h / rect.height);

  const rx = (mx - vb.x) / vb.w;
  const ry = (my - vb.y) / vb.h;

  const nw = vb.w * factor;
  const nh = vb.h * factor;

  const candidate = {
    x: mx - rx * nw,
    y: my - ry * nh,
    w: nw,
    h: nh,
  };

  const clamped = clampCandidateToZoomLimits(candidate);
  setViewBox(clamped.x, clamped.y, clamped.w, clamped.h);
}

function zoomAtClientPoint(factor, clientX, clientY) {
  zoomAtClientPointFrom(currentViewBox, factor, clientX, clientY);
}

// Pointer Events pinch zoom + pan (mobile)
const pointers = new Map();
let startView = null;
let startDist = 0;
let panStartClient = null;

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function mid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }

map.addEventListener("pointerdown", (e) => {
  map.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (pointers.size === 1) {
    startView = { ...currentViewBox };
    panStartClient = { x: e.clientX, y: e.clientY };
    startDist = 0;
  } else if (pointers.size === 2) {
    const pts = [...pointers.values()];
    startDist = dist(pts[0], pts[1]);
    startView = { ...currentViewBox };
    panStartClient = null;
  }
}, { passive: false });

map.addEventListener("pointermove", (e) => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (!startView) return;

  // one-finger pan
  if (pointers.size === 1 && panStartClient) {
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
  if (pointers.size === 2) {
    const pts = [...pointers.values()];
    const distNow = dist(pts[0], pts[1]);
    if (!startDist) return;

    const scale = distNow / startDist; // >1 => zoom in
    const factor = 1 / scale;

    const m = mid(pts[0], pts[1]);
    zoomAtClientPointFrom(startView, factor, m.x, m.y);
  }
}, { passive: false });

map.addEventListener("pointerup", (e) => {
  pointers.delete(e.pointerId);

  if (pointers.size === 1) {
    const p = [...pointers.values()][0];
    startView = { ...currentViewBox };
    panStartClient = { x: p.x, y: p.y };
    startDist = 0;
  } else if (pointers.size === 0) {
    startView = null;
    panStartClient = null;
    startDist = 0;
  }
});

map.addEventListener("pointercancel", () => {
  pointers.clear();
  startView = null;
  panStartClient = null;
  startDist = 0;
});

/* ---------------- NO-REPEATS DECK ---------------- */
let remaining = [];
let totalCountries = DATA.length;

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function resetDeck() {
  remaining = shuffleInPlace([...DATA]);
  totalCountries = DATA.length;
  score = 0;
  correctAny = 0;
  correctFirstTry = 0;

  scoreEl.textContent = "0";
  updateProgress();

  hideFinal();
}

function updateProgress() {
  if (!progressEl) return;
  const asked = totalCountries - remaining.length;
  progressEl.textContent = `${asked} / ${totalCountries}`;
}

/* ---------------- GAME STATE ---------------- */
let current = null;
let score = 0;
let correctAny = 0;
let correctFirstTry = 0;

let enterLock = false;

let roundEnded = false;

function endRound({ ok, pointsAwarded }) {
  // prevent any further interaction
  roundEnded = true;

  answer.disabled = true;
  submit.disabled = true;

  // disable all remaining choice buttons
  elChoices.querySelectorAll("button").forEach(b => b.disabled = true);

  if (ok) {
    correctAny++;
    if (pointsAwarded === 2) correctFirstTry++;
    score += pointsAwarded;
    scoreEl.textContent = String(score);


    // confetti from center of screen
    confettiBurst({ x: window.innerWidth * 0.5, y: window.innerHeight * 0.5 });
  }

  // show capital location
  drawMap(current.country, true);

  // show Next
  next.style.display = "inline-block";
  next.focus();
}

function doPrimaryAction() {
  // If multiple-choice is visible, Enter should NOT jump ahead
  if (elChoices.style.display !== "none") return;

  if (next.style.display !== "none") next.click();
  else submit.click();
}

// Enter handling (one action per press)
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

function lockChoices() {
  const btns = elChoices.querySelectorAll("button");
  btns.forEach(b => (b.disabled = true));
}

function reveal(ok, pointsAwarded) {
  // lock input after round ends
  answer.disabled = true;

  // disable alternatives after reveal (cannot click again)
  lockChoices();

  if (ok) {
    confettiBurst();

    correctAny++;
    if (pointsAwarded === 2) correctFirstTry++;
    score += pointsAwarded;
    scoreEl.textContent = String(score);
  }

  submit.disabled = true;

  next.style.display = "inline-block";
  next.focus();

  drawMap(current.country, true);

  updateProgress();
}

function showMC(){
  if (roundEnded) return;

  // lock typing + submit while choices are visible
  answer.disabled = true;
  submit.disabled = true;

  elChoices.style.display = "grid";
  elChoices.innerHTML = "";

  const correct = current.capitals[0];

  let opts = [correct];
  while (opts.length < 4) {
    const c = DATA[Math.floor(Math.random() * DATA.length)].capitals[0];
    if (!opts.includes(c)) opts.push(c);
  }
  opts.sort(() => Math.random() - 0.5);

  opts.forEach(option => {
    const b = document.createElement("button");
    b.className = "choiceBtn";
    b.textContent = option;

    b.onclick = () => {
      if (roundEnded) return;

      const isCorrect = option === correct;

    // disable all immediately so you can't click twice
      elChoices.querySelectorAll("button").forEach(btn => btn.disabled = true);

    // mark correct answer green
      elChoices.querySelectorAll("button").forEach(btn => {
        if (btn.textContent === correct) btn.classList.add("correct");
      });

    // if wrong pick, mark the selected one red
      if (!isCorrect) b.classList.add("wrong");

      endRound({ ok: isCorrect, pointsAwarded: isCorrect ? 1 : 0 });
    };

    elChoices.appendChild(b);
  });
}

function nextQ() {
  // Done?
  if (!remaining || remaining.length === 0) {
    showFinal();
    return;
  }

  current = remaining.pop();

  elCountry.textContent = current.country;

  roundEnded = false;

  answer.value = "";
  answer.disabled = false;

  submit.disabled = false;

  next.style.display = "none";

  elChoices.style.display = "none";
  elChoices.innerHTML = "";

  drawMap(current.country, false);
  answer.focus();

  updateProgress();
}

submit.onclick = () => {
  if (roundEnded) return;

  const user = norm(answer.value);

  // Blank submit = treat as wrong -> show alternatives
  if (!user) {
    showMC();
    return;
  }

  const ok = user === norm(current.capitals[0]);

  if (ok) {
  // first try correct = 2 points
    endRound({ ok: true, pointsAwarded: 2 });
  } else {
    showMC();
  }
};

next.onclick = nextQ;

/* ---------------- FINAL OVERLAY ---------------- */
function showFinal() {
  elCountry.textContent = "Done!";

  answer.disabled = true;
  submit.disabled = true;
  next.style.display = "none";
  elChoices.style.display = "none";
  elChoices.innerHTML = "";

  if (!finalOverlay) return;

  finalOverlay.style.display = "block";
  if (finalSubtitle)  finalSubtitle.textContent = "Great run!";
  if (finalScore)     finalScore.textContent = String(score);
  if (finalCountries) finalCountries.textContent = String(totalCountries);
  if (finalCorrect)   finalCorrect.textContent = String(correctAny);
  if (finalFirstTry)  finalFirstTry.textContent = String(correctFirstTry);
}

function hideFinal() {
  if (!finalOverlay) return;
  finalOverlay.style.display = "none";
}

playAgainBtn?.addEventListener("click", () => {
  resetDeck();
  nextQ();
});
closeFinalBtn?.addEventListener("click", () => hideFinal());

/* ---------------- INIT ---------------- */
resetDeck();
loadMap()
  .then(() => nextQ())
  .catch(err => {
    console.error(err);
    nextQ();
  });
