/**
 * P0e — Durable generation job queue per project title.
 * Jobs survive modal close; App resumes polling on load.
 */

import { isUsableProjectTitle, normalizeProjectTitle } from './activeProjectGate';
import { safeLocalStorageSetItem } from './safeStorage';
import { adapterGenerateStill, adapterCreateVideo, adapterPollVideo } from '../services/modelAdapters';
import { appendCreativeAudit } from './creativeAuditLog';

export const JOB_STATUS = {
  QUEUED: 'queued',
  RUNNING: 'running',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

export const ACTIVE_GENERATION_JOBS_KEY = 'sps_active_generation_jobs';

function slugProjectTitle(title) {
  const s = String(title || 'untitled')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return s || 'untitled';
}

function nowIso() {
  return new Date().toISOString();
}

function jobKeyForTitle(title) {
  return `sps_generation_jobs::${slugProjectTitle(title)}`;
}

function newJobId() {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function readJobsForTitle(title) {
  if (typeof window === 'undefined') return [];
  const t = normalizeProjectTitle(title);
  if (!t) return [];
  try {
    const raw = localStorage.getItem(jobKeyForTitle(t));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function readActiveJobs() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ACTIVE_GENERATION_JOBS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistJobs(title, jobs) {
  const t = normalizeProjectTitle(title);
  if (!isUsableProjectTitle(t)) return jobs;
  try {
    safeLocalStorageSetItem(jobKeyForTitle(t), JSON.stringify(jobs));
    window.dispatchEvent(new CustomEvent('sps_generation_job_updated', { detail: { title: t } }));
  } catch {
    /* ignore */
  }
  return jobs;
}

function titlesMatch(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

export function enqueueGenerationJob({
  projectTitle = '',
  sceneShotId = '',
  shotIndex = 0,
  type = 'still',
  prompt = '',
  takeSlot = 'last_frame',
  duration = 5,
  firstFrameUrl = '',
  engine = '',
  modelId = ''
} = {}) {
  const job = {
    id: newJobId(),
    projectTitle: normalizeProjectTitle(projectTitle),
    sceneShotId,
    shotIndex,
    type,
    status: JOB_STATUS.QUEUED,
    prompt,
    takeSlot,
    duration,
    firstFrameUrl,
    engine: String(engine || '').trim(),
    modelId: String(modelId || '').trim(),
    taskId: '',
    url: '',
    resultTakeId: '',
    error: '',
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  const jobs = readJobsForTitle(job.projectTitle);
  persistJobs(job.projectTitle, [job, ...jobs].slice(0, 200));
  appendCreativeAudit({
    projectTitle: job.projectTitle,
    category: 'generate',
    action: 'job_queued',
    targetType: 'shot',
    targetId: sceneShotId || job.id,
    targetLabel: sceneShotId || job.id,
    note: `${type}${takeSlot ? ` · ${takeSlot}` : ''}`
  });
  return job;
}

export function updateGenerationJob(projectTitle, jobId, patch = {}) {
  const t = normalizeProjectTitle(projectTitle);
  const prev = readJobsForTitle(t).find((j) => j.id === jobId);
  const jobs = readJobsForTitle(t).map((j) =>
    j.id === jobId ? { ...j, ...patch, updatedAt: nowIso() } : j
  );
  persistJobs(t, jobs);
  const hit = jobs.find((j) => j.id === jobId) || null;
  if (hit && patch.status && patch.status !== prev?.status) {
    if (patch.status === JOB_STATUS.SUCCEEDED) {
      appendCreativeAudit({
        projectTitle: t,
        category: 'generate',
        action: 'job_succeeded',
        targetType: 'shot',
        targetId: hit.sceneShotId || hit.id,
        targetLabel: hit.sceneShotId || hit.id,
        note: hit.type
      });
    } else if (patch.status === JOB_STATUS.FAILED) {
      appendCreativeAudit({
        projectTitle: t,
        category: 'generate',
        action: 'job_failed',
        targetType: 'shot',
        targetId: hit.sceneShotId || hit.id,
        targetLabel: hit.sceneShotId || hit.id,
        note: patch.error || hit.error || hit.type
      });
    } else if (patch.status === JOB_STATUS.CANCELLED) {
      appendCreativeAudit({
        projectTitle: t,
        category: 'generate',
        action: 'job_cancelled',
        targetType: 'shot',
        targetId: hit.sceneShotId || hit.id,
        targetLabel: hit.sceneShotId || hit.id,
        note: patch.error || hit.type
      });
    }
  }
  return hit;
}

export function getJob(projectTitle, jobId) {
  return readJobsForTitle(projectTitle).find((j) => j.id === jobId) || null;
}

export function getPendingJobs(projectTitle) {
  return readJobsForTitle(projectTitle).filter((j) =>
    [JOB_STATUS.QUEUED, JOB_STATUS.RUNNING].includes(j.status)
  );
}

const runningTasks = new Set();
/** P111 — in-flight cancel: AbortControllers + id set so runners stop before SUCCEEDED. */
const cancelledJobIds = new Set();
const jobAbortControllers = new Map();

function isAbortError(err) {
  return (
    err?.name === 'AbortError' ||
    /aborted|abort/i.test(String(err?.message || ''))
  );
}

export function isGenerationJobCancelled(jobId) {
  if (!jobId) return false;
  if (cancelledJobIds.has(jobId)) return true;
  return false;
}

function armJobAbort(jobId) {
  const existing = jobAbortControllers.get(jobId);
  if (existing) return existing;
  const ac = new AbortController();
  jobAbortControllers.set(jobId, ac);
  return ac;
}

function clearJobAbort(jobId) {
  jobAbortControllers.delete(jobId);
}

function jobStillCancellable(projectTitle, jobId) {
  if (cancelledJobIds.has(jobId)) return true;
  const live = getJob(projectTitle, jobId);
  return live?.status === JOB_STATUS.CANCELLED;
}

/** P111 — cancel queued/running job from Generate desk queue row. */
export function cancelGenerationJob(projectTitle, jobId) {
  const job = getJob(projectTitle, jobId);
  if (!job) return null;
  if (![JOB_STATUS.QUEUED, JOB_STATUS.RUNNING].includes(job.status)) return job;
  cancelledJobIds.add(jobId);
  try {
    jobAbortControllers.get(jobId)?.abort();
  } catch {
    /* ignore */
  }
  clearJobAbort(jobId);
  return updateGenerationJob(projectTitle, jobId, {
    status: JOB_STATUS.CANCELLED,
    error: 'Cancelled by user'
  });
}

/** P112 — re-enqueue a failed/cancelled job with the same payload. */
export function retryGenerationJob(projectTitle, jobId) {
  const job = getJob(projectTitle, jobId);
  if (!job) return null;
  if (![JOB_STATUS.FAILED, JOB_STATUS.CANCELLED].includes(job.status)) return null;
  const next = enqueueGenerationJob({
    projectTitle: job.projectTitle || projectTitle,
    sceneShotId: job.sceneShotId || '',
    shotIndex: job.shotIndex || 0,
    type: job.type === 'video' ? 'video' : 'still',
    prompt: job.prompt || '',
    takeSlot: job.takeSlot || 'last_frame',
    duration: job.duration || 5,
    firstFrameUrl: job.firstFrameUrl || '',
    engine: job.engine || '',
    modelId: job.modelId || ''
  });
  appendCreativeAudit({
    projectTitle: next.projectTitle,
    category: 'generate',
    action: 'job_retried',
    targetType: 'shot',
    targetId: next.sceneShotId || next.id,
    targetLabel: next.sceneShotId || next.id,
    note: `from ${job.id} · ${job.status}`
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('sps_generation_job_kick', { detail: { title: next.projectTitle } })
    );
  }
  return next;
}

export async function runStillJob(job, { onComplete, onError } = {}) {
  if (!job || job.type !== 'still') return null;
  if (runningTasks.has(job.id)) return null;
  if (jobStillCancellable(job.projectTitle, job.id)) return getJob(job.projectTitle, job.id);
  runningTasks.add(job.id);
  const ac = armJobAbort(job.id);
  updateGenerationJob(job.projectTitle, job.id, { status: JOB_STATUS.RUNNING });
  try {
    if (jobStillCancellable(job.projectTitle, job.id)) return getJob(job.projectTitle, job.id);
    const data = await adapterGenerateStill({
      prompt: job.prompt,
      engine: job.engine,
      modelId: job.modelId,
      signal: ac.signal
    });
    if (jobStillCancellable(job.projectTitle, job.id)) return getJob(job.projectTitle, job.id);
    if (data.exportOnly) {
      const done = updateGenerationJob(job.projectTitle, job.id, {
        status: JOB_STATUS.SUCCEEDED,
        url: '',
        exportPrompt: data.prompt || job.prompt,
        engine: data.engine || ''
      });
      onComplete?.(done, '');
      return done;
    }
    const done = updateGenerationJob(job.projectTitle, job.id, {
      status: JOB_STATUS.SUCCEEDED,
      url: data.url || '',
      engine: data.engine || ''
    });
    onComplete?.(done, data.url);
    return done;
  } catch (err) {
    if (jobStillCancellable(job.projectTitle, job.id) || isAbortError(err)) {
      return getJob(job.projectTitle, job.id);
    }
    updateGenerationJob(job.projectTitle, job.id, {
      status: JOB_STATUS.FAILED,
      error: err?.message || 'Still generate failed'
    });
    onError?.(job, err);
    return null;
  } finally {
    clearJobAbort(job.id);
    cancelledJobIds.delete(job.id);
    runningTasks.delete(job.id);
  }
}

export async function pollVideoJob(job, { onProgress, onComplete, onError, maxMs = 6 * 60 * 1000 } = {}) {
  if (!job || job.type !== 'video' || !job.taskId) return null;
  if (runningTasks.has(`poll:${job.id}`)) return null;
  if (jobStillCancellable(job.projectTitle, job.id)) return getJob(job.projectTitle, job.id);
  runningTasks.add(`poll:${job.id}`);
  const ac = armJobAbort(job.id);
  updateGenerationJob(job.projectTitle, job.id, { status: JOB_STATUS.RUNNING });

  const startedAt = Date.now();
  const tick = async () => {
    if (jobStillCancellable(job.projectTitle, job.id)) {
      runningTasks.delete(`poll:${job.id}`);
      clearJobAbort(job.id);
      cancelledJobIds.delete(job.id);
      return getJob(job.projectTitle, job.id);
    }
    if (Date.now() - startedAt > maxMs) {
      updateGenerationJob(job.projectTitle, job.id, {
        status: JOB_STATUS.RUNNING,
        error: 'Poll window elapsed — will retry on next resume'
      });
      runningTasks.delete(`poll:${job.id}`);
      return null;
    }
    try {
      const polled = await adapterPollVideo({
        taskId: job.taskId,
        engine: job.engine,
        signal: ac.signal
      });
      if (jobStillCancellable(job.projectTitle, job.id)) {
        runningTasks.delete(`poll:${job.id}`);
        clearJobAbort(job.id);
        cancelledJobIds.delete(job.id);
        return getJob(job.projectTitle, job.id);
      }
      if (polled.url) {
        const done = updateGenerationJob(job.projectTitle, job.id, {
          status: JOB_STATUS.SUCCEEDED,
          url: polled.url,
          engine: polled.engine || ''
        });
        runningTasks.delete(`poll:${job.id}`);
        onComplete?.(done, polled.url);
        return done;
      }
      const st = String(polled.status || '').toLowerCase();
      onProgress?.(job, st);
      if (st === 'failed' || st === 'cancelled' || st === 'canceled') {
        updateGenerationJob(job.projectTitle, job.id, { status: JOB_STATUS.FAILED, error: st });
        runningTasks.delete(`poll:${job.id}`);
        onError?.(job, new Error(st));
        return null;
      }
      await new Promise((r) => setTimeout(r, 4000));
      return tick();
    } catch (err) {
      if (jobStillCancellable(job.projectTitle, job.id) || isAbortError(err)) {
        runningTasks.delete(`poll:${job.id}`);
        clearJobAbort(job.id);
        cancelledJobIds.delete(job.id);
        return getJob(job.projectTitle, job.id);
      }
      updateGenerationJob(job.projectTitle, job.id, {
        status: JOB_STATUS.FAILED,
        error: err?.message || 'Video poll failed'
      });
      runningTasks.delete(`poll:${job.id}`);
      onError?.(job, err);
      return null;
    }
  };

  // Fire-and-continue: do not block the caller on the full poll window.
  const run = tick();
  return run;
}

/** One poll attempt only — used by App resume interval so UI never waits on a while-loop. */
export async function pollVideoJobOnce(job, { onProgress, onComplete, onError } = {}) {
  if (!job || job.type !== 'video' || !job.taskId) return null;
  if (runningTasks.has(`poll:${job.id}`)) return null;
  if (jobStillCancellable(job.projectTitle, job.id)) return getJob(job.projectTitle, job.id);
  runningTasks.add(`poll:${job.id}`);
  const ac = armJobAbort(job.id);
  try {
    updateGenerationJob(job.projectTitle, job.id, { status: JOB_STATUS.RUNNING });
    const polled = await adapterPollVideo({
      taskId: job.taskId,
      engine: job.engine,
      signal: ac.signal
    });
    if (jobStillCancellable(job.projectTitle, job.id)) return getJob(job.projectTitle, job.id);
    if (polled.url) {
      const done = updateGenerationJob(job.projectTitle, job.id, {
        status: JOB_STATUS.SUCCEEDED,
        url: polled.url,
        engine: polled.engine || ''
      });
      onComplete?.(done, polled.url);
      return done;
    }
    const st = String(polled.status || '').toLowerCase();
    onProgress?.(job, st);
    if (st === 'failed' || st === 'cancelled' || st === 'canceled') {
      updateGenerationJob(job.projectTitle, job.id, { status: JOB_STATUS.FAILED, error: st });
      onError?.(job, new Error(st));
      return null;
    }
    return updateGenerationJob(job.projectTitle, job.id, { status: JOB_STATUS.RUNNING });
  } catch (err) {
    if (jobStillCancellable(job.projectTitle, job.id) || isAbortError(err)) {
      return getJob(job.projectTitle, job.id);
    }
    updateGenerationJob(job.projectTitle, job.id, {
      status: JOB_STATUS.FAILED,
      error: err?.message || 'Video poll failed'
    });
    onError?.(job, err);
    return null;
  } finally {
    clearJobAbort(job.id);
    cancelledJobIds.delete(job.id);
    runningTasks.delete(`poll:${job.id}`);
  }
}

export async function startVideoJob(job, { onProgress, onComplete, onError, onTaskCreated, awaitPoll = false } = {}) {
  if (!job || job.type !== 'video') return null;
  if (runningTasks.has(job.id)) return null;
  if (jobStillCancellable(job.projectTitle, job.id)) return getJob(job.projectTitle, job.id);
  runningTasks.add(job.id);
  const ac = armJobAbort(job.id);
  updateGenerationJob(job.projectTitle, job.id, { status: JOB_STATUS.RUNNING });
  try {
    const motionPrompt = String(job.prompt || '').slice(0, 2400);
    const created = await adapterCreateVideo({
      prompt: motionPrompt,
      firstFrameUrl: job.firstFrameUrl || '',
      duration: job.duration || 5,
      engine: job.engine,
      modelId: job.modelId,
      signal: ac.signal
    });
    if (jobStillCancellable(job.projectTitle, job.id)) return getJob(job.projectTitle, job.id);
    const withTask = updateGenerationJob(job.projectTitle, job.id, {
      taskId: created.taskId,
      status: JOB_STATUS.RUNNING,
      engine: created.engine || job.engine || ''
    });
    onTaskCreated?.(withTask);
    runningTasks.delete(job.id);
    if (awaitPoll) {
      return pollVideoJob(withTask, { onProgress, onComplete, onError });
    }
    // Non-blocking: App resume interval continues polling via pollVideoJobOnce.
    pollVideoJob(withTask, { onProgress, onComplete, onError }).catch(() => {});
    return withTask;
  } catch (err) {
    if (jobStillCancellable(job.projectTitle, job.id) || isAbortError(err)) {
      return getJob(job.projectTitle, job.id);
    }
    updateGenerationJob(job.projectTitle, job.id, {
      status: JOB_STATUS.FAILED,
      error: err?.message || 'Video create failed'
    });
    onError?.(job, err);
    return null;
  } finally {
    clearJobAbort(job.id);
    cancelledJobIds.delete(job.id);
    runningTasks.delete(job.id);
  }
}
export async function resumePendingGenerationJobs(projectTitle, handlers = {}) {
  const t = normalizeProjectTitle(projectTitle);
  if (!isUsableProjectTitle(t)) return;
  const pending = getPendingJobs(t);
  for (const job of pending) {
    if (job.type === 'still' && job.status === JOB_STATUS.QUEUED) {
      // Don't await chain — allow parallel stills; each guards via runningTasks.
      runStillJob(job, handlers).catch(() => {});
    } else if (job.type === 'video') {
      if (job.taskId && (job.status === JOB_STATUS.RUNNING || job.status === JOB_STATUS.QUEUED)) {
        await pollVideoJobOnce(job, handlers);
      } else if (job.status === JOB_STATUS.QUEUED) {
        startVideoJob(job, { ...handlers, awaitPoll: false }).catch(() => {});
      }
    }
  }
}

export function applyOpenGenerationJobs(project) {
  if (typeof window === 'undefined' || !project) return;
  const title = normalizeProjectTitle(project.title);
  const jobs = readJobsForTitle(title);
  if (!jobs.length) return;
  try {
    safeLocalStorageSetItem(ACTIVE_GENERATION_JOBS_KEY, JSON.stringify(jobs));
  } catch {
    /* ignore */
  }
}

export function parkGenerationJobsForTitle(title) {
  const t = normalizeProjectTitle(title);
  if (!isUsableProjectTitle(t)) return;
  const jobs = readJobsForTitle(t);
  persistJobs(t, jobs);
}

/** Admin / dashboard rollup across all persisted project job queues. */
export function summarizeAllGenerationJobs({ limit = 16 } = {}) {
  if (typeof window === 'undefined') {
    return { total: 0, pending: 0, failed: 0, succeeded: 0, recent: [] };
  }
  const all = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key?.startsWith('sps_generation_jobs::')) continue;
      const parsed = JSON.parse(localStorage.getItem(key) || '[]');
      if (Array.isArray(parsed)) all.push(...parsed);
    }
  } catch {
    /* ignore */
  }
  all.sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
  const counts = { total: 0, pending: 0, failed: 0, succeeded: 0 };
  all.forEach((j) => {
    counts.total += 1;
    const st = String(j?.status || '').toLowerCase();
    if (st === JOB_STATUS.FAILED) counts.failed += 1;
    else if (st === JOB_STATUS.SUCCEEDED) counts.succeeded += 1;
    else if ([JOB_STATUS.QUEUED, JOB_STATUS.RUNNING].includes(st)) counts.pending += 1;
  });
  return { ...counts, recent: all.slice(0, limit) };
}

export const GENERATION_JOB_FILTER_ALL = 'all';

export const GENERATION_JOB_FILTER_OPTIONS = Object.freeze([
  { id: GENERATION_JOB_FILTER_ALL, label: 'All' },
  { id: 'still', label: 'Still' },
  { id: 'video', label: 'Video' },
  { id: 'pending', label: 'Pending' },
  { id: 'failed', label: 'Failed' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'succeeded', label: 'Succeeded' },
  { id: 'replicate', label: 'Replicate' },
  { id: 'seedance', label: 'Seedance' },
  { id: 'local', label: 'Local pack' }
]);

/** Filter generation jobs by type / status / engine chip. */
export function filterGenerationJobsBySource(jobs = [], filter = GENERATION_JOB_FILTER_ALL) {
  const list = Array.isArray(jobs) ? jobs : [];
  const f = String(filter || GENERATION_JOB_FILTER_ALL).toLowerCase();
  if (!f || f === GENERATION_JOB_FILTER_ALL) return list;
  if (f === 'still') return list.filter((j) => j.type === 'still');
  if (f === 'video') return list.filter((j) => j.type === 'video');
  if (f === 'pending') {
    return list.filter((j) => [JOB_STATUS.QUEUED, JOB_STATUS.RUNNING].includes(j.status));
  }
  if (f === 'failed') return list.filter((j) => j.status === JOB_STATUS.FAILED);
  if (f === 'cancelled') return list.filter((j) => j.status === JOB_STATUS.CANCELLED);
  if (f === 'succeeded') return list.filter((j) => j.status === JOB_STATUS.SUCCEEDED);
  if (f === 'replicate') {
    return list.filter((j) => String(j.engine || '').toLowerCase().includes('replicate'));
  }
  if (f === 'seedance') {
    return list.filter((j) => {
      const e = String(j.engine || '').toLowerCase();
      return e.includes('seedance') || e.includes('byteplus');
    });
  }
  if (f === 'local') {
    return list.filter((j) => String(j.engine || '').toLowerCase().includes('local'));
  }
  return list.filter((j) => String(j.type || j.status || '').toLowerCase() === f);
}

function csvEscape(v) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

/** Craft CSV for generation job history (still/video queue audit). */
export function generationJobsToCsv(jobs = [], { projectTitle = '', filter = 'all' } = {}) {
  const headers = [
    '#',
    'Id',
    'Type',
    'Status',
    'Engine',
    'Model',
    'SceneShot',
    'Created',
    'Updated',
    'Error',
    'Project',
    'Filter'
  ];
  const list = filterGenerationJobsBySource(jobs, filter);
  const rows = list.map((j, i) =>
    [
      i + 1,
      j?.id || '',
      j?.type || '',
      j?.status || '',
      j?.engine || '',
      j?.modelId || '',
      j?.sceneShotId || '',
      j?.createdAt || '',
      j?.updatedAt || '',
      j?.error || '',
      projectTitle || j?.projectTitle || '',
      filter || 'all'
    ]
      .map(csvEscape)
      .join(',')
  );
  return [headers.map(csvEscape).join(','), ...rows].join('\n');
}

/** Still-only job CSV (Generate desk shortcut). */
export function stillGenerationJobsToCsv(jobs = [], { projectTitle = '' } = {}) {
  return generationJobsToCsv(jobs, { projectTitle, filter: 'still' });
}

/** Video-only job CSV (Generate desk shortcut). */
export function videoGenerationJobsToCsv(jobs = [], { projectTitle = '' } = {}) {
  return generationJobsToCsv(jobs, { projectTitle, filter: 'video' });
}

/** Map active model engine id → generation job history filter chip. */
export function resolveGenerationEngineFilter(engine = '') {
  const e = String(engine || '').toLowerCase();
  if (e.includes('replicate')) return 'replicate';
  if (e.includes('seedance') || e.includes('byteplus')) return 'seedance';
  if (e.includes('local')) return 'local';
  return GENERATION_JOB_FILTER_ALL;
}

/** Engine-scoped job CSV (Generate desk — active engine shortcut). */
export function engineGenerationJobsToCsv(jobs = [], { projectTitle = '', engine = '' } = {}) {
  return generationJobsToCsv(jobs, {
    projectTitle,
    filter: resolveGenerationEngineFilter(engine)
  });
}

/** Failed-only job CSV (Generate desk shortcut). */
export function failedGenerationJobsToCsv(jobs = [], { projectTitle = '' } = {}) {
  return generationJobsToCsv(jobs, { projectTitle, filter: 'failed' });
}

/** Pending-only job CSV (Generate desk shortcut). */
export function pendingGenerationJobsToCsv(jobs = [], { projectTitle = '' } = {}) {
  return generationJobsToCsv(jobs, { projectTitle, filter: 'pending' });
}

/** Cancelled-only job CSV (Generate desk shortcut). */
export function cancelledGenerationJobsToCsv(jobs = [], { projectTitle = '' } = {}) {
  return generationJobsToCsv(jobs, { projectTitle, filter: 'cancelled' });
}

/** Succeeded-only job CSV (Generate desk shortcut). */
export function succeededGenerationJobsToCsv(jobs = [], { projectTitle = '' } = {}) {
  return generationJobsToCsv(jobs, { projectTitle, filter: 'succeeded' });
}

/** Still-only job Markdown (Generate desk shortcut). */

/** Craft Markdown for generation job history (filter-aware). */
export function generationJobsToMarkdown(jobs = [], { projectTitle = '', filter = 'all', roomId = '' } = {}) {
  const title = String(projectTitle || 'Project').trim() || 'Project';
  const f = String(filter || 'all');
  const room = String(roomId || '').trim();
  const list = filterGenerationJobsBySource(jobs, filter);
  const lines = [
    `# Generation jobs — ${title}${f && f !== 'all' ? ` · ${f}` : ''}${room ? ` · room ${room}` : ''}`,
    '',
    `- Project: ${title}`,
    `- Filter: ${f}`,
    `- Room: ${room || '—'}`,
    `- Jobs: ${list.length}`,
    `- Exported: ${new Date().toISOString()}`,
    '',
    '| # | Id | Type | Status | Engine | Model | Shot | Updated | Error |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |'
  ];
  list.forEach((j, i) => {
    const id = String(j?.id || '—').replace(/\|/g, '/');
    const type = String(j?.type || '—').replace(/\|/g, '/');
    const status = String(j?.status || '—').replace(/\|/g, '/');
    const engine = String(j?.engine || '—').replace(/\|/g, '/');
    const model = String(j?.modelId || '—').replace(/\|/g, '/');
    const shot = String(j?.sceneShotId || '—').replace(/\|/g, '/');
    const updated = String(j?.updatedAt || j?.createdAt || '—').replace(/\|/g, '/');
    const err = String(j?.error || '—')
      .replace(/\|/g, '/')
      .replace(/\n/g, ' ');
    lines.push(`| ${i + 1} | ${id} | ${type} | ${status} | ${engine} | ${model} | ${shot} | ${updated} | ${err} |`);
  });
  if (!list.length) {
    lines.push('| — | — | — | — | — | — | — | — | No jobs for this filter. |');
  }
  lines.push('');
  return lines.join('\n');
}

export function stillGenerationJobsToMarkdown(jobs = [], { projectTitle = '', roomId = '' } = {}) {
  return generationJobsToMarkdown(jobs, { projectTitle, filter: 'still', roomId });
}

/** Video-only job Markdown (Generate desk shortcut). */
export function videoGenerationJobsToMarkdown(jobs = [], { projectTitle = '', roomId = '' } = {}) {
  return generationJobsToMarkdown(jobs, { projectTitle, filter: 'video', roomId });
}

/** Failed-only job Markdown (Generate desk shortcut). */
export function failedGenerationJobsToMarkdown(jobs = [], { projectTitle = '', roomId = '' } = {}) {
  return generationJobsToMarkdown(jobs, { projectTitle, filter: 'failed', roomId });
}

/** Pending-only job Markdown (Generate desk shortcut). */
export function pendingGenerationJobsToMarkdown(jobs = [], { projectTitle = '', roomId = '' } = {}) {
  return generationJobsToMarkdown(jobs, { projectTitle, filter: 'pending', roomId });
}

/** Cancelled-only job Markdown (Generate desk shortcut). */
export function cancelledGenerationJobsToMarkdown(jobs = [], { projectTitle = '', roomId = '' } = {}) {
  return generationJobsToMarkdown(jobs, { projectTitle, filter: 'cancelled', roomId });
}

/** Succeeded-only job Markdown (Generate desk shortcut). */
export function succeededGenerationJobsToMarkdown(jobs = [], { projectTitle = '', roomId = '' } = {}) {
  return generationJobsToMarkdown(jobs, { projectTitle, filter: 'succeeded', roomId });
}

/** Engine-scoped job Markdown (Generate desk — active engine shortcut). */
export function engineGenerationJobsToMarkdown(jobs = [], { projectTitle = '', engine = '', roomId = '' } = {}) {
  return generationJobsToMarkdown(jobs, {
    projectTitle,
    filter: resolveGenerationEngineFilter(engine),
    roomId
  });
}




