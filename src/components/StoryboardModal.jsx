import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, Check, Download, Clapperboard, Archive, ImagePlus } from 'lucide-react';
import HoverPinBar from './HoverPinBar';
import { exportDownloadText, assertExportAllowed, logExportSuccess, resolveCollabRoomId } from '../utils/exportGate';
import { isLifecycleLocked, lifecycleExportReadiness } from '../utils/productionLifecycle';
import { useExportLifecyclePref } from '../hooks/useExportLifecyclePref';
import {
  buildStoryboardFrames,
  storyboardToMarkdown,
  storyboardToPrintHtml,
  storyboardToCsv,
  buildStoryboardZipFiles,
  STORYBOARD_STILL_PROMPT_AUTO,
  STORYBOARD_STILL_PROMPT_MANUAL
} from '../utils/storyboardKit';
import { createZipArchive } from '../utils/zipUtils';
import { saveExportBlob } from '../utils/saveExportFile';
import { PRODUCT } from '../constants/brand';
import { enqueueGenerationJob, getPendingJobs, readJobsForTitle, JOB_STATUS } from '../utils/generationJobs';
import {
  getActiveModelEngine,
  MODEL_ENGINES
} from '../services/modelAdapters';
import { getReplicateStillModel, hasReplicateKey } from '../services/replicateClient';
import { getSeedanceStillModel } from '../services/seedanceModels';
import { getCurrentUserEmail } from '../utils/projectPermissions';
import { assertCanGenerate } from '../utils/saasControl';

const COLS = [
  { id: 2, label: '2-up' },
  { id: 3, label: '3-up' },
  { id: 4, label: '4-up' },
];

function aspectClass(ratio) {
  const r = String(ratio || '');
  if (/9:16|9\/16/.test(r)) return 'aspect-[9/16]';
  if (/1:1/.test(r)) return 'aspect-square';
  if (/4:3|4\/3/.test(r)) return 'aspect-[4/3]';
  if (/16:9|16\/9|1\.85/.test(r)) return 'aspect-video';
  return 'aspect-[2.39/1]';
}

export default function StoryboardModal({
  isOpen,
  asRoom = false,
  shots = [],
  projectTitle = 'Project',
  aspectRatio = '2.39:1',
  generatedMap = {},
  lookOnly = false,
  onOpenShot,
  onUpdateShot,
}) {
  const [cols, setCols] = useState(3);
  const [copied, setCopied] = useState('');
  const [showVideo, setShowVideo] = useState(false);
  const [frameStatus, setFrameStatus] = useState({});
  const [busyId, setBusyId] = useState('');
  const [jobTick, setJobTick] = useState(0);
  const [modelEngine, setModelEngine] = useState(() => getActiveModelEngine());

  const frames = useMemo(
    () => buildStoryboardFrames({ shots, projectTitle, aspectRatio, generatedMap }),
    [shots, projectTitle, aspectRatio, generatedMap]
  );

  const exportLife = useMemo(() => lifecycleExportReadiness(shots, projectTitle), [shots, projectTitle]);
  const {
    strict: boardLifecycleStrict,
    mode: boardLifecycleMode
  } = useExportLifecyclePref('storyboard');
  const {
    mode: generateLifecycleMode
  } = useExportLifecyclePref('generate');
  const exportBlocked = boardLifecycleStrict && !exportLife.exportReady;

  useEffect(() => {
    const onEngine = () => setModelEngine(getActiveModelEngine());
    const onJobs = () => setJobTick((n) => n + 1);
    window.addEventListener('sps_model_engine_changed', onEngine);
    window.addEventListener('sps_generation_job_updated', onJobs);
    return () => {
      window.removeEventListener('sps_model_engine_changed', onEngine);
      window.removeEventListener('sps_generation_job_updated', onJobs);
    };
  }, []);

  const pendingByShot = useMemo(() => {
    if (!projectTitle) return {};
    const map = {};
    getPendingJobs(projectTitle)
      .filter((j) => j.type === 'still')
      .forEach((j) => {
        const id = String(j.sceneShotId || '').trim();
        if (id) map[id] = j;
      });
    return map;
  }, [projectTitle, jobTick]);

  const latestStillByShot = useMemo(() => {
    if (!projectTitle) return {};
    const map = {};
    readJobsForTitle(projectTitle)
      .filter((j) => j.type === 'still')
      .forEach((j) => {
        const id = String(j.sceneShotId || '').trim();
        if (!id || map[id]) return;
        map[id] = j;
      });
    return map;
  }, [projectTitle, jobTick]);

  const copyText = useCallback(async (text, key) => {
    try {
      await navigator.clipboard.writeText(text || '');
      setCopied(key);
      setTimeout(() => setCopied(''), 1600);
    } catch {
      /* ignore */
    }
  }, []);

  const setStatus = useCallback((id, message) => {
    setFrameStatus((prev) => ({ ...prev, [id]: message }));
  }, []);

  const patchShot = useCallback(
    (index, patch) => {
      const shot = shots[index];
      if (!shot || !onUpdateShot) return;
      if (isLifecycleLocked(shot)) {
        setStatus(shot.sceneShotId || `SH_${index + 1}`, 'Shot is locked — unlock to edit the still prompt.');
        return;
      }
      onUpdateShot(index, { ...shot, ...patch });
    },
    [shots, onUpdateShot, setStatus]
  );

  const generateFrame = useCallback(
    async (f) => {
      const id = f.sceneShotId;
      if (lookOnly) {
        setStatus(id, 'Sign in to generate a still.');
        return;
      }
      const shot = shots[f.index];
      if (!shot) return;
      if (isLifecycleLocked(shot)) {
        setStatus(id, 'Shot is locked — unlock to generate.');
        return;
      }
      const prompt = String(f.stillPrompt || '').trim();
      if (!prompt) {
        setStatus(id, 'Still prompt is empty. Switch to Manual and write one.');
        return;
      }
      const engine = getActiveModelEngine();
      const isReplicate = engine === MODEL_ENGINES.REPLICATE;
      const isLocalExport = engine === MODEL_ENGINES.LOCAL_EXPORT;
      const isSeedance = engine === MODEL_ENGINES.SEEDANCE || engine === MODEL_ENGINES.BYTEPLUS;
      if (isReplicate && !hasReplicateKey(getCurrentUserEmail())) {
        setStatus(id, 'Add a Replicate key in Settings → API keys (BYOK).');
        return;
      }
      if (!isLocalExport) {
        const gate = assertCanGenerate(getCurrentUserEmail());
        if (!gate.ok) {
          setStatus(id, gate.message || 'Generation is off for this license.');
          return;
        }
      }

      setBusyId(id);
      try {
        if (isLocalExport) {
          await navigator.clipboard.writeText(prompt);
          const stem = String(id).replace(/\s+/g, '_');
          const blob = new Blob([prompt], { type: 'text/plain;charset=utf-8' });
          await saveExportBlob(blob, `${stem}_first_frame.txt`, {
            projectTitle,
            shots,
            lifecycleMode: generateLifecycleMode,
            auditLabel: 'storyboard_still_export',
            auditFormat: 'txt',
            roomId: resolveCollabRoomId(),
            note: `${id} · first_frame`
          });
          setStatus(id, 'Prompt copied + saved — paste into Flux / Midjourney / your BYOK engine.');
          return;
        }
        const job = enqueueGenerationJob({
          projectTitle,
          sceneShotId: id,
          shotIndex: f.index,
          type: 'still',
          prompt,
          takeSlot: 'first_frame',
          engine,
          modelId: isReplicate ? getReplicateStillModel() : isSeedance ? getSeedanceStillModel() : ''
        });
        setStatus(id, `Job ${job.id.slice(-6)} queued — still locks here when ready.`);
        window.dispatchEvent(
          new CustomEvent('sps_generation_job_kick', { detail: { title: projectTitle } })
        );
      } catch (err) {
        setStatus(id, err?.message || 'Still queue failed');
      } finally {
        setBusyId('');
      }
    },
    [lookOnly, shots, projectTitle, generateLifecycleMode, setStatus]
  );

  const slug = String(projectTitle || 'project').replace(/[^\w\-]+/g, '_').slice(0, 40);
  const roomId = resolveCollabRoomId();
  const lifeNote = `${frames.length} frames${showVideo ? ' · still+video' : ' · still'}${roomId ? ` · room:${roomId}` : ''}`;

  const handleExportPdf = useCallback(() => {
    if (exportBlocked) {
      assertExportAllowed({
        projectTitle,
        label: 'storyboard_pdf',
        format: 'pdf',
        lifecycleMode: boardLifecycleMode,
        shots,
        roomId,
        showAlert: true
      });
      return;
    }
    const gate = assertExportAllowed({
      projectTitle,
      label: 'storyboard_pdf',
      format: 'pdf',
      lifecycleMode: boardLifecycleMode,
      shots,
      roomId
    });
    if (!gate.ok) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.alert('Please allow popups to export PDF.');
      return;
    }
    printWindow.document.write(storyboardToPrintHtml(frames, projectTitle, { showVideo, roomId }));
    printWindow.document.close();
    logExportSuccess({
      projectTitle,
      label: 'storyboard_pdf',
      format: 'pdf',
      filename: `${slug}_storyboard.pdf`,
      roomId,
      note: lifeNote,
      lifecycleMode: gate.advisory ? `${boardLifecycleMode}+ok` : boardLifecycleMode
    });
  }, [frames, projectTitle, showVideo, shots, slug, boardLifecycleMode, exportBlocked, roomId, lifeNote]);

  const handleExportZip = useCallback(async () => {
    if (exportBlocked) {
      assertExportAllowed({
        projectTitle,
        label: 'storyboard_zip',
        format: 'zip',
        lifecycleMode: boardLifecycleMode,
        shots,
        roomId,
        showAlert: true
      });
      return;
    }
    const gate = assertExportAllowed({
      projectTitle,
      label: 'storyboard_zip',
      format: 'zip',
      lifecycleMode: boardLifecycleMode,
      shots,
      roomId
    });
    if (!gate.ok) return;
    const files = buildStoryboardZipFiles(frames, projectTitle, { showVideo, roomId });
    const blob = createZipArchive(files);
    await saveExportBlob(blob, `${slug}_storyboard.zip`, {
      projectTitle,
      shots,
      lifecycleMode: boardLifecycleMode,
      skipLifecycleCheck: true,
      advisoryAlready: Boolean(gate.advisory),
      auditLabel: 'storyboard_zip',
      auditFormat: 'zip',
      roomId,
      note: lifeNote,
      showAlert: false
    });
  }, [frames, projectTitle, showVideo, shots, slug, boardLifecycleMode, exportBlocked, roomId, lifeNote]);

  if (!asRoom && !isOpen) return null;

  const grid = cols === 2 ? 'sm:grid-cols-2' : cols === 4 ? 'sm:grid-cols-2 xl:grid-cols-4' : 'sm:grid-cols-2 xl:grid-cols-3';
  const isLocalExport = modelEngine === MODEL_ENGINES.LOCAL_EXPORT;

  const body = (
    <div className="flex flex-col h-full min-h-0 overflow-hidden sps-atelier-room">
      <HoverPinBar
        storageKey="sps_pin_storyboard_bar"
        defaultPinned
        pinLabel="Storyboard bar"
        ariaLabel="Show Storyboard toolbar"
        className="shrink-0 z-20"
        barClassName="px-3 py-2 border-b border-[var(--sps-border)] bg-[var(--sps-bg-elevated)] flex items-center justify-between gap-2"
      >
        <div className="min-w-0">
          <h2 className="text-sm font-semibold m-0 flex items-center gap-2" style={{ fontFamily: 'var(--sps-font-display)' }}>
            <Clapperboard className="w-4 h-4" />
            Storyboard
          </h2>
          <p className="text-[11px] text-[var(--sps-muted)] truncate m-0">
            {frames.length} frames · still prompt under each panel · {PRODUCT}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {COLS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`sps-btn text-[10px] ${cols === c.id ? 'sps-btn-primary' : ''}`}
              onClick={() => setCols(c.id)}
            >
              {c.label}
            </button>
          ))}
          <button
            type="button"
            className={`sps-btn text-[11px] ${showVideo ? 'sps-btn-primary' : ''}`}
            onClick={() => setShowVideo((v) => !v)}
            title="Also show the video compile under the still prompt"
          >
            {showVideo ? 'Still + video' : 'Still only'}
          </button>
          <button
            type="button"
            className="sps-btn text-[11px] disabled:opacity-40"
            disabled={lookOnly || exportBlocked}
            title={exportBlocked ? exportLife.message : 'Export storyboard markdown'}
            onClick={() =>
              exportDownloadText(`${slug}_storyboard.md`, storyboardToMarkdown(frames, projectTitle), {
                projectTitle,
                auditLabel: 'storyboard_md',
                auditFormat: 'md',
                mime: 'text/markdown;charset=utf-8',
                lifecycleMode: boardLifecycleMode,
                shots,
                roomId,
                note: lifeNote
              })
            }
          >
            <Download className="w-3.5 h-3.5" />
            MD
          </button>
          <button
            type="button"
            className="sps-btn text-[11px] disabled:opacity-40"
            disabled={lookOnly || exportBlocked || frames.length === 0}
            title={exportBlocked ? exportLife.message : 'Export storyboard CSV'}
            onClick={() =>
              exportDownloadText(`${slug}_storyboard.csv`, storyboardToCsv(frames), {
                projectTitle,
                auditLabel: 'storyboard_csv',
                auditFormat: 'csv',
                mime: 'text/csv;charset=utf-8',
                lifecycleMode: boardLifecycleMode,
                shots,
                roomId,
                note: lifeNote
              })
            }
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
          <button
            type="button"
            className="sps-btn text-[11px] disabled:opacity-40"
            disabled={lookOnly || exportBlocked || frames.length === 0}
            title={exportBlocked ? exportLife.message : 'Print storyboard PDF'}
            onClick={handleExportPdf}
          >
            <Download className="w-3.5 h-3.5" />
            PDF
          </button>
          <button
            type="button"
            className="sps-btn text-[11px] disabled:opacity-40"
            disabled={lookOnly || exportBlocked || frames.length === 0}
            title={exportBlocked ? exportLife.message : 'Download storyboard zip pack'}
            onClick={handleExportZip}
          >
            <Archive className="w-3.5 h-3.5" />
            ZIP
          </button>
          {exportBlocked ? (
            <span className="text-[10px] text-[var(--sps-gold)] max-w-[12rem] leading-snug">
              {exportLife.message}
            </span>
          ) : null}
        </div>
      </HoverPinBar>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 sps-atelier-pane">
        {frames.length === 0 ? (
          <p className="text-[13px] text-[var(--sps-muted)] m-0 p-8 text-center">
            Add Matrix shots. Each row becomes a storyboard panel with its still prompt under the frame.
          </p>
        ) : (
          <div className={`grid grid-cols-1 ${grid} gap-4`}>
            {frames.map((f) => {
              const pending = pendingByShot[f.sceneShotId];
              const latestStill = latestStillByShot[f.sceneShotId];
              const generating = busyId === f.sceneShotId || Boolean(pending);
              const isManual = f.stillPromptSource === STORYBOARD_STILL_PROMPT_MANUAL;
              const generateLabel = isLocalExport
                ? 'Export prompt'
                : f.stillUrl
                  ? 'Regenerate'
                  : 'Generate Image';
              const jobNote = pending
                ? pending.status === JOB_STATUS.RUNNING
                  ? 'Still job running…'
                  : (frameStatus[f.sceneShotId] || 'Still job queued…')
                : latestStill?.status === JOB_STATUS.FAILED
                  ? (latestStill.error || 'Still job failed.')
                  : (frameStatus[f.sceneShotId] || '');
              return (
              <article
                key={`${f.sceneShotId}-${f.index}`}
                className="rounded-[var(--sps-radius)] border border-[var(--sps-border)] bg-[var(--sps-surface)] overflow-hidden flex flex-col"
              >
                <div className="px-2.5 py-1.5 flex items-center justify-between gap-2 border-b border-[var(--sps-border)]">
                  <span className="font-mono text-[11px] font-bold text-[var(--sps-gold)]">{f.sceneShotId}</span>
                  <span className="text-[10px] text-[var(--sps-muted)] truncate">{f.composition}</span>
                </div>
                <div className={`relative w-full ${aspectClass(aspectRatio)} bg-[var(--sps-bg)]`}>
                  {f.stillUrl ? (
                    <button
                      type="button"
                      className="absolute inset-0 border-0 p-0 cursor-pointer bg-transparent"
                      onClick={() => onOpenShot?.(f.index)}
                      title="Open this shot"
                    >
                      <img src={f.stillUrl} alt={f.sceneShotId} className="absolute inset-0 w-full h-full object-cover" />
                    </button>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center gap-3">
                      <p className="text-[11px] text-[var(--sps-muted)] m-0 leading-relaxed">
                        {generating
                          ? 'Generating still… it locks here when ready.'
                          : 'Empty frame. Generate a still, then it locks here.'}
                      </p>
                      <button
                        type="button"
                        className="sps-btn sps-btn-primary text-[11px] disabled:opacity-40"
                        disabled={lookOnly || generating}
                        onClick={() => generateFrame(f)}
                      >
                        <ImagePlus className="w-3.5 h-3.5" />
                        {generating ? 'Generating…' : generateLabel}
                      </button>
                      <button
                        type="button"
                        className="sps-quiet-link is-muted text-[10px]"
                        onClick={() => onOpenShot?.(f.index)}
                      >
                        Open shot
                      </button>
                    </div>
                  )}
                </div>
                <div className="p-2.5 space-y-2 border-t border-[var(--sps-border)]">
                  {f.dialogue ? (
                    <p className="text-[11px] italic m-0 text-[var(--sps-text)]">“{f.dialogue}”</p>
                  ) : null}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-[10px] uppercase tracking-widest text-[var(--sps-gold)] m-0">Still prompt</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="sps-quiet-links">
                        <button
                          type="button"
                          className={`sps-quiet-link text-[10px] ${isManual ? 'is-muted' : 'is-current'}`}
                          disabled={lookOnly}
                          onClick={() =>
                            patchShot(f.index, { storyboardStillPromptSource: STORYBOARD_STILL_PROMPT_AUTO })
                          }
                        >
                          Auto
                        </button>
                        <button
                          type="button"
                          className={`sps-quiet-link text-[10px] ${isManual ? 'is-current' : 'is-muted'}`}
                          disabled={lookOnly}
                          onClick={() =>
                            patchShot(f.index, {
                              storyboardStillPromptSource: STORYBOARD_STILL_PROMPT_MANUAL,
                              storyboardStillPrompt:
                                String(shots[f.index]?.storyboardStillPrompt || '').trim() || f.stillPromptAuto
                            })
                          }
                        >
                          Manual
                        </button>
                      </div>
                      <button
                        type="button"
                        className="sps-btn text-[10px]"
                        disabled={lookOnly}
                        onClick={() => copyText(f.stillPrompt, f.sceneShotId)}
                      >
                        {copied === f.sceneShotId ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        Copy
                      </button>
                      {f.stillUrl ? (
                        <button
                          type="button"
                          className="sps-btn sps-btn-primary text-[10px] disabled:opacity-40"
                          disabled={lookOnly || generating}
                          title={isLocalExport ? 'Copy + save still prompt for an external engine' : 'Queue a still. It locks in this frame when ready.'}
                          onClick={() => generateFrame(f)}
                        >
                          <ImagePlus className="w-3 h-3" />
                          {generating ? 'Generating…' : generateLabel}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {isManual ? (
                    <textarea
                      className="m-0 w-full rounded-[var(--sps-radius-sm)] border border-[var(--sps-border)] bg-[var(--sps-bg)] text-[10px] leading-snug font-mono px-2 py-2 min-h-[10rem] max-h-56 resize-y"
                      value={shots[f.index]?.storyboardStillPrompt || ''}
                      disabled={lookOnly}
                      spellCheck={false}
                      onChange={(e) =>
                        patchShot(f.index, {
                          storyboardStillPromptSource: STORYBOARD_STILL_PROMPT_MANUAL,
                          storyboardStillPrompt: e.target.value
                        })
                      }
                    />
                  ) : (
                    <pre className="m-0 w-full rounded-[var(--sps-radius-sm)] border border-[var(--sps-border)] bg-[var(--sps-bg)] text-[10px] leading-snug font-mono px-2 py-2 whitespace-pre-wrap max-h-40 overflow-y-auto">
                      {f.stillPrompt}
                    </pre>
                  )}
                  {jobNote ? (
                    <p className="text-[10px] text-[var(--sps-muted)] m-0">{jobNote}</p>
                  ) : null}
                  {showVideo ? (
                    <>
                      <p className="text-[10px] uppercase tracking-widest text-[var(--sps-muted)] m-0">Video compile</p>
                      <pre className="m-0 w-full rounded-[var(--sps-radius-sm)] border border-[var(--sps-border)] bg-[var(--sps-bg)] text-[10px] leading-snug font-mono px-2 py-2 whitespace-pre-wrap max-h-32 overflow-y-auto text-[var(--sps-muted)]">
                        {f.videoPrompt}
                      </pre>
                    </>
                  ) : null}
                </div>
              </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  if (asRoom) return body;
  return (
    <div className="sps-overlay" style={{ zIndex: 88 }}>
      <div className="sps-shell sps-atelier-room">{body}</div>
    </div>
  );
}
