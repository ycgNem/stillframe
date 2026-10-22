// Economy check (docs/PLAN.md M5, GAME_DESIGN §10): plays Chapter 1 in order with the bot, banking each
// clear through the real tally and buying upgrades as a player might, then replays every level once
// more. Prints coins against Workshop prices.
//   node scripts/run.mjs scripts/economy.ts
import { botInput, newBot } from '../src/bot/bot';
import { LEVELS } from '../src/data/levels';
import { TICK_RATE } from '../src/data/tuning';
import { HOLSTER, LOADOUT, TIER_PRICES, TRACKS, type TrackId } from '../src/data/upgrades';
import { applyClear, buyHolster, buyLoadout, buyTier, modsOf, newSave, nextTierPrice, record, type Save } from '../src/meta/save';
import { tally } from '../src/meta/tally';
import { createWorld, step } from '../src/sim/world';

const PRIORITY: TrackId[] = ['shield', 'frameskip', 'rewind', 'stride', 'trigger', 'arm', 'mag', 'reach'];

function play(save: Save, id: string) {
  const def = LEVELS.find((l) => l.id === id)!;
  for (let attempt = 1; attempt <= 6; attempt++) {
    const w = createWorld({ ...def, seed: def.seed + attempt * 1000 }, modsOf(save));
    const m = newBot();
    while (w.status === 'play' && w.tick < TICK_RATE * 240) step(w, botInput(w, m));
    if (w.status === 'clear') return { w, attempts: attempt };
  }
  return null;
}

function shop(save: Save): string[] {
  const got: string[] = [];
  for (;;) {
    if (!save.owned.includes('pistol') && buyLoadout(save, 'pistol')) {
      got.push('PISTOL');
      continue;
    }
    const t = PRIORITY.filter((id) => nextTierPrice(save, id) !== null).sort((a, b) => nextTierPrice(save, a)! - nextTierPrice(save, b)!)[0];
    const price = t ? nextTierPrice(save, t)! : Infinity;
    if (t && save.coins >= price && price <= 40) {
      buyTier(save, t);
      got.push(`${t}${save.up[t]}`);
      continue;
    }
    if (!save.holster && save.coins >= HOLSTER.price + 40) {
      buyHolster(save);
      got.push('HOLSTER');
      continue;
    }
    break;
  }
  return got;
}

export function main() {
  const save = newSave();
  const rows: string[] = [];
  let firstPass = 0, stars = 0;
  for (const pass of [1, 2]) {
    for (const l of LEVELS) {
      const r = play(save, l.id);
      if (!r) {
        rows.push(`${pass} ${l.id} NOT CLEARED`);
        continue;
      }
      const t = tally(r.w, record(save, l.id));
      applyClear(save, l.id, t);
      if (pass === 1) firstPass += t.total;
      const got = shop(save);
      rows.push(`${pass} ${l.id.padEnd(4)} ${l.name.padEnd(14)} +${String(t.total).padStart(3)}  stars ${t.stars.map((s) => (s ? '*' : '.')).join('')}  kills ${String(r.w.stats.kills).padStart(2)}  ${(r.w.tick / TICK_RATE).toFixed(1).padStart(5)} s  bank ${String(save.coins).padStart(4)}  ${got.join(' ')}`);
    }
    if (pass === 1) stars = Object.values(save.levels).reduce((n, r) => n + r.stars.filter(Boolean).length, 0);
  }
  const shopTotal = TRACKS.length * TIER_PRICES.reduce((a, b) => a + b, 0) + HOLSTER.price + LOADOUT.reduce((a, l) => a + l.price, 0);
  console.log(rows.join('\n'));
  console.log(`\nfirst pass: ${firstPass} coins, ${stars}/${LEVELS.length * 3} stars; after a second pass: ${save.earned} earned`);
  console.log(`workshop: everything costs ${shopTotal}; all tier I + pistol + holster = ${TRACKS.length * TIER_PRICES[0] + 80 + HOLSTER.price}`);
  console.log(`share of the whole workshop affordable from chapter 1 (two passes): ${((100 * save.earned) / shopTotal).toFixed(0)}%`);
  console.log('upgrades at the end:', JSON.stringify(save.up), 'holster', save.holster, 'owned', save.owned.join(','));
}
