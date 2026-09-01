import React, { useMemo, useState } from 'react';
import { BookOpen, Check, Clapperboard, Film, Layers, Users, Globe2, Download, Archive } from 'lucide-react';
import { storyPackageSummary, assertStoryPackageApplyAllowed } from '../utils/storyPackage';
import {
  storyPackageToPrintHtml,
  storyPackageToCsv,
  buildStoryPackageZipFiles
} from '../utils/storyPackageExport';
import {
  assertExportAllowed,
  logExportSuccess,
  exportDownloadText,
  resolveCollabRoomId
} from '../utils/exportGate';
import { useExportLifecyclePref } from '../hooks/useExportLifecyclePref';
import { lifecycleExportReadiness } from '../utils/productionLifecycle';
import { createZipArchive } from '../utils/zipUtils';
import { saveExportBlob } from '../utils/saveExportFile';

/**
 * Review durable Story Package before Matrix Apply.
 */
export default function StoryPackageReview({
  package: pkg,
  activeTitle = '',
  intendedTitle = '',
  existingShotCount = 0,
  shots: matrixShots = [],
  onApply,
  onLoglineChange,
  applyLabel = 'Apply to Matrix'
}) {
  const [tab, setTab] = useState('overview');
  const summary = useMemo(() => storyPackageSummary(pkg), [pkg]);
  const applyGate = useMemo(
    () =>
      assertStoryPackageApplyAllowed({
        activeTitle,
        pkg,
        intendedTitle,
        existingShotCount,
        audit: false
      }),
    [activeTitle, pkg, intendedTitle, existingShotCount]
  );
  const projectTitle = pkg?.projectTitle || activeTitle;
  const exportLife = useMemo(
    () => lifecycleExportReadiness(matrixShots, projectTitle),
    [matrixShots, projectTitle]
  );
  const {
    strict: storyLifecycleStrict,
    mode: storyLifecycleMode
  } = useExportLifecyclePref('story_package');
  const exportBlocked = storyLifecycleStrict && !exportLife.exportReady;
  const roomId = resolveCollabRoomId();
  const slug = String(projectTitle || 'story').replace(/[^\w\-]+/g, '_').slice(0, 40);
  const lifeNote = `${summary.shots} shots · ${summary.sequences} seq · ${summary.status}${
    roomId ? ` · room ${roomId}` : ''
  }`;

  if (!pkg || !summary.shots) return null;

  const sequences = Array.isArray(pkg.sequences) ? pkg.sequences : [];
  const scenes = Array.isArray(pkg.scenes) ? pkg.scenes : [];
  const proposedShots = Array.isArray(pkg.proposedShots) ? pkg.proposedShots : [];

  const handlePrintPdf = () => {
    if (exportBlocked) {
      assertExportAllowed({
        projectTitle,
        label: 'story_package_pdf',
        format: 'pdf',
        lifecycleMode: storyLifecycleMode,
        shots: matrixShots,
        roomId,
        showAlert: true
      });
      return;
    }
    const gate = assertExportAllowed({
      projectTitle,
      label: 'story_package_pdf',
      format: 'pdf',
      lifecycleMode: storyLifecycleMode,
      shots: matrixShots,
      roomId,
      showAlert: true
    });
    if (!gate.ok) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.alert('Please allow popups to export PDF.');
      return;
    }
    printWindow.document.write(storyPackageToPrintHtml(pkg, { roomId }));
    printWindow.document.close();
    logExportSuccess({
      projectTitle,
      label: 'story_package_pdf',
      format: 'pdf',
      filename: `${slug}_story_package.pdf`,
      roomId,
      note: lifeNote,
      lifecycleMode: gate.advisory ? `${storyLifecycleMode}+ok` : storyLifecycleMode
    });
  };

  const handleExportCsv = () => {
    exportDownloadText(`${slug}_story_shots.csv`, storyPackageToCsv(pkg), {
      projectTitle,
      auditLabel: 'story_package_csv',
      auditFormat: 'csv',
      mime: 'text/csv;charset=utf-8',
      lifecycleMode: storyLifecycleMode,
      shots: matrixShots,
      roomId,
      note: lifeNote
    });
  };

  const handleExportZip = async () => {
    if (exportBlocked) {
      assertExportAllowed({
        projectTitle,
        label: 'story_package_zip',
        format: 'zip',
        lifecycleMode: storyLifecycleMode,
        shots: matrixShots,
        roomId,
        showAlert: true
      });
      return;
    }
    const gate = assertExportAllowed({
      projectTitle,
      label: 'story_package_zip',
      format: 'zip',
      lifecycleMode: storyLifecycleMode,
      shots: matrixShots,
      roomId
    });
    if (!gate.ok) return;
    const files = buildStoryPackageZipFiles(pkg, { roomId });
    const blob = createZipArchive(files);
    await saveExportBlob(blob, `${slug}_story_package.zip`, {
      projectTitle,
      shots: matrixShots,
      lifecycleMode: storyLifecycleMode,
      skipLifecycleCheck: true,
      advisoryAlready: Boolean(gate.advisory),
      auditLabel: 'story_package_zip',
      auditFormat: 'zip',
      roomId,
      note: lifeNote,
      showAlert: false
    });
  };

  return (
    <div className="space-y-3 flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="flex items-start justify-between gap-2 border-b border-slate-200 dark:border-zinc-800 pb-2.5 shrink-0">
        <div className="min-w-0">
          <span className="text-xs font-bold text-[color:var(--sps-text)] flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-cyan-700 dark:text-cyan-500 shrink-0" />
            Story Package
            <span className="text-[10px] font-mono uppercase tracking-wider text-amber-800 dark:text-amber-400 ml-1">
              {summary.status}
            </span>
          </span>
          <p className="text-[10px] text-[color:var(--sps-muted)] font-semibold mt-0.5 truncate">
            {pkg.projectTitle || 'Untitled'} · {summary.source}
            {summary.runtimeMinutes ? ` · ~${summary.runtimeMinutes} min` : ''}
          </p>
          {exportBlocked ? (
            <p className="text-[9px] text-amber-600 dark:text-amber-400 mt-0.5 m-0">{exportLife.message}</p>
          ) : null}
          {!applyGate.ok ? (
            <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-1 m-0 font-semibold">
              Apply blocked — {applyGate.message}
            </p>
          ) : applyGate.warning ? (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 m-0">{applyGate.warning}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          <button
            type="button"
            className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-900 hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 font-bold text-xs border border-slate-200 dark:border-zinc-700 flex items-center gap-1 cursor-pointer transition-all disabled:opacity-40"
            disabled={exportBlocked}
            title={exportBlocked ? exportLife.message : 'Print Story Package as PDF'}
            onClick={handlePrintPdf}
          >
            <Download className="w-3.5 h-3.5" />
            PDF
          </button>
          <button
            type="button"
            className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-900 hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 font-bold text-xs border border-slate-200 dark:border-zinc-700 flex items-center gap-1 cursor-pointer transition-all disabled:opacity-40"
            disabled={exportBlocked}
            title={exportBlocked ? exportLife.message : 'Export story shots CSV'}
            onClick={handleExportCsv}
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
          <button
            type="button"
            className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-900 hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 font-bold text-xs border border-slate-200 dark:border-zinc-700 flex items-center gap-1 cursor-pointer transition-all disabled:opacity-40"
            disabled={exportBlocked}
            title={exportBlocked ? exportLife.message : 'Download story package ZIP (README + shots CSV)'}
            onClick={handleExportZip}
          >
            <Archive className="w-3.5 h-3.5" />
            ZIP
          </button>
          <button
            type="button"
            onClick={onApply}
            disabled={!applyGate.ok}
            title={applyGate.ok ? (applyGate.warning || applyLabel) : applyGate.message}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xs shadow-md flex items-center gap-1 cursor-pointer transition-all shrink-0"
          >
            <Check className="w-4 h-4 stroke-[3]" /> {applyLabel}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        {[
          { icon: Layers, label: 'Seq', value: summary.sequences },
          { icon: Film, label: 'Scenes', value: summary.scenes },
          { icon: Clapperboard, label: 'Shots', value: summary.shots },
          { icon: Users, label: 'Cast', value: summary.cast },
          { icon: Globe2, label: 'World', value: summary.world }
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 px-1.5 py-1.5 text-center"
          >
            <stat.icon className="w-3 h-3 mx-auto text-cyan-500 mb-0.5" />
            <div className="text-sm font-black text-[color:var(--sps-text)] leading-none">{stat.value}</div>
            <div className="text-[9px] uppercase tracking-wider text-[color:var(--sps-muted)] font-bold mt-0.5">
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      <label className="block space-y-1">
        <span className="text-[10px] uppercase tracking-widest text-[color:var(--sps-muted)] font-bold">Logline</span>
        <textarea
          value={pkg.logline || ''}
          onChange={(e) => onLoglineChange?.(e.target.value)}
          rows={2}
          className="w-full rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 px-2.5 py-2 text-[11px] text-slate-800 dark:text-zinc-200 outline-none focus:border-cyan-500 resize-none"
          placeholder="One-line story promise…"
        />
      </label>

      <div className="flex gap-1 border-b border-slate-200 dark:border-zinc-800">
        {[
          { id: 'overview', label: sequences.length ? 'Sequences' : 'Scenes' },
          { id: 'shots', label: 'Shots' }
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-2.5 py-1 text-[11px] font-bold rounded-t-lg ${
              tab === t.id
                ? 'text-cyan-700 dark:text-cyan-300 bg-cyan-500/10 border border-b-0 border-slate-200 dark:border-zinc-700'
                : 'text-slate-500 dark:text-zinc-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-2 overflow-y-auto flex-1 min-h-0 pr-1">
        {tab === 'overview' && sequences.length > 0
          ? sequences.map((seq) => (
              <div
                key={`seq-${seq.seq}`}
                className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-black text-amber-600 dark:text-amber-300 font-mono">
                    SEQ {String(seq.seq).padStart(2, '0')}
                  </span>
                  <span className="text-slate-600 dark:text-zinc-400 truncate font-medium">{seq.title}</span>
                </div>
                <p className="text-slate-700 dark:text-zinc-300 text-[11px] leading-snug line-clamp-3">
                  {seq.synopsis || seq.dramaticBeat || '—'}
                </p>
              </div>
            ))
          : null}

        {tab === 'overview' && sequences.length === 0
          ? scenes.map((sc) => (
              <div
                key={sc.id}
                className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-black text-amber-600 dark:text-amber-300 font-mono">
                    SC {String(sc.sceneNumber).padStart(2, '0')}
                  </span>
                  <span className="text-[10px] text-[color:var(--sps-muted)] font-mono font-semibold">{sc.shotIds?.length || 0} shots</span>
                </div>
                <p className="text-slate-700 dark:text-zinc-300 text-[11px] leading-snug line-clamp-2">
                  {sc.synopsis || sc.heading || '—'}
                </p>
              </div>
            ))
          : null}

        {tab === 'shots'
          ? proposedShots.map((s, idx) => (
              <div
                key={s.sceneShotId || idx}
                className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs space-y-1.5 hover:border-cyan-500/50 transition-all"
              >
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-1">
                  <span className="font-black text-amber-600 dark:text-amber-300 font-mono">{s.sceneShotId}</span>
                  <span className="text-slate-600 dark:text-zinc-400 font-mono font-medium">
                    {s.shotComposition}
                  </span>
                </div>
                <p className="text-slate-700 dark:text-zinc-300 text-[11px] leading-snug line-clamp-2">
                  {s.actionEnvContext || s.sceneSynopsis || '—'}
                </p>
              </div>
            ))
          : null}
      </div>

      <p className="text-[10px] text-[color:var(--sps-muted)] font-medium shrink-0 pt-1 border-t border-slate-200/80 dark:border-zinc-800/80">
        Review the Story Package first. Apply asks you to type the <strong>active project title</strong> before
        writing Matrix / Cast / World. Package stays saved if you close the console.
      </p>
    </div>
  );
}
