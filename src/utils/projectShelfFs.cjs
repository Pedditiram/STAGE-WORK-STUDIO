/**
 * Move film JSON + poster into projects/local, projects/cloud, archived, or purged.
 * Local and cloud are exclusive live shelves. Archive and Purge must not erase the disk copy.
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
    path.join(projectsDir, PURGED, 'posters')
  ];
  for (const d of dirs) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
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
  const projects = [];
  for (const mode of [LOCAL, CLOUD]) {
    const dir = path.join(projectsDir, mode);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith('.json')) continue;
      const full = path.join(dir, name);
      try {
        if (!fs.statSync(full).isFile()) continue;
        const parsed = readJson(full);
        if (parsed && typeof parsed === 'object') {
          projects.push(stampStorageMode(parsed, mode));
        }
      } catch {
        /* skip bad file */
      }
    }
  }
  return projects;
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
  const other = pathsFor(projectsDir, stem, mode === CLOUD ? LOCAL : CLOUD);
  safeUnlink(other.json);
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
  if (found.json !== dest.json) {
    writeJson(dest.json, stamped);
    safeUnlink(found.json);
  } else {
    writeJson(dest.json, stamped);
  }
  if (found.poster && fs.existsSync(found.poster) && found.poster !== dest.poster) {
    safeMove(found.poster, dest.poster);
  }
  const other = pathsFor(projectsDir, stem, mode === CLOUD ? LOCAL : CLOUD);
  safeUnlink(other.json);
  safeUnlink(pathsFor(projectsDir, stem, ROOT).json);
  return { ok: true, title: clean, storageMode: mode, moved: true };
}

/**
 * Move a title's JSON + poster into archived/ or purged/.
 * Purge looks in live then archived so an already-archived film still lands in purged/.
 */
function shelfProjectOnDisk(projectsDir, title, shelf) {
  const destShelf = normalizeShelf(shelf) === LOCAL || normalizeShelf(shelf) === CLOUD
    ? ARCHIVED
    : normalizeShelf(shelf);
  const clean = String(title || '').trim();
  if (!projectsDir || !clean) return { ok: false, error: 'title required' };
  ensureShelfDirs(projectsDir);
  migrateLiveJsonIntoShelves(projectsDir);
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
  restoreProjectOnDisk,
  migrateLiveJsonIntoShelves,
  listLiveProjects,
  saveProjectToLive,
  moveProjectStorageOnDisk,
  findLiveProjectFile,
  findPosterPath,
  normalizeStorageMode
};
