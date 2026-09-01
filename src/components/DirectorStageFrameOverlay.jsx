import React from 'react';

const GUIDE_KEYS = [
  { id: 'thirds', label: 'Thirds' },
  { id: 'centerCross', label: 'Cross' },
  { id: 'horizon', label: 'Horizon' },
  { id: 'actionSafe', label: 'Action' },
  { id: 'titleSafe', label: 'Title' },
  { id: 'centerMarker', label: 'Center' }
];

export const DEFAULT_STAGE_GUIDES = {
  thirds: true,
  centerCross: false,
  horizon: false,
  actionSafe: false,
  titleSafe: false,
  centerMarker: true
};

export { GUIDE_KEYS };

/**
 * Director frame overlay: composition guides + slate (spec §18–19).
 */
export default function DirectorStageFrameOverlay({
  guides = DEFAULT_STAGE_GUIDES,
  slate = '',
  compact = false
}) {
  const g = { ...DEFAULT_STAGE_GUIDES, ...guides };
  const stroke = compact ? 0.35 : 0.45;
  return (
    <div className="pointer-events-none absolute inset-0 z-[12]" aria-hidden="true">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
        {g.thirds ? (
          <>
            <line x1="33.333" y1="0" x2="33.333" y2="100" stroke="rgba(244,236,222,0.28)" strokeWidth={stroke} />
            <line x1="66.667" y1="0" x2="66.667" y2="100" stroke="rgba(244,236,222,0.28)" strokeWidth={stroke} />
            <line x1="0" y1="33.333" x2="100" y2="33.333" stroke="rgba(244,236,222,0.28)" strokeWidth={stroke} />
            <line x1="0" y1="66.667" x2="100" y2="66.667" stroke="rgba(244,236,222,0.28)" strokeWidth={stroke} />
          </>
        ) : null}
        {g.centerCross ? (
          <>
            <line x1="50" y1="0" x2="50" y2="100" stroke="rgba(201,163,106,0.45)" strokeWidth={stroke} />
            <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(201,163,106,0.45)" strokeWidth={stroke} />
          </>
        ) : null}
        {g.horizon && !g.centerCross ? (
          <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(56,189,248,0.4)" strokeWidth={stroke} />
        ) : null}
        {g.actionSafe ? (
          <rect x="5" y="5" width="90" height="90" fill="none" stroke="rgba(244,236,222,0.22)" strokeWidth={stroke} />
        ) : null}
        {g.titleSafe ? (
          <rect x="10" y="10" width="80" height="80" fill="none" stroke="rgba(201,163,106,0.28)" strokeWidth={stroke} strokeDasharray="1.2 1.2" />
        ) : null}
        {g.centerMarker ? (
          <>
            <line x1="47" y1="50" x2="53" y2="50" stroke="rgba(244,236,222,0.7)" strokeWidth={stroke * 1.4} />
            <line x1="50" y1="47" x2="50" y2="53" stroke="rgba(244,236,222,0.7)" strokeWidth={stroke * 1.4} />
          </>
        ) : null}
      </svg>
      {slate ? (
        <div className="absolute bottom-1.5 left-1.5 right-1.5 flex justify-between gap-2">
          <span className="text-[9px] uppercase tracking-[0.14em] text-white/85 bg-black/55 px-1.5 py-0.5 truncate">
            {slate}
          </span>
        </div>
      ) : null}
    </div>
  );
}
