// Effects that live only on screen: shards, sparks, coins, popups, trails. Most run on game time (fed by
// sim ticks, so frozen time freezes them mid-air: the best moment in the game, docs/STYLE.md §4); the
// rest (popups, the dash trail, coins flying to the counter) run on real time so the UI stays alive.
// Nothing here touches the World.
import { PAL } from '../data/palette';
import type { RedKind } from '../data/reds';
import type { SimEvent, World } from '../sim/types';
import type { Atlas } from './atlas';
import { actorSprite } from './actors';
import { drawOutlined, textWidth } from './font';
import { dither, line, ring, rect, type Ctx } from './prims';
import { AIR, type Camera } from './view';

interface Shard {
  x: number; y: number; z: number;
  px: number; py: number; pz: number;
  vx: number; vy: number; vz: number;
  c: string;
  s: number;
  rest: boolean;
}

interface Spark {
  kind: 'flash' | 'punch' | 'puff' | 'ring' | 'dust' | 'deflect';
  x: number; y: number;
  aim: number;
  t: number;
  life: number;
  color: string;
}

interface Coin {
  x: number; y: number; z: number;
  px: number; py: number; pz: number;
  vx: number; vy: number; vz: number;
  /** game seconds since it popped; real seconds of flight once it heads for the counter */
  t: number;
  fly: number;
  sx: number; sy: number;
}

interface Popup {
  text: string;
  x: number; y: number;
  t: number;
  color: string;
}

interface Trail {
  x0: number; y0: number; x1: number; y1: number;
  t: number;
}

/** Deterministic-enough jitter for effects (no Math.random needed, no sim RNG touched). */
let seed = 1;
function jitter() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}

const MAX_SHARDS = 2400;
const GRAVITY = 420;

export class Fx {
  shards: Shard[] = [];
  sparks: Spark[] = [];
  coins: Coin[] = [];
  popups: Popup[] = [];
  trails: Trail[] = [];
  /** coins that reached the counter, for the HUD pulse */
  arrived = 0;
  /** real seconds of the white flash when a shield breaks */
  flash = 0;

  constructor(private atlas: Atlas) {}

  /** One sim tick of game time. */
  tick(dt: number) {
    for (const s of this.shards) {
      s.px = s.x;
      s.py = s.y;
      s.pz = s.z;
      if (s.rest) continue;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;
      s.vz -= GRAVITY * dt;
      if (s.z <= 0) {
        s.z = 0;
        if (s.vz < -60) {
          s.vz = -s.vz * 0.3;
          s.vx *= 0.5;
          s.vy *= 0.5;
        } else s.rest = true;
      }
    }
    for (const c of this.coins) {
      c.px = c.x;
      c.py = c.y;
      c.pz = c.z;
      if (c.fly > 0) continue;
      c.t += dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.z = Math.max(0, c.z + c.vz * dt);
      c.vz -= GRAVITY * dt;
      if (c.z === 0) {
        c.vx *= 0.6;
        c.vy *= 0.6;
        c.vz = Math.abs(c.vz) > 40 ? -c.vz * 0.4 : 0;
      }
    }
    for (const s of this.sparks) s.t += dt;
    this.sparks = this.sparks.filter((s) => s.t < s.life);
  }

  /** Real time passing (popups, trails, coins flying home). */
  real(dt: number, cam: Camera, counter: { x: number; y: number }) {
    for (const p of this.popups) p.t += dt;
    this.popups = this.popups.filter((p) => p.t < 1.1);
    for (const t of this.trails) t.t += dt;
    this.trails = this.trails.filter((t) => t.t < 0.35);
    this.flash = Math.max(0, this.flash - dt);
    for (const c of this.coins) {
      if (c.fly === 0 && c.t > 0.45) {
        c.fly = 0.0001;
        c.sx = c.x - cam.x;
        c.sy = c.y - c.z - cam.y;
      }
      if (c.fly > 0) c.fly += dt;
    }
    const before = this.coins.length;
    this.coins = this.coins.filter((c) => c.fly < 0.45);
    this.arrived += before - this.coins.length;
    void counter;
  }

  /** Turns sim events into effects. */
  event(e: SimEvent, w: World) {
    switch (e.t) {
      case 'shot':
        this.sparks.push({ kind: 'flash', x: e.x, y: e.y, aim: e.aim, t: 0, life: 0.06, color: e.from === 'player' ? PAL.ink : PAL.hot });
        break;
      case 'punch':
        if (e.hit) this.sparks.push({ kind: 'punch', x: e.x, y: e.y, aim: e.aim, t: 0, life: 0.12, color: e.from === 'player' ? PAL.ink : PAL.hot });
        break;
      case 'wall':
        this.sparks.push({ kind: 'dust', x: e.x, y: e.y, aim: 0, t: 0, life: 0.15, color: PAL.stone });
        break;
      case 'deflect':
        this.sparks.push({ kind: 'deflect', x: e.x, y: e.y, aim: 0, t: 0, life: 0.2, color: PAL.glint });
        this.popup('BLOCKED', e.x, e.y - 22, PAL.hot);
        break;
      case 'glass':
        this.burst(e.x, e.y, 6, 18, [PAL.paper, PAL.fog, PAL.stone, PAL.ash], 0, 60);
        break;
      case 'break':
        this.burst(e.x, e.y, AIR, e.item === 'desk' ? 30 : 10, e.item === 'desk' ? [PAL.fog, PAL.ash, PAL.stone, PAL.slate] : [PAL.ink, PAL.iron, PAL.slate], 0, 70);
        break;
      case 'parry':
        this.sparks.push({ kind: 'ring', x: e.x, y: e.y, aim: 0, t: 0, life: 0.25, color: PAL.ink });
        this.popup('+3 PARRY', e.x, e.y - 16, PAL.ink);
        break;
      case 'shield':
        this.sparks.push({ kind: 'ring', x: e.x, y: e.y, aim: 0, t: 0, life: 0.35, color: PAL.cyan });
        this.burst(e.x, e.y, 10, 24, [PAL.cyan, PAL.tide, PAL.paper], 0, 90);
        this.flash = 0.12;
        break;
      case 'stun':
        this.sparks.push({ kind: 'puff', x: e.x, y: e.y, aim: 0, t: 0, life: 0.2, color: PAL.paper });
        break;
      case 'shatter':
        this.shatter(e.kind, e.x, e.y, e.aim, w, e.id);
        this.coinBurst(e.x, e.y, Math.min(8, e.coins));
        if (e.coins > (e.kind === 'manager' ? 25 : e.kind === 'brute' ? 5 : 2)) {
          const extra = e.cause === 'throw' ? 'THROW' : e.cause === 'dash' ? 'SKIP' : w.combo.count > 1 ? `COMBO X${w.combo.count}` : 'STYLE';
          this.popup(extra, e.x, e.y - 26, PAL.gold);
        }
        break;
      case 'death':
        this.playerShatter(w, e.aim);
        break;
      case 'dash':
        this.trails.push({ x0: e.x, y0: e.y, x1: e.x2, y1: e.y2, t: 0 });
        break;
      case 'disarm':
        this.sparks.push({ kind: 'puff', x: e.x, y: e.y - 8, aim: 0, t: 0, life: 0.15, color: PAL.ink });
        break;
    }
  }

  popup(text: string, x: number, y: number, color: string) {
    this.popups.push({ text, x, y, t: 0, color });
  }

  /** A red breaks into its own pixels (or palette chunks before the art exists). */
  private shatter(kind: RedKind, x: number, y: number, aim: number, w: World, id: number) {
    const r = w.reds.find((r) => r.id === id);
    const sprite = actorSprite(kind, r ? r.aim : aim, 0);
    const px = this.atlas.has(sprite.name) ? this.atlas.pixels(sprite.name, 0) : null;
    const dx = Math.cos(aim), dy = Math.sin(aim);
    if (px) {
      // every 2×2 block of opaque pixels becomes a shard, flying off with the blow
      for (let j = 0; j < px.h; j += 2) {
        for (let i = 0; i < px.w; i += 2) {
          const k = (j * px.w + i) * 4;
          if (px.data[k + 3] < 128) continue;
          const c = `#${[px.data[k], px.data[k + 1], px.data[k + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
          const ox = (sprite.flip ? px.pivot[0] - i : i - px.pivot[0]);
          const z = px.pivot[1] - j;
          const out = Math.hypot(ox, z - 10) || 1;
          const sp = 30 + jitter() * 90;
          this.addShard({
            x: x + ox, y: y + (jitter() - 0.5) * 3, z: Math.max(0, z),
            vx: dx * sp + (ox / out) * 40 * jitter(), vy: dy * sp + (jitter() - 0.5) * 50,
            vz: 30 + jitter() * 90 + (z - 10) * 2, c, s: jitter() < 0.3 ? 2 : 1,
          });
        }
      }
    } else {
      const ramp = [PAL.wine, PAL.blood, PAL.red, PAL.red, PAL.hot, PAL.glint];
      const n = kind === 'brute' || kind === 'manager' ? 120 : 60;
      for (let i = 0; i < n; i++) {
        const sp = 30 + jitter() * 100;
        const a = aim + (jitter() - 0.5) * 2.2;
        this.addShard({ x, y, z: 2 + jitter() * 18, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 20 + jitter() * 110, c: ramp[Math.floor(jitter() * ramp.length)], s: jitter() < 0.35 ? 2 : 1 });
      }
    }
  }

  private playerShatter(w: World, aim: number) {
    const p = w.player;
    const sprite = actorSprite('player', p.aim, 0);
    const px = this.atlas.has(sprite.name) ? this.atlas.pixels(sprite.name, 0) : null;
    if (px) {
      for (let j = 0; j < px.h; j += 2) {
        for (let i = 0; i < px.w; i += 2) {
          const k = (j * px.w + i) * 4;
          if (px.data[k + 3] < 128) continue;
          const c = `#${[px.data[k], px.data[k + 1], px.data[k + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
          const sp = 20 + jitter() * 80;
          this.addShard({
            x: p.x + (sprite.flip ? px.pivot[0] - i : i - px.pivot[0]), y: p.y, z: Math.max(0, px.pivot[1] - j),
            vx: Math.cos(aim) * sp + (jitter() - 0.5) * 40, vy: Math.sin(aim) * sp + (jitter() - 0.5) * 40, vz: 40 + jitter() * 90, c, s: jitter() < 0.3 ? 2 : 1,
          });
        }
      }
      return;
    }
    const ramp = [PAL.paper, PAL.fog, PAL.ash, PAL.ink, PAL.cyan];
    for (let i = 0; i < 70; i++) {
      const sp = 20 + jitter() * 90;
      const a = aim + (jitter() - 0.5) * 2.5;
      this.addShard({ x: p.x, y: p.y, z: 2 + jitter() * 18, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 30 + jitter() * 100, c: ramp[Math.floor(jitter() * ramp.length)], s: jitter() < 0.35 ? 2 : 1 });
    }
  }

  private burst(x: number, y: number, z: number, n: number, colors: string[], aim: number, speed: number) {
    for (let i = 0; i < n; i++) {
      const a = aim + jitter() * Math.PI * 2;
      const sp = speed * (0.3 + jitter());
      this.addShard({ x, y, z, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 20 + jitter() * 60, c: colors[Math.floor(jitter() * colors.length)], s: 1 });
    }
  }

  private addShard(s: Omit<Shard, 'px' | 'py' | 'pz' | 'rest'>) {
    if (this.shards.length >= MAX_SHARDS) {
      const i = this.shards.findIndex((s) => s.rest);
      this.shards.splice(i >= 0 ? i : 0, 1);
    }
    this.shards.push({ ...s, px: s.x, py: s.y, pz: s.z, rest: false });
  }

  private coinBurst(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      const a = jitter() * Math.PI * 2, sp = 20 + jitter() * 40;
      this.coins.push({ x, y, z: 8, px: x, py: y, pz: 8, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 80 + jitter() * 60, t: 0, fly: 0, sx: 0, sy: 0 });
    }
  }

  /** Shards lying on the floor: drawn under everything that stands. */
  drawFloor(ctx: Ctx, cam: Camera) {
    for (const s of this.shards) if (s.rest) rect(ctx, s.x - cam.x, s.y - cam.y, s.s, s.s, s.c);
  }

  /** Everything in the air, interpolated between ticks. */
  drawAir(ctx: Ctx, cam: Camera, alpha: number, now: number) {
    for (const t of this.trails) {
      const k = t.t / 0.35;
      const n = 5;
      for (let i = 0; i < n; i++) {
        const f = i / (n - 1);
        if (f < k) continue;
        const x = t.x0 + (t.x1 - t.x0) * f - cam.x, y = t.y0 + (t.y1 - t.y0) * f - cam.y;
        dither(ctx, x - 3, y - 16, 7, 18, i % 2 ? PAL.cyan : PAL.tide, i);
      }
      line(ctx, t.x0 - cam.x, t.y0 - cam.y - AIR, t.x1 - cam.x, t.y1 - cam.y - AIR, PAL.cyan);
    }
    for (const s of this.shards) {
      if (s.rest) continue;
      const x = s.px + (s.x - s.px) * alpha, y = s.py + (s.y - s.py) * alpha, z = s.pz + (s.z - s.pz) * alpha;
      rect(ctx, x - cam.x, y - z - cam.y, s.s, s.s, s.c);
    }
    for (const s of this.sparks) {
      const x = s.x - cam.x, y = s.y - cam.y, k = s.t / s.life;
      if (s.kind === 'flash') {
        const fx = x + Math.cos(s.aim) * 2, fy = y + Math.sin(s.aim) * 2 - AIR;
        rect(ctx, fx - 1, fy - 1, 3, 3, s.color);
        line(ctx, fx, fy, fx + Math.cos(s.aim) * 5, fy + Math.sin(s.aim) * 5, s.color);
        line(ctx, fx, fy, fx + Math.cos(s.aim + 0.9) * 3, fy + Math.sin(s.aim + 0.9) * 3, s.color);
        line(ctx, fx, fy, fx + Math.cos(s.aim - 0.9) * 3, fy + Math.sin(s.aim - 0.9) * 3, s.color);
      } else if (s.kind === 'punch') {
        const r = 2 + k * 4;
        for (let i = 0; i < 6; i++) {
          const a = s.aim + (i / 6) * Math.PI * 2;
          rect(ctx, x + Math.cos(a) * r, y - AIR - 2 + Math.sin(a) * r, 1, 1, s.color);
        }
      } else if (s.kind === 'ring') ring(ctx, x, y - AIR, 2 + k * 12, s.color);
      else if (s.kind === 'puff' || s.kind === 'deflect') {
        const r = 2 + k * 6;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + k;
          rect(ctx, x + Math.cos(a) * r, y - 10 + Math.sin(a) * r * 0.6, 1, 1, s.color);
        }
      } else if (s.kind === 'dust') {
        rect(ctx, x - 1, y - AIR - 1 - k * 3, 1, 1, s.color);
        rect(ctx, x + 1, y - AIR - k * 4, 1, 1, s.color);
      }
    }
    for (const c of this.coins) {
      let x: number, y: number;
      if (c.fly > 0) {
        const k = Math.min(1, c.fly / 0.45);
        const e = k * k;
        x = c.sx + (COUNTER.x - c.sx) * e;
        y = c.sy + (COUNTER.y - c.sy) * e - Math.sin(k * Math.PI) * 14;
      } else {
        x = c.px + (c.x - c.px) * alpha - cam.x;
        y = c.py + (c.y - c.py) * alpha - (c.pz + (c.z - c.pz) * alpha) - cam.y;
      }
      const f = Math.floor(now / 0.1 + c.sx) % 4;
      if (this.atlas.has('coin')) this.atlas.draw(ctx, 'coin', f, x, y);
      else {
        rect(ctx, x - 2, y - 2, 5, 5, PAL.amber);
        rect(ctx, x - 1, y - 2, 3, 5, PAL.gold);
        rect(ctx, x - 1, y - 1, 1, 1, PAL.shine);
      }
    }
  }

  /** Floating words, on real time. */
  drawPopups(ctx: Ctx, cam: Camera) {
    for (const p of this.popups) {
      const y = p.y - cam.y - p.t * 14;
      const x = p.x - cam.x - textWidth(p.text) / 2;
      if (p.t > 0.8 && Math.floor(p.t * 20) % 2) continue;
      drawOutlined(ctx, p.text, x, y, p.color, PAL.paper);
    }
  }
}

/** Where coins fly to: the HUD's coin counter, in view pixels. */
export const COUNTER = { x: 300, y: 6 };
