# Taste Studio

A working take on [Taste](https://buildwithtaste.com/): a reference library where each saved interface gets a design breakdown, an AI-ready prompt, a timeline of motion beats, a color palette and pinned notes. Everything is editable.

Open `index.html` in a browser. No build step, no dependencies.

## What's in it

- **Live specimen.** The "Tolan Store" reference is an avatar-store screen drawn entirely on `<canvas>` from a deterministic script, so scrubbing to any time shows exactly that frame. A finger cursor glides between taps; tabs spring a highlight bubble, item grids fade out and stagger back in, the avatar blinks, tracks the cursor, and squashes with sparks when you equip something.
- **Take over.** Tap the phone to switch from the script to interactive mode and dress the avatar yourself. Press play to go back.
- **Filmstrip scrubber.** Thumbnails are rendered from the same scene function. Timeline moments and annotations show as markers; drag to scrub, Space to play, ← → to step (Shift for 1s), 0.5×/0.25× speeds.
- **Editing.** Title, summary, observations, prompt, timeline moments, palette names/roles/colors (color changes recolor the live specimen and filmstrip), annotations and comments. "Rebuild from breakdown" regenerates the prompt from your edits.
- **Add your own stills.** Drop, paste or pick a screenshot. An on-device breakdown quantizes its palette, assigns roles, measures text contrast against WCAG, and estimates density and color temperature.
- **Use with your AI assistant.** Exports the whole library as a taste-profile JSON to paste into Claude Code, Cursor or Codex.

State autosaves to `localStorage` in your browser. Import/export moves a library between browsers.

`app.html` is the same page without the document skeleton (the form used for publishing as a claude.ai artifact); `index.html` is generated from it.
