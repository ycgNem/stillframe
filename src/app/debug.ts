// ?debug in the URL: sliders for the time rule (docs/PLAN.md M1), so the feel can be tuned while playing.
// F3 toggles the in-game overlay (time scale, ticks/s, burst, game vs real time) anywhere.
import { TIME } from '../data/tuning';
import type { App } from './app';

const SLIDERS: [keyof typeof TIME, number, number, number][] = [
  ['idle', 0, 0.2, 0.005],
  ['walk', 0.3, 1, 0.01],
  ['burst', 0, 0.5, 0.01],
  ['rampUp', 2, 40, 1],
  ['rampDown', 2, 40, 1],
];

export function installDebugSliders(app: App) {
  app.debug = true;
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:8px;top:8px;background:#14161a;color:#3fd0e0;font:12px monospace;padding:8px;border:1px solid #50565f;z-index:9';
  for (const [key, min, max, stepV] of SLIDERS) {
    const row = document.createElement('label');
    row.style.display = 'block';
    const out = document.createElement('span');
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(stepV);
    input.value = String(TIME[key]);
    out.textContent = ` ${key} ${TIME[key]}`;
    input.oninput = () => {
      TIME[key] = Number(input.value);
      out.textContent = ` ${key} ${TIME[key]}`;
    };
    row.append(input, out);
    box.append(row);
  }
  document.body.append(box);
}
