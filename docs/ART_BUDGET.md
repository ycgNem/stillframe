# PixelLab budget

**Cap for this project: 100 generations.** Never exceed it without asking the user first. The PixelLab
account has more (1,344.9 left on 2026-10-22, resets 2026-11-09), but that allowance is shared with
every other project; this project gets 100.

**Spent so far: 0 / 100.** Every chapter's art, 1 to 5, was made by hand in build scripts.

## Rules

1. **Hand-make first.** pixel-art-studio is free; use it for everything that is not a character
   rotation or a character animation. The SUPERHOT look (flat white geometry, simple props, ink
   items) is quick to draw by hand.
2. **Before any PixelLab call**, add a row to the ledger below with the estimated cost. **After it**,
   fill in the actual cost from the tool's receipt (charges come back with every job).
3. **Characters: hand-draw the south-facing sprite, then rotate with v3** (≈2 generations) instead of
   generating from text.
4. **Animate 5 directions, mirror 3.** S, SE, E, NE, N; SW, W, NW are flipped copies.
5. **No idle animations** (time is frozen when you're idle) and **no death animations** (reds
   shatter procedurally).
6. **Never** use pro modes, `create_font`, `create_ui_asset`, `edit_image`, `create_1_direction_object`
   or `create_8_direction_object` (10–25 each) without asking.
7. **Free tools are free:** `pixelart_workbench` and `vfx_workbench` cost nothing for subscribers, and
   neither do status/list/get calls or `get_balance`.
8. A bad result is not a reason to reroll blindly. First try fixing it by hand in the build script.
   Rerolls come out of the reserve.

## Costs (from PixelLab's help, 2026-10-22)

| Call | Generations |
|---|---|
| `create_character` standard (4 or 8 directions) | 1 |
| `create_character` v3 (incl. rotating a reference sprite) | 2–9 by size (≈2 at our 32 px) |
| `animate_character` template, per direction (canvas ≤ ~92 px) | 1 |
| `animate_character` v3 custom, per direction | ceil(w·h·frames / 65,536), min 1 |
| `create_image_pixflux` (props, with `color_image` as a forced palette) | 1 |
| `create_topdown_tileset` standard | 1–4, usually 3–4 |
| pro modes, objects, UI assets, fonts, `edit_image` | 10–25 (don't) |

## Plan (100)

| Phase | Item | Call | Est. |
|---|---|---|---|
| Probe (M6) | Size check: does a 24–32 px rotated sprite survive? (becomes the player if good) | v3 rotate | (in A1) |
| **A. Chapter 1 (M6)** | A1 Player: rotate hand-drawn south sprite | v3 + reference | 2 |
| | A2 Player walk (S, SE, E, NE, N) | template `walking-6-frames` | 5 |
| | A3 Player punch | template `cross-punch` or `lead-jab` | 5 |
| | A4 Player throw | template `throw-object` | 5 |
| | A5 Grunt: rotate hand-drawn south sprite | v3 + reference | 2 |
| | A6 Grunt walk | template | 5 |
| | A7 Grunt punch | template | 5 |
| | *Phase A* | | *29* |
| **B. Chapters 2–5 (M9–M10)** | B1 Brute: rotate + walk | v3 + template | 7 |
| | B2 Runner: rotate + run | v3 + `running-6-frames` | 7 |
| | B3 Sniper: rotate (static aim pose) | v3 | 2 |
| | B4 Bosses: two rotated + walking (Conductor, Foreman); Manager, DJ and The Frame hand-made | v3 + template | 14 |
| | Gunner, Mirror, Splitter | hand-made recolors / overlays of the Grunt | 0 |
| | *Phase B* | | *30* |
| **C. Props** | ~10 props that are tedious by hand (vending machine, server rack, turnstile, train door…), `color_image` = our palette | pixflux | 10 |
| **D. Tilesets** | Optional: subway and rooftop floors if hand-made ones fall short | standard tileset | 8 |
| **Probes** | One-off style tests before committing a family | pixflux / standard | 3 |
| **Reserve** | Rerolls and fixes | | 20 |
| | **Total** | | **100** |

## Ledger

| Date | Asset | Call | Est. | Actual | Running total | Notes |
|---|---|---|---|---|---|---|
| — | — | — | — | — | 0 | nothing spent yet |
| 2026-10-22 | Phases B–D (chapters 2–5: Runner, Sniper, Mirror, Splitter, Shard, Conductor, Foreman, DJ, the Frame's eyes; SMG, rifle, katana, beam, record; turnstile, pillar, bench, girders, crate, speakers, DJ desk; subway, roof, club and core tiles) | none | 0 | 0 | 0 | all hand-made instead: `pixel-art/actors/build.py` and `pixel-art/items/build.py` for sprites, `src/render/level.ts` for tiles and props. Phase B's 30 and phases C–D's 18 are unspent |
