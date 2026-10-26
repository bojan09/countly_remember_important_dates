import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { occurrenceAt, nextOccurrence, prevOccurrence, lastOnOrBefore, occurrencesBetween, nextActive, prevActive, normalizeRule } from '../src/date/recurrence.js';
import { zonedToUtc, eventInstantMs, splitDuration, isValidTimeZone, zoneOffsetMs } from '../src/date/instant.js';
import { ROOT } from './helpers.mjs';

const yearly = { freq: 'yearly', interval: 1 };
const monthly = { freq: 'monthly', interval: 1 };

test('rules normalize: bad freq, interval and until are repaired', () => {
  assert.deepEqual(normalizeRule(null), { freq: 'none', interval: 1, until: null });
  assert.deepEqual(normalizeRule({ freq: 'hourly', interval: 3 }), { freq: 'none', interval: 3, until: null });
  assert.equal(normalizeRule({ freq: 'weekly', interval: -4 }).interval, 1);
  assert.equal(normalizeRule({ freq: 'weekly', interval: 99999 }).interval, 999);
  assert.equal(normalizeRule({ freq: 'weekly', until: '2026-02-30' }).until, null);
});

test('yearly: same month/day every year', () => {
  assert.equal(nextOccurrence(yearly, '1990-06-15', '2026-10-26'), '2027-06-15');
  assert.equal(nextOccurrence(yearly, '1990-06-15', '2026-06-15'), '2026-06-15');
  assert.equal(prevOccurrence(yearly, '1990-06-15', '2026-06-15'), '2025-06-15');
});

test('Feb 29 policy: leap years keep Feb 29, other years use Feb 28', () => {
  assert.equal(occurrenceAt(yearly, '2020-02-29', 1), '2021-02-28');
  assert.equal(occurrenceAt(yearly, '2020-02-29', 4), '2024-02-29');
  assert.equal(nextOccurrence(yearly, '2020-02-29', '2026-03-01'), '2027-02-28');
  assert.equal(nextOccurrence(yearly, '2020-02-29', '2027-03-01'), '2028-02-29');
  assert.equal(occurrenceAt({ freq: 'yearly', interval: 4 }, '2020-02-29', 3), '2032-02-29');
});

test('monthly month-end: clamps to the last day but never drifts', () => {
  const jan31 = '2026-01-31';
  assert.deepEqual([0, 1, 2, 3].map((k) => occurrenceAt(monthly, jan31, k)), ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  assert.equal(occurrenceAt(monthly, '2024-01-31', 1), '2024-02-29');
  assert.equal(occurrenceAt({ freq: 'monthly', interval: 3 }, '2026-11-30', 1), '2027-02-28');
  assert.equal(nextOccurrence(monthly, jan31, '2026-02-01'), '2026-02-28');
  assert.equal(nextOccurrence(monthly, jan31, '2026-03-01'), '2026-03-31');
});

test('weekly and daily step by calendar days across DST changes', () => {
  assert.equal(occurrenceAt({ freq: 'weekly', interval: 1 }, '2026-03-20', 1), '2026-03-27');
  assert.equal(occurrenceAt({ freq: 'weekly', interval: 2 }, '2026-03-20', 3), '2026-05-01');
  assert.equal(nextOccurrence({ freq: 'weekly', interval: 1 }, '2026-03-20', '2026-03-29'), '2026-04-03');
  assert.equal(nextOccurrence({ freq: 'daily', interval: 10 }, '2026-10-20', '2026-11-05'), '2026-11-09');
});

test('until ends the series and later lookups return null', () => {
  const rule = { freq: 'monthly', interval: 1, until: '2026-05-15' };
  assert.equal(nextOccurrence(rule, '2026-01-10', '2026-05-01'), '2026-05-10');
  assert.equal(nextOccurrence(rule, '2026-01-10', '2026-05-11'), null);
  assert.equal(prevOccurrence(rule, '2026-01-10', '2030-01-01'), '2026-05-10');
});

test('one-time series behaves like a single occurrence', () => {
  assert.equal(nextOccurrence({ freq: 'none' }, '2026-12-25', '2026-10-26'), '2026-12-25');
  assert.equal(nextOccurrence({ freq: 'none' }, '2026-12-25', '2026-12-26'), null);
  assert.equal(lastOnOrBefore({ freq: 'none' }, '2026-12-25', '2026-12-24'), null);
});

test('anchor in the future: nothing before it', () => {
  assert.equal(prevOccurrence(yearly, '2030-01-01', '2026-10-26'), null);
  assert.equal(nextOccurrence(yearly, '2030-01-01', '2026-10-26'), '2030-01-01');
});

test('next/prev are consistent with brute force for many anchors', () => {
  const anchors = ['2020-02-29', '2024-01-31', '2026-03-31', '2019-12-31', '2026-10-26', '2000-02-29'];
  const rules = [yearly, monthly, { freq: 'monthly', interval: 5 }, { freq: 'weekly', interval: 3 }, { freq: 'daily', interval: 17 }, { freq: 'yearly', interval: 4 }];
  const froms = ['2026-01-01', '2026-02-28', '2026-03-01', '2027-02-28', '2028-02-29', '2031-07-04'];
  for (const a of anchors) {
    for (const r of rules) {
      const all = [];
      for (let k = 0; k < 4000; k++) {
        const o = occurrenceAt(r, a, k);
        if (o > '2100-01-01') break;
        all.push(o);
      }
      for (const f of froms) {
        const expNext = all.find((d) => d >= f) || null;
        assert.equal(nextOccurrence(r, a, f), expNext, `next ${a} ${JSON.stringify(r)} from ${f}`);
        const expPrev = [...all].reverse().find((d) => d < f) || null;
        assert.equal(prevOccurrence(r, a, f), expPrev, `prev ${a} ${JSON.stringify(r)} before ${f}`);
      }
    }
  }
});

test('occurrencesBetween is bounded and inclusive', () => {
  assert.deepEqual(occurrencesBetween({ freq: 'weekly', interval: 1 }, '2026-10-26', '2026-10-26', '2026-11-16'), ['2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16']);
  assert.equal(occurrencesBetween({ freq: 'daily', interval: 1 }, '2000-01-01', '2000-01-01', '2100-01-01', 50).length, 50);
});

test('skipped occurrences are passed over in both directions', () => {
  const rule = { freq: 'monthly', interval: 1 };
  assert.equal(nextActive(rule, '2026-01-10', '2026-10-01', ['2026-10-10']), '2026-11-10');
  assert.equal(prevActive(rule, '2026-01-10', '2026-11-01', ['2026-10-10']), '2026-09-10');
  assert.equal(nextActive(rule, '2026-01-10', '2026-10-01', []), '2026-10-10');
});

test('recurrence results do not depend on the process time zone', () => {
  const code = `import {nextOccurrence,prevOccurrence} from './src/date/recurrence.js';
    console.log(JSON.stringify([nextOccurrence({freq:'monthly',interval:1},'2026-01-31','2026-03-01'),prevOccurrence({freq:'yearly',interval:1},'2020-02-29','2027-01-01'),nextOccurrence({freq:'weekly',interval:1},'2026-03-20','2026-03-29')]))`;
  const outs = ['UTC', 'America/Los_Angeles', 'Pacific/Auckland', 'Europe/Skopje'].map((tz) => spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: ROOT, env: { ...process.env, TZ: tz }, encoding: 'utf8' }).stdout.trim());
  assert.equal(new Set(outs).size, 1, outs.join(' | '));
  assert.equal(outs[0], JSON.stringify(['2026-03-31', '2026-02-28', '2026-04-03']));
});

/* ---------------- instants ---------------- */
test('time zone validation', () => {
  assert.ok(isValidTimeZone('Europe/Skopje'));
  assert.ok(isValidTimeZone('America/New_York'));
  assert.ok(!isValidTimeZone('Mars/Olympus'));
  assert.ok(!isValidTimeZone(''));
});

test('zonedToUtc: fixed offsets and DST seasons', () => {
  assert.equal(new Date(zonedToUtc('2026-01-15', '12:00', 'America/New_York')).toISOString(), '2026-01-15T17:00:00.000Z'); // EST -5
  assert.equal(new Date(zonedToUtc('2026-07-15', '12:00', 'America/New_York')).toISOString(), '2026-07-15T16:00:00.000Z'); // EDT -4
  assert.equal(new Date(zonedToUtc('2026-07-15', '12:00', 'Europe/Skopje')).toISOString(), '2026-07-15T10:00:00.000Z'); // CEST +2
  assert.equal(new Date(zonedToUtc('2026-12-15', '12:00', 'Europe/Skopje')).toISOString(), '2026-12-15T11:00:00.000Z'); // CET +1
  assert.equal(new Date(zonedToUtc('2026-06-01', '09:30', 'Asia/Kolkata')).toISOString(), '2026-06-01T04:00:00.000Z'); // +5:30
  assert.equal(new Date(zonedToUtc('2026-06-01', '09:30', 'UTC')).toISOString(), '2026-06-01T09:30:00.000Z');
});

test('zonedToUtc: spring-forward gap and fall-back overlap resolve predictably', () => {
  // 2026-03-08 02:30 does not exist in New York (clocks jump 02:00 -> 03:00): lands after the gap.
  assert.equal(new Date(zonedToUtc('2026-03-08', '02:30', 'America/New_York')).toISOString(), '2026-03-08T07:30:00.000Z');
  // 2026-11-01 01:30 happens twice in New York: the earlier (EDT) instant is chosen.
  assert.equal(new Date(zonedToUtc('2026-11-01', '01:30', 'America/New_York')).toISOString(), '2026-11-01T05:30:00.000Z');
  assert.ok(Number.isNaN(zonedToUtc('2026-11-01', '25:00', 'UTC')));
  assert.equal(zoneOffsetMs(Date.UTC(2026, 6, 1), 'Europe/Skopje'), 2 * 3600e3);
});

test('eventInstantMs: all-day = local midnight, timed floating = local clock, zoned = absolute', () => {
  const allDay = eventInstantMs({ date: '2026-12-25', time: null, tz: null });
  assert.equal(allDay, new Date(2026, 11, 25, 0, 0, 0).getTime());
  assert.equal(eventInstantMs({ date: '2026-12-25', time: '19:30', tz: null }), new Date(2026, 11, 25, 19, 30).getTime());
  assert.equal(eventInstantMs({ date: '2026-12-25', time: '19:30', tz: 'UTC' }), Date.UTC(2026, 11, 25, 19, 30));
  assert.ok(Number.isNaN(eventInstantMs({ date: 'nope' })));
});

test('zoned instants are identical in every process time zone (travel-proof)', () => {
  const code = `import {eventInstantMs} from './src/date/instant.js'; console.log(eventInstantMs({date:'2026-07-04',time:'07:40',tz:'Europe/Skopje'}))`;
  const outs = ['UTC', 'America/Los_Angeles', 'Pacific/Auckland'].map((tz) => spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: ROOT, env: { ...process.env, TZ: tz }, encoding: 'utf8' }).stdout.trim());
  assert.equal(new Set(outs).size, 1);
  assert.equal(Number(outs[0]), Date.UTC(2026, 6, 4, 5, 40));
});

test('splitDuration floors and clamps', () => {
  assert.deepEqual(splitDuration(90061_999), { d: 1, h: 1, m: 1, s: 1 });
  assert.deepEqual(splitDuration(-500), { d: 0, h: 0, m: 0, s: 0 });
  assert.deepEqual(splitDuration(59_999), { d: 0, h: 0, m: 0, s: 59 });
});
