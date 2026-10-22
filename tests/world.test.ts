import { describe, expect, it } from 'vitest';
import { LEVELS } from '../src/data/levels';
import { TICK_RATE } from '../src/data/tuning';
import { stateHash } from '../src/sim/hash';
import { createWorld, step } from '../src/sim/world';
import { input, room, run } from './helpers';

/** A fixed input script: strafe left and right, sweep the aim, fire now and then. */
function scripted(ticks: number) {
  const w = createWorld(LEVELS[0]);
  for (let i = 0; i < ticks && w.status === 'play'; i++) {
    step(w, input({ mx: Math.sign(Math.sin(i / 20)), aim: i / 30, fire: i % 25 === 0, pick: i === 2 ? -1 : 0 }));
  }
  return w;
}

/** Only numbers, strings, booleans, null, arrays and plain objects (CLAUDE.md rule 7). */
function isPlain(v: unknown): boolean {
  if (v === null) return true;
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v === 'string' || typeof v === 'boolean') return true;
  if (Array.isArray(v)) return v.every(isPlain);
  if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) return Object.values(v).every(isPlain);
  return false;
}

describe('world', () => {
  it('is deterministic: same level and inputs give the same state', () => {
    expect(stateHash(scripted(600))).toBe(stateHash(scripted(600)));
  });

  it('keeps its state plain data that survives a JSON round-trip', () => {
    const w = scripted(300);
    expect(isPlain(w)).toBe(true);
    expect(JSON.parse(JSON.stringify(w))).toEqual(w);
  });

  it('walls stop the player; diagonals are no faster than straight lines', () => {
    const hold = { goal: { kind: 'survive', seconds: 99 } } as const;
    const w = room(['#####', '#P..#', '#####'], hold);
    run(w, 120, input({ mx: -1 }));
    expect(w.player.x).toBeGreaterThanOrEqual(16 + w.player.r);
    const a = room(['##########', '#P.......#', '#........#', '#........#', '##########'], hold);
    const b = room(['##########', '#P.......#', '#........#', '#........#', '##########'], hold);
    run(a, 20, input({ mx: 1 }));
    run(b, 20, input({ mx: 1, my: 1 }));
    const da = Math.hypot(a.player.x - 24, a.player.y - 24), db = Math.hypot(b.player.x - 24, b.player.y - 24);
    expect(db).toBeLessThanOrEqual(da + 0.01);
  });

  it('accelerates over a few ticks instead of snapping to full speed', () => {
    const w = room(['##########', '#P.......#', '##########'], { goal: { kind: 'survive', seconds: 99 } });
    step(w, input({ mx: 1 }));
    const first = w.player.x - w.player.px;
    run(w, 10, input({ mx: 1 }));
    const later = w.player.x - w.player.px;
    expect(first).toBeLessThan(later);
    expect(later).toBeCloseTo(72 / TICK_RATE, 3);
  });

  it('a grunt walks around a wall to reach a player who stands still', () => {
    const w = room([
      '#########',
      '#P..#..g#',
      '#...#...#',
      '#.......#',
      '#########',
    ]);
    const ev = run(w, 60 * 20);
    expect(ev.some((e) => e.t === 'tell' && e.what === 'punch')).toBe(true);
    expect(w.status).toBe('dead');
  });
});
