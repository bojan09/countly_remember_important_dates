import test from 'node:test';
import assert from 'node:assert/strict';
import { memoryAdapter } from '../src/store/db.js';
import { emptyForm, migrateRecord, validateEvent } from '../src/events/model.js';
import { milestonesFor, nextMilestone, anniversaryYears, shiftYears } from '../src/events/milestones.js';
import { parseBackup } from '../src/store/backup.js';
import { setLang, t } from '../src/i18n/index.js';
import { milestoneLabel } from '../src/components/milestone.js';

const TODAY = '2026-10-26';
const ids = (list) => list.map((m) => m.id);
const OLD = Date.UTC(2020, 0, 1);

test('milestones: an upcoming event gets every "to go" marker, sorted, with the right dates and states', () => {
  const list = milestonesFor({ date: '2028-01-01', createdAt: OLD }, TODAY);
  assert.deepEqual(ids(list), ['togo-1y', 'togo-100', 'togo-30', 'togo-7', 'togo-1']);
  assert.deepEqual(list.map((m) => m.date), ['2027-01-01', '2027-09-23', '2027-12-02', '2027-12-25', '2027-12-31']);
  assert.ok(list.every((m) => m.state === 'upcoming' && m.away > 0));
});

test('milestones: markers that fell before the event existed or started are left out', () => {
  const created = Date.UTC(2026, 9, 26, 12); // today, local noon-ish
  const soon = milestonesFor({ date: '2026-12-05', createdAt: created }, TODAY); // 40 days away
  assert.deepEqual(ids(soon), ['togo-30', 'togo-7', 'togo-1']);
  const started = milestonesFor({ date: '2027-06-01', start: '2027-03-01', createdAt: OLD }, TODAY);
  assert.deepEqual(ids(started), ['togo-30', 'togo-7', 'togo-1']);
});

test('milestones: states move from upcoming to today to passed as days go by', () => {
  const ev = { date: '2026-11-02', createdAt: OLD };
  assert.equal(milestonesFor(ev, '2026-10-26').find((m) => m.id === 'togo-7').state, 'today');
  assert.equal(nextMilestone(ev, '2026-10-26').id, 'togo-7');
  assert.equal(milestonesFor(ev, '2026-10-27').find((m) => m.id === 'togo-7').state, 'passed');
  assert.equal(nextMilestone(ev, '2026-10-27').id, 'togo-1');
  assert.equal(nextMilestone(ev, '2026-11-01').id, 'togo-1', 'the day before is still ahead');
});

test('milestones: a past event gets "since" markers; yearly series skip the year markers', () => {
  const past = milestonesFor({ date: '2025-10-26', createdAt: OLD }, TODAY);
  assert.deepEqual(ids(past), ['since-7', 'since-30', 'since-100', 'since-1y', 'since-2y', 'since-5y', 'since-10y']);
  assert.equal(past.find((m) => m.id === 'since-1y').state, 'today');
  assert.equal(nextMilestone({ date: '2025-10-26', createdAt: OLD }, TODAY).id, 'since-1y');
  const yearly = milestonesFor({ date: '2026-06-01', recurring: true, createdAt: OLD }, TODAY);
  assert.deepEqual(ids(yearly), ['since-7', 'since-30', 'since-100']);
  assert.equal(nextMilestone({ date: '2020-01-01', createdAt: OLD }, TODAY).id, 'since-10y');
  assert.equal(nextMilestone({ date: '2000-01-01', createdAt: OLD }, TODAY), null);
});

test('milestones: switched off, invalid or missing data yields nothing', () => {
  assert.deepEqual(milestonesFor({ date: '2028-01-01', milestones: false }, TODAY), []);
  assert.deepEqual(milestonesFor({ date: 'nope' }, TODAY), []);
  assert.deepEqual(milestonesFor(null, TODAY), []);
  assert.equal(nextMilestone(null, TODAY), null);
});

test('milestones: leap days use Feb 28 in non-leap years and Feb 29 in leap years', () => {
  assert.equal(shiftYears('2028-02-29', -1), '2027-02-28');
  assert.equal(shiftYears('2024-02-29', 1), '2025-02-28');
  assert.equal(shiftYears('2024-02-29', 4), '2028-02-29');
  assert.equal(shiftYears('2026-03-31', -1), '2025-03-31');
});

test('milestones: anniversary counts years for yearly series only', () => {
  const base = { recurring: true, recurrence: { freq: 'yearly' }, origin: '1990-06-15' };
  assert.equal(anniversaryYears({ ...base, date: '2027-06-15' }), 37);
  assert.equal(anniversaryYears({ ...base, date: '1990-06-15' }), 0);
  assert.equal(anniversaryYears({ ...base, recurrence: { freq: 'monthly' }, date: '2027-06-15' }), 0);
  assert.equal(anniversaryYears({ date: '2027-06-15' }), 0);
});

test('milestones: the switch defaults on, is validated, migrated, stored and backed up', async () => {
  assert.equal(emptyForm(TODAY).milestones, true);
  assert.equal(validateEvent({ ...emptyForm(TODAY), title: 'x', milestones: false }).value.milestones, false);
  assert.equal(validateEvent({ ...emptyForm(TODAY), title: 'x', milestones: 'no' }).value.milestones, true, 'only an explicit false turns it off');
  assert.equal(migrateRecord({ id: 'a', date: '2026-01-01' }).milestones, true, 'records from before this phase keep milestones on');
  assert.equal(migrateRecord({ id: 'a', date: '2026-01-01', milestones: false }).milestones, false);

  const a = await import(`../src/store/events.js?${Math.random()}`);
  await a.initStore({ adapter: memoryAdapter(), broadcast: false });
  const { event } = await a.saveEvent({ ...emptyForm(TODAY), title: 'Quiet', date: '2027-01-01', milestones: false });
  assert.equal(a.getEvent(event.id, TODAY).milestones, false);
  const dup = await a.duplicateEvent(a.getEvent(event.id, TODAY));
  assert.equal(dup.milestones, false, 'a copy keeps the setting');
  const b = await import(`../src/store/events.js?${Math.random()}`);
  await b.initStore({ adapter: memoryAdapter(), broadcast: false });
  await b.importBackup(parseBackup((await a.exportBackup({})).text), 'merge');
  assert.equal(b.getEvent(event.id, TODAY).milestones, false);
});

test('milestones: labels read naturally in English and Macedonian', () => {
  setLang('en', { silent: true });
  const label = (m) => milestoneLabel(m);
  assert.deepEqual([{ kind: 'togo', years: 1 }, { kind: 'togo', days: 100 }, { kind: 'togo', days: 7 }, { kind: 'togo', days: 1 }, { kind: 'since', years: 1 }, { kind: 'since', years: 5 }, { kind: 'since', days: 30 }].map(label), ['1 year to go', '100 days to go', '1 week to go', 'Tomorrow', '1 year since', '5 years since', '30 days since']);
  setLang('mk', { silent: true });
  assert.deepEqual([{ kind: 'togo', days: 100 }, { kind: 'since', years: 1 }, { kind: 'since', years: 21 }, { kind: 'since', years: 5 }].map(label), ['Уште 100 дена', 'Помина 1 година', 'Помина 21 година', 'Поминаа 5 години']);
  setLang('en', { silent: true });
  assert.equal(t('milestones.today'), 'Today');
});
