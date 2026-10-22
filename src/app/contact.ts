// A debug screen: every sprite in the atlas, every frame, on the floor colour (docs/PLAN.md M6 "contact
// sheet"). Open it with __app.open('contact'); scroll with the mouse wheel.
import { PAL } from '../data/palette';
import { text } from '../ui/text';
import { rect } from '../render/prims';
import { VIEW } from '../render/view';
import type { App, Screen } from './app';

export class ContactScreen implements Screen {
  readonly name = 'contact';
  readonly cursor = 'pointer';
  private scroll = 0;

  constructor(private app: App) {}

  frame() {
    const ctx = this.app.world, atlas = this.app.atlas, inp = this.app.input;
    this.app.ui.begin();
    if (inp.pressed('WheelDown')) this.scroll += 40;
    if (inp.pressed('WheelUp')) this.scroll = Math.max(0, this.scroll - 40);
    if (inp.pressed('Escape')) this.app.open('title');
    rect(ctx, 0, 0, VIEW.w, VIEW.h, PAL.paper);
    let x = 4, y = 4 - this.scroll, row = 0;
    for (const [name, sp] of Object.entries(atlas.json.sprites)) {
      const w = Math.max(...sp.frames.map((f) => f[2])), h = Math.max(...sp.frames.map((f) => f[3]));
      const need = sp.frames.length * (w + 1) + 2;
      if (x + need > VIEW.w) {
        x = 4;
        y += row + 8;
        row = 0;
      }
      text(this.app.ui.ctx, name.replace(/_/g, ' '), x * 2, y * 2 - 2, PAL.iron, { scale: 1 });
      sp.frames.forEach((_, i) => atlas.draw(ctx, name, i, x + i * (w + 1) + sp.pivot[0], y + 6 + sp.pivot[1]));
      x += need + 4;
      row = Math.max(row, h + 6);
    }
  }
}
