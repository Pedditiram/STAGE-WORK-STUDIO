/**
 * Parameter Mapper (PDF §6) — Matrix technical controls → Seedance node widgets.
 * Technical values stay out of the prompt unless the model requires them.
 */

const DURATION_CHOICES = ['4', '5', '6', '8', '10', '12', '15'];
const RESOLUTION_CHOICES = ['480p', '720p', '1080p', '4k'];
const RATIO_CHOICES = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', '9:21'];

const DEFAULT_SEEDANCE2_MODEL = 'dreamina-seedance-2-0-260128';

export const SEEDANCE2_COMFY_MODELS = Object.freeze([
  { id: 'dreamina-seedance-2-0-260128', label: 'Seedance 2.0' },
  { id: 'dreamina-seedance-2-0-fast-260128', label: 'Seedance 2.0 Fast' }
]);

function snapDuration(sec) {
  const n = Math.round(Number(sec) || 5);
  let best = DURATION_CHOICES[0];
  let bestDiff = Infinity;
  for (const c of DURATION_CHOICES) {
    const d = Math.abs(Number(c) - n);
    if (d < bestDiff) {
      bestDiff = d;
      best = c;
    }
  }
  return best;
}

function ratioFromSize(width, height) {
  const w = Number(width) || 1920;
  const h = Number(height) || 1080;
  const r = w / h;
  const candidates = [
    { id: '21:9', v: 21 / 9 },
    { id: '16:9', v: 16 / 9 },
    { id: '4:3', v: 4 / 3 },
    { id: '1:1', v: 1 },
    { id: '3:4', v: 3 / 4 },
    { id: '9:16', v: 9 / 16 },
    { id: '9:21', v: 9 / 21 }
  ];
  let best = '16:9';
  let bestDiff = Infinity;
  for (const c of candidates) {
    const d = Math.abs(c.v - r);
    if (d < bestDiff) {
      bestDiff = d;
      best = c.id;
    }
  }
  return RATIO_CHOICES.includes(best) ? best : '16:9';
}

function resolutionFromHeight(height) {
  const h = Number(height) || 1080;
  if (h >= 2000) return '4k';
  if (h >= 1000) return '1080p';
  if (h >= 700) return '720p';
  return '480p';
}

/**
 * Map Matrix + modal overrides → Seedance2VideoGenerate widget fields.
 */
export function mapSeedanceParameters({
  normalized,
  duration,
  width = 1920,
  height = 1080,
  seed = -1,
  model = '',
  ratio,
  resolution,
  generateAudio = true,
  watermark = false
} = {}) {
  const durSec = Number(duration) > 0 ? Number(duration) : Number(normalized?.technical?.durationSec) || 5;
  const modelId = String(model || '').trim();
  const isComfySeedance2 =
    modelId.startsWith('dreamina-seedance-2') || modelId.includes('seedance-2-0');
  const mappedModel = isComfySeedance2 ? modelId : DEFAULT_SEEDANCE2_MODEL;

  const params = {
    model: mappedModel,
    ratio: ratio && RATIO_CHOICES.includes(ratio) ? ratio : ratioFromSize(width, height),
    duration: snapDuration(durSec),
    resolution:
      resolution && RESOLUTION_CHOICES.includes(resolution)
        ? resolution
        : resolutionFromHeight(height),
    generate_audio: Boolean(generateAudio),
    watermark: Boolean(watermark),
    seed: Number.isFinite(Number(seed)) ? Number(seed) : -1,
    width: Number(width) || 1920,
    height: Number(height) || 1080,
    api_key: '', // never embed keys in workflow JSON
    base_url: 'https://ark.ap-southeast.bytepluses.com/api/v3'
  };

  return {
    params,
    choices: {
      duration: DURATION_CHOICES,
      resolution: RESOLUTION_CHOICES,
      ratio: RATIO_CHOICES,
      models: SEEDANCE2_COMFY_MODELS
    }
  };
}

export function saveVideoFilenamePrefix({ projectId, sceneId, shotId } = {}) {
  const safe = (v) =>
    String(v || 'shot')
      .replace(/[^\w.-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48) || 'shot';
  return `SWS/${safe(projectId)}/${safe(sceneId)}_${safe(shotId)}`;
}
