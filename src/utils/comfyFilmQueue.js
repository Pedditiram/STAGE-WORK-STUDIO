/**
 * ComfyUI film queue — send every Matrix shot to ComfyUI in order,
 * load the Seedance master canvas, auto-queue, wait for idle, next shot.
 */

import { assembleMatrixSeedanceWorkflowAsync } from './assembleMatrixSeedanceWorkflow';
import {
  fetchComfyObjectInfo,
  loadWorkflowIntoComfyEditor,
  missingComfyClassStatusLine,
  openComfyUiWindow,
  probeComfyUi,
  pullLatestComfyOutput,
  waitForComfyQueueIdle
} from '../services/comfyuiClient';
import { SEEDANCE_MASTER_REQUIRED_NODES } from './seedanceMasterWorkflow';

function shotLabel(shot, index) {
  return String(shot?.sceneShotId || shot?.shotId || `shot_${index + 1}`);
}

function isUuidType(t) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(t || ''));
}

export function validateMasterNodesInstalled(workflow, objectInfo) {
  const installed = new Set(Object.keys(objectInfo || {}));
  const subgraphIds = new Set((workflow?.definitions?.subgraphs || []).map((s) => s.id));
  const missing = [];
  (workflow?.nodes || []).forEach((n) => {
    const t = n?.type;
    if (!t || t === 'Note') return;
    if (isUuidType(t) || subgraphIds.has(t)) return;
    if (!installed.has(t)) missing.push(t);
  });
  for (const req of SEEDANCE_MASTER_REQUIRED_NODES) {
    if (!installed.has(req)) missing.push(req);
  }
  const uniq = [...new Set(missing)];
  return {
    ok: uniq.length === 0,
    missing: uniq,
    message:
      uniq.length === 0
        ? ''
        : `ComfyUI is missing: ${uniq.join(', ')}. Install those custom nodes, then retry.`
  };
}

/**
 * Build ordered Matrix rows worth generating (skip empty craft).
 */
export function listFilmQueueShots(shots = []) {
  return (Array.isArray(shots) ? shots : [])
    .map((shot, index) => ({ shot, index }))
    .filter(({ shot }) => {
      const hay = [
        shot?.characterIdAssetRef,
        shot?.coArtistInteraction,
        shot?.actionEnvContext,
        shot?.cameraMovement,
        shot?.sceneSynopsis,
        shot?.shotDurationAndImages
      ]
        .map((x) => String(x || '').trim())
        .join('');
      return hay.length > 8 || Boolean(shot?.sceneShotId || shot?.shotId);
    });
}

/**
 * Run the film queue. Calls onProgress({ index, total, shotId, status, error, filename, outputFile }).
 * Pass a shared `{ cancelled: false }` cancelToken; set cancelled=true to stop after current wait.
 */
export async function runComfyFilmQueue({
  shots = [],
  projectTitle = '',
  comfyUrl,
  duration,
  width = 1920,
  height = 1080,
  seed = -1,
  model = '',
  generateAudio = true,
  autoQueue = true,
  cancelToken = { cancelled: false },
  onProgress
} = {}) {
  const list = listFilmQueueShots(shots);
  if (!list.length) {
    return { ok: false, error: 'No Matrix shots to queue.', code: 'empty', results: [] };
  }

  openComfyUiWindow(comfyUrl);
  const probe = await probeComfyUi(comfyUrl);
  if (!probe.ok) {
    return { ok: false, error: probe.message || 'ComfyUI unreachable', code: 'unreachable', results: [] };
  }
  const comfyuiVersion = probe.comfyuiVersion || 'unknown';

  let objectInfo;
  try {
    objectInfo = await fetchComfyObjectInfo(comfyUrl);
  } catch (err) {
    return { ok: false, error: err?.message || 'object_info failed', code: 'object_info', results: [] };
  }

  const classReport = missingComfyClassStatusLine(objectInfo, [...SEEDANCE_MASTER_REQUIRED_NODES], {
    host: comfyUrl
  });
  if (!classReport.ok) {
    onProgress?.({
      index: 0,
      total: list.length,
      shotId: list[0] ? shotLabel(list[0].shot, list[0].index) : '',
      status: 'failed',
      error: classReport.status
    });
    return { ok: false, error: classReport.status, code: 'missing_nodes', results: [], comfyuiVersion };
  }

  const results = [];
  for (let i = 0; i < list.length; i += 1) {
    if (cancelToken.cancelled) {
      results.push({ index: i, status: 'cancelled' });
      break;
    }
    const { shot, index } = list[i];
    const label = shotLabel(shot, index);
    onProgress?.({ index: i, total: list.length, shotId: label, status: 'assembling' });

    const assembled = await assembleMatrixSeedanceWorkflowAsync({
      shot,
      shotIndex: index,
      shots,
      projectTitle,
      duration,
      width,
      height,
      seed,
      model,
      generateAudio
    });
    const composedSource = assembled.composed?.source || assembled.debug?.composedSource || '';
    if (!assembled.ok || !assembled.workflow) {
      const err = assembled.error || 'Assemble failed';
      results.push({ index: i, shotId: label, status: 'failed', error: err });
      onProgress?.({ index: i, total: list.length, shotId: label, status: 'failed', error: err, composedSource });
      continue;
    }

    const installed = validateMasterNodesInstalled(assembled.workflow, objectInfo);
    if (!installed.ok) {
      results.push({ index: i, shotId: label, status: 'failed', error: installed.message });
      onProgress?.({
        index: i,
        total: list.length,
        shotId: label,
        status: 'failed',
        error: installed.message,
        composedSource
      });
      // Missing nodes won't fix mid-run
      return { ok: false, error: installed.message, code: 'missing_nodes', results };
    }

    onProgress?.({ index: i, total: list.length, shotId: label, status: 'loading', composedSource });
    const loaded = await loadWorkflowIntoComfyEditor({
      workflow: assembled.workflow,
      workflowId: `film_${projectTitle}_${label}_${Date.now()}`,
      workflowName: assembled.workflow?.extra?.sws?.displayName || `${projectTitle} ${label}`.trim(),
      baseUrl: comfyUrl,
      autoQueue: Boolean(autoQueue)
    });
    if (!loaded.ok) {
      results.push({ index: i, shotId: label, status: 'failed', error: loaded.message });
      onProgress?.({
        index: i,
        total: list.length,
        shotId: label,
        status: 'failed',
        error: loaded.message
      });
      continue;
    }

    openComfyUiWindow(comfyUrl);

    if (autoQueue) {
      onProgress?.({ index: i, total: list.length, shotId: label, status: 'generating', composedSource });
      const waited = await waitForComfyQueueIdle({
        baseUrl: comfyUrl,
        cancelToken,
        // Seedance polls can take several minutes
        timeoutMs: 45 * 60 * 1000,
        pollMs: 2500
      });
      if (cancelToken.cancelled) {
        results.push({ index: i, shotId: label, status: 'cancelled' });
        break;
      }
      if (!waited.ok) {
        results.push({
          index: i,
          shotId: label,
          status: 'failed',
          error: waited.message || 'Queue wait failed'
        });
        onProgress?.({
          index: i,
          total: list.length,
          shotId: label,
          status: 'failed',
          error: waited.message
        });
        continue;
      }
      const pulled = await pullLatestComfyOutput({ baseUrl: comfyUrl });
      const filename = pulled.ok ? pulled.filename || '' : '';
      results.push({
        index: i,
        shotIndex: index,
        shotId: label,
        status: 'succeeded',
        outputFile: pulled.ok ? pulled.outputFile : '',
        filename,
        comfyPromptId: pulled.ok ? pulled.promptId : '',
        comfyuiVersion,
        outputNote: pulled.ok ? '' : pulled.message || ''
      });
      onProgress?.({
        index: i,
        total: list.length,
        shotId: label,
        status: 'succeeded',
        outputFile: pulled.ok ? pulled.outputFile : '',
        filename,
        composedSource
      });
      continue;
    }

    results.push({ index: i, shotIndex: index, shotId: label, status: 'succeeded', comfyuiVersion });
    onProgress?.({ index: i, total: list.length, shotId: label, status: 'succeeded', composedSource });
  }

  const failed = results.filter((r) => r.status === 'failed').length;
  const cancelled = results.some((r) => r.status === 'cancelled');
  return {
    ok: failed === 0 && !cancelled,
    error: cancelled ? 'Film queue cancelled.' : failed ? `${failed} shot(s) failed.` : '',
    code: cancelled ? 'cancelled' : failed ? 'partial' : '',
    results,
    total: list.length,
    comfyuiVersion
  };
}
