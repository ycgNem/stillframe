// The chapter map (GAME_DESIGN §15): level nodes on a pixel floor plan, stars per node, the Workshop
// door. Levels unlock in order; chapters 2–5 show as locked doors.
import { CHAPTERS, COMING } from '../data/levels';
import type { LevelDef } from '../data/levels/types';
import { PAL } from '../data/palette';
import { TICK_RATE } from '../data/tuning';
import { isUnlocked, record, starCount } from '../meta/save';
import { centerBig, centerText, drawText, textWidth, wrap } from '../render/font';
import { dither4, frame, line, rect } from '../render/prims';
import { VIEW } from '../render/view';
import { coinIcon, star } from '../ui/kit';
import type { App, Screen } from './app';
import { PlayScreen } from './play';
import { TitleScreen } from './title';
import { WorkshopScreen } from './workshop';

/** Where each level sits on the floor plan (view pixels, node centres). */
const NODES: Record<string, [number, number]> = {
  '1-1': [34, 136], '1-2': [80, 136], '1-3': [126, 118], '1-4': [172, 136], '1-5': [218, 118],
  '1-6': [264, 98], '1-7': [218, 70], '1-8': [150, 60],
};

export class MapScreen implements Screen {
  readonly name = 'map';
  readonly cursor = 'pointer';
  private selected: string;

  constructor(
    private app: App,
    focus?: string,
  ) {
    const levels = CHAPTERS[0].levels;
    const firstOpen = [...levels].reverse().find((l) => isUnlocked(app.save, l.id)) ?? levels[0];
    this.selected = focus ?? firstOpen.id;
    app.sound.playing = false;
  }

  frame(realDt: number) {
    const ctx = this.app.display.ctx, ui = this.app.ui, save = this.app.save;
    this.app.sound.update(realDt, 0.3);
    ui.begin();
    drawPlan(ctx);
    const ch = CHAPTERS[0];
    rect(ctx, 0, 0, VIEW.w, 16, PAL.ink);
    drawText(ctx, `CHAPTER ${ch.n}`, 40, 3, PAL.slate);
    drawText(ctx, ch.name, 40, 9, PAL.paper);
    const stars = `${starCount(save)}/${ch.levels.length * 3}`;
    star(ctx, 236, 4, true);
    drawText(ctx, stars, 245, 5, PAL.gold);
    coinIcon(ctx, 274, 5);
    drawText(ctx, `${save.coins}`, 281, 5, PAL.gold);
    if (ui.button('back', 2, 2, 34, 12, 'TITLE', { key: 'Escape' })) this.app.goto(new TitleScreen(this.app));

    // the path between levels
    const ids = ch.levels.map((l) => l.id);
    for (let i = 1; i < ids.length; i++) {
      const [ax, ay] = NODES[ids[i - 1]], [bx, by] = NODES[ids[i]];
      const open = isUnlocked(save, ids[i]);
      line(ctx, ax, ay, bx, by, open ? PAL.slate : PAL.ash, open ? 0 : 2);
    }
    for (const l of ch.levels) this.node(l);

    // the Workshop door
    if (ui.button('shop', 252, 128, 62, 20, 'WORKSHOP', { key: 'KeyW' })) this.app.goto(new WorkshopScreen(this.app, this.selected));
    rect(ctx, 252, 124, 62, 4, PAL.slate);

    // the selected level
    this.info(ch.levels.find((l) => l.id === this.selected) ?? ch.levels[0]);
    const soon = COMING[0];
    drawText(ctx, `CHAPTER ${soon.n}: ${soon.name} - COMING SOON`, 8, 20, PAL.ash);
    ui.end();
  }

  private node(l: LevelDef) {
    const ctx = this.app.display.ctx, ui = this.app.ui, save = this.app.save;
    const [cx, cy] = NODES[l.id];
    const open = isUnlocked(save, l.id);
    const rec = record(save, l.id);
    const boss = l.id.endsWith('-8');
    const s = boss ? 22 : 18;
    const x = cx - s / 2, y = cy - s / 2;
    const hover = open && ui.over(x, y, s, s);
    const sel = l.id === this.selected;
    rect(ctx, x + 2, y + 2, s, s, PAL.ash);
    rect(ctx, x, y, s, s, !open ? PAL.fog : rec.clears ? PAL.ink : PAL.coal);
    frame(ctx, x, y, s, s, sel ? PAL.cyan : hover ? PAL.paper : open ? PAL.slate : PAL.ash);
    if (sel) frame(ctx, x - 2, y - 2, s + 4, s + 4, PAL.cyan);
    if (open) centerText(ctx, l.id, cx, cy - 2, boss ? PAL.hot : PAL.paper);
    else {
      // a padlock
      rect(ctx, cx - 3, cy - 1, 7, 5, PAL.stone);
      frame(ctx, cx - 2, cy - 5, 5, 5, PAL.stone);
    }
    for (let i = 0; i < 3; i++) {
      if (!open) continue;
      rect(ctx, x + 3 + i * 5 + (boss ? 2 : 0), y + s - 5, 3, 3, rec.stars[i] ? PAL.gold : PAL.iron);
    }
    if (hover && ui.clicked) {
      if (sel) this.app.goto(new PlayScreen(this.app, l.id));
      else {
        this.selected = l.id;
        this.app.sound.play('click');
      }
      ui.clicked = false;
    }
  }

  private info(l: LevelDef) {
    const ctx = this.app.display.ctx, ui = this.app.ui, save = this.app.save;
    const rec = record(save, l.id);
    const x = 8, y = 26, w = 128, h = 66;
    ui.panel(x, y, w, h);
    drawText(ctx, l.id, x + 6, y + 5, PAL.slate);
    drawText(ctx, l.name, x + 6 + textWidth(l.id) + 4, y + 5, PAL.paper);
    const goal = l.goal.kind === 'clear' ? 'CLEAR THE ROOM' : l.goal.kind === 'escape' ? 'ESCAPE' : `SURVIVE ${l.goal.seconds} S`;
    drawText(ctx, goal, x + 6, y + 13, PAL.hot);
    drawText(ctx, `PAR ${l.par} S`, x + 6, y + 20, PAL.stone);
    if (rec.best) drawText(ctx, `BEST ${(rec.best / TICK_RATE).toFixed(1)}`, x + 60, y + 20, PAL.tide);
    wrap(l.challengeText, w - 22).slice(0, 2).forEach((t, i) => drawText(ctx, t, x + 16, y + 28 + i * 6, rec.stars[2] ? PAL.gold : PAL.fog));
    star(ctx, x + 6, y + 27, rec.stars[2]);
    const open = isUnlocked(save, l.id);
    if (ui.button('play', x + 6, y + h - 18, w - 12, 13, open ? (rec.clears ? 'PLAY AGAIN' : 'PLAY') : 'LOCKED', { enabled: open, primary: true, key: 'Enter' })) {
      this.app.goto(new PlayScreen(this.app, l.id));
    }
  }
}

/** A pale office floor plan behind the nodes. */
function drawPlan(ctx: CanvasRenderingContext2D) {
  rect(ctx, 0, 0, VIEW.w, VIEW.h, PAL.paper);
  for (let x = 0; x < VIEW.w; x += 8) rect(ctx, x, 0, 1, VIEW.h, PAL.fog);
  for (let y = 0; y < VIEW.h; y += 8) rect(ctx, 0, y, VIEW.w, 1, PAL.fog);
  // rooms
  const walls: [number, number, number, number][] = [
    [6, 104, 150, 1], [6, 104, 1, 56], [6, 160, 300, 1], [150, 30, 1, 75], [150, 30, 160, 1], [310, 30, 1, 130],
    [186, 84, 1, 42], [186, 84, 60, 1], [100, 104, 1, 56], [240, 30, 1, 30],
  ];
  for (const [x, y, w, h] of walls) rect(ctx, x, y, w + (h === 1 ? 0 : 2), h + (w === 1 ? 0 : 2), PAL.stone);
  dither4(ctx, 152, 32, 86, 26, PAL.ash);
  centerBig(ctx, '', 0, 0, PAL.ink);
}
