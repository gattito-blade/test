/* Keepsake shell: 3D card stage, foil sheen, open/close, card switching, toolbar, writing panel, slideshow.
   Reads cards from window.KEEPSAKE (see CONTRACT.md). Deterministic: every random choice comes from K.rng; no image files. */
(function () {
  "use strict";
  const K = window.KEEPSAKE;
  if (!K) return;
  K.ensureCards();

  /* ================= utilities ================= */
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const $ = (id) => document.getElementById(id);
  function el(tag, cls, parent) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }
  const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  // cubic-bezier timing (x(t) solved by Newton steps)
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    return (x) => {
      if (x <= 0) return 0; if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 6; i++) {
        const fx = ((ax * t + bx) * t + cx) * t - x, d = (3 * ax * t + 2 * bx) * t + cx;
        if (Math.abs(d) < 1e-6) break;
        t = clamp(t - fx / d, 0, 1);
      }
      return ((ay * t + by) * t + cy) * t;
    };
  }
  // cover swing, as in the recording: the cover snaps up from the first frame (upright after ~0.1 s), eases
  // down onto the left, then a very small settle (never far enough to pass through the inside page)
  const swingEase = bezier(0.22, 0.75, 0.25, 1);
  const easeOpen = (t) => swingEase(t) + 0.007 * Math.sin(Math.PI * clamp((t - 0.62) / 0.38, 0, 1));
  // closing also moves on the first frame, then lands softly
  const closeEase = bezier(0.3, 0.35, 0.2, 1);
  // springy drop-in released from rest: smooth start, ~4% overshoot, settled by t = 1
  const SPRING_END = 1 - Math.exp(-6) * (Math.cos(6) + Math.sin(6));
  const springEase = (t) => (t >= 1 ? 1 : (1 - Math.exp(-6 * t) * (Math.cos(6 * t) + Math.sin(6 * t))) / SPRING_END);
  const fmt = (v) => (Math.abs(v) < 1e-4 ? "0" : v.toFixed(3));
  const schedule = window.requestIdleCallback
    ? (fn) => window.requestIdleCallback(fn, { timeout: 400 })
    : (fn) => setTimeout(fn, 24);

  const mqReduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  let reduced = !!(mqReduce && mqReduce.matches);
  if (mqReduce) {
    const onRM = (e) => { reduced = e.matches; if (reduced) pauseShow(false); };
    if (mqReduce.addEventListener) mqReduce.addEventListener("change", onRM);
    else if (mqReduce.addListener) mqReduce.addListener(onRM);
  }

  const cssVar = (name, fallback) => {
    try { const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); return v || fallback; }
    catch (e) { return fallback; }
  };

  /* ================= persistence (all access guarded) ================= */
  const STORE_KEY = "keepsake-v1";
  // the most the inside page can hold legibly (narrowest insert, phone width, with a sign-off)
  const MSG_MAX = 300, SIGN_MAX = 80, COVER_MAX = 60;
  const FOILS = ["gold", "silver", "rose", "holo"];
  const isPlainObject = (v) => !!v && typeof v === "object" && !Array.isArray(v);
  const trimEnd = (s) => s.replace(/\s+$/, "");
  // keep only well-formed fields (strings of sane length, a known foil); anything else is dropped
  function cleanEdit(v) {
    const out = {};
    if (!isPlainObject(v)) return out;
    if (typeof v.message === "string") out.message = trimEnd(v.message.replace(/\r/g, "")).slice(0, MSG_MAX);
    if (typeof v.signoff === "string") out.signoff = v.signoff.slice(0, SIGN_MAX);
    if (typeof v.coverText === "string") out.coverText = v.coverText.slice(0, COVER_MAX);
    if (typeof v.foil === "string" && FOILS.includes(v.foil)) out.foil = v.foil;
    return out;
  }
  // sanitised copy of what is stored, keyed by known card ids only (null when storage can't be read)
  function readStore() {
    try {
      const raw = window.localStorage.getItem(STORE_KEY);
      const v = raw ? JSON.parse(raw) : null;
      const out = {};
      if (isPlainObject(v)) {
        K.ORDER.forEach((id) => {
          if (!Object.prototype.hasOwnProperty.call(v, id)) return;
          const e = cleanEdit(v[id]);
          if (Object.keys(e).length) out[id] = e;
        });
      }
      return out;
    } catch (e) { return null; }
  }
  const store = readStore() || {};
  const dirtyIds = new Set(); // cards edited in this tab since the last save
  let saveTimer = 0, saveFailed = false;
  const SAVE_NOTE = "Edits can't be saved in this browser, so they will be lost on reload.";
  function flushSave() {
    clearTimeout(saveTimer); saveTimer = 0;
    try {
      // merge per card into what is stored now, so another tab's edits to other cards survive
      let cur = {};
      try {
        const raw = window.localStorage.getItem(STORE_KEY);
        const v = raw ? JSON.parse(raw) : null;
        if (isPlainObject(v)) cur = v;
      } catch (e) { /* unreadable or corrupt: start over */ }
      dirtyIds.forEach((id) => {
        if (store[id] && Object.keys(store[id]).length) cur[id] = store[id];
        else delete cur[id];
      });
      window.localStorage.setItem(STORE_KEY, JSON.stringify(cur));
      dirtyIds.clear();
      return true;
    } catch (e) {
      // storage unavailable (private mode, quota, sandbox): edits stay for this visit; say so once
      if (!saveFailed) { saveFailed = true; if (popStatus) popStatus.textContent = SAVE_NOTE; }
      return false;
    }
  }
  function saveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(flushSave, 300); }
  window.addEventListener("pagehide", () => { if (saveTimer) flushSave(); });

  /* ================= front-art memo (back-of-cover render reuses the front we already painted) ================= */
  const baseRender = K.renderFace;
  let frontMemo = null;
  K.renderFace = function (card, face, layer, scale, opts) {
    if (frontMemo && face === "front" && layer === "art" && card === frontMemo.card && scale === frontMemo.scale) {
      const text = opts && opts.text != null ? opts.text : card.coverText;
      if (text === frontMemo.text) return frontMemo.canvas;
    }
    return baseRender.call(K, card, face, layer, scale, opts);
  };

  /* ================= foil looks ================= */
  // peak = alpha of the band's core. Gold keeps a saturated warm core at a lower peak, so a passing band
  // lifts dark bronze glitter to bright yellow gold instead of washing it out to cream.
  const FOIL = {
    gold: { tint: "255,196,80", core: "255,214,110", glint: [255, 228, 160], base: 0.06, peak: 0.6 },
    silver: { tint: "222,232,255", core: "255,255,255", glint: [238, 245, 255], base: 0.09, peak: 0.82 },
    rose: { tint: "255,204,218", core: "255,242,246", glint: [255, 234, 241], base: 0.07, peak: 0.82 },
    holo: { tint: "232,224,255", core: "255,255,255", glint: [255, 255, 255], base: 0.05, peak: 0.82, holo: true },
  };
  const D = [Math.sin((115 * Math.PI) / 180), -Math.cos((115 * Math.PI) / 180)]; // 115deg gradient direction
  const glintSprites = {};
  function glintSprite(foil) {
    if (glintSprites[foil]) return glintSprites[foil];
    const S = 64, c = document.createElement("canvas");
    c.width = c.height = S;
    const x = c.getContext("2d"), m = S / 2, [r, g, b] = FOIL[foil].glint;
    const halo = x.createRadialGradient(m, m, 0, m, m, m);
    halo.addColorStop(0, `rgba(${r},${g},${b},0.85)`);
    halo.addColorStop(0.18, `rgba(${r},${g},${b},0.35)`);
    halo.addColorStop(1, `rgba(${r},${g},${b},0)`);
    x.fillStyle = halo; x.fillRect(0, 0, S, S);
    x.fillStyle = "rgba(255,255,255,0.95)";
    K.sparklePath(x, m, m, m * 0.98, 0.07); x.fill();
    x.save(); x.translate(m, m); x.rotate(Math.PI / 4); x.globalAlpha = 0.45;
    K.sparklePath(x, 0, 0, m * 0.5, 0.1); x.fill(); x.restore();
    return (glintSprites[foil] = c);
  }

  /* ================= cards & state ================= */
  const cards = K.ORDER.map((id) => K.cards[id]).filter(Boolean);
  const N = cards.length;
  const stage = $("stage");
  const thumbsEl = $("thumbs");
  const btnOpen = $("btn-open"), btnWrite = $("btn-write"), btnPlay = $("btn-play");
  const writer = $("writer"), live = $("live");
  const fMessage = $("f-message"), fSignoff = $("f-signoff"), fCover = $("f-cover"), fCoverWrap = $("f-cover-wrap");
  const fFoil = $("f-foil"), fCopy = $("f-copy"), fReset = $("f-reset"), popStatus = $("pop-status");
  const popActions = $("pop-actions"), popConfirm = $("pop-confirm"), toolbar = $("toolbar");

  let CE_VALUE = "plaintext-only";
  try { const t = document.createElement("div"); t.contentEditable = "plaintext-only"; if (t.contentEditable !== "plaintext-only") CE_VALUE = "true"; }
  catch (e) { CE_VALUE = "true"; }

  const S = cards.map((card, i) => {
    const g = K.faceGeom(card, "front");
    const st = {
      card, i, g,
      edit: store[card.id] || {},
      closed: { x0: -g.pad.l, x1: g.w + g.pad.r, y0: -g.pad.t, y1: g.h + g.pad.b },
      opened: { x0: -g.w - g.pad.r, x1: g.w, y0: -g.pad.t, y1: g.h + g.pad.b },
      u: 1, sOpen: 1, scale: 0,
      q: 0, m: 0, ot: null, openTo: 0, settled: false,
      pose: { ty: 0, rz: 0, rx: 0, op: 0 }, ptw: null, visible: false,
      faces: {}, rawFront: null, fontsAtRender: null,
      needFit: true, fit: 1, box: null, fade: 1,
      last: {},
    };
    return st;
  });
  const getMessage = (st) => (st.edit.message != null ? st.edit.message : st.card.message);
  const getSignoff = (st) => (st.edit.signoff != null ? st.edit.signoff : "");
  const getCover = (st) => (st.edit.coverText != null ? st.edit.coverText : st.card.coverText);
  // whitelist lookup: a stored name such as "constructor" must never reach the FOIL table
  const getFoil = (st) => { const f = st.edit.foil || st.card.foil; return FOILS.includes(f) ? f : "gold"; };
  function touchEdit(st) { store[st.card.id] = st.edit; dirtyIds.add(st.card.id); saveSoon(); }
  function coverLabel(st) {
    const t = st.card.coverText != null ? String(getCover(st) || "").replace(/\s+/g, " ").trim() : "";
    return `${st.card.title} card` + (t ? `, cover reads "${t}"` : "");
  }

  /* ================= DOM per card ================= */
  function makeFace(parent, cls) {
    const f = { el: el("div", cls, parent) };
    f.art = el("canvas", "art", f.el);
    f.sheen = el("canvas", "sheen", f.el);
    f.glare = el("canvas", "glare", f.el);
    f.art.width = f.art.height = f.sheen.width = f.sheen.height = f.glare.width = f.glare.height = 1;
    f.sctx = f.sheen.getContext("2d");
    f.gctx = f.glare.getContext("2d");
    f.ready = false; f.dirty = true; f.mask = null; f.amask = null; f.glints = null; f.key = "";
    f.bright = 1;
    return f;
  }

  S.forEach((st) => {
    const { card, g } = st;
    const slot = el("div", "slot", stage);
    slot.hidden = true;
    slot.dataset.card = card.id;
    const set = (k, v) => slot.style.setProperty(k, String(v));
    set("--w", g.w); set("--h", g.h);
    set("--pl", g.pad.l); set("--pt", g.pad.t); set("--fw", g.W); set("--fh", g.H);
    const mr = K.messageRect(card);
    set("--mx", mr.x); set("--my", mr.y); set("--mw", mr.w); set("--mh", mr.h);
    set("--ms", card.messageSize || 0.085 * g.w);
    set("--ink", card.ink);
    set("--u", 1);

    const shadow = el("div", "shadow", slot);
    const amb = el("i", "sh-amb", shadow);
    const contact = el("i", "sh-contact", shadow);
    const coverSh = el("i", "sh-contact sh-cover", shadow); // the lifted cover's shadow left of the spine
    const cardEl = el("div", "card", slot);
    const inside = el("div", "page inside", cardEl);
    const fi = { el: inside };
    fi.art = el("canvas", "art", inside);
    fi.sheen = el("canvas", "sheen", inside);
    fi.glare = el("canvas", "glare", inside);
    fi.art.width = fi.art.height = fi.sheen.width = fi.sheen.height = fi.glare.width = fi.glare.height = 1;
    fi.sctx = fi.sheen.getContext("2d"); fi.gctx = fi.glare.getContext("2d");
    fi.ready = false; fi.dirty = true; fi.key = ""; fi.bright = 1;
    const spine = el("div", "spine-shade", inside);
    const lid = el("div", "lid-shade", inside);
    const msg = el("div", "msg", inside);
    // hidden from assistive tech until the card is open and the message can be edited (see setSettled)
    msg.setAttribute("aria-hidden", "true");
    const msgText = el("div", "msg-text", msg);
    msgText.setAttribute("aria-label", "Message inside the card");
    msgText.setAttribute("spellcheck", "false");
    msgText.dataset.placeholder = "Write something…";
    const msgSign = el("div", "msg-sign", msg);
    // the hint lives outside .msg, which clips its contents to the insert
    const hint = el("div", "msg-hint", inside);
    hint.textContent = "Click to write";
    hint.setAttribute("aria-hidden", "true");
    const cover = el("div", "cover", cardEl);
    // the card art as an image with a text alternative (kept separate from the editable message)
    cover.setAttribute("role", "img");
    cover.setAttribute("aria-label", coverLabel(st));
    const front = makeFace(cover, "face front");
    const back = makeFace(cover, "face back");
    st.faces = { front, back, inside: fi };
    st.dom = { slot, shadow, amb, contact, coverSh, cardEl, inside, spine, lid, msg, msgText, msgSign, cover };
    msgText.textContent = getMessage(st);
    msgSign.textContent = getSignoff(st);

    const capHit = () => {
      const note = "That's as much as fits on this card.";
      popStatus.textContent = note;
      if (writer.hidden) announce(note);
    };
    const syncMessage = () => {
      let t = msgText.innerText.replace(/\r/g, "");
      if (t.length > MSG_MAX) {
        // a path that slipped past beforeinput (IME, drag and drop): cut back and keep the caret at the end
        t = t.slice(0, MSG_MAX);
        msgText.textContent = t;
        try { const r = document.createRange(); r.selectNodeContents(msgText); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) { /* ignore */ }
        capHit();
      }
      // an emptied editor keeps a stray <br>; clear it so the placeholder shows
      if (!t.trim() && msgText.firstChild) msgText.textContent = "";
      // trailing newlines (Chrome's caret placeholder included) are never stored; the DOM is left alone
      // while typing, so the caret stays on the new line
      t = trimEnd(t);
      st.edit.message = t; touchEdit(st);
      if (!writer.hidden && st === S[active]) fMessage.value = t;
      st.needFit = true;
    };
    msgText.addEventListener("input", syncMessage);
    // contenteditable="true" fallback (no plaintext-only): text goes in as plain text nodes, so the DOM never
    // grows <div>/<br>/<b> and what is shown, what innerText reads and what is stored always agree.
    // (execCommand("insertText") is not used for newlines: Chrome turns "\n" into a paragraph split.)
    const insertPlain = (text) => {
      const sel = getSelection();
      if (!sel || !sel.rangeCount || !msgText.contains(sel.anchorNode)) return;
      const r = sel.getRangeAt(0);
      r.deleteContents();
      const tn = document.createTextNode(text);
      r.insertNode(tn);
      // a newline at the very end only shows (and takes the caret) with one more after it
      const rest = document.createRange();
      rest.setStartAfter(tn); rest.setEnd(msgText, msgText.childNodes.length);
      if (/\n$/.test(text) && !rest.toString().length) msgText.appendChild(document.createTextNode("\n"));
      r.setStartAfter(tn); r.collapse(true);
      sel.removeAllRanges(); sel.addRange(r);
      syncMessage();
    };
    msgText.addEventListener("beforeinput", (e) => {
      const it = e.inputType || "";
      if (CE_VALUE === "true") {
        if (it.startsWith("format") || it === "insertFromDrop") { e.preventDefault(); return; }
        if (it === "insertParagraph" || it === "insertLineBreak") {
          e.preventDefault();
          if (msgText.innerText.replace(/\n$/, "").length < MSG_MAX) insertPlain("\n");
          else capHit();
          return;
        }
      }
      if (!it.startsWith("insert")) return;
      let add = e.data;
      if (add == null && e.dataTransfer) { try { add = e.dataTransfer.getData("text/plain"); } catch (er) { add = ""; } }
      if (add == null) add = it === "insertParagraph" || it === "insertLineBreak" ? "\n" : "";
      const sel = getSelection();
      const selLen = sel && sel.rangeCount && msgText.contains(sel.anchorNode) ? sel.toString().length : 0;
      const room = MSG_MAX - (msgText.innerText.replace(/\n$/, "").length - selLen);
      if (add.length <= room) return;
      e.preventDefault();
      if (room > 0 && it === "insertFromPaste") document.execCommand("insertText", false, add.slice(0, room));
      capHit();
    });
    msgText.addEventListener("blur", () => { if (!msgText.innerText.trim() && msgText.firstChild) msgText.textContent = ""; });
    msgText.addEventListener("focus", () => { pauseShow(); });
    msgText.addEventListener("click", (e) => e.stopPropagation());
    msgText.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        // hand focus to the Open/Close button rather than dropping it on the page body
        e.preventDefault(); e.stopPropagation();
        try { btnOpen.focus({ preventScroll: true }); } catch (er) { btnOpen.focus(); }
      }
    });
    if (CE_VALUE === "true") {
      msgText.addEventListener("paste", (e) => {
        e.preventDefault();
        let t = ((e.clipboardData && e.clipboardData.getData("text/plain")) || "").replace(/\r/g, "");
        const sel = getSelection();
        const selLen = sel && sel.rangeCount && msgText.contains(sel.anchorNode) ? sel.toString().length : 0;
        const room = MSG_MAX - (msgText.innerText.replace(/\n$/, "").length - selLen);
        if (t.length > room) { t = t.slice(0, Math.max(0, room)); capHit(); }
        if (t) insertPlain(t);
      });
    }
  });

  /* ================= thumbnails ================= */
  const THUMB = 36;
  const thumbs = S.map((st, i) => {
    const b = el("button", "thumb", thumbsEl);
    b.type = "button";
    b.title = st.card.title;
    b.setAttribute("aria-label", `${st.card.title} (card ${i + 1} of ${N})`);
    const c = el("canvas", "", b);
    c.setAttribute("aria-hidden", "true");
    b.addEventListener("click", (e) => {
      manual(); goTo(i, i >= intended() ? 1 : -1);
      // a pointer click should not leave focus parked on the thumbnail, or Space/Enter would re-press it
      // instead of opening the card; keyboard activation (detail 0) keeps focus where the user put it
      if (e.detail > 0) b.blur();
    });
    st.thumb = c;
    drawThumbPlaceholder(st);
    return b;
  });
  function thumbBox(st) {
    const dpr = clamp(window.devicePixelRatio || 1, 1, 3);
    const px = Math.round(THUMB * dpr);
    if (st.thumb.width !== px) { st.thumb.width = px; st.thumb.height = px; }
    const { W, H } = st.g, k = (px * 0.98) / Math.max(W, H);
    return { px, k, w: W * k, h: H * k };
  }
  function drawThumbPlaceholder(st) {
    const { px, k, w, h } = thumbBox(st), x = st.thumb.getContext("2d");
    x.clearRect(0, 0, px, px);
    const g = st.g;
    x.fillStyle = st.card.paper;
    x.fillRect((px - w) / 2 + g.pad.l * k, (px - h) / 2 + g.pad.t * k, g.w * k, g.h * k);
  }
  function drawThumb(st, src) {
    const { px, w, h } = thumbBox(st), x = st.thumb.getContext("2d");
    x.clearRect(0, 0, px, px);
    // step down for a clean downsample
    let s = src;
    while (s.width > w * 2.2) {
      const t = document.createElement("canvas");
      t.width = Math.max(1, Math.round(s.width / 2)); t.height = Math.max(1, Math.round(s.height / 2));
      const tx = t.getContext("2d"); tx.imageSmoothingQuality = "high"; tx.drawImage(s, 0, 0, t.width, t.height);
      s = t;
    }
    x.imageSmoothingQuality = "high";
    // a tight painted shadow keeps pale cards (white-on-white) legible on the toolbar in either theme
    const d = px / THUMB;
    x.save();
    x.shadowColor = "rgba(30,22,14,0.42)";
    x.shadowBlur = 1.6 * d; x.shadowOffsetY = 0.6 * d;
    x.drawImage(s, (px - w) / 2, (px - h) / 2, w, h);
    x.restore();
  }

  /* ================= layout ================= */
  let vw = 0, vh = 0, dpr = 1, cx = 0, cy = 0, availW = 0, availH = 0, topPad = 64;
  // while the writing panel is open the card moves up (and shrinks a little) so the message stays in view
  // docked: on short landscape screens the writing panel sits at the right and the card moves left of it
  const room = { r: { x: 0, v: 0 }, top: 0, left: 0, docked: false, inL: 0 };
  // render scale (device px per card unit). Cards are capped at 2.5 to bound canvas memory; the card on
  // show may go to 3.5 on hi-DPI screens so large retina displays don't get soft art.
  function wantScale(st) {
    // (only where the card is drawn large, so phones keep their memory budget)
    const big = st.u * (st.closed.x1 - st.closed.x0) > 450;
    const cap = st === S[active] && dpr >= 2 && big ? 3.5 : 2.5;
    return clamp(st.u * dpr * Math.max(1, st.sOpen), 1, cap);
  }
  // adopt a new scale only when it is clearly larger: shrinking keeps the sharper backing store we
  // already have (no re-render on rotation or a smaller window)
  function growScale(st) {
    const s = wantScale(st);
    if (!st.scale) { st.scale = s; return false; }
    if (s > st.scale * 1.15) {
      st.scale = s;
      for (const k in st.faces) st.faces[k].dirty = true;
      return true;
    }
    return false;
  }
  function layout() {
    vw = window.innerWidth || document.documentElement.clientWidth || 800;
    vh = window.innerHeight || document.documentElement.clientHeight || 600;
    dpr = window.devicePixelRatio || 1;
    const narrow = vw < 520;
    topPad = narrow ? 58 : 64;
    const botPad = narrow ? 84 : 96, side = 16;
    availW = Math.max(120, vw - side * 2);
    availH = Math.max(120, vh - topPad - botPad);
    // the recording sits the card a little above the middle of the free band
    cx = vw / 2; cy = topPad + availH / 2 - (narrow ? 0 : Math.min(22, availH * 0.04));
    let rerender = false;
    // closed size: the whole silhouette (die-cut overhang included) fills about 64% of the viewport height,
    // as in the recording, so every card reads at a similar size whatever its shape or bleed
    const capH = Math.min(availH * 0.9, vh * 0.64);
    S.forEach((st) => {
      const cw = st.closed.x1 - st.closed.x0, ch = st.closed.y1 - st.closed.y0;
      const u = Math.min((availW * 0.92) / cw, capH / ch, 1.9);
      st.u = u;
      const ow = st.opened.x1 - st.opened.x0, oh = st.opened.y1 - st.opened.y0;
      // opened, the card keeps its scale (as in the recording) unless the spread needs to shrink to fit
      st.sOpen = Math.min(1, (availW * 0.95) / (ow * u), (availH * 0.92) / (oh * u));
      st.dom.slot.style.setProperty("--u", u.toFixed(4));
      // camera at ~2.8 card widths: the hinge swing looms toward the viewer as in the recording
      // (pointer-tilt angles are scaled down to match, see frame())
      st.dom.slot.style.perspective = Math.round(clamp(st.g.w * u * 2.8, 900, 1800)) + "px";
      if (growScale(st)) rerender = true;
      st.needFit = true;
    });
    return rerender;
  }

  /* ================= face rendering ================= */
  let edgeColor = "rgba(70,52,34,0.38)";
  const fontProbe = ['500 20px "Josefin Sans"', '500 20px "Caveat"'];
  const fontsOK = () => { try { return fontProbe.every((f) => document.fonts.check(f)); } catch (e) { return true; } };

  function fallbackFace(st, face, layer, s) {
    const g = K.faceGeom(st.card, face);
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(g.W * s)); c.height = Math.max(1, Math.round(g.H * s));
    if (layer === "art") {
      const x = c.getContext("2d");
      x.fillStyle = face === "back" ? st.card.backPaper || st.card.paper : face === "inside" ? st.card.insert : st.card.paper;
      x.fillRect(g.pad.l * s, g.pad.t * s, g.w * s, g.h * s);
    }
    return c;
  }
  function safeRender(st, face, layer) {
    const s = st.scale, text = getCover(st);
    try {
      if (face === "back" && layer === "art" && st.rawFront && st.rawFront.scale === s && st.rawFront.text === text) {
        frontMemo = { card: st.card, scale: s, text, canvas: st.rawFront.canvas };
      }
      return K.renderFace(st.card, face, layer, s, { text });
    } catch (err) {
      if (window.console) console.warn(`Keepsake: ${st.card.id} ${face}/${layer} failed to paint:`, err && err.message);
      return fallbackFace(st, face, layer, s);
    } finally {
      frontMemo = null;
    }
  }

  function renderFace(st, face) {
    const f = st.faces[face];
    const s = st.scale;
    const raw = safeRender(st, face, "art");
    const foil = safeRender(st, face, "foil");
    if (face === "front") st.rawFront = { canvas: raw, scale: s, text: getCover(st) };
    if (face === "back") st.rawFront = null; // no longer needed

    // display art: the painting plus a hair-thin card-stock edge following the die-cut silhouette
    const art = f.art;
    art.width = raw.width; art.height = raw.height;
    const ax = art.getContext("2d");
    ax.save();
    ax.shadowColor = edgeColor;
    ax.shadowBlur = Math.max(0.6, s * 0.55);
    ax.shadowOffsetX = s * 0.12;
    ax.shadowOffsetY = s * 0.38;
    ax.drawImage(raw, 0, 0);
    ax.restore();
    if (face === "back") {
      const gb = K.faceGeom(st.card, "back");
      const spineX = Math.round((gb.pad.l + gb.w) * s);
      ax.clearRect(spineX, 0, art.width - spineX, art.height);
    }

    // overlay canvases (sheen <= 900px, glare <= 320px on the long side)
    const g = K.faceGeom(st.card, face);
    const os = Math.min(s, 900 / Math.max(g.W, g.H));
    const OW = Math.max(1, Math.round(g.W * os)), OH = Math.max(1, Math.round(g.H * os));
    f.os = os;
    // the sheen canvas only spans the foil's bounding box (plus room for glints): most pages carry a small
    // foil motif, and a smaller layer is cheaper both to redraw and to composite every frame
    const an = analyseFoil(st, face, foil, OW, OH, os);
    const sb = an.box;
    f.sb = sb;
    if (!sb) {
      f.sheen.width = f.sheen.height = 1;
      f.sheen.style.display = "none";
      f.mask = null;
    } else {
      f.sheen.style.display = "";
      f.sheen.width = sb.w; f.sheen.height = sb.h;
      const ss = f.sheen.style;
      ss.left = (100 * sb.x / OW).toFixed(4) + "%"; ss.top = (100 * sb.y / OH).toFixed(4) + "%";
      ss.width = (100 * sb.w / OW).toFixed(4) + "%"; ss.height = (100 * sb.h / OH).toFixed(4) + "%";
      const mask = document.createElement("canvas");
      mask.width = sb.w; mask.height = sb.h;
      const kx = foil.width / OW, ky = foil.height / OH;
      mask.getContext("2d").drawImage(foil, sb.x * kx, sb.y * ky, sb.w * kx, sb.h * ky, 0, 0, sb.w, sb.h);
      f.mask = mask;
    }
    const gs = Math.min(s, 320 / Math.max(g.W, g.H));
    const GW = Math.max(1, Math.round(g.W * gs)), GH = Math.max(1, Math.round(g.H * gs));
    f.gs = gs;
    f.glare.width = GW; f.glare.height = GH;
    const am = document.createElement("canvas");
    am.width = GW; am.height = GH;
    am.getContext("2d").drawImage(art, 0, 0, GW, GH);
    f.amask = am;
    f.glints = an.glints;
    f.ready = true; f.dirty = false; f.key = "";
    if (face === "front") drawThumb(st, raw);
    if (face === "front") st.fontsAtRender = fontsOK();
  }

  // reads a small downsample of the foil mask once: the bounding box of everything foiled (sheen canvas
  // size) and where the twinkling glints sit (relative to that box)
  function analyseFoil(st, face, foil, OW, OH, os) {
    const none = { box: null, glints: new Float32Array(0) };
    const k = Math.min(1, 150 / Math.max(foil.width, foil.height));
    const sw = Math.max(1, Math.round(foil.width * k)), sh = Math.max(1, Math.round(foil.height * k));
    const c = document.createElement("canvas");
    c.width = sw; c.height = sh;
    const x = c.getContext("2d", { willReadFrequently: true });
    x.drawImage(foil, 0, 0, sw, sh);
    let data;
    try { data = x.getImageData(0, 0, sw, sh).data; }
    catch (e) { return { box: { x: 0, y: 0, w: OW, h: OH }, glints: new Float32Array(0) }; }
    const cand = [];
    let x0 = sw, y0 = sh, x1 = -1, y1 = -1;
    for (let i = 0, p = 3; i < sw * sh; i++, p += 4) {
      const a = data[p];
      if (a > 3) {
        const px = i % sw, py = (i / sw) | 0;
        if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py;
        if (a > 127) cand.push(i);
      }
    }
    if (x1 < 0) return none;
    const pad = Math.ceil(9 * os) + 2;
    const bx0 = clamp(Math.floor((x0 / sw) * OW) - pad, 0, OW), by0 = clamp(Math.floor((y0 / sh) * OH) - pad, 0, OH);
    const bx1 = clamp(Math.ceil(((x1 + 1) / sw) * OW) + pad, 0, OW), by1 = clamp(Math.ceil(((y1 + 1) / sh) * OH) + pad, 0, OH);
    const box = { x: bx0, y: by0, w: Math.max(1, bx1 - bx0), h: Math.max(1, by1 - by0) };
    if (!cand.length) return { box, glints: new Float32Array(0) };
    const cover = cand.length / (sw * sh);
    let n = Math.round(clamp(cover * 1600, 8, 220));
    if (cover > 0.06) n = Math.max(n, 120);
    n = Math.min(n, cand.length * 2);
    const r = K.rng(st.card.id + ":" + face + ":glints");
    const out = new Float32Array(n * 6);
    for (let j = 0; j < n; j++) {
      const idx = cand[Math.floor(r() * cand.length)];
      const px = ((idx % sw) + r()) / sw, py = (Math.floor(idx / sw) + r()) / sh;
      out[j * 6] = px * OW - box.x;
      out[j * 6 + 1] = py * OH - box.y;
      out[j * 6 + 2] = r() * Math.PI * 2;
      out[j * 6 + 3] = (r() < 0.5 ? -1 : 1) * (0.2 + 0.32 * r());
      out[j * 6 + 4] = (r() < 0.5 ? -1 : 1) * (0.2 + 0.32 * r());
      out[j * 6 + 5] = (1.9 + 3.2 * r() * r()) * os;
    }
    return { box, glints: out };
  }

  /* render queue: one face per idle slot, active card first */
  const queue = [];
  let pumping = false;
  function enqueue(st, face, urgent) {
    const i = queue.findIndex((j) => j.st === st && j.face === face);
    if (i >= 0) queue.splice(i, 1);
    if (urgent) queue.unshift({ st, face }); else queue.push({ st, face });
    pump();
  }
  function pump() {
    if (pumping || !queue.length) return;
    pumping = true;
    schedule(() => {
      pumping = false;
      // keep animations smooth: while a switch or open is mid-flight, wait
      if (anyAnimating() && queue.length) { setTimeout(pump, 120); return; }
      const job = queue.shift();
      if (job && job.st.faces[job.face].dirty) renderFace(job.st, job.face);
      pump();
    });
  }
  function ensureFace(st, face) {
    if (st.faces[face].dirty) {
      const i = queue.findIndex((j) => j.st === st && j.face === face);
      if (i >= 0) queue.splice(i, 1);
      renderFace(st, face);
    }
  }
  function queueAll(first) {
    const order = [];
    const a = S[first];
    order.push([a, "front"], [a, "inside"], [a, "back"]);
    for (let k = 1; k < N; k++) order.push([S[(first + k) % N], "front"]);
    for (let k = 1; k < N; k++) { const st = S[(first + k) % N]; order.push([st, "inside"], [st, "back"]); }
    // back must follow front for the same card (it reuses the front painting)
    order.forEach(([st, face]) => { if (st.faces[face].dirty) enqueue(st, face, false); });
  }

  /* ================= tilt & pointer ================= */
  const tilt = {
    ry: { x: 0, v: 0 }, rx: { x: 0, v: 0 }, lift: { x: 0, v: 0 },
    nx: 0, ny: 0, mode: "none", lastMove: -10, idle: 1, fl: 1,
  };
  // pointer-tilt amplitude (deg). With the camera at ~2.8 card widths these keep the keystone measured
  // against the recording (left/right edge ratio about 0.95-1.05 with the pointer at the screen edge).
  const TILT_Y = 7.6, TILT_X = 5.8, FLOAT_REST = 10;
  function springStep(s, target, omega, dt) {
    const f = 1 + 2 * dt * omega, oo = omega * omega, hoo = dt * oo, hhoo = dt * hoo;
    const inv = 1 / (f + hhoo);
    const nx = (f * s.x + dt * s.v + hhoo * target) * inv;
    s.v = (s.v + hoo * (target - s.x)) * inv;
    s.x = nx;
  }
  let dragging = null, suppressClickUntil = 0;
  // the idle float rests after a while without input (no per-frame sheen repaints on an idle page)
  let lastInput = 0;
  const poke = () => { lastInput = clock; };
  ["pointerdown", "keydown", "wheel"].forEach((t) => window.addEventListener(t, poke, { passive: true, capture: true }));
  function setPointer(x, y) {
    tilt.nx = clamp((x - vw / 2) / (vw / 2), -1, 1);
    tilt.ny = clamp((y - vh / 2) / (vh / 2), -1, 1);
    tilt.px = x; tilt.py = y;
    tilt.lastMove = clock;
    lastInput = clock;
  }
  window.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") {
      if (dragging && e.pointerId === dragging.id) {
        setPointer(e.clientX, e.clientY);
        if (Math.hypot(e.clientX - dragging.x, e.clientY - dragging.y) > 10) dragging.moved = true;
      }
      return;
    }
    tilt.mode = "mouse";
    setPointer(e.clientX, e.clientY);
  }, { passive: true });
  document.documentElement.addEventListener("mouseleave", () => { if (tilt.mode === "mouse") tilt.mode = "none"; });
  window.addEventListener("blur", () => { if (tilt.mode === "mouse") tilt.mode = "none"; });
  stage.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "touch" || (e.target.closest && e.target.closest(".msg"))) return;
    dragging = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
    tilt.mode = "touch";
    setPointer(e.clientX, e.clientY);
  });
  const endDrag = (e) => {
    if (!dragging || e.pointerId !== dragging.id) return;
    if (dragging.moved) suppressClickUntil = performance.now() + 350;
    dragging = null;
    tilt.mode = "none";
  };
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);

  function hitCard(st, x, y) {
    const b = st.box;
    return !!b && x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
  }
  stage.addEventListener("click", (e) => {
    if (performance.now() < suppressClickUntil) return;
    if (e.target.closest && e.target.closest(".msg")) return;
    const st = S[active];
    if (!st || !hitCard(st, e.clientX, e.clientY)) return;
    manual();
    toggleOpen();
  });

  /* ================= open / close ================= */
  let active = 0, pending = null, switchSeq = 0;
  // the recording swings the cover open in ~0.3 s and shut in ~0.25 s
  const OPEN_DUR = 0.42, CLOSE_DUR = 0.32, FAST_CLOSE = 0.25;

  function setOpen(st, open, opts) {
    opts = opts || {};
    const to = open ? 1 : 0;
    if (st.openTo === to && (st.ot || st.q === to)) return;
    if (open) {
      pending = null;
      ensureFace(st, "inside"); ensureFace(st, "back");
      st.needFit = true; // fitted before the swing reveals it
    }
    const from = clamp(st.q, 0, 1);
    let dur = open ? OPEN_DUR : opts.fast ? FAST_CLOSE : CLOSE_DUR;
    dur = Math.max(0.12, dur * Math.abs(to - from));
    st.ot = { from, mfrom: st.m, to, t0: clock, dur: reduced ? 0.2 : dur, kind: reduced ? "fade" : open ? "open" : "close" };
    st.openTo = to;
    if (!open) setSettled(st, false);
    if (st === S[active]) {
      syncOpenButton();
      // the writing panel belongs to the open card: closing the card closes it too (unless the panel
      // itself closed the card to show the cover while its text is edited)
      if (!open && !opts.keepWriter && !writer.hidden) closeWriter(writer.contains(document.activeElement));
    }
    if (opts.announce) announce(open ? "Opened" : "Closed");
  }
  function setSettled(st, on) {
    if (st.settled === on) return;
    st.settled = on;
    st.dom.slot.classList.toggle("is-settled", on);
    const t = st.dom.msgText;
    if (on) {
      t.setAttribute("contenteditable", CE_VALUE); t.tabIndex = 0; st.needFit = true;
      t.setAttribute("role", "textbox"); t.setAttribute("aria-multiline", "true");
      st.dom.msg.removeAttribute("aria-hidden");
    } else {
      if (document.activeElement === t) t.blur();
      t.removeAttribute("contenteditable"); t.tabIndex = -1;
      t.removeAttribute("role"); t.removeAttribute("aria-multiline");
      st.dom.msg.setAttribute("aria-hidden", "true");
    }
  }
  function toggleOpen() {
    const st = S[active];
    if (!st) return;
    if (pending) { pending = null; }
    setOpen(st, st.openTo !== 1, { announce: true });
  }
  function evalOpen(st) {
    const ot = st.ot;
    if (!ot) return;
    let t = clamp((clock - ot.t0) / ot.dur, 0, 1);
    if (ot.kind === "fade") {
      const v = t < 0.5 ? ot.from : ot.to;
      st.q = v; st.m = v;
      st.fade = 0.12 + 0.88 * Math.abs(1 - 2 * t);
      if (t >= 0.5 && ot.to === 1) setSettled(st, true);
    } else if (ot.kind === "open") {
      st.q = lerp(ot.from, ot.to, easeOpen(t));
      st.m = lerp(ot.mfrom, ot.to, easeInOutCubic(t));
      if (t > 0.86) setSettled(st, true);
    } else {
      st.q = lerp(ot.from, ot.to, closeEase(t));
      st.m = lerp(ot.mfrom, ot.to, easeInOutCubic(t));
    }
    if (t >= 1) {
      st.q = ot.to; st.m = ot.to; st.ot = null; st.fade = 1;
      if (ot.to === 1) setSettled(st, true);
    }
  }

  /* ================= switching ================= */
  const REST = { ty: 0, rz: 0, rx: 0, op: 1 };
  // the outgoing card drops away at once (ease-out), tipping and fading; mirrored for a backward switch
  const EXIT_DUR = 0.5;
  function exitPose(dir) {
    const k = (switchSeq * 0.618) % 1, rz = 8 + 3 * k;
    return dir > 0 ? { ty: 0.75 * vh, rz, rx: 18, op: 0 } : { ty: -0.75 * vh, rz: -rz, rx: -18, op: 0 };
  }
  // boot entrance: drops in from above
  function enterPose(dir) {
    return dir > 0 ? { ty: -0.8 * vh, rz: -9, rx: -10, op: 0 } : { ty: 0.8 * vh, rz: 9, rx: 10, op: 0 };
  }
  // switch entrance, as in the recording: the new card slides out from behind the current one toward the
  // top edge, hovers there while the old card falls away, then swoops down in front and settles
  const SHUF = { rise: 0.17, swap: 0.3, dur: 0.7 };
  function shufflePeak(dir) {
    return dir > 0 ? { ty: -0.35 * vh, rz: -7.5, rx: 0, op: 1 } : { ty: 0.35 * vh, rz: 7.5, rx: 0, op: 1 };
  }
  function showSlot(st) {
    if (!st.visible) { st.visible = true; st.dom.slot.hidden = false; st.needFit = true; }
  }
  function startPose(st, kind, from, to, dur, delay, extra) {
    st.ptw = Object.assign({ kind, from: Object.assign({}, from), to: Object.assign({}, to), t0: clock, dur, delay: delay || 0 }, extra || {});
    st.dom.slot.classList.toggle("is-leaving", kind === "exit" || kind === "fadeOut");
  }
  const easeOutPow = (t, k) => 1 - Math.pow(1 - t, k);
  function evalPose(st) {
    const tw = st.ptw;
    if (!tw) return;
    const t = (clock - tw.t0 - tw.delay) / tw.dur;
    const p = st.pose, a = tw.from, b = tw.to;
    if (t <= 0) { Object.assign(p, a); return; }
    if (t >= 1) {
      Object.assign(p, b);
      st.ptw = null;
      if (tw.kind === "shuffle") st.dom.slot.style.zIndex = "3";
      if (tw.kind === "exit" || tw.kind === "fadeOut") {
        st.visible = false; st.dom.slot.hidden = true;
        st.dom.slot.classList.remove("is-leaving");
        st.q = 0; st.m = 0; st.ot = null; st.openTo = 0; setSettled(st, false);
      }
      return;
    }
    if (tw.kind === "enter") {
      const e = springEase(t);
      p.ty = lerp(a.ty, b.ty, e); p.rz = lerp(a.rz, b.rz, e); p.rx = lerp(a.rx, b.rx, e);
      p.op = lerp(a.op, b.op, clamp(t / 0.3, 0, 1));
    } else if (tw.kind === "shuffle") {
      const s = t * tw.dur, pk = tw.peak;
      if (s < SHUF.rise) {
        const e = easeOutPow(s / SHUF.rise, 2.4);
        p.ty = lerp(a.ty, pk.ty, e); p.rz = lerp(a.rz, pk.rz, e); p.rx = lerp(a.rx, pk.rx, e);
      } else if (s < SHUF.swap) {
        Object.assign(p, pk);
      } else {
        // the old card has cleared: come to the front and drop to rest
        if (st.dom.slot.style.zIndex !== "3") st.dom.slot.style.zIndex = "3";
        const e = springEase((s - SHUF.swap) / (tw.dur - SHUF.swap));
        p.ty = lerp(pk.ty, b.ty, e); p.rz = lerp(pk.rz, b.rz, e); p.rx = lerp(pk.rx, b.rx, e);
      }
      p.op = 1;
    } else if (tw.kind === "exit") {
      const e = easeOutPow(t, 2.2);
      p.ty = lerp(a.ty, b.ty, e); p.rz = lerp(a.rz, b.rz, easeOutPow(t, 1.6)); p.rx = lerp(a.rx, b.rx, easeOutPow(t, 1.6));
      p.op = lerp(a.op, b.op, Math.pow(clamp(t / 0.9, 0, 1), 1.2));
    } else {
      p.ty = a.ty; p.rz = a.rz; p.rx = a.rx;
      p.op = lerp(a.op, b.op, t);
    }
  }
  function goTo(target, dir, opts) {
    opts = opts || {};
    if (!N) return;
    target = ((target % N) + N) % N;
    if (target === active) { pending = null; return; }
    flushCover();
    closeWriter(false);
    const cur = S[active];
    if (cur.openTo === 1 || cur.q > 0.0005 || cur.ot) {
      pending = { target, dir, auto: !!opts.auto };
      if (cur.openTo !== 0) setOpen(cur, false, { fast: !opts.auto });
      return;
    }
    doSwitch(target, dir, opts);
  }
  function doSwitch(target, dir, opts) {
    const out = S[active], inc = S[target];
    switchSeq++;
    ensureFace(inc, "front");
    if (out.visible) {
      if (reduced) startPose(out, "fadeOut", out.pose, Object.assign({}, out.pose, { op: 0 }), 0.2, 0);
      else startPose(out, "exit", out.pose, exitPose(dir), EXIT_DUR, 0);
    }
    const wasVisible = inc.visible;
    showSlot(inc);
    if (!wasVisible) { inc.q = 0; inc.m = 0; inc.ot = null; inc.openTo = 0; setSettled(inc, false); }
    // stacking: every other visible card at 2; the incoming card starts behind them (1) when it shuffles
    // out from behind, and comes to the front (3) once they have cleared
    S.forEach((o) => { if (o !== inc && o.visible) o.dom.slot.style.zIndex = "2"; });
    if (reduced) {
      startPose(inc, "fadeIn", Object.assign({}, REST, { op: wasVisible ? inc.pose.op : 0 }), REST, 0.2, 0);
      inc.dom.slot.style.zIndex = "3";
    } else if (wasVisible) {
      // a card still on its way out comes straight back from where it is
      startPose(inc, "enter", inc.pose, REST, 0.8, 0);
      inc.dom.slot.style.zIndex = "3";
    } else {
      startPose(inc, "shuffle", REST, REST, SHUF.dur, 0, { peak: shufflePeak(dir) });
      inc.dom.slot.style.zIndex = "1";
    }
    active = target;
    syncToolbar();
    // auto-advances are not announced (a slideshow would otherwise talk every few seconds)
    if (!opts || !opts.auto) announce(`Card ${target + 1} of ${N}, ${inc.card.title}`);
    if (growScale(inc)) {
      // the card on show may render sharper than the others: refresh it once the switch has landed
      // (urgent jobs are unshifted, so this queues front, inside, back: the back reuses the new front)
      enqueue(inc, "back", true); enqueue(inc, "inside", true); enqueue(inc, "front", true);
    } else {
      ["inside", "back"].forEach((f) => { if (inc.faces[f].dirty) enqueue(inc, f, true); });
    }
    if (show.on) show.mark = clock;
  }
  // where the user is heading (a queued switch counts), so repeated arrow presses add up
  function intended() { return pending ? pending.target : active; }
  function anyAnimating() {
    for (const st of S) if (st.ptw || st.ot) return true;
    return false;
  }

  /* ================= slideshow ================= */
  const show = { on: false, mark: 0 };
  function setShow(on) {
    show.on = on;
    show.mark = clock;
    lastInput = clock;
    // a fixed accessible name with aria-pressed (pressed = playing); the tooltip says what a click does
    btnPlay.setAttribute("aria-pressed", on ? "true" : "false");
    btnPlay.title = on ? "Pause slideshow" : "Play slideshow";
  }
  function pauseShow() { if (show.on) setShow(false); }
  // as in the recording, browsing by hand keeps the slideshow running: it just restarts its timer.
  // Only the Play/Pause button, writing (panel or inline message) and keyboard focus in the toolbar pause it.
  function manual() { if (show.on) show.mark = clock; }
  function stepShow() {
    if (!show.on) return;
    const st = S[active];
    if (!writer.hidden) { show.mark = clock; return; }
    if (pending || anyAnimating()) { show.mark = clock; lastInput = clock; return; }
    const held = clock - show.mark;
    if (st.openTo === 0 && st.q === 0) {
      if (held >= 2.6) setOpen(st, true, {});
    } else if (st.openTo === 1 && st.q === 1) {
      if (held >= 3.6) goTo(active + 1, 1, { auto: true });
    }
  }

  /* ================= toolbar & a11y ================= */
  function syncToolbar() {
    thumbs.forEach((b, i) => {
      if (i === active) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current");
    });
    syncOpenButton();
    if (!writer.hidden) fillWriter();
  }
  // two-segment progress mark under the active thumbnail (as in the recording): a faint track, the first
  // segment dark while the card is open, both dark once it has been opened and closed; reset on a switch
  let prog = { i: -1, v: 0 };
  function syncProgress() {
    const st = S[active];
    if (!st) return;
    if (prog.i !== active) prog = { i: active, v: 0 };
    if (st.openTo === 1) prog.v = Math.max(prog.v, 1);
    else if (prog.v >= 1) prog.v = 2;
    thumbs.forEach((b, i) => { const v = i === active ? String(prog.v) : "0"; if (b.dataset.prog !== v) b.dataset.prog = v; });
  }
  function syncOpenButton() {
    const st = S[active], open = st && st.openTo === 1;
    // fixed accessible name + aria-pressed (pressed = open); the tooltip says what a click does
    btnOpen.setAttribute("aria-pressed", open ? "true" : "false");
    btnOpen.title = (open ? "Close card" : "Open card") + " (Space)";
    syncProgress();
  }
  // polite announcements are debounced long enough that rapid switching reads only the destination
  let announceTimer = 0;
  function announce(text) {
    clearTimeout(announceTimer);
    live.textContent = "";
    announceTimer = setTimeout(() => { live.textContent = text; }, 400);
  }
  // keyboard focus moving into the toolbar pauses the slideshow (WAI carousel pattern); pointer clicks,
  // which don't show a focus ring, leave it running as in the recording
  toolbar.addEventListener("focusin", (e) => {
    let kb = false;
    try { kb = e.target.matches(":focus-visible"); } catch (er) { kb = false; }
    if (kb) pauseShow();
  });
  btnOpen.addEventListener("click", () => { manual(); toggleOpen(); });
  btnPlay.addEventListener("click", () => { setShow(!show.on); });
  btnWrite.addEventListener("click", () => { if (writer.hidden) openWriter(); else closeWriter(true); });

  /* ================= writing panel ================= */
  let coverTimer = 0, coverPending = null;
  const CAP_NOTE = "That's as much as fits on this card.";
  function fillWriter() {
    const st = S[active];
    fMessage.value = getMessage(st);
    fSignoff.value = getSignoff(st);
    const hasCover = st.card.coverText != null;
    fCoverWrap.hidden = !hasCover;
    if (hasCover) fCover.value = getCover(st);
    fillWriterSwatches(getFoil(st));
    hideConfirm();
    popStatus.textContent = saveFailed ? SAVE_NOTE : "";
  }
  // short landscape screens dock the panel at the right (see shell.css); the card then moves left of it
  const mqDock = window.matchMedia ? window.matchMedia("(max-height: 520px) and (min-aspect-ratio: 1/1)") : null;
  function measureWriter() {
    if (writer.hidden) { room.top = 0; room.left = 0; room.docked = false; return; }
    room.docked = !!(mqDock && mqDock.matches);
    room.top = writer.offsetTop;
    room.left = writer.offsetLeft;
    // left safe-area inset (landscape notch): the brand sits at 16px + env(safe-area-inset-left)
    const br = document.querySelector(".brand");
    room.inL = br ? Math.max(0, br.getBoundingClientRect().left - 16) : 0;
  }
  // the panel grows when its textarea is resized by hand: keep the card clear of it
  if (window.ResizeObserver) { try { new ResizeObserver(() => measureWriter()).observe(writer); } catch (e) { /* ignore */ } }
  function openWriter() {
    pauseShow();
    const st = S[active];
    if (st.openTo !== 1) setOpen(st, true, { announce: true });
    fillWriter();
    writer.hidden = false;
    measureWriter();
    btnWrite.setAttribute("aria-expanded", "true");
    try { fMessage.focus({ preventScroll: true }); } catch (e) { fMessage.focus(); }
  }
  function closeWriter(returnFocus) {
    if (writer.hidden) return;
    flushCover();
    // never leave keyboard focus stranded on the page body when the panel disappears under it
    const had = writer.contains(document.activeElement);
    writer.hidden = true;
    measureWriter();
    btnWrite.setAttribute("aria-expanded", "false");
    if (returnFocus || had) { try { btnWrite.focus({ preventScroll: true }); } catch (e) { btnWrite.focus(); } }
  }
  $("writer-close").addEventListener("click", () => closeWriter(true));
  // writing pauses the slideshow, so it can never switch cards (and close the panel) mid-sentence
  writer.addEventListener("focusin", () => pauseShow());
  document.addEventListener("pointerdown", (e) => {
    if (writer.hidden) return;
    if (writer.contains(e.target) || btnWrite.contains(e.target)) return;
    closeWriter(false);
    // a click that only dismisses the panel must not also open/close the card underneath
    if (stage.contains(e.target)) suppressClickUntil = Math.max(suppressClickUntil, performance.now() + 400);
  }, true);
  fMessage.addEventListener("input", () => {
    const st = S[active];
    // stored and shown without trailing blank lines; the textarea keeps exactly what is typed
    const t = trimEnd(fMessage.value.replace(/\r/g, "")).slice(0, MSG_MAX);
    st.edit.message = t; touchEdit(st);
    st.dom.msgText.textContent = t;
    st.needFit = true;
    if (fMessage.value.length >= MSG_MAX) popStatus.textContent = CAP_NOTE;
    else if (popStatus.textContent === CAP_NOTE) popStatus.textContent = "";
  });
  fSignoff.addEventListener("input", () => {
    const st = S[active];
    st.edit.signoff = fSignoff.value; touchEdit(st);
    st.dom.msgSign.textContent = fSignoff.value;
    st.needFit = true;
  });
  // the cover text is edited with the card closed, so the change can be seen; message fields open it again
  fCover.addEventListener("focus", () => { const st = S[active]; if (st.openTo === 1) setOpen(st, false, { keepWriter: true }); });
  const showInside = () => { const st = S[active]; if (!writer.hidden && st.openTo !== 1) setOpen(st, true, {}); };
  fMessage.addEventListener("focus", showInside);
  fSignoff.addEventListener("focus", showInside);
  fCover.addEventListener("input", () => {
    const st = S[active];
    st.edit.coverText = fCover.value.slice(0, COVER_MAX); touchEdit(st);
    st.dom.cover.setAttribute("aria-label", coverLabel(st));
    // repaint after a real pause in typing, and then only when the browser is idle
    clearTimeout(coverTimer);
    coverPending = st;
    coverTimer = setTimeout(() => { coverTimer = 0; coverPending = null; rerenderCover(st); }, 450);
  });
  function flushCover() {
    if (!coverTimer) return;
    clearTimeout(coverTimer); coverTimer = 0;
    const st = coverPending; coverPending = null;
    if (st) rerenderCover(st);
  }
  // Only the front shows the lettering. The back is a silhouette of the front's alpha, which text inside
  // the card never changes, so it is left alone. The repaint runs from the idle queue (never mid-animation).
  function rerenderCover(st) {
    st.faces.front.dirty = true;
    enqueue(st, "front", true);
    st.dom.cover.setAttribute("aria-label", coverLabel(st));
  }
  fFoil.addEventListener("click", (e) => {
    const b = e.target.closest(".swatch");
    if (!b) return;
    setFoil(b.dataset.foil);
  });
  fFoil.addEventListener("keydown", (e) => {
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (!(e.key in keys)) return;
    e.preventDefault(); e.stopPropagation();
    const cur = FOILS.indexOf(getFoil(S[active]));
    const nx = FOILS[(cur + keys[e.key] + FOILS.length) % FOILS.length];
    setFoil(nx);
    const btn = fFoil.querySelector(`[data-foil="${nx}"]`);
    if (btn) btn.focus();
  });
  function setFoil(foil) {
    if (!FOILS.includes(foil)) return;
    const st = S[active];
    st.edit.foil = foil; touchEdit(st);
    for (const k in st.faces) st.faces[k].key = "";
    fillWriterSwatches(foil);
  }
  function fillWriterSwatches(foil) {
    fFoil.querySelectorAll(".swatch").forEach((b) => {
      const on = b.dataset.foil === foil;
      b.setAttribute("aria-checked", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
    });
  }
  // clipboard fallback: the exact text (message + sign-off) goes into an off-screen field and is selected
  const copyBox = el("textarea", "sr-only", writer);
  copyBox.readOnly = true; copyBox.tabIndex = -1;
  copyBox.setAttribute("aria-hidden", "true");
  fCopy.addEventListener("click", () => {
    const st = S[active];
    const sign = String(getSignoff(st) || "").trim();
    const text = trimEnd(String(getMessage(st) || "")) + (sign ? "\n" + sign : "");
    const fallback = () => {
      let ok = false;
      try {
        copyBox.value = text;
        copyBox.focus({ preventScroll: true });
        copyBox.select();
        copyBox.setSelectionRange(0, text.length);
        ok = !!(document.execCommand && document.execCommand("copy"));
      } catch (e) { ok = false; }
      if (ok) { popStatus.textContent = "Copied to clipboard."; try { fCopy.focus({ preventScroll: true }); } catch (e) { /* ignore */ } return; }
      const mac = /Mac|iPhone|iPad/.test(navigator.platform || "");
      popStatus.textContent = `Message and sign-off selected — press ${mac ? "⌘" : "Ctrl+"}C to copy.`;
    };
    // a host frame that withholds clipboard-write makes the async API log a console error: go straight to
    // the fallback there
    let blocked = false;
    try { const pp = document.permissionsPolicy || document.featurePolicy; blocked = !!(pp && pp.allowsFeature && !pp.allowsFeature("clipboard-write")); }
    catch (e) { blocked = false; }
    try {
      if (!blocked && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => { popStatus.textContent = "Copied to clipboard."; }, fallback);
      } else fallback();
    } catch (e) { fallback(); }
  });
  function hideConfirm() { popConfirm.hidden = true; popActions.hidden = false; }
  fReset.addEventListener("click", () => {
    popActions.hidden = true; popConfirm.hidden = false;
    $("f-reset-no").focus();
  });
  $("f-reset-no").addEventListener("click", () => { hideConfirm(); fReset.focus(); });
  $("f-reset-yes").addEventListener("click", () => {
    const st = S[active];
    const coverChanged = getCover(st) !== st.card.coverText;
    st.edit = {};
    delete store[st.card.id];
    dirtyIds.add(st.card.id);
    saveSoon();
    st.dom.msgText.textContent = getMessage(st);
    st.dom.msgSign.textContent = "";
    st.needFit = true;
    for (const k in st.faces) st.faces[k].key = "";
    if (coverChanged) { clearTimeout(coverTimer); coverTimer = 0; coverPending = null; rerenderCover(st); }
    fillWriter();
    popStatus.textContent = "This card is back to its original words.";
    fReset.focus();
  });

  // another tab saved: pick up its edits for the cards this tab is not editing right now
  window.addEventListener("storage", (e) => {
    if (e.key !== STORE_KEY && e.key !== null) return;
    const fresh = readStore();
    if (!fresh) return;
    S.forEach((st) => {
      const id = st.card.id;
      if (dirtyIds.has(id)) return;
      if (st === S[active] && (!writer.hidden || document.activeElement === st.dom.msgText)) return;
      const prevCover = getCover(st), prevFoil = getFoil(st);
      st.edit = fresh[id] || {};
      if (fresh[id]) store[id] = st.edit; else delete store[id];
      st.dom.msgText.textContent = getMessage(st);
      st.dom.msgSign.textContent = getSignoff(st);
      st.needFit = true;
      if (getFoil(st) !== prevFoil) for (const k in st.faces) st.faces[k].key = "";
      if (getCover(st) !== prevCover) rerenderCover(st);
    });
  });

  /* ================= keyboard ================= */
  function isTyping(t) {
    if (!t || !t.closest) return false;
    if (t.isContentEditable) return true;
    return !!t.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])");
  }
  document.addEventListener("keydown", (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (e.key === "Escape") {
      // unwind one layer at a time: the reset confirm, then the panel, then the card
      if (!writer.hidden && !popConfirm.hidden) { e.preventDefault(); hideConfirm(); fReset.focus(); return; }
      if (!writer.hidden) { e.preventDefault(); closeWriter(true); return; }
      if (isTyping(t)) { t.blur && t.blur(); return; }
      const st = S[active];
      if (st.openTo === 1) { e.preventDefault(); manual(); setOpen(st, false, { announce: true }); }
      return;
    }
    if (isTyping(t)) return;
    const inPanel = writer.contains(t);
    const onControl = t && t.closest && t.closest("button, a, [role='radio']");
    // single-letter shortcuts only act while the toolbar has focus (WCAG 2.1.4), so stray keystrokes
    // and speech input elsewhere can't trigger them
    const inToolbar = !!(toolbar && t && toolbar.contains(t));
    switch (e.key) {
      case "ArrowRight":
        if (inPanel) return;
        e.preventDefault(); manual(); goTo(intended() + 1, 1); break;
      case "ArrowLeft":
        if (inPanel) return;
        e.preventDefault(); manual(); goTo(intended() - 1, -1); break;
      case " ": case "Enter":
        // with the panel open, Space/Enter elsewhere must not close the card out from under it
        if (onControl || inPanel || !writer.hidden) return;
        e.preventDefault(); manual(); toggleOpen(); break;
      case "w": case "W":
        if (!inToolbar) return;
        e.preventDefault(); openWriter(); break;
      case "p": case "P":
        if (!inToolbar) return;
        e.preventDefault(); setShow(!show.on); break;
      default: break;
    }
  });

  /* ================= message fitting (layout reads happen only here, before frame writes) ================= */
  function fitMessage(st) {
    st.needFit = false;
    const { msg, msgText, msgSign } = st.dom;
    msg.style.setProperty("--fit", "1");
    const boxH = msg.clientHeight, boxW = msg.clientWidth;
    if (!boxH || !boxW) { st.needFit = !st.visible; return; }
    const fits = () => {
      const signH = msgSign.textContent ? msgSign.offsetHeight * 1.4 : 0;
      return msgText.offsetHeight + signH <= boxH * 0.98 && msgText.scrollWidth <= boxW + 1;
    };
    let fit = 1;
    if (!fits()) {
      // binary search the largest size that fits (wrapping makes height non-linear in font size)
      let lo = 0.4, hi = 1;
      for (let k = 0; k < 7; k++) {
        const mid = (lo + hi) / 2;
        msg.style.setProperty("--fit", mid.toFixed(3));
        if (fits()) lo = mid; else hi = mid;
      }
      fit = lo;
      msg.style.setProperty("--fit", fit.toFixed(3));
    }
    st.fit = fit;
  }

  /* ================= per-frame rendering ================= */
  let clock = 0, lastNow = 0;
  const frameTimes = [];
  window.__keepsakeStats = { frames: frameTimes, get clock() { return clock; } };

  function faceOrigin(st, face) {
    const g = st.g;
    if (face === "front") return [-g.pad.l, -g.pad.t];
    if (face === "back") return [-g.w - g.pad.r, -g.pad.t];
    return [0, 0];
  }

  function drawSheen(st, face, view, foilName) {
    const f = st.faces[face];
    if (!f.ready) return;
    const ry = tilt.ry.x, rx = tilt.rx.x;
    // 0.1-degree steps: a settling spring stops forcing full-canvas repaints and uploads
    const key = `${ry.toFixed(1)}|${rx.toFixed(1)}|${view.gx.toFixed(1)}|${view.gy.toFixed(1)}|${foilName}|${view.bx.toFixed(1)}`;
    if (key === f.key) return;
    f.key = key;
    const [ox, oy] = faceOrigin(st, face);
    if (f.mask) {
      const F = FOIL[foilName];
      // holographic film reads as an iridescent tint even over white foil, so it is laid on normally;
      // the metallic foils brighten (screen)
      const blend = F.holo ? "normal" : "screen";
      if (f.blend !== blend) { f.blend = blend; f.sheen.style.mixBlendMode = blend; }
      // ---- sheen: moving light band through the foil mask + twinkling glints ----
      const c = f.sctx, W = f.sheen.width, H = f.sheen.height, k = f.os;
      c.globalCompositeOperation = "source-over";
      c.globalAlpha = 1;
      c.clearRect(0, 0, W, H);
      c.fillStyle = `rgba(${F.tint},${F.base})`;
      c.fillRect(0, 0, W, H);
      const bx = (view.bx - ox) * k - f.sb.x, by = (view.by - oy) * k - f.sb.y, L = view.L * k;
      const g = c.createLinearGradient(bx - D[0] * 1.5 * L, by - D[1] * 1.5 * L, bx + D[0] * 1.5 * L, by + D[1] * 1.5 * L);
      const at = (d) => clamp(0.5 + d / 3, 0, 1);
      if (F.holo) {
        const hue0 = 200 + view.ty * 150 - view.tx * 90;
        g.addColorStop(at(-0.62), "hsla(0,0%,100%,0)");
        // saturated enough to tint even pale foil (screen-blending a pastel over white changes nothing)
        for (let i = -5; i <= 5; i++) {
          const env = Math.pow(Math.cos((i / 6) * (Math.PI / 2)), 2);
          g.addColorStop(at(i * 0.1), `hsla(${(hue0 + i * 38 + 720) % 360},100%,${i === 0 ? 92 : 76}%,${(0.36 * env).toFixed(3)})`);
        }
        g.addColorStop(at(0.62), "hsla(0,0%,100%,0)");
      } else {
        const pk = F.peak, sh = (0.58 * pk / 0.82).toFixed(3), lo = (0.24 * pk / 0.82).toFixed(3);
        g.addColorStop(at(-0.42), `rgba(${F.tint},0)`);
        g.addColorStop(at(-0.18), `rgba(${F.tint},${lo})`);
        g.addColorStop(at(-0.06), `rgba(${F.tint},${sh})`);
        g.addColorStop(at(0), `rgba(${F.core},${pk})`);
        g.addColorStop(at(0.06), `rgba(${F.tint},${sh})`);
        g.addColorStop(at(0.18), `rgba(${F.tint},${lo})`);
        g.addColorStop(at(0.42), `rgba(${F.tint},0)`);
      }
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
      // a fainter, wider second band trailing the first
      const b2 = -0.62 * L;
      const g2 = c.createLinearGradient(bx + D[0] * (b2 - L), by + D[1] * (b2 - L), bx + D[0] * (b2 + L), by + D[1] * (b2 + L));
      if (F.holo) {
        const h2 = 320 + view.ty * 120;
        g2.addColorStop(0.2, "hsla(0,0%,100%,0)");
        g2.addColorStop(0.42, `hsla(${h2 % 360},100%,76%,0.2)`);
        g2.addColorStop(0.5, `hsla(${(h2 + 60) % 360},100%,78%,0.26)`);
        g2.addColorStop(0.58, `hsla(${(h2 + 120) % 360},100%,76%,0.2)`);
        g2.addColorStop(0.8, "hsla(0,0%,100%,0)");
      } else {
        g2.addColorStop(0.25, `rgba(${F.tint},0)`);
        g2.addColorStop(0.5, `rgba(${F.tint},0.36)`);
        g2.addColorStop(0.75, `rgba(${F.tint},0)`);
      }
      c.fillStyle = g2;
      c.fillRect(0, 0, W, H);
      c.globalCompositeOperation = "destination-in";
      c.drawImage(f.mask, 0, 0, W, H);
      // glints: 4-point stars that flash as the card moves
      const gl = f.glints;
      if (gl && gl.length) {
        c.globalCompositeOperation = "lighter";
        const spr = glintSprite(foilName);
        for (let i = 0; i < gl.length; i += 6) {
          const cs = Math.cos(gl[i + 2] + gl[i + 3] * ry + gl[i + 4] * rx);
          if (cs <= 0.72) continue; // pow(.,12) < 0.02
          const b = Math.pow(cs, 12);
          const r = gl[i + 5] * (0.55 + 0.75 * b);
          c.globalAlpha = Math.min(1, b * 1.1);
          c.drawImage(spr, gl[i] - r, gl[i + 1] - r, r * 2, r * 2);
        }
        c.globalAlpha = 1;
      }
      c.globalCompositeOperation = "source-over";
    }

    // ---- glare: broad soft highlight following the pointer, clipped to the paper ----
    const x = f.gctx, GW = f.glare.width, GH = f.glare.height, gk = f.gs;
    x.globalCompositeOperation = "source-over";
    x.clearRect(0, 0, GW, GH);
    const gx = (view.gx - ox) * gk, gy = (view.gy - oy) * gk, R = view.R * gk;
    const rg = x.createRadialGradient(gx, gy, 0, gx, gy, R);
    // composited normally (a soft-light layer costs a whole extra blend pass per face, per frame);
    // a thin white veil brightens mid-tones about as much as soft-light white at ~2.3x the alpha
    rg.addColorStop(0, "rgba(255,255,255,0.08)");
    rg.addColorStop(0.45, "rgba(255,255,255,0.036)");
    rg.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = rg;
    x.fillRect(0, 0, GW, GH);
    x.globalCompositeOperation = "destination-in";
    x.drawImage(f.amask, 0, 0, GW, GH);
    x.globalCompositeOperation = "source-over";
  }

  function setBright(f, b) {
    if (Math.abs(f.bright - b) < 0.004) return;
    f.bright = b;
    f.art.style.filter = b > 0.998 ? "" : `brightness(${b.toFixed(3)})`;
  }

  function writeSlot(st, isActive) {
    const d = st.dom, g = st.g, u = st.u;
    const p = st.pose;
    const q = st.q, m = st.m;
    // slot: switch transition pose
    // visible box (card units), pivot = its centre
    const bx0 = lerp(st.closed.x0, st.opened.x0, m), bx1 = lerp(st.closed.x1, st.opened.x1, m);
    const by0 = st.closed.y0, by1 = st.closed.y1;
    const pvx = (bx0 + bx1) / 2, pvy = (by0 + by1) / 2;
    const lift = tilt.lift.x;
    let sc = lerp(1, st.sOpen, m) * (1 + 0.02 * lift);
    let ccy = cy, ccx = cx;
    if (isActive && room.r.x > 0.001) {
      if (room.docked && room.left > 0) {
        // panel docked at the right: the card moves into the band left of it (and shrinks if it must)
        const lo = 16 + (room.inL || 0);
        const free = room.left - 12 - lo;
        const wNow = (bx1 - bx0) * u * sc;
        const k = clamp(free / wNow, 0.42, 1);
        sc *= lerp(1, k, room.r.x);
        ccx = lerp(cx, Math.min(cx, lo + free / 2), room.r.x);
      } else if (room.top > topPad + 40) {
        const free = room.top - 12 - topPad;
        const hNow = (by1 - by0) * u * sc;
        const k = clamp(free / hNow, 0.42, 1);
        const cyR = topPad - 8 + Math.max(free + 8, hNow * k) / 2;
        sc *= lerp(1, k, room.r.x);
        ccy = lerp(cy, Math.min(cy, cyR), room.r.x);
      }
    }
    const slotT = `translate3d(${fmt(ccx)}px,${fmt(ccy + p.ty)}px,0) rotateZ(${fmt(p.rz)}deg) rotateX(${fmt(p.rx)}deg)`;
    if (slotT !== st.last.slotT) { d.slot.style.transform = slotT; st.last.slotT = slotT; }
    // compare the written strings, so the final step to fully opaque is never skipped
    const op = clamp(p.op * st.fade, 0, 1);
    const opS = op >= 0.999 ? "" : op.toFixed(3);
    if (opS !== st.last.opS) { d.slot.style.opacity = opS; st.last.opS = opS; }
    const ry = tilt.ry.x, rx = tilt.rx.x, bob = tilt.bob || 0;
    const cardT = `translate3d(0,${fmt(bob)}px,${fmt(lift * 14)}px) rotateX(${fmt(rx)}deg) rotateY(${fmt(ry)}deg) scale(${sc.toFixed(4)}) translate(${fmt(-pvx * u)}px,${fmt(-pvy * u)}px)`;
    if (cardT !== st.last.cardT) { d.cardEl.style.transform = cardT; st.last.cardT = cardT; }
    // screen-space hit box (rotation ignored — fine for pointer hit testing)
    if (isActive) {
      const hx = (bx1 - bx0) / 2 * u * sc, hy = (by1 - by0) / 2 * u * sc;
      st.box = { x0: ccx - hx, x1: ccx + hx, y0: ccy + p.ty + bob - hy, y1: ccy + p.ty + bob + hy };
    }

    // cover hinge: the opened cover overlaps the spine by a hair (it sits 1px above the page), so no seam of
    // background shows through the fold; the crease itself is painted by .spine-shade
    const ang = -178 * q;
    const gap = -0.35 * m;
    const coverT = `translate3d(${fmt(-gap)}px,0,1px) rotateY(${fmt(ang)}deg)`;
    if (coverT !== st.last.coverT) { d.cover.style.transform = coverT; st.last.coverT = coverT; }
    const rad = (-ang * Math.PI) / 180;
    const cosA = Math.cos(rad);
    setBright(st.faces.front, 0.8 + 0.2 * Math.max(0, cosA));
    setBright(st.faces.back, 0.84 + 0.16 * Math.max(0, -cosA));
    // the message is shown as soon as the cover lifts (the swinging cover reveals and hides it); it only
    // becomes editable once the card has settled open (setSettled)
    const rev = q > 0.001;
    if (rev !== st.last.rev) { d.slot.classList.toggle("is-revealed", rev); st.last.rev = rev; }
    // the recording's insert keeps its brightness through the swing: only a whisper of shade
    const lidS = (q > 0 && q < 1 ? 0.03 * Math.sin(rad) : 0).toFixed(3);
    if (lidS !== st.last.lidS) { d.lid.style.opacity = lidS; st.last.lidS = lidS; }
    const spS = m.toFixed(3);
    if (spS !== st.last.spS) { d.spine.style.opacity = spS; st.last.spS = spS; }

    // shadows on the table, shifted opposite to the tilt. The page under the cover always rests on the table;
    // the cover adds its own shadow only where its projection falls left of the spine, and that shadow
    // firms up as the cover comes down (a cover standing upright casts almost nothing).
    const proj = Math.max(0, -Math.cos(rad)); // fraction of the card width the cover covers left of the spine
    const offX = -ry * 1.3, offY = 10 + rx * 0.9 + lift * 8;
    const ay = (0 - pvy) * u * sc;
    const sx0 = -proj * g.w, sw = (g.w - sx0) / g.w * sc;
    const ax = (sx0 - pvx) * u * sc, bx = (0 - pvx) * u * sc;
    // the ambient layer stays tucked under the card: a short, tight drop shadow as in the recording
    const ambT = `translate3d(${fmt(ax + offX * 0.6)}px,${fmt(ay + offY * 0.5 + 3)}px,0) scale(${sw.toFixed(4)},${sc.toFixed(4)})`;
    // the contact shadow stays tucked under the paper (a hard band peeking out reads as a thick edge)
    const inset = 0.006 * g.w * u * sc;
    const conT = `translate3d(${fmt(bx + offX * 0.3 + inset + 1)}px,${fmt(ay + offY * 0.42 + 3)}px,0) scale(${(sc * 0.988).toFixed(4)},${(sc * 0.982).toFixed(4)})`;
    const cs = Math.max(0.001, proj);
    const covT = `translate3d(${fmt(ax + offX * 0.3 + inset)}px,${fmt(ay + offY * 0.42 + 3)}px,0) scale(${(cs * sc * 0.995).toFixed(4)},${(sc * 0.982).toFixed(4)})`;
    if (ambT !== st.last.ambT) { d.amb.style.transform = ambT; st.last.ambT = ambT; }
    if (conT !== st.last.conT) { d.contact.style.transform = conT; st.last.conT = conT; }
    if (covT !== st.last.covT) { d.coverSh.style.transform = covT; st.last.covT = covT; }
    const co = (0.72 - 0.3 * lift).toFixed(3);
    if (co !== st.last.co) { d.contact.style.opacity = co; st.last.co = co; }
    const cco = ((0.72 - 0.3 * lift) * Math.pow(proj, 3)).toFixed(3);
    if (cco !== st.last.cco) { d.coverSh.style.opacity = cco; st.last.cco = cco; }

    // foil sheen for the faces that can be seen
    if (st.ptw && st.ptw.kind === "exit") return;
    const vwU = bx1 - bx0, vhU = by1 - by0;
    const tyN = ry / TILT_Y, txN = rx / TILT_X;
    const L = vwU * Math.abs(D[0]) + vhU * Math.abs(D[1]);
    const off = 0.62 * L * (0.85 * tyN - 0.5 * txN);
    const view = {
      ty: tyN, tx: txN, L,
      bx: pvx + D[0] * off, by: pvy + D[1] * off,
      gx: pvx + clamp(tyN, -1.2, 1.2) * vwU * 0.42, gy: pvy + clamp(-txN, -1.2, 1.2) * vhU * 0.42,
      R: Math.max(vwU, vhU) * 0.75,
    };
    const foilName = getFoil(st);
    if (q < 0.5) drawSheen(st, "front", view, foilName);
    if (q > 0.5) drawSheen(st, "back", view, foilName);
    if (q > 0.02) drawSheen(st, "inside", view, foilName);
  }

  const workTimes = [];
  window.__keepsakeStats.work = workTimes;
  function frame(now) {
    requestAnimationFrame(frame);
    const w0 = performance.now();
    const nowS = now / 1000;
    const rawDt = lastNow ? nowS - lastNow : 1 / 60;
    if (lastNow) { frameTimes.push(rawDt * 1000); if (frameTimes.length > 600) frameTimes.shift(); }
    lastNow = nowS;
    const dt = clamp(rawDt, 0, 0.05);
    clock += dt;

    // 1) reads first: fit any message that changed
    for (const st of S) if (st.needFit && st.visible) fitMessage(st);

    // 2) tilt springs
    const amp = reduced ? 0.5 : 1;
    const pointerLive = tilt.mode !== "none" && (tilt.mode === "touch" || clock - tilt.lastMove < 2.5);
    const idleTarget = pointerLive ? 0 : 1;
    tilt.idle += (idleTarget - tilt.idle) * (1 - Math.exp(-dt / (idleTarget ? 1.1 : 0.25)));
    const pRy = tilt.mode === "none" ? 0 : tilt.nx * TILT_Y;
    const pRx = tilt.mode === "none" ? 0 : -tilt.ny * TILT_X;
    // idle float: rests after FLOAT_REST s without input or animation (fading out over ~1.5 s) and comes
    // back on the next input, so an untouched page stops repainting its foil
    const floatOn = clock - lastInput < FLOAT_REST;
    if (reduced) tilt.fl = 0;
    else {
      tilt.fl += ((floatOn ? 1 : 0) - tilt.fl) * (1 - Math.exp(-dt / (floatOn ? 0.35 : 0.5)));
      if (!floatOn && tilt.fl < 0.002) tilt.fl = 0;
    }
    const fl = tilt.fl;
    const fRy = fl * TILT_Y * 0.46 * Math.sin(0.5 * clock), fRx = fl * TILT_X * 0.4 * Math.sin(0.37 * clock + 1);
    const w = tilt.idle;
    springStep(tilt.ry, amp * lerp(pRy, fRy, w), 7, dt);
    springStep(tilt.rx, amp * lerp(pRx, fRx, w), 7, dt);
    tilt.bob = fl * w * 4 * Math.sin(0.62 * clock + 0.4);
    const cur = S[active];
    const over = tilt.mode === "mouse" && pointerLive && cur && hitCard(cur, tilt.px, tilt.py);
    springStep(tilt.lift, over && !reduced ? 1 : 0, 9, dt);
    springStep(room.r, writer.hidden ? 0 : 1, reduced ? 30 : 8, dt);
    if (cur && !!over !== !!stage.__hover) { stage.__hover = !!over; stage.style.cursor = over ? "pointer" : ""; }

    // 3) state machines
    stepShow();
    for (const st of S) { if (st.visible) { evalPose(st); evalOpen(st); } }
    if (pending) {
      const c = S[active];
      if (!c.ot && c.q === 0 && c.openTo === 0) { const pd = pending; pending = null; doSwitch(pd.target, pd.dir, { auto: pd.auto }); }
    }

    // 4) writes
    for (const st of S) if (st.visible) writeSlot(st, st === S[active]);
    workTimes.push(performance.now() - w0);
    if (workTimes.length > 600) workTimes.shift();
  }

  /* ================= resize ================= */
  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    const rer = layout();
    for (const st of S) st.last = {};
    if (!writer.hidden) measureWriter();
    if (rer) {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => queueAll(active), 180);
    }
  });

  /* ================= boot ================= */
  edgeColor = cssVar("--paper-edge", edgeColor);
  layout();
  syncToolbar();
  setShow(!reduced);
  requestAnimationFrame(frame);

  const fontLoads = [];
  try {
    if (document.fonts && document.fonts.load) {
      ['500 20px "Josefin Sans"', '600 20px "Josefin Sans"', '500 20px "Caveat"', '600 13px "Instrument Sans"'].forEach((f) => {
        fontLoads.push(document.fonts.load(f).catch(() => null));
      });
    }
  } catch (e) { /* ignore */ }
  const gate = Promise.race([Promise.all(fontLoads), new Promise((r) => setTimeout(r, 650))]);
  gate.then(() => {
    const st = S[active];
    // if the user already switched (slow fonts), that card is on its way in: don't restart its entrance
    if (!st.visible) {
      ensureFace(st, "front");
      showSlot(st);
      st.dom.slot.style.zIndex = "3";
      if (reduced) startPose(st, "fadeIn", Object.assign({}, REST, { op: 0 }), REST, 0.2, 0);
      else startPose(st, "enter", enterPose(1), REST, 1.0, 0.05);
      announce(`Card ${active + 1} of ${N}, ${st.card.title}`);
    }
    show.mark = clock;
    lastInput = clock;
    queueAll(active);
  });
  try {
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        S.forEach((st) => { st.needFit = true; });
        // repaint fronts whose lettering was painted before the fonts arrived. Only cover text is drawn
        // with web fonts, and only on the front (the back silhouette and the inside never change with it).
        if (fontsOK()) {
          S.forEach((st) => {
            if (st.fontsAtRender === false && st.card.coverText != null && st.faces.front.ready) {
              st.fontsAtRender = null;
              st.faces.front.dirty = true;
              enqueue(st, "front", st === S[active]);
            }
          });
        }
      });
    }
  } catch (e) { /* ignore */ }
})();
