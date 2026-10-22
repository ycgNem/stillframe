"""Characters for Stillframe (docs/STYLE.md §3–5): the player and the reds, drawn by code.

Every character is one parametric mannequin: head, neck, shoulders, torso, two arms, two legs. Each kind
changes the proportions and the details (the player's cyan visor, the grunt's cut-crystal crown, the
gunner's goggle band, the brute's bulk, the Manager's tie, the Runner's fin, the Sniper's hood and lens,
the Mirror's polished plate, the Splitter's crack, the Conductor's cap, the Foreman's hard hat, the DJ's
headphones). The Frame's eyes are not people: `eye()` draws them separately. Five directions are drawn (S, SE, E, NE, N);
the game mirrors the west side. Seven frames each: 0 stand, 1-4 walk (contact, pass, contact, pass),
5 windup, 6 strike.

Light from the top-left: lit planes on the left and top, shadow on the right, a crease between torso
and legs. Players are outlined in ink, reds in wine (their own darkest), which keeps them glassy.

Run from the repo root: python pixel-art/actors/build.py
"""
import json
import sys
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "common"))
from sf import C, check, sprite  # noqa: E402

EXPORT = HERE / "export"
PREVIEW = HERE / "preview"
DIRS = ["s", "se", "e", "ne", "n"]
FRAMES = 7


class Kind:
    def __init__(self, name, cell, pal, head=(6, 6), torso=(7, 7), shoulders=9, leg=(3, 7), arm=6, armw=1, neck=True):
        self.name, self.cell, self.pal = name, cell, pal
        self.head, self.torso, self.shoulders, self.leg, self.arm, self.armw = head, torso, shoulders, leg, arm, armw
        self.neck = neck
        self.feet = cell - 3
        self.cx = cell // 2


PLAYER_PAL = dict(base=C.fog, light=C.paper, dark=C.ash, deep=C.stone, outline=C.ink)
RED_PAL = dict(base=C.red, light=C.hot, dark=C.blood, deep=C.wine, outline=C.wine)

KINDS = [
    Kind("player", 32, PLAYER_PAL),
    Kind("grunt", 32, RED_PAL),
    Kind("gunner", 32, RED_PAL, torso=(7, 7), shoulders=9),
    Kind("brute", 40, RED_PAL, head=(7, 7), torso=(11, 9), shoulders=17, leg=(4, 8), arm=10, armw=3, neck=False),
    Kind("manager", 48, RED_PAL, head=(9, 9), torso=(13, 12), shoulders=19, leg=(5, 10), arm=12, armw=3),
    Kind("runner", 32, RED_PAL, head=(5, 5), torso=(5, 6), shoulders=7, leg=(2, 8), arm=6),
    Kind("sniper", 32, RED_PAL, head=(6, 6), torso=(7, 8), shoulders=9, leg=(3, 8)),
    Kind("mirror", 32, RED_PAL, torso=(8, 7), shoulders=10),
    Kind("splitter", 32, RED_PAL, head=(7, 6), torso=(9, 8), shoulders=11, leg=(3, 7), armw=2),
    Kind("shardling", 24, RED_PAL, head=(4, 4), torso=(5, 4), shoulders=6, leg=(2, 4), arm=4),
    Kind("conductor", 48, RED_PAL, head=(9, 9), torso=(13, 12), shoulders=19, leg=(5, 10), arm=12, armw=3),
    Kind("foreman", 48, RED_PAL, head=(9, 8), torso=(15, 12), shoulders=21, leg=(5, 10), arm=12, armw=4, neck=False),
    Kind("dj", 40, RED_PAL, head=(8, 8), torso=(11, 9), shoulders=15, leg=(4, 8), arm=9, armw=2),
]
EYE_CELL = 24


def box(s, x0, y0, x1, y1, c):
    if x1 >= x0 and y1 >= y0:
        s.rect(x0, y0, x1, y1, c)


def draw(k, d, f):
    """One frame: kind k, direction d, frame f. Returns a checked Sprite."""
    s = sprite(k.cell, k.cell)
    p = k.pal
    cx, feet = k.cx, k.feet
    hw, hh = k.head
    tw, th = k.torso
    lw, lh = k.leg
    side = d in ("e",)
    three = d in ("se", "ne")
    back = d in ("n", "ne")

    # walk: contact frames 1 and 3 (legs apart), passing frames 2 and 4 (together, body up 1)
    bob = -1 if f in (2, 4) else 0
    stride = {1: 1, 3: -1}.get(f, 0)
    lean = {5: -1, 6: 1}.get(f, 0)          # windup leans back, strike leans in
    top = feet - lh - th + bob               # top of the torso
    ux = cx + (lean if (side or three) else 0)   # upper-body x

    # ---- legs (behind the torso)
    if side:
        # one leg forward, one back; the far leg darker
        fwd, bk = (2 * stride, -2 * stride)
        box(s, cx - lw // 2 + bk, feet - lh + 1, cx - lw // 2 + bk + lw - 1, feet - (1 if stride else 0), p["dark"])
        box(s, cx - lw // 2 + fwd, feet - lh + 1, cx - lw // 2 + fwd + lw - 1, feet, p["base"])
        box(s, cx - lw // 2 + fwd, feet - lh + 1, cx - lw // 2 + fwd, feet, p["light"])
        box(s, cx - lw // 2 + fwd + lw, feet, cx - lw // 2 + fwd + lw, feet, p["base"])  # toe
    else:
        gap = 1
        lx0 = cx - gap // 2 - lw - (0 if lw % 2 else 0)
        rx0 = cx + 1
        off = 1 if three else 0
        lift_l = 1 if stride < 0 else 0
        lift_r = 1 if stride > 0 else 0
        box(s, lx0 + off, feet - lh + 1, lx0 + off + lw - 1, feet - lift_l, p["base"])
        box(s, rx0 + off, feet - lh + 1, rx0 + off + lw - 1, feet - lift_r, p["base"] if not three else p["dark"])
        box(s, lx0 + off, feet - lh + 1, lx0 + off, feet - lift_l - 1, p["light"])
        box(s, rx0 + off + lw - 1, feet - lh + 1, rx0 + off + lw - 1, feet - lift_r, p["dark"])
        box(s, lx0 + off, feet - lift_l, lx0 + off + lw - 1, feet - lift_l, p["deep"])
        box(s, rx0 + off, feet - lift_r, rx0 + off + lw - 1, feet - lift_r, p["deep"])

    # ---- far arm (behind the torso in side and 3/4 views)
    swing = {1: -1, 3: 1}.get(f, 0)
    if side or three:
        ax = ux - (tw // 2) - (0 if side else 1)
        box(s, ax - swing - k.armw + 1, top + 2, ax - swing, top + 1 + k.arm, p["dark"])

    # ---- torso and shoulders
    t0 = ux - tw // 2 + (0 if not side else 1)
    t1 = t0 + tw - 1 - (1 if side else 0) - (1 if three else 0)
    box(s, t0, top + 1, t1, top + th, p["base"])
    sh0 = ux - k.shoulders // 2 + (2 if side else 1 if three else 0)
    sh1 = sh0 + k.shoulders - 1 - (4 if side else 2 if three else 0)
    box(s, sh0, top, sh1, top + 1 + (1 if k.cell > 32 else 0), p["base"])
    # light on the left plane, shadow on the right, a hip crease
    box(s, t0, top + 1, t0 + max(1, tw // 4) - 1, top + th - 2, p["light"])
    box(s, sh0, top, sh0 + max(2, k.shoulders // 3), top, p["light"])
    box(s, t1, top + 2, t1, top + th, p["dark"])
    box(s, t0 + 1, top + th, t1, top + th, p["dark"])

    # ---- near arm(s)
    if side:
        if f == 6:      # strike: the arm shoots forward at shoulder height
            box(s, ux, top + 2, ux + 5 + k.arm // 3, top + 3, p["base"])
            box(s, ux + 5 + k.arm // 3, top + 2, ux + 6 + k.arm // 3, top + 4, p["light"])
        elif f == 5:    # windup: pulled back
            box(s, ux - 3, top + 2, ux - 1, top + 3, p["base"])
            box(s, ux - 4, top + 1, ux - 3, top + 4, p["light"])
        else:
            box(s, ux + swing, top + 2, ux + swing + k.armw - 1, top + 1 + k.arm, p["base"])
            box(s, ux + swing, top + 2, ux + swing, top + 1 + k.arm, p["light"])
            box(s, ux + swing, top + 1 + k.arm, ux + swing + k.armw, top + 1 + k.arm, p["base"])
    else:
        aw = k.armw
        la = sh0 - aw
        ra = sh1 + 1
        lsw, rsw = (swing, -swing) if not back else (-swing, swing)
        if f == 6:
            # strike toward the viewer (S) or away (N): a fist in front of the chest
            box(s, la, top + 1, la, top + k.arm - 1, p["light"])
            fx = cx + (2 if three else 0)
            if back:
                box(s, ra, top + 1, ra, top + 3, p["dark"])
            else:
                box(s, fx - 1, top + 3, fx + 2, top + 5, p["light"])
                box(s, fx - 1, top + 5, fx + 2, top + 5, p["base"])
        elif f == 5:
            box(s, la, top + 1, la, top + k.arm - 2, p["light"])
            box(s, ra, top, ra + 1, top + 3, p["dark"])
        else:
            box(s, la, top + 1 + max(0, lsw), la + aw - 1, top + k.arm + lsw, p["base"])
            box(s, la, top + 1 + max(0, lsw), la, top + k.arm + lsw, p["light"])
            box(s, ra, top + 1 + max(0, rsw), ra + aw - 1, top + k.arm + rsw, p["base"])
            box(s, ra + aw - 1, top + 1 + max(0, rsw), ra + aw - 1, top + k.arm + rsw, p["dark"])
            if aw > 1:
                # fists
                box(s, la - 1, top + k.arm + lsw - 1, la + aw - 1, top + k.arm + lsw + 1, p["base"])
                box(s, ra, top + k.arm + rsw - 1, ra + aw, top + k.arm + rsw + 1, p["dark"])

    # ---- neck and head
    hx = ux + (1 if side else 1 if three else 0)
    hy1 = top - 1 + (0 if k.neck else 2)
    hy0 = hy1 - hh + 1
    box(s, hx - 1, top - 1, hx + 1 - (1 if side else 0), top, p["dark"])
    h0 = hx - hw // 2 + (1 if side else 0)
    h1 = h0 + hw - 1 - (1 if side else 0) + (1 if side and k.cell == 32 else 0)
    box(s, h0, hy0, h1, hy1 - 1, p["base"])
    box(s, h0 + 1, hy0 - 1, h1 - 1, hy0 - 1, p["base"])          # rounded cap
    box(s, h0 + 1, hy1, h1 - 1, hy1, p["base"])                  # jaw
    box(s, h0, hy0, h0, hy1 - 2, p["light"])
    box(s, h0 + 1, hy0 - 1, h0 + max(1, hw // 2), hy0 - 1, p["light"])
    box(s, h1, hy0 + 1, h1, hy1 - 1, p["dark"])
    box(s, h0 + 1, hy1, h1 - 1, hy1, p["dark"])

    details(s, k, d, f, h0, h1, hy0, hy1, t0, t1, top, ux, back, side, three)
    s.outline(p["outline"], where="outside")
    if k.name == "player":
        visor(s, k, d, h0, h1, hy0, back, side, three)
    return check(s, f"{k.name}_{d}_{f}")


def details(s, k, d, f, h0, h1, hy0, hy1, t0, t1, top, ux, back, side, three):
    p = k.pal
    if k.name != "player":
        # facets: a hard crease across the chest and glints catching the light
        if not back:
            s.line(t0 + 2, top + 2, t1 - 1, top + 4 + (k.torso[1] // 3), p["dark"])
        s.px(h0 + 1, hy0, C.glint)
        s.px(t0 + 1, top + 1, C.glint)
        if k.cell > 32:
            s.px(h0 + 2, hy0, C.glint)
            s.px(t0 + 2, top + 1, C.glint)
    if k.name in ("grunt", "shardling"):
        # a cut-crystal crown: the head narrows to a point
        s.px(h0, hy0 - 1, None)
        s.px(h1, hy0 - 1, None)
        mid = (h0 + h1) // 2
        s.px(mid, hy0 - 2, p["light"])
    if k.name == "gunner":
        # a goggle band: the shooter's mark
        if not back:
            s.rect(h0, hy0 + 2, h1, hy0 + 2, p["deep"])
            if not side:
                s.px(h0 + 1, hy0 + 2, C.glint)
        else:
            s.rect(h0, hy0 + 2, h1, hy0 + 2, p["deep"])
        s.rect(h0 + 1, hy0 - 2, h1 - 1, hy0 - 2, p["dark"])   # flat top
    if k.name == "brute":
        # heavy brow and knuckles
        if not back:
            s.rect(h0 + 1, hy0 + 2, h1 - 1, hy0 + 2, p["dark"])
    if k.name == "manager":
        # a suit: lapels and a tie in the deepest red
        if not back and not side:
            mid = (t0 + t1) // 2
            s.rect(mid - 1, top + 1, mid + 1, top + 2, p["deep"])                 # knot
            s.rect(mid, top + 3, mid, top + k.torso[1] - 2, p["deep"])            # tie
            s.rect(mid - 1, top + 5, mid + 1, top + k.torso[1] - 3, p["deep"])
            s.px(mid, top + k.torso[1] - 1, p["deep"])
            s.line(t0 + 1, top + 1, mid - 3, top + 6, p["dark"])                 # lapels
            s.line(t1 - 1, top + 1, mid + 3, top + 6, p["dark"])
            s.px(t0 + 2, top + 8, C.glint)
        elif side:
            s.rect(t1 - 1, top + 1, t1 - 1, top + 6, p["deep"])
        # slicked glass hair
        s.rect(h0, hy0 - 1, h1, hy0, p["dark"])
        s.px(h0 + 2, hy0 - 1, C.glint)
    if k.name == "runner":
        # a fin swept back off the head: it leans into the run
        if side:
            s.line(h0 - 1, hy0, h0 - 3, hy0 + 2, p["light"])
            s.px(h0 - 2, hy0, p["base"])
        elif back:
            s.rect((h0 + h1) // 2, hy0 - 2, (h0 + h1) // 2, hy1 - 1, p["light"])
        else:
            s.rect((h0 + h1) // 2, hy0 - 2, (h0 + h1) // 2, hy0, p["light"])
        # a streak down the leading side
        s.line(t0, top + 2, t0, top + k.torso[1] - 1, p["light"])
    if k.name == "sniper":
        # a hood, and one lens where an eye would be
        s.rect(h0 - 1, hy0 - 1, h1 + 1, hy0 + 1, p["deep"])
        s.rect(h0 - 1, hy0 + 2, h0 - 1, hy1, p["deep"])
        if not side:
            s.rect(h1 + 1, hy0 + 2, h1 + 1, hy1, p["deep"])
        if not back:
            lx = h1 - 1 if (side or three) else (h0 + h1) // 2
            s.rect(lx - 1, hy0 + 2, lx + 1, hy0 + 4, p["deep"])
            s.px(lx, hy0 + 3, C.glint)
        # a long coat to the knees
        s.rect(t0, top + k.torso[1], t1, top + k.torso[1] + 2, p["dark"])
    if k.name == "mirror":
        # a polished face and a polished plate: what you shoot at comes back
        if not back:
            fx0 = h0 + 1 if not side else h1 - 2
            s.rect(fx0, hy0 + 1, fx0 + (2 if side else h1 - h0 - 2), hy0 + 3, C.glint)
            s.rect(fx0, hy0 + 3, fx0 + (2 if side else h1 - h0 - 2), hy0 + 3, p["light"])
            mid = (t0 + t1) // 2 + (1 if side else 0)
            cy = top + 3
            for dy, w in ((0, 0), (1, 1), (2, 2), (3, 1), (4, 0)):
                s.rect(mid - w, cy + dy, mid + w, cy + dy, C.glint)
            s.px(mid, cy + 2, p["light"])
        else:
            s.rect(t0 + 1, top + 2, t1 - 1, top + 2, p["light"])
    if k.name == "splitter":
        # a crack from crown to hips: hit it and it comes apart along here
        mid = (t0 + t1) // 2 + (1 if side else 0)
        y = hy0 - 1
        for i, dx in enumerate((0, 1, 0, -1, 0, 1, 0, -1, 0, 1, 0, 0, -1, 0, 1, 0, 0, 0)):
            if y + i > top + k.torso[1] - 1:
                break
            s.px(mid + dx, y + i, p["deep"])
        s.px(mid + 2, top + 2, C.glint)
    if k.name == "conductor":
        # a peaked cap and a double row of buttons
        s.rect(h0 - 1, hy0 - 2, h1 + 1, hy0 - 1, p["deep"])
        s.rect(h0, hy0 - 3, h1, hy0 - 3, p["dark"])
        if not back:
            if side:
                s.rect(h1, hy0, h1 + 3, hy0, p["deep"])
            else:
                s.rect(h0, hy0, h1, hy0, p["deep"])
                s.px((h0 + h1) // 2, hy0 - 2, C.glint)
            if not side:
                for j in range(top + 3, top + k.torso[1] - 1, 3):
                    s.px((t0 + t1) // 2 - 2, j, C.glint)
                    s.px((t0 + t1) // 2 + 2, j, C.glint)
            else:
                for j in range(top + 3, top + k.torso[1] - 1, 3):
                    s.px(t1 - 2, j, C.glint)
    if k.name == "foreman":
        # a hard hat with a wide brim, and a reflective stripe round the vest
        s.rect(h0, hy0 - 3, h1, hy0, p["light"])
        s.rect(h0 + 1, hy0 - 4, h1 - 1, hy0 - 4, p["light"])
        s.rect(h0 - 2, hy0 + 1, h1 + 2, hy0 + 1, p["dark"])
        s.px(h0 + 2, hy0 - 3, C.glint)
        s.rect((h0 + h1) // 2, hy0 - 4, (h0 + h1) // 2, hy0, p["base"])
        sy = top + k.torso[1] // 2
        s.rect(t0, sy, t1, sy, C.glint)
        s.rect(t0, sy + 1, t1, sy + 1, p["deep"])
    if k.name == "dj":
        # headphones over the crown, cups on both ears, and shades
        s.rect(h0, hy0 - 2, h1, hy0 - 2, p["deep"])
        if not side:
            s.rect(h0 - 2, hy0 + 1, h0 - 1, hy0 + 4, p["deep"])
            s.rect(h1 + 1, hy0 + 1, h1 + 2, hy0 + 4, p["deep"])
            s.px(h0 - 2, hy0 + 1, C.glint)
        else:
            s.rect(h0 + 1, hy0 + 1, h0 + 3, hy0 + 4, p["deep"])
            s.px(h0 + 1, hy0 + 1, C.glint)
        if not back:
            s.rect(h0 + 1 if not side else h1 - 3, hy0 + 2, h1 - 1 if not side else h1, hy0 + 3, p["deep"])
            s.px(h0 + 2 if not side else h1 - 2, hy0 + 2, C.glint)


def eye(d, f):
    """An eye of the Frame: a red glass almond that floats above its shadow. Frame 0 shut (it shrugs off
    bullets), 1-4 open and looking along the aim, 5 the tell (wide, hot), 6 the shot (pinned pupil)."""
    s = sprite(EYE_CELL, EYE_CELL)
    p = RED_PAL
    cx, cy = EYE_CELL // 2, 11
    hw, hh = 8, 5 if f != 5 else 6
    for x in range(-hw, hw + 1):
        h = round(hh * (1 - (x / (hw + 0.5)) ** 2) ** 0.5)
        if f == 0:
            h = max(1, h // 3)
        s.rect(cx + x, cy - h, cx + x, cy + h, p["base"])
    if f == 0:
        # shut: a lid line with lashes
        s.rect(cx - hw + 1, cy, cx + hw - 1, cy, p["deep"])
        for x in (-5, -2, 1, 4):
            s.px(cx + x, cy + 2, p["dark"])
        s.px(cx - 4, cy - 1, C.glint)
    else:
        # the lid's upper rim catches the light; the lower rim sits in shadow
        for x in range(-hw + 2, hw - 1):
            h = round(hh * (1 - (x / (hw + 0.5)) ** 2) ** 0.5)
            s.px(cx + x, cy - h, p["light"])
            s.px(cx + x, cy + h, p["dark"])
        look = {"s": (0, 1), "se": (2, 1), "e": (3, 0), "ne": (2, -1), "n": (0, -2)}[d]
        drift = {1: 0, 2: 1, 3: 0, 4: -1}.get(f, 0)
        ix, iy = cx + look[0], cy + look[1]
        r = 3 if f != 6 else 2
        s.circle(ix, iy, r, p["deep"] if f != 5 else p["dark"], fill=True)
        pupil = C.glint if f in (5, 6) else p["light"]
        s.rect(ix - (0 if f == 6 else 1) + drift, iy - 1, ix + drift, iy, pupil)
        s.px(ix - 1, iy - 2, C.glint)
    s.outline(p["outline"], where="outside")
    return check(s, f"eye_{d}_{f}")


def visor(s, k, d, h0, h1, hy0, back, side, three):
    """The cyan visor: the one thing that says 'you'. Drawn after the outline so it stays crisp."""
    y = hy0 + 2
    if d == "s":
        s.rect(h0 + 1, y, h1 - 1, y, C.cyan).rect(h0 + 1, y + 1, h1 - 1, y + 1, C.tide)
    elif d == "se":
        s.rect(h0 + 2, y, h1, y, C.cyan).rect(h0 + 2, y + 1, h1, y + 1, C.tide)
    elif d == "e":
        s.rect(h1 - 2, y, h1, y, C.cyan).rect(h1 - 1, y + 1, h1, y + 1, C.tide)
    elif d == "ne":
        s.px(h1, y, C.tide)


def main():
    EXPORT.mkdir(exist_ok=True)
    PREVIEW.mkdir(exist_ok=True)
    manifest = []
    sheets = []
    for k in KINDS:
        row = []
        for d in DIRS:
            frames = [draw(k, d, f) for f in range(FRAMES)]
            strip = Image.new("RGBA", (k.cell * FRAMES, k.cell), (0, 0, 0, 0))
            for i, fr in enumerate(frames):
                strip.paste(fr.composite(), (i * k.cell, 0))
            name = f"{k.name}_{d}"
            strip.save(EXPORT / f"{name}.png")
            manifest.append({"name": name, "file": f"{name}.png", "frame": [k.cell, k.cell], "frames": FRAMES, "pivot": [k.cx, k.feet]})
            row.append(strip)
        sheets.append((k, row))
    row = []
    for d in DIRS:
        strip = Image.new("RGBA", (EYE_CELL * FRAMES, EYE_CELL), (0, 0, 0, 0))
        for f in range(FRAMES):
            strip.paste(eye(d, f).composite(), (f * EYE_CELL, 0))
        name = f"eye_{d}"
        strip.save(EXPORT / f"{name}.png")
        # the pivot sits on the floor well below the eye: it hangs in the air
        manifest.append({"name": name, "file": f"{name}.png", "frame": [EYE_CELL, EYE_CELL], "frames": FRAMES, "pivot": [EYE_CELL // 2, EYE_CELL - 1]})
        row.append(strip)
    sheets.append((Kind("eye", EYE_CELL, RED_PAL), row))
    (EXPORT / "sprites.json").write_text(json.dumps({"sprites": manifest}, indent=1))

    # a contact sheet: every kind, every direction, every frame, at 4x, on the floor color
    W = max(k.cell * FRAMES for k, _ in sheets) + 8
    H = sum(k.cell * len(DIRS) for k, _ in sheets) + 8
    sheet = Image.new("RGBA", (W, H), C.paper)
    y = 4
    for k, row in sheets:
        for strip in row:
            sheet.alpha_composite(strip, (4, y))
            y += k.cell
    sheet.resize((W * 4, H * 4), Image.NEAREST).save(PREVIEW / "contact_x4.png")
    print("wrote", len(manifest), "sprites")


if __name__ == "__main__":
    main()
