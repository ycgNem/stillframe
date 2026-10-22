// The save file (GAME_DESIGN §18): coins, stars and best times, workshop tiers, loadout, settings. Pure
// data and pure functions; src/app/storage.ts reads and writes it to localStorage.
import type { ItemKind } from '../data/items';
import { LEVELS } from '../data/levels';
import { HOLSTER, LOADOUT, TIER_PRICES, TRACKS, type TrackId } from '../data/upgrades';
import type { Mods } from '../sim/types';
import type { Tally } from './tally';

export const SAVE_VERSION = 1;

export interface LevelRecord {
  stars: [boolean, boolean, boolean];
  /** best clear in game ticks (0 = never cleared) */
  best: number;
  clears: number;
}

export interface Settings {
  /** 0..1 */
  sfx: number;
  music: number;
  shake: boolean;
  /** the "STILL. FRAME." voice */
  voice: boolean;
  /** fewer white flashes */
  flash: boolean;
}

export interface Save {
  v: number;
  coins: number;
  /** every coin ever banked */
  earned: number;
  levels: Record<string, LevelRecord>;
  up: Record<TrackId, number>;
  holster: boolean;
  /** loadout weapons bought */
  owned: ItemKind[];
  /** the one you start levels with (null = empty hands) */
  loadout: ItemKind | null;
  settings: Settings;
  deaths: number;
  /** real seconds spent in levels */
  played: number;
}

export function newSave(): Save {
  return {
    v: SAVE_VERSION, coins: 0, earned: 0, levels: {},
    up: { stride: 0, trigger: 0, shield: 0, frameskip: 0, rewind: 0, arm: 0, mag: 0, reach: 0 },
    holster: false, owned: [], loadout: null,
    settings: { sfx: 0.8, music: 0.6, shake: true, voice: true, flash: false },
    deaths: 0, played: 0,
  };
}

/** Accepts anything (an old save, a pasted code) and returns a valid current Save. */
export function migrate(raw: unknown): Save {
  const s = newSave();
  if (!raw || typeof raw !== 'object') return s;
  const r = raw as Partial<Save>;
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  s.coins = Math.max(0, Math.floor(num(r.coins, 0)));
  s.earned = Math.max(s.coins, Math.floor(num(r.earned, s.coins)));
  s.deaths = Math.floor(num(r.deaths, 0));
  s.played = num(r.played, 0);
  if (r.levels && typeof r.levels === 'object') {
    for (const l of LEVELS) {
      const rec = (r.levels as Record<string, LevelRecord>)[l.id];
      if (!rec) continue;
      const st = Array.isArray(rec.stars) ? rec.stars : [];
      s.levels[l.id] = { stars: [!!st[0], !!st[1], !!st[2]], best: Math.max(0, num(rec.best, 0)), clears: Math.max(0, num(rec.clears, 0)) };
    }
  }
  if (r.up && typeof r.up === 'object') for (const t of TRACKS) s.up[t.id] = Math.max(0, Math.min(3, Math.floor(num((r.up as Record<string, number>)[t.id], 0))));
  s.holster = !!r.holster;
  if (Array.isArray(r.owned)) s.owned = LOADOUT.map((l) => l.item).filter((i) => (r.owned as string[]).includes(i));
  s.loadout = r.loadout && s.owned.includes(r.loadout) ? r.loadout : null;
  if (r.settings && typeof r.settings === 'object') {
    const t = r.settings as Partial<Settings>;
    s.settings = {
      sfx: Math.max(0, Math.min(1, num(t.sfx, s.settings.sfx))),
      music: Math.max(0, Math.min(1, num(t.music, s.settings.music))),
      shake: t.shake ?? s.settings.shake,
      voice: t.voice ?? s.settings.voice,
      flash: t.flash ?? s.settings.flash,
    };
  }
  return s;
}

export function record(s: Save, id: string): LevelRecord {
  return s.levels[id] ?? { stars: [false, false, false], best: 0, clears: 0 };
}

export function starCount(s: Save): number {
  return Object.values(s.levels).reduce((n, r) => n + r.stars.filter(Boolean).length, 0);
}

/** Levels unlock in order: the first is open, each next one once the one before is cleared. */
export function isUnlocked(s: Save, id: string): boolean {
  const i = LEVELS.findIndex((l) => l.id === id);
  return i === 0 || (i > 0 && record(s, LEVELS[i - 1].id).clears > 0);
}

export function modsOf(s: Save): Mods {
  return { ...s.up, holster: s.holster, loadout: s.loadout };
}

/** Price of the next tier of a track, or null when it is maxed. */
export function nextTierPrice(s: Save, t: TrackId): number | null {
  const tier = s.up[t];
  return tier >= 3 ? null : TIER_PRICES[tier];
}

export function buyTier(s: Save, t: TrackId): boolean {
  const price = nextTierPrice(s, t);
  if (price === null || s.coins < price) return false;
  s.coins -= price;
  s.up[t]++;
  return true;
}

export function buyHolster(s: Save): boolean {
  if (s.holster || s.coins < HOLSTER.price) return false;
  s.coins -= HOLSTER.price;
  s.holster = true;
  return true;
}

/** A loadout weapon can be bought once the level that introduces it has been cleared. */
export function loadoutAvailable(s: Save, item: ItemKind): boolean {
  const l = LOADOUT.find((l) => l.item === item);
  return !!l && record(s, l.after).clears > 0;
}

export function buyLoadout(s: Save, item: ItemKind): boolean {
  const l = LOADOUT.find((l) => l.item === item);
  if (!l || s.owned.includes(item) || !loadoutAvailable(s, item) || s.coins < l.price) return false;
  s.coins -= l.price;
  s.owned.push(item);
  s.loadout = item;
  return true;
}

export function equip(s: Save, item: ItemKind | null) {
  if (item === null || s.owned.includes(item)) s.loadout = item;
}

/** Banks a cleared level: coins, new stars, best time, clear count. */
export function applyClear(s: Save, id: string, t: Tally) {
  const rec = record(s, id);
  s.levels[id] = {
    stars: [rec.stars[0] || t.stars[0], rec.stars[1] || t.stars[1], rec.stars[2] || t.stars[2]],
    best: rec.best === 0 ? t.ticks : Math.min(rec.best, t.ticks),
    clears: rec.clears + 1,
  };
  s.coins += t.total;
  s.earned += t.total;
}

/** A save as a text code (export/import between browsers). */
export function encodeSave(s: Save): string {
  const json = JSON.stringify(s);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return `SF1-${btoa(bin)}`;
}

export function decodeSave(code: string): Save | null {
  const m = code.trim().match(/^SF1-([A-Za-z0-9+/=]+)$/);
  if (!m) return null;
  try {
    const bin = atob(m[1]);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return migrate(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}
