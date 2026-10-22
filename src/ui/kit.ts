// Immediate-mode UI on the game canvas: panels and buttons drawn in game pixels, hit-tested against the
// mouse each frame. Hovering ticks, clicking clicks.
import type { Sound } from '../audio/audio';
import { PAL } from '../data/palette';
import type { Input } from '../engine/input';
import { centerBig, centerText, drawText } from '../render/font';
import { dither, frame, rect, type Ctx } from '../render/prims';

export class Ui {
  /** the button under the mouse this frame, and last frame (for the hover tick) */
  private hot = '';
  private lastHot = '';
  clicked = false;

  constructor(
    readonly ctx: Ctx,
    readonly input: Input,
    readonly sound: Sound,
  ) {}

  /** Call at the start of a screen's frame. */
  begin() {
    this.lastHot = this.hot;
    this.hot = '';
    this.clicked = this.input.pressed('Mouse0');
  }

  /** Call at the end: plays the hover tick when the mouse moves onto a new button. */
  end() {
    if (this.hot && this.hot !== this.lastHot) this.sound.play('hover');
  }

  over(x: number, y: number, w: number, h: number) {
    const m = this.input.mouse;
    return m.x >= x && m.x < x + w && m.y >= y && m.y < y + h;
  }

  /**
   * A button; returns true when clicked (or its key pressed). `id` must be unique on screen.
   * Disabled buttons draw dim and never fire.
   */
  button(id: string, x: number, y: number, w: number, h: number, label: string, o: { enabled?: boolean; primary?: boolean; key?: string; color?: string; big?: boolean } = {}) {
    const enabled = o.enabled ?? true;
    const hover = enabled && this.over(x, y, w, h);
    if (hover) this.hot = id;
    const ctx = this.ctx;
    rect(ctx, x, y, w, h, hover ? PAL.coal : PAL.ink);
    frame(ctx, x, y, w, h, hover ? PAL.paper : o.primary && enabled ? PAL.cyan : PAL.iron);
    const color = !enabled ? PAL.iron : o.color ?? (hover ? PAL.paper : o.primary ? PAL.cyan : PAL.fog);
    if (o.big) centerBig(ctx, label, x + w / 2, y + Math.floor((h - 7) / 2), color);
    else centerText(ctx, label, x + w / 2, y + Math.floor((h - 5) / 2), color);
    const keyHit = enabled && !!o.key && this.input.pressed(o.key);
    const hit = (hover && this.clicked) || keyHit;
    if (hit) {
      this.sound.play('click');
      this.clicked = false;
    }
    return hit;
  }

  panel(x: number, y: number, w: number, h: number) {
    rect(this.ctx, x, y, w, h, PAL.ink);
    frame(this.ctx, x, y, w, h, PAL.slate);
    frame(this.ctx, x + 1, y + 1, w - 2, h - 2, PAL.coal);
  }

  label(text: string, x: number, y: number, color: string = PAL.fog) {
    drawText(this.ctx, text, x, y, color);
  }

  /** Dims what's behind a menu with a checkerboard of ink (no alpha in this game). */
  dim() {
    dither(this.ctx, 0, 0, 320, 180, PAL.ink);
  }
}

/** A five-point star, 7×7, filled or as an outline. */
export function star(ctx: Ctx, x: number, y: number, filled: boolean, color: string = PAL.gold) {
  const rows = ['...#...', '..###..', '#######', '.#####.', '..###..', '.##.##.', '.#...#.'];
  const edge = ['...#...', '..#.#..', '###.###', '.#...#.', '..#.#..', '.##.##.', '.#...#.'];
  const g = filled ? rows : edge;
  ctx.fillStyle = filled ? color : PAL.iron;
  for (let j = 0; j < 7; j++) for (let i = 0; i < 7; i++) if (g[j][i] === '#') ctx.fillRect(Math.round(x) + i, Math.round(y) + j, 1, 1);
  if (filled) {
    ctx.fillStyle = PAL.shine;
    ctx.fillRect(Math.round(x) + 3, Math.round(y) + 1, 1, 1);
    ctx.fillRect(Math.round(x) + 2, Math.round(y) + 2, 1, 1);
  }
}

/** A coin icon, 5×5. */
export function coinIcon(ctx: Ctx, x: number, y: number) {
  rect(ctx, x, y + 1, 5, 3, PAL.amber);
  rect(ctx, x + 1, y, 3, 5, PAL.amber);
  rect(ctx, x + 1, y + 1, 3, 3, PAL.gold);
  rect(ctx, x + 1, y + 1, 1, 1, PAL.shine);
}
