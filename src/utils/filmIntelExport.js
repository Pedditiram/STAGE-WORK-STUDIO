/**
 * Film Intel export — markdown + print HTML craft report.
 */

export function filmIntelToMarkdown(intel = {}) {
  const title = intel.projectTitle || 'Untitled';
  const h = intel.filmHealth || {};
  const q = intel.quality || {};
  const lines = [
    `# Film Intel — ${title}`,
    '',
    `Generated: ${intel.generatedAt || new Date().toISOString()}`,
    '',
    `## Film Health · ${h.score ?? 0} · ${h.grade || 'Draft'}`,
    '',
    '### Dimensions',
    ...(h.dimensions || []).map((d) => `- **${d.label}**: ${d.value}`),
    '',
    `### Craft fill · ${q.craftFill?.pct ?? 0}%`,
    `Filled ${q.craftFill?.filled ?? 0} / ${q.craftFill?.total ?? 0} critical crafts.`,
    '',
    '### Quality issues',
    ...((q.issues || []).length
      ? q.issues.map((i) => `- **[${i.severity}]** ${i.title} — ${i.detail}`)
      : ['- None']),
    '',
    '### Suggestions',
    ...((intel.suggestions || []).length
      ? intel.suggestions.map(
          (s) => `- **#${s.priority} [${s.severity}]** ${s.title} — ${s.detail}`
        )
      : ['- None']),
    '',
    '### Character screen time',
    ...((intel.characters || []).slice(0, 24).map(
      (c) => `- **${c.name}**: ${Math.round(c.sec || 0)}s · ${c.sharePct || 0}% · ${c.shotCount} shots`
    ).length
      ? (intel.characters || []).slice(0, 24).map(
          (c) => `- **${c.name}**: ${Math.round(c.sec || 0)}s · ${c.sharePct || 0}% · ${c.shotCount} shots`
        )
      : ['- None']),
    '',
    '### Costume looks',
    ...((intel.costumes || []).length
      ? (intel.costumes || []).slice(0, 20).map(
          (c) => `- **${c.name}**: ${c.shotCount} shots · ${(c.characters || []).join(', ') || '—'}`
        )
      : ['- None tracked']),
    '',
    '### Props',
    ...((intel.props || []).length
      ? (intel.props || []).slice(0, 20).map(
          (p) => `- **${p.name}**: ${p.shotCount} shots · ${(p.characters || []).join(', ') || '—'}`
        )
      : ['- None tracked']),
    '',
    '### Marks',
    ...((intel.marksAll || intel.marks || []).length
      ? (intel.marksAll || intel.marks || []).slice(0, 40).map(
          (m) => `- **[${m.severity}]** ${m.shotId || 'Writer'}: ${m.message}`
        )
      : ['- Clean']),
    '',
    '### Writer readiness',
    `Score ${intel.screenplay?.readiness?.score ?? 0} · ${intel.screenplay?.readiness?.grade || 'Draft'}`,
    ...((intel.screenplay?.readiness?.factors || []).map(
      (f) => `- ${f.ok ? '✓' : '○'} ${f.label}`
    )),
    '',
    '### Ready gates',
    `- **Lock**: ${intel.readiness?.lock?.ready ? 'READY' : 'NOT READY'}`,
    ...((intel.readiness?.lock?.items || []).map((i) => `  - ${i.ok ? '✓' : '○'} ${i.label}`)),
    `- **Generate**: ${intel.readiness?.generate?.ready ? 'READY' : 'NOT READY'}`,
    ...((intel.readiness?.generate?.items || []).map((i) => `  - ${i.ok ? '✓' : '○'} ${i.label}`)),
    `- **Shoot**: ${intel.readiness?.shoot?.ready ? 'READY' : 'NOT READY'}`,
    ...((intel.readiness?.shoot?.items || []).map((i) => `  - ${i.ok ? '✓' : '○'} ${i.label}`)),
    '',
    '_Film Intel gauges craft health — not artistic taste._',
    ''
  ];
  return lines.join('\n');
}

export function filmIntelToPrintHtml(intel = {}) {
  const md = filmIntelToMarkdown(intel)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const body = md
    .split('\n')
    .map((line) => {
      if (line.startsWith('# ')) return `<h1>${line.slice(2)}</h1>`;
      if (line.startsWith('## ')) return `<h2>${line.slice(3)}</h2>`;
      if (line.startsWith('### ')) return `<h3>${line.slice(4)}</h3>`;
      if (line.startsWith('- ')) return `<li>${line.slice(2)}</li>`;
      if (line.startsWith('_') && line.endsWith('_')) return `<p><em>${line.slice(1, -1)}</em></p>`;
      if (!line.trim()) return '';
      return `<p>${line}</p>`;
    })
    .join('\n');
  const title = String(intel.projectTitle || 'Film Intel').replace(/</g, '');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Film Intel — ${title}</title>
<style>
body{font-family:ui-sans-serif,system-ui,sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem;color:#1c1712;line-height:1.45}
h1{font-size:1.4rem}h2{font-size:1.1rem;margin-top:1.4rem}h3{font-size:0.95rem;margin-top:1rem}
li{margin:0.25rem 0}em{color:#6b5a45}
</style></head><body>${body}</body></html>`;
}
