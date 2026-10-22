# Game Design — Stillframe

A top-down pixel-art action-puzzle shooter for the browser. **Time only moves when you move.** Stand
still and the world crawls at 3% speed; walk and it runs; every shot, punch or throw buys a short burst
of full-speed time. Red glass enemies shatter in one clean hit, and so do you.

It is a 2D pixel take on **SUPERHOT**, openly. What we add is a game around it: **levels in chapters,
stars, coins, and a workshop of upgrades** that change how time works for you.

The numbers below match `src/data/` at the time of writing. **The data files win** when they differ:
that is where tuning happens. This document describes the rules.

---

## 1. Pillars

1. **Every frame is a decision.** Standing still is free thinking time. The game is about reading a
   frozen room and choosing the next half second.
2. **One hit, one shatter.** Reds break in one clean hit and so do you. Deaths are instant and so are
   restarts (R). A level is 20–90 seconds of game time.
3. **Style pays.** Coins reward clean play (combos, throws, parries, no damage), not grinding.
4. **Upgrades bend time, not just numbers.** The best upgrades change the rule itself: cheaper walking,
   shorter bursts, a dash that takes no time, a rewind.
5. **Readable at a glance.** White world, red danger, black things you can pick up, gold coins, cyan
   you. Nothing else competes (STYLE.md).

### What comes from SUPERHOT, and what we add

| From SUPERHOT | Our twist |
|---|---|
| Time moves when you move | Upgrades bend the rule: **Stride** (walking runs time slower), **Trigger** (shorter action bursts), **Frameskip** (a dash in zero time) |
| One-hit deaths, instant restart | **Shield** upgrade (one free hit per level) and **Rewind** (die, and jump back 2 seconds instead) |
| Red crystal enemies that shatter | Shards scatter as real pixel fragments in slowed time; each red drops **coins** |
| Pick up, shoot, throw the empty gun | **Holster** (carry two), **Reach** (grab from further, later catch thrown guns mid-air) |
| "SUPER. HOT." real-time replay | **"STILL. FRAME."** replay of your clear at real speed, then the **coin tally** |
| Short levels in a story | **5 chapters × 8 levels**, a **boss** per chapter, **3 stars** per level, a chapter map |

| Our own |
|---|
| **Coins and the Workshop** (§10, §11): 8 upgrade tracks of 3 tiers, plus loadout unlocks |
| **Stars** (§8): clear, beat par (game time), and a per-level **challenge** |
| **Style bonuses** (§10): combos, thrown kills, bullet parries, ricochets |
| **Gauntlet** (§14, post-game): endless waves with a random **glitch** every 5 waves |

---

## 2. Core loop

**Moment to moment:** freeze → read the room → commit to a half second (step, shoot, throw) → freeze.

**Level loop:** intro card (goal, par, challenge) → play → die and restart instantly, or clear →
"STILL. FRAME." replay → coin tally and stars → next level / workshop / map.

**Meta loop:**

```
 levels ──► coins + stars ──► workshop upgrades + loadout ──► harder levels, better stars ──┐
   ▲                                                                                        │
   └──────────────── replay old levels for missing stars (and half coins) ◄─────────────────┘
```

---

## 3. Controls

| Action | Mouse + keyboard |
|---|---|
| Move | WASD (arrows also work) |
| Aim | Mouse |
| Shoot / punch / slash | Left click (an empty gun or a throwable is thrown instead) |
| Throw held item | Right click |
| Pick up | Click an item in reach (it lights up cyan), or E for the nearest |
| Frameskip (dash, upgrade) | Space |
| Swap weapon (Holster) | Q or mouse wheel |
| Restart level | R |
| Pause | Esc |
| Debug overlay | F3 (time scale, ticks/s, burst, game vs real time); `?debug` in the URL adds sliders for `TIME` |

All keys are rebindable (M11). Controller support is a stretch goal.

---

## 4. The time rule

| Situation | Time scale | Tuning (`TIME` in `src/data/tuning.ts`) |
|---|---|---|
| Standing still | 0.03 (3%) | `idle` |
| Walking at full speed | 1.0 | `walk` (Stride lowers it) |
| Action burst (shot, punch, throw, pickup) | 1.0 for 0.18 game s | `burstScale`, `burst` (Trigger shortens it) |
| Ramp toward the target | 14/s up, 10/s down | `rampUp`, `rampDown` |

- **Aiming is free.** Turning the mouse doesn't move time, so you can always plan a shot. (Decision
  2026-10-22; revisit if precise aim makes levels trivial.)
- **A click waits for its shot.** Clicking during a weapon cooldown runs time until the weapon is
  ready, then fires. Cooldowns tick in game time, so you can't spam while frozen.
- **The sim never sees the scale.** It runs fixed 60 Hz ticks of game time; the time rule only decides
  how many ticks happen per real second. That is what makes the real-speed replay free (§13).
- **Game time vs real time.** The level timer and par count game time (ticks). Real time is shown
  only in the tally, for fun.
- **Frameskip takes no time:** pressing Space runs the one sim tick that performs the dash at once,
  whatever the time rule says.

---

## 5. Player

- Moves 72 px/s (4.5 tiles/s) in 8 directions; diagonals are normalized.
- **One hit kills.** Any bullet, punch, or thrown object from a red.
- **Shield** (upgrade): absorbs one hit per level, cracks with a white flash; nothing can hurt you for
  the next 0.6 game s. Tier II: the break stuns reds within 2 tiles for 0.8 game s.
- **Rewind** (upgrade): instead of dying, the level jumps back 2 game seconds (§12).
- Carries one item (two with Holster). Starts empty-handed, or with the loadout weapon (§11).

---

## 6. Weapons and throwables

Weapons are black. Guns have **no reload**: when empty, throw them.

| Item | Use | Ammo | Cooldown (game s) | Notes |
|---|---|---|---|---|
| Fists | punch, 1.2 tile reach | — | 0.35 | 1 damage; the first punch disarms |
| Pistol | 1 bullet, 220 px/s | 6 | 0.30 | the workhorse |
| Shotgun | 5 pellets, 20° spread | 2 | 0.80 | pellets die after 5 tiles |
| SMG | 3-round burst | 12 (4 bursts) | 0.12 per shot | ch2+ |
| Katana | 90° slash, 1.5 tile reach | — | 0.40 | **cuts bullets**; ch4+ |
| Throwables | bottle, mug, ashtray, keyboard, any empty gun | 1 | 0.25 | stun 1.6 s and disarm; break on impact (guns land instead) |

- **Damage:** reds have **3 integrity**. Bullets and katana deal 3 (one-shot), punches deal 1.
  Throws deal 0 but stun and disarm (Arm II makes any thrown item shatter Grunts and Gunners).
- **Punches** stun for 0.35 s and knock the red back half a tile; the first punch on an armed red
  knocks its weapon loose. A punch landed on a throw-stunned red keeps it stunned, so throw-then-fists
  is a stun kill.
- **Reds' bullets fly at 62% of yours** (pistol 136 px/s against your 220), so a frozen room is
  always readable and every shot can be dodged. Reds' bullets shatter other reds too: that counts as
  your kill (base coins and combos, no style bonus).
- **Parries:** a bullet of yours that meets a red's bullet, or something a red threw (a bottle, the
  Manager's desk), destroys both.
- **Bullets collide with bullets.** Shooting a bullet out of the air is a **parry** (§10).
- **Bullets stop at walls**; glass panes shatter and let them through once.

---

## 7. Reds (enemies)

All reds are red glass. They shatter into pixel fragments and drop coins (§10).

| Red | Integrity | Speed (px/s) | Behaviour | First chapter |
|---|---|---|---|---|
| **Grunt** | 3 | 30 | walks at you, punches with a 0.5 s windup; uses any weapon it holds | 1 |
| **Gunner** | 3 | 26 | pistol; keeps 4–7 tiles away, strafes, fires with a 0.4 s aim tell | 1 |
| **Brute** | 9 | 20 | shrugs off throws (stun only); charges in a straight line after a 0.8 s tell | 1 (boss), 2 |
| **Runner** | 3 | 60 | zigzags in, fists only | 2 |
| **Sniper** | 3 | 0 | draws a red laser line for 1.5 s, then fires a fast bullet (400 px/s) | 3 |
| **Mirror** | 3 | 28 | reflects bullets; must be punched, cut or hit with a throw | 4 |
| **Splitter** | 3 | 30 | shatters into two small fast reds once | 5 |

Reds pick up weapons they walk over, and an unarmed red goes for a loaded gun it can see if it is
closer than you. They see along clear lines (walls and props block sight, glass doesn't) and path
around obstacles with a flow field.

As built (numbers in `src/data/reds.ts`):
- **Punch:** starts when the gap between you is 6 px, winds up 0.5 s (a red arc and a "!" show it),
  lands if you are still within 10 px and inside its cone. Step back or aside to make it miss.
- **Gunner:** keeps 4–7 tiles away and strafes; aims for 0.55 s (a red line, dotted while it tracks
  you, solid for the last 0.15 s once it locks), then fires; 1.2 s between shots. A gunner with a
  loaded gun never punches. Out of ammo, it throws the gun at you (0.4 s tell) and fights on unarmed.
- **Brute:** charges after a 0.8 s tell (a red lane): 135 px/s for up to 1.3 s; reds in the way
  shatter (your kills); glass bursts; a wall leaves it dazed for 1.4 s. After a throw stuns a Brute
  (only 0.4 s), more throws bounce off for 2.5 s, so it can't be stun-locked.
- **The Manager** (18 integrity): throws a desk every 2.6 / 2.2 / 1.7 s (0.75 s tell); a desk kills
  you, breaks glass and other reds, and can be shot out of the air (a parry). At 12 and 6 integrity a
  new phase begins: it roars, shrugs off damage for 1.5 s and calls reds through the doors; from the
  second phase on it also charges like a Brute.

**Bosses** (one per chapter, level X-8):

| Chapter | Boss | Gimmick |
|---|---|---|
| 1 | **The Manager** | a Brute in a glass office; throws desks, calls Grunts through the doors each phase |
| 2 | **The Conductor** | rides train cars through the platform; leaps off to strike when the train stops |
| 3 | **The Foreman** | swings a crane hook across the roof; you push reds off the ledges |
| 4 | **The DJ** | attacks on the beat (in game time): stand still and the beat stops too |
| 5 | **The Frame** | a giant red face in the white void; its weak points only open while time runs |

---

## 8. Levels

- A level is an ASCII tile map plus spawns, waves, items and a goal (`src/data/levels/`). Tiles are
  16×16 px; rooms are roughly 20×11 to 40×24 tiles, and the camera follows when bigger than the view.
- **Goals:**
  - **Clear:** shatter every red, including later waves through the doors.
  - **Escape:** reach the exit tile. Reds keep coming; killing them is optional.
  - **Survive:** stay alive for N game seconds (only moving time counts down).
- **Stars (3 per level):**
  1. ★ **Clear** the level.
  2. ★ **Par:** clear under the level's par **game** time.
  3. ★ **Challenge:** one rule per level, shown on the intro card, checked by the sim
     (`src/sim/challenges.ts`): Fists only · N kills on stunned reds · No shots fired · No missed
     shots · A combo of N · Escape without a kill · Punch kills · N kills · Finish the boss with a
     punch · Untouched (no shield or rewind used) · Kill the Gunner first.
- On a **Survive** level, surviving earns the par star too (there is no faster way to survive).

---

## 9. Chapters and level list

Five chapters of 8 levels (7 + a boss). Each chapter adds one weapon, one or two reds, and one hazard.

| # | Chapter | Setting | New this chapter | Levels |
|---|---|---|---|---|
| 1 | **Nine to Five** | office floors | fists, pistol, throwables; Grunt, Gunner | 1-1 Elevator (move/time tutorial) · 1-2 Cubicles (punch, pick up) · 1-3 Break Room (throws) · 1-4 Copy Room (pistol) · 1-5 Conference (waves from doors) · 1-6 Stairwell (escape) · 1-7 Server Closet (survive) · 1-8 **The Manager** |
| 2 | **Rush Hour** | subway | shotgun; Runner, Brute; **trains** (move in game time, kill anything) | 2-1 Turnstiles · 2-2 Platform · 2-3 Last Car · 2-4 Tunnel (escape) · 2-5 Crowd · 2-6 Maintenance · 2-7 Express (survive) · 2-8 **The Conductor** |
| 3 | **Under Construction** | rooftops and scaffolds | SMG; Sniper; **ledges** (push reds off, don't fall) | 3-1 Lift · 3-2 Girders · 3-3 Laser Lines · 3-4 Scaffold (escape) · 3-5 Water Tower · 3-6 Crane · 3-7 Wind (survive) · 3-8 **The Foreman** |
| 4 | **Strobe** | a white nightclub | katana; Mirror; **strobe** (the room is dark between flashes; reds still glow) | 4-1 Coat Check · 4-2 Dance Floor · 4-3 Mirror Hall · 4-4 Back Exit (escape) · 4-5 VIP · 4-6 Bar Fight · 4-7 Last Song (survive) · 4-8 **The DJ** |
| 5 | **The Core** | the white void | Splitter; **rule glitches** (time runs when still and stops when moving; gravity wells; mirrored controls) | 5-1 Static · 5-2 Inverse · 5-3 Echo · 5-4 Seam (escape) · 5-5 Split · 5-6 Mirror Mind · 5-7 Hold (survive) · 5-8 **The Frame** |

Chapter N+1 unlocks when N's boss falls. Levels unlock in order inside a chapter. **MVP is Chapter 1.**

---

## 10. Coins

Coins are gold, the only warm yellow on screen. They burst out of each shattered red and fly to the
counter; they are **banked only when the level is cleared** (die and that attempt's coins are gone).

| Source | Coins |
|---|---|
| Shatter a red | 2 (Brute 5, boss 25) |
| **Combo:** each extra kill within 1.0 game s of the last | +1, +2, +3 … |
| Thrown kill (Arm II) or stun-then-kill | +2 |
| **Parry:** a bullet shot or cut out of the air | +3 |
| Ricochet kill (Arm III) | +3 |
| Frameskip kill (Frameskip III) | +2 |
| Level clear | +5 |
| **Untouched** (no shield, no rewind) | +5 |
| Each star, **first time only** | +10 |

- **Repeat clears** pay 50% of every line (kills, combos, style, clear, untouched; rounded down) and
  nothing for stars already earned.
- **Measured** (`node scripts/run.mjs scripts/economy.ts`, the bot playing Chapter 1 in order): the
  first pass pays 479 coins with 18/24 stars (first clears of 46–82 each: more than the 25–45
  target, mostly from the three new stars); a second pass adds about 130. That buys every tier I,
  the Pistol and the Holster, about 20% of the whole Workshop. Chapters 2–5 are meant to pay for the
  rest.
- **Targets:** a first clear of a chapter-1 level pays about 25–45 coins; the whole of chapter 1 with
  every star about 400. Later chapters pay roughly +25% per chapter.
- The economy is tuned so a player who clears everything with about two thirds of the stars can afford
  about 70% of the workshop. Gauntlet covers the rest.

---

## 11. The Workshop (upgrades)

Opened from the chapter map. Permanent. Tier prices: **I 40 · II 100 · III 200** (all 8 tracks
maxed = 2,720 coins).

| Track | I | II | III |
|---|---|---|---|
| **Stride** — walking runs time slower | walk scale 0.85 | 0.72 | 0.60 |
| **Trigger** — shorter action burst | 0.14 s | 0.10 s | 0.06 s |
| **Shield** | one free hit per level | its break stuns reds within 2 tiles | two free hits |
| **Frameskip** (Space) — dash 3 tiles in **zero** game time | unlock, 4 s game cooldown | 4 tiles, 2.5 s | dashing through a red shatters it |
| **Rewind** — die, jump back 2 game s instead | 1 charge per level | 2 charges | charges refill each wave |
| **Arm** — throws | throws fly 25% faster | thrown items shatter Grunts and Gunners | thrown items ricochet once |
| **Mag** — ammo on pickup | +1 | +2 | +3 |
| **Reach** — pickup range | 1.5 tiles | 2 tiles | catch thrown items mid-air |

**Loadout** (one-time unlocks, after the weapon first appears in a level): start each level holding a
Pistol (80) · Shotgun (160) · Katana (240). **Holster** (carry two items, 120).

Challenge stars still apply with upgrades on (Fists only means fists only).

---

## 12. Abilities in detail

- **Frameskip:** an instant line move up to N tiles toward the aim, blocked by walls; no game time
  passes, so reds don't react until time next moves. Cooldown counts in game time.
- **Rewind:** the game snapshots the sim's plain-data state every 0.25 game s into a ring buffer (last
  3 s). On a lethal hit with a charge left, it restores the snapshot from 2 s ago, shows a VHS-style
  rewind for 0.6 real s, and play resumes frozen. Everything is undone (a shield spent since then comes
  back too); the recorded inputs are cut back to the snapshot, so the replay shows the run that
  worked. Uses are counted for the Untouched bonus.

---

## 13. Replay — "STILL. FRAME."

- Every clear records the tick inputs (move, aim, buttons). Because the sim is deterministic, playing
  those inputs back reproduces the run exactly.
- After a clear the run replays at **real speed** (60 ticks per real second, all the frozen moments
  removed) with **STILL.** / **FRAME.** flashing in time. Hold Space for ×2, any other key skips.
- Stretch: keep each level's best replay; export a replay as a GIF to share.

---

## 14. Modes

- **Story:** chapters 1–5 (§9).
- **Gauntlet** (unlocks after chapter 2): endless waves in rotating arenas. Every 5 waves a random
  **glitch** applies (double-speed reds, pistols only, inverted time, no standing still…). Pays coins
  per wave; local best wave on the title screen.
- **Daily** (stretch): one seeded Gauntlet run per day.

---

## 15. Screens and flow

```
Title ──► Chapter map ──► Level intro card ──► Play ──► (dead: "SHATTERED", R) ──► Play
               ▲  │                                └──► Clear ──► STILL. FRAME. replay ──► Tally ──┐
               │  └──► Workshop                                                                     │
               └─────────────────────────────── Next / Map / Workshop ◄─────────────────────────────┘
```

- **Title:** live attract mode (a scripted replay), Play, Gauntlet, Settings.
- **Chapter map:** level nodes on a pixel floor plan, stars and coins per node, the Workshop door.
- **Tally:** coin lines counting up one by one, stars stamping in, real vs game time.
- **Settings:** volume, keybinds, screen shake, flash reduction (Strobe chapter), outline-enemies mode.

---

## 16. Audio

Synthesized with WebAudio (no samples to license). Glass shatter (noise burst + high chimes), gunshot,
punch thump, coin tick. **The music follows time:** a low drone and beat whose playback rate tracks
the time scale (clamped 0.25–1), so standing still sounds frozen too.

---

## 17. Art direction

See [STYLE.md](STYLE.md). 320×180, 16 px tiles, one 18-color palette, white world / red reds / black
items / gold coins / cyan player.

---

## 18. Saves

`localStorage` key `stillframe.save.v1`: coins, upgrade tiers, loadout, per-level stars and best game
time, settings. Versioned with a migration per version bump. Export/import as a text code in
Settings, so a save can move between browsers.
