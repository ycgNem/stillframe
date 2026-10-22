// The chapter map (GAME_DESIGN §15): a tab per chapter, level nodes on a pale plan of the place, stars per
// node, the selected level on a card, and the Workshop door. Levels unlock in order; a chapter opens when
// the one before it falls.
import { CHAPTERS, type ChapterDef } from '../data/levels';
import type { LevelDef } from '../data/levels/types';
import { PAL } from '../data/palette';
import { TICK_RATE } from '../data/tuning';
import { isUnlocked, record, starCount } from '../meta/save';
import { line, rect, ring } from '../render/prims';
import { bigStar, icon, plate, UI } from '../ui/kit';
import { measure, rich, text, wrap } from '../ui/text';
import type { App, Screen } from './app';
import { PlayScreen } from './play';
import { TitleScreen } from './title';
import { WorkshopScreen } from './workshop';

/** Where the eight levels of a chapter sit on its plan, as fractions of the plan; the last is the boss. */
const PATH: [number, number][] = [[0.1, 0.84], [0.3, 0.84], [0.5, 0.7], [0.7, 0.84], [0.9, 0.62], [0.7, 0.4], [0.45, 0.3], [0.18, 0.2]];
const PLAN = { x: 248, y: 48, w: 380, h: 266 };

export class MapScreen implements Screen {
  readonly name = 'map';
  readonly cursor = 'pointer';
  private selected: string;
  private chapter: number;

  constructor(
    private app: App,
    focus?: string,
  ) {
    const open = CHAPTERS.flatMap((c) => c.levels).filter((l) => isUnlocked(app.save, l.id));
    const last = open[open.length - 1] ?? CHAPTERS[0].levels[0];
    this.selected = focus ?? last.id;
    this.chapter = Math.max(0, CHAPTERS.findIndex((c) => c.levels.some((l) => l.id === this.selected)));
    app.sound.playing = false;
  }

  frame(realDt: number) {
    const ui = this.app.ui, ctx = ui.ctx, save = this.app.save;
    this.app.sound.update(realDt, 0.3);
    rect(this.app.world, 0, 0, 320, 180, PAL.paper);
    ui.begin();
    blueprint(ctx);

    // top bar: back, the chapter tabs, what you have
    rect(ctx, 0, 0, UI.w, 36, PAL.paper);
    rect(ctx, 0, 36, UI.w, 2, PAL.ink);
    if (ui.button('back', 8, 6, 74, 24, 'Title', { cap: 'Esc', key: 'Escape' })) this.app.goto(new TitleScreen(this.app));
    let tx = 92;
    CHAPTERS.forEach((c, i) => {
      const open = isUnlocked(save, c.levels[0].id);
      const label = `${c.n}`;
      const w = 30;
      if (ui.button(`ch${i}`, tx, 6, w, 24, open ? label : '{lock}', { enabled: open, on: i === this.chapter, kind: i === this.chapter ? 'primary' : 'normal' })) {
        this.chapter = i;
        const first = [...c.levels].reverse().find((l) => isUnlocked(save, l.id)) ?? c.levels[0];
        this.selected = first.id;
      }
      tx += w + 4;
    });
    const ch = CHAPTERS[this.chapter];
    text(ctx, `Chapter ${ch.n}`, tx + 8, 8, PAL.iron);
    text(ctx, ch.name, tx + 8, 20, PAL.ink);
    const coins = `${save.coins}`;
    let rx = UI.w - 12 - measure(coins);
    text(ctx, coins, rx, 14, PAL.ink);
    icon(ctx, 'coin', rx - 12, 14);
    const stars = `${starCount(save)}`;
    rx -= 30 + measure(stars);
    text(ctx, stars, rx, 14, PAL.ink);
    icon(ctx, 'star', rx - 12, 14);

    // the plan, the path, the nodes
    planArt(ctx, ch.n);
    const ids = ch.levels.map((l) => l.id);
    const at = (i: number) => [PLAN.x + PATH[i][0] * PLAN.w, PLAN.y + PATH[i][1] * PLAN.h] as const;
    for (let i = 1; i < ids.length; i++) {
      const [ax, ay] = at(i - 1), [bx, by] = at(i);
      const open = isUnlocked(save, ids[i]);
      for (const o of [-1, 0, 1]) line(ctx, ax, ay + o, bx, by + o, open ? PAL.slate : PAL.ash, open ? 0 : 3);
    }
    ch.levels.forEach((l, i) => this.node(l, ...at(i)));

    // the Workshop door
    if (ui.button('shop', UI.w - 170, UI.h - 40, 158, 30, 'Workshop', { cap: 'W', key: 'KeyW' })) this.app.goto(new WorkshopScreen(this.app, this.selected));
    this.info(ch, ch.levels.find((l) => l.id === this.selected) ?? ch.levels[0]);
    ui.end();
  }

  private node(l: LevelDef, cx: number, cy: number) {
    const ui = this.app.ui, ctx = ui.ctx, save = this.app.save;
    const open = isUnlocked(save, l.id);
    const rec = record(save, l.id);
    const boss = l.id.endsWith('-8');
    const s = boss ? 40 : 32;
    const x = Math.round(cx - s / 2), y = Math.round(cy - s / 2);
    const sel = l.id === this.selected;
    const hover = open && ui.over(x, y, s, s);
    if (sel) plate(ctx, x - 4, y - 4, s + 8, s + 8, PAL.cyan, null);
    plate(ctx, x, y, s, s, boss && open ? PAL.blood : open ? PAL.ink : PAL.ash, PAL.stone);
    rect(ctx, x + 2, y + 2, s - 4, s - 4, !open ? PAL.fog : hover ? PAL.fog : PAL.paper);
    if (open) {
      text(ctx, l.id, cx, y + (boss ? 9 : 6), boss ? PAL.blood : PAL.ink, { align: 'center' });
      for (let i = 0; i < 3; i++) {
        const px = Math.round(cx - 13 + i * 9), py = y + s - (boss ? 14 : 12);
        rect(ctx, px, py, 8, 8, rec.stars[i] ? PAL.amber : PAL.ash);
        rect(ctx, px + 1, py + 1, 6, 6, rec.stars[i] ? PAL.gold : PAL.fog);
      }
    } else icon(ctx, 'lock', cx - 4, cy - 4);
    if (hover && ui.clicked) {
      if (sel) this.app.goto(new PlayScreen(this.app, l.id));
      else {
        this.selected = l.id;
        this.app.sound.play('click');
      }
      ui.clicked = false;
    }
  }

  private info(ch: ChapterDef, l: LevelDef) {
    const ui = this.app.ui, ctx = ui.ctx, save = this.app.save;
    const rec = record(save, l.id);
    const x = 12, y = 48, w = 224, h = 300;
    ui.card(x, y, w, h);
    ui.chip(x + 10, y + 10, `Level ${l.id}`, PAL.fog);
    const goal = l.goal.kind === 'clear' ? 'Clear the room' : l.goal.kind === 'escape' ? 'Escape' : `Survive ${l.goal.seconds} s`;
    ui.chip(x + w - 10 - measure(goal) - 8, y + 10, goal, l.goal.kind === 'clear' ? PAL.red : PAL.cyan, l.goal.kind === 'clear' ? PAL.paper : PAL.ink);
    const name = l.name.toUpperCase();
    const big = measure(name, 'shard') <= w - 20;
    if (big) text(ctx, name, x + 10, y + 32, PAL.ink, { face: 'shard' });
    else text(ctx, l.name, x + 10, y + 34, PAL.ink);
    text(ctx, ch.setting, x + 10, y + 50, PAL.iron);
    rect(ctx, x + 10, y + 64, w - 20, 1, PAL.fog);
    text(ctx, l.goal.kind === 'survive' ? 'No par: survive it' : `Par ${l.par} s`, x + 10, y + 72, PAL.ink);
    if (rec.best) text(ctx, `Best ${(rec.best / TICK_RATE).toFixed(1)} s`, x + w - 10, y + 72, PAL.tide, { align: 'right' });
    const rows: [string, string][] = [['Clear', 'Finish the level'], ['Par', l.goal.kind === 'survive' ? 'Comes with surviving' : `Under ${l.par} game seconds`], ['Challenge', l.challengeText]];
    let ry = y + 92;
    rows.forEach(([a, b], i) => {
      bigStar(ctx, x + 10, ry - 3, rec.stars[i]);
      text(ctx, a, x + 30, ry, rec.stars[i] ? PAL.amber : PAL.ink);
      const lines = wrap(b, w - 42);
      lines.forEach((t, j) => text(ctx, t, x + 30, ry + 12 + j * 12, PAL.iron));
      ry += 16 + lines.length * 12;
    });
    rich(ctx, l.tip, x + 10, ry + 4, { color: PAL.slate, accent: PAL.tide, maxW: w - 20, lineH: 13 });
    const open = isUnlocked(save, l.id);
    const label = open ? (rec.clears ? 'Play again' : 'Play') : '{lock} Locked';
    if (ui.button('play', x + 10, y + h - 40, w - 20, 30, label, { enabled: open, kind: 'primary', cap: 'Enter', key: 'Enter' })) {
      this.app.goto(new PlayScreen(this.app, l.id));
    }
  }
}

/** Pale paper with a fog grid. */
function blueprint(ctx: CanvasRenderingContext2D) {
  rect(ctx, 0, 0, UI.w, UI.h, PAL.paper);
  for (let x = 0; x < UI.w; x += 16) rect(ctx, x, 0, 1, UI.h, PAL.fog);
  for (let y = 0; y < UI.h; y += 16) rect(ctx, 0, y, UI.w, 1, PAL.fog);
}

/** A faint plan of the chapter's place behind its nodes. */
function planArt(ctx: CanvasRenderingContext2D, n: number) {
  const { x, y, w, h } = PLAN;
  const wall = (ax: number, ay: number, bw: number, bh: number) => rect(ctx, x + ax * w, y + ay * h, Math.max(2, bw * w), Math.max(2, bh * h), PAL.ash);
  if (n === 1) {
    // office floors: rooms and corridors
    wall(0, 0.66, 0.6, 0); wall(0, 0.66, 0, 0.34); wall(0, 1, 1, 0); wall(0.6, 0.1, 0, 0.56); wall(0.6, 0.1, 0.4, 0);
    wall(1, 0.1, 0, 0.9); wall(0.3, 0.66, 0, 0.34); wall(0.75, 0.5, 0, 0.3); wall(0.75, 0.5, 0.25, 0); wall(0.05, 0.05, 0.4, 0);
  } else if (n === 2) {
    // a platform between two tracks
    for (const ty of [0.12, 0.56]) {
      rect(ctx, x, y + ty * h, w, 2, PAL.ash);
      rect(ctx, x, y + ty * h + 14, w, 2, PAL.ash);
      for (let sx = 0; sx < w; sx += 12) rect(ctx, x + sx, y + ty * h - 2, 3, 20, PAL.fog);
    }
  } else if (n === 3) {
    // girders crossing the sky
    for (let i = 0; i < 6; i++) line(ctx, x + i * w / 6, y + h, x + i * w / 6 + w / 6, y, PAL.ash, 0);
    rect(ctx, x, y + h * 0.5, w, 2, PAL.ash);
  } else if (n === 4) {
    // a dance floor
    for (let gx = 0; gx < 8; gx++) for (let gy = 0; gy < 6; gy++) if ((gx + gy) % 2) rect(ctx, x + 40 + gx * 38, y + 20 + gy * 38, 36, 36, PAL.fog);
  } else {
    // the void, ringing
    for (let r = 20; r < 150; r += 26) ring(ctx, x + w / 2, y + h / 2, r, PAL.fog);
  }
}
