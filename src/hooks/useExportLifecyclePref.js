import { useCallback, useEffect, useState } from 'react';
import {
  EXPORT_LIFECYCLE_PREF_DEFS,
  exportLifecycleModeFromStrict,
  readExportLifecycleStrict,
  writeExportLifecycleStrict
} from '../utils/exportLifecyclePrefs';

/** Advise / Strict export lifecycle pref — syncs with Settings hub via localStorage event. */
export function useExportLifecyclePref(prefId) {
  const def = EXPORT_LIFECYCLE_PREF_DEFS.find((d) => d.id === prefId);
  const storageKey = def?.key || '';
  const defaultStrict = def?.defaultStrict ?? true;

  const [strict, setStrictState] = useState(() =>
    storageKey ? readExportLifecycleStrict(storageKey, defaultStrict) : defaultStrict
  );

  const setStrict = useCallback((next) => {
    setStrictState(Boolean(next));
  }, []);

  useEffect(() => {
    if (!storageKey) return;
    writeExportLifecycleStrict(storageKey, strict);
  }, [storageKey, strict]);

  useEffect(() => {
    if (!storageKey) return undefined;
    const onPref = (e) => {
      if (e?.detail?.key !== storageKey) return;
      setStrictState(e.detail.mode === 'strict');
    };
    window.addEventListener('sps_export_lifecycle_prefs_updated', onPref);
    return () => window.removeEventListener('sps_export_lifecycle_prefs_updated', onPref);
  }, [storageKey]);

  return {
    strict,
    setStrict,
    mode: exportLifecycleModeFromStrict(strict),
    def
  };
}
