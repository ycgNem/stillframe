// Plays a level with the bot and prints what happened, for tuning levels and the bot.
//   node scripts/run.mjs scripts/dev/botlog.ts 1-3 [verbose]
import { newBot, botInput } from '../../src/bot/bot';
import { levelById } from '../../src/data/levels';
import { createWorld, step } from '../../src/sim/world';

export function main(args: string[]) {
  const def = levelById(args[0] ?? '1-1');
  const verbose = args.includes('verbose');
  const w = createWorld(def);
  const m = newBot();
  for (let i = 0; i < 60 * 240 && w.status === 'play'; i++) {
    const inp = botInput(w, m);
    const ev = step(w, inp);
    for (const e of ev) {
      if (!verbose && (e.t === 'wall' || e.t === 'hit')) continue;
      const pos = 'x' in e ? ` @${Math.round(e.x / 16)},${Math.round(e.y / 16)}` : '';
      console.log(`${(w.tick / 60).toFixed(2)} ${e.t}${pos} ${JSON.stringify({ ...e, t: undefined, x: undefined, y: undefined })}`);
    }
    if (verbose && i % 30 === 0) {
      const p = w.player;
      console.log(`   p ${p.x.toFixed(0)},${p.y.toFixed(0)} hands ${p.hands.map((h) => h.kind + h.ammo).join('/')} in ${JSON.stringify({ mx: inp.mx, my: inp.my, fire: inp.fire, alt: inp.alt, pick: inp.pick })} reds ${w.reds.map((r) => `${r.kind}:${r.state}@${(r.x / 16).toFixed(1)},${(r.y / 16).toFixed(1)}`).join(' ')}`);
    }
  }
  console.log(`END ${w.status} at ${(w.tick / 60).toFixed(1)} s, kills ${w.stats.kills}, reds left ${w.reds.length}`, w.stats);
}
