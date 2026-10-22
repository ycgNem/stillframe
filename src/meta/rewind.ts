// Rewind (GAME_DESIGN §12): a ring buffer of World snapshots, one every 0.25 game seconds for the last 3,
// and the jump back. It lives outside the sim (the World never holds copies of itself) and is pure, so it
// can be tested headless. A rewind also cuts the recorded inputs back to the snapshot, so the replay of a
// clear shows the run that worked.
import { REWIND, TICK_RATE } from '../data/tuning';
import { cloneWorld } from '../sim/hash';
import type { TickInput, World } from '../sim/types';

export interface Snap {
  tick: number;
  world: World;
}

export interface RewindBuffer {
  snaps: Snap[];
}

/** A buffer holding the level as it starts. */
export function newRewind(w: World): RewindBuffer {
  return { snaps: [{ tick: w.tick, world: cloneWorld(w) }] };
}

/** Call after every tick: keeps a snapshot every `REWIND.every` game seconds, the last `REWIND.keep`. */
export function keepSnap(b: RewindBuffer, w: World) {
  if (w.status !== 'play' || w.tick % Math.round(REWIND.every * TICK_RATE) !== 0) return;
  b.snaps.push({ tick: w.tick, world: cloneWorld(w) });
  const keep = Math.round(REWIND.keep / REWIND.every) + 1;
  if (b.snaps.length > keep) b.snaps.shift();
}

/**
 * Jumps back about `REWIND.back` game seconds: returns a fresh copy of the newest snapshot at least that
 * old (the oldest one if none is), cuts `rec` to its tick and forgets the snapshots after it. The use is
 * counted in the World's stats (for the Untouched bonus).
 */
export function rewind(b: RewindBuffer, w: World, rec: TickInput[]): World {
  const target = w.tick - Math.round(REWIND.back * TICK_RATE);
  let snap = b.snaps[0];
  for (const s of b.snaps) if (s.tick <= target) snap = s;
  const used = w.stats.rewinds + 1;
  const back = cloneWorld(snap.world);
  back.stats.rewinds = used;
  rec.length = snap.tick;
  b.snaps = b.snaps.filter((s) => s.tick <= snap.tick);
  return back;
}
