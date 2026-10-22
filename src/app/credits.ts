// The ending and the credits, after the last boss (GAME_DESIGN §15): a few lines of story over a white
// room, then the names rolling up. Any key or click speeds it up; Esc leaves.
import { PAL } from '../data/palette';
import { rect } from '../render/prims';
import { UI } from '../ui/kit';
import { text } from '../ui/text';
import type { App, Screen } from './app';
import { TitleScreen } from './title';

const ENDING = [
  'The frame broke.',
  '',
  'Somewhere a clock started again,',
  'and nobody else noticed it had stopped.',
  '',
  'You were the only thing that moved.',
  'Now everything does.',
];

const CREDITS: [string, string][] = [
  ['STILLFRAME', ''],
  ['', ''],
  ['A game by', 'ycgNem'],
  ['Design, code, art and sound', 'ycgNem with Claude'],
  ['Inspired by', 'SUPERHOT, which you should play'],
  ['', ''],
  ['Made with', 'TypeScript, Vite, a Canvas and WebAudio'],
  ['Every sprite', 'drawn pixel by pixel in Python'],
  ['Every sound', 'synthesized, no samples'],
  ['', ''],
  ['Thank you for playing', ''],
];

export class CreditsScreen implements Screen {
  readonly name = 'credits';
  readonly cursor = 'none';
  private t = 0;

  constructor(private app: App) {
    app.sound.playing = false;
  }

  frame(realDt: number) {
    const ui = this.app.ui, ctx = ui.ctx, inp = this.app.input;
    const fast = inp.down('Space') || inp.down('Mouse0');
    this.t += realDt * (fast ? 4 : 1);
    this.app.sound.update(realDt, 0.2);
    if (inp.pressed('Escape') || this.t > 44) {
      this.app.goto(new TitleScreen(this.app));
      return;
    }
    rect(this.app.world, 0, 0, 320, 180, PAL.paper);
    ui.begin();
    rect(ctx, 0, 0, UI.w, UI.h, PAL.paper);
    if (this.t < 14) {
      ENDING.forEach((l, i) => {
        const at = 1 + i * 1.2;
        if (this.t < at || !l) return;
        text(ctx, l, UI.w / 2, 110 + i * 18, this.t - at < 0.15 ? PAL.stone : PAL.ink, { align: 'center' });
      });
    } else {
      const y0 = UI.h - (this.t - 14) * 30;
      CREDITS.forEach(([a, b], i) => {
        const y = y0 + i * 30;
        if (y < -20 || y > UI.h) return;
        if (i === 0) text(ctx, a, UI.w / 2, y, PAL.ink, { face: 'shard', scale: 2, align: 'center' });
        else if (!b) text(ctx, a, UI.w / 2, y, PAL.tide, { align: 'center' });
        else {
          text(ctx, a, UI.w / 2, y, PAL.iron, { align: 'center' });
          text(ctx, b, UI.w / 2, y + 12, PAL.ink, { align: 'center' });
        }
      });
    }
    text(ctx, 'Hold [Space] to hurry · [Esc] leaves', UI.w - 10, UI.h - 16, PAL.ash, { align: 'right' });
    ui.end();
  }
}
