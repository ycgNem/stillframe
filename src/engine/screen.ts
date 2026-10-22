// Pixel-perfect output in two layers. The world is drawn on a 320×180 canvas and shown at the largest
// whole number of *device* pixels per game pixel that fits the window (so 125% Windows display scaling
// stays crisp). Text and menus are drawn on a second canvas at twice that resolution, 640×360 "UI
// pixels", so letters can have real shapes (docs/STYLE.md §8). Both are copied to the visible canvas
// every frame with smoothing off.

export class Screen {
  /** the visible canvas, in device pixels */
  readonly ctx: CanvasRenderingContext2D;
  /** the world layer, in game pixels */
  readonly world: CanvasRenderingContext2D;
  /** the UI layer, in UI pixels (UI × game pixels) */
  readonly ui: CanvasRenderingContext2D;
  /** device pixels per game pixel */
  scale = 1;

  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly w: number,
    readonly h: number,
    readonly uiScale = 2,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.world = layer(w, h);
    this.ui = layer(w * uiScale, h * uiScale);
    addEventListener('resize', this.fit);
    this.fit();
  }

  private fit = () => {
    const dpr = devicePixelRatio || 1;
    // at least 2, so a UI pixel is never smaller than a device pixel; a tiny window shrinks it in CSS
    this.scale = Math.max(2, Math.floor(Math.min((innerWidth * dpr) / this.w, (innerHeight * dpr) / this.h)));
    this.canvas.width = this.w * this.scale;
    this.canvas.height = this.h * this.scale;
    const css = Math.min(this.scale / dpr, innerWidth / this.w, innerHeight / this.h);
    this.canvas.style.width = `${this.w * css}px`;
    this.canvas.style.height = `${this.h * css}px`;
    this.ctx.imageSmoothingEnabled = false;
  };

  /** Starts a frame: the UI layer is cleared (the world is always painted edge to edge). */
  begin() {
    this.ui.clearRect(0, 0, this.ui.canvas.width, this.ui.canvas.height);
  }

  /** Puts both layers on the visible canvas. */
  present() {
    const W = this.canvas.width, H = this.canvas.height;
    this.ctx.drawImage(this.world.canvas, 0, 0, W, H);
    this.ctx.drawImage(this.ui.canvas, 0, 0, W, H);
  }

  /** Client (CSS pixel) coordinates to game pixels. */
  toView(clientX: number, clientY: number) {
    const r = this.canvas.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * this.w, y: ((clientY - r.top) / r.height) * this.h };
  }
}

function layer(w: number, h: number): CanvasRenderingContext2D {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return ctx;
}
