// Later waves come through the doors: after the room is cleared, or at a set game time.
import type { SpawnDef } from '../data/levels/types';
import { TICK_RATE, TILE, WAVES } from '../data/tuning';
import { TILE_FLOOR, tileAt } from './grid';
import { makeRed } from './level';
import type { SimEvent, World } from './types';

const DT = 1 / TICK_RATE;

/** Puts reds in line at their doors, a stagger apart. */
export function queueSpawns(w: World, reds: SpawnDef[], ev: SimEvent[]) {
  const last = w.waves.pending.length ? w.waves.pending[w.waves.pending.length - 1].t : 0;
  reds.forEach((s, i) => w.waves.pending.push({ ...s, t: last + i * WAVES.stagger }));
  w.waves.started++;
  ev.push({ t: 'wave', n: w.waves.started });
}

/** Are more reds still to come? */
export function wavesLeft(w: World): boolean {
  return w.waves.next < w.waveDefs.length || w.waves.pending.length > 0;
}

export function stepWaves(w: World, ev: SimEvent[]) {
  const ws = w.waves;
  const now = w.tick / TICK_RATE;
  while (ws.next < w.waveDefs.length) {
    const d = w.waveDefs[ws.next];
    if (d.when === 'time') {
      if (now < (d.at ?? 0)) break;
      ws.next++;
      queueSpawns(w, d.reds, ev);
      continue;
    }
    // 'clear': once the room is empty and nobody is waiting at a door
    if (w.reds.some((r) => !r.dead) || ws.pending.length) {
      ws.timer = -1;
      break;
    }
    if (ws.timer < 0) ws.timer = WAVES.clearDelay;
    ws.timer -= DT;
    if (ws.timer > 0) break;
    ws.timer = -1;
    ws.next++;
    queueSpawns(w, d.reds, ev);
    break;
  }

  for (const s of ws.pending) s.t -= DT;
  while (ws.pending.length && ws.pending[0].t <= 0) {
    const s = ws.pending.shift()!;
    const door = w.doors[s.door % Math.max(1, w.doors.length)];
    if (!door) continue;
    const r = makeRed(w, s.kind, door.x, door.y, s.item);
    // walk in toward whichever side of the door is floor
    const cx = Math.floor(door.x / TILE), cy = Math.floor(door.y / TILE);
    const sides = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    const into = sides.find(([dx, dy]) => tileAt(w, cx + dx, cy + dy) === TILE_FLOOR) ?? [0, 1];
    r.state = 'enter';
    r.t = WAVES.enterTime;
    r.cvx = into[0];
    r.cvy = into[1];
    r.aim = Math.atan2(into[1], into[0]);
    w.reds.push(r);
    door.open = 0.8;
    ev.push({ t: 'spawn', x: door.x, y: door.y, door: s.door });
  }
  for (const d of w.doors) d.open = Math.max(0, d.open - DT);
}
