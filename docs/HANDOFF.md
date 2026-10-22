# Handoff

Running notes for whoever (human or AI session) picks this up next. Newest status first.

## Status

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
