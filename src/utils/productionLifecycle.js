/**
 * P1 — Draft → Review → Approved → Locked on shots and bible assets.
 * Locked freezes craft/bible content; media takes and lifecycle transitions still apply.
 */

import { logLifecycleAudit, getActorEmail, resolveActiveProjectTitle, appendCreativeAudit } from './creativeAuditLog';
import { assertActiveProjectForWrite } from './activeProjectGate';
import { safeLocalStorageSetItem } from './safeStorage';
import { titlesMatch } from './projectWorkspace';
import { isGuestPlayTitle } from './guestPlayground';

function normalizeTitle(title) {
  return String(title || '').trim();
}

function isUsableTitle(title) {
  const t = normalizeTitle(title);
  if (!t) return false;
  const upper = t.toUpperCase();
  if (upper === 'STAGE PRODUCTION STUDIO') return false;
  if (upper === 'UNTITLED' || upper === 'NEW CINEMA PROJECT') return false;
  return true;
}

export const LIFECYCLE_STATUSES = Object.freeze(['draft', 'review', 'approved', 'locked']);

export const LIFECYCLE_META = Object.freeze({
  draft: { label: 'Draft', short: 'Draft', next: 'review', prev: null, tone: 'muted' },
  review: { label: 'In review', short: 'Review', next: 'approved', prev: 'draft', tone: 'warn' },
  approved: { label: 'Approved', short: 'Approved', next: 'locked', prev: 'review', tone: 'ok' },
  locked: { label: 'Locked', short: 'Locked', next: null, prev: 'approved', tone: 'lock' }
});

/** Shot fields that may change while locked (media + lifecycle + soft flags). */
export const SHOT_LOCKED_MUTABLE_KEYS = Object.freeze([
  'lifecycleStatus',
  'lifecycleUpdatedAt',
  'lifecycleUpdatedBy',
  'lifecycleNote',
  'generationTakes',
  'embeddedImages',
  'embeddedVideo',
  'mutedSlots',
  'isMuted',
  'isArchived',
  'archivedAt',
  'charAssetIds',
  'worldAssetIds',
  'specVersion',
  'continuityPatch',
  'continuityStates'
]);

/** Asset fields that may change while locked. */
export const ASSET_LOCKED_MUTABLE_KEYS = Object.freeze([
  'lifecycleStatus',
  'lifecycleUpdatedAt',
  'lifecycleUpdatedBy',
  'lifecycleNote',
  'includeInPrompt'
]);

function nowIso() {
  return new Date().toISOString();
}

export function normalizeLifecycleStatus(status) {
  const s = String(status || '')
    .trim()
    .toLowerCase();
  return LIFECYCLE_STATUSES.includes(s) ? s : 'draft';
}

export function lifecycleMeta(status) {
  return LIFECYCLE_META[normalizeLifecycleStatus(status)] || LIFECYCLE_META.draft;
}

export function ensureLifecycle(entity) {
  if (!entity || typeof entity !== 'object') return entity;
  return {
    ...entity,
    lifecycleStatus: normalizeLifecycleStatus(entity.lifecycleStatus)
  };
}

export function isLifecycleLocked(entity) {
  return normalizeLifecycleStatus(entity?.lifecycleStatus) === 'locked';
}

export function canEditLifecycleContent(entity) {
  return !isLifecycleLocked(entity);
}

export function canGenerateForLifecycle(entity) {
  return !isLifecycleLocked(entity);
}

export function lifecycleSummary(list = []) {
  const counts = { draft: 0, review: 0, approved: 0, locked: 0, total: 0 };
  (Array.isArray(list) ? list : []).forEach((item) => {
    const s = normalizeLifecycleStatus(item?.lifecycleStatus);
    counts[s] += 1;
    counts.total += 1;
  });
  return counts;
}

export function advanceLifecycle(entity, { by = '', projectTitle = '' } = {}) {
  const cur = normalizeLifecycleStatus(entity?.lifecycleStatus);
  const next = LIFECYCLE_META[cur]?.next;
  if (!next) {
    return { ok: false, reason: 'terminal', message: 'Already locked.', entity: ensureLifecycle(entity) };
  }
  const updated = ensureLifecycle({
    ...entity,
    lifecycleStatus: next,
    lifecycleUpdatedAt: nowIso(),
    ...(by ? { lifecycleUpdatedBy: by } : {})
  });
  logLifecycleAudit(updated, { from: cur, to: next, action: 'advance', projectTitle });
  return { ok: true, entity: updated };
}

export function stepBackLifecycle(entity, { by = '', projectTitle = '' } = {}) {
  const cur = normalizeLifecycleStatus(entity?.lifecycleStatus);
  const prev = LIFECYCLE_META[cur]?.prev;
  if (!prev) {
    return { ok: false, reason: 'at_start', message: 'Already draft.', entity: ensureLifecycle(entity) };
  }
  const updated = ensureLifecycle({
    ...entity,
    lifecycleStatus: prev,
    lifecycleUpdatedAt: nowIso(),
    ...(by ? { lifecycleUpdatedBy: by } : {})
  });
  logLifecycleAudit(updated, { from: cur, to: prev, action: 'step_back', projectTitle });
  return { ok: true, entity: updated };
}

/** Unlock locked → approved (or reopen further via stepBack). */
export function unlockLifecycle(entity, { by = '', to = 'approved', projectTitle = '' } = {}) {
  const cur = normalizeLifecycleStatus(entity?.lifecycleStatus);
  if (cur !== 'locked') {
    return stepBackLifecycle(entity, { by, projectTitle });
  }
  const target = normalizeLifecycleStatus(to);
  const allowed = target === 'approved' || target === 'review' || target === 'draft';
  const nextStatus = allowed ? target : 'approved';
  const updated = ensureLifecycle({
    ...entity,
    lifecycleStatus: nextStatus,
    lifecycleUpdatedAt: nowIso(),
    ...(by ? { lifecycleUpdatedBy: by } : {}),
    lifecycleNote: 'Unlocked for revision'
  });
  logLifecycleAudit(updated, { from: cur, to: nextStatus, action: 'unlock', projectTitle });
  return { ok: true, entity: updated };
}

export function setLifecycleStatus(entity, status, { by = '', projectTitle = '' } = {}) {
  const cur = normalizeLifecycleStatus(entity?.lifecycleStatus);
  const next = normalizeLifecycleStatus(status);
  const updated = ensureLifecycle({
    ...entity,
    lifecycleStatus: next,
    lifecycleUpdatedAt: nowIso(),
    ...(by ? { lifecycleUpdatedBy: by } : {})
  });
  logLifecycleAudit(updated, { from: cur, to: next, action: 'set_status', projectTitle });
  return { ok: true, entity: updated };
}

/**
 * Merge an update onto a locked entity: strip content mutations, keep allowlisted keys.
 */
export function mergeRespectingLifecycleLock(prev, next, { mutableKeys = SHOT_LOCKED_MUTABLE_KEYS } = {}) {
  if (!prev || typeof prev !== 'object') {
    return { ok: true, entity: ensureLifecycle(next), stripped: false };
  }
  if (!isLifecycleLocked(prev)) {
    return { ok: true, entity: ensureLifecycle(next || prev), stripped: false };
  }
  const allow = new Set(mutableKeys);
  const merged = { ...prev };
  let stripped = false;
  Object.keys(next || {}).forEach((key) => {
    if (allow.has(key)) {
      merged[key] = next[key];
      return;
    }
    const a = prev[key];
    const b = next[key];
    const same =
      a === b ||
      (typeof a === 'object' && typeof b === 'object' && JSON.stringify(a) === JSON.stringify(b));
    if (!same) stripped = true;
  });
  return {
    ok: true,
    entity: ensureLifecycle(merged),
    stripped,
    message: stripped ? 'Shot is locked — craft edits ignored. Unlock to revise.' : ''
  };
}

export function assertCanMutateContent(entity, { projectTitle = '' } = {}) {
  const title = normalizeTitle(projectTitle || resolveActiveProjectTitle());
  if (title && isProjectLifecycleLocked(title)) {
    return {
      ok: false,
      reason: 'project_locked',
      message: 'Project is locked — unlock production to edit craft or bible fields.'
    };
  }
  if (isLifecycleLocked(entity)) {
    return {
      ok: false,
      reason: 'locked',
      message: 'Locked — unlock to edit craft or bible fields.'
    };
  }
  return { ok: true };
}

/**
 * Advance every eligible live shot one step (draft→review→approved→locked).
 * Skips already-locked rows. Respects project lock.
 */
export function bulkAdvanceShotLifecycle(shots = [], { by = '', projectTitle = '' } = {}) {
  const title = normalizeTitle(projectTitle || resolveActiveProjectTitle());
  const guestGate = assertGuestPlaygroundLifecycleGate(title);
  if (!guestGate.ok) {
    return { ok: false, reason: guestGate.reason, message: guestGate.message, shots, advanced: 0 };
  }
  const projectGate = assertProjectCanMutate(title);
  if (!projectGate.ok) {
    return { ok: false, reason: projectGate.reason, message: projectGate.message, shots, advanced: 0 };
  }
  const actor = by || getActorEmail();
  let advanced = 0;
  const next = (Array.isArray(shots) ? shots : []).map((shot) => {
    if (!shot || shot.isArchived || shot.isMuted) return shot;
    if (isLifecycleLocked(shot)) return shot;
    const result = advanceLifecycle(shot, { by: actor, projectTitle: title });
    if (result.ok) {
      advanced += 1;
      return result.entity;
    }
    return shot;
  });
  return {
    ok: true,
    shots: next,
    advanced,
    message: advanced ? `Advanced ${advanced} shot${advanced === 1 ? '' : 's'}.` : 'No shots eligible to advance.'
  };
}

/**
 * P113 — Advance only shots matching the Matrix lifecycle focus filter one step.
 * When filter has no statuses (All), advances every eligible live shot (same as bulk).
 */
export function bulkAdvanceShotLifecycleFiltered(shots = [], filter = null, { by = '', projectTitle = '' } = {}) {
  const title = normalizeTitle(projectTitle || resolveActiveProjectTitle());
  const guestGate = assertGuestPlaygroundLifecycleGate(title);
  if (!guestGate.ok) {
    return { ok: false, reason: guestGate.reason, message: guestGate.message, shots, advanced: 0 };
  }
  const projectGate = assertProjectCanMutate(title);
  if (!projectGate.ok) {
    return { ok: false, reason: projectGate.reason, message: projectGate.message, shots, advanced: 0 };
  }
  const actor = by || getActorEmail();
  const scoped = filter?.statuses?.length ? filter : null;
  let advanced = 0;
  const next = (Array.isArray(shots) ? shots : []).map((shot) => {
    if (!shot || shot.isArchived || shot.isMuted) return shot;
    if (scoped && !shotMatchesLifecycleFilter(shot, scoped)) return shot;
    if (isLifecycleLocked(shot)) return shot;
    const result = advanceLifecycle(shot, { by: actor, projectTitle: title });
    if (result.ok) {
      advanced += 1;
      return result.entity;
    }
    return shot;
  });
  return {
    ok: true,
    shots: next,
    advanced,
    message: advanced
      ? `Advanced ${advanced} visible shot${advanced === 1 ? '' : 's'}.`
      : 'No visible shots eligible to advance.'
  };
}

/** Advance Cast or World assets one lifecycle step (skips locked). */
export function bulkAdvanceAssetLifecycle(assets = [], { by = '', projectTitle = '', label = 'assets' } = {}) {
  const title = normalizeTitle(projectTitle || resolveActiveProjectTitle());
  const guestGate = assertGuestPlaygroundLifecycleGate(title);
  if (!guestGate.ok) {
    return { ok: false, reason: guestGate.reason, message: guestGate.message, assets, advanced: 0 };
  }
  const projectGate = assertProjectCanMutate(title);
  if (!projectGate.ok) {
    return { ok: false, reason: projectGate.reason, message: projectGate.message, assets, advanced: 0 };
  }
  const actor = by || getActorEmail();
  let advanced = 0;
  const next = (Array.isArray(assets) ? assets : []).map((asset) => {
    if (!asset) return asset;
    if (isLifecycleLocked(asset)) return asset;
    const result = advanceLifecycle(asset, { by: actor, projectTitle: title });
    if (result.ok) {
      advanced += 1;
      return result.entity;
    }
    return asset;
  });
  return {
    ok: true,
    assets: next,
    advanced,
    message: advanced
      ? `Advanced ${advanced} ${label}.`
      : `No ${label} eligible to advance.`
  };
}

/** Live Matrix rows eligible for export readiness checks. */
export function liveShotsForExport(shots = []) {
  return (Array.isArray(shots) ? shots : []).filter((s) => s && !s?.isArchived && !s?.isMuted);
}

/**
 * Pitch / promo / reel exports expect at least one locked look, full approved coverage, or project lock.
 */
export function lifecycleExportReadiness(shots = [], projectTitle = '') {
  const title = normalizeTitle(projectTitle);
  if (title && isProjectLifecycleLocked(title)) {
    const live = liveShotsForExport(shots);
    const shotLife = lifecycleSummary(live);
    return {
      live: live.length,
      locked: shotLife.locked,
      approved: shotLife.approved + shotLife.locked,
      exportReady: true,
      lockedRatio: live.length ? shotLife.locked / live.length : 0,
      message: '',
      projectLocked: true
    };
  }
  const live = liveShotsForExport(shots);
  let locked = 0;
  let approved = 0;
  live.forEach((s) => {
    const st = normalizeLifecycleStatus(s?.lifecycleStatus);
    if (st === 'locked') locked += 1;
    if (st === 'approved' || st === 'locked') approved += 1;
  });
  const exportReady = live.length > 0 && (locked >= 1 || approved === live.length);
  let message = '';
  if (!live.length) {
    message = 'Add live Matrix shots before sharing exports.';
  } else if (!exportReady) {
    message =
      locked === 0
        ? 'Lock look-finished shots before sharing pitch or promo exports.'
        : 'Approve or lock all live shots before sharing exports.';
  }
  return {
    live: live.length,
    locked,
    approved,
    exportReady,
    lockedRatio: live.length ? locked / live.length : 0,
    message
  };
}

export const ACTIVE_PROJECT_LIFECYCLE_KEY = 'sps_active_project_lifecycle';

function slugProjectTitle(title) {
  const s = String(title || 'untitled')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return s || 'untitled';
}

function projectLifecycleKeyForTitle(title) {
  return `sps_project_lifecycle::${slugProjectTitle(title)}`;
}

function logProjectLifecycleAudit({ from, to, action, projectTitle, note = '' }) {
  logLifecycleAudit(
    { lifecycleStatus: to, sceneShotId: projectTitle },
    { from, to, action: `project_${action}`, note, projectTitle }
  );
}

export function readProjectLifecycle(title) {
  const t = normalizeTitle(title);
  if (!t || typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(projectLifecycleKeyForTitle(t));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function readActiveProjectLifecycle() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ACTIVE_PROJECT_LIFECYCLE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getProjectLifecycle(title) {
  const t = normalizeTitle(title);
  const stored = readProjectLifecycle(t) || readActiveProjectLifecycle();
  const match =
    stored && titlesMatch(stored.projectTitle, t) ? stored : readProjectLifecycle(t);
  return {
    projectTitle: t,
    lifecycleStatus: normalizeLifecycleStatus(match?.lifecycleStatus),
    lifecycleUpdatedAt: match?.lifecycleUpdatedAt || null,
    lifecycleUpdatedBy: match?.lifecycleUpdatedBy || '',
    lifecycleNote: match?.lifecycleNote || ''
  };
}

export function saveProjectLifecycle(record, { active = true } = {}) {
  const t = normalizeTitle(record?.projectTitle);
  if (!isUsableTitle(t)) return record;
  const next = {
    ...record,
    projectTitle: t,
    lifecycleStatus: normalizeLifecycleStatus(record?.lifecycleStatus)
  };
  safeLocalStorageSetItem(projectLifecycleKeyForTitle(t), JSON.stringify(next));
  if (active) {
    safeLocalStorageSetItem(ACTIVE_PROJECT_LIFECYCLE_KEY, JSON.stringify(next));
  }
  try {
    window.dispatchEvent(
      new CustomEvent('sps_project_lifecycle_updated', { detail: { title: t } })
    );
  } catch {
    /* ignore */
  }
  return next;
}

export function isProjectLifecycleLocked(title) {
  return normalizeLifecycleStatus(getProjectLifecycle(title).lifecycleStatus) === 'locked';
}

export function assertProjectCanMutate(title) {
  if (isProjectLifecycleLocked(title)) {
    return {
      ok: false,
      reason: 'project_locked',
      message: 'Project is locked — unlock production to edit craft or bible fields.'
    };
  }
  return { ok: true };
}

export function canGenerateForProject(title) {
  return !isProjectLifecycleLocked(title);
}

export const GUEST_PLAY_LIFECYCLE_MESSAGE =
  'Guest playground — project lifecycle is disabled. Sign in to lock a real production.';

function assertGuestPlaygroundLifecycleGate(title) {
  if (isGuestPlayTitle(title)) {
    return { ok: false, reason: 'guest_playground', message: GUEST_PLAY_LIFECYCLE_MESSAGE };
  }
  return { ok: true };
}

export function advanceProjectLifecycle(projectTitle, { by = '' } = {}) {
  const title = normalizeTitle(projectTitle);
  const guestGate = assertGuestPlaygroundLifecycleGate(title);
  if (!guestGate.ok) {
    return { ok: false, reason: guestGate.reason, message: guestGate.message, record: getProjectLifecycle(title) };
  }
  const rec = getProjectLifecycle(projectTitle);
  const cur = rec.lifecycleStatus;
  const next = LIFECYCLE_META[cur]?.next;
  if (!next) {
    return { ok: false, reason: 'terminal', message: 'Project already locked.', record: rec };
  }
  const actor = by || getActorEmail();
  const updated = saveProjectLifecycle({
    ...rec,
    lifecycleStatus: next,
    lifecycleUpdatedAt: nowIso(),
    ...(actor ? { lifecycleUpdatedBy: actor } : {})
  });
  logProjectLifecycleAudit({ from: cur, to: next, action: 'advance', projectTitle: rec.projectTitle });
  return { ok: true, record: updated };
}

export function stepBackProjectLifecycle(projectTitle, { by = '' } = {}) {
  const title = normalizeTitle(projectTitle);
  const guestGate = assertGuestPlaygroundLifecycleGate(title);
  if (!guestGate.ok) {
    return { ok: false, reason: guestGate.reason, message: guestGate.message, record: getProjectLifecycle(title) };
  }
  const rec = getProjectLifecycle(projectTitle);
  const cur = rec.lifecycleStatus;
  const prev = LIFECYCLE_META[cur]?.prev;
  if (!prev) {
    return { ok: false, reason: 'at_start', message: 'Project already draft.', record: rec };
  }
  const actor = by || getActorEmail();
  const updated = saveProjectLifecycle({
    ...rec,
    lifecycleStatus: prev,
    lifecycleUpdatedAt: nowIso(),
    ...(actor ? { lifecycleUpdatedBy: actor } : {})
  });
  logProjectLifecycleAudit({ from: cur, to: prev, action: 'step_back', projectTitle: rec.projectTitle });
  return { ok: true, record: updated };
}

export function unlockProjectLifecycle(projectTitle, { by = '', to = 'approved' } = {}) {
  const title = normalizeTitle(projectTitle);
  const guestGate = assertGuestPlaygroundLifecycleGate(title);
  if (!guestGate.ok) {
    return { ok: false, reason: guestGate.reason, message: guestGate.message, record: getProjectLifecycle(title) };
  }
  const rec = getProjectLifecycle(projectTitle);
  const cur = rec.lifecycleStatus;
  if (cur !== 'locked') {
    return stepBackProjectLifecycle(projectTitle, { by });
  }
  const target = normalizeLifecycleStatus(to);
  const allowed = target === 'approved' || target === 'review' || target === 'draft';
  const nextStatus = allowed ? target : 'approved';
  const actor = by || getActorEmail();
  const updated = saveProjectLifecycle({
    ...rec,
    lifecycleStatus: nextStatus,
    lifecycleUpdatedAt: nowIso(),
    ...(actor ? { lifecycleUpdatedBy: actor } : {}),
    lifecycleNote: 'Production unlocked for revision'
  });
  logProjectLifecycleAudit({
    from: cur,
    to: nextStatus,
    action: 'unlock',
    projectTitle: rec.projectTitle,
    note: 'Production unlocked'
  });
  return { ok: true, record: updated };
}

export function applyOpenProjectLifecycle(project) {
  if (typeof window === 'undefined' || !project?.title) return;
  const stored =
    project.projectLifecycle && project.projectLifecycle.projectTitle
      ? project.projectLifecycle
      : readProjectLifecycle(project.title);
  if (stored?.projectTitle) {
    saveProjectLifecycle(stored, { active: true });
    return;
  }
  saveProjectLifecycle(getProjectLifecycle(project.title), { active: true });
}

export function parkProjectLifecycleForTitle(title) {
  if (typeof window === 'undefined') return;
  const t = normalizeTitle(title);
  if (!t) return;
  const active = readActiveProjectLifecycle();
  if (active && titlesMatch(active.projectTitle, t)) {
    saveProjectLifecycle(active, { active: false });
  }
}

/**
 * Active title + title match + project lifecycle lock (parse / apply / matrix writes).
 */
export function assertProjectWriteGate(
  activeTitle,
  { intendedTitle = '', auditLabel = '', audit = true } = {}
) {
  const activeGate = assertActiveProjectForWrite(activeTitle, { intendedTitle });
  if (!activeGate.ok) return activeGate;

  const title = normalizeTitle(activeTitle);
  const lockGate = assertProjectCanMutate(title);
  if (!lockGate.ok) {
    if (audit) {
      appendCreativeAudit({
        projectTitle: title,
        category: 'apply',
        action: 'write_blocked',
        targetType: 'project',
        targetId: auditLabel || 'project_write',
        targetLabel: auditLabel || 'Project write',
        note: lockGate.message
      });
    }
    return { ok: false, code: 'PROJECT_LOCKED', message: lockGate.message };
  }
  return { ok: true };
}

/** P112 — Matrix lifecycle focus filter (pitch deep-link + Matrix chips). */
export const MATRIX_LIFECYCLE_FILTER_KEY = 'sps_matrix_lifecycle_filter';
export const MATRIX_LIFECYCLE_FILTER_EVENT = 'sps_open_matrix_lifecycle_filter';
export const STUDIO_NAVIGATE_EVENT = 'sps_navigate_studio';

export const MATRIX_LIFECYCLE_FILTER_OPTIONS = Object.freeze([
  { id: 'all', label: 'All life', statuses: null },
  { id: 'needs_approve', label: 'Needs approve', statuses: ['draft', 'review'] },
  { id: 'draft', label: 'Draft', statuses: ['draft'] },
  { id: 'review', label: 'Review', statuses: ['review'] },
  { id: 'approved', label: 'Approved', statuses: ['approved'] },
  { id: 'locked', label: 'Locked', statuses: ['locked'] }
]);

export function readMatrixLifecycleFilter() {
  if (typeof window === 'undefined') return { id: 'all', statuses: null };
  try {
    const raw = JSON.parse(localStorage.getItem(MATRIX_LIFECYCLE_FILTER_KEY) || 'null');
    if (!raw || !Array.isArray(raw.statuses) || !raw.statuses.length) {
      return { id: 'all', statuses: null };
    }
    return {
      id: String(raw.id || 'custom'),
      statuses: raw.statuses.map((s) => normalizeLifecycleStatus(s)),
      source: raw.source || ''
    };
  } catch {
    return { id: 'all', statuses: null };
  }
}

export function setMatrixLifecycleFilter({ id = 'all', statuses = null, source = '' } = {}) {
  const payload =
    !statuses || !statuses.length
      ? { id: 'all', statuses: null, source, at: Date.now() }
      : {
          id: String(id || 'custom'),
          statuses: statuses.map((s) => normalizeLifecycleStatus(s)),
          source,
          at: Date.now()
        };
  try {
    if (!payload.statuses) localStorage.removeItem(MATRIX_LIFECYCLE_FILTER_KEY);
    else localStorage.setItem(MATRIX_LIFECYCLE_FILTER_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(MATRIX_LIFECYCLE_FILTER_EVENT, { detail: payload }));
  }
  return payload;
}

/** Pitch → Matrix: open spreadsheet focused on draft/review beats needing approve. */
export function openMatrixLifecycleFilter({
  statuses = ['draft', 'review'],
  id = 'needs_approve',
  source = 'pitch'
} = {}) {
  const payload = setMatrixLifecycleFilter({ id, statuses, source });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(STUDIO_NAVIGATE_EVENT, { detail: { view: 'spreadsheet', source } })
    );
    const label =
      MATRIX_LIFECYCLE_FILTER_OPTIONS.find((o) => o.id === id)?.label || 'Life filter';
    try {
      window.dispatchEvent(
        new CustomEvent('sps_toast', {
          detail: { message: `Matrix Life: ${label} (from Pitch)` }
        })
      );
    } catch {
      /* ignore */
    }
  }
  return payload;
}

export function shotMatchesLifecycleFilter(shot, filter) {
  if (!filter?.statuses?.length) return true;
  if (!shot || shot.isArchived) return false;
  const life = normalizeLifecycleStatus(shot.lifecycleStatus);
  return filter.statuses.includes(life);
}
