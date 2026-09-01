/**
 * Large stills (data URLs) live in IndexedDB + a memory cache.
 * localStorage only keeps short refs: "idb:<id>".
 */

const DB_NAME = 'sps_image_blobs_db';
const STORE = 'blobs';
const REF = 'idb:';

const mem = new Map();
let dbPromise = null;

function openDb() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onerror = () => resolve(null);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) {
          req.result.createObjectStore(STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

export function isImageRef(value) {
  return typeof value === 'string' && value.startsWith(REF);
}

export function resolveImageUrl(value) {
  if (!value || typeof value !== 'string') return '';
  if (value.startsWith(REF)) return mem.get(value.slice(REF.length)) || '';
  return value;
}

export function rememberImage(id, dataUrl) {
  if (id && dataUrl) mem.set(id, dataUrl);
}

export async function putImageDataUrl(id, dataUrl) {
  if (!id || !dataUrl) return '';
  rememberImage(id, dataUrl);
  const db = await openDb();
  if (db) {
    await new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(dataUrl, id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }
  return REF + id;
}

export async function hydrateImageBlobStore() {
  const db = await openDb();
  if (!db) return;
  await new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return resolve();
        if (typeof cursor.value === 'string') mem.set(cursor.key, cursor.value);
        cursor.continue();
      };
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/** Move data: URLs off a vault map; keep refs + small strings. */
export async function offloadVaultMap(map = {}) {
  const next = {};
  for (const [key, value] of Object.entries(map || {})) {
    if (typeof value === 'string' && value.startsWith('data:') && value.length > 800) {
      next[key] = await putImageDataUrl(key, value);
    } else {
      next[key] = value;
    }
  }
  return next;
}

export function resolveVaultMap(map = {}) {
  const next = {};
  for (const [key, value] of Object.entries(map || {})) {
    next[key] = resolveImageUrl(value) || value;
  }
  return next;
}

/** Persist shots without stuffing base64 into localStorage. */
export async function offloadShotMedia(shots = []) {
  if (!Array.isArray(shots)) return shots;
  const out = [];
  for (let i = 0; i < shots.length; i += 1) {
    const shot = shots[i];
    if (!shot || typeof shot !== 'object') {
      out.push(shot);
      continue;
    }
    const emb = shot.embeddedImages;
    if (!emb || typeof emb !== 'object') {
      out.push(shot);
      continue;
    }
    const nextEmb = { ...emb };
    let changed = false;
    for (const [slot, value] of Object.entries(emb)) {
      if (typeof value === 'string' && value.startsWith('data:') && value.length > 800) {
        const id = `shot:${shot.sceneShotId || i}:${slot}`;
        nextEmb[slot] = await putImageDataUrl(id, value);
        changed = true;
      }
    }
    out.push(changed ? { ...shot, embeddedImages: nextEmb } : shot);
  }
  return out;
}

export function resolveShotMedia(shots = []) {
  if (!Array.isArray(shots)) return shots;
  return shots.map((shot) => {
    if (!shot?.embeddedImages) return shot;
    const nextEmb = {};
    let changed = false;
    for (const [slot, value] of Object.entries(shot.embeddedImages)) {
      const resolved = resolveImageUrl(value);
      nextEmb[slot] = resolved || value;
      if (resolved && resolved !== value) changed = true;
    }
    return changed ? { ...shot, embeddedImages: nextEmb } : shot;
  });
}
