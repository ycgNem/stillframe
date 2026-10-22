// A screenshot of every level: as it opens (frozen), and a few seconds into a bot run. e2e/out/levels.
// Usage: node e2e/levels.mjs [baseUrl]
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.argv[2] ?? 'http://127.0.0.1:5200/';
const out = 'e2e/out/levels';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console] ${m.text()}`); });
await page.goto(base);
await page.waitForTimeout(800);
const ids = await page.evaluate(() => ['1-1', '1-2', '1-3', '1-4', '1-5', '1-6', '1-7', '1-8']);
for (const id of ids) {
  await page.evaluate((id) => { const a = window.__app; a.autoplay = false; a.startLevel(id, false); }, id);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/${id}-intro.png` });
  await page.evaluate(() => { const a = window.__app; a.autoplay = true; a.screen.begin?.(); });
  await page.evaluate((id) => window.__app.startLevel(id), id);
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${out}/${id}-play.png` });
  console.log(id, await page.evaluate(() => ({ screen: window.__app.screen.name, phase: window.__app.screen.phase, tick: window.__app.screen.world?.tick })));
}
await browser.close();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('levels ok');
