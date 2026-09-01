/**
 * Versioned Seedance master ComfyUI frontend workflow (PDF §2, §7–§9).
 * Clones this template and injects Matrix prompt / refs / parameters —
 * does not rebuild topology from scratch.
 *
 * Topology (studio dual-BytePlus canvas):
 *   K Text "PROMPT COMPOSER" → PedditiLabs.prompt + ByteDance 2.5 model.prompt
 *   K Text "NEGATIVE PROMPT" widget (not concatenated into prompt; Pedditi has no negative socket)
 *   K Text "SYSTEM INSTRUCTION" widget (third field; never folded into prompt or negative)
 *   ×9 path subgraphs → Pedditi image_1…9 + ByteDance model.reference_images.image_1…9
 *   Pedditi VIDEO → SaveVideoCleanName → PlaySound|pysssss
 */

import { saveVideoFilenamePrefix } from './comfyParameterMapper';
import { buildComfySaveVideoPrefix } from './projectAssetRoots';

export const SEEDANCE_MASTER_TEMPLATE_ID = 'video_seedance2_master';
export const SEEDANCE_MASTER_TEMPLATE_VERSION = '1.3.3';
/** Pedditi Labs Ark node with image_1…image_9. */
export const SEEDANCE_MASTER_NODE_CLASS = 'PedditiLabsBytePlusSeedance2';
/** Official Comfy partner node (Seedance 2.5 Reference to Video). */
export const SEEDANCE_BYTEDANCE_25_CLASS = 'ByteDance2ReferenceNodeV2';
export const SEEDANCE_SAVE_VIDEO_CLASS = 'SaveVideoCleanName';
export const SEEDANCE_PLAY_SOUND_CLASS = 'PlaySound|pysssss';
export const SEEDANCE_TEXT_CLASS = 'Text';
export const SEEDANCE_LOAD_FROM_PATH_CLASS = 'LoadImageFromPath';
export const SEEDANCE_LOAD_VIDEO_FROM_PATH_CLASS = 'LoadVideoFromPath';
export const SEEDANCE_VIDEO_PREVIEW_CLASS = 'VideoPreview';
export const SEEDANCE_RESIZE_LONGER_CLASS = 'ResizeImagesByLongerEdge';
export const SEEDANCE_PREVIEW_IMAGE_CLASS = 'PreviewImage';

export const SEEDANCE_MASTER_REQUIRED_NODES = Object.freeze([
  SEEDANCE_MASTER_NODE_CLASS,
  SEEDANCE_BYTEDANCE_25_CLASS,
  SEEDANCE_SAVE_VIDEO_CLASS,
  SEEDANCE_PLAY_SOUND_CLASS,
  SEEDANCE_TEXT_CLASS,
  SEEDANCE_LOAD_FROM_PATH_CLASS,
  SEEDANCE_LOAD_VIDEO_FROM_PATH_CLASS,
  SEEDANCE_RESIZE_LONGER_CLASS,
  SEEDANCE_PREVIEW_IMAGE_CLASS
]);

const MASTER_META = {
  templateId: SEEDANCE_MASTER_TEMPLATE_ID,
  templateVersion: SEEDANCE_MASTER_TEMPLATE_VERSION,
  family: 'seedance_native',
  description:
    'Matrix → Pedditi Labs Seedance 2.0 + ByteDance Seedance 2.5 (shared prompt/refs) → Save Video Clean Name → PlaySound'
};

/** PedditiLabsBytePlusSeedance2 — IMAGE sockets first. */
const PEDDITI_INPUT_IMAGE_BASE = 0; // image_1 … image_9 → 0..8
const PEDDITI_INPUT_VIDEO = 9; // video_1
const PEDDITI_INPUT_PROMPT = 23;

/**
 * ByteDance2ReferenceNodeV2 (Seedance 2.5 + task_type) frontend input layout:
 * widgets first, then autogrow image_1…9, video_1, audio_1, asset_1, …
 */
const BYTEDANCE_INPUT_PROMPT = 1; // model.prompt
const BYTEDANCE_INPUT_IMAGE_BASE = 8; // model.reference_images.image_1
const BYTEDANCE_INPUT_VIDEO = 17; // model.reference_videos.video_1

const LONGER_EDGE = 3000;

/** Studio 2×5 reference grid (001–005 / 006–009 + 000). Leave clear gap before generators. */
const REF_GRID = {
  originX: 520,
  originY: 80,
  cellW: 260,
  cellH: 400,
  nodeW: 240,
  nodeH: 340
};

/** Left edge of Seedance / output column — past the ref grid. */
const GEN_X = 1980;
const OUT_X = 2520;
const PLAY_X = 2920;

function refGridPos(slotOrZero) {
  // 1–5 → row 0 cols 0–4; 6–9 → row 1 cols 0–3; 0 → row 1 col 4
  const n = Number(slotOrZero);
  let row;
  let col;
  if (n === 0) {
    row = 1;
    col = 4;
  } else if (n >= 1 && n <= 5) {
    row = 0;
    col = n - 1;
  } else {
    row = 1;
    col = n - 6;
  }
  return [
    REF_GRID.originX + col * REF_GRID.cellW,
    REF_GRID.originY + row * REF_GRID.cellH
  ];
}

function newUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Prefer absolute filesystem paths for Load Image (From Path).
 * HTTP / data / idb URLs cannot feed that node — return empty (bypass slot).
 */
export function resolveLocalImagePath(slot = {}) {
  const candidates = [slot.path, slot.localPath, slot.filePath, slot.url, slot.filename];
  for (const raw of candidates) {
    let s = String(raw || '').trim();
    if (!s) continue;
    if (s.startsWith('file://')) {
      try {
        s = decodeURIComponent(s.replace(/^file:\/\//, ''));
      } catch {
        s = s.replace(/^file:\/\//, '');
      }
    }
    if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:') || s.startsWith('idb:')) {
      continue;
    }
    if (s.startsWith('/') || /^[A-Za-z]:[\\/]/.test(s) || s.startsWith('\\\\')) {
      return s;
    }
  }
  return '';
}

/** Absolute filesystem path for Load Video From Path (000 subgraph). */
export function resolveLocalVideoPath(source = {}) {
  return resolveLocalImagePath({
    path: source.videoPath || source.path,
    localPath: source.localVideoPath || source.localPath,
    filePath: source.filePath,
    url: source.videoUrl || source.url,
    filename: source.filename
  });
}

function padSlotTitle(slot) {
  return String(slot).padStart(3, '0');
}

/**
 * One image subgraph definition: K Text path → Load From Path → Resize 3000 → Preview → IMAGE out.
 */
function buildImagePathSubgraphDefinition(subgraphId, slot, imagePath) {
  const name = padSlotTitle(slot);
  const textId = 1;
  const loadId = 2;
  const resizeId = 3;
  const previewId = 4;
  const linkTextLoad = 1;
  const linkLoadResize = 2;
  const linkResizePreview = 3;
  const linkResizeOut = 4;
  const outPortId = newUuid();

  const path = String(imagePath || '');

  return {
    id: subgraphId,
    version: 1,
    state: { lastGroupId: 0, lastNodeId: previewId, lastLinkId: linkResizeOut, lastRerouteId: 0 },
    revision: 0,
    config: {},
    name,
    inputNode: { id: -10, bounding: [40, 80, 128, 48] },
    outputNode: { id: -20, bounding: [920, 120, 128, 68] },
    inputs: [],
    outputs: [
      {
        id: outPortId,
        name: 'IMAGE',
        type: 'IMAGE',
        linkIds: [linkResizeOut],
        localized_name: 'IMAGE',
        pos: [944, 140]
      }
    ],
    widgets: [],
    nodes: [
      {
        id: textId,
        type: SEEDANCE_TEXT_CLASS,
        pos: [40, 140],
        size: [400, 160],
        flags: {},
        order: 0,
        mode: 0,
        inputs: [
          {
            localized_name: 'text',
            name: 'text',
            type: 'STRING',
            widget: { name: 'text' },
            link: null
          }
        ],
        outputs: [
          {
            localized_name: 'STRING',
            name: 'STRING',
            type: 'STRING',
            links: [linkTextLoad]
          }
        ],
        properties: { 'Node name for S&R': SEEDANCE_TEXT_CLASS },
        widgets_values: [path],
        title: 'K Text'
      },
      {
        id: loadId,
        type: SEEDANCE_LOAD_FROM_PATH_CLASS,
        pos: [480, 140],
        size: [280, 120],
        flags: {},
        order: 1,
        mode: 0,
        inputs: [
          {
            localized_name: 'image_path',
            name: 'image_path',
            type: 'STRING',
            widget: { name: 'image_path' },
            link: linkTextLoad
          },
          {
            localized_name: 'rgba_to_mask',
            name: 'rgba_to_mask',
            shape: 7,
            type: 'BOOLEAN',
            widget: { name: 'rgba_to_mask' },
            link: null
          }
        ],
        outputs: [
          {
            localized_name: 'IMAGE',
            name: 'IMAGE',
            type: 'IMAGE',
            links: [linkLoadResize]
          },
          {
            localized_name: 'MASK',
            name: 'MASK',
            type: 'MASK',
            links: null
          }
        ],
        properties: { 'Node name for S&R': SEEDANCE_LOAD_FROM_PATH_CLASS },
        // Direct Alpha (label_off) — matches studio path subgraphs
        widgets_values: ['', false]
      },
      {
        id: resizeId,
        type: SEEDANCE_RESIZE_LONGER_CLASS,
        pos: [800, 100],
        size: [300, 80],
        flags: {},
        order: 2,
        mode: 0,
        inputs: [
          {
            localized_name: 'images',
            name: 'images',
            type: 'IMAGE',
            link: linkLoadResize
          },
          {
            localized_name: 'longer_edge',
            name: 'longer_edge',
            type: 'INT',
            widget: { name: 'longer_edge' },
            link: null
          }
        ],
        outputs: [
          {
            localized_name: 'images',
            name: 'images',
            type: 'IMAGE',
            links: [linkResizePreview, linkResizeOut]
          }
        ],
        properties: { 'Node name for S&R': SEEDANCE_RESIZE_LONGER_CLASS },
        widgets_values: [LONGER_EDGE]
      },
      {
        id: previewId,
        type: SEEDANCE_PREVIEW_IMAGE_CLASS,
        pos: [800, 220],
        size: [240, 260],
        flags: {},
        order: 3,
        mode: 0,
        inputs: [
          {
            localized_name: 'images',
            name: 'images',
            type: 'IMAGE',
            link: linkResizePreview
          }
        ],
        outputs: [
          {
            localized_name: 'images',
            name: 'images',
            type: 'IMAGE',
            links: null
          }
        ],
        properties: { 'Node name for S&R': SEEDANCE_PREVIEW_IMAGE_CLASS },
        widgets_values: []
      }
    ],
    groups: [],
    links: [
      {
        id: linkTextLoad,
        origin_id: textId,
        origin_slot: 0,
        target_id: loadId,
        target_slot: 0,
        type: 'STRING'
      },
      {
        id: linkLoadResize,
        origin_id: loadId,
        origin_slot: 0,
        target_id: resizeId,
        target_slot: 0,
        type: 'IMAGE'
      },
      {
        id: linkResizePreview,
        origin_id: resizeId,
        origin_slot: 0,
        target_id: previewId,
        target_slot: 0,
        type: 'IMAGE'
      },
      {
        id: linkResizeOut,
        origin_id: resizeId,
        origin_slot: 0,
        target_id: -20,
        target_slot: 0,
        type: 'IMAGE'
      }
    ],
    extra: {}
  };
}

/**
 * Video ref subgraph 000: K Text path → Load Video From Path → VideoPreview → video_output.
 */
function buildVideoPathSubgraphDefinition(subgraphId, videoPath) {
  const textId = 1;
  const loadId = 2;
  const previewId = 3;
  const linkTextLoad = 1;
  const linkLoadPreview = 2;
  const linkLoadOut = 3;
  const outPortId = newUuid();
  const path = String(videoPath || '');

  return {
    id: subgraphId,
    version: 1,
    state: { lastGroupId: 0, lastNodeId: previewId, lastLinkId: linkLoadOut, lastRerouteId: 0 },
    revision: 0,
    config: {},
    name: '000',
    inputNode: { id: -10, bounding: [40, 80, 128, 48] },
    outputNode: { id: -20, bounding: [920, 120, 128, 68] },
    inputs: [],
    outputs: [
      {
        id: outPortId,
        name: 'video_output',
        type: 'VIDEO',
        linkIds: [linkLoadOut],
        localized_name: 'video_output',
        pos: [944, 140]
      }
    ],
    widgets: [],
    nodes: [
      {
        id: textId,
        type: SEEDANCE_TEXT_CLASS,
        pos: [40, 140],
        size: [400, 160],
        flags: {},
        order: 0,
        mode: 0,
        inputs: [
          {
            localized_name: 'text',
            name: 'text',
            type: 'STRING',
            widget: { name: 'text' },
            link: null
          }
        ],
        outputs: [{ localized_name: 'STRING', name: 'STRING', type: 'STRING', links: [linkTextLoad] }],
        properties: { 'Node name for S&R': SEEDANCE_TEXT_CLASS },
        widgets_values: [path],
        title: 'K Text'
      },
      {
        id: loadId,
        type: SEEDANCE_LOAD_VIDEO_FROM_PATH_CLASS,
        pos: [480, 140],
        size: [300, 120],
        flags: {},
        order: 1,
        mode: 0,
        inputs: [
          {
            localized_name: 'video_path',
            name: 'video_path',
            type: 'STRING',
            widget: { name: 'video_path' },
            link: linkTextLoad
          }
        ],
        outputs: [
          { localized_name: 'video', name: 'video', type: 'IMAGE', links: null },
          {
            localized_name: 'video_output',
            name: 'video_output',
            type: 'VIDEO',
            links: [linkLoadOut]
          },
          {
            localized_name: 'video_path',
            name: 'video_path',
            type: 'STRING',
            links: [linkLoadPreview]
          }
        ],
        properties: { 'Node name for S&R': SEEDANCE_LOAD_VIDEO_FROM_PATH_CLASS },
        widgets_values: ['']
      },
      {
        id: previewId,
        type: SEEDANCE_VIDEO_PREVIEW_CLASS,
        pos: [800, 140],
        size: [240, 200],
        flags: {},
        order: 2,
        mode: 0,
        inputs: [
          {
            localized_name: 'video',
            name: 'video',
            type: '*',
            link: linkLoadPreview
          }
        ],
        outputs: [],
        properties: { 'Node name for S&R': SEEDANCE_VIDEO_PREVIEW_CLASS },
        widgets_values: ['']
      }
    ],
    groups: [],
    links: [
      {
        id: linkTextLoad,
        origin_id: textId,
        origin_slot: 0,
        target_id: loadId,
        target_slot: 0,
        type: 'STRING'
      },
      {
        id: linkLoadPreview,
        origin_id: loadId,
        origin_slot: 2,
        target_id: previewId,
        target_slot: 0,
        type: 'STRING'
      },
      {
        id: linkLoadOut,
        origin_id: loadId,
        origin_slot: 1,
        target_id: -20,
        target_slot: 0,
        type: 'VIDEO'
      }
    ],
    extra: {}
  };
}

function buildPedditiInputsSkeleton() {
  const inputs = [];
  for (let i = 1; i <= 9; i += 1) {
    inputs.push({ name: `image_${i}`, type: 'IMAGE', link: null });
  }
  inputs.push(
    { name: 'video_1', type: 'VIDEO', link: null },
    { name: 'audio_1', type: 'AUDIO', link: null },
    { name: 'asset_1', type: 'STRING', link: null, widget: { name: 'asset_1' } },
    { name: 'first_frame_image', type: 'IMAGE', link: null },
    { name: 'last_frame_image', type: 'IMAGE', link: null },
    { name: 'reference_images', type: 'IMAGE', link: null },
    { name: 'reference_audio', type: 'AUDIO', link: null },
    { name: 'api_key', type: 'STRING', link: null, widget: { name: 'api_key' } },
    { name: 'model', type: 'STRING', link: null, widget: { name: 'model' } },
    { name: 'ratio', type: 'COMBO', link: null, widget: { name: 'ratio' } },
    { name: 'duration', type: 'COMBO', link: null, widget: { name: 'duration' } },
    { name: 'resolution', type: 'COMBO', link: null, widget: { name: 'resolution' } },
    { name: 'generate_audio', type: 'BOOLEAN', link: null, widget: { name: 'generate_audio' } },
    { name: 'watermark', type: 'BOOLEAN', link: null, widget: { name: 'watermark' } },
    { name: 'prompt', type: 'STRING', link: null, widget: { name: 'prompt' } },
    { name: 'reference_video_url', type: 'STRING', link: null, widget: { name: 'reference_video_url' } },
    { name: 'base_url', type: 'STRING', link: null, widget: { name: 'base_url' } },
    { name: 'poll_interval_sec', type: 'FLOAT', link: null, widget: { name: 'poll_interval_sec' } },
    { name: 'timeout_sec', type: 'INT', link: null, widget: { name: 'timeout_sec' } }
  );
  return inputs;
}

/** ByteDance Seedance 2.5 Reference to Video (V2 + task_type). */
function buildByteDance25InputsSkeleton() {
  const inputs = [
    {
      localized_name: 'model',
      name: 'model',
      type: 'COMFY_DYNAMICCOMBO_V3',
      widget: { name: 'model' },
      link: null
    },
    {
      localized_name: 'prompt',
      name: 'model.prompt',
      type: 'STRING',
      widget: { name: 'model.prompt' },
      link: null
    },
    {
      localized_name: 'resolution',
      name: 'model.resolution',
      type: 'COMBO',
      widget: { name: 'model.resolution' },
      link: null
    },
    {
      localized_name: 'ratio',
      name: 'model.ratio',
      type: 'COMBO',
      widget: { name: 'model.ratio' },
      link: null
    },
    {
      localized_name: 'duration',
      name: 'model.duration',
      type: 'INT',
      widget: { name: 'model.duration' },
      link: null
    },
    {
      localized_name: 'generate_audio',
      name: 'model.generate_audio',
      type: 'BOOLEAN',
      widget: { name: 'model.generate_audio' },
      link: null
    },
    {
      localized_name: 'task_type',
      name: 'model.task_type',
      type: 'COMBO',
      widget: { name: 'model.task_type' },
      link: null
    },
    {
      localized_name: 'output_format',
      name: 'model.output_format',
      type: 'COMBO',
      widget: { name: 'model.output_format' },
      link: null
    }
  ];
  for (let i = 1; i <= 9; i += 1) {
    inputs.push({
      label: `image_${i}`,
      localized_name: `model.reference_images.image_${i}`,
      name: `model.reference_images.image_${i}`,
      shape: 7,
      type: 'IMAGE',
      link: null
    });
  }
  inputs.push(
    {
      label: 'video_1',
      localized_name: 'model.reference_videos.video_1',
      name: 'model.reference_videos.video_1',
      shape: 7,
      type: 'VIDEO',
      link: null
    },
    {
      label: 'audio_1',
      localized_name: 'model.reference_audios.audio_1',
      name: 'model.reference_audios.audio_1',
      shape: 7,
      type: 'AUDIO',
      link: null
    },
    {
      label: 'asset_1',
      localized_name: 'model.reference_assets.asset_1',
      name: 'model.reference_assets.asset_1',
      shape: 7,
      type: 'STRING',
      link: null
    },
    {
      localized_name: 'auto_downscale',
      name: 'model.auto_downscale',
      shape: 7,
      type: 'BOOLEAN',
      widget: { name: 'model.auto_downscale' },
      link: null
    },
    {
      localized_name: 'auto_upscale',
      name: 'model.auto_upscale',
      shape: 7,
      type: 'BOOLEAN',
      widget: { name: 'model.auto_upscale' },
      link: null
    },
    {
      localized_name: 'seed',
      name: 'seed',
      type: 'INT',
      widget: { name: 'seed' },
      link: null
    },
    {
      localized_name: 'watermark',
      name: 'watermark',
      type: 'BOOLEAN',
      widget: { name: 'watermark' },
      link: null
    }
  );
  return inputs;
}

function clampByteDanceResolution(resolution) {
  const r = String(resolution || '720p');
  if (r === '4k' || r === '1080p') return r === '4k' ? '1080p' : r;
  if (r === '480p' || r === '720p' || r === '1080p') return r;
  return '720p';
}

function clampByteDanceDuration(duration) {
  const n = Math.round(Number(duration) || 5);
  return Math.min(30, Math.max(4, n));
}

/**
 * Build (or clone) the versioned Seedance master frontend workflow and inject shot data.
 */
export function buildSeedanceMasterFrontendWorkflow({
  prompt = '',
  negativePrompt = '',
  systemInstruction = '',
  promptSource = '',
  normalized = {},
  references = { slots: [] },
  params = {},
  shotLabel = '',
  assetRoots = null
} = {}) {
  const nodes = [];
  const links = [];
  const subgraphs = [];
  let linkId = 1;

  const shotTitle = shotLabel || normalized.shotId || 'SHOT';
  const promptText = String(prompt || '').slice(0, 12000);
  const negativeText = String(negativePrompt || '').slice(0, 4000);
  const systemText = String(systemInstruction || '').slice(0, 4000);

  const promptNodeId = 11;
  const promptNode = {
    id: promptNodeId,
    type: SEEDANCE_TEXT_CLASS,
    pos: [40, 100],
    size: [420, 380],
    flags: {},
    order: 0,
    mode: 0,
    inputs: [
      {
        localized_name: 'text',
        name: 'text',
        type: 'STRING',
        widget: { name: 'text' },
        link: null
      }
    ],
    outputs: [
      {
        localized_name: 'STRING',
        name: 'STRING',
        type: 'STRING',
        links: []
      }
    ],
    title: 'PROMPT COMPOSER',
    properties: { 'Node name for S&R': SEEDANCE_TEXT_CLASS },
    widgets_values: [promptText],
    color: '#2a2926',
    bgcolor: '#1a1916'
  };
  nodes.push(promptNode);

  const negativeNodeId = 12;
  const negativeNode = {
    id: negativeNodeId,
    type: SEEDANCE_TEXT_CLASS,
    pos: [40, 500],
    size: [420, 160],
    flags: {},
    order: 1,
    mode: 0,
    inputs: [
      {
        localized_name: 'text',
        name: 'text',
        type: 'STRING',
        widget: { name: 'text' },
        link: null
      }
    ],
    outputs: [
      {
        localized_name: 'STRING',
        name: 'STRING',
        type: 'STRING',
        links: []
      }
    ],
    title: 'NEGATIVE PROMPT',
    properties: { 'Node name for S&R': SEEDANCE_TEXT_CLASS },
    widgets_values: [negativeText],
    color: '#2a2326',
    bgcolor: '#1a1416'
  };
  nodes.push(negativeNode);

  const systemNodeId = 13;
  const systemNode = {
    id: systemNodeId,
    type: SEEDANCE_TEXT_CLASS,
    pos: [40, 680],
    size: [420, 140],
    flags: {},
    order: 2,
    mode: 0,
    inputs: [
      {
        localized_name: 'text',
        name: 'text',
        type: 'STRING',
        widget: { name: 'text' },
        link: null
      }
    ],
    outputs: [
      {
        localized_name: 'STRING',
        name: 'STRING',
        type: 'STRING',
        links: []
      }
    ],
    title: 'SYSTEM INSTRUCTION',
    properties: { 'Node name for S&R': SEEDANCE_TEXT_CLASS },
    widgets_values: [systemText],
    color: '#23262a',
    bgcolor: '#14161a'
  };
  nodes.push(systemNode);

  const imageOuterNodes = [];
  for (let i = 1; i <= 9; i += 1) {
    const slot = (references.slots || []).find((s) => s.slot === i) || {};
    const imagePath = resolveLocalImagePath(slot);
    const hasPath = Boolean(imagePath);
    const subgraphId = newUuid();
    const nodeId = 100 + i;

    subgraphs.push(buildImagePathSubgraphDefinition(subgraphId, i, imagePath));

    const outer = {
      id: nodeId,
      type: subgraphId,
      pos: refGridPos(i),
      size: [REF_GRID.nodeW, REF_GRID.nodeH],
      flags: {},
      order: i,
      mode: hasPath ? 0 : 4,
      inputs: [],
      outputs: [
        {
          localized_name: 'IMAGE',
          name: 'IMAGE',
          type: 'IMAGE',
          links: []
        }
      ],
      title: padSlotTitle(i),
      properties: {
        proxyWidgets: [['4', '$$canvas-image-preview']]
      },
      widgets_values: [],
      color: '#2a363b',
      bgcolor: '#3f5159'
    };
    nodes.push(outer);
    imageOuterNodes.push({ nodeId, slot: i, hasPath, subgraphId });
  }

  // 000 video subgraph — bottom-right of the 2×5 grid (studio layout)
  const videoPath = resolveLocalVideoPath({
    ...(references.video || {}),
    videoPath: params.referenceVideoPath || references.videoPath,
    videoUrl: params.referenceVideoUrl || references.videoUrl
  });
  const hasVideoPath = Boolean(videoPath);
  const videoSubgraphId = newUuid();
  const videoNodeId = 110;
  subgraphs.push(buildVideoPathSubgraphDefinition(videoSubgraphId, videoPath));
  const videoOuter = {
    id: videoNodeId,
    type: videoSubgraphId,
    pos: refGridPos(0),
    size: [REF_GRID.nodeW, REF_GRID.nodeH],
    flags: {},
    order: 10,
    mode: hasVideoPath ? 0 : 4,
    inputs: [],
    outputs: [
      {
        localized_name: 'video_output',
        name: 'video_output',
        type: 'VIDEO',
        links: []
      }
    ],
    title: '000',
    properties: { proxyWidgets: [] },
    widgets_values: [],
    color: '#2a363b',
    bgcolor: '#3f5159'
  };
  nodes.push(videoOuter);

  const pedditiId = 200;
  const bytedanceId = 210;
  const saveId = 300;
  const playId = 310;

  const pedditiNode = {
    id: pedditiId,
    type: SEEDANCE_MASTER_NODE_CLASS,
    pos: [GEN_X, 580],
    size: [440, 720],
    flags: {},
    order: pedditiId,
    mode: 0,
    inputs: buildPedditiInputsSkeleton(),
    outputs: [
      { name: 'VIDEO', type: 'VIDEO', links: [], slot_index: 0, localized_name: 'VIDEO' },
      { name: 'video_url', type: 'STRING', links: null, localized_name: 'video_url' },
      { name: 'local_path', type: 'STRING', links: null, localized_name: 'local_path' },
      { name: 'task_id', type: 'STRING', links: null, localized_name: 'task_id' }
    ],
    title: 'pedditi labs byteplus seedance 2.0',
    properties: { 'Node name for S&R': SEEDANCE_MASTER_NODE_CLASS },
    widgets_values: [
      String(params.api_key || ''),
      String(params.model || 'dreamina-seedance-2-0-260128'),
      String(params.ratio || '16:9'),
      String(params.duration || '5'),
      String(params.resolution || '480p'),
      Boolean(params.generate_audio !== false),
      Boolean(params.watermark),
      '', // prompt — PROMPT COMPOSER link
      '',
      String(params.base_url || 'https://ark.ap-southeast.bytepluses.com/api/v3'),
      5.0,
      600
    ]
  };

  const bytedanceNode = {
    id: bytedanceId,
    type: SEEDANCE_BYTEDANCE_25_CLASS,
    pos: [GEN_X, 40],
    size: [440, 500],
    flags: {},
    order: bytedanceId,
    mode: 0,
    inputs: buildByteDance25InputsSkeleton(),
    outputs: [{ localized_name: 'VIDEO', name: 'VIDEO', type: 'VIDEO', links: null }],
    title: 'ByteDance Seedance 2.5 Reference to Video',
    properties: { 'Node name for S&R': SEEDANCE_BYTEDANCE_25_CLASS },
    widgets_values: [
      'Seedance 2.5',
      '', // prompt — PROMPT COMPOSER link
      clampByteDanceResolution(params.resolution),
      String(params.ratio || '16:9'),
      clampByteDanceDuration(params.duration),
      Boolean(params.generate_audio !== false),
      'auto',
      'mp4',
      true, // auto_downscale
      false, // auto_upscale
      Number.isFinite(Number(params.seed)) && Number(params.seed) >= 0 ? Number(params.seed) : 0,
      'fixed',
      Boolean(params.watermark)
    ],
    color: '#432',
    bgcolor: '#653'
  };

  // Fan-out each ref IMAGE → Pedditi image_N + ByteDance image_N
  imageOuterNodes.forEach(({ nodeId, slot }) => {
    const imgNode = nodes.find((n) => n.id === nodeId);
    const outLinks = [];

    const pedditiSlot = PEDDITI_INPUT_IMAGE_BASE + (slot - 1);
    const pedditiLink = linkId++;
    links.push([pedditiLink, nodeId, 0, pedditiId, pedditiSlot, 'IMAGE']);
    outLinks.push(pedditiLink);
    if (pedditiNode.inputs[pedditiSlot]) pedditiNode.inputs[pedditiSlot].link = pedditiLink;

    const bdSlot = BYTEDANCE_INPUT_IMAGE_BASE + (slot - 1);
    const bdLink = linkId++;
    links.push([bdLink, nodeId, 0, bytedanceId, bdSlot, 'IMAGE']);
    outLinks.push(bdLink);
    if (bytedanceNode.inputs[bdSlot]) bytedanceNode.inputs[bdSlot].link = bdLink;

    if (imgNode?.outputs?.[0]) imgNode.outputs[0].links = outLinks;
  });

  // PROMPT COMPOSER → both prompt inputs
  const promptLinks = [];
  const pedditiPromptLink = linkId++;
  links.push([pedditiPromptLink, promptNodeId, 0, pedditiId, PEDDITI_INPUT_PROMPT, 'STRING']);
  promptLinks.push(pedditiPromptLink);
  if (pedditiNode.inputs[PEDDITI_INPUT_PROMPT]) {
    pedditiNode.inputs[PEDDITI_INPUT_PROMPT].link = pedditiPromptLink;
  }

  const bdPromptLink = linkId++;
  links.push([bdPromptLink, promptNodeId, 0, bytedanceId, BYTEDANCE_INPUT_PROMPT, 'STRING']);
  promptLinks.push(bdPromptLink);
  if (bytedanceNode.inputs[BYTEDANCE_INPUT_PROMPT]) {
    bytedanceNode.inputs[BYTEDANCE_INPUT_PROMPT].link = bdPromptLink;
  }
  promptNode.outputs[0].links = promptLinks;

  // 000 → Pedditi + ByteDance video_1
  const videoOutLinks = [];
  const pedditiVideoLink = linkId++;
  links.push([pedditiVideoLink, videoNodeId, 0, pedditiId, PEDDITI_INPUT_VIDEO, 'VIDEO']);
  videoOutLinks.push(pedditiVideoLink);
  if (pedditiNode.inputs[PEDDITI_INPUT_VIDEO]) {
    pedditiNode.inputs[PEDDITI_INPUT_VIDEO].link = pedditiVideoLink;
  }
  const bdVideoLink = linkId++;
  links.push([bdVideoLink, videoNodeId, 0, bytedanceId, BYTEDANCE_INPUT_VIDEO, 'VIDEO']);
  videoOutLinks.push(bdVideoLink);
  if (bytedanceNode.inputs[BYTEDANCE_INPUT_VIDEO]) {
    bytedanceNode.inputs[BYTEDANCE_INPUT_VIDEO].link = bdVideoLink;
  }
  videoOuter.outputs[0].links = videoOutLinks;

  // Mute ByteDance when no image/video refs — reference node requires media
  const hasAnyImagePath = imageOuterNodes.some((n) => n.hasPath);
  if (!hasAnyImagePath && !hasVideoPath) {
    bytedanceNode.mode = 4;
  }

  nodes.push(bytedanceNode);
  nodes.push(pedditiNode);

  const prefix = buildComfySaveVideoPrefix({
    rendersVideo: assetRoots?.rendersVideo || params?.rendersVideo || '',
    projectId: normalized.projectId,
    sceneId: normalized.sceneId,
    shotId: normalized.shotId
  });
  // Keep legacy helper available for debug / manifests
  void saveVideoFilenamePrefix;

  const saveNode = {
    id: saveId,
    type: SEEDANCE_SAVE_VIDEO_CLASS,
    pos: [OUT_X, 620],
    size: [340, 200],
    flags: {},
    order: saveId,
    mode: 0,
    inputs: [
      { name: 'video', type: 'VIDEO', link: null },
      { name: 'filename_prefix', type: 'STRING', widget: { name: 'filename_prefix' }, link: null },
      { name: 'format', type: 'COMBO', widget: { name: 'format' }, link: null },
      { name: 'codec', type: 'COMBO', widget: { name: 'codec' }, link: null }
    ],
    outputs: [{ localized_name: 'video', name: 'video', type: 'VIDEO', links: [] }],
    title: 'Save Video (Clean Name)',
    properties: { 'Node name for S&R': SEEDANCE_SAVE_VIDEO_CLASS },
    // Absolute rendersVideo path when set (must sit under Comfy Output Directory)
    widgets_values: [prefix, 'auto', 'auto']
  };

  const playNode = {
    id: playId,
    type: SEEDANCE_PLAY_SOUND_CLASS,
    pos: [PLAY_X, 660],
    size: [280, 160],
    flags: {},
    order: playId,
    mode: 0,
    inputs: [
      { name: 'any', type: '*', link: null },
      { name: 'mode', type: 'COMBO', widget: { name: 'mode' }, link: null },
      { name: 'volume', type: 'FLOAT', widget: { name: 'volume' }, link: null },
      { name: 'file', type: 'STRING', widget: { name: 'file' }, link: null }
    ],
    outputs: [{ localized_name: '*', name: '*', type: '*', links: null }],
    title: 'PlaySound 🐍',
    properties: { 'Node name for S&R': SEEDANCE_PLAY_SOUND_CLASS },
    widgets_values: ['on empty queue', 1, 'notify.mp3']
  };

  const videoLink = linkId++;
  links.push([videoLink, pedditiId, 0, saveId, 0, 'VIDEO']);
  pedditiNode.outputs[0].links = [videoLink];
  saveNode.inputs[0].link = videoLink;

  const playLink = linkId++;
  links.push([playLink, saveId, 0, playId, 0, '*']);
  saveNode.outputs[0].links = [playLink];
  playNode.inputs[0].link = playLink;

  nodes.push(saveNode);
  nodes.push(playNode);

  const refGroupW = REF_GRID.cellW * 5 + 40;
  const refGroupH = REF_GRID.cellH * 2 + 80;
  const groups = [
    {
      title: `SWS — ${shotTitle}`,
      bounding: [20, 10, PLAY_X + 320 - 20, 1400],
      color: '#3f3a32',
      font_size: 24
    },
    { title: 'PROMPT COMPOSER', bounding: [30, 60, 450, 440], color: '#3d2f4f', font_size: 16 },
    { title: 'NEGATIVE PROMPT', bounding: [30, 470, 450, 200], color: '#4f2f3d', font_size: 16 },
    { title: 'SYSTEM INSTRUCTION', bounding: [30, 650, 450, 180], color: '#2f3d4f', font_size: 16 },
    {
      title: 'REFERENCE INPUTS',
      bounding: [REF_GRID.originX - 24, REF_GRID.originY - 48, refGroupW, refGroupH],
      color: '#2f3d4f',
      font_size: 16
    },
    {
      title: 'BYTEDANCE SEEDANCE 2.5',
      bounding: [GEN_X - 20, 20, 480, 540],
      color: '#4f3a2f',
      font_size: 16
    },
    {
      title: 'PEDDITI LABS SEEDANCE 2.0',
      bounding: [GEN_X - 20, 560, 480, 760],
      color: '#3a2f4f',
      font_size: 16
    },
    {
      title: 'OUTPUT',
      bounding: [OUT_X - 20, 580, PLAY_X + 300 - OUT_X + 40, 280],
      color: '#2f4f3a',
      font_size: 16
    }
  ];

  const workflow = {
    id: `sws_${SEEDANCE_MASTER_TEMPLATE_ID}_v${SEEDANCE_MASTER_TEMPLATE_VERSION}`,
    revision: 0,
    last_node_id: playId,
    last_link_id: linkId - 1,
    nodes,
    links,
    groups,
    config: {},
    extra: {
      sws: {
        ...MASTER_META,
        projectId: normalized.projectId,
        sceneId: normalized.sceneId,
        shotId: normalized.shotId,
        displayName: `${String(normalized.projectId || '').trim()} ${String(normalized.shotId || '').trim()}`.trim(),
        promptSource: String(promptSource || ''),
        negativePrompt: negativeText,
        systemInstruction: systemText,
        generatedAt: new Date().toISOString()
      }
    },
    definitions: { subgraphs },
    version: 0.4
  };

  return { workflow, meta: MASTER_META, linkCount: links.length, nodeCount: nodes.length };
}

export function validateSeedanceMasterWorkflow(workflow) {
  const errors = [];
  if (!workflow || typeof workflow !== 'object') {
    return { ok: false, errors: ['Workflow is empty'] };
  }
  if (!Array.isArray(workflow.nodes) || workflow.nodes.length === 0) {
    return { ok: false, errors: ['Workflow has no nodes'] };
  }
  const types = new Set(workflow.nodes.map((n) => n.type));
  for (const req of [
    SEEDANCE_MASTER_NODE_CLASS,
    SEEDANCE_BYTEDANCE_25_CLASS,
    SEEDANCE_SAVE_VIDEO_CLASS,
    SEEDANCE_PLAY_SOUND_CLASS,
    SEEDANCE_TEXT_CLASS
  ]) {
    if (!types.has(req)) errors.push(`Missing required node type: ${req}`);
  }
  const subgraphs = workflow.definitions?.subgraphs;
  if (!Array.isArray(subgraphs) || subgraphs.length < 10) {
    errors.push('Expected 10 ref subgraphs (001–009 images + 000 video)');
  }

  const pedditi = workflow.nodes.find((n) => n.type === SEEDANCE_MASTER_NODE_CLASS);
  const bytedance = workflow.nodes.find((n) => n.type === SEEDANCE_BYTEDANCE_25_CLASS);
  const saveNode = workflow.nodes.find((n) => n.type === SEEDANCE_SAVE_VIDEO_CLASS);
  const playNode = workflow.nodes.find((n) => n.type === SEEDANCE_PLAY_SOUND_CLASS);
  const promptComposer = workflow.nodes.find(
    (n) => n.type === SEEDANCE_TEXT_CLASS && n.title === 'PROMPT COMPOSER'
  );
  const negativeComposer = workflow.nodes.find(
    (n) => n.type === SEEDANCE_TEXT_CLASS && n.title === 'NEGATIVE PROMPT'
  );
  const promptText = String(promptComposer?.widgets_values?.[0] || '').trim();
  const negativeText = String(negativeComposer?.widgets_values?.[0] || '').trim();
  if (!promptComposer) errors.push('Missing PROMPT COMPOSER text widget');
  if (!negativeComposer) errors.push('Missing NEGATIVE PROMPT text widget');
  if (!promptText) errors.push('Prompt Composer produced an empty prompt');
  if (negativeText && promptText.includes(negativeText)) {
    errors.push('NEGATIVE PROMPT was concatenated into the prompt widget');
  }
  if (workflow.extra?.sws && negativeText !== String(workflow.extra.sws.negativePrompt || '').trim()) {
    errors.push('NEGATIVE PROMPT widget does not match extra.sws.negativePrompt');
  }
  const systemComposer = workflow.nodes.find(
    (n) => n.type === SEEDANCE_TEXT_CLASS && n.title === 'SYSTEM INSTRUCTION'
  );
  const systemText = String(systemComposer?.widgets_values?.[0] || '').trim();
  if (!systemComposer) errors.push('Missing SYSTEM INSTRUCTION text widget');
  if (systemText && promptText.includes(systemText)) {
    errors.push('SYSTEM INSTRUCTION was concatenated into the prompt widget');
  }
  if (systemText && negativeText.includes(systemText)) {
    errors.push('SYSTEM INSTRUCTION was concatenated into the negative widget');
  }
  if (workflow.extra?.sws && systemText !== String(workflow.extra.sws.systemInstruction || '').trim()) {
    errors.push('SYSTEM INSTRUCTION widget does not match extra.sws.systemInstruction');
  }

  const linkList = workflow.links || [];
  if (!Array.isArray(linkList) || linkList.length === 0) {
    errors.push('Workflow has no links — would open empty/disconnected');
  } else if (pedditi && bytedance && promptComposer && saveNode && playNode) {
    const promptToPedditi = linkList.some(
      (L) =>
        Array.isArray(L) &&
        L[1] === promptComposer.id &&
        L[3] === pedditi.id &&
        L[4] === PEDDITI_INPUT_PROMPT
    );
    const promptToBd = linkList.some(
      (L) =>
        Array.isArray(L) &&
        L[1] === promptComposer.id &&
        L[3] === bytedance.id &&
        L[4] === BYTEDANCE_INPUT_PROMPT
    );
    if (!promptToPedditi) errors.push('PROMPT COMPOSER is not linked to Pedditi Labs prompt');
    if (!promptToBd) errors.push('PROMPT COMPOSER is not linked to ByteDance 2.5 prompt');

    let pedditiImgs = 0;
    let bdImgs = 0;
    for (let slot = 0; slot < 9; slot += 1) {
      if (linkList.some((L) => Array.isArray(L) && L[3] === pedditi.id && L[4] === PEDDITI_INPUT_IMAGE_BASE + slot)) {
        pedditiImgs += 1;
      }
      if (linkList.some((L) => Array.isArray(L) && L[3] === bytedance.id && L[4] === BYTEDANCE_INPUT_IMAGE_BASE + slot)) {
        bdImgs += 1;
      }
    }
    if (pedditiImgs < 9) errors.push(`Expected 9 Pedditi image links, found ${pedditiImgs}`);
    if (bdImgs < 9) errors.push(`Expected 9 ByteDance image links, found ${bdImgs}`);

    const saveWired = linkList.some(
      (L) => Array.isArray(L) && L[1] === pedditi.id && L[3] === saveNode.id
    );
    const playWired = linkList.some(
      (L) => Array.isArray(L) && L[1] === saveNode.id && L[3] === playNode.id
    );
    if (!saveWired) errors.push('Pedditi VIDEO is not linked to Save Video (Clean Name)');
    if (!playWired) errors.push('Save Video is not linked to PlaySound');
  }

  return { ok: errors.length === 0, errors };
}

export function seedanceMasterManifest({ normalized, params, references, validation, comfyuiVersion } = {}) {
  return {
    template_id: SEEDANCE_MASTER_TEMPLATE_ID,
    template_version: SEEDANCE_MASTER_TEMPLATE_VERSION,
    family: 'seedance_native',
    project_id: normalized?.projectId,
    scene_id: normalized?.sceneId,
    shot_id: normalized?.shotId,
    model: params?.model,
    duration: params?.duration,
    resolution: params?.resolution,
    ratio: params?.ratio,
    reference_slots_assigned: references?.assigned ?? 0,
    required_custom_nodes: [...SEEDANCE_MASTER_REQUIRED_NODES],
    comfyui_version: comfyuiVersion || 'unknown',
    validation: validation || null,
    created_at: new Date().toISOString()
  };
}
