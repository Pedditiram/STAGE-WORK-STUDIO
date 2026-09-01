/**
 * Multi-writer screenplay collaboration — scene-locked co-write + presence.
 * Syncs via /api/sync?type=screenplay&roomId=… with localStorage + BroadcastChannel.
 */
import { getNativeSyncUrl, fetchSyncJson } from './cloudSync';
import { extractSceneOutline } from '../utils/screenplayFormat';
import { safeLocalStorageSetItem } from '../utils/safeStorage';

const POLL_MS = 12000;
const LOCK_TTL_MS = 5 * 60 * 1000;
const PRESENCE_TTL_MS = 45 * 1000;
const WRITER_COLORS = ['#22d3ee', '#a855f7', '#f59e0b', '#34d399', '#f43f5e', '#60a5fa', '#e879f9', '#fb923c'];

function isBrowser() {
  return typeof window !== 'undefined';
}

function storageKey(roomId, projectTitle) {
  const p = String(projectTitle || 'default').trim().toUpperCase().replace(/\s+/g, '_').slice(0, 40);
  return `sps_screenplay_collab_${String(roomId || 'SPS-CLOUD-8821')}_${p}`;
}

export function writerColorForEmail(email) {
  const s = String(email || 'anon').toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return WRITER_COLORS[h % WRITER_COLORS.length];
}

export function currentWriterMeta() {
  if (!isBrowser()) {
    return { userEmail: 'guest@studio.local', userName: 'Guest', color: WRITER_COLORS[0] };
  }
  const email = String(localStorage.getItem('sps_authorized_user_email') || '').trim().toLowerCase();
  let userName = email.includes('@') ? email.split('@')[0] : 'Writer';
  try {
    const users = JSON.parse(localStorage.getItem('sps_authorized_phone_users') || '[]');
    const profile = Array.isArray(users)
      ? users.find((u) => String(u.email || '').trim().toLowerCase() === email)
      : null;
    if (profile?.name) userName = profile.name;
  } catch (e) {}
  return {
    userEmail: email || 'guest@studio.local',
    userName,
    color: writerColorForEmail(email || 'guest')
  };
}

function sceneKeyFromTitle(title, index) {
  const slug = String(title || 'scene')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .slice(0, 48);
  return `sc_${index}_${slug || 'UNTITLED'}`;
}

/** Split full script into ordered scene segments (acts included as segments). */
export function splitScreenplayScenes(text) {
  const src = String(text || '');
  const outline = extractSceneOutline(src);
  if (!outline.length) {
    return [
      {
        key: 'sc_0_FULL',
        index: 0,
        title: 'FULL SCRIPT',
        offset: 0,
        text: src
      }
    ];
  }
  const segments = [];
  for (let i = 0; i < outline.length; i += 1) {
    const start = outline[i].offset;
    const end = i + 1 < outline.length ? outline[i + 1].offset : src.length;
    segments.push({
      key: sceneKeyFromTitle(outline[i].title, i),
      index: i,
      title: outline[i].title,
      offset: start,
      text: src.slice(start, end)
    });
  }
  return segments;
}

export function joinScreenplayScenes(segments) {
  return (Array.isArray(segments) ? segments : [])
    .slice()
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((s) => s.text || '')
    .join('');
}

function emptyDoc(projectTitle = '') {
  return {
    projectTitle: projectTitle || '',
    text: '',
    segments: [],
    locks: {},
    presence: [],
    revision: 0,
    lastUpdated: new Date().toISOString()
  };
}

function readLocal(roomId, projectTitle) {
  if (!isBrowser()) return emptyDoc(projectTitle);
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(roomId, projectTitle)) || 'null');
    if (parsed && typeof parsed === 'object') return parsed;
  } catch (e) {}
  return emptyDoc(projectTitle);
}

function writeLocal(roomId, projectTitle, doc) {
  if (!isBrowser()) return doc;
  const next = {
    ...emptyDoc(projectTitle),
    ...doc,
    lastUpdated: doc?.lastUpdated || new Date().toISOString()
  };
  safeLocalStorageSetItem(storageKey(roomId, projectTitle), JSON.stringify(next));
  return next;
}

function pruneLocks(locks, now = Date.now()) {
  const out = {};
  Object.entries(locks || {}).forEach(([key, lock]) => {
    if (!lock) return;
    const exp = Date.parse(lock.expiresAt || '') || 0;
    if (exp && exp < now) return;
    out[key] = lock;
  });
  return out;
}

function prunePresence(list, now = Date.now()) {
  return (Array.isArray(list) ? list : []).filter((p) => {
    const t = Date.parse(p?.updatedAt || '') || 0;
    return t && now - t < PRESENCE_TTL_MS;
  });
}

/**
 * Merge remote + local with scene lock rules:
 * - Locked by someone else → remote segment wins
 * - Locked by me / unlocked → newer segment wins
 */
export function mergeScreenplayDocs(localDoc, remoteDoc, myEmail) {
  const me = String(myEmail || '').toLowerCase();
  const local = localDoc || emptyDoc();
  const remote = remoteDoc || emptyDoc();
  const now = Date.now();

  const locks = pruneLocks({ ...(remote.locks || {}), ...(local.locks || {}) }, now);
  // Prefer remote lock if both claim same scene
  Object.keys(locks).forEach((key) => {
    const l = local.locks?.[key];
    const r = remote.locks?.[key];
    if (l && r) {
      const lt = Date.parse(l.lockedAt || '') || 0;
      const rt = Date.parse(r.lockedAt || '') || 0;
      locks[key] = rt >= lt ? r : l;
    } else {
      locks[key] = r || l;
    }
  });

  const localSegs = Array.isArray(local.segments) && local.segments.length
    ? local.segments
    : splitScreenplayScenes(local.text || '');
  const remoteSegs = Array.isArray(remote.segments) && remote.segments.length
    ? remote.segments
    : splitScreenplayScenes(remote.text || '');

  const localMap = new Map(localSegs.map((s) => [s.key, s]));
  const remoteMap = new Map(remoteSegs.map((s) => [s.key, s]));
  const orderKeys = [];
  const seen = new Set();
  [...remoteSegs, ...localSegs].forEach((s) => {
    if (!s?.key || seen.has(s.key)) return;
    seen.add(s.key);
    orderKeys.push(s.key);
  });

  const mergedSegs = orderKeys.map((key, index) => {
    const l = localMap.get(key);
    const r = remoteMap.get(key);
    const lock = locks[key];
    const lockedByOther =
      lock && String(lock.userEmail || '').toLowerCase() !== me && String(lock.userEmail || '');

    if (lockedByOther && r) {
      return { ...r, index, key };
    }
    if (!l) return { ...r, index, key };
    if (!r) return { ...l, index, key };

    const lt = Date.parse(l.updatedAt || local.lastUpdated || '') || 0;
    const rt = Date.parse(r.updatedAt || remote.lastUpdated || '') || 0;
    const pick = lt >= rt ? l : r;
    return { ...pick, index, key, title: pick.title || r.title || l.title };
  });

  const text = joinScreenplayScenes(mergedSegs);
  const presence = prunePresence(
    [...(remote.presence || []), ...(local.presence || [])].reduce((acc, p) => {
      if (!p?.userEmail) return acc;
      const email = String(p.userEmail).toLowerCase();
      const idx = acc.findIndex((x) => String(x.userEmail).toLowerCase() === email);
      if (idx === -1) acc.push(p);
      else {
        const pt = Date.parse(acc[idx].updatedAt || '') || 0;
        const nt = Date.parse(p.updatedAt || '') || 0;
        if (nt >= pt) acc[idx] = { ...acc[idx], ...p };
      }
      return acc;
    }, []),
    now
  );

  const revision = Math.max(local.revision || 0, remote.revision || 0);
  return {
    projectTitle: remote.projectTitle || local.projectTitle || '',
    text,
    segments: mergedSegs,
    locks,
    presence,
    revision,
    lastUpdated:
      Date.parse(remote.lastUpdated || '') >= Date.parse(local.lastUpdated || '')
        ? remote.lastUpdated
        : local.lastUpdated
  };
}

async function pullRemote(roomId, projectTitle) {
  const base = getNativeSyncUrl();
  const json = await fetchSyncJson(
    `${base}?type=screenplay&roomId=${encodeURIComponent(roomId)}&project=${encodeURIComponent(projectTitle || '')}`
  );
  return json?.screenplay && typeof json.screenplay === 'object' ? json.screenplay : null;
}

async function pushRemote(roomId, projectTitle, doc) {
  const base = getNativeSyncUrl();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(
      `${base}?type=screenplay&roomId=${encodeURIComponent(roomId)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectTitle, screenplay: doc }),
        signal: controller.signal
      }
    );
    if (!res.ok) throw new Error(`screenplay push ${res.status}`);
    const json = await res.json();
    return json?.screenplay && typeof json.screenplay === 'object' ? json.screenplay : doc;
  } finally {
    clearTimeout(timer);
  }
}

function broadcast(roomId, projectTitle, doc) {
  if (!isBrowser() || !('BroadcastChannel' in window)) return;
  try {
    const bc = new BroadcastChannel('sps_screenplay_collab');
    bc.postMessage({ roomId, projectTitle, screenplay: doc });
    bc.close();
  } catch (e) {}
}

export function buildLocalScreenplayDoc(text, projectTitle, { claimedSceneKey = null } = {}) {
  const meta = currentWriterMeta();
  const now = Date.now();
  const segments = splitScreenplayScenes(text).map((s) => ({
    ...s,
    updatedAt: new Date().toISOString(),
    authorEmail: meta.userEmail
  }));
  const locks = {};
  if (claimedSceneKey) {
    locks[claimedSceneKey] = {
      userEmail: meta.userEmail,
      userName: meta.userName,
      color: meta.color,
      sceneKey: claimedSceneKey,
      lockedAt: new Date().toISOString(),
      expiresAt: new Date(now + LOCK_TTL_MS).toISOString()
    };
  }
  return {
    projectTitle: projectTitle || '',
    text: String(text || ''),
    segments,
    locks,
    presence: [
      {
        userEmail: meta.userEmail,
        userName: meta.userName,
        color: meta.color,
        sceneKey: claimedSceneKey || null,
        updatedAt: new Date().toISOString()
      }
    ],
    revision: Date.now(),
    lastUpdated: new Date().toISOString()
  };
}

export async function publishScreenplayCollab(roomId, projectTitle, text, { claimedSceneKey = null, baseDoc = null } = {}) {
  const key = roomId || 'SPS-CLOUD-8821';
  const meta = currentWriterMeta();
  const localBuilt = buildLocalScreenplayDoc(text, projectTitle, { claimedSceneKey });
  const existing = baseDoc || readLocal(key, projectTitle);

  // Preserve other writers' locks; renew mine
  const locks = pruneLocks({ ...(existing.locks || {}) });
  Object.keys(locks).forEach((k) => {
    if (String(locks[k]?.userEmail || '').toLowerCase() === meta.userEmail) {
      delete locks[k];
    }
  });
  if (claimedSceneKey) {
    locks[claimedSceneKey] = localBuilt.locks[claimedSceneKey];
  }

  const presence = prunePresence([
    ...(existing.presence || []).filter(
      (p) => String(p.userEmail || '').toLowerCase() !== meta.userEmail
    ),
    ...localBuilt.presence
  ]);

  let doc = {
    ...existing,
    ...localBuilt,
    locks,
    presence,
    revision: Math.max(existing.revision || 0, localBuilt.revision || 0)
  };

  // Merge against existing so we don't clobber locked scenes we shouldn't edit
  doc = mergeScreenplayDocs(doc, existing, meta.userEmail);
  doc.locks = locks;
  doc.presence = presence;
  doc.revision = Date.now();
  doc.lastUpdated = new Date().toISOString();
  // Re-apply my segment text for claimed (or all unlocked) scenes from localBuilt
  if (claimedSceneKey) {
    const mine = (localBuilt.segments || []).find((s) => s.key === claimedSceneKey);
    if (mine) {
      doc.segments = (doc.segments || []).map((s) =>
        s.key === claimedSceneKey ? { ...mine, updatedAt: new Date().toISOString() } : s
      );
      doc.text = joinScreenplayScenes(doc.segments);
    }
  } else {
    // Soft mode: push full local text but merge will protect remote locked scenes on peers
    doc.text = String(text || '');
    doc.segments = splitScreenplayScenes(doc.text).map((s) => ({
      ...s,
      updatedAt: new Date().toISOString(),
      authorEmail: meta.userEmail
    }));
  }

  writeLocal(key, projectTitle, doc);
  broadcast(key, projectTitle, doc);

  try {
    const remote = await pushRemote(key, projectTitle, doc);
    const merged = mergeScreenplayDocs(doc, remote, meta.userEmail);
    writeLocal(key, projectTitle, merged);
    broadcast(key, projectTitle, merged);
    return merged;
  } catch (e) {
    return doc;
  }
}

export async function fetchScreenplayCollab(roomId, projectTitle) {
  const key = roomId || 'SPS-CLOUD-8821';
  const meta = currentWriterMeta();
  const local = readLocal(key, projectTitle);
  try {
    const remote = await pullRemote(key, projectTitle);
    if (!remote) return local;
    const merged = mergeScreenplayDocs(local, remote, meta.userEmail);
    writeLocal(key, projectTitle, merged);
    return merged;
  } catch (e) {
    return local;
  }
}

export function getSceneLock(doc, sceneKey) {
  if (!doc || !sceneKey) return null;
  const locks = pruneLocks(doc.locks || {});
  return locks[sceneKey] || null;
}

export function isSceneLockedByOther(doc, sceneKey, myEmail) {
  const lock = getSceneLock(doc, sceneKey);
  if (!lock) return false;
  return String(lock.userEmail || '').toLowerCase() !== String(myEmail || '').toLowerCase();
}

export function sceneKeyAtCaret(text, caret) {
  const segs = splitScreenplayScenes(text);
  const pos = Math.max(0, caret || 0);
  let current = segs[0]?.key || null;
  for (const s of segs) {
    if (pos >= s.offset) current = s.key;
  }
  return current;
}

/**
 * Subscribe to collab updates for a room/project.
 * callback(doc)
 */
export function subscribeToScreenplayCollab(roomId, projectTitle, callback) {
  if (!isBrowser() || typeof callback !== 'function') return () => {};
  const key = roomId || 'SPS-CLOUD-8821';
  let cancelled = false;
  let timer = null;

  const emit = async () => {
    if (cancelled) return;
    const doc = await fetchScreenplayCollab(key, projectTitle);
    if (!cancelled) callback(doc);
  };

  emit();
  timer = setInterval(() => {
    if (typeof document !== 'undefined' && document.hidden) return;
    emit();
  }, POLL_MS);

  let bc = null;
  if ('BroadcastChannel' in window) {
    bc = new BroadcastChannel('sps_screenplay_collab');
    bc.onmessage = (ev) => {
      if (cancelled) return;
      if (ev?.data?.roomId && ev.data.roomId !== key) return;
      if (ev?.data?.projectTitle && String(ev.data.projectTitle) !== String(projectTitle || '')) return;
      if (ev?.data?.screenplay) {
        const meta = currentWriterMeta();
        const local = readLocal(key, projectTitle);
        const merged = mergeScreenplayDocs(local, ev.data.screenplay, meta.userEmail);
        writeLocal(key, projectTitle, merged);
        callback(merged);
      }
    };
  }

  const onVis = () => {
    if (document.visibilityState === 'visible') emit();
  };
  document.addEventListener('visibilitychange', onVis);

  return () => {
    cancelled = true;
    if (timer) clearInterval(timer);
    document.removeEventListener('visibilitychange', onVis);
    try {
      bc?.close();
    } catch (e) {}
  };
}
