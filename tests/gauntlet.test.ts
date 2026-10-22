// Gauntlet (GAME_DESIGN §14, docs/PLAN.md M12): rounds built from the wave number, arenas in turn, a glitch
// from the second arena on, and every arena beatable.
import { describe, expect, it } from 'vitest';
import { ARENAS, GAUNTLET } from '../src/data/gauntlet';
import { buildRound, gauntletRound, roundGlitch, waveCoins, waveReds, wavesCleared } from '../src/meta/gauntlet';
import { createWorld, step } from '../src/sim/world';
import { botRun, input, run } from './helpers';

describe('gauntlet rounds', () => {
  it('builds the same waves every time, and they grow', () => {
    expect(waveReds(7)).toEqual(waveReds(7));
    expect(waveReds(1).every((s) => s.kind === 'grunt')).toBe(true);
    expect(waveReds(20).length).toBeGreaterThan(waveReds(2).length);
    for (let n = 1; n <= 60; n++) {
      const w = waveReds(n);
      expect(w.length).toBeLessThanOrEqual(GAUNTLET.maxReds);
      expect(w.filter((s) => s.kind === 'brute').length).toBeLessThanOrEqual(GAUNTLET.maxBrutes);
      expect(w.every((s) => s.door >= 0 && s.door < 4)).toBe(true);
    }
  });

  it('rotates arenas and glitches: none at first, then each in turn', () => {
    expect(roundGlitch(0)).toBeNull();
    expect([1, 2, 3, 4].map(roundGlitch)).toEqual(GAUNTLET.glitches);
    expect(gauntletRound(0).name).toBe(ARENAS[0].name);
    expect(gauntletRound(ARENAS.length).name).toBe(ARENAS[0].name);
    expect(gauntletRound(1).glitch).toBe('inverse');
    expect(gauntletRound(3).wells?.length).toBeGreaterThan(0);
    const r = gauntletRound(2);
    expect(r.waves).toHaveLength(GAUNTLET.roundWaves);
    expect(r.waves[0].reds).toEqual(waveReds(2 * GAUNTLET.roundWaves + 1));
  });

  it('every arena has four doors and its round loads', () => {
    for (let r = 0; r < ARENAS.length; r++) {
      const w = createWorld(gauntletRound(r));
      expect(w.doors).toHaveLength(4);
      expect(w.reds).toHaveLength(0);
    }
  });

  it('counts the waves you cleared, and pays more for later ones', () => {
    const w = createWorld(gauntletRound(0));
    expect(wavesCleared(w)).toBe(0);
    run(w, 60, input());
    expect(w.waves.next).toBe(1);
    expect(wavesCleared(w)).toBe(0);
    expect(waveCoins(1, 1)).toBe(GAUNTLET.waveBase + GAUNTLET.wavePer);
    expect(waveCoins(6, 10)).toBeGreaterThan(waveCoins(1, 5));
  });

  // every arena under its own glitch, on the opening waves, so each is shown beatable
  for (let a = 0; a < ARENAS.length; a++) {
    const glitch = roundGlitch(a);
    it(`the bot clears waves 1–5 in the ${ARENAS[a].name}${glitch ? ` under ${glitch}` : ''}`, () => {
      const def = buildRound(a, a, glitch, 1);
      const { w, inputs } = botRun(def);
      expect(w.status, `${ARENAS[a].name} ended ${w.status} at ${(w.tick / 60).toFixed(1)} s, wave ${w.waves.next}`).toBe('clear');
      expect(wavesCleared(w)).toBe(GAUNTLET.roundWaves);
      const again = createWorld(def);
      for (const inp of inputs) step(again, inp);
      expect(again.tick).toBe(w.tick);
    }, 30000);
  }

  it('a run lasts: the bot gets through the first two arenas', () => {
    for (const r of [0, 1]) expect(botRun(gauntletRound(r)).w.status).toBe('clear');
  }, 30000);
});
