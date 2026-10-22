// One tick of game time. step() advances exactly 1/60 s; how many ticks run per real second is the time
// rule's business (time.ts), not the sim's, which is what makes real-speed replays and Rewind possible.
import { TICK_RATE } from '../data/tuning';
import { separate, stepReds } from './ai';
import { cellIndex } from './grid';
import { stepHazards } from './hazards';
import { stepCombo } from './kills';
import { updateFlow } from './nav';
import { stepPlayer } from './player';
import { stepBullets, stepThrown } from './shots';
import type { SimEvent, TickInput, World } from './types';
import { stepWaves, wavesLeft } from './waves';

export { createWorld, NO_MODS } from './level';

const DT = 1 / TICK_RATE;

export const STILL: TickInput = { mx: 0, my: 0, aim: 0, fire: false, alt: false, pick: 0, swap: false, dash: false };

export function step(w: World, input: TickInput): SimEvent[] {
  const ev: SimEvent[] = [];
  if (w.status !== 'play') return ev;
  w.tick++;
  const p = w.player;
  p.px = p.x;
  p.py = p.y;
  for (const r of w.reds) {
    r.px = r.x;
    r.py = r.y;
  }
  for (const b of w.bullets) {
    b.px = b.x;
    b.py = b.y;
  }
  for (const t of w.thrown) {
    t.px = t.x;
    t.py = t.y;
  }

  stepPlayer(w, input, ev);
  stepHazards(w, ev);
  updateFlow(w);
  stepReds(w, ev);
  separate(w);
  stepBullets(w, ev);
  stepThrown(w, ev);
  w.reds = w.reds.filter((r) => !r.dead);
  stepWaves(w, ev);
  stepCombo(w);
  if (w.status !== 'play') return ev;

  const g = w.goal;
  let won = false;
  if (g.kind === 'clear') won = w.reds.length === 0 && !wavesLeft(w);
  else if (g.kind === 'escape') won = !!w.exit && cellIndex(w, p.x, p.y) === cellIndex(w, w.exit.x, w.exit.y);
  else {
    // counted in whole ticks, so 30 seconds is exactly 1800 of them
    const need = Math.round(g.seconds * TICK_RATE);
    w.surviveLeft = Math.max(0, (need - w.tick) * DT);
    won = w.tick >= need;
  }
  if (won) {
    w.status = 'clear';
    ev.push({ t: 'clear', x: p.x, y: p.y });
  }
  return ev;
}

/** Game seconds since the level began. */
export function gameTime(w: World): number {
  return w.tick / TICK_RATE;
}

/** Reds still to beat: alive now plus those waiting at the doors (and waves not yet started). */
export function redsLeft(w: World): number {
  let n = w.reds.length + w.waves.pending.length;
  for (let i = w.waves.next; i < w.waveDefs.length; i++) n += w.waveDefs[i].reds.length;
  return n;
}
