// Gauntlet (GAME_DESIGN §14): endless waves, five to an arena, the arenas in turn, a glitch in each from
// the second on. Between arenas a card says what's next; when you fall, one says how far you got. Coins
// bank as you go: clearing a wave pays, and so do the kills.
import { ARENAS, GAUNTLET } from '../data/gauntlet';
import type { Glitch } from '../data/levels/types';
import { PAL } from '../data/palette';
import { gauntletRound, roundGlitch, waveCoins, wavesCleared } from '../meta/gauntlet';
import { rect } from '../render/prims';
import type { World } from '../sim/types';
import { UI } from '../ui/kit';
import { measure, rich, text } from '../ui/text';
import type { App, Screen } from './app';
import { PlayScreen, type PlayRun } from './play';
import { TitleScreen } from './title';

const GLITCH_LINES: Record<Glitch | 'wells', string> = {
  inverse: '*Inverse:* time runs while you stand still',
  echo: '*Echo:* every shot fires again a moment later',
  wells: '*Wells:* gravity bends bullets and drags at you',
  mirror: '*Mirror:* left and right are swapped',
};

export class GauntletScreen implements Screen, PlayRun {
  readonly name = 'gauntlet';
  readonly cursor = 'pointer';
  /** the arena you're on, from 0 */
  private round = 0;
  /** waves cleared this run, and coins banked from it */
  private cleared = 0;
  private coins = 0;
  /** what the last arena paid, for the card */
  private last = { waves: 0, coins: 0 };
  private phase: 'next' | 'over' = 'next';
  private newBest = false;

  constructor(private app: App) {
    app.sound.playing = false;
  }

  get waveOffset() {
    return this.round * GAUNTLET.roundWaves;
  }

  /** Into the arena for this round. */
  private play() {
    this.app.goto(new PlayScreen(this.app, gauntletRound(this.round), true, this));
  }

  /** Banks what this arena paid: the waves cleared and the kills. */
  private bank(w: World, waves: number) {
    const from = this.cleared + 1;
    const coins = waveCoins(from, this.cleared + waves) + w.stats.killCoins + w.stats.comboCoins + w.stats.styleCoins;
    this.cleared += waves;
    this.coins += coins;
    this.last = { waves, coins };
    const s = this.app.save;
    s.coins += coins;
    s.earned += coins;
  }

  won(screen: PlayScreen) {
    this.bank(screen.world, GAUNTLET.roundWaves);
    this.round++;
    this.phase = 'next';
    this.app.persist();
    this.app.goto(this);
  }

  lost(screen: PlayScreen) {
    this.bank(screen.world, wavesCleared(screen.world));
    const g = this.app.save.gauntlet;
    g.runs++;
    this.newBest = this.cleared > g.best;
    g.best = Math.max(g.best, this.cleared);
    this.phase = 'over';
    this.app.persist();
    this.app.goto(this);
  }

  frame(realDt: number) {
    const ui = this.app.ui, ctx = ui.ctx, inp = this.app.input;
    this.app.sound.update(realDt, 0.3);
    rect(this.app.world, 0, 0, 320, 180, PAL.paper);
    ui.begin();
    rect(ctx, 0, 0, UI.w, UI.h, PAL.paper);
    for (let x = 0; x < UI.w; x += 16) rect(ctx, x, 0, 1, UI.h, PAL.fog);
    for (let y = 0; y < UI.h; y += 16) rect(ctx, 0, y, UI.w, 1, PAL.fog);

    const w = 380, h = 220, x = (UI.w - w) / 2, y = (UI.h - h) / 2;
    ui.card(x, y, w, h);
    ui.chip(x + 12, y + 12, 'Gauntlet', PAL.fog);
    const best = `Best: wave ${this.app.save.gauntlet.best}`;
    ui.chip(x + w - 12 - measure(best) - 8, y + 12, best, PAL.cyan, PAL.ink);

    if (this.phase === 'next') {
      const arena = ARENAS[this.round % ARENAS.length];
      const from = this.waveOffset + 1, to = from + GAUNTLET.roundWaves - 1;
      text(ctx, arena.name.toUpperCase(), UI.w / 2, y + 40, PAL.ink, { face: 'shard', scale: 2, align: 'center' });
      text(ctx, `Waves ${from} to ${to}`, UI.w / 2, y + 76, PAL.iron, { align: 'center' });
      const glitch = roundGlitch(this.round);
      rich(ctx, glitch ? GLITCH_LINES[glitch] : 'No glitch, yet. One comes with every arena after this.', UI.w / 2, y + 100, { color: PAL.ink, accent: PAL.blood, align: 'center', maxW: w - 40 });
      if (this.last.waves) rich(ctx, `Cleared ${this.last.waves} waves: +{coin} ${this.last.coins}`, UI.w / 2, y + 130, { color: PAL.tide, align: 'center' });
      if (ui.button('quit', x + 12, y + h - 42, 120, 30, this.round ? 'Leave' : 'Title', { cap: 'Esc', key: 'Escape' })) this.leave();
      if (ui.button('go', x + w - 172, y + h - 42, 160, 30, this.round ? 'Next arena' : 'Start', { kind: 'primary', cap: 'Space' }) || inp.pressed('Space') || inp.pressed('Enter')) this.play();
    } else {
      text(ctx, 'SHATTERED', UI.w / 2, y + 40, PAL.blood, { face: 'shard', scale: 2, align: 'center' });
      text(ctx, `You cleared ${this.cleared} ${this.cleared === 1 ? 'wave' : 'waves'}`, UI.w / 2, y + 78, PAL.ink, { align: 'center' });
      if (this.newBest && this.cleared > 0) text(ctx, 'A new best', UI.w / 2, y + 94, PAL.tide, { align: 'center' });
      rich(ctx, `This run paid {coin} ${this.coins}`, UI.w / 2, y + 118, { color: PAL.ink, align: 'center' });
      if (ui.button('title', x + 12, y + h - 42, 120, 30, 'Title', { cap: 'Esc', key: 'Escape' })) this.app.goto(new TitleScreen(this.app));
      if (ui.button('again', x + w - 172, y + h - 42, 160, 30, 'Run again', { kind: 'primary', cap: 'Space' }) || inp.pressed('Space') || inp.pressed('Enter')) {
        this.app.goto(new GauntletScreen(this.app));
      }
    }
    ui.end();
  }

  /** Leaving between arenas keeps what you've banked and counts as a finished run. */
  private leave() {
    if (this.round > 0) {
      const g = this.app.save.gauntlet;
      g.runs++;
      g.best = Math.max(g.best, this.cleared);
      this.app.persist();
    }
    this.app.goto(new TitleScreen(this.app));
  }
}
