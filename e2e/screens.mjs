// The screens around a fight, in the real app (first critic pass, critique/2026-10-22-mvp.md): the death
// hold and the strip that names the killer, the blocked-shot mark on your aim line, the tally buttons
// answering the mouse, the PHASE banner and the Manager's card. Screenshots go to e2e/out/screens.
// Usage: node e2e/screens.mjs [baseUrl]
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.argv[2] ?? 'http://127.0.0.1:5200/';
const out = 'e2e/out/screens';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}\n${e.stack}`));
const shot = async (name) => { await page.screenshot({ path: `${out}/${name}.png` }); console.log('shot', name); };
const screen = () => page.evaluate(() => window.__app.screen.name);
const phase = () => page.evaluate(() => window.__app.screen.phase);
// game pixels to page pixels (the 320×180 view fills the 1280×720 page at ×4)
const click = (x, y) => page.mouse.click(x * 4 + 2, y * 4 + 2);

await page.goto(base);
await page.waitForTimeout(800);
await page.evaluate(() => localStorage.clear());

// 1. aim line: a pistol, the cursor beyond a wall; the line ends at the wall with a mark
await page.evaluate(() => {
  const a = window.__app;
  a.startLevel('1-1');
  a.screen.world.player.hands = [{ kind: 'pistol', ammo: 6, boosted: false }];
});
await page.mouse.move(20 * 4, 150 * 4);
await page.waitForTimeout(300);
await shot('1-aim-blocked');

// 2. death: a grunt right next to you, mid-punch
await page.evaluate(() => {
  const s = window.__app.screen, w = s.world, r = w.reds[0];
  r.x = r.px = w.player.x + 12;
  r.y = r.py = w.player.y;
  r.state = 'windup';
  r.t = 0.02;
  r.aim = Math.PI;
});
for (let i = 0; i < 40 && (await phase()) !== 'dead'; i++) await page.waitForTimeout(100);
if ((await phase()) !== 'dead') errors.push('the player did not die');
await page.waitForTimeout(350);
await shot('2-dead-hold');
const killer = await page.evaluate(() => window.__app.screen.killer);
if (!killer) errors.push('the death did not name a killer');
await page.waitForTimeout(600);
await shot('3-dead-strip');

// 3. a clear, then the tally's NEXT button by mouse alone (it used to swallow every click)
await page.evaluate(() => { const a = window.__app; a.autoplay = true; a.startLevel('1-1'); });
for (let i = 0; i < 400 && (await screen()) !== 'tally'; i++) await page.waitForTimeout(200);
await page.evaluate(() => { window.__app.autoplay = false; });
await page.waitForTimeout(3500);
await shot('4-tally');
await click(259, 162);
await page.waitForTimeout(400);
const after = await page.evaluate(() => ({ name: window.__app.screen.name, id: window.__app.screen.def?.id }));
if (after.name !== 'play' || after.id !== '1-2') errors.push(`NEXT by mouse should start 1-2, got ${JSON.stringify(after)}`);

// 4. the boss: glass office, the PHASE banner, the card when it breaks
await page.evaluate(() => { const a = window.__app; a.autoplay = true; a.startLevel('1-8'); });
await page.waitForTimeout(500);
await shot('5-boss-room');
let sawPhase = false, sawCard = false;
for (let i = 0; i < 1500 && ['play'].includes(await screen()); i++) {
  const s = await page.evaluate(() => { const s = window.__app.screen; return { label: s.waveBanner.label, t: s.waveBanner.t, boss: s.bossT, phase: s.phase }; });
  if (!sawPhase && s.label.startsWith('PHASE') && s.t > 0.55 && s.t < 1.3) {
    sawPhase = true;
    await shot('6-phase-banner');
  }
  if (!sawCard && s.boss > 0.6) {
    sawCard = true;
    await shot('7-boss-card');
  }
  if (s.phase === 'dead') {
    errors.push('the bot died to the Manager');
    break;
  }
  await page.waitForTimeout(60);
}
if (!sawPhase) errors.push('no PHASE banner seen');
if (!sawCard) errors.push('no boss card seen');

await browser.close();
if (errors.length) {
  console.error('FAILED\n' + errors.join('\n'));
  process.exit(1);
}
console.log('screens ok');
