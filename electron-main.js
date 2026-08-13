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
const { app, BrowserWindow, Menu, shell, ipcMain, dialog, nativeTheme } = electron;
const path = require('path');
const fs = require('fs');

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// ─── App metadata ────────────────────────────────────────────────────
app.setName('Stage Production Studio');

// ─── Window reference ────────────────────────────────────────────────
let mainWindow = null;

function createWindow() {
  // Use dark native title bar on macOS
  nativeTheme.themeSource = 'dark';

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    title: 'Stage Production Studio',
    titleBarStyle: 'hiddenInset',      // macOS traffic lights, no title text
    trafficLightPosition: { x: 14, y: 12 },
    backgroundColor: '#09090b',
    icon: path.join(__dirname, 'public', 'favicon.svg'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'electron-preload.js'),
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
    show: false,   // show after ready-to-show for smoother launch
  });

  // ─── Load URL ────────────────────────────────────────────────────
  if (isDev) {
    // Dev mode: connect to Vite dev server
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // Production: load built index.html
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  // Smooth startup — show window only when content is ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Force light paper mode on every startup
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(`
      if (!localStorage.getItem('sps_color_theme') || localStorage.getItem('sps_color_theme') === 'dark') {
        localStorage.setItem('sps_color_theme', 'paper');
        window.dispatchEvent(new StorageEvent('storage', { key: 'sps_color_theme', newValue: 'paper' }));
      }
    `).catch(() => {});
  });

  // Open external links in default browser (not in app)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http') && !url.includes('localhost')) {
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
        { role: 'about', label: 'About Stage Production Studio' },
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
          label: 'Stage Production Studio Help',
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

// ─── IPC Handlers (for file save/open dialogs) ────────────────────────
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

// ─── App lifecycle ────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  buildMenu();

  if (process.platform === 'darwin') {
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
    const parsed = new URL(url);
    const allowed = ['localhost', '127.0.0.1'];
    if (!isDev && !allowed.includes(parsed.hostname)) {
      event.preventDefault();
    }
  });
});
