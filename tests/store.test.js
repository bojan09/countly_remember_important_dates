import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEvent, migrateRecord, emptyForm, SCENE_IDS, SCHEMA } from '../src/events/model.js';
import { memoryAdapter, MIGRATIONS, DB_VERSION } from '../src/store/db.js';
import { SCENE_KINDS } from '../src/scenes/art.js';

const TODAY = '2026-10-26';
const good = (over = {}) => ({ ...emptyForm(TODAY), title: 'Anniversary', date: '2026-12-01', ...over });

/* ---------------- validation ---------------- */
test('scene list in the model matches the drawn scenes', () => {
  assert.deepEqual([...SCENE_IDS].sort(), [...SCENE_KINDS].sort());
});

test('valid events pass and are cleaned', () => {
  const r = validateEvent(good({ title: '  Mom’s birthday  ', location: ' Skopje ', notes: 'hi' }));
  assert.ok(r.ok, JSON.stringify(r.errors));
  assert.equal(r.value.title, 'Mom’s birthday');
  assert.equal(r.value.location, 'Skopje');
  assert.deepEqual(r.value.recurrence, { freq: 'none', interval: 1, until: null });
});

test('required fields and ranges report i18n codes', () => {
  assert.equal(validateEvent(good({ title: '   ' })).errors.title, 'titleRequired');
  assert.equal(validateEvent(good({ title: 'x'.repeat(81) })).errors.title, 'titleTooLong');
  assert.equal(validateEvent(good({ date: '' })).errors.date, 'dateRequired');
  assert.equal(validateEvent(good({ date: '2026-02-30' })).errors.date, 'dateInvalid');
  assert.equal(validateEvent(good({ start: '2027-01-01' })).errors.start, 'startAfterDate');
  assert.equal(validateEvent(good({ time: '25:61' })).errors.time, 'timeInvalid');
  assert.equal(validateEvent(good({ time: '10:00', tz: 'Mars/Base' })).errors.tz, 'tzInvalid');
  assert.equal(validateEvent(good({ recurrence: { freq: 'weekly', interval: 0 } })).errors.interval, 'intervalInvalid');
  assert.equal(validateEvent(good({ recurrence: { freq: 'weekly', interval: 1.5 } })).errors.interval, 'intervalInvalid');
  assert.equal(validateEvent(good({ recurrence: { freq: 'weekly', interval: 1000 } })).errors.interval, 'intervalInvalid');
  assert.equal(validateEvent(good({ recurrence: { freq: 'yearly', interval: 1, until: '2026-01-01' } })).errors.until, 'untilBeforeDate');
  assert.equal(validateEvent(good({ notes: 'n'.repeat(5001) })).errors.notes, 'notesTooLong');
  assert.equal(validateEvent(good({ description: 'd'.repeat(201) })).errors.description, 'descriptionTooLong');
  assert.equal(validateEvent(good({ emoji: '🎂🎉🎈🎁🎀' })).errors.emoji, 'emojiTooLong');
  assert.equal(validateEvent(null).ok, false);
});

test('a zone without a time is dropped, unknown category/scene are repaired', () => {
  const r = validateEvent(good({ time: null, tz: 'Europe/Skopje', category: 'weird', scene: 'nope' }));
  assert.ok(r.ok);
  assert.equal(r.value.tz, null);
  assert.equal(r.value.category, 'other');
  assert.ok(SCENE_IDS.includes(r.value.scene));
  assert.deepEqual(validateEvent(good({ recurrence: { freq: 'none', interval: 9, until: '2030-01-01' } })).value.recurrence, { freq: 'none', interval: 1, until: null });
});

test('user text is kept as plain data (no HTML interpretation happens in the model)', () => {
  const r = validateEvent(good({ title: '<img src=x onerror=alert(1)>', notes: '<script>1</script>' }));
  assert.ok(r.ok);
  assert.equal(r.value.title, '<img src=x onerror=alert(1)>');
});

/* ---------------- migrations / repair ---------------- */
test('schema 0 records (repeat/favorite) are upgraded', () => {
  const m = migrateRecord({ id: 'a', title: 'Old', date: '2026-05-05', repeat: 'yearly', favorite: true, category: 'travel' });
  assert.equal(m.schema, SCHEMA);
  assert.equal(m.recurrence.freq, 'yearly');
  assert.equal(m.pinned, true);
  assert.equal(m.archived, false);
  assert.deepEqual(m.skips, []);
  assert.ok(SCENE_IDS.includes(m.scene));
});

test('unusable records are rejected instead of crashing the app', () => {
  assert.equal(migrateRecord(null), null);
  assert.equal(migrateRecord({ id: '', date: '2026-01-01' }), null);
  assert.equal(migrateRecord({ id: 'x', date: 'garbage' }), null);
  assert.equal(migrateRecord({ id: 'x' }), null);
});

test('hostile or broken fields are clamped', () => {
  const m = migrateRecord({ id: 'x', date: '2026-01-01', title: 'T'.repeat(500), notes: 'n'.repeat(99999), recurrence: { freq: 'hourly', interval: -5 }, skips: ['2026-13-01', '2026-02-02', '2026-02-02'], overrides: { 'bad': { title: 'x' }, '2026-02-02': { title: ' A ', notes: 5 } }, tz: 'Mars/Base', time: '10:00' });
  assert.equal(m.title.length, 80);
  assert.equal(m.notes.length, 5000);
  assert.deepEqual(m.recurrence, { freq: 'none', interval: 1, until: null });
  assert.deepEqual(m.skips, ['2026-02-02']);
  assert.deepEqual(m.overrides, { '2026-02-02': { title: 'A' } });
  assert.equal(m.tz, null);
});

test('db: migrations exist for every version and the memory adapter round-trips', async () => {
  for (let v = 1; v <= DB_VERSION; v++) assert.equal(typeof MIGRATIONS[v], 'function');
  const db = memoryAdapter();
  await db.put('events', { id: 'e1', date: '2026-01-01' });
  await db.putMany('photos', [{ id: 'p1', eventId: 'e1' }, { id: 'p2', eventId: 'e2' }]);
  assert.equal((await db.getAll('events')).length, 1);
  assert.equal((await db.getAllWhere('photos', 'eventId', 'e1')).length, 1);
  await db.deleteWhere('photos', 'eventId', 'e1');
  assert.equal((await db.getAll('photos')).length, 1);
  await db.delete('events', 'e1');
  assert.equal(await db.get('events', 'e1'), undefined);
});

/* ---------------- store with an injected adapter ---------------- */
async function freshStore(seed) {
  const mod = await import(`../src/store/events.js?${Math.random()}`);
  await mod.initStore({ adapter: memoryAdapter(seed), broadcast: false });
  return mod;
}

test('store: create, update, derive and persist across a reload', async () => {
  const adapter = memoryAdapter();
  let s = await import(`../src/store/events.js?${Math.random()}`);
  await s.initStore({ adapter, broadcast: false });
  const made = await s.saveEvent(good({ title: 'Launch', date: '2026-11-20', pinned: true }));
  assert.ok(made.ok);
  let list = s.getEvents(TODAY).filter((e) => e.userEvent);
  assert.equal(list.length, 1);
  assert.equal(list[0].title, 'Launch');
  assert.equal(list[0].pinned, true);

  const upd = await s.saveEvent(good({ title: 'Launch v2', date: '2026-11-21' }), made.event.id);
  assert.ok(upd.ok);
  assert.equal(s.getEvent(made.event.id, TODAY).title, 'Launch v2');

  // "reload": new module instance reading the same adapter
  const s2 = await import(`../src/store/events.js?${Math.random()}`);
  await s2.initStore({ adapter, broadcast: false });
  assert.equal(s2.getEvent(made.event.id, TODAY).date, '2026-11-21');
});

test('store: invalid input is rejected without touching storage', async () => {
  const s = await freshStore();
  const r = await s.saveEvent(good({ title: '' }));
  assert.equal(r.ok, false);
  assert.equal(r.errors.title, 'titleRequired');
  assert.equal(s.userEventCount(), 0);
  assert.equal((await s.saveEvent(good(), 'missing-id')).ok, false);
});

test('store: delete with undo restores the event and its photos', async () => {
  const s = await freshStore();
  const { event } = await s.saveEvent(good({ title: 'Trip' }));
  await s.addPhoto(event.id, { type: 'image/png', size: 10, name: 'a.png' });
  assert.equal(s.listPhotos(event.id).length, 1);
  const snap = await s.removeEvent(event.id);
  assert.equal(s.userEventCount(), 0);
  assert.equal(s.getEvent(event.id, TODAY), null);
  assert.equal(s.listPhotos(event.id).length, 0);
  await s.restoreRemoved(snap);
  assert.equal(s.getEvent(event.id, TODAY).title, 'Trip');
  assert.equal(s.listPhotos(event.id).length, 1);
});

test('store: photo limits are enforced', async () => {
  const s = await freshStore();
  const { event } = await s.saveEvent(good());
  await assert.rejects(s.addPhoto(event.id, { type: 'text/plain', size: 1, name: 'x' }), /photoType/);
  await assert.rejects(s.addPhoto(event.id, { type: 'image/png', size: 9 * 1024 * 1024, name: 'x' }), /photoSize/);
  for (let i = 0; i < 12; i++) await s.addPhoto(event.id, { type: 'image/png', size: 1, name: `p${i}` });
  await assert.rejects(s.addPhoto(event.id, { type: 'image/png', size: 1, name: 'one-too-many' }), /photoCount/);
});

test('store: archive hides from lists, shows under archived; pin feeds the hero ordering', async () => {
  const s = await freshStore();
  const a = (await s.saveEvent(good({ title: 'A', date: '2026-11-01' }))).event;
  await s.saveEvent(good({ title: 'B', date: '2026-11-02' }));
  await s.setArchived(a.id, true);
  assert.deepEqual(s.getEvents(TODAY).filter((e) => e.userEvent).map((e) => e.title), ['B']);
  assert.deepEqual(s.getArchived(TODAY).map((e) => e.title), ['A']);
  assert.equal(s.getEvent(a.id, TODAY).archived, true);
  await s.setArchived(a.id, false);
  assert.equal(s.getEvents(TODAY).filter((e) => e.userEvent).length, 2);
});

test('store: recurring series yields one upcoming + one past item, never an unbounded list', async () => {
  const s = await freshStore();
  const { event } = await s.saveEvent(good({ title: 'Birthday', date: '1990-06-15', recurrence: { freq: 'yearly', interval: 1, until: null } }));
  const items = s.getEvents(TODAY).filter((e) => e.seriesId === event.id);
  assert.equal(items.length, 2);
  const next = items.find((e) => e.date >= TODAY);
  const prev = items.find((e) => e.date < TODAY);
  assert.equal(next.date, '2027-06-15');
  assert.equal(next.id, event.id);
  assert.equal(next.start, '2026-06-15'); // progress runs from the previous occurrence
  assert.equal(prev.date, '2026-06-15');
  assert.equal(prev.id, `${event.id}@2026-06-15`);
  assert.equal(s.getEvent(`${event.id}@2026-06-15`, TODAY).date, '2026-06-15');
});

test('store: skipping and overriding one occurrence leaves the series intact', async () => {
  const s = await freshStore();
  const { event } = await s.saveEvent(good({ title: 'Rent', date: '2026-01-10', recurrence: { freq: 'monthly', interval: 1, until: null } }));
  assert.equal(s.getEvent(event.id, TODAY).date, '2026-11-10');
  await s.setSkipped(event.id, '2026-11-10', true);
  assert.equal(s.getEvent(event.id, TODAY).date, '2026-12-10');
  await s.setOverride(event.id, '2026-12-10', { title: 'Rent (late)', notes: 'pay on the 12th' });
  const next = s.getEvent(event.id, TODAY);
  assert.equal(next.title, 'Rent (late)');
  assert.equal(next.notes, 'pay on the 12th');
  assert.equal(s.getSeries(event.id).title, 'Rent');
  await s.setOverride(event.id, '2026-12-10', null);
  assert.equal(s.getEvent(event.id, TODAY).title, 'Rent');
  await s.setSkipped(event.id, '2026-11-10', false);
  assert.equal(s.getEvent(event.id, TODAY).date, '2026-11-10');
});

test('store: changing the series date resets stale exceptions', async () => {
  const s = await freshStore();
  const { event } = await s.saveEvent(good({ date: '2026-01-10', recurrence: { freq: 'monthly', interval: 1, until: null } }));
  await s.setSkipped(event.id, '2026-11-10', true);
  await s.saveEvent(good({ date: '2026-01-11', recurrence: { freq: 'monthly', interval: 1, until: null } }), event.id);
  assert.deepEqual(s.getSeries(event.id).skips, []);
});

test('store: ended series keeps only its last occurrence as a memory', async () => {
  const s = await freshStore();
  const { event } = await s.saveEvent(good({ title: 'Course', date: '2026-01-05', recurrence: { freq: 'weekly', interval: 1, until: '2026-03-01' } }));
  const items = s.getEvents(TODAY).filter((e) => e.seriesId === event.id);
  assert.equal(items.length, 1);
  assert.equal(items[0].date, '2026-02-23');
  assert.ok(items[0].date < TODAY);
});

test('store: duplicate makes an independent copy and a sample can be copied', async () => {
  const s = await freshStore();
  const { event } = await s.saveEvent(good({ title: 'Original', pinned: true }));
  const copy = await s.duplicateEvent(s.getEvent(event.id, TODAY));
  assert.notEqual(copy.id, event.id);
  assert.match(copy.title, /Original/);
  assert.equal(copy.pinned, false);
  const fromSample = await s.duplicateEvent({ title: 'Sample thing', date: '2026-12-24', category: 'travel', scene: 'beach' });
  assert.equal(fromSample.date, '2026-12-24');
  assert.equal(s.userEventCount(), 3);
});

test('store: corrupted records are skipped and counted, valid ones load', async () => {
  const seed = { events: { good: { id: 'good', title: 'OK', date: '2026-12-12', category: 'work' }, bad1: { id: 'bad1', title: 'no date' }, bad2: null } };
  const s = await freshStore(seed);
  assert.equal(s.userEventCount(), 1);
  assert.equal(s.storeStatus.skipped, 2);
  assert.equal(s.getEvent('good', TODAY).title, 'OK');
});

test('store: subscribers hear about changes', async () => {
  const s = await freshStore();
  let n = 0;
  const off = s.onStoreChange(() => n++);
  await s.saveEvent(good());
  assert.ok(n >= 1);
  off();
  const before = n;
  await s.saveEvent(good({ title: 'two' }));
  assert.equal(n, before);
});
