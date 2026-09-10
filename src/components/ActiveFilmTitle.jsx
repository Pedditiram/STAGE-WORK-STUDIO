import React, { useEffect, useState } from 'react';

/**
 * Room film name — large, clean display type. Lives next to Matrix Focus, not in the masthead.
 */
export default function ActiveFilmTitle({
  title = '',
  shotCount = null,
  canRename = false,
  onRename,
  className = ''
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);

  useEffect(() => {
    if (!editing) setDraft(title);
  }, [title, editing]);

  const commit = () => {
    const next = String(draft || '').trim();
    if (next && next !== title) onRename?.(next);
    setEditing(false);
  };

  const startEdit = () => {
    if (!canRename) return;
    setDraft(title);
    setEditing(true);
  };

  return (
    <div className={`sps-film-title-wrap ${className}`.trim()}>
      {editing ? (
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setDraft(title);
              setEditing(false);
            }
          }}
          onBlur={commit}
          autoFocus
          aria-label="Project title"
          className="sps-film-title-input"
        />
      ) : (
        <button
          type="button"
          onClick={startEdit}
          className={`sps-film-title${canRename ? ' is-editable' : ''}`}
          title={canRename ? 'Click to rename this film' : title || 'Active project'}
        >
          {title || 'Untitled'}
        </button>
      )}
      {shotCount != null && Number.isFinite(Number(shotCount)) ? (
        <span className="sps-film-title-count" title={`${shotCount} shots`}>
          {shotCount}
        </span>
      ) : null}
    </div>
  );
}
