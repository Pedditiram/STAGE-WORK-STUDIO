/**
 * P1 — Production control dashboard aggregates (per active project).
 */

import { normalizeProjectTitle } from './activeProjectGate';
import { readJobsForTitle, JOB_STATUS } from './generationJobs';
import { lifecycleSummary, getProjectLifecycle } from './productionLifecycle';
import { shotTakeSummary } from './shotTakes';
import { blockingFlags, continuityFlagsForShot, reelStats } from './continuitySpine';
import { getLicense, getPlan } from './saasControl';
import { getActorEmail, readCreativeAuditLog, writeAuditSummary } from './creativeAuditLog';
import { buildProductionSpine, readProductionSpine, spineSummary } from './productionSpine';
import { readStoryPackageForTitle } from './storyPackage';
import { getPendingLlmCommands } from './llmCommandBus';
import { continuityDriftSummary } from './continuitySupervisor';
import { exportAuditSummary } from './exportGate';
import { readProductionBible, productionBibleSummary } from './productionBible';
import {
  buildCharacterContinuityTimeline,
  characterContinuityTimelineSummary
} from './characterContinuityTimeline';
import { shotSpecSlateSummary } from './shotSpec';
import { readActiveAssetRegistry, readAssetRegistryForTitle, assetRegistrySummary } from './assetRegistry';
import {
  detectBibleSoTDrift,
  bibleSoTHealthSummary
} from './bibleSoTHealth';

function jobSummary(jobs = []) {
  const counts = {
    total: 0,
    queued: 0,
    running: 0,
    succeeded: 0,
    failed: 0,
    cancelled: 0
  };
  (Array.isArray(jobs) ? jobs : []).forEach((j) => {
    counts.total += 1;
    const st = String(j?.status || '').toLowerCase();
    if (st === JOB_STATUS.QUEUED) counts.queued += 1;
    else if (st === JOB_STATUS.RUNNING) counts.running += 1;
    else if (st === JOB_STATUS.SUCCEEDED) counts.succeeded += 1;
    else if (st === JOB_STATUS.FAILED) counts.failed += 1;
    else if (st === JOB_STATUS.CANCELLED) counts.cancelled += 1;
  });
  counts.pending = counts.queued + counts.running;
  return counts;
}

function takeSummaryForShots(shots = []) {
  let stillTakes = 0;
  let videoTakes = 0;
  let shotsWithMedia = 0;
  (Array.isArray(shots) ? shots : []).forEach((s) => {
    const sum = shotTakeSummary(s);
    stillTakes += sum.stillCount || 0;
    videoTakes += sum.videoCount || 0;
    if (sum.hasLastFrame || sum.activeVideo?.url) shotsWithMedia += 1;
  });
  return { stillTakes, videoTakes, shotsWithMedia };
}

function continuitySummary(shots = []) {
  let ready = 0;
  let warn = 0;
  let block = 0;
  (Array.isArray(shots) ? shots : []).forEach((s, i) => {
    if (s?.isArchived || s?.isMuted) return;
    const flags = continuityFlagsForShot(s, shots, i);
    const blocked = blockingFlags(flags);
    if (blocked.length) block += 1;
    else if (flags.length) warn += 1;
    else ready += 1;
  });
  return { ready, warn, block };
}

export function buildProductionDashboard({
  projectTitle = '',
  shots = [],
  characters = [],
  worldAssets = [],
  projectRecord = null
} = {}) {
  const title = normalizeProjectTitle(projectTitle);
  const liveShots = (Array.isArray(shots) ? shots : []).filter((s) => !s?.isArchived);
  const reel = reelStats(liveShots);
  const shotLife = lifecycleSummary(liveShots);
  const charLife = lifecycleSummary(characters);
  const worldLife = lifecycleSummary(worldAssets);
  const jobs = readJobsForTitle(title);
  const jobStats = jobSummary(jobs);
  const takes = takeSummaryForShots(liveShots);
  const continuity = continuitySummary(liveShots);
  const drift = continuityDriftSummary(liveShots);
  const audit = readCreativeAuditLog(title);
  const projectLifecycle = getProjectLifecycle(title);
  const exports = exportAuditSummary(title, liveShots);
  const writes = writeAuditSummary(title);

  const storyPackage = readStoryPackageForTitle(title);
  const spine =
    readProductionSpine(title) ||
    buildProductionSpine({ projectTitle: title, shots: liveShots, storyPackage });
  const spineStats = spineSummary(spine);
  const bible = readProductionBible(title);
  const bibleSummary = productionBibleSummary(bible);
  const continuityTimeline = buildCharacterContinuityTimeline({
    projectTitle: title,
    shots: liveShots,
    characters
  });
  const continuityTimelineSummary = characterContinuityTimelineSummary(continuityTimeline);
  const shotSpec = shotSpecSlateSummary(liveShots);
  const registry =
    readAssetRegistryForTitle(title) ||
    (readActiveAssetRegistry()?.projectTitle === title ? readActiveAssetRegistry() : null);
  const registryStats = assetRegistrySummary(registry);

  const email = getActorEmail();
  const lic = getLicense(email === 'local' ? '' : email);
  const plan = getPlan(lic.plan);

  const approvalPct =
    shotLife.total > 0
      ? Math.round(((shotLife.approved + shotLife.locked) / shotLife.total) * 100)
      : 0;

  const bibleSoT = bibleSoTHealthSummary(
    detectBibleSoTDrift({
      projectTitle: title,
      project: projectRecord || {
        title,
        characterProfiles: characters,
        worldAssets
      }
    })
  );

  return {
    projectTitle: title,
    generatedAt: new Date().toISOString(),
    projectLifecycle,
    shots: {
      total: liveShots.length,
      muted: liveShots.filter((s) => s?.isMuted).length,
      archived: (Array.isArray(shots) ? shots : []).filter((s) => s?.isArchived).length,
      lifecycle: shotLife,
      approvalPct,
      continuity,
      drift
    },
    assets: {
      characters: { total: charLife.total, lifecycle: charLife },
      world: { total: worldLife.total, lifecycle: worldLife }
    },
    bible: {
      ...bibleSummary,
      completeness: bible.completeness,
      soT: bibleSoT
    },
    shotSpec,
    registry: registryStats,
    continuityTimeline: {
      ...continuityTimelineSummary,
      characters: (continuityTimeline.characters || []).slice(0, 8)
    },
    takes,
    jobs: jobStats,
    recentJobs: jobs.slice(0, 8),
    runtime: reel,
    saas: {
      email: email === 'local' ? 'Guest / local' : email,
      plan: plan.label,
      credits: lic.credits ?? 0,
      status: lic.status || 'ACTIVE'
    },
    audit: {
      total: audit.length,
      recent: audit.slice(0, 12)
    },
    export: exports,
    write: writes,
    llm: {
      pending: getPendingLlmCommands(title).length
    },
    spine: {
      ...spineStats,
      actNodes: spine.acts || [],
      sequenceList: spine.sequences || [],
      sceneList: spine.scenes || [],
      sequencePreview: (spine.sequences || []).slice(0, 6)
    }
  };
}
