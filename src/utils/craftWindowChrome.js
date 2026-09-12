/** Shared craft editor window size — all SlotEditors follow one preference. */

export const CRAFT_FULLSCREEN_KEY = 'sps_slot_editor_fullscreen';
export const CRAFT_WINDOW_EVENT = 'sps_craft_window_chrome';

export function readCraftFullscreen() {
  if (typeof window === 'undefined') return false;
  try {
    if (document.fullscreenElement || document.webkitFullscreenElement) return true;
    return localStorage.getItem(CRAFT_FULLSCREEN_KEY) === 'true';
  } catch {
    return false;
  }
}

export function writeCraftFullscreen(enabled) {
  if (typeof window === 'undefined') return;
  const next = Boolean(enabled);
  try {
    localStorage.setItem(CRAFT_FULLSCREEN_KEY, next ? 'true' : 'false');
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent(CRAFT_WINDOW_EVENT, { detail: { fullscreen: next } }));
  } catch {
    /* ignore */
  }
}

export async function applyBrowserFullscreen(enable) {
  if (typeof document === 'undefined') return;
  try {
    if (enable) {
      const elem = document.documentElement;
      if (elem.requestFullscreen) await elem.requestFullscreen();
      else if (elem.webkitRequestFullscreen) await elem.webkitRequestFullscreen();
    } else if (document.fullscreenElement || document.webkitFullscreenElement) {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
    }
  } catch {
    /* ignore */
  }
}
