// Settings (GAME_DESIGN §15): volume, screen shake, the voice, fewer flashes, outlined reds, the keys, and
// the save as a code you can carry to another browser.
import { PAL } from '../data/palette';
import { decodeSave, DEFAULT_KEYS, encodeSave, newSave, type KeyBinds } from '../meta/save';
import { rect } from '../render/prims';
import { UI } from '../ui/kit';
import { text } from '../ui/text';
import type { App, Screen } from './app';
import { keyLabel } from './keys';
import type { PlayScreen } from './play';
import { TitleScreen } from './title';

const KEY_ROWS: [keyof KeyBinds, string][] = [
  ['up', 'Move up'], ['left', 'Move left'], ['down', 'Move down'], ['right', 'Move right'],
  ['pick', 'Pick up'], ['swap', 'Swap (Holster)'], ['dash', 'Frameskip'], ['restart', 'Restart'],
];

/** Keys the game itself needs, which can't be bound to anything else. */
const RESERVED = new Set(['Escape', 'F3', 'Enter']);

export class SettingsScreen implements Screen {
  readonly name = 'settings';
  readonly cursor = 'pointer';
  private note = '';
  private noteT = 0;
  private confirmReset = false;
  /** the key being rebound, waiting for a press */
  private binding: keyof KeyBinds | null = null;

  constructor(
    private app: App,
    private from: PlayScreen | null,
  ) {
    window.addEventListener('keydown', this.onKey, true);
  }

  private onKey = (e: KeyboardEvent) => {
    if (this.app.screen !== this) {
      window.removeEventListener('keydown', this.onKey, true);
      return;
    }
    if (!this.binding) return;
    e.preventDefault();
    e.stopPropagation();
    const keys = this.app.save.settings.keys;
    if (e.code === 'Escape') {
      this.binding = null;
      return;
    }
    if (RESERVED.has(e.code)) {
      this.say(`${keyLabel(e.code)} is taken by the game`);
      return;
    }
    // a key moved here leaves its old job to the key it replaces
    const clash = (Object.keys(keys) as (keyof KeyBinds)[]).find((k) => keys[k] === e.code);
    if (clash && clash !== this.binding) keys[clash] = keys[this.binding];
    keys[this.binding] = e.code;
    this.binding = null;
    this.app.persist();
  };

  private leave() {
    window.removeEventListener('keydown', this.onKey, true);
    this.app.persist();
    this.app.applySettings();
    if (this.from) {
      this.from.resumeFromSettings();
      this.app.goto(this.from);
    } else this.app.goto(new TitleScreen(this.app));
  }

  frame(realDt: number) {
    const ui = this.app.ui, ctx = ui.ctx, st = this.app.save.settings;
    this.app.sound.update(realDt, 0.3);
    this.noteT = Math.max(0, this.noteT - realDt);
    rect(this.app.world, 0, 0, 320, 180, PAL.fog);
    ui.begin();
    rect(ctx, 0, 0, UI.w, UI.h, PAL.fog);
    for (let y = 0; y < UI.h; y += 8) rect(ctx, 0, y, UI.w, 1, PAL.ash);
    const x = 40, y = 14, w = UI.w - 80, h = UI.h - 28;
    ui.card(x, y, w, h);
    text(ctx, 'SETTINGS', UI.w / 2, y + 12, PAL.ink, { face: 'shard', align: 'center' });

    // left: sound and sight
    const lx = x + 16, cx = x + 150;
    text(ctx, 'Sound and sight', lx, y + 38, PAL.tide);
    const slider = (id: string, ry: number, label: string, v: number, set: (v: number) => void) => {
      text(ctx, label, lx, ry + 6, PAL.ink);
      if (ui.button(`${id}-`, cx, ry, 20, 20, '-')) set(Math.max(0, Math.round((v - 0.1) * 10) / 10));
      for (let i = 0; i < 10; i++) {
        const bx = cx + 24 + i * 9;
        rect(ctx, bx, ry + 2, 8, 16, PAL.ink);
        rect(ctx, bx + 1, ry + 3, 6, 14, i < Math.round(v * 10) ? PAL.cyan : PAL.paper);
        if (ui.hit(`${id}${i}`, bx, ry, 9, 20)) set((i + 1) / 10);
      }
      if (ui.button(`${id}+`, cx + 118, ry, 20, 20, '+')) set(Math.min(1, Math.round((v + 0.1) * 10) / 10));
    };
    const toggle = (id: string, ry: number, label: string, v: boolean, set: (v: boolean) => void) => {
      text(ctx, label, lx, ry + 6, PAL.ink);
      if (ui.button(id, cx, ry, 138, 20, v ? 'On' : 'Off', { kind: v ? 'primary' : 'normal', on: v })) set(!v);
    };
    slider('sfx', y + 54, 'Sound', st.sfx, (v) => {
      st.sfx = v;
      this.app.applySettings();
      this.app.sound.play('shot');
    });
    slider('music', y + 80, 'Music', st.music, (v) => {
      st.music = v;
      this.app.applySettings();
    });
    toggle('shake', y + 106, 'Screen shake', st.shake, (v) => (st.shake = v));
    toggle('voice', y + 132, 'Replay voice', st.voice, (v) => {
      st.voice = v;
      this.app.applySettings();
    });
    toggle('flash', y + 158, 'Fewer flashes', st.flash, (v) => (st.flash = v));
    toggle('outline', y + 184, 'Outline the reds', st.outline, (v) => (st.outline = v));

    // right: the keys
    const kx = x + 318, kw = w - 334;
    text(ctx, 'Keys (click one, then press a key)', kx, y + 38, PAL.tide);
    KEY_ROWS.forEach(([k, label], i) => {
      const ry = y + 54 + i * 22;
      text(ctx, label, kx, ry + 5, PAL.ink);
      const waiting = this.binding === k;
      const caption = waiting ? 'Press a key' : keyLabel(st.keys[k]);
      if (ui.button(`key-${k}`, kx + kw - 96, ry, 96, 19, caption, { kind: waiting ? 'primary' : 'normal', on: waiting })) this.binding = waiting ? null : k;
    });
    if (ui.button('keys-reset', kx, y + 234, kw, 20, 'Default keys')) {
      st.keys = { ...DEFAULT_KEYS };
      this.binding = null;
      this.app.persist();
    }
    text(ctx, 'Arrow keys always move too.', kx, y + 262, PAL.iron);

    // the save
    text(ctx, 'Your save', lx, y + 216, PAL.tide);
    if (ui.button('export', lx, y + 232, 130, 22, 'Copy save code')) {
      const code = encodeSave(this.app.save);
      if (navigator.clipboard) {
        navigator.clipboard.writeText(code).then(
          () => this.say('Code copied to the clipboard'),
          () => window.prompt('Your Stillframe save code:', code),
        );
      } else window.prompt('Your Stillframe save code:', code);
    }
    if (ui.button('import', lx + 138, y + 232, 130, 22, 'Paste save code')) {
      const code = window.prompt('Paste a Stillframe save code (it starts with SF1-):') ?? '';
      const s = code ? decodeSave(code) : null;
      if (s) {
        this.app.save = s;
        this.app.persist();
        this.app.applySettings();
        this.say('Save loaded');
      } else if (code) this.say('That code did not work');
    }
    if (ui.button('reset', lx, y + 260, 268, 22, this.confirmReset ? 'Click again to erase everything' : 'Erase save', { kind: this.confirmReset ? 'danger' : 'quiet' })) {
      if (this.confirmReset) {
        this.app.save = newSave();
        this.app.persist();
        this.app.applySettings();
        this.say('Save erased');
        this.confirmReset = false;
      } else this.confirmReset = true;
    }
    if (ui.button('done', UI.w / 2 - 70, y + h - 38, 140, 28, 'Done', { kind: 'primary', cap: 'Esc', key: this.binding ? undefined : 'Escape' })) this.leave();
    if (this.noteT > 0) {
      const tw = 300;
      ui.card((UI.w - tw) / 2, y + h - 74, tw, 26, { fill: PAL.cyan });
      text(ctx, this.note, UI.w / 2, y + h - 65, PAL.ink, { align: 'center' });
    }
    ui.end();
  }

  private say(t: string) {
    this.note = t;
    this.noteT = 2;
  }
}
