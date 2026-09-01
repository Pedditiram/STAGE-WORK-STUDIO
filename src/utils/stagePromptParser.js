/**
 * Phase 13 — parse filmmaking language into SHOT DIRECTOR DATA hints (spec §3).
 * Priority: explicit prompt → craft fields. Does not invent walks from looks.
 */

import { inferCharacterMove } from './stageCharacterMove';
import { inferEyeHead } from './stageEyeHead';
import { inferExpression } from './stageExpression';
import { inferInteraction } from './stageInteraction';
import { inferDialogue } from './stageDialogue';
import { inferStageEnvironment } from './stageEnvironment';
import { shotPromptBlob, parsePromptCamera } from './stagePromptCamera';
import { parsePromptDirection } from './stagePromptDirection';

export { shotPromptBlob, parsePromptCamera };

/**
 * Structured parse for Stage. Craft infers stay authoritative; prompt tokens win when explicit.
 */
export function parseShotDirector(shot = {}, humans = [], durationSec = 5) {
  const blob = shotPromptBlob(shot);
  const direction = parsePromptDirection(shot);
  const cam = direction.camera;
  const explicitPrompt = Boolean(String(shot.stageVideoPrompt || shot.videoPrompt || '').trim());
  return {
    sourcePriority: explicitPrompt ? 'prompt' : 'craft',
    camera: cam,
    durationSec: direction.durationSec || durationSec,
    placement: direction.placement,
    practicals: direction.practicals,
    practicalKeys: direction.practicalKeys,
    lookOnly: direction.lookOnly,
    walkExplicit: direction.walkExplicit,
    environment: inferStageEnvironment(shot),
    movement: (humans || []).map((_, i) => inferCharacterMove(shot, i)),
    gaze: (humans || []).map((_, i) => inferEyeHead(shot, i, humans)),
    expression: (humans || []).map(() => inferExpression(shot)),
    interaction: (humans || []).map((h) => inferInteraction(shot, h, humans)),
    dialogue: inferDialogue(shot, humans, direction.durationSec || durationSec),
    originalVideoPrompt: String(shot.stageVideoPrompt || shot.videoPrompt || blob).slice(0, 4000)
  };
}
