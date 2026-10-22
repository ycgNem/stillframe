// Fixed-step loop whose step rate follows the time rule. Each frame asks `scale(realDt)` how many game
// seconds pass per real second, runs the whole ticks that buys, then draws with `alpha` = how far we
// are into the next tick, so a world crawling at 3% speed still glides on screen instead of stepping.
// Adapted from pixel-rts's GameLoop.

export interface LoopHooks {
  /** game seconds per real second for this frame (0 = frozen) */
  scale(realDt: number): number;
  tick(): void;
  frame(realDt: number, alpha: number): void;
}

const MAX_STEPS = 8;

export class TimeLoop {
  private acc = 0;
  private last = 0;
  private raf = 0;

  constructor(
    private tickRate: number,
    private hooks: LoopHooks,
  ) {}

  start() {
    this.last = performance.now();
    const step = (now: number) => {
      this.raf = requestAnimationFrame(step);
      const realDt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.advance(realDt);
      this.hooks.frame(realDt, Math.min(1, this.acc * this.tickRate));
    };
    this.raf = requestAnimationFrame(step);
  }

  stop() {
    cancelAnimationFrame(this.raf);
  }

  /** Drop any partial tick, so a restarted world doesn't begin mid-step. */
  reset() {
    this.acc = 0;
  }

  private advance(realDt: number) {
    const dt = 1 / this.tickRate;
    this.acc += realDt * this.hooks.scale(realDt);
    let steps = 0;
    while (this.acc >= dt && steps < MAX_STEPS) {
      this.hooks.tick();
      this.acc -= dt;
      steps++;
    }
    if (steps >= MAX_STEPS) this.acc = 0;
  }
}
