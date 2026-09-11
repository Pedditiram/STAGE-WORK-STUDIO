import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  collection, 
  getDocs 
} from 'firebase/firestore';
import { ensurePrimaryAdminUser, sanitizeAuthorizedUsers, applyStudioSettings, collectStudioSettings } from '../utils/projectPermissions';
import { studioCollaboratorsForCloud, isSelfServeSession } from '../utils/tenantScope';
import { getNativeSyncUrl, subscribeToCollabTick } from './cloudSync';
import { safeLocalStorageSetItem } from '../utils/safeStorage';
import { slimProjectForLocalMirror, writeLocalProjectLibrary, readLocalProjectLibrary } from '../utils/projectWorkspace';
import { compactFilmForCloud, filmHasMatrix } from '../utils/filmCloudBody';

// Default Firebase Cloud Database Configuration
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyStageProductionStudioKeyDemo",
  authDomain: "stage-production-studio.firebaseapp.com",
  projectId: "stage-production-studio",
  storageBucket: "stage-production-studio.appspot.com",
  messagingSenderId: "98127391273",
  appId: "1:98127391273:web:stageproductionstudio"
};

/** Normalize + keep primary Owner; clears stale isStudioAdmin on Editor/Viewer. */
function secureCollaboratorList(users) {
  return ensurePrimaryAdminUser(sanitizeAuthorizedUsers(Array.isArray(users) ? users : []));
}

/** Drop allotments only for tombstoned titles — never for films this device has not hydrated yet. */
function pruneAndPersistCollaboratorAllotments() {
  if (typeof window === 'undefined') return;
  const deleted = readDeletedTitleKeys();
  if (!deleted.size) return;

  let users = [];
  try {
    users = JSON.parse(localStorage.getItem('sps_authorized_phone_users') || '[]');
  } catch (e) {
    return;
  }
  if (!Array.isArray(users) || users.length === 0) return;
  const pruned = users.map((u) => {
    if (!u || !Array.isArray(u.allottedProjects)) return u;
    const next = u.allottedProjects.filter((t) => {
      const key = String(t || '').trim().toUpperCase();
      if (!key) return false;
      if (key.includes('ALL STUDIO PROJECTS')) return true;
      return !deleted.has(key);
    });
    if (next.length === u.allottedProjects.length) return u;
    return { ...u, allottedProjects: next };
  });
  const secured = secureCollaboratorList(pruned);
  if (JSON.stringify(secured) === JSON.stringify(users)) return;
  localStorage.setItem('sps_authorized_phone_users', JSON.stringify(secured));
  window.dispatchEvent(new CustomEvent('sps_collaborators_updated', { detail: { source: 'dbService' } }));
}

/**
 * Cloud is source of truth — always apply sanitized cloud collaborators to localStorage.
 * Do not prune allotments against this device's library (it may be a subset).
 */
function applyCloudCollaborators(users) {
  if (typeof window === 'undefined') return null;
  if (!Array.isArray(users) || users.length === 0) return null;
  const secured = secureCollaboratorList(users);
  const newStr = JSON.stringify(secured);
  const oldStr = localStorage.getItem('sps_authorized_phone_users');
  if (newStr !== oldStr) {
    localStorage.setItem('sps_authorized_phone_users', newStr);
    try {
      localStorage.setItem('sps_collaborators_cloud_synced_at', new Date().toISOString());
    } catch (e) {}
    window.dispatchEvent(new CustomEvent('sps_collaborators_updated', { detail: { source: 'dbService' } }));
  }
  return secured;
}

function applyCloudStudioSettings(settings) {
  if (!settings || typeof settings !== 'object') return;
  try {
    applyStudioSettings(settings);
  } catch (e) {}
}

function syncApiUrl() {
  return getNativeSyncUrl();
}

function liveRoomId() {
  if (typeof window === 'undefined') return 'SPS-CLOUD-8821';
  try {
    return (
      localStorage.getItem('sps_current_room_id') ||
      localStorage.getItem('sps_cloud_room_id') ||
      'SPS-CLOUD-8821'
    );
  } catch (e) {
    return 'SPS-CLOUD-8821';
  }
}

// Permanent Production REST Cloud Database Endpoints (Zero-Config, 100% Active Globally across Firefox, Safari, Chrome)
const SPS_PROJECTS_BLOB_URL = "https://api.restful-api.dev/objects/ff8081819f7e10ae019f987050d92555";
const JSONBLOB_PROJECTS_URL = "https://jsonblob.com/api/jsonBlob/019ff13d-4075-73fe-8c17-d9e6ccf0f922";
const SPS_COLLABORATORS_BLOB_URL = "https://jsonblob.com/api/jsonBlob/019ff13d-79e0-75d9-9312-53b71c76be18";
// Dedicated presence blob (must NOT share the rooms hub URL or presence wipes collab rooms)
const SPS_PRESENCE_BLOB_URL = "https://jsonblob.com/api/jsonBlob/019ff13d-7ff2-7974-93c5-6c3abaa2cf10";

const LIBRARY_POLL_MS_ACTIVE = 20000;
const LIBRARY_POLL_MS_HIDDEN = 90000;
const COLLAB_POLL_MS_ACTIVE = 30000;
const COLLAB_POLL_MS_HIDDEN = 90000;
const FETCH_TIMEOUT_MS = 12000;

async function fetchJsonTimed(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: 'no-store', ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

let app = null;
let db = null;

// Initialize Firebase Database Engine dynamically
export function initDatabase(customConfig = null) {
  try {
    const config = customConfig || getStoredDbConfig();
    if (!config || !config.apiKey || config.apiKey.includes('Demo')) {
      return { success: false, note: 'Local mode active' };
    }
    if (!getApps().length) {
      app = initializeApp(config);
    } else {
      app = getApp();
    }
    db = getFirestore(app);
    return { success: true, db };
  } catch (err) {
    console.warn("Database initialization fallback to REST Cloud DB:", err.message);
    return { success: false, error: err.message };
  }
}

export function getStoredDbConfig() {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('sps_custom_firebase_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
  }
  return null;
}

export function saveStoredDbConfig(configObj) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('sps_custom_firebase_config', JSON.stringify(configObj));
    initDatabase(configObj);
  }
}

// 1. Sync Collaborator User Access Data to Cloud Database
export async function syncCollaboratorsToCloud(authorizedUsers) {
  if (typeof window === 'undefined') return;
  const secured = secureCollaboratorList(authorizedUsers);
  // Never push an empty collaborator list — would wipe Owner + allotments
  if (!secured.length) return;

  const payload = {
    users: studioCollaboratorsForCloud(secured),
    studioSettings: collectStudioSettings(),
    lastSynced: new Date().toISOString(),
    totalCollaborators: studioCollaboratorsForCloud(secured).length
  };

  const newStr = JSON.stringify(secured);
  const oldStr = localStorage.getItem('sps_authorized_phone_users');
  if (newStr !== oldStr) {
    localStorage.setItem('sps_authorized_phone_users', newStr);
    window.dispatchEvent(new CustomEvent('sps_collaborators_updated', { detail: { source: 'dbService' } }));
  }

  const base = syncApiUrl();
  try {
    await fetchJsonTimed(`${base}?type=collaborators`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (e) {}

  // Direct blob backup only when non-empty (native API is SoT; avoid wipe races)
  try {
    await fetchJsonTimed(SPS_COLLABORATORS_BLOB_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (e) {}

  if (db) {
    try {
      const collabRef = doc(db, 'studio_config', 'authorized_collaborators');
      await setDoc(collabRef, payload, { merge: true });
    } catch (e) {}
  }
}

let studioSettingsSyncTimer = null;
let collaboratorsSyncTimer = null;

export function scheduleStudioSettingsSync() {
  if (typeof window === 'undefined') return;
  if (studioSettingsSyncTimer) clearTimeout(studioSettingsSyncTimer);
  studioSettingsSyncTimer = setTimeout(() => {
    syncStudioSettingsToCloud().catch(() => {});
  }, 450);
}

export function scheduleCollaboratorsCloudSync() {
  if (typeof window === 'undefined') return;
  if (collaboratorsSyncTimer) clearTimeout(collaboratorsSyncTimer);
  collaboratorsSyncTimer = setTimeout(() => {
    try {
      const users = JSON.parse(localStorage.getItem('sps_authorized_phone_users') || '[]');
      if (Array.isArray(users) && users.length) syncCollaboratorsToCloud(users);
    } catch (e) {}
    syncStudioSettingsToCloud().catch(() => {});
  }, 450);
}

export async function syncStudioSettingsToCloud() {
  if (typeof window === 'undefined') return;
  const settings = collectStudioSettings();
  try {
    await fetchJsonTimed(`${syncApiUrl()}?type=settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings })
    });
  } catch (e) {}
}

export async function fetchStudioSettingsFromCloud() {
  try {
    const res = await fetchJsonTimed(`${syncApiUrl()}?type=settings`);
    if (res.ok) {
      const data = await res.json();
      if (data?.settings && (data.settings.updatedAt || Object.keys(data.settings.studioModules || {}).length)) {
        applyCloudStudioSettings(data.settings);
        return data.settings;
      }
    }
  } catch (e) {}
  return null;
}

// 2. Fetch All Collaborators from Cloud Database (cloud wins → local)
export async function fetchCollaboratorsFromCloud() {
  const base = syncApiUrl();
  try {
    const res = await fetchJsonTimed(`${base}?type=collaborators`);
    if (res.status === 304) {
      const saved = localStorage.getItem('sps_authorized_phone_users');
      try {
        return secureCollaboratorList(saved ? JSON.parse(saved) : []);
      } catch (e) {
        return [];
      }
    }
    if (res.status === 503) {
      // Durable unreachable — keep local, do not wipe
      const saved = localStorage.getItem('sps_authorized_phone_users');
      try {
        return secureCollaboratorList(saved ? JSON.parse(saved) : []);
      } catch (e) {
        return [];
      }
    }
    if (res.ok) {
      const data = await res.json();
      if (data?.durableFailed) {
        const saved = localStorage.getItem('sps_authorized_phone_users');
        try {
          return secureCollaboratorList(saved ? JSON.parse(saved) : []);
        } catch (e) {
          return [];
        }
      }
      if (data.studioSettings && (data.studioSettings.updatedAt || Object.keys(data.studioSettings.studioModules || {}).length)) {
        applyCloudStudioSettings(data.studioSettings);
      }
      if (Array.isArray(data.users) && data.users.length > 0) {
        const applied = applyCloudCollaborators(data.users);
        if (applied) return applied;
      }
    }
  } catch (e) {}

  try {
    const res = await fetchJsonTimed(`${SPS_COLLABORATORS_BLOB_URL}?t=${Date.now()}`);
    if (res.ok) {
      const data = await res.json();
      if (data?.studioSettings) applyCloudStudioSettings(data.studioSettings);
      if (Array.isArray(data.users) && data.users.length > 0) {
        const applied = applyCloudCollaborators(data.users);
        if (applied) return applied;
      }
    }
  } catch (e) {}

  if (db) {
    try {
      const collabRef = doc(db, 'studio_config', 'authorized_collaborators');
      const snap = await getDoc(collabRef);
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data.users)) {
          if (data.studioSettings && (data.studioSettings.updatedAt || Object.keys(data.studioSettings.studioModules || {}).length)) {
        applyCloudStudioSettings(data.studioSettings);
      }
          const applied = applyCloudCollaborators(data.users);
          if (applied) return applied;
        }
      }
    } catch (e) {}
  }

  const saved = localStorage.getItem('sps_authorized_phone_users');
  try {
    return secureCollaboratorList(saved ? JSON.parse(saved) : []);
  } catch (e) {
    return [];
  }
}

// 3. Real-time Live Listener for Collaborator Access Updates
export function subscribeToCollaboratorUpdates(onUsersReceived) {
  if (typeof window === 'undefined') return () => {};

  let unsubscribe = () => {};
  let pollTimer = null;
  let cancelled = false;

  const pull = async () => {
    if (cancelled) return;
    try {
      const users = await fetchCollaboratorsFromCloud();
      if (Array.isArray(users) && typeof onUsersReceived === 'function') {
        onUsersReceived(users);
      }
    } catch (e) {}
  };

  const schedule = () => {
    if (pollTimer) clearInterval(pollTimer);
    const ms =
      typeof document !== 'undefined' && document.hidden
        ? COLLAB_POLL_MS_HIDDEN
        : COLLAB_POLL_MS_ACTIVE;
    pollTimer = setInterval(pull, ms);
  };

  const onVis = () => {
    if (cancelled) return;
    if (typeof document !== 'undefined' && document.hidden) {
      schedule();
      return;
    }
    pull();
    schedule();
  };

  pull();
  schedule();
  let lastCollabStamp = '';
  let lastSettingsStamp = '';
  const unsubTick = subscribeToCollabTick(liveRoomId(), '', (tick, reason) => {
    if (cancelled || reason === 'init') {
      lastCollabStamp = String(tick?.collaborators?.stamp || '');
      lastSettingsStamp = String(tick?.settings?.stamp || '');
      return;
    }
    const collabSig = String(tick?.collaborators?.stamp || '');
    const settingsSig = String(tick?.settings?.stamp || '');
    const collabChanged = Boolean(collabSig) && collabSig !== lastCollabStamp;
    const settingsChanged = Boolean(settingsSig) && settingsSig !== lastSettingsStamp;
    if (collabChanged) lastCollabStamp = collabSig;
    if (settingsChanged) lastSettingsStamp = settingsSig;
    if (collabChanged || settingsChanged) {
      pull();
      if (settingsChanged && !collabChanged) {
        fetchStudioSettingsFromCloud().catch(() => {});
      }
    }
  });
  if (typeof window !== 'undefined') {
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
  }

  if (db) {
    try {
      const collabRef = doc(db, 'studio_config', 'authorized_collaborators');
      unsubscribe = onSnapshot(collabRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data?.studioSettings) applyCloudStudioSettings(data.studioSettings);
          if (Array.isArray(data.users)) {
            const applied = applyCloudCollaborators(data.users);
            if (typeof onUsersReceived === 'function') {
              onUsersReceived(applied || secureCollaboratorList(data.users));
            }
          }
        }
      }, (err) => {});
    } catch (e) {}
  }

  return () => {
    cancelled = true;
    if (pollTimer) clearInterval(pollTimer);
    if (typeof unsubTick === 'function') unsubTick();
    if (typeof window !== 'undefined') {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
    }
    unsubscribe();
  };
}

// 4. Sync Whole Studio Project Library to Cloud Database
export async function syncProjectLibraryToCloud(projectLibrary) {
  if (typeof window === 'undefined') return;
  if (isSelfServeSession()) return;
  const list = filterOutDeletedProjects(Array.isArray(projectLibrary) ? projectLibrary : []);
  // Never push empty library to cloud — empty overwrite guard on server is backup only
  if (list.length === 0) return;

  const slimmedList = list.map(slimProjectForLocalMirror);
  const liveKeys = new Set(slimmedList.map((p) => projectKey(p)).filter(Boolean));
  const pinned = readPinnedLiveTitleKeys();
  const deletedTitles = Array.from(readDeletedTitleKeys()).filter(
    (t) => !liveKeys.has(t) && !pinned.has(t)
  );
  const payload = {
    projects: slimmedList,
    deletedTitles,
    updatedAt: new Date().toISOString(),
    totalProjects: slimmedList.length
  };

  writeLocalProjectLibrary(slimmedList);
  if (JSON.stringify(slimmedList) !== JSON.stringify(readLocalProjectLibrary())) {
    window.dispatchEvent(new CustomEvent('sps_projects_updated', { detail: { source: 'dbService' } }));
  }

  pruneAndPersistCollaboratorAllotments(slimmedList);

  // Push to Native Vercel Serverless Sync Engine (/api/sync) — authoritative
  try {
    await fetchJsonTimed(`${syncApiUrl()}?type=projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (e) {}

  // Best-effort backups — never PUT empty; skip if rate-limited
  try {
    await fetchJsonTimed(SPS_PROJECTS_BLOB_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Stage Work Studio Projects', data: payload })
    });
  } catch (e) {}

  try {
    await fetchJsonTimed(JSONBLOB_PROJECTS_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (e) {}

  if (db) {
    try {
      const libRef = doc(db, 'studio_config', 'project_library');
      await setDoc(libRef, payload, { merge: true });
    } catch (e) {}
  }
}

const filmSyncTimers = new Map();
let cloudLibrarySeededThisSession = false;

export async function fetchFilmFromCloud(title) {
  if (typeof window === 'undefined') return null;
  if (isSelfServeSession()) return null;
  const clean = String(title || '').trim();
  if (!clean) return null;
  try {
    const res = await fetchJsonTimed(
      `${syncApiUrl()}?type=film&project=${encodeURIComponent(clean)}`,
      {},
      20000
    );
    if (!res?.ok) return null;
    const data = await res.json();
    return data?.project && typeof data.project === 'object' ? data.project : null;
  } catch {
    return null;
  }
}

export async function syncFilmToCloud(project) {
  if (typeof window === 'undefined') return false;
  if (isSelfServeSession()) return false;
  const body = compactFilmForCloud(project);
  if (!body || !filmHasMatrix(body)) return false;
  const title = body.title;
  if (filmSyncTimers.has(title)) clearTimeout(filmSyncTimers.get(title));
  return new Promise((resolve) => {
    const t = setTimeout(async () => {
      filmSyncTimers.delete(title);
      try {
        const res = await fetchJsonTimed(
          `${syncApiUrl()}?type=film`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ project: body })
          },
          25000
        );
        resolve(Boolean(res?.ok));
      } catch {
        resolve(false);
      }
    }, 600);
    filmSyncTimers.set(title, t);
  });
}

/** Push this device's library + full films when cloud is empty or missing titles. */
export async function seedCloudLibraryFromDevice(library, fullFilms = []) {
  if (typeof window === 'undefined') return;
  if (isSelfServeSession()) return;
  const list = filterOutDeletedProjects(Array.isArray(library) ? library : []);
  if (!list.length) return;
  await syncProjectLibraryToCloud(list);
  const films = Array.isArray(fullFilms) && fullFilms.length ? fullFilms : list;
  await Promise.all(
    films.filter((p) => filmHasMatrix(p)).map((p) => syncFilmToCloud(p))
  );
  cloudLibrarySeededThisSession = true;
}

export function cloudLibraryNeedsSeed() {
  return !cloudLibrarySeededThisSession;
}

// 5. Subscribe to Real-Time Project Library Updates from Cloud
export function subscribeToProjectLibraryUpdates(callback) {
  if (typeof window === 'undefined') return () => {};

  initDatabase();

  let pollTimer = null;
  let cancelled = false;

  const checkUpdates = async () => {
    if (cancelled) return;
    try {
      const projects = await fetchProjectLibraryFromCloud();
      if (Array.isArray(projects) && typeof callback === 'function') {
        callback(projects);
      }
    } catch (e) {}
  };

  const schedule = () => {
    if (pollTimer) clearInterval(pollTimer);
    const ms =
      typeof document !== 'undefined' && document.hidden
        ? LIBRARY_POLL_MS_HIDDEN
        : LIBRARY_POLL_MS_ACTIVE;
    pollTimer = setInterval(checkUpdates, ms);
  };

  const onVis = () => {
    if (cancelled) return;
    if (typeof document !== 'undefined' && document.hidden) {
      schedule();
      return;
    }
    checkUpdates();
    schedule();
  };

  checkUpdates();
  schedule();
  let lastLibStamp = '';
  const unsubTick = subscribeToCollabTick(liveRoomId(), '', (tick, reason) => {
    if (cancelled || reason === 'init') {
      lastLibStamp = String(tick?.projects?.stamp || '');
      return;
    }
    const sig = String(tick?.projects?.stamp || '');
    if (sig && sig !== lastLibStamp) {
      lastLibStamp = sig;
      checkUpdates();
    }
  });
  if (typeof window !== 'undefined') {
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    window.addEventListener('pageshow', onVis);
  }

  let unsubscribe = () => {};
  if (db && typeof window !== 'undefined') {
    try {
      const libRef = doc(db, 'studio_config', 'project_library');
      unsubscribe = onSnapshot(libRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data && Array.isArray(data.projects)) {
            processAndStoreProjects(data.projects).then((applied) => {
              if (typeof callback === 'function') callback(applied);
            }).catch(() => {});
          }
        }
      }, (err) => {});
    } catch (e) {}
  }

  return () => {
    cancelled = true;
    if (pollTimer) clearInterval(pollTimer);
    if (typeof unsubTick === 'function') unsubTick();
    if (typeof window !== 'undefined') {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
      window.removeEventListener('pageshow', onVis);
    }
    unsubscribe();
  };
}

function projectKey(p) {
  return String(p?.title || '').trim().toUpperCase();
}

const DELETED_TITLES_KEY = 'sps_deleted_project_titles';
const PROJECT_ARCHIVE_KEY = 'sps_project_archive';
const OPENED_LIVE_TITLES_KEY = 'sps_opened_live_titles';
const MAX_ARCHIVED_PROJECTS = 40;

function readDeletedTitleKeys() {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = JSON.parse(localStorage.getItem(DELETED_TITLES_KEY) || '[]');
    return new Set(
      (Array.isArray(raw) ? raw : [])
        .map((t) => String(t || '').trim().toUpperCase())
        .filter((t) => t && t !== 'STAGE PRODUCTION STUDIO')
    );
  } catch (e) {
    return new Set();
  }
}

function readArchivedTitleKeys() {
  return new Set(
    readProjectArchive()
      .map((p) => String(p?.title || '').trim().toUpperCase())
      .filter((t) => t && t !== 'STAGE PRODUCTION STUDIO')
  );
}

function readPinnedLiveTitleKeys() {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = JSON.parse(localStorage.getItem(OPENED_LIVE_TITLES_KEY) || '[]');
    return new Set(
      (Array.isArray(raw) ? raw : [])
        .map((t) => String(t || '').trim().toUpperCase())
        .filter((t) => t && t !== 'STAGE PRODUCTION STUDIO')
    );
  } catch {
    return new Set();
  }
}

function writePinnedLiveTitleKeys(set) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(OPENED_LIVE_TITLES_KEY, JSON.stringify(Array.from(set)));
}

function pinLiveTitle(title) {
  const key = String(title || '').trim().toUpperCase();
  if (!key || key === 'STAGE PRODUCTION STUDIO') return;
  const set = readPinnedLiveTitleKeys();
  set.add(key);
  writePinnedLiveTitleKeys(set);
}

function unpinLiveTitles(titles) {
  const list = Array.isArray(titles) ? titles : [titles];
  const set = readPinnedLiveTitleKeys();
  let changed = false;
  list.forEach((t) => {
    const key = String(t || '').trim().toUpperCase();
    if (set.delete(key)) changed = true;
  });
  if (changed) writePinnedLiveTitleKeys(set);
}

export function isTitlePinnedLive(title) {
  const key = String(title || '').trim().toUpperCase();
  return Boolean(key && readPinnedLiveTitleKeys().has(key));
}

/** Keep a newly created / opened title in Library across cloud hydrate. */
export function pinLiveLibraryTitle(title) {
  pinLiveTitle(title);
}

function blockedLibraryTitleKeys() {
  const pinned = readPinnedLiveTitleKeys();
  return new Set(
    [...readDeletedTitleKeys(), ...readArchivedTitleKeys()].filter((k) => !pinned.has(k))
  );
}

/** True when a title was deleted/archived and must not re-enter the live library. */
export function isProjectTitleDeleted(title) {
  const key = String(title || '').trim().toUpperCase();
  if (!key || key === 'STAGE PRODUCTION STUDIO') return false;
  return blockedLibraryTitleKeys().has(key);
}

function readProjectArchive() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(localStorage.getItem(PROJECT_ARCHIVE_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch (e) {
    return [];
  }
}

function writeProjectArchive(list) {
  if (typeof window === 'undefined') return;
  const next = Array.isArray(list) ? list.slice(0, MAX_ARCHIVED_PROJECTS) : [];
  safeLocalStorageSetItem(PROJECT_ARCHIVE_KEY, JSON.stringify(next));
  try {
    window.dispatchEvent(new CustomEvent('sps_project_archive_updated', { detail: { source: 'dbService' } }));
  } catch (e) {}
}

export function getArchivedProjects() {
  return readProjectArchive();
}

/**
 * Move a live project into Archive (full snapshot) and tombstone its title
 * so cloud hydrate / auto-heal cannot resurrect it into the library.
 */
export function archiveProjectSnapshot(project) {
  if (typeof window === 'undefined' || !project?.title) return null;
  const title = String(project.title).trim();
  if (!title || title.toUpperCase() === 'STAGE PRODUCTION STUDIO') return null;

  const archiveId = `arch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const entry = {
    ...JSON.parse(JSON.stringify(project)),
    archiveId,
    archivedAt: new Date().toISOString(),
    archivedAtLabel: new Date().toLocaleString()
  };

  const prev = readProjectArchive().filter(
    (p) => String(p?.title || '').trim().toUpperCase() !== title.toUpperCase()
  );
  writeProjectArchive([entry, ...prev]);
  markProjectTitlesDeleted([title]);
  import('./projectDiskVault').then((m) => m.removeProjectFromVault(title, 'archived')).catch(() => {});
  return entry;
}

/** Restore an archived project into the live library; clears its delete tombstone. */
export function restoreProjectFromArchive(archiveId) {
  if (typeof window === 'undefined' || !archiveId) return null;
  const archive = readProjectArchive();
  const idx = archive.findIndex((p) => p.archiveId === archiveId || p.id === archiveId);
  if (idx === -1) return null;

  const entry = archive[idx];
  const { archiveId: _aid, archivedAt, archivedAtLabel, ...project } = entry;
  const title = String(project.title || '').trim();
  if (!title) return null;

  clearDeletedTitleKeys([title]);

  let library = [];
  try {
    library = readLocalProjectLibrary();
  } catch (e) {}
  if (!Array.isArray(library)) library = [];

  const key = title.toUpperCase();
  const existingIdx = library.findIndex((p) => String(p?.title || '').trim().toUpperCase() === key);
  const restored = {
    ...project,
    id: project.id || `proj_${Date.now()}`,
    title,
    lastModified: new Date().toLocaleDateString(),
    restoredAt: new Date().toISOString()
  };
  if (existingIdx >= 0) library[existingIdx] = { ...library[existingIdx], ...restored };
  else library.unshift(restored);

  writeLocalProjectLibrary(library);
  writeProjectArchive(archive.filter((_, i) => i !== idx));
  import('./projectDiskVault').then((m) => m.restoreProjectToVault(title)).catch(() => {});
  window.dispatchEvent(new CustomEvent('sps_projects_updated', { detail: { source: 'dbService' } }));
  return restored;
}

/** Remove from Archive (cannot restore in-app). Disk copy moves to projects/purged/. Title stays tombstoned. */
export function purgeArchivedProject(archiveId) {
  if (typeof window === 'undefined' || !archiveId) return;
  const archive = readProjectArchive();
  const entry = archive.find((p) => p.archiveId === archiveId || p.id === archiveId);
  const title = String(entry?.title || '').trim();
  writeProjectArchive(archive.filter((p) => p.archiveId !== archiveId && p.id !== archiveId));
  if (title) {
    markProjectTitlesDeleted([title]);
    import('./projectDiskVault').then((m) => m.removeProjectFromVault(title, 'purged')).catch(() => {});
  }
}

/** Record deleted titles so cloud hydrates cannot resurrect them. */
export function markProjectTitlesDeleted(titles) {
  if (typeof window === 'undefined') return;
  const list = Array.isArray(titles) ? titles : [titles];
  unpinLiveTitles(list);
  const set = readDeletedTitleKeys();
  list.forEach((t) => {
    const key = String(t || '').trim().toUpperCase();
    if (key && key === 'STAGE PRODUCTION STUDIO') return;
    if (key) set.add(key);
  });
  localStorage.setItem(DELETED_TITLES_KEY, JSON.stringify(Array.from(set)));
}

/**
 * Merge cloud delete tombstones into this device.
 * Never un-tombstone a title just because a stale cloud library still lists it —
 * that is what put archived/purged films back in Library.
 * Titles the user just Open-file'd stay live on this device.
 */
export function applyCloudDeletedTitles(deletedTitles, _liveProjects = []) {
  if (typeof window === 'undefined') return;
  const pinned = readPinnedLiveTitleKeys();
  const incoming = (Array.isArray(deletedTitles) ? deletedTitles : [])
    .map((t) => String(t || '').trim().toUpperCase())
    .filter((t) => t && t !== 'STAGE PRODUCTION STUDIO' && !pinned.has(t));
  if (!incoming.length) return;
  const set = readDeletedTitleKeys();
  incoming.forEach((t) => set.add(t));
  localStorage.setItem(DELETED_TITLES_KEY, JSON.stringify(Array.from(set)));
}

/**
 * Archived projects are intentionally placed into archive by the user and must stay there
 * until explicitly restored by the user. Never automatically pull them out.
 */
export function healActiveProjectFromArchive() {
  return null;
}

function clearDeletedTitleKeys(titles) {
  if (typeof window === 'undefined') return;
  const list = Array.isArray(titles) ? titles : [titles];
  if (!list.length) return;
  const set = readDeletedTitleKeys();
  let changed = false;
  list.forEach((t) => {
    const key = String(t || '').trim().toUpperCase();
    if (set.delete(key)) changed = true;
  });
  if (changed) localStorage.setItem(DELETED_TITLES_KEY, JSON.stringify(Array.from(set)));
}

/** Allow recreating a previously deleted title. */
export function clearDeletedProjectTitles(titles) {
  clearDeletedTitleKeys(titles);
}

/** Open File / Restore: this title is allowed back into Library (out of Archive + tombstones). */
export function reviveProjectTitleForOpen(title) {
  const clean = String(title || '').trim();
  if (!clean) return;
  clearDeletedTitleKeys([clean]);
  const archive = readProjectArchive();
  const key = clean.toUpperCase();
  const next = archive.filter((p) => String(p?.title || '').trim().toUpperCase() !== key);
  if (next.length !== archive.length) writeProjectArchive(next);
  pinLiveTitle(clean);
}

export function filterOutDeletedProjects(projects) {
  const blocked = blockedLibraryTitleKeys();
  let openKey = '';
  try {
    openKey = String(localStorage.getItem('sps_current_project_title') || '').trim().toUpperCase();
  } catch {
    openKey = '';
  }
  return (Array.isArray(projects) ? projects : []).filter((p) => {
    const key = projectKey(p);
    if (!key || key === 'STAGE PRODUCTION STUDIO') return false;
    if (openKey && key === openKey) return true;
    return !blocked.has(key);
  });
}

function projectRecency(p) {
  if (!p || typeof p !== 'object') return 0;
  const candidates = [p.updatedAt, p.lastUpdated, p.lastModified, p.revision];
  for (const c of candidates) {
    if (typeof c === 'number' && Number.isFinite(c)) return c;
    const t = Date.parse(String(c || ''));
    if (!Number.isNaN(t)) return t;
  }
  return Array.isArray(p.shots) ? p.shots.length : 0;
}

/**
 * Cloud enriches shared titles. Live local-only films (new creates, not yet on KV)
 * stay in the library. Tombstoned / archived titles are already excluded via
 * blockedLibraryTitleKeys — that is how deletes stay gone, not by dropping drafts.
 */
function mergeProjectArrays(cloudProjs, localProjs, { cloudAuthoritative = true } = {}) {
  const deleted = blockedLibraryTitleKeys();
  const map = new Map();
  const localByKey = new Map();

  (localProjs || []).forEach((p) => {
    const key = projectKey(p);
    if (!key || key === 'STAGE PRODUCTION STUDIO' || deleted.has(key)) return;
    localByKey.set(key, p);
  });

  (cloudProjs || []).forEach((p) => {
    const key = projectKey(p);
    if (!key || key === 'STAGE PRODUCTION STUDIO' || deleted.has(key)) return;
    const local = localByKey.get(key);
    if (!local) {
      map.set(key, p);
      return;
    }
    const cloudScore = projectRecency(p);
    const localScore = projectRecency(local);
    if (cloudScore >= localScore || (Array.isArray(p.shots) && p.shots.length > 0)) {
      map.set(key, { ...local, ...p });
    } else {
      map.set(key, { ...p, ...local });
    }
  });

  localByKey.forEach((p, key) => {
    if (map.has(key)) return;
    map.set(key, p);
  });

  return Array.from(map.values());
}

let healCloudLibraryTimer = null;

async function processAndStoreProjects(rawCloudProjects, { cloudAuthoritative = true } = {}) {
  if (isSelfServeSession()) return readLocalProjectLibrary();
  const localProjs = readLocalProjectLibrary();

  // Durable failed with no usable list — keep local intact (+ disk vault)
  if (!cloudAuthoritative && (!Array.isArray(rawCloudProjects) || rawCloudProjects.length === 0)) {
    const { enrichLibraryWithDiskVault, writeLocalProjectLibrary } = await import('../utils/projectWorkspace');
    const kept = filterOutDeletedProjects(await enrichLibraryWithDiskVault(localProjs));
    writeLocalProjectLibrary(kept);
    return kept;
  }

  if (!Array.isArray(rawCloudProjects)) {
    const { enrichLibraryWithDiskVault, writeLocalProjectLibrary } = await import('../utils/projectWorkspace');
    const kept = filterOutDeletedProjects(await enrichLibraryWithDiskVault(localProjs));
    writeLocalProjectLibrary(kept);
    return kept;
  }

  const deletedKeys = blockedLibraryTitleKeys();
  const cloudHadGhosts = (rawCloudProjects || []).some((p) => deletedKeys.has(projectKey(p)));
  // When durableOk is false, keep local-only drafts (do not treat cloud as full membership SoT)
  const merged = mergeProjectArrays(rawCloudProjects, localProjs, {
    cloudAuthoritative: Boolean(cloudAuthoritative)
  });
  const { enrichLibraryWithDiskVault, writeLocalProjectLibrary } = await import('../utils/projectWorkspace');
  let finalList = filterOutDeletedProjects(
    await enrichLibraryWithDiskVault(filterOutDeletedProjects(merged))
  );

  const localStr = JSON.stringify(Array.isArray(localProjs) ? localProjs : []);
  const newStr = JSON.stringify(finalList);
  const wrote = writeLocalProjectLibrary(finalList);
  if (wrote || newStr !== localStr) {
    try {
      localStorage.setItem('sps_projects_cloud_synced_at', new Date().toISOString());
    } catch (e) {}
    window.dispatchEvent(new CustomEvent('sps_projects_updated', { detail: { source: 'dbService' } }));
  }

  pruneAndPersistCollaboratorAllotments(finalList);

  if (cloudHadGhosts && cloudAuthoritative) {
    if (healCloudLibraryTimer) clearTimeout(healCloudLibraryTimer);
    healCloudLibraryTimer = setTimeout(() => {
      syncProjectLibraryToCloud(finalList);
    }, 250);
  }

  return finalList;
}

// 6. Fetch Latest Project Library from Cloud Database (cloud → local)
export async function fetchProjectLibraryFromCloud() {
  if (typeof window !== 'undefined' && isSelfServeSession()) {
    return readLocalProjectLibrary();
  }
  // 1. Try Native Vercel Serverless Sync Engine (authoritative when reachable)
  try {
    const res = await fetchJsonTimed(`${syncApiUrl()}?type=projects`);
    if (res.status === 304) {
      // Local library is already up to date with cloud
      const savedLib = readLocalProjectLibrary();
      try {
        return filterOutDeletedProjects(savedLib);
      } catch (e) {
        return [];
      }
    }
    if (res.status === 503) {
      // Durable hydrate failed — do NOT clear local library
      return processAndStoreProjects([], { cloudAuthoritative: false });
    }
    if (res.ok) {
      const data = await res.json();
      if (data?.durableFailed || data?.projects === null) {
        return processAndStoreProjects([], { cloudAuthoritative: false });
      }
      applyCloudDeletedTitles(
        Array.isArray(data.deletedTitles) ? data.deletedTitles : [],
        Array.isArray(data.projects) ? data.projects : []
      );
      if (Array.isArray(data.projects)) {
        if (data.projects.length === 0) {
          return processAndStoreProjects([], { cloudAuthoritative: false });
        }
        // Empty cloud library is valid only when durableOk (explicit empty SoT)
        return processAndStoreProjects(data.projects, {
          cloudAuthoritative: data.durableOk !== false
        });
      }
    }
  } catch (e) {}

  // 2. Prefer durable JSONBlob over rate-limited RESTFUL
  try {
    const res = await fetchJsonTimed(`${JSONBLOB_PROJECTS_URL}?t=${Date.now()}`);
    if (res.ok) {
      const data = await res.json();
      applyCloudDeletedTitles(
        Array.isArray(data.deletedTitles) ? data.deletedTitles : [],
        Array.isArray(data.projects) ? data.projects : []
      );
      if (Array.isArray(data.projects)) {
        return processAndStoreProjects(data.projects);
      }
    }
  } catch (e) {}

  try {
    const res = await fetchJsonTimed(`${SPS_PROJECTS_BLOB_URL}?t=${Date.now()}`);
    if (res.ok) {
      const resData = await res.json();
      const projects = resData?.data?.projects || resData?.projects;
      if (Array.isArray(projects)) {
        return processAndStoreProjects(projects);
      }
    }
  } catch (e) {}

  if (db) {
    try {
      const libRef = doc(db, 'studio_config', 'project_library');
      const snap = await getDoc(libRef);
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data.projects)) {
          return processAndStoreProjects(data.projects);
        }
      }
    } catch (e) {}
  }

  // Cloud unreachable — keep local (non-authoritative)
  const savedLib = readLocalProjectLibrary();
  try {
    return filterOutDeletedProjects(savedLib);
  } catch (e) {
    return [];
  }
}

// 7. Broadcast user active editing slot to Cloud
export async function broadcastActiveSlotEditing(userEmail, userName, projectTitle, shotId, isEditing = false, roomId = '') {
  if (!userEmail || !shotId) return;
  const cleanEmail = userEmail.trim().toLowerCase();
  const presenceId = cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');

  const payload = {
    presenceId,
    userEmail: cleanEmail,
    userName: userName || cleanEmail.split('@')[0],
    projectTitle: projectTitle || 'STAGE PRODUCTION STUDIO',
    roomId: roomId || (typeof window !== 'undefined' ? (localStorage.getItem('sps_cloud_room_id') || '') : ''),
    activeShotId: shotId,
    isEditing: Boolean(isEditing),
    timestamp: Date.now()
  };

  // Native sync is SoT — dedicated blob is read-merge backup only when GET succeeds
  try {
    await fetchJsonTimed(`${syncApiUrl()}?type=presence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (e) {}

  try {
    const res = await fetchJsonTimed(`${SPS_PRESENCE_BLOB_URL}?t=${Date.now()}`);
    if (!res.ok) return; // Never PUT empty slots on failed GET (wipes peers)
    let data = { activeSlots: {} };
    try {
      const parsed = await res.json();
      data = parsed?.activeSlots ? parsed : { activeSlots: parsed || {} };
      if (!data.activeSlots || typeof data.activeSlots !== 'object') data.activeSlots = {};
    } catch (e) {
      return;
    }
    data.activeSlots[presenceId] = payload;
    data.updatedAt = new Date().toISOString();

    await fetchJsonTimed(SPS_PRESENCE_BLOB_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  } catch (e) {}

  if (db) {
    try {
      const pRef = doc(db, 'active_editing_slots', presenceId);
      await setDoc(pRef, payload, { merge: true });
    } catch (e) {}
  }
}

const PRESENCE_TTL_MS = 120000;

function collectActiveUsers(activeSlots, currentEmail, now = Date.now()) {
  const activeUsersMap = [];
  Object.values(activeSlots || {}).forEach((item) => {
    if (item && (now - (item.timestamp || 0)) < PRESENCE_TTL_MS) {
      if (item.userEmail !== (currentEmail || '').trim().toLowerCase()) {
        activeUsersMap.push(item);
      }
    }
  });
  return activeUsersMap;
}

function collectOnlineEmails(activeSlots, now = Date.now()) {
  const emails = new Set();
  Object.values(activeSlots || {}).forEach((item) => {
    if (!item || (now - (item.timestamp || 0)) >= PRESENCE_TTL_MS) return;
    const email = String(item.userEmail || '').trim().toLowerCase();
    if (email) emails.add(email);
  });
  return emails;
}

async function fetchMergedPresenceSlots() {
  const merged = {};
  try {
    const res = await fetch(`${syncApiUrl()}?type=presence`, { cache: 'no-store' });
    if (res.ok) {
      const resData = await res.json();
      Object.assign(merged, resData?.activeSlots || {});
      if (Object.keys(merged).length > 0) return merged;
    }
  } catch (e) {}
  try {
    const resBlob = await fetch(`${SPS_PRESENCE_BLOB_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (resBlob.ok) {
      const data = await resBlob.json();
      const slots = data?.activeSlots || (data && typeof data === 'object' ? data : {});
      Object.entries(slots).forEach(([key, val]) => {
        if (!val || typeof val !== 'object') return;
        const existing = merged[key];
        if (!existing || (val.timestamp || 0) >= (existing.timestamp || 0)) {
          merged[key] = val;
        }
      });
    }
  } catch (e) {}
  return merged;
}

function pollPresence(onTick) {
  if (typeof window === 'undefined') return () => {};
  const tick = async () => {
    if (typeof document !== 'undefined' && document.hidden) return;
    try {
      const merged = await fetchMergedPresenceSlots();
      onTick(merged, Date.now());
    } catch (e) {}
  };
  tick();
  const interval = setInterval(tick, 15000);
  return () => clearInterval(interval);
}

// 8. Subscribe to Active Editing Slots — always on when called (Local badge must not hide peers)
export function subscribeToActiveEditingSlots(currentEmail, callback) {
  return pollPresence((merged, now) => {
    if (typeof callback === 'function') {
      callback(collectActiveUsers(merged, currentEmail, now));
    }
  });
}

/** Live emails with a heartbeat in the last 2 minutes (includes current user). */
export function subscribeToPresenceEmails(callback) {
  return pollPresence((merged, now) => {
    if (typeof callback === 'function') {
      callback(collectOnlineEmails(merged, now));
    }
  });
}

// 9. Test Live Cloud Database Connection
export async function testDatabaseConnection() {
  const startTime = Date.now();
  try {
    const res = await fetchJsonTimed(`${syncApiUrl()}?type=presence`);
    const latency = Date.now() - startTime;
    if (res.ok) {
      return {
        connected: true,
        message: `🟢 Production Sync Connected • Operational (Ping: ${latency}ms)`
      };
    }
    return {
      connected: false,
      message: `🔴 Sync API returned HTTP ${res.status}`
    };
  } catch (err) {
    return {
      connected: false,
      message: `🔴 Sync unreachable: ${err?.message || 'network error'}`
    };
  }
}

/** Phone alerts (SMS / WhatsApp) — held. No network call until re-enabled. */
export async function notifyStudioWhatsApp() {
  return;
}

export async function notifyStudioOnlineWhatsApp() {
  return;
}

// Auto Initialize Database on import
initDatabase();
