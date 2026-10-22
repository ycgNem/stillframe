// Every tunable number lives here (CLAUDE.md rule 5). Units are pixels and game seconds unless noted.
// Weapons are in items.ts, reds in reds.ts, the workshop in upgrades.ts, levels in levels/.

/** Sim ticks per game second. Real ticks per second = TICK_RATE × the current time scale. */
export const TICK_RATE = 60;

/** Tile size in pixels (docs/STYLE.md §1). */
export const TILE = 16;

/** The time rule (GAME_DESIGN §4). */
export const TIME = {
  /** standing still: the world creeps */
  idle: 0.03,
  /** walking at full speed (Stride lowers it) */
  walk: 1,
  /** during an action burst */
  burstScale: 1,
  /** game seconds an action (shot, punch, throw, pickup) runs time at burstScale (Trigger shortens it) */
  burst: 0.18,
  /** how quickly the scale chases its target, per real second, rising and falling */
  rampUp: 14,
  rampDown: 10,
};

export const PLAYER = {
  speed: 72,
  /** half-size of the collision box */
  radius: 4.5,
  /** px/s² toward the input direction, and back to rest: full speed in about 0.08 s */
  accel: 900,
  decel: 1200,
  /** fists: the gap between your edge and the red's, and the cone in front (radians, full width) */
  punchReach: 15,
  punchArc: 2.0,
  punchCooldown: 0.35,
  punchDamage: 1,
  /** a punched red is stunned this long and knocked back this far */
  punchStun: 0.35,
  punchKnock: 4,
  throwSpeed: 240,
  /** thrown items drop after flying this far */
  throwRange: 190,
  throwCooldown: 0.25,
  /** after a shield breaks, nothing can hurt you for this long */
  shieldGrace: 0.6,
  /** shield II stuns reds within this radius when it breaks */
  shieldStunRadius: 32,
  shieldStun: 0.8,
  /** brushing a wall corner by up to this many px slides you round it */
  cornerSlide: 4,
};

export const COMBAT = {
  /** red guns fire slower bullets than yours, so a frozen room is always readable and dodgeable */
  redBulletScale: 0.62,
  /** random aim error of a red's shot, radians either way */
  redSpread: 0.035,
  /** your bullet cancels a red bullet that was already in flight when you fired, if they pass this close */
  parryRadius: 2,
  bulletRadius: 1,
  thrownRadius: 3,
  /** a thrown item that hits a red stuns it this long (brutes and bosses shrug most of it off); punches
   *  landed meanwhile keep it stunned, so a throw followed by fists is a stun kill */
  throwStun: 1.6,
  bruteThrowStun: 0.4,
  /** an armed red hit by a throw or a punch drops its weapon this far toward you, and may not pick
   *  anything up for `regrab` game s */
  disarmDrop: 18,
  regrab: 0.8,
};

/** Frameskip (GAME_DESIGN §12): an instant dash toward the aim. Indexed by tier (0 = locked). */
export const FRAMESKIP = {
  tiles: [0, 3, 4, 4],
  cooldown: [0, 4, 2.5, 2.5],
};

/** Rewind (GAME_DESIGN §12): snapshots every `every` game s, keep `keep` s, jump back `back` s. */
export const REWIND = { every: 0.25, keep: 3, back: 2, realSeconds: 0.6 };

/** Coins (GAME_DESIGN §10). */
export const COINS = {
  kill: 2,
  brute: 5,
  boss: 25,
  /** the Nth kill in a chain, each within comboWindow game s of the last, adds N-1 */
  comboWindow: 1.0,
  stunKill: 2,
  throwKill: 2,
  parry: 2,
  ricochet: 3,
  frameskip: 2,
  clear: 5,
  untouched: 5,
  star: 10,
  /** a repeat clear pays this share of its coin lines; stars pay only the first time */
  repeat: 0.5,
};

/** Waves: reds come through doors one after another, this far apart, after this pause. */
export const WAVES = { stagger: 0.45, clearDelay: 0.8, enterTime: 0.55 };
