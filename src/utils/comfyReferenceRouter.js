/**
 * Reference Router (PDF §5) — route Matrix refs to Seedance image_1…image_9.
 * Images stay as image inputs, never folded into prompt text.
 *
 * When `diskAssetSlots` is provided (from project assetRoots + prompt Image_N refs),
 * those absolute paths win for that slot; unused slots stay empty → Comfy subgraph bypass.
 */

import { videoJobSlots, characterLookUrl, worldPlateUrl } from './continuitySpine';

const ROLE_ORDER = [
  'character',
  'costume',
  'environment',
  'action',
  'camera',
  'supporting',
  'prop',
  'keyframe',
  'extra'
];

function isFilesystemPath(value) {
  const s = String(value || '').trim();
  if (!s) return false;
  if (s.startsWith('file://')) return true;
  if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:') || s.startsWith('idb:')) {
    return false;
  }
  return s.startsWith('/') || /^[A-Za-z]:[\\/]/.test(s) || s.startsWith('\\\\');
}

function emptySlot(n) {
  return {
    slot: n,
    input: `image_${n}`,
    url: '',
    path: '',
    localPath: '',
    role: ROLE_ORDER[n - 1] || 'extra',
    assetId: '',
    source: 'empty',
    filename: '',
    empty: true
  };
}

function applyToSlot(slots, n, data, { overwrite = false } = {}) {
  if (n < 1 || n > 9) return;
  const cur = slots[n - 1];
  if (!overwrite && (cur.path || cur.url)) return;
  const fsPath =
    [data.path, data.localPath, data.filePath, data.url].map((v) => String(v || '').trim()).find(isFilesystemPath) ||
    '';
  const u = String(data.url || data.path || data.localPath || data.filePath || '').trim();
  if (!u && !fsPath) return;
  slots[n - 1] = {
    ...cur,
    url: u || fsPath,
    path: fsPath,
    localPath: fsPath,
    role: data.role || cur.role,
    assetId: data.assetId || cur.assetId,
    source: data.source || cur.source,
    filename: data.filename || cur.filename || '',
    empty: false
  };
}

function pushIntoFirstEmpty(slots, data) {
  const fsPath =
    [data.path, data.localPath, data.filePath, data.url].map((v) => String(v || '').trim()).find(isFilesystemPath) ||
    '';
  const u = String(data.url || data.path || data.localPath || data.filePath || '').trim();
  if (!u && !fsPath) return;
  if (slots.some((s) => s.url === u || (fsPath && s.path === fsPath))) return;
  const idx = slots.findIndex((s) => s.empty);
  if (idx < 0) return;
  applyToSlot(slots, idx + 1, { ...data, url: u, path: fsPath, localPath: fsPath }, { overwrite: true });
}

/**
 * Build up to 9 reference slots for Seedance.
 * @param {object} [options]
 * @param {Array<{slot:number,path:string,role?:string,assetId?:string,filename?:string}>} [options.diskAssetSlots]
 */
export function routeReferencesForSeedance(
  shot = {},
  shots = [],
  shotIndex = 0,
  normalized = null,
  options = {}
) {
  const diskAssetSlots = Array.isArray(options.diskAssetSlots) ? options.diskAssetSlots : [];
  const slots = Array.from({ length: 9 }, (_, i) => emptySlot(i + 1));

  // 0) Project Console asset folders → exact Image_N (prompt references)
  diskAssetSlots.forEach((d) => {
    if (!d?.path) return;
    applyToSlot(
      slots,
      Number(d.slot),
      {
        path: d.path,
        url: d.path,
        role: d.role || 'character',
        assetId: d.assetId || '',
        filename: d.filename || '',
        source: 'asset_roots'
      },
      { overwrite: true }
    );
  });

  // 1) Continuity spine video job order (start / looks / place)
  try {
    videoJobSlots(shot, shots, shotIndex).forEach((s) => {
      pushIntoFirstEmpty(slots, {
        url: s.url,
        role: s.role || 'keyframe',
        assetId: s.stem,
        source: 'videoJobSlots'
      });
    });
  } catch {
    /* ignore */
  }

  // 2) Character bible looks
  try {
    (shot.characters || []).forEach((c) => {
      pushIntoFirstEmpty(slots, {
        url: characterLookUrl(c),
        role: 'character',
        assetId: c?.id || c?.assetId || c?.name,
        source: 'character_bible'
      });
    });
  } catch {
    /* ignore */
  }

  // 3) Explicit stills on the shot
  pushIntoFirstEmpty(slots, {
    url: shot.lockedStillUrl || shot.firstFrameUrl || normalized?.references?.firstFrame,
    role: 'keyframe',
    assetId: `${normalized?.shotId || 'shot'}_first`,
    source: 'first_frame'
  });
  pushIntoFirstEmpty(slots, {
    url: shot.lastFrameUrl || normalized?.references?.lastFrame,
    role: 'action',
    assetId: `${normalized?.shotId || 'shot'}_last`,
    source: 'last_frame'
  });

  // 4) World plate
  try {
    const world = shot.world || null;
    if (world) {
      pushIntoFirstEmpty(slots, {
        url: worldPlateUrl(world),
        role: 'environment',
        assetId: world.assetId || world.id || world.name,
        source: 'world_vault'
      });
    }
  } catch {
    /* ignore */
  }

  return {
    slots,
    assigned: slots.filter((s) => s.path || s.url).length,
    empty: slots.filter((s) => s.empty).length,
    diskAssigned: slots.filter((s) => s.source === 'asset_roots').length
  };
}

export function referenceDebugSummary(routed) {
  return (routed?.slots || []).map((s) => ({
    input: s.input,
    role: s.role,
    hasFile: Boolean(s.url),
    hasPath: Boolean(s.path || s.localPath),
    source: s.source,
    assetId: s.assetId || null
  }));
}
