import React, { useMemo, useState } from 'react';
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

/**
 * Compact reference library panel — genre + craft aware.
 * Click a chip to insert into the craft field; Copy all for LLM paste.
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
  const [open, setOpen] = useState(!compact);

  const refs = useMemo(
    () =>
      getCinematicReferences({
        genreKey,
        craftKey,
        projectTitle,
        sectionId,
        limitPerCategory: compact ? 4 : 6
      }),
    [genreKey, craftKey, projectTitle, sectionId, compact]
  );

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
    <div
      className={`rounded-xl border border-violet-500/35 bg-violet-950/25 ${compact ? 'p-2.5' : 'p-3'} ${className}`}
      data-force-dark="true"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 text-left cursor-pointer min-w-0"
        >
          <BookOpen className="w-3.5 h-3.5 text-violet-300 shrink-0" />
          <span className="text-[10px] font-black uppercase tracking-wide text-violet-200 truncate">
            Cinematic references
            {refs.craftKey ? ` · craft` : refs.sectionTitle ? ` · section` : ''}
          </span>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-zinc-950/80 border border-violet-800/50 text-violet-300/90 shrink-0">
            {refs.genreLabel}
          </span>
        </button>
        <button
          type="button"
          onClick={handleCopyAll}
          className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-700 text-zinc-300 hover:text-white flex items-center gap-1 cursor-pointer shrink-0"
          title="Copy reference block for LLM / notes"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied' : 'Copy for LLM'}
        </button>
      </div>

      {refs.why ? (
        <p className="text-[10px] text-zinc-400 leading-snug mb-2">{refs.why}</p>
      ) : null}

      {open && (
        <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
          {REFERENCE_CATEGORIES.map((cat) => {
            const items = refs[cat.id] || [];
            if (!items.length) return null;
            const Icon = ICONS[cat.id] || BookOpen;
            return (
              <div key={cat.id}>
                <p className="text-[9px] font-black uppercase tracking-wide text-zinc-500 mb-1 flex items-center gap-1">
                  <Icon className="w-3 h-3" />
                  {cat.label}
                </p>
                <div className="flex flex-wrap gap-1">
                  {items.map((item) => (
                    <button
                      key={item}
                      type="button"
                      title={onInsert ? 'Click to insert into craft field' : item}
                      onClick={() => {
                        if (onInsert) onInsert(item);
                      }}
                      className={`text-left text-[10px] leading-snug px-1.5 py-1 rounded-md border border-zinc-700/80 bg-zinc-950/70 text-zinc-300 ${
                        onInsert ? 'hover:border-violet-400/60 hover:text-violet-100 cursor-pointer' : 'cursor-default'
                      }`}
                    >
                      {item.length > 90 ? `${item.slice(0, 87)}…` : item}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          <p className="text-[9px] text-zinc-600 leading-snug pt-1">
            Taste anchors only — match light, scale, staging grammar. Do not copy plots into prompts.
          </p>
        </div>
      )}
    </div>
  );
}
