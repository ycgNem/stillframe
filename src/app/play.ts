// A level being played: the time rule decides how many sim ticks run, input becomes TickInputs (recorded
// for the replay), events become effects and sound. Also the intro card, pause, death and Rewind.
import { botInput, newBot, type BotMemory } from '../bot/bot';
import { ITEMS } from '../data/items';
import { levelById } from '../data/levels';
import type { LevelDef } from '../data/levels/types';
import { PAL } from '../data/palette';
import { REWIND, TICK_RATE, TIME } from '../data/tuning';
import { TIER_VALUES } from '../data/upgrades';
import { record } from '../meta/save';
import { cloneWorld } from '../sim/hash';
import { pickTarget, reachOf } from '../sim/player';
import { createTime, spendBurst, startBurst, updateTime, type TimeState } from '../sim/time';
import type { Mods, SimEvent, TickInput, World } from '../sim/types';
import { createWorld, step } from '../sim/world';
import { Fx } from '../render/fx';
import { centerBig, centerText, drawText, wrap } from '../render/font';
import { drawHud } from '../render/hud';
import { LevelArt } from '../render/level';
import { dither, rect } from '../render/prims';
import { drawScene } from '../render/scene';
import { AIR, followCamera, newCamera, shake, VIEW, type Camera } from '../render/view';
import { star } from '../ui/kit';
import type { App, Screen } from './app';
import { playEvent } from './events';
import { MapScreen } from './map';
import { ReplayScreen } from './replay';
import { SettingsScreen } from './settings';

type Phase = 'intro' | 'play' | 'paused' | 'dead' | 'rewind';

export class PlayScreen implements Screen {
  readonly name = 'play';
  cursor: 'aim' | 'pointer' = 'pointer';
  readonly def: LevelDef;
  readonly mods: Mods;
  world: World;
  time: TimeState;
  fx: Fx;
  art: LevelArt;
  cam: Camera = newCamera();
  phase: Phase = 'intro';
  /** every TickInput so far, for the replay */
  rec: TickInput[] = [];
  private snaps: { tick: number; world: World }[] = [];
  rewinds = 0;
  private q = { fire: false, alt: false, pick: 0, swap: false, dash: false };
  private phaseT = 0;
  realTime = 0;
  private waveBanner = { n: 1, t: 9 };
  private coinsShown = 0;
  private ticksThisSecond = 0;
  private tps = 0;
  private tpsT = 0;
  private hover = 0;
  private moved = false;
  /** e2e and the console: the bot plays instead of you (app.autoplay) */
  private bot: BotMemory | null = null;
  private botNext: TickInput | null = null;

  constructor(
    private app: App,
    levelId: string,
    skipIntro = false,
  ) {
    this.def = levelById(levelId);
    this.mods = app.mods();
    this.world = createWorld(this.def, this.mods);
    this.time = createTime(this.mods.stride, this.mods.trigger);
    this.fx = new Fx(app.atlas);
    this.art = new LevelArt(this.def);
    this.rewinds = TIER_VALUES.rewindCharges[this.mods.rewind];
    if (skipIntro) this.begin();
    app.sound.playing = true;
  }

  private begin() {
    this.phase = 'play';
    this.cursor = 'aim';
    this.snaps = [{ tick: 0, world: cloneWorld(this.world) }];
  }

  restart() {
    this.app.goto(new PlayScreen(this.app, this.def.id, true));
  }

  /** The cursor as a point in the world: the floor under it, and the chest-height point it aims at. */
  private cursorWorld() {
    const m = this.app.input.mouse;
    return { x: m.x + this.cam.x, y: m.y + this.cam.y };
  }

  private aim() {
    const c = this.cursorWorld(), p = this.world.player;
    return Math.atan2(c.y + AIR - p.y, c.x - p.x);
  }

  private hoverItem(): number {
    const c = this.cursorWorld(), p = this.world.player;
    let best = 0, bestD = 8;
    for (const it of this.world.items) {
      const d = Math.hypot(it.x - c.x, it.y - c.y);
      if (d < bestD && Math.hypot(it.x - p.x, it.y - p.y) <= reachOf(this.world)) {
        best = it.id;
        bestD = d;
      }
    }
    return best;
  }

  private move() {
    if (this.bot && this.botNext) return { x: this.botNext.mx, y: this.botNext.my };
    const i = this.app.input;
    const axis = (neg: string, negAlt: string, pos: string, posAlt: string) =>
      (i.down(pos) || i.down(posAlt) ? 1 : 0) - (i.down(neg) || i.down(negAlt) ? 1 : 0);
    return { x: axis('KeyA', 'ArrowLeft', 'KeyD', 'ArrowRight'), y: axis('KeyW', 'ArrowUp', 'KeyS', 'ArrowDown') };
  }

  scale(realDt: number): number {
    const inp = this.app.input;
    this.phaseT += realDt;
    if (this.phase === 'intro') {
      if (inp.pressed('Escape')) this.app.goto(new MapScreen(this.app, this.def.id));
      else if (inp.pressed('Mouse0') || inp.pressed('Space') || inp.pressed('Enter')) this.begin();
      return 0;
    }
    if (this.phase === 'paused') return 0;
    if (this.phase === 'rewind') {
      if (this.phaseT > REWIND.realSeconds) {
        this.phase = 'play';
        this.phaseT = 0;
      }
      return 0;
    }
    if (this.phase === 'dead') {
      this.fx.tick(realDt * 0.3);
      if (inp.pressed('KeyR') || (this.phaseT > 0.4 && (inp.pressed('Mouse0') || inp.pressed('Space') || inp.pressed('Enter')))) this.restart();
      else if (inp.pressed('Escape')) this.app.goto(new MapScreen(this.app, this.def.id));
      return 0;
    }
    // playing
    if (inp.pressed('KeyR')) {
      this.restart();
      return 0;
    }
    if (inp.pressed('Escape')) {
      this.phase = 'paused';
      this.cursor = 'pointer';
      return 0;
    }
    this.realTime += realDt;
    this.app.save.played += realDt;
    const w = this.world, p = w.player;
    if (this.app.autoplay) {
      this.bot ??= newBot();
      this.botNext ??= botInput(w, this.bot);
      const b = this.botNext;
      if (b.fire || b.alt || b.pick) startBurst(this.time);
      return updateTime(this.time, b.mx || b.my ? 1 : 0, realDt);
    }
    this.hover = this.hoverItem();
    if (inp.pressed('Mouse0')) {
      if (this.hover) this.q.pick = this.hover;
      else this.q.fire = true;
    }
    if (inp.pressed('Mouse2') && p.hands.length) this.q.alt = true;
    if (inp.pressed('KeyE') && pickTarget(w, -1)) this.q.pick = -1;
    if ((inp.pressed('KeyQ') || inp.pressed('WheelUp') || inp.pressed('WheelDown')) && p.hands.length === 2) this.q.swap = true;
    if (inp.pressed('Space') && this.mods.frameskip > 0 && p.dashCd <= 0) {
      // Frameskip takes no game time: run its tick right now, whatever the time rule says
      this.q.dash = true;
      this.tick();
    }
    if (this.q.fire || this.q.alt || this.q.pick || this.q.swap) startBurst(this.time);
    // the debug sliders may have changed TIME
    this.time.walk = TIME.walk * TIER_VALUES.strideWalk[this.mods.stride];
    this.time.burstLen = this.mods.trigger ? TIER_VALUES.triggerBurst[this.mods.trigger] : TIME.burst;
    const m = this.move();
    if (m.x || m.y) this.moved = true;
    this.tpsT += realDt;
    if (this.tpsT >= 1) {
      this.tps = this.ticksThisSecond / this.tpsT;
      this.ticksThisSecond = 0;
      this.tpsT = 0;
    }
    return updateTime(this.time, m.x || m.y ? 1 : 0, realDt);
  }

  tick() {
    if (this.phase !== 'play') return;
    const w = this.world;
    const m = this.move();
    let input: TickInput = { mx: m.x, my: m.y, aim: this.aim(), fire: this.q.fire, alt: this.q.alt, pick: this.q.pick, swap: this.q.swap, dash: this.q.dash };
    if (this.bot) {
      input = this.botNext ?? botInput(w, this.bot);
      this.botNext = null;
    }
    this.rec.push(input);
    const events = step(w, input);
    this.ticksThisSecond++;
    if (this.bot && w.status === 'play') this.botNext = botInput(w, this.bot);
    this.q.alt = this.q.alt && !events.some((e) => e.t === 'throw' && e.from === 'player') && w.player.hands.length > 0;
    this.q.pick = 0;
    this.q.swap = false;
    this.q.dash = false;
    if (events.some((e) => (e.t === 'shot' || e.t === 'punch' || e.t === 'throw') && (!('from' in e) || e.from === 'player'))) this.q.fire = false;
    spendBurst(this.time, 1 / TICK_RATE);
    this.fx.tick(1 / TICK_RATE);
    for (const e of events) this.onEvent(e);
    if (w.tick % Math.round(REWIND.every * TICK_RATE) === 0 && w.status === 'play') {
      this.snaps.push({ tick: w.tick, world: cloneWorld(w) });
      const keep = Math.round(REWIND.keep / REWIND.every) + 1;
      if (this.snaps.length > keep) this.snaps.shift();
    }
  }

  private onEvent(e: SimEvent) {
    const w = this.world;
    playEvent(this.app.sound, e, 'player');
    this.fx.event(e, w);
    const st = this.app.save.settings;
    if (e.t === 'shatter' && st.shake) shake(this.cam, e.kind === 'manager' ? 4 : 2, 0.15);
    if (e.t === 'wave') {
      this.waveBanner = { n: e.n, t: 0 };
      if (this.mods.rewind >= 3) this.rewinds = TIER_VALUES.rewindCharges[this.mods.rewind];
    }
    if (e.t === 'death') {
      if (this.rewinds > 0 && this.snaps.length) this.rewind();
      else {
        this.phase = 'dead';
        this.phaseT = 0;
        this.cursor = 'pointer';
        this.app.save.deaths++;
        this.app.persist();
        if (st.shake) shake(this.cam, 4, 0.3);
      }
    }
    if (e.t === 'clear') {
      this.app.persist();
      this.app.goto(new ReplayScreen(this.app, this));
    }
  }

  /** Rewind: back to the snapshot about 2 game seconds ago; the replay forgets what was undone. */
  private rewind() {
    const target = this.world.tick - Math.round(REWIND.back * TICK_RATE);
    let snap = this.snaps[0];
    for (const s of this.snaps) if (s.tick <= target) snap = s;
    const used = this.world.stats.rewinds + 1;
    this.world = cloneWorld(snap.world);
    this.world.stats.rewinds = used;
    this.rec.length = snap.tick;
    this.snaps = this.snaps.filter((s) => s.tick <= snap.tick);
    this.rewinds--;
    this.phase = 'rewind';
    this.phaseT = 0;
    this.q = { fire: false, alt: false, pick: 0, swap: false, dash: false };
    this.time.scale = TIME.idle;
    this.time.burst = 0;
    this.fx.shards = this.fx.shards.filter((s) => s.rest);
    this.app.sound.play('rewind');
  }

  frame(realDt: number, alpha: number) {
    const ctx = this.app.display.ctx, w = this.world, p = w.player;
    const m = this.app.input.mouse;
    const px = p.px + (p.x - p.px) * alpha, py = p.py + (p.y - p.py) * alpha;
    followCamera(this.cam, w, px, py, this.phase === 'play' ? m.x : VIEW.w / 2, this.phase === 'play' ? m.y : VIEW.h / 2, realDt, this.realTime === 0 && this.phase !== 'play');
    this.fx.real(realDt, this.cam, { x: 0, y: 0 });
    this.app.sound.update(realDt, this.phase === 'play' ? this.time.scale : this.phase === 'dead' ? 0.05 : 0);
    if (this.phase === 'play') this.waveBanner.t += realDt;
    const coins = w.stats.killCoins + w.stats.comboCoins + w.stats.styleCoins;
    if (this.coinsShown < coins && (this.fx.arrived > 0 || !this.fx.coins.length)) {
      this.coinsShown = Math.min(coins, this.coinsShown + Math.max(1, this.fx.arrived));
      if (this.fx.arrived) this.app.sound.play('coin', 0.6);
      this.fx.arrived = 0;
    }
    drawScene(ctx, w, this.art, this.app.atlas, this.fx, this.cam, alpha, {
      aim: this.phase === 'play' ? this.aim() : p.aim, hoverItem: this.phase === 'play' ? this.hover : 0, now: this.app.now, showPlayer: true, aimReach: this.phase === 'play' ? this.aimReach() : 0,
    });
    if (this.fx.flash > 0 && !this.app.save.settings.flash) dither(ctx, 0, 0, VIEW.w, VIEW.h, PAL.paper);
    if (this.phase !== 'intro') {
      drawHud(ctx, w, this.app.atlas, {
        levelId: this.def.id, levelName: this.def.name, time: this.time, rewinds: this.rewinds, coinsShown: this.coinsShown,
        waveBanner: this.waveBanner, hint: this.phase === 'play' ? this.hint() : '', now: this.app.now,
        avoid: this.bodiesOnScreen(alpha),
      });
    }
    if (this.phase === 'intro') this.drawIntro();
    else if (this.phase === 'paused') this.drawPause();
    else if (this.phase === 'dead') this.drawDead();
    else if (this.phase === 'rewind') this.drawRewind();
    if (this.app.debug) this.drawDebug();
  }

  /** From you to the cursor, in world pixels. */
  private aimReach() {
    const c = this.cursorWorld(), p = this.world.player;
    return Math.hypot(c.x - p.x, c.y + AIR - p.y);
  }

  /** Where the player and the reds are drawn, so the HUD can keep out of their way. */
  private bodiesOnScreen(alpha: number) {
    const w = this.world, out: { x: number; y: number; w: number; h: number }[] = [];
    const add = (b: { x: number; y: number; px: number; py: number }, tall: number, wide: number) => {
      const x = b.px + (b.x - b.px) * alpha - this.cam.x, y = b.py + (b.y - b.py) * alpha - this.cam.y;
      out.push({ x: x - wide / 2, y: y - tall, w: wide, h: tall + 3 });
    };
    add(w.player, 24, 14);
    for (const r of w.reds) add(r, r.kind === 'manager' ? 40 : r.kind === 'brute' ? 34 : 26, r.kind === 'grunt' || r.kind === 'gunner' ? 14 : 24);
    return out;
  }

  /** Tutorial lines for the first levels, depending on what you've done so far. */
  private hint(): string {
    const w = this.world, p = w.player, id = this.def.id;
    if (id === '1-1') {
      if (!this.moved) return 'WASD MOVES. TIME MOVES ONLY WHEN YOU DO.';
      if (!p.hands.length && w.items.some((i) => i.kind === 'pistol') && w.stats.pickups === 0) return 'CLICK THE PISTOL TO PICK IT UP';
      if (p.hands[0] && ITEMS[p.hands[0].kind].gun && w.stats.shots === 0) return 'AIM WITH THE MOUSE. CLICK TO SHOOT.';
      if (w.stats.kills === 0 && w.tick > 240) return 'STAND STILL TO THINK. WATCH THE RED LINES.';
      if (p.hands[0] && p.hands[0].ammo === 0) return 'EMPTY? CLICK TO THROW IT. THEN PUNCH.';
      return '';
    }
    if (id === '1-2' && w.stats.punches === 0 && !p.hands.length) return 'NO GUN? CLICK UP CLOSE TO PUNCH. A PUNCH KNOCKS A GUN LOOSE.';
    if (id === '1-3' && w.stats.throws === 0) return 'RIGHT CLICK THROWS WHAT YOU HOLD. E PICKS UP.';
    if (id === '1-5' && w.tick < 180) return 'MORE COME THROUGH THE DOORS.';
    if (id === '1-8' && w.tick < 240) return 'SHOOT A DESK IN THE AIR TO BREAK IT.';
    return '';
  }

  private drawIntro() {
    const ctx = this.app.display.ctx, ui = this.app.ui, d = this.def;
    ui.begin();
    ui.dim();
    const x = 40, y = 22, w = 240, h = 132;
    ui.panel(x, y, w, h);
    drawText(ctx, `LEVEL ${d.id}`, x + 8, y + 7, PAL.slate);
    const goal = d.goal.kind === 'clear' ? 'SHATTER EVERY RED' : d.goal.kind === 'escape' ? 'REACH THE EXIT' : `SURVIVE ${d.goal.seconds} SECONDS`;
    drawText(ctx, goal, x + w - 8 - goal.length * 4 + 1, y + 7, PAL.hot);
    centerBig(ctx, d.name, VIEW.w / 2, y + 18, PAL.paper, 2);
    const rec = record(this.app.save, d.id);
    const rows: [string, string, number][] = [['CLEAR', 'FINISH THE LEVEL', 0], ['PAR', `UNDER ${d.par} GAME SECONDS`, 1], ['CHALLENGE', d.challengeText, 2]];
    rows.forEach(([a, b, i], k) => {
      const ry = y + 42 + k * 11;
      star(ctx, x + 10, ry - 1, rec.stars[i]);
      drawText(ctx, a, x + 22, ry, PAL.stone);
      drawText(ctx, b, x + 66, ry, PAL.fog);
    });
    const tip = wrap(d.tip, w - 20);
    tip.forEach((l, i) => centerText(ctx, l, VIEW.w / 2, y + 80 + i * 7, PAL.cyan));
    if (rec.best) centerText(ctx, `BEST ${(rec.best / TICK_RATE).toFixed(1)} S`, VIEW.w / 2, y + 98, PAL.slate);
    if (ui.button('start', VIEW.w / 2 - 40, y + h - 22, 80, 14, 'START', { primary: true })) this.begin();
    if (ui.button('back', x + 6, y + h - 20, 34, 11, 'MAP')) this.app.goto(new MapScreen(this.app, d.id));
    drawText(ctx, 'ESC', x + w - 20, y + h - 17, PAL.iron);
    ui.end();
  }

  private drawPause() {
    const ctx = this.app.display.ctx, ui = this.app.ui;
    ui.begin();
    ui.dim();
    ui.panel(100, 40, 120, 100);
    centerBig(ctx, 'PAUSED', VIEW.w / 2, 48, PAL.paper);
    const resume = ui.button('resume', 115, 64, 90, 14, 'RESUME', { primary: true }) || this.app.input.pressed('Escape');
    if (resume) {
      this.phase = 'play';
      this.cursor = 'aim';
    }
    if (ui.button('restart', 115, 82, 90, 14, 'RESTART (R)')) this.restart();
    if (ui.button('settings', 115, 100, 90, 14, 'SETTINGS')) this.app.goto(new SettingsScreen(this.app, this));
    if (ui.button('quit', 115, 118, 90, 14, 'QUIT TO MAP')) this.app.goto(new MapScreen(this.app, this.def.id));
    ui.end();
  }

  /** Back from the settings screen. */
  resumeFromSettings() {
    this.phase = 'paused';
    this.app.applySettings();
  }

  private drawDead() {
    const ctx = this.app.display.ctx;
    const t = this.phaseT;
    if (t > 0.15) {
      rect(ctx, 0, 72, VIEW.w, 34, PAL.ink);
      centerBig(ctx, 'SHATTERED', VIEW.w / 2, 76, PAL.red, 2);
      if (t > 0.5) centerText(ctx, 'R OR CLICK TO TRY AGAIN    ESC: MAP', VIEW.w / 2, 96, Math.floor(t * 2) % 2 ? PAL.fog : PAL.stone);
    }
  }

  private drawRewind() {
    const ctx = this.app.display.ctx;
    // VHS: rows slip sideways, a band rolls up the screen
    const t = this.phaseT;
    for (let y = 0; y < VIEW.h; y += 3) {
      const off = Math.round(Math.sin(y * 0.3 + t * 40) * 3);
      if ((y + Math.floor(t * 60)) % 9 === 0) rect(ctx, 0, y, VIEW.w, 1, PAL.coal);
      if (off) ctx.drawImage(ctx.canvas, 0, y, VIEW.w, 1, off, y, VIEW.w, 1);
    }
    const band = VIEW.h - ((t / REWIND.realSeconds) * (VIEW.h + 20)) % (VIEW.h + 20);
    dither(ctx, 0, band, VIEW.w, 6, PAL.tide);
    drawText(ctx, '<< REWIND', 10, 24, PAL.cyan, 2);
  }

  private drawDebug() {
    const ctx = this.app.display.ctx, w = this.world;
    const lines = [
      `SCALE ${this.time.scale.toFixed(3)}`,
      `TICKS/S ${this.tps.toFixed(1)}`,
      `BURST ${this.time.burst.toFixed(3)}`,
      `GAME ${(w.tick / TICK_RATE).toFixed(2)} S`,
      `REAL ${this.realTime.toFixed(2)} S`,
      `REDS ${w.reds.length} BULLETS ${w.bullets.length}`,
      `SHARDS ${this.fx.shards.length}`,
    ];
    rect(ctx, 2, 30, 92, lines.length * 7 + 4, PAL.ink);
    lines.forEach((l, i) => drawText(ctx, l, 4, 32 + i * 7, PAL.cyan));
  }
}
