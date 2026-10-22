// Every level loads, makes sense, and is cleared by a scripted bot run (docs/PLAN.md M3). A recorded run
// replays to the same final state (M4).
import { describe, expect, it } from 'vitest';
import { ITEM_LETTERS } from '../src/data/items';
import { LEVELS } from '../src/data/levels';
import { RED_LETTERS } from '../src/data/reds';
import { stateHash } from '../src/sim/hash';
import { createWorld, step } from '../src/sim/world';
import { botRun } from './helpers';

const LETTERS = new Set([...' #.,=DEXP', ...'TCSFVOWKHR', ...Object.keys(ITEM_LETTERS), ...Object.keys(RED_LETTERS)]);

describe('level data', () => {
  for (const l of LEVELS) {
    it(`${l.id} ${l.name} is well formed`, () => {
      const widths = new Set(l.map.map((r) => r.length));
      expect(widths.size).toBe(1);
      const bad = l.map.join('').split('').filter((c) => !LETTERS.has(c));
      expect(bad).toEqual([]);
      expect(l.map.join('').split('P')).toHaveLength(2);
      const w = createWorld(l);
      const doorsUsed = [...l.waves.flatMap((v) => v.reds), ...(l.bossWaves ?? []).flat()].map((s) => s.door);
      for (const d of doorsUsed) expect(d).toBeLessThan(w.doors.length);
      if (l.goal.kind === 'escape') expect(w.exit).not.toBeNull();
      expect(w.reds.length + l.waves.length).toBeGreaterThan(0);
    });
  }
});

describe('every level can be cleared', () => {
  for (const l of LEVELS) {
    it(`${l.id} ${l.name}: the bot clears it, and the replay matches`, () => {
      const { w, inputs } = botRun(l);
      expect(w.status, `${l.id} ended ${w.status} at ${(w.tick / 60).toFixed(1)} s with ${w.reds.length} reds left`).toBe('clear');
      const again = createWorld(l);
      for (const inp of inputs) step(again, inp);
      expect(stateHash(again)).toBe(stateHash(w));
    }, 20000);
  }
});
