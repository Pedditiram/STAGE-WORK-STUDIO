/**
 * Phases 9–12: expression, interaction, dialogue, timeline. Look ≠ walk.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inferExpression } from '../src/utils/stageExpression.js';
import { inferInteraction } from '../src/utils/stageInteraction.js';
import { inferDialogue, speakingLineAt } from '../src/utils/stageDialogue.js';
import { buildStageTimeline } from '../src/utils/stageTimeline.js';

const moveSrc = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/utils/stageCharacterMove.js'),
  'utf8'
);
if (!moveSrc.includes("if (/looks? at|gazes?|stares?/.test(text) && !/walk|approach|move|go(es)? toward/.test(text))")) {
  console.error('FAIL look ≠ walk guard missing');
  process.exit(1);
}

const humans = [
  { id: 'Rama', position: [-0.5, 0, 0] },
  { id: 'Kara', position: [0.6, 0, 0] }
];

const lookShot = {
  characterEyeLooks: 'Rama looks at Kara',
  coArtistInteraction: 'Rama looks at Kara',
  characterMovement: '',
  characterExpression: 'Fierce determination',
  characterDialogue: ''
};

const expr = inferExpression(lookShot);
if (expr.id !== 'determined') {
  console.error('FAIL expected determined', expr);
  process.exit(1);
}

const ix = inferInteraction(lookShot, humans[0], humans);
if (ix.type !== 'look_at') {
  console.error('FAIL expected look_at', ix);
  process.exit(1);
}

const dlgEmpty = inferDialogue(lookShot, humans, 5);
if (dlgEmpty.length) {
  console.error('FAIL invented dialogue', dlgEmpty);
  process.exit(1);
}

const dlg = inferDialogue({ characterDialogue: 'Rama: Stay with me.' }, humans, 8);
if (!dlg[0]?.text || dlg[0].speakerId !== 'Rama' || dlg[0].listenerId !== 'Kara') {
  console.error('FAIL dialogue parse', dlg);
  process.exit(1);
}
if (!speakingLineAt(dlg, (dlg[0].start + dlg[0].end) / 2)) {
  console.error('FAIL speaking window');
  process.exit(1);
}

const lanes = buildStageTimeline({
  durationSec: 5,
  cameras: [{ animation: { type: 'push' } }],
  humans: [{ id: 'Rama', gaze: { eyeTarget: 'costar' }, expression: { id: 'determined' }, interaction: { type: 'look_at' }, movement: { type: 'hold' } }],
  dialogue: dlg,
  environment: { timeOfDay: 'sunset' }
});
const kinds = new Set(lanes.lanes.map((l) => l.kind));
for (const k of ['camera', 'gaze', 'expr', 'interact', 'dialogue', 'light']) {
  if (!kinds.has(k)) {
    console.error('FAIL missing lane', k, [...kinds]);
    process.exit(1);
  }
}

console.log('OK — phases 9–12: expression, look≠walk interaction, dialogue, timeline lanes');
