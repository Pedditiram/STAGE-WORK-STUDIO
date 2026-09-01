/**
 * Character blocking paths (spec §6). Look ≠ walk. Only move when the prompt or director says so.
 */

import { easeCamera } from './stageCameraMove';
import { applyGazeToKeyframes } from './stageEyeHead';
import { applyExpressionToKeyframes } from './stageExpression';
import { applyInteractionToKeyframes } from './stageInteraction';

const HOLD_POSE = {
  spine: 0, chest: 0, headX: 0, headY: 0,
  upperArmLX: 0.15, upperArmLZ: 0.25, lowerArmL: 0.2,
  upperArmRX: 0.15, upperArmRZ: -0.25, lowerArmR: 0.2,
  thighLX: 0.05, shinL: 0.08, thighRX: 0.05, shinR: 0.08
};
const WALK_A = {
  ...HOLD_POSE,
  thighLX: -0.55, shinL: 0.45, thighRX: 0.45, shinR: 0.15,
  upperArmLZ: -0.55, upperArmRZ: 0.55, lowerArmL: 0.6, lowerArmR: 0.6
};
const WALK_B = {
  ...WALK_A,
  thighLX: 0.45, shinL: 0.15, thighRX: -0.55, shinR: 0.45,
  upperArmLZ: 0.55, upperArmRZ: -0.55
};

export const CHAR_MOVE_SIMPLE = [
  { id: 'hold', label: 'Hold' },
  { id: 'walk_forward', label: 'Walk' },
  { id: 'walk_toward', label: 'Toward' }
];

export const CHAR_MOVE_PRO = [
  { id: 'hold', label: 'Hold' },
  { id: 'walk_forward', label: 'Walk' },
  { id: 'walk_toward', label: 'Toward' },
  { id: 'turn_toward', label: 'Turn' },
  { id: 'bg_to_fg', label: 'BG→FG' },
  { id: 'stop_beside', label: 'Beside' }
];

export const CHAR_PATH_SHAPES = [
  { id: 'straight', label: 'Straight' },
  { id: 'curve', label: 'Curve' },
  { id: 'spline', label: 'Spline' }
];

function moveText(shot = {}) {
  return [
    shot.stageVideoPrompt,
    shot.videoPrompt,
    shot.characterMovement,
    shot.action,
    shot.actionEnvContext,
    shot.blocking
  ]
    .map((s) => String(s || ''))
    .join(' ')
    .toLowerCase();
}

export function inferCharacterMove(shot = {}, humanIndex = 0) {
  const text = moveText(shot);
  if (/looks? at|gazes?|stares?/.test(text) && !/walk|approach|move|go(es)? toward/.test(text)) {
    return { type: 'hold', path: 'straight', speed: 1, pause: 0, easing: 'easeInOut', inferred: false, needsDirection: false };
  }
  if (/stop beside|stand beside|next to|beside/.test(text)) {
    return { type: 'stop_beside', path: 'straight', speed: 1, pause: 0, easing: 'easeOut', inferred: true, needsDirection: false };
  }
  if (/background to foreground|bg to fg|into (the )?frame|toward (the )?camera/.test(text)) {
    return { type: 'bg_to_fg', path: 'straight', speed: 1, pause: 0, easing: 'easeInOut', inferred: true, needsDirection: false };
  }
  if (/turn toward|turns to|faces/.test(text) && !/walk|approach/.test(text)) {
    return { type: 'turn_toward', path: 'straight', speed: 1, pause: 0, easing: 'easeOut', inferred: true, needsDirection: false };
  }
  if (/walk toward|approach|goes to|cross(es)? to/.test(text)) {
    return { type: 'walk_toward', path: 'straight', speed: 1, pause: 0, easing: 'easeInOut', inferred: true, needsDirection: false };
  }
  if (/walk|stride|run|cross/.test(text)) {
    return { type: 'walk_forward', path: 'straight', speed: 1, pause: 0, easing: 'easeInOut', inferred: true, needsDirection: false };
  }
  return {
    type: 'hold',
    path: 'straight',
    speed: 1,
    pause: 0,
    easing: 'easeInOut',
    inferred: false,
    needsDirection: !text.trim()
  };
}

function lerp3(a, b, u) {
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
}

function samplePath(start, end, shape, u) {
  if (shape === 'curve' || shape === 'spline') {
    const mid = [
      (start[0] + end[0]) / 2 + (shape === 'spline' ? 0.55 : 0.35),
      start[1],
      (start[2] + end[2]) / 2
    ];
    const omu = 1 - u;
    return [
      omu * omu * start[0] + 2 * omu * u * mid[0] + u * u * end[0],
      start[1],
      omu * omu * start[2] + 2 * omu * u * mid[2] + u * u * end[2]
    ];
  }
  return lerp3(start, end, u);
}

function yawToward(from, to) {
  return Math.atan2(to[0] - from[0], to[2] - from[2]);
}

function walkPoses() {
  return [WALK_A, WALK_B];
}

function otherHuman(human, humans = []) {
  return humans.find((h) => h && h.id !== human.id) || humans.find((h) => h !== human) || null;
}

export function applyCharacterMoveType(human, type, extras = {}) {
  return {
    type: type || 'hold',
    path: extras.path || human.movement?.path || 'straight',
    speed: extras.speed ?? human.movement?.speed ?? 1,
    pause: extras.pause ?? human.movement?.pause ?? 0,
    easing: extras.easing || human.movement?.easing || 'easeInOut',
    inferred: false,
    needsDirection: false
  };
}

/**
 * @returns keyframes[]
 */
export function bakeCharacterMove(human, humans = [], durationSec = 5, shot = {}, ctx = {}) {
  const dur = Math.max(1, Number(durationSec) || 5);
  const start = human.position || [0, 0, 0];
  const rotY = human.rotationY ?? human.rotation?.[1] ?? 0;
  const basePose = human.pose || HOLD_POSE;
  const movement = human.movement || inferCharacterMove(shot, 0);
  const type = movement.type || 'hold';
  const shape = movement.path || 'straight';
  const pause = Math.max(0, Math.min(dur * 0.6, Number(movement.pause) || 0));
  const speed = Math.max(0.25, Number(movement.speed) || 1);
  const easing = movement.easing || 'easeInOut';
  const other = otherHuman(human, humans);
  const [walkA, walkB] = walkPoses();
  const stageCtx = { humans, cameras: ctx.cameras || [], props: ctx.props || [] };

  const finishKeys = (keys) =>
    applyInteractionToKeyframes(
      applyExpressionToKeyframes(applyGazeToKeyframes(keys, human, stageCtx), human),
      human
    );

  const holdKeys = (endPos, endRot, poseStart, poseEnd) => {
    const t0 = pause;
    const span = Math.max(0.2, (dur - t0) / speed);
    const t1 = Math.min(dur, t0 + span);
    const keys = [{ t: 0, position: [...start], rotation: [0, rotY, 0], pose: { ...poseStart } }];
    if (t0 > 0.05) {
      keys.push({ t: t0, position: [...start], rotation: [0, rotY, 0], pose: { ...poseStart } });
    }
    const samples = shape === 'straight' ? [0.5, 1] : [0.33, 0.66, 1];
    samples.forEach((s, i) => {
      const u = easeCamera(s, easing);
      keys.push({
        t: Math.round((t0 + (t1 - t0) * s) * 1000) / 1000,
        position: samplePath(start, endPos, shape, u),
        rotation: [0, endRot, 0],
        pose: i % 2 ? { ...poseEnd } : { ...poseStart }
      });
    });
    if (keys[keys.length - 1].t < dur) {
      keys.push({ t: dur, position: [...endPos], rotation: [0, endRot, 0], pose: { ...poseEnd } });
    }
    return finishKeys(keys);
  };

  if (type === 'hold') {
    return finishKeys(
      [
        { t: 0, position: [...start], rotation: [0, rotY, 0], pose: { ...basePose } },
        { t: dur, position: [...start], rotation: [0, rotY, 0], pose: { ...basePose } }
      ]
    );
  }

  if (type === 'turn_toward') {
    const target = other?.position || [start[0] + 1, 0, start[2]];
    const yaw = yawToward(start, target);
    return finishKeys(
      [
        { t: 0, position: [...start], rotation: [0, rotY, 0], pose: { ...basePose } },
        { t: dur, position: [...start], rotation: [0, yaw, 0], pose: { ...basePose } }
      ]
    );
  }

  let end = [
    start[0] + Math.sin(rotY) * 1.6,
    start[1] || 0,
    start[2] + Math.cos(rotY) * 1.6
  ];
  if ((type === 'walk_toward' || type === 'stop_beside') && other?.position) {
    const ox = other.position[0];
    const oz = other.position[2];
    const beside = type === 'stop_beside' ? 0.7 : 0.55;
    end = [ox + (start[0] >= ox ? beside : -beside), start[1] || 0, oz];
  }
  if (type === 'bg_to_fg') {
    end = [start[0] * 0.35, start[1] || 0, Math.min(2.2, start[2] + 2.4)];
  }

  const yaw = yawToward(start, end);
  return holdKeys(end, yaw, walkA, walkB);
}
