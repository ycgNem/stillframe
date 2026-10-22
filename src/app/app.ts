// Wires the pieces: input → the current screen → (in a level) time rule → sim ticks → render. Screens
// are small classes; the one loop asks the current screen how fast game time runs, ticks it, and draws.
// Screens paint the world on `display.world` (320×180 game pixels) and text and menus on `ui`
// (640×360 UI pixels); the app draws the pointer and presents both layers.
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
import { paint, Ui, UI } from '../ui/kit';
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
    this.display = new Display(canvas, VIEW.w, VIEW.h, UI.scale);
    this.input = new Input(canvas, (x, y) => this.display.toView(x, y));
    this.input.onGesture = () => this.sound.unlock();
    this.atlas = new Atlas(sheetUrl, sheet);
    this.ui = new Ui(this.display.ui, this.input, this.sound);
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

  /** The world layer (game pixels). */
  get world() {
    return this.display.world;
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
    this.display.begin();
    this.screen.frame(realDt, alpha);
    this.drawCursor();
    this.display.present();
    this.input.endFrame();
  }

  private drawCursor() {
    const ctx = this.display.ui;
    const m = this.ui.mouse;
    const x = Math.round(m.x), y = Math.round(m.y);
    const kind = this.screen.cursor ?? 'pointer';
    if (kind === 'none') return;
    if (kind === 'aim') {
      // four ink arms with a paper rim, so it reads on white and black; they turn cyan when a punch would land
      const arms = this.screen.cursorLock ? PAL.tide : PAL.ink;
      const bars: [number, number, number, number][] = [[-11, -1, 7, 2], [5, -1, 7, 2], [-1, -11, 2, 7], [-1, 5, 2, 7]];
      for (const [dx, dy, w, h] of bars) rect(ctx, x + dx - 1, y + dy - 1, w + 2, h + 2, PAL.paper);
      for (const [dx, dy, w, h] of bars) rect(ctx, x + dx, y + dy, w, h, arms);
      rect(ctx, x - 1, y - 1, 2, 2, PAL.cyan);
      return;
    }
    paint(ctx, POINTER, x, y);
  }
}

/** The arrow pointer, in UI pixels: ink with a paper face. */
const POINTER = [
  'k.........', 'kk........', 'kpk.......', 'kppk......', 'kpppk.....', 'kppppk....', 'kpppppk...', 'kppppppk..',
  'kpppppppk.', 'kppppkkkkk', 'kppkpk....', 'kpk.kpk...', 'kk..kpk...', 'k....kpk..', '.....kpk..', '......kk..',
];
