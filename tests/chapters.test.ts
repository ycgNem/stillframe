// Chapters 2–5 (docs/PLAN.md M9–M10): one scripted run per new weapon, red, hazard, boss move and glitch.
import { describe, expect, it } from 'vitest';
import { CONDUCTOR, DJ, FOREMAN, FRAME, REDS } from '../src/data/reds';
import { ECHO, TICK_RATE, TILE, TIME, TRAINS } from '../src/data/tuning';
import { trainLength } from '../src/sim/hazards';
import { makeRed } from '../src/sim/level';
import { createTime, updateTime } from '../src/sim/time';
import type { World } from '../src/sim/types';
import { step } from '../src/sim/world';
import { aimAt, input, room, run } from './helpers';

const SURVIVE = { goal: { kind: 'survive' as const, seconds: 99 } };
const S = (n: number) => Math.round(n * TICK_RATE);

function give(w: World, kind: 'smg' | 'rifle' | 'katana' | 'pistol', ammo = 99) {
  w.player.hands = [{ kind, ammo, boosted: false }];
}

describe('weapons', () => {
  it('the SMG fires a burst of three over a few ticks, four bursts to a gun', () => {
    const w = room(['##########', '#P.......#', '##########'], SURVIVE);
    give(w, 'smg', 12);
    const ev = run(w, 3, input({ aim: 0, fire: true }));
    expect(ev.filter((e) => e.t === 'shot').length).toBe(1);
    const more = run(w, S(0.2), input({ aim: 0 }));
    expect(more.filter((e) => e.t === 'shot').length).toBe(2);
    expect(w.player.hands[0].ammo).toBe(9);
    expect(w.stats.shots).toBe(1);
  });

  it('a rifle round goes on through the red it shatters', () => {
    const w = room(['##############', '#P...g..g....#', '##############'], SURVIVE);
    give(w, 'rifle', 3);
    w.reds.forEach((r) => (r.stun = 9));
    run(w, S(0.6), input({ aim: 0, fire: true }));
    expect(w.stats.kills).toBe(2);
    expect(w.player.hands[0].ammo).toBe(2);
  });

  it('the katana cuts the reds in its arc and a bullet out of the air', () => {
    const w = room(['##########', '#........#', '#..gPg...#', '#........#', '##########'], SURVIVE);
    give(w, 'katana');
    const right = w.reds.find((r) => r.x > w.player.x)!;
    step(w, input({ aim: 0, fire: true }));
    expect(right.dead).toBe(true);
    expect(w.reds.filter((r) => !r.dead)).toHaveLength(1);
    expect(w.stats.slashKills).toBe(1);
    // a red bullet coming in, cut down
    run(w, S(0.5));
    const p = w.player;
    w.bullets.push({ id: w.nextId++, x: p.x + 20, y: p.y, px: p.x + 22, py: p.y, vx: -100, vy: 0, from: 'red', owner: 0, life: 200, damage: 3, hit: false, pierce: false, bounced: false });
    step(w, input({ aim: 0, fire: true }));
    expect(w.stats.parries).toBe(1);
    expect(w.bullets).toHaveLength(0);
  });
});

describe('new reds', () => {
  it('a Runner weaves from side to side as it closes in', () => {
    const w = room(['####################', '#P.................#', '#..................#', '#..................#', '#.................r#', '#..................#', '####################'], SURVIVE);
    const r = w.reds[0];
    let turns = 0, was = 0;
    for (let i = 0; i < S(1.5); i++) {
      const y0 = r.y;
      step(w, input());
      const dir = Math.sign(r.y - y0);
      if (dir && was && dir !== was) turns++;
      if (dir) was = dir;
    }
    expect(turns).toBeGreaterThanOrEqual(2);
    expect(REDS.runner.speed).toBeGreaterThan(REDS.grunt.speed * 1.5);
  });

  it('a Sniper stays put, shows its line for 1.5 s, then fires a fast round', () => {
    const w = room(['########################', '#P....................n#', '########################'], SURVIVE);
    const r = w.reds[0];
    const x0 = r.x;
    let firstTell = -1, shot = -1;
    for (let i = 0; i < S(4) && shot < 0; i++) {
      for (const e of step(w, input())) {
        if (e.t === 'tell' && firstTell < 0) firstTell = w.tick;
        if (e.t === 'shot') shot = w.tick;
      }
    }
    expect(r.x).toBe(x0);
    expect((shot - firstTell) / TICK_RATE).toBeGreaterThanOrEqual(1.45);
    expect(Math.abs(w.bullets[0].vx)).toBeGreaterThan(300);
  });

  it('a Mirror turns your bullet back on you; fists still work', () => {
    const w = room(['##############', '#P.......i...#', '##############'], SURVIVE);
    give(w, 'pistol', 6);
    w.reds[0].stun = 9;
    const ev = run(w, S(1.5), (_, i) => input({ aim: 0, fire: i === 0 }));
    expect(ev.some((e) => e.t === 'reflect')).toBe(true);
    expect(w.status).toBe('dead');
    const v = room(['########', '#P.i...#', '########'], SURVIVE);
    v.reds[0].stun = 99;
    run(v, S(2), input({ mx: 1, aim: 0, fire: true }));
    expect(v.stats.punchKills).toBe(1);
  });

  it('a Splitter breaks into two Shards', () => {
    const w = room(['##########', '#P.y.....#', '##########'], SURVIVE);
    give(w, 'pistol', 6);
    const ev = run(w, 15, (_, i) => input({ aim: 0, fire: i === 0 }));
    expect(ev.some((e) => e.t === 'split')).toBe(true);
    expect(w.reds.filter((r) => r.kind === 'shardling')).toHaveLength(2);
  });
});

describe('heavy reds', () => {
  it('a Brute is rocked by the first punch, then shrugs punches off a while, and is never knocked back', () => {
    const w = room(['##########', '#.P......#', '##########'], SURVIVE);
    const b = makeRed(w, 'brute', w.player.x + 14, w.player.y, null);
    b.chargeCd = 99;
    w.reds.push(b);
    step(w, input({ aim: 0, fire: true }));
    expect(b.stun).toBeGreaterThan(0);
    expect(b.steady).toBeGreaterThan(0);
    const x = b.x;
    run(w, S(0.4));
    b.stun = 0;
    step(w, input({ aim: 0, fire: true }));
    expect(b.stun).toBe(0);
    expect(b.x).toBeCloseTo(x, 1);
    expect(b.hp).toBe(REDS.brute.hp - 2);
  });

  it('walking into a heavy red doesn\'t shove it: you give way', () => {
    const w = room(['##########', '#.P......#', '##########'], SURVIVE);
    const b = makeRed(w, 'brute', w.player.x + 12, w.player.y, null);
    b.stun = 99;
    w.reds.push(b);
    const x = b.x;
    run(w, S(0.5), input({ mx: 1 }));
    expect(b.x).toBe(x);
    expect(b.x - w.player.x).toBeGreaterThanOrEqual(b.r + w.player.r - 0.5);
  });
});

describe('trains', () => {
  const MAP = ['####################', '#........P.........#', '#__________________#', '#__________________#', '#..................#', '####################'];
  const LINE = { trains: [{ row: 2, dir: 1 as const, period: 8, offset: 0, speed: 160, cars: 2 }] };

  it('the rails warn first, then a train runs the track and shatters a red standing on it', () => {
    const w = room(MAP, { ...SURVIVE, ...LINE });
    const r = makeRed(w, 'grunt', 10 * TILE + 8, 2 * TILE + 8, null);
    r.stun = 99;
    w.reds.push(r);
    const ev = run(w, S(TRAINS.warn - 0.1));
    expect(ev.some((e) => e.t === 'warn')).toBe(true);
    expect(w.hotRows).toContain(2);
    expect(w.trains).toHaveLength(0);
    const later = run(w, S(2.2));
    expect(later.some((e) => e.t === 'train')).toBe(true);
    expect(r.dead).toBe(true);
    expect(w.stats.hazardKills).toBe(1);
    expect(trainLength(LINE.trains[0])).toBe(2 * TRAINS.car + TRAINS.gap);
  });

  it('kills you on the tracks, and stops bullets while it passes', () => {
    const w = room(MAP, { ...SURVIVE, ...LINE });
    w.player.y = 2 * TILE + 8;
    run(w, S(3));
    expect(w.status).toBe('dead');
    const v = room(MAP, { ...SURVIVE, ...LINE });
    run(v, S(TRAINS.warn + 1.1));
    expect(v.trains.length).toBe(1);
    give(v, 'pistol', 6);
    const ev = run(v, 10, (_, i) => input({ aim: Math.PI / 2, fire: i === 0 }));
    expect(ev.some((e) => e.t === 'wall')).toBe(true);
  });
});

describe('rooftops', () => {
  it('a punch at the edge sends a red over; you cannot walk off', () => {
    const w = room(['~~~~~~~~~~', '~.......~~', '~...Pg..~~', '~.......~~', '~~~~~~~~~~'], SURVIVE);
    const r = w.reds[0];
    r.x = 7 * TILE + 4;
    w.player.x = r.x - 12;
    r.stun = 9;
    const ev = run(w, S(0.4), input({ aim: 0, fire: true }));
    expect(ev.some((e) => e.t === 'fall')).toBe(true);
    expect(w.stats.dropKills).toBe(1);
    const v = room(['~~~~~~', '~.P..~', '~~~~~~'], SURVIVE);
    run(v, S(2), input({ mx: -1 }));
    expect(v.player.x).toBeGreaterThan(TILE);
  });

  it('a Brute charging past the edge falls', () => {
    const w = room(['~~~~~~~~~~~~~~~~', '~..............~', '~.P.........B..~', '~..............~', '~~~~~~~~~~~~~~~~'], SURVIVE);
    const b = w.reds[0];
    let fell = false;
    for (let i = 0; i < S(6) && !fell && w.status === 'play'; i++) {
      // step aside once it's committed to the run, with the edge behind you
      const dodge = b.state === 'charge' ? 1 : 0;
      for (const e of step(w, input({ my: dodge }))) if (e.t === 'fall') fell = true;
    }
    expect(fell).toBe(true);
    expect(b.dead).toBe(true);
  });

  it('the Foreman loses a third when it goes over, then climbs back up through a door', () => {
    const w = room(['~~~~~~~~~~~~~~~~', '~.....D........~', '~.P.........3..~', '~..............~', '~~~~~~~~~~~~~~~~'], SURVIVE);
    const f = w.reds[0];
    // no beams this time: just the charge
    f.cooldown = 99;
    let fell = -1;
    for (let i = 0; i < S(8) && fell < 0 && w.status === 'play'; i++) {
      const dodge = f.state === 'charge' ? 1 : 0;
      for (const e of step(w, input({ my: dodge }))) if (e.t === 'fall') fell = w.tick;
    }
    expect(fell).toBeGreaterThan(0);
    expect(f.dead).toBe(false);
    expect(f.hp).toBe(REDS.foreman.hp - FOREMAN.fallDamage);
    expect(f.hidden).toBe(true);
    run(w, S(FOREMAN.climbBack + 0.2));
    expect(f.hidden).toBe(false);
  });

  it('a crane hook sweeps the roof and shatters what it meets', () => {
    const w = room(['##############', '#P...........#', '#............#', '#.....g......#', '#............#', '##############'], { ...SURVIVE, hooks: [{ x: 6, y: 0, len: 3, swing: 1.2, period: 3, phase: 0.25 }] });
    w.reds[0].stun = 99;
    run(w, S(3));
    expect(w.stats.hazardKills).toBe(1);
  });

  it('bullets and punches only chip the Foreman', () => {
    const w = room(['##########', '#P.3.....#', '##########'], SURVIVE);
    give(w, 'pistol', 6);
    w.reds[0].stun = 9;
    run(w, 12, (_, i) => input({ aim: 0, fire: i === 0 }));
    expect(w.reds[0].hp).toBe(REDS.foreman.hp - 1);
  });
});

describe('the dance floor', () => {
  it('the beat lights tiles before the drop, and the drop shatters whoever stands on one', () => {
    const w = room(['############', '#P:::::::::#', '#:::::::::::#'.slice(0, 12), '#:::::::::::'.slice(0, 11) + '#', '############'], { ...SURVIVE, beat: { bar: 2, warn: 1 } });
    const ev = run(w, S(1.05));
    expect(w.beat.lit.length).toBeGreaterThan(0);
    expect(ev.some((e) => e.t === 'warn')).toBe(true);
    // a red on a lit tile and you on a dark one
    const lit = w.beat.lit[0];
    const r = makeRed(w, 'grunt', (lit % w.cols) * TILE + 8, Math.floor(lit / w.cols) * TILE + 8, null);
    r.stun = 99;
    w.reds.push(r);
    const dark = w.look.findIndex((l, i) => l === ':' && !w.beat.lit.includes(i));
    w.player.x = (dark % w.cols) * TILE + 8;
    w.player.y = Math.floor(dark / w.cols) * TILE + 8;
    const drop = run(w, S(1));
    expect(drop.some((e) => e.t === 'drop')).toBe(true);
    expect(r.dead).toBe(true);
    expect(w.status).toBe('play');
  });
});

describe('the core', () => {
  it('a gravity well bends a bullet', () => {
    const w = room(['####################', '#P.................#', '#..................#', '#..................#', '####################'], { ...SURVIVE, wells: [{ x: 10, y: 3, pull: 400, r: 60 }] });
    give(w, 'pistol', 6);
    step(w, input({ aim: 0, fire: true }));
    run(w, S(0.6));
    expect(w.bullets).toHaveLength(1);
    expect(w.bullets[0].vy).toBeGreaterThan(0);
  });

  it('the echo glitch fires every shot again a moment later', () => {
    const w = room(['####################', '#P.................#', '####################'], { ...SURVIVE, glitch: 'echo' });
    give(w, 'pistol', 6);
    const ev = run(w, S(ECHO.delay + 0.1), (_, i) => input({ aim: 0, fire: i === 0 }));
    expect(ev.filter((e) => e.t === 'shot').length).toBe(2);
    expect(w.player.hands[0].ammo).toBe(5);
  });

  it('the Frame\'s eyes turn bullets while you stand still, and take them while you move', () => {
    const still = room(['##########', '#P....5..#', '#........#', '##########'], SURVIVE);
    give(still, 'pistol', 6);
    run(still, 3, (_, i) => input({ aim: 0, fire: i === 0 }));
    expect(still.reds[0].hp).toBe(REDS.eye.hp);
    const moving = room(['##########', '#P....5..#', '#........#', '##########'], SURVIVE);
    give(moving, 'pistol', 6);
    run(moving, S(0.2), input({ mx: 1 }));
    run(moving, 20, (w, i) => input({ mx: 1, aim: aimAt(w, w.reds[0].x, w.reds[0].y), fire: i === 0 }));
    expect(moving.reds[0].hp).toBe(REDS.eye.hp - 3);
  });
});

describe('glitches', () => {
  it('mirror: left walks you right', () => {
    const w = room(['##########', '#....P...#', '##########'], { ...SURVIVE, glitch: 'mirror' });
    const x0 = w.player.x;
    run(w, 20, input({ mx: -1 }));
    expect(w.player.x).toBeGreaterThan(x0);
  });

  it('inverse: time runs while you stand still and crawls while you move', () => {
    const t = createTime(0, 0, true);
    for (let i = 0; i < 120; i++) updateTime(t, 0, 1 / 60);
    expect(t.scale).toBeCloseTo(TIME.walk, 1);
    for (let i = 0; i < 120; i++) updateTime(t, 1, 1 / 60);
    expect(t.scale).toBeCloseTo(TIME.idle, 2);
  });
});

describe('bosses', () => {
  it('the DJ lobs records, and the beat quickens as it cracks', () => {
    const w = room(['##############', '#::::::::::::#', '#:P::::::::4:#', '#::::::::::::#', '##############'], { ...SURVIVE, beat: { bar: 2, warn: 1 } });
    const dj = w.reds[0];
    const ev = run(w, S(DJ.recordTell + 1.2), input({ my: 0 }));
    expect(ev.some((e) => e.t === 'throw' && e.item === 'record')).toBe(true);
    // the time from one drop to the next, at full health and in the last phase
    const beats = (n: number) => {
      const v = room(['##############', '#::::::::::::#', '#:P::::::::4:#', '#::::::::::::#', '##############'], { ...SURVIVE, beat: { bar: 2, warn: 1 } });
      v.reds[0].phase = n;
      v.reds[0].cooldown = 99;
      v.player.grace = 99;
      const drops: number[] = [];
      for (let i = 0; i < S(6) && drops.length < 2; i++) if (step(v, input()).some((e) => e.t === 'drop')) drops.push(v.tick);
      return drops[1] - drops[0];
    };
    expect(beats(2)).toBeLessThan(beats(0));
    expect(dj.dead).toBe(false);
  });

  it('an eye of the Frame tells, then lets go a ring of bullets', () => {
    const w = room(['##############', '#P...........#', '#............#', '#......5.....#', '#............#', '##############'], SURVIVE);
    const eye = w.reds[0];
    eye.held = null;
    eye.timer = 0;
    let told = -1, ring = -1;
    for (let i = 0; i < S(2) && ring < 0; i++) {
      for (const e of step(w, input())) if (e.t === 'tell' && e.what === 'ring') told = w.tick;
      if (told > 0 && w.bullets.length >= FRAME.ringBullets) ring = w.tick;
    }
    expect(told).toBeGreaterThan(0);
    expect((ring - told) / TICK_RATE).toBeCloseTo(FRAME.ringTell, 1);
  });

  it('the Conductor boards a stopped train, rides, and lands where a circle warns', () => {
    const MAP = ['######################', '#....................#', '#____________________#', '#____________________#', '#.......P....2.......#', '#....................#', '######################'];
    // the train pulls in a third of a second after the start
    const w = room(MAP, { ...SURVIVE, trains: [{ row: 2, dir: 1, period: 9, offset: 2.5, speed: 200, cars: 2, stop: { at: 14, for: 3 } }] });
    const c = w.reds[0];
    c.timer = 0;
    c.chargeCd = 3;
    const seen: string[] = [];
    let landTell = -1, landed = -1;
    for (let i = 0; i < S(30) && landed < 0 && w.status === 'play'; i++) {
      // keep off the tracks, and out from under the landing once the circle shows
      for (const e of step(w, input({ my: w.player.y < 5 * TILE ? 1 : 0, mx: landTell > 0 ? 1 : 0 }))) {
        if (e.t === 'tell' && e.what === 'board') seen.push('board');
        if (e.t === 'tell' && e.what === 'land') landTell = w.tick;
        if (e.t === 'land') landed = w.tick;
      }
      if (c.state === 'ride' && !seen.includes('ride')) seen.push('ride');
    }
    expect(seen).toEqual(['board', 'ride']);
    expect(landTell).toBeGreaterThan(0);
    expect((landed - landTell) / TICK_RATE).toBeCloseTo(CONDUCTOR.landTell, 1);
    expect(c.hidden).toBe(false);
  });
});
