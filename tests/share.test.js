import test from 'node:test';
import assert from 'node:assert/strict';
import { SHARE_FORMATS, SHARE_THEMES, formatById, wrapLines, shareFilename, shareText, coverRect } from '../src/events/shareCard.js';

const measure = (s) => [...s].length * 10; // 10px per character

test('share: formats and themes are well-formed', () => {
  assert.deepEqual(SHARE_FORMATS.map((f) => [f.id, f.width, f.height]), [['story', 1080, 1920], ['square', 1080, 1080], ['wide', 1200, 630]]);
  assert.equal(formatById('nope').id, 'story');
  for (const th of Object.values(SHARE_THEMES)) assert.ok(th.bg.length === 2 && th.text && th.sub);
});

test('share: themes keep text readable (WCAG contrast of body text over the darkest/lightest background stop)', () => {
  const lum = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
  for (const [name, th] of Object.entries(SHARE_THEMES)) {
    for (const stop of th.bg) assert.ok(ratio(th.text, stop) >= 4.5, `${name}: ${th.text} on ${stop} = ${ratio(th.text, stop).toFixed(2)}`);
  }
});

test('share: wrapLines wraps on words, respects max lines and marks truncation', () => {
  assert.deepEqual(wrapLines(measure, 'Mom birthday', 200, 2), ['Mom birthday']);
  assert.deepEqual(wrapLines(measure, 'Mom birthday party at the lake', 120, 3), ['Mom birthday', 'party at the', 'lake']);
  const lines = wrapLines(measure, 'one two three four five six seven', 100, 2);
  assert.equal(lines.length, 2);
  assert.ok(lines[1].endsWith('…'));
  assert.ok(lines.every((l) => measure(l) <= 100));
  assert.deepEqual(wrapLines(measure, '', 100), []);
  assert.deepEqual(wrapLines(measure, null, 100), []);
});

test('share: truncation drops whole words before cutting letters, and cuts a single huge word', () => {
  assert.deepEqual(wrapLines(measure, 'aaaa bbbb cccc dddd eeee', 95, 2), ['aaaa bbbb', 'cccc…']);
  const one = wrapLines(measure, 'Supercalifragilisticexpialidocious', 100, 2);
  assert.equal(one.length, 1);
  assert.ok(measure(one[0]) <= 100);
  assert.deepEqual(wrapLines(measure, 'x'.repeat(40) + ' tail', 100, 1).map((l) => measure(l) <= 100), [true]);
});

test('share: file names and text are safe and readable', () => {
  assert.equal(shareFilename('Mom’s 60th Birthday!', 'square'), 'moms-60th-birthday-square.png');
  assert.equal(shareFilename('../../x', 'wide'), 'x-wide.png');
  assert.equal(shareFilename('🎂', 'bogus'), 'countly-story.png');
  assert.equal(shareText({ title: 'Trip', when: '12 days', dateText: 'Friday, Nov 6', appName: 'Countly' }), 'Trip — 12 days\nFriday, Nov 6\nCountly');
  assert.equal(shareText({ title: '', when: 'Today!', dateText: '', appName: 'Countly' }), 'Today!\nCountly');
});

test('share: coverRect crops the long side symmetrically and keeps the target aspect', () => {
  const r = coverRect(1600, 1440, 1080, 768);
  assert.ok(Math.abs(r.sw / r.sh - 1080 / 768) < 1e-9);
  assert.ok(r.sx >= 0 && r.sy >= 0 && r.sx + r.sw <= 1600 + 1e-9 && r.sy + r.sh <= 1440 + 1e-9);
  assert.equal(r.sx, (1600 - r.sw) / 2);
  const tall = coverRect(1000, 500, 100, 100);
  assert.deepEqual([tall.sx, tall.sy, tall.sw, tall.sh], [250, 0, 500, 500]);
});
