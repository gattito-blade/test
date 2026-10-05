/* Card 2 — "Cherry blossom": die-cut glitter-edged camellia blossoms on a deep red marker-painted panel.
   Layout comes from the "layout"/"back"/"inside" streams (both layers); texture from "tex" (art layer only). */
(function () {
  "use strict";
  const K = window.KEEPSAKE;
  const TAU = Math.PI * 2;

  /* ---------------- small geometry helpers ---------------- */
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  function polyPath(ctx, pts, closed) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    if (closed) ctx.closePath();
  }

  // Catmull-Rom through control points -> dense polyline
  function spline(cps, per) {
    per = per || 10;
    const out = [];
    for (let i = 0; i < cps.length - 1; i++) {
      const p0 = cps[Math.max(0, i - 1)], p1 = cps[i], p2 = cps[i + 1], p3 = cps[Math.min(cps.length - 1, i + 2)];
      for (let j = 0; j < per; j++) {
        const t = j / per, t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
      }
    }
    out.push(cps[cps.length - 1].slice());
    return out;
  }

  // shift a polyline sideways by d (positive = left of travel direction)
  function offsetPoly(pts, d) {
    return pts.map((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      return [p[0] + (dy / l) * d, p[1] - (dx / l) * d];
    });
  }

  /* ---------------- glitter edge ----------------
     Strokes a polyline with a band of glitter. Art: the band is stroked with a tile of coloured flecks
     (one device pixel per tile pixel, so flecks stay ~1-2px at any scale) plus a few loose glints.
     Foil: a white stroke of the same band. Flecks come from the art-only texture stream. */
  const ROSE_GLITTER = {
    base: "#BE1750",
    flecks: [["#D92D68", 0.32], ["#EE5C8E", 0.18], ["#FFC2D4", 0.1], ["#9C0E3B", 0.26], ["#F67FA6", 0.08], ["#F3E4EA", 0.06]],
    glint: "rgba(255,246,250,0.95)",
  };
  function glitterPattern(ctx, S) {
    const pal = S.pal || ROSE_GLITTER;
    if (S.pat && S.patPal === pal) return S.pat;
    const T = S.tex, N = 128;
    const c = document.createElement("canvas");
    c.width = c.height = N;
    const x = c.getContext("2d");
    x.fillStyle = pal.base;
    x.fillRect(0, 0, N, N);
    const cum = []; let acc = 0;
    pal.flecks.forEach((f) => { acc += f[1]; cum.push(acc); });
    const paths = pal.flecks.map(() => new Path2D());
    for (let i = 0; i < N * N * 0.55; i++) {
      const s = T() < 0.7 ? 1 : 2, pick = T() * acc;
      let k = 0; while (k < cum.length - 1 && pick > cum[k]) k++;
      paths[k].rect((T() * N) | 0, (T() * N) | 0, s, s);
    }
    paths.forEach((p, k) => { x.fillStyle = pal.flecks[k][0]; x.fill(p); });
    x.fillStyle = pal.glint;
    for (let i = 0; i < N * N * 0.008; i++) x.fillRect((T() * N) | 0, (T() * N) | 0, 1, 1);
    const pat = ctx.createPattern(c, "repeat");
    pat.setTransform(new DOMMatrix([1 / S.scale, 0, 0, 1 / S.scale, 0, 0]));
    S.pat = pat; S.patPal = pal;
    return pat;
  }
  function glitterEdge(ctx, pts, closed, gw, S) {
    ctx.save();
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    polyPath(ctx, pts, closed);
    if (S.foil) {
      ctx.lineWidth = gw + 0.3;
      ctx.strokeStyle = "#fff";
      ctx.stroke();
      ctx.restore();
      return;
    }
    const pal = S.pal || ROSE_GLITTER, T = S.tex;
    ctx.lineWidth = gw;
    ctx.strokeStyle = glitterPattern(ctx, S);
    ctx.stroke();
    // loose glints and a few chunkier flakes so the tile never reads as a repeat
    const n = pts.length, segs = closed ? n : n - 1, fs = S.fleck;
    const flakes = new Path2D(), glints = new Path2D();
    for (let i = 0; i < segs; i++) {
      if (T() > 0.42) continue;
      const a = pts[i], b = pts[(i + 1) % n], t = T(), o = (T() - 0.5) * gw;
      const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
      const x = a[0] + dx * t - (dy / len) * o, y = a[1] + dy * t + (dx / len) * o, s = fs * (1 + T());
      (T() < 0.4 ? glints : flakes).rect(x - s / 2, y - s / 2, s, s);
    }
    ctx.fillStyle = pal.flecks[0][0]; ctx.fill(flakes);
    ctx.fillStyle = pal.glint; ctx.fill(glints);
    ctx.restore();
  }

  // copy of a closed polygon moved inward by d along vertex normals
  function insetPoly(pts, d) {
    const n = pts.length;
    let A = 0;
    for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; A += a[0] * b[1] - b[0] * a[1]; }
    const sg = A > 0 ? 1 : -1;
    return pts.map((p, i) => {
      const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      return [p[0] - sg * (dy / l) * d, p[1] + sg * (dx / l) * d];
    });
  }

  // An opaque shape painted over earlier foil must knock the foil out underneath it.
  function knockOut(ctx, S) {
    if (!S.foil) return;
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "#000";
    ctx.fill();
    ctx.restore();
  }

  /* ---------------- blossom layout ---------------- */
  // spec: {x, y, R, sq (vertical squash for 3/4 view), rot, cup (inner rings shift, fraction of R), rings?}
  function makeBlossom(L, spec) {
    const R = spec.R;
    // outer ring of broad petals, then a few big cupped petals set off-axis so their cut edges cross the
    // flower (camellia), then a small inner cup around the stamens
    const rings = spec.rings || [
      { n: 5, len: [0.84, 1.04], hw: 0.54, base: 0.1, gw: 1.85, jit: 0.2, tilt: 0.14, shift: 0.03 },
      { n: L.int(3, 4), len: [0.8, 0.92], hw: 0.52, base: 0.08, gw: 1.65, jit: 0.22, tilt: 0.28, shift: 0.08 },
      { n: L.int(2, 3), len: [0.42, 0.54], hw: 0.42, base: 0.05, gw: 1.4, jit: 0.25, tilt: 0.3, shift: 0.06 },
    ];
    const cr = Math.cos(spec.rot || 0), sr = Math.sin(spec.rot || 0), sq = spec.sq || 1;
    const world = (x, y) => { y *= sq; return [spec.x + x * cr - y * sr, spec.y + x * sr + y * cr]; };
    const petals = [];
    const a0 = L() * TAU;
    rings.forEach((rg, k) => {
      const step = TAU / rg.n;
      const off = a0 + k * step * 0.5 + L.range(-0.4, 0.4);
      const cup = (spec.cup || 0) * R * k;
      for (let i = 0; i < rg.n; i++) {
        const ang = off + i * step + L.range(-1, 1) * (rg.jit == null ? 0.16 : rg.jit) * step;
        const axis = ang + L.range(-1, 1) * (rg.tilt || 0);
        const sh = R * (rg.shift || 0) * L.range(-1, 1), sa0 = L() * TAU;
        const ox = Math.cos(sa0) * sh, oy = Math.sin(sa0) * sh - cup;
        const len = R * L.range(rg.len[0], rg.len[1]);
        const hw = R * rg.hw * L.range(0.88, 1.08);
        const rb = R * rg.base;
        const ruf = { k1: L.int(3, 5), p1: L() * TAU, k2: L.int(7, 10), p2: L() * TAU, amp: L.range(0.025, 0.05), notch: L() < 0.55 ? L.range(0.03, 0.07) : 0, skew: L.range(-0.12, 0.12) };
        const ca = Math.cos(axis), sa = Math.sin(axis);
        const tf = (u, v) => world(ox + u * ca - v * sa, oy + u * sa + v * ca);
        petals.push({ ring: k, gw: rg.gw * (spec.gwScale || 1), len, hw, rb, tf, pts: petalOutline(tf, len, hw, rb, ruf) });
      }
    });
    return { spec, petals, center: world(0, -(spec.cup || 0) * R * (rings.length - 0.6)), world };
  }

  function petalOutline(tf, len, hw, rb, ruf) {
    const N = 52, pts = [];
    const c = (rb + len) / 2, a = (len - rb) / 2;
    for (let j = 0; j < N; j++) {
      let s = (j / N) * TAU; // 0 = tip
      const cs = Math.cos(s), sn = Math.sin(s);
      const sw = s > Math.PI ? s - TAU : s; // -pi..pi
      const narrow = 1 - 0.55 * Math.pow(Math.max(0, -cs), 1.3);
      const uu = cs > 0 ? Math.pow(cs, 0.82) : -Math.pow(-cs, 1.05);
      const vv = Math.sign(sn) * Math.pow(Math.abs(sn), 0.8) * narrow;
      const wgt = clamp((cs + 0.35) / 0.8, 0, 1);
      let e = ruf.amp * (0.62 * Math.sin(ruf.k1 * s + ruf.p1) + 0.38 * Math.sin(ruf.k2 * s + ruf.p2)) * wgt;
      e -= ruf.notch * Math.exp(-Math.pow((sw - ruf.skew) / 0.2, 2));
      const u = rb + (c + a * uu - rb) * (1 + e);
      const v = hw * vv * (1 + e) + ruf.skew * hw * 0.25 * Math.max(0, cs);
      pts.push(tf(u, v));
    }
    return pts;
  }

  /* ---------------- blossom painting ---------------- */
  // style: "cover" (pink painted petals on red) or "line" (white petals with glitter outlines, for back/inside)
  function paintBlossom(ctx, B, S, style) {
    const line = style === "line";
    // die-cut shadow onto the panel (art only, clipped to the card rectangle)
    if (!S.foil && !line) {
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, S.w, S.h); ctx.clip();
      ctx.beginPath();
      B.petals.forEach((p) => { if (p.ring === 0) { ctx.moveTo(p.pts[0][0], p.pts[0][1]); for (const q of p.pts) ctx.lineTo(q[0], q[1]); ctx.closePath(); } });
      ctx.shadowColor = "rgba(45,0,8,0.55)";
      ctx.shadowBlur = 5 * S.scale;
      ctx.shadowOffsetX = 1.4 * S.scale;
      ctx.shadowOffsetY = 2.4 * S.scale;
      ctx.fillStyle = "#C2385F";
      ctx.fill("nonzero");
      ctx.restore();
    }
    for (const p of B.petals) paintPetal(ctx, p, S, line);
    const c = B.center, R = B.spec.R;
    if (line) {
      // open heart of the line flower: the petal bases disappear under a clean paper centre
      ctx.beginPath(); ctx.ellipse(c[0], c[1], R * 0.24, R * 0.24 * Math.max(0.8, B.spec.sq || 1), 0, 0, TAU);
      if (S.foil) knockOut(ctx, S);
      else { ctx.fillStyle = "#FFFCFB"; ctx.fill(); }
    }
    if (!S.foil) {
      // soft throat colour where petals meet
      const g = ctx.createRadialGradient(c[0], c[1], R * 0.08, c[0], c[1], R * (line ? 0.3 : 0.4));
      g.addColorStop(0, line ? "rgba(240,170,120,0.35)" : "rgba(214,72,112,0.55)");
      g.addColorStop(1, line ? "rgba(240,170,120,0)" : "rgba(214,72,112,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(c[0], c[1], R * 0.42, 0, TAU); ctx.fill();
    }
    paintStamens(ctx, c, R * (line ? 0.15 : 0.17), S, line, B.spec.sq || 1);
  }

  function paintPetal(ctx, p, S, line) {
    polyPath(ctx, p.pts, true);
    if (S.foil) {
      knockOut(ctx, S);
      glitterEdge(ctx, p.pts, true, p.gw, S);
      return;
    }
    const T = S.tex;
    const base = p.tf(p.rb, 0), tip = p.tf(p.len, 0), mid = p.tf(lerp(p.rb, p.len, 0.64), 0);
    const gr = ctx.createLinearGradient(base[0], base[1], tip[0], tip[1]);
    if (line) {
      gr.addColorStop(0, "#F9E6E8"); gr.addColorStop(0.35, "#FEFAFA"); gr.addColorStop(1, "#FFFFFF");
    } else {
      gr.addColorStop(0, "#DC6F8B"); gr.addColorStop(0.3, "#EE93A8"); gr.addColorStop(0.68, "#F6A8B9"); gr.addColorStop(1, "#F9B6C5");
    }
    ctx.save();
    if (p.ring > 0 && !line) {
      ctx.shadowColor = "rgba(150,18,58,0.5)";
      ctx.shadowBlur = 3.4 * S.scale;
      ctx.shadowOffsetX = 0.5 * S.scale;
      ctx.shadowOffsetY = 1.2 * S.scale;
    }
    ctx.fillStyle = gr;
    ctx.fill();
    ctx.restore();

    if (!line) {
      // soft light on the open face of the petal, a deeper blush at its base, a watercolour bloom
      // (filled through the petal path itself: no clip needed)
      const hr = p.len * 0.45;
      const hg = ctx.createRadialGradient(mid[0], mid[1], 0, mid[0], mid[1], hr);
      hg.addColorStop(0, "rgba(255,222,230,0.5)"); hg.addColorStop(1, "rgba(255,222,230,0)");
      ctx.fillStyle = hg;
      ctx.fill();
      const br = p.len * 0.5;
      const bg0 = ctx.createRadialGradient(base[0], base[1], 0, base[0], base[1], br);
      bg0.addColorStop(0, "rgba(205,62,104,0.45)"); bg0.addColorStop(1, "rgba(205,62,104,0)");
      ctx.fillStyle = bg0;
      ctx.fill();
      const q = p.tf(lerp(p.rb, p.len, 0.35 + T() * 0.55), (T() - 0.5) * p.hw * 1.2), r = p.len * (0.14 + T() * 0.18);
      const bg = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], r);
      const dark = T() < 0.5;
      bg.addColorStop(0, dark ? "rgba(226,104,136,0.24)" : "rgba(255,206,218,0.32)");
      bg.addColorStop(1, dark ? "rgba(226,104,136,0)" : "rgba(255,206,218,0)");
      ctx.fillStyle = bg;
      ctx.fill();
    }
    ctx.save();
    // coloured-pencil deepening just inside the cut edge: rings between the outline and inset copies
    // (even-odd fills instead of a clipped stroke — much cheaper to rasterise)
    const ring = (d, col) => {
      const inner = insetPoly(p.pts, d);
      polyPath(ctx, p.pts, true);
      ctx.moveTo(inner[0][0], inner[0][1]);
      for (let i = inner.length - 1; i > 0; i--) ctx.lineTo(inner[i][0], inner[i][1]);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill("evenodd");
    };
    if (!line) {
      ring(3, "rgba(226,96,130,0.2)");
      ring(1.5, "rgba(206,64,104,0.26)");
      // pencil tooth: fine light and dark grain scattered inside the petal
      const ctr = p.tf((p.rb + p.len) / 2, 0), np = p.pts.length;
      const ng = Math.round(p.len * p.hw * 0.22), lp = new Path2D(), dp = new Path2D(), fs = S.fleck * 1.25;
      for (let i = 0; i < ng; i++) {
        const j = (T() * np) | 0, q0 = p.pts[j], q1 = p.pts[(j + 1) % np], t = T(), k = Math.sqrt(T()) * 0.94;
        const x = lerp(ctr[0], lerp(q0[0], q1[0], t), k), y = lerp(ctr[1], lerp(q0[1], q1[1], t), k), sz = fs * (0.6 + T());
        (T() < 0.5 ? lp : dp).rect(x, y, sz, sz * (0.6 + T() * 0.8));
      }
      ctx.fillStyle = "rgba(255,236,240,0.24)"; ctx.fill(lp);
      ctx.fillStyle = "rgba(200,70,108,0.22)"; ctx.fill(dp);
    } else {
      ring(2.2, "rgba(240,160,185,0.2)");
    }
    // pencil veining: feathered strokes in from the cut edge, longer streaks out from the base
    const nv = line ? 5 + ((T() * 4) | 0) : 14 + ((T() * 10) | 0);
    ctx.lineCap = "round";
    const vp = [new Path2D(), new Path2D(), new Path2D()];
    for (let i = 0; i < nv; i++) {
      const fromEdge = T() < 0.66;
      const v0 = (T() - 0.5) * 2;
      let a, b;
      if (fromEdge) {
        const u0 = lerp(p.rb, p.len, 0.9 - v0 * v0 * 0.28);
        const ln = p.len * (line ? 0.08 + T() * 0.1 : 0.07 + T() * 0.2);
        const vv = v0 * p.hw * 0.8;
        a = [u0, vv]; b = [u0 - ln, vv * (1 - (ln / p.len) * 0.8)];
      } else {
        const ln = p.len * (0.14 + T() * 0.22), sp = (T() - 0.5) * 0.9;
        a = [p.rb + p.len * 0.06, v0 * p.hw * 0.1]; b = [a[0] + ln, a[1] + ln * sp];
      }
      const bend = (T() - 0.5) * p.hw * 0.06;
      const A = p.tf(a[0], a[1]), Bp = p.tf(b[0], b[1]), Cp = p.tf((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + bend);
      const vk = vp[(T() * 3) | 0];
      vk.moveTo(A[0], A[1]);
      vk.quadraticCurveTo(Cp[0], Cp[1], Bp[0], Bp[1]);
    }
    const vs = line
      ? [[0.35, "rgba(222,96,134,0.35)"], [0.5, "rgba(222,96,134,0.45)"], [0.6, "rgba(214,86,124,0.5)"]]
      : [[0.38, "rgba(184,52,92,0.36)"], [0.55, "rgba(198,66,104,0.42)"], [0.75, "rgba(176,46,88,0.5)"]];
    vp.forEach((pth, k) => { ctx.lineWidth = vs[k][0]; ctx.strokeStyle = vs[k][1]; ctx.stroke(pth); });
    ctx.restore();
    glitterEdge(ctx, p.pts, true, p.gw, S);
  }

  function paintStamens(ctx, c, r, S, line, sq) {
    const ry = Math.max(0.8, sq);
    if (S.foil) {
      ctx.save();
      ctx.beginPath(); ctx.ellipse(c[0], c[1], r * 1.02, r * 1.02 * ry, 0, 0, TAU);
      ctx.fillStyle = line ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.5)";
      ctx.fill();
      ctx.restore();
      return;
    }
    const T = S.tex;
    ctx.save();
    // filaments radiating past the pollen heart
    ctx.lineCap = "round";
    const nf = line ? 16 : 12;
    for (let i = 0; i < nf; i++) {
      const a = (i / nf) * TAU + T() * 0.35, l = r * (line ? 1.5 + T() * 1.1 : 1.05 + T() * 0.35);
      ctx.beginPath();
      ctx.moveTo(c[0] + Math.cos(a) * r * 0.5, c[1] + Math.sin(a) * r * 0.5 * ry);
      ctx.lineTo(c[0] + Math.cos(a) * l, c[1] + Math.sin(a) * l * ry);
      ctx.lineWidth = 0.35 + T() * 0.3;
      ctx.strokeStyle = line ? (T() < 0.5 ? "rgba(214,80,120,0.7)" : "rgba(214,150,60,0.75)") : "rgba(190,104,36,0.8)";
      ctx.stroke();
      ctx.beginPath(); ctx.arc(c[0] + Math.cos(a) * l, c[1] + Math.sin(a) * l * ry, line ? 0.45 + T() * 0.3 : 0.6 + T() * 0.4, 0, TAU);
      ctx.fillStyle = line ? "#E2A23A" : "#EDB64E"; ctx.fill();
    }
    const g = ctx.createRadialGradient(c[0] - r * 0.25, c[1] - r * 0.3, r * 0.1, c[0], c[1], r * 1.1);
    g.addColorStop(0, line ? "#F8DFA0" : "#FFD47A");
    g.addColorStop(0.55, line ? "#EDBE62" : "#DE9630");
    g.addColorStop(1, line ? "#D9A050" : "#A4561C");
    ctx.beginPath();
    for (let i = 0; i <= 22; i++) {
      const a = (i / 22) * TAU, rr = r * (0.9 + 0.1 * Math.sin(i * 2.7 + 1) + 0.06 * Math.sin(i * 5.3));
      const x = c[0] + Math.cos(a) * rr, y = c[1] + Math.sin(a) * rr * ry;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.save();
    ctx.translate(r * 0.06, r * 0.1);
    ctx.lineWidth = r * 0.22; ctx.lineJoin = "round";
    ctx.strokeStyle = line ? "rgba(200,120,90,0.25)" : "rgba(150,30,50,0.35)";
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = g;
    ctx.fill();
    // granular pollen: many small beads, each with a shaded underside and a lit top
    const nd = line ? 30 : 70;
    const cols = line ? ["#E9B456", "#F3CF7E", "#D79A3A"] : ["#E6A538", "#F3C25A", "#CF7F1E", "#FBD58A", "#E9A940"];
    const shade = new Path2D(), lit = cols.map(() => new Path2D()), hi = new Path2D();
    for (let i = 0; i < nd; i++) {
      const a = T() * TAU, d = Math.sqrt(T()) * r * 0.92;
      const x = c[0] + Math.cos(a) * d, y = c[1] + Math.sin(a) * d * ry, rr = r * (0.075 + T() * 0.075);
      shade.moveTo(x + rr * 1.3, y + rr * 0.35); shade.arc(x + rr * 0.3, y + rr * 0.35, rr, 0, TAU);
      const k = (T() * cols.length) | 0;
      lit[k].moveTo(x + rr, y); lit[k].arc(x, y, rr, 0, TAU);
      if (T() < 0.3) { hi.moveTo(x - rr * 0.1, y - rr * 0.35); hi.arc(x - rr * 0.35, y - rr * 0.35, rr * 0.35, 0, TAU); }
    }
    ctx.fillStyle = "rgba(130,58,8,0.45)"; ctx.fill(shade);
    lit.forEach((pth, k) => { ctx.fillStyle = cols[k]; ctx.fill(pth); });
    ctx.fillStyle = "rgba(255,248,215,0.85)"; ctx.fill(hi);
    for (let i = 0; i < (line ? 3 : 6); i++) {
      const a = T() * TAU, d = Math.sqrt(T()) * r * 0.8;
      const x = c[0] + Math.cos(a) * d, y = c[1] + Math.sin(a) * d * ry, s = r * 0.09;
      ctx.fillStyle = "rgba(255,252,235,0.95)";
      ctx.fillRect(x - s / 2, y - s / 2, s, s);
    }
    ctx.restore();
  }

  /* ---------------- leaves, stems, buds ---------------- */
  // lanceolate leaf from base b to tip t, max width wd, bend = sideways bow of the midrib
  function leafShape(b, t, wd, bend) {
    const dx = t[0] - b[0], dy = t[1] - b[1], l = Math.hypot(dx, dy);
    const nx = -dy / l, ny = dx / l, N = 22;
    const mid = [], left = [], right = [];
    for (let i = 0; i <= N; i++) {
      const s = i / N;
      const m = [b[0] + dx * s + nx * bend * Math.sin(Math.PI * s), b[1] + dy * s + ny * bend * Math.sin(Math.PI * s)];
      const hw = (wd / 2) * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.78)), 0.9);
      mid.push(m);
      left.push([m[0] + nx * hw, m[1] + ny * hw]);
      right.push([m[0] - nx * hw, m[1] - ny * hw]);
    }
    return { mid, left, right, outline: left.concat(right.slice().reverse()), nx, ny, l };
  }

  function paintLeaf(ctx, lf, S, tone) {
    polyPath(ctx, lf.outline, true);
    if (S.foil) { knockOut(ctx, S); return; }
    const T = S.tex;
    const greens = tone ? ["#3E964A", "#2C7A3A", "#62AE68"] : ["#48A053", "#33833F", "#6DB873"];
    ctx.save();
    ctx.fillStyle = greens[0];
    ctx.fill();
    // folded half in the darker green
    ctx.beginPath();
    ctx.moveTo(lf.mid[0][0], lf.mid[0][1]);
    lf.left.forEach((q) => ctx.lineTo(q[0], q[1]));
    for (let i = lf.mid.length - 1; i >= 0; i--) ctx.lineTo(lf.mid[i][0], lf.mid[i][1]);
    ctx.closePath();
    ctx.fillStyle = greens[1];
    ctx.globalAlpha = 0.55;
    ctx.fill();
    ctx.globalAlpha = 1;
    // marker streaks along the blade (kept inside the blade by construction, so no clip is needed)
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    const lightS = new Path2D(), darkS = new Path2D(), last = lf.mid.length - 1;
    for (let i = 0; i < 11; i++) {
      const off = (T() - 0.5) * 1.2, s0 = 0.1 + T() * 0.25, s1 = 0.55 + T() * 0.27;
      const pth = T() < 0.55 ? lightS : darkS;
      for (let k = 0; k <= 6; k++) {
        const sv = lerp(s0, s1, k / 6), idx = Math.round(sv * last);
        const m = lf.mid[idx], L = lf.left[idx];
        const x = lerp(m[0], L[0], off), y = lerp(m[1], L[1], off);
        k ? pth.lineTo(x, y) : pth.moveTo(x, y);
      }
    }
    ctx.lineWidth = 1.6; ctx.strokeStyle = "rgba(150,218,140,0.22)"; ctx.stroke(lightS);
    ctx.lineWidth = 1.2; ctx.strokeStyle = "rgba(24,84,36,0.2)"; ctx.stroke(darkS);
    // edge darkening: a thin ring just inside the outline
    const inner = insetPoly(lf.outline, 1.1);
    polyPath(ctx, lf.outline, true);
    ctx.moveTo(inner[0][0], inner[0][1]);
    for (let i = inner.length - 1; i > 0; i--) ctx.lineTo(inner[i][0], inner[i][1]);
    ctx.closePath();
    ctx.fillStyle = "rgba(25,90,40,0.38)";
    ctx.fill("evenodd");
    ctx.restore();
    // midrib
    const rib = lf.mid.slice(1, Math.round(lf.mid.length * 0.88));
    polyPath(ctx, rib, false);
    ctx.lineCap = "round";
    ctx.lineWidth = 0.75;
    ctx.strokeStyle = "rgba(30,100,48,0.85)";
    ctx.stroke();
    polyPath(ctx, offsetPoly(rib, 0.6), false);
    ctx.lineWidth = 0.4;
    ctx.strokeStyle = "rgba(170,230,170,0.45)";
    ctx.stroke();
    polyPath(ctx, lf.outline, true);
    ctx.lineJoin = "round";
    ctx.lineWidth = 0.55;
    ctx.strokeStyle = "#2D7A39";
    ctx.stroke();
  }

  function paintStem(ctx, pts, sw, S) {
    if (S.foil) return; // stems sit under every foil element
    ctx.save();
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    polyPath(ctx, pts, false);
    ctx.lineWidth = sw + 1.1; ctx.strokeStyle = "#2D7A39"; ctx.stroke();
    ctx.lineWidth = sw; ctx.strokeStyle = "#3E9B4A"; ctx.stroke();
    polyPath(ctx, offsetPoly(pts, sw * 0.24), false);
    ctx.lineWidth = sw * 0.3; ctx.strokeStyle = "rgba(128,204,128,0.5)"; ctx.stroke();
    polyPath(ctx, offsetPoly(pts, -sw * 0.3), false);
    ctx.lineWidth = sw * 0.22; ctx.strokeStyle = "rgba(30,100,45,0.35)"; ctx.stroke();
    ctx.restore();
  }

  // closed bud: base point, tip point, half width
  function makeBud(L, b, t, wb) {
    const dx = t[0] - b[0], dy = t[1] - b[1], l = Math.hypot(dx, dy);
    const ux = dx / l, uy = dy / l, nx = -uy, ny = ux;
    const P = (s, w) => [b[0] + ux * s * l + nx * w, b[1] + uy * s * l + ny * w];
    const hwAt = (s) => wb * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.8)), 0.68) * (1 - 0.1 * s);
    const N = 26, left = [], right = [];
    for (let i = 0; i <= N; i++) { const s = i / N, h = hwAt(s); left.push(P(s, h)); right.push(P(s, -h)); }
    const full = left.concat(right.slice(1, -1).reverse());
    // a wrapping front petal: up the right side to near the tip, then sweeping down across to the left side
    const sk = L.range(0.82, 0.9), sl = L.range(0.3, 0.42);
    const wrap = [];
    for (let i = 0; i <= N; i++) { const s = (i / N) * sk; wrap.push(P(s, -hwAt(s))); }
    for (let i = 1; i <= 14; i++) {
      const q = i / 14, s = lerp(sk, sl, q);
      const w = lerp(-hwAt(sk), hwAt(sl), Math.pow(q, 0.8)) + Math.sin(q * Math.PI) * wb * 0.18;
      wrap.push(P(s, w));
    }
    for (let i = Math.round(sl * N); i >= 0; i--) { const s = i / N; wrap.push(P(s, hwAt(s))); }
    const sepals = [
      leafShape(P(0.0, 0), P(0.36, wb * 0.15), wb * 0.6, 0),
      leafShape(P(-0.02, 0), P(0.56, wb * 1.0), wb * 0.95, -wb * 0.12),
      leafShape(P(-0.02, 0), P(0.5, -wb * 0.98), wb * 0.9, wb * 0.12),
    ];
    return { full, wrap, sepals, P, l, wb };
  }

  function paintBud(ctx, bud, S) {
    // die-cut shadow
    if (!S.foil) {
      ctx.save();
      polyPath(ctx, bud.full, true);
      ctx.shadowColor = "rgba(45,0,8,0.5)";
      ctx.shadowBlur = 4 * S.scale; ctx.shadowOffsetX = 1.2 * S.scale; ctx.shadowOffsetY = 2 * S.scale;
      ctx.fillStyle = "#C2385F"; ctx.fill();
      ctx.restore();
    }
    const fake = (pts, k) => ({ ring: k, gw: 1.55, pts, len: bud.l, hw: bud.wb, rb: 0, tf: (u, v) => bud.P(u / bud.l, v) });
    paintPetal(ctx, fake(bud.full, 0), S, false);
    paintPetal(ctx, fake(bud.wrap, 1), S, false);
    bud.sepals.forEach((sp, i) => paintLeaf(ctx, sp, S, i % 2 === 0));
  }

  /* ---------------- the red marker-painted panel ---------------- */
  function paintPanel(ctx, w, h, T, scale) {
    // white card base peeks out as a thin rim
    ctx.fillStyle = "#F6F4F2";
    ctx.fillRect(0, 0, w, h);
    const x0 = 1.0, y0 = 1.1, x1 = w - 2.2, y1 = h - 2.4;
    ctx.save();
    ctx.shadowColor = "rgba(60,10,15,0.35)";
    ctx.shadowBlur = 2 * scale; ctx.shadowOffsetX = 0.6 * scale; ctx.shadowOffsetY = 0.8 * scale;
    ctx.fillStyle = "#B20C1F";
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.restore();
    ctx.save();
    ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip();
    const g = ctx.createLinearGradient(0, 0, w * 0.6, h);
    g.addColorStop(0, "#C8132A"); g.addColorStop(0.5, "#BC1026"); g.addColorStop(1, "#A00C1D");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // mottling
    for (let i = 0; i < 34; i++) {
      const x = T() * w, y = T() * h, r = 14 + T() * 42, light = T() < 0.5;
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, light ? "rgba(222,34,52,0.16)" : "rgba(110,0,14,0.16)");
      rg.addColorStop(1, light ? "rgba(222,34,52,0)" : "rgba(110,0,14,0)");
      ctx.fillStyle = rg;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // alcohol-marker streaks: long overlapping strokes with darker overlap edges
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (let i = 0; i < 90; i++) {
      const x = T() * (w + 40) - 20, y = T() * (h + 40) - 20;
      const ang = -Math.PI / 2 + 0.35 + (T() - 0.5) * 0.5, len = 50 + T() * 140;
      const cx = x + Math.cos(ang) * len * 0.5 + (T() - 0.5) * 16, cy = y + Math.sin(ang) * len * 0.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(cx, cy, x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      const lw = 3.5 + T() * 5;
      const k = T();
      ctx.lineWidth = lw;
      ctx.strokeStyle = k < 0.45 ? `rgba(222,30,52,${0.07 + T() * 0.08})` : k < 0.85 ? `rgba(118,0,16,${0.06 + T() * 0.07})` : `rgba(240,74,88,${0.05 + T() * 0.06})`;
      ctx.stroke();
      if (T() < 0.5) {
        ctx.lineWidth = 0.5;
        ctx.strokeStyle = "rgba(95,0,12,0.12)";
        ctx.stroke();
      }
    }
    // fine speckle of lighter pigment and dark grain
    const lightP = new Path2D(), darkP = new Path2D(), pinkP = new Path2D();
    const fs = Math.max(0.4, 1 / scale);
    for (let i = 0; i < 3200; i++) {
      const x = T() * w, y = T() * h, s = fs * (0.6 + T() * 1.1), k = T();
      (k < 0.45 ? lightP : k < 0.9 ? darkP : pinkP).rect(x, y, s, s);
    }
    ctx.fillStyle = "rgba(240,90,100,0.22)"; ctx.fill(lightP);
    ctx.fillStyle = "rgba(80,0,10,0.22)"; ctx.fill(darkP);
    ctx.fillStyle = "rgba(255,170,180,0.3)"; ctx.fill(pinkP);
    // gentle vignette
    const v = ctx.createRadialGradient(w * 0.5, h * 0.45, Math.min(w, h) * 0.3, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
    v.addColorStop(0, "rgba(70,0,10,0)"); v.addColorStop(1, "rgba(70,0,10,0.28)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  /* ---------------- scene layout (shared by both layers) ---------------- */
  function coverScene(L) {
    const blossoms = [
      // back-to-front
      makeBlossom(L, { x: 197, y: 50, R: 60, sq: 0.74, rot: -0.12, cup: -0.05 }),   // top-right, 3/4 view, overflows right
      makeBlossom(L, { x: 185, y: 203, R: 51, sq: 0.94, rot: 0.1, cup: 0.0 }),     // centre-right
      makeBlossom(L, { x: 79, y: 36, R: 58, sq: 0.93, rot: 0.05, cup: 0.0 }),      // top-centre, overflows top
      makeBlossom(L, { x: 45, y: 142, R: 61, sq: 0.84, rot: -0.06, cup: 0.0 }),    // mid-left, overflows left
      makeBlossom(L, { x: 59, y: 285, R: 58, sq: 0.92, rot: 0.0, cup: 0.0 }),      // bottom-left, overflows left/bottom
    ];
    const buds = [
      makeBud(L, [197, 143], [222, 96], 17.5),   // right-middle
      makeBud(L, [102, 220], [100, 172], 16.5),    // small, centre-left
    ];
    const main = spline([[124, 322], [126, 276], [132, 238], [137, 190], [141, 150], [143, 108], [145, 60], [147, -2]], 12);
    const branch = spline([[126, 272], [114, 254], [100, 237], [87, 222], [77, 206], [71, 186]], 10);
    const budStemL = spline([[115, 254], [108, 238], [103, 224]], 8);
    const budStemR = spline([[189, 188], [193, 168], [198, 143]], 8);
    const leaves = [
      { b: [142, 88], t: [120, 56], wd: 13, bend: 2.5, tone: 1 },
      { b: [151, 102], t: [177, 68], wd: 15.5, bend: -2.5, tone: 0 },
      { b: [141, 129], t: [102, 88], wd: 20, bend: 3.5, tone: 1 },
      { b: [99, 166], t: [135, 140], wd: 16.5, bend: -2.5, tone: 0 },
      { b: [80, 213], t: [20, 221], wd: 23, bend: -5, tone: 1 },
      { b: [199, 164], t: [240, 142], wd: 17, bend: -3, tone: 0 },
      { b: [134, 263], t: [169, 225], wd: 17, bend: 3, tone: 1 },
      { b: [100, 305], t: [115, 335], wd: 13, bend: 2, tone: 0 },
    ].map((d) => Object.assign({ shape: leafShape(d.b, d.t, d.wd * L.range(0.95, 1.05), d.bend) }, d));
    return { blossoms, buds, main, branch, budStemL, budStemR, leaves };
  }

  function texState(box, layer, opts, texName) {
    const sc = opts.scale || 2;
    return {
      foil: layer === "foil",
      tex: layer === "foil" ? null : opts.rng(texName),
      scale: sc,
      fleck: clamp(1.35 / sc, 0.45, 0.9),
      w: box.w, h: box.h,
    };
  }

  K.registerCard({
    id: "cherry-blossom",
    title: "Cherry blossom",
    size: { w: 240, h: 320 },
    bleed: { t: 0.08, r: 0.1, b: 0.06, l: 0.065 },
    paper: "#F4F2F0",
    insert: "#FBF8F2",
    ink: "#2B2722",
    foil: "rose",
    message: "Some people\nfeel like spring.\nYou do.",

    drawCover(ctx, box, layer, opts) {
      const S = texState(box, layer, opts, "tex");
      const scene = coverScene(opts.rng("layout"));
      if (!S.foil) {
        paintPanel(ctx, box.w, box.h, S.tex, S.scale);
        // painted stems stay on the panel
        ctx.save();
        ctx.beginPath(); ctx.rect(0, 0, box.w, box.h); ctx.clip();
        paintStem(ctx, scene.main, 8.4, S);
        paintStem(ctx, scene.branch, 7, S);
        paintStem(ctx, scene.budStemL, 5.4, S);
        paintStem(ctx, scene.budStemR, 5.4, S);
        ctx.restore();
      }
      scene.leaves.forEach((lf) => paintLeaf(ctx, lf.shape, S, lf.tone));
      scene.buds.forEach((b) => paintBud(ctx, b, S));
      scene.blossoms.forEach((b) => paintBlossom(ctx, b, S, "cover"));
    },

    drawBack(ctx, box, layer, opts) {
      const S = texState(box, layer, opts, "tex");
      S.pal = {
        base: "#CF2A62",
        flecks: [["#D93C74", 0.36], ["#F06B98", 0.24], ["#FFC2D4", 0.12], ["#B01A4C", 0.18], ["#FF8FB3", 0.1]],
        glint: "rgba(255,248,250,0.95)",
      };
      const L = opts.rng("back"), w = box.w, h = box.h;
      const big = makeBlossom(L, {
        x: w * 0.54, y: h * 0.36, R: w * 0.27, sq: 0.92, rot: 0.2, gwScale: 1.55,
        rings: [
          { n: 5, len: [0.92, 1.02], hw: 0.52, base: 0.12, gw: 2.4 },
          { n: 4, len: [0.6, 0.7], hw: 0.44, base: 0.08, gw: 2.0 },
        ],
      });
      const small = makeBlossom(L, {
        x: w * 0.27, y: h * 0.755, R: w * 0.145, sq: 0.9, rot: -0.3, gwScale: 1.15,
        rings: [
          { n: 5, len: [0.92, 1.02], hw: 0.52, base: 0.12, gw: 2.2 },
          { n: 4, len: [0.6, 0.7], hw: 0.44, base: 0.08, gw: 1.8 },
        ],
      });
      paintBlossom(ctx, big, S, "line");
      paintBlossom(ctx, small, S, "line");
    },

    drawInside(ctx, box, layer, opts) {
      const S = texState(box, layer, opts, "tex");
      S.pal = {
        base: "#B92050",
        flecks: [["#C92E60", 0.36], ["#E2577F", 0.22], ["#F7B6C8", 0.1], ["#97173F", 0.32]],
        glint: "rgba(255,248,250,0.9)",
      };
      const L = opts.rng("inside"), w = box.w, h = box.h;
      const b = makeBlossom(L, {
        x: w * 0.5, y: h * 0.715, R: 22, sq: 0.94, rot: 0.4, gwScale: 0.72,
        rings: [
          { n: 5, len: [0.92, 1.02], hw: 0.52, base: 0.12, gw: 1.6 },
          { n: 4, len: [0.6, 0.7], hw: 0.44, base: 0.08, gw: 1.4 },
        ],
      });
      paintBlossom(ctx, b, S, "line");
    },
  });
})();
