// Phase 2.1 browser tests: top navigation dropdowns, calendar week/day/agenda, density.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, openPage, VIEWPORTS, findBrowser } from '../tools/browser.mjs';
import { todayISO } from '../src/date/calendar.js';

const hasBrowser = !!findBrowser();
const skip = hasBrowser ? false : 'no Chromium-family browser found (set CHROME_PATH)';
let ctx;
before(async () => {
  if (hasBrowser) ctx = await launch();
});
after(async () => {
  if (ctx) await ctx.close();
});

const TODAY = todayISO();

async function setValue(page, sel, value) {
  await page.$eval(sel, (el, v) => {
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

test('top navigation replaces the sidebar on desktop and tablet; mobile keeps the bottom bar', { skip }, async () => {
  for (const vk of ['desktop-1440', 'desktop-1280', 'tablet-768']) {
    const page = await openPage(ctx, { viewport: VIEWPORTS[vk] });
    assert.equal(await page.$('.sidebar'), null, vk);
    const bar = await page.$eval('.topnav', (e) => ({ pos: getComputedStyle(e).position, h: e.getBoundingClientRect().height, shown: getComputedStyle(e).display !== 'none' }));
    assert.ok(bar.shown && bar.pos === 'sticky' && bar.h <= 64, `${vk} ${JSON.stringify(bar)}`);
    assert.ok(await page.$eval('.bottom-nav', (e) => getComputedStyle(e).display === 'none'), vk);
    const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
    assert.ok(m.sw <= m.iw, `${vk} overflow`);
    await page.close();
  }
  const phone = await openPage(ctx, { viewport: VIEWPORTS['mobile-390'] });
  assert.ok(await phone.$eval('.topnav', (e) => getComputedStyle(e).display === 'none'));
  assert.ok(await phone.$eval('.bottom-nav', (e) => getComputedStyle(e).display !== 'none'));
  await phone.close();
});

test('dropdowns: open, navigate with the keyboard, Escape restores focus, outside click closes', { skip }, async () => {
  const page = await openPage(ctx, { viewport: VIEWPORTS['desktop-1440'] });
  const caret = '.tn-item:has(.tn-link[data-nav="calendar"]) .tn-caret';
  assert.equal(await page.$eval(caret, (e) => e.getAttribute('aria-expanded')), 'false');
  await page.click(caret);
  assert.equal(await page.$eval(caret, (e) => e.getAttribute('aria-expanded')), 'true');
  const labels = await page.$$eval('.tn-item:has(.tn-link[data-nav="calendar"]) .dd [role=menuitem]', (els) => els.map((e) => e.textContent.trim()));
  assert.deepEqual(labels, ['Month', 'Week', 'Day', 'Agenda']);
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute('role')), 'menuitem');
  await page.keyboard.press('Escape');
  assert.equal(await page.$eval(caret, (e) => e.getAttribute('aria-expanded')), 'false');
  assert.equal(await page.evaluate(() => document.activeElement.classList.contains('tn-caret')), true, 'focus returns to the trigger');
  // keyboard open from the trigger
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), 'Month');
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), 'Week');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.view.calendar');
  await page.waitForFunction(() => location.hash.includes('view=week'));
  assert.equal(await page.$eval(caret, (e) => e.getAttribute('aria-expanded')), 'false', 'menu closes after choosing');
  // only one menu open at a time + outside click
  await page.click(caret);
  await page.click('.tn-pref');
  assert.equal(await page.$$eval('.dd:not([hidden])', (e) => e.length), 1);
  await page.mouse.click(700, 600);
  assert.equal(await page.$$eval('.dd:not([hidden])', (e) => e.length), 0);
  await page.close();
});

test('menus lead to the right pages and mark the active section', { skip }, async () => {
  const page = await openPage(ctx, { viewport: VIEWPORTS['desktop-1440'] });
  await page.click('.tn-link[data-nav="explore"]');
  await page.evaluate(() => [...document.querySelectorAll('.dd [role=menuitem]')].find((a) => /Stats/.test(a.textContent)).click());
  await page.waitForSelector('.view.stats');
  assert.equal(await page.$eval('.tn-link[data-nav="explore"]', (e) => e.getAttribute('aria-current')), 'page');
  assert.equal(await page.$eval('.tn-link[data-nav="home"]', (e) => e.getAttribute('aria-current')), null);
  await page.click('.tn-item:has(.tn-link[data-nav="timeline"]) .tn-caret');
  await page.evaluate(() => [...document.querySelectorAll('.dd [role=menuitem]')].find((a) => a.textContent.trim() === 'Past').click());
  await page.waitForSelector('.view.timeline');
  assert.equal(await page.$eval('.seg-btn[aria-selected="true"]', (e) => e.dataset.id), 'past');
  // search box
  await page.type('.tn-search input', 'croatia');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => location.hash.includes('q=croatia'));
  // preferences: language + theme live in the menu
  await page.click('.tn-pref');
  assert.equal(await page.$$eval('.dd [role=menuitemradio]', (e) => e.length), 5);
  await page.click('[data-theme-btn="light"]');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light');
  assert.equal(await page.$eval('[data-theme-btn="light"]', (e) => e.getAttribute('aria-checked')), 'true');
  await page.close();
});

test('calendar: month, week, day and agenda views all work', { skip, timeout: 120000 }, async () => {
  const page = await openPage(ctx, { viewport: VIEWPORTS['desktop-1440'], route: '#/calendar' });
  const tabs = await page.$$eval('.seg-btn', (b) => b.map((x) => ({ id: x.dataset.id, disabled: x.disabled })));
  assert.deepEqual(tabs, [{ id: 'month', disabled: false }, { id: 'week', disabled: false }, { id: 'day', disabled: false }, { id: 'agenda', disabled: false }]);

  await page.click('.seg-btn[data-id="week"]');
  await page.waitForSelector('.wk');
  assert.equal(await page.$$eval('.wk-day', (e) => e.length), 7);
  assert.equal(await page.$$eval('.wk-day.today', (e) => e.length), 1);
  const week1 = await page.$eval('.cal-title', (e) => e.textContent);
  await page.click('.cal-bar button[aria-label="Next week"]');
  assert.notEqual(await page.$eval('.cal-title', (e) => e.textContent), week1);
  await page.click('.cal-bar .btn'); // Today
  assert.equal(await page.$eval('.cal-title', (e) => e.textContent), week1);

  await page.click('.wk-day.today .wk-head'); // drill into the day
  await page.waitForSelector('.dv, .dv-empty');
  assert.equal(await page.$eval('.seg-btn[aria-selected="true"]', (e) => e.dataset.id), 'day');
  const day1 = await page.$eval('.cal-title', (e) => e.textContent);
  await page.click('.cal-bar button[aria-label="Next day"]');
  assert.notEqual(await page.$eval('.cal-title', (e) => e.textContent), day1);

  await page.click('.seg-btn[data-id="agenda"]');
  await page.waitForSelector('.agenda, .dv-empty');
  assert.ok((await page.$$eval('.agenda .day-item', (e) => e.length)) > 0, 'agenda lists upcoming sample events');
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('recurring events show in every period of week, month and agenda views', { skip, timeout: 120000 }, async () => {
  const page = await openPage(ctx, { viewport: VIEWPORTS['desktop-1440'], prefs: { showSamples: false }, route: '#/new' });
  await page.waitForSelector('#f-title');
  await setValue(page, '#f-title', 'Weekly standup');
  await setValue(page, '#f-date', TODAY);
  await setValue(page, '#f-freq', 'weekly');
  await Promise.all([page.waitForSelector('.d-title'), page.click('form button[type=submit]')]);
  await page.evaluate(() => (location.hash = '#/calendar?view=week'));
  await page.waitForSelector('.wk');
  assert.equal(await page.$eval('.seg-btn[aria-selected="true"]', (e) => e.dataset.id), 'week');
  const count = async () => page.$$eval('.wk-ev', (e) => e.filter((x) => x.textContent.includes('Weekly standup')).length);
  assert.equal(await count(), 1);
  for (let i = 0; i < 3; i++) await page.click('.cal-bar button[aria-label="Next week"]');
  assert.equal(await count(), 1, 'three weeks later it is still there');
  await page.click('.seg-btn[data-id="month"]');
  const dotted = await page.$$eval('.cal-day:not(.out) .dots i', (e) => e.length);
  assert.ok(dotted >= 3, `month shows several weekly occurrences (${dotted})`);
  await page.click('.seg-btn[data-id="agenda"]');
  await page.click('.cal-bar .btn'); // Today
  await page.waitForSelector('.agenda');
  const rows = await page.$$eval('.agenda .day-item', (e) => e.length);
  assert.ok(rows >= 4, `agenda expands the series (${rows})`);
  await page.click('.agenda .day-item');
  await page.waitForSelector('.d-title');
  assert.match(await page.$eval('.d-meta', (e) => e.textContent), /Repeats every week/);
  await page.close();
});

test('calendar week/day/agenda fit every viewport in both languages', { skip, timeout: 240000 }, async () => {
  for (const [vk, viewport] of Object.entries(VIEWPORTS)) {
    for (const lang of ['en', 'mk']) {
      for (const view of ['week', 'day', 'agenda']) {
        const page = await openPage(ctx, { viewport, prefs: { lang }, route: `#/calendar?view=${view}` });
        const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
        assert.ok(m.sw <= m.iw, `${vk} ${lang} ${view}: overflow ${JSON.stringify(m)}`);
        assert.deepEqual(page.errors, [], `${vk} ${lang} ${view}`);
        await page.close();
      }
    }
  }
});

test('density: the app is zoomed out enough to breathe (desktop and mobile)', { skip }, async () => {
  const d = await openPage(ctx, { viewport: VIEWPORTS['desktop-1440'] });
  assert.equal(await d.evaluate(() => getComputedStyle(document.documentElement).fontSize), '14px');
  const tiles = await d.$eval('.tiles', (e) => e.getBoundingClientRect().top);
  assert.ok(tiles < 900, `up-next tiles start at ${tiles}px`);
  const heroH = await d.$eval('.hero', (e) => e.getBoundingClientRect().height);
  assert.ok(heroH <= 240, `hero ${heroH}px`);
  await d.close();
  const m = await openPage(ctx, { viewport: VIEWPORTS['mobile-390'] });
  const secondBottom = await m.$$eval('.m-home .ecard', (els) => els[1].getBoundingClientRect().bottom);
  assert.ok(secondBottom < 844, `two cards fit on a 390x844 screen (second ends at ${secondBottom}px)`);
  await m.close();
});

test('timeline honours ?f= from the menu', { skip }, async () => {
  const page = await openPage(ctx, { viewport: VIEWPORTS['desktop-1440'], route: '#/timeline?f=upcoming' });
  assert.equal(await page.$eval('.seg-btn[aria-selected="true"]', (e) => e.dataset.id), 'upcoming');
  await page.close();
});
