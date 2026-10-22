// Playwright smoke test: boot → title → map → level 1-1 → walk, pick up, shoot → frozen mid-fight →
// pause → death → restart. Saves screenshots to e2e/out/smoke and fails on console errors.
// Usage: node e2e/smoke.mjs [baseUrl]   (start `npm run dev` first; uses the installed Chrome)
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.argv[2] ?? 'http://127.0.0.1:5200/';
const out = 'e2e/out/smoke';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}\n${e.stack}`));
const shot = async (name) => { await page.screenshot({ path: `${out}/${name}.png` }); console.log('shot', name); };
const wait = (ms) => page.waitForTimeout(ms);
/** a game pixel to a page pixel (the canvas is centred at a whole-number scale) */
const px = async (x, y) => page.evaluate(([x, y]) => {
  const r = document.getElementById('game').getBoundingClientRect();
  return [r.left + (x / 320) * r.width, r.top + (y / 180) * r.height];
}, [x, y]);
const screenName = () => page.evaluate(() => window.__app.screen.name);

await page.goto(base);
await wait(1500);
await shot('01-title');

// title → map
const [pxp, pyp] = await px(160, 85);
await page.mouse.click(pxp, pyp);
await wait(400);
await shot('02-map');
if ((await screenName()) !== 'map') errors.push(`expected the map, got ${await screenName()}`);

// the level's intro card, then play
await page.evaluate(() => window.__app.startLevel('1-1', false));
await wait(400);
await shot('03-intro');
await page.keyboard.press('Space');
await wait(200);

// stand still: time crawls
const t0 = await page.evaluate(() => window.__app.screen.world.tick);
await wait(1000);
const t1 = await page.evaluate(() => window.__app.screen.world.tick);
// walk: time runs
await page.keyboard.down('KeyD');
await wait(1000);
await page.keyboard.up('KeyD');
const t2 = await page.evaluate(() => window.__app.screen.world.tick);
console.log('ticks: idle 1 s', t1 - t0, '; walking 1 s', t2 - t1);
if (t1 - t0 > 6) errors.push(`time ran while standing still (${t1 - t0} ticks in 1 s)`);
if (t2 - t1 < 30) errors.push(`time barely ran while walking (${t2 - t1} ticks in 1 s)`);

// walk back to the pistol (until it's in reach) and click it
for (let i = 0; i < 40; i++) {
  const g = await page.evaluate(() => {
    const w = window.__app.screen.world, it = w.items.find((i) => i.kind === 'pistol');
    return it ? { dx: it.x - w.player.x, dy: it.y - w.player.y } : null;
  });
  if (!g || Math.hypot(g.dx, g.dy) < 12) break;
  const kx = Math.abs(g.dx) > 4 ? (g.dx > 0 ? 'KeyD' : 'KeyA') : null, ky = Math.abs(g.dy) > 4 ? (g.dy > 0 ? 'KeyS' : 'KeyW') : null;
  for (const k of [kx, ky]) if (k) await page.keyboard.down(k);
  await wait(80);
  for (const k of [kx, ky]) if (k) await page.keyboard.up(k);
}
await wait(200);
const gun = await page.evaluate(() => {
  const w = window.__app.screen.world, s = window.__app.screen;
  const it = w.items.find((i) => i.kind === 'pistol');
  return it ? { x: it.x - s.cam.x, y: it.y - s.cam.y, d: Math.hypot(it.x - w.player.x, it.y - w.player.y) } : null;
});
if (gun) {
  const [gx, gy] = await px(gun.x, gun.y);
  await page.mouse.click(gx, gy);
  await wait(500);
}
const hands = await page.evaluate(() => window.__app.screen.world.player.hands.map((h) => h.kind));
console.log('hands', hands, 'gun was', gun);
if (!hands.includes('pistol')) errors.push('could not pick up the pistol');

// shoot at the nearest red, then freeze for a mid-fight frame
for (let i = 0; i < 3; i++) {
  const red = await page.evaluate(() => {
    const w = window.__app.screen.world, s = window.__app.screen;
    const r = w.reds.slice().sort((a, b) => Math.hypot(a.x - w.player.x, a.y - w.player.y) - Math.hypot(b.x - w.player.x, b.y - w.player.y))[0];
    return r ? { x: r.x - s.cam.x, y: r.y - s.cam.y - 7 } : null;
  });
  if (!red) break;
  const [rx, ry] = await px(red.x, red.y);
  await page.mouse.move(rx, ry);
  await page.mouse.down();
  await page.mouse.up();
  await wait(250);
}
await shot('04-mid-fight');
const kills = await page.evaluate(() => window.__app.screen.world.stats.kills);
console.log('kills', kills);

// pause and resume
await page.keyboard.press('Escape');
await wait(200);
await shot('05-pause');
await page.keyboard.press('Escape');
await wait(200);

// die on purpose: a level with a gunner, standing still for a long time
await page.evaluate(() => window.__app.startLevel('1-4'));
await page.keyboard.down('KeyD');
await wait(6000);
await page.keyboard.up('KeyD');
await wait(500);
console.log('after 1-4 walk', await page.evaluate(() => window.__app.screen.phase));
await shot('06-after');

// the other screens
await page.evaluate(() => { window.__app.save.coins = 500; window.__app.open('workshop'); });
await wait(300);
await shot('07-workshop');
await page.evaluate(() => window.__app.open('settings'));
await wait(300);
await shot('08-settings');
await page.evaluate(() => window.__app.open('end'));
await wait(2500);
await shot('09-end');
await page.evaluate(() => { window.__app.save.coins = 0; });
// every sprite in the atlas (docs/PLAN.md M6)
await page.evaluate(() => window.__app.open('contact'));
for (let i = 0; i < 4; i++) {
  await wait(300);
  await shot(`10-contact-${i + 1}`);
  for (let k = 0; k < 4; k++) {
    await page.mouse.wheel(0, 100);
    await wait(40);
  }
}

await browser.close();
if (errors.length) {
  console.error('FAILED\n' + errors.join('\n'));
  process.exit(1);
}
console.log('smoke ok');
