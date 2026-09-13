/**
 * DaVinci Resolve pack export — CSV + EDL + clapboard sidecars for the open film.
 */

import { buildResolvePackFiles, buildClapboard } from './shotClapboard';
import { createZipArchive } from './zipUtils';
import { saveExportBlob } from './saveExportFile';
import { assertExportAllowed, logExportSuccess, resolveCollabRoomId } from './exportGate';
import { listFilmQueueShots } from './comfyFilmQueue';
import { generationsForShot } from './swsComfyStore';

/**
 * Export Resolve pack ZIP for live Matrix shots (or a single fallback shot).
 * @returns {Promise<{ ok: boolean, filename?: string, clipCount?: number, sampleVideoFilename?: string, error?: string, blocked?: boolean }>}
 */
export async function exportProjectResolvePack({
  projectTitle = '',
  shots = [],
  fallbackShot = null,
  fallbackIndex = 0,
  durationFallback = 6,
  fps = 24,
  lifecycleMode,
  roomId,
  extraFiles = []
} = {}) {
  const list = listFilmQueueShots(shots);
  const targets = list.length
    ? list
    : fallbackShot
      ? [{ shot: fallbackShot, index: fallbackIndex }]
      : [];
  if (!targets.length) {
    return { ok: false, error: 'No live shots to pack for DaVinci Resolve.' };
  }

  const room = roomId || resolveCollabRoomId();
  const gate = assertExportAllowed({
    projectTitle,
    label: 'resolve_pack',
    format: 'zip',
    lifecycleMode,
    shots,
    roomId: room
  });
  if (!gate.ok) {
    return { ok: false, blocked: true, error: gate.message || 'Export blocked.' };
  }

  const { files, slug, rows } = buildResolvePackFiles({
    projectTitle,
    shots: targets.map((t) => t.shot),
    getDurationSec: (s) =>
      Number(s?.durationSec || s?.duration || durationFallback) || durationFallback,
    getSourcePath: (s, _i, c) => {
      const gens = generationsForShot(projectTitle, s?.sceneShotId || c.shotId);
      const hit = (gens || []).find((g) => g.outputFile);
      return hit?.outputFile || c.videoFilename;
    },
    fps
  });

  (Array.isArray(extraFiles) ? extraFiles : []).forEach((f) => {
    if (f?.name && f.content != null) files.push(f);
  });

  const blob = createZipArchive(files);
  const filename = `${slug}_RESOLVE_PACK.zip`;
  const saved = await saveExportBlob(blob, filename, {
    skipLifecycleCheck: true,
    advisoryAlready: Boolean(gate.advisory),
    projectTitle,
    auditLabel: 'resolve_pack',
    auditFormat: 'zip',
    shots,
    roomId: room,
    lifecycleMode
  });
  if (saved?.blocked) {
    return { ok: false, blocked: true, error: saved.error || 'Could not save Resolve pack.' };
  }

  logExportSuccess({
    projectTitle,
    label: 'resolve_pack',
    format: 'zip',
    filename,
    roomId: room,
    lifecycleMode
  });

  const sample =
    rows[0]?.clap?.videoFilename ||
    buildClapboard({
      shot: targets[0].shot,
      projectTitle,
      shotIndex: targets[0].index,
      durationSec: durationFallback
    }).videoFilename;

  return {
    ok: true,
    filename,
    clipCount: targets.length,
    sampleVideoFilename: sample
  };
}
