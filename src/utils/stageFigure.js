/**
 * Optional GLB figure on Stage. Shot-data shape stays the same:
 * figureSource: 'mannequin' | 'glb', plus optional glbUrl.
 */

export function figureUrlFromProfile(profile = {}) {
  return String(
    profile.glbUrl ||
      profile.figureUrl ||
      profile.modelUrl ||
      profile.avatarGlb ||
      profile.meshUrl ||
      ''
  ).trim();
}

export function resolveHumanFigure(human = {}, profile = {}) {
  const glbUrl = String(human.glbUrl || figureUrlFromProfile(profile) || '').trim();
  return {
    figureSource: glbUrl ? 'glb' : human.figureSource || 'mannequin',
    glbUrl
  };
}

/**
 * Fit a loaded GLB into a mannequin wrapper (~human height). THREE passed in to avoid node tests loading three.
 */
export function fitGlbIntoWrapper(wrapper, gltfScene, THREE) {
  if (!wrapper || !gltfScene || !THREE) return;
  const old = wrapper.getObjectByName('glbFigure');
  if (old) wrapper.remove(old);
  const root = gltfScene;
  root.name = 'glbFigure';
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const h = size.y || 1;
  const s = 1.78 / h;
  root.scale.multiplyScalar(s);
  box.setFromObject(root);
  root.position.y -= box.min.y;
  wrapper.add(root);
  wrapper.traverse((o) => {
    if (o.userData?.mannequinPart) o.visible = false;
  });
  wrapper.userData.figureSource = 'glb';
  wrapper.userData.hasGlb = true;
}

function isHipsBone(name) {
  const n = String(name || '').toLowerCase();
  return /hips|pelvis/.test(n);
}

export function collectGlbRootMotionNodes(wrapper) {
  const nodes = [];
  if (!wrapper) return nodes;
  const root = typeof wrapper.getObjectByName === 'function'
    ? wrapper.getObjectByName('glbFigure')
    : null;
  const target = root || wrapper;
  if (target?.position) nodes.push(target);
  if (typeof target?.traverse === 'function') {
    target.traverse((o) => {
      if (o !== target && o?.position && isHipsBone(o.name)) nodes.push(o);
    });
  }
  return nodes;
}

function isToeBone(name) {
  const n = String(name || '').toLowerCase();
  return /mixamorig(left|right)toe/.test(n) || /\b(toe|toes|toebase)\b/.test(n);
}

function isFootBone(name) {
  const n = String(name || '').toLowerCase();
  if (isToeBone(n)) return false;
  return /(left|right|l_|r_)?(foot|ankle)\b/.test(n) || /mixamorig(left|right)foot/.test(n);
}

function isHeelBone(name) {
  const n = String(name || '').toLowerCase();
  if (isToeBone(n) || /ankle/.test(n)) return false;
  return /mixamorig(left|right)foot$/.test(n) || /^(left|right)?foot$/.test(n);
}

function isShinBone(name) {
  const n = String(name || '').toLowerCase();
  if (/upleg|thigh|upperleg/.test(n)) return false;
  return /mixamorig(left|right)leg/.test(n) || /(calf|shin)\b/.test(n);
}

function isShoulderSpineBone(name) {
  const n = String(name || '').toLowerCase();
  return /(spine|chest|shoulder)/.test(n) && !/upleg|thigh/.test(n);
}

function isClavicleBone(name) {
  const n = String(name || '').toLowerCase();
  return /clavicle/.test(n) || /mixamorig(left|right)shoulder/.test(n) || /^(left|right)?shoulder$/.test(n);
}

function isHipsCounterBone(name) {
  const n = String(name || '').toLowerCase();
  return /hips|pelvis/.test(n);
}

function isElbowBone(name) {
  const n = String(name || '').toLowerCase();
  return /mixamorig(left|right)forearm/.test(n) || /forearm/.test(n);
}

function isArmSwingBone(name) {
  const n = String(name || '').toLowerCase();
  if (/shoulder|clavicle|hand|wrist|forearm/.test(n)) return false;
  return /mixamorig(left|right)arm/.test(n)
    || /upperarm/.test(n)
    || /(left|right)arm\b/.test(n);
}

function isFingerBone(name) {
  const n = String(name || '').toLowerCase();
  return /mixamorig(left|right)hand(thumb|index|middle|ring|pinky)/.test(n)
    || /(thumb|index|middle|ring|pinky|finger)\d*$/.test(n);
}

function isWristBone(name) {
  const n = String(name || '').toLowerCase();
  if (isFingerBone(n)) return false;
  return /mixamorig(left|right)hand$/.test(n) || /^(left|right)?(wrist|hand)$/.test(n);
}

function isHeadBobBone(name) {
  const n = String(name || '').toLowerCase();
  return /mixamorig(head|neck)/.test(n) || /^(head|neck)$/.test(n);
}

function limbSide(name) {
  const n = String(name || '').toLowerCase();
  if (/left|l_|mixamorigleft/.test(n)) return 'L';
  if (/right|r_|mixamorigright/.test(n)) return 'R';
  return '';
}

export function captureGlbRootRest(wrapper) {
  collectGlbRootMotionNodes(wrapper).forEach((o) => {
    if (!o.userData) o.userData = {};
    o.userData.restXZ = { x: o.position.x, y: o.position.y, z: o.position.z };
  });
  const root = typeof wrapper?.getObjectByName === 'function' ? wrapper.getObjectByName('glbFigure') : wrapper;
  root?.traverse?.((o) => {
    if (!o?.position) return;
    if (!o.userData) o.userData = {};
    if (isFootBone(o.name)) {
      o.userData.restPlant = { x: o.position.x, y: o.position.y, z: o.position.z };
    }
    if (isShinBone(o.name)) {
      o.userData.restIk = { x: o.position.x, y: o.position.y, z: o.position.z };
      if (o.rotation) {
        if (typeof o.rotation.x === 'number') o.userData.restRotX = o.rotation.x;
        if (typeof o.rotation.y === 'number') o.userData.restRotY = o.rotation.y;
        if (typeof o.rotation.z === 'number') o.userData.restRotZ = o.rotation.z;
      }
    }
    if (o.rotation && isHipsCounterBone(o.name)) {
      if (typeof o.rotation.x === 'number') o.userData.restRotX = o.rotation.x;
      if (typeof o.rotation.y === 'number') o.userData.restRotY = o.rotation.y;
      if (typeof o.rotation.z === 'number') o.userData.restRotZ = o.rotation.z;
    } else if (o.rotation && isClavicleBone(o.name)) {
      if (typeof o.rotation.x === 'number') o.userData.restRotX = o.rotation.x;
      if (typeof o.rotation.y === 'number') o.userData.restRotY = o.rotation.y;
      if (typeof o.rotation.z === 'number') o.userData.restRotZ = o.rotation.z;
    } else if (o.rotation && typeof o.rotation.y === 'number'
      && isShoulderSpineBone(o.name)) {
      o.userData.restRotY = o.rotation.y;
    }
    if (o.rotation && (isArmSwingBone(o.name) || isElbowBone(o.name))) {
      if (typeof o.rotation.x === 'number') o.userData.restRotX = o.rotation.x;
      if (typeof o.rotation.z === 'number') o.userData.restRotZ = o.rotation.z;
    }
    if (o.rotation && (isWristBone(o.name) || isFingerBone(o.name) || isToeBone(o.name) || isHeelBone(o.name))) {
      if (typeof o.rotation.x === 'number') o.userData.restRotX = o.rotation.x;
      if (typeof o.rotation.y === 'number') o.userData.restRotY = o.rotation.y;
      if (typeof o.rotation.z === 'number') o.userData.restRotZ = o.rotation.z;
    }
    if (o.rotation && isHeadBobBone(o.name) && typeof o.rotation.x === 'number') {
      o.userData.restRotX = o.rotation.x;
    }
  });
}

/** Keep Mixamo locomotion in place. Stage wrapper still follows blocking (look ≠ walk). */
export function freezeGlbRootMotion(wrapper) {
  collectGlbRootMotionNodes(wrapper).forEach((o) => {
    if (!o.userData) o.userData = {};
    if (!o.userData.restXZ) {
      o.userData.restXZ = { x: o.position.x, y: o.position.y, z: o.position.z };
    }
    o.position.x = o.userData.restXZ.x;
    o.position.z = o.userData.restXZ.z;
  });
}

/** Stop Mixamo feet from punching through the floor. Does not invent a walk. */
export function lockGlbFootPlant(wrapper) {
  const root = typeof wrapper?.getObjectByName === 'function' ? wrapper.getObjectByName('glbFigure') : wrapper;
  if (!root?.traverse) return;
  root.traverse((o) => {
    if (!o?.position || !isFootBone(o.name)) return;
    if (!o.userData) o.userData = {};
    if (!o.userData.restPlant) {
      o.userData.restPlant = { x: o.position.x, y: o.position.y, z: o.position.z };
    }
    if (o.position.y < o.userData.restPlant.y) o.position.y = o.userData.restPlant.y;
  });
}

/** Keep the planted Mixamo foot from sliding in XZ. Look ≠ walk. */
export function lockGlbFootSlide(wrapper) {
  const root = typeof wrapper?.getObjectByName === 'function' ? wrapper.getObjectByName('glbFigure') : wrapper;
  if (!root?.traverse) return;
  root.traverse((o) => {
    if (!o?.position || !isFootBone(o.name)) return;
    if (!o.userData) o.userData = {};
    const rest = o.userData.restPlant;
    if (!rest) return;
    const lift = o.position.y - rest.y;
    if (lift < 0.035) {
      if (!o.userData.slideLock) {
        o.userData.slideLock = { x: o.position.x, z: o.position.z };
      }
      o.position.x = o.userData.slideLock.x;
      o.position.z = o.userData.slideLock.z;
    } else {
      o.userData.slideLock = null;
    }
  });
}

/**
 * Two-bone polish: planted foot pulls the shin toward rest so Mixamo knees do not pop.
 * Does not invent a walk (look ≠ walk).
 */
export function polishGlbTwoBoneIk(wrapper) {
  const root = typeof wrapper?.getObjectByName === 'function' ? wrapper.getObjectByName('glbFigure') : wrapper;
  if (!root?.traverse) return;
  const items = [];
  root.traverse((o) => {
    if (o?.position) items.push(o);
  });
  ['L', 'R'].forEach((side) => {
    const shin = items.find((o) => isShinBone(o.name) && limbSide(o.name) === side);
    const foot = items.find((o) => isFootBone(o.name) && limbSide(o.name) === side);
    if (!shin || !foot) return;
    if (!shin.userData) shin.userData = {};
    if (!shin.userData.restIk) {
      shin.userData.restIk = { x: shin.position.x, y: shin.position.y, z: shin.position.z };
    }
    const rest = shin.userData.restIk;
    const planted = Boolean(foot.userData?.slideLock)
      || (foot.userData?.restPlant && (foot.position.y - foot.userData.restPlant.y) < 0.035);
    if (!planted) return;
    const midY = (rest.y + foot.position.y) * 0.5;
    shin.position.y = rest.y * 0.65 + midY * 0.35;
    shin.position.x = rest.x * 0.85 + foot.position.x * 0.15;
    shin.position.z = rest.z * 0.85 + foot.position.z * 0.15;
  });
}

/**
 * Lock Mixamo knee rotation toward rest so in-place walk does not hyperextend. Look ≠ walk.
 */
export function lockGlbKnee(wrapper) {
  const root = typeof wrapper?.getObjectByName === 'function' ? wrapper.getObjectByName('glbFigure') : wrapper;
  if (!root?.traverse) return;
  root.traverse((o) => {
    if (!o?.rotation || !isShinBone(o.name)) return;
    if (!o.userData) o.userData = {};
    ['x', 'y', 'z'].forEach((axis) => {
      if (typeof o.rotation[axis] !== 'number') return;
      const key = `restRot${axis.toUpperCase()}`;
      if (o.userData[key] == null) o.userData[key] = o.rotation[axis];
      const rest = o.userData[key];
      const leftover = axis === 'x' ? 0.22 : 0.35;
      o.rotation[axis] = rest + (o.rotation[axis] - rest) * leftover;
    });
  });
}

/**
 * Counter-rotate spine/shoulders against hip yaw so in-place Mixamo walk does not corkscrew.
 * Look ≠ walk; blocking stays on the wrapper.
 */
export function counterRotateGlbShoulderHip(wrapper) {
  const root = typeof wrapper?.getObjectByName === 'function' ? wrapper.getObjectByName('glbFigure') : wrapper;
  if (!root?.traverse) return;
  const hips = [];
  const shoulders = [];
  root.traverse((o) => {
    if (!o?.rotation || typeof o.rotation.y !== 'number') return;
    if (!o.userData) o.userData = {};
    if (isHipsCounterBone(o.name)) hips.push(o);
    else if (isShoulderSpineBone(o.name)) shoulders.push(o);
  });
  const hipDeltas = hips.map((h) => {
    if (h.userData.restRotY == null) h.userData.restRotY = h.rotation.y;
    return h.rotation.y - h.userData.restRotY;
  });
  const hipDy = hipDeltas[0] || 0;
  hips.forEach((h, i) => {
    h.rotation.y = h.userData.restRotY + hipDeltas[i] * 0.55;
  });
  shoulders.forEach((s) => {
    if (s.userData.restRotY == null) s.userData.restRotY = s.rotation.y;
    s.rotation.y = s.userData.restRotY - hipDy * 0.65;
  });
}

/**
 * Damp Mixamo hip sway (X/Z) so in-place walk does not rock. Y stays for facing (look ≠ walk).
 */
export function dampGlbHipSway(wrapper) {
  const root = typeof wrapper?.getObjectByName === 'function' ? wrapper.getObjectByName('glbFigure') : wrapper;
  if (!root?.traverse) return;
  root.traverse((o) => {
    if (!o?.rotation || !isHipsCounterBone(o.name)) return;
    if (!o.userData) o.userData = {};
    ['x', 'z'].forEach((axis) => {
      if (typeof o.rotation[axis] !== 'number') return;
      const key = `restRot${axis.toUpperCase()}`;
      if (o.userData[key] == null) o.userData[key] = o.rotation[axis];
      o.rotation[axis] = o.userData[key] + (o.rotation[axis] - o.userData[key]) * 0.38;
    });
  });
}

/**
 * Settle Mixamo clavicles toward rest so in-place walk does not shrug. Y stays (look ≠ walk).
 */
export function settleGlbClavicle(wrapper) {
  const root = typeof wrapper?.getObjectByName === 'function' ? wrapper.getObjectByName('glbFigure') : wrapper;
  if (!root?.traverse) return;
  root.traverse((o) => {
    if (!o?.rotation || !isClavicleBone(o.name)) return;
    if (!o.userData) o.userData = {};
    ['x', 'z'].forEach((axis) => {
      if (typeof o.rotation[axis] !== 'number') return;
      const key = `restRot${axis.toUpperCase()}`;
      if (o.userData[key] == null) o.userData[key] = o.rotation[axis];
      o.rotation[axis] = o.userData[key] + (o.rotation[axis] - o.userData[key]) * 0.28;
    });
  });
}

/**
 * Damp Mixamo arm swing so in-place walk does not windmill. Look ≠ walk.
 */
export function dampGlbArmSwing(wrapper) {
  const root = typeof wrapper?.getObjectByName === 'function' ? wrapper.getObjectByName('glbFigure') : wrapper;
  if (!root?.traverse) return;
  root.traverse((o) => {
    if (!o?.rotation || !isArmSwingBone(o.name)) return;
    if (!o.userData) o.userData = {};
    if (typeof o.rotation.x === 'number') {
      if (o.userData.restRotX == null) o.userData.restRotX = o.rotation.x;
      o.rotation.x = o.userData.restRotX + (o.rotation.x - o.userData.restRotX) * 0.42;
    }
    if (typeof o.rotation.z === 'number') {
      if (o.userData.restRotZ == null) o.userData.restRotZ = o.rotation.z;
      o.rotation.z = o.userData.restRotZ + (o.rotation.z - o.userData.restRotZ) * 0.42;
    }
  });
}

/**
 * Damp Mixamo elbows so in-place walk does not flap the forearm. Look ≠ walk.
 */
export function dampGlbElbow(wrapper) {
  const root = typeof wrapper?.getObjectByName === 'function' ? wrapper.getObjectByName('glbFigure') : wrapper;
  if (!root?.traverse) return;
  root.traverse((o) => {
    if (!o?.rotation || !isElbowBone(o.name)) return;
    if (!o.userData) o.userData = {};
    ['x', 'z'].forEach((axis) => {
      if (typeof o.rotation[axis] !== 'number') return;
      const key = `restRot${axis.toUpperCase()}`;
      if (o.userData[key] == null) o.userData[key] = o.rotation[axis];
      o.rotation[axis] = o.userData[key] + (o.rotation[axis] - o.userData[key]) * 0.18;
    });
  });
}

/**
 * Damp Mixamo head/neck nod so in-place walk does not bob. Does not invent a look (Y stays).
 */
export function dampGlbHeadBob(wrapper) {
  const root = typeof wrapper?.getObjectByName === 'function' ? wrapper.getObjectByName('glbFigure') : wrapper;
  if (!root?.traverse) return;
  root.traverse((o) => {
    if (!o?.rotation || !isHeadBobBone(o.name) || typeof o.rotation.x !== 'number') return;
    if (!o.userData) o.userData = {};
    if (o.userData.restRotX == null) o.userData.restRotX = o.rotation.x;
    o.rotation.x = o.userData.restRotX + (o.rotation.x - o.userData.restRotX) * 0.38;
  });
}

/**
 * Settle Mixamo wrists/hands toward rest so in-place walk does not flap. Look ≠ walk.
 */
export function settleGlbWrist(wrapper) {
  const root = typeof wrapper?.getObjectByName === 'function' ? wrapper.getObjectByName('glbFigure') : wrapper;
  if (!root?.traverse) return;
  root.traverse((o) => {
    if (!o?.rotation || !isWristBone(o.name)) return;
    if (!o.userData) o.userData = {};
    ['x', 'y', 'z'].forEach((axis) => {
      if (typeof o.rotation[axis] !== 'number') return;
      const key = `restRot${axis.toUpperCase()}`;
      if (o.userData[key] == null) o.userData[key] = o.rotation[axis];
      o.rotation[axis] = o.userData[key] + (o.rotation[axis] - o.userData[key]) * 0.22;
    });
  });
}

/**
 * Curl Mixamo fingers toward a loose rest so in-place walk does not splay. Look ≠ walk.
 */
export function curlGlbFingers(wrapper) {
  const root = typeof wrapper?.getObjectByName === 'function' ? wrapper.getObjectByName('glbFigure') : wrapper;
  if (!root?.traverse) return;
  root.traverse((o) => {
    if (!o?.rotation || !isFingerBone(o.name)) return;
    if (!o.userData) o.userData = {};
    ['x', 'y', 'z'].forEach((axis) => {
      if (typeof o.rotation[axis] !== 'number') return;
      const key = `restRot${axis.toUpperCase()}`;
      if (o.userData[key] == null) o.userData[key] = o.rotation[axis];
      const rest = o.userData[key];
      const leftover = axis === 'x' ? 0.12 : 0.2;
      const curl = axis === 'x' ? 0.18 : 0;
      o.rotation[axis] = rest + (o.rotation[axis] - rest) * leftover + curl;
    });
  });
}

/**
 * Roll Mixamo toes toward a planted rest so in-place walk does not flap. Look ≠ walk.
 */
export function rollGlbToes(wrapper) {
  const root = typeof wrapper?.getObjectByName === 'function' ? wrapper.getObjectByName('glbFigure') : wrapper;
  if (!root?.traverse) return;
  root.traverse((o) => {
    if (!o?.rotation || !isToeBone(o.name)) return;
    if (!o.userData) o.userData = {};
    ['x', 'y', 'z'].forEach((axis) => {
      if (typeof o.rotation[axis] !== 'number') return;
      const key = `restRot${axis.toUpperCase()}`;
      if (o.userData[key] == null) o.userData[key] = o.rotation[axis];
      const rest = o.userData[key];
      const leftover = axis === 'x' ? 0.16 : 0.28;
      const roll = axis === 'x' ? 0.14 : 0;
      o.rotation[axis] = rest + (o.rotation[axis] - rest) * leftover + roll;
    });
  });
}

/**
 * Settle Mixamo heels toward rest so in-place walk does not rock. Look ≠ walk.
 */
export function settleGlbHeel(wrapper) {
  const root = typeof wrapper?.getObjectByName === 'function' ? wrapper.getObjectByName('glbFigure') : wrapper;
  if (!root?.traverse) return;
  root.traverse((o) => {
    if (!o?.rotation || !isHeelBone(o.name)) return;
    if (!o.userData) o.userData = {};
    ['x', 'y', 'z'].forEach((axis) => {
      if (typeof o.rotation[axis] !== 'number') return;
      const key = `restRot${axis.toUpperCase()}`;
      if (o.userData[key] == null) o.userData[key] = o.rotation[axis];
      const rest = o.userData[key];
      const leftover = axis === 'x' ? 0.2 : 0.32;
      const plant = axis === 'x' ? 0.08 : 0;
      o.rotation[axis] = rest + (o.rotation[axis] - rest) * leftover + plant;
    });
  });
}

function clipName(clip) {
  return String(clip?.name || '').toLowerCase();
}

/** Prefer Mixamo / idle clip; otherwise the first clip in the GLB. */
export function pickGlbIdleClip(animations = []) {
  const list = Array.isArray(animations) ? animations.filter(Boolean) : [];
  if (!list.length) return null;
  const score = (clip) => {
    const n = clipName(clip);
    if (/idle|breath|standing/.test(n)) return 4;
    if (/mixamo/.test(n) && !/walk|run|jog|sprint/.test(n)) return 2;
    return 0;
  };
  return [...list].sort((a, b) => score(b) - score(a))[0];
}

/**
 * Look ≠ walk: gaze never selects a locomotion clip.
 * Walk/run only when character movement says so.
 */
export function glbClipIntentFromHuman(human = {}) {
  const move = String(human?.movement?.type || 'hold').toLowerCase();
  if (!move || move === 'hold' || move === 'turn_toward') return 'idle';
  if (/run/.test(move)) return 'run';
  if (/walk|bg_to_fg|stop_beside/.test(move)) return 'walk';
  return 'idle';
}

export function pickGlbClip(animations = [], intent = 'idle') {
  const list = Array.isArray(animations) ? animations.filter(Boolean) : [];
  if (!list.length) return null;
  const want = String(intent || 'idle');
  if (want === 'walk') {
    const hit = list.find((c) => /walk|stride/.test(clipName(c)) && !/run|jog|sprint/.test(clipName(c)));
    return hit || pickGlbIdleClip(list);
  }
  if (want === 'run') {
    return (
      list.find((c) => /run|jog|sprint/.test(clipName(c))) ||
      list.find((c) => /walk|stride/.test(clipName(c))) ||
      pickGlbIdleClip(list)
    );
  }
  return pickGlbIdleClip(list);
}

export const GLB_CLIP_FADE_SEC = 0.28;

export function playGlbClipIntent(wrapper, intent = 'idle', fadeSec = GLB_CLIP_FADE_SEC) {
  const mixer = wrapper?.userData?.glbMixer;
  const clips = wrapper?.userData?.glbAnimations;
  if (!mixer || !Array.isArray(clips) || !clips.length) return null;
  const clip = pickGlbClip(clips, intent);
  if (!clip || typeof mixer.clipAction !== 'function') return null;
  const key = `${intent}:${clip.name || 'clip'}`;
  if (wrapper.userData.glbClipKey === key) return mixer;
  const prev = wrapper.userData.glbAction;
  const action = mixer.clipAction(clip);
  action.enabled = true;
  const fade = Math.max(0, Number(fadeSec) || 0);
  if (prev && prev !== action && fade > 0 && typeof prev.crossFadeTo === 'function') {
    action.reset?.();
    action.play?.();
    prev.crossFadeTo(action, fade, false);
  } else {
    if (prev && prev !== action && typeof prev.stop === 'function') prev.stop();
    action.reset?.();
    if (fade > 0 && typeof action.fadeIn === 'function') action.fadeIn(fade);
    action.play?.();
  }
  wrapper.userData.glbAction = action;
  wrapper.userData.glbClipIntent = intent;
  wrapper.userData.glbClipKey = key;
  wrapper.userData.glbIdleClip = clip.name || intent;
  return mixer;
}

export function attachGlbIdleMixer(wrapper, gltf, THREE, human = {}) {
  if (!wrapper || !gltf || !THREE?.AnimationMixer) return null;
  const list = Array.isArray(gltf.animations) ? gltf.animations.filter(Boolean) : [];
  wrapper.userData.glbAnimations = list;
  if (!list.length) {
    wrapper.userData.glbMixer = null;
    wrapper.userData.glbIdleClip = '';
    return null;
  }
  const root = wrapper.getObjectByName('glbFigure') || gltf.scene;
  if (!root) return null;
  const mixer = new THREE.AnimationMixer(root);
  wrapper.userData.glbMixer = mixer;
  captureGlbRootRest(wrapper);
  playGlbClipIntent(wrapper, glbClipIntentFromHuman(human));
  return mixer;
}

export function updateGlbMixers(groups = [], dt = 0) {
  const step = Number(dt) || 0;
  if (step <= 0) return;
  (groups || []).forEach((g) => {
    const mixer = g?.userData?.glbMixer;
    if (mixer && typeof mixer.update === 'function') mixer.update(step);
    freezeGlbRootMotion(g);
    lockGlbFootPlant(g);
    lockGlbFootSlide(g);
    polishGlbTwoBoneIk(g);
    lockGlbKnee(g);
    counterRotateGlbShoulderHip(g);
    dampGlbHipSway(g);
    settleGlbClavicle(g);
    dampGlbArmSwing(g);
    dampGlbElbow(g);
    dampGlbHeadBob(g);
    settleGlbWrist(g);
    curlGlbFingers(g);
    rollGlbToes(g);
    settleGlbHeel(g);
  });
}

/** Mixamo / ARKit / Wolf3D / Ready Player Me viseme morph aliases. */
export const MIXAMO_VISEME_MORPHS = {
  sil: ['viseme_sil', 'viseme_SIL', 'mouthClose', 'Mouth_Close'],
  open: [
    'mouthOpen', 'jawOpen', 'viseme_aa', 'viseme_AH', 'Mouth_Open', 'mouth_open',
    'Jaw_Open', 'jaw_open', 'ARKit_jawOpen', 'blendShape1.Jaw_Open', 'Wolf3D_Head.mouthOpen'
  ],
  wide: [
    'mouthWide', 'viseme_E', 'viseme_I', 'viseme_eh', 'viseme_ee', 'Mouth_Smile', 'mouthSmile',
    'mouthSmileLeft', 'mouthSmileRight', 'viseme_ih'
  ],
  O: ['viseme_O', 'viseme_oh', 'viseme_ou', 'mouthFunnel', 'Mouth_Funnel', 'mouthPucker'],
  U: ['viseme_U', 'viseme_uw', 'mouthPucker', 'Mouth_Pucker', 'viseme_ou'],
  M: ['viseme_PP', 'viseme_M', 'mouthClose', 'Mouth_Close', 'viseme_pp', 'mouthPressLeft', 'mouthPressRight'],
  F: ['viseme_FF', 'viseme_TH', 'viseme_F', 'viseme_th', 'Mouth_LowerDown', 'mouthLowerDownLeft'],
  L: ['viseme_DD', 'viseme_nn', 'viseme_L', 'viseme_dd', 'viseme_RR', 'tongueOut'],
  E: ['viseme_E', 'viseme_I', 'viseme_eh', 'viseme_ee']
};

export const RPM_VISEME_MORPHS = MIXAMO_VISEME_MORPHS;

export function resolveMorphIndex(dict, names = []) {
  if (!dict) return -1;
  const keys = Object.keys(dict);
  const norm = (s) => String(s || '').toLowerCase().replace(/^.*[./]/, '').replace(/[\s_-]/g, '');
  const wanted = names.map(norm);
  for (const k of keys) {
    if (wanted.includes(norm(k))) return dict[k];
  }
  return -1;
}

export function applyLipSyncMorphs(group, pose = {}) {
  if (!group) return;
  const open = Number(pose.mouthOpen) || 0;
  const wide = Number(pose.mouthWide) || 0;
  const viseme = String(pose.viseme || '');
  group.traverse((o) => {
    const dict = o.morphTargetDictionary;
    const inf = o.morphTargetInfluences;
    if (!dict || !inf) return;
    Object.keys(dict).forEach((name) => {
      inf[dict[name]] = 0;
    });
    const set = (keys, v) => {
      const idx = resolveMorphIndex(dict, keys);
      if (idx >= 0) inf[idx] = v;
    };
    set(MIXAMO_VISEME_MORPHS.open, open);
    set(MIXAMO_VISEME_MORPHS.wide, wide);
    if (!viseme || viseme === 'rest') {
      set(MIXAMO_VISEME_MORPHS.sil, 1);
    } else {
      if (viseme === 'E') set(MIXAMO_VISEME_MORPHS.E, Math.max(wide, Number(pose.hush) || Number(pose.velar) || 0.45));
      if (viseme === 'O') set(MIXAMO_VISEME_MORPHS.O, Math.max(open, 0.45));
      if (viseme === 'U') set(MIXAMO_VISEME_MORPHS.U, Math.max(open, Number(pose.funnel) || 0.4));
      if (viseme === 'AA') set(MIXAMO_VISEME_MORPHS.open, Math.max(open, 0.7));
      if (viseme === 'M') set(MIXAMO_VISEME_MORPHS.M, 1);
      if (viseme === 'F') set(MIXAMO_VISEME_MORPHS.F, Math.max(0.7, Number(pose.bite) || Number(pose.dental) || 0));
      if (viseme === 'L') set(MIXAMO_VISEME_MORPHS.L, Math.max(0.5, Number(pose.tongue) || Number(pose.bunch) || 0));
    }
  });
}
