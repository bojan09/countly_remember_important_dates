import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSampleEvents, eventTitle } from '../src/store/demo.js';
import { upcoming, thisMonth, past, featuredEvent, nextEvent, countByCategory, countByMonth } from '../src/events/select.js';
import { progress, parseISODate } from '../src/date/calendar.js';
import { loadPrefs, setPref, getPrefs, resolveTheme, DEFAULT_PREFS, ACCENTS } from '../src/store/prefs.js';
import { setLang } from '../src/i18n/index.js';

for (const today of ['2026-01-01', '2026-02-28', '2026-10-26', '2026-12-31', '2028-02-29']) {
  test(`sample events are truthful relative to ${today}`, () => {
    const ev = buildSampleEvents(today);
    assert.equal(upcoming(ev, today).length, 17);
    assert.equal(past(ev, today).length, 26);
    assert.equal(new Set(ev.map((e) => e.id)).size, ev.length, 'unique ids');
    assert.ok(ev.every((e) => e.sample === true), 'every sample is flagged');
    assert.ok(ev.every((e) => parseISODate(e.date)), 'valid dates');
    const month = thisMonth(ev, today);
    assert.ok(month.every((e) => e.date >= today && e.date.slice(0, 7) === today.slice(0, 7)));
    const vacation = ev.find((e) => e.id === 'sample-vacation');
    assert.equal(featuredEvent(ev, today).id, 'sample-vacation', 'pinned event is the hero');
    assert.notEqual(nextEvent(ev, today).id, 'sample-vacation');
    assert.deepEqual(progress(vacation.start, vacation.date, today), { total: 119, elapsed: 77, remaining: 42, percent: 65 });
  });
}

test('titles resolve through i18n and fall back to stored title', () => {
  setLang('en', { silent: true });
  assert.equal(eventTitle({ titleKey: 'demo.vacation' }), 'Summer Vacation');
  assert.equal(eventTitle({ title: 'My own <b>event</b>' }), 'My own <b>event</b>');
  setLang('mk', { silent: true });
  assert.equal(eventTitle({ titleKey: 'demo.vacation' }), 'Летен одмор');
  setLang('en', { silent: true });
});

test('category and month aggregates only count real data', () => {
  const ev = buildSampleEvents('2026-10-26');
  const byCat = countByCategory(ev);
  assert.equal([...byCat.values()].reduce((a, b) => a + b, 0), ev.length);
  const months = countByMonth(ev, 2026);
  assert.ok(months.reduce((a, b) => a + b, 0) <= ev.length);
  assert.equal(countByMonth([], 2026).every((n) => n === 0), true);
});

test('empty event list has no featured event', () => {
  assert.equal(featuredEvent([], '2026-10-26'), null);
  assert.equal(nextEvent([], '2026-10-26'), null);
});

test('preferences sanitize unknown and malformed values', () => {
  loadPrefs();
  setPref('theme', 'neon');
  setPref('accent', 'not-a-color');
  setPref('lang', 'de');
  setPref('name', 'x'.repeat(100));
  setPref('__proto__', 'x');
  const p = getPrefs();
  assert.equal(p.theme, DEFAULT_PREFS.theme);
  assert.equal(p.accent, DEFAULT_PREFS.accent);
  assert.equal(p.lang, 'en');
  assert.equal(p.name.length, 40);
  setPref('theme', 'light');
  assert.equal(getPrefs().theme, 'light');
  assert.equal(resolveTheme('light'), 'light');
  assert.equal(resolveTheme('dark'), 'dark');
  assert.equal(Object.keys(ACCENTS).length, 7);
});
