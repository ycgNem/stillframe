// The title screen: the bot plays a level behind the menu (attract mode), under the time rule, so the
// first thing anyone sees is time stopping and starting.
import { botInput, newBot, type BotMemory } from '../bot/bot';
import { levelById } from '../data/levels';
import { PAL } from '../data/palette';
import { TICK_RATE } from '../data/tuning';
import { starCount } from '../meta/save';
import { Fx } from '../render/fx';
import { bigWidth, centerText, drawBig, drawText } from '../render/font';
import { LevelArt } from '../render/level';
import { dither, dither4, rect } from '../render/prims';
import { drawScene } from '../render/scene';
import { followCamera, newCamera, VIEW } from '../render/view';
import { createTime, updateTime, type TimeState } from '../sim/time';
import type { TickInput, World } from '../sim/types';
import { createWorld, NO_MODS, step } from '../sim/world';
import { coinIcon, star } from '../ui/kit';
import type { App, Screen } from './app';
import { MapScreen } from './map';
import { PlayScreen } from './play';
import { SettingsScreen } from './settings';
import { WorkshopScreen } from './workshop';

const ATTRACT = ['1-5', '1-3', '1-4', '1-7', '1-2'];

export class TitleScreen implements Screen {
  readonly name = 'title';
  readonly cursor = 'pointer';
  private world!: World;
  private bot!: BotMemory;
  private fx!: Fx;
  private art!: LevelArt;
  private time!: TimeState;
  private cam = newCamera();
  private next = 0;
  private input: TickInput | null = null;
  private endT = 0;

  constructor(private app: App) {
    this.load();
    app.sound.playing = true;
  }

  private load() {
    const def = levelById(ATTRACT[this.next++ % ATTRACT.length]);
    this.world = createWorld(def, NO_MODS);
    this.bot = newBot();
    this.fx = new Fx(this.app.atlas);
    this.art = new LevelArt(def);
    this.time = createTime();
    this.endT = 0;
    this.cam = newCamera();
  }

  scale(realDt: number): number {
    if (this.world.status !== 'play') {
      this.endT += realDt;
      this.fx.tick(realDt * 0.4);
      if (this.endT > 2) this.load();
      return 0;
    }
    this.input = botInput(this.world, this.bot);
    // the bot "thinks" between moves: every so often it stands still and time crawls
    const thinking = Math.floor(this.world.tick / 40) % 3 === 0;
    const moving = !thinking && (this.input.mx !== 0 || this.input.my !== 0);
    return updateTime(this.time, moving ? 1 : 0, realDt) * (thinking ? 1 : 0.85);
  }

  tick() {
    if (this.world.status !== 'play' || !this.input) return;
    const thinking = Math.floor(this.world.tick / 40) % 3 === 0;
    const inp = thinking ? { ...this.input, mx: 0, my: 0 } : this.input;
    for (const e of step(this.world, inp)) this.fx.event(e, this.world);
    this.fx.tick(1 / TICK_RATE, this.world);
  }

  frame(realDt: number, alpha: number) {
    const ctx = this.app.display.ctx, ui = this.app.ui, w = this.world, p = w.player;
    this.app.sound.update(realDt, this.time.scale);
    followCamera(this.cam, w, p.px + (p.x - p.px) * alpha, p.py + (p.y - p.py) * alpha, VIEW.w / 2, VIEW.h / 2, realDt);
    this.fx.real(realDt, this.cam, { x: 0, y: 0 });
    drawScene(ctx, w, this.art, this.app.atlas, this.fx, this.cam, alpha, { aim: p.aim, hoverItem: 0, now: this.app.now, showPlayer: true, aimReach: 0 });
    ui.begin();
    // the title band; the demo stays bright except behind the buttons
    dither4(ctx, 0, 0, VIEW.w, VIEW.h, PAL.ink);
    dither(ctx, VIEW.w / 2 - 58, 70, 116, 64, PAL.ink);
    rect(ctx, 0, 18, VIEW.w, 44, PAL.paper);
    rect(ctx, 0, 18, VIEW.w, 1, PAL.fog);
    rect(ctx, 0, 61, VIEW.w, 1, PAL.ash);
    const title = 'STILLFRAME';
    const tx = Math.round((VIEW.w - bigWidth(title, 3)) / 2);
    drawBig(ctx, title, tx + 2, 25, PAL.ash, 3);
    drawBig(ctx, title, tx, 23, PAL.ink, 3);
    // a crack of red through the last letters
    for (let i = 0; i < 6; i++) rect(ctx, tx + 150 + i * 3, 25 + i * 3 + (i % 2), 2, 1, PAL.red);
    centerText(ctx, 'TIME MOVES WHEN YOU MOVE', VIEW.w / 2, 51, PAL.tide);

    const bx = VIEW.w / 2 - 50;
    const started = Object.keys(this.app.save.levels).length > 0;
    // a fresh save goes straight into the first level; the map comes after
    if (ui.button('play', bx, 76, 100, 18, started ? 'CONTINUE' : 'PLAY', { primary: true, key: 'Enter', big: true })) this.app.goto(started ? new MapScreen(this.app) : new PlayScreen(this.app, '1-1', true));
    if (ui.button('workshop', bx, 98, 100, 14, 'WORKSHOP')) this.app.goto(new WorkshopScreen(this.app, '1-1'));
    if (ui.button('settings', bx, 116, 100, 14, 'SETTINGS')) this.app.goto(new SettingsScreen(this.app, null));

    const s = this.app.save;
    rect(ctx, 0, VIEW.h - 22, VIEW.w, 22, PAL.ink);
    star(ctx, 8, VIEW.h - 18, true);
    drawText(ctx, `${starCount(s)}/24`, 17, VIEW.h - 17, PAL.gold);
    coinIcon(ctx, 44, VIEW.h - 17);
    drawText(ctx, `${s.coins}`, 51, VIEW.h - 17, PAL.gold);
    drawText(ctx, 'WASD MOVE  MOUSE AIM  CLICK SHOOT/PUNCH  RIGHT CLICK THROW', 8, VIEW.h - 9, PAL.slate);
    const v = 'CHAPTER 1 OF 5';
    drawText(ctx, v, VIEW.w - 4 - v.length * 4, VIEW.h - 17, PAL.iron);
    ui.end();
  }
}
