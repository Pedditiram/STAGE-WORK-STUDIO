import React, { useEffect, useState } from 'react';
import { X, Maximize2, Minimize2 } from 'lucide-react';
import FilmIntelPanel from './FilmIntelPanel';

/**
 * Film Intel as a full studio room (same pattern as Budget / Compile asRoom).
 * Room mode: one chrome row inside the panel — no duplicate title bar.
 */
export default function FilmIntelConsole({
  isOpen = true,
  asRoom = false,
  onClose,
  projectTitle = '',
  shots = [],
  onOpenWriter,
  onJumpToShot,
  onUpdateShot,
  onHealBibleSoT
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      if (fullscreen) {
        setFullscreen(false);
        return;
      }
      if (asRoom) return;
      onClose?.();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [isOpen, fullscreen, asRoom, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={`flex flex-col min-h-0 bg-[var(--sps-bg)] text-[var(--sps-text)] ${
        asRoom
          ? 'h-full w-full'
          : fullscreen
            ? 'fixed inset-0 z-[95]'
            : 'sps-overlay'
      }`}
      style={asRoom || fullscreen ? undefined : { zIndex: 92 }}
    >
      <div
        className={`flex flex-col min-h-0 ${
          asRoom || fullscreen
            ? 'h-full w-full'
            : 'sps-shell sps-shell-lg max-h-[92vh] w-full'
        }`}
      >
        {!asRoom ? (
          <div className="shrink-0 px-3 py-1.5 border-b border-[var(--sps-border)] bg-[var(--sps-bg-elevated)] flex items-center justify-end gap-1">
            <button
              type="button"
              className="sps-icon-btn"
              title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              onClick={() => setFullscreen((v) => !v)}
            >
              {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button type="button" className="sps-icon-btn" onClick={onClose} aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : null}

        <div className={`flex-1 min-h-0 overflow-y-auto ${asRoom ? 'p-2.5' : 'p-3'}`}>
          <FilmIntelPanel
            key={`film-intel-${tick}`}
            projectTitle={projectTitle}
            shots={shots}
            onOpenWriter={onOpenWriter}
            onJumpToShot={onJumpToShot}
            onRefresh={() => setTick((n) => n + 1)}
            onUpdateShot={onUpdateShot}
            onHealBibleSoT={onHealBibleSoT}
            compact
          />
        </div>
      </div>
    </div>
  );
}
