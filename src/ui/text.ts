// Drawing and measuring text in the two faces (fonts.ts). Measuring is pure (tests run it headless);
// drawing bakes each face into a white glyph atlas once, and once more per colour it is drawn in, so a
// string costs one drawImage per glyph.
//
// Rich text: `[Esc]` draws a keycap, `{coin}` `{star}` `{red}` `{time}` draw icons, and `*words*` take the
// accent colour. Brackets and braces never appear in plain copy.
import { PAL } from '../data/palette';
import { PANE, SHARD, type FaceDef } from './fonts';

export type FaceName = 'pane' | 'shard';

interface Glyph {
  rows: string[];
  w: number;
  h: number;
  /** where it sits in the atlas */
  ax: number;
  ay: number;
}

class Face {
  readonly glyphs = new Map<string, Glyph>();
  private atlas: HTMLCanvasElement | null = null;
  private tints = new Map<string, HTMLCanvasElement>();

  constructor(readonly def: FaceDef, readonly capsOnly: boolean) {
    let ax = 0;
    for (const [ch, s] of Object.entries(def.glyphs)) {
      const rows = s.split('|');
      this.glyphs.set(ch, { rows, w: rows[0].length, h: rows.length, ax, ay: 0 });
      ax += rows[0].length + 1;
    }
  }

  glyph(ch: string): Glyph | undefined {
    return this.glyphs.get(ch) ?? this.glyphs.get(this.capsOnly ? ch.toUpperCase() : ch) ?? this.glyphs.get(ch.toUpperCase()) ?? this.glyphs.get('?');
  }

  width(text: string): number {
    let w = 0, n = 0;
    for (const ch of text) {
      if (ch === ' ') w += this.def.space;
      else w += (this.glyph(ch)?.w ?? 0);
      n++;
    }
    return n ? w + (n - 1) * this.def.gap : 0;
  }

  private tinted(color: string): HTMLCanvasElement {
    let c = this.tints.get(color);
    if (c) return c;
    if (!this.atlas) {
      let w = 0, h = 0;
      for (const g of this.glyphs.values()) {
        w = Math.max(w, g.ax + g.w);
        h = Math.max(h, g.h);
      }
      const a = document.createElement('canvas');
      a.width = w;
      a.height = h;
      const x = a.getContext('2d')!;
      x.fillStyle = '#fff';
      for (const g of this.glyphs.values()) g.rows.forEach((r, j) => {
        for (let i = 0; i < r.length; i++) if (r[i] === '#') x.fillRect(g.ax + i, j, 1, 1);
      });
      this.atlas = a;
    }
    c = document.createElement('canvas');
    c.width = this.atlas.width;
    c.height = this.atlas.height;
    const x = c.getContext('2d')!;
    x.drawImage(this.atlas, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color;
    x.fillRect(0, 0, c.width, c.height);
    this.tints.set(color, c);
    return c;
  }

  draw(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, s: number) {
    const src = this.tinted(color);
    let cx = Math.round(x);
    const cy = Math.round(y);
    for (const ch of text) {
      if (ch === ' ') {
        cx += (this.def.space + this.def.gap) * s;
        continue;
      }
      const g = this.glyph(ch);
      if (!g) continue;
      ctx.drawImage(src, g.ax, 0, g.w, g.h, cx, cy, g.w * s, g.h * s);
      cx += (g.w + this.def.gap) * s;
    }
  }
}

const FACES: Record<FaceName, Face> = { pane: new Face(PANE, false), shard: new Face(SHARD, true) };

export function faceDef(f: FaceName = 'pane'): FaceDef {
  return FACES[f].def;
}

/** Width in pixels of `text` in a face at a scale. */
export function measure(text: string, face: FaceName = 'pane', scale = 1): number {
  return FACES[face].width(text) * scale;
}

export interface TextOpts {
  face?: FaceName;
  scale?: number;
  align?: 'left' | 'center' | 'right';
  /** a 1 px ring in this colour all round (words over the world) */
  outline?: string;
  /** a hard shadow one pixel down-right */
  shadow?: string;
}

/** Text with the top of its capitals at y. Returns its width. */
export function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, color: string, o: TextOpts = {}): number {
  const f = FACES[o.face ?? 'pane'], sc = o.scale ?? 1;
  const w = f.width(s) * sc;
  const x0 = o.align === 'center' ? Math.round(x - w / 2) : o.align === 'right' ? x - w : x;
  if (o.outline) for (const [dx, dy] of RING) f.draw(ctx, s, x0 + dx * sc, y + dy * sc, o.outline, sc);
  if (o.shadow) f.draw(ctx, s, x0 + sc, y + sc, o.shadow, sc);
  f.draw(ctx, s, x0, y, color, sc);
  return w;
}

const RING = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];

/** Splits plain text into lines no wider than `maxW`. */
export function wrap(s: string, maxW: number, face: FaceName = 'pane', scale = 1): string[] {
  const out: string[] = [];
  for (const para of s.split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (line && measure(next, face, scale) > maxW) {
        out.push(line);
        line = word;
      } else line = next;
    }
    out.push(line);
  }
  return out;
}

// ------------------------------------------------------------------------------------- rich text

export type IconName = 'coin' | 'star' | 'red' | 'time' | 'lock' | 'skull';

type Span = { k: 'text'; s: string; accent: boolean } | { k: 'key'; s: string } | { k: 'icon'; s: IconName } | { k: 'space' };

/** Icons are 8×8 UI pixels, drawn by whoever owns the palette art (kit.ts registers them). */
let iconPainter: (ctx: CanvasRenderingContext2D, name: IconName, x: number, y: number) => void = () => {};
export function setIconPainter(p: typeof iconPainter) {
  iconPainter = p;
}

const ICON_W = 8;

const MICE: Record<string, string> = { LMB: 'L', RMB: 'R', WHEEL: 'M' };

/** Keycap width for a label (mouse buttons draw as a little mouse). */
export function keyWidth(label: string): number {
  if (MICE[label]) return 9;
  return Math.max(12, measure(label.toUpperCase()) + 7);
}

function spans(s: string): Span[] {
  const out: Span[] = [];
  const re = /\[([^\]]+)\]|\{(\w+)\}|\*([^*]+)\*|( )|([^[{* ]+)/g;
  for (const m of s.matchAll(re)) {
    if (m[1] !== undefined) out.push({ k: 'key', s: m[1] });
    else if (m[2] !== undefined) out.push({ k: 'icon', s: m[2] as IconName });
    else if (m[3] !== undefined) {
      m[3].split(' ').forEach((w, i) => {
        if (i) out.push({ k: 'space' });
        if (w) out.push({ k: 'text', s: w, accent: true });
      });
    } else if (m[4] !== undefined) out.push({ k: 'space' });
    else out.push({ k: 'text', s: m[5], accent: false });
  }
  return out;
}

function spanW(sp: Span): number {
  if (sp.k === 'text') return measure(sp.s);
  if (sp.k === 'key') return keyWidth(sp.s);
  if (sp.k === 'icon') return ICON_W;
  return PANE.space + PANE.gap;
}

/** Rich text laid out into lines no wider than `maxW` (Infinity: one line per '\n'). */
export function richLines(s: string, maxW = Infinity): Span[][] {
  const lines: Span[][] = [];
  for (const para of s.split('\n')) {
    let line: Span[] = [], w = 0;
    // words are runs of spans between spaces
    const words: Span[][] = [[]];
    for (const sp of spans(para)) {
      if (sp.k === 'space') words.push([]);
      else words[words.length - 1].push(sp);
    }
    for (const word of words) {
      const ww = word.reduce((n, sp) => n + spanW(sp) + 1, -1);
      const sw = line.length ? PANE.space + PANE.gap : 0;
      if (line.length && w + sw + ww > maxW) {
        lines.push(line);
        line = [];
        w = 0;
      }
      if (line.length) {
        line.push({ k: 'space' });
        w += sw;
      }
      line.push(...word);
      w += Math.max(0, ww);
    }
    lines.push(line);
  }
  return lines;
}

export function richWidth(line: Span[]): number {
  let w = 0;
  line.forEach((sp, i) => {
    w += spanW(sp);
    if (i < line.length - 1 && sp.k !== 'space' && line[i + 1].k !== 'space') w += 1;
  });
  return w;
}

export interface RichOpts {
  color?: string;
  accent?: string;
  maxW?: number;
  align?: 'left' | 'center' | 'right';
  /** baseline to baseline; keycaps need 15 */
  lineH?: number;
  outline?: string;
}

/** Draws rich text with the first line's capitals at y. Returns the height used. */
export function rich(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, o: RichOpts = {}): number {
  const color = o.color ?? PAL.ink, accent = o.accent ?? PAL.tide;
  const lines = richLines(s, o.maxW ?? Infinity);
  const lh = o.lineH ?? 15;
  lines.forEach((line, li) => {
    const lw = richWidth(line);
    let cx = o.align === 'center' ? Math.round(x - lw / 2) : o.align === 'right' ? x - lw : x;
    const cy = y + li * lh;
    line.forEach((sp, i) => {
      if (sp.k === 'text') text(ctx, sp.s, cx, cy, sp.accent ? accent : color, { outline: o.outline });
      else if (sp.k === 'key') keycap(ctx, sp.s, cx, cy);
      else if (sp.k === 'icon') iconPainter(ctx, sp.s, cx, cy);
      cx += spanW(sp);
      if (i < line.length - 1 && sp.k !== 'space' && line[i + 1].k !== 'space') cx += 1;
    });
  });
  return lines.length * lh;
}

/** A key on the keyboard: a paper cap with an ink rim and a heavier bottom edge, or a mouse with the
 *  button to press lit. Text top at y. */
export function keycap(ctx: CanvasRenderingContext2D, label: string, x: number, y: number) {
  const w = keyWidth(label);
  const fill = (c: string, rx: number, ry: number, rw: number, rh: number) => {
    ctx.fillStyle = c;
    ctx.fillRect(x + rx, y + ry, rw, rh);
  };
  const button = MICE[label];
  if (button) {
    // 7×11: two buttons over a body, the one to press in cyan
    fill(PAL.ink, 2, -2, 5, 1);
    fill(PAL.ink, 1, -1, 7, 10);
    fill(PAL.ink, 2, 9, 5, 1);
    fill(PAL.paper, 2, 4, 5, 4);
    fill(PAL.paper, 2, 0, 2, 3);
    fill(PAL.paper, 5, 0, 2, 3);
    if (button === 'L') fill(PAL.cyan, 2, 0, 2, 3);
    if (button === 'R') fill(PAL.cyan, 5, 0, 2, 3);
    if (button === 'M') fill(PAL.cyan, 4, -1, 1, 4);
    return w;
  }
  const up = label.toUpperCase();
  fill(PAL.ink, 0, -3, w, 13);
  fill(PAL.paper, 1, -2, w - 2, 10);
  fill(PAL.fog, 1, 7, w - 2, 1);
  text(ctx, up, x + Math.floor((w - measure(up)) / 2), y - 1, PAL.ink);
  return w;
}
