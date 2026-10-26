// Backup file format: build, strictly parse and plan an import. No DOM and no storage access, so
// every rule here is unit-testable. The file is plain JSON (photos as base64) and is also the
// intended wire format for a future sync layer, so it carries its own version.
//
// A backup file is untrusted input: every event goes through the same repair/validation as a
// stored record (migrateRecord), photos are checked for type, size and ownership, and unknown
// fields are dropped rather than copied.
import { migrateRecord, SCENE_IDS } from '../events/model.js';
import { migrateCategory, isKnownCategory } from '../events/categories.js';
import { sanitizePrefs } from './prefs.js';

export const BACKUP_FORMAT = 'countly-backup';
export const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 100 * 1024 * 1024;
export const MAX_EVENTS = 20000;
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
export const BACKUP_PREF_KEYS = ['lang', 'theme', 'accent', 'motion', 'name', 'showSamples'];

const ID_MAX = 120;
const B64 = /^[A-Za-z0-9+/]*={0,2}$/;

export function bytesToBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Returns a Uint8Array, or null when `text` is not valid base64. */
export function base64ToBytes(text) {
  if (typeof text !== 'string' || text.length % 4 !== 0 || !B64.test(text)) return null;
  try {
    const bin = atob(text);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/**
 * Serialize records + photo rows (each with a `blob`) + preferences.
 * `encode(blob)` -> Promise<Uint8Array>; injectable so tests do not need a real Blob reader.
 */
export async function buildBackup({ records, photos, prefs, categories = [], categoryPrefs = { order: [], hidden: [] }, now = new Date() }, encode = async (b) => new Uint8Array(await b.arrayBuffer())) {
  const ids = new Set(records.map((r) => r.id));
  const photoRows = [];
  for (const p of photos) {
    if (!ids.has(p.eventId) || !p.blob) continue;
    photoRows.push({ id: p.id, eventId: p.eventId, name: p.name, type: p.type, size: p.size, createdAt: p.createdAt, data: bytesToBase64(await encode(p.blob)) });
  }
  const outPrefs = {};
  for (const k of BACKUP_PREF_KEYS) if (prefs && k in prefs) outPrefs[k] = prefs[k];
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, app: 'countly', exportedAt: now.toISOString(), categories, categoryPrefs, events: records, photos: photoRows, prefs: outPrefs };
}

/**
 * Parse and validate backup text. Never throws.
 * -> { ok:false, error } where error is one of tooLarge | notJson | notBackup | newerVersion
 * -> { ok:true, events, photos, prefs, exportedAt, skipped:{events,photos} }
 * Photo rows come back with a decoded `bytes` Uint8Array (the caller turns them into Blobs).
 */
export function parseBackup(text, { maxBytes = 8 * 1024 * 1024, maxPerEvent = 12 } = {}) {
  if (typeof text !== 'string' || text.length > MAX_BACKUP_BYTES) return { ok: false, error: 'tooLarge' };
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'notJson' };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data) || data.format !== BACKUP_FORMAT || !Array.isArray(data.events)) return { ok: false, error: 'notBackup' };
  if (!Number.isInteger(data.version) || data.version < 1) return { ok: false, error: 'notBackup' };
  if (data.version > BACKUP_VERSION) return { ok: false, error: 'newerVersion' };

  const skipped = { events: 0, photos: 0 };
  const categories = [];
  const catIds = new Set();
  for (const raw of Array.isArray(data.categories) ? data.categories.slice(0, 100) : []) {
    const c = migrateCategory(raw, SCENE_IDS);
    if (c && !catIds.has(c.id)) {
      catIds.add(c.id);
      categories.push(c);
    }
  }
  const strs = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.length <= ID_MAX).slice(0, 200) : []);
  const categoryPrefs = { order: strs(data.categoryPrefs && data.categoryPrefs.order), hidden: strs(data.categoryPrefs && data.categoryPrefs.hidden) };
  const known = (id) => catIds.has(id) || isKnownCategory(id);
  const byId = new Map();
  for (const raw of data.events.slice(0, MAX_EVENTS)) {
    const rec = raw && typeof raw.id === 'string' && raw.id.length <= ID_MAX ? migrateRecord(raw, known) : null;
    if (!rec) {
      skipped.events++;
      continue;
    }
    const prev = byId.get(rec.id);
    if (!prev || rec.updatedAt >= prev.updatedAt) byId.set(rec.id, rec);
  }
  skipped.events += Math.max(0, data.events.length - MAX_EVENTS);

  const photos = [];
  const perEvent = new Map();
  const seen = new Set();
  for (const p of Array.isArray(data.photos) ? data.photos : []) {
    const ok = p && typeof p.id === 'string' && p.id.length <= ID_MAX && !seen.has(p.id) && byId.has(p.eventId) && PHOTO_TYPES.includes(p.type);
    const bytes = ok ? base64ToBytes(p.data) : null;
    const count = perEvent.get(p && p.eventId) || 0;
    if (!bytes || !bytes.length || bytes.length > maxBytes || count >= maxPerEvent) {
      skipped.photos++;
      continue;
    }
    seen.add(p.id);
    perEvent.set(p.eventId, count + 1);
    photos.push({
      id: p.id,
      eventId: p.eventId,
      name: typeof p.name === 'string' ? p.name.slice(0, 120) : 'photo',
      type: p.type,
      size: bytes.length,
      createdAt: Number.isFinite(p.createdAt) ? p.createdAt : Date.now(),
      bytes,
    });
  }

  const prefs = {};
  if (data.prefs && typeof data.prefs === 'object') {
    const clean = sanitizePrefs(data.prefs);
    for (const k of BACKUP_PREF_KEYS) if (Object.hasOwn(data.prefs, k)) prefs[k] = clean[k];
  }
  const exportedAt = typeof data.exportedAt === 'string' && !Number.isNaN(Date.parse(data.exportedAt)) ? data.exportedAt : null;
  return { ok: true, events: [...byId.values()], photos, categories, categoryPrefs, prefs, exportedAt, skipped };
}

/**
 * Decide what an import would do. `existing` is a Map id -> stored record, `existingPhotos` a Map
 * eventId -> array of stored photo ids. Merge never deletes; replace overwrites everything.
 */
export function planImport(parsed, existing, existingPhotos, mode = 'merge', { maxPerEvent = 12, existingCategories = new Map() } = {}) {
  const cats = parsed.categories || [];
  if (mode === 'replace') {
    return { mode, categories: cats, removeCategories: [...existingCategories.keys()].filter((id) => !cats.some((c) => c.id === id)), add: parsed.events, update: [], unchanged: 0, photos: parsed.photos, remove: [...existing.keys()].filter((id) => !parsed.events.some((e) => e.id === id)) };
  }
  const add = [];
  const update = [];
  let unchanged = 0;
  for (const rec of parsed.events) {
    const cur = existing.get(rec.id);
    if (!cur) {
      add.push(rec);
    } else if (rec.updatedAt > cur.updatedAt) {
      update.push(rec);
    } else {
      unchanged++;
    }
  }
  const have = new Map([...existingPhotos].map(([k, v]) => [k, new Set(v)]));
  const photos = [];
  for (const p of parsed.photos) {
    const ids = have.get(p.eventId) || new Set();
    if (ids.has(p.id) || ids.size >= maxPerEvent) continue;
    ids.add(p.id);
    have.set(p.eventId, ids);
    photos.push(p);
  }
  const catWrites = cats.filter((c) => !existingCategories.has(c.id) || c.updatedAt > existingCategories.get(c.id).updatedAt);
  return { mode, categories: catWrites, removeCategories: [], add, update, unchanged, photos, remove: [] };
}
