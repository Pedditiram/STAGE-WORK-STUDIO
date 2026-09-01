/**
 * P31 — Central export lifecycle prefs (Advise vs Strict) across studio surfaces.
 */

import { EXPORT_LIFECYCLE } from './exportGate';
import { appendCreativeAudit, resolveActiveProjectTitle } from './creativeAuditLog';

export const EXPORT_LIFECYCLE_PREF_DEFS = Object.freeze([
  { id: 'writer', key: 'sps_writer_export_lifecycle', label: 'Writer', defaultStrict: true },
  { id: 'matrix', key: 'sps_matrix_export_lifecycle', label: 'Matrix CSV', defaultStrict: true },
  { id: 'form', key: 'sps_form_export_lifecycle', label: 'Form CSV', defaultStrict: true },
  { id: 'compiler', key: 'sps_compiler_export_lifecycle', label: 'Compiler', defaultStrict: true },
  { id: 'generate', key: 'sps_generate_export_lifecycle', label: 'Generate desk', defaultStrict: true },
  { id: 'promo', key: 'sps_promo_export_lifecycle', label: 'Promo pack', defaultStrict: true },
  { id: 'pitch', key: 'sps_pitch_export_lifecycle', label: 'Pitch deck', defaultStrict: true },
  { id: 'campaign', key: 'sps_campaign_export_lifecycle', label: 'Campaign kit', defaultStrict: true },
  { id: 'storyboard', key: 'sps_storyboard_export_lifecycle', label: 'Storyboard', defaultStrict: true },
  { id: 'feature_reel', key: 'sps_feature_reel_export_lifecycle', label: 'Feature reel', defaultStrict: true },
  { id: 'investor', key: 'sps_investor_export_lifecycle', label: 'Investor deck', defaultStrict: true },
  { id: 'budget', key: 'sps_budget_export_lifecycle', label: 'Budget', defaultStrict: true },
  { id: 'collab_chat', key: 'sps_collab_chat_export_lifecycle', label: 'Collab chat', defaultStrict: true },
  { id: 'stage', key: 'sps_stage_export_lifecycle', label: '3D Stage', defaultStrict: true },
  { id: 'character', key: 'sps_character_export_lifecycle', label: 'Character looks', defaultStrict: true },
  { id: 'world', key: 'sps_world_export_lifecycle', label: 'World plates', defaultStrict: true },
  { id: 'story_package', key: 'sps_story_package_export_lifecycle', label: 'Story package', defaultStrict: true },
  { id: 'director', key: 'sps_director_export_lifecycle', label: 'Director psychology', defaultStrict: true },
  { id: 'dop', key: 'sps_dop_export_lifecycle', label: 'DoP vision', defaultStrict: true },
  { id: 'sound', key: 'sps_sound_export_lifecycle', label: 'Sound vision', defaultStrict: true },
  { id: 'continuity', key: 'sps_continuity_export_lifecycle', label: 'Continuity report', defaultStrict: true }
]);

export function getExportLifecyclePrefDef(id) {
  return EXPORT_LIFECYCLE_PREF_DEFS.find((d) => d.id === id) || null;
}

export function readExportLifecycleStrict(storageKey, defaultStrict = true) {
  if (typeof window === 'undefined') return Boolean(defaultStrict);
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw == null || raw === '') return Boolean(defaultStrict);
    return raw === 'strict';
  } catch {
    return Boolean(defaultStrict);
  }
}

export function writeExportLifecycleStrict(storageKey, strict) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey, strict ? 'strict' : 'advisory');
    window.dispatchEvent(
      new CustomEvent('sps_export_lifecycle_prefs_updated', {
        detail: { key: storageKey, mode: strict ? 'strict' : 'advisory' }
      })
    );
  } catch {
    /* ignore */
  }
}

export function exportLifecycleModeFromStrict(strict) {
  return strict ? EXPORT_LIFECYCLE.STRICT : EXPORT_LIFECYCLE.ADVISORY;
}

export function listExportLifecyclePrefs() {
  return EXPORT_LIFECYCLE_PREF_DEFS.map((def) => {
    const strict = readExportLifecycleStrict(def.key, def.defaultStrict);
    return {
      ...def,
      strict,
      mode: exportLifecycleModeFromStrict(strict)
    };
  });
}

export function setExportLifecyclePref(id, strict, { projectTitle = '', audit = true } = {}) {
  const def = EXPORT_LIFECYCLE_PREF_DEFS.find((d) => d.id === id);
  if (!def) return null;
  writeExportLifecycleStrict(def.key, Boolean(strict));
  if (audit) {
    appendCreativeAudit({
      projectTitle: projectTitle || resolveActiveProjectTitle(),
      category: 'export',
      action: 'lifecycle_pref',
      targetType: 'export',
      targetId: def.id,
      targetLabel: def.label,
      note: `${strict ? 'strict' : 'advisory'} · hub`
    });
  }
  return listExportLifecyclePrefs().find((d) => d.id === id) || null;
}

/** Revert one surface to its declared defaultStrict (clears override). */
export function revertExportLifecyclePrefToDefault(id, { projectTitle = '', audit = true } = {}) {
  const def = EXPORT_LIFECYCLE_PREF_DEFS.find((d) => d.id === id);
  if (!def) return null;
  const fromStrict = readExportLifecycleStrict(def.key, def.defaultStrict);
  const toStrict = Boolean(def.defaultStrict);
  writeExportLifecycleStrict(def.key, toStrict);
  if (audit) {
    appendCreativeAudit({
      projectTitle: projectTitle || resolveActiveProjectTitle(),
      category: 'export',
      action: 'lifecycle_pref_revert',
      targetType: 'export',
      targetId: def.id,
      targetLabel: def.label,
      from: fromStrict ? 'strict' : 'advisory',
      to: toStrict ? 'strict' : 'advisory',
      note: `revert override → default ${toStrict ? 'strict' : 'advise'} · hub`
    });
  }
  return listExportLifecyclePrefs().find((d) => d.id === id) || null;
}

export function setAllExportLifecyclePrefs(strict, { projectTitle = '' } = {}) {
  const mode = Boolean(strict);
  EXPORT_LIFECYCLE_PREF_DEFS.forEach((def) => {
    writeExportLifecycleStrict(def.key, mode);
  });
  appendCreativeAudit({
    projectTitle: projectTitle || resolveActiveProjectTitle(),
    category: 'export',
    action: 'lifecycle_pref_bulk',
    targetType: 'export',
    targetId: 'all',
    targetLabel: 'All surfaces',
    note: `${mode ? 'strict' : 'advisory'} · hub bulk`
  });
  return listExportLifecyclePrefs();
}

/** Restore every surface to its declared defaultStrict (clears overrides). */
export function resetExportLifecyclePrefsToDefaults({ projectTitle = '', audit = true } = {}) {
  const before = exportLifecyclePrefsSummary();
  let restored = 0;
  EXPORT_LIFECYCLE_PREF_DEFS.forEach((def) => {
    const cur = readExportLifecycleStrict(def.key, def.defaultStrict);
    const target = Boolean(def.defaultStrict);
    if (cur !== target) restored += 1;
    writeExportLifecycleStrict(def.key, target);
  });
  const after = exportLifecyclePrefsSummary();
  if (audit) {
    appendCreativeAudit({
      projectTitle: projectTitle || resolveActiveProjectTitle(),
      category: 'export',
      action: 'lifecycle_pref_reset_defaults',
      targetType: 'export',
      targetId: 'lifecycle_hub',
      targetLabel: 'Export lifecycle hub',
      note: `reset to defaults · ${restored} restored · ${after.atDefault}/${after.total} at default · was ${before.overridden} overridden`
    });
  }
  return { restored, before, after, rows: after.rows };
}

export function exportLifecyclePrefsSummary() {
  const rows = listExportLifecyclePrefs();
  const atDefault = rows.filter((r) => r.strict === Boolean(r.defaultStrict)).length;
  const overridden = rows.length - atDefault;
  return {
    total: rows.length,
    strict: rows.filter((r) => r.strict).length,
    advisory: rows.filter((r) => !r.strict).length,
    atDefault,
    overridden,
    rows
  };
}

/** Append a creative-audit snapshot of hub surface counts (Settings → SaaS). */

function csvEscapeLifecycle(v) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

/** Craft CSV of every gated export surface (Advise/Strict hub audit). */
export function exportLifecyclePrefsToCsv({ projectTitle = '', roomId = '' } = {}) {
  const summary = exportLifecyclePrefsSummary();
  const title = String(projectTitle || resolveActiveProjectTitle() || '').trim();
  const room = String(roomId || '').trim();
  const headers = [
    '#',
    'Id',
    'Label',
    'Mode',
    'Strict',
    'DefaultStrict',
    'Overridden',
    'StorageKey',
    'Project',
    'Room'
  ];
  const rows = (summary.rows || []).map((r, idx) =>
    [
      idx + 1,
      r.id || '',
      r.label || '',
      r.mode || (r.strict ? 'strict' : 'advisory'),
      r.strict ? 'yes' : 'no',
      r.defaultStrict ? 'yes' : 'no',
      Boolean(r.strict) === Boolean(r.defaultStrict) ? 'no' : 'yes',
      r.key || '',
      title,
      room
    ]
      .map(csvEscapeLifecycle)
      .join(',')
  );
  const meta = [
    `# Export lifecycle hub · ${title || 'Studio'}`,
    `# Surfaces: ${summary.total}`,
    `# Strict: ${summary.strict} · Advisory: ${summary.advisory}`,
    `# Overridden: ${summary.overridden} · At default: ${summary.atDefault}`,
    `# Room: ${room || '—'}`,
    `# Exported: ${new Date().toISOString()}`
  ].join('\n');
  return `${meta}\n${[headers.map(csvEscapeLifecycle).join(','), ...rows].join('\n')}`;
}

/** Download surface audit CSV (hub → Prefs). */
export function downloadExportLifecyclePrefsCsv({ projectTitle = '', roomId = '', audit = true } = {}) {
  const title = projectTitle || resolveActiveProjectTitle();
  const room = String(roomId || '').trim();
  const summary = exportLifecyclePrefsSummary();
  const csv = exportLifecyclePrefsToCsv({ projectTitle: title, roomId: room });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const filename = 'sps_export_lifecycle_surfaces.csv';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  if (audit) {
    appendCreativeAudit({
      projectTitle: title,
      category: 'export',
      action: 'export_ok',
      targetType: 'export',
      targetId: 'export_lifecycle_surfaces_csv',
      targetLabel: 'export_lifecycle_surfaces_csv',
      note: `${summary.total} surfaces · ${summary.strict}S/${summary.advisory}A · csv${room ? ` · room:${room}` : ''}`
    });
  }
  return { ok: true, filename, total: summary.total };
}

export function auditExportLifecycleSurfaceCounts({ projectTitle = '' } = {}) {
  const summary = exportLifecyclePrefsSummary();
  const note = [
    `${summary.total} surfaces`,
    `${summary.strict} strict`,
    `${summary.advisory} advisory`,
    `${summary.atDefault} at default`,
    `${summary.overridden} overridden`
  ].join(' · ');
  appendCreativeAudit({
    projectTitle: projectTitle || resolveActiveProjectTitle(),
    category: 'export',
    action: 'lifecycle_hub_count',
    targetType: 'export',
    targetId: 'lifecycle_hub',
    targetLabel: 'Export lifecycle hub',
    note
  });
  return summary;
}

/** Download hub prefs as JSON (local device snapshot). */
export function downloadExportLifecyclePrefsJson({ projectTitle = '', audit = true } = {}) {
  const summary = exportLifecyclePrefsSummary();
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    projectTitle: projectTitle || resolveActiveProjectTitle(),
    summary: {
      total: summary.total,
      strict: summary.strict,
      advisory: summary.advisory,
      atDefault: summary.atDefault,
      overridden: summary.overridden
    },
    surfaces: summary.rows.map((r) => ({
      id: r.id,
      key: r.key,
      label: r.label,
      mode: r.mode,
      strict: r.strict,
      defaultStrict: r.defaultStrict,
      overridden: r.strict !== Boolean(r.defaultStrict)
    }))
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const filename = 'sps_export_lifecycle_prefs.json';
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
      action: 'lifecycle_hub_json',
      targetType: 'export',
      targetId: 'lifecycle_hub',
      targetLabel: 'Export lifecycle hub',
      note: `${summary.total} surfaces · json`
    });
  }
  return payload;
}

function parseLifecyclePrefsImportPayload(input) {
  let data = input;
  if (typeof input === 'string') {
    try {
      data = JSON.parse(input);
    } catch {
      return { ok: false, error: 'invalid_json' };
    }
  }
  if (!data || typeof data !== 'object') return { ok: false, error: 'invalid_payload' };
  const surfaces = Array.isArray(data.surfaces) ? data.surfaces : null;
  if (!surfaces?.length) return { ok: false, error: 'no_surfaces' };
  return { ok: true, data, surfaces };
}

function resolveImportStrict(row) {
  if (row?.strict != null) return Boolean(row.strict);
  return String(row?.mode || '').toLowerCase() === 'strict';
}

/** Diff imported hub prefs against current local prefs (no write). */
export function previewExportLifecyclePrefsImport(input) {
  const parsed = parseLifecyclePrefsImportPayload(input);
  if (!parsed.ok) return parsed;

  const current = listExportLifecyclePrefs();
  const byId = Object.fromEntries(current.map((r) => [r.id, r]));
  const changes = [];
  const unchanged = [];
  const unknown = [];

  parsed.surfaces.forEach((row) => {
    const def = EXPORT_LIFECYCLE_PREF_DEFS.find((d) => d.id === row?.id);
    if (!def) {
      unknown.push({ id: row?.id || '?', label: row?.label || row?.id || '?' });
      return;
    }
    const nextStrict = resolveImportStrict(row);
    const cur = byId[def.id];
    const fromStrict = Boolean(cur?.strict);
    const entry = {
      id: def.id,
      label: def.label,
      fromStrict,
      toStrict: nextStrict,
      from: fromStrict ? 'strict' : 'advisory',
      to: nextStrict ? 'strict' : 'advisory'
    };
    if (fromStrict === nextStrict) unchanged.push(entry);
    else changes.push(entry);
  });

  return {
    ok: true,
    surfaces: parsed.surfaces,
    changes,
    unchanged,
    unknown,
    changeCount: changes.length,
    unchangedCount: unchanged.length,
    unknownCount: unknown.length
  };
}

/** Apply a previewed (or raw) hub prefs snapshot. */
export function importExportLifecyclePrefsFromJson(input, { projectTitle = '', audit = true } = {}) {
  const preview =
    input && typeof input === 'object' && input.ok === true && Array.isArray(input.surfaces)
      ? input
      : previewExportLifecyclePrefsImport(input);
  if (!preview.ok) return preview;

  let applied = 0;
  preview.surfaces.forEach((row) => {
    const def = EXPORT_LIFECYCLE_PREF_DEFS.find((d) => d.id === row?.id);
    if (!def) return;
    writeExportLifecycleStrict(def.key, resolveImportStrict(row));
    applied += 1;
  });

  if (!applied) return { ok: false, error: 'no_matching_surfaces' };

  const summary = exportLifecyclePrefsSummary();
  if (audit) {
    const changeN = preview.changeCount ?? preview.changes?.length ?? 0;
    appendCreativeAudit({
      projectTitle: projectTitle || resolveActiveProjectTitle(),
      category: 'export',
      action: 'lifecycle_hub_import',
      targetType: 'export',
      targetId: 'lifecycle_hub',
      targetLabel: 'Export lifecycle hub',
      note: `${applied} surfaces restored · ${changeN} changed · ${summary.strict}S / ${summary.advisory}A`
    });
  }
  return { ok: true, applied, summary, preview };
}
