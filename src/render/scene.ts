// Draws one frame of a level: floor, debris, items, then everything that stands sorted by depth (with
// the raised parts of walls and props in between), then everything in the air, interpolated between
// sim ticks so slow time still glides. Layer order follows docs/PLAN.md "Rendering".
import { ITEMS } from '../data/items';
import { PAL } from '../data/palette';
import { REDS } from '../data/reds';
import { rayLength } from '../sim/grid';
import type { World } from '../sim/types';
import type { Atlas } from './atlas';
import { drawActor, drawItem, drawShadow, drawThrown, handAt, playerPose, redPose, type ActorKind, type Pose } from './actors';
import { drawText } from './font';
import type { Fx } from './fx';
import { doorHole, OY, type LevelArt } from './level';
import { line, lerp, rect, ring, type Ctx } from './prims';
import { AIR, type Camera } from './view';

export interface SceneOpts {
  /** live aim, so you turn at once even while time is frozen */
  aim: number;
  /** an item the cursor is over that you could pick up */
  hoverItem: number;
  /** real seconds, for blinking things */
  now: number;
  showPlayer: boolean;
  /** how far your faint aim line reaches (to the cursor); 0 hides it */
  aimReach: number;
}

export function drawScene(ctx: Ctx, w: World, art: LevelArt, atlas: Atlas, fx: Fx, cam: Camera, alpha: number, o: SceneOpts) {
  rect(ctx, 0, 0, 320, 180, PAL.ink);
  art.sync(w);
  ctx.drawImage(art.floor, -cam.x, -cam.y - OY);

  // doors standing open while reds come through
  for (const d of w.doors) {
    if (d.open <= 0) continue;
    const h = doorHole(w, d);
    rect(ctx, h.x - cam.x, h.y - cam.y, h.w, h.h, PAL.coal);
    rect(ctx, h.x - cam.x, h.y - cam.y, h.w, 2, PAL.ink);
  }
  if (w.exit && w.goal.kind === 'escape' && Math.floor(o.now * 2) % 2) {
    drawText(ctx, 'EXIT', w.exit.x - cam.x - 7, w.exit.y - cam.y - 16, PAL.ink);
  }

  fx.drawFloor(ctx, cam);
  for (const it of w.items) drawItem(ctx, atlas, it, Math.round(it.x - cam.x), Math.round(it.y - cam.y), it.id === o.hoverItem);

  // standing things, by depth
  type Sortable = { base: number; draw: () => void };
  const list: Sortable[] = [];
  const p = w.player;
  const ppx = lerp(p.px, p.x, alpha) - cam.x, ppy = lerp(p.py, p.y, alpha) - cam.y;
  if (o.showPlayer && w.status !== 'dead') {
    drawShadow(ctx, 'player', ppx, ppy);
    const pose = playerPose(p, ppx, ppy, o.aim);
    list.push({ base: p.y, draw: () => drawActor(ctx, atlas, 'player', pose, p.hands[0] ?? null) });
    if (p.shield > 0) list.push({ base: p.y - 0.1, draw: () => shieldMark(ctx, ppx, ppy, p.shield) });
  }
  for (const r of w.reds) {
    const x = lerp(r.px, r.x, alpha) - cam.x, y = lerp(r.py, r.y, alpha) - cam.y;
    drawShadow(ctx, r.kind, x, y);
    const pose = redPose(r, x, y);
    list.push({ base: r.y, draw: () => drawRed(ctx, atlas, r.kind, pose, r, o.now) });
  }
  for (const oc of art.occluders) {
    const src = oc.layer === 'floor' ? art.floor : art.props;
    list.push({ base: oc.base, draw: () => ctx.drawImage(src, oc.sx, oc.sy, oc.w, oc.h, oc.sx - cam.x, oc.sy - OY - cam.y, oc.w, oc.h) });
  }
  list.sort((a, b) => a.base - b.base);
  for (const s of list) s.draw();

  // your line of fire: faint, and it stops where a wall or a desk would stop the bullet
  const held = p.hands[0];
  if (o.showPlayer && w.status === 'play' && held && ITEMS[held.kind].gun && held.ammo > 0) {
    const hx = lerp(p.px, p.x, alpha), hy = lerp(p.py, p.y, alpha);
    const ray = rayLength(w, hx, hy, o.aim, ITEMS[held.kind].range);
    const len = Math.min(o.aimReach, ray);
    const h = handAt('player', hx, hy, o.aim);
    const ex = hx + Math.cos(o.aim) * len - cam.x, ey = hy + Math.sin(o.aim) * len - AIR - cam.y;
    line(ctx, h.x - cam.x, h.y - cam.y, ex, ey, PAL.ash, 1, 0);
    // something (a wall, a desk) would stop the shot before the cursor: mark where
    if (ray < o.aimReach - 3) {
      for (const [dx, dy] of [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]]) rect(ctx, ex + dx, ey + dy, 1, 1, PAL.iron);
    }
  }

  // tells: aim lines, charge lanes, windups
  for (const r of w.reds) drawTell(ctx, w, r, alpha, cam, o.now);

  // in the air
  for (const t of w.thrown) {
    const x = lerp(t.px, t.x, alpha) - cam.x, y = lerp(t.py, t.y, alpha) - cam.y;
    rect(ctx, x - 1, y, 3, 1, PAL.ash);
    drawThrown(ctx, atlas, t.kind, x, y, (w.tick + alpha) * 0.6 + t.id);
  }
  for (const b of w.bullets) {
    const x = lerp(b.px, b.x, alpha) - cam.x, y = lerp(b.py, b.y, alpha) - cam.y;
    const sp = Math.hypot(b.vx, b.vy) || 1;
    const tx = x - (b.vx / sp) * 7, ty = y - (b.vy / sp) * 7;
    rect(ctx, x, y, 1, 1, PAL.ash);
    line(ctx, tx, ty - AIR, x, y - AIR, b.from === 'player' ? PAL.iron : PAL.red);
    rect(ctx, x - 1, y - AIR - 1, 2, 2, b.from === 'player' ? PAL.ink : PAL.hot);
  }
  fx.drawAir(ctx, cam, alpha, o.now);
  fx.drawPopups(ctx, cam);
}

function drawRed(ctx: Ctx, atlas: Atlas, kind: ActorKind, pose: Pose, r: World['reds'][number], now: number) {
  drawActor(ctx, atlas, kind, pose, r.held);
  const top = pose.y - (kind === 'manager' ? 36 : kind === 'brute' ? 32 : 26);
  if (r.stun > 0) {
    // dazed: three sparks circling the head
    for (let i = 0; i < 3; i++) {
      const a = now * 6 + (i * Math.PI * 2) / 3;
      rect(ctx, pose.x + Math.cos(a) * 6 - 1, top + 2 + Math.sin(a) * 2, 2, 2, PAL.hot);
    }
  }
  if (r.guard > 0 && Math.floor(now * 6) % 4) {
    // shrugging off damage: a solid ring, dark outside and light inside so it reads on any floor
    ring(ctx, pose.x, pose.y - 14, 15, PAL.ink);
    ring(ctx, pose.x, pose.y - 14, 14, PAL.paper);
  }
  const telling = r.state === 'windup' || r.state === 'aim' || r.state === 'throwTell' || r.state === 'chargeTell' || r.state === 'deskTell';
  if (telling) {
    // "!" over the head: something is coming
    rect(ctx, pose.x, top - 6, 1, 4, PAL.hot);
    rect(ctx, pose.x, top - 1, 1, 1, PAL.hot);
  }
  if (r.kind === 'manager') {
    const w = 24, x = pose.x - w / 2;
    rect(ctx, x - 1, top - 10, w + 2, 4, PAL.wine);
    rect(ctx, x, top - 9, Math.max(0, Math.round((w * r.hp) / REDS.manager.hp)), 2, PAL.red);
  }
}

function drawTell(ctx: Ctx, w: World, r: World['reds'][number], alpha: number, cam: Camera, now: number) {
  const x = lerp(r.px, r.x, alpha), y = lerp(r.py, r.y, alpha);
  if (r.state === 'aim' && r.held) {
    // the red aim line: dotted while it tracks you, solid once it locks
    const h = handAt(r.kind, x, y, r.aim);
    const len = rayLength(w, x, y, r.aim, ITEMS[r.held.kind].range);
    const ex = x + Math.cos(r.aim) * len, ey = y + Math.sin(r.aim) * len - AIR;
    const locked = r.t <= REDS[r.kind].aimLock;
    line(ctx, h.x - cam.x, h.y - cam.y, ex - cam.x, ey - cam.y, PAL.red, locked ? 0 : 2, Math.floor(now * 20));
  }
  if (r.state === 'chargeTell' || r.state === 'deskTell' || r.state === 'throwTell') {
    const len = Math.min(r.state === 'chargeTell' ? 170 : 120, rayLength(w, x, y, r.aim, 200));
    const ex = x + Math.cos(r.aim) * len, ey = y + Math.sin(r.aim) * len;
    const side = r.state === 'chargeTell' ? r.r : r.state === 'deskTell' ? 6 : 0;
    const nx = -Math.sin(r.aim) * side, ny = Math.cos(r.aim) * side;
    line(ctx, x + nx - cam.x, y + ny - cam.y, ex + nx - cam.x, ey + ny - cam.y, PAL.red, 3, Math.floor(now * 16));
    if (side) line(ctx, x - nx - cam.x, y - ny - cam.y, ex - nx - cam.x, ey - ny - cam.y, PAL.red, 3, Math.floor(now * 16));
  }
  if (r.state === 'windup') {
    // the arc the punch will sweep
    const reach = r.r + REDS[r.kind].punchReach;
    for (let i = -3; i <= 3; i++) {
      const a = r.aim + i * 0.28;
      rect(ctx, x + Math.cos(a) * reach - cam.x, y + Math.sin(a) * reach * 0.7 - 4 - cam.y, 1, 1, PAL.red);
    }
  }
}

function shieldMark(ctx: Ctx, x: number, y: number, n: number) {
  for (let i = 0; i < n; i++) {
    rect(ctx, x - 7 + i * 13, y - 1, 1, 3, PAL.cyan);
  }
}

