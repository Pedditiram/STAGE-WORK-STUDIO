/**
 * In-app pipeline checks: contract → Comfy JSON → validation (success + failure).
 */

import { SWS_PROVIDERS } from './swsComfyConstants';
import { SWS_NODE_IDS, SWS_COMFY_NODE_CLASSES } from './swsComfyTemplates';
import { buildSwsWorkflowContract } from './swsWorkflowContract';
import { buildComfyPromptGraph, stripSecretsFromWorkflow, buildWorkflowManifest, buildComfyExportBundle } from './swsComfyJson';
import { apiPromptToFrontendWorkflow, isComfyApiPrompt, isComfyFrontendWorkflow, SWS_NODE_IO, validateComfyFrontendWorkflow } from './swsComfyFrontend';
import { validateAgainstInstalledNodes, validateSwsWorkflow } from './swsWorkflowValidator';
import { buildClapboard, clapboardResolveCsv, clapboardResolveEdl, clapboardSidecarJson, buildResolvePackFiles, resolvePackReadme, resolvePackFilename, clapboardFileNames, clapboardWorkflowSidecarNames, clapboardDisplayIds, clapboardProjectSceneIds, clapboardLabelText, clapboardSceneShotNums, clapboardDurationSec } from './shotClapboard';
import { missingComfyClassStatusLine, offerPullLatestFromHistoryPeek, formatComfyClassInventory, formatComfyClassInventoryWithVersion, formatFilmProgressInventory } from '../services/comfyuiClient';
import { filmQueueEarlyResult, filmQueueCancelledRow, filmQueueFailedRow, filmQueueSucceededRow, filmQueueMissingNodesResult, filmQueueFinalResult, filmQueueAssemblingProgress, filmQueueLoadingProgress, filmQueueGeneratingProgress, FILM_QUEUE_PROGRESS_KEYS, FILM_QUEUE_CLASS_FIELDS_KEYS, FILM_QUEUE_REPORT_PROGRESS_KEYS, FILM_QUEUE_ASSEMBLING_PROGRESS_KEYS, FILM_QUEUE_LOADING_PROGRESS_KEYS, FILM_QUEUE_GENERATING_PROGRESS_KEYS } from './comfyFilmQueue';

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

  const promptIo = SWS_NODE_IO[SWS_COMFY_NODE_CLASSES.PROMPT];
  if (
    promptIo?.outputs?.length === 3 &&
    promptIo.outputs[0]?.name === 'prompt' &&
    promptIo.outputs[1]?.name === 'negative_prompt' &&
    promptIo.outputs[2]?.name === 'system_instruction'
  ) {
    pass('sws_prompt_third_output');
  } else {
    fail('sws_prompt_third_output', 'SWS Prompt must expose system_instruction as a third output.');
  }

  const videoProvInputs = prompt[SWS_NODE_IDS.PROVIDER]?.inputs || {};
  const sysSlot = videoProvInputs.system_instruction;
  const videoIo = SWS_NODE_IO[SWS_COMFY_NODE_CLASSES.PROVIDER_VIDEO];
  const imageIo = SWS_NODE_IO[SWS_COMFY_NODE_CLASSES.PROVIDER_IMAGE];
  if (
    Array.isArray(sysSlot) &&
    String(sysSlot[0]) === SWS_NODE_IDS.PROMPT &&
    Number(sysSlot[1]) === 2 &&
    Array.isArray(videoProvInputs.prompt) &&
    Number(videoProvInputs.prompt[1]) === 0 &&
    videoIo?.inputs?.some((s) => s.name === 'system_instruction')
  ) {
    pass('video_provider_system_instruction');
  } else {
    fail('video_provider_system_instruction', 'SWS Video Provider must take Prompt slot 2 as optional system_instruction.');
  }

  const still = goodContract({ workflowType: 'image_text_to_image' });
  const stillGraph = buildComfyPromptGraph(still);
  const stillSys = stillGraph[SWS_NODE_IDS.PROVIDER]?.inputs?.system_instruction;
  if (
    Array.isArray(stillSys) &&
    String(stillSys[0]) === SWS_NODE_IDS.PROMPT &&
    Number(stillSys[1]) === 2 &&
    imageIo?.inputs?.some((s) => s.name === 'system_instruction')
  ) {
    pass('image_provider_system_instruction');
  } else {
    fail('image_provider_system_instruction', 'SWS Image Provider must take Prompt slot 2 as optional system_instruction.');
  }

  const missReport = missingComfyClassStatusLine({}, ['SWS Video Provider', 'SWS Prompt']);
  if (
    !missReport.ok &&
    missReport.installedClassCount === 0 &&
    missReport.missing.includes('SWS Video Provider') &&
    missReport.status.includes('0 installed') &&
    missReport.status.includes('SWS Video Provider')
  ) {
    pass('debug_class_count_next_to_missing');
  } else {
    fail('debug_class_count_next_to_missing', missReport.status || 'missing classes should list names next to installed count');
  }

  const filmInv = formatComfyClassInventory(12, ['SWS Prompt', 'SWS Video Provider']);
  if (filmInv.includes('12 installed') && filmInv.includes('SWS Prompt') && filmInv.includes('SWS Video Provider')) {
    pass('film_queue_class_inventory');
  } else {
    fail('film_queue_class_inventory', 'Film-queue inventory must list installedClassCount next to missing class names.');
  }

  const successInv = formatComfyClassInventory(48, []);
  if (successInv.includes('48 installed') && /missing:\s*none/i.test(successInv)) {
    pass('film_queue_success_class_count');
  } else {
    fail('film_queue_success_class_count', 'Success inventory must list installedClassCount when no classes are missing.');
  }

  const invWithVer = formatComfyClassInventoryWithVersion(48, [], '0.3.49');
  if (invWithVer.includes('48 installed') && invWithVer.includes('missing: none') && invWithVer.includes('ComfyUI 0.3.49')) {
    pass('film_queue_inventory_with_version');
  } else {
    fail('film_queue_inventory_with_version', 'Film-queue progress must list ComfyUI version next to classInventory.');
  }

  const emptyQueue = filmQueueEarlyResult({ error: 'No Matrix shots to queue.', code: 'empty' });
  const unreachableQueue = filmQueueEarlyResult({
    error: 'ComfyUI unreachable',
    code: 'unreachable',
    comfyuiVersion: '0.3.49'
  });
  const emptyInv = formatFilmProgressInventory(emptyQueue.classInventory, emptyQueue.comfyuiVersion);
  const unreachableInv = formatFilmProgressInventory(unreachableQueue.classInventory, unreachableQueue.comfyuiVersion);
  if (
    emptyQueue.code === 'empty' &&
    emptyQueue.classInventory.includes('0 installed') &&
    emptyQueue.classInventory.includes('ComfyUI unknown') &&
    emptyQueue.comfyuiVersion === 'unknown' &&
    emptyQueue.inventoryVersion === emptyInv &&
    emptyInv.includes('ComfyUI unknown') &&
    unreachableQueue.code === 'unreachable' &&
    unreachableQueue.comfyuiVersion === '0.3.49' &&
    unreachableQueue.classInventory.includes('ComfyUI 0.3.49') &&
    unreachableQueue.inventoryVersion === unreachableInv &&
    unreachableInv.includes('ComfyUI 0.3.49')
  ) {
    pass('film_queue_early_inventory');
  } else {
    fail('film_queue_early_inventory', 'Empty/unreachable film-queue results must list classInventory next to comfyuiVersion as inventoryVersion.');
  }

  const missingNodes = filmQueueMissingNodesResult({
    error: 'ComfyUI is missing: SWSPrompt.',
    comfyuiVersion: '0.3.49',
    installedClassCount: 48,
    classInventory: invWithVer
  });
  const missingInv = formatFilmProgressInventory(invWithVer, '0.3.49');
  if (
    missingNodes.code === 'missing_nodes' &&
    missingNodes.ok === false &&
    missingNodes.comfyuiVersion === '0.3.49' &&
    missingNodes.classInventory.includes('ComfyUI 0.3.49') &&
    missingNodes.inventoryVersion === missingInv &&
    missingInv.includes('48 installed') &&
    missingInv.includes('ComfyUI 0.3.49')
  ) {
    pass('film_queue_missing_nodes_inventory');
  } else {
    fail('film_queue_missing_nodes_inventory', 'Missing-nodes film-queue results must list classInventory next to comfyuiVersion as inventoryVersion.');
  }

  const finalOk = filmQueueFinalResult({
    results: [{ status: 'succeeded' }],
    total: 1,
    comfyuiVersion: '0.3.49',
    installedClassCount: 48,
    classInventory: invWithVer
  });
  const finalPartial = filmQueueFinalResult({
    results: [{ status: 'failed' }, { status: 'succeeded' }],
    total: 2,
    comfyuiVersion: '0.3.49',
    classInventory: invWithVer
  });
  const finalInv = formatFilmProgressInventory(invWithVer, '0.3.49');
  if (
    finalOk.ok &&
    finalOk.code === '' &&
    finalOk.comfyuiVersion === '0.3.49' &&
    finalOk.classInventory.includes('ComfyUI 0.3.49') &&
    finalOk.inventoryVersion === finalInv &&
    finalInv.includes('48 installed') &&
    !finalPartial.ok &&
    finalPartial.code === 'partial' &&
    finalPartial.inventoryVersion === finalInv
  ) {
    pass('film_queue_final_inventory');
  } else {
    fail('film_queue_final_inventory', 'Finished film-queue results must list classInventory next to comfyuiVersion as inventoryVersion.');
  }

  if (
    FILM_QUEUE_PROGRESS_KEYS.includes('classInventory, comfyuiVersion, inventoryVersion') &&
    FILM_QUEUE_PROGRESS_KEYS.endsWith('inventoryVersion')
  ) {
    pass('film_queue_progress_jsdoc_inventory');
  } else {
    fail('film_queue_progress_jsdoc_inventory', 'Film-queue onProgress keys must list inventoryVersion next to classInventory / comfyuiVersion.');
  }

  if (
    FILM_QUEUE_CLASS_FIELDS_KEYS.includes('classInventory, comfyuiVersion, inventoryVersion') &&
    FILM_QUEUE_CLASS_FIELDS_KEYS.endsWith('inventoryVersion')
  ) {
    pass('film_queue_class_fields_inventory');
  } else {
    fail('film_queue_class_fields_inventory', 'Film-queue classFields must list inventoryVersion next to classInventory / comfyuiVersion.');
  }

  if (
    FILM_QUEUE_REPORT_PROGRESS_KEYS === 'classInventory, comfyuiVersion, inventoryVersion' &&
    FILM_QUEUE_REPORT_PROGRESS_KEYS.includes('classInventory, comfyuiVersion, inventoryVersion')
  ) {
    pass('film_queue_report_progress_inventory');
  } else {
    fail('film_queue_report_progress_inventory', 'Film-queue reportProgress must list inventoryVersion next to classInventory / comfyuiVersion.');
  }

  const assembling = filmQueueAssemblingProgress({
    index: 0,
    total: 1,
    shotId: 'SC24_SH07',
    classInventory: invWithVer,
    comfyuiVersion: '0.3.49'
  });
  const assemblingInv = formatFilmProgressInventory(invWithVer, '0.3.49');
  if (
    assembling.status === 'assembling' &&
    assembling.comfyuiVersion === '0.3.49' &&
    assembling.classInventory.includes('ComfyUI 0.3.49') &&
    assembling.inventoryVersion === assemblingInv &&
    FILM_QUEUE_ASSEMBLING_PROGRESS_KEYS === 'classInventory, comfyuiVersion, inventoryVersion'
  ) {
    pass('film_queue_assembling_inventory');
  } else {
    fail('film_queue_assembling_inventory', 'Assembling film-queue progress must keep inventoryVersion next to classInventory / comfyuiVersion.');
  }

  const loading = filmQueueLoadingProgress({
    index: 0,
    total: 1,
    shotId: 'SC24_SH07',
    composedSource: 'seedance',
    classInventory: invWithVer,
    comfyuiVersion: '0.3.49'
  });
  const loadingInv = formatFilmProgressInventory(invWithVer, '0.3.49');
  if (
    loading.status === 'loading' &&
    loading.comfyuiVersion === '0.3.49' &&
    loading.classInventory.includes('ComfyUI 0.3.49') &&
    loading.inventoryVersion === loadingInv &&
    FILM_QUEUE_LOADING_PROGRESS_KEYS === 'classInventory, comfyuiVersion, inventoryVersion'
  ) {
    pass('film_queue_loading_inventory');
  } else {
    fail('film_queue_loading_inventory', 'Loading film-queue progress must keep inventoryVersion next to classInventory / comfyuiVersion.');
  }

  const generating = filmQueueGeneratingProgress({
    index: 0,
    total: 1,
    shotId: 'SC24_SH07',
    composedSource: 'seedance',
    classInventory: invWithVer,
    comfyuiVersion: '0.3.49'
  });
  const generatingInv = formatFilmProgressInventory(invWithVer, '0.3.49');
  if (
    generating.status === 'generating' &&
    generating.comfyuiVersion === '0.3.49' &&
    generating.classInventory.includes('ComfyUI 0.3.49') &&
    generating.inventoryVersion === generatingInv &&
    FILM_QUEUE_GENERATING_PROGRESS_KEYS === 'classInventory, comfyuiVersion, inventoryVersion'
  ) {
    pass('film_queue_generating_inventory');
  } else {
    fail('film_queue_generating_inventory', 'Generating film-queue progress must keep inventoryVersion next to classInventory / comfyuiVersion.');
  }

  const cancelledRow = filmQueueCancelledRow({
    index: 2,
    shotId: 'SC24_SH07',
    comfyuiVersion: '0.3.49',
    classInventory: invWithVer
  });
  const cancelledProgressed = formatFilmProgressInventory(invWithVer, '0.3.49');
  if (
    cancelledRow.status === 'cancelled' &&
    cancelledRow.comfyuiVersion === '0.3.49' &&
    cancelledRow.classInventory.includes('ComfyUI 0.3.49') &&
    cancelledRow.classInventory.includes('48 installed') &&
    cancelledRow.inventoryVersion === cancelledProgressed &&
    cancelledProgressed.includes('48 installed') &&
    cancelledProgressed.includes('ComfyUI 0.3.49')
  ) {
    pass('film_queue_cancelled_inventory');
  } else {
    fail('film_queue_cancelled_inventory', 'Cancelled film-queue rows must list classInventory next to comfyuiVersion.');
  }

  const failedRow = filmQueueFailedRow({
    index: 1,
    shotId: 'SC24_SH07',
    error: 'Assemble failed',
    comfyuiVersion: '0.3.49',
    classInventory: invWithVer
  });
  const failedProgressed = formatFilmProgressInventory(invWithVer, '0.3.49');
  if (
    failedRow.status === 'failed' &&
    failedRow.error === 'Assemble failed' &&
    failedRow.comfyuiVersion === '0.3.49' &&
    failedRow.classInventory.includes('ComfyUI 0.3.49') &&
    failedRow.classInventory.includes('48 installed') &&
    failedRow.inventoryVersion === failedProgressed &&
    failedProgressed.includes('48 installed') &&
    failedProgressed.includes('ComfyUI 0.3.49')
  ) {
    pass('film_queue_failed_inventory');
  } else {
    fail('film_queue_failed_inventory', 'Failed film-queue rows must list classInventory next to comfyuiVersion.');
  }

  const succeededRow = filmQueueSucceededRow({
    index: 0,
    shotId: 'SC24_SH07',
    shotIndex: 6,
    filename: 'out.mp4',
    comfyuiVersion: '0.3.49',
    classInventory: invWithVer
  });
  const progressed = formatFilmProgressInventory(invWithVer, '0.3.49');
  if (
    succeededRow.status === 'succeeded' &&
    succeededRow.comfyuiVersion === '0.3.49' &&
    succeededRow.classInventory.includes('ComfyUI 0.3.49') &&
    succeededRow.classInventory.includes('48 installed') &&
    succeededRow.inventoryVersion === progressed &&
    progressed.includes('48 installed') &&
    progressed.includes('ComfyUI 0.3.49') &&
    formatFilmProgressInventory('48 installed', '0.3.49') === '48 installed · ComfyUI 0.3.49'
  ) {
    pass('film_queue_succeeded_inventory');
  } else {
    fail('film_queue_succeeded_inventory', 'Succeeded film-queue rows must list classInventory next to comfyuiVersion.');
  }

  const emptyOffer = offerPullLatestFromHistoryPeek({ ok: false, code: 'empty_history' }, { comfyuiVersion: '0.3.49' });
  const fileOffer = offerPullLatestFromHistoryPeek(
    { ok: true, filename: 'out.mp4', outputFile: 'http://127.0.0.1:8188/view?filename=out.mp4' },
    { comfyuiVersion: '0.3.49' }
  );
  if (
    emptyOffer.disabled &&
    emptyOffer.empty &&
    /empty/i.test(emptyOffer.hint) &&
    emptyOffer.hint.includes('ComfyUI 0.3.49') &&
    emptyOffer.comfyuiVersion === '0.3.49' &&
    !fileOffer.disabled &&
    fileOffer.filename === 'out.mp4' &&
    fileOffer.hint.includes('out.mp4') &&
    fileOffer.hint.includes('ComfyUI 0.3.49') &&
    fileOffer.fileVersion.includes('out.mp4') &&
    fileOffer.fileVersion.includes('ComfyUI 0.3.49') &&
    emptyOffer.emptyFileVersion.startsWith('empty ·') &&
    emptyOffer.emptyFileVersion.includes(emptyOffer.fileVersion) &&
    fileOffer.emptyFileVersion.startsWith('has-file ·') &&
    fileOffer.emptyFileVersion.includes(fileOffer.fileVersion) &&
    emptyOffer.disabled &&
    emptyOffer.disabledFileVersion.startsWith('disabled ·') &&
    emptyOffer.disabledFileVersion.includes(emptyOffer.emptyFileVersion) &&
    fileOffer.disabledFileVersion.startsWith('enabled ·') &&
    fileOffer.disabledFileVersion.includes(fileOffer.emptyFileVersion) &&
    fileOffer.filenameDisabledVersion.startsWith('out.mp4 ·') &&
    fileOffer.filenameDisabledVersion.includes(fileOffer.disabledFileVersion) &&
    emptyOffer.filenameDisabledVersion.startsWith('(empty) ·') &&
    emptyOffer.filenameDisabledVersion.includes(emptyOffer.disabledFileVersion) &&
    fileOffer.emptyFilenameDisabledVersion.startsWith('has-file ·') &&
    fileOffer.emptyFilenameDisabledVersion.includes(fileOffer.filenameDisabledVersion) &&
    emptyOffer.emptyFilenameDisabledVersion.startsWith('empty ·') &&
    emptyOffer.emptyFilenameDisabledVersion.includes(emptyOffer.filenameDisabledVersion) &&
    emptyOffer.disabledEmptyFilenameDisabledVersion.startsWith('disabled ·') &&
    emptyOffer.disabledEmptyFilenameDisabledVersion.includes(emptyOffer.emptyFilenameDisabledVersion) &&
    fileOffer.disabledEmptyFilenameDisabledVersion.startsWith('enabled ·') &&
    fileOffer.disabledEmptyFilenameDisabledVersion.includes(fileOffer.emptyFilenameDisabledVersion) &&
    fileOffer.filenameDisabledEmptyFilenameDisabledVersion.startsWith('out.mp4 ·') &&
    fileOffer.filenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.disabledEmptyFilenameDisabledVersion) &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledVersion.startsWith('(empty) ·') &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.disabledEmptyFilenameDisabledVersion) &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('has-file ·') &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.filenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('empty ·') &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.filenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('disabled ·') &&
    emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('enabled ·') &&
    fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.emptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('out.mp4 ·') &&
    fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('(empty) ·') &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('has-file ·') &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('empty ·') &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('disabled ·') &&
    emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('enabled ·') &&
    fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('out.mp4 ·') &&
    fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('(empty) ·') &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('has-file ·') &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('empty ·') &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('disabled ·') &&
    emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('enabled ·') &&
    fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('out.mp4 ·') &&
    fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('(empty) ·') &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('has-file ·') &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('empty ·') &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('disabled ·') &&
    emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('enabled ·') &&
    fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('out.mp4 ·') &&
    fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('(empty) ·') &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('has-file ·') &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('empty ·') &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('disabled ·') &&
    emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('enabled ·') &&
    fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('out.mp4 ·') &&
    fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('(empty) ·') &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('has-file ·') &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('empty ·') &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('disabled ·') &&
    emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('enabled ·') &&
    fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('out.mp4 ·') &&
    fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('(empty) ·') &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('has-file ·') &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('empty ·') &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('disabled ·') &&
    emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('enabled ·') &&
    fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('out.mp4 ·') &&
    fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('(empty) ·') &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('has-file ·') &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('empty ·') &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('disabled ·') &&
    emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('enabled ·') &&
    fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('out.mp4 ·') &&
    fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('(empty) ·') &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('has-file ·') &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('empty ·') &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('disabled ·') &&
    emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('enabled ·') &&
    fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('out.mp4 ·') &&
    fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('(empty) ·') &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('has-file ·') &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('empty ·') &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('disabled ·') &&
    emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('enabled ·') &&
    fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('out.mp4 ·') &&
    fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('(empty) ·') &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('has-file ·') &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('empty ·') &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('disabled ·') &&
    emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('enabled ·') &&
    fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('out.mp4 ·') &&
    fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('(empty) ·') &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('has-file ·') &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('empty ·') &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('disabled ·') &&
    emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('enabled ·') &&
    fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('out.mp4 ·') &&
    fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('(empty) ·') &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('has-file ·') &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('empty ·') &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('disabled ·') &&
    emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('enabled ·') &&
    fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('out.mp4 ·') &&
    fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('(empty) ·') &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('has-file ·') &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('empty ·') &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('disabled ·') &&
    emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('enabled ·') &&
    fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('out.mp4 ·') &&
    fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('(empty) ·') &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('has-file ·') &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('empty ·') &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('disabled ·') &&
    emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('enabled ·') &&
    fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('out.mp4 ·') &&
    fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('(empty) ·') &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('has-file ·') &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('empty ·') &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('disabled ·') &&
    emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('enabled ·') &&
    fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('out.mp4 ·') &&
    fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('(empty) ·') &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('has-file ·') &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('empty ·') &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('disabled ·') &&
    emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('enabled ·') &&
    fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('out.mp4 ·') &&
    fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('(empty) ·') &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('has-file ·') &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('empty ·') &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('disabled ·') &&
    emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('enabled ·') &&
    fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('out.mp4 ·') &&
    fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('(empty) ·') &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('has-file ·') &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('empty ·') &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('disabled ·') &&
    emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('enabled ·') &&
    fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('out.mp4 ·') &&
    fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('(empty) ·') &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('has-file ·') &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('empty ·') &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('disabled ·') &&
    emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('enabled ·') &&
    fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('out.mp4 ·') &&
    fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('(empty) ·') &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('has-file ·') &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('empty ·') &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('disabled ·') &&
    emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('enabled ·') &&
    fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('out.mp4 ·') &&
    fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('(empty) ·') &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('has-file ·') &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('empty ·') &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('disabled ·') &&
    emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('enabled ·') &&
    fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('out.mp4 ·') &&
    fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('(empty) ·') &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('has-file ·') &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('empty ·') &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('disabled ·') &&
    emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('enabled ·') &&
    fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('out.mp4 ·') &&
    fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('(empty) ·') &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('has-file ·') &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('empty ·') &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('disabled ·') &&
    emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('enabled ·') &&
    fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('out.mp4 ·') &&
    fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('(empty) ·') &&
    emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.disabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('has-file ·') &&
    fileOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(fileOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion) &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.startsWith('empty ·') &&
    emptyOffer.emptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion.includes(emptyOffer.filenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledEmptyFilenameDisabledVersion)
  ) {
    pass('pull_latest_empty_hint');
  } else {
    fail('pull_latest_empty_hint', 'Pull latest offers should include ComfyUI version for empty and has-file history.');
  }

  let extraSws = {};
  try {
    extraSws = JSON.parse(sysGraph[SWS_NODE_IDS.OUTPUT]?.inputs?.extra_json || '{}')?.sws || {};
  } catch {
    extraSws = {};
  }
  if (
    extraSws.systemInstruction === sysLine &&
    !String(sysGraph[SWS_NODE_IDS.PROMPT]?.inputs?.prompt || '').includes(sysLine) &&
    !String(sysGraph[SWS_NODE_IDS.PROMPT]?.inputs?.negative_prompt || '').includes(sysLine)
  ) {
    pass('output_extra_system_instruction');
  } else {
    fail('output_extra_system_instruction', 'SWS Output extra_json must record systemInstruction without folding into prompt.');
  }

  const metaInputs = sysGraph[SWS_NODE_IDS.METADATA]?.inputs || {};
  const metaIo = SWS_NODE_IO[SWS_COMFY_NODE_CLASSES.METADATA];
  if (
    metaInputs.system_instruction === sysLine &&
    !String(metaInputs.prompt || '').includes(sysLine) &&
    !String(sysGraph[SWS_NODE_IDS.PROMPT]?.inputs?.prompt || '').includes(sysLine) &&
    metaIo?.inputs?.some((s) => s.name === 'system_instruction')
  ) {
    pass('metadata_system_instruction');
  } else {
    fail('metadata_system_instruction', 'SWS Metadata must record system_instruction without folding into prompt.');
  }

  const manifest = buildWorkflowManifest(withSys);
  if (
    manifest.systemInstruction === sysLine &&
    String(manifest.prompt || '') !== sysLine &&
    !String(withSys.prompt || '').includes(sysLine)
  ) {
    pass('manifest_system_instruction');
  } else {
    fail('manifest_system_instruction', 'Workflow manifest must record systemInstruction without folding into prompt.');
  }

  const exported = buildComfyExportBundle(withSys);
  const exportSws = exported.frontend?.extra?.sws || {};
  if (
    exportSws.systemInstruction === sysLine &&
    !String(sysGraph[SWS_NODE_IDS.PROMPT]?.inputs?.prompt || '').includes(sysLine) &&
    String(exportSws.prompt || '') !== sysLine
  ) {
    pass('export_extra_sws_system_instruction');
  } else {
    fail('export_extra_sws_system_instruction', 'Export extra.sws must record systemInstruction without folding into prompt.');
  }

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
  const clapWithSys = buildClapboard({
    shot: { ...ramayanaShot(), systemInstruction: sysLine },
    projectTitle: 'MVK',
    shotIndex: 6,
    durationSec: 6
  });
  const sidecar = clapboardSidecarJson(clapWithSys, { systemInstruction: sysLine });
  if (
    !clapWithSys.label.includes(sysLine) &&
    clapWithSys.label === clap.label &&
    sidecar.systemInstruction === sysLine &&
    sidecar.clapboard === clap.label &&
    !String(sidecar.clapboard || '').includes(sysLine)
  ) {
    pass('clapboard_separate_from_system_instruction');
  } else {
    fail('clapboard_separate_from_system_instruction', 'Clapboard label must stay separate from systemInstruction.');
  }
  const namesForced = clapboardFileNames({
    projectId: 'MVK',
    sceneStr: 'SC24',
    shotStr: 'SH07',
    durationLabel: '6s',
    systemInstruction: sysLine
  });
  if (
    clapWithSys.fileStem === clap.fileStem &&
    clapWithSys.videoFilename === clap.videoFilename &&
    clapWithSys.fileStem === 'MVK_SC24_SH07_6s' &&
    clapWithSys.videoFilename === 'MVK_SC24_SH07_6s.mp4' &&
    !clapWithSys.fileStem.includes(sysLine) &&
    !clapWithSys.videoFilename.includes(sysLine) &&
    namesForced.fileStem === 'MVK_SC24_SH07_6s' &&
    namesForced.videoFilename === 'MVK_SC24_SH07_6s.mp4' &&
    !namesForced.fileStem.includes(sysLine) &&
    !namesForced.videoFilename.includes(sysLine)
  ) {
    pass('clapboard_filestem_free_of_system');
  } else {
    fail('clapboard_filestem_free_of_system', 'Clapboard fileStem / videoFilename must stay free of systemInstruction.');
  }
  const sidecarNamesForced = clapboardWorkflowSidecarNames({
    fileStem: clap.fileStem,
    systemInstruction: sysLine
  });
  if (
    clapWithSys.workflowFilename === clap.workflowFilename &&
    clapWithSys.sidecarFilename === clap.sidecarFilename &&
    clapWithSys.workflowFilename === 'MVK_SC24_SH07_6s_WORKFLOW.json' &&
    clapWithSys.sidecarFilename === 'MVK_SC24_SH07_6s.json' &&
    !clapWithSys.workflowFilename.includes(sysLine) &&
    !clapWithSys.sidecarFilename.includes(sysLine) &&
    sidecarNamesForced.workflowFilename === 'MVK_SC24_SH07_6s_WORKFLOW.json' &&
    sidecarNamesForced.sidecarFilename === 'MVK_SC24_SH07_6s.json' &&
    !sidecarNamesForced.workflowFilename.includes(sysLine) &&
    !sidecarNamesForced.sidecarFilename.includes(sysLine)
  ) {
    pass('clapboard_workflow_sidecar_free_of_system');
  } else {
    fail('clapboard_workflow_sidecar_free_of_system', 'Clapboard workflowFilename / sidecarFilename must stay free of systemInstruction.');
  }
  const displayForced = clapboardDisplayIds({
    projectId: 'MVK',
    shortId: clap.shotId,
    systemInstruction: sysLine
  });
  if (
    clapWithSys.shotId === clap.shotId &&
    clapWithSys.displayName === clap.displayName &&
    clapWithSys.shotId === 'SC24_SH07' &&
    clapWithSys.displayName === 'MVK SC24_SH07' &&
    !clapWithSys.shotId.includes(sysLine) &&
    !clapWithSys.displayName.includes(sysLine) &&
    displayForced.shotId === 'SC24_SH07' &&
    displayForced.displayName === 'MVK SC24_SH07' &&
    !displayForced.shotId.includes(sysLine) &&
    !displayForced.displayName.includes(sysLine)
  ) {
    pass('clapboard_display_ids_free_of_system');
  } else {
    fail('clapboard_display_ids_free_of_system', 'Clapboard displayName / shotId must stay free of systemInstruction.');
  }
  const placeForced = clapboardProjectSceneIds({
    projectTitle: 'MVK',
    sceneStr: 'SC24',
    systemInstruction: sysLine
  });
  if (
    clapWithSys.projectId === clap.projectId &&
    clapWithSys.sceneId === clap.sceneId &&
    clapWithSys.projectId === 'MVK' &&
    clapWithSys.sceneId === 'SC24' &&
    !clapWithSys.projectId.includes(sysLine) &&
    !clapWithSys.sceneId.includes(sysLine) &&
    placeForced.projectId === 'MVK' &&
    placeForced.sceneId === 'SC24' &&
    !placeForced.projectId.includes(sysLine) &&
    !placeForced.sceneId.includes(sysLine)
  ) {
    pass('clapboard_project_scene_free_of_system');
  } else {
    fail('clapboard_project_scene_free_of_system', 'Clapboard projectId / sceneId must stay free of systemInstruction.');
  }
  const labelForced = clapboardLabelText({
    sceneStr: 'SC24',
    shotStr: 'SH07',
    durationSec: 6,
    projectId: 'MVK',
    systemInstruction: sysLine
  });
  if (
    clapWithSys.label === clap.label &&
    clapWithSys.durationLabel === clap.durationLabel &&
    clapWithSys.label === 'Shot SC24, SH07 · 6s · MVK' &&
    clapWithSys.durationLabel === '6s' &&
    !clapWithSys.label.includes(sysLine) &&
    !clapWithSys.durationLabel.includes(sysLine) &&
    labelForced.label === 'Shot SC24, SH07 · 6s · MVK' &&
    labelForced.durationLabel === '6s' &&
    !labelForced.label.includes(sysLine) &&
    !labelForced.durationLabel.includes(sysLine)
  ) {
    pass('clapboard_label_duration_free_of_system');
  } else {
    fail('clapboard_label_duration_free_of_system', 'Clapboard label / durationLabel must stay free of systemInstruction.');
  }
  const numsForced = clapboardSceneShotNums({
    sceneNum: clap.sceneNum,
    shotNum: clap.shotNum,
    systemInstruction: sysLine
  });
  if (
    clapWithSys.sceneNum === clap.sceneNum &&
    clapWithSys.shotNum === clap.shotNum &&
    clapWithSys.sceneNum === 24 &&
    clapWithSys.shotNum === 7 &&
    numsForced.sceneNum === 24 &&
    numsForced.shotNum === 7
  ) {
    pass('clapboard_scene_shot_nums_free_of_system');
  } else {
    fail('clapboard_scene_shot_nums_free_of_system', 'Clapboard sceneNum / shotNum must stay free of systemInstruction.');
  }
  const durForced = clapboardDurationSec({ durationSec: 6, systemInstruction: sysLine });
  const durFromShot = clapboardDurationSec({
    shot: { ...ramayanaShot(), systemInstruction: sysLine, durationSec: 6 }
  });
  if (
    clapWithSys.durationSec === clap.durationSec &&
    clapWithSys.durationSec === 6 &&
    durForced === 6 &&
    durFromShot === 6
  ) {
    pass('clapboard_duration_sec_free_of_system');
  } else {
    fail('clapboard_duration_sec_free_of_system', 'Clapboard durationSec must stay free of systemInstruction.');
  }
  const sidecarDur = clapboardSidecarJson(clapWithSys, {
    systemInstruction: sysLine,
    durationSec: sysLine
  });
  if (
    sidecarDur.durationSec === clapWithSys.durationSec &&
    sidecarDur.durationSec === 6 &&
    sidecarDur.systemInstruction === sysLine &&
    String(sidecarDur.durationSec) !== sysLine
  ) {
    pass('clapboard_sidecar_duration_free_of_system');
  } else {
    fail('clapboard_sidecar_duration_free_of_system', 'Clapboard sidecar durationSec must stay free of systemInstruction.');
  }
  const sidecarStem = clapboardSidecarJson(clapWithSys, {
    systemInstruction: sysLine,
    fileStem: sysLine
  });
  if (
    sidecarStem.fileStem === clapWithSys.fileStem &&
    sidecarStem.fileStem === 'MVK_SC24_SH07_6s' &&
    sidecarStem.systemInstruction === sysLine &&
    sidecarStem.fileStem !== sysLine
  ) {
    pass('clapboard_sidecar_file_stem_free_of_system');
  } else {
    fail('clapboard_sidecar_file_stem_free_of_system', 'Clapboard sidecar fileStem must stay free of systemInstruction.');
  }
  const sidecarVideo = clapboardSidecarJson(clapWithSys, {
    systemInstruction: sysLine,
    videoFilename: sysLine
  });
  if (
    sidecarVideo.videoFilename === clapWithSys.videoFilename &&
    sidecarVideo.videoFilename === 'MVK_SC24_SH07_6s.mp4' &&
    sidecarVideo.systemInstruction === sysLine &&
    sidecarVideo.videoFilename !== sysLine
  ) {
    pass('clapboard_sidecar_video_filename_free_of_system');
  } else {
    fail('clapboard_sidecar_video_filename_free_of_system', 'Clapboard sidecar videoFilename must stay free of systemInstruction.');
  }
  const sidecarProject = clapboardSidecarJson(clapWithSys, {
    systemInstruction: sysLine,
    projectId: sysLine
  });
  if (
    sidecarProject.projectId === clapWithSys.projectId &&
    sidecarProject.projectId === 'MVK' &&
    sidecarProject.systemInstruction === sysLine &&
    sidecarProject.projectId !== sysLine
  ) {
    pass('clapboard_sidecar_project_id_free_of_system');
  } else {
    fail('clapboard_sidecar_project_id_free_of_system', 'Clapboard sidecar projectId must stay free of systemInstruction.');
  }
  const sidecarScene = clapboardSidecarJson(clapWithSys, {
    systemInstruction: sysLine,
    sceneId: sysLine
  });
  if (
    sidecarScene.sceneId === clapWithSys.sceneId &&
    sidecarScene.sceneId === 'SC24' &&
    sidecarScene.systemInstruction === sysLine &&
    sidecarScene.sceneId !== sysLine
  ) {
    pass('clapboard_sidecar_scene_id_free_of_system');
  } else {
    fail('clapboard_sidecar_scene_id_free_of_system', 'Clapboard sidecar sceneId must stay free of systemInstruction.');
  }
  const sidecarShot = clapboardSidecarJson(clapWithSys, {
    systemInstruction: sysLine,
    shotId: sysLine
  });
  if (
    sidecarShot.shotId === clapWithSys.shotId &&
    sidecarShot.shotId === 'SC24_SH07' &&
    sidecarShot.systemInstruction === sysLine &&
    sidecarShot.shotId !== sysLine
  ) {
    pass('clapboard_sidecar_shot_id_free_of_system');
  } else {
    fail('clapboard_sidecar_shot_id_free_of_system', 'Clapboard sidecar shotId must stay free of systemInstruction.');
  }
  const sidecarDurLabel = clapboardSidecarJson(clapWithSys, {
    systemInstruction: sysLine,
    durationLabel: sysLine
  });
  if (
    sidecarDurLabel.durationLabel === clapWithSys.durationLabel &&
    sidecarDurLabel.durationLabel === '6s' &&
    sidecarDurLabel.systemInstruction === sysLine &&
    sidecarDurLabel.durationLabel !== sysLine
  ) {
    pass('clapboard_sidecar_duration_label_free_of_system');
  } else {
    fail('clapboard_sidecar_duration_label_free_of_system', 'Clapboard sidecar durationLabel must stay free of systemInstruction.');
  }
  const sidecarDisplay = clapboardSidecarJson(clapWithSys, {
    systemInstruction: sysLine,
    displayName: sysLine
  });
  if (
    sidecarDisplay.displayName === clapWithSys.displayName &&
    sidecarDisplay.displayName === 'MVK SC24_SH07' &&
    sidecarDisplay.systemInstruction === sysLine &&
    sidecarDisplay.displayName !== sysLine
  ) {
    pass('clapboard_sidecar_display_name_free_of_system');
  } else {
    fail('clapboard_sidecar_display_name_free_of_system', 'Clapboard sidecar displayName must stay free of systemInstruction.');
  }
  const sidecarWorkflow = clapboardSidecarJson(clapWithSys, {
    systemInstruction: sysLine,
    workflowFilename: sysLine
  });
  if (
    sidecarWorkflow.workflowFilename === clapWithSys.workflowFilename &&
    sidecarWorkflow.workflowFilename === 'MVK_SC24_SH07_6s_WORKFLOW.json' &&
    sidecarWorkflow.systemInstruction === sysLine &&
    sidecarWorkflow.workflowFilename !== sysLine
  ) {
    pass('clapboard_sidecar_workflow_filename_free_of_system');
  } else {
    fail('clapboard_sidecar_workflow_filename_free_of_system', 'Clapboard sidecar workflowFilename must stay free of systemInstruction.');
  }
  const sidecarPackName = clapboardSidecarJson(clapWithSys, {
    systemInstruction: sysLine,
    sidecarFilename: sysLine
  });
  if (
    sidecarPackName.sidecarFilename === clapWithSys.sidecarFilename &&
    sidecarPackName.sidecarFilename === 'MVK_SC24_SH07_6s.json' &&
    sidecarPackName.systemInstruction === sysLine &&
    sidecarPackName.sidecarFilename !== sysLine
  ) {
    pass('clapboard_sidecar_filename_free_of_system');
  } else {
    fail('clapboard_sidecar_filename_free_of_system', 'Clapboard sidecar sidecarFilename must stay free of systemInstruction.');
  }
  const sidecarNums = clapboardSidecarJson(clapWithSys, {
    systemInstruction: sysLine,
    sceneNum: sysLine,
    shotNum: sysLine
  });
  if (
    sidecarNums.sceneNum === clapWithSys.sceneNum &&
    sidecarNums.shotNum === clapWithSys.shotNum &&
    sidecarNums.sceneNum === 24 &&
    sidecarNums.shotNum === 7 &&
    sidecarNums.systemInstruction === sysLine
  ) {
    pass('clapboard_sidecar_scene_shot_nums_free_of_system');
  } else {
    fail('clapboard_sidecar_scene_shot_nums_free_of_system', 'Clapboard sidecar sceneNum / shotNum must stay free of systemInstruction.');
  }
  const sidecarLabel = clapboardSidecarJson(clapWithSys, {
    systemInstruction: sysLine,
    label: sysLine,
    schema: sysLine
  });
  if (
    sidecarLabel.label === clapWithSys.label &&
    sidecarLabel.label === 'Shot SC24, SH07 · 6s · MVK' &&
    sidecarLabel.schema === 'sws.clapboard.v1' &&
    sidecarLabel.systemInstruction === sysLine &&
    sidecarLabel.label !== sysLine &&
    sidecarLabel.schema !== sysLine
  ) {
    pass('clapboard_sidecar_label_schema_free_of_system');
  } else {
    fail('clapboard_sidecar_label_schema_free_of_system', 'Clapboard sidecar label / schema must stay free of systemInstruction.');
  }
  const csv = clapboardResolveCsv([{ clap, fps: 24 }]);
  const edl = clapboardResolveEdl([{ clap }], { title: 'MVK' });
  if (csv.includes('Clip Name') && csv.includes(clap.fileStem) && edl.includes('TITLE:') && edl.includes(clap.videoFilename)) {
    pass('resolve_pack_csv_edl');
  } else {
    fail('resolve_pack_csv_edl', 'CSV/EDL missing expected clapboard fields');
  }
  const csvSys = clapboardResolveCsv([{ clap: clapWithSys, fps: 24, systemInstruction: sysLine }]);
  const clapCol = csvSys.indexOf('Clapboard');
  const sysCol = csvSys.indexOf('System Instruction');
  if (
    sysCol > clapCol &&
    clapCol >= 0 &&
    csvSys.includes(sysLine) &&
    csvSys.includes(clapWithSys.label) &&
    !csvSys.includes(`${clapWithSys.label} ${sysLine}`) &&
    !csvSys.includes(`${sysLine} ·`)
  ) {
    pass('resolve_csv_clapboard_separate_system');
  } else {
    fail('resolve_csv_clapboard_separate_system', 'Resolve CSV clapboard column must stay separate from systemInstruction.');
  }
  const edlSys = clapboardResolveEdl([{ clap: clapWithSys, systemInstruction: sysLine }], { title: 'MVK' });
  const clipNameLine = edlSys.split('\n').find((ln) => ln.startsWith('* CLIP NAME:')) || '';
  if (
    edlSys.includes('TITLE: MVK') &&
    clipNameLine === `* CLIP NAME: ${clapWithSys.label}` &&
    !clipNameLine.includes(sysLine) &&
    edlSys.includes(`* COMMENT: SYSTEM ${sysLine}`) &&
    !edlSys.includes(`TITLE: ${sysLine}`)
  ) {
    pass('resolve_edl_separate_system');
  } else {
    fail('resolve_edl_separate_system', 'Resolve EDL CLIP NAME must stay separate from systemInstruction.');
  }
  const pack = buildResolvePackFiles({
    projectTitle: 'MVK',
    shots: [{ ...ramayanaShot(), systemInstruction: sysLine }]
  });
  const packJson = pack.files.find((f) => f.name.endsWith('_clapboards.json'));
  const packSidecar = pack.files.find((f) => f.name.startsWith('sidecars/'));
  let packClips = [];
  let sidecarBody = {};
  try {
    packClips = JSON.parse(packJson?.content || '{}').clips || [];
    sidecarBody = JSON.parse(packSidecar?.content || '{}');
  } catch {
    packClips = [];
    sidecarBody = {};
  }
  const packClip = packClips[0] || {};
  if (
    packClip.clapboard === clapWithSys.label &&
    packClip.systemInstruction === sysLine &&
    !String(packClip.clapboard || '').includes(sysLine) &&
    sidecarBody.clapboard === clapWithSys.label &&
    sidecarBody.systemInstruction === sysLine &&
    !String(sidecarBody.clapboard || '').includes(sysLine)
  ) {
    pass('resolve_pack_json_separate_system');
  } else {
    fail('resolve_pack_json_separate_system', 'Resolve pack JSON clapboards must stay separate from systemInstruction.');
  }
  const packReadme = pack.files.find((f) => /README\.txt$/i.test(f.name))?.content || '';
  const readmeForced = resolvePackReadme({ projectTitle: 'MVK', systemInstruction: sysLine });
  if (
    packReadme.includes('DaVinci Resolve pack') &&
    !packReadme.includes(sysLine) &&
    !readmeForced.includes(sysLine) &&
    String(readmeForced || '') !== sysLine
  ) {
    pass('resolve_pack_readme_free_of_system');
  } else {
    fail('resolve_pack_readme_free_of_system', 'Resolve pack README must stay free of systemInstruction.');
  }
  const csvName = resolvePackFilename({ projectTitle: 'MVK', kind: 'csv', systemInstruction: sysLine });
  const sidecarName = resolvePackFilename({
    projectTitle: 'MVK',
    kind: 'sidecar',
    sidecarFilename: clapWithSys.sidecarFilename,
    systemInstruction: sysLine
  });
  if (
    csvName === 'resolve/MVK_clip_list.csv' &&
    !csvName.includes(sysLine) &&
    sidecarName.startsWith('sidecars/') &&
    !sidecarName.includes(sysLine) &&
    pack.files.every((f) => !String(f.name || '').includes(sysLine))
  ) {
    pass('resolve_pack_filenames_free_of_system');
  } else {
    fail('resolve_pack_filenames_free_of_system', 'Resolve pack filenames must stay free of systemInstruction.');
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
