// A scripted player: reads the World and produces TickInputs, exactly like the keyboard and mouse do.
// The tests use it to prove every level can be cleared (docs/PLAN.md M3), and the title screen lets it
// play in the background. It is not part of the sim: it only reads state and returns plain input.
import { ITEMS } from '../data/items';
import { PLAYER } from '../data/tuning';
import { boxBlocked, canSee, cellIndex, shotClear } from '../sim/grid';
import { bfs, downhill } from '../sim/nav';
import { reachOf } from '../sim/player';
import type { Item, Red, TickInput, World } from '../sim/types';

export interface BotMemory {
  /** distance field toward the current goal cell, and the cell it was built for */
  field: number[];
  fieldAt: number;
  fieldVersion: number;
  /** ticks spent without getting closer, to shake loose when stuck */
  stuck: number;
  lastD: number;
}

export function newBot(): BotMemory {
  return { field: [], fieldAt: -2, fieldVersion: -1, stuck: 0, lastD: Infinity };
}

const NONE: TickInput = { mx: 0, my: 0, aim: 0, fire: false, alt: false, pick: 0, swap: false, dash: false };

export function botInput(w: World, m: BotMemory): TickInput {
  const p = w.player;
  const input: TickInput = { ...NONE, aim: p.aim };
  const h = p.hands[0];
  const loaded = !!h && ITEMS[h.kind].gun && h.ammo > 0;

  const reds = w.reds.filter((r) => !r.dead && r.state !== 'enter');
  const near = (list: Red[]) => list.slice().sort((a, b) => dist(p, a) - dist(p, b));
  const visible = near(reds.filter((r) => shotClear(w, p.x, p.y, r.x, r.y)));
  const tough = (r: Red) => r.kind === 'brute' || r.kind === 'manager';
  const stunnable = (r: Red) => r.stun <= 0 && !(tough(r) && (r.steady > 0 || r.guard > 0));
  const stunned = near(reds.filter((r) => r.stun > 0.25 && !tough(r)));

  let goal: { x: number; y: number } | null = null;
  let keepAway = 0;
  if (w.goal.kind === 'escape' && w.exit) goal = w.exit;

  if (loaded) {
    // shoot what's coming at you first (a parry), then the nearest red that isn't shrugging hits off
    const incoming = w.thrown.find((t) => t.from === 'red' && dist(p, t) < 90);
    const t = visible.find((r) => dist(p, r) < 220 && r.guard <= 0) ?? visible.find((r) => dist(p, r) < 220);
    if (incoming) {
      input.aim = Math.atan2(incoming.y - p.y, incoming.x - p.x);
      input.fire = p.cooldown <= 0;
    } else if (t) {
      input.aim = lead(p, t, ITEMS[h!.kind].speed);
      input.fire = p.cooldown <= 0 && t.guard <= 0;
      keepAway = 48;
    } else if (!goal && reds.length) goal = near(reds)[0];
  } else if (h) {
    // an empty gun or a throwable: throw it at a red it will stun, then fight on
    const t = visible.find((r) => dist(p, r) < 100 && stunnable(r));
    const g = bestLoot(w, true);
    if (t) {
      input.aim = lead(p, t, PLAYER.throwSpeed);
      input.alt = p.cooldown <= 0;
    } else if (g && dist(p, g) <= reachOf(w)) input.pick = g.id;
    else if (!goal) goal = g ?? stunned[0] ?? (reds.length ? near(reds)[0] : null);
    punchIfClose(w, input, reds);
  } else {
    const g = bestLoot(w, true);
    const junk = bestLoot(w, false);
    const closest = near(reds)[0];
    if (g && dist(p, g) <= reachOf(w)) input.pick = g.id;
    else if (junk && junk !== g && dist(p, junk) <= reachOf(w) && closest && dist(p, closest) > 40) input.pick = junk.id;
    else if (stunned[0] && dist(p, stunned[0]) < 120) {
      if (!goal) goal = stunned[0];
    } else if (closest && dist(p, closest) - closest.r - p.r <= PLAYER.punchReach + 6 && !tough(closest)) {
      if (!goal) goal = closest;
    } else if (g && (!closest || dist(p, g) < dist(p, closest) * 1.5 + 40)) {
      if (!goal) goal = g;
    } else if (junk && dist(p, junk) < 70) {
      if (!goal) goal = junk;
    } else if (!goal && closest) goal = closest;
    punchIfClose(w, input, reds);
  }

  // movement: toward the goal, unless something is about to hit; then the safest direction
  let mx = 0, my = 0;
  if (goal) {
    const d = dist(p, goal);
    if (d > keepAway + 2) {
      const dir = towards(w, m, goal);
      if (dir) {
        mx = dir.x;
        my = dir.y;
      }
    }
    if (d < m.lastD - 0.5) m.stuck = 0;
    else m.stuck++;
    m.lastD = d;
  }
  if (m.stuck > 90) {
    // shake loose: sidestep for a moment
    const a = (w.tick / 30) % (Math.PI * 2);
    mx = Math.cos(a);
    my = Math.sin(a);
    if (m.stuck > 140) m.stuck = 0;
  }
  const safe = safest(w, mx, my);
  mx = safe.x;
  my = safe.y;
  input.mx = mx;
  input.my = my;
  if (!input.fire && !input.alt && !input.pick && (mx || my)) input.aim = Math.atan2(my, mx);
  return input;
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Aim where a moving red will be when the projectile gets there. */
function lead(p: { x: number; y: number }, r: Red, speed: number): number {
  const vx = (r.x - r.px) * 60, vy = (r.y - r.py) * 60;
  const t = dist(p, r) / speed;
  return Math.atan2(r.y + vy * t - p.y, r.x + vx * t - p.x);
}

function punchIfClose(w: World, input: TickInput, reds: Red[]) {
  const p = w.player;
  for (const r of reds) {
    const d = dist(p, r);
    if (d - r.r - p.r > PLAYER.punchReach - 1) continue;
    input.aim = Math.atan2(r.y - p.y, r.x - p.x);
    input.fire = p.cooldown <= 0;
    return;
  }
}

/** The most useful thing on the floor: a loaded gun, or (unless `loadedOnly`) anything throwable nearby. */
function bestLoot(w: World, loadedOnly: boolean): Item | null {
  const p = w.player;
  let best: Item | null = null, bestD = Infinity;
  for (const it of w.items) {
    const gun = ITEMS[it.kind].gun && it.ammo > 0;
    if (loadedOnly && !gun) continue;
    const d = dist(p, it) * (gun ? 1 : 2.5);
    if (d < bestD && d < 260) {
      best = it;
      bestD = d;
    }
  }
  return best;
}

function towards(w: World, m: BotMemory, goal: { x: number; y: number }) {
  const p = w.player;
  if (canSee(w, p.x, p.y, goal.x, goal.y) && clearWalk(w, p.x, p.y, goal.x, goal.y)) {
    const d = dist(p, goal) || 1;
    return { x: (goal.x - p.x) / d, y: (goal.y - p.y) / d };
  }
  const at = cellIndex(w, goal.x, goal.y);
  if (at !== m.fieldAt || m.fieldVersion !== w.tilesVersion) {
    m.field = bfs(w, at);
    m.fieldAt = at;
    m.fieldVersion = w.tilesVersion;
  }
  return downhill(w, m.field, p.x, p.y);
}

function clearWalk(w: World, ax: number, ay: number, bx: number, by: number) {
  const d = Math.hypot(bx - ax, by - ay);
  const n = Math.max(1, Math.ceil(d / 4));
  for (let i = 1; i <= n; i++) if (boxBlocked(w, ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n, w.player.r + 0.5, 'player')) return false;
  return true;
}

const DIRS8 = Array.from({ length: 8 }, (_, i) => ({ x: Math.cos((i * Math.PI) / 4), y: Math.sin((i * Math.PI) / 4) }));

/**
 * Picks a movement direction: the wanted one if nothing will hit you along it in the next ~0.8 game s,
 * else whichever of the 8 directions (or standing still) keeps the most room from bullets, throws,
 * aimed guns about to fire, punches about to land and charges.
 */
function safest(w: World, wx: number, wy: number): { x: number; y: number } {
  const want = { x: wx, y: wy };
  const threats = threatsOf(w);
  if (!threats.length) return want;
  const score = (d: { x: number; y: number }) => clearance(w, d, threats);
  const mine = score(want);
  if (mine >= 6) return want;
  let best = want, bestS = mine;
  for (const d of [...DIRS8, { x: 0, y: 0 }]) {
    const s = score(d) + (d.x * wx + d.y * wy) * 0.5;
    if (s > bestS) {
      best = d;
      bestS = s;
    }
  }
  return best;
}

interface Threat {
  /** where it is at time t (game s from now), or null if it isn't a danger then */
  at(t: number): { x: number; y: number; r: number } | null;
}

function threatsOf(w: World): Threat[] {
  const p = w.player;
  const out: Threat[] = [];
  const line = (x: number, y: number, vx: number, vy: number, r: number, from = 0, until = 2): Threat => ({
    at: (t) => (t < from || t > until ? null : { x: x + vx * (t - from), y: y + vy * (t - from), r }),
  });
  for (const b of w.bullets) if (b.from === 'red') out.push(line(b.x, b.y, b.vx, b.vy, 1.5));
  for (const t of w.thrown) if (t.from === 'red') out.push(line(t.x, t.y, t.vx, t.vy, t.r + 1));
  for (const r of w.reds) {
    if (r.dead) continue;
    const a = Math.atan2(p.y - r.y, p.x - r.x);
    if (r.state === 'aim' && r.held) {
      const sp = ITEMS[r.held.kind].speed * 0.62;
      out.push(line(r.x, r.y, Math.cos(a) * sp, Math.sin(a) * sp, 2, r.t));
    }
    if (r.state === 'throwTell') out.push(line(r.x, r.y, Math.cos(a) * 180, Math.sin(a) * 180, 4, r.t));
    if (r.state === 'deskTell') out.push(line(r.x, r.y, Math.cos(a) * 115, Math.sin(a) * 115, 7, r.t));
    if (r.state === 'chargeTell') out.push(line(r.x, r.y, Math.cos(r.aim) * 135, Math.sin(r.aim) * 135, r.r + 2, r.t, r.t + 1.3));
    if (r.state === 'charge') out.push(line(r.x, r.y, r.cvx * 135, r.cvy * 135, r.r + 2, 0, r.t));
    if (r.state === 'windup') {
      const reach = r.r + 13;
      out.push({ at: (t) => (Math.abs(t - r.t) < 0.06 ? { x: r.x + Math.cos(r.aim) * reach * 0.5, y: r.y + Math.sin(r.aim) * reach * 0.5, r: reach * 0.75 } : null) });
    }
  }
  return out;
}

/** The least room (px) between you and any threat over the next 0.8 s, walking in direction d. */
function clearance(w: World, d: { x: number; y: number }, threats: Threat[]): number {
  const p = w.player;
  let x = p.x, y = p.y, worst = 20;
  for (let i = 1; i <= 16; i++) {
    const t = i * 0.05;
    const nx = x + d.x * PLAYER.speed * 0.05, ny = y + d.y * PLAYER.speed * 0.05;
    if (!boxBlocked(w, nx, y, p.r, 'player')) x = nx;
    if (!boxBlocked(w, x, ny, p.r, 'player')) y = ny;
    for (const th of threats) {
      const q = th.at(t);
      if (!q) continue;
      // earlier collisions matter more
      const c = (Math.hypot(q.x - x, q.y - y) - p.r - q.r) + t * 4;
      if (c < worst) worst = c;
    }
  }
  return worst;
}
