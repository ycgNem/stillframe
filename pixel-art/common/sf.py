"""Stillframe helpers for pixel-art-studio build scripts.

The palette comes from src/data/palette.json, the same file the game reads, so art and code can't
drift apart (docs/STYLE.md section 2). Import this first in every build script:

    import sys; from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "common"))
    from sf import C, sprite, check, ROOT
"""
import json
import sys
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[2]

# the repo's vendored copy of the skill if it has one, else the user-level install
_local = ROOT / ".claude/skills/pixel-art-studio/scripts"
sys.path.insert(0, str(_local if _local.exists() else Path.home() / ".claude/skills/pixel-art-studio/scripts"))
from pixelstudio import Sprite, mix, ramp  # noqa: E402,F401

PAL = json.loads((ROOT / "src/data/palette.json").read_text(encoding="utf-8"))
"""name -> '#rrggbb', in palette order"""
PALETTE = list(PAL.values())
C = SimpleNamespace(**PAL)
"""attribute access: C.ink, C.red, C.cyan …"""


def sprite(w, h):
    """A Sprite whose colors snap to the game palette."""
    return Sprite(w, h, palette=PALETTE)


def check(s, name):
    """Fail loudly if a sprite uses an off-palette color or semi-transparent pixels."""
    allowed = {tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) for h in PALETTE}
    for f in range(1, s.n_frames + 1):
        im = s.composite(f)
        for r, g, b, a in im.getdata():
            if a not in (0, 255):
                raise SystemExit(f"{name}: frame {f} has a semi-transparent pixel (alpha {a})")
            if a and (r, g, b) not in allowed:
                raise SystemExit(f"{name}: frame {f} uses off-palette #{r:02x}{g:02x}{b:02x}")
    return s
