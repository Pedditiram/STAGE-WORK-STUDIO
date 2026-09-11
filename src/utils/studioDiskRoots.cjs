/**
 * Resolve where Stage Work Studio stores projects + settings on this computer.
 * Default: ~/Documents/Stage Work Studio
 * Custom: settings/studio_disk_root.json (or SPS_STUDIO_ROOT) when the user picks a folder.
 * CommonJS so Vite middleware and Electron can require() it.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const STUDIO_FOLDER_NAME = 'Stage Work Studio';
const ROOT_FILE = 'studio_disk_root.json';

function isPlaceholderAllottedPath(raw) {
  const s = String(raw || '').trim();
  if (!s) return true;
  const n = s.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  return n === '.' || n === './projects' || n === './storage' || n === 'projects' || n === 'storage';
}

function defaultStudioRoot(documentsDir) {
  const docs = documentsDir || path.join(os.homedir(), 'Documents');
  return path.join(docs, STUDIO_FOLDER_NAME);
}

function bootstrapSettingsDir(documentsDir) {
  return path.join(defaultStudioRoot(documentsDir), 'settings');
}

function expandUserPath(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (s === '~') return os.homedir();
  if (s.startsWith('~/') || s.startsWith('~\\')) {
    return path.join(os.homedir(), s.slice(2));
  }
  return s;
}

function pointerPath(documentsDir) {
  return path.join(bootstrapSettingsDir(documentsDir), ROOT_FILE);
}

function readCustomPointer(documentsDir) {
  const envRoot = String(process.env.SPS_STUDIO_ROOT || '').trim();
  if (envRoot && !isPlaceholderAllottedPath(envRoot)) {
    return { studioRoot: expandUserPath(envRoot), from: 'env' };
  }
  const file = pointerPath(documentsDir);
  try {
    if (!fs.existsSync(file)) return null;
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) || {};
    const studioRoot = expandUserPath(parsed.studioRoot || parsed.root || '');
    const projectsDir = expandUserPath(parsed.projectsDir || '');
    if (projectsDir && !isPlaceholderAllottedPath(projectsDir)) {
      return { studioRoot: studioRoot || path.dirname(projectsDir), projectsDir, from: 'file' };
    }
    if (studioRoot && !isPlaceholderAllottedPath(studioRoot)) {
      return { studioRoot, from: 'file' };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function splitStudioAndProjects(inputPath) {
  const expanded = path.resolve(expandUserPath(inputPath));
  if (path.basename(expanded).toLowerCase() === 'projects') {
    return { studioRoot: path.dirname(expanded), projectsDir: expanded };
  }
  return {
    studioRoot: expanded,
    projectsDir: path.join(expanded, 'projects')
  };
}

function resolveStudioDiskRoots({ documentsDir, repoProjectsDir } = {}) {
  const custom = readCustomPointer(documentsDir);
  let studioRoot;
  let projectsDir;
  let customUsed = false;
  if (custom?.projectsDir) {
    studioRoot = custom.studioRoot || path.dirname(custom.projectsDir);
    projectsDir = custom.projectsDir;
    customUsed = true;
  } else if (custom?.studioRoot) {
    const split = splitStudioAndProjects(custom.studioRoot);
    studioRoot = split.studioRoot;
    projectsDir = split.projectsDir;
    customUsed = true;
  } else {
    studioRoot = defaultStudioRoot(documentsDir);
    projectsDir = path.join(studioRoot, 'projects');
  }
  const settingsDir = path.join(studioRoot, 'settings');
  return {
    studioRoot,
    projectsDir,
    settingsDir,
    localDir: path.join(projectsDir, 'local'),
    cloudDir: path.join(projectsDir, 'cloud'),
    custom: customUsed,
    defaultRoot: defaultStudioRoot(documentsDir),
    repoProjectsDir: repoProjectsDir || ''
  };
}

function writeCustomRoot(studioRootOrProjects, { documentsDir } = {}) {
  const boot = bootstrapSettingsDir(documentsDir);
  fs.mkdirSync(boot, { recursive: true });
  const file = pointerPath(documentsDir);
  if (isPlaceholderAllottedPath(studioRootOrProjects)) {
    try {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    } catch {
      /* ignore */
    }
    return resolveStudioDiskRoots({ documentsDir });
  }
  const split = splitStudioAndProjects(studioRootOrProjects);
  const payload = {
    studioRoot: split.studioRoot,
    projectsDir: split.projectsDir,
    settingsDir: path.join(split.studioRoot, 'settings'),
    updatedAt: new Date().toISOString()
  };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');
  return resolveStudioDiskRoots({ documentsDir });
}

function copyFileIfMissing(src, dest) {
  if (!src || !dest || !fs.existsSync(src)) return false;
  if (fs.existsSync(dest)) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return true;
}

function liveJsonCount(projectsDir) {
  let n = 0;
  for (const sub of ['local', 'cloud']) {
    const dir = path.join(projectsDir, sub);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith('.json')) continue;
      try {
        if (fs.statSync(path.join(dir, name)).isFile()) n += 1;
      } catch {
        /* ignore */
      }
    }
  }
  return n;
}

/**
 * Create vault folders, migrate root JSON into local/cloud, seed from the repo
 * only when the Documents vault is still empty.
 */
function ensureStudioVault(roots, { repoProjectsDir, shelfFs } = {}) {
  const projectsDir = roots?.projectsDir;
  const settingsDir = roots?.settingsDir;
  if (!projectsDir || !settingsDir) return roots;
  const dirs = [
    roots.studioRoot,
    projectsDir,
    settingsDir,
    path.join(projectsDir, 'posters'),
    path.join(projectsDir, 'local'),
    path.join(projectsDir, 'local', 'posters'),
    path.join(projectsDir, 'cloud'),
    path.join(projectsDir, 'cloud', 'posters')
  ];
  for (const d of dirs) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
  const shelf = shelfFs || require('./projectShelfFs.cjs');
  shelf.ensureShelfDirs(projectsDir);
  if (typeof shelf.migrateLiveJsonIntoShelves === 'function') {
    shelf.migrateLiveJsonIntoShelves(projectsDir);
  }
  const seedFrom = repoProjectsDir || roots.repoProjectsDir;
  if (
    seedFrom &&
    fs.existsSync(seedFrom) &&
    path.resolve(seedFrom) !== path.resolve(projectsDir) &&
    liveJsonCount(projectsDir) === 0
  ) {
    if (typeof shelf.migrateLiveJsonIntoShelves === 'function') {
      shelf.migrateLiveJsonIntoShelves(seedFrom);
    }
    for (const name of fs.readdirSync(seedFrom)) {
      if (!name.endsWith('.json')) continue;
      const src = path.join(seedFrom, name);
      try {
        if (!fs.statSync(src).isFile()) continue;
      } catch {
        continue;
      }
      copyFileIfMissing(src, path.join(projectsDir, 'local', name));
    }
    const repoPosters = path.join(seedFrom, 'posters');
    const destPosters = path.join(projectsDir, 'posters');
    if (fs.existsSync(repoPosters)) {
      for (const name of fs.readdirSync(repoPosters)) {
        copyFileIfMissing(path.join(repoPosters, name), path.join(destPosters, name));
      }
    }
  }
  return roots;
}

module.exports = {
  STUDIO_FOLDER_NAME,
  isPlaceholderAllottedPath,
  defaultStudioRoot,
  resolveStudioDiskRoots,
  writeCustomRoot,
  ensureStudioVault
};
