// The tally after a clear (GAME_DESIGN §15): coin lines count up one by one, stars stamp in, game time
// against real time. Then Next, Retry, Map or the Workshop.
import { nextLevel } from '../data/levels';
import { PAL } from '../data/palette';
import { TICK_RATE } from '../data/tuning';
import type { Tally } from '../meta/tally';
import { rect } from '../render/prims';
import { bigStar, icon, plate, UI } from '../ui/kit';
import { measure, text } from '../ui/text';
import type { App, Screen } from './app';
import { EndScreen } from './end';
import { keyLabel } from './keys';
import { MapScreen } from './map';
import { PlayScreen } from './play';
import { WorkshopScreen } from './workshop';

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
    const ui = this.app.ui, ctx = ui.ctx, r = this.result, def = this.play.def;
    this.t += realDt;
    this.app.sound.update(realDt, 0.3);
    // skip the count-up with a click or Space; once it has played out, clicks belong to the buttons
    const counting = this.t < r.lines.length * LINE_TIME + 1.1;
    if (this.t > 0.2 && counting && (this.app.input.pressed('Mouse0') || this.app.input.pressed('Space'))) this.t = 99;
    rect(this.app.world, 0, 0, 320, 180, PAL.paper);
    ui.begin();
    rect(ctx, 0, 0, UI.w, UI.h, PAL.paper);
    for (let x = 0; x < UI.w; x += 16) rect(ctx, x, 0, 1, UI.h, PAL.fog);
    for (let y = 0; y < UI.h; y += 16) rect(ctx, 0, y, UI.w, 1, PAL.fog);

    // the header: the level's name and what you did
    rect(ctx, 0, 14, UI.w, 44, PAL.ink);
    rect(ctx, 0, 16, UI.w, 40, PAL.paper);
    rect(ctx, 0, 54, UI.w, 2, PAL.cyan);
    const word = def.goal.kind === 'escape' ? 'Escaped' : def.goal.kind === 'survive' ? 'Survived' : 'Cleared';
    const title = `${def.id} ${def.name.toUpperCase()}`;
    const tw = measure(title, 'shard') + 12 + measure(word) + 8;
    const tx = Math.round((UI.w - tw) / 2);
    text(ctx, title, tx, 26, PAL.ink, { face: 'shard' });
    ui.chip(tx + measure(title, 'shard') + 12, 26, word, PAL.cyan);

    // stars, stamping in after the lines
    const after = this.t - r.lines.length * LINE_TIME - 0.2;
    const names = ['Clear', 'Par', 'Challenge'];
    const stamped = Math.max(0, Math.min(3, Math.floor(after / 0.3) + 1));
    if (after > 0 && stamped > this.stamped) {
      this.stamped = stamped;
      if (r.stars[stamped - 1]) this.app.sound.play('star');
    }
    ui.card(24, 72, 168, 196);
    for (let i = 0; i < 3; i++) {
      const sx = 36, sy = 84 + i * 60;
      const on = after > 0 && i < stamped && r.stars[i];
      bigStar(ctx, sx, sy, on, 2);
      text(ctx, names[i], sx + 34, sy + 4, on ? PAL.ink : PAL.stone);
      if (on && r.fresh[i]) ui.chip(sx + 34, sy + 16, 'New', PAL.gold);
      else if (i === 2) text(ctx, on ? 'Done' : 'Not this time', sx + 34, sy + 18, PAL.iron);
    }

    // coin lines, one at a time
    const lines = Math.min(r.lines.length, Math.floor(this.t / LINE_TIME));
    if (lines > this.shown) {
      this.shown = lines;
      this.app.sound.play('coin', 0.7);
    }
    const cx = 206, cw = 410;
    ui.card(cx, 72, cw, 196);
    let total = 0;
    for (let i = 0; i < lines; i++) {
      const l = r.lines[i], y = 84 + i * 15;
      const star = l.label.startsWith('New star');
      text(ctx, l.label, cx + 12, y, star ? PAL.amber : PAL.ink);
      text(ctx, `+${l.coins}`, cx + cw - 12, y, PAL.amber, { align: 'right' });
      total += l.coins;
    }
    const ly = 84 + r.lines.length * 15 + 4;
    if (lines === r.lines.length) {
      rect(ctx, cx + 12, ly, cw - 24, 2, PAL.ink);
      text(ctx, r.repeat ? 'Total (a repeat clear pays half)' : 'Total', cx + 12, ly + 8, PAL.ink);
      const n = `${total}`;
      text(ctx, n, cx + cw - 12, ly + 6, PAL.ink, { face: 'shard', align: 'right' });
      icon(ctx, 'coin', cx + cw - 24 - measure(n, 'shard'), ly + 8);
    }
    const gs = r.ticks / TICK_RATE;
    const ty = 236;
    rect(ctx, cx + 12, ty - 6, cw - 24, 1, PAL.fog);
    text(ctx, `Game ${gs.toFixed(1)} s`, cx + 12, ty, def.goal.kind === 'survive' || gs <= def.par ? PAL.tide : PAL.ink);
    if (def.goal.kind !== 'survive') text(ctx, ` / par ${def.par}`, cx + 12 + measure(`Game ${gs.toFixed(1)} s`), ty, PAL.iron);
    text(ctx, `Real ${this.play.realTime.toFixed(1)} s`, cx + 180, ty, PAL.iron);
    if (r.best) ui.chip(cx + cw - 12 - measure('New best time') - 8, ty - 2, 'New best time', PAL.cyan);
    const bank = `Bank ${this.app.save.coins}`;
    text(ctx, bank, cx + cw - 12, 276, PAL.amber, { align: 'right' });

    // where next
    const next = nextLevel(def.id);
    const chapterEnd = !next || next.id.split('-')[0] !== def.id.split('-')[0];
    const by = UI.h - 46;
    plate(ctx, 0, by - 8, UI.w, 54, PAL.ink, null);
    rect(ctx, 0, by - 6, UI.w, 52, PAL.paper);
    if (ui.button('map', 24, by, 110, 30, 'Map', { cap: 'Esc', key: 'Escape' })) this.app.goto(new MapScreen(this.app, def.id));
    if (ui.button('shop', 144, by, 150, 30, 'Workshop', { cap: 'W', key: 'KeyW' })) this.app.goto(new WorkshopScreen(this.app, def.id));
    const rk = this.app.save.settings.keys.restart;
    if (ui.button('retry', 304, by, 120, 30, 'Retry', { cap: keyLabel(rk), key: rk })) this.app.goto(new PlayScreen(this.app, def.id, true));
    if (ui.button('next', 434, by, 182, 30, chapterEnd ? 'Onward' : 'Next level', { kind: 'primary', cap: 'Enter', key: 'Enter' })) {
      this.app.goto(chapterEnd ? new EndScreen(this.app, def.id) : new PlayScreen(this.app, next!.id));
    }
    ui.end();
  }
}
