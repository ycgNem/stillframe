// The tile grid: what blocks whom, box-vs-tile movement, and lines of sight and fire.
import { TILE } from '../data/tuning';
import type { Body, World } from './types';

export const TILE_FLOOR = 0;
export const TILE_WALL = 1;
export const TILE_GLASS = 2;
export const TILE_PROP = 3;
export const TILE_DOOR = 4;
export const TILE_VOID = 5;

/** Who is asking: reds may walk through doors (they come in that way); nobody else can. */
export type Mover = 'player' | 'red';

export function tileAt(w: World, cx: number, cy: number): number {
  if (cx < 0 || cy < 0 || cx >= w.cols || cy >= w.rows) return TILE_VOID;
  return w.tiles[cy * w.cols + cx];
}

export function tileOfPoint(w: World, x: number, y: number): number {
  return tileAt(w, Math.floor(x / TILE), Math.floor(y / TILE));
}

export function cellIndex(w: World, x: number, y: number): number {
  const cx = Math.floor(x / TILE), cy = Math.floor(y / TILE);
  if (cx < 0 || cy < 0 || cx >= w.cols || cy >= w.rows) return -1;
  return cy * w.cols + cx;
}

export function solidFor(t: number, who: Mover): boolean {
  if (t === TILE_FLOOR) return false;
  if (t === TILE_DOOR) return who !== 'red';
  return true;
}

/** Bullets and thrown things stop here (glass is handled by the caller: it breaks). */
export function stopsShots(t: number): boolean {
  return t === TILE_WALL || t === TILE_PROP || t === TILE_DOOR || t === TILE_VOID;
}

/** You can see through floor and glass. */
export function blocksSight(t: number): boolean {
  return t !== TILE_FLOOR && t !== TILE_GLASS;
}

/** Does a box of half-size r at (x, y) overlap anything solid for `who`? */
export function boxBlocked(w: World, x: number, y: number, r: number, who: Mover): boolean {
  const x0 = Math.floor((x - r) / TILE), x1 = Math.floor((x + r - 1e-6) / TILE);
  const y0 = Math.floor((y - r) / TILE), y1 = Math.floor((y + r - 1e-6) / TILE);
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) if (solidFor(tileAt(w, cx, cy), who)) return true;
  return false;
}

/**
 * Moves a body by (dx, dy), one axis at a time, stopping flush against solid tiles, so it slides
 * along walls. Returns which axes were blocked.
 */
export function moveBody(w: World, b: Body, dx: number, dy: number, who: Mover): { bx: boolean; by: boolean } {
  let bx = false, by = false;
  if (dx !== 0) {
    const nx = b.x + dx;
    if (boxBlocked(w, nx, b.y, b.r, who)) {
      bx = true;
      // slide flush to the tile edge
      if (dx > 0) b.x = Math.max(b.x, Math.floor((nx + b.r) / TILE) * TILE - b.r - 0.001);
      else b.x = Math.min(b.x, (Math.floor((nx - b.r) / TILE) + 1) * TILE + b.r + 0.001);
      if (boxBlocked(w, b.x, b.y, b.r, who)) b.x = nx - dx; // corner case: stay put
    } else b.x = nx;
  }
  if (dy !== 0) {
    const ny = b.y + dy;
    if (boxBlocked(w, b.x, ny, b.r, who)) {
      by = true;
      if (dy > 0) b.y = Math.max(b.y, Math.floor((ny + b.r) / TILE) * TILE - b.r - 0.001);
      else b.y = Math.min(b.y, (Math.floor((ny - b.r) / TILE) + 1) * TILE + b.r + 0.001);
      if (boxBlocked(w, b.x, b.y, b.r, who)) b.y = ny - dy;
    } else b.y = ny;
  }
  return { bx, by };
}

/** Walks the cells a segment crosses (Amanatides–Woo), calling `visit` until it returns true. */
export function walkCells(ax: number, ay: number, bx: number, by: number, visit: (cx: number, cy: number) => boolean): boolean {
  let cx = Math.floor(ax / TILE), cy = Math.floor(ay / TILE);
  const ex = Math.floor(bx / TILE), ey = Math.floor(by / TILE);
  const dx = bx - ax, dy = by - ay;
  const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
  const tdx = dx !== 0 ? Math.abs(TILE / dx) : Infinity, tdy = dy !== 0 ? Math.abs(TILE / dy) : Infinity;
  let tmx = dx !== 0 ? ((sx > 0 ? (cx + 1) * TILE - ax : ax - cx * TILE) / Math.abs(dx)) : Infinity;
  let tmy = dy !== 0 ? ((sy > 0 ? (cy + 1) * TILE - ay : ay - cy * TILE) / Math.abs(dy)) : Infinity;
  for (let guard = 0; guard < 256; guard++) {
    if (visit(cx, cy)) return true;
    if (cx === ex && cy === ey) return false;
    if (tmx < tmy) {
      tmx += tdx;
      cx += sx;
    } else {
      tmy += tdy;
      cy += sy;
    }
  }
  return false;
}

/** Clear line of sight between two points (glass doesn't block it). */
export function canSee(w: World, ax: number, ay: number, bx: number, by: number): boolean {
  return !walkCells(ax, ay, bx, by, (cx, cy) => blocksSight(tileAt(w, cx, cy)));
}

/** Would a bullet get from a to b? Glass counts as clear (it breaks); walls and props don't. */
export function shotClear(w: World, ax: number, ay: number, bx: number, by: number): boolean {
  return !walkCells(ax, ay, bx, by, (cx, cy) => stopsShots(tileAt(w, cx, cy)));
}

/** Can a box of half-size r walk straight from a to b? (Samples the path every few px.) */
export function pathClear(w: World, ax: number, ay: number, bx: number, by: number, r: number, who: Mover): boolean {
  const d = Math.hypot(bx - ax, by - ay);
  const n = Math.max(1, Math.ceil(d / 4));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    if (boxBlocked(w, ax + (bx - ax) * t, ay + (by - ay) * t, r, who)) return false;
  }
  return true;
}

/** Distance from a point along a direction until a shot would stop (for aim-tell lines). */
export function rayLength(w: World, x: number, y: number, ang: number, max: number): number {
  const dx = Math.cos(ang), dy = Math.sin(ang);
  for (let d = 0; d < max; d += 2) if (stopsShots(tileOfPoint(w, x + dx * d, y + dy * d))) return d;
  return max;
}

export function cellCenter(i: number, cols: number) {
  return { x: (i % cols) * TILE + TILE / 2, y: Math.floor(i / cols) * TILE + TILE / 2 };
}
