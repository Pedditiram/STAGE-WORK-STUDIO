/** Cinematic lens math for Director Stage (spec §10–12). Full-frame default 36mm sensor. */

export const STAGE_FOCAL_PRESETS = [14, 18, 24, 28, 35, 40, 50, 65, 85, 100, 135, 200];
export const STAGE_SENSOR_PRESETS = [
  { id: 'ff', label: 'FF 36mm', widthMm: 36 },
  { id: 's35', label: 'S35 24.9mm', widthMm: 24.89 }
];
export const STAGE_APERTURE_PRESETS = [1.4, 1.8, 2.0, 2.8, 4.0, 5.6, 8.0, 11, 16, 22];

export function clampLens(n, lo, hi) {
  const x = Number(n);
  if (!Number.isFinite(x)) return lo;
  return Math.min(hi, Math.max(lo, x));
}

export function focalMmToFov(focalMm, sensorWidthMm = 36) {
  const f = Math.max(8, Number(focalMm) || 35);
  const s = Math.max(8, Number(sensorWidthMm) || 36);
  return (2 * Math.atan(s / (2 * f)) * 180) / Math.PI;
}

export function distance3(a = [0, 0, 0], b = [0, 0, 0]) {
  const dx = (a[0] || 0) - (b[0] || 0);
  const dy = (a[1] || 0) - (b[1] || 0);
  const dz = (a[2] || 0) - (b[2] || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Shot size from camera-to-subject + focal (not a label the director typed).
 */
export function estimateShotSize({
  distanceM,
  focalMm = 35,
  sensorWidthMm = 36,
  subjectHeightM = 1.7
} = {}) {
  const dist = Math.max(0.25, Number(distanceM) || 3);
  const fill = (Math.max(8, focalMm) / Math.max(8, sensorWidthMm)) * (subjectHeightM / dist);
  if (fill >= 1.2) return 'Extreme Close-Up';
  if (fill >= 0.58) return 'Close-Up';
  if (fill >= 0.38) return 'Medium Close-Up';
  if (fill >= 0.24) return 'Medium';
  if (fill >= 0.17) return 'Medium Full';
  if (fill >= 0.12) return 'Full';
  if (fill >= 0.06) return 'Wide';
  return 'Extreme Wide';
}

export function focusDistanceFromLookAt(position = [0, 0, 0], lookAt = [0, 1.2, 0]) {
  return clampLens(distance3(position, lookAt), 0.3, 80);
}
