/**
 * Validate SWS contract + generated ComfyUI JSON before download or queue (PDF §17–18).
 */

import { SWS_WORKFLOW_TEMPLATES, SWS_COMFY_NODE_CLASSES, SWS_NODE_IDS, requiredCustomNodes } from './swsComfyTemplates';
import { isProviderImplemented } from './swsComfyConstants';

function fail(errors, code, message) {
  errors.push({ code, message });
}

function nodeByClass(prompt, classType) {
  return Object.entries(prompt || {}).find(([, n]) => n?.class_type === classType);
}

export function validateSwsWorkflow({ contract, prompt } = {}) {
  const errors = [];
  const warnings = [];
  const c = contract || {};
  const p = prompt || {};

  if (!c.swsWorkflowVersion) fail(errors, 'missing_version', 'SWS workflow version is missing.');
  if (!c.projectId) fail(errors, 'missing_project', 'Project id is required.');
  if (!c.shotId) fail(errors, 'missing_shot', 'Shot id is required.');
  const template = SWS_WORKFLOW_TEMPLATES[c.workflowType];
  if (!template) fail(errors, 'unknown_template', `Unknown template: ${c.workflowType || '(empty)'}`);
  if (!c.prompt || !String(c.prompt).trim()) fail(errors, 'missing_prompt', 'SWS prompt is empty. Compile or write a prompt first.');
  const sys = String(c.systemInstruction || c.inputs?.systemInstruction || '').trim();
  const promptText = String(c.prompt || '').trim();
  const negText = String(c.negativePrompt || c.inputs?.negativePrompt || '').trim();
  if (sys && sys.length >= 8 && promptText.includes(sys)) {
    fail(errors, 'system_folded_into_prompt', 'systemInstruction must stay a third field — do not fold it into prompt.');
  }
  if (sys && sys.length >= 8 && negText.includes(sys)) {
    fail(errors, 'system_folded_into_negative', 'systemInstruction must stay a third field — do not fold it into negativePrompt.');
  }
  if (!c.model) fail(errors, 'missing_model', 'Model is required.');
  if (!c.provider) fail(errors, 'missing_provider', 'Provider is required.');
  else if (!isProviderImplemented(c.provider)) {
    fail(
      errors,
      'provider_not_implemented',
      `Provider "${c.provider}" is reserved but not implemented. Use BytePlus or local ComfyUI.`
    );
  }

  const w = Number(c.providerParameters?.width || c.inputs?.width);
  const h = Number(c.providerParameters?.height || c.inputs?.height);
  const dur = Number(c.providerParameters?.duration || c.inputs?.duration);
  if (!w || !h) fail(errors, 'missing_resolution', 'Width and height are required.');
  if (template?.family === 'video' && (!dur || dur < 1)) fail(errors, 'missing_duration', 'Duration (seconds) is required for video.');

  const refs = Array.isArray(c.references) ? c.references : [];
  const hasKind = (k) => refs.some((r) => r.kind === k && (r.assetUrl || r.localPath));
  if (template?.needsReference && !refs.length) {
    fail(errors, 'missing_reference', `${template.label} needs a reference still.`);
  }
  if (template?.needsFirstFrame && !hasKind('first_frame') && !hasKind('keyframe') && !c.inputs?.referenceImage) {
    fail(errors, 'missing_first_frame', `${template.label} needs a first-frame / keyframe still.`);
  }
  if (template?.needsLastFrame && !hasKind('last_frame')) {
    fail(errors, 'missing_last_frame', `${template.label} needs a last-frame still.`);
  }
  if (template?.needsSourceVideo && !hasKind('source_video')) {
    fail(errors, 'missing_source_video', `${template.label} needs a source video asset.`);
  }

  const requiredIds = Object.values(SWS_NODE_IDS);
  const isSeedanceMaster = template?.adapter === 'seedance_native' || c.workflowType === 'video_seedance2_master';

  if (!isSeedanceMaster) {
    requiredIds.forEach((id) => {
      if (!p[id]) fail(errors, 'missing_node_id', `Required node id ${id} is missing from ComfyUI JSON.`);
    });

    const requiredClasses = [
      SWS_COMFY_NODE_CLASSES.CONTEXT,
      SWS_COMFY_NODE_CLASSES.PROMPT,
      template?.family === 'video' ? SWS_COMFY_NODE_CLASSES.PROVIDER_VIDEO : SWS_COMFY_NODE_CLASSES.PROVIDER_IMAGE,
      SWS_COMFY_NODE_CLASSES.OUTPUT
    ];
    requiredClasses.forEach((cls) => {
      if (!nodeByClass(p, cls)) fail(errors, 'missing_class', `Required node class "${cls}" is missing.`);
    });

    Object.entries(p).forEach(([id, n]) => {
      if (!n?.class_type) fail(errors, 'invalid_node', `Node ${id} has no class_type.`);
      const allowed = new Set(Object.values(SWS_COMFY_NODE_CLASSES));
      if (n?.class_type && !allowed.has(n.class_type)) {
        fail(errors, 'unknown_class', `Node ${id} uses unspecified class_type "${n.class_type}".`);
      }
      Object.values(n?.inputs || {}).forEach((val) => {
        if (Array.isArray(val) && val.length === 2) {
          const [src] = val;
          if (!p[String(src)]) fail(errors, 'broken_link', `Node ${id} links to missing node ${src}.`);
        }
      });
    });
  }

  const blob = JSON.stringify(p);
  if (/api[_-]?key|authorization\s*:/i.test(blob)) {
    fail(errors, 'secret_in_json', 'API keys must not appear in workflow JSON.');
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    requiredCustomNodes: requiredCustomNodes(),
    templateId: c.workflowType,
    provider: c.provider
  };
}

export function formatValidationMessage(result) {
  if (result?.ok) return 'Workflow is valid for ComfyUI-SWS import.';
  return (result?.errors || []).map((e) => e.message).join('\n');
}

/** Phase 2: compare generated class_types to ComfyUI /object_info. */
export function validateAgainstInstalledNodes(prompt, objectInfo) {
  const installed = new Set(Object.keys(objectInfo || {}));
  const missing = [];
  Object.values(prompt || {}).forEach((n) => {
    if (n?.class_type && !installed.has(n.class_type)) missing.push(n.class_type);
  });
  return {
    ok: missing.length === 0,
    missing: [...new Set(missing)],
    message:
      missing.length === 0
        ? ''
        : `ComfyUI is missing custom nodes: ${[...new Set(missing)].join(', ')}. Install ComfyUI-SWS. SWS will not download nodes for you.`
  };
}
