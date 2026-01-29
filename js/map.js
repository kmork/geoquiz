// map.js
import { norm } from "./utils.js";
import { COUNTRY_ALIASES } from "./aliases.js";

export function createMap({ svgEl, worldUrl, placesUrl }) {
  let WORLD = null,
    PATHS = null,
    CAPITALS = null;

  const MAP_W = 600;
  const MAP_H = 320;

  // ----- projection -----
  const proj = ([lon, lat]) => [((lon + 180) / 360) * MAP_W, ((90 - lat) / 180) * MAP_H];

  function pathFromFeature(f) {
    if (!f.geometry) return "";
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    let d = "";
    for (const poly of polys) {
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

  // ----- bbox helpers (lon/lat bbox, then projected to viewBox) -----
  function bboxOfFeature(f) {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

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

  // ----- viewBox state (zoom/pan) -----
  let currentViewBox = { x: 0, y: 0, w: MAP_W, h: MAP_H };
  let baseViewBox = null;

  function setViewBox(x, y, w, h) {
    currentViewBox = { x, y, w, h };
    svgEl.setAttribute("viewBox", `${x} ${y} ${w} ${h}`);
  }

  // Zoom limits relative to per-country fitted viewBox
  const ZOOM_MIN_FACTOR = 0.35; // max zoom-in
  const ZOOM_MAX_FACTOR = 7.0; // max zoom-out

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

  function zoomAtClientPointFrom(vb, factor, clientX, clientY) {
    const rect = svgEl.getBoundingClientRect();

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
      h: nh,
    };

    const clamped = clampCandidateToZoomLimits(candidate);
    setViewBox(clamped.x, clamped.y, clamped.w, clamped.h);
  }

  function zoomAtClientPoint(factor, clientX, clientY) {
    zoomAtClientPointFrom(currentViewBox, factor, clientX, clientY);
  }

  function svgUnitsPerPx() {
    const vb = svgEl.viewBox.baseVal;
    const pxW = svgEl.clientWidth || MAP_W;
    return vb.width / pxW;
  }

  // Prevent iOS Safari rotate/pinch "gesture" events (prevents rotate)
  function blockIOSGestureEvents() {
    ["gesturestart", "gesturechange", "gestureend"].forEach((type) => {
      svgEl.addEventListener(type, (e) => e.preventDefault(), { passive: false });
    });
  }

  // ----- interactions (wheel + pointer pinch/pan) -----
  const pointers = new Map();
  let startView = null;
  let startDist = 0;
  let panStartClient = null;

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
  function mid(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  let interactionsAttached = false;
  function attachInteractions() {
    if (interactionsAttached) return;
    interactionsAttached = true;

    blockIOSGestureEvents();

    // wheel zoom
    svgEl.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const factor = e.deltaY > 0 ? 1.15 : 0.87;
        zoomAtClientPoint(factor, e.clientX, e.clientY);
      },
      { passive: false }
    );

    // pointer pinch/pan (mobile + trackpads that emit pointer events)
    svgEl.addEventListener(
      "pointerdown",
      (e) => {
        svgEl.setPointerCapture(e.pointerId);
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
      },
      { passive: false }
    );

    svgEl.addEventListener(
      "pointermove",
      (e) => {
        if (!pointers.has(e.pointerId)) return;
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (!startView) return;

        // one-finger pan
        if (pointers.size === 1 && panStartClient) {
          const p = [...pointers.values()][0];
          const dxClient = p.x - panStartClient.x;
          const dyClient = p.y - panStartClient.y;

          const rect = svgEl.getBoundingClientRect();
          const dx = -dxClient * (startView.w / rect.width);
          const dy = -dyClient * (startView.h / rect.height);

          setViewBox(startView.x + dx, startView.y + dy, startView.w, startView.h);
          return;
        }

        // two-finger pinch zoom (+ pan around midpoint)
        if (pointers.size === 2) {
          const pts = [...pointers.values()];
          const distNow = dist(pts[0], pts[1]);
          if (!startDist) return;

          const scale = distNow / startDist; // >1 => zoom in
          const factor = 1 / scale;

          const m = mid(pts[0], pts[1]);
          zoomAtClientPointFrom(startView, factor, m.x, m.y);
        }
      },
      { passive: false }
    );

    svgEl.addEventListener("pointerup", (e) => {
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

    svgEl.addEventListener("pointercancel", () => {
      pointers.clear();
      startView = null;
      panStartClient = null;
      startDist = 0;
    });
  }

  // ----- data loading -----
  async function load() {
    const w = await (await fetch(worldUrl)).json();
    WORLD = w.features;
    PATHS = WORLD.map((f) => pathFromFeature(f)).filter(Boolean);

    const p = await (await fetch(placesUrl)).json();
    CAPITALS = new Map();
    for (const f of p.features) {
      if (!(f.properties.FEATURECLA || "").includes("capital")) continue;
      const k = norm(f.properties.ADM0NAME || "");
      if (!CAPITALS.has(k)) CAPITALS.set(k, []);
      CAPITALS.get(k).push({
        lon: +f.properties.LONGITUDE,
        lat: +f.properties.LATITUDE,
      });
    }

    // default full-world viewBox until a country is drawn
    setViewBox(0, 0, MAP_W, MAP_H);
  }

  // ----- draw (with per-country fitted baseViewBox) -----
  function draw(country, showDot) {
    svgEl.innerHTML = "";

    if (!WORLD || !PATHS) {
      svgEl.innerHTML = `<text x="20" y="30" fill="rgba(232,236,255,.7)">Loading map…</text>`;
      setViewBox(0, 0, MAP_W, MAP_H);
      return;
    }

    // backdrop world
    for (const d of PATHS) {
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", d);
      p.setAttribute("stroke", "rgba(232,236,255,.12)");
      p.setAttribute("stroke-width", "0.4");
      p.setAttribute("fill", "none");
      p.setAttribute("vector-effect", "non-scaling-stroke");
      svgEl.appendChild(p);
    }

    const mapName = COUNTRY_ALIASES[country] || country;
    const hits = WORLD.filter((f) => norm(f.properties.ADMIN || "") === norm(mapName));

    if (!hits.length) {
      svgEl.innerHTML += `<text x="20" y="30" fill="rgba(232,236,255,.7)">No outline found</text>`;
      setViewBox(0, 0, MAP_W, MAP_H);
      baseViewBox = { x: 0, y: 0, w: MAP_W, h: MAP_H };
      return;
    }

    // combine lon/lat bbox for all matching features
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
    bb = padBBox(bb, 0.18);

    // project bbox corners to viewBox
    const [x1, y1] = proj([bb.minX, bb.maxY]);
    const [x2, y2] = proj([bb.maxX, bb.minY]);
    const w = x2 - x1;
    const h = y2 - y1;

    baseViewBox = { x: x1, y: y1, w, h };
    setViewBox(x1, y1, w, h);

    // highlighted country
    for (const f of hits) {
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", pathFromFeature(f));
      p.setAttribute("stroke", "rgba(232,236,255,.95)");
      p.setAttribute("stroke-width", "0.8");
      p.setAttribute("fill", "rgba(165,180,252,.18)");
      p.setAttribute("vector-effect", "non-scaling-stroke");
      svgEl.appendChild(p);
    }

    // capital dot (keeps approx px size even while zooming)
    if (showDot && CAPITALS) {
      const c = CAPITALS.get(norm(country))?.[0];
      if (c) {
        const [x, y] = proj([c.lon, c.lat]);
        const upp = svgUnitsPerPx();
        const r = 4.5 * upp;

        const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        dot.setAttribute("cx", x);
        dot.setAttribute("cy", y);
        dot.setAttribute("r", r);
        dot.setAttribute("fill", "#6ee7b7");
        dot.setAttribute("stroke", "rgba(232,236,255,.9)");
        dot.setAttribute("stroke-width", "0.9");
        dot.setAttribute("vector-effect", "non-scaling-stroke");
        svgEl.appendChild(dot);
      }
    }
  }

  return { load, draw, attachInteractions };
}
