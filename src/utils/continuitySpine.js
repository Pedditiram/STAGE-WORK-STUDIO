/**
 * Continuity spine for all-AI features:
 * locked look sheets, shot-to-shot bridge, matrix flags, reel timings.
 */

import { resolveImageUrl } from './imageBlobStore';
import { continuityStateFlagsForShot, continuityStateLines } from './continuityState';
import { getActiveCharacterProfiles, getActiveWorldAssets } from './projectBibleVault';

function profiles() {
  return getActiveCharacterProfiles() || [];
}

function worlds() {
  return getActiveWorldAssets() || [];
}

export function shotDurationSec(shot) {
  const raw = String(shot?.shotDurationAndImages || '');
  const m = raw.match(/(\d+(?:\.\d+)?)\s*s/i) || raw.match(/(\d+(?:\.\d+)?)/);
  return m ? Math.max(1, Math.round(parseFloat(m[1]))) : 5;
}

export function shotHaystack(shot) {
  return `
    ${shot?.characterIdAssetRef || ''}
    ${shot?.coArtistInteraction || ''}
    ${shot?.characterIdMatrix || ''}
    ${shot?.shotDurationAndImages || ''}
    ${shot?.actionEnvContext || ''}
    ${shot?.sceneSynopsis || ''}
  `.toLowerCase();
}

export function characterLookUrl(char) {
  if (!char) return '';
  return resolveImageUrl(
    char.lockedRefs?.face ||
    char.lockedRefs?.body ||
    char.lockedRefs?.primary ||
    ''
  );
}

export function worldPlateUrl(asset) {
  if (!asset) return '';
  if (asset.lockedPlate?.locked && asset.lockedPlate?.url) {
    return resolveImageUrl(asset.lockedPlate.url);
  }
  return resolveImageUrl(asset.referenceImageUrl || asset.lockedPlate?.url || '');
}

export function matchCharactersForShot(shot, list = profiles()) {
  const hay = shotHaystack(shot);
  if (!hay.trim()) return [];
  return (list || []).filter((char) => {
    const tag = String(char.tag || '').toLowerCase().replace(/@/g, '').trim();
    const name = String(char.name || '').toLowerCase().trim();
    if (tag && hay.includes(tag)) return true;
    if (name && name.length > 2 && hay.includes(name)) return true;
    return false;
  });
}

export function matchWorldForShot(shot, assets = worlds()) {
  const env = `${shot?.actionEnvContext || ''} ${shot?.timeAndLightingEnv || ''} ${shot?.atmosphereVolumetricsTag || ''}`.toLowerCase();
  const list = (assets || []).filter((a) => a && a.includeInPrompt !== false);
  if (!list.length) return null;
  const matched = list.filter((asset) => {
    const hay = `${asset.name || ''} ${asset.tag || ''} ${asset.description || ''}`.toLowerCase();
    const tag = String(asset.tag || '').replace(/@/g, '').toLowerCase();
    if (tag && env.includes(tag)) return true;
    const tokens = hay.split(/[^a-z0-9\u0c00-\u0c7f]+/).filter((t) => t.length >= 4);
    return tokens.some((t) => env.includes(t));
  });
  return matched[0] || (env.trim() ? list[0] : null);
}

export function lightingBucket(shot) {
  const t = `${shot?.timeAndLightingEnv || ''} ${shot?.subjectLightingTag || ''}`.toLowerCase();
  if (/night|dusk|moon|midnight|dark/.test(t)) return 'night';
  if (/dawn|morning|sunrise/.test(t)) return 'dawn';
  if (/noon|day|sun|golden hour|afternoon/.test(t)) return 'day';
  return 'unset';
}

export function prevLastFrame(shots, index) {
  if (index <= 0) return '';
  return shots[index - 1]?.embeddedImages?.last_frame || '';
}

export function applyShotBridge(shot, shots, index) {
  const from = prevLastFrame(shots, index);
  if (!from) {
    return {
      ...shot,
      bridgeFromPrev: {
        enabled: false,
        prevSceneShotId: shots[index - 1]?.sceneShotId || '',
        usePrevLastFrame: false
      }
    };
  }
  return {
    ...shot,
    embeddedImages: {
      ...(shot.embeddedImages || {}),
      first_frame: shot.embeddedImages?.first_frame || from
    },
    bridgeFromPrev: {
      enabled: true,
      prevSceneShotId: shots[index - 1]?.sceneShotId || '',
      usePrevLastFrame: true
    }
  };
}

export function continuityFlagsForShot(shot, shots, index) {
  const flags = [];
  const chars = matchCharactersForShot(shot);
  if (chars.length) {
    const unlocked = chars.filter((c) => !characterLookUrl(c));
    if (unlocked.length) {
      flags.push({
        id: 'look',
        label: `No look sheet: ${unlocked.map((c) => c.name || c.tag).join(', ')}`,
        block: true
      });
    }
  } else if (String(shot?.characterIdAssetRef || '').trim()) {
    flags.push({ id: 'cast', label: 'Cast not in bible', block: true });
  }

  const world = matchWorldForShot(shot);
  if (String(shot?.actionEnvContext || '').trim().length > 12 && world && !worldPlateUrl(world)) {
    flags.push({ id: 'world', label: `No plate: ${world.name || world.tag || 'world'}` });
  }

  if (index > 0) {
    const a = lightingBucket(shots[index - 1]);
    const b = lightingBucket(shot);
    if (a !== 'unset' && b !== 'unset' && a !== b) {
      flags.push({ id: 'light', label: `Light jump ${a} → ${b}` });
    }
    if (!prevLastFrame(shots, index)) {
      flags.push({ id: 'bridge', label: 'No last frame from previous take', block: true });
    }
  }

  if (!String(shot?.shotDurationAndImages || '').match(/\d/)) {
    flags.push({ id: 'time', label: 'No duration', block: true });
  }

  continuityStateFlagsForShot(shot, shots, index).forEach((f) => flags.push(f));

  return flags;
}

export function blockingFlags(flags = []) {
  return flags.filter((f) => f.block);
}

export function videoJobSlots(shot, shots, index) {
  const bridged = applyShotBridge(shot, shots, index);
  const slots = [];
  const start = bridged.embeddedImages?.first_frame || '';
  if (start) {
    slots.push({ role: 'Start (previous take)', url: start, stem: '01_start' });
  }
  matchCharactersForShot(shot).forEach((c) => {
    const url = characterLookUrl(c);
    if (!url) return;
    const n = String(slots.length + 1).padStart(2, '0');
    slots.push({ role: `Look · ${c.name || c.tag}`, url, stem: `${n}_look` });
  });
  const world = matchWorldForShot(shot);
  const plate = worldPlateUrl(world);
  if (plate) {
    const n = String(slots.length + 1).padStart(2, '0');
    slots.push({ role: `Place · ${world.name || world.tag}`, url, stem: `${n}_place` });
  }
  return slots.map((s, i) => ({ ...s, n: i + 1, file: `${s.stem}.jpg` }));
}

export function persistBridges(shots = []) {
  return (shots || []).map((shot, i) => {
    if (i === 0) return shot;
    if (shot.embeddedImages?.first_frame) return shot;
    const from = prevLastFrame(shots, i);
    if (!from) return shot;
    return {
      ...shot,
      embeddedImages: { ...(shot.embeddedImages || {}), first_frame: from }
    };
  });
}

export function hasTakeLastFrame(shot) {
  return Boolean(shot?.embeddedImages?.last_frame);
}

export function extFromDataUrl(url) {
  const m = String(url || '').match(/^data:image\/([a-zA-Z0-9+]+)/);
  if (!m) return 'jpg';
  const t = m[1].toLowerCase();
  if (t === 'jpeg') return 'jpg';
  return t.replace(/[^a-z0-9]/g, '').slice(0, 4) || 'jpg';
}

export function buildVideoJobPackFiles(shot, shots, index, prompt, id) {
  const slots = videoJobSlots(shot, shots, index);
  const flags = continuityFlagsForShot(shot, shots, index);
  const stem = String(id || `SH${index + 1}`).replace(/\s+/g, '_');
  const slotLines = [
    `VIDEO JOB — ${stem}`,
    'Attach stills in this order as Image 1, Image 2, … in the video model.',
    ''
  ];
  const files = [];
  slots.forEach((s) => {
    const packed = typeof s.url === 'string' && s.url.startsWith('data:');
    const ext = packed ? extFromDataUrl(s.url) : 'jpg';
    const file = `${s.stem}.${ext}`;
    slotLines.push(`Image_${s.n}  ${file}  ${s.role}${packed ? '' : '  (not packed)'}`);
    if (packed) files.push({ name: `${stem}/${file}`, content: s.url });
  });
  files.unshift({ name: `${stem}/SLOTS.txt`, content: `${slotLines.join('\n')}\n` });
  files.unshift({ name: `${stem}/PROMPT.txt`, content: prompt || '' });
  if (flags.length) {
    files.push({
      name: `${stem}/FLAGS.txt`,
      content: flags.map((f) => `${f.block ? 'BLOCK' : 'WARN'}  ${f.label}`).join('\n')
    });
  }
  return files;
}

export function bindLastFrameToNext(shots, shotIndex, imageUrl) {
  const next = [...(shots || [])];
  if (shotIndex < 0 || !next[shotIndex]) return next;
  next[shotIndex] = {
    ...next[shotIndex],
    embeddedImages: {
      ...(next[shotIndex].embeddedImages || {}),
      last_frame: imageUrl
    }
  };
  if (next[shotIndex + 1]) {
    next[shotIndex + 1] = {
      ...next[shotIndex + 1],
      embeddedImages: {
        ...(next[shotIndex + 1].embeddedImages || {}),
        first_frame: imageUrl
      }
    };
  }
  return next;
}

export function lookSheetLines(shot, shots, index) {
  if (Array.isArray(shots)) {
    return videoJobSlots(shot, shots, index).map(
      (s) => `LOOK SHEET Image_${s.n} (${s.role}): attach ${s.file} — keep identity and geography`
    );
  }
  const lines = [];
  matchCharactersForShot(shot).forEach((c, i) => {
    const url = characterLookUrl(c);
    if (url) lines.push(`LOOK SHEET Image_${i + 1} (${c.tag || c.name}): locked still — keep identity`);
  });
  const world = matchWorldForShot(shot);
  const plate = worldPlateUrl(world);
  if (plate) lines.push(`LOOK SHEET location (${world.tag || world.name}): locked plate — keep geography`);
  return lines;
}

export function bridgeLine(shot, shots, index) {
  const bridged = applyShotBridge(shot, shots, index);
  if (!bridged.bridgeFromPrev?.enabled) return '';
  return `BRIDGE: Start this take from the last frame of ${bridged.bridgeFromPrev.prevSceneShotId}. Same body, costume, and space — continue motion only.`;
}

export function reelStats(shots = []) {
  const live = (shots || []).filter((s) => !s?.isMuted && !s?.isArchived);
  const sec = live.reduce((n, s) => n + shotDurationSec(s), 0);
  return {
    count: live.length,
    sec,
    minutes: Math.max(1, Math.round(sec / 60))
  };
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Print-ready HTML for feature reel PDF (shot list + continuity status). */
export function featureReelToPrintHtml({
  projectTitle = 'Feature reel',
  live = [],
  shots = [],
  stats = {},
  roomId = ''
} = {}) {
  const title = escapeHtml(projectTitle || 'Feature reel');
  let running = 0;
  const rows = (live || [])
    .map(({ shot, index }) => {
      const id = escapeHtml(shot?.sceneShotId || `SH${index + 1}`);
      const dur = shotDurationSec(shot);
      const start = running;
      running += dur;
      const flags = continuityFlagsForShot(shot, shots, index);
      const blocked = blockingFlags(flags);
      const status = blocked.length ? 'BLOCK' : flags.length ? 'WARN' : 'OK';
      const comp = escapeHtml(shot?.shotComposition || '—');
      return `<tr>
        <td>${index + 1}</td>
        <td class="mono">${id}</td>
        <td>${start.toFixed(1)}s</td>
        <td>${dur}s</td>
        <td>${comp}</td>
        <td class="status-${status.toLowerCase()}">${status}</td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title} — Feature Reel</title>
  <style>
    @page { size: letter; margin: 0.6in; }
    body { font-family: system-ui, sans-serif; font-size: 10pt; color: #111; margin: 0; padding: 16px; line-height: 1.4; }
    h1 { font-size: 14pt; margin: 0 0 6px; text-transform: uppercase; letter-spacing: 0.08em; }
    .meta { color: #555; margin-bottom: 14px; font-size: 10pt; }
    table { width: 100%; border-collapse: collapse; font-size: 9pt; }
    th, td { border: 1px solid #ccc; padding: 5px 6px; text-align: left; }
    th { background: #f5f5f5; font-weight: 700; }
    .mono { font-family: ui-monospace, monospace; }
    .status-block { color: #b45309; font-weight: 700; }
    .status-warn { color: #92400e; }
    .status-ok { color: #047857; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>${title} — Feature Reel</h1>
  <p class="meta">${stats.count || 0} shots · ~${stats.minutes || 1} min assembled · continuity status at export${String(roomId || '').trim() ? ` · Room ${escapeHtml(String(roomId).trim())}` : ''}</p>
  <table>
    <thead>
      <tr><th>#</th><th>Shot</th><th>Start</th><th>Dur</th><th>Composition</th><th>Status</th></tr>
    </thead>
    <tbody>${rows || '<tr><td colspan="6">No live shots</td></tr>'}</tbody>
  </table>
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;
}

/** Craft CSV for feature reel shot list (Campaign/Storyboard CSV parity). */
export function featureReelToCsv({ live = [], shots = [], projectTitle = '' } = {}) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const headers = ['#', 'SceneShot', 'StartSec', 'DurationSec', 'Composition', 'Status', 'Flags', 'Project'];
  let running = 0;
  const rows = (Array.isArray(live) ? live : []).map(({ shot, index }, i) => {
    const dur = shotDurationSec(shot);
    const start = running;
    running += dur;
    const flags = continuityFlagsForShot(shot, shots, index);
    const blocked = blockingFlags(flags);
    const status = blocked.length ? 'BLOCK' : flags.length ? 'WARN' : 'OK';
    const flagLabels = flags.map((f) => f.label || f.code || '').filter(Boolean).join('; ');
    return [
      i + 1,
      shot?.sceneShotId || `SH${index + 1}`,
      start.toFixed(1),
      dur,
      shot?.shotComposition || '',
      status,
      flagLabels,
      projectTitle || ''
    ]
      .map(esc)
      .join(',');
  });
  return [headers.map(esc).join(','), ...rows].join('\n');
}

export { continuityStateLines } from './continuityState';

export function readLockedImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No file'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Read failed'));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const max = 640;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => reject(new Error('Image failed'));
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
