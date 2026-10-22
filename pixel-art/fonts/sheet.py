"""Contact sheet for Stillframe's two faces (src/ui/fonts.ts), read straight from the TypeScript tables.

    python pixel-art/fonts/sheet.py

Writes pixel-art/fonts/preview/fonts.png at x3 (one font pixel = 3 screen pixels, between the x2 of a
720p window and the x3 of 1080p): every glyph of Pane and Shard, then sample HUD and menu lines in ink
on paper, the way the game shows them.
"""
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "common"))
from sf import C, ROOT  # noqa: E402

SRC = (ROOT / "src/ui/fonts.ts").read_text(encoding="utf-8")


def face(name):
    """Glyphs and metrics of one face, parsed from its `export const NAME: FaceDef = {...}` block."""
    block = SRC.split(f"export const {name}: FaceDef = {{", 1)[1].split("\n};", 1)[0]
    metric = {k: int(v) for k, v in re.findall(r"^\s*(cap|gap|space|lineH): (\d+),", block, re.M)}
    glyphs = {}
    for key, rows in re.findall(r"^\s*'((?:\\'|[^'])+)': '([.#|]+)',$", block, re.M):
        glyphs[key.replace("\\'", "'")] = rows.split("|")
    return metric, glyphs


def width(g):
    return len(g[0])


def draw_text(img, metric, glyphs, text, x, y, color, s):
    d = ImageDraw.Draw(img)
    for ch in text:
        if ch == " ":
            x += metric["space"] * s
            continue
        g = glyphs.get(ch) or glyphs.get(ch.upper()) or glyphs["?"]
        for j, row in enumerate(g):
            for i, c in enumerate(row):
                if c == "#":
                    d.rectangle([x + i * s, y + j * s, x + (i + 1) * s - 1, y + (j + 1) * s - 1], fill=color)
        x += (width(g) + metric["gap"]) * s
    return x


def main():
    s = 3
    pane, shard = face("PANE"), face("SHARD")
    img = Image.new("RGB", (1180, 900), C.paper)
    y = 12
    for metric, glyphs in (pane, shard):
        keys = list(glyphs)
        x = 12
        for k in keys:
            w = (width(glyphs[k]) + 3) * s
            if x + w > img.width - 12:
                x = 12
                y += (metric["lineH"] + 4) * s
            draw_text(img, metric, glyphs, k, x, y, C.ink, s)
            x += w
        y += (metric["lineH"] + 8) * s
    samples = [
        (shard, "1-5 CONFERENCE", C.ink),
        (pane, "Reds left 12   Pistol   Time   12.4 s / par 28", C.ink),
        (pane, "Stand still to think. Every step runs the clock.", C.iron),
        (pane, "Punch an armed red and its gun drops. Click a gun to take it.", C.ink),
        (shard, "SHATTERED", C.blood),
        (pane, "by a Gunner   R try again · Esc map", C.iron),
        (shard, "STILL. FRAME.  WAVE 2  PHASE 3  x2", C.ink),
        (pane, "Stride II · You move 30% faster than it · 100 coins", C.tide),
        (pane, "The quick brown fox jumps over the lazy dog (0123456789)", C.ink),
        (pane, "THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG! 50% + 3?", C.ink),
    ]
    for (metric, glyphs), text, color in samples:
        draw_text(img, metric, glyphs, text, 12, y, color, s)
        y += (metric["lineH"] + 2) * s
    out = Path(__file__).parent / "preview"
    out.mkdir(exist_ok=True)
    img.crop((0, 0, img.width, min(img.height, y + 12))).save(out / "fonts.png")
    print("wrote", out / "fonts.png")


if __name__ == "__main__":
    main()
