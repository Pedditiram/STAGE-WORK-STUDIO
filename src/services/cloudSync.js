/**
 * Production multi-user cloud room sync for Stage Production Studio.
 * - Same roomId for host + invitees (invite ?room= matches publish key)
 * - Last-write-wins via lastUpdated ISO timestamps
 * - Works in browser via /api/sync (+ Vite file store) and remote blob map fallbacks
 * - Optional Firebase when a real config is saved in Admin Settings
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { safeLocalStorageSetItem } from '../utils/safeStorage';

const NATIVE_SYNC_PATH = '/api/sync';
const RESTFUL_HUB_URL = 'https://api.restful-api.dev/objects/ff8081819f7e10ae019f987050d92556';
const JSONBLOB_HUB_URL = 'https://jsonblob.com/api/jsonBlob/019f9748-ab24-7be0-8065-27742b7c70bd';

const POLL_MS = 3000;

let db = null;
let broadcastChannel = null;
let lastSyncedPayloadStr = '';
let lastAppliedUpdatedAt = '';
let lastAppliedRevision = 0;

function isBrowser() {
  return typeof window !== 'undefined';
}

function isCloudMode() {
  return isBrowser() && localStorage.getItem('sps_app_version_mode') === 'cloud';
}

/** Prefer same-origin /api/sync when served over http(s); Electron file:// uses remote hubs. */
export function getNativeSyncUrl() {
  if (!isBrowser()) return NATIVE_SYNC_PATH;
  const { protocol, origin } = window.location;
  if (protocol === 'http:' || protocol === 'https:') {
    return `${origin}${NATIVE_SYNC_PATH}`;
  }
  return NATIVE_SYNC_PATH;
}

function initFirebaseIfConfigured() {
  if (!isBrowser() || db) return;
  const customConfigStr = localStorage.getItem('sps_custom_firebase_config');
  if (!customConfigStr) return;
  try {
    const config = JSON.parse(customConfigStr);
    if (!config?.apiKey || String(config.apiKey).includes('Demo')) return;
    const app = getApps().length ? getApp() : initializeApp(config);
    db = getFirestore(app);
  } catch (e) {
    console.warn('[SPS Sync] Firebase init skipped:', e?.message || e);
  }
}

if (isBrowser()) {
  initFirebaseIfConfigured();
  if ('BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel('sps_cloud_sync_channel');
  }
}

export const ROLES = [
  { id: 'director', label: '🎬 Director', color: 'text-amber-400 border-amber-500/40 bg-amber-950/80' },
  { id: 'dp', label: '🎥 Director of Photography', color: 'text-cyan-400 border-cyan-500/40 bg-cyan-950/80' },
  { id: 'lighting', label: '💡 Lighting Lead', color: 'text-pink-400 border-pink-500/40 bg-pink-950/80' },
  { id: 'choreographer', label: '🎭 Choreographer', color: 'text-emerald-400 border-emerald-500/40 bg-emerald-950/80' },
  { id: 'sound', label: '🎵 Audio / Sync Lead', color: 'text-purple-400 border-purple-500/40 bg-purple-950/80' }
];

function cacheKey(roomId) {
  return `sps_cloud_${roomId}`;
}

function isNewer(remoteIso, localIso) {
  if (!remoteIso) return false;
  if (!localIso) return true;
  const r = Date.parse(remoteIso);
  const l = Date.parse(localIso);
  if (Number.isNaN(r)) return false;
  if (Number.isNaN(l)) return true;
  return r > l;
}

function isNewerPayload(remote, localUpdatedAt, localRevision = 0) {
  const remoteRev = typeof remote?.revision === 'number' ? remote.revision : 0;
  if (remoteRev && localRevision) return remoteRev > localRevision;
  if (remoteRev && !localRevision) return true;
  return isNewer(remote?.lastUpdated, localUpdatedAt);
}

function normalizeRoomPayload(roomId, projectData = {}) {
  return {
    ...projectData,
    roomId,
    lastUpdated: projectData.lastUpdated || new Date().toISOString(),
    revision: typeof projectData.revision === 'number' ? projectData.revision : Date.now()
  };
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, { cache: 'no-store', ...options });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Read room from native /api/sync */
async function pullNativeRoom(roomId) {
  const base = getNativeSyncUrl();
  const resObj = await fetchJson(`${base}?type=room&roomId=${encodeURIComponent(roomId)}&t=${Date.now()}`);
  return resObj?.data || null;
}

/** Write room to native /api/sync */
async function pushNativeRoom(roomId, payload) {
  const base = getNativeSyncUrl();
  await fetchJson(`${base}?type=room&roomId=${encodeURIComponent(roomId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

/** Hub blob shape: { rooms: { [roomId]: payload }, updatedAt } */
async function pullHubRoom(roomId) {
  // Prefer JSONBlob (CORS-friendly PUT/GET)
  try {
    const hub = await fetchJson(`${JSONBLOB_HUB_URL}?t=${Date.now()}`);
    const rooms = hub?.rooms || hub?.data?.rooms || {};
    if (rooms && rooms[roomId]) return rooms[roomId];
  } catch (e) {}

  try {
    const hub = await fetchJson(`${RESTFUL_HUB_URL}?t=${Date.now()}`);
    const rooms = hub?.data?.rooms || hub?.rooms || {};
    if (rooms && rooms[roomId]) return rooms[roomId];
  } catch (e) {}

  return null;
}

async function pushHubRoom(roomId, payload) {
  // Merge into hub map so rooms do not clobber each other
  let rooms = {};
  try {
    const hub = await fetchJson(`${JSONBLOB_HUB_URL}?t=${Date.now()}`);
    rooms = { ...(hub?.rooms || hub?.data?.rooms || {}) };
  } catch (e) {}

  rooms[roomId] = payload;
  const body = { rooms, updatedAt: new Date().toISOString(), app: 'stage-production-studio' };

  try {
    await fetch(JSONBLOB_HUB_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (e) {}

  try {
    await fetch(RESTFUL_HUB_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'SPS Cloud Rooms Hub', data: body })
    });
  } catch (e) {}
}

/**
 * Subscribe to a collaboration room.
 * Invite links must use the same roomId string the host publishes to.
 */
export function subscribeToCloudRoom(roomId, onDataReceived) {
  if (typeof onDataReceived !== 'function' || !roomId) return () => {};

  initFirebaseIfConfigured();

  const deliver = (payload, source = 'unknown') => {
    if (!payload || !Array.isArray(payload.shots)) return;
    const payloadStr = JSON.stringify(payload);
    if (payloadStr === lastSyncedPayloadStr) return;

    const remoteUpdated = payload.lastUpdated || '';
    const remoteRev = typeof payload.revision === 'number' ? payload.revision : 0;
    // Ignore strictly older remote payloads (prevents echo / ping-pong)
    if ((remoteRev || remoteUpdated) && !isNewerPayload(payload, lastAppliedUpdatedAt, lastAppliedRevision)) {
      return;
    }

    lastSyncedPayloadStr = payloadStr;
    if (remoteUpdated) lastAppliedUpdatedAt = remoteUpdated;
    if (remoteRev) lastAppliedRevision = remoteRev;

    if (isBrowser()) {
      safeLocalStorageSetItem(cacheKey(roomId), payloadStr);
    }
    onDataReceived(payload, source);
  };

  // 1. Local cache hydrate
  if (isBrowser()) {
    const cachedStr = localStorage.getItem(cacheKey(roomId));
    if (cachedStr) {
      try {
        const cached = JSON.parse(cachedStr);
        lastSyncedPayloadStr = cachedStr;
        lastAppliedUpdatedAt = cached.lastUpdated || '';
        lastAppliedRevision = typeof cached.revision === 'number' ? cached.revision : 0;
        onDataReceived(cached, 'cache');
      } catch (e) {}
    }
  }

  // 2. Cross-tab storage
  const handleStorageChange = (e) => {
    if (e.key === cacheKey(roomId) && e.newValue) {
      try {
        deliver(JSON.parse(e.newValue), 'storage');
      } catch (err) {}
    }
  };
  if (isBrowser()) window.addEventListener('storage', handleStorageChange);

  // 3. BroadcastChannel (same machine)
  const handleBroadcast = (event) => {
    if (event.data?.roomId === roomId && event.data?.payload) {
      deliver(event.data.payload, 'broadcast');
    }
  };
  if (broadcastChannel) broadcastChannel.addEventListener('message', handleBroadcast);

  // 4. Network poll (cloud mode only; re-check each tick so mode switches work)
  const pollCloudDatabase = async () => {
    if (!isCloudMode()) return;
    try {
      let payload = null;
      try {
        payload = await pullNativeRoom(roomId);
      } catch (e) {}
      if (!payload) {
        try {
          payload = await pullHubRoom(roomId);
        } catch (e) {}
      }
      if (payload) deliver(payload, 'network');
    } catch (e) {}
  };

  pollCloudDatabase();
  const pollInterval = setInterval(pollCloudDatabase, POLL_MS);

  // 5. Firestore realtime (optional)
  let unsubscribeFirestore = () => {};
  if (db) {
    try {
      const roomRef = doc(db, 'production_rooms', roomId);
      unsubscribeFirestore = onSnapshot(
        roomRef,
        (docSnap) => {
          if (docSnap.exists()) deliver(docSnap.data(), 'firestore');
        },
        () => {}
      );
    } catch (err) {}
  }

  return () => {
    clearInterval(pollInterval);
    if (isBrowser()) window.removeEventListener('storage', handleStorageChange);
    if (broadcastChannel) broadcastChannel.removeEventListener('message', handleBroadcast);
    unsubscribeFirestore();
  };
}

export async function publishToCloudRoom(roomId, projectData) {
  if (!roomId) return { success: false, error: 'Missing roomId' };

  initFirebaseIfConfigured();

  const payload = normalizeRoomPayload(roomId, projectData);
  const payloadStr = JSON.stringify(payload);
  lastSyncedPayloadStr = payloadStr;
  lastAppliedUpdatedAt = payload.lastUpdated;
  lastAppliedRevision = payload.revision;

  if (isBrowser()) {
    safeLocalStorageSetItem(cacheKey(roomId), payloadStr);
    if (Array.isArray(payload.shots)) {
      safeLocalStorageSetItem('sps_current_shots', JSON.stringify(payload.shots));
    }
  }

  if (broadcastChannel) {
    broadcastChannel.postMessage({ roomId, payload });
  }

  // Always try native API when available (local Vite / hosted web)
  let nativeOk = false;
  try {
    await pushNativeRoom(roomId, payload);
    nativeOk = true;
  } catch (e) {}

  // Remote hubs for Electron / cross-origin / multi-region backup
  if (isCloudMode() || !nativeOk) {
    try {
      await pushHubRoom(roomId, payload);
    } catch (e) {}
  }

  if (db) {
    try {
      await setDoc(doc(db, 'production_rooms', roomId), payload, { merge: true });
    } catch (err) {}
  }

  return { success: true, lastUpdated: payload.lastUpdated, nativeOk };
}

/** Force-enable cloud mode (invite join / admin toggle helpers). */
export function enableCloudCollaborationMode() {
  if (!isBrowser()) return;
  localStorage.setItem('sps_app_version_mode', 'cloud');
  window.dispatchEvent(new CustomEvent('sps_app_version_mode_changed', { detail: 'cloud' }));
}
