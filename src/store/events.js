// Event store. User events live in IndexedDB (see db.js) and are mirrored in memory so every
// view can read synchronously. Mutations persist first, then update memory, then notify.
//
// What views receive is a list of display ITEMS derived from series:
//  - one-time event  -> one item (upcoming or past by its date)
//  - recurring event -> its next occurrence (upcoming) plus its most recent past occurrence
//    (a memory). Never an unbounded list, so forever-series cannot be double counted or blow up.
// Sample events (flagged `sample: true`) are merged in only while the "show samples" pref is on.
import { getPrefs } from './prefs.js';
import { buildSampleEvents } from './demo.js';
import { openStorage } from './db.js';
import { migrateRecord, validateEvent, newId, SCHEMA } from '../events/model.js';
import { nextActive, prevActive, isRecurring, normalizeRule, nextOccurrence, occurrencesBetween } from '../date/recurrence.js';
import { t } from '../i18n/index.js';
import { buildBackup, planImport } from './backup.js';

export const PHOTO_LIMITS = { maxBytes: 8 * 1024 * 1024, maxPerEvent: 12 };

let storage = null;
let series = new Map();
let photoMeta = new Map(); // eventId -> [{id,name,type,size,createdAt}]
let version = 0;
let channel = null;
const listeners = new Set();

export const storeStatus = { ready: false, persistent: true, error: null, skipped: 0 };

/* ---------- lifecycle ---------- */
async function loadAll() {
  const raw = await storage.getAll('events');
  const next = new Map();
  let skipped = 0;
  const repaired = [];
  for (const r of raw) {
    const m = migrateRecord(r);
    if (!m) {
      skipped++;
      continue;
    }
    if (r.schema !== SCHEMA) repaired.push(m);
    next.set(m.id, m);
  }
  if (repaired.length) await storage.putMany('events', repaired).catch(() => {});
  series = next;
  storeStatus.skipped = skipped;
  const meta = new Map();
  for (const p of await storage.getAll('photos')) {
    const list = meta.get(p.eventId) || [];
    list.push({ id: p.id, name: p.name, type: p.type, size: p.size, createdAt: p.createdAt });
    meta.set(p.eventId, list);
  }
  for (const list of meta.values()) list.sort((a, b) => a.createdAt - b.createdAt);
  photoMeta = meta;
}

/** Open storage and load everything. Pass { adapter } to inject storage (tests). */
export async function initStore({ adapter, broadcast = true } = {}) {
  if (adapter) {
    storage = adapter;
    storeStatus.persistent = adapter.kind !== 'memory';
    storeStatus.error = null;
  } else {
    const opened = await openStorage();
    storage = opened.adapter;
    storeStatus.persistent = opened.persistent;
    storeStatus.error = opened.error;
  }
  try {
    await loadAll();
  } catch (err) {
    // Unreadable store: keep the app usable with an empty in-memory session instead of crashing.
    console.error(err);
    const { memoryAdapter } = await import('./db.js');
    storage = memoryAdapter();
    storeStatus.persistent = false;
    storeStatus.error = String((err && err.message) || err);
    series = new Map();
    photoMeta = new Map();
  }
  storeStatus.ready = true;
  if (broadcast && typeof BroadcastChannel !== 'undefined' && !channel) {
    try {
      channel = new BroadcastChannel('countly-events');
      channel.onmessage = async () => {
        try {
          await loadAll();
          bump(false);
        } catch (err) {
          console.error(err);
        }
      };
    } catch {
      channel = null;
    }
  }
  bump(false);
}

function bump(announce = true) {
  version++;
  if (announce && channel) {
    try {
      channel.postMessage({ type: 'changed' });
    } catch {
      /* channel closed */
    }
  }
  listeners.forEach((fn) => fn());
}

/** Subscribe to any store change (local or from another tab). Returns an unsubscribe fn. */
export function onStoreChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/* ---------- derivation ---------- */
function makeItem(s, date, { past, start, occ = false }) {
  const ov = s.overrides[date] || {};
  const recurring = isRecurring(s.recurrence);
  return {
    id: recurring && (past || occ) ? `${s.id}@${date}` : s.id,
    seriesId: s.id,
    userEvent: true,
    sample: false,
    recurring,
    title: ov.title || s.title,
    notes: ov.notes != null ? ov.notes : s.notes,
    description: s.description,
    emoji: s.emoji,
    location: s.location,
    date,
    time: s.time,
    tz: s.tz,
    start,
    category: s.category,
    scene: s.scene,
    pinned: s.pinned,
    archived: s.archived,
    recurrence: s.recurrence,
    photos: (photoMeta.get(s.id) || []).length,
    overridden: !!s.overrides[date],
    createdAt: s.createdAt,
  };
}

export function deriveSeries(s, today) {
  const rule = normalizeRule(s.recurrence);
  if (rule.freq === 'none') return [makeItem(s, s.date, { past: s.date < today, start: s.start })];
  const items = [];
  const next = nextActive(rule, s.date, today, s.skips);
  const prev = prevActive(rule, s.date, today, s.skips);
  if (next) items.push(makeItem(s, next, { past: false, start: prev || s.start }));
  if (prev) items.push(makeItem(s, prev, { past: true, start: null }));
  return items;
}

let cacheKey = '';
let cache = [];
let sampleCacheKey = '';
let sampleCache = [];

function samples(today) {
  const key = `${today}|${getPrefs().showSamples}`;
  if (key !== sampleCacheKey) {
    sampleCacheKey = key;
    sampleCache = getPrefs().showSamples ? buildSampleEvents(today) : [];
  }
  return sampleCache;
}

export function getEvents(today) {
  const key = `${today}|${getPrefs().showSamples}|${version}`;
  if (key !== cacheKey) {
    cacheKey = key;
    const mine = [];
    for (const s of series.values()) if (!s.archived) mine.push(...deriveSeries(s, today));
    cache = [...samples(today), ...mine];
  }
  return cache;
}

/** Archived series as display items (one per series). */
export function getArchived(today) {
  const out = [];
  for (const s of series.values()) if (s.archived) out.push(deriveSeries(s, today)[0]);
  return out.filter(Boolean);
}

export function getEvent(id, today) {
  if (!id) return null;
  const listed = getEvents(today).find((e) => e.id === id);
  if (listed) return listed;
  const sid = id.includes('@') ? id.split('@')[0] : id;
  const s = series.get(sid);
  if (!s) return null;
  const items = deriveSeries(s, today);
  const found = items.find((e) => e.id === id) || (id === sid ? items[0] : null);
  if (found) return found;
  // Any other valid occurrence of a recurring series (e.g. one opened from the calendar).
  const date = id.includes('@') ? id.split('@')[1] : null;
  if (date && isRecurring(s.recurrence) && !s.skips.includes(date) && nextOccurrence(s.recurrence, s.date, date) === date) {
    return makeItem(s, date, { past: date < today, start: null, occ: true });
  }
  return null;
}

/**
 * Every occurrence (not just the next/last) inside [from, to], including sample events.
 * Bounded: at most 400 occurrences per series. Used by Calendar views.
 */
export function getOccurrencesBetween(from, to, today) {
  const out = samples(today).filter((e) => e.date >= from && e.date <= to);
  for (const s of series.values()) {
    if (s.archived) continue;
    const rule = normalizeRule(s.recurrence);
    if (rule.freq === 'none') {
      if (s.date >= from && s.date <= to) out.push(makeItem(s, s.date, { past: s.date < today, start: s.start }));
      continue;
    }
    for (const d of occurrencesBetween(rule, s.date, from, to, 400)) {
      if (!s.skips.includes(d)) out.push(makeItem(s, d, { past: d < today, start: null, occ: true }));
    }
  }
  return out;
}

/** Raw stored series (user events only). */
export const getSeries = (id) => series.get(id) || null;
export const userEventCount = () => series.size;

/* ---------- mutations ---------- */
async function persist(rec) {
  await storage.put('events', rec);
  series.set(rec.id, rec);
  bump();
  return rec;
}

/** Create (id omitted) or update. Returns { ok, event } or { ok:false, errors }. */
export async function saveEvent(input, id = null) {
  const { ok, errors, value } = validateEvent(input);
  if (!ok) return { ok: false, errors };
  const existing = id ? series.get(id) : null;
  if (id && !existing) return { ok: false, errors: { _: 'notFound' } };
  const now = Date.now();
  const rec = { skips: [], overrides: {}, archived: false, createdAt: now, ...(existing || {}), ...value, id: existing ? existing.id : newId(), schema: SCHEMA, updatedAt: now };
  if (existing && (existing.date !== value.date || JSON.stringify(existing.recurrence) !== JSON.stringify(value.recurrence))) {
    // The series definition moved: old per-occurrence exceptions no longer line up with it.
    rec.skips = [];
    rec.overrides = {};
  }
  return { ok: true, event: await persist(rec) };
}

/** Remove a series and its photos. Returns a snapshot for undo. */
export async function removeEvent(id) {
  const rec = series.get(id);
  if (!rec) return null;
  const photos = await storage.getAllWhere('photos', 'eventId', id);
  await storage.deleteWhere('photos', 'eventId', id);
  await storage.delete('events', id);
  series.delete(id);
  photoMeta.delete(id);
  bump();
  return { record: rec, photos };
}

export async function restoreRemoved(snapshot) {
  if (!snapshot) return;
  await storage.put('events', snapshot.record);
  if (snapshot.photos.length) await storage.putMany('photos', snapshot.photos);
  series.set(snapshot.record.id, snapshot.record);
  await loadAll();
  bump();
}

export async function duplicateEvent(source) {
  const base = source.userEvent ? series.get(source.seriesId) : null;
  const src = base || {
    title: source.title,
    emoji: source.emoji || '',
    date: source.date,
    time: source.time || null,
    tz: source.tz || null,
    start: source.start || null,
    category: source.category,
    scene: source.scene,
    location: '',
    description: '',
    notes: source.notes || '',
    pinned: false,
    recurrence: { freq: 'none', interval: 1, until: null },
  };
  const res = await saveEvent({ ...src, title: t('detail.copyTitle', { title: src.title }).slice(0, 80), pinned: false });
  return res.ok ? res.event : null;
}

async function patch(id, fields) {
  const s = series.get(id);
  if (!s) return null;
  return persist({ ...s, ...fields, updatedAt: Date.now() });
}

export const setArchived = (id, archived) => patch(id, { archived: !!archived });
export const setPinned = (id, pinned) => patch(id, { pinned: !!pinned });

export async function setSkipped(id, date, skipped) {
  const s = series.get(id);
  if (!s) return null;
  const skips = new Set(s.skips);
  if (skipped) skips.add(date);
  else skips.delete(date);
  return patch(id, { skips: [...skips].sort() });
}

/** Override title/notes of a single occurrence (pass null to reset). */
export async function setOverride(id, date, override) {
  const s = series.get(id);
  if (!s) return null;
  const overrides = { ...s.overrides };
  const clean = {};
  if (override && override.title && override.title.trim()) clean.title = override.title.trim().slice(0, 80);
  if (override && typeof override.notes === 'string' && override.notes.trim()) clean.notes = override.notes.trim().slice(0, 5000);
  if (Object.keys(clean).length) overrides[date] = clean;
  else delete overrides[date];
  return patch(id, { overrides });
}

/* ---------- photos (local Blobs) ---------- */
export const listPhotos = (eventId) => photoMeta.get(eventId) || [];

export async function addPhoto(eventId, file) {
  if (!series.has(eventId)) throw new Error('notFound');
  if (!file || !/^image\//.test(file.type || '')) throw new Error('photoType');
  if (file.size > PHOTO_LIMITS.maxBytes) throw new Error('photoSize');
  if (listPhotos(eventId).length >= PHOTO_LIMITS.maxPerEvent) throw new Error('photoCount');
  const rec = { id: newId().replace('ev-', 'ph-'), eventId, name: String(file.name || 'photo').slice(0, 120), type: file.type, size: file.size, blob: file, createdAt: Date.now() };
  await storage.put('photos', rec);
  const list = [...listPhotos(eventId), { id: rec.id, name: rec.name, type: rec.type, size: rec.size, createdAt: rec.createdAt }];
  photoMeta.set(eventId, list);
  bump();
  return rec.id;
}

export async function getPhotoBlob(id) {
  const rec = await storage.get('photos', id);
  return rec ? rec.blob : null;
}

export async function removePhoto(eventId, id) {
  await storage.delete('photos', id);
  photoMeta.set(eventId, listPhotos(eventId).filter((p) => p.id !== id));
  bump();
}

/* ---------- backup / restore ---------- */
/** Serialize every user event, photo and the backup-worthy preferences into backup JSON text. */
export async function exportBackup(prefs) {
  const photos = await storage.getAll('photos');
  const backup = await buildBackup({ records: [...series.values()], photos, prefs });
  return { text: JSON.stringify(backup), events: backup.events.length, photos: backup.photos.length };
}

const photoIdsByEvent = () => new Map([...photoMeta].map(([k, v]) => [k, v.map((p) => p.id)]));

/** What importing `parsed` (from parseBackup) would change, without touching storage. */
export const previewImport = (parsed, mode) => planImport(parsed, series, photoIdsByEvent(), mode, PHOTO_LIMITS);

/**
 * Apply an import. Writes the new data first and only then removes what a replace drops, so a
 * failure part-way never leaves the store emptier than it started. Returns the plan counts.
 */
export async function importBackup(parsed, mode = 'merge') {
  const plan = previewImport(parsed, mode);
  await storage.putMany('events', [...plan.add, ...plan.update]);
  if (plan.photos.length) {
    await storage.putMany('photos', plan.photos.map(({ bytes, ...p }) => ({ ...p, blob: new Blob([bytes], { type: p.type }) })));
  }
  if (mode === 'replace') {
    const keep = new Set(parsed.events.map((e) => e.id));
    const keepPhotos = new Set(parsed.photos.map((p) => p.id));
    for (const id of plan.remove) await storage.delete('events', id);
    for (const p of await storage.getAll('photos')) if (!keepPhotos.has(p.id) || !keep.has(p.eventId)) await storage.delete('photos', p.id);
  }
  await loadAll();
  bump();
  return { added: plan.add.length, updated: plan.update.length, unchanged: plan.unchanged, photos: plan.photos.length, removed: plan.remove.length };
}
