// The bosses' own moves (GAME_DESIGN §7): what they lob, the Conductor's train rides and landings, the
// Foreman climbing back after a fall, and the Frame's eyes that only open while time runs.
import type { ItemKind } from '../data/items';
import { ITEMS } from '../data/items';
import { CONDUCTOR, DJ, FOREMAN, FRAME, MANAGER } from '../data/reds';
import { TICK_RATE, TILE } from '../data/tuning';
import { TILE_FLOOR, tileAt } from './grid';
import { hurtPlayer, shatter } from './kills';
import type { Red, SimEvent, World } from './types';

const DT = 1 / TICK_RATE;

/** What each boss throws: the tell before it, how fast it flies, and the wait between throws per phase. */
export const LOBS: Partial<Record<Red['kind'], { item: ItemKind; tell: number; speed: number; cooldown: number[] }>> = {
  manager: { item: 'desk', tell: MANAGER.deskTell, speed: MANAGER.deskSpeed, cooldown: MANAGER.deskCooldown },
  foreman: { item: 'beam', tell: FOREMAN.beamTell, speed: FOREMAN.beamSpeed, cooldown: FOREMAN.beamCooldown },
  dj: { item: 'record', tell: DJ.recordTell, speed: DJ.recordSpeed, cooldown: DJ.recordCooldown },
};

/** The boss lets go of what it lobs, along its aim. */
export function lob(w: World, r: Red, ev: SimEvent[]) {
  const l = LOBS[r.kind];
  if (!l) return;
  const sx = r.x + Math.cos(r.aim) * (r.r + 7), sy = r.y + Math.sin(r.aim) * (r.r + 7);
  w.thrown.push({
    id: w.nextId++, kind: l.item, x: sx, y: sy, px: sx, py: sy, vx: Math.cos(r.aim) * l.speed, vy: Math.sin(r.aim) * l.speed,
    from: 'red', ammo: 0, boosted: false, life: 400, bounces: 0, ricocheted: false, r: ITEMS[l.item].radius ?? 6, owner: r.id,
  });
  ev.push({ t: 'throw', x: sx, y: sy, item: l.item, from: 'red' });
  r.cooldown = l.cooldown[Math.min(r.phase, l.cooldown.length - 1)];
}

/** The track the Conductor rides: the one whose trains stop. */
function bossTrack(w: World): number {
  return w.trackDefs.findIndex((t) => !!t.stop);
}

function stoppedTrain(w: World) {
  const k = bossTrack(w);
  return w.trains.find((t) => t.track === k && t.vx === 0) ?? null;
}

/**
 * A boss's own decisions while it stands on the floor. Returns true when it took over this tick (so the
 * ordinary punch, charge and gun logic doesn't run).
 */
export function bossDecide(w: World, r: Red, dist: number, toP: number, ev: SimEvent[]): boolean {
  if (r.kind === 'conductor') {
    if (r.state === 'board') {
      r.t -= DT;
      if (r.t > 0) return true;
      // up onto the roof of the train, out of reach
      r.hidden = true;
      r.state = 'ride';
      r.t = CONDUCTOR.ride;
      return true;
    }
    if (r.state === 'move' && r.timer <= 0 && stoppedTrain(w)) {
      r.state = 'board';
      r.t = CONDUCTOR.boardTell;
      ev.push({ t: 'tell', x: r.x, y: r.y, id: r.id, what: 'board' });
      return true;
    }
    return false;
  }
  if (r.kind === 'eye') {
    if (r.state === 'move' && r.timer <= 0) {
      r.state = 'ringTell';
      r.t = FRAME.ringTell;
      r.timer = FRAME.ringEvery + (r.id % 3) * FRAME.ringStagger;
      ev.push({ t: 'tell', x: r.x, y: r.y, id: r.id, what: 'ring' });
      return true;
    }
    return false;
  }
  return false;
}

/** Off the floor: riding a train, coming down onto a landing spot, or climbing back up after a fall. */
export function hiddenStep(w: World, r: Red, ev: SimEvent[]) {
  const p = w.player;
  r.t -= DT;
  if (r.state === 'ride') {
    const k = bossTrack(w);
    const train = w.trains.find((t) => t.track === k);
    if (train) {
      r.x = r.px = train.x + train.w / 2;
      r.y = r.py = train.y + train.h / 2;
    }
    const stop = stoppedTrain(w);
    if (r.t <= 0 && stop && stop.x + stop.w > 0 && stop.x < w.cols * TILE) {
      // down it comes, where you're standing now: a circle on the floor shows where
      const spot = landingSpot(w, p.x, p.y);
      r.tx = spot.x;
      r.ty = spot.y;
      r.state = 'land';
      r.t = CONDUCTOR.landTell;
      ev.push({ t: 'tell', x: spot.x, y: spot.y, id: r.id, what: 'land' });
    }
    return;
  }
  if (r.state === 'land') {
    if (r.t > 0) return;
    r.hidden = false;
    r.x = r.px = r.tx;
    r.y = r.py = r.ty;
    r.state = 'recover';
    r.t = 0.6;
    r.timer = CONDUCTOR.fight[Math.min(r.phase, CONDUCTOR.fight.length - 1)];
    ev.push({ t: 'land', x: r.x, y: r.y });
    if (Math.hypot(p.x - r.x, p.y - r.y) < CONDUCTOR.landRadius + p.r) hurtPlayer(w, Math.atan2(p.y - r.y, p.x - r.x), ev, r.id, 'landing');
    for (const o of w.reds) {
      if (o !== r && !o.dead && !o.hidden && Math.hypot(o.x - r.x, o.y - r.y) < CONDUCTOR.landRadius + o.r) shatter(w, o, 'charge', ev, { aim: Math.atan2(o.y - r.y, o.x - r.x) });
    }
    return;
  }
  if (r.state === 'climb') {
    if (r.t > 0) return;
    // back through the door it went for, walking in
    r.hidden = false;
    r.x = r.px = r.tx;
    r.y = r.py = r.ty;
    const cx = Math.floor(r.x / TILE), cy = Math.floor(r.y / TILE);
    const into = [[0, 1], [0, -1], [1, 0], [-1, 0]].find(([dx, dy]) => tileAt(w, cx + dx, cy + dy) === TILE_FLOOR) ?? [0, 1];
    r.state = 'enter';
    r.t = 0.7;
    r.cvx = into[0];
    r.cvy = into[1];
    r.aim = Math.atan2(into[1], into[0]);
    r.chargeCd = 1.2;
    ev.push({ t: 'spawn', x: r.x, y: r.y, door: 0 });
  }
}

/** Where the Conductor comes down: the floor cell you stand on, unless that's a track. */
function landingSpot(w: World, x: number, y: number) {
  const cx = Math.floor(x / TILE), cy = Math.floor(y / TILE);
  let best = { x, y }, bd = Infinity;
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    const nx = cx + dx, ny = cy + dy;
    if (tileAt(w, nx, ny) !== TILE_FLOOR || w.look[ny * w.cols + nx] === '_') continue;
    const d = Math.abs(dx) + Math.abs(dy);
    if (d < bd) {
      bd = d;
      best = d === 0 ? { x, y } : { x: nx * TILE + TILE / 2, y: ny * TILE + TILE / 2 };
    }
  }
  return best;
}

/** An eye of the Frame is shut (shrugs off bullets) unless you're moving: time has to run for it to look. */
export function eyeShut(w: World, r: Red) {
  const p = w.player;
  if (Math.hypot(p.vx, p.vy) < FRAME.openSpeed) r.guard = Math.max(r.guard, DT * 1.5);
}

/** A ring of slow bullets all round an eye. */
export function ringBurst(w: World, r: Red, ev: SimEvent[]) {
  const n = FRAME.ringBullets;
  const off = (w.tick % 7) * 0.1;
  for (let i = 0; i < n; i++) {
    const a = off + (i / n) * Math.PI * 2;
    const x = r.x + Math.cos(a) * (r.r + 2), y = r.y + Math.sin(a) * (r.r + 2);
    w.bullets.push({
      id: w.nextId++, x, y, px: x, py: y, vx: Math.cos(a) * FRAME.ringSpeed, vy: Math.sin(a) * FRAME.ringSpeed,
      from: 'red', owner: r.id, life: 500, damage: 3, hit: false, pierce: false, bounced: false,
    });
  }
  ev.push({ t: 'shot', x: r.x, y: r.y, aim: 0, item: 'rifle', from: 'red' });
}
