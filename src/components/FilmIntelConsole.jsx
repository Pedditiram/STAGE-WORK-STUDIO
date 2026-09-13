import React, { useEffect, useState } from 'react';
import { Radar, X, Maximize2, Minimize2 } from 'lucide-react';
import FilmIntelPanel from './FilmIntelPanel';
import HoverPinBar from './HoverPinBar';

/**
 * Film Intel as a full studio room (same pattern as Budget / Compile asRoom).
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

  const body = (
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
        <HoverPinBar
          storageKey="sps_pin_film_intel_bar"
          defaultPinned
          pinLabel="Film Intel bar"
          ariaLabel="Show Film Intel toolbar"
          className="shrink-0 z-20"
          barClassName="px-4 py-2.5 border-b border-[var(--sps-border)] bg-[var(--sps-bg-elevated)] flex items-center justify-between gap-2"
        >
          <div className="min-w-0 flex-1">
            <h2
              className="text-sm font-semibold m-0 flex items-center gap-2"
              style={{ fontFamily: 'var(--sps-font-display)' }}
            >
              <Radar className="w-4 h-4 text-[var(--sps-gold)]" />
              Film Intel
            </h2>
            <p className="text-[11px] text-[var(--sps-muted)] m-0 truncate">
              {projectTitle || 'Untitled'} · search · quality · suggest · presence · Writer analysis
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!asRoom ? (
              <button
                type="button"
                className="sps-icon-btn"
                title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                onClick={() => setFullscreen((v) => !v)}
              >
                {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            ) : null}
            {!asRoom ? (
              <button type="button" className="sps-icon-btn" onClick={onClose} aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            ) : null}
          </div>
        </HoverPinBar>

        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          <FilmIntelPanel
            key={`film-intel-${tick}`}
            projectTitle={projectTitle}
            shots={shots}
            onOpenWriter={onOpenWriter}
            onJumpToShot={onJumpToShot}
            onRefresh={() => setTick((n) => n + 1)}
            onUpdateShot={onUpdateShot}
            onHealBibleSoT={onHealBibleSoT}
          />
        </div>
      </div>
    </div>
  );

  return body;
}
