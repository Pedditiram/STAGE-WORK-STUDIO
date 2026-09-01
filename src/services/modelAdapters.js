/**
 * P2 — Unified model adapter interface.
 * Seedance / BytePlus is one engine behind a stable API — not the foundation shape.
 */

import {
  generateStudioImage,
  generateStudioVideo,
  pollStudioVideo
} from '../services/saasGenerateClient';
import { hasReplicateKey, replicateCreateVideo, replicateGenerateStill, replicatePollVideo } from '../services/replicateClient';
import { assembleMatrixSeedanceWorkflow } from '../utils/assembleMatrixSeedanceWorkflow';

export const MODEL_ENGINES = Object.freeze({
  SEEDANCE: 'seedance',
  BYTEPLUS: 'byteplus', // alias — same transport today
  LOCAL_EXPORT: 'local_export',
  REPLICATE: 'replicate'
});

export const MEDIA_KINDS = Object.freeze({
  STILL: 'still',
  VIDEO: 'video'
});

const DEFAULT_ENGINE = MODEL_ENGINES.SEEDANCE;

function readPreferredEngine() {
  if (typeof window === 'undefined') return DEFAULT_ENGINE;
  try {
    const raw = String(localStorage.getItem('sps_model_engine') || '').trim().toLowerCase();
    if (
      raw === MODEL_ENGINES.BYTEPLUS ||
      raw === MODEL_ENGINES.SEEDANCE ||
      raw === MODEL_ENGINES.LOCAL_EXPORT ||
      raw === MODEL_ENGINES.REPLICATE
    ) {
      return raw;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_ENGINE;
}

export function getActiveModelEngine() {
  return readPreferredEngine();
}

export function setActiveModelEngine(engineId) {
  const id =
    engineId === MODEL_ENGINES.BYTEPLUS ||
    engineId === MODEL_ENGINES.SEEDANCE ||
    engineId === MODEL_ENGINES.LOCAL_EXPORT ||
    engineId === MODEL_ENGINES.REPLICATE
      ? engineId
      : DEFAULT_ENGINE;
  try {
    localStorage.setItem('sps_model_engine', id);
    window.dispatchEvent(new CustomEvent('sps_model_engine_changed', { detail: { engine: id } }));
  } catch {
    /* ignore */
  }
  return id;
}

/**
 * Normalize adapter results so jobs / UI never depend on vendor payload shapes.
 */
function normalizeStillResult(raw = {}) {
  return {
    ok: true,
    engine: raw.engine || DEFAULT_ENGINE,
    kind: MEDIA_KINDS.STILL,
    url: raw.url || raw.imageUrl || '',
    width: raw.width,
    height: raw.height,
    credits: raw.credits,
    exportOnly: Boolean(raw.exportOnly),
    prompt: raw.prompt || '',
    raw
  };
}

function normalizeVideoCreate(raw = {}) {
  return {
    ok: true,
    engine: raw.engine || DEFAULT_ENGINE,
    kind: MEDIA_KINDS.VIDEO,
    taskId: raw.taskId || raw.id || '',
    status: raw.status || 'queued',
    credits: raw.credits,
    exportOnly: Boolean(raw.exportOnly),
    prompt: raw.prompt || '',
    raw
  };
}

function normalizeVideoPoll(raw = {}) {
  return {
    ok: true,
    engine: raw.engine || DEFAULT_ENGINE,
    kind: MEDIA_KINDS.VIDEO,
    taskId: raw.taskId || '',
    status: raw.status || 'running',
    url: raw.url || raw.videoUrl || '',
    raw
  };
}

/** Seedance / BytePlus still + video engine. */
const seedanceAdapter = {
  id: MODEL_ENGINES.SEEDANCE,
  label: 'Seedance (BytePlus)',
  supports: { still: true, video: true, comfyWorkflow: true },

  async generateStill(request = {}) {
    const data = await generateStudioImage({
      prompt: request.prompt,
      width: request.width,
      height: request.height,
      modelId: request.modelId,
      endpointUrl: request.endpointUrl,
      signal: request.signal
    });
    return normalizeStillResult(data);
  },

  async createVideo(request = {}) {
    const data = await generateStudioVideo({
      prompt: request.prompt,
      firstFrameUrl: request.firstFrameUrl,
      duration: request.duration,
      ratio: request.ratio,
      modelId: request.modelId,
      endpointUrl: request.endpointUrl,
      signal: request.signal
    });
    return normalizeVideoCreate(data);
  },

  async pollVideo(request = {}) {
    const data = await pollStudioVideo({
      taskId: request.taskId,
      endpointUrl: request.endpointUrl,
      signal: request.signal
    });
    return normalizeVideoPoll(data);
  },

  /** Matrix → Seedance master ComfyUI canvas payload (does not queue GPU). */
  buildComfyPayload(request = {}) {
    return assembleMatrixSeedanceWorkflow({
      shot: request.shot || {},
      shotIndex: request.shotIndex || 0,
      shots: request.shots || [],
      projectTitle: request.projectTitle || '',
      promptOverride: request.prompt || request.promptOverride || '',
      negativePrompt: request.negativePrompt || '',
      duration: request.duration,
      width: request.width,
      height: request.height,
      seed: request.seed,
      model: request.modelId || request.model || ''
    });
  }
};

const localExportAdapter = {
  id: MODEL_ENGINES.LOCAL_EXPORT,
  label: 'Local export (BYOK / external)',
  supports: { still: true, video: true },

  async generateStill(request = {}) {
    return normalizeStillResult({
      engine: MODEL_ENGINES.LOCAL_EXPORT,
      exportOnly: true,
      prompt: request.prompt || '',
      width: request.width,
      height: request.height
    });
  },

  async createVideo(request = {}) {
    return normalizeVideoCreate({
      engine: MODEL_ENGINES.LOCAL_EXPORT,
      exportOnly: true,
      taskId: `export_${Date.now()}`,
      status: 'succeeded',
      prompt: request.prompt || ''
    });
  },

  async pollVideo(request = {}) {
    return normalizeVideoPoll({
      engine: MODEL_ENGINES.LOCAL_EXPORT,
      exportOnly: true,
      taskId: request.taskId || '',
      status: 'succeeded',
      url: ''
    });
  }
};

/** Replicate BYOK still + video (flux-schnell / minimax video-01 defaults). */
const replicateAdapter = {
  id: MODEL_ENGINES.REPLICATE,
  label: 'Replicate (BYOK)',
  supports: { still: true, video: true },

  async generateStill(request = {}) {
    const data = await replicateGenerateStill({
      prompt: request.prompt,
      width: request.width,
      height: request.height,
      modelId: request.modelId,
      signal: request.signal
    });
    return normalizeStillResult({ ...data, engine: MODEL_ENGINES.REPLICATE });
  },

  async createVideo(request = {}) {
    const data = await replicateCreateVideo({
      prompt: request.prompt,
      firstFrameUrl: request.firstFrameUrl,
      duration: request.duration,
      modelId: request.modelId,
      signal: request.signal
    });
    return normalizeVideoCreate({ ...data, engine: MODEL_ENGINES.REPLICATE });
  },

  async pollVideo(request = {}) {
    const data = await replicatePollVideo({ taskId: request.taskId, signal: request.signal });
    return normalizeVideoPoll({ ...data, engine: MODEL_ENGINES.REPLICATE });
  }
};

const ADAPTERS = {
  [MODEL_ENGINES.SEEDANCE]: seedanceAdapter,
  [MODEL_ENGINES.BYTEPLUS]: seedanceAdapter,
  [MODEL_ENGINES.LOCAL_EXPORT]: localExportAdapter,
  [MODEL_ENGINES.REPLICATE]: replicateAdapter
};

export function listModelAdapters() {
  const active = getActiveModelEngine();
  return [
    {
      id: MODEL_ENGINES.SEEDANCE,
      label: seedanceAdapter.label,
      supports: seedanceAdapter.supports,
      active: active === MODEL_ENGINES.SEEDANCE || active === MODEL_ENGINES.BYTEPLUS
    },
    {
      id: MODEL_ENGINES.LOCAL_EXPORT,
      label: localExportAdapter.label,
      supports: localExportAdapter.supports,
      active: active === MODEL_ENGINES.LOCAL_EXPORT
    },
    {
      id: MODEL_ENGINES.REPLICATE,
      label: replicateAdapter.label,
      supports: replicateAdapter.supports,
      active: active === MODEL_ENGINES.REPLICATE,
      ready: hasReplicateKey()
    }
  ];
}

export function getModelAdapter(engineId = getActiveModelEngine()) {
  return ADAPTERS[engineId] || ADAPTERS[DEFAULT_ENGINE];
}

/** Stable entry points used by generationJobs / Generate desk. */
export async function adapterGenerateStill(request = {}) {
  const adapter = getModelAdapter(request.engine || getActiveModelEngine());
  if (!adapter.supports.still) {
    throw new Error(`${adapter.label} does not support still generate`);
  }
  return adapter.generateStill(request);
}

export async function adapterCreateVideo(request = {}) {
  const adapter = getModelAdapter(request.engine || getActiveModelEngine());
  if (!adapter.supports.video) {
    throw new Error(`${adapter.label} does not support video generate`);
  }
  return adapter.createVideo(request);
}

export async function adapterPollVideo(request = {}) {
  const adapter = getModelAdapter(request.engine || getActiveModelEngine());
  if (!adapter.pollVideo) {
    throw new Error(`${adapter.label} does not support video poll`);
  }
  return adapter.pollVideo(request);
}
