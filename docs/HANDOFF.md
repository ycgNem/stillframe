# Handoff

Running notes for whoever (human or AI session) picks this up next. Newest status first.

## Status

**2026-10-22 (night) — Live at https://ycgnem.github.io/stillframe/; first critic pass done.**

- **Published:** repo github.com/ycgNem/stillframe (public), Pages from GitHub Actions; every push to
  `main` tests, builds and deploys. First run green; `node e2e/clear.mjs https://ycgnem.github.io/stillframe/ 1-1`
  clears a level on the live site through replay, tally and save.
- **Critic pass 1** (`critique/2026-10-22-mvp.md`, with a table of what was fixed and how it was
  checked): the tally ignored mouse clicks (fixed); gunners now strafe through the dotted part of their
  aim tell; only bullets already in flight can be parried; punches reach 15 px and go to the red you
  aim at; Stride is a real speed gain; pars are about 1.6× the bot's time; the Manager can't be killed
  by its own side and gets a card when it breaks; death holds, rings the killer and names it in a strip
  up top; hit-stop on shatters; corner sliding; pause on blur. Decisions logged in PLAN.md.
- **New check:** `e2e/screens.mjs [url]`: the blocked-shot mark, the death hold and strip, NEXT on
  the tally by mouse, the PHASE banner and the boss card. 71 Vitest tests.
- **Still for a human:** whether Chapter 1 takes 20–40 minutes for a fresh player (M7's last box,
  unticked), whether the new pars feel fair, and the sound by ear.
- **Next:** M8 (abilities and balance): the economy against the 70% target with the tighter pars;
  gunners need a back-view tell (they look like grunts from behind); a second critic pass.

**2026-10-22 (evening) — M1–M6 done, M7 built (Chapter 1 complete); deploying.**

- Everything from the time core to a full Chapter 1: see PLAN.md's ticked boxes, each with how it was
  verified. Code map: README "Project layout". Design as built: GAME_DESIGN.md (updated).
- **Checks:** `npm test` (Vitest: every verb, every level cleared by the bot with a matching replay
  hash, save and tally), `npm run build`, and four Playwright scripts (start `npm run dev` or the
  preview server first, pass its URL): `e2e/smoke.mjs`, `e2e/clear.mjs [url] [level]` (the bot clears
  a level in the real app through replay, tally and save), `e2e/levels.mjs`, `e2e/abilities.mjs`.
- **Hooks for scripts and the console:** `__app.startLevel(id)`, `__app.open('title'|'map'|'workshop'|
  'settings'|'end'|'contact')`, `__app.autoplay = true` (the bot plays), `__app.save`.
- **Art:** `python pixel-art/build_atlas.py --all` redraws `pixel-art/actors` (5 characters × 5
  directions × 7 frames) and `pixel-art/items` and packs `src/art/sheet.*`. Tiles, props, fonts and
  UI are drawn in code (`src/render/level.ts`, `font.ts`). **PixelLab: still 0 / 100.**
- **Playtest note (M1), by Claude, not a human:** see below. What a human still has to judge: whether
  Chapter 1 takes 20–40 minutes for a fresh player (M7's last box), and the sound by ear.
- **Playtest note (M1), Claude driving the real game through Playwright at 1280×720, ~15 minutes
  across 1-1, 1-2 and 1-4, plus every level under `app.autoplay`:**
  - Still versus moving reads at once: the cyan TIME bar drops to a stub, the drone drops and slows,
    bullets hang as short streaks with their heads lit, shards freeze mid-air. 3% idle feels right: the
    room is never fully dead (reds creep about 1 px a second), which keeps "standing still" honest. Kept.
  - The action burst (0.18 s) is enough to see your own bullet leave the gun and travel ~40 px, then
    it crawls with everything else: you get to watch it land. Good.
  - Problems found and fixed: the HUD plates hid the player in the top-left corner of 1-2 (plates now
    step aside for the player and reds); a 1-tile pickup reach meant standing on top of a gun to
    click it (now 1.25 tiles, Reach I/II 1.6/2.1); it was hard to see that a desk would eat your shot
    (a faint dotted line now runs from your gun to the cursor, stopping where the bullet would).
  - 1-4 punishes walking into the open: three gunners converge. That is the intended lesson, but it
    is the first real difficulty spike; watch for it in a human playtest.
- **Known weak spots:** characters are mannequins with few frames (no turn animation, no punch
  follow-through on the far arm); the chapter map is a plain floor plan; the bot is good at aiming and
  bad at dodging bullets, so par times were set from its times with generous slack.

**2026-10-22 — project created (M0).**

- Folder, docs, and a Vite + TypeScript (strict) scaffold modelled on pixel-rts. `npm test` (12
  tests), `npm run typecheck` and `npm run build` pass.
- A playable time toy (`src/sim/world.ts`, `src/sim/time.ts`): one room, reds walk at you, click to
  shoot, R restarts. Checked in the browser: about 2 ticks per real second when idle and 58 while
  walking.
- Docs: `GAME_DESIGN.md` (rules, chapters, coins, upgrades), `PLAN.md` (milestones M0–M12, risks,
  decisions), `STYLE.md` (palette and art contract), `ART_BUDGET.md` (100-generation PixelLab plan).
- Art: `pixel-art/common/sf.py` (palette helper) and a small style sample in `pixel-art/style_key/`
  (player, Grunt, pistol, coin, tiles, desk). It is a v0 sample, not final art. **PixelLab: 0 / 100
  generations spent.**
- No git repo yet; no GitHub remote. Deploy works once a repo exists (README "Deploying").
- **Next:** M1 in `PLAN.md`, the time core and its feel.
