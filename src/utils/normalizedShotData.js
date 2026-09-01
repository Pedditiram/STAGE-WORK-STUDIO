/**
 * Matrix → normalized shot-data (SWS_ComfyUI_Matrix_to_Workflow_Instructions.pdf §3).
 * Keeps Matrix structured — never collapses to a single string here.
 */

import { parseSceneAndShotID } from './sceneShotUtils';
import { ensureShotSpecMeta } from './shotSpec';
import { parseShotDurationSec } from './swsWorkflowContract';

function t(v) {
  return String(v ?? '').trim();
}

/**
 * @returns {object} Normalized shot DTO for Prompt Composer / Reference Router / Parameter Mapper
 */
export function normalizeShotForComfy(shot = {}, shotIndex = 0, { projectTitle = '', shots = [] } = {}) {
  const s = ensureShotSpecMeta(shot || {});
  const parsed = parseSceneAndShotID(s, shotIndex);
  const shotId = parsed.shortId || t(s.sceneShotId) || `SC01_SH${String(shotIndex + 1).padStart(2, '0')}`;
  const sceneId = parsed.sceneStr || `SC${String(parsed.sceneNum || 1).padStart(2, '0')}`;

  return {
    version: 1,
    projectId: t(projectTitle) || 'untitled',
    sceneId,
    shotId,
    shotIndex: Number(shotIndex) || 0,
    character: {
      name: t(s.characterIdAssetRef),
      appearance: t(s.makeupAndHairStyle),
      costume: t(s.characterIdMatrix),
      expression: t(s.characterExpression),
      psychology: t(s.characterPsychologyState),
      mannerism: t(s.characterMannerismAndPosture),
      eyeLooks: t(s.characterEyeLooks),
      dialogue: t(s.characterDialogue),
      coArtist: t(s.coArtistInteraction),
      identity: t(s.characterIdAssetRef),
      assetIds: Array.isArray(s.charAssetIds) ? [...s.charAssetIds] : []
    },
    action: {
      primary: t(s.characterMovement) || t(s.actionEnvContext),
      secondary: t(s.actionEnvContext),
      interaction: t(s.coArtistInteraction),
      choreography: t(s.stuntAndSafetyNotes)
    },
    camera: {
      shotSize: t(s.shotComposition),
      framing: t(s.characterPlacement),
      movement: t(s.cameraMotionTag).replace(/[\[\]]/g, ''),
      lens: t(s.lensAndFocalLength),
      angle: t(s.shotComposition)
    },
    composition: {
      subjectPlacement: t(s.characterPlacement),
      synopsis: t(s.sceneSynopsis)
    },
    environment: {
      location: t(s.sceneSynopsis),
      context: t(s.actionEnvContext),
      worldAssetIds: Array.isArray(s.worldAssetIds) ? [...s.worldAssetIds] : []
    },
    lighting: {
      timeOfDay: t(s.timeAndLightingEnv),
      direction: t(s.directionalLightingAndHighlight),
      subject: t(s.subjectLightingTag),
      background: t(s.backgroundLightingTag)
    },
    atmosphere: {
      volumetrics: t(s.atmosphereVolumetricsTag),
      weather: t(s.timeAndLightingEnv)
    },
    style: {
      visual: t(s.vfxCgiBreakdown),
      gradeNotes: t(s.colorPaletteSlot)
    },
    colorGrade: {
      subject: t(s.subjectColorTag),
      background: t(s.backgroundColorTag),
      palette: t(s.colorPaletteSlot)
    },
    motion: {
      camera: t(s.cameraMotionTag).replace(/[\[\]]/g, ''),
      body: t(s.characterMovement),
      edit: t(s.editTransitionCut)
    },
    technical: {
      durationSec: parseShotDurationSec(s, 5),
      durationRaw: t(s.shotDurationAndImages),
      sound: t(s.soundFxAndFoley),
      score: t(s.backgroundScoreMood)
    },
    references: {
      firstFrame: t(s.lockedStillUrl || s.firstFrameUrl || s.embeddedImages?.first_frame),
      lastFrame: t(s.lastFrameUrl || s.embeddedImages?.last_frame),
      sourceVideo: t(s.sourceVideoUrl),
      matrixTags: t(s.shotDurationAndImages)
    },
    raw: {
      negativePrompt: t(s.negativePrompt),
      sceneShotId: t(s.sceneShotId)
    },
    sourceShotCount: Array.isArray(shots) ? shots.length : 0
  };
}

export function missingRequiredNormalizedFields(normalized) {
  const missing = [];
  if (!normalized?.shotId) missing.push('shotId');
  if (!normalized?.projectId) missing.push('projectId');
  const hasContent =
    t(normalized?.character?.name) ||
    t(normalized?.action?.primary) ||
    t(normalized?.camera?.shotSize) ||
    t(normalized?.environment?.location) ||
    t(normalized?.composition?.synopsis);
  if (!hasContent) missing.push('matrix_content');
  return missing;
}
