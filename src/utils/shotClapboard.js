/**
 * Digital clapboard labels for Matrix → ComfyUI → DaVinci Resolve.
 * Display: "Shot SC01, SH11 · 6s · MVK"
 * File stem: "MVK_SC01_SH11_6s"
 */

import { parseSceneAndShotID } from './sceneShotUtils';

function pad2(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x < 0) return '00';
  return String(Math.floor(x)).padStart(2, '0');
}

function cleanProject(title) {
  return String(title || '')
    .trim()
    .replace(/[^\w\-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase() || 'PROJECT';
}

function durationSecFromShot(shot, fallback = 6) {
  const raw =
    shot?.durationSec ??
    shot?.duration ??
    shot?.seconds ??
    shot?.clipDuration ??
    fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return Number(fallback) || 6;
  return Math.round(n * 10) / 10;
}

/**
 * @param {object} opts
 * @param {object|string} [opts.shot]
 * @param {string} [opts.projectTitle]
 * @param {number} [opts.shotIndex]
 * @param {number} [opts.durationSec]
 */
export function buildClapboard({
  shot = null,
  projectTitle = '',
  shotIndex = 0,
  durationSec
} = {}) {
  const parsed = parseSceneAndShotID(shot, shotIndex);
  const projectId = cleanProject(projectTitle || shot?.projectId || '');
  const sceneStr = parsed.sceneStr || `SC${pad2(parsed.sceneNum || 1)}`;
  const shotStr = parsed.shotStr || `SH${pad2(parsed.shotNum || shotIndex + 1)}`;
  const secs = durationSec != null ? Number(durationSec) : durationSecFromShot(shot, 6);
  const durationLabel = Number.isInteger(secs) ? `${secs}s` : `${secs}s`;
  const shortId = `${sceneStr}_${shotStr}`;
  const fileStem = `${projectId}_${shortId}_${String(durationLabel).replace(/\s+/g, '')}`;
  const label = `Shot ${sceneStr}, ${shotStr} · ${durationLabel} · ${projectId}`;

  return {
    projectId,
    sceneId: sceneStr,
    shotId: shortId,
    sceneNum: parsed.sceneNum,
    shotNum: parsed.shotNum,
    durationSec: secs,
    durationLabel,
    label,
    displayName: `${projectId} ${shortId}`,
    fileStem,
    videoFilename: `${fileStem}.mp4`,
    workflowFilename: `${fileStem}_WORKFLOW.json`,
    sidecarFilename: `${fileStem}.json`
  };
}

export function clapboardSidecarJson(clap, extra = {}) {
  return {
    schema: 'sws.clapboard.v1',
    clapboard: clap.label,
    projectId: clap.projectId,
    sceneId: clap.sceneId,
    shotId: clap.shotId,
    durationSec: clap.durationSec,
    fileStem: clap.fileStem,
    videoFilename: clap.videoFilename,
    ...extra
  };
}

/** Resolve Media Pool CSV — Scene / Shot columns for sort + timeline. */
export function clapboardResolveCsv(rows = []) {
  const header = [
    'Clip Name',
    'File Name',
    'Scene',
    'Shot',
    'Project',
    'Duration',
    'Clapboard',
    'FPS',
    'Source Path'
  ];
  const lines = [header.join(',')];
  rows.forEach((r) => {
    const clap = r.clap || buildClapboard(r);
    const cells = [
      clap.fileStem,
      clap.videoFilename,
      clap.sceneId,
      clap.shotId,
      clap.projectId,
      String(clap.durationSec),
      clap.label,
      String(r.fps || 24),
      r.sourcePath || clap.videoFilename
    ].map((c) => {
      const s = String(c ?? '');
      return /["\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    });
    lines.push(cells.join(','));
  });
  return `${lines.join('\n')}\n`;
}

/**
 * Minimal CMX3600 EDL — one event per clip, sequential on V track.
 * Resolve: File → Import → Timeline from EDL (with media in same folder).
 */
export function clapboardResolveEdl(rows = [], { title = 'SWS' } = {}) {
  const fps = 24;
  const lines = [`TITLE: ${String(title || 'SWS').slice(0, 70)}`, `FCM: NON-DROP FRAME`, ''];
  let timelineFrames = 0;
  rows.forEach((r, i) => {
    const clap = r.clap || buildClapboard(r);
    const durFrames = Math.max(1, Math.round((clap.durationSec || 6) * fps));
    const srcIn = 0;
    const srcOut = durFrames;
    const recIn = timelineFrames;
    const recOut = timelineFrames + durFrames;
    timelineFrames = recOut;
    const fmt = (f) => {
      const total = Math.max(0, Math.floor(f));
      const ff = total % fps;
      const ss = Math.floor(total / fps) % 60;
      const mm = Math.floor(total / (fps * 60)) % 60;
      const hh = Math.floor(total / (fps * 60 * 60));
      return `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}:${pad2(ff)}`;
    };
    const evt = String(i + 1).padStart(3, '0');
    const reel = clap.fileStem.slice(0, 8).toUpperCase();
    lines.push(
      `${evt}  ${reel.padEnd(8)} V     C        ${fmt(srcIn)} ${fmt(srcOut)} ${fmt(recIn)} ${fmt(recOut)}`
    );
    lines.push(`* FROM CLIP NAME: ${clap.videoFilename}`);
    lines.push(`* CLIP NAME: ${clap.label}`);
    lines.push('');
  });
  return `${lines.join('\n')}\n`;
}

/** ZIP file list for Resolve pack (caller adds media if available). */
export function buildResolvePackFiles({
  projectTitle = '',
  shots = [],
  getDurationSec,
  getSourcePath,
  fps = 24
} = {}) {
  const rows = (Array.isArray(shots) ? shots : []).map((shot, index) => {
    const durationSec =
      typeof getDurationSec === 'function' ? getDurationSec(shot, index) : undefined;
    const clap = buildClapboard({ shot, projectTitle, shotIndex: index, durationSec });
    return {
      shot,
      index,
      clap,
      fps,
      sourcePath: typeof getSourcePath === 'function' ? getSourcePath(shot, index, clap) : ''
    };
  });
  const slug = cleanProject(projectTitle);
  const files = [
    {
      name: `resolve/${slug}_clip_list.csv`,
      content: clapboardResolveCsv(rows)
    },
    {
      name: `resolve/${slug}_timeline.edl`,
      content: clapboardResolveEdl(rows, { title: slug })
    },
    {
      name: `resolve/${slug}_clapboards.json`,
      content: JSON.stringify(
        {
          schema: 'sws.resolve_pack.v1',
          projectId: slug,
          generatedAt: new Date().toISOString(),
          clips: rows.map((r) => clapboardSidecarJson(r.clap, { sourcePath: r.sourcePath || '' }))
        },
        null,
        2
      )
    },
    {
      name: 'resolve/README.txt',
      content: [
        'Stage Work Studio — DaVinci Resolve pack',
        '',
        '1. Put rendered MP4s beside this folder (or in RENDERS/Video) named like:',
        '   MVK_SC01_SH11_6s.mp4',
        '2. In Resolve: Media Pool → Import → import the CSV columns or the EDL.',
        '3. Sort Media Pool by Scene / Shot, or create timeline from EDL.',
        '',
        'Clapboard label format: Shot SC01, SH11 · 6s · MVK',
        ''
      ].join('\n')
    }
  ];
  rows.forEach((r) => {
    files.push({
      name: `sidecars/${r.clap.sidecarFilename}`,
      content: JSON.stringify(clapboardSidecarJson(r.clap, { sourcePath: r.sourcePath || '' }), null, 2)
    });
  });
  return { files, rows, slug };
}
