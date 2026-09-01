/**
 * GLB figure fields, 3-point lighting infer, viseme lip-sync.
 */
import { resolveHumanFigure, figureUrlFromProfile } from '../src/utils/stageFigure.js';
import { inferLightingSetup, inferStageLighting, lightingRigForSetup } from '../src/utils/stageLighting.js';
import { visemeAt, applyLipSyncToPose } from '../src/utils/stageLipSync.js';
import { applySpeakMouth } from '../src/utils/stageDialogue.js';

const url = figureUrlFromProfile({ glbUrl: 'https://example.com/rama.glb' });
if (url !== 'https://example.com/rama.glb') {
  console.error('FAIL figure url', url);
  process.exit(1);
}
const fig = resolveHumanFigure({ figureSource: 'mannequin' }, { figureUrl: '/a.glb' });
if (fig.figureSource !== 'glb' || fig.glbUrl !== '/a.glb') {
  console.error('FAIL resolve figure', fig);
  process.exit(1);
}

const sunset = inferLightingSetup({ subjectLightingTag: '[Lighting: Soft Diffused Golden Hour Sunset Glow]' }, {});
if (sunset !== 'sunset') {
  console.error('FAIL sunset lighting', sunset);
  process.exit(1);
}
const rem = inferLightingSetup({ subjectLightingTag: '[Lighting: Rembrandt 3-Point Classic]' }, {});
if (rem !== 'rembrandt') {
  console.error('FAIL rembrandt', rem);
  process.exit(1);
}
const night = inferStageLighting({ timeAndLightingEnv: 'night moonlight' }, { timeOfDay: 'night' });
if (night.setup !== 'night' || night.keyIntensity >= lightingRigForSetup('rembrandt').keyIntensity) {
  console.error('FAIL night rig', night);
  process.exit(1);
}

const closed = visemeAt('mma', 0.05, 0, 1);
if (closed.viseme !== 'M' || closed.mouthOpen > 0.1) {
  console.error('FAIL viseme M closed', closed);
  process.exit(1);
}
const openA = visemeAt('aaa', 0.5, 0, 1);
if (openA.viseme !== 'AA' || openA.mouthOpen < 0.5) {
  console.error('FAIL viseme AA', openA);
  process.exit(1);
}

const line = { text: 'Rama', start: 0, end: 2 };
const posed = applySpeakMouth({ mouthOpen: 0 }, 0.2, true, line);
if (!posed.viseme || posed.mouthOpen <= 0) {
  console.error('FAIL speak mouth viseme', posed);
  process.exit(1);
}
const silent = applySpeakMouth({ mouthOpen: 0.1 }, 0.2, false, line);
if (silent.viseme) {
  console.error('FAIL silent should not viseme', silent);
  process.exit(1);
}

const synced = applyLipSyncToPose({}, line, 0.4);
if (!synced.viseme) {
  console.error('FAIL lip sync pose', synced);
  process.exit(1);
}

console.log('OK — GLB fields, lighting rig, viseme lip-sync');
