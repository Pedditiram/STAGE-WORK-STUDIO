// =====================================================================
// STAGE PRODUCTION STUDIO — Electron Preload Script
// Exposes safe IPC bridge to the renderer (React app).
// =====================================================================

const { contextBridge, ipcRenderer } = require('electron');

// Expose a safe `window.electronAPI` object to the renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Save file via native Save Dialog
  saveFile: (defaultName, content) =>
    ipcRenderer.invoke('dialog:saveFile', { defaultName, content }),

  // Open file via native Open Dialog
  openFile: () =>
    ipcRenderer.invoke('dialog:openFile'),

  // Check if running inside Electron
  isElectron: true,

  // Platform info
  platform: process.platform,
});
