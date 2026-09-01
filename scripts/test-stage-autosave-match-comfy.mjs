/**
 * Autosave restore, Match Prev apply/reject, Header Save interval ids.
 */
import {
  buildShotDirectorData,
  planFromDirectorStage
} from '../src/utils/stageDirectorData.js';
import { compareStagePlans, matchPreviousReport, resolveMatchDecision } from '../src/utils/stageContinuityCompare.js';
import { autoSaveIntervalMs, autoSaveIntervalLabel } from '../src/utils/autoSaveIntervals.js';

const plan = {
  durationSec: 5,
  focalMm: 35,
  cameras: [{ position: [-2, 1.4, 3], lookAt: [0, 1.2, 0], focalMm: 35, animation: { type: 'static' } }],
  humans: [{ id: 'Rama', position: [-0.5, 0, 0], rotationY: 0.2, figureSource: 'mannequin' }],
  environment: { setId: 'street' },
  lighting: { setup: 'rembrandt' },
  dialogue: []
};
const data = buildShotDirectorData({ shot: { sceneShotId: 'SC01_SH02' }, plan, shotIndex: 1 });
const restored = planFromDirectorStage(data, { humans: [{ pose: { spine: 0 } }], cameras: [{}] });
if (!restored || restored.humans[0].id !== 'Rama' || restored.humans[0].position[0] !== -0.5) {
  console.error('FAIL restore', restored);
  process.exit(1);
}
if (planFromDirectorStage(null, plan) !== null) {
  console.error('FAIL empty director stage should not restore');
  process.exit(1);
}

const prev = { humans: [{ id: 'Rama', position: [1, 0, 2], rotationY: 0 }], environment: { setId: 'street' } };
const next = { humans: [{ id: 'Rama', position: [1, 0, 2], rotationY: 0 }], environment: { setId: 'street' } };
const same = compareStagePlans(prev, next);
if (!same.rows[0].copied || same.changed) {
  console.error('FAIL compare same', same);
  process.exit(1);
}
const moved = compareStagePlans(prev, { humans: [{ id: 'Rama', position: [0, 0, 0], rotationY: 0 }] });
if (!moved.rows[0].changed) {
  console.error('FAIL compare moved', moved);
  process.exit(1);
}

const report = matchPreviousReport(prev, next, next, { characterMovement: 'walk toward Kara' });
if (!report.walkKept || !/Walk/.test(report.summary) || !report.pending) {
  console.error('FAIL walk keep report', report);
  process.exit(1);
}

const before = { humans: [{ id: 'Rama', position: [0, 0, 0] }] };
const proposed = { humans: [{ id: 'Rama', position: [2, 0, 0] }] };
if (resolveMatchDecision(before, proposed, 'apply').humans[0].position[0] !== 2) {
  console.error('FAIL apply');
  process.exit(1);
}
if (resolveMatchDecision(before, proposed, 'reject').humans[0].position[0] !== 0) {
  console.error('FAIL reject');
  process.exit(1);
}

if (autoSaveIntervalMs('off') !== 0 || autoSaveIntervalMs('5m') !== 5 * 60 * 1000) {
  console.error('FAIL interval ms');
  process.exit(1);
}
if (!/5 minutes/i.test(autoSaveIntervalLabel('5m'))) {
  console.error('FAIL interval label');
  process.exit(1);
}

console.log('OK — restore, match apply/reject, Header Save interval');
