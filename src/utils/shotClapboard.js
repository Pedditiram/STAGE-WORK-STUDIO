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

function omitSystemInstruction(shot) {
  if (!shot || typeof shot !== 'object') return shot;
  const rest = { ...shot };
  delete rest.systemInstruction;
  delete rest.system_instruction;
  return rest;
}

/** Workflow / sidecar names from a stem — never interpolates systemInstruction. */
export function clapboardWorkflowSidecarNames({ fileStem = 'clip' } = {}) {
  const stem = String(fileStem || 'clip').replace(/[^\w.\-]+/g, '_') || 'clip';
  return {
    workflowFilename: `${stem}_WORKFLOW.json`,
    sidecarFilename: `${stem}.json`
  };
}

/** Duration in seconds — never interpolates systemInstruction. */
export function clapboardDurationSec({ durationSec, shot } = {}) {
  const fromArg = durationSec != null && durationSec !== '' ? Number(durationSec) : NaN;
  if (Number.isFinite(fromArg) && fromArg > 0) return fromArg;
  return durationSecFromShot(omitSystemInstruction(shot), 6);
}

/** Scene / shot numbers — never interpolates systemInstruction. */
export function clapboardSceneShotNums({ sceneNum = 1, shotNum = 1 } = {}) {
  const scene = Number(sceneNum);
  const shot = Number(shotNum);
  return {
    sceneNum: Number.isFinite(scene) && scene > 0 ? Math.floor(scene) : 1,
    shotNum: Number.isFinite(shot) && shot > 0 ? Math.floor(shot) : 1
  };
}

/** Clapboard label / duration — never interpolates systemInstruction. */
export function clapboardLabelText({ sceneStr = 'SC01', shotStr = 'SH01', durationSec = 6, projectId = 'PROJECT' } = {}) {
  const n = Number(durationSec);
  const secs = Number.isFinite(n) && n > 0 ? n : 6;
  const durationLabel = `${Number.isInteger(secs) ? secs : secs}s`;
  return {
    durationLabel,
    label: `Shot ${sceneStr}, ${shotStr} · ${durationLabel} · ${projectId}`
  };
}

/** Project / scene ids — never interpolates systemInstruction. */
export function clapboardProjectSceneIds({ projectTitle = '', sceneStr = 'SC01' } = {}) {
  return {
    projectId: cleanProject(projectTitle),
    sceneId: String(sceneStr || 'SC01')
  };
}

/** Display shotId / displayName — never interpolates systemInstruction. */
export function clapboardDisplayIds({ projectId = 'PROJECT', shortId = 'SC01_SH01' } = {}) {
  const id = String(shortId || 'SC01_SH01');
  const project = String(projectId || 'PROJECT');
  return {
    shotId: id,
    displayName: `${project} ${id}`.trim()
  };
}

/** Clapboard stems — never interpolates systemInstruction. */
export function clapboardFileNames({ projectId = 'PROJECT', sceneStr = 'SC01', shotStr = 'SH01', durationLabel = '6s' } = {}) {
  const dur = String(durationLabel || '6s').replace(/\s+/g, '');
  const shortId = `${sceneStr}_${shotStr}`;
  const fileStem = `${projectId}_${shortId}_${dur}`;
  return {
    shortId,
    fileStem,
    videoFilename: `${fileStem}.mp4`,
    ...clapboardWorkflowSidecarNames({ fileStem })
  };
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
  const shotForIds = omitSystemInstruction(shot);
  const parsed = parseSceneAndShotID(shotForIds, shotIndex);
  const place = clapboardProjectSceneIds({
    projectTitle: projectTitle || shotForIds?.projectId || '',
    sceneStr: parsed.sceneStr || `SC${pad2(parsed.sceneNum || 1)}`
  });
  const projectId = place.projectId;
  const sceneStr = place.sceneId;
  const shotStr = parsed.shotStr || `SH${pad2(parsed.shotNum || shotIndex + 1)}`;
  const secs = clapboardDurationSec({ durationSec, shot: shotForIds });
  const titled = clapboardLabelText({ sceneStr, shotStr, durationSec: secs, projectId });
  const durationLabel = titled.durationLabel;
  const names = clapboardFileNames({ projectId, sceneStr, shotStr, durationLabel });
  const ids = clapboardDisplayIds({ projectId, shortId: names.shortId });
  const nums = clapboardSceneShotNums({ sceneNum: parsed.sceneNum, shotNum: parsed.shotNum });
  const label = titled.label;

  return {
    projectId,
    sceneId: sceneStr,
    shotId: ids.shotId,
    sceneNum: nums.sceneNum,
    shotNum: nums.shotNum,
    durationSec: secs,
    durationLabel,
    label,
    displayName: ids.displayName,
    fileStem: names.fileStem,
    videoFilename: names.videoFilename,
    workflowFilename: names.workflowFilename,
    sidecarFilename: names.sidecarFilename
  };
}

export function clapboardSidecarJson(clap, extra = {}) {
  const systemInstruction = String(extra.systemInstruction || extra.system_instruction || '').trim();
  const rest = { ...extra };
  delete rest.systemInstruction;
  delete rest.system_instruction;
  delete rest.durationSec;
  delete rest.fileStem;
  delete rest.videoFilename;
  delete rest.projectId;
  delete rest.sceneId;
  delete rest.shotId;
  delete rest.durationLabel;
  delete rest.displayName;
  delete rest.workflowFilename;
  delete rest.sidecarFilename;
  delete rest.sceneNum;
  delete rest.shotNum;
  delete rest.label;
  delete rest.schema;
  const place = clapboardProjectSceneIds({
    projectTitle: clap.projectId,
    sceneStr: clap.sceneId
  });
  const ids = clapboardDisplayIds({
    projectId: clap.projectId,
    shortId: clap.shotId
  });
  const shotStr = String(ids.shotId || 'SC01_SH01').split('_').slice(1).join('_') || 'SH01';
  const titled = clapboardLabelText({
    sceneStr: place.sceneId,
    shotStr,
    durationSec: clap.durationSec,
    projectId: place.projectId
  });
  const fileStem = String(clap.fileStem || 'clip').replace(/[^\w.\-]+/g, '_') || 'clip';
  const packNames = clapboardWorkflowSidecarNames({ fileStem });
  const nums = clapboardSceneShotNums({
    sceneNum: clap.sceneNum,
    shotNum: clap.shotNum
  });
  return {
    ...rest,
    schema: 'sws.clapboard.v1',
    durationSec: clapboardDurationSec({ durationSec: clap.durationSec }),
    fileStem,
    videoFilename:
      String(clap.videoFilename || `${fileStem}.mp4`).replace(/[^\w.\-]+/g, '_') || 'clip.mp4',
    projectId: place.projectId,
    sceneId: place.sceneId,
    shotId: ids.shotId,
    durationLabel: titled.durationLabel,
    displayName: ids.displayName,
    workflowFilename: packNames.workflowFilename,
    sidecarFilename: packNames.sidecarFilename,
    sceneNum: nums.sceneNum,
    shotNum: nums.shotNum,
    label: titled.label,
    clapboard: clap.label,
    systemInstruction
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
    'System Instruction',
    'FPS',
    'Source Path'
  ];
  const lines = [header.join(',')];
  rows.forEach((r) => {
    const clap = r.clap || buildClapboard(r);
    const clapboardCell = clap.label;
    const sys = String(r.systemInstruction || r.system_instruction || '').trim();
    const cells = [
      clap.fileStem,
      clap.videoFilename,
      clap.sceneId,
      clap.shotId,
      clap.projectId,
      String(clap.durationSec),
      clapboardCell,
      sys,
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
    const sys = String(r.systemInstruction || r.system_instruction || '').replace(/\s+/g, ' ').trim();
    lines.push(
      `${evt}  ${reel.padEnd(8)} V     C        ${fmt(srcIn)} ${fmt(srcOut)} ${fmt(recIn)} ${fmt(recOut)}`
    );
    lines.push(`* FROM CLIP NAME: ${clap.videoFilename}`);
    lines.push(`* CLIP NAME: ${clap.label}`);
    if (sys) lines.push(`* COMMENT: SYSTEM ${sys.slice(0, 120)}`);
    lines.push('');
  });
  return `${lines.join('\n')}\n`;
}

/** Resolve pack README — never interpolates systemInstruction. */
export function resolvePackReadme({ projectTitle = '' } = {}) {
  const slug = cleanProject(projectTitle);
  return [
    'Stage Work Studio — DaVinci Resolve pack',
    '',
    '1. Put rendered MP4s beside this folder (or in RENDERS/Video) named like:',
    `   ${slug}_SC01_SH11_6s.mp4`,
    '2. In Resolve: Media Pool → Import → import the CSV columns or the EDL.',
    '3. Sort Media Pool by Scene / Shot, or create timeline from EDL.',
    '',
    'Clapboard label format: Shot SC01, SH11 · 6s · MVK',
    'System Instruction is a CSV / clapboard-JSON field — not this README.',
    ''
  ].join('\n');
}

/** Resolve pack paths — never interpolates systemInstruction. */
export function resolvePackFilename({ projectTitle = '', kind = 'readme', sidecarFilename = '' } = {}) {
  const slug = cleanProject(projectTitle);
  if (kind === 'csv') return `resolve/${slug}_clip_list.csv`;
  if (kind === 'edl') return `resolve/${slug}_timeline.edl`;
  if (kind === 'json') return `resolve/${slug}_clapboards.json`;
  if (kind === 'sidecar') {
    const safe = String(sidecarFilename || 'clip.json').replace(/[^\w.\-]+/g, '_') || 'clip.json';
    return `sidecars/${safe}`;
  }
  return 'resolve/README.txt';
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
      sourcePath: typeof getSourcePath === 'function' ? getSourcePath(shot, index, clap) : '',
      systemInstruction: String(shot?.systemInstruction || shot?.system_instruction || '').trim()
    };
  });
  const slug = cleanProject(projectTitle);
  const files = [
    {
      name: resolvePackFilename({ projectTitle, kind: 'csv' }),
      content: clapboardResolveCsv(rows)
    },
    {
      name: resolvePackFilename({ projectTitle, kind: 'edl' }),
      content: clapboardResolveEdl(rows, { title: slug })
    },
    {
      name: resolvePackFilename({ projectTitle, kind: 'json' }),
      content: JSON.stringify(
        {
          schema: 'sws.resolve_pack.v1',
          projectId: slug,
          generatedAt: new Date().toISOString(),
          clips: rows.map((r) =>
            clapboardSidecarJson(r.clap, {
              sourcePath: r.sourcePath || '',
              systemInstruction: r.systemInstruction || ''
            })
          )
        },
        null,
        2
      )
    },
    {
      name: resolvePackFilename({ projectTitle, kind: 'readme' }),
      content: resolvePackReadme({ projectTitle })
    }
  ];
  rows.forEach((r) => {
    files.push({
      name: resolvePackFilename({ projectTitle, kind: 'sidecar', sidecarFilename: r.clap.sidecarFilename }),
      content: JSON.stringify(
        clapboardSidecarJson(r.clap, {
          sourcePath: r.sourcePath || '',
          systemInstruction: r.systemInstruction || ''
        }),
        null,
        2
      )
    });
  });
  return { files, rows, slug };
}
