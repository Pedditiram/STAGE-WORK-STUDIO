/**
 * Move film JSON + poster into projects/archived or projects/purged.
 * Archive and Purge must not erase the disk copy.
 * CommonJS so Vite middleware and Electron can require() it.
 */
const fs = require('fs');
const path = require('path');

const LIVE = 'live';
const ARCHIVED = 'archived';
const PURGED = 'purged';

function projectStem(title) {
  return String(title || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'UNTITLED';
}

function normalizeShelf(shelf) {
  const key = String(shelf || '').trim().toLowerCase();
  return key === PURGED ? PURGED : ARCHIVED;
}

function ensureShelfDirs(projectsDir) {
  if (!projectsDir) return;
  const dirs = [
    projectsDir,
    path.join(projectsDir, 'posters'),
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
  return {
    json: path.join(projectsDir, `${stem}.json`),
    poster: path.join(projectsDir, 'posters', `${stem}.png`)
  };
}

function safeMove(src, dest) {
  if (!src || !dest || !fs.existsSync(src)) return false;
  if (src === dest) return true;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(dest)) {
    try { fs.unlinkSync(dest); } catch { /* replace */ }
  }
  fs.renameSync(src, dest);
  return true;
}

function findExisting(projectsDir, stem, order) {
  for (const shelf of order) {
    const loc = pathsFor(projectsDir, stem, shelf);
    if (fs.existsSync(loc.json)) return { shelf, ...loc };
  }
  return null;
}

/**
 * Move a title's JSON + poster into archived/ or purged/.
 * Purge looks in live then archived so an already-archived film still lands in purged/.
 */
function shelfProjectOnDisk(projectsDir, title, shelf) {
  const destShelf = normalizeShelf(shelf);
  const clean = String(title || '').trim();
  if (!projectsDir || !clean) return { ok: false, error: 'title required' };
  ensureShelfDirs(projectsDir);
  const stem = projectStem(clean);
  const dest = pathsFor(projectsDir, stem, destShelf);
  const search = destShelf === PURGED ? [LIVE, ARCHIVED] : [LIVE, ARCHIVED];
  const found = findExisting(projectsDir, stem, search);
  if (!found) {
    return { ok: true, title: clean, shelf: destShelf, moved: false };
  }
  if (found.shelf === destShelf) {
    return { ok: true, title: clean, shelf: destShelf, moved: false };
  }
  const movedJson = safeMove(found.json, dest.json);
  safeMove(found.poster, dest.poster);
  return { ok: true, title: clean, shelf: destShelf, moved: movedJson };
}

/** Move an archived title back to the live projects/ folder. */
function restoreProjectOnDisk(projectsDir, title) {
  const clean = String(title || '').trim();
  if (!projectsDir || !clean) return { ok: false, error: 'title required' };
  ensureShelfDirs(projectsDir);
  const stem = projectStem(clean);
  const found = findExisting(projectsDir, stem, [ARCHIVED]);
  if (!found) return { ok: true, title: clean, restored: false };
  const dest = pathsFor(projectsDir, stem, LIVE);
  const restored = safeMove(found.json, dest.json);
  safeMove(found.poster, dest.poster);
  return { ok: true, title: clean, restored };
}

module.exports = {
  ARCHIVED,
  PURGED,
  ensureShelfDirs,
  shelfProjectOnDisk,
  restoreProjectOnDisk
};
