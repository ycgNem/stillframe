// The coin tally after a clear (GAME_DESIGN §10): lines that count up one by one, and stars that stamp in.
import { COINS } from '../data/tuning';
import { starsOf } from '../sim/challenges';
import type { World } from '../sim/types';
import type { LevelRecord } from './save';

export interface TallyLine {
  label: string;
  coins: number;
}

export interface Tally {
  lines: TallyLine[];
  total: number;
  /** stars this run earned, and which of them are new */
  stars: [boolean, boolean, boolean];
  fresh: [boolean, boolean, boolean];
  /** a repeat clear pays half */
  repeat: boolean;
  ticks: number;
  /** a new best time */
  best: boolean;
}

const STAR_NAMES = ['Clear', 'Par', 'Challenge'];

export function tally(w: World, prev: LevelRecord | undefined): Tally {
  const s = w.stats;
  const repeat = !!prev && prev.clears > 0;
  const k = repeat ? COINS.repeat : 1;
  const pay = (n: number) => Math.floor(n * k);
  const lines: TallyLine[] = [];
  lines.push({ label: `Shattered ×${s.kills}`, coins: pay(s.killCoins) });
  if (s.comboCoins) lines.push({ label: `Combos, best ×${s.maxCombo}`, coins: pay(s.comboCoins) });
  if (s.styleCoins) lines.push({ label: styleLabel(w), coins: pay(s.styleCoins) });
  lines.push({ label: 'Level clear', coins: pay(COINS.clear) });
  if (s.shieldsUsed === 0 && s.rewinds === 0) lines.push({ label: 'Untouched', coins: pay(COINS.untouched) });
  const stars = starsOf(w);
  const had = prev?.stars ?? [false, false, false];
  const fresh: [boolean, boolean, boolean] = [stars[0] && !had[0], stars[1] && !had[1], stars[2] && !had[2]];
  fresh.forEach((f, i) => {
    if (f) lines.push({ label: `New star: ${STAR_NAMES[i]}`, coins: COINS.star });
  });
  const total = lines.reduce((n, l) => n + l.coins, 0);
  return { lines, total, stars, fresh, repeat, ticks: w.tick, best: !prev || prev.best === 0 || w.tick < prev.best };
}

function styleLabel(w: World): string {
  const s = w.stats, parts: string[] = [];
  if (s.stunKills) parts.push(`${s.stunKills} stun`);
  if (s.throwKills) parts.push(`${s.throwKills} throw`);
  if (s.parries) parts.push(`${s.parries} parry`);
  if (s.ricochetKills) parts.push(`${s.ricochetKills} bounce`);
  if (s.dashKills) parts.push(`${s.dashKills} skip`);
  return `Style: ${parts.join(', ')}`;
}
