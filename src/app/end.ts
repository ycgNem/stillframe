// After a chapter's boss falls: what you did in the chapter and what comes next. After the last chapter it
// leads to the ending (credits.ts).
import { CHAPTERS } from '../data/levels';
import { PAL } from '../data/palette';
import { TICK_RATE } from '../data/tuning';
import { record } from '../meta/save';
import { rect } from '../render/prims';
import { bigStar, UI } from '../ui/kit';
import { text } from '../ui/text';
import type { App, Screen } from './app';
import { CreditsScreen } from './credits';
import { MapScreen } from './map';
import { WorkshopScreen } from './workshop';

export class EndScreen implements Screen {
  readonly name = 'end';
  readonly cursor = 'pointer';
  private t = 0;
  private chapter: number;

  constructor(
    private app: App,
    /** the boss level just cleared */
    private levelId = CHAPTERS[0].levels[CHAPTERS[0].levels.length - 1].id,
  ) {
    app.sound.playing = false;
    this.chapter = Math.max(0, CHAPTERS.findIndex((c) => c.levels.some((l) => l.id === levelId)));
  }

  frame(realDt: number) {
    const ui = this.app.ui, ctx = ui.ctx, s = this.app.save;
    const ch = CHAPTERS[this.chapter], next = CHAPTERS[this.chapter + 1];
    this.t += realDt;
    this.app.sound.update(realDt, 0.3);
    rect(this.app.world, 0, 0, 320, 180, PAL.paper);
    ui.begin();
    rect(ctx, 0, 0, UI.w, UI.h, PAL.paper);
    for (let y = 0; y < UI.h; y += 16) rect(ctx, 0, y, UI.w, 1, PAL.fog);
    rect(ctx, 0, 34, UI.w, 70, PAL.ink);
    rect(ctx, 0, 36, UI.w, 66, PAL.paper);
    rect(ctx, 0, 98, UI.w, 4, PAL.red);
    text(ctx, `CHAPTER ${ch.n} COMPLETE`, UI.w / 2, 46, PAL.ink, { face: 'shard', scale: 2, align: 'center' });
    text(ctx, `${ch.name}: ${ch.outro}`, UI.w / 2, 80, PAL.tide, { align: 'center' });

    const stars = ch.levels.reduce((n, l) => n + record(s, l.id).stars.filter(Boolean).length, 0);
    const time = ch.levels.reduce((n, l) => n + record(s, l.id).best, 0) / TICK_RATE;
    const rows: [string, string][] = [
      ['Stars', `${stars} of ${ch.levels.length * 3}`],
      ['Best times, added up', `${time.toFixed(1)} game seconds`],
      ['Coins earned in all', `${s.earned}`],
      ['Times shattered', `${s.deaths}`],
      ['Real time played', `${Math.floor(s.played / 60)} min ${Math.floor(s.played % 60)} s`],
    ];
    const cw = 360, cx = (UI.w - cw) / 2;
    ui.card(cx, 120, cw, 30 + rows.length * 18);
    rows.forEach(([a, b], i) => {
      if (this.t < 0.3 + i * 0.25) return;
      const y = 134 + i * 18;
      text(ctx, a, cx + 16, y, PAL.iron);
      text(ctx, b, cx + cw - 16, y, PAL.ink, { align: 'right' });
    });
    for (let i = 0; i < Math.min(5, Math.ceil(stars / (ch.levels.length * 3 / 5))); i++) if (this.t > 1.6) bigStar(ctx, UI.w / 2 - 44 + i * 18, 236, true);
    if (this.t > 1.8) {
      const line = next ? `Next: Chapter ${next.n}, ${next.name}. ${next.teaser}` : 'That was the last chapter.';
      text(ctx, line, UI.w / 2, 260, next ? PAL.blood : PAL.ink, { align: 'center' });
      text(ctx, 'Missing stars? Replay levels for them, and for coins.', UI.w / 2, 276, PAL.iron, { align: 'center' });
    }
    const bw = 170, gap = 10, total = bw * 3 + gap * 2, bx = (UI.w - total) / 2, by = UI.h - 50;
    if (ui.button('map', bx, by, bw, 30, 'Chapter map', { cap: 'Esc', key: 'Escape' })) this.app.goto(new MapScreen(this.app, this.levelId));
    if (ui.button('shop', bx + bw + gap, by, bw, 30, 'Workshop', { cap: 'W', key: 'KeyW' })) this.app.goto(new WorkshopScreen(this.app, this.levelId));
    const go = next ? `Chapter ${next.n}` : 'The ending';
    if (ui.button('next', bx + (bw + gap) * 2, by, bw, 30, go, { kind: 'primary', cap: 'Enter', key: 'Enter' })) {
      this.app.goto(next ? new MapScreen(this.app, next.levels[0].id) : new CreditsScreen(this.app));
    }
    ui.end();
  }
}
