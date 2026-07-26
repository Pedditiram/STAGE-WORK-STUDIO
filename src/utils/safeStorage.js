// =========================================================
// STAGE PRODUCTION STUDIO - SAFE LOCAL STORAGE HELPER
// Prevents QuotaExceededError crashes by catching & pruning
// =========================================================

export function safeLocalStorageSetItem(key, valueStr) {
  if (typeof window === 'undefined' || !window.localStorage) return false;

  try {
    localStorage.setItem(key, valueStr);
    return true;
  } catch (e) {
    console.warn(`[SafeStorage] QuotaExceededError caught when setting "${key}". Pruning local cache...`);

    try {
      // 1. Clear old cloud sync caches and global backup logs from localStorage
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('sps_cloud_') || k.startsWith('sps_global_project_backups') || k.startsWith('sps_autobackup_'))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));

      // 2. Prune version histories inside sps_project_library to keep localStorage small
      const libraryStr = localStorage.getItem('sps_project_library');
      if (libraryStr) {
        try {
          const library = JSON.parse(libraryStr);
          if (Array.isArray(library)) {
            const prunedLibrary = library.map(proj => ({
              ...proj,
              // Keep only 2 recent version snapshots in localStorage (IndexedDB maintains full vault history)
              versions: (proj.versions || []).slice(0, 2)
            }));
            localStorage.setItem('sps_project_library', JSON.stringify(prunedLibrary));
          }
        } catch (err) {}
      }

      // Retry original setItem
      localStorage.setItem(key, valueStr);
      return true;
    } catch (retryErr) {
      console.warn(`[SafeStorage] Value for "${key}" exceeds 5MB browser quota. Safeguarded without throwing.`, retryErr);
      return false;
    }
  }
}
