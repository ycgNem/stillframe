// Hurting things: reds lose integrity and shatter (paying coins), the player dies or loses a shield.
import { COINS, COMBAT, PLAYER, TICK_RATE } from '../data/tuning';
import { MANAGER } from '../data/reds';
import { moveBody } from './grid';
import { queueSpawns } from './waves';
import type { KillCause, Red, SimEvent, World } from './types';

const DT = 1 / TICK_RATE;

/** An armed red drops what it holds, a little toward (fx, fy). */
export function disarm(w: World, r: Red, fx: number, fy: number, ev: SimEvent[]) {
  if (!r.held) return;
  const d = Math.hypot(fx - r.x, fy - r.y) || 1;
  const item = { id: w.nextId++, kind: r.held.kind, x: r.x, y: r.y, ammo: r.held.ammo, boosted: r.held.boosted };
  r.grabCd = COMBAT.regrab;
  // nudge it out toward the player, but never into a wall
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
  if (r.dead) return;
  if (r.guard > 0) {
    ev.push({ t: 'deflect', x: r.x, y: r.y });
    return;
  }
  // its own side's stray shots and desks only chip the boss
  if (r.kind === 'manager' && cause === 'friendly') damage = Math.min(damage, MANAGER.friendlyDamage);
  r.hp -= damage;
  r.hurt = 0.15;
  ev.push({ t: 'hit', x: r.x, y: r.y, id: r.id, aim: o.aim });
  if (r.kind === 'manager') {
    while (r.phase < MANAGER.phaseAt.length && r.hp > 0 && r.hp <= MANAGER.phaseAt[r.phase]) {
      r.phase++;
      r.guard = MANAGER.phaseGuard;
      r.stun = 0;
      r.state = 'recover';
      r.t = MANAGER.phaseGuard;
      ev.push({ t: 'phase', n: r.phase });
      const calls = w.bossWaves[r.phase - 1];
      if (calls) queueSpawns(w, calls, ev);
    }
  }
  if (r.hp <= 0) shatter(w, r, cause, ev, o);
}

/** A red breaks: it's gone, what it held falls, and the coins for it are counted. */
export function shatter(w: World, r: Red, cause: KillCause, ev: SimEvent[], o: HurtOpts) {
  if (r.dead) return;
  r.dead = true;
  if (r.held) disarm(w, r, r.x, r.y + 1, ev);
  const s = w.stats;
  s.kills++;
  if (!s.firstKill) s.firstKill = r.kind;

  const base = r.kind === 'manager' ? COINS.boss : r.kind === 'brute' ? COINS.brute : COINS.kill;
  w.combo.count = w.combo.timer > 0 ? w.combo.count + 1 : 1;
  w.combo.timer = COINS.comboWindow;
  s.maxCombo = Math.max(s.maxCombo, w.combo.count);
  const combo = w.combo.count - 1;

  let style = 0;
  if (cause === 'punch') {
    s.punchKills++;
    if (r.kind === 'manager') s.bossPunch = true;
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
  } else if (r.stunByThrow && r.stun > 0 && cause !== 'friendly' && cause !== 'charge') {
    s.stunKills++;
    style += COINS.stunKill;
  }
  s.killCoins += base;
  s.comboCoins += combo;
  s.styleCoins += style;
  ev.push({ t: 'shatter', x: r.x, y: r.y, id: r.id, kind: r.kind, aim: o.aim, cause, coins: base + combo + style });
}

/** Something lethal reached the player (from red `by`, for the death screen). A shield takes it if there is
 *  one. Returns true if you died. */
export function hurtPlayer(w: World, aim: number, ev: SimEvent[], by = 0): boolean {
  const p = w.player;
  if (w.status !== 'play' || p.grace > 0) return false;
  if (p.shield > 0) {
    p.shield--;
    p.grace = PLAYER.shieldGrace;
    w.stats.shieldsUsed++;
    ev.push({ t: 'shield', x: p.x, y: p.y });
    if (w.mods.shield >= 2) {
      for (const r of w.reds) {
        if (r.dead || Math.hypot(r.x - p.x, r.y - p.y) > PLAYER.shieldStunRadius) continue;
        r.stun = Math.max(r.stun, PLAYER.shieldStun);
        r.state = 'move';
        ev.push({ t: 'stun', x: r.x, y: r.y, id: r.id });
      }
    }
    return false;
  }
  w.status = 'dead';
  ev.push({ t: 'death', x: p.x, y: p.y, aim, by });
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
