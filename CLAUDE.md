# CLAUDE.md

**Stillframe** is a browser pixel-art, top-down take on SUPERHOT: time only moves when you move. Red
glass enemies shatter in one hit, and so do you. Around that core sit chapters of short levels,
3 stars per level, coins, and a workshop of upgrades that bend the time rule. Hosted on GitHub Pages.

Read first: `README.md` (layout), `docs/GAME_DESIGN.md` (rules), `docs/PLAN.md` (milestones, status,
decisions log), `docs/STYLE.md` (art contract), `docs/ART_BUDGET.md` (PixelLab spending),
`docs/HANDOFF.md` (latest session notes).

## Stack: same as pixel-rts

- TypeScript (strict), Vite, Vitest, Playwright e2e scripts (from M1). A single Canvas 2D and our own
  small engine.
- **Never use a game engine or rendering/UI framework**: no Phaser, Pixi, Three, Kaplay, React…
- Ask before adding any runtime dependency. None so far; `jsfxr` is a candidate for audio (M7).
- Proven code from `C:\Users\jacks\Documents\pixel-rts` and `sprocket-and-sprout` may be **copied and
  adapted**. Never import across repos.
- Commands: `npm run dev` (port 5200) · `npm test` · `npm run typecheck` · `npm run build` ·
  `npm run preview`. Claude's browser preview uses `.claude/launch.json` ("game", port 5201).

## Architecture rules (do not break these)

1. **All game rules live in `src/sim`, as pure TypeScript.** Sim code imports only from `src/sim` and
   `src/data`. No DOM, no browser APIs, no timers, no `Math.random`, no clock, no npm packages.
   `tests/sim-boundary.test.ts` enforces this. Fix violations; never loosen the test.
2. **The sim steps fixed 1/60 s ticks of game time.** The time rule (`src/sim/time.ts`) decides how
   many ticks run per real second; `step()` never knows the time scale. Keep it that way: replays and
   Rewind depend on it.
3. **Input is `TickInput`.** UI and replays produce the same plain input objects; the sim validates
   everything (cooldowns, ammo, reach). Reds use the same verbs internally.
4. **Determinism.** Randomness only from the seeded RNG stored in state (`src/sim/rng.ts`). Iterate in
   a stable order (arrays). A recorded run must replay to the same final state.
5. **Tuning lives in `src/data`** (`tuning.ts`, later `weapons.ts`, `reds.ts`, `upgrades.ts`,
   `levels/`). No gameplay magic numbers in sim code. Data files hold data only.
6. **`render` and `ui` read state and never mutate it.**
7. **`World` is plain data** (objects, arrays, numbers, strings, booleans) and survives a JSON
   round-trip. No class instances, Maps, Sets, or functions in state.

## Pixel art rules

- 320×180 view, 16×16 tiles, ¾ top-down, whole-number scaling only, `imageSmoothingEnabled = false`,
  draw on whole pixels (the sim may use fractions; the screen can't).
- One 18-color palette in `src/data/palette.json`; every sprite is snapped to it. Color roles are
  exclusive: red = danger, ink = usable items, gold = coins, cyan = the player and time
  (`docs/STYLE.md` §2).
- **Art is made with the pixel-art-studio skill by default** (`pixel-art/<slug>/build.py`, helpers
  in `pixel-art/common/sf.py`). Never hand-edit exported PNGs; edit the build script.
- **PixelLab is capped at 100 generations for this project.** Before any PixelLab call, log the
  estimate in `docs/ART_BUDGET.md`; after it, log the actual cost. Hand-draw characters' south sprite
  and rotate it with v3 rather than generating from text. Ask before any call costing 10+.
- All art and sound is original. Don't copy SUPERHOT's assets.

## Hosting

- Static site on GitHub Pages. Every push to `main` runs tests, builds, and deploys
  (`.github/workflows/deploy.yml`). Vite's `base` is `'./'`, so always use relative asset paths.
- No backend. Saves are `localStorage`.

## How to work here

- Work in milestone order from `docs/PLAN.md`. Tick a "Done when" box only after verifying it, and
  note how (test name, e2e screenshot, measured number). Never tick a box on an assumption.
- Every new sim behaviour gets a Vitest test. Prefer scripted runs (seed + input list) over mocks.
- When a game rule changes, update `docs/GAME_DESIGN.md` in the same change. Significant technical
  decisions go in the decisions log in `docs/PLAN.md`. End each session with a dated entry at the top
  of `docs/HANDOFF.md`.
- The dev machine is Windows: write scripts as Node (`.mjs` or `.ts`) or Python (art), not bash.
