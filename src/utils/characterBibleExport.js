/**
 * P42 — Character look-sheet print pack → PDF via browser print.
 */

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function safeImg(url, alt) {
  const src = String(url || '').trim();
  if (!src) return '<div class="empty">No still</div>';
  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" />`;
}

/**
 * Print-ready HTML for cast look sheets (face + body + wardrobe).
 * @param {object[]} characters
 * @param {string} [projectTitle]
 */
export function characterLookSheetsToPrintHtml(characters = [], projectTitle = 'Project', { roomId = '' } = {}) {
  const title = escapeHtml(projectTitle || 'Project');
  const list = (Array.isArray(characters) ? characters : []).filter(Boolean);

  const sections = list
    .map((c, idx) => {
      const name = escapeHtml(c.name || `Character ${idx + 1}`);
      const tag = escapeHtml(c.tag || '');
      const life = escapeHtml(c.lifecycleStatus || 'draft');
      const face = c.lockedRefs?.face || '';
      const body = c.lockedRefs?.body || '';
      const wardrobe = [
        c.outfit && `Outfit: ${c.outfit}`,
        c.wardrobeElements && `Elements: ${c.wardrobeElements}`,
        c.accessories && `Accessories: ${c.accessories}`,
        c.colorPalette && `Palette: ${c.colorPalette}`,
        c.costumeDetails && `Details: ${c.costumeDetails}`
      ]
        .filter(Boolean)
        .map((line) => escapeHtml(line))
        .join('<br/>');

      return `<section class="char">
        <h2>${idx + 1}. ${name}${tag ? ` <span class="tag">${tag}</span>` : ''}</h2>
        <p class="meta">Lifecycle · ${life}</p>
        <div class="looks">
          <figure>
            <figcaption>Face</figcaption>
            ${safeImg(face, `${name} face`)}
          </figure>
          <figure>
            <figcaption>Body</figcaption>
            ${safeImg(body, `${name} body`)}
          </figure>
        </div>
        ${wardrobe ? `<p class="wardrobe">${wardrobe}</p>` : '<p class="wardrobe muted">No wardrobe notes</p>'}
      </section>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title} — Character look sheets</title>
  <style>
    @page { size: letter; margin: 0.5in; }
    body { font-family: system-ui, sans-serif; font-size: 9pt; color: #111; margin: 0; padding: 14px; line-height: 1.35; }
    h1 { font-size: 13pt; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.08em; }
    .doc-meta { color: #555; margin-bottom: 14px; font-size: 9pt; }
    .char { page-break-inside: avoid; margin-bottom: 16px; border-top: 1px solid #ddd; padding-top: 12px; }
    .char:first-of-type { border-top: none; padding-top: 0; }
    h2 { font-size: 11pt; margin: 0 0 4px; }
    .tag { font-weight: normal; color: #666; font-size: 9pt; font-family: ui-monospace, monospace; }
    .meta { color: #666; margin: 0 0 8px; font-size: 8pt; }
    .looks { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 8px; }
    figure { margin: 0; }
    figcaption { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.06em; color: #555; margin-bottom: 4px; }
    img { width: 100%; max-height: 3.2in; object-fit: cover; display: block; border: 1px solid #ccc; background: #f0f0f0; }
    .empty { height: 2.2in; display: flex; align-items: center; justify-content: center; border: 1px dashed #ccc; color: #888; font-size: 8pt; }
    .wardrobe { margin: 0; white-space: pre-wrap; word-break: break-word; }
    .wardrobe.muted { color: #888; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>${title} — Character look sheets</h1>
  <p class="doc-meta">${list.length} character${list.length === 1 ? '' : 's'}${String(roomId || '').trim() ? ` · Room ${escapeHtml(String(roomId).trim())}` : ''} · ${escapeHtml(new Date().toISOString())}</p>
  ${sections || '<p>No characters in roster.</p>'}
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;
}

function csvEscape(v) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

/** Craft CSV for cast roster (Campaign/Story package CSV parity). */
export function characterBibleToCsv(characters = [], projectTitle = '') {
  const headers = [
    '#',
    'Name',
    'Tag',
    'Lifecycle',
    'Outfit',
    'Elements',
    'Accessories',
    'Palette',
    'FaceLocked',
    'BodyLocked',
    'Project'
  ];
  const list = (Array.isArray(characters) ? characters : []).filter(Boolean);
  const rows = list.map((c, i) =>
    [
      i + 1,
      c?.name || '',
      c?.tag || '',
      c?.lifecycleStatus || 'draft',
      c?.outfit || '',
      c?.wardrobeElements || '',
      c?.accessories || '',
      c?.colorPalette || '',
      c?.lockedRefs?.face ? 'yes' : 'no',
      c?.lockedRefs?.body ? 'yes' : 'no',
      projectTitle || ''
    ]
      .map(csvEscape)
      .join(',')
  );
  return [headers.map(csvEscape).join(','), ...rows].join('\n');
}

/** Markdown roster for ZIP README. */
export function characterBibleToMarkdown(characters = [], projectTitle = '') {
  const list = (Array.isArray(characters) ? characters : []).filter(Boolean);
  const lines = [
    `# ${projectTitle || 'Project'} — Character bible`,
    '',
    `${list.length} character${list.length === 1 ? '' : 's'}`,
    ''
  ];
  list.forEach((c, i) => {
    lines.push(`## ${i + 1}. ${c.name || `Character ${i + 1}`}${c.tag ? ` (${c.tag})` : ''}`);
    lines.push(`Lifecycle: ${c.lifecycleStatus || 'draft'}`);
    if (c.outfit) lines.push(`Outfit: ${c.outfit}`);
    if (c.wardrobeElements) lines.push(`Elements: ${c.wardrobeElements}`);
    if (c.accessories) lines.push(`Accessories: ${c.accessories}`);
    if (c.colorPalette) lines.push(`Palette: ${c.colorPalette}`);
    if (c.costumeDetails) lines.push(`Details: ${c.costumeDetails}`);
    lines.push(
      `Looks: face ${c.lockedRefs?.face ? 'locked' : '—'} · body ${c.lockedRefs?.body ? 'locked' : '—'}`
    );
    lines.push('');
  });
  lines.push(`Exported: ${new Date().toISOString()}`);
  return lines.join('\n');
}

/** ZIP pack: README + roster CSV + META (no binary stills — print PDF for looks). */
export function buildCharacterBibleZipFiles(characters = [], projectTitle = '', { roomId = '' } = {}) {
  const list = (Array.isArray(characters) ? characters : []).filter(Boolean);
  const title = projectTitle || 'project';
  const lockedFace = list.filter((c) => c?.lockedRefs?.face).length;
  const lockedBody = list.filter((c) => c?.lockedRefs?.body).length;
  return [
    { name: 'README.md', content: characterBibleToMarkdown(list, title) },
    { name: 'cast.csv', content: characterBibleToCsv(list, title) },
    {
      name: 'META.txt',
      content: [
        `Project: ${title}`,
        `Characters: ${list.length}`,
        `Face locked: ${lockedFace}`,
        `Body locked: ${lockedBody}`,
        `Room: ${String(roomId || '').trim() || '—'}`,
        `Exported: ${new Date().toISOString()}`
      ].join('\n')
    }
  ];
}
