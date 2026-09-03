// =====================================================================
// STAGE PRODUCTION STUDIO — Electron Main Process
// Wraps the Vite/React web app as a native macOS desktop application.
// =====================================================================

const electron = require('electron');
// Cursor / VS Code shells often set ELECTRON_RUN_AS_NODE=1, which makes
// require('electron') return a path string instead of the Electron API.
if (!electron || typeof electron !== 'object' || !electron.app) {
  console.error(
    'Electron API unavailable. Unset ELECTRON_RUN_AS_NODE before launching.\n' +
    'Example: ELECTRON_RUN_AS_NODE= npm run electron:dev'
  );
  process.exit(1);
}
const { app, BrowserWindow, Menu, shell, ipcMain, dialog, nativeTheme, nativeImage } = electron;
const path = require('path');
const fs = require('fs');
const http = require('http');

/** Unpackaged = always talk to Vite. Packaged = dist/. */
const isPackaged = app.isPackaged;
const DEV_SERVER_URL = String(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173').replace(/\/$/, '');
const isDev = !isPackaged;

function resolveStudioRoots() {
  // Dev / unpackaged: same projects/ + settings/ as Vite localhost (repo root)
  if (!isPackaged) {
    return {
      projectsDir: path.join(__dirname, 'projects'),
      settingsDir: path.join(__dirname, 'settings')
    };
  }
  // Packaged: writable Documents folder (asar is read-only)
  const root = path.join(app.getPath('documents'), 'Stage Work Studio');
  return {
    projectsDir: path.join(root, 'projects'),
    settingsDir: path.join(root, 'settings')
  };
}

let PROJECTS_DIR = path.join(__dirname, 'projects');
let SETTINGS_DIR = path.join(__dirname, 'settings');

function ensureStudioDirs() {
  const roots = resolveStudioRoots();
  PROJECTS_DIR = roots.projectsDir;
  SETTINGS_DIR = roots.settingsDir;
  for (const d of [PROJECTS_DIR, SETTINGS_DIR, path.join(PROJECTS_DIR, 'posters')]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
}

function posterSafeName(title) {
  return `${String(title || 'UNTITLED').trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'UNTITLED'}.png`;
}

function writeProjectPosterFile(title, id, imageDataUrl) {
  ensureStudioDirs();
  const cleanTitle = String(title || '').trim();
  if (!cleanTitle) throw new Error('title required');
  if (!imageDataUrl || typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) {
    throw new Error('imageDataUrl must be a data:image URL');
  }
  const postersDir = path.join(PROJECTS_DIR, 'posters');
  const base64 = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
  const fileName = posterSafeName(cleanTitle);
  const filePath = path.join(postersDir, fileName);
  const buffer = Buffer.from(base64, 'base64');
  fs.writeFileSync(filePath, buffer);

  const posterUrl = `/api/project-poster?name=${encodeURIComponent(cleanTitle)}&v=${Date.now()}`;
  const projectFile = path.join(PROJECTS_DIR, posterSafeName(cleanTitle).replace(/\.png$/i, '.json'));
  let existing = {};
  if (fs.existsSync(projectFile)) {
    try {
      existing = JSON.parse(fs.readFileSync(projectFile, 'utf8')) || {};
    } catch {
      existing = {};
    }
  }
  try {
    assetRootsFs?.writeFilmProjectPoster?.(cleanTitle, buffer, existing.assetRoots);
  } catch {
    /* film folder mirror is best-effort */
  }
  const stamped = {
    ...existing,
    id: existing.id || id || `proj_${cleanTitle.replace(/[^\w.-]+/g, '_').toLowerCase()}`,
    title: existing.title || cleanTitle,
    posterUrl,
    posterFile: fileName,
    updatedAt: new Date().toISOString(),
    lastModifiedIso: new Date().toISOString(),
    lastModified: new Date().toLocaleDateString()
  };
  if (!Array.isArray(stamped.shots)) stamped.shots = existing.shots || [];
  fs.writeFileSync(projectFile, JSON.stringify(stamped, null, 2), 'utf8');
  return { filePath, fileName, posterUrl, projectFile };
}

function waitForUrl(url, { timeoutMs = 60000, intervalMs = 400 } = {}) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) {
          resolve(true);
          return;
        }
        retry();
      });
      req.on('error', retry);
      req.setTimeout(1500, () => {
        req.destroy();
        retry();
      });
    };
    const retry = () => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`Timed out waiting for ${url}`));
        return;
      }
      setTimeout(tick, intervalMs);
    };
    tick();
  });
}

// ─── App metadata ────────────────────────────────────────────────────
app.setName('Stage Work Studio');

/** App mark — PNG for Dock/window; packaged builds also bake icon.icns via electron-builder. */
function resolveAppIconPath() {
  const candidates = [
    path.join(__dirname, 'public', 'brand', 'stageworks-mark.png'),
    path.join(__dirname, 'dist', 'brand', 'stageworks-mark.png'),
    path.join(__dirname, 'build', 'icon.png'),
    path.join(process.resourcesPath || '', 'icon.icns'),
    path.join(__dirname, 'build', 'icon.icns'),
  ];
  return candidates.find((p) => p && fs.existsSync(p)) || null;
}

// ─── Window reference ────────────────────────────────────────────────
let mainWindow = null;

function createWindow() {
  // Follow system appearance — do not force paper/dark (must match localhost UI)
  nativeTheme.themeSource = 'system';

  const iconPath = resolveAppIconPath();
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    title: 'Stage Work Studio — AI Cinema Production OS',
    // Standard frame = same header layout as localhost (no traffic-light inset chrome)
    titleBarStyle: 'default',
    backgroundColor: '#0b0a09',
    autoHideMenuBar: true,
    fullscreen: true,
    ...(iconPath ? { icon: iconPath } : {}),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'electron-preload.js'),
      webSecurity: true,
      allowRunningInsecureContent: false,
      // Default session — do not isolate from future shared profiles
      spellcheck: false,
    },
    show: false,
  });
  const loadApp = async () => {
    if (isDev) {
      try {
        await waitForUrl(DEV_SERVER_URL);
        await mainWindow.loadURL(DEV_SERVER_URL);
        if (process.env.ELECTRON_OPEN_DEVTOOLS === '1') {
          mainWindow.webContents.openDevTools({ mode: 'detach' });
        }
      } catch (err) {
        const msg = String(err?.message || err);
        await mainWindow.loadURL(
          `data:text/html,${encodeURIComponent(
            `<html><body style="font-family:system-ui;padding:2rem;background:#0b0a09;color:#f4ecde">
              <h1>Stage Work Studio</h1>
              <p>Vite is not running at <code>${DEV_SERVER_URL}</code>.</p>
              <p>Run <code>npm run electron:dev</code> (starts Vite + Electron together).</p>
              <pre style="color:#c9a36a">${msg}</pre>
            </body></html>`
          )}`
        );
      }
    } else {
      const distIndex = path.join(__dirname, 'dist', 'index.html');
      if (!fs.existsSync(distIndex)) {
        await mainWindow.loadURL(
          `data:text/html,${encodeURIComponent(
            `<html><body style="font-family:system-ui;padding:2rem;background:#0b0a09;color:#f4ecde">
              <h1>Build missing</h1>
              <p>Run <code>npm run electron:build</code> so <code>dist/</code> is packaged with the app.</p>
            </body></html>`
          )}`
        );
        return;
      }
      await mainWindow.loadFile(distIndex);
    }
  };
  loadApp();

  mainWindow.once('ready-to-show', () => {
    try {
      mainWindow.setFullScreen(true);
    } catch (err) {}
    mainWindow.show();
    mainWindow.focus();
  });

  // Do NOT rewrite theme / localStorage — Electron must mirror localhost prefs (synced via disk).
  // Shell ≠ identity: Electron and Chrome localhost are the same user when the same email is signed in.
  // Collab "remote" = other room members, never the browser shell.

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http') && !url.includes('localhost') && !url.includes('127.0.0.1')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── macOS Dock menu ─────────────────────────────────────────────────
const dockMenu = Menu.buildFromTemplate([
  { label: 'New Project', click: () => { mainWindow && mainWindow.webContents.executeJavaScript('window.dispatchEvent(new Event("sps_new_project"))'); } },
  { type: 'separator' },
  { label: 'Open Matrix View', click: () => { mainWindow && mainWindow.webContents.executeJavaScript('window.dispatchEvent(new CustomEvent("sps_set_view", { detail: "spreadsheet" }))'); } },
  { label: 'Open Studio Form', click: () => { mainWindow && mainWindow.webContents.executeJavaScript('window.dispatchEvent(new CustomEvent("sps_set_view", { detail: "form" }))'); } },
]);

// ─── Native Menu Bar ─────────────────────────────────────────────────
function buildMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about', label: 'About Stage Work Studio — AI Cinema Production OS' },
        { type: 'separator' },
        {
          label: 'Studio Settings…',
          accelerator: 'CmdOrCtrl+K',
          click: () => mainWindow && mainWindow.webContents.executeJavaScript('window.dispatchEvent(new Event("sps_open_studio_settings"))'),
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Project',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow && mainWindow.webContents.executeJavaScript('window.dispatchEvent(new Event("sps_new_project"))'),
        },
        {
          label: 'Save Project',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow && mainWindow.webContents.executeJavaScript('window.dispatchEvent(new Event("sps_save_project"))'),
        },
        { type: 'separator' },
        {
          label: 'Export Project (.JSON)',
          accelerator: 'CmdOrCtrl+E',
          click: () => mainWindow && mainWindow.webContents.executeJavaScript('window.dispatchEvent(new Event("sps_export_project"))'),
        },
        {
          label: 'Import Project (.JSON)',
          accelerator: 'CmdOrCtrl+I',
          click: () => mainWindow && mainWindow.webContents.executeJavaScript('window.dispatchEvent(new Event("sps_import_project"))'),
        },
        ...(!isMac ? [
          { type: 'separator' },
          {
            label: 'Studio Settings…',
            accelerator: 'CmdOrCtrl+K',
            click: () => mainWindow && mainWindow.webContents.executeJavaScript('window.dispatchEvent(new Event("sps_open_studio_settings"))'),
          },
        ] : []),
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Matrix View',
          accelerator: 'CmdOrCtrl+1',
          click: () => mainWindow && mainWindow.webContents.executeJavaScript('window.dispatchEvent(new CustomEvent("sps_set_view", { detail: "spreadsheet" }))'),
        },
        {
          label: 'Studio Form',
          accelerator: 'CmdOrCtrl+2',
          click: () => mainWindow && mainWindow.webContents.executeJavaScript('window.dispatchEvent(new CustomEvent("sps_set_view", { detail: "form" }))'),
        },
        {
          label: 'Writer Console',
          accelerator: 'CmdOrCtrl+3',
          click: () => mainWindow && mainWindow.webContents.executeJavaScript('window.dispatchEvent(new CustomEvent("sps_set_view", { detail: "screenplay" }))'),
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [{ type: 'separator' }, { role: 'front' }] : [{ role: 'close' }]),
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Stage Work Studio Help',
          click: () => mainWindow && mainWindow.webContents.executeJavaScript('window.dispatchEvent(new Event("sps_open_help"))'),
        },
        { type: 'separator' },
        {
          label: 'Open DevTools',
          accelerator: 'CmdOrCtrl+Option+I',
          click: () => mainWindow && mainWindow.webContents.openDevTools(),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ─── IPC Handlers (Window Controls & File Dialogs) ───────────────────
ipcMain.handle('window:setFullScreen', async (_, flag) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setFullScreen(Boolean(flag));
    return mainWindow.isFullScreen();
  }
  return false;
});

ipcMain.handle('window:toggleFullScreen', async () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const next = !mainWindow.isFullScreen();
    mainWindow.setFullScreen(next);
    return next;
  }
  return false;
});

ipcMain.handle('window:isFullScreen', async () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow.isFullScreen();
  }
  return false;
});

ipcMain.handle('dialog:saveFile', async (_, { defaultName, content }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName || 'sps_project.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (!result.canceled && result.filePath) {
    fs.writeFileSync(result.filePath, content, 'utf8');
    return { success: true, filePath: result.filePath };
  }
  return { success: false };
});

ipcMain.handle('dialog:saveBinary', async (_, { defaultName, data, filters, defaultDir }) => {
  const downloads = app.getPath('downloads');
  const baseDir = (defaultDir && fs.existsSync(defaultDir)) ? defaultDir : downloads;
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: path.join(baseDir, defaultName || 'export.bin'),
    filters: Array.isArray(filters) && filters.length
      ? filters
      : [{ name: 'All files', extensions: ['*'] }],
  });
  if (!result.canceled && result.filePath) {
    const buf = Buffer.from(data instanceof Uint8Array ? data : new Uint8Array(data || []));
    fs.writeFileSync(result.filePath, buf);
    return { success: true, filePath: result.filePath };
  }
  return { success: false, canceled: true };
});

ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (!result.canceled && result.filePaths.length > 0) {
    const content = fs.readFileSync(result.filePaths[0], 'utf8');
    return { success: true, content, filePath: result.filePaths[0] };
  }
  return { success: false };
});

// ─── Shared disk vault (same projects/ + settings/ as Vite localhost) ──
ipcMain.handle('vault:listProjects', async () => {
  try {
    ensureStudioDirs();
    const files = fs.readdirSync(PROJECTS_DIR).filter((f) => f.endsWith('.json'));
    const projects = [];
    for (const f of files) {
      try {
        projects.push(JSON.parse(fs.readFileSync(path.join(PROJECTS_DIR, f), 'utf8')));
      } catch {
        /* skip bad file */
      }
    }
    return { ok: true, projects };
  } catch (err) {
    return { ok: false, error: err.message, projects: [] };
  }
});

ipcMain.handle('comfy:fetch', async (_, payload = {}) => {
  try {
    const base = String(payload.baseUrl || 'http://127.0.0.1:8188').replace(/\/$/, '');
    // Never hit Vite proxy from packaged main — talk to ComfyUI directly without browser Origin
    const comfyBase = /\/api\/comfyui$/i.test(base) || base.includes(':5173')
      ? 'http://127.0.0.1:8188'
      : base;
    const reqPath = String(payload.path || '/').startsWith('/') ? payload.path : `/${payload.path || ''}`;
    const url = `${comfyBase.replace(/\/$/, '')}${reqPath}`;
    const method = String(payload.method || 'GET').toUpperCase();
    const headers = { Origin: 'http://127.0.0.1:8188', Host: '127.0.0.1:8188' };
    if (payload.body != null) headers['Content-Type'] = 'application/json';
    const res = await fetch(url, {
      method,
      headers,
      body: payload.body != null ? payload.body : undefined
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    return { ok: res.ok, status: res.status, data, text };
  } catch (err) {
    return { ok: false, status: 0, error: err.message, data: null, text: '' };
  }
});

ipcMain.handle('vault:saveProject', async (_, project) => {
  try {
    ensureStudioDirs();
    const title = project?.title || 'UNTITLED_PROJECT';
    const safeFilename = String(title).replace(/[^a-zA-Z0-9_-]/g, '_') + '.json';
    const filePath = path.join(PROJECTS_DIR, safeFilename);
    const stamped = {
      ...project,
      updatedAt: new Date().toISOString(),
      lastModifiedIso: new Date().toISOString()
    };
    fs.writeFileSync(filePath, JSON.stringify(stamped, null, 2), 'utf8');
    return { ok: true, filePath, filename: safeFilename };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('vault:savePoster', async (_, payload) => {
  try {
    const result = writeProjectPosterFile(payload?.title, payload?.id, payload?.dataUrl || payload?.imageDataUrl);
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('vault:listPosters', async () => {
  try {
    ensureStudioDirs();
    const postersDir = path.join(PROJECTS_DIR, 'posters');
    if (!fs.existsSync(postersDir)) return { ok: true, posters: [] };
    const posters = fs.readdirSync(postersDir)
      .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
      .map((f) => {
        const titleGuess = f.replace(/\.(png|jpe?g|webp)$/i, '').replace(/_/g, ' ');
        return {
          fileName: f,
          title: titleGuess,
          posterUrl: `/api/project-poster?name=${encodeURIComponent(titleGuess)}`
        };
      });
    return { ok: true, posters };
  } catch (err) {
    return { ok: false, error: err.message, posters: [] };
  }
});

ipcMain.handle('vault:readPosterDataUrl', async (_, title) => {
  try {
    ensureStudioDirs();
    const postersDir = path.join(PROJECTS_DIR, 'posters');
    const filePath =
      assetRootsFs?.readProjectPosterFilePath?.(title, postersDir) ||
      path.join(postersDir, posterSafeName(title));
    if (!filePath || !fs.existsSync(filePath)) return { ok: false, error: 'not found' };
    const buf = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mime =
      ext === '.jpg' || ext === '.jpeg'
        ? 'image/jpeg'
        : ext === '.webp'
          ? 'image/webp'
          : 'image/png';
    return { ok: true, dataUrl: `data:${mime};base64,${buf.toString('base64')}` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('vault:openPosterFolder', async (_, payload = {}) => {
  try {
    const title = String(payload.projectTitle || payload.title || '').trim();
    if (!title) return { ok: false, error: 'projectTitle required' };
    const postersVault = path.join(PROJECTS_DIR, 'posters');
    const resolved = assetRootsFs?.resolvePosterFolderForProject?.(
      title,
      payload.assetRoots,
      postersVault
    );
    if (!resolved?.ok || !resolved.path) {
      return { ok: false, error: resolved?.error || 'Poster folder not found' };
    }
    const err = await shell.openPath(resolved.path);
    if (err) return { ok: false, error: err, path: resolved.path };
    return { ok: true, path: resolved.path, kind: resolved.kind };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('vault:getActiveWorkspace', async () => {
  try {
    ensureStudioDirs();
    const filePath = path.join(SETTINGS_DIR, 'active_workspace.json');
    if (!fs.existsSync(filePath)) return { ok: true, workspace: null };
    return { ok: true, workspace: JSON.parse(fs.readFileSync(filePath, 'utf8')) };
  } catch (err) {
    return { ok: false, error: err.message, workspace: null };
  }
});

ipcMain.handle('vault:setActiveWorkspace', async (_, workspace) => {
  try {
    ensureStudioDirs();
    const next = {
      title: String(workspace?.title || '').trim(),
      roomId: String(workspace?.roomId || '').trim(),
      updatedAt: new Date().toISOString()
    };
    if (!next.title) return { ok: false, error: 'title required' };
    fs.writeFileSync(
      path.join(SETTINGS_DIR, 'active_workspace.json'),
      JSON.stringify(next, null, 2),
      'utf8'
    );
    return { ok: true, workspace: next };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('vault:getUiPrefs', async () => {
  try {
    ensureStudioDirs();
    const filePath = path.join(SETTINGS_DIR, 'ui_prefs.json');
    if (!fs.existsSync(filePath)) return { ok: true, prefs: null };
    return { ok: true, prefs: JSON.parse(fs.readFileSync(filePath, 'utf8')) };
  } catch (err) {
    return { ok: false, error: err.message, prefs: null };
  }
});

ipcMain.handle('vault:setUiPrefs', async (_, prefs) => {
  try {
    ensureStudioDirs();
    const filePath = path.join(SETTINGS_DIR, 'ui_prefs.json');
    let prev = {};
    try {
      if (fs.existsSync(filePath)) prev = JSON.parse(fs.readFileSync(filePath, 'utf8')) || {};
    } catch {
      prev = {};
    }
    const colorTheme =
      prefs?.colorTheme === 'dark' || prefs?.colorTheme === 'paper'
        ? prefs.colorTheme
        : prev.colorTheme;
    const activeView =
      typeof prefs?.activeView === 'string' && prefs.activeView.trim()
        ? prefs.activeView.trim()
        : prev.activeView;
    const merged = {
      ...prev,
      ...(prefs && typeof prefs === 'object' ? prefs : {}),
      colorTheme,
      activeView,
      updatedAt: new Date().toISOString()
    };
    if (merged.colorTheme !== 'dark' && merged.colorTheme !== 'paper') {
      delete merged.colorTheme;
    }
    fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), 'utf8');
    return { ok: true, prefs: merged };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('vault:getRoots', async () => ({
  ok: true,
  projectsDir: PROJECTS_DIR,
  settingsDir: SETTINGS_DIR,
  isDev,
  devServerUrl: isDev ? DEV_SERVER_URL : null
}));

ipcMain.handle('vault:factoryReset', async (_, payload = {}) => {
  ensureStudioDirs();
  try {
    const { runDiskFactoryReset } = require(path.join(__dirname, 'src/utils/factoryResetFs.cjs'));
    return runDiskFactoryReset({
      projectsDir: PROJECTS_DIR,
      settingsDir: SETTINGS_DIR,
      flushSettings: Boolean(payload?.flushSettings)
    });
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

const assetRootsFs = (() => {
  try {
    return require(path.join(__dirname, 'src/utils/projectAssetRootsFs.cjs'));
  } catch {
    try {
      return require(path.join(app.getAppPath(), 'src/utils/projectAssetRootsFs.cjs'));
    } catch {
      return null;
    }
  }
})();

ipcMain.handle('vault:ensureDirs', async (_, dirs = []) => {
  if (!assetRootsFs) return { ok: false, error: 'assetRootsFs unavailable', created: [], dirs: [] };
  return assetRootsFs.ensureDirs(dirs);
});

ipcMain.handle('vault:resolveComfyAssets', async (_, requests = []) => {
  if (!assetRootsFs) return { ok: false, error: 'assetRootsFs unavailable', slots: [] };
  return { ok: true, slots: assetRootsFs.resolveMany(requests) };
});

ipcMain.handle('dialog:pickDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory']
  });
  if (!result.canceled && result.filePaths?.[0]) {
    return { ok: true, path: result.filePaths[0] };
  }
  return { ok: false, canceled: true };
});

ipcMain.handle('vault:saveProjectVersion', async (_, payload = {}) => {
  try {
    const dir = String(payload.dir || '').trim();
    const filename = String(payload.filename || '').trim();
    const project = payload.project;
    if (!dir || !filename || !project) {
      return { ok: false, error: 'dir, filename, and project required' };
    }
    if (assetRootsFs) {
      const mkdir = assetRootsFs.ensureDirs([dir]);
      if (!mkdir.ok) return mkdir;
    } else if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, JSON.stringify(project, null, 2), 'utf8');
    const latest = filename.replace(/_v\d+\.json$/i, '.json');
    if (latest !== filename) {
      try {
        fs.writeFileSync(path.join(dir, latest), JSON.stringify(project, null, 2), 'utf8');
      } catch {
        /* ignore */
      }
    }
    return { ok: true, filePath, filename, dir };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('vault:openProjectFolder', async (_, payload = {}) => {
  try {
    if (!assetRootsFs?.openProjectFolderAtPath) {
      return { ok: false, error: 'openProjectFolderAtPath unavailable' };
    }
    let pickedPath = String(payload?.folderPath || '').trim();
    if (!pickedPath) {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory'],
        title: 'Open project folder (ASSETS · PROJECT · RENDERS)'
      });
      if (result.canceled || !result.filePaths?.[0]) {
        return { ok: false, canceled: true };
      }
      pickedPath = result.filePaths[0];
    }
    const opened = assetRootsFs.openProjectFolderAtPath(pickedPath);
    if (!opened?.ok) return opened;
    const project = opened.project;
    if (project?._posterBufferBase64 && project.title) {
      try {
        const mime = 'image/png';
        const dataUrl = `data:${mime};base64,${project._posterBufferBase64}`;
        writeProjectPosterFile(project.title, project.id, dataUrl);
        project.posterUrl = `/api/project-poster?name=${encodeURIComponent(project.title)}&v=${Date.now()}`;
      } catch {
        /* poster optional */
      }
      delete project._posterBufferBase64;
      delete project.posterFileHint;
    }
    return { ...opened, project };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('vault:discoverFilmAssetRoots', async (_, payload = {}) => {
  try {
    const title = String(payload.projectTitle || payload.title || '').trim();
    if (!title) return { ok: false, error: 'projectTitle required' };
    if (!assetRootsFs?.discoverFilmAssetRoots) {
      return { ok: false, error: 'discoverFilmAssetRoots unavailable' };
    }
    const result = assetRootsFs.discoverFilmAssetRoots(title);
    if (payload.ensure) {
      const dirs = [
        result.roots.subjects,
        result.roots.worlds,
        result.roots.props,
        result.roots.supporting,
        result.roots.crowd,
        result.roots.rendersVideo,
        result.roots.rendersImage,
        result.roots.projectSave,
        result.roots.workflows,
        result.roots.posters
      ];
      const mkdir = assetRootsFs.ensureDirs(dirs);
      return { ...result, ensured: mkdir };
    }
    return result;
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('vault:ensurePlaceholderPngs', async (_, payload = {}) => {
  try {
    const entries = Array.isArray(payload.entries) ? payload.entries : [];
    if (!assetRootsFs?.ensurePlaceholderPngs) {
      return { ok: false, error: 'ensurePlaceholderPngs unavailable' };
    }
    return assetRootsFs.ensurePlaceholderPngs(entries);
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('vault:saveTextFiles', async (_, payload = {}) => {
  try {
    const dir = String(payload.dir || '').trim();
    const files = Array.isArray(payload.files) ? payload.files : [];
    if (!dir || !files.length) {
      return { ok: false, error: 'dir and files[] required' };
    }
    if (assetRootsFs) {
      const mkdir = assetRootsFs.ensureDirs([dir]);
      if (!mkdir.ok) return mkdir;
    } else if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const written = [];
    for (const f of files) {
      const name = String(f?.name || '')
        .replace(/[/\\]/g, '_')
        .trim();
      if (!name) continue;
      const content =
        typeof f.content === 'string' ? f.content : JSON.stringify(f.content ?? {}, null, 2);
      const filePath = path.join(dir, name);
      fs.writeFileSync(filePath, content, 'utf8');
      written.push({ name, filePath });
    }
    return { ok: true, dir, written, count: written.length };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ─── App lifecycle ────────────────────────────────────────────────────
app.whenReady().then(() => {
  ensureStudioDirs();
  createWindow();
  buildMenu();

  if (process.platform === 'darwin') {
    const iconPath = resolveAppIconPath();
    if (iconPath) {
      const img = nativeImage.createFromPath(iconPath);
      if (!img.isEmpty()) app.dock.setIcon(img);
    }
    app.dock.setMenu(dockMenu);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Security: prevent navigation to external origins
app.on('web-contents-created', (_, contents) => {
  contents.on('will-navigate', (event, url) => {
    try {
      const parsed = new URL(url);
      const allowed = ['localhost', '127.0.0.1'];
      if (!isDev && !allowed.includes(parsed.hostname) && parsed.protocol !== 'file:') {
        event.preventDefault();
      }
    } catch {
      event.preventDefault();
    }
  });
});
