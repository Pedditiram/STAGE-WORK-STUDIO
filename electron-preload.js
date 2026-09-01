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
  openFile: () => ipcRenderer.invoke('dialog:openFile'),

  // Shared disk vault — same projects/ + settings/ folders as Vite localhost
  listProjectsFromDisk: () => ipcRenderer.invoke('vault:listProjects'),
  saveProjectToDisk: (project) => ipcRenderer.invoke('vault:saveProject', project),
  savePosterToDisk: (payload) => ipcRenderer.invoke('vault:savePoster', payload),
  listPostersFromDisk: () => ipcRenderer.invoke('vault:listPosters'),
  readPosterDataUrl: (title) => ipcRenderer.invoke('vault:readPosterDataUrl', title),
  openPosterFolder: (payload) => ipcRenderer.invoke('vault:openPosterFolder', payload),
  getActiveWorkspaceFromDisk: () => ipcRenderer.invoke('vault:getActiveWorkspace'),
  setActiveWorkspaceOnDisk: (workspace) => ipcRenderer.invoke('vault:setActiveWorkspace', workspace),
  getVaultRoots: () => ipcRenderer.invoke('vault:getRoots'),
  factoryReset: (payload) => ipcRenderer.invoke('vault:factoryReset', payload || {}),
  getUiPrefsFromDisk: () => ipcRenderer.invoke('vault:getUiPrefs'),
  setUiPrefsOnDisk: (prefs) => ipcRenderer.invoke('vault:setUiPrefs', prefs),
  ensureDirs: (dirs) => ipcRenderer.invoke('vault:ensureDirs', dirs),
  resolveComfyAssets: (requests) => ipcRenderer.invoke('vault:resolveComfyAssets', requests),
  pickDirectory: () => ipcRenderer.invoke('dialog:pickDirectory'),
  openProjectFolder: (payload) => ipcRenderer.invoke('vault:openProjectFolder', payload || {}),
  saveProjectVersion: (payload) => ipcRenderer.invoke('vault:saveProjectVersion', payload),
  saveTextFiles: (payload) => ipcRenderer.invoke('vault:saveTextFiles', payload),
  ensurePlaceholderPngs: (payload) => ipcRenderer.invoke('vault:ensurePlaceholderPngs', payload),
  discoverFilmAssetRoots: (payload) => ipcRenderer.invoke('vault:discoverFilmAssetRoots', payload),

  // ComfyUI proxy (packaged Electron — no browser Origin CSRF 403)
  comfyFetch: (payload) => ipcRenderer.invoke('comfy:fetch', payload),

  // Check if running inside Electron
  isElectron: true,

  // Mirror mode: standard window frame — same UI chrome as localhost
  mirrorLocalhost: true,

  // Platform info
  platform: process.platform,
});
