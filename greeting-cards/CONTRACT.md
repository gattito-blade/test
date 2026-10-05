# Keepsake — card authoring contract

Keepsake is a single-page greeting-card viewer: a card floats on the page, tilts toward the pointer in 3D, its foil and glitter catch a moving light, and the cover swings open on a hinge to reveal a handwritten message. A floating toolbar switches between five cards, opens/closes the current card, edits the message, and toggles a slideshow.

Everything is drawn procedurally. **No image files, no external assets** except Google Fonts.

## Files

| File | Owner | What it is |
| --- | --- | --- |
| `src/core.js` | shared (do not change the API) | registry, `K.rng`, `K.renderFace`, paint helpers |
| `src/cards/<id>.js` | one card each | one IIFE that calls `KEEPSAKE.registerCard({...})` |
| `src/shell.html` | shell | body markup fragment (no `<html>/<head>/<body>`, no `<style>`/`<script>`) |
| `src/shell.css` | shell | all page CSS (design tokens on `:root`, light + dark) |
| `src/shell.js` | shell | the app: 3D card, foil sheen, open/close, transitions, toolbar, editing, slideshow |
| `build.py` | shared | inlines everything into `app.html` (artifact form, no document skeleton) and `index.html` (standalone) |
| `tools/preview.html` + `tools/render-card.cjs` | shared | render one card's faces to a PNG for visual checking |

Card order (also the toolbar order) is `KEEPSAKE.ORDER`:
`lily-stars`, `cherry-blossom`, `mothers-day`, `bunny-space`, `pearl-moon`.

## Card spec

```js
(function () {
  const K = window.KEEPSAKE;
  K.registerCard({
    id: "lily-stars",
    title: "Starry lilies",            // shown as tooltip / aria-label
    size: { w: 300, h: 290 },          // card rectangle in card units (defines the aspect ratio)
    bleed: { t: 0.14, r: 0.1, b: 0.1, l: 0.08 }, // how far die-cut art may overflow the rectangle, as fractions of w/h
    paper: "#EFE3C4",                  // card stock: back of the cover (auto silhouette) + inside page
    backPaper: "#EFE3C4",              // optional, defaults to paper
    insert: "#FBF7EE",                 // the cream insert glued on the inside-right page
    ink: "#2B2722",                    // message ink colour
    foil: "gold",                      // "gold" | "silver" | "rose" | "holo" — tints the moving sheen
    message: "Wishing you\na sky full\nof stars.",   // default inside message (user can edit)
    coverText: undefined,              // optional editable cover text (e.g. "HAPPY\nMOTHER'S DAY"), passed back as opts.text
    messageRect: undefined,            // optional {x,y,w,h} in card units on the inside page; default K.messageRect(card)
    drawCover(ctx, box, layer, opts) {},
    drawBack(ctx, box, layer, opts) {},
    drawInside(ctx, box, layer, opts) {},
  });
})();
```

### Coordinate space

`ctx` is pre-transformed: **(0,0) is the top-left of the card rectangle, (box.w, box.h) its bottom-right, in card units.** Draw outside that range (negative coords or beyond w/h) only within the declared `bleed` on the front. Never call `setTransform` without restoring the incoming transform (use `save()/restore()`; if you need the base transform, read it with `ctx.getTransform()` first).

### Faces

- **`drawCover` — front.** The whole front: background paint, illustration, die-cut overflow, cover text (use `opts.text`, which falls back to `coverText`).
- **`drawBack` — back of the cover (inside-left page once open).** Before this is called, `core.js` has already painted a *mirrored silhouette of the cover* in `backPaper` with paper grain. Draw only extra motifs on top (e.g. a few foil stars, a line-art echo of the cover). It is in the same card-unit space, but remember this page is seen mirrored relative to the cover: something at the cover's top-right appears at the back's top-left.
- **`drawInside` — inside-right page.** `core.js` has already painted the page in `paper` and the insert card (`K.insertRect(card)`) in `insert`. Draw a small motif below the message (around y ≈ 0.72·h–0.85·h) and any subtle decoration. **Leave `K.messageRect(card)` clear** — the shell overlays the (editable) message there as live DOM text in a handwriting font.

### Layers

Every draw function is called twice, once per layer:

- `layer === "art"` — full-colour painting.
- `layer === "foil"` — paint **only** the regions that are metallic foil or glitter, in opaque white (`#fff`; lower alpha = weaker shine). Everything else stays transparent. The shell uses this as a mask for a moving light band and twinkling sparkles that respond to tilt.

Both passes receive identically seeded generators, so shapes line up exactly **as long as both layers consume random numbers in the same order**. **Never use `Math.random()`.**

The safe pattern (do this): take every *layout* decision (positions, sizes, rotations, petal counts) from a **named stream** — `const L = opts.rng("stars")` — and every *texture* decision (speckles, grain, glitter flecks, watercolour blotches) from a **different** named stream that only the art layer uses, e.g. `opts.rng("speckle")`. Named streams are independent, so skipping texture work in the foil layer can never shift the layout. `opts.rand` is also available as a general stream. Generators have `r()`, `r.range(a,b)`, `r.int(a,b)`, `r.pick(arr)`, `r.gauss()`.

`K.glitterFill` and `K.paperGrain` consume exactly one value from the generator you pass, in either layer.

### opts

`{ text, rand, rng(name), face, layer, scale }` — `scale` is device pixels per card unit (useful to size grain/glitter flecks so they are ~1 device px).

### Helpers in `core.js`

`K.rng(seed)`, `K.starPath(ctx,x,y,r,points,inner,rot,rounded)`, `K.sparklePath(ctx,x,y,r,thin)`, `K.glitterFill(ctx, layer, rand, palette, {bounds, density, size, base, glints, glint, mask})` (fills the current path with glitter flecks, or white in the foil layer), `K.paperGrain(ctx,x,y,w,h,rand,amount,mode)`, `K.mix(hexA,hexB,t)`. Private helpers belong inside your own IIFE.

### Fonts

Canvas text must name a real stack with fallbacks, e.g. `'500 15px "Josefin Sans", "Futura", "Century Gothic", sans-serif'`. The shell loads Google Fonts (`Caveat` for messages, `Josefin Sans` for cover lettering, `Instrument Sans` for UI). If the fonts arrive after the first paint, it re-renders the front of every card that declares `coverText` (the only canvas text) once `document.fonts.ready` resolves.

### Performance

A face is rendered once (again only when the user edits cover text, or when a larger window needs a sharper copy), at up to 2.5× (3.5× for the card on show on large hi-DPI screens) device px per unit, and the card is about 300 units wide, so a face is ≈ 750–1050 px across. Keep one `renderFace` under ~150 ms: prefer `fillRect` flecks to thousands of path fills, bound glitter with `bounds`, and avoid per-pixel `getImageData` loops over the whole canvas.

## Checking your work

```bash
NODE_PATH=/tmp/claude-0/-home-user-test/b3c52a31-02bc-57f4-8f3d-37570759efc7/scratchpad/node_modules \
  node tools/render-card.cjs <card-id> /path/to/out.png [scale]
```

The PNG shows: front art · front foil mask · front with sheen preview · back art · inside art (with the message drawn in a stand-in font so you can judge layout) · render timings. Open it with the Read tool and compare against the reference frames.
