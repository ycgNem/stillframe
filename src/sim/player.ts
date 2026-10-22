// What the player does in one tick: dash, walk, swap, pick up, shoot, slash, punch, throw.
import { ITEMS } from '../data/items';
import { REDS, TOUGH_STEADY } from '../data/reds';
import { COMBAT, FRAMESKIP, PLAYER, TICK_RATE, TILE } from '../data/tuning';
import { TIER_VALUES } from '../data/upgrades';
import { boxBlocked, moveBody } from './grid';
import { disarm, hurtRed, shove } from './kills';
import { fireGun, parried } from './shots';
import type { Held, Item, Player, Red, SimEvent, TickInput, World } from './types';

const DT = 1 / TICK_RATE;

export function angleDiff(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

export function reachOf(w: World): number {
  return TIER_VALUES.reach[w.mods.reach];
}

/** The item a pick request means: a given id, or the nearest; only within reach. */
export function pickTarget(w: World, pick: number): Item | null {
  const p = w.player, reach = reachOf(w);
  let best: Item | null = null, bestD = Infinity;
  for (const it of w.items) {
    if (pick > 0 && it.id !== pick) continue;
    const d = Math.hypot(it.x - p.x, it.y - p.y);
    if (d <= reach && d < bestD) {
      best = it;
      bestD = d;
    }
  }
  return best;
}

export function stepPlayer(w: World, input: TickInput, ev: SimEvent[]) {
  const p = w.player;
  p.aim = input.aim;
  p.cooldown = Math.max(0, p.cooldown - DT);
  p.grace = Math.max(0, p.grace - DT);
  p.dashCd = Math.max(0, p.dashCd - DT);
  p.actT += DT;

  // the mirror glitch (chapter 5) swaps left and right; the aim still follows the mouse
  if (w.glitch === 'mirror') input = { ...input, mx: -input.mx };
  if (input.dash) dash(w, ev);
  walk(w, input);
  if (input.swap && p.hands.length === 2) {
    p.hands.push(p.hands.shift()!);
    p.burstLeft = 0;
    ev.push({ t: 'pickup', x: p.x, y: p.y, item: p.hands[0].kind, who: 'player' });
  }
  if (input.pick) {
    const it = pickTarget(w, input.pick);
    if (it) take(w, it, ev);
  }
  // the rest of a burst gun's burst
  if (p.burstLeft > 0) {
    p.burstT -= DT;
    const h = p.hands[0];
    if (!h || !ITEMS[h.kind].burst || h.ammo <= 0) p.burstLeft = 0;
    else if (p.burstT <= 0) {
      round(w, h, ev);
      p.burstLeft--;
      p.burstT = ITEMS[h.kind].burstGap ?? 0;
    }
  }
  if (input.alt && p.hands.length && p.cooldown <= 0 && p.burstLeft <= 0) throwHeld(w, ev);
  if (input.fire && p.cooldown <= 0 && p.burstLeft <= 0) {
    const h = p.hands[0];
    if (!h) punch(w, ev);
    else if (ITEMS[h.kind].blade) slash(w, h, ev);
    else if (ITEMS[h.kind].gun && h.ammo > 0) shoot(w, h, ev);
    else throwHeld(w, ev);
  }
}

function walk(w: World, input: TickInput) {
  const p = w.player;
  const len = Math.hypot(input.mx, input.my);
  const speed = PLAYER.speed * TIER_VALUES.strideSpeed[w.mods.stride];
  const tx = len > 0 ? (input.mx / Math.max(1, len)) * speed : 0;
  const ty = len > 0 ? (input.my / Math.max(1, len)) * speed : 0;
  const dvx = tx - p.vx, dvy = ty - p.vy;
  const dv = Math.hypot(dvx, dvy);
  const maxDv = (len > 0 ? PLAYER.accel : PLAYER.decel) * DT;
  if (dv <= maxDv) {
    p.vx = tx;
    p.vy = ty;
  } else {
    p.vx += (dvx / dv) * maxDv;
    p.vy += (dvy / dv) * maxDv;
  }
  if (p.vx === 0 && p.vy === 0) return;
  const x0 = p.x, y0 = p.y;
  const b = moveBody(w, p, p.vx * DT, p.vy * DT, 'player');
  if (b.bx) p.vx = 0;
  if (b.by) p.vy = 0;
  if (b.bx && !input.my && tx) cornerSlide(w, p, Math.sign(tx), 0);
  if (b.by && !input.mx && ty) cornerSlide(w, p, 0, Math.sign(ty));
  p.walked += Math.hypot(p.x - x0, p.y - y0);
}

/** Walking straight into a corner you only brush: step round it, up to `cornerSlide` px to the side. */
function cornerSlide(w: World, p: Player, dx: number, dy: number) {
  const most = PLAYER.speed * DT;
  for (let off = 1; off <= PLAYER.cornerSlide; off++) {
    for (const s of [-1, 1]) {
      const ox = dx ? 0 : s * off, oy = dx ? s * off : 0;
      if (boxBlocked(w, p.x + ox, p.y + oy, p.r, 'player') || boxBlocked(w, p.x + ox + dx, p.y + oy + dy, p.r, 'player')) continue;
      moveBody(w, p, Math.sign(ox) * Math.min(off, most), Math.sign(oy) * Math.min(off, most), 'player');
      return;
    }
  }
}

/** Frameskip: an instant line move toward the aim, stopped by walls, in zero game time. */
function dash(w: World, ev: SimEvent[]) {
  const p = w.player, tier = w.mods.frameskip;
  if (tier <= 0 || p.dashCd > 0) return;
  const max = FRAMESKIP.tiles[tier] * TILE;
  const dx = Math.cos(p.aim), dy = Math.sin(p.aim);
  const x0 = p.x, y0 = p.y;
  const crossed: Red[] = [];
  let x = p.x, y = p.y;
  for (let d = 1; d <= max; d++) {
    const nx = x0 + dx * d, ny = y0 + dy * d;
    if (boxBlocked(w, nx, ny, p.r, 'player')) break;
    x = nx;
    y = ny;
    for (const r of w.reds) if (!r.dead && !r.hidden && !crossed.includes(r) && Math.hypot(r.x - x, r.y - y) < r.r + p.r) crossed.push(r);
  }
  p.x = p.px = x;
  p.y = p.py = y;
  p.dashCd = FRAMESKIP.cooldown[tier];
  ev.push({ t: 'dash', x: x0, y: y0, x2: x, y2: y });
  if (tier >= 3) for (const r of crossed) hurtRed(w, r, 99, 'dash', ev, { aim: p.aim });
}

function take(w: World, it: Item, ev: SimEvent[]) {
  const p = w.player;
  w.items.splice(w.items.indexOf(it), 1);
  const held: Held = { kind: it.kind, ammo: it.ammo, boosted: it.boosted };
  if (ITEMS[it.kind].gun && !held.boosted && w.mods.mag > 0) {
    held.ammo += TIER_VALUES.magBonus[w.mods.mag];
    held.boosted = true;
  }
  p.burstLeft = 0;
  if (p.hands.length === 0) p.hands.push(held);
  else if (w.mods.holster && p.hands.length === 1) p.hands.unshift(held);
  else {
    const old = p.hands[0];
    w.items.push({ id: w.nextId++, kind: old.kind, x: p.x, y: p.y + 2, ammo: old.ammo, boosted: old.boosted });
    p.hands[0] = held;
  }
  w.stats.pickups++;
  ev.push({ t: 'pickup', x: it.x, y: it.y, item: it.kind, who: 'player' });
}

function shoot(w: World, h: Held, ev: SimEvent[]) {
  const p = w.player, def = ITEMS[h.kind];
  p.cooldown = def.cooldown;
  p.act = 'shoot';
  p.actT = 0;
  w.stats.shots++;
  round(w, h, ev);
  if (def.burst && def.burst > 1) {
    p.burstLeft = def.burst - 1;
    p.burstT = def.burstGap ?? 0;
  }
}

/** One round out of the gun in your hand. */
function round(w: World, h: Held, ev: SimEvent[]) {
  const p = w.player;
  h.ammo--;
  fireGun(w, ITEMS[h.kind], h.kind, p.x + Math.cos(p.aim) * (p.r + 3), p.y + Math.sin(p.aim) * (p.r + 3), p.aim, 'player', p.id, ev);
}

/** The katana: everything in the arc in front of you is cut, bullets and throws included (parries). */
function slash(w: World, h: Held, ev: SimEvent[]) {
  const p = w.player, blade = ITEMS[h.kind].blade!;
  p.cooldown = ITEMS[h.kind].cooldown;
  p.act = 'punch';
  p.actT = 0;
  w.stats.punches++;
  ev.push({ t: 'slash', x: p.x, y: p.y, aim: p.aim, from: 'player' });
  const reach = p.r + blade.reach;
  for (const r of w.reds) {
    if (r.dead || r.hidden) continue;
    const d = Math.hypot(r.x - p.x, r.y - p.y);
    if (d - r.r > reach || (d > r.r + p.r && angleDiff(Math.atan2(r.y - p.y, r.x - p.x), p.aim) > blade.arc / 2)) continue;
    disarm(w, r, p.x, p.y, ev);
    hurtRed(w, r, ITEMS[h.kind].damage, 'slash', ev, { aim: p.aim });
  }
  for (const b of w.bullets) {
    if (b.from !== 'red' || b.life <= 0) continue;
    const d = Math.hypot(b.x - p.x, b.y - p.y);
    if (d > reach + 6 || angleDiff(Math.atan2(b.y - p.y, b.x - p.x), p.aim) > blade.arc / 2) continue;
    b.life = 0;
    b.hit = true;
    parried(w, b.x, b.y, ev);
  }
  for (const t of w.thrown) {
    if (t.from !== 'red' || t.life <= 0) continue;
    const d = Math.hypot(t.x - p.x, t.y - p.y);
    if (d > reach + t.r || angleDiff(Math.atan2(t.y - p.y, t.x - p.x), p.aim) > blade.arc / 2) continue;
    t.life = -1;
    parried(w, t.x, t.y, ev);
    ev.push({ t: 'break', x: t.x, y: t.y, item: t.kind });
  }
}

function punch(w: World, ev: SimEvent[]) {
  const p = w.player;
  p.cooldown = PLAYER.punchCooldown;
  p.act = 'punch';
  p.actT = 0;
  w.stats.punches++;
  const target = punchTarget(w, p.aim);
  const fx = p.x + Math.cos(p.aim) * (p.r + 6), fy = p.y + Math.sin(p.aim) * (p.r + 6);
  ev.push({ t: 'punch', x: target ? (p.x + target.x) / 2 : fx, y: target ? (p.y + target.y) / 2 : fy, aim: p.aim, hit: !!target, from: 'player' });
  if (!target) return;
  const a = Math.atan2(target.y - p.y, target.x - p.x);
  disarm(w, target, p.x, p.y, ev);
  // a heavy red (a Brute, a boss) is rocked by the first punch, then shrugs punches off for a while, and
  // it's too heavy to knock back: like throws, fists can't stun-lock it or walk it off a roof
  const tough = !!REDS[target.kind].tough;
  if (!tough || target.steady <= 0) {
    target.stun = Math.max(target.stun, PLAYER.punchStun);
    if (target.state !== 'enter' && target.state !== 'charge') {
      target.state = 'move';
      target.t = 0;
    }
    if (tough) target.steady = TOUGH_STEADY;
  }
  hurtRed(w, target, PLAYER.punchDamage, 'punch', ev, { aim: a });
  // a knock back; at a roof's edge, over it goes
  if (!tough) shove(w, target, Math.cos(a) * PLAYER.punchKnock, Math.sin(a) * PLAYER.punchKnock, ev);
}

/** Who a punch thrown now would hit: of the reds in reach and in the cone, the one closest to where you
 *  aim (not just the nearest). The app asks too, to light the crosshair. */
export function punchTarget(w: World, aim: number): Red | null {
  const p = w.player;
  let target: Red | null = null, bestA = Infinity;
  for (const r of w.reds) {
    if (r.dead || r.hidden) continue;
    const d = Math.hypot(r.x - p.x, r.y - p.y);
    if (d - r.r - p.r > PLAYER.punchReach) continue;
    const a = angleDiff(Math.atan2(r.y - p.y, r.x - p.x), aim);
    if (d > r.r + p.r && a > PLAYER.punchArc / 2) continue;
    if (a >= bestA) continue;
    target = r;
    bestA = a;
  }
  return target;
}

function throwHeld(w: World, ev: SimEvent[]) {
  const p = w.player;
  const h = p.hands.shift();
  if (!h) return;
  p.burstLeft = 0;
  const speed = PLAYER.throwSpeed * TIER_VALUES.armSpeed[w.mods.arm];
  const dx = Math.cos(p.aim), dy = Math.sin(p.aim);
  const x = p.x + dx * (p.r + 2), y = p.y + dy * (p.r + 2);
  w.thrown.push({
    id: w.nextId++, kind: h.kind, x, y, px: x, py: y, vx: dx * speed, vy: dy * speed, from: 'player',
    ammo: h.ammo, boosted: h.boosted, life: PLAYER.throwRange, bounces: w.mods.arm >= 3 ? 1 : 0, ricocheted: false,
    r: ITEMS[h.kind].radius ?? COMBAT.thrownRadius, owner: p.id,
  });
  p.cooldown = PLAYER.throwCooldown;
  p.act = 'throw';
  p.actT = 0;
  w.stats.throws++;
  ev.push({ t: 'throw', x, y, item: h.kind, from: 'player' });
}
