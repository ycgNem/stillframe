import { input, room, aimAt } from '../../tests/helpers';
import { step } from '../../src/sim/world';
const OPEN = ['############','#..........#','#..........#','#..........#','#..........#','#..........#','############'];
function place(...marks: [string, number, number][]) {
  const rows = OPEN.map((r) => r.split(''));
  for (const [c, x, y] of marks) rows[y][x] = c;
  return rows.map((r) => r.join(''));
}
export function main() {
  const w = room(place(['P', 2, 3], ['g', 6, 3], ['m', 2, 4]));
  step(w, input({ pick: -1 }));
  console.log('hands', JSON.stringify(w.player.hands));
  for (let i = 0; i < 200 && w.status === 'play'; i++) {
    const r = w.reds[0];
    const close = Math.hypot(r.x - w.player.x, r.y - w.player.y) < 22;
    const ev = step(w, input({ aim: aimAt(w, r.x, r.y), alt: i === 0, fire: close && i > 0, mx: close || i < 20 ? 0 : 1 }));
    if (ev.length || i % 10 === 0) console.log(i, r.state, 'stun', r.stun.toFixed(2), r.stunByThrow, 'hp', r.hp, 'd', Math.hypot(r.x - w.player.x, r.y - w.player.y).toFixed(1), ev.map((e) => e.t).join(','));
  }
  console.log(w.status, w.stats);
}
