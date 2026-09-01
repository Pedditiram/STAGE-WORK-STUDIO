/**
 * P43 — Story Package print sheet → PDF via browser print.
 */

import { storyPackageSummary } from './storyPackage';

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Print-ready HTML for Story Package review handoff. */
export function storyPackageToPrintHtml(pkg, { roomId = '' } = {}) {
  if (!pkg) return '<html><body><p>No story package.</p></body></html>';

  const summary = storyPackageSummary(pkg);
  const title = escapeHtml(pkg.projectTitle || 'Story Package');
  const sequences = Array.isArray(pkg.sequences) ? pkg.sequences : [];
  const scenes = Array.isArray(pkg.scenes) ? pkg.scenes : [];
  const shots = Array.isArray(pkg.proposedShots) ? pkg.proposedShots : [];
  const cast = Array.isArray(pkg.proposedCharacters) ? pkg.proposedCharacters : [];
  const world = Array.isArray(pkg.proposedWorldAssets) ? pkg.proposedWorldAssets : [];

  const seqRows = sequences
    .map(
      (seq) => `<tr>
        <td class="mono">SEQ ${String(seq.seq || '').padStart(2, '0')}</td>
        <td>${escapeHtml(seq.title || '')}</td>
        <td>${escapeHtml(seq.synopsis || seq.dramaticBeat || '—')}</td>
      </tr>`
    )
    .join('');

  const sceneRows = scenes
    .map(
      (sc) => `<tr>
        <td class="mono">SC ${String(sc.sceneNumber || '').padStart(2, '0')}</td>
        <td>${escapeHtml(sc.heading || '')}</td>
        <td>${escapeHtml(sc.synopsis || '—')}</td>
      </tr>`
    )
    .join('');

  const shotRows = shots
    .slice(0, 80)
    .map(
      (s, idx) => `<tr>
        <td class="mono">${escapeHtml(s.sceneShotId || `SH_${idx + 1}`)}</td>
        <td>${escapeHtml(s.shotComposition || '')}</td>
        <td>${escapeHtml(s.actionEnvContext || s.sceneSynopsis || '—')}</td>
      </tr>`
    )
    .join('');

  const castList = cast
    .slice(0, 24)
    .map((c) => `<li>${escapeHtml(c.name || c.tag || 'Character')}</li>`)
    .join('');
  const worldList = world
    .slice(0, 24)
    .map((a) => `<li>${escapeHtml(a.name || a.tag || 'Asset')}</li>`)
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title} — Story Package</title>
  <style>
    @page { size: letter; margin: 0.5in; }
    body { font-family: system-ui, sans-serif; font-size: 9pt; color: #111; margin: 0; padding: 14px; line-height: 1.35; }
    h1 { font-size: 13pt; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.08em; }
    h2 { font-size: 10pt; margin: 14px 0 6px; text-transform: uppercase; letter-spacing: 0.06em; }
    .meta { color: #555; margin-bottom: 10px; font-size: 9pt; }
    .stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-bottom: 12px; }
    .stat { border: 1px solid #ddd; padding: 6px; text-align: center; }
    .stat b { display: block; font-size: 12pt; }
    .stat span { font-size: 7pt; text-transform: uppercase; color: #666; }
    .logline { background: #fafafa; border: 1px solid #e5e5e5; padding: 8px; margin-bottom: 10px; white-space: pre-wrap; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th, td { border: 1px solid #ddd; padding: 4px 6px; text-align: left; vertical-align: top; }
    th { background: #f5f5f5; font-size: 8pt; text-transform: uppercase; }
    .mono { font-family: ui-monospace, monospace; white-space: nowrap; }
    ul { margin: 0; padding-left: 1.2rem; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>${title} — Story Package</h1>
  <p class="meta">${escapeHtml(summary.status)} · ${escapeHtml(summary.source || 'parse')}${summary.runtimeMinutes ? ` · ~${summary.runtimeMinutes} min` : ''}${String(roomId || '').trim() ? ` · Room ${escapeHtml(String(roomId).trim())}` : ''} · ${escapeHtml(new Date().toISOString())}</p>

  <div class="stats">
    <div class="stat"><b>${summary.sequences}</b><span>Seq</span></div>
    <div class="stat"><b>${summary.scenes}</b><span>Scenes</span></div>
    <div class="stat"><b>${summary.shots}</b><span>Shots</span></div>
    <div class="stat"><b>${summary.cast}</b><span>Cast</span></div>
    <div class="stat"><b>${summary.world}</b><span>World</span></div>
  </div>

  <h2>Logline</h2>
  <p class="logline">${escapeHtml(pkg.logline || summary.logline || '—')}</p>

  ${sequences.length ? `<h2>Sequences</h2><table><thead><tr><th>#</th><th>Title</th><th>Synopsis</th></tr></thead><tbody>${seqRows}</tbody></table>` : ''}
  ${!sequences.length && scenes.length ? `<h2>Scenes</h2><table><thead><tr><th>#</th><th>Heading</th><th>Synopsis</th></tr></thead><tbody>${sceneRows}</tbody></table>` : ''}

  <h2>Shots${shots.length > 80 ? ` (first 80 of ${shots.length})` : ''}</h2>
  <table><thead><tr><th>Id</th><th>Comp</th><th>Action</th></tr></thead><tbody>${shotRows || '<tr><td colspan="3">None</td></tr>'}</tbody></table>

  ${cast.length ? `<h2>Cast</h2><ul>${castList}</ul>` : ''}
  ${world.length ? `<h2>World</h2><ul>${worldList}</ul>` : ''}

  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;
}

function csvEscape(v) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

/** Markdown handoff for Story Package (ZIP README). */
export function storyPackageToMarkdown(pkg) {
  if (!pkg) return '# Story Package\n\n(empty)\n';
  const summary = storyPackageSummary(pkg);
  const lines = [
    `# ${pkg.projectTitle || 'Story Package'}`,
    '',
    `Status: **${summary.status || '—'}** · Source: ${summary.source || 'parse'}${
      summary.runtimeMinutes ? ` · ~${summary.runtimeMinutes} min` : ''
    }`,
    '',
    '## Counts',
    `- Sequences: ${summary.sequences}`,
    `- Scenes: ${summary.scenes}`,
    `- Shots: ${summary.shots}`,
    `- Cast: ${summary.cast}`,
    `- World: ${summary.world}`,
    '',
    '## Logline',
    pkg.logline || summary.logline || '—',
    ''
  ];

  const sequences = Array.isArray(pkg.sequences) ? pkg.sequences : [];
  if (sequences.length) {
    lines.push('## Sequences', '');
    sequences.forEach((seq) => {
      lines.push(`### SEQ ${String(seq.seq || '').padStart(2, '0')} — ${seq.title || ''}`);
      lines.push(seq.synopsis || seq.dramaticBeat || '—', '');
    });
  }

  const scenes = Array.isArray(pkg.scenes) ? pkg.scenes : [];
  if (scenes.length) {
    lines.push('## Scenes', '');
    scenes.forEach((sc) => {
      lines.push(`- **SC ${String(sc.sceneNumber || '').padStart(2, '0')}** ${sc.heading || ''}: ${sc.synopsis || '—'}`);
    });
    lines.push('');
  }

  const shots = Array.isArray(pkg.proposedShots) ? pkg.proposedShots : [];
  lines.push('## Shots', '');
  shots.forEach((s, idx) => {
    lines.push(
      `- **${s.sceneShotId || `SH_${idx + 1}`}** ${s.shotComposition || ''} — ${s.actionEnvContext || s.sceneSynopsis || '—'}`
    );
  });
  lines.push('', `Room: ${String(roomId || '').trim() || '—'}`,
        `Exported: ${new Date().toISOString()}`);
  return lines.join('\n');
}

/** CSV of proposed shots (Campaign/Storyboard CSV parity). */
export function storyPackageToCsv(pkg) {
  const headers = ['#', 'SceneShot', 'Composition', 'Action', 'Scene', 'Project'];
  const title = pkg?.projectTitle || '';
  const shots = Array.isArray(pkg?.proposedShots) ? pkg.proposedShots : [];
  const rows = shots.map((s, i) =>
    [
      i + 1,
      s?.sceneShotId || `SH_${i + 1}`,
      s?.shotComposition || '',
      s?.actionEnvContext || s?.sceneSynopsis || '',
      s?.sceneHeading || s?.sceneNumber || '',
      title
    ]
      .map(csvEscape)
      .join(',')
  );
  return [headers.map(csvEscape).join(','), ...rows].join('\n');
}

/** ZIP pack: README + shots CSV + META. */
export function buildStoryPackageZipFiles(pkg, { roomId = '' } = {}) {
  const summary = storyPackageSummary(pkg || {});
  const title = pkg?.projectTitle || 'story';
  return [
    { name: 'README.md', content: storyPackageToMarkdown(pkg) },
    { name: 'shots.csv', content: storyPackageToCsv(pkg) },
    {
      name: 'META.txt',
      content: [
        `Project: ${title}`,
        `Status: ${summary.status || ''}`,
        `Source: ${summary.source || ''}`,
        `Sequences: ${summary.sequences}`,
        `Scenes: ${summary.scenes}`,
        `Shots: ${summary.shots}`,
        `Cast: ${summary.cast}`,
        `World: ${summary.world}`,
        `Room: ${String(roomId || '').trim() || '—'}`,
        `Exported: ${new Date().toISOString()}`
      ].join('\n')
    }
  ];
}
