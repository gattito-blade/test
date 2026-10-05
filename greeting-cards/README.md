# Keepsake

An interactive greeting-card viewer. A card floats on the page and tilts in 3D toward the pointer, and its foil and glitter catch a moving light. The cover swings open on its hinge to show a handwritten message inside. A floating toolbar switches between five cards; on each switch the new card drops in while the old one falls away. A slideshow plays through them all.

Every card is painted procedurally on `<canvas>`. There are no image files.

Open `index.html` in a browser. There's no build step needed to view it.

## Cards

| Card | What's on it |
| --- | --- |
| Starry lilies | Cream stock with hand-painted gold glitter stripes, punched glitter stars, and two die-cut stargazer lilies that overflow the edges |
| Cherry blossom | Glitter-edged camellia blossoms and buds on a deep red marker-painted panel |
| Mother's Day lily | A watercolour lily on cold-press paper with gold-foil anthers and editable gold lettering |
| Space bunny | A die-cut bunny with a silver-foil edge and planet ring, sugar glitter, and a bank of clay flowers |
| Pearl moon | Pearl cotton paper, embossed cloud banks, a die-cut cloud and a holographic silver crescent |

## Editing

- Open a card and click the message to type straight onto the insert.
- **Write** (pencil) opens a panel with these options:
  - message
  - sign-off
  - cover text (Mother's Day card)
  - foil colour (gold, silver, rose or holographic)
  - copy
  - reset
- Edits are saved in this browser's `localStorage` (`keepsake-v1`). If storage is blocked, the page still works.

Keys: ← → switch cards, Space/Enter open or close, Esc steps back. When the toolbar has focus, W opens the writing panel and P toggles the slideshow.

## Source layout

- `src/core.js` holds the card registry, the seeded random number generator, and face rendering. The back of the cover is generated as a mirrored silhouette of the front.
- `src/cards/*.js` has one painter per card. Each one draws an `art` layer and a `foil` mask; see `CONTRACT.md`.
- `src/shell.html`, `src/shell.css` and `src/shell.js` hold the 3D stage, sheen and glints, hinge, switching, toolbar, writing panel and slideshow.
- `python3 build.py` inlines everything into `app.html` (artifact form) and `index.html` (standalone).
- `tools/render-card.cjs <id> out.png` renders one card's faces and foil masks for visual checks. It needs Playwright.
