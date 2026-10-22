// Plays a level all the way through the real app with the bot at the controls (app.autoplay): the time
// rule, recording, the clear, the "STILL. FRAME." replay, the tally and the save. Screenshots go to
// e2e/out/clear. Fails on console errors or if the level isn't banked.
// Usage: node e2e/clear.mjs [baseUrl] [levelId]
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.argv[2] ?? 'http://127.0.0.1:5200/';
const level = process.argv[3] ?? '1-1';
const out = 'e2e/out/clear';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}\n${e.stack}`));
const shot = async (name) => { await page.screenshot({ path: `${out}/${level}-${name}.png` }); console.log('shot', name); };
const screen = () => page.evaluate(() => window.__app.screen.name);

await page.goto(base);
await page.waitForTimeout(800);
await page.evaluate((id) => { localStorage.clear(); const a = window.__app; a.autoplay = true; a.startLevel(id); }, level);
let shotMid = false;
for (let i = 0; i < 1400 && (await screen()) === 'play'; i++) {
  await page.waitForTimeout(250);
  const k = await page.evaluate(() => window.__app.screen.world?.stats.kills ?? 0);
  if (!shotMid && k >= 1) {
    shotMid = true;
    await shot('1-fight');
  }
  if ((await page.evaluate(() => window.__app.screen.phase)) === 'dead') {
    await shot('dead');
    errors.push('the bot died in the real app');
    break;
  }
}
if ((await screen()) === 'replay') {
  await page.waitForTimeout(700);
  await shot('2-replay');
}
if ((await screen()) === 'play') console.log('still playing at tick', await page.evaluate(() => window.__app.screen.world.tick));
for (let i = 0; i < 200 && (await screen()) === 'replay'; i++) await page.waitForTimeout(200);
await page.waitForTimeout(3500);
await shot('3-tally');
const save = await page.evaluate(() => JSON.parse(localStorage.getItem('stillframe.save.v1') ?? 'null'));
console.log('screen', await screen(), 'save', save && { coins: save.coins, levels: save.levels });
if (!save || !save.levels[level] || save.levels[level].clears !== 1) errors.push('the clear was not saved');
await browser.close();
if (errors.length) {
  console.error('FAILED\n' + errors.join('\n'));
  process.exit(1);
}
console.log('clear ok');
