/**
 * Move film JSON + poster into projects/local, projects/cloud, archived, or purged.
 * Purge moves the film JSON, poster, and ASSETS/RENDERS/PROJECT folders into
 * {studio}/PROJECTS PURGED/{TITLE}/ — it must not come back as a live library card.
 * CommonJS so Vite middleware and Electron can require() it.
 */
const fs = require('fs');
const path = require('path');

const LIVE = 'live';
const LOCAL = 'local';
const CLOUD = 'cloud';
const ARCHIVED = 'archived';
const PURGED = 'purged';
const ROOT = 'root';
const PROJECTS_PURGED_FOLDER = 'PROJECTS PURGED';

function projectStem(title) {
  return String(title || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'UNTITLED';
}

function normalizeShelf(shelf) {
  const key = String(shelf || '').trim().toLowerCase();
  if (key === PURGED) return PURGED;
  if (key === LOCAL || key === CLOUD) return key;
  if (key === LIVE || key === ROOT) return LOCAL;
  return ARCHIVED;
}

function normalizeStorageMode(mode) {
  return String(mode || '').trim().toLowerCase() === CLOUD ? CLOUD : LOCAL;
}

function ensureShelfDirs(projectsDir) {
  if (!projectsDir) return;
  const dirs = [
    projectsDir,
    path.join(projectsDir, 'posters'),
    path.join(projectsDir, LOCAL),
    path.join(projectsDir, LOCAL, 'posters'),
    path.join(projectsDir, CLOUD),
    path.join(projectsDir, CLOUD, 'posters'),
    path.join(projectsDir, ARCHIVED),
    path.join(projectsDir, ARCHIVED, 'posters'),
    path.join(projectsDir, PURGED),
    path.join(projectsDir, PURGED, 'posters'),
    path.join(path.dirname(projectsDir), PROJECTS_PURGED_FOLDER)
  ];
  for (const d of dirs) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
}

function studioRootFromProjectsDir(projectsDir) {
  return path.dirname(String(projectsDir || ''));
}

function purgedBundleDir(projectsDir, stem) {
  return path.join(studioRootFromProjectsDir(projectsDir), PROJECTS_PURGED_FOLDER, stem);
}

function isUnderProjectsPurged(dir) {
  const parts = String(dir || '').split(/[/\\]/).map((p) => p.toLowerCase());
  return parts.includes(PROJECTS_PURGED_FOLDER.toLowerCase());
}

function filmLayoutExists(dir) {
  if (!dir || !fs.existsSync(dir)) return false;
  return ['ASSETS', 'RENDERS', 'PROJECT'].some((name) => fs.existsSync(path.join(dir, name)));
}

function filmRootFromProject(parsed, studioRoot, stem) {
  const roots = parsed?.assetRoots && typeof parsed.assetRoots === 'object' ? parsed.assetRoots : {};
  const sample = roots.subjects || roots.projectSave || roots.workflows || roots.rendersVideo || '';
  const norm = String(sample || '').replace(/\\/g, '/');
  if (norm) {
    const nested = norm.match(new RegExp(`^(.*)/${stem}/(ASSETS|RENDERS|PROJECT)(/|$)`, 'i'));
    if (nested?.[1]) return path.join(nested[1], stem);
    const loose = norm.match(/^(.*)\/(ASSETS|RENDERS|PROJECT)(\/|$)/i);
    if (loose?.[1]) return loose[1];
  }
  const fallback = path.join(studioRoot, stem);
  if (filmLayoutExists(fallback) || (fs.existsSync(fallback) && fs.statSync(fallback).isDirectory())) {
    return fallback;
  }
  return '';
}

function isSafeFilmRoot(dir, studioRoot, projectsDir) {
  if (!dir) return false;
  const resolved = path.resolve(dir);
  const studio = path.resolve(studioRoot);
  const vault = path.resolve(projectsDir);
  if (resolved === studio || resolved === vault) return false;
  if (resolved.startsWith(`${vault}${path.sep}`)) return false;
  if (isUnderProjectsPurged(resolved)) return false;
  return true;
}

function copyRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const from = path.join(src, name);
    const to = path.join(dest, name);
    const st = fs.statSync(from);
    if (st.isDirectory()) copyRecursive(from, to);
    else fs.copyFileSync(from, to);
  }
}

function safeMoveDir(src, dest) {
  if (!src || !dest || !fs.existsSync(src)) return false;
  if (path.resolve(src) === path.resolve(dest)) return true;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(dest)) {
    for (const name of fs.readdirSync(src)) {
      const from = path.join(src, name);
      const to = path.join(dest, name);
      try {
        if (fs.statSync(from).isDirectory()) safeMoveDir(from, to);
        else safeMove(from, to);
      } catch {
        /* skip locked file */
      }
    }
    try { fs.rmSync(src, { recursive: true, force: true }); } catch { /* leftover */ }
    return true;
  }
  try {
    fs.renameSync(src, dest);
    return true;
  } catch {
    try {
      copyRecursive(src, dest);
      fs.rmSync(src, { recursive: true, force: true });
      return true;
    } catch {
      return false;
    }
  }
}

function pathsFor(projectsDir, stem, shelf) {
  if (shelf === ARCHIVED) {
    return {
      json: path.join(projectsDir, ARCHIVED, `${stem}.json`),
      poster: path.join(projectsDir, ARCHIVED, 'posters', `${stem}.png`)
    };
  }
  if (shelf === PURGED) {
    return {
      json: path.join(projectsDir, PURGED, `${stem}.json`),
      poster: path.join(projectsDir, PURGED, 'posters', `${stem}.png`)
    };
  }
  if (shelf === CLOUD) {
    return {
      json: path.join(projectsDir, CLOUD, `${stem}.json`),
      poster: path.join(projectsDir, CLOUD, 'posters', `${stem}.png`)
    };
  }
  if (shelf === ROOT || shelf === LIVE) {
    return {
      json: path.join(projectsDir, `${stem}.json`),
      poster: path.join(projectsDir, 'posters', `${stem}.png`)
    };
  }
  return {
    json: path.join(projectsDir, LOCAL, `${stem}.json`),
    poster: path.join(projectsDir, LOCAL, 'posters', `${stem}.png`)
  };
}

function safeMove(src, dest) {
  if (!src || !dest || !fs.existsSync(src)) return false;
  if (src === dest) return true;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(dest)) {
    try { fs.unlinkSync(dest); } catch { /* replace */ }
  }
  try {
    fs.renameSync(src, dest);
    return true;
  } catch {
    fs.copyFileSync(src, dest);
    try { fs.unlinkSync(src); } catch { /* dest is the live copy */ }
    return true;
  }
}

function safeUnlink(filePath) {
  try {
    if (filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      fs.unlinkSync(filePath);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

function findExisting(projectsDir, stem, order) {
  for (const shelf of order) {
    const loc = pathsFor(projectsDir, stem, shelf);
    if (fs.existsSync(loc.json)) return { shelf, ...loc };
  }
  return null;
}

function findPosterPath(projectsDir, title) {
  const stem = projectStem(title);
  const candidates = [
    path.join(projectsDir, 'posters', `${stem}.png`),
    path.join(projectsDir, LOCAL, 'posters', `${stem}.png`),
    path.join(projectsDir, CLOUD, 'posters', `${stem}.png`),
    path.join(projectsDir, ARCHIVED, 'posters', `${stem}.png`)
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function findLiveProjectFile(projectsDir, title) {
  const stem = projectStem(title);
  return findExisting(projectsDir, stem, [LOCAL, CLOUD, ROOT]);
}

function stampStorageMode(project, mode) {
  if (!project || typeof project !== 'object') return { storageMode: normalizeStorageMode(mode) };
  return { ...project, storageMode: normalizeStorageMode(mode) };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function migrateLiveJsonIntoShelves(projectsDir) {
  if (!projectsDir || !fs.existsSync(projectsDir)) return { moved: 0 };
  ensureShelfDirs(projectsDir);
  let moved = 0;
  for (const name of fs.readdirSync(projectsDir)) {
    if (!name.endsWith('.json')) continue;
    const src = path.join(projectsDir, name);
    try {
      if (!fs.statSync(src).isFile()) continue;
    } catch {
      continue;
    }
    let parsed = {};
    try {
      parsed = readJson(src) || {};
    } catch {
      parsed = {};
    }
    const mode = normalizeStorageMode(parsed.storageMode);
    const dest = path.join(projectsDir, mode, name);
    if (safeMove(src, dest)) {
      try {
        writeJson(dest, stampStorageMode(parsed, mode));
      } catch {
        /* keep moved file */
      }
      const stem = name.replace(/\.json$/i, '');
      const rootPoster = path.join(projectsDir, 'posters', `${stem}.png`);
      const shelfPoster = path.join(projectsDir, mode, 'posters', `${stem}.png`);
      if (fs.existsSync(rootPoster) && !fs.existsSync(shelfPoster)) {
        try {
          fs.copyFileSync(rootPoster, shelfPoster);
        } catch {
          /* optional */
        }
      }
      moved += 1;
    }
  }
  return { moved };
}

function listLiveProjects(projectsDir) {
  migrateLiveJsonIntoShelves(projectsDir);
  const byStem = new Map();
  for (const mode of [LOCAL, CLOUD]) {
    const dir = path.join(projectsDir, mode);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith('.json')) continue;
      const full = path.join(dir, name);
      try {
        const stat = fs.statSync(full);
        if (!stat.isFile()) continue;
        const parsed = readJson(full);
        if (!parsed || typeof parsed !== 'object') continue;
        const stem = name.replace(/\.json$/i, '');
        const prev = byStem.get(stem);
        if (!prev || stat.mtimeMs >= prev.mtimeMs) {
          byStem.set(stem, { project: stampStorageMode(parsed, mode), mtimeMs: stat.mtimeMs });
        }
      } catch {
        /* skip bad file */
      }
    }
  }
  return Array.from(byStem.values()).map((row) => row.project);
}

function saveProjectToLive(projectsDir, project) {
  ensureShelfDirs(projectsDir);
  migrateLiveJsonIntoShelves(projectsDir);
  const title = project?.title || 'UNTITLED_PROJECT';
  const stem = projectStem(title);
  const mode = normalizeStorageMode(project?.storageMode);
  const stamped = stampStorageMode({
    ...project,
    title,
    updatedAt: project?.updatedAt || new Date().toISOString(),
    lastModifiedIso: new Date().toISOString()
  }, mode);
  const dest = pathsFor(projectsDir, stem, mode);
  writeJson(dest.json, stamped);
  safeUnlink(pathsFor(projectsDir, stem, ROOT).json);
  const sharedPoster = path.join(projectsDir, 'posters', `${stem}.png`);
  if (fs.existsSync(sharedPoster) && !fs.existsSync(dest.poster)) {
    try {
      fs.copyFileSync(sharedPoster, dest.poster);
    } catch {
      /* optional */
    }
  }
  return { ok: true, filePath: dest.json, filename: `${stem}.json`, storageMode: mode };
}

function moveProjectStorageOnDisk(projectsDir, title, destMode) {
  const clean = String(title || '').trim();
  if (!projectsDir || !clean) return { ok: false, error: 'title required' };
  ensureShelfDirs(projectsDir);
  migrateLiveJsonIntoShelves(projectsDir);
  const mode = normalizeStorageMode(destMode);
  const stem = projectStem(clean);
  const found = findExisting(projectsDir, stem, [LOCAL, CLOUD, ROOT]);
  const dest = pathsFor(projectsDir, stem, mode);
  if (!found) {
    return { ok: true, title: clean, storageMode: mode, moved: false };
  }
  let parsed = {};
  try {
    parsed = readJson(found.json) || {};
  } catch {
    parsed = { title: clean };
  }
  const stamped = stampStorageMode(parsed, mode);
  writeJson(dest.json, stamped);
  if (found.poster && fs.existsSync(found.poster) && found.poster !== dest.poster) {
    try {
      fs.mkdirSync(path.dirname(dest.poster), { recursive: true });
      fs.copyFileSync(found.poster, dest.poster);
    } catch {
      /* poster is optional */
    }
  }
  safeUnlink(pathsFor(projectsDir, stem, ROOT).json);
  return { ok: true, title: clean, storageMode: mode, moved: true };
}

function collectLiveCopies(projectsDir, stem) {
  const out = [];
  for (const shelf of [LOCAL, CLOUD, ROOT, ARCHIVED]) {
    const loc = pathsFor(projectsDir, stem, shelf);
    if (fs.existsSync(loc.json)) out.push({ shelf, ...loc });
  }
  return out;
}

function purgeProjectBundle(projectsDir, title) {
  const clean = String(title || '').trim();
  const stem = projectStem(clean);
  const studioRoot = studioRootFromProjectsDir(projectsDir);
  const bundle = purgedBundleDir(projectsDir, stem);
  fs.mkdirSync(path.join(bundle, 'posters'), { recursive: true });

  const copies = collectLiveCopies(projectsDir, stem);
  let parsed = { title: clean };
  for (const copy of copies) {
    try {
      const rec = readJson(copy.json);
      if (rec && typeof rec === 'object') parsed = rec;
    } catch {
      /* keep last good */
    }
  }

  const destJson = path.join(bundle, `${stem}.json`);
  writeJson(destJson, parsed);
  for (const copy of copies) {
    if (path.resolve(copy.json) !== path.resolve(destJson)) safeUnlink(copy.json);
    if (copy.poster && fs.existsSync(copy.poster)) {
      safeMove(copy.poster, path.join(bundle, 'posters', `${stem}.png`));
    }
  }
  const sharedPoster = path.join(projectsDir, 'posters', `${stem}.png`);
  if (fs.existsSync(sharedPoster)) {
    try {
      fs.copyFileSync(sharedPoster, path.join(bundle, 'posters', `${stem}.png`));
    } catch {
      /* optional */
    }
  }
  safeUnlink(pathsFor(projectsDir, stem, PURGED).json);

  const filmRoot = filmRootFromProject(parsed, studioRoot, stem);
  let movedFolders = false;
  if (isSafeFilmRoot(filmRoot, studioRoot, projectsDir)) {
    movedFolders = safeMoveDir(filmRoot, bundle);
  }

  return {
    ok: true,
    title: clean,
    shelf: PURGED,
    moved: true,
    purgedDir: bundle,
    movedFolders
  };
}

function collectAllCopies(projectsDir, stem) {
  const out = [];
  for (const shelf of [LOCAL, CLOUD, ROOT, ARCHIVED, PURGED]) {
    const loc = pathsFor(projectsDir, stem, shelf);
    if (fs.existsSync(loc.json)) out.push({ shelf, ...loc });
  }
  return out;
}

/**
 * Irreversible wipe: JSON + posters + film folders + PROJECTS PURGED bundle.
 * Used by Destroy (not Purge).
 */
function destroyProjectOnDisk(projectsDir, title) {
  const clean = String(title || '').trim();
  if (!projectsDir || !clean) return { ok: false, error: 'title required' };
  ensureShelfDirs(projectsDir);
  migrateLiveJsonIntoShelves(projectsDir);
  const stem = projectStem(clean);
  const studioRoot = studioRootFromProjectsDir(projectsDir);
  const copies = collectAllCopies(projectsDir, stem);
  let parsed = { title: clean };
  for (const copy of copies) {
    try {
      const rec = readJson(copy.json);
      if (rec && typeof rec === 'object') parsed = rec;
    } catch {
      /* keep last */
    }
  }

  const removed = [];
  for (const copy of copies) {
    if (safeUnlink(copy.json)) removed.push(copy.json);
    if (copy.poster && safeUnlink(copy.poster)) removed.push(copy.poster);
  }
  const sharedPoster = path.join(projectsDir, 'posters', `${stem}.png`);
  if (safeUnlink(sharedPoster)) removed.push(sharedPoster);

  const filmRoot = filmRootFromProject(parsed, studioRoot, stem);
  let removedFolders = false;
  if (isSafeFilmRoot(filmRoot, studioRoot, projectsDir)) {
    try {
      fs.rmSync(filmRoot, { recursive: true, force: true });
      removedFolders = true;
      removed.push(filmRoot);
    } catch {
      /* locked */
    }
  }

  const purgedBundle = purgedBundleDir(projectsDir, stem);
  let removedPurgedBundle = false;
  if (fs.existsSync(purgedBundle)) {
    try {
      fs.rmSync(purgedBundle, { recursive: true, force: true });
      removedPurgedBundle = true;
      removed.push(purgedBundle);
    } catch {
      /* locked */
    }
  }

  return {
    ok: true,
    title: clean,
    shelf: 'destroyed',
    destroyed: true,
    removedFolders,
    removedPurgedBundle,
    removed
  };
}

/**
 * Move a title's JSON + poster into archived/, or the full film into PROJECTS PURGED.
 * Pass shelf "destroyed" for irreversible wipe (Destroy).
 */
function shelfProjectOnDisk(projectsDir, title, shelf) {
  const raw = String(shelf || '').trim().toLowerCase();
  if (raw === 'destroyed' || raw === 'destroy') {
    return destroyProjectOnDisk(projectsDir, title);
  }
  const destShelf = normalizeShelf(shelf) === LOCAL || normalizeShelf(shelf) === CLOUD
    ? ARCHIVED
    : normalizeShelf(shelf);
  const clean = String(title || '').trim();
  if (!projectsDir || !clean) return { ok: false, error: 'title required' };
  ensureShelfDirs(projectsDir);
  migrateLiveJsonIntoShelves(projectsDir);
  if (destShelf === PURGED) {
    return purgeProjectBundle(projectsDir, clean);
  }
  const stem = projectStem(clean);
  const dest = pathsFor(projectsDir, stem, destShelf);
  const search = [LOCAL, CLOUD, ROOT, ARCHIVED];
  const found = findExisting(projectsDir, stem, search);
  if (!found) {
    return { ok: true, title: clean, shelf: destShelf, moved: false };
  }
  if (found.shelf === destShelf) {
    return { ok: true, title: clean, shelf: destShelf, moved: false };
  }
  const movedJson = safeMove(found.json, dest.json);
  safeMove(found.poster, dest.poster);
  const sharedPoster = path.join(projectsDir, 'posters', `${stem}.png`);
  if (fs.existsSync(sharedPoster) && destShelf === ARCHIVED) {
    try {
      fs.copyFileSync(sharedPoster, dest.poster);
    } catch {
      /* optional */
    }
  }
  return { ok: true, title: clean, shelf: destShelf, moved: movedJson };
}

/** Move an archived title back to the live local/ folder. */
function restoreProjectOnDisk(projectsDir, title) {
  const clean = String(title || '').trim();
  if (!projectsDir || !clean) return { ok: false, error: 'title required' };
  ensureShelfDirs(projectsDir);
  const stem = projectStem(clean);
  const found = findExisting(projectsDir, stem, [ARCHIVED]);
  if (!found) return { ok: true, title: clean, restored: false };
  const dest = pathsFor(projectsDir, stem, LOCAL);
  let parsed = { title: clean };
  try {
    parsed = readJson(found.json) || parsed;
  } catch {
    /* keep default */
  }
  writeJson(dest.json, stampStorageMode(parsed, LOCAL));
  safeUnlink(found.json);
  safeMove(found.poster, dest.poster);
  return { ok: true, title: clean, restored: true, storageMode: LOCAL };
}

module.exports = {
  LIVE,
  LOCAL,
  CLOUD,
  ARCHIVED,
  PURGED,
  ensureShelfDirs,
  shelfProjectOnDisk,
  destroyProjectOnDisk,
  restoreProjectOnDisk,
  migrateLiveJsonIntoShelves,
  listLiveProjects,
  saveProjectToLive,
  moveProjectStorageOnDisk,
  findLiveProjectFile,
  findPosterPath,
  normalizeStorageMode,
  PROJECTS_PURGED_FOLDER
};
