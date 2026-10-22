// The title screen: the bot plays a level behind the menu (attract mode), under the time rule, so the
// first thing anyone sees is time stopping and starting. Paper bands over it carry the name and the menu.
import { botInput, newBot, type BotMemory } from '../bot/bot';
import { CHAPTERS, LEVELS, levelById } from '../data/levels';
import { PAL } from '../data/palette';
import { TICK_RATE } from '../data/tuning';
import { gauntletOpen, starCount } from '../meta/save';
import { Fx } from '../render/fx';
import { LevelArt } from '../render/level';
import { rect } from '../render/prims';
import { drawScene } from '../render/scene';
import { followCamera, newCamera, VIEW } from '../render/view';
import { createTime, updateTime, type TimeState } from '../sim/time';
import type { TickInput, World } from '../sim/types';
import { createWorld, NO_MODS, step } from '../sim/world';
import { icon, plate, UI } from '../ui/kit';
import { measure, rich, text } from '../ui/text';
import type { App, Screen } from './app';
import { GauntletScreen } from './gauntlet';
import { keyLabel } from './keys';
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
    // the attract mode plays levels you have reached, so it never spoils what's ahead
    const reached = LEVELS.filter((l) => this.app.save.levels[l.id]?.clears).map((l) => l.id);
    const pool = [...ATTRACT, ...reached.filter((id) => !id.endsWith('-8'))];
    const def = levelById(pool[this.next++ % pool.length]);
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
      if (this.endT > 2 || this.world.tick > TICK_RATE * 90) this.load();
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
    const ui = this.app.ui, ctx = ui.ctx, w = this.world, p = w.player, s = this.app.save;
    this.app.sound.update(realDt, this.time.scale);
    followCamera(this.cam, w, p.px + (p.x - p.px) * alpha, p.py + (p.y - p.py) * alpha, VIEW.w / 2, VIEW.h / 2, realDt);
    this.fx.real(realDt, this.cam, { x: 0, y: 0 });
    drawScene(this.app.world, w, this.art, this.app.atlas, this.fx, this.cam, alpha, { aim: p.aim, hoverItem: 0, now: this.app.now, showPlayer: true, aimReach: 0 });
    ui.begin();

    // the name, on a paper band with ink rules
    rect(ctx, 0, 26, UI.w, 104, PAL.ink);
    rect(ctx, 0, 28, UI.w, 100, PAL.paper);
    rect(ctx, 0, 124, UI.w, 4, PAL.red);
    const title = 'STILLFRAME';
    const tw = measure(title, 'shard', 4);
    const tx = Math.round((UI.w - tw) / 2);
    text(ctx, title, tx + 4, 42, PAL.ash, { face: 'shard', scale: 4 });
    text(ctx, title, tx, 38, PAL.ink, { face: 'shard', scale: 4 });
    // a crack of red glass through the last letters
    const cx = tx + tw - 96;
    for (let i = 0; i < 14; i++) rect(ctx, cx + i * 6 + (i % 2) * 2, 40 + i * 3 + (i % 3), 4, 2, i % 4 === 1 ? PAL.hot : PAL.red);
    text(ctx, 'Time moves when you move.', UI.w / 2, 98, PAL.tide, { align: 'center' });

    // the menu, on a card at the left so the demo stays in view
    const started = Object.keys(s.levels).length > 0;
    const mx = 24, my = 150, mw = 200;
    const rows = 4;
    ui.card(mx, my, mw, 20 + rows * 36);
    let y = my + 12;
    // a fresh save goes straight into the first level; the map comes after
    if (ui.button('play', mx + 12, y, mw - 24, 30, started ? 'CONTINUE' : 'PLAY', { kind: 'primary', key: 'Enter', face: 'shard' })) {
      this.app.goto(started ? new MapScreen(this.app) : new PlayScreen(this.app, '1-1', true));
    }
    y += 36;
    const gOpen = gauntletOpen(s);
    // the Gauntlet, with the best wave so far
    const gLabel = !gOpen ? '{lock} Gauntlet' : s.gauntlet.best ? `Gauntlet · best ${s.gauntlet.best}` : 'Gauntlet';
    if (ui.button('gauntlet', mx + 12, y, mw - 24, 28, gLabel, { enabled: gOpen })) this.app.goto(new GauntletScreen(this.app));
    y += 36;
    if (ui.button('workshop', mx + 12, y, mw - 24, 28, 'Workshop')) this.app.goto(new WorkshopScreen(this.app, null));
    y += 36;
    if (ui.button('settings', mx + 12, y, mw - 24, 28, 'Settings')) this.app.goto(new SettingsScreen(this.app, null));
    if (!gOpen && ui.over(mx + 12, my + 48, mw - 24, 28)) rich(ctx, 'Opens when Chapter 2 is done', mx + mw + 10, my + 57, { color: PAL.iron });

    // what you have, and how to play, along the bottom
    const k = s.settings.keys;
    rect(ctx, 0, UI.h - 30, UI.w, 30, PAL.ink);
    rect(ctx, 0, UI.h - 28, UI.w, 28, PAL.paper);
    const total = LEVELS.length * 3;
    let bx = 14;
    icon(ctx, 'star', bx, UI.h - 18);
    bx += 12;
    bx += text(ctx, `${starCount(s)}/${total}`, bx, UI.h - 18, PAL.ink) + 14;
    icon(ctx, 'coin', bx, UI.h - 18);
    bx += 12;
    text(ctx, `${s.coins}`, bx, UI.h - 18, PAL.ink);
    rich(ctx, `[${keyLabel(k.up)}][${keyLabel(k.left)}][${keyLabel(k.down)}][${keyLabel(k.right)}] move   [LMB] shoot or punch   [RMB] throw   [Esc] pause`, UI.w - 14, UI.h - 18, { color: PAL.iron, align: 'right' });
    const done = CHAPTERS.filter((c) => s.levels[c.levels[c.levels.length - 1].id]?.clears).length;
    const tag = done ? `${done} of ${CHAPTERS.length} chapters done` : `${CHAPTERS.length} ${CHAPTERS.length === 1 ? 'chapter' : 'chapters'}, ${LEVELS.length} levels`;
    plate(ctx, UI.w - measure(tag) - 30, UI.h - 52, measure(tag) + 16, 16, PAL.ink, null);
    text(ctx, tag, UI.w - measure(tag) - 22, UI.h - 48, PAL.paper);
    ui.end();
  }
}
