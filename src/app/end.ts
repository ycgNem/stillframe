// After the Manager falls: Chapter 1 is done. What you did, and what comes next.
import { CHAPTERS, COMING } from '../data/levels';
import { PAL } from '../data/palette';
import { starCount } from '../meta/save';
import { centerBig, centerText } from '../render/font';
import { rect } from '../render/prims';
import { VIEW } from '../render/view';
import type { App, Screen } from './app';
import { MapScreen } from './map';
import { WorkshopScreen } from './workshop';

export class EndScreen implements Screen {
  readonly name = 'end';
  readonly cursor = 'pointer';
  private t = 0;

  constructor(private app: App) {
    app.sound.playing = false;
  }

  frame(realDt: number) {
    const ctx = this.app.display.ctx, ui = this.app.ui, s = this.app.save;
    this.t += realDt;
    this.app.sound.update(realDt, 0.3);
    ui.begin();
    rect(ctx, 0, 0, VIEW.w, VIEW.h, PAL.paper);
    for (let y = 0; y < VIEW.h; y += 16) rect(ctx, 0, y, VIEW.w, 1, PAL.fog);
    rect(ctx, 0, 20, VIEW.w, 30, PAL.ink);
    centerBig(ctx, 'CHAPTER 1 COMPLETE', VIEW.w / 2, 24, PAL.paper);
    centerText(ctx, `${CHAPTERS[0].name}: YOU CLOCKED OUT`, VIEW.w / 2, 38, PAL.cyan);
    const lines = [
      `STARS ${starCount(s)} OF ${CHAPTERS[0].levels.length * 3}`,
      `COINS EARNED ${s.earned}`,
      `TIMES SHATTERED ${s.deaths}`,
      `REAL TIME PLAYED ${Math.floor(s.played / 60)} MIN ${Math.floor(s.played % 60)} S`,
    ];
    lines.forEach((l, i) => {
      if (this.t > 0.4 + i * 0.3) centerText(ctx, l, VIEW.w / 2, 62 + i * 9, PAL.iron);
    });
    if (this.t > 1.8) {
      centerText(ctx, `NEXT: CHAPTER ${COMING[0].n}, ${COMING[0].name}. COMING SOON.`, VIEW.w / 2, 104, PAL.red);
      centerText(ctx, 'MISSING STARS? REPLAY LEVELS FOR THEM, AND FOR COINS.', VIEW.w / 2, 114, PAL.slate);
    }
    if (ui.button('map', VIEW.w / 2 - 94, 136, 90, 16, 'CHAPTER MAP', { primary: true, key: 'Enter' })) this.app.goto(new MapScreen(this.app, '1-8'));
    if (ui.button('shop', VIEW.w / 2 + 4, 136, 90, 16, 'WORKSHOP')) this.app.goto(new WorkshopScreen(this.app, '1-8'));
    centerText(ctx, 'THANKS FOR PLAYING STILLFRAME', VIEW.w / 2, 166, PAL.ash);
    ui.end();
  }
}
