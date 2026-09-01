/**
 * Eye / head / body direction (spec §7). Tracked separately. Look ≠ walk.
 */

const EYE_H = 1.55;

export const EYE_TARGET_SIMPLE = [
  { id: 'hold', label: 'Hold' },
  { id: 'costar', label: 'Co-star' },
  { id: 'camera', label: 'Camera' }
];

export const EYE_TARGET_PRO = [
  { id: 'hold', label: 'Hold' },
  { id: 'costar', label: 'Co-star' },
  { id: 'camera', label: 'Camera' },
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
  { id: 'down', label: 'Down' },
  { id: 'prop', label: 'Prop' },
  { id: 'custom', label: 'Custom' }
];

export const HEAD_DIRECTION_PRO = [
  { id: 'follow_eyes', label: 'Follow' },
  { id: 'hold', label: 'Hold' }
];

export const BODY_DIRECTION_PRO = [
  { id: 'hold', label: 'Hold' },
  { id: 'camera', label: 'Camera' },
  { id: 'costar', label: 'Co-star' }
];

function clamp(n, lo, hi) {
  const x = Number(n);
  if (!Number.isFinite(x)) return lo;
  return Math.min(hi, Math.max(lo, x));
}

function wrapPi(a) {
  let x = a;
  while (x > Math.PI) x -= Math.PI * 2;
  while (x < -Math.PI) x += Math.PI * 2;
  return x;
}

function gazeText(shot = {}) {
  return [
    shot.characterEyeLooks,
    shot.coArtistInteraction,
    shot.action,
    shot.actionEnvContext,
    shot.characterPlacement,
    shot.blocking
  ]
    .map((s) => String(s || ''))
    .join(' ')
    .toLowerCase();
}

function otherHuman(human, humans = []) {
  return humans.find((h) => h && h.id !== human.id) || humans.find((h) => h !== human) || null;
}

function namedHuman(humans, text, self) {
  const blob = String(text || '').toLowerCase();
  return (humans || []).find((h) => {
    if (!h || h === self) return false;
    const id = String(h.id || '').toLowerCase();
    const asset = String(h.charAssetId || '').toLowerCase();
    if (id && blob.includes(id)) return true;
    if (asset && blob.includes(asset.toLowerCase())) return true;
    const token = id.replace(/^char[_-]?/i, '').trim();
    return token.length > 2 && blob.includes(token);
  }) || null;
}

export function defaultGaze() {
  return {
    eyeTarget: 'hold',
    eyeTargetId: '',
    headDirection: 'follow_eyes',
    bodyDirection: 'hold',
    customPoint: [0, 1.55, 2],
    inferred: false,
    needsDirection: true
  };
}

export function normalizeGaze(gaze) {
  const g = gaze && typeof gaze === 'object' ? gaze : {};
  const eyeTarget = EYE_TARGET_PRO.some((t) => t.id === g.eyeTarget) ? g.eyeTarget : 'hold';
  const headDirection = HEAD_DIRECTION_PRO.some((t) => t.id === g.headDirection)
    ? g.headDirection
    : 'follow_eyes';
  const bodyDirection = BODY_DIRECTION_PRO.some((t) => t.id === g.bodyDirection)
    ? g.bodyDirection
    : 'hold';
  return {
    eyeTarget,
    eyeTargetId: String(g.eyeTargetId || ''),
    headDirection,
    bodyDirection,
    customPoint: Array.isArray(g.customPoint)
      ? [
          clamp(g.customPoint[0], -12, 12),
          clamp(g.customPoint[1], 0, 6),
          clamp(g.customPoint[2], -12, 12)
        ]
      : [0, 1.55, 2],
    inferred: !!g.inferred,
    needsDirection: g.needsDirection != null ? !!g.needsDirection : eyeTarget === 'hold'
  };
}

export function applyEyeHeadType(human, eyeTarget, extras = {}) {
  const prev = normalizeGaze(human?.gaze);
  return normalizeGaze({
    ...prev,
    eyeTarget: eyeTarget || prev.eyeTarget,
    eyeTargetId: extras.eyeTargetId != null ? extras.eyeTargetId : prev.eyeTargetId,
    headDirection: extras.headDirection || prev.headDirection,
    bodyDirection: extras.bodyDirection || prev.bodyDirection,
    customPoint: extras.customPoint || prev.customPoint,
    inferred: false,
    needsDirection: (eyeTarget || prev.eyeTarget) === 'hold'
  });
}

/**
 * Parse prompt/craft into gaze. Never infers a walk from a look.
 */
export function inferEyeHead(shot = {}, humanIndex = 0, humans = []) {
  const text = gazeText(shot);
  const self = humans[humanIndex];
  const named = namedHuman(humans, text, self);
  const other = named || otherHuman(self, humans);

  if (/camera|lens|fourth wall|audience|viewer|eye contact with camera/.test(text)) {
    return normalizeGaze({
      eyeTarget: 'camera',
      headDirection: 'follow_eyes',
      bodyDirection: 'hold',
      inferred: true,
      needsDirection: false
    });
  }
  if (/look(?:s|ing)? down|glance down|eyes down/.test(text)) {
    return normalizeGaze({
      eyeTarget: 'down',
      headDirection: 'follow_eyes',
      inferred: true,
      needsDirection: false
    });
  }
  if (/look(?:s|ing)? left|glance left|off[- ]camera left/.test(text)) {
    return normalizeGaze({
      eyeTarget: 'left',
      headDirection: 'follow_eyes',
      inferred: true,
      needsDirection: false
    });
  }
  if (/look(?:s|ing)? right|glance right|off[- ]camera right/.test(text)) {
    return normalizeGaze({
      eyeTarget: 'right',
      headDirection: 'follow_eyes',
      inferred: true,
      needsDirection: false
    });
  }
  if (named || /looks? at|gazes? at|stares? at|watching|eye contact|toward [a-z]/.test(text)) {
    if (other) {
      return normalizeGaze({
        eyeTarget: 'costar',
        eyeTargetId: other.id || '',
        headDirection: 'follow_eyes',
        bodyDirection: 'hold',
        inferred: true,
        needsDirection: false
      });
    }
  }
  if (/prop|object|item|holds?|points? at/.test(text) && !/walk|approach/.test(text)) {
    return normalizeGaze({
      eyeTarget: 'prop',
      headDirection: 'follow_eyes',
      inferred: true,
      needsDirection: false
    });
  }
  if (!text.trim()) {
    return defaultGaze();
  }
  return normalizeGaze({
    eyeTarget: 'hold',
    inferred: false,
    needsDirection: true
  });
}

export function resolveEyeWorldTarget(human, ctx = {}, position, bodyYaw) {
  const gaze = normalizeGaze(human?.gaze);
  const pos = position || human?.position || [0, 0, 0];
  const yaw = bodyYaw ?? human?.rotationY ?? 0;
  const humans = ctx.humans || [];
  const cameras = ctx.cameras || [];
  const props = ctx.props || [];
  const cam = cameras[0];
  const other =
    humans.find((h) => h && gaze.eyeTargetId && h.id === gaze.eyeTargetId) ||
    otherHuman(human, humans);
  const prop = props[0];

  if (gaze.eyeTarget === 'hold') return null;
  if (gaze.eyeTarget === 'camera' && cam?.position) {
    return [cam.position[0], cam.position[1], cam.position[2]];
  }
  if (gaze.eyeTarget === 'costar' && other?.position) {
    return [other.position[0], EYE_H, other.position[2]];
  }
  if (gaze.eyeTarget === 'prop' && prop?.position) {
    return [prop.position[0], prop.position[1] + 0.3, prop.position[2]];
  }
  if (gaze.eyeTarget === 'custom' && gaze.customPoint) {
    return [...gaze.customPoint];
  }
  if (gaze.eyeTarget === 'left') {
    return [pos[0] - Math.cos(yaw) * 2, EYE_H, pos[2] + Math.sin(yaw) * 2];
  }
  if (gaze.eyeTarget === 'right') {
    return [pos[0] + Math.cos(yaw) * 2, EYE_H, pos[2] - Math.sin(yaw) * 2];
  }
  if (gaze.eyeTarget === 'down') {
    return [pos[0] + Math.sin(yaw) * 0.4, 0.15, pos[2] + Math.cos(yaw) * 0.4];
  }
  return null;
}

function bodyTargetPoint(human, ctx, gaze) {
  const cam = ctx.cameras?.[0];
  const other =
    (ctx.humans || []).find((h) => h && gaze.eyeTargetId && h.id === gaze.eyeTargetId) ||
    otherHuman(human, ctx.humans || []);
  if (gaze.bodyDirection === 'camera' && cam?.position) return cam.position;
  if (gaze.bodyDirection === 'costar' && other?.position) return other.position;
  return null;
}

export function aimGaze(human, ctx = {}, position, bodyYawIn, poseIn = {}) {
  const gaze = normalizeGaze(human?.gaze);
  const pos = position || human?.position || [0, 0, 0];
  let bodyYaw = bodyYawIn ?? human?.rotationY ?? 0;
  const bodyPt = bodyTargetPoint(human, ctx, gaze);
  if (bodyPt) {
    bodyYaw = Math.atan2(bodyPt[0] - pos[0], bodyPt[2] - pos[2]);
  }

  const target = resolveEyeWorldTarget(human, ctx, pos, bodyYaw);
  const rest = {
    headX: poseIn.headX || 0,
    headY: poseIn.headY || 0,
    eyeX: poseIn.eyeX || 0,
    eyeY: poseIn.eyeY || 0,
    bodyYaw
  };
  if (!target || gaze.eyeTarget === 'hold') {
    return rest;
  }

  const dx = target[0] - pos[0];
  const dz = target[2] - pos[2];
  const dy = target[1] - EYE_H;
  const horiz = Math.max(0.05, Math.hypot(dx, dz));
  const worldYaw = Math.atan2(dx, dz);
  const relYaw = wrapPi(worldYaw - bodyYaw);
  const relPitch = -Math.atan2(dy, horiz);

  if (gaze.headDirection === 'hold') {
    return {
      ...rest,
      bodyYaw,
      eyeX: clamp(relPitch, -0.35, 0.35),
      eyeY: clamp(-relYaw, -0.45, 0.45)
    };
  }

  const headY = clamp(-relYaw, -1.2, 1.2);
  const headX = clamp(relPitch, -0.7, 0.7);
  const leftoverY = clamp(-relYaw - headY, -0.35, 0.35);
  const leftoverX = clamp(relPitch - headX, -0.25, 0.25);
  return {
    bodyYaw,
    headX,
    headY,
    eyeX: leftoverX,
    eyeY: leftoverY
  };
}

export function applyGazeToKeyframes(keys = [], human, ctx = {}) {
  if (!Array.isArray(keys) || !keys.length) return keys;
  return keys.map((k) => {
    const pose = { ...(k.pose || human?.pose || {}) };
    const rot = Array.isArray(k.rotation) ? [...k.rotation] : [0, human?.rotationY || 0, 0];
    const aimed = aimGaze(human, ctx, k.position || human?.position, rot[1], pose);
    return {
      ...k,
      rotation: [rot[0] || 0, aimed.bodyYaw, rot[2] || 0],
      pose: {
        ...pose,
        headX: aimed.headX,
        headY: aimed.headY,
        eyeX: aimed.eyeX,
        eyeY: aimed.eyeY
      }
    };
  });
}

export function applyGazeToHumanPose(human, ctx = {}) {
  const pose = { ...(human.pose || {}) };
  const aimed = aimGaze(human, ctx, human.position, human.rotationY, pose);
  return {
    pose: {
      ...pose,
      headX: aimed.headX,
      headY: aimed.headY,
      eyeX: aimed.eyeX,
      eyeY: aimed.eyeY
    },
    rotationY: aimed.bodyYaw,
    rotation: [human.rotation?.[0] || 0, aimed.bodyYaw, human.rotation?.[2] || 0]
  };
}
