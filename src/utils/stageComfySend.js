/**
 * Send Director Stage to local ComfyUI (load editor workflow).
 * Does not silently rewrite the shot video prompt.
 */

import { buildShotDirectorData, composeVideoPromptFromDirectorData } from './stageDirectorData';
import { buildSwsWorkflowContract } from './swsWorkflowContract';
import { assembleValidatedWorkflow, buildComfyExportBundle } from './swsComfyJson';
import { formatValidationMessage, validateSwsWorkflow } from './swsWorkflowValidator';
import {
  fetchComfyObjectInfo,
  getComfyUiBaseUrl,
  loadWorkflowIntoComfyEditor,
  openComfyUiWindow,
  probeComfyUi,
  waitForComfyPendingLoaded
} from '../services/comfyuiClient';

export function buildStageComfyPayload({
  shot = {},
  plan = {},
  shotIndex = 0,
  projectTitle = '',
  previousShotId = ''
} = {}) {
  const data = buildShotDirectorData({
    shot,
    plan,
    shotIndex,
    projectTitle,
    previousShotId,
    promptSynced: !!shot.stageVideoPrompt
  });
  const merged = { ...shot, directorStage: data };
  const promptOverride = String(
    shot.stageVideoPrompt || composeVideoPromptFromDirectorData(data) || ''
  ).trim();
  const contract = buildSwsWorkflowContract({
    shot: merged,
    shotIndex,
    projectTitle,
    promptOverride,
    duration: plan.durationSec
  });
  return { data, contract, promptOverride };
}

export async function sendDirectorStageToComfy({
  shot,
  plan,
  shotIndex = 0,
  projectTitle = '',
  previousShotId = ''
} = {}) {
  const payload = buildStageComfyPayload({ shot, plan, shotIndex, projectTitle, previousShotId });
  const assembled = assembleValidatedWorkflow(payload.contract, validateSwsWorkflow);
  const validation = assembled.manifest?.validation || assembled.validation || { ok: true };
  if (validation.ok === false) {
    return { ok: false, message: formatValidationMessage(validation), payload };
  }
  const comfyUrl = getComfyUiBaseUrl();
  openComfyUiWindow(comfyUrl);
  await new Promise((r) => setTimeout(r, 800));
  const probe = await probeComfyUi(comfyUrl);
  if (!probe.ok) {
    return { ok: false, message: probe.message || `ComfyUI not reachable at ${comfyUrl}`, payload };
  }
  let objectInfo;
  try {
    objectInfo = await fetchComfyObjectInfo(comfyUrl);
  } catch (err) {
    return { ok: false, message: err?.message || 'Could not read ComfyUI object_info', payload };
  }
  const converted = buildComfyExportBundle(payload.contract, { objectInfo });
  const loaded = await loadWorkflowIntoComfyEditor({
    workflow: converted.frontend,
    workflowId: converted.workflowId,
    workflowName: converted.clapboard?.displayName || `${projectTitle} ${payload.contract.shotId}`,
    baseUrl: comfyUrl
  });
  if (!loaded.ok) {
    return { ok: false, message: loaded.message, payload };
  }
  await waitForComfyPendingLoaded({ id: loaded.id, baseUrl: comfyUrl, timeoutMs: 12000 });
  return {
    ok: true,
    message: `Sent to ComfyUI · ${converted.workflowId}`,
    payload,
    workflowId: converted.workflowId
  };
}
