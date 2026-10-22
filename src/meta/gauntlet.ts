// Gauntlet rounds (GAME_DESIGN §14): endless waves, five to an arena, the arenas in turn, and from the
// second arena on a glitch each. A round is an ordinary level (a LevelDef), so the sim, the bot and the
// replays need nothing new. Built from the wave number alone (no Math.random): the same run every time.
import { ARENAS, GAUNTLET, GAUNTLET_POOL } from '../data/gauntlet';
import type { Glitch, LevelDef, SpawnDef } from '../data/levels/types';
import type { World } from '../sim/types';

/** A small seeded generator, so wave n always holds the same reds. */
function rng(seed: number) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return s / 4294967296;
  };
}

/** The reds of wave n (counting from 1 across the whole run), spread over four doors. */
export function waveReds(n: number): SpawnDef[] {
  const rnd = rng(n);
  const count = Math.min(GAUNTLET.maxReds, GAUNTLET.baseReds + Math.floor(n * GAUNTLET.perWave));
  const out: SpawnDef[] = [];
  let brutes = 0;
  for (let i = 0; i < count; i++) {
    const pool = GAUNTLET_POOL.filter((p) => n >= p.from && (p.kind !== 'brute' || brutes < GAUNTLET.maxBrutes));
    const total = pool.reduce((a, p) => a + p.weight, 0);
    let pick = rnd() * total;
    const p = pool.find((q) => (pick -= q.weight) < 0) ?? pool[0];
    if (p.kind === 'brute') brutes++;
    out.push({ kind: p.kind, door: (i + n) % 4, ...(p.item !== undefined ? { item: p.item } : {}) });
  }
  return out;
}

/** What glitch round r (from 0) plays under: none in the first arena, then each in turn. */
export function roundGlitch(r: number): Glitch | 'wells' | null {
  return r === 0 ? null : GAUNTLET.glitches[(r - 1) % GAUNTLET.glitches.length];
}

/** Round r (from 0): its arena, its five waves, its glitch. */
export function gauntletRound(r: number): LevelDef {
  return buildRound(r, r % ARENAS.length, roundGlitch(r), r * GAUNTLET.roundWaves + 1);
}

/** A round in arena `a` under `glitch`, its waves starting at wave `first`. */
export function buildRound(r: number, a: number, glitch: Glitch | 'wells' | null, first: number): LevelDef {
  const arena = ARENAS[a];
  return {
    id: `G${r + 1}`, name: arena.name, seed: 9001 + r * 17, theme: arena.theme,
    goal: { kind: 'clear' }, par: 0,
    challenge: { id: 'kills', n: 0 }, challengeText: '', tip: '',
    map: arena.map, trains: arena.trains, beat: arena.beat, strobe: arena.strobe,
    wells: glitch === 'wells' ? arena.wells : undefined,
    glitch: glitch === 'wells' ? undefined : glitch ?? undefined,
    waves: Array.from({ length: GAUNTLET.roundWaves }, (_, i) => ({
      when: i === 0 ? ('time' as const) : ('clear' as const),
      ...(i === 0 ? { at: GAUNTLET.firstWave } : {}),
      reds: waveReds(first + i),
    })),
  };
}

/** Waves of this round you have cleared: every wave started, less the one still in the room. */
export function wavesCleared(w: World): number {
  const fighting = w.reds.some((r) => !r.dead) || w.waves.pending.length > 0;
  return Math.max(0, w.waves.next - (fighting ? 1 : 0));
}

/** Coins for clearing waves `from`..`to` (counted from 1 across the run). */
export function waveCoins(from: number, to: number): number {
  let c = 0;
  for (let n = from; n <= to; n++) c += GAUNTLET.waveBase + n * GAUNTLET.wavePer;
  return c;
}
