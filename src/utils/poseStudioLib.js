/**
 * Pose studio helpers — PoseMy-class posing utilities for Stage Production Studio.
 * Superior merge: production shot workflow + artist poser toolkit.
 */

import { defaultPose, normalizePose, POSE_PRESETS } from './mannequinPose';

/** Body / silhouette types (scale + color language — no external assets). */
export const BODY_TYPES = [
  { id: 'drawing', label: 'Classic', scale: [1, 1, 1], color: '#e8b84a' },
  { id: 'athletic', label: 'Athletic', scale: [1.05, 1.02, 1.08], color: '#e8b84a' },
  { id: 'muscular', label: 'Muscular', scale: [1.12, 1.04, 1.15], color: '#e0a830' },
  { id: 'slim', label: 'Slim', scale: [0.9, 1.05, 0.88], color: '#f0c86a' },
  { id: 'stocky', label: 'Stocky', scale: [1.18, 0.94, 1.12], color: '#d4a020' },
  { id: 'teen', label: 'Teen', scale: [0.85, 0.88, 0.85], color: '#e8b84a' },
  { id: 'child', label: 'Child', scale: [0.62, 0.65, 0.62], color: '#f0c86a' },
  { id: 'hero', label: 'Hero tall', scale: [1.08, 1.12, 1.08], color: '#e8b84a' },
  { id: 'stick', label: 'Stick study', scale: [0.72, 1.05, 0.72], color: '#e8b84a' },
  { id: 'block', label: 'Mass block', scale: [1.22, 1, 1.22], color: '#d4a020' }
];

/** Hand / gesture overlays (mapped onto arm joints). */
export const HAND_PRESETS = {
  relaxed: { lowerArmL: 0.35, lowerArmR: 0.35, upperArmLX: 0, upperArmRX: 0 },
  fist: { lowerArmL: 1.35, lowerArmR: 1.35, upperArmLX: 0.15, upperArmRX: 0.15 },
  open_palm: { lowerArmL: 0.15, lowerArmR: 0.15, upperArmLX: -0.2, upperArmRX: -0.2 },
  point: { lowerArmR: 0.2, upperArmRX: -1.55, upperArmRZ: -0.15, headY: 0.2 },
  peace: { lowerArmR: 0.55, upperArmRX: -1.2, upperArmRZ: -0.35 },
  hold_object: { lowerArmL: 1.1, lowerArmR: 1.1, upperArmLX: 0.45, upperArmRX: 0.45 },
  hands_up: { upperArmLX: -2.2, upperArmRX: -2.2, lowerArmL: 0.2, lowerArmR: 0.2 },
  prayer: { upperArmLX: -0.4, upperArmRX: -0.4, lowerArmL: 1.6, lowerArmR: 1.6, chest: 0.05 },
  phone: { lowerArmR: 1.5, upperArmRX: -0.85, upperArmRZ: -0.55, headY: -0.25, headX: 0.15 },
  crossed: {
    upperArmLX: -0.55,
    upperArmLZ: 0.35,
    lowerArmL: 1.7,
    upperArmRX: -0.55,
    upperArmRZ: -0.35,
    lowerArmR: 1.7
  }
};

/** Extra cinematic / story poses beyond base POSE_PRESETS. */
export const STUDIO_POSE_PRESETS = {
  ...Object.fromEntries(Object.entries(POSE_PRESETS).map(([k, fn]) => [k, fn])),
  fight_guard: () => ({
    ...defaultPose(),
    upperArmLX: -1.1,
    upperArmLZ: 0.55,
    lowerArmL: 1.4,
    upperArmRX: -0.9,
    upperArmRZ: -0.7,
    lowerArmR: 1.2,
    thighLX: -0.35,
    thighRX: 0.25,
    spine: 0.12,
    headY: 0.2
  }),
  kneel: () => ({
    ...defaultPose(),
    thighLX: -1.4,
    shinL: 2.0,
    thighRX: -0.35,
    shinR: 0.2,
    spine: 0.15,
    upperArmLX: 0.2,
    lowerArmL: 0.8
  }),
  run_pose: () => ({
    ...defaultPose(),
    thighLX: -0.95,
    shinL: 0.7,
    thighRX: 0.85,
    shinR: 0.2,
    upperArmLZ: -1.0,
    upperArmRZ: 0.95,
    spine: -0.1,
    chest: 0.12
  }),
  lean_wall: () => ({
    ...defaultPose(),
    spine: 0.25,
    chest: 0.15,
    upperArmLX: -0.3,
    lowerArmL: 1.2,
    thighLX: -0.2,
    thighRX: 0.15
  }),
  bow: () => ({
    ...defaultPose(),
    spine: 0.85,
    chest: 0.35,
    headX: 0.4,
    upperArmLX: 0.3,
    upperArmRX: 0.3
  }),
  arms_crossed: () => ({ ...defaultPose(), ...HAND_PRESETS.crossed }),
  surrender: () => ({ ...defaultPose(), ...HAND_PRESETS.hands_up, headX: 0.1 })
};

const MIRROR_PAIRS = [
  ['upperArmLX', 'upperArmRX'],
  ['upperArmLZ', 'upperArmRZ'],
  ['lowerArmL', 'lowerArmR'],
  ['thighLX', 'thighRX'],
  ['shinL', 'shinR']
];

/** Mirror left↔right joint values (PoseMy Mirror Limb). */
export function mirrorPose(poseIn) {
  const p = normalizePose(poseIn);
  const out = { ...p };
  MIRROR_PAIRS.forEach(([a, b]) => {
    const av = out[a];
    const bv = out[b];
    // Z axes flip sign when mirrored
    if (a.endsWith('Z') || b.endsWith('Z')) {
      out[a] = -bv;
      out[b] = -av;
    } else {
      out[a] = bv;
      out[b] = av;
    }
  });
  out.headY = -(out.headY || 0);
  return normalizePose(out);
}

/** Copy pose onto another human entry (character swap / pose transfer). */
export function transferPose(fromHuman, toHuman) {
  if (!fromHuman || !toHuman) return toHuman;
  return {
    ...toHuman,
    pose: normalizePose(fromHuman.pose || defaultPose()),
    rotationY: fromHuman.rotationY ?? fromHuman.rotation?.[1] ?? toHuman.rotationY,
    rotation: fromHuman.rotation
      ? [...fromHuman.rotation]
      : toHuman.rotation
  };
}

export function applyHandPreset(poseIn, handId, side = 'both') {
  const base = normalizePose(poseIn);
  const hand = HAND_PRESETS[handId] || HAND_PRESETS.relaxed;
  const patch = {};
  Object.entries(hand).forEach(([k, v]) => {
    if (side === 'L' && /R$|RX|RZ/.test(k) && !/head|chest|spine/.test(k)) return;
    if (side === 'R' && /L$|LX|LZ/.test(k) && !/head|chest|spine/.test(k)) return;
    patch[k] = v;
  });
  return normalizePose({ ...base, ...patch });
}

export function applyBodyType(human, bodyId) {
  const bt = BODY_TYPES.find((b) => b.id === bodyId) || BODY_TYPES[0];
  return {
    ...human,
    bodyType: bt.id,
    scale: [...bt.scale],
    color: human.color || bt.color
  };
}

/** Scene prop primitives for quick set dressing. */
export const PROP_PRESETS = [
  { id: 'cube', label: 'Cube', geo: 'box', size: [0.6, 0.6, 0.6], color: '#38bdf8' },
  { id: 'crate', label: 'Crate', geo: 'box', size: [0.8, 0.8, 0.8], color: '#92400e' },
  { id: 'cylinder', label: 'Column', geo: 'cylinder', size: [0.25, 1.4], color: '#94a3b8' },
  { id: 'sphere', label: 'Sphere', geo: 'sphere', size: [0.35], color: '#a78bfa' },
  { id: 'plane', label: 'Wall', geo: 'plane', size: [2.4, 2.0], color: '#64748b' },
  { id: 'table', label: 'Table', geo: 'box', size: [1.4, 0.08, 0.8], y: 0.75, color: '#78350f' },
  { id: 'chair', label: 'Block seat', geo: 'box', size: [0.45, 0.45, 0.45], color: '#44403c' }
];
