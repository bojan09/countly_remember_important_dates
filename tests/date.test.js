import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { diffDays, addDays, monthGrid, shiftMonth, countdown, progress, parseISODate, weekdayOf, daysInMonth, todayISO } from '../src/date/calendar.js';
import { ROOT } from './helpers.mjs';

test('parseISODate rejects impossible dates', () => {
  assert.equal(parseISODate('2026-02-30'), null);
  assert.equal(parseISODate('2026-13-01'), null);
  assert.equal(parseISODate('nope'), null);
  assert.deepEqual(parseISODate('2028-02-29'), { y: 2028, m: 2, d: 29 });
  assert.equal(parseISODate('2027-02-29'), null);
});

test('diffDays counts calendar days across DST changes', () => {
  assert.equal(diffDays('2026-03-07', '2026-03-09'), 2); // US spring forward
  assert.equal(diffDays('2026-03-28', '2026-03-30'), 2); // EU spring forward
  assert.equal(diffDays('2026-10-24', '2026-10-26'), 2); // EU fall back
  assert.equal(diffDays('2026-11-01', '2026-11-02'), 1); // US fall back
  assert.equal(diffDays('2026-10-26', '2026-10-26'), 0);
  assert.equal(diffDays('2026-12-07', '2026-10-26'), -42);
});

test('diffDays is identical under different process timezones', () => {
  const code = "import('./src/date/calendar.js').then(m=>console.log(m.diffDays('2026-03-07','2026-03-09')+','+m.diffDays('2026-10-24','2026-10-26')))";
  for (const tz of ['UTC', 'America/New_York', 'Europe/Skopje', 'Pacific/Auckland']) {
    const r = spawnSync(process.execPath, ['-e', code], { cwd: ROOT, env: { ...process.env, TZ: tz }, encoding: 'utf8' });
    assert.equal(r.stdout.trim(), '2,2', `TZ=${tz}: ${r.stderr}`);
  }
});

test('addDays handles month ends and leap years', () => {
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addDays('2027-02-28', 1), '2027-03-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(daysInMonth(2028, 2), 29);
  assert.equal(daysInMonth(2100, 2), 28);
});

test('monthGrid is 6 weeks, starts on the requested weekday and covers the month', () => {
  const g = monthGrid(2026, 10, 1);
  assert.equal(g.length, 42);
  assert.equal(weekdayOf(g[0].iso), 1); // Monday
  assert.equal(g[0].iso, '2026-09-28');
  assert.equal(g.filter((c) => c.inMonth).length, 31);
  assert.equal(weekdayOf(monthGrid(2026, 10, 0)[0].iso), 0);
});

test('shiftMonth wraps years in both directions', () => {
  assert.deepEqual(shiftMonth({ y: 2026, m: 12 }, 1), { y: 2027, m: 1 });
  assert.deepEqual(shiftMonth({ y: 2026, m: 1 }, -1), { y: 2025, m: 12 });
  assert.deepEqual(shiftMonth({ y: 2026, m: 5 }, 14), { y: 2027, m: 7 });
});

test('countdown states', () => {
  assert.deepEqual(countdown('2026-10-26', '2026-10-26'), { state: 'today', days: 0 });
  assert.deepEqual(countdown('2026-10-31', '2026-10-26'), { state: 'upcoming', days: 5 });
  assert.deepEqual(countdown('2026-10-20', '2026-10-26'), { state: 'past', days: 6 });
  assert.equal(countdown('bad', '2026-10-26').state, 'invalid');
});

test('progress never invents a percentage', () => {
  assert.equal(progress(null, '2026-12-07', '2026-10-26'), null);
  assert.equal(progress('2026-12-07', '2026-12-07', '2026-10-26'), null); // zero-length span
  assert.equal(progress('2026-12-10', '2026-12-07', '2026-10-26'), null); // start after target
  assert.deepEqual(progress('2026-08-10', '2026-12-07', '2026-10-26'), { total: 119, elapsed: 77, remaining: 42, percent: 65 });
});

test('progress clamps before start and after target', () => {
  assert.equal(progress('2026-11-01', '2026-12-01', '2026-10-01').percent, 0);
  assert.equal(progress('2026-09-01', '2026-10-01', '2026-12-01').percent, 100);
});

test('todayISO uses local calendar components', () => {
  assert.equal(todayISO(new Date(2026, 0, 5, 23, 59, 59)), '2026-01-05');
  assert.equal(todayISO(new Date(2026, 11, 31, 0, 0, 0)), '2026-12-31');
});

test('timeLeft: days/hours/minutes to local midnight, null when passed', async () => {
  const { timeLeft } = await import('../src/date/calendar.js');
  assert.deepEqual(timeLeft('2026-10-29', new Date(2026, 9, 26, 9, 30)), { d: 2, h: 14, m: 30, s: 0 });
  assert.deepEqual(timeLeft('2026-10-27', new Date(2026, 9, 26, 23, 59)), { d: 0, h: 0, m: 1, s: 0 });
  assert.equal(timeLeft('2026-10-26', new Date(2026, 9, 26, 0, 0, 1)), null);
  assert.equal(timeLeft('nope'), null);
});
