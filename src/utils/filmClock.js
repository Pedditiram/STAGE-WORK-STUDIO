/**
 * Film clock — authority for anti-washout merges and cloud film writes.
 *
 * lastModifiedIso  = wall-clock of the last intentional Save / autosave / publish
 * filmRevision     = monotonic counter per title body (bumps on every stamp)
 *
 * Rules:
 * - Older clock never overwrites newer.
 * - Unstamped body never overwrites a stamped body.
 * - Equal clocks → higher filmRevision wins.
 */

export function filmClockMs(project) {
  if (!project || typeof project !== 'object') return 0;
  for (const key of ['lastModifiedIso', 'updatedAt', 'lastUpdated']) {
    const t = Date.parse(String(project[key] || ''));
    if (!Number.isNaN(t) && t > 0) return t;
  }
  return 0;
}

export function filmRevisionOf(project) {
  const n = Number(project?.filmRevision);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  const legacy = Number(project?.revision);
  if (Number.isFinite(legacy) && legacy > 0 && legacy < 1e11) return Math.floor(legacy);
  return 0;
}

/** True when incoming may replace existing (clock-first). */
export function isFilmStampNewer(incoming, existing) {
  if (!existing) return true;
  if (!incoming) return false;
  const iMs = filmClockMs(incoming);
  const eMs = filmClockMs(existing);
  const iRev = filmRevisionOf(incoming);
  const eRev = filmRevisionOf(existing);

  // Stamped durable film wins over unstamped echo / old vault without a clock.
  if (eMs && !iMs) return false;
  if (iMs && eMs && iMs !== eMs) return iMs > eMs;
  if (iRev !== eRev) return iRev > eRev;
  if (iMs && !eMs) return true;
  return true;
}

/** True when incoming is strictly older (reject write / reject apply). */
export function isFilmStampStrictlyOlder(incoming, existing) {
  if (!existing || !incoming) return false;
  const iMs = filmClockMs(incoming);
  const eMs = filmClockMs(existing);
  const iRev = filmRevisionOf(incoming);
  const eRev = filmRevisionOf(existing);
  if (eMs && !iMs) return true;
  if (iMs && eMs && iMs < eMs) return true;
  if (iMs === eMs && iRev < eRev) return true;
  return false;
}

export function stampFilmClock(project, { bump = true, now = null } = {}) {
  if (!project || typeof project !== 'object') return project;
  const iso = now || new Date().toISOString();
  const prev = filmRevisionOf(project);
  return {
    ...project,
    lastModifiedIso: iso,
    updatedAt: iso,
    filmRevision: bump ? Math.max(1, prev + 1) : Math.max(1, prev || 1)
  };
}
