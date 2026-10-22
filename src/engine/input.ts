// Keyboard and mouse state. Keys are KeyboardEvent.code (layout-independent, so WASD sits in the same
// place on AZERTY); mouse buttons are 'Mouse0', 'Mouse1', 'Mouse2', the wheel 'WheelUp' / 'WheelDown'.
// `pressed` is edge-triggered: true once per press, until read or until the frame ends.

export class Input {
  private held = new Set<string>();
  private presses = new Set<string>();
  /** mouse position in game pixels */
  mouse = { x: 160, y: 90 };
  /** any key or click this frame (for "press any key") */
  any = false;
  /** the first gesture unlocks audio */
  onGesture: () => void = () => {};

  constructor(target: HTMLCanvasElement, toView: (clientX: number, clientY: number) => { x: number; y: number }) {
    addEventListener('keydown', (e) => {
      if (!e.repeat) {
        this.presses.add(e.code);
        this.any = true;
      }
      this.held.add(e.code);
      this.onGesture();
      if (e.code === 'Space' || e.code.startsWith('Arrow') || e.code === 'Tab' || e.code === 'F3') e.preventDefault();
    });
    addEventListener('keyup', (e) => this.held.delete(e.code));
    addEventListener('blur', () => this.held.clear());
    addEventListener('mousemove', (e) => {
      this.mouse = toView(e.clientX, e.clientY);
    });
    addEventListener('mousedown', (e) => {
      this.mouse = toView(e.clientX, e.clientY);
      this.presses.add(`Mouse${e.button}`);
      this.held.add(`Mouse${e.button}`);
      this.any = true;
      this.onGesture();
    });
    addEventListener('mouseup', (e) => this.held.delete(`Mouse${e.button}`));
    addEventListener('wheel', (e) => {
      if (e.deltaY) this.presses.add(e.deltaY > 0 ? 'WheelDown' : 'WheelUp');
    }, { passive: true });
    addEventListener('contextmenu', (e) => e.preventDefault());
  }

  down(code: string) {
    return this.held.has(code);
  }

  pressed(code: string) {
    return this.presses.delete(code);
  }

  /** Forget this frame's presses (called once per frame, after the screen has read what it wants). */
  endFrame() {
    this.presses.clear();
    this.any = false;
  }

  /** Forget everything held or pressed (switching screens). */
  clear() {
    this.presses.clear();
    this.any = false;
  }
}
