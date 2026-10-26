// Human-readable summaries of event data (localized).
import { t, unit, formatDate, formatNumber } from '../i18n/index.js';
import { normalizeRule } from '../date/recurrence.js';

const UNIT_OF = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' };

/** "Repeats every year", "Repeats every 3 months until Dec 1, 2030" or "" for one-time events. */
export function recurrenceSummary(rawRule) {
  const r = normalizeRule(rawRule);
  if (r.freq === 'none') return '';
  const base = r.interval === 1 ? t(`recur.each.${r.freq}`) : t('recur.every', { count: formatNumber(r.interval), unit: unit(UNIT_OF[r.freq], r.interval) });
  return r.until ? `${base} · ${t('recur.until', { date: formatDate(r.until) })}` : base;
}

/** "19:30" for floating times, "07:40 · Europe/Skopje" for zoned instants, '' for all-day. */
export function timeLine(ev) {
  if (!ev.time) return '';
  return ev.tz ? t('detail.zoneLine', { time: ev.time, zone: ev.tz.replace(/_/g, ' ') }) : ev.time;
}
