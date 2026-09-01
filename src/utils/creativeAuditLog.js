/**
 * P1 — Creative decision audit log (per project title).
 * Tracks lifecycle, generate, apply, and blocked edits — separate from admin login activity.
 */

import { isUsableProjectTitle, normalizeProjectTitle } from './activeProjectGate';
import { safeLocalStorageSetItem } from './safeStorage';
import { assertCanExport } from './saasControl';

export const AUDIT_CATEGORIES = Object.freeze([
  'lifecycle',
  'shot',
  'asset',
  'generate',
  'apply',
  'export',
  'collab',
  'system'
]);

export const AUDIT_FILTER_ALL = 'all';

export const AUDIT_FILTER_OPTIONS = Object.freeze([
  { id: AUDIT_FILTER_ALL, label: 'All' },
  { id: 'lifecycle', label: 'Lifecycle' },
  { id: 'generate', label: 'Generate' },
  { id: 'apply', label: 'Write / apply' },
  { id: 'export', label: 'Export' },
  { id: 'collab', label: 'Collab' }
]);

/** Filter audit rows by category chip (apply chip also matches shot/asset lifecycle rows). */
export function filterCreativeAudit(rows = [], filter = AUDIT_FILTER_ALL) {
  const list = Array.isArray(rows) ? rows : [];
  const f = String(filter || AUDIT_FILTER_ALL).toLowerCase();
  if (!f || f === AUDIT_FILTER_ALL) return list;
  if (f === 'lifecycle') {
    return list.filter((r) => r.category === 'lifecycle' || r.category === 'shot' || r.category === 'asset');
  }
  if (f === 'apply') return list.filter((r) => r.category === 'apply');
  if (f === 'collab') return list.filter((r) => r.category === 'collab');
  return list.filter((r) => r.category === f);
}

const MAX_ENTRIES = 400;

function slugProjectTitle(title) {
  const s = String(title || 'untitled')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return s || 'untitled';
}

function auditKeyForTitle(title) {
  return `sps_creative_audit::${slugProjectTitle(title)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function newAuditId() {
  return `aud_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function resolveActiveProjectTitle(fallback = '') {
  if (typeof window === 'undefined') return normalizeProjectTitle(fallback);
  const raw =
    fallback ||
    localStorage.getItem('sps_current_project_title') ||
    localStorage.getItem('sps_active_project_title') ||
    localStorage.getItem('sps_project_title') ||
    '';
  return normalizeProjectTitle(raw);
}

export function getActorEmail() {
  if (typeof window === 'undefined') return 'local';
  const email = String(localStorage.getItem('sps_authorized_user_email') || '').trim().toLowerCase();
  if (!email || email === 'guest' || email === 'click to login' || email === 'unauthenticated') {
    return 'local';
  }
  return email;
}

export function inferAuditTarget(entity = {}) {
  if (entity?.sceneShotId) {
    return { targetType: 'shot', targetId: String(entity.sceneShotId), targetLabel: String(entity.sceneShotId) };
  }
  if (entity?.assetId && /^CHAR_/i.test(entity.assetId)) {
    return {
      targetType: 'character',
      targetId: entity.assetId,
      targetLabel: entity.tag || entity.name || entity.assetId
    };
  }
  if (entity?.assetId && /^WORLD_/i.test(entity.assetId)) {
    return {
      targetType: 'world',
      targetId: entity.assetId,
      targetLabel: entity.tag || entity.name || entity.assetId
    };
  }
  if (entity?.type && (entity?.tag || entity?.name)) {
    return {
      targetType: 'world',
      targetId: entity.id || entity.tag || entity.name,
      targetLabel: entity.tag || entity.name || entity.id
    };
  }
  if (entity?.tag || entity?.name) {
    return {
      targetType: 'character',
      targetId: entity.id || entity.tag || entity.name,
      targetLabel: entity.tag || entity.name || entity.id
    };
  }
  return { targetType: 'asset', targetId: String(entity?.id || ''), targetLabel: String(entity?.id || 'unknown') };
}

export function readCreativeAuditLog(title) {
  if (typeof window === 'undefined') return [];
  const t = normalizeProjectTitle(title);
  if (!t) return [];
  try {
    const raw = localStorage.getItem(auditKeyForTitle(t));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function creativeAuditSummary(title = '', { filter = AUDIT_FILTER_ALL, limit = 12 } = {}) {
  const rows = readCreativeAuditLog(title);
  const filtered = filterCreativeAudit(rows, filter);
  return {
    total: rows.length,
    filtered: filtered.length,
    filter,
    recent: filtered.slice(0, limit)
  };
}

function persistAuditLog(title, entries) {
  const t = normalizeProjectTitle(title);
  if (!isUsableProjectTitle(t)) return entries;
  const trimmed = (Array.isArray(entries) ? entries : []).slice(0, MAX_ENTRIES);
  try {
    safeLocalStorageSetItem(auditKeyForTitle(t), JSON.stringify(trimmed));
    window.dispatchEvent(
      new CustomEvent('sps_creative_audit_updated', { detail: { title: t, count: trimmed.length } })
    );
  } catch {
    /* ignore */
  }
  return trimmed;
}

export function appendCreativeAudit(entry = {}) {
  const projectTitle = normalizeProjectTitle(entry.projectTitle || resolveActiveProjectTitle());
  if (!isUsableProjectTitle(projectTitle)) return null;

  const row = {
    id: entry.id || newAuditId(),
    at: entry.at || nowIso(),
    projectTitle,
    actor: entry.actor || getActorEmail(),
    category: AUDIT_CATEGORIES.includes(entry.category) ? entry.category : 'system',
    action: String(entry.action || 'note').slice(0, 80),
    targetType: entry.targetType || 'project',
    targetId: String(entry.targetId || '').slice(0, 120),
    targetLabel: String(entry.targetLabel || entry.targetId || '').slice(0, 160),
    from: entry.from != null ? String(entry.from) : '',
    to: entry.to != null ? String(entry.to) : '',
    note: String(entry.note || '').slice(0, 320)
  };

  const prev = readCreativeAuditLog(projectTitle);
  const next = [row, ...prev].slice(0, MAX_ENTRIES);
  persistAuditLog(projectTitle, next);
  return row;
}

export function logLifecycleAudit(entity, { from, to, action = 'lifecycle', note = '', projectTitle = '' } = {}) {
  const target = inferAuditTarget(entity);
  return appendCreativeAudit({
    projectTitle,
    category: 'lifecycle',
    action,
    ...target,
    from,
    to,
    note
  });
}

export function exportCreativeAuditJson(title) {
  const t = normalizeProjectTitle(title);
  const gate = assertCanExport();
  if (!gate.ok) {
    appendCreativeAudit({
      projectTitle: t,
      category: 'export',
      action: 'export_blocked',
      targetType: 'export',
      targetId: 'creative_audit_json',
      targetLabel: 'creative_audit_json',
      note: gate.message
    });
    if (typeof window !== 'undefined') window.alert(gate.message);
    return false;
  }
  const rows = readCreativeAuditLog(t);
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
  const filename = `${slugProjectTitle(t)}_creative_audit.json`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  appendCreativeAudit({
    projectTitle: t,
    category: 'export',
    action: 'export_ok',
    targetType: 'export',
    targetId: 'creative_audit_json',
    targetLabel: 'creative_audit_json',
    note: `${rows.length} rows · json`
  });
  return true;
}

/** P13 — Write gate audit (project lock / parse / apply blocks). */

function csvEscapeAudit(v) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

/** Craft CSV for creative audit rows (Studio Brain / Project Console). */
export function creativeAuditToCsv(rows = [], { projectTitle = '', roomId = '', filter = 'all' } = {}) {
  const list = filterCreativeAudit(rows, filter);
  const headers = ['#', 'At', 'Actor', 'Category', 'Action', 'TargetType', 'TargetId', 'TargetLabel', 'Note', 'Project', 'Room', 'Filter'];
  const room = String(roomId || '').trim();
  const title = String(projectTitle || '').trim();
  const f = String(filter || 'all');
  const body = list.map((r, idx) =>
    [
      idx + 1,
      r?.at || '',
      r?.actor || '',
      r?.category || '',
      r?.action || '',
      r?.targetType || '',
      r?.targetId || '',
      r?.targetLabel || '',
      r?.note || '',
      title || r?.projectTitle || '',
      room,
      f
    ]
      .map(csvEscapeAudit)
      .join(',')
  );
  return [headers.map(csvEscapeAudit).join(','), ...body].join('\n');
}

/** Download creative audit CSV for a project (gate + audit stamp). */
export function exportCreativeAuditCsv(title, { filter = 'all', roomId = '' } = {}) {
  const t = normalizeProjectTitle(title);
  const gate = assertCanExport();
  if (!gate.ok) {
    appendCreativeAudit({
      projectTitle: t,
      category: 'export',
      action: 'export_blocked',
      targetType: 'export',
      targetId: 'creative_audit_csv',
      targetLabel: 'creative_audit_csv',
      note: gate.message
    });
    if (typeof window !== 'undefined') window.alert(gate.message);
    return false;
  }
  const rows = readCreativeAuditLog(t);
  const room = String(roomId || '').trim();
  const csv = creativeAuditToCsv(rows, { projectTitle: t, roomId: room, filter });
  const filterTag = filter && filter !== 'all' ? `_${filter}` : '';
  const filename = `${slugProjectTitle(t)}_creative_audit${filterTag}.csv`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  const filtered = filterCreativeAudit(rows, filter);
  appendCreativeAudit({
    projectTitle: t,
    category: 'export',
    action: 'export_ok',
    targetType: 'export',
    targetId: 'creative_audit_csv',
    targetLabel: 'creative_audit_csv',
    note: `${filtered.length} rows · csv · filter:${filter || 'all'}${room ? ` · room:${room}` : ''}`
  });
  return true;
}

export function writeAuditSummary(title = '') {
  const t = normalizeProjectTitle(title);
  const rows = readCreativeAuditLog(t).filter((r) => r.category === 'apply');
  let blocked = 0;
  rows.forEach((r) => {
    if (r.action === 'write_blocked') blocked += 1;
  });
  const blockedRows = rows.filter((r) => r.action === 'write_blocked');
  return {
    blocked,
    total: rows.length,
    recent: blockedRows.slice(0, 8),
    projectLocked: blockedRows.some((r) => String(r.note || '').includes('Project is locked'))
  };
}

export function clearCreativeAuditLog(title) {
  const t = normalizeProjectTitle(title);
  if (!t) return;
  persistAuditLog(t, []);
}
