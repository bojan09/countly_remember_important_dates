// Phase 5 browser tests: the share image studio renders real PNGs from real events.
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

async function openStudio(prefs = {}, viewport = VIEWPORTS['desktop-1440'], event = {}) {
  const page = await openPage(ctx, { viewport, prefs: { showSamples: false, ...prefs }, route: '#/settings' });
  const id = await page.evaluate(async (event) => (await (await import('/src/store/events.js')).saveEvent({ title: 'Beach week', emoji: '🏖️', category: 'travel', scene: 'beach', recurrence: { freq: 'none' }, ...event })).event.id, { date: addDays(todayISO(), 12), ...event });
  await page.evaluate((id) => (location.hash = `#/event/${encodeURIComponent(id)}`), id);
  await page.waitForSelector('.d-title');
  await page.evaluate(() => [...document.querySelectorAll('.d-act-btn')].find((b) => /^(Share|Сподели)$/.test(b.getAttribute('aria-label'))).click());
  await page.waitForSelector('dialog.studio[open] .ss-canvas[data-ready="1"]');
  return page;
}
const ready = (page) => page.waitForFunction(() => document.querySelector('.ss-canvas').dataset.ready === '1');
const click = (page, sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
/** Distinct colours among a grid of sampled pixels: a blank/failed render has one or two. */
const colours = (page) =>
  page.evaluate(() => {
    const c = document.querySelector('.ss-canvas');
    const g = c.getContext('2d');
    const set = new Set();
    for (let i = 1; i < 12; i++) for (let j = 1; j < 12; j++) set.add([...g.getImageData(Math.floor((c.width * i) / 12), Math.floor((c.height * j) / 12), 1, 1).data].join(','));
    return set.size;
  });

test('studio renders each size at its real pixel dimensions with a labelled, non-blank preview', { skip, timeout: 120000 }, async () => {
  const page = await openStudio();
  for (const [fmt, w, h] of [['story', 1080, 1920], ['square', 1080, 1080], ['wide', 1200, 630]]) {
    await click(page, `[data-value="${fmt}"]`);
    await ready(page);
    assert.deepEqual(await page.$eval('.ss-canvas', (c) => [c.width, c.height]), [w, h], fmt);
    assert.ok((await colours(page)) > 8, `${fmt} is not blank`);
    assert.equal(await page.$eval(`[data-value="${fmt}"]`, (b) => b.getAttribute('aria-checked')), 'true');
  }
  const label = await page.$eval('.ss-canvas', (c) => c.getAttribute('aria-label'));
  assert.match(label, /Beach week/);
  assert.match(label, /12 days/);
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('title, date and picture switches change what is drawn and what the label says', { skip, timeout: 120000 }, async () => {
  const page = await openStudio();
  const label = () => page.$eval('.ss-canvas', (c) => c.getAttribute('aria-label'));
  await click(page, '#ss-title');
  await ready(page);
  assert.doesNotMatch(await label(), /Beach week/, 'title is left off the image and its description');
  await click(page, '#ss-date');
  await ready(page);
  assert.doesNotMatch(await label(), /20\d\d/);
  const pixel = () => page.evaluate(() => { const c = document.querySelector('.ss-canvas'); return [...c.getContext('2d').getImageData(c.width / 2, c.height * 0.12, 1, 1).data].join(','); });
  const withArt = await pixel();
  await click(page, '#ss-art');
  await ready(page);
  assert.notEqual(withArt, await pixel(), 'dropping the picture changes the top of the image');
  await click(page, '[data-value="vivid"]');
  await ready(page);
  assert.equal(await page.$eval('[data-value="vivid"]', (b) => b.getAttribute('aria-checked')), 'true');
  await page.close();
});

test('download produces a real PNG with the chosen size and a safe file name', { skip, timeout: 120000 }, async () => {
  const page = await openStudio();
  await click(page, '[data-value="square"]');
  await ready(page);
  await page.evaluate(() => {
    window.__file = null;
    const orig = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (b) => {
      if (b instanceof File && b.type === 'image/png') window.__file = { name: b.name, blob: b };
      return orig(b);
    };
  });
  await page.evaluate(() => [...document.querySelectorAll('dialog.studio .btn')].find((b) => b.textContent === 'Download image').click());
  await page.waitForFunction(() => window.__file);
  const info = await page.evaluate(async () => {
    const { name, blob } = window.__file;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const bmp = await createImageBitmap(blob);
    return { name, sig: [...bytes.slice(0, 8)], w: bmp.width, h: bmp.height, size: blob.size };
  });
  assert.equal(info.name, 'beach-week-square.png');
  assert.deepEqual(info.sig, [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.deepEqual([info.w, info.h], [1080, 1080]);
  assert.ok(info.size > 20000);
  await page.waitForFunction(() => /beach-week-square\.png/.test(document.querySelector('.ss [role=status]').textContent));
  await page.close();
});

test('same-day events read "Today!" and long titles shrink to fit above the footer in every size', { skip, timeout: 120000 }, async () => {
  const page = await openStudio({}, VIEWPORTS['desktop-1440'], { date: todayISO(), title: 'Extraordinarily long celebration title that keeps going and going for ages' });
  assert.match(await page.$eval('.ss-canvas', (c) => c.getAttribute('aria-label')), /Today!/);
  for (const fmt of ['story', 'square', 'wide']) {
    await click(page, `[data-value="${fmt}"]`);
    await ready(page);
    const m = await page.$eval('.ss-canvas', (c) => ({ bottom: Number(c.dataset.textBottom), footer: Number(c.dataset.footerTop), top: 0 }));
    assert.ok(m.bottom > 0 && m.bottom <= m.footer + 1, `${fmt}: text ends at ${m.bottom}, footer starts at ${m.footer}`);
  }
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('studio works in Macedonian on a phone without horizontal overflow', { skip, timeout: 120000 }, async () => {
  const page = await openStudio({ lang: 'mk' }, VIEWPORTS['mobile-360']);
  assert.match(await page.$eval('dialog.studio', (d) => d.textContent), /Слика за споделување/);
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, dw: document.querySelector('dialog').scrollWidth, dc: document.querySelector('dialog').clientWidth }));
  assert.ok(m.sw <= m.iw && m.dw <= m.dc, JSON.stringify(m));
  const unnamed = await page.$$eval('dialog[open] button, dialog[open] input', (els) => els.filter((e) => !e.labels?.length && !e.getAttribute('aria-label') && !e.textContent.trim()).map((e) => e.outerHTML.slice(0, 80)));
  assert.deepEqual(unnamed, []);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  await page.close();
});
