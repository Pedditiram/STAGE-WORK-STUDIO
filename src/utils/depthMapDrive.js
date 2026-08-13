/**
 * Local-only depth-map video → motion samples (never uploaded).
 * Reads a File/Blob from disk, samples luminance as depth, returns keyframes.
 */

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

/**
 * Sample mean luminance (0..1) from a video frame ROI.
 * Convention: brighter = closer (invert if your map is the opposite).
 */
export function sampleDepthFromCanvas(ctx, w, h, { invert = false, roi = 0.35 } = {}) {
  const rw = Math.max(4, Math.floor(w * roi));
  const rh = Math.max(4, Math.floor(h * roi));
  const sx = Math.floor((w - rw) / 2);
  const sy = Math.floor((h - rh) / 2);
  const { data } = ctx.getImageData(sx, sy, rw, rh);
  let sum = 0;
  const n = rw * rh;
  for (let i = 0; i < data.length; i += 4) {
    sum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
  }
  let d = sum / Math.max(1, n);
  if (invert) d = 1 - d;
  return clamp(d, 0, 1);
}

/**
 * Map depth 0..1 onto a mannequin world offset / pose blend.
 */
export function depthToMotion(depth, base = { position: [0, 0, 0], rotationY: 0 }, opts = {}) {
  const strength = opts.strength ?? 1.2;
  const axis = opts.axis || 'z'; // camera-facing depth usually Z in stage
  const pos = [...(base.position || [0, 0, 0])];
  const near = opts.near ?? -strength;
  const far = opts.far ?? strength;
  const delta = near + (far - near) * depth;
  if (axis === 'z') pos[2] = (base.position?.[2] ?? 0) + delta;
  else if (axis === 'x') pos[0] = (base.position?.[0] ?? 0) + delta;
  else if (axis === 'y') pos[1] = Math.max(0, (base.position?.[1] ?? 0) + delta * 0.35);

  // Mild walk-cycle pose from depth velocity proxy (static sample)
  const lean = (depth - 0.5) * 0.35;
  const pose = {
    ...(base.pose || {}),
    spine: lean * 0.4,
    thighLX: -lean * 0.6,
    thighRX: lean * 0.55,
    upperArmLZ: -lean * 0.4,
    upperArmRZ: lean * 0.4
  };
  return {
    position: pos,
    rotation: [0, base.rotationY || base.rotation?.[1] || 0, 0],
    pose
  };
}

/**
 * Load a local video File, scrub through duration, return [{ t, depth, ...motion }].
 * Entirely in-memory / blob URL — nothing leaves the machine.
 */
export async function bakeDepthMotionFromVideo(file, humanBase, {
  durationSec = 5,
  samples = 24,
  invert = false,
  strength = 1.2,
  axis = 'z',
  onProgress
} = {}) {
  if (!file) throw new Error('No depth video file');
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;

  await new Promise((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error('Could not read local depth video'));
  });

  const canvas = document.createElement('canvas');
  const maxW = 320;
  const vw = video.videoWidth || 320;
  const vh = video.videoHeight || 180;
  const scale = Math.min(1, maxW / vw);
  canvas.width = Math.max(32, Math.round(vw * scale));
  canvas.height = Math.max(18, Math.round(vh * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const vidDur = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : durationSec;
  const dur = Math.min(durationSec, vidDur);
  const n = Math.max(4, Math.min(60, samples));
  const keys = [];

  const seek = (t) => new Promise((resolve) => {
    const onSeek = () => {
      video.removeEventListener('seeked', onSeek);
      resolve();
    };
    video.addEventListener('seeked', onSeek);
    video.currentTime = Math.min(vidDur - 0.05, Math.max(0, t));
  });

  try {
    for (let i = 0; i < n; i++) {
      const t = (i / Math.max(1, n - 1)) * dur;
      await seek(t);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const depth = sampleDepthFromCanvas(ctx, canvas.width, canvas.height, { invert });
      const motion = depthToMotion(depth, humanBase, { strength, axis });
      keys.push({
        t,
        depth,
        position: motion.position,
        rotation: motion.rotation,
        pose: motion.pose
      });
      onProgress?.(i / n, depth);
    }
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute('src');
    video.load();
  }

  return keys;
}

/**
 * Live sample helper for an already-loaded local video element.
 */
export function liveDepthFromVideo(video, canvas, ctx, opts = {}) {
  if (!video || video.readyState < 2) return null;
  const w = canvas.width;
  const h = canvas.height;
  ctx.drawImage(video, 0, 0, w, h);
  return sampleDepthFromCanvas(ctx, w, h, opts);
}
