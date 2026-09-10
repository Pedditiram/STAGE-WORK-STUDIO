/**
 * Web production: compare the JS bundle's build stamp to /sws-build.json.
 * Local Vite / Electron stay on their own build — no nag.
 */

import { isLocalStudioHost } from './runtimeEnv';

export const STUDIO_BOOT_BUILD_ID = String(import.meta.env.VITE_SWS_BUILD_ID || '');

const SNOOZE_KEY = 'sps_studio_update_snooze';

export function shouldWatchStudioUpdates() {
  if (typeof window === 'undefined') return false;
  if (import.meta.env?.DEV) return false;
  if (isLocalStudioHost()) return false;
  return Boolean(STUDIO_BOOT_BUILD_ID && STUDIO_BOOT_BUILD_ID !== 'dev');
}

export async function fetchStudioServerBuildId() {
  const res = await fetch(`/sws-build.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) return '';
  const data = await res.json().catch(() => null);
  return String(data?.buildId || '').trim();
}

export function isStudioUpdateSnoozed(serverBuildId) {
  try {
    return sessionStorage.getItem(SNOOZE_KEY) === String(serverBuildId || '');
  } catch {
    return false;
  }
}

export function snoozeStudioUpdate(serverBuildId) {
  try {
    sessionStorage.setItem(SNOOZE_KEY, String(serverBuildId || ''));
  } catch {
    /* ignore */
  }
}

export function reloadStudioForUpdate() {
  const url = new URL(window.location.href);
  url.searchParams.set('_sws', String(Date.now()));
  window.location.assign(url.toString());
}
