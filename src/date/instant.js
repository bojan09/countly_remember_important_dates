// Instants (timed events). Policy:
//  - All-day events are FLOATING dates: they start at local midnight wherever you are.
//  - Timed events without a time zone are floating local times ("dinner at 19:00").
//  - Timed events with an IANA time zone are absolute instants ("flight at 07:40 Europe/Skopje"):
//    the countdown stays correct if you travel or change the device time zone.
// Spring-forward gaps resolve to the first valid time after the gap; fall-back ambiguity resolves
// to the earlier instant. Day arithmetic never uses 86,400,000 ms.
import { parseISODate } from './calendar.js';

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const isValidTime = (s) => typeof s === 'string' && TIME_RE.test(s);

export function isValidTimeZone(tz) {
  if (typeof tz !== 'string' || !tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const fmtCache = new Map();
function zoneFormatter(tz) {
  if (!fmtCache.has(tz)) {
    fmtCache.set(
      tz,
      new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }),
    );
  }
  return fmtCache.get(tz);
}

/** Offset (ms) of `tz` from UTC at the instant `ts`: local wall time minus UTC. */
export function zoneOffsetMs(ts, tz) {
  const parts = {};
  for (const p of zoneFormatter(tz).formatToParts(new Date(Math.floor(ts / 1000) * 1000))) parts[p.type] = Number(p.value);
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour % 24, parts.minute, parts.second) - Math.floor(ts / 1000) * 1000;
}

/** Wall-clock date + time in `tz` -> UTC milliseconds. */
export function zonedToUtc(dateISO, hhmm, tz) {
  const p = parseISODate(dateISO);
  if (!p || !isValidTime(hhmm) || !isValidTimeZone(tz)) return NaN;
  const [hh, mm] = hhmm.split(':').map(Number);
  const guess = Date.UTC(p.y, p.m - 1, p.d, hh, mm);
  const off1 = zoneOffsetMs(guess, tz);
  const c1 = guess - off1;
  const off2 = zoneOffsetMs(c1, tz);
  const c2 = guess - off2;
  const valid = [c1, c2].filter((c) => zoneOffsetMs(c, tz) === guess - c);
  // none valid = wall time falls in a spring-forward gap: interpret with the pre-gap offset.
  return valid.length ? Math.min(...valid) : c1;
}

/** Start instant (ms) of the occurrence of `ev` on `dateISO`. */
export function eventInstantMs(ev, dateISO = ev.date) {
  const p = parseISODate(dateISO);
  if (!p) return NaN;
  if (!isValidTime(ev.time)) return new Date(p.y, p.m - 1, p.d, 0, 0, 0).getTime();
  if (ev.tz && isValidTimeZone(ev.tz)) return zonedToUtc(dateISO, ev.time, ev.tz);
  const [hh, mm] = ev.time.split(':').map(Number);
  return new Date(p.y, p.m - 1, p.d, hh, mm, 0).getTime();
}

/** Milliseconds -> whole days / hours / minutes / seconds (floor), clamped at 0. */
export function splitDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(total / 86400), h: Math.floor((total % 86400) / 3600), m: Math.floor((total % 3600) / 60), s: total % 60 };
}
