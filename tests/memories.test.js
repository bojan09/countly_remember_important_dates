import test from 'node:test';
import assert from 'node:assert/strict';
import { memoryAdapter } from '../src/store/db.js';
import { emptyForm, migrateRecord, LIMITS } from '../src/events/model.js';
import { fitWithin } from '../src/components/photos.js';
import { parseBackup } from '../src/store/backup.js';

const form = (over = {}) => ({ ...emptyForm('2026-10-26'), title: 'Trip', date: '2026-10-01', ...over });
async function freshStore() {
  const s = await import(`../src/store/events.js?${Math.random()}`);
  await s.initStore({ adapter: memoryAdapter(), broadcast: false });
  return s;
}
const TODAY = '2026-10-26';

test('photos: fitWithin scales down to the longest edge and never enlarges', () => {
  assert.deepEqual(fitWithin(4000, 2000, 1600), { width: 1600, height: 800, scale: 0.4 });
  assert.deepEqual(fitWithin(1000, 3200, 1600), { width: 500, height: 1600, scale: 0.5 });
  assert.equal(fitWithin(800, 600, 1600).scale, 1);
  assert.deepEqual(fitWithin(1, 5000, 1600), { width: 1, height: 1600, scale: 0.32 });
});

test('reflection: saved per occurrence, trimmed, clamped and clearable', async () => {
  const s = await freshStore();
  const { event } = await s.saveEvent(form());
  await s.setReflection(event.id, event.date, `  ${'x'.repeat(700)}  `);
  assert.equal(s.getSeries(event.id).overrides[event.date].reflection.length, LIMITS.reflection);
  assert.equal(s.getEvent(event.id, TODAY).reflection.length, LIMITS.reflection);
  await s.setReflection(event.id, event.date, '   ');
  assert.deepEqual(s.getSeries(event.id).overrides, {}, 'an empty note removes the override entirely');
  assert.equal(await s.setReflection('missing', event.date, 'x'), null);
});

test('reflection: lives next to occurrence edits without being wiped or counted as one', async () => {
  const s = await freshStore();
  const { event } = await s.saveEvent(form({ recurrence: { freq: 'yearly', interval: 1, until: null } }));
  await s.setReflection(event.id, '2026-10-01', 'Great day');
  const item = () => s.getEvents(TODAY).find((e) => e.date === '2026-10-01');
  assert.equal(item().overridden, false, 'a note alone is not a customised occurrence');
  await s.setOverride(event.id, '2026-10-01', { title: 'Renamed', notes: 'n' });
  assert.equal(item().reflection, 'Great day');
  assert.equal(item().title, 'Renamed');
  await s.setOverride(event.id, '2026-10-01', null); // reset
  assert.equal(item().reflection, 'Great day', 'reset keeps the memory note');
  assert.equal(item().overridden, false);
  assert.equal(s.getEvents(TODAY).find((e) => e.date === '2027-10-01').reflection, '', 'other occurrences have no note');
});

test('reflection: a one-time event keeps its note when only the date changes', async () => {
  const s = await freshStore();
  const { event } = await s.saveEvent(form());
  await s.setReflection(event.id, event.date, 'Keep me');
  await s.saveEvent(form({ date: '2026-10-02' }), event.id);
  assert.equal(s.getEvent(event.id, TODAY).reflection, 'Keep me');
  await s.saveEvent(form({ date: '2026-10-02', recurrence: { freq: 'yearly', interval: 1, until: null } }), event.id);
  assert.equal(s.getSeries(event.id).overrides['2026-10-02'], undefined, 'turning it into a series resets occurrence data');
});

test('reflection: stored and imported records are clamped, and survive a backup round trip', async () => {
  const m = migrateRecord({ id: 'a', date: '2026-01-01', overrides: { '2026-01-01': { reflection: ` ${'y'.repeat(900)} `, junk: 1 }, '2026-01-02': { reflection: '   ' } } });
  assert.equal(m.overrides['2026-01-01'].reflection.length, LIMITS.reflection);
  assert.equal(m.overrides['2026-01-02'], undefined);
  const a = await freshStore();
  const { event } = await a.saveEvent(form());
  await a.setReflection(event.id, event.date, 'Remember this');
  const b = await freshStore();
  await b.importBackup(parseBackup((await a.exportBackup({})).text), 'merge');
  assert.equal(b.getEvent(event.id, TODAY).reflection, 'Remember this');
});

test('photos: only the formats the backup can carry are accepted', async () => {
  const s = await freshStore();
  const { event } = await s.saveEvent(form());
  for (const type of ['image/svg+xml', 'image/heic', 'image/tiff', 'text/html']) await assert.rejects(s.addPhoto(event.id, { type, size: 5, name: 'x' }), /photoType/, type);
  for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']) await s.addPhoto(event.id, { type, size: 5, name: `p.${type.slice(6)}` });
  assert.equal(s.listPhotos(event.id).length, 5);
});
