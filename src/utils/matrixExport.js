/**
 * P24 — Matrix shot grid → CSV for schedules / craft dumps.
 */

import { SEEDANCE_SLOTS } from '../constants/seedancePresets';
import { parseSceneAndShotID } from './sceneShotUtils';

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

/** Full Matrix craft CSV (all Seedance slots + scene/shot id). */
export function matrixShotsToCsv(shots = [], slots = SEEDANCE_SLOTS) {
  const list = (Array.isArray(shots) ? shots : []).filter((s) => s && !s.isArchived);
  const craftSlots = Array.isArray(slots) && slots.length ? slots : SEEDANCE_SLOTS;
  const headers = ['#', 'SceneShot', 'Muted', ...craftSlots.map((s) => s.label || s.key)];
  const rows = list.map((shot, idx) => {
    const id = parseSceneAndShotID(shot, idx).formattedId || shot.sceneShotId || `SH_${idx + 1}`;
    return [
      String(idx + 1),
      id,
      shot.isMuted ? 'yes' : '',
      ...craftSlots.map((s) => shot[s.key] || '')
    ].map(csvCell).join(',');
  });
  return [headers.map(csvCell).join(','), ...rows].join('\n');
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Print-ready HTML for Matrix craft table (landscape). */
export function matrixShotsToPrintHtml(shots = [], slots = SEEDANCE_SLOTS, projectTitle = 'Matrix') {
  const list = (Array.isArray(shots) ? shots : []).filter((s) => s && !s.isArchived);
  const craftSlots = Array.isArray(slots) && slots.length ? slots : SEEDANCE_SLOTS;
  // Print a compact craft set: composition + a few high-signal slots, full dump is too wide
  const printSlots = craftSlots.slice(0, 8);
  const title = escapeHtml(projectTitle || 'Matrix');

  const head = `
    <th>#</th>
    <th>Shot</th>
    <th>Mute</th>
    ${printSlots.map((s) => `<th>${escapeHtml(s.label || s.key)}</th>`).join('')}
  `;

  const body = list
    .map((shot, idx) => {
      const id = escapeHtml(
        parseSceneAndShotID(shot, idx).formattedId || shot.sceneShotId || `SH_${idx + 1}`
      );
      const cells = printSlots
        .map((s) => {
          const raw = String(shot[s.key] || '').trim();
          const clipped = raw.length > 120 ? `${raw.slice(0, 119)}…` : raw;
          return `<td>${escapeHtml(clipped)}</td>`;
        })
        .join('');
      return `<tr>
        <td>${idx + 1}</td>
        <td class="mono">${id}</td>
        <td>${shot.isMuted ? 'yes' : ''}</td>
        ${cells}
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title} — Matrix</title>
  <style>
    @page { size: letter landscape; margin: 0.45in; }
    body { font-family: system-ui, sans-serif; font-size: 8pt; color: #111; margin: 0; padding: 12px; }
    h1 { font-size: 12pt; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.08em; }
    .meta { color: #555; margin-bottom: 10px; font-size: 8pt; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid #ccc; padding: 3px 4px; text-align: left; vertical-align: top; word-break: break-word; }
    th { background: #f5f5f5; font-size: 7pt; text-transform: uppercase; }
    .mono { font-family: ui-monospace, monospace; white-space: nowrap; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>${title} — Matrix craft</h1>
  <p class="meta">${list.length} shots · showing first ${printSlots.length} of ${craftSlots.length} crafts · print layout</p>
  <table>
    <thead><tr>${head}</tr></thead>
    <tbody>${body || '<tr><td colspan="11">No shots</td></tr>'}</tbody>
  </table>
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;
}
