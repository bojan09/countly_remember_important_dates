// Performance probe: node tools/perf.mjs [--events=500] [--throttle=4] [--json]
// Cold-loads the app, seeds a large data set through the real import path, then times every
// route and a few interactions. Numbers are for comparing before/after, not absolute truth:
// headless Chromium on a CI box, optionally CPU-throttled to mimic a mid-range phone.
import { launch, openPage, VIEWPORTS } from './browser.mjs';
import { addDays, todayISO } from '../src/date/calendar.js';

const arg = (name, dflt) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : dflt;
};
const N = Number(arg('events', 500));
const THROTTLE = Number(arg('throttle', 4));
const asJson = process.argv.includes('--json');

export function syntheticBackup(n, today = todayISO()) {
  const cats = ['celebration', 'travel', 'work', 'health', 'personal', 'other'];
  const events = [];
  for (let i = 0; i < n; i++) {
    const offset = ((i * 37) % 900) - 450; // spread over ~2.5 years around today
    const recurring = i % 5 === 0;
    events.push({
      id: `ev-perf-${i}`,
      title: `Perf event ${i}`,
      date: addDays(today, offset),
      time: i % 3 === 0 ? '09:30' : null,
      category: cats[i % cats.length],
      notes: i % 4 === 0 ? 'x'.repeat(200) : '',
      recurrence: recurring ? { freq: ['weekly', 'monthly', 'yearly'][i % 3], interval: 1, until: null } : { freq: 'none', interval: 1, until: null },
      createdAt: Date.now() - i * 1000,
      updatedAt: Date.now() - i * 1000,
    });
  }
  return JSON.stringify({ format: 'countly-backup', version: 1, exportedAt: new Date().toISOString(), events, photos: [], categories: [] });
}

async function main() {
  const ctx = await launch();
  if (!ctx) throw new Error('no browser (set CHROME_PATH)');
  const out = { events: N, throttle: THROTTLE, cold: {}, routes: {}, interactions: {} };

  // ---- cold start on an empty profile (samples on, like a first visit)
  const page = await ctx.newPage();
  await page.setViewport(VIEWPORTS['mobile-390']);
  const client = await page.createCDPSession();
  await client.send('Network.enable');
  await client.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  let bytes = 0;
  let requests = 0;
  client.on('Network.loadingFinished', (e) => (bytes += e.encodedDataLength));
  client.on('Network.requestWillBeSent', () => requests++);
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('countly.prefs.v1', JSON.stringify({ onboarded: true }));
    window.__cls = 0;
    window.__long = [];
    new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (!e.hadRecentInput) window.__cls += e.value; })).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push(Math.round(e.duration)))).observe({ type: 'longtask', buffered: true });
  });
  const t0 = Date.now();
  await page.goto(`${ctx.base}/`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.view .ecard, .view .hero, .view .empty');
  const nav = await page.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0];
    const fcp = performance.getEntriesByName('first-contentful-paint')[0];
    return { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), fcp: fcp ? Math.round(fcp.startTime) : null, cls: Number(window.__cls.toFixed(4)), longTasks: window.__long.length, longestTask: Math.max(0, ...window.__long), nodes: document.getElementsByTagName('*').length };
  });
  out.cold = { ...nav, wallMs: Date.now() - t0, requests, kb: Math.round(bytes / 1024) };

  // ---- big data set through the real import path
  const text = syntheticBackup(N);
  await page.evaluate(async (text) => {
    const b = await import('/src/store/backup.js');
    const s = await import('/src/store/events.js');
    await s.importBackup(b.parseBackup(text), 'merge');
  }, text);

  const timeRoute = async (hash, ready) => {
    const ms = await page.evaluate(async (hash, ready) => {
      const start = performance.now();
      location.hash = hash;
      await new Promise((resolve) => {
        const tick = () => (document.querySelector(ready) ? resolve() : requestAnimationFrame(tick));
        // wait for the previous view to be replaced, then for the target marker
        setTimeout(tick, 0);
      });
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return Math.round(performance.now() - start);
    }, hash, ready);
    return ms;
  };
  const routes = [['#/', '.view.home'], ['#/timeline', '.view.timeline'], ['#/calendar', '.view.calendar'], ['#/stats', '.view.stats'], ['#/memories', '.view.memories'], ['#/categories', '.view.categories'], ['#/settings', '.view.settings']];
  for (const [hash, sel] of routes) {
    await page.evaluate(() => (location.hash = '#/settings')); // reset so each route is a real navigation
    await new Promise((r) => setTimeout(r, 150));
    out.routes[hash] = await timeRoute(hash, sel);
  }

  // ---- interactions
  await page.evaluate(() => (location.hash = '#/timeline'));
  await page.waitForSelector('.tl-search input');
  out.interactions.timelineSearchKeystroke = await page.evaluate(async () => {
    const input = document.querySelector('.tl-search input');
    const times = [];
    for (const ch of 'perf event 12') {
      const t = performance.now();
      input.value += ch;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      times.push(performance.now() - t);
    }
    return Math.round(Math.max(...times));
  });
  await page.evaluate(() => (location.hash = '#/calendar'));
  await page.waitForSelector('.view.calendar');
  out.interactions.calendarNextMonth = await page.evaluate(async () => {
    const btn = [...document.querySelectorAll('button')].find((b) => /next/i.test(b.getAttribute('aria-label') || ''));
    if (!btn) return null;
    const times = [];
    for (let i = 0; i < 6; i++) {
      const t = performance.now();
      btn.click();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      times.push(performance.now() - t);
    }
    return Math.round(Math.max(...times));
  });
  const heap = await client.send('Runtime.getHeapUsage').catch(() => null);
  out.heapMb = heap ? Math.round(heap.usedSize / 1048576) : null;
  await ctx.close();

  if (asJson) console.log(JSON.stringify(out, null, 2));
  else {
    console.log(`events=${N} cpu-throttle=${THROTTLE}x`);
    console.log('cold start', out.cold);
    console.log('route render ms', out.routes);
    console.log('interactions ms (worst)', out.interactions, 'heap MB', out.heapMb);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e); process.exit(1); });
