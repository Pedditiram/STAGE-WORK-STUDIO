import React, { useEffect, useRef, useState } from 'react';
import {
  auditExportLifecycleSurfaceCounts,
  downloadExportLifecyclePrefsJson,
  downloadExportLifecyclePrefsCsv,
  exportLifecyclePrefsSummary,
  importExportLifecyclePrefsFromJson,
  previewExportLifecyclePrefsImport,
  resetExportLifecyclePrefsToDefaults,
  revertExportLifecyclePrefToDefault,
  setAllExportLifecyclePrefs,
  setExportLifecyclePref
} from '../utils/exportLifecyclePrefs';
import { resolveActiveProjectTitle } from '../utils/creativeAuditLog';
import { readLastExportRoomId, resolveCollabRoomId } from '../utils/exportGate';

/** Toggle: on = block export until share-ready; off = allow early export with confirm. */
function ExportGateSwitch({ on, onChange, label, id }) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={on ? 'On — blocks export until share-ready' : 'Off — allows early export with confirm'}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors ${
        on
          ? 'bg-amber-500/90 border-amber-400/60'
          : 'bg-zinc-800 border-zinc-600'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
          on ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

/**
 * Settings hub — per-surface export gate (block until share-ready).
 */
export default function ExportLifecycleHub() {
  const [summary, setSummary] = useState(() => exportLifecyclePrefsSummary());
  const [auditFlash, setAuditFlash] = useState('');
  const [importPreview, setImportPreview] = useState(null);
  const [lastExportRoom, setLastExportRoom] = useState(() => readLastExportRoomId());
  const importInputRef = useRef(null);

  const refresh = () => setSummary(exportLifecyclePrefsSummary());

  useEffect(() => {
    const onPref = () => refresh();
    window.addEventListener('sps_export_lifecycle_prefs_updated', onPref);
    return () => window.removeEventListener('sps_export_lifecycle_prefs_updated', onPref);
  }, []);

  useEffect(() => {
    const onRoom = (e) => {
      setLastExportRoom(String(e?.detail?.roomId || readLastExportRoomId() || '').trim());
    };
    window.addEventListener('sps_last_export_room_updated', onRoom);
    return () => window.removeEventListener('sps_last_export_room_updated', onRoom);
  }, []);

  const projectTitle = resolveActiveProjectTitle();
  const liveRoom = resolveCollabRoomId();
  const allBlocking = summary.total > 0 && summary.strict === summary.total;

  return (
    <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-700/60 space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <p className="text-[11px] font-bold text-zinc-200 m-0 uppercase tracking-wide">
            Export gate
          </p>
          <p className="text-[11px] text-zinc-500 m-0 mt-1 leading-relaxed">
            Switch on to block downloads until the slate is share-ready. Off allows an early export
            after confirm. Configure here — not on each console.
          </p>
          {(lastExportRoom || liveRoom) ? (
            <p
              className="text-[9px] font-mono text-cyan-400/90 m-0 mt-1.5"
              title="Room stamped on the last gated export success; live room from collab context"
            >
              Last room {lastExportRoom || '—'}
              {liveRoom && liveRoom !== lastExportRoom ? ` · live ${liveRoom}` : liveRoom ? ' · live' : ''}
            </p>
          ) : (
            <p className="text-[9px] font-mono text-zinc-600 m-0 mt-1.5">
              Last room — (exports with a room stamp will appear here)
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          <button
            type="button"
            className="sps-btn text-[10px]"
            title="Log surface counts to creative audit"
            onClick={() => {
              const snap = auditExportLifecycleSurfaceCounts({ projectTitle });
              setAuditFlash(
                `Audited ${snap.total} surfaces · ${snap.strict} blocking · ${snap.overridden} overridden`
              );
              window.setTimeout(() => setAuditFlash(''), 2800);
              refresh();
            }}
          >
            Audit counts
          </button>
          <button
            type="button"
            className="sps-btn text-[10px]"
            title="Download hub prefs JSON"
            onClick={() => {
              downloadExportLifecyclePrefsJson({ projectTitle });
              setAuditFlash('Downloaded sps_export_lifecycle_prefs.json');
              window.setTimeout(() => setAuditFlash(''), 2800);
              refresh();
            }}
          >
            Prefs JSON
          </button>
          <button
            type="button"
            className="sps-btn text-[10px]"
            title="Download surface gate audit CSV"
            onClick={() => {
              downloadExportLifecyclePrefsCsv({
                projectTitle,
                roomId: lastExportRoom || resolveCollabRoomId()
              });
              setAuditFlash('Downloaded sps_export_lifecycle_surfaces.csv');
              window.setTimeout(() => setAuditFlash(''), 2800);
              refresh();
            }}
          >
            Surfaces CSV
          </button>
          <button
            type="button"
            className="sps-btn text-[10px]"
            title="Preview restore from sps_export_lifecycle_prefs.json"
            onClick={() => importInputRef.current?.click()}
          >
            Import JSON
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                const preview = previewExportLifecyclePrefsImport(String(reader.result || ''));
                if (!preview.ok) {
                  setImportPreview(null);
                  setAuditFlash(`Import failed · ${preview.error || 'unknown'}`);
                  window.setTimeout(() => setAuditFlash(''), 3200);
                  return;
                }
                setImportPreview(preview);
                setAuditFlash('');
              };
              reader.readAsText(file);
            }}
          />
          <button
            type="button"
            className={`sps-btn text-[10px] ${!allBlocking ? 'sps-btn-primary' : ''}`}
            title="Turn off blocking on every surface"
            onClick={() => {
              setAllExportLifecyclePrefs(false, { projectTitle });
              refresh();
            }}
          >
            Allow all early
          </button>
          <button
            type="button"
            className={`sps-btn text-[10px] ${allBlocking ? 'sps-btn-primary' : ''}`}
            title="Block every surface until share-ready"
            onClick={() => {
              setAllExportLifecyclePrefs(true, { projectTitle });
              refresh();
            }}
          >
            Block all
          </button>
          <button
            type="button"
            className="sps-btn text-[10px]"
            title="Restore each surface to its declared default"
            onClick={() => {
              const result = resetExportLifecyclePrefsToDefaults({ projectTitle });
              setAuditFlash(
                `Reset defaults · ${result.restored} restored · ${result.after.atDefault}/${result.after.total} at default`
              );
              window.setTimeout(() => setAuditFlash(''), 3200);
              refresh();
            }}
          >
            Reset defaults
          </button>
        </div>
      </div>

      {importPreview ? (
        <div className="rounded border border-amber-900/50 bg-zinc-900/80 p-2.5 space-y-2">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <p className="text-[10px] font-bold text-amber-200/90 m-0 uppercase tracking-wide">
                Import preview
              </p>
              <p className="text-[10px] text-zinc-500 m-0 mt-0.5">
                {importPreview.changeCount} change
                {importPreview.changeCount === 1 ? '' : 's'} · {importPreview.unchangedCount} same ·{' '}
                {importPreview.unknownCount} unknown
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="sps-btn text-[10px]"
                onClick={() => setImportPreview(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="sps-btn sps-btn-primary text-[10px]"
                disabled={!importPreview.changeCount && !importPreview.unchangedCount}
                onClick={() => {
                  const result = importExportLifecyclePrefsFromJson(importPreview, {
                    projectTitle
                  });
                  setImportPreview(null);
                  if (!result.ok) {
                    setAuditFlash(`Import failed · ${result.error || 'unknown'}`);
                  } else {
                    setAuditFlash(
                      `Applied ${result.applied} surfaces · ${importPreview.changeCount} changed · ${result.summary.strict} blocking`
                    );
                  }
                  window.setTimeout(() => setAuditFlash(''), 3600);
                  refresh();
                }}
              >
                Apply import
              </button>
            </div>
          </div>
          {importPreview.changes?.length ? (
            <div className="space-y-1 max-h-36 overflow-y-auto">
              {importPreview.changes.map((c) => (
                <p key={c.id} className="text-[10px] font-mono text-zinc-300 m-0">
                  {c.label}: {c.from === 'strict' ? 'block' : 'allow'} → {c.to === 'strict' ? 'block' : 'allow'}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-zinc-500 m-0">No mode changes — apply still rewrites known surfaces.</p>
          )}
          {importPreview.unknown?.length ? (
            <p className="text-[9px] text-rose-300/80 m-0">
              Skipped: {importPreview.unknown.map((u) => u.id).join(', ')}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        <div className="px-2 py-1.5 rounded border border-zinc-800 bg-zinc-900/70">
          <p className="text-[8px] uppercase tracking-wide text-zinc-500 m-0">Surfaces</p>
          <p className="text-sm font-bold text-zinc-200 m-0 tabular-nums">{summary.total}</p>
        </div>
        <div className="px-2 py-1.5 rounded border border-zinc-800 bg-zinc-900/70">
          <p className="text-[8px] uppercase tracking-wide text-zinc-500 m-0">Blocking</p>
          <p className="text-sm font-bold text-amber-300/90 m-0 tabular-nums">{summary.strict}</p>
        </div>
        <div className="px-2 py-1.5 rounded border border-zinc-800 bg-zinc-900/70">
          <p className="text-[8px] uppercase tracking-wide text-zinc-500 m-0">At default</p>
          <p className="text-sm font-bold text-emerald-400/90 m-0 tabular-nums">{summary.atDefault ?? 0}</p>
        </div>
        <div className="px-2 py-1.5 rounded border border-zinc-800 bg-zinc-900/70">
          <p className="text-[8px] uppercase tracking-wide text-zinc-500 m-0">Overridden</p>
          <p className="text-sm font-bold text-rose-300/90 m-0 tabular-nums">{summary.overridden ?? 0}</p>
        </div>
      </div>

      {auditFlash ? (
        <p className="text-[10px] font-mono text-emerald-400/90 m-0">{auditFlash}</p>
      ) : (
        <p className="text-[10px] font-mono text-zinc-500 m-0">
          {summary.strict} blocking · {summary.advisory} allow early · {summary.overridden ?? 0} overridden
        </p>
      )}

      <div className="flex items-center justify-between gap-2 px-1 text-[9px] uppercase tracking-wide text-zinc-500">
        <span>Console</span>
        <span>Block until ready</span>
      </div>

      <div className="space-y-1.5 max-h-72 overflow-y-auto">
        {summary.rows.map((row) => {
          const isOverride = row.strict !== Boolean(row.defaultStrict);
          return (
            <div
              key={row.id}
              className="flex items-center justify-between gap-2 px-2 py-1.5 rounded border border-zinc-800 bg-zinc-900/70"
            >
              <div className="min-w-0">
                <p className="text-[11px] text-zinc-200 m-0 truncate">
                  {row.label}
                  {isOverride ? (
                    <span className="ml-1.5 text-[8px] uppercase tracking-wide text-rose-300/80">override</span>
                  ) : null}
                </p>
                <p className="text-[9px] font-mono text-zinc-600 m-0 truncate">{row.key}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isOverride ? (
                  <button
                    type="button"
                    className="sps-btn text-[9px] px-1.5 py-0.5"
                    title="Revert to default"
                    onClick={() => {
                      revertExportLifecyclePrefToDefault(row.id, { projectTitle });
                      setAuditFlash(`Reverted · ${row.label}`);
                      window.setTimeout(() => setAuditFlash(''), 2400);
                      refresh();
                    }}
                  >
                    Revert
                  </button>
                ) : null}
                <ExportGateSwitch
                  id={`export-gate-${row.id}`}
                  on={row.strict}
                  label={`${row.label}: block until share-ready`}
                  onChange={(next) => {
                    setExportLifecyclePref(row.id, next, { projectTitle });
                    refresh();
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
