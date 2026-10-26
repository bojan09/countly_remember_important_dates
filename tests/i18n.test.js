import test from 'node:test';
import assert from 'node:assert/strict';
import en from '../src/i18n/en.js';
import mk from '../src/i18n/mk.js';
import { setLang, t, unit, formatDays, weekdayNames, formatMonthYear, formatDate, greetingKey, monthShort } from '../src/i18n/index.js';
import { mkPlural } from '../src/i18n/mk-dates.js';
import { CATEGORIES } from '../src/events/categories.js';
import { ACCENTS } from '../src/store/prefs.js';
import { SCENE_KINDS } from '../src/scenes/art.js';
import { walk, read, rel, ROOT, flatten } from './helpers.mjs';

const fe = flatten(en);
const fm = flatten(mk);
const text = (v) => String(typeof v === 'object' ? v.other : v);
const params = (v) => [...text(v).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

test('English and Macedonian have identical key sets', () => {
  const a = Object.keys(fe).sort();
  const b = Object.keys(fm).sort();
  assert.deepEqual(a.filter((k) => !b.includes(k)), [], 'keys missing from mk');
  assert.deepEqual(b.filter((k) => !a.includes(k)), [], 'keys missing from en');
});

test('no empty strings and matching placeholders in both languages', () => {
  for (const [k, v] of Object.entries(fe)) {
    assert.ok(text(v).length > 0, `en empty: ${k}`);
    assert.ok(text(fm[k]).length > 0, `mk empty: ${k}`);
    assert.equal(params(fm[k]), params(v), `placeholder mismatch: ${k}`);
  }
});

test('Macedonian strings are translated (Cyrillic, not copied from English) apart from the brand', () => {
  for (const [k, v] of Object.entries(fm)) {
    if (k === 'app.name') continue;
    if (!/\p{L}/u.test(text(v).replace(/\{\w+\}/g, ''))) continue; // pure placeholder/punctuation template
    assert.match(text(v), /[Ѐ-ӿ]/, `mk not Cyrillic: ${k} = ${text(v)}`);
    assert.notEqual(text(v), text(fe[k]), `mk identical to en: ${k}`);
  }
});

test('every literal t() key used in source exists in both dictionaries', () => {
  const missing = [];
  for (const f of walk(ROOT + 'src', (p) => p.endsWith('.js'))) {
    const src = read(f);
    for (const m of src.matchAll(/\bt\(\s*'([\w.]+)'/g)) if (!(m[1] in fe)) missing.push(`${rel(f)}: ${m[1]}`);
    for (const m of src.matchAll(/(?:title|label):\s*'((?:nav|actions|tabs|settings|kpi|home|create)\.[\w.]+)'/g)) if (!(m[1] in fe)) missing.push(`${rel(f)}: ${m[1]}`);
  }
  assert.deepEqual(missing, []);
});

test('dynamic key families are complete (categories, accents, scenes, demo)', () => {
  for (const c of CATEGORIES) assert.ok(`categories.${c.id}` in fe && `categories.${c.id}` in fm, c.id);
  for (const id of Object.keys(ACCENTS)) assert.ok(`settings.accents.${id}` in fe && `settings.accents.${id}` in fm, id);
  for (const s of SCENE_KINDS) assert.ok(`scene.${s}` in fe && `scene.${s}` in fm, s);
  for (let i = 1; i <= 12; i++) assert.ok(`demo.past.p${i}` in fe && `demo.past.p${i}` in fm);
});

test('English day plurals', () => {
  setLang('en', { silent: true });
  assert.equal(formatDays(1), '1 day');
  assert.equal(formatDays(0), '0 days');
  assert.equal(formatDays(42), '42 days');
});

test('Macedonian day plurals follow one/other rules', () => {
  setLang('mk', { silent: true });
  assert.equal(formatDays(1), '1 ден');
  assert.equal(formatDays(2), '2 дена');
  assert.equal(formatDays(5), '5 дена');
  assert.equal(formatDays(11), '11 дена');
  assert.equal(formatDays(21), '21 ден');
  assert.equal(unit('day', 42), 'дена');
  setLang('en', { silent: true });
});

test('dates and weekdays are localized', () => {
  setLang('mk', { silent: true });
  assert.notEqual(weekdayNames(1)[0], 'Mon');
  assert.match(weekdayNames(1).join(' '), /[Ѐ-ӿ]/);
  assert.match(formatMonthYear(2026, 10), /[Ѐ-ӿ]/);
  assert.match(formatDate('2026-12-07'), /2026/);
  setLang('en', { silent: true });
  assert.deepEqual(weekdayNames(1), ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  assert.equal(weekdayNames(0)[0], 'Sun');
  assert.equal(formatDate('2026-12-07'), 'Dec 7, 2026');
});

test('Macedonian dates never depend on browser Intl data', () => {
  setLang('mk', { silent: true });
  assert.equal(formatDate('2026-10-29'), '29 окт. 2026');
  assert.equal(formatDate('2026-12-07', { dateStyle: 'full' }), 'понеделник, 7 декември 2026 г.');
  assert.equal(formatDate('2026-12-07', { weekday: 'long' }), 'понеделник');
  assert.equal(formatDate('2026-10-26', { month: 'short', day: 'numeric' }), '26 окт.');
  assert.equal(formatMonthYear(2026, 10), 'октомври 2026');
  assert.equal(monthShort(5), 'мај');
  assert.deepEqual(weekdayNames(1), ['пон', 'вто', 'сре', 'чет', 'пет', 'саб', 'нед']);
  assert.equal(weekdayNames(0)[0], 'нед');
  assert.equal(formatDays(1234), '1.234 дена');
  setLang('en', { silent: true });
});

test('plural rules are bundled, not taken from Intl (21 -> one, 11 -> other, 101 -> one)', () => {
  assert.equal(mkPlural(1), 'one');
  assert.equal(mkPlural(21), 'one');
  assert.equal(mkPlural(101), 'one');
  assert.equal(mkPlural(11), 'other');
  assert.equal(mkPlural(111), 'other');
  assert.equal(mkPlural(12), 'other');
  assert.equal(mkPlural(0), 'other');
});

test('missing keys fall back to the key itself, never undefined', () => {
  assert.equal(t('does.not.exist'), 'does.not.exist');
});

test('greeting buckets cover every hour', () => {
  for (let h = 0; h < 24; h++) assert.match(greetingKey(h), /^greeting\./);
  assert.equal(greetingKey(8), 'greeting.morning');
  assert.equal(greetingKey(14), 'greeting.afternoon');
  assert.equal(greetingKey(20), 'greeting.evening');
  assert.equal(greetingKey(2), 'greeting.night');
});
