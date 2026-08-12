// =========================================================
// STAGE PRODUCTION STUDIO - PERSISTENT LOCAL DISK VAULT
// =========================================================

import { safeLocalStorageSetItem } from '../utils/safeStorage';

const DB_NAME = 'sps_local_disk_vault_db';
const DB_VERSION = 1;
const STORE_NAME = 'sps_projects_store';

let dbInstance = null;

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
  if (!project || !project.id) return false;

  try {
    const db = await initDiskVaultDB();
    if (db) {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const vaultRecord = {
        ...project,
        updatedAt: new Date().toISOString(),
        vaultSavedAt: new Date().toLocaleString()
      };
      store.put(vaultRecord);
    }
  } catch (e) {
    console.warn('Error saving to IndexedDB Vault:', e);
  }

  // Backup to localStorage as secondary safety
  try {
    const savedLib = localStorage.getItem('sps_project_library');
    let lib = savedLib ? JSON.parse(savedLib) : [];
    const idx = lib.findIndex(p => p.id === project.id);
    if (idx !== -1) {
      lib[idx] = { ...lib[idx], ...project };
    } else {
      lib.push(project);
    }
    safeLocalStorageSetItem('sps_project_library', JSON.stringify(lib));
  } catch (e) {}

  // Auto-Save directly to physical local disk folder (/Users/pedditiram/Documents/PROMPT ENGINEERING/projects/)
  try {
    fetch('/api/save-project-disk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project)
    }).catch(() => null);
  } catch (e) {}

  return true;
};

// Load all projects from IndexedDB vault and physical disk folder (/Users/pedditiram/Documents/PROMPT ENGINEERING/projects/)
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
          const key = p.id || p.title;
          projectsMap.set(key, p);
        }
      });
    }
  } catch (e) {
    console.warn('Error reading IndexedDB Vault:', e);
  }

  // 2. Read Physical Disk Server Endpoint (/api/list-projects-disk)
  try {
    const res = await fetch('/api/list-projects-disk').catch(() => null);
    if (res && res.ok) {
      const data = await res.json();
      const diskProjects = data.projects || [];
      diskProjects.forEach(dp => {
        if (dp) {
          const projObj = dp.project || dp;
          if (projObj && (projObj.id || projObj.title)) {
            const key = projObj.id || projObj.title;
            // Physical disk project takes priority
            projectsMap.set(key, projObj);
          }
        }
      });
    }
  } catch (e) {
    console.warn('Error fetching physical disk projects:', e);
  }

  return Array.from(projectsMap.values());
};

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

// Export complete project backup package file (.sps / .json) to user's local disk
export const exportProjectPackageToFile = (project) => {
  if (!project) return;

  const sanitizeName = (project.title || 'STAGE_PRODUCTION_STUDIO')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .toLowerCase();
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `${sanitizeName}_backup_${dateStr}.sps.json`;

  const packageData = {
    sps_app_version: '2.5',
    exported_at: new Date().toISOString(),
    allotted_folder: getAllottedFolderPath(),
    project: {
      id: project.id || `proj_${Date.now()}`,
      title: project.title || 'STAGE PRODUCTION STUDIO',
      description: project.description || 'Primary stage production master project',
      targetModel: project.targetModel || 'SPS Direct Cinema',
      aspectRatio: project.aspectRatio || '2.39:1 Anamorphic',
      roomId: project.roomId || 'SPS-CLOUD-8821',
      lastModified: new Date().toLocaleString(),
      shots: project.shots || [],
      versions: project.versions || [],
      directorPsychology: project.directorPsychology || null
    }
  };

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
            localStorage.setItem('sps_director_psychology_' + projectData.title, JSON.stringify(projectData.directorPsychology));
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
