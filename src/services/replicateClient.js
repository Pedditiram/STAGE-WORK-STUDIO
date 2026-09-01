/**
 * P10/P14 — Replicate BYOK still + video (browser → Replicate; key stays on account).
 */

import { getCurrentUserEmail } from '../utils/projectPermissions';
import { assertCanGenerate, resolveReplicateKey, trackUsage } from '../utils/saasControl';

const REPLICATE_API = 'https://api.replicate.com/v1';
const DEFAULT_STILL_MODEL = 'black-forest-labs/flux-schnell';
/** Text/image → video; billed by Replicate on the user account. */
const DEFAULT_VIDEO_MODEL = 'minimax/video-01';

const STILL_MODEL_KEY = 'sps_replicate_still_model';
const VIDEO_MODEL_KEY = 'sps_replicate_video_model';

export const REPLICATE_STILL_MODELS = Object.freeze([
  { id: 'black-forest-labs/flux-schnell', label: 'Flux Schnell (fast)' },
  { id: 'black-forest-labs/flux-dev', label: 'Flux Dev' },
  { id: 'stability-ai/sdxl', label: 'SDXL' },
  { id: 'ideogram-ai/ideogram-v2-turbo', label: 'Ideogram v2 Turbo' }
]);

export const REPLICATE_VIDEO_MODELS = Object.freeze([
  { id: 'minimax/video-01', label: 'MiniMax Video-01' },
  { id: 'kwaivgi/kling-v1.6-standard', label: 'Kling v1.6 Standard' },
  { id: 'luma/ray', label: 'Luma Ray' },
  { id: 'tencent/hunyuan-video', label: 'Hunyuan Video' }
]);

export function getReplicateStillModel() {
  if (typeof window === 'undefined') return DEFAULT_STILL_MODEL;
  try {
    const raw = String(localStorage.getItem(STILL_MODEL_KEY) || '').trim();
    if (REPLICATE_STILL_MODELS.some((m) => m.id === raw)) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_STILL_MODEL;
}

export function setReplicateStillModel(modelId) {
  const id = REPLICATE_STILL_MODELS.some((m) => m.id === modelId) ? modelId : DEFAULT_STILL_MODEL;
  try {
    localStorage.setItem(STILL_MODEL_KEY, id);
    window.dispatchEvent(new CustomEvent('sps_replicate_models_changed'));
  } catch {
    /* ignore */
  }
  return id;
}

export function getReplicateVideoModel() {
  if (typeof window === 'undefined') return DEFAULT_VIDEO_MODEL;
  try {
    const raw = String(localStorage.getItem(VIDEO_MODEL_KEY) || '').trim();
    if (REPLICATE_VIDEO_MODELS.some((m) => m.id === raw)) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_VIDEO_MODEL;
}

export function setReplicateVideoModel(modelId) {
  const id = REPLICATE_VIDEO_MODELS.some((m) => m.id === modelId) ? modelId : DEFAULT_VIDEO_MODEL;
  try {
    localStorage.setItem(VIDEO_MODEL_KEY, id);
    window.dispatchEvent(new CustomEvent('sps_replicate_models_changed'));
  } catch {
    /* ignore */
  }
  return id;
}

function aspectRatioFromSize(width, height) {
  const w = Number(width) || 1280;
  const h = Number(height) || 720;
  const r = w / h;
  if (r >= 1.7) return '16:9';
  if (r >= 1.4) return '3:2';
  if (r >= 1.2) return '4:3';
  if (r >= 0.9) return '1:1';
  if (r >= 0.7) return '3:4';
  if (r >= 0.55) return '2:3';
  return '9:16';
}

async function replicateFetch(path, { method = 'GET', token, body, signal } = {}) {
  const res = await fetch(`${REPLICATE_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined,
    signal
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail =
      typeof data.detail === 'string'
        ? data.detail
        : Array.isArray(data.detail)
          ? data.detail.map((d) => d?.msg || d?.message || '').filter(Boolean).join(' · ')
          : data.error || data.title;
    throw new Error(detail || `Replicate request failed (${res.status})`);
  }
  return data;
}

async function pollPrediction(id, token, { maxMs = 120000, signal } = {}) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    if (signal?.aborted) {
      const err = new Error('Aborted');
      err.name = 'AbortError';
      throw err;
    }
    const data = await replicateFetch(`/predictions/${id}`, { token, signal });
    const st = String(data.status || '').toLowerCase();
    if (st === 'succeeded') return data;
    if (st === 'failed' || st === 'canceled' || st === 'cancelled') {
      throw new Error(data.error || `Replicate ${st}`);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error('Replicate timed out — try again.');
}

function firstOutputUrl(output) {
  if (typeof output === 'string') return output;
  if (Array.isArray(output) && output.length) return String(output[0] || '');
  if (output && typeof output === 'object') {
    return String(output.url || output.video || output.mp4 || '');
  }
  return '';
}

function requireToken(email) {
  const token = resolveReplicateKey(email);
  if (!token) {
    throw new Error('Add a Replicate key in Settings → API keys (BYOK).');
  }
  return token;
}

function assertGenerateGate(email) {
  const gate = assertCanGenerate(email, { consumeRate: true });
  if (!gate.ok) {
    const err = new Error(gate.message);
    err.code = 'saas';
    throw err;
  }
}

export function hasReplicateKey(email = '') {
  return Boolean(resolveReplicateKey(email || getCurrentUserEmail()));
}

export async function replicateGenerateStill({
  prompt = '',
  width = 1280,
  height = 720,
  modelId = '',
  signal
} = {}) {
  const email = getCurrentUserEmail();
  assertGenerateGate(email);
  const token = requireToken(email);

  const modelPath = String(modelId || getReplicateStillModel()).includes('/')
    ? String(modelId || getReplicateStillModel()).trim()
    : getReplicateStillModel();

  const created = await replicateFetch(`/models/${modelPath}/predictions`, {
    method: 'POST',
    token,
    signal,
    body: {
      input: {
        prompt: String(prompt || '').slice(0, 4000),
        aspect_ratio: aspectRatioFromSize(width, height),
        num_outputs: 1,
        output_format: 'webp',
        output_quality: 90
      }
    }
  });

  const done =
    String(created.status || '').toLowerCase() === 'succeeded'
      ? created
      : await pollPrediction(created.id, token, { signal });
  const url = firstOutputUrl(done.output);
  if (!url) throw new Error('Replicate returned no image URL.');

  trackUsage('generate');
  return {
    ok: true,
    engine: 'replicate',
    url,
    width,
    height,
    prompt,
    raw: done
  };
}

/**
 * Create a Replicate video prediction (returns taskId for the durable job poller).
 */
export async function replicateCreateVideo({
  prompt = '',
  firstFrameUrl = '',
  duration = 5,
  modelId = '',
  signal
} = {}) {
  const email = getCurrentUserEmail();
  assertGenerateGate(email);
  const token = requireToken(email);

  const modelPath = String(modelId || getReplicateVideoModel()).includes('/')
    ? String(modelId || getReplicateVideoModel()).trim()
    : getReplicateVideoModel();

  const input = {
    prompt: String(prompt || '').slice(0, 2000)
  };
  const frame = String(firstFrameUrl || '').trim();
  if (frame.startsWith('http')) {
    input.first_frame_image = frame;
    input.image = frame;
  }
  const sec = Math.max(1, Math.min(10, Math.round(Number(duration) || 5)));
  if (sec) input.duration = sec;

  const created = await replicateFetch(`/models/${modelPath}/predictions`, {
    method: 'POST',
    token,
    signal,
    body: { input }
  });

  const taskId = String(created.id || '').trim();
  if (!taskId) throw new Error('Replicate video create returned no prediction id.');

  trackUsage('generate');
  return {
    ok: true,
    engine: 'replicate',
    taskId,
    status: String(created.status || 'queued').toLowerCase(),
    prompt,
    raw: created
  };
}

/** Single poll tick for the generation job worker. */
export async function replicatePollVideo({ taskId = '', signal } = {}) {
  const email = getCurrentUserEmail();
  const token = requireToken(email);
  const id = String(taskId || '').trim();
  if (!id) throw new Error('Replicate poll needs a taskId.');

  const data = await replicateFetch(`/predictions/${id}`, { token, signal });
  const st = String(data.status || 'running').toLowerCase();
  const url = st === 'succeeded' ? firstOutputUrl(data.output) : '';
  return {
    ok: true,
    engine: 'replicate',
    taskId: id,
    status: st === 'canceled' ? 'cancelled' : st,
    url,
    raw: data
  };
}
