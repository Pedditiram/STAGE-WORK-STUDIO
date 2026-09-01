/**
 * Versioned SWS workflow template registry (PDF §3, §11–12).
 * Templates are graphs of ComfyUI-SWS nodes only.
 */

export const SWS_COMFY_NODE_CLASSES = Object.freeze({
  CONTEXT: 'SWS Shot Context',
  CHARACTER: 'SWS Character Context',
  LOCATION: 'SWS Location Context',
  CAMERA: 'SWS Camera Context',
  LIGHTING: 'SWS Lighting Context',
  PROMPT: 'SWS Prompt',
  REFERENCE: 'SWS Reference Loader',
  PROVIDER_VIDEO: 'SWS Video Provider',
  PROVIDER_IMAGE: 'SWS Image Provider',
  OUTPUT: 'SWS Output',
  METADATA: 'SWS Metadata'
});

/** PDF §13 stable node IDs (+ 160 for Reference Loader, omitted in the printed table). */
export const SWS_NODE_IDS = Object.freeze({
  CONTEXT: '100',
  CHARACTER: '110',
  LOCATION: '120',
  CAMERA: '130',
  LIGHTING: '140',
  PROMPT: '150',
  REFERENCE: '160',
  METADATA: '170',
  PROVIDER: '200',
  OUTPUT: '300'
});

export const SWS_WORKFLOW_TEMPLATES = Object.freeze({
  image_text_to_image: {
    id: 'image_text_to_image',
    family: 'image',
    label: 'Text → Image',
    templateVersion: '1.0.0',
    needsReference: false,
    needsFirstFrame: false,
    needsLastFrame: false,
    needsSourceVideo: false
  },
  image_reference_to_image: {
    id: 'image_reference_to_image',
    family: 'image',
    label: 'Reference → Image',
    templateVersion: '1.0.0',
    needsReference: true
  },
  image_character_consistency: {
    id: 'image_character_consistency',
    family: 'image',
    label: 'Character reference → Image',
    templateVersion: '1.0.0',
    needsReference: true
  },
  image_environment: {
    id: 'image_environment',
    family: 'image',
    label: 'Environment → Image',
    templateVersion: '1.0.0',
    needsReference: true
  },
  image_keyframe: {
    id: 'image_keyframe',
    family: 'image',
    label: 'SWS keyframe → Image',
    templateVersion: '1.0.0',
    needsFirstFrame: true
  },
  video_seedance2_master: {
    id: 'video_seedance2_master',
    family: 'video',
    label: 'Matrix → Seedance 2.0 master',
    templateVersion: '1.0.0',
    adapter: 'seedance_native',
    needsReference: false,
    needsFirstFrame: false,
    needsLastFrame: false,
    needsSourceVideo: false
  },
  video_text_to_video: {
    id: 'video_text_to_video',
    family: 'video',
    label: 'Text → Video',
    templateVersion: '1.0.0'
  },
  video_image_to_video: {
    id: 'video_image_to_video',
    family: 'video',
    label: 'Image → Video',
    templateVersion: '1.0.0',
    needsFirstFrame: true
  },
  video_reference_to_video: {
    id: 'video_reference_to_video',
    family: 'video',
    label: 'Reference → Video',
    templateVersion: '1.0.0',
    needsReference: true
  },
  video_first_last_frame: {
    id: 'video_first_last_frame',
    family: 'video',
    label: 'First + last frame → Video',
    templateVersion: '1.0.0',
    needsFirstFrame: true,
    needsLastFrame: true
  },
  video_shot_continuation: {
    id: 'video_shot_continuation',
    family: 'video',
    label: 'Shot continuation → Video',
    templateVersion: '1.0.0',
    needsSourceVideo: true
  },
  video_upscale: {
    id: 'video_upscale',
    family: 'video',
    label: 'Video upscale',
    templateVersion: '1.0.0',
    needsSourceVideo: true
  }
});

export function listWorkflowTemplates(family) {
  return Object.values(SWS_WORKFLOW_TEMPLATES).filter((t) => !family || t.family === family);
}

export function isVideoTemplate(id) {
  return SWS_WORKFLOW_TEMPLATES[id]?.family === 'video';
}

export function isImageTemplate(id) {
  return SWS_WORKFLOW_TEMPLATES[id]?.family === 'image';
}

export function requiredCustomNodes() {
  return [
    SWS_COMFY_NODE_CLASSES.CONTEXT,
    SWS_COMFY_NODE_CLASSES.CHARACTER,
    SWS_COMFY_NODE_CLASSES.LOCATION,
    SWS_COMFY_NODE_CLASSES.CAMERA,
    SWS_COMFY_NODE_CLASSES.LIGHTING,
    SWS_COMFY_NODE_CLASSES.PROMPT,
    SWS_COMFY_NODE_CLASSES.REFERENCE,
    SWS_COMFY_NODE_CLASSES.PROVIDER_VIDEO,
    SWS_COMFY_NODE_CLASSES.PROVIDER_IMAGE,
    SWS_COMFY_NODE_CLASSES.OUTPUT,
    SWS_COMFY_NODE_CLASSES.METADATA
  ];
}
