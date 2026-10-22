# Stillframe

**Time moves when you move.** A top-down pixel-art take on SUPERHOT for the browser: stand still and
the world crawls at 3% speed, walk and it runs, and every shot or throw buys a split second of
full-speed time. Red glass enemies shatter in one hit, and so do you.

Around that core: 5 chapters of short levels, 3 stars per level, coins for clean and stylish play,
and a workshop of upgrades that bend the time rule (walk cheaper, dash in zero time, rewind a death).

**Status:** MVP (milestones M0–M7): Chapter 1, "Nine to Five", is complete: eight levels from the
Elevator to a boss fight with The Manager, a Workshop of 8 upgrade tracks, coins, stars, the "STILL.
FRAME." replay of every clear, synthesized sound, and saves in your browser. Chapters 2–5 come later.
See [docs/PLAN.md](docs/PLAN.md) for milestones and [docs/HANDOFF.md](docs/HANDOFF.md) for the latest
notes.

## Run it

```bash
npm install
npm run dev        # http://localhost:5200
npm test           # Vitest (headless)
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build
node e2e/smoke.mjs http://127.0.0.1:5200/      # Playwright: boot, play, every screen (also clear.mjs, levels.mjs, abilities.mjs)
node scripts/run.mjs scripts/economy.ts        # the bot plays Chapter 1; coins against Workshop prices
python pixel-art/build_atlas.py --all          # redraw every sprite and repack src/art/sheet.png
```

Needs Node 22.12 or newer. On Windows you can also double-click **Play.bat**, which installs
everything on first run and opens the game in your browser.

Controls: **WASD** move · **mouse** aim · **left click** shoot / punch / pick up the item under the
cursor · **right click** throw · **E** pick up · **Q** / wheel swap (Holster) · **Space** dash
(Frameskip) · **R** restart · **Esc** pause · **F3** debug overlay (`?debug` in the URL adds time-rule
sliders).

## Project layout

```
index.html            page shell: one <canvas id="game">
src/
  main.ts             entry point
  app/                screens and wiring: input → time rule → sim → render
  engine/             browser plumbing, no game rules: time-scaled loop, input, pixel-perfect screen
  sim/                ALL game rules, pure TypeScript: no DOM, no clock, seeded RNG only
                      (time.ts is the time rule; world.ts the step; ai.ts the reds; player.ts,
                      shots.ts, kills.ts, waves.ts, challenges.ts)
  data/               tuning, palette, items, reds, upgrades, levels/ (ASCII maps per chapter)
  meta/               the save file and the coin tally (pure)
  bot/                a scripted player: proves levels clearable, plays the title screen
  audio/              WebAudio synthesis: every sound and the time-tracking music
  render/             Canvas 2D drawing: level, actors, effects, HUD, fonts, atlas
  ui/                 immediate-mode buttons and panels
  art/                the sprite atlas packed from pixel-art/ (generated, don't edit)
pixel-art/            pixel-art-studio build scripts, one folder per artwork; common/sf.py has the
                      palette and helpers; style_key/ fixes the look
assets/pixellab/raw/  untouched PixelLab downloads (imported and palette-locked by pixel-art/ scripts)
tests/                Vitest tests, run headless
e2e/                  Playwright scripts that drive the real game (from M1)
scripts/              Node tools: atlas build, economy simulation (later)
docs/                 GAME_DESIGN.md, PLAN.md, STYLE.md, ART_BUDGET.md, HANDOFF.md
.github/workflows/    deploy.yml: test → build → GitHub Pages on every push to main
```

### How the pieces fit

```
 keys / mouse ──► app ──► time rule ──► ticks this frame ──► sim.step(world, input) ──► World
                                                                  ▲                      │
                          replay: recorded inputs at real speed ──┘                      ▼
 screen ◄── render (interpolated between ticks, so 3% speed still glides) ◄──────────────┘
```

`tests/sim-boundary.test.ts` fails the build if `src/sim` or `src/data` imports browser code, a
package, or uses `Math.random` or the clock.

## Art

Hand-made with the **pixel-art-studio** skill by default (`python pixel-art/<slug>/build.py` from the
repo root, needs Pillow). **PixelLab** is used sparingly, capped at 100 generations for this project:
see [docs/ART_BUDGET.md](docs/ART_BUDGET.md) and the art contract in [docs/STYLE.md](docs/STYLE.md).

## Deploying to GitHub Pages

One-time setup:
1. Create a GitHub repository and push `main`.
2. In the repository, go to **Settings → Pages → Build and deployment → Source** and choose
   **GitHub Actions**.

After that, every push to `main` runs the tests, builds, and publishes to
`https://<user>.github.io/<repo>/`.

## Docs

- [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md): time rule, weapons, reds, levels, chapters, coins, upgrades, modes
- [docs/PLAN.md](docs/PLAN.md): technical approach, milestones with "done when" checks, risks, decisions log
- [docs/STYLE.md](docs/STYLE.md): palette, sizes, shading, animation, readability rules, art pipeline
- [docs/ART_BUDGET.md](docs/ART_BUDGET.md): the 100-generation PixelLab plan and ledger
- [CLAUDE.md](CLAUDE.md): rules for AI-assisted sessions in this repo
