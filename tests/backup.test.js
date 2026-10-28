import test from 'node:test';
import assert from 'node:assert/strict';
import { memoryAdapter } from '../src/store/db.js';
import { emptyForm } from '../src/events/model.js';
import { parseBackup, planImport, bytesToBase64, base64ToBytes, BACKUP_FORMAT, MAX_BACKUP_BYTES } from '../src/store/backup.js';

const form = (over = {}) => ({ ...emptyForm('2026-10-26'), title: 'Trip', date: '2026-12-01', ...over });
const png = (n = 8) => new Blob([new Uint8Array(n).fill(7)], { type: 'image/png' });

async function freshStore(adapter = memoryAdapter()) {
  const s = await import(`../src/store/events.js?${Math.random()}`);
  await s.initStore({ adapter, broadcast: false });
  return s;
}

const file = (over = {}) => JSON.stringify({ format: BACKUP_FORMAT, version: 1, exportedAt: '2026-10-26T10:00:00.000Z', events: [], photos: [], prefs: {}, ...over });
const rec = (over = {}) => ({ id: 'ev-1', title: 'A', date: '2026-12-01', category: 'travel', createdAt: 1, updatedAt: 1000, ...over });

test('backup: base64 helpers round-trip and reject garbage', () => {
  const bytes = new Uint8Array(70000).map((_, i) => i % 251);
  assert.deepEqual(base64ToBytes(bytesToBase64(bytes)), bytes);
  for (const bad of ['abc', 'a b=', '!!!!', null, 5]) assert.equal(base64ToBytes(bad), null);
});

test('backup: export then restore into an empty store keeps events, overrides and photos', async () => {
  const a = await freshStore();
  const { event } = await a.saveEvent(form({ title: 'Wedding', notes: 'Bring rings', recurrence: { freq: 'yearly', interval: 1, until: null } }));
  await a.setSkipped(event.id, '2027-12-01', true);
  await a.addPhoto(event.id, png(9));
  const out = await a.exportBackup({ lang: 'mk', theme: 'dark', name: 'Ana', onboarded: true });
  assert.equal(out.events, 1);
  assert.equal(out.photos, 1);

  const parsed = parseBackup(out.text);
  assert.ok(parsed.ok);
  assert.deepEqual(parsed.prefs, { lang: 'mk', theme: 'dark', name: 'Ana' });

  const b = await freshStore();
  const res = await b.importBackup(parsed, 'merge');
  assert.deepEqual([res.added, res.updated, res.photos], [1, 0, 1]);
  const got = b.getSeries(event.id);
  assert.equal(got.title, 'Wedding');
  assert.deepEqual(got.skips, ['2027-12-01']);
  assert.equal(got.updatedAt, a.getSeries(event.id).updatedAt, 'timestamps survive the round trip');
  const photos = b.listPhotos(event.id);
  assert.equal(photos.length, 1);
  assert.equal((await b.getPhotoBlob(photos[0].id)).size, 9);
});

test('backup: merge adds new, updates only newer, never deletes and is idempotent', async () => {
  const s = await freshStore();
  const mine = (await s.saveEvent(form({ title: 'Mine' }))).event;
  const parsed = parseBackup(file({ events: [rec({ id: 'ev-new', title: 'New' }), rec({ id: mine.id, title: 'Older copy', updatedAt: mine.updatedAt - 1 })] }));
  const r1 = await s.importBackup(parsed, 'merge');
  assert.deepEqual([r1.added, r1.updated, r1.unchanged], [1, 0, 1]);
  assert.equal(s.getSeries(mine.id).title, 'Mine');

  const newer = parseBackup(file({ events: [rec({ id: mine.id, title: 'Newer copy', updatedAt: mine.updatedAt + 5 })] }));
  assert.equal((await s.importBackup(newer, 'merge')).updated, 1);
  assert.equal(s.getSeries(mine.id).title, 'Newer copy');
  const again = await s.importBackup(newer, 'merge');
  assert.deepEqual([again.added, again.updated], [0, 0]);
  assert.equal(s.userEventCount(), 2);
});

test('backup: replace makes the store equal to the file and drops other events and photos', async () => {
  const s = await freshStore();
  const old = (await s.saveEvent(form({ title: 'Old' }))).event;
  await s.addPhoto(old.id, png());
  const parsed = parseBackup(file({ events: [rec({ id: 'ev-kept', title: 'Kept' })] }));
  const res = await s.importBackup(parsed, 'replace');
  assert.equal(res.removed, 1);
  assert.equal(s.userEventCount(), 1);
  assert.equal(s.getSeries('ev-kept').title, 'Kept');
  assert.equal(s.getSeries(old.id), null);
  assert.equal(s.listPhotos(old.id).length, 0);
});

test('backup: rejects what is not a backup, too large, or from a newer version', () => {
  assert.equal(parseBackup('not json').error, 'notJson');
  assert.equal(parseBackup('[]').error, 'notBackup');
  assert.equal(parseBackup(JSON.stringify({ format: 'other', version: 1, events: [] })).error, 'notBackup');
  assert.equal(parseBackup(file({ version: 0 })).error, 'notBackup');
  assert.equal(parseBackup(file({ version: 2 })).error, 'newerVersion');
  assert.equal(parseBackup(file({ events: 'x' })).error, 'notBackup');
  assert.equal(parseBackup('x'.repeat(MAX_BACKUP_BYTES + 1)).error, 'tooLarge');
});

test('backup: hostile and malformed content is repaired or skipped, never trusted', () => {
  const evil = {
    ...rec({ id: 'ev-ok', title: 'x'.repeat(500), category: 'hacker', scene: '<script>', notes: 'n'.repeat(9000), extra: 'dropped', isAdmin: true }),
    overrides: { '__proto__': { title: 'p' }, '2026-12-01': { title: 'ok', evil: 1 }, 'not-a-date': { title: 'no' } },
  };
  const parsed = parseBackup(file({ events: [evil, null, 5, { id: '', date: '2026-01-01' }, { id: 'ev-nodate' }, rec({ id: 'x'.repeat(200) }), rec({ id: 'ev-bad-date', date: '2026-02-30' })] }));
  assert.ok(parsed.ok);
  assert.equal(parsed.events.length, 1);
  assert.equal(parsed.skipped.events, 6);
  const e = parsed.events[0];
  assert.equal(e.title.length, 80);
  assert.equal(e.category, 'other');
  assert.ok(e.notes.length <= 5000);
  assert.equal(e.extra, undefined);
  assert.equal(e.isAdmin, undefined);
  assert.deepEqual(Object.keys(e.overrides), ['2026-12-01']);
  assert.deepEqual(e.overrides['2026-12-01'], { title: 'ok' });
  assert.equal({}.polluted, undefined);
});

test('backup: photos are checked for type, size, ownership, duplicates and per-event cap', () => {
  const good = (id, over = {}) => ({ id, eventId: 'ev-1', name: 'a.png', type: 'image/png', size: 1, createdAt: 5, data: bytesToBase64(new Uint8Array([1, 2, 3])), ...over });
  const photos = [
    good('ph-1'),
    good('ph-1'), // duplicate id
    good('ph-svg', { type: 'image/svg+xml' }),
    good('ph-orphan', { eventId: 'ev-missing' }),
    good('ph-bad64', { data: '@@@@' }),
    good('ph-empty', { data: '' }),
    good('ph-big', { data: bytesToBase64(new Uint8Array(50)) }),
    good('ph-2'),
    good('ph-3'),
  ];
  const parsed = parseBackup(file({ events: [rec()], photos }), { maxBytes: 10, maxPerEvent: 2 });
  assert.deepEqual(parsed.photos.map((p) => p.id), ['ph-1', 'ph-2']);
  assert.equal(parsed.skipped.photos, 7);
  assert.equal(parsed.photos[0].size, 3);
});

test('backup: only whitelisted, valid preferences come through', () => {
  const parsed = parseBackup(file({ prefs: { lang: 'mk', theme: 'neon', accent: 'teal', onboarded: true, lastBackup: 5, name: 'N', __proto__: { x: 1 } } }));
  assert.equal(parsed.prefs.lang, 'mk');
  assert.equal(parsed.prefs.accent, 'teal');
  assert.equal(parsed.prefs.name, 'N');
  assert.equal(parsed.prefs.theme, 'auto', 'invalid value falls back to the default');
  assert.equal('onboarded' in parsed.prefs, false);
  assert.equal('lastBackup' in parsed.prefs, false);
});

test('backup: duplicate event ids in one file keep the newest', () => {
  const parsed = parseBackup(file({ events: [rec({ title: 'old', updatedAt: 1 }), rec({ title: 'new', updatedAt: 9 }), rec({ title: 'older', updatedAt: 3 })] }));
  assert.equal(parsed.events.length, 1);
  assert.equal(parsed.events[0].title, 'new');
});

test('backup: planImport merge respects the per-event photo cap and skips known photos', () => {
  const parsed = { events: [rec()], photos: [{ id: 'ph-a', eventId: 'ev-1' }, { id: 'ph-b', eventId: 'ev-1' }, { id: 'ph-c', eventId: 'ev-1' }] };
  const plan = planImport(parsed, new Map([['ev-1', rec({ updatedAt: 5000 })]]), new Map([['ev-1', ['ph-a']]]), 'merge', { maxPerEvent: 2 });
  assert.deepEqual(plan.photos.map((p) => p.id), ['ph-b']);
  assert.equal(plan.unchanged, 1);
});

test('backup nudge: only for people with a few events and no recent backup, and it can be snoozed', async () => {
  const { needsBackup } = await import('../src/store/backup.js');
  const now = Date.UTC(2026, 10, 1);
  const day = 86400000;
  assert.equal(needsBackup({ eventCount: 2, lastBackup: null, now }), false, 'too few events');
  assert.equal(needsBackup({ eventCount: 3, lastBackup: null, now }), true, 'never backed up');
  assert.equal(needsBackup({ eventCount: 9, lastBackup: now - 29 * day, now }), false, 'recent backup');
  assert.equal(needsBackup({ eventCount: 9, lastBackup: now - 31 * day, now }), true, 'stale backup');
  assert.equal(needsBackup({ eventCount: 9, lastBackup: null, snoozedUntil: now + day, now }), false, 'snoozed');
  assert.equal(needsBackup({ eventCount: 9, lastBackup: null, snoozedUntil: now - day, now }), true, 'snooze expired');
});
