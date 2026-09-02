#!/usr/bin/env node
/**
 * Structural checks that do not import Vite/JSX:
 * ComfyUI-SWS class names, SWS templates, sample API-format graph, failure graphs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

function fail(msg) {
  errors.push(msg);
  console.error(`FAIL  ${msg}`);
}
function pass(msg) {
  console.log(`ok    ${msg}`);
}

const templatesSrc = fs.readFileSync(path.join(root, 'src/utils/swsComfyTemplates.js'), 'utf8');
const classBlock = templatesSrc.match(/SWS_COMFY_NODE_CLASSES = Object\.freeze\(\{([\s\S]*?)\}\)/);
const uniqueClasses = classBlock
  ? [...classBlock[1].matchAll(/:\s*'(SWS [^']+)'/g)].map((m) => m[1])
  : [];
if (uniqueClasses.length !== 11) fail(`Expected 11 SWS class names, got ${uniqueClasses.length}: ${uniqueClasses.join(', ')}`);
else pass(`template class_types (${uniqueClasses.length})`);

const py = fs.readFileSync(path.join(root, 'ComfyUI-SWS/nodes/sws_nodes.py'), 'utf8');
const mapping = [...py.matchAll(/"SWS [^"]+"/g)].map((m) => m[0].slice(1, -1));
const mappingUnique = [...new Set(mapping)];
for (const cls of uniqueClasses) {
  if (!mappingUnique.includes(cls)) fail(`ComfyUI-SWS missing NODE_CLASS_MAPPINGS key: ${cls}`);
}
if (errors.filter((e) => e.includes('NODE_CLASS_MAPPINGS')).length === 0) {
  pass('Python mappings match SWS class_types');
}

const pyFiles = [
  path.join(root, 'ComfyUI-SWS/nodes/sws_nodes.py'),
  path.join(root, 'ComfyUI-SWS/nodes/sws_common.py'),
  path.join(root, 'ComfyUI-SWS/nodes/sws_server.py'),
  path.join(root, 'ComfyUI-SWS/__init__.py')
];
const pyCompile = spawnSync(
  'python3',
  [
    '-c',
    'import ast,sys\nfor f in sys.argv[1:]:\n ast.parse(open(f, encoding="utf-8").read())',
    ...pyFiles
  ],
  { encoding: 'utf8' }
);
if (pyCompile.status !== 0) fail(pyCompile.stderr || pyCompile.stdout || 'Python parse failed');
else pass('ComfyUI-SWS Python parses');

const ids = ['100', '110', '120', '130', '140', '150', '160', '170', '200', '300'];
const sample = {
  100: { class_type: 'SWS Shot Context', inputs: { project_id: 'Ramayana', scene_id: 'SC24', shot_id: 'SC24_SH07' } },
  110: { class_type: 'SWS Character Context', inputs: { character_name: 'Rama' } },
  120: { class_type: 'SWS Location Context', inputs: { location_name: 'Panchavati' } },
  130: { class_type: 'SWS Camera Context', inputs: { lens: '35mm', camera_movement: 'slow tracking' } },
  140: { class_type: 'SWS Lighting Context', inputs: { time_of_day: 'golden hour' } },
  150: { class_type: 'SWS Prompt', inputs: { prompt: 'Rama walks through Panchavati at golden hour.', negative_prompt: '' } },
  160: { class_type: 'SWS Reference Loader', inputs: { asset_url: '' } },
  170: { class_type: 'SWS Metadata', inputs: { workflow_id: 'sws_Ramayana_SC24_SH07' } },
  200: {
    class_type: 'SWS Video Provider',
    inputs: {
      shot_context: ['100', 0],
      prompt: ['150', 0],
      negative_prompt: ['150', 1],
      character_context: ['110', 0],
      location_context: ['120', 0],
      camera_context: ['130', 0],
      lighting_context: ['140', 0],
      reference: ['160', 0],
      provider: 'byteplus',
      model: 'seedance-1-0-pro-250528',
      duration: 5,
      width: 1920,
      height: 1080,
      fps: 24,
      seed: 24
    }
  },
  300: { class_type: 'SWS Output', inputs: { provider_result: ['200', 0], shot_context: ['100', 0], shot_id: 'SC24_SH07' } }
};

for (const id of ids) {
  if (!sample[id]?.class_type) fail(`sample missing node ${id}`);
}
const blob = JSON.stringify(sample);
if (/api[_-]?key/i.test(blob)) fail('sample contains api_key');
else pass('sample graph has stable IDs and no API keys');

const broken = structuredClone(sample);
delete broken['150'];
const missingLink = Object.values(broken['200'].inputs).some((v) => Array.isArray(v) && String(v[0]) === '150');
if (missingLink && !broken['150']) pass('failure case: missing Prompt node 150');
else fail('could not construct missing-node failure case');

const invented = structuredClone(sample);
invented['999'] = { class_type: 'KSampler', inputs: {} };
if (!uniqueClasses.includes('KSampler')) pass('failure case: KSampler is not an SWS class_type');
else fail('KSampler leaked into allowed classes');

const initPy = fs.readFileSync(path.join(root, 'ComfyUI-SWS/__init__.py'), 'utf8');
if (initPy.includes('WEB_DIRECTORY') && initPy.includes('sws_server')) pass('ComfyUI-SWS registers web + load route');
else fail('ComfyUI-SWS __init__.py must export WEB_DIRECTORY and import sws_server');

const webJs = path.join(root, 'ComfyUI-SWS/web/sws_open_workflow.js');
if (fs.existsSync(webJs) && fs.readFileSync(webJs, 'utf8').includes('loadGraphData')) {
  pass('frontend extension calls loadGraphData');
} else fail('Missing ComfyUI-SWS web extension loadGraphData hook');

const serverPy = fs.readFileSync(path.join(root, 'ComfyUI-SWS/nodes/sws_server.py'), 'utf8');
if (serverPy.includes('/sws/load_workflow') && serverPy.includes('send_sync')) pass('PromptServer /sws/load_workflow route');
else fail('sws_server.py must expose /sws/load_workflow and send_sync');

function isFrontend(wf) {
  return wf && Array.isArray(wf.nodes) && wf.nodes.length && Array.isArray(wf.links) && typeof wf.version === 'number';
}
const sampleFrontend = {
  last_node_id: 3,
  last_link_id: 1,
  version: 0.4,
  nodes: [
    { id: 1, type: 'SWS Prompt', pos: [40, 40], size: [340, 160], flags: {}, order: 0, mode: 0, inputs: [], outputs: [{ name: 'prompt', type: 'STRING', links: [1], slot_index: 0 }], properties: {}, widgets_values: ['hi'] },
    { id: 2, type: 'SWS Video Provider', pos: [420, 40], size: [340, 280], flags: {}, order: 1, mode: 0, inputs: [{ name: 'prompt', type: 'STRING', link: 1, slot_index: 0 }], outputs: [{ name: 'provider_result', type: 'STRING', links: [], slot_index: 0 }], properties: {}, widgets_values: ['byteplus'] }
  ],
  links: [[1, 1, 0, 2, 0, 'STRING']],
  groups: [],
  config: {},
  extra: { ds: { scale: 1, offset: [0, 0] } }
};
if (isFrontend(sampleFrontend) && sampleFrontend.nodes.every((n) => n.pos && n.size)) pass('sample frontend workflow has canvas fields');
else fail('sample frontend workflow invalid');
if (sample.nodes || sample.version) fail('API sample must not look like frontend JSON');
else pass('API sample is not frontend JSON');

// Matrix → Seedance 2.0 master (second PDF family)
const matrixFiles = [
  'src/utils/normalizedShotData.js',
  'src/utils/comfyPromptComposer.js',
  'src/utils/comfyReferenceRouter.js',
  'src/utils/comfyParameterMapper.js',
  'src/utils/seedanceMasterWorkflow.js',
  'src/utils/assembleMatrixSeedanceWorkflow.js'
];
for (const rel of matrixFiles) {
  if (!fs.existsSync(path.join(root, rel))) fail(`missing ${rel}`);
}
if (errors.filter((e) => e.startsWith('missing src/utils/')).length === 0) {
  pass('Matrix→Seedance master modules present');
}

if (!templatesSrc.includes('video_seedance2_master')) fail('template registry missing video_seedance2_master');
else pass('video_seedance2_master registered');

const masterSrc = fs.readFileSync(path.join(root, 'src/utils/seedanceMasterWorkflow.js'), 'utf8');
if (
  masterSrc.includes('PedditiLabsBytePlusSeedance2') &&
  masterSrc.includes('ByteDance2ReferenceNodeV2') &&
  masterSrc.includes('SaveVideoCleanName') &&
  masterSrc.includes('PlaySound|pysssss') &&
  masterSrc.includes('LoadImageFromPath') &&
  masterSrc.includes('LoadVideoFromPath') &&
  masterSrc.includes('refGridPos') &&
  masterSrc.includes('definitions') &&
  masterSrc.includes('REFERENCE INPUTS') &&
  masterSrc.includes('PROMPT COMPOSER') &&
  masterSrc.includes('NEGATIVE PROMPT') &&
  masterSrc.includes('SYSTEM INSTRUCTION')
) {
  pass('Seedance master template builder has required node types + groups');
} else fail('Seedance master template builder incomplete');

const filmSrc = fs.readFileSync(path.join(root, 'src/utils/comfyFilmQueue.js'), 'utf8');
if (filmSrc.includes('runComfyFilmQueue') && filmSrc.includes('autoQueue')) {
  pass('Comfy film queue module present');
} else fail('Comfy film queue module missing');

const openSrc = fs.readFileSync(path.join(root, 'ComfyUI-SWS/web/sws_open_workflow.js'), 'utf8');
if (openSrc.includes('autoQueue') && openSrc.includes('queuePrompt')) {
  pass('ComfyUI-SWS autoQueue after load');
} else fail('ComfyUI-SWS missing autoQueue');

const assembleSrc = fs.readFileSync(path.join(root, 'src/utils/assembleMatrixSeedanceWorkflow.js'), 'utf8');
if (
  assembleSrc.includes('normalizeShotForComfy') &&
  assembleSrc.includes('composeModelPrompt') &&
  assembleSrc.includes('routeReferencesForSeedance') &&
  assembleSrc.includes('mapSeedanceParameters') &&
  assembleSrc.includes('buildSeedanceMasterFrontendWorkflow')
) {
  pass('assembleMatrixSeedanceWorkflow wires PDF §7 pipeline');
} else fail('assembleMatrixSeedanceWorkflow missing pipeline steps');
if (
  assembleSrc.includes('negativePrompt: composed.negativePrompt') &&
  assembleSrc.includes('composedSource: composed.source')
) {
  pass('assemble passes negativePrompt + composedSource into Seedance');
} else fail('assemble missing negativePrompt / composedSource wiring');

const clientSrc = fs.readFileSync(path.join(root, 'src/services/comfyuiClient.js'), 'utf8');
if (clientSrc.includes('missingComfyClassStatusLine') && clientSrc.includes('Missing Seedance / ComfyUI-SWS classes')) {
  pass('Send-to-Comfy missing-class status line helper');
} else fail('missingComfyClassStatusLine helper missing');
if (clientSrc.includes('installedComfyClassCount')) {
  pass('Send-to-Comfy installed class count helper');
} else fail('installedComfyClassCount helper missing');

const modalSrc = fs.readFileSync(path.join(root, 'src/components/SwsComfyWorkflowModal.jsx'), 'utf8');
if (
  modalSrc.includes('installedClassCount') &&
  modalSrc.includes('comfyuiVersion') &&
  modalSrc.includes('offerPullLatest') &&
  modalSrc.includes('History already has a viewable output')
) {
  pass('Send records version + class count and offers Pull latest');
} else fail('Send debug/Pull-after-Send offer missing');

const promptNode = py.match(/class SWSPrompt:[\s\S]*?(?=\nclass )/);
if (
  promptNode &&
  promptNode[0].includes('RETURN_TYPES = ("STRING", "STRING", "STRING")') &&
  promptNode[0].includes('RETURN_NAMES = ("prompt", "negative_prompt", "system_instruction")') &&
  promptNode[0].includes('return (prompt, negative_prompt, system_instruction)')
) {
  pass('SWS Prompt Python third output is system_instruction');
} else fail('SWS Prompt Python does not return system_instruction');

const filmQueueSrc = fs.readFileSync(path.join(root, 'src/utils/comfyFilmQueue.js'), 'utf8');
if (filmQueueSrc.includes('composedSource')) pass('film queue progress carries composedSource');
else fail('film queue missing composedSource on progress');

const composerSrc = fs.readFileSync(path.join(root, 'src/utils/comfyPromptComposer.js'), 'utf8');
if (
  composerSrc.includes('systemInstruction') &&
  composerSrc.includes('splitInstructionFields') &&
  !composerSrc.includes('prompt: [prompt, sys].join')
) {
  pass('composer keeps systemInstruction as a third field');
} else fail('composer may fold systemInstruction');

const histMod = await import('../src/utils/comfyHistoryParse.js');
const ref = histMod.firstComfyOutputRef({
  9: { images: [{ filename: 'SWS_shot.mp4', subfolder: '', type: 'output' }] }
});
if (ref?.filename !== 'SWS_shot.mp4') fail('firstComfyOutputRef');
else pass('firstComfyOutputRef');
const latest = histMod.pickLatestHistoryEntry({
  a: { outputs: {} },
  b: { outputs: { 1: { images: [{ filename: 'out.png', subfolder: '', type: 'output' }] } } }
});
if (latest?.promptId !== 'b' || histMod.comfyViewUrl('http://127.0.0.1:8188', ref).includes('SWS_shot.mp4') === false) {
  fail('pickLatestHistoryEntry / comfyViewUrl');
} else pass('Comfy history parse');
const viewName = histMod.filenameFromComfyViewUrl(
  'http://127.0.0.1:8188/view?filename=clip.mp4&type=output'
);
if (viewName !== 'clip.mp4') fail(`filenameFromComfyViewUrl ${viewName}`);
else pass('filenameFromComfyViewUrl');

if (errors.length) {
  console.error(`\n${errors.length} failed`);
  process.exit(1);
}
console.log('\nSWS ComfyUI structural tests passed.');
