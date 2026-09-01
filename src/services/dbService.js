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
import { ensurePrimaryAdminUser, sanitizeAuthorizedUsers, pruneAllottedProjectsToLibrary } from '../utils/projectPermissions';
import { getNativeSyncUrl } from './cloudSync';
import { safeLocalStorageSetItem } from '../utils/safeStorage';

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

/** Strip allotted titles that no longer exist in the live project library; persist if changed. */
function pruneAndPersistCollaboratorAllotments(projectLibrary) {
  if (typeof window === 'undefined') return;
  const live = Array.isArray(projectLibrary) ? projectLibrary : [];
  // Only prune against a hydrated non-empty library (prevents wiping allotments on empty cold start)
  const realTitles = live.filter((p) => {
    const t = String(p?.title || '').trim().toUpperCase();
    return t && t !== 'STAGE PRODUCTION STUDIO';
  });
  if (realTitles.length === 0) return;

  let users = [];
  try {
    users = JSON.parse(localStorage.getItem('sps_authorized_phone_users') || '[]');
  } catch (e) {
    return;
  }
  if (!Array.isArray(users) || users.length === 0) return;
  const pruned = secureCollaboratorList(pruneAllottedProjectsToLibrary(users, live));
  if (JSON.stringify(pruned) === JSON.stringify(users)) return;
  localStorage.setItem('sps_authorized_phone_users', JSON.stringify(pruned));
  window.dispatchEvent(new Event('sps_collaborators_updated'));
  // Fire-and-forget cloud heal so profile menus on other devices drop dead titles (002, etc.)
  syncCollaboratorsToCloud(pruned);
}

/**
 * Cloud is source of truth — always apply sanitized cloud collaborators to localStorage.
 * Local UI may push edits up; on pull/reload Vercel/cloud wins.
 */
function applyCloudCollaborators(users) {
  if (typeof window === 'undefined') return null;
  if (!Array.isArray(users) || users.length === 0) return null;
  let library = [];
  try {
    library = JSON.parse(localStorage.getItem('sps_project_library') || '[]');
  } catch (e) {}
  const live = Array.isArray(library) ? library : [];
  // Prune only when we have a real hydrated library; otherwise keep cloud allotments intact
  const realTitles = live.filter((p) => {
    const t = String(p?.title || '').trim().toUpperCase();
    return t && t !== 'STAGE PRODUCTION STUDIO';
  });
  const secured = secureCollaboratorList(
    realTitles.length > 0 ? pruneAllottedProjectsToLibrary(users, live) : users
  );
  const newStr = JSON.stringify(secured);
  const oldStr = localStorage.getItem('sps_authorized_phone_users');
  if (newStr !== oldStr) {
    localStorage.setItem('sps_authorized_phone_users', newStr);
    try {
      localStorage.setItem('sps_collaborators_cloud_synced_at', new Date().toISOString());
    } catch (e) {}
    window.dispatchEvent(new Event('sps_collaborators_updated'));
  }
  return secured;
}

function syncApiUrl() {
  return getNativeSyncUrl();
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
    users: secured,
    lastSynced: new Date().toISOString(),
    totalCollaborators: secured.length
  };

  const newStr = JSON.stringify(secured);
  const oldStr = localStorage.getItem('sps_authorized_phone_users');
  if (newStr !== oldStr) {
    localStorage.setItem('sps_authorized_phone_users', newStr);
    window.dispatchEvent(new Event('sps_collaborators_updated'));
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

// 2. Fetch All Collaborators from Cloud Database (cloud wins → local)
export async function fetchCollaboratorsFromCloud() {
  const base = syncApiUrl();
  try {
    const res = await fetchJsonTimed(`${base}?type=collaborators`);
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
  const list = Array.isArray(projectLibrary) ? projectLibrary : [];
  // Never push empty library to cloud — empty overwrite guard on server is backup only
  if (list.length === 0) return;

  const deletedTitles = Array.from(readDeletedTitleKeys());
  const payload = {
    projects: list,
    deletedTitles,
    updatedAt: new Date().toISOString(),
    totalProjects: list.length
  };

  const newStr = JSON.stringify(list);
  const oldStr = localStorage.getItem('sps_project_library');
  if (newStr !== oldStr) {
    safeLocalStorageSetItem('sps_project_library', newStr);
    window.dispatchEvent(new Event('sps_projects_updated'));
  }

  pruneAndPersistCollaboratorAllotments(list);

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

/** True when a title was deleted/archived and must not re-enter the live library. */
export function isProjectTitleDeleted(title) {
  const key = String(title || '').trim().toUpperCase();
  if (!key || key === 'STAGE PRODUCTION STUDIO') return false;
  return readDeletedTitleKeys().has(key);
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
  localStorage.setItem(PROJECT_ARCHIVE_KEY, JSON.stringify(next));
  try {
    window.dispatchEvent(new Event('sps_project_archive_updated'));
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
    library = JSON.parse(localStorage.getItem('sps_project_library') || '[]');
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

  safeLocalStorageSetItem('sps_project_library', JSON.stringify(library));
  writeProjectArchive(archive.filter((_, i) => i !== idx));
  window.dispatchEvent(new Event('sps_projects_updated'));
  return restored;
}

/** Permanently remove from Archive (cannot restore). */
export function purgeArchivedProject(archiveId) {
  if (typeof window === 'undefined' || !archiveId) return;
  writeProjectArchive(readProjectArchive().filter((p) => p.archiveId !== archiveId && p.id !== archiveId));
}

/** Record deleted titles so cloud hydrates cannot resurrect them. */
export function markProjectTitlesDeleted(titles) {
  if (typeof window === 'undefined') return;
  const list = Array.isArray(titles) ? titles : [titles];
  const set = readDeletedTitleKeys();
  list.forEach((t) => {
    const key = String(t || '').trim().toUpperCase();
    if (key && key === 'STAGE PRODUCTION STUDIO') return;
    if (key) set.add(key);
  });
  localStorage.setItem(DELETED_TITLES_KEY, JSON.stringify(Array.from(set)));
}

/**
 * Apply cloud tombstones carefully: never mark a title deleted if it is still
 * present in the live projects payload (restore / library push wins).
 */
export function applyCloudDeletedTitles(deletedTitles, liveProjects = []) {
  if (typeof window === 'undefined') return;
  const liveKeys = new Set(
    (Array.isArray(liveProjects) ? liveProjects : [])
      .map((p) => String(p?.title || '').trim().toUpperCase())
      .filter(Boolean)
  );
  // Active project must never stay tombstoned
  try {
    const active =
      localStorage.getItem('sps_active_project_title') ||
      localStorage.getItem('sps_project_title') ||
      '';
    const activeKey = String(active).trim().toUpperCase();
    if (activeKey) liveKeys.add(activeKey);
  } catch (e) {}

  const incoming = (Array.isArray(deletedTitles) ? deletedTitles : [])
    .map((t) => String(t || '').trim().toUpperCase())
    .filter((t) => t && t !== 'STAGE PRODUCTION STUDIO' && !liveKeys.has(t));

  if (incoming.length) markProjectTitlesDeleted(incoming);

  // Clear tombstones for anything that is live again
  if (liveKeys.size) clearDeletedTitleKeys(Array.from(liveKeys));
}

/**
 * If the active project was wrongly swept into Archive, restore it to Library.
 * Returns restored project or null.
 */
export function healActiveProjectFromArchive() {
  if (typeof window === 'undefined') return null;
  let activeTitle = '';
  try {
    activeTitle =
      localStorage.getItem('sps_active_project_title') ||
      localStorage.getItem('sps_project_title') ||
      '';
  } catch (e) {}
  const key = String(activeTitle || '').trim().toUpperCase();
  if (!key || key === 'STAGE PRODUCTION STUDIO') return null;

  clearDeletedTitleKeys([activeTitle]);

  let library = [];
  try {
    library = JSON.parse(localStorage.getItem('sps_project_library') || '[]');
  } catch (e) {}
  if (!Array.isArray(library)) library = [];

  const inLibrary = library.some((p) => String(p?.title || '').trim().toUpperCase() === key);
  if (inLibrary) {
    // Ensure library write reflects cleared tombstone
    safeLocalStorageSetItem('sps_project_library', JSON.stringify(filterOutDeletedProjects(library)));
    return library.find((p) => String(p?.title || '').trim().toUpperCase() === key) || null;
  }

  const archive = readProjectArchive();
  const idx = archive.findIndex((p) => String(p?.title || '').trim().toUpperCase() === key);
  if (idx === -1) return null;

  const restored = restoreProjectFromArchive(archive[idx].archiveId || archive[idx].id);
  return restored;
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

export function filterOutDeletedProjects(projects) {
  const deleted = readDeletedTitleKeys();
  if (!deleted.size) return Array.isArray(projects) ? projects : [];
  return (Array.isArray(projects) ? projects : []).filter((p) => {
    const key = projectKey(p);
    return key && key !== 'STAGE PRODUCTION STUDIO' && !deleted.has(key);
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
 * Cloud is source of truth for membership. Shared titles merge fields (cloud preferred).
 * Local-only drafts are NOT kept after a successful cloud fetch — otherwise deleted
 * titles (e.g. 002) linger on Owner devices and reappear in allotment UI.
 */
function mergeProjectArrays(cloudProjs, localProjs, { cloudAuthoritative = true } = {}) {
  const deleted = readDeletedTitleKeys();
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

  // Only keep unsynced local drafts when cloud hydrate failed / was skipped
  if (!cloudAuthoritative) {
    localByKey.forEach((p, key) => {
      if (!map.has(key)) map.set(key, p);
    });
  }

  return Array.from(map.values());
}

let healCloudLibraryTimer = null;

async function processAndStoreProjects(rawCloudProjects, { cloudAuthoritative = true } = {}) {
  const localStr = localStorage.getItem('sps_project_library');
  let localProjs = [];
  if (localStr) {
    try { localProjs = JSON.parse(localStr); } catch (e) {}
  }
  if (!Array.isArray(localProjs)) localProjs = [];

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

  const deletedKeys = readDeletedTitleKeys();
  const cloudHadGhosts = (rawCloudProjects || []).some((p) => deletedKeys.has(projectKey(p)));
  // When durableOk is false, keep local-only drafts (do not treat cloud as full membership SoT)
  const merged = mergeProjectArrays(rawCloudProjects, localProjs, {
    cloudAuthoritative: Boolean(cloudAuthoritative)
  });
  const { enrichLibraryWithDiskVault, writeLocalProjectLibrary } = await import('../utils/projectWorkspace');
  let finalList = filterOutDeletedProjects(
    await enrichLibraryWithDiskVault(filterOutDeletedProjects(merged))
  );

  const newStr = JSON.stringify(finalList);
  const wrote = writeLocalProjectLibrary(finalList);
  if (wrote || newStr !== localStr) {
    try {
      localStorage.setItem('sps_projects_cloud_synced_at', new Date().toISOString());
    } catch (e) {}
    window.dispatchEvent(new Event('sps_projects_updated'));
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
  // 1. Try Native Vercel Serverless Sync Engine (authoritative when reachable)
  try {
    const res = await fetchJsonTimed(`${syncApiUrl()}?type=projects`);
    if (res.status === 503) {
      // Durable hydrate failed — do NOT clear local library
      return processAndStoreProjects([], { cloudAuthoritative: false });
    }
    if (res.ok) {
      const data = await res.json();
      if (data?.durableFailed || data?.projects === null) {
        return processAndStoreProjects([], { cloudAuthoritative: false });
      }
      if (Array.isArray(data.deletedTitles) && data.deletedTitles.length) {
        applyCloudDeletedTitles(data.deletedTitles, Array.isArray(data.projects) ? data.projects : []);
      }
      if (Array.isArray(data.projects)) {
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
      if (Array.isArray(data.deletedTitles)) {
        applyCloudDeletedTitles(data.deletedTitles, Array.isArray(data.projects) ? data.projects : []);
      }
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
  const saved = localStorage.getItem('sps_project_library');
  try {
    return saved ? filterOutDeletedProjects(JSON.parse(saved)) : [];
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
