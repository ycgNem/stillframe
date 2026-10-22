// The shape of a level (GAME_DESIGN §8). A level is data: an ASCII map plus waves, a goal, par and a
// challenge. Map letters:
//   ' ' void     '#' wall     '.' floor    ',' carpet   '=' glass pane (bullets break it)
//   'D' door (later waves come through, in reading order)       'E' elevator door (wall)
//   'X' exit (Escape goal)    'P' player start
//   props, which block movement, bullets and sight:
//   'T' desk  'C' copier  'S' server rack  'F' filing cabinet  'V' vending machine  'O' plant
//   'W' water cooler  'K' kitchen counter  'H' conference table  'R' railing
//   items on the floor: ITEM_LETTERS in items.ts; reds: RED_LETTERS in reds.ts
import type { ItemKind } from '../items';
import type { RedKind } from '../reds';

export type Goal = { kind: 'clear' } | { kind: 'escape' } | { kind: 'survive'; seconds: number };

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
  | { id: 'untouched' };

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
  /** one line of advice on the intro card */
  tip: string;
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
}
