/**
 * Practical pulse + Stage-scoped ⌘Z (Writer / shot history keep theirs).
 */
import { practicalPulse, practicalTimelineLanes, applyPracticalsAtTime } from '../src/utils/stagePracticals.js';
import { buildStageTimeline } from '../src/utils/stageTimeline.js';
import { stageHotkeysClaimEvent, appShotHistoryShouldHandleUndo } from '../src/utils/stageHotkeys.js';

const torchA = practicalPulse('torch', 0.1);
const torchB = practicalPulse('torch', 0.4);
if (!(torchA > 0.5 && torchA < 1.2) || torchA === torchB) {
  console.error('FAIL torch pulse', torchA, torchB);
  process.exit(1);
}
if (practicalPulse('bulb', 0) < 0.9) {
  console.error('FAIL bulb');
  process.exit(1);
}
if (practicalPulse('unknown', 1) !== 1) {
  console.error('FAIL unknown pulse');
  process.exit(1);
}

const lanes = practicalTimelineLanes({
  durationSec: 5,
  environment: { pieces: [{ id: 'p1', kind: 'lantern', practical: true }] }
});
if (!lanes.some((l) => l.kind === 'practical' && l.label === 'lantern')) {
  console.error('FAIL practical lanes', lanes);
  process.exit(1);
}

const tl = buildStageTimeline({
  durationSec: 4,
  environment: { pieces: [{ kind: 'neon', practical: true }] }
});
if (!tl.lanes.some((l) => l.kind === 'practical')) {
  console.error('FAIL timeline practical', tl.lanes);
  process.exit(1);
}

const light = { isLight: true, intensity: 2, userData: { practicalKind: 'lantern' } };
applyPracticalsAtTime({
  traverse: (fn) => fn(light)
}, 0);
if (light.userData.practicalBaseIntensity !== 2 || light.intensity === 2 && practicalPulse('lantern', 0) !== 1) {
  if (Math.abs(light.intensity - 2 * practicalPulse('lantern', 0)) > 1e-9) {
    console.error('FAIL apply practicals', light);
    process.exit(1);
  }
}

const root = { contains: (n) => n === 'inside' };
const claimIn = stageHotkeysClaimEvent({ target: 'inside' }, root);
const claimOut = stageHotkeysClaimEvent({ target: 'outside' }, root);
if (!claimIn || claimOut) {
  console.error('FAIL claim contains', claimIn, claimOut);
  process.exit(1);
}
const ta = { tagName: 'TEXTAREA' };
if (stageHotkeysClaimEvent({ target: ta }, { contains: () => true })) {
  console.error('FAIL claim textarea');
  process.exit(1);
}

if (appShotHistoryShouldHandleUndo({ target: { tagName: 'DIV' } }, 'canvas')) {
  console.error('FAIL app yields on stage');
  process.exit(1);
}
if (appShotHistoryShouldHandleUndo({ target: { tagName: 'TEXTAREA' } }, 'writer')) {
  console.error('FAIL app yields in writer field');
  process.exit(1);
}
if (!appShotHistoryShouldHandleUndo({ target: { tagName: 'BODY' } }, 'writer')) {
  console.error('FAIL app shot undo on writer chrome');
  process.exit(1);
}

console.log('OK — practical pulse, timeline lanes, Stage-scoped hotkeys');
