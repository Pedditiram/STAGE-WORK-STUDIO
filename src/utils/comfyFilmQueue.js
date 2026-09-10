/**
 * ComfyUI film queue — send every Matrix shot to ComfyUI in order,
 * load the Seedance master canvas, auto-queue, wait for idle, next shot.
 */

import { assembleMatrixSeedanceWorkflowAsync } from './assembleMatrixSeedanceWorkflow';
import {
  fetchComfyObjectInfo,
  loadWorkflowIntoComfyEditor,
  missingComfyClassStatusLine,
  formatComfyClassInventoryWithVersion,
  formatFilmProgressInventory,
  openComfyUiWindow,
  probeComfyUi,
  pullLatestComfyOutput,
  waitForComfyQueueIdle
} from '../services/comfyuiClient';
import { SEEDANCE_MASTER_REQUIRED_NODES } from './seedanceMasterWorkflow';

function shotLabel(shot, index) {
  return String(shot?.sceneShotId || shot?.shotId || `shot_${index + 1}`);
}

/** Early film-queue stop (empty / unreachable / object_info) still lists version next to classInventory. */
export function filmQueueEarlyResult({
  error = '',
  code = '',
  results = [],
  comfyuiVersion = 'unknown',
  installedClassCount = 0,
  missing = []
} = {}) {
  const classInventory = formatComfyClassInventoryWithVersion(installedClassCount, missing, comfyuiVersion);
  return {
    ok: false,
    error,
    code,
    results,
    comfyuiVersion,
    installedClassCount,
    classInventory,
    inventoryVersion: formatFilmProgressInventory(classInventory, comfyuiVersion)
  };
}

/** Missing custom-node stop still lists classInventory next to comfyuiVersion. */
export function filmQueueMissingNodesResult({
  error = '',
  results = [],
  comfyuiVersion = 'unknown',
  installedClassCount = 0,
  classInventory = '',
  missing = []
} = {}) {
  const inventory =
    String(classInventory || '').trim() ||
    formatComfyClassInventoryWithVersion(installedClassCount, missing, comfyuiVersion);
  return {
    ok: false,
    error,
    code: 'missing_nodes',
    results,
    comfyuiVersion,
    installedClassCount,
    classInventory: inventory,
    inventoryVersion: formatFilmProgressInventory(inventory, comfyuiVersion)
  };
}

/** Finished film-queue payload still lists classInventory next to comfyuiVersion. */
export function filmQueueFinalResult({
  results = [],
  total,
  comfyuiVersion = 'unknown',
  installedClassCount = 0,
  classInventory = ''
} = {}) {
  const failed = results.filter((r) => r.status === 'failed').length;
  const cancelled = results.some((r) => r.status === 'cancelled');
  return {
    ok: failed === 0 && !cancelled,
    error: cancelled ? 'Film queue cancelled.' : failed ? `${failed} shot(s) failed.` : '',
    code: cancelled ? 'cancelled' : failed ? 'partial' : '',
    results,
    total: Number.isFinite(total) ? total : results.length,
    comfyuiVersion,
    installedClassCount,
    classInventory,
    inventoryVersion: formatFilmProgressInventory(classInventory, comfyuiVersion)
  };
}

export function filmQueueCancelledRow({
  index = 0,
  shotId = '',
  comfyuiVersion = 'unknown',
  classInventory = ''
} = {}) {
  return {
    index,
    shotId,
    status: 'cancelled',
    comfyuiVersion,
    classInventory,
    inventoryVersion: formatFilmProgressInventory(classInventory, comfyuiVersion)
  };
}

export function filmQueueFailedRow({
  index = 0,
  shotId = '',
  error = '',
  shotIndex,
  comfyuiVersion = 'unknown',
  classInventory = ''
} = {}) {
  return {
    index,
    shotId,
    ...(Number.isFinite(shotIndex) ? { shotIndex } : {}),
    status: 'failed',
    error,
    comfyuiVersion,
    classInventory,
    inventoryVersion: formatFilmProgressInventory(classInventory, comfyuiVersion)
  };
}

export function filmQueueSucceededRow({
  index = 0,
  shotId = '',
  shotIndex,
  outputFile = '',
  filename = '',
  comfyPromptId = '',
  outputNote = '',
  comfyuiVersion = 'unknown',
  classInventory = ''
} = {}) {
  return {
    index,
    shotId,
    ...(Number.isFinite(shotIndex) ? { shotIndex } : {}),
    status: 'succeeded',
    outputFile,
    filename,
    comfyPromptId,
    outputNote,
    comfyuiVersion,
    classInventory,
    inventoryVersion: formatFilmProgressInventory(classInventory, comfyuiVersion)
  };
}

export function filmQueueAssemblingProgress({
  index = 0,
  total = 0,
  shotId = '',
  classInventory = '',
  comfyuiVersion = 'unknown'
} = {}) {
  return {
    index,
    total,
    shotId,
    status: 'assembling',
    classInventory,
    comfyuiVersion,
    inventoryVersion: formatFilmProgressInventory(classInventory, comfyuiVersion)
  };
}

export function filmQueueLoadingProgress({
  index = 0,
  total = 0,
  shotId = '',
  composedSource = '',
  classInventory = '',
  comfyuiVersion = 'unknown'
} = {}) {
  return {
    index,
    total,
    shotId,
    status: 'loading',
    composedSource,
    classInventory,
    comfyuiVersion,
    inventoryVersion: formatFilmProgressInventory(classInventory, comfyuiVersion)
  };
}

export function filmQueueGeneratingProgress({
  index = 0,
  total = 0,
  shotId = '',
  composedSource = '',
  classInventory = '',
  comfyuiVersion = 'unknown'
} = {}) {
  return {
    index,
    total,
    shotId,
    status: 'generating',
    composedSource,
    classInventory,
    comfyuiVersion,
    inventoryVersion: formatFilmProgressInventory(classInventory, comfyuiVersion)
  };
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
 * Keys on every film-queue onProgress payload: classInventory next to comfyuiVersion as inventoryVersion.
 */
export const FILM_QUEUE_PROGRESS_KEYS =
  'index, total, shotId, status, error, filename, outputFile, composedSource, installedClassCount, classInventory, comfyuiVersion, inventoryVersion';

/** Spread onto every onProgress: classInventory next to comfyuiVersion as inventoryVersion. */
export const FILM_QUEUE_CLASS_FIELDS_KEYS =
  'installedClassCount, missingRequiredClasses, classInventory, comfyuiVersion, inventoryVersion';

/** reportProgress always spreads classInventory next to comfyuiVersion as inventoryVersion. */
export const FILM_QUEUE_REPORT_PROGRESS_KEYS =
  'classInventory, comfyuiVersion, inventoryVersion';

/** Assembling onProgress keeps classInventory next to comfyuiVersion as inventoryVersion. */
export const FILM_QUEUE_ASSEMBLING_PROGRESS_KEYS =
  'classInventory, comfyuiVersion, inventoryVersion';

/** Loading onProgress keeps classInventory next to comfyuiVersion as inventoryVersion. */
export const FILM_QUEUE_LOADING_PROGRESS_KEYS =
  'classInventory, comfyuiVersion, inventoryVersion';

/** Generating onProgress keeps classInventory next to comfyuiVersion as inventoryVersion. */
export const FILM_QUEUE_GENERATING_PROGRESS_KEYS =
  'classInventory, comfyuiVersion, inventoryVersion';

/**
 * Run the film queue. Calls onProgress({ index, total, shotId, status, error, filename, outputFile, composedSource, installedClassCount, classInventory, comfyuiVersion, inventoryVersion }).
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
    return filmQueueEarlyResult({ error: 'No Matrix shots to queue.', code: 'empty' });
  }

  openComfyUiWindow(comfyUrl);
  const probe = await probeComfyUi(comfyUrl);
  if (!probe.ok) {
    return filmQueueEarlyResult({
      error: probe.message || 'ComfyUI unreachable',
      code: 'unreachable',
      comfyuiVersion: probe.comfyuiVersion || 'unknown'
    });
  }
  const comfyuiVersion = probe.comfyuiVersion || 'unknown';

  let objectInfo;
  try {
    objectInfo = await fetchComfyObjectInfo(comfyUrl);
  } catch (err) {
    return filmQueueEarlyResult({
      error: err?.message || 'object_info failed',
      code: 'object_info',
      comfyuiVersion
    });
  }

  const classReport = missingComfyClassStatusLine(objectInfo, [...SEEDANCE_MASTER_REQUIRED_NODES], {
    host: comfyUrl
  });
  const classInventory = formatComfyClassInventoryWithVersion(
    classReport.installedClassCount,
    classReport.missing,
    comfyuiVersion
  );
  /** classInventory next to comfyuiVersion as inventoryVersion */
  const classFields = {
    installedClassCount: classReport.installedClassCount,
    missingRequiredClasses: classReport.missing || [],
    classInventory,
    comfyuiVersion,
    inventoryVersion: formatFilmProgressInventory(classInventory, comfyuiVersion)
  };
  /** Spreads classFields (classInventory, comfyuiVersion, inventoryVersion) onto every onProgress payload. */
  const reportProgress = (partial = {}) => onProgress?.({ ...classFields, ...partial });
  if (!classReport.ok) {
    const row = filmQueueFailedRow({
      index: 0,
      shotId: list[0] ? shotLabel(list[0].shot, list[0].index) : '',
      error: classReport.status,
      comfyuiVersion,
      classInventory
    });
    reportProgress({
      ...row,
      total: list.length,
      installedClassCount: classReport.installedClassCount,
      missingRequiredClasses: classReport.missing
    });
    return filmQueueMissingNodesResult({
      error: classReport.status,
      results: [],
      comfyuiVersion,
      installedClassCount: classReport.installedClassCount,
      classInventory,
      missing: classReport.missing
    });
  }

  const results = [];
  for (let i = 0; i < list.length; i += 1) {
    if (cancelToken.cancelled) {
      const { shot, index } = list[i] || {};
      const row = filmQueueCancelledRow({
        index: i,
        shotId: shot ? shotLabel(shot, index) : '',
        comfyuiVersion,
        classInventory
      });
      results.push(row);
      reportProgress({ ...row, total: list.length });
      break;
    }
    const { shot, index } = list[i];
    const label = shotLabel(shot, index);
    reportProgress(
      filmQueueAssemblingProgress({
        index: i,
        total: list.length,
        shotId: label,
        classInventory,
        comfyuiVersion
      })
    );

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
    const pushFailed = (error, extra = {}) => {
      const row = filmQueueFailedRow({
        index: i,
        shotId: label,
        error,
        comfyuiVersion,
        classInventory,
        ...extra
      });
      results.push(row);
      reportProgress({ ...row, total: list.length, composedSource });
      return row;
    };
    if (!assembled.ok || !assembled.workflow) {
      pushFailed(assembled.error || 'Assemble failed');
      continue;
    }

    const installed = validateMasterNodesInstalled(assembled.workflow, objectInfo);
    if (!installed.ok) {
      pushFailed(installed.message);
      // Missing nodes won't fix mid-run
      return filmQueueMissingNodesResult({
        error: installed.message,
        results,
        comfyuiVersion,
        installedClassCount: classReport.installedClassCount,
        classInventory,
        missing: installed.missing
      });
    }

    reportProgress(
      filmQueueLoadingProgress({
        index: i,
        total: list.length,
        shotId: label,
        composedSource,
        classInventory,
        comfyuiVersion
      })
    );
    const loaded = await loadWorkflowIntoComfyEditor({
      workflow: assembled.workflow,
      workflowId: `film_${projectTitle}_${label}_${Date.now()}`,
      workflowName: assembled.workflow?.extra?.sws?.displayName || `${projectTitle} ${label}`.trim(),
      baseUrl: comfyUrl,
      autoQueue: Boolean(autoQueue)
    });
    if (!loaded.ok) {
      pushFailed(loaded.message);
      continue;
    }

    openComfyUiWindow(comfyUrl);

    if (autoQueue) {
      reportProgress(
        filmQueueGeneratingProgress({
          index: i,
          total: list.length,
          shotId: label,
          composedSource,
          classInventory,
          comfyuiVersion
        })
      );
      const waited = await waitForComfyQueueIdle({
        baseUrl: comfyUrl,
        cancelToken,
        // Seedance polls can take several minutes
        timeoutMs: 45 * 60 * 1000,
        pollMs: 2500
      });
      if (cancelToken.cancelled) {
        const row = filmQueueCancelledRow({
          index: i,
          shotId: label,
          comfyuiVersion,
          classInventory
        });
        results.push(row);
        reportProgress({ ...row, total: list.length, composedSource });
        break;
      }
      if (!waited.ok) {
        pushFailed(waited.message || 'Queue wait failed');
        continue;
      }
      const pulled = await pullLatestComfyOutput({ baseUrl: comfyUrl });
      const filename = pulled.ok ? pulled.filename || '' : '';
      const row = filmQueueSucceededRow({
        index: i,
        shotIndex: index,
        shotId: label,
        outputFile: pulled.ok ? pulled.outputFile : '',
        filename,
        comfyPromptId: pulled.ok ? pulled.promptId : '',
        outputNote: pulled.ok ? '' : pulled.message || '',
        comfyuiVersion,
        classInventory
      });
      results.push(row);
      reportProgress({
        ...row,
        total: list.length,
        composedSource
      });
      continue;
    }

    const row = filmQueueSucceededRow({
      index: i,
      shotIndex: index,
      shotId: label,
      comfyuiVersion,
      classInventory
    });
    results.push(row);
    reportProgress({ ...row, total: list.length, composedSource });
  }

  return filmQueueFinalResult({
    results,
    total: list.length,
    comfyuiVersion,
    installedClassCount: classReport.installedClassCount,
    classInventory
  });
}
