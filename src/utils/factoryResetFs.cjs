/**
 * Server/Electron factory reset — clears app vault mirrors & settings files.
 * Optional nuclear mode can delete film folders under Desktop/SWS PROJECTS.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

function safeUnlink(filePath) {
  try {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      fs.unlinkSync(filePath);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

function clearJsonInDir(dir, removed) {
  if (!dir || !fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.json')) continue;
    const full = path.join(dir, name);
    try {
      if (fs.statSync(full).isFile() && safeUnlink(full)) removed.push(name);
    } catch {
      /* ignore */
    }
  }
}

function clearPostersInDir(dir) {
  let n = 0;
  if (!dir || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return 0;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    try {
      if (fs.statSync(full).isFile() && safeUnlink(full)) n += 1;
    } catch {
      /* ignore */
    }
  }
  return n;
}

function rmTree(dir) {
  if (!dir || !fs.existsSync(dir)) return false;
  try {
    fs.rmSync(dir, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

function clearAppProjectVault(projectsDir) {
  const removed = [];
  if (!projectsDir || !fs.existsSync(projectsDir)) {
    return { removed, postersCleared: 0 };
  }
  clearJsonInDir(projectsDir, removed);
  clearJsonInDir(path.join(projectsDir, 'local'), removed);
  clearJsonInDir(path.join(projectsDir, 'cloud'), removed);
  clearJsonInDir(path.join(projectsDir, 'archived'), removed);
  clearJsonInDir(path.join(projectsDir, 'purged'), removed);
  clearJsonInDir(path.join(projectsDir, 'archived', 'local'), removed);
  clearJsonInDir(path.join(projectsDir, 'archived', 'cloud'), removed);
  clearJsonInDir(path.join(projectsDir, 'purged', 'local'), removed);
  clearJsonInDir(path.join(projectsDir, 'purged', 'cloud'), removed);
  let postersCleared = 0;
  postersCleared += clearPostersInDir(path.join(projectsDir, 'posters'));
  postersCleared += clearPostersInDir(path.join(projectsDir, 'local', 'posters'));
  postersCleared += clearPostersInDir(path.join(projectsDir, 'cloud', 'posters'));
  postersCleared += clearPostersInDir(path.join(projectsDir, 'archived', 'posters'));
  postersCleared += clearPostersInDir(path.join(projectsDir, 'purged', 'posters'));
  return { removed, postersCleared };
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function looksLikeFilmTitleDir(dirPath) {
  if (!dirPath || !fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) return false;
  const names = new Set(fs.readdirSync(dirPath).map((n) => n.toLowerCase()));
  return (
    names.has('assets') ||
    names.has('renders') ||
    names.has('project') ||
    names.has('as sets') ||
    names.has('workflows')
  );
}

/**
 * Delete Desktop/SWS PROJECTS/{TITLE} (and Documents variant) film folders.
 * Guarded: only under a folder named "SWS PROJECTS".
 */
function wipeSwsFilmFolders(studioRoot) {
  const candidates = [];
  const desktop = path.join(os.homedir(), 'Desktop', 'SWS PROJECTS');
  const docs = path.join(os.homedir(), 'Documents', 'SWS PROJECTS');
  candidates.push(desktop, docs);
  if (studioRoot) {
    candidates.push(path.join(studioRoot, 'SWS PROJECTS'));
    const parent = path.dirname(studioRoot);
    candidates.push(path.join(parent, 'SWS PROJECTS'));
  }

  const wiped = [];
  const skipped = [];
  const seen = new Set();

  for (const root of candidates) {
    const resolved = path.resolve(root);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    if (path.basename(resolved).toUpperCase() !== 'SWS PROJECTS') {
      skipped.push({ path: resolved, reason: 'not SWS PROJECTS' });
      continue;
    }
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) continue;
    for (const name of fs.readdirSync(resolved)) {
      if (name.startsWith('.')) continue;
      const filmDir = path.join(resolved, name);
      try {
        if (!fs.statSync(filmDir).isDirectory()) continue;
        if (!looksLikeFilmTitleDir(filmDir) && name.toUpperCase() !== 'PROJECTS PURGED') {
          // Still allow deleting title folders that only have partial layout
          if (!/^[A-Z0-9][A-Z0-9 _\-().]+$/i.test(name)) {
            skipped.push({ path: filmDir, reason: 'name guard' });
            continue;
          }
        }
        if (rmTree(filmDir)) wiped.push(filmDir);
      } catch {
        skipped.push({ path: filmDir, reason: 'error' });
      }
    }
    // Also wipe PROJECTS PURGED sibling if present beside SWS PROJECTS
    const purgedSibling = path.join(path.dirname(resolved), 'PROJECTS PURGED');
    if (fs.existsSync(purgedSibling) && path.basename(purgedSibling).toUpperCase() === 'PROJECTS PURGED') {
      if (rmTree(purgedSibling)) wiped.push(purgedSibling);
    }
  }

  return { wiped, skipped };
}

/**
 * @param {{ projectsDir: string, settingsDir: string, flushSettings?: boolean, wipeFilmFolders?: boolean, studioRoot?: string }} opts
 */
function runDiskFactoryReset(opts = {}) {
  const projectsDir = opts.projectsDir;
  const settingsDir = opts.settingsDir;
  const flushSettings = Boolean(opts.flushSettings);
  const wipeFilmFolders = Boolean(opts.wipeFilmFolders);
  const studioRoot = opts.studioRoot || (projectsDir ? path.dirname(projectsDir) : '');

  if (!projectsDir || !settingsDir) {
    return { ok: false, error: 'projectsDir and settingsDir required' };
  }

  const baseName = path.basename(projectsDir).toLowerCase();
  if (baseName === 'assets' || baseName === 'renders' || baseName === 'project') {
    return { ok: false, error: 'Refusing to reset a film folder path' };
  }

  const vault = clearAppProjectVault(projectsDir);

  writeJson(path.join(settingsDir, 'active_workspace.json'), {
    title: '',
    roomId: '',
    updatedAt: new Date().toISOString(),
    factoryResetAt: new Date().toISOString()
  });

  const settingsTouched = [];
  if (flushSettings) {
    writeJson(path.join(settingsDir, 'ui_prefs.json'), {
      factoryResetAt: new Date().toISOString()
    });
    settingsTouched.push('ui_prefs.json');

    writeJson(path.join(settingsDir, 'master_app_settings.json'), {
      sps_app_version: '2.5',
      exported_at: new Date().toISOString(),
      factoryResetAt: new Date().toISOString(),
      settings: {}
    });
    settingsTouched.push('master_app_settings.json');
  }

  let filmWipe = { wiped: [], skipped: [] };
  if (wipeFilmFolders) {
    filmWipe = wipeSwsFilmFolders(studioRoot);
  }

  return {
    ok: true,
    preserveFilmFolders: !wipeFilmFolders,
    vaultJsonRemoved: vault.removed,
    postersCleared: vault.postersCleared,
    settingsTouched,
    filmFoldersWiped: filmWipe.wiped,
    filmFoldersSkipped: filmWipe.skipped,
    note: wipeFilmFolders
      ? 'App vault flushed. SWS PROJECTS film folders deleted when found.'
      : 'Film project folders (ASSETS / PROJECT / RENDERS) were not modified.'
  };
}

module.exports = { runDiskFactoryReset, clearAppProjectVault, wipeSwsFilmFolders };
