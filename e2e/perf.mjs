// Playwright: the performance budget (docs/PLAN.md M12): 60 fps with 40 reds and 300 shards in flight on
// a laptop. Starts a big level, adds reds and shatters some so shards fly, lets the bot play with time at
// full speed, and measures real frame intervals and the app's own work per frame for 6 seconds.
// Usage: node e2e/perf.mjs [baseUrl]   (start `npm run dev` or `npm run preview` first)
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://127.0.0.1:5200/';
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(base);
await page.waitForTimeout(1200);

const result = await page.evaluate(async () => {
  const app = window.__app;
  const { makeRed } = await import('/src/sim/level.ts');
  app.autoplay = true;
  app.startLevel('5-7', true);
  await new Promise((r) => setTimeout(r, 300));
  const s = app.screen, w = s.world;
  // the bot can't lose the test: forty reds and nobody dies
  w.player.grace = 1e9;
  for (let i = w.reds.length; i < 40; i++) {
    const r = makeRed(w, i % 3 ? 'grunt' : 'runner', 40 + (i * 37) % 300, 30 + (i * 23) % 80, null);
    w.reds.push(r);
  }
  // time at full speed whatever the bot does
  const scale = s.scale.bind(s);
  s.scale = (dt) => (scale(dt), 1);
  // shards: shatter a dozen reds (each throws ~150) and keep 300+ in the air
  const shatterSome = () => {
    for (const r of w.reds.slice(0, 2)) s.fx.event({ t: 'shatter', x: r.x, y: r.y, id: r.id, kind: r.kind, aim: 0, cause: 'bullet', coins: 2 }, w);
  };
  // the app's own work per frame
  const work = [];
  const frame = app.frame.bind(app);
  app.frame = (dt, a) => {
    const t0 = performance.now();
    frame(dt, a);
    work.push(performance.now() - t0);
  };
  const gaps = [];
  let airborne = 0, maxReds = 0;
  await new Promise((done) => {
    let last = performance.now(), start = last, n = 0;
    const tick = (t) => {
      gaps.push(t - last);
      last = t;
      if (n++ % 20 === 0) shatterSome();
      airborne = Math.max(airborne, s.fx.shards.filter((x) => !x.rest).length);
      maxReds = Math.max(maxReds, w.reds.filter((r) => !r.dead).length);
      if (t - start < 6000) requestAnimationFrame(tick);
      else done();
    };
    requestAnimationFrame(tick);
  });
  app.frame = frame;
  gaps.shift();
  const sorted = (a) => a.slice().sort((x, y) => x - y);
  const pct = (a, p) => sorted(a)[Math.floor(a.length * p)];
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  return {
    fps: 1000 / mean(gaps), gapP95: pct(gaps, 0.95), workMean: mean(work), workP95: pct(work, 0.95), workMax: Math.max(...work),
    frames: gaps.length, maxReds, airborne, shards: s.fx.shards.length,
  };
});

console.log(`frames ${result.frames}: ${result.fps.toFixed(1)} fps (95% of gaps under ${result.gapP95.toFixed(1)} ms)`);
console.log(`app work per frame: mean ${result.workMean.toFixed(2)} ms, 95% under ${result.workP95.toFixed(2)} ms, worst ${result.workMax.toFixed(1)} ms`);
console.log(`load: up to ${result.maxReds} reds at once, ${result.airborne} shards in the air, ${result.shards} shards in all`);
const ok = result.fps >= 57 && result.workP95 < 8 && result.maxReds >= 40 && result.airborne >= 300;
console.log(ok ? 'PASS: 60 fps budget held' : 'FAIL: over budget');
if (errors.length) console.log('errors:', errors);
await browser.close();
process.exit(ok && !errors.length ? 0 : 1);
