/**
 * P44 — Director / DoP / Sound vision vault print sheet → PDF.
 */

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const FIELD_LABELS = {
  director: [
    ['corePhilosophicalIdea', 'Philosophical idea & thematic soul'],
    ['directorBeliefOfSuccess', 'Belief of success'],
    ['emotionalFrequencyTarget', 'Emotional frequency'],
    ['directorialRules', 'Directorial rules']
  ],
  dop: [
    ['lightingPhilosophy', 'Lighting & contrast'],
    ['cameraMovementEnergy', 'Camera movement'],
    ['colorScienceTexture', 'Color science & texture'],
    ['lensAspectRules', 'Lens & aspect rules']
  ],
  sound: [
    ['musicalMotifScore', 'Musical motif & score'],
    ['foleySoundEnvironment', 'Foley & environment'],
    ['vocalDialogueResonance', 'Vocal / dialogue'],
    ['rhythmTempoSync', 'Rhythm & tempo sync']
  ]
};

const STREAMS = ['human', 'ai', 'hybrid'];

/**
 * @param {object} vaultObj — normalized vault { human, ai, hybrid, … }
 * @param {{ projectTitle?: string, category?: 'director'|'dop'|'sound', activeStream?: string, roomId?: string }} opts
 */
export function directorPsychologyToPrintHtml(vaultObj = {}, opts = {}) {
  const title = escapeHtml(opts.projectTitle || 'Project');
  const category = ['dop', 'sound'].includes(opts.category) ? opts.category : 'director';
  const categoryLabel =
    category === 'dop' ? 'DoP cinematography' : category === 'sound' ? 'Sound & music' : 'Director psychology';
  const fields = FIELD_LABELS[category] || FIELD_LABELS.director;
  const active = String(opts.activeStream || vaultObj.compilerActiveMode || vaultObj.activeVisionTab || 'hybrid');
  const room = String(opts.roomId || '').trim();

  const streamSections = STREAMS.map((stream) => {
    const data = vaultObj[stream] || {};
    const blocks = fields
      .map(([key, label]) => {
        const body = escapeHtml(String(data[key] || '').trim());
        return `<div class="field">
          <h3>${escapeHtml(label)}</h3>
          <pre>${body || '—'}</pre>
        </div>`;
      })
      .join('');
    const isActive = stream === active;
    return `<section class="stream${isActive ? ' is-active' : ''}">
      <h2>${escapeHtml(stream)}${isActive ? ' · compiler active' : ''}</h2>
      ${blocks}
    </section>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title} — ${escapeHtml(categoryLabel)}</title>
  <style>
    @page { size: letter; margin: 0.5in; }
    body { font-family: system-ui, sans-serif; font-size: 9pt; color: #111; margin: 0; padding: 14px; line-height: 1.35; }
    h1 { font-size: 13pt; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.08em; }
    .meta { color: #555; margin-bottom: 12px; font-size: 9pt; }
    .stream { page-break-inside: avoid; margin-bottom: 16px; border-top: 1px solid #ddd; padding-top: 10px; }
    .stream:first-of-type { border-top: none; padding-top: 0; }
    .stream.is-active { border-left: 3px solid #b8860b; padding-left: 8px; }
    h2 { font-size: 11pt; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.06em; }
    h3 { font-size: 8pt; margin: 0 0 4px; text-transform: uppercase; color: #555; letter-spacing: 0.05em; }
    .field { margin-bottom: 8px; }
    pre { margin: 0; white-space: pre-wrap; word-break: break-word; font-family: ui-monospace, monospace; font-size: 8pt; background: #fafafa; border: 1px solid #e5e5e5; padding: 8px; border-radius: 4px; }
    @media print { body { padding: 0; } pre { background: #fff; } }
  </style>
</head>
<body>
  <h1>${title} — ${escapeHtml(categoryLabel)}</h1>
  <p class="meta">Streams: human / AI / hybrid · active ${escapeHtml(active)} · Room ${escapeHtml(room || '—')} · ${escapeHtml(new Date().toISOString())}</p>
  ${streamSections}
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;
}


/** Craft Markdown for a vision vault (Director / DoP / Sound). */
export function directorPsychologyToMarkdown(vaultObj = {}, opts = {}) {
  const title = String(opts.projectTitle || 'Project').trim() || 'Project';
  const category = ['dop', 'sound'].includes(opts.category) ? opts.category : 'director';
  const categoryLabel =
    category === 'dop' ? 'DoP cinematography' : category === 'sound' ? 'Sound & music' : 'Director psychology';
  const fields = FIELD_LABELS[category] || FIELD_LABELS.director;
  const active = String(opts.activeStream || vaultObj.compilerActiveMode || vaultObj.activeVisionTab || 'hybrid');
  const room = String(opts.roomId || '').trim();
  const lines = [
    `# ${title} — ${categoryLabel}`,
    '',
    `- Streams: human / AI / hybrid`,
    `- Active: ${active}`,
    `- Room: ${room || '—'}`,
    `- Exported: ${new Date().toISOString()}`,
    ''
  ];
  STREAMS.forEach((stream) => {
    const data = vaultObj[stream] || {};
    lines.push(`## ${stream}${stream === active ? ' · compiler active' : ''}`);
    lines.push('');
    fields.forEach(([key, label]) => {
      const body = String(data[key] || '').trim() || '—';
      lines.push(`### ${label}`);
      lines.push('');
      lines.push(body);
      lines.push('');
    });
  });
  return lines.join('\n');
}

function csvEscape(v) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

/** Craft CSV for a vision vault (Director / DoP / Sound) — stream × field rows. */
export function directorPsychologyToCsv(vaultObj = {}, opts = {}) {
  const title = String(opts.projectTitle || 'Project').trim() || 'Project';
  const category = ['dop', 'sound'].includes(opts.category) ? opts.category : 'director';
  const fields = FIELD_LABELS[category] || FIELD_LABELS.director;
  const active = String(opts.activeStream || vaultObj.compilerActiveMode || vaultObj.activeVisionTab || 'hybrid');
  const room = String(opts.roomId || '').trim();
  const headers = ['#', 'Stream', 'Field', 'Label', 'Value', 'Active', 'Category', 'Project', 'Room'];
  const rows = [];
  let n = 0;
  STREAMS.forEach((stream) => {
    const data = vaultObj[stream] || {};
    fields.forEach(([key, label]) => {
      n += 1;
      rows.push(
        [
          n,
          stream,
          key,
          label,
          String(data[key] || '').trim(),
          stream === active ? 'yes' : '',
          category,
          title,
          room
        ]
          .map(csvEscape)
          .join(',')
      );
    });
  });
  const meta = [
    `# ${title} — ${category} vision`,
    `# Active: ${active}`,
    `# Room: ${room || '—'}`,
    `# Exported: ${new Date().toISOString()}`
  ].join('\n');
  return `${meta}\n${[headers.map(csvEscape).join(','), ...rows].join('\n')}`;
}

/** ZIP pack: vision markdown + CSV + META with Room (bible ZIP parity). */
export function buildDirectorPsychologyZipFiles(vaultObj = {}, opts = {}) {
  const title = String(opts.projectTitle || 'Project').trim() || 'Project';
  const category = ['dop', 'sound'].includes(opts.category) ? opts.category : 'director';
  const categoryLabel =
    category === 'dop' ? 'dop_vision' : category === 'sound' ? 'sound_vision' : 'director_vision';
  const room = String(opts.roomId || '').trim();
  const active = String(opts.activeStream || vaultObj.compilerActiveMode || vaultObj.activeVisionTab || 'hybrid');
  const md = directorPsychologyToMarkdown(vaultObj, opts);
  const csv = directorPsychologyToCsv(vaultObj, opts);
  const fields = FIELD_LABELS[category] || FIELD_LABELS.director;
  let filled = 0;
  STREAMS.forEach((stream) => {
    const data = vaultObj[stream] || {};
    fields.forEach(([key]) => {
      if (String(data[key] || '').trim()) filled += 1;
    });
  });
  const fieldTotal = STREAMS.length * fields.length;
  return [
    { name: `${categoryLabel}.md`, content: md },
    { name: `${categoryLabel}.csv`, content: csv },
    {
      name: 'META.txt',
      content: [
        `Project: ${title}`,
        `Pack: ${categoryLabel}`,
        `Category: ${category}`,
        `Streams: human / ai / hybrid`,
        `Active stream: ${active}`,
        `Filled fields: ${filled}/${fieldTotal}`,
        `Room: ${room || '—'}`,
        `Exported: ${new Date().toISOString()}`
      ].join('\n')
    },
    {
      name: 'README.md',
      content: [
        `# ${title} — ${category} vision pack`,
        '',
        `- Vision: \`${categoryLabel}.md\``,
        `- CSV: \`${categoryLabel}.csv\``,
        `- Active stream: ${active}`,
        `- Filled fields: ${filled}/${fieldTotal}`,
        room ? `- Collab room: ${room}` : '- Collab room: —',
        '',
        'Re-import is manual — paste streams back into the Project Console vault.'
      ].join('\n')
    }
  ];
}
