/**
 * Film Intel Progress tab — chart data from Matrix lifecycle + Film Intel aggregates.
 */

import { lifecycleSummary, normalizeLifecycleStatus } from './productionLifecycle';
import { parseSceneAndShotID } from './sceneShotUtils';

const LIFE_PARTS = [
  { key: 'draft', label: 'Draft', color: 'color-mix(in srgb, var(--sps-muted) 55%, var(--sps-border))' },
  { key: 'review', label: 'Review', color: 'color-mix(in srgb, #c4a574 85%, var(--sps-border))' },
  { key: 'approved', label: 'Approved', color: 'var(--sps-success)' },
  { key: 'locked', label: 'Locked', color: 'var(--sps-gold)' }
];

function shortActor(emailOrName = '') {
  const s = String(emailOrName || '').trim();
  if (!s) return 'Unknown';
  if (s.includes('@')) return s.split('@')[0].slice(0, 18);
  return s.slice(0, 22);
}

/**
 * @param {{ shots?: array, intel?: object }} opts
 */
export function buildFilmProgressCharts({ shots = [], intel = {} } = {}) {
  const live = (Array.isArray(shots) ? shots : []).filter((s) => !s?.isArchived && !s?.isMuted);
  const life = lifecycleSummary(live);
  const total = life.total || 0;
  const lockedPct = total ? Math.round((life.locked / total) * 100) : 0;
  const approvedPct = total ? Math.round((life.approved / total) * 100) : 0;
  const donePct = total ? Math.round(((life.approved + life.locked) / total) * 100) : 0;

  const lifecycleParts = LIFE_PARTS.map((p) => ({
    ...p,
    count: life[p.key] || 0,
    pct: total ? Math.round(((life[p.key] || 0) / total) * 100) : 0
  }));

  // Per-scene lifecycle mix
  const sceneMap = new Map();
  live.forEach((shot, index) => {
    const parsed = parseSceneAndShotID(shot, index);
    const sceneId = parsed.sceneStr || `SC${String(parsed.sceneNum || 1).padStart(2, '0')}`;
    if (!sceneMap.has(sceneId)) {
      sceneMap.set(sceneId, {
        sceneId,
        draft: 0,
        review: 0,
        approved: 0,
        locked: 0,
        total: 0,
        cells: []
      });
    }
    const row = sceneMap.get(sceneId);
    const st = normalizeLifecycleStatus(shot?.lifecycleStatus);
    row[st] += 1;
    row.total += 1;
    row.cells.push({
      index,
      shotId: parsed.shortId || shot.sceneShotId || `SH_${index + 1}`,
      status: st,
      by: shortActor(shot?.lifecycleUpdatedBy),
      at: shot?.lifecycleUpdatedAt || ''
    });
  });
  const scenes = Array.from(sceneMap.values()).map((s) => ({
    ...s,
    lockedPct: s.total ? Math.round((s.locked / s.total) * 100) : 0,
    donePct: s.total ? Math.round(((s.approved + s.locked) / s.total) * 100) : 0
  }));

  // Collab lock / advance contributors
  const byActor = new Map();
  live.forEach((shot, index) => {
    const by = shortActor(shot?.lifecycleUpdatedBy);
    if (!by || by === 'Unknown') return;
    if (!byActor.has(by)) {
      byActor.set(by, { actor: by, locks: 0, advances: 0, shots: 0 });
    }
    const row = byActor.get(by);
    row.shots += 1;
    const st = normalizeLifecycleStatus(shot?.lifecycleStatus);
    if (st === 'locked') row.locks += 1;
    else if (st === 'approved' || st === 'review') row.advances += 1;
    void index;
  });
  const collaborators = Array.from(byActor.values())
    .sort((a, b) => b.locks + b.advances - (a.locks + a.advances) || b.shots - a.shots)
    .slice(0, 12);

  // Recent lifecycle stamps (newest first)
  const recent = live
    .map((shot, index) => {
      const parsed = parseSceneAndShotID(shot, index);
      return {
        index,
        shotId: parsed.shortId || shot.sceneShotId || `SH_${index + 1}`,
        status: normalizeLifecycleStatus(shot?.lifecycleStatus),
        by: shortActor(shot?.lifecycleUpdatedBy),
        at: shot?.lifecycleUpdatedAt || ''
      };
    })
    .filter((r) => r.at)
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, 14);

  const castBars = (intel.characters || [])
    .filter((c) => c.shotCount > 0)
    .slice(0, 10)
    .map((c) => ({
      key: c.key,
      label: c.name || c.tag || c.key,
      value: c.sharePct || 0,
      shots: c.shotCount,
      sec: Math.round(c.sec || 0)
    }));

  const lighting = intel.lighting || intel.quality?.lighting || {};
  const lightTotal =
    (lighting.day || 0) + (lighting.night || 0) + (lighting.dawn || 0) + (lighting.unset || 0);
  const lightingParts = [
    { key: 'day', label: 'Day', count: lighting.day || 0, color: 'color-mix(in srgb, var(--sps-gold) 55%, #fff)' },
    { key: 'dawn', label: 'Dawn', count: lighting.dawn || 0, color: 'color-mix(in srgb, var(--sps-gold) 35%, var(--sps-border))' },
    { key: 'night', label: 'Night', count: lighting.night || 0, color: 'color-mix(in srgb, var(--sps-muted) 70%, #1a1a22)' },
    { key: 'unset', label: 'Unset', count: lighting.unset || 0, color: 'var(--sps-border)' }
  ].map((p) => ({
    ...p,
    pct: lightTotal ? Math.round((p.count / lightTotal) * 100) : 0
  }));

  const dimensions = intel.filmHealth?.dimensions || intel.quality?.dimensions || [];
  const craftPct = intel.quality?.craftFill?.pct ?? 0;
  const healthScore = intel.filmHealth?.score ?? 0;

  const gates = ['lock', 'generate', 'shoot'].map((key) => {
    const g = intel.readiness?.[key] || {};
    const items = g.items || [];
    const ok = items.filter((i) => i.ok).length;
    return {
      key,
      label: key === 'lock' ? 'Lock' : key === 'generate' ? 'Generate' : 'Shoot',
      ready: Boolean(g.ready),
      ok,
      total: items.length || 1,
      pct: items.length ? Math.round((ok / items.length) * 100) : 0
    };
  });

  const reelCells = (intel.reelMap || []).map((r) => ({
    index: r.index,
    shotId: r.shotId,
    severity: r.severity || 'ok',
    status: normalizeLifecycleStatus(live[r.index]?.lifecycleStatus)
  }));

  return {
    projectTitle: intel.projectTitle || '',
    total,
    lockedPct,
    approvedPct,
    donePct,
    life,
    lifecycleParts,
    scenes,
    collaborators,
    recent,
    castBars,
    lightingParts,
    lightTotal,
    dimensions,
    craftPct,
    healthScore,
    healthGrade: intel.filmHealth?.grade || 'Draft',
    gates,
    reelCells,
    runtimeMin: intel.runtime?.minutes || 0,
    blockMarks: intel.stats?.blockMarks || 0,
    warnMarks: intel.stats?.warnMarks || 0
  };
}

export { LIFE_PARTS };
