"""Items for Stillframe (docs/STYLE.md §2–3): everything you can pick up is ink with one slate highlight.

- held_<kind>: 16 pre-drawn angles (never rotated at runtime), pivot at the grip / the hand.
- item_<kind>: lying on the floor, pivot at its centre.
- thrown_desk, thrown_beam, thrown_record: what the bosses lob (the Manager's desk, the Foreman's steel
  beam, the DJ's records), tumbling through the air, 4 frames each. Greys and coal, never ink: you can't
  pick them up.
- coin: the 4-frame spin from the style key.

Shapes are built from lines along the aim, so each angle is drawn, not resampled: no mixed pixel density.
Run from the repo root: python pixel-art/items/build.py
"""
import json
import math
import sys
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "common"))
from sf import C, check, sprite  # noqa: E402

EXPORT = HERE / "export"
PREVIEW = HERE / "preview"
CELL = 20
PIV = CELL // 2


def thick_line(s, x0, y0, x1, y1, w, c):
    """A solid capsule `w` px thick: every pixel whose centre is within w/2 of the segment. Thickness stays
    even at diagonals, unlike offset lines, which leave gaps."""
    if w <= 1:
        s.line(round(x0), round(y0), round(x1), round(y1), c)
        return
    r = w / 2
    dx, dy = x1 - x0, y1 - y0
    L2 = dx * dx + dy * dy or 1
    for y in range(int(min(y0, y1) - r - 1), int(max(y0, y1) + r + 2)):
        for x in range(int(min(x0, x1) - r - 1), int(max(x0, x1) + r + 2)):
            t = max(0.0, min(1.0, ((x - x0) * dx + (y - y0) * dy) / L2))
            if math.hypot(x - (x0 + dx * t), y - (y0 + dy * t)) <= r * 0.86 + 0.01:
                s.px(x, y, c)


def top_light(s, c=None):
    """Ink pixels with nothing above them get the one slate highlight (light from the top)."""
    c = c or C.slate
    im = s.composite()
    W, H = im.size
    for y in range(1, H):
        for x in range(W):
            if im.getpixel((x, y))[3] and not im.getpixel((x, y - 1))[3] and im.getpixel((x, y))[:3] == (0x14, 0x16, 0x1a):
                if y + 1 < H and im.getpixel((x, y + 1))[3]:
                    s.px(x, y, c)


def gun(s, a, length, width, grip, stock=0):
    cx = cy = PIV
    ux, uy = math.cos(a), math.sin(a)
    # "down" for the grip: always toward the bottom of the screen-ish, whichever way the gun points
    side = 1 if ux >= 0 else -1
    gx, gy = -uy * side, ux * side
    if gy < 0:
        gx, gy = -gx, -gy
    bx0, by0 = cx - ux * (2 + stock), cy - uy * (2 + stock)
    bx1, by1 = cx + ux * length, cy + uy * length
    thick_line(s, bx0, by0, bx1, by1, width, C.ink)
    # the grip, from just behind the hand
    thick_line(s, cx - ux * 1, cy - uy * 1, cx - ux * 1 + gx * grip, cy - uy * 1 + gy * grip, 3, C.ink)
    if stock:
        thick_line(s, cx - ux * (2 + stock), cy - uy * (2 + stock), cx - ux * 2, cy - uy * 2, width + 1, C.ink)
    top_light(s)


def smg(s, a):
    """Short and boxy, with a magazine forward of the grip."""
    gun(s, a, 7, 4, 3)
    cx = cy = PIV
    ux, uy = math.cos(a), math.sin(a)
    side = 1 if ux >= 0 else -1
    gx, gy = -uy * side, ux * side
    if gy < 0:
        gx, gy = -gx, -gy
    thick_line(s, cx + ux * 3.5, cy + uy * 3.5, cx + ux * 3.5 + gx * 3.5, cy + uy * 3.5 + gy * 3.5, 2, C.ink)


def rifle(s, a):
    """Long and thin, a stock behind the hand and a scope on top."""
    gun(s, a, 11, 2, 2, stock=3)
    cx = cy = PIV
    ux, uy = math.cos(a), math.sin(a)
    side = 1 if ux >= 0 else -1
    gx, gy = -uy * side, ux * side
    if gy < 0:
        gx, gy = -gx, -gy
    # the scope sits on the side away from the grip
    sx, sy = cx + ux * 4 - gx * 1.4, cy + uy * 4 - gy * 1.4
    thick_line(s, sx - ux * 2, sy - uy * 2, sx + ux * 2, sy + uy * 2, 2.4, C.ink)


def katana(s, a):
    """A long thin blade with a square guard; the edge catches the light along its length."""
    cx = cy = PIV
    ux, uy = math.cos(a), math.sin(a)
    thick_line(s, cx - ux * 3, cy - uy * 3, cx + ux * 1, cy + uy * 1, 2, C.ink)
    thick_line(s, cx + ux * 1 - uy * 1.6, cy + uy * 1 + ux * 1.6, cx + ux * 1 + uy * 1.6, cy + uy * 1 - ux * 1.6, 2, C.iron)
    s.line(round(cx + ux * 2), round(cy + uy * 2), round(cx + ux * 10), round(cy + uy * 10), C.ink)
    s.line(round(cx + ux * 5), round(cy + uy * 5), round(cx + ux * 7), round(cy + uy * 7), C.slate)


def bottle(s, a):
    cx = cy = PIV
    ux, uy = math.cos(a), math.sin(a)
    thick_line(s, cx - ux * 3, cy - uy * 3, cx + ux * 2, cy + uy * 2, 3, C.ink)
    thick_line(s, cx + ux * 2, cy + uy * 2, cx + ux * 5, cy + uy * 5, 1, C.ink)
    top_light(s)


def mug(s, a):
    cx = cy = PIV
    ux, uy = math.cos(a), math.sin(a)
    s.rect(cx - 2, cy - 2, cx + 1, cy + 2, C.ink)
    # the handle swings round as it spins
    hx, hy = cx + ux * 3.4, cy + uy * 2.6
    s.px(round(hx), round(hy), C.ink)
    s.rect(cx - 2, cy - 2, cx + 1, cy - 2, C.iron)


def keyboard(s, a):
    cx = cy = PIV
    ux, uy = math.cos(a), math.sin(a)
    thick_line(s, cx - ux * 5, cy - uy * 5, cx + ux * 5, cy + uy * 5, 4, C.ink)
    for t in (-3, 0, 3):
        s.px(round(cx + ux * t), round(cy + uy * t), C.iron, only=C.ink)
    top_light(s)


def ashtray(s, a):
    cx = cy = PIV
    s.circle(cx, cy, 3, C.ink, fill=True)
    s.px(cx, cy, C.coal)
    ux, uy = math.cos(a), math.sin(a)
    s.px(round(cx + ux * 3), round(cy + uy * 3), None)
    s.px(cx - 1, cy - 2, C.slate, only=C.ink)


DRAW = {
    "pistol": lambda s, a: gun(s, a, 6, 3, 3),
    "shotgun": lambda s, a: gun(s, a, 9, 3, 2, stock=3),
    "smg": smg,
    "rifle": rifle,
    "katana": katana,
    "bottle": bottle,
    "mug": mug,
    "keyboard": keyboard,
    "ashtray": ashtray,
}


def held(kind):
    frames = []
    for i in range(16):
        s = sprite(CELL, CELL)
        DRAW[kind](s, i * math.pi / 8)
        frames.append(check(s, f"held_{kind}_{i}"))
    return frames


def floor_item(kind):
    s = sprite(CELL, CELL)
    DRAW[kind](s, -0.35 if kind in ("pistol", "shotgun", "smg", "rifle", "katana") else 0)
    return check(s, f"item_{kind}")


def desk_frames():
    """The Manager's desk, tumbling: top, edge, underside, edge."""
    out = []
    W = 24
    for f in range(4):
        s = sprite(W, W)
        if f == 0:
            s.rect(4, 6, 19, 13, C.fog).rect(4, 6, 19, 6, C.paper).rect(4, 14, 19, 16, C.ash).rect(4, 16, 19, 16, C.stone)
            s.rect(6, 8, 10, 11, C.paper).rect(13, 3, 17, 7, C.slate).rect(14, 4, 16, 6, C.stone)
        elif f in (1, 3):
            s.rect(3, 9, 20, 13, C.ash).rect(3, 9, 20, 9, C.fog).rect(3, 13, 20, 13, C.stone)
            s.rect(3 if f == 1 else 19, 6, 4 if f == 1 else 20, 16, C.stone)
        else:
            s.rect(4, 7, 19, 15, C.stone).rect(4, 7, 19, 7, C.ash)
            s.rect(5, 3, 6, 7, C.slate).rect(17, 3, 18, 7, C.slate).rect(5, 15, 6, 19, C.slate).rect(17, 15, 18, 19, C.slate)
        out.append(check(s, f"thrown_desk_{f}"))
    return out, W


def beam_frames():
    """The Foreman's steel I-beam, tumbling end over end."""
    out = []
    W = 24
    for f in range(4):
        s = sprite(W, W)
        a = f * math.pi / 4
        ux, uy = math.cos(a), math.sin(a) * 0.6
        c = W / 2
        thick_line(s, c - ux * 9, c - uy * 9, c + ux * 9, c + uy * 9, 5, C.iron)
        thick_line(s, c - ux * 9, c - uy * 9 - 1, c + ux * 9, c + uy * 9 - 1, 2, C.slate)
        thick_line(s, c - ux * 8, c - uy * 8 + 1, c + ux * 8, c + uy * 8 + 1, 1, C.coal)
        for t in (-6, 0, 6):
            s.px(round(c + ux * t), round(c + uy * t - 1), C.stone)
        out.append(check(s, f"thrown_beam_{f}"))
    return out, W


def record_frames():
    """The DJ's records: a coal disc, its grooves, a hot label whose shine goes round."""
    out = []
    W = 14
    for f in range(4):
        s = sprite(W, W)
        c = W // 2
        s.circle(c, c, 5, C.coal, fill=True).circle(c, c, 5, C.ink)
        s.circle(c, c, 3, C.iron)
        s.circle(c, c, 1, C.hot, fill=True)
        s.px(c, c, C.ink)
        gx, gy = [(-3, -3), (3, -3), (3, 3), (-3, 3)][f]
        s.px(c + gx, c + gy, C.slate).px(c + gx // 3 * 2, c + gy, C.slate)
        out.append(check(s, f"thrown_record_{f}"))
    return out, W


def coin():
    s = sprite(7, 7)
    s.circle(3, 3, 3, C.gold, fill=True).circle(3, 3, 3, C.amber)
    s.px(2, 2, C.shine).px(3, 1, C.shine).px(2, 1, C.shine).rect(4, 3, 4, 4, C.amber)
    frames = [check(s, "coin0")]
    t = sprite(7, 7)
    t.rect(1, 1, 5, 5, C.amber).rect(2, 1, 4, 5, C.gold).rect(2, 0, 4, 0, C.amber).rect(2, 6, 4, 6, C.amber)
    t.px(2, 1, C.shine).px(2, 2, C.shine)
    e = sprite(7, 7)
    e.rect(3, 0, 3, 6, C.amber).rect(4, 1, 4, 5, C.gold).px(4, 1, C.shine)
    frames += [check(t, "coin1"), check(e, "coin2"), check(t, "coin3")]
    return frames


def strip(frames, w, h):
    im = Image.new("RGBA", (w * len(frames), h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        im.paste(f.composite(), (i * w, 0))
    return im


def main():
    EXPORT.mkdir(exist_ok=True)
    PREVIEW.mkdir(exist_ok=True)
    manifest = []
    rows = []
    for kind in DRAW:
        fr = held(kind)
        im = strip(fr, CELL, CELL)
        im.save(EXPORT / f"held_{kind}.png")
        manifest.append({"name": f"held_{kind}", "file": f"held_{kind}.png", "frame": [CELL, CELL], "frames": 16, "pivot": [PIV, PIV]})
        rows.append(im)
        it = floor_item(kind)
        it.save_png(EXPORT / f"item_{kind}.png")
        manifest.append({"name": f"item_{kind}", "file": f"item_{kind}.png", "frame": [CELL, CELL], "frames": 1, "pivot": [PIV, PIV + 1]})
    desk, W = desk_frames()
    strip(desk, W, W).save(EXPORT / "thrown_desk.png")
    manifest.append({"name": "thrown_desk", "file": "thrown_desk.png", "frame": [W, W], "frames": 4, "pivot": [W // 2, W // 2 + 2]})
    for name, make in (("thrown_beam", beam_frames), ("thrown_record", record_frames)):
        fr, W = make()
        strip(fr, W, W).save(EXPORT / f"{name}.png")
        manifest.append({"name": name, "file": f"{name}.png", "frame": [W, W], "frames": 4, "pivot": [W // 2, W // 2]})
    c = coin()
    strip(c, 7, 7).save(EXPORT / "coin.png")
    manifest.append({"name": "coin", "file": "coin.png", "frame": [7, 7], "frames": 4, "pivot": [3, 3]})
    (EXPORT / "sprites.json").write_text(json.dumps({"sprites": manifest}, indent=1))

    sheet = Image.new("RGBA", (CELL * 16 + 8, CELL * len(rows) + 8), C.paper)
    for i, r in enumerate(rows):
        sheet.alpha_composite(r, (4, 4 + i * CELL))
    sheet.resize((sheet.width * 4, sheet.height * 4), Image.NEAREST).save(PREVIEW / "held_x4.png")
    print("wrote", len(manifest), "sprites")


if __name__ == "__main__":
    main()
