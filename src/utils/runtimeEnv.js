/** Local Vite / Electron / LAN — not production host. */
export function isLocalStudioHost() {
  if (typeof window === 'undefined') return true;
  try {
    if (import.meta.env?.DEV) return true;
    if (window.electronAPI?.isElectron) return true;
    const host = String(window.location.hostname || '').toLowerCase();
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '[::1]' ||
      host.endsWith('.local') ||
      host.startsWith('192.168.') ||
      host.startsWith('10.') ||
      window.location.protocol === 'file:'
    );
  } catch {
    return false;
  }
}

/**
 * Shell only — never treat as collab identity.
 * Electron and localhost browser are the same studio user when signed in as the same email.
 * "Remote" = other people in a cloud room, not Chrome vs desktop.
 */
export function getStudioShell() {
  if (typeof window === 'undefined') return 'server';
  try {
    if (window.electronAPI?.isElectron) return 'electron';
  } catch {
    /* ignore */
  }
  return 'browser';
}

/** Native FS helpers (folder picker, version writes, Comfy proxy) — Electron only. */
export function hasNativeStudioFs() {
  return getStudioShell() === 'electron';
}

export const APP_VERSION = '1.0.0';
export const BUILD_YEAR = 2026;

const PRODUCTION_ORIGIN = 'https://www.stageworkstudio.com';

/** Same-origin /api on Vite/Vercel; Vercel origin from the packaged Electron file:// app. */
export function studioApiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  if (typeof window === 'undefined') return `${PRODUCTION_ORIGIN}${p}`;
  try {
    if (window.location.protocol === 'file:') return `${PRODUCTION_ORIGIN}${p}`;
  } catch {
    /* ignore */
  }
  return p;
}
