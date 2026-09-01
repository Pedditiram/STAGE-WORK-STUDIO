/**
 * 2-hour feature budget — picture, AI gen, cloud, app, people, finish.
 * Amounts are assumptions until marked CONFIRMED. Never invent box office.
 */

const SAVE_KEY = 'sps_film_budget_estimates_v1';

export const BUDGET_STATUSES = ['CONFIRMED', 'ESTIMATED', 'ASSUMPTION', 'TARGET', 'DATA REQUIRED'];

export const BUDGET_GROUPS = [
  { id: 'all', label: 'All' },
  { id: 'picture', label: 'Picture' },
  { id: 'ai', label: 'AI generation' },
  { id: 'cloud', label: 'Cloud & host' },
  { id: 'app', label: 'App & studio' },
  { id: 'people', label: 'People' },
  { id: 'finish', label: 'Finish & release' }
];

export const DEFAULT_BUDGET_LINES = [
  { id: 'story', group: 'picture', dept: 'Story', label: 'Story, screenplay, rights', amount: 0, status: 'DATA REQUIRED', notes: '' },
  { id: 'cast', group: 'picture', dept: 'Cast', label: 'Lead & supporting (fees / buyouts)', amount: 0, status: 'DATA REQUIRED', notes: '' },
  { id: 'direction', group: 'picture', dept: 'Direction', label: 'Director & AD unit', amount: 0, status: 'DATA REQUIRED', notes: '' },
  { id: 'production', group: 'picture', dept: 'Production', label: 'Unit, locations, set ops, extras', amount: 0, status: 'ASSUMPTION', notes: '' },
  { id: 'art', group: 'picture', dept: 'Art', label: 'Production design, costume, makeup', amount: 0, status: 'ASSUMPTION', notes: '' },
  { id: 'camera', group: 'picture', dept: 'Camera', label: 'Live-action camera / grip / light (if any)', amount: 0, status: 'ASSUMPTION', notes: '' },
  { id: 'sound_prod', group: 'picture', dept: 'Sound', label: 'Production sound / ADR sessions', amount: 0, status: 'ASSUMPTION', notes: '' },
  { id: 'music', group: 'picture', dept: 'Music', label: 'Score, songs, licenses', amount: 0, status: 'ASSUMPTION', notes: '' },

  { id: 'seedance', group: 'ai', dept: 'Video gen', label: 'Seedance 2.5 — feature shots (~150 min, regen)', amount: 0, status: 'ASSUMPTION', notes: 'BytePlus / Seedance 2.5 video. Regen is the killer — prove look before mass gen.' },
  { id: 'seedance_promo', group: 'ai', dept: 'Video gen', label: 'Seedance 2.5 — trailer / teaser / reels', amount: 0, status: 'ASSUMPTION', notes: '' },
  { id: 'gpt_image', group: 'ai', dept: 'Image gen', label: 'GPT image — keyframes, plates, portraits', amount: 0, status: 'ASSUMPTION', notes: 'OpenAI image models for Frame 0 / Frame 120 / bible art.' },
  { id: 'llm_intel', group: 'ai', dept: 'Intelligence', label: 'LLM — breakdown, compile, writer, brain', amount: 0, status: 'ASSUMPTION', notes: '' },
  { id: 'other_video', group: 'ai', dept: 'Video gen', label: 'Other video models (Kling / Runway / Veo / Sora)', amount: 0, status: 'ASSUMPTION', notes: 'Optional hybrid.' },
  { id: 'upscale', group: 'ai', dept: 'Finish AI', label: 'Upscale / Magnific / restore', amount: 0, status: 'ASSUMPTION', notes: '' },

  { id: 'vercel_host', group: 'cloud', dept: 'Hosting', label: 'Vercel — website / Stage Work Studio production host', amount: 0, status: 'ASSUMPTION', notes: 'Pro seat + usage. Not for 150 min masters.' },
  { id: 'vercel_blob', group: 'cloud', dept: 'Storage', label: 'Vercel Blob — app assets, stills, prompt packs', amount: 0, status: 'ASSUMPTION', notes: 'Park cinema renders on R2/S3/NAS, not Blob alone.' },
  { id: 'object_store', group: 'cloud', dept: 'Storage', label: 'Object storage — video masters (R2 / S3 / Drive / NAS)', amount: 0, status: 'ASSUMPTION', notes: '' },
  { id: 'database', group: 'cloud', dept: 'Database', label: 'Database — rooms, sync, OTP, collaborators', amount: 0, status: 'ASSUMPTION', notes: 'Neon / Postgres / KV as wired.' },
  { id: 'domain_cdn', group: 'cloud', dept: 'Hosting', label: 'Domain, DNS, CDN, SSL, email', amount: 0, status: 'ASSUMPTION', notes: '' },
  { id: 'backup', group: 'cloud', dept: 'Storage', label: 'Backups & version vaults', amount: 0, status: 'ASSUMPTION', notes: '' },

  { id: 'cursor', group: 'app', dept: 'Engineering', label: 'Cursor — seats & agents (app maintenance)', amount: 0, status: 'ASSUMPTION', notes: '' },
  { id: 'github', group: 'app', dept: 'Engineering', label: 'GitHub — source, CI, reviews', amount: 0, status: 'ASSUMPTION', notes: '' },
  { id: 'app_maint', group: 'app', dept: 'Engineering', label: 'App maintenance — bugs, deploys, Electron builds', amount: 0, status: 'ASSUMPTION', notes: '' },
  { id: 'api_keys', group: 'app', dept: 'Engineering', label: 'API keys & model overage (studio OS)', amount: 0, status: 'ASSUMPTION', notes: '' },
  { id: 'legal_soft', group: 'app', dept: 'Legal', label: 'Software licenses, ToS, privacy, DPA', amount: 0, status: 'ASSUMPTION', notes: '' },

  { id: 'emp_director', group: 'people', dept: 'Payroll', label: 'Director / showrunner (project term)', amount: 0, status: 'DATA REQUIRED', notes: '' },
  { id: 'emp_producer', group: 'people', dept: 'Payroll', label: 'Producer / line producer', amount: 0, status: 'DATA REQUIRED', notes: '' },
  { id: 'emp_writer', group: 'people', dept: 'Payroll', label: 'Writer(s)', amount: 0, status: 'DATA REQUIRED', notes: '' },
  { id: 'emp_craft', group: 'people', dept: 'Payroll', label: 'Craft leads (DOP, art, edit, sound, VFX)', amount: 0, status: 'DATA REQUIRED', notes: '' },
  { id: 'emp_ai', group: 'people', dept: 'Payroll', label: 'AI / pipeline operators', amount: 0, status: 'ASSUMPTION', notes: '' },
  { id: 'emp_eng', group: 'people', dept: 'Payroll', label: 'Engineer maintaining Stage Work Studio on this film', amount: 0, status: 'ASSUMPTION', notes: '' },
  { id: 'emp_pa', group: 'people', dept: 'Payroll', label: 'PAs, coordinators, accounting', amount: 0, status: 'ASSUMPTION', notes: '' },
  { id: 'contractors', group: 'people', dept: 'Payroll', label: 'Contractors / vendors (not on payroll)', amount: 0, status: 'ASSUMPTION', notes: '' },

  { id: 'vfx_finish', group: 'finish', dept: 'Post', label: 'VFX, comp, cleanup beyond gen', amount: 0, status: 'ASSUMPTION', notes: '' },
  { id: 'edit_di', group: 'finish', dept: 'Post', label: 'Edit, grade, mix, deliverables', amount: 0, status: 'ASSUMPTION', notes: '' },
  { id: 'marketing', group: 'finish', dept: 'Release', label: 'P&A, promo, festivals', amount: 0, status: 'ASSUMPTION', notes: '' },
  { id: 'distribution', group: 'finish', dept: 'Release', label: 'Distribution, QC, localization, DCP', amount: 0, status: 'ASSUMPTION', notes: '' },
  { id: 'insurance', group: 'finish', dept: 'Release', label: 'Insurance, E&O, legal, completion', amount: 0, status: 'ASSUMPTION', notes: '' },
  { id: 'contingency', group: 'finish', dept: 'Contingency', label: 'Contingency (regen + overages)', amount: 0, status: 'ASSUMPTION', notes: 'Plan 20–25% on AI-heavy pictures.' }
];

function cloneLines() {
  return DEFAULT_BUDGET_LINES.map((r) => ({ ...r }));
}

export function mergeBudgetLines(existing) {
  const have = new Map((existing || []).map((r) => [r.id, r]));
  const merged = DEFAULT_BUDGET_LINES.map((def) => {
    const hit = have.get(def.id);
    if (!hit) return { ...def };
    have.delete(def.id);
    return { ...def, ...hit, group: hit.group || def.group, dept: hit.dept || def.dept };
  });
  have.forEach((extra) => merged.push(extra));
  return merged;
}

export function emptyBudget(projectTitle = 'Untitled Feature') {
  return {
    kind: 'film-budget',
    runtime: '2h',
    projectTitle,
    currency: 'INR',
    unit: 'Cr',
    audience: 'producer',
    lines: cloneLines(),
    ask: '',
    notes: 'Planning envelope for a ~2 hour feature. Fill amounts. Mark CONFIRMED only when quoted.',
    updatedAt: Date.now()
  };
}

export function parseAmount(v) {
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function sumBudget(lines) {
  return (lines || []).reduce((a, r) => a + parseAmount(r.amount), 0);
}

export function rollupByDept(lines) {
  const map = new Map();
  (lines || []).forEach((r) => {
    const key = r.dept || 'Other';
    const prev = map.get(key) || { dept: key, amount: 0 };
    prev.amount += parseAmount(r.amount);
    map.set(key, prev);
  });
  return [...map.values()];
}

export function rollupByGroup(lines) {
  const map = new Map();
  (lines || []).forEach((r) => {
    const key = r.group || 'other';
    const prev = map.get(key) || { group: key, amount: 0 };
    prev.amount += parseAmount(r.amount);
    map.set(key, prev);
  });
  return [...map.values()];
}

export function formatMoney(n, currency = 'INR', unit = 'Cr') {
  const v = parseAmount(n);
  const body = v.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  if (currency === 'INR') return `₹ ${body} ${unit}`;
  return `${currency} ${body} ${unit}`;
}

export function loadBudget(projectTitle) {
  const blank = emptyBudget(projectTitle);
  if (typeof window === 'undefined') return blank;
  try {
    const all = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
    const hit = all[projectTitle];
    if (hit && Array.isArray(hit.lines)) {
      return { ...blank, ...hit, lines: mergeBudgetLines(hit.lines), projectTitle };
    }
  } catch {
    /* ignore */
  }
  return blank;
}

export function saveBudget(projectTitle, budget) {
  if (typeof window === 'undefined') return null;
  const next = { ...budget, projectTitle, runtime: '2h', updatedAt: Date.now() };
  try {
    const all = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
    all[projectTitle] = next;
    localStorage.setItem(SAVE_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
  return next;
}

export function budgetToMarkdown(budget) {
  const total = sumBudget(budget.lines);
  const rows = (budget.lines || [])
    .map(
      (r) =>
        `| ${r.group || ''} | ${r.dept} | ${r.label} | ${formatMoney(r.amount, budget.currency, budget.unit)} | ${r.status} |`
    )
    .join('\n');
  return `# Budget estimate — ${budget.projectTitle}

Runtime envelope: ~2 hours
Currency: ${budget.currency} (${budget.unit})
Total: ${formatMoney(total, budget.currency, budget.unit)}
Ask: ${budget.ask || 'DATA REQUIRED'}

| Group | Department | Line | Amount | Status |
|---|---|---|---|---|
${rows}

Notes: ${budget.notes || '—'}

All figures are estimates or assumptions unless marked CONFIRMED. Not a box-office forecast. Re-check live Seedance / GPT / Vercel pricing before POs.
`;
}

export function budgetToCsv(budget) {
  const head = 'Group,Department,Line,Amount,Status,Notes';
  const body = (budget.lines || [])
    .map((r) =>
      [r.group, r.dept, r.label, parseAmount(r.amount), r.status, r.notes || '']
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(',')
    )
    .join('\n');
  return `${head}\n${body}\n`;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Print-ready HTML for budget PDF export. */
export function budgetToPrintHtml(budget, { roomId = '' } = {}) {
  const b = budget || {};
  const total = sumBudget(b.lines);
  const title = escapeHtml(b.projectTitle || 'Budget');
  const rows = (b.lines || [])
    .map(
      (r) => `<tr>
        <td>${escapeHtml(r.group || '')}</td>
        <td>${escapeHtml(r.dept || '')}</td>
        <td>${escapeHtml(r.label || '')}</td>
        <td class="num">${escapeHtml(formatMoney(r.amount, b.currency, b.unit))}</td>
        <td>${escapeHtml(r.status || '')}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title} — Budget</title>
  <style>
    @page { size: letter landscape; margin: 0.5in; }
    body { font-family: system-ui, sans-serif; font-size: 9pt; color: #111; margin: 0; padding: 14px; line-height: 1.35; }
    h1 { font-size: 13pt; margin: 0 0 6px; text-transform: uppercase; letter-spacing: 0.08em; }
    .meta { color: #555; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; vertical-align: top; }
    th { background: #f5f5f5; font-weight: 700; font-size: 8pt; text-transform: uppercase; }
    .num { font-family: ui-monospace, monospace; white-space: nowrap; }
    .foot { margin-top: 10px; font-size: 8pt; color: #666; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>${title} — Budget estimate</h1>
  <p class="meta">
    Runtime ~2 hours · ${escapeHtml(b.currency || 'INR')} (${escapeHtml(b.unit || 'Cr')}) ·
    Total <strong>${escapeHtml(formatMoney(total, b.currency, b.unit))}</strong> ·
    Ask: ${escapeHtml(b.ask || 'DATA REQUIRED')}${String(roomId || '').trim() ? ` · Room ${escapeHtml(String(roomId).trim())}` : ''}
  </p>
  <table>
    <thead>
      <tr><th>Group</th><th>Dept</th><th>Line</th><th>Amount</th><th>Status</th></tr>
    </thead>
    <tbody>${rows || '<tr><td colspan="5">No lines</td></tr>'}</tbody>
  </table>
  <p class="foot">${escapeHtml(b.notes || 'All figures are estimates or assumptions unless marked CONFIRMED. Not a box-office forecast.')}</p>
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;
}

/** ZIP pack: README markdown + lines CSV + META (Campaign/Promo ZIP parity). */
export function buildBudgetZipFiles(budget, { audience, roomId = '' } = {}) {
  const b = budget || {};
  const title = b.projectTitle || 'budget';
  const total = sumBudget(b.lines);
  const mdBudget = audience ? { ...b, audience } : b;
  return [
    {
      name: 'README.md',
      content: budgetToMarkdown(mdBudget)
    },
    {
      name: 'lines.csv',
      content: budgetToCsv(b)
    },
    {
      name: 'META.txt',
      content: [
        `Project: ${title}`,
        `Audience: ${audience || b.audience || 'producer'}`,
        `Currency: ${b.currency || 'INR'} (${b.unit || 'Cr'})`,
        `Lines: ${(b.lines || []).length}`,
        `Total: ${formatMoney(total, b.currency, b.unit)}`,
        `Ask: ${b.ask || 'DATA REQUIRED'}`,
        `Room: ${String(roomId || '').trim() || '—'}`,
        `Exported: ${new Date().toISOString()}`
      ].join('\n')
    }
  ];
}
