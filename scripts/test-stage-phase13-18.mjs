/**
 * Phases 13–18: parse, prompt compose, continuity, validate, export names.
 */
import { parsePromptCamera } from '../src/utils/stagePromptCamera.js';
import {
  buildShotDirectorData,
  validateShotDirectorData,
  composeVideoPromptFromDirectorData,
  matchPreviousStagePlan
} from '../src/utils/stageDirectorData.js';

const cam = parsePromptCamera('slow push in 35mm medium shot. Rama looks at Kara.');
if (cam.move !== 'push' || cam.focalMm !== 35) {
  console.error('FAIL parse camera', cam);
  process.exit(1);
}

const holdCam = parsePromptCamera('locked off hold. Rama looks at Kara.');
if (holdCam.move !== 'static') {
  console.error('FAIL hold must not invent orbit', holdCam);
  process.exit(1);
}

const shot = {
  sceneShotId: 'SC01_SH02',
  cameraMotionTag: '[Camera: Static]',
  characterEyeLooks: 'looks at Kara'
};
const plan = {
  durationSec: 5,
  focalMm: 35,
  cameras: [{ position: [-2, 1.4, 3], lookAt: [0, 1.2, 0], focalMm: 35, animation: { type: 'static' } }],
  humans: [{
    id: 'Rama',
    position: [-0.5, 0, 0],
    rotationY: 0,
    gaze: { eyeTarget: 'costar' },
    movement: { type: 'hold' },
    expression: { id: 'determined' },
    interaction: { type: 'look_at' }
  }],
  environment: { setId: 'street', timeOfDay: 'sunset' },
  dialogue: []
};
const data = buildShotDirectorData({ shot, plan, shotIndex: 1, projectTitle: 'TEST' });
const check = validateShotDirectorData(data);
if (check.blocking.length) {
  console.error('FAIL hard-blocked', check);
  process.exit(1);
}
const prompt = composeVideoPromptFromDirectorData(data);
if (!/35mm/.test(prompt) || !/Rama/.test(prompt)) {
  console.error('FAIL prompt compose', prompt);
  process.exit(1);
}
if (/\bwalk\b/.test(prompt)) {
  console.error('FAIL invented walk', prompt);
  process.exit(1);
}

const prev = { humans: [{ id: 'Rama', position: [1, 0, 2], rotationY: 0.4 }] };
const matched = matchPreviousStagePlan(prev, plan, { cameraMotionTag: 'static hold' });
if (matched.humans[0].position[0] !== 1) {
  console.error('FAIL match previous', matched.humans[0]);
  process.exit(1);
}

console.log('OK — parse, director data, explicit prompt, continuity, validate-warns-only');
