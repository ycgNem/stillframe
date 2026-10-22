// The rooms' own dangers, all moving in game time so standing still freezes them too: trains (chapter 2),
// crane hooks (chapter 3), the beat that drops on the dance floor (chapter 4), gravity wells and echoing
// shots (chapter 5). Where each thing is follows from the tick alone, so replays and Rewind need no
// extra state.
import { ITEMS } from '../data/items';
import { REDS } from '../data/reds';
import { HOOK, TICK_RATE, TILE, TRAINS, WELLS } from '../data/tuning';
import type { TrackDef } from '../data/levels/types';
import { moveBody } from './grid';
import { hurtPlayer, hurtRed, shatter } from './kills';
import { rand } from './rng';
import { fireGun } from './shots';
import type { SimEvent, World } from './types';

const DT = 1 / TICK_RATE;

export function stepHazards(w: World, ev: SimEvent[]) {
  if (w.trackDefs.length) trains(w, ev);
  if (w.hookDefs.length) hooks(w, ev);
  if (w.beatDef) beat(w, ev);
  if (w.wells.length) drag(w);
  if (w.echoes.length) echoes(w, ev);
}

// ------------------------------------------------------------------------------------------ trains

export function trainLength(t: TrackDef) {
  return t.cars * TRAINS.car + (t.cars - 1) * TRAINS.gap;
}

/** Where a track's train is `time` game seconds into the level: its front, speed, and whether the rails
 *  are warning or it is passing. */
export function trainAt(w: World, t: TrackDef, time: number) {
  const W = w.cols * TILE, len = trainLength(t);
  const cycle = (((time + t.offset) % t.period) + t.period) % t.period;
  const start = t.dir > 0 ? -8 : W + 8;
  const travel = W + 16 + len;
  if (cycle < TRAINS.warn) return { state: 'warn' as const, front: start, vx: 0, cycle };
  const u = cycle - TRAINS.warn;
  let d = u * t.speed, vx = t.dir * t.speed;
  if (t.stop) {
    const stopFront = t.dir > 0 ? (t.stop.at + 1) * TILE : t.stop.at * TILE;
    const dStop = Math.abs(stopFront - start);
    const reach = dStop / t.speed;
    if (u >= reach && u < reach + t.stop.for) {
      d = dStop;
      vx = 0;
    } else if (u >= reach + t.stop.for) d = dStop + (u - reach - t.stop.for) * t.speed;
  }
  if (d > travel) return { state: 'gone' as const, front: start, vx: 0, cycle };
  return { state: 'run' as const, front: start + t.dir * d, vx, cycle };
}

function trains(w: World, ev: SimEvent[]) {
  const time = w.tick / TICK_RATE, prev = (w.tick - 1) / TICK_RATE;
  const hot: number[] = [];
  w.trains = [];
  w.trackDefs.forEach((t, k) => {
    const now = trainAt(w, t, time), before = trainAt(w, t, prev);
    const len = trainLength(t);
    const y = t.row * TILE + 2, h = TILE * 2 - 4;
    if (now.state === 'warn' || now.state === 'run') hot.push(t.row, t.row + 1);
    if (now.state === 'warn' && (before.state !== 'warn' || w.tick === 1)) ev.push({ t: 'warn', what: 'train', x: t.dir > 0 ? 8 : w.cols * TILE - 8, y: y + h / 2 });
    if (now.state !== 'run') return;
    if (before.state !== 'run') ev.push({ t: 'train', x: t.dir > 0 ? 0 : w.cols * TILE, y: y + h / 2 });
    const x = t.dir > 0 ? now.front - len : now.front;
    w.trains.push({ x, y, w: len, h, vx: now.vx, track: k });
  });
  if (hot.join() !== w.hotRows.join()) {
    w.hotRows = hot;
    w.hazardVersion++;
  }
  // anything standing in a train's way
  const p = w.player;
  for (const t of w.trains) {
    const inside = (x: number, y: number, r: number) => x + r > t.x && x - r < t.x + t.w && y + r * 0.5 > t.y && y - r * 0.5 < t.y + t.h;
    const aim = t.vx >= 0 ? 0 : Math.PI;
    if (inside(p.x, p.y, p.r * 0.8)) hurtPlayer(w, aim, ev, 0, 'train');
    for (const r of w.reds) {
      if (r.dead || r.hidden || REDS[r.kind].boss || !inside(r.x, r.y, r.r * 0.8)) continue;
      shatter(w, r, 'train', ev, { aim });
    }
  }
}

// ------------------------------------------------------------------------------------------- hooks

/** Where each crane hook is at a game time. */
export function hookAt(w: World, i: number, time: number) {
  const h = w.hookDefs[i];
  const a = h.swing * Math.sin(Math.PI * 2 * (time / h.period + h.phase));
  const px = h.x * TILE + TILE / 2, py = h.y * TILE + TILE / 2;
  return { x: px + Math.sin(a) * h.len * TILE, y: py + Math.cos(a) * h.len * TILE };
}

function hooks(w: World, ev: SimEvent[]) {
  const time = w.tick / TICK_RATE;
  w.hooks = w.hookDefs.map((_, i) => hookAt(w, i, time));
  const p = w.player;
  for (const h of w.hooks) {
    if (Math.hypot(p.x - h.x, p.y - h.y) < HOOK.radius + p.r) hurtPlayer(w, Math.atan2(p.y - h.y, p.x - h.x), ev, 0, 'hook');
    for (const r of w.reds) {
      if (r.dead || r.hidden || Math.hypot(r.x - h.x, r.y - h.y) >= HOOK.radius + r.r) continue;
      const aim = Math.atan2(r.y - h.y, r.x - h.x);
      if (r.kind === 'foreman') {
        // it rocks the Foreman: a dent and a daze, once per swing
        if (r.stun > 0 || r.steady > 0) continue;
        r.stun = HOOK.foremanStun;
        r.steady = HOOK.foremanStun + 0.6;
        r.state = 'move';
        hurtRed(w, r, HOOK.foremanDamage, 'hook', ev, { aim });
        continue;
      }
      if (REDS[r.kind].boss) continue;
      shatter(w, r, 'hook', ev, { aim });
    }
  }
}

// -------------------------------------------------------------------------------------------- beat

/** How fast the beat runs: the DJ speeds it up with each phase. */
function tempo(w: World) {
  const dj = w.reds.find((r) => r.kind === 'dj' && !r.dead);
  return dj ? [1, 0.85, 0.7][Math.min(dj.phase, 2)] : 1;
}

function beat(w: World, ev: SimEvent[]) {
  const def = w.beatDef!, b = w.beat, k = tempo(w);
  const bar = def.bar * k, warn = def.warn * k;
  const before = b.dropIn;
  b.dropIn -= DT;
  // four beats to the bar, for the sound and the lights
  const beatLen = bar / 4;
  if (Math.floor((bar - before) / beatLen) !== Math.floor((bar - b.dropIn) / beatLen)) ev.push({ t: 'beat', n: Math.floor((bar - b.dropIn) / beatLen) % 4 });
  if (b.dropIn <= warn && !b.lit.length) {
    b.lit = pattern(w, b.bars);
    if (b.lit.length) ev.push({ t: 'warn', what: 'beat', x: w.player.x, y: w.player.y });
  }
  if (b.dropIn > 0) return;
  // the drop: every lit tile, everyone on one
  const lit = new Set(b.lit);
  const cell = (x: number, y: number) => Math.floor(y / TILE) * w.cols + Math.floor(x / TILE);
  const p = w.player;
  if (lit.has(cell(p.x, p.y))) hurtPlayer(w, -Math.PI / 2, ev, 0, 'beat');
  for (const r of w.reds) {
    if (r.dead || r.hidden || REDS[r.kind].boss || !lit.has(cell(r.x, r.y))) continue;
    shatter(w, r, 'beat', ev, { aim: -Math.PI / 2 });
  }
  if (b.lit.length) ev.push({ t: 'drop', x: p.x, y: p.y });
  b.lit = [];
  b.dropIn += bar;
  b.bars++;
}

/** Which dance-floor cells light up for a drop: stripes, columns, a checker, half the floor, or a ring
 *  round wherever you stand. Always leaves plenty of floor dark. */
function pattern(w: World, n: number): number[] {
  const floor: number[] = [];
  for (let i = 0; i < w.look.length; i++) if (w.look[i] === ':') floor.push(i);
  if (!floor.length) return [];
  const flip = rand(w) < 0.5 ? 0 : 1;
  const pcx = Math.floor(w.player.x / TILE), pcy = Math.floor(w.player.y / TILE);
  const xs = floor.map((i) => i % w.cols);
  const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
  const kind = n % 5;
  return floor.filter((i) => {
    const cx = i % w.cols, cy = Math.floor(i / w.cols);
    if (kind === 0) return (cy + flip) % 2 === 0;
    if (kind === 1) return (Math.floor(cx / 2) + flip) % 2 === 0;
    if (kind === 2) return (cx + cy + flip) % 2 === 0;
    if (kind === 3) return flip ? cx < mid : cx > mid;
    return Math.max(Math.abs(cx - pcx), Math.abs(cy - pcy)) <= 1;
  });
}

// ------------------------------------------------------------------------------------------- wells

/** Wells drag at whoever stands near: you can walk out, slowly. */
function drag(w: World) {
  const bodies = [w.player, ...w.reds.filter((r) => !r.dead && !r.hidden && !REDS[r.kind].rooted)];
  for (const g of w.wells) {
    const gx = g.x * TILE + TILE / 2, gy = g.y * TILE + TILE / 2;
    for (const b of bodies) {
      const dx = gx - b.x, dy = gy - b.y, d = Math.hypot(dx, dy);
      if (d >= g.r || d < 2) continue;
      const v = g.pull * WELLS.bodyShare * (1 - d / g.r) * DT;
      moveBody(w, b, (dx / d) * v, (dy / d) * v, b === w.player ? 'player' : 'red');
    }
  }
}

// ----------------------------------------------------------------------------------------- echoes

function echoes(w: World, ev: SimEvent[]) {
  for (const e of w.echoes) e.t -= DT;
  const due = w.echoes.filter((e) => e.t <= 0);
  w.echoes = w.echoes.filter((e) => e.t > 0);
  for (const e of due) fireGun(w, ITEMS[e.item], e.item, e.x, e.y, e.aim, e.from, e.owner, ev, false);
}
