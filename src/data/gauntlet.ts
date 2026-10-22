// Gauntlet (GAME_DESIGN §14): the arenas it rotates through, who comes when, and what it pays. Data only;
// the rounds are built in src/meta/gauntlet.ts.
import type { ItemKind } from './items';
import type { Glitch, LevelDef } from './levels/types';
import type { RedKind } from './reds';

export const GAUNTLET = {
  /** waves per arena; then the arena changes */
  roundWaves: 5,
  /** reds in wave n: base + floor(n × perWave), at most max */
  baseReds: 2,
  perWave: 0.6,
  maxReds: 10,
  /** at most this many Brutes in a wave */
  maxBrutes: 1,
  /** coins for clearing wave n: base + n × per */
  waveBase: 2,
  wavePer: 1,
  /** game seconds before the first wave of an arena walks in */
  firstWave: 0.6,
  /** from the second arena on, one of these per arena, in turn */
  glitches: ['inverse', 'echo', 'wells', 'mirror'] as (Glitch | 'wells')[],
};

/** Who can come, from which wave, how often (relative), and carrying what. */
export const GAUNTLET_POOL: { kind: RedKind; from: number; weight: number; item?: ItemKind | null }[] = [
  { kind: 'grunt', from: 1, weight: 4 },
  { kind: 'runner', from: 2, weight: 2 },
  { kind: 'grunt', from: 3, weight: 2, item: 'pistol' },
  { kind: 'gunner', from: 4, weight: 2 },
  { kind: 'splitter', from: 6, weight: 2 },
  { kind: 'mirror', from: 8, weight: 1 },
  { kind: 'brute', from: 10, weight: 1 },
  { kind: 'grunt', from: 12, weight: 1, item: 'smg' },
];

/** An arena: a map with four doors and its own look and hazards. `wells` are added under the wells glitch. */
export type Arena = Pick<LevelDef, 'name' | 'map' | 'theme' | 'trains' | 'beat' | 'strobe'> & { wells: NonNullable<LevelDef['wells']> };

export const ARENAS: Arena[] = [
  {
    name: 'Office', theme: 'office',
    map: [
      '##########D###########',
      '#....................#',
      '#..TT....p.....TT....#',
      '#....................#',
      '#.....=====..........#',
      'D.......P.......TT...D',
      '#....................#',
      '#..TT.....m......=...#',
      '#................=...#',
      '#....b.......TT..=...#',
      '#....................#',
      '##########D###########',
    ],
    wells: [{ x: 5, y: 6, pull: 380, r: 56 }, { x: 16, y: 3, pull: 380, r: 56 }],
  },
  {
    name: 'Subway', theme: 'subway',
    map: [
      '##########D###########',
      '#....................#',
      '#..N.....p......N....#',
      '#....................#',
      'D....................D',
      '______________________',
      '______________________',
      '#....................#',
      '#..L.....P.......L...#',
      '#.......m............#',
      '#....................#',
      '##########D###########',
    ],
    trains: [{ row: 5, dir: 1, period: 8, offset: 4, speed: 200, cars: 3 }],
    wells: [{ x: 5, y: 9, pull: 380, r: 56 }, { x: 16, y: 2, pull: 380, r: 56 }],
  },
  {
    name: 'Roof', theme: 'roof',
    map: [
      '#####D########D#######',
      '~....................~',
      '~..I.....u.......I...~',
      '~....................~',
      '~....................~',
      '~.......P............~',
      '~....................~',
      '~...U.........b......~',
      '~....................~',
      '~..##D##......##D##..~',
      '~..#...#......#...#..~',
      '~~~~~~~~~~~~~~~~~~~~~~',
    ],
    wells: [{ x: 4, y: 4, pull: 380, r: 56 }, { x: 17, y: 6, pull: 380, r: 56 }],
  },
  {
    name: 'Club', theme: 'club', strobe: true,
    map: [
      '##########D###########',
      '#Q..................Q#',
      '#....................#',
      '#...::::::::::::::...#',
      'D...::::::::::::::...D',
      '#...:::::::P::::::...#',
      '#...::::::::::::::...#',
      '#....................#',
      '#..j.............p...#',
      '#Q..................Q#',
      '##########D###########',
    ],
    beat: { bar: 2.4, warn: 1.1 },
    wells: [{ x: 3, y: 2, pull: 380, r: 56 }, { x: 18, y: 8, pull: 380, r: 56 }],
  },
  {
    name: 'Core', theme: 'core',
    map: [
      '##########D###########',
      '#....................#',
      '#..L.............L...#',
      '#....................#',
      'D.........P..........D',
      '#....................#',
      '#......p......u......#',
      '#..L.............L...#',
      '#....................#',
      '##########D###########',
    ],
    wells: [{ x: 5, y: 4, pull: 380, r: 56 }, { x: 16, y: 5, pull: 380, r: 56 }],
  },
];
