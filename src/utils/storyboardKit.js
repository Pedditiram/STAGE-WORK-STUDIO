/**
 * Storyboard console — one still frame per Matrix shot + a clear still prompt under it.
 */

import { compileMasterCinemaCompilerPrompt } from './compileMasterCinemaPrompt';
import { resolveImageUrl } from './imageBlobStore';

function clip(s, max) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function liveShots(shots) {
  return (Array.isArray(shots) ? shots : [])
    .map((shot, index) => ({ shot, index }))
    .filter(({ shot }) => shot && !shot.isArchived);
}

export function storyboardStillUrl(shot, index, generatedMap = {}) {
  const id = String(shot?.sceneShotId || `SH_${index + 1}`).trim();
  const keys = [
    shot?.embeddedImages?.first_frame,
    shot?.embeddedImages?.last_frame,
    generatedMap[`${id}_first_frame`],
    generatedMap[id],
    generatedMap[`SH_${index + 1}_first_frame`],
    generatedMap[`SH_${index + 1}`],
  ];
  for (const raw of keys) {
    const url = resolveImageUrl(raw);
    if (url) return url;
  }
  return '';
}

export function buildStoryboardStillPrompt(shot, { projectTitle = 'Project', aspectRatio = '2.39:1' } = {}) {
  const id = shot?.sceneShotId || 'SHOT';
  const subject = clip(shot?.characterIdAssetRef, 120) || 'Lead from the bible';
  const pose = clip(shot?.characterExpression || shot?.characterMovement, 160) || 'Holds a readable peak pose';
  const place = clip(shot?.actionEnvContext, 180) || 'World from the matrix plate';
  const light = clip([shot?.subjectLightingTag, shot?.timeAndLightingEnv].filter(Boolean).join(' · '), 140);
  const frame = clip(shot?.shotComposition, 80) || 'Cinematic still';
  const dialogue = clip(shot?.characterDialogue, 160);

  return [
    `STORYBOARD STILL — ${id}`,
    `Project: ${projectTitle} · Aspect: ${aspectRatio}`,
    `ONE FRAME. Photoreal keyframe. Not a video. No duration. No audio. No sequence.`,
    `Composition: ${frame}`,
    `Subject: ${subject}`,
    `Frozen action: ${pose}`,
    `Place: ${place}`,
    light ? `Light: ${light}` : '',
    dialogue ? `Slate line (do not burn subtitles unless lettered): ${dialogue}` : '',
    'Match character bible. Same wardrobe and grade. No watermark, no extra limbs, no UI.',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildStoryboardFrames({
  shots = [],
  projectTitle = 'Project',
  aspectRatio = '2.39:1',
  generatedMap = {},
} = {}) {
  return liveShots(shots).map(({ shot, index }) => {
    const cinema = compileMasterCinemaCompilerPrompt(shot, index, { projectTitle, shots });
    return {
      index,
      sceneShotId: shot.sceneShotId || `SH_${index + 1}`,
      stillUrl: storyboardStillUrl(shot, index, generatedMap),
      stillPrompt: buildStoryboardStillPrompt(shot, { projectTitle, aspectRatio }),
      videoPrompt: cinema.masterCinemaPrompt || cinema.mainPrompt || '',
      composition: clip(shot.shotComposition, 80),
      dialogue: clip(shot.characterDialogue, 120),
      synopsis: clip(shot.sceneSynopsis || shot.actionEnvContext, 140),
    };
  });
}

export function storyboardToMarkdown(frames, projectTitle = 'Project') {
  const lines = [`# ${projectTitle} — Storyboard`, '', `${(frames || []).length} frames`, ''];
  (frames || []).forEach((f, i) => {
    lines.push(`## ${i + 1}. ${f.sceneShotId}`);
    if (f.synopsis) lines.push(f.synopsis);
    lines.push('', '```', f.stillPrompt || '', '```', '');
  });
  return lines.join('\n');
}

/** Craft CSV for schedules / still-prompt dumps (Campaign kit CSV parity). */
export function storyboardToCsv(frames = []) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const headers = ['#', 'SceneShot', 'Composition', 'Dialogue', 'Synopsis', 'HasStill', 'StillPrompt'];
  const rows = (Array.isArray(frames) ? frames : []).map((f, i) =>
    [
      i + 1,
      f.sceneShotId || '',
      f.composition || '',
      f.dialogue || '',
      f.synopsis || '',
      f.stillUrl ? 'yes' : '',
      f.stillPrompt || ''
    ]
      .map(esc)
      .join(',')
  );
  return [headers.map(esc).join(','), ...rows].join('\n');
}

/** Zip pack: README + per-frame still/video prompts + still images when available. */
export function buildStoryboardZipFiles(frames = [], projectTitle = 'Project', { showVideo = false, roomId = '' } = {}) {
  const files = [
    {
      name: 'README.md',
      content: storyboardToMarkdown(frames, projectTitle)
    }
  ];
  (frames || []).forEach((f, i) => {
    const stem = String(f.sceneShotId || `SH_${i + 1}`).replace(/[^\w\-]+/g, '_');
    files.push({
      name: `frames/${String(i + 1).padStart(2, '0')}_${stem}_still.txt`,
      content: f.stillPrompt || ''
    });
    if (showVideo && f.videoPrompt) {
      files.push({
        name: `frames/${String(i + 1).padStart(2, '0')}_${stem}_video.txt`,
        content: f.videoPrompt
      });
    }
    if (f.stillUrl && String(f.stillUrl).startsWith('data:')) {
      const ext = /image\/png/i.test(f.stillUrl) ? 'png' : /image\/webp/i.test(f.stillUrl) ? 'webp' : 'jpg';
      files.push({
        name: `stills/${String(i + 1).padStart(2, '0')}_${stem}.${ext}`,
        content: f.stillUrl
      });
    }
  });
  const room = String(roomId || '').trim();
  files.push({
    name: 'META.txt',
    content: [
      `Project: ${projectTitle || 'Project'}`,
      `Frames: ${(frames || []).length}`,
      `Mode: ${showVideo ? 'still+video' : 'still'}`,
      `Room: ${room || '—'}`,
      `Exported: ${new Date().toISOString()}`
    ].join('\n')
  });
  return files;
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Print-ready HTML for storyboard PDF export. */
export function storyboardToPrintHtml(frames = [], projectTitle = 'Project', { showVideo = false, roomId = '' } = {}) {
  const panels = (frames || [])
    .map((f, i) => {
      const img = f.stillUrl
        ? `<img src="${escapeHtml(f.stillUrl)}" alt="${escapeHtml(f.sceneShotId)}" />`
        : '<div class="empty">No still yet — prompt only</div>';
      const video =
        showVideo && f.videoPrompt
          ? `<p class="label">Video compile</p><pre class="prompt video">${escapeHtml(f.videoPrompt)}</pre>`
          : '';
      return `
        <section class="panel">
          <div class="head">
            <span class="id">${i + 1}. ${escapeHtml(f.sceneShotId)}</span>
            <span class="comp">${escapeHtml(f.composition || '')}</span>
          </div>
          <div class="frame">${img}</div>
          <p class="label">Still prompt</p>
          <pre class="prompt">${escapeHtml(f.stillPrompt || '')}</pre>
          ${video}
        </section>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(projectTitle)} — Storyboard</title>
  <style>
    @page { size: letter landscape; margin: 0.5in; }
    body { font-family: system-ui, sans-serif; font-size: 10pt; color: #111; margin: 0; padding: 16px; }
    .meta { font-size: 9pt; color: #666; margin: 0 0 12px; }
    h1 { font-size: 14pt; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 0.08em; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .panel { border: 1px solid #ccc; border-radius: 6px; overflow: hidden; page-break-inside: avoid; }
    .head { display: flex; justify-content: space-between; padding: 6px 8px; background: #f5f5f5; font-size: 9pt; font-weight: 700; }
    .id { font-family: ui-monospace, monospace; }
    .comp { color: #666; font-weight: 500; }
    .frame { aspect-ratio: 2.39 / 1; background: #eee; display: flex; align-items: center; justify-content: center; }
    .frame img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .empty { color: #888; font-size: 9pt; padding: 12px; text-align: center; }
    .label { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.1em; color: #666; margin: 6px 8px 2px; }
    .prompt { font-family: ui-monospace, monospace; font-size: 8pt; line-height: 1.35; white-space: pre-wrap; margin: 0 8px 8px; padding: 6px; background: #fafafa; border: 1px solid #eee; }
    .video { max-height: 80px; overflow: hidden; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(projectTitle)} — Storyboard · ${(frames || []).length} frames</h1>
  <p class="meta">${(frames || []).length} frames · ${showVideo ? 'still+video' : 'still'}${String(roomId || '').trim() ? ` · Room ${escapeHtml(String(roomId).trim())}` : ''} · ${escapeHtml(new Date().toISOString())}</p>
  <div class="grid">${panels}</div>
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;
}
