// IndexedDB storage with versioned migrations and an in-memory fallback.
//
// Stores:  events  (keyPath id; index date, updatedAt)
//          photos  (keyPath id; index eventId)   - Blobs, local only
//          meta    (keyPath key)                  - schema bookkeeping + category order/hidden prefs
//          categories (keyPath id)                - user-made categories (v2)
// Adding a version = add an entry to MIGRATIONS; upgrades run in order inside the upgrade
// transaction, so a failed upgrade rolls back and the old data stays readable.
export const DB_NAME = 'countly';
export const DB_VERSION = 2;

export const MIGRATIONS = {
  1(db) {
    const events = db.createObjectStore('events', { keyPath: 'id' });
    events.createIndex('date', 'date');
    events.createIndex('updatedAt', 'updatedAt');
    db.createObjectStore('photos', { keyPath: 'id' }).createIndex('eventId', 'eventId');
    db.createObjectStore('meta', { keyPath: 'key' });
  },
  // v2: user-made categories. Additive only, so v1 data is untouched.
  2(db) {
    if (!db.objectStoreNames.contains('categories')) db.createObjectStore('categories', { keyPath: 'id' });
  },
};

const STORES = ['events', 'photos', 'meta', 'categories'];

const wrap = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

function idbAdapter(db) {
  const tx = (store, mode) => db.transaction(store, mode).objectStore(store);
  const done = (transaction) =>
    new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('aborted'));
    });
  return {
    kind: 'idb',
    getAll: (store) => wrap(tx(store, 'readonly').getAll()),
    get: (store, key) => wrap(tx(store, 'readonly').get(key)),
    async put(store, value) {
      const t = db.transaction(store, 'readwrite');
      t.objectStore(store).put(value);
      await done(t);
    },
    async putMany(store, values) {
      const t = db.transaction(store, 'readwrite');
      for (const v of values) t.objectStore(store).put(v);
      await done(t);
    },
    async delete(store, key) {
      const t = db.transaction(store, 'readwrite');
      t.objectStore(store).delete(key);
      await done(t);
    },
    async deleteWhere(store, indexName, value) {
      const t = db.transaction(store, 'readwrite');
      const os = t.objectStore(store);
      const req = os.index(indexName).openKeyCursor(IDBKeyRange.only(value));
      req.onsuccess = () => {
        const c = req.result;
        if (c) {
          os.delete(c.primaryKey);
          c.continue();
        }
      };
      await done(t);
    },
    async getAllWhere(store, indexName, value) {
      return wrap(tx(store, 'readonly').index(indexName).getAll(IDBKeyRange.only(value)));
    },
    async clear(store) {
      const t = db.transaction(store, 'readwrite');
      t.objectStore(store).clear();
      await done(t);
    },
    close: () => db.close(),
  };
}

/** Volatile adapter with the same API; used when IndexedDB is unavailable and in unit tests. */
export function memoryAdapter(seed = {}) {
  const data = Object.fromEntries(STORES.map((s) => [s, new Map(Object.entries(seed[s] || {}))]));
  const keyOf = (store) => (store === 'meta' ? 'key' : 'id');
  const clone = (v) => (typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)));
  return {
    kind: 'memory',
    getAll: async (store) => [...data[store].values()].map(clone),
    get: async (store, key) => (data[store].has(key) ? clone(data[store].get(key)) : undefined),
    put: async (store, value) => void data[store].set(value[keyOf(store)], clone(value)),
    putMany: async (store, values) => values.forEach((v) => data[store].set(v[keyOf(store)], clone(v))),
    delete: async (store, key) => void data[store].delete(key),
    deleteWhere: async (store, field, value) => {
      for (const [k, v] of [...data[store]]) if (v[field] === value) data[store].delete(k);
    },
    getAllWhere: async (store, field, value) => [...data[store].values()].filter((v) => v[field] === value).map(clone),
    clear: async (store) => data[store].clear(),
    close() {},
  };
}

export function openDb(name = DB_NAME, version = DB_VERSION) {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable'));
    let req;
    try {
      req = indexedDB.open(name, version);
    } catch (err) {
      return reject(err);
    }
    req.onupgradeneeded = (e) => {
      const db = req.result;
      for (let v = e.oldVersion + 1; v <= (e.newVersion || version); v++) MIGRATIONS[v]?.(db, req.transaction);
    };
    req.onsuccess = () => resolve(idbAdapter(req.result));
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
}

/** Open IndexedDB, or fall back to memory and report why. */
export async function openStorage() {
  try {
    const adapter = await openDb();
    // Probe a write so private-mode / quota failures surface now, not on the first save.
    await adapter.put('meta', { key: 'probe', at: Date.now() });
    return { adapter, persistent: true, error: null };
  } catch (err) {
    return { adapter: memoryAdapter(), persistent: false, error: err && err.message ? err.message : String(err) };
  }
}
