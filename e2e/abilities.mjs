// Upgrades in the real app: Frameskip (Space dashes in zero game time), Shield (a free hit), Rewind (die,
// jump back 2 s, the replay record forgets the undone part). Screenshots in e2e/out/abilities.
// Usage: node e2e/abilities.mjs [baseUrl]
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.argv[2] ?? 'http://127.0.0.1:5200/';
const out = 'e2e/out/abilities';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console] ${m.text()}`); });
const wait = (ms) => page.waitForTimeout(ms);
await page.goto(base);
await wait(800);
await page.evaluate(() => {
  const a = window.__app;
  Object.assign(a.save.up, { frameskip: 1, shield: 1, rewind: 1 });
  a.startLevel('1-7');
});
await wait(300);
// aim right, dash
const before = await page.evaluate(() => { const s = window.__app.screen; return { x: s.world.player.x, tick: s.world.tick }; });
const r = await page.evaluate(() => { const c = document.getElementById('game').getBoundingClientRect(); return [c.left + c.width * 0.9, c.top + c.height * 0.5]; });
await page.mouse.move(r[0], r[1]);
await wait(100);
await page.keyboard.press('Space');
await wait(150);
const after = await page.evaluate(() => { const s = window.__app.screen; return { x: s.world.player.x, tick: s.world.tick }; });
console.log('dash', before, '->', after);
if (after.x - before.x < 40) errors.push('Frameskip did not move the player 3 tiles');
if (after.tick - before.tick > 2) errors.push(`Frameskip took ${after.tick - before.tick} ticks`);
await page.screenshot({ path: `${out}/1-dash.png` });
// stand still in the open until the reds come: the shield takes the first hit, rewind the second
await page.keyboard.down('KeyS');
let saw = { shield: false, rewind: false, dead: false };
for (let i = 0; i < 200 && !saw.dead; i++) {
  await wait(100);
  const s = await page.evaluate(() => { const s = window.__app.screen; return { phase: s.phase, shield: s.world.player.shield, rewinds: s.world.stats.rewinds, rec: s.rec.length, tick: s.world.tick }; });
  if (s.shield === 0 && !saw.shield) { saw.shield = true; await page.screenshot({ path: `${out}/2-shield.png` }); }
  if (s.phase === 'rewind' && !saw.rewind) {
    saw.rewind = true;
    console.log('rewound to tick', s.tick, 'record length', s.rec);
    if (s.rec !== s.tick) errors.push(`the record (${s.rec}) does not match the rewound tick (${s.tick})`);
    await wait(150);
    await page.screenshot({ path: `${out}/3-rewind.png` });
  }
  if (s.phase === 'dead') saw.dead = true;
}
await page.keyboard.up('KeyS');
console.log(saw);
if (!saw.shield) errors.push('the shield never broke');
if (!saw.rewind) errors.push('no rewind happened');
await browser.close();
if (errors.length) { console.error('FAILED\n' + errors.join('\n')); process.exit(1); }
console.log('abilities ok');
