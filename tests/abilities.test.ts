// M8: the abilities that bend the rules, each checked in a scripted run (docs/PLAN.md M8).
import { describe, expect, it } from 'vitest';
import { levelById } from '../src/data/levels';
import { PLAYER, REWIND, TICK_RATE } from '../src/data/tuning';
import { keepSnap, newRewind, rewind } from '../src/meta/rewind';
import { stateHash } from '../src/sim/hash';
import type { TickInput } from '../src/sim/types';
import { createWorld, step } from '../src/sim/world';
import { botInput, newBot } from '../src/bot/bot';
import { room, run } from './helpers';

const OPEN = ['############', '#..........#', '#..........#', '#..........#', '#..........#', '#..........#', '############'];
function place(...marks: [string, number, number][]) {
  const rows = OPEN.map((r) => r.split(''));
  for (const [c, x, y] of marks) rows[y][x] = c;
  return rows.map((r) => r.join(''));
}

describe('Rewind', () => {
  it('keeps a snapshot every 0.25 game s for the last 3 s', () => {
    const w = createWorld(levelById('1-5'));
    const b = newRewind(w);
    const m = newBot();
    for (let i = 0; i < TICK_RATE * 5; i++) {
      step(w, botInput(w, m));
      keepSnap(b, w);
    }
    const every = Math.round(REWIND.every * TICK_RATE);
    expect(b.snaps.length).toBe(Math.round(REWIND.keep / REWIND.every) + 1);
    for (const s of b.snaps) expect(s.tick % every).toBe(0);
    expect(b.snaps[b.snaps.length - 1].tick).toBe(w.tick - (w.tick % every));
  });

  it('jumps back about 2 s, cuts the inputs to match, and the cut inputs replay to the same moment', () => {
    const def = levelById('1-5');
    const w = createWorld(def);
    const b = newRewind(w);
    const m = newBot();
    const rec: TickInput[] = [];
    for (let i = 0; i < TICK_RATE * 4 + 17; i++) {
      const inp = botInput(w, m);
      rec.push(inp);
      step(w, inp);
      keepSnap(b, w);
    }
    const before = w.tick;
    const back = rewind(b, w, rec);
    expect(before - back.tick).toBeGreaterThanOrEqual(REWIND.back * TICK_RATE);
    expect(before - back.tick).toBeLessThan((REWIND.back + REWIND.every) * TICK_RATE);
    expect(rec.length).toBe(back.tick);
    expect(back.stats.rewinds).toBe(1);
    const again = createWorld(def);
    for (const inp of rec) step(again, inp);
    expect(stateHash({ ...again, stats: { ...again.stats, rewinds: 1 } })).toBe(stateHash(back));
  });

  it('undoes a spent shield too', () => {
    const w = room(place(['P', 3, 3], ['g', 4, 3]), {}, { shield: 1 });
    const b = newRewind(w);
    const rec: TickInput[] = [];
    let spent = -1;
    for (let i = 0; i < TICK_RATE * 6 && w.status === 'play'; i++) {
      const inp: TickInput = { mx: 0, my: 0, aim: 0, fire: false, alt: false, pick: 0, swap: false, dash: false };
      rec.push(inp);
      step(w, inp);
      keepSnap(b, w);
      if (spent < 0 && w.player.shield === 0) spent = w.tick;
    }
    expect(spent).toBeGreaterThan(0);
    const back = rewind(b, w, rec);
    expect(back.tick).toBeLessThan(spent);
    expect(back.player.shield).toBe(1);
  });
});

describe('Shield', () => {
  it('Shield II: its break stuns the reds around you', () => {
    const w = room(place(['P', 3, 3], ['g', 4, 3], ['g', 3, 4]), {}, { shield: 2 });
    const ev = run(w, TICK_RATE * 3);
    const broke = ev.findIndex((e) => e.t === 'shield');
    expect(broke).toBeGreaterThanOrEqual(0);
    const stunned = ev.slice(broke).filter((e) => e.t === 'stun');
    expect(stunned.length).toBeGreaterThanOrEqual(1);
  });

  it('Shield III: two free hits, and a grace moment after each', () => {
    const w = room(place(['P', 3, 3], ['g', 4, 3]), {}, { shield: 3 });
    expect(w.player.shield).toBe(2);
    const ev = run(w, TICK_RATE * 12);
    expect(ev.filter((e) => e.t === 'shield').length).toBe(2);
    expect(w.stats.shieldsUsed).toBe(2);
    expect(PLAYER.shieldGrace).toBeGreaterThan(0.4);
  });
});
