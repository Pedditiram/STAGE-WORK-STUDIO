/**
 * Matrix → Seedance master assembly (PDF §7 sequence).
 */

import { normalizeShotForComfy, missingRequiredNormalizedFields } from './normalizedShotData';
import { composeModelPrompt } from './comfyPromptComposer';
import { routeReferencesForSeedance, referenceDebugSummary } from './comfyReferenceRouter';
import { mapSeedanceParameters } from './comfyParameterMapper';
import {
  SEEDANCE_MASTER_TEMPLATE_ID,
  SEEDANCE_MASTER_TEMPLATE_VERSION,
  SEEDANCE_MASTER_REQUIRED_NODES,
  buildSeedanceMasterFrontendWorkflow,
  validateSeedanceMasterWorkflow,
  seedanceMasterManifest
} from './seedanceMasterWorkflow';
import {
  ensureProjectAssetFolders,
  loadProjectAssetRoots,
  resolveComfyAssetSlots
} from './projectAssetRootsClient';
import { assetRootsList, buildComfySaveVideoPrefix, normalizeAssetRoots } from './projectAssetRoots';

/**
 * Full Matrix → connected Seedance canvas workflow.
 * Pass `diskAssetSlots` so K Text gets absolute paths from Project Console asset folders.
 */
export function assembleMatrixSeedanceWorkflow({
  shot = {},
  shotIndex = 0,
  shots = [],
  projectTitle = '',
  promptOverride = '',
  negativePrompt = '',
  duration,
  width = 1920,
  height = 1080,
  seed = -1,
  model = '',
  ratio,
  resolution,
  generateAudio = true,
  diskAssetSlots = null,
  assetRoots = null
} = {}) {
  if (!shot || (typeof shot === 'object' && !Object.keys(shot).length && shotIndex < 0)) {
    return {
      ok: false,
      error: 'No selected shot — select a Matrix shot before Send to ComfyUI.',
      code: 'no_shot'
    };
  }

  const normalized = normalizeShotForComfy(shot, shotIndex, { projectTitle, shots });
  const missing = missingRequiredNormalizedFields(normalized);
  if (missing.includes('shotId')) {
    return { ok: false, error: 'Shot id is missing from the Matrix row.', code: 'missing_shot', missing };
  }
  if (missing.includes('matrix_content')) {
    return {
      ok: false,
      error: 'Selected Matrix shot has empty required craft fields (character / action / camera / environment).',
      code: 'empty_matrix',
      missing
    };
  }

  const composed = composeModelPrompt({
    shot,
    shotIndex,
    projectTitle,
    shots,
    normalized,
    promptOverride,
    negativePrompt
  });
  if (!String(composed.prompt || '').trim()) {
    return { ok: false, error: 'Prompt Composer produced an empty prompt.', code: 'empty_prompt' };
  }

  const references = routeReferencesForSeedance(shot, shots, shotIndex, normalized, {
    diskAssetSlots: Array.isArray(diskAssetSlots) ? diskAssetSlots : []
  });
  const { params } = mapSeedanceParameters({
    normalized,
    duration,
    width,
    height,
    seed,
    model,
    ratio,
    resolution,
    generateAudio
  });

  const built = buildSeedanceMasterFrontendWorkflow({
    prompt: composed.prompt,
    negativePrompt: composed.negativePrompt || '',
    systemInstruction: composed.systemInstruction || '',
    promptSource: composed.source || '',
    normalized,
    references,
    params,
    shotLabel: normalized.shotId,
    assetRoots: assetRoots ? normalizeAssetRoots(assetRoots) : null
  });

  const validation = validateSeedanceMasterWorkflow(built.workflow);
  const manifest = seedanceMasterManifest({
    normalized,
    params,
    references,
    validation
  });

  const debug = {
    projectId: normalized.projectId,
    sceneId: normalized.sceneId,
    shotId: normalized.shotId,
    templateId: SEEDANCE_MASTER_TEMPLATE_ID,
    templateVersion: SEEDANCE_MASTER_TEMPLATE_VERSION,
    promptSource: composed.source,
    composedSource: composed.source,
    prompt: composed.prompt,
    negativePrompt: composed.negativePrompt || '',
    systemInstruction: composed.systemInstruction || '',
    promptOrder: composed.order,
    normalized,
    references: referenceDebugSummary(references),
    referenceAssigned: references.assigned,
    diskAssigned: references.diskAssigned,
    assetRoots: assetRoots ? normalizeAssetRoots(assetRoots) : null,
    params,
    savePrefix: buildComfySaveVideoPrefix({
      rendersVideo: assetRoots?.rendersVideo,
      projectId: normalized.projectId,
      sceneId: normalized.sceneId,
      shotId: normalized.shotId
    }),
    validation,
    requiredNodes: [...SEEDANCE_MASTER_REQUIRED_NODES],
    nodeCount: built.nodeCount,
    linkCount: built.linkCount
  };

  return {
    ok: validation.ok,
    error: validation.ok ? '' : validation.errors.join(' · '),
    code: validation.ok ? '' : 'invalid_workflow',
    workflow: built.workflow,
    manifest,
    debug,
    normalized,
    composed,
    references,
    params,
    templateId: SEEDANCE_MASTER_TEMPLATE_ID,
    templateVersion: SEEDANCE_MASTER_TEMPLATE_VERSION
  };
}

/**
 * Async assemble — loads assetRoots, ensures folders, resolves Image_N files into KText paths.
 */
export async function assembleMatrixSeedanceWorkflowAsync(options = {}) {
  const projectTitle = options.projectTitle || '';
  let roots = normalizeAssetRoots(options.assetRoots || {});
  if (!assetRootsList(roots).length && projectTitle) {
    roots = await loadProjectAssetRoots(projectTitle);
  }
  if (assetRootsList(roots).length) {
    await ensureProjectAssetFolders(roots);
  }
  const resolved = await resolveComfyAssetSlots(options.shot || {}, roots);
  return assembleMatrixSeedanceWorkflow({
    ...options,
    assetRoots: roots,
    diskAssetSlots: resolved.slots || []
  });
}

export function isSeedanceMasterTemplate(templateId) {
  return String(templateId || '') === SEEDANCE_MASTER_TEMPLATE_ID;
}
