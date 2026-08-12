/**
 * Room-scoped chat + shot comments for Stage Production Studio.
 * Syncs via /api/sync?type=chat&roomId=… with localStorage + BroadcastChannel fallback.
 */

import { getNativeSyncUrl } from './cloudSync';
import { safeLocalStorageSetItem } from '../utils/safeStorage';

const POLL_MS = 2500;
const MAX_MESSAGES = 400;

function isBrowser() {
  return typeof window !== 'undefined';
}

function storageKey(roomId) {
  return `sps_collab_chat_${String(roomId || 'SPS-CLOUD-8821')}`;
}

function readLocal(roomId) {
  if (!isBrowser()) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(roomId)) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function writeLocal(roomId, messages) {
  if (!isBrowser()) return;
  const trimmed = (Array.isArray(messages) ? messages : [])
    .slice()
    .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))
    .slice(-MAX_MESSAGES);
  safeLocalStorageSetItem(storageKey(roomId), JSON.stringify(trimmed));
  return trimmed;
}

function mergeMessages(localList, remoteList) {
  const map = new Map();
  [...(localList || []), ...(remoteList || [])].forEach((m) => {
    if (!m?.id) return;
    const prev = map.get(m.id);
    if (!prev) {
      map.set(m.id, m);
      return;
    }
    const pt = Date.parse(prev.createdAt || '') || 0;
    const nt = Date.parse(m.createdAt || '') || 0;
    map.set(m.id, nt >= pt ? { ...prev, ...m } : { ...m, ...prev });
  });
  return Array.from(map.values())
    .filter((m) => !m.deleted)
    .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))
    .slice(-MAX_MESSAGES);
}

async function pullRemote(roomId) {
  const base = getNativeSyncUrl();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(
      `${base}?type=chat&roomId=${encodeURIComponent(roomId)}&t=${Date.now()}`,
      { cache: 'no-store', signal: controller.signal }
    );
    if (!res.ok) throw new Error(`chat pull ${res.status}`);
    const json = await res.json();
    return Array.isArray(json?.messages) ? json.messages : [];
  } finally {
    clearTimeout(timer);
  }
}

async function pushRemote(roomId, messages) {
  const base = getNativeSyncUrl();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(`${base}?type=chat&roomId=${encodeURIComponent(roomId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`chat push ${res.status}`);
    const json = await res.json();
    return Array.isArray(json?.messages) ? json.messages : messages;
  } finally {
    clearTimeout(timer);
  }
}

function currentUserMeta() {
  if (!isBrowser()) {
    return { userEmail: 'guest', userName: 'Guest' };
  }
  const email = String(localStorage.getItem('sps_authorized_user_email') || '').trim().toLowerCase();
  const users = (() => {
    try {
      return JSON.parse(localStorage.getItem('sps_authorized_phone_users') || '[]');
    } catch (e) {
      return [];
    }
  })();
  const profile = Array.isArray(users)
    ? users.find((u) => String(u.email || '').trim().toLowerCase() === email)
    : null;
  const userName =
    profile?.name ||
    (email.includes('@') ? email.split('@')[0] : '') ||
    'Studio User';
  return {
    userEmail: email || 'guest@studio.local',
    userName,
  };
}

export function createCollabMessage({
  roomId,
  projectTitle,
  kind = 'chat',
  shotId = null,
  text,
}) {
  const clean = String(text || '').trim();
  if (!clean) return null;
  const { userEmail, userName } = currentUserMeta();
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    roomId: roomId || 'SPS-CLOUD-8821',
    projectTitle: projectTitle || '',
    kind: kind === 'comment' ? 'comment' : 'chat',
    shotId: kind === 'comment' ? shotId || null : null,
    text: clean.slice(0, 2000),
    userEmail,
    userName,
    createdAt: new Date().toISOString(),
  };
}

export async function postCollabMessage(message) {
  if (!message?.id) return readLocal(message?.roomId);
  const roomId = message.roomId || 'SPS-CLOUD-8821';
  const local = mergeMessages(readLocal(roomId), [message]);
  writeLocal(roomId, local);

  if (isBrowser() && 'BroadcastChannel' in window) {
    try {
      const bc = new BroadcastChannel('sps_collab_chat');
      bc.postMessage({ roomId, messages: local });
      bc.close();
    } catch (e) {}
  }

  try {
    const remote = await pushRemote(roomId, local);
    const merged = mergeMessages(local, remote);
    writeLocal(roomId, merged);
    return merged;
  } catch (e) {
    return local;
  }
}

export async function fetchCollabMessages(roomId) {
  const local = readLocal(roomId);
  try {
    const remote = await pullRemote(roomId);
    const merged = mergeMessages(local, remote);
    writeLocal(roomId, merged);
    return merged;
  } catch (e) {
    return local;
  }
}

/**
 * Subscribe to room chat/comments. Callback receives full message list.
 * Returns unsubscribe fn.
 */
export function subscribeToCollabChat(roomId, callback) {
  if (!isBrowser() || typeof callback !== 'function') return () => {};

  let cancelled = false;
  const key = roomId || 'SPS-CLOUD-8821';

  const emit = (list) => {
    if (!cancelled) callback(Array.isArray(list) ? list : []);
  };

  emit(readLocal(key));

  const refresh = async () => {
    if (cancelled) return;
    const list = await fetchCollabMessages(key);
    emit(list);
  };

  refresh();
  const timer = setInterval(() => {
    if (typeof document !== 'undefined' && document.hidden) return;
    refresh();
  }, POLL_MS);

  const onVis = () => {
    if (cancelled) return;
    if (typeof document !== 'undefined' && !document.hidden) refresh();
  };
  if (isBrowser()) {
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
  }

  let bc = null;
  const onBc = (ev) => {
    if (cancelled) return;
    if (ev?.data?.roomId && ev.data.roomId !== key) return;
    if (Array.isArray(ev?.data?.messages)) {
      const merged = mergeMessages(readLocal(key), ev.data.messages);
      writeLocal(key, merged);
      emit(merged);
    }
  };
  if ('BroadcastChannel' in window) {
    bc = new BroadcastChannel('sps_collab_chat');
    bc.addEventListener('message', onBc);
  }

  const onStorage = (e) => {
    if (e.key === storageKey(key)) emit(readLocal(key));
  };
  window.addEventListener('storage', onStorage);

  return () => {
    cancelled = true;
    clearInterval(timer);
    window.removeEventListener('storage', onStorage);
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('focus', onVis);
    if (bc) {
      bc.removeEventListener('message', onBc);
      bc.close();
    }
  };
}

export function filterChatMessages(messages) {
  return (messages || []).filter((m) => m.kind !== 'comment');
}

export function filterShotComments(messages, shotId) {
  const id = String(shotId || '');
  return (messages || []).filter(
    (m) => m.kind === 'comment' && (!id || String(m.shotId || '') === id)
  );
}
