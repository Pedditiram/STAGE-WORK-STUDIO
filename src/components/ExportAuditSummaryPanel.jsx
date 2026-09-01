import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import {
  exportAuditSummary,
  exportExportAuditCsv,
  exportExportAuditJson,
  EXPORT_LIFECYCLE
} from '../utils/exportGate';
import {
  downloadExportAuditFilterPresetsJson,
  importExportAuditFilterPresetsFromJson,
  readExportAuditFilterPresets,
  setExportAuditDefaultFilter
} from '../utils/exportAuditFilterPresets';
import { canUseSaasFeature } from '../utils/saasControl';
import { getActorEmail } from '../utils/creativeAuditLog';

/**
 * Compact export gate + lifecycle audit for Project Console (active project).
 */
export default function ExportAuditSummaryPanel({
  projectTitle = '',
  shots = [],
  roomId = ''
}) {
  const [tick, setTick] = useState(0);
  const [presetState, setPresetState] = useState(() => readExportAuditFilterPresets());
  const [auditFilter, setAuditFilter] = useState(() => readExportAuditFilterPresets().defaultFilter || 'all');
  const [flash, setFlash] = useState('');
  const importRef = useRef(null);
  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    const onAudit = (e) => {
      const t = String(e?.detail?.title || '').trim().toUpperCase();
      const active = String(projectTitle || '').trim().toUpperCase();
      if (!active || t === active) refresh();
    };
    const onPresets = () => setPresetState(readExportAuditFilterPresets());
    window.addEventListener('sps_creative_audit_updated', onAudit);
    window.addEventListener('sps_export_audit_filter_presets_updated', onPresets);
    return () => {
      window.removeEventListener('sps_creative_audit_updated', onAudit);
      window.removeEventListener('sps_export_audit_filter_presets_updated', onPresets);
    };
  }, [projectTitle, refresh]);

  const summary = useMemo(
    () =>
      exportAuditSummary(projectTitle, shots, roomId, {
        filter: auditFilter,
        limit: 12
      }),
    [projectTitle, shots, roomId, tick, auditFilter]
  );
  const exportLife = summary.lifecycle || {};
  const entitled = summary.entitled ?? canUseSaasFeature('export', getActorEmail());
  const filterOptions = presetState.presets || [];

  if (!String(projectTitle || '').trim()) return null;

  return (
    <div className="p-3 rounded-xl border border-[var(--sps-border)] bg-[var(--sps-surface)]/80 space-y-2.5">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-[var(--sps-muted)] m-0 font-bold">
            Export audit — active project
          </p>
          <p className="text-[11px] text-[var(--sps-muted)] m-0 mt-0.5 truncate" title={projectTitle}>
            {projectTitle}
          </p>
        </div>
        <span
          className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md shrink-0 ${
            exportLife.exportReady
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
          }`}
        >
          {exportLife.exportReady ? 'Share-ready' : 'Not share-ready'}
        </span>
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          <button
            type="button"
            className="sps-btn text-[10px]"
            title="Download export-category audit JSON"
            onClick={() =>
              exportExportAuditJson(projectTitle, {
                shots,
                roomId,
                lifecycleMode: EXPORT_LIFECYCLE.NONE
              })
            }
          >
            <Download className="w-3 h-3" />
            Audit JSON
          </button>
          <button
            type="button"
            className="sps-btn text-[10px]"
            title="Download export-category audit CSV (honors filter chips)"
            onClick={() =>
              exportExportAuditCsv(projectTitle, {
                shots,
                roomId,
                filter: auditFilter,
                lifecycleMode: EXPORT_LIFECYCLE.NONE
              })
            }
          >
            <Download className="w-3 h-3" />
            Audit CSV
          </button>
          <button
            type="button"
            className="sps-btn text-[10px]"
            title="Download filter presets JSON"
            onClick={() => {
              downloadExportAuditFilterPresetsJson({ projectTitle });
              setFlash('Downloaded filter presets JSON');
              window.setTimeout(() => setFlash(''), 2600);
            }}
          >
            <Download className="w-3 h-3" />
            Filters JSON
          </button>
          <button
            type="button"
            className="sps-btn text-[10px]"
            title="Import filter presets JSON"
            onClick={() => importRef.current?.click()}
          >
            <Upload className="w-3 h-3" />
            Import filters
          </button>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                const result = importExportAuditFilterPresetsFromJson(String(reader.result || ''), {
                  projectTitle
                });
                if (!result.ok) {
                  setFlash(`Import failed · ${result.error || 'unknown'}`);
                } else {
                  setPresetState(result.state);
                  setAuditFilter(result.state.defaultFilter || 'all');
                  setFlash(`Imported filters · default ${result.state.defaultFilter}`);
                }
                window.setTimeout(() => setFlash(''), 3200);
              };
              reader.readAsText(file);
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="px-2 py-1.5 rounded-lg border border-[var(--sps-border)] bg-[var(--sps-bg)]/60">
          <p className="text-[9px] uppercase tracking-wide text-[var(--sps-muted)] m-0">Plan export</p>
          <p className={`text-sm font-bold m-0 ${entitled ? 'text-emerald-400' : 'text-rose-400'}`}>
            {entitled ? 'On' : 'Off'}
          </p>
        </div>
        <div className="px-2 py-1.5 rounded-lg border border-[var(--sps-border)] bg-[var(--sps-bg)]/60">
          <p className="text-[9px] uppercase tracking-wide text-[var(--sps-muted)] m-0">Exports OK</p>
          <p className="text-sm font-bold m-0 text-[var(--sps-text)]">{summary.ok || 0}</p>
        </div>
        <div className="px-2 py-1.5 rounded-lg border border-[var(--sps-border)] bg-[var(--sps-bg)]/60">
          <p className="text-[9px] uppercase tracking-wide text-[var(--sps-muted)] m-0">Blocked</p>
          <p className={`text-sm font-bold m-0 ${summary.blocked ? 'text-rose-400' : 'text-[var(--sps-text)]'}`}>
            {summary.blocked || 0}
          </p>
        </div>
        <div className="px-2 py-1.5 rounded-lg border border-[var(--sps-border)] bg-[var(--sps-bg)]/60">
          <p className="text-[9px] uppercase tracking-wide text-[var(--sps-muted)] m-0">Lifecycle tagged</p>
          <p className="text-sm font-bold m-0 text-[var(--sps-text)]">{summary.lifecycleTagged || 0}</p>
        </div>
      </div>

      {summary.collabRoomId ? (
        <p className="text-[10px] font-mono text-[var(--sps-muted)] m-0 truncate">
          Room · {summary.collabRoomId}
          {summary.roomTagged ? ` · ${summary.roomTagged} export${summary.roomTagged === 1 ? '' : 's'} room-tagged` : ''}
        </p>
      ) : null}

      {!exportLife.exportReady && exportLife.message ? (
        <p className="text-[10px] text-amber-300/90 m-0 leading-snug">{exportLife.message}</p>
      ) : null}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="sps-tabs sps-tabs-compact" role="tablist" aria-label="Export audit filter">
          {filterOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={auditFilter === (opt.filter || opt.id)}
              className="text-[9px]"
              title={
                presetState.defaultFilter === (opt.filter || opt.id)
                  ? `${opt.label} (default)`
                  : `Filter · right-click or long-press N/A — double-click to set default`
              }
              onClick={() => setAuditFilter(opt.filter || opt.id)}
              onDoubleClick={() => {
                const next = setExportAuditDefaultFilter(opt.filter || opt.id, { projectTitle });
                setPresetState(next);
                setAuditFilter(next.defaultFilter);
                setFlash(`Default filter → ${next.defaultFilter}`);
                window.setTimeout(() => setFlash(''), 2600);
              }}
            >
              {opt.label}
              {presetState.defaultFilter === (opt.filter || opt.id) ? '*' : ''}
            </button>
          ))}
        </div>
        <p className="text-[9px] font-mono text-[var(--sps-muted)] m-0">
          {summary.filteredTotal ?? 0} / {summary.total ?? 0} rows
        </p>
      </div>

      {flash ? (
        <p className="text-[10px] font-mono text-emerald-400/90 m-0">{flash}</p>
      ) : (
        <p className="text-[9px] text-[var(--sps-muted)] m-0">
          Double-click a filter chip to save as default · Filters JSON export/import
        </p>
      )}

      {summary.recent?.length ? (
        <div className="space-y-1 max-h-24 overflow-y-auto">
          {summary.recent.map((row) => (
            <p
              key={row.id}
              className={`text-[10px] font-mono truncate m-0 ${
                row.action === 'export_blocked' ? 'text-rose-400' : 'text-[var(--sps-muted)]'
              }`}
              title={row.note || ''}
            >
              {row.action} · {row.targetLabel}
              {row.note ? ` · ${row.note}` : ''}
            </p>
          ))}
        </div>
      ) : (
        <p className="text-[10px] text-[var(--sps-muted)] m-0">
          {auditFilter === 'all'
            ? 'Writer, Compiler, Generate, and gated exports log here when blocked or completed.'
            : `No export audit rows match “${auditFilter}”.`}
        </p>
      )}
    </div>
  );
}
