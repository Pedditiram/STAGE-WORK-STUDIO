/** Auto-save interval options for project disk save (Header Save menu). */

export const AUTO_SAVE_INTERVALS = Object.freeze([
  { id: 'off', label: 'Auto-save off', ms: 0 },
  { id: '2m', label: 'Every 2 minutes', ms: 2 * 60 * 1000 },
  { id: '5m', label: 'Every 5 minutes', ms: 5 * 60 * 1000 },
  { id: '15m', label: 'Every 15 minutes', ms: 15 * 60 * 1000 },
  { id: '30m', label: 'Every 30 minutes', ms: 30 * 60 * 1000 }
]);

export function autoSaveIntervalMs(id) {
  const hit = AUTO_SAVE_INTERVALS.find((x) => x.id === id);
  return hit?.ms ?? 0;
}

export function autoSaveIntervalLabel(id) {
  return AUTO_SAVE_INTERVALS.find((x) => x.id === id)?.label || 'Auto-save';
}

export function readAutoSaveIntervalId(fallback = '5m') {
  try {
    if (typeof window === 'undefined') return fallback;
    const saved = localStorage.getItem('sps_auto_save_interval');
    if (saved && AUTO_SAVE_INTERVALS.some((x) => x.id === saved)) return saved;
  } catch {
    /* ignore */
  }
  return fallback;
}
