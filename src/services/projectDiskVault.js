// =========================================================
// STAGE PRODUCTION STUDIO - PERSISTENT LOCAL DISK VAULT
// =========================================================

import { safeLocalStorageSetItem } from '../utils/safeStorage';
import { roomIdForProject, slimProjectForLocalMirror, slugProjectTitle } from '../utils/projectWorkspace';
import { saveDirectorPsychology } from '../utils/directorPsychologyStorage';

const DB_NAME = 'sps_local_disk_vault_db';
const DB_VERSION = 1;
const STORE_NAME = 'sps_projects_store';

let dbInstance = null;

/**
 * When Electron loads Vite at localhost, use the same HTTP vault as the browser
 * so both shells share identical middleware + on-disk SoT. Packaged (file://)
 * falls back to IPC.
 */
function preferHttpDiskVault() {
  try {
    if (typeof window === 'undefined') return false;
    if (window.location.protocol === 'file:') return false;
    const host = String(window.location.hostname || '').toLowerCase();
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '[::1]' ||
      host === '0.0.0.0'
    );
  } catch {
    return false;
  }
}

function electronVaultApi() {
  if (preferHttpDiskVault()) return null;
  try {
    return typeof window !== 'undefined' ? window.electronAPI : null;
  } catch {
    return null;
  }
}

/** Packaged Electron (file://) — /api/project-poster URLs do not resolve. */
export function isPackagedElectronApp() {
  try {
    return Boolean(window.electronAPI?.isElectron && window.location.protocol === 'file:');
  } catch {
    return false;
  }
}

/** Resolve broken /api poster paths to idb: refs via IPC readPosterDataUrl. */
export async function ensureElectronPosterRefs(library) {
  if (!isPackagedElectronApp()) return library;
  const api = electronVaultApi();
  if (!api?.readPosterDataUrl) return library;
  const { putImageDataUrl } = await import('../utils/imageBlobStore');
  const list = Array.isArray(library) ? library : [];
  const out = [];
  for (const p of list) {
    if (!p?.title) {
      out.push(p);
      continue;
    }
    const url = typeof p.posterUrl === 'string' ? p.posterUrl : '';
    const needsIpc =
      !url ||
      url.startsWith('/api/') ||
      (url.startsWith('/') && !url.startsWith('file:'));
    if (!needsIpc) {
      out.push(p);
      continue;
    }
    try {
      const res = await api.readPosterDataUrl(p.title);
      if (res?.ok && res.dataUrl) {
        const ref = await putImageDataUrl(`poster_${slugProjectTitle(p.title)}`, res.dataUrl);
        out.push({ ...p, posterUrl: ref });
      } else {
        out.push(p);
      }
    } catch {
      out.push(p);
    }
  }
  return out;
}

/** Stable on-disk poster filename for a project title. */
export function posterFileSafeName(title) {
  return `${String(title || 'UNTITLED').trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'UNTITLED'}.png`;
}

/** Durable URL that Vite (and Electron-dev on localhost) can serve. */
export function posterApiUrl(title, version) {
  const name = String(title || '').trim();
  const q = new URLSearchParams({ name });
  if (version) q.set('v', String(version));
  return `/api/project-poster?${q.toString()}`;
}

/**
 * Save poster as a PNG beside projects/ (not inside the giant project JSON).
 * Returns a durable /api/project-poster URL for the library + <img>.
 */
export async function saveProjectPoster({ title, id, dataUrl } = {}) {
  const cleanTitle = String(title || '').trim();
  if (!cleanTitle || !dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
    return null;
  }
  try {
    const api = electronVaultApi();
    if (api?.savePosterToDisk) {
      const res = await api.savePosterToDisk({ title: cleanTitle, id, dataUrl });
      if (res?.ok) {
        return res.posterUrl || posterApiUrl(cleanTitle, Date.now());
      }
    }
    const res = await fetch('/api/save-project-poster', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: cleanTitle, id, imageDataUrl: dataUrl })
    }).catch(() => null);
    if (res && res.ok) {
      const data = await res.json().catch(() => ({}));
      return data.posterUrl || posterApiUrl(cleanTitle, Date.now());
    }
  } catch (e) {
    console.warn('saveProjectPoster failed', e);
  }
  return null;
}

/** List poster files on disk → map of TITLE_KEY → api url */
export async function listProjectPostersFromDisk() {
  try {
    const api = electronVaultApi();
    if (api?.listPostersFromDisk) {
      const res = await api.listPostersFromDisk();
      if (res?.ok && Array.isArray(res.posters)) {
        return res.posters;
      }
    }
    const res = await fetch('/api/list-project-posters').catch(() => null);
    if (res && res.ok) {
      const data = await res.json();
      return Array.isArray(data.posters) ? data.posters : [];
    }
  } catch (e) {
    console.warn('listProjectPostersFromDisk failed', e);
  }
  return [];
}

// Initialize IndexedDB persistent vault
export const initDiskVaultDB = () => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }

    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.warn('IndexedDB initialization warning:', event.target.error);
      resolve(null);
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

// Save a project to the IndexedDB vault
export const saveProjectToVault = async (project) => {
  if (!project || typeof project !== 'object') return false;
  const title = String(project.title || '').trim();
  if (!project.id && !title) return false;
  const ensured = {
    ...project,
    id: project.id || `proj_${title.replace(/[^\w.-]+/g, '_').toLowerCase() || Date.now()}`
  };

  try {
    const db = await initDiskVaultDB();
    if (db) {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const vaultRecord = {
        ...ensured,
        updatedAt: new Date().toISOString(),
        vaultSavedAt: new Date().toLocaleString()
      };
      store.put(vaultRecord);
    }
  } catch (e) {
    console.warn('Error saving to IndexedDB Vault:', e);
  }

  // Backup slim mirror to localStorage (full project is on disk)
  try {
    const savedLib = localStorage.getItem('sps_project_library');
    let lib = savedLib ? JSON.parse(savedLib) : [];
    const slim = slimProjectForLocalMirror(ensured);
    const idx = lib.findIndex(p => p.id === ensured.id || String(p.title || '').toLowerCase() === String(ensured.title || '').toLowerCase());
    if (idx !== -1) {
      lib[idx] = { ...lib[idx], ...slim };
    } else {
      lib.push(slim);
    }
    safeLocalStorageSetItem('sps_project_library', JSON.stringify(lib.map(slimProjectForLocalMirror)));
  } catch (e) {}

  // Auto-Save directly to physical local disk folder (shared by browser Vite + Electron)
  try {
    const api = electronVaultApi();
    if (api?.saveProjectToDisk) {
      await api.saveProjectToDisk(ensured);
    } else {
      await fetch('/api/save-project-disk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ensured)
      }).catch(() => null);
    }
  } catch (e) {}

  return true;
};

async function fetchDiskProjects() {
  const api = electronVaultApi();
  if (api?.listProjectsFromDisk) {
    const res = await api.listProjectsFromDisk();
    if (res?.ok && Array.isArray(res.projects)) return res.projects;
  }
  try {
    const res = await fetch('/api/list-projects-disk').catch(() => null);
    if (res && res.ok) {
      const data = await res.json();
      return data.projects || [];
    }
  } catch (e) {
    console.warn('Error fetching physical disk projects:', e);
  }
  return [];
}

/** Active workspace pointer on disk — keeps Electron + browser on the same open film. */
export async function loadActiveWorkspaceFromDisk() {
  try {
    const api = electronVaultApi();
    if (api?.getActiveWorkspaceFromDisk) {
      const res = await api.getActiveWorkspaceFromDisk();
      return res?.workspace || null;
    }
    const res = await fetch('/api/active-workspace-disk').catch(() => null);
    if (res && res.ok) {
      const data = await res.json();
      return data.workspace || null;
    }
  } catch (e) {
    console.warn('Error loading active workspace from disk:', e);
  }
  return null;
}

export async function saveActiveWorkspaceToDisk({ title, roomId } = {}) {
  const updatedAt = new Date().toISOString();
  const payload = {
    title: String(title || '').trim(),
    roomId: String(roomId || '').trim(),
    updatedAt
  };
  if (!payload.title) return false;
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sps_active_workspace_at', updatedAt);
      localStorage.setItem('sps_current_project_title', payload.title);
    }
  } catch {
    /* ignore */
  }
  try {
    const api = electronVaultApi();
    if (api?.setActiveWorkspaceOnDisk) {
      const res = await api.setActiveWorkspaceOnDisk(payload);
      return Boolean(res?.ok);
    }
    const res = await fetch('/api/active-workspace-disk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(() => null);
    return Boolean(res && res.ok);
  } catch (e) {
    console.warn('Error saving active workspace to disk:', e);
    return false;
  }
}

// Load all projects from IndexedDB vault and physical disk folder
export const loadProjectsFromVault = async () => {
  let projectsMap = new Map();

  // 1. Read IndexedDB vault
  try {
    const db = await initDiskVaultDB();
    if (db) {
      const indexedProjects = await new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
      });

      indexedProjects.forEach(p => {
        if (p && (p.id || p.title)) {
          const key = String(p.title || p.id).trim().toLowerCase() || p.id;
          const prev = projectsMap.get(key);
          if (!prev || (Array.isArray(p.shots) && p.shots.length >= (prev.shots?.length || 0)) ) {
            projectsMap.set(key, prev ? { ...prev, ...p } : p);
          }
        }
      });
    }
  } catch (e) {
    console.warn('Error reading IndexedDB Vault:', e);
  }

  // 2. Physical disk — shared SoT for Electron + browser on this machine
  try {
    const diskProjects = await fetchDiskProjects();
    diskProjects.forEach(dp => {
      if (dp) {
        const projObj = dp.project || dp;
        if (projObj && (projObj.id || projObj.title)) {
          const key = String(projObj.title || projObj.id).trim().toLowerCase() || projObj.id;
          const prev = projectsMap.get(key);
          // Disk wins on equal/greater content so Chromium partitions stay aligned
          const diskShots = Array.isArray(projObj.shots) ? projObj.shots.length : 0;
          const prevShots = Array.isArray(prev?.shots) ? prev.shots.length : 0;
          if (!prev || diskShots >= prevShots) {
            projectsMap.set(key, prev ? { ...prev, ...projObj, shots: projObj.shots?.length ? projObj.shots : prev.shots } : projObj);
          }
        }
      }
    });
  } catch (e) {
    console.warn('Error fetching physical disk projects:', e);
  }

  return Array.from(projectsMap.values());
};

export async function loadUiPrefsFromDisk() {
  try {
    const api = electronVaultApi();
    if (api?.getUiPrefsFromDisk) {
      const res = await api.getUiPrefsFromDisk();
      return res?.prefs || null;
    }
    const res = await fetch('/api/ui-prefs-disk').catch(() => null);
    if (res && res.ok) {
      const data = await res.json();
      return data.prefs || null;
    }
  } catch (e) {
    console.warn('Error loading UI prefs from disk:', e);
  }
  return null;
}

export async function saveUiPrefsToDisk(prefs = {}) {
  try {
    const api = electronVaultApi();
    if (api?.setUiPrefsOnDisk) {
      const res = await api.setUiPrefsOnDisk(prefs);
      return Boolean(res?.ok);
    }
    const res = await fetch('/api/ui-prefs-disk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prefs)
    }).catch(() => null);
    return Boolean(res && res.ok);
  } catch (e) {
    console.warn('Error saving UI prefs to disk:', e);
    return false;
  }
}

/** Load one full project from shared disk by title (browser API or Electron IPC). */
export async function loadProjectFromDiskByTitle(title) {
  const want = String(title || '').trim().toLowerCase();
  if (!want) return null;
  const all = await fetchDiskProjects();
  for (const dp of all) {
    const proj = dp?.project || dp;
    if (proj && String(proj.title || '').trim().toLowerCase() === want) return proj;
  }
  return null;
}

// Get Allotted Storage Folder Path
export const getAllottedFolderPath = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('sps_allotted_storage_folder') || './projects/';
  }
  return './projects/';
};

// Set Allotted Storage Folder Path
export const setAllottedFolderPath = (pathStr) => {
  if (typeof window !== 'undefined' && pathStr) {
    localStorage.setItem('sps_allotted_storage_folder', pathStr);
  }
};

export const buildProjectPackage = (project) => {
  const sanitizeName = (project?.title || 'STAGE_PRODUCTION_STUDIO')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .toLowerCase();
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `${sanitizeName}_backup_${dateStr}.sps.json`;
  const packageData = {
    sps_app_version: '2.5',
    storage: 'local+drive',
    exported_at: new Date().toISOString(),
    allotted_folder: getAllottedFolderPath(),
    project: {
      id: project?.id || `proj_${Date.now()}`,
      title: project?.title || 'STAGE PRODUCTION STUDIO',
      description: project?.description || 'Primary stage production master project',
      targetModel: project?.targetModel || 'SPS Direct Cinema',
      aspectRatio: project?.aspectRatio || '2.39:1 Anamorphic',
      roomId: roomIdForProject(project?.title, project?.roomId),
      lastModified: new Date().toLocaleString(),
      shots: project?.shots || [],
      versions: project?.versions || [],
      directorPsychology: project?.directorPsychology || null
    }
  };
  return { filename, packageData, driveName: `${sanitizeName}_stageworks.json` };
};

export const exportProjectPackageToFile = (project) => {
  if (!project) return;
  const { filename, packageData } = buildProjectPackage(project);
  const blob = new Blob([JSON.stringify(packageData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Import and restore project backup package file (.sps / .json)
export const importProjectPackageFromFile = (file) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No file selected'));
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target.result;
        const parsed = JSON.parse(content);

        const projectData = parsed.project || parsed;

        if (!projectData || !Array.isArray(projectData.shots)) {
          reject(new Error('Invalid SPS project file format. Missing shots data.'));
          return;
        }

        if (projectData.directorPsychology && projectData.title) {
          try {
            saveDirectorPsychology(projectData.title, projectData.directorPsychology, { force: true });
          } catch (e) {}
        }

        // Save to IndexedDB & localStorage vault
        await saveProjectToVault(projectData);

        resolve(projectData);
      } catch (err) {
        reject(new Error('Failed to parse project backup file: ' + err.message));
      }
    };

    reader.onerror = () => reject(new Error('Error reading backup file'));
    reader.readAsText(file);
  });
};
