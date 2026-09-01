// =========================================================
// STAGE PRODUCTION STUDIO - SAFE LOCAL STORAGE HELPER
// Prevents QuotaExceededError crashes by catching & pruning
// =========================================================

const PRUNE_PREFIXES = [
  'sps_cloud_',
  'sps_global_project_backups',
  'sps_autobackup_',
  'sps_creative_audit::',
  'sps_generation_jobs::'
];

function collectPrunableKeys() {
  const keysToRemove = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (PRUNE_PREFIXES.some((p) => k.startsWith(p))) keysToRemove.push(k);
    }
  } catch {
    /* ignore */
  }
  return keysToRemove;
}

function pruneLibraryVersions(keep = 2) {
  try {
    const libraryStr = localStorage.getItem('sps_project_library');
    if (!libraryStr) return false;
    const library = JSON.parse(libraryStr);
    if (!Array.isArray(library)) return false;
    const prunedLibrary = library.map((proj) => ({
      ...proj,
      versions: (proj.versions || []).slice(0, keep)
    }));
    localStorage.setItem('sps_project_library', JSON.stringify(prunedLibrary));
    return true;
  } catch {
    return false;
  }
}

function slimLibraryPayload(valueStr) {
  const library = JSON.parse(valueStr);
  if (!Array.isArray(library)) return null;
  return library.map((proj) => ({
    ...proj,
    versions: [],
    projectGeneratedImages: undefined,
    shots: (proj.shots || []).map((s) => {
      if (!s || typeof s !== 'object') return s;
      const { embeddedImages, embeddedVideo, generationTakes, ...rest } = s;
      // Keep take metadata ids; drop heavy media blobs from local mirror
      const takes = generationTakes
        ? {
            ...generationTakes,
            stillTakes: (generationTakes.stillTakes || []).map((t) => ({
              ...t,
              url: t.url && String(t.url).startsWith('data:') ? '' : t.url
            })),
            videoTakes: (generationTakes.videoTakes || []).map((t) => ({
              ...t,
              url: t.url && String(t.url).startsWith('data:') ? '' : t.url
            }))
          }
        : undefined;
      return takes ? { ...rest, generationTakes: takes } : rest;
    })
  }));
}

function emitPressure(detail = {}) {
  try {
    window.dispatchEvent(new CustomEvent('sps_storage_pressure', { detail }));
  } catch {
    /* ignore */
  }
}

/** Approximate localStorage usage (UTF-16 ≈ 2 bytes/char). */
export function estimateLocalStorageUsage() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { bytes: 0, keys: 0, mb: 0, pctOf5mb: 0 };
  }
  let bytes = 0;
  let keys = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      keys += 1;
      const v = localStorage.getItem(k) || '';
      bytes += (k.length + v.length) * 2;
    }
  } catch {
    /* ignore */
  }
  const mb = bytes / (1024 * 1024);
  return {
    bytes,
    keys,
    mb: Math.round(mb * 100) / 100,
    pctOf5mb: Math.min(100, Math.round((bytes / (5 * 1024 * 1024)) * 100))
  };
}

/** Aggressive prune for ops UI / quota recovery. */
export function pruneLocalStoragePressure({ keepVersions = 1 } = {}) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ok: false, removed: 0 };
  }
  const before = estimateLocalStorageUsage();
  const keys = collectPrunableKeys();
  keys.forEach((k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  });
  pruneLibraryVersions(keepVersions);
  const after = estimateLocalStorageUsage();
  emitPressure({ action: 'prune', removed: keys.length, before, after });
  return { ok: true, removed: keys.length, before, after };
}

export function safeLocalStorageSetItem(key, valueStr) {
  if (typeof window === 'undefined' || !window.localStorage) return false;

  try {
    localStorage.setItem(key, valueStr);
    return true;
  } catch (e) {
    console.warn(`[SafeStorage] QuotaExceededError caught when setting "${key}". Pruning local cache...`);
    emitPressure({ action: 'quota_hit', key });

    try {
      collectPrunableKeys().forEach((k) => localStorage.removeItem(k));
      pruneLibraryVersions(2);

      localStorage.setItem(key, valueStr);
      return true;
    } catch (retryErr) {
      if (key === 'sps_project_library') {
        try {
          const slim = slimLibraryPayload(valueStr);
          if (slim) {
            localStorage.setItem(key, JSON.stringify(slim));
            emitPressure({ action: 'library_slimmed', key });
            return true;
          }
        } catch {
          /* ignore */
        }
      }
      console.warn(`[SafeStorage] Value for "${key}" exceeds browser quota. Safeguarded without throwing.`, retryErr);
      emitPressure({ action: 'quota_fail', key });
      return false;
    }
  }
}
