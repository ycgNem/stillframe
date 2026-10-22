// The reds (GAME_DESIGN §7). All red glass, all shatter. Speeds are px per game second.
import type { ItemKind } from './items';

export type RedKind =
  | 'grunt' | 'gunner' | 'brute' | 'runner' | 'sniper' | 'mirror' | 'splitter' | 'shardling'
  | 'manager' | 'conductor' | 'foreman' | 'dj' | 'eye';

export interface RedDef {
  name: string;
  /** how tall it stands on screen, px (for clicks and the HUD keeping out of its way) */
  tall: number;
  /** a chapter's boss: its fall stops the room and gets a card */
  boss?: boolean;
  hp: number;
  speed: number;
  radius: number;
  /** what it holds when it appears */
  item: ItemKind | null;
  /** starts a punch when the gap between its edge and yours is this small */
  punchStart: number;
  /** the punch lands if the gap is still within this reach, and you are inside its cone, when the windup ends */
  punchReach: number;
  windup: number;
  recover: number;
  /** a red with a gun aims this long (the red line) before it fires, and the aim locks for the last `aimLock` */
  aimTell: number;
  aimLock: number;
  fireCooldown: number;
  /** a red with an empty gun or a throwable winds up this long, then throws */
  throwTell: number;
  /** fires only within this distance */
  fireRange: number;
  /** a gunner keeps between these distances and strafes */
  keepMin: number;
  keepMax: number;
  /** share of its speed it keeps strafing at while its aim line is still dotted (0 = stands still) */
  aimStrafe: number;
  /** goes for a gun on the floor within this distance when unarmed (0 = never) */
  scavenge: number;
  /** weaves side to side this far (px) as it closes in (Runners) */
  zigzag?: number;
  /** bullets bounce off it, back the way they came (Mirrors) */
  reflect?: boolean;
  /** what it breaks into, two of them, the first time it shatters (Splitters) */
  splits?: RedKind;
  /** never walks (Snipers, the DJ in its booth, the Frame's eyes) */
  rooted?: boolean;
  /** a bullet or a punch takes at most this much off it (the Foreman's hard hat) */
  armour?: number;
  /** charges like a Brute */
  charges?: boolean;
  /** shrugs most of a throw's stun off, like a Brute */
  tough?: boolean;
}

const BASE: RedDef = {
  name: 'Grunt', tall: 22, hp: 3, speed: 30, radius: 4.5, item: null,
  punchStart: 6, punchReach: 10, windup: 0.5, recover: 0.4,
  aimTell: 0.55, aimLock: 0.15, fireCooldown: 1.2, throwTell: 0.4, fireRange: 150,
  keepMin: 0, keepMax: 0, aimStrafe: 0, scavenge: 64,
};

const BOSS = { boss: true, tough: true, scavenge: 0, punchStart: 7, punchReach: 12, windup: 0.55, recover: 0.45 };

export const REDS: Record<RedKind, RedDef> = {
  grunt: BASE,
  gunner: { ...BASE, name: 'Gunner', speed: 26, item: 'pistol', keepMin: 80, keepMax: 128, aimStrafe: 0.6, scavenge: 96 },
  brute: { ...BASE, name: 'Brute', tall: 30, hp: 9, speed: 20, radius: 6.5, punchStart: 7, punchReach: 12, windup: 0.6, recover: 0.5, scavenge: 0, charges: true, tough: true },
  runner: { ...BASE, name: 'Runner', speed: 58, radius: 4, windup: 0.4, recover: 0.5, scavenge: 0, zigzag: 1 },
  sniper: { ...BASE, name: 'Sniper', tall: 24, speed: 0, item: 'rifle', aimTell: 1.5, aimLock: 0.3, fireCooldown: 2.2, fireRange: 420, scavenge: 0, rooted: true },
  mirror: { ...BASE, name: 'Mirror', speed: 28, scavenge: 0, reflect: true },
  splitter: { ...BASE, name: 'Splitter', tall: 24, speed: 28, radius: 5, splits: 'shardling' },
  shardling: { ...BASE, name: 'Shard', tall: 14, hp: 1, speed: 50, radius: 3, windup: 0.4, recover: 0.3, punchStart: 5, punchReach: 8, scavenge: 0 },
  manager: { ...BASE, ...BOSS, name: 'The Manager', tall: 36, hp: 18, speed: 22, radius: 7.5 },
  conductor: { ...BASE, ...BOSS, name: 'The Conductor', tall: 36, hp: 18, speed: 26, radius: 7.5, charges: true },
  foreman: { ...BASE, ...BOSS, name: 'The Foreman', tall: 38, hp: 18, speed: 22, radius: 8, armour: 1, charges: true },
  dj: { ...BASE, ...BOSS, name: 'The DJ', tall: 30, hp: 15, speed: 0, radius: 7, rooted: true },
  eye: { ...BASE, name: 'An eye of the Frame', tall: 14, hp: 6, speed: 0, radius: 7, item: 'rifle', aimTell: 0.9, aimLock: 0.25, fireCooldown: 1.8, fireRange: 600, scavenge: 0, rooted: true, tough: true },
};

/** The Brute's charge: a straight line after a tell. Hitting a wall stuns it; reds in the way shatter. */
export const CHARGE = { tell: 0.8, speed: 135, time: 1.3, cooldown: 3.2, min: 36, max: 160, wallStun: 1.4 };

/** Bosses: phases begin when integrity drops to these; each opens with a roar (guard) and calls for help. */
export const BOSS_PHASES = { at: [12, 6], guard: 1.5, friendlyDamage: 1 };

/** The Manager (boss 1-8): throws desks, calls for help at each phase, charges once angry. */
export const MANAGER = {
  deskTell: 0.75,
  deskSpeed: 115,
  /** seconds between desk throws, per phase */
  deskCooldown: [2.6, 2.2, 1.7],
  /** phases begin when its integrity drops to these */
  phaseAt: BOSS_PHASES.at,
  /** charges only from this phase on */
  chargeFrom: 1,
  /** as a phase begins it roars and shrugs off damage this long, while help comes through the doors */
  phaseGuard: BOSS_PHASES.guard,
  /** a stray shot or desk from its own side only chips it, so you get the last word */
  friendlyDamage: BOSS_PHASES.friendlyDamage,
};

/** The Conductor (boss 2-8): rides the trains. When one stops it leaps off, lands where a circle shows, and
 *  fights on the platform until the next train takes it away. */
export const CONDUCTOR = {
  /** game s it crouches before leaping onto a train, and the landing circle's warning */
  boardTell: 0.5,
  landTell: 0.9,
  /** the landing kills anything this close */
  landRadius: 18,
  /** game s on the platform before it boards again, per phase */
  fight: [6, 5, 4],
  /** game s it rides before leaping off */
  ride: 3.5,
};

/** The Foreman (boss 3-8): a hard-hatted charger. Bullets and punches only chip it; a charge off the roof
 *  costs it a third of its integrity, and it climbs back up through a door. */
export const FOREMAN = { fallDamage: 6, climbBack: 2.2, beamTell: 0.7, beamSpeed: 120, beamCooldown: [3.4, 2.8, 2.2] };

/** The DJ (boss 4-8) lives in a glass booth and drops the beat: in game time, so standing still stops it. */
export const DJ = { recordTell: 0.6, recordSpeed: 130, recordCooldown: [2.8, 2.2, 1.6] };

/** The Frame (boss 5-8): its eyes only open while you move (while time runs); shut, they turn bullets. */
export const FRAME = { ringEvery: 4.2, ringTell: 0.8, ringBullets: 10, ringSpeed: 90, openSpeed: 8, ringStagger: 0.9 };

/** After a throw stuns a tough red, further throws only bounce off for this long. */
export const TOUGH_STEADY = 2.5;

/** Map letters for reds placed in a level. `q` is a grunt that starts with a pistol; bosses are digits. */
export const RED_LETTERS: Record<string, { kind: RedKind; item?: ItemKind | null }> = {
  g: { kind: 'grunt' },
  q: { kind: 'grunt', item: 'pistol' },
  G: { kind: 'gunner' },
  B: { kind: 'brute' },
  r: { kind: 'runner' },
  n: { kind: 'sniper' },
  i: { kind: 'mirror' },
  y: { kind: 'splitter' },
  M: { kind: 'manager' },
  '2': { kind: 'conductor' },
  '3': { kind: 'foreman' },
  '4': { kind: 'dj' },
  '5': { kind: 'eye' },
};
