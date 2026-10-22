// Game state is plain data (CLAUDE.md rule 7): it survives a JSON round-trip, so it can be snapshotted
// for Rewind, compared in replay tests, and saved.
import type { ItemKind } from '../data/items';
import type { ChallengeId, Goal, SpawnDef, WaveDef } from '../data/levels/types';
import type { RedKind } from '../data/reds';

export interface Body {
  id: number;
  x: number;
  y: number;
  /** position at the previous tick, for render interpolation */
  px: number;
  py: number;
  /** half-size of the collision box */
  r: number;
  /** distance walked, for the walk animation */
  walked: number;
}

/** Something in your hands or a red's. */
export interface Held {
  kind: ItemKind;
  ammo: number;
  /** Mag already added its rounds to this gun */
  boosted: boolean;
}

export interface Player extends Body {
  vx: number;
  vy: number;
  /** facing, in radians */
  aim: number;
  /** hands[0] is in use; a second slot only with the Holster */
  hands: Held[];
  /** game seconds until the next shot, punch or throw */
  cooldown: number;
  /** game seconds since the last punch or throw, for the animation */
  actT: number;
  act: 'none' | 'punch' | 'throw' | 'shoot';
  shield: number;
  /** nothing hurts you while this runs (after a shield breaks) */
  grace: number;
  dashCd: number;
}

export type RedState =
  | 'enter' | 'move' | 'windup' | 'recover' | 'aim' | 'throwTell' | 'chargeTell' | 'charge' | 'deskTell';

export interface Red extends Body {
  kind: RedKind;
  hp: number;
  aim: number;
  state: RedState;
  /** game seconds left in the current state */
  t: number;
  held: Held | null;
  /** game seconds until it may fire or charge again */
  cooldown: number;
  stun: number;
  /** the stun came from a throw (a kill now is a stun kill) */
  stunByThrow: boolean;
  /** strafing direction (gunners), and how long until it changes */
  strafe: number;
  strafeT: number;
  /** charge direction (brutes, the Manager) */
  cvx: number;
  cvy: number;
  /** flashes after a hit, in game seconds */
  hurt: number;
  /** boss phase */
  phase: number;
  /** game seconds until it may charge again (brutes, the Manager) */
  chargeCd: number;
  /** game seconds it shrugs off damage (the Manager, as each phase begins) */
  guard: number;
  /** game seconds it shrugs off throw stuns (brutes and the Manager, after one), so throws can't stun-lock it */
  steady: number;
  /** game seconds until it may pick something up again (just disarmed) */
  grabCd: number;
  dead: boolean;
}

export interface Bullet {
  id: number;
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  from: 'player' | 'red';
  /** id of whoever fired it */
  owner: number;
  /** px it may still travel */
  life: number;
  damage: number;
  /** it hit something (for the No Miss challenge) */
  hit: boolean;
}

/** An item lying on the floor. */
export interface Item {
  id: number;
  kind: ItemKind;
  x: number;
  y: number;
  ammo: number;
  boosted: boolean;
}

/** An item in flight. */
export interface Thrown {
  id: number;
  kind: ItemKind;
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  from: 'player' | 'red';
  ammo: number;
  boosted: boolean;
  /** px it may still fly */
  life: number;
  bounces: number;
  /** it has bounced off a wall (a kill now is a ricochet kill) */
  ricocheted: boolean;
  r: number;
  /** who threw it (it can't hit its thrower) */
  owner: number;
}

/** One tick of player intent. A replay is just a list of these. */
export interface TickInput {
  /** movement on each axis, -1..1 */
  mx: number;
  my: number;
  /** aim angle in radians */
  aim: number;
  /** left click: shoot, punch, or throw what can't be shot */
  fire: boolean;
  /** right click: throw what you hold */
  alt: boolean;
  /** pick up: 0 nothing, -1 the nearest item in reach, else that item's id */
  pick: number;
  /** Holster: swap hands */
  swap: boolean;
  /** Frameskip */
  dash: boolean;
}

export type Status = 'play' | 'dead' | 'clear';

export type KillCause = 'bullet' | 'punch' | 'throw' | 'dash' | 'charge' | 'friendly';

export type SimEvent =
  | { t: 'shot'; x: number; y: number; aim: number; item: ItemKind; from: 'player' | 'red' }
  | { t: 'punch'; x: number; y: number; aim: number; hit: boolean; from: 'player' | 'red' }
  | { t: 'throw'; x: number; y: number; item: ItemKind; from: 'player' | 'red' }
  | { t: 'pickup'; x: number; y: number; item: ItemKind; who: 'player' | 'red' }
  | { t: 'hit'; x: number; y: number; id: number; aim: number }
  | { t: 'stun'; x: number; y: number; id: number }
  | { t: 'disarm'; x: number; y: number; item: ItemKind }
  | { t: 'shatter'; x: number; y: number; id: number; kind: RedKind; aim: number; cause: KillCause; coins: number }
  | { t: 'break'; x: number; y: number; item: ItemKind }
  | { t: 'glass'; x: number; y: number }
  | { t: 'parry'; x: number; y: number }
  | { t: 'shield'; x: number; y: number }
  | { t: 'dash'; x: number; y: number; x2: number; y2: number }
  | { t: 'tell'; x: number; y: number; id: number; what: 'punch' | 'aim' | 'throw' | 'charge' | 'desk' }
  | { t: 'wall'; x: number; y: number }
  | { t: 'deflect'; x: number; y: number }
  | { t: 'wave'; n: number }
  | { t: 'spawn'; x: number; y: number; door: number }
  | { t: 'phase'; n: number }
  | { t: 'empty'; x: number; y: number }
  | { t: 'death'; x: number; y: number; aim: number; by: number }
  | { t: 'clear'; x: number; y: number };

/** What the player bought, as the sim sees it. Tiers are 0 (not bought) to 3. */
export interface Mods {
  stride: number;
  trigger: number;
  shield: number;
  frameskip: number;
  rewind: number;
  arm: number;
  mag: number;
  reach: number;
  holster: boolean;
  loadout: ItemKind | null;
}

export interface Stats {
  kills: number;
  shots: number;
  throws: number;
  punches: number;
  punchKills: number;
  stunKills: number;
  throwKills: number;
  ricochetKills: number;
  dashKills: number;
  parries: number;
  pickups: number;
  /** bullets of yours that hit nothing */
  misses: number;
  shieldsUsed: number;
  /** set by the app when a Rewind restores a snapshot */
  rewinds: number;
  maxCombo: number;
  /** the kind of the first red you shattered, '' until then */
  firstKill: string;
  bossPunch: boolean;
  /** coins earned so far this attempt, by line */
  killCoins: number;
  comboCoins: number;
  styleCoins: number;
}

export interface WaveState {
  /** index of the next wave in the level's list (the map's reds are wave 0, already placed) */
  next: number;
  /** game seconds until the next 'clear' wave, once the room is empty (-1 = not counting) */
  timer: number;
  pending: (SpawnDef & { t: number })[];
  /** how many waves have started, counting the first */
  started: number;
}

export interface World {
  level: string;
  goal: Goal;
  challenge: ChallengeId;
  par: number;
  tick: number;
  /** seeded RNG state (rng.ts) */
  rng: number;
  status: Status;
  nextId: number;
  cols: number;
  rows: number;
  /** collision tiles (grid.ts TILE_*), row by row */
  tiles: number[];
  /** what each cell looks like: the map letter, 'x' for a broken pane */
  look: string[];
  /** bumps whenever a tile changes, so the renderer and the flow field know */
  tilesVersion: number;
  /** door tiles in reading order, and game seconds each stays open */
  doors: { x: number; y: number; open: number }[];
  exit: { x: number; y: number } | null;
  /** distance in tiles from every cell to the player's cell (-1 = unreachable), and the cell it was built for */
  flow: number[];
  flowAt: number;
  flowVersion: number;
  player: Player;
  reds: Red[];
  bullets: Bullet[];
  items: Item[];
  thrown: Thrown[];
  /** the level's later waves and the boss's calls for help, copied in so a World is self-contained */
  waveDefs: WaveDef[];
  bossWaves: SpawnDef[][];
  waves: WaveState;
  combo: { count: number; timer: number };
  /** game seconds left on a Survive goal */
  surviveLeft: number;
  mods: Mods;
  stats: Stats;
}
