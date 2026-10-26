// Event source for the UI. Phase 1 serves labeled sample events (or none). Phase 2
// replaces this with the IndexedDB-backed store while keeping the same shape.
import { getPrefs } from './prefs.js';
import { buildSampleEvents } from './demo.js';

let cacheKey = '';
let cache = [];

export function getEvents(today) {
  const show = getPrefs().showSamples;
  const key = `${today}|${show}`;
  if (key !== cacheKey) {
    cacheKey = key;
    cache = show ? buildSampleEvents(today) : [];
  }
  return cache;
}

export function getEvent(id, today) {
  return getEvents(today).find((e) => e.id === id) || null;
}
