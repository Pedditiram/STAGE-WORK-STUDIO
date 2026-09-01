/**
 * Mixamo/idle clip pick, keyed practicals, phoneme dictionary.
 */
import {
  pickGlbIdleClip,
  pickGlbClip,
  glbClipIntentFromHuman,
  updateGlbMixers,
  resolveMorphIndex,
  applyLipSyncMorphs,
  playGlbClipIntent,
  GLB_CLIP_FADE_SEC,
  freezeGlbRootMotion,
  captureGlbRootRest,
  lockGlbFootPlant,
  lockGlbFootSlide,
  polishGlbTwoBoneIk,
  counterRotateGlbShoulderHip,
  dampGlbArmSwing,
  dampGlbElbow,
  dampGlbHeadBob,
  settleGlbWrist,
  curlGlbFingers,
  rollGlbToes,
  settleGlbHeel,
  lockGlbKnee,
  dampGlbHipSway,
  settleGlbClavicle
} from '../src/utils/stageFigure.js';
import {
  practicalOnFactor,
  practicalTimelineLanes,
  patchPracticalPiece,
  parsePracticalSeconds,
  practicalIntensityAt,
  parsePracticalIntensity,
  kelvinToRgb,
  practicalKelvin,
  parsePracticalKelvin,
  applyGelToRgb,
  practicalGoboFactor,
  practicalBarnFactor,
  practicalShutterFactor,
  practicalBounceFactor,
  bounceCardPieceFromPractical,
  bounceCardColorRgb,
  bounceCardAngleRad,
  parsePracticalAngle,
  parsePracticalDistance,
  parsePracticalHeight,
  bounceCardTiltRad,
  parsePracticalTilt,
  bounceCardScale,
  parsePracticalSpread,
  bounceCardFeather,
  parsePracticalFeather,
  bounceCardSpillIntensity,
  parsePracticalSpill
} from '../src/utils/stagePracticals.js';
import {
  parsePromptPracticalKeys,
  parsePromptPracticalIntensity,
  parsePromptPracticalKelvin,
  parsePromptPracticalGel,
  parsePromptPracticalGobo,
  parsePromptPracticalBarn,
  parsePromptPracticalShutter,
  parsePromptPracticalBounce,
  parsePromptPracticalBounceColor,
  parsePromptPracticalBounceAngle,
  parsePromptPracticalBounceDistance,
  parsePromptPracticalBounceHeight,
  parsePromptPracticalBounceTilt,
  parsePromptPracticalBounceSpread,
  parsePromptPracticalBounceFeather,
  parsePromptPracticalBounceSpill
} from '../src/utils/stagePromptDirection.js';
import { inferPracticalPieces } from '../src/utils/stageEnvironment.js';
import {
  visemeFromPhoneme,
  speechVisemeSequence,
  visemeAt,
  visemeRuns,
  blendVisemeShapes,
  emphasizeVisemeShape,
  applyLateralLisp,
  applyWFunnel,
  applyFBite,
  applyLTongue,
  applyRBunch,
  applyThDental,
  applyChHush,
  applyNgVelar,
  speechVisemeUnits
} from '../src/utils/stageLipSync.js';

const idle = pickGlbIdleClip([
  { name: 'mixamo.com' },
  { name: 'Armature|idle' }
]);
if (idle?.name !== 'Armature|idle') {
  console.error('FAIL idle pick', idle);
  process.exit(1);
}
const mix = pickGlbIdleClip([{ name: 'mixamo.com' }]);
if (mix?.name !== 'mixamo.com') {
  console.error('FAIL mixamo fallback', mix);
  process.exit(1);
}

let mixerSteps = 0;
updateGlbMixers([{ userData: { glbMixer: { update: () => { mixerSteps += 1; } } } }], 0.016);
if (mixerSteps !== 1) {
  console.error('FAIL mixer update');
  process.exit(1);
}

if (practicalOnFactor({ off: 2 }, 1.5) !== 1 || practicalOnFactor({ off: 2 }, 2) !== 0) {
  console.error('FAIL on/off gate');
  process.exit(1);
}
if (practicalOnFactor({ on: 1, off: 3 }, 0.2) !== 0 || practicalOnFactor({ on: 1, off: 3 }, 1.2) !== 1) {
  console.error('FAIL on then off');
  process.exit(1);
}
if (practicalOnFactor({ keys: [{ t: 0, on: true }, { t: 1.5, on: false }] }, 1.6) !== 0) {
  console.error('FAIL keyframes off');
  process.exit(1);
}

const keys = parsePromptPracticalKeys('neon off at 2s. Rama looks at Kara.');
if (keys.neon?.off !== 2) {
  console.error('FAIL parse neon off', keys);
  process.exit(1);
}
if (parsePromptPracticalKeys('Rama looks at Kara.').neon) {
  console.error('FAIL invented neon keys');
  process.exit(1);
}

const pieces = inferPracticalPieces({ videoPrompt: 'torch from 1 to 3s in the courtyard' });
const torch = pieces.find((p) => p.kind === 'torch');
if (!torch || torch.on !== 1 || torch.off !== 3) {
  console.error('FAIL infer keyed torch', pieces);
  process.exit(1);
}

const lanes = practicalTimelineLanes({ durationSec: 5, environment: { pieces: [torch] } });
if (!lanes[0] || lanes[0].start !== 1 || lanes[0].end !== 3 || !/keyed/.test(lanes[0].label)) {
  console.error('FAIL keyed lane', lanes);
  process.exit(1);
}

if (visemeFromPhoneme('B') !== 'M' || visemeFromPhoneme('UW1') !== 'U') {
  console.error('FAIL phoneme map');
  process.exit(1);
}
const seq = speechVisemeSequence('HH EH L OW');
if (seq.join(',') !== 'E,E,L,O') {
  console.error('FAIL arpabet seq', seq);
  process.exit(1);
}
const th = visemeAt('the', 0.01, 0, 1);
if (th.viseme !== 'F') {
  console.error('FAIL th digraph', th);
  process.exit(1);
}

const clips = [{ name: 'idle' }, { name: 'walking' }, { name: 'running' }];
if (glbClipIntentFromHuman({ gaze: { eyeTarget: 'costar' }, movement: { type: 'hold' } }) !== 'idle') {
  console.error('FAIL look is not walk');
  process.exit(1);
}
if (pickGlbClip(clips, 'idle')?.name !== 'idle') {
  console.error('FAIL idle not walk when looking');
  process.exit(1);
}
if (pickGlbClip(clips, 'walk')?.name !== 'walking') {
  console.error('FAIL walk clip');
  process.exit(1);
}
if (pickGlbClip(clips, 'run')?.name !== 'running') {
  console.error('FAIL run clip');
  process.exit(1);
}
if (glbClipIntentFromHuman({ movement: { type: 'walk_forward' } }) !== 'walk') {
  console.error('FAIL walk intent');
  process.exit(1);
}

if (parsePracticalSeconds('') != null || parsePracticalSeconds('2.5') !== 2.5) {
  console.error('FAIL parse seconds');
  process.exit(1);
}
const patched = patchPracticalPiece(
  [{ id: 'practical_neon_0', kind: 'neon', practical: true }],
  'practical_neon_0',
  { on: 0, off: 2 }
);
if (patched[0].off !== 2) {
  console.error('FAIL patch practical', patched);
  process.exit(1);
}

const dict = { 'Wolf3D_Head.mouthOpen': 0, viseme_PP: 1 };
if (resolveMorphIndex(dict, ['mouthOpen']) !== 0) {
  console.error('FAIL mixamo morph alias');
  process.exit(1);
}
const inf = [0, 0];
applyLipSyncMorphs({
  traverse: (fn) => fn({ morphTargetDictionary: dict, morphTargetInfluences: inf })
}, { viseme: 'M', mouthOpen: 0 });
if (inf[1] !== 1) {
  console.error('FAIL mixamo PP viseme', inf);
  process.exit(1);
}

let faded = 0;
const idleAct = { play() {}, reset() {}, fadeIn() {}, crossFadeTo() { faded += 1; } };
const walkAct = { play() {}, reset() {}, fadeIn() {}, crossFadeTo() {} };
let clipN = 0;
const wrap = {
  userData: {
    glbMixer: { clipAction: () => { clipN += 1; return clipN === 1 ? idleAct : walkAct; } },
    glbAnimations: [{ name: 'idle' }, { name: 'walking' }]
  }
};
playGlbClipIntent(wrap, 'idle');
playGlbClipIntent(wrap, 'walk');
if (faded !== 1 || GLB_CLIP_FADE_SEC < 0.1) {
  console.error('FAIL crossfade', faded);
  process.exit(1);
}

if (parsePracticalIntensity('50') !== 0.5 || parsePracticalIntensity('0.4') !== 0.4) {
  console.error('FAIL intensity parse');
  process.exit(1);
}
if (practicalIntensityAt({ intensity: 0.5 }, 0) !== 0.5) {
  console.error('FAIL static intensity');
  process.exit(1);
}
const mid = practicalIntensityAt({ keys: [{ t: 0, intensity: 0 }, { t: 2, intensity: 1 }] }, 1);
if (Math.abs(mid - 0.5) > 1e-9) {
  console.error('FAIL intensity lerp', mid);
  process.exit(1);
}
if (parsePromptPracticalIntensity('neon 40%').neon !== 0.4) {
  console.error('FAIL prompt intensity', parsePromptPracticalIntensity('neon 40%'));
  process.exit(1);
}
if (parsePromptPracticalIntensity('Rama looks at Kara.').neon) {
  console.error('FAIL invented intensity');
  process.exit(1);
}

const rpm = [0, 0];
applyLipSyncMorphs({
  traverse: (fn) => fn({
    morphTargetDictionary: { viseme_sil: 0, viseme_I: 1 },
    morphTargetInfluences: rpm
  })
}, { viseme: 'rest' });
if (rpm[0] !== 1) {
  console.error('FAIL RPM sil', rpm);
  process.exit(1);
}

const hips = { name: 'mixamorigHips', position: { x: 0, y: 1, z: 0 }, userData: {} };
captureGlbRootRest({
  getObjectByName: () => hips,
  position: hips.position,
  traverse: (fn) => fn(hips)
});
hips.position.x = 1.4;
hips.position.z = -0.8;
freezeGlbRootMotion({
  getObjectByName: () => hips,
  position: hips.position,
  traverse: (fn) => fn(hips)
});
if (hips.position.x !== 0 || hips.position.z !== 0 || hips.position.y !== 1) {
  console.error('FAIL root freeze', hips.position);
  process.exit(1);
}

const warm = kelvinToRgb(2700);
const cool = kelvinToRgb(7500);
if (!(warm.r > warm.b) || !(cool.b > cool.r * 0.9)) {
  console.error('FAIL kelvin rgb', warm, cool);
  process.exit(1);
}
if (practicalKelvin({ practicalKind: 'torch' }) !== 1850) {
  console.error('FAIL torch kelvin default');
  process.exit(1);
}
if (parsePracticalKelvin('5600') !== 5600) {
  console.error('FAIL parse kelvin');
  process.exit(1);
}
if (parsePromptPracticalKelvin('warm lantern').lantern !== 2700) {
  console.error('FAIL warm lantern', parsePromptPracticalKelvin('warm lantern'));
  process.exit(1);
}
if (parsePromptPracticalKelvin('neon 6500k').neon !== 6500) {
  console.error('FAIL neon kelvin', parsePromptPracticalKelvin('neon 6500k'));
  process.exit(1);
}
if (parsePromptPracticalKelvin('Rama looks at Kara.').neon) {
  console.error('FAIL invented kelvin');
  process.exit(1);
}

const runs = visemeRuns(['M', 'M', 'AA']);
if (runs.length !== 2 || runs[0].n !== 2) {
  console.error('FAIL viseme runs', runs);
  process.exit(1);
}
const held = visemeAt('mmaaaa', 0.02, 0, 1);
if (held.viseme !== 'M') {
  console.error('FAIL viseme hold', held);
  process.exit(1);
}

const foot = { name: 'mixamorigLeftFoot', position: { x: 0, y: 0.08, z: 0.1 }, userData: {} };
const wrapFoot = {
  getObjectByName: () => wrapFoot,
  traverse: (fn) => fn(foot),
  position: { x: 0, y: 0, z: 0 }
};
captureGlbRootRest(wrapFoot);
foot.position.y = -0.4;
lockGlbFootPlant(wrapFoot);
if (foot.position.y < 0.08) {
  console.error('FAIL foot plant', foot.position);
  process.exit(1);
}
foot.position.x = 0.4;
lockGlbFootSlide(wrapFoot);
const plantedX = foot.position.x;
foot.position.x = 0.95;
lockGlbFootSlide(wrapFoot);
if (Math.abs(foot.position.x - plantedX) > 1e-9) {
  console.error('FAIL foot slide', foot.position);
  process.exit(1);
}
const shin = { name: 'mixamorigLeftLeg', position: { x: 0, y: 0.55, z: 0 }, userData: {} };
const wrapIk = {
  getObjectByName: () => wrapIk,
  traverse: (fn) => { fn(shin); fn(foot); }
};
captureGlbRootRest(wrapIk);
shin.position.y = 0.05;
lockGlbFootSlide(wrapIk);
polishGlbTwoBoneIk(wrapIk);
if (shin.position.y < 0.2) {
  console.error('FAIL two-bone IK', shin.position);
  process.exit(1);
}
const hip = { name: 'mixamorigHips', position: { x: 0, y: 1, z: 0 }, rotation: { y: 0 }, userData: {} };
const spine = { name: 'mixamorigSpine', position: { x: 0, y: 1.2, z: 0 }, rotation: { y: 0 }, userData: {} };
const wrapYaw = {
  getObjectByName: () => wrapYaw,
  traverse: (fn) => { fn(hip); fn(spine); }
};
captureGlbRootRest(wrapYaw);
hip.rotation.y = 0.4;
counterRotateGlbShoulderHip(wrapYaw);
if (!(spine.rotation.y < 0)) {
  console.error('FAIL shoulder/hip counter-rotate', hip.rotation, spine.rotation);
  process.exit(1);
}
const arm = { name: 'mixamorigLeftArm', position: { x: 0.2, y: 1.3, z: 0 }, rotation: { x: 0, z: 0 }, userData: {} };
const wrapArm = {
  getObjectByName: () => wrapArm,
  traverse: (fn) => fn(arm)
};
captureGlbRootRest(wrapArm);
arm.rotation.x = 1.2;
dampGlbArmSwing(wrapArm);
if (!(arm.rotation.x < 1.2 && arm.rotation.x > 0)) {
  console.error('FAIL arm swing damp', arm.rotation);
  process.exit(1);
}
dampGlbElbow(wrapArm);
if (Math.abs(arm.rotation.x - (1.2 * 0.42)) > 1e-6) {
  console.error('FAIL arm not elbow', arm.rotation);
  process.exit(1);
}
const elbow = { name: 'mixamorigLeftForeArm', position: { x: 0.35, y: 1.1, z: 0 }, rotation: { x: 0, z: 0 }, userData: {} };
const wrapElbow = {
  getObjectByName: () => wrapElbow,
  traverse: (fn) => fn(elbow)
};
captureGlbRootRest(wrapElbow);
elbow.rotation.x = 1.2;
dampGlbArmSwing(wrapElbow);
if (Math.abs(elbow.rotation.x - 1.2) > 1e-9) {
  console.error('FAIL elbow not arm swing', elbow.rotation);
  process.exit(1);
}
dampGlbElbow(wrapElbow);
if (!(elbow.rotation.x < 1.2 && elbow.rotation.x > 0) || Math.abs(elbow.rotation.x - (1.2 * 0.18)) > 1e-6) {
  console.error('FAIL elbow damp', elbow.rotation);
  process.exit(1);
}
const head = { name: 'mixamorigHead', position: { x: 0, y: 1.6, z: 0 }, rotation: { x: 0, y: 0.3 }, userData: {} };
const wrapHead = {
  getObjectByName: () => wrapHead,
  traverse: (fn) => fn(head)
};
captureGlbRootRest(wrapHead);
head.rotation.x = 0.5;
dampGlbHeadBob(wrapHead);
if (!(head.rotation.x < 0.5 && head.rotation.x > 0) || Math.abs(head.rotation.y - 0.3) > 1e-9) {
  console.error('FAIL head bob damp', head.rotation);
  process.exit(1);
}
const wrist = { name: 'mixamorigLeftHand', position: { x: 0.3, y: 1.1, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, userData: {} };
const wrapWrist = {
  getObjectByName: () => wrapWrist,
  traverse: (fn) => fn(wrist)
};
captureGlbRootRest(wrapWrist);
wrist.rotation.x = 1.2;
settleGlbWrist(wrapWrist);
if (!(wrist.rotation.x < 0.4 && wrist.rotation.x > 0)) {
  console.error('FAIL wrist settle', wrist.rotation);
  process.exit(1);
}
if (isArmSwingBoneNameCheck()) {
  console.error('FAIL wrist excluded from arm swing');
  process.exit(1);
}
const finger = { name: 'mixamorigLeftHandIndex1', position: { x: 0.32, y: 1.05, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, userData: {} };
const wrapFinger = {
  getObjectByName: () => wrapFinger,
  traverse: (fn) => fn(finger)
};
captureGlbRootRest(wrapFinger);
finger.rotation.x = 1.2;
curlGlbFingers(wrapFinger);
if (!(finger.rotation.x > 0.2 && finger.rotation.x < 0.5)) {
  console.error('FAIL finger curl', finger.rotation);
  process.exit(1);
}
settleGlbWrist(wrapFinger);
if (Math.abs(finger.rotation.x - (0 + 1.2 * 0.12 + 0.18)) > 1e-6) {
  console.error('FAIL finger not wrist', finger.rotation);
  process.exit(1);
}
const toe = { name: 'mixamorigLeftToeBase', position: { x: 0, y: 0.02, z: 0.12 }, rotation: { x: 0, y: 0, z: 0 }, userData: {} };
const wrapToe = {
  getObjectByName: () => wrapToe,
  traverse: (fn) => fn(toe)
};
captureGlbRootRest(wrapToe);
toe.rotation.x = 1.2;
rollGlbToes(wrapToe);
if (!(toe.rotation.x > 0.2 && toe.rotation.x < 0.5)) {
  console.error('FAIL toe roll', toe.rotation);
  process.exit(1);
}
lockGlbFootPlant(wrapToe);
if (Math.abs(toe.position.y - 0.02) > 1e-9) {
  console.error('FAIL toe not foot plant', toe.position);
  process.exit(1);
}
const heel = { name: 'mixamorigLeftFoot', position: { x: 0, y: 0.05, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, userData: {} };
const wrapHeel = {
  getObjectByName: () => wrapHeel,
  traverse: (fn) => fn(heel)
};
captureGlbRootRest(wrapHeel);
heel.rotation.x = 1.2;
settleGlbHeel(wrapHeel);
if (!(heel.rotation.x > 0.2 && heel.rotation.x < 0.5)) {
  console.error('FAIL heel settle', heel.rotation);
  process.exit(1);
}
rollGlbToes(wrapHeel);
if (Math.abs(heel.rotation.x - (0 + 1.2 * 0.2 + 0.08)) > 1e-6) {
  console.error('FAIL heel not toe', heel.rotation);
  process.exit(1);
}
const shinKnee = { name: 'mixamorigLeftLeg', position: { x: 0, y: 0.45, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, userData: {} };
const wrapKnee = {
  getObjectByName: () => wrapKnee,
  traverse: (fn) => fn(shinKnee)
};
captureGlbRootRest(wrapKnee);
shinKnee.rotation.x = 1.2;
lockGlbKnee(wrapKnee);
if (!(shinKnee.rotation.x > 0.2 && shinKnee.rotation.x < 0.4)) {
  console.error('FAIL knee lock', shinKnee.rotation);
  process.exit(1);
}
settleGlbHeel(wrapKnee);
if (Math.abs(shinKnee.rotation.x - (1.2 * 0.22)) > 1e-6) {
  console.error('FAIL knee not heel', shinKnee.rotation);
  process.exit(1);
}
const hipsSway = { name: 'mixamorigHips', position: { x: 0, y: 1, z: 0 }, rotation: { x: 0, y: 0.3, z: 0 }, userData: {} };
const wrapSway = {
  getObjectByName: () => wrapSway,
  traverse: (fn) => fn(hipsSway)
};
captureGlbRootRest(wrapSway);
hipsSway.rotation.z = 0.5;
dampGlbHipSway(wrapSway);
if (!(hipsSway.rotation.z < 0.5 && hipsSway.rotation.z > 0) || Math.abs(hipsSway.rotation.y - 0.3) > 1e-9) {
  console.error('FAIL hip sway damp', hipsSway.rotation);
  process.exit(1);
}
const clav = { name: 'mixamorigLeftShoulder', position: { x: 0.15, y: 1.4, z: 0 }, rotation: { x: 0, y: 0.2, z: 0 }, userData: {} };
const wrapClav = {
  getObjectByName: () => wrapClav,
  traverse: (fn) => fn(clav)
};
captureGlbRootRest(wrapClav);
clav.rotation.x = 0.8;
settleGlbClavicle(wrapClav);
if (!(clav.rotation.x < 0.8 && clav.rotation.x > 0) || Math.abs(clav.rotation.y - 0.2) > 1e-9) {
  console.error('FAIL clavicle settle', clav.rotation);
  process.exit(1);
}
dampGlbArmSwing(wrapClav);
if (Math.abs(clav.rotation.x - (0.8 * 0.28)) > 1e-6) {
  console.error('FAIL clavicle not arm', clav.rotation);
  process.exit(1);
}

function isArmSwingBoneNameCheck() {
  const hand = { name: 'mixamorigLeftHand', position: { x: 0, y: 0, z: 0 }, rotation: { x: 1.2, z: 0 }, userData: {} };
  const wrap = { getObjectByName: () => wrap, traverse: (fn) => fn(hand) };
  captureGlbRootRest(wrap);
  hand.rotation.x = 1.2;
  dampGlbArmSwing(wrap);
  return Math.abs(hand.rotation.x - 1.2) > 1e-9;
}

const gelled = applyGelToRgb({ r: 1, g: 1, b: 1 }, 'cto');
if (!(gelled.g < 0.8 && gelled.b < 0.5)) {
  console.error('FAIL cto gel', gelled);
  process.exit(1);
}
if (practicalGoboFactor({ gobo: 'blinds' }, 0.2) === 1 && practicalGoboFactor({ gobo: '' }, 0) !== 1) {
  console.error('FAIL gobo');
  process.exit(1);
}
if (parsePromptPracticalGel('lantern cto').lantern !== 'cto') {
  console.error('FAIL parse gel', parsePromptPracticalGel('lantern cto'));
  process.exit(1);
}
if (parsePromptPracticalGobo('bulb window gobo').bulb !== 'window') {
  console.error('FAIL parse gobo', parsePromptPracticalGobo('bulb window gobo'));
  process.exit(1);
}
if (practicalBarnFactor({ barn: 'tight' }) >= 1 || practicalBarnFactor({}) !== 1) {
  console.error('FAIL barn factor');
  process.exit(1);
}
if (parsePromptPracticalBarn('lantern barn doors').lantern !== 'tight') {
  console.error('FAIL parse barn', parsePromptPracticalBarn('lantern barn doors'));
  process.exit(1);
}
if (practicalShutterFactor({ shutter: 'closed' }) >= 0.2 || practicalShutterFactor({}) !== 1) {
  console.error('FAIL shutter factor');
  process.exit(1);
}
if (parsePromptPracticalShutter('lantern shutter closed').lantern !== 'closed') {
  console.error('FAIL parse shutter', parsePromptPracticalShutter('lantern shutter closed'));
  process.exit(1);
}
if (practicalBounceFactor({ bounce: 'fill' }) <= 1 || practicalBounceFactor({}) !== 1) {
  console.error('FAIL bounce factor');
  process.exit(1);
}
if (parsePromptPracticalBounce('lantern bounce').lantern !== 'bounce') {
  console.error('FAIL parse bounce', parsePromptPracticalBounce('lantern bounce'));
  process.exit(1);
}
if (parsePromptPracticalBounce('lantern bounce and fill').lantern !== 'mix') {
  console.error('FAIL parse bounce mix', parsePromptPracticalBounce('lantern bounce and fill'));
  process.exit(1);
}
if (!(practicalBounceFactor({ bounce: 'mix' }) > practicalBounceFactor({ bounce: 'fill' }))) {
  console.error('FAIL mix factor', practicalBounceFactor({ bounce: 'mix' }));
  process.exit(1);
}
const mixCard = bounceCardPieceFromPractical({ id: 'lantern-0', kind: 'lantern', bounce: 'mix', position: [0, 0, 0] }, 0);
if (!mixCard || mixCard.kind !== 'bounce_card') {
  console.error('FAIL mix bounce card', mixCard);
  process.exit(1);
}
const card = bounceCardPieceFromPractical({ id: 'lantern-0', kind: 'lantern', bounce: 'bounce', position: [0, 0, 0] }, 0);
if (!card || card.kind !== 'bounce_card') {
  console.error('FAIL bounce card', card);
  process.exit(1);
}
const bounced = inferPracticalPieces({ videoPrompt: 'lantern bounce in the courtyard' });
if (!bounced.some((p) => p.kind === 'bounce_card')) {
  console.error('FAIL infer bounce card', bounced);
  process.exit(1);
}
const warmRgb = bounceCardColorRgb('warm');
if (!(warmRgb[0] > warmRgb[2])) {
  console.error('FAIL bounce color rgb', warmRgb);
  process.exit(1);
}
if (parsePromptPracticalBounceColor('lantern bounce warm').lantern !== 'warm') {
  console.error('FAIL parse bounce color', parsePromptPracticalBounceColor('lantern bounce warm'));
  process.exit(1);
}
if (parsePromptPracticalBounceAngle('lantern bounce 45').lantern !== 45) {
  console.error('FAIL parse bounce angle', parsePromptPracticalBounceAngle('lantern bounce 45'));
  process.exit(1);
}
if (parsePracticalAngle('90') !== 80 || parsePracticalAngle('') != null) {
  console.error('FAIL parsePracticalAngle', parsePracticalAngle('90'));
  process.exit(1);
}
const angled = bounceCardPieceFromPractical(
  { id: 'lantern-0', kind: 'lantern', bounce: 'bounce', bounceAngle: 45, position: [0, 0, 0] },
  0
);
if (!angled || Math.abs(angled.rotationY - bounceCardAngleRad(45)) > 1e-9) {
  console.error('FAIL bounce card angle', angled);
  process.exit(1);
}
const inferredAngle = inferPracticalPieces({ videoPrompt: 'lantern bounce 45 in the courtyard' });
if (!inferredAngle.some((p) => p.kind === 'lantern' && p.bounceAngle === 45)) {
  console.error('FAIL infer bounce angle', inferredAngle);
  process.exit(1);
}
if (parsePromptPracticalBounceDistance('lantern bounce 1.2m').lantern !== 1.2) {
  console.error('FAIL parse bounce distance', parsePromptPracticalBounceDistance('lantern bounce 1.2m'));
  process.exit(1);
}
if (parsePromptPracticalBounceAngle('lantern bounce 1.2m').lantern != null) {
  console.error('FAIL angle vs distance', parsePromptPracticalBounceAngle('lantern bounce 1.2m'));
  process.exit(1);
}
if (parsePracticalDistance('3') !== 2.5 || parsePracticalDistance('') != null) {
  console.error('FAIL parsePracticalDistance', parsePracticalDistance('3'));
  process.exit(1);
}
const far = bounceCardPieceFromPractical(
  { id: 'lantern-0', kind: 'lantern', bounce: 'bounce', bounceDistance: 1.4, position: [0, 0, 0] },
  0
);
const near = bounceCardPieceFromPractical(
  { id: 'lantern-0', kind: 'lantern', bounce: 'bounce', position: [0, 0, 0] },
  0
);
if (!far || Math.abs(far.position[0]) <= Math.abs(near.position[0])) {
  console.error('FAIL bounce card distance', far, near);
  process.exit(1);
}
const inferredDist = inferPracticalPieces({ videoPrompt: 'lantern bounce 1.2m in the courtyard' });
if (!inferredDist.some((p) => p.kind === 'lantern' && p.bounceDistance === 1.2)) {
  console.error('FAIL infer bounce distance', inferredDist);
  process.exit(1);
}
if (parsePromptPracticalBounceHeight('lantern bounce height 0.5').lantern !== 0.5) {
  console.error('FAIL parse bounce height', parsePromptPracticalBounceHeight('lantern bounce height 0.5'));
  process.exit(1);
}
if (parsePromptPracticalBounceDistance('lantern bounce 0.4m high').lantern != null) {
  console.error('FAIL distance vs height', parsePromptPracticalBounceDistance('lantern bounce 0.4m high'));
  process.exit(1);
}
if (parsePracticalHeight('3') !== 1.8 || parsePracticalHeight('') != null) {
  console.error('FAIL parsePracticalHeight', parsePracticalHeight('3'));
  process.exit(1);
}
const high = bounceCardPieceFromPractical(
  { id: 'lantern-0', kind: 'lantern', bounce: 'bounce', bounceHeight: 0.9, position: [0, 0, 0] },
  0
);
const low = bounceCardPieceFromPractical(
  { id: 'lantern-0', kind: 'lantern', bounce: 'bounce', position: [0, 0, 0] },
  0
);
if (!high || high.position[1] <= low.position[1]) {
  console.error('FAIL bounce card height', high, low);
  process.exit(1);
}
const inferredHeight = inferPracticalPieces({ videoPrompt: 'lantern bounce height 0.5 in the courtyard' });
if (!inferredHeight.some((p) => p.kind === 'lantern' && p.bounceHeight === 0.5)) {
  console.error('FAIL infer bounce height', inferredHeight);
  process.exit(1);
}
if (parsePromptPracticalBounceTilt('lantern bounce tilt 15').lantern !== 15) {
  console.error('FAIL parse bounce tilt', parsePromptPracticalBounceTilt('lantern bounce tilt 15'));
  process.exit(1);
}
if (parsePromptPracticalBounceAngle('lantern bounce tilt 15').lantern != null) {
  console.error('FAIL angle vs tilt', parsePromptPracticalBounceAngle('lantern bounce tilt 15'));
  process.exit(1);
}
if (parsePracticalTilt('90') !== 45 || parsePracticalTilt('') != null) {
  console.error('FAIL parsePracticalTilt', parsePracticalTilt('90'));
  process.exit(1);
}
const tilted = bounceCardPieceFromPractical(
  { id: 'lantern-0', kind: 'lantern', bounce: 'bounce', bounceTilt: 20, position: [0, 0, 0] },
  0
);
if (!tilted || Math.abs(tilted.rotationX - bounceCardTiltRad(20)) > 1e-9) {
  console.error('FAIL bounce card tilt', tilted);
  process.exit(1);
}
const inferredTilt = inferPracticalPieces({ videoPrompt: 'lantern bounce tilt 15 in the courtyard' });
if (!inferredTilt.some((p) => p.kind === 'lantern' && p.bounceTilt === 15)) {
  console.error('FAIL infer bounce tilt', inferredTilt);
  process.exit(1);
}
if (parsePromptPracticalBounceSpread('lantern bounce spread 1.5').lantern !== 1.5) {
  console.error('FAIL parse bounce spread', parsePromptPracticalBounceSpread('lantern bounce spread 1.5'));
  process.exit(1);
}
if (parsePromptPracticalBounceSpread('lantern wide bounce').lantern !== 1.45) {
  console.error('FAIL parse wide bounce', parsePromptPracticalBounceSpread('lantern wide bounce'));
  process.exit(1);
}
if (parsePracticalSpread('4') !== 2.5 || parsePracticalSpread('') != null) {
  console.error('FAIL parsePracticalSpread', parsePracticalSpread('4'));
  process.exit(1);
}
const wideCard = bounceCardPieceFromPractical(
  { id: 'lantern-0', kind: 'lantern', bounce: 'bounce', bounceSpread: 1.6, position: [0, 0, 0] },
  0
);
const baseCard = bounceCardPieceFromPractical(
  { id: 'lantern-0', kind: 'lantern', bounce: 'bounce', position: [0, 0, 0] },
  0
);
if (!wideCard || wideCard.scale[0] <= baseCard.scale[0] || Math.abs(wideCard.scale[0] - bounceCardScale(1.6)[0]) > 1e-9) {
  console.error('FAIL bounce card spread', wideCard, baseCard);
  process.exit(1);
}
const inferredSpread = inferPracticalPieces({ videoPrompt: 'lantern bounce spread 1.5 in the courtyard' });
if (!inferredSpread.some((p) => p.kind === 'lantern' && p.bounceSpread === 1.5)) {
  console.error('FAIL infer bounce spread', inferredSpread);
  process.exit(1);
}
if (parsePromptPracticalBounceFeather('lantern bounce feather 0.6').lantern !== 0.6) {
  console.error('FAIL parse bounce feather', parsePromptPracticalBounceFeather('lantern bounce feather 0.6'));
  process.exit(1);
}
if (parsePromptPracticalBounceFeather('lantern soft bounce').lantern !== 0.72) {
  console.error('FAIL parse soft bounce', parsePromptPracticalBounceFeather('lantern soft bounce'));
  process.exit(1);
}
if (parsePracticalFeather('80') !== 0.8 || parsePracticalFeather('') != null) {
  console.error('FAIL parsePracticalFeather', parsePracticalFeather('80'));
  process.exit(1);
}
const softCard = bounceCardPieceFromPractical(
  { id: 'lantern-0', kind: 'lantern', bounce: 'bounce', bounceFeather: 0.8, position: [0, 0, 0] },
  0
);
if (!softCard || softCard.bounceFeather !== 0.8 || bounceCardFeather(softCard.bounceFeather) !== 0.8) {
  console.error('FAIL bounce card feather', softCard);
  process.exit(1);
}
const inferredFeather = inferPracticalPieces({ videoPrompt: 'lantern bounce feather 0.6 in the courtyard' });
if (!inferredFeather.some((p) => p.kind === 'lantern' && p.bounceFeather === 0.6)) {
  console.error('FAIL infer bounce feather', inferredFeather);
  process.exit(1);
}
if (parsePromptPracticalBounceSpill('lantern bounce spill 0.4').lantern !== 0.4) {
  console.error('FAIL parse bounce spill', parsePromptPracticalBounceSpill('lantern bounce spill 0.4'));
  process.exit(1);
}
if (parsePromptPracticalBounceSpill('lantern floor spill bounce').lantern !== 0.65) {
  console.error('FAIL parse floor spill', parsePromptPracticalBounceSpill('lantern floor spill bounce'));
  process.exit(1);
}
if (parsePromptPracticalBounceFeather('lantern bounce spill 0.4').lantern != null) {
  console.error('FAIL spill not feather', parsePromptPracticalBounceFeather('lantern bounce spill 0.4'));
  process.exit(1);
}
if (parsePromptPracticalBounceAngle('lantern bounce spill 0.4').lantern != null) {
  console.error('FAIL spill not angle', parsePromptPracticalBounceAngle('lantern bounce spill 0.4'));
  process.exit(1);
}
if (parsePracticalSpill('40') !== 0.4 || parsePracticalSpill('') != null) {
  console.error('FAIL parsePracticalSpill', parsePracticalSpill('40'));
  process.exit(1);
}
const spillCard = bounceCardPieceFromPractical(
  { id: 'lantern-0', kind: 'lantern', bounce: 'bounce', bounceSpill: 0.4, position: [0, 0, 0] },
  0
);
if (!spillCard || spillCard.bounceSpill !== 0.4 || bounceCardSpillIntensity(0.4, 'bounce') !== 0.12 * 0.4) {
  console.error('FAIL bounce card spill', spillCard, bounceCardSpillIntensity(0.4, 'bounce'));
  process.exit(1);
}
const inferredSpill = inferPracticalPieces({ videoPrompt: 'lantern bounce spill 0.4 in the courtyard' });
if (!inferredSpill.some((p) => p.kind === 'lantern' && p.bounceSpill === 0.4)
  || !inferredSpill.some((p) => p.kind === 'bounce_card' && p.bounceSpill === 0.4)) {
  console.error('FAIL infer bounce spill', inferredSpill);
  process.exit(1);
}

const blended = blendVisemeShapes(
  { viseme: 'M', mouthOpen: 0, mouthWide: 0, jaw: 0 },
  { viseme: 'AA', mouthOpen: 1, mouthWide: 1, jaw: 1 },
  0.5
);
if (blended.viseme !== 'AA' || Math.abs(blended.mouthOpen - 0.5) > 1e-9) {
  console.error('FAIL coarticulation blend', blended);
  process.exit(1);
}
const stressed = emphasizeVisemeShape({ viseme: 'AA', mouthOpen: 0.5, mouthWide: 0.4, jaw: 0.2 }, 1);
if (!(stressed.mouthOpen > 0.5)) {
  console.error('FAIL viseme stress', stressed);
  process.exit(1);
}
const aa1 = visemeAt('AH1 AH1', 0.2, 0, 1);
const aa0 = visemeAt('AH0 AH0', 0.2, 0, 1);
if (!(aa1.mouthOpen >= aa0.mouthOpen)) {
  console.error('FAIL stressed vowel viseme', aa1, aa0);
  process.exit(1);
}
const popEarly = visemeAt('B AA', 0.08, 0, 1);
const popLate = visemeAt('B AA', 0.46, 0, 1);
if (!(popLate.mouthOpen > popEarly.mouthOpen)) {
  console.error('FAIL plosive pop', popEarly, popLate);
  process.exit(1);
}
const inhale = visemeAt('SIL AA', 0.04, 0, 1);
if (!(inhale.viseme === 'rest' && inhale.mouthOpen > 0)) {
  console.error('FAIL inhale rest', inhale);
  process.exit(1);
}
if (!(Number(inhale.breath) > 0)) {
  console.error('FAIL breath noise', inhale);
  process.exit(1);
}
const nasal = visemeAt('N N', 0.2, 0, 1);
const plosive = visemeAt('B B', 0.2, 0, 1);
if (!(nasal.nasal > 0) || plosive.nasal) {
  console.error('FAIL nasal hum', nasal, plosive);
  process.exit(1);
}
const lisp = visemeAt('S S', 0.2, 0, 1);
const vowelE = visemeAt('EH EH', 0.2, 0, 1);
if (!(lisp.lisp > 0) || vowelE.lisp) {
  console.error('FAIL lateral lisp', lisp, vowelE);
  process.exit(1);
}
const seeUnits = speechVisemeUnits('see');
if (!seeUnits.some((u) => u.lisp) || !seeUnits.some((u) => !u.lisp && u.id === 'E')) {
  console.error('FAIL lisp not all E', seeUnits);
  process.exit(1);
}
const lisped = applyLateralLisp({ viseme: 'E', mouthOpen: 0.38, mouthWide: 0.7, jaw: 0.1 }, { id: 'E', lisp: 1 });
if (!(lisped.lisp > 0 && lisped.mouthWide > 0.7)) {
  console.error('FAIL applyLateralLisp', lisped);
  process.exit(1);
}
const funnel = visemeAt('W W', 0.2, 0, 1);
const vowelU = visemeAt('UW UW', 0.2, 0, 1);
if (!(funnel.funnel > 0) || vowelU.funnel) {
  console.error('FAIL w funnel', funnel, vowelU);
  process.exit(1);
}
const weUnits = speechVisemeUnits('we');
if (!weUnits.some((u) => u.funnel) || !weUnits.some((u) => !u.funnel)) {
  console.error('FAIL funnel not all U', weUnits);
  process.exit(1);
}
const funneled = applyWFunnel({ viseme: 'U', mouthOpen: 0.32, mouthWide: 0.4, jaw: 0.1 }, { id: 'U', funnel: 1 });
if (!(funneled.funnel > 0 && funneled.mouthWide < 0.4)) {
  console.error('FAIL applyWFunnel', funneled);
  process.exit(1);
}
const bite = visemeAt('F F', 0.2, 0, 1);
const dental = visemeAt('TH TH', 0.2, 0, 1);
if (!(bite.bite > 0) || dental.bite) {
  console.error('FAIL f bite', bite, dental);
  process.exit(1);
}
if (!(dental.dental > 0) || bite.dental) {
  console.error('FAIL th dental', bite, dental);
  process.exit(1);
}
const theUnits = speechVisemeUnits('the');
if (theUnits.some((u) => u.bite) || !theUnits.some((u) => u.dental && u.id === 'F')) {
  console.error('FAIL dental not bite', theUnits);
  process.exit(1);
}
const dented = applyThDental({ viseme: 'F', mouthOpen: 0.08, mouthWide: 0.2, jaw: 0.02 }, { id: 'F', dental: 1 });
if (!(dented.dental > 0 && dented.mouthOpen >= 0.14)) {
  console.error('FAIL applyThDental', dented);
  process.exit(1);
}
const bitten = applyFBite({ viseme: 'F', mouthOpen: 0.12, mouthWide: 0.2, jaw: 0.04 }, { id: 'F', bite: 1 });
if (!(bitten.bite > 0 && bitten.mouthOpen <= 0.1)) {
  console.error('FAIL applyFBite', bitten);
  process.exit(1);
}
const tongue = visemeAt('L L', 0.2, 0, 1);
const tap = visemeAt('T T', 0.2, 0, 1);
if (!(tongue.tongue > 0) || tap.tongue) {
  console.error('FAIL l tongue', tongue, tap);
  process.exit(1);
}
const letUnits = speechVisemeUnits('let');
if (!letUnits.some((u) => u.tongue) || !letUnits.some((u) => u.id === 'L' && !u.tongue)) {
  console.error('FAIL tongue not all L', letUnits);
  process.exit(1);
}
const tongued = applyLTongue({ viseme: 'L', mouthOpen: 0.1, mouthWide: 0.2, jaw: 0.02 }, { id: 'L', tongue: 1 });
if (!(tongued.tongue > 0 && tongued.mouthOpen >= 0.18)) {
  console.error('FAIL applyLTongue', tongued);
  process.exit(1);
}
const bunch = visemeAt('R R', 0.2, 0, 1);
if (!(bunch.bunch > 0) || tongue.bunch) {
  console.error('FAIL r bunch', bunch, tongue);
  process.exit(1);
}
const redUnits = speechVisemeUnits('red');
if (!redUnits.some((u) => u.bunch) || redUnits.some((u) => u.tongue)) {
  console.error('FAIL bunch not L', redUnits);
  process.exit(1);
}
const bunched = applyRBunch({ viseme: 'L', mouthOpen: 0.22, mouthWide: 0.5, jaw: 0.08 }, { id: 'L', bunch: 1 });
if (!(bunched.bunch > 0 && bunched.mouthWide < 0.5)) {
  console.error('FAIL applyRBunch', bunched);
  process.exit(1);
}
const hush = visemeAt('CH CH', 0.2, 0, 1);
const hushVowel = visemeAt('EH EH', 0.2, 0, 1);
const lispSh = visemeAt('SH SH', 0.2, 0, 1);
if (!(hush.hush > 0) || hushVowel.hush || lispSh.hush) {
  console.error('FAIL ch hush', hush, hushVowel, lispSh);
  process.exit(1);
}
const chipUnits = speechVisemeUnits('chip');
if (!chipUnits.some((u) => u.hush) || chipUnits.some((u) => u.lisp)) {
  console.error('FAIL hush not lisp', chipUnits);
  process.exit(1);
}
const hushed = applyChHush({ viseme: 'E', mouthOpen: 0.38, mouthWide: 0.7, jaw: 0.1 }, { id: 'E', hush: 1 });
if (!(hushed.hush > 0 && hushed.mouthWide < 0.7)) {
  console.error('FAIL applyChHush', hushed);
  process.exit(1);
}
const velar = visemeAt('NG NG', 0.2, 0, 1);
const nasalN = visemeAt('N N', 0.2, 0, 1);
if (!(velar.velar > 0) || nasalN.velar) {
  console.error('FAIL ng velar', velar, nasalN);
  process.exit(1);
}
const singUnits = speechVisemeUnits('sing');
if (!singUnits.some((u) => u.velar) || singUnits.some((u) => u.velar && u.nasal && u.id === 'L')) {
  console.error('FAIL velar not N', singUnits);
  process.exit(1);
}
const velared = applyNgVelar({ viseme: 'E', mouthOpen: 0.38, mouthWide: 0.7, jaw: 0.1 }, { id: 'E', velar: 1 });
if (!(velared.velar > 0 && velared.mouthOpen < 0.38)) {
  console.error('FAIL applyNgVelar', velared);
  process.exit(1);
}

console.log('OK — Mixamo idle/walk/run, practical keys, Mixamo visemes');
