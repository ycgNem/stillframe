// Wires the pieces: input → the current screen → (in a level) time rule → sim ticks → render. Screens
// are small classes; the one loop asks the current screen how fast game time runs, ticks it, and draws.
import { Sound } from '../audio/audio';
import { PAL } from '../data/palette';
import { TICK_RATE } from '../data/tuning';
import { Input } from '../engine/input';
import { TimeLoop } from '../engine/loop';
import { Screen as Display } from '../engine/screen';
import { modsOf, type Save } from '../meta/save';
import { Atlas, type SheetJson } from '../render/atlas';
import { rect } from '../render/prims';
import { VIEW } from '../render/view';
import { Ui } from '../ui/kit';
import { loadSave, writeSave } from './storage';
import { ContactScreen } from './contact';
import { EndScreen } from './end';
import { MapScreen } from './map';
import { PlayScreen } from './play';
import { SettingsScreen } from './settings';
import { TitleScreen } from './title';
import { WorkshopScreen } from './workshop';

export interface Screen {
  readonly name: string;
  /** game seconds per real second this frame (0 or absent = no sim ticks) */
  scale?(realDt: number): number;
  tick?(): void;
  frame(realDt: number, alpha: number): void;
  /** the mouse pointer to draw */
  cursor?: 'aim' | 'pointer' | 'none';
  /** the crosshair lights up: what you click now will land (a punch in reach) */
  cursorLock?: boolean;
  /** the window lost focus */
  blur?(): void;
}

export class App {
  readonly display: Display;
  readonly input: Input;
  readonly loop: TimeLoop;
  readonly sound = new Sound();
  readonly ui: Ui;
  readonly atlas: Atlas;
  save: Save;
  screen: Screen;
  debug = false;
  /** the bot plays levels instead of you (e2e scripts and the console) */
  autoplay = false;
  /** real seconds since start, for blinking and menus */
  now = 0;

  constructor(canvas: HTMLCanvasElement, sheetUrl: string, sheet: SheetJson) {
    this.display = new Display(canvas, VIEW.w, VIEW.h);
    this.input = new Input(canvas, (x, y) => this.display.toView(x, y));
    this.input.onGesture = () => this.sound.unlock();
    this.atlas = new Atlas(sheetUrl, sheet);
    this.ui = new Ui(this.display.ctx, this.input, this.sound);
    this.save = loadSave();
    this.applySettings();
    this.screen = new TitleScreen(this);
    this.loop = new TimeLoop(TICK_RATE, {
      scale: (realDt) => this.screen.scale?.(realDt) ?? 0,
      tick: () => this.screen.tick?.(),
      frame: (realDt, alpha) => this.frame(realDt, alpha),
    });
    this.loop.start();
    addEventListener('blur', () => this.screen.blur?.());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.screen.blur?.();
    });
  }

  goto(s: Screen) {
    this.screen = s;
    this.input.clear();
    this.loop.reset();
  }

  persist() {
    writeSave(this.save);
  }

  /** Straight into a level (e2e scripts and the console). */
  startLevel(id: string, skipIntro = true) {
    this.goto(new PlayScreen(this, id, skipIntro));
  }

  /** Straight to a menu screen (e2e scripts and the console). */
  open(name: 'title' | 'map' | 'workshop' | 'settings' | 'end' | 'contact') {
    const make = { title: () => new TitleScreen(this), map: () => new MapScreen(this), workshop: () => new WorkshopScreen(this, '1-1'), settings: () => new SettingsScreen(this, null), end: () => new EndScreen(this), contact: () => new ContactScreen(this) };
    this.goto(make[name]());
  }

  applySettings() {
    const st = this.save.settings;
    this.sound.setVolumes(st.sfx, st.music);
    this.sound.voice = st.voice;
  }

  mods() {
    return modsOf(this.save);
  }

  private frame(realDt: number, alpha: number) {
    this.now += realDt;
    if (this.input.pressed('F3')) this.debug = !this.debug;
    this.screen.frame(realDt, alpha);
    this.drawCursor();
    this.input.endFrame();
  }

  private drawCursor() {
    const ctx = this.display.ctx;
    const m = this.input.mouse;
    const x = Math.round(m.x), y = Math.round(m.y);
    const kind = this.screen.cursor ?? 'pointer';
    if (kind === 'none') return;
    if (kind === 'aim') {
      // a crosshair with a gap, ink with a paper rim so it reads on white and black
      for (const [dx, dy, w, h] of [[-5, 0, 3, 1], [3, 0, 3, 1], [0, -5, 1, 3], [0, 3, 1, 3]]) {
        rect(ctx, x + dx - (w > 1 ? 0 : 1), y + dy - (h > 1 ? 0 : 1), w + (w > 1 ? 0 : 2), h + (h > 1 ? 0 : 2), PAL.paper);
      }
      const arms = this.screen.cursorLock ? PAL.tide : PAL.ink;
      for (const [dx, dy, w, h] of [[-5, 0, 3, 1], [3, 0, 3, 1], [0, -5, 1, 3], [0, 3, 1, 3]]) rect(ctx, x + dx, y + dy, w, h, arms);
      rect(ctx, x, y, 1, 1, PAL.cyan);
      return;
    }
    // an arrow pointer
    const rows = ['#.......', '##......', '#o#.....', '#oo#....', '#ooo#...', '#oooo#..', '#ooooo#.', '#oo####.', '#o#.....', '##......'];
    rows.forEach((r, j) => [...r].forEach((c, i) => {
      if (c === '#') rect(ctx, x + i, y + j, 1, 1, PAL.ink);
      else if (c === 'o') rect(ctx, x + i, y + j, 1, 1, PAL.paper);
    }));
  }
}
