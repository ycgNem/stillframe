// The Workshop (GAME_DESIGN §11): spend coins on upgrades that bend the time rule, the Holster, and a
// weapon to start each level with.
import { ITEMS } from '../data/items';
import { PAL } from '../data/palette';
import { HOLSTER, LOADOUT, TRACKS, type TrackDef } from '../data/upgrades';
import { buyHolster, buyLoadout, buyTier, equip, loadoutAvailable, nextTierPrice } from '../meta/save';
import { rect } from '../render/prims';
import { icon, plate, UI } from '../ui/kit';
import { measure, rich, richLines, richWidth, text } from '../ui/text';
import type { App, Screen } from './app';
import { trackIcon } from './icons';
import { MapScreen } from './map';
import { TitleScreen } from './title';

const ROMAN = ['I', 'II', 'III'];

export class WorkshopScreen implements Screen {
  readonly name = 'workshop';
  readonly cursor = 'pointer';
  private flash = '';
  private flashT = 0;

  constructor(
    private app: App,
    /** the level the map should show on the way back (null: back to the title) */
    private back: string | null,
  ) {
    app.sound.playing = false;
  }

  frame(realDt: number) {
    const ui = this.app.ui, ctx = ui.ctx, s = this.app.save;
    this.app.sound.update(realDt, 0.3);
    this.flashT = Math.max(0, this.flashT - realDt);
    rect(this.app.world, 0, 0, 320, 180, PAL.fog);
    ui.begin();
    rect(ctx, 0, 0, UI.w, UI.h, PAL.fog);
    for (let y = 40; y < UI.h; y += 8) rect(ctx, 0, y, UI.w, 1, PAL.ash);

    // top bar
    rect(ctx, 0, 0, UI.w, 36, PAL.paper);
    rect(ctx, 0, 36, UI.w, 2, PAL.ink);
    const leave = () => this.app.goto(this.back ? new MapScreen(this.app, this.back) : new TitleScreen(this.app));
    if (ui.button('back', 8, 6, 74, 24, 'Back', { cap: 'Esc', key: 'Escape' })) leave();
    text(ctx, 'WORKSHOP', UI.w / 2, 12, PAL.ink, { face: 'shard', align: 'center' });
    const coins = `${s.coins}`;
    const cw = measure(coins, 'shard') + 30;
    plate(ctx, UI.w - 12 - cw, 6, cw, 24, PAL.ink, null);
    rect(ctx, UI.w - 11 - cw, 7, cw - 2, 22, this.flashT > 0 ? PAL.shine : PAL.paper);
    icon(ctx, 'coin', UI.w - 4 - cw, 14);
    text(ctx, coins, UI.w - 18 - measure(coins, 'shard') + 0, 12, PAL.ink, { face: 'shard' });

    TRACKS.forEach((t, i) => this.card(t, i % 2 === 0 ? 12 : 326, 46 + Math.floor(i / 2) * 64));
    this.bottom(304);

    if (this.flashT > 0) {
      const t = `${this.flash}!`;
      const w = measure(t) + 24, x = Math.round((UI.w - w) / 2);
      plate(ctx, x, 40, w, 22, PAL.ink, PAL.stone);
      rect(ctx, x + 1, 41, w - 2, 20, PAL.cyan);
      text(ctx, t, UI.w / 2, 47, PAL.ink, { align: 'center' });
    }
    ui.end();
  }

  private bought(name: string) {
    this.app.sound.play('buy');
    this.app.persist();
    this.flash = `Got ${name}`;
    this.flashT = 1.4;
  }

  private card(t: TrackDef, x: number, y: number) {
    const ui = this.app.ui, ctx = ui.ctx, s = this.app.save;
    const w = 302, h = 58;
    const tier = s.up[t.id];
    ui.card(x, y, w, h);
    rect(ctx, x + 8, y + 8, 28, 28, tier ? PAL.fog : PAL.paper);
    rect(ctx, x + 8, y + 8, 28, 1, PAL.ash);
    trackIcon(ctx, t.id, x + 10, y + 10);
    text(ctx, t.name, x + 44, y + 8, PAL.ink);
    for (let i = 0; i < 3; i++) {
      const px = x + 48 + measure(t.name) + i * 11;
      rect(ctx, px, y + 8, 9, 9, PAL.ink);
      rect(ctx, px + 1, y + 9, 7, 7, i < tier ? PAL.cyan : PAL.paper);
    }
    rich(ctx, t.blurb, x + 44, y + 22, { color: PAL.iron });
    const next = tier < 3 ? `${ROMAN[tier]}  ${t.tiers[tier]}` : `Maxed  ${t.tiers[2]}`;
    text(ctx, next, x + 8, y + 42, tier < 3 ? PAL.ink : PAL.tide);
    const price = nextTierPrice(s, t.id);
    if (price !== null) {
      if (this.buyButton(`buy-${t.id}`, x + w - 82, y + 8, 74, price)) {
        buyTier(s, t.id);
        this.bought(`${t.name} ${ROMAN[s.up[t.id] - 1]}`);
      }
    } else ui.chip(x + w - 50, y + 10, 'Max', PAL.cyan);
  }

  private bottom(y: number) {
    const ui = this.app.ui, ctx = ui.ctx, s = this.app.save;
    // the Holster
    ui.card(12, y, 226, 50);
    text(ctx, HOLSTER.name, 20, y + 8, PAL.ink);
    rich(ctx, HOLSTER.blurb, 20, y + 23, { color: PAL.iron, maxW: 130, lineH: 13 });
    if (s.holster) ui.chip(170, y + 9, 'Owned', PAL.cyan);
    else if (this.buyButton('holster', 156, y + 8, 74, HOLSTER.price)) {
      buyHolster(s);
      this.bought(HOLSTER.name);
    }
    // what you carry into every level
    const lx = 246, lw = UI.w - 12 - lx;
    ui.card(lx, y, lw, 50);
    text(ctx, 'Start each level with', lx + 8, y + 8, PAL.ink);
    // each button as wide as its label needs, so five fit on one row
    const opts = [null, ...LOADOUT].map((l) => {
      const item = l?.item ?? null;
      const name = item ? ITEMS[item].name : 'Nothing';
      const state = item === null || s.owned.includes(item) ? 'owned' : !loadoutAvailable(s, item) ? 'locked' : 'buy';
      const label = state === 'owned' ? name : state === 'locked' ? `{lock} ${l!.after}` : `${name} {coin} ${l!.price}`;
      return { l, item, name, state, w: richWidth(richLines(label)[0]) + 14 };
    });
    const gap = 5, room = lw - 16 - gap * (opts.length - 1);
    const k = Math.min(1, room / opts.reduce((a, o) => a + o.w, 0));
    let bx = lx + 8;
    for (const o of opts) {
      const bw = Math.floor(o.w * k), by = y + 22;
      if (o.state === 'owned') {
        if (ui.button(`eq-${o.name}`, bx, by, bw, 22, o.name, { on: s.loadout === o.item, kind: s.loadout === o.item ? 'primary' : 'normal' })) {
          equip(s, o.item);
          this.app.persist();
        }
      } else if (o.state === 'locked') {
        ui.button(`na-${o.name}`, bx, by, bw, 22, `{lock} ${o.l!.after}`, { enabled: false });
      } else if (this.buyButton(`buy-${o.name}`, bx, by, bw, o.l!.price, o.name)) {
        buyLoadout(s, o.item!);
        this.bought(o.name);
      }
      bx += bw + gap;
    }
  }

  /** A price button; refuses (with a buzz) when you can't afford it. */
  private buyButton(id: string, x: number, y: number, w: number, price: number, label = '') {
    const ui = this.app.ui, s = this.app.save;
    const afford = s.coins >= price;
    const hit = ui.button(id, x, y, w, label ? 22 : 24, `${label ? `${label} ` : ''}{coin} ${price}`, { kind: afford ? 'normal' : 'quiet', color: afford ? PAL.ink : PAL.slate });
    if (hit && !afford) {
      this.app.sound.play('deny');
      return false;
    }
    return hit;
  }
}

