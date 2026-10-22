// The tally after a clear (GAME_DESIGN §15): coin lines count up one by one, stars stamp in, game time
// against real time. Then Next, Retry, Map or the Workshop.
import { nextLevel } from '../data/levels';
import { PAL } from '../data/palette';
import { TICK_RATE } from '../data/tuning';
import type { Tally } from '../meta/tally';
import { centerBig, centerText, drawText, textWidth } from '../render/font';
import { rect } from '../render/prims';
import { VIEW } from '../render/view';
import { coinIcon, star } from '../ui/kit';
import type { App, Screen } from './app';
import { MapScreen } from './map';
import { PlayScreen } from './play';
import { WorkshopScreen } from './workshop';
import { EndScreen } from './end';

const LINE_TIME = 0.32;

export class TallyScreen implements Screen {
  readonly name = 'tally';
  readonly cursor = 'pointer';
  private t = 0;
  private shown = 0;
  private stamped = 0;

  constructor(
    private app: App,
    private play: PlayScreen,
    private result: Tally,
  ) {
    app.sound.playing = false;
  }

  frame(realDt: number) {
    const ctx = this.app.display.ctx, ui = this.app.ui, r = this.result, def = this.play.def;
    this.t += realDt;
    this.app.sound.update(realDt, 0.3);
    // skip the count-up with a click or Space; once it has played out, clicks belong to the buttons
    const counting = this.t < r.lines.length * LINE_TIME + 1.1;
    if (this.t > 0.2 && counting && (this.app.input.pressed('Mouse0') || this.app.input.pressed('Space'))) this.t = 99;
    rect(ctx, 0, 0, VIEW.w, VIEW.h, PAL.paper);
    for (let x = 0; x < VIEW.w; x += 16) rect(ctx, x, 0, 1, VIEW.h, PAL.fog);
    for (let y = 0; y < VIEW.h; y += 16) rect(ctx, 0, y, VIEW.w, 1, PAL.fog);
    ui.begin();
    rect(ctx, 0, 6, VIEW.w, 22, PAL.ink);
    centerBig(ctx, `${def.id} ${def.name}`, VIEW.w / 2, 9, PAL.paper);
    centerText(ctx, def.goal.kind === 'escape' ? 'ESCAPED' : def.goal.kind === 'survive' ? 'SURVIVED' : 'CLEARED', VIEW.w / 2, 19, PAL.cyan);

    // coin lines, one at a time
    const lines = Math.min(r.lines.length, Math.floor(this.t / LINE_TIME));
    if (lines > this.shown) {
      this.shown = lines;
      this.app.sound.play('coin', 0.7);
    }
    const x0 = 64, x1 = 256;
    let total = 0;
    for (let i = 0; i < lines; i++) {
      const l = r.lines[i], y = 36 + i * 9;
      drawText(ctx, l.label, x0, y, l.label.startsWith('NEW STAR') ? PAL.amber : PAL.iron);
      const n = `+${l.coins}`;
      drawText(ctx, n, x1 - textWidth(n), y, PAL.amber);
      total += l.coins;
    }
    const ly = 36 + r.lines.length * 9 + 2;
    if (lines === r.lines.length) {
      rect(ctx, x0, ly, x1 - x0, 1, PAL.ash);
      drawText(ctx, r.repeat ? 'TOTAL (REPEAT CLEAR: HALF PAY)' : 'TOTAL', x0, ly + 4, PAL.ink);
      const n = `${total}`;
      drawText(ctx, n, x1 - textWidth(n) - 7, ly + 4, PAL.amber);
      coinIcon(ctx, x1 - 5, ly + 4);
    }

    // stars, stamping in after the lines
    const after = this.t - r.lines.length * LINE_TIME - 0.2;
    const names = ['CLEAR', 'PAR', 'CHALLENGE'];
    const stamped = Math.max(0, Math.min(3, Math.floor(after / 0.3) + 1));
    if (after > 0 && stamped > this.stamped) {
      this.stamped = stamped;
      if (r.stars[stamped - 1]) this.app.sound.play('star');
    }
    for (let i = 0; i < 3; i++) {
      const sx = 8, sy = 37 + i * 16;
      const on = after > 0 && i < stamped && r.stars[i];
      star(ctx, sx, sy, on);
      drawText(ctx, names[i], sx + 10, sy + 1, on ? PAL.amber : PAL.ash);
      if (on && r.fresh[i]) drawText(ctx, 'NEW', sx + 10, sy + 8, PAL.tide);
    }
    const gs = (r.ticks / TICK_RATE).toFixed(1);
    drawText(ctx, `GAME ${gs} S / PAR ${def.par}`, x0, VIEW.h - 44, r.ticks / TICK_RATE <= def.par ? PAL.tide : PAL.slate);
    drawText(ctx, `REAL ${this.play.realTime.toFixed(1)} S`, x0 + 110, VIEW.h - 44, PAL.slate);
    if (r.best) drawText(ctx, 'NEW BEST TIME', x0, VIEW.h - 36, PAL.cyan);
    const next = nextLevel(def.id);
    const by = VIEW.h - 26;
    if (ui.button('next', 214, by, 90, 16, next ? 'NEXT  ENTER' : 'FINALE  ENTER', { primary: true, key: 'Enter' })) {
      this.app.goto(next ? new PlayScreen(this.app, next.id) : new EndScreen(this.app));
    }
    if (ui.button('retry', 150, by, 58, 16, 'RETRY  R', { key: 'KeyR' })) this.app.goto(new PlayScreen(this.app, def.id, true));
    if (ui.button('shop', 70, by, 74, 16, 'WORKSHOP  W', { key: 'KeyW' })) this.app.goto(new WorkshopScreen(this.app, def.id));
    if (ui.button('map', 16, by, 48, 16, 'MAP  ESC', { key: 'Escape' })) this.app.goto(new MapScreen(this.app, def.id));
    const bank = `BANK ${this.app.save.coins}`;
    drawText(ctx, bank, VIEW.w - textWidth(bank) - 16, VIEW.h - 36, PAL.amber);
    ui.end();
  }
}
