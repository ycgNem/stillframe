// The level's static art, drawn once into offscreen canvases and redrawn when a tile changes (a pane
// breaks). ¾ view (docs/STYLE.md §1): walls and props show a south face and rise above their cell, so
// their raised parts are "occluders" drawn after anything standing behind them. Each chapter has its own
// look (its Theme): office carpet and desks, subway tiles and tracks, roof gravel over the drop, the club's
// dance floor, and the Frame, a film strip. The world stays light and grey so red always reads as danger.
import { PAL } from '../data/palette';
import type { LevelDef, Theme } from '../data/levels/types';
import { TILE } from '../data/tuning';
import { TILE_DOOR, TILE_DROP, TILE_GLASS, TILE_PROP, TILE_VOID, TILE_WALL } from '../sim/grid';
import type { World } from '../sim/types';
import { text } from '../ui/text';
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
const PROP_H: Record<string, number> = { T: 8, C: 11, S: 22, F: 14, V: 22, O: 10, W: 16, K: 9, H: 7, R: 8, A: 9, L: 26, N: 6, I: 9, U: 11, Q: 20, J: 9 };

/** Each theme's wall colors: top, lit edge, face, face shadow, face foot. */
const WALLS: Record<Theme, { top: string; edge: string; face: string; shade: string; foot: string }> = {
  office: { top: PAL.fog, edge: PAL.paper, face: PAL.ash, shade: PAL.stone, foot: PAL.slate },
  subway: { top: PAL.fog, edge: PAL.paper, face: PAL.paper, shade: PAL.ash, foot: PAL.stone },
  roof: { top: PAL.ash, edge: PAL.fog, face: PAL.stone, shade: PAL.slate, foot: PAL.iron },
  club: { top: PAL.slate, edge: PAL.stone, face: PAL.iron, shade: PAL.coal, foot: PAL.ink },
  core: { top: PAL.coal, edge: PAL.iron, face: PAL.coal, shade: PAL.ink, foot: PAL.ink },
};

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
    const theme = this.def.theme ?? 'office';
    drawFloor(f, w, theme);
    // words painted on the floor, one font pixel per game pixel
    for (const s of this.def.signs ?? []) text(f, s.text, s.x * TILE + 2, s.y * TILE + OY + 4, PAL.fog, { shadow: PAL.ash });
    drawWalls(f, w, this.occluders, theme);
    drawProps(p, f, w, this.occluders);
  }
}

const at = (w: World, x: number, y: number) => (x < 0 || y < 0 || x >= w.cols || y >= w.rows ? TILE_VOID : w.tiles[y * w.cols + x]);
const look = (w: World, x: number, y: number) => (x < 0 || y < 0 || x >= w.cols || y >= w.rows ? ' ' : w.look[y * w.cols + x]);
const wallish = (t: number) => t === TILE_WALL || t === TILE_DOOR;

/** A cheap hash of a cell, for speckle that doesn't repeat. */
const hash = (x: number, y: number, k = 0) => (((x * 73856093) ^ (y * 19349663) ^ (k * 83492791)) >>> 0) % 997;

function drawFloor(ctx: Ctx, w: World, theme: Theme) {
  rect(ctx, 0, 0, w.cols * TILE, w.rows * TILE + OY, PAL.ink);
  for (let y = 0; y < w.rows; y++) {
    for (let x = 0; x < w.cols; x++) {
      const t = at(w, x, y), l = look(w, x, y);
      if (t === TILE_VOID) continue;
      const px = x * TILE, py = y * TILE + OY;
      if (l === '_') drawTrack(ctx, w, x, y, px, py);
      else if (t === TILE_DROP) drawDrop(ctx, w, x, y, px, py);
      else if (l === ':') {
        // the dance floor: dark glass squares in a steel grid
        rect(ctx, px, py, TILE, TILE, PAL.iron);
        rect(ctx, px + 1, py + 1, TILE - 2, TILE - 2, PAL.coal);
        rect(ctx, px + 1, py + 1, TILE - 2, 1, PAL.slate);
        if ((x + y) % 2) dither(ctx, px + 3, py + 3, TILE - 6, TILE - 6, PAL.iron);
      } else if (l === ',') {
        rect(ctx, px, py, TILE, TILE, PAL.fog);
        dither4(ctx, px + 1, py + 1, TILE - 1, TILE - 1, PAL.ash);
      } else floorTile(ctx, w, theme, x, y, px, py);
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
      if (t === TILE_VOID || wallish(t) || t === TILE_GLASS || t === TILE_PROP || t === TILE_DROP || look(w, x, y) === '_') continue;
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

function floorTile(ctx: Ctx, w: World, theme: Theme, x: number, y: number, px: number, py: number) {
  if (theme === 'subway') {
    // platform tiles, a quarter the size, and a dotted strip along the edge of the tracks
    rect(ctx, px, py, TILE, TILE, PAL.paper);
    rect(ctx, px + 7, py, 1, TILE, PAL.fog);
    rect(ctx, px + 15, py, 1, TILE, PAL.fog);
    rect(ctx, px, py + 7, TILE, 1, PAL.fog);
    rect(ctx, px, py + 15, TILE, 1, PAL.fog);
    const edge = look(w, x, y + 1) === '_' ? py + 11 : look(w, x, y - 1) === '_' ? py + 1 : -1;
    if (edge >= 0) for (let i = 1; i < TILE; i += 3) rect(ctx, px + i, edge, 1, 1, PAL.stone), rect(ctx, px + i + 1, edge + 2, 1, 1, PAL.stone);
    return;
  }
  if (theme === 'roof') {
    // gravel: pale, speckled, never the same twice
    rect(ctx, px, py, TILE, TILE, PAL.fog);
    for (let k = 0; k < 9; k++) {
      const h = hash(x, y, k);
      rect(ctx, px + (h % TILE), py + ((h >> 4) % TILE), 1, 1, k % 3 ? PAL.ash : PAL.stone);
    }
    return;
  }
  if (theme === 'club') {
    rect(ctx, px, py, TILE, TILE, PAL.stone);
    rect(ctx, px + TILE - 1, py, 1, TILE, PAL.slate);
    rect(ctx, px, py + TILE - 1, TILE, 1, PAL.slate);
    if (hash(x, y) % 5 === 0) rect(ctx, px + 4 + (hash(x, y, 1) % 8), py + 5, 2, 1, PAL.ash);
    return;
  }
  if (theme === 'core') {
    // the frame's white, with a crosshair at every corner like a contact sheet
    rect(ctx, px, py, TILE, TILE, PAL.paper);
    rect(ctx, px, py, 3, 1, PAL.ash);
    rect(ctx, px, py, 1, 3, PAL.ash);
    if ((x + y) % 4 === 0) rect(ctx, px + 8, py + 8, 1, 1, PAL.fog);
    return;
  }
  rect(ctx, px, py, TILE, TILE, PAL.paper);
  rect(ctx, px + TILE - 1, py, 1, TILE, PAL.fog);
  rect(ctx, px, py + TILE - 1, TILE, 1, PAL.fog);
}

/** Two rows of track: a sunken coal bed, sleepers, and a rail along each outer side. */
function drawTrack(ctx: Ctx, w: World, x: number, y: number, px: number, py: number) {
  rect(ctx, px, py, TILE, TILE, PAL.coal);
  for (let i = (x * TILE) % 6 ? 6 - ((x * TILE) % 6) : 0; i < TILE; i += 6) rect(ctx, px + i, py, 3, TILE, PAL.iron);
  const top = look(w, x, y - 1) !== '_', bottom = look(w, x, y + 1) !== '_';
  if (top) {
    // the platform's lip throws a shadow onto the bed
    rect(ctx, px, py, TILE, 2, PAL.ink);
    rect(ctx, px, py + 9, TILE, 1, PAL.ash);
    rect(ctx, px, py + 10, TILE, 1, PAL.slate);
  }
  if (bottom) {
    rect(ctx, px, py + 6, TILE, 1, PAL.ash);
    rect(ctx, px, py + 7, TILE, 1, PAL.slate);
    rect(ctx, px, py + TILE - 1, TILE, 1, PAL.stone);
  }
}

/** The drop at a roof's edge: the street far below, a few lit windows, and the parapet's lip. */
function drawDrop(ctx: Ctx, w: World, x: number, y: number, px: number, py: number) {
  rect(ctx, px, py, TILE, TILE, PAL.ink);
  dither(ctx, px, py, TILE, TILE, PAL.coal, (x + y) % 2);
  for (let k = 0; k < 2; k++) {
    const h = hash(x, y, k + 7);
    if (h % 3 === 0) rect(ctx, px + (h % 14), py + ((h >> 3) % 14), 1, 2, PAL.iron);
  }
  const floorAt = (dx: number, dy: number) => {
    const t = at(w, x + dx, y + dy);
    return t !== TILE_VOID && t !== TILE_DROP;
  };
  if (floorAt(0, -1)) rect(ctx, px, py, TILE, 3, PAL.stone), rect(ctx, px, py + 3, TILE, 1, PAL.slate);
  if (floorAt(0, 1)) rect(ctx, px, py + TILE - 2, TILE, 2, PAL.ash);
  if (floorAt(-1, 0)) rect(ctx, px, py, 2, TILE, PAL.stone);
  if (floorAt(1, 0)) rect(ctx, px + TILE - 2, py, 2, TILE, PAL.slate);
}

function drawWalls(ctx: Ctx, w: World, occ: Occluder[], theme: Theme) {
  const C = WALLS[theme];
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
      rect(ctx, px, py - 8, TILE, southOpen ? 16 : 24, C.top);
      if (northOpen) rect(ctx, px, py - 8, TILE, 1, C.edge);
      if (!wallish(at(w, x - 1, y))) rect(ctx, px, py - 8, 1, southOpen ? 16 : 24, C.edge);
      if (!wallish(at(w, x + 1, y))) rect(ctx, px + TILE - 1, py - 8, 1, southOpen ? 16 : 24, C.shade);
      if (southOpen) {
        rect(ctx, px, py + 7, TILE, 1, C.shade);
        rect(ctx, px, py + 8, TILE, 4, C.face);
        rect(ctx, px, py + 12, TILE, 3, C.shade);
        rect(ctx, px, py + 15, TILE, 1, C.foot);
        if (theme === 'subway') {
          // white tiles with grey grout
          for (let i = 0; i < TILE; i += 4) rect(ctx, px + i, py + 8, 1, 4, PAL.fog);
          rect(ctx, px, py + 10, TILE, 1, PAL.fog);
        } else if (theme === 'core') {
          // a film strip: sprocket holes along the face
          for (let i = 2; i < TILE; i += 6) rect(ctx, px + i, py + 9, 3, 3, PAL.paper);
        } else if (theme === 'club' && (x * 7 + y) % 5 === 0) {
          rect(ctx, px + 5, py + 9, 6, 2, PAL.slate);
        }
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
  // diagonal glare streaks, shifted per tile so a long wall of glass doesn't repeat
  const o = (x * 5 + y * 3) % 7;
  if (horizontal || !vertical) {
    // a pane running east-west: a dark frame top and bottom, a pale face, two streaks of glare
    rect(ctx, px, py + 2, TILE, 1, PAL.ash);
    rect(ctx, px, py + 3, TILE, 11, PAL.fog);
    dither(ctx, px, py + 11, TILE, 3, PAL.stone);
    for (let k = 0; k < 7; k++) {
      const gx = px + ((o + k) % TILE), gy = py + 12 - k;
      if (gx >= px + 2) rect(ctx, gx, gy, 1, 1, PAL.paper);
      const hx = px + ((o + k + 4) % TILE);
      if (k < 5 && hx >= px + 2) rect(ctx, hx, gy, 1, 1, PAL.paper);
    }
    rect(ctx, px, py + 14, TILE, 1, PAL.ash);
    rect(ctx, px, py + 3, TILE, 1, PAL.paper);
  }
  if (vertical) {
    // a pane running north-south, seen edge-on in ¾: a slab with a lit top, framed dark on both sides
    rect(ctx, px + 5, py - 6, 6, TILE + 6, PAL.fog);
    rect(ctx, px + 5, py - 6, 1, TILE + 6, PAL.ash);
    rect(ctx, px + 10, py - 6, 1, TILE + 6, PAL.ash);
    dither(ctx, px + 8, py - 6, 2, TILE + 6, PAL.stone);
    for (let k = 0; k < 4; k++) rect(ctx, px + 6 + (k >> 1), py - 2 + o + k * 2, 1, 2, PAL.paper);
    if (!g(at(w, x, y - 1))) rect(ctx, px + 5, py - 6, 6, 1, PAL.paper);
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
    case 'A': {
      // a turnstile: a waist-high post with its arms out
      box(PAL.ash, PAL.fog, PAL.stone, PAL.slate);
      rect(ctx, px + 7, top0 + 1, 2, 3, PAL.iron);
      rect(ctx, px + 2, top0 + 2, 12, 1, PAL.slate);
      if (!S) rect(ctx, x0 + 2, top1 + 2, 3, 2, PAL.iron);
      break;
    }
    case 'L': {
      // a pillar: tall and square, tiled on the face
      const lx0 = px + 3, lx1 = px + 13, lt = py + 13 - h;
      rect(ctx, lx0, lt, lx1 - lx0, 5, PAL.fog);
      rect(ctx, lx0, lt, lx1 - lx0, 1, PAL.paper);
      rect(ctx, lx0, lt + 5, lx1 - lx0, h - 5, PAL.ash);
      rect(ctx, lx0, lt + 5, 2, h - 5, PAL.fog);
      rect(ctx, lx1 - 1, lt + 5, 1, h - 5, PAL.stone);
      for (let j = lt + 9; j < py + 11; j += 5) rect(ctx, lx0 + 1, j, lx1 - lx0 - 2, 1, PAL.fog);
      rect(ctx, lx0, py + 11, lx1 - lx0, 2, PAL.stone);
      break;
    }
    case 'N':
      // a bench: a slatted seat on two legs
      rect(ctx, x0, top0 + 2, x1 - x0, 4, PAL.stone);
      rect(ctx, x0, top0 + 2, x1 - x0, 1, PAL.ash);
      rect(ctx, x0, top0 + 4, x1 - x0, 1, PAL.slate);
      if (!S) {
        if (!L) rect(ctx, x0 + 1, top0 + 6, 2, h, PAL.iron);
        if (!R) rect(ctx, x1 - 3, top0 + 6, 2, h, PAL.iron);
      }
      break;
    case 'I':
      // steel girders, stacked
      box(PAL.slate, PAL.stone, PAL.iron, PAL.coal);
      for (let j = top0 + 2; j < top1; j += 3) rect(ctx, x0 + 1, j, x1 - x0 - 2, 1, PAL.iron);
      if (!S) for (let i = x0 + 2; i < x1 - 1; i += 5) rect(ctx, i, top1 + 2, 2, h - 4, PAL.slate);
      break;
    case 'U':
      // a crate: planks and a cross brace
      box(PAL.ash, PAL.fog, PAL.stone, PAL.slate);
      rect(ctx, x0 + 1, top0 + 4, x1 - x0 - 2, 1, PAL.stone);
      if (!S) {
        rect(ctx, x0 + 1, top1 + 1, x1 - x0 - 2, 1, PAL.slate);
        for (let i = 0; i < h - 3; i++) rect(ctx, x0 + 2 + Math.round(i * (x1 - x0 - 5) / (h - 3)), top1 + 2 + i, 1, 1, PAL.slate);
      }
      break;
    case 'Q': {
      // a speaker stack: two cones in a black box
      box(PAL.iron, PAL.slate, PAL.coal, PAL.ink);
      if (!S) {
        for (const cy of [top1 + 4, top1 + 12]) {
          ellipse(ctx, px + 8, cy, 4, 3, PAL.iron);
          rect(ctx, px + 7, cy - 1, 2, 2, PAL.coal);
          rect(ctx, px + 5, cy - 2, 1, 1, PAL.slate);
        }
      }
      break;
    }
    case 'J':
      // the DJ's desk: two decks and a mixer
      box(PAL.iron, PAL.slate, PAL.coal, PAL.ink);
      if (!N) {
        if (!L) ellipse(ctx, px + 5, top0 + 4, 3, 2, PAL.coal), rect(ctx, px + 5, top0 + 3, 1, 1, PAL.stone);
        if (!R) ellipse(ctx, px + 11, top0 + 4, 3, 2, PAL.coal), rect(ctx, px + 11, top0 + 3, 1, 1, PAL.stone);
        if (L && R) for (let i = 2; i < 14; i += 3) rect(ctx, px + i, top0 + 3, 1, 3, PAL.stone);
      }
      break;
    default:
      box(PAL.fog, PAL.paper, PAL.ash, PAL.stone);
  }
}
