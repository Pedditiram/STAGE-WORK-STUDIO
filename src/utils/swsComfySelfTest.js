/**
 * In-app pipeline checks: contract → Comfy JSON → validation (success + failure).
 */

import { SWS_PROVIDERS } from './swsComfyConstants';
import { SWS_NODE_IDS, SWS_COMFY_NODE_CLASSES } from './swsComfyTemplates';
import { buildSwsWorkflowContract } from './swsWorkflowContract';
import { buildComfyPromptGraph, stripSecretsFromWorkflow } from './swsComfyJson';
import { apiPromptToFrontendWorkflow, isComfyApiPrompt, isComfyFrontendWorkflow, validateComfyFrontendWorkflow } from './swsComfyFrontend';
import { validateAgainstInstalledNodes, validateSwsWorkflow } from './swsWorkflowValidator';
import { buildClapboard, clapboardResolveCsv, clapboardResolveEdl } from './shotClapboard';

function ramayanaShot() {
  return {
    sceneShotId: 'SC24_SH07',
    characterMovement: 'slow tracking with Rama',
    lensAndFocalLength: '35mm',
    timeAndLightingEnv: 'golden hour',
    shotDurationAndImages: '5s',
    actionEnvContext: 'Panchavati forest',
    shotComposition: 'medium wide',
    cameraMotionTag: '[slow tracking]'
  };
}

function goodContract(extra = {}) {
  return buildSwsWorkflowContract({
    shot: ramayanaShot(),
    shotIndex: 6,
    projectTitle: 'Ramayana',
    workflowType: 'video_text_to_video',
    provider: SWS_PROVIDERS.BYTEPLUS,
    duration: 5,
    width: 1920,
    height: 1080,
    fps: 24,
    seed: 24,
    promptOverride:
      'Rama walks through Panchavati at golden hour. Slow tracking shot, 35mm, 5 seconds, cinematic.',
    ...extra
  });
}

export function runSwsComfySelfTests() {
  const checks = [];
  const fail = (name, message) => checks.push({ name, ok: false, message });
  const pass = (name) => checks.push({ name, ok: true });

  const contract = goodContract();
  const prompt = buildComfyPromptGraph(contract);
  const ok = validateSwsWorkflow({ contract, prompt });
  if (ok.ok && prompt[SWS_NODE_IDS.CONTEXT]?.class_type === SWS_COMFY_NODE_CLASSES.CONTEXT) pass('happy_path');
  else fail('happy_path', ok.errors?.map((e) => e.message).join('; ') || 'graph invalid');

  if (contract.shotId.includes('SC24') && contract.shotId.includes('SH07')) pass('shot_id');
  else fail('shot_id', `Unexpected shot id ${contract.shotId}`);

  const emptyPrompt = validateSwsWorkflow({
    contract: { ...contract, prompt: '' },
    prompt
  });
  if (!emptyPrompt.ok && emptyPrompt.errors.some((e) => e.code === 'missing_prompt')) pass('empty_prompt');
  else fail('empty_prompt', 'Empty prompt should fail validation.');

  const missing = { ...prompt };
  delete missing[SWS_NODE_IDS.PROMPT];
  const missingRes = validateSwsWorkflow({ contract, prompt: missing });
  if (!missingRes.ok && missingRes.errors.some((e) => e.code === 'missing_node_id' || e.code === 'missing_class')) {
    pass('missing_node');
  } else fail('missing_node', 'Missing Prompt node should fail.');

  const unknown = {
    ...prompt,
    '999': { class_type: 'KSampler', inputs: {} }
  };
  const unknownRes = validateSwsWorkflow({ contract, prompt: unknown });
  if (!unknownRes.ok && unknownRes.errors.some((e) => e.code === 'unknown_class')) pass('unknown_class');
  else fail('unknown_class', 'Invented KSampler should be rejected.');

  const secretGraph = {
    ...prompt,
    [SWS_NODE_IDS.PROMPT]: {
      ...prompt[SWS_NODE_IDS.PROMPT],
      inputs: { ...prompt[SWS_NODE_IDS.PROMPT].inputs, api_key: 'sk-test' }
    }
  };
  const stripped = stripSecretsFromWorkflow(secretGraph);
  if (!stripped[SWS_NODE_IDS.PROMPT].inputs.api_key) pass('strip_secrets');
  else fail('strip_secrets', 'api_key should be stripped.');
  const secretRes = validateSwsWorkflow({ contract, prompt: secretGraph });
  if (!secretRes.ok && secretRes.errors.some((e) => e.code === 'secret_in_json')) pass('secret_rejected');
  else fail('secret_rejected', 'Secrets in JSON should fail validation.');

  const split = goodContract({
    promptOverride: 'Rama walks through Panchavati at golden hour. Slow tracking shot.',
    negativePrompt: 'cartoon, watermark, subtitles'
  });
  const splitGraph = buildComfyPromptGraph(split);
  const splitPromptNode = splitGraph[SWS_NODE_IDS.PROMPT]?.inputs || {};
  if (
    split.inputs.prompt === split.inputs.negativePrompt ||
    String(split.inputs.prompt || '').includes('cartoon, watermark') ||
    split.inputs.negativePrompt !== 'cartoon, watermark, subtitles' ||
    splitPromptNode.prompt !== split.inputs.prompt ||
    splitPromptNode.negative_prompt !== split.inputs.negativePrompt ||
    split.promptSource !== 'override'
  ) {
    fail('prompt_negative_split', 'Prompt and negativePrompt must stay separate into SWS Prompt widgets.');
  } else pass('prompt_negative_split');

  const sysLine = 'Keep continuity with prior Panchavati dusk lighting.';
  const withSys = goodContract({
    promptOverride: 'Rama walks through Panchavati at golden hour.',
    negativePrompt: 'cartoon, watermark, subtitles',
    systemInstruction: sysLine
  });
  const sysGraph = buildComfyPromptGraph(withSys);
  const sysInputs = sysGraph[SWS_NODE_IDS.PROMPT]?.inputs || {};
  if (
    withSys.systemInstruction !== sysLine ||
    withSys.inputs.systemInstruction !== sysLine ||
    String(withSys.prompt || '').includes(sysLine) ||
    String(withSys.negativePrompt || '').includes(sysLine) ||
    sysInputs.system_instruction !== sysLine ||
    String(sysInputs.prompt || '').includes(sysLine)
  ) {
    fail('system_instruction_split', 'systemInstruction must stay a third field.');
  } else pass('system_instruction_split');
  const foldedSys = validateSwsWorkflow({
    contract: { ...withSys, prompt: `${withSys.prompt} ${sysLine}` },
    prompt: sysGraph
  });
  if (!foldedSys.ok && foldedSys.errors.some((e) => e.code === 'system_folded_into_prompt')) pass('system_folded_rejected');
  else fail('system_folded_rejected', 'Folding systemInstruction into prompt should fail validation.');

  const reserved = validateSwsWorkflow({
    contract: { ...contract, provider: 'fal.ai' },
    prompt
  });
  if (!reserved.ok && reserved.errors.some((e) => e.code === 'provider_not_implemented')) pass('reserved_provider');
  else fail('reserved_provider', 'Unimplemented provider should fail.');

  const upscale = buildSwsWorkflowContract({
    shot: ramayanaShot(),
    shotIndex: 6,
    projectTitle: 'Ramayana',
    workflowType: 'video_upscale',
    duration: 5,
    promptOverride: 'Upscale the Panchavati tracking shot.'
  });
  const upscaleRes = validateSwsWorkflow({ contract: upscale, prompt: buildComfyPromptGraph(upscale) });
  if (!upscaleRes.ok && upscaleRes.errors.some((e) => e.code === 'missing_source_video')) pass('upscale_needs_source');
  else fail('upscale_needs_source', 'video_upscale without source should fail.');

  const installed = validateAgainstInstalledNodes(prompt, {});
  if (!installed.ok && installed.missing.length) pass('missing_custom_nodes');
  else fail('missing_custom_nodes', 'Empty object_info should report missing ComfyUI-SWS nodes.');

  if (isComfyApiPrompt(prompt) && !isComfyFrontendWorkflow(prompt)) pass('api_distinct_from_frontend');
  else fail('api_distinct_from_frontend', 'API prompt JSON must not be treated as a canvas workflow.');

  const rejectedApi = validateComfyFrontendWorkflow(prompt);
  if (!rejectedApi.ok && rejectedApi.errors.some((e) => e.code === 'api_format_not_frontend')) pass('reject_api_on_canvas');
  else fail('reject_api_on_canvas', 'API JSON should be rejected before opening the editor.');

  const frontend = apiPromptToFrontendWorkflow(prompt);
  const frontOk = validateComfyFrontendWorkflow(frontend);
  if (
    frontOk.ok &&
    frontend.nodes.length >= 10 &&
    frontend.links.length >= 8 &&
    frontend.nodes.every((n) => Array.isArray(n.pos) && Array.isArray(n.size))
  ) {
    pass('frontend_full_graph');
  } else fail('frontend_full_graph', frontOk.errors?.map((e) => e.message).join('; ') || 'frontend conversion failed');

  const simpleApi = {
    1: {
      class_type: SWS_COMFY_NODE_CLASSES.PROMPT,
      inputs: { prompt: 'simple test', negative_prompt: '', system_instruction: '' },
      _meta: { title: 'SWS Prompt' }
    },
    2: {
      class_type: SWS_COMFY_NODE_CLASSES.PROVIDER_VIDEO,
      inputs: {
        prompt: ['1', 0],
        negative_prompt: ['1', 1],
        provider: 'byteplus',
        model: 'seedance-1-0-pro-250528',
        duration: 5,
        width: 1920,
        height: 1080,
        fps: 24,
        seed: 1,
        workflow_type: 'video_text_to_video'
      },
      _meta: { title: 'SWS Video Provider' }
    },
    3: {
      class_type: SWS_COMFY_NODE_CLASSES.OUTPUT,
      inputs: { provider_result: ['2', 0], shot_id: 'SC01_SH01' },
      _meta: { title: 'SWS Output' }
    }
  };
  const simpleFront = apiPromptToFrontendWorkflow(simpleApi);
  const simpleOk = validateComfyFrontendWorkflow(simpleFront);
  if (simpleOk.ok && simpleFront.nodes.length === 3 && simpleFront.links.length >= 2) pass('frontend_simple_graph');
  else fail('frontend_simple_graph', simpleOk.errors?.map((e) => e.message).join('; ') || 'simple conversion failed');

  const clap = buildClapboard({
    shot: ramayanaShot(),
    projectTitle: 'MVK',
    shotIndex: 6,
    durationSec: 6
  });
  if (clap.label === 'Shot SC24, SH07 · 6s · MVK' && clap.videoFilename === 'MVK_SC24_SH07_6s.mp4') {
    pass('clapboard_label');
  } else {
    fail('clapboard_label', `got ${clap.label} / ${clap.videoFilename}`);
  }
  const csv = clapboardResolveCsv([{ clap, fps: 24 }]);
  const edl = clapboardResolveEdl([{ clap }], { title: 'MVK' });
  if (csv.includes('Clip Name') && csv.includes(clap.fileStem) && edl.includes('TITLE:') && edl.includes(clap.videoFilename)) {
    pass('resolve_pack_csv_edl');
  } else {
    fail('resolve_pack_csv_edl', 'CSV/EDL missing expected clapboard fields');
  }

  const failed = checks.filter((c) => !c.ok);
  return {
    ok: failed.length === 0,
    passed: checks.filter((c) => c.ok).length,
    total: checks.length,
    failed,
    message: failed.length ? failed.map((c) => `${c.name}: ${c.message}`).join('\n') : 'ok'
  };
}
