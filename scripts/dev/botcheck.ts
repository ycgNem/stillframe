// Plays levels with the bot and prints one line each: how it ended, in how long, and the par that time
// suggests (about 1.6× the bot's). For building levels and tuning the bot.
//   node scripts/run.mjs scripts/dev/botcheck.ts 2        (a chapter)
//   node scripts/run.mjs scripts/dev/botcheck.ts 2-3 4-1  (levels)
import { newBot, botInput } from '../../src/bot/bot';
import { LEVELS } from '../../src/data/levels';
import { REDS } from '../../src/data/reds';
import { TICK_RATE } from '../../src/data/tuning';
import { createWorld, step } from '../../src/sim/world';

export function main(args: string[]) {
  const picks = args.length ? args : ['1', '2', '3', '4', '5'];
  const defs = LEVELS.filter((l) => picks.some((a) => l.id === a || (!a.includes('-') && l.id.startsWith(`${a}-`))));
  for (const def of defs) {
    const w = createWorld(def);
    const m = newBot();
    let killer = '';
    for (let i = 0; i < TICK_RATE * 240 && w.status === 'play'; i++) {
      for (const e of step(w, botInput(w, m))) {
        if (e.t !== 'death') continue;
        const r = w.reds.find((r) => r.id === e.by);
        killer = e.what ?? (r ? REDS[r.kind].name : `#${e.by}`);
      }
    }
    const t = w.tick / TICK_RATE;
    const left = w.reds.filter((r) => !r.dead).map((r) => `${r.kind}:${r.state}${r.hidden ? '(hidden)' : ''}`).join(' ');
    const par = Math.ceil(t * 1.6);
    console.log(`${def.id.padEnd(4)} ${def.name.padEnd(16)} ${w.status.padEnd(5)} ${t.toFixed(1).padStart(6)} s  kills ${String(w.stats.kills).padStart(2)}  par now ${def.par} → ~${par}${killer ? `  killed by ${killer}` : ''}${w.status !== 'clear' && left ? `  left: ${left}` : ''}`);
  }
}
