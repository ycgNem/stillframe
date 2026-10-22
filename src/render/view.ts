// The game's fixed resolution and the camera. ×4 at 720p, ×6 at 1080p, ×8 at 1440p (docs/STYLE.md).
import { TILE } from '../data/tuning';
import type { World } from '../sim/types';

export const VIEW = { w: 320, h: 180 };

/**
 * Bullets, thrown things and aim lines fly at chest height: drawn this many pixels above their
 * position on the floor. The cursor is read the other way (a point on a red's body means its feet
 * below), so aiming at what you see hits it.
 */
export const AIR = 7;

export interface Camera {
  /** top-left of the view in world pixels (whole numbers) */
  x: number;
  y: number;
  /** smoothed target, before rounding */
  fx: number;
  fy: number;
  /** whole-pixel screen shake, in real seconds left and pixels */
  shakeT: number;
  shakeA: number;
}

export function newCamera(): Camera {
  return { x: 0, y: 0, fx: NaN, fy: NaN, shakeT: 0, shakeA: 0 };
}

/**
 * Follows the player, leaning a little toward the cursor; a level smaller than the view sits centred.
 * `mx, my` is the cursor in view pixels. `snap` jumps straight there.
 */
export function followCamera(c: Camera, w: World, alphaX: number, alphaY: number, mx: number, my: number, realDt: number, snap = false) {
  const lw = w.cols * TILE, lh = w.rows * TILE;
  const lookX = Math.max(-1, Math.min(1, (mx - VIEW.w / 2) / (VIEW.w / 2))) * 24;
  const lookY = Math.max(-1, Math.min(1, (my - VIEW.h / 2) / (VIEW.h / 2))) * 16;
  const tx = lw <= VIEW.w ? (lw - VIEW.w) / 2 : clamp(alphaX + lookX - VIEW.w / 2, 0, lw - VIEW.w);
  // the top wall's face rises 8 px above row 0, so give it room
  const ty = lh + 8 <= VIEW.h ? (lh - 8 - VIEW.h) / 2 + 4 : clamp(alphaY + lookY - VIEW.h / 2, -8, lh - VIEW.h);
  if (snap || Number.isNaN(c.fx)) {
    c.fx = tx;
    c.fy = ty;
  } else {
    const k = Math.min(1, realDt * 8);
    c.fx += (tx - c.fx) * k;
    c.fy += (ty - c.fy) * k;
  }
  c.shakeT = Math.max(0, c.shakeT - realDt);
  const s = c.shakeT > 0 ? Math.round(c.shakeA) : 0;
  const jx = s ? (Math.floor(performance.now() / 30) % 2 ? s : -s) : 0;
  const jy = s ? (Math.floor(performance.now() / 45) % 2 ? s : -s) : 0;
  c.x = Math.round(c.fx) + jx;
  c.y = Math.round(c.fy) + jy;
}

export function shake(c: Camera, px: number, seconds: number) {
  if (px >= c.shakeA || c.shakeT <= 0) {
    c.shakeA = px;
    c.shakeT = seconds;
  }
}

function clamp(v: number, a: number, b: number) {
  return v < a ? a : v > b ? b : v;
}
