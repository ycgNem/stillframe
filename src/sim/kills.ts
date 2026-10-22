// Hurting things: reds lose integrity and shatter (paying coins), split, or go over a roof's edge; the
// player dies or loses a shield.
import { BOSS_PHASES, FOREMAN, REDS } from '../data/reds';
import { BLADE, COINS, COMBAT, HOOK, LEDGE, PLAYER, TICK_RATE, TILE, TRAINS } from '../data/tuning';
import { moveBody, TILE_DROP, TILE_FLOOR, tileOfPoint } from './grid';
import { makeRed } from './level';
import { queueSpawns } from './waves';
import type { Hazard, KillCause, Red, SimEvent, World } from './types';

const DT = 1 / TICK_RATE;

/** Causes that are the room's doing, not a weapon's: they go through armour and a boss's guard. */
const HAZARDS: KillCause[] = ['train', 'hook', 'beat', 'fall'];

/** An armed red drops what it holds, a little toward (fx, fy). */
export function disarm(w: World, r: Red, fx: number, fy: number, ev: SimEvent[]) {
  if (!r.held) return;
  const d = Math.hypot(fx - r.x, fy - r.y) || 1;
  const item = { id: w.nextId++, kind: r.held.kind, x: r.x, y: r.y, ammo: r.held.ammo, boosted: r.held.boosted };
  r.grabCd = COMBAT.regrab;
  // nudge it out toward the player, but never into a wall or over the edge
  const probe = { id: 0, x: r.x, y: r.y, px: 0, py: 0, r: 2, walked: 0 };
  moveBody(w, probe, ((fx - r.x) / d) * COMBAT.disarmDrop, ((fy - r.y) / d) * COMBAT.disarmDrop, 'player');
  item.x = probe.x;
  item.y = probe.y;
  w.items.push(item);
  ev.push({ t: 'disarm', x: r.x, y: r.y, item: r.held.kind });
  r.held = null;
  if (r.state === 'aim' || r.state === 'throwTell') {
    r.state = 'move';
    r.t = 0;
  }
}

export interface HurtOpts {
  /** direction of the blow, for the shards */
  aim: number;
  ricochet?: boolean;
}

export function hurtRed(w: World, r: Red, damage: number, cause: KillCause, ev: SimEvent[], o: HurtOpts) {
  if (r.dead || r.hidden) return;
  const def = REDS[r.kind];
  const hazard = HAZARDS.includes(cause);
  if (r.guard > 0 && !hazard) {
    ev.push({ t: 'deflect', x: r.x, y: r.y });
    return;
  }
  // its own side's stray shots only chip a boss; a hard hat turns most of a bullet or a punch
  if (def.boss && cause === 'friendly') damage = Math.min(damage, BOSS_PHASES.friendlyDamage);
  if (def.armour !== undefined && !hazard) damage = Math.min(damage, def.armour);
  r.hp -= damage;
  r.hurt = 0.15;
  ev.push({ t: 'hit', x: r.x, y: r.y, id: r.id, aim: o.aim });
  if (def.boss) bossPhases(w, r, ev);
  if (r.hp <= 0) shatter(w, r, cause, ev, o);
}

/** A boss's integrity crossed a phase line: it roars, shrugs off damage a moment, and calls for help. */
function bossPhases(w: World, r: Red, ev: SimEvent[]) {
  while (r.phase < BOSS_PHASES.at.length && r.hp > 0 && r.hp <= BOSS_PHASES.at[r.phase]) {
    r.phase++;
    r.guard = BOSS_PHASES.guard;
    r.stun = 0;
    if (!r.hidden) {
      r.state = 'recover';
      r.t = BOSS_PHASES.guard;
    }
    ev.push({ t: 'phase', n: r.phase });
    const calls = w.bossWaves[r.phase - 1];
    if (calls) queueSpawns(w, calls, ev);
  }
}

/** A red breaks: it's gone, what it held falls, and the coins for it are counted. */
export function shatter(w: World, r: Red, cause: KillCause, ev: SimEvent[], o: HurtOpts) {
  if (r.dead) return;
  const def = REDS[r.kind];
  r.dead = true;
  if (r.held) disarm(w, r, r.x, r.y + 1, ev);
  const s = w.stats;
  s.kills++;
  if (!s.firstKill) s.firstKill = r.kind;

  const base = def.boss ? COINS.boss : def.tough ? COINS.brute : COINS.kill;
  w.combo.count = w.combo.timer > 0 ? w.combo.count + 1 : 1;
  w.combo.timer = COINS.comboWindow;
  s.maxCombo = Math.max(s.maxCombo, w.combo.count);
  const combo = w.combo.count - 1;

  let style = 0;
  if (cause === 'punch') {
    s.punchKills++;
    if (def.boss) s.bossPunch = true;
  }
  if (cause === 'throw') {
    if (o.ricochet) {
      s.ricochetKills++;
      style += COINS.ricochet;
    } else {
      s.throwKills++;
      style += COINS.throwKill;
    }
  } else if (cause === 'dash') {
    s.dashKills++;
    style += COINS.frameskip;
  } else if (cause === 'slash') {
    s.slashKills++;
    style += BLADE.styleKill;
  } else if (cause === 'train' || cause === 'hook' || cause === 'beat') {
    s.hazardKills++;
    style += cause === 'train' ? TRAINS.styleKill : HOOK.styleKill;
  } else if (cause === 'fall') {
    s.dropKills++;
    style += LEDGE.styleKill;
    if (def.boss) s.bossDrops = true;
  } else if (r.stunByThrow && r.stun > 0 && cause !== 'friendly' && cause !== 'charge') {
    s.stunKills++;
    style += COINS.stunKill;
  }
  s.killCoins += base;
  s.comboCoins += combo;
  s.styleCoins += style;
  ev.push({ t: 'shatter', x: r.x, y: r.y, id: r.id, kind: r.kind, aim: o.aim, cause, coins: base + combo + style });
  if (def.splits) split(w, r, def.splits, o.aim, ev);
}

/** A Splitter breaks into two smaller reds that hop out to either side of the blow. */
function split(w: World, r: Red, into: Red['kind'], aim: number, ev: SimEvent[]) {
  ev.push({ t: 'split', x: r.x, y: r.y });
  for (const side of [-1, 1]) {
    const a = aim + side * (Math.PI / 2);
    const s = makeRed(w, into, r.x, r.y, null);
    moveBody(w, s, Math.cos(a) * 4, Math.sin(a) * 4, 'red');
    s.state = 'enter';
    s.t = 0.3;
    s.cvx = Math.cos(a);
    s.cvy = Math.sin(a);
    s.aim = a;
    s.stun = 0.15;
    w.reds.push(s);
  }
}

/**
 * Shoves a red by (dx, dy). Walls stop it, the roof's edge doesn't: a red that ends up over the drop, or
 * within LEDGE.shove px of it in the direction it was pushed, goes over.
 */
export function shove(w: World, r: Red, dx: number, dy: number, ev: SimEvent[]) {
  if (r.dead || r.hidden) return;
  moveBody(w, r, dx, dy, REDS[r.kind].rooted ? 'red' : 'flung');
  const d = Math.hypot(dx, dy) || 1;
  const ux = dx / d, uy = dy / d;
  const over = tileOfPoint(w, r.x, r.y) === TILE_DROP || (!REDS[r.kind].rooted && tileOfPoint(w, r.x + ux * (r.r + LEDGE.shove), r.y + uy * (r.r + LEDGE.shove)) === TILE_DROP);
  if (over) fall(w, r, Math.atan2(uy, ux), ev);
}

/** Over the edge. Most reds are gone (your kill); the Foreman loses a third and climbs back up. */
export function fall(w: World, r: Red, aim: number, ev: SimEvent[]) {
  if (r.dead || r.hidden) return;
  ev.push({ t: 'fall', x: r.x, y: r.y, id: r.id, kind: r.kind });
  if (r.kind === 'foreman' && r.hp > FOREMAN.fallDamage) {
    r.hp -= FOREMAN.fallDamage;
    bossPhases(w, r, ev);
    r.hidden = true;
    r.state = 'climb';
    r.t = FOREMAN.climbBack;
    r.stun = 0;
    if (r.held) r.held = null;
    // back up through the nearest door, or the middle of the roof
    const door = w.doors.length ? w.doors.reduce((a, b) => (Math.hypot(b.x - r.x, b.y - r.y) < Math.hypot(a.x - r.x, a.y - r.y) ? b : a)) : null;
    if (door) {
      r.tx = door.x;
      r.ty = door.y;
    } else {
      let best = { x: r.x, y: r.y }, bd = Infinity;
      for (let i = 0; i < w.tiles.length; i++) {
        if (w.tiles[i] !== TILE_FLOOR) continue;
        const cx = (i % w.cols) * TILE + TILE / 2, cy = Math.floor(i / w.cols) * TILE + TILE / 2;
        const d = Math.hypot(cx - w.cols * TILE / 2, cy - w.rows * TILE / 2);
        if (d < bd) {
          bd = d;
          best = { x: cx, y: cy };
        }
      }
      r.tx = best.x;
      r.ty = best.y;
    }
    return;
  }
  r.hp = 0;
  shatter(w, r, 'fall', ev, { aim });
}

/** Something lethal reached the player (from red `by`, or a hazard, for the death card). A shield takes it
 *  if there is one. Returns true if you died. */
export function hurtPlayer(w: World, aim: number, ev: SimEvent[], by = 0, what?: Hazard): boolean {
  const p = w.player;
  if (w.status !== 'play' || p.grace > 0) return false;
  if (p.shield > 0) {
    p.shield--;
    p.grace = PLAYER.shieldGrace;
    w.stats.shieldsUsed++;
    ev.push({ t: 'shield', x: p.x, y: p.y });
    if (w.mods.shield >= 2) {
      for (const r of w.reds) {
        if (r.dead || r.hidden || Math.hypot(r.x - p.x, r.y - p.y) > PLAYER.shieldStunRadius) continue;
        r.stun = Math.max(r.stun, PLAYER.shieldStun);
        if (r.state !== 'enter') r.state = 'move';
        ev.push({ t: 'stun', x: r.x, y: r.y, id: r.id });
      }
    }
    return false;
  }
  w.status = 'dead';
  ev.push({ t: 'death', x: p.x, y: p.y, aim, by, what });
  return true;
}

/** The combo chain runs out in game time. */
export function stepCombo(w: World) {
  if (w.combo.timer > 0) {
    w.combo.timer -= DT;
    if (w.combo.timer <= 0) {
      w.combo.timer = 0;
      w.combo.count = 0;
    }
  }
}
