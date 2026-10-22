// A short fingerprint of a whole World, for replay tests and the replay self-check.
import { hashStr } from './rng';
import type { World } from './types';

export function stateHash(w: World): string {
  return hashStr(JSON.stringify(w)).toString(16).padStart(8, '0');
}

/** A deep copy through JSON (World is plain data, CLAUDE.md rule 7): snapshots for Rewind. */
export function cloneWorld(w: World): World {
  return JSON.parse(JSON.stringify(w)) as World;
}
