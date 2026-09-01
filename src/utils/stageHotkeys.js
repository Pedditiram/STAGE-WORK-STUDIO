/**
 * Stage owns ⌘Z only while the event is inside the Stage root.
 * Writer / Matrix / native text fields keep their own undo.
 */

export function stageHotkeysClaimEvent(e, stageRoot) {
  if (!e || !stageRoot) return false;
  const t = e.target;
  const tag = String(t?.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || t?.isContentEditable) {
    return false;
  }
  if (t != null && typeof stageRoot.contains === 'function') {
    try {
      if (stageRoot.contains(t)) return true;
    } catch {
      /* target is not a Node */
    }
  }
  if (typeof t?.closest === 'function') {
    const hit = t.closest('[data-stage-root]');
    return Boolean(hit && (hit === stageRoot || (typeof stageRoot.contains === 'function' && stageRoot.contains(hit))));
  }
  return false;
}

export function appShotHistoryShouldHandleUndo(e, activeView) {
  if (!e) return false;
  const tag = String(e.target?.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) {
    return false;
  }
  if (String(activeView || '') === 'canvas') return false;
  if (typeof e.target?.closest === 'function' && e.target.closest('[data-stage-root]')) return false;
  return true;
}
