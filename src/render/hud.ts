// The heads-up display, on the UI layer (640×360 UI pixels): small paper cards in the corners with dark
// ink text, so the white world stays clear and the words read at a glance (docs/STYLE.md §8). Colour
// roles hold: cyan and tide for time and you, gold and amber for coins, red for danger.
import { ITEMS } from '../data/items';
import { PAL } from '../data/palette';
import { COINS, FRAMESKIP, TICK_RATE } from '../data/tuning';
import { TIER_VALUES } from '../data/upgrades';
import type { TimeState } from '../sim/time';
import type { World } from '../sim/types';
import { redsLeft } from '../sim/world';
import { icon, plate, UI, type Ui } from '../ui/kit';
import { measure, rich, richLines, richWidth, text } from '../ui/text';
import type { Atlas } from './atlas';
import { rect } from './prims';

export interface HudInfo {
  levelId: string;
  levelName: string;
  time: TimeState;
  rewinds: number;
  /** coins that have landed in the counter so far, so it ticks up as they arrive */
  coinsShown: number;
  /** the last WAVE / PHASE banner and real seconds since it went up */
  waveBanner: { label: string; t: number };
  hint: string;
  now: number;
  /** screen rectangles (game pixels) of the player and reds: a card over one of them steps aside */
  avoid: { x: number; y: number; w: number; h: number }[];
  /** keys as the player has bound them, for the hints */
  keys: { swap: string; dash: string };
}

let avoid: HudInfo['avoid'] = [];
let now = 0;
const hiddenAt: Record<string, number> = {};
/** Would the card `key` here (UI pixels) hide someone? Then it steps aside, and stays aside a moment so it
 *  doesn't flicker while you walk along under it. */
function blocked(key: string, x: number, y: number, w: number, h: number) {
  const s = UI.scale;
  if (avoid.some((a) => a.x * s < x + w + 4 && (a.x + a.w) * s > x - 4 && a.y * s < y + h + 4 && (a.y + a.h) * s > y - 4)) hiddenAt[key] = now;
  return now - (hiddenAt[key] ?? -99) < 0.6;
}

function card(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  plate(ctx, x, y, w, h, PAL.ink, PAL.stone);
  rect(ctx, x + 1, y + 1, w - 2, h - 2, PAL.paper);
}

export function drawHud(ui: Ui, w: World, atlas: Atlas, h: HudInfo) {
  const ctx = ui.ctx;
  avoid = h.avoid;
  now = h.now;
  const M = 6;

  // top left: where you are and what's left to do
  {
    const goal = goalText(w);
    const tw = Math.max(measure(h.levelId) + 6 + measure(h.levelName), richWidth(richLines(goal.text)[0])) + 14;
    if (!blocked('tl', M, M, tw, 32)) {
      card(ctx, M, M, tw, 32);
      text(ctx, h.levelId, M + 7, M + 6, PAL.iron);
      text(ctx, h.levelName, M + 7 + measure(h.levelId) + 6, M + 6, PAL.ink);
      rich(ctx, goal.text, M + 7, M + 19, { color: goal.color, accent: PAL.blood });
    }
  }

  // top middle: the time meter, cyan as it runs
  {
    const bw = 132, cw = bw + 50, x = Math.round((UI.w - cw) / 2);
    if (!blocked('tm', x, M, cw, 20)) {
      card(ctx, x, M, cw, 20);
      text(ctx, 'Time', x + 7, M + 6, PAL.tide);
      const bx = x + 42, by = M + 5;
      rect(ctx, bx, by, bw, 10, PAL.ink);
      rect(ctx, bx + 1, by + 1, bw - 2, 8, PAL.fog);
      const fill = Math.max(2, Math.round((bw - 2) * Math.min(1, h.time.scale)));
      rect(ctx, bx + 1, by + 1, fill, 8, PAL.tide);
      rect(ctx, bx + 1, by + 1, fill, 5, PAL.cyan);
      // where walking takes it
      rect(ctx, bx + 1 + Math.round((bw - 2) * h.time.walk) - 1, by - 2, 2, 14, PAL.ink);
    }
  }

  // top right: coins and the game clock against par
  {
    const coins = `${h.coinsShown}`;
    const secs = (w.tick / TICK_RATE).toFixed(1);
    const survive = w.goal.kind === 'survive';
    const overPar = !survive && !!w.par && w.tick / TICK_RATE > w.par;
    const clock = `${secs} s`, par = survive || !w.par ? '' : ` / par ${w.par}`;
    const cw = Math.max(measure(coins, 'shard') + 20, measure(clock) + measure(par)) + 14;
    const x = UI.w - M - cw;
    if (!blocked('tr', x, M, cw, 36)) {
      card(ctx, x, M, cw, 36);
      // the coin from the world, at game-pixel size
      if (atlas.has('coin')) drawAtlas(ctx, atlas, 'coin', 0, x + 11, M + 13);
      else icon(ctx, 'coin', x + 7, M + 8);
      text(ctx, coins, x + 20, M + 5, PAL.ink, { face: 'shard' });
      text(ctx, clock, x + 7, M + 22, overPar ? PAL.slate : PAL.ink);
      text(ctx, par, x + 7 + measure(clock), M + 22, PAL.iron);
    }
    if (w.combo.count > 1) {
      const t = `Combo ×${w.combo.count}`;
      const ww = measure(t) + 14, cx = UI.w - M - ww, cy = M + 42;
      plate(ctx, cx, cy, ww, 18, PAL.ink, PAL.stone);
      rect(ctx, cx + 1, cy + 1, ww - 2, 16, PAL.gold);
      text(ctx, t, cx + 7, cy + 4, PAL.ink);
      rect(ctx, cx + 1, cy + 15, Math.round((ww - 2) * (w.combo.timer / COINS.comboWindow)), 2, PAL.amber);
    }
  }

  // bottom left: what's in your hands, and what a click does with it
  {
    const p = w.player;
    const held = p.hands[0];
    const name = held ? ITEMS[held.kind].name : 'Fists';
    const gun = !!held && ITEMS[held.kind].gun;
    const loaded = gun && held!.ammo > 0;
    const sub = !held ? '[LMB] punch' : loaded ? '[LMB] shoot  [RMB] throw' : gun ? '*Empty* [LMB] throws it' : '[LMB] or [RMB] throws it';
    const pips = loaded ? held!.ammo * 4 + 4 : 0;
    const cw = Math.max(26 + measure(name) + pips, 26 + richWidth(richLines(sub)[0])) + 10;
    const y = UI.h - M - 36;
    if (!blocked('bl', M, y, cw, 36)) {
      card(ctx, M, y, cw, 36);
      rect(ctx, M + 5, y + 5, 18, 26, PAL.fog);
      if (held) drawAtlas(ctx, atlas, `item_${held.kind}`, 0, M + 14, y + 20);
      else fistIcon(ctx, M + 8, y + 10);
      text(ctx, name, M + 28, y + 6, PAL.ink);
      if (loaded) for (let i = 0; i < held!.ammo; i++) rect(ctx, M + 28 + measure(name) + 5 + i * 4, y + 6, 2, 8, PAL.ink);
      rich(ctx, sub, M + 28, y + 21, { color: PAL.iron, accent: PAL.blood });
    }
    if (p.hands[1]) {
      const n2 = `[${h.keys.swap}] ${ITEMS[p.hands[1].kind].name}`;
      const ww = richWidth(richLines(n2)[0]) + 14, x = M + cw + 6, yy = UI.h - M - 22;
      if (!blocked('q', x, yy, ww, 22)) {
        card(ctx, x, yy, ww, 22);
        rich(ctx, n2, x + 7, yy + 7, { color: PAL.iron });
      }
    }
  }

  // bottom right: abilities
  {
    const p = w.player;
    const rows: { label: string; fill: number; ready: boolean; pips?: number; of?: number }[] = [];
    if (w.mods.frameskip) rows.push({ label: `[${h.keys.dash}] Frameskip`, fill: 1 - p.dashCd / FRAMESKIP.cooldown[w.mods.frameskip], ready: p.dashCd <= 0 });
    if (w.mods.shield) rows.push({ label: 'Shield', fill: 0, ready: p.shield > 0, pips: p.shield, of: TIER_VALUES.shieldHits[w.mods.shield] });
    if (w.mods.rewind) rows.push({ label: 'Rewind', fill: 0, ready: h.rewinds > 0, pips: h.rewinds, of: TIER_VALUES.rewindCharges[w.mods.rewind] });
    if (rows.length) {
      const lw = Math.max(...rows.map((r) => richWidth(richLines(r.label)[0])));
      const cw = lw + 50, ch = rows.length * 16 + 8;
      const x = UI.w - M - cw, y = UI.h - M - ch;
      if (!blocked('br', x, y, cw, ch)) {
        card(ctx, x, y, cw, ch);
        rows.forEach((r, i) => {
          const ry = y + 7 + i * 16;
          rich(ctx, r.label, x + 7, ry + 1, { color: r.ready ? PAL.ink : PAL.slate });
          const bx = x + cw - 38;
          if (r.of !== undefined) {
            for (let k = 0; k < r.of; k++) {
              rect(ctx, bx + k * 12, ry, 10, 10, PAL.ink);
              rect(ctx, bx + k * 12 + 1, ry + 1, 8, 8, k < (r.pips ?? 0) ? PAL.cyan : PAL.fog);
            }
          } else {
            rect(ctx, bx, ry + 1, 32, 8, PAL.ink);
            rect(ctx, bx + 1, ry + 2, 30, 6, PAL.fog);
            rect(ctx, bx + 1, ry + 2, Math.round(30 * Math.max(0, Math.min(1, r.fill))), 6, r.ready ? PAL.cyan : PAL.tide);
          }
        });
      }
    }
  }

  // a banner up top, clear of the middle of the room where the fight is
  if (h.waveBanner.t < 1.4 && h.waveBanner.label && (Math.floor(h.waveBanner.t * 8) % 2 === 0 || h.waveBanner.t > 0.5)) {
    const tw = measure(h.waveBanner.label, 'shard') + 24, x = Math.round((UI.w - tw) / 2), y = 32;
    plate(ctx, x, y, tw, 23, PAL.ink, PAL.stone);
    rect(ctx, x + 1, y + 1, tw - 2, 21, PAL.paper);
    rect(ctx, x + 1, y + 19, tw - 2, 3, PAL.red);
    text(ctx, h.waveBanner.label, UI.w / 2, y + 5, PAL.ink, { face: 'shard', align: 'center' });
  }

  if (h.hint) {
    // the hint sits low, unless someone is standing there; then it goes up top
    const lw = richWidth(richLines(h.hint)[0]);
    const tw = lw + 18, x = Math.round((UI.w - tw) / 2);
    const y = !blocked('hint', x, UI.h - 66, tw, 22) ? UI.h - 66 : !blocked('hint-top', x, 62, tw, 22) ? 62 : -1;
    if (y >= 0) {
      plate(ctx, x, y, tw, 22, PAL.ink, PAL.stone);
      rect(ctx, x + 1, y + 1, tw - 2, 20, PAL.paper);
      rect(ctx, x + 1, y + 1, 3, 20, PAL.cyan);
      rich(ctx, h.hint, x + 11, y + 7, { color: PAL.ink, accent: PAL.tide });
    }
  }
}

function goalText(w: World): { text: string; color: string } {
  if (w.goal.kind === 'escape') return { text: 'Reach the *exit*', color: PAL.ink };
  if (w.goal.kind === 'survive') return { text: `{time} Survive *${w.surviveLeft.toFixed(1)} s*`, color: PAL.ink };
  const n = redsLeft(w);
  return n ? { text: `{red} *${n}* ${n === 1 ? 'red' : 'reds'} left`, color: PAL.ink } : { text: 'Room clear', color: PAL.tide };
}

/** An atlas sprite drawn on the UI layer at game-pixel size (each sprite pixel 2×2 UI pixels). */
export function drawAtlas(ctx: CanvasRenderingContext2D, atlas: Atlas, name: string, f: number, x: number, y: number) {
  if (!atlas.has(name)) return;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(UI.scale, UI.scale);
  atlas.draw(ctx, name, f, 0, 0);
  ctx.restore();
}

/** A fist, for empty hands: 12×16 UI pixels. */
function fistIcon(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const rows = ['.kkkkkkk..', 'kppkppkpk.', 'kppkppkppk', 'kppkppkppk', 'kpppppppk.', 'kkkppppk..', 'kpppppppk.', 'kppppppppk', '.kppppppk.', '..kpppppk.', '..kkkkkkk.'];
  rows.forEach((r, j) => {
    for (let i = 0; i < r.length; i++) {
      if (r[i] === '.') continue;
      ctx.fillStyle = r[i] === 'k' ? PAL.ink : PAL.paper;
      ctx.fillRect(x + i, y + j, 1, 1);
    }
  });
}
