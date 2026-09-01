/**
 * Node FS helpers for project asset roots (Vite middleware + Electron).
 * CommonJS so electron-main can require() it.
 */

const fs = require('fs');
const path = require('path');

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tif', '.tiff']);

function isImageFilename(name) {
  const lower = String(name || '').toLowerCase();
  const i = lower.lastIndexOf('.');
  if (i < 0) return false;
  return IMAGE_EXTS.has(lower.slice(i));
}

function pickAssetFilename(fileNames = [], hints = []) {
  const images = (fileNames || []).filter((f) => isImageFilename(f));
  if (!images.length) return '';
  const norms = hints
    .map((h) =>
      String(h || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '')
    )
    .filter(Boolean);
  if (!norms.length) return images[0];

  let best = '';
  let bestScore = -1;
  for (const file of images) {
    const stem = file.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    let score = 0;
    for (const n of norms) {
      if (stem === n) score = Math.max(score, 100);
      else if (stem.includes(n) || n.includes(stem)) {
        score = Math.max(score, 60 + Math.min(n.length, stem.length));
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = file;
    }
  }
  return bestScore > 0 ? best : '';
}

function listImageFilesRecursive(dir, depth = 0, maxDepth = 2) {
  const out = [];
  if (!dir || !fs.existsSync(dir) || depth > maxDepth) return out;
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...listImageFilesRecursive(full, depth + 1, maxDepth));
    } else if (ent.isFile() && isImageFilename(ent.name)) {
      out.push(full);
    }
  }
  return out;
}

function ensureDirs(dirs = []) {
  const created = [];
  const ok = [];
  for (const raw of dirs) {
    const d = String(raw || '').trim();
    if (!d) continue;
    try {
      if (!fs.existsSync(d)) {
        fs.mkdirSync(d, { recursive: true });
        created.push(d);
      }
      ok.push(d);
    } catch (err) {
      return { ok: false, error: err.message || String(err), created, dirs: ok };
    }
  }
  return { ok: true, created, dirs: ok };
}

function writeMinimalPng(filePath, rgb = [100, 120, 140]) {
  const zlib = require('zlib');
  const w = 64;
  const h = 64;
  const [r, g, b] = rgb;
  const raw = Buffer.concat(
    Array.from({ length: h }, () => Buffer.from([0, r, g, b, ...Array(w * 3).fill(0)].slice(0, 1 + w * 3)))
  );
  // Build raw scanlines properly
  const scan = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y += 1) {
    const rowStart = y * (1 + w * 3);
    scan[rowStart] = 0;
    for (let x = 0; x < w; x += 1) {
      const i = rowStart + 1 + x * 3;
      scan[i] = r;
      scan[i + 1] = g;
      scan[i + 2] = b;
    }
  }
  const crc32 = (buf, start, end) => {
    let c = 0xffffffff;
    for (let i = start; i < end; i += 1) {
      c ^= buf[i];
      for (let k = 0; k < 8; k += 1) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
    }
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data]), 0, typeBuf.length + data.length), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(scan, 9)),
    chunk('IEND', Buffer.alloc(0))
  ]);
  fs.writeFileSync(filePath, png);
}

/**
 * Write missing placeholder PNGs (subject names from REFERENCES, not Image_N).
 */
function ensurePlaceholderPngs(entries = []) {
  const written = [];
  const skipped = [];
  for (const e of entries) {
    const dir = String(e.dir || '').trim();
    const name = String(e.filename || '')
      .replace(/[/\\]/g, '_')
      .trim();
    if (!dir || !name) continue;
    const mkdir = ensureDirs([dir]);
    if (!mkdir.ok) return mkdir;
    const full = path.join(dir, name);
    if (fs.existsSync(full)) {
      skipped.push({ name, filePath: full });
      continue;
    }
    try {
      writeMinimalPng(full, e.rgb || [100, 120, 140]);
      written.push({ name, filePath: full });
    } catch (err) {
      return { ok: false, error: err.message || String(err), written, skipped };
    }
  }
  return { ok: true, written, skipped, count: written.length };
}

function resolveInFolder(folder, hints = []) {
  const dir = String(folder || '').trim();
  if (!dir) return { ok: false, path: '', error: 'empty folder' };
  if (!fs.existsSync(dir)) {
    return { ok: false, path: '', error: 'folder missing', folder: dir };
  }
  const files = listImageFilesRecursive(dir);
  if (!files.length) return { ok: false, path: '', error: 'no images', folder: dir };
  const basenames = files.map((f) => path.basename(f));
  const pick = pickAssetFilename(basenames, hints);
  if (!pick) return { ok: false, path: '', error: 'no match', folder: dir, candidates: basenames.slice(0, 12) };
  const full = files.find((f) => path.basename(f) === pick) || path.join(dir, pick);
  return { ok: true, path: full, folder: dir, filename: path.basename(full) };
}

function resolveMany(requests = []) {
  return (requests || []).map((req) => {
    const r = resolveInFolder(req.folder, req.hints || []);
    return {
      slot: req.slot,
      folderKey: req.folderKey,
      role: req.role,
      assetId: req.assetId,
      path: r.path || '',
      ok: Boolean(r.ok && r.path),
      error: r.error || ''
    };
  });
}

function sanitizeProjectFolderName(projectTitle) {
  return (
    String(projectTitle || 'PROJECT')
      .trim()
      .replace(/[/\\]+/g, '_')
      .replace(/[^a-zA-Z0-9._\- ]+/g, '')
      .replace(/\s+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80) || 'PROJECT'
  );
}

const FILM_DIR = Object.freeze({
  assets: 'ASSETS',
  renders: 'RENDERS',
  project: 'PROJECT'
});

const FILM_DIR_LEGACY = Object.freeze({
  assets: '000-ASSETS',
  renders: '010-RENDERS',
  project: '020-PROJECT'
});

/**
 * Rename 000-ASSETS → ASSETS (etc.) when the new name is free.
 */
function migrateLegacyFilmDirs(filmRoot) {
  const renamed = [];
  const pairs = [
    [FILM_DIR_LEGACY.assets, FILM_DIR.assets],
    [FILM_DIR_LEGACY.renders, FILM_DIR.renders],
    [FILM_DIR_LEGACY.project, FILM_DIR.project]
  ];
  for (const [fromName, toName] of pairs) {
    const from = path.join(filmRoot, fromName);
    const to = path.join(filmRoot, toName);
    if (!fs.existsSync(from)) continue;
    if (fs.existsSync(to)) continue;
    try {
      fs.renameSync(from, to);
      renamed.push({ from: fromName, to: toName });
    } catch {
      /* leave legacy in place; paths still work via modernize on next fill */
    }
  }
  return renamed;
}

function filmLayoutExists(filmRoot) {
  return (
    fs.existsSync(path.join(filmRoot, FILM_DIR.assets)) ||
    fs.existsSync(path.join(filmRoot, FILM_DIR.renders)) ||
    fs.existsSync(path.join(filmRoot, FILM_DIR.project)) ||
    fs.existsSync(path.join(filmRoot, FILM_DIR_LEGACY.assets)) ||
    fs.existsSync(path.join(filmRoot, FILM_DIR_LEGACY.renders)) ||
    fs.existsSync(path.join(filmRoot, FILM_DIR_LEGACY.project)) ||
    fs.existsSync(path.join(filmRoot, FILM_DIR.project, 'Workflows')) ||
    fs.existsSync(path.join(filmRoot, FILM_DIR.project, 'Versions')) ||
    fs.existsSync(path.join(filmRoot, FILM_DIR_LEGACY.project, 'Workflows')) ||
    fs.existsSync(path.join(filmRoot, FILM_DIR_LEGACY.project, 'Versions'))
  );
}

function expandUserPath(rawPath) {
  let s = String(rawPath || '').trim();
  if (!s) return s;
  const home = process.env.HOME || process.env.USERPROFILE || '';
  if (s === '~' && home) return home;
  if (s.startsWith('~/') && home) return path.join(home, s.slice(2));
  return s;
}

function resolveVersionsDir(filmRoot) {
  for (const projName of [FILM_DIR.project, FILM_DIR_LEGACY.project]) {
    const versions = path.join(filmRoot, projName, 'Versions');
    if (fs.existsSync(versions)) return versions;
  }
  return '';
}

function buildAssetRootsFromFilmRoot(filmRoot, { migrate = true } = {}) {
  const root = path.resolve(String(filmRoot || '').trim());
  if (!root) return null;
  if (migrate) migrateLegacyFilmDirs(root);
  const join = (...segs) => path.join(root, ...segs);
  return {
    subjects: join(FILM_DIR.assets, 'Subjects'),
    worlds: join(FILM_DIR.assets, 'Worlds'),
    props: join(FILM_DIR.assets, 'Props'),
    supporting: join(FILM_DIR.assets, 'Supporting'),
    crowd: join(FILM_DIR.assets, 'Crowd'),
    rendersVideo: join(FILM_DIR.renders, 'Video'),
    rendersImage: join(FILM_DIR.renders, 'Image'),
    projectSave: join(FILM_DIR.project, 'Versions'),
    workflows: join(FILM_DIR.project, 'Workflows'),
    posters: join(FILM_DIR.project, 'Posters'),
    versioning: true,
    projectVersion: 1,
    filmRoot: root,
    discovered: true,
    foundExisting: true
  };
}

/**
 * Resolve a user-picked path to a film root (…/MVK with ASSETS · PROJECT · RENDERS).
 */
function resolveFilmRootFromPickedPath(pickedPath) {
  const raw = String(pickedPath || '').trim();
  if (!raw) return { ok: false, error: 'No folder selected' };
  const normalized = path.resolve(expandUserPath(raw));
  if (!fs.existsSync(normalized)) return { ok: false, error: 'Folder does not exist' };

  if (filmLayoutExists(normalized)) {
    return {
      ok: true,
      filmRoot: normalized,
      titleGuess: folderNameToTitleGuess(path.basename(normalized))
    };
  }

  const base = path.basename(normalized);
  if (/^Versions$/i.test(base)) {
    const projectDir = path.dirname(normalized);
    const filmRoot = path.dirname(projectDir);
    if (filmLayoutExists(filmRoot)) {
      return {
        ok: true,
        filmRoot,
        titleGuess: folderNameToTitleGuess(path.basename(filmRoot))
      };
    }
  }
  if (/^(PROJECT|020-PROJECT)$/i.test(base)) {
    const filmRoot = path.dirname(normalized);
    if (filmLayoutExists(filmRoot) || fs.existsSync(path.join(filmRoot, FILM_DIR.assets))) {
      return {
        ok: true,
        filmRoot,
        titleGuess: folderNameToTitleGuess(path.basename(filmRoot))
      };
    }
  }

  const candidates = [];
  try {
    const entries = fs.readdirSync(normalized, { withFileTypes: true });
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const child = path.join(normalized, ent.name);
      if (filmLayoutExists(child)) {
        candidates.push({
          filmRoot: child,
          titleGuess: folderNameToTitleGuess(ent.name)
        });
      }
    }
  } catch {
    /* ignore */
  }

  if (candidates.length === 1) {
    return { ok: true, ...candidates[0] };
  }
  if (candidates.length > 1) {
    return { ok: false, error: 'multiple_projects', candidates };
  }

  return {
    ok: false,
    error: 'not_a_film_folder',
    hint: 'Pick the film folder (e.g. MVK) with ASSETS, PROJECT, and RENDERS — or the studio root containing those folders.'
  };
}

function loadLatestProjectJsonFromFilmRoot(filmRoot) {
  const versionsDir = resolveVersionsDir(filmRoot);
  if (!versionsDir) return { project: null, sourceFile: '' };

  let bestPath = '';
  let bestScore = -1;
  try {
    const files = fs.readdirSync(versionsDir).filter((f) => /\.json$/i.test(f));
    for (const name of files) {
      const fp = path.join(versionsDir, name);
      let score = 0;
      const verMatch = name.match(/_v(\d+)\.json$/i);
      if (verMatch) score = parseInt(verMatch[1], 10) || 0;
      else if (!/_v\d+\.json$/i.test(name)) score = 10000;
      try {
        const stat = fs.statSync(fp);
        score = score * 1e15 + stat.mtimeMs;
      } catch {
        score = score * 1e15;
      }
      if (score > bestScore) {
        bestScore = score;
        bestPath = fp;
      }
    }
  } catch {
    return { project: null, sourceFile: '' };
  }

  if (!bestPath) return { project: null, sourceFile: '' };
  try {
    const parsed = JSON.parse(fs.readFileSync(bestPath, 'utf8'));
    const project = parsed?.project || parsed;
    return { project, sourceFile: bestPath };
  } catch {
    return { project: null, sourceFile: bestPath };
  }
}

function mirrorPosterIntoVault(title, roots) {
  const candidates = resolveFilmPosterCandidatePaths(title, roots);
  for (const fp of candidates) {
    if (!fp || !fs.existsSync(fp) || !isLikelyValidImageFile(fp)) continue;
    try {
      return { ok: true, posterPath: fp, buffer: fs.readFileSync(fp) };
    } catch {
      /* try next */
    }
  }
  return { ok: false };
}

/**
 * Open a film folder from disk — load latest PROJECT/Versions JSON + wire asset roots.
 */
function openProjectFolderAtPath(pickedPath) {
  const resolved = resolveFilmRootFromPickedPath(pickedPath);
  if (!resolved.ok) return resolved;

  const { filmRoot, titleGuess } = resolved;
  const roots = buildAssetRootsFromFilmRoot(filmRoot, { migrate: true });
  if (!roots) return { ok: false, error: 'Could not build asset roots' };

  const { project: loaded, sourceFile } = loadLatestProjectJsonFromFilmRoot(filmRoot);
  const title = String(loaded?.title || titleGuess || '').trim();
  if (!title) return { ok: false, error: 'Could not determine project title from folder' };

  const folderKey = sanitizeProjectFolderName(title);
  let projectVersion = 1;
  if (loaded?.projectVersion) projectVersion = Number(loaded.projectVersion) || 1;
  else if (sourceFile) {
    const m = path.basename(sourceFile).match(/_v(\d+)\.json$/i);
    if (m) projectVersion = parseInt(m[1], 10) || 1;
  }

  const mergedRoots = {
    ...roots,
    ...normalizeAssetRootsFromDisk(loaded?.assetRoots),
    filmRoot,
    discovered: true,
    foundExisting: true,
    versioning: loaded?.assetRoots?.versioning !== false,
    projectVersion
  };

  const project = {
    ...(loaded && typeof loaded === 'object' ? loaded : {}),
    id: loaded?.id || `proj_${folderKey.toLowerCase()}`,
    title,
    description: loaded?.description || `Opened from ${filmRoot}`,
    targetModel: loaded?.targetModel || 'SPS Direct Cinema 2.0',
    aspectRatio: loaded?.aspectRatio || '2.39:1 Anamorphic',
    shots: Array.isArray(loaded?.shots) ? loaded.shots : [],
    assetRoots: mergedRoots,
    projectVersion,
    lastModifiedIso: new Date().toISOString(),
    lastModified: new Date().toLocaleDateString(),
    openedFromFolder: filmRoot,
    openedFromFile: sourceFile || undefined
  };

  const poster = mirrorPosterIntoVault(title, mergedRoots);
  if (poster.ok && poster.buffer) {
    project.posterFileHint = poster.posterPath;
    project._posterBufferBase64 = poster.buffer.toString('base64');
  }

  return {
    ok: true,
    filmRoot,
    roots: mergedRoots,
    project,
    sourceFile,
    shotCount: project.shots?.length || 0
  };
}

function normalizeAssetRootsFromDisk(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const out = { ...raw };
  for (const k of Object.keys(out)) {
    if (typeof out[k] === 'string') out[k] = out[k].replace(/\\/g, '/');
  }
  return out;
}

/**
 * Find or create …/{PROJECT}/ASSETS · RENDERS · PROJECT layout.
 * Migrates legacy 000-/010-/020- names when present. Prefers Desktop/SWS PROJECTS.
 */
function discoverFilmAssetRoots(projectTitle, { migrate = true } = {}) {
  const folder = sanitizeProjectFolderName(projectTitle);
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const studioCandidates = [
    path.join(home, 'Desktop', 'SWS PROJECTS'),
    path.join(home, 'Desktop', 'SWS PROJ'),
    path.join(home, 'Documents', 'SWS PROJECTS'),
    path.join(home, 'Documents', 'SWS PROJ')
  ].filter(Boolean);

  let filmRoot = '';
  let foundExisting = false;
  for (const studio of studioCandidates) {
    const candidate = path.join(studio, folder);
    if (filmLayoutExists(candidate) || fs.existsSync(candidate)) {
      filmRoot = candidate;
      foundExisting = true;
      break;
    }
  }
  if (!filmRoot) {
    const studio = studioCandidates[0] || path.join(home, 'Desktop', 'SWS PROJECTS');
    filmRoot = path.join(studio, folder);
  }

  let renamed = [];
  if (migrate && foundExisting) {
    renamed = migrateLegacyFilmDirs(filmRoot);
  }

  const join = (...segs) => path.join(filmRoot, ...segs);
  const roots = {
    subjects: join(FILM_DIR.assets, 'Subjects'),
    worlds: join(FILM_DIR.assets, 'Worlds'),
    props: join(FILM_DIR.assets, 'Props'),
    supporting: join(FILM_DIR.assets, 'Supporting'),
    crowd: join(FILM_DIR.assets, 'Crowd'),
    rendersVideo: join(FILM_DIR.renders, 'Video'),
    rendersImage: join(FILM_DIR.renders, 'Image'),
    projectSave: join(FILM_DIR.project, 'Versions'),
    workflows: join(FILM_DIR.project, 'Workflows'),
    posters: join(FILM_DIR.project, 'Posters'),
    versioning: true,
    projectVersion: 1,
    filmRoot,
    discovered: true,
    foundExisting
  };
  return { ok: true, roots, folder, filmRoot, foundExisting, renamed };
}

function posterVaultFileName(title) {
  return `${String(title || 'UNTITLED').trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'UNTITLED'}.png`;
}

function resolvePostersDirFromRoots(roots) {
  const save = String(roots?.projectSave || '').trim().replace(/[/\\]+$/, '');
  if (!save) return '';
  const norm = save.replace(/\\/g, '/');
  if (/\/Versions$/i.test(norm)) {
    return save.replace(/[/\\]Versions$/i, path.sep + 'Posters');
  }
  return path.join(path.dirname(save), 'Posters');
}

function isLikelyValidImageFile(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size < 200) return false;
    const buf = fs.readFileSync(filePath);
    if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
      return true;
    }
    if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xd8) return true;
    if (
      buf.length >= 12 &&
      buf.slice(0, 4).toString('ascii') === 'RIFF' &&
      buf.slice(8, 12).toString('ascii') === 'WEBP'
    ) {
      return true;
    }
    return stat.size > 800;
  } catch {
    return false;
  }
}

function resolveFilmPosterCandidatePaths(projectTitle, roots = null) {
  const out = [];
  let r = roots;
  let filmRoot = '';
  if (!r?.projectSave) {
    const d = discoverFilmAssetRoots(projectTitle, { migrate: false });
    r = d?.roots;
    filmRoot = d?.filmRoot || '';
  } else {
    const save = String(r.projectSave).replace(/\\/g, '/');
    const m = save.match(/^(.*)\/(PROJECT|020-PROJECT)\/Versions$/i);
    if (m) filmRoot = m[1];
  }
  if (r?.projectSave) {
    const dir = resolvePostersDirFromRoots(r);
    if (dir) {
      out.push(path.join(dir, 'poster.png'));
      out.push(path.join(dir, `${sanitizeProjectFolderName(projectTitle)}_poster.png`));
    }
  }
  if (filmRoot) {
    out.push(path.join(filmRoot, FILM_DIR.project, 'poster.png'));
    out.push(path.join(filmRoot, FILM_DIR_LEGACY.project, 'poster.png'));
  }
  return out;
}

function readProjectPosterFilePath(projectTitle, vaultPostersDir) {
  const candidates = [];
  if (vaultPostersDir) {
    candidates.push(path.join(vaultPostersDir, posterVaultFileName(projectTitle)));
  }
  candidates.push(...resolveFilmPosterCandidatePaths(projectTitle));
  for (const p of candidates) {
    if (p && fs.existsSync(p) && isLikelyValidImageFile(p)) return p;
  }
  return null;
}

function writeFilmProjectPoster(projectTitle, buffer, roots = null) {
  let r = roots;
  if (!r?.projectSave) {
    const d = discoverFilmAssetRoots(projectTitle, { migrate: true });
    r = d?.roots;
    if (r?.projectSave) {
      ensureDirs([
        resolvePostersDirFromRoots(r),
        r.projectSave,
        r.workflows,
        r.posters
      ].filter(Boolean));
    }
  }
  const posterDir = resolvePostersDirFromRoots(r);
  if (!posterDir) return { ok: false, skipped: true, reason: 'no projectSave' };
  ensureDirs([posterDir]);
  const paths = [];
  const main = path.join(posterDir, 'poster.png');
  fs.writeFileSync(main, buffer);
  paths.push(main);
  const titled = path.join(posterDir, `${sanitizeProjectFolderName(projectTitle)}_poster.png`);
  fs.writeFileSync(titled, buffer);
  paths.push(titled);
  return { ok: true, posterDir, paths };
}

function resolvePosterFolderForProject(projectTitle, assetRoots = null, vaultPostersDir = '') {
  const title = String(projectTitle || '').trim();
  if (!title) return { ok: false, error: 'title required' };

  let r = assetRoots && String(assetRoots.projectSave || '').trim() ? assetRoots : null;
  if (!r?.projectSave) {
    const d = discoverFilmAssetRoots(title, { migrate: true });
    r = d?.roots;
  }
  const posterDir = resolvePostersDirFromRoots(r);
  if (posterDir) {
    ensureDirs([posterDir]);
    return { ok: true, path: posterDir, kind: 'film' };
  }
  const vault = String(vaultPostersDir || '').trim();
  if (vault) {
    ensureDirs([vault]);
    return { ok: true, path: vault, kind: 'vault' };
  }
  return { ok: false, error: 'Poster folder not found' };
}

module.exports = {
  ensureDirs,
  resolveInFolder,
  resolveMany,
  pickAssetFilename,
  listImageFilesRecursive,
  isImageFilename,
  sanitizeProjectFolderName,
  discoverFilmAssetRoots,
  migrateLegacyFilmDirs,
  ensurePlaceholderPngs,
  writeMinimalPng,
  posterVaultFileName,
  resolvePostersDirFromRoots,
  readProjectPosterFilePath,
  writeFilmProjectPoster,
  isLikelyValidImageFile,
  resolvePosterFolderForProject,
  FILM_DIR,
  FILM_DIR_LEGACY,
  resolveFilmRootFromPickedPath,
  buildAssetRootsFromFilmRoot,
  loadLatestProjectJsonFromFilmRoot,
  openProjectFolderAtPath
};
