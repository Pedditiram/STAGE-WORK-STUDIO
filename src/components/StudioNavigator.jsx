import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, ChevronRight, ChevronDown, Star } from 'lucide-react';
import {
  IconScript,
  IconMatrix,
  IconForm,
  IconStage,
  IconCast,
  IconWorld,
  IconLibrary,
  IconCompile,
  IconPromo,
  IconCampaign,
  IconStoryboard,
  IconBudget,
  IconReel,
  IconSpark,
  IconGear,
  IconHelp,
  IconChat,
  IconClapper,
  IconBrain,
  IconCloud,
  IconDashboard,
} from './StudioIcons';

const FAV_KEY = 'sps_navigator_favorites';

function matches(item, q) {
  if (!q) return true;
  const childHay = (item.children || []).map((c) => `${c.label} ${c.hint || ''}`).join(' ');
  const hay = `${item.label} ${item.hint || ''} ${item.group} ${childHay} ${(item.keywords || []).join(' ')}`.toLowerCase();
  return q.split(/\s+/).every((part) => hay.includes(part));
}

function loadFavorites() {
  try {
    const raw = JSON.parse(localStorage.getItem(FAV_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function saveFavorites(ids) {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

const kbdStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 22,
  height: 20,
  padding: '0 6px',
  borderRadius: 4,
  border: '1px solid var(--sps-border)',
  background: 'var(--sps-surface)',
  fontFamily: 'var(--sps-font-mono)',
  fontSize: 10,
  fontWeight: 600,
  color: 'var(--sps-muted)',
  lineHeight: 1,
};

function NavRow({
  item,
  on,
  expanded,
  isFavorite,
  onOpen,
  onToggleExpand,
  onToggleFavorite,
  onHover,
  depth = 0,
}) {
  const Icon = item.icon;
  const hasKids = Array.isArray(item.children) && item.children.length > 0;
  const off = item.enabled === false;
  const ink = off ? 'var(--sps-muted)' : on ? 'var(--sps-on-gold)' : 'var(--sps-text)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, opacity: off ? 0.42 : 1 }}>
      <div
        data-nav-active={on ? 'true' : 'false'}
        data-nav-off={off ? 'true' : 'false'}
        onMouseEnter={onHover}
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          width: '100%',
          minHeight: 44,
          padding: depth ? '4px 4px 4px 12px' : '6px 4px 6px 8px',
          borderRadius: 8,
          background: on && !off ? 'var(--sps-gold)' : 'transparent',
          color: ink,
        }}
      >
        <button
          type="button"
          onClick={onOpen}
          disabled={off}
          title={off ? 'Switched off in Settings → Console Switcher' : undefined}
          aria-disabled={off}
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            flex: 1,
            minWidth: 0,
            border: 0,
            background: 'transparent',
            color: 'inherit',
            cursor: off ? 'not-allowed' : 'pointer',
            textAlign: 'left',
            fontFamily: 'inherit',
            padding: '2px 4px',
            textTransform: 'none',
            letterSpacing: 0,
          }}
        >
          <span
            style={{
              width: 28,
              height: 28,
              flex: '0 0 28px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 6,
              background: on && !off
                ? 'color-mix(in srgb, var(--sps-on-gold) 14%, transparent)'
                : 'color-mix(in srgb, var(--sps-text) 7%, var(--sps-surface))',
            }}
          >
            {Icon ? <Icon /> : <span style={{ width: 8, height: 8, borderRadius: 99, background: 'currentColor', opacity: 0.35 }} />}
          </span>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 13, fontWeight: 650, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
              {item.label}
            </span>
            <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
              {off ? 'Switched off' : (item.hint || '')}
            </span>
          </span>
        </button>

        <button
          type="button"
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleFavorite();
          }}
          style={{
            width: 28,
            height: 28,
            flex: '0 0 28px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 0,
            borderRadius: 6,
            background: 'transparent',
            color: isFavorite ? (on ? ink : 'var(--sps-gold)') : 'inherit',
            opacity: isFavorite ? 1 : 0.45,
            cursor: 'pointer',
          }}
        >
          <Star size={14} fill={isFavorite ? 'currentColor' : 'none'} strokeWidth={1.75} />
        </button>

        {hasKids ? (
          <button
            type="button"
            title={expanded ? 'Collapse' : 'More in this console'}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleExpand();
            }}
            style={{
              width: 28,
              height: 28,
              flex: '0 0 28px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `1px solid ${on && !off ? 'color-mix(in srgb, var(--sps-on-gold) 40%, transparent)' : 'var(--sps-border)'}`,
              borderRadius: 6,
              background: on && !off ? 'color-mix(in srgb, var(--sps-on-gold) 12%, transparent)' : 'var(--sps-surface)',
              color: 'inherit',
              cursor: off ? 'not-allowed' : 'pointer',
              opacity: off ? 0.5 : 1,
            }}
            disabled={off}
          >
            {expanded ? <ChevronDown size={14} strokeWidth={2.2} /> : <ChevronRight size={14} strokeWidth={2.2} />}
          </button>
        ) : null}
      </div>

      {hasKids && expanded ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: 8 }}>
          {item.children.map((child) => (
            <NavRow
              key={child.id}
              item={child}
              on={false}
              expanded={false}
              isFavorite={child._fav}
              onOpen={() => child.run?.()}
              onToggleExpand={() => {}}
              onToggleFavorite={() => child._onFav?.()}
              onHover={() => {}}
              depth={1}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function StudioNavigator({ isOpen, onClose, items = [] }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [expandedId, setExpandedId] = useState(null);
  const [favoriteIds, setFavoriteIds] = useState(loadFavorites);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const catalog = useMemo(() => {
    const flat = [];
    items.forEach((item) => {
      flat.push(item);
      (item.children || []).forEach((c) => flat.push({ ...c, parentId: item.id }));
    });
    return flat;
  }, [items]);

  const toggleFavorite = useCallback((id) => {
    setFavoriteIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      saveFavorites(next);
      return next;
    });
  }, []);

  const filtered = useMemo(
    () => items.filter((item) => matches(item, query.trim().toLowerCase())),
    [items, query]
  );

  const favoriteItems = useMemo(() => {
    return favoriteIds
      .map((id) => catalog.find((item) => item.id === id))
      .filter(Boolean)
      .map((item) => ({
        ...item,
        group: 'Favorites',
        children: undefined,
      }));
  }, [favoriteIds, catalog]);

  const columns = useMemo(() => {
    const map = new Map();
    if (favoriteItems.length) map.set('Favorites', []);
    filtered.forEach((item) => {
      const g = item.group || 'Studio';
      if (!map.has(g)) map.set(g, []);
    });
    const rows = [];
    if (favoriteItems.length) {
      favoriteItems.forEach((item) => {
        const idx = rows.length;
        rows.push(item);
        map.get('Favorites').push({ item, idx });
      });
    }
    filtered.forEach((item) => {
      const g = item.group || 'Studio';
      const idx = rows.length;
      rows.push(item);
      map.get(g).push({ item, idx });
    });
    return { columns: Array.from(map.entries()), rows };
  }, [filtered, favoriteItems]);

  const rowItems = columns.rows;

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setActive(0);
      setExpandedId(null);
      return undefined;
    }
    setActive(0);
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [isOpen]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    const el = listRef.current?.querySelector('[data-nav-active="true"]');
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [active, rowItems.length]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      const hit = rowItems[active];
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault();
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((i) => Math.min(i + 1, Math.max(rowItems.length - 1, 0)));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (hit?.children?.length && expandedId !== hit.id) {
          setExpandedId(hit.id);
          return;
        }
        const colList = columns.columns;
        const colIdx = colList.findIndex(([, rows]) => rows.some((r) => r.idx === active));
        if (colIdx < 0) return;
        const rowIdx = colList[colIdx][1].findIndex((r) => r.idx === active);
        const nextCol = colList[(colIdx + 1) % colList.length];
        const next = nextCol[1][Math.min(rowIdx, nextCol[1].length - 1)];
        if (next) setActive(next.idx);
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (expandedId) {
          setExpandedId(null);
          return;
        }
        const colList = columns.columns;
        const colIdx = colList.findIndex(([, rows]) => rows.some((r) => r.idx === active));
        if (colIdx < 0) return;
        const rowIdx = colList[colIdx][1].findIndex((r) => r.idx === active);
        const nextCol = colList[(colIdx - 1 + colList.length) % colList.length];
        const next = nextCol[1][Math.min(rowIdx, nextCol[1].length - 1)];
        if (next) setActive(next.idx);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (hit && hit.enabled !== false) {
          onClose?.();
          hit.run?.();
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [isOpen, rowItems, active, onClose, columns.columns, expandedId]);

  if (!isOpen) return null;

  const decorate = (item) => ({
    ...item,
    children: (item.children || []).map((c) => ({
      ...c,
      enabled: item.enabled === false ? false : c.enabled,
      _fav: favoriteIds.includes(c.id),
      _onFav: () => toggleFavorite(c.id),
      run: () => {
        if (item.enabled === false || c.enabled === false) return;
        onClose?.();
        c.run?.();
      },
    })),
  });

  return (
    <div
      className="sps-overlay sps-studio-nav-overlay"
      style={{
        zIndex: 80,
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: 'min(10vh, 4rem) 1.25rem 2rem',
        background: 'color-mix(in srgb, var(--sps-bg) 38%, rgba(20, 16, 12, 0.5))',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="sps-studio-nav-panel"
        role="dialog"
        aria-label="Studio navigator"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: 'min(72rem, calc(100vw - 2rem))',
          maxHeight: 'min(46rem, 88vh)',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid var(--sps-border)',
          borderRadius: 14,
          background: 'var(--sps-bg-elevated)',
          boxShadow: '0 0 0 1px color-mix(in srgb, var(--sps-gold) 20%, transparent), var(--sps-shadow-lift)',
          overflow: 'hidden',
          color: 'var(--sps-text)',
          fontFamily: 'var(--sps-font)',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            padding: '14px 16px',
            borderBottom: '1px solid var(--sps-border)',
            background: 'var(--sps-surface)',
          }}
        >
          <Search size={18} strokeWidth={1.75} style={{ flexShrink: 0, color: 'var(--sps-gold)' }} aria-hidden />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' || e.key === 'Esc') {
                e.preventDefault();
                e.stopPropagation();
                onClose?.();
              }
            }}
            placeholder="Go to room or tool…"
            aria-label="Search studio"
            autoComplete="off"
            spellCheck={false}
            style={{
              flex: 1,
              minWidth: 0,
              border: 0,
              background: 'transparent',
              color: 'var(--sps-text)',
              fontSize: 16,
              fontWeight: 500,
              outline: 'none',
              padding: 0,
            }}
          />
          <button
            type="button"
            className="sps-btn"
            onClick={() => onClose?.()}
            aria-label="Close navigator"
            title="Close (Esc)"
            style={{ minHeight: 32, padding: '0 10px', fontSize: 11 }}
          >
            Esc
          </button>
        </div>

        <div
          ref={listRef}
          className="sps-studio-nav-list"
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.max(columns.columns.length, 1)}, minmax(0, 1fr))`,
            gap: 0,
            background: 'var(--sps-bg-elevated)',
          }}
        >
          {rowItems.length === 0 ? (
            <p style={{ gridColumn: '1 / -1', padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--sps-muted)', fontSize: 13, margin: 0 }}>
              No match
            </p>
          ) : (
            columns.columns.map(([group, rows], colI) => (
              <section
                key={group}
                style={{
                  padding: '12px 10px 14px',
                  borderLeft: colI === 0 ? 0 : '1px solid var(--sps-border)',
                  minWidth: 0,
                }}
              >
                <h3
                  style={{
                    margin: '0 8px 8px',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: 'var(--sps-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {group === 'Favorites' ? <Star size={11} fill="var(--sps-gold)" color="var(--sps-gold)" /> : null}
                  {group}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {rows.map(({ item, idx }) => {
                    const decorated = decorate(item);
                    return (
                      <NavRow
                        key={`${group}-${item.id}`}
                        item={decorated}
                        on={idx === active}
                        expanded={expandedId === item.id}
                        isFavorite={favoriteIds.includes(item.id)}
                        onHover={() => setActive(idx)}
                        onOpen={() => {
                          if (item.enabled === false) return;
                          onClose?.();
                          item.run?.();
                        }}
                        onToggleExpand={() => {
                          if (item.enabled === false) return;
                          setExpandedId((id) => (id === item.id ? null : item.id));
                        }}
                        onToggleFavorite={() => toggleFavorite(item.id)}
                      />
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 14,
            padding: '8px 16px 10px',
            borderTop: '1px solid var(--sps-border)',
            background: 'var(--sps-surface)',
            color: 'var(--sps-muted)',
            fontSize: 11,
          }}
        >
          <span className="sps-nav-hint-desktop" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            Click row to open · arrow to expand · star to favorite
          </span>
          <span className="sps-nav-hint-mobile">
            Swipe from the left edge · two-finger tap · menu button
          </span>
          <span className="sps-nav-hint-desktop" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={kbdStyle}>→</span> expand
          </span>
          <span className="sps-nav-hint-desktop" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={kbdStyle}>↵</span> open
          </span>
        </div>
      </div>
    </div>
  );
}

export const NAV_ICONS = {
  writer: IconScript,
  matrix: IconMatrix,
  form: IconForm,
  stage: IconStage,
  cast: IconCast,
  world: IconWorld,
  library: IconLibrary,
  compile: IconCompile,
  promo: IconPromo,
  campaign: IconCampaign,
  storyboard: IconStoryboard,
  pitch: IconClapper,
  budget: IconBudget,
  reel: IconReel,
  generate: IconSpark,
  settings: IconGear,
  help: IconHelp,
  chat: IconChat,
  deck: IconClapper,
  brain: IconBrain,
  dashboard: IconDashboard,
  versions: IconCloud,
};
