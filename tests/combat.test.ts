// One scenario per verb (docs/PLAN.md M2): punch disarms, throw stuns, parry, gunner keeps range, and the rest.
import { describe, expect, it } from 'vitest';
import { COINS, TILE } from '../src/data/tuning';
import { CHARGE } from '../src/data/reds';
import { challengeMet } from '../src/sim/challenges';
import { step } from '../src/sim/world';
import { aimAt, input, room, run } from './helpers';

const OPEN = [
  '############',
  '#..........#',
  '#..........#',
  '#..........#',
  '#..........#',
  '#..........#',
  '############',
];

/** OPEN with letters placed at [col, row]. */
function place(...marks: [string, number, number][]) {
  const rows = OPEN.map((r) => r.split(''));
  for (const [c, x, y] of marks) rows[y][x] = c;
  return rows.map((r) => r.join(''));
}

describe('fists', () => {
  it('the first punch knocks an armed red\'s gun loose', () => {
    const w = room(place(['P', 3, 3], ['q', 4, 3]));
    const r = w.reds[0];
    const ev = step(w, input({ aim: 0, fire: true }));
    expect(ev.some((e) => e.t === 'punch' && e.hit)).toBe(true);
    expect(ev.some((e) => e.t === 'disarm')).toBe(true);
    expect(r.held).toBeNull();
    expect(w.items.some((i) => i.kind === 'pistol')).toBe(true);
    expect(r.hp).toBe(2);
  });

  it('three punches shatter a grunt, and the stun stops it hitting back', () => {
    const w = room(place(['P', 3, 3], ['g', 4, 3]));
    const ev = run(w, 120, (w) => input({ aim: aimAt(w, w.reds[0]?.x ?? 0, w.reds[0]?.y ?? 0), fire: true, mx: 0 }));
    expect(ev.filter((e) => e.t === 'punch' && e.from === 'player' && e.hit).length).toBeGreaterThanOrEqual(3);
    expect(w.stats.punchKills).toBe(1);
    expect(w.status).toBe('clear');
  });

  it('a punch at nothing whiffs', () => {
    const w = room(place(['P', 3, 3], ['g', 9, 3]));
    const ev = step(w, input({ aim: Math.PI, fire: true }));
    expect(ev.find((e) => e.t === 'punch')).toMatchObject({ hit: false });
  });
});

describe('guns', () => {
  it('a click with a pistol shoots; cooldown in game time; empty guns get thrown', () => {
    const w = room(place(['P', 2, 3], ['p', 2, 4], ['g', 10, 1]));
    step(w, input({ pick: -1 }));
    expect(w.player.hands[0]).toMatchObject({ kind: 'pistol', ammo: 6 });
    let shots = 0;
    for (let i = 0; i < 200; i++) {
      const ev = step(w, input({ aim: Math.PI, fire: true }));
      shots += ev.filter((e) => e.t === 'shot').length;
      if (ev.some((e) => e.t === 'throw')) break;
    }
    expect(shots).toBe(6);
    expect(w.player.hands).toHaveLength(0);
    expect(w.stats.throws).toBe(1);
  });

  it('a shot fired during the cooldown waits: nothing happens until the gun is ready', () => {
    const w = room(place(['P', 2, 3], ['g', 10, 5]), {}, { loadout: 'pistol' });
    expect(step(w, input({ aim: Math.PI, fire: true })).some((e) => e.t === 'shot')).toBe(true);
    expect(step(w, input({ aim: Math.PI, fire: true })).some((e) => e.t === 'shot')).toBe(false);
    const ev = run(w, 30, input({ aim: Math.PI, fire: true }));
    expect(ev.some((e) => e.t === 'shot')).toBe(true);
  });

  it('bullets stop at walls but break glass and fly on', () => {
    const w = room([
      '##########',
      '#P..=...g#',
      '##########',
    ], {}, { loadout: 'pistol' });
    const ev = run(w, 90, (w, i) => input({ aim: 0, fire: i === 0 }));
    expect(ev.some((e) => e.t === 'glass')).toBe(true);
    expect(w.stats.kills).toBe(1);
    const v = room(['######', '#P.#g#', '######'], {}, { loadout: 'pistol' });
    run(v, 90, (w, i) => input({ aim: 0, fire: i === 0 }));
    expect(v.reds).toHaveLength(1);
    expect(v.stats.misses).toBe(1);
  });

  it('a bullet that meets a red bullet cancels it: a parry, +3 coins', () => {
    const w = room(place(['P', 2, 3], ['G', 9, 3]), {}, { loadout: 'pistol' });
    const g = w.reds[0];
    g.cooldown = 0;
    let parried = false;
    for (let i = 0; i < 400 && !parried && w.status === 'play'; i++) {
      // fire back the moment the red's bullet is in the air
      const incoming = w.bullets.some((b) => b.from === 'red');
      const ev = step(w, input({ aim: aimAt(w, g.x, g.y), fire: incoming && !w.bullets.some((b) => b.from === 'player') }));
      parried = ev.some((e) => e.t === 'parry');
    }
    expect(parried).toBe(true);
    expect(w.stats.parries).toBe(1);
    expect(w.stats.styleCoins).toBe(COINS.parry);
  });
});

describe('throws', () => {
  it('a throw stuns and disarms; an empty gun lands on the floor', () => {
    // an armed grunt walking straight at you
    const w = room(place(['P', 1, 3], ['q', 9, 3]), {}, { loadout: 'pistol' });
    w.player.hands[0].ammo = 0;
    const g = w.reds[0];
    g.cooldown = 9;
    const ev = run(w, 40, (w, i) => input({ aim: aimAt(w, g.x, g.y), alt: i === 0 }));
    expect(ev.some((e) => e.t === 'stun')).toBe(true);
    expect(g.held).toBeNull();
    expect(w.items.filter((i) => i.kind === 'pistol')).toHaveLength(2);
    expect(g.hp).toBe(3);
  });

  it('a mug breaks on impact; a kill on the stunned red is a stun kill (+2)', () => {
    const w = room(place(['P', 2, 3], ['g', 6, 3], ['m', 2, 4]));
    step(w, input({ pick: -1 }));
    const g = w.reds[0];
    const ev = run(w, 200, (w, i) => {
      const r = w.reds[0];
      if (!r) return input();
      const close = Math.hypot(r.x - w.player.x, r.y - w.player.y) < 22;
      return input({ aim: aimAt(w, r.x, r.y), alt: i === 0, fire: close && i > 0, mx: close || i < 20 ? 0 : 1 });
    });
    expect(ev.some((e) => e.t === 'break' && e.item === 'mug')).toBe(true);
    expect(ev.some((e) => e.t === 'stun' && e.id === g.id)).toBe(true);
    expect(w.stats.stunKills).toBe(1);
    expect(w.stats.styleCoins).toBe(COINS.stunKill);
  });

  it('Arm II: a throw shatters a grunt outright', () => {
    const w = room(place(['P', 2, 3], ['g', 8, 3], ['b', 2, 4]), {}, { arm: 2 });
    step(w, input({ pick: -1 }));
    run(w, 40, (w, i) => input({ aim: aimAt(w, w.reds[0]?.x ?? 0, w.reds[0]?.y ?? 0), alt: i === 0 }));
    expect(w.stats.throwKills).toBe(1);
    expect(w.status).toBe('clear');
  });

  it('Arm III: a throw off a wall that kills is a ricochet (+3)', () => {
    // throw away from the grunt: it bounces off the wall behind you and comes back at it
    const w = room(place(['P', 2, 3], ['g', 9, 3]), {}, { arm: 3, loadout: 'pistol' });
    w.player.hands[0].ammo = 0;
    run(w, 120, (w, i) => input({ aim: Math.PI, alt: i === 0 }));
    expect(w.stats.ricochetKills).toBe(1);
    expect(w.stats.styleCoins).toBe(COINS.ricochet);
  });
});

describe('pickups', () => {
  it('picks up only within reach; Reach raises it', () => {
    const far = place(['P', 2, 3], ['p', 4, 3], ['g', 10, 5]);
    const w = room(far);
    step(w, input({ pick: -1 }));
    expect(w.player.hands).toHaveLength(0);
    const w2 = room(far, {}, { reach: 2 });
    step(w2, input({ pick: -1 }));
    expect(w2.player.hands).toHaveLength(1);
  });

  it('Mag adds rounds once: dropping and re-taking a gun gives nothing more', () => {
    const w = room(place(['P', 2, 3], ['p', 2, 4], ['b', 3, 3], ['g', 10, 5]), {}, { mag: 2 });
    step(w, input({ pick: w.items.find((i) => i.kind === 'pistol')!.id }));
    expect(w.player.hands[0].ammo).toBe(8);
    step(w, input({ pick: w.items.find((i) => i.kind === 'bottle')!.id }));
    const back = w.items.find((i) => i.kind === 'pistol')!;
    expect(back.ammo).toBe(8);
    step(w, input({ pick: back.id }));
    expect(w.player.hands[0].ammo).toBe(8);
  });

  it('the Holster carries two things and Q swaps them', () => {
    const w = room(place(['P', 2, 3], ['p', 2, 4], ['b', 3, 3], ['g', 10, 5]), {}, { holster: true });
    step(w, input({ pick: w.items.find((i) => i.kind === 'pistol')!.id }));
    step(w, input({ pick: w.items.find((i) => i.kind === 'bottle')!.id }));
    expect(w.player.hands.map((h) => h.kind)).toEqual(['bottle', 'pistol']);
    step(w, input({ swap: true }));
    expect(w.player.hands.map((h) => h.kind)).toEqual(['pistol', 'bottle']);
  });

  it('Reach III catches a red\'s throw out of the air', () => {
    const w = room(place(['P', 2, 3], ['g', 7, 3]), {}, { reach: 3 });
    const g = w.reds[0];
    g.held = { kind: 'bottle', ammo: 0, boosted: false };
    const ev = run(w, 120);
    expect(ev.some((e) => e.t === 'throw' && e.from === 'red')).toBe(true);
    expect(w.player.hands[0]?.kind).toBe('bottle');
    expect(w.status).toBe('play');
  });
});

describe('reds', () => {
  it('a grunt\'s punch has a 0.5 s windup you can step out of', () => {
    const w = room(place(['P', 3, 3], ['g', 5, 3]));
    let told = -1;
    for (let i = 0; i < 300 && w.status === 'play'; i++) {
      const ev = step(w, input({ mx: told >= 0 ? -1 : 0 }));
      if (told < 0 && ev.some((e) => e.t === 'tell' && e.what === 'punch')) told = i;
      if (told >= 0 && i > told + 40) break;
    }
    expect(told).toBeGreaterThanOrEqual(0);
    expect(w.status).toBe('play');
  });

  it('a gunner keeps its distance and strafes, and shows its aim before firing', () => {
    const w = room([
      '####################',
      '#..................#',
      '#..................#',
      '#.......PG.........#',
      '#..................#',
      '#..................#',
      '####################',
    ], {}, { shield: 3 });
    w.player.shield = 99;
    const g = w.reds[0];
    let maxD = 0, aimTicks = 0, shots = 0;
    for (let i = 0; i < 60 * 6; i++) {
      const ev = step(w, input());
      maxD = Math.max(maxD, Math.hypot(g.x - w.player.x, g.y - w.player.y));
      if (g.state === 'aim') aimTicks++;
      shots += ev.filter((e) => e.t === 'shot' && e.from === 'red').length;
      if (w.status !== 'play') break;
    }
    expect(maxD).toBeGreaterThan(4 * TILE * 0.9);
    expect(shots).toBeGreaterThan(0);
    expect(aimTicks / shots).toBeGreaterThanOrEqual(0.4 * 60 - 1);
  });

  it('reds pick up guns they walk over', () => {
    const w = room(place(['P', 1, 3], ['p', 6, 3], ['g', 9, 3]));
    run(w, 120);
    expect(w.reds[0].held?.kind).toBe('pistol');
  });

  it('a brute charges after a tell, and a wall leaves it dazed', () => {
    const w = room([
      '##############',
      '#............#',
      '#..B......P..#',
      '#............#',
      '##############',
    ]);
    const b = w.reds[0];
    let telled = false, charged = false;
    for (let i = 0; i < 300 && w.status === 'play'; i++) {
      // step out of the line once it commits
      const dodge = b.state === 'charge' || (b.state === 'chargeTell' && b.t < 0.3);
      step(w, input({ my: dodge ? 1 : 0 }));
      telled ||= b.state === 'chargeTell';
      charged ||= b.state === 'charge';
      if (charged && b.stun > 0) break;
    }
    expect(telled && charged).toBe(true);
    expect(w.status).toBe('play');
    expect(b.stun).toBeGreaterThan(CHARGE.wallStun - 0.5);
  });

  it('a red\'s bullet can shatter another red', () => {
    const w = room(place(['P', 1, 3], ['g', 4, 3], ['G', 8, 3]));
    w.player.shield = 9;
    run(w, 60 * 4);
    expect(w.stats.kills).toBeGreaterThanOrEqual(1);
  });
});

describe('abilities', () => {
  it('a shield takes one hit, then you are mortal again', () => {
    const w = room(place(['P', 3, 3], ['g', 4, 3]), {}, { shield: 1 });
    const ev = run(w, 60 * 6);
    expect(ev.some((e) => e.t === 'shield')).toBe(true);
    expect(w.stats.shieldsUsed).toBe(1);
    expect(w.status).toBe('dead');
  });

  it('Frameskip dashes 3 tiles in one tick, stopped by walls; tier III shatters reds on the way', () => {
    const w = room(place(['P', 2, 3], ['g', 10, 1]), {}, { frameskip: 1 });
    const x0 = w.player.x;
    step(w, input({ aim: 0, dash: true }));
    expect(w.player.x - x0).toBeCloseTo(48, 0);
    step(w, input({ aim: 0, dash: true }));
    expect(w.player.x - x0).toBeLessThan(50);
    const v = room(place(['P', 2, 3], ['g', 4, 3]), {}, { frameskip: 3 });
    step(v, input({ aim: 0, dash: true }));
    expect(v.stats.dashKills).toBe(1);
    const wall = room(['#######', '#P.#..#', '#######'], {}, { frameskip: 1 });
    step(wall, input({ aim: 0, dash: true }));
    expect(wall.player.x).toBeLessThan(48);
  });
});

describe('coins and challenges', () => {
  it('kills chained within a game second pay a combo', () => {
    const w = room(place(['P', 2, 3], ['g', 6, 2], ['g', 6, 3], ['g', 6, 4]), {}, { loadout: 'shotgun' });
    run(w, 60, (w, i) => input({ aim: 0, fire: i === 0 }));
    expect(w.stats.kills).toBe(3);
    expect(w.stats.maxCombo).toBe(3);
    expect(w.stats.comboCoins).toBe(1 + 2);
    expect(w.stats.killCoins).toBe(3 * COINS.kill);
  });

  it('challenges read the stats', () => {
    const w = room(place(['P', 2, 3], ['g', 6, 3]));
    expect(challengeMet({ id: 'fists' }, w)).toBe(true);
    w.stats.shots = 1;
    expect(challengeMet({ id: 'fists' }, w)).toBe(false);
    expect(challengeMet({ id: 'noMiss' }, w)).toBe(true);
    w.stats.misses = 1;
    expect(challengeMet({ id: 'noMiss' }, w)).toBe(false);
  });
});

describe('goals and waves', () => {
  it('later waves come through the doors once the room is clear', () => {
    const w = room([
      '##########',
      '#P.......D',
      '#.g......#',
      '##########',
    ], { waves: [{ when: 'clear', reds: [{ kind: 'grunt', door: 0 }, { kind: 'grunt', door: 0 }] }] }, { loadout: 'pistol' });
    const ev = run(w, 60 * 3, (w) => input({ aim: w.reds[0] ? aimAt(w, w.reds[0].x, w.reds[0].y) : 0, fire: w.reds.some((r) => r.state !== 'enter') }));
    expect(ev.filter((e) => e.t === 'spawn')).toHaveLength(2);
    expect(ev.some((e) => e.t === 'wave')).toBe(true);
  });

  it('escape ends at the exit; survive ends when the clock runs out', () => {
    const e = room(['#######', '#P...X#', '#######'], { goal: { kind: 'escape' } });
    run(e, 120, input({ mx: 1 }));
    expect(e.status).toBe('clear');
    const s = room(['#######', '#P....#', '#######'], { goal: { kind: 'survive', seconds: 2 } });
    run(s, 119);
    expect(s.status).toBe('play');
    run(s, 2);
    expect(s.status).toBe('clear');
  });
});
