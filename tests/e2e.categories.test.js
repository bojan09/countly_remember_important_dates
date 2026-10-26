// Phase 4.2 browser tests: the category manager against real IndexedDB.
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

const NO_SAMPLES = { showSamples: false };
const open = (extra = {}) => openPage(ctx, { viewport: VIEWPORTS['desktop-1440'], prefs: NO_SAMPLES, route: '#/categories', ...extra });
const names = (page) => page.$$eval('.cm-item .cm-main b', (els) => els.map((e) => e.firstChild.textContent));
const click = (page, sel, text) => page.evaluate((s, t) => [...document.querySelectorAll(s)].find((e) => !t || e.textContent.trim() === t).click(), sel, text);

async function addCategory(page, name, { enter = false } = {}) {
  await page.click('#cm-new');
  await page.waitForSelector('dialog[open] #cm-name');
  await page.type('#cm-name', name);
  if (enter) await page.keyboard.press('Enter');
  else await click(page, 'dialog .modal-foot .btn', 'Save changes');
}

test('create a category: it appears in the list, the event form, the timeline filter and persists', { skip, timeout: 90000 }, async () => {
  const page = await open();
  assert.deepEqual(await names(page), ['Celebration', 'Travel', 'Work', 'Health', 'Personal', 'Other']);
  await addCategory(page, 'Hiking club');
  await page.waitForFunction(() => document.querySelectorAll('.cm-item').length === 7);
  assert.deepEqual((await names(page)).slice(5), ['Hiking club', 'Other']);

  await page.evaluate(() => (location.hash = '#/new'));
  await page.waitForSelector('#f-category');
  const opts = await page.$$eval('#f-category option', (o) => o.map((x) => x.textContent));
  assert.ok(opts.includes('Hiking club'));
  await page.select('#f-category', await page.$eval('#f-category option:nth-child(6)', (o) => o.value));
  await page.type('#f-title', 'Mount Vodno');
  await page.$eval('#f-date', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, addDays(todayISO(), 5));
  await Promise.all([page.waitForSelector('.d-title'), page.click('form button[type=submit]')]);

  await page.evaluate(() => (location.hash = '#/timeline'));
  await page.waitForSelector('.tl-search');
  assert.ok((await page.$$eval('select[aria-label] option', (o) => o.map((x) => x.textContent))).includes('Hiking club'));

  await page.reload({ waitUntil: 'networkidle0' });
  await page.evaluate(() => (location.hash = '#/categories'));
  await page.waitForSelector('.cm-item');
  const row = await page.$$eval('.cm-item', (els) => els.map((e) => [e.querySelector('b').firstChild.textContent, e.querySelector('small').textContent]));
  assert.deepEqual(row.find((r) => r[0] === 'Hiking club'), ['Hiking club', '1 event']);
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('validation: empty and duplicate names show an inline, announced error', { skip, timeout: 60000 }, async () => {
  const page = await open();
  await page.click('#cm-new');
  await page.waitForSelector('#cm-name');
  await click(page, 'dialog .modal-foot .btn', 'Save changes');
  await page.waitForSelector('#cm-name-err:not([hidden])');
  assert.match(await page.$eval('#cm-name-err', (e) => e.textContent), /Enter a name/);
  assert.equal(await page.$eval('#cm-name', (e) => e.getAttribute('aria-invalid')), 'true');
  await page.type('#cm-name', 'travel');
  await click(page, 'dialog .modal-foot .btn', 'Save changes');
  await page.waitForFunction(() => /already has this name/.test(document.querySelector('#cm-name-err').textContent));
  assert.ok(await page.evaluate(() => document.activeElement.id === 'cm-name'), 'focus returns to the field');
  await page.close();
});

test('hide, show and reorder built-in categories', { skip, timeout: 60000 }, async () => {
  const page = await open();
  await click(page, '.cm-item[data-cat=travel] .cm-actions button[aria-label^="Hide"]');
  await page.waitForSelector('.cm-item[data-cat=travel].is-hidden');
  assert.match(await page.$eval('.cm-item[data-cat=travel]', (e) => e.textContent), /Hidden/);
  await page.evaluate(() => (location.hash = '#/new'));
  await page.waitForSelector('#f-category');
  assert.equal((await page.$$eval('#f-category option', (o) => o.map((x) => x.textContent))).includes('Travel'), false);
  await page.evaluate(() => (location.hash = '#/categories'));
  await page.waitForSelector('.cm-item');
  await click(page, '.cm-item[data-cat=travel] .cm-actions button[aria-label^="Show"]');
  await page.waitForSelector('.cm-item[data-cat=travel]:not(.is-hidden)');
  await click(page, '.cm-item[data-cat=work] .cm-actions button[aria-label^="Move Work up"]');
  await page.waitForFunction(() => document.querySelector('.cm-item:nth-child(2)').dataset.cat === 'work');
  assert.equal(await page.$eval('.cm-item[data-cat=celebration] button[aria-label^="Move Celebration up"]', (b) => b.disabled), true);
  assert.equal(await page.$('.cm-item[data-cat=other] button[aria-label^="Hide"]'), null, '"Other" cannot be hidden');
  await page.close();
});

test('delete a category in use: events move to the chosen category', { skip, timeout: 90000 }, async () => {
  const page = await open();
  await addCategory(page, 'Temp', { enter: true });
  await page.waitForFunction(() => document.querySelectorAll('.cm-item').length === 7);
  await page.evaluate(async () => {
    const m = await import('/src/store/events.js');
    const cat = (await import('/src/events/categories.js')).allCategories().find((c) => c.name === 'Temp');
    await m.saveEvent({ title: 'Moves', date: '2030-01-01', category: cat.id, recurrence: { freq: 'none' } });
  });
  await page.waitForFunction(() => document.querySelector('.cm-item:nth-child(6) small').textContent === '1 event');
  await click(page, '.cm-item:nth-child(6) button[aria-label^="Delete"]');
  await page.waitForSelector('#cm-move');
  assert.match(await page.$eval('dialog[open] .confirm-body', (e) => e.textContent), /Events in this category: 1/);
  assert.equal(await page.$eval('#cm-move', (s) => s.value), 'other');
  await page.select('#cm-move', 'work');
  await click(page, 'dialog .modal-foot .btn', 'Delete');
  await page.waitForFunction(() => document.querySelectorAll('.cm-item').length === 6);
  const cat = await page.evaluate(async () => (await import('/src/store/events.js')).getEvents('2029-01-01').find((e) => e.title === 'Moves').category);
  assert.equal(cat, 'work');
  await page.close();
});

test('category manager works in Macedonian on a phone without overflow and every control is named', { skip, timeout: 90000 }, async () => {
  const page = await open({ viewport: VIEWPORTS['mobile-360'], prefs: { ...NO_SAMPLES, lang: 'mk' } });
  await page.click('#cm-new');
  await page.waitForSelector('dialog[open] #cm-name');
  const unnamed = await page.$$eval('dialog[open] button, dialog[open] input, dialog[open] select', (els) => els.filter((e) => !e.labels?.length && !e.getAttribute('aria-label') && !e.textContent.trim()).map((e) => e.outerHTML.slice(0, 80)));
  assert.deepEqual(unnamed, []);
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, dw: document.querySelector('dialog').scrollWidth, dc: document.querySelector('dialog').clientWidth }));
  assert.ok(m.sw <= m.iw && m.dw <= m.dc, JSON.stringify(m));
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  const list = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
  assert.ok(list.sw <= list.iw, JSON.stringify(list));
  assert.deepEqual(page.errors, []);
  await page.close();
});
