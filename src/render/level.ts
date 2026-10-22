// The level's static art, drawn once into offscreen canvases and redrawn when a tile changes (a pane
// breaks). ¾ view (docs/STYLE.md §1): walls and props show a south face and rise above their cell, so
// their raised parts are "occluders" drawn after anything standing behind them.
import { PAL } from '../data/palette';
import type { LevelDef } from '../data/levels/types';
import { TILE } from '../data/tuning';
import { TILE_DOOR, TILE_GLASS, TILE_PROP, TILE_VOID, TILE_WALL } from '../sim/grid';
import type { World } from '../sim/types';
import { drawText } from './font';
import { dither, dither4, ellipse, frame, rect, type Ctx } from './prims';

/** Room above row 0 for tall props and wall tops. */
export const OY = 24;

export interface Occluder {
  /** source rectangle in the cache canvas (canvas coords) */
  sx: number;
  sy: number;
  w: number;
  h: number;
  /** world y it sorts by */
  base: number;
  layer: 'floor' | 'props';
}

/** How tall each prop stands, in px. */
const PROP_H: Record<string, number> = { T: 8, C: 11, S: 22, F: 14, V: 22, O: 10, W: 16, K: 9, H: 7, R: 8 };

export class LevelArt {
  floor: HTMLCanvasElement;
  props: HTMLCanvasElement;
  occluders: Occluder[] = [];
  private version = -1;

  constructor(private def: LevelDef) {
    this.floor = document.createElement('canvas');
    this.props = document.createElement('canvas');
  }

  /** Redraws the caches if the world's tiles changed. */
  sync(w: World) {
    if (this.version === w.tilesVersion && this.floor.width) return;
    this.version = w.tilesVersion;
    const W = w.cols * TILE, H = w.rows * TILE + OY;
    for (const c of [this.floor, this.props]) {
      c.width = W;
      c.height = H;
    }
    const f = this.floor.getContext('2d')!, p = this.props.getContext('2d')!;
    this.occluders = [];
    drawFloor(f, w);
    for (const s of this.def.signs ?? []) drawText(f, s.text, s.x * TILE + 2, s.y * TILE + OY + 6, PAL.ash);
    drawWalls(f, w, this.occluders);
    drawProps(p, f, w, this.occluders);
  }
}

const at = (w: World, x: number, y: number) => (x < 0 || y < 0 || x >= w.cols || y >= w.rows ? TILE_VOID : w.tiles[y * w.cols + x]);
const look = (w: World, x: number, y: number) => (x < 0 || y < 0 || x >= w.cols || y >= w.rows ? ' ' : w.look[y * w.cols + x]);
const wallish = (t: number) => t === TILE_WALL || t === TILE_DOOR;

function drawFloor(ctx: Ctx, w: World) {
  rect(ctx, 0, 0, w.cols * TILE, w.rows * TILE + OY, PAL.ink);
  for (let y = 0; y < w.rows; y++) {
    for (let x = 0; x < w.cols; x++) {
      const t = at(w, x, y), l = look(w, x, y);
      if (t === TILE_VOID) continue;
      const px = x * TILE, py = y * TILE + OY;
      if (l === ',') {
        rect(ctx, px, py, TILE, TILE, PAL.fog);
        dither4(ctx, px + 1, py + 1, TILE - 1, TILE - 1, PAL.ash);
      } else {
        rect(ctx, px, py, TILE, TILE, PAL.paper);
        rect(ctx, px + TILE - 1, py, 1, TILE, PAL.fog);
        rect(ctx, px, py + TILE - 1, TILE, 1, PAL.fog);
      }
      if (l === 'x') {
        // a broken pane: glass grit on the floor
        for (const [dx, dy, c] of [[3, 5, PAL.stone], [7, 9, PAL.ash], [11, 4, PAL.stone], [5, 12, PAL.ash], [12, 11, PAL.stone], [9, 7, PAL.fog], [2, 9, PAL.ash]] as const) rect(ctx, px + dx, py + dy, 1, 1, c);
      }
      if (l === 'X') {
        // the exit: an ink hatch you can use (ink = usable), with an arrow
        rect(ctx, px + 2, py + 2, 12, 12, PAL.ink);
        rect(ctx, px + 3, py + 3, 10, 1, PAL.iron);
        for (let i = 0; i < 4; i++) rect(ctx, px + 8 - i, py + 5 + i, 1 + i * 2, 1, PAL.paper);
        rect(ctx, px + 7, py + 9, 3, 3, PAL.paper);
      }
    }
  }
  // contact shadows along the bottom of walls and under props (light from the top-left)
  for (let y = 0; y < w.rows; y++) {
    for (let x = 0; x < w.cols; x++) {
      const t = at(w, x, y);
      if (t === TILE_VOID || wallish(t) || t === TILE_GLASS || t === TILE_PROP) continue;
      const px = x * TILE, py = y * TILE + OY;
      if (wallish(at(w, x, y - 1))) {
        rect(ctx, px, py, TILE, 2, PAL.fog);
        rect(ctx, px, py, TILE, 1, PAL.ash);
      }
      if (wallish(at(w, x - 1, y))) rect(ctx, px, py, 1, TILE, PAL.fog);
      if (at(w, x - 1, y) === TILE_PROP) dither(ctx, px, py + 2, 2, TILE - 2, PAL.ash);
    }
  }
}

function drawWalls(ctx: Ctx, w: World, occ: Occluder[]) {
  for (let y = 0; y < w.rows; y++) {
    for (let x = 0; x < w.cols; x++) {
      const t = at(w, x, y), l = look(w, x, y);
      const px = x * TILE, py = y * TILE + OY;
      if (t === TILE_GLASS) {
        drawGlass(ctx, w, x, y, px, py);
        continue;
      }
      if (!wallish(t)) continue;
      const southOpen = !wallish(at(w, x, y + 1)) && at(w, x, y + 1) !== TILE_VOID;
      const northOpen = !wallish(at(w, x, y - 1));
      // top face, raised 8 px
      rect(ctx, px, py - 8, TILE, southOpen ? 16 : 24, PAL.fog);
      if (northOpen) rect(ctx, px, py - 8, TILE, 1, PAL.paper);
      if (!wallish(at(w, x - 1, y))) rect(ctx, px, py - 8, 1, southOpen ? 16 : 24, PAL.paper);
      if (!wallish(at(w, x + 1, y))) rect(ctx, px + TILE - 1, py - 8, 1, southOpen ? 16 : 24, PAL.ash);
      if (southOpen) {
        rect(ctx, px, py + 7, TILE, 1, PAL.ash);
        rect(ctx, px, py + 8, TILE, 4, PAL.ash);
        rect(ctx, px, py + 12, TILE, 3, PAL.stone);
        rect(ctx, px, py + 15, TILE, 1, PAL.slate);
        if (l === 'E') {
          // elevator doors on the face
          rect(ctx, px + 2, py + 8, 12, 7, PAL.stone);
          rect(ctx, px + 7, py + 8, 1, 7, PAL.iron);
          rect(ctx, px + 2, py + 8, 12, 1, PAL.slate);
          rect(ctx, px + 7, py + 3, 2, 2, PAL.paper);
        }
      }
      if (t === TILE_DOOR) drawDoor(ctx, w, x, y, px, py, southOpen);
      if (northOpen && at(w, x, y - 1) !== TILE_VOID) occ.push({ sx: px, sy: py - 8, w: TILE, h: 8, base: y * TILE, layer: 'floor' });
    }
  }
}

function drawDoor(ctx: Ctx, w: World, x: number, y: number, px: number, py: number, southOpen: boolean) {
  const side = !wallish(at(w, x - 1, y)) || !wallish(at(w, x + 1, y));
  if (southOpen && !side) {
    // a door in a top wall: frame and leaf on the face
    rect(ctx, px + 2, py - 2, 12, 17, PAL.slate);
    rect(ctx, px + 3, py - 1, 10, 16, PAL.stone);
    rect(ctx, px + 3, py - 1, 10, 1, PAL.iron);
    rect(ctx, px + 11, py + 7, 1, 2, PAL.iron);
  } else {
    // a door seen from above: the slot in the wall
    rect(ctx, px + 1, py - 6, 14, 18, PAL.stone);
    rect(ctx, px + 2, py - 5, 12, 16, PAL.ash);
    frame(ctx, px + 1, py - 6, 14, 18, PAL.slate);
  }
}

/** Where a door's opening is drawn when reds come through (dynamic, see drawDoorsOpen). */
export function doorHole(w: World, d: { x: number; y: number }) {
  const cx = Math.floor(d.x / TILE), cy = Math.floor(d.y / TILE);
  const px = cx * TILE, py = cy * TILE;
  const southOpen = !wallish(at(w, cx, cy + 1)) && at(w, cx, cy + 1) !== TILE_VOID;
  const side = !wallish(at(w, cx - 1, cy)) || !wallish(at(w, cx + 1, cy));
  return southOpen && !side ? { x: px + 3, y: py - 1, w: 10, h: 16 } : { x: px + 2, y: py - 5, w: 12, h: 16 };
}

function drawGlass(ctx: Ctx, w: World, x: number, y: number, px: number, py: number) {
  const g = (t: number) => t === TILE_GLASS || wallish(t);
  const horizontal = g(at(w, x - 1, y)) || g(at(w, x + 1, y));
  const vertical = g(at(w, x, y - 1)) || g(at(w, x, y + 1));
  if (horizontal || !vertical) {
    // a pane running east-west: its top edge, then its see-through face
    rect(ctx, px, py + 3, TILE, 1, PAL.stone);
    for (let j = 4; j < 15; j++) for (let i = (j & 1); i < TILE; i += 2) rect(ctx, px + i, py + j, 1, 1, j < 6 ? PAL.paper : PAL.fog);
    rect(ctx, px, py + 15, TILE, 1, PAL.stone);
    rect(ctx, px + 3, py + 6, 1, 1, PAL.paper);
    rect(ctx, px + 4, py + 5, 1, 1, PAL.paper);
  }
  if (vertical) {
    // a pane running north-south: a thin wall of glass
    rect(ctx, px + 6, py - 6, 4, TILE + 6, PAL.fog);
    rect(ctx, px + 6, py - 6, 1, TILE + 6, PAL.stone);
    rect(ctx, px + 9, py - 6, 1, TILE + 6, PAL.ash);
    rect(ctx, px + 7, py - 4, 1, 3, PAL.paper);
    if (!g(at(w, x, y - 1))) rect(ctx, px + 6, py - 6, 4, 1, PAL.paper);
  }
}

function drawProps(ctx: Ctx, floor: Ctx, w: World, occ: Occluder[]) {
  for (let y = 0; y < w.rows; y++) {
    for (let x = 0; x < w.cols; x++) {
      if (at(w, x, y) !== TILE_PROP) continue;
      const l = look(w, x, y);
      const h = PROP_H[l] ?? 8;
      const px = x * TILE, py = y * TILE + OY;
      const same = (dx: number, dy: number) => look(w, x + dx, y + dy) === l && at(w, x + dx, y + dy) === TILE_PROP;
      // drop shadow on the floor, down-right
      if (!same(1, 0)) dither(floor, px + 14, py + 4, 3, 11, PAL.ash);
      if (!same(0, 1)) rect(floor, px + 2, py + 14, same(1, 0) ? 14 : 13, 2, PAL.fog);
      drawProp(ctx, l, px, py, h, same);
      occ.push({ sx: px - 1, sy: py - h - 4, w: TILE + 2, h: h + 20, base: y * TILE + 14, layer: 'props' });
    }
  }
}

/** One prop cell. `same(dx, dy)` says whether a neighbour is the same prop (so big tables merge). */
function drawProp(ctx: Ctx, l: string, px: number, py: number, h: number, same: (dx: number, dy: number) => boolean) {
  const L = same(-1, 0), R = same(1, 0), N = same(0, -1), S = same(0, 1);
  const x0 = px + (L ? 0 : 1), x1 = px + (R ? 16 : 15);
  const top0 = py + (N ? 0 : 2) - h, top1 = py + (S ? 16 : 13) - h;
  const box = (topC: string, edgeC: string, frontA: string, frontB: string) => {
    rect(ctx, x0, top0, x1 - x0, top1 - top0, topC);
    if (!N) rect(ctx, x0, top0, x1 - x0, 1, edgeC);
    if (!L) rect(ctx, x0, top0, 1, top1 - top0, edgeC);
    if (!S) {
      rect(ctx, x0, top1, x1 - x0, h, frontA);
      rect(ctx, x0, top1 + h - 2, x1 - x0, 2, frontB);
      rect(ctx, x0, top1, x1 - x0, 1, PAL.ash);
    }
  };
  switch (l) {
    case 'T': {
      box(PAL.fog, PAL.paper, PAL.ash, PAL.stone);
      if (!S) {
        rect(ctx, x0 + 1, top1 + 2, x1 - x0 - 2, h - 2, PAL.ash);
        rect(ctx, x0 + 1, top1 + 1, x1 - x0 - 2, 1, PAL.stone);
      }
      if (!L) rect(ctx, px + 3, top0 + 2, 5, 4, PAL.paper);
      if (!R) {
        // a monitor
        rect(ctx, px + 8, top0 - 4, 6, 6, PAL.slate);
        rect(ctx, px + 9, top0 - 3, 4, 4, PAL.stone);
        rect(ctx, px + 10, top0 + 2, 2, 2, PAL.iron);
      }
      break;
    }
    case 'H':
      box(PAL.fog, PAL.paper, PAL.ash, PAL.stone);
      if (!N && !L) rect(ctx, px + 4, top0 + 3, 4, 3, PAL.paper);
      break;
    case 'K':
      box(PAL.fog, PAL.paper, PAL.ash, PAL.stone);
      if (!S) for (let i = x0 + 3; i < x1 - 1; i += 7) rect(ctx, i, top1 + 2, 1, h - 4, PAL.stone);
      if (!L) rect(ctx, px + 4, top0 + 2, 6, 3, PAL.ash);
      break;
    case 'C':
      box(PAL.ash, PAL.fog, PAL.stone, PAL.slate);
      rect(ctx, px + 3, top0 + 2, 10, 5, PAL.fog);
      rect(ctx, px + 3, top0 + 2, 10, 1, PAL.paper);
      if (!S) rect(ctx, px + 3, top1 + 3, 9, 2, PAL.slate);
      break;
    case 'S':
      box(PAL.stone, PAL.ash, PAL.iron, PAL.coal);
      if (!S) for (let j = top1 + 2; j < top1 + h - 3; j += 3) {
        rect(ctx, x0 + 2, j, x1 - x0 - 4, 1, PAL.slate);
        rect(ctx, x0 + 3 + ((j * 7) % 8), j, 1, 1, PAL.fog);
      }
      break;
    case 'F':
      box(PAL.fog, PAL.paper, PAL.ash, PAL.stone);
      if (!S) for (let j = top1 + 3; j < top1 + h - 2; j += 4) {
        rect(ctx, x0 + 1, j, x1 - x0 - 2, 1, PAL.stone);
        rect(ctx, px + 7, j + 1, 3, 1, PAL.slate);
      }
      break;
    case 'V':
      box(PAL.ash, PAL.fog, PAL.slate, PAL.iron);
      if (!S) {
        rect(ctx, x0 + 2, top1 + 2, 8, h - 6, PAL.fog);
        for (let j = top1 + 4; j < top1 + h - 5; j += 3) rect(ctx, x0 + 3, j, 6, 1, PAL.stone);
        rect(ctx, x0 + 11, top1 + 4, 2, 5, PAL.stone);
      }
      break;
    case 'W':
      rect(ctx, px + 4, py + 13 - h + 6, 8, h - 6, PAL.ash);
      rect(ctx, px + 4, py + 13 - h + 6, 1, h - 6, PAL.fog);
      rect(ctx, px + 4, py + 11, 8, 2, PAL.stone);
      rect(ctx, px + 5, py + 13 - h, 6, 7, PAL.fog);
      rect(ctx, px + 5, py + 13 - h, 6, 1, PAL.paper);
      rect(ctx, px + 6, py + 13 - h + 1, 1, 4, PAL.paper);
      frame(ctx, px + 5, py + 13 - h, 6, 7, PAL.stone);
      break;
    case 'O':
      rect(ctx, px + 5, py + 7, 6, 6, PAL.stone);
      rect(ctx, px + 5, py + 7, 6, 1, PAL.ash);
      rect(ctx, px + 10, py + 8, 1, 5, PAL.slate);
      ellipse(ctx, px + 8, py + 3, 6, 4, PAL.slate);
      ellipse(ctx, px + 7, py + 1, 4, 3, PAL.stone);
      rect(ctx, px + 5, py - 1, 2, 1, PAL.ash);
      rect(ctx, px + 9, py + 4, 2, 1, PAL.iron);
      break;
    case 'R': {
      const ry = py + 13 - h;
      rect(ctx, x0, ry, x1 - x0, 2, PAL.stone);
      rect(ctx, x0, ry, x1 - x0, 1, PAL.ash);
      for (let i = L ? px : px + 1; i < x1; i += 5) rect(ctx, i, ry + 2, 1, h - 1, PAL.slate);
      break;
    }
    default:
      box(PAL.fog, PAL.paper, PAL.ash, PAL.stone);
  }
}
