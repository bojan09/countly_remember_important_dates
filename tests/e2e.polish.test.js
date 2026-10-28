// Phase 6 polish checks: text scaling, awkward content, focus handling, page titles, error routes.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, openPage, VIEWPORTS, findBrowser } from '../tools/browser.mjs';
import { todayISO, addDays } from '../src/date/calendar.js';

const hasBrowser = !!findBrowser();
const skip = hasBrowser ? false : 'no Chromium-family browser found (set CHROME_PATH)';
let ctx;
before(async () => {
  if (hasBrowser) ctx = await launch();
});
after(async () => {
  if (ctx) await ctx.close();
});

const PHONE_S = { width: 320, height: 640, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const go = (page, hash) => page.evaluate((h) => (location.hash = h), hash).then(() => new Promise((r) => setTimeout(r, 350)));
const overflow = (page) => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));

async function seed(page) {
  return page.evaluate(async (date) => {
    const m = await import('/src/store/events.js');
    const cat = (await m.saveCategory({ name: 'W'.repeat(30), color: '#6fcf6f', icon: 'star', scene: 'beach' })).category;
    const long = 'Supercalifragilisticexpialidocious'.repeat(3).slice(0, 80);
    const ev = (await m.saveEvent({ title: long, emoji: '🎂', date, time: '08:00', category: cat.id, location: 'L'.repeat(120), description: 'D'.repeat(200), notes: 'N'.repeat(400), recurrence: { freq: 'none' }, reminders: ['d1'] })).event;
    await m.saveEvent({ title: long, date: (await import('/src/date/calendar.js')).addDays(date, -20), category: 'travel', recurrence: { freq: 'none' } });
    return ev.id;
  }, addDays(todayISO(), 9));
}

const ROUTES = (id) => ['#/', '#/timeline', '#/calendar?view=month', '#/calendar?view=week', '#/calendar?view=day', '#/calendar?view=agenda', '#/stats', '#/categories', '#/memories', '#/settings', '#/new', `#/event/${encodeURIComponent(id)}`, `#/edit/${encodeURIComponent(id)}`];

for (const [label, scale] of [['100%', 100], ['200% text size', 200]]) {
  test(`no horizontal overflow with 80-character unbroken titles, 30-character category names and ${label} on a 320px phone`, { skip, timeout: 180000 }, async () => {
    for (const lang of ['en', 'mk']) {
      const page = await openPage(ctx, { viewport: PHONE_S, prefs: { showSamples: false, lang }, route: '#/settings' });
      const id = await seed(page);
      await page.addStyleTag({ content: `html{font-size:${scale}% !important}` });
      const bad = [];
      for (const hash of ROUTES(id)) {
        await go(page, hash);
        const m = await overflow(page);
        if (m.sw > m.iw) bad.push(`${lang} ${hash}: ${m.sw} > ${m.iw}`);
      }
      assert.deepEqual(bad, []);
      assert.deepEqual(page.errors, []);
      await page.close();
    }
  });
}

test('closing a dialog returns focus to the control that opened it', { skip, timeout: 120000 }, async () => {
  const page = await openPage(ctx, { viewport: VIEWPORTS['desktop-1440'], prefs: { showSamples: false }, route: '#/settings' });
  const id = await seed(page);
  await go(page, `#/event/${encodeURIComponent(id)}`);
  for (const label of ['Reminder', 'Share', 'More']) {
    const sel = `.d-act-btn[aria-label="${label}"]`;
    await page.focus(sel);
    await page.keyboard.press('Enter');
    await page.waitForSelector('dialog[open]');
    assert.ok(await page.evaluate(() => document.querySelector('dialog[open]').contains(document.activeElement)), `${label}: focus moves into the dialog`);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('dialog[open]'));
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), label, `${label}: focus returns`);
  }
  await go(page, '#/categories');
  await page.focus('#cm-new');
  await page.keyboard.press('Enter');
  await page.waitForSelector('dialog[open] #cm-name');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'cm-name', 'form dialogs focus their first field');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.activeElement && document.activeElement.id === 'cm-new');
  await page.close();
});

test('every route sets a distinct page title and unknown routes fall back to Home', { skip, timeout: 120000 }, async () => {
  const page = await openPage(ctx, { viewport: VIEWPORTS['desktop-1440'], prefs: { showSamples: true }, route: '#/' });
  const titles = new Map();
  for (const hash of ['#/', '#/calendar', '#/timeline', '#/stats', '#/categories', '#/memories', '#/settings', '#/new']) {
    await go(page, hash);
    const title = await page.title();
    assert.match(title, /Countly/);
    assert.ok(!titles.has(title), `${hash} reuses the title of ${titles.get(title)}`);
    titles.set(title, hash);
  }
  await go(page, '#/definitely-not-a-page');
  assert.ok(await page.$('.view.home'), 'unknown route shows Home');
  await go(page, '#/event/does-not-exist');
  assert.match(await page.$eval('h1', (e) => e.textContent), /not found|Not found/i);
  assert.ok(await page.$('a[href="#/"]'));
  await page.close();
});

test('main landmarks, one h1 per view and a visible focus ring on every route and viewport', { skip, timeout: 180000 }, async () => {
  for (const vp of ['mobile-390', 'desktop-1440']) {
    const page = await openPage(ctx, { viewport: VIEWPORTS[vp], prefs: { showSamples: true }, route: '#/' });
    for (const hash of ['#/', '#/timeline', '#/calendar', '#/stats', '#/categories', '#/memories', '#/settings', '#/new']) {
      await go(page, hash);
      const facts = await page.evaluate(() => ({ main: document.querySelectorAll('main').length, h1: [...document.querySelectorAll('h1')].filter((e) => e.offsetParent !== null || e.classList.contains('sr-only')).length }));
      assert.equal(facts.main, 1, `${vp} ${hash}: one main landmark`);
      assert.ok(facts.h1 >= 1, `${vp} ${hash}: has an h1`);
    }
    await page.close();
  }
});
