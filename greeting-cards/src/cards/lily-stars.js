/* Card 1 — "Starry lilies": cream cardstock, hand-painted gold glitter stripes, punched glitter stars
   with teal borders, and two die-cut stargazer lilies that overflow the card edges. See CONTRACT.md. */
(function () {
  "use strict";
  const K = window.KEEPSAKE;
  const TAU = Math.PI * 2;
  const D2R = Math.PI / 180;

  const CARD = "#F2E8CB";
  const TEAL = "#2F5A4E";

  /* ------------------------------------------------------------------ */
  /* glitter tiles: generated once per (kind, scale), deterministic,     */
  /* used only by the art layer (the foil layer paints flat white)       */
  /* ------------------------------------------------------------------ */
  const TILE = 256; // device px
  const TILE_SPECS = {
    // resting gold sits dark and olive (bronze); the shell's moving light band lifts it to bright yellow
    gold: {
      base: "#937A27",
      blobs: ["rgba(92,68,8,0.45)", "rgba(206,182,96,0.45)", "rgba(146,116,26,0.45)", "rgba(190,162,74,0.45)"],
      flecks: [["#6A5210", 0.14], ["#8E741C", 0.24], ["#AE9235", 0.3], ["#CDB466", 0.2], ["#4C3A08", 0.05], ["#E2D29A", 0.07]],
      density: 0.62, glints: 0.0045, glint: "#FFF6DA",
    },
    teal: {
      base: "#35604F",
      blobs: ["rgba(20,45,38,0.4)", "rgba(110,150,140,0.35)"],
      flecks: [["#2F5A4E", 0.3], ["#3E6C62", 0.3], ["#557F78", 0.18], ["#24483E", 0.12], ["#88AAA2", 0.08]],
      density: 0.45, glints: 0.0012, glint: "#CFE6DD",
    },
  };
  const tiles = {};
  function dropOtherScales(kind, key) {
    for (const k in tiles) if (k !== key && k.startsWith(kind + "@")) delete tiles[k];
  }
  function tile(kind, scale) {
    const key = kind + "@" + scale;
    if (tiles[key]) return tiles[key];
    dropOtherScales(kind, key);
    const sp = TILE_SPECS[kind];
    const c = document.createElement("canvas");
    c.width = c.height = TILE;
    const g = c.getContext("2d");
    const r = K.rng("lily-stars:tile:" + kind);
    g.fillStyle = sp.base;
    g.fillRect(0, 0, TILE, TILE);
    // clumps of lighter / darker glitter (wrapped so the tile repeats without seams)
    const fs = Math.max(1, scale * 0.6); // fleck unit ≈ 0.6 card units
    for (let i = 0; i < 90; i++) {
      const x = r() * TILE, y = r() * TILE, rad = fs * (2 + r() * 7);
      const col = sp.blobs[(r() * sp.blobs.length) | 0];
      for (let dx = -TILE; dx <= TILE; dx += TILE) for (let dy = -TILE; dy <= TILE; dy += TILE) {
        const X = x + dx, Y = y + dy;
        if (X < -rad || Y < -rad || X > TILE + rad || Y > TILE + rad) continue;
        const gr = g.createRadialGradient(X, Y, 0, X, Y, rad);
        gr.addColorStop(0, col);
        gr.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = gr;
        g.fillRect(X - rad, Y - rad, rad * 2, rad * 2);
      }
    }
    // flecks, grouped by colour
    const n = Math.round((TILE * TILE * sp.density) / (fs * fs));
    for (const [col, share] of sp.flecks) {
      g.fillStyle = col;
      const m = Math.round(n * share);
      for (let i = 0; i < m; i++) {
        const s = fs * (0.7 + r() * 1.1);
        g.fillRect(r() * TILE, r() * TILE, s, s * (0.7 + r() * 0.6));
      }
    }
    // bright glints, a few with a tiny cross
    g.fillStyle = sp.glint;
    const gl = Math.round(TILE * TILE * sp.glints);
    for (let i = 0; i < gl; i++) {
      const x = r() * TILE, y = r() * TILE, s = fs * (0.8 + r() * 0.9);
      g.globalAlpha = 0.7 + r() * 0.3;
      g.fillRect(x, y, s, s);
      if (r() < 0.25) {
        g.globalAlpha = 0.45;
        g.fillRect(x - s, y + s * 0.35, s * 3, s * 0.3);
        g.fillRect(x + s * 0.35, y - s, s * 0.3, s * 3);
      }
    }
    g.globalAlpha = 1;
    tiles[key] = c;
    return c;
  }
  // paper grain and fibres for the cardstock (transparent tile laid over the base colour)
  function paperTile(scale) {
    const key = "paper@" + scale;
    if (tiles[key]) return tiles[key];
    dropOtherScales("paper", key);
    const S = 384, c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d"), r = K.rng("lily-stars:tile:paper"), u = scale; // u = device px per card unit
    const n = Math.round((S * S) / (9 * u * u));
    for (const [col, share] of [["rgba(70,50,30,0.03)", 0.3], ["rgba(70,50,30,0.06)", 0.2], ["rgba(255,255,255,0.05)", 0.25], ["rgba(255,255,255,0.1)", 0.25]]) {
      g.fillStyle = col;
      for (let i = 0, m = Math.round(n * share); i < m; i++) g.fillRect(r() * S, r() * S, u * (0.6 + r() * 0.8), u * (0.6 + r() * 0.8));
    }
    g.lineCap = "round";
    for (let i = 0; i < Math.round((S * S) / (420 * u * u)); i++) {
      const x = r() * S, y = r() * S, a = r() * TAU, l = u * (1.5 + r() * 4);
      g.strokeStyle = r() < 0.6 ? `rgba(150,120,70,${0.05 + r() * 0.07})` : `rgba(255,255,250,${0.1 + r() * 0.15})`;
      g.lineWidth = u * (0.25 + r() * 0.25);
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.5, y + Math.sin(a + 0.6) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
    tiles[key] = c;
    return c;
  }
  function pattern(ctx, o, kind, ox, oy) {
    const p = ctx.createPattern(tile(kind, o.scale), "repeat");
    p.setTransform(new DOMMatrix().translate(ox, oy).scale(1 / o.scale));
    return p;
  }
  // Fill a Path2D with glitter (art) or white (foil). tex = texture stream (art only).
  function fillGlitter(ctx, o, path, kind, tex, mask) {
    if (o.layer === "foil") {
      ctx.fillStyle = mask == null ? "#fff" : `rgba(255,255,255,${mask})`;
      ctx.fill(path);
      return;
    }
    ctx.fillStyle = pattern(ctx, o, kind, tex() * 200, tex() * 200);
    ctx.fill(path);
  }
  function strokeGlitter(ctx, o, path, kind, lw, tex, mask) {
    ctx.lineWidth = lw;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    if (o.layer === "foil") {
      ctx.strokeStyle = mask == null ? "#fff" : `rgba(255,255,255,${mask})`;
      ctx.stroke(path);
      return;
    }
    ctx.strokeStyle = pattern(ctx, o, kind, tex() * 200, tex() * 200);
    ctx.stroke(path);
  }

  // Draw a soft shadow of `path` only onto pixels that are already painted (source-atop),
  // so shadows never spill into the transparent bleed (keeps the back silhouette clean).
  function atopShadow(ctx, o, path, color, blur, dx, dy) {
    const OFF = 4000;
    ctx.save();
    ctx.globalCompositeOperation = "source-atop";
    ctx.shadowColor = color;
    ctx.shadowBlur = blur * o.scale;
    ctx.shadowOffsetX = (dx - OFF) * o.scale;
    ctx.shadowOffsetY = dy * o.scale;
    ctx.translate(OFF, 0);
    ctx.fillStyle = "#000";
    ctx.fill(path);
    ctx.restore();
  }

  /* ------------------------------------------------------------------ */
  /* shapes                                                              */
  /* ------------------------------------------------------------------ */
  // 5-point star with rounded tips/valleys (punched-sticker look). jit: optional per-vertex radius jitter.
  function starPath(x, y, r, inner, rot, tipR, valR, jit) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const rr = (i % 2 ? r * inner : r) * (jit ? jit[i] : 1);
      const a = rot + (i * Math.PI) / 5;
      pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
    }
    const p = new Path2D();
    const m0 = [(pts[9][0] + pts[0][0]) / 2, (pts[9][1] + pts[0][1]) / 2];
    p.moveTo(m0[0], m0[1]);
    for (let i = 0; i < 10; i++) {
      const a = pts[i], b = pts[(i + 1) % 10];
      p.arcTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, i % 2 ? valR : tipR);
    }
    p.closePath();
    return p;
  }

  // smooth closed/open path through points (midpoint quadratic)
  function smooth(path, pts, closed, moveFirst) {
    const n = pts.length;
    if (!closed) {
      if (moveFirst !== false) path.moveTo(pts[0][0], pts[0][1]); else path.lineTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < n - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        path.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      }
      path.lineTo(pts[n - 1][0], pts[n - 1][1]);
      return path;
    }
    const m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const s = m(pts[n - 1], pts[0]);
    path.moveTo(s[0], s[1]);
    for (let i = 0; i < n; i++) {
      const a = pts[i], q = m(a, pts[(i + 1) % n]);
      path.quadraticCurveTo(a[0], a[1], q[0], q[1]);
    }
    path.closePath();
    return path;
  }

  /* ---------- lily tepals ---------- */
  // centreline in the tepal's local frame (x along the tepal, y lateral)
  function cl(T, t) {
    const k = Math.max(0, t - 0.68);
    const x = T.base + (T.len - T.base) * t - T.len * Math.abs(T.curl) * 0.55 * k * k;
    const y = T.len * (T.bow * Math.sin(Math.PI * t) + T.bend * t * t + T.curl * k * k * 1.45);
    return [x, y];
  }
  function profile(t) {
    return (0.3 + 0.7 * Math.sin(Math.PI * Math.pow(t, 0.66))) * Math.pow(Math.max(0, 1 - Math.pow(t, 2.1)), 0.62);
  }
  // world-space frame at t: centre point, unit normal (local +y side), half-widths on each side
  function frame(L, T, t) {
    const d = 0.004;
    const a = cl(T, Math.max(0, t - d)), b = cl(T, Math.min(1, t + d)), c = cl(T, t);
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1;
    tx /= l; ty /= l;
    const ca = Math.cos(T.ang), sa = Math.sin(T.ang);
    const W = (x, y) => [L.cx + x * ca - y * sa, L.cy + x * sa + y * ca];
    const p = W(c[0], c[1]);
    const nx = -ty, ny = tx; // local normal
    const n = [nx * ca - ny * sa, nx * sa + ny * ca];
    const tg = [tx * ca - ty * sa, tx * sa + ty * ca];
    const hw = T.wid * profile(t);
    const wl = 1 + T.wa * Math.sin(TAU * T.wf * t + T.p1) * Math.sin(Math.PI * t) + 0.03 * Math.sin(TAU * 7.3 * t + T.p3);
    const wr = 1 + T.wa * Math.sin(TAU * T.wf * 1.13 * t + T.p2) * Math.sin(Math.PI * t) + 0.03 * Math.sin(TAU * 6.1 * t + T.p3 * 1.7);
    return { p, n, tg, hwL: hw * wl * (1 + T.asym), hwR: hw * wr * (1 - T.asym) };
  }
  function tepalGeom(L, T) {
    const N = 34, left = [], right = [], mid = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, f = frame(L, T, t);
      left.push([f.p[0] + f.n[0] * f.hwL, f.p[1] + f.n[1] * f.hwL]);
      right.push([f.p[0] - f.n[0] * f.hwR, f.p[1] - f.n[1] * f.hwR]);
      mid.push(f.p);
    }
    // outline: left base -> tip -> right base
    const ring = left.concat(right.slice(0, -1).reverse());
    const path = new Path2D();
    path.moveTo(L.cx, L.cy);
    smooth(path, ring, false, false);
    path.closePath();
    // gilded die-cut edge (skip the base, which is hidden in the throat)
    const i0 = Math.round(N * 0.16);
    const edge = smooth(new Path2D(), left.slice(i0).concat(right.slice(i0, -1).reverse()), false);
    const spine = smooth(new Path2D(), mid.slice(1, Math.round(N * 0.88)), false);
    const iF = Math.round(N * 0.8);
    return { path, edge, spine, left, right, mid, iF, N };
  }

  /* ------------------------------------------------------------------ */
  /* composition: authored in a 300 x 290 design space; positions (not  */
  /* shapes) are stretched to the card's real size by sx, sy             */
  /* ------------------------------------------------------------------ */
  const DW = 300, DH = 290;
  const STRIPE_X = [23.5, 54.5, 82, 110, 136.5, 164.5, 190, 214.5, 242, 277];
  const STARS = [ // x, y, glitter radius, base rotation (deg)
    [19.5, 78, 10.5, -8],
    [48, 46.5, 12.5, 14],
    [104, 45, 20.5, -20],
    [59, 103, 16.5, 6],
    [172.5, 192, 16.5, -10],
    [208, 245, 20, 4],
    [247.5, 200, 16.5, 18],
    [275, 165, 11.5, -4],
  ];
  // tepal: a = direction (deg), len, wid (max half-width), bow, bend, curl (recurved tip, signed), z (0 back, 1 front)
  const LILIES = [
    {
      name: "lilyA", cx: 239, cy: 53, k: 1.1,
      tepals: [
        { a: -98, len: 98, wid: 35, bow: 0.05, bend: -0.04, curl: -1.4, z: 0 },
        { a: 35, len: 96, wid: 29, bow: -0.05, bend: 0.1, curl: 2.3, z: 0 },
        { a: 172, len: 100, wid: 37, bow: 0.06, bend: -0.12, curl: -0.9, z: 0 },
        { a: -38, len: 84, wid: 25, bow: 0.05, bend: -0.04, curl: 0.9, z: 1 },
        { a: 86, len: 98, wid: 31, bow: -0.13, bend: 0.02, curl: 0.9, z: 1 },
        { a: -157, len: 96, wid: 27, bow: 0.06, bend: -0.06, curl: -2.6, z: 1 },
      ],
      stamens: [[-11, -49], [17, -40], [-6, -31], [33, -27], [31, 3], [4, -45]],
      pistil: [22, -66],
    },
    {
      name: "lilyB", cx: 72, cy: 230, k: 1.04,
      tepals: [
        { a: -85, len: 92, wid: 31, bow: 0.04, bend: 0.03, curl: 1.8, z: 0 },
        { a: 30, len: 92, wid: 28, bow: 0.04, bend: 0.06, curl: 2.2, z: 0 },
        { a: 153, len: 98, wid: 35, bow: -0.04, bend: -0.05, curl: -0.7, z: 0 },
        { a: -37, len: 102, wid: 33, bow: -0.05, bend: 0.03, curl: 0.6, z: 1 },
        { a: 68, len: 84, wid: 33, bow: 0.06, bend: -0.04, curl: -0.6, z: 1 },
        { a: -159, len: 96, wid: 26, bow: -0.05, bend: 0.04, curl: -2.6, z: 1 },
      ],
      stamens: [[-27, -40], [-28, -23], [-13, -36], [-7, -48], [8, -33], [-19, -47]],
      pistil: [-12, -54],
    },
  ];

  function buildLily(spec, R, sx, sy) {
    const L = { name: spec.name, cx: spec.cx * sx, cy: spec.cy * sy };
    L.tepals = spec.tepals
      .map((t, i) => {
        const T = {
          z: t.z, i,
          ang: t.a * D2R + R.range(-0.025, 0.025),
          len: t.len * spec.k * R.range(0.97, 1.03),
          wid: t.wid * spec.k * R.range(0.95, 1.05),
          base: 3,
          bow: t.bow, bend: t.bend, curl: t.curl,
          wa: R.range(0.07, 0.12), wf: R.range(2.4, 3.6),
          p1: R() * TAU, p2: R() * TAU, p3: R() * TAU, asym: R.range(-0.07, 0.07),
        };
        T.g = tepalGeom(L, T);
        return T;
      })
      .sort((a, b) => a.z - b.z || a.i - b.i);
    L.sil = new Path2D();
    for (const T of L.tepals) L.sil.addPath(T.g.path);
    L.stamens = spec.stamens.map(([dx, dy]) => ({
      dx: dx * spec.k + R.range(-1.5, 1.5), dy: dy * spec.k + R.range(-1.5, 1.5),
      bend: R.range(4, 8) * (R() < 0.5 ? -1 : 1), rot: R.range(-0.6, 0.6),
    }));
    L.pistil = { dx: spec.pistil[0] * spec.k, dy: spec.pistil[1] * spec.k, bend: R.range(-5, 5) };
    return L;
  }

  /* ------------------------------------------------------------------ */
  /* painters                                                            */
  /* ------------------------------------------------------------------ */
  function paintCardStock(ctx, box, o) {
    const { w, h } = box;
    const T = o.rng("paper-tex");
    ctx.fillStyle = CARD;
    ctx.fillRect(0, 0, w, h);
    // gentle light falloff (lit from top-left)
    const lg = ctx.createLinearGradient(0, 0, w, h);
    lg.addColorStop(0, "rgba(255,252,238,0.35)");
    lg.addColorStop(0.55, "rgba(255,252,238,0)");
    lg.addColorStop(1, "rgba(140,110,60,0.10)");
    ctx.fillStyle = lg;
    ctx.fillRect(0, 0, w, h);
    // faint mottling of the stock
    for (let i = 0; i < 18; i++) {
      const x = T() * w, y = T() * h, r = 15 + T() * 45;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, T() < 0.5 ? "rgba(175,145,90,0.045)" : "rgba(255,255,248,0.07)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // grain + fibres (cached tile, aligned 1:1 with device pixels)
    const pt = ctx.createPattern(paperTile(o.scale), "repeat");
    pt.setTransform(new DOMMatrix().translate(T() * 50, T() * 50).scale(1 / o.scale));
    ctx.fillStyle = pt;
    ctx.fillRect(0, 0, w, h);
    // cut edge of the stock
    ctx.strokeStyle = "rgba(150,118,62,0.28)";
    ctx.lineWidth = 0.7;
    ctx.strokeRect(0.35, 0.35, w - 0.7, h - 0.7);
  }

  function stripePaths(box, o) {
    const R = o.rng("stripes");
    const { h } = box, sx = box.w / DW;
    return STRIPE_X.map((x0) => {
      const cx = x0 * sx + R.range(-1, 1), wd = R.range(7.5, 10.5) * sx, lean = R.range(-2.2, 2.2);
      const sw = [R.range(0.5, 1.1), R.range(45, 80), R() * TAU, R.range(0.2, 0.45), R.range(12, 22), R() * TAU];
      const eL = [R.range(0.15, 0.35), R.range(3, 6), R() * TAU, R.range(0.2, 0.4), R.range(8, 14), R() * TAU];
      const eR = [R.range(0.15, 0.35), R.range(3, 6), R() * TAU, R.range(0.2, 0.4), R.range(8, 14), R() * TAU];
      const wv = [R.range(0.04, 0.1), R.range(40, 90), R() * TAU];
      const y0 = R.range(0.8, 2.4), y1 = h - R.range(1.2, 3.2);
      const f = (p, y) => p[0] * Math.sin(y / p[1] + p[2]) + p[3] * Math.sin(y / p[4] + p[5]);
      const L = [], Rt = [];
      const steps = 58;
      for (let i = 0; i <= steps; i++) {
        const y = y0 + ((y1 - y0) * i) / steps;
        const c = cx + lean * (y / h - 0.5) + f(sw, y);
        const half = (wd * (1 + wv[0] * Math.sin(y / wv[1] + wv[2]))) / 2;
        L.push([c - half + f(eL, y), y]);
        Rt.push([c + half + f(eR, y), y]);
      }
      const p = new Path2D();
      smooth(p, L, false);
      // rounded brush end at the bottom
      const bl = L[L.length - 1], br = Rt[Rt.length - 1];
      p.quadraticCurveTo((bl[0] + br[0]) / 2, bl[1] + 1.4, br[0], br[1]);
      smooth(p, Rt.slice().reverse(), false, false);
      const tl = L[0], tr = Rt[0];
      p.quadraticCurveTo((tl[0] + tr[0]) / 2, tl[1] - 1.2, tl[0], tl[1]);
      p.closePath();
      return { p, cx, y0, y1, wd };
    });
  }

  function paintStripes(ctx, box, o) {
    const S = stripePaths(box, o);
    const art = o.layer === "art";
    const T = art ? o.rng("stripe-tex") : null;
    for (const s of S) {
      fillGlitter(ctx, o, s.p, "gold", T);
      if (!art) continue;
      // uneven paint load along the stripe: lighter and darker patches
      ctx.save();
      ctx.clip(s.p);
      const g = ctx.createLinearGradient(0, s.y0, 0, s.y1);
      for (let k = 0; k <= 8; k++) {
        const v = T();
        g.addColorStop(k / 8, v < 0.45 ? `rgba(70,48,0,${0.05 + T() * 0.2})` : v < 0.8 ? "rgba(0,0,0,0)" : `rgba(255,240,180,${0.08 + T() * 0.16})`);
      }
      ctx.fillStyle = g;
      ctx.fillRect(s.cx - 10, s.y0 - 2, 20, s.y1 - s.y0 + 4);
      // denser glitter at the brush edges
      ctx.strokeStyle = "rgba(110,80,14,0.35)";
      ctx.lineWidth = 0.9;
      ctx.stroke(s.p);
      ctx.restore();
      // a hint of relief: a soft shadow right of each stripe
      ctx.save();
      ctx.strokeStyle = "rgba(120,95,40,0.10)";
      ctx.lineWidth = 0.8;
      ctx.translate(0.5, 0.4);
      ctx.stroke(s.p);
      ctx.restore();
    }
  }

  function paintStars(ctx, box, o) {
    const R = o.rng("stars");
    const art = o.layer === "art";
    const T = art ? o.rng("star-tex") : null;
    const border = 1.7;
    const sx = box.w / DW, sy = box.h / DH, sr = 1 + (Math.min(sx, sy) - 1) * 0.5;
    const stars = STARS.map(([x0, y0, r0, rotDeg]) => {
      const x = x0 * sx, y = y0 * sy, r = r0 * sr;
      const rot = -Math.PI / 2 + (rotDeg + R.range(-4, 4)) * D2R;
      const inner = R.range(0.56, 0.6);
      return { x, y, r, rot, inner, p: starPath(x, y, r, inner, rot, r * 0.15, r * 0.09) };
    });
    const outer = (st) => starPath(st.x, st.y, st.r + border * 1.05, st.inner, st.rot, st.r * 0.17, st.r * 0.07);
    if (art) {
      // sticker shadows (raised punched card), one blurred pass for all stars
      const all = new Path2D();
      for (const st of stars) all.addPath(outer(st));
      ctx.save();
      ctx.shadowColor = "rgba(70,55,25,0.32)";
      ctx.shadowBlur = 2.2 * o.scale;
      ctx.shadowOffsetX = 0.7 * o.scale;
      ctx.shadowOffsetY = 1.1 * o.scale;
      ctx.fillStyle = TEAL;
      ctx.fill(all);
      ctx.restore();
    }
    for (const st of stars) {
      const { x, y, r, p } = st;
      if (art) {
        // teal cardstock border (a slightly larger star behind the glitter one)
        ctx.save();
        ctx.lineWidth = border * 2;
        ctx.lineJoin = "round";
        ctx.strokeStyle = pattern(ctx, o, "teal", T() * 200, T() * 200);
        ctx.stroke(p);
        ctx.restore();
        // glitter
        fillGlitter(ctx, o, p, "gold", T);
        ctx.save();
        ctx.clip(p);
        const lg = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
        lg.addColorStop(0, "rgba(255,244,196,0.22)");
        lg.addColorStop(0.5, "rgba(255,244,196,0)");
        lg.addColorStop(1, "rgba(60,40,0,0.22)");
        ctx.fillStyle = lg;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
        ctx.strokeStyle = "rgba(40,50,30,0.45)";
        ctx.lineWidth = 1.2;
        ctx.stroke(p);
        ctx.restore();
        // light catching the outer rim of the teal border
        ctx.save();
        ctx.translate(-0.35, -0.45);
        ctx.lineWidth = 0.5;
        ctx.strokeStyle = "rgba(190,215,205,0.25)";
        ctx.lineJoin = "round";
        ctx.stroke(outer(st));
        ctx.restore();
      } else {
        // the teal border hides the stripe foil underneath; the glitter shines
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        ctx.lineWidth = border * 2;
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#000";
        ctx.stroke(p);
        ctx.fillStyle = "#000";
        ctx.fill(p);
        ctx.restore();
        fillGlitter(ctx, o, p, "gold", null);
      }
    }
  }

  const SPECK = ["#B3305C", "#A1264F", "#C43E6B", "#8E1F45", "#B8385F"];
  function paintTepal(ctx, o, L, T, tex) {
    const g = T.g;
    const art = o.layer === "art";
    if (!art) {
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "#000";
      ctx.fill(g.path);
      ctx.restore();
      strokeGlitter(ctx, o, g.edge, "gold", 1.0, null, 0.85);
      return;
    }
    const tip = g.mid[g.N];
    // base colour: pale pink, creamy at the throat, deepening slightly toward the tip
    const lg = ctx.createLinearGradient(L.cx, L.cy, tip[0], tip[1]);
    lg.addColorStop(0, "#F1E3BE");
    lg.addColorStop(0.16, "#FAD0D8");
    lg.addColorStop(0.55, "#F7B6C4");
    lg.addColorStop(1, "#EF93AA");
    ctx.fillStyle = lg;
    ctx.fill(g.path);

    ctx.save();
    ctx.clip(g.path);
    // saturated rose band along the midrib, soft toward the margins
    const band = ctx.createLinearGradient(L.cx, L.cy, tip[0], tip[1]);
    band.addColorStop(0, "rgba(238,111,145,0)");
    band.addColorStop(0.14, "rgba(238,111,145,1)");
    band.addColorStop(0.7, "rgba(238,111,145,0.85)");
    band.addColorStop(1, "rgba(228,96,132,0.6)");
    ctx.strokeStyle = band;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalAlpha = 0.2;
    for (let k = 1.7; k > 0.2; k -= 0.25) { ctx.lineWidth = T.wid * k; ctx.stroke(g.spine); }
    ctx.globalAlpha = 1;
    // deeper wash at the tip (watercolour pooling)
    const tw = ctx.createRadialGradient(tip[0], tip[1], 0, tip[0], tip[1], T.len * 0.38);
    tw.addColorStop(0, "rgba(226,84,118,0.55)");
    tw.addColorStop(1, "rgba(226,84,118,0)");
    ctx.fillStyle = tw;
    ctx.fillRect(tip[0] - T.len * 0.4, tip[1] - T.len * 0.4, T.len * 0.8, T.len * 0.8);
    // watercolour blooms: uneven pigment
    for (let k = 0; k < 4; k++) {
      const fr = frame(L, T, 0.2 + tex() * 0.72), sd = (tex() * 2 - 1) * 0.7;
      const bx = fr.p[0] + fr.n[0] * T.wid * sd, by = fr.p[1] + fr.n[1] * T.wid * sd;
      const br = T.len * (0.12 + tex() * 0.2);
      const bg = ctx.createRadialGradient(bx, by, 0, bx, by, br);
      bg.addColorStop(0, tex() < 0.55 ? `rgba(232,92,126,${0.1 + tex() * 0.14})` : `rgba(255,236,240,${0.14 + tex() * 0.16})`);
      bg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = bg;
      ctx.fillRect(bx - br, by - br, br * 2, br * 2);
    }
    // fine parallel veins
    ctx.lineWidth = 0.45;
    for (const sd of [-0.62, -0.4, -0.2, 0.2, 0.4, 0.62]) {
      const vp = [];
      for (let t = 0.12; t <= 0.86; t += 0.06) {
        const fr = frame(L, T, t), hw = sd > 0 ? fr.hwL : fr.hwR, q = sd * (1 - t * 0.35);
        vp.push([fr.p[0] + fr.n[0] * hw * q, fr.p[1] + fr.n[1] * hw * q]);
      }
      ctx.strokeStyle = `rgba(208,74,112,${0.13 + tex() * 0.1})`;
      ctx.stroke(smooth(new Path2D(), vp, false));
    }
    // recurved tip: underside shows past a fold line
    if (Math.abs(T.curl) > 0.75) {
      const iF = g.iF;
      const flap = new Path2D();
      smooth(flap, g.left.slice(iF).concat(g.right.slice(iF, -1).reverse()), false);
      flap.closePath();
      ctx.fillStyle = "rgba(214,72,118,0.28)";
      ctx.fill(flap);
      const a = g.left[iF], b = g.right[iF], m = g.mid[Math.min(g.N, iF + 2)];
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.quadraticCurveTo(m[0], m[1], b[0], b[1]);
      ctx.strokeStyle = "rgba(186,52,94,0.28)";
      ctx.lineWidth = 0.9;
      ctx.stroke();
    }
    // watercolour edge: pigment pools at the margin
    ctx.strokeStyle = "rgba(214,74,110,0.5)";
    ctx.lineWidth = 3.8;
    ctx.stroke(g.path);
    ctx.strokeStyle = "rgba(196,56,96,0.35)";
    ctx.lineWidth = 1.4;
    ctx.stroke(g.path);
    // highlight crease beside the midrib (the tepal is channelled)
    ctx.save();
    const f = frame(L, T, 0.4);
    ctx.translate(f.n[0] * T.wid * 0.18, f.n[1] * T.wid * 0.18);
    ctx.strokeStyle = "rgba(255,238,244,0.3)";
    ctx.lineWidth = T.wid * 0.3;
    ctx.stroke(g.spine);
    ctx.restore();
    // deeper rose midrib streak
    ctx.strokeStyle = "rgba(214,70,114,0.32)";
    ctx.lineWidth = 2.2;
    ctx.stroke(g.spine);
    ctx.strokeStyle = "rgba(176,44,86,0.3)";
    ctx.lineWidth = 0.6;
    ctx.stroke(g.spine);
    // throat: green-yellow nectary flush at the base
    const th = ctx.createRadialGradient(L.cx, L.cy, 0, L.cx, L.cy, T.len * 0.24);
    th.addColorStop(0, "rgba(170,190,86,0.95)");
    th.addColorStop(0.4, "rgba(206,218,132,0.6)");
    th.addColorStop(1, "rgba(235,235,170,0)");
    ctx.fillStyle = th;
    ctx.beginPath();
    ctx.arc(L.cx, L.cy, T.len * 0.24, 0, TAU);
    ctx.fill();
    const ns = ctx.createLinearGradient(L.cx, L.cy, tip[0], tip[1]);
    ns.addColorStop(0, "rgba(150,175,70,0.5)");
    ns.addColorStop(0.3, "rgba(170,190,90,0)");
    ctx.strokeStyle = ns;
    ctx.lineWidth = 3.4;
    ctx.stroke(g.spine);
    // speckles, concentrated toward the throat
    const n = Math.round(T.len * 0.85);
    const dots = SPECK.flatMap(() => [new Path2D(), new Path2D()]), glints = new Path2D();
    for (let i = 0; i < n; i++) {
      const t = 0.09 + 0.72 * Math.pow(tex(), 1.35);
      const s = (tex() * 2 - 1) * 0.74;
      const fr = frame(L, T, t);
      const hw = s > 0 ? fr.hwL : fr.hwR;
      const x = fr.p[0] + fr.n[0] * hw * s, y = fr.p[1] + fr.n[1] * hw * s;
      const rad = (0.32 + tex() * 0.4) * (1.2 - t * 0.6);
      const b = dots[((tex() * SPECK.length) | 0) * 2 + (tex() < 0.5 ? 0 : 1)];
      b.moveTo(x + rad * 1.35, y);
      b.ellipse(x, y, rad * 1.35, rad, Math.atan2(fr.tg[1], fr.tg[0]), 0, TAU);
      if (tex() < 0.3) glints.rect(x - rad * 0.5, y - rad * 0.6, rad * 0.4, rad * 0.4);
    }
    for (let k = 0; k < dots.length; k++) {
      ctx.fillStyle = SPECK[k >> 1];
      ctx.globalAlpha = k & 1 ? 0.95 : 0.72;
      ctx.fill(dots[k]);
    }
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "#FFE6EE";
    ctx.fill(glints);
    ctx.globalAlpha = 1;
    ctx.restore();
    // gilded edge
    strokeGlitter(ctx, o, g.edge, "gold", 1.0, tex);
    ctx.strokeStyle = "rgba(120,60,40,0.25)";
    ctx.lineWidth = 0.35;
    ctx.stroke(g.edge);
  }

  function paintStamens(ctx, o, L, tex) {
    const art = o.layer === "art";
    const items = L.stamens.map((s) => ({ ...s, pistil: false })).concat([{ ...L.pistil, pistil: true, rot: 0 }]);
    const geo = items.map((s) => {
      const ex = L.cx + s.dx, ey = L.cy + s.dy;
      const len = Math.hypot(s.dx, s.dy) || 1;
      const ux = s.dx / len, uy = s.dy / len;
      const sx = L.cx + ux * 2, sy = L.cy + uy * 2;
      const mx = (sx + ex) / 2 - uy * s.bend, my = (sy + ey) / 2 + ux * s.bend;
      const fil = new Path2D();
      fil.moveTo(sx, sy);
      fil.quadraticCurveTo(mx, my, ex, ey);
      const dir = Math.atan2(ey - my, ex - mx);
      return { s, ex, ey, fil, dir };
    });
    if (!art) {
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "#000";
      ctx.fillStyle = "#000";
      for (const g of geo) {
        ctx.lineWidth = g.s.pistil ? 2.2 : 1.6;
        ctx.stroke(g.fil);
        ctx.beginPath();
        ctx.ellipse(g.ex, g.ey, 5.8, 2.7, g.dir + g.s.rot, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.lineCap = "round";
    // filaments: one soft shadow pass for all, then dark rims and pale cores
    const allFil = new Path2D();
    for (const g of geo) allFil.addPath(g.fil);
    ctx.save();
    ctx.shadowColor = "rgba(120,40,60,0.28)";
    ctx.shadowBlur = 1.5 * o.scale;
    ctx.shadowOffsetX = 0.5 * o.scale;
    ctx.shadowOffsetY = 0.9 * o.scale;
    ctx.strokeStyle = "#86994A";
    ctx.lineWidth = 1.8;
    ctx.stroke(allFil);
    ctx.restore();
    for (const g of geo.slice().reverse()) {
      if (g.s.pistil) {
        ctx.strokeStyle = "#6F8436";
        ctx.lineWidth = 2.4;
        ctx.stroke(g.fil);
      }
      ctx.strokeStyle = g.s.pistil ? "#B6C772" : "#D3DE9C";
      ctx.lineWidth = g.s.pistil ? 1.3 : 0.95;
      ctx.stroke(g.fil);
    }
    // stigma: a slim club that tapers off the style, not a ball
    const pg = geo[geo.length - 1];
    ctx.save();
    ctx.translate(pg.ex, pg.ey);
    ctx.rotate(pg.dir);
    ctx.fillStyle = "#5F6E2C";
    ctx.beginPath();
    ctx.moveTo(-3.2, -0.75);
    ctx.quadraticCurveTo(0.6, -1.25, 1.5, -0.35);
    ctx.quadraticCurveTo(1.85, 0, 1.5, 0.35);
    ctx.quadraticCurveTo(0.6, 1.25, -3.2, 0.75);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(214,226,150,0.6)";
    ctx.fillRect(-1.2, -0.55, 2, 0.35);
    ctx.restore();
    // anthers: one shadow pass, then each anther
    const allAn = new Path2D();
    for (const g of geo) {
      if (g.s.pistil) continue;
      allAn.moveTo(g.ex + Math.cos(g.dir + g.s.rot) * 5.3, g.ey + Math.sin(g.dir + g.s.rot) * 5.3);
      allAn.ellipse(g.ex, g.ey, 5.3, 2.1, g.dir + g.s.rot, 0, TAU);
    }
    ctx.save();
    ctx.shadowColor = "rgba(110,30,40,0.35)";
    ctx.shadowBlur = 1.4 * o.scale;
    ctx.shadowOffsetX = 0.5 * o.scale;
    ctx.shadowOffsetY = 0.9 * o.scale;
    ctx.fillStyle = "#8C3311";
    ctx.fill(allAn);
    ctx.restore();
    for (const g of geo) {
      if (g.s.pistil) continue;
      const rot = g.dir + g.s.rot;
      ctx.save();
      ctx.translate(g.ex, g.ey);
      ctx.rotate(rot);
      const ag = ctx.createLinearGradient(0, -2.1, 0, 2.1);
      ag.addColorStop(0, "#E9884A");
      ag.addColorStop(0.45, "#C8501E");
      ag.addColorStop(1, "#8C3311");
      ctx.fillStyle = ag;
      ctx.beginPath();
      ctx.ellipse(0, 0, 5.3, 2.1, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.translate(g.ex, g.ey);
      ctx.rotate(rot);
      ctx.strokeStyle = "rgba(110,36,12,0.55)";
      ctx.lineWidth = 0.35;
      ctx.beginPath();
      ctx.ellipse(0, 0, 5.3, 2.1, 0, 0, TAU);
      ctx.stroke();
      ctx.beginPath(); // pollen sac groove
      ctx.moveTo(-3.8, 0.15);
      ctx.lineTo(3.8, 0.15);
      ctx.strokeStyle = "rgba(120,40,12,0.45)";
      ctx.lineWidth = 0.3;
      ctx.stroke();
      for (let k = 0; k < 5; k++) {
        ctx.fillStyle = tex() < 0.5 ? "rgba(240,150,80,0.8)" : "rgba(130,45,15,0.7)";
        ctx.fillRect(-3.9 + tex() * 7.8, -1.3 + tex() * 2.6, 0.5, 0.5);
      }
      ctx.fillStyle = "rgba(255,210,160,0.65)";
      ctx.beginPath();
      ctx.ellipse(-0.9, -0.8, 2.6, 0.4, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  function paintLily(ctx, box, o, L) {
    const art = o.layer === "art";
    const tex = art ? o.rng(L.name + "-tex") : null;
    let front = false;
    for (const T of L.tepals) {
      if (art && T.z === 1 && !front) {
        // the front whorl casts one soft shadow onto the tepals behind it
        front = true;
        const fp = new Path2D();
        for (const F of L.tepals) if (F.z === 1) fp.addPath(F.g.path);
        atopShadow(ctx, o, fp, "rgba(150,40,75,0.30)", 3.2, 0.8, 1.4);
      }
      paintTepal(ctx, o, L, T, tex);
    }
    paintStamens(ctx, o, L, tex);
  }

  /* ---------- back + inside stars ---------- */
  function looseStar(ctx, o, x, y, r, R, T) {
    const jit = [];
    for (let i = 0; i < 10; i++) jit.push(i % 2 ? R.range(0.9, 1.12) : R.range(0.88, 1.06));
    const rot = -Math.PI / 2 + R.range(-0.45, 0.45);
    const p = starPath(x, y, r, R.range(0.47, 0.53), rot, r * 0.12, r * 0.06, jit);
    if (o.layer === "art") {
      ctx.save();
      ctx.shadowColor = "rgba(90,70,30,0.28)";
      ctx.shadowBlur = 1.6 * o.scale;
      ctx.shadowOffsetX = 0.5 * o.scale;
      ctx.shadowOffsetY = 0.8 * o.scale;
      ctx.fillStyle = "#9A781B";
      ctx.fill(p);
      ctx.restore();
      fillGlitter(ctx, o, p, "gold", T);
      ctx.save();
      ctx.clip(p);
      const lg = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
      lg.addColorStop(0, "rgba(255,246,205,0.28)");
      lg.addColorStop(0.55, "rgba(255,246,205,0)");
      lg.addColorStop(1, "rgba(70,45,0,0.2)");
      ctx.fillStyle = lg;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.strokeStyle = "rgba(110,80,14,0.35)";
      ctx.lineWidth = 0.8;
      ctx.stroke(p);
      ctx.restore();
    } else {
      fillGlitter(ctx, o, p, "gold", null);
    }
  }

  K.registerCard({
    id: "lily-stars",
    title: "Starry lilies",
    size: { w: 330, h: 295 },
    bleed: { t: 0.18, r: 0.1, b: 0.09, l: 0.1 },
    paper: "#EADFC0",
    insert: "#FBF7EF",
    ink: "#2B2722",
    foil: "gold",
    message: "Wishing you\na sky full\nof stars.",

    drawCover(ctx, box, layer, o) {
      ctx.save();
      if (layer === "art") paintCardStock(ctx, box, o);
      paintStripes(ctx, box, o);
      paintStars(ctx, box, o);
      const lilies = LILIES.map((spec) => buildLily(spec, o.rng(spec.name), box.w / DW, box.h / DH));
      if (layer === "art") {
        // die-cut layers: soft cast shadow + tight contact shadow on the card (both lilies in one pass)
        const sil = new Path2D();
        for (const L of lilies) sil.addPath(L.sil);
        atopShadow(ctx, o, sil, "rgba(95,62,40,0.30)", 7, 2.6, 4.2);
        atopShadow(ctx, o, sil, "rgba(80,45,30,0.30)", 1.6, 0.6, 1.1);
      }
      for (const L of lilies) paintLily(ctx, box, o, L);
      ctx.restore();
    },

    drawBack(ctx, box, layer, o) {
      const R = o.rng("back-stars");
      const T = layer === "art" ? o.rng("back-tex") : null;
      const { w, h } = box;
      // as seen on the inside-left page (the lily overhangs appear top-left / bottom-right here)
      const pts = [[0.27, 0.32, 21], [0.67, 0.262, 14.5], [0.54, 0.565, 18.5], [0.21, 0.74, 13], [0.73, 0.81, 20]];
      ctx.save();
      for (const [u, v, r] of pts) looseStar(ctx, o, u * w + R.range(-1, 1), v * h + R.range(-1, 1), r, R, T);
      ctx.restore();
    },

    drawInside(ctx, box, layer, o) {
      const R = o.rng("inside-star");
      const T = layer === "art" ? o.rng("inside-tex") : null;
      ctx.save();
      looseStar(ctx, o, box.w / 2, box.h * 0.78, 9.5, R, T);
      ctx.restore();
    },
  });
})();
