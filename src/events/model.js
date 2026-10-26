// Event model: defaults, validation (typed, no framework) and record migration.
// Validation returns i18n codes under `validation.*`; it never throws on user input.
import { parseISODate } from '../date/calendar.js';
import { normalizeRule, FREQS } from '../date/recurrence.js';
import { isValidTime, isValidTimeZone } from '../date/instant.js';
import { isKnownCategory, categoryById } from './categories.js';

export const SCHEMA = 1;

export const SCENE_IDS = ['birthday', 'beach', 'coast', 'tooth', 'car', 'laptop', 'mountain', 'concert', 'house', 'runner', 'graduation', 'rocket', 'wedding', 'fireworks', 'deadline', 'holiday'];
export const SCENE_FOR_CATEGORY = { celebration: 'birthday', travel: 'beach', work: 'laptop', health: 'tooth', personal: 'house', other: 'mountain' };
/** Default scene for a category (built-in map, or the custom category's own choice). */
export const sceneForCategory = (id) => SCENE_FOR_CATEGORY[id] || categoryById(id).scene || 'mountain';

export const LIMITS = { title: 80, description: 200, notes: 5000, location: 120, emoji: 8, interval: 999, reflection: 600 };

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const isoOrNull = (v) => (typeof v === 'string' && parseISODate(v) ? v : null);

export function newId() {
  const rand = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `ev-${rand}`;
}

export function emptyForm(todayISO) {
  return {
    title: '',
    emoji: '',
    date: todayISO || '',
    time: null,
    tz: null,
    start: null,
    category: 'celebration',
    scene: SCENE_FOR_CATEGORY.celebration,
    location: '',
    description: '',
    notes: '',
    pinned: false,
    milestones: true,
    recurrence: { freq: 'none', interval: 1, until: null },
  };
}

/**
 * Validate form input. Returns { ok, errors: {field: code}, value } where `value` is the
 * cleaned event payload (no id / timestamps).
 */
export function validateEvent(input) {
  const errors = {};
  const i = input || {};
  const title = str(i.title, 10000);
  if (!title) errors.title = 'titleRequired';
  else if (title.length > LIMITS.title) errors.title = 'titleTooLong';

  const date = typeof i.date === 'string' ? i.date : '';
  if (!date) errors.date = 'dateRequired';
  else if (!parseISODate(date)) errors.date = 'dateInvalid';

  const start = i.start ? String(i.start) : null;
  if (start) {
    if (!parseISODate(start)) errors.start = 'dateInvalid';
    else if (!errors.date && start > date) errors.start = 'startAfterDate';
  }

  let time = i.time ? String(i.time) : null;
  if (time && !isValidTime(time)) errors.time = 'timeInvalid';
  let tz = i.tz ? String(i.tz) : null;
  if (tz && !time) tz = null; // a zone only means something for timed events
  if (tz && !isValidTimeZone(tz)) errors.tz = 'tzInvalid';

  const rawRule = i.recurrence || {};
  const freq = FREQS.includes(rawRule.freq) ? rawRule.freq : 'none';
  const interval = Number(rawRule.interval ?? 1);
  if (freq !== 'none' && (!Number.isInteger(interval) || interval < 1 || interval > LIMITS.interval)) errors.interval = 'intervalInvalid';
  let until = rawRule.until ? String(rawRule.until) : null;
  if (freq !== 'none' && until) {
    if (!parseISODate(until)) errors.until = 'dateInvalid';
    else if (!errors.date && until < date) errors.until = 'untilBeforeDate';
  }

  if (str(i.description, 100000).length > LIMITS.description) errors.description = 'descriptionTooLong';
  if (str(i.notes, 100000).length > LIMITS.notes) errors.notes = 'notesTooLong';
  if (str(i.location, 100000).length > LIMITS.location) errors.location = 'locationTooLong';
  if ([...str(i.emoji, 100)].length > 4) errors.emoji = 'emojiTooLong';

  const category = isKnownCategory(i.category) ? i.category : 'other';
  const scene = SCENE_IDS.includes(i.scene) ? i.scene : sceneForCategory(category);

  const value = {
    title: title.slice(0, LIMITS.title),
    emoji: str(i.emoji, 16),
    date,
    time: time || null,
    tz: tz || null,
    start: start || null,
    category,
    scene,
    location: str(i.location, LIMITS.location),
    description: str(i.description, LIMITS.description),
    notes: typeof i.notes === 'string' ? i.notes.trim().slice(0, LIMITS.notes) : '',
    pinned: !!i.pinned,
    milestones: i.milestones !== false,
    recurrence: freq === 'none' ? { freq: 'none', interval: 1, until: null } : { freq, interval: Number.isInteger(interval) ? Math.min(Math.max(interval, 1), LIMITS.interval) : 1, until: until && !errors.until ? until : null },
  };
  return { ok: Object.keys(errors).length === 0, errors, value };
}

/**
 * Upgrade/repair a stored record to the current schema. Returns null when the record is
 * unusable (no id or no valid date) so the caller can quarantine it instead of crashing.
 */
export function migrateRecord(raw, known = null) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id) return null;
  if (!isoOrNull(raw.date)) return null;
  const now = Date.now();
  // schema 0 (no `schema` field): flat `repeat: 'yearly'` and `favorite` instead of recurrence/pinned.
  const legacyRepeat = typeof raw.repeat === 'string' && FREQS.includes(raw.repeat) ? raw.repeat : null;
  const rule = normalizeRule(raw.recurrence || (legacyRepeat ? { freq: legacyRepeat } : null));
  const category = (known ? known(raw.category) : isKnownCategory(raw.category)) ? raw.category : 'other';
  const skips = Array.isArray(raw.skips) ? [...new Set(raw.skips.filter((d) => isoOrNull(d)))].sort() : [];
  const overrides = {};
  if (raw.overrides && typeof raw.overrides === 'object') {
    for (const [d, o] of Object.entries(raw.overrides)) {
      if (!isoOrNull(d) || !o || typeof o !== 'object') continue;
      const clean = {};
      if (typeof o.title === 'string' && o.title.trim()) clean.title = o.title.trim().slice(0, LIMITS.title);
      if (typeof o.notes === 'string') clean.notes = o.notes.slice(0, LIMITS.notes);
      if (typeof o.reflection === 'string' && o.reflection.trim()) clean.reflection = o.reflection.trim().slice(0, LIMITS.reflection);
      if (Object.keys(clean).length) overrides[d] = clean;
    }
  }
  return {
    id: raw.id,
    schema: SCHEMA,
    title: str(raw.title, LIMITS.title) || '—',
    emoji: str(raw.emoji, 16),
    date: raw.date,
    time: isValidTime(raw.time) ? raw.time : null,
    tz: isValidTime(raw.time) && isValidTimeZone(raw.tz) ? raw.tz : null,
    start: isoOrNull(raw.start),
    category,
    scene: SCENE_IDS.includes(raw.scene) ? raw.scene : sceneForCategory(category),
    location: str(raw.location, LIMITS.location),
    description: str(raw.description, LIMITS.description),
    notes: typeof raw.notes === 'string' ? raw.notes.slice(0, LIMITS.notes) : '',
    pinned: !!(raw.pinned ?? raw.favorite),
    milestones: raw.milestones !== false,
    archived: !!raw.archived,
    recurrence: rule,
    skips,
    overrides,
    createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : now,
    updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : now,
  };
}
