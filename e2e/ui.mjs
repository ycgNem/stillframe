// Playwright: a picture of every screen and the HUD at 1280×720 (game ×4, UI ×2), for judging the text
// and cards by eye. Fails on console errors.
// Usage: node e2e/ui.mjs [baseUrl] [width] [height]   (start `npm run dev` first)
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.argv[2] ?? 'http://127.0.0.1:5200/';
const W = Number(process.argv[3] ?? 1280), H = Number(process.argv[4] ?? 720);
const out = `e2e/out/ui-${W}`;
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}\n${e.stack}`));
const shot = async (name) => { await page.screenshot({ path: `${out}/${name}.png` }); console.log('shot', name); };
const wait = (ms) => page.waitForTimeout(ms);
const app = (fn, arg) => page.evaluate(fn, arg);

await page.goto(base);
await wait(1200);
// a save part-way through, so the map and workshop have something to show
await app(() => {
  const s = window.__app.save;
  s.coins = 312;
  s.earned = 640;
  for (const [id, st] of [['1-1', [1, 1, 1]], ['1-2', [1, 1, 0]], ['1-3', [1, 0, 1]], ['1-4', [1, 1, 0]]]) s.levels[id] = { stars: st.map(Boolean), best: 600 + id.length * 60, clears: 1 };
  s.up.stride = 1;
  s.up.shield = 2;
  s.up.frameskip = 1;
  s.up.rewind = 1;
  s.holster = true;
});
await page.mouse.move(W * 0.6, H * 0.5);
await shot('01-title');
await app(() => window.__app.open('map'));
await wait(300);
await shot('02-map');
await app(() => window.__app.startLevel('1-5', false));
await wait(300);
await shot('03-intro');
await page.keyboard.press('Space');
await wait(200);
await page.keyboard.down('KeyD');
await wait(700);
await page.keyboard.up('KeyD');
await page.mouse.move(W * 0.7, H * 0.4);
await wait(300);
await shot('04-hud');
await page.keyboard.press('Escape');
await wait(200);
await shot('05-pause');
await app(() => window.__app.startLevel('1-1', true));
await wait(300);
await shot('06-hint');
// die: put the player in front of a gunner's bullet
await app(() => { const s = window.__app.screen; s.world.status = 'dead'; s.onEvent({ t: 'death', x: s.world.player.x, y: s.world.player.y, aim: 0, by: s.world.reds[0]?.id ?? 0 }); });
await wait(900);
await shot('07-dead');
await app(() => window.__app.open('workshop'));
await wait(300);
await shot('08-workshop');
await app(() => window.__app.open('settings'));
await wait(300);
await shot('09-settings');
await app(() => window.__app.open('end'));
await wait(2500);
await shot('10-end');
// a real clear through replay and tally
await app(() => { window.__app.autoplay = true; window.__app.startLevel('1-2', true); });
for (let i = 0; i < 120; i++) {
  await wait(250);
  const name = await app(() => window.__app.screen.name);
  if (name === 'replay') { await wait(700); await shot('11-replay'); break; }
}
await app(() => { window.__app.screen.finish?.(); });
for (let i = 0; i < 40; i++) {
  await wait(250);
  if ((await app(() => window.__app.screen.name)) === 'tally') break;
}
await wait(3500);
await shot('12-tally');
await app(() => { window.__app.autoplay = false; });

await browser.close();
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('ok');
