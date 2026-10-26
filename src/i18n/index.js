import en from './en.js';
import mk from './mk.js';
import { MK_MONTHS_LONG, MK_MONTHS_SHORT, MK_WEEKDAYS_LONG, MK_WEEKDAYS_SHORT, mkPlural } from './mk-dates.js';

export const LANGS = {
  en: { label: 'English', locale: 'en-US', dict: en, plural: (n) => (Math.abs(n) === 1 ? 'one' : 'other') },
  mk: { label: 'Македонски', locale: 'mk-MK', dict: mk, plural: mkPlural },
};

let current = 'en';
const listeners = new Set();

export function getLang() {
  return current;
}

export function getLocale() {
  return LANGS[current].locale;
}

export function setLang(lang, { silent = false } = {}) {
  if (!LANGS[lang]) lang = 'en';
  current = lang;
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
  if (!silent) listeners.forEach((fn) => fn(lang));
}

export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function lookup(dict, key) {
  let node = dict;
  for (const part of key.split('.')) {
    if (node == null || typeof node !== 'object') return undefined;
    node = node[part];
  }
  return node;
}

function interpolate(str, params) {
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (params[k] != null ? String(params[k]) : `{${k}}`));
}

/** Translate a dotted key. Plural entries use params.count. Falls back to English, then the key. */
export function t(key, params) {
  let value = lookup(LANGS[current].dict, key);
  if (value === undefined) value = lookup(en, key);
  if (value === undefined) return key;
  if (typeof value === 'object') {
    const n = Number(params && params.count);
    const form = LANGS[current].plural(Number.isFinite(n) ? n : 0);
    value = value[form] ?? value.other ?? value.one ?? key;
  }
  return interpolate(String(value), params);
}

/** Localized unit word for a count, e.g. unit('day', 5) -> "days" / "дена". */
export function unit(name, count) {
  return t(`units.${name}`, { count });
}

export function formatNumber(n) {
  const s = new Intl.NumberFormat('en-US').format(n);
  return current === 'mk' ? s.replace(/,/g, '.') : s; // mk groups thousands with a dot
}

/** "42 days" / "42 дена" */
export function formatDays(n) {
  return `${formatNumber(n)} ${unit('day', n)}`;
}

function utcDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Locale date formatting for floating ISO dates. Supports the option subset Countly
 * uses: weekday, year, month ('short'|'long'), day and dateStyle: 'full'.
 */
export function formatDate(iso, opts = { year: 'numeric', month: 'short', day: 'numeric' }) {
  const date = utcDate(iso);
  if (current !== 'mk') return new Intl.DateTimeFormat(getLocale(), { ...opts, timeZone: 'UTC' }).format(date);

  const o = opts.dateStyle === 'full' ? { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' } : opts;
  const wd = o.weekday ? (o.weekday === 'long' ? MK_WEEKDAYS_LONG : MK_WEEKDAYS_SHORT)[date.getUTCDay()] : '';
  const day = o.day ? String(date.getUTCDate()) : '';
  const month = o.month ? (o.month === 'long' ? MK_MONTHS_LONG : MK_MONTHS_SHORT)[date.getUTCMonth()] : '';
  const year = o.year ? String(date.getUTCFullYear()) + (o.month === 'long' ? ' г.' : '') : '';
  const rest = [day, month, year].filter(Boolean).join(' ');
  return wd && rest ? `${wd}, ${rest}` : wd || rest;
}

export function formatMonthYear(y, m) {
  if (current === 'mk') return `${MK_MONTHS_LONG[m - 1]} ${y}`;
  return new Intl.DateTimeFormat(getLocale(), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)));
}

export function monthShort(m) {
  if (current === 'mk') return MK_MONTHS_SHORT[m - 1];
  return new Intl.DateTimeFormat(getLocale(), { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, m - 1, 1)));
}

/** Short weekday names starting at `weekStart` (0 = Sunday, 1 = Monday). */
export function weekdayNames(weekStart = 1, width = 'short') {
  if (current === 'mk') {
    const src = width === 'long' ? MK_WEEKDAYS_LONG : MK_WEEKDAYS_SHORT;
    return Array.from({ length: 7 }, (_, i) => src[(i + weekStart) % 7]);
  }
  const fmt = new Intl.DateTimeFormat(getLocale(), { weekday: width, timeZone: 'UTC' });
  // 2024-01-07 is a Sunday.
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2024, 0, 7 + ((i + weekStart) % 7)))));
}

export function greetingKey(hour) {
  if (hour >= 5 && hour < 12) return 'greeting.morning';
  if (hour >= 12 && hour < 18) return 'greeting.afternoon';
  if (hour >= 18 && hour < 22) return 'greeting.evening';
  return 'greeting.night';
}
