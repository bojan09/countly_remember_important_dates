// Phase 5 browser tests: reminders (picker, bell inbox, system notifications) and .ics export.
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

const open = (prefs = {}, extra = {}) => openPage(ctx, { viewport: VIEWPORTS['desktop-1440'], prefs: { showSamples: false, ...prefs }, route: '#/settings', ...extra });
const seed = (page, event) => page.evaluate(async (event) => (await (await import('/src/store/events.js')).saveEvent({ category: 'work', recurrence: { freq: 'none' }, ...event })).event.id, event);
const goto = async (page, hash, sel) => {
  await page.evaluate((h) => (location.hash = h), hash);
  await page.waitForSelector(sel);
};
const clickText = (page, sel, text) => page.evaluate((s, t) => [...document.querySelectorAll(s)].find((e) => e.textContent.includes(t)).click(), sel, text);
/** Capture the next file the page "downloads" through a blob URL. */
const captureDownload = (page) =>
  page.evaluate(() => {
    window.__dl = null;
    const orig = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      if (blob instanceof Blob && /calendar/.test(blob.type)) blob.text().then((t) => (window.__dl = t));
      return orig(blob);
    };
  });
const minutesAgo = (m) => {
  const d = new Date(Date.now() - m * 60000);
  const p = (n) => String(n).padStart(2, '0');
  return { date: todayISO(d), time: `${p(d.getHours())}:${p(d.getMinutes())}` };
};

test('a reminder that comes due shows a dot on the bell and an inbox entry, and can be marked read', { skip, timeout: 90000 }, async () => {
  const page = await open({ reminderCheck: Date.now() - 3600000 });
  const { date, time } = minutesAgo(20);
  await seed(page, { title: 'Dentist', date, time, reminders: ['atTime'] });
  await page.evaluate(() => window.dispatchEvent(new Event('focus'))); // the scheduler also runs on a timer
  await page.waitForSelector('[data-bell].has-dot');
  assert.match(await page.$eval('[data-bell]', (b) => b.getAttribute('aria-label')), /1 new/);
  await page.click('[data-bell]');
  await page.waitForSelector('dialog[open] .nf-row');
  assert.match(await page.$eval('dialog[open] .nf-list', (e) => e.textContent), /Dentist[\s\S]*At the time of the event/);
  await clickText(page, 'dialog[open] .btn', 'Mark all as read');
  await page.waitForFunction(() => !document.querySelector('[data-bell].has-dot'));
  await page.click('[data-bell]');
  await page.waitForSelector('dialog[open] .notify-empty');
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('reminders that fired long ago, are archived, or belong to samples never light the bell', { skip, timeout: 90000 }, async () => {
  const page = await open({ showSamples: true, reminderCheck: Date.now() - 3600000 });
  const old = minutesAgo(60 * 24 * 5);
  await seed(page, { title: 'Old', date: old.date, time: old.time, reminders: ['atTime'] });
  const recent = minutesAgo(10);
  const id = await seed(page, { title: 'Archived', date: recent.date, time: recent.time, reminders: ['atTime'] });
  await page.evaluate(async (id) => (await import('/src/store/events.js')).setArchived(id, true), id);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(await page.$('[data-bell].has-dot'), null);
  await page.close();
});

test('system notifications are raised once per due reminder when allowed', { skip, timeout: 90000 }, async () => {
  await ctx.browser.defaultBrowserContext().overridePermissions(ctx.base, ['notifications']);
  const page = await open({ reminderCheck: Date.now() - 3600000 });
  await page.evaluate(() => {
    window.__notes = [];
    if (window.ServiceWorkerRegistration) ServiceWorkerRegistration.prototype.showNotification = function (title, o) { window.__notes.push({ title, tag: o.tag, body: o.body, hash: o.data && o.data.hash }); return Promise.resolve(); };
    window.Notification = Object.assign(function (title, o) { window.__notes.push({ title, tag: o.tag, body: o.body, hash: o.data && o.data.hash }); }, { permission: 'granted', requestPermission: async () => 'granted' });
  });
  const { date, time } = minutesAgo(15);
  const id = await seed(page, { title: 'Flight', date, time, reminders: ['atTime'] });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(await page.evaluate(() => window.__notes.length), 0, 'a reminder time that passed before the event existed is not announced');
  // an event created after its reminder time passed must not notify retroactively; rewind the scheduler's clock to simulate "app was closed"
  await page.evaluate(async () => (await import('/src/store/prefs.js')).setPref('reminderCheck', Date.now() - 3600000));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForFunction(() => window.__notes.length === 1);
  const n = await page.evaluate(() => window.__notes[0]);
  assert.equal(n.title, 'Flight');
  assert.match(n.body, /At the time of the event/);
  assert.equal(n.hash, `#/event/${encodeURIComponent(id)}`);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(await page.evaluate(() => window.__notes.length), 1, 'the same reminder is not announced twice');
  await page.close();
  await ctx.browser.defaultBrowserContext().clearPermissionOverrides();
});

test('reminder dialog: options depend on a clock time, save to the event, and export the event to a calendar', { skip, timeout: 90000 }, async () => {
  const page = await open();
  const allDayId = await seed(page, { title: 'Birthday', date: addDays(todayISO(), 20), recurrence: { freq: 'yearly', interval: 1, until: null }, notes: 'Cake; candles, balloons' });
  await goto(page, `#/event/${encodeURIComponent(allDayId)}`, '.d-title');
  await page.click('.d-act-btn[aria-label="Reminder"]');
  await page.waitForSelector('dialog[open] .rm-opts');
  assert.deepEqual(await page.$$eval('.rm-opt span', (e) => e.map((x) => x.textContent)), ['On the day, 9:00', '1 day before, 9:00', '2 days before, 9:00', '1 week before, 9:00']);
  await page.click('#rm-d1');
  await page.click('#rm-w1');
  await captureDownload(page);
  await clickText(page, 'dialog[open] .btn', 'Add to my calendar');
  await page.waitForFunction(() => window.__dl);
  const ics = await page.evaluate(() => window.__dl);
  assert.match(ics, /BEGIN:VEVENT/);
  assert.match(ics, /RRULE:FREQ=YEARLY;INTERVAL=1/);
  assert.match(ics, /DESCRIPTION:Cake\; candles\\, balloons/);
  assert.equal((ics.match(/BEGIN:VALARM/g) || []).length, 0, 'unsaved choices are not exported');
  await clickText(page, 'dialog[open] .btn', 'Save changes');
  await page.waitForFunction(() => /Reminders saved/.test(document.querySelector('.toast-host')?.textContent || ''));
  assert.deepEqual(await page.evaluate(async (id) => (await import('/src/store/events.js')).getSeries(id).reminders, allDayId), ['d1', 'w1']);

  const timedId = await seed(page, { title: 'Call', date: addDays(todayISO(), 3), time: '10:00' });
  await goto(page, `#/event/${encodeURIComponent(timedId)}`, '.d-title');
  await page.click('.d-act-btn[aria-label="Reminder"]');
  await page.waitForSelector('dialog[open] .rm-opts');
  assert.ok((await page.$$eval('.rm-opt span', (e) => e.map((x) => x.textContent))).includes('1 hour before'));
  await page.close();
});

test('event form: reminders are part of the form and the 1-hour option follows the all-day switch', { skip, timeout: 90000 }, async () => {
  const page = await open({}, { route: '#/new' });
  await page.waitForSelector('#f-title');
  assert.equal(await page.$('#rm-h1'), null, 'a new event is all-day: no hour-before option');
  await page.type('#f-title', 'Class');
  await page.$eval('#f-date', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, addDays(todayISO(), 6));
  await page.click('#f-allday');
  await page.waitForSelector('#rm-h1');
  await page.click('#rm-h1');
  await page.click('#rm-d1');
  await page.click('#f-allday'); // back to all-day: the hour-before choice must drop out
  await page.waitForFunction(() => !document.querySelector('#rm-h1'));
  assert.equal(await page.$eval('#rm-d1', (c) => c.checked), true, 'applicable choices are kept');
  await Promise.all([page.waitForSelector('.d-title'), page.click('form button[type=submit]')]);
  const stored = await page.evaluate(async () => (await import('/src/store/events.js')).listSeries()[0].reminders);
  assert.deepEqual(stored, ['d1']);
  await page.close();
});

test('settings: notification help, permission state and "all events" calendar export', { skip, timeout: 90000 }, async () => {
  const page = await open();
  await clickText(page, '.rows .row', 'Add all events to calendar');
  await page.waitForFunction(() => /no events of your own/.test(document.querySelector('.toast-host')?.textContent || ''));
  await seed(page, { title: 'One', date: addDays(todayISO(), 4), reminders: ['d1'] });
  await seed(page, { title: 'Two', date: addDays(todayISO(), 5) });
  await captureDownload(page);
  await clickText(page, '.rows .row', 'Add all events to calendar');
  await page.waitForFunction(() => window.__dl);
  const ics = await page.evaluate(() => window.__dl);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.equal((ics.match(/BEGIN:VALARM/g) || []).length, 1);
  await clickText(page, '.rows .row', 'Notifications');
  await page.waitForSelector('dialog[open] .rm-perm');
  assert.match(await page.$eval('dialog[open]', (d) => d.textContent), /cannot wake a closed browser/);
  assert.match(await page.$eval('dialog[open]', (d) => d.textContent), /Home Screen/);
  await page.close();
});

test('reminder dialogs work in Macedonian on a phone without overflow', { skip, timeout: 90000 }, async () => {
  const page = await open({ lang: 'mk' }, { viewport: VIEWPORTS['mobile-360'] });
  const id = await seed(page, { title: 'Тест', date: addDays(todayISO(), 3), time: '08:00', reminders: ['h1'] });
  await goto(page, `#/event/${encodeURIComponent(id)}`, '.d-title');
  await page.click('.d-act-btn[aria-label="Потсетник"]').catch(async () => page.click('.d-act-btn'));
  await page.waitForSelector('dialog[open] .rm-opts');
  assert.ok((await page.$$eval('.rm-opt span', (e) => e.map((x) => x.textContent))).includes('1 час пред'));
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, dw: document.querySelector('dialog').scrollWidth, dc: document.querySelector('dialog').clientWidth }));
  assert.ok(m.sw <= m.iw && m.dw <= m.dc, JSON.stringify(m));
  await page.close();
});
