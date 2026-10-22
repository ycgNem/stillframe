// "STILL. FRAME." (GAME_DESIGN §13): your clear, replayed from its recorded inputs at real speed (60 ticks
// per real second, all the frozen thinking cut out), with the chant. Hold Space for ×2; any other key or
// a click skips to the tally.
import { PAL } from '../data/palette';
import { TICK_RATE } from '../data/tuning';
import { applyClear, record } from '../meta/save';
import { tally } from '../meta/tally';
import { Fx } from '../render/fx';
import { centerBig, centerText } from '../render/font';
import { LevelArt } from '../render/level';
import { rect } from '../render/prims';
import { drawScene } from '../render/scene';
import { followCamera, newCamera, VIEW } from '../render/view';
import type { World } from '../sim/types';
import { createWorld, step } from '../sim/world';
import type { App, Screen } from './app';
import { playEvent } from './events';
import type { PlayScreen } from './play';
import { TallyScreen } from './tally';

const WORD_TIME = 0.6;

export class ReplayScreen implements Screen {
  readonly name = 'replay';
  readonly cursor = 'none';
  private world: World;
  private fx: Fx;
  private art: LevelArt;
  private cam = newCamera();
  private i = 0;
  private t = 0;
  private word = -1;
  private done = 0;

  constructor(
    private app: App,
    private play: PlayScreen,
  ) {
    this.world = createWorld(play.def, play.mods);
    this.fx = new Fx(app.atlas);
    this.art = new LevelArt(play.def);
    // bank the result now, so quitting during the replay loses nothing
    const t = tally(play.world, record(app.save, play.def.id));
    applyClear(app.save, play.def.id, t);
    app.persist();
    this.tallyResult = t;
  }

  private tallyResult: ReturnType<typeof tally>;

  scale(): number {
    const inp = this.app.input;
    if (inp.any && !inp.down('Space')) {
      this.finish();
      return 0;
    }
    return this.i < this.play.rec.length ? (inp.down('Space') ? 2 : 1) : 0;
  }

  tick() {
    if (this.i >= this.play.rec.length) return;
    const events = step(this.world, this.play.rec[this.i++]);
    this.fx.tick(1 / TICK_RATE, this.world);
    for (const e of events) {
      playEvent(this.app.sound, e, 'replay');
      this.fx.event(e, this.world);
    }
  }

  private finish() {
    this.app.goto(new TallyScreen(this.app, this.play, this.tallyResult));
  }

  frame(realDt: number, alpha: number) {
    const ctx = this.app.display.ctx, w = this.world, p = w.player;
    this.t += realDt;
    this.app.sound.update(realDt, 1);
    if (this.i >= this.play.rec.length) {
      this.done += realDt;
      if (this.done > 1.0) {
        this.finish();
        return;
      }
    }
    const px = p.px + (p.x - p.px) * alpha, py = p.py + (p.y - p.py) * alpha;
    followCamera(this.cam, w, px, py, VIEW.w / 2, VIEW.h / 2, realDt, this.t === realDt);
    this.fx.real(realDt, this.cam, { x: 0, y: 0 });
    drawScene(ctx, w, this.art, this.app.atlas, this.fx, this.cam, alpha, { aim: p.aim, hoverItem: 0, now: this.app.now, showPlayer: true, aimReach: 0 });
    // the chant, alternating in real time
    const word = Math.floor(this.t / WORD_TIME);
    if (word !== this.word) {
      this.word = word;
      this.app.sound.chant(word % 2 ? 'FRAME' : 'STILL');
    }
    // the words sit at the edges, outlined, so the replay itself stays in view: STILL. up top, FRAME. below
    const label = word % 2 ? 'FRAME.' : 'STILL.';
    const k = (this.t % WORD_TIME) / WORD_TIME;
    if (k < 0.75) {
      const y = word % 2 ? VIEW.h - 38 : 8;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [2, 2]]) centerBig(ctx, label, VIEW.w / 2 + dx, y + dy, PAL.ink, 3);
      centerBig(ctx, label, VIEW.w / 2, y, PAL.paper, 3);
    }
    rect(ctx, 0, VIEW.h - 10, VIEW.w, 10, PAL.ink);
    centerText(ctx, `HOLD SPACE: X2   ANY KEY: SKIP   ${(this.i / TICK_RATE).toFixed(1)} S`, VIEW.w / 2, VIEW.h - 8, PAL.slate);
  }
}
