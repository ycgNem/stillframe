// Settings (GAME_DESIGN §15): volume, screen shake, the voice, fewer flashes, and the save as a code you
// can carry to another browser.
import { PAL } from '../data/palette';
import { decodeSave, encodeSave, newSave } from '../meta/save';
import { centerBig, centerText, drawText } from '../render/font';
import { rect } from '../render/prims';
import { VIEW } from '../render/view';
import type { App, Screen } from './app';
import type { PlayScreen } from './play';
import { TitleScreen } from './title';

export class SettingsScreen implements Screen {
  readonly name = 'settings';
  readonly cursor = 'pointer';
  private note = '';
  private noteT = 0;
  private confirmReset = false;

  constructor(
    private app: App,
    private from: PlayScreen | null,
  ) {}

  private leave() {
    this.app.persist();
    this.app.applySettings();
    if (this.from) {
      this.from.resumeFromSettings();
      this.app.goto(this.from);
    } else this.app.goto(new TitleScreen(this.app));
  }

  frame(realDt: number) {
    const ctx = this.app.display.ctx, ui = this.app.ui, st = this.app.save.settings;
    this.app.sound.update(realDt, 0.3);
    this.noteT = Math.max(0, this.noteT - realDt);
    ui.begin();
    rect(ctx, 0, 0, VIEW.w, VIEW.h, PAL.coal);
    ui.panel(50, 10, 220, 160);
    centerBig(ctx, 'SETTINGS', VIEW.w / 2, 16, PAL.paper);
    const row = (y: number, label: string) => drawText(ctx, label, 62, y + 3, PAL.fog);
    const slider = (id: string, y: number, label: string, v: number, set: (v: number) => void) => {
      row(y, label);
      if (ui.button(`${id}-`, 150, y, 12, 11, '-')) set(Math.max(0, Math.round((v - 0.1) * 10) / 10));
      for (let i = 0; i < 10; i++) rect(ctx, 166 + i * 6, y + 2, 5, 7, i < Math.round(v * 10) ? PAL.cyan : PAL.iron);
      if (ui.button(`${id}+`, 228, y, 12, 11, '+')) set(Math.min(1, Math.round((v + 0.1) * 10) / 10));
    };
    const toggle = (id: string, y: number, label: string, v: boolean, set: (v: boolean) => void) => {
      row(y, label);
      if (ui.button(id, 150, y, 90, 11, v ? 'ON' : 'OFF', { color: v ? PAL.cyan : PAL.stone })) set(!v);
    };
    slider('sfx', 32, 'SOUND', st.sfx, (v) => {
      st.sfx = v;
      this.app.applySettings();
      this.app.sound.play('shot');
    });
    slider('music', 46, 'MUSIC', st.music, (v) => {
      st.music = v;
      this.app.applySettings();
    });
    toggle('shake', 60, 'SCREEN SHAKE', st.shake, (v) => (st.shake = v));
    toggle('voice', 74, 'REPLAY VOICE', st.voice, (v) => {
      st.voice = v;
      this.app.applySettings();
    });
    toggle('flash', 88, 'FEWER FLASHES', st.flash, (v) => (st.flash = v));

    drawText(ctx, 'SAVE', 62, 107, PAL.slate);
    if (ui.button('export', 62, 114, 86, 13, 'COPY SAVE CODE')) {
      const code = encodeSave(this.app.save);
      navigator.clipboard?.writeText(code).then(
        () => this.say('CODE COPIED TO CLIPBOARD'),
        () => {
          window.prompt('Your Stillframe save code:', code);
        },
      );
      if (!navigator.clipboard) window.prompt('Your Stillframe save code:', code);
    }
    if (ui.button('import', 154, 114, 86, 13, 'PASTE SAVE CODE')) {
      const code = window.prompt('Paste a Stillframe save code (starts with SF1-):') ?? '';
      const s = code ? decodeSave(code) : null;
      if (s) {
        this.app.save = s;
        this.app.persist();
        this.app.applySettings();
        this.say('SAVE LOADED');
      } else if (code) this.say('THAT CODE DID NOT WORK');
    }
    if (ui.button('reset', 62, 131, 178, 12, this.confirmReset ? 'CLICK AGAIN TO ERASE EVERYTHING' : 'ERASE SAVE', { color: this.confirmReset ? PAL.hot : PAL.stone })) {
      if (this.confirmReset) {
        this.app.save = newSave();
        this.app.persist();
        this.app.applySettings();
        this.say('SAVE ERASED');
        this.confirmReset = false;
      } else this.confirmReset = true;
    }
    if (ui.button('done', VIEW.w / 2 - 30, 150, 60, 14, 'DONE', { primary: true, key: 'Escape' })) this.leave();
    if (this.noteT > 0) centerText(ctx, this.note, VIEW.w / 2, 100, PAL.cyan);
    ui.end();
  }

  private say(t: string) {
    this.note = t;
    this.noteT = 2;
  }
}
