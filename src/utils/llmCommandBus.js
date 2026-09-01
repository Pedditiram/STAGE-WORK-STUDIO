/**
 * P2 — LLM structured command bus.
 * Propose → validate → approve → mutate. LLM never silently writes Project SoT.
 */

import { isUsableProjectTitle, normalizeProjectTitle } from './activeProjectGate';
import { isShotSpecCraftKey, SHOT_SPEC_CRAFT_KEYS, ensureShotSpecMeta } from './shotSpec';
import { assertCanMutateContent, assertProjectCanMutate, isLifecycleLocked } from './productionLifecycle';
import { appendCreativeAudit, getActorEmail } from './creativeAuditLog';
import { safeLocalStorageSetItem } from './safeStorage';

export const CMD_STATUS = Object.freeze({
  PROPOSED: 'proposed',
  VALIDATED: 'validated',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  APPLIED: 'applied',
  FAILED: 'failed'
});

/** Allowed mutation verbs — keep narrow so LLM cannot invent free-form writes. */
export const CMD_TYPES = Object.freeze({
  PATCH_SHOT_CRAFT: 'patch_shot_craft',
  REPLACE_SHOT: 'replace_shot',
  PATCH_CHARACTER: 'patch_character',
  PATCH_WORLD: 'patch_world',
  SET_CONTINUITY_PATCH: 'set_continuity_patch',
  APPLY_SHOTS: 'apply_shots'
});

const MAX_PENDING = 40;

function slugProjectTitle(title) {
  const s = String(title || 'untitled')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return s || 'untitled';
}

function cmdKeyForTitle(title) {
  return `sps_llm_commands::${slugProjectTitle(title)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function newCmdId() {
  return `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function clip(s, max) {
  const t = String(s || '').trim();
  if (!t) return '';
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

export function readLlmCommands(title) {
  if (typeof window === 'undefined') return [];
  const t = normalizeProjectTitle(title);
  if (!t) return [];
  try {
    const raw = localStorage.getItem(cmdKeyForTitle(t));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistCommands(title, list) {
  const t = normalizeProjectTitle(title);
  if (!isUsableProjectTitle(t)) return list;
  const trimmed = (Array.isArray(list) ? list : []).slice(0, MAX_PENDING);
  try {
    safeLocalStorageSetItem(cmdKeyForTitle(t), JSON.stringify(trimmed));
    window.dispatchEvent(
      new CustomEvent('sps_llm_commands_updated', { detail: { title: t, count: trimmed.length } })
    );
  } catch {
    /* ignore */
  }
  return trimmed;
}

export function getPendingLlmCommands(title) {
  return readLlmCommands(title).filter((c) =>
    [CMD_STATUS.PROPOSED, CMD_STATUS.VALIDATED].includes(c.status)
  );
}

/**
 * Validate a command against schema + production gates (no SoT write).
 */
export function validateLlmCommand(cmd, ctx = {}) {
  const errors = [];
  if (!cmd || typeof cmd !== 'object') {
    return { ok: false, errors: ['Command missing'] };
  }
  if (!Object.values(CMD_TYPES).includes(cmd.type)) {
    errors.push(`Unknown command type: ${cmd.type}`);
  }
  const title = normalizeProjectTitle(cmd.projectTitle || ctx.projectTitle);
  if (!isUsableProjectTitle(title)) {
    errors.push('Usable project title required');
  }
  const projectGate = assertProjectCanMutate(title);
  if (!projectGate.ok) errors.push(projectGate.message);

  const shots = Array.isArray(ctx.shots) ? ctx.shots : [];
  const payload = cmd.payload || {};

  if (cmd.type === CMD_TYPES.PATCH_SHOT_CRAFT) {
    const idx = Number(payload.shotIndex);
    if (!Number.isFinite(idx) || idx < 0 || idx >= shots.length) errors.push('Invalid shotIndex');
    else if (isLifecycleLocked(shots[idx])) errors.push('Shot is locked — unlock before craft patch');
    if (!isShotSpecCraftKey(payload.craftKey)) errors.push(`Invalid craft key: ${payload.craftKey}`);
    if (payload.value == null) errors.push('Craft value required');
  }

  if (cmd.type === CMD_TYPES.REPLACE_SHOT) {
    const idx = Number(payload.shotIndex);
    if (!Number.isFinite(idx) || idx < 0 || idx >= shots.length) errors.push('Invalid shotIndex');
    else if (isLifecycleLocked(shots[idx])) errors.push('Shot is locked — unlock before replace');
    if (!payload.shot || typeof payload.shot !== 'object') errors.push('Replacement shot object required');
  }

  if (cmd.type === CMD_TYPES.PATCH_CHARACTER) {
    if (!payload.characterId && !payload.tag) errors.push('characterId or tag required');
    if (!payload.patch || typeof payload.patch !== 'object') errors.push('Character patch object required');
  }

  if (cmd.type === CMD_TYPES.PATCH_WORLD) {
    if (!payload.worldId && !payload.tag) errors.push('worldId or tag required');
    if (!payload.patch || typeof payload.patch !== 'object') errors.push('World patch object required');
  }

  if (cmd.type === CMD_TYPES.SET_CONTINUITY_PATCH) {
    const idx = Number(payload.shotIndex);
    if (!Number.isFinite(idx) || idx < 0 || idx >= shots.length) errors.push('Invalid shotIndex');
    else if (isLifecycleLocked(shots[idx])) errors.push('Shot is locked — unlock before continuity patch');
    if (!payload.charKey) errors.push('charKey required');
    if (!payload.patch || typeof payload.patch !== 'object') errors.push('Continuity patch required');
  }

  if (cmd.type === CMD_TYPES.APPLY_SHOTS) {
    if (!Array.isArray(payload.shots) || !payload.shots.length) errors.push('shots[] required');
    if (!['overwrite', 'merge'].includes(payload.mode || 'overwrite')) errors.push('mode must be overwrite|merge');
  }

  return { ok: errors.length === 0, errors, projectTitle: title };
}

/**
 * Enqueue a proposal. Does not mutate Project SoT.
 */
export function proposeLlmCommand({
  type,
  projectTitle = '',
  payload = {},
  source = 'llm',
  reason = '',
  preview = ''
} = {}) {
  const title = normalizeProjectTitle(projectTitle);
  if (!isUsableProjectTitle(title)) {
    return { ok: false, error: 'Usable project title required' };
  }
  if (!Object.values(CMD_TYPES).includes(type)) {
    return { ok: false, error: `Unknown command type: ${type}` };
  }

  const cmd = {
    id: newCmdId(),
    type,
    projectTitle: title,
    payload,
    source,
    reason: clip(reason, 240),
    preview: clip(preview, 400),
    status: CMD_STATUS.PROPOSED,
    errors: [],
    actor: getActorEmail(),
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  const list = [cmd, ...readLlmCommands(title)].slice(0, MAX_PENDING);
  persistCommands(title, list);
  appendCreativeAudit({
    projectTitle: title,
    category: 'system',
    action: 'llm_propose',
    targetType: 'command',
    targetId: cmd.id,
    targetLabel: type,
    note: reason || preview
  });
  return { ok: true, command: cmd };
}

export function validateAndMarkCommand(cmdId, projectTitle, ctx = {}) {
  const title = normalizeProjectTitle(projectTitle);
  const list = readLlmCommands(title);
  const idx = list.findIndex((c) => c.id === cmdId);
  if (idx < 0) return { ok: false, error: 'Command not found' };
  const cmd = list[idx];
  const result = validateLlmCommand(cmd, { ...ctx, projectTitle: title });
  const next = {
    ...cmd,
    status: result.ok ? CMD_STATUS.VALIDATED : CMD_STATUS.FAILED,
    errors: result.errors || [],
    updatedAt: nowIso()
  };
  list[idx] = next;
  persistCommands(title, list);
  return { ok: result.ok, command: next, errors: result.errors };
}

export function approveLlmCommand(cmdId, projectTitle) {
  const title = normalizeProjectTitle(projectTitle);
  const list = readLlmCommands(title);
  const idx = list.findIndex((c) => c.id === cmdId);
  if (idx < 0) return { ok: false, error: 'Command not found' };
  const cmd = list[idx];
  if (![CMD_STATUS.PROPOSED, CMD_STATUS.VALIDATED].includes(cmd.status)) {
    return { ok: false, error: `Cannot approve from status ${cmd.status}` };
  }
  const next = { ...cmd, status: CMD_STATUS.APPROVED, updatedAt: nowIso(), approvedBy: getActorEmail() };
  list[idx] = next;
  persistCommands(title, list);
  appendCreativeAudit({
    projectTitle: title,
    category: 'system',
    action: 'llm_approve',
    targetType: 'command',
    targetId: cmd.id,
    targetLabel: cmd.type
  });
  return { ok: true, command: next };
}

export function rejectLlmCommand(cmdId, projectTitle, note = '') {
  const title = normalizeProjectTitle(projectTitle);
  const list = readLlmCommands(title);
  const idx = list.findIndex((c) => c.id === cmdId);
  if (idx < 0) return { ok: false, error: 'Command not found' };
  const next = {
    ...list[idx],
    status: CMD_STATUS.REJECTED,
    updatedAt: nowIso(),
    rejectNote: clip(note, 200)
  };
  list[idx] = next;
  persistCommands(title, list);
  appendCreativeAudit({
    projectTitle: title,
    category: 'system',
    action: 'llm_reject',
    targetType: 'command',
    targetId: next.id,
    targetLabel: next.type,
    note
  });
  return { ok: true, command: next };
}

/** Safe for unattended batch apply — excludes matrix overwrite/replace. */
export const BATCH_SAFE_CMD_TYPES = Object.freeze([
  CMD_TYPES.SET_CONTINUITY_PATCH,
  CMD_TYPES.PATCH_SHOT_CRAFT,
  CMD_TYPES.PATCH_CHARACTER,
  CMD_TYPES.PATCH_WORLD
]);

export function batchApproveLlmCommands(projectTitle, { cmdIds, types } = {}) {
  const title = normalizeProjectTitle(projectTitle);
  const list = readLlmCommands(title);
  const ids = Array.isArray(cmdIds) ? cmdIds : null;
  const typeFilter = Array.isArray(types) ? types : null;
  let approved = 0;

  list.forEach((cmd) => {
    if (![CMD_STATUS.PROPOSED, CMD_STATUS.VALIDATED].includes(cmd.status)) return;
    if (ids && !ids.includes(cmd.id)) return;
    if (typeFilter && !typeFilter.includes(cmd.type)) return;
    const result = approveLlmCommand(cmd.id, title);
    if (result.ok) approved += 1;
  });

  return { ok: true, approved };
}

/**
 * Validate → approve → apply a set of commands. Keeps a working shots copy for continuity batches.
 */
export function batchApplyLlmCommands(projectTitle, ctx = {}, mutators = {}, options = {}) {
  const title = normalizeProjectTitle(projectTitle);
  const ids = Array.isArray(options.cmdIds) ? options.cmdIds : null;
  const typeFilter = options.types === null ? null : options.types || BATCH_SAFE_CMD_TYPES;
  const approveFirst = options.approveFirst !== false;

  const list = readLlmCommands(title);
  const workingShots = [...(Array.isArray(ctx.shots) ? ctx.shots : [])];
  const localCtx = { ...ctx, projectTitle: title, shots: workingShots };
  const localMutators = {
    updateShot: (index, shot) => {
      if (index >= 0 && index < workingShots.length) workingShots[index] = shot;
      mutators.updateShot?.(index, shot);
    },
    patchCharacter: mutators.patchCharacter,
    patchWorld: mutators.patchWorld,
    applyShots: mutators.applyShots
  };

  const targets = list.filter((cmd) => {
    if ([CMD_STATUS.APPLIED, CMD_STATUS.REJECTED].includes(cmd.status)) return false;
    if (ids) return ids.includes(cmd.id);
    if (![CMD_STATUS.PROPOSED, CMD_STATUS.VALIDATED, CMD_STATUS.APPROVED].includes(cmd.status)) {
      return false;
    }
    if (typeFilter && !typeFilter.includes(cmd.type)) return false;
    return true;
  });

  let applied = 0;
  let failed = 0;
  const errors = [];

  targets.forEach((cmd) => {
    if (approveFirst && cmd.status !== CMD_STATUS.APPROVED) {
      const validated = validateAndMarkCommand(cmd.id, title, localCtx);
      if (!validated.ok) {
        failed += 1;
        errors.push(validated.errors?.join('; ') || validated.error || 'Validation failed');
        return;
      }
      approveLlmCommand(cmd.id, title);
    }
    const result = applyLlmCommand(cmd.id, title, localCtx, localMutators);
    if (result.ok) applied += 1;
    else {
      failed += 1;
      errors.push(result.error || 'Apply failed');
    }
  });

  return {
    ok: failed === 0,
    applied,
    failed,
    total: targets.length,
    errors
  };
}

/** Patch payload fields on a pending command (e.g. switch apply_shots mode). */
export function patchLlmCommandPayload(cmdId, projectTitle, payloadPatch = {}) {
  const title = normalizeProjectTitle(projectTitle);
  const list = readLlmCommands(title);
  const idx = list.findIndex((c) => c.id === cmdId);
  if (idx < 0) return { ok: false, error: 'Command not found' };
  const cmd = list[idx];
  if ([CMD_STATUS.APPLIED, CMD_STATUS.REJECTED].includes(cmd.status)) {
    return { ok: false, error: 'Command is closed' };
  }
  const payload = { ...(cmd.payload || {}), ...payloadPatch };
  const next = {
    ...cmd,
    payload,
    preview:
      cmd.type === CMD_TYPES.APPLY_SHOTS
        ? `${(payload.shots || []).length} shots · ${payload.mode || 'overwrite'}`
        : cmd.preview,
    updatedAt: nowIso()
  };
  list[idx] = next;
  persistCommands(title, list);
  return { ok: true, command: next };
}

export function describeApplyShotsCommand(cmd, ctx = {}) {
  const p = cmd?.payload || {};
  const mode = p.mode === 'merge' ? 'merge' : 'overwrite';
  const incoming = Array.isArray(p.shots) ? p.shots.length : 0;
  const existing = (Array.isArray(ctx.shots) ? ctx.shots : []).filter((s) => !s?.isArchived).length;
  return {
    mode,
    incoming,
    existing,
    totalAfter: mode === 'merge' ? existing + incoming : incoming,
    label:
      mode === 'merge'
        ? `Append ${incoming} to ${existing} existing → ${existing + incoming} total`
        : `Replace matrix with ${incoming} shots`
  };
}

/**
 * Apply an approved command. Mutators are injected so App/SoT stays the authority.
 * mutators: {
 *   updateShot(index, shot),
 *   applyShots(shots, mode, extras),
 *   patchCharacter(id, patch),
 *   patchWorld(id, patch)
 * }
 */
export function applyLlmCommand(cmdId, projectTitle, ctx = {}, mutators = {}) {
  const title = normalizeProjectTitle(projectTitle);
  const list = readLlmCommands(title);
  const idx = list.findIndex((c) => c.id === cmdId);
  if (idx < 0) return { ok: false, error: 'Command not found' };
  let cmd = list[idx];

  if (cmd.status === CMD_STATUS.PROPOSED) {
    const v = validateLlmCommand(cmd, { ...ctx, projectTitle: title });
    if (!v.ok) {
      cmd = { ...cmd, status: CMD_STATUS.FAILED, errors: v.errors, updatedAt: nowIso() };
      list[idx] = cmd;
      persistCommands(title, list);
      return { ok: false, error: v.errors.join('; '), command: cmd };
    }
    cmd = { ...cmd, status: CMD_STATUS.APPROVED, updatedAt: nowIso() };
  } else if (cmd.status !== CMD_STATUS.APPROVED && cmd.status !== CMD_STATUS.VALIDATED) {
    return { ok: false, error: `Command not approvable (${cmd.status})` };
  }

  const payload = cmd.payload || {};
  const shots = Array.isArray(ctx.shots) ? ctx.shots : [];

  const projectGate = assertProjectCanMutate(title);
  if (!projectGate.ok) {
    cmd = { ...cmd, status: CMD_STATUS.FAILED, errors: [projectGate.message], updatedAt: nowIso() };
    list[idx] = cmd;
    persistCommands(title, list);
    return { ok: false, error: projectGate.message, command: cmd };
  }

  try {
    if (cmd.type === CMD_TYPES.PATCH_SHOT_CRAFT) {
      const i = Number(payload.shotIndex);
      const prev = shots[i];
      if (!prev) throw new Error('Shot missing');
      const gate = assertCanMutateContent(prev, { projectTitle: title });
      if (!gate.ok) throw new Error(gate.message);
      const next = ensureShotSpecMeta({ ...prev, [payload.craftKey]: payload.value });
      mutators.updateShot?.(i, next);
    } else if (cmd.type === CMD_TYPES.REPLACE_SHOT) {
      const i = Number(payload.shotIndex);
      const prev = shots[i];
      if (!prev) throw new Error('Shot missing');
      const gate = assertCanMutateContent(prev, { projectTitle: title });
      if (!gate.ok) throw new Error(gate.message);
      const cleaned = { ...prev };
      SHOT_SPEC_CRAFT_KEYS.forEach((k) => {
        if (payload.shot[k] != null) cleaned[k] = payload.shot[k];
      });
      mutators.updateShot?.(
        i,
        ensureShotSpecMeta({
          ...cleaned,
          sceneShotId: prev.sceneShotId || payload.shot.sceneShotId,
          lifecycleStatus: prev.lifecycleStatus,
          generationTakes: prev.generationTakes,
          embeddedImages: prev.embeddedImages,
          embeddedVideo: prev.embeddedVideo,
          continuityPatch: prev.continuityPatch,
          charAssetIds: prev.charAssetIds,
          worldAssetIds: prev.worldAssetIds
        })
      );
    } else if (cmd.type === CMD_TYPES.SET_CONTINUITY_PATCH) {
      const i = Number(payload.shotIndex);
      const prev = shots[i];
      if (!prev) throw new Error('Shot missing');
      const gate = assertCanMutateContent(prev, { projectTitle: title });
      if (!gate.ok) throw new Error(gate.message);
      const patches = { ...(prev.continuityPatch || {}) };
      patches[payload.charKey] = { ...(patches[payload.charKey] || {}), ...payload.patch };
      mutators.updateShot?.(i, { ...prev, continuityPatch: patches });
    } else if (cmd.type === CMD_TYPES.PATCH_CHARACTER) {
      mutators.patchCharacter?.(payload.characterId || payload.tag, payload.patch);
    } else if (cmd.type === CMD_TYPES.PATCH_WORLD) {
      mutators.patchWorld?.(payload.worldId || payload.tag, payload.patch);
    } else if (cmd.type === CMD_TYPES.APPLY_SHOTS) {
      mutators.applyShots?.(payload.shots, payload.mode || 'overwrite', payload.extras || null);
    } else {
      throw new Error(`Unhandled type ${cmd.type}`);
    }

    const done = { ...cmd, status: CMD_STATUS.APPLIED, updatedAt: nowIso() };
    list[idx] = done;
    persistCommands(title, list);
    appendCreativeAudit({
      projectTitle: title,
      category: 'system',
      action: 'llm_apply',
      targetType: 'command',
      targetId: done.id,
      targetLabel: done.type
    });
    return { ok: true, command: done };
  } catch (err) {
    const failed = {
      ...cmd,
      status: CMD_STATUS.FAILED,
      errors: [err?.message || 'Apply failed'],
      updatedAt: nowIso()
    };
    list[idx] = failed;
    persistCommands(title, list);
    return { ok: false, error: err?.message || 'Apply failed', command: failed };
  }
}

/**
 * Convenience: propose + validate in one step (still no mutate until approve/apply).
 */
export function proposeAndValidate(input, ctx = {}) {
  const proposed = proposeLlmCommand(input);
  if (!proposed.ok) return proposed;
  return validateAndMarkCommand(proposed.command.id, proposed.command.projectTitle, ctx);
}

/**
 * Propose applying parsed / story-package shots (Console Apply, Writer parse, etc.).
 */
export function proposeApplyShotsCommand(
  {
    projectTitle = '',
    shots = [],
    mode = 'overwrite',
    extras = null,
    source = 'apply',
    reason = '',
    preview = ''
  } = {},
  ctx = {}
) {
  const list = Array.isArray(shots) ? shots : [];
  const m = mode === 'merge' ? 'merge' : 'overwrite';
  return proposeAndValidate(
    {
      type: CMD_TYPES.APPLY_SHOTS,
      projectTitle,
      payload: { shots: list, mode: m, extras: extras || undefined },
      source,
      reason: reason || `Apply ${list.length} shots (${m})`,
      preview: preview || `${list.length} shots · ${m}`
    },
    ctx
  );
}

export function commandSummary(cmd) {
  if (!cmd) return '';
  const p = cmd.payload || {};
  if (cmd.type === CMD_TYPES.PATCH_SHOT_CRAFT) {
    return `${p.craftKey}: ${clip(p.value, 80)}`;
  }
  if (cmd.type === CMD_TYPES.REPLACE_SHOT) {
    return `Replace shot #${Number(p.shotIndex) + 1} (${p.shot?.sceneShotId || '—'})`;
  }
  if (cmd.type === CMD_TYPES.APPLY_SHOTS) {
    return `Apply ${(p.shots || []).length} shots (${p.mode || 'overwrite'})`;
  }
  if (cmd.type === CMD_TYPES.SET_CONTINUITY_PATCH) {
    return `Shot #${Number(p.shotIndex) + 1} · ${p.charKey}: ${Object.keys(p.patch || {}).join(', ')}`;
  }
  return cmd.preview || cmd.type;
}

export const LLM_SOURCE_FILTER_ALL = 'all';

export const LLM_SOURCE_FILTER_OPTIONS = Object.freeze([
  { id: LLM_SOURCE_FILTER_ALL, label: 'All' },
  { id: 'writer', label: 'Writer' },
  { id: 'console', label: 'Console / apply' },
  { id: 'continuity', label: 'Continuity' },
  { id: 'enhance', label: 'Matrix enhance' }
]);

/** Filter pending/recent commands by propose source chip. */
export function filterLlmCommandsBySource(commands = [], filter = LLM_SOURCE_FILTER_ALL) {
  const list = Array.isArray(commands) ? commands : [];
  const f = String(filter || LLM_SOURCE_FILTER_ALL).toLowerCase();
  if (!f || f === LLM_SOURCE_FILTER_ALL) return list;
  return list.filter((cmd) => {
    const s = String(cmd.source || '').toLowerCase();
    if (f === 'writer') return s.startsWith('writer_');
    if (f === 'console') return s.startsWith('console_') || s === 'apply';
    if (f === 'continuity') return s === 'continuity_supervisor';
    if (f === 'enhance') return s.startsWith('llm_enhance');
    return s === f;
  });
}
