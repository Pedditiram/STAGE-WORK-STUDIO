import React, { useMemo } from 'react';
import { X, Download } from 'lucide-react';
import { compileMasterCinemaCompilerPrompt } from '../utils/compileMasterCinemaPrompt';
import { createZipArchive } from '../utils/zipUtils';
import { saveExportBlob } from '../utils/saveExportFile';
import { assertExportAllowed, logExportSuccess, exportDownloadText, resolveCollabRoomId } from '../utils/exportGate';
import { lifecycleExportReadiness } from '../utils/productionLifecycle';
import { useExportLifecyclePref } from '../hooks/useExportLifecyclePref';
import {
  applyShotBridge,
  blockingFlags,
  continuityFlagsForShot,
  characterLookUrl,
  matchCharactersForShot,
  matchWorldForShot,
  reelStats,
  shotDurationSec,
  worldPlateUrl,
  featureReelToPrintHtml,
  featureReelToCsv
} from '../utils/continuitySpine';

export default function FeatureReelModal({
  isOpen,
  onClose,
  shots = [],
  projectTitle = '',
  activeShotIndex = 0,
  setActiveShotIndex,
  onOpenShot
}) {
  const live = useMemo(
    () => (shots || []).map((shot, index) => ({ shot, index })).filter(({ shot }) => shot && !shot.isArchived && !shot.isMuted),
    [shots]
  );
  const stats = useMemo(() => reelStats(live.map((r) => r.shot)), [live]);
  const exportLife = useMemo(
    () => lifecycleExportReadiness(live.map((r) => r.shot), projectTitle),
    [live, projectTitle]
  );
  const {
    strict: reelLifecycleStrict,
    mode: reelLifecycleMode
  } = useExportLifecyclePref('feature_reel');
  const exportBlocked = reelLifecycleStrict && !exportLife.exportReady;
  const roomId = resolveCollabRoomId();
  const slug = String(projectTitle || 'feature').replace(/[^\w\-]+/g, '_').slice(0, 40);
  const lifeNote = `${stats.count} shots · ~${stats.minutes} min${roomId ? ` · room ${roomId}` : ''}`;

  if (!isOpen) return null;

  const exportPack = async () => {
    if (exportBlocked) {
      assertExportAllowed({
        projectTitle,
        label: 'feature_reel_pack',
        format: 'zip',
        lifecycleMode: reelLifecycleMode,
        shots,
        roomId,
        showAlert: true
      });
      return;
    }
    const gate = assertExportAllowed({
      projectTitle,
      label: 'feature_reel_pack',
      format: 'zip',
      lifecycleMode: reelLifecycleMode,
      shots,
      roomId
    });
    if (!gate.ok) return;
    const files = [];
    let running = 0;
    const listLines = [`FEATURE REEL — ${projectTitle}`, `${stats.count} shots · ~${stats.minutes} min`, ''];
    live.forEach(({ shot, index }) => {
      const bridged = applyShotBridge(shot, shots, index);
      const { masterCinemaPrompt } = compileMasterCinemaCompilerPrompt(bridged, index, {
        projectTitle,
        shots
      });
      const id = String(shot.sceneShotId || `SH${index + 1}`).replace(/\s+/g, '_');
      files.push({ name: `${id}.txt`, content: masterCinemaPrompt });
      const dur = shotDurationSec(shot);
      const flags = continuityFlagsForShot(shot, shots, index);
      listLines.push(
        `${running.toFixed(1)}s  ${id}  ${dur}s  ${blockingFlags(flags).length ? 'BLOCK' : flags.length ? 'WARN' : 'OK'}`
      );
      running += dur;
    });
    files.push({ name: 'SHOT_LIST.txt', content: listLines.join('\n') });
    files.push({
      name: 'shot_list.csv',
      content: featureReelToCsv({ live, shots, projectTitle })
    });
    files.push({
      name: 'LOOK_SHEETS.txt',
      content: 'Lock stills live in Cast (face/body) and World (plate). Compile attaches LOOK SHEET + BRIDGE lines. Keep those stills selected in the video model as Image refs.'
    });
    files.push({
      name: 'META.txt',
      content: [
        `Project: ${projectTitle || ''}`,
        `Shots: ${stats.count}`,
        `Minutes: ~${stats.minutes}`,
        `Room: ${roomId || '—'}`,
        `Exported: ${new Date().toISOString()}`
      ].join('\n')
    });
    const blob = createZipArchive(files);
    await saveExportBlob(blob, `${slug}_reel_pack.zip`, {
      projectTitle,
      auditLabel: 'feature_reel_pack',
      auditFormat: 'zip',
      lifecycleMode: reelLifecycleMode,
      shots,
      roomId,
      note: lifeNote,
      skipLifecycleCheck: true,
      advisoryAlready: Boolean(gate.advisory),
      showAlert: false
    });
  };

  const exportCsv = () => {
    exportDownloadText(`${slug}_feature_reel.csv`, featureReelToCsv({ live, shots, projectTitle }), {
      projectTitle,
      auditLabel: 'feature_reel_csv',
      auditFormat: 'csv',
      mime: 'text/csv;charset=utf-8',
      lifecycleMode: reelLifecycleMode,
      shots,
      roomId,
      note: lifeNote
    });
  };

  const exportPdf = () => {
    if (exportBlocked) {
      assertExportAllowed({
        projectTitle,
        label: 'feature_reel_pdf',
        format: 'pdf',
        lifecycleMode: reelLifecycleMode,
        shots,
        roomId,
        showAlert: true
      });
      return;
    }
    const gate = assertExportAllowed({
      projectTitle,
      label: 'feature_reel_pdf',
      format: 'pdf',
      lifecycleMode: reelLifecycleMode,
      shots,
      roomId
    });
    if (!gate.ok) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.alert('Please allow popups to export PDF.');
      return;
    }
    printWindow.document.write(
      featureReelToPrintHtml({ projectTitle, live, shots, stats, roomId })
    );
    printWindow.document.close();
    logExportSuccess({
      projectTitle,
      label: 'feature_reel_pdf',
      format: 'pdf',
      filename: `${slug}_feature_reel.pdf`,
      roomId,
      note: lifeNote,
      lifecycleMode: gate.advisory ? `${reelLifecycleMode}+ok` : reelLifecycleMode
    });
  };

  return (
    <div className="sps-overlay" onClick={onClose}>
      <div className="sps-shell sps-shell-md" style={{ maxWidth: '52rem', height: 'auto', maxHeight: 'min(92dvh, 40rem)', alignSelf: 'center' }} onClick={(e) => e.stopPropagation()}>
        <div className="sps-modal-head">
          <div>
            <h2>Feature reel</h2>
            <p>
              AI Cinema Production OS · {stats.count} shots · ~{stats.minutes} min assembled
              {exportLife.locked ? ` · ${exportLife.locked} locked` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {exportBlocked ? (
              <span className="text-[10px] text-[var(--sps-gold)] max-w-[16rem] leading-snug">
                {exportLife.message}
              </span>
            ) : null}
            <button
              type="button"
              className="sps-btn text-xs disabled:opacity-40"
              disabled={exportBlocked || live.length === 0}
              title={exportBlocked ? exportLife.message : 'Export feature reel CSV'}
              onClick={exportCsv}
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
            <button
              type="button"
              className="sps-btn text-xs disabled:opacity-40"
              disabled={exportBlocked || live.length === 0}
              title={exportBlocked ? exportLife.message : 'Print feature reel PDF'}
              onClick={exportPdf}
            >
              <Download className="w-3.5 h-3.5" />
              PDF
            </button>
            <button
              type="button"
              className="sps-btn sps-btn-primary text-xs disabled:opacity-40"
              disabled={exportBlocked || live.length === 0}
              title={exportBlocked ? exportLife.message : 'Export reel pack (.zip)'}
              onClick={exportPack}
            >
              <Download className="w-3.5 h-3.5" />
              Pack
            </button>
            <button type="button" className="sps-icon-btn" onClick={onClose} title="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="sps-modal-body p-3 space-y-1.5">
          {live.length === 0 ? (
            <p className="text-sm text-[var(--sps-muted)] p-6 text-center">No live shots yet.</p>
          ) : (
            live.map(({ shot, index }) => {
              const flags = continuityFlagsForShot(shot, shots, index);
              const blocked = blockingFlags(flags);
              const chars = matchCharactersForShot(shot);
              const world = matchWorldForShot(shot);
              const dur = shotDurationSec(shot);
              const bridged = applyShotBridge(shot, shots, index);
              const on = index === activeShotIndex;
              return (
                <button
                  key={shot.sceneShotId || index}
                  type="button"
                  onClick={() => {
                    setActiveShotIndex?.(index);
                    onOpenShot?.(index);
                  }}
                  className={`w-full text-left border px-3 py-2 flex items-center gap-3 ${
                    on ? 'border-[var(--sps-gold)] bg-[var(--sps-surface)]' : 'border-[var(--sps-border)]'
                  }`}
                >
                  <span className="text-[10px] tabular-nums text-[var(--sps-muted)] w-8">{index + 1}</span>
                  <div className="flex gap-1 shrink-0">
                    {chars.slice(0, 2).map((c) =>
                      characterLookUrl(c) ? (
                        <img key={c.id} src={characterLookUrl(c)} alt="" className="w-8 h-8 object-cover border border-[var(--sps-border)]" />
                      ) : (
                        <span key={c.id} className="w-8 h-8 border border-[var(--sps-border)] text-[8px] flex items-center justify-center text-[var(--sps-muted)]">
                          {(c.name || '?').slice(0, 1)}
                        </span>
                      )
                    )}
                    {worldPlateUrl(world) ? (
                      <img src={worldPlateUrl(world)} alt="" className="w-8 h-8 object-cover border border-[var(--sps-border)]" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] truncate font-medium">{shot.sceneShotId || `Shot ${index + 1}`}</p>
                    <p className="text-[10px] text-[var(--sps-muted)] truncate">
                      {dur}s · {shot.shotComposition || '—'}
                      {bridged.bridgeFromPrev?.enabled ? ` · from ${bridged.bridgeFromPrev.prevSceneShotId}` : ''}
                      {shot.embeddedVideo?.url ? ' · clip' : ''}
                    </p>
                  </div>
                  <span className={`text-[10px] shrink-0 ${blocked.length ? 'text-[var(--sps-gold)]' : 'text-[var(--sps-muted)]'}`}>
                    {blocked.length ? 'Block' : flags.length ? `${flags.length} warn` : 'Ready'}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
