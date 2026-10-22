// Characters, held weapons and floor items. Sprites come from the atlas (docs/STYLE.md §3–5): 5 drawn
// directions (S, SE, E, NE, N), the west side mirrored; frames: 0 stand, 1–4 walk, 5 windup, 6 strike.
// Until the atlas has a sprite, palette shapes stand in.
import type { ItemKind } from '../data/items';
import { PAL } from '../data/palette';
import type { RedKind } from '../data/reds';
import type { Held, Item, Player, Red } from '../sim/types';
import type { Atlas } from './atlas';
import { disc, ellipse, line, rect, type Ctx } from './prims';
import { AIR } from './view';

export type ActorKind = 'player' | RedKind;

const DIRS = ['e', 'se', 's', 'se', 'e', 'ne', 'n', 'ne'] as const;
const FLIP = [false, false, false, true, true, true, false, false];

/** Which drawn direction (and mirror) shows an actor facing `aim`. */
export function actorSprite(kind: ActorKind, aim: number, frame: number) {
  const sector = ((Math.round(aim / (Math.PI / 4)) % 8) + 8) % 8;
  return { name: `${kind}_${DIRS[sector]}`, flip: FLIP[sector], frame, sector };
}

/** 16 pre-drawn angles for held items, never rotated at runtime. */
export function angleIndex(aim: number) {
  return ((Math.round(aim / (Math.PI / 8)) % 16) + 16) % 16;
}

export interface Pose {
  x: number;
  y: number;
  aim: number;
  frame: number;
  /** blink (invulnerable) or flash (hurt) */
  hidden?: boolean;
  hurt?: boolean;
}

/** Which animation frame: walking from distance covered, attacks from their state. */
export function walkFrame(moving: boolean, walked: number): number {
  return moving ? 1 + (Math.floor(walked / 5) % 4) : 0;
}

export function playerPose(p: Player, x: number, y: number, aim: number): Pose {
  const moving = Math.hypot(p.x - p.px, p.y - p.py) > 0.01;
  let frame = walkFrame(moving, p.walked);
  if ((p.act === 'punch' || p.act === 'throw') && p.actT < 0.16) frame = p.actT < 0.07 ? 5 : 6;
  return { x, y, aim, frame, hidden: p.grace > 0 && Math.floor(performance.now() / 70) % 2 === 0 };
}

export function redPose(r: Red, x: number, y: number): Pose {
  if (r.kind === 'eye') return { x, y, aim: r.aim, frame: eyeFrame(r), hurt: r.hurt > 0 };
  const moving = Math.hypot(r.x - r.px, r.y - r.py) > 0.01;
  let frame = walkFrame(moving, r.walked);
  if (r.state === 'windup' || r.state === 'throwTell' || r.state === 'deskTell' || r.state === 'chargeTell') frame = 5;
  if (r.state === 'recover' && r.t > 0.25) frame = 6;
  return { x, y, aim: r.aim, frame, hurt: r.hurt > 0 };
}

/** An eye of the Frame: shut while it guards, wide on its tell, pinned as it fires, else looking about. */
function eyeFrame(r: Red): number {
  if (r.state === 'aim' || r.state === 'ringTell') return 5;
  if (r.state === 'recover' && r.t > 0.1) return 6;
  if (r.guard > 0) return 0;
  return 1 + (Math.floor(-r.timer * 3) & 3);
}

const RED = { body: PAL.red, light: PAL.hot, dark: PAL.blood, outline: PAL.wine };
const BODY: Record<ActorKind, { body: string; light: string; dark: string; outline: string; size: number }> = {
  player: { body: PAL.fog, light: PAL.paper, dark: PAL.ash, outline: PAL.ink, size: 1 },
  grunt: { ...RED, size: 1 },
  gunner: { ...RED, size: 1 },
  brute: { ...RED, size: 1.35 },
  runner: { ...RED, size: 0.95 },
  sniper: { ...RED, size: 1.05 },
  mirror: { ...RED, light: PAL.glint, size: 1 },
  splitter: { ...RED, size: 1.05 },
  shardling: { ...RED, size: 0.65 },
  manager: { ...RED, size: 1.5 },
  conductor: { ...RED, size: 1.5 },
  foreman: { ...RED, size: 1.6 },
  dj: { ...RED, size: 1.35 },
  eye: { ...RED, size: 1.2 },
};

export function drawShadow(ctx: Ctx, kind: ActorKind, x: number, y: number) {
  const s = BODY[kind].size;
  ellipse(ctx, x + 1, y + 1, Math.round(5 * s), 2, PAL.ash);
}

/** A character with its held item; the item goes behind the body when facing away. */
export function drawActor(ctx: Ctx, atlas: Atlas, kind: ActorKind, pose: Pose, held: Held | null) {
  if (pose.hidden) return;
  // an eye of the Frame fires from itself, not from a gun
  if (kind === 'eye') held = null;
  const sp = actorSprite(kind, pose.aim, pose.frame);
  const behind = Math.sin(pose.aim) < -0.2;
  if (held && behind) drawHeld(ctx, atlas, held.kind, pose, kind);
  if (atlas.has(sp.name)) {
    const jx = pose.hurt ? 1 : 0;
    atlas.draw(ctx, sp.name, pose.frame, pose.x + jx, pose.y, sp.flip);
  } else drawShape(ctx, kind, pose);
  if (held && !behind) drawHeld(ctx, atlas, held.kind, pose, kind);
}

/** Where the hands are: in front of the chest, toward the aim. */
export function handAt(kind: ActorKind, x: number, y: number, aim: number) {
  const s = BODY[kind].size;
  return { x: x + Math.cos(aim) * 6 * s, y: y - 9 * s + Math.sin(aim) * 3 };
}

function drawHeld(ctx: Ctx, atlas: Atlas, item: ItemKind, pose: Pose, kind: ActorKind) {
  const h = handAt(kind, pose.x, pose.y, pose.aim);
  const name = `held_${item}`;
  if (atlas.has(name)) {
    atlas.draw(ctx, name, angleIndex(pose.aim), h.x, h.y);
    return;
  }
  const len = item === 'shotgun' ? 8 : item === 'pistol' ? 5 : 3;
  line(ctx, h.x, h.y, h.x + Math.cos(pose.aim) * len, h.y + Math.sin(pose.aim) * len, PAL.ink);
  rect(ctx, h.x - 1, h.y - 1, 2, 2, PAL.ink);
}

function drawShape(ctx: Ctx, kind: ActorKind, pose: Pose) {
  const c = BODY[kind], s = c.size;
  const x = Math.round(pose.x), y = Math.round(pose.y);
  const step = pose.frame >= 1 && pose.frame <= 4 ? (pose.frame % 2 ? 1 : -1) : 0;
  // legs
  rect(ctx, x - 3 * s, y - 6 * s + step, 2 * s, 6 * s - step, c.dark);
  rect(ctx, x + 1 * s, y - 6 * s - step, 2 * s, 6 * s + step, c.dark);
  // body
  rect(ctx, x - 4 * s - 1, y - 15 * s - 1, 8 * s + 2, 10 * s + 2, c.outline);
  rect(ctx, x - 4 * s, y - 15 * s, 8 * s, 10 * s, c.body);
  rect(ctx, x - 4 * s, y - 15 * s, 3 * s, 9 * s, c.light);
  // head
  disc(ctx, x, y - 19 * s, Math.round(4 * s) + 1, c.outline);
  disc(ctx, x, y - 19 * s, Math.round(4 * s), c.body);
  rect(ctx, x - 2 * s, y - 21 * s, 2, 2, c.light);
  if (kind === 'player') {
    const fx = Math.cos(pose.aim) * 2, fy = Math.sin(pose.aim) > -0.3 ? 0 : -1;
    if (Math.sin(pose.aim) > -0.5) rect(ctx, x - 2 + fx, y - 20 + fy, 5, 2, PAL.cyan);
  }
  if (kind === 'gunner') rect(ctx, x - 4 * s, y - 23 * s, 8 * s, 2, PAL.blood);
  if (pose.frame >= 5) line(ctx, x, y - 10 * s, x + Math.cos(pose.aim) * 9 * s, y - 10 * s + Math.sin(pose.aim) * 5, c.outline);
}

/** An item lying on the floor, with its shadow; `hover` outlines it when you could pick it up. */
export function drawItem(ctx: Ctx, atlas: Atlas, it: Item | { kind: ItemKind; x: number; y: number }, x: number, y: number, hover: boolean) {
  const name = `item_${it.kind}`;
  if (hover) ellipse(ctx, x, y + 1, 7, 3, PAL.cyan);
  rect(ctx, x - 4, y + 2, 9, 1, PAL.fog);
  if (atlas.has(name)) {
    atlas.draw(ctx, name, 0, x, y);
    return;
  }
  const w = it.kind === 'shotgun' ? 11 : it.kind === 'keyboard' ? 9 : it.kind === 'pistol' ? 7 : 4;
  rect(ctx, x - w / 2, y - 2, w, 3, PAL.ink);
  rect(ctx, x - w / 2, y - 2, w, 1, PAL.slate);
}

/** Something in flight: spins through the 16 angles as it goes. */
export function drawThrown(ctx: Ctx, atlas: Atlas, kind: ItemKind, x: number, y: number, spin: number) {
  // what the bosses lob has its own tumbling frames
  const lobbed = `thrown_${kind}`;
  if (atlas.has(lobbed)) {
    atlas.draw(ctx, lobbed, Math.floor(spin) % atlas.frames(lobbed), x, y - AIR);
    return;
  }
  if (kind === 'desk') {
    rect(ctx, x - 7, y - AIR - 6, 14, 9, PAL.stone);
    rect(ctx, x - 7, y - AIR - 6, 14, 5, PAL.fog);
    rect(ctx, x - 7, y - AIR - 6, 14, 1, PAL.paper);
    return;
  }
  const name = `held_${kind}`;
  if (atlas.has(name)) atlas.draw(ctx, name, Math.floor(spin) % 16, x, y - AIR);
  else rect(ctx, x - 2, y - AIR - 1, 4, 3, PAL.ink);
}
