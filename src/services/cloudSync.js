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
/** Production Vercel origin — source of truth for projects, collaborators, rooms, chat. */
export const PRODUCTION_SYNC_ORIGIN = 'https://www.stageworkstudio.com';
const RESTFUL_HUB_URL = 'https://api.restful-api.dev/objects/ff8081819f7e10ae019f987050d92556';
const JSONBLOB_HUB_URL = 'https://jsonblob.com/api/jsonBlob/019ff13d-43e0-74db-bb8d-6211e85dc74e';

/** Active-tab room poll fallback. Hidden tabs back off. Tick poll is ~1s when KV ticks exist. */
const POLL_MS_ACTIVE = 4000;
const POLL_MS_HIDDEN = 30000;
const TICK_MS_ACTIVE = 1000;
const TICK_MS_HIDDEN = 8000;

let db = null;
let broadcastChannel = null;

/** Per-room apply cursors so switching rooms does not drop remote updates. */
const roomApplyState = new Map();

function getRoomState(roomId) {
  if (!roomApplyState.has(roomId)) {
    roomApplyState.set(roomId, {
      lastSyncedPayloadStr: '',
      lastAppliedUpdatedAt: '',
      lastAppliedRevision: 0
    });
  }
  return roomApplyState.get(roomId);
}

function isBrowser() {
  return typeof window !== 'undefined';
}

function isProductionHost(hostname = '') {
  const h = String(hostname || '').toLowerCase();
  return (
    h.includes('vercel.app') ||
    h === 'stageworkstudio.com' ||
    h.endsWith('.stageworkstudio.com') ||
    h === 'stageproductionstudio.com' ||
    h.endsWith('.stageproductionstudio.com')
  );
}

function isLocalOrLanHost(hostname = '') {
  const h = String(hostname || '').toLowerCase();
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h.startsWith('192.168.') ||
    h.startsWith('10.') ||
    h.startsWith('172.16.') ||
    h.startsWith('172.17.') ||
    h.startsWith('172.18.') ||
    h.startsWith('172.19.') ||
    h.startsWith('172.2') ||
    h.startsWith('172.30.') ||
    h.startsWith('172.31.') ||
    h.endsWith('.local')
  );
}

/**
 * Sync API URL.
 * - On Vercel / custom prod domain → same-origin /api/sync
 * - On LAN or offline local network (without internet) → local Vite server ${origin}/api/sync
 * - On online localhost/tunnel → cloud source of truth (${PRODUCTION_SYNC_ORIGIN})
 */
export function getNativeSyncUrl() {
  if (!isBrowser()) return `${PRODUCTION_SYNC_ORIGIN}${NATIVE_SYNC_PATH}`;
  const { protocol, hostname, origin } = window.location;
  if (protocol === 'http:' || protocol === 'https:') {
    if (isProductionHost(hostname)) {
      return `${origin}${NATIVE_SYNC_PATH}`;
    }
    const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
    // Offline LAN only — never pin online localhost/Electron to a machine-local store
    if (isOffline && isLocalOrLanHost(hostname)) {
      return `${origin}${NATIVE_SYNC_PATH}`;
    }
    return `${PRODUCTION_SYNC_ORIGIN}${NATIVE_SYNC_PATH}`;
  }
  // file:// Electron package
  return `${PRODUCTION_SYNC_ORIGIN}${NATIVE_SYNC_PATH}`;
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

function isNewerPayload(remote, localUpdatedAt, localRevision = 0) {
  const remoteTs = Date.parse(remote?.lastUpdated || '') || 0;
  const localTs = Date.parse(localUpdatedAt || '') || 0;
  if (remoteTs && localTs && remoteTs !== localTs) return remoteTs > localTs;
  const remoteRev = typeof remote?.revision === 'number' ? remote.revision : 0;
  if (remoteRev && localRevision && remoteRev !== localRevision) return remoteRev > localRevision;
  if (remoteTs && !localTs) return true;
  if (remoteRev && !localRevision) return true;
  return false;
}

function normalizeRoomPayload(roomId, projectData = {}) {
  const state = getRoomState(roomId);
  const prevRev = typeof state.lastAppliedRevision === 'number' ? state.lastAppliedRevision : 0;
  const incomingRev = typeof projectData.revision === 'number' ? projectData.revision : 0;
  return {
    ...projectData,
    roomId,
    lastUpdated: new Date().toISOString(),
    revision: Math.max(incomingRev, prevRev + 1, Date.now())
  };
}

const FETCH_TIMEOUT_MS = 12000;
const syncEtags = new Map();
const syncBodies = new Map();

function syncCacheKey(url) {
  return String(url || '').replace(/[?&]t=\d+/g, '').replace(/\?$/, '');
}

export async function fetchSyncJson(url, options = {}, { timeoutMs = FETCH_TIMEOUT_MS, skipEtag = false } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const method = String(options.method || 'GET').toUpperCase();
  const key = syncCacheKey(url);
  const headers = { ...(options.headers || {}) };
  if (method === 'GET' && !skipEtag) {
    const prevTag = syncEtags.get(key);
    if (prevTag) headers['If-None-Match'] = prevTag;
  }
  try {
    const res = await fetch(method === 'GET' ? key : url, {
      cache: 'no-store',
      ...options,
      headers,
      signal: controller.signal,
    });
    if (method === 'GET' && res.status === 304) {
      const cached = syncBodies.get(key);
      if (cached) return cached;
      const retry = await fetch(key, { cache: 'no-store', signal: controller.signal });
      if (!retry.ok) throw new Error(`HTTP ${retry.status}`);
      const json = await retry.json();
      const tag = retry.headers.get('etag');
      if (tag) syncEtags.set(key, tag);
      syncBodies.set(key, json);
      return json;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (method === 'GET') {
      const tag = res.headers.get('etag');
      if (tag) syncEtags.set(key, tag);
      syncBodies.set(key, json);
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url, options = {}, extra = {}) {
  return fetchSyncJson(url, options, extra);
}

/** Read room from native /api/sync */
async function pullNativeRoom(roomId) {
  const base = getNativeSyncUrl();
  const resObj = await fetchJson(
    `${base}?type=room&roomId=${encodeURIComponent(roomId)}`,
    {},
    { skipEtag: true, timeoutMs: 20000 }
  );
  return resObj?.data || null;
}

export function serializeCollabTick(tick) {
  if (!tick || typeof tick !== 'object') return '';
  return [
    tick.room?.revision,
    tick.room?.lastUpdated,
    tick.chat?.revision,
    tick.chat?.lastId,
    tick.chat?.count,
    tick.screenplay?.revision,
    tick.screenplay?.lastUpdated,
    tick.projects?.stamp,
    tick.collaborators?.stamp,
    tick.settings?.stamp
  ].join('|');
}

export async function pullCollabTick(roomId, projectTitle = '') {
  const base = getNativeSyncUrl();
  return fetchJson(
    `${base}?type=tick&roomId=${encodeURIComponent(roomId || 'SPS-CLOUD-8821')}&project=${encodeURIComponent(projectTitle || '')}`,
    {},
    { skipEtag: true, timeoutMs: 8000 }
  );
}

const collabTickListeners = new Map();

function collabTickBucketKey(roomId) {
  return String(roomId || 'SPS-CLOUD-8821');
}

/**
 * Shared 2s collab tick (one network poll per room, many subscribers).
 * callback(tick, reason) where reason is 'init' | 'change' | 'focus'
 */
export function subscribeToCollabTick(roomId, projectTitle, callback) {
  if (typeof callback !== 'function') return () => {};
  const bucketKey = collabTickBucketKey(roomId);
  let entry = collabTickListeners.get(bucketKey);
  if (!entry) {
    entry = {
      roomId: roomId || 'SPS-CLOUD-8821',
      projectTitle: projectTitle || '',
      callbacks: new Set(),
      timer: null,
      lastSig: '',
      cancelled: false
    };
    collabTickListeners.set(bucketKey, entry);

    const poll = async (reason = 'poll') => {
      if (entry.cancelled) return;
      try {
        const tick = await pullCollabTick(entry.roomId, entry.projectTitle);
        if (!tick || tick.success === false) return;
        const sig = serializeCollabTick(tick);
        const changed = Boolean(sig) && sig !== entry.lastSig;
        const first = !entry.lastSig;
        if (changed) entry.lastSig = sig;
        if (first || changed || reason === 'focus') {
          entry.callbacks.forEach((cb) => {
            try {
              cb(tick, first ? 'init' : changed ? 'change' : reason);
            } catch (e) {}
          });
        }
      } catch (e) {}
    };

    const schedule = () => {
      if (entry.timer) clearInterval(entry.timer);
      const ms =
        isBrowser() && typeof document !== 'undefined' && document.hidden
          ? TICK_MS_HIDDEN
          : TICK_MS_ACTIVE;
      entry.timer = setInterval(() => poll('poll'), ms);
    };

    const onVis = () => {
      if (entry.cancelled) return;
      if (typeof document !== 'undefined' && document.hidden) {
        schedule();
        return;
      }
      poll('focus');
      schedule();
    };

    entry.poll = poll;
    entry.schedule = schedule;
    entry.onVis = onVis;
    poll('init');
    schedule();
    if (isBrowser()) {
      document.addEventListener('visibilitychange', onVis);
      window.addEventListener('focus', onVis);
      window.addEventListener('pageshow', onVis);
    }
  } else if (projectTitle && !entry.projectTitle) {
    entry.projectTitle = projectTitle;
  }
  entry.callbacks.add(callback);
  return () => {
    entry.callbacks.delete(callback);
    if (entry.callbacks.size > 0) return;
    entry.cancelled = true;
    if (entry.timer) clearInterval(entry.timer);
    if (isBrowser() && entry.onVis) {
      document.removeEventListener('visibilitychange', entry.onVis);
      window.removeEventListener('focus', entry.onVis);
      window.removeEventListener('pageshow', entry.onVis);
    }
    collabTickListeners.delete(bucketKey);
  };
}

/** Write room to native /api/sync — returns server JSON (may include skipped:'stale'). */
async function pushNativeRoom(roomId, payload) {
  const base = getNativeSyncUrl();
  return fetchJson(
    `${base}?type=room&roomId=${encodeURIComponent(roomId)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    },
    { timeoutMs: 20000 }
  );
}

/** Hub blob shape: { rooms: { [roomId]: payload }, updatedAt } */
async function pullHubRoom(roomId) {
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

/**
 * Best-effort hub backup. Aborts if hub GET failed — never PUT { [roomId]: payload }
 * alone (that wipes every other room in the durable hub).
 */
async function pushHubRoom(roomId, payload) {
  let rooms = null;
  try {
    const hub = await fetchJson(`${JSONBLOB_HUB_URL}?t=${Date.now()}`);
    const raw = hub?.rooms || hub?.data?.rooms;
    if (raw && typeof raw === 'object') rooms = { ...raw };
  } catch (e) {}

  if (!rooms) {
    try {
      const hub = await fetchJson(`${RESTFUL_HUB_URL}?t=${Date.now()}`);
      const raw = hub?.data?.rooms || hub?.rooms;
      if (raw && typeof raw === 'object') rooms = { ...raw };
    } catch (e) {}
  }

  // Failed hydrate → skip write (native /api/sync already owns durable rooms)
  if (!rooms) return false;

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
  return true;
}

/**
 * Subscribe to a collaboration room.
 * Invite links must use the same roomId string the host publishes to.
 */
export function subscribeToCloudRoom(roomId, onDataReceived, projectTitle = '') {
  if (typeof onDataReceived !== 'function' || !roomId) return () => {};

  initFirebaseIfConfigured();
  const state = getRoomState(roomId);

  const deliver = (payload, source = 'unknown') => {
    if (!payload || !Array.isArray(payload.shots)) return;
    const payloadStr = JSON.stringify(payload);
    if (payloadStr === state.lastSyncedPayloadStr) return;

    const remoteUpdated = payload.lastUpdated || '';
    const remoteRev = typeof payload.revision === 'number' ? payload.revision : 0;
    // Ignore strictly older remote payloads (prevents echo / ping-pong)
    if ((remoteRev || remoteUpdated) && !isNewerPayload(payload, state.lastAppliedUpdatedAt, state.lastAppliedRevision)) {
      return;
    }

    state.lastSyncedPayloadStr = payloadStr;
    if (remoteUpdated) state.lastAppliedUpdatedAt = remoteUpdated;
    if (remoteRev) state.lastAppliedRevision = remoteRev;

    if (isBrowser()) {
      safeLocalStorageSetItem(cacheKey(roomId), payloadStr);
    }
    onDataReceived(payload, source);
  };

  // 1. Local cache is not applied — a stale 2-shot placeholder must not replace the open film.
  if (isBrowser()) {
    /* network + ticks hydrate; cache is written after a confirmed deliver */
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

  // 4. Network — 2s KV tick, full room pull when revision changes; 12s safety net
  let pollTimer = null;
  let cancelled = false;
  let lastRoomTick = '';

  const pollCloudDatabase = async () => {
    if (cancelled) return;
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

  const schedulePoll = () => {
    if (pollTimer) clearInterval(pollTimer);
    const ms =
      isBrowser() && typeof document !== 'undefined' && document.hidden
        ? POLL_MS_HIDDEN
        : POLL_MS_ACTIVE;
    pollTimer = setInterval(pollCloudDatabase, ms);
  };

  const onVisibilityOrFocus = () => {
    if (cancelled) return;
    if (typeof document !== 'undefined' && document.hidden) {
      schedulePoll();
      return;
    }
    pollCloudDatabase();
    schedulePoll();
  };

  pollCloudDatabase();
  schedulePoll();

  const unsubTick = subscribeToCollabTick(roomId, projectTitle, (tick, reason) => {
    if (cancelled) return;
    const sig = `${tick?.room?.revision || 0}|${tick?.room?.lastUpdated || ''}`;
    if (reason === 'init') {
      lastRoomTick = sig;
      pollCloudDatabase();
      return;
    }
    if (sig && sig !== lastRoomTick) {
      lastRoomTick = sig;
      pollCloudDatabase();
    } else if (reason === 'focus') {
      pollCloudDatabase();
    }
  });

  if (isBrowser()) {
    document.addEventListener('visibilitychange', onVisibilityOrFocus);
    window.addEventListener('focus', onVisibilityOrFocus);
    window.addEventListener('pageshow', onVisibilityOrFocus);
  }

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
    cancelled = true;
    if (pollTimer) clearInterval(pollTimer);
    if (typeof unsubTick === 'function') unsubTick();
    if (isBrowser()) {
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('visibilitychange', onVisibilityOrFocus);
      window.removeEventListener('focus', onVisibilityOrFocus);
      window.removeEventListener('pageshow', onVisibilityOrFocus);
    }
    if (broadcastChannel) broadcastChannel.removeEventListener('message', handleBroadcast);
    unsubscribeFirestore();
  };
}

export function slimRoomForNetwork(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const shots = Array.isArray(payload.shots)
    ? payload.shots.map((s) => {
        if (!s || typeof s !== 'object') return s;
        const next = { ...s };
        delete next.generatedImage;
        delete next.generatedImages;
        Object.keys(next).forEach((k) => {
          if (typeof next[k] === 'string' && next[k].startsWith('data:image')) {
            next[k] = '';
          }
        });
        return next;
      })
    : payload.shots;
  const { projectGeneratedImages, ...rest } = payload;
  return { ...rest, shots };
}

export async function publishToCloudRoom(roomId, projectData) {
  if (!roomId) return { success: false, error: 'Missing roomId' };

  initFirebaseIfConfigured();

  const payload = normalizeRoomPayload(roomId, projectData);
  const payloadStr = JSON.stringify(payload);
  const state = getRoomState(roomId);

  // Optimistic local cache for UX — revision cursor only advances after native accepts
  if (isBrowser()) {
    safeLocalStorageSetItem(cacheKey(roomId), payloadStr);
    if (Array.isArray(payload.shots)) {
      safeLocalStorageSetItem('sps_current_shots', JSON.stringify(payload.shots));
    }
  }

  if (broadcastChannel) {
    broadcastChannel.postMessage({ roomId, payload });
  }

  // Network payload: strip heavy base64 data URLs to prevent HTTP 413 on Vercel
  const networkPayload = slimRoomForNetwork(payload);

  let nativeOk = false;
  let skippedStale = false;
  let serverData = null;
  try {
    const res = await pushNativeRoom(roomId, networkPayload);
    if (res?.skipped === 'stale') {
      skippedStale = true;
      serverData = res?.data || null;
    } else {
      nativeOk = true;
      serverData = res?.data || networkPayload;
      state.lastSyncedPayloadStr = JSON.stringify(serverData);
      state.lastAppliedUpdatedAt = serverData.lastUpdated || payload.lastUpdated;
      state.lastAppliedRevision =
        typeof serverData.revision === 'number' ? serverData.revision : payload.revision;
    }
  } catch (e) {}

  if (!skippedStale) {
    pushHubRoom(roomId, networkPayload).catch(() => {});
    if (db) {
      setDoc(doc(db, 'production_rooms', roomId), networkPayload, { merge: true }).catch(() => {});
    }
  }

  return {
    success: nativeOk || skippedStale,
    lastUpdated: serverData?.lastUpdated || payload.lastUpdated,
    nativeOk,
    skippedStale,
    data: serverData
  };
}

/** Force-enable cloud mode (invite join / admin toggle helpers). */
export function enableCloudCollaborationMode() {
  if (!isBrowser()) return;
  localStorage.setItem('sps_app_version_mode', 'cloud');
  window.dispatchEvent(new CustomEvent('sps_app_version_mode_changed', { detail: 'cloud' }));
}
