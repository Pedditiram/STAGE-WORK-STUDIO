import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Copy, Check, Film, Clapperboard, Aperture, Palette, ScrollText } from 'lucide-react';
import {
  getCinematicReferences,
  formatReferencesForLLM,
  hasAnyReferences,
  REFERENCE_CATEGORIES
} from '../constants/cinematicReferences';

const ICONS = {
  movies: Film,
  directors: Clapperboard,
  dops: Aperture,
  art: Palette,
  screenplays: ScrollText
};

function shortLabel(item) {
  const s = String(item || '');
  const cut = s.split('—')[0].split(' - ')[0].trim();
  return cut.length > 28 ? `${cut.slice(0, 26)}…` : cut;
}

/**
 * Small refs button. Opens a compact popover — used in craft, Cast, World, Writer.
 */
export default function CinematicReferencesPanel({
  genreKey = 'mythological',
  craftKey = null,
  projectTitle = '',
  sectionId = null,
  onInsert = null,
  compact = false,
  className = ''
}) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const refs = useMemo(
    () =>
      getCinematicReferences({
        genreKey,
        craftKey,
        projectTitle,
        sectionId,
        limitPerCategory: compact ? 4 : 5
      }),
    [genreKey, craftKey, projectTitle, sectionId, compact]
  );

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (!hasAnyReferences(refs)) return null;

  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(formatReferencesForLLM(refs, { maxItems: 5 }));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  return (
    <div ref={wrapRef} className={`relative inline-flex shrink-0 ${className}`}>
      <button
        type="button"
        className={`sps-icon-btn ${open ? 'is-on' : ''}`}
        title="Cinematic references"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <BookOpen className="w-3.5 h-3.5" />
      </button>
      {open ? (
        <div className="sps-refs-pop absolute right-0 top-[calc(100%+6px)] z-[80] w-[min(18rem,70vw)] rounded-[8px] border border-[var(--sps-border)] bg-[var(--sps-surface)] p-2 shadow-[var(--sps-shadow-lift)]">
          <div className="flex items-center justify-between gap-1 mb-1.5">
            <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--sps-muted)] truncate">
              {refs.genreLabel}
            </span>
            <button
              type="button"
              onClick={handleCopyAll}
              className="sps-icon-btn"
              title="Copy for LLM"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {REFERENCE_CATEGORIES.map((cat) => {
              const items = refs[cat.id] || [];
              if (!items.length) return null;
              const Icon = ICONS[cat.id] || BookOpen;
              return (
                <div key={cat.id}>
                  <p className="text-[8px] font-bold uppercase tracking-wide text-[var(--sps-muted)] mb-0.5 flex items-center gap-1 m-0">
                    <Icon className="w-2.5 h-2.5" />
                    {cat.label}
                  </p>
                  <div className="flex flex-wrap gap-0.5">
                    {items.map((item) => (
                      <button
                        key={item}
                        type="button"
                        title={item}
                        onClick={() => {
                          if (onInsert) {
                            onInsert(item);
                            setOpen(false);
                          }
                        }}
                        className="sps-btn sps-btn-compact text-[9px] max-w-full"
                      >
                        {shortLabel(item)}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
