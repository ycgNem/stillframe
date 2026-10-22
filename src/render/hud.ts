// The heads-up display: small ink plates in the corners so the white world stays clear. Text is the 3×5
// font; color roles hold (cyan = time and you, gold = coins, red = danger, ink = items).
import { ITEMS } from '../data/items';
import { PAL } from '../data/palette';
import { COINS, FRAMESKIP, TICK_RATE } from '../data/tuning';
import { TIER_VALUES } from '../data/upgrades';
import type { TimeState } from '../sim/time';
import type { World } from '../sim/types';
import { redsLeft } from '../sim/world';
import type { Atlas } from './atlas';
import { centerBig, drawOutlined, drawText, textWidth } from './font';
import { dither, frame, rect, type Ctx } from './prims';
import { VIEW } from './view';

export interface HudInfo {
  levelId: string;
  levelName: string;
  time: TimeState;
  rewinds: number;
  /** coins that have landed in the counter so far, so it ticks up as they arrive */
  coinsShown: number;
  /** real seconds since the last wave started, for its banner */
  waveBanner: { n: number; t: number };
  hint: string;
  now: number;
  /** screen rectangles of the player and reds: a HUD plate over one of them steps aside */
  avoid: { x: number; y: number; w: number; h: number }[];
}

function plate(ctx: Ctx, x: number, y: number, w: number, h: number) {
  rect(ctx, x, y, w, h, PAL.ink);
  frame(ctx, x, y, w, h, PAL.coal);
}

let avoid: HudInfo['avoid'] = [];
/** Would a plate here hide someone? Then it isn't drawn this frame. */
function blocked(x: number, y: number, w: number, h: number) {
  return avoid.some((a) => a.x < x + w && a.x + a.w > x && a.y < y + h && a.y + a.h > y);
}

export function drawHud(ctx: Ctx, w: World, atlas: Atlas, h: HudInfo) {
  avoid = h.avoid;
  const hidden = { tl: false, tm: false, tr: false, bl: false, br: false };
  // top left: where you are and what's left to do
  const title = `${h.levelId} ${h.levelName}`;
  const goal = goalText(w);
  const lw = Math.max(textWidth(title), textWidth(goal.text)) + 6;
  if (!(hidden.tl = blocked(2, 2, lw, 15))) {
    plate(ctx, 2, 2, lw, 15);
    drawText(ctx, title, 5, 4, PAL.stone);
    drawText(ctx, goal.text, 5, 10, goal.color);
  }

  // top middle: the time meter
  const mx = 124, mw = 72;
  if (!blocked(mx - 22, 2, mw + 26, 9)) {
    plate(ctx, mx - 22, 2, mw + 26, 9);
    drawText(ctx, 'TIME', mx - 19, 4, PAL.tide);
    rect(ctx, mx, 4, mw, 5, PAL.coal);
    const fill = Math.max(1, Math.round(mw * Math.min(1, h.time.scale)));
    rect(ctx, mx, 4, fill, 5, PAL.tide);
    rect(ctx, mx, 4, fill, 3, PAL.cyan);
    rect(ctx, mx + Math.round(mw * h.time.walk) - 1, 3, 1, 7, PAL.slate);
  }

  // top right: coins and the game clock against par
  const coins = `${h.coinsShown}`;
  const secs = (w.tick / TICK_RATE).toFixed(1);
  const overPar = w.tick / TICK_RATE > w.par && w.goal.kind !== 'survive';
  const clock = `${secs}`;
  const rw = Math.max(textWidth(coins) + 10, textWidth(clock) + textWidth(` /${w.par}`)) + 6;
  if (!blocked(VIEW.w - rw - 2, 2, rw, 15)) {
    plate(ctx, VIEW.w - rw - 2, 2, rw, 15);
    if (atlas.has('coin')) atlas.draw(ctx, 'coin', Math.floor(h.now * 8) % 4, VIEW.w - rw + 2, 6);
    else {
      rect(ctx, VIEW.w - rw + 1, 4, 5, 5, PAL.amber);
      rect(ctx, VIEW.w - rw + 2, 4, 3, 5, PAL.gold);
    }
    drawText(ctx, coins, VIEW.w - rw + 8, 4, PAL.gold);
    const cx = VIEW.w - rw + 1;
    drawText(ctx, clock, cx, 10, overPar ? PAL.stone : PAL.fog);
    drawText(ctx, ` /${w.par}`, cx + textWidth(clock), 10, PAL.iron);
  }
  if (w.combo.count > 1) {
    const t = `COMBO X${w.combo.count}`;
    drawOutlined(ctx, t, VIEW.w - textWidth(t) - 4, 20, PAL.gold, PAL.ink);
    rect(ctx, VIEW.w - textWidth(t) - 4, 26, Math.round(textWidth(t) * (w.combo.timer / COINS.comboWindow)), 1, PAL.gold);
  }

  // bottom left: what's in your hands
  const p = w.player;
  const held = p.hands[0];
  const name = held ? ITEMS[held.kind].name : 'FISTS';
  const isGun = !!held && ITEMS[held.kind].gun;
  const sub = held ? (isGun ? (held.ammo > 0 ? '' : 'EMPTY: CLICK THROWS') : 'CLICK THROWS') : 'CLICK PUNCHES';
  const bw = Math.max(textWidth(name) + (isGun ? held!.ammo * 3 + 4 : 0), textWidth(sub)) + 6;
  if (!blocked(2, VIEW.h - 17, bw, 15)) {
    plate(ctx, 2, VIEW.h - 17, bw, 15);
    drawText(ctx, name, 5, VIEW.h - 15, PAL.paper);
    if (isGun) for (let i = 0; i < held!.ammo; i++) rect(ctx, 5 + textWidth(name) + 3 + i * 3, VIEW.h - 15, 2, 5, PAL.fog);
    drawText(ctx, sub, 5, VIEW.h - 9, held && !(isGun && held.ammo > 0) ? PAL.stone : PAL.iron);
  }
  if (p.hands[1] && !blocked(bw + 4, VIEW.h - 10, 60, 8)) {
    const n2 = `Q: ${ITEMS[p.hands[1].kind].name}`;
    plate(ctx, bw + 4, VIEW.h - 10, textWidth(n2) + 6, 8);
    drawText(ctx, n2, bw + 7, VIEW.h - 8, PAL.stone);
  }

  // bottom right: abilities
  const abil: { label: string; fill: number; color: string }[] = [];
  if (w.mods.shield) abil.push({ label: 'SHIELD', fill: p.shield / TIER_VALUES.shieldHits[w.mods.shield], color: PAL.cyan });
  if (w.mods.frameskip) abil.push({ label: 'SPACE', fill: 1 - p.dashCd / FRAMESKIP.cooldown[w.mods.frameskip], color: p.dashCd > 0 ? PAL.tide : PAL.cyan });
  if (w.mods.rewind) abil.push({ label: 'REWIND', fill: h.rewinds / TIER_VALUES.rewindCharges[w.mods.rewind], color: PAL.cyan });
  if (abil.length && !blocked(VIEW.w - 36, VIEW.h - abil.length * 6 - 5, 34, abil.length * 6 + 3)) {
    const aw = 34, ah = abil.length * 6 + 3;
    plate(ctx, VIEW.w - aw - 2, VIEW.h - ah - 2, aw, ah);
    abil.forEach((a, i) => {
      const y = VIEW.h - ah + 1 + i * 6;
      drawText(ctx, a.label, VIEW.w - aw + 1, y, PAL.slate);
      rect(ctx, VIEW.w - 10, y + 1, 6, 3, PAL.coal);
      rect(ctx, VIEW.w - 10, y + 1, Math.round(6 * Math.max(0, Math.min(1, a.fill))), 3, a.color);
    });
  }

  if (h.waveBanner.t < 1.4 && h.waveBanner.n > 1) {
    if (Math.floor(h.waveBanner.t * 8) % 2 === 0 || h.waveBanner.t > 0.5) {
      const label = `WAVE ${h.waveBanner.n}`;
      rect(ctx, 0, 70, VIEW.w, 13, PAL.ink);
      centerBig(ctx, label, VIEW.w / 2, 73, PAL.hot);
    }
  }
  if (h.hint) {
    // the hint sits low, unless someone is standing there; then it goes up top
    const tw = textWidth(h.hint) + 8;
    const x = (VIEW.w - tw) / 2;
    const y = !blocked(x, VIEW.h - 30, tw, 9) ? VIEW.h - 30 : !blocked(x, 20, tw, 9) ? 20 : -1;
    if (y >= 0) {
      plate(ctx, x, y, tw, 9);
      drawText(ctx, h.hint, x + 4, y + 2, PAL.cyan);
    }
  }
  void hidden;
}

function goalText(w: World): { text: string; color: string } {
  if (w.goal.kind === 'escape') return { text: 'REACH THE EXIT', color: PAL.fog };
  if (w.goal.kind === 'survive') return { text: `SURVIVE ${w.surviveLeft.toFixed(1)}`, color: PAL.fog };
  const n = redsLeft(w);
  return { text: `REDS LEFT ${n}`, color: n ? PAL.hot : PAL.fog };
}

/** Dims the whole view with a checkerboard of ink (no alpha in this game). */
export function dim(ctx: Ctx) {
  dither(ctx, 0, 0, VIEW.w, VIEW.h, PAL.ink);
}
