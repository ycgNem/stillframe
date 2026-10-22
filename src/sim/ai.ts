// How reds think (GAME_DESIGN §7). Every attack has a tell of at least 0.4 game s (STYLE.md §6 rule 5):
// a punch winds up, a gun shows its red aim line, a charge and a desk throw lift first. Reds use the
// same verbs as you: walk, punch, shoot, throw, pick up.
import { ITEMS } from '../data/items';
import { CHARGE, MANAGER, REDS } from '../data/reds';
import { COMBAT, PLAYER, TICK_RATE } from '../data/tuning';
import { canSee, moveBody, pathClear, shotClear, TILE_GLASS, tileOfPoint } from './grid';
import { hurtPlayer, shatter } from './kills';
import { downhill } from './nav';
import { angleDiff } from './player';
import { randRange } from './rng';
import { breakGlass } from './shots';
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
    if (r.stun > 0) {
      r.stun = Math.max(0, r.stun - DT);
      if (r.stun === 0) r.stunByThrow = false;
      if (r.state !== 'enter') continue;
    }
    think(w, r, ev);
  }
}

function think(w: World, r: Red, ev: SimEvent[]) {
  const p = w.player, def = REDS[r.kind];
  const dx = p.x - r.x, dy = p.y - r.y;
  const dist = Math.hypot(dx, dy);
  const toP = Math.atan2(dy, dx);
  switch (r.state) {
    case 'enter': {
      walkBy(w, r, r.cvx * def.speed * DT, r.cvy * def.speed * DT);
      r.t -= DT;
      if (r.t <= 0) r.state = 'move';
      return;
    }
    case 'windup': {
      r.t -= DT;
      if (r.t > 0) return;
      const hit = dist - p.r - r.r <= def.punchReach && angleDiff(toP, r.aim) <= 0.95;
      ev.push({ t: 'punch', x: r.x + Math.cos(r.aim) * 8, y: r.y + Math.sin(r.aim) * 8, aim: r.aim, hit, from: 'red' });
      if (hit) hurtPlayer(w, r.aim, ev);
      r.state = 'recover';
      r.t = def.recover;
      return;
    }
    case 'aim': {
      r.t -= DT;
      if (r.t > def.aimLock) r.aim = toP;
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
      const sx = r.x + Math.cos(r.aim) * (r.r + 7), sy = r.y + Math.sin(r.aim) * (r.r + 7);
      w.thrown.push({
        id: w.nextId++, kind: 'desk', x: sx, y: sy, px: sx, py: sy,
        vx: Math.cos(r.aim) * MANAGER.deskSpeed, vy: Math.sin(r.aim) * MANAGER.deskSpeed,
        from: 'red', ammo: 0, boosted: false, life: 400, bounces: 0, ricocheted: false, r: ITEMS.desk.radius ?? 6, owner: r.id,
      });
      ev.push({ t: 'throw', x: sx, y: sy, item: 'desk', from: 'red' });
      r.cooldown = MANAGER.deskCooldown[Math.min(r.phase, MANAGER.deskCooldown.length - 1)];
      r.state = 'recover';
      r.t = 0.4;
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

  // close enough to hit: wind up a punch (dodge it by stepping back or to the side). A gunner with a
  // loaded gun backs off and shoots instead.
  if (see && dist - p.r - r.r <= def.punchStart && !(loaded && r.kind === 'gunner')) return tell('windup', def.windup, 'punch');
  // the Manager throws desks from range
  if (r.kind === 'manager' && r.cooldown <= 0 && see && dist > 40) return tell('deskTell', MANAGER.deskTell, 'desk');
  // brutes (and the angry Manager) charge in a straight line
  const charger = r.kind === 'brute' || (r.kind === 'manager' && r.phase >= MANAGER.chargeFrom);
  if (charger && r.chargeCd <= 0 && clear && dist > CHARGE.min && dist < CHARGE.max && pathClear(w, r.x, r.y, p.x, p.y, r.r * 0.6, 'red')) {
    return tell('chargeTell', CHARGE.tell, 'charge');
  }
  if (loaded && clear && dist < def.fireRange && r.cooldown <= 0) return tell('aim', def.aimTell, 'aim');
  if (held && !loaded && clear && dist < 120 && r.cooldown <= 0) return tell('throwTell', def.throwTell, 'throw');

  // otherwise, move
  let dir: { x: number; y: number } | null = null;
  let speed = def.speed;
  if (loaded && r.kind === 'gunner') {
    if (!clear || dist > def.keepMax) dir = seek(w, r, see);
    else if (dist < def.keepMin) dir = { x: -Math.cos(toP), y: -Math.sin(toP) };
    else {
      dir = { x: -Math.sin(toP) * r.strafe, y: Math.cos(toP) * r.strafe };
      speed *= 0.8;
    }
    r.strafeT -= DT;
    if (r.strafeT <= 0) {
      r.strafe = -r.strafe;
      r.strafeT = randRange(w, 0.8, 1.8);
    }
  } else if (loaded) {
    // an armed grunt closes in, then edges sideways while it waits to fire
    if (!clear || dist > 72) dir = seek(w, r, see);
    else {
      dir = { x: -Math.sin(toP) * r.strafe, y: Math.cos(toP) * r.strafe };
      speed *= 0.5;
    }
  } else {
    const loot = !held && def.scavenge > 0 ? nearbyGun(w, r, Math.min(def.scavenge, dist)) : null;
    if (loot) {
      const d = Math.hypot(loot.x - r.x, loot.y - r.y) || 1;
      dir = { x: (loot.x - r.x) / d, y: (loot.y - r.y) / d };
    } else dir = seek(w, r, see);
  }
  if (dir) {
    const moved = walkBy(w, r, dir.x * speed * DT, dir.y * speed * DT);
    if (!moved && loaded && r.kind === 'gunner') r.strafe = -r.strafe;
  }
  r.aim = see ? toP : dir ? Math.atan2(dir.y, dir.x) : r.aim;
  scavenge(w, r, ev);
}

/** Toward the player: straight if the way is open, else down the flow field. */
function seek(w: World, r: Red, see: boolean): { x: number; y: number } | null {
  const p = w.player;
  if (see && pathClear(w, r.x, r.y, p.x, p.y, r.r, 'red')) {
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

/** Reds pick up whatever they walk over, if their hands are free. */
function scavenge(w: World, r: Red, ev: SimEvent[]) {
  if (r.held || r.kind === 'brute' || r.kind === 'manager') return;
  const i = w.items.findIndex((it) => Math.hypot(it.x - r.x, it.y - r.y) < r.r + 4);
  if (i < 0) return;
  const it = w.items[i];
  w.items.splice(i, 1);
  r.held = { kind: it.kind, ammo: it.ammo, boosted: it.boosted };
  r.cooldown = Math.max(r.cooldown, 0.4);
  ev.push({ t: 'pickup', x: it.x, y: it.y, item: it.kind, who: 'red' });
}

function walkBy(w: World, r: Red, dx: number, dy: number): boolean {
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
  h.ammo--;
  r.cooldown = REDS[r.kind].fireCooldown;
  const speed = def.speed * COMBAT.redBulletScale;
  for (let i = 0; i < def.pellets; i++) {
    const spread = def.pellets > 1 ? (i / (def.pellets - 1) - 0.5) * def.spread : 0;
    const a = r.aim + spread + randRange(w, -COMBAT.redSpread, COMBAT.redSpread);
    const x = r.x + Math.cos(a) * (r.r + 3), y = r.y + Math.sin(a) * (r.r + 3);
    w.bullets.push({ id: w.nextId++, x, y, px: x, py: y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, from: 'red', life: def.range, damage: def.damage, hit: false });
  }
  ev.push({ t: 'shot', x: r.x + Math.cos(r.aim) * (r.r + 3), y: r.y + Math.sin(r.aim) * (r.r + 3), aim: r.aim, item: h.kind, from: 'red' });
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
    r: COMBAT.thrownRadius, owner: r.id,
  });
  r.cooldown = 0.8;
  ev.push({ t: 'throw', x, y, item: h.kind, from: 'red' });
}

/** A straight run: glass bursts, reds in the way shatter, you die, a wall stuns it. */
function charge(w: World, r: Red, ev: SimEvent[]) {
  const p = w.player;
  const ahead = r.r + 2;
  if (tileOfPoint(w, r.x + r.cvx * ahead, r.y + r.cvy * ahead) === TILE_GLASS) breakGlass(w, r.x + r.cvx * ahead, r.y + r.cvy * ahead, ev);
  const want = CHARGE.speed * DT;
  const x0 = r.x, y0 = r.y;
  moveBody(w, r, r.cvx * want, r.cvy * want, 'player');
  r.walked += Math.hypot(r.x - x0, r.y - y0);
  for (const o of w.reds) {
    if (o === r || o.dead || Math.hypot(o.x - r.x, o.y - r.y) > o.r + r.r) continue;
    shatter(w, o, 'charge', ev, { aim: Math.atan2(r.cvy, r.cvx) });
  }
  if (Math.hypot(p.x - r.x, p.y - r.y) < p.r + r.r + 1) hurtPlayer(w, Math.atan2(r.cvy, r.cvx), ev);
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
    if (a.dead) continue;
    for (let j = i + 1; j < w.reds.length; j++) {
      const b = w.reds[j];
      if (b.dead) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy), min = a.r + b.r;
      if (d >= min) continue;
      const push = (min - d) / 2;
      const ux = d > 0.01 ? dx / d : 1, uy = d > 0.01 ? dy / d : 0;
      if (a.state !== 'charge') moveBody(w, a, -ux * push, -uy * push, 'red');
      if (b.state !== 'charge') moveBody(w, b, ux * push, uy * push, 'red');
    }
    const dx = a.x - p.x, dy = a.y - p.y;
    const d = Math.hypot(dx, dy), min = a.r + p.r;
    if (d < min && a.state !== 'charge') {
      const ux = d > 0.01 ? dx / d : 0, uy = d > 0.01 ? dy / d : 1;
      moveBody(w, a, ux * (min - d), uy * (min - d), 'red');
    }
  }
}
