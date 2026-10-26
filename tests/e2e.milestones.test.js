// Phase 4.4 browser tests: milestones on the event page, Home hero and the create form switch.
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

const seed = (page, event) =>
  page.evaluate(async (event) => (await (await import('/src/store/events.js')).saveEvent({ category: 'travel', recurrence: { freq: 'none' }, ...event })).event.id, event);
const openEvent = async (page, id) => {
  await page.evaluate((id) => (location.hash = `#/event/${encodeURIComponent(id)}`), id);
  await page.waitForSelector('.d-title');
};
const rows = (page) => page.$$eval('.ml', (els) => els.map((e) => ({ cls: e.className, text: e.querySelector('b').textContent, when: e.querySelector('.ml-when').textContent })));

test('upcoming event: only markers that still apply, the next one highlighted, and Home shows it', { skip, timeout: 90000 }, async () => {
  const page = await openPage(ctx, { viewport: VIEWPORTS['desktop-1440'], prefs: { showSamples: false }, route: '#/settings' });
  const id = await seed(page, { title: 'Hike', date: addDays(todayISO(), 40), pinned: true }); // created now, 40 days out
  await openEvent(page, id);
  const list = await rows(page);
  assert.deepEqual(list.map((r) => r.text), ['30 days to go', '1 week to go', 'Tomorrow']);
  assert.match(list[0].cls, /next/);
  assert.equal(list[0].when, 'in 10 days');
  assert.equal((await page.$$('.ml.next')).length, 1);

  await page.evaluate(() => (location.hash = '#/'));
  await page.waitForSelector('.hero-mile');
  assert.match(await page.$eval('.hero-mile', (e) => e.textContent), /Next milestone: 30 days to go · in 10 days/);
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('switching milestones off hides them on the event page and on Home; the form keeps the choice', { skip, timeout: 90000 }, async () => {
  const page = await openPage(ctx, { viewport: VIEWPORTS['desktop-1440'], prefs: { showSamples: false }, route: '#/settings' });
  const id = await seed(page, { title: 'Quiet', date: addDays(todayISO(), 40), pinned: true, milestones: false });
  await openEvent(page, id);
  assert.equal(await page.$('.d-miles'), null);
  await page.evaluate(() => (location.hash = '#/'));
  await page.waitForSelector('.hero');
  assert.equal(await page.$('.hero-mile'), null);

  await page.evaluate((id) => (location.hash = `#/edit/${encodeURIComponent(id)}`), id);
  await page.waitForSelector('#f-milestones');
  assert.equal(await page.$eval('#f-milestones', (b) => b.getAttribute('aria-checked')), 'false');
  await page.click('#f-milestones');
  await Promise.all([page.waitForSelector('.d-title'), page.click('form button[type=submit]')]);
  assert.ok(await page.$('.d-miles'), 'turning it back on shows them again');
  await page.close();
});

test('past event: recent "since" markers are marked done and the next one is upcoming', { skip, timeout: 90000 }, async () => {
  const page = await openPage(ctx, { viewport: VIEWPORTS['desktop-1440'], prefs: { showSamples: false }, route: '#/settings' });
  const id = await seed(page, { title: 'Wedding', date: addDays(todayISO(), -40) });
  await openEvent(page, id);
  const list = await rows(page);
  assert.deepEqual(list.map((r) => r.text), ['1 week since', '30 days since', '100 days since', '1 year since']);
  assert.deepEqual(list.map((r) => r.when), ['Done', 'Done', 'in 60 days', list[3].when]);
  assert.match(list[3].when, /^in \d+ days$/); // 325 or 326 depending on a leap day in between
  assert.match(list[2].cls, /next/);
  await page.close();
});

test('milestones read well in Macedonian on a phone without overflow', { skip, timeout: 90000 }, async () => {
  const page = await openPage(ctx, { viewport: VIEWPORTS['mobile-360'], prefs: { showSamples: false, lang: 'mk' }, route: '#/settings' });
  const id = await seed(page, { title: 'Одмор', date: addDays(todayISO(), 40) });
  await openEvent(page, id);
  assert.deepEqual((await rows(page)).map((r) => r.text), ['Уште 30 дена', 'Уште 1 недела', 'Утре']);
  assert.match((await rows(page))[0].when, /^за 10 дена$/);
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
  assert.ok(m.sw <= m.iw, JSON.stringify(m));
  assert.deepEqual(page.errors, []);
  await page.close();
});
