import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Download, RefreshCw, Clapperboard, Sparkles, Lock, AlertTriangle, GitBranch } from 'lucide-react';
import {
  detectBibleSoTDrift,
  healBibleSoTDrift,
  patchLibraryProjectBibleFields
} from '../utils/bibleSoTHealth';
import { readLocalProjectLibrary, writeLocalProjectLibrary } from '../utils/projectWorkspace';
import {
  readJobsForTitle,
  GENERATION_JOB_FILTER_OPTIONS,
  filterGenerationJobsBySource
} from '../utils/generationJobs';
import { exportCreativeAuditJson, AUDIT_FILTER_OPTIONS, creativeAuditSummary } from '../utils/creativeAuditLog';
import {
  assertExportAllowed,
  exportExportAuditCsv,
  exportExportAuditJson,
  exportAuditSummary,
  EXPORT_LIFECYCLE,
  EXPORT_AUDIT_FILTER_OPTIONS,
  logExportSuccess,
  exportDownloadText,
  resolveCollabRoomId
} from '../utils/exportGate';
import {
  patchProductionSpineSequence,
  patchProductionSpineAct,
  patchProductionSpineScene,
  ACT_TITLES,
  readProductionSpine,
  autoSyncProductionSpine,
  spineNeedsRebuild
} from '../utils/productionSpine';
import { writeStoryPackageFromSpine } from '../utils/storyPackage';
import { proposeContinuityDriftFixes, applyContinuityDriftFixes, scanContinuityDrift, buildContinuityFixesForShot } from '../utils/continuitySupervisor';
import { continuityDriftToPrintHtml, continuityDriftToCsv, buildContinuityZipFiles, continuityDriftToMarkdown, continuityFixesToCsv, continuityFixesToPrintHtml, buildContinuityFixesZipFiles, continuityFixesToMarkdown } from '../utils/continuitySupervisorExport';
import { useExportLifecyclePref } from '../hooks/useExportLifecyclePref';
import { createZipArchive } from '../utils/zipUtils';
import { saveExportBlob } from '../utils/saveExportFile';
import {
  fetchCloudSyncHealth,
  fetchKvMigrationStatus,
  readCloudSyncHealth,
  syncBackendLabel
} from '../utils/cloudSyncHealth';
import {
  advanceProjectLifecycle,
  bulkAdvanceAssetLifecycle,
  bulkAdvanceShotLifecycle,
  lifecycleExportReadiness,
  lifecycleMeta,
  normalizeLifecycleStatus,
  stepBackProjectLifecycle,
  unlockProjectLifecycle,
  GUEST_PLAY_LIFECYCLE_MESSAGE
} from '../utils/productionLifecycle';
import { isGuestPlayTitle } from '../utils/guestPlayground';
import {
  getActiveCharacterProfiles,
  getActiveWorldAssets,
  saveActiveCharacterProfiles,
  saveActiveWorldAssets
} from '../utils/projectBibleVault';
import { applyProductionAssetSpec } from '../utils/assetRegistry';

function SpineTree({ spine, projectTitle = '', onChanged }) {
  const acts = spine?.actNodes || [];
  if (!acts.length) {
    return <p className="text-[11px] text-[var(--sps-muted)]">Spine builds from Story Package sequences + Matrix scenes.</p>;
  }
  return (
    <div className="space-y-2">
      {acts.map((act) => (
        <div key={act.act} className="border border-[var(--sps-border)] rounded-[6px] p-2 bg-[var(--sps-bg-elevated)] space-y-1">
          <input
            type="text"
            defaultValue={act.title || `Act ${act.act}`}
            key={`${act.act}-${act.title}`}
            className="w-full text-[11px] font-mono font-bold text-[var(--sps-gold)] bg-transparent border-b border-transparent focus:border-[var(--sps-border)] outline-none"
            onBlur={(e) => {
              const next = e.target.value.trim();
              if (!next || next === (act.title || '')) return;
              patchProductionSpineAct(projectTitle, act.act, { title: next });
              onChanged?.();
            }}
            title="Edit act title"
          />
          <p className="text-[10px] text-[var(--sps-muted)] m-0">
            Sequences: {(act.sequenceSeqs || []).join(', ') || '—'}
          </p>
        </div>
      ))}
    </div>
  );
}

function SpineSceneReassign({ projectTitle = '', scenes = [], sequences = [], onChanged }) {
  if (!scenes.length) {
    return <p className="text-[11px] text-[var(--sps-muted)]">No scenes on spine yet.</p>;
  }
  return (
    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
      {scenes.slice(0, 24).map((sc) => (
        <div
          key={sc.id || sc.sceneNumber}
          className="flex items-center gap-2 border border-[var(--sps-border)] rounded-[6px] px-2 py-1.5 bg-[var(--sps-bg-elevated)]"
        >
          <span className="text-[10px] font-mono text-[var(--sps-gold)] shrink-0">SC{sc.sceneNumber}</span>
          <span className="text-[10px] text-[var(--sps-muted)] truncate flex-1">{sc.heading || 'Scene'}</span>
          <select
            className="text-[10px] font-mono border border-[var(--sps-border)] rounded px-1 py-0.5 bg-[var(--sps-bg)]"
            value={Number(sc.sequenceSeq) || ''}
            onChange={(e) => {
              patchProductionSpineScene(projectTitle, sc.id || sc.sceneNumber, {
                sequenceSeq: Number(e.target.value)
              });
              onChanged?.();
            }}
            title="Reassign scene → sequence"
          >
            {(sequences || []).map((seq) => (
              <option key={seq.seq} value={seq.seq}>
                Seq {seq.seq}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

function SpineSequenceEditor({ projectTitle = '', sequences = [], onChanged }) {
  const [drafts, setDrafts] = useState({});

  useEffect(() => {
    setDrafts({});
  }, [sequences]);

  const patchField = (seqNum, field, value) => {
    const patch = field === 'act' ? { act: Number(value) || 1 } : { [field]: value };
    patchProductionSpineSequence(projectTitle, seqNum, patch);
    onChanged?.();
  };

  if (!sequences.length) {
    return (
      <p className="text-[11px] text-[var(--sps-muted)]">
        No sequences yet — apply Story Package or add Matrix scenes to build the spine.
      </p>
    );
  }

  return (
    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
      {sequences.map((seq) => {
        const seqNum = Number(seq.seq);
        const draft = drafts[seqNum] || {};
        const title = draft.title ?? seq.title ?? '';
        const synopsis = draft.synopsis ?? seq.synopsis ?? '';
        const act = draft.act ?? seq.act ?? 1;

        const setDraft = (field, value) => {
          setDrafts((prev) => ({
            ...prev,
            [seqNum]: { ...(prev[seqNum] || {}), [field]: value }
          }));
        };

        return (
          <div
            key={seqNum}
            className="border border-[var(--sps-border)] rounded-[6px] p-2.5 bg-[var(--sps-bg-elevated)] space-y-1.5"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono font-bold text-[var(--sps-gold)] shrink-0">
                Seq {seqNum}
              </span>
              <label className="text-[9px] text-[var(--sps-muted)] uppercase flex items-center gap-1">
                Act
                <select
                  value={act}
                  onChange={(e) => {
                    const next = Number(e.target.value) || 1;
                    setDraft('act', next);
                    patchField(seqNum, 'act', next);
                  }}
                  className="text-[10px] font-mono border border-[var(--sps-border)] rounded px-1 py-0.5 bg-[var(--sps-bg)]"
                >
                  {[1, 2, 3].map((n) => (
                    <option key={n} value={n}>
                      {ACT_TITLES[n] || `Act ${n}`}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <input
              type="text"
              value={title}
              placeholder="Sequence title"
              onChange={(e) => setDraft('title', e.target.value)}
              onBlur={(e) => {
                if (e.target.value !== (seq.title || '')) patchField(seqNum, 'title', e.target.value);
              }}
              className="w-full text-[10px] font-mono border border-[var(--sps-border)] rounded px-2 py-1 bg-[var(--sps-bg)]"
            />
            <textarea
              value={synopsis}
              placeholder="Sequence synopsis"
              rows={2}
              onChange={(e) => setDraft('synopsis', e.target.value)}
              onBlur={(e) => {
                if (e.target.value !== (seq.synopsis || '')) patchField(seqNum, 'synopsis', e.target.value);
              }}
              className="w-full text-[10px] font-mono border border-[var(--sps-border)] rounded px-2 py-1 bg-[var(--sps-bg)] resize-y"
            />
          </div>
        );
      })}
    </div>
  );
}

function StatCard({ label, value, hint, tone = 'default' }) {
  const toneClass =
    tone === 'gold' || tone === 'lock'
      ? 'border-[var(--sps-gold)]/40 text-[var(--sps-gold)]'
      : tone === 'warn'
        ? 'border-amber-500/40 text-amber-400'
        : tone === 'ok'
          ? 'border-emerald-500/40 text-emerald-400'
          : 'border-[var(--sps-border)] text-[var(--sps-text)]';
  return (
    <div className={`rounded-[8px] border p-3 bg-[var(--sps-surface)] ${toneClass}`}>
      <p className="text-[10px] uppercase tracking-widest text-[var(--sps-muted)]">{label}</p>
      <p className="text-xl font-bold font-mono mt-1">{value}</p>
      {hint ? <p className="text-[10px] text-[var(--sps-muted)] mt-1">{hint}</p> : null}
    </div>
  );
}

function LifecycleBar({ summary = {} }) {
  const total = summary.total || 0;
  if (!total) return <p className="text-[11px] text-[var(--sps-muted)]">No items</p>;
  const parts = [
    { key: 'draft', label: 'Draft', cls: 'bg-zinc-600' },
    { key: 'review', label: 'Review', cls: 'bg-amber-500' },
    { key: 'approved', label: 'Approved', cls: 'bg-emerald-500' },
    { key: 'locked', label: 'Locked', cls: 'bg-[var(--sps-gold)]' }
  ];
  return (
    <div className="space-y-1.5">
      <div className="flex h-2 rounded overflow-hidden border border-[var(--sps-border)]">
        {parts.map((p) => {
          const n = summary[p.key] || 0;
          if (!n) return null;
          return (
            <span
              key={p.key}
              className={p.cls}
              style={{ width: `${Math.max(4, (n / total) * 100)}%` }}
              title={`${p.label}: ${n}`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2 text-[10px] font-mono text-[var(--sps-muted)]">
        {parts.map((p) => (
          <span key={p.key}>
            {p.label} {summary[p.key] || 0}
          </span>
        ))}
      </div>
    </div>
  );
}

function ProjectLifecyclePanel({ projectTitle = '', record = {}, onChanged, guestPlayground = false }) {
  const status = normalizeLifecycleStatus(record?.lifecycleStatus);
  const meta = lifecycleMeta(status);
  const locked = status === 'locked';
  const bump = (result) => {
    if (!result?.ok) {
      if (result?.message) window.alert(result.message);
      return;
    }
    onChanged?.();
  };

  if (guestPlayground) {
    return (
      <div className="rounded-[8px] border border-[var(--sps-border)] p-3 bg-[var(--sps-bg-elevated)] space-y-2">
        <span className="inline-flex items-center px-2 py-1 border border-[var(--sps-border)] text-[10px] font-mono font-bold uppercase text-[var(--sps-muted)]">
          Guest playground
        </span>
        <p className="text-[10px] text-[var(--sps-muted)] m-0 leading-relaxed">{GUEST_PLAY_LIFECYCLE_MESSAGE}</p>
      </div>
    );
  }

  return (
    <div className="rounded-[8px] border border-[var(--sps-border)] p-3 bg-[var(--sps-bg-elevated)] space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span
          className={`inline-flex items-center px-2 py-1 border text-[10px] font-mono font-bold uppercase ${
            locked ? 'border-[var(--sps-gold)]/60 text-[var(--sps-gold)]' : 'border-[var(--sps-border)] text-[var(--sps-text)]'
          }`}
        >
          Project · {meta.label}
        </span>
        <div className="flex items-center gap-1">
          {!locked && meta.prev ? (
            <button type="button" className="sps-btn text-[10px]" onClick={() => bump(stepBackProjectLifecycle(projectTitle))}>
              ← Back
            </button>
          ) : null}
          {!locked ? (
            <button
              type="button"
              className="sps-btn sps-btn-primary text-[10px]"
              disabled={!meta.next}
              onClick={() => bump(advanceProjectLifecycle(projectTitle))}
            >
              {meta.next ? `Advance → ${lifecycleMeta(meta.next).short}` : 'Locked'}
            </button>
          ) : (
            <button type="button" className="sps-btn text-[10px]" onClick={() => bump(unlockProjectLifecycle(projectTitle))}>
              Unlock production
            </button>
          )}
        </div>
      </div>
      <p className="text-[10px] text-[var(--sps-muted)] m-0 leading-relaxed">
        {locked
          ? 'Production frozen — craft edits, LLM apply, and generate blocked. Pitch/promo exports allowed.'
          : 'Advance to Locked when the film is ready to share. Locks Matrix craft, Cast, World, and LLM mutations project-wide.'}
      </p>
    </div>
  );
}

function AuditRow({ row }) {
  const when = row?.at ? new Date(row.at).toLocaleString() : '';
  return (
    <div className="border border-[var(--sps-border)] rounded-[6px] px-2.5 py-2 bg-[var(--sps-bg-elevated)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-mono text-[var(--sps-text)] truncate">
            {row.action}
            {row.targetLabel ? ` · ${row.targetLabel}` : ''}
          </p>
          <p className="text-[10px] text-[var(--sps-muted)] mt-0.5">
            {row.category}
            {row.from && row.to ? ` · ${row.from} → ${row.to}` : ''}
            {row.note ? ` · ${row.note}` : ''}
          </p>
        </div>
        <span className="text-[9px] text-[var(--sps-muted)] shrink-0 font-mono">{when}</span>
      </div>
      <p className="text-[9px] text-[var(--sps-muted)] mt-1 truncate">{row.actor}</p>
    </div>
  );
}

export default function ProductionDashboardModal({
  isOpen,
  onClose,
  projectTitle = '',
  shots = [],
  onOpenLlmCommands,
  onUpdateShots,
  onUpdateShot,
  onOpenCharacterBible,
  onOpenWorld,
  onOpenDirectorVault,
  onOpenDopVault,
  onOpenSoundVault
}) {
  const [snap, setSnap] = useState(null);
  const [auditFilter, setAuditFilter] = useState('all');
  const [exportAuditFilter, setExportAuditFilter] = useState('all');
  const [jobFilter, setJobFilter] = useState('all');
  const guestPlayground = isGuestPlayTitle(projectTitle);
  const exportLifeGate = useMemo(
    () => lifecycleExportReadiness(shots, projectTitle),
    [shots, projectTitle]
  );
  const {
    strict: continuityLifecycleStrict,
    mode: continuityLifecycleMode
  } = useExportLifecyclePref('continuity');
  const continuityExportBlocked = continuityLifecycleStrict && !exportLifeGate.exportReady;
  const roomId = resolveCollabRoomId();

  const refresh = useCallback(async () => {
    const characters = getActiveCharacterProfiles();
    const worldAssets = getActiveWorldAssets();
    const sync = await fetchCloudSyncHealth().catch(() => readCloudSyncHealth());
    const kvMigration = await fetchKvMigrationStatus().catch(() => null);
    const library = readLocalProjectLibrary();
    const projectRecord =
      library.find((p) => String(p?.title || '').trim().toLowerCase() === String(projectTitle || '').trim().toLowerCase()) ||
      null;
    const dashboard = buildProductionDashboard({
      projectTitle,
      shots,
      characters,
      worldAssets,
      projectRecord
    });
    setSnap({
      ...dashboard,
      export: exportAuditSummary(projectTitle, shots, roomId, {
        filter: exportAuditFilter,
        limit: 12
      }),
      audit: creativeAuditSummary(projectTitle, { filter: auditFilter, limit: 24 }),
      sync,
      kvMigration
    });
  }, [projectTitle, shots, auditFilter, exportAuditFilter, roomId]);

  const handleHealBibleSoT = useCallback(() => {
    const library = readLocalProjectLibrary();
    const projectRecord =
      library.find((p) => String(p?.title || '').trim().toLowerCase() === String(projectTitle || '').trim().toLowerCase()) ||
      { title: projectTitle, shots };
    const drift = detectBibleSoTDrift({ projectTitle, project: projectRecord });
    if (!drift.drift) {
      window.alert('Cast/World/Director stores are already aligned.');
      refresh();
      return;
    }
    const healed = healBibleSoTDrift({ projectTitle, project: projectRecord });
    if (!healed.ok || !healed.project) return;
    const nextLibrary = patchLibraryProjectBibleFields(library, projectTitle, {
      characterProfiles: healed.project.characterProfiles,
      worldAssets: healed.project.worldAssets,
      directorPsychology: healed.project.directorPsychology
    });
    writeLocalProjectLibrary(nextLibrary);
    saveActiveCharacterProfiles(healed.project.characterProfiles || [], { title: projectTitle, silent: true });
    saveActiveWorldAssets(healed.project.worldAssets || [], { title: projectTitle, silent: true });
    refresh();
  }, [projectTitle, shots, refresh]);

  useEffect(() => {
    if (!isOpen) return undefined;
    refresh();
    const onJobs = () => refresh();
    const onAudit = () => refresh();
    window.addEventListener('sps_generation_job_updated', onJobs);
    window.addEventListener('sps_creative_audit_updated', onAudit);
    window.addEventListener('sps_production_spine_updated', onJobs);
    window.addEventListener('sps_llm_commands_updated', onJobs);
    window.addEventListener('sps_project_lifecycle_updated', onJobs);
    return () => {
      window.removeEventListener('sps_generation_job_updated', onJobs);
      window.removeEventListener('sps_creative_audit_updated', onAudit);
      window.removeEventListener('sps_production_spine_updated', onJobs);
      window.removeEventListener('sps_llm_commands_updated', onJobs);
      window.removeEventListener('sps_project_lifecycle_updated', onJobs);
    };
  }, [isOpen, refresh]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      onClose?.();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [isOpen, onClose]);

  if (!isOpen || !snap) return null;

  const allJobs = readJobsForTitle(projectTitle);
  const filteredJobs = filterGenerationJobsBySource(allJobs, jobFilter).slice(0, 12);
  const shotLife = snap.shots.lifecycle;
  const projectLife = snap.projectLifecycle || {};
  const pendingJobs = snap.jobs.pending;
  const pendingLlm = snap.llm?.pending || 0;
  const drift = snap.shots.drift || { count: 0, shotCount: 0, preview: [] };
  const exportAudit = snap.export || { ok: 0, blocked: 0, entitled: true, recent: [], lifecycle: {}, collabRoomId: '' };
  const exportLife = exportAudit.lifecycle || {};
  const writeAudit = snap.write || { blocked: 0, recent: [], projectLocked: false };
  const spineStale = spineNeedsRebuild(projectTitle, shots);

  const handleProposeContinuityFixes = () => {
    const { proposals, skipped } = proposeContinuityDriftFixes(projectTitle, shots);
    refresh();
    if (!proposals.length) {
      window.alert(skipped.length ? skipped.map((s) => s.error).join('\n') : 'No continuity drift to document.');
      return;
    }
    onOpenLlmCommands?.();
  };

  const handleExportContinuityPdf = () => {
    if (continuityExportBlocked) {
      assertExportAllowed({
        projectTitle,
        label: 'continuity_report_pdf',
        format: 'pdf',
        lifecycleMode: continuityLifecycleMode,
        shots,
        roomId,
        showAlert: true
      });
      return;
    }
    const gate = assertExportAllowed({
      projectTitle,
      label: 'continuity_report_pdf',
      format: 'pdf',
      lifecycleMode: continuityLifecycleMode,
      shots,
      roomId,
      showAlert: true
    });
    if (!gate.ok) return;
    const issues = scanContinuityDrift(shots);
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.alert('Please allow popups to export PDF.');
      return;
    }
    printWindow.document.write(
      continuityDriftToPrintHtml({
        projectTitle,
        issues,
        summary: drift,
        roomId
      })
    );
    printWindow.document.close();
    const slug = String(projectTitle || 'project').replace(/[^\w\-]+/g, '_').slice(0, 40);
    const roomTag = roomId ? `_${String(roomId).replace(/[^\w\-]+/g, '_').slice(0, 24)}` : '';
    const lifeNote = `${drift.count || issues.length} drift · ${drift.shotCount || 0} shots${roomId ? ` · room:${roomId}` : ''}`;
    logExportSuccess({
      projectTitle,
      label: 'continuity_report_pdf',
      format: 'pdf',
      filename: `${slug}_continuity_report${roomTag}.pdf`,
      roomId,
      note: lifeNote,
      lifecycleMode: gate.advisory ? `${continuityLifecycleMode}+ok` : continuityLifecycleMode
    });
  };

  const handleExportContinuityCsv = () => {
    const issues = scanContinuityDrift(shots);
    const slug = String(projectTitle || 'project').replace(/[^\w\-]+/g, '_').slice(0, 40);
    const roomTag = roomId ? `_${String(roomId).replace(/[^\w\-]+/g, '_').slice(0, 24)}` : '';
    const lifeNote = `${drift.count || issues.length} drift · ${drift.shotCount || 0} shots${roomId ? ` · room:${roomId}` : ''}`;
    exportDownloadText(
      `${slug}_continuity_report${roomTag}.csv`,
      continuityDriftToCsv({ projectTitle, issues, summary: drift, roomId }),
      {
        projectTitle,
        auditLabel: 'continuity_report_csv',
        auditFormat: 'csv',
        mime: 'text/csv;charset=utf-8',
        lifecycleMode: continuityLifecycleMode,
        shots,
        roomId,
        note: lifeNote
      }
    );
  };

  const handleExportContinuityFixesCsv = () => {
    const fixes = [];
    (Array.isArray(shots) ? shots : []).forEach((shot, index) => {
      buildContinuityFixesForShot(shot, shots, index).forEach((fix) => fixes.push(fix));
    });
    const slug = String(projectTitle || 'project').replace(/[^\w\-]+/g, '_').slice(0, 40);
    const roomTag = roomId ? `_${String(roomId).replace(/[^\w\-]+/g, '_').slice(0, 24)}` : '';
    const lifeNote = `${fixes.length} fixes · ${drift.shotCount || 0} shots${roomId ? ` · room:${roomId}` : ''}`;
    exportDownloadText(
      `${slug}_continuity_fixes${roomTag}.csv`,
      continuityFixesToCsv({ projectTitle, fixes, roomId }),
      {
        projectTitle,
        auditLabel: 'continuity_fixes_csv',
        auditFormat: 'csv',
        mime: 'text/csv;charset=utf-8',
        lifecycleMode: continuityLifecycleMode,
        shots,
        roomId,
        note: lifeNote
      }
    );
  };

  const handleExportContinuityFixesPdf = () => {
    if (continuityExportBlocked) {
      assertExportAllowed({
        projectTitle,
        label: 'continuity_fixes_pdf',
        format: 'pdf',
        lifecycleMode: continuityLifecycleMode,
        shots,
        roomId,
        showAlert: true
      });
      return;
    }
    const gate = assertExportAllowed({
      projectTitle,
      label: 'continuity_fixes_pdf',
      format: 'pdf',
      lifecycleMode: continuityLifecycleMode,
      shots,
      roomId,
      showAlert: true
    });
    if (!gate.ok) return;
    const fixes = [];
    (Array.isArray(shots) ? shots : []).forEach((shot, index) => {
      buildContinuityFixesForShot(shot, shots, index).forEach((fix) => fixes.push(fix));
    });
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.alert('Please allow popups to export PDF.');
      return;
    }
    printWindow.document.write(
      continuityFixesToPrintHtml({
        projectTitle,
        fixes,
        roomId
      })
    );
    printWindow.document.close();
    const slug = String(projectTitle || 'project').replace(/[^\w\-]+/g, '_').slice(0, 40);
    const roomTag = roomId ? `_${String(roomId).replace(/[^\w\-]+/g, '_').slice(0, 24)}` : '';
    const lifeNote = `${fixes.length} fixes · ${drift.shotCount || 0} shots${roomId ? ` · room:${roomId}` : ''}`;
    logExportSuccess({
      projectTitle,
      label: 'continuity_fixes_pdf',
      format: 'pdf',
      filename: `${slug}_continuity_fixes${roomTag}.pdf`,
      roomId,
      note: lifeNote,
      lifecycleMode: gate.advisory ? `${continuityLifecycleMode}+ok` : continuityLifecycleMode
    });
  };

  const handleExportContinuityFixesMd = () => {
    const fixes = [];
    (Array.isArray(shots) ? shots : []).forEach((shot, index) => {
      buildContinuityFixesForShot(shot, shots, index).forEach((fix) => fixes.push(fix));
    });
    const slug = String(projectTitle || 'project').replace(/[^\w\-]+/g, '_').slice(0, 40);
    const roomTag = roomId ? `_${String(roomId).replace(/[^\w\-]+/g, '_').slice(0, 24)}` : '';
    const lifeNote = `${fixes.length} fixes · ${drift.shotCount || 0} shots${roomId ? ` · room:${roomId}` : ''}`;
    exportDownloadText(
      `${slug}_continuity_fixes${roomTag}.md`,
      continuityFixesToMarkdown({ projectTitle, fixes, roomId }),
      {
        projectTitle,
        auditLabel: 'continuity_fixes_md',
        auditFormat: 'md',
        mime: 'text/markdown;charset=utf-8',
        lifecycleMode: continuityLifecycleMode,
        shots,
        roomId,
        note: lifeNote
      }
    );
  };

  const handleExportContinuityFixesZip = async () => {
    if (continuityExportBlocked) {
      assertExportAllowed({
        projectTitle,
        label: 'continuity_fixes_zip',
        format: 'zip',
        lifecycleMode: continuityLifecycleMode,
        shots,
        roomId,
        showAlert: true
      });
      return;
    }
    const gate = assertExportAllowed({
      projectTitle,
      label: 'continuity_fixes_zip',
      format: 'zip',
      lifecycleMode: continuityLifecycleMode,
      shots,
      roomId,
      showAlert: true
    });
    if (!gate.ok) return;
    const fixes = [];
    (Array.isArray(shots) ? shots : []).forEach((shot, index) => {
      buildContinuityFixesForShot(shot, shots, index).forEach((fix) => fixes.push(fix));
    });
    const slug = String(projectTitle || 'project').replace(/[^\w\-]+/g, '_').slice(0, 40);
    const roomTag = roomId ? `_${String(roomId).replace(/[^\w\-]+/g, '_').slice(0, 24)}` : '';
    const lifeNote = `${fixes.length} fixes · ${drift.shotCount || 0} shots${roomId ? ` · room:${roomId}` : ''}`;
    const files = buildContinuityFixesZipFiles({
      projectTitle,
      fixes,
      roomId
    });
    const blob = createZipArchive(files);
    await saveExportBlob(blob, `${slug}_continuity_fixes${roomTag}.zip`, {
      projectTitle,
      shots,
      lifecycleMode: continuityLifecycleMode,
      skipLifecycleCheck: true,
      advisoryAlready: Boolean(gate.advisory),
      auditLabel: 'continuity_fixes_zip',
      auditFormat: 'zip',
      roomId,
      note: lifeNote,
      showAlert: false
    });
  };



  
  const handleExportContinuityMd = () => {
    const issues = scanContinuityDrift(shots);
    const slug = String(projectTitle || 'project').replace(/[^\w\-]+/g, '_').slice(0, 40);
    const roomTag = roomId ? `_${String(roomId).replace(/[^\w\-]+/g, '_').slice(0, 24)}` : '';
    const lifeNote = `${drift.count || issues.length} drift · ${drift.shotCount || 0} shots${roomId ? ` · room:${roomId}` : ''}`;
    exportDownloadText(
      `${slug}_continuity_report${roomTag}.md`,
      continuityDriftToMarkdown({ projectTitle, issues, summary: drift, roomId }),
      {
        projectTitle,
        auditLabel: 'continuity_report_md',
        auditFormat: 'md',
        mime: 'text/markdown;charset=utf-8',
        lifecycleMode: continuityLifecycleMode,
        shots,
        roomId,
        note: lifeNote
      }
    );
  };

  const handleExportContinuityZip = async () => {
    if (continuityExportBlocked) {
      assertExportAllowed({
        projectTitle,
        label: 'continuity_report_zip',
        format: 'zip',
        lifecycleMode: continuityLifecycleMode,
        shots,
        roomId,
        showAlert: true
      });
      return;
    }
    const gate = assertExportAllowed({
      projectTitle,
      label: 'continuity_report_zip',
      format: 'zip',
      lifecycleMode: continuityLifecycleMode,
      shots,
      roomId,
      showAlert: true
    });
    if (!gate.ok) return;
    const issues = scanContinuityDrift(shots);
    const slug = String(projectTitle || 'project').replace(/[^\w\-]+/g, '_').slice(0, 40);
    const roomTag = roomId ? `_${String(roomId).replace(/[^\w\-]+/g, '_').slice(0, 24)}` : '';
    const lifeNote = `${drift.count || issues.length} drift · ${drift.shotCount || 0} shots${roomId ? ` · room:${roomId}` : ''}`;
    const files = buildContinuityZipFiles({
      projectTitle,
      issues,
      summary: drift,
      roomId
    });
    const blob = createZipArchive(files);
    await saveExportBlob(blob, `${slug}_continuity_report${roomTag}.zip`, {
      projectTitle,
      shots,
      lifecycleMode: continuityLifecycleMode,
      skipLifecycleCheck: true,
      advisoryAlready: Boolean(gate.advisory),
      auditLabel: 'continuity_report_zip',
      auditFormat: 'zip',
      roomId,
      note: lifeNote,
      showAlert: false
    });
  };

  const handleApplyContinuityFixes = () => {
    if (
      !window.confirm(
        `Apply ${drift.count} continuity patch${drift.count === 1 ? '' : 'es'}? Matrix continuityPatch fields will update.`
      )
    ) {
      return;
    }
    const result = applyContinuityDriftFixes(projectTitle, shots, {
      updateShot: (index, shot) => onUpdateShot?.(index, shot)
    });
    refresh();
    if (result.applied) {
      window.alert(result.message);
      return;
    }
    window.alert(result.message || result.errors?.join('\n') || 'Nothing applied.');
  };

  return (
    <div className="sps-overlay" style={{ zIndex: 92 }}>
      <div className="sps-shell sps-shell-lg flex flex-col max-h-[92vh]">
        <div className="px-4 py-3 border-b border-[var(--sps-border)] bg-[var(--sps-bg-elevated)] flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <h2
              className="text-sm font-semibold tracking-tight flex items-center gap-2"
              style={{ fontFamily: 'var(--sps-font-display)', color: 'var(--sps-text)' }}
            >
              <Clapperboard className="w-4 h-4 text-[var(--sps-gold)]" />
              Production dashboard
            </h2>
            <p className="text-[11px] text-[var(--sps-muted)] truncate">
              {snap.projectTitle || 'Untitled'} · runtime · takes · jobs · approvals · audit
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {pendingLlm > 0 ? (
              <button
                type="button"
                className="sps-btn sps-btn-compact text-[10px] flex items-center gap-1"
                title="Review pending LLM commands"
                onClick={() => onOpenLlmCommands?.()}
              >
                <GitBranch className="w-3.5 h-3.5" />
                LLM review ({pendingLlm})
              </button>
            ) : null}
            <button type="button" className="sps-icon-btn" title="Refresh" onClick={refresh}>
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="sps-icon-btn"
              title="Full creative audit JSON"
              onClick={() => exportCreativeAuditJson(projectTitle)}
            >
              <Download className="w-4 h-4" />
            </button>
            <button type="button" className="sps-icon-btn" onClick={onClose} aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <StatCard
              label="Runtime (est.)"
              value={`~${snap.runtime.minutes} min`}
              hint={`${snap.runtime.count} live shots · ${Math.round(snap.runtime.sec)}s`}
            />
            <StatCard
              label="Shot approval"
              value={`${snap.shots.approvalPct}%`}
              hint={`${shotLife.locked} locked · ${shotLife.approved} approved`}
              tone="gold"
            />
            <StatCard
              label="Generate jobs"
              value={pendingJobs}
              hint={`${snap.jobs.succeeded} done · ${snap.jobs.failed} failed`}
              tone={pendingJobs ? 'warn' : 'ok'}
            />
            <StatCard
              label="LLM commands"
              value={pendingLlm}
              hint="Awaiting review"
              tone={pendingLlm ? 'warn' : 'ok'}
            />
            <StatCard
              label="Credits"
              value={snap.saas.credits}
              hint={`${snap.saas.plan} · ${snap.saas.email}`}
            />
            <StatCard
              label="Cloud sync"
              value={syncBackendLabel(snap.sync?.backend)}
              hint={
                snap.kvMigration?.kvConfigured
                  ? snap.kvMigration.ready
                    ? 'KV stores ready'
                    : snap.kvMigration.needsMigration
                      ? 'KV migrate needed — Settings → SaaS'
                      : 'KV configured'
                  : snap.sync?.kvConfigured
                    ? 'Upstash KV durable'
                    : snap.sync?.durableOk
                      ? 'JSONBlob fallback'
                      : 'Check connection'
              }
              tone={
                snap.kvMigration?.needsMigration
                  ? 'warn'
                  : snap.sync?.kvConfigured || snap.kvMigration?.ready
                    ? 'ok'
                    : snap.sync?.durableOk
                      ? 'gold'
                      : 'warn'
              }
            />
          </div>

          <section className="space-y-2">
            <h3 className="text-[11px] uppercase tracking-widest text-[var(--sps-muted)] flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              Project lifecycle
            </h3>
            <ProjectLifecyclePanel
              projectTitle={projectTitle}
              record={projectLife}
              onChanged={refresh}
              guestPlayground={guestPlayground}
            />
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <section className="space-y-2">
              <h3 className="text-[11px] uppercase tracking-widest text-[var(--sps-muted)] flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                Shot lifecycle
              </h3>
              <LifecycleBar summary={shotLife} />
              {typeof onUpdateShots === 'function' && projectLife?.lifecycleStatus !== 'locked' && !guestPlayground ? (
                <button
                  type="button"
                  className="sps-btn text-[10px]"
                  title="Advance every live unlocked shot one step"
                  onClick={() => {
                    const result = bulkAdvanceShotLifecycle(shots, { projectTitle });
                    if (!result.ok) {
                      window.alert(result.message);
                      return;
                    }
                    if (result.advanced) onUpdateShots(result.shots);
                    refresh();
                    if (!result.advanced) window.alert(result.message);
                  }}
                >
                  Bulk advance all shots →
                </button>
              ) : guestPlayground ? (
                <p className="text-[10px] text-[var(--sps-muted)]">{GUEST_PLAY_LIFECYCLE_MESSAGE}</p>
              ) : null}
              <p className="text-[11px] text-[var(--sps-muted)]">
                Characters {snap.assets.characters.total} · World {snap.assets.world.total}
              </p>
              <LifecycleBar summary={snap.assets.characters.lifecycle} />
              {projectLife?.lifecycleStatus !== 'locked' && !guestPlayground ? (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    className="sps-btn text-[10px]"
                    onClick={() => {
                      const result = bulkAdvanceAssetLifecycle(getActiveCharacterProfiles(), {
                        projectTitle,
                        label: 'cast'
                      });
                      if (!result.ok) {
                        window.alert(result.message);
                        return;
                      }
                      if (result.advanced) {
                        saveActiveCharacterProfiles(result.assets, { title: projectTitle });
                      }
                      refresh();
                      if (!result.advanced) window.alert(result.message);
                    }}
                  >
                    Bulk advance Cast →
                  </button>
                  <button
                    type="button"
                    className="sps-btn text-[10px]"
                    onClick={() => {
                      const result = bulkAdvanceAssetLifecycle(getActiveWorldAssets(), {
                        projectTitle,
                        label: 'world'
                      });
                      if (!result.ok) {
                        window.alert(result.message);
                        return;
                      }
                      if (result.advanced) {
                        saveActiveWorldAssets(result.assets, { title: projectTitle });
                      }
                      refresh();
                      if (!result.advanced) window.alert(result.message);
                    }}
                  >
                    Bulk advance World →
                  </button>
                </div>
              ) : null}
            </section>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <StatCard label="Still takes" value={snap.takes.stillTakes} hint="Append-only" />
            <StatCard label="Video takes" value={snap.takes.videoTakes} hint="Multi-take queue" />
            <StatCard
              label="Continuity ready"
              value={snap.shots.continuity.ready}
              hint={`${snap.shots.continuity.warn} warn · ${snap.shots.continuity.block} block`}
              tone={snap.shots.continuity.block ? 'warn' : 'ok'}
            />
            <StatCard
              label="Shots w/ media"
              value={snap.takes.shotsWithMedia}
              hint={`of ${snap.shots.total} live`}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <StatCard label="Acts" value={snap.spine.acts || 0} hint="Three-act spine" />
            <StatCard label="Sequences" value={snap.spine.sequences || 0} hint="Story package" />
            <StatCard label="Scenes" value={snap.spine.scenes || 0} hint="Matrix groupings" />
            <StatCard label="Shots" value={snap.shots.total} hint="Live rows" />
          </div>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-[11px] uppercase tracking-widest text-[var(--sps-muted)]">
                Production Bible
              </h3>
              <span className="text-[10px] font-mono text-[var(--sps-muted)]">
                {snap.bible?.pct ?? 0}% complete
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <StatCard label="Cast" value={snap.bible?.cast ?? 0} hint={snap.bible?.castOk ? 'Ready' : 'Empty'} tone={snap.bible?.castOk ? 'ok' : 'warn'} />
              <StatCard label="World" value={snap.bible?.world ?? 0} hint={snap.bible?.worldOk ? 'Ready' : 'Empty'} tone={snap.bible?.worldOk ? 'ok' : 'warn'} />
              <StatCard label="Director" value={snap.bible?.directorOk ? '✓' : '—'} hint="Vision vault" tone={snap.bible?.directorOk ? 'ok' : 'warn'} />
              <StatCard label="DoP" value={snap.bible?.dopOk ? '✓' : '—'} hint="Look / camera" tone={snap.bible?.dopOk ? 'ok' : 'warn'} />
              <StatCard label="Sound" value={snap.bible?.soundOk ? '✓' : '—'} hint="Motif / score" tone={snap.bible?.soundOk ? 'ok' : 'warn'} />
            </div>
            {snap.bible?.soT?.drift ? (
              <div className="flex flex-wrap items-center gap-2 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1.5">
                <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                <span className="text-[10px] text-amber-100/90 flex-1 min-w-[12rem]">
                  Bible SoT drift — {snap.bible.soT.issueCount} mismatch{snap.bible.soT.issueCount === 1 ? '' : 'es'} between library, vault, and active cache.
                </span>
                <button type="button" className="sps-btn sps-btn-compact text-[10px]" onClick={handleHealBibleSoT}>
                  Heal stores
                </button>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-1.5">
              {onOpenCharacterBible ? (
                <button type="button" className="sps-btn sps-btn-compact text-[10px]" onClick={() => onOpenCharacterBible()}>
                  Open Cast
                </button>
              ) : null}
              {onOpenWorld ? (
                <button type="button" className="sps-btn sps-btn-compact text-[10px]" onClick={() => onOpenWorld()}>
                  Open World
                </button>
              ) : null}
              {onOpenDirectorVault ? (
                <button type="button" className="sps-btn sps-btn-compact text-[10px]" onClick={() => onOpenDirectorVault()}>
                  Director vault
                </button>
              ) : null}
              {onOpenDopVault ? (
                <button type="button" className="sps-btn sps-btn-compact text-[10px]" onClick={() => onOpenDopVault()}>
                  DoP vault
                </button>
              ) : null}
              {onOpenSoundVault ? (
                <button type="button" className="sps-btn sps-btn-compact text-[10px]" onClick={() => onOpenSoundVault()}>
                  Sound vault
                </button>
              ) : null}
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-[11px] uppercase tracking-widest text-[var(--sps-muted)]">
                Shot Spec · asset IDs
              </h3>
              {onUpdateShots ? (
                <button
                  type="button"
                  className="sps-btn sps-btn-compact text-[10px]"
                  title="Mint CHAR_/WORLD_ IDs on Cast/World and link shots from @tags"
                  onClick={() => {
                    const result = applyProductionAssetSpec({
                      projectTitle,
                      shots,
                      characters: getActiveCharacterProfiles(),
                      worldAssets: getActiveWorldAssets()
                    });
                    if (result?.characters) {
                      saveActiveCharacterProfiles(result.characters, { title: projectTitle });
                    }
                    if (result?.worldAssets) {
                      saveActiveWorldAssets(result.worldAssets, { title: projectTitle });
                    }
                    if (result?.shots) onUpdateShots(result.shots);
                    refresh();
                  }}
                >
                  Relink assets
                </button>
              ) : null}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <StatCard
                label="Craft fill"
                value={`${snap.shotSpec?.avgCraftPct ?? 0}%`}
                hint="Avg across live shots"
              />
              <StatCard
                label="CHAR_ refs"
                value={snap.shotSpec?.withCharRefs ?? 0}
                hint={`of ${snap.shots.total} shots`}
                tone={snap.shotSpec?.withCharRefs ? 'ok' : 'warn'}
              />
              <StatCard
                label="WORLD_ refs"
                value={snap.shotSpec?.withWorldRefs ?? 0}
                hint={`Registry · ${snap.registry?.characters || 0} cast / ${snap.registry?.world || 0} world`}
                tone={snap.shotSpec?.withWorldRefs ? 'ok' : 'warn'}
              />
              <StatCard
                label="Spec ready"
                value={snap.shotSpec?.fullySpecced ?? 0}
                hint="≥60% craft + CHAR_"
                tone={snap.shotSpec?.fullySpecced ? 'ok' : 'default'}
              />
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-[11px] uppercase tracking-widest text-[var(--sps-muted)]">
                Continuity supervisor
              </h3>
              <div className="flex flex-wrap gap-1.5 items-center">
                <button
                  type="button"
                  className="sps-btn sps-btn-compact text-[10px] disabled:opacity-40"
                  disabled={continuityExportBlocked}
                  title={continuityExportBlocked ? exportLifeGate.message : 'Print continuity drift report as PDF'}
                  onClick={handleExportContinuityPdf}
                >
                  <Download className="w-3 h-3" />
                  Report PDF
                </button>
                <button
                  type="button"
                  className="sps-btn sps-btn-compact text-[10px] disabled:opacity-40"
                  disabled={continuityExportBlocked}
                  title={continuityExportBlocked ? exportLifeGate.message : 'Export continuity drift CSV'}
                  onClick={handleExportContinuityCsv}
                >
                  <Download className="w-3 h-3" />
                  Report CSV
                </button>
                <button
                  type="button"
                  className="sps-btn sps-btn-compact text-[10px] disabled:opacity-40"
                  disabled={continuityExportBlocked}
                  title={continuityExportBlocked ? exportLifeGate.message : 'Export continuity fixes CSV'}
                  onClick={handleExportContinuityFixesCsv}
                >
                  <Download className="w-3 h-3" />
                  Fixes CSV
                </button>
                <button
                  type="button"
                  className="sps-btn sps-btn-compact text-[10px] disabled:opacity-40"
                  disabled={continuityExportBlocked}
                  title={continuityExportBlocked ? exportLifeGate.message : 'Print continuity fixes as PDF'}
                  onClick={handleExportContinuityFixesPdf}
                >
                  <Download className="w-3 h-3" />
                  Fixes PDF
                </button>
                <button
                  type="button"
                  className="sps-btn sps-btn-compact text-[10px] disabled:opacity-40"
                  disabled={continuityExportBlocked}
                  title={continuityExportBlocked ? exportLifeGate.message : 'Export continuity fixes Markdown'}
                  onClick={handleExportContinuityFixesMd}
                >
                  <Download className="w-3 h-3" />
                  Fixes MD
                </button>
                <button
                  type="button"
                  className="sps-btn sps-btn-compact text-[10px] disabled:opacity-40"
                  disabled={continuityExportBlocked}
                  title={continuityExportBlocked ? exportLifeGate.message : 'Export continuity fixes ZIP (CSV + META)'}
                  onClick={handleExportContinuityFixesZip}
                >
                  <Download className="w-3 h-3" />
                  Fixes ZIP
                </button>
                <button
                  type="button"
                  className="sps-btn sps-btn-compact text-[10px] disabled:opacity-40"
                  disabled={continuityExportBlocked}
                  title={continuityExportBlocked ? exportLifeGate.message : 'Export continuity pack ZIP (CSV + META)'}
                  onClick={handleExportContinuityZip}
                >
                  <Download className="w-3 h-3" />
                  Report ZIP
                </button>
                {drift.count > 0 && !guestPlayground ? (
                  <>
                    <button
                      type="button"
                      className="sps-btn sps-btn-compact text-[10px]"
                      onClick={handleProposeContinuityFixes}
                    >
                      Propose {drift.count} patch{drift.count === 1 ? '' : 'es'}
                    </button>
                    {typeof onUpdateShot === 'function' ? (
                      <button
                        type="button"
                        className="sps-btn sps-btn-primary sps-btn-compact text-[10px]"
                        onClick={handleApplyContinuityFixes}
                      >
                        Apply all →
                      </button>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>
            {drift.count === 0 ? (
              <p className="text-[11px] text-[var(--sps-muted)]">
                No costume/injury/prop drift without explicit patches.
              </p>
            ) : (
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {drift.preview.map((row) => (
                  <p key={`${row.shotIndex}-${row.charKey}`} className="text-[10px] font-mono text-amber-400/90 truncate">
                    {row.sceneShotId} · {row.name}: {row.deltas.join(', ')}
                  </p>
                ))}
                {drift.count > drift.preview.length ? (
                  <p className="text-[9px] text-[var(--sps-muted)]">
                    +{drift.count - drift.preview.length} more across {drift.shotCount} shot{drift.shotCount === 1 ? '' : 's'}
                  </p>
                ) : null}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-[11px] uppercase tracking-widest text-[var(--sps-muted)]">Production spine</h3>
              {spineStale && !guestPlayground ? (
                <button
                  type="button"
                  className="sps-btn sps-btn-compact text-[10px]"
                  onClick={() => {
                    autoSyncProductionSpine({ projectTitle, shots, force: true });
                    refresh();
                  }}
                >
                  Rebuild spine
                </button>
              ) : null}
            </div>
            {spineStale ? (
              <p className="text-[10px] text-amber-400/90">
                Spine out of date vs Matrix — auto-rebuilds on shot edits; click Rebuild to sync now.
              </p>
            ) : null}
            <SpineTree spine={snap.spine} projectTitle={projectTitle} onChanged={refresh} />
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-[10px] uppercase tracking-widest text-[var(--sps-muted)] m-0">Scene → sequence</h4>
                <button
                  type="button"
                  className="sps-btn sps-btn-compact text-[10px]"
                  title="Write spine sequence/scene edits back to Story Package"
                  onClick={() => {
                    const spine = readProductionSpine(projectTitle);
                    if (!spine) {
                      window.alert('No production spine to write back.');
                      return;
                    }
                    const pkg = writeStoryPackageFromSpine(spine, { projectTitle });
                    if (!pkg) {
                      window.alert('Story Package write-back failed — open Story Package first.');
                      return;
                    }
                    refresh();
                    window.alert('Story Package updated from spine.');
                  }}
                >
                  Write back to Story Package
                </button>
              </div>
              <SpineSceneReassign
                projectTitle={projectTitle}
                scenes={snap.spine.sceneList || []}
                sequences={snap.spine.sequenceList || []}
                onChanged={refresh}
              />
            </div>
            {(snap.continuityTimeline?.characters || []).length ? (
              <div className="mt-3 space-y-1.5">
                <h4 className="text-[10px] uppercase tracking-widest text-[var(--sps-muted)] m-0">
                  Character continuity · {snap.continuityTimeline.drifts || 0} undoc. drifts
                </h4>
                <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                  {snap.continuityTimeline.characters.map((ch) => (
                    <div key={ch.key} className="text-[10px] border border-[var(--sps-border)] rounded px-2 py-1 bg-[var(--sps-bg-elevated)]">
                      <span className="font-mono font-bold text-[var(--sps-text)]">{ch.name}</span>
                      <span className="text-[var(--sps-muted)]"> · {(ch.beats || []).filter((b) => b.changed).length} changes</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <SpineSequenceEditor
              projectTitle={projectTitle}
              sequences={snap.spine.sequenceList || []}
              onChanged={refresh}
            />
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-[11px] uppercase tracking-widest text-[var(--sps-muted)] m-0">Export gate audit</h3>
              <div className="flex items-center gap-1.5">
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
                      filter: exportAuditFilter,
                      lifecycleMode: EXPORT_LIFECYCLE.NONE
                    })
                  }
                >
                  <Download className="w-3 h-3" />
                  Audit CSV
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <StatCard
                label="Plan export"
                value={exportAudit.entitled ? 'On' : 'Off'}
                hint={exportAudit.entitled ? 'Feature enabled' : 'Blocked by plan'}
                tone={exportAudit.entitled ? 'ok' : 'warn'}
              />
              <StatCard label="Exports OK" value={exportAudit.ok || 0} hint="Audited successes" tone="ok" />
              <StatCard
                label="Blocked"
                value={exportAudit.blocked || 0}
                hint="Gate denials logged"
                tone={exportAudit.blocked ? 'warn' : 'default'}
              />
              <StatCard
                label="Lifecycle tagged"
                value={exportAudit.lifecycleTagged || 0}
                hint="Rows with life: in note"
                tone={(exportAudit.lifecycleTagged || 0) > 0 ? 'gold' : 'default'}
              />
              <StatCard
                label="Room tagged"
                value={exportAudit.roomTagged || 0}
                hint={exportAudit.collabRoomId ? exportAudit.collabRoomId : 'No active room'}
                tone={(exportAudit.roomTagged || 0) > 0 ? 'gold' : 'default'}
              />
            </div>
            {exportAudit.collabRoomId ? (
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-[10px] font-mono text-[var(--sps-muted)] truncate m-0">
                  Collab room · {exportAudit.collabRoomId}
                  {exportAudit.roomTagged
                    ? ` · ${exportAudit.roomTagged} export${exportAudit.roomTagged === 1 ? '' : 's'} tagged`
                    : ''}
                </p>
                <button
                  type="button"
                  className="sps-btn text-[9px] px-1.5 py-0.5"
                  title="Filter export audit to room-tagged rows"
                  onClick={() => setExportAuditFilter('room')}
                >
                  Filter room
                </button>
              </div>
            ) : (
              <p className="text-[10px] font-mono text-[var(--sps-muted)] m-0">
                No collab room id — Room filter still matches room: / presence audit notes
              </p>
            )}
            <div className="grid grid-cols-3 gap-2">
              <StatCard
                label="Locked looks"
                value={exportLife.locked ?? 0}
                hint={`${exportLife.live ?? 0} live shots`}
                tone={(exportLife.locked ?? 0) > 0 ? 'ok' : 'default'}
              />
              <StatCard
                label="Share ready"
                value={exportLife.exportReady ? 'Yes' : 'No'}
                hint={exportLife.exportReady ? 'Pitch/promo OK' : 'Lock or approve looks'}
                tone={exportLife.exportReady ? 'ok' : 'warn'}
              />
              <StatCard
                label="Approved+"
                value={exportLife.approved ?? 0}
                hint="Approved or locked"
                tone="default"
              />
            </div>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="sps-tabs sps-tabs-compact" role="tablist" aria-label="Export audit filter">
                {EXPORT_AUDIT_FILTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    role="tab"
                    aria-selected={exportAuditFilter === opt.id}
                    className="text-[9px]"
                    title={
                      opt.id === 'room'
                        ? `Room-tagged exports${exportAudit.roomTagged ? ` · ${exportAudit.roomTagged}` : ''}`
                        : opt.label
                    }
                    onClick={() => setExportAuditFilter(opt.id)}
                  >
                    {opt.id === 'room' && (exportAudit.roomTagged || 0) > 0
                      ? `Room (${exportAudit.roomTagged})`
                      : opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[9px] font-mono text-[var(--sps-muted)] m-0">
                {exportAudit.filteredTotal ?? exportAudit.recent?.length ?? 0} / {exportAudit.total ?? 0} rows
              </p>
            </div>
            {exportAudit.recent?.length ? (
              <div className="space-y-1 max-h-28 overflow-y-auto">
                {exportAudit.recent.map((row) => (
                  <p
                    key={row.id}
                    className={`text-[10px] font-mono truncate ${
                      row.action === 'export_blocked' ? 'text-rose-400' : 'text-[var(--sps-muted)]'
                    }`}
                  >
                    {row.action} · {row.targetLabel}
                    {row.note ? ` · ${row.note}` : ''}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-[var(--sps-muted)]">
                {exportAuditFilter === 'all'
                  ? `Compiler, Writer, Generate, and file saves log here when export is gated.${exportLife.message ? ` Lifecycle: ${exportLife.message}` : ''}`
                  : `No export audit rows match “${exportAuditFilter}”.`}
              </p>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="text-[11px] uppercase tracking-widest text-[var(--sps-muted)] flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Write gate audit
            </h3>
            <div className="grid grid-cols-3 gap-2">
              <StatCard
                label="Write blocked"
                value={writeAudit.blocked || 0}
                hint="Parse / apply / craft denials"
                tone={writeAudit.blocked ? 'warn' : 'default'}
              />
              <StatCard
                label="Project lock"
                value={snap.projectLifecycle?.lifecycleStatus === 'locked' ? 'On' : 'Off'}
                hint={writeAudit.projectLocked ? 'Blocks logged' : 'Not blocking writes'}
                tone={snap.projectLifecycle?.lifecycleStatus === 'locked' ? 'lock' : 'default'}
              />
              <StatCard
                label="Apply events"
                value={writeAudit.total || 0}
                hint="All apply-category rows"
                tone="default"
              />
            </div>
            {writeAudit.recent?.length ? (
              <div className="space-y-1 max-h-28 overflow-y-auto">
                {writeAudit.recent.map((row) => (
                  <p key={row.id} className="text-[10px] font-mono truncate text-rose-400">
                    {row.action} · {row.targetLabel}
                    {row.note ? ` · ${row.note}` : ''}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-[var(--sps-muted)]">
                Writer Sync, Console parse/apply, and craft edits log here when project lock blocks writes.
              </p>
            )}
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-[11px] uppercase tracking-widest text-[var(--sps-muted)] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Generation jobs
              </h3>
              <span className="text-[10px] text-[var(--sps-muted)] font-mono">
                {filteredJobs.length}
                {jobFilter !== 'all' ? ` / ${allJobs.length}` : ''} shown
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {GENERATION_JOB_FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded border ${
                    jobFilter === opt.id
                      ? 'border-[var(--sps-gold)]/60 text-[var(--sps-gold)]'
                      : 'border-[var(--sps-border)] text-[var(--sps-muted)]'
                  }`}
                  onClick={() => setJobFilter(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {filteredJobs.length === 0 ? (
              <p className="text-[11px] text-[var(--sps-muted)]">
                {allJobs.length === 0
                  ? 'Generate desk jobs will appear here after you queue stills or video.'
                  : 'No jobs match this filter yet.'}
              </p>
            ) : (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {filteredJobs.map((j) => (
                  <div
                    key={j.id}
                    className="flex items-center justify-between gap-2 text-[10px] font-mono border border-[var(--sps-border)] rounded px-2 py-1.5"
                  >
                    <span className="truncate">
                      {j.type}
                      {j.engine ? ` · ${j.engine}` : ''}
                      {j.modelId ? ` · ${j.modelId}` : ''}
                      {' · '}
                      {j.sceneShotId || j.id}
                    </span>
                    <span className="text-[var(--sps-muted)] shrink-0">{j.status}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-[11px] uppercase tracking-widest text-[var(--sps-muted)] flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Creative audit log
              </h3>
              <span className="text-[10px] text-[var(--sps-muted)] font-mono">
                {snap.audit.filtered}
                {auditFilter !== 'all' ? ` / ${snap.audit.total}` : ''} entries
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {AUDIT_FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded border ${
                    auditFilter === opt.id
                      ? 'border-[var(--sps-gold)]/60 text-[var(--sps-gold)]'
                      : 'border-[var(--sps-border)] text-[var(--sps-muted)]'
                  }`}
                  onClick={() => setAuditFilter(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {snap.audit.recent.length === 0 ? (
              <p className="text-[11px] text-[var(--sps-muted)]">
                {auditFilter === 'all'
                  ? 'Lifecycle moves, blocked locked edits, and generate jobs will appear here.'
                  : 'No entries for this filter yet.'}
              </p>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {snap.audit.recent.map((row) => (
                  <AuditRow key={row.id} row={row} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
