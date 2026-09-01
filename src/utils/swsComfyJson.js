/**
 * Deterministic ComfyUI API-format JSON from an SWS contract (PDF §13–16).
 * Only ComfyUI-SWS class_types. No secrets in JSON.
 */

import {
  SWS_COMFY_PACKAGE_NAME,
  SWS_COMFY_PACKAGE_VERSION,
  SWS_APP_VERSION,
  SWS_WORKFLOW_CONTRACT_VERSION,
  slugWorkflowPart
} from './swsComfyConstants';
import { SWS_COMFY_NODE_CLASSES, SWS_NODE_IDS, SWS_WORKFLOW_TEMPLATES, isVideoTemplate } from './swsComfyTemplates';
import { apiPromptToFrontendWorkflow } from './swsComfyFrontend';
import { buildClapboard } from './shotClapboard';

const SECRET_KEYS = /api[_-]?key|secret|token|password|credential|authorization/i;

function node(classType, inputs, meta) {
  return {
    class_type: classType,
    inputs: { ...inputs },
    _meta: { title: meta }
  };
}

function link(id, slot = 0) {
  return [String(id), slot];
}

function jsonSafe(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function buildWorkflowId(contract) {
  const p = slugWorkflowPart(contract.projectId, 'project');
  const s = slugWorkflowPart(contract.shotId, 'shot');
  const t = slugWorkflowPart(contract.workflowType, 'template');
  const v = slugWorkflowPart(contract.templateVersion, '1');
  return `sws_${p}_${s}_${t}_v${v}`;
}

/** ComfyUI tab title from Matrix shot — e.g. "MVK SC01_SH09" */
export function buildComfyWorkflowDisplayName(contract = {}) {
  const projectId = String(contract.projectId || '').trim();
  const shotId = String(contract.shotId || contract.shot?.shotId || '').trim();
  if (projectId && shotId) return `${projectId} ${shotId}`;
  if (shotId) return shotId;
  if (projectId) return projectId;
  return 'SWS Workflow';
}

export function stripSecretsFromWorkflow(promptGraph) {
  const next = {};
  Object.entries(promptGraph || {}).forEach(([id, n]) => {
    const inputs = { ...(n?.inputs || {}) };
    Object.keys(inputs).forEach((k) => {
      if (SECRET_KEYS.test(k) || SECRET_KEYS.test(String(inputs[k] || ''))) {
        delete inputs[k];
      }
    });
    next[id] = { ...n, inputs };
  });
  return next;
}

export function buildComfyPromptGraph(contract) {
  const c = contract || {};
  const shot = c.shot || {};
  const cam = c.camera || {};
  const light = c.lighting || {};
  const ch = (c.characters && c.characters[0]) || {};
  const loc = (c.locations && c.locations[0]) || {};
  const refs = Array.isArray(c.references) ? c.references : [];
  const first = refs.find((r) => r.kind === 'first_frame' || r.kind === 'keyframe') || refs[0] || {};
  const last = refs.find((r) => r.kind === 'last_frame') || {};
  const video = isVideoTemplate(c.workflowType);
  const params = c.providerParameters || c.inputs || {};
  const ids = SWS_NODE_IDS;
  const cls = SWS_COMFY_NODE_CLASSES;

  const graph = {
    [ids.CONTEXT]: node(
      cls.CONTEXT,
      {
        project_id: c.projectId || '',
        scene_id: c.sceneId || shot.sceneId || '',
        shot_id: c.shotId || shot.shotId || '',
        character: ch.characterName || (shot.characterIds || []).join(', '),
        location: loc.locationName || shot.locationId || '',
        action: shot.action || '',
        camera: cam.cameraMovement || shot.cameraMovement || (c.directorStage?.camera?.movement?.type || ''),
        lighting: light.lighting || shot.lighting || ''
      },
      'SWS Shot Context'
    ),
    [ids.CHARACTER]: node(
      cls.CHARACTER,
      {
        character_id: ch.characterId || '',
        character_name: ch.characterName || '',
        character_reference: ch.characterReference || first.assetUrl || first.localPath || '',
        character_description: ch.characterDescription || '',
        costume: ch.costume || '',
        appearance: ch.appearance || '',
        continuity_data: ch.continuityData || ''
      },
      'SWS Character Context'
    ),
    [ids.LOCATION]: node(
      cls.LOCATION,
      {
        location_id: loc.locationId || '',
        location_name: loc.locationName || '',
        description: loc.description || '',
        reference_images: jsonSafe(loc.referenceImages || []),
        continuity_data: loc.continuityData || ''
      },
      'SWS Location Context'
    ),
    [ids.CAMERA]: node(
      cls.CAMERA,
      {
        shot_type: cam.shotType || shot.shotType || '',
        camera_angle: cam.cameraAngle || shot.cameraAngle || '',
        lens: cam.lens || shot.lens || '',
        focal_length: cam.focalLength || shot.focalLength || '',
        camera_movement: cam.cameraMovement || shot.cameraMovement || '',
        framing: cam.framing || shot.framing || '',
        composition: cam.composition || shot.composition || ''
      },
      'SWS Camera Context'
    ),
    [ids.LIGHTING]: node(
      cls.LIGHTING,
      {
        lighting: light.lighting || shot.lighting || '',
        time_of_day: light.timeOfDay || shot.timeOfDay || '',
        weather: light.weather || shot.weather || '',
        color_temperature: light.colorTemperature || '',
        contrast: light.contrast || ''
      },
      'SWS Lighting Context'
    ),
    [ids.PROMPT]: node(
      cls.PROMPT,
      {
        prompt: c.prompt || c.inputs?.prompt || '',
        negative_prompt: c.negativePrompt || c.inputs?.negativePrompt || '',
        system_instruction: c.systemInstruction || ''
      },
      'SWS Prompt'
    ),
    [ids.REFERENCE]: node(
      cls.REFERENCE,
      {
        asset_id: first.assetId || '',
        asset_url: first.assetUrl || '',
        local_path: first.localPath || '',
        last_frame_url: last.assetUrl || last.localPath || ''
      },
      'SWS Reference Loader'
    ),
    [ids.PROVIDER]: node(
      video ? cls.PROVIDER_VIDEO : cls.PROVIDER_IMAGE,
      {
        shot_context: link(ids.CONTEXT, 0),
        prompt: link(ids.PROMPT, 0),
        negative_prompt: link(ids.PROMPT, 1),
        character_context: link(ids.CHARACTER, 0),
        location_context: link(ids.LOCATION, 0),
        camera_context: link(ids.CAMERA, 0),
        lighting_context: link(ids.LIGHTING, 0),
        reference: link(ids.REFERENCE, 0),
        provider: c.provider || 'byteplus',
        provider_account_id: '',
        model: c.model || '',
        duration: Number(params.duration) || 5,
        width: Number(params.width) || 1920,
        height: Number(params.height) || 1080,
        fps: Number(params.fps) || 24,
        seed: Number(params.seed) || -1,
        workflow_type: c.workflowType || ''
      },
      video ? 'SWS Video Provider' : 'SWS Image Provider'
    ),
    [ids.OUTPUT]: node(
      cls.OUTPUT,
      {
        provider_result: link(ids.PROVIDER, 0),
        shot_context: link(ids.CONTEXT, 0),
        project_id: c.projectId || '',
        scene_id: c.sceneId || '',
        shot_id: c.shotId || '',
        generation_id: '',
        workflow_id: buildWorkflowId(c),
        provider: c.provider || '',
        model: c.model || '',
        extra_json: jsonSafe({
          sws: {
            projectId: c.projectId,
            sceneId: c.sceneId,
            shotId: c.shotId,
            workflowVersion: SWS_WORKFLOW_CONTRACT_VERSION,
            template: c.workflowType,
            templateVersion: c.templateVersion,
            generatedBy: 'SWS',
            directorStage: c.directorStage || null
          }
        })
      },
      'SWS Output'
    ),
    [ids.METADATA]: node(
      cls.METADATA,
      {
        project_id: c.projectId || '',
        scene_id: c.sceneId || '',
        shot_id: c.shotId || '',
        workflow_id: buildWorkflowId(c),
        template_id: c.workflowType || '',
        template_version: c.templateVersion || '',
        sws_workflow_version: SWS_WORKFLOW_CONTRACT_VERSION,
        provider: c.provider || '',
        model: c.model || ''
      },
      'SWS Metadata'
    )
  };

  return stripSecretsFromWorkflow(graph);
}

export function buildWorkflowManifest(contract, { workflowId, validation } = {}) {
  const refs = Array.isArray(contract.references) ? contract.references : [];
  return {
    project_id: contract.projectId,
    scene_id: contract.sceneId,
    shot_id: contract.shotId,
    workflow_id: workflowId || buildWorkflowId(contract),
    template_id: contract.workflowType,
    template_version: contract.templateVersion || SWS_WORKFLOW_TEMPLATES[contract.workflowType]?.templateVersion,
    sws_version: SWS_APP_VERSION,
    sws_workflow_version: SWS_WORKFLOW_CONTRACT_VERSION,
    comfyui_version: 'unknown',
    custom_node_package: SWS_COMFY_PACKAGE_NAME,
    custom_node_version: SWS_COMFY_PACKAGE_VERSION,
    provider: contract.provider,
    model: contract.model,
    asset_dependencies: refs.map((r) => r.assetId).filter(Boolean),
    reference_dependencies: refs,
    required_custom_nodes: Object.values(SWS_COMFY_NODE_CLASSES),
    created_at: new Date().toISOString(),
    validation: validation || null
  };
}

export function buildComfyExportBundle(contract, { objectInfo } = {}) {
  const workflowId = buildWorkflowId(contract);
  const prompt = buildComfyPromptGraph(contract);
  const manifest = buildWorkflowManifest(contract, { workflowId });
  const clap = buildClapboard({
    shot: contract.shot || { sceneShotId: contract.shotId },
    projectTitle: contract.projectId,
    durationSec: contract.duration ?? contract.shot?.durationSec
  });
  const swsExtra = {
    projectId: contract.projectId || clap.projectId,
    sceneId: contract.sceneId || clap.sceneId,
    shotId: contract.shotId || clap.shotId,
    displayName: buildComfyWorkflowDisplayName(contract) || clap.displayName,
    clapboard: clap.label,
    fileStem: clap.fileStem,
    videoFilename: clap.videoFilename,
    durationSec: clap.durationSec,
    workflowVersion: SWS_WORKFLOW_CONTRACT_VERSION,
    template: contract.workflowType,
    generatedAt: manifest.created_at,
    generatedBy: 'SWS',
    workflowId
  };
  const frontend = apiPromptToFrontendWorkflow(prompt, { objectInfo, extra: { sws: swsExtra } });
  const workflowUi = frontend;
  return { workflowId, prompt, manifest, workflowUi, frontend, contract, clapboard: clap };
}

export function assembleValidatedWorkflow(contract, validateFn, { objectInfo } = {}) {
  const bundle = buildComfyExportBundle(contract, { objectInfo });
  const validation = typeof validateFn === 'function'
    ? validateFn({ contract, prompt: bundle.prompt })
    : { ok: true, errors: [], warnings: [] };
  bundle.manifest.validation = {
    ok: Boolean(validation.ok),
    errors: validation.errors || [],
    warnings: validation.warnings || []
  };
  return { ...bundle, validation };
}
