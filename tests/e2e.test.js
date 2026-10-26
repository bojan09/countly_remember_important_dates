// Browser end-to-end checks (headless Edge/Chrome via puppeteer-core). Skipped when no browser is installed.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, openPage, VIEWPORTS, findBrowser } from '../tools/browser.mjs';

const hasBrowser = !!findBrowser();
const skip = hasBrowser ? false : 'no Chromium-family browser found (set CHROME_PATH)';
let ctx;

before(async () => {
  if (hasBrowser) ctx = await launch();
});
after(async () => {
  if (ctx) await ctx.close();
});

const ROUTES = ['#/', '#/calendar', '#/timeline', '#/stats', '#/categories', '#/memories', '#/settings', '#/new', '#/event/sample-birthday', '#/event/sample-vacation', '#/event/does-not-exist'];

test('every route renders at every viewport with no console errors and no horizontal overflow', { skip, timeout: 240000 }, async () => {
  for (const [vk, viewport] of Object.entries(VIEWPORTS)) {
    for (const route of ROUTES) {
      const page = await openPage(ctx, { viewport, route });
      const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, bodySw: document.body.scrollWidth }));
      assert.ok(m.sw <= m.iw && m.bodySw <= m.iw, `${vk} ${route}: horizontal overflow ${JSON.stringify(m)}`);
      assert.deepEqual(page.errors, [], `${vk} ${route}: console errors`);
      await page.close();
    }
  }
});

test('Macedonian UI also fits without overflow or errors on every viewport', { skip, timeout: 240000 }, async () => {
  for (const [vk, viewport] of Object.entries(VIEWPORTS)) {
    for (const route of ['#/', '#/calendar', '#/timeline', '#/stats', '#/settings', '#/event/sample-birthday']) {
      const page = await openPage(ctx, { viewport, route, prefs: { lang: 'mk' } });
      const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, lang: document.documentElement.lang }));
      assert.equal(m.lang, 'mk');
      assert.ok(m.sw <= m.iw, `${vk} mk ${route}: overflow ${JSON.stringify(m)}`);
      assert.deepEqual(page.errors, [], `${vk} mk ${route}`);
      await page.close();
    }
  }
});

test('language toggle switches the whole UI and persists across reload', { skip }, async () => {
  const page = await openPage(ctx, { viewport: VIEWPORTS['desktop-1440'] });
  assert.equal(await page.$eval('.nav-link[data-route="calendar"] .lbl', (e) => e.textContent), 'Calendar');
  await page.click('.lang-btn[lang="mk"]');
  await page.waitForFunction(() => document.documentElement.lang === 'mk');
  assert.equal(await page.$eval('.nav-link[data-route="calendar"] .lbl', (e) => e.textContent), 'Календар');
  assert.match(await page.$eval('.hero-days', (e) => e.textContent), /дена/);
  assert.match(await page.$eval('h1', (e) => e.textContent), /[Ѐ-ӿ]/);
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('.view');
  assert.equal(await page.evaluate(() => document.documentElement.lang), 'mk');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('countly.prefs.v1')).lang), 'mk');
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('Macedonian dates, weekdays and plurals render in Cyrillic inside the real browser', { skip }, async () => {
  const page = await openPage(ctx, { viewport: VIEWPORTS['desktop-1440'], prefs: { lang: 'mk' } });
  const cyr = /[Ѐ-ӿ]/;
  assert.match(await page.$eval('.mc-head h2', (e) => e.textContent), cyr);
  const dows = await page.$$eval('.cal-dow', (e) => e.map((x) => x.textContent));
  assert.ok(dows.length === 7 && dows.every((d) => cyr.test(d)), `weekdays: ${dows}`);
  assert.match(await page.$eval('.hero-date', (e) => e.textContent), cyr);
  assert.match(await page.$eval('.ecard-date', (e) => e.textContent), cyr);
  assert.match(await page.$eval('.cal-day', (e) => e.getAttribute('aria-label')), cyr);
  await page.close();
});

test('theme toggle applies and persists (dark -> light)', { skip }, async () => {
  const page = await openPage(ctx, { viewport: VIEWPORTS['desktop-1440'], prefs: { theme: 'dark' } });
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
  await page.click('[data-theme-btn="light"]');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert.notEqual(bg, 'rgb(10, 14, 36)');
  await page.reload({ waitUntil: 'networkidle0' });
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light');
  await page.close();
});

test('auto theme follows prefers-color-scheme', { skip }, async () => {
  const page = await openPage(ctx, { viewport: VIEWPORTS['desktop-1440'], prefs: { theme: 'auto' }, colorScheme: 'light' });
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light');
  await page.close();
});

test('accent color changes the design token', { skip }, async () => {
  const page = await openPage(ctx, { viewport: VIEWPORTS['desktop-1440'], route: '#/settings' });
  await page.click('.accent-dot[aria-label="Pink"]');
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()), '#ff5fa2');
  await page.close();
});

test('mobile navigation: bottom nav, FAB, More sheet and route changes work', { skip }, async () => {
  const page = await openPage(ctx, { viewport: VIEWPORTS['mobile-390'] });
  assert.ok(await page.$eval('.bottom-nav', (e) => getComputedStyle(e).display !== 'none'));
  assert.ok(await page.$eval('.sidebar', (e) => getComputedStyle(e).display === 'none'));
  await page.click('.bottom-nav a[data-route="calendar"]');
  await page.waitForSelector('.view.calendar');
  await page.click('.bottom-nav button[data-route="more"]');
  await page.waitForSelector('dialog.modal[open]');
  await page.click('dialog .more-row[href="#/settings"]');
  await page.waitForSelector('.view.settings');
  assert.equal(await page.evaluate(() => document.querySelector('dialog[open]')), null);
  await page.click('.fab');
  await page.waitForSelector('.view.create');
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('upcoming / this month / past tabs on mobile show truthful counts and lists', { skip }, async () => {
  const page = await openPage(ctx, { viewport: VIEWPORTS['mobile-390'] });
  const counts = await page.$$eval('.m-home .seg-btn .seg-count', (els) => els.map((e) => e.textContent));
  assert.deepEqual(counts.slice(0, 1), ['8']);
  assert.equal(counts[2], '12');
  assert.equal(await page.$$eval('.m-home .ecard', (e) => e.length), 8);
  await page.click('.m-home .seg-btn[data-id="past"]');
  assert.equal(await page.$$eval('.m-home .ecard', (e) => e.length), 12);
  assert.match(await page.$eval('.m-home .ecard .ecard-days', (e) => e.textContent), /ago/);
  await page.close();
});

test('opening a card shows the real event detail with computed progress and sample badge', { skip }, async () => {
  const page = await openPage(ctx, { viewport: VIEWPORTS['mobile-390'] });
  await page.click('.m-home .ecard[href="#/event/sample-vacation"]');
  await page.waitForSelector('.view.detail .d-title');
  assert.match(await page.$eval('.d-days', (e) => e.textContent), /^42 days$/);
  assert.equal(await page.$eval('.d-meter', (e) => e.getAttribute('aria-valuenow')), '65');
  assert.ok(await page.$('.badge-sample'));
  await page.click('.d-top .icon-btn');
  await page.waitForSelector('.view.home');
  await page.close();
});

test('hiding samples shows the empty state, and showing them restores events', { skip }, async () => {
  const page = await openPage(ctx, { viewport: VIEWPORTS['desktop-1440'], prefs: { showSamples: false } });
  assert.ok(await page.$('.empty'));
  assert.equal(await page.$('.ecard'), null);
  await page.click('.empty-actions .btn.secondary');
  await page.waitForSelector('.hero');
  assert.ok(await page.$('.banner'));
  await page.close();
});

test('calendar: month navigation, day selection and event dots are consistent', { skip }, async () => {
  const page = await openPage(ctx, { viewport: VIEWPORTS['desktop-1440'], route: '#/calendar' });
  const title1 = await page.$eval('.cal-title', (e) => e.textContent);
  await page.click('.cal-bar .icon-btn:last-child');
  const title2 = await page.$eval('.cal-title', (e) => e.textContent);
  assert.notEqual(title1, title2);
  const dayWithDot = await page.$('.cal-day:not(.out) .dots i');
  if (dayWithDot) {
    await page.evaluate(() => document.querySelector('.cal-day:not(.out) .dots i').closest('.cal-day').click());
    assert.ok(await page.$('.day-list li'), 'selected day with dots lists its events');
  }
  assert.equal(await page.$$eval('.cal-grid .cal-day', (e) => e.length), 42);
  await page.close();
});

test('timeline filter and search work', { skip }, async () => {
  const page = await openPage(ctx, { viewport: VIEWPORTS['desktop-1440'], route: '#/timeline' });
  assert.equal(await page.$$eval('.tl-item', (e) => e.length), 20);
  await page.click('.seg-btn[data-id="upcoming"]');
  assert.equal(await page.$$eval('.tl-item', (e) => e.length), 8);
  await page.type('.tl-search input', 'croatia');
  assert.equal(await page.$$eval('.tl-item', (e) => e.length), 1);
  await page.type('.tl-search input', 'zzzz');
  assert.ok(await page.$('.empty'));
  await page.close();
});

test('stats are computed from the actual events', { skip }, async () => {
  const page = await openPage(ctx, { viewport: VIEWPORTS['desktop-1440'], route: '#/stats' });
  const nums = await page.$$eval('.stat-tile b', (e) => e.map((x) => x.textContent));
  assert.deepEqual(nums, ['20', '8', '12', '5']);
  const legend = await page.$$eval('.legend li b', (e) => e.map((x) => Number(x.textContent)));
  assert.equal(legend.reduce((a, b) => a + b, 0), 20);
  assert.ok(await page.$eval('.bars', (e) => /Jan/.test(e.getAttribute('aria-label'))));
  await page.close();
});

test('keyboard: skip link first, visible focus ring, Enter opens a card, dialog traps and closes on Escape', { skip }, async () => {
  const page = await openPage(ctx, { viewport: VIEWPORTS['desktop-1440'] });
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.className), 'skip-link');
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  assert.notEqual(outline, 'none');
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(() => document.activeElement.classList.contains('ecard'))) break;
  }
  assert.ok(await page.evaluate(() => document.activeElement.classList.contains('ecard')), 'reached a card via Tab');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.view.detail');
  await page.goBack();
  await page.waitForSelector('.view.home');
  await page.click('.top-actions .icon-btn');
  await page.waitForSelector('dialog[open]');
  assert.ok(await page.evaluate(() => document.querySelector('dialog').contains(document.activeElement)), 'focus moved into dialog');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  await page.close();
});

test('landmarks, headings and accessible names', { skip }, async () => {
  const page = await openPage(ctx, { viewport: VIEWPORTS['desktop-1440'] });
  const info = await page.evaluate(() => ({
    main: document.querySelectorAll('main').length,
    navs: [...document.querySelectorAll('nav')].map((n) => n.getAttribute('aria-label')),
    h1: document.querySelectorAll('h1').length,
    unnamedButtons: [...document.querySelectorAll('button, a[href]')].filter((e) => !(e.getAttribute('aria-label') || e.textContent.trim() || e.getAttribute('aria-labelledby')) && e.offsetParent !== null).map((e) => e.outerHTML.slice(0, 80)),
    imgsNoAlt: [...document.querySelectorAll('img:not([alt])')].length,
    lang: document.documentElement.lang,
    title: document.title,
  }));
  assert.equal(info.main, 1);
  assert.ok(info.navs.every(Boolean), 'every nav is labelled');
  assert.ok(info.h1 >= 1);
  assert.deepEqual(info.unnamedButtons, []);
  assert.equal(info.lang, 'en');
  assert.match(info.title, /Countly/);
  await page.close();
});

test('touch targets on mobile are at least 44px', { skip }, async () => {
  const page = await openPage(ctx, { viewport: VIEWPORTS['mobile-390'] });
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('.bn-link, .fab, .m-actions .icon-btn, .seg-btn, .ecard')]
      .filter((e) => e.offsetParent !== null)
      .map((e) => ({ c: e.className, r: e.getBoundingClientRect() }))
      .filter((x) => x.r.width < 44 || x.r.height < 44)
      .map((x) => `${x.c} ${Math.round(x.r.width)}x${Math.round(x.r.height)}`),
  );
  assert.deepEqual(small, []);
  await page.close();
});

test('reduced motion: system preference and in-app switch both stop animations', { skip }, async () => {
  const sys = await openPage(ctx, { viewport: VIEWPORTS['desktop-1440'] });
  await sys.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const d1 = await sys.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.sc-float')).animationDuration));
  assert.ok(d1 < 0.01, `system reduced motion ignored (${d1}s)`);
  await sys.close();
  const app = await openPage(ctx, { viewport: VIEWPORTS['desktop-1440'], prefs: { reduceMotion: true } });
  assert.equal(await app.evaluate(() => document.documentElement.dataset.motion), 'reduced');
  const d2 = await app.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.sc-float')).animationDuration));
  assert.ok(d2 < 0.01, `in-app reduced motion ignored (${d2}s)`);
  await app.close();
});

test('scene animation is paused when scrolled offscreen', { skip }, async () => {
  const page = await openPage(ctx, { viewport: VIEWPORTS['mobile-390'] });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await new Promise((r) => setTimeout(r, 400));
  const paused = await page.$$eval('.scene-art', (els) => els.filter((e) => e.classList.contains('scene-paused')).length);
  assert.ok(paused > 0, 'offscreen scenes get paused');
  await page.close();
});

test('PWA: service worker installs, shell is precached and the app reloads fully offline', { skip, timeout: 60000 }, async () => {
  const page = await openPage(ctx, { viewport: VIEWPORTS['desktop-1440'] });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, { timeout: 15000 }).catch(async () => {
    await page.reload({ waitUntil: 'networkidle0' });
  });
  const cached = await page.evaluate(async () => {
    const keys = await caches.keys();
    const cache = await caches.open(keys.find((k) => k.startsWith('countly-')));
    return (await cache.keys()).length;
  });
  assert.ok(cached > 40, `precached ${cached} files`);
  await page.setOfflineMode(true);
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('.view .hero', { timeout: 8000 });
  assert.match(await page.title(), /Home|Countly/);
  await page.evaluate(() => (location.hash = '#/stats'));
  await page.waitForSelector('.view.stats');
  await page.setOfflineMode(false);
  await page.close();
});

test('preferences survive reload together with route state', { skip }, async () => {
  const page = await openPage(ctx, { viewport: VIEWPORTS['desktop-1440'], route: '#/settings' });
  await page.type('#set-name', 'Ana');
  await page.$eval('#set-name', (e) => e.dispatchEvent(new Event('change', { bubbles: true })));
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('.view.settings');
  assert.equal(await page.$eval('#set-name', (e) => e.value), 'Ana');
  await page.evaluate(() => (location.hash = '#/'));
  await page.waitForSelector('.view.home');
  assert.match(await page.$eval('.topbar h1', (e) => e.textContent), /Ana/);
  await page.close();
});

test('first-run onboarding appears once and can be completed', { skip }, async () => {
  const page = await ctx.newPage();
  await page.setViewport(VIEWPORTS['desktop-1440']);
  await page.goto(ctx.base + '/', { waitUntil: 'networkidle0' });
  await page.waitForSelector('dialog.onboarding[open]');
  await page.click('dialog .ob-chip[lang="mk"]');
  await page.waitForFunction(() => document.documentElement.lang === 'mk' && document.querySelector('dialog.onboarding[open]'));
  await page.click('dialog .modal-foot .btn');
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('countly.prefs.v1')).onboarded), true);
  await page.reload({ waitUntil: 'networkidle0' });
  assert.equal(await page.$('dialog[open]'), null, 'no onboarding on second visit');
  await page.close();
});

// ---- WCAG contrast (text vs. effective solid background; skips text drawn over illustrations) ----
async function contrastFailures(page) {
  return page.evaluate(() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 1;
    const c2 = cv.getContext('2d', { willReadFrequently: true });
    const rgba = (css) => {
      c2.clearRect(0, 0, 1, 1);
      c2.fillStyle = '#000';
      c2.fillStyle = css;
      c2.fillRect(0, 0, 1, 1);
      const d = c2.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2], d[3] / 255];
    };
    const over = (top, bottom) => {
      const a = top[3] + bottom[3] * (1 - top[3]);
      if (a === 0) return [0, 0, 0, 0];
      return [0, 1, 2].map((i) => (top[i] * top[3] + bottom[i] * bottom[3] * (1 - top[3])) / a).concat(a);
    };
    const lum = ([r, g, b]) => {
      const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const stopsOf = (img) => (img.match(/color\(srgb[^)]*\)|rgba?\([^)]*\)/g) || []).map(rgba);
    // Returns every plausible background colour behind `el` (several when a gradient is involved).
    const bgOf = (el) => {
      const layers = [];
      let gradient = null;
      for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
        const cs = getComputedStyle(n);
        const c = rgba(cs.backgroundColor);
        if (!gradient && /gradient/.test(cs.backgroundImage) && n !== document.body && n !== document.documentElement) gradient = { depth: layers.length, stops: stopsOf(cs.backgroundImage) };
        if (c[3] > 0) layers.push(c);
        if (c[3] === 1) break;
      }
      let base = rgba(getComputedStyle(document.documentElement).backgroundColor);
      if (base[3] < 1) base = [255, 255, 255, 1];
      for (const l of [...layers].reverse()) base = over(l, base);
      if (!gradient) return [base];
      return gradient.stops.map((s) => over(s, base));
    };
    const skip = '.scene-art, .ecard, .hero, .d-hero, .toast, [disabled], [aria-disabled="true"], .sr-only, .skip-link, .badge-sample, .seg-btn[disabled]';
    const out = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent.trim()) continue;
      const el = node.parentElement;
      if (!el || seen.has(el) || el.closest(skip) || !el.offsetParent) continue;
      seen.add(el);
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cs = getComputedStyle(el);
      const ratio = Math.min(
        ...bgOf(el).map((bg) => {
          const L1 = lum(over(rgba(cs.color), bg)), L2 = lum(bg);
          return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
        }),
      );
      const size = parseFloat(cs.fontSize);
      const bold = parseInt(cs.fontWeight, 10) >= 700;
      const large = size >= 24 || (size >= 18.66 && bold);
      if (ratio < (large ? 3 : 4.5)) out.push(`${(el.className || el.tagName).toString().slice(0, 30)} "${node.textContent.trim().slice(0, 24)}" ${ratio.toFixed(2)}`);
    }
    return out;
  });
}

test('text contrast meets WCAG AA in both themes on core screens', { skip, timeout: 240000 }, async () => {
  const problems = [];
  for (const theme of ['dark', 'light']) {
    for (const [vk, viewport] of [['mobile-390', VIEWPORTS['mobile-390']], ['desktop-1440', VIEWPORTS['desktop-1440']]]) {
      for (const route of ['#/', '#/calendar', '#/timeline', '#/stats', '#/categories', '#/memories', '#/settings', '#/event/sample-birthday']) {
        const page = await openPage(ctx, { viewport, route, prefs: { theme }, colorScheme: theme });
        for (const f of await contrastFailures(page)) problems.push(`${theme} ${vk} ${route}: ${f}`);
        await page.close();
      }
    }
  }
  assert.deepEqual(problems, []);
});

test('every accent color keeps primary buttons and active controls readable (AA)', { skip, timeout: 240000 }, async () => {
  const problems = [];
  for (const accent of ['violet', 'teal', 'orange', 'peach', 'pink', 'blue', 'indigo']) {
    for (const theme of ['dark', 'light']) {
      for (const route of ['#/', '#/calendar', '#/stats']) {
        const page = await openPage(ctx, { viewport: VIEWPORTS['desktop-1440'], route, prefs: { theme, accent }, colorScheme: theme });
        for (const f of await contrastFailures(page)) problems.push(`${accent} ${theme} ${route}: ${f}`);
        await page.close();
      }
    }
  }
  assert.deepEqual(problems, []);
});
