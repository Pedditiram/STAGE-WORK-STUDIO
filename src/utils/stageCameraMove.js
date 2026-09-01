/**
 * Camera moves for Director Stage (spec §13).
 * Each move stores start, end, duration, speed, easing, target.
 */

export const CAMERA_MOVE_SIMPLE = [
  { id: 'static', label: 'Hold' },
  { id: 'push', label: 'Push in' },
  { id: 'pull', label: 'Pull out' },
  { id: 'pan', label: 'Pan' },
  { id: 'orbit', label: 'Orbit' }
];

export const CAMERA_MOVE_PRO = [
  { id: 'static', label: 'Static' },
  { id: 'pan', label: 'Pan' },
  { id: 'tilt', label: 'Tilt' },
  { id: 'push', label: 'Dolly in' },
  { id: 'pull', label: 'Dolly out' },
  { id: 'truck_left', label: 'Truck L' },
  { id: 'truck_right', label: 'Truck R' },
  { id: 'crane', label: 'Crane up' },
  { id: 'crane_down', label: 'Crane down' },
  { id: 'orbit', label: 'Orbit' },
  { id: 'tracking', label: 'Tracking' },
  { id: 'follow', label: 'Follow' },
  { id: 'handheld', label: 'Handheld' }
];

export const CAMERA_MOVE_IDS = CAMERA_MOVE_PRO.map((m) => m.id);

const EASING = ['linear', 'easeIn', 'easeOut', 'easeInOut'];

export function cameraMoveEasingOptions() {
  return EASING;
}

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
function scale(a, s) {
  return [a[0] * s, a[1] * s, a[2] * s];
}
function len(a) {
  return Math.hypot(a[0], a[1], a[2]) || 1;
}
function norm(a) {
  const l = len(a);
  return [a[0] / l, a[1] / l, a[2] / l];
}
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

export function easeCamera(u, easing = 'easeInOut') {
  const t = Math.min(1, Math.max(0, u));
  if (easing === 'linear') return t;
  if (easing === 'easeIn') return t * t;
  if (easing === 'easeOut') return 1 - (1 - t) * (1 - t);
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
}

function lerp3(a, b, u) {
  return [
    a[0] + (b[0] - a[0]) * u,
    a[1] + (b[1] - a[1]) * u,
    a[2] + (b[2] - a[2]) * u
  ];
}

function rotateYAround(point, origin, radians) {
  const x = point[0] - origin[0];
  const z = point[2] - origin[2];
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return [origin[0] + x * c - z * s, point[1], origin[2] + x * s + z * c];
}

export function normalizeMoveType(type) {
  const t = String(type || 'static').toLowerCase().replace(/[\s-]+/g, '_');
  if (t === 'dolly' || t === 'dolly_in' || t === 'push_in') return 'push';
  if (t === 'dolly_out' || t === 'pull_out') return 'pull';
  if (t === 'hold' || t === 'locked' || t === 'tripod') return 'static';
  if (CAMERA_MOVE_IDS.includes(t)) return t;
  if (['orbit', 'pan', 'crane', 'static'].includes(t)) return t;
  return 'static';
}

export function defaultMoveEndpoints(cam = {}, type = 'static') {
  const pos = Array.isArray(cam.position) ? [...cam.position] : [-2.2, 1.35, 3.2];
  const look = Array.isArray(cam.lookAt) ? [...cam.lookAt] : [0, 1.2, 0];
  const forward = norm(sub(look, pos));
  const right = norm(cross(forward, [0, 1, 0]));
  const move = normalizeMoveType(type);
  let to = [...pos];
  let endLook = [...look];
  if (move === 'push' || move === 'tracking' || move === 'follow') to = add(pos, scale(forward, 1.65));
  else if (move === 'pull') to = add(pos, scale(forward, -1.65));
  else if (move === 'truck_left') to = add(pos, scale(right, -1.4));
  else if (move === 'truck_right') to = add(pos, scale(right, 1.4));
  else if (move === 'crane') to = [pos[0], pos[1] + 1.35, pos[2]];
  else if (move === 'crane_down') to = [pos[0], Math.max(0.35, pos[1] - 1.1), pos[2]];
  else if (move === 'pan') endLook = rotateYAround(look, pos, 0.55);
  else if (move === 'tilt') endLook = [look[0], look[1] + 0.85, look[2]];
  else if (move === 'handheld') to = add(pos, scale(forward, 0.35));
  return { from: pos, to, startLook: look, endLook, target: look };
}

export function applyCameraMoveType(cam = {}, type, durationSec = 5) {
  const move = normalizeMoveType(type);
  const ends = defaultMoveEndpoints(cam, move);
  const radius = Math.hypot(cam.position?.[0] || 0, cam.position?.[2] || 3.4) || 3.4;
  return {
    type: move,
    duration: durationSec,
    speed: 1,
    easing: 'easeInOut',
    target: ends.target,
    from: ends.from,
    to: ends.to,
    startLook: ends.startLook,
    endLook: ends.endLook,
    radius,
    height: cam.position?.[1] ?? 1.35,
    revolutions: move === 'orbit' ? 0.35 : 0
  };
}

export function evalCameraMove(camPlan, t, durationSec) {
  const anim = camPlan.animation || { type: 'static' };
  const type = normalizeMoveType(anim.type);
  const dur = Math.max(0.1, Number(anim.duration || durationSec) || 5) / Math.max(0.25, Number(anim.speed) || 1);
  const u = easeCamera((durationSec > 0 ? t / dur : 0), anim.easing || 'easeInOut');
  const base = anim.from || camPlan.position || [-2, 1.4, 3];
  const look = anim.startLook || anim.target || camPlan.lookAt || [0, 1.2, 0];
  const to = anim.to || base;
  const endLook = anim.endLook || look;

  if (type === 'orbit') {
    const radius = anim.radius ?? (Math.hypot(base[0], base[2]) || 3.4);
    const height = anim.height ?? base[1];
    const revs = anim.revolutions ?? 0.35;
    const startAng = Math.atan2(base[2], base[0]);
    const ang = startAng + revs * Math.PI * 2 * u;
    return {
      position: [Math.cos(ang) * radius, height, Math.sin(ang) * radius],
      lookAt: [...look],
      rotation: [0, 0, 0]
    };
  }

  if (type === 'pan' || type === 'tilt') {
    return {
      position: [...base],
      lookAt: lerp3(look, endLook, u),
      rotation: [0, 0, 0]
    };
  }

  let position = lerp3(base, to, u);
  let lookAt = type === 'handheld' ? lerp3(look, endLook, u) : [...look];
  if (type === 'handheld') {
    const w = t * 9.4;
    position = add(position, [Math.sin(w) * 0.045, Math.sin(w * 1.7) * 0.03, Math.cos(w * 0.9) * 0.04]);
    lookAt = add(lookAt, [Math.sin(w * 1.3) * 0.04, Math.cos(w) * 0.03, 0]);
  }

  return { position, lookAt, rotation: [0, 0, 0] };
}
