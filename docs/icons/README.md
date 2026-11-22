# App icons

Every app in the suite has an icon from the same family, so they read as one set on a phone. Designed with the owner on 2026-11-15 (task 063).

| App                   | Glyph                                                               | Colour (top → bottom)        |
| --------------------- | ------------------------------------------------------------------- | ---------------------------- |
| Tea-Seller            | a tea leaf, its vein cut out, a short stem                          | blue `#2E6CFF` → `#1354F0`   |
| Tea-Office            | one building: a tower with a lower wing, windows and a door cut out | orange `#FF5A1A` → `#EC4500` |
| (example) a later app | a delivery truck                                                    | green `#14B04D` → `#029A3B`  |

## The rules

1. **Flat.** No 3D, no bevels, no gloss, no shadows.
2. **The background:** the app's own colour, a very light gradient from top to bottom (a few shades apart, no more). It fills the whole square: no transparency, no rounded corners (iOS and Android round them).
3. **One glyph, solid white.** A single simple object, no text, nothing busy. Filled shapes; details (windows, a vein) are cut out so the background shows through.
4. **Drawn on a 24-unit grid** like an icon set: corners rounded about 1.3 units on big shapes, 0.35 on small cut-outs, lines 1.45 wide with round ends. A line that leaves a shape (a stem) starts inside it, never at its edge, so nothing pinches.
5. **The size is fitted, not guessed:** `build.py` scales each glyph until its farthest point is 380 px from the centre of the 1024 square (Android's safe circle is 410) or its longest side is 640 px, whichever comes first. So every glyph is as large as it can be and never cropped by a circle mask.
6. **It must read at 48 px** (a home screen) as the same object; at 16 px (a browser tab) a recognisable silhouette is enough.
7. **A new app** gets a new glyph and a new colour, never a variant of another app's glyph. Pick a colour clearly apart from the others in lightness as well as hue.

## Files

- `glyphs.json`: each icon's colours and glyph (SVG paths on the 24 grid: `solid` white shapes, `holes` cut-outs, `cut` cut-out lines, `line` white lines, `over` white shapes drawn last)
- `build.py`: fits each glyph, writes `<name>.svg` (the 1024 master) and, for an app in its `APPS`, `<name>.png` (1024) the app's `public/icons/icon-192x192.png` and `icon-512x512.png`, and `badge-96x96.png` (the glyph alone, white on transparent: the status-bar badge of a push)
- `<name>.svg`, `<name>.png`: generated; never edit them, edit `glyphs.json`

```bash
python3 docs/icons/build.py   # on a Mac; needs: pip3 install pillow numpy
```

The 512 PNG is also the maskable icon and the iPhone home-screen icon (`packages/config/vite.ts`, `apps/*/index.html`), which the safe-circle fit makes safe. A phone keeps an installed app's old icon until the app is reinstalled.
