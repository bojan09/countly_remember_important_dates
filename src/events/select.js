import { diffDays, parseISODate } from '../date/calendar.js';

export const byDateAsc = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
export const byDateDesc = (a, b) => byDateAsc(b, a);

/** Events today or later, soonest first. */
export function upcoming(events, today) {
  return events.filter((e) => e.date >= today).sort(byDateAsc);
}

/** Upcoming events that fall inside the current calendar month. */
export function thisMonth(events, today) {
  const t = parseISODate(today);
  return upcoming(events, today).filter((e) => {
    const p = parseISODate(e.date);
    return p.y === t.y && p.m === t.m;
  });
}

/** Events strictly before today, most recent first. */
export function past(events, today) {
  return events.filter((e) => e.date < today).sort(byDateDesc);
}

export function nextEvent(events, today) {
  return upcoming(events, today)[0] || null;
}

/** Hero pick: the soonest pinned upcoming event, otherwise simply the next one. */
export function featuredEvent(events, today) {
  const list = upcoming(events, today);
  return list.find((e) => e.pinned) || list[0] || null;
}

/** One entry per event series: a recurring event contributes both a next and a past item, count it once. */
export function uniqueSeries(events) {
  const seen = new Map();
  for (const e of events) {
    const key = e.seriesId || e.id;
    if (!seen.has(key)) seen.set(key, e); // the next occurrence is listed before the past one
  }
  return [...seen.values()];
}

export function countByCategory(events) {
  const map = new Map();
  for (const e of uniqueSeries(events)) map.set(e.category, (map.get(e.category) || 0) + 1);
  return map;
}

/** Events per calendar month of `year` (index 0 = January). */
export function countByMonth(events, year) {
  const out = Array(12).fill(0);
  for (const e of uniqueSeries(events)) {
    const p = parseISODate(e.date);
    if (p && p.y === year) out[p.m - 1]++;
  }
  return out;
}

export function daysFrom(today, e) {
  return diffDays(today, e.date);
}
