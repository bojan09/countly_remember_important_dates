// Reminder rules. Reminders are stored as option ids on the event (`reminders: ['d1', 'h1']`); the
// moment each one fires is derived here from the event's date/time. Pure and DST-safe: day offsets
// move the calendar date, then keep the same wall-clock time, instead of subtracting 24h.
//
// All-day events have no clock time, so their reminders fire at 09:00 local on the chosen day.
// Local-only limits: a pure web app cannot wake a closed browser; see docs/REMINDERS.md.
import { addDays, parseISODate } from '../date/calendar.js';
import { eventInstantMs } from '../date/instant.js';
import { isValidTime } from '../date/instant.js';

export const ALL_DAY_HOUR = 9;
export const MAX_REMINDERS = 5;
export const REMINDER_OPTIONS = [
  { id: 'atTime', days: 0, ms: 0 },
  { id: 'h1', days: 0, ms: 3600000, timedOnly: true },
  { id: 'd1', days: 1, ms: 0 },
  { id: 'd2', days: 2, ms: 0 },
  { id: 'w1', days: 7, ms: 0 },
];
const BY_ID = new Map(REMINDER_OPTIONS.map((o) => [o.id, o]));

export const isTimed = (ev) => isValidTime(ev && ev.time);

/** Options that make sense for this event (an "hour before" needs a clock time). */
export const optionsFor = (ev) => REMINDER_OPTIONS.filter((o) => !o.timedOnly || isTimed(ev));

/** Keep known, distinct, applicable ids in canonical order (max 5). */
export function sanitizeReminders(list, ev = {}) {
  const want = new Set(Array.isArray(list) ? list : []);
  return optionsFor(ev).filter((o) => want.has(o.id)).map((o) => o.id).slice(0, MAX_REMINDERS);
}

/** Instant (ms) the occurrence on `dateISO` starts, or 09:00 local for all-day events. */
export function anchorMs(ev, dateISO) {
  if (isTimed(ev)) return eventInstantMs(ev, dateISO);
  const p = parseISODate(dateISO);
  return new Date(p.y, p.m - 1, p.d, ALL_DAY_HOUR, 0, 0).getTime();
}

/** When reminder `id` fires for the occurrence on `dateISO` (ms), or NaN if unknown. */
export function fireAtMs(ev, dateISO, id) {
  const opt = BY_ID.get(id);
  if (!opt || !parseISODate(dateISO)) return NaN;
  const day = opt.days ? addDays(dateISO, -opt.days) : dateISO;
  return anchorMs(ev, day) - opt.ms;
}

/**
 * Reminders of display items (`getEvents()` output) whose fire time lies in (fromMs, toMs].
 * Sorted by fire time. Key is stable so a reminder is never announced twice.
 */
export function remindersBetween(items, fromMs, toMs) {
  const out = [];
  const seen = new Set();
  for (const ev of items) {
    if (!ev.userEvent || ev.archived || !Array.isArray(ev.reminders) || !ev.reminders.length) continue;
    for (const id of sanitizeReminders(ev.reminders, ev)) {
      const key = `${ev.seriesId}|${ev.date}|${id}`;
      if (seen.has(key)) continue;
      const at = fireAtMs(ev, ev.date, id);
      if (at > fromMs && at <= toMs) {
        seen.add(key);
        out.push({ key, at, id, ev });
      }
    }
  }
  return out.sort((a, b) => a.at - b.at || (a.key < b.key ? -1 : 1));
}

/** The next `limit` reminders after `nowMs` within `horizonDays`. */
export function upcomingReminders(items, nowMs, { horizonDays = 14, limit = 6 } = {}) {
  return remindersBetween(items, nowMs, nowMs + horizonDays * 86400000).slice(0, limit);
}
