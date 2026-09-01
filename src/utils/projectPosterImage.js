/** Studio project library poster — 4:5 portrait (width : height). */
export const PROJECT_POSTER_ASPECT = 4 / 5;
export const PROJECT_POSTER_WIDTH = 1080;
export const PROJECT_POSTER_HEIGHT = 1350;

const ASPECT_TOLERANCE = 0.04;

export function isPosterAspectRatio(width, height) {
  if (!width || !height) return false;
  const ratio = width / height;
  return Math.abs(ratio - PROJECT_POSTER_ASPECT) <= ASPECT_TOLERANCE;
}

/**
 * Center-crop + resize to 4:5 PNG for vault + PROJECT/Posters mirror.
 */
export function optimizePosterDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const src = String(dataUrl || '');
    if (!src.startsWith('data:image/')) {
      reject(new Error('Poster must be an image data URL'));
      return;
    }
    const img = new Image();
    img.onload = () => {
      try {
        const targetW = PROJECT_POSTER_WIDTH;
        const targetH = PROJECT_POSTER_HEIGHT;
        const targetAspect = PROJECT_POSTER_ASPECT;
        const srcW = img.naturalWidth || img.width;
        const srcH = img.naturalHeight || img.height;
        if (!srcW || !srcH) {
          reject(new Error('Could not read poster dimensions'));
          return;
        }
        const srcAspect = srcW / srcH;
        let sx = 0;
        let sy = 0;
        let sw = srcW;
        let sh = srcH;
        if (srcAspect > targetAspect) {
          sh = srcH;
          sw = srcH * targetAspect;
          sx = (srcW - sw) / 2;
        } else if (srcAspect < targetAspect) {
          sw = srcW;
          sh = srcW / targetAspect;
          sy = (srcH - sh) / 2;
        }
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas unavailable'));
          return;
        }
        ctx.fillStyle = '#161412';
        ctx.fillRect(0, 0, targetW, targetH);
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
        resolve(canvas.toDataURL('image/png', 0.92));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Could not load poster image'));
    img.src = src;
  });
}
