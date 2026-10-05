/* Card 5 — "Pearl moon": heavyweight pearl-white cotton paper, blind-embossed cloud banks rolling across the
   lower half, one die-cut cloud foam-mounted over the top edge, a silver holographic hot-foil crescent and a
   scatter of tiny silver stars and dots. Quiet: almost everything is white-on-white, read only by light.
   Geometry (clouds, moon, hand-placed stars) is fixed at load time from constant data and fixed-seed streams,
   so front and back can mirror it; the front's loose dots come from opts.rng("stars") (same in both layers);
   texture comes from opts.rng("tex"), which only the art layer touches. */
(function () {
  "use strict";
  const K = window.KEEPSAKE;
  const TAU = Math.PI * 2;
  const W = 230, H = 300;
  const PAPER = "#F4F3F1", BACK = "#E9E8E6", INSERT = "#FBFAF7";
  // layered cloud banks in cool greys, palest far away, darkest at the front (value range for the card
  // and its toolbar thumbnail, as on the original); each gets its own cotton tooth
  const BANK_FILLS = ["#E0E0E6", "#D0D0D8", "#BFC0CA", "#AFB0BC", "#9FA0AD"];
  const FLOAT_FILL = "#E7E7EB";
  const SH = "84,86,104"; // cool grey-violet used for every shadow (rgb triplet)
  const sh = (a) => `rgba(${SH},${a})`;

  /* ================= geometry ================= */
  // circle-circle intersection: both points, or null
  function meet(a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy);
    if (d < 1e-6 || d > a[2] + b[2] || d < Math.abs(a[2] - b[2])) return null;
    const l = (a[2] * a[2] - b[2] * b[2] + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a[2] * a[2] - l * l));
    const mx = a[0] + (dx * l) / d, my = a[1] + (dy * l) / d, px = -dy / d, py = dx / d;
    return [[mx + px * h, my + py * h], [mx - px * h, my - py * h]];
  }
  const ang = (c, p) => Math.atan2(p[1] - c[1], p[0] - c[0]);

  // A cloud is a row of overlapping circles [cx,cy,r] sorted left→right. Its outline runs along their upper
  // envelope and closes either on a flat base (a y value) or, for a "bank", straight down off the card.
  function buildCloud(circles, base, inset) {
    inset = inset || 0;
    const c = circles.map(([x, y, r]) => [x, y, r - inset]);
    const X = [];
    for (let i = 0; i < c.length - 1; i++) {
      const m = meet(c[i], c[i + 1]);
      if (!m) throw new Error("pearl-moon: cloud circles " + i + "/" + (i + 1) + " do not overlap");
      X.push(m[0][1] < m[1][1] ? m[0] : m[1]);
    }
    const bank = base === "bank";
    const yb = bank ? 0 : base - inset;
    const segs = c.map((ci, i) => {
      let a0, a1;
      if (i === 0) a0 = bank ? Math.PI : Math.atan2(yb - ci[1], -Math.sqrt(Math.max(0, ci[2] * ci[2] - (yb - ci[1]) ** 2)));
      else a0 = ang(ci, X[i - 1]);
      if (i === c.length - 1) a1 = bank ? 0 : Math.atan2(yb - ci[1], Math.sqrt(Math.max(0, ci[2] * ci[2] - (yb - ci[1]) ** 2)));
      else a1 = ang(ci, X[i]);
      return [ci[0], ci[1], ci[2], a0, a1];
    });
    let x0 = 1e9, x1 = -1e9, y0 = 1e9;
    c.forEach(([x, y, r]) => { x0 = Math.min(x0, x - r); x1 = Math.max(x1, x + r); y0 = Math.min(y0, y - r); });
    const y1 = bank ? H + 40 : yb;
    return { bank, yb, segs, circles: c, box: [x0, y0, x1, y1], pad: [x0 - 24, y0 - 24, x1 - x0 + 48, y1 - y0 + 48] };
  }
  // appends the cloud outline as one closed subpath (no beginPath)
  function trace(ctx, cl) {
    const s = cl.segs, f = s[0], l = s[s.length - 1];
    if (cl.bank) { ctx.moveTo(f[0] - f[2], H + 40); ctx.lineTo(f[0] - f[2], f[1]); }
    else ctx.moveTo(f[0] + f[2] * Math.cos(f[3]), f[1] + f[2] * Math.sin(f[3]));
    s.forEach(([x, y, r, a0, a1]) => ctx.arc(x, y, r, a0, a1, false));
    if (cl.bank) ctx.lineTo(l[0] + l[2], H + 40);
    ctx.closePath();
  }
  const mirrorCircles = (cs) => cs.map(([x, y, r]) => [W - x, y, r]).reverse();
  // top of the cloud outline at x (for keeping stars clear of the clouds)
  function topAt(cl, x) {
    let t = 1e9;
    cl.circles.forEach(([cx, cy, r]) => { const dx = x - cx; if (Math.abs(dx) < r) t = Math.min(t, cy - Math.sqrt(r * r - dx * dx)); });
    return t;
  }

  // layered banks, back (highest) to front (lowest); generated once from fixed seeds
  function makeBank(name, o) {
    const R = K.rng("pearl-moon:bank:" + name);
    const cs = [];
    let r = R.range(o.r0, o.r1), x = -r * 0.45 - 3;
    for (let guard = 0; guard < 80; guard++) {
      const t = x / W;
      const top = o.y0 + (o.y1 - o.y0) * t + Math.sin(t * TAU * o.f + o.ph) * o.wob + R.range(-1.6, 1.6);
      cs.push([x, top + r, r]);
      if (x + r > W + 3) break;
      const r2 = R.range(o.r0, o.r1);
      x += (r + r2) * R.range(0.6, 0.72);
      r = r2;
    }
    return cs;
  }
  const BANK_SPECS = [
    // farther banks sit higher and have smaller puffs; the nearest has the biggest
    { n: "a", y0: 158, y1: 141, r0: 5.5, r1: 9.5, wob: 4, f: 1.4, ph: 0.6 },
    { n: "b", y0: 170, y1: 160, r0: 7.5, r1: 12.5, wob: 5, f: 1.1, ph: 2.6 },
    { n: "c", y0: 185, y1: 194, r0: 10, r1: 16, wob: 6, f: 0.9, ph: 4.4 },
    { n: "d", y0: 213, y1: 205, r0: 13, r1: 20, wob: 7, f: 0.8, ph: 1.3 },
    { n: "e", y0: 247, y1: 253, r0: 17, r1: 27, wob: 7, f: 0.7, ph: 3.3 },
  ];
  const BANK_CIRCLES = BANK_SPECS.map((s) => makeBank(s.n, s));
  const BANKS = BANK_CIRCLES.map((cs) => buildCloud(cs, "bank"));
  const BANKS_M = BANK_CIRCLES.map((cs) => buildCloud(mirrorCircles(cs), "bank"));

  // small floating embossed cloud, left of centre
  const FLOAT_C = [[26, 120, 6.5], [36, 113.5, 9.5], [49, 111, 9], [60, 116.5, 7], [68, 120.5, 5]];
  const FLOAT = buildCloud(FLOAT_C, 125);
  const FLOAT_M = buildCloud(mirrorCircles(FLOAT_C), 125);

  // the die-cut cloud, foam-mounted over the top edge
  const DIE_C = [[28, 9.5, 12.5], [43, -2.5, 15.5], [65, -8.5, 16], [86, -3.5, 14], [100, 9.5, 12.5]];
  const DIE = buildCloud(DIE_C, 21);
  const DIE_IN = buildCloud(DIE_C, 21, 3.2);
  const DIE_M = buildCloud(mirrorCircles(DIE_C), 21);

  // the crescent: outer disc minus a disc offset toward the upper left
  const MOON = { x: 166, y: 76, r: 34, ox: -11.5, oy: -6, ri: 30.2 };
  const MOON_IN = { x: W / 2, y: H * 0.8, r: 10, ox: -3.7, oy: -1.8, ri: 9.0 };

  // hand-placed silver stars: [x, y, r, kind]
  const STARS = [
    [117, 46, 4.6, "spark"], [206, 128, 3.4, "spark"], [57, 66, 3.1, "star"], [136, 113, 2.4, "star"],
    [18, 92, 2.9, "spark"], [94, 102, 2.0, "star"], [211, 30, 2.6, "star"], [182, 138, 1.9, "spark"],
    [74, 37, 1.7, "spark"], [150, 24, 1.8, "star"],
  ];

  /* ================= paint helpers ================= */
  const FAR = 2400; // shapes drawn this far right; only their shadows are offset back on-canvas
  // Paints only the soft shadow of a shape (or of its complement inside `pad` when invert).
  function shadowOf(ctx, k, cl, ox, oy, blur, color, invert) {
    ctx.save();
    ctx.translate(FAR, 0);
    ctx.beginPath();
    if (invert) ctx.rect(cl.pad[0], cl.pad[1], cl.pad[2], cl.pad[3]);
    trace(ctx, cl);
    ctx.shadowColor = color;
    ctx.shadowBlur = blur * k;
    ctx.shadowOffsetX = (ox - FAR) * k;
    ctx.shadowOffsetY = oy * k;
    ctx.fillStyle = "#000";
    ctx.fill(invert ? "evenodd" : "nonzero");
    ctx.restore();
  }
  function clipIn(ctx, cl) { ctx.beginPath(); trace(ctx, cl); ctx.clip(); }
  function clipOut(ctx, cl) { ctx.beginPath(); ctx.rect(-400, -400, 1200, 1200); trace(ctx, cl); ctx.clip("evenodd"); }

  // Blind emboss (raised) or deboss (pressed in) of a cloud. Light comes from the top left.
  function relief(ctx, k, cl, o) {
    const d = o.depth || 1, a = o.alpha || 1;
    ctx.save();
    (o.over || []).forEach((oc) => clipOut(ctx, oc)); // nearer layers hide this one
    if (o.raised) {
      ctx.save();
      clipOut(ctx, cl);
      shadowOf(ctx, k, cl, 0.9 * d, 1.25 * d, 2.8 * d, sh(0.28 * a)); // soft cast shade down-right
      shadowOf(ctx, k, cl, 0.2, 0.35, 0.8, sh(0.2 * a)); // contact line where the relief meets the sheet
      ctx.restore();
    }
    ctx.save();
    clipIn(ctx, cl);
    if (o.fill) {
      ctx.fillStyle = o.fill;
      ctx.fillRect(cl.box[0] - 1, cl.box[1] - 1, cl.box[2] - cl.box[0] + 2, cl.box[3] - cl.box[1] + 2);
    }
    if (o.raised) {
      // rounded puffs: each bump catches the light on its upper-left shoulder
      cl.circles.forEach(([x, y, r]) => {
        const g = ctx.createRadialGradient(x - r * 0.32, y - r * 0.42, 0, x - r * 0.2, y - r * 0.25, r * 1.05);
        g.addColorStop(0, `rgba(255,255,255,${0.42 * a})`);
        g.addColorStop(0.55, "rgba(255,255,255,0.08)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.fillRect(x - r * 1.4, y - r * 1.4, r * 2.8, r * 2.8);
      });
      shadowOf(ctx, k, cl, 1.1 * d, 1.1 * d, 1.5 * d, `rgba(255,255,255,${0.95 * a})`, true); // lit bevel
      shadowOf(ctx, k, cl, -0.85 * d, -1.05 * d, 2.4 * d, sh(0.24 * a), true); // shaded bevel
    } else {
      shadowOf(ctx, k, cl, 0.9 * d, 1.1 * d, 2.0 * d, sh(0.24 * a), true); // wall facing away from the light
      shadowOf(ctx, k, cl, -0.7 * d, -0.85 * d, 1.3 * d, `rgba(255,255,255,${0.9 * a})`, true); // wall facing it
      ctx.fillStyle = sh(0.025 * a);
      ctx.fillRect(cl.box[0], cl.box[1], cl.box[2] - cl.box[0], cl.box[3] - cl.box[1]);
    }
    ctx.restore();
    ctx.restore();
  }

  /* ---------- textures (art layer only) ---------- */
  const tiles = {};
  function makeTile(key, N, draw) {
    if (!tiles[key]) {
      const c = document.createElement("canvas");
      c.width = c.height = N;
      draw(c.getContext("2d"), N, K.rng("pearl-moon:tile:" + key));
      tiles[key] = c;
    }
    return tiles[key];
  }
  function devicePattern(ctx, k, tile) {
    const p = ctx.createPattern(tile, "repeat");
    p.setTransform(new DOMMatrix([1 / k, 0, 0, 1 / k, 0, 0])); // one tile pixel = one device pixel
    return p;
  }
  // cotton rag tooth: soft mottling, fine flecks and the odd fibre, seamless
  function toothTile(base) {
    return makeTile("tooth" + base, 224, (x, N, T) => {
      x.fillStyle = base;
      x.fillRect(0, 0, N, N);
      const wrap = (fn) => { for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) fn(i * N, j * N); };
      for (let i = 0; i < 140; i++) {
        const px = T() * N, py = T() * N, r = 2 + T() * 7, dark = T() < 0.5, al = 0.025 + T() * 0.035;
        wrap((ox, oy) => {
          const g = x.createRadialGradient(px + ox, py + oy, 0, px + ox, py + oy, r);
          g.addColorStop(0, dark ? `rgba(120,112,108,${al * 0.7})` : `rgba(255,255,255,${al * 2.2})`);
          g.addColorStop(1, dark ? "rgba(120,112,108,0)" : "rgba(255,255,255,0)");
          x.fillStyle = g;
          x.fillRect(px + ox - r, py + oy - r, r * 2, r * 2);
        });
      }
      // tooth: tiny bumps, each lit on its upper left and shaded on its lower right
      const lit = [new Path2D(), new Path2D()], shade = [new Path2D(), new Path2D()];
      for (let i = 0, n = N * N * 0.11; i < n; i++) {
        const px = (T() * N) | 0, py = (T() * N) | 0, s = T() < 0.7 ? 1 : 2, b = T() < 0.6 ? 0 : 1;
        lit[b].rect(px, py, s, s);
        shade[b].rect((px + s) % N, (py + s) % N, s, s);
      }
      x.fillStyle = "rgba(255,255,255,0.32)"; x.fill(lit[0]);
      x.fillStyle = "rgba(255,255,255,0.55)"; x.fill(lit[1]);
      x.fillStyle = "rgba(110,104,112,0.045)"; x.fill(shade[0]);
      x.fillStyle = "rgba(110,104,112,0.08)"; x.fill(shade[1]);
      const flecks = new Path2D(); // the odd darker cotton fleck
      for (let i = 0; i < 40; i++) flecks.rect((T() * N) | 0, (T() * N) | 0, 1, 1);
      x.fillStyle = "rgba(120,110,100,0.16)"; x.fill(flecks);
      x.lineCap = "round";
      for (let i = 0; i < 46; i++) {
        const px = T() * N, py = T() * N, len = 3 + T() * 9, a0 = T() * TAU, bend = (T() - 0.5) * 6, light = T() < 0.6;
        x.strokeStyle = light ? "rgba(255,255,255,0.5)" : "rgba(120,112,108,0.07)";
        x.lineWidth = 0.6 + T() * 0.5;
        wrap((ox, oy) => {
          const sx = px + ox, sy = py + oy, ex = sx + Math.cos(a0) * len, ey = sy + Math.sin(a0) * len;
          x.beginPath();
          x.moveTo(sx, sy);
          x.quadraticCurveTo((sx + ex) / 2 + bend, (sy + ey) / 2 - bend, ex, ey);
          x.stroke();
        });
      }
    });
  }
  // fine diffraction grain of holographic foil
  function holoTile() {
    return makeTile("holo", 96, (x, N, T) => {
      const cols = ["rgba(255,255,255,0.95)", "rgba(255,196,226,0.7)", "rgba(186,240,222,0.7)", "rgba(196,206,255,0.7)", "rgba(255,232,190,0.6)", "rgba(132,138,156,0.45)"];
      const ps = cols.map(() => new Path2D());
      for (let i = 0, n = N * N * 0.32; i < n; i++) ps[(T() * cols.length) | 0].rect((T() * N) | 0, (T() * N) | 0, 1, 1);
      ps.forEach((p, i) => { x.fillStyle = cols[i]; x.fill(p); });
    });
  }
  // broad unevenness of a real sheet + soft studio light from the top left
  function sheetLight(ctx, S, x, y, w, h) {
    const T = S.tex;
    ctx.save();
    ctx.globalCompositeOperation = "source-atop";
    for (let i = 0; i < 16; i++) {
      const px = x + T() * w, py = y + T() * h, r = 18 + T() * 46, dark = T() < 0.5, al = 0.018 + T() * 0.025;
      const g = ctx.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, dark ? sh(al) : `rgba(255,255,255,${al * 2})`);
      g.addColorStop(1, dark ? sh(0) : "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(px - r, py - r, r * 2, r * 2);
    }
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, "rgba(255,255,255,0.28)");
    g.addColorStop(0.5, "rgba(255,255,255,0)");
    g.addColorStop(1, sh(0.07));
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }
  // faint pearlescent sheen: blush → white → ice → lavender, in long diagonal washes
  function pearlSheen(ctx, x, y, w, h) {
    ctx.save();
    ctx.globalCompositeOperation = "source-atop";
    const g = ctx.createLinearGradient(x, y, x + w * 0.9, y + h);
    g.addColorStop(0.0, "rgba(255,230,240,0.24)");
    g.addColorStop(0.24, "rgba(255,255,255,0.2)");
    g.addColorStop(0.42, "rgba(226,238,255,0.22)");
    g.addColorStop(0.6, "rgba(255,255,255,0.04)");
    g.addColorStop(0.78, "rgba(236,230,255,0.2)");
    g.addColorStop(1.0, "rgba(255,242,232,0.18)");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  /* ---------- the crescent ---------- */
  // Crescent outline (outer disc minus the offset disc) appended to a context or Path2D as one subpath.
  function crescentInto(p, m) {
    const A = [m.x, m.y, m.r], B = [m.x + m.ox, m.y + m.oy, m.ri];
    const [a, b] = meet(A, B);
    const far = Math.atan2(m.oy, m.ox) + Math.PI; // the thick limb faces away from the offset disc
    const cw = (s0, e, t) => { const n = (v) => ((v % TAU) + TAU) % TAU; return n(t - s0) < n(e - s0); };
    const aA = ang(A, a), aB = ang(A, b), bB = ang(B, b), bA = ang(B, a);
    p.moveTo(a[0], a[1]);
    p.arc(A[0], A[1], A[2], aA, aB, !cw(aA, aB, far));
    p.arc(B[0], B[1], B[2], bB, bA, !cw(bB, bA, far));
    p.closePath();
  }
  function crescentPath(ctx, m) { ctx.beginPath(); crescentInto(ctx, m); }
  // like shadowOf, for the crescent (invert: the shadow of everything around it, for inner bevels)
  function moonShadow(ctx, k, m, ox, oy, blur, color, invert) {
    ctx.save();
    ctx.translate(FAR, 0);
    ctx.beginPath();
    if (invert) ctx.rect(m.x - m.r * 2, m.y - m.r * 2, m.r * 4, m.r * 4);
    crescentInto(ctx, m);
    ctx.shadowColor = color;
    ctx.shadowBlur = blur * k;
    ctx.shadowOffsetX = (ox - FAR) * k;
    ctx.shadowOffsetY = oy * k;
    ctx.fillStyle = "#000";
    ctx.fill(invert ? "evenodd" : "nonzero");
    ctx.restore();
  }
  // silver holographic hot foil, stamped (very slightly pressed into the paper)
  function drawMoon(ctx, k, m, layer, strength) {
    if (layer === "foil") {
      crescentPath(ctx, m);
      ctx.fillStyle = "#fff";
      ctx.fill();
      return;
    }
    const R = m.r, s = strength || 1;
    const far = Math.atan2(m.oy, m.ox) + Math.PI; // direction of the thick limb
    ctx.save();
    // the stamping die leaves a faint polished rim around the foil, brightest bottom-right
    ctx.save();
    crescentPath(ctx, m);
    ctx.shadowColor = "rgba(255,255,255,0.9)"; ctx.shadowBlur = 1.2 * k; ctx.shadowOffsetX = 0.5 * k; ctx.shadowOffsetY = 0.6 * k;
    ctx.fillStyle = "#E4E6EA"; ctx.fill();
    ctx.restore();
    crescentPath(ctx, m);
    ctx.clip();
    const x0 = m.x - R - 1, y0 = m.y - R - 1, sz = 2 * R + 2;
    // silver base: a cool metallic ramp swept along the limb
    const g = ctx.createLinearGradient(m.x - R, m.y - R, m.x + R * 0.9, m.y + R);
    [["#FFFFFF", 0], ["#C9CED7", 0.2], ["#F7F8FA", 0.36], ["#99A0AD", 0.55], ["#EEF0F3", 0.7], ["#ACB2BE", 0.84], ["#7C8390", 1]].forEach(([c, t]) => g.addColorStop(t, c));
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0, sz, sz);
    // faint pastel holographic bands, keeping the metal's own light and dark
    ctx.globalCompositeOperation = "color";
    ctx.globalAlpha = 0.36 * s;
    const hg = ctx.createLinearGradient(m.x - R, m.y + R * 0.5, m.x + R, m.y - R * 0.7);
    const hues = ["#FFAED0", "#FFD8A8", "#B4F0D6", "#A9D2FF", "#CDB8FF", "#FFAED0", "#B4F0D6", "#A9D2FF"];
    hues.forEach((c, i) => hg.addColorStop(i / (hues.length - 1), c));
    ctx.fillStyle = hg;
    ctx.fillRect(x0, y0, sz, sz);
    // diffraction grain
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 0.3 * s;
    ctx.fillStyle = devicePattern(ctx, k, holoTile());
    ctx.fillRect(x0, y0, sz, sz);
    ctx.globalAlpha = 1;
    // mirror-flat foil: a soft bloom of reflected light across the thick limb
    const bx = m.x + Math.cos(far - 0.5) * R * 0.62, by = m.y + Math.sin(far - 0.5) * R * 0.62;
    const bl = ctx.createRadialGradient(bx, by, 0, bx, by, R * 0.55);
    bl.addColorStop(0, "rgba(255,255,255,0.55)");
    bl.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = bl;
    ctx.fillRect(x0, y0, sz, sz);
    // stamped into the sheet: the top-left wall of the impression shades the foil edge
    moonShadow(ctx, k, m, 0.55, 0.7, 1.2, sh(0.32), true);
    moonShadow(ctx, k, m, -0.4, -0.5, 1.0, "rgba(255,255,255,0.7)", true);
    ctx.restore();
    crescentPath(ctx, m);
    ctx.lineWidth = Math.max(0.25, R * 0.014);
    ctx.strokeStyle = "rgba(128,134,150,0.42)";
    ctx.stroke();
  }

  /* ---------- tiny silver stars and dots ---------- */
  function silverFill(ctx, x, y, r) {
    const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    g.addColorStop(0, "#FFFFFF");
    g.addColorStop(0.42, "#C6CAD3");
    g.addColorStop(0.58, "#F3F4F7");
    g.addColorStop(1, "#858B98");
    return g;
  }
  function starShape(ctx, x, y, r, kind) {
    if (kind === "spark") K.sparklePath(ctx, x, y, r, 0.16);
    else if (kind === "star") K.starPath(ctx, x, y, r, 5, 0.5, -Math.PI / 2, true);
    else { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); }
  }
  function silverBit(ctx, layer, x, y, r, kind) {
    if (layer === "foil") {
      starShape(ctx, x, y, r, kind);
      ctx.fillStyle = "#fff";
      ctx.fill();
      return;
    }
    ctx.save();
    starShape(ctx, x + 0.18, y + 0.28, r, kind);
    ctx.fillStyle = sh(0.22);
    ctx.fill();
    starShape(ctx, x, y, r, kind);
    if (kind === "dot") {
      const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, 0, x, y, r);
      g.addColorStop(0, "#FFFFFF");
      g.addColorStop(0.5, "#D9DCE2");
      g.addColorStop(1, "#8D93A0");
      ctx.fillStyle = g;
    } else ctx.fillStyle = silverFill(ctx, x, y, r);
    ctx.fill();
    ctx.lineWidth = Math.max(0.18, r * 0.06);
    ctx.strokeStyle = "rgba(104,110,126,0.55)";
    ctx.stroke();
    if (kind !== "dot" && r > 2) {
      ctx.beginPath();
      ctx.arc(x - r * 0.08, y - r * 0.1, r * 0.16, 0, TAU);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fill();
    }
    ctx.restore();
  }
  function looseDots(L) {
    const dots = [];
    for (let tries = 0; dots.length < 26 && tries < 600; tries++) {
      const x = L.range(7, W - 7), y = L.range(8, 168), r = L.range(0.45, 1.25);
      if (Math.hypot(x - MOON.x, y - MOON.y) < MOON.r + 6) continue;
      if (x < DIE.box[2] + 4 && y < DIE.yb + 5) continue;
      if (x > FLOAT.box[0] - 5 && x < FLOAT.box[2] + 5 && y > FLOAT.box[1] - 5 && y < FLOAT.yb + 4) continue;
      if (BANKS.some((b) => y > topAt(b, x) - 6)) continue;
      if (STARS.some((s) => Math.hypot(x - s[0], y - s[1]) < s[2] + 5)) continue;
      if (dots.some((d) => Math.hypot(x - d[0], y - d[1]) < 8)) continue;
      dots.push([x, y, r]);
    }
    return dots;
  }

  /* ---------- the die-cut cloud ---------- */
  function drawDieCut(ctx, k, S, layer) {
    if (layer === "foil") return;
    // foam-mounted: a soft shadow on the card (only on the card — nothing in the bleed but the cloud itself)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();
    clipOut(ctx, DIE);
    shadowOf(ctx, k, DIE, 1.8, 2.8, 5.5, sh(0.24));
    shadowOf(ctx, k, DIE, 0.5, 0.8, 1.4, sh(0.16));
    ctx.restore();
    // the piece itself
    ctx.save();
    ctx.beginPath();
    trace(ctx, DIE);
    ctx.fillStyle = S.paper;
    ctx.fill();
    ctx.clip();
    const [bx0, by0, bx1, by1] = DIE.box;
    const g = ctx.createLinearGradient(bx0, by0, bx1, by1);
    g.addColorStop(0, "rgba(255,255,255,0.45)");
    g.addColorStop(1, "rgba(255,255,255,0.05)");
    ctx.fillStyle = g;
    ctx.fillRect(bx0, by0, bx1 - bx0, by1 - by0);
    DIE.circles.forEach(([x, y, r]) => {
      const rg = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, 0, x - r * 0.15, y - r * 0.2, r * 1.1);
      rg.addColorStop(0, "rgba(255,255,255,0.4)");
      rg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = rg;
      ctx.fillRect(x - r * 1.4, y - r * 1.4, r * 2.8, r * 2.8);
    });
    shadowOf(ctx, k, DIE, 0.8, 0.9, 1.1, "rgba(255,255,255,1)", true);
    shadowOf(ctx, k, DIE, -0.7, -0.9, 1.6, sh(0.22), true);
    // a debossed contour line pressed just inside the edge
    ctx.lineJoin = "round";
    ctx.beginPath();
    trace(ctx, DIE_IN);
    ctx.lineWidth = 0.75;
    ctx.strokeStyle = sh(0.26);
    ctx.stroke();
    ctx.save();
    ctx.translate(0.42, 0.5);
    ctx.beginPath();
    trace(ctx, DIE_IN);
    ctx.lineWidth = 0.55;
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.stroke();
    ctx.restore();
    // the cut edge: a crisp hairline, kept inside the piece
    ctx.beginPath();
    trace(ctx, DIE);
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = sh(0.2);
    ctx.stroke();
    ctx.restore();
  }

  /* ================= faces ================= */
  function drawCover(ctx, box, layer, opts) {
    const k = opts.scale;
    const dots = looseDots(opts.rng("stars"));
    if (layer === "foil") {
      // pearl stock shimmers a touch; foil is full strength
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      ctx.fillRect(0, 0, W, H);
      ctx.beginPath();
      trace(ctx, DIE);
      ctx.fill();
      drawMoon(ctx, k, MOON, layer);
      STARS.forEach(([x, y, r, kind]) => silverBit(ctx, layer, x, y, r, kind));
      dots.forEach(([x, y, r]) => silverBit(ctx, layer, x, y, r, "dot"));
      return;
    }
    const S = { tex: opts.rng("tex") };
    // the tooth is sized in device pixels, so at thumbnail scale it would read as noise: use flat stock there
    S.paper = k < 1 ? PAPER : devicePattern(ctx, k, toothTile(PAPER));
    ctx.fillStyle = S.paper;
    ctx.fillRect(0, 0, W, H);
    // a pale blue-grey halo of night sky behind the moon
    const halo = ctx.createRadialGradient(MOON.x, MOON.y, MOON.r * 0.6, MOON.x, MOON.y, MOON.r * 2.6);
    halo.addColorStop(0, "rgba(176,184,214,0.42)");
    halo.addColorStop(0.55, "rgba(190,196,222,0.2)");
    halo.addColorStop(1, "rgba(200,204,226,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, W, H);
    // embossed clouds, each layer on its own grey stock
    const stock = (c) => (k < 1 ? c : devicePattern(ctx, k, toothTile(c)));
    relief(ctx, k, FLOAT, { raised: true, depth: 0.9, fill: stock(FLOAT_FILL) });
    BANKS.forEach((b, i) => relief(ctx, k, b, { raised: true, depth: 0.85 + i * 0.12, over: BANKS.slice(i + 1), fill: stock(BANK_FILLS[i]) }));
    drawDieCut(ctx, k, S, layer);
    sheetLight(ctx, S, DIE.box[0] - 2, DIE.box[1] - 2, W, H - DIE.box[1] + 4);
    pearlSheen(ctx, 0, DIE.box[1] - 2, W, H - DIE.box[1] + 2);
    // silver holographic foil
    drawMoon(ctx, k, MOON, layer);
    STARS.forEach(([x, y, r, kind]) => silverBit(ctx, layer, x, y, r, kind));
    dots.forEach(([x, y, r]) => silverBit(ctx, layer, x, y, r, "dot"));
  }

  // back of the cover: every embossed cloud reads in reverse (debossed), mirrored left↔right
  const BACK_DOTS = [[24, 128, 1.5], [112, 38, 1.05], [126, 92, 1.35], [178, 46, 1.2], [202, 80, 0.95], [150, 64, 1.0], [92, 124, 1.15]];
  function drawBack(ctx, box, layer, opts) {
    const k = opts.scale;
    if (layer === "art") {
      // the overflowing part of the die-cut cloud is a separate, foam-raised piece: from behind it sits a
      // little lower than the card, so it is a shade darker, and the card's top edge catches the light
      ctx.save();
      ctx.beginPath();
      trace(ctx, DIE_M);
      ctx.clip();
      ctx.fillStyle = sh(0.06);
      ctx.fillRect(DIE_M.box[0] - 1, DIE_M.box[1] - 1, DIE_M.box[2] - DIE_M.box[0] + 2, 1 - DIE_M.box[1]);
      ctx.fillStyle = sh(0.18);
      ctx.fillRect(DIE_M.box[0] - 1, -0.9, DIE_M.box[2] - DIE_M.box[0] + 2, 0.7);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillRect(DIE_M.box[0] - 1, -0.2, DIE_M.box[2] - DIE_M.box[0] + 2, 0.6);
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.clip();
      relief(ctx, k, FLOAT_M, { raised: false, depth: 0.85 });
      BANKS_M.forEach((b, i) => relief(ctx, k, b, { raised: false, depth: 0.85 + i * 0.1, over: BANKS_M.slice(i + 1) }));
      ctx.restore();
      // the foil stamping left its ghost: a faint raised crescent, mirrored
      const gm = { x: W - MOON.x, y: MOON.y, r: MOON.r, ox: -MOON.ox, oy: MOON.oy, ri: MOON.ri };
      ctx.save();
      crescentPath(ctx, gm);
      ctx.clip();
      moonShadow(ctx, k, gm, 0.7, 0.8, 1.4, "rgba(255,255,255,0.85)", true);
      moonShadow(ctx, k, gm, -0.6, -0.7, 1.6, sh(0.14), true);
      ctx.restore();
    }
    BACK_DOTS.forEach(([x, y, r]) => silverBit(ctx, layer, x, y, r, "dot"));
  }

  // inside: the little crescent resting in a tiny blind-embossed cloud, below the message
  const NAP_C = [[MOON_IN.x - 7, 249.2, 4], [MOON_IN.x - 1, 248.4, 4.6], [MOON_IN.x + 5.5, 248.4, 4.5], [MOON_IN.x + 11.5, 251, 3.3]];
  const NAP = buildCloud(NAP_C, 252.6); // hides the lower horn tip (≈ x−7.9, y+6.2 from the moon centre)
  function drawInside(ctx, box, layer, opts) {
    const k = opts.scale;
    const m = MOON_IN;
    drawMoon(ctx, k, m, layer, 0.9);
    if (layer === "foil") {
      ctx.save();
      ctx.globalCompositeOperation = "destination-out"; // the cloud sits over the foil
      ctx.beginPath();
      trace(ctx, NAP);
      ctx.fill();
      ctx.restore();
    } else relief(ctx, k, NAP, { raised: true, depth: 0.7, alpha: 0.9, fill: INSERT });
    silverBit(ctx, layer, m.x - 16, m.y - 5, 0.8, "dot");
    silverBit(ctx, layer, m.x + 21, m.y + 3, 0.65, "dot");
    silverBit(ctx, layer, m.x + 12, m.y - 10, 2.2, "spark");
  }

  K.registerCard({
    id: "pearl-moon",
    title: "Pearl moon",
    size: { w: W, h: H },
    bleed: { t: 0.088, r: 0, b: 0, l: 0 },
    paper: "#F1F0EE",
    backPaper: BACK,
    insert: INSERT,
    ink: "#2B2722",
    foil: "silver",
    message: "Thinking of you,\nsoftly,\nalways.",
    drawCover,
    drawBack,
    drawInside,
  });
})();
