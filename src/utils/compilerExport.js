/**
 * P40 — Prompt Compiler print pack → PDF via browser print.
 */

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Print-ready HTML for compiled shot prompts (one section per shot).
 * @param {{ projectTitle?: string, formatLabel?: string, shots?: Array<{ id?: string, filename?: string, promptText?: string }> }} opts
 */
export function compilerPromptsToPrintHtml({
  projectTitle = 'Project',
  formatLabel = 'Video prompt',
  shots = []
} = {}) {
  const title = escapeHtml(projectTitle || 'Project');
  const format = escapeHtml(formatLabel || 'Prompt');
  const list = Array.isArray(shots) ? shots.filter(Boolean) : [];

  const sections = list
    .map((row, idx) => {
      const id = escapeHtml(row.id || row.filename || `Shot ${idx + 1}`);
      const file = row.filename ? escapeHtml(row.filename) : '';
      const body = escapeHtml(String(row.promptText || '').trim());
      return `<section class="shot">
        <h2>${idx + 1}. ${id}${file ? ` <span class="file">(${file})</span>` : ''}</h2>
        <pre>${body || '—'}</pre>
      </section>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title} — Compiler</title>
  <style>
    @page { size: letter; margin: 0.55in; }
    body { font-family: system-ui, sans-serif; font-size: 9pt; color: #111; margin: 0; padding: 14px; line-height: 1.35; }
    h1 { font-size: 13pt; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.08em; }
    .meta { color: #555; margin-bottom: 14px; font-size: 9pt; }
    .shot { page-break-inside: avoid; margin-bottom: 14px; border-top: 1px solid #ddd; padding-top: 10px; }
    .shot:first-of-type { border-top: none; padding-top: 0; }
    h2 { font-size: 10pt; margin: 0 0 6px; }
    .file { font-weight: normal; color: #666; font-size: 8pt; font-family: ui-monospace, monospace; }
    pre { margin: 0; white-space: pre-wrap; word-break: break-word; font-family: ui-monospace, monospace; font-size: 8pt; background: #fafafa; border: 1px solid #e5e5e5; padding: 8px; border-radius: 4px; }
    @media print { body { padding: 0; } pre { background: #fff; } }
  </style>
</head>
<body>
  <h1>${title} — Compiler print pack</h1>
  <p class="meta">${list.length} shots · ${format} · ${escapeHtml(new Date().toISOString())}</p>
  ${sections || '<p>No shots to print.</p>'}
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;
}
