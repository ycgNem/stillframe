// A level being played: the time rule decides how many sim ticks run, input becomes TickInputs (recorded
// for the replay), events become effects and sound. Also the intro card, pause, death and Rewind.
import { botInput, newBot, type BotMemory } from '../bot/bot';
import { ITEMS } from '../data/items';
import { levelById } from '../data/levels';
import type { LevelDef } from '../data/levels/types';
import { PAL } from '../data/palette';
import { REDS } from '../data/reds';
import { REWIND, TICK_RATE, TIME } from '../data/tuning';
import { TIER_VALUES } from '../data/upgrades';
import { newIn } from '../meta/novelty';
import { record } from '../meta/save';
import { keepSnap, newRewind, rewind, type RewindBuffer } from '../meta/rewind';
import { pickTarget, punchTarget, reachOf } from '../sim/player';
import { createTime, spendBurst, startBurst, updateTime, type TimeState } from '../sim/time';
import type { Hazard, Mods, SimEvent, TickInput, World } from '../sim/types';
import { createWorld, step } from '../sim/world';
import { Fx } from '../render/fx';
import { drawHud } from '../render/hud';
import { LevelArt } from '../render/level';
import { dither, line, rect, ring } from '../render/prims';
import { drawScene } from '../render/scene';
import { AIR, followCamera, newCamera, shake, VIEW, type Camera } from '../render/view';
import { bigStar, plate, UI } from '../ui/kit';
import { measure, rich, richLines, text } from '../ui/text';
import type { App, Screen } from './app';
import { playEvent } from './events';
import { keyLabel } from './keys';
import { MapScreen } from './map';
import { ReplayScreen } from './replay';
import { SettingsScreen } from './settings';

type Phase = 'intro' | 'play' | 'paused' | 'dead' | 'rewind' | 'won';

/** Real seconds: the freeze after each shatter, after a boss's, the beat after the last kill (longer for a
 *  boss), and how long a death holds before any text covers it. */
const HIT_STOP = 0.05;
const BOSS_STOP = 1.0;
const WON_HOLD = 0.7;
const BOSS_WON_HOLD = 1.8;
const DEATH_HOLD = 0.6;

/** A run of levels (the Gauntlet): what happens when one is won or lost, instead of the replay or a retry. */
export interface PlayRun {
  /** waves before this level's first, so the banner counts the whole run */
  waveOffset: number;
  won(screen: PlayScreen): void;
  lost(screen: PlayScreen): void;
}

export class PlayScreen implements Screen {
  readonly name = 'play';
  cursor: 'aim' | 'pointer' | 'none' = 'pointer';
  cursorLock = false;
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
  private snaps: RewindBuffer | null = null;
  rewinds = 0;
  private q = { fire: false, alt: false, pick: 0, swap: false, dash: false };
  private phaseT = 0;
  realTime = 0;
  private waveBanner = { label: '', t: 9 };
  /** real seconds of hit-stop left */
  private stopT = 0;
  /** real seconds since a boss shattered (-1: not yet), and its name */
  private bossT = -1;
  private bossName = '';
  /** the red that got you */
  private killer = 0;
  /** what killed you when it wasn't a red: a train, the hook, the beat */
  private killedBy: Hazard | undefined;
  /** what this level shows for the first time, for the intro card */
  private news: string[];
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
    level: string | LevelDef,
    skipIntro = false,
    /** the run this level belongs to (the Gauntlet), which takes over at a clear or a death */
    readonly run: PlayRun | null = null,
  ) {
    this.def = typeof level === 'string' ? levelById(level) : level;
    this.news = run ? [] : newIn(this.def.id);
    this.mods = app.mods();
    this.world = createWorld(this.def, this.mods);
    this.time = createTime(this.mods.stride, this.mods.trigger, this.def.glitch === 'inverse');
    this.fx = new Fx(app.atlas);
    this.art = new LevelArt(this.def);
    this.rewinds = TIER_VALUES.rewindCharges[this.mods.rewind];
    if (skipIntro) this.begin();
    app.sound.playing = true;
  }

  private get keys() {
    return this.app.save.settings.keys;
  }

  private begin() {
    this.phase = 'play';
    this.cursor = 'aim';
    this.snaps = newRewind(this.world);
  }

  restart() {
    if (this.run) this.run.lost(this);
    else this.app.goto(new PlayScreen(this.app, this.def.id, true));
  }

  /** Leaving for the map (or, in a run, ending it). */
  private quit() {
    if (this.run) this.run.lost(this);
    else this.app.goto(new MapScreen(this.app, this.def.id));
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

  /** The item under the cursor, and whether it is out of reach. A red under the cursor wins: you meant it. */
  private hoverItem(): { id: number; far: boolean } {
    const c = this.cursorWorld(), w = this.world, p = w.player;
    if (w.reds.some((r) => !r.dead && Math.abs(c.x - r.x) <= r.r + 2 && c.y <= r.y + 3 && c.y >= r.y - REDS[r.kind].tall)) return { id: 0, far: false };
    let best = 0, bestD = 8, far = false;
    for (const it of w.items) {
      const d = Math.hypot(it.x - c.x, it.y - c.y);
      if (d >= bestD) continue;
      best = it.id;
      bestD = d;
      far = Math.hypot(it.x - p.x, it.y - p.y) > reachOf(w);
    }
    return { id: best, far };
  }

  /** The window lost focus: don't let time creep on without you. */
  blur() {
    if (this.phase !== 'play' || this.app.autoplay) return;
    this.phase = 'paused';
    this.cursor = 'pointer';
  }

  private move() {
    if (this.bot && this.botNext) return { x: this.botNext.mx, y: this.botNext.my };
    const i = this.app.input, k = this.keys;
    const axis = (neg: string, negAlt: string, pos: string, posAlt: string) =>
      (i.down(pos) || i.down(posAlt) ? 1 : 0) - (i.down(neg) || i.down(negAlt) ? 1 : 0);
    return { x: axis(k.left, 'ArrowLeft', k.right, 'ArrowRight'), y: axis(k.up, 'ArrowUp', k.down, 'ArrowDown') };
  }

  scale(realDt: number): number {
    const inp = this.app.input, k = this.keys;
    this.phaseT += realDt;
    if (this.phase === 'intro') return 0;
    if (this.phase === 'paused') return 0;
    if (this.phase === 'rewind') {
      if (this.phaseT > REWIND.realSeconds) {
        this.phase = 'play';
        this.phaseT = 0;
      }
      return 0;
    }
    if (this.phase === 'won') {
      if (this.phaseT > (this.bossT >= 0 ? BOSS_WON_HOLD : WON_HOLD)) {
        if (this.run) this.run.won(this);
        else this.app.goto(new ReplayScreen(this.app, this));
      }
      return 0;
    }
    if (this.phase === 'dead') {
      this.fx.tick(realDt * 0.3, this.world);
      if (inp.pressed(k.restart) || (this.phaseT > DEATH_HOLD && (inp.pressed('Mouse0') || inp.pressed('Space') || inp.pressed('Enter')))) this.restart();
      else if (inp.pressed('Escape')) this.quit();
      return 0;
    }
    // playing
    if (inp.pressed(k.restart)) {
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
    const hover = this.hoverItem();
    this.hover = hover.far ? 0 : hover.id;
    if (inp.pressed('Mouse0')) {
      if (this.hover) this.q.pick = this.hover;
      else if (hover.far) {
        // a click on something out of reach does nothing (it used to throw what you held)
        const it = w.items.find((i) => i.id === hover.id);
        if (it) this.fx.popup('Too far', it.x, it.y - 10, PAL.iron);
      } else this.q.fire = true;
    }
    if (inp.pressed('Mouse2') && p.hands.length) this.q.alt = true;
    if (inp.pressed(k.pick) && pickTarget(w, -1)) this.q.pick = -1;
    if ((inp.pressed(k.swap) || inp.pressed('WheelUp') || inp.pressed('WheelDown')) && p.hands.length === 2) this.q.swap = true;
    if (inp.pressed(k.dash) && this.mods.frameskip > 0 && p.dashCd <= 0) {
      // Frameskip takes no game time: run its tick right now, whatever the time rule says
      this.q.dash = true;
      this.tick();
    }
    if (this.q.fire || this.q.alt || this.q.pick || this.q.swap) startBurst(this.time);
    // the debug sliders may have changed TIME
    this.time.walk = TIME.walk / TIER_VALUES.strideSpeed[this.mods.stride];
    this.time.burstLen = this.mods.trigger ? TIER_VALUES.triggerBurst[this.mods.trigger] : TIME.burst;
    const m = this.move();
    if (m.x || m.y) this.moved = true;
    this.tpsT += realDt;
    if (this.tpsT >= 1) {
      this.tps = this.ticksThisSecond / this.tpsT;
      this.ticksThisSecond = 0;
      this.tpsT = 0;
    }
    if (this.stopT > 0) {
      // hit-stop: everything holds for a beat (what you pressed waits for it)
      this.stopT -= realDt;
      return 0;
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
    this.fx.tick(1 / TICK_RATE, w);
    for (const e of events) this.onEvent(e);
    if (this.snaps) keepSnap(this.snaps, w);
  }

  private onEvent(e: SimEvent) {
    const w = this.world;
    playEvent(this.app.sound, e, 'player');
    this.fx.event(e, w);
    const st = this.app.save.settings;
    if (e.t === 'shatter') {
      // the Frame is its eyes: it breaks with the last of them
      const frame = e.kind === 'eye' && !w.reds.some((r) => r.kind === 'eye' && !r.dead);
      const boss = !!REDS[e.kind].boss || frame;
      if (st.shake) shake(this.cam, boss ? 4 : 2, 0.15);
      if (boss) {
        this.bossT = 0;
        this.bossName = frame ? 'The Frame' : REDS[e.kind].name;
        this.stopT = BOSS_STOP;
        this.fx.flash = 0.15;
      } else this.stopT = Math.max(this.stopT, HIT_STOP);
    }
    if ((e.t === 'land' || e.t === 'drop') && st.shake) shake(this.cam, e.t === 'land' ? 4 : 2, 0.2);
    if (e.t === 'train' && st.shake) shake(this.cam, 1, 0.5);
    if (e.t === 'phase') this.waveBanner = { label: `PHASE ${e.n + 1}`, t: 0 };
    if (e.t === 'wave') {
      // the help a boss phase calls in keeps the PHASE banner
      const phase = this.waveBanner.t === 0 && this.waveBanner.label.startsWith('PHASE');
      // a run's arenas start empty, so their first wave through the doors is wave 1, not 2
      const n = this.run ? e.n - 1 + this.run.waveOffset : e.n;
      if ((e.n > 1 || this.run) && !phase) this.waveBanner = { label: `WAVE ${n}`, t: 0 };
      if (this.mods.rewind >= 3) this.rewinds = TIER_VALUES.rewindCharges[this.mods.rewind];
    }
    if (e.t === 'death') {
      if (this.rewinds > 0 && this.snaps) this.rewind();
      else {
        this.phase = 'dead';
        this.phaseT = 0;
        this.cursor = 'pointer';
        this.killer = e.by;
        this.killedBy = e.what;
        this.app.save.deaths++;
        this.app.persist();
        if (st.shake) shake(this.cam, 4, 0.3);
      }
    }
    if (e.t === 'clear') {
      // a beat with everything frozen mid-air, then the replay
      this.app.persist();
      this.phase = 'won';
      this.phaseT = 0;
      this.cursor = 'none';
    }
  }

  /** Rewind: back to the snapshot about 2 game seconds ago; the replay forgets what was undone. */
  private rewind() {
    this.world = rewind(this.snaps!, this.world, this.rec);
    this.rewinds--;
    this.phase = 'rewind';
    this.phaseT = 0;
    this.q = { fire: false, alt: false, pick: 0, swap: false, dash: false };
    this.stopT = 0;
    this.time.scale = TIME.idle;
    this.time.burst = 0;
    this.fx.shards = this.fx.shards.filter((s) => s.rest);
    this.app.sound.play('rewind');
  }

  frame(realDt: number, alpha: number) {
    const ctx = this.app.world, ui = this.app.ui, w = this.world, p = w.player;
    const m = this.app.input.mouse;
    const px = p.px + (p.x - p.px) * alpha, py = p.py + (p.y - p.py) * alpha;
    followCamera(this.cam, w, px, py, this.phase === 'play' ? m.x : VIEW.w / 2, this.phase === 'play' ? m.y : VIEW.h / 2, realDt, this.realTime === 0 && this.phase !== 'play');
    this.fx.real(realDt, this.cam, { x: 0, y: 0 });
    this.app.sound.update(realDt, this.phase === 'play' ? this.time.scale : this.phase === 'dead' ? 0.05 : 0);
    if (this.phase === 'play') this.waveBanner.t += realDt;
    if (this.bossT >= 0) this.bossT += realDt;
    this.cursorLock = this.phase === 'play' && !p.hands.length && !!punchTarget(w, this.aim());
    const coins = w.stats.killCoins + w.stats.comboCoins + w.stats.styleCoins;
    if (this.coinsShown < coins && (this.fx.arrived > 0 || !this.fx.coins.length)) {
      this.coinsShown = Math.min(coins, this.coinsShown + Math.max(1, this.fx.arrived));
      if (this.fx.arrived) this.app.sound.play('coin', 0.6);
      this.fx.arrived = 0;
    }
    drawScene(ctx, w, this.art, this.app.atlas, this.fx, this.cam, alpha, {
      aim: this.phase === 'play' ? this.aim() : p.aim, hoverItem: this.phase === 'play' ? this.hover : 0, now: this.app.now, showPlayer: true,
      aimReach: this.phase === 'play' ? this.aimReach() : 0, ui: ui.ctx, outline: this.app.save.settings.outline, calm: this.app.save.settings.flash, strobe: !!this.def.strobe,
    });
    if (this.fx.flash > 0 && !this.app.save.settings.flash) dither(ctx, 0, 0, VIEW.w, VIEW.h, PAL.paper);
    ui.begin();
    if (this.phase !== 'intro') {
      drawHud(ui, w, this.app.atlas, {
        levelId: this.run ? 'Gauntlet' : this.def.id, levelName: this.run ? `${this.def.name} · wave ${this.run.waveOffset + Math.max(1, w.waves.next)}` : this.def.name, time: this.time, rewinds: this.rewinds, coinsShown: this.coinsShown,
        waveBanner: this.waveBanner, hint: this.phase === 'play' ? this.hint() : '', now: this.app.now,
        avoid: this.bodiesOnScreen(alpha), keys: { swap: keyLabel(this.keys.swap), dash: keyLabel(this.keys.dash) },
      });
    }
    if (this.phase === 'intro') this.drawIntro();
    else if (this.phase === 'paused') this.drawPause();
    else if (this.phase === 'dead') this.drawDead();
    else if (this.phase === 'rewind') this.drawRewind();
    else if (this.phase === 'won') this.drawWon();
    if (this.bossT >= 0 && this.bossT < BOSS_WON_HOLD) this.drawBossCard();
    if (this.app.debug) this.drawDebug();
    ui.end();
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
    for (const r of w.reds) add(r, REDS[r.kind].tall + 4, Math.max(14, r.r * 3.5));
    return out;
  }

  /** Tutorial lines for the first levels of each chapter, depending on what you've done so far. */
  private hint(): string {
    const w = this.world, p = w.player, id = this.def.id, k = this.keys;
    const keys = `[${keyLabel(k.up)}][${keyLabel(k.left)}][${keyLabel(k.down)}][${keyLabel(k.right)}]`;
    if (id === '1-1') {
      if (!this.moved) return `${keys} move. *Time moves only when you do.*`;
      if (!p.hands.length && w.items.some((i) => i.kind === 'pistol') && w.stats.pickups === 0) return '[LMB] the *pistol* to pick it up';
      if (p.hands[0] && ITEMS[p.hands[0].kind].gun && w.stats.shots === 0) return 'Aim with the mouse. [LMB] shoots.';
      if (w.stats.kills === 0 && w.tick > 240) return 'Stand still to think. Watch the *red lines*.';
      if (p.hands[0] && p.hands[0].ammo === 0) return 'Empty? [LMB] throws it. Then punch.';
      return '';
    }
    if (id === '1-2' && w.stats.punches === 0 && !p.hands.length) return 'No gun? [LMB] up close to *punch*. A punch knocks a gun loose.';
    if (id === '1-3' && w.stats.throws === 0) return `[RMB] *throws* what you hold. [${keyLabel(k.pick)}] picks up.`;
    if (id === '1-5' && w.tick < 180) return 'More come through the *doors*.';
    if (id === '1-8' && w.tick < 240) return 'Shoot a *desk* in the air to break it.';
    return this.def.hint && w.tick < 300 ? this.def.hint : '';
  }

  private drawIntro() {
    const ui = this.app.ui, ctx = ui.ctx, d = this.def, inp = this.app.input;
    ui.veil();
    const w = 420, tipLines = richLines(d.tip, w - 48).length;
    const news = this.news.length ? 24 : 0;
    const h = 214 + tipLines * 15 + news, x = (UI.w - w) / 2, y = Math.round((UI.h - h) / 2);
    ui.card(x, y, w, h);
    ui.chip(x + 12, y + 12, `Level ${d.id}`, PAL.fog);
    const goal = d.goal.kind === 'clear' ? 'Shatter every red' : d.goal.kind === 'escape' ? 'Reach the exit' : `Survive ${d.goal.seconds} seconds`;
    const gw = measure(goal) + 8;
    ui.chip(x + w - 12 - gw, y + 12, goal, d.goal.kind === 'clear' ? PAL.red : PAL.cyan, d.goal.kind === 'clear' ? PAL.paper : PAL.ink);
    text(ctx, d.name.toUpperCase(), UI.w / 2, y + 36, PAL.ink, { face: 'shard', scale: measure(d.name.toUpperCase(), 'shard', 2) > w - 24 ? 1 : 2, align: 'center' });
    rect(ctx, x + 12, y + 68, w - 24, 1, PAL.fog);
    const rec = record(this.app.save, d.id);
    const rows: [string, string][] = [['Clear', 'Finish the level'], ['Par', d.goal.kind === 'survive' ? 'Comes with surviving' : `Under ${d.par} game seconds`], ['Challenge', d.challengeText]];
    rows.forEach(([a, b], i) => {
      const ry = y + 78 + i * 20;
      bigStar(ctx, x + 16, ry - 3, rec.stars[i]);
      text(ctx, a, x + 36, ry, PAL.ink);
      text(ctx, b, x + 112, ry, PAL.iron);
    });
    // the tip, on a tinted strip with a cyan edge
    const th = 14 + tipLines * 15;
    rect(ctx, x + 12, y + 142, w - 24, th, PAL.fog);
    rect(ctx, x + 12, y + 142, 3, th, PAL.cyan);
    rich(ctx, d.tip, x + 24, y + 151, { color: PAL.ink, accent: PAL.tide, maxW: w - 48 });
    if (news) {
      // what's new here, on red chips: the first time you meet it
      let nx = x + 12;
      const ny = y + 150 + th;
      text(ctx, 'New', nx, ny + 3, PAL.iron);
      nx += measure('New') + 8;
      for (const n of this.news) {
        ui.chip(nx, ny, n, PAL.red, PAL.paper);
        nx += measure(n) + 14;
      }
    }
    if (rec.best) text(ctx, `Best ${(rec.best / TICK_RATE).toFixed(1)} s`, x + 12, y + h - 58, PAL.tide);
    if (ui.button('back', x + 12, y + h - 40, 110, 28, 'Map', { cap: 'Esc', key: 'Escape' })) this.app.goto(new MapScreen(this.app, d.id));
    const go = ui.button('start', x + w - 182, y + h - 40, 170, 28, 'Start', { kind: 'primary', cap: 'Space' });
    if (go || inp.pressed('Space') || inp.pressed('Enter')) this.begin();
  }

  private drawPause() {
    const ui = this.app.ui;
    ui.veil();
    const w = 240, h = 196, x = (UI.w - w) / 2, y = (UI.h - h) / 2;
    ui.card(x, y, w, h);
    ui.text('PAUSED', UI.w / 2, y + 14, PAL.ink, { face: 'shard', align: 'center' });
    const bx = x + 20, bw = w - 40;
    const resume = ui.button('resume', bx, y + 40, bw, 28, 'Resume', { kind: 'primary', cap: 'Esc' }) || this.app.input.pressed('Escape');
    if (resume) {
      this.phase = 'play';
      this.cursor = 'aim';
    }
    if (ui.button('restart', bx, y + 76, bw, 28, this.run ? 'Give up' : 'Restart', { cap: keyLabel(this.keys.restart) })) this.restart();
    if (ui.button('settings', bx, y + 112, bw, 28, 'Settings')) this.app.goto(new SettingsScreen(this.app, this));
    if (ui.button('quit', bx, y + 148, bw, 28, this.run ? 'End the run' : 'Quit to map')) this.quit();
  }

  /** Back from the settings screen. */
  resumeFromSettings() {
    this.phase = 'paused';
    this.app.applySettings();
  }

  /** Death: first just look (what got you is marked, the room stays frozen), then a card at the top. */
  private drawDead() {
    const ctx = this.app.world, ui = this.app.ui, w = this.world, t = this.phaseT;
    const k = w.reds.find((r) => r.id === this.killer && !r.dead);
    if (k && t > 0.2) {
      const kx = k.x - this.cam.x, ky = k.y - this.cam.y - 10;
      line(ctx, kx, ky, w.player.x - this.cam.x, w.player.y - this.cam.y - 10, PAL.red, 2, Math.floor(this.app.now * 12));
      ring(ctx, kx, ky, k.r + 7 + (Math.floor(t * 6) % 2), PAL.red);
    }
    if (t < DEATH_HOLD) return;
    const hazard = { train: 'by a train', hook: 'by the hook', beat: 'on the beat', landing: '' }[this.killedBy ?? 'landing'];
    const by = k ? `by ${REDS[k.kind].boss ? '' : 'a '}${REDS[k.kind].name}` : hazard;
    const title = 'SHATTERED';
    const keys = this.run ? `[${keyLabel(this.keys.restart)}] or [LMB] see how you did` : `[${keyLabel(this.keys.restart)}] or [LMB] try again    [Esc] map`;
    const tw = measure(title, 'shard') + (by ? measure(by) + 10 : 0);
    const cw = Math.max(tw, measure(keys) + 40) + 32, x = Math.round((UI.w - cw) / 2), y = 10;
    plate(ui.ctx, x, y, cw, 50, PAL.ink, PAL.stone);
    rect(ui.ctx, x + 1, y + 1, cw - 2, 48, PAL.paper);
    rect(ui.ctx, x + 1, y + 1, cw - 2, 3, PAL.red);
    const tx = Math.round((UI.w - tw) / 2);
    text(ui.ctx, title, tx, y + 10, PAL.blood, { face: 'shard' });
    if (by) text(ui.ctx, by, tx + measure(title, 'shard') + 10, y + 13, PAL.iron);
    rich(ui.ctx, keys, UI.w / 2, y + 32, { color: Math.floor(t * 2) % 2 ? PAL.ink : PAL.iron, align: 'center' });
  }

  /** The beat after the last kill: a quiet word up top while the shards hang. */
  private drawWon() {
    if (this.phaseT < 0.25 || this.bossT >= 0) return;
    const ui = this.app.ui, d = this.def;
    const word = d.goal.kind === 'escape' ? 'ESCAPED' : d.goal.kind === 'survive' ? 'SURVIVED' : 'CLEARED';
    const tw = measure(word, 'shard') + 28, x = Math.round((UI.w - tw) / 2), y = 32;
    plate(ui.ctx, x, y, tw, 25, PAL.ink, PAL.stone);
    rect(ui.ctx, x + 1, y + 1, tw - 2, 23, PAL.paper);
    rect(ui.ctx, x + 1, y + 21, tw - 2, 3, PAL.cyan);
    ui.text(word, UI.w / 2, y + 6, PAL.ink, { face: 'shard', align: 'center' });
  }

  /** A boss breaks: the room stops, a white flash, and its name across the screen. */
  private drawBossCard() {
    const ui = this.app.ui, ctx = ui.ctx, t = this.bossT;
    if (t < 0.2) return;
    const y = 54;
    rect(ctx, 0, y, UI.w, 70, PAL.ink);
    rect(ctx, 0, y + 2, UI.w, 66, PAL.paper);
    rect(ctx, 0, y + 64, UI.w, 4, PAL.red);
    text(ctx, this.bossName.toUpperCase(), UI.w / 2, y + 10, PAL.ink, { face: 'shard', scale: 2, align: 'center' });
    if (t > 0.5) text(ctx, 'SHATTERED', UI.w / 2, y + 44, PAL.blood, { face: 'shard', align: 'center' });
  }

  private drawRewind() {
    const ctx = this.app.world, ui = this.app.ui;
    // VHS: rows slip sideways, a band rolls up the screen
    const t = this.phaseT;
    for (let y = 0; y < VIEW.h; y += 3) {
      const off = Math.round(Math.sin(y * 0.3 + t * 40) * 3);
      if ((y + Math.floor(t * 60)) % 9 === 0) rect(ctx, 0, y, VIEW.w, 1, PAL.coal);
      if (off) ctx.drawImage(ctx.canvas, 0, y, VIEW.w, 1, off, y, VIEW.w, 1);
    }
    const band = VIEW.h - ((t / REWIND.realSeconds) * (VIEW.h + 20)) % (VIEW.h + 20);
    dither(ctx, 0, band, VIEW.w, 6, PAL.tide);
    // two back-arrows and the word
    for (let k = 0; k < 2; k++) for (let j = 0; j < 11; j++) rect(ui.ctx, 22 + k * 12 + Math.abs(j - 5), 50 + j, 6 - Math.abs(j - 5), 1, PAL.tide);
    ui.text('REWIND', 50, 50, PAL.tide, { face: 'shard', outline: PAL.paper });
  }

  private drawDebug() {
    const ui = this.app.ui, w = this.world;
    const lines = [
      `Scale ${this.time.scale.toFixed(3)}`,
      `Ticks/s ${this.tps.toFixed(1)}`,
      `Burst ${this.time.burst.toFixed(3)}`,
      `Game ${(w.tick / TICK_RATE).toFixed(2)} s`,
      `Real ${this.realTime.toFixed(2)} s`,
      `Reds ${w.reds.length} · bullets ${w.bullets.length}`,
      `Shards ${this.fx.shards.length}`,
    ];
    ui.card(6, 76, 150, lines.length * 12 + 10, { fill: PAL.paper });
    lines.forEach((l, i) => ui.text(l, 12, 82 + i * 12, PAL.tide));
  }
}
