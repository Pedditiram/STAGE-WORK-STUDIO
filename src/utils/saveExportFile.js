/**
 * Save PNG/MP4 (or any blob) to Downloads / user-chosen path.
 * Electron: native Save dialog defaulting to Downloads.
 * Web: File System Access API when available, else browser Downloads.
 */
import { parseSceneAndShotID } from './sceneShotUtils';

function sanitizeStem(s) {
  return String(s || 'export')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80) || 'export';
}

/** Build filename stem from project + SC##_SH## */
export function buildShotExportStem(shot, shotIndex = 0, projectTitle = '') {
  const shortId = parseSceneAndShotID(shot, shotIndex).shortId || 'SC01_SH01';
  const proj = sanitizeStem(projectTitle);
  return proj ? `${proj}_${shortId}` : shortId;
}

const LAST_DIR_KEY = 'sps_export_last_dir';

export function getRememberedExportDir() {
  try {
    return localStorage.getItem(LAST_DIR_KEY) || '';
  } catch {
    return '';
  }
}

function rememberExportDir(filePath) {
  if (!filePath) return;
  try {
    const norm = String(filePath).replace(/\\/g, '/');
    const dir = norm.includes('/') ? norm.slice(0, norm.lastIndexOf('/')) : '';
    if (dir) localStorage.setItem(LAST_DIR_KEY, dir);
  } catch {
    /* ignore */
  }
}

function extFilters(filename) {
  const ext = (String(filename).split('.').pop() || '').toLowerCase();
  if (ext === 'png') return [{ name: 'PNG image', extensions: ['png'] }];
  if (ext === 'mp4') return [{ name: 'MP4 video', extensions: ['mp4'] }];
  if (ext === 'webm') return [{ name: 'WebM video', extensions: ['webm'] }];
  return [{ name: 'All files', extensions: ['*'] }];
}

function acceptTypes(filename) {
  const ext = (String(filename).split('.').pop() || '').toLowerCase();
  if (ext === 'png') {
    return [{ description: 'PNG image', accept: { 'image/png': ['.png'] } }];
  }
  if (ext === 'mp4') {
    return [{ description: 'MP4 video', accept: { 'video/mp4': ['.mp4'] } }];
  }
  return undefined;
}

function downloadViaAnchor(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return { success: true, method: 'download', filePath: filename };
}

/**
 * @param {Blob} blob
 * @param {string} filename e.g. SC02_SH03.png
 * @param {{ preferPicker?: boolean }} [opts]
 */
export async function saveExportBlob(blob, filename, opts = {}) {
  const parts = String(filename || 'export.bin').split('.');
  const ext = parts.length > 1 ? parts.pop() : 'bin';
  const name = `${sanitizeStem(parts.join('.'))}.${ext}`;
  const preferPicker = opts.preferPicker !== false;

  const api = typeof window !== 'undefined' ? window.electronAPI : null;
  if (api?.isElectron && typeof api.saveBinaryFile === 'function') {
    try {
      const result = await api.saveBinaryFile(name, blob, {
        filters: extFilters(name),
        defaultDir: getRememberedExportDir() || undefined
      });
      if (result?.canceled) return { success: false, canceled: true };
      if (result?.success) {
        rememberExportDir(result.filePath);
        return { success: true, method: 'electron', filePath: result.filePath };
      }
    } catch (err) {
      console.warn('electron saveBinaryFile failed', err);
    }
  }

  if (preferPicker && typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function') {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: name,
        types: acceptTypes(name)
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { success: true, method: 'fs-access', filePath: handle.name || name };
    } catch (err) {
      if (err?.name === 'AbortError') return { success: false, canceled: true };
      console.warn('showSaveFilePicker failed, falling back', err);
    }
  }

  return downloadViaAnchor(blob, name);
}
