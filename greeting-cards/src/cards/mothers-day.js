/* Card 3 — "Mother's Day lily": a watercolour stargazer lily on grey-white cold-press paper with
   gold-foil anthers and gold-foil lettering. The back of the cover repeats the lily as a mirrored
   sepia-rose line drawing; the inside carries a tiny line-drawn sketch under the message. See CONTRACT.md. */
(function () {
  "use strict";
  const K = window.KEEPSAKE;
  const TAU = Math.PI * 2;

  /* ------------------------------------------------------------------ */
  /* palette                                                             */
  /* ------------------------------------------------------------------ */
  const PAPER = "#ECEAE6";
  const C = {
    pale: "#FEEAEC",
    light: "#FACBD3",
    mid: "#F3A3B5",
    deep: "#EC7590",
    deeper: "#DE5275",
    streak: "#D0466C",
    outline: "#94707C",
    spk: ["#C63A62", "#D04C6E", "#B9345A", "#D85A78", "#C04064"],
    sketch: "#B9878F",
  };
  const rgbCache = {};
  function rgba(hex, a) {
    let c = rgbCache[hex];
    if (!c) { const n = parseInt(hex.slice(1), 16); c = rgbCache[hex] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")";
  }

  /* ------------------------------------------------------------------ */
  /* Flower model, traced from the reference photo in a 678×999 "ref"    */
  /* space (the cover card).  Each tepal has two edges traced from its   */
  /* base at the throat to its tip: A (u = +1) and B (u = −1).           */
  /* (t, u) ∈ [0,1]×[−1,1] then addresses any point of the tepal, which  */
  /* is what the washes, veins, highlights and speckle rows follow.      */
  /* ------------------------------------------------------------------ */
  const THROAT = [392, 484];
  const PETALS = {
    // upper-left: broad, seen face-on
    ul: {
      A: [[388, 470], [352, 300], [318, 214], [275, 178], [225, 145], [170, 127], [115, 137], [70, 170], [43, 203], [37, 226]],
      B: [[386, 492], [300, 456], [212, 420], [142, 386], [96, 342], [62, 292], [43, 256], [37, 226]],
      shade: 0.15, hl: [0.3, -0.35], mid: 0.0, crease: [[0.72, 0.55, 0.97]], band: [[0.72, 1, 0.5, 1, 0.22]], dark: [[128, 186, 30], [52, 230, 18], [80, 318, 16]],
    },
    // upper-right
    ur: {
      A: [[398, 474], [438, 342], [478, 248], [522, 205], [578, 184], [630, 182], [658, 198], [670, 224]],
      B: [[420, 484], [490, 456], [555, 425], [600, 395], [636, 345], [658, 285], [670, 224]],
      shade: -0.35, hl: [0.35, -0.4], mid: 0.0, band: [[-1, -0.55, 0.3, 0.92, 0.16]], dark: [[652, 222, 22], [512, 268, 24]],
    },
    // tall back tepal whose tip hooks over to the right
    top: {
      A: [[388, 478], [358, 380], [336, 300], [326, 220], [332, 150], [352, 106], [385, 82], [440, 72], [498, 79], [533, 92]],
      B: [[404, 478], [421, 425], [444, 350], [470, 262], [490, 190], [505, 138], [518, 106], [533, 92]],
      shade: 0.5, hl: [0.25], mid: -0.1, band: [[-1, -0.45, 0.25, 0.9, 0.2]], dark: [[478, 112, 22], [455, 300, 18]],
    },
    // the hooked tip, showing the darker underside
    curl: {
      A: [[506, 96], [528, 88], [546, 97], [550, 117], [542, 137]],
      B: [[506, 96], [516, 116], [528, 129], [542, 137]],
      under: true, noSpk: true,
    },
    // lower-right, recurved
    lr: {
      A: [[426, 478], [485, 446], [545, 434], [598, 446], [636, 482], [656, 535], [660, 595], [650, 645], [633, 678]],
      B: [[424, 526], [455, 562], [495, 590], [540, 608], [580, 630], [612, 660], [633, 678]],
      shade: 0.45, hl: [0.45], mid: 0.1, crease: [[-0.2, 0.25, 0.95]], band: [[-1, -0.2, 0.25, 1, 0.22]], dark: [[606, 612, 28]],
    },
    // lower-left, folding back at its tip
    ll: {
      A: [[380, 484], [300, 462], [222, 430], [150, 408], [90, 410], [48, 428], [24, 460], [17, 500]],
      B: [[378, 502], [300, 514], [222, 538], [162, 566], [110, 596], [60, 606], [34, 588], [21, 548], [17, 500]],
      shade: 0.35, hl: [0.4], mid: 0.0, crease: [[-0.4, 0.3, 0.97]], band: [[-1, -0.4, 0.3, 1, 0.25]], dark: [[40, 525, 22], [128, 572, 18]],
    },
    // the front tepal, curling toward the viewer; its rolled lip sits over the throat
    fr: {
      A: [[422, 494], [360, 478], [290, 478], [222, 490], [176, 520], [156, 575], [160, 635], [186, 695], [222, 740], [260, 762]],
      B: [[444, 512], [420, 550], [382, 576], [334, 600], [298, 640], [277, 690], [268, 735], [260, 762]],
      shade: -0.55, hl: [-0.2], mid: -0.05, crease: [[0.42, 0.18, 0.92]], band: [[0.42, 1, 0.12, 0.97, 0.3]], dark: [[214, 610, 26], [236, 704, 18]],
      lip: [[444, 506], [440, 540], [410, 562], [366, 560], [338, 540], [336, 512], [372, 492], [420, 492]],
    },
  };
  // painter's order: back tepals, throat, stamens, then the front tepal over the stamen bases
  const BACK_ORDER = ["ul", "ur", "top", "curl", "lr", "ll"];
  const BBOX = { x0: 17, x1: 670, y0: 72, y1: 762 };
  // stamens: anther centre, long-axis angle (deg), filament origin offset from the throat
  const ANTHERS = [
    { c: [208, 256], a: 40, o: [-6, -6] },
    { c: [290, 241], a: 50, o: [-2, -8] },
    { c: [356, 268], a: 80, o: [4, -10] },
    { c: [208, 328], a: 36, o: [-8, -2] },
    { c: [242, 398], a: 34, o: [-6, 4] },
    { c: [326, 352], a: 60, o: [0, -4] },
  ];
  const PISTIL = { c: [276, 300] };
  const ANTHER_LEN = 50, ANTHER_WID = 20;

  /* ---------- geometry helpers ---------- */
  // Catmull-Rom through pts, then resampled to n+1 points evenly spaced by arc length
  function edgeCurve(pts, n) {
    const dense = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let j = 0; j < 10; j++) {
        const t = j / 10, t2 = t * t, t3 = t2 * t;
        const f = (k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
        dense.push([f(0), f(1)]);
      }
    }
    dense.push(pts[pts.length - 1]);
    const cum = [0];
    for (let i = 1; i < dense.length; i++) cum.push(cum[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
    const total = cum[cum.length - 1], out = [];
    let j = 1;
    for (let k = 0; k <= n; k++) {
      const s = (total * k) / n;
      while (j < dense.length - 1 && cum[j] < s) j++;
      const a = dense[j - 1], b = dense[j], f = (s - cum[j - 1]) / (cum[j] - cum[j - 1] || 1);
      out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
    }
    return out;
  }
  // ref space → card units: uniform scale s, optional horizontal mirror; (cx, top) places the bbox
  function makeMap(s, cx, top, mirror) {
    const mid = (BBOX.x0 + BBOX.x1) / 2, mx = mirror ? -1 : 1;
    const m = (p) => [cx + mx * (p[0] - mid) * s, top + (p[1] - BBOX.y0) * s];
    m.s = s;
    m.mirror = !!mirror;
    return m;
  }
  // smooth closed / open path through points (quadratic through midpoints)
  function smoothPath(path, pts, closed) {
    const n = pts.length;
    if (closed) {
      path.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2);
      for (let i = 0; i < n; i++) {
        const p = pts[i], q = pts[(i + 1) % n];
        path.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
      }
      path.closePath();
    } else {
      path.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < n - 1; i++) {
        const p = pts[i], q = pts[i + 1];
        path.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
      }
      path.lineTo(pts[n - 1][0], pts[n - 1][1]);
    }
    return path;
  }

  // Build one tepal in card units. L (layout stream) is consumed identically in every layer.
  const geoCache = {};
  function buildPetal(key, M, L) {
    const d = PETALS[key], N = 40;
    // a slight hand-drawn wobble of the edges (layout stream: same in art + foil)
    const wob = [L.range(0, TAU), L.range(0, TAU), L.range(2, 4)];
    if (!geoCache[key]) geoCache[key] = { A: edgeCurve(d.A, N), B: edgeCurve(d.B, N) };
    const g = geoCache[key];
    const amp = d.under ? 0 : 1.6;
    const push = (P, Q, ph) => P.map((p, i) => {
      const t = i / N, w = amp * Math.sin(Math.PI * t) * Math.sin(TAU * wob[2] * t + ph);
      const q = Q[i], dx = p[0] - q[0], dy = p[1] - q[1], l = Math.hypot(dx, dy) || 1;
      return M([p[0] + (dx / l) * w, p[1] + (dy / l) * w]);
    });
    const A = push(g.A, g.B, wob[0]), B = push(g.B, g.A, wob[1]);
    const pt = (t, u) => {
      const x = Math.min(N - 1e-6, Math.max(0, t * N)), i = Math.floor(x), f = x - i;
      const a0 = A[i], a1 = A[i + 1], b0 = B[i], b1 = B[i + 1];
      const ax = a0[0] + (a1[0] - a0[0]) * f, ay = a0[1] + (a1[1] - a0[1]) * f;
      const bx = b0[0] + (b1[0] - b0[0]) * f, by = b0[1] + (b1[1] - b0[1]) * f;
      const w = (u + 1) / 2;
      return [bx + (ax - bx) * w, by + (ay - by) * w];
    };
    const hw = (t) => { const a = pt(t, 1), b = pt(t, -1); return Math.hypot(a[0] - b[0], a[1] - b[1]) / 2; };
    const edgePts = A.concat(B.slice(0, N).reverse()); // A base→tip, B tip→base
    const path = smoothPath(new Path2D(), edgePts, true);
    const edge = smoothPath(new Path2D(), edgePts, false);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of edgePts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
    return { key, d, pt, hw, path, edge, edgePts, bb: { x: x0 - 2, y: y0 - 2, w: x1 - x0 + 4, h: y1 - y0 + 4 } };
  }

  function buildFlower(M, L) {
    const petals = {};
    for (const k of Object.keys(PETALS)) petals[k] = buildPetal(k, M, L);
    const mir = M.mirror ? -1 : 1;
    const stamens = ANTHERS.map((a) => {
      const bend = L.range(-0.1, 0.1);
      const deg = a.a + L.range(-3, 3);
      const ang = (M.mirror ? 180 - deg : deg) * (Math.PI / 180);
      const c = M(a.c);
      const len = ANTHER_LEN * M.s * L.range(0.92, 1.06), wid = ANTHER_WID * M.s;
      // versatile anther: the filament meets it a little toward its lower (throat-side) end
      const ux = Math.cos((deg * Math.PI) / 180), uy = Math.sin((deg * Math.PI) / 180); // ref-space axis, pointing down-right
      const attach = [c[0] + mir * ux * len * 0.16, c[1] + uy * len * 0.16];
      return { c, ang, len, wid, attach, origin: M([THROAT[0] + a.o[0], THROAT[1] + a.o[1]]), bend };
    });
    const pistil = { tip: M(PISTIL.c), origin: M([THROAT[0] + 2, THROAT[1] + 2]), bend: L.range(-0.06, 0.06) };
    return { petals, throat: M(THROAT), stamens, pistil, M };
  }

  /* ------------------------------------------------------------------ */
  /* small drawing helpers                                               */
  /* ------------------------------------------------------------------ */
  function along(g, p, uf, t0, t1, steps) {
    g.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = t0 + ((t1 - t0) * i) / steps;
      const q = p.pt(t, typeof uf === "function" ? uf(t) : uf);
      if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]);
    }
  }
  function curvePts(a, b, bend, n) {
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1];
    const c = [mx - dy * bend, my + dx * bend];
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
    }
    return out;
  }
  function polyline(g, pts) {
    g.beginPath();
    pts.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])));
  }
  // filled tapered stroke along points
  function taper(g, pts, w0, w1) {
    const L = [], R = [], n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      const w = (w0 + (w1 - w0) * (i / (n - 1))) / 2;
      L.push([pts[i][0] - (dy / l) * w, pts[i][1] + (dx / l) * w]);
      R.push([pts[i][0] + (dy / l) * w, pts[i][1] - (dx / l) * w]);
    }
    g.beginPath();
    g.moveTo(L[0][0], L[0][1]);
    for (let i = 1; i < n; i++) g.lineTo(L[i][0], L[i][1]);
    for (let i = n - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]);
    g.closePath();
  }
  // walk along a polyline at a fixed spacing and call fn(x, y, nx, ny)
  function walk(pts, step, fn) {
    let carry = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
      if (!l) continue;
      let s = carry;
      while (s < l) { fn(a[0] + (dx * s) / l, a[1] + (dy * s) / l, -dy / l, dx / l); s += step; }
      carry = s - l;
    }
  }
  function antherPath(g, s) {
    g.beginPath();
    g.ellipse(s.c[0], s.c[1], s.len / 2, s.wid / 2, s.ang, 0, TAU);
  }
  // shadow of a path cast only onto pixels already painted (offset trick keeps the shape itself off-canvas)
  function atopShadow(g, path, color, blur, dx, dy, scale) {
    const off = 3000;
    g.save();
    g.globalCompositeOperation = "source-atop";
    g.translate(-off, 0);
    g.shadowColor = color;
    g.shadowBlur = blur * scale;
    g.shadowOffsetX = (off + dx) * scale;
    g.shadowOffsetY = dy * scale;
    g.fillStyle = "#000";
    g.fill(path);
    g.restore();
  }

  /* ------------------------------------------------------------------ */
  /* cold-press paper tooth: tileable embossed value-noise (cached)      */
  /* ------------------------------------------------------------------ */
  const toothTiles = {};
  function toothTile(scale) {
    const key = Math.round(scale * 1000);
    if (toothTiles[key]) return toothTiles[key];
    const TU = 72; // tile size in card units
    const n = Math.max(16, Math.round(TU * scale));
    const r = K.rng("mothers-day:tooth");
    const H = new Float32Array(n * n);
    for (const [cells, amp] of [[12, 0.5], [24, 1], [48, 0.6], [96, 0.3]]) {
      if (cells > n / 1.3) continue;
      const grid = new Float32Array(cells * cells);
      for (let i = 0; i < grid.length; i++) grid[i] = r();
      for (let y = 0; y < n; y++) {
        const gy = (y / n) * cells, y0 = Math.floor(gy), fy = gy - y0, sy = fy * fy * (3 - 2 * fy);
        const ya = (y0 % cells) * cells, yb = ((y0 + 1) % cells) * cells;
        for (let x = 0; x < n; x++) {
          const gx = (x / n) * cells, x0 = Math.floor(gx), fx = gx - x0, sx = fx * fx * (3 - 2 * fx);
          const xa = x0 % cells, xb = (x0 + 1) % cells;
          H[y * n + x] += amp * ((grid[ya + xa] * (1 - sx) + grid[ya + xb] * sx) * (1 - sy) + (grid[yb + xa] * (1 - sx) + grid[yb + xb] * sx) * sy);
        }
      }
    }
    let lo = 1e9, hi = -1e9;
    for (let i = 0; i < H.length; i++) { lo = Math.min(lo, H[i]); hi = Math.max(hi, H[i]); }
    const span = hi - lo || 1;
    const c = document.createElement("canvas");
    c.width = c.height = n;
    const g = c.getContext("2d");
    const img = g.createImageData(n, n), D = img.data;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const h = (H[y * n + x] - lo) / span;
        const a = H[((y + n - 1) % n) * n + ((x + n - 1) % n)], b = H[((y + 1) % n) * n + ((x + 1) % n)];
        const slope = ((((a - b) / span) * scale) / 2.83) * 2.6; // light from the top-left, per card unit
        const i = (y * n + x) * 4;
        if (slope > 0) {
          D[i] = 255; D[i + 1] = 255; D[i + 2] = 252;
          D[i + 3] = Math.min(1, slope) * 255 * 0.1;
        } else {
          D[i] = 96; D[i + 1] = 86; D[i + 2] = 78;
          D[i + 3] = (Math.min(1, -slope) * 0.075 + Math.max(0, 0.4 - h) * 0.03) * 255;
        }
      }
    }
    g.putImageData(img, 0, 0);
    // fine grain flecks (baked into the tile, so the cover needs no per-render grain pass)
    const nf = Math.round((TU * TU) / 7);
    for (let i = 0; i < nf; i++) {
      const dark = r() < 0.5, z = Math.max(1, scale * (0.5 + r() * 0.6));
      g.fillStyle = dark ? "rgba(80,64,48," + (0.05 * r()).toFixed(3) + ")" : "rgba(255,255,255," + (0.09 * r()).toFixed(3) + ")";
      g.fillRect(r() * n, r() * n, z, z);
    }
    // a few paper fibres
    g.lineCap = "round";
    for (let i = 0; i < 30; i++) {
      const x = r() * n, y = r() * n, ang = r() * TAU, l = scale * (2 + r() * 5);
      g.strokeStyle = r() < 0.5 ? "rgba(120,110,100,0.05)" : "rgba(255,255,255,0.09)";
      g.lineWidth = Math.max(0.6, scale * 0.3);
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(ang + 0.7) * l * 0.5, y + Math.sin(ang + 0.7) * l * 0.5, x + Math.cos(ang) * l, y + Math.sin(ang) * l);
      g.stroke();
    }
    toothTiles[key] = c;
    return c;
  }
  function applyTooth(g, scale, alpha, mode) {
    const pat = g.createPattern(toothTile(scale), "repeat");
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (mode) g.globalCompositeOperation = mode;
    g.globalAlpha = alpha;
    g.fillStyle = pat;
    g.fillRect(0, 0, g.canvas.width, g.canvas.height);
    g.restore();
  }

  /* ------------------------------------------------------------------ */
  /* watercolour tepal                                                   */
  /* ------------------------------------------------------------------ */
  function paintPetal(g, p, T, F) {
    const d = p.d, scale = F.scale, M = F.M, k = M.s / 0.31; // k ≈ 1 on the cover
    g.lineCap = "round";
    g.lineJoin = "round";
    // soft shadow onto the tepals behind (only where paint already exists)
    atopShadow(g, p.path, "rgba(170,40,90,0.34)", 2.4 * k, 0.4 * k, 0.8 * k, scale);
    g.save();
    g.clip(p.path);
    const bb = p.bb;
    const s0 = p.pt(0, 0), s1 = p.pt(1, 0);
    // 1 — first, palest wash: throat green-white → pink → deeper toward the tip
    let gr = g.createLinearGradient(s0[0], s0[1], s1[0], s1[1]);
    if (d.under) {
      gr.addColorStop(0, K.mix(C.light, C.mid, 0.7));
      gr.addColorStop(1, K.mix(C.mid, C.deep, 0.7));
    } else {
      gr.addColorStop(0, "#F1F1DA");
      gr.addColorStop(0.12, "#FBE6EA");
      gr.addColorStop(0.4, K.mix(C.pale, C.light, 0.4));
      gr.addColorStop(0.78, K.mix(C.pale, C.light, 0.8));
      gr.addColorStop(1, K.mix(C.light, C.mid, 0.6));
    }
    g.fillStyle = gr;
    g.fillRect(bb.x, bb.y, bb.w, bb.h);
    // 2 — lateral glaze: one side of the tepal turns away from the light
    const a = p.pt(0.5, 1), b = p.pt(0.5, -1), sh = d.shade || 0;
    gr = g.createLinearGradient(a[0], a[1], b[0], b[1]);
    gr.addColorStop(0, rgba(C.deep, 0.1 + Math.max(0, -sh) * 0.32));
    gr.addColorStop(0.4, rgba(C.deep, 0));
    gr.addColorStop(0.6, rgba(C.deep, 0));
    gr.addColorStop(1, rgba(C.deep, 0.1 + Math.max(0, sh) * 0.32));
    g.fillStyle = gr;
    g.fillRect(bb.x, bb.y, bb.w, bb.h);
    // 3 — soft wet-in-wet blotches
    const nb = d.under ? 3 : 12;
    for (let i = 0; i < nb; i++) {
      const t = T.range(0.15, 0.97), u = T.range(-0.9, 0.9), q = p.pt(t, u);
      const r = Math.max(1.5, p.hw(t) * T.range(0.3, 0.8));
      const col = T.pick([C.mid, C.deep, C.mid, C.light, C.deeper]);
      const al = T.range(0.07, 0.2);
      const rg = g.createRadialGradient(q[0], q[1], 0, q[0], q[1], r);
      rg.addColorStop(0, rgba(col, al));
      rg.addColorStop(0.6, rgba(col, al * 0.6));
      rg.addColorStop(1, rgba(col, 0));
      g.fillStyle = rg;
      g.fillRect(q[0] - r, q[1] - r, r * 2, r * 2);
    }
    // 3b — broad brush strokes along the tepal: pigment bands and lifted (blotted) paler bands
    const nbs = d.under ? 2 : 7;
    for (let i = 0; i < nbs; i++) {
      const lift = i >= nbs - 2;
      const u0 = lift ? T.range(-0.45, 0.45) : (T() < 0.6 ? (T() < 0.5 ? -1 : 1) * T.range(0.45, 0.85) : T.range(-0.5, 0.5));
      const dr = T.range(-0.15, 0.15), t0 = T.range(0.05, 0.3), t1 = T.range(0.6, 1.0);
      g.lineWidth = T.range(2.2, 5) * k;
      g.strokeStyle = lift ? "rgba(255,250,252," + T.range(0.18, 0.3) + ")" : rgba(T() < 0.5 ? C.deep : C.mid, T.range(0.1, 0.2));
      along(g, p, (t) => u0 + dr * t, t0, t1, 16);
      g.stroke();
    }
    // 4 — darker pigment zones (where the painter went back in)
    for (const dz of d.dark || []) {
      const c = M([dz[0], dz[1]]), r = dz[2] * M.s;
      const rg = g.createRadialGradient(c[0], c[1], 0, c[0], c[1], r);
      rg.addColorStop(0, rgba(C.deeper, 0.42));
      rg.addColorStop(0.55, rgba(C.deep, 0.2));
      rg.addColorStop(1, rgba(C.deep, 0));
      g.fillStyle = rg;
      g.fillRect(c[0] - r, c[1] - r, r * 2, r * 2);
    }
    // 5 — hard-edged "blooms" (back-runs): pale centre, pigment ring where the water dried
    const nbl = d.under ? 0 : 2 + (T() < 0.5 ? 1 : 0);
    for (let i = 0; i < nbl; i++) {
      const t = T.range(0.3, 0.85), u = T.range(-0.6, 0.6), q = p.pt(t, u);
      const R = Math.max(2, p.hw(t) * T.range(0.22, 0.4));
      const n = 16, ph = T.range(0, TAU), pts = [];
      for (let j = 0; j < n; j++) {
        const an = (j / n) * TAU, rr = R * (0.78 + 0.22 * Math.sin(an * 3 + ph) + T.range(-0.08, 0.08));
        pts.push([q[0] + Math.cos(an) * rr * 1.2, q[1] + Math.sin(an) * rr * 0.85]);
      }
      const bp = smoothPath(new Path2D(), pts, true);
      g.fillStyle = "rgba(255,255,255,0.14)";
      g.fill(bp);
      g.strokeStyle = rgba(C.deep, 0.2);
      g.lineWidth = 0.45 * k;
      g.stroke(bp);
    }
    // 6 — striations (veins / brush hairs) running from the throat toward the tip
    const ns = d.under ? 6 : 22;
    for (let i = 0; i < ns; i++) {
      const edgeBias = T() < 0.5;
      const u0 = edgeBias ? (T() < 0.5 ? -1 : 1) * T.range(0.6, 0.95) : T.range(-0.7, 0.7), dr = T.range(-0.1, 0.1);
      const t0 = T.range(0.0, 0.25), t1 = d.under ? T.range(0.6, 1) : T.range(0.35, 0.95);
      g.strokeStyle = rgba(T() < 0.5 ? C.deep : C.streak, T.range(0.08, 0.28));
      g.lineWidth = T.range(0.3, 1.0) * k;
      along(g, p, (t) => u0 + dr * t, t0, t1, 14);
      g.stroke();
    }
    if (!d.under) {
      // 7 — midrib: deeper pigment along the centre, with a white groove highlight beside it
      const mu = d.mid || 0;
      for (const [lw, al] of [[7, 0.05], [3.6, 0.08], [1.6, 0.15], [0.7, 0.28]]) {
        g.lineWidth = lw * k;
        g.strokeStyle = rgba(C.streak, al);
        along(g, p, mu, 0.03, 0.88, 18);
        g.stroke();
      }
      g.strokeStyle = "rgba(255,255,255,0.5)";
      g.lineWidth = 1.0 * k;
      along(g, p, (t) => mu + 0.12 - 0.04 * t, 0.06, 0.7, 14);
      g.stroke();
      // 8 — white highlights: paper left unpainted
      for (const hu of d.hl || []) {
        for (const [lw, al] of [[10, 0.16], [5.5, 0.22], [2.6, 0.3]]) {
          g.lineWidth = lw * k;
          g.strokeStyle = "rgba(255,255,255," + al + ")";
          along(g, p, (t) => hu * (0.85 + 0.2 * t), 0.12, 0.76, 14);
          g.stroke();
        }
      }
    }
    // 8b — glazed bands: the part of a tepal that curls away, a hard edge on the fold side
    for (const bd of d.band || []) {
      const [u0, u1, t0, t1, al] = bd, steps = 16, bp = new Path2D();
      for (let i = 0; i <= steps; i++) { const q = p.pt(t0 + ((t1 - t0) * i) / steps, u0); i ? bp.lineTo(q[0], q[1]) : bp.moveTo(q[0], q[1]); }
      for (let i = steps; i >= 0; i--) { const q = p.pt(t0 + ((t1 - t0) * i) / steps, u1); bp.lineTo(q[0], q[1]); }
      bp.closePath();
      g.fillStyle = rgba(C.deep, al);
      g.fill(bp);
      // a second, narrower glaze hugging the fold line
      const um = u0 + (u1 - u0) * 0.3;
      g.lineWidth = 3.5 * k;
      g.strokeStyle = rgba(C.deeper, al * 0.6);
      along(g, p, (u0 + um) / 2, t0 + 0.03, t1 - 0.03, 16);
      g.stroke();
    }
    // 9 — creases (recurved folds)
    for (const cr of d.crease || []) {
      const [cu, t0, t1] = cr;
      g.lineWidth = 4 * k;
      g.strokeStyle = rgba(C.deep, 0.16);
      along(g, p, cu, t0, t1, 16);
      g.stroke();
      g.lineWidth = 0.75 * k;
      g.strokeStyle = rgba(C.deeper, 0.5);
      along(g, p, cu, t0, t1, 16);
      g.stroke();
    }
    // 10 — rolled lip of the front tepal: lighter, with a crisp fold line below it
    if (d.lip) {
      const lp = smoothPath(new Path2D(), d.lip.map(M), true);
      g.fillStyle = "rgba(255,246,248,0.42)";
      g.fill(lp);
      g.save();
      g.clip(lp);
      g.lineWidth = 3 * k;
      g.strokeStyle = rgba(C.mid, 0.3);
      g.stroke(lp);
      g.restore();
      const lipEdge = smoothPath(new Path2D(), d.lip.slice(1, 6).map(M), false);
      g.save();
      g.translate(0.6 * k, 1.2 * k);
      g.lineWidth = 3 * k;
      g.strokeStyle = rgba(C.deep, 0.22);
      g.stroke(lipEdge);
      g.restore();
      g.strokeStyle = rgba(C.deeper, 0.55);
      g.lineWidth = 0.7 * k;
      g.stroke(lipEdge);
    }
    // 11 — pigment pooling at the edges (inside the clip, so only the inner half shows)
    for (const [lw, al, col] of [[12, 0.08, C.deep], [6.5, 0.14, C.deep], [3.2, 0.24, C.deeper], [1.4, 0.4, C.deeper]]) {
      g.lineWidth = lw * k;
      g.strokeStyle = rgba(col, al);
      g.stroke(p.edge);
    }
    // 12 — crimson speckles, densest toward the throat, in loose rows
    if (!d.noSpk) {
      const rows = 8;
      for (let rI = 0; rI < rows; rI++) {
        const u = -0.8 + (1.6 * (rI + 0.5)) / rows + T.range(-0.06, 0.06);
        let t = T.range(0.06, 0.14);
        const tmax = 0.82 - Math.abs(u) * 0.22;
        while (t < tmax) {
          const uu = u + T.range(-0.1, 0.1);
          const q = p.pt(t, uu), q2 = p.pt(t + 0.02, uu);
          const ang = Math.atan2(q2[1] - q[1], q2[0] - q[0]);
          const rr = (1.0 - t * 0.45) * T.range(0.55, 1.0) * k;
          if (T() < 0.88 - Math.abs(u) * 0.3) {
            g.fillStyle = rgba(T.pick(C.spk), T.range(0.6, 0.9));
            g.beginPath();
            g.ellipse(q[0], q[1], rr * 1.5, rr * 0.95, ang, 0, TAU);
            g.fill();
          }
          t += T.range(0.035, 0.06) * (1 + t * 1.2);
        }
      }
    }
    g.restore();
    // 13 — fine stamped outline in grey-mauve, slightly stippled like a pigment pen
    g.strokeStyle = rgba(C.outline, 0.78);
    g.lineWidth = 0.55 * k;
    g.stroke(p.edge);
    g.fillStyle = rgba(C.outline, 0.7);
    walk(p.edgePts, 0.55 * k, (x, y, nx, ny) => {
      if (T() < 0.6) {
        const j = T.range(-0.45, 0.35) * k, s = (0.35 + T() * 0.55) * k;
        g.fillRect(x + nx * j - s / 2, y + ny * j - s / 2, s, s);
      }
    });
  }

  function paintFilaments(g, F) {
    const s = F.M.s / 0.31;
    g.save();
    g.shadowColor = "rgba(150,50,85,0.32)";
    g.shadowBlur = 1.2 * F.scale;
    g.shadowOffsetX = 0.4 * F.scale;
    g.shadowOffsetY = 0.6 * F.scale;
    // pistil (style + three-lobed stigma)
    const pp = curvePts(F.pistil.origin, F.pistil.tip, F.pistil.bend, 18);
    let gr = g.createLinearGradient(pp[0][0], pp[0][1], F.pistil.tip[0], F.pistil.tip[1]);
    gr.addColorStop(0, "#7E9238");
    gr.addColorStop(1, "#A2A64A");
    g.fillStyle = gr;
    taper(g, pp, 2.0 * s, 1.3 * s);
    g.fill();
    g.fillStyle = "#94984A";
    for (let i = 0; i < 3; i++) {
      const an = -2.3 + i * 0.75;
      g.beginPath();
      g.arc(F.pistil.tip[0] + Math.cos(an) * 1.1 * s, F.pistil.tip[1] + Math.sin(an) * 1.1 * s, 1.25 * s, 0, TAU);
      g.fill();
    }
    for (const st of F.stamens) {
      const pts = curvePts(st.origin, st.attach, st.bend, 16);
      gr = g.createLinearGradient(st.origin[0], st.origin[1], st.attach[0], st.attach[1]);
      gr.addColorStop(0, "#80943A");
      gr.addColorStop(0.55, "#A9AA4A");
      gr.addColorStop(1, "#C4AE58");
      g.fillStyle = gr;
      taper(g, pts, 2.1 * s, 1.15 * s);
      g.fill();
    }
    g.restore();
    // highlights along the filaments
    g.strokeStyle = "rgba(240,244,190,0.5)";
    g.lineWidth = 0.35 * s;
    g.lineCap = "round";
    for (const st of F.stamens) {
      polyline(g, curvePts(st.origin, st.attach, st.bend, 16).slice(2, -2).map((q) => [q[0] - 0.25 * s, q[1] - 0.3 * s]));
      g.stroke();
    }
    g.fillStyle = "rgba(235,240,180,0.7)";
    g.beginPath();
    g.arc(F.pistil.tip[0] - 0.6 * s, F.pistil.tip[1] - 0.7 * s, 0.7 * s, 0, TAU);
    g.fill();
  }

  // gold-foil anthers: art = gold gradient + grain, foil = white of the same shape
  function paintAnthers(ctx, F, layer, T, soft) {
    if (layer === "foil") {
      ctx.fillStyle = "#fff";
      for (const s of F.stamens) { antherPath(ctx, s); ctx.fill(); }
      return;
    }
    const scale = F.scale;
    for (const s of F.stamens) {
      // contact shadow on the petal
      ctx.save();
      ctx.shadowColor = "rgba(110,40,60,0.4)";
      ctx.shadowBlur = 1.4 * scale;
      ctx.shadowOffsetX = 0.45 * scale;
      ctx.shadowOffsetY = 0.75 * scale;
      antherPath(ctx, s);
      ctx.fillStyle = "#9A7228";
      ctx.fill();
      ctx.restore();
      ctx.save();
      antherPath(ctx, s);
      ctx.clip();
      // across the anther, from its upper (lit) side to its lower side
      let nx = -Math.sin(s.ang), ny = Math.cos(s.ang);
      if (ny < 0) { nx = -nx; ny = -ny; }
      const hw = s.wid / 2, R = s.len / 2;
      const gr = ctx.createLinearGradient(s.c[0] - nx * hw, s.c[1] - ny * hw, s.c[0] + nx * hw, s.c[1] + ny * hw);
      const pal = soft ? ["#EAD39C", "#D2AF66", "#B08A45", "#86672F"] : ["#E2C27A", "#BE9442", "#8E6828", "#5A3F18"];
      gr.addColorStop(0, pal[0]);
      gr.addColorStop(0.3, pal[1]);
      gr.addColorStop(0.65, pal[2]);
      gr.addColorStop(1, pal[3]);
      ctx.fillStyle = gr;
      ctx.fillRect(s.c[0] - R - 1, s.c[1] - R - 1, R * 2 + 2, R * 2 + 2);
      // pollen grain / foil glitter
      const n = Math.round(R * hw * (soft ? 2.5 : 5));
      const cols = ["rgba(255,236,180,0.75)", "rgba(100,70,22,0.5)", "rgba(214,180,96,0.7)", "rgba(80,54,18,0.45)", "rgba(238,214,140,0.6)"];
      const ca = Math.cos(s.ang), sa = Math.sin(s.ang);
      for (let i = 0; i < n; i++) {
        const a = T() * TAU, rr = Math.sqrt(T());
        const x = s.c[0] + ca * Math.cos(a) * rr * R - sa * Math.sin(a) * rr * hw;
        const y = s.c[1] + sa * Math.cos(a) * rr * R + ca * Math.sin(a) * rr * hw;
        const z = 0.28 + T() * 0.42;
        ctx.fillStyle = cols[(T() * cols.length) | 0];
        ctx.fillRect(x - z / 2, y - z / 2, z, z);
      }
      // specular ridge along the lit side
      ctx.strokeStyle = "rgba(255,248,215,0.7)";
      ctx.lineWidth = Math.max(0.35, s.wid * 0.13);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(s.c[0] - ca * R * 0.6 - nx * hw * 0.45, s.c[1] - sa * R * 0.6 - ny * hw * 0.45);
      ctx.lineTo(s.c[0] + ca * R * 0.45 - nx * hw * 0.45, s.c[1] + sa * R * 0.45 - ny * hw * 0.45);
      ctx.stroke();
      ctx.restore();
      antherPath(ctx, s);
      ctx.strokeStyle = "rgba(100,68,22,0.6)";
      ctx.lineWidth = 0.3;
      ctx.stroke();
    }
  }

  /* ------------------------------------------------------------------ */
  /* cover lettering                                                     */
  /* ------------------------------------------------------------------ */
  const FONT = (s) => "500 " + s.toFixed(2) + 'px "Josefin Sans", "Futura", "Century Gothic", sans-serif';
  function coverLines(text) {
    let lines = String(text == null ? "" : text).toUpperCase().replace(/'/g, "’").split(/\r?\n/).map((s) => s.trim());
    while (lines.length && !lines[0]) lines.shift();
    while (lines.length && !lines[lines.length - 1]) lines.pop();
    if (lines.length > 4) lines = lines.slice(0, 3).concat([lines.slice(3).join(" ")]);
    return lines;
  }
  // split a line at the word break that best balances the two halves
  function splitLine(line) {
    const words = line.split(/\s+/);
    if (words.length < 2) return null;
    let best = null;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(" "), b = words.slice(i).join(" "), d = Math.abs(a.length - b.length);
      if (!best || d < best.d) best = { a, b, d };
    }
    return [best.a, best.b];
  }
  function layoutText(ctx, box, lines) {
    const baseSize = (n) => (n <= 2 ? 14 : n === 3 ? 12.5 : 11);
    const measure = (sz) => {
      ctx.font = FONT(sz);
      const sp = 0.18 * sz;
      return lines.map((ln) => {
        const ch = Array.from(ln), ws = ch.map((c) => ctx.measureText(c).width);
        const tot = ws.reduce((a, b) => a + b, 0) + sp * Math.max(0, ch.length - 1);
        return { ch, ws, tot, sp };
      });
    };
    ctx.save();
    // a long single line would shrink to nothing: wrap it at a word break instead (up to 3 lines)
    for (let guard = 0; guard < 2 && lines.length < 3; guard++) {
      const mm = measure(baseSize(lines.length));
      let wi = 0;
      mm.forEach((x, i) => { if (x.tot > mm[wi].tot) wi = i; });
      if (mm[wi].tot * 0.7 <= box.w * 0.8) break;
      const sp = splitLine(lines[wi]);
      if (!sp) break;
      lines = lines.slice(0, wi).concat(sp, lines.slice(wi + 1));
    }
    const n = lines.length;
    let size = baseSize(n);
    let pitch = n <= 2 ? box.h * 0.07 : n === 3 ? 18.5 : 15.5;
    let m = measure(size);
    const maxW = Math.max(1, ...m.map((x) => x.tot));
    if (maxW > box.w * 0.8) {
      const f = (box.w * 0.8) / maxW;
      size *= f;
      pitch *= Math.max(0.8, f);
      m = measure(size);
    }
    ctx.font = FONT(size);
    const hm = ctx.measureText("H");
    const cap = hm.actualBoundingBoxAscent > 0 ? hm.actualBoundingBoxAscent : size * 0.7;
    ctx.restore();
    const yc = box.h * 0.835, glyphs = [];
    let top = 1e9, bottom = -1e9;
    m.forEach((ln, i) => {
      const cy = yc + (i - (n - 1) / 2) * pitch, base = cy + cap / 2;
      let x = box.w / 2 - ln.tot / 2;
      ln.ch.forEach((c, j) => { glyphs.push({ c, x, y: base, line: i }); x += ln.ws[j] + ln.sp; });
      top = Math.min(top, base - cap);
      bottom = Math.max(bottom, base + size * 0.12);
    });
    return { font: FONT(size), size, cap, glyphs, top, bottom, n };
  }
  function drawGlyphs(g, lay, dx, dy) {
    g.font = lay.font;
    g.textAlign = "left";
    g.textBaseline = "alphabetic";
    for (const q of lay.glyphs) g.fillText(q.c, q.x + dx, q.y + dy);
  }
  function drawLettering(ctx, box, layer, opts) {
    const lines = coverLines(opts.text);
    if (!lines.length) return;
    const lay = layoutText(ctx, box, lines);
    if (layer === "foil") {
      ctx.save();
      ctx.fillStyle = "#fff";
      drawGlyphs(ctx, lay, 0, 0);
      ctx.restore();
      return;
    }
    const sc = opts.scale, T = opts.rng("foilgrain");
    // gold foil lettering rendered on its own strip, then grained with flecks (source-atop)
    const y0 = Math.floor((lay.top - 3) * sc) / sc, y1 = lay.bottom + 3;
    const oc = document.createElement("canvas");
    oc.width = Math.max(1, Math.ceil(box.w * sc));
    oc.height = Math.max(1, Math.ceil((y1 - y0) * sc));
    const g = oc.getContext("2d");
    g.setTransform(sc, 0, 0, sc, 0, -y0 * sc);
    for (let i = 0; i < lay.n; i++) {
      const gl = lay.glyphs.filter((q) => q.line === i);
      if (!gl.length) continue;
      const base = gl[0].y;
      const gr = g.createLinearGradient(0, base - lay.cap, 0, base);
      gr.addColorStop(0, "#D8BB6C");
      gr.addColorStop(0.4, "#C09844");
      gr.addColorStop(0.62, "#AC8331");
      gr.addColorStop(1, "#866322");
      g.fillStyle = gr;
      g.font = lay.font;
      g.textBaseline = "alphabetic";
      for (const q of gl) g.fillText(q.c, q.x, q.y);
    }
    g.globalCompositeOperation = "source-atop";
    // a broad, soft light band across the foil
    const band = g.createLinearGradient(box.w * 0.15, y0, box.w * 0.85, y1);
    band.addColorStop(0, "rgba(255,240,200,0)");
    band.addColorStop(0.45, "rgba(255,240,200,0.26)");
    band.addColorStop(0.55, "rgba(255,240,200,0.26)");
    band.addColorStop(1, "rgba(255,240,200,0)");
    g.fillStyle = band;
    g.fillRect(0, y0, box.w, y1 - y0);
    // fine glitter / foil grain
    const cols = ["rgba(255,246,210,0.85)", "rgba(110,80,24,0.5)", "rgba(240,212,130,0.75)", "rgba(150,112,40,0.55)", "rgba(255,252,236,0.95)"];
    const x0 = box.w * 0.08, xw = box.w * 0.84, n = Math.round(xw * (y1 - y0) * 1.1);
    for (let i = 0; i < n; i++) {
      const z = 0.25 + T() * 0.4;
      g.fillStyle = cols[(T() * cols.length) | 0];
      g.fillRect(x0 + T() * xw, y0 + T() * (y1 - y0), z, z);
    }
    ctx.save();
    // debossed foil: a hairline shadow below, a light catch above
    ctx.fillStyle = "rgba(90,70,40,0.3)";
    drawGlyphs(ctx, lay, 0.18, 0.32);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    drawGlyphs(ctx, lay, -0.15, -0.2);
    ctx.drawImage(oc, 0, y0, oc.width / sc, oc.height / sc);
    ctx.restore();
  }

  /* ------------------------------------------------------------------ */
  /* line-drawn lily (back of the cover, inside sketch)                  */
  /* ------------------------------------------------------------------ */
  function sketchLily(ctx, F, layer, T, style) {
    if (layer !== "art") {
      if (style.foil) paintAnthers(ctx, F, "foil");
      return;
    }
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const lw = style.lw, k = F.M.s / 0.31;
    for (const key of BACK_ORDER.concat(["stamens", "fr"])) {
      if (key === "stamens") {
        // filaments + pistil as fine lines
        ctx.strokeStyle = rgba(style.stem, 0.85);
        ctx.lineWidth = lw * 0.75;
        for (const s of F.stamens) { polyline(ctx, curvePts(s.origin, s.attach, s.bend, 12)); ctx.stroke(); }
        polyline(ctx, curvePts(F.pistil.origin, F.pistil.tip, F.pistil.bend, 12));
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(F.pistil.tip[0], F.pistil.tip[1], 1.6 * k, 0, TAU);
        ctx.stroke();
        if (style.foil) paintAnthers(ctx, F, "art", T, true);
        else {
          for (const s of F.stamens) {
            antherPath(ctx, s);
            ctx.fillStyle = rgba(style.anther, 0.6);
            ctx.fill();
            ctx.strokeStyle = rgba(style.line, 0.8);
            ctx.lineWidth = lw * 0.7;
            ctx.stroke();
          }
        }
        continue;
      }
      const p = F.petals[key], d = p.d;
      // pale wash that also hides the lines behind
      ctx.fillStyle = style.fill;
      ctx.fill(p.path);
      if (style.blush) {
        ctx.save();
        ctx.clip(p.path);
        ctx.lineWidth = 5 * k;
        ctx.strokeStyle = rgba(C.light, style.blush);
        ctx.stroke(p.edge);
        ctx.restore();
      }
      // inner lines: midrib, creases, lip
      ctx.strokeStyle = rgba(style.line, 0.5);
      ctx.lineWidth = lw * 0.6;
      if (!d.under) { along(ctx, p, d.mid || 0, 0.08, 0.5, 12); ctx.stroke(); }
      for (const cr of d.crease || []) { along(ctx, p, cr[0], cr[1], cr[2] * 0.92, 12); ctx.stroke(); }
      if (d.lip) ctx.stroke(smoothPath(new Path2D(), d.lip.slice(1, 6).map(F.M), false));
      // sparse speckles
      if (!d.noSpk && style.spk) {
        for (let i = 0; i < style.spk; i++) {
          const t = 0.08 + Math.pow(T(), 1.3) * 0.62, u = T.range(-0.72, 0.72), q = p.pt(t, u);
          ctx.fillStyle = rgba(T() < 0.5 ? "#E592A8" : "#D97C96", T.range(0.45, 0.85));
          ctx.beginPath();
          ctx.arc(q[0], q[1], style.dot * T.range(0.7, 1.25), 0, TAU);
          ctx.fill();
        }
      }
      // sketchy outline: a firm pass, then a looser second pass
      ctx.strokeStyle = rgba(style.line, style.stipple ? 0.8 : 0.9);
      ctx.lineWidth = style.stipple ? lw * 0.8 : lw;
      ctx.stroke(p.edge);
      const ph = T.range(0, TAU), ph2 = T.range(0, TAU), fq = T.range(5, 9), m = p.edgePts.length;
      const pts = p.edgePts.map((q, i) => [q[0] + style.jit * Math.sin((i / m) * TAU * fq + ph), q[1] + style.jit * Math.cos((i / m) * TAU * (fq - 1.3) + ph2)]);
      ctx.strokeStyle = rgba(style.line, 0.4);
      ctx.lineWidth = lw * 0.6;
      ctx.stroke(smoothPath(new Path2D(), pts, false));
      if (style.stipple) {
        // pigment-pen stipple riding on the line, a touch darker than it
        ctx.fillStyle = rgba(K.mix(style.line, "#5E424C", 0.5), 0.62);
        walk(p.edgePts, style.stipple, (x, y, nx, ny) => {
          if (T() < 0.62) { const j = T.range(-0.7, 0.7) * lw, z = lw * (0.55 + T() * 0.75); ctx.fillRect(x + nx * j - z / 2, y + ny * j - z / 2, z, z); }
        });
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* the card                                                            */
  /* ------------------------------------------------------------------ */
  K.registerCard({
    id: "mothers-day",
    title: "Mother's Day lily",
    size: { w: 220, h: 300 },
    paper: "#E6E4E0",
    insert: "#FBF8F2",
    ink: "#2B2722",
    foil: "gold",
    message: "For all the\nquiet ways\nyou love us.",
    coverText: "HAPPY\nMOTHER'S DAY",

    drawCover(ctx, box, layer, opts) {
      const scale = opts.scale;
      const M = makeMap(0.31, box.w / 2, 8, false);
      const F = buildFlower(M, opts.rng("layout"));
      F.scale = scale;
      if (layer === "foil") {
        paintAnthers(ctx, F, "foil");
        drawLettering(ctx, box, layer, opts);
        return;
      }
      /* paper */
      const P = opts.rng("paper");
      ctx.fillStyle = PAPER;
      ctx.fillRect(0, 0, box.w, box.h);
      for (let i = 0; i < 12; i++) {
        const x = P() * box.w, y = P() * box.h, r = 25 + P() * 60, light = P() < 0.5;
        const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, light ? "rgba(255,255,255,0.10)" : "rgba(150,140,128,0.04)");
        rg.addColorStop(1, light ? "rgba(255,255,255,0)" : "rgba(150,140,128,0)");
        ctx.fillStyle = rg;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }

      /* the flower is painted on its own sheet so glazes stack and shadows only fall on paint,
         then laid onto the paper with multiply, like transparent watercolour */
      const fc = document.createElement("canvas");
      fc.width = ctx.canvas.width;
      fc.height = ctx.canvas.height;
      const g = fc.getContext("2d");
      g.setTransform(ctx.getTransform());
      const T = opts.rng("wash");
      // the throat itself, so no paper peeks through where the tepals meet
      const tb = M([THROAT[0] + 14, THROAT[1] + 6]);
      g.fillStyle = "#EDEFD3";
      g.beginPath();
      g.ellipse(tb[0], tb[1], 46 * M.s, 30 * M.s, -0.3, 0, TAU);
      g.fill();
      for (const key of BACK_ORDER) paintPetal(g, F.petals[key], T, F);
      // pale green throat
      g.save();
      g.globalCompositeOperation = "source-atop";
      const tr = (24 * M.s) / 0.31;
      const rg = g.createRadialGradient(F.throat[0], F.throat[1], 0, F.throat[0], F.throat[1], tr);
      rg.addColorStop(0, "rgba(222,232,186,0.95)");
      rg.addColorStop(0.45, "rgba(232,236,200,0.55)");
      rg.addColorStop(1, "rgba(240,230,220,0)");
      g.fillStyle = rg;
      g.fillRect(F.throat[0] - tr, F.throat[1] - tr, tr * 2, tr * 2);
      g.restore();
      paintFilaments(g, F);
      paintPetal(g, F.petals.fr, T, F);
      // granulation: pigment settles into the paper tooth
      applyTooth(g, scale, 1, "source-atop");
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "multiply";
      ctx.drawImage(fc, 0, 0);
      ctx.restore();

      paintAnthers(ctx, F, "art", opts.rng("pollen"));
      drawLettering(ctx, box, layer, opts);
      applyTooth(ctx, scale, 1);
      // a whisper of edge darkening so the card reads as a sheet
      const v = ctx.createRadialGradient(box.w / 2, box.h * 0.45, box.h * 0.35, box.w / 2, box.h * 0.45, box.h * 0.78);
      v.addColorStop(0, "rgba(90,80,70,0)");
      v.addColorStop(1, "rgba(90,80,70,0.05)");
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, box.w, box.h);
    },

    drawBack(ctx, box, layer, opts) {
      const M = makeMap(0.262, box.w / 2, 40, true);
      const F = buildFlower(M, opts.rng("layout"));
      F.scale = opts.scale;
      const style = { lw: 0.75, line: C.sketch, stem: "#BFA08E", fill: "rgba(250,245,245,0.8)", blush: 0.25, spk: 40, dot: 0.48, jit: 0.4, stipple: 0.5, foil: true, anther: "#C9A04A" };
      sketchLily(ctx, F, layer, layer === "art" ? opts.rng("sketch") : null, style);
    },

    drawInside(ctx, box, layer, opts) {
      if (layer !== "art") return;
      const s = 36 / (BBOX.y1 - BBOX.y0);
      const M = makeMap(s, box.w / 2, box.h * 0.8 - 18, false);
      const F = buildFlower(M, opts.rng("layout"));
      F.scale = opts.scale;
      const style = { lw: 0.5, line: "#A2878F", stem: "#B39C9C", fill: "rgba(251,248,242,0.95)", blush: 0.18, spk: 4, dot: 0.22, jit: 0.2, stipple: 0, foil: false, anther: "#D8B7A0" };
      sketchLily(ctx, F, layer, opts.rng("sketch"), style);
    },
  });
})();
