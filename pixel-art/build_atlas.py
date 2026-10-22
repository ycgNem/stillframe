"""Packs every pixel-art/*/export/sprites.json into the game's atlas: src/art/sheet.png + sheet.json.

Each export folder lists its sprites as horizontal strips: {name, file, frame: [w, h], frames, pivot}.
Frames are cropped to their opaque pixels (pivots adjusted), then shelf-packed into one sheet. The game
loads only the atlas (src/render/atlas.ts).

Run from the repo root:  python pixel-art/build_atlas.py          (pack only)
                         python pixel-art/build_atlas.py --all    (rebuild every artwork first)
"""
import json
import subprocess
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "pixel-art"
OUT = ROOT / "src" / "art"
WIDTH = 512
PAD = 1


def frames_of(folder: Path):
    meta = json.loads((folder / "sprites.json").read_text())
    for sp in meta["sprites"]:
        strip = Image.open(folder / sp["file"]).convert("RGBA")
        fw, fh = sp["frame"]
        crops = []
        for i in range(sp["frames"]):
            fr = strip.crop((i * fw, 0, (i + 1) * fw, fh))
            crops.append(fr)
        # one crop box for every frame of a sprite, so the pivot stays put while it animates
        boxes = [c.getbbox() for c in crops if c.getbbox()]
        if boxes:
            x0 = min(b[0] for b in boxes); y0 = min(b[1] for b in boxes)
            x1 = max(b[2] for b in boxes); y1 = max(b[3] for b in boxes)
        else:
            x0, y0, x1, y1 = 0, 0, 1, 1
        yield sp["name"], [c.crop((x0, y0, x1, y1)) for c in crops], [sp["pivot"][0] - x0, sp["pivot"][1] - y0]


def main():
    if "--all" in sys.argv:
        for build in sorted(ART.glob("*/build.py")):
            if build.parent.name in ("common", "style_key"):
                continue
            print("build", build.parent.name)
            subprocess.run([sys.executable, str(build)], check=True, cwd=ROOT, stdout=subprocess.DEVNULL)
    sprites = []
    for meta in sorted(ART.glob("*/export/sprites.json")):
        sprites.extend(frames_of(meta.parent))
    # tallest first, then shelves left to right
    order = sorted(((n, f, p) for n, f, p in sprites), key=lambda s: -s[1][0].height)
    x = y = shelf = 0
    placed = {}
    for name, frames, pivot in order:
        rects = []
        for fr in frames:
            w, h = fr.size
            if x + w > WIDTH:
                x = 0
                y += shelf + PAD
                shelf = 0
            rects.append((x, y, fr))
            x += w + PAD
            shelf = max(shelf, h)
        placed[name] = (rects, pivot)
    height = y + shelf
    sheet = Image.new("RGBA", (WIDTH, height), (0, 0, 0, 0))
    out = {"size": [WIDTH, height], "sprites": {}}
    for name, (rects, pivot) in sorted(placed.items()):
        out["sprites"][name] = {"frames": [[rx, ry, fr.width, fr.height] for rx, ry, fr in rects], "pivot": pivot}
        for rx, ry, fr in rects:
            sheet.paste(fr, (rx, ry))
    OUT.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT / "sheet.png", optimize=True)
    (OUT / "sheet.json").write_text(json.dumps(out, separators=(",", ":")))
    print(f"atlas: {len(placed)} sprites, {sum(len(r) for r, _ in placed.values())} frames, {WIDTH}x{height}")


if __name__ == "__main__":
    main()
