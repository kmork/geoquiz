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
  const ZOOM_MIN_FACTOR = 0.05;
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

  // Wheel zoom (smooth, progressive)
  svgEl.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 16;
      const strength = Math.sqrt(Math.min(Math.abs(dy), 200) / 200) * 0.28;
      const factor = dy > 0 ? 1 + strength : 1 - strength;
      zoomAt(factor, e.clientX, e.clientY);
    },
    { passive: false }
  );

  // Pointer pan + pinch zoom
  const pointers = new Map();
  let startVB = null;
  let panStart = null;
  let prevDist = 0;
  let panActivated = false;
  const PAN_START_THRESHOLD = 8;

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  // Allow pinch/pan on touch devices
  svgEl.style.touchAction = "none";

  const onPointerDown = (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    startVB = getVB();

    if (pointers.size === 1) {
      panStart = { x: e.clientX, y: e.clientY };
      prevDist = 0;
      panActivated = false;
    } else if (pointers.size === 2) {
      for (const pointerId of pointers.keys()) {
        svgEl.setPointerCapture?.(pointerId);
      }
      const pts = [...pointers.values()];
      prevDist = dist(pts[0], pts[1]);
      panStart = null;
      panActivated = false;
    }
  };

  const onPointerMove = (e) => {
    if (!pointers.has(e.pointerId) || !startVB) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // One pointer => pan
    if (pointers.size === 1 && panStart) {
      const p = [...pointers.values()][0];
      const moved = Math.hypot(p.x - panStart.x, p.y - panStart.y);
      if (!panActivated) {
        if (moved < PAN_START_THRESHOLD) return;
        panActivated = true;
        svgEl.setPointerCapture?.(e.pointerId);
      }

      const a = clientToSvg(panStart.x, panStart.y);
      const b = clientToSvg(p.x, p.y);

      const dx = a.x - b.x;
      const dy = a.y - b.y;

      const cand = { x: startVB.x + dx, y: startVB.y + dy, w: startVB.w, h: startVB.h };
      setViewBox(clampPan(cand));
      return;
    }

    // Two pointers => pinch zoom, per-frame differential centered at midpoint
    if (pointers.size === 2) {
      const pts = [...pointers.values()];
      const dNow = dist(pts[0], pts[1]);
      if (!prevDist) return;

      // Per-frame ratio: <1 = zoom in (fingers spreading), >1 = zoom out (fingers closing)
      const factor = prevDist / dNow;
      prevDist = dNow;

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
      prevDist = 0;
      panActivated = false;
    } else if (pointers.size === 0) {
      startVB = null;
      panStart = null;
      prevDist = 0;
      panActivated = false;
    }
  };

  svgEl.addEventListener("pointerdown", onPointerDown, { passive: false });
  svgEl.addEventListener("pointermove", onPointerMove, { passive: false });
  svgEl.addEventListener("pointerup", endPointer);
  svgEl.addEventListener("pointercancel", () => {
    pointers.clear();
    startVB = null;
    panStart = null;
    prevDist = 0;
    panActivated = false;
  });

  /** Shift the current viewBox by (dx, dy) in SVG units. */
  const panBy = (dx, dy) => {
    const vb = getVB();
    setViewBox(clampPan({ x: vb.x + dx, y: vb.y + dy, w: vb.w, h: vb.h }));
  };

  return { panBy };
}
