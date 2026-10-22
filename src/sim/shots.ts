// Things in flight: bullets (parries, Mirrors, piercing rifle rounds, wells that bend them) and thrown items
// (stuns, disarms, shoves, ricochets, catches).
import { ITEMS, type ItemDef, type ItemKind } from '../data/items';
import { REDS, TOUGH_STEADY } from '../data/reds';
import { COINS, COMBAT, ECHO, PLAYER, TICK_RATE, TILE } from '../data/tuning';
import { TIER_VALUES } from '../data/upgrades';
import { inTrain, stopsShots, TILE_DROP, TILE_FLOOR, TILE_GLASS, tileOfPoint } from './grid';
import { disarm, hurtPlayer, hurtRed, shove } from './kills';
import { randRange } from './rng';
import type { Bullet, SimEvent, Thrown, World } from './types';

const DT = 1 / TICK_RATE;
/** sub-step length in px, so nothing tunnels through a red or a pane */
const STEP = 3;

/** A pane breaks: the cell becomes floor (with shards on it). */
export function breakGlass(w: World, x: number, y: number, ev: SimEvent[]) {
  const cx = Math.floor(x / TILE), cy = Math.floor(y / TILE);
  const i = cy * w.cols + cx;
  if (w.tiles[i] !== TILE_GLASS) return;
  w.tiles[i] = TILE_FLOOR;
  w.look[i] = 'x';
  w.tilesVersion++;
  ev.push({ t: 'glass', x: cx * TILE + TILE / 2, y: cy * TILE + TILE / 2 });
}

/**
 * Fires a gun's pellets from (x, y) toward `aim`. Reds' bullets fly slower (COMBAT.redBulletScale) and a
 * little wide. With the echo glitch, the shot is queued to fire again.
 */
export function fireGun(w: World, def: ItemDef, kind: ItemKind, x: number, y: number, aim: number, from: 'player' | 'red', owner: number, ev: SimEvent[], echo = true) {
  const red = from === 'red';
  const speed = def.speed * (red ? COMBAT.redBulletScale : 1);
  for (let i = 0; i < def.pellets; i++) {
    let a = def.pellets > 1 ? aim + (i / (def.pellets - 1) - 0.5) * def.spread + randRange(w, -0.03, 0.03) : aim;
    if (red) a += randRange(w, -COMBAT.redSpread, COMBAT.redSpread);
    const dx = Math.cos(a), dy = Math.sin(a);
    w.bullets.push({
      id: w.nextId++, x, y, px: x, py: y, vx: dx * speed, vy: dy * speed, from, owner, life: def.range, damage: def.damage,
      hit: false, pierce: !!def.pierce, bounced: false,
    });
  }
  ev.push({ t: 'shot', x, y, aim, item: kind, from });
  if (echo && w.glitch === 'echo') w.echoes.push({ t: ECHO.delay, x, y, aim, item: kind, from, owner });
}

/** Wells pull on anything in flight: a velocity nudge toward each one that's near. */
function bend(w: World, o: { x: number; y: number; vx: number; vy: number }) {
  for (const g of w.wells) {
    const gx = g.x * TILE + TILE / 2, gy = g.y * TILE + TILE / 2;
    const dx = gx - o.x, dy = gy - o.y, d = Math.hypot(dx, dy);
    if (d >= g.r || d < 1) continue;
    const a = g.pull * (1 - d / g.r) * DT;
    o.vx += (dx / d) * a;
    o.vy += (dy / d) * a;
  }
}

export function stepBullets(w: World, ev: SimEvent[]) {
  const p = w.player;
  for (const b of w.bullets) {
    if (w.wells.length) bend(w, b);
    const speed = Math.hypot(b.vx, b.vy);
    const n = Math.max(1, Math.ceil((speed * DT) / STEP));
    for (let i = 0; i < n && b.life > 0; i++) {
      const sx = (b.vx * DT) / n, sy = (b.vy * DT) / n;
      b.x += sx;
      b.y += sy;
      b.life -= speed * DT / n;
      const t = tileOfPoint(w, b.x, b.y);
      if (t === TILE_GLASS) breakGlass(w, b.x, b.y, ev);
      else if (stopsShots(t) || (w.trains.length && inTrain(w, b.x, b.y))) {
        b.life = 0;
        ev.push({ t: 'wall', x: b.x, y: b.y });
        break;
      }
      if (hitThrown(w, b, ev)) break;
      const r = w.reds.find((r) => !r.dead && !r.hidden && r.id !== (b.bounced ? b.owner : -1) && Math.hypot(r.x - b.x, r.y - b.y) < r.r + COMBAT.bulletRadius + 0.5);
      if (r) {
        const def = REDS[r.kind];
        if (def.reflect && !b.bounced) {
          // a Mirror sends it straight back, now a danger to whoever fired it
          b.vx = -b.vx;
          b.vy = -b.vy;
          b.bounced = true;
          b.from = 'red';
          b.owner = r.id;
          b.x += b.vx * DT;
          b.y += b.vy * DT;
          ev.push({ t: 'reflect', x: r.x, y: r.y });
          break;
        }
        b.hit = true;
        const was = r.hp;
        hurtRed(w, r, b.damage, b.from === 'player' ? 'bullet' : 'friendly', ev, { aim: Math.atan2(b.vy, b.vx) });
        // a rifle round goes on through what it shatters
        if (!(b.pierce && r.dead && was <= b.damage)) {
          b.life = 0;
          break;
        }
        continue;
      }
      if (b.from === 'red' && Math.hypot(p.x - b.x, p.y - b.y) < p.r + COMBAT.bulletRadius) {
        b.life = 0;
        b.hit = true;
        hurtPlayer(w, Math.atan2(b.vy, b.vx), ev, b.owner);
        break;
      }
    }
  }
  parries(w, ev);
  for (const b of w.bullets) if (b.life <= 0 && b.from === 'player' && !b.hit && !b.bounced) w.stats.misses++;
  w.bullets = w.bullets.filter((b) => b.life > 0);
}

/** A bullet of yours that meets something a red threw (a desk, a bottle) destroys it: a parry. */
function hitThrown(w: World, b: Bullet, ev: SimEvent[]): boolean {
  if (b.from !== 'player') return false;
  const t = w.thrown.find((t) => t.from === 'red' && t.life > 0 && Math.hypot(t.x - b.x, t.y - b.y) < t.r + 2);
  if (!t) return false;
  t.life = -1;
  b.life = 0;
  b.hit = true;
  parried(w, t.x, t.y, ev);
  ev.push({ t: 'break', x: t.x, y: t.y, item: t.kind });
  return true;
}

export function parried(w: World, x: number, y: number, ev: SimEvent[]) {
  w.stats.parries++;
  w.stats.styleCoins += COINS.parry;
  ev.push({ t: 'parry', x, y });
}

/** Closest distance between segments p0→p1 and q0→q1. */
export function segDist(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): number {
  // sample the relative motion: both move linearly over the tick, so check the closest approach in time
  const rx0 = ax - cx, ry0 = ay - cy;
  const rvx = (bx - ax) - (dx - cx), rvy = (by - ay) - (dy - cy);
  const vv = rvx * rvx + rvy * rvy;
  const t = vv > 0 ? Math.max(0, Math.min(1, -(rx0 * rvx + ry0 * rvy) / vv)) : 0;
  return Math.hypot(rx0 + rvx * t, ry0 + rvy * t);
}

/** Your bullet meets a red bullet that was already flying when you fired: both vanish. Two shots
 *  traded at the same moment pass each other (ids rise as things are made, so a lower id is older). */
function parries(w: World, ev: SimEvent[]) {
  for (const a of w.bullets) {
    if (a.from !== 'player' || a.hit) continue;
    for (const b of w.bullets) {
      if (b.from !== 'red' || b.hit || b.id > a.id) continue;
      if (segDist(a.px, a.py, a.x, a.y, b.px, b.py, b.x, b.y) > COMBAT.parryRadius) continue;
      a.life = b.life = 0;
      a.hit = b.hit = true;
      parried(w, (a.x + b.x) / 2, (a.y + b.y) / 2, ev);
      break;
    }
  }
}

export function stepThrown(w: World, ev: SimEvent[]) {
  const p = w.player;
  for (const t of w.thrown) {
    if (t.life <= 0) continue;
    // Reach III: catch a red's throw out of the air with a free hand
    if (t.from === 'red' && !ITEMS[t.kind].radius && w.mods.reach >= 3 && p.hands.length < (w.mods.holster ? 2 : 1)
      && Math.hypot(t.x - p.x, t.y - p.y) < TIER_VALUES.reach[3] * 0.75) {
      t.life = -1;
      p.hands.unshift({ kind: t.kind, ammo: t.ammo, boosted: t.boosted });
      ev.push({ t: 'pickup', x: t.x, y: t.y, item: t.kind, who: 'player' });
      continue;
    }
    if (w.wells.length) bend(w, t);
    const speed = Math.hypot(t.vx, t.vy);
    const n = Math.max(1, Math.ceil((speed * DT) / STEP));
    for (let i = 0; i < n && t.life > 0; i++) {
      const sx = t.vx * DT / n, sy = t.vy * DT / n;
      const nx = t.x + sx, ny = t.y + sy;
      const tile = tileOfPoint(w, nx, ny);
      if (tile === TILE_GLASS) breakGlass(w, nx, ny, ev);
      else if (stopsShots(tile) || (w.trains.length && inTrain(w, nx, ny))) {
        if (t.bounces > 0) {
          // reflect off whichever axis is blocked
          if (stopsShots(tileOfPoint(w, nx, t.y))) t.vx = -t.vx;
          if (stopsShots(tileOfPoint(w, t.x, ny))) t.vy = -t.vy;
          if (!stopsShots(tileOfPoint(w, nx, t.y)) && !stopsShots(tileOfPoint(w, t.x, ny))) {
            t.vx = -t.vx;
            t.vy = -t.vy;
          }
          t.bounces--;
          t.ricocheted = true;
          ev.push({ t: 'wall', x: t.x, y: t.y });
          break;
        }
        land(w, t, ev, true);
        break;
      }
      t.x = nx;
      t.y = ny;
      t.life -= speed * DT / n;
      if (t.from === 'player') {
        const r = w.reds.find((r) => !r.dead && !r.hidden && r.id !== t.owner && Math.hypot(r.x - t.x, r.y - t.y) < r.r + t.r);
        if (r) {
          thrownHitsRed(w, t, r.id, ev);
          land(w, t, ev, true);
          break;
        }
      } else {
        if (Math.hypot(p.x - t.x, p.y - t.y) < p.r + t.r) {
          hurtPlayer(w, Math.atan2(t.vy, t.vx), ev, t.owner);
          land(w, t, ev, true);
          break;
        }
        const r = w.reds.find((r) => !r.dead && !r.hidden && r.id !== t.owner && Math.hypot(r.x - t.x, r.y - t.y) < r.r + t.r);
        if (r) {
          if (ITEMS[t.kind].radius) hurtRed(w, r, 99, 'friendly', ev, { aim: Math.atan2(t.vy, t.vx) });
          else r.stun = Math.max(r.stun, COMBAT.throwStun * 0.5);
          land(w, t, ev, true);
          break;
        }
      }
      if (t.life <= 0) land(w, t, ev, false);
    }
  }
  w.thrown = w.thrown.filter((t) => t.life > 0);
}

/** A throw of yours connects: stun, disarm, a shove, and (Arm II) shatter a Grunt or anything as frail. */
function thrownHitsRed(w: World, t: Thrown, id: number, ev: SimEvent[]) {
  const r = w.reds.find((r) => r.id === id)!;
  const aim = Math.atan2(t.vy, t.vx);
  const def = REDS[r.kind];
  disarm(w, r, w.player.x, w.player.y, ev);
  const tough = !!def.tough;
  if (tough && (r.steady > 0 || r.guard > 0)) {
    ev.push({ t: 'deflect', x: r.x, y: r.y });
    return;
  }
  r.stun = Math.max(r.stun, tough ? COMBAT.bruteThrowStun : COMBAT.throwStun);
  if (tough) r.steady = TOUGH_STEADY;
  r.stunByThrow = true;
  if (r.state !== 'enter') {
    r.state = 'move';
    r.t = 0;
  }
  ev.push({ t: 'stun', x: r.x, y: r.y, id: r.id });
  if (w.mods.arm >= 2 && !tough) hurtRed(w, r, def.hp, 'throw', ev, { aim, ricochet: t.ricocheted });
  else {
    ev.push({ t: 'hit', x: r.x, y: r.y, id: r.id, aim });
    if (!tough) shove(w, r, Math.cos(aim) * PLAYER.punchKnock, Math.sin(aim) * PLAYER.punchKnock, ev);
  }
}

/** It stops: throwables (and anything that hit hard) break, guns fall to the floor, or off the roof. */
function land(w: World, t: Thrown, ev: SimEvent[], impact: boolean) {
  t.life = -1;
  const def = ITEMS[t.kind];
  if (def.radius || (impact && def.breaks)) {
    ev.push({ t: 'break', x: t.x, y: t.y, item: t.kind });
    return;
  }
  // back off a little so it doesn't land inside a wall
  const d = Math.hypot(t.vx, t.vy) || 1;
  let x = t.x, y = t.y;
  for (let k = 0; k < 8 && stopsShots(tileOfPoint(w, x, y)); k++) {
    x -= (t.vx / d) * 2;
    y -= (t.vy / d) * 2;
  }
  if (tileOfPoint(w, x, y) === TILE_DROP) return;
  w.items.push({ id: w.nextId++, kind: t.kind, x, y, ammo: t.ammo, boosted: t.boosted });
}
