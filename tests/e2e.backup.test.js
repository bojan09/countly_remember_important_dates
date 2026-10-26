// Phase 4.1 browser tests: backup export/import through the real Settings UI and IndexedDB.
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

const D = (n) => addDays(todayISO(), n);
const dir = mkdtempSync(join(tmpdir(), 'countly-backup-'));
const tmpFile = (name, text) => {
  const p = join(dir, name);
  writeFileSync(p, text);
  return p;
};

async function seed(page, title) {
  await page.evaluate(
    async (title, date) => {
      const m = await import('/src/store/events.js');
      await m.saveEvent({ title, date, category: 'travel', recurrence: { freq: 'none' } });
    },
    title,
    D(14),
  );
}
const titles = (page) => page.evaluate(async () => (await import('/src/store/events.js')).getEvents(new Date().toISOString().slice(0, 10)).filter((e) => e.userEvent).map((e) => e.title));
const exportText = (page) => page.evaluate(async () => (await (await import('/src/store/events.js')).exportBackup({ lang: 'en' })).text);
const clickRow = (page, label) => page.evaluate((l) => [...document.querySelectorAll('.rows .row')].find((b) => b.textContent.includes(l)).click(), label);

async function pickFile(page, path, label = 'Import') {
  const [chooser] = await Promise.all([page.waitForFileChooser(), clickRow(page, label)]);
  await chooser.accept([path]);
}

test('export shows a toast, records the date and is a valid backup', { skip, timeout: 60000 }, async () => {
  const page = await openPage(ctx, { viewport: VIEWPORTS['desktop-1440'], prefs: { showSamples: false }, route: '#/settings' });
  await seed(page, 'Backed up');
  await page.waitForSelector('.rows .row');
  assert.match(await page.$eval('.rows', (e) => e.textContent), /No backup yet/);
  await clickRow(page, 'Export');
  await page.waitForFunction(() => /Backup saved\. Events: 1/.test(document.querySelector('.toast-host')?.textContent || ''), { timeout: 5000 });
  assert.match(await page.$eval('.rows', (e) => e.textContent), /Last backup:/);
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('merge import restores a deleted event and is idempotent', { skip, timeout: 60000 }, async () => {
  const page = await openPage(ctx, { viewport: VIEWPORTS['desktop-1440'], prefs: { showSamples: false }, route: '#/settings' });
  await seed(page, 'Round trip');
  const file = tmpFile('merge.json', await exportText(page));
  await page.evaluate(async () => {
    const m = await import('/src/store/events.js');
    const ev = m.getEvents(new Date().toISOString().slice(0, 10)).find((e) => e.userEvent);
    await m.removeEvent(ev.seriesId);
  });
  assert.deepEqual(await titles(page), []);
  await pickFile(page, file);
  await page.waitForSelector('dialog[open] .bk-plan');
  assert.match(await page.$eval('.bk-plan', (e) => e.textContent), /New: 1/);
  await page.evaluate(() => [...document.querySelectorAll('dialog .btn')].find((b) => b.textContent === 'Import').click());
  await page.waitForFunction(() => /Imported: 1 new/.test(document.querySelector('.toast-host')?.textContent || ''), { timeout: 5000 });
  assert.deepEqual(await titles(page), ['Round trip']);
  await pickFile(page, file);
  await page.waitForSelector('dialog[open] .bk-plan');
  assert.match(await page.$eval('.bk-plan', (e) => e.textContent), /New: 0 · Updated: 0 · Already up to date: 1/);
  await page.close();
});

test('replace needs the typed word, downloads nothing destructive first and then matches the file', { skip, timeout: 60000 }, async () => {
  const page = await openPage(ctx, { viewport: VIEWPORTS['desktop-1440'], prefs: { showSamples: false }, route: '#/settings' });
  await seed(page, 'In file');
  const file = tmpFile('replace.json', await exportText(page));
  await seed(page, 'Not in file');
  assert.equal((await titles(page)).length, 2);
  await pickFile(page, file);
  await page.waitForSelector('dialog[open] .bk-modes');
  await page.click('input[name=bk-mode][value=replace]');
  const importDisabled = () => page.evaluate(() => [...document.querySelectorAll('dialog .btn')].find((b) => b.textContent === 'Import').disabled);
  assert.equal(await importDisabled(), true, 'disabled until the word is typed');
  assert.match(await page.$eval('.bk-plan', (e) => e.textContent), /Removed from this device: 1/);
  await page.type('#bk-confirm', 'replac');
  assert.equal(await importDisabled(), true);
  await page.type('#bk-confirm', 'e');
  assert.equal(await importDisabled(), false);
  await page.evaluate(() => [...document.querySelectorAll('dialog .btn')].find((b) => b.textContent === 'Import').click());
  await page.waitForFunction(() => /Restored\. Events: 1/.test(document.querySelector('.toast-host')?.textContent || ''), { timeout: 8000 });
  assert.deepEqual(await titles(page), ['In file']);
  await page.close();
});

test('bad files show a clear message and change nothing', { skip, timeout: 60000 }, async () => {
  const page = await openPage(ctx, { viewport: VIEWPORTS['desktop-1440'], prefs: { showSamples: false }, route: '#/settings' });
  await seed(page, 'Untouched');
  for (const [name, text, expect] of [
    ['a.json', 'hello', /could not be read/],
    ['b.json', '{"format":"other","version":1,"events":[]}', /not a Countly backup/],
    ['c.json', JSON.stringify({ format: 'countly-backup', version: 99, events: [] }), /newer version/],
  ]) {
    await pickFile(page, tmpFile(name, text));
    await page.waitForSelector('dialog[open] .confirm-body');
    assert.match(await page.$eval('dialog[open] .confirm-body', (e) => e.textContent), expect);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  }
  assert.deepEqual(await titles(page), ['Untouched']);
  await page.close();
});

test('import dialog works in Macedonian, on mobile, with keyboard focus inside the dialog', { skip, timeout: 60000 }, async () => {
  const page = await openPage(ctx, { viewport: VIEWPORTS['mobile-390'], prefs: { showSamples: false, lang: 'mk' }, route: '#/settings' });
  await seed(page, 'Тест');
  await pickFile(page, tmpFile('mk.json', await exportText(page)), 'Увези');
  await page.waitForSelector('dialog[open] .bk-plan');
  assert.match(await page.$eval('dialog[open]', (e) => e.textContent), /Спој со моите податоци/);
  assert.ok(await page.evaluate(() => document.querySelector('dialog').contains(document.activeElement)), 'focus is inside the dialog');
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
  assert.ok(m.sw <= m.iw, JSON.stringify(m));
  await page.close();
});
