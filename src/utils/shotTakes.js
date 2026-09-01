/**
 * P0e — Multi-take on shots. New generates append; active take drives continuity + compile.
 * Legacy embeddedImages / embeddedVideo stay synced from the active take.
 */

import { ensureShotSpecMeta } from './shotSpec';

const STILL_SLOTS = ['first_frame', 'last_frame', 'transition'];

export const TAKE_REVIEW_STATUSES = Object.freeze(['draft', 'review', 'approved', 'locked']);

export const TAKE_REVIEW_META = Object.freeze({
  draft: { label: 'Draft', next: 'review' },
  review: { label: 'Review', next: 'approved' },
  approved: { label: 'Approved', next: 'locked' },
  locked: { label: 'Locked', next: null }
});

function normalizeTakeReview(status) {
  const s = String(status || 'draft').toLowerCase();
  return TAKE_REVIEW_STATUSES.includes(s) ? s : 'draft';
}

function nowIso() {
  return new Date().toISOString();
}

function takeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function emptyShotTakes() {
  return {
    stillTakes: [],
    videoTakes: [],
    activeStill: {},
    activeVideoTakeId: ''
  };
}

export function ensureShotTakes(shot) {
  if (!shot || typeof shot !== 'object') return ensureShotSpecMeta(shot);
  let takes = shot.generationTakes;
  if (!takes || typeof takes !== 'object') {
    takes = emptyShotTakes();
    const stillTakes = [];
    const embedded = shot.embeddedImages || {};
    STILL_SLOTS.forEach((slot) => {
      if (embedded[slot]) {
        const id = takeId('TK_ST');
        stillTakes.push({ id, slot, url: embedded[slot], createdAt: nowIso(), status: 'ready', migrated: true, reviewStatus: 'draft' });
        takes.activeStill[slot] = id;
      }
    });
    if (shot.embeddedVideo?.url || shot.embeddedVideo?.taskId) {
      const id = takeId('TK_V');
      takes.videoTakes.push({
        id,
        url: shot.embeddedVideo.url || '',
        taskId: shot.embeddedVideo.taskId || '',
        status: shot.embeddedVideo.status || (shot.embeddedVideo.url ? 'succeeded' : 'queued'),
        createdAt: nowIso(),
        migrated: true,
        reviewStatus: 'draft'
      });
      takes.activeVideoTakeId = id;
    }
    takes.stillTakes = stillTakes;
  }
  return ensureShotSpecMeta({ ...shot, generationTakes: takes });
}

function findStillTake(takes, slot, id) {
  return (takes.stillTakes || []).find((t) => t.id === id && (!slot || t.slot === slot));
}

function findVideoTake(takes, id) {
  return (takes.videoTakes || []).find((t) => t.id === id);
}

export function getActiveStillUrl(shot, slot = 'last_frame') {
  const s = ensureShotTakes(shot);
  const takes = s.generationTakes;
  const activeId = takes.activeStill?.[slot];
  const hit = activeId ? findStillTake(takes, slot, activeId) : null;
  if (hit?.url) return hit.url;
  return s.embeddedImages?.[slot] || '';
}

export function getActiveVideoTake(shot) {
  const s = ensureShotTakes(shot);
  const takes = s.generationTakes;
  const hit = takes.activeVideoTakeId ? findVideoTake(takes, takes.activeVideoTakeId) : null;
  if (hit) return hit;
  if (s.embeddedVideo?.url || s.embeddedVideo?.taskId) {
    return {
      id: takes.activeVideoTakeId || 'legacy',
      url: s.embeddedVideo.url || '',
      taskId: s.embeddedVideo.taskId || '',
      status: s.embeddedVideo.status || ''
    };
  }
  return null;
}

export function syncShotLegacyMedia(shot) {
  const s = ensureShotTakes(shot);
  const takes = s.generationTakes;
  const embeddedImages = { ...(s.embeddedImages || {}) };
  STILL_SLOTS.forEach((slot) => {
    const url = getActiveStillUrl(s, slot);
    if (url) embeddedImages[slot] = url;
  });
  const activeVideo = getActiveVideoTake(s);
  const embeddedVideo = activeVideo
    ? {
        ...(s.embeddedVideo || {}),
        url: activeVideo.url || s.embeddedVideo?.url || '',
        taskId: activeVideo.taskId || s.embeddedVideo?.taskId || '',
        status: activeVideo.status || s.embeddedVideo?.status || ''
      }
    : s.embeddedVideo;
  return { ...s, embeddedImages, embeddedVideo };
}

export function appendStillTake(shot, { slot = 'last_frame', url = '', jobId = '', label = '' } = {}) {
  const s = ensureShotTakes(shot);
  const takes = { ...s.generationTakes, stillTakes: [...(s.generationTakes.stillTakes || [])] };
  const id = takeId('TK_ST');
  takes.stillTakes.push({
    id,
    slot,
    url,
    jobId,
    label,
    createdAt: nowIso(),
    status: url ? 'ready' : 'pending',
    reviewStatus: 'draft'
  });
  takes.activeStill = { ...(takes.activeStill || {}), [slot]: id };
  return syncShotLegacyMedia({ ...s, generationTakes: takes });
}

export function appendVideoTake(
  shot,
  { url = '', taskId = '', jobId = '', status = 'queued', setActive = true } = {}
) {
  const s = ensureShotTakes(shot);
  const takes = { ...s.generationTakes, videoTakes: [...(s.generationTakes.videoTakes || [])] };
  const id = takeId('TK_V');
  takes.videoTakes.push({
    id,
    url,
    taskId,
    jobId,
    status,
    createdAt: nowIso(),
    reviewStatus: 'draft'
  });
  if (setActive) takes.activeVideoTakeId = id;
  return syncShotLegacyMedia({ ...s, generationTakes: takes });
}

export function updateVideoTake(shot, takeIdOrTaskId, patch = {}) {
  const s = ensureShotTakes(shot);
  const takes = {
    ...s.generationTakes,
    videoTakes: (s.generationTakes.videoTakes || []).map((t) => {
      if (t.id === takeIdOrTaskId || (patch.taskId && t.taskId === takeIdOrTaskId)) {
        return { ...t, ...patch };
      }
      return t;
    })
  };
  return syncShotLegacyMedia({ ...s, generationTakes: takes });
}

export function setActiveStillTake(shot, slot, takeId) {
  const s = ensureShotTakes(shot);
  const currentId = s.generationTakes.activeStill?.[slot];
  if (currentId && currentId !== takeId) {
    const cur = findStillTake(s.generationTakes, slot, currentId);
    if (normalizeTakeReview(cur?.reviewStatus) === 'locked') {
      return s; // locked active still cannot be demoted
    }
  }
  const takes = {
    ...s.generationTakes,
    activeStill: { ...(s.generationTakes.activeStill || {}), [slot]: takeId }
  };
  return syncShotLegacyMedia({ ...s, generationTakes: takes });
}

export function setActiveVideoTake(shot, takeId) {
  const s = ensureShotTakes(shot);
  const currentId = s.generationTakes.activeVideoTakeId;
  if (currentId && currentId !== takeId) {
    const cur = findVideoTake(s.generationTakes, currentId);
    if (normalizeTakeReview(cur?.reviewStatus) === 'locked') {
      return s;
    }
  }
  const takes = { ...s.generationTakes, activeVideoTakeId: takeId };
  return syncShotLegacyMedia({ ...s, generationTakes: takes });
}


export function listStillTakes(shot, slot = '') {
  const s = ensureShotTakes(shot);
  const list = s.generationTakes.stillTakes || [];
  if (!slot) return list.slice();
  return list.filter((t) => t.slot === slot);
}

export function listVideoTakes(shot) {
  const s = ensureShotTakes(shot);
  return (s.generationTakes.videoTakes || []).slice();
}

/** True when the active video take already points at this output URL. */
export function isActiveVideoTakeUrl(shot, url = '') {
  const u = String(url || '').trim();
  if (!u) return false;
  const s = ensureShotTakes(shot);
  const id = s.generationTakes.activeVideoTakeId;
  if (!id) return false;
  const hit = (s.generationTakes.videoTakes || []).find((t) => t.id === id);
  return String(hit?.url || '').trim() === u;
}

export function setTakeReviewStatus(shot, { kind = 'still', takeId = '', reviewStatus = 'draft' } = {}) {
  const s = ensureShotTakes(shot);
  const nextStatus = normalizeTakeReview(reviewStatus);
  if (kind === 'video') {
    const takes = {
      ...s.generationTakes,
      videoTakes: (s.generationTakes.videoTakes || []).map((t) =>
        t.id === takeId ? { ...t, reviewStatus: nextStatus, reviewedAt: nowIso() } : t
      )
    };
    return syncShotLegacyMedia({ ...s, generationTakes: takes });
  }
  const takes = {
    ...s.generationTakes,
    stillTakes: (s.generationTakes.stillTakes || []).map((t) =>
      t.id === takeId ? { ...t, reviewStatus: nextStatus, reviewedAt: nowIso() } : t
    )
  };
  return syncShotLegacyMedia({ ...s, generationTakes: takes });
}

export function advanceTakeReview(shot, { kind = 'still', takeId = '' } = {}) {
  const s = ensureShotTakes(shot);
  const list = kind === 'video' ? s.generationTakes.videoTakes || [] : s.generationTakes.stillTakes || [];
  const hit = list.find((t) => t.id === takeId);
  if (!hit) return s;
  const cur = normalizeTakeReview(hit.reviewStatus);
  const next = TAKE_REVIEW_META[cur]?.next;
  if (!next) return s;
  return setTakeReviewStatus(s, { kind, takeId, reviewStatus: next });
}

export function shotTakeSummary(shot) {
  const s = ensureShotTakes(shot);
  const takes = s.generationTakes;
  const stills = takes.stillTakes || [];
  const videos = takes.videoTakes || [];
  const reviewCounts = { draft: 0, review: 0, approved: 0, locked: 0 };
  [...stills, ...videos].forEach((t) => {
    const r = normalizeTakeReview(t.reviewStatus);
    reviewCounts[r] = (reviewCounts[r] || 0) + 1;
  });
  return {
    stillCount: stills.length,
    videoCount: videos.length,
    activeVideo: getActiveVideoTake(s),
    hasLastFrame: Boolean(getActiveStillUrl(s, 'last_frame')),
    activeStillIds: { ...(takes.activeStill || {}) },
    activeVideoTakeId: takes.activeVideoTakeId || '',
    reviewCounts
  };
}
