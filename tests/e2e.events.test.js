// Phase 2 browser tests: real IndexedDB persistence, forms, CRUD, recurrence, search/sort/filter.
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

const TODAY = todayISO();
const D = (n) => addDays(TODAY, n);
const NO_SAMPLES = { showSamples: false };

async function setValue(page, sel, value) {
  await page.$eval(sel, (el, v) => {
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

async function createEvent(page, { title, date = D(10), category, pinned = false, repeat, interval, time, tz, location, notes, start } = {}) {
  await page.evaluate(() => (location.hash = '#/new'));
  await page.waitForSelector('#f-title');
  await setValue(page, '#f-title', title);
  await setValue(page, '#f-date', date);
  if (category) await setValue(page, '#f-category', category);
  if (location) await setValue(page, '#f-location', location);
  if (notes) await setValue(page, '#f-notes', notes);
  if (start) await setValue(page, '#f-start', start);
  if (repeat) {
    await setValue(page, '#f-freq', repeat);
    if (interval) await setValue(page, '#f-interval', String(interval));
  }
  if (time) {
    await page.click('#f-allday');
    await setValue(page, '#f-time', time);
    if (tz) await setValue(page, '#f-tz', tz);
  }
  if (pinned) await page.click('#f-pinned');
  await Promise.all([page.waitForSelector('.d-title'), page.click('form button[type=submit]')]);
  return page.$eval('.d-title', (e) => e.textContent);
}

const titles = (page, sel) => page.$$eval(sel, (els) => els.map((e) => e.textContent.trim()));

test('create → detail → persists across reload, with a live countdown', { skip, timeout: 120000 }, async () => {
  const page = await openPage(ctx, { prefs: NO_SAMPLES });
  const shown = await createEvent(page, { title: 'Dentist', date: D(3), notes: 'Bring the card', location: 'Skopje' });
  assert.match(shown, /Dentist/);
  assert.equal(await page.$eval('.d-days', (e) => e.textContent), '3 days');
  assert.match(await page.$eval('.d-notes', (e) => e.textContent), /Bring the card/);
  assert.match(await page.$eval('.d-meta', (e) => e.textContent), /Skopje/);
  // seconds tick
  const a = await page.$eval('.d-live', (e) => e.textContent);
  await new Promise((r) => setTimeout(r, 2200));
  const b = await page.$eval('.d-live', (e) => e.textContent);
  assert.match(a, /^\d+d \d+h \d+m \d+s$/);
  assert.notEqual(a, b, 'seconds must advance');
  const id = await page.evaluate(() => decodeURIComponent(location.hash.split('/')[2]));
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('.d-title');
  assert.match(await page.$eval('.d-title', (e) => e.textContent), /Dentist/);
  // visible on Home
  await page.evaluate(() => (location.hash = '#/'));
  await page.waitForSelector('.home');
  assert.ok((await titles(page, '.ecard-title')).some((x) => x.includes('Dentist')));
  assert.ok(id.startsWith('ev-'));
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('stored events survive an offline restart', { skip, timeout: 120000 }, async () => {
  const page = await openPage(ctx, { prefs: NO_SAMPLES });
  await createEvent(page, { title: 'Offline Trip', date: D(20) });
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return reg.active.state;
  });
  await page.reload({ waitUntil: 'networkidle0' }); // let the service worker take control
  await page.setOfflineMode(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.evaluate(() => (location.hash = '#/timeline'));
  await page.waitForSelector('.tl-item');
  assert.ok((await titles(page, '.tl-txt b')).some((x) => x.includes('Offline Trip')));
  await page.setOfflineMode(false);
  await page.close();
});

test('validation: errors are announced, focus moves to the first problem, nothing is stored', { skip, timeout: 60000 }, async () => {
  const page = await openPage(ctx, { prefs: NO_SAMPLES, route: '#/new' });
  await setValue(page, '#f-date', '');
  await page.click('form button[type=submit]');
  await page.waitForSelector('.form-summary:not([hidden])');
  assert.equal(await page.$eval('#f-title', (e) => e.getAttribute('aria-invalid')), 'true');
  assert.match(await page.$eval('#err-title', (e) => e.textContent), /Enter a title/);
  assert.match(await page.$eval('#err-date', (e) => e.textContent), /Choose a date/);
  assert.equal(await page.$eval('.form-summary', (e) => e.getAttribute('role')), 'alert');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'f-title');
  assert.ok((await page.$eval('#f-title', (e) => e.getAttribute('aria-describedby'))).includes('err-title'));
  // typing clears the message
  await page.type('#f-title', 'Fixed');
  assert.equal(await page.$eval('#err-title', (e) => e.hidden), true);
  // start after date, end before date
  await setValue(page, '#f-date', D(5));
  await setValue(page, '#f-start', D(9));
  await setValue(page, '#f-freq', 'weekly');
  await setValue(page, '#f-ends', 'on');
  await setValue(page, '#f-until', D(1));
  await setValue(page, '#f-interval', '0');
  await page.click('form button[type=submit]');
  await page.waitForSelector('#err-start:not([hidden])');
  assert.match(await page.$eval('#err-start', (e) => e.textContent), /start date/i);
  assert.match(await page.$eval('#err-until', (e) => e.textContent), /end date/i);
  assert.match(await page.$eval('#err-interval', (e) => e.textContent), /1 to 999/);
  const count = await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('countly'); r.onsuccess = () => { const q = r.result.transaction('events').objectStore('events').count(); q.onsuccess = () => res(q.result); }; }));
  assert.equal(count, 0);
  await page.close();
});

test('edit keeps the id, updates every view, and cancel changes nothing', { skip, timeout: 120000 }, async () => {
  const page = await openPage(ctx, { prefs: NO_SAMPLES });
  await createEvent(page, { title: 'Draft', date: D(7) });
  const id = await page.evaluate(() => decodeURIComponent(location.hash.split('/')[2]));
  await page.click('.d-top-r button:first-child');
  await page.waitForSelector('#f-title');
  assert.equal(await page.$eval('#f-title', (e) => e.value), 'Draft');
  assert.equal(await page.$eval('#f-date', (e) => e.value), D(7));
  await setValue(page, '#f-title', 'Final');
  await setValue(page, '#f-category', 'work');
  await Promise.all([page.waitForSelector('.d-title'), page.click('form button[type=submit]')]);
  assert.match(await page.$eval('.d-title', (e) => e.textContent), /Final/);
  assert.equal(await page.evaluate(() => decodeURIComponent(location.hash.split('/')[2])), id);
  await page.evaluate(() => (location.hash = '#/timeline'));
  await page.waitForSelector('.tl-item');
  assert.deepEqual((await titles(page, '.tl-txt b')).filter((x) => /Draft|Final/.test(x)), ['Final']);
  await page.close();
});

test('delete asks for confirmation and Undo brings the event back', { skip, timeout: 120000 }, async () => {
  const page = await openPage(ctx, { prefs: NO_SAMPLES });
  await createEvent(page, { title: 'Doomed', date: D(4) });
  await page.click('.d-top-r button:last-child');
  await page.waitForSelector('dialog.confirm[open]');
  assert.match(await page.$eval('dialog.confirm', (e) => e.textContent), /Doomed/);
  // Cancel first
  await page.evaluate(() => [...document.querySelectorAll('dialog.confirm .btn')].find((b) => /cancel/i.test(b.textContent)).click());
  await page.waitForFunction(() => !document.querySelector('dialog.confirm'));
  assert.ok(await page.$('.d-title'));
  // Now delete
  await page.click('.d-top-r button:last-child');
  await page.waitForSelector('dialog.confirm[open]');
  await page.click('dialog.confirm .btn.danger');
  await page.waitForSelector('.toast-action');
  await page.waitForSelector('.empty'); // home with no events
  await page.click('.toast-action');
  await page.waitForFunction(() => [...document.querySelectorAll('.ecard-title')].some((e) => e.textContent.includes('Doomed')));
  await page.close();
});

test('duplicate, favorite and archive from the More sheet', { skip, timeout: 120000 }, async () => {
  const page = await openPage(ctx, { prefs: NO_SAMPLES });
  await createEvent(page, { title: 'Original', date: D(6) });
  const more = async (label) => {
    await page.click('.d-act-btn[aria-haspopup]');
    await page.waitForSelector('dialog .more-row');
    await page.evaluate((l) => [...document.querySelectorAll('dialog .more-row')].find((b) => b.textContent.includes(l)).click(), label);
  };
  await more('Add to favorites');
  await page.waitForFunction(() => document.querySelector('.toast'));
  await more('Duplicate');
  await page.waitForSelector('#f-title');
  assert.equal(await page.$eval('#f-title', (e) => e.value), 'Original (copy)');
  await Promise.all([page.waitForSelector('.d-title'), page.click('form button[type=submit]')]);
  await more('Archive');
  await page.waitForFunction(() => /Archived/.test(document.querySelector('.d-sheet').textContent));
  await page.evaluate(() => (location.hash = '#/'));
  await page.waitForSelector('.home');
  const names = await titles(page, '.ecard-title');
  assert.ok(names.some((n) => n.includes('Original') && !n.includes('copy')), 'original still listed');
  assert.ok(!names.some((n) => n.includes('(copy)')), 'archived copy hidden from lists');
  await page.evaluate(() => (location.hash = '#/timeline'));
  await page.waitForSelector('.tl-item, .empty');
  await page.click('.seg-btn[data-id="archived"]');
  assert.deepEqual((await titles(page, '.tl-txt b')).map((x) => x.replace(/\s+/g, ' ')), ['Original (copy)']);
  await page.close();
});

test('recurring events: next occurrence upcoming, last one is a memory, one occurrence can be skipped', { skip, timeout: 120000 }, async () => {
  const page = await openPage(ctx, { prefs: NO_SAMPLES });
  // monthly, anchored 40 days ago -> next within the coming month, previous within the last month
  await createEvent(page, { title: 'Rent', date: D(-40), repeat: 'monthly' });
  assert.match(await page.$eval('.d-meta', (e) => e.textContent), /Repeats every month/);
  const nextDate = await page.$eval('.d-date', (e) => e.textContent);
  assert.ok(nextDate);
  await page.evaluate(() => (location.hash = '#/memories'));
  await page.waitForSelector('.mem-card');
  assert.equal((await titles(page, '.mem-txt b')).filter((x) => x === 'Rent').length, 1, 'exactly one past occurrence');
  await page.evaluate(() => (location.hash = '#/stats'));
  await page.waitForSelector('.stat-tiles');
  assert.equal(await page.$eval('.stat-tile b', (e) => e.textContent), '1', 'series counted once');
  // skip the next occurrence
  await page.evaluate(() => (location.hash = '#/timeline'));
  await page.waitForSelector('.tl-item');
  await page.click('.tl-card');
  await page.waitForSelector('.d-title');
  await page.click('.d-act-btn[aria-haspopup]');
  await page.waitForSelector('dialog .more-row');
  await page.evaluate(() => [...document.querySelectorAll('dialog .more-row')].find((b) => /Skip this occurrence/.test(b.textContent)).click());
  await page.waitForFunction((was) => document.querySelector('.d-date') && document.querySelector('.d-date').textContent !== was, {}, nextDate);
  await page.close();
});

test('timed events use their clock time; a zone makes an absolute instant', { skip, timeout: 120000 }, async () => {
  const page = await openPage(ctx, { prefs: NO_SAMPLES });
  await createEvent(page, { title: 'Flight', date: D(15), time: '07:40', tz: 'Europe/Skopje' });
  assert.match(await page.$eval('.d-meta', (e) => e.textContent), /07:40 · Europe\/Skopje/);
  const shown = await page.$eval('.d-live', (e) => e.textContent);
  const expectedMs = await page.evaluate(async (date) => {
    const { eventInstantMs } = await import('/src/date/instant.js');
    return eventInstantMs({ date, time: '07:40', tz: 'Europe/Skopje' }) - Date.now();
  }, D(15));
  const days = Math.floor(expectedMs / 86400000);
  assert.ok(shown.startsWith(`${days}d `), `${shown} vs ${days}d`);
  await page.close();
});

test('search, sort, category and favorites filters on the timeline', { skip, timeout: 120000 }, async () => {
  const page = await openPage(ctx, { prefs: NO_SAMPLES });
  await createEvent(page, { title: 'Zebra party', date: D(5), category: 'celebration' });
  await createEvent(page, { title: 'Alpha review', date: D(9), category: 'work', pinned: true });
  await createEvent(page, { title: 'Beach week', date: D(2), category: 'travel', location: 'Ohrid' });
  await page.evaluate(() => (location.hash = '#/timeline'));
  await page.waitForSelector('.tl-item');
  const list = () => titles(page, '.tl-txt b');
  assert.deepEqual(await list(), ['Beach week', 'Zebra party', 'Alpha review']);
  await setValue(page, '.tl-filters select[aria-label="Sort"]', 'title');
  assert.deepEqual(await list(), ['Alpha review', 'Beach week', 'Zebra party']);
  await setValue(page, '.tl-filters select[aria-label="Sort"]', 'dateDesc');
  assert.deepEqual(await list(), ['Alpha review', 'Zebra party', 'Beach week']);
  await setValue(page, '.tl-filters select[aria-label="Category"]', 'travel');
  assert.deepEqual(await list(), ['Beach week']);
  await page.click('.tl-filters .btn'); // clear
  assert.equal((await list()).length, 3);
  await page.click('.chip-toggle');
  assert.deepEqual((await list()).map((x) => x.trim()), ['Alpha review']);
  await page.click('.chip-toggle');
  await page.type('.tl-search input', 'ohrid'); // matches location
  assert.deepEqual(await list(), ['Beach week']);
  assert.match(await page.$eval('.tl-count', (e) => e.textContent), /1 event/);
  // favorites drive the hero on desktop
  await page.evaluate(() => (location.hash = '#/'));
  await page.waitForSelector('.hero-title');
  assert.match(await page.$eval('.hero-title', (e) => e.textContent), /Alpha review/);
  await page.close();
});

test('photos are stored locally, survive reload and can be removed', { skip, timeout: 120000 }, async () => {
  const page = await openPage(ctx, { prefs: NO_SAMPLES });
  await createEvent(page, { title: 'With photo', date: D(8) });
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const { writeFileSync, mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const file = join(mkdtempSync(join(tmpdir(), 'cly-')), 'dot.png');
  writeFileSync(file, png);
  const input = await page.$('#photo-input');
  await input.uploadFile(file);
  await page.waitForSelector('.d-thumb.photo img');
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('.d-thumb.photo img');
  assert.match(await page.$eval('.d-photos h2', (e) => e.textContent), /Photos \(1\)/);
  // wrong type is refused with a message
  const txt = join(mkdtempSync(join(tmpdir(), 'cly-')), 'a.txt');
  writeFileSync(txt, 'hello');
  await (await page.$('#photo-input')).uploadFile(txt);
  await page.waitForFunction(() => [...document.querySelectorAll('.toast')].some((t) => /image file/.test(t.textContent)));
  await page.click('.thumb-del');
  await page.waitForFunction(() => !document.querySelector('.d-thumb.photo'));
  await page.close();
});

test('a second tab sees changes made in the first (live cross-view update)', { skip, timeout: 120000 }, async () => {
  const a = await openPage(ctx, { prefs: NO_SAMPLES });
  const b = await a.browserContext().newPage();
  await b.evaluateOnNewDocument(() => localStorage.setItem('countly.prefs.v1', JSON.stringify({ onboarded: true, showSamples: false })));
  await b.goto(`${ctx.base}/#/timeline`, { waitUntil: 'networkidle0' });
  await b.waitForSelector('.view');
  assert.equal((await titles(b, '.tl-txt b')).length, 0);
  await a.bringToFront();
  await createEvent(a, { title: 'Shared moment', date: D(12) });
  await b.waitForFunction(() => [...document.querySelectorAll('.tl-txt b')].some((e) => e.textContent.includes('Shared moment')), { timeout: 8000 });
  await b.close();
  await a.close();
});

test('legacy and corrupted stored records are migrated or skipped, never crash the app', { skip, timeout: 120000 }, async () => {
  const page = await openPage(ctx, { prefs: NO_SAMPLES });
  await page.evaluate(
    (date) =>
      new Promise((res, rej) => {
        const r = indexedDB.open('countly');
        r.onsuccess = () => {
          const tx = r.result.transaction('events', 'readwrite');
          const os = tx.objectStore('events');
          os.put({ id: 'legacy-1', title: 'Old format', date, repeat: 'yearly', favorite: true, category: 'travel' });
          os.put({ id: 'broken-1', title: 'No date' });
          tx.oncomplete = () => res();
          tx.onerror = () => rej(tx.error);
        };
      }),
    D(30),
  );
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('.view');
  await page.waitForFunction(() => [...document.querySelectorAll('.toast')].some((t) => /unreadable/.test(t.textContent)));
  await page.evaluate(() => (location.hash = '#/event/legacy-1'));
  await page.waitForSelector('.d-title');
  assert.match(await page.$eval('.d-meta', (e) => e.textContent), /Repeats every year/);
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('samples are read-only but can be copied into real events', { skip, timeout: 120000 }, async () => {
  const page = await openPage(ctx, { route: '#/event/sample-birthday' });
  await page.waitForSelector('.d-title');
  assert.equal(await page.$eval('.d-top-r button:first-child', (e) => e.disabled), true);
  assert.equal(await page.$eval('.d-top-r button:last-child', (e) => e.disabled), true);
  await page.click('.d-act-btn[aria-haspopup]');
  await page.waitForSelector('dialog .more-row');
  await page.evaluate(() => document.querySelector('dialog .more-row').click());
  await page.waitForSelector('#f-title');
  assert.match(await page.$eval('#f-title', (e) => e.value), /\(copy\)/);
  await page.close();
});

test('form is usable in Macedonian and at every viewport without overflow', { skip, timeout: 240000 }, async () => {
  for (const [vk, viewport] of Object.entries(VIEWPORTS)) {
    for (const lang of ['en', 'mk']) {
      const page = await openPage(ctx, { viewport, prefs: { lang, ...NO_SAMPLES }, route: '#/new' });
      await page.waitForSelector('#f-title');
      const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
      assert.ok(m.sw <= m.iw, `${vk} ${lang}: overflow ${JSON.stringify(m)}`);
      // every control has an accessible name
      const unnamed = await page.$$eval('.form input:not([type=radio]), .form select, .form textarea, .form button', (els) => els.filter((e) => !e.labels?.length && !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby') && !e.textContent.trim()).map((e) => e.outerHTML.slice(0, 80)));
      assert.deepEqual(unnamed, [], `${vk} ${lang}`);
      if (lang === 'mk') assert.match(await page.$eval('label[for=f-title]', (e) => e.textContent), /Наслов/);
      assert.deepEqual(page.errors, [], `${vk} ${lang}`);
      await page.close();
    }
  }
});

test('keyboard: the form can be completed and submitted without a mouse', { skip, timeout: 60000 }, async () => {
  const page = await openPage(ctx, { prefs: NO_SAMPLES, route: '#/new' });
  await page.waitForSelector('#f-title');
  await page.focus('#f-title');
  await page.keyboard.type('Keyboard only');
  await setValue(page, '#f-date', D(11));
  await page.focus('#f-title');
  await page.keyboard.press('Enter'); // Enter in a text field submits the form
  await page.waitForSelector('.d-title');
  assert.match(await page.$eval('.d-title', (e) => e.textContent), /Keyboard only/);
  await page.close();
});
