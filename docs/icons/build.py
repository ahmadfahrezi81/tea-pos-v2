#!/usr/bin/env python3
"""Builds every app icon from glyphs.json: the 1024 master SVG, then the PNGs each app ships.

Run from the repo root on a Mac: python3 docs/icons/build.py
Needs Pillow and numpy (pip3 install pillow numpy); renders with macOS's qlmanage.
The rules it follows are in docs/icons/README.md.
"""
import json
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
SIZE = 1024
# The glyph's farthest point stays this far from the centre: Android's safe circle is 410 (80%).
REACH = 380
# And its longest side no more than this: about 62% of the tile.
LONGEST = 640
# Which app ships which icon.
APPS = {"tea-seller": "apps/seller", "tea-office": "apps/backoffice"}


def mask_layers(g):
    """The glyph on its 24 grid: white is the glyph, black cuts the background back in."""
    out = [f'<path d="{g["solid"]}" fill="#fff"/>']
    if g.get("holes"):
        out.append(f'<path d="{g["holes"]}" fill="#000"/>')
    for s in g.get("cut", []):
        out.append(f'<path d="{s["d"]}" fill="none" stroke="#000" stroke-width="{s["width"]}" stroke-linecap="{s["cap"]}"/>')
    for s in g.get("line", []):
        out.append(f'<path d="{s["d"]}" fill="none" stroke="#fff" stroke-width="{s["width"]}" stroke-linecap="{s["cap"]}"/>')
    if g.get("over"):
        out.append(f'<path d="{g["over"]}" fill="#fff"/>')
    return "".join(out)


def render(svg, size, out):
    """SVG to a PNG of size x size with macOS's renderer."""
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "icon.svg"
        src.write_text(svg)
        subprocess.run(["qlmanage", "-t", "-s", str(size), "-o", tmp, str(src)], check=True, capture_output=True)
        Image.open(Path(tmp) / "icon.svg.png").convert("RGB").resize((size, size), Image.LANCZOS).save(out)


def fit(g):
    """Scale and centre the glyph: as large as it can be inside the safe circle (REACH) and LONGEST."""
    probe = f'<svg xmlns="http://www.w3.org/2000/svg" width="{SIZE}" height="{SIZE}"><defs><mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="{SIZE}" height="{SIZE}"><g transform="translate(212 212) scale(25)">{mask_layers(g)}</g></mask></defs><rect width="{SIZE}" height="{SIZE}" fill="#000"/><rect width="{SIZE}" height="{SIZE}" fill="#fff" mask="url(#m)"/></svg>'
    with tempfile.TemporaryDirectory() as tmp:
        png = Path(tmp) / "probe.png"
        render(probe, SIZE, png)
        a = np.array(Image.open(png).convert("L"))
    ys, xs = np.nonzero(a > 128)
    cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
    far = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2).max()
    f = min(REACH / far, LONGEST / max(xs.max() - xs.min(), ys.max() - ys.min()))
    return f"translate({512 + f * (212 - cx):.2f} {512 + f * (212 - cy):.2f}) scale({25 * f:.4f})"


def master(g, transform):
    """The full-bleed square: the light gradient, the glyph in white. No rounded corners (the phone rounds)."""
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{SIZE}" height="{SIZE}" viewBox="0 0 {SIZE} {SIZE}">'
        f'<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{g["top"]}"/>'
        f'<stop offset="1" stop-color="{g["bottom"]}"/></linearGradient>'
        f'<mask id="glyph" maskUnits="userSpaceOnUse" x="0" y="0" width="{SIZE}" height="{SIZE}">'
        f'<g transform="{transform}">{mask_layers(g)}</g></mask></defs>'
        f'<rect width="{SIZE}" height="{SIZE}" fill="url(#bg)"/>'
        f'<rect width="{SIZE}" height="{SIZE}" fill="#fff" mask="url(#glyph)"/></svg>\n'
    )


def main():
    glyphs = json.loads((HERE / "glyphs.json").read_text())
    for name, g in glyphs.items():
        svg = master(g, fit(g))
        (HERE / f"{name}.svg").write_text(svg)
        app = APPS.get(name)
        if not app:
            continue
        render(svg, SIZE, HERE / f"{name}.png")
        icons = ROOT / app / "public" / "icons"
        for px in (512, 192):
            render(svg, px, icons / f"icon-{px}x{px}.png")
        print(f"{name}: {app}/public/icons")


if __name__ == "__main__":
    main()
