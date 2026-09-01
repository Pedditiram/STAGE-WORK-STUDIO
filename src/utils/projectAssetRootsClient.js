/**
 * Browser / Electron client for project asset folder ensure + Comfy path resolve.
 */

import {
  assetRootsList,
  buildComfyAssetResolveRequests,
  listExpectedFilmAssetFiles,
  normalizeAssetRoots,
  readAssetRootsFromLibrary,
  resolveWorkflowsDir,
  stampAssetRootsIntoLibrary,
  versionedProjectFilename
} from './projectAssetRoots';
import { loadProjectFromDiskByTitle, saveProjectToVault } from '../services/projectDiskVault';

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok && data?.ok !== false, status: res.status, data };
}

async function persistDiscoveredRoots(projectTitle, roots) {
  const next = normalizeAssetRoots(roots);
  stampAssetRootsIntoLibrary(projectTitle, next);
  try {
    const disk = await loadProjectFromDiskByTitle(projectTitle);
    if (disk && typeof disk === 'object') {
      await saveProjectToVault({ ...disk, assetRoots: next });
    }
  } catch {
    /* library stamp is enough for this session */
  }
  return next;
}

/**
 * Create missing asset folders on disk (Vite API or Electron IPC).
 */
export async function ensureProjectAssetFolders(rootsInput) {
  const roots = normalizeAssetRoots(rootsInput);
  const dirs = assetRootsList(roots);
  if (!dirs.length) {
    return { ok: false, error: 'No asset folder paths set.', created: [], dirs: [] };
  }

  try {
    if (typeof window !== 'undefined' && window.electronAPI?.ensureDirs) {
      const res = await window.electronAPI.ensureDirs(dirs);
      return {
        ok: Boolean(res?.ok),
        created: res?.created || [],
        dirs: res?.dirs || dirs,
        error: res?.error || ''
      };
    }
  } catch (err) {
    return { ok: false, error: err?.message || String(err), created: [], dirs: [] };
  }

  try {
    const { ok, data } = await postJson('/api/ensure-asset-dirs', { dirs });
    return {
      ok,
      created: data?.created || [],
      dirs: data?.dirs || dirs,
      error: data?.error || (ok ? '' : 'ensure-asset-dirs failed')
    };
  } catch (err) {
    return { ok: false, error: err?.message || String(err), created: [], dirs: [] };
  }
}

/**
 * Resolve Image_N → absolute file paths under assetRoots.
 */
export async function resolveComfyAssetSlots(shot, assetRoots) {
  const requests = buildComfyAssetResolveRequests(shot, assetRoots);
  if (!requests.length) return { ok: true, slots: [], assigned: 0 };

  try {
    if (typeof window !== 'undefined' && window.electronAPI?.resolveComfyAssets) {
      const res = await window.electronAPI.resolveComfyAssets(requests);
      const slots = Array.isArray(res?.slots) ? res.slots : [];
      return {
        ok: Boolean(res?.ok !== false),
        slots,
        assigned: slots.filter((s) => s.path).length,
        error: res?.error || ''
      };
    }
  } catch (err) {
    return { ok: false, slots: [], assigned: 0, error: err?.message || String(err) };
  }

  try {
    const { ok, data } = await postJson('/api/resolve-comfy-assets', { requests });
    const slots = Array.isArray(data?.slots) ? data.slots : [];
    return {
      ok,
      slots,
      assigned: slots.filter((s) => s.path).length,
      error: data?.error || (ok ? '' : 'resolve-comfy-assets failed')
    };
  } catch (err) {
    return { ok: false, slots: [], assigned: 0, error: err?.message || String(err) };
  }
}

/**
 * Create placeholder PNGs named from REFERENCES (e.g. infant karna.png), not Image_N.
 */
export async function ensureFilmPlaceholderAssets(rootsInput, shots = []) {
  const roots = normalizeAssetRoots(rootsInput);
  const expected = listExpectedFilmAssetFiles(shots);
  if (!expected.length) return { ok: true, written: [], skipped: [], count: 0 };

  const entries = expected
    .map((f) => {
      const dir = String(roots[f.folderKey] || '').trim();
      if (!dir) return null;
      return { dir, filename: f.filename, label: f.label };
    })
    .filter(Boolean);

  if (!entries.length) return { ok: false, error: 'No asset folder paths set.', written: [] };

  try {
    if (typeof window !== 'undefined' && window.electronAPI?.ensurePlaceholderPngs) {
      return await window.electronAPI.ensurePlaceholderPngs({ entries });
    }
  } catch (err) {
    return { ok: false, error: err?.message || String(err), written: [] };
  }

  try {
    const { ok, data } = await postJson('/api/ensure-placeholder-pngs', { entries });
    return { ok, ...(data || {}) };
  } catch (err) {
    return { ok: false, error: err?.message || String(err), written: [] };
  }
}

/**
 * Persist assetRoots onto project library + disk vault, creating folders.
 * When projectSave + versioning are set, also writes a versioned JSON snapshot
 * using the current projectVersion, then bumps for the next save.
 */
export async function saveProjectAssetRoots(projectTitle, rootsInput, { shots = null } = {}) {
  let roots = normalizeAssetRoots(rootsInput);
  const ensured = await ensureProjectAssetFolders(roots);
  let placeholders = null;
  if (Array.isArray(shots) && shots.length) {
    placeholders = await ensureFilmPlaceholderAssets(roots, shots);
  }
  stampAssetRootsIntoLibrary(projectTitle, roots);

  let versioned = null;
  try {
    const disk = await loadProjectFromDiskByTitle(projectTitle);
    const base = disk && typeof disk === 'object' ? disk : { title: projectTitle };
    const stamped = {
      ...base,
      title: projectTitle || base.title,
      assetRoots: roots,
      projectVersion: roots.projectVersion
    };
    await saveProjectToVault(stamped);
    if (roots.projectSave) {
      versioned = await saveVersionedProjectSnapshot(stamped, roots);
      if (roots.versioning && versioned?.ok !== false) {
        roots = { ...roots, projectVersion: roots.projectVersion + 1 };
        stampAssetRootsIntoLibrary(projectTitle, roots);
        await saveProjectToVault({ ...stamped, assetRoots: roots, projectVersion: roots.projectVersion });
      }
    }
  } catch {
    /* library stamp still applied */
  }

  return {
    ok: ensured.ok || assetRootsList(roots).length === 0,
    roots,
    ensured,
    placeholders,
    versioned
  };
}

/**
 * Write `{projectSave}/{TITLE}_v00N.json` (+ latest copy without version when versioning on).
 */
export async function saveVersionedProjectSnapshot(project, rootsInput) {
  const roots = normalizeAssetRoots(rootsInput || project?.assetRoots);
  const dir = String(roots.projectSave || '').trim();
  if (!dir) return { ok: false, error: 'No project save location' };

  const version = roots.versioning ? roots.projectVersion : 1;
  const filename = roots.versioning
    ? versionedProjectFilename(project?.title, version)
    : `${String(project?.title || 'PROJECT').replace(/[^a-zA-Z0-9_-]+/g, '_') || 'PROJECT'}.json`;
  const payload = {
    project: {
      ...project,
      assetRoots: roots,
      projectVersion: version,
      versionSavedAt: new Date().toISOString()
    },
    dir,
    filename
  };

  try {
    if (typeof window !== 'undefined' && window.electronAPI?.saveProjectVersion) {
      return await window.electronAPI.saveProjectVersion(payload);
    }
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }

  try {
    const { ok, data } = await postJson('/api/save-project-version', payload);
    return { ok, ...(data || {}) };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Discover …/SWS PROJECTS/{TITLE}/… on Desktop (or create layout).
 */
export async function discoverFilmAssetRoots(projectTitle, { ensure = true } = {}) {
  const title = String(projectTitle || '').trim();
  if (!title) return { ok: false, error: 'No project title', roots: emptyFromNormalize() };

  try {
    if (typeof window !== 'undefined' && window.electronAPI?.discoverFilmAssetRoots) {
      const res = await window.electronAPI.discoverFilmAssetRoots({ projectTitle: title, ensure });
      if (res?.ok && res.roots) {
        const roots = await persistDiscoveredRoots(title, res.roots);
        return { ok: true, roots, ...(res || {}) };
      }
      return { ok: false, error: res?.error || 'discover failed', roots: normalizeAssetRoots({}) };
    }
  } catch (err) {
    return { ok: false, error: err?.message || String(err), roots: normalizeAssetRoots({}) };
  }

  try {
    const { ok, data } = await postJson('/api/discover-film-asset-roots', {
      projectTitle: title,
      ensure
    });
    if (ok && data?.roots) {
      const roots = await persistDiscoveredRoots(title, data.roots);
      return { ok: true, roots, ...(data || {}) };
    }
    return { ok: false, error: data?.error || 'discover failed', roots: normalizeAssetRoots({}) };
  } catch (err) {
    return { ok: false, error: err?.message || String(err), roots: normalizeAssetRoots({}) };
  }
}

function emptyFromNormalize() {
  return normalizeAssetRoots({});
}

/**
 * Write ComfyUI workflow JSON files into PROJECT/Workflows (or explicit workflows path).
 * Auto-discovers Desktop/SWS PROJECTS/{TITLE} when paths are unset.
 * Writes in batches so 80+ shots do not blow a single HTTP body.
 */
export async function saveComfyWorkflowFilesToProject(projectTitle, files = [], rootsInput = null) {
  let roots = rootsInput ? normalizeAssetRoots(rootsInput) : normalizeAssetRoots(readAssetRootsFromLibrary(projectTitle));
  if (!assetRootsList(roots).length && projectTitle) {
    try {
      const disk = await loadProjectFromDiskByTitle(projectTitle);
      roots = normalizeAssetRoots(disk?.assetRoots || roots);
    } catch {
      /* keep */
    }
  }
  let dir = resolveWorkflowsDir(roots);
  if (!dir && projectTitle) {
    const discovered = await discoverFilmAssetRoots(projectTitle, { ensure: true });
    if (discovered.ok) {
      roots = discovered.roots;
      dir = resolveWorkflowsDir(roots);
    }
  }
  if (!dir) {
    return { ok: false, error: 'Set Project save location or ComfyUI workflows folder first.', dir: '' };
  }

  const list = (files || [])
    .map((f) => ({
      name: String(f?.name || '').replace(/[/\\]/g, '_').trim(),
      content: typeof f?.content === 'string' ? f.content : JSON.stringify(f?.content ?? {}, null, 2)
    }))
    .filter((f) => f.name);
  if (!list.length) return { ok: false, error: 'No workflow files to write', dir };

  const written = [];
  const BATCH = 8;
  for (let i = 0; i < list.length; i += BATCH) {
    const chunk = list.slice(i, i + BATCH);
    let batchResult = null;
    try {
      if (typeof window !== 'undefined' && window.electronAPI?.saveTextFiles) {
        batchResult = await window.electronAPI.saveTextFiles({ dir, files: chunk });
      } else {
        const { ok, data } = await postJson('/api/save-text-files', { dir, files: chunk });
        batchResult = { ok, ...(data || {}) };
      }
    } catch (err) {
      return {
        ok: false,
        error: err?.message || String(err),
        dir,
        written,
        count: written.length
      };
    }
    if (!batchResult?.ok) {
      return {
        ok: false,
        error: batchResult?.error || 'save-text-files failed',
        dir,
        written,
        count: written.length
      };
    }
    written.push(...(batchResult.written || chunk.map((f) => ({ name: f.name }))));
  }

  stampAssetRootsIntoLibrary(projectTitle, roots);
  return { ok: true, dir, written, count: written.length, roots };
}

export async function loadProjectAssetRoots(projectTitle) {
  const fromLib = normalizeAssetRoots(readAssetRootsFromLibrary(projectTitle));
  if (assetRootsList(fromLib).length) return fromLib;
  try {
    const disk = await loadProjectFromDiskByTitle(projectTitle);
    const fromDisk = normalizeAssetRoots(disk?.assetRoots);
    if (assetRootsList(fromDisk).length) return fromDisk;
  } catch {
    /* continue */
  }
  if (projectTitle) {
    const discovered = await discoverFilmAssetRoots(projectTitle, { ensure: false });
    if (discovered.ok && assetRootsList(discovered.roots).length) {
      return discovered.roots;
    }
  }
  return fromLib;
}

/** Open PROJECT/Posters (or vault posters) in Finder — double-tap poster in Project Console. */
export async function openProjectPosterFolder(projectTitle, assetRoots = null) {
  const title = String(projectTitle || '').trim();
  if (!title) return { ok: false, error: 'No project title' };

  try {
    if (typeof window !== 'undefined' && window.electronAPI?.openPosterFolder) {
      const res = await window.electronAPI.openPosterFolder({
        projectTitle: title,
        assetRoots: assetRoots || undefined
      });
      return res || { ok: false, error: 'open failed' };
    }
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }

  try {
    const { ok, data } = await postJson('/api/open-poster-folder', {
      projectTitle: title,
      assetRoots: assetRoots || undefined
    });
    if (ok && data?.ok) return { ok: true, path: data.path, kind: data.kind };
    return { ok: false, error: data?.error || 'Could not open poster folder' };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

const LAST_OPEN_FOLDER_KEY = 'sps_last_open_folder';

function folderNameToTitleGuess(name) {
  return String(name || '').replace(/_/g, ' ').trim();
}

function readLastOpenFolder() {
  try {
    return localStorage.getItem(LAST_OPEN_FOLDER_KEY) || '';
  } catch {
    return '';
  }
}

function rememberOpenFolder(pathStr) {
  try {
    if (pathStr) localStorage.setItem(LAST_OPEN_FOLDER_KEY, pathStr);
  } catch {
    /* ignore */
  }
}

async function readLatestProjectFromDirectoryHandle(rootHandle) {
  if (!rootHandle || rootHandle.kind !== 'directory') {
    return { ok: false, error: 'Invalid folder handle' };
  }

  const titleGuess = folderNameToTitleGuess(rootHandle.name);
  let versionsHandle = null;
  try {
    const projectHandle = await rootHandle.getDirectoryHandle('PROJECT');
    versionsHandle = await projectHandle.getDirectoryHandle('Versions');
  } catch {
    try {
      const legacy = await rootHandle.getDirectoryHandle('020-PROJECT');
      versionsHandle = await legacy.getDirectoryHandle('Versions');
    } catch {
      return { ok: false, error: 'No PROJECT/Versions in this folder' };
    }
  }

  let best = null;
  let bestScore = -1;
  for await (const [name, handle] of versionsHandle.entries()) {
    if (handle.kind !== 'file' || !/\.json$/i.test(name)) continue;
    let score = 0;
    const verMatch = name.match(/_v(\d+)\.json$/i);
    if (verMatch) score = parseInt(verMatch[1], 10) || 0;
    else if (!/_v\d+\.json$/i.test(name)) score = 10000;
    const file = await handle.getFile();
    score = score * 1e12 + file.lastModified;
    if (score > bestScore) {
      bestScore = score;
      best = { name, file };
    }
  }

  if (!best) {
    return { ok: false, error: 'No project JSON in PROJECT/Versions' };
  }

  const text = await best.file.text();
  const parsed = JSON.parse(text);
  const project = parsed?.project || parsed;
  if (!project || typeof project !== 'object') {
    return { ok: false, error: 'Invalid project JSON in folder' };
  }
  return {
    ok: true,
    project,
    sourceFile: best.name,
    titleGuess,
    folderName: rootHandle.name
  };
}

export async function pickDirectoryPath(options = {}) {
  const { promptTitle } = options;
  try {
    if (typeof window !== 'undefined' && window.electronAPI?.pickDirectory) {
      const res = await window.electronAPI.pickDirectory();
      if (res?.ok && res.path) {
        rememberOpenFolder(res.path);
        return { ok: true, path: res.path };
      }
      return { ok: false, canceled: Boolean(res?.canceled) };
    }
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }

  // Chromium / Edge localhost — native folder picker (no absolute path; pair with discoverFilmAssetRoots)
  if (typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function') {
    try {
      const handle = await window.showDirectoryPicker({
        mode: 'read',
        id: 'sps-open-film-folder',
        startIn: 'desktop'
      });
      return { ok: true, directoryHandle: handle, viaBrowserPicker: true };
    } catch (err) {
      if (err?.name === 'AbortError') return { ok: false, canceled: true };
    }
  }

  const last = readLastOpenFolder();
  const pasted = window.prompt(
    promptTitle ||
      'Paste the full path to your film folder (must contain ASSETS, PROJECT, RENDERS):\n\nExample: /Users/you/Desktop/SWS PROJECTS/MVK',
    last
  );
  if (!pasted || !String(pasted).trim()) return { ok: false, canceled: true };
  const folderPath = String(pasted).trim();
  rememberOpenFolder(folderPath);
  return { ok: true, path: folderPath };
}

/**
 * Pick a film folder (…/MVK or …/SWS PROJECTS) and import into studio library.
 */
export async function pickAndOpenProjectFolder() {
  try {
    if (typeof window !== 'undefined' && window.electronAPI?.openProjectFolder) {
      return await window.electronAPI.openProjectFolder({});
    }
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }

  const picked = await pickDirectoryPath();
  if (picked.canceled) return { ok: false, canceled: true };
  if (!picked.ok) return picked;

  // Browser folder picker — read JSON client-side, wire roots via server discover
  if (picked.viaBrowserPicker && picked.directoryHandle) {
    try {
      const read = await readLatestProjectFromDirectoryHandle(picked.directoryHandle);
      if (!read.ok) return read;
      const title = String(read.project?.title || read.titleGuess || '').trim();
      if (!title) return { ok: false, error: 'Could not determine project title' };
      const discovered = await discoverFilmAssetRoots(title, { ensure: false });
      const roots = discovered.ok ? discovered.roots : read.project?.assetRoots;
      const project = {
        ...read.project,
        title,
        assetRoots: roots || read.project?.assetRoots,
        openedFromFolder: discovered.filmRoot || read.folderName,
        openedFromFile: read.sourceFile,
        lastModifiedIso: new Date().toISOString()
      };
      await saveProjectToVault(project);
      return {
        ok: true,
        project,
        filmRoot: discovered.filmRoot,
        sourceFile: read.sourceFile,
        shotCount: project.shots?.length || 0
      };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  }

  if (!picked.path) return { ok: false, error: 'No folder path' };

  try {
    const { ok, data } = await postJson('/api/open-project-folder', { folderPath: picked.path });
    if (ok && data?.project) return { ok: true, ...data };
    return { ok: false, error: data?.error || data?.hint || 'open-project-folder failed', ...data };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}
