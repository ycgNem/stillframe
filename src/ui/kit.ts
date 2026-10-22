// Immediate-mode UI on the UI layer (640×360 UI pixels, docs/STYLE.md §8): paper cards with an ink rim,
// buttons with a lip that press down, keycaps, chips, bars, stars and icons. Light paper and dark ink,
// never pale text in a dark box. Hit-tested against the mouse each frame; hovering ticks, clicking clicks.
import type { Sound } from '../audio/audio';
import { PAL } from '../data/palette';
import type { Input } from '../engine/input';
import { dither, rect } from '../render/prims';
import { keycap, keyWidth, measure, rich, setIconPainter, text, type FaceName, type IconName } from './text';

/** The UI layer's size in UI pixels. */
export const UI = { w: 640, h: 360, scale: 2 };

export type ButtonKind = 'normal' | 'primary' | 'danger' | 'quiet';

export interface ButtonOpts {
  enabled?: boolean;
  kind?: ButtonKind;
  /** KeyboardEvent.code that also presses it */
  key?: string;
  /** a keycap drawn at the right end (the key's name as the player knows it) */
  cap?: string;
  face?: FaceName;
  /** shown pressed in (a toggle that is on, the chosen option) */
  on?: boolean;
  /** text colour override */
  color?: string;
  align?: 'center' | 'left';
}

export class Ui {
  /** the button under the mouse this frame, and last frame (for the hover tick) */
  private hot = '';
  private lastHot = '';
  clicked = false;

  constructor(
    readonly ctx: CanvasRenderingContext2D,
    readonly input: Input,
    readonly sound: Sound,
  ) {}

  /** The mouse in UI pixels. */
  get mouse() {
    return { x: this.input.mouse.x * UI.scale, y: this.input.mouse.y * UI.scale };
  }

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
    const m = this.mouse;
    return m.x >= x && m.x < x + w && m.y >= y && m.y < y + h;
  }

  /** Marks a custom widget hot (for the hover tick) and returns whether it was clicked. */
  hit(id: string, x: number, y: number, w: number, h: number): boolean {
    if (!this.over(x, y, w, h)) return false;
    this.hot = id;
    if (!this.clicked) return false;
    this.clicked = false;
    this.sound.play('click');
    return true;
  }

  /**
   * A button with a lip that presses down; returns true when clicked (or its key pressed). `label` is rich
   * text. Disabled buttons draw flat and never fire.
   */
  button(id: string, x: number, y: number, w: number, h: number, label: string, o: ButtonOpts = {}) {
    const enabled = o.enabled ?? true;
    const hover = enabled && this.over(x, y, w, h);
    if (hover) this.hot = id;
    const down = (hover && this.input.down('Mouse0')) || !!o.on;
    const kind = o.kind ?? 'normal';
    const c = enabled ? KINDS[kind] : DISABLED;
    const ctx = this.ctx;
    const lip = enabled ? 2 : 0;
    const press = down ? Math.min(lip, 1) : 0;
    // the lip, then the face on top of it
    plate(ctx, x, y + press, w, h - press, c.rim, null);
    rect(ctx, x + 1, y + press + 1, w - 2, h - press - 2, c.lip);
    rect(ctx, x + 1, y + press + 1, w - 2, h - press - 2 - lip + press, hover && !down ? c.hover : c.face);
    const faceH = h - lip;
    const color = o.color ?? c.text;
    const capW = o.cap ? keyWidth(o.cap) + 4 : 0;
    const f = o.face ?? 'pane';
    const ty = y + press + Math.floor((faceH - (f === 'shard' ? 11 : 8)) / 2);
    if (f === 'shard') text(ctx, label, x + (w - capW) / 2, ty, color, { face: 'shard', align: 'center' });
    else if (o.align === 'left') rich(ctx, label, x + 6, ty, { color, accent: color });
    else rich(ctx, label, x + (w - capW) / 2, ty, { color, accent: color, align: 'center' });
    if (o.cap) keycap(ctx, o.cap, x + w - capW - 1, ty);
    const keyHit = enabled && !!o.key && this.input.pressed(o.key);
    const hit = (hover && this.clicked) || keyHit;
    if (hit) {
      this.sound.play('click');
      this.clicked = false;
    }
    return hit;
  }

  /** A paper card with an ink rim, cut corners and a hard shadow down-right. */
  card(x: number, y: number, w: number, h: number, o: { fill?: string; shadow?: string | null; rim?: string } = {}) {
    plate(this.ctx, x, y, w, h, o.rim ?? PAL.ink, o.shadow === undefined ? PAL.stone : o.shadow);
    rect(this.ctx, x + 1, y + 1, w - 2, h - 2, o.fill ?? PAL.paper);
  }

  /** A small rounded tag: a word on a coloured ground. */
  chip(x: number, y: number, label: string, fill: string, color: string = PAL.ink): number {
    const w = measure(label) + 8;
    plate(this.ctx, x, y, w, 12, fill, null);
    text(this.ctx, label, x + 4, y + 2, color);
    return w;
  }

  /** A meter: a sunken track and a fill. */
  bar(x: number, y: number, w: number, h: number, frac: number, fill: string, track: string = PAL.fog) {
    const ctx = this.ctx;
    plate(ctx, x, y, w, h, PAL.ink, null);
    rect(ctx, x + 1, y + 1, w - 2, h - 2, track);
    const f = Math.round((w - 2) * Math.max(0, Math.min(1, frac)));
    if (f > 0) rect(ctx, x + 1, y + 1, f, h - 2, fill);
  }

  /** A frosted veil over everything drawn so far: what's behind a menu, washed toward paper. */
  veil(color: string = PAL.paper) {
    dither(this.ctx, 0, 0, UI.w, UI.h, color);
  }

  text(s: string, x: number, y: number, color: string = PAL.ink, o: Parameters<typeof text>[5] = {}) {
    return text(this.ctx, s, x, y, color, o);
  }

  rich(s: string, x: number, y: number, o: Parameters<typeof rich>[4] = {}) {
    return rich(this.ctx, s, x, y, o);
  }
}

/** A filled rectangle with its four corner pixels left out, and an optional hard shadow. */
export function plate(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, shadow: string | null) {
  if (shadow) {
    rect(ctx, x + 3, y + h, w - 2, 2, shadow);
    rect(ctx, x + w, y + 3, 2, h - 2, shadow);
    rect(ctx, x + w - 1, y + h - 1, 2, 2, shadow);
  }
  rect(ctx, x + 1, y, w - 2, h, color);
  rect(ctx, x, y + 1, w, h - 2, color);
}

const KINDS: Record<ButtonKind, { rim: string; face: string; hover: string; lip: string; text: string }> = {
  normal: { rim: PAL.ink, face: PAL.paper, hover: PAL.fog, lip: PAL.stone, text: PAL.ink },
  primary: { rim: PAL.ink, face: PAL.cyan, hover: PAL.paper, lip: PAL.tide, text: PAL.ink },
  danger: { rim: PAL.ink, face: PAL.red, hover: PAL.hot, lip: PAL.blood, text: PAL.paper },
  quiet: { rim: PAL.ash, face: PAL.paper, hover: PAL.fog, lip: PAL.ash, text: PAL.iron },
};
const DISABLED = { rim: PAL.ash, face: PAL.fog, hover: PAL.fog, lip: PAL.fog, text: PAL.stone };

// ------------------------------------------------------------------------------------------ icons

/** Pixel strings for icons in UI pixels. Letters are palette colours (see INK). */
const ICONS: Record<IconName, string[]> = {
  coin: ['..aaaa..', '.agggga.', 'agsgggga', 'agsgggga', 'agggggga', 'aggggaga', '.aggaga.', '..aaaa..'],
  star: ['...ag...', '...gg...', 'aaggggaa', '.gggggg.', '..gggg..', '..gggg..', '.gg..gg.', '.a....a.'],
  red: ['...w....', '..wrw...', '.wrhrw..', 'wrhhrrw.', '.wrrbw..', '..wbw...', '...w....', '........'],
  time: ['..tttt..', '.tppppt.', 'tpppkppt', 'tpppkppt', 'tppkkppt', 'tppppppt', '.tppppt.', '..tttt..'],
  lock: ['..kkkk..', '.kk..kk.', '.k....k.', 'kkkkkkkk', 'kkkppkkk', 'kkkppkkk', 'kkkkkkkk', '........'],
  skull: ['.kkkkkk.', 'kppppppk', 'kpkppkpk', 'kpkppkpk', 'kppppppk', '.kpkkpk.', '.kpppk..', '..kkk...'],
};

const INK: Record<string, string> = {
  a: PAL.amber, g: PAL.gold, s: PAL.shine, k: PAL.ink, r: PAL.red, h: PAL.hot, b: PAL.blood, w: PAL.wine,
  p: PAL.paper, c: PAL.cyan, t: PAL.tide, f: PAL.fog, i: PAL.iron, l: PAL.slate, n: PAL.stone, o: PAL.glint,
};

export function icon(ctx: CanvasRenderingContext2D, name: IconName, x: number, y: number, scale = 1) {
  paint(ctx, ICONS[name], x, y, scale);
}

/** Paints a pixel-string picture: each letter a palette colour (INK), anything else left clear. */
export function paint(ctx: CanvasRenderingContext2D, rows: string[], x: number, y: number, scale = 1) {
  const x0 = Math.round(x), y0 = Math.round(y);
  rows.forEach((r, j) => {
    for (let i = 0; i < r.length; i++) {
      const c = INK[r[i]];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x0 + i * scale, y0 + j * scale, scale, scale);
    }
  });
}

setIconPainter((ctx, name, x, y) => icon(ctx, name, x, y));

const STAR = [
  '......a......', '.....aga.....', '.....aga.....', '....agsga....', 'aaaaagsggaaaa', '.aggsgggggga.',
  '..aggggggga..', '...agggggaa..', '...aggggga...', '..aggaaagga..', '..aga...aga..', '.aga.....aga.', '.aa.......aa.',
];
const STAR_EMPTY = STAR.map((r) => r.replace(/[gs]/g, '.').replace(/a/g, 'n'));

/** A 13×13 star, gold when earned, an outline when not. */
export function bigStar(ctx: CanvasRenderingContext2D, x: number, y: number, filled: boolean, scale = 1) {
  paint(ctx, filled ? STAR : STAR_EMPTY, x, y, scale);
}
