/**
 * P44 — Named export-audit filter presets (local device snapshot).
 */

import { EXPORT_AUDIT_FILTER_OPTIONS } from './exportGate';
import { appendCreativeAudit, resolveActiveProjectTitle } from './creativeAuditLog';

export const EXPORT_AUDIT_FILTER_PRESETS_KEY = 'sps_export_audit_filter_presets';

const BUILTIN = EXPORT_AUDIT_FILTER_OPTIONS.map((o) => ({
  id: o.id,
  label: o.label,
  filter: o.id,
  builtin: true
}));

function validFilterId(id) {
  return EXPORT_AUDIT_FILTER_OPTIONS.some((o) => o.id === id) ? id : 'all';
}

export function readExportAuditFilterPresets() {
  if (typeof window === 'undefined') {
    return { version: 1, defaultFilter: 'all', presets: BUILTIN };
  }
  try {
    const raw = localStorage.getItem(EXPORT_AUDIT_FILTER_PRESETS_KEY);
    if (!raw) return { version: 1, defaultFilter: 'all', presets: [...BUILTIN] };
    const data = JSON.parse(raw);
    const custom = Array.isArray(data.presets)
      ? data.presets
          .filter((p) => p && p.id && !BUILTIN.some((b) => b.id === p.id))
          .map((p) => ({
            id: String(p.id).slice(0, 40),
            label: String(p.label || p.id).slice(0, 60),
            filter: validFilterId(p.filter || p.id),
            builtin: false
          }))
      : [];
    return {
      version: 1,
      defaultFilter: validFilterId(data.defaultFilter || 'all'),
      presets: [...BUILTIN, ...custom]
    };
  } catch {
    return { version: 1, defaultFilter: 'all', presets: [...BUILTIN] };
  }
}

export function writeExportAuditFilterPresets(state, { projectTitle = '', audit = false } = {}) {
  if (typeof window === 'undefined') return state;
  const next = {
    version: 1,
    defaultFilter: validFilterId(state?.defaultFilter || 'all'),
    presets: (Array.isArray(state?.presets) ? state.presets : [])
      .filter((p) => p && !p.builtin)
      .map((p) => ({
        id: String(p.id).slice(0, 40),
        label: String(p.label || p.id).slice(0, 60),
        filter: validFilterId(p.filter || p.id)
      }))
  };
  try {
    localStorage.setItem(EXPORT_AUDIT_FILTER_PRESETS_KEY, JSON.stringify(next));
    window.dispatchEvent(
      new CustomEvent('sps_export_audit_filter_presets_updated', { detail: next })
    );
  } catch {
    /* ignore */
  }
  if (audit) {
    appendCreativeAudit({
      projectTitle: projectTitle || resolveActiveProjectTitle(),
      category: 'export',
      action: 'export_audit_filter_preset',
      targetType: 'export',
      targetId: 'audit_filter_presets',
      targetLabel: 'Export audit filter presets',
      note: `default:${next.defaultFilter} · custom:${next.presets.length}`
    });
  }
  return readExportAuditFilterPresets();
}

export function setExportAuditDefaultFilter(filterId, opts = {}) {
  const cur = readExportAuditFilterPresets();
  return writeExportAuditFilterPresets(
    { ...cur, defaultFilter: validFilterId(filterId) },
    { ...opts, audit: opts.audit !== false }
  );
}

export function addExportAuditFilterPreset({ id, label, filter }, opts = {}) {
  const cur = readExportAuditFilterPresets();
  const pid = String(id || `preset_${Date.now()}`).replace(/[^\w\-]+/g, '_').slice(0, 40);
  const custom = cur.presets.filter((p) => !p.builtin && p.id !== pid);
  custom.push({
    id: pid,
    label: String(label || pid).slice(0, 60),
    filter: validFilterId(filter || 'all'),
    builtin: false
  });
  return writeExportAuditFilterPresets({ ...cur, presets: custom }, { ...opts, audit: true });
}

/** Download presets JSON (builtin + custom + default). */
export function downloadExportAuditFilterPresetsJson({ projectTitle = '', audit = true } = {}) {
  const state = readExportAuditFilterPresets();
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    projectTitle: projectTitle || resolveActiveProjectTitle(),
    defaultFilter: state.defaultFilter,
    presets: state.presets.map((p) => ({
      id: p.id,
      label: p.label,
      filter: p.filter,
      builtin: Boolean(p.builtin)
    }))
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const filename = 'sps_export_audit_filter_presets.json';
  if (typeof window !== 'undefined') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
  if (audit) {
    appendCreativeAudit({
      projectTitle: projectTitle || resolveActiveProjectTitle(),
      category: 'export',
      action: 'export_audit_filter_json',
      targetType: 'export',
      targetId: 'audit_filter_presets',
      targetLabel: 'Export audit filter presets',
      note: `${payload.presets.length} presets · default:${payload.defaultFilter}`
    });
  }
  return payload;
}

/** Restore presets from exported JSON. */
export function importExportAuditFilterPresetsFromJson(input, { projectTitle = '', audit = true } = {}) {
  let data = input;
  if (typeof input === 'string') {
    try {
      data = JSON.parse(input);
    } catch {
      return { ok: false, error: 'invalid_json' };
    }
  }
  if (!data || typeof data !== 'object') return { ok: false, error: 'invalid_payload' };

  const custom = Array.isArray(data.presets)
    ? data.presets
        .filter((p) => p && p.id && !BUILTIN.some((b) => b.id === p.id))
        .map((p) => ({
          id: String(p.id).slice(0, 40),
          label: String(p.label || p.id).slice(0, 60),
          filter: validFilterId(p.filter || p.id)
        }))
    : [];

  const next = writeExportAuditFilterPresets(
    {
      defaultFilter: validFilterId(data.defaultFilter || 'all'),
      presets: custom
    },
    { projectTitle, audit: false }
  );

  if (audit) {
    appendCreativeAudit({
      projectTitle: projectTitle || resolveActiveProjectTitle(),
      category: 'export',
      action: 'export_audit_filter_import',
      targetType: 'export',
      targetId: 'audit_filter_presets',
      targetLabel: 'Export audit filter presets',
      note: `${custom.length} custom · default:${next.defaultFilter}`
    });
  }
  return { ok: true, state: next };
}
