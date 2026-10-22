import { describe, expect, it } from 'vitest';
import { TIME } from '../src/data/tuning';
import { TIER_VALUES } from '../src/data/upgrades';
import { createTime, spendBurst, startBurst, updateTime, type TimeState } from '../src/sim/time';

const FRAME = 1 / 60;

function run(t: TimeState, move: number, frames: number) {
  for (let i = 0; i < frames; i++) updateTime(t, move, FRAME);
  return t;
}

describe('time rule', () => {
  it('crawls while the player stands still', () => {
    expect(run(createTime(), 0, 120).scale).toBeCloseTo(TIME.idle, 4);
  });

  it('runs at walking speed while the player moves', () => {
    expect(run(createTime(), 1, 120).scale).toBeCloseTo(TIME.walk, 4);
  });

  it('ramps up within a few frames, not instantly', () => {
    const t = run(createTime(), 1, 3);
    expect(t.scale).toBeGreaterThan(0.4);
    expect(t.scale).toBeLessThan(TIME.walk);
  });

  it('an action runs full speed at once and holds it until the burst is spent', () => {
    const t = createTime();
    startBurst(t);
    expect(t.scale).toBe(TIME.burstScale);
    run(t, 0, 30);
    expect(t.scale).toBe(TIME.burstScale);
    spendBurst(t, TIME.burst);
    expect(run(t, 0, 120).scale).toBeCloseTo(TIME.idle, 4);
  });

  it('Stride slows walking time and Trigger shortens the burst', () => {
    expect(run(createTime(3, 0), 1, 120).scale).toBeCloseTo(TIER_VALUES.strideWalk[3], 4);
    const t = createTime(0, 2);
    startBurst(t);
    expect(t.burst).toBeCloseTo(TIER_VALUES.triggerBurst[2], 6);
  });
});
