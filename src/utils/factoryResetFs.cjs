/**
 * Server/Electron factory reset — clears app vault mirrors & settings files.
 * NEVER deletes film project folders (SWS PROJECTS/{TITLE}/ASSETS|PROJECT|RENDERS).
 */
const fs = require('fs');
const path = require('path');

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

function clearAppProjectVault(projectsDir) {
  const removed = [];
  if (!projectsDir || !fs.existsSync(projectsDir)) {
    return { removed, postersCleared: 0 };
  }
  const entries = fs.readdirSync(projectsDir);
  for (const name of entries) {
    if (!name.endsWith('.json')) continue;
    const full = path.join(projectsDir, name);
    try {
      if (fs.statSync(full).isFile() && safeUnlink(full)) removed.push(name);
    } catch {
      /* ignore */
    }
  }
  let postersCleared = 0;
  const postersDir = path.join(projectsDir, 'posters');
  if (fs.existsSync(postersDir) && fs.statSync(postersDir).isDirectory()) {
    for (const name of fs.readdirSync(postersDir)) {
      const full = path.join(postersDir, name);
      try {
        if (fs.statSync(full).isFile() && safeUnlink(full)) postersCleared += 1;
      } catch {
        /* ignore */
      }
    }
  }
  return { removed, postersCleared };
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * @param {{ projectsDir: string, settingsDir: string, flushSettings?: boolean }} opts
 */
function runDiskFactoryReset(opts = {}) {
  const projectsDir = opts.projectsDir;
  const settingsDir = opts.settingsDir;
  const flushSettings = Boolean(opts.flushSettings);

  if (!projectsDir || !settingsDir) {
    return { ok: false, error: 'projectsDir and settingsDir required' };
  }

  // Guard: never accept a film root that looks like SWS PROJECTS layout
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

  return {
    ok: true,
    preserveFilmFolders: true,
    vaultJsonRemoved: vault.removed,
    postersCleared: vault.postersCleared,
    settingsTouched,
    note: 'Film project folders (ASSETS / PROJECT / RENDERS) were not modified.'
  };
}

module.exports = { runDiskFactoryReset, clearAppProjectVault };
