/**
 * Lightweight line diff for screenplay version compare.
 * Returns unified rows: equal | add | del | change
 */

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Myers-inspired O(ND) simplified via LCS DP for typical script sizes.
 * Falls back to chunked compare if huge.
 */
export function diffScreenplayLines(oldText, newText) {
  const a = String(oldText || '').split('\n');
  const b = String(newText || '').split('\n');
  const n = a.length;
  const m = b.length;

  // Cap DP for very large scripts — sample window
  if (n * m > 2_500_000) {
    return coarseDiff(a, b);
  }

  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      if (a[i] === b[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const rows = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      rows.push({ type: 'equal', oldLine: a[i], newLine: b[j], oldIdx: i + 1, newIdx: j + 1 });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({ type: 'del', oldLine: a[i], newLine: '', oldIdx: i + 1, newIdx: null });
      i += 1;
    } else {
      rows.push({ type: 'add', oldLine: '', newLine: b[j], oldIdx: null, newIdx: j + 1 });
      j += 1;
    }
  }
  while (i < n) {
    rows.push({ type: 'del', oldLine: a[i], newLine: '', oldIdx: i + 1, newIdx: null });
    i += 1;
  }
  while (j < m) {
    rows.push({ type: 'add', oldLine: '', newLine: b[j], oldIdx: null, newIdx: j + 1 });
    j += 1;
  }

  // Collapse adjacent del+add into change
  const collapsed = [];
  for (let k = 0; k < rows.length; k += 1) {
    const cur = rows[k];
    const next = rows[k + 1];
    if (cur.type === 'del' && next?.type === 'add') {
      collapsed.push({
        type: 'change',
        oldLine: cur.oldLine,
        newLine: next.newLine,
        oldIdx: cur.oldIdx,
        newIdx: next.newIdx
      });
      k += 1;
    } else {
      collapsed.push(cur);
    }
  }
  return collapsed;
}

function coarseDiff(a, b) {
  const rows = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i += 1) {
    const ol = a[i];
    const nl = b[i];
    if (ol === undefined) {
      rows.push({ type: 'add', oldLine: '', newLine: nl, oldIdx: null, newIdx: i + 1 });
    } else if (nl === undefined) {
      rows.push({ type: 'del', oldLine: ol, newLine: '', oldIdx: i + 1, newIdx: null });
    } else if (ol === nl) {
      rows.push({ type: 'equal', oldLine: ol, newLine: nl, oldIdx: i + 1, newIdx: i + 1 });
    } else {
      rows.push({ type: 'change', oldLine: ol, newLine: nl, oldIdx: i + 1, newIdx: i + 1 });
    }
  }
  return rows;
}

export function summarizeDiff(rows) {
  let add = 0;
  let del = 0;
  let change = 0;
  (rows || []).forEach((r) => {
    if (r.type === 'add') add += 1;
    else if (r.type === 'del') del += 1;
    else if (r.type === 'change') change += 1;
  });
  return { add, del, change, equal: (rows || []).filter((r) => r.type === 'equal').length };
}

export function filterChangedOnly(rows, { context = 1 } = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const keep = new Set();
  list.forEach((r, idx) => {
    if (r.type !== 'equal') {
      for (let k = Math.max(0, idx - context); k <= Math.min(list.length - 1, idx + context); k += 1) {
        keep.add(k);
      }
    }
  });
  if (!keep.size) return [];
  const out = [];
  let last = -2;
  [...keep].sort((x, y) => x - y).forEach((idx) => {
    if (last >= 0 && idx > last + 1) {
      out.push({ type: 'gap', oldLine: '···', newLine: '···', oldIdx: null, newIdx: null });
    }
    out.push(list[idx]);
    last = idx;
  });
  return out;
}

/** Build a standalone HTML document for pop-out compare window. */
export function buildDiffPopoutHtml({
  title = 'Script Compare',
  leftLabel = 'Archive / Version',
  rightLabel = 'Current',
  rows,
  changedOnly = false
}) {
  const stats = summarizeDiff(rows);
  const viewRows = changedOnly ? filterChangedOnly(rows) : rows;
  const body = (viewRows || [])
    .map((r) => {
      if (r.type === 'gap') {
        return `<tr class="gap"><td colspan="4">··· unchanged lines omitted ···</td></tr>`;
      }
      const cls = r.type;
      const o = escapeHtml(r.oldLine);
      const n = escapeHtml(r.newLine);
      const oi = r.oldIdx != null ? r.oldIdx : '';
      const ni = r.newIdx != null ? r.newIdx : '';
      return `<tr class="${cls}"><td class="ln">${oi}</td><td class="old">${o || '&nbsp;'}</td><td class="ln">${ni}</td><td class="new">${n || '&nbsp;'}</td></tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/>
<title>${escapeHtml(title)}</title>
<style>
  *{box-sizing:border-box} body{margin:0;font-family:ui-sans-serif,system-ui,sans-serif;background:#09090b;color:#e4e4e7}
  header{position:sticky;top:0;z-index:2;display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;
    padding:12px 16px;background:#18181b;border-bottom:1px solid #27272a}
  h1{font-size:14px;margin:0;letter-spacing:.04em;text-transform:uppercase}
  .stats{font-size:12px;color:#a1a1aa} .stats b{color:#fff}
  .add-c{color:#4ade80} .del-c{color:#fb7185} .chg-c{color:#fbbf24}
  table{width:100%;border-collapse:collapse;font-family:"Courier New",Courier,monospace;font-size:12px}
  th{position:sticky;top:52px;background:#14532d;color:#bbf7d0;text-align:left;padding:8px;font-size:11px}
  th.oldh{background:#7f1d1d;color:#fecaca} th.mid{background:#27272a;width:1%}
  td{padding:3px 8px;vertical-align:top;white-space:pre-wrap;border-bottom:1px solid #18181b;max-width:42vw}
  td.ln{width:40px;color:#52525b;text-align:right;user-select:none}
  tr.equal td{color:#71717a}
  tr.add td.new{background:#052e16;color:#86efac}
  tr.del td.old{background:#450a0a;color:#fda4af}
  tr.change td.old{background:#451a03;color:#fdba74}
  tr.change td.new{background:#1c1917;color:#fde68a}
  tr.gap td{text-align:center;color:#52525b;font-family:sans-serif;font-size:11px;padding:10px}
  .hint{font-size:11px;color:#71717a}
</style></head><body>
<header>
  <div>
    <h1>${escapeHtml(title)}</h1>
    <div class="hint">${escapeHtml(leftLabel)} → ${escapeHtml(rightLabel)}${changedOnly ? ' · showing changes only' : ''}</div>
  </div>
  <div class="stats">
    <b class="add-c">+${stats.add}</b> ·
    <b class="del-c">−${stats.del}</b> ·
    <b class="chg-c">~${stats.change}</b>
    · ${stats.equal} unchanged
  </div>
</header>
<table>
  <thead><tr>
    <th class="oldh" colspan="2">${escapeHtml(leftLabel)}</th>
    <th class="mid"></th>
    <th colspan="2" style="background:#14532d;color:#bbf7d0">${escapeHtml(rightLabel)}</th>
  </tr></thead>
  <tbody>${body || '<tr><td colspan="4" style="padding:24px;text-align:center;color:#71717a">No differences</td></tr>'}</tbody>
</table>
</body></html>`;
}

export function openDiffPopout(html, { name = 'sps-script-diff' } = {}) {
  const w = window.open('', name, 'noopener,noreferrer,width=1100,height=800');
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  try {
    w.focus();
  } catch (e) {}
  return true;
}
