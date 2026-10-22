// The reds (GAME_DESIGN §7). All red glass, all shatter. Speeds are px per game second.
import type { ItemKind } from './items';

export type RedKind = 'grunt' | 'gunner' | 'brute' | 'manager';

export interface RedDef {
  name: string;
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
}

const BASE: RedDef = {
  name: 'GRUNT', hp: 3, speed: 30, radius: 4.5, item: null,
  punchStart: 6, punchReach: 10, windup: 0.5, recover: 0.4,
  aimTell: 0.55, aimLock: 0.15, fireCooldown: 1.2, throwTell: 0.4, fireRange: 150,
  keepMin: 0, keepMax: 0, aimStrafe: 0, scavenge: 64,
};

export const REDS: Record<RedKind, RedDef> = {
  grunt: BASE,
  gunner: { ...BASE, name: 'GUNNER', speed: 26, item: 'pistol', keepMin: 80, keepMax: 128, aimStrafe: 0.6, scavenge: 96 },
  brute: { ...BASE, name: 'BRUTE', hp: 9, speed: 20, radius: 6.5, punchStart: 7, punchReach: 12, windup: 0.6, recover: 0.5, scavenge: 0 },
  manager: { ...BASE, name: 'THE MANAGER', hp: 18, speed: 22, radius: 7.5, punchStart: 7, punchReach: 12, windup: 0.55, recover: 0.45, scavenge: 0 },
};

/** The Brute's charge: a straight line after a tell. Hitting a wall stuns it; reds in the way shatter. */
export const CHARGE = { tell: 0.8, speed: 135, time: 1.3, cooldown: 3.2, min: 36, max: 160, wallStun: 1.4 };

/** The Manager (boss 1-8): throws desks, calls for help at each phase, charges once angry. */
export const MANAGER = {
  deskTell: 0.75,
  deskSpeed: 115,
  /** seconds between desk throws, per phase */
  deskCooldown: [2.6, 2.2, 1.7],
  /** phases begin when its integrity drops to these */
  phaseAt: [12, 6],
  /** charges only from this phase on */
  chargeFrom: 1,
  /** as a phase begins it roars and shrugs off damage this long, while help comes through the doors */
  phaseGuard: 1.5,
  /** a stray shot or desk from its own side only chips it, so you get the last word */
  friendlyDamage: 1,
};

/** After a throw stuns a brute or the Manager, further throws only bounce off for this long. */
export const TOUGH_STEADY = 2.5;

/** Map letters for reds placed in a level. `q` is a grunt that starts with a pistol. */
export const RED_LETTERS: Record<string, { kind: RedKind; item?: ItemKind | null }> = {
  g: { kind: 'grunt' },
  q: { kind: 'grunt', item: 'pistol' },
  G: { kind: 'gunner' },
  B: { kind: 'brute' },
  M: { kind: 'manager' },
};
