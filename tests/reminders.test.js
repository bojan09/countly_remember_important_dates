import test from 'node:test';
import assert from 'node:assert/strict';
import { memoryAdapter } from '../src/store/db.js';
import { emptyForm, validateEvent, migrateRecord } from '../src/events/model.js';
import { sanitizeReminders, optionsFor, fireAtMs, remindersBetween, upcomingReminders, anchorMs, MAX_REMINDERS } from '../src/events/reminders.js';
import { buildIcs, foldLine, escapeText, triggerFor, icsFilename, veventLines } from '../src/events/ics.js';
import { zonedToUtc } from '../src/date/instant.js';
import { parseBackup } from '../src/store/backup.js';

const allDay = { date: '2026-11-10', time: null };
const timed = { date: '2026-11-10', time: '14:30', tz: null };
const at = (y, m, d, hh = 0, mm = 0) => new Date(y, m - 1, d, hh, mm).getTime();

test('reminders: sanitize keeps known, distinct, applicable ids in canonical order', () => {
  assert.deepEqual(sanitizeReminders(['w1', 'd1', 'd1', 'bogus', 'atTime'], timed), ['atTime', 'd1', 'w1']);
  assert.deepEqual(sanitizeReminders(['h1', 'd1'], allDay), ['d1'], 'an hour-before reminder needs a clock time');
  assert.deepEqual(sanitizeReminders('d1', timed), []);
  assert.deepEqual(sanitizeReminders(null, timed), []);
  assert.ok(sanitizeReminders(['atTime', 'h1', 'd1', 'd2', 'w1'], timed).length <= MAX_REMINDERS);
  assert.deepEqual(optionsFor(allDay).map((o) => o.id), ['atTime', 'd1', 'd2', 'w1']);
});

test('reminders: all-day events fire at 09:00 local, timed ones relative to their clock time', () => {
  assert.equal(anchorMs(allDay, '2026-11-10'), at(2026, 11, 10, 9));
  assert.equal(fireAtMs(allDay, '2026-11-10', 'atTime'), at(2026, 11, 10, 9));
  assert.equal(fireAtMs(allDay, '2026-11-10', 'd1'), at(2026, 11, 9, 9));
  assert.equal(fireAtMs(allDay, '2026-11-10', 'w1'), at(2026, 11, 3, 9));
  assert.equal(fireAtMs(timed, '2026-11-10', 'atTime'), at(2026, 11, 10, 14, 30));
  assert.equal(fireAtMs(timed, '2026-11-10', 'h1'), at(2026, 11, 10, 13, 30));
  assert.equal(fireAtMs(timed, '2026-11-10', 'd2'), at(2026, 11, 8, 14, 30));
  assert.ok(Number.isNaN(fireAtMs(timed, '2026-11-10', 'nope')));
  assert.ok(Number.isNaN(fireAtMs(timed, 'bad', 'd1')));
});

test('reminders: a day-before reminder keeps the wall-clock time across a DST change', () => {
  // New York springs forward on 2026-03-08 at 02:00: "1 day before" a 09:00 event on the 8th is 09:00 on the 7th (23h earlier), not 08:00.
  const ev = { date: '2026-03-08', time: '09:00', tz: 'America/New_York' };
  assert.equal(fireAtMs(ev, ev.date, 'd1'), zonedToUtc('2026-03-07', '09:00', 'America/New_York'));
  assert.equal(fireAtMs(ev, ev.date, 'atTime') - fireAtMs(ev, ev.date, 'd1'), 23 * 3600000);
});

const item = (over) => ({ userEvent: true, archived: false, seriesId: 's1', date: '2026-11-10', time: null, reminders: ['d1', 'atTime'], ...over });

test('reminders: remindersBetween returns what fired in the window, sorted, once, ignoring samples and archived', () => {
  const items = [item(), item({ seriesId: 's2', reminders: ['d1'], archived: true }), item({ seriesId: 's3', userEvent: false, reminders: ['d1'] }), item({ seriesId: 's4', reminders: [] })];
  const due = remindersBetween(items, at(2026, 11, 9, 8), at(2026, 11, 10, 10));
  assert.deepEqual(due.map((d) => [d.key, d.id]), [['s1|2026-11-10|d1', 'd1'], ['s1|2026-11-10|atTime', 'atTime']]);
  assert.deepEqual(remindersBetween(items, at(2026, 11, 9, 9), at(2026, 11, 9, 9)), [], 'window is (from, to]: nothing at exactly the start');
  assert.equal(remindersBetween(items, at(2026, 11, 9, 8, 59), at(2026, 11, 9, 9)).length, 1, 'inclusive at the end');
  assert.equal(remindersBetween([item(), item()], 0, at(2030, 1, 1)).length, 2, 'duplicate items collapse');
});

test('reminders: upcomingReminders respects the horizon and limit', () => {
  const now = at(2026, 11, 1, 12);
  const items = [item({ seriesId: 'a', date: '2026-11-05' }), item({ seriesId: 'b', date: '2026-12-25' })];
  const up = upcomingReminders(items, now, { horizonDays: 14, limit: 3 });
  assert.equal(up.length, 2);
  assert.ok(up.every((u) => u.ev.seriesId === 'a'));
});

test('reminders: stored with the event, cleaned on save, kept by backups and never offered for hour-before on all-day', async () => {
  const f = { ...emptyForm('2026-10-26'), title: 'Dentist', date: '2026-11-10' };
  assert.deepEqual(validateEvent({ ...f, reminders: ['h1', 'd1', 'x'] }).value.reminders, ['d1']);
  assert.deepEqual(validateEvent({ ...f, time: '10:00', reminders: ['h1', 'd1'] }).value.reminders, ['h1', 'd1']);
  assert.deepEqual(migrateRecord({ id: 'a', date: '2026-01-01' }).reminders, []);
  const s = await import(`../src/store/events.js?${Math.random()}`);
  await s.initStore({ adapter: memoryAdapter(), broadcast: false });
  const { event } = await s.saveEvent({ ...f, time: '10:00', reminders: ['h1'] });
  assert.deepEqual(s.getEvent(event.id, '2026-10-26').reminders, ['h1']);
  await s.setReminders(event.id, ['d2', 'h1', 'zzz']);
  assert.deepEqual(s.getSeries(event.id).reminders, ['h1', 'd2']);
  await s.saveEvent({ ...f, time: null, reminders: ['h1', 'd2'] }, event.id);
  assert.deepEqual(s.getSeries(event.id).reminders, ['d2'], 'making it all-day drops the hour-before reminder');
  const b = await import(`../src/store/events.js?${Math.random()}`);
  await b.initStore({ adapter: memoryAdapter(), broadcast: false });
  await b.importBackup(parseBackup((await s.exportBackup({})).text), 'merge');
  assert.deepEqual(b.getSeries(event.id).reminders, ['d2']);
});

/* ---------------- .ics ---------------- */
const rec = (over = {}) => ({ id: 'ev-1', title: 'Mom’s birthday', date: '2026-11-10', time: null, tz: null, description: '', notes: '', location: '', recurrence: { freq: 'none', interval: 1, until: null }, skips: [], reminders: [], ...over });
const NOW = Date.UTC(2026, 9, 27, 12, 0, 0);
const unfold = (text) => text.replace(/\r\n /g, '');

test('ics: escapes text and folds long lines at 75 octets without splitting characters', () => {
  assert.equal(escapeText('a,b;c\\d\ne'), 'a\\,b\;c\\\\d\\ne');
  const long = `SUMMARY:${'Ж'.repeat(60)}`; // 2 bytes each
  const folded = foldLine(long);
  const physical = folded.split('\r\n');
  assert.ok(physical.length > 1);
  assert.ok(physical.every((l) => new TextEncoder().encode(l).length <= 75));
  assert.equal(physical.join('').replace(/ /g, ''), long.replace(/ /g, ''));
  assert.equal(foldLine('SHORT:1'), 'SHORT:1');
});

test('ics: an all-day event is a DATE with an exclusive end and CRLF framing', () => {
  const ics = buildIcs([rec({ description: 'Bring cake', location: 'Skopje, MK' })], { now: NOW });
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'));
  assert.ok(!/[^\r]\n/.test(ics), 'every newline is CRLF');
  const t = unfold(ics);
  assert.match(t, /DTSTART;VALUE=DATE:20261110\r\n/);
  assert.match(t, /DTEND;VALUE=DATE:20261111\r\n/);
  assert.match(t, /UID:ev-1@countly\.app/);
  assert.match(t, /DTSTAMP:20261027T120000Z/);
  assert.match(t, /SUMMARY:Mom’s birthday/);
  assert.match(t, /LOCATION:Skopje\\, MK/);
  assert.match(t, /DESCRIPTION:Bring cake/);
  assert.equal((t.match(/BEGIN:VEVENT/g) || []).length, 1);
});

test('ics: month-end all-day end date rolls over correctly', () => {
  assert.match(unfold(buildIcs([rec({ date: '2026-12-31' })], { now: NOW })), /DTEND;VALUE=DATE:20270101/);
});

test('ics: timed events are floating, zoned ones are UTC, both last an hour (crossing midnight too)', () => {
  assert.match(unfold(buildIcs([rec({ time: '14:30' })], { now: NOW })), /DTSTART:20261110T143000\r\nDTEND:20261110T153000/);
  assert.match(unfold(buildIcs([rec({ time: '23:30' })], { now: NOW })), /DTEND:20261111T003000/);
  const z = unfold(buildIcs([rec({ time: '09:00', tz: 'America/New_York' })], { now: NOW }));
  assert.match(z, /DTSTART:20261110T140000Z\r\nDTEND:20261110T150000Z/);
});

test('ics: recurrence, until and skipped occurrences', () => {
  const t = unfold(buildIcs([rec({ recurrence: { freq: 'weekly', interval: 2, until: '2027-01-31' }, skips: ['2026-11-24'] })], { now: NOW }));
  assert.match(t, /RRULE:FREQ=WEEKLY;INTERVAL=2;UNTIL=20270131\r\n/);
  assert.match(t, /EXDATE;VALUE=DATE:20261124/);
  const timedT = unfold(buildIcs([rec({ time: '10:00', recurrence: { freq: 'yearly', interval: 1, until: '2030-01-01' } , skips: ['2027-11-10']})], { now: NOW }));
  assert.match(timedT, /UNTIL=20300101T235900/);
  assert.match(timedT, /EXDATE:20271110T100000/);
});

test('ics: reminders become VALARMs with the right triggers', () => {
  assert.deepEqual(['atTime', 'h1', 'd1', 'd2', 'w1'].map((id) => triggerFor(id, true)), ['PT0S', '-PT1H', '-P1D', '-P2D', '-P7D']);
  assert.deepEqual(['atTime', 'd1', 'd2', 'w1'].map((id) => triggerFor(id, false)), ['PT9H', '-PT15H', '-PT39H', '-PT159H']);
  assert.equal(triggerFor('zzz', true), null);
  const t = unfold(buildIcs([rec({ reminders: ['d1', 'atTime'] })], { now: NOW }));
  assert.equal((t.match(/BEGIN:VALARM/g) || []).length, 2);
  assert.match(t, /TRIGGER;RELATED=START:-PT15H/);
  assert.match(t, /TRIGGER;RELATED=START:PT9H/);
  assert.equal((t.match(/END:VALARM/g) || []).length, 2);
});

test('ics: multiple events, invalid records skipped, balanced BEGIN/END', () => {
  const t = buildIcs([rec(), rec({ id: 'ev-2', title: 'Two' }), rec({ id: 'ev-3', date: 'nope' })], { now: NOW });
  assert.equal((t.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.equal((t.match(/BEGIN:/g) || []).length, (t.match(/END:/g) || []).length);
  assert.ok(veventLines(rec({ title: 'x' })).includes('END:VEVENT'));
});

test('ics: file names are safe', () => {
  assert.equal(icsFilename('Mom’s Birthday! 🎂'), 'moms-birthday.ics');
  assert.equal(icsFilename('../../etc/passwd'), 'etcpasswd.ics');
  assert.equal(icsFilename('🎂'), 'countly.ics');
  assert.equal(icsFilename(''), 'countly.ics');
});
