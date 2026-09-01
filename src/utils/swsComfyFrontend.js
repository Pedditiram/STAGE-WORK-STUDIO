/**
 * Convert SWS API-format prompt graphs into ComfyUI frontend workflow JSON (schema 0.4).
 * The editor canvas needs nodes[], links[], positions, sizes, and widgets_values —
 * not the flat { id: { class_type, inputs } } execution map.
 */

import { SWS_COMFY_NODE_CLASSES } from './swsComfyTemplates';

const FRONTEND_VERSION = 0.4;

/** Fallback I/O when /object_info is unavailable (matches ComfyUI-SWS Python nodes). */
export const SWS_NODE_IO = Object.freeze({
  [SWS_COMFY_NODE_CLASSES.CONTEXT]: {
    inputs: ['project_id', 'scene_id', 'shot_id', 'character', 'location', 'action', 'camera', 'lighting'].map((name) => ({
      name,
      type: 'STRING'
    })),
    outputs: [{ name: 'shot_context', type: 'STRING' }]
  },
  [SWS_COMFY_NODE_CLASSES.CHARACTER]: {
    inputs: [
      'character_id',
      'character_name',
      'character_reference',
      'character_description',
      'costume',
      'appearance',
      'continuity_data'
    ].map((name) => ({ name, type: 'STRING' })),
    outputs: [{ name: 'character_context', type: 'STRING' }]
  },
  [SWS_COMFY_NODE_CLASSES.LOCATION]: {
    inputs: ['location_id', 'location_name', 'description', 'reference_images', 'continuity_data'].map((name) => ({
      name,
      type: 'STRING'
    })),
    outputs: [{ name: 'location_context', type: 'STRING' }]
  },
  [SWS_COMFY_NODE_CLASSES.CAMERA]: {
    inputs: ['shot_type', 'camera_angle', 'lens', 'focal_length', 'camera_movement', 'framing', 'composition'].map(
      (name) => ({ name, type: 'STRING' })
    ),
    outputs: [{ name: 'camera_context', type: 'STRING' }]
  },
  [SWS_COMFY_NODE_CLASSES.LIGHTING]: {
    inputs: ['lighting', 'time_of_day', 'weather', 'color_temperature', 'contrast'].map((name) => ({
      name,
      type: 'STRING'
    })),
    outputs: [{ name: 'lighting_context', type: 'STRING' }]
  },
  [SWS_COMFY_NODE_CLASSES.PROMPT]: {
    inputs: ['prompt', 'negative_prompt', 'system_instruction'].map((name) => ({ name, type: 'STRING' })),
    outputs: [
      { name: 'prompt', type: 'STRING' },
      { name: 'negative_prompt', type: 'STRING' }
    ]
  },
  [SWS_COMFY_NODE_CLASSES.REFERENCE]: {
    inputs: ['asset_id', 'asset_url', 'local_path', 'last_frame_url'].map((name) => ({ name, type: 'STRING' })),
    outputs: [{ name: 'reference', type: 'STRING' }]
  },
  [SWS_COMFY_NODE_CLASSES.METADATA]: {
    inputs: [
      'project_id',
      'scene_id',
      'shot_id',
      'workflow_id',
      'template_id',
      'template_version',
      'sws_workflow_version',
      'provider',
      'model'
    ].map((name) => ({ name, type: 'STRING' })),
    outputs: [{ name: 'metadata', type: 'STRING' }]
  },
  [SWS_COMFY_NODE_CLASSES.PROVIDER_VIDEO]: providerIo(),
  [SWS_COMFY_NODE_CLASSES.PROVIDER_IMAGE]: providerIo(),
  [SWS_COMFY_NODE_CLASSES.OUTPUT]: {
    inputs: [
      { name: 'provider_result', type: 'STRING' },
      { name: 'shot_context', type: 'STRING' },
      { name: 'project_id', type: 'STRING' },
      { name: 'scene_id', type: 'STRING' },
      { name: 'shot_id', type: 'STRING' },
      { name: 'generation_id', type: 'STRING' },
      { name: 'workflow_id', type: 'STRING' },
      { name: 'provider', type: 'STRING' },
      { name: 'model', type: 'STRING' },
      { name: 'extra_json', type: 'STRING' }
    ],
    outputs: [{ name: 'sws_result', type: 'STRING' }]
  }
});

function providerIo() {
  return {
    inputs: [
      { name: 'shot_context', type: 'STRING' },
      { name: 'prompt', type: 'STRING' },
      { name: 'negative_prompt', type: 'STRING' },
      { name: 'character_context', type: 'STRING' },
      { name: 'location_context', type: 'STRING' },
      { name: 'camera_context', type: 'STRING' },
      { name: 'lighting_context', type: 'STRING' },
      { name: 'reference', type: 'STRING' },
      { name: 'provider', type: 'STRING' },
      { name: 'provider_account_id', type: 'STRING' },
      { name: 'model', type: 'STRING' },
      { name: 'duration', type: 'INT' },
      { name: 'width', type: 'INT' },
      { name: 'height', type: 'INT' },
      { name: 'fps', type: 'INT' },
      { name: 'seed', type: 'INT' },
      { name: 'workflow_type', type: 'STRING' }
    ],
    outputs: [{ name: 'provider_result', type: 'STRING' }]
  };
}

function isLinkValue(value) {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    (typeof value[0] === 'string' || typeof value[0] === 'number') &&
    Number.isFinite(Number(value[1]))
  );
}

export function isComfyApiPrompt(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (Array.isArray(value.nodes)) return false;
  const entries = Object.values(value);
  if (!entries.length) return false;
  return entries.every((n) => n && typeof n === 'object' && typeof n.class_type === 'string');
}

export function isComfyFrontendWorkflow(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (!Array.isArray(value.nodes) || !Array.isArray(value.links)) return false;
  if (typeof value.version !== 'number') return false;
  if (value.last_node_id == null || value.last_link_id == null) return false;
  return value.nodes.every(
    (n) =>
      n &&
      (typeof n.id === 'number' || typeof n.id === 'string') &&
      typeof n.type === 'string' &&
      n.pos &&
      n.size
  );
}

function ioForClass(classType, objectInfo) {
  const def = objectInfo?.[classType];
  if (def) {
    const required = def.input?.required || {};
    const optional = def.input?.optional || {};
    const inputs = [...Object.entries(required), ...Object.entries(optional)].map(([name, spec]) => ({
      name,
      type: Array.isArray(spec) ? spec[0] : 'STRING'
    }));
    const outTypes = Array.isArray(def.output) ? def.output : [];
    const outNames = Array.isArray(def.output_name) ? def.output_name : outTypes;
    const outputs = outTypes.map((type, i) => ({
      name: String(outNames[i] || type || `out${i}`),
      type: typeof type === 'string' ? type : 'STRING'
    }));
    if (inputs.length) return { inputs, outputs };
  }
  return SWS_NODE_IO[classType] || { inputs: [], outputs: [{ name: 'out', type: '*' }] };
}

function layoutForNodes(ids) {
  const colW = 380;
  const rowH = 340;
  const positions = {};
  const left = [100, 110, 120];
  const mid = [130, 140];
  const mid2 = [150, 160, 170];
  const mapStacks = [
    [left, 40],
    [mid, 40 + colW],
    [mid2, 40 + colW * 2]
  ];
  mapStacks.forEach(([stack, x]) => {
    stack.forEach((id, i) => {
      if (ids.includes(String(id))) positions[String(id)] = [x, 40 + i * rowH];
    });
  });
  if (ids.includes('200')) positions['200'] = [40 + colW * 3, 180];
  if (ids.includes('300')) positions['300'] = [40 + colW * 4, 220];
  ids.forEach((id, i) => {
    if (!positions[id]) positions[id] = [40 + (i % 4) * colW, 40 + Math.floor(i / 4) * rowH];
  });
  return positions;
}

function nodeSize(io, widgetCount) {
  const lines = Math.max(widgetCount, 1);
  const h = Math.min(720, 90 + lines * 28 + (io.outputs?.length || 1) * 22);
  return [340, h];
}

function computeViewRestore(nodes) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  nodes.forEach((n) => {
    const x = n.pos[0];
    const y = n.pos[1];
    const w = n.size[0];
    const h = n.size[1];
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  });
  const pad = 60;
  const gw = Math.max(1, maxX - minX + pad * 2);
  const gh = Math.max(1, maxY - minY + pad * 2);
  const viewW = 1400;
  const viewH = 860;
  const scale = Math.max(0.25, Math.min(1, viewW / gw, viewH / gh));
  return {
    scale,
    offset: [pad - minX * scale, pad - minY * scale]
  };
}

function newWorkflowUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function validateComfyFrontendWorkflow(workflow) {
  const errors = [];
  if (isComfyApiPrompt(workflow)) {
    errors.push({
      code: 'api_format_not_frontend',
      message: 'This is ComfyUI execution/API JSON, not frontend workflow JSON. Convert before loading the canvas.'
    });
    return { ok: false, errors };
  }
  if (!isComfyFrontendWorkflow(workflow)) {
    errors.push({
      code: 'not_frontend_workflow',
      message: 'JSON is missing ComfyUI editor fields (nodes, links, version, last_node_id, last_link_id, positions).'
    });
    return { ok: false, errors };
  }
  if (!workflow.nodes.length) {
    errors.push({ code: 'empty_canvas', message: 'Frontend workflow has no nodes. Refusing to open an empty canvas.' });
  }
  const nodeIds = new Set(workflow.nodes.map((n) => String(n.id)));
  workflow.nodes.forEach((n) => {
    const pos = n.pos;
    const xy = Array.isArray(pos) ? pos : [pos?.[0], pos?.[1]];
    if (!Number.isFinite(xy[0]) || !Number.isFinite(xy[1])) {
      errors.push({ code: 'missing_pos', message: `Node ${n.id} is missing a canvas position.` });
    }
    const size = n.size;
    const wh = Array.isArray(size) ? size : [size?.[0], size?.[1]];
    if (!Number.isFinite(wh[0]) || !Number.isFinite(wh[1])) {
      errors.push({ code: 'missing_size', message: `Node ${n.id} is missing a canvas size.` });
    }
  });
  (workflow.links || []).forEach((link, i) => {
    const tuple = Array.isArray(link)
      ? link
      : [link?.id, link?.origin_id, link?.origin_slot, link?.target_id, link?.target_slot, link?.type];
    if (tuple.length < 6) {
      errors.push({ code: 'bad_link', message: `Link ${i} is missing origin/target slots.` });
      return;
    }
    const [, origin, , target] = tuple;
    if (!nodeIds.has(String(origin)) || !nodeIds.has(String(target))) {
      errors.push({ code: 'broken_frontend_link', message: `Link ${tuple[0]} points at a missing node.` });
    }
  });
  return { ok: errors.length === 0, errors };
}

export function apiPromptToFrontendWorkflow(promptGraph, { objectInfo, extra } = {}) {
  if (isComfyFrontendWorkflow(promptGraph)) return promptGraph;
  const prompt = promptGraph || {};
  const ids = Object.keys(prompt);
  const positions = layoutForNodes(ids);
  const links = [];
  let linkId = 0;
  const pendingLinks = [];

  ids.forEach((id) => {
    const node = prompt[id];
    const io = ioForClass(node?.class_type, objectInfo);
    const values = node?.inputs || {};
    io.inputs.forEach((slot, slotIndex) => {
      const raw = values[slot.name];
      if (!isLinkValue(raw)) return;
      linkId += 1;
      pendingLinks.push({
        id: linkId,
        originId: Number(raw[0]),
        originSlot: Number(raw[1]),
        targetId: Number(id),
        targetSlot: slotIndex,
        type: slot.type || 'STRING'
      });
    });
  });

  const originLinkIndex = {};
  pendingLinks.forEach((lnk) => {
    links.push([lnk.id, lnk.originId, lnk.originSlot, lnk.targetId, lnk.targetSlot, lnk.type]);
    const key = `${lnk.originId}:${lnk.originSlot}`;
    if (!originLinkIndex[key]) originLinkIndex[key] = [];
    originLinkIndex[key].push(lnk.id);
  });

  const nodes = ids.map((id, order) => {
    const apiNode = prompt[id];
    const classType = apiNode?.class_type || 'Unknown';
    const io = ioForClass(classType, objectInfo);
    const values = apiNode?.inputs || {};
    const widgets_values = [];
    const inputs = [];
    io.inputs.forEach((slot, slotIndex) => {
      const raw = values[slot.name];
      if (isLinkValue(raw)) {
        const found = pendingLinks.find((l) => l.targetId === Number(id) && l.targetSlot === slotIndex);
        inputs.push({
          name: slot.name,
          type: slot.type || 'STRING',
          link: found ? found.id : null,
          slot_index: slotIndex
        });
      } else {
        if (slot.type === 'INT') widgets_values.push(raw == null || raw === '' ? 0 : Number(raw));
        else if (slot.type === 'FLOAT') widgets_values.push(raw == null || raw === '' ? 0 : Number(raw));
        else if (slot.type === 'BOOLEAN') widgets_values.push(Boolean(raw));
        else widgets_values.push(raw == null ? '' : raw);
      }
    });
    const outputs = (io.outputs || []).map((slot, slotIndex) => ({
      name: slot.name,
      type: slot.type || 'STRING',
      links: originLinkIndex[`${Number(id)}:${slotIndex}`] || [],
      slot_index: slotIndex
    }));
    const size = nodeSize(io, widgets_values.length + inputs.length);
    return {
      id: Number(id),
      type: classType,
      pos: positions[id] || [40, 40 + order * 80],
      size,
      flags: {},
      order,
      mode: 0,
      inputs,
      outputs,
      properties: { 'Node name for S&R': classType },
      widgets_values,
      title: apiNode?._meta?.title || classType
    };
  });

  const numericIds = nodes.map((n) => Number(n.id)).filter((n) => Number.isFinite(n));
  const ds = computeViewRestore(nodes);
  return {
    id: newWorkflowUuid(),
    revision: 0,
    last_node_id: numericIds.length ? Math.max(...numericIds) : 0,
    last_link_id: linkId,
    nodes,
    links,
    groups: [],
    config: {},
    extra: {
      ds,
      frontendVersion: extra?.frontendVersion,
      sws: extra?.sws || undefined
    },
    version: FRONTEND_VERSION
  };
}

export function formatFrontendValidationMessage(result) {
  if (result?.ok) return 'ComfyUI editor workflow is valid.';
  return (result?.errors || []).map((e) => e.message).join('\n');
}
