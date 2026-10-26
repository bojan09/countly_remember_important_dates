// Phase 4.3 browser tests: memory notes, photo compression and viewer, Memories page.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

const dir = mkdtempSync(join(tmpdir(), 'countly-photos-'));
const PAST = addDays(todayISO(), -9);

async function makeImage(page, name, w, h, type = 'image/png') {
  const dataUrl = await page.evaluate((w, h, type) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#ff5fa2');
    grad.addColorStop(1, '#4da3ff');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    return c.toDataURL(type);
  }, w, h, type);
  const path = join(dir, name);
  writeFileSync(path, Buffer.from(dataUrl.split(',')[1], 'base64'));
  return path;
}

async function openPastEvent(prefs = {}, viewport = VIEWPORTS['desktop-1440']) {
  const page = await openPage(ctx, { viewport, prefs: { showSamples: false, ...prefs }, route: '#/settings' });
  const id = await page.evaluate(async (date) => {
    const m = await import('/src/store/events.js');
    return (await m.saveEvent({ title: 'Beach week', date, category: 'travel', recurrence: { freq: 'none' } })).event.id;
  }, PAST);
  await page.evaluate((id) => (location.hash = `#/event/${encodeURIComponent(id)}`), id);
  await page.waitForSelector('.d-title');
  return { page, id };
}

const addPhoto = async (page, path) => {
  const input = await page.$('#photo-input');
  const before = await page.$$eval('.d-thumb.photo', (e) => e.length);
  await input.uploadFile(path);
  await page.waitForFunction((n) => document.querySelectorAll('.d-thumb.photo').length === n + 1, { timeout: 8000 }, before);
};

test('memory note: saved on a past event, persists across reload and shows on the Memories page', { skip, timeout: 90000 }, async () => {
  const { page, id } = await openPastEvent();
  assert.equal(await page.$eval('#reflection', (e) => e.maxLength), 600);
  assert.equal(await page.$eval('.d-reflect .btn', (b) => b.disabled), true, 'nothing to save yet');
  await page.type('#reflection', 'Sunburnt but happy');
  assert.equal(await page.$eval('.d-reflect .btn', (b) => b.disabled), false);
  await page.click('.d-reflect .btn');
  await page.waitForFunction(() => /Note saved/.test(document.querySelector('.toast-host')?.textContent || ''));
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('#reflection');
  assert.equal(await page.$eval('#reflection', (e) => e.value), 'Sunburnt but happy');

  await page.evaluate(() => (location.hash = '#/memories'));
  await page.waitForSelector('.mem-card');
  assert.match(await page.$eval('.mem-note', (e) => e.textContent), /Sunburnt/);
  await page.evaluate(() => [...document.querySelectorAll('.mem-filter button')].find((b) => /With notes/.test(b.textContent)).click());
  assert.equal((await page.$$('.mem-card')).length, 1);
  await page.evaluate(() => [...document.querySelectorAll('.mem-filter button')].find((b) => /With photos/.test(b.textContent)).click());
  await page.waitForSelector('.empty');
  assert.equal(id.startsWith('ev-'), true);
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('no memory note box for upcoming events', { skip, timeout: 60000 }, async () => {
  const page = await openPage(ctx, { viewport: VIEWPORTS['desktop-1440'], prefs: { showSamples: false }, route: '#/settings' });
  const id = await page.evaluate(async (date) => (await (await import('/src/store/events.js')).saveEvent({ title: 'Later', date, category: 'work', recurrence: { freq: 'none' } })).event.id, addDays(todayISO(), 20));
  await page.evaluate((id) => (location.hash = `#/event/${encodeURIComponent(id)}`), id);
  await page.waitForSelector('.d-title');
  assert.equal(await page.$('#reflection'), null);
  await page.close();
});

test('large photos are downscaled to 1600px, shown in order, opened in a keyboard-driven viewer and deletable', { skip, timeout: 120000 }, async () => {
  const { page } = await openPastEvent();
  await addPhoto(page, await makeImage(page, 'big.png', 3200, 1800));
  await addPhoto(page, await makeImage(page, 'small.png', 400, 300));
  const stored = await page.evaluate(async () => {
    const m = await import('/src/store/events.js');
    const id = m.getEvents(new Date().toISOString().slice(0, 10)).find((e) => e.userEvent).seriesId;
    const out = [];
    for (const p of m.listPhotos(id)) {
      const blob = await m.getPhotoBlob(p.id);
      const bmp = await createImageBitmap(blob);
      out.push({ type: blob.type, w: bmp.width, h: bmp.height, name: p.name });
    }
    return out;
  });
  assert.deepEqual(stored[0], { type: 'image/jpeg', w: 1600, h: 900, name: 'big.jpg' });
  assert.deepEqual(stored[1], { type: 'image/png', w: 400, h: 300, name: 'small.png' }, 'small images are kept untouched');
  assert.deepEqual(await page.$$eval('.thumb-open', (b) => b.map((x) => x.getAttribute('aria-label'))), ['Open photo big.jpg', 'Open photo small.png']);

  await page.click('.d-thumb.photo .thumb-open');
  await page.waitForSelector('dialog.lightbox[open] .pv-img[src]');
  assert.match(await page.$eval('.pv-cap', (e) => e.textContent), /Photo 1 of 2: big\.jpg/);
  assert.equal(await page.$eval('.pv-nav.prev', (b) => b.disabled), true);
  assert.ok(await page.evaluate(() => document.querySelector('dialog').contains(document.activeElement)), 'focus inside the viewer');
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => /Photo 2 of 2: small\.png/.test(document.querySelector('.pv-cap').textContent));
  assert.equal(await page.$eval('.pv-nav.next', (b) => b.disabled), true);
  await page.keyboard.press('ArrowLeft');
  await page.waitForFunction(() => /Photo 1 of 2/.test(document.querySelector('.pv-cap').textContent));

  await page.evaluate(() => [...document.querySelectorAll('dialog.lightbox .btn')].find((b) => b.textContent === 'Remove photo').click());
  await page.waitForSelector('dialog.confirm[open], dialog[open].confirm');
  await page.evaluate(() => [...document.querySelectorAll('dialog.confirm .btn')].find((b) => b.textContent === 'Delete').click());
  await page.waitForFunction(() => /Photo 1 of 1: small\.png/.test(document.querySelector('.pv-cap')?.textContent || ''));
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('dialog.lightbox[open]'));
  assert.equal((await page.$$('.d-thumb.photo')).length, 1);

  await page.evaluate(() => (location.hash = '#/memories'));
  await page.waitForSelector('.mem-art img');
  assert.match(await page.$eval('.mem-photos', (e) => e.textContent), /1 photo/);
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('unsupported files are refused with a message and nothing is stored', { skip, timeout: 60000 }, async () => {
  const { page } = await openPastEvent();
  const svg = join(dir, 'x.svg');
  writeFileSync(svg, '<svg xmlns="http://www.w3.org/2000/svg" width="5" height="5"><script>alert(1)</script></svg>');
  const input = await page.$('#photo-input');
  await input.uploadFile(svg);
  await page.waitForFunction(() => /JPEG, PNG, WebP, GIF or AVIF/.test(document.querySelector('.toast-host')?.textContent || ''), { timeout: 5000 });
  assert.equal((await page.$$('.d-thumb.photo')).length, 0);
  await page.close();
});

test('memories and viewer work in Macedonian on a phone without horizontal overflow', { skip, timeout: 90000 }, async () => {
  const { page } = await openPastEvent({ lang: 'mk' }, VIEWPORTS['mobile-360']);
  await addPhoto(page, await makeImage(page, 'mk.png', 800, 600));
  await page.click('.d-thumb.photo .thumb-open');
  await page.waitForSelector('dialog.lightbox[open] .pv-img[src]');
  const v = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, dw: document.querySelector('dialog').scrollWidth, dc: document.querySelector('dialog').clientWidth }));
  assert.ok(v.sw <= v.iw && v.dw <= v.dc, JSON.stringify(v));
  assert.match(await page.$eval('.pv-cap', (e) => e.textContent), /Фотографија 1 од 1/);
  await page.keyboard.press('Escape');
  await page.evaluate(() => (location.hash = '#/memories'));
  await page.waitForSelector('.mem-card');
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
  assert.ok(m.sw <= m.iw, JSON.stringify(m));
  assert.match(await page.$eval('.mem-photos', (e) => e.textContent), /1 фотографија/);
  await page.close();
});
