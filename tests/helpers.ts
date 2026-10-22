// Shared test helpers: tiny rooms from ASCII, scripted inputs, and running a level with the bot.
import { newBot, botInput } from '../src/bot/bot';
import type { LevelDef } from '../src/data/levels/types';
import { createWorld, NO_MODS, step, STILL } from '../src/sim/world';
import type { Mods, SimEvent, TickInput, World } from '../src/sim/types';

export function room(map: string[], extra: Partial<LevelDef> = {}, mods: Partial<Mods> = {}): World {
  const def: LevelDef = {
    id: 'test', name: 'TEST', seed: 7, goal: { kind: 'clear' }, par: 99, challenge: { id: 'fists' },
    challengeText: '', tip: '', map, waves: [], ...extra,
  };
  return createWorld(def, { ...NO_MODS, ...mods });
}

export function input(o: Partial<TickInput> = {}): TickInput {
  return { ...STILL, ...o };
}

/** Steps `n` ticks with the same input (or a function of the tick), collecting events. */
export function run(w: World, n: number, inp: TickInput | ((w: World, i: number) => TickInput) = STILL): SimEvent[] {
  const all: SimEvent[] = [];
  for (let i = 0; i < n && w.status === 'play'; i++) all.push(...step(w, typeof inp === 'function' ? inp(w, i) : inp));
  return all;
}

export function aimAt(w: World, x: number, y: number) {
  return Math.atan2(y - w.player.y, x - w.player.x);
}

/** Plays a level with the bot until it ends. Returns the inputs it used, for replays. */
export function botRun(def: LevelDef, mods: Mods = NO_MODS, maxTicks = 60 * 240) {
  const w = createWorld(def, mods);
  const m = newBot();
  const inputs: TickInput[] = [];
  const events: SimEvent[] = [];
  for (let i = 0; i < maxTicks && w.status === 'play'; i++) {
    const inp = botInput(w, m);
    inputs.push(inp);
    events.push(...step(w, inp));
  }
  return { w, inputs, events };
}
