// Milestones are derived from an event's date, never stored: "100 days to go" before it,
// "1 year since" after it. The only stored part is the per-event on/off switch (`milestones`).
// Pure functions, no DOM, so the rules are unit-testable and reusable by reminders later.
import { addDays, diffDays, parseISODate, toISO, daysInMonth, todayISO } from '../date/calendar.js';

/** Markers before the event: `years` use the calendar date, `days` count back. */
export const TOGO = [
  { id: 'togo-1y', years: 1 },
  { id: 'togo-100', days: 100 },
  { id: 'togo-30', days: 30 },
  { id: 'togo-7', days: 7 },
  { id: 'togo-1', days: 1 },
];

/** Markers after the event. Year markers are skipped for repeating events (the next occurrence is the milestone). */
export const SINCE = [
  { id: 'since-7', days: 7 },
  { id: 'since-30', days: 30 },
  { id: 'since-100', days: 100 },
  { id: 'since-1y', years: 1 },
  { id: 'since-2y', years: 2 },
  { id: 'since-5y', years: 5 },
  { id: 'since-10y', years: 10 },
];

/** Same month/day `n` years away (Feb 29 -> Feb 28 in non-leap years). */
export function shiftYears(iso, n) {
  const p = parseISODate(iso);
  const y = p.y + n;
  return toISO({ y, m: p.m, d: Math.min(p.d, daysInMonth(y, p.m)) });
}

const localDay = (ms) => todayISO(new Date(ms));

/**
 * Milestones of one event item (`ev.date`, optional `start`, `createdAt`, `milestones`, `recurring`).
 * Returned sorted by date: { id, kind: 'togo'|'since', days?, years?, date, state: 'passed'|'today'|'upcoming', away }.
 * "To go" markers that fell before the event was created or started are left out (they never applied).
 */
export function milestonesFor(ev, today) {
  if (!ev || ev.milestones === false || !parseISODate(ev.date)) return [];
  const floor = [ev.start, ev.createdAt ? localDay(ev.createdAt) : null].filter(Boolean).sort().pop() || null;
  const defs = [];
  if (ev.date > today) {
    for (const d of TOGO) defs.push({ ...d, kind: 'togo', date: d.years ? shiftYears(ev.date, -d.years) : addDays(ev.date, -d.days) });
  }
  if (ev.date <= today) {
    for (const d of SINCE) {
      if (d.years && ev.recurring) continue;
      defs.push({ ...d, kind: 'since', date: d.years ? shiftYears(ev.date, d.years) : addDays(ev.date, d.days) });
    }
  }
  return defs
    .filter((m) => m.kind === 'since' || !floor || m.date >= floor)
    .filter((m) => m.date < ev.date || m.kind === 'since')
    .map((m) => ({ ...m, away: diffDays(today, m.date), state: m.date < today ? 'passed' : m.date === today ? 'today' : 'upcoming' }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** The first milestone that is today or still ahead, or null. */
export function nextMilestone(ev, today) {
  return milestonesFor(ev, today).find((m) => m.state !== 'passed') || null;
}

/** For a yearly series: how many years this occurrence is after the first one (0 = the first). */
export function anniversaryYears(ev) {
  if (!ev || !ev.recurring || !ev.recurrence || ev.recurrence.freq !== 'yearly' || !ev.origin) return 0;
  return Math.max(0, parseISODate(ev.date).y - parseISODate(ev.origin).y);
}
