// The shape of a level (GAME_DESIGN §8). A level is data: an ASCII map plus waves, a goal, par and a
// challenge. Map letters:
//   ' ' void     '#' wall     '.' floor    ',' carpet   '=' glass pane (bullets break it)
//   'D' door (later waves come through, in reading order)       'E' elevator door (wall)
//   'X' exit (Escape goal)    'P' player start
//   '_' track (a train runs along it, see `trains`)     '~' the drop at a roof's edge (reds pushed in fall)
//   ':' dance floor (the beat lights it, see `beat`)
//   props, which block movement, bullets and sight:
//   'T' desk  'C' copier  'S' server rack  'F' filing cabinet  'V' vending machine  'O' plant
//   'W' water cooler  'K' kitchen or bar counter  'H' conference table  'R' railing
//   'A' turnstile  'L' pillar  'N' bench  'I' stack of girders  'U' crate  'Q' speaker stack  'J' DJ desk
//   items on the floor: ITEM_LETTERS in items.ts; reds: RED_LETTERS in reds.ts
import type { ItemKind } from '../items';
import type { RedKind } from '../reds';

export type Goal = { kind: 'clear' } | { kind: 'escape' } | { kind: 'survive'; seconds: number };

/** How a level looks: floors, walls and props are drawn in its chapter's style. */
export type Theme = 'office' | 'subway' | 'roof' | 'club' | 'core';

/** A train line (chapter 2): two rows of '_' starting at `row`. A train runs every `period` game seconds,
 *  its rails light red for TRAINS.warn seconds first, and it kills anything in its way. */
export interface TrackDef {
  row: number;
  /** +1 runs left to right, -1 right to left */
  dir: 1 | -1;
  period: number;
  /** game seconds into the first period */
  offset: number;
  /** px per game second */
  speed: number;
  cars: number;
  /** stops with its front at this tile column for `for` game seconds (the boss rides it) */
  stop?: { at: number; for: number };
}

/** A crane hook (chapter 3): swings on a cable from a pivot (tile coordinates) across the roof. */
export interface HookDef {
  x: number;
  y: number;
  /** cable length in tiles */
  len: number;
  /** half the arc, radians */
  swing: number;
  /** game seconds for a swing there and back */
  period: number;
  /** where in its swing it starts, 0..1 */
  phase: number;
}

/** The beat (chapter 4): every `bar` game seconds part of the ':' floor lights up, and on the drop, after
 *  `warn` game seconds, anything standing on a lit tile shatters. */
export interface BeatDef {
  bar: number;
  warn: number;
}

/** A gravity well (chapter 5): bends bullets and throws toward it, and drags at whoever stands near. */
export interface WellDef {
  x: number;
  y: number;
  /** px per game second² at the centre */
  pull: number;
  /** px */
  r: number;
}

/** A rule glitch (chapter 5): `inverse` time runs while you stand still; `mirror` swaps left and right;
 *  `echo` fires every shot again a moment later. */
export type Glitch = 'inverse' | 'mirror' | 'echo';

/** Checked by the sim (src/sim/challenges.ts) at the moment of the clear. */
export type ChallengeId =
  | { id: 'fists' }
  | { id: 'noShots' }
  | { id: 'stunKills'; n: number }
  | { id: 'gunnerFirst' }
  | { id: 'parries'; n: number }
  | { id: 'combo'; n: number }
  | { id: 'noKills' }
  | { id: 'noMiss' }
  | { id: 'punchKills'; n: number }
  | { id: 'kills'; n: number }
  | { id: 'bossPunch' }
  | { id: 'untouched' }
  | { id: 'hazardKills'; n: number }
  | { id: 'dropKills'; n: number }
  | { id: 'slashKills'; n: number }
  | { id: 'noFists' }
  | { id: 'bossDrops' };

export interface SpawnDef {
  kind: RedKind;
  /** which door, counting `D`s in reading order from 0 */
  door: number;
  /** what it carries in; omit for the kind's default */
  item?: ItemKind | null;
}

export interface WaveDef {
  /** 'clear': once every red is gone; 'time': at `at` game s since the level began */
  when: 'clear' | 'time';
  at?: number;
  reds: SpawnDef[];
}

export interface Sign {
  /** tile column and row of the text's left edge */
  x: number;
  y: number;
  text: string;
}

export interface LevelDef {
  id: string;
  name: string;
  goal: Goal;
  /** par, in game seconds (star 2) */
  par: number;
  challenge: ChallengeId;
  /** the intro card's line for the challenge */
  challengeText: string;
  /** one line of advice on the intro card (rich text: [Key], *accent*) */
  tip: string;
  /** a line shown in play for the first few seconds (rich text) */
  hint?: string;
  map: string[];
  waves: WaveDef[];
  /** the Manager's calls for help, one wave per phase (boss levels only) */
  bossWaves?: SpawnDef[][];
  /** floor text that teaches (tutorial levels) */
  signs?: Sign[];
  /** the floor the map's letters stand on: ',' carpet or '.' tiles */
  floor?: '.' | ',';
  /** the RNG seed for this level's reds */
  seed: number;
  theme?: Theme;
  trains?: TrackDef[];
  hooks?: HookDef[];
  beat?: BeatDef;
  wells?: WellDef[];
  glitch?: Glitch;
  /** the lights go out between flashes (chapter 4) */
  strobe?: boolean;
}
