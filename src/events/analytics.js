// Pure statistics over occurrence lists (no DOM). Everything the charts show comes from here,
// so the numbers are unit-testable and always derived from real stored events.
import { parseISODate, diffDays, addDays, daysInMonth, weekdayOf } from '../date/calendar.js';

/** Events per calendar month of `year` (index 0 = January). */
export function monthlyCounts(occurrences, year) {
  const out = Array(12).fill(0);
  for (const e of occurrences) {
    const p = parseISODate(e.date);
    if (p && p.y === year) out[p.m - 1]++;
  }
  return out;
}

/** Map ISO date -> number of occurrences on that day. */
export function dayCounts(occurrences) {
  const map = new Map();
  for (const e of occurrences) map.set(e.date, (map.get(e.date) || 0) + 1);
  return map;
}

export function categoryCounts(occurrences) {
  const map = new Map();
  for (const e of occurrences) map.set(e.category, (map.get(e.category) || 0) + 1);
  return map;
}

/** Entry with the highest count (ties: the earliest key). */
export function busiest(map) {
  let best = null;
  for (const [key, count] of [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (!best || count > best.count) best = { key, count };
  }
  return best;
}

export function daysInYear(year) {
  return diffDays(`${year}-01-01`, `${year + 1}-01-01`);
}

/** Share of `year` that has fully passed on `today` (0-100, whole numbers). */
export function yearProgress(today) {
  const p = parseISODate(today);
  const total = daysInYear(p.y);
  const passed = diffDays(`${p.y}-01-01`, today);
  return { year: p.y, passed, total, percent: Math.round((passed / total) * 100) };
}

/** Occurrences already behind `today` vs all in the list. */
export function doneStats(occurrences, today) {
  const total = occurrences.length;
  const done = occurrences.filter((e) => e.date < today).length;
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

/** 0 (none) to 4 (busiest) intensity bucket for a heatmap cell. */
export function heatLevel(count, max) {
  if (!count || !max) return 0;
  return Math.min(4, Math.max(1, Math.ceil((count / max) * 4)));
}

/**
 * Week columns for a year heatmap. Each column is 7 cells (week start first); cells outside the
 * year are null. Returns { columns, monthStarts } where monthStarts maps column index -> month (1-12).
 */
export function heatGrid(year, weekStart = 1) {
  const first = `${year}-01-01`;
  const lead = (weekdayOf(first) - weekStart + 7) % 7;
  const total = daysInYear(year);
  const weeks = Math.ceil((lead + total) / 7);
  const columns = [];
  const monthStarts = new Map();
  for (let w = 0; w < weeks; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const idx = w * 7 + d - lead;
      col.push(idx >= 0 && idx < total ? addDays(first, idx) : null);
    }
    columns.push(col);
    const firstOfMonth = col.find((iso) => iso && parseISODate(iso).d === 1);
    if (firstOfMonth) monthStarts.set(w, parseISODate(firstOfMonth).m);
  }
  if (!monthStarts.has(0)) monthStarts.set(0, 1);
  return { columns, monthStarts, daysInYear: total, lead };
}

export { daysInMonth };
