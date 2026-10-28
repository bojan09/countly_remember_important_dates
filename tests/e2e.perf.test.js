// Performance regression guards. Budgets are generous (CI machines vary); they exist to catch
// order-of-magnitude regressions such as rendering every event at once (9 s at 500 events before
// the chunked lists). Run `node tools/perf.mjs` for the detailed numbers.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, VIEWPORTS, findBrowser } from '../tools/browser.mjs';
import { syntheticBackup } from '../tools/perf.mjs';
import { memoryAdapter } from '../src/store/db.js';
import { parseBackup } from '../src/store/backup.js';

const hasBrowser = !!findBrowser();
const skip = hasBrowser ? false : 'no Chromium-family browser found (set CHROME_PATH)';
let ctx;
before(async () => {
  if (hasBrowser) ctx = await launch();
});
after(async () => {
  if (ctx) await ctx.close();
});

test('store: deriving 5000 events is fast, and repeated reads are served from the cache', async () => {
  const s = await import(`../src/store/events.js?${Math.random()}`);
  await s.initStore({ adapter: memoryAdapter(), broadcast: false });
  await s.importBackup(parseBackup(syntheticBackup(5000, '2026-10-26')), 'merge');
  const today = '2026-10-26';
  let t = performance.now();
  const first = s.getEvents(today);
  const cold = performance.now() - t;
  t = performance.now();
  for (let i = 0; i < 50; i++) s.getEvents(today);
  const warm = (performance.now() - t) / 50;
  assert.ok(first.length > 5000);
  assert.ok(cold < 1500, `first derivation took ${cold.toFixed(0)} ms`);
  assert.ok(warm < 5, `cached read took ${warm.toFixed(2)} ms`);
});

async function newPhone() {
  const page = await ctx.newPage();
  await page.setViewport(VIEWPORTS['mobile-390']);
  const client = await page.createCDPSession();
  await client.send('Network.enable');
  await client.send('Emulation.setCPUThrottlingRate', { rate: 3 });
  const net = { bytes: 0, requests: 0 };
  client.on('Network.loadingFinished', (e) => (net.bytes += e.encodedDataLength));
  client.on('Network.requestWillBeSent', () => net.requests++);
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('countly.prefs.v1', JSON.stringify({ onboarded: true }));
    window.__cls = 0;
    new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (!e.hadRecentInput) window.__cls += e.value; })).observe({ type: 'layout-shift', buffered: true });
  });
  return { page, net };
}

test('cold start: small, quick and stable', { skip, timeout: 120000 }, async () => {
  const { page, net } = await newPhone();
  await page.goto(`${ctx.base}/`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.view .ecard, .view .hero, .view .empty');
  const m = await page.evaluate(() => ({ fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0, cls: window.__cls, nodes: document.getElementsByTagName('*').length }));
  assert.ok(m.fcp > 0 && m.fcp < 2500, `FCP ${m.fcp}`);
  assert.ok(m.cls < 0.1, `layout shift ${m.cls}`);
  assert.ok(m.nodes < 4000, `${m.nodes} DOM nodes on the first screen`);
  assert.ok(net.bytes < 700 * 1024, `${Math.round(net.bytes / 1024)} KB transferred`);
  assert.ok(net.requests < 90, `${net.requests} requests`);
  await page.close();
});

test('with 400 events every main view still renders quickly and lists are built a chunk at a time', { skip, timeout: 180000 }, async () => {
  const { page } = await newPhone();
  await page.goto(`${ctx.base}/#/settings`, { waitUntil: 'networkidle0' });
  await page.evaluate(async (text) => {
    const b = await import('/src/store/backup.js');
    const s = await import('/src/store/events.js');
    await s.importBackup(b.parseBackup(text), 'merge');
  }, syntheticBackup(400));
  const time = (hash, ready) =>
    page.evaluate(async (hash, ready) => {
      location.hash = '#/settings';
      await new Promise((r) => setTimeout(r, 120));
      const start = performance.now();
      location.hash = hash;
      await new Promise((resolve) => { const tick = () => (document.querySelector(ready) ? resolve() : requestAnimationFrame(tick)); setTimeout(tick, 0); });
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return performance.now() - start;
    }, hash, ready);
  for (const [hash, ready] of [['#/', '.view.home .cards .ecard'], ['#/timeline', '.view.timeline .tl-item'], ['#/memories', '.view.memories .mem-card'], ['#/calendar', '.view.calendar'], ['#/stats', '.view.stats']]) {
    const ms = await time(hash, ready);
    assert.ok(ms < 2500, `${hash} took ${Math.round(ms)} ms`);
  }

  await page.evaluate(() => (location.hash = '#/timeline'));
  await page.waitForSelector('.tl-item');
  assert.equal(await page.$$eval('.tl-item', (e) => e.length), 30, 'first chunk only');
  assert.match(await page.$eval('.more-btn', (b) => b.textContent), /^Show more \(\d+ left\)$/);
  await page.click('.more-btn');
  await page.waitForFunction(() => document.querySelectorAll('.tl-item').length === 60);
  assert.ok(await page.evaluate(() => document.activeElement.closest('.tl-item') === document.querySelectorAll('.tl-item')[30]), 'keyboard focus moves to the first new row');
  // typing in search filters without rebuilding on every keystroke
  await page.type('.tl-search input', 'Perf event 39', { delay: 10 });
  await page.waitForFunction(() => document.querySelectorAll('.tl-item').length > 0 && document.querySelectorAll('.tl-item').length < 30);
  assert.equal(await page.$('.more-btn'), null, 'no "show more" when everything fits');
  await page.close();
});
