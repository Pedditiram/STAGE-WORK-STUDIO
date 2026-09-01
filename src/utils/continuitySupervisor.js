/**
 * P3 — Continuity supervisor: scan drift, propose patches via command bus (no silent SoT write).
 */

import { resolveContinuityForShot } from './continuityState';
import { CMD_TYPES, batchApplyLlmCommands, proposeAndValidate } from './llmCommandBus';

export function buildContinuityFixesForShot(shot, shots, shotIndex) {
  if (!shot || shot.isArchived || shot.isMuted) return [];
  const { entries } = resolveContinuityForShot({ shot, shots, shotIndex });
  return entries
    .filter((e) => e.implicitChange && e.deltas.length)
    .map((e) => ({
      shotIndex,
      sceneShotId: shot.sceneShotId || `SH_${shotIndex + 1}`,
      charKey: e.key,
      name: e.name || e.tag || e.key,
      deltas: e.deltas,
      patch: Object.fromEntries(e.deltas.map((field) => [field, e.state[field]]))
    }));
}

export function scanContinuityDrift(shots = []) {
  const list = Array.isArray(shots) ? shots : [];
  const issues = [];
  list.forEach((shot, i) => {
    buildContinuityFixesForShot(shot, list, i).forEach((fix) => issues.push(fix));
  });
  return issues;
}

export function continuityDriftSummary(shots = []) {
  const issues = scanContinuityDrift(shots);
  const shotIds = new Set(issues.map((i) => i.shotIndex));
  return {
    count: issues.length,
    shotCount: shotIds.size,
    preview: issues.slice(0, 10)
  };
}

/**
 * Enqueue SET_CONTINUITY_PATCH proposals for every drift row (review before apply).
 */
export function proposeContinuityDriftFixes(projectTitle = '', shots = []) {
  const issues = scanContinuityDrift(shots);
  const proposals = [];
  const skipped = [];

  issues.forEach((fix) => {
    const proposed = proposeAndValidate(
      {
        type: CMD_TYPES.SET_CONTINUITY_PATCH,
        projectTitle,
        payload: {
          shotIndex: fix.shotIndex,
          charKey: fix.charKey,
          patch: fix.patch
        },
        source: 'continuity_supervisor',
        reason: `Document ${fix.name} at ${fix.sceneShotId}`,
        preview: `${fix.sceneShotId} · ${fix.name}: ${fix.deltas.join(', ')}`
      },
      { shots, projectTitle }
    );
    if (proposed.ok) proposals.push(proposed);
    else skipped.push({ fix, error: proposed.error || proposed.errors?.join('; ') });
  });

  return { issues, proposals, skipped };
}

/**
 * Propose continuity patches then approve + apply in one pass (command bus, no silent SoT).
 */
export function applyContinuityDriftFixes(projectTitle = '', shots = [], mutators = {}, ctx = {}) {
  const { issues, proposals, skipped } = proposeContinuityDriftFixes(projectTitle, shots);
  if (!proposals.length) {
    const msg = skipped.length
      ? skipped.map((s) => s.error).filter(Boolean).join('; ')
      : 'No continuity drift to document.';
    return { ok: false, applied: 0, proposed: 0, message: msg, issues, skipped };
  }
  const cmdIds = proposals.map((p) => p.command?.id).filter(Boolean);
  const result = batchApplyLlmCommands(
    projectTitle,
    { shots, projectTitle, ...ctx },
    mutators,
    { cmdIds, types: [CMD_TYPES.SET_CONTINUITY_PATCH] }
  );
  return {
    ...result,
    proposed: proposals.length,
    issues,
    skipped,
    message: result.applied
      ? `Applied ${result.applied} continuity patch${result.applied === 1 ? '' : 'es'}.`
      : result.errors?.[0] || 'No patches applied.'
  };
}
