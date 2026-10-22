// The sprite atlas: one PNG packed from pixel-art/*/export by pixel-art/build_atlas.py, plus its JSON
// (names, frames, pivots). Sprites are drawn on whole pixels and only ever flipped, never rotated or
// scaled (docs/STYLE.md). Anything missing from the atlas is reported by `has`, so callers can fall
// back to shapes.

export interface SpriteDef {
  /** [x, y, w, h] in the sheet, one per frame */
  frames: [number, number, number, number][];
  /** the point drawn at the given position (feet for characters, grip for held items) */
  pivot: [number, number];
}

export interface SheetJson {
  size: [number, number];
  sprites: Record<string, SpriteDef>;
}

export class Atlas {
  private img: HTMLImageElement | null = null;
  private pixelCache = new Map<string, { w: number; h: number; data: Uint8ClampedArray }>();
  private tints = new Map<string, HTMLCanvasElement>();
  ready = false;

  constructor(
    url: string,
    readonly json: SheetJson,
  ) {
    if (!Object.keys(json.sprites).length) return;
    const img = new Image();
    img.onload = () => {
      this.img = img;
      this.ready = true;
    };
    img.src = url;
  }

  has(name: string): boolean {
    return this.ready && name in this.json.sprites;
  }

  frames(name: string): number {
    return this.json.sprites[name]?.frames.length ?? 0;
  }

  /** Draws frame `f` of `name` with its pivot at (x, y). `flip` mirrors it left to right about the pivot. */
  draw(ctx: CanvasRenderingContext2D, name: string, f: number, x: number, y: number, flip = false) {
    const s = this.json.sprites[name];
    if (!s || !this.img) return;
    const [sx, sy, w, h] = s.frames[((f % s.frames.length) + s.frames.length) % s.frames.length];
    const px = Math.round(x), py = Math.round(y);
    if (!flip) {
      ctx.drawImage(this.img, sx, sy, w, h, px - s.pivot[0], py - s.pivot[1], w, h);
      return;
    }
    ctx.save();
    ctx.translate(px, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(this.img, sx, sy, w, h, -(w - s.pivot[0]) + 0, py - s.pivot[1], w, h);
    ctx.restore();
  }

  /** Draws a frame as a flat silhouette in one colour (outlines, flashes). */
  drawTinted(ctx: CanvasRenderingContext2D, name: string, f: number, x: number, y: number, flip: boolean, color: string) {
    if (!this.img) return;
    let sheet = this.tints.get(color);
    if (!sheet) {
      sheet = document.createElement('canvas');
      sheet.width = this.img.width;
      sheet.height = this.img.height;
      const c = sheet.getContext('2d')!;
      c.drawImage(this.img, 0, 0);
      c.globalCompositeOperation = 'source-in';
      c.fillStyle = color;
      c.fillRect(0, 0, sheet.width, sheet.height);
      this.tints.set(color, sheet);
    }
    const real = this.img;
    this.img = sheet as unknown as HTMLImageElement;
    this.draw(ctx, name, f, x, y, flip);
    this.img = real;
  }

  /** The RGBA pixels of one frame (for shatter shards), cached. */
  pixels(name: string, f: number): { w: number; h: number; data: Uint8ClampedArray; pivot: [number, number] } | null {
    const s = this.json.sprites[name];
    if (!s || !this.img) return null;
    const key = `${name}#${f}`;
    let c = this.pixelCache.get(key);
    if (!c) {
      const [sx, sy, w, h] = s.frames[f % s.frames.length];
      const cv = document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      const cx = cv.getContext('2d')!;
      cx.drawImage(this.img, sx, sy, w, h, 0, 0, w, h);
      c = { w, h, data: cx.getImageData(0, 0, w, h).data };
      this.pixelCache.set(key, c);
    }
    return { ...c, pivot: s.pivot };
  }
}
