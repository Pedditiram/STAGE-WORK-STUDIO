/**
 * P8/P9 — Export gate + creative audit trail for all production exports.
 */

import { normalizeProjectTitle } from './activeProjectGate';
import { appendCreativeAudit, readCreativeAuditLog, resolveActiveProjectTitle, getActorEmail } from './creativeAuditLog';
import { lifecycleExportReadiness, getProjectLifecycle } from './productionLifecycle';
import { assertCanExport, canUseSaasFeature } from './saasControl';
import { downloadTextFile } from './screenplayInterop';

export const EXPORT_LIFECYCLE = Object.freeze({
  NONE: 'none',
  ADVISORY: 'advisory',
  STRICT: 'strict'
});

export const EXPORT_AUDIT_FILTER_OPTIONS = Object.freeze([
  { id: 'all', label: 'All' },
  { id: 'ok', label: 'OK' },
  { id: 'blocked', label: 'Blocked' },
  { id: 'lifecycle', label: 'Lifecycle' },
  { id: 'room', label: 'Room' }
]);

export function filterExportAuditRows(rows = [], filter = 'all') {
  const list = Array.isArray(rows) ? rows : [];
  const f = String(filter || 'all').toLowerCase();
  if (f === 'ok') return list.filter((r) => r.action === 'export_ok');
  if (f === 'blocked') return list.filter((r) => r.action === 'export_blocked');
  if (f === 'lifecycle') return list.filter((r) => String(r.note || '').includes('life:'));
  if (f === 'room') {
    return list.filter((r) => {
      const note = String(r.note || '');
      const id = String(r.targetId || r.targetLabel || '');
      return note.includes('room:') || id.includes('presence') || note.includes('presence');
    });
  }
  return list;
}

export function resolveCollabRoomId(fallback = '') {
  if (typeof window === 'undefined') return String(fallback || '').trim();
  return String(
    fallback ||
      localStorage.getItem('sps_current_room_id') ||
      localStorage.getItem('sps_cloud_room_id') ||
      ''
  ).trim();
}

function exportAuditNote(parts = [], roomId = '') {
  const room = String(roomId || '').trim();
  const base = parts.filter(Boolean).join(' · ');
  if (!room) return base;
  return base ? `${base} · room:${room}` : `room:${room}`;
}

function checkLifecycleExport(shots, mode, showAlert, projectTitle = '') {
  if (mode === EXPORT_LIFECYCLE.NONE) return { ok: true };
  const ready = lifecycleExportReadiness(shots, projectTitle);
  if (ready.exportReady) return { ok: true, lifecycle: ready };

  if (mode === EXPORT_LIFECYCLE.ADVISORY) {
    if (showAlert && typeof window !== 'undefined') {
      const go = window.confirm(`${ready.message}\n\nExport anyway?`);
      if (!go) {
        return { ok: false, reason: 'lifecycle_advisory', message: ready.message, lifecycle: ready };
      }
    }
    return { ok: true, advisory: true, lifecycle: ready };
  }

  return { ok: false, reason: 'lifecycle_strict', message: ready.message, lifecycle: ready };
}

export function assertExportAllowed({
  email = '',
  projectTitle = '',
  label = 'export',
  format = '',
  showAlert = true,
  lifecycleMode = EXPORT_LIFECYCLE.NONE,
  shots = [],
  roomId = ''
} = {}) {
  const title = normalizeProjectTitle(projectTitle || resolveActiveProjectTitle());
  const collabRoomId = resolveCollabRoomId(roomId);
  const gate = assertCanExport(email);

  if (!gate.ok) {
    appendCreativeAudit({
      projectTitle: title,
      category: 'export',
      action: 'export_blocked',
      targetType: 'export',
      targetId: label,
      targetLabel: label,
      note: exportAuditNote([format, gate.message, lifecycleMode !== EXPORT_LIFECYCLE.NONE ? `life:${lifecycleMode}` : ''], collabRoomId)
    });
    if (showAlert && typeof window !== 'undefined') {
      window.alert(gate.message);
    }
    return gate;
  }

  const life = checkLifecycleExport(shots, lifecycleMode, showAlert, title);
  if (!life.ok) {
    appendCreativeAudit({
      projectTitle: title,
      category: 'export',
      action: 'export_blocked',
      targetType: 'export',
      targetId: label,
      targetLabel: label,
      note: exportAuditNote([format, life.message, life.reason, `life:${lifecycleMode}`], collabRoomId)
    });
    if (showAlert && typeof window !== 'undefined') {
      window.alert(life.message);
    }
    return life;
  }

  return {
    ok: true,
    projectTitle: title,
    lifecycle: life.lifecycle,
    collabRoomId,
    lifecycleMode,
    advisory: Boolean(life.advisory)
  };
}

export function logExportSuccess({
  projectTitle = '',
  label = 'export',
  format = '',
  filename = '',
  note = '',
  roomId = '',
  lifecycleMode = ''
} = {}) {
  const title = normalizeProjectTitle(projectTitle || resolveActiveProjectTitle());
  const collabRoomId = resolveCollabRoomId(roomId);
  if (collabRoomId && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem('sps_last_export_room_id', collabRoomId);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('sps_last_export_room_updated', { detail: { roomId: collabRoomId } })
        );
      }
    } catch {
      /* ignore */
    }
  }
  return appendCreativeAudit({
    projectTitle: title,
    category: 'export',
    action: 'export_ok',
    targetType: 'export',
    targetId: label,
    targetLabel: label,
    note: exportAuditNote(
      [format, filename, note, lifecycleMode ? `life:${lifecycleMode}` : ''],
      collabRoomId
    ).slice(0, 320)
  });
}

/** Last room id stamped on a successful export (hub badge). */
export function readLastExportRoomId() {
  if (typeof localStorage === 'undefined') return '';
  try {
    return String(localStorage.getItem('sps_last_export_room_id') || '').trim();
  } catch {
    return '';
  }
}

export function exportDownloadText(filename, contents, opts = {}) {
  const lifecycleMode = opts.lifecycleMode || EXPORT_LIFECYCLE.NONE;
  const gate = assertExportAllowed({
    projectTitle: opts.projectTitle,
    label: opts.auditLabel || 'text_export',
    format: opts.auditFormat || (String(filename || '').split('.').pop() || 'txt'),
    showAlert: opts.showAlert !== false,
    lifecycleMode,
    shots: opts.shots || [],
    roomId: opts.roomId || ''
  });
  if (!gate.ok) return { ok: false, blocked: true, error: gate.message };
  downloadTextFile(filename, contents, opts.mime || 'text/plain;charset=utf-8');
  logExportSuccess({
    projectTitle: opts.projectTitle,
    label: opts.auditLabel || 'text_export',
    format: opts.auditFormat || (String(filename || '').split('.').pop() || 'txt'),
    filename,
    note: opts.note || '',
    roomId: opts.roomId || '',
    lifecycleMode: gate.advisory ? `${lifecycleMode}+ok` : lifecycleMode
  });
  return { ok: true, advisory: Boolean(gate.advisory) };
}

function slugExportTitle(title) {
  return String(title || 'project')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || 'project';
}

/** Export-category rows only — for Project Console / dashboard handoff. */
export function exportExportAuditJson(title = '', opts = {}) {
  const t = normalizeProjectTitle(title || resolveActiveProjectTitle());
  const lifecycleMode = opts.lifecycleMode || EXPORT_LIFECYCLE.NONE;
  const gate = assertExportAllowed({
    projectTitle: t,
    label: 'export_audit_json',
    format: 'json',
    lifecycleMode,
    shots: opts.shots || [],
    showAlert: opts.showAlert !== false,
    roomId: opts.roomId || ''
  });
  if (!gate.ok) return { ok: false, blocked: true, error: gate.message };

  const rows = readCreativeAuditLog(t).filter((r) => r.category === 'export');
  const filename = `${slugExportTitle(t)}_export_audit.json`;
  downloadTextFile(filename, JSON.stringify(rows, null, 2), 'application/json;charset=utf-8');
  logExportSuccess({
    projectTitle: t,
    label: 'export_audit_json',
    format: 'json',
    filename,
    note: `${rows.length} rows · export-only`,
    roomId: opts.roomId || '',
    lifecycleMode: gate.advisory ? `${lifecycleMode}+ok` : lifecycleMode
  });
  return { ok: true, advisory: Boolean(gate.advisory), count: rows.length };
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

/** Export-category rows as CSV — respects same filters as Console/Dashboard chips. */
export function exportExportAuditCsv(title = '', opts = {}) {
  const t = normalizeProjectTitle(title || resolveActiveProjectTitle());
  const lifecycleMode = opts.lifecycleMode || EXPORT_LIFECYCLE.NONE;
  const filter = opts.filter || 'all';
  const gate = assertExportAllowed({
    projectTitle: t,
    label: 'export_audit_csv',
    format: 'csv',
    lifecycleMode,
    shots: opts.shots || [],
    showAlert: opts.showAlert !== false,
    roomId: opts.roomId || ''
  });
  if (!gate.ok) return { ok: false, blocked: true, error: gate.message };

  const rows = filterExportAuditRows(
    readCreativeAuditLog(t).filter((r) => r.category === 'export'),
    filter
  );
  const headers = [
    'at',
    'action',
    'actor',
    'targetType',
    'targetId',
    'targetLabel',
    'from',
    'to',
    'note',
    'projectTitle'
  ];
  const lines = [
    headers.map(csvCell).join(','),
    ...rows.map((r) =>
      headers.map((h) => csvCell(r[h] ?? '')).join(',')
    )
  ];
  const filterSlug = filter && filter !== 'all' ? `_${filter}` : '';
  const filename = `${slugExportTitle(t)}_export_audit${filterSlug}.csv`;
  downloadTextFile(filename, lines.join('\n'), 'text/csv;charset=utf-8');
  logExportSuccess({
    projectTitle: t,
    label: 'export_audit_csv',
    format: 'csv',
    filename,
    note: `${rows.length} rows · filter:${filter} · export-only`,
    roomId: opts.roomId || '',
    lifecycleMode: gate.advisory ? `${lifecycleMode}+ok` : lifecycleMode
  });
  return { ok: true, advisory: Boolean(gate.advisory), count: rows.length, filter };
}

export function exportAuditSummary(title = '', shots = [], roomId = '', opts = {}) {
  const t = normalizeProjectTitle(title);
  const collabRoomId = resolveCollabRoomId(roomId);
  const filter = opts.filter || 'all';
  const limit = Number(opts.limit) > 0 ? Number(opts.limit) : 8;
  const rows = readCreativeAuditLog(t).filter((r) => r.category === 'export');
  const filtered = filterExportAuditRows(rows, filter);
  let ok = 0;
  let blocked = 0;
  let roomTagged = 0;
  let lifecycleTagged = 0;
  rows.forEach((r) => {
    if (r.action === 'export_blocked') blocked += 1;
    else if (r.action === 'export_ok') ok += 1;
    const note = String(r.note || '');
    if (note.includes('room:')) roomTagged += 1;
    if (note.includes('life:')) lifecycleTagged += 1;
  });
  const lifecycle = lifecycleExportReadiness(shots, t);
  const projectLifecycle = getProjectLifecycle(t);
  return {
    ok,
    blocked,
    total: rows.length,
    filteredTotal: filtered.length,
    filter,
    recent: filtered.slice(0, limit),
    entitled: canUseSaasFeature('export', getActorEmail()),
    lifecycle,
    projectLifecycle,
    collabRoomId,
    roomTagged,
    lifecycleTagged
  };
}
