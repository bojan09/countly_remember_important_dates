// Calendar-day date engine. "Floating" dates (birthdays, holidays) are plain
// YYYY-MM-DD strings and are never converted through UTC milliseconds, so DST
// shifts and timezone changes cannot move them. Day differences are computed on
// Date.UTC(y, m, d) of the *calendar components*, which is always a multiple of 86,400,000.

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseISODate(iso) {
  const m = ISO_RE.exec(iso);
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return { y, m: mo, d };
}

export function pad(n) {
  return String(n).padStart(2, '0');
}

export function toISO({ y, m, d }) {
  return `${String(y).padStart(4, '0')}-${pad(m)}-${pad(d)}`;
}

export function todayISO(now = new Date()) {
  return `${String(now.getFullYear()).padStart(4, '0')}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Whole calendar days from a to b (positive when b is after a). DST-safe. */
export function diffDays(aISO, bISO) {
  const a = parseISODate(aISO), b = parseISODate(bISO);
  if (!a || !b) return NaN;
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000);
}

export function addDays(iso, n) {
  const p = parseISODate(iso);
  if (!p) return null;
  const dt = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
  return toISO({ y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() });
}

export function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** 0 = Sunday .. 6 = Saturday for an ISO date. */
export function weekdayOf(iso) {
  const p = parseISODate(iso);
  return new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
}

/**
 * Month grid of 6 weeks x 7 days. weekStart: 0 = Sunday, 1 = Monday.
 * Each cell: { iso, day, inMonth }.
 */
export function monthGrid(year, month, weekStart = 1) {
  const first = toISO({ y: year, m: month, d: 1 });
  const offset = (weekdayOf(first) - weekStart + 7) % 7;
  const start = addDays(first, -offset);
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const iso = addDays(start, i);
    const p = parseISODate(iso);
    cells.push({ iso, day: p.d, inMonth: p.y === year && p.m === month });
  }
  return cells;
}

export function shiftMonth({ y, m }, delta) {
  const idx = y * 12 + (m - 1) + delta;
  return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
}

/**
 * Countdown state for a floating date relative to `today`.
 * state: 'today' | 'upcoming' | 'past'
 */
export function countdown(dateISO, todayStr) {
  const days = diffDays(todayStr, dateISO);
  if (Number.isNaN(days)) return { state: 'invalid', days: NaN };
  if (days === 0) return { state: 'today', days: 0 };
  return days > 0 ? { state: 'upcoming', days } : { state: 'past', days: -days };
}

/**
 * Progress between a start date and the target. Returns null when there is no
 * start date (we never invent a percentage), or when dates are inconsistent.
 */
export function progress(startISO, dateISO, todayStr) {
  if (!startISO) return null;
  const total = diffDays(startISO, dateISO);
  if (!(total > 0)) return null;
  const elapsed = Math.min(Math.max(diffDays(startISO, todayStr), 0), total);
  return { total, elapsed, remaining: total - elapsed, percent: Math.round((elapsed / total) * 100) };
}

/** Time until local midnight starting `dateISO`: whole days, hours, minutes, seconds. null when passed/invalid. */
export function timeLeft(dateISO, now = new Date()) {
  const p = parseISODate(dateISO);
  if (!p) return null;
  const ms = new Date(p.y, p.m - 1, p.d, 0, 0, 0).getTime() - now.getTime();
  if (!(ms > 0)) return null;
  const total = Math.floor(ms / 1000);
  return { d: Math.floor(total / 86400), h: Math.floor((total % 86400) / 3600), m: Math.floor((total % 3600) / 60), s: total % 60 };
}

export function sameMonth(iso, { y, m }) {
  const p = parseISODate(iso);
  return !!p && p.y === y && p.m === m;
}
