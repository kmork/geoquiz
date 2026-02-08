// map-zoom-pan.js
// Shared SVG zoom/pan interactions for the route map.
// Usage:
//   let baseViewBox = {x, y, w, h}; // updated whenever you redraw
//   attachZoomPan(svgEl, () => baseViewBox);
//
// attachZoomPan is idempotent per-SVG (won't attach twice).

export function attachZoomPan(svgEl, getBaseViewBox) {
  if (!svgEl) return;

  // Prevent double attachment
  if (svgEl.dataset && svgEl.dataset.zoomPanAttached === "1") return;
  if (svgEl.dataset) svgEl.dataset.zoomPanAttached = "1";

  const base = () => {
    const vb = (typeof getBaseViewBox === "function" ? getBaseViewBox() : null);
    if (vb && typeof vb.x === "number") return vb;
    const cur = svgEl.viewBox.baseVal;
    return { x: cur.x, y: cur.y, w: cur.width, h: cur.height };
  };

  // Helper to convert client coordinates to SVG coordinates
  const clientToSvg = (clientX, clientY) => {
    const pt = svgEl.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svgEl.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  const setViewBox = (vb) => {
    svgEl.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  };

  // Prevent iOS Safari gesture zoom/rotate
  ["gesturestart", "gesturechange", "gestureend"].forEach((t) => {
    svgEl.addEventListener(t, (e) => e.preventDefault(), { passive: false });
  });

  // Zoom limits (relative to base viewBox)
  const ZOOM_MIN_FACTOR = 0.35;
  const ZOOM_MAX_FACTOR = 7.0;

  const getVB = () => {
    const vb = svgEl.viewBox.baseVal;
    return { x: vb.x, y: vb.y, w: vb.width, h: vb.height };
  };

  const clampZoom = (vb) => {
    const b = base();
    const minW = b.w * ZOOM_MIN_FACTOR;
    const maxW = b.w * ZOOM_MAX_FACTOR;

    let w = vb.w;
    let h = vb.h;
    let x = vb.x;
    let y = vb.y;

    if (w < minW) {
      const scale = minW / w;
      w = minW;
      h = h * scale;
    } else if (w > maxW) {
      const scale = maxW / w;
      w = maxW;
      h = h * scale;
    }

    // Keep center stable after scaling
    const cx = x + vb.w / 2;
    const cy = y + vb.h / 2;
    x = cx - w / 2;
    y = cy - h / 2;

    return { x, y, w, h };
  };

  const clampPan = (vb) => {
    const b = base();

    // Ensure the viewBox always overlaps with the content area (base viewBox)
    const minVisibleMargin = Math.min(vb.w, vb.h) * 0.2;

    let x = vb.x;
    let y = vb.y;

    const maxPanRight = b.x + b.w - minVisibleMargin;
    const minPanLeft = b.x - vb.w + minVisibleMargin;
    const maxPanDown = b.y + b.h - minVisibleMargin;
    const minPanUp = b.y - vb.h + minVisibleMargin;

    if (x > maxPanRight) x = maxPanRight;
    if (x < minPanLeft) x = minPanLeft;
    if (y > maxPanDown) y = maxPanDown;
    if (y < minPanUp) y = minPanUp;

    return { x, y, w: vb.w, h: vb.h };
  };

  const clampViewBox = (vb) => clampPan(clampZoom(vb));

  const zoomAt = (factor, clientX, clientY) => {
    const vb = getVB();
    const p = clientToSvg(clientX, clientY);

    const rx = (p.x - vb.x) / vb.w;
    const ry = (p.y - vb.y) / vb.h;

    const nw = vb.w * factor;
    const nh = vb.h * factor;

    const cand = { x: p.x - rx * nw, y: p.y - ry * nh, w: nw, h: nh };
    setViewBox(clampViewBox(cand));
  };

  // Wheel zoom
  svgEl.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1.15 : 0.87;
      zoomAt(factor, e.clientX, e.clientY);
    },
    { passive: false }
  );

  // Pointer pan + pinch zoom
  const pointers = new Map();
  let startVB = null;
  let panStart = null;
  let startDist = 0;

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  // Allow pinch/pan on touch devices
  svgEl.style.touchAction = "none";

  const onPointerDown = (e) => {
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
  };

  const onPointerMove = (e) => {
    if (!pointers.has(e.pointerId) || !startVB) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // One pointer => pan
    if (pointers.size === 1 && panStart) {
      const p = [...pointers.values()][0];

      const a = clientToSvg(panStart.x, panStart.y);
      const b = clientToSvg(p.x, p.y);

      const dx = a.x - b.x;
      const dy = a.y - b.y;

      const cand = { x: startVB.x + dx, y: startVB.y + dy, w: startVB.w, h: startVB.h };

      // Ensure the viewBox always overlaps with the content area (base viewBox)
      setViewBox(clampPan(cand));
      return;
    }

    // Two pointers => pinch zoom
    if (pointers.size === 2) {
      const pts = [...pointers.values()];
      const dNow = dist(pts[0], pts[1]);
      if (!startDist) return;

      // startDist / dNow: >1 zoom out, <1 zoom in
      const factor = startDist / dNow;
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;

      zoomAt(factor, midX, midY);
    }
  };

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

  svgEl.addEventListener("pointerdown", onPointerDown, { passive: false });
  svgEl.addEventListener("pointermove", onPointerMove, { passive: false });
  svgEl.addEventListener("pointerup", endPointer);
  svgEl.addEventListener("pointercancel", () => {
    pointers.clear();
    startVB = null;
    panStart = null;
    startDist = 0;
  });
}
