/**
 * P42 — World plate print pack → PDF via browser print.
 */

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function plateUrl(asset) {
  return String(asset?.referenceImageUrl || asset?.lockedPlate?.url || '').trim();
}

function activePlatePrompt(asset) {
  if (asset?.promptSource === 'writer_custom' && String(asset?.promptCustom || '').trim()) {
    return String(asset.promptCustom).trim();
  }
  return String(asset?.promptAuto || asset?.description || '').trim();
}

function safeImg(url, alt) {
  const src = String(url || '').trim();
  if (!src) return '<div class="empty">No plate</div>';
  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" />`;
}

/**
 * Print-ready HTML for world location plates + prompts.
 * @param {object[]} assets
 * @param {string} [projectTitle]
 */
export function worldPlatesToPrintHtml(assets = [], projectTitle = 'Project', { roomId = '' } = {}) {
  const title = escapeHtml(projectTitle || 'Project');
  const list = (Array.isArray(assets) ? assets : []).filter(Boolean);

  const sections = list
    .map((a, idx) => {
      const name = escapeHtml(a.name || `World ${idx + 1}`);
      const tag = escapeHtml(a.tag || '');
      const type = escapeHtml(a.type || 'location');
      const life = escapeHtml(a.lifecycleStatus || 'draft');
      const url = plateUrl(a);
      const prompt = escapeHtml(activePlatePrompt(a));
      const meta = [
        a.weather && `Weather: ${a.weather}`,
        a.timeOfDay && `Time: ${a.timeOfDay}`,
        a.materials && `Materials: ${a.materials}`,
        a.lightingNotes && `Lighting: ${a.lightingNotes}`
      ]
        .filter(Boolean)
        .map((line) => escapeHtml(line))
        .join(' · ');

      return `<section class="asset">
        <h2>${idx + 1}. ${name}${tag ? ` <span class="tag">${tag}</span>` : ''}</h2>
        <p class="meta">${type} · ${life}${meta ? ` · ${meta}` : ''}</p>
        <div class="plate">${safeImg(url, `${name} plate`)}</div>
        <pre>${prompt || '—'}</pre>
      </section>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title} — World plates</title>
  <style>
    @page { size: letter; margin: 0.5in; }
    body { font-family: system-ui, sans-serif; font-size: 9pt; color: #111; margin: 0; padding: 14px; line-height: 1.35; }
    h1 { font-size: 13pt; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.08em; }
    .doc-meta { color: #555; margin-bottom: 14px; font-size: 9pt; }
    .asset { page-break-inside: avoid; margin-bottom: 16px; border-top: 1px solid #ddd; padding-top: 12px; }
    .asset:first-of-type { border-top: none; padding-top: 0; }
    h2 { font-size: 11pt; margin: 0 0 4px; }
    .tag { font-weight: normal; color: #666; font-size: 9pt; font-family: ui-monospace, monospace; }
    .meta { color: #666; margin: 0 0 8px; font-size: 8pt; }
    .plate { margin-bottom: 8px; }
    img { max-width: 100%; max-height: 3.6in; display: block; border: 1px solid #ccc; background: #111; object-fit: contain; }
    .empty { height: 2in; display: flex; align-items: center; justify-content: center; border: 1px dashed #ccc; color: #888; font-size: 8pt; }
    pre { margin: 0; white-space: pre-wrap; word-break: break-word; font-family: ui-monospace, monospace; font-size: 8pt; background: #fafafa; border: 1px solid #e5e5e5; padding: 8px; border-radius: 4px; }
    @media print { body { padding: 0; } pre { background: #fff; } }
  </style>
</head>
<body>
  <h1>${title} — World plate pack</h1>
  <p class="doc-meta">${list.length} asset${list.length === 1 ? '' : 's'}${String(roomId || '').trim() ? ` · Room ${escapeHtml(String(roomId).trim())}` : ''} · ${escapeHtml(new Date().toISOString())}</p>
  ${sections || '<p>No world assets.</p>'}
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;
}

function csvEscape(v) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

/** Craft CSV for world asset roster. */
export function worldBibleToCsv(assets = [], projectTitle = '') {
  const headers = [
    '#',
    'Name',
    'Tag',
    'Type',
    'Lifecycle',
    'Weather',
    'Time',
    'Materials',
    'PlateLocked',
    'Prompt',
    'Project'
  ];
  const list = (Array.isArray(assets) ? assets : []).filter(Boolean);
  const rows = list.map((a, i) =>
    [
      i + 1,
      a?.name || '',
      a?.tag || '',
      a?.type || 'location',
      a?.lifecycleStatus || 'draft',
      a?.weather || '',
      a?.timeOfDay || '',
      a?.materials || '',
      plateUrl(a) ? 'yes' : 'no',
      activePlatePrompt(a).slice(0, 200),
      projectTitle || ''
    ]
      .map(csvEscape)
      .join(',')
  );
  return [headers.map(csvEscape).join(','), ...rows].join('\n');
}

/** Markdown roster for ZIP README. */
export function worldBibleToMarkdown(assets = [], projectTitle = '') {
  const list = (Array.isArray(assets) ? assets : []).filter(Boolean);
  const lines = [
    `# ${projectTitle || 'Project'} — World bible`,
    '',
    `${list.length} asset${list.length === 1 ? '' : 's'}`,
    ''
  ];
  list.forEach((a, i) => {
    lines.push(`## ${i + 1}. ${a.name || `World ${i + 1}`}${a.tag ? ` (${a.tag})` : ''}`);
    lines.push(`Type: ${a.type || 'location'} · Lifecycle: ${a.lifecycleStatus || 'draft'}`);
    if (a.weather) lines.push(`Weather: ${a.weather}`);
    if (a.timeOfDay) lines.push(`Time: ${a.timeOfDay}`);
    if (a.materials) lines.push(`Materials: ${a.materials}`);
    if (a.lightingNotes) lines.push(`Lighting: ${a.lightingNotes}`);
    lines.push(`Plate: ${plateUrl(a) ? 'locked' : '—'}`);
    const prompt = activePlatePrompt(a);
    if (prompt) lines.push('', prompt);
    lines.push('');
  });
  lines.push(`Exported: ${new Date().toISOString()}`);
  return lines.join('\n');
}

/** ZIP pack: README + assets CSV + META. */
export function buildWorldBibleZipFiles(assets = [], projectTitle = '', { roomId = '' } = {}) {
  const list = (Array.isArray(assets) ? assets : []).filter(Boolean);
  const title = projectTitle || 'project';
  const plated = list.filter((a) => plateUrl(a)).length;
  return [
    { name: 'README.md', content: worldBibleToMarkdown(list, title) },
    { name: 'world.csv', content: worldBibleToCsv(list, title) },
    {
      name: 'META.txt',
      content: [
        `Project: ${title}`,
        `Assets: ${list.length}`,
        `Plates locked: ${plated}`,
        `Room: ${String(roomId || '').trim() || '—'}`,
        `Exported: ${new Date().toISOString()}`
      ].join('\n')
    }
  ];
}
