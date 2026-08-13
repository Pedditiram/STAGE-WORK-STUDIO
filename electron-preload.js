// =====================================================================
// STAGE PRODUCTION STUDIO — Electron Preload Script
// Exposes safe IPC bridge to the renderer (React app).
// =====================================================================

const { contextBridge, ipcRenderer } = require('electron');

// Expose a safe `window.electronAPI` object to the renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Save text/JSON via native Save Dialog
  saveFile: (defaultName, content) =>
    ipcRenderer.invoke('dialog:saveFile', { defaultName, content }),

  // Save binary (PNG/MP4) via Save Dialog — defaults to Downloads
  saveBinaryFile: async (defaultName, blobOrBuffer, options = {}) => {
    let data;
    if (blobOrBuffer instanceof Blob) {
      data = new Uint8Array(await blobOrBuffer.arrayBuffer());
    } else if (blobOrBuffer instanceof ArrayBuffer) {
      data = new Uint8Array(blobOrBuffer);
    } else if (blobOrBuffer instanceof Uint8Array) {
      data = blobOrBuffer;
    } else {
      throw new Error('saveBinaryFile expects Blob or Uint8Array');
    }
    return ipcRenderer.invoke('dialog:saveBinary', {
      defaultName,
      data,
      filters: options.filters,
      defaultDir: options.defaultDir
    });
  },

  // Open file via native Open Dialog
  openFile: () =>
    ipcRenderer.invoke('dialog:openFile'),

  // Check if running inside Electron
  isElectron: true,

  // Platform info
  platform: process.platform,
});
