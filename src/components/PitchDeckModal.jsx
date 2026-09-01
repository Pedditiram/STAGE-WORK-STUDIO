import React, { useCallback, useEffect, useState } from 'react';
import PitchDeckMaker from './PitchDeckMaker';

export default function PitchDeckModal({
  isOpen,
  onClose,
  asRoom = false,
  shots = [],
  projectTitle = 'Project',
  aspectRatio = '2.39:1',
  genreKey = '',
  lookOnly = false
}) {
  const [fullscreen, setFullscreen] = useState(false);

  const exitFs = useCallback(async () => {
    setFullscreen(false);
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!isOpen && !asRoom) {
      setFullscreen(false);
      return undefined;
    }
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (document.querySelector('.sps-pitch-present')) return;
      if (fullscreen) {
        e.preventDefault();
        e.stopPropagation();
        exitFs();
        return;
      }
      if (asRoom) return;
      e.preventDefault();
      e.stopPropagation();
      onClose?.();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [isOpen, asRoom, fullscreen, exitFs, onClose]);

  if (!asRoom && !isOpen) return null;

  const body = (
    <PitchDeckMaker
      shots={shots}
      projectTitle={projectTitle}
      aspectRatio={aspectRatio}
      genreKey={genreKey}
      lookOnly={lookOnly}
      fullscreen={fullscreen}
      onToggleFullscreen={() => setFullscreen((v) => !v)}
    />
  );

  if (asRoom) {
    return (
      <div className={`flex flex-col h-full min-h-0 overflow-hidden sps-atelier-room ${fullscreen ? 'sps-fs-console' : ''}`}>
        {body}
      </div>
    );
  }

  return (
    <div className={`sps-overlay ${fullscreen ? 'is-full' : ''}`} style={{ zIndex: 88 }}>
      <div className="sps-shell sps-atelier-room">{body}</div>
    </div>
  );
}
