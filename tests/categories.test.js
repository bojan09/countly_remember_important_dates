import test from 'node:test';
import assert from 'node:assert/strict';
import { memoryAdapter, MIGRATIONS } from '../src/store/db.js';
import { emptyForm, migrateRecord, validateEvent } from '../src/events/model.js';
import { allCategories, visibleCategories, categoryName, categoryById, configureCategories, validateCategory, migrateCategory, CATEGORY_COLORS } from '../src/events/categories.js';
import { parseBackup, BACKUP_FORMAT } from '../src/store/backup.js';
import { setLang } from '../src/i18n/index.js';

const form = (over = {}) => ({ ...emptyForm('2026-10-26'), title: 'Gig', date: '2026-12-01', ...over });
async function freshStore(adapter = memoryAdapter()) {
  const s = await import(`../src/store/events.js?${Math.random()}`);
  await s.initStore({ adapter, broadcast: false });
  return s;
}
const ids = () => allCategories().map((c) => c.id);

test('categories: defaults are the five presets plus other, in that order', async () => {
  await freshStore();
  assert.deepEqual(ids(), ['celebration', 'travel', 'work', 'health', 'personal', 'other']);
});

test('categories: validation rules and unique names (case-insensitive, built-ins included)', async () => {
  setLang('en', { silent: true });
  await freshStore();
  const v = (name, o = {}) => validateCategory({ name, color: CATEGORY_COLORS[1], icon: 'star', scene: 'beach', ...o }, { sceneIds: ['beach', 'mountain'] });
  assert.equal(v('   ').errors.name, 'nameRequired');
  assert.equal(v('x'.repeat(31)).errors.name, 'nameTooLong');
  assert.equal(v('travel').errors.name, 'nameTaken');
  assert.equal(v('  Hiking   club ').value.name, 'Hiking club');
  const bad = v('Ok', { color: 'red', icon: 'nope', scene: 'zzz' }).value;
  assert.deepEqual([bad.color, bad.icon, bad.scene], [CATEGORY_COLORS[0], 'tag', 'mountain']);
  assert.ok(v('Ok').ok);
});

test('categories: create, use on an event, rename, and survive a reload', async () => {
  const adapter = memoryAdapter();
  const s = await freshStore(adapter);
  const made = await s.saveCategory({ name: 'Hiking', color: CATEGORY_COLORS[3], icon: 'mapPin', scene: 'mountain' });
  assert.ok(made.ok);
  const cat = made.category;
  assert.match(cat.id, /^cat-/);
  const ev = (await s.saveEvent(form({ category: cat.id }))).event;
  assert.equal(ev.category, cat.id);
  assert.equal(categoryName(cat.id), 'Hiking');
  assert.equal((await s.saveCategory({ name: 'Trekking', color: cat.color, icon: cat.icon, scene: cat.scene }, cat.id)).ok, true);
  assert.equal(categoryName(cat.id), 'Trekking');
  assert.equal((await s.saveCategory({ name: 'travel' }, cat.id)).errors.name, 'nameTaken');

  const again = await freshStore(adapter);
  assert.equal(categoryName(cat.id), 'Trekking');
  assert.equal(again.getSeries(ev.id).category, cat.id);
});

test('categories: deleting moves events to the chosen category and cleans prefs', async () => {
  const s = await freshStore();
  const { category } = await s.saveCategory({ name: 'Temp' });
  const a = (await s.saveEvent(form({ category: category.id }))).event;
  await s.saveEvent(form({ title: 'B', category: category.id }));
  assert.equal(s.categoryUseCount(category.id), 2);
  assert.equal(await s.removeCategory(category.id, 'work'), 2);
  assert.equal(s.getSeries(a.id).category, 'work');
  assert.equal(ids().includes(category.id), false);
  assert.equal(await s.removeCategory('work', 'other'), null, 'built-ins cannot be deleted');
  assert.equal(await s.removeCategory('nope', 'other'), null);
});

test('categories: deleting into itself or an unknown target falls back to other', async () => {
  const s = await freshStore();
  const { category } = await s.saveCategory({ name: 'Temp' });
  const a = (await s.saveEvent(form({ category: category.id }))).event;
  await s.removeCategory(category.id, category.id);
  assert.equal(s.getSeries(a.id).category, 'other');
});

test('categories: hide and reorder persist, "other" cannot be hidden, visible list keeps the current one', async () => {
  const adapter = memoryAdapter();
  const s = await freshStore(adapter);
  await s.setCategoryHidden('travel', true);
  await s.setCategoryHidden('other', true);
  assert.equal(visibleCategories().some((c) => c.id === 'travel'), false);
  assert.equal(visibleCategories('travel').some((c) => c.id === 'travel'), true);
  assert.equal(visibleCategories().some((c) => c.id === 'other'), true);
  await s.moveCategory('personal', -1);
  assert.deepEqual(ids().slice(2, 5), ['work', 'personal', 'health']);
  await s.moveCategory('celebration', -1); // already first: no-op
  assert.equal(ids()[0], 'celebration');
  await freshStore(adapter);
  assert.equal(categoryById('travel').hidden, true);
  assert.deepEqual(ids().slice(2, 5), ['work', 'personal', 'health']);
});

test('categories: unknown category ids on events fall back to other', () => {
  configureCategories();
  assert.equal(validateEvent(form({ category: 'cat-ghost' })).value.category, 'other');
  assert.equal(migrateRecord({ id: 'e', date: '2026-01-01', category: 'cat-ghost' }).category, 'other');
});

test('categories: a stored custom category with junk fields is repaired or dropped', () => {
  assert.equal(migrateCategory({ id: 'not-cat', name: 'x' }), null);
  assert.equal(migrateCategory({ id: 'cat-1', name: '  ' }), null);
  const c = migrateCategory({ id: 'cat-1', name: 'Fine', color: 'javascript:1', icon: '<b>', scene: 5 }, ['mountain']);
  assert.deepEqual([c.color, c.icon, c.scene], [CATEGORY_COLORS[0], 'tag', 'mountain']);
});

test('categories: v2 migration only adds the store and is safe to re-run', () => {
  const made = [];
  const db = { objectStoreNames: { contains: (n) => made.includes(n) }, createObjectStore: (n) => made.push(n) };
  MIGRATIONS[2](db);
  MIGRATIONS[2](db);
  assert.deepEqual(made, ['categories']);
});

test('categories: backup round trip keeps custom categories, order and hidden; events keep their category', async () => {
  const a = await freshStore();
  const { category } = await a.saveCategory({ name: 'Gym', color: CATEGORY_COLORS[2], icon: 'heart', scene: 'runner' });
  await a.saveEvent(form({ category: category.id }));
  await a.setCategoryHidden('work', true);
  const { text } = await a.exportBackup({});
  const parsed = parseBackup(text);
  assert.equal(parsed.categories.length, 1);
  assert.equal(parsed.events[0].category, category.id, 'category id is known from the file itself');

  const b = await freshStore();
  const res = await b.importBackup(parsed, 'replace');
  assert.equal(res.categories, 1);
  assert.equal(categoryName(category.id), 'Gym');
  assert.equal(categoryById('work').hidden, true);
  assert.equal(b.getSeries(parsed.events[0].id).category, category.id);
});

test('categories: merge import adds missing categories and keeps newer local edits', async () => {
  const s = await freshStore();
  const { category } = await s.saveCategory({ name: 'Local', color: CATEGORY_COLORS[0] });
  const file = (cats) => JSON.stringify({ format: BACKUP_FORMAT, version: 1, events: [], photos: [], categories: cats });
  const old = { ...category, name: 'Stale', updatedAt: category.updatedAt - 10 };
  const fresh = { id: 'cat-new1', name: 'From file', color: CATEGORY_COLORS[4], icon: 'star', scene: 'beach', createdAt: 1, updatedAt: 1 };
  await s.importBackup(parseBackup(file([old, fresh])), 'merge');
  assert.equal(categoryName(category.id), 'Local');
  assert.equal(categoryName('cat-new1'), 'From file');
});

test('categories: hostile category rows in a backup are dropped', () => {
  const rows = [{ id: '__proto__', name: 'x' }, { id: 'cat-ok', name: '<img onerror=1>' }, { id: 'cat-' + 'x'.repeat(200), name: 'long' }, null, 5];
  const parsed = parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 1, events: [], categories: rows }));
  assert.deepEqual(parsed.categories.map((c) => c.id), ['cat-ok']);
  assert.equal(parsed.categories[0].name, '<img onerror=1>', 'text is kept as text; the UI never renders it as HTML');
});
