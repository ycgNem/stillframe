// Stars (GAME_DESIGN §8): clear, par, and the level's challenge, judged from the World at the clear.
import { TICK_RATE } from '../data/tuning';
import type { ChallengeId } from '../data/levels/types';
import type { World } from './types';

export function challengeMet(c: ChallengeId, w: World): boolean {
  const s = w.stats;
  switch (c.id) {
    case 'fists':
      return s.shots === 0 && s.throws === 0;
    case 'noShots':
      return s.shots === 0;
    case 'stunKills':
      return s.stunKills + s.throwKills + s.ricochetKills >= c.n;
    case 'gunnerFirst':
      return s.firstKill === 'gunner';
    case 'parries':
      return s.parries >= c.n;
    case 'combo':
      return s.maxCombo >= c.n;
    case 'noKills':
      return s.kills === 0;
    case 'noMiss':
      return s.shots > 0 && s.misses === 0;
    case 'punchKills':
      return s.punchKills >= c.n;
    case 'kills':
      return s.kills >= c.n;
    case 'bossPunch':
      return s.bossPunch;
    case 'untouched':
      return s.shieldsUsed === 0 && s.rewinds === 0;
    case 'hazardKills':
      return s.hazardKills >= c.n;
    case 'dropKills':
      return s.dropKills >= c.n;
    case 'slashKills':
      return s.slashKills >= c.n;
    case 'noFists':
      return s.punches === 0;
    case 'bossDrops':
      return s.bossDrops;
  }
}

/** The three stars of a cleared World: [clear, par, challenge]. Surviving a Survive level is its par. */
export function starsOf(w: World): [boolean, boolean, boolean] {
  const clear = w.status === 'clear';
  const par = w.goal.kind === 'survive' || w.tick <= Math.round(w.par * TICK_RATE);
  return [clear, clear && par, clear && challengeMet(w.challenge, w)];
}
