import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Copy, Check, ChevronLeft, ChevronRight, Download, Package, GitBranch } from 'lucide-react';
import SwsComfyWorkflowModal from './SwsComfyWorkflowModal';
import { probeComfyUi, getComfyUiBaseUrl } from '../services/comfyuiClient';
import { compileMasterCinemaCompilerPrompt } from '../utils/compileMasterCinemaPrompt';
import { parseSceneAndShotID } from '../utils/sceneShotUtils';
import { saveExportBlob } from '../utils/saveExportFile';
import { createZipArchive } from '../utils/zipUtils';
import StudioProfileControl from './StudioProfileControl';
import { useExportLifecyclePref } from '../hooks/useExportLifecyclePref';
import { assertExportAllowed, exportDownloadText, logExportSuccess, resolveCollabRoomId } from '../utils/exportGate';
import { managedCreditStatus } from '../utils/saasControl';
import { generateDeskToPrintHtml } from '../utils/generateDeskExport';
import {
  enqueueGenerationJob,
  getPendingJobs,
  readJobsForTitle,
  GENERATION_JOB_FILTER_OPTIONS,
  filterGenerationJobsBySource,
  generationJobsToCsv,
  stillGenerationJobsToCsv,
  videoGenerationJobsToCsv,
  engineGenerationJobsToCsv,
  resolveGenerationEngineFilter,
  failedGenerationJobsToCsv,
  pendingGenerationJobsToCsv,
  cancelledGenerationJobsToCsv,
  succeededGenerationJobsToCsv,
  generationJobsToMarkdown,
  stillGenerationJobsToMarkdown,
  videoGenerationJobsToMarkdown,
  failedGenerationJobsToMarkdown,
  pendingGenerationJobsToMarkdown,
  cancelledGenerationJobsToMarkdown,
  succeededGenerationJobsToMarkdown,
  engineGenerationJobsToMarkdown,
  cancelGenerationJob,
  retryGenerationJob,
  JOB_STATUS
} from '../utils/generationJobs';
import {
  getActiveModelEngine,
  listModelAdapters,
  MODEL_ENGINES,
  setActiveModelEngine
} from '../services/modelAdapters';
import {
  getReplicateStillModel,
  getReplicateVideoModel,
  hasReplicateKey,
  REPLICATE_STILL_MODELS,
  REPLICATE_VIDEO_MODELS,
  setReplicateStillModel,
  setReplicateVideoModel
} from '../services/replicateClient';
import {
  getSeedanceStillModel,
  getSeedanceVideoModel,
  SEEDANCE_STILL_MODELS,
  SEEDANCE_VIDEO_MODELS,
  setSeedanceStillModel,
  setSeedanceVideoModel
} from '../services/seedanceModels';
import { getCurrentUserEmail } from '../utils/projectPermissions';
import {
  getActiveStillUrl,
  getActiveVideoTake,
  shotTakeSummary,
  listStillTakes,
  listVideoTakes,
  setActiveStillTake,
  setActiveVideoTake,
  advanceTakeReview,
  TAKE_REVIEW_META
} from '../utils/shotTakes';
import {
  applyShotBridge,
  blockingFlags,
  buildVideoJobPackFiles,
  continuityFlagsForShot,
  hasTakeLastFrame,
  readLockedImageFile,
  shotDurationSec,
  videoJobSlots
} from '../utils/continuitySpine';
import { canGenerateForLifecycle, canGenerateForProject, isLifecycleLocked, lifecycleExportReadiness } from '../utils/productionLifecycle';
import LifecycleControls from './LifecycleControls';

function TakeStrip({ shot, index, onUpdateShot, lifeLocked }) {
  if (!onUpdateShot || !shot) return null;
  const stillSlots = ['first_frame', 'last_frame'];
  const videos = listVideoTakes(shot);
  const activeVideoId = shot.generationTakes?.activeVideoTakeId || '';

  const apply = (next) => onUpdateShot(index, next);

  return (
    <div className="rounded-[8px] border border-[var(--sps-border)] p-2.5 space-y-2 bg-[var(--sps-bg-elevated)]">
      <p className="text-[10px] uppercase tracking-widest text-[var(--sps-muted)] m-0">Takes</p>
      {stillSlots.map((slot) => {
        const takes = listStillTakes(shot, slot);
        if (!takes.length) return null;
        const activeId = shot.generationTakes?.activeStill?.[slot];
        return (
          <div key={slot} className="space-y-1">
            <p className="text-[9px] font-mono text-[var(--sps-muted)] m-0">{slot.replace('_', ' ')}</p>
            <div className="flex flex-wrap gap-1.5">
              {takes.map((t, i) => {
                const active = t.id === activeId;
                const review = t.reviewStatus || 'draft';
                const meta = TAKE_REVIEW_META[review] || TAKE_REVIEW_META.draft;
                return (
                  <div
                    key={t.id}
                    className={`flex items-center gap-1 border rounded px-1.5 py-1 ${
                      active ? 'border-[var(--sps-gold)]' : 'border-[var(--sps-border)]'
                    }`}
                  >
                    {t.url ? (
                      <img src={t.url} alt="" className="w-8 h-8 object-cover rounded-sm" />
                    ) : (
                      <span className="w-8 h-8 text-[8px] flex items-center justify-center border border-[var(--sps-border)]">
                        #{i + 1}
                      </span>
                    )}
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        className="text-[9px] font-mono text-left disabled:opacity-40"
                        disabled={lifeLocked || active}
                        title={active ? 'Active still' : 'Set active'}
                        onClick={() => apply(setActiveStillTake(shot, slot, t.id))}
                      >
                        {active ? 'Active' : 'Use'}
                      </button>
                      <button
                        type="button"
                        className="text-[8px] uppercase text-[var(--sps-muted)] disabled:opacity-40"
                        disabled={lifeLocked || !meta.next}
                        title={`Advance review (${review})`}
                        onClick={() => apply(advanceTakeReview(shot, { kind: 'still', takeId: t.id }))}
                      >
                        {meta.label}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {videos.length ? (
        <div className="space-y-1">
          <p className="text-[9px] font-mono text-[var(--sps-muted)] m-0">video</p>
          <div className="flex flex-wrap gap-1.5">
            {videos.map((t, i) => {
              const active = t.id === activeVideoId;
              const review = t.reviewStatus || 'draft';
              const meta = TAKE_REVIEW_META[review] || TAKE_REVIEW_META.draft;
              return (
                <div
                  key={t.id}
                  className={`flex items-center gap-1 border rounded px-1.5 py-1 ${
                    active ? 'border-[var(--sps-gold)]' : 'border-[var(--sps-border)]'
                  }`}
                >
                  <span className="text-[9px] font-mono">V{i + 1}</span>
                  <button
                    type="button"
                    className="text-[9px] font-mono disabled:opacity-40"
                    disabled={lifeLocked || active}
                    onClick={() => apply(setActiveVideoTake(shot, t.id))}
                  >
                    {active ? 'Active' : 'Use'}
                  </button>
                  <button
                    type="button"
                    className="text-[8px] uppercase text-[var(--sps-muted)] disabled:opacity-40"
                    disabled={lifeLocked || !meta.next}
                    onClick={() => apply(advanceTakeReview(shot, { kind: 'video', takeId: t.id }))}
                  >
                    {meta.label}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function GenerateDeskModal({
  isOpen,
  onClose,
  shots = [],
  activeShotIndex = 0,
  setActiveShotIndex,
  projectTitle = '',
  onSaveTake,
  onSaveVideo,
  onOpenCompiler,
  onOpenReel,
  onOpenStage,
  onUpdateShot
}) {
  const [copied, setCopied] = useState(false);
  const [takeSlot, setTakeSlot] = useState('last_frame');
  const [deskMode, setDeskMode] = useState('still');
  const [status, setStatus] = useState('');
  const [failStreakHint, setFailStreakHint] = useState(0);
  const [override, setOverride] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [jobTick, setJobTick] = useState(0);
  const [jobFilter, setJobFilter] = useState('all');
  const [jobFilterPulse, setJobFilterPulse] = useState('');
  const {
    strict: generateLifecycleStrict,
    mode: generateLifecycleMode
  } = useExportLifecyclePref('generate');
  const [modelEngine, setModelEngine] = useState(() => getActiveModelEngine());
  const [engineAriaTransition, setEngineAriaTransition] = useState('');
  const [stillModelTitleHint, setStillModelTitleHint] = useState('');
  const [videoModelTitleHint, setVideoModelTitleHint] = useState('');
  const [stillModelId, setStillModelId] = useState(() => getReplicateStillModel());
  const [videoModelId, setVideoModelId] = useState(() => getReplicateVideoModel());
  const [seedanceStillId, setSeedanceStillId] = useState(() => getSeedanceStillModel());
  const [seedanceVideoId, setSeedanceVideoId] = useState(() => getSeedanceVideoModel());
  const [creditStatus, setCreditStatus] = useState(() => managedCreditStatus());
  const [comfyOpen, setComfyOpen] = useState(false);
  const [engineHealth, setEngineHealth] = useState({
    ok: true,
    checking: false,
    message: '',
    checkedAt: ''
  });
  const [engineHealthTick, setEngineHealthTick] = useState(0);
  const [engineDotPulse, setEngineDotPulse] = useState(false);
  const engineRecheckToastRef = useRef(false);
  const engineAutoCheckRef = useRef(false);

  // P142–P147 — close clears flags/pulses + fail streak; open resets engine/job/fail UI
  useEffect(() => {
    if (!isOpen) {
      engineRecheckToastRef.current = false;
      engineAutoCheckRef.current = false;
      setJobFilterPulse('');
      setFailStreakHint(0);
      setEngineAriaTransition('');
      setStillModelTitleHint('');
      setVideoModelTitleHint('');
      return undefined;
    }
    setEngineDotPulse(false);
    setJobFilter('all');
    setJobFilterPulse('');
    setFailStreakHint(0);
    setStatus((s) =>
      String(s || '').includes('consecutive jobs failed') ? '' : s
    );
    return undefined;
  }, [isOpen]);

  useEffect(() => {
    const onEngine = () => setModelEngine(getActiveModelEngine());
    const onReplicateModels = () => {
      setStillModelId(getReplicateStillModel());
      setVideoModelId(getReplicateVideoModel());
    };
    const onSeedanceModels = () => {
      setSeedanceStillId(getSeedanceStillModel());
      setSeedanceVideoId(getSeedanceVideoModel());
    };
    window.addEventListener('sps_model_engine_changed', onEngine);
    window.addEventListener('sps_replicate_models_changed', onReplicateModels);
    window.addEventListener('sps_seedance_models_changed', onSeedanceModels);
    return () => {
      window.removeEventListener('sps_model_engine_changed', onEngine);
      window.removeEventListener('sps_replicate_models_changed', onReplicateModels);
      window.removeEventListener('sps_seedance_models_changed', onSeedanceModels);
    };
  }, []);

  useEffect(() => {
    const refresh = () => setCreditStatus(managedCreditStatus());
    refresh();
    window.addEventListener('sps_saas_changed', refresh);
    return () => window.removeEventListener('sps_saas_changed', refresh);
  }, []);

  const engineOptions = useMemo(() => listModelAdapters(), [modelEngine]);
  const engineToastLabel =
    engineOptions.find((a) => a.id === modelEngine)?.label || modelEngine || 'engine';
  const engineSelectLabelTitle = engineAriaTransition
    ? `Generation engine · ${engineAriaTransition}`
    : engineOptionTitle('Generation engine');
  const engineOptionTitle = (label) => `${label} · ${engineToastLabel}`;
  const isLocalExport = modelEngine === MODEL_ENGINES.LOCAL_EXPORT;
  const isReplicate = modelEngine === MODEL_ENGINES.REPLICATE;
  const isSeedance =
    modelEngine === MODEL_ENGINES.SEEDANCE || modelEngine === MODEL_ENGINES.BYTEPLUS;
  const replicateReady = useMemo(() => hasReplicateKey(getCurrentUserEmail()), [modelEngine]);
  const activeStillModelLabel = useMemo(() => {
    const models = isReplicate ? REPLICATE_STILL_MODELS : SEEDANCE_STILL_MODELS;
    const id = isReplicate ? stillModelId : seedanceStillId;
    return models.find((m) => m.id === id)?.label || id || 'still';
  }, [isReplicate, stillModelId, seedanceStillId]);
  const activeVideoModelLabel = useMemo(() => {
    const models = isReplicate ? REPLICATE_VIDEO_MODELS : SEEDANCE_VIDEO_MODELS;
    const id = isReplicate ? videoModelId : seedanceVideoId;
    return models.find((m) => m.id === id)?.label || id || 'video';
  }, [isReplicate, videoModelId, seedanceVideoId]);
  const stillModelSelectLabelTitle =
    stillModelTitleHint ||
    engineOptionTitle(`Still model · ${activeStillModelLabel}`);
  const videoModelSelectLabelTitle =
    videoModelTitleHint ||
    engineOptionTitle(`Video model · ${activeVideoModelLabel}`);
  const getDeskModeTab = (mode, active = false) =>
    mode === 'video'
      ? active || deskMode === 'video'
        ? engineOptionTitle('Video · active')
        : engineOptionTitle('Video')
      : active || deskMode === 'still'
        ? engineOptionTitle('Still · active')
        : engineOptionTitle('Still');
  const modelSelectLabelTitle =
    deskMode === 'video' ? videoModelSelectLabelTitle : stillModelSelectLabelTitle;

  const switchDeskMode = (mode) => {
    if (deskMode === mode) return;
    setDeskMode(mode);
    try {
      window.dispatchEvent(
        new CustomEvent('sps_toast', {
          detail: {
            message: getDeskModeTab(mode, true)
          }
        })
      );
    } catch {
      /* ignore */
    }
  };

  const index = Math.max(0, Math.min(activeShotIndex, Math.max(0, (shots || []).length - 1)));
  const shot = shots[index] || {};

  useEffect(() => {
    if (!isOpen) return;
    setOverride(false);
    setStatus('');
    setCopied(false);
  }, [index, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onJobs = () => setJobTick((n) => n + 1);
    window.addEventListener('sps_generation_job_updated', onJobs);
    return () => window.removeEventListener('sps_generation_job_updated', onJobs);
  }, [isOpen]);

  // P108/P113/P114 — fail streak toast + View failed link; clear when a newer job succeeds
  useEffect(() => {
    if (!isOpen || !projectTitle) return;
    const jobs = readJobsForTitle(projectTitle);
    const recent = jobs.slice(0, 10);
    let streak = 0;
    for (const j of recent) {
      if (j.status === 'failed') streak++;
      else break;
    }
    if (streak >= 3) {
      setFailStreakHint(streak);
      setStatus(
        `\u26A0\uFE0F ${streak} consecutive jobs failed — check API keys or credit balance`
      );
      return;
    }
    setFailStreakHint((prev) => {
      if (prev >= 3) {
        const head = recent[0];
        if (head && head.status === 'succeeded') {
          setStatus('Fail streak cleared — latest job succeeded');
          // P124 — flash Succeeded chip when streak clears on success
          setJobFilter('succeeded');
          setJobFilterPulse('succeeded');
          window.setTimeout(() => setJobFilterPulse(''), 3000);
          // P150 — toast names Succeeded
          try {
            window.dispatchEvent(
              new CustomEvent('sps_toast', {
                detail: {
                  message: engineOptionTitle('Jobs · Succeeded · fail streak cleared')
                }
              })
            );
          } catch {
            /* ignore */
          }
        } else {
          setStatus((s) =>
            String(s || '').includes('consecutive jobs failed') ? '' : s
          );
        }
      }
      return 0;
    });
  }, [isOpen, projectTitle, jobTick]);

  useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;
    const stamp = () => new Date().toISOString();
    const finishHealth = (health) => {
      if (cancelled) return;
      setEngineHealth(health);
      // P133/P154 — toast when user-triggered Re-check finishes (+ engine name)
      if (engineRecheckToastRef.current) {
        engineRecheckToastRef.current = false;
        engineAutoCheckRef.current = false;
        // P138 — pulse engine chip on Re-check finish (label restores via checking:false)
        setEngineDotPulse(true);
        window.setTimeout(() => setEngineDotPulse(false), 3000);
        try {
          // P160 — unhealthy Re-check matches under-engine / auto: message · Re-check
          const unhealthyMsg = health.message || 'check keys / host';
          window.dispatchEvent(
            new CustomEvent('sps_toast', {
              detail: {
                message: health.ok
                  ? // P161 — OK path keeps engine label (unhealthy uses message · Re-check)
                    engineOptionTitle('Engine OK')
                  : `${unhealthyMsg} · Re-check`
              }
            })
          );
        } catch {
          /* ignore */
        }
        return;
      }
      // P134 — toast when auto 60s check finds unhealthy (not when OK)
      if (engineAutoCheckRef.current) {
        engineAutoCheckRef.current = false;
        if (!health.ok) {
          try {
            // P159 — match under-engine wording: message · Re-check
            const unhealthyMsg = health.message || 'check keys / host';
            window.dispatchEvent(
              new CustomEvent('sps_toast', {
                detail: {
                  message: `${unhealthyMsg} · Re-check`
                }
              })
            );
          } catch {
            /* ignore */
          }
        }
      }
    };
    const probeEngine = async () => {
      setEngineHealth((prev) => ({ ...prev, checking: true, message: '' }));
      if (modelEngine === MODEL_ENGINES.LOCAL_EXPORT) {
        // P110 — Local export / Comfy path: ping ComfyUI host (same probe as workflow modal)
        try {
          const probe = await probeComfyUi(getComfyUiBaseUrl());
          finishHealth({
            ok: Boolean(probe?.ok),
            checking: false,
            checkedAt: stamp(),
            message: probe?.ok
              ? ''
              : (probe?.message || 'ComfyUI unreachable — start local host or switch engine')
          });
        } catch (err) {
          finishHealth({
            ok: false,
            checking: false,
            checkedAt: stamp(),
            message: err?.message || 'ComfyUI unreachable'
          });
        }
        return;
      }
      if (modelEngine === MODEL_ENGINES.REPLICATE) {
        const ok = hasReplicateKey(getCurrentUserEmail());
        finishHealth({
          ok,
          checking: false,
          checkedAt: stamp(),
          message: ok ? '' : 'Replicate key missing'
        });
        return;
      }
      try {
        const res = await fetch('/api/saas', { method: 'GET', cache: 'no-store' });
        finishHealth({
          ok: res.ok,
          checking: false,
          checkedAt: stamp(),
          message: res.ok ? '' : 'Studio generate API unreachable'
        });
      } catch {
        finishHealth({
          ok: false,
          checking: false,
          checkedAt: stamp(),
          message: 'Studio generate API unreachable'
        });
      }
    };
    probeEngine();
    return () => {
      cancelled = true;
    };
  }, [isOpen, modelEngine, engineHealthTick, engineToastLabel]);

  // P118/P119 — auto re-check every 60s; pause while any generate job is queued/running
  useEffect(() => {
    if (!isOpen) return undefined;
    const id = window.setInterval(() => {
      const pending = getPendingJobs(projectTitle);
      if (pending.length > 0) return;
      // P134 — mark as auto-check so unhealthy can toast
      engineAutoCheckRef.current = true;
      setEngineHealthTick((n) => n + 1);
    }, 60_000);
    return () => window.clearInterval(id);
  }, [isOpen, projectTitle]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      // P126 — Esc clears job filter first (+ flash All), then closes desk
      if (jobFilter && jobFilter !== 'all') {
        setJobFilter('all');
        setJobFilterPulse('all');
        window.setTimeout(() => setJobFilterPulse(''), 3000);
        setFailStreakHint(0);
        setStatus('Job filter cleared');
        // P128 — brief toast on filter clear (Esc when already All still closes)
        try {
          window.dispatchEvent(
            new CustomEvent('sps_toast', { detail: { message: 'Job filter cleared' } })
          );
        } catch {
          /* ignore */
        }
        return;
      }
      onClose?.();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [isOpen, onClose, jobFilter]);
  const bridged = useMemo(
    () => (isOpen ? applyShotBridge(shot, shots, index) : shot),
    [isOpen, shot, shots, index]
  );
  const prompt = useMemo(() => {
    if (!isOpen) return '';
    const { masterCinemaPrompt } = compileMasterCinemaCompilerPrompt(bridged, index, {
      projectTitle,
      shots
    });
    return masterCinemaPrompt;
  }, [isOpen, bridged, index, projectTitle, shots]);

  const flags = continuityFlagsForShot(shot, shots, index);
  const blocked = blockingFlags(flags);
  const warns = flags.filter((f) => !f.block);
  const lifeLocked = isLifecycleLocked(shot);
  const dirty = blocked.length > 0 && !override;
  const generateBlocked = dirty || lifeLocked;
  const exportLife = useMemo(() => lifecycleExportReadiness(shots, projectTitle), [shots, projectTitle]);
  const exportBlocked = generateLifecycleStrict && !exportLife.exportReady;
  const slots = videoJobSlots(shot, shots, index);
  const id = parseSceneAndShotID(shot, index).formattedId || shot.sceneShotId || `Shot ${index + 1}`;
  const dur = shotDurationSec(shot);
  const endStill = getActiveStillUrl(shot, 'last_frame');
  const startStill = bridged.embeddedImages?.first_frame || getActiveStillUrl(shot, 'first_frame');
  const clip = getActiveVideoTake(shot) || {};
  const takeSummary = shotTakeSummary(shot);
  const roomId = resolveCollabRoomId();
  const lifeNote = `${id} · ${dur}s · ${slots.length} slots · ${modelEngine || 'engine'}`;
  const pendingJobs = useMemo(() => {
    if (!isOpen || !projectTitle) return [];
    return getPendingJobs(projectTitle).filter((j) => j.sceneShotId === (shot.sceneShotId || `SH_${index + 1}`));
  }, [isOpen, projectTitle, shot.sceneShotId, index, jobTick]);
  const projectPendingCount = useMemo(() => {
    if (!isOpen || !projectTitle) return 0;
    return getPendingJobs(projectTitle).length;
  }, [isOpen, projectTitle, jobTick]);
  const autoCheckPaused = projectPendingCount > 0;
  const shotKey = shot.sceneShotId || `SH_${index + 1}`;
  const jobHistory = useMemo(() => {
    if (!isOpen || !projectTitle) return [];
    const all = readJobsForTitle(projectTitle).filter((j) => j.sceneShotId === shotKey);
    return filterGenerationJobsBySource(all, jobFilter).slice(0, 12);
  }, [isOpen, projectTitle, shotKey, jobFilter, jobTick]);
  const videoJobBusy = pendingJobs.some((j) => j.type === 'video');
  const canGoNext = index < shots.length - 1 && hasTakeLastFrame(shot);

  const httpFrame = (url) => (String(url || '').startsWith('http') ? url : '');

  if (!isOpen) return null;

  const refuseIfDirty = () => {
    if (!dirty) return false;
    setStatus(`Blocked: ${blocked.map((f) => f.label).join(' · ')}. Lock looks / previous last frame, or override.`);
    return true;
  };

  const refuseIfGenerateBlocked = () => {
    if (!canGenerateForProject(projectTitle)) {
      setStatus('Project is locked — unlock production before generating new takes.');
      return true;
    }
    if (lifeLocked || !canGenerateForLifecycle(shot)) {
      setStatus('Shot is locked — unlock lifecycle before generating new takes.');
      return true;
    }
    return refuseIfDirty();
  };

  const copyPrompt = async () => {
    if (refuseIfDirty()) return;
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const saveTxt = async () => {
    if (refuseIfDirty()) return;
    const blob = new Blob([prompt], { type: 'text/plain;charset=utf-8' });
    const saved = await saveExportBlob(blob, `${String(id).replace(/\s+/g, '_')}.txt`, {
      projectTitle,
      shots,
      lifecycleMode: generateLifecycleMode,
      auditLabel: 'generate_prompt_txt',
      auditFormat: 'txt',
      roomId,
      note: lifeNote
    });
    if (saved?.blocked) setStatus(saved.error || exportLife.message || 'Export blocked');
  };

  const saveJobPack = async () => {
    if (refuseIfDirty()) return;
    const files = buildVideoJobPackFiles(shot, shots, index, prompt, id);
    const blob = createZipArchive(files);
    const saved = await saveExportBlob(blob, `${String(id).replace(/\s+/g, '_')}_job.zip`, {
      projectTitle,
      shots,
      lifecycleMode: generateLifecycleMode,
      auditLabel: 'generate_job_pack',
      auditFormat: 'zip',
      roomId,
      note: lifeNote
    });
    if (saved?.blocked) {
      setStatus(saved.error || exportLife.message || 'Export blocked');
      return;
    }
    setStatus(`Job pack saved · ${slots.length} image slot${slots.length === 1 ? '' : 's'}`);
  };

  const savePrintPdf = () => {
    if (refuseIfDirty()) return;
    if (exportBlocked) {
      assertExportAllowed({
        projectTitle,
        label: 'generate_desk_pdf',
        format: 'pdf',
        lifecycleMode: generateLifecycleMode,
        shots,
        roomId,
        showAlert: true
      });
      return;
    }
    const gate = assertExportAllowed({
      projectTitle,
      label: 'generate_desk_pdf',
      format: 'pdf',
      lifecycleMode: generateLifecycleMode,
      shots,
      roomId,
      showAlert: true
    });
    if (!gate.ok) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.alert('Please allow popups to export PDF.');
      return;
    }
    printWindow.document.write(
      generateDeskToPrintHtml({
        projectTitle,
        shotId: id,
        durationSec: dur,
        engine: modelEngine,
        deskMode,
        prompt,
        takeSummary,
        flags,
        slots
      })
    );
    printWindow.document.close();
    const slug = String(id || 'shot').replace(/\s+/g, '_');
    const roomTag = roomId ? `_${String(roomId).replace(/[^\w\-]+/g, '_').slice(0, 24)}` : '';
    logExportSuccess({
      projectTitle,
      label: 'generate_desk_pdf',
      format: 'pdf',
      filename: `${slug}_generate${roomTag}.pdf`,
      roomId,
      note: lifeNote,
      lifecycleMode: gate.advisory ? `${generateLifecycleMode}+ok` : generateLifecycleMode
    });
    setStatus('Print sheet opened — save as PDF from the print dialog.');
  };

  const saveStillJobsCsv = () => {
    if (refuseIfDirty()) return;
    if (exportBlocked) {
      assertExportAllowed({
        projectTitle,
        label: 'generate_still_jobs_csv',
        format: 'csv',
        lifecycleMode: generateLifecycleMode,
        shots,
        roomId,
        showAlert: true
      });
      return;
    }
    const all = readJobsForTitle(projectTitle).filter((j) => j.sceneShotId === shotKey);
    const stillCount = filterGenerationJobsBySource(all, 'still').length;
    const csv = stillGenerationJobsToCsv(all, { projectTitle });
    const slug = String(id || 'shot').replace(/\s+/g, '_');
    const roomTag = roomId ? `_${String(roomId).replace(/[^\w\-]+/g, '_').slice(0, 24)}` : '';
    const result = exportDownloadText(`${slug}_still_jobs${roomTag}.csv`, csv, {
      projectTitle,
      auditLabel: 'generate_still_jobs_csv',
      auditFormat: 'csv',
      lifecycleMode: generateLifecycleMode,
      shots,
      roomId,
      note: `${lifeNote} · ${stillCount} still jobs`,
      mime: 'text/csv;charset=utf-8'
    });
    if (result?.blocked) {
      setStatus(result.error || exportLife.message || 'Export blocked');
      return;
    }
    setStatus(`Still jobs CSV · ${stillCount} row${stillCount === 1 ? '' : 's'}`);
  };

  const saveStillJobsMd = () => {
    if (refuseIfDirty()) return;
    if (exportBlocked) {
      assertExportAllowed({
        projectTitle,
        label: 'generate_still_jobs_md',
        format: 'md',
        lifecycleMode: generateLifecycleMode,
        shots,
        roomId,
        showAlert: true
      });
      return;
    }
    const all = readJobsForTitle(projectTitle).filter((j) => j.sceneShotId === shotKey);
    const stillCount = filterGenerationJobsBySource(all, 'still').length;
    const md = stillGenerationJobsToMarkdown(all, { projectTitle, roomId });
    const slug = String(id || 'shot').replace(/\s+/g, '_');
    const roomTag = roomId ? `_${String(roomId).replace(/[^\w\-]+/g, '_').slice(0, 24)}` : '';
    const result = exportDownloadText(`${slug}_still_jobs${roomTag}.md`, md, {
      projectTitle,
      auditLabel: 'generate_still_jobs_md',
      auditFormat: 'md',
      lifecycleMode: generateLifecycleMode,
      shots,
      roomId,
      note: `${lifeNote} · ${stillCount} still jobs`,
      mime: 'text/markdown;charset=utf-8'
    });
    if (result?.blocked) {
      setStatus(result.error || exportLife.message || 'Export blocked');
      return;
    }
    setStatus(`Still jobs MD · ${stillCount} row${stillCount === 1 ? '' : 's'}`);
  };

  const saveVideoJobsCsv = () => {
    if (refuseIfDirty()) return;
    if (exportBlocked) {
      assertExportAllowed({
        projectTitle,
        label: 'generate_video_jobs_csv',
        format: 'csv',
        lifecycleMode: generateLifecycleMode,
        shots,
        roomId,
        showAlert: true
      });
      return;
    }
    const all = readJobsForTitle(projectTitle).filter((j) => j.sceneShotId === shotKey);
    const videoCount = filterGenerationJobsBySource(all, 'video').length;
    const csv = videoGenerationJobsToCsv(all, { projectTitle });
    const slug = String(id || 'shot').replace(/\s+/g, '_');
    const roomTag = roomId ? `_${String(roomId).replace(/[^\w\-]+/g, '_').slice(0, 24)}` : '';
    const result = exportDownloadText(`${slug}_video_jobs${roomTag}.csv`, csv, {
      projectTitle,
      auditLabel: 'generate_video_jobs_csv',
      auditFormat: 'csv',
      lifecycleMode: generateLifecycleMode,
      shots,
      roomId,
      note: `${lifeNote} · ${videoCount} video jobs`,
      mime: 'text/csv;charset=utf-8'
    });
    if (result?.blocked) {
      setStatus(result.error || exportLife.message || 'Export blocked');
      return;
    }
    setStatus(`Video jobs CSV · ${videoCount} row${videoCount === 1 ? '' : 's'}`);
  };

  const saveVideoJobsMd = () => {
    if (refuseIfDirty()) return;
    if (exportBlocked) {
      assertExportAllowed({
        projectTitle,
        label: 'generate_video_jobs_md',
        format: 'md',
        lifecycleMode: generateLifecycleMode,
        shots,
        roomId,
        showAlert: true
      });
      return;
    }
    const all = readJobsForTitle(projectTitle).filter((j) => j.sceneShotId === shotKey);
    const videoCount = filterGenerationJobsBySource(all, 'video').length;
    const md = videoGenerationJobsToMarkdown(all, { projectTitle, roomId });
    const slug = String(id || 'shot').replace(/\s+/g, '_');
    const roomTag = roomId ? `_${String(roomId).replace(/[^\w\-]+/g, '_').slice(0, 24)}` : '';
    const result = exportDownloadText(`${slug}_video_jobs${roomTag}.md`, md, {
      projectTitle,
      auditLabel: 'generate_video_jobs_md',
      auditFormat: 'md',
      lifecycleMode: generateLifecycleMode,
      shots,
      roomId,
      note: `${lifeNote} · ${videoCount} video jobs`,
      mime: 'text/markdown;charset=utf-8'
    });
    if (result?.blocked) {
      setStatus(result.error || exportLife.message || 'Export blocked');
      return;
    }
    setStatus(`Video jobs MD · ${videoCount} row${videoCount === 1 ? '' : 's'}`);
  };

  const saveEngineJobsCsv = () => {
    if (refuseIfDirty()) return;
    if (exportBlocked) {
      assertExportAllowed({
        projectTitle,
        label: 'generate_engine_jobs_csv',
        format: 'csv',
        lifecycleMode: generateLifecycleMode,
        shots,
        roomId,
        showAlert: true
      });
      return;
    }
    const all = readJobsForTitle(projectTitle).filter((j) => j.sceneShotId === shotKey);
    const engineFilter = resolveGenerationEngineFilter(modelEngine);
    const engineCount = filterGenerationJobsBySource(all, engineFilter).length;
    const csv = engineGenerationJobsToCsv(all, { projectTitle, engine: modelEngine });
    const slug = String(id || 'shot').replace(/\s+/g, '_');
    const engineTag = String(engineFilter || 'all').replace(/[^\w\-]+/g, '_');
    const roomTag = roomId ? `_${String(roomId).replace(/[^\w\-]+/g, '_').slice(0, 24)}` : '';
    const result = exportDownloadText(`${slug}_engine_${engineTag}_jobs${roomTag}.csv`, csv, {
      projectTitle,
      auditLabel: 'generate_engine_jobs_csv',
      auditFormat: 'csv',
      lifecycleMode: generateLifecycleMode,
      shots,
      roomId,
      note: `${lifeNote} · engine:${modelEngine || engineFilter} · ${engineCount} jobs`,
      mime: 'text/csv;charset=utf-8'
    });
    if (result?.blocked) {
      setStatus(result.error || exportLife.message || 'Export blocked');
      return;
    }
    setStatus(`Engine CSV (${modelEngine || engineFilter}) · ${engineCount} row${engineCount === 1 ? '' : 's'}`);
  };

  const saveEngineJobsMd = () => {
    if (refuseIfDirty()) return;
    if (exportBlocked) {
      assertExportAllowed({
        projectTitle,
        label: 'generate_engine_jobs_md',
        format: 'md',
        lifecycleMode: generateLifecycleMode,
        shots,
        roomId,
        showAlert: true
      });
      return;
    }
    const all = readJobsForTitle(projectTitle).filter((j) => j.sceneShotId === shotKey);
    const engineFilter = resolveGenerationEngineFilter(modelEngine);
    const engineCount = filterGenerationJobsBySource(all, engineFilter).length;
    const md = engineGenerationJobsToMarkdown(all, { projectTitle, engine: modelEngine, roomId });
    const slug = String(id || 'shot').replace(/\s+/g, '_');
    const engineTag = String(engineFilter || 'all').replace(/[^\w\-]+/g, '_');
    const roomTag = roomId ? `_${String(roomId).replace(/[^\w\-]+/g, '_').slice(0, 24)}` : '';
    const result = exportDownloadText(`${slug}_engine_${engineTag}_jobs${roomTag}.md`, md, {
      projectTitle,
      auditLabel: 'generate_engine_jobs_md',
      auditFormat: 'md',
      lifecycleMode: generateLifecycleMode,
      shots,
      roomId,
      note: `${lifeNote} · engine:${modelEngine || engineFilter} · ${engineCount} jobs`,
      mime: 'text/markdown;charset=utf-8'
    });
    if (result?.blocked) {
      setStatus(result.error || exportLife.message || 'Export blocked');
      return;
    }
    setStatus(`Engine MD (${modelEngine || engineFilter}) · ${engineCount} row${engineCount === 1 ? '' : 's'}`);
  };

  const saveFailedJobsCsv = () => {
    if (refuseIfDirty()) return;
    if (exportBlocked) {
      assertExportAllowed({
        projectTitle,
        label: 'generate_failed_jobs_csv',
        format: 'csv',
        lifecycleMode: generateLifecycleMode,
        shots,
        roomId,
        showAlert: true
      });
      return;
    }
    const all = readJobsForTitle(projectTitle).filter((j) => j.sceneShotId === shotKey);
    const failedCount = filterGenerationJobsBySource(all, 'failed').length;
    const csv = failedGenerationJobsToCsv(all, { projectTitle });
    const slug = String(id || 'shot').replace(/\s+/g, '_');
    const roomTag = roomId ? `_${String(roomId).replace(/[^\w\-]+/g, '_').slice(0, 24)}` : '';
    const result = exportDownloadText(`${slug}_failed_jobs${roomTag}.csv`, csv, {
      projectTitle,
      auditLabel: 'generate_failed_jobs_csv',
      auditFormat: 'csv',
      lifecycleMode: generateLifecycleMode,
      shots,
      roomId,
      note: `${lifeNote} · failed · ${failedCount} jobs`,
      mime: 'text/csv;charset=utf-8'
    });
    if (result?.blocked) {
      setStatus(result.error || exportLife.message || 'Export blocked');
      return;
    }
    setStatus(`Failed CSV · ${failedCount} row${failedCount === 1 ? '' : 's'}`);
  };

  const saveFailedJobsMd = () => {
    if (refuseIfDirty()) return;
    if (exportBlocked) {
      assertExportAllowed({
        projectTitle,
        label: 'generate_failed_jobs_md',
        format: 'md',
        lifecycleMode: generateLifecycleMode,
        shots,
        roomId,
        showAlert: true
      });
      return;
    }
    const all = readJobsForTitle(projectTitle).filter((j) => j.sceneShotId === shotKey);
    const failedCount = filterGenerationJobsBySource(all, 'failed').length;
    const md = failedGenerationJobsToMarkdown(all, { projectTitle, roomId });
    const slug = String(id || 'shot').replace(/\s+/g, '_');
    const roomTag = roomId ? `_${String(roomId).replace(/[^\w\-]+/g, '_').slice(0, 24)}` : '';
    const result = exportDownloadText(`${slug}_failed_jobs${roomTag}.md`, md, {
      projectTitle,
      auditLabel: 'generate_failed_jobs_md',
      auditFormat: 'md',
      lifecycleMode: generateLifecycleMode,
      shots,
      roomId,
      note: `${lifeNote} · failed · ${failedCount} jobs`,
      mime: 'text/markdown;charset=utf-8'
    });
    if (result?.blocked) {
      setStatus(result.error || exportLife.message || 'Export blocked');
      return;
    }
    setStatus(`Failed MD · ${failedCount} row${failedCount === 1 ? '' : 's'}`);
  };

  const savePendingJobsCsv = () => {
    if (refuseIfDirty()) return;
    if (exportBlocked) {
      assertExportAllowed({
        projectTitle,
        label: 'generate_pending_jobs_csv',
        format: 'csv',
        lifecycleMode: generateLifecycleMode,
        shots,
        roomId,
        showAlert: true
      });
      return;
    }
    const all = readJobsForTitle(projectTitle).filter((j) => j.sceneShotId === shotKey);
    const pendingCount = filterGenerationJobsBySource(all, 'pending').length;
    const csv = pendingGenerationJobsToCsv(all, { projectTitle });
    const slug = String(id || 'shot').replace(/\s+/g, '_');
    const roomTag = roomId ? `_${String(roomId).replace(/[^\w\-]+/g, '_').slice(0, 24)}` : '';
    const result = exportDownloadText(`${slug}_pending_jobs${roomTag}.csv`, csv, {
      projectTitle,
      auditLabel: 'generate_pending_jobs_csv',
      auditFormat: 'csv',
      lifecycleMode: generateLifecycleMode,
      shots,
      roomId,
      note: `${lifeNote} · pending · ${pendingCount} jobs`,
      mime: 'text/csv;charset=utf-8'
    });
    if (result?.blocked) {
      setStatus(result.error || exportLife.message || 'Export blocked');
      return;
    }
    setStatus(`Pending CSV · ${pendingCount} row${pendingCount === 1 ? '' : 's'}`);
  };

  const savePendingJobsMd = () => {
    if (refuseIfDirty()) return;
    if (exportBlocked) {
      assertExportAllowed({
        projectTitle,
        label: 'generate_pending_jobs_md',
        format: 'md',
        lifecycleMode: generateLifecycleMode,
        shots,
        roomId,
        showAlert: true
      });
      return;
    }
    const all = readJobsForTitle(projectTitle).filter((j) => j.sceneShotId === shotKey);
    const pendingCount = filterGenerationJobsBySource(all, 'pending').length;
    const md = pendingGenerationJobsToMarkdown(all, { projectTitle, roomId });
    const slug = String(id || 'shot').replace(/\s+/g, '_');
    const roomTag = roomId ? `_${String(roomId).replace(/[^\w\-]+/g, '_').slice(0, 24)}` : '';
    const result = exportDownloadText(`${slug}_pending_jobs${roomTag}.md`, md, {
      projectTitle,
      auditLabel: 'generate_pending_jobs_md',
      auditFormat: 'md',
      lifecycleMode: generateLifecycleMode,
      shots,
      roomId,
      note: `${lifeNote} · pending · ${pendingCount} jobs`,
      mime: 'text/markdown;charset=utf-8'
    });
    if (result?.blocked) {
      setStatus(result.error || exportLife.message || 'Export blocked');
      return;
    }
    setStatus(`Pending MD · ${pendingCount} row${pendingCount === 1 ? '' : 's'}`);
  };

  const saveCancelledJobsCsv = () => {
    if (refuseIfDirty()) return;
    if (exportBlocked) {
      assertExportAllowed({
        projectTitle,
        label: 'generate_cancelled_jobs_csv',
        format: 'csv',
        lifecycleMode: generateLifecycleMode,
        shots,
        roomId,
        showAlert: true
      });
      return;
    }
    const all = readJobsForTitle(projectTitle).filter((j) => j.sceneShotId === shotKey);
    const cancelledCount = filterGenerationJobsBySource(all, 'cancelled').length;
    const csv = cancelledGenerationJobsToCsv(all, { projectTitle });
    const slug = String(id || 'shot').replace(/\s+/g, '_');
    const roomTag = roomId ? `_${String(roomId).replace(/[^\w\-]+/g, '_').slice(0, 24)}` : '';
    const result = exportDownloadText(`${slug}_cancelled_jobs${roomTag}.csv`, csv, {
      projectTitle,
      auditLabel: 'generate_cancelled_jobs_csv',
      auditFormat: 'csv',
      lifecycleMode: generateLifecycleMode,
      shots,
      roomId,
      note: `${lifeNote} · cancelled · ${cancelledCount} jobs`,
      mime: 'text/csv;charset=utf-8'
    });
    if (result?.blocked) {
      setStatus(result.error || exportLife.message || 'Export blocked');
      return;
    }
    setStatus(`Cancelled CSV · ${cancelledCount} row${cancelledCount === 1 ? '' : 's'}`);
  };

  const saveCancelledJobsMd = () => {
    if (refuseIfDirty()) return;
    if (exportBlocked) {
      assertExportAllowed({
        projectTitle,
        label: 'generate_cancelled_jobs_md',
        format: 'md',
        lifecycleMode: generateLifecycleMode,
        shots,
        roomId,
        showAlert: true
      });
      return;
    }
    const all = readJobsForTitle(projectTitle).filter((j) => j.sceneShotId === shotKey);
    const cancelledCount = filterGenerationJobsBySource(all, 'cancelled').length;
    const md = cancelledGenerationJobsToMarkdown(all, { projectTitle, roomId });
    const slug = String(id || 'shot').replace(/\s+/g, '_');
    const roomTag = roomId ? `_${String(roomId).replace(/[^\w\-]+/g, '_').slice(0, 24)}` : '';
    const result = exportDownloadText(`${slug}_cancelled_jobs${roomTag}.md`, md, {
      projectTitle,
      auditLabel: 'generate_cancelled_jobs_md',
      auditFormat: 'md',
      lifecycleMode: generateLifecycleMode,
      shots,
      roomId,
      note: `${lifeNote} · cancelled · ${cancelledCount} jobs`,
      mime: 'text/markdown;charset=utf-8'
    });
    if (result?.blocked) {
      setStatus(result.error || exportLife.message || 'Export blocked');
      return;
    }
    setStatus(`Cancelled MD · ${cancelledCount} row${cancelledCount === 1 ? '' : 's'}`);
  };

  const saveSucceededJobsCsv = () => {
    if (refuseIfDirty()) return;
    if (exportBlocked) {
      assertExportAllowed({
        projectTitle,
        label: 'generate_succeeded_jobs_csv',
        format: 'csv',
        lifecycleMode: generateLifecycleMode,
        shots,
        roomId,
        showAlert: true
      });
      return;
    }
    const all = readJobsForTitle(projectTitle).filter((j) => j.sceneShotId === shotKey);
    const succeededCount = filterGenerationJobsBySource(all, 'succeeded').length;
    const csv = succeededGenerationJobsToCsv(all, { projectTitle });
    const slug = String(id || 'shot').replace(/\s+/g, '_');
    const roomTag = roomId ? `_${String(roomId).replace(/[^\w\-]+/g, '_').slice(0, 24)}` : '';
    const result = exportDownloadText(`${slug}_succeeded_jobs${roomTag}.csv`, csv, {
      projectTitle,
      auditLabel: 'generate_succeeded_jobs_csv',
      auditFormat: 'csv',
      lifecycleMode: generateLifecycleMode,
      shots,
      roomId,
      note: `${lifeNote} · succeeded · ${succeededCount} jobs`,
      mime: 'text/csv;charset=utf-8'
    });
    if (result?.blocked) {
      setStatus(result.error || exportLife.message || 'Export blocked');
      return;
    }
    setStatus(`Succeeded CSV · ${succeededCount} row${succeededCount === 1 ? '' : 's'}`);
  };

  const saveSucceededJobsMd = () => {
    if (refuseIfDirty()) return;
    if (exportBlocked) {
      assertExportAllowed({
        projectTitle,
        label: 'generate_succeeded_jobs_md',
        format: 'md',
        lifecycleMode: generateLifecycleMode,
        shots,
        roomId,
        showAlert: true
      });
      return;
    }
    const all = readJobsForTitle(projectTitle).filter((j) => j.sceneShotId === shotKey);
    const succeededCount = filterGenerationJobsBySource(all, 'succeeded').length;
    const md = succeededGenerationJobsToMarkdown(all, { projectTitle, roomId });
    const slug = String(id || 'shot').replace(/\s+/g, '_');
    const roomTag = roomId ? `_${String(roomId).replace(/[^\w\-]+/g, '_').slice(0, 24)}` : '';
    const result = exportDownloadText(`${slug}_succeeded_jobs${roomTag}.md`, md, {
      projectTitle,
      auditLabel: 'generate_succeeded_jobs_md',
      auditFormat: 'md',
      lifecycleMode: generateLifecycleMode,
      shots,
      roomId,
      note: `${lifeNote} · succeeded · ${succeededCount} jobs`,
      mime: 'text/markdown;charset=utf-8'
    });
    if (result?.blocked) {
      setStatus(result.error || exportLife.message || 'Export blocked');
      return;
    }
    setStatus(`Succeeded MD · ${succeededCount} row${succeededCount === 1 ? '' : 's'}`);
  };

  const saveFilteredJobsCsv = () => {
    if (refuseIfDirty()) return;
    if (exportBlocked) {
      assertExportAllowed({
        projectTitle,
        label: 'generate_filtered_jobs_csv',
        format: 'csv',
        lifecycleMode: generateLifecycleMode,
        shots,
        roomId,
        showAlert: true
      });
      return;
    }
    const all = readJobsForTitle(projectTitle).filter((j) => j.sceneShotId === shotKey);
    const filtered = filterGenerationJobsBySource(all, jobFilter);
    const csv = generationJobsToCsv(all, { projectTitle, filter: jobFilter });
    const slug = String(id || 'shot').replace(/\s+/g, '_');
    const filterTag = String(jobFilter || 'all').replace(/[^\w\-]+/g, '_');
    const roomTag = roomId ? `_${String(roomId).replace(/[^\w\-]+/g, '_').slice(0, 24)}` : '';
    const result = exportDownloadText(`${slug}_jobs_${filterTag}${roomTag}.csv`, csv, {
      projectTitle,
      auditLabel: 'generate_filtered_jobs_csv',
      auditFormat: 'csv',
      lifecycleMode: generateLifecycleMode,
      shots,
      roomId,
      note: `${lifeNote} · filter:${jobFilter} · ${filtered.length} jobs`,
      mime: 'text/csv;charset=utf-8'
    });
    if (result?.blocked) {
      setStatus(result.error || exportLife.message || 'Export blocked');
      return;
    }
    setStatus(`Jobs CSV (${jobFilter}) · ${filtered.length} row${filtered.length === 1 ? '' : 's'}`);
  };

  const saveFilteredJobsMd = () => {
    if (refuseIfDirty()) return;
    if (exportBlocked) {
      assertExportAllowed({
        projectTitle,
        label: 'generate_filtered_jobs_md',
        format: 'md',
        lifecycleMode: generateLifecycleMode,
        shots,
        roomId,
        showAlert: true
      });
      return;
    }
    const all = readJobsForTitle(projectTitle).filter((j) => j.sceneShotId === shotKey);
    const filtered = filterGenerationJobsBySource(all, jobFilter);
    const md = generationJobsToMarkdown(all, { projectTitle, filter: jobFilter, roomId });
    const slug = String(id || 'shot').replace(/\s+/g, '_');
    const filterTag = String(jobFilter || 'all').replace(/[^\w\-]+/g, '_');
    const roomTag = roomId ? `_${String(roomId).replace(/[^\w\-]+/g, '_').slice(0, 24)}` : '';
    const result = exportDownloadText(`${slug}_jobs_${filterTag}${roomTag}.md`, md, {
      projectTitle,
      auditLabel: 'generate_filtered_jobs_md',
      auditFormat: 'md',
      lifecycleMode: generateLifecycleMode,
      shots,
      roomId,
      note: `${lifeNote} · filter:${jobFilter} · ${filtered.length} jobs`,
      mime: 'text/markdown;charset=utf-8'
    });
    if (result?.blocked) {
      setStatus(result.error || exportLife.message || 'Export blocked');
      return;
    }
    setStatus(`Jobs MD (${jobFilter}) · ${filtered.length} row${filtered.length === 1 ? '' : 's'}`);
  };

  const saveTakeFile = async (file) => {
    if (!file || !onSaveTake) return;
    setStatus('Saving take…');
    const url = await readLockedImageFile(file);
    const key = `${shot.sceneShotId || `SH_${index + 1}`}_${takeSlot}`;
    onSaveTake(key, url);
    setStatus(
      takeSlot === 'last_frame'
        ? 'Last frame locked — next shot start is bound'
        : 'Start frame saved'
    );
  };

  const generateVideo = async () => {
    if (refuseIfGenerateBlocked()) return;
    if (isReplicate && !replicateReady) {
      setStatus('Add a Replicate key in Settings → API keys (BYOK).');
      return;
    }
    if (isLocalExport) {
      if (refuseIfDirty()) return;
      await saveJobPack();
      setStatus('Video prompt pack exported — run in your external engine, then lock takes here.');
      return;
    }
    if (!onSaveVideo) {
      setStatus('This desk cannot save a clip yet.');
      return;
    }
    const firstFrameUrl = httpFrame(startStill) || httpFrame(endStill);
    const shotKey = shot.sceneShotId || `SH_${index + 1}`;
    setStatus(
      isReplicate
        ? firstFrameUrl
          ? 'Queuing Replicate video (BYOK)…'
          : 'Queuing Replicate video (text only)…'
        : firstFrameUrl
          ? 'Queuing video job…'
          : 'Queuing video (text only — lock a still with an https URL for a start frame)…'
    );
    try {
      const motionPrompt = `Cinematic live-action take, natural camera motion, no titles or watermarks.\n${prompt}`.slice(0, 2400);
      const job = enqueueGenerationJob({
        projectTitle,
        sceneShotId: shotKey,
        shotIndex: index,
        type: 'video',
        prompt: motionPrompt,
        duration: dur,
        firstFrameUrl,
        engine: modelEngine,
        modelId: isReplicate ? videoModelId : isSeedance ? seedanceVideoId : ''
      });
      onSaveVideo(shotKey, { status: 'queued' }, { jobId: job.id });
      setStatus(
        `Job ${job.id.slice(-6)} queued — App renders in background. Safe to close this desk.`
      );
      window.dispatchEvent(
        new CustomEvent('sps_generation_job_kick', { detail: { title: projectTitle } })
      );
    } catch (err) {
      setStatus(err.message || 'Video queue failed');
    }
  };

  const generateStill = async () => {
    if (refuseIfGenerateBlocked()) return;
    if (isReplicate && !replicateReady) {
      setStatus('Add a Replicate key in Settings → API keys (BYOK).');
      return;
    }
    if (isLocalExport) {
      if (refuseIfDirty()) return;
      setGenerating(true);
      setStatus('Exporting prompt…');
      try {
        await navigator.clipboard.writeText(prompt);
        const stem = String(id).replace(/\s+/g, '_');
        const blob = new Blob([prompt], { type: 'text/plain;charset=utf-8' });
        await saveExportBlob(blob, `${stem}_${takeSlot}.txt`, {
          projectTitle,
          shots,
          lifecycleMode: generateLifecycleMode,
          auditLabel: 'generate_local_export',
          auditFormat: 'txt',
          roomId,
          note: `${lifeNote} · ${takeSlot}`
        });
        setStatus('Prompt copied + saved — paste into Flux / Midjourney / your BYOK engine.');
      } catch (err) {
        setStatus(err.message || 'Export failed');
      } finally {
        setGenerating(false);
      }
      return;
    }
    if (!onSaveTake) {
      setStatus('This desk cannot save a take yet.');
      return;
    }
    const shotKey = shot.sceneShotId || `SH_${index + 1}`;
    setStatus('Queuing still job…');
    try {
      const job = enqueueGenerationJob({
        projectTitle,
        sceneShotId: shotKey,
        shotIndex: index,
        type: 'still',
        prompt,
        takeSlot,
        engine: modelEngine,
        modelId: isReplicate ? stillModelId : isSeedance ? seedanceStillId : ''
      });
      setStatus(
        `Job ${job.id.slice(-6)} queued — App renders in background. Safe to close this desk.`
      );
      window.dispatchEvent(
        new CustomEvent('sps_generation_job_kick', { detail: { title: projectTitle } })
      );
    } catch (err) {
      setStatus(err.message || 'Still queue failed');
    }
  };

  return (
    <>
    <div className="sps-overlay" onClick={onClose}>
      <div className="sps-shell sps-shell-md" style={{ height: 'auto', maxHeight: 'min(92dvh, 44rem)', alignSelf: 'center' }} onClick={(e) => e.stopPropagation()}>
        <div className="sps-modal-head">
          <div>
            <h2>Generate</h2>
            <p>AI Cinema Production OS · {id} · {dur}s · {takeSummary.stillCount} still · {takeSummary.videoCount} video take{takeSummary.videoCount === 1 ? '' : 's'}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <StudioProfileControl />
            <button type="button" className="sps-icon-btn" onClick={onClose} title="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="sps-modal-body p-4 space-y-4">
          {creditStatus?.relevant && creditStatus.level !== 'ok' ? (
            <p
              className={`m-0 text-[11px] font-mono px-2 py-1.5 rounded border ${
                creditStatus.level === 'empty'
                  ? 'border-red-500/40 text-red-300 bg-red-950/30'
                  : 'border-amber-500/40 text-amber-200 bg-amber-950/25'
              }`}
            >
              {creditStatus.message}
            </p>
          ) : null}
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="sps-icon-btn"
              disabled={index <= 0}
              onClick={() => {
                setOverride(false);
                setStatus('');
                setActiveShotIndex?.(index - 1);
              }}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <p className="flex-1 text-[13px] truncate" style={{ fontFamily: 'var(--sps-font-display)' }}>{id}</p>
            {onUpdateShot ? (
              <LifecycleControls
                entity={shot}
                compact
                onChange={(next) => onUpdateShot(index, next)}
              />
            ) : null}
            <button
              type="button"
              className="sps-icon-btn"
              disabled={!canGoNext}
              title={index >= shots.length - 1 ? 'Last shot' : 'Save this take’s last frame first'}
              onClick={() => {
                if (!canGoNext) {
                  setStatus('Save this take’s last frame before the next shot.');
                  return;
                }
                setOverride(false);
                setStatus('');
                setActiveShotIndex?.(index + 1);
              }}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <TakeStrip shot={shot} index={index} onUpdateShot={onUpdateShot} lifeLocked={lifeLocked} />

          <div className="sps-tabs sps-tabs-compact" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={deskMode === 'still'}
              title={getDeskModeTab('still')}
              aria-label={getDeskModeTab('still')}
              onClick={() => switchDeskMode('still')}
            >
              Still
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={deskMode === 'video'}
              title={getDeskModeTab('video')}
              aria-label={getDeskModeTab('video')}
              onClick={() => switchDeskMode('video')}
            >
              Video
            </button>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
            <label
              className="text-[10px] uppercase tracking-widest text-[var(--sps-muted)] shrink-0 flex items-center gap-1.5"
              aria-label={
                engineHealth.checking
                  ? 'checking…'
                  : [
                      engineHealth.message ||
                        (engineHealth.ok
                          ? engineOptionTitle('Engine OK')
                          : 'Engine unreachable'),
                      engineHealth.checkedAt
                        ? `Checked ${new Date(engineHealth.checkedAt).toLocaleTimeString()}`
                        : '',
                      'Click to Re-check'
                    ]
                      .filter(Boolean)
                      .join(' · ')
              }
            >
              <button
                type="button"
                className={`w-2 h-2 shrink-0 rounded-full border-0 p-0 cursor-pointer disabled:opacity-40 disabled:cursor-default ${
                  engineHealth.checking
                    ? 'bg-zinc-500 animate-pulse'
                    : engineHealth.ok
                      ? 'bg-emerald-500'
                      : 'bg-red-500'
                } ${engineDotPulse ? 'ring-2 ring-[var(--sps-gold)] ring-offset-1 ring-offset-[var(--sps-bg,#0a0a0a)]' : ''}`}
                disabled={engineHealth.checking || !isOpen}
                title={
                  engineHealth.checking
                    ? 'checking…'
                    : [
                        engineHealth.message ||
                          (engineHealth.ok
                            ? engineOptionTitle('Engine OK')
                            : 'Engine unreachable'),
                        engineHealth.checkedAt
                          ? `Checked ${new Date(engineHealth.checkedAt).toLocaleTimeString()}`
                          : '',
                        'Click to Re-check'
                      ]
                        .filter(Boolean)
                        .join(' · ')
                }
                aria-label={
                  engineHealth.checking
                    ? 'checking…'
                    : [
                        engineHealth.message ||
                          (engineHealth.ok
                            ? engineOptionTitle('Engine OK')
                            : 'Engine unreachable'),
                        engineHealth.checkedAt
                          ? `Checked ${new Date(engineHealth.checkedAt).toLocaleTimeString()}`
                          : '',
                        'Click to Re-check'
                      ]
                        .filter(Boolean)
                        .join(' · ')
                }
                onClick={() => {
                  if (engineHealth.checking || !isOpen) return;
                  engineRecheckToastRef.current = true;
                  setEngineHealthTick((n) => n + 1);
                }}
              />
              <button
                type="button"
                className={`bg-transparent border-0 p-0 m-0 uppercase tracking-widest text-[10px] cursor-pointer disabled:opacity-40 disabled:cursor-default ${
                  engineDotPulse
                    ? 'text-[var(--sps-gold)] animate-pulse'
                    : 'text-[var(--sps-muted)] hover:text-[var(--sps-gold)]'
                }`}
                disabled={engineHealth.checking || !isOpen}
                title={
                  engineHealth.checking
                    ? 'checking…'
                    : engineHealth.checkedAt
                      ? `${engineOptionTitle('Re-check')} · last ${new Date(engineHealth.checkedAt).toLocaleTimeString()}`
                      : engineOptionTitle('Re-check')
                }
                aria-label={
                  engineHealth.checking
                    ? 'checking…'
                    : engineHealth.checkedAt
                      ? `${engineOptionTitle('Re-check')} · last ${new Date(engineHealth.checkedAt).toLocaleTimeString()}`
                      : engineOptionTitle('Re-check')
                }
                onClick={() => {
                  if (engineHealth.checking || !isOpen) return;
                  engineRecheckToastRef.current = true;
                  setEngineHealthTick((n) => n + 1);
                }}
              >
                Engine
              </button>
              {engineHealth.checkedAt && !engineHealth.checking ? (
                <button
                  type="button"
                  className="normal-case tracking-normal font-mono text-[9px] text-[var(--sps-muted)] hover:text-[var(--sps-gold)] bg-transparent border-0 p-0 m-0 cursor-pointer disabled:opacity-40"
                  disabled={!isOpen}
                  title={`${engineOptionTitle('Last health check')} · ${new Date(engineHealth.checkedAt).toLocaleTimeString()} · click to Re-check`}
                  aria-label={`${engineOptionTitle('Last health check')} · ${new Date(engineHealth.checkedAt).toLocaleTimeString()} · click to Re-check`}
                  onClick={() => {
                    if (!isOpen || engineHealth.checking) return;
                    engineRecheckToastRef.current = true;
                    setEngineHealthTick((n) => n + 1);
                  }}
                >
                  {new Date(engineHealth.checkedAt).toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  })}
                </button>
              ) : engineHealth.checking ? (
                <span
                  className="normal-case tracking-normal font-mono text-[9px] text-[var(--sps-muted)]"
                  aria-label="checking…"
                >
                  checking…
                </span>
              ) : null}
              <button
                type="button"
                className="normal-case tracking-normal text-[9px] font-mono uppercase text-[var(--sps-gold)] hover:underline disabled:opacity-40 disabled:no-underline"
                disabled={engineHealth.checking || !isOpen}
                title={
                  engineHealth.checking
                    ? 'checking…'
                    : engineHealth.checkedAt
                      ? `${engineOptionTitle('Re-check')} · last ${new Date(engineHealth.checkedAt).toLocaleTimeString()}`
                      : engineOptionTitle('Re-check')
                }
                aria-label={
                  engineHealth.checking
                    ? 'checking…'
                    : engineHealth.checkedAt
                      ? `${engineOptionTitle('Re-check')} · last ${new Date(engineHealth.checkedAt).toLocaleTimeString()}`
                      : engineOptionTitle('Re-check')
                }
                onClick={() => {
                  engineRecheckToastRef.current = true;
                  setEngineHealthTick((n) => n + 1);
                }}
              >
                {engineHealth.checking ? 'checking…' : 'Re-check'}
              </button>
              {autoCheckPaused ? (
                <button
                  type="button"
                  className="normal-case tracking-normal font-mono text-[9px] text-[var(--sps-gold)] hover:underline"
                  title={`${engineOptionTitle(`${projectPendingCount} queued/running job(s)`)} — click to show Pending in shot history (60s auto health check paused)`}
                  aria-label={`${engineOptionTitle(`${projectPendingCount} queued/running job(s)`)} — click to show Pending in shot history (60s auto health check paused)`}
                  onClick={() => {
                    setJobFilter('pending');
                    setJobFilterPulse('pending');
                    window.setTimeout(() => setJobFilterPulse(''), 3000);
                    setStatus(
                      `Showing pending jobs · auto-check paused (${projectPendingCount} in project)`
                    );
                    // P151 — toast names Pending
                    try {
                      window.dispatchEvent(
                        new CustomEvent('sps_toast', {
                          detail: {
                            message: engineOptionTitle(
                              `Jobs · Pending · ${projectPendingCount} in project`
                            )
                          }
                        })
                      );
                    } catch {
                      /* ignore */
                    }
                  }}
                >
                  auto-check paused
                </button>
              ) : null}
            </label>
            <label
              className="text-[10px] uppercase tracking-widest text-[var(--sps-muted)] shrink-0"
              htmlFor="sps-generate-desk-engine-select"
              title={engineSelectLabelTitle}
              aria-label={engineSelectLabelTitle}
            >
              Generation engine
            </label>
            <select
              id="sps-generate-desk-engine-select"
              value={modelEngine}
              onChange={(e) => {
                const prevLabel =
                  engineOptions.find((a) => a.id === modelEngine)?.label ||
                  modelEngine ||
                  'engine';
                const next = setActiveModelEngine(e.target.value);
                setModelEngine(next);
                const nextLabel =
                  engineOptions.find((a) => a.id === next)?.label || next || 'engine';
                // P175/P185 — toast on engine change with previous → new labels
                try {
                  window.dispatchEvent(
                    new CustomEvent('sps_toast', {
                      detail: {
                        message: `Generation engine · ${prevLabel} → ${nextLabel}`
                      }
                    })
                  );
                } catch {
                  /* ignore */
                }
                // P186 — aria-label reflects prev → new after change
                setEngineAriaTransition(`${prevLabel} → ${nextLabel}`);
                window.setTimeout(() => setEngineAriaTransition(''), 3000);
              }}
              className="text-[11px] font-mono border border-[var(--sps-border)] rounded px-2 py-1 bg-[var(--sps-bg)] min-w-[12rem]"
              title={engineSelectLabelTitle}
              aria-label={engineSelectLabelTitle}
            >
              {engineOptions.map((opt) => {
                const optTitle = engineOptionTitle(opt.label);
                return (
                <option
                  key={opt.id}
                  value={opt.id}
                  title={optTitle}
                  aria-label={optTitle}
                >
                  {opt.label}
                </option>
                );
              })}
            </select>
            {isLocalExport ? (
              <span
                className="text-[10px] text-[var(--sps-muted)] font-mono"
                title={`${engineOptionTitle('Local export')} — exports prompts, no managed credits`}
                aria-label={`${engineOptionTitle('Local export')} — exports prompts, no managed credits`}
              >
                Exports prompts — no managed credits used
              </span>
            ) : null}
            {isReplicate ? (
              <span
                className={`text-[10px] font-mono ${replicateReady ? 'text-emerald-400' : 'text-amber-400'}`}
                title={
                  replicateReady
                    ? engineOptionTitle('BYOK · billed by Replicate')
                    : engineOptionTitle('Add Replicate key in Settings → API keys')
                }
                aria-label={
                  replicateReady
                    ? engineOptionTitle('BYOK · billed by Replicate')
                    : engineOptionTitle('Add Replicate key in Settings → API keys')
                }
              >
                {replicateReady
                  ? 'BYOK · billed by Replicate'
                  : 'Add Replicate key in Settings → API keys'}
              </span>
            ) : null}
            {isSeedance ? (
              <span
                className="text-[10px] text-[var(--sps-muted)] font-mono"
                title={`${engineOptionTitle('Managed generation')} — uses SaaS credits`}
                aria-label={`${engineOptionTitle('Managed generation')} — uses SaaS credits`}
              >
                Managed credits · {engineToastLabel}
              </span>
            ) : null}
            </div>
            {!engineHealth.ok && !engineHealth.checking && engineHealth.message ? (
              <button
                type="button"
                className="text-[10px] font-mono text-red-400/90 m-0 pl-0.5 text-left bg-transparent border-0 p-0 cursor-pointer hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-default"
                role="status"
                disabled={engineHealth.checking || !isOpen}
                aria-label={engineOptionTitle(
                  `${engineHealth.message} · Click or press Enter to Re-check`
                )}
                title={engineOptionTitle(
                  `${engineHealth.message} · Click or press Enter to Re-check`
                )}
                onClick={() => {
                  if (engineHealth.checking || !isOpen) return;
                  engineRecheckToastRef.current = true;
                  setEngineHealthTick((n) => n + 1);
                }}
                onKeyDown={(e) => {
                  // P158 — Enter (and Space) triggers Re-check when focused
                  if (e.key !== 'Enter' && e.key !== ' ') return;
                  e.preventDefault();
                  if (engineHealth.checking || !isOpen) return;
                  engineRecheckToastRef.current = true;
                  setEngineHealthTick((n) => n + 1);
                }}
              >
                {engineHealth.message} · Re-check
              </button>
            ) : null}
          </div>

          {isReplicate || isSeedance ? (
            <div className="flex items-center gap-2 flex-wrap">
              <label
                className="text-[10px] uppercase tracking-widest text-[var(--sps-muted)] shrink-0"
                title={modelSelectLabelTitle}
                aria-label={modelSelectLabelTitle}
              >
                {deskMode === 'video' ? 'Video model' : 'Still model'}
              </label>
              {deskMode === 'still' ? (
                <select
                  value={isReplicate ? stillModelId : seedanceStillId}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (isReplicate) setStillModelId(setReplicateStillModel(val));
                    else setSeedanceStillId(setSeedanceStillModel(val));
                    const models = isReplicate ? REPLICATE_STILL_MODELS : SEEDANCE_STILL_MODELS;
                    const label = models.find((m) => m.id === val)?.label || val;
                    // P184 — model change toast includes selected model label
                    try {
                      window.dispatchEvent(
                        new CustomEvent('sps_toast', {
                          detail: {
                            message: engineOptionTitle(`Still model · ${label}`)
                          }
                        })
                      );
                    } catch {
                      /* ignore */
                    }
                    // P188 — select title matches toast label briefly
                    const hint = engineOptionTitle(`Still model · ${label}`);
                    setStillModelTitleHint(hint);
                    window.setTimeout(() => setStillModelTitleHint(''), 3000);
                  }}
                  className="text-[11px] font-mono border border-[var(--sps-border)] rounded px-2 py-1 bg-[var(--sps-bg)] min-w-[14rem]"
                  title={stillModelSelectLabelTitle}
                  aria-label={stillModelSelectLabelTitle}
                >
                  {(isReplicate ? REPLICATE_STILL_MODELS : SEEDANCE_STILL_MODELS).map((m) => {
                    const modelOptTitle = engineOptionTitle(m.label);
                    return (
                      <option
                        key={m.id}
                        value={m.id}
                        title={modelOptTitle}
                        aria-label={modelOptTitle}
                      >
                        {m.label}
                      </option>
                    );
                  })}
                </select>
              ) : (
                <select
                  value={isReplicate ? videoModelId : seedanceVideoId}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (isReplicate) setVideoModelId(setReplicateVideoModel(val));
                    else setSeedanceVideoId(setSeedanceVideoModel(val));
                    const models = isReplicate ? REPLICATE_VIDEO_MODELS : SEEDANCE_VIDEO_MODELS;
                    const label = models.find((m) => m.id === val)?.label || val;
                    try {
                      window.dispatchEvent(
                        new CustomEvent('sps_toast', {
                          detail: {
                            message: engineOptionTitle(`Video model · ${label}`)
                          }
                        })
                      );
                    } catch {
                      /* ignore */
                    }
                    const hint = engineOptionTitle(`Video model · ${label}`);
                    setVideoModelTitleHint(hint);
                    window.setTimeout(() => setVideoModelTitleHint(''), 3000);
                  }}
                  className="text-[11px] font-mono border border-[var(--sps-border)] rounded px-2 py-1 bg-[var(--sps-bg)] min-w-[14rem]"
                  title={videoModelSelectLabelTitle}
                  aria-label={videoModelSelectLabelTitle}
                >
                  {(isReplicate ? REPLICATE_VIDEO_MODELS : SEEDANCE_VIDEO_MODELS).map((m) => {
                    const modelOptTitle = engineOptionTitle(m.label);
                    return (
                      <option
                        key={m.id}
                        value={m.id}
                        title={modelOptTitle}
                        aria-label={modelOptTitle}
                      >
                        {m.label}
                      </option>
                    );
                  })}
                </select>
              )}
            </div>
          ) : null}

          {lifeLocked ? (
            <p className="text-[11px] text-[var(--sps-gold)]">
              Lifecycle locked — unlock to enqueue new stills or video takes. Existing takes stay.
            </p>
          ) : null}

          {exportBlocked ? (
            <p className="text-[11px] text-[var(--sps-gold)]">{exportLife.message}</p>
          ) : null}

          {pendingJobs.length > 0 ? (
            <p className="text-[11px] text-[var(--sps-gold)]">
              {pendingJobs.length} job{pendingJobs.length === 1 ? '' : 's'} running in background — closes safely; App resumes poll.
            </p>
          ) : null}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-[10px] uppercase tracking-widest text-[var(--sps-muted)] m-0">
                Shot job history
              </p>
              <span className="text-[9px] font-mono text-[var(--sps-muted)]">{jobHistory.length} shown</span>
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
                  } ${jobFilterPulse === opt.id ? 'ring-1 ring-[var(--sps-gold)] animate-pulse' : ''}`}
                  title={
                    opt.id === 'all' && jobFilter === 'all'
                      ? 'Already All — click again to clear status message'
                      : `Filter job history: ${opt.label}`
                  }
                  onClick={() => {
                    // P127 — re-click All clears status message
                    if (opt.id === 'all' && jobFilter === 'all') {
                      setStatus('');
                      setJobFilterPulse('all');
                      window.setTimeout(() => setJobFilterPulse(''), 1500);
                      // P129 — toast when re-click All clears status
                      try {
                        window.dispatchEvent(
                          new CustomEvent('sps_toast', {
                            detail: { message: 'Status message cleared' }
                          })
                        );
                      } catch {
                        /* ignore */
                      }
                      return;
                    }
                    setJobFilter(opt.id);
                    // P130 — pulse job chip on any filter select
                    setJobFilterPulse(opt.id);
                    window.setTimeout(() => setJobFilterPulse(''), 3000);
                    // P131/P132/P152 — toast naming filter + count + engine suffix
                    try {
                      const all = readJobsForTitle(projectTitle).filter(
                        (j) => j.sceneShotId === shotKey
                      );
                      const count = filterGenerationJobsBySource(all, opt.id).length;
                      window.dispatchEvent(
                        new CustomEvent('sps_toast', {
                          detail: {
                            message: engineOptionTitle(`Jobs · ${opt.label} · ${count} shown`)
                          }
                        })
                      );
                    } catch {
                      /* ignore */
                    }
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {jobHistory.length === 0 ? (
              <p className="text-[11px] text-[var(--sps-muted)] m-0">
                No jobs for this shot yet — generate a still or queue video.
              </p>
            ) : (
              <div className="space-y-1 max-h-28 overflow-y-auto">
                {jobHistory.map((j) => (
                  <div
                    key={j.id}
                    className="flex items-center justify-between gap-2 text-[10px] font-mono border border-[var(--sps-border)] rounded px-2 py-1"
                  >
                    <span className="truncate">
                      {j.type}
                      {j.engine ? ` · ${j.engine}` : ''}
                      {j.modelId ? ` · ${j.modelId}` : ''}
                      {j.error ? ` · ${j.error}` : ''}
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      {[JOB_STATUS.QUEUED, JOB_STATUS.RUNNING].includes(j.status) ? (
                        <button
                          type="button"
                          className="text-[9px] uppercase tracking-wide text-[var(--sps-gold)] hover:underline"
                          title="Cancel this in-flight job"
                          onClick={() => {
                            cancelGenerationJob(projectTitle, j.id);
                            setStatus(`Cancelled ${j.type} job`);
                          }}
                        >
                          Cancel
                        </button>
                      ) : null}
                      {[JOB_STATUS.FAILED, JOB_STATUS.CANCELLED].includes(j.status) ? (
                        <button
                          type="button"
                          className="text-[9px] uppercase tracking-wide text-[var(--sps-gold)] hover:underline"
                          title="Retry with the same prompt / engine payload"
                          onClick={() => {
                            if (refuseIfGenerateBlocked()) return;
                            const next = retryGenerationJob(projectTitle, j.id);
                            if (!next) {
                              setStatus('Retry failed — job not re-queued');
                              return;
                            }
                            setStatus(`Retried ${j.type} · ${next.id.slice(-6)}`);
                          }}
                        >
                          Retry
                        </button>
                      ) : null}
                      <span className="text-[var(--sps-muted)]">{j.status}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {clip.url ? (
            <video src={clip.url} controls playsInline className="w-full max-h-48 rounded-[6px] border border-[var(--sps-border)] bg-black" />
          ) : null}

          <div>
            <p className="text-[10px] uppercase tracking-widest text-[var(--sps-muted)] mb-1.5">Image slots for this take</p>
            <div className="flex gap-2 flex-wrap">
              {slots.map((s) => (
                <figure key={`${s.n}-${s.stem}`} className="w-16">
                  {s.url ? (
                    <img src={s.url} alt="" className="w-16 h-16 object-cover rounded-[6px] border border-[var(--sps-border)]" />
                  ) : (
                    <span className="w-16 h-16 flex items-center justify-center border border-dashed border-[var(--sps-border)] text-[9px] text-[var(--sps-muted)]">—</span>
                  )}
                  <figcaption className="text-[9px] text-[var(--sps-muted)] mt-0.5 truncate">
                    {s.n}. {s.role}
                  </figcaption>
                </figure>
              ))}
              {endStill ? (
                <figure className="w-16">
                  <img src={endStill} alt="" className="w-16 h-16 object-cover border border-[var(--sps-gold)]" />
                  <figcaption className="text-[9px] text-[var(--sps-gold)] mt-0.5">Take end</figcaption>
                </figure>
              ) : null}
            </div>
            {blocked.length > 0 && (
              <p className="text-[11px] mt-2" style={{ color: 'var(--sps-gold)' }}>
                Block · {blocked.map((f) => f.label).join(' · ')}
              </p>
            )}
            {warns.length > 0 && (
              <p className="text-[11px] text-[var(--sps-muted)] mt-1">
                Warn · {warns.map((f) => f.label).join(' · ')}
              </p>
            )}
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-widest text-[var(--sps-muted)] mb-1.5">Prompt</p>
            <pre className="text-[11px] leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto border border-[var(--sps-border)] p-3 bg-[var(--sps-surface)]">
              {prompt}
            </pre>
          </div>

          {blocked.length > 0 && (
            <label className="flex items-start gap-2 text-[11px] text-[var(--sps-muted)] cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={override}
                onChange={(e) => {
                  setOverride(e.target.checked);
                  setStatus('');
                }}
              />
              <span>Override — copy / job pack anyway (continuity still broken)</span>
            </label>
          )}

          <div className="flex flex-wrap gap-2">
            {deskMode === 'still' ? (
            <button
              type="button"
              className="sps-btn sps-btn-primary text-xs"
              disabled={generateBlocked || generating || (isReplicate && !replicateReady)}
              onClick={generateStill}
            >
              {generating
                ? isLocalExport
                  ? 'Exporting…'
                  : 'Generating…'
                : isLocalExport
                  ? 'Export prompt'
                  : 'Generate still'}
            </button>
            ) : (
            <button
              type="button"
              className="sps-btn sps-btn-primary text-xs"
              disabled={generateBlocked || videoJobBusy || (isReplicate && !replicateReady)}
              onClick={generateVideo}
            >
              {videoJobBusy
                ? 'Rendering…'
                : isLocalExport
                  ? 'Export job pack'
                  : isReplicate
                    ? 'Generate video (BYOK)'
                    : 'Generate video'}
            </button>
            )}
            <button
              type="button"
              className="sps-btn sps-btn-primary text-xs"
              disabled={dirty}
              onClick={copyPrompt}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy prompt'}
            </button>
            <button type="button" className="sps-btn text-xs disabled:opacity-40" disabled={dirty || exportBlocked} title={exportBlocked ? exportLife.message : 'Save prompt TXT'} onClick={saveTxt}>
              <Download className="w-3.5 h-3.5" />
              Save TXT
            </button>
            <button
              type="button"
              className="sps-btn text-xs disabled:opacity-40"
              disabled={dirty || exportBlocked}
              title={exportBlocked ? exportLife.message : 'Print Generate desk PDF'}
              onClick={savePrintPdf}
            >
              <Download className="w-3.5 h-3.5" />
              Print PDF
            </button>
            <button type="button" className="sps-btn text-xs disabled:opacity-40" disabled={dirty || exportBlocked} title={exportBlocked ? exportLife.message : 'Save job pack ZIP'} onClick={saveJobPack}>
              <Package className="w-3.5 h-3.5" />
              Job pack
            </button>
            <button
              type="button"
              className="sps-btn text-xs"
              title="Build a ComfyUI-SWS workflow for this shot without replacing Generate still/video"
              onClick={() => setComfyOpen(true)}
            >
              <GitBranch className="w-3.5 h-3.5" />
              ComfyUI workflow
            </button>
            <button
              type="button"
              className="sps-btn text-xs disabled:opacity-40"
              disabled={dirty || exportBlocked}
              title={exportBlocked ? exportLife.message : 'Export still job history CSV for this shot'}
              onClick={saveStillJobsCsv}
            >
              <Download className="w-3.5 h-3.5" />
              Still CSV
            </button>
            <button
              type="button"
              className="sps-btn text-xs disabled:opacity-40"
              disabled={dirty || exportBlocked}
              title={exportBlocked ? exportLife.message : 'Export still job history Markdown for this shot'}
              onClick={saveStillJobsMd}
            >
              <Download className="w-3.5 h-3.5" />
              Still MD
            </button>
<button
              type="button"
              className="sps-btn text-xs disabled:opacity-40"
              disabled={dirty || exportBlocked}
              title={exportBlocked ? exportLife.message : 'Export video job history CSV for this shot'}
              onClick={saveVideoJobsCsv}
            >
              <Download className="w-3.5 h-3.5" />
              Video CSV
            </button>
            <button
              type="button"
              className="sps-btn text-xs disabled:opacity-40"
              disabled={dirty || exportBlocked}
              title={exportBlocked ? exportLife.message : 'Export video job history Markdown for this shot'}
              onClick={saveVideoJobsMd}
            >
              <Download className="w-3.5 h-3.5" />
              Video MD
            </button>
            <button
              type="button"
              className="sps-btn text-xs disabled:opacity-40"
              disabled={dirty || exportBlocked}
              title={exportBlocked ? exportLife.message : 'Export Export job history CSV for the active model engine'}
              onClick={saveEngineJobsCsv}
            >
              <Download className="w-3.5 h-3.5" />
              Engine CSV
            </button>
            <button
              type="button"
              className="sps-btn text-xs disabled:opacity-40"
              disabled={dirty || exportBlocked}
              title={exportBlocked ? exportLife.message : 'Export Export job history Markdown for the active model engine'}
              onClick={saveEngineJobsMd}
            >
              <Download className="w-3.5 h-3.5" />
              Engine MD
            </button>
            <button
              type="button"
              className="sps-btn text-xs disabled:opacity-40"
              disabled={dirty || exportBlocked}
              title={exportBlocked ? exportLife.message : 'Export failed job history CSV for this shot'}
              onClick={saveFailedJobsCsv}
            >
              <Download className="w-3.5 h-3.5" />
              Failed CSV
            </button>
            <button
              type="button"
              className="sps-btn text-xs disabled:opacity-40"
              disabled={dirty || exportBlocked}
              title={exportBlocked ? exportLife.message : 'Export failed job history Markdown for this shot'}
              onClick={saveFailedJobsMd}
            >
              <Download className="w-3.5 h-3.5" />
              Failed MD
            </button>
            <button
              type="button"
              className="sps-btn text-xs disabled:opacity-40"
              disabled={dirty || exportBlocked}
              title={exportBlocked ? exportLife.message : 'Export pending job history CSV for this shot'}
              onClick={savePendingJobsCsv}
            >
              <Download className="w-3.5 h-3.5" />
              Pending CSV
            </button>
            <button
              type="button"
              className="sps-btn text-xs disabled:opacity-40"
              disabled={dirty || exportBlocked}
              title={exportBlocked ? exportLife.message : 'Export pending job history Markdown for this shot'}
              onClick={savePendingJobsMd}
            >
              <Download className="w-3.5 h-3.5" />
              Pending MD
            </button>
            <button
              type="button"
              className="sps-btn text-xs disabled:opacity-40"
              disabled={dirty || exportBlocked}
              title={exportBlocked ? exportLife.message : 'Export cancelled job history CSV for this shot'}
              onClick={saveCancelledJobsCsv}
            >
              <Download className="w-3.5 h-3.5" />
              Cancelled CSV
            </button>
            <button
              type="button"
              className="sps-btn text-xs disabled:opacity-40"
              disabled={dirty || exportBlocked}
              title={exportBlocked ? exportLife.message : 'Export cancelled job history Markdown for this shot'}
              onClick={saveCancelledJobsMd}
            >
              <Download className="w-3.5 h-3.5" />
              Cancelled MD
            </button>
            <button
              type="button"
              className="sps-btn text-xs disabled:opacity-40"
              disabled={dirty || exportBlocked}
              title={exportBlocked ? exportLife.message : 'Export succeeded job history CSV for this shot'}
              onClick={saveSucceededJobsCsv}
            >
              <Download className="w-3.5 h-3.5" />
              Succeeded CSV
            </button>
            <button
              type="button"
              className="sps-btn text-xs disabled:opacity-40"
              disabled={dirty || exportBlocked}
              title={exportBlocked ? exportLife.message : 'Export succeeded job history Markdown for this shot'}
              onClick={saveSucceededJobsMd}
            >
              <Download className="w-3.5 h-3.5" />
              Succeeded MD
            </button>
            <button
              type="button"
              className="sps-btn text-xs disabled:opacity-40"
              disabled={dirty || exportBlocked}
              title={exportBlocked ? exportLife.message : `Export job history CSV for filter “${jobFilter}”`}
              onClick={saveFilteredJobsCsv}
            >
              <Download className="w-3.5 h-3.5" />
              Jobs CSV
            </button>
            <button
              type="button"
              className="sps-btn text-xs disabled:opacity-40"
              disabled={dirty || exportBlocked}
              title={exportBlocked ? exportLife.message : `Export job history Markdown for filter “${jobFilter}”`}
              onClick={saveFilteredJobsMd}
            >
              <Download className="w-3.5 h-3.5" />
              Jobs MD
            </button>
          </div>

<div className="border-t border-[var(--sps-border)] pt-3 space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-[var(--sps-muted)]">
              {deskMode === 'video' ? 'Lock stills for continuity (start / last frame)' : 'After you generate in the video model'}
            </p>
            <div className="sps-tabs sps-tabs-compact" role="tablist">
              <button type="button" role="tab" aria-selected={takeSlot === 'first_frame'} onClick={() => setTakeSlot('first_frame')}>Start still</button>
              <button type="button" role="tab" aria-selected={takeSlot === 'last_frame'} onClick={() => setTakeSlot('last_frame')}>End still</button>
            </div>
            <div
              className="border border-dashed border-[var(--sps-border)] p-3 space-y-2"
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer?.files?.[0];
                if (file && file.type.startsWith('image/')) saveTakeFile(file);
              }}
              onPaste={(e) => {
                const item = [...(e.clipboardData?.items || [])].find((it) => it.type.startsWith('image/'));
                const file = item?.getAsFile();
                if (file) saveTakeFile(file);
              }}
            >
            <label className="sps-btn sps-btn-primary text-xs cursor-pointer inline-flex">
              Save take
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) saveTakeFile(file);
                  e.target.value = '';
                }}
              />
            </label>
            <p className="text-[11px] text-[var(--sps-muted)]">Drop, paste, or choose a still. Last frame unlocks the next shot.</p>
            </div>
            {status ? (
              <p className="text-[11px] text-[var(--sps-muted)] flex flex-wrap items-center gap-2">
                {failStreakHint >= 3 ? (
                  <button
                    type="button"
                    className="text-left text-[11px] text-[var(--sps-muted)] hover:text-[var(--sps-gold)] hover:underline cursor-pointer bg-transparent border-0 p-0 m-0"
                    title="Show failed jobs in shot history"
                    onClick={() => {
                      const streak = failStreakHint;
                      setJobFilter('failed');
                      setJobFilterPulse('failed');
                      window.setTimeout(() => setJobFilterPulse(''), 3000);
                      setFailStreakHint(0);
                      setStatus(`Showing failed jobs (${streak} streak)`);
                      // P149 — toast names Failed
                      try {
                        window.dispatchEvent(
                          new CustomEvent('sps_toast', {
                            detail: {
                              message: engineOptionTitle(`Jobs · Failed · ${streak} streak`)
                            }
                          })
                        );
                      } catch {
                        /* ignore */
                      }
                    }}
                  >
                    {status}
                  </button>
                ) : (
                  <span>{status}</span>
                )}
                {failStreakHint >= 3 ? (
                  <button
                    type="button"
                    className="text-[10px] font-mono uppercase text-[var(--sps-gold)] hover:underline"
                    title="Show failed jobs in shot history"
                    onClick={() => {
                      const streak = failStreakHint;
                      setJobFilter('failed');
                      setJobFilterPulse('failed');
                      window.setTimeout(() => setJobFilterPulse(''), 3000);
                      setFailStreakHint(0);
                      setStatus(`Showing failed jobs (${streak} streak)`);
                      try {
                        window.dispatchEvent(
                          new CustomEvent('sps_toast', {
                            detail: {
                              message: engineOptionTitle(`Jobs · Failed · ${streak} streak`)
                            }
                          })
                        );
                      } catch {
                        /* ignore */
                      }
                    }}
                  >
                    View failed
                  </button>
                ) : null}
              </p>
            ) : null}
          </div>

          <div className="flex gap-2 text-[10px] uppercase tracking-widest">
            <button type="button" className="sps-btn text-[10px]" onClick={() => { onClose?.(); onOpenReel?.(); }}>Reel</button>
            <button type="button" className="sps-btn text-[10px]" onClick={() => { onClose?.(); onOpenCompiler?.(); }}>All shots</button>
            {typeof onOpenStage === 'function' && (
              <button type="button" className="sps-btn text-[10px]" onClick={() => { onClose?.(); onOpenStage?.(); }}>Stage</button>
            )}
          </div>
        </div>
      </div>
    </div>
    <SwsComfyWorkflowModal
      isOpen={comfyOpen}
      onClose={() => setComfyOpen(false)}
      shot={shot}
      shotIndex={index}
      shots={shots}
      projectTitle={projectTitle}
      deskMode={deskMode}
      onUpdateShot={onUpdateShot}
    />
    </>
  );
}
