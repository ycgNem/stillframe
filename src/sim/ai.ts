// How reds think (GAME_DESIGN §7). Every attack has a tell of at least 0.4 game s (STYLE.md §6 rule 5):
// a punch winds up, a gun shows its red aim line, a charge and a lob lift first, a landing marks the floor.
// Reds use the same verbs as you: walk, punch, shoot, throw, pick up. The bosses' own moves are in
// bosses.ts.
import { ITEMS } from '../data/items';
import { CHARGE, MANAGER, REDS } from '../data/reds';
import { PLAYER, TICK_RATE } from '../data/tuning';
import { lob, LOBS, bossDecide, hiddenStep, eyeShut, ringBurst } from './bosses';
import { canSee, moveBody, pathClear, shotClear, TILE_DROP, TILE_GLASS, tileOfPoint } from './grid';
import { fall, hurtPlayer, shatter } from './kills';
import { downhill } from './nav';
import { angleDiff } from './player';
import { randRange } from './rng';
import { breakGlass, fireGun } from './shots';
import type { Red, SimEvent, World } from './types';

const DT = 1 / TICK_RATE;

export function stepReds(w: World, ev: SimEvent[]) {
  for (const r of w.reds) {
    if (r.dead || w.status !== 'play') continue;
    r.hurt = Math.max(0, r.hurt - DT);
    r.cooldown = Math.max(0, r.cooldown - DT);
    r.chargeCd = Math.max(0, r.chargeCd - DT);
    r.guard = Math.max(0, r.guard - DT);
    r.steady = Math.max(0, r.steady - DT);
    r.grabCd = Math.max(0, r.grabCd - DT);
    r.timer -= DT;
    if (r.kind === 'eye') eyeShut(w, r);
    if (r.hidden) {
      hiddenStep(w, r, ev);
      continue;
    }
    if (r.stun > 0) {
      r.stun = Math.max(0, r.stun - DT);
      if (r.stun === 0) r.stunByThrow = false;
      if (r.state !== 'enter') continue;
    }
    think(w, r, ev);
  }
}

/** Punch reach and start distance, longer with a blade in hand. */
function reach(r: Red) {
  const def = REDS[r.kind];
  const blade = r.held && ITEMS[r.held.kind].blade;
  return { start: def.punchStart + (blade ? 8 : 0), reach: def.punchReach + (blade ? 10 : 0) };
}

function think(w: World, r: Red, ev: SimEvent[]) {
  const p = w.player, def = REDS[r.kind];
  const dx = p.x - r.x, dy = p.y - r.y;
  const dist = Math.hypot(dx, dy);
  const toP = Math.atan2(dy, dx);
  switch (r.state) {
    case 'enter': {
      walkBy(w, r, r.cvx * Math.max(def.speed, 24) * DT, r.cvy * Math.max(def.speed, 24) * DT);
      r.t -= DT;
      if (r.t <= 0) r.state = 'move';
      return;
    }
    case 'windup': {
      r.t -= DT;
      if (r.t > 0) return;
      const hit = dist - p.r - r.r <= reach(r).reach && angleDiff(toP, r.aim) <= 0.95;
      const blade = !!r.held && !!ITEMS[r.held.kind].blade;
      if (blade) ev.push({ t: 'slash', x: r.x, y: r.y, aim: r.aim, from: 'red' });
      else ev.push({ t: 'punch', x: r.x + Math.cos(r.aim) * 8, y: r.y + Math.sin(r.aim) * 8, aim: r.aim, hit, from: 'red' });
      if (hit) hurtPlayer(w, r.aim, ev, r.id);
      r.state = 'recover';
      r.t = def.recover;
      return;
    }
    case 'aim': {
      r.t -= DT;
      if (r.t > def.aimLock) {
        r.aim = toP;
        // a gunner keeps edging sideways while its line is dotted, so you have to lead it
        if (def.aimStrafe > 0) strafe(w, r, toP, def.speed * def.aimStrafe);
      }
      if (r.t > 0) return;
      fire(w, r, ev);
      r.state = 'recover';
      r.t = 0.2;
      return;
    }
    case 'throwTell': {
      r.t -= DT;
      if (r.t > 0.1) r.aim = toP;
      if (r.t > 0) return;
      throwAt(w, r, ev);
      r.state = 'recover';
      r.t = 0.3;
      return;
    }
    case 'deskTell': {
      r.t -= DT;
      if (r.t > 0.2) r.aim = toP;
      if (r.t > 0) return;
      lob(w, r, ev);
      r.state = 'recover';
      r.t = 0.4;
      return;
    }
    case 'ringTell': {
      r.t -= DT;
      if (r.t > 0) return;
      ringBurst(w, r, ev);
      r.state = 'recover';
      r.t = 0.3;
      return;
    }
    case 'chargeTell': {
      r.t -= DT;
      if (r.t > 0.25) r.aim = toP;
      if (r.t > 0) return;
      r.state = 'charge';
      r.t = CHARGE.time;
      r.cvx = Math.cos(r.aim);
      r.cvy = Math.sin(r.aim);
      return;
    }
    case 'charge': {
      charge(w, r, ev);
      return;
    }
    case 'recover': {
      r.t -= DT;
      if (r.t <= 0) r.state = 'move';
      return;
    }
    case 'move':
      decide(w, r, dist, toP, ev);
      return;
    default:
      // boss states (board, ...) live in bosses.ts
      bossDecide(w, r, dist, toP, ev);
  }
}

function decide(w: World, r: Red, dist: number, toP: number, ev: SimEvent[]) {
  const p = w.player, def = REDS[r.kind];
  const see = canSee(w, r.x, r.y, p.x, p.y);
  const clear = see && shotClear(w, r.x, r.y, p.x, p.y);
  const held = r.held;
  const gun = !!held && ITEMS[held.kind].gun;
  const loaded = gun && held!.ammo > 0;
  const tell = (state: Red['state'], t: number, what: 'punch' | 'aim' | 'throw' | 'charge' | 'desk') => {
    r.state = state;
    r.t = t;
    r.aim = toP;
    ev.push({ t: 'tell', x: r.x, y: r.y, id: r.id, what });
  };

  // a boss's own moves come first (boarding a train, a ring of bullets)
  if (bossDecide(w, r, dist, toP, ev)) return;
  // close enough to hit: wind up a punch (dodge it by stepping back or to the side). A red with a loaded
  // gun that likes range backs off and shoots instead; the Frame's eyes can't punch.
  const shooter = (r.kind === 'gunner' || r.kind === 'sniper') && loaded;
  if (see && r.kind !== 'eye' && dist - p.r - r.r <= reach(r).start && !shooter) return tell('windup', def.windup, 'punch');
  // bosses lob what they lob (desks, steel beams, records) from range
  const l = LOBS[r.kind];
  if (l && r.cooldown <= 0 && see && dist > 40) return tell('deskTell', l.tell, 'desk');
  // chargers run at you in a straight line
  const charger = def.charges || (r.kind === 'manager' && r.phase >= MANAGER.chargeFrom);
  if (charger && r.chargeCd <= 0 && clear && dist > CHARGE.min && dist < CHARGE.max && pathClear(w, r.x, r.y, p.x, p.y, r.r * 0.6, 'red')) {
    return tell('chargeTell', CHARGE.tell, 'charge');
  }
  if (loaded && clear && dist < def.fireRange && r.cooldown <= 0) return tell('aim', def.aimTell, 'aim');
  if (held && !loaded && !ITEMS[held.kind].blade && clear && dist < 120 && r.cooldown <= 0) return tell('throwTell', def.throwTell, 'throw');

  // otherwise, move (a rooted red only turns to face you while it holds its gun)
  if (def.rooted && (loaded || def.speed <= 0)) {
    if (see) r.aim = toP;
    return;
  }
  let dir: { x: number; y: number } | null = null;
  let speed = Math.max(def.speed, def.rooted ? 22 : 0);
  if (loaded && r.kind === 'gunner') {
    if (!clear || dist > def.keepMax) dir = seek(w, r, see);
    else if (dist < def.keepMin) dir = { x: -Math.cos(toP), y: -Math.sin(toP) };
    else {
      strafe(w, r, toP, speed * 0.8);
      dir = null;
    }
  } else if (loaded) {
    // an armed grunt closes in, then edges sideways while it waits to fire
    if (!clear || dist > 72) dir = seek(w, r, see);
    else {
      dir = { x: -Math.sin(toP) * r.strafe, y: Math.cos(toP) * r.strafe };
      speed *= 0.5;
    }
  } else {
    const loot = !held && def.scavenge > 0 && r.grabCd <= 0 ? nearbyGun(w, r, Math.min(def.scavenge, dist)) : null;
    if (loot) {
      const d = Math.hypot(loot.x - r.x, loot.y - r.y) || 1;
      dir = { x: (loot.x - r.x) / d, y: (loot.y - r.y) / d };
    } else dir = seek(w, r, see);
    // a Runner weaves as it comes, so it's hard to shoot head on
    if (dir && def.zigzag && see && dist > 24) {
      r.strafeT -= DT;
      if (r.strafeT <= 0) {
        r.strafe = -r.strafe;
        r.strafeT = randRange(w, 0.25, 0.45);
      }
      const k = 0.9 * def.zigzag;
      const zx = dir.x - dir.y * r.strafe * k, zy = dir.y + dir.x * r.strafe * k;
      const zl = Math.hypot(zx, zy) || 1;
      dir = { x: zx / zl, y: zy / zl };
    }
  }
  if (dir) walkBy(w, r, dir.x * speed * DT, dir.y * speed * DT);
  r.aim = see ? toP : dir ? Math.atan2(dir.y, dir.x) : r.aim;
  scavenge(w, r, ev);
}

/** Sideways to you, turning back at walls and every second or so. */
function strafe(w: World, r: Red, toP: number, speed: number) {
  const moved = walkBy(w, r, -Math.sin(toP) * r.strafe * speed * DT, Math.cos(toP) * r.strafe * speed * DT);
  r.strafeT -= DT;
  if (!moved || r.strafeT <= 0) {
    r.strafe = -r.strafe;
    r.strafeT = randRange(w, 0.8, 1.8);
  }
}

/** Toward the player: straight if the way is open, else down the flow field. */
function seek(w: World, r: Red, see: boolean): { x: number; y: number } | null {
  const p = w.player;
  if (see && pathClear(w, r.x, r.y, p.x, p.y, r.r, 'red') && !w.hotRows.length) {
    const d = Math.hypot(p.x - r.x, p.y - r.y) || 1;
    return { x: (p.x - r.x) / d, y: (p.y - r.y) / d };
  }
  return downhill(w, w.flow, r.x, r.y);
}

/** A loaded gun on the floor this red can see and reach before it reaches you. */
function nearbyGun(w: World, r: Red, within: number) {
  let best = null, bestD = within;
  for (const it of w.items) {
    if (!ITEMS[it.kind].gun || it.ammo <= 0) continue;
    const d = Math.hypot(it.x - r.x, it.y - r.y);
    if (d < bestD && pathClear(w, r.x, r.y, it.x, it.y, r.r, 'red')) {
      best = it;
      bestD = d;
    }
  }
  return best;
}

/** Reds pick up whatever they walk over, if their hands are free (bosses and runners don't bother). */
function scavenge(w: World, r: Red, ev: SimEvent[]) {
  const def = REDS[r.kind];
  if (r.held || r.grabCd > 0 || def.boss || def.tough || def.scavenge <= 0) return;
  const i = w.items.findIndex((it) => Math.hypot(it.x - r.x, it.y - r.y) < r.r + 4);
  if (i < 0) return;
  const it = w.items[i];
  w.items.splice(i, 1);
  r.held = { kind: it.kind, ammo: it.ammo, boosted: it.boosted };
  r.cooldown = Math.max(r.cooldown, 0.4);
  ev.push({ t: 'pickup', x: it.x, y: it.y, item: it.kind, who: 'red' });
}

export function walkBy(w: World, r: Red, dx: number, dy: number): boolean {
  const x0 = r.x, y0 = r.y;
  moveBody(w, r, dx, dy, 'red');
  const d = Math.hypot(r.x - x0, r.y - y0);
  r.walked += d;
  return d > Math.hypot(dx, dy) * 0.3;
}

function fire(w: World, r: Red, ev: SimEvent[]) {
  const h = r.held;
  if (!h || !ITEMS[h.kind].gun || h.ammo <= 0) return;
  const def = ITEMS[h.kind];
  r.cooldown = REDS[r.kind].fireCooldown;
  const x = r.x + Math.cos(r.aim) * (r.r + 3), y = r.y + Math.sin(r.aim) * (r.r + 3);
  // a red's SMG empties its burst in one go, a little fanned
  const rounds = Math.min(h.ammo, def.burst ?? 1);
  for (let i = 0; i < rounds; i++) fireGun(w, def, h.kind, x, y, r.aim + (rounds > 1 ? (i - (rounds - 1) / 2) * 0.07 : 0), 'red', r.id, ev);
  h.ammo -= rounds;
  // the Frame's eyes never run dry
  if (r.kind === 'eye') h.ammo = def.ammo;
}

function throwAt(w: World, r: Red, ev: SimEvent[]) {
  const h = r.held;
  if (!h) return;
  r.held = null;
  const speed = PLAYER.throwSpeed * 0.75;
  const x = r.x + Math.cos(r.aim) * (r.r + 2), y = r.y + Math.sin(r.aim) * (r.r + 2);
  w.thrown.push({
    id: w.nextId++, kind: h.kind, x, y, px: x, py: y, vx: Math.cos(r.aim) * speed, vy: Math.sin(r.aim) * speed,
    from: 'red', ammo: h.ammo, boosted: h.boosted, life: PLAYER.throwRange, bounces: 0, ricocheted: false,
    r: 3, owner: r.id,
  });
  r.cooldown = 0.8;
  ev.push({ t: 'throw', x, y, item: h.kind, from: 'red' });
}

/** A straight run: glass bursts, reds in the way shatter, you die, a wall stuns it, the roof's edge
 *  takes it. */
function charge(w: World, r: Red, ev: SimEvent[]) {
  const p = w.player;
  const ahead = r.r + 2;
  if (tileOfPoint(w, r.x + r.cvx * ahead, r.y + r.cvy * ahead) === TILE_GLASS) breakGlass(w, r.x + r.cvx * ahead, r.y + r.cvy * ahead, ev);
  const want = CHARGE.speed * DT;
  const x0 = r.x, y0 = r.y;
  moveBody(w, r, r.cvx * want, r.cvy * want, 'flung');
  r.walked += Math.hypot(r.x - x0, r.y - y0);
  if (tileOfPoint(w, r.x, r.y) === TILE_DROP) {
    r.state = 'move';
    r.chargeCd = CHARGE.cooldown;
    fall(w, r, Math.atan2(r.cvy, r.cvx), ev);
    return;
  }
  for (const o of w.reds) {
    if (o === r || o.dead || o.hidden || Math.hypot(o.x - r.x, o.y - r.y) > o.r + r.r) continue;
    if (REDS[o.kind].boss) continue;
    shatter(w, o, 'charge', ev, { aim: Math.atan2(r.cvy, r.cvx) });
  }
  if (Math.hypot(p.x - r.x, p.y - r.y) < p.r + r.r + 1) hurtPlayer(w, Math.atan2(r.cvy, r.cvx), ev, r.id);
  r.t -= DT;
  if (Math.hypot(r.x - x0, r.y - y0) < want * 0.5) {
    // into a wall: dazed, and wide open
    r.state = 'move';
    r.stun = CHARGE.wallStun;
    r.chargeCd = CHARGE.cooldown;
    ev.push({ t: 'wall', x: r.x + r.cvx * r.r, y: r.y + r.cvy * r.r });
  } else if (r.t <= 0) {
    r.state = 'recover';
    r.t = 0.5;
    r.chargeCd = CHARGE.cooldown;
  }
}

/** Reds don't stack on each other or stand inside you. Stable order, so it stays deterministic. */
export function separate(w: World) {
  const p = w.player;
  for (let i = 0; i < w.reds.length; i++) {
    const a = w.reds[i];
    if (a.dead || a.hidden) continue;
    const aRoot = !!REDS[a.kind].rooted;
    for (let j = i + 1; j < w.reds.length; j++) {
      const b = w.reds[j];
      if (b.dead || b.hidden) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy), min = a.r + b.r;
      if (d >= min) continue;
      const bRoot = !!REDS[b.kind].rooted;
      const push = (min - d) / (aRoot || bRoot ? 1 : 2);
      const ux = d > 0.01 ? dx / d : 1, uy = d > 0.01 ? dy / d : 0;
      if (a.state !== 'charge' && !aRoot) moveBody(w, a, -ux * push, -uy * push, 'red');
      if (b.state !== 'charge' && !bRoot) moveBody(w, b, ux * push, uy * push, 'red');
    }
    const dx = a.x - p.x, dy = a.y - p.y;
    const d = Math.hypot(dx, dy), min = a.r + p.r;
    if (d < min && a.state !== 'charge') {
      const ux = d > 0.01 ? dx / d : 0, uy = d > 0.01 ? dy / d : 1;
      // you can't shoulder a heavy red (or a rooted one) aside: it holds, and you give way
      if (aRoot || REDS[a.kind].tough) moveBody(w, p, -ux * (min - d), -uy * (min - d), 'player');
      else moveBody(w, a, ux * (min - d), uy * (min - d), 'red');
    }
  }
}
