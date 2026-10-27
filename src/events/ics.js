// iCalendar (.ics) export. This is the dependable way to get real alerts without a server: the
// phone/desktop calendar app delivers the VALARMs even when Countly is closed.
// Pure string building, no DOM. Known limits are listed in docs/REMINDERS.md (month-end and Feb 29
// recurrences follow the calendar standard, which skips months instead of clamping; per-occurrence
// renames/notes are not exported).
import { parseISODate, addDays } from '../date/calendar.js';
import { eventInstantMs, isValidTime } from '../date/instant.js';
import { normalizeRule } from '../date/recurrence.js';
import { sanitizeReminders, REMINDER_OPTIONS, ALL_DAY_HOUR } from './reminders.js';

const pad = (n, w = 2) => String(n).padStart(w, '0');
const ymd = (iso) => iso.replaceAll('-', '');

/** Escape a TEXT value (RFC 5545 §3.3.11). */
export const escapeText = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');

/** Fold one logical line to <=75 octets per physical line without splitting a UTF-8 character. */
export function foldLine(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts = [];
  let cur = '';
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > limit) {
      parts.push(cur);
      cur = ' ';
      bytes = 1;
      limit = 75;
    }
    cur += ch;
    bytes += n;
  }
  parts.push(cur);
  return parts.join('\r\n');
}

const utc = (ms) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
};
const floating = (iso, hhmm) => `${ymd(iso)}T${hhmm.replace(':', '')}00`;

/** Trigger for a reminder, relative to the VEVENT start. All-day reminders fire at 09:00. */
export function triggerFor(id, timed) {
  const opt = REMINDER_OPTIONS.find((o) => o.id === id);
  if (!opt) return null;
  if (timed) return opt.days ? `-P${opt.days}D` : opt.ms ? `-PT${opt.ms / 3600000}H` : 'PT0S';
  // all-day start is midnight: 09:00 on the target day is ALL_DAY_HOUR hours after (that day's) midnight
  const hours = opt.days * 24 - ALL_DAY_HOUR;
  return hours > 0 ? `-PT${hours}H` : hours === 0 ? 'PT0S' : `PT${-hours}H`;
}

function dtLines(ev) {
  if (!isValidTime(ev.time)) {
    return { start: `DTSTART;VALUE=DATE:${ymd(ev.date)}`, end: `DTEND;VALUE=DATE:${ymd(addDays(ev.date, 1))}`, kind: 'date' };
  }
  if (ev.tz) {
    const s = eventInstantMs(ev, ev.date);
    return { start: `DTSTART:${utc(s)}`, end: `DTEND:${utc(s + 3600000)}`, kind: 'utc' };
  }
  const [hh, mm] = ev.time.split(':').map(Number);
  const endH = hh + 1;
  const endDate = endH >= 24 ? addDays(ev.date, 1) : ev.date;
  return { start: `DTSTART:${floating(ev.date, ev.time)}`, end: `DTEND:${floating(endDate, `${pad(endH % 24)}:${pad(mm)}`)}`, kind: 'floating' };
}

const FREQ = { daily: 'DAILY', weekly: 'WEEKLY', monthly: 'MONTHLY', yearly: 'YEARLY' };

/** One VEVENT (array of unfolded lines) for a stored series record. */
export function veventLines(ev, now = Date.now()) {
  const dt = dtLines(ev);
  const timed = dt.kind !== 'date';
  const lines = ['BEGIN:VEVENT', `UID:${escapeText(ev.id)}@countly.app`, `DTSTAMP:${utc(now)}`, dt.start, dt.end, `SUMMARY:${escapeText(ev.title)}`];
  const desc = [ev.description, ev.notes].filter((x) => x && String(x).trim()).join('\n\n');
  if (desc) lines.push(`DESCRIPTION:${escapeText(desc)}`);
  if (ev.location) lines.push(`LOCATION:${escapeText(ev.location)}`);
  const rule = normalizeRule(ev.recurrence);
  if (rule.freq !== 'none') {
    let rrule = `RRULE:FREQ=${FREQ[rule.freq]};INTERVAL=${rule.interval}`;
    if (rule.until) rrule += `;UNTIL=${dt.kind === 'date' ? ymd(rule.until) : dt.kind === 'utc' ? utc(eventInstantMs({ ...ev, time: '23:59' }, rule.until)) : floating(rule.until, '23:59')}`;
    lines.push(rrule);
    for (const skip of ev.skips || []) {
      if (!parseISODate(skip)) continue;
      lines.push(dt.kind === 'date' ? `EXDATE;VALUE=DATE:${ymd(skip)}` : dt.kind === 'utc' ? `EXDATE:${utc(eventInstantMs(ev, skip))}` : `EXDATE:${floating(skip, ev.time)}`);
    }
  }
  for (const id of sanitizeReminders(ev.reminders, ev)) {
    const trigger = triggerFor(id, timed);
    if (trigger) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(ev.title)}`, `TRIGGER;RELATED=START:${trigger}`, 'END:VALARM');
  }
  lines.push('END:VEVENT');
  return lines;
}

/** Complete calendar text (CRLF line endings, folded). `events` are stored series records. */
export function buildIcs(events, { now = Date.now(), name = 'Countly' } = {}) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Countly//Countdown calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${escapeText(name)}`];
  for (const ev of events) if (parseISODate(ev.date)) lines.push(...veventLines(ev, now));
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

/** Safe download name: letters, digits, dashes. */
export function icsFilename(title) {
  const base = String(title || 'countly').normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase().slice(0, 40);
  return `${base || 'countly'}.ics`;
}
