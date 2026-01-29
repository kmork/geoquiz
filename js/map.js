import { norm } from "./utils.js";
import { COUNTRY_ALIASES } from "./aliases.js";

export function createMap({ svgEl, worldUrl, placesUrl }) {
  let WORLD = null,
    PATHS = null,
    CAPITALS = null;

  const MAP_W = 600;
  const MAP_H = 320;

  // Keep track of a "base" viewBox per question (before user zoom/pan)
  let baseViewBox = { x: 0, y: 0, w: MAP_W, h: MAP_H };

  // --- projection ---
  const proj = ([lon, lat]) => [((lon + 180) / 360) * MAP_W, ((90 - lat) / 180) * MAP_H];

  function pathFromFeature(f) {
    if (!f.geometry) return "";
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    let d = "";
    for (const poly of polys) {
      for (const ring of poly) {
        ring.forEach(([lon, lat], i) => {
          const [x, y] = proj([lon, lat]);
          d += (i ? "L" : "M") + x + " " + y + " ";
        });
        d += "Z ";
      }
    }
    return d;
  }

  // --- bbox helpers (lon/lat bbox -> projected viewBox) ---
  function bboxOfFeatureLonLat(f) {
    let minLon = Infinity,
      minLat = Infinity,
      maxLon = -Infinity,
      maxLat = -Infinity;

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
    return { minLon, minLat, maxLon, maxLat };
  }

  function padBBox(bb, padRatio = 0.18) {
    const dLon = bb.maxLon - bb.minLon;
    const dLat = bb.maxLat - bb.minLat;
    return {
      minLon: bb.minLon - dLon * padRatio,
      maxLon: bb.maxLon + dLon * padRatio,
      minLat: bb.minLat - dLat * padRatio,
      maxLat: bb.maxLat + dLat * padRatio,
    };
  }

  function setViewBox(vb) {
    svgEl.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  }

  // --- ✅ Correct client -> SVG conversion (accounts for aspect-ratio fitting) ---
  function clientToSvg(clientX, clientY) {
    const pt = svgEl.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;

    const ctm = svgEl.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };

    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }

  // --- data loading ---
  async function load() {
    const w = await (await fetch(worldUrl)).json();
    WORLD = w.features;
    PATHS = WORLD.map(pathFromFeature).filter(Boolean);

    const p = await (await fetch(placesUrl)).json();
    CAPITALS = new Map();
    for (const f of p.features) {
      if (!((f.properties.FEATURECLA || "").includes("capital"))) continue;
      const k = norm(f.properties.ADM0NAME || "");
      if (!CAPITALS.has(k)) CAPITALS.set(k, []);
      CAPITALS.get(k).push({
        lon: +f.properties.LONGITUDE,
        lat: +f.properties.LATITUDE,
      });
    }

    baseViewBox = { x: 0, y: 0, w: MAP_W, h: MAP_H };
    setViewBox(baseViewBox);
  }

  // --- helpers used by bonus mode ---
  function getCapitalXY(country) {
    const c = CAPITALS?.get(norm(country))?.[0];
    if (!c) return null;
    const [x, y] = proj([c.lon, c.lat]);
    return { x, y };
  }

  function getBaseViewBox() {
    return { ...baseViewBox };
  }

  // --- draw (also sets baseViewBox to a fitted country box) ---
  function draw(country, showDot) {
    svgEl.innerHTML = "";

    if (!WORLD || !PATHS) return;

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
      baseViewBox = { x: 0, y: 0, w: MAP_W, h: MAP_H };
      setViewBox(baseViewBox);
      return;
    }

    // combine bbox across all parts
    let bb = bboxOfFeatureLonLat(hits[0]);
    for (let i = 1; i < hits.length; i++) {
      const b = bboxOfFeatureLonLat(hits[i]);
      bb = {
        minLon: Math.min(bb.minLon, b.minLon),
        minLat: Math.min(bb.minLat, b.minLat),
        maxLon: Math.max(bb.maxLon, b.maxLon),
        maxLat: Math.max(bb.maxLat, b.maxLat),
      };
    }
    bb = padBBox(bb, 0.18);

    // project bbox corners (note: lat direction inverted in proj)
    const [x1, y1] = proj([bb.minLon, bb.maxLat]);
    const [x2, y2] = proj([bb.maxLon, bb.minLat]);

    baseViewBox = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
    setViewBox(baseViewBox);

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

    // capital dot (approx constant px size)
    if (showDot) {
      const c = CAPITALS?.get(norm(country))?.[0];
      if (c) {
        const [x, y] = proj([c.lon, c.lat]);

        const vb = svgEl.viewBox.baseVal;
        const pxW = svgEl.clientWidth || 1;
        const upp = vb.width / pxW;

        const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        dot.setAttribute("cx", x);
        dot.setAttribute("cy", y);
        dot.setAttribute("r", String(8 * upp));
        dot.setAttribute("fill", "#6ee7b7");
        dot.setAttribute("stroke", "rgba(232,236,255,.9)");
        dot.setAttribute("stroke-width", "0.9");
        dot.setAttribute("vector-effect", "non-scaling-stroke");
        svgEl.appendChild(dot);
      }
    }
  }

  // keep API shape your main.js expects
  function attachInteractions() {
    if (attachInteractions._did) return;
    attachInteractions._did = true;

    // Prevent iOS Safari gesture zoom/rotate interfering with our SVG
    ["gesturestart", "gesturechange", "gestureend"].forEach((t) => {
      svgEl.addEventListener(t, (e) => e.preventDefault(), { passive: false });
    });

    // Zoom limits relative to the fitted country box
    const ZOOM_MIN_FACTOR = 0.35; // max zoom-in (smaller viewBox)
    const ZOOM_MAX_FACTOR = 7.0;  // max zoom-out (larger viewBox)

    const getVB = () => {
      const vb = svgEl.viewBox.baseVal;
      return { x: vb.x, y: vb.y, w: vb.width, h: vb.height };
    };

    const setVB = (vb) => setViewBox(vb);

    const clampToLimits = (candidate) => {
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
    };

    const zoomAt = (factor, clientX, clientY) => {
      const vb = getVB();
      const p = clientToSvg(clientX, clientY);

      const rx = (p.x - vb.x) / vb.w;
      const ry = (p.y - vb.y) / vb.h;

      const nw = vb.w * factor;
      const nh = vb.h * factor;

      const cand = { x: p.x - rx * nw, y: p.y - ry * nh, w: nw, h: nh };
      setVB(clampToLimits(cand));
    };

    // --- Wheel zoom (desktop) ---
    svgEl.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const factor = e.deltaY > 0 ? 1.15 : 0.87;
        zoomAt(factor, e.clientX, e.clientY);
      },
      { passive: false }
    );

    // --- Pointer pan + pinch zoom (mobile + desktop) ---
    const pointers = new Map();
    let startVB = null;
    let panStart = null;
    let startDist = 0;

    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

    svgEl.style.touchAction = "none"; // crucial: allows pinch/pan via pointer events

    svgEl.addEventListener(
      "pointerdown",
      (e) => {
        svgEl.setPointerCapture(e.pointerId);
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        startVB = getVB();

        if (pointers.size === 1) {
          panStart = { x: e.clientX, y: e.clientY };
          startDist = 0;
        } else if (pointers.size === 2) {
          const pts = [...pointers.values()];
          startDist = dist(pts[0], pts[1]);
          panStart = null;
        }
      },
      { passive: false }
    );

    svgEl.addEventListener(
      "pointermove",
      (e) => {
        if (!pointers.has(e.pointerId) || !startVB) return;
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        // One pointer => pan
        if (pointers.size === 1 && panStart) {
          const p = [...pointers.values()][0];

          const a = clientToSvg(panStart.x, panStart.y);
          const b = clientToSvg(p.x, p.y);

          const dx = a.x - b.x;
          const dy = a.y - b.y;

          setVB({ x: startVB.x + dx, y: startVB.y + dy, w: startVB.w, h: startVB.h });
          return;
        }

        // Two pointers => pinch zoom around midpoint
        if (pointers.size === 2) {
          const pts = [...pointers.values()];
          const dNow = dist(pts[0], pts[1]);
          if (!startDist) return;

          const scale = dNow / startDist; // >1 => fingers apart => zoom in
          const factor = 1 / scale;

          const m = mid(pts[0], pts[1]);
          // zoom from the *startVB* so it feels stable during pinch
          const pMid = clientToSvg(m.x, m.y);
          const rx = (pMid.x - startVB.x) / startVB.w;
          const ry = (pMid.y - startVB.y) / startVB.h;

          const nw = startVB.w * factor;
          const nh = startVB.h * factor;

          const cand = { x: pMid.x - rx * nw, y: pMid.y - ry * nh, w: nw, h: nh };
          setVB(clampToLimits(cand));
        }
      },
      { passive: false }
    );

    const endPointer = (e) => {
      pointers.delete(e.pointerId);

      if (pointers.size === 1) {
        const p = [...pointers.values()][0];
        startVB = getVB();
        panStart = { x: p.x, y: p.y };
        startDist = 0;
      } else if (pointers.size === 0) {
        startVB = null;
        panStart = null;
        startDist = 0;
      }
    };

    svgEl.addEventListener("pointerup", endPointer);
    svgEl.addEventListener("pointercancel", () => {
      pointers.clear();
      startVB = null;
      panStart = null;
      startDist = 0;
    });
  }

  return {
    load,
    draw,
    attachInteractions,
    clientToSvg,
    getCapitalXY,
    getBaseViewBox,
  };
}
