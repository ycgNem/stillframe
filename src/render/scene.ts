// Draws one frame of a level: floor, debris, items, then everything that stands sorted by depth (with
// the raised parts of walls and props in between), then everything in the air, interpolated between
// sim ticks so slow time still glides. Layer order follows docs/PLAN.md "Rendering".
import { ITEMS } from '../data/items';
import { PAL } from '../data/palette';
import { CONDUCTOR, REDS } from '../data/reds';
import { STROBE, TICK_RATE, TILE } from '../data/tuning';
import { rayLength } from '../sim/grid';
import type { World } from '../sim/types';
import type { Atlas } from './atlas';
import { actorSprite, drawActor, drawItem, drawShadow, drawThrown, handAt, playerPose, redPose, type ActorKind, type Pose } from './actors';
import { text } from '../ui/text';
import type { Fx } from './fx';
import { drawHazardsAir, drawHazardsFloor, trainSprites } from './hazards';
import { doorHole, OY, type LevelArt } from './level';
import { dither, line, lerp, rect, ring, type Ctx } from './prims';
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
  /** the UI layer, for words over the world (popups, the exit label); none in thumbnails */
  ui?: Ctx;
  /** reds get a thick ink outline (Settings) */
  outline?: boolean;
  /** fewer flashes (Settings): warnings hold steady instead of blinking, and no strobe */
  calm?: boolean;
  /** the level's lights strobe: dark between flashes, with only what glows showing */
  strobe?: boolean;
}

/** Strobe rooms are dark except for a flash at the start of every cycle, on game time. */
function strobeDark(w: World, alpha: number) {
  const t = (w.tick - 1 + alpha) / TICK_RATE;
  return t % STROBE.cycle >= STROBE.lit;
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

  fx.drawFloor(ctx, cam, o.now);
  drawHazardsFloor(ctx, w, cam, alpha, o.now, !!o.calm);
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
    if (r.dead) continue;
    const x = lerp(r.px, r.x, alpha) - cam.x, y = lerp(r.py, r.y, alpha) - cam.y;
    if (r.hidden) {
      // off the floor: riding a train's roof, or coming down onto its landing mark
      if (r.state === 'ride') {
        const pose = redPose(r, x, y - 13);
        list.push({ base: r.y + TILE, draw: () => drawRed(ctx, atlas, r.kind, pose, r, o.now, !!o.outline) });
      } else if (r.state === 'land') {
        const k = Math.max(0, r.t / CONDUCTOR.landTell);
        const pose = redPose(r, r.tx - cam.x, r.ty - cam.y - k * 90);
        list.push({ base: r.ty, draw: () => drawRed(ctx, atlas, r.kind, pose, r, o.now, !!o.outline) });
      }
      continue;
    }
    drawShadow(ctx, r.kind, x, y);
    const pose = redPose(r, x, y);
    list.push({ base: r.y, draw: () => drawRed(ctx, atlas, r.kind, pose, r, o.now, !!o.outline) });
  }
  list.push(...trainSprites(ctx, w, cam, alpha));
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
  drawBullets(ctx, w, cam, alpha);
  drawHazardsAir(ctx, w, cam, alpha, o.now, !!o.calm);
  if (o.strobe && !o.calm && strobeDark(w, alpha)) {
    // between flashes: the room goes dark; the floor's warnings, the reds, the bullets and you still show
    rect(ctx, 0, 0, 320, 180, PAL.ink);
    dither(ctx, 0, 0, 320, 180, PAL.coal);
    drawHazardsFloor(ctx, w, cam, alpha, o.now, false);
    // what you can pick up stays findable: a grey shape where it lies
    for (const it of w.items) {
      const name = `item_${it.kind}`;
      if (atlas.has(name)) atlas.drawTinted(ctx, name, 0, Math.round(it.x - cam.x), Math.round(it.y - cam.y), false, it.id === o.hoverItem ? PAL.cyan : PAL.stone);
    }
    for (const r of w.reds) {
      if (r.dead || r.hidden) continue;
      const pose = redPose(r, lerp(r.px, r.x, alpha) - cam.x, lerp(r.py, r.y, alpha) - cam.y);
      const sp = actorSprite(r.kind, pose.aim, pose.frame);
      if (atlas.has(sp.name)) {
        // an ink rim keeps a glowing red apart from a lit red tile
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) atlas.drawTinted(ctx, sp.name, pose.frame, pose.x + dx, pose.y + dy, sp.flip, PAL.ink);
        atlas.drawTinted(ctx, sp.name, pose.frame, pose.x, pose.y, sp.flip, PAL.hot);
      }
    }
    if (o.showPlayer && w.status !== 'dead') drawActor(ctx, atlas, 'player', playerPose(p, ppx, ppy, o.aim), p.hands[0] ?? null);
    drawBullets(ctx, w, cam, alpha);
  }
  fx.drawAir(ctx, cam, alpha, o.now);
  if (o.ui) {
    if (w.exit && w.goal.kind === 'escape' && Math.floor(o.now * 2) % 2) {
      text(o.ui, 'Exit', (w.exit.x - cam.x) * 2, (w.exit.y - cam.y - 22) * 2, PAL.ink, { align: 'center', outline: PAL.paper });
    }
    fx.drawPopups(o.ui, cam, 2);
  }
}

function drawBullets(ctx: Ctx, w: World, cam: Camera, alpha: number) {
  for (const b of w.bullets) {
    const x = lerp(b.px, b.x, alpha) - cam.x, y = lerp(b.py, b.y, alpha) - cam.y;
    const sp = Math.hypot(b.vx, b.vy) || 1;
    const tx = x - (b.vx / sp) * 7, ty = y - (b.vy / sp) * 7;
    rect(ctx, x, y, 1, 1, PAL.ash);
    line(ctx, tx, ty - AIR, x, y - AIR, b.from === 'player' ? PAL.iron : PAL.red);
    rect(ctx, x - 1, y - AIR - 1, 2, 2, b.from === 'player' ? PAL.ink : PAL.hot);
  }
}

function drawRed(ctx: Ctx, atlas: Atlas, kind: ActorKind, pose: Pose, r: World['reds'][number], now: number, outline: boolean) {
  if (outline) {
    const sp = actorSprite(kind, pose.aim, pose.frame);
    if (atlas.has(sp.name)) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-2, 0], [2, 0], [0, -2], [0, 2]]) atlas.drawTinted(ctx, sp.name, pose.frame, pose.x + dx, pose.y + dy, sp.flip, PAL.ink);
  }
  drawActor(ctx, atlas, kind, pose, r.held);
  const top = pose.y - REDS[r.kind].tall - 4;
  if (r.stun > 0) {
    // dazed: three sparks circling the head
    for (let i = 0; i < 3; i++) {
      const a = now * 6 + (i * Math.PI * 2) / 3;
      rect(ctx, pose.x + Math.cos(a) * 6 - 1, top + 2 + Math.sin(a) * 2, 2, 2, PAL.hot);
    }
  }
  // (an eye's guard is its shut lid, drawn in the sprite)
  if (r.guard > 0 && r.kind !== 'eye' && Math.floor(now * 6) % 4) {
    // shrugging off damage: a solid ring, dark outside and light inside so it reads on any floor
    ring(ctx, pose.x, pose.y - 14, 15, PAL.ink);
    ring(ctx, pose.x, pose.y - 14, 14, PAL.paper);
  }
  const telling = r.state === 'windup' || r.state === 'aim' || r.state === 'throwTell' || r.state === 'chargeTell' || r.state === 'deskTell' || r.state === 'ringTell' || r.state === 'board';
  if (telling) {
    // "!" over the head: something is coming
    rect(ctx, pose.x, top - 6, 1, 4, PAL.hot);
    rect(ctx, pose.x, top - 1, 1, 1, PAL.hot);
  }
  if (REDS[r.kind].boss) {
    const w = 24, x = pose.x - w / 2;
    rect(ctx, x - 1, top - 10, w + 2, 4, PAL.wine);
    rect(ctx, x, top - 9, Math.max(0, Math.round((w * r.hp) / REDS[r.kind].hp)), 2, PAL.red);
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

