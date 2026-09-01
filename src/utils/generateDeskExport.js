/**
 * P41 — Generate desk print sheet → PDF via browser print.
 */

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Print-ready HTML for one Generate desk shot (prompt + continuity + takes).
 */
export function generateDeskToPrintHtml({
  projectTitle = 'Project',
  shotId = '',
  durationSec = 0,
  engine = '',
  deskMode = 'still',
  prompt = '',
  takeSummary = {},
  flags = [],
  slots = []
} = {}) {
  const title = escapeHtml(projectTitle || 'Project');
  const id = escapeHtml(shotId || 'Shot');
  const flagRows = (Array.isArray(flags) ? flags : [])
    .map((f) => {
      const kind = f.block ? 'BLOCK' : 'WARN';
      return `<tr><td class="mono">${kind}</td><td>${escapeHtml(f.label || f.code || '')}</td></tr>`;
    })
    .join('');
  const slotList = (Array.isArray(slots) ? slots : [])
    .map((s) => {
      if (typeof s === 'string') return `<li>${escapeHtml(s)}</li>`;
      const label = s.role || s.label || s.key || s.file || '';
      return `<li>${escapeHtml(label)}</li>`;
    })
    .join('');
  const stills = Number(takeSummary.stillCount) || 0;
  const videos = Number(takeSummary.videoCount) || 0;
  const hasLast = takeSummary.hasLastFrame ? 'yes' : 'no';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title} — Generate · ${id}</title>
  <style>
    @page { size: letter; margin: 0.55in; }
    body { font-family: system-ui, sans-serif; font-size: 9pt; color: #111; margin: 0; padding: 14px; line-height: 1.35; }
    h1 { font-size: 13pt; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.08em; }
    h2 { font-size: 10pt; margin: 14px 0 6px; text-transform: uppercase; letter-spacing: 0.06em; }
    .meta { color: #555; margin-bottom: 12px; font-size: 9pt; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th, td { border: 1px solid #ddd; padding: 4px 6px; text-align: left; vertical-align: top; }
    th { background: #f5f5f5; font-size: 8pt; text-transform: uppercase; }
    .mono { font-family: ui-monospace, monospace; white-space: nowrap; }
    pre { margin: 0; white-space: pre-wrap; word-break: break-word; font-family: ui-monospace, monospace; font-size: 8pt; background: #fafafa; border: 1px solid #e5e5e5; padding: 8px; border-radius: 4px; }
    ul { margin: 0; padding-left: 1.2rem; }
    @media print { body { padding: 0; } pre { background: #fff; } }
  </style>
</head>
<body>
  <h1>${title} — Generate desk</h1>
  <p class="meta">${id} · ${escapeHtml(deskMode)} · ${Number(durationSec) || 0}s · engine ${escapeHtml(engine || '—')} · ${escapeHtml(new Date().toISOString())}</p>

  <h2>Takes</h2>
  <p class="meta">${stills} stills · ${videos} videos · last frame locked: ${hasLast}</p>

  <h2>Continuity</h2>
  <table>
    <thead><tr><th>Kind</th><th>Flag</th></tr></thead>
    <tbody>${flagRows || '<tr><td colspan="2">None</td></tr>'}</tbody>
  </table>

  <h2>Job slots</h2>
  ${slotList ? `<ul>${slotList}</ul>` : '<p class="meta">No image slots</p>'}

  <h2>Prompt</h2>
  <pre>${escapeHtml(String(prompt || '').trim()) || '—'}</pre>

  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;
}
