/* Card 4 — "Space bunny": a die-cut white bunny head with a silver foil edge, wearing a silver planet
   ring, on hot-pink glitter cardstock dusted with sugar sparkle, above a bank of dimensional clay flowers.
   Layout comes from fixed geometry plus the "speckles"/"flowers" streams (consumed identically in both
   layers); texture (grain, glitter tiles, blotches) comes from "tex", which only the art layer touches. */
(function () {
  "use strict";
  const K = window.KEEPSAKE;
  const TAU = Math.PI * 2;
  const W = 300, H = 300;
  const PINK = "#E3176F";
  const deg = (d) => (d * Math.PI) / 180;

  /* ---------------- bunny geometry (front, card units) ---------------- */
  // head: a slightly squarish ellipse; ears: egg shapes (wider toward the tip), tilted to the right
  const HEAD = { kind: "super", x: 146, y: 189, rx: 45.5, ry: 34, rot: deg(9), n: 2.25 };
  const EAR_L = { kind: "egg", x: 138.5, y: 121, a: 47.5, b: 22.5, rot: deg(12.5), egg: 0.22 };
  const EAR_R = { kind: "egg", x: 184.6, y: 136.2, a: 41, b: 18.5, rot: deg(43), egg: 0.2 };
  const SHAPES = [HEAD, EAR_L, EAR_R];
  const RING = { x: 143.7, y: 191.6, rx: 66, ry: 16, rot: deg(-15) };
  // beads on the ring by ellipse parameter (t in (0,PI) = front half, (PI,2PI) = back half)
  const BEADS = [[Math.PI + 0.64, 2.3], [Math.PI - 0.64, 2.2], [TAU - 0.72, 2.4], [0.56, 2.2]];
  const RING_SPARK_T = Math.PI - 0.99;
  const EYES = [[122, 200.5], [150.5, 199.5]];
  const MOUTH = [136.5, 204.6];
  const SPARKS = [[211.5, 76, 9], [104, 95.5, 5.5], [87.5, 127, 4.5], [232.5, 118, 5], [66, 176, 8.5], [228, 186, 4.5], [208, 219, 9.5], [129, 239, 4]];

  // the back page shows the same bunny as a silver line drawing, a little larger
  const BACK = { ax: 146, ay: 160, s: 1.3, bx: 142, by: 146 };
  const BACK_SPARKS = [[96, 63, 6], [235, 46, 8.5], [73, 102, 5], [227, 231, 8]];

  /* ---------------- flower bank palette ---------------- */
  const C = {
    lilac: "#B48BE0", purple: "#8E5BD0", butter: "#F7D354", white: "#FBF8F3",
    peach: "#F8A98B", sky: "#7FB7FF", pink: "#F48FB1", leaf: "#5BAF7A",
  };
  // hand-placed after the reference: [x, y, r, colour, centre, petals]
  const FLOWERS = [
    [32.5, 267.5, 15, "lilac", "pearl", 5],
    [56.5, 266.5, 9, "white", "gold", 6],
    [31, 242.5, 7, "white", "gold", 5],
    [47, 285, 7.6, "butter", "pearl", 5],
    [76, 278, 11.4, "pink", "pearl", 5],
    [117.5, 270, 9, "white", "gold", 6],
    [139, 265.5, 7.6, "peach", "orange", 5],
    [106.5, 287, 7.6, "sky", "pearl", 5],
    [152, 282, 10, "sky", "pearl", 5],
    [173.5, 278.5, 7, "white", "gold", 5],
    [200.5, 274.5, 7, "butter", "orange", 5],
    [214, 286, 7, "lilac", "pearl", 5],
    [238, 274, 9.6, "white", "gold", 6],
    [260.5, 259.5, 12.7, "butter", "pearl", 5],
    [284, 248.5, 11.4, "purple", "pearl", 5],
    [270.5, 234.5, 7.6, "peach", "orange", 5],
    [281, 273, 8.9, "white", "gold", 5],
    [259, 282.5, 7.6, "sky", "pearl", 5],
  ];
  const LEAVES = [
    [15.5, 241], [16, 254], [49, 252.5], [89.5, 266.5], [95.5, 280.5], [18.5, 285], [62, 288.5], [128.5, 283],
    [161.5, 270], [189.5, 285.5], [221, 265.5], [226, 277], [245.5, 288.5], [292, 232.5], [292.5, 263], [291.5, 288.5],
    [7.5, 270], [131, 293], [178, 292], [233, 258],
  ];

  /* ---------------- shape paths ---------------- */
  // Appends a closed, clockwise subpath for a bunny part, so several parts filled with "nonzero" make a union.
  function addShape(ctx, s) {
    const N = 96, c = Math.cos(s.rot), si = Math.sin(s.rot);
    for (let i = 0; i < N; i++) {
      const t = (i / N) * TAU, ct = Math.cos(t), st = Math.sin(t);
      let lx, ly;
      if (s.kind === "super") {
        const e = 2 / s.n;
        lx = s.rx * Math.sign(ct) * Math.pow(Math.abs(ct), e);
        ly = s.ry * Math.sign(st) * Math.pow(Math.abs(st), e);
      } else {
        lx = s.b * st * (1 + s.egg * ct); // tip (t=0) is wider than the base
        ly = -s.a * ct;
      }
      const x = s.x + lx * c - ly * si, y = s.y + lx * si + ly * c;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.closePath();
  }
  function unionPath(ctx) { ctx.beginPath(); SHAPES.forEach((s) => addShape(ctx, s)); }
  function clipOutside(ctx, s) { ctx.beginPath(); ctx.rect(-600, -600, 1500, 1500); addShape(ctx, s); ctx.clip("evenodd"); }
  // strokes only the outer contour of the union (each part's outline, minus the bits inside the other parts)
  function strokeUnion(ctx, lw, style) {
    SHAPES.forEach((s, i) => {
      ctx.save();
      SHAPES.forEach((o, j) => { if (j !== i) clipOutside(ctx, o); });
      ctx.beginPath(); addShape(ctx, s);
      ctx.lineWidth = lw; ctx.strokeStyle = style; ctx.lineJoin = "round"; ctx.stroke();
      ctx.restore();
    });
  }

  function ringPoint(t) {
    const c = Math.cos(RING.rot), s = Math.sin(RING.rot), lx = RING.rx * Math.cos(t), ly = RING.ry * Math.sin(t);
    return [RING.x + lx * c - ly * s, RING.y + lx * s + ly * c];
  }
  function ringArc(ctx, front) {
    ctx.beginPath();
    ctx.ellipse(RING.x, RING.y, RING.rx, RING.ry, RING.rot, front ? 0 : Math.PI, front ? Math.PI : TAU);
  }

  /* ---------------- textures (art layer only) ---------------- */
  function tile(S, N, base, flecks, density) {
    const T = S.tex;
    const c = document.createElement("canvas");
    c.width = c.height = N;
    const x = c.getContext("2d");
    if (base) { x.fillStyle = base; x.fillRect(0, 0, N, N); }
    let acc = 0;
    const cum = flecks.map((f) => (acc += f[1]));
    const paths = flecks.map(() => new Path2D());
    for (let i = 0, n = N * N * density; i < n; i++) {
      const pick = T() * acc, sz = T() < 0.8 ? 1 : 2;
      let k = 0;
      while (k < cum.length - 1 && pick > cum[k]) k++;
      paths[k].rect((T() * N) | 0, (T() * N) | 0, sz, sz);
    }
    paths.forEach((p, k) => { x.fillStyle = flecks[k][0]; x.fill(p); });
    return c;
  }
  function pattern(ctx, S, canvas) {
    const p = ctx.createPattern(canvas, "repeat");
    p.setTransform(new DOMMatrix([1 / S.scale, 0, 0, 1 / S.scale, 0, 0])); // one tile pixel = one device pixel
    return p;
  }
  function silverPattern(ctx, S) {
    if (!S.silverTile) {
      S.silverTile = tile(S, 96, "#D5D8DF", [
        ["#FFFFFF", 0.26], ["#9CA1AC", 0.12], ["#EEF0F4", 0.22], ["#B7BBC4", 0.14],
        ["#F6E2F3", 0.08], ["#DCEDF9", 0.08], ["#868C98", 0.04], ["#FFF8DE", 0.06],
      ], 0.6);
    }
    return pattern(ctx, S, S.silverTile);
  }
  function silverGradient(ctx, x0, y0, x1, y1) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    const st = ["#8E949F", "#F7F8FB", "#B7BCC6", "#FFFFFF", "#9BA1AC", "#E9ECF1", "#A3A8B3", "#FBFBFD", "#8C929D"];
    st.forEach((c, i) => g.addColorStop(i / (st.length - 1), c));
    return g;
  }

  function paintCardstock(ctx, S) {
    ctx.fillStyle = PINK;
    ctx.fillRect(0, 0, W, H);
    // broad tonal variation: a soft lift in the middle, deeper toward the corners
    let g = ctx.createRadialGradient(W * 0.46, H * 0.4, 8, W * 0.5, H * 0.48, W * 0.78);
    g.addColorStop(0, "rgba(255,92,160,0.20)");
    g.addColorStop(0.55, "rgba(255,70,150,0.04)");
    g.addColorStop(1, "rgba(120,0,45,0.22)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // mottled dye blotches
    const T = S.tex;
    for (let i = 0; i < 34; i++) {
      const x = T() * W, y = T() * H, r = 14 + T() * 40, light = T() < 0.5, a = 0.035 + T() * 0.05;
      const b = ctx.createRadialGradient(x, y, 0, x, y, r);
      b.addColorStop(0, light ? `rgba(255,110,170,${a})` : `rgba(150,0,55,${a})`);
      b.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = b;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // fine glitter-cardstock grain, one device pixel per fleck
    const grain = tile(S, 128, null, [
      ["rgba(255,120,175,0.16)", 0.3], ["rgba(150,0,52,0.13)", 0.3], ["rgba(255,196,224,0.14)", 0.1],
      ["rgba(255,225,238,0.16)", 0.03], ["rgba(110,0,38,0.10)", 0.22], ["rgba(255,80,150,0.15)", 0.1],
    ], 0.3);
    ctx.fillStyle = pattern(ctx, S, grain);
    ctx.fillRect(0, 0, W, H);
  }

  /* ---------------- sugar-glitter speckles ---------------- */
  function speckleDensity(x, y) {
    let p = 0.035 + 0.5 * Math.pow(Math.max(0, 1 - y / (H * 0.7)), 1.5);
    const ex = Math.min(x, W - x) / W, ey = Math.min(y, H - y) / H;
    p += 0.32 * Math.exp(-ex * 15) + 0.2 * Math.exp(-ey * 16);
    const d = Math.hypot((x - 150) / 80, (y - 160) / 84);
    if (d < 1.45) p *= 0.1 + 0.9 * Math.max(0, (d - 0.72) / 0.73);
    return Math.min(1, p);
  }
  function speckleList(R) {
    const clusters = [];
    while (clusters.length < 28) {
      const x = R() * W, y = R() * H * 0.85, k = R();
      if (k < speckleDensity(x, y)) clusters.push([x, y, 6 + R() * 9]);
    }
    const out = [];
    for (let i = 0; i < 1700; i++) {
      let x, y;
      if (R() < 0.26) {
        const c = clusters[(R() * clusters.length) | 0];
        x = c[0] + R.gauss() * c[2];
        y = c[1] + R.gauss() * c[2];
      } else {
        x = R() * W;
        y = R() * H;
      }
      const keep = R(), sz = R(), tone = R();
      if (x < 0.8 || x > W - 0.8 || y < 0.8 || y > H - 0.8) continue;
      if (keep > speckleDensity(x, y)) continue;
      const r = 0.55 + 1.0 * sz * sz + (sz > 0.96 ? 0.3 : 0);
      out.push([x, y, r, tone]);
    }
    return out;
  }
  function drawSpeckles(ctx, layer, list) {
    if (layer === "foil") {
      const p = new Path2D();
      list.forEach(([x, y, r]) => { p.moveTo(x + r, y); p.arc(x, y, r, 0, TAU); });
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fill(p);
      return;
    }
    const sh = new Path2D(), halo = new Path2D(), b1 = new Path2D(), b2 = new Path2D(), hi = new Path2D();
    list.forEach(([x, y, r, t]) => {
      halo.moveTo(x + r * 1.7, y); halo.arc(x, y, r * 1.7, 0, TAU);
      sh.moveTo(x + 0.25 + r * 1.1, y + 0.4); sh.arc(x + 0.25, y + 0.4, r * 1.1, 0, TAU);
      const b = t < 0.55 ? b1 : b2;
      b.moveTo(x + r, y); b.arc(x, y, r, 0, TAU);
      if (r > 0.6) { const hx = x - r * 0.3, hy = y - r * 0.32, hr = r * 0.38; hi.moveTo(hx + hr, hy); hi.arc(hx, hy, hr, 0, TAU); }
    });
    ctx.fillStyle = "rgba(255,150,195,0.12)"; ctx.fill(halo);
    ctx.fillStyle = "rgba(105,0,40,0.30)"; ctx.fill(sh);
    ctx.fillStyle = "rgba(255,158,198,0.82)"; ctx.fill(b1);
    ctx.fillStyle = "rgba(255,200,224,0.85)"; ctx.fill(b2);
    ctx.fillStyle = "rgba(255,255,255,0.95)"; ctx.fill(hi);
  }

  /* ---------------- silver bits ---------------- */
  function sparkle(ctx, layer, x, y, r, shadow) {
    const thin = 0.1;
    if (layer === "foil") {
      K.sparklePath(ctx, x, y, r, thin); ctx.fillStyle = "#fff"; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, r * 0.22, 0, TAU); ctx.fill();
      return;
    }
    ctx.save();
    const g0 = ctx.createRadialGradient(x, y, 0, x, y, r * 0.6);
    g0.addColorStop(0, "rgba(255,255,255,0.6)");
    g0.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g0;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    K.sparklePath(ctx, x + 0.2, y + 0.35, r, thin);
    ctx.fillStyle = shadow || "rgba(100,0,40,0.3)";
    ctx.fill();
    K.sparklePath(ctx, x, y, r, thin);
    const g = ctx.createRadialGradient(x - r * 0.1, y - r * 0.1, 0, x, y, r);
    g.addColorStop(0, "#FFFFFF");
    g.addColorStop(0.35, "#F4F6FA");
    g.addColorStop(1, "#AEB3BD");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = Math.max(0.15, r * 0.022);
    ctx.strokeStyle = "rgba(95,95,112,0.4)";
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, r * 0.2, 0, TAU);
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fill();
    ctx.restore();
  }
  function bead(ctx, layer, x, y, r) {
    ctx.beginPath();
    if (layer === "foil") { ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = "#fff"; ctx.fill(); return; }
    ctx.arc(x + 0.3, y + 0.55, r * 1.05, 0, TAU);
    ctx.fillStyle = "rgba(95,0,38,0.32)";
    ctx.fill();
    const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.45, 0, x, y, r);
    g.addColorStop(0, "#FFFFFF");
    g.addColorStop(0.45, "#E2E5EB");
    g.addColorStop(1, "#8F95A1");
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - r * 0.35, y - r * 0.4, r * 0.28, 0, TAU);
    ctx.fillStyle = "#fff";
    ctx.fill();
  }
  function ringLine(ctx, layer, front, lw, style) {
    ctx.save();
    ctx.lineCap = "round";
    if (layer === "foil") {
      ringArc(ctx, front);
      ctx.lineWidth = lw + 0.2;
      ctx.strokeStyle = "#fff";
      ctx.stroke();
    } else {
      ctx.save();
      ctx.translate(0.3, 0.75);
      ringArc(ctx, front);
      ctx.lineWidth = lw + 0.3;
      ctx.strokeStyle = "rgba(100,0,40,0.28)";
      ctx.stroke();
      ctx.restore();
      ringArc(ctx, front);
      ctx.lineWidth = lw;
      ctx.strokeStyle = style || silverGradient(ctx, RING.x - RING.rx, RING.y - 20, RING.x + RING.rx, RING.y + 20);
      ctx.stroke();
      ctx.save();
      ctx.translate(-0.15, -0.25);
      ringArc(ctx, front);
      ctx.lineWidth = lw * 0.35;
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }
  function ringBeads(ctx, layer, front) {
    BEADS.forEach(([t, r]) => {
      if ((t < Math.PI) !== front) return;
      const p = ringPoint(t);
      bead(ctx, layer, p[0], p[1], r);
    });
  }
  function face(ctx, layer, lw, style, mouth) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = layer === "foil" ? "rgba(255,255,255,0.7)" : style || "#8B8590";
    ctx.lineWidth = lw;
    EYES.forEach(([x, y]) => {
      // a sleepy closed eye: a soft downward arc with three tiny lashes
      ctx.beginPath();
      ctx.moveTo(x - 4.2, y - 1.2);
      ctx.quadraticCurveTo(x, y + 1.9, x + 4.2, y - 1.2);
      ctx.stroke();
      ctx.beginPath();
      [-2.4, 0, 2.4].forEach((d) => {
        const bx = x + d, by = y + 0.55 - Math.abs(d) * 0.28;
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + d * 0.25, by + 1.5);
      });
      ctx.lineWidth = lw * 0.7;
      ctx.stroke();
      ctx.lineWidth = lw;
    });
    if (mouth === false) { ctx.restore(); return; }
    const [mx, my] = MOUTH, m = 1.1;
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.moveTo(mx - m, my - m); ctx.lineTo(mx + m, my + m);
    ctx.moveTo(mx + m, my - m); ctx.lineTo(mx - m, my + m);
    ctx.lineWidth = lw * 0.75;
    ctx.stroke();
    ctx.restore();
  }

  /* ---------------- the die-cut bunny (front) ---------------- */
  function unionFrame(ctx) {
    // a canvas the size of the face that is opaque everywhere EXCEPT inside the bunny
    const c = document.createElement("canvas");
    c.width = ctx.canvas.width;
    c.height = ctx.canvas.height;
    const x = c.getContext("2d");
    x.fillStyle = "#000";
    x.fillRect(0, 0, c.width, c.height);
    x.setTransform(ctx.getTransform());
    x.globalCompositeOperation = "destination-out";
    unionPath(x);
    x.fill();
    return c;
  }
  function bunnyBody(ctx, S) {
    const sc = S.scale;
    // the cut-out sits on foam: a soft shadow onto the pink
    ctx.save();
    unionPath(ctx);
    ctx.shadowColor = "rgba(90,0,36,0.45)";
    ctx.shadowBlur = 5 * sc;
    ctx.shadowOffsetX = 1.3 * sc;
    ctx.shadowOffsetY = 2.4 * sc;
    ctx.fillStyle = "#F6F2F3";
    ctx.fill();
    ctx.restore();

    ctx.save();
    unionPath(ctx);
    ctx.clip();
    const g = ctx.createRadialGradient(132, 128, 6, 146, 152, 112);
    g.addColorStop(0, "#FFFFFF");
    g.addColorStop(0.55, "#F9F6F7");
    g.addColorStop(1, "#ECE5E8");
    ctx.fillStyle = g;
    ctx.fillRect(85, 60, 150, 180);
    K.paperGrain(ctx, 90, 65, 130, 165, S.tex, 0.05);
    // pillowed edges: shade inside the lower-right rim, light the upper-left rim
    const frame = unionFrame(ctx);
    const base = ctx.getTransform();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.shadowColor = "rgba(150,100,125,0.32)";
    ctx.shadowBlur = 7 * sc;
    ctx.shadowOffsetX = -1.8 * sc;
    ctx.shadowOffsetY = -2.4 * sc;
    ctx.drawImage(frame, 0, 0);
    ctx.shadowColor = "rgba(255,255,255,0.95)";
    ctx.shadowBlur = 4 * sc;
    ctx.shadowOffsetX = 1.2 * sc;
    ctx.shadowOffsetY = 1.6 * sc;
    ctx.drawImage(frame, 0, 0);
    ctx.setTransform(base);
    ctx.restore();
  }
  function bunnyOutline(ctx, layer, S, lw) {
    if (layer === "foil") { strokeUnion(ctx, lw + 0.2, "#fff"); return; }
    strokeUnion(ctx, lw + 0.7, "rgba(110,0,45,0.28)"); // a hairline of shadow where foil meets pink
    strokeUnion(ctx, lw, silverPattern(ctx, S));
    const d = ctx.createLinearGradient(100, 80, 200, 225);
    d.addColorStop(0, "rgba(80,80,100,0)");
    d.addColorStop(0.5, "rgba(80,80,100,0.08)");
    d.addColorStop(1, "rgba(80,80,100,0.42)");
    strokeUnion(ctx, lw, d);
    // specular streaks running along the foil edge
    const g = ctx.createLinearGradient(95, 70, 215, 230);
    for (let i = 0; i <= 12; i++) g.addColorStop(i / 12, i % 2 ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0)");
    strokeUnion(ctx, lw * 0.45, g);
  }

  /* ---------------- flower bank ---------------- */
  function bandTop(x) { return H * (0.855 - 0.075 * Math.pow(Math.abs(x / W - 0.5) * 2, 1.6)); }
  function flowerLayout(R) {
    const flowers = FLOWERS.map(([x, y, r, col, ctr, n]) => ({ x, y, r: r * 1.06, col, ctr, n, rot: R() * TAU }));
    const leaves = LEAVES.map(([x, y]) => ({ x, y, len: 4.4 + R() * 1.5, wid: 2.6 + R() * 0.5, rot: R() * TAU }));
    const small = ["white", "pink", "sky", "butter", "white", "peach", "lilac"];
    const placed = flowers.slice();
    for (let i = 0; i < 500 && placed.length < FLOWERS.length + 26; i++) {
      const x = 4 + R() * (W - 8), top = bandTop(x), y = top + R() * (H - 4 - top), r = 3 + R() * 2.6, col = small[(R() * small.length) | 0], rot = R() * TAU;
      if (x - r < 1.5 || x + r > W - 1.5 || y + r > H - 1.5) continue;
      if (placed.some((f) => Math.hypot(f.x - x, f.y - y) < (f.r + r) * 0.82)) continue;
      const f = { x, y, r, col, ctr: col === "white" ? "gold" : "pearl", n: 5, rot };
      placed.push(f);
    }
    const fillers = placed.slice(FLOWERS.length);
    const pearls = [];
    for (let i = 0; i < 400 && pearls.length < 34; i++) {
      const x = 3 + R() * (W - 6), top = bandTop(x) - 12, y = top + R() * (H - 3 - top), r = 0.8 + R() * 0.8;
      if (placed.some((f) => Math.hypot(f.x - x, f.y - y) < f.r + r + 0.6)) continue;
      if (pearls.some((p) => Math.hypot(p[0] - x, p[1] - y) < 4)) continue;
      pearls.push([x, y, r]);
    }
    flowers.sort((a, b) => b.r - a.r);
    return { flowers: flowers.concat(fillers), leaves, pearls };
  }
  function petalPath(ctx, f, i, grow) {
    const a = f.rot + (i * TAU) / f.n, d = f.r * 0.45, pr = f.r * 0.55 + (grow || 0);
    ctx.ellipse(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, pr, pr * (f.n === 6 ? 0.72 : 0.86), a, 0, TAU);
  }
  function silhouette(ctx, f) {
    ctx.beginPath();
    for (let i = 0; i < f.n; i++) { petalPath(ctx, f, i); ctx.closePath(); }
  }
  function leafPath(ctx, l) {
    const c = Math.cos(l.rot), s = Math.sin(l.rot), P = (u, v) => [l.x + u * c - v * s, l.y + u * s + v * c];
    const a = P(-l.len, 0), b = P(l.len, 0), c1 = P(-l.len * 0.1, -l.wid * 2), c2 = P(-l.len * 0.1, l.wid * 2);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.quadraticCurveTo(c1[0], c1[1], b[0], b[1]);
    ctx.quadraticCurveTo(c2[0], c2[1], a[0], a[1]);
    ctx.closePath();
    return [a, b];
  }
  function drawLeaf(ctx, l, sc) {
    ctx.save();
    leafPath(ctx, l);
    ctx.shadowColor = "rgba(80,0,32,0.45)";
    ctx.shadowBlur = 2 * sc;
    ctx.shadowOffsetX = 0.6 * sc;
    ctx.shadowOffsetY = 1.1 * sc;
    const g = ctx.createLinearGradient(l.x - l.wid, l.y - l.wid * 1.5, l.x + l.wid, l.y + l.wid * 1.5);
    g.addColorStop(0, "#A8E6C0");
    g.addColorStop(0.5, C.leaf);
    g.addColorStop(1, "#408F63");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
    const [a, b] = leafPath(ctx, l);
    ctx.save();
    ctx.lineWidth = 0.4;
    ctx.strokeStyle = "rgba(30,80,50,0.35)";
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(a[0] * 0.85 + b[0] * 0.15, a[1] * 0.85 + b[1] * 0.15);
    ctx.lineTo(a[0] * 0.2 + b[0] * 0.8, a[1] * 0.2 + b[1] * 0.8);
    ctx.lineWidth = 0.45;
    ctx.strokeStyle = "rgba(220,255,230,0.55)";
    ctx.stroke();
    ctx.restore();
  }
  const CENTRES = {
    pearl: ["#FFFFFF", "#F2E8EE", "#C7B6C3"],
    gold: ["#FFF3BF", "#F3C343", "#B98219"],
    orange: ["#FFE0B5", "#F29A3E", "#BC5E1A"],
  };
  function drawFlower(ctx, f, sc) {
    const base = C[f.col], white = f.col === "white";
    const light = white ? "#FFFFFF" : K.mix(base, "#FFFFFF", 0.42);
    const dark = white ? "#D8CAD1" : K.mix(base, "#4A0E3A", 0.24);
    // shadow of the whole bloom onto whatever is below
    ctx.save();
    silhouette(ctx, f);
    ctx.shadowColor = "rgba(80,0,32,0.5)";
    ctx.shadowBlur = 2.4 * sc;
    ctx.shadowOffsetX = 0.7 * sc;
    ctx.shadowOffsetY = 1.4 * sc;
    ctx.fillStyle = dark;
    ctx.fill();
    ctx.restore();
    // each petal is a little puffed pillow lit from the upper left
    for (let i = 0; i < f.n; i++) {
      const a = f.rot + (i * TAU) / f.n, pr = f.r * 0.55;
      const px = f.x + Math.cos(a) * f.r * 0.45, py = f.y + Math.sin(a) * f.r * 0.45;
      const g = ctx.createRadialGradient(px - pr * 0.3, py - pr * 0.38, pr * 0.05, px, py, pr * 1.05);
      g.addColorStop(0, light);
      g.addColorStop(0.5, base);
      g.addColorStop(0.85, base);
      g.addColorStop(1, dark);
      ctx.beginPath();
      petalPath(ctx, f, i, -0.15);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = 0.3;
      ctx.strokeStyle = white ? "rgba(140,110,130,0.35)" : "rgba(60,10,40,0.22)";
      ctx.stroke();
    }
    // a soft crease down the middle of each petal, like pressed clay
    ctx.beginPath();
    for (let i = 0; i < f.n; i++) {
      const a = f.rot + (i * TAU) / f.n;
      ctx.moveTo(f.x + Math.cos(a) * f.r * 0.3, f.y + Math.sin(a) * f.r * 0.3);
      ctx.lineTo(f.x + Math.cos(a) * f.r * 0.72, f.y + Math.sin(a) * f.r * 0.72);
    }
    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(0.3, f.r * 0.05);
    ctx.strokeStyle = white ? "rgba(150,120,140,0.22)" : "rgba(60,10,40,0.13)";
    ctx.stroke();
    // a dimple where the petals meet, then the bead centre
    const cr = f.r * (f.r > 6 ? 0.24 : 0.28);
    let g = ctx.createRadialGradient(f.x, f.y, cr * 0.8, f.x, f.y, cr * 2.4);
    g.addColorStop(0, "rgba(60,10,40,0.22)");
    g.addColorStop(1, "rgba(60,10,40,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(f.x, f.y, cr * 2.4, 0, TAU);
    ctx.fill();
    const cc = CENTRES[f.ctr];
    ctx.beginPath();
    ctx.arc(f.x + 0.25, f.y + 0.4, cr, 0, TAU);
    ctx.fillStyle = "rgba(60,10,40,0.3)";
    ctx.fill();
    g = ctx.createRadialGradient(f.x - cr * 0.4, f.y - cr * 0.45, 0, f.x, f.y, cr);
    g.addColorStop(0, cc[0]);
    g.addColorStop(0.5, cc[1]);
    g.addColorStop(1, cc[2]);
    ctx.beginPath();
    ctx.arc(f.x, f.y, cr, 0, TAU);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(f.x - cr * 0.38, f.y - cr * 0.4, cr * 0.3, 0, TAU);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fill();
  }
  function flowerBank(ctx, layer, R, sc) {
    const L = flowerLayout(R);
    if (layer === "foil") {
      // blooms and leaves hide the glitter beneath them; pearl beads keep a faint lustre
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "#000";
      L.leaves.forEach((l) => { leafPath(ctx, l); ctx.fill(); });
      L.flowers.forEach((f) => { silhouette(ctx, f); ctx.fill(); });
      ctx.restore();
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      L.flowers.forEach((f) => { if (f.ctr === "pearl") { ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (f.r > 6 ? 0.24 : 0.28), 0, TAU); ctx.fill(); } });
      L.pearls.forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); });
      return;
    }
    L.leaves.forEach((l) => drawLeaf(ctx, l, sc));
    L.flowers.forEach((f) => drawFlower(ctx, f, sc));
    L.pearls.forEach(([x, y, r]) => bead2(ctx, x, y, r));
  }
  function bead2(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x + 0.2, y + 0.35, r, 0, TAU);
    ctx.fillStyle = "rgba(90,0,35,0.35)";
    ctx.fill();
    const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, 0, x, y, r);
    g.addColorStop(0, "#FFFFFF");
    g.addColorStop(0.6, "#F6EEF2");
    g.addColorStop(1, "#D7C6D0");
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = g;
    ctx.fill();
  }

  /* ---------------- card ---------------- */
  function state(o) { return { scale: o.scale, tex: o.layer === "art" ? o.rng("tex") : null }; }

  K.registerCard({
    id: "bunny-space",
    title: "Space bunny",
    size: { w: W, h: H },
    paper: PINK,
    insert: "#FBF7F0",
    ink: "#2B2722",
    foil: "holo",
    message: "Some bunny\nthinks you're\nout of this\nworld.",
    messageRect: { x: 0.16 * W, y: 0.14 * H, w: 0.68 * W, h: 0.52 * H },

    drawCover(ctx, box, layer, o) {
      const S = state(o), art = layer === "art";
      if (art) paintCardstock(ctx, S);
      drawSpeckles(ctx, layer, speckleList(o.rng("speckles")));
      SPARKS.forEach(([x, y, r]) => sparkle(ctx, layer, x, y, r));
      // ring: back half and its beads go behind the head
      ringLine(ctx, layer, false, 1.45);
      ringBeads(ctx, layer, false);
      if (art) bunnyBody(ctx, S);
      else {
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        unionPath(ctx);
        ctx.fillStyle = "#000";
        ctx.fill();
        ctx.restore();
      }
      bunnyOutline(ctx, layer, S, 1.55);
      face(ctx, layer, 0.85);
      ringLine(ctx, layer, true, 1.45);
      ringBeads(ctx, layer, true);
      const sp = ringPoint(RING_SPARK_T);
      sparkle(ctx, layer, sp[0], sp[1], 6);
      flowerBank(ctx, layer, o.rng("flowers"), o.scale);
    },

    drawBack(ctx, box, layer, o) {
      const S = state(o), art = layer === "art";
      ctx.save();
      ctx.translate(BACK.bx, BACK.by);
      ctx.scale(BACK.s, BACK.s);
      ctx.translate(-BACK.ax, -BACK.ay);
      if (art) {
        // the faintest lift where the bunny is embossed
        unionPath(ctx);
        ctx.fillStyle = "rgba(255,170,205,0.05)";
        ctx.fill();
      }
      ctx.save();
      SHAPES.forEach((s) => clipOutside(ctx, s)); // the ring passes behind the head
      ringLine(ctx, layer, false, 1.7, art ? silverPattern(ctx, S) : null);
      ringBeads(ctx, layer, false);
      ctx.restore();
      bunnyOutline(ctx, layer, S, 2.0);
      face(ctx, layer, 1.45, art ? silverPattern(ctx, S) : null, false);
      ringLine(ctx, layer, true, 1.7, art ? silverPattern(ctx, S) : null);
      ringBeads(ctx, layer, true);
      const sp = ringPoint(RING_SPARK_T);
      sparkle(ctx, layer, sp[0], sp[1], 5.5);
      ctx.restore();
      BACK_SPARKS.forEach(([x, y, r]) => sparkle(ctx, layer, x, y, r));
    },

    drawInside(ctx, box, layer, o) {
      sparkle(ctx, layer, box.w / 2, box.h * 0.72, 4.5, "rgba(80,70,60,0.22)");
    },
  });
})();
