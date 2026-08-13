/**
 * Mannequin joint poses + keyframe baking from Matrix / Master Cinema craft tags.
 */

function clamp(n, lo, hi) {
  const x = Number(n);
  if (!Number.isFinite(x)) return lo;
  return Math.min(hi, Math.max(lo, x));
}

export const POSE_JOINT_META = [
  { key: 'spine', label: 'Spine lean', min: -0.6, max: 0.6 },
  { key: 'chest', label: 'Chest', min: -0.5, max: 0.5 },
  { key: 'headX', label: 'Head tilt', min: -0.7, max: 0.7 },
  { key: 'headY', label: 'Head turn', min: -1.2, max: 1.2 },
  { key: 'upperArmLX', label: 'L arm raise', min: -2.2, max: 1.2 },
  { key: 'upperArmLZ', label: 'L arm swing', min: -1.4, max: 1.4 },
  { key: 'lowerArmL', label: 'L elbow', min: 0, max: 2.2 },
  { key: 'upperArmRX', label: 'R arm raise', min: -2.2, max: 1.2 },
  { key: 'upperArmRZ', label: 'R arm swing', min: -1.4, max: 1.4 },
  { key: 'lowerArmR', label: 'R elbow', min: 0, max: 2.2 },
  { key: 'thighLX', label: 'L thigh', min: -1.4, max: 1.2 },
  { key: 'shinL', label: 'L knee', min: 0, max: 2.0 },
  { key: 'thighRX', label: 'R thigh', min: -1.4, max: 1.2 },
  { key: 'shinR', label: 'R knee', min: 0, max: 2.0 }
];

export function defaultPose() {
  return {
    spine: 0,
    chest: 0,
    headX: 0,
    headY: 0,
    upperArmLX: 0.15,
    upperArmLZ: 0.25,
    lowerArmL: 0.2,
    upperArmRX: 0.15,
    upperArmRZ: -0.25,
    lowerArmR: 0.2,
    thighLX: 0.05,
    shinL: 0.08,
    thighRX: 0.05,
    shinR: 0.08
  };
}

export const POSE_PRESETS = {
  standing: () => defaultPose(),
  a_pose: () => ({
    ...defaultPose(),
    upperArmLZ: 0.55,
    upperArmRZ: -0.55,
    lowerArmL: 0.15,
    lowerArmR: 0.15
  }),
  t_pose: () => ({
    ...defaultPose(),
    upperArmLX: -1.45,
    upperArmRX: -1.45,
    upperArmLZ: 0,
    upperArmRZ: 0,
    lowerArmL: 0.05,
    lowerArmR: 0.05
  }),
  talk: () => ({
    ...defaultPose(),
    headY: 0.15,
    upperArmLX: -0.35,
    lowerArmL: 1.1,
    upperArmRX: -0.2,
    lowerArmR: 0.7,
    chest: 0.08
  }),
  point: () => ({
    ...defaultPose(),
    headY: 0.35,
    upperArmRX: -1.5,
    upperArmRZ: -0.2,
    lowerArmR: 0.15,
    chest: 0.12
  }),
  reach: () => ({
    ...defaultPose(),
    spine: -0.15,
    upperArmLX: -2.0,
    lowerArmL: 0.3,
    upperArmRX: -1.6,
    lowerArmR: 0.4
  }),
  sit: () => ({
    ...defaultPose(),
    spine: 0.2,
    thighLX: -1.15,
    shinL: 1.35,
    thighRX: -1.15,
    shinR: 1.35,
    upperArmLX: 0.4,
    lowerArmL: 1.0,
    upperArmRX: 0.4,
    lowerArmR: 1.0
  }),
  crouch: () => ({
    ...defaultPose(),
    spine: 0.35,
    thighLX: -1.3,
    shinL: 1.7,
    thighRX: -1.3,
    shinR: 1.7,
    upperArmLX: 0.5,
    lowerArmL: 1.2,
    upperArmRX: 0.5,
    lowerArmR: 1.2
  }),
  walk: () => ({
    ...defaultPose(),
    thighLX: -0.55,
    shinL: 0.45,
    thighRX: 0.45,
    shinR: 0.15,
    upperArmLZ: -0.55,
    upperArmRZ: 0.55,
    lowerArmL: 0.6,
    lowerArmR: 0.6
  }),
  look_left: () => ({ ...defaultPose(), headY: 0.85, chest: 0.1 }),
  look_right: () => ({ ...defaultPose(), headY: -0.85, chest: -0.1 }),
  wave: () => ({
    ...defaultPose(),
    upperArmRX: -2.0,
    upperArmRZ: -0.35,
    lowerArmR: 0.35,
    headY: -0.2
  }),
  hands_on_hips: () => ({
    ...defaultPose(),
    upperArmLX: 0.35,
    upperArmLZ: 0.75,
    lowerArmL: 1.45,
    upperArmRX: 0.35,
    upperArmRZ: -0.75,
    lowerArmR: 1.45,
    chest: 0.08
  }),
  crossed_arms: () => ({
    ...defaultPose(),
    upperArmLX: -0.55,
    upperArmLZ: 0.35,
    lowerArmL: 1.7,
    upperArmRX: -0.55,
    upperArmRZ: -0.35,
    lowerArmR: 1.7,
    chest: 0.05
  })
};

/** Clip-style keyframe animations for mannequins (industry presets). */
export function bakeMannequinAnimation(human, animName = 'idle', durationSec = 5) {
  const dur = clamp(durationSec, 1, 30);
  const start = human.position || [0, 0, 0];
  const rotY = human.rotationY || human.rotation?.[1] || 0;
  const stand = normalizePose(human.pose || defaultPose());

  if (animName === 'idle') {
    const a = { ...stand, chest: (stand.chest || 0) + 0.04, spine: (stand.spine || 0) + 0.02 };
    const b = { ...stand, chest: (stand.chest || 0) - 0.03, spine: (stand.spine || 0) - 0.015 };
    return [
      { t: 0, position: [...start], rotation: [0, rotY, 0], pose: stand },
      { t: dur * 0.5, position: [...start], rotation: [0, rotY, 0], pose: a },
      { t: dur, position: [...start], rotation: [0, rotY, 0], pose: b }
    ];
  }

  if (animName === 'wave') {
    const up = normalizePose(POSE_PRESETS.wave());
    const mid = normalizePose({ ...POSE_PRESETS.wave(), lowerArmR: 1.1, upperArmRZ: 0.15 });
    return [
      { t: 0, position: [...start], rotation: [0, rotY, 0], pose: stand },
      { t: dur * 0.25, position: [...start], rotation: [0, rotY, 0], pose: up },
      { t: dur * 0.5, position: [...start], rotation: [0, rotY, 0], pose: mid },
      { t: dur * 0.75, position: [...start], rotation: [0, rotY, 0], pose: up },
      { t: dur, position: [...start], rotation: [0, rotY, 0], pose: stand }
    ];
  }

  if (animName === 'walk_cycle') {
    return bakeHumanKeyframes({ ...human, pose: POSE_PRESETS.walk() }, dur, { characterMovement: 'walk' });
  }

  if (animName === 'sit_down') {
    const sit = normalizePose(POSE_PRESETS.sit());
    return [
      { t: 0, position: [...start], rotation: [0, rotY, 0], pose: stand },
      { t: dur * 0.55, position: [start[0], 0, start[2]], rotation: [0, rotY, 0], pose: normalizePose(POSE_PRESETS.crouch()) },
      { t: dur, position: [start[0], 0, start[2]], rotation: [0, rotY, 0], pose: sit }
    ];
  }

  if (animName === 'turn_around') {
    return [
      { t: 0, position: [...start], rotation: [0, rotY, 0], pose: stand },
      { t: dur * 0.5, position: [...start], rotation: [0, rotY + Math.PI, 0], pose: normalizePose(POSE_PRESETS.walk()) },
      { t: dur, position: [...start], rotation: [0, rotY + Math.PI * 2, 0], pose: stand }
    ];
  }

  if (animName === 'run_cycle') {
    return bakeHumanKeyframes(
      { ...human, pose: { ...POSE_PRESETS.walk(), thighLX: -0.85, thighRX: 0.7, upperArmLZ: -0.9, upperArmRZ: 0.9 } },
      dur,
      { characterMovement: 'run' }
    );
  }

  return bakeHumanKeyframes(human, dur, {});
}

export const MANNEQUIN_ANIM_PRESETS = [
  { id: 'idle', label: 'Idle breathe' },
  { id: 'walk_cycle', label: 'Walk cycle' },
  { id: 'run_cycle', label: 'Run cycle' },
  { id: 'wave', label: 'Wave' },
  { id: 'sit_down', label: 'Sit down' },
  { id: 'turn_around', label: 'Turn 360' }
];

export function normalizePose(pose) {
  const base = defaultPose();
  if (!pose || typeof pose !== 'object') return base;
  const out = { ...base };
  POSE_JOINT_META.forEach(({ key, min, max }) => {
    if (pose[key] != null) out[key] = clamp(pose[key], min, max);
  });
  return out;
}

/** Infer pose preset name from shot craft / prompt fields. */
export function inferPoseNameFromShot(shot = {}, humanIndex = 0) {
  const blob = [
    shot.characterMovement,
    shot.characterExpression,
    shot.shotComposition,
    shot.actionEnvContext,
    shot.coArtistInteraction,
    shot.characterDialogue
  ].map((s) => String(s || '').toLowerCase()).join(' ');

  if (/sit|seated|chair|bench/.test(blob)) return 'sit';
  if (/crouch|kneel|squat/.test(blob)) return 'crouch';
  if (/point|gesture toward|indicate/.test(blob)) return 'point';
  if (/reach|grab|hold up|arms? (up|raised)/.test(blob)) return 'reach';
  if (/walk|run|stride|approach|cross/.test(blob)) return 'walk';
  if (/look left|glance left/.test(blob)) return 'look_left';
  if (/look right|glance right/.test(blob)) return 'look_right';
  if (/talk|speak|dialogue|conversation|whisper/.test(blob) || shot.characterDialogue) return 'talk';
  if (humanIndex > 0 && /two.?shot|over.?shoulder|ot[s]/.test(blob)) return 'talk';
  return 'standing';
}

export function poseFromShot(shot = {}, humanIndex = 0, explicitPose) {
  if (explicitPose) return normalizePose(explicitPose);
  const name = inferPoseNameFromShot(shot, humanIndex);
  const preset = POSE_PRESETS[name] || POSE_PRESETS.standing;
  return normalizePose(preset());
}

function evalCameraPose(camPlan, t, durationSec) {
  const u = durationSec > 0 ? Math.min(1, Math.max(0, t / durationSec)) : 0;
  const anim = camPlan.animation || { type: 'static' };
  const look = camPlan.lookAt || [0, 1.2, 0];
  const base = camPlan.position || [-2, 1.4, 3];

  if (anim.type === 'orbit') {
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

  if (anim.type === 'dolly' || anim.type === 'crane' || anim.type === 'pan') {
    const from = anim.from || base;
    const to = anim.to || base;
    return {
      position: [
        from[0] + (to[0] - from[0]) * u,
        from[1] + (to[1] - from[1]) * u,
        from[2] + (to[2] - from[2]) * u
      ],
      lookAt: [...look],
      rotation: [0, 0, 0]
    };
  }

  return { position: [...base], lookAt: [...look], rotation: [0, 0, 0] };
}

/** Sample camera animation into editable keyframes (drives motion path). */
export function bakeCameraKeyframes(camPlan, durationSec = 5, steps = 5) {
  const dur = clamp(durationSec, 1, 30);
  const keys = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / (steps - 1)) * dur;
    const pose = evalCameraPose(camPlan, t, dur);
    keys.push({
      t: Math.round(t * 1000) / 1000,
      position: pose.position,
      rotation: pose.rotation,
      lookAt: pose.lookAt
    });
  }
  return keys;
}

/** Walk / approach path for mannequins from prompt motion words. */
export function bakeHumanKeyframes(human, durationSec = 5, shot = {}) {
  const dur = clamp(durationSec, 1, 30);
  const poseName = inferPoseNameFromShot(shot);
  const start = human.position || [0, 0, 0];
  const rotY = human.rotationY || 0;
  const basePose = normalizePose(human.pose);

  if (poseName !== 'walk' && !/walk|run|approach|cross|move toward/.test(
    String(shot.characterMovement || '').toLowerCase()
  )) {
    // Static blocking — still seed start/end so path tools work when user edits
    return [
      {
        t: 0,
        position: [...start],
        rotation: [0, rotY, 0],
        pose: { ...basePose }
      },
      {
        t: dur,
        position: [...start],
        rotation: [0, rotY, 0],
        pose: { ...basePose }
      }
    ];
  }

  const dist = 1.6;
  const end = [
    start[0] + Math.sin(rotY) * dist,
    start[1] || 0,
    start[2] + Math.cos(rotY) * dist
  ];

  const walkA = normalizePose(POSE_PRESETS.walk());
  const walkB = normalizePose({
    ...POSE_PRESETS.walk(),
    thighLX: 0.45,
    shinL: 0.15,
    thighRX: -0.55,
    shinR: 0.45,
    upperArmLZ: 0.55,
    upperArmRZ: -0.55
  });

  return [
    { t: 0, position: [...start], rotation: [0, rotY, 0], pose: { ...walkA } },
    {
      t: dur * 0.33,
      position: [
        start[0] + (end[0] - start[0]) * 0.33,
        0,
        start[2] + (end[2] - start[2]) * 0.33
      ],
      rotation: [0, rotY, 0],
      pose: { ...walkB }
    },
    {
      t: dur * 0.66,
      position: [
        start[0] + (end[0] - start[0]) * 0.66,
        0,
        start[2] + (end[2] - start[2]) * 0.66
      ],
      rotation: [0, rotY, 0],
      pose: { ...walkA }
    },
    { t: dur, position: [...end], rotation: [0, rotY, 0], pose: { ...walkB } }
  ];
}

export { evalCameraPose as evalCameraPoseUtil };
