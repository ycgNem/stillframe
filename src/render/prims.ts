// Drawing primitives on whole game pixels (docs/STYLE.md §1): no anti-aliasing, no alpha.

export type Ctx = CanvasRenderingContext2D;

export function rect(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** A 1 px border inside the rectangle. */
export function frame(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  rect(ctx, x, y, w, 1, color);
  rect(ctx, x, y + h - 1, w, 1, color);
  rect(ctx, x, y, 1, h, color);
  rect(ctx, x + w - 1, y, 1, h, color);
}

/** A filled circle, one row span at a time. */
export function disc(ctx: Ctx, cx: number, cy: number, r: number, color: string) {
  ctx.fillStyle = color;
  const x0 = Math.round(cx), y0 = Math.round(cy);
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.round(Math.sqrt(r * r - dy * dy));
    ctx.fillRect(x0 - half, y0 + dy, half * 2 + 1, 1);
  }
}

/** A circle outline. */
export function ring(ctx: Ctx, cx: number, cy: number, r: number, color: string) {
  ctx.fillStyle = color;
  const x0 = Math.round(cx), y0 = Math.round(cy);
  const n = Math.max(8, Math.round(r * 6.3));
  let lx = NaN, ly = NaN;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = x0 + Math.round(Math.cos(a) * r), y = y0 + Math.round(Math.sin(a) * r);
    if (x !== lx || y !== ly) ctx.fillRect(x, y, 1, 1);
    lx = x;
    ly = y;
  }
}

/** An ellipse, filled (drop shadows). */
export function ellipse(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, color: string) {
  ctx.fillStyle = color;
  const x0 = Math.round(cx), y0 = Math.round(cy);
  for (let dy = -ry; dy <= ry; dy++) {
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry))));
    ctx.fillRect(x0 - half, y0 + dy, half * 2 + 1, 1);
  }
}

/** Bresenham line, one game pixel wide. `dash` > 0 draws `dash` on, `dash` off. */
export function line(ctx: Ctx, ax: number, ay: number, bx: number, by: number, color: string, dash = 0, phase = 0) {
  ctx.fillStyle = color;
  let x = Math.round(ax), y = Math.round(ay);
  const x1 = Math.round(bx), y1 = Math.round(by);
  const dx = Math.abs(x1 - x), dy = -Math.abs(y1 - y);
  const sx = x < x1 ? 1 : -1, sy = y < y1 ? 1 : -1;
  let err = dx + dy;
  for (let i = 0; ; i++) {
    if (!dash || Math.floor((i + phase) / dash) % 2 === 0) ctx.fillRect(x, y, 1, 1);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

/** Every other pixel of a rectangle (a checkerboard): how we darken or fade without alpha. */
export function dither(ctx: Ctx, x: number, y: number, w: number, h: number, color: string, phase = 0) {
  ctx.fillStyle = color;
  const x0 = Math.round(x), y0 = Math.round(y);
  for (let j = 0; j < h; j++) for (let i = (j + phase) & 1; i < w; i += 2) ctx.fillRect(x0 + i, y0 + j, 1, 1);
}

/** A sparser dither (1 pixel in 4), for lighter shading. */
export function dither4(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  const x0 = Math.round(x), y0 = Math.round(y);
  for (let j = 0; j < h; j += 2) for (let i = (j / 2) & 1 ? 2 : 0; i < w; i += 4) ctx.fillRect(x0 + i, y0 + j, 1, 1);
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
