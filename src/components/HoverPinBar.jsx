import React, { useEffect, useRef, useState } from 'react';
import { Pin } from 'lucide-react';

/** Labeled pin — stops auto-minimize. Use on every studio bar. */
export function PinBarButton({ pinned, onToggle, label = 'bar', title: titleBase }) {
  const pinTitle = titleBase || label;
  return (
    <button
      type="button"
      className={`sps-pin-btn shrink-0 ${pinned ? 'is-on' : ''}`}
      title={pinned ? `Unpin ${pinTitle}` : `Pin ${pinTitle}`}
      aria-label={pinned ? `Unpin ${pinTitle}` : `Pin ${pinTitle}`}
      aria-pressed={pinned}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle?.();
      }}
    >
      <Pin size={9} strokeWidth={2.2} />
    </button>
  );
}

/**
 * Writer-style chrome: gold hover strip to reveal, Pin to keep.
 * Pin control sits on the right of every bar.
 */
export default function HoverPinBar({
  storageKey,
  defaultPinned = true,
  ariaLabel = 'Show toolbar',
  pinLabel = 'bar',
  pinTitle,
  className = '',
  barClassName = '',
  wrap = true,
  children
}) {
  const [pinned, setPinned] = useState(() => {
    try {
      const v = localStorage.getItem(storageKey);
      if (v === 'false') return false;
      if (v === 'true') return true;
    } catch (e) {}
    return defaultPinned;
  });
  const [hoverOpen, setHoverOpen] = useState(false);
  const leaveTimer = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, pinned ? 'true' : 'false');
    } catch (e) {}
  }, [storageKey, pinned]);

  useEffect(() => () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
  }, []);

  const onEnter = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    if (!pinned) setHoverOpen(true);
  };
  const onLeave = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    leaveTimer.current = setTimeout(() => setHoverOpen(false), 160);
  };

  return (
    <div
      className={`sps-hover-chrome ${pinned ? 'is-pinned' : 'is-collapsed'}${!pinned && hoverOpen ? ' is-hover-open' : ''} ${className}`}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <button
        type="button"
        className="sps-chrome-reveal"
        aria-label={ariaLabel}
        title={ariaLabel}
        tabIndex={-1}
        onClick={() => {
          setHoverOpen(true);
          setPinned(true);
        }}
      />
      <div className={`sps-hover-chrome-bar ${barClassName}`}>
        <div className={`flex-1 min-w-0 flex items-center gap-0.5 ${wrap ? 'flex-wrap' : 'flex-nowrap overflow-x-auto'}`}>
          {children}
        </div>
        <PinBarButton
          pinned={pinned}
          onToggle={() => setPinned((v) => !v)}
          label={pinLabel}
          title={pinTitle}
        />
      </div>
    </div>
  );
}
