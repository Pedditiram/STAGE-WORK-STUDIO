/**
 * Pitch stills stay on this machine (IndexedDB + optional disk poster write).
 * Collab copies the same bytes onto the other user's local store — not a cloud CDN.
 * Generated / placed stills must be at least 1 MB.
 */

import { putImageDataUrl, resolveImageUrl } from './imageBlobStore';
import { saveProjectPoster } from '../services/projectDiskVault';
import { slugProjectTitle } from './projectWorkspace';

export const PITCH_STILL_MIN_BYTES = 1024 * 1024;

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode still'));
    img.src = src;
  });
}

/**
 * Upscale / re-encode until the still is ≥ 1 MB. JPEG first, PNG if still short.
 */
export async function ensurePitchStillMinBytes(dataUrl, { minW = 1920, minH = 1080 } = {}) {
  const src = String(dataUrl || '');
  if (!src.startsWith('data:image/')) return src;
  const img = await loadImage(src);
  let w = Math.max(minW, img.naturalWidth || img.width || minW);
  let h = Math.max(minH, img.naturalHeight || img.height || minH);
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  if (srcW && srcH) {
    const scale = Math.max(w / srcW, h / srcH, 1);
    w = Math.round(srcW * scale);
    h = Math.round(srcH * scale);
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return src;

  const encode = async (width, height, type, quality) => {
    canvas.width = width;
    canvas.height = height;
    ctx.fillStyle = '#161412';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const url = canvas.toDataURL(type, quality);
    const blob = await (await fetch(url)).blob();
    return { url, size: blob.size, blob };
  };

  let width = w;
  let height = h;
  let best = await encode(width, height, 'image/jpeg', 0.95);
  for (let i = 0; i < 6 && best.size < PITCH_STILL_MIN_BYTES; i += 1) {
    width = Math.round(width * 1.25);
    height = Math.round(height * 1.25);
    best = await encode(width, height, 'image/jpeg', 0.98);
  }
  if (best.size < PITCH_STILL_MIN_BYTES) {
    best = await encode(width, height, 'image/png');
  }
  return best.url;
}

export async function persistPitchStill({
  projectTitle = 'Project',
  slideId = 'slide',
  index = 0,
  dataUrl = ''
} = {}) {
  const heavy = await ensurePitchStillMinBytes(dataUrl);
  const id = `pitch_${slugProjectTitle(projectTitle)}_${String(slideId).replace(/[^\w\-]+/g, '_')}_${index}`;
  const ref = await putImageDataUrl(id, heavy);
  try {
    await saveProjectPoster({
      title: `${String(projectTitle || 'Project').trim()} pitch ${slideId} ${index + 1}`,
      id,
      dataUrl: heavy
    });
  } catch {
    /* disk write is best-effort; IndexedDB still holds the still */
  }
  return { ref, dataUrl: heavy, id };
}

export function pitchStillSrc(value) {
  return resolveImageUrl(value) || (typeof value === 'string' ? value : '');
}

export async function readLocalImageFile(file) {
  if (!file) return '';
  const url = await blobToDataUrl(file);
  return ensurePitchStillMinBytes(url);
}
