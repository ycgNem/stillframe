// Reds find you with a flow field: a breadth-first search over walkable cells from the player's cell,
// rebuilt when you change cell or a tile changes. Rooms are tiny, so this is cheap. Moving diagonally
// may not cut a corner.
import { cellCenter, cellIndex, hotCell, solidFor, tileAt } from './grid';
import type { World } from './types';

const DIRS = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
];

/** A BFS distance field (in steps) from `start` over cells reds can walk. */
export function bfs(w: World, start: number): number[] {
  const n = w.cols * w.rows;
  const dist = new Array<number>(n).fill(-1);
  if (start < 0) return dist;
  const queue = [start];
  dist[start] = 0;
  for (let qi = 0; qi < queue.length; qi++) {
    const c = queue[qi];
    const cx = c % w.cols, cy = Math.floor(c / w.cols);
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w.cols || ny >= w.rows) continue;
      const ni = ny * w.cols + nx;
      if (dist[ni] >= 0 || solidFor(tileAt(w, nx, ny), 'red') || hotCell(w, nx, ny)) continue;
      if (dx && dy && (solidFor(tileAt(w, cx + dx, cy), 'red') || solidFor(tileAt(w, cx, cy + dy), 'red'))) continue;
      dist[ni] = dist[c] + 1;
      queue.push(ni);
    }
  }
  return dist;
}

/** Rebuilds the field if the player changed cell or a tile changed. */
export function updateFlow(w: World) {
  const at = cellIndex(w, w.player.x, w.player.y);
  if (at === w.flowAt && w.flowVersion === w.tilesVersion && w.flowHazard === w.hazardVersion) return;
  w.flowAt = at;
  w.flowVersion = w.tilesVersion;
  w.flowHazard = w.hazardVersion;
  w.flow = bfs(w, at);
}

/**
 * Which way to walk from (x, y) to go down a distance field: toward the centre of the best
 * neighbouring cell. Returns a unit vector, or null if there is no way.
 */
export function downhill(w: World, field: number[], x: number, y: number): { x: number; y: number } | null {
  const c = cellIndex(w, x, y);
  if (c < 0) return null;
  const here = field[c];
  const cx = c % w.cols, cy = Math.floor(c / w.cols);
  let best = -1, bestD = here < 0 ? Infinity : here;
  for (const [dx, dy] of DIRS) {
    const nx = cx + dx, ny = cy + dy;
    if (nx < 0 || ny < 0 || nx >= w.cols || ny >= w.rows) continue;
    const ni = ny * w.cols + nx;
    const d = field[ni];
    if (d < 0 || d >= bestD) continue;
    if (dx && dy && (solidFor(tileAt(w, cx + dx, cy), 'red') || solidFor(tileAt(w, cx, cy + dy), 'red'))) continue;
    best = ni;
    bestD = d;
  }
  if (best < 0) {
    // already in the goal cell (or stranded): head for its centre
    const m = cellCenter(c, w.cols);
    const d = Math.hypot(m.x - x, m.y - y);
    return d > 1 ? { x: (m.x - x) / d, y: (m.y - y) / d } : null;
  }
  const t = cellCenter(best, w.cols);
  // hug the cell centre line only when it matters: blend toward the target centre
  const tx = t.x - x, ty = t.y - y;
  const d = Math.hypot(tx, ty) || 1;
  return { x: tx / d, y: ty / d };
}
