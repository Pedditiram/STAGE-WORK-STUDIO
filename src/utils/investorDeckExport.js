/**
 * P21 — Investor deck outline export (product showcase slides → markdown).
 */

import { PRODUCT } from '../constants/brand';

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function investorDeckToMarkdown(slides = [], { projectTitle = '' } = {}) {
  const list = Array.isArray(slides) ? slides : [];
  const title = String(projectTitle || '').trim();
  const lines = [
    `# ${PRODUCT} — Investor Deck Outline`,
    '',
    title ? `Active slate context: **${title}**` : 'Studio showcase · guest-safe product narrative',
    '',
    '---',
    ''
  ];
  list.forEach((slide, i) => {
    lines.push(`## ${i + 1}. ${slide.title || slide.id || 'Slide'}`);
    if (slide.eyebrow) lines.push(`*${slide.eyebrow}*`);
    if (slide.badge) lines.push(`**${slide.badge}**`);
    if (slide.subtitle) lines.push('', slide.subtitle);
    if (Array.isArray(slide.points) && slide.points.length) {
      lines.push('');
      slide.points.forEach((p) => lines.push(`- ${p}`));
    }
    if (slide.highlight) {
      lines.push('');
      lines.push(`> ${slide.highlight}`);
    }
    lines.push('');
  });
  lines.push('---', '', `Generated ${new Date().toISOString()}`);
  return lines.join('\n');
}

/** Print-ready HTML for investor deck PDF (browser print dialog). */
export function investorDeckToPrintHtml(slides = [], { projectTitle = '', roomId = '' } = {}) {
  const list = Array.isArray(slides) ? slides : [];
  const title = String(projectTitle || '').trim();
  const panels = list
    .map((slide, i) => {
      const points = (slide.points || [])
        .map((p) => `<li>${escapeHtml(p)}</li>`)
        .join('');
      return `
        <section class="slide">
          <p class="eyebrow">${escapeHtml(slide.eyebrow || slide.badge || `Slide ${i + 1}`)}</p>
          <h2>${escapeHtml(slide.title || slide.id || `Slide ${i + 1}`)}</h2>
          ${slide.subtitle ? `<p class="subtitle">${escapeHtml(slide.subtitle)}</p>` : ''}
          ${points ? `<ul>${points}</ul>` : ''}
          ${slide.highlight ? `<blockquote>${escapeHtml(slide.highlight)}</blockquote>` : ''}
        </section>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(PRODUCT)} — Investor Deck</title>
  <style>
    @page { size: letter; margin: 0.65in; }
    body { font-family: system-ui, sans-serif; font-size: 11pt; color: #111; margin: 0; padding: 20px; line-height: 1.45; }
    h1 { font-size: 16pt; margin: 0 0 6px; letter-spacing: 0.06em; text-transform: uppercase; }
    .ctx { font-size: 10pt; color: #555; margin-bottom: 20px; }
    .slide { page-break-inside: avoid; margin-bottom: 22px; padding-bottom: 16px; border-bottom: 1px solid #ddd; }
    .eyebrow { font-size: 9pt; text-transform: uppercase; letter-spacing: 0.14em; color: #8b5a2b; margin: 0 0 6px; font-weight: 700; }
    h2 { font-size: 14pt; margin: 0 0 8px; }
    .subtitle { font-size: 11pt; color: #333; margin: 0 0 10px; }
    ul { margin: 0; padding-left: 1.2em; }
    li { margin-bottom: 4px; }
    blockquote { margin: 10px 0 0; padding: 8px 12px; background: #faf6f0; border-left: 3px solid #8b5a2b; font-size: 10pt; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(PRODUCT)} — Investor Deck</h1>
  <p class="ctx">${title ? escapeHtml(`Active slate: ${title}`) : 'Studio showcase · product narrative'}${String(roomId || '').trim() ? escapeHtml(` · Room ${String(roomId).trim()}`) : ''}</p>
  ${panels}
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;
}

/** Craft CSV for investor deck slide outline (Campaign/Promo CSV parity). */
export function investorDeckToCsv(slides = [], { projectTitle = '' } = {}) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const headers = ['#', 'Id', 'Title', 'Eyebrow', 'Subtitle', 'Points', 'Highlight', 'Project'];
  const list = Array.isArray(slides) ? slides : [];
  const rows = list.map((slide, i) =>
    [
      i + 1,
      slide?.id || '',
      slide?.title || '',
      slide?.eyebrow || slide?.badge || '',
      slide?.subtitle || '',
      (slide?.points || []).join('; '),
      slide?.highlight || '',
      projectTitle || ''
    ]
      .map(esc)
      .join(',')
  );
  return [headers.map(esc).join(','), ...rows].join('\n');
}

/** ZIP pack: README markdown + slides CSV + META (Campaign/Promo ZIP parity). */
export function buildInvestorDeckZipFiles(slides = [], { projectTitle = '', roomId = '' } = {}) {
  const list = Array.isArray(slides) ? slides : [];
  const title = String(projectTitle || '').trim() || PRODUCT;
  const room = String(roomId || '').trim();
  return [
    {
      name: 'README.md',
      content: [
        investorDeckToMarkdown(list, { projectTitle }),
        '',
        room ? `Collab room: ${room}` : 'Collab room: —'
      ].join('\n')
    },
    {
      name: 'slides.csv',
      content: investorDeckToCsv(list, { projectTitle })
    },
    {
      name: 'META.txt',
      content: [
        `Product: ${PRODUCT}`,
        `Project: ${title}`,
        `Slides: ${list.length}`,
        `Room: ${room || '—'}`,
        `Exported: ${new Date().toISOString()}`
      ].join('\n')
    }
  ];
}
