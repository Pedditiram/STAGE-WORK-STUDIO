/**
 * Parse ComfyUI /history JSON into SWS output refs (PDF §21 Phase 3).
 * Does not invent files — only reads completed node outputs.
 */

export function firstComfyOutputRef(outputs = {}) {
  if (!outputs || typeof outputs !== 'object') return null;
  for (const node of Object.values(outputs)) {
    if (!node || typeof node !== 'object') continue;
    const bags = [node.images, node.gifs, node.videos, node.files].filter((a) => Array.isArray(a) && a.length);
    for (const bag of bags) {
      const hit = bag.find((x) => x && (x.filename || x.name));
      if (hit) {
        return {
          filename: String(hit.filename || hit.name || ''),
          subfolder: String(hit.subfolder || ''),
          type: String(hit.type || 'output')
        };
      }
    }
  }
  return null;
}

export function pickLatestHistoryEntry(history = {}) {
  if (!history || typeof history !== 'object') return null;
  const rows = Object.entries(history).map(([promptId, entry]) => {
    const outputs = entry?.outputs || {};
    const t =
      Number(entry?.status?.messages?.find?.(() => false)) ||
      Number(entry?.timestamp) ||
      0;
    return { promptId, entry, outputs, t };
  });
  if (!rows.length) return null;
  rows.sort((a, b) => b.t - a.t);
  const withOut = rows.find((r) => firstComfyOutputRef(r.outputs));
  return withOut || rows[0];
}

export function comfyViewUrl(baseUrl, ref) {
  if (!ref?.filename) return '';
  const base = String(baseUrl || 'http://127.0.0.1:8188').replace(/\/$/, '');
  const q = new URLSearchParams({
    filename: ref.filename,
    subfolder: ref.subfolder || '',
    type: ref.type || 'output'
  });
  return `${base}/view?${q.toString()}`;
}

/** Filename from a Comfy `/view?filename=` URL (or last path segment). */
export function filenameFromComfyViewUrl(url = '') {
  const raw = String(url || '').trim();
  if (!raw) return '';
  try {
    const u = new URL(raw, 'http://127.0.0.1');
    const q = u.searchParams.get('filename');
    if (q) return q;
    const last = u.pathname.split('/').filter(Boolean).pop();
    return last || '';
  } catch {
    const m = raw.match(/[?&]filename=([^&]+)/i);
    if (m) return decodeURIComponent(m[1]);
    return raw.split(/[/\\]/).filter(Boolean).pop() || '';
  }
}
