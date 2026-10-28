// Automated accessibility audit (axe-core, WCAG 2.0/2.1 A+AA and best practices) across every
// route and dialog, in both themes and on a phone and a desktop viewport.
// axe finds roughly a third of real accessibility problems; keyboard, screen-reader and zoom
// checks are covered separately (e2e.test.js, e2e.polish.test.js) and by manual review notes in docs.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { launch, openPage, VIEWPORTS, findBrowser } from '../tools/browser.mjs';
import { todayISO, addDays } from '../src/date/calendar.js';

const hasBrowser = !!findBrowser();
const skip = hasBrowser ? false : 'no Chromium-family browser found (set CHROME_PATH)';
const axeSource = hasBrowser ? readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8') : '';
let ctx;
before(async () => {
  if (hasBrowser) ctx = await launch();
});
after(async () => {
  if (ctx) await ctx.close();
});

const settle = (ms = 700) => new Promise((r) => setTimeout(r, ms)); // dialog/route animations must finish before contrast is measured

async function violations(page) {
  await page.evaluate(axeSource);
  return page.evaluate(async () => {
    const res = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] }, resultTypes: ['violations'] });
    return res.violations.map((v) => `${v.id} (${v.impact}) ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')} — ${(v.nodes[0].failureSummary || '').split('\n')[1] || ''}`);
  });
}

const COMBOS = [
  ['dark', 'mobile-390'],
  ['light', 'mobile-390'],
  ['dark', 'desktop-1440'],
  ['light', 'desktop-1440'],
];

for (const [scheme, vp] of COMBOS) {
  test(`axe: no violations on any route or dialog (${scheme}, ${vp})`, { skip, timeout: 280000 }, async () => {
    const page = await openPage(ctx, { viewport: VIEWPORTS[vp], prefs: { showSamples: true }, colorScheme: scheme, route: '#/', bypassCsp: true });
    const found = [];
    const check = async (label) => {
      await settle();
      for (const v of await violations(page)) found.push(`[${label}] ${v}`);
    };
    const go = (hash) => page.evaluate((h) => (location.hash = h), hash);
    const click = (sel, text) => page.evaluate((s, t) => { const el = [...document.querySelectorAll(s)].find((e) => !t || e.textContent.includes(t)); if (!el) throw new Error(`missing ${s} ${t || ''}`); el.click(); }, sel, text);
    const closeDialog = async () => { await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('dialog[open]')); };

    const id = await page.evaluate(async (date) => {
      const m = await import('/src/store/events.js');
      const cat = (await m.saveCategory({ name: 'Hiking', color: '#6fcf6f', icon: 'mapPin', scene: 'mountain' })).category;
      const ev = (await m.saveEvent({ title: 'Mine', date, time: '10:00', category: cat.id, recurrence: { freq: 'yearly', interval: 1, until: null }, reminders: ['d1'], notes: 'Notes here' })).event;
      await m.setReflection(ev.id, ev.date, 'A memory');
      return ev.id;
    }, addDays(todayISO(), 9));

    for (const hash of ['#/', '#/timeline', '#/categories', '#/memories', '#/settings', '#/new', `#/edit/${encodeURIComponent(id)}`, '#/event/not-there']) {
      await go(hash);
      await check(hash);
    }
    for (const view of ['month', 'week', 'day', 'agenda']) {
      await go(`#/calendar?view=${view}`);
      await check(`calendar ${view}`);
    }
    await go('#/stats');
    await page.waitForSelector('.stats');
    await check('stats overview');
    for (const tab of ['Categories', 'Calendar']) {
      await click('.stats button', tab);
      await check(`stats ${tab}`);
    }
    await go(`#/event/${encodeURIComponent(id)}`);
    await page.waitForSelector('.d-title');
    await check('event detail');
    for (const [label, sel, wait] of [['reminder dialog', '.d-act-btn[aria-label="Reminder"]', 'dialog[open] .rm-opts'], ['share dialog', '.d-act-btn[aria-label="Share"]', '.ss-canvas[data-ready="1"]'], ['more dialog', '.d-act-btn[aria-label="More"]', 'dialog[open]']]) {
      await click(sel);
      await page.waitForSelector(wait);
      await check(label);
      await closeDialog();
    }
    await go('#/categories');
    await page.waitForSelector('#cm-new');
    await click('#cm-new');
    await page.waitForSelector('dialog[open] #cm-name');
    await check('category form');
    await closeDialog();
    await go('#/settings');
    await page.waitForSelector('.rows .row');
    for (const row of ['Notifications', 'PWA', 'About']) {
      await click('.rows .row', row);
      await page.waitForSelector('dialog[open]');
      await check(`settings ${row}`);
      await closeDialog();
    }
    await click('[data-bell]');
    await page.waitForSelector('dialog[open]');
    await check('bell dialog');
    await closeDialog();
    if (vp.startsWith('desktop')) {
      for (const label of ['Calendar', 'Timeline', 'Explore', 'Preferences']) {
        const opened = await page.evaluate((l) => { const b = [...document.querySelectorAll('.topnav [aria-haspopup]')].find((x) => x.textContent.includes(l) || (x.getAttribute('aria-label') || '').includes(l)); if (!b) return false; b.click(); return true; }, label);
        if (!opened) continue;
        await page.waitForSelector('.topnav [aria-expanded="true"]');
        await check(`nav menu ${label}`);
        await page.keyboard.press('Escape');
      }
    }
    await go('#/new');
    await page.waitForSelector('#f-title');
    await click('form button[type=submit]');
    await page.waitForSelector('.field-error, .form-summary:not([hidden])');
    await check('form with errors');
    assert.deepEqual(found, [], `${found.length} accessibility violation(s)`);
    await page.close();
  });
}
