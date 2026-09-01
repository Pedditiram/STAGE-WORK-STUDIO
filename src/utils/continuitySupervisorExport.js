/**
 * P43 — Continuity supervisor drift report → PDF via browser print.
 */

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Print-ready HTML for continuity drift scan. */
export function continuityDriftToPrintHtml({
  projectTitle = 'Project',
  issues = [],
  summary = {},
  roomId = ''
} = {}) {
  const title = escapeHtml(projectTitle || 'Project');
  const list = Array.isArray(issues) ? issues : [];
  const count = Number(summary.count) || list.length;
  const shotCount = Number(summary.shotCount) || new Set(list.map((i) => i.shotIndex)).size;
  const room = String(roomId || '').trim();
  const roomTitle = room ? ` · ${escapeHtml(room)}` : '';

  const rows = list
    .map(
      (row) => `<tr>
        <td class="mono">${escapeHtml(row.sceneShotId || '')}</td>
        <td>${escapeHtml(row.name || row.charKey || '')}</td>
        <td>${escapeHtml((row.deltas || []).join(', ') || '—')}</td>
        <td class="mono">${escapeHtml(room || '—')}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title} — Continuity report${roomTitle}</title>
  <style>
    @page { size: letter; margin: 0.55in; }
    body { font-family: system-ui, sans-serif; font-size: 9pt; color: #111; margin: 0; padding: 14px; line-height: 1.35; }
    h1 { font-size: 13pt; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.08em; }
    .meta { color: #555; margin-bottom: 12px; font-size: 9pt; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ddd; padding: 4px 6px; text-align: left; vertical-align: top; }
    th { background: #f5f5f5; font-size: 8pt; text-transform: uppercase; }
    .mono { font-family: ui-monospace, monospace; white-space: nowrap; }
    .empty { color: #666; font-style: italic; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>${title} — Continuity supervisor${roomTitle}</h1>
  <p class="meta">${count} drift row${count === 1 ? '' : 's'} · ${shotCount} shot${shotCount === 1 ? '' : 's'} · Room ${escapeHtml(room || '—')} · ${escapeHtml(new Date().toISOString())}</p>
  ${
    list.length
      ? `<table>
    <thead><tr><th>Shot</th><th>Character</th><th>Implicit deltas</th><th>Room</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`
      : '<p class="empty">No costume/injury/prop drift without explicit patches.</p>'
  }
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;
}

function csvEscape(v) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

/** Craft CSV for continuity drift report (Campaign/Feature reel CSV parity). */
export function continuityDriftToCsv({
  projectTitle = '',
  issues = [],
  summary = {},
  roomId = ''
} = {}) {
  const headers = ['#', 'SceneShot', 'Character', 'Deltas', 'ShotIndex', 'Project', 'Room'];
  const list = Array.isArray(issues) ? issues : [];
  const room = String(roomId || '').trim();
  const rows = list.map((row, i) =>
    [
      i + 1,
      row?.sceneShotId || '',
      row?.name || row?.charKey || '',
      (row?.deltas || []).join('; '),
      row?.shotIndex ?? '',
      projectTitle || '',
      room || '—'
    ]
      .map(csvEscape)
      .join(',')
  );
  const meta = [
    `# Continuity supervisor · ${projectTitle || 'Project'}${room ? ` · room ${room}` : ''}`,
    `# Drift rows: ${Number(summary.count) || list.length}`,
    `# Shots touched: ${Number(summary.shotCount) || new Set(list.map((i) => i.shotIndex)).size}`,
    `# Room: ${room || '—'}`,
    `# Exported: ${new Date().toISOString()}`
  ].join('\n');
  return `${meta}\n${[headers.map(csvEscape).join(','), ...rows].join('\n')}`;
}

/** ZIP pack: drift CSV + META + README (Budget/Promo ZIP parity). */

/** Craft Markdown continuity drift report (Budget/Promo MD parity). */
export function continuityDriftToMarkdown({
  projectTitle = 'Project',
  issues = [],
  summary = {},
  roomId = ''
} = {}) {
  const title = String(projectTitle || 'Project').trim() || 'Project';
  const list = Array.isArray(issues) ? issues : [];
  const room = String(roomId || '').trim();
  const count = Number(summary.count) || list.length;
  const shotCount =
    Number(summary.shotCount) || new Set(list.map((i) => i.shotIndex)).size;
  const lines = [
    `# Continuity supervisor — ${title}${room ? ` · room ${room}` : ''}`,
    '',
    `- Drift rows: ${count}`,
    `- Shots touched: ${shotCount}`,
    `- Room: ${room || '—'}`,
    `- Exported: ${new Date().toISOString()}`,
    '',
    '| # | Shot | Character | Implicit deltas | Room |',
    '| --- | --- | --- | --- | --- |'
  ];
  list.forEach((row, i) => {
    const shot = String(row?.sceneShotId || '').replace(/\|/g, '/');
    const who = String(row?.name || row?.charKey || '').replace(/\|/g, '/');
    const deltas = (row?.deltas || []).join('; ').replace(/\|/g, '/');
    lines.push(`| ${i + 1} | ${shot} | ${who} | ${deltas || '—'} | ${room || '—'} |`);
  });
  if (!list.length) {
    lines.push(`| — | — | — | No costume/injury/prop drift without explicit patches. | ${room || '—'} |`);
  }
  lines.push('');
  return lines.join('\n');
}

export function buildContinuityZipFiles({
  projectTitle = 'Project',
  issues = [],
  summary = {},
  roomId = ''
} = {}) {
  const title = String(projectTitle || 'Project').trim() || 'Project';
  const list = Array.isArray(issues) ? issues : [];
  const room = String(roomId || '').trim();
  const count = Number(summary.count) || list.length;
  const shotCount =
    Number(summary.shotCount) || new Set(list.map((i) => i.shotIndex)).size;
  const csv = continuityDriftToCsv({ projectTitle: title, issues: list, summary, roomId: room });
  const md = continuityDriftToMarkdown({ projectTitle: title, issues: list, summary, roomId: room });
  const roomTag = room ? `_${String(room).replace(/[^\w\-]+/g, '_').slice(0, 24)}` : '';
  return [
    { name: `continuity_report${roomTag}.csv`, content: csv },
    { name: `continuity_report${roomTag}.md`, content: md },
    {
      name: 'META.txt',
      content: [
        `Project: ${title}`,
        `Drift rows: ${count}`,
        `Shots touched: ${shotCount}`,
        `Room: ${room || '—'}`,
        `Exported: ${new Date().toISOString()}`
      ].join('\n')
    },
    {
      name: 'README.md',
      content: [
        `# ${title} — Continuity supervisor pack`,
        '',
        `- Report: \`continuity_report${roomTag}.csv\``,
        `- Markdown: \`continuity_report${roomTag}.md\``,
        `- Drift rows: ${count}`,
        `- Shots touched: ${shotCount}`,
        room ? `- Collab room: ${room}` : '- Collab room: —',
        '',
        'Costume / injury / prop drift without explicit patches.'
      ].join('\n')
    }
  ];
}


/** Craft CSV for proposed continuity patches (Report CSV parity). */
export function continuityFixesToCsv({
  projectTitle = '',
  fixes = [],
  roomId = ''
} = {}) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const headers = ['#', 'SceneShot', 'Character', 'Deltas', 'Patch', 'ShotIndex', 'Project', 'Room'];
  const list = Array.isArray(fixes) ? fixes : [];
  const room = String(roomId || '').trim();
  const rows = list.map((row, i) => {
    const patch = row?.patch && typeof row.patch === 'object'
      ? Object.entries(row.patch).map(([k, v]) => `${k}=${v}`).join('; ')
      : '';
    return [
      i + 1,
      row?.sceneShotId || '',
      row?.name || row?.charKey || '',
      (row?.deltas || []).join('; '),
      patch,
      row?.shotIndex ?? '',
      projectTitle || '',
      room || '—'
    ]
      .map(esc)
      .join(',');
  });
  const meta = [
    `# Continuity fixes · ${projectTitle || 'Project'}${room ? ` · room ${room}` : ''}`,
    `# Patches: ${list.length}`,
    `# Room: ${room || '—'}`,
    `# Exported: ${new Date().toISOString()}`
  ].join('\n');
  return `${meta}\n${[headers.map(esc).join(','), ...rows].join('\n')}`;
}


/** Print-ready HTML for proposed continuity patches (Report PDF parity). */
export function continuityFixesToPrintHtml({
  projectTitle = 'Project',
  fixes = [],
  roomId = ''
} = {}) {
  const title = escapeHtml(projectTitle || 'Project');
  const list = Array.isArray(fixes) ? fixes : [];
  const room = String(roomId || '').trim();
  const roomTitle = room ? ` · ${escapeHtml(room)}` : '';

  const rows = list
    .map((row) => {
      const patch =
        row?.patch && typeof row.patch === 'object'
          ? Object.entries(row.patch)
              .map(([k, v]) => `${k}=${v}`)
              .join('; ')
          : '';
      return `<tr>
        <td class="mono">${escapeHtml(row.sceneShotId || '')}</td>
        <td>${escapeHtml(row.name || row.charKey || '')}</td>
        <td>${escapeHtml((row.deltas || []).join(', ') || '—')}</td>
        <td>${escapeHtml(patch || '—')}</td>
        <td class="mono">${escapeHtml(room || '—')}</td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title} — Continuity fixes${roomTitle}</title>
  <style>
    @page { size: letter; margin: 0.55in; }
    body { font-family: system-ui, sans-serif; font-size: 9pt; color: #111; margin: 0; padding: 14px; line-height: 1.35; }
    h1 { font-size: 13pt; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.08em; }
    .meta { color: #555; margin-bottom: 12px; font-size: 9pt; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ddd; padding: 4px 6px; text-align: left; vertical-align: top; }
    th { background: #f5f5f5; font-size: 8pt; text-transform: uppercase; }
    .mono { font-family: ui-monospace, monospace; white-space: nowrap; }
    .empty { color: #666; font-style: italic; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>${title} — Continuity fixes${roomTitle}</h1>
  <p class="meta">${list.length} patch${list.length === 1 ? '' : 'es'} · Room ${escapeHtml(room || '—')} · ${escapeHtml(new Date().toISOString())}</p>
  ${
    list.length
      ? `<table>
    <thead><tr><th>Shot</th><th>Character</th><th>Deltas</th><th>Patch</th><th>Room</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`
      : '<p class="empty">No proposed costume/injury/prop patches.</p>'
  }
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;
}


/** ZIP pack: fixes CSV + META + README (Report ZIP parity). */

/** Craft Markdown for proposed continuity patches (Fixes CSV parity). */
export function continuityFixesToMarkdown({
  projectTitle = 'Project',
  fixes = [],
  roomId = ''
} = {}) {
  const title = String(projectTitle || 'Project').trim() || 'Project';
  const list = Array.isArray(fixes) ? fixes : [];
  const room = String(roomId || '').trim();
  const lines = [
    `# Continuity fixes — ${title}${room ? ` · room ${room}` : ''}`,
    '',
    `- Patches: ${list.length}`,
    `- Room: ${room || '—'}`,
    `- Exported: ${new Date().toISOString()}`,
    '',
    '| # | Shot | Character | Deltas | Patch | Room |',
    '| --- | --- | --- | --- | --- | --- |'
  ];
  list.forEach((row, i) => {
    const shot = String(row?.sceneShotId || '').replace(/\|/g, '/');
    const who = String(row?.name || row?.charKey || '').replace(/\|/g, '/');
    const deltas = (row?.deltas || []).join('; ').replace(/\|/g, '/');
    const patch =
      row?.patch && typeof row.patch === 'object'
        ? Object.entries(row.patch)
            .map(([k, v]) => `${k}=${v}`)
            .join('; ')
            .replace(/\|/g, '/')
        : '';
    lines.push(`| ${i + 1} | ${shot} | ${who} | ${deltas || '—'} | ${patch || '—'} | ${room || '—'} |`);
  });
  if (!list.length) {
    lines.push(`| — | — | — | — | No proposed patches. | ${room || '—'} |`);
  }
  lines.push('');
  return lines.join('\n');
}

export function buildContinuityFixesZipFiles({
  projectTitle = 'Project',
  fixes = [],
  roomId = ''
} = {}) {
  const title = String(projectTitle || 'Project').trim() || 'Project';
  const list = Array.isArray(fixes) ? fixes : [];
  const room = String(roomId || '').trim();
  const csv = continuityFixesToCsv({ projectTitle: title, fixes: list, roomId: room });
  const md = continuityFixesToMarkdown({ projectTitle: title, fixes: list, roomId: room });
  const roomTag = room ? `_${String(room).replace(/[^\w\-]+/g, '_').slice(0, 24)}` : '';
  return [
    { name: `continuity_fixes${roomTag}.csv`, content: csv },
    { name: `continuity_fixes${roomTag}.md`, content: md },
    {
      name: 'META.txt',
      content: [
        `Project: ${title}`,
        `Patches: ${list.length}`,
        `Room: ${room || '—'}`,
        `Exported: ${new Date().toISOString()}`
      ].join('\n')
    },
    {
      name: 'README.md',
      content: [
        `# ${title} — Continuity fixes pack`,
        '',
        `- Fixes: \`continuity_fixes${roomTag}.csv\``,
        `- Markdown: \`continuity_fixes${roomTag}.md\``,
        `- Patches: ${list.length}`,
        room ? `- Collab room: ${room}` : '- Collab room: —',
        '',
        'Proposed costume / injury / prop patches for Matrix continuityPatch fields.'
      ].join('\n')
    }
  ];
}
