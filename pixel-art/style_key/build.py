"""Style key v0: the first hand-made sprites that fix Stillframe's look (docs/STYLE.md).

- player_s / grunt_s: south-facing characters on 32x32 cells, feet at (16, 29). These are also the
  reference sprites PixelLab's v3 rotation will turn into 8 directions (docs/ART_BUDGET.md A1, A5).
- pistol, coin (4-frame spin), floor and wall tiles, a desk prop.
- scene: all of it together on a 160x96 mock room, the image to judge the look by.

Run from the repo root: python pixel-art/style_key/build.py
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "common"))
from sf import C, check, sprite  # noqa: E402

EXPORT = HERE / "export"
PREVIEW = HERE / "preview"


# ---------------------------------------------------------------- characters

def body(s, mid):
    """The shared mannequin silhouette, ~21 px tall, feet on row 28."""
    s.rect(14, 8, 18, 8, mid)      # head
    s.rect(13, 9, 19, 13, mid)
    s.rect(14, 14, 18, 14, mid)
    s.rect(15, 15, 17, 15, mid)    # neck
    s.rect(12, 16, 20, 17, mid)    # shoulders
    s.rect(13, 18, 19, 22, mid)    # chest to hips
    s.rect(11, 17, 11, 23, mid)    # arms, hands on row 23
    s.rect(21, 17, 21, 23, mid)
    s.rect(13, 23, 15, 28, mid)    # legs
    s.rect(17, 23, 19, 28, mid)


def player():
    s = sprite(32, 32)
    body(s, C.fog)
    # light from the top-left: lit head cap, lit left shoulder and arm, lit left leg edge
    s.rect(14, 8, 16, 8, C.paper).rect(13, 9, 15, 10, C.paper).px(13, 11, C.paper)
    s.rect(12, 16, 15, 16, C.paper).rect(12, 17, 13, 17, C.paper).rect(13, 18, 13, 20, C.paper)
    s.rect(11, 17, 11, 20, C.paper)
    s.rect(13, 23, 13, 26, C.paper)
    # shadow side: right of head, under the chin, right of the torso, right arm and leg
    s.rect(19, 10, 19, 13, C.ash).rect(15, 14, 18, 14, C.ash)
    s.rect(15, 15, 17, 15, C.ash)
    s.rect(19, 18, 19, 22, C.ash).rect(18, 21, 18, 22, C.ash).rect(20, 17, 20, 17, C.ash)
    s.rect(21, 18, 21, 23, C.ash)
    s.rect(18, 23, 19, 28, C.ash).rect(15, 24, 15, 28, C.ash)
    # hip line and feet in the deepest value, so the legs read as separate from the torso
    s.rect(14, 22, 18, 22, C.ash)
    s.rect(13, 28, 15, 28, C.stone).rect(17, 28, 19, 28, C.stone)
    s.px(11, 23, C.ash).px(21, 23, C.stone)
    # the cyan visor: the one thing that says "you"
    s.rect(14, 11, 18, 11, C.cyan).rect(14, 12, 18, 12, C.tide)
    s.outline(C.ink, where="outside")
    return check(s, "player_s")


def grunt():
    s = sprite(32, 32)
    body(s, C.red)
    # a cut-crystal crown: the head narrows to a 3 px top instead of the player's rounded 5
    s.px(14, 8, None).px(18, 8, None)
    # facets, not soft shading: one lit plane top-left, a hard crease, one shadow plane bottom-right
    s.rect(15, 8, 16, 8, C.hot).rect(13, 9, 16, 9, C.hot).rect(13, 10, 15, 10, C.hot).px(13, 11, C.hot)
    s.rect(18, 12, 19, 13, C.blood).rect(17, 13, 17, 14, C.blood).px(18, 14, C.blood).px(19, 11, C.blood)
    s.rect(12, 16, 16, 16, C.hot).rect(12, 17, 15, 17, C.hot).rect(13, 18, 14, 18, C.hot).px(13, 19, C.hot)
    s.px(11, 17, C.hot)
    s.line(16, 18, 19, 21, C.blood)            # the crease across the chest
    s.rect(19, 19, 19, 22, C.blood).rect(17, 22, 18, 22, C.blood)
    s.px(20, 17, C.blood).rect(21, 18, 21, 23, C.blood)
    s.rect(13, 23, 13, 26, C.hot)
    s.rect(18, 23, 19, 28, C.blood).rect(15, 25, 15, 28, C.blood)
    s.rect(13, 28, 15, 28, C.wine).rect(17, 28, 19, 28, C.wine)
    # glints: the glass catching the light
    s.px(14, 9, C.glint).px(15, 8, C.glint).px(12, 16, C.glint)
    s.outline(C.wine, where="outside")
    return check(s, "grunt_s")


# ---------------------------------------------------------------- items

def pistol():
    s = sprite(14, 9)
    s.rect(3, 2, 12, 3, C.ink)           # slide
    s.px(12, 1, C.ink)                   # front sight
    s.rect(3, 4, 9, 4, C.ink)            # frame
    s.rect(3, 5, 5, 5, C.ink).rect(2, 6, 4, 7, C.ink)   # grip, raked back
    s.px(7, 5, C.ink).px(8, 5, C.ink)    # trigger guard
    s.rect(4, 2, 9, 2, C.slate)          # lit top edge
    s.px(3, 5, C.iron).px(2, 6, C.iron)  # lit grip edge
    return check(s, "pistol")


def coin():
    s = sprite(7, 7)
    # frame 1: face on
    s.circle(3, 3, 3, C.gold, fill=True).circle(3, 3, 3, C.amber)
    s.px(2, 2, C.shine).px(3, 1, C.shine).px(2, 1, C.shine).rect(4, 3, 4, 4, C.amber)
    # frame 2: turning
    s.add_frame(copy=False)
    s.rect(1, 1, 5, 5, C.amber).rect(2, 1, 4, 5, C.gold)
    s.rect(2, 0, 4, 0, C.amber).rect(2, 6, 4, 6, C.amber)
    s.px(2, 1, C.shine).px(2, 2, C.shine)
    # frame 3: edge on
    s.add_frame(copy=False)
    s.rect(3, 0, 3, 6, C.amber).rect(4, 1, 4, 5, C.gold).px(4, 1, C.shine)
    # frame 4: turning back (a copy of frame 2)
    s.frame(2)
    s.add_frame(copy=True)
    s.set_duration(110, "all")
    return check(s, "coin")


# ---------------------------------------------------------------- tiles and props

def floor_tile():
    s = sprite(16, 16)
    s.rect(0, 0, 15, 15, C.paper)
    s.rect(15, 0, 15, 15, C.fog).rect(0, 15, 15, 15, C.fog)
    return check(s, "tile_floor")


def wall_tile():
    """A wall cell: 16x16 top face plus the 8 px south face it shows over the floor below."""
    s = sprite(16, 24)
    s.rect(0, 0, 15, 15, C.fog)
    s.rect(0, 0, 15, 0, C.paper)          # lit top edge only, so a row of walls reads as one wall
    s.rect(0, 15, 15, 15, C.ash)
    s.rect(0, 16, 15, 19, C.ash).rect(0, 20, 15, 22, C.stone).rect(0, 23, 15, 23, C.slate)
    return check(s, "tile_wall")


def desk():
    s = sprite(32, 24)
    s.rect(0, 4, 31, 15, C.fog)                         # top surface
    s.rect(0, 4, 31, 4, C.paper).rect(0, 4, 0, 15, C.paper)
    s.rect(0, 16, 31, 18, C.ash).rect(0, 18, 31, 18, C.stone)   # front edge
    s.rect(1, 19, 2, 22, C.stone).rect(29, 19, 30, 22, C.stone)  # legs
    s.rect(1, 22, 2, 22, C.slate).rect(29, 22, 30, 22, C.slate)
    # papers (world, light) and a mug (ink: you can throw it)
    s.rect(5, 6, 12, 11, C.paper).rect(6, 7, 13, 12, C.paper).rect(13, 8, 13, 12, C.ash).rect(6, 12, 13, 12, C.ash)
    s.rect(8, 8, 11, 8, C.ash).rect(8, 10, 10, 10, C.ash)
    s.rect(23, 6, 26, 10, C.ink).px(27, 7, C.ink).px(27, 8, C.ink).px(24, 6, C.slate).px(24, 7, C.iron)
    return check(s, "desk")


# ---------------------------------------------------------------- the mock room

def scene(paths):
    s = sprite(160, 96)
    for ty in range(1, 6):
        for tx in range(10):
            s.paste_png(paths["tile_floor"], tx * 16, ty * 16)
    for tx in range(10):
        s.paste_png(paths["tile_wall"], tx * 16, 0)

    def shadow(x, y):
        """Drop shadow for a 32x32 character cell at (x, y): down-right of the feet (light is top-left)."""
        s.ellipse(x + 11, y + 28, x + 22, y + 31, C.ash)

    shadow(30, 50)
    s.paste_png(paths["player_s"], 30, 50)
    shadow(98, 20)
    s.paste_png(paths["grunt_s"], 98, 20)
    s.rect(101, 66, 132, 67, C.ash)            # the desk's shadow
    s.paste_png(paths["desk"], 100, 46)
    s.rect(19, 85, 31, 85, C.ash)
    s.paste_png(paths["pistol"], 18, 78)

    # a red's bullet in flight toward the player, and the player's shot toward the grunt
    s.line(92, 48, 85, 52, C.red).px(84, 53, C.hot).px(83, 53, C.hot)
    s.line(66, 54, 73, 51, C.ink)

    # a red mid-shatter: chunks of its own colors (2-3 px facets, a few glints) flying apart, coins popping out
    shards = [
        (62, 32, [(0, 0), (1, 0), (0, 1)], C.red), (73, 27, [(0, 0), (0, 1), (1, 1)], C.hot),
        (77, 35, [(0, 0), (1, 1)], C.blood), (58, 38, [(0, 0), (1, 0)], C.red),
        (69, 41, [(0, 0), (1, 0), (1, 1)], C.blood), (80, 30, [(0, 0), (1, 0)], C.wine),
        (66, 25, [(0, 0), (0, 1)], C.red), (74, 42, [(0, 0)], C.glint), (57, 30, [(0, 0)], C.glint),
        (71, 35, [(0, 0), (1, 0)], C.hot),
    ]
    for x, y, cells, c in shards:
        for dx, dy in cells:
            s.px(x + dx, y + dy, c)
    s.paste_png(paths["coin_f1"], 66, 30)
    s.paste_png(paths["coin_f2"], 75, 22)
    return check(s, "scene")


def main():
    EXPORT.mkdir(exist_ok=True)
    PREVIEW.mkdir(exist_ok=True)
    paths = {}
    for name, make in [("player_s", player), ("grunt_s", grunt), ("pistol", pistol), ("tile_floor", floor_tile),
                       ("tile_wall", wall_tile), ("desk", desk)]:
        spr = make()
        paths[name] = EXPORT / f"{name}.png"
        spr.save_png(paths[name])
        spr.preview(PREVIEW / f"{name}.png", scale=10, labels=False)
        if name in ("player_s", "grunt_s"):
            spr.save_silhouette(PREVIEW / f"{name}_silhouette.png")

    c = coin()
    c.save_spritesheet(EXPORT / "coin.png", layout="horizontal")
    c.save_gif(PREVIEW / "coin.gif", scale=10)
    c.preview(PREVIEW / "coin.png", scale=10)
    # single frames for the scene only; the game uses the sheet
    for f in (1, 2):
        paths[f"coin_f{f}"] = PREVIEW / f"_coin_f{f}.png"
        c.save_png(paths[f"coin_f{f}"], frame=f)

    sc = scene(paths)
    sc.save_png(EXPORT / "scene.png")
    sc.save_png(PREVIEW / "scene_x4.png", scale=4)
    sc.save_png(PREVIEW / "scene_x2.png", scale=2)
    sc.save_swatch(PREVIEW / "palette.png")
    sc.stats()


if __name__ == "__main__":
    main()
