/* Keepsake core: card registry, deterministic randomness, face rendering and shared paint helpers.
   Shared by the app shell (src/shell.js) and the preview harness (tools/preview.html). See CONTRACT.md. */
(function () {
  "use strict";
  const K = (window.KEEPSAKE = window.KEEPSAKE || {});
  K.cards = K.cards || {};
  K.ORDER = ["lily-stars", "cherry-blossom", "mothers-day", "bunny-space", "pearl-moon"];

  K.registerCard = function (spec) {
    const need = ["id", "title", "size", "paper", "insert", "ink", "foil", "message", "drawCover", "drawBack", "drawInside"];
    for (const k of need) if (spec[k] == null) throw new Error(`card ${spec.id || "?"} is missing "${k}"`);
    spec.bleed = Object.assign({ t: 0, r: 0, b: 0, l: 0 }, spec.bleed || {});
    K.cards[spec.id] = spec;
  };

  /* ---------- deterministic randomness ---------- */
  K.hash = function (str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };
  K.rng = function (seed) {
    let a = (typeof seed === "string" ? K.hash(seed) : seed) >>> 0;
    const r = function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.range = (lo, hi) => lo + (hi - lo) * r();
    r.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * r());
    r.pick = (arr) => arr[Math.floor(r() * arr.length)];
    r.gauss = () => { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    return r;
  };

  /* ---------- geometry ---------- */
  // Each face is authored in card units: the card rectangle spans (0,0)-(size.w,size.h).
  // Die-cut art on the front may overflow by `bleed` (fractions of w/h). The back face mirrors that bleed.
  K.faceGeom = function (card, face) {
    const { w, h } = card.size;
    let b = card.bleed;
    if (face === "back") b = { t: b.t, r: b.l, b: b.b, l: b.r };
    if (face === "inside") b = { t: 0, r: 0, b: 0, l: 0 };
    const pad = { t: b.t * h, r: b.r * w, b: b.b * h, l: b.l * w };
    return { w, h, pad, W: w + pad.l + pad.r, H: h + pad.t + pad.b };
  };
  K.insertRect = function (card) {
    const { w, h } = card.size;
    return card.insertRect || { x: w * 0.045, y: h * 0.035, w: w * 0.91, h: h * 0.93 };
  };
  K.messageRect = function (card) {
    const { w, h } = card.size;
    return card.messageRect || { x: w * 0.16, y: h * 0.17, w: w * 0.68, h: h * 0.44 };
  };

  /* ---------- face rendering ---------- */
  // layer: "art" (full colour) or "foil" (opaque white wherever foil/glitter lives; alpha = mask strength)
  // opts: { text } — the card's (possibly user-edited) coverText
  K.renderFace = function (card, face, layer, scale, opts) {
    opts = opts || {};
    const g = K.faceGeom(card, face);
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(g.W * scale));
    c.height = Math.max(1, Math.round(g.H * scale));
    const ctx = c.getContext("2d");
    const o = {
      text: opts.text != null ? opts.text : card.coverText,
      rand: K.rng(card.id + ":" + face),
      rng: (name) => K.rng(card.id + ":" + face + ":" + name), // independent named streams, identical in both layers
      face, layer, scale,
    };
    const box = { w: g.w, h: g.h };
    ctx.setTransform(scale, 0, 0, scale, g.pad.l * scale, g.pad.t * scale);
    if (face === "front") {
      card.drawCover(ctx, box, layer, o);
    } else if (face === "back") {
      if (layer === "art") {
        // silhouette of the cover, mirrored, in the card stock colour
        const front = K.renderFace(card, "front", "art", scale, opts);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.translate(c.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(front, 0, 0);
        ctx.restore();
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = "source-in";
        ctx.fillStyle = card.backPaper || card.paper;
        ctx.fillRect(0, 0, c.width, c.height);
        // a soft shade toward the spine (right edge of the back face)
        const sh = ctx.createLinearGradient(c.width - g.pad.l * scale - g.w * scale * 0.25, 0, c.width - g.pad.l * scale, 0);
        sh.addColorStop(0, "rgba(0,0,0,0)");
        sh.addColorStop(1, "rgba(60,40,20,0.10)");
        ctx.globalCompositeOperation = "source-atop";
        ctx.fillStyle = sh;
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.restore();
        K.paperGrain(ctx, -g.pad.l, -g.pad.t, g.W, g.H, K.rng(card.id + ":grain"), 0.05, "source-atop");
      }
      card.drawBack(ctx, box, layer, o);
    } else if (face === "inside") {
      if (layer === "art") {
        ctx.fillStyle = card.paper;
        ctx.fillRect(0, 0, g.w, g.h);
        K.paperGrain(ctx, 0, 0, g.w, g.h, K.rng(card.id + ":grain2"), 0.04);
        const r = K.insertRect(card);
        ctx.save();
        ctx.shadowColor = "rgba(40,30,20,0.18)";
        ctx.shadowBlur = 6 * 1;
        ctx.shadowOffsetX = -1;
        ctx.shadowOffsetY = 1;
        ctx.fillStyle = card.insert;
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.restore();
        K.paperGrain(ctx, r.x, r.y, r.w, r.h, K.rng(card.id + ":grain3"), 0.03);
      }
      card.drawInside(ctx, box, layer, o);
    }
    return c;
  };

  K.thumb = function (card, px) {
    const g = K.faceGeom(card, "front");
    const s = px / Math.max(g.W, g.H);
    return K.renderFace(card, "front", "art", s).toDataURL("image/png");
  };

  /* ---------- shared paint helpers (optional for card authors) ---------- */
  // Fine paper grain: tiny light/dark flecks. mode lets you keep it inside existing paint ("source-atop").
  K.paperGrain = function (ctx, x, y, w, h, rand, amount, mode) {
    rand = K.rng((rand() * 4294967296) >>> 0); // consumes exactly ONE value from the caller's stream
    const n = Math.round((w * h) / 9);
    ctx.save();
    if (mode) ctx.globalCompositeOperation = mode;
    for (let i = 0; i < n; i++) {
      const dark = rand() < 0.5;
      ctx.fillStyle = dark ? `rgba(70,50,30,${amount * rand()})` : `rgba(255,255,255,${amount * 1.4 * rand()})`;
      ctx.fillRect(x + rand() * w, y + rand() * h, 0.6 + rand() * 0.8, 0.6 + rand() * 0.8);
    }
    ctx.restore();
  };

  // Star path (points, outer radius r, inner ratio). Rounded=true softens tips like a punched sticker.
  K.starPath = function (ctx, x, y, r, points, inner, rot, rounded) {
    points = points || 5; inner = inner == null ? 0.48 : inner; rot = rot || -Math.PI / 2;
    const pts = [];
    for (let i = 0; i < points * 2; i++) {
      const rr = i % 2 ? r * inner : r, a = rot + (i * Math.PI) / points;
      pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
    }
    ctx.beginPath();
    if (!rounded) { pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); return; }
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const start = mid(pts[pts.length - 1], pts[0]);
    ctx.moveTo(start[0], start[1]);
    for (let i = 0; i < pts.length; i++) { const p = pts[i], m = mid(p, pts[(i + 1) % pts.length]); ctx.quadraticCurveTo(p[0], p[1], m[0], m[1]); }
    ctx.closePath();
  };

  // 4-point sparkle (the "twinkle" glyph)
  K.sparklePath = function (ctx, x, y, r, thin) {
    thin = thin || 0.18;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x + r * thin, y - r * thin, x + r, y);
    ctx.quadraticCurveTo(x + r * thin, y + r * thin, x, y + r);
    ctx.quadraticCurveTo(x - r * thin, y + r * thin, x - r, y);
    ctx.quadraticCurveTo(x - r * thin, y - r * thin, x, y - r);
    ctx.closePath();
  };

  // Glitter: fills the CURRENT path (call after building a path) with dense flecks of the given palette.
  // layer "foil" -> draws the clip area as opaque white so the shell can sheen it.
  K.glitterFill = function (ctx, layer, rand, palette, opts) {
    opts = opts || {};
    rand = K.rng((rand() * 4294967296) >>> 0); // consumes exactly ONE value from the caller's stream in either layer
    ctx.save();
    ctx.clip();
    if (layer === "foil") {
      ctx.fillStyle = `rgba(255,255,255,${opts.mask == null ? 1 : opts.mask})`;
      ctx.fillRect(-1e4, -1e4, 2e4, 2e4);
      ctx.restore();
      return;
    }
    const b = opts.bounds; // {x,y,w,h} in card units — required for speed
    ctx.fillStyle = opts.base || palette[0];
    ctx.fillRect(b.x, b.y, b.w, b.h);
    const n = Math.round(b.w * b.h * (opts.density || 2.2));
    const size = opts.size || 0.9;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = palette[(rand() * palette.length) | 0];
      const s = size * (0.5 + rand());
      ctx.fillRect(b.x + rand() * b.w, b.y + rand() * b.h, s, s);
    }
    // a few bright glints
    const g = Math.round(n * (opts.glints || 0.02));
    for (let i = 0; i < g; i++) {
      ctx.fillStyle = opts.glint || "rgba(255,255,240,0.95)";
      const s = size * (0.6 + rand() * 0.8);
      ctx.fillRect(b.x + rand() * b.w, b.y + rand() * b.h, s, s);
    }
    ctx.restore();
  };

  K.mix = function (a, b, t) {
    const p = (h) => { h = h.replace("#", ""); if (h.length === 3) h = h.split("").map((c) => c + c).join(""); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
    const A = p(a), B = p(b);
    return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("");
  };

  /* ---------- placeholders so the shell never breaks if a card file is missing ---------- */
  K.ensureCards = function () {
    const tints = ["#F1E6C8", "#C8102E", "#E9E7E4", "#E0156E", "#F2F2F4"];
    K.ORDER.forEach((id, i) => {
      if (K.cards[id]) return;
      K.registerCard({
        id, title: id, size: { w: 240, h: 300 }, paper: "#F4F1EA", insert: "#FBF8F2", ink: "#2A2723", foil: "gold",
        message: "Placeholder card.\n(" + id + ")",
        drawCover(ctx, b, layer) { if (layer === "art") { ctx.fillStyle = tints[i]; ctx.fillRect(0, 0, b.w, b.h); } },
        drawBack() {}, drawInside() {},
      });
    });
  };
})();
