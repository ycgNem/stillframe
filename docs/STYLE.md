# Stillframe — Art style and sprite contract

**SUPERHOT, in pixels.** A clean white world, red glass enemies, black things you can pick up. We add
two colors SUPERHOT doesn't have: **gold** for coins and **cyan** for you and for time.

Art is made two ways (details in §7):
- **pixel-art-studio** (the Claude skill, Python + Pillow, free): the default for everything.
- **PixelLab** (AI, metered): only where it saves the most hand work, mainly rotating and animating
  characters into 8 directions. **Hard cap: 100 generations for this project**, tracked in
  [ART_BUDGET.md](ART_BUDGET.md).

The style key, the first hand-made sprites that fix the look, is in `pixel-art/style_key/` (its
`preview/` folder has a scaled contact sheet).

---

## 1. Canvas and view

- **320×180 game pixels**, shown at whole-number device scales only (×4 at 720p, ×6 at 1080p, ×8 at
  1440p). `imageSmoothingEnabled = false`; everything lands on whole pixels.
- **Tiles 16×16.** View is **¾ top-down** ("low top-down" in PixelLab terms): floors seen from above,
  walls show an 8 px south face, characters stand upright.
- **Light from the top-left.** Drop shadows fall down-right: a 1 px offset blob in `ash` on the floor.
- **No semi-transparent pixels** in sprites: alpha is 0 or 255. Glows and fades are dithered.

## 2. Palette (18 colors, `src/data/palette.json`)

Every pixel of every sprite is one of these. Code draws only with `PAL.<name>`.

| Role | Names | Hex |
|---|---|---|
| **World** (floors, walls, props) | paper · fog · ash · stone · slate · iron · coal | `#f4f4f2` `#dcdcd8` `#bfc1c2` `#9a9ea3` `#747a82` `#50565f` `#2e323a` |
| **Ink** (items you can use, outlines, text) | ink | `#14161a` |
| **Reds** (enemies, enemy bullets, danger) | wine · blood · red · hot · glint | `#4a0d1f` `#8c1428` `#d42a2a` `#ff5a3c` `#ffd0c0` |
| **You and time** (player visor, trail, time meter) | tide · cyan | `#1e7f9a` `#3fd0e0` |
| **Coins** | amber · gold · shine | `#8a5a14` `#e0a526` `#ffe27a` |

### Color roles are exclusive
- **Red means danger.** Only reds, their bullets, their aim tells and hazards use the red ramp.
- **Ink means "you can use this."** Weapons, throwables and doors you can open are ink silhouettes with
  one `slate`/`stone` highlight. The world never uses ink except for text and outlines.
- **Gold means coins.** Nothing else is warm yellow.
- **Cyan means you.** The player's visor, dash trail, Rewind, and the time meter. Nothing else.
- The **world stays light** (paper → slate). Big dark areas are only the void outside the level.

## 3. Sizes

| Thing | Size | Notes |
|---|---|---|
| Characters (player, reds) | ~22 px tall on a 32×32 cell | feet at the cell's bottom center (pivot 16, 30) |
| Brute, bosses | up to 32 / 48 px tall | same pivot rule |
| Items on the floor | ≤ 12×12 | ink, 1 px `slate` highlight on the top-left |
| Held weapon overlay | ≤ 10×6, pre-drawn at 16 angles | drawn over the hands, never rotated at runtime |
| Coin | 7×7, 4-frame spin | |
| Bullet | 1–2 px head + streak | streak = 7 px of the bullet's path behind it |
| Tiles | 16×16; walls show an 8 px face | |
| Text | two bitmap faces on the UI layer (§8) | `ink` on paper cards; color only for roles (§8) |

## 4. Rendering of forms

- **Characters:** 1 px outline. Player: `ink`. Reds: `wine` (the darkest of their own ramp), which
  keeps them glassy instead of cartoony. No dithering on characters.
- **Red glass:** 3 value bands (`blood` shadow, `red` body, `hot` lit side) plus 1–3 `glint` pixels on
  the top-left of the head and shoulders. Straight-edged clusters suggest facets: they are crystal,
  not skin. Faceless.
- **Player:** a pale mannequin (`paper`/`fog`/`ash` body, `ink` outline) with a 2 px `cyan` visor that
  faces the aim direction. Readable on the white floor because of the outline and shadow.
- **Each red kind has one mark** that reads at ×1, so you know what you face before it moves: the
  Grunt's cut-crystal crown, the Gunner's goggle band, the Brute's bulk, the Runner's swept fin and
  slight build, the Sniper's hood and single `glint` lens, the Mirror's polished `glint` face and
  diamond plate, the Splitter's `wine` crack from crown to hips, the Shard's tiny crowned body. Bosses
  are 40–48 px: the Manager's tie, the Conductor's peaked cap and buttons, the Foreman's hard hat and
  reflective stripe, the DJ's headphones and shades. The Frame's eyes are red glass almonds floating
  over a shadow, drawn shut (a lid line) while they shrug off bullets.
- **What bosses throw** is grey, never ink: you can't pick it up (the desk, a steel beam, a `coal`
  record with a `hot` label).
- **World geometry:** no outlines; shapes read by value steps (top faces lighter than south faces,
  `fog` grout on `paper` floors). Props are blocky and simple, SUPERHOT-like.
- **Each chapter has a theme** (`LevelDef.theme`, drawn in `src/render/level.ts`), all inside the
  world's greys so red still owns danger: **office** (paper tiles, carpet, desks); **subway** (small
  platform tiles, a dotted strip at the platform edge, white tiled walls, `coal` track beds with `iron`
  sleepers and `ash` rails); **roof** (speckled gravel, darker concrete walls, the drop as `ink` with a
  few `iron` windows far below and a stone lip); **club** (stone floor, `iron`/`coal` walls, a dance
  floor of `coal` squares in an `iron` grid); **core** (the frame's white with contact-sheet corner
  marks, `coal` walls punched with `paper` sprocket holes like film).
- **Hazards are drawn red only where they kill:** a train's side has a `red` stripe and its rails light
  red while it's coming; the crane hook's shadow is ringed with red dots; dance-floor tiles turn red
  before the drop; the Conductor's landing is a red target. Gravity wells are grey rings falling inward
  (they bend, they don't kill). In a **strobe** room the dark between flashes keeps only what matters:
  lit tiles, reds (`hot` with an `ink` rim), bullets, you, and items as grey shapes.
- **Shatter:** the red's own sprite pixels break into 1–3 px fragments that fly and spin in game time
  (frozen time freezes them mid-air, which is the best moment in the game). Fragments fade by dither,
  never by alpha.

## 5. Animation

- **Animations run on game time.** Frozen time freezes every animation, including the player's.
- Walk: 6 frames at 10 fps (game time). Punch: 3–6 frames. Throw: 4–6 frames. No idle animation:
  time is nearly stopped when you are idle anyway.
- 8 facing directions chosen from the aim angle. **West-facing directions are mirrored** from east
  (characters are symmetric), so only S, SE, E, NE, N are drawn or generated.
- The body faces the aim; legs play the walk when moving.

## 6. Readability rules (check every screenshot against these)

1. You can find the player in under half a second: cyan visor, ink outline, shadow.
2. Every red reads as red against every floor, at ×1 scale too.
3. Every bullet shows where it is going (streak), even frozen.
4. Every usable item reads as ink at a glance; nothing decorative is ink.
5. A red about to attack shows a tell (windup pose or aim line) for at least 0.4 game seconds.

## 7. Pipeline

### pixel-art-studio (default)
- One folder per artwork: `pixel-art/<slug>/build.py` draws every pixel; outputs go beside it
  (`export/` for the game, `preview/` for looking). Never hand-edit an exported PNG: edit `build.py`
  and rerun.
- Every build script uses `pixel-art/common/sf.py`, which loads the palette from
  `src/data/palette.json` and adds the project's helpers.
- The skill's loop is mandatory: build → **look at the preview** → critique (skill's
  `references/validations.md`) → fix, at least twice before calling it done.
- Run from the repo root: `python pixel-art/<slug>/build.py`.

### PixelLab (metered, 100-generation cap)
1. Write the planned call and its estimated cost in [ART_BUDGET.md](ART_BUDGET.md) **before** calling.
2. **Characters: draw the south-facing sprite by hand first** (pixel-art-studio, on palette, straight
   on to the viewer), then `create_character(mode="v3", reference_image_…)` to rotate it into 8
   directions (≈2 generations). This keeps our hand-made look and costs far less than generating.
3. Animations: `animate_character` with a template (`walking-6-frames`, `cross-punch`,
   `throw-object`, …) for **S, SE, E, NE, N only** (1 generation each); west is mirrored.
4. Settings: `view: "low top-down"`, `outline: "single color black outline"`, 8 directions. Never `pro`
   modes, `create_font`, `create_ui_asset` or `edit_image` (10–25 generations each) without asking.
5. Raw downloads go to `assets/pixellab/raw/<slug>/` and are never edited. A
   `pixel-art/<slug>/build.py` imports them, **locks them to the palette**, hardens alpha, cleans
   stray pixels (skill's `references/cleanup.md`), mirrors the west directions, and exports.
6. Record the actual cost from the tool's receipt in the ledger.

### Into the game (M6)
`python pixel-art/build_atlas.py [--all]` packs every `pixel-art/*/export/` into `src/art/sheet.png` +
`sheet.json` (names, frames, pivots); `--all` reruns every build script first. The renderer loads only
the atlas. `pixel-art/fonts/sheet.py` renders the two UI faces from `src/ui/fonts.ts` for looking.

## 8. Type and UI (the UI layer)

The words have to be easy to read, at a glance, mid-fight. The rule of thumb: **the opposite of a
thin pale terminal font on dark slate.** Bold letters, ordinary sentences, dark ink on light paper.

- **Two layers.** The world is drawn at 320×180 game pixels. Text and UI are drawn on their own
  **640×360 UI layer** (one UI pixel is half a game pixel), composited over the world at the device's
  scale. Letters get real shapes without shrinking the world's pixels. Both layers stay crisp: whole
  pixels only, no smoothing.
- **Two faces** (`src/ui/fonts.ts`, drawn as row strings, previewed by `pixel-art/fonts/sheet.py`):
  - **Pane**, the reading face: 8 px cap height, **2 px verticals** (1 px horizontals), real lowercase
    with ascenders and descenders, 12 px line height. Everything you read is Pane.
  - **Shard**, the display face: 11 px caps, 3 px verticals, faceted corners like broken glass. Titles, level
    names, the big words (PAUSED, SHATTERED, CLEARED), and numbers that matter (coins).
- **Sentence case** for everything you read ("Shatter every red", "Finish the level"). Capitals only
  for Shard titles and banners (WAVE 3).
- **Ink on paper.** Text is `ink` on `paper`/`fog` cards. Secondary text is `iron`; quiet hints
  `slate`. Color is a role, never decoration: `blood` for danger words, `tide` for time and tips,
  `amber` for coin and star lines. Words over the world get a `paper` outline.
- **Cards, not panels.** Every block of UI is a paper card with cut corners and a hard `stone` shadow
  down-right (`plate()` in `src/ui/kit.ts`). Buttons are cards with a lip that presses down; primary
  buttons are `cyan` (you), danger ones `red`. A veil of paper dither dims the world behind a card.
- **Rich text** (`src/ui/text.ts`): `[Key]` draws a keycap with the player's own binding (`[LMB]`,
  `[RMB]`, `[WHEEL]` draw a mouse); `{coin}`, `{star}`, `{red}`, `{time}`, `{lock}`, `{skull}` draw
  icons; `*word*` takes the accent color. Tips teach with keycaps, not with words for keys.
- **Readability checks** for every screen: a sentence can be read at 1280×720 from arm's length; no
  card hides the player or a red (HUD cards step aside); nothing important is only a color.
