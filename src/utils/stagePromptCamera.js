/**
 * Prompt language → camera/lens/move tokens (spec §3). Look ≠ walk.
 */

import { normalizeMoveType } from './stageCameraMove.js';

export function shotPromptBlob(shot = {}) {
  return [
    shot.stageVideoPrompt,
    shot.videoPrompt,
    shot.cameraMotionTag,
    shot.lensAndFocalLength,
    shot.shotComposition,
    shot.characterMovement,
    shot.characterEyeLooks,
    shot.characterExpression,
    shot.characterDialogue,
    shot.coArtistInteraction,
    shot.actionEnvContext,
    shot.timeAndLightingEnv
  ]
    .map((s) => String(s || ''))
    .join('\n');
}

export function parsePromptCamera(text = '') {
  const t = String(text || '').toLowerCase();
  let focalMm = null;
  const mm = t.match(/\b(14|18|24|28|35|40|50|65|85|100|135|200)\s*mm\b/);
  if (mm) focalMm = Number(mm[1]);
  else if (/tele|close[- ]?up|ecu|cu\b/.test(t)) focalMm = 85;
  else if (/wide|establishing|14|18/.test(t)) focalMm = 24;

  let move = null;
  if (/static|locked off|tripod|hold/.test(t) && !/push|dolly|pan|orbit/.test(t)) move = 'static';
  else if (/dolly in|push in|push-in/.test(t)) move = 'push';
  else if (/dolly out|pull out|pull-out/.test(t)) move = 'pull';
  else if (/truck left/.test(t)) move = 'truck_left';
  else if (/truck right/.test(t)) move = 'truck_right';
  else if (/crane down|boom down/.test(t)) move = 'crane_down';
  else if (/crane|boom|jib/.test(t)) move = 'crane';
  else if (/orbit|arc/.test(t)) move = 'orbit';
  else if (/handheld|docu/.test(t)) move = 'handheld';
  else if (/tilt/.test(t)) move = 'tilt';
  else if (/pan/.test(t)) move = 'pan';
  else if (/track|follow/.test(t)) move = 'tracking';

  let shotSize = null;
  if (/extreme close|ecu/.test(t)) shotSize = 'ecu';
  else if (/close[- ]?up|cu\b/.test(t)) shotSize = 'cu';
  else if (/medium close|mcu/.test(t)) shotSize = 'mcu';
  else if (/two[- ]shot/.test(t)) shotSize = 'two_shot';
  else if (/over[- ]the[- ]shoulder|ots/.test(t)) shotSize = 'ots';
  else if (/pov|point of view/.test(t)) shotSize = 'pov';
  else if (/full shot|fs\b/.test(t)) shotSize = 'full';
  else if (/wide|establishing/.test(t)) shotSize = 'wide';
  else if (/medium shot|ms\b/.test(t)) shotSize = 'ms';

  return {
    focalMm,
    move: move ? normalizeMoveType(move) : null,
    shotSize,
    inferred: !!(focalMm || move || shotSize)
  };
}
