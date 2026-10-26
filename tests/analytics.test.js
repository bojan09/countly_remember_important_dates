import test from 'node:test';
import assert from 'node:assert/strict';
import { monthlyCounts, dayCounts, categoryCounts, busiest, daysInYear, yearProgress, doneStats, heatLevel, heatGrid } from '../src/events/analytics.js';

const occ = (date, category = 'personal') => ({ date, category });

test('analytics: monthlyCounts buckets by month and ignores other years', () => {
  const m = monthlyCounts([occ('2026-01-05'), occ('2026-01-30'), occ('2026-12-31'), occ('2025-01-01')], 2026);
  assert.equal(m.length, 12);
  assert.deepEqual([m[0], m[11], m.slice(1, 11).reduce((a, b) => a + b, 0)], [2, 1, 0]);
});

test('analytics: dayCounts and categoryCounts tally occurrences', () => {
  const list = [occ('2026-03-01', 'travel'), occ('2026-03-01', 'health'), occ('2026-03-02', 'travel')];
  assert.equal(dayCounts(list).get('2026-03-01'), 2);
  assert.equal(categoryCounts(list).get('travel'), 2);
});

test('analytics: busiest picks the highest count, ties go to the earliest key, empty is null', () => {
  assert.deepEqual(busiest(new Map([['b', 2], ['a', 2], ['c', 1]])), { key: 'a', count: 2 });
  assert.equal(busiest(new Map()), null);
});

test('analytics: year length and progress handle leap years', () => {
  assert.equal(daysInYear(2028), 366);
  assert.equal(daysInYear(2027), 365);
  assert.deepEqual(yearProgress('2028-01-01'), { year: 2028, passed: 0, total: 366, percent: 0 });
  assert.equal(yearProgress('2027-07-02').percent, 50);
});

test('analytics: doneStats counts only occurrences before today', () => {
  const list = [occ('2026-01-01'), occ('2026-06-01'), occ('2026-10-26'), occ('2026-12-01')];
  assert.deepEqual(doneStats(list, '2026-10-26'), { done: 2, total: 4, percent: 50 });
  assert.deepEqual(doneStats([], '2026-10-26'), { done: 0, total: 0, percent: 0 });
});

test('analytics: heatLevel buckets 0 to 4', () => {
  assert.deepEqual([heatLevel(0, 5), heatLevel(1, 5), heatLevel(3, 5), heatLevel(5, 5), heatLevel(2, 0)], [0, 1, 3, 4, 0]);
});

test('analytics: heatGrid covers every day of the year exactly once, for both week starts', () => {
  for (const year of [2026, 2027, 2028]) {
    for (const weekStart of [0, 1]) {
      const g = heatGrid(year, weekStart);
      const days = g.columns.flat().filter(Boolean);
      assert.equal(days.length, daysInYear(year));
      assert.equal(new Set(days).size, days.length);
      assert.equal(days[0], `${year}-01-01`);
      assert.equal(days.at(-1), `${year}-12-31`);
      assert.ok(g.columns.every((c) => c.length === 7));
      assert.equal(g.monthStarts.size, 12);
    }
  }
});
