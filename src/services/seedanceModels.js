/**
 * P16 — Seedance / BytePlus model picker (Generate desk parity with Replicate).
 * Persists to the same keys as Settings → API keys (sps_byteplus_*).
 */

const STILL_MODEL_KEY = 'sps_byteplus_model_id';
const VIDEO_MODEL_KEY = 'sps_byteplus_video_model_id';

const DEFAULT_STILL_MODEL = 'seed-2-0-pro-260328';
const DEFAULT_VIDEO_MODEL = 'seedance-1-0-pro-250528';

export const SEEDANCE_STILL_MODELS = Object.freeze([
  { id: 'seed-2-0-pro-260328', label: 'Seed 2.0 Pro (default)' },
  { id: 'seed-1-6-vision-250615', label: 'Seed 1.6 Vision' },
  { id: 'seed-1-6-flash-250615', label: 'Seed 1.6 Flash' }
]);

export const SEEDANCE_VIDEO_MODELS = Object.freeze([
  { id: 'seedance-1-0-pro-250528', label: 'Seedance 1.0 Pro (default)' },
  { id: 'seedance-1-0-lite-250528', label: 'Seedance 1.0 Lite' },
  { id: 'dreamina-seedance-2-0-260128', label: 'Seedance 2.0 (Comfy master)' },
  { id: 'dreamina-seedance-2-0-fast-260128', label: 'Seedance 2.0 Fast (Comfy)' }
]);

function pickListedModel(raw, list, fallback) {
  const id = String(raw || '').trim();
  if (list.some((m) => m.id === id)) return id;
  return fallback;
}

export function getSeedanceStillModel() {
  if (typeof window === 'undefined') return DEFAULT_STILL_MODEL;
  try {
    return pickListedModel(localStorage.getItem(STILL_MODEL_KEY), SEEDANCE_STILL_MODELS, DEFAULT_STILL_MODEL);
  } catch {
    return DEFAULT_STILL_MODEL;
  }
}

export function setSeedanceStillModel(modelId) {
  const id = pickListedModel(modelId, SEEDANCE_STILL_MODELS, DEFAULT_STILL_MODEL);
  try {
    localStorage.setItem(STILL_MODEL_KEY, id);
    window.dispatchEvent(new CustomEvent('sps_seedance_models_changed'));
  } catch {
    /* ignore */
  }
  return id;
}

export function getSeedanceVideoModel() {
  if (typeof window === 'undefined') return DEFAULT_VIDEO_MODEL;
  try {
    return pickListedModel(localStorage.getItem(VIDEO_MODEL_KEY), SEEDANCE_VIDEO_MODELS, DEFAULT_VIDEO_MODEL);
  } catch {
    return DEFAULT_VIDEO_MODEL;
  }
}

export function setSeedanceVideoModel(modelId) {
  const id = pickListedModel(modelId, SEEDANCE_VIDEO_MODELS, DEFAULT_VIDEO_MODEL);
  try {
    localStorage.setItem(VIDEO_MODEL_KEY, id);
    window.dispatchEvent(new CustomEvent('sps_seedance_models_changed'));
  } catch {
    /* ignore */
  }
  return id;
}
