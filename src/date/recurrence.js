// Recurrence engine on floating calendar dates (YYYY-MM-DD strings, no time zones, no ms math).
//
// A series is defined by an anchor date plus a rule { freq, interval, until }. Occurrence k is
// ALWAYS computed from the anchor (never from the previous occurrence), so clamping never drifts:
//   monthly anchored on Jan 31 -> Jan 31, Feb 28/29, Mar 31, Apr 30 ...
//   yearly  anchored on Feb 29 -> Feb 29 in leap years, Feb 28 otherwise.
// Weekly and daily are plain calendar-day steps, so DST never shifts them.
import { parseISODate, daysInMonth, addDays, diffDays } from './calendar.js';

export const FREQS = ['none', 'daily', 'weekly', 'monthly', 'yearly'];
export const MAX_INTERVAL = 999;
const MAX_STEPS = 5000;

const pad2 = (n) => String(n).padStart(2, '0');
const isoOf = (y, m, d) => `${String(y).padStart(4, '0')}-${pad2(m)}-${pad2(d)}`;

export function normalizeRule(rule) {
  const r = rule && typeof rule === 'object' ? rule : {};
  const freq = FREQS.includes(r.freq) ? r.freq : 'none';
  let interval = Math.trunc(Number(r.interval));
  if (!Number.isFinite(interval) || interval < 1) interval = 1;
  if (interval > MAX_INTERVAL) interval = MAX_INTERVAL;
  const until = typeof r.until === 'string' && parseISODate(r.until) ? r.until : null;
  return { freq, interval, until: freq === 'none' ? null : until };
}

export const isRecurring = (rule) => normalizeRule(rule).freq !== 'none';

/** The k-th occurrence (k >= 0) of the series, ignoring `until`. */
export function occurrenceAt(rule, anchor, k) {
  const { freq, interval } = normalizeRule(rule);
  const p = parseISODate(anchor);
  if (!p) return null;
  switch (freq) {
    case 'daily':
      return addDays(anchor, k * interval);
    case 'weekly':
      return addDays(anchor, 7 * k * interval);
    case 'monthly': {
      const total = p.m - 1 + k * interval;
      const y = p.y + Math.floor(total / 12);
      const m = (total % 12) + 1;
      return isoOf(y, m, Math.min(p.d, daysInMonth(y, m)));
    }
    case 'yearly': {
      const y = p.y + k * interval;
      return isoOf(y, p.m, Math.min(p.d, daysInMonth(y, p.m)));
    }
    default:
      return k === 0 ? anchor : null;
  }
}

// Smallest / largest number of days one step can span, used to bracket k from a day difference.
const UNIT_MIN = { daily: 1, weekly: 7, monthly: 28, yearly: 365 };
const UNIT_MAX = { daily: 1, weekly: 7, monthly: 31, yearly: 366 };

const within = (iso, until) => !until || iso <= until;

/** First occurrence on or after `from`, or null when the series has ended. */
export function nextOccurrence(rule, anchor, from) {
  const r = normalizeRule(rule);
  if (!parseISODate(anchor) || !parseISODate(from)) return null;
  if (r.freq === 'none') return anchor >= from && within(anchor, r.until) ? anchor : null;
  if (anchor >= from) return within(anchor, r.until) ? anchor : null;
  const d = diffDays(anchor, from);
  let k = Math.max(0, Math.floor(d / (UNIT_MAX[r.freq] * r.interval)) - 1);
  for (let i = 0; i < MAX_STEPS; i++, k++) {
    const occ = occurrenceAt(r, anchor, k);
    if (!within(occ, r.until)) return null;
    if (occ >= from) return occ;
  }
  return null;
}

/** Last occurrence on or before `limit` (and not after `until`), or null. */
export function lastOnOrBefore(rule, anchor, limit) {
  const r = normalizeRule(rule);
  if (!parseISODate(anchor) || !parseISODate(limit) || limit < anchor) return null;
  const cap = r.until && r.until < limit ? r.until : limit;
  if (cap < anchor) return null;
  if (r.freq === 'none') return anchor;
  const d = diffDays(anchor, cap);
  let k = Math.floor(d / (UNIT_MIN[r.freq] * r.interval)) + 1;
  while (k >= 0 && occurrenceAt(r, anchor, k) > cap) k--;
  return k >= 0 ? occurrenceAt(r, anchor, k) : null;
}

/** Last occurrence strictly before `before`. */
export const prevOccurrence = (rule, anchor, before) => lastOnOrBefore(rule, anchor, addDays(before, -1));

/** Occurrences within [from, to] inclusive, capped at `limit` entries (never unbounded). */
export function occurrencesBetween(rule, anchor, from, to, limit = 400) {
  const out = [];
  let cursor = from;
  while (out.length < limit) {
    const occ = nextOccurrence(rule, anchor, cursor);
    if (!occ || occ > to) break;
    out.push(occ);
    cursor = addDays(occ, 1);
  }
  return out;
}

/** next/prev occurrence that is not in the `skips` list. */
export function nextActive(rule, anchor, from, skips = []) {
  const skip = new Set(skips);
  let cursor = from;
  for (let i = 0; i < 1000; i++) {
    const occ = nextOccurrence(rule, anchor, cursor);
    if (!occ || !skip.has(occ)) return occ;
    cursor = addDays(occ, 1);
  }
  return null;
}

export function prevActive(rule, anchor, before, skips = []) {
  const skip = new Set(skips);
  let limit = addDays(before, -1);
  for (let i = 0; i < 1000; i++) {
    const occ = lastOnOrBefore(rule, anchor, limit);
    if (!occ || !skip.has(occ)) return occ;
    limit = addDays(occ, -1);
  }
  return null;
}
