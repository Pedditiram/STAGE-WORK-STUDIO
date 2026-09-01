/**
 * Flick-style production mannequin — mustard yellow segments + purple joints.
 * Matches industry reference: segmented doll, fists, shoe-feet, standing rest pose.
 */
import * as THREE from 'three';
import { defaultPose, normalizePose } from './mannequinPose';

const YELLOW = '#e8b84a';
const PURPLE = '#9b4dc8';

function shellMat(hex = YELLOW) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(hex),
    roughness: 0.46,
    metalness: 0.06,
    envMapIntensity: 0.4
  });
}

function jointMat(hex = PURPLE) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(hex),
    roughness: 0.38,
    metalness: 0.14,
    envMapIntensity: 0.25
  });
}

function mesh(geo, mat) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  m.userData.mannequinPart = true;
  return m;
}

/** Rounded limb segment (capsule along +Y from origin). */
function limbSeg(mat, radius, len, segs = 16) {
  const m = mesh(
    new THREE.CapsuleGeometry(radius, Math.max(0.01, len - radius * 2), 8, segs),
    mat
  );
  m.position.y = len / 2;
  return m;
}

function cinematicHand(shell, side = 'R') {
  const sign = side === 'L' ? -1 : 1;
  const g = new THREE.Group();
  g.name = `hand${side}`;
  const palm = mesh(new THREE.BoxGeometry(0.068, 0.02, 0.088), shell);
  palm.position.set(0, 0.012, 0.018);
  g.add(palm);
  const lengths = [0.048, 0.058, 0.054, 0.042];
  for (let i = 0; i < 4; i++) {
    const finger = new THREE.Group();
    finger.name = `finger${side}${i}`;
    const x = sign * (-0.024 + i * 0.016);
    finger.position.set(x, 0.02, 0.055);
    finger.rotation.x = 0.35;
    const len = lengths[i];
    const cap = mesh(new THREE.CapsuleGeometry(0.0075, Math.max(0.012, len - 0.015), 4, 8), shell);
    cap.position.y = len / 2;
    finger.add(cap);
    g.add(finger);
  }
  const thumb = new THREE.Group();
  thumb.name = `thumb${side}`;
  thumb.position.set(sign * 0.038, 0.008, 0.012);
  thumb.rotation.z = sign * 0.85;
  thumb.rotation.x = 0.25;
  const thumbCap = mesh(new THREE.CapsuleGeometry(0.009, 0.028, 4, 8), shell);
  thumbCap.position.y = 0.02;
  thumb.add(thumbCap);
  g.add(thumb);
  return g;
}

function shoe(shell) {
  const g = new THREE.Group();
  const sole = mesh(new THREE.BoxGeometry(0.095, 0.05, 0.2), shell);
  sole.position.set(0, 0.025, 0.045);
  // taper toe slightly with a second block
  const toe = mesh(new THREE.BoxGeometry(0.085, 0.04, 0.08), shell);
  toe.position.set(0, 0.025, 0.12);
  g.add(sole, toe);
  return g;
}

function makeNameplate(text) {
  const label = String(text || '').trim().slice(0, 28);
  if (!label) return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 256, 64);
  ctx.fillStyle = 'rgba(12,11,10,0.72)';
  ctx.fillRect(8, 12, 240, 40);
  ctx.font = '600 22px Figtree, system-ui, sans-serif';
  ctx.fillStyle = '#f4ecde';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 128, 32);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })
  );
  sprite.name = 'nameplate';
  sprite.scale.set(0.72, 0.18, 1);
  sprite.position.set(0, 1.92, 0);
  sprite.userData.skipPick = true;
  return sprite;
}

/**
 * @param {string} [colorHex]
 * @param {object} [poseIn]
 * @param {{ name?: string, charAssetId?: string, figureSource?: string }} [opts]
 */
export function makeStudioMannequin(colorHex, poseIn, opts = {}) {
  const group = new THREE.Group();
  group.userData.kind = 'human';
  group.userData.mannequinStyle = 'cinematic-segmented';
  group.userData.figureSource = opts.figureSource || 'mannequin';
  group.userData.charAssetId = opts.charAssetId || '';
  group.userData.glbUrl = opts.glbUrl || '';

  const shellHex = /^#[0-9a-fA-F]{6}$/.test(String(colorHex || '')) && !/#9b|#a855|#c026/i.test(String(colorHex))
    ? colorHex
    : YELLOW;
  const shell = shellMat(shellHex);
  const joint = jointMat(PURPLE);

  // ——— Hips / pelvis (V-shaped block) ———
  const hips = new THREE.Group();
  hips.name = 'hips';
  hips.position.y = 0.94;
  const pelvis = mesh(new THREE.SphereGeometry(0.12, 18, 14), shell);
  pelvis.scale.set(1.35, 0.72, 0.9);
  hips.add(pelvis);
  // hip joint cores (purple)
  const hipJL = mesh(new THREE.SphereGeometry(0.055, 14, 12), joint);
  hipJL.position.set(-0.11, -0.02, 0);
  const hipJR = hipJL.clone();
  hipJR.position.x = 0.11;
  hips.add(hipJL, hipJR);

  // ——— Spine / waist (purple connector) + abdomen ———
  const spine = new THREE.Group();
  spine.name = 'spine';
  const waist = mesh(new THREE.CylinderGeometry(0.07, 0.085, 0.08, 14), joint);
  waist.position.y = 0.06;
  spine.add(waist);
  const abdomen = mesh(new THREE.CapsuleGeometry(0.1, 0.14, 6, 14), shell);
  abdomen.position.y = 0.2;
  abdomen.scale.set(1.15, 1, 0.85);
  spine.add(abdomen);

  // ——— Chest ———
  const chest = new THREE.Group();
  chest.name = 'chest';
  chest.position.y = 0.36;
  const rib = mesh(new THREE.SphereGeometry(0.145, 20, 16), shell);
  rib.scale.set(1.35, 0.95, 0.78);
  chest.add(rib);
  // pec plates
  const pecL = mesh(new THREE.SphereGeometry(0.07, 14, 12), shell);
  pecL.position.set(-0.08, 0.02, 0.085);
  pecL.scale.set(1.25, 0.85, 0.65);
  const pecR = pecL.clone();
  pecR.position.x = 0.08;
  chest.add(pecL, pecR);

  // ——— Neck (purple) + head ———
  const neck = new THREE.Group();
  neck.name = 'neck';
  neck.position.y = 0.14;
  const neckCore = mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.1, 12), joint);
  neckCore.position.y = 0.05;
  neck.add(neckCore);
  const head = new THREE.Group();
  head.name = 'head';
  head.position.y = 0.16;
  const skull = mesh(new THREE.SphereGeometry(0.125, 28, 22), shell);
  skull.scale.set(0.95, 1.12, 0.95);
  head.add(skull);
  const eyeMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1c1410'),
    roughness: 0.28,
    metalness: 0.08
  });
  const makeEye = (side) => {
    const g = new THREE.Group();
    g.name = side === 'L' ? 'eyeL' : 'eyeR';
    g.position.set(side === 'L' ? -0.038 : 0.038, 0.018, 0.1);
    g.add(mesh(new THREE.SphereGeometry(0.015, 10, 8), eyeMat));
    return g;
  };
  const eyeL = makeEye('L');
  const eyeR = makeEye('R');
  const browMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#3a2418'),
    roughness: 0.5,
    metalness: 0.04
  });
  const makeBrow = (side) => {
    const g = new THREE.Group();
    g.name = side === 'L' ? 'browL' : 'browR';
    g.position.set(side === 'L' ? -0.038 : 0.038, 0.052, 0.108);
    g.add(mesh(new THREE.BoxGeometry(0.038, 0.008, 0.01), browMat));
    return g;
  };
  const browL = makeBrow('L');
  const browR = makeBrow('R');
  const mouth = new THREE.Group();
  mouth.name = 'mouth';
  mouth.position.set(0, -0.042, 0.112);
  mouth.add(mesh(new THREE.BoxGeometry(0.042, 0.012, 0.012), browMat));
  head.add(eyeL, eyeR, browL, browR, mouth);
  neck.add(head);
  chest.add(neck);

  // ——— Arms ———
  const makeArm = (side) => {
    const sign = side === 'L' ? -1 : 1;
    const shoulder = new THREE.Group();
    shoulder.name = `shoulder${side}`;
    shoulder.position.set(sign * 0.2, 0.05, 0);
    // purple shoulder ball
    shoulder.add(mesh(new THREE.SphereGeometry(0.058, 14, 12), joint));

    const upper = new THREE.Group();
    upper.name = `upperArm${side}`;
    upper.add(limbSeg(shell, 0.048, 0.28, 14));

    const elbow = new THREE.Group();
    elbow.name = `elbow${side}`;
    elbow.position.y = 0.28;
    elbow.add(mesh(new THREE.SphereGeometry(0.045, 12, 10), joint));

    const lower = new THREE.Group();
    lower.name = `lowerArm${side}`;
    lower.add(limbSeg(shell, 0.04, 0.26, 14));
    // wrist purple
    const wrist = mesh(new THREE.SphereGeometry(0.032, 10, 8), joint);
    wrist.position.y = 0.26;
    lower.add(wrist);
    const hand = cinematicHand(shell, side);
    hand.position.y = 0.28;
    lower.add(hand);

    elbow.add(lower);
    upper.add(elbow);
    shoulder.add(upper);
    return shoulder;
  };

  chest.add(makeArm('L'), makeArm('R'));
  spine.add(chest);
  hips.add(spine);

  // ——— Legs ———
  const makeLeg = (side) => {
    const sign = side === 'L' ? -1 : 1;
    const thighRoot = new THREE.Group();
    thighRoot.name = `thigh${side}`;
    thighRoot.position.set(sign * 0.11, 0, 0);

    const thighLen = 0.40;
    const thighBone = mesh(
      new THREE.CapsuleGeometry(0.06, Math.max(0.02, thighLen - 0.12), 6, 14),
      shell
    );
    thighBone.position.y = -thighLen / 2;
    thighRoot.add(thighBone);

    const knee = new THREE.Group();
    knee.name = `shin${side}`;
    knee.position.y = -thighLen;
    knee.add(mesh(new THREE.SphereGeometry(0.048, 12, 10), joint));

    const shinLen = 0.38;
    const shinBone = mesh(
      new THREE.CapsuleGeometry(0.048, Math.max(0.02, shinLen - 0.1), 6, 14),
      shell
    );
    shinBone.position.y = -shinLen / 2;
    knee.add(shinBone);

    // ankle purple
    const ankle = mesh(new THREE.SphereGeometry(0.036, 10, 8), joint);
    ankle.position.y = -shinLen;
    knee.add(ankle);

    const foot = shoe(shell);
    foot.position.y = -shinLen - 0.01;
    knee.add(foot);

    thighRoot.add(knee);
    return thighRoot;
  };

  hips.add(makeLeg('L'), makeLeg('R'));
  group.add(hips);

  const plate = typeof document !== 'undefined' ? makeNameplate(opts.name || opts.charAssetId) : null;
  if (plate) group.add(plate);

  group.userData.joints = {
    hips,
    spine,
    chest,
    neck,
    head,
    eyeL,
    eyeR,
    browL,
    browR,
    mouth,
    upperArmL: group.getObjectByName('upperArmL'),
    lowerArmL: group.getObjectByName('lowerArmL'),
    upperArmR: group.getObjectByName('upperArmR'),
    lowerArmR: group.getObjectByName('lowerArmR'),
    thighL: group.getObjectByName('thighL'),
    shinL: group.getObjectByName('shinL'),
    thighR: group.getObjectByName('thighR'),
    shinR: group.getObjectByName('shinR')
  };

  // Standing rest pose (arms down) — matches reference
  applyStudioMannequinPose(group, poseIn || defaultPose());
  return group;
}

export function applyStudioMannequinPose(group, poseIn) {
  const pose = normalizePose(poseIn);
  const j = group?.userData?.joints;
  if (!j) return;
  if (j.spine) j.spine.rotation.x = pose.spine;
  if (j.chest) j.chest.rotation.x = pose.chest;
  if (j.head) {
    j.head.rotation.x = pose.headX;
    j.head.rotation.y = pose.headY;
  }
  if (j.eyeL) {
    j.eyeL.rotation.x = pose.eyeX || 0;
    j.eyeL.rotation.y = pose.eyeY || 0;
    const es = 0.55 + 0.55 * (pose.eyeOpen ?? 1);
    j.eyeL.scale.setScalar(es);
  }
  if (j.eyeR) {
    j.eyeR.rotation.x = pose.eyeX || 0;
    j.eyeR.rotation.y = pose.eyeY || 0;
    const es = 0.55 + 0.55 * (pose.eyeOpen ?? 1);
    j.eyeR.scale.setScalar(es);
  }
  if (j.browL) j.browL.rotation.z = (pose.brow || 0) * 0.45;
  if (j.browR) j.browR.rotation.z = -(pose.brow || 0) * 0.45;
  if (j.mouth) {
    j.mouth.scale.set(
      1 + (pose.mouthSmile || 0) * 0.55 + (pose.mouthWide || 0) * 0.35,
      0.45 + (pose.mouthOpen || 0) * 1.5,
      1
    );
    j.mouth.position.y = -0.042 - (pose.jaw || 0) * 0.04;
  }
  // Arms hang down at rest (π·0.92 bias)
  if (j.upperArmL) {
    j.upperArmL.rotation.x = Math.PI * 0.92 + pose.upperArmLX;
    j.upperArmL.rotation.z = pose.upperArmLZ;
  }
  if (j.lowerArmL) j.lowerArmL.rotation.x = pose.lowerArmL;
  if (j.upperArmR) {
    j.upperArmR.rotation.x = Math.PI * 0.92 + pose.upperArmRX;
    j.upperArmR.rotation.z = pose.upperArmRZ;
  }
  if (j.lowerArmR) j.lowerArmR.rotation.x = pose.lowerArmR;
  if (j.thighL) j.thighL.rotation.x = pose.thighLX;
  if (j.shinL) j.shinL.rotation.x = pose.shinL;
  if (j.thighR) j.thighR.rotation.x = pose.thighRX;
  if (j.shinR) j.shinR.rotation.x = pose.shinR;
  group.userData.pose = pose;
}

export const MANNEQUIN_SHELL = YELLOW;
export const MANNEQUIN_JOINT = PURPLE;
