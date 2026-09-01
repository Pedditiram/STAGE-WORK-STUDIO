/**
 * Undo/redo, deeper prompt parse, set practicals. Look ≠ walk.
 */
import {
  createStagePlanHistory,
  pushStagePlan,
  undoStagePlan,
  redoStagePlan
} from '../src/utils/stagePlanHistory.js';
import {
  parsePromptDurationSec,
  parsePromptPlacement,
  parsePromptPracticals,
  parseLookVersusWalk,
  applyPlacementToHumans
} from '../src/utils/stagePromptDirection.js';
import { inferPracticalPieces } from '../src/utils/stageEnvironment.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const hist = createStagePlanHistory();
pushStagePlan(hist, { humans: [{ id: 'A', position: [0, 0, 0] }] });
pushStagePlan(hist, { humans: [{ id: 'A', position: [1, 0, 0] }] });
const back = undoStagePlan(hist, { humans: [{ id: 'A', position: [2, 0, 0] }] });
if (back.humans[0].position[0] !== 1) {
  console.error('FAIL undo', back);
  process.exit(1);
}
const fwd = redoStagePlan(hist, back);
if (fwd.humans[0].position[0] !== 2) {
  console.error('FAIL redo', fwd);
  process.exit(1);
}

if (parsePromptDurationSec('hold 8 seconds locked off') !== 8) {
  console.error('FAIL duration');
  process.exit(1);
}
const place = parsePromptPlacement('Rama foreground stage left. looks at Kara.');
if (place.x !== -1.05 || place.z !== 0.85) {
  console.error('FAIL placement', place);
  process.exit(1);
}
const placed = applyPlacementToHumans([{ position: [0, 0, 0] }, { position: [1, 0, 0] }], place);
if (placed[0].position[0] !== -1.05 || placed[1].position[0] !== 1) {
  console.error('FAIL apply placement', placed);
  process.exit(1);
}

const lw = parseLookVersusWalk('Rama looks at Kara.');
const walkSrc = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/utils/stageCharacterMove.js'),
  'utf8'
);
if (!walkSrc.includes('shot.stageVideoPrompt')) {
  console.error('FAIL movement parse missing video prompt');
  process.exit(1);
}
if (!lw.lookOnly || lw.walkExplicit) {
  console.error('FAIL look only', lw);
  process.exit(1);
}

const prac = parsePromptPracticals('kerosene lantern glow, neon sign');
if (!prac.includes('lantern') || !prac.includes('neon')) {
  console.error('FAIL practicals parse', prac);
  process.exit(1);
}
const pieces = inferPracticalPieces({ videoPrompt: 'oil lamp on the table' });
if (!pieces.some((p) => p.kind === 'lantern' && p.practical)) {
  console.error('FAIL infer practical pieces', pieces);
  process.exit(1);
}
const none = inferPracticalPieces({ videoPrompt: 'empty street at noon' });
if (none.length) {
  console.error('FAIL invented practicals', none);
  process.exit(1);
}

console.log('OK — undo/redo, deeper parse, practicals');
