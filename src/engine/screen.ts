// Pixel-perfect output: the game draws on a fixed-size canvas, shown at the largest whole number of
// *device* pixels per game pixel that fits the window, so 125% Windows display scaling stays crisp.

export class Screen {
  readonly ctx: CanvasRenderingContext2D;
  /** device pixels per game pixel */
  scale = 1;

  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly w: number,
    readonly h: number,
  ) {
    canvas.width = w;
    canvas.height = h;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
    addEventListener('resize', this.fit);
    this.fit();
  }

  private fit = () => {
    const dpr = devicePixelRatio || 1;
    this.scale = Math.max(1, Math.floor(Math.min((innerWidth * dpr) / this.w, (innerHeight * dpr) / this.h)));
    this.canvas.style.width = `${(this.w * this.scale) / dpr}px`;
    this.canvas.style.height = `${(this.h * this.scale) / dpr}px`;
  };

  /** Client (CSS pixel) coordinates to game pixels. */
  toView(clientX: number, clientY: number) {
    const r = this.canvas.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * this.w, y: ((clientY - r.top) / r.height) * this.h };
  }
}
