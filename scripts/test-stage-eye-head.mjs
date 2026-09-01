/**
 * Phase 8 gaze: look ≠ walk; camera / costar / hold inference.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inferEyeHead, aimGaze, normalizeGaze } from '../src/utils/stageEyeHead.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const moveSrc = fs.readFileSync(path.join(root, 'src/utils/stageCharacterMove.js'), 'utf8');
if (!moveSrc.includes("if (/looks? at|gazes?|stares?/.test(text) && !/walk|approach|move|go(es)? toward/.test(text))")) {
  console.error('FAIL: look ≠ walk guard missing from stageCharacterMove');
  process.exit(1);
}

const humans = [
  { id: 'Rama', position: [-0.5, 0, 0], rotationY: 0 },
  { id: 'Kara', position: [0.6, 0, 0.1], rotationY: 0 }
];

const gazeCam = inferEyeHead({
  characterEyeLooks: '[Eye Look: Direct Eye Contact with Camera Lens]',
  characterMovement: '',
  action: 'Rama looks at the camera'
}, 0, humans);
if (gazeCam.eyeTarget !== 'camera') {
  console.error('FAIL: expected camera gaze', gazeCam);
  process.exit(1);
}

const gazeCostar = inferEyeHead({
  characterEyeLooks: '[Eye Look: Kara]',
  coArtistInteraction: 'Rama looks at Kara',
  characterMovement: ''
}, 0, humans);
if (gazeCostar.eyeTarget !== 'costar' || gazeCostar.eyeTargetId !== 'Kara') {
  console.error('FAIL: expected costar Kara', gazeCostar);
  process.exit(1);
}

const empty = inferEyeHead({}, 0, humans);
if (!empty.needsDirection || empty.eyeTarget !== 'hold') {
  console.error('FAIL: empty look should be Needs Direction hold', empty);
  process.exit(1);
}

const aimed = aimGaze(
  { ...humans[0], gaze: normalizeGaze({ eyeTarget: 'camera', headDirection: 'follow_eyes' }) },
  { humans, cameras: [{ position: [-2.2, 1.35, 3.2] }] },
  humans[0].position,
  0,
  {}
);
if (!Number.isFinite(aimed.headY) || Math.abs(aimed.headY) < 0.05) {
  console.error('FAIL: camera look should turn head', aimed);
  process.exit(1);
}

console.log('OK — look ≠ walk guard; camera/costar gaze; head aims at camera');
