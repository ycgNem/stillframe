// Turns a level's ASCII map (src/data/levels) into a fresh World.
import { ITEMS, ITEM_LETTERS, type ItemKind } from '../data/items';
import type { LevelDef } from '../data/levels/types';
import { FRAME, RED_LETTERS, REDS, type RedKind } from '../data/reds';
import { PLAYER, TILE } from '../data/tuning';
import { TIER_VALUES } from '../data/upgrades';
import { TILE_DOOR, TILE_DROP, TILE_FLOOR, TILE_GLASS, TILE_PROP, TILE_VOID, TILE_WALL } from './grid';
import type { Held, Mods, Red, Stats, World } from './types';

export const PROPS = 'TCSFVOWKHRALNIUQJ';

export const NO_MODS: Mods = {
  stride: 0, trigger: 0, shield: 0, frameskip: 0, rewind: 0, arm: 0, mag: 0, reach: 0, holster: false, loadout: null,
};

export function emptyStats(): Stats {
  return {
    kills: 0, shots: 0, throws: 0, punches: 0, punchKills: 0, stunKills: 0, throwKills: 0, ricochetKills: 0,
    dashKills: 0, parries: 0, pickups: 0, misses: 0, shieldsUsed: 0, rewinds: 0, maxCombo: 0, firstKill: '',
    bossPunch: false, hazardKills: 0, dropKills: 0, slashKills: 0, bossDrops: false, killCoins: 0, comboCoins: 0, styleCoins: 0,
  };
}

/** A gun or throwable as found: guns full, plus the Mag bonus when it's yours. */
export function freshHeld(kind: ItemKind, mods?: Mods): Held {
  const gun = ITEMS[kind].gun;
  const bonus = gun && mods ? TIER_VALUES.magBonus[mods.mag] : 0;
  return { kind, ammo: ITEMS[kind].ammo + bonus, boosted: bonus > 0 };
}

export function makeRed(w: World, kind: RedKind, x: number, y: number, item: ItemKind | null | undefined): Red {
  const def = REDS[kind];
  const held = item === undefined ? def.item : item;
  return {
    id: w.nextId++, x, y, px: x, py: y, r: def.radius, walked: 0,
    kind, hp: def.hp, aim: Math.PI / 2, state: 'move', t: 0,
    held: held ? freshHeld(held) : null,
    cooldown: 0.6, stun: 0, stunByThrow: false, strafe: 1, strafeT: def.zigzag ? 0.3 : 1, cvx: 0, cvy: 0, hurt: 0, phase: 0,
    chargeCd: 1.5, guard: 0, steady: 0, grabCd: 0, hidden: false, tx: x, ty: y, timer: 0, dead: false,
  };
}

export function createWorld(def: LevelDef, mods: Mods = NO_MODS): World {
  const rows = def.map.length;
  const cols = Math.max(...def.map.map((r) => r.length));
  const floor = def.floor ?? '.';
  const w: World = {
    level: def.id, goal: def.goal, challenge: def.challenge, par: def.par,
    tick: 0, rng: def.seed >>> 0, status: 'play', nextId: 1,
    cols, rows, tiles: [], look: [], tilesVersion: 0, doors: [], exit: null,
    flow: [], flowAt: -2, flowVersion: -1, flowHazard: -1,
    player: {
      id: 0, x: 0, y: 0, px: 0, py: 0, r: PLAYER.radius, walked: 0, vx: 0, vy: 0, aim: -Math.PI / 2,
      hands: [], cooldown: 0, actT: 9, act: 'none', shield: TIER_VALUES.shieldHits[mods.shield], grace: 0, dashCd: 0,
      burstLeft: 0, burstT: 0,
    },
    reds: [], bullets: [], items: [], thrown: [],
    waveDefs: def.waves, bossWaves: def.bossWaves ?? [],
    trackDefs: def.trains ?? [], hookDefs: def.hooks ?? [], beatDef: def.beat ?? null, wells: def.wells ?? [], glitch: def.glitch ?? null,
    waves: { next: 0, timer: -1, pending: [], started: 1 },
    trains: [], hotRows: [], hazardVersion: 0, hooks: [], beat: { lit: [], dropIn: def.beat ? def.beat.bar : 0, bars: 0 }, echoes: [],
    combo: { count: 0, timer: 0 },
    surviveLeft: def.goal.kind === 'survive' ? def.goal.seconds : 0,
    mods, stats: emptyStats(),
  };
  w.player.id = w.nextId++;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const ch = def.map[y][x] ?? ' ';
      const cx = x * TILE + TILE / 2, cy = y * TILE + TILE / 2;
      let tile = TILE_FLOOR, look = ch;
      if (ch === ' ') tile = TILE_VOID;
      else if (ch === '#' || ch === 'E') tile = TILE_WALL;
      else if (ch === '~') tile = TILE_DROP;
      else if (ch === '=') tile = TILE_GLASS;
      else if (ch === 'D') {
        tile = TILE_DOOR;
        w.doors.push({ x: cx, y: cy, open: 0 });
      } else if (PROPS.includes(ch)) tile = TILE_PROP;
      else if (ch === 'X') w.exit = { x: cx, y: cy };
      else if (ch === 'P') {
        Object.assign(w.player, { x: cx, y: cy, px: cx, py: cy });
        look = floor;
      } else if (ITEM_LETTERS[ch]) {
        const h = freshHeld(ITEM_LETTERS[ch]);
        w.items.push({ id: w.nextId++, kind: h.kind, x: cx, y: cy, ammo: h.ammo, boosted: false });
        look = floor;
      } else if (RED_LETTERS[ch]) {
        const spec = RED_LETTERS[ch];
        const r = makeRed(w, spec.kind, cx, cy, spec.item);
        // the Frame's eyes take turns with their rings rather than all firing at once
        if (r.kind === 'eye') r.timer = FRAME.ringEvery * 0.4 + w.reds.filter((o) => o.kind === 'eye').length * FRAME.ringStagger;
        w.reds.push(r);
        look = floor;
      } else if (ch !== '.' && ch !== ',' && ch !== '_' && ch !== ':') throw new Error(`level ${def.id}: unknown map letter '${ch}' at ${x},${y}`);
      w.tiles.push(tile);
      w.look.push(look);
    }
  }
  // a letter's cell takes the floor around it (carpet in a carpeted room)
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const ch = def.map[y][x];
      if (ch !== 'P' && !ITEM_LETTERS[ch] && !RED_LETTERS[ch]) continue;
      // the floor most of its neighbours have
      const count: Record<string, number> = {};
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const n = def.map[y + dy]?.[x + dx];
        if (n === ',' || n === '.' || n === ':' || n === '_') count[n] = (count[n] ?? 0) + 1;
      }
      const best = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
      if (best && best[1] > (count[floor] ?? 0)) w.look[y * cols + x] = best[0];
    }
  }
  if (mods.loadout) w.player.hands.push(freshHeld(mods.loadout, mods));
  return w;
}
