# Plan

How the game gets built: the technical approach, then milestones in order. Each milestone ends with
something you can play and a **Done when** list. Tick a box only after it has been verified (a test, an
e2e screenshot, or a measured number), and write down how it was verified.

Rules of the game: [GAME_DESIGN.md](GAME_DESIGN.md). Art contract: [STYLE.md](STYLE.md). PixelLab
spending: [ART_BUDGET.md](ART_BUDGET.md). Rules for working in this repo: [../CLAUDE.md](../CLAUDE.md).

---

## Status (2026-10-22, evening)

**M1–M6 done, M7 nearly.** Chapter 1 is a whole game: 8 levels (Elevator to The Manager) with waves,
par times and challenges; fists, pistol, shotgun and four throwables; Grunts, Gunners, a Brute's charge
and the Manager boss; the "STILL. FRAME." replay; coins, stars, a save with export codes, and a
Workshop with all 8 tracks (24 tiers), the Holster and loadouts; hand-made sprites; synthesized sound.
Vitest covers every verb, and every level is cleared by a scripted bot run whose replay matches its
state hash; four Playwright scripts (`e2e/smoke.mjs`, `clear.mjs`, `levels.mjs`, `abilities.mjs`)
drive the real game. Open: a human playtest of the whole chapter (M7's 20–40 minute check). See
HANDOFF.md.

**Next:** M8, abilities and balance, then Chapters 2–3.

---

## Technical approach

### Stack
Same as pixel-rts: **TypeScript (strict), Vite, Vitest, a single Canvas 2D, and our own small engine.
No game framework** (no Phaser, Pixi, Kaplay, React…). Playwright e2e scripts from M1. Hosted on
GitHub Pages, deployed by GitHub Actions on every push to `main`.

Proven code from `C:\Users\jacks\Documents\pixel-rts` and `sprocket-and-sprout` may be **copied and
adapted**, never imported across repos. Already taken: the loop (as `TimeLoop`), the seeded RNG, the
sim-boundary test, Play.bat, the Pages workflow. Candidates later: input rebinding, the bitmap font,
jsfxr audio, the e2e harness (`window.__app` plus screenshots).

### How the pieces fit

```
 mouse / keys ──► app ──► time rule (sim/time.ts) ──► how many ticks this frame
                   │                                          │
                   └──► TickInput (move, aim, buttons) ───────┴──► sim.step(world, input) ──► World
                                                                        │ (plain data)       │
 replay: recorded TickInputs ──► sim.step at 60 ticks / real s ─────────┘                    ▼
 screen ◄── render (interpolates prev → current positions with alpha) ◄────────────────────────┘
```

- **`src/sim` holds every game rule, as pure TypeScript.** No DOM, no timers, no `Math.random`, no
  clock. `step(world, input)` advances exactly one 1/60 s tick of game time and returns events
  (shot, shatter, death, clear). `tests/sim-boundary.test.ts` enforces this.
- **The time rule is outside the tick.** `sim/time.ts` (pure, tested) turns movement and actions into
  a time scale; `engine/loop.ts` runs `realDt × scale` worth of ticks per frame and draws with an
  interpolation `alpha`, so a world at 3% speed still glides instead of stepping twice a second.
- **`World` is plain data** that survives a JSON round-trip: snapshots for Rewind, state hashes for
  replay tests, and debug dumps all come free.
- **Deterministic:** fixed ticks, the seeded RNG lives in the state, stable iteration order. A replay
  is `{ level, seed, inputs: TickInput[] }`; replaying it must produce the same final state hash
  (tested from M4).
- **Commands are the input.** UI never edits the world; it produces `TickInput`. Reds use the same
  verbs internally (move, aim, fire, throw).

### Levels
- `src/data/levels/<chapter>.ts`: each level is data: an ASCII map (`#` wall, `.` floor, `=` glass,
  `T` table, `D` door/spawn, `P` start, `X` exit, item and red letters), goal, par, challenge, waves.
  Diffable, easy to hand-edit. A level editor is a stretch goal.
- Collision: circles against the tile grid (axis-separated), bullets by DDA ray against tiles.
- Reds path with a BFS flow field from the player's tile, rebuilt when the player changes tile
  (rooms are tiny). Sight by DDA raycast.

### Rendering
- 320×180 game pixels, shown at the largest whole device-pixel scale (×4 at 720p, ×6 at 1080p, ×8 at
  1440p), letterboxed, `imageSmoothingEnabled = false`, everything drawn on whole pixels.
- Layers: floor → decals → shadows → props → actors (y-sorted) → bullets/streaks → shards/FX → HUD.
- Camera follows the player in big rooms, clamped, on whole pixels.
- Sprites from one atlas built from `pixel-art/` exports (M6). Until then, palette-colored shapes.

### Persistence
`localStorage` (`stillframe.save.v1`), versioned with migrations, plus export/import codes (M5).

### Testing
- **Vitest** for the sim (time rule, combat, AI, levels, economy, replays), run headless.
- **Playwright e2e** (from M1): drive the real game through `window.__app`, take screenshots into
  `e2e/out/` (ignored by git).
- Balance scripts in `scripts/` (Node `.ts`/`.mjs`, not bash; the dev machine is Windows).

---

## Milestones

Each one ends playable. MVP = M0–M7 (Chapter 1 complete with upgrades and art). 1.0 = M12.

### M0 — Skeleton ✅
- [x] Vite + TS strict + Vitest; `npm run dev / test / typecheck / build` work. *(2026-10-22: all four
      run clean.)*
- [x] Pixel-perfect 320×180 canvas at whole device-pixel scales. *(Browser pane: 2× at 800×600, crisp.)*
- [x] Time-scaled fixed-step loop with interpolation. *(Browser: idle ≈ 2 ticks/s, walking ≈ 58/s.)*
- [x] Sim boundary enforced. *(`tests/sim-boundary.test.ts`)*
- [x] Time toy: move, aim, click to shoot, reds walk at you, R restarts, clear screen.
      *(`tests/world.test.ts`, `tests/time.test.ts`; played in the browser pane.)*
- [x] Play.bat, deploy workflow, docs. *(First deploy ran 2026-10-22: Actions run 39738129309.)*

### M1 — Time core and feel ✅
The time rule feels right before anything else is built on it.
- [x] Debug overlay (F3): time scale, ticks/s, burst left, game vs real time; `?debug` slider for `TIME`.
      *(`src/app/play.ts` drawDebug, `src/app/debug.ts`.)*
- [x] Player wall collision against a tile grid; 8-direction movement with a tiny accel/decel.
      *(`tests/world.test.ts`: walls stop the player, diagonals no faster, accelerates over ticks.)*
- [x] Bullet streaks, muzzle flash, red "aim tell" line; bullets stop at walls.
      *(`tests/combat.test.ts` "bullets stop at walls but break glass"; streaks and the dotted-then-solid
      aim line in `e2e/out/levels/1-2-play.png`.)*
- [x] Screen-space shatter placeholder (shape fragments, game-time physics). *(Superseded by M2's real
      shatter.)*
- [x] e2e harness (`e2e/smoke.mjs`): boot, walk, shoot, screenshot. *(Measured: idle 2 ticks in a real
      second, walking 57.)*
- [x] A playtest note in HANDOFF.md: does still-vs-moving read? Is 3% the right idle? *(Claude's own
      session, driven through Playwright and the browser pane; not a human playtest. 3% kept.)*

### M2 — Combat ✅
- [x] Integrity damage model (bullet 3, punch 1), fists with disarm, pickups (click / E), throwing
      (right click) with stun + disarm, empty guns thrown. *(`tests/combat.test.ts` fists, throws, pickups.)*
- [x] Pistol and shotgun from data; ammo; "click waits for its shot". *(`src/data/items.ts`; test "a shot
      fired during the cooldown waits".)*
- [x] Bullet-vs-bullet parry. *(test "a bullet that meets a red bullet cancels it".)*
- [x] Grunt and Gunner AI (seek, punch windup, keep-distance strafing, aim tell), reds pick up weapons.
      *(tests in "reds": the windup can be stepped out of, the gunner keeps range and tells for 0.4 s or
      more, reds pick up guns.)*
- [x] Real shatter: the red's own pixels split into fragments that fly in game time. *(`src/render/fx.ts`
      samples the atlas frame; frozen mid-air in `e2e/out/levels/1-4-play.png`.)*
- [x] Done when: Vitest scenarios for each verb (punch disarms, throw stuns, parry, gunner keeps
      range) and an e2e screenshot of a mid-fight frozen frame. *(`tests/combat.test.ts`;
      `e2e/out/clear/1-1-1-fight.png`.)*

### M3 — Levels ✅
- [x] Level data format + loader, ASCII maps, doors that spawn waves, items on the floor.
      *(`src/data/levels/`, `src/sim/level.ts`, `src/sim/waves.ts`; test "later waves come through the doors".)*
- [x] Goals: Clear, Escape, Survive. Level timer in game time. *(test "escape ends at the exit; survive…".)*
- [x] Sight lines and flow-field pathing for reds. *(`src/sim/nav.ts`; test "a grunt walks around a wall".)*
- [x] Greybox Chapter 1 levels 1-1 … 1-5 (shapes only). *(All eight built.)*
- [x] Done when: every greybox level is cleared by a scripted bot run in Vitest (seed + input list).
      *(`tests/levels.test.ts`: `src/bot/bot.ts` clears all 8; its inputs replay to the same hash.)*

### M4 — Replay ("STILL. FRAME.") ✅
- [x] Record `TickInput`s; replay at 60 ticks per real second with the chant; ×2 hold; skip.
      *(`src/app/replay.ts`; `e2e/out/clear/1-1-2-replay.png`.)*
- [x] Deterministic replay test: record a run, replay it, same final state hash. *(`tests/levels.test.ts`,
      all 8 levels; `tests/world.test.ts`.)*
- [x] Death screen "SHATTERED" with instant restart; restart keeps no state. *(`e2e/out/smoke/06-after.png`;
      R builds a fresh PlayScreen.)*

### M5 — Meta loop ✅
- [x] Coins (kills, combos, style, clear, untouched, first-time stars; repeat clears at 50%).
      *(`src/sim/kills.ts`, `src/meta/tally.ts`; tests "kills chained… pay a combo", "tally".)*
- [x] Stars (clear, par, challenge) with challenge checkers in the sim. *(`src/sim/challenges.ts`.)*
- [x] Save file v1 + export/import code. *(`src/meta/save.ts`; `tests/meta.test.ts` round-trip, migration.)*
- [x] Screens: title, chapter map (Chapter 1), level intro card, tally. *(`e2e/out/smoke/01–03`,
      `e2e/out/clear/1-1-3-tally.png`.)*
- [x] Workshop with the first tracks: Stride, Trigger, Shield, Mag, Reach; Pistol loadout. *(All 8
      tracks; `e2e/out/smoke/07-workshop.png`.)*
- [x] Done when: `scripts/economy.ts` simulates a chapter-1 playthrough and prints coins vs workshop
      prices; the result is logged in the decisions log. *(479 coins on the first pass; see the log.)*

### M6 — Art pass 1 ✅
Follows [STYLE.md](STYLE.md) and [ART_BUDGET.md](ART_BUDGET.md).
- [x] Atlas build: `pixel-art/*/export/` → `src/art/sheet.png` + JSON. *(As `pixel-art/build_atlas.py`,
      in Python like the art scripts; see the decisions log.)*
- [x] Hand-made: weapons at 16 angles, floor items, coin, the Manager's desk (`pixel-art/items`); all five
      characters (`pixel-art/actors`). Tiles, props, the UI frame, both fonts, shard FX and the chapter
      map are drawn by code from the palette at runtime (`src/render/level.ts`, `font.ts`, `fx.ts`).
- [x] PixelLab (budgeted): not used. All five characters were drawn by hand in 5 directions × 7 frames
      instead. 0 of 100 generations spent.
- [x] Every PixelLab output palette-locked. *(None to lock; every hand-made sprite passes `sf.check`.)*
- [x] Done when: an e2e contact sheet of every sprite in game, and a mid-fight screenshot at ×4.
      *(`e2e/out/smoke/10-contact-*.png`; 1280×720 = ×4 shots in `e2e/out/levels/`.)*

### M7 — Chapter 1 complete (MVP)
- [x] Levels 1-1 … 1-8 final (art, waves, par, challenges), The Manager boss. *(`src/data/levels/ch1.ts`;
      `e2e/out/levels/`.)*
- [x] Audio pass 1: shatter, shots, punches, coins, time-tracking drone. *(`src/audio/audio.ts`; no
      console errors in any e2e run. Not yet judged by a human ear.)*
- [x] Workshop: Frameskip, Rewind, Arm, Holster. *(tests "Frameskip…", "Arm III…", "Holster…";
      `e2e/abilities.mjs`: dash, shield and rewind in the real app.)*
- [x] Deploy to GitHub Pages. *(github.com/ycgNem/stillframe; Actions run 39738129309 green: test →
      build → deploy. `node e2e/clear.mjs https://ycgnem.github.io/stillframe/ 1-1` clears 1-1 on the
      live site through replay, tally and save.)*
- [ ] Done when: a fresh player finishes Chapter 1 in 20–40 min (playtest note), all tests and e2e
      pass, the live link works.

### M8 — Abilities and balance
- [ ] Rewind snapshots (ring buffer, 0.25 s), Frameskip III, Shield II, Reach III catch.
- [ ] Economy pass with `scripts/economy.ts` against the 70% target (GAME_DESIGN §10).

### M9 — Chapters 2–3
- [ ] Rush Hour (shotgun, Runner, Brute, trains, The Conductor).
- [ ] Under Construction (SMG, Sniper, ledges, The Foreman).
- [ ] PixelLab: Brute, Runner, Sniper, 2 tilesets (ART_BUDGET).

### M10 — Chapters 4–5 and the ending
- [ ] Strobe (katana, Mirror, strobe lighting, The DJ).
- [ ] The Core (Splitter, rule glitches, The Frame), ending and credits.

### M11 — Polish
- [ ] Juice: hit stop, whole-pixel screen shake, shard sparkle, coin fly-to-counter.
- [ ] Settings: keybinds, volume, shake, flash reduction, outline-enemies mode.
- [ ] Title attract mode (scripted replay).

### M12 — 1.0
- [ ] Gauntlet mode.
- [ ] Perf budget: 60 fps with 40 reds and 300 shards on a laptop (`e2e/perf.mjs`).
- [ ] Critic passes (fresh-eyes playtest reports in `critique/`), fixes. *(Pass 1 done 2026-10-22: its
      critical and major issues fixed, see the decisions log; more passes before 1.0.)*
- [ ] Patch notes, README, live.

### Stretch
Daily seeded Gauntlet · replay GIF export · best-replay gallery · level editor · controller support ·
Electron/desktop build.

---

## Risks

| Risk | Mitigation |
|---|---|
| The time rule feels mushy or exploitable | M1 is only about feel; every number is in `TIME`; debug slider; playtest notes before M2 |
| Free aim makes shots trivial | bullets are slow and visible; reds strafe and dodge; revisit "aim moves time a little" after M2 |
| Readability at 320×180 (1–2 px bullets) | streaks behind every bullet, red aim tells, strict color roles (STYLE.md) |
| PixelLab budget (100 generations) | ledger in ART_BUDGET.md, standard modes only, mirror west-facing directions, hand-make everything else |
| PixelLab characters off-palette or off-size | every import goes through a build script with palette lock + cleanup; never use raw output in game |
| Scope (40 levels, 5 bosses) | MVP is Chapter 1; chapters 2–5 only after M7 is fun |
| Floating-point drift breaking replays | same-browser playback only; replay test in CI; no `Math.random`, no wall clock in sim |

---

## Decisions log

| Date | Decision | Why |
|---|---|---|
| 2026-10-22 | Name **Stillframe**; top-down ¾ view | a 2D, mouse-aimed take on the time rule reads best from above |
| 2026-10-22 | TypeScript strict, Vite, Canvas 2D, no framework | the user's standing rule (all projects TS); pixel-rts's proven setup |
| 2026-10-22 | 320×180 view, 16 px tiles, whole-number scaling | ×4/×6/×8 on 720p/1080p/1440p; chunky, readable pixels |
| 2026-10-22 | 60 Hz fixed game-time ticks; the time rule sets ticks per real second; render interpolates | determinism (replays, rewind) with smooth slow motion |
| 2026-10-22 | `TIME.idle` 0.03, burst 0.18 s, ramp 14/10 per s | starting values; tuned in M1 |
| 2026-10-22 | Aiming doesn't move time | planning a shot is the fun part; revisit after M2 |
| 2026-10-22 | One-hit deaths; Shield and Rewind as upgrades | keeps the SUPERHOT tension, gives progression a real feel |
| 2026-10-22 | Coins banked only on clear; repeat clears pay 50% | rewards finishing, limits farming |
| 2026-10-22 | Art: pixel-art-studio by default; PixelLab capped at **100 generations** for this project | the user's budget; see ART_BUDGET.md |
| 2026-10-22 | Dev ports: 5200 (`npm run dev`, Play.bat), 5201 (Claude preview) | clear of pixel-rts (5180) and verdant-relay (5190) |
| 2026-10-22 | Red bullets fly at 62% of yours; reds aim 0.55 s (locking for the last 0.15 s) and fire every 1.2 s | a frozen room must always be readable and every shot dodgeable; the bot-cleared levels set the bar |
| 2026-10-22 | Throws stun 1.6 s (not 1.0); punches stun 0.35 s and keep a throw-stun alive | at 1.0 s a throw followed by three punches could never be a stun kill |
| 2026-10-22 | Arm II: any thrown item shatters Grunts and Gunners (not only weapons) | simpler to read; bottles and mugs are what you throw most |
| 2026-10-22 | Brutes and the Manager shrug off throws for 2.5 s after one stuns them; each Manager phase opens with 1.5 s of guard | the bot found a throw–pick-up–throw stun-lock that beat the boss without a fight |
| 2026-10-22 | Gunners with a loaded gun never punch | they otherwise stood in your face trading punches instead of keeping range |
| 2026-10-22 | Repeat clears pay half of every line, clear and untouched included | limits farming more simply than splitting lines |
| 2026-10-22 | A Survive level's par star comes with surviving; survive time is counted in whole ticks | nobody can survive faster; 30 s in floats came out at 1801 ticks |
| 2026-10-22 | Economy (`scripts/economy.ts`, bot plays Chapter 1 in order): first pass 479 coins, 18/24 stars, first clears 46–82; a second pass adds ~130; that buys every tier I, the Pistol and the Holster (~20% of a 3,080-coin Workshop). Prices unchanged | the MVP is one chapter: tasting every track is the right amount; tiers II–III wait for chapters 2–5 |
| 2026-10-22 | Rewind lives in the app, not the sim: snapshots are JSON copies of the World every 0.25 game s; a rewind cuts the input record back to the snapshot | the World stays free of copies of itself, and the replay shows the run that worked |
| 2026-10-22 | Effects (shards, coins, sparks) live in render, ticked by sim ticks so they freeze with time; popups and the dash trail run on real time | shards are cosmetic: keeping them out of the World keeps snapshots and hashes small |
| 2026-10-22 | Bullets and throws are drawn 7 px above the floor (`AIR`) and the cursor is read 7 px lower | so clicking on a red's chest aims at the red |
| 2026-10-22 | Art: characters hand-drawn by a parametric build script (5 directions × 7 frames each, 0 PixelLab generations); tiles, props, fonts, UI and shard FX drawn from the palette in code at runtime; the atlas packer is Python (`pixel-art/build_atlas.py`) | consistent palette-locked look with no metered spending; the art toolchain is already Python + Pillow |
| 2026-10-22 | A bot (`src/bot/bot.ts`, pure, reads the World and returns TickInputs) plays the levels in tests, the economy script, the title screen and `app.autoplay` | one player-shaped thing proves levels clearable, measures the economy and makes the attract mode |
| 2026-10-22 | First critic pass (`critique/2026-10-22-mvp.md`): aiming stays free; instead gunners strafe at 60% speed while their aim line is dotted and keep 80–128 px | the free-kill window came from a stationary tell, not from free aim; planning a shot stays the fun part |
| 2026-10-22 | Only a red bullet already in flight when you fired can be parried (the lower id is the older bullet); parry radius 3 → 2 px, pay +3 → +2 | traded shots were cancelling each other by accident and paid more than kills |
| 2026-10-22 | Punch reach 12 → 15 px (edge to edge), knockback 7 → 4 px, and a punch goes to the red nearest your aim | the knockback pushed reds just out of reach, so every second punch whiffed |
| 2026-10-22 | Stride is a speed gain in game time (×1.15/1.3/1.45) with the walking time scale divided by the same; Trigger bursts 0.10/0.04/0.02 s | slowing time while walking changed nothing the sim could see: everyone moved the same distance per tick |
| 2026-10-22 | Par ≈ 1.6× the bot's clean game time | pars set with generous slack made a third of all stars free |
| 2026-10-22 | Friendly fire on the Manager does 1 damage; disarmed weapons drop 18 px toward you and the red can't grab for 0.8 s | the boss died to its own gunner, and disarmed reds re-armed in the same tick |
| 2026-10-22 | Hit-stop (0.05 s per shatter, 1 s for the Manager) and the post-clear beat are app-level: the screen returns time scale 0 | the sim stays unaware of presentation, and replays stay exact |
