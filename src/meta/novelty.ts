// What a level shows you for the first time (reds, weapons, hazards, glitches), for its intro card. Read
// from the level data in play order, so it stays right as levels move.
import { ITEM_LETTERS, ITEMS, type ItemKind } from '../data/items';
import { LEVELS } from '../data/levels';
import type { LevelDef } from '../data/levels/types';
import { RED_LETTERS, REDS, type RedKind } from '../data/reds';

const GLITCH_NAMES = { inverse: 'Inverse time', mirror: 'Mirrored controls', echo: 'Echoing shots' } as const;

/** Everything a level has in it, as display names. */
function contents(l: LevelDef): string[] {
  const reds = new Set<RedKind>(), items = new Set<ItemKind>();
  for (const ch of l.map.join('')) {
    if (RED_LETTERS[ch]) reds.add(RED_LETTERS[ch].kind);
    if (ITEM_LETTERS[ch]) items.add(ITEM_LETTERS[ch]);
  }
  for (const s of [...l.waves.flatMap((v) => v.reds), ...(l.bossWaves ?? []).flat()]) reds.add(s.kind);
  // a Splitter's Shards come with it, not as news of their own
  reds.delete('shardling');
  const out = [...reds].map((k) => REDS[k].name).concat([...items].filter((k) => ITEMS[k].gun || ITEMS[k].blade).map((k) => ITEMS[k].name));
  if (l.trains?.length) out.push('Trains');
  if (l.map.some((r) => r.includes('~'))) out.push('Ledges');
  if (l.hooks?.length) out.push('Crane hook');
  if (l.beat) out.push('The beat');
  if (l.strobe) out.push('Strobe');
  if (l.wells?.length) out.push('Gravity wells');
  if (l.glitch) out.push(GLITCH_NAMES[l.glitch]);
  return out;
}

/** The things in level `id` that no level before it had. */
export function newIn(id: string): string[] {
  const seen = new Set<string>();
  for (const l of LEVELS) {
    const has = contents(l);
    if (l.id === id) return has.filter((n) => !seen.has(n));
    has.forEach((n) => seen.add(n));
  }
  return [];
}
