// The rooms' own dangers on screen (GAME_DESIGN §9): trains and their warning rails, crane hooks, the
// dance floor's lit tiles, gravity wells, echoes waiting to fire, and where the Conductor will land. All
// of it moves on game time, so it freezes when you do. Red marks what kills; nothing here touches state.
import { PAL } from '../data/palette';
import { CONDUCTOR, FRAME } from '../data/reds';
import { TICK_RATE, TILE, TRAINS } from '../data/tuning';
import { hookAt, trainAt, trainLength } from '../sim/hazards';
import type { Red, World } from '../sim/types';
import { dither, disc, ellipse, line, rect, ring, type Ctx } from './prims';
import { AIR, type Camera } from './view';

/** Game seconds at this frame, between the last tick and the next. */
const timeAt = (w: World, alpha: number) => (w.tick - 1 + alpha) / TICK_RATE;

/** Dots round a circle, so a ring reads as a warning rather than a thing. */
function dots(ctx: Ctx, x: number, y: number, r: number, n: number, color: string, squash = 0.6) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    rect(ctx, Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * squash), 1, 1, color);
  }
}

/** On the floor, under everything that stands: hot rails, lit tiles, wells, hook shadows, landing marks. */
export function drawHazardsFloor(ctx: Ctx, w: World, cam: Camera, alpha: number, now: number, calm: boolean) {
  const blink = calm || Math.floor(now * 8) % 2 === 0;
  // rails light red while a train is coming
  const time = timeAt(w, alpha);
  for (const t of w.trackDefs) {
    const s = trainAt(w, t, time);
    if (s.state !== 'warn') continue;
    const y = t.row * TILE - cam.y;
    const urgent = s.cycle > TRAINS.warn * 0.6;
    if (!blink && !urgent) continue;
    for (const ry of [y + 9, y + TILE + 6]) {
      rect(ctx, -cam.x, ry, w.cols * TILE, 1, PAL.red);
      rect(ctx, -cam.x, ry + 1, w.cols * TILE, 1, urgent && blink ? PAL.hot : PAL.blood);
    }
  }
  // the beat: these tiles drop next
  if (w.beat.lit.length) {
    for (const i of w.beat.lit) {
      const x = (i % w.cols) * TILE - cam.x, y = Math.floor(i / w.cols) * TILE - cam.y;
      if (x < -TILE || y < -TILE || x > 330 || y > 190) continue;
      rect(ctx, x + 1, y + 1, TILE - 2, TILE - 2, blink ? PAL.red : PAL.blood);
      dither(ctx, x + 2, y + 2, TILE - 4, TILE - 4, PAL.hot, blink ? 0 : 1);
    }
  }
  // gravity wells: rings falling inward
  for (const g of w.wells) {
    const gx = g.x * TILE + TILE / 2 - cam.x, gy = g.y * TILE + TILE / 2 - cam.y;
    for (let k = 0; k < 3; k++) {
      const f = 1 - ((time * 0.6 + k / 3) % 1);
      dots(ctx, gx, gy, g.r * f, Math.max(8, Math.round(g.r * f * 0.6)), f > 0.5 ? PAL.ash : PAL.stone);
    }
    disc(ctx, gx, gy, 5, PAL.iron);
    disc(ctx, gx, gy, 3, PAL.ink);
  }
  // hooks: their shadow, ringed red
  for (let i = 0; i < w.hookDefs.length; i++) {
    const h = hookAt(w, i, time);
    const x = h.x - cam.x, y = h.y - cam.y;
    ellipse(ctx, x, y + 2, 6, 2, PAL.ash);
    dots(ctx, x, y + 2, 10, 14, PAL.red, 0.5);
  }
  for (const r of w.reds) if (!r.dead && r.state === 'land') landingMark(ctx, r, cam, calm ? 0 : now);
}

/** The Conductor is coming down here: a red ring closing in, solid once it's nearly too late. */
function landingMark(ctx: Ctx, r: Red, cam: Camera, now: number) {
  const k = Math.max(0, r.t / CONDUCTOR.landTell);
  const x = r.tx - cam.x, y = r.ty - cam.y;
  const R = CONDUCTOR.landRadius;
  dither(ctx, x - R, y - R * 0.6, R * 2, R * 1.2, PAL.blood, Math.floor(now * 10) % 2);
  ellipse(ctx, x, y, R + k * 10, (R + k * 10) * 0.6, PAL.red);
  if (k < 0.35) ellipse(ctx, x, y, R, R * 0.6, PAL.hot);
}

/** Trains, as standing things (they hide what's behind them): one sort entry per train. */
export function trainSprites(ctx: Ctx, w: World, cam: Camera, alpha: number): { base: number; draw: () => void }[] {
  const time = timeAt(w, alpha);
  const out: { base: number; draw: () => void }[] = [];
  w.trackDefs.forEach((t) => {
    const s = trainAt(w, t, time);
    if (s.state !== 'run') return;
    const len = trainLength(t);
    const x = (t.dir > 0 ? s.front - len : s.front) - cam.x;
    const y = t.row * TILE + 2 - cam.y, h = TILE * 2 - 4;
    out.push({ base: t.row * TILE + 2 + h, draw: () => drawTrain(ctx, x, y, h, t.cars, t.dir) });
  });
  return out;
}

function drawTrain(ctx: Ctx, x: number, y: number, h: number, cars: number, dir: number) {
  const C = TRAINS.car, roof = 12;
  for (let c = 0; c < cars; c++) {
    const cx = Math.round(x + c * (C + TRAINS.gap));
    // the roof, raised
    rect(ctx, cx, y - roof, C, h - 2, PAL.fog);
    rect(ctx, cx, y - roof, C, 1, PAL.paper);
    rect(ctx, cx, y - roof, 1, h - 2, PAL.paper);
    rect(ctx, cx + C - 1, y - roof, 1, h - 2, PAL.ash);
    for (let v = cx + 6; v < cx + C - 8; v += 12) rect(ctx, v, y - roof + 5, 6, 4, PAL.ash);
    // the side: windows and a red stripe that says keep off
    const sy = y + h - roof - 2;
    rect(ctx, cx, sy, C, roof + 2, PAL.stone);
    rect(ctx, cx + 2, sy + 2, C - 4, 5, PAL.slate);
    for (let v = cx + 9; v < cx + C - 4; v += 9) rect(ctx, v, sy + 2, 1, 5, PAL.iron);
    rect(ctx, cx + 2, sy + 2, C - 4, 1, PAL.iron);
    rect(ctx, cx, sy + 9, C, 2, PAL.red);
    rect(ctx, cx, sy + roof + 1, C, 1, PAL.iron);
    if (c < cars - 1) rect(ctx, cx + C, sy + 5, TRAINS.gap, 2, PAL.iron);
  }
  // the front: a headlight
  const fx = dir > 0 ? Math.round(x + cars * C + (cars - 1) * TRAINS.gap) - 3 : Math.round(x) + 1;
  rect(ctx, fx, y + h - roof + 1, 2, 3, PAL.glint);
}

/** Up in the air: hooks on their cables, echoes waiting to fire, eyes gathering a ring. */
export function drawHazardsAir(ctx: Ctx, w: World, cam: Camera, alpha: number, now: number, calm: boolean) {
  const time = timeAt(w, alpha);
  for (let i = 0; i < w.hookDefs.length; i++) {
    const d = w.hookDefs[i];
    const h = hookAt(w, i, time);
    const px = d.x * TILE + TILE / 2 - cam.x, py = d.y * TILE + TILE / 2 - cam.y - 70;
    const x = Math.round(h.x - cam.x), y = Math.round(h.y - cam.y - 14);
    line(ctx, px, py, x, y - 5, PAL.iron);
    line(ctx, px + 1, py, x + 1, y - 5, PAL.slate);
    rect(ctx, x - 4, y - 6, 9, 5, PAL.iron);
    rect(ctx, x - 4, y - 6, 9, 1, PAL.slate);
    rect(ctx, x, y - 1, 1, 4, PAL.iron);
    rect(ctx, x - 2, y + 3, 3, 1, PAL.iron);
    rect(ctx, x - 2, y + 1, 1, 2, PAL.iron);
  }
  for (const e of w.echoes) {
    // a shot that will come again: a ring tightening on where it fires from
    const k = Math.max(0, Math.min(1, e.t / 0.6));
    ring(ctx, e.x - cam.x, e.y - AIR - cam.y, 2 + k * 6, e.from === 'player' ? PAL.stone : PAL.red);
  }
  for (const r of w.reds) {
    if (r.dead || r.state !== 'ringTell') continue;
    const k = 1 - Math.max(0, r.t / FRAME.ringTell);
    const x = r.x - cam.x, y = r.y - 12 - cam.y;
    dots(ctx, x, y, 10 + k * 10, 16, !calm && Math.floor(now * 12) % 2 ? PAL.hot : PAL.red, 1);
  }
}
