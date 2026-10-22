// The Workshop (GAME_DESIGN §11): spend coins on upgrades that bend the time rule, the Holster, and a
// weapon to start each level with.
import { ITEMS } from '../data/items';
import { PAL } from '../data/palette';
import { HOLSTER, LOADOUT, TIER_PRICES, TRACKS, type TrackDef } from '../data/upgrades';
import { buyHolster, buyLoadout, buyTier, equip, loadoutAvailable, nextTierPrice } from '../meta/save';
import { centerBig, drawText, textWidth } from '../render/font';
import { frame, rect } from '../render/prims';
import { VIEW } from '../render/view';
import { coinIcon } from '../ui/kit';
import type { App, Screen } from './app';
import { MapScreen } from './map';
import { trackIcon } from './icons';

export class WorkshopScreen implements Screen {
  readonly name = 'workshop';
  readonly cursor = 'pointer';
  private flash = '';
  private flashT = 0;

  constructor(
    private app: App,
    private back: string,
  ) {
    app.sound.playing = false;
  }

  frame(realDt: number) {
    const ctx = this.app.display.ctx, ui = this.app.ui, s = this.app.save;
    this.app.sound.update(realDt, 0.3);
    this.flashT = Math.max(0, this.flashT - realDt);
    ui.begin();
    rect(ctx, 0, 0, VIEW.w, VIEW.h, PAL.coal);
    for (let x = 0; x < VIEW.w; x += 16) rect(ctx, x, 0, 1, VIEW.h, PAL.ink);
    rect(ctx, 0, 0, VIEW.w, 16, PAL.ink);
    centerBig(ctx, 'WORKSHOP', VIEW.w / 2, 4, PAL.paper);
    coinIcon(ctx, VIEW.w - 44, 5);
    drawText(ctx, `${s.coins}`, VIEW.w - 37, 5, this.flashT > 0 ? PAL.shine : PAL.gold);
    if (ui.button('back', 2, 2, 34, 12, 'BACK', { key: 'Escape' })) this.app.goto(new MapScreen(this.app, this.back));

    TRACKS.forEach((t, i) => this.card(t, i % 2 === 0 ? 4 : 162, 20 + Math.floor(i / 2) * 31));

    // the Holster and the loadout
    const y = 146;
    ui.panel(4, y, 312, 31);
    drawText(ctx, HOLSTER.name, 10, y + 5, PAL.paper);
    drawText(ctx, HOLSTER.blurb, 10, y + 12, PAL.stone);
    if (s.holster) drawText(ctx, 'OWNED', 10, y + 21, PAL.cyan);
    else if (this.buyButton('holster', 10, y + 19, HOLSTER.price, s.coins >= HOLSTER.price)) {
      buyHolster(s);
      this.bought(HOLSTER.name);
    }
    drawText(ctx, 'START WITH', 122, y + 5, PAL.paper);
    const opts: (typeof LOADOUT[number] | null)[] = [null, ...LOADOUT];
    opts.forEach((l, i) => {
      const x = 122 + i * 64, by = y + 13;
      const item = l?.item ?? null;
      const name = item ? ITEMS[item].name : 'NOTHING';
      const owned = item === null || s.owned.includes(item);
      const on = s.loadout === item;
      if (owned) {
        if (ui.button(`eq-${name}`, x, by, 60, 14, on ? `> ${name}` : name, { color: on ? PAL.cyan : undefined })) {
          equip(s, item);
          this.app.persist();
        }
      } else if (item && !loadoutAvailable(s, item)) {
        rect(ctx, x, by, 60, 14, PAL.ink);
        frame(ctx, x, by, 60, 14, PAL.coal);
        drawText(ctx, `${name}`, x + 4, by + 2, PAL.iron);
        drawText(ctx, `AFTER ${l!.after}`, x + 4, by + 8, PAL.iron);
      } else if (item && this.buyButton(`buy-${name}`, x, by, l!.price, s.coins >= l!.price, 60, name)) {
        buyLoadout(s, item);
        this.bought(name);
      }
    });
    if (this.flashT > 0) {
      const t = `${this.flash}!`;
      rect(ctx, (VIEW.w - textWidth(t)) / 2 - 4, 136, textWidth(t) + 8, 9, PAL.ink);
      drawText(ctx, t, (VIEW.w - textWidth(t)) / 2, 138, PAL.cyan);
    }
    ui.end();
  }

  private bought(name: string) {
    this.app.sound.play('buy');
    this.app.persist();
    this.flash = `GOT ${name}`;
    this.flashT = 1.2;
  }

  private card(t: TrackDef, x: number, y: number) {
    const ctx = this.app.display.ctx, ui = this.app.ui, s = this.app.save;
    const w = 154, h = 29;
    const tier = s.up[t.id];
    ui.panel(x, y, w, h);
    trackIcon(ctx, t.id, x + 4, y + 4);
    drawText(ctx, t.name, x + 20, y + 4, PAL.paper);
    for (let i = 0; i < 3; i++) rect(ctx, x + 20 + textWidth(t.name) + 4 + i * 5, y + 4, 4, 5, i < tier ? PAL.cyan : PAL.iron);
    drawText(ctx, t.blurb, x + 20, y + 11, PAL.stone);
    const next = tier < 3 ? `${['I', 'II', 'III'][tier]}: ${t.tiers[tier]}` : `MAX: ${t.tiers[2]}`;
    drawText(ctx, next.length > 37 ? `${next.slice(0, 36)}.` : next, x + 4, y + 20, tier < 3 ? PAL.fog : PAL.tide);
    const price = nextTierPrice(s, t.id);
    if (price !== null && this.buyButton(`buy-${t.id}`, x + w - 34, y + 3, price, s.coins >= price, 31)) {
      buyTier(s, t.id);
      this.bought(`${t.name} ${['I', 'II', 'III'][s.up[t.id] - 1]}`);
    }
    void TIER_PRICES;
  }

  /** A price button; refuses (with a buzz) when you can't afford it. */
  private buyButton(id: string, x: number, y: number, price: number, afford: boolean, w = 40, label = '') {
    const ui = this.app.ui, ctx = this.app.display.ctx;
    const text = label ? `${label} ${price}` : `${price}`;
    const hit = ui.button(id, x, y, w, 11, '', { enabled: true });
    const tx = x + Math.round((w - textWidth(text) - 6) / 2);
    coinIcon(ctx, tx, y + 3);
    drawText(ctx, text, tx + 7, y + 3, afford ? PAL.gold : PAL.iron);
    if (hit && !afford) {
      this.app.sound.play('deny');
      return false;
    }
    return hit;
  }
}
